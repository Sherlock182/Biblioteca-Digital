import AVFoundation
import ExpoModulesCore
import MediaPlayer

struct ReaderStartOptions: Record {
  @Field var session: Int = 0
  @Field var title: String = ""
  @Field var voiceId: String? = nil
  @Field var rate: Double = 1
  @Field var pitch: Double = 1
  // "page" (PDF) or "bible": pages are chapter * 1000 + verse.
  @Field var pageMode: String = "page"
}

struct ReaderBatch: Record {
  @Field var pages: [Int] = []
  @Field var texts: [String] = []
  @Field var paragraphEnds: [Bool] = []
  @Field var complete: Bool = true
}

public class ReaderAudioModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ReaderAudio")

    Events("onProgress", "onState", "onFinished", "onError", "onVoiceFallback")

    OnCreate {
      ReaderAudioPlayer.shared.emit = { [weak self] name, body in
        self?.sendEvent(name, body)
      }
    }

    AsyncFunction("start") { (options: ReaderStartOptions, batch: ReaderBatch) in
      try ReaderAudioPlayer.shared.start(options: options, batch: batch)
    }.runOnQueue(.main)

    AsyncFunction("append") { (session: Int, batch: ReaderBatch) in
      ReaderAudioPlayer.shared.append(session: session, batch: batch)
    }.runOnQueue(.main)

    AsyncFunction("pause") {
      ReaderAudioPlayer.shared.pause()
    }.runOnQueue(.main)

    AsyncFunction("resume") {
      ReaderAudioPlayer.shared.resume()
    }.runOnQueue(.main)

    AsyncFunction("stop") {
      ReaderAudioPlayer.shared.stop()
    }.runOnQueue(.main)

    AsyncFunction("getState") { () -> [String: Any?] in
      ReaderAudioPlayer.shared.snapshot()
    }.runOnQueue(.main)
  }
}

/// Owns the reading queue so speech continues with the screen locked (requires the "audio"
/// background mode). Touched on the main queue only.
final class ReaderAudioPlayer: NSObject, AVSpeechSynthesizerDelegate {
  static let shared = ReaderAudioPlayer()

  private struct Item {
    let page: Int
    let text: String
    let paragraphEnd: Bool
  }

  var emit: ((String, [String: Any?]) -> Void)?
  private let synthesizer = AVSpeechSynthesizer()
  private var items: [Item] = []
  private var position = 0
  private var complete = true
  private var playing = false
  private var session = 0
  private var title = ""
  private var pageMode = "page"
  private var voiceId: String?
  private var rate: Float = 1
  private var pitch: Float = 1
  private var lastPage = -1
  private var current: AVSpeechUtterance?
  private var commandsReady = false
  private var resumeAfterInterruption = false

  override init() {
    super.init()
    synthesizer.delegate = self
  }

  func start(options: ReaderStartOptions, batch: ReaderBatch) throws {
    let audio = AVAudioSession.sharedInstance()
    try audio.setCategory(.playback, mode: .spokenAudio, options: [])
    try audio.setActive(true)
    setupRemoteCommands()
    current = nil
    synthesizer.stopSpeaking(at: .immediate)
    session = options.session
    title = options.title
    pageMode = options.pageMode
    voiceId = options.voiceId
    rate = Float(options.rate)
    pitch = Float(options.pitch)
    items = makeItems(batch)
    complete = batch.complete
    position = 0
    lastPage = -1
    resumeAfterInterruption = false
    playing = true
    publishState()
    speakCurrent()
  }

  func append(session: Int, batch: ReaderBatch) {
    guard session == self.session else { return }
    let starved = playing && position >= items.count
    items.append(contentsOf: makeItems(batch))
    complete = batch.complete
    if starved { speakCurrent() }
  }

  func pause() {
    guard playing else { return }
    playing = false
    resumeAfterInterruption = false
    current = nil
    synthesizer.stopSpeaking(at: .immediate)
    publishState()
  }

  func resume() {
    guard !playing, !(position >= items.count && complete) else { return }
    try? AVAudioSession.sharedInstance().setActive(true)
    playing = true
    publishState()
    speakCurrent()
  }

  func nextPage() {
    guard position < items.count else { return }
    let currentPage = items[position].page
    guard let next = items.firstIndex(where: { $0.page > currentPage }) else {
      if complete { finish() }
      return
    }
    current = nil
    synthesizer.stopSpeaking(at: .immediate)
    position = next
    if playing { speakCurrent() } else { publishState() }
  }

  func stop() {
    playing = false
    current = nil
    synthesizer.stopSpeaking(at: .immediate)
    items = []
    position = 0
    MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    emit?("onState", ["playing": false, "stopped": true, "session": session])
  }

