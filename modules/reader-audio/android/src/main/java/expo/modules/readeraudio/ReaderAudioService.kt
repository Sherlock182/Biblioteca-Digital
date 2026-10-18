package expo.modules.readeraudio

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import androidx.media.AudioAttributesCompat
import androidx.media.AudioFocusRequestCompat
import androidx.media.AudioManagerCompat
import java.util.Locale

data class ReaderItem(val page: Int, val text: String, val paragraphEnd: Boolean)

data class ReaderConfig(val session: Int, val title: String, val voiceId: String?, val rate: Float, val pitch: Float, val pageMode: String = "page") {
  /** What the notification shows for a position: a PDF page, or chapter and verse of the Bible. */
  fun label(page: Int): String = if (pageMode == "bible") {
    val chapter = page / 1000; val verse = page % 1000
    if (verse > 0) "Capítulo $chapter · versículo $verse" else "Capítulo $chapter"
  } else "Página $page"
}

/**
 * Foreground media service that owns the whole reading queue, so speech keeps going with the
 * screen off or the app in the background, independently of the JavaScript thread.
 * All state is touched on the main thread only.
 */
class ReaderAudioService : Service(), TextToSpeech.OnInitListener {
  companion object {
    const val ACTION_START = "expo.modules.readeraudio.START"
    const val ACTION_PLAY = "expo.modules.readeraudio.PLAY"
    const val ACTION_PAUSE = "expo.modules.readeraudio.PAUSE"
    const val ACTION_NEXT = "expo.modules.readeraudio.NEXT"
    const val ACTION_STOP = "expo.modules.readeraudio.STOP"
    private const val CHANNEL_ID = "reader_audio"
    private const val NOTIFICATION_ID = 4207
    private const val PARAGRAPH_PAUSE_MS = 350L
    private const val MAX_CONSECUTIVE_ERRORS = 5
    private const val WAKE_LOCK_TIMEOUT_MS = 3L * 60 * 60 * 1000

    val main = Handler(Looper.getMainLooper())
    var instance: ReaderAudioService? = null
    var emitter: ((String, Map<String, Any?>) -> Unit)? = null

    // A whole book does not fit in an Intent (binder limit), so the queue is handed over in memory.
    private var pendingConfig: ReaderConfig? = null
    private var pendingItems: MutableList<ReaderItem>? = null
    private var pendingComplete = true

    /** Main thread only. */
    fun start(context: Context, config: ReaderConfig, items: List<ReaderItem>, complete: Boolean) {
      pendingConfig = config
      pendingItems = items.toMutableList()
      pendingComplete = complete
      val intent = Intent(context, ReaderAudioService::class.java).setAction(ACTION_START)
      try {
        ContextCompat.startForegroundService(context, intent)
      } catch (error: Throwable) {
        pendingConfig = null
        pendingItems = null
        throw error
      }
    }

    /** Main thread only. Appends to the session that is starting or already playing. */
    fun append(session: Int, items: List<ReaderItem>, complete: Boolean) {
      val pending = pendingItems
      if (pending != null && pendingConfig?.session == session) {
        pending.addAll(items)
        pendingComplete = complete
        return
      }
      instance?.takeIf { it.config.session == session }?.append(items, complete)
    }

    fun emit(name: String, body: Map<String, Any?>) {
      try { emitter?.invoke(name, body) } catch (_: Throwable) { /* JS not listening */ }
    }
  }

  private val items = ArrayList<ReaderItem>()
  private var position = 0
  private var complete = true
  private var playing = false
  private var ttsReady = false
  private var tts: TextToSpeech? = null
  private var config = ReaderConfig(0, "", null, 1f, 1f)
  private var resolvedVoice: Voice? = null
  private var voiceFailed = false
  private var consecutiveErrors = 0
  private var lastPage = -1
  private var generation = 0
  private var pausedByFocusLoss = false
  private var session: MediaSessionCompat? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private var noisyRegistered = false

