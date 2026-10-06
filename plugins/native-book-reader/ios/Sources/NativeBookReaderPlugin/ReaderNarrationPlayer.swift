import AVFoundation

// Owns only playback. Existing book/audio generation remains in the app.
final class ReaderNarrationPlayer {
    let player = AVPlayer()
    private let music = AVQueuePlayer()
    private var musicLooper: AVPlayerLooper?
    private var assets: [String: AVURLAsset] = [:]
    private var itemObservation: NSKeyValueObservation?
    private var playbackObservation: NSKeyValueObservation?
    private var notifications: [NSObjectProtocol] = []
    private var wantsPlayback = false
    private var run = 0
    private var source: String?
    private(set) var atEnd = false
    var musicEnabled = true { didSet { updateMusic() } }
    var onState: ((String) -> Void)?
    var onEnded: (() -> Void)?
    var onFailure: (() -> Void)?
    var onInterrupted: (() -> Void)?

    init(backgroundSource: String?) {
        player.automaticallyWaitsToMinimizeStalling = true
        if let source = backgroundSource, let url = Self.mediaURL(source) {
            musicLooper = AVPlayerLooper(player: music, templateItem: AVPlayerItem(url: url))
            music.volume = 0.12
        }
        playbackObservation = player.observe(\.timeControlStatus, options: [.new]) { [weak self] _, _ in
            DispatchQueue.main.async { [weak self] in
                guard let self, self.wantsPlayback else { return }
                self.onState?(self.player.timeControlStatus == .playing ? "playing" : "loading")
            }
        }
        notifications.append(NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification, object: nil, queue: .main
        ) { [weak self] event in
            let type = event.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt
            if type == AVAudioSession.InterruptionType.began.rawValue { self?.onInterrupted?() }
        })
    }

    deinit {
        player.pause(); music.pause()
        notifications.forEach(NotificationCenter.default.removeObserver)
    }

    static func mediaURL(_ source: String) -> URL? {
        if let url = URL(string: source) {
            if url.isFileURL { return url }
            if let marker = url.path.range(of: "/_capacitor_file_") {
                let path = String(url.path[marker.upperBound...]).removingPercentEncoding ?? ""
                return URL(fileURLWithPath: path.hasPrefix("/") ? path : "/\(path)")
            }
            if (url.scheme == "http" || url.scheme == "https") && url.host != "localhost" { return url }
            if url.host == "localhost" || url.scheme == nil {
                let path = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
                return Bundle.main.resourceURL?.appendingPathComponent("public").appendingPathComponent(path)
            }
        }
        return nil
    }

    func prefetch(_ source: String?) {
        guard let source, assets[source] == nil, let url = Self.mediaURL(source) else { return }
        let asset = AVURLAsset(url: url)
        assets[source] = asset
        asset.loadValuesAsynchronously(forKeys: ["playable"]) {}
    }

    func play(_ source: String) {
        stop(deactivate: false)
        guard let url = Self.mediaURL(source) else { onFailure?(); return }
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
        } catch { onFailure?(); return }
        self.source = source
        atEnd = false
        wantsPlayback = true
        let expected = run
        let item = AVPlayerItem(asset: assets[source] ?? AVURLAsset(url: url))
        onState?("loading")
        itemObservation = item.observe(\.status, options: [.initial, .new]) { [weak self] item, _ in
            DispatchQueue.main.async { [weak self] in
                guard let self, self.run == expected else { return }
                if item.status == .failed { self.fail(); return }
                if item.status == .readyToPlay, self.wantsPlayback {
                    self.player.play(); self.updateMusic()
                }
            }
        }
        notifications.append(NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: .main
        ) { [weak self] _ in
            guard let self, self.run == expected else { return }
            self.atEnd = true
            guard self.wantsPlayback else { return }
            self.wantsPlayback = false
            self.music.pause()
            self.onEnded?()
        })
        notifications.append(NotificationCenter.default.addObserver(
            forName: .AVPlayerItemFailedToPlayToEndTime, object: item, queue: .main
        ) { [weak self] _ in
            guard let self, self.run == expected else { return }
            self.fail()
        })
        player.replaceCurrentItem(with: item)
    }

    func pause(deactivate: Bool = false) {
        wantsPlayback = false
        player.pause(); music.pause()
        if deactivate { try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation) }
        onState?("paused")
    }

    func resume() {
        guard player.currentItem != nil, !atEnd else { return }
        do { try AVAudioSession.sharedInstance().setActive(true) }
        catch { fail(); return }
        wantsPlayback = true
        player.play(); updateMusic()
        onState?(player.timeControlStatus == .playing ? "playing" : "loading")
    }

    func stop(deactivate: Bool = true) {
        run += 1
        wantsPlayback = false
        player.pause(); music.pause()
        itemObservation = nil
        // Keep the interruption observer; remove the two per-item observers.
        while notifications.count > 1 { NotificationCenter.default.removeObserver(notifications.removeLast()) }
        player.replaceCurrentItem(with: nil)
        source = nil; atEnd = false
        if deactivate { try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation) }
    }

    var canResume: Bool { player.currentItem != nil && !atEnd }

    private func updateMusic() {
        if wantsPlayback && musicEnabled { music.play() } else { music.pause() }
    }

    private func fail() {
        stop()
        onFailure?()
    }
}
