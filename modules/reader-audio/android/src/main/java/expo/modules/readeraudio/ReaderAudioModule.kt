package expo.modules.readeraudio

import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class ReaderStartOptions : Record {
  @Field var session: Int = 0
  @Field var title: String = ""
  @Field var voiceId: String? = null
  @Field var rate: Double = 1.0
  @Field var pitch: Double = 1.0
  /** "page" (PDF) or "bible": pages are chapter * 1000 + verse. */
  @Field var pageMode: String = "page"
}

class ReaderBatch : Record {
  @Field var pages: List<Int> = emptyList()
  @Field var texts: List<String> = emptyList()
  @Field var paragraphEnds: List<Boolean> = emptyList()
  @Field var complete: Boolean = true
}

private fun ReaderBatch.toItems(): List<ReaderItem> =
  texts.indices.map { i -> ReaderItem(pages.getOrElse(i) { 0 }, texts[i], paragraphEnds.getOrElse(i) { false }) }

class ReaderAudioModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ReaderAudio")

    Events("onProgress", "onState", "onFinished", "onError", "onVoiceFallback")

    OnCreate {
      ReaderAudioService.emitter = { name, body -> sendEvent(name, body) }
    }

    OnDestroy {
      ReaderAudioService.emitter = null
    }

    AsyncFunction("start") { options: ReaderStartOptions, batch: ReaderBatch ->
      val context = appContext.reactContext ?: throw CodedException("La app no está lista para reproducir audio.")
      val config = ReaderConfig(options.session, options.title, options.voiceId, options.rate.toFloat(), options.pitch.toFloat(), options.pageMode)
      // Runs on the main thread so a refused start (Android 12+ forbids it with the app in the
      // background) rejects the promise and the app reads with the screen on, instead of crashing.
      try {
        ReaderAudioService.start(context, config, batch.toItems(), batch.complete)
      } catch (error: Throwable) {
        throw CodedException("No se pudo iniciar la lectura en segundo plano.", error)
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("append") { session: Int, batch: ReaderBatch ->
      ReaderAudioService.append(session, batch.toItems(), batch.complete)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("pause") {
      ReaderAudioService.main.post { ReaderAudioService.instance?.pause() }
    }

    AsyncFunction("resume") {
      ReaderAudioService.main.post { ReaderAudioService.instance?.resume() }
    }

    AsyncFunction("stop") {
      ReaderAudioService.main.post { ReaderAudioService.instance?.stopAll() }
    }

    AsyncFunction("getState") {
      ReaderAudioService.instance?.snapshot() ?: mapOf("active" to false, "playing" to false)
    }.runOnQueue(Queues.MAIN)
  }
}