  private val focusListener = AudioManager.OnAudioFocusChangeListener { change ->
    main.post {
      when (change) {
        AudioManager.AUDIOFOCUS_LOSS,
        AudioManager.AUDIOFOCUS_LOSS_TRANSIENT,
        AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> if (playing) {
          pause()
          // A phone call or notification sound: continue when it ends. A permanent loss (another player) does not.
          pausedByFocusLoss = change != AudioManager.AUDIOFOCUS_LOSS
        }
        AudioManager.AUDIOFOCUS_GAIN -> if (pausedByFocusLoss) {
          pausedByFocusLoss = false
          resume()
        }
      }
    }
  }

  private val focusRequest: AudioFocusRequestCompat by lazy {
    AudioFocusRequestCompat.Builder(AudioManagerCompat.AUDIOFOCUS_GAIN)
      .setAudioAttributes(
        AudioAttributesCompat.Builder()
          .setUsage(AudioAttributesCompat.USAGE_MEDIA)
          .setContentType(AudioAttributesCompat.CONTENT_TYPE_SPEECH)
          .build()
      )
      .setOnAudioFocusChangeListener(focusListener)
      .build()
  }

  // Headphones unplugged or Bluetooth disconnected: pause instead of speaking out loud.
  private val noisyReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (intent?.action == AudioManager.ACTION_AUDIO_BECOMING_NOISY) main.post { pause() }
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    instance = this
    createChannel()
    session = MediaSessionCompat(this, "ReaderAudio").apply {
      setCallback(object : MediaSessionCompat.Callback() {
        override fun onPlay() { resume() }
        override fun onPause() { pause() }
        override fun onSkipToNext() { nextPage() }
        override fun onStop() { stopAll() }
      })
      isActive = true
    }
    wakeLock = (getSystemService(Context.POWER_SERVICE) as PowerManager)
      .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ReaderAudio::speech")
      .apply { setReferenceCounted(false) }
    tts = TextToSpeech(this, this)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    // A service started with startForegroundService must call startForeground promptly, every time.
    try {
      goForeground()
    } catch (_: Throwable) {
      // The system refused the foreground service: stop cleanly and let the app read with the screen on.
      val refused = pendingConfig?.session ?: config.session
      pendingConfig = null
      pendingItems = null
      emit("onError", mapOf("message" to "Android no permitió leer en segundo plano. Vuelve a tocar «Escuchar» con la app abierta."))
      emit("onState", mapOf("playing" to false, "stopped" to true, "session" to refused))
      stopSelf()
      return START_NOT_STICKY
    }
    when (intent?.action) {
      ACTION_START -> {
        val newConfig = pendingConfig
        val newItems = pendingItems
        pendingConfig = null
        pendingItems = null
        if (newConfig != null && newItems != null) load(newConfig, newItems, pendingComplete)
        else if (items.isEmpty()) stopAll()
      }
      ACTION_PLAY -> resume()
      ACTION_PAUSE -> pause()
      ACTION_NEXT -> nextPage()
      ACTION_STOP -> stopAll()
      else -> if (items.isEmpty()) stopAll()
    }
    return START_NOT_STICKY
  }

  override fun onInit(status: Int) {
    main.post {
      val engine = tts
      if (status != TextToSpeech.SUCCESS || engine == null) {
        emit("onError", mapOf("message" to "El motor de voz del teléfono no está disponible."))
        stopAll()
        return@post
      }
      ttsReady = true
      engine.setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_MEDIA)
          .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
          .build()
      )
      engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
        override fun onStart(utteranceId: String?) {}
        override fun onDone(utteranceId: String?) { main.post { onUtteranceDone(utteranceId) } }
        @Deprecated("Deprecated in Java")
        override fun onError(utteranceId: String?) { main.post { onUtteranceError(utteranceId) } }
        override fun onError(utteranceId: String?, errorCode: Int) { main.post { onUtteranceError(utteranceId) } }
      })
      if (playing) speakCurrent()
    }
  }

  private fun load(newConfig: ReaderConfig, newItems: List<ReaderItem>, isComplete: Boolean) {
    generation++
    tts?.stop()
    config = newConfig
    resolvedVoice = null
    voiceFailed = false
    consecutiveErrors = 0
    lastPage = -1
    items.clear()
    items.addAll(newItems)
    position = 0
    complete = isComplete
    pausedByFocusLoss = false
    playing = true
    startAudio()
    publishState()
    speakCurrent()
  }

  private fun append(more: List<ReaderItem>, isComplete: Boolean) {
    val starved = playing && position >= items.size
    items.addAll(more)
    complete = isComplete
    if (starved) speakCurrent()
  }

  private fun speakCurrent() {
    val engine = tts ?: return
    if (!playing || !ttsReady) return
    if (position >= items.size) {
      // Either the end of the book, or the app is still sending the next pages.
      if (complete) finish()
      return
    }
    val item = items[position]
    engine.setSpeechRate(config.rate)
    engine.setPitch(config.pitch)
    applyVoice(engine)
    val result = engine.speak(item.text, TextToSpeech.QUEUE_FLUSH, Bundle(), utteranceId())
    if (result == TextToSpeech.ERROR) {
      main.post { onUtteranceError(utteranceId()) }
      return
    }
    if (item.page != lastPage) {
      lastPage = item.page
      emit("onProgress", mapOf("page" to item.page, "session" to config.session))
      updateNotification()
      updateMetadata()
    }
  }

  private fun utteranceId() = "$generation:$position"

  private fun applyVoice(engine: TextToSpeech) {
    val spanish = Locale("es")
    try {
      if (engine.isLanguageAvailable(spanish) >= TextToSpeech.LANG_AVAILABLE) engine.language = spanish
    } catch (_: Throwable) { /* keep the engine default */ }
    val wanted = config.voiceId ?: return
    if (voiceFailed) return
    if (resolvedVoice == null) {
      resolvedVoice = try { engine.voices?.firstOrNull { it.name == wanted } } catch (_: Throwable) { null }
    }
    resolvedVoice?.let { voice ->
      try { engine.voice = voice } catch (_: Throwable) { voiceFailed = true }
    }
  }

  private fun onUtteranceDone(id: String?) {
    if (id != utteranceId() || !playing) return
    consecutiveErrors = 0
    val finished = items.getOrNull(position)
    position++
    val delay = if (finished?.paragraphEnd == true) PARAGRAPH_PAUSE_MS else 0L
    val expected = generation
    main.postDelayed({ if (expected == generation) speakCurrent() }, delay)
  }

  private fun onUtteranceError(id: String?) {
    if (id != utteranceId() || !playing) return
    consecutiveErrors++
    if (config.voiceId != null && !voiceFailed) {
      // The chosen voice broke: retry the same sentence with the phone's default Spanish voice.
      voiceFailed = true
      resolvedVoice = null
      emit("onVoiceFallback", emptyMap())
    } else if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      emit("onError", mapOf("message" to "La voz del teléfono dejó de responder."))
      stopAll()
      return
    } else {
      position++
    }
    speakCurrent()
  }

  fun pause() {
    if (!playing) return
    generation++
    playing = false
    pausedByFocusLoss = false
    tts?.stop()
    wakeLock?.let { if (it.isHeld) it.release() }
    publishState()
  }

  fun resume() {
    if (playing) return
    if (position >= items.size && complete) return
    playing = true
    startAudio()
    publishState()
    speakCurrent()
  }

  fun nextPage() {
    val currentPage = items.getOrNull(position)?.page ?: return
    val next = items.indexOfFirst { it.page > currentPage }
    if (next < 0) {
      if (complete) finish()
      return
    }
    generation++
    tts?.stop()
    position = next
    if (playing) speakCurrent() else publishState()
  }

  private fun finish() {
    emit("onFinished", mapOf("session" to config.session))
    stopAll()
  }

  fun stopAll() {
    generation++
    playing = false
    tts?.stop()
    items.clear()
    position = 0
    emit("onState", mapOf("playing" to false, "stopped" to true, "session" to config.session))
    stopAudio()
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  fun snapshot(): Map<String, Any?> = mapOf(
    "active" to items.isNotEmpty(),
    "playing" to playing,
    "page" to items.getOrNull(minOf(position, items.size - 1))?.page,
    "session" to config.session,
  )

  private fun startAudio() {
    wakeLock?.acquire(WAKE_LOCK_TIMEOUT_MS)
    val audio = getSystemService(Context.AUDIO_SERVICE) as AudioManager
    AudioManagerCompat.requestAudioFocus(audio, focusRequest)
    if (!noisyRegistered) {
      ContextCompat.registerReceiver(
        this, noisyReceiver, IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY), ContextCompat.RECEIVER_NOT_EXPORTED
      )
      noisyRegistered = true
    }
  }

  private fun stopAudio() {
    wakeLock?.let { if (it.isHeld) it.release() }
    val audio = getSystemService(Context.AUDIO_SERVICE) as AudioManager
    AudioManagerCompat.abandonAudioFocusRequest(audio, focusRequest)
    if (noisyRegistered) {
      try { unregisterReceiver(noisyReceiver) } catch (_: Throwable) {}
      noisyRegistered = false
    }
  }

  private fun publishState() {
    emit("onState", mapOf("playing" to playing, "stopped" to false, "session" to config.session))
    updateNotification()
    updateMetadata()
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    // The user swiped the app away from recents: stop reading.
    stopAll()
    super.onTaskRemoved(rootIntent)
  }

  override fun onDestroy() {
    generation++
    playing = false
    stopAudio()
    try { tts?.stop(); tts?.shutdown() } catch (_: Throwable) {}
    tts = null
    session?.release()
    session = null
    if (instance === this) instance = null
    super.onDestroy()
  }

  // ---- Notification and lock-screen controls ----

  private fun createChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(CHANNEL_ID, "Lectura en voz alta", NotificationManager.IMPORTANCE_LOW).apply {
        setShowBadge(false)
        description = "Controles de la lectura en voz alta de documentos"
      }
      (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(channel)
    }
  }

  private fun actionIntent(action: String, requestCode: Int): PendingIntent =
    PendingIntent.getService(
      this, requestCode, Intent(this, ReaderAudioService::class.java).setAction(action),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

  private fun buildNotification(): Notification {
    val page = items.getOrNull(minOf(position, items.size - 1))?.page
    val launch = packageManager.getLaunchIntentForPackage(packageName)?.let {
      PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(if (playing) android.R.drawable.ic_media_play else android.R.drawable.ic_media_pause)
      .setContentTitle(config.title.ifBlank { "Lectura en voz alta" })
      .setContentText(if (page != null) config.label(page) + (if (playing) "" else " · En pausa") else "Preparando lectura…")
      .setContentIntent(launch)
      .setDeleteIntent(actionIntent(ACTION_STOP, 4))
      .setOngoing(playing)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setShowWhen(false)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
      .addAction(
        if (playing) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play,
        if (playing) "Pausar" else "Continuar",
        actionIntent(if (playing) ACTION_PAUSE else ACTION_PLAY, 1)
      )
      .addAction(android.R.drawable.ic_media_next, if (config.pageMode == "bible") "Siguiente versículo" else "Siguiente página", actionIntent(ACTION_NEXT, 2))
      .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Detener", actionIntent(ACTION_STOP, 3))
      .setStyle(
        androidx.media.app.NotificationCompat.MediaStyle()
          .setMediaSession(session?.sessionToken)
          .setShowActionsInCompactView(0, 1, 2)
      )
      .build()
  }

  private fun goForeground() {
    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK else 0
    ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(), type)
  }

  @SuppressLint("MissingPermission")
  private fun updateNotification() {
    if (items.isEmpty()) return
    try {
      (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(NOTIFICATION_ID, buildNotification())
    } catch (_: SecurityException) { /* notifications denied: the service still runs */ }
  }

  private fun updateMetadata() {
    val media = session ?: return
    val state = if (playing) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED
    media.setPlaybackState(
      PlaybackStateCompat.Builder()
        .setActions(
          PlaybackStateCompat.ACTION_PLAY or PlaybackStateCompat.ACTION_PAUSE or
            PlaybackStateCompat.ACTION_PLAY_PAUSE or PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
            PlaybackStateCompat.ACTION_STOP
        )
        .setState(state, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1f)
        .build()
    )
    media.setMetadata(
      MediaMetadataCompat.Builder()
        .putString(MediaMetadataCompat.METADATA_KEY_TITLE, config.title.ifBlank { "Lectura en voz alta" })
        .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, if (lastPage > 0) config.label(lastPage) else "")
        .build()
    )
  }
}