  func snapshot() -> [String: Any?] {
    let page: Int? = items.isEmpty ? nil : items[min(position, items.count - 1)].page
    return ["active": !items.isEmpty, "playing": playing, "page": page, "session": session]
  }

  private func makeItems(_ batch: ReaderBatch) -> [Item] {
    return batch.texts.indices.map { i in
      Item(
        page: i < batch.pages.count ? batch.pages[i] : 0,
        text: batch.texts[i],
        paragraphEnd: i < batch.paragraphEnds.count ? batch.paragraphEnds[i] : false
      )
    }
  }

  private func speakCurrent() {
    guard playing else { return }
    guard position < items.count else {
      // End of the book, or the app is still sending the next pages.
      if complete { finish() }
      return
    }
    let item = items[position]
    let utterance = AVSpeechUtterance(string: item.text)
    utterance.rate = min(AVSpeechUtteranceMaximumSpeechRate, max(AVSpeechUtteranceMinimumSpeechRate, rate * AVSpeechUtteranceDefaultSpeechRate))
    utterance.pitchMultiplier = min(2, max(0.5, pitch))
    // An uninstalled voice returns nil: fall back to any Spanish voice.
    if let id = voiceId, let voice = AVSpeechSynthesisVoice(identifier: id) {
      utterance.voice = voice
    } else {
      utterance.voice = AVSpeechSynthesisVoice(language: "es-MX") ?? AVSpeechSynthesisVoice(language: "es-ES")
    }
    if item.paragraphEnd { utterance.postUtteranceDelay = 0.35 }
    current = utterance
    synthesizer.speak(utterance)
    if item.page != lastPage {
      lastPage = item.page
      emit?("onProgress", ["page": item.page, "session": session])
      updateNowPlaying()
    }
  }

  private func finish() {
    emit?("onFinished", ["session": session])
    stop()
  }

  private func publishState() {
    emit?("onState", ["playing": playing, "stopped": false, "session": session])
    updateNowPlaying()
  }

  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
    DispatchQueue.main.async {
      guard utterance === self.current, self.playing else { return }
      self.position += 1
      self.speakCurrent()
    }
  }

  private func setupRemoteCommands() {
    guard !commandsReady else { return }
    commandsReady = true
    let center = MPRemoteCommandCenter.shared()
    center.playCommand.addTarget { [weak self] _ in self?.resume(); return .success }
    center.pauseCommand.addTarget { [weak self] _ in self?.pause(); return .success }
    center.togglePlayPauseCommand.addTarget { [weak self] _ in
      guard let self = self else { return .commandFailed }
      if self.playing { self.pause() } else { self.resume() }
      return .success
    }
    center.nextTrackCommand.addTarget { [weak self] _ in self?.nextPage(); return .success }
    center.stopCommand.addTarget { [weak self] _ in self?.stop(); return .success }
    NotificationCenter.default.addObserver(
      self, selector: #selector(handleInterruption(_:)),
      name: AVAudioSession.interruptionNotification, object: nil)
    NotificationCenter.default.addObserver(
      self, selector: #selector(handleRouteChange(_:)),
      name: AVAudioSession.routeChangeNotification, object: nil)
  }

  // Phone calls and alarms: pause, then continue when they end.
  @objc private func handleInterruption(_ notification: Notification) {
    guard let raw = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
          let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
    DispatchQueue.main.async {
      if type == .began {
        if self.playing {
          self.pause()
          self.resumeAfterInterruption = true
        }
      } else if self.resumeAfterInterruption {
        self.resumeAfterInterruption = false
        self.resume()
      }
    }
  }

  // Headphones unplugged: pause instead of speaking out loud.
  @objc private func handleRouteChange(_ notification: Notification) {
    guard let raw = notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
          AVAudioSession.RouteChangeReason(rawValue: raw) == .oldDeviceUnavailable else { return }
    DispatchQueue.main.async { self.pause() }
  }

  private func updateNowPlaying() {
    guard !items.isEmpty else { return }
    var info: [String: Any] = [MPMediaItemPropertyTitle: title.isEmpty ? "Lectura en voz alta" : title]
    if lastPage > 0 {
      info[MPMediaItemPropertyArtist] = pageMode == "bible"
        ? (lastPage % 1000 > 0 ? "Capítulo \(lastPage / 1000) · versículo \(lastPage % 1000)" : "Capítulo \(lastPage / 1000)")
        : "Página \(lastPage)"
    }
    info[MPNowPlayingInfoPropertyPlaybackRate] = playing ? 1.0 : 0.0
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
  }
}
