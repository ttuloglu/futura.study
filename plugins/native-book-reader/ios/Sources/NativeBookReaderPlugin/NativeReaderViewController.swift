import UIKit

private final class ReaderChromeView: UIView {
    let contentView = UIView()
    private let blurView = UIVisualEffectView()

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        layer.cornerRadius = 18
        layer.cornerCurve = .continuous
        layer.masksToBounds = true
        layer.borderWidth = 0.5

        blurView.translatesAutoresizingMaskIntoConstraints = false
        blurView.isUserInteractionEnabled = false
        blurView.alpha = 0.68
        addSubview(blurView)

        contentView.translatesAutoresizingMaskIntoConstraints = false
        contentView.backgroundColor = .clear
        addSubview(contentView)

        NSLayoutConstraint.activate([
            blurView.topAnchor.constraint(equalTo: topAnchor),
            blurView.leadingAnchor.constraint(equalTo: leadingAnchor),
            blurView.trailingAnchor.constraint(equalTo: trailingAnchor),
            blurView.bottomAnchor.constraint(equalTo: bottomAnchor),
            contentView.topAnchor.constraint(equalTo: topAnchor),
            contentView.leadingAnchor.constraint(equalTo: leadingAnchor),
            contentView.trailingAnchor.constraint(equalTo: trailingAnchor),
            contentView.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    func apply(theme: ReaderTheme) {
        switch theme {
        case .dark:
            blurView.effect = UIBlurEffect(style: .systemUltraThinMaterialDark)
            contentView.backgroundColor = UIColor.black.withAlphaComponent(0.06)
            layer.borderColor = UIColor.white.withAlphaComponent(0.10).cgColor
        case .sepia:
            blurView.effect = UIBlurEffect(style: .systemUltraThinMaterialLight)
            contentView.backgroundColor = UIColor(red: 0.72, green: 0.58, blue: 0.40, alpha: 0.025)
            layer.borderColor = UIColor.black.withAlphaComponent(0.055).cgColor
        case .light, .pink, .blue:
            blurView.effect = UIBlurEffect(style: .systemUltraThinMaterialLight)
            contentView.backgroundColor = UIColor.white.withAlphaComponent(0.025)
            layer.borderColor = UIColor.black.withAlphaComponent(0.05).cgColor
        }
    }
}

public class NativeReaderViewController: UIViewController,
    UIPageViewControllerDataSource,
    UIPageViewControllerDelegate,
    UIGestureRecognizerDelegate {

    public let bookTitle: String
    public let bookType: String
    public let sourcePages: [BookPageData]
    public var onPosition: (([String: Any]) -> Void)?
    private var initialSourceIndex: Int?
    private var initialContentOffset: Int
    private var progressTimer: Timer?
    private var foregroundObserver: NSObjectProtocol?
    private var readerVisible = false
    private var sourceWeights: [Int] = []
    public var onDismiss: ((Int) -> Void)?

    private var pages: [BookPageData]
    private var pageViewController: UIPageViewController!
    private var currentPageIndex: Int = 0
    private var initialRenderedPageIndex: Int?
    private var currentTheme: ReaderTheme = .sepia
    private var fontScale: CGFloat = 1.0
    private var lastPaginationSize: CGSize = .zero
    private var isRepaginating = false
    private var isProgrammaticTransition = false

    private var areControlsHidden = false
    private let topBarView = ReaderChromeView()
    private let bottomBarView = ReaderChromeView()

    private let closeButton = UIButton(type: .custom)
    private let bookTitleLabel = UILabel()
    private let themeButton = UIButton(type: .system)
    private let downloadButton = UIButton(type: .system)
    private let fontDecreaseButton = UIButton(type: .system)
    private let fontIncreaseButton = UIButton(type: .system)
    private let pageSlider = UISlider()
    private let pageIndicatorLabel = UILabel()
    private let feedbackGenerator = UIImpactFeedbackGenerator(style: .light)
    public var companionInitiallyHidden = false
    public var companionLabels: [String: String] = [:]
    public var companionAvatar = "dost"
    public var companionLegendary = false
    public var companionIsHidden: Bool { companion?.characterHidden ?? companionInitiallyHidden }
    private var companion: ReaderCompanionView?
    private let listenButton = UIButton(type: .system)
    private let musicButton = UIButton(type: .system)
    private let narration: ReaderNarrationPlayer
    private let startListening: Bool
    private var narrationEnabled = false
    private var narrationPageIndex: Int?
    private var narrationAdvance: DispatchWorkItem?
    private var isUserTransition = false
    private var imagePreviewOpen = false
    private var isClosing = false
    private var previousIdleTimerDisabled: Bool?
    private var backgroundObserver: NSObjectProtocol?
    private var didAttemptAutoPlay = false
    public private(set) var closeAction = "close"
    public var themeValue: String { currentTheme.rawValue }
    public var fontScaleValue: Double { Double(fontScale) }
    private var isFairyTale: Bool { bookType == "fairy_tale" || bookType == "fairy-tale" }


    public init(
        title: String,
        bookType: String,
        pages: [BookPageData],
        initialPageIndex: Int = 0,
        initialTheme: String = "sepia",
        autoPlay: Bool = false,
        backgroundAudioSrc: String? = nil,
        initialFontScale: Double = 1,
        initialSourceIndex: Int? = nil,
        initialContentOffset: Int = 0
    ) {
        let fallback = BookPageData(
            pageNumber: 1,
            sourceIndex: 0,
            contentHtml: "<p>İçerik yüklenemedi.</p>"
        )
        let safePages = pages.isEmpty ? [fallback] : pages
        self.narration = ReaderNarrationPlayer(backgroundSource: backgroundAudioSrc)
        self.startListening = autoPlay
        self.bookTitle = title
        self.bookType = bookType
        self.sourcePages = safePages
        self.pages = safePages
        self.currentPageIndex = min(max(0, initialPageIndex), safePages.count - 1)
        self.initialSourceIndex = initialSourceIndex
        self.initialContentOffset = initialContentOffset
        self.initialRenderedPageIndex = max(0, initialPageIndex)
        self.fontScale = CGFloat(min(1.5, max(0.8, initialFontScale)))
        self.currentTheme = ReaderTheme(rawValue: initialTheme) ?? .sepia
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    public override var preferredStatusBarStyle: UIStatusBarStyle {
        currentTheme.statusBarStyle
    }

    public override var prefersStatusBarHidden: Bool {
        areControlsHidden
    }

    public override var preferredStatusBarUpdateAnimation: UIStatusBarAnimation {
        .fade
    }

    public override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = currentTheme.backgroundColor
        setupPageViewController()
        setupOverlayControls()
        if let file = Bundle.main.url(forResource: "fortale-companion-reader", withExtension: "html", subdirectory: "public") {
            let friend = ReaderCompanionView(file: file, hidden: companionInitiallyHidden, labels: companionLabels, avatar: companionAvatar, legendary: companionLegendary)
            view.addSubview(friend)
            friend.onStatistics = { [weak self] in self?.closeReader(action: "readingStats") }
            friend.onChangeAvatar = { [weak self] in self?.closeReader(action: "changeAvatar") }
            companion = friend
        }
        setupGestureRecognizers()
        updateControlsTheme()
        updatePageIndicator()
        feedbackGenerator.prepare()
        sourceWeights = sourcePages.map { max(1, BookPagePaginator.makeAttributedContent(from: $0, theme: currentTheme, fontScale: fontScale).length) }
        progressTimer = Timer.scheduledTimer(withTimeInterval: 4, repeats: true) { [weak self] _ in self?.reportPosition() }
        foregroundObserver = NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in self?.reportPosition() }
        backgroundObserver = NotificationCenter.default.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in
            self?.reportPosition(active: false); self?.pauseNarration()
        }
        if isFairyTale {
            narration.onState = { [weak self] state in self?.updateListenControl(state: state) }
            narration.onEnded = { [weak self] in self?.scheduleNarrationAdvance() }
            narration.onFailure = { [weak self] in
                guard let self, !self.isClosing else { return }
                self.pauseNarration()
                let alert = UIAlertController(title: "Ses yüklenemedi", message: "Sayfayı değiştirmeden yeniden deneyebilirsin.", preferredStyle: .alert)
                alert.addAction(UIAlertAction(title: "Tamam", style: .default))
                self.present(alert, animated: true)
            }
            narration.onInterrupted = { [weak self] in self?.pauseNarration() }

        }
    }

    deinit {
        narrationAdvance?.cancel()
        progressTimer?.invalidate()
        if let observer = foregroundObserver { NotificationCenter.default.removeObserver(observer) }
        if let observer = backgroundObserver { NotificationCenter.default.removeObserver(observer) }
    }

    public override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        readerVisible = true
        reportPosition()
        if isFairyTale && startListening && !didAttemptAutoPlay {
            didAttemptAutoPlay = true
            narrationEnabled = true
            playCurrentNarration()
        }
    }

    public override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        let size = view.bounds.size
        guard size.width > 0, size.height > 0 else { return }
        companion?.dock(in: CGRect(x: bottomBarView.frame.minX + 4, y: bottomBarView.frame.minY + 6, width: 50, height: 56))
        if abs(size.width - lastPaginationSize.width) > 1 ||
            abs(size.height - lastPaginationSize.height) > 1 {
            repaginate(force: true)
        }
    }

    private func setupPageViewController() {
        let options: [UIPageViewController.OptionsKey: Any] = [
            .spineLocation: UIPageViewController.SpineLocation.min.rawValue,
            .interPageSpacing: 0
        ]
        pageViewController = UIPageViewController(
            transitionStyle: .pageCurl,
            navigationOrientation: .horizontal,
            options: options
        )
        pageViewController.dataSource = self
        pageViewController.delegate = self
        pageViewController.isDoubleSided = false

        let initialVC = createPageViewController(for: currentPageIndex)
        pageViewController.setViewControllers([initialVC], direction: .forward, animated: false)

        addChild(pageViewController)
        pageViewController.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(pageViewController.view)
        pageViewController.didMove(toParent: self)

        NSLayoutConstraint.activate([
            pageViewController.view.topAnchor.constraint(equalTo: view.topAnchor),
            pageViewController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            pageViewController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            pageViewController.view.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }

    private func setupOverlayControls() {
        topBarView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(topBarView)
        let topContent = topBarView.contentView

        configureButton(closeButton, title: "", fontSize: 17)
        closeButton.setImage(Self.dialogCloseIcon(), for: .normal)
        closeButton.backgroundColor = .white
        closeButton.layer.cornerRadius = 18
        closeButton.layer.borderWidth = 0.5
        closeButton.layer.borderColor = UIColor.white.cgColor
        closeButton.layer.shadowColor = UIColor.black.cgColor
        closeButton.layer.shadowOpacity = 0.18
        closeButton.layer.shadowRadius = 5
        closeButton.layer.shadowOffset = CGSize(width: 0, height: 2)
        closeButton.accessibilityLabel = companionLabels["cancel"] ?? "Kapat"
        closeButton.addTarget(self, action: #selector(handleClose), for: .touchDown)
        topContent.addSubview(closeButton)

        bookTitleLabel.translatesAutoresizingMaskIntoConstraints = false
        bookTitleLabel.text = bookTitle
        bookTitleLabel.textAlignment = .center
        bookTitleLabel.font = UIFont.systemFont(ofSize: 14, weight: .semibold)
        bookTitleLabel.lineBreakMode = .byTruncatingTail
        topContent.addSubview(bookTitleLabel)

        configureButton(fontDecreaseButton, title: "A-", fontSize: 13)
        fontDecreaseButton.addTarget(self, action: #selector(handleFontDecrease), for: .touchDown)
        topContent.addSubview(fontDecreaseButton)

        configureButton(fontIncreaseButton, title: "A+", fontSize: 14)
        fontIncreaseButton.addTarget(self, action: #selector(handleFontIncrease), for: .touchDown)
        topContent.addSubview(fontIncreaseButton)

        configureButton(themeButton, title: "", fontSize: 17)
        themeButton.setImage(UIImage(systemName: "paintpalette"), for: .normal)
        themeButton.setPreferredSymbolConfiguration(UIImage.SymbolConfiguration(pointSize: 18, weight: .regular), forImageIn: .normal)
        themeButton.accessibilityLabel = "Okuyucu zemini"
        themeButton.showsMenuAsPrimaryAction = true
        topContent.addSubview(themeButton)
        do {
            downloadButton.translatesAutoresizingMaskIntoConstraints = false
            downloadButton.addTarget(self, action: #selector(handleControlFeedback), for: .touchDown)
            downloadButton.setImage(UIImage(systemName: "square.and.arrow.down"), for: .normal)
            downloadButton.setPreferredSymbolConfiguration(UIImage.SymbolConfiguration(pointSize: 18, weight: .regular), forImageIn: .normal)
            downloadButton.imageView?.contentMode = .scaleAspectFit
            themeButton.imageView?.contentMode = .scaleAspectFit
            downloadButton.accessibilityLabel = "İndir"
            downloadButton.showsMenuAsPrimaryAction = true
            downloadButton.menu = UIMenu(children: [
                UIAction(title: "PDF indir") { [weak self] _ in self?.handleControlFeedback(); self?.closeReader(action: "downloadPDF") },
                UIAction(title: "EPUB indir") { [weak self] _ in self?.handleControlFeedback(); self?.closeReader(action: "downloadEPUB") }
            ])
            topContent.addSubview(downloadButton)
            NSLayoutConstraint.activate([
                downloadButton.trailingAnchor.constraint(equalTo: topContent.trailingAnchor, constant: -8),
                downloadButton.centerYAnchor.constraint(equalTo: topContent.centerYAnchor),
                downloadButton.widthAnchor.constraint(equalToConstant: 40),
                downloadButton.heightAnchor.constraint(equalToConstant: 40)
            ])
        }

        bottomBarView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(bottomBarView)
        let bottomContent = bottomBarView.contentView

        pageSlider.translatesAutoresizingMaskIntoConstraints = false
        pageSlider.minimumValue = 0
        pageSlider.maximumValue = Float(max(0, pages.count - 1))
        pageSlider.value = Float(currentPageIndex)
        pageSlider.isContinuous = true
        pageSlider.addTarget(self, action: #selector(handleSliderReleased(_:)), for: [.touchUpInside, .touchUpOutside, .touchCancel])
        bottomContent.addSubview(pageSlider)

        pageIndicatorLabel.translatesAutoresizingMaskIntoConstraints = false
        pageIndicatorLabel.textAlignment = .center
        pageIndicatorLabel.font = UIFont.monospacedDigitSystemFont(ofSize: 12, weight: .medium)
        bottomContent.addSubview(pageIndicatorLabel)
        if isFairyTale {
            for button in [listenButton, musicButton] {
                button.translatesAutoresizingMaskIntoConstraints = false
                bottomContent.addSubview(button)
            }
            listenButton.addTarget(self, action: #selector(handleListen), for: .touchUpInside)
            musicButton.addTarget(self, action: #selector(handleMusic), for: .touchUpInside)
            listenButton.addTarget(self, action: #selector(handleControlFeedback), for: .touchDown)
            musicButton.addTarget(self, action: #selector(handleControlFeedback), for: .touchDown)
            musicButton.setImage(UIImage(systemName: "speaker.wave.2.fill"), for: .normal)
            musicButton.accessibilityLabel = "Fon müziğini kapat"
            updateListenControl(state: "idle")
            NSLayoutConstraint.activate([
                listenButton.leadingAnchor.constraint(equalTo: bottomContent.leadingAnchor, constant: 54),
                listenButton.bottomAnchor.constraint(equalTo: bottomContent.bottomAnchor, constant: -2),
                listenButton.widthAnchor.constraint(equalToConstant: 42),
                listenButton.heightAnchor.constraint(equalToConstant: 36),
                musicButton.trailingAnchor.constraint(equalTo: bottomContent.trailingAnchor, constant: -6),
                musicButton.bottomAnchor.constraint(equalTo: bottomContent.bottomAnchor, constant: -2),
                musicButton.widthAnchor.constraint(equalToConstant: 42),
                musicButton.heightAnchor.constraint(equalToConstant: 36)
            ])
        }

        let safeArea = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            topBarView.topAnchor.constraint(equalTo: safeArea.topAnchor, constant: 8),
            topBarView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            topBarView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            topBarView.heightAnchor.constraint(equalToConstant: 48),

            closeButton.leadingAnchor.constraint(equalTo: topContent.leadingAnchor, constant: 10),
            closeButton.centerYAnchor.constraint(equalTo: topContent.centerYAnchor),
            closeButton.widthAnchor.constraint(equalToConstant: 36),
            closeButton.heightAnchor.constraint(equalToConstant: 36),

            themeButton.trailingAnchor.constraint(equalTo: downloadButton.leadingAnchor, constant: -2),
            themeButton.centerYAnchor.constraint(equalTo: topContent.centerYAnchor),
            themeButton.widthAnchor.constraint(equalToConstant: 40),
            themeButton.heightAnchor.constraint(equalToConstant: 40),

            fontIncreaseButton.trailingAnchor.constraint(equalTo: themeButton.leadingAnchor, constant: -2),
            fontIncreaseButton.centerYAnchor.constraint(equalTo: topContent.centerYAnchor),
            fontIncreaseButton.widthAnchor.constraint(equalToConstant: 40),
            fontIncreaseButton.heightAnchor.constraint(equalToConstant: 40),

            fontDecreaseButton.trailingAnchor.constraint(equalTo: fontIncreaseButton.leadingAnchor, constant: -2),
            fontDecreaseButton.centerYAnchor.constraint(equalTo: topContent.centerYAnchor),
            fontDecreaseButton.widthAnchor.constraint(equalToConstant: 40),
            fontDecreaseButton.heightAnchor.constraint(equalToConstant: 40),

            bookTitleLabel.leadingAnchor.constraint(equalTo: closeButton.trailingAnchor, constant: 6),
            bookTitleLabel.trailingAnchor.constraint(equalTo: fontDecreaseButton.leadingAnchor, constant: -6),
            bookTitleLabel.centerYAnchor.constraint(equalTo: topContent.centerYAnchor),

            bottomBarView.bottomAnchor.constraint(equalTo: safeArea.bottomAnchor, constant: -10),
            bottomBarView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            bottomBarView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            bottomBarView.heightAnchor.constraint(equalToConstant: 68),

            pageSlider.topAnchor.constraint(equalTo: bottomContent.topAnchor, constant: 8),
            pageSlider.leadingAnchor.constraint(equalTo: bottomContent.leadingAnchor, constant: 64),
            pageSlider.trailingAnchor.constraint(equalTo: bottomContent.trailingAnchor, constant: -16),

            pageIndicatorLabel.topAnchor.constraint(equalTo: pageSlider.bottomAnchor, constant: 3),
            pageIndicatorLabel.leadingAnchor.constraint(equalTo: bottomContent.leadingAnchor, constant: isFairyTale ? 92 : 64),
            pageIndicatorLabel.trailingAnchor.constraint(equalTo: bottomContent.trailingAnchor, constant: isFairyTale ? -48 : -16)
        ])
    }

    // Match the 19-point, two-point rounded cross used by DialogCloseButton on the web.
    private static func dialogCloseIcon() -> UIImage {
        UIGraphicsImageRenderer(size: CGSize(width: 19, height: 19)).image { renderer in
            let context = renderer.cgContext
            context.setStrokeColor(UIColor.black.cgColor)
            context.setLineWidth(2)
            context.setLineCap(.round)
            context.move(to: CGPoint(x: 14.25, y: 4.75))
            context.addLine(to: CGPoint(x: 4.75, y: 14.25))
            context.move(to: CGPoint(x: 4.75, y: 4.75))
            context.addLine(to: CGPoint(x: 14.25, y: 14.25))
            context.strokePath()
        }.withRenderingMode(.alwaysTemplate)
    }

    private func configureButton(_ button: UIButton, title: String, fontSize: CGFloat) {
        button.translatesAutoresizingMaskIntoConstraints = false
        button.setTitle(title, for: .normal)
        button.titleLabel?.font = UIFont.systemFont(ofSize: fontSize, weight: .bold)
        button.addTarget(self, action: #selector(handleButtonPressDown(_:)), for: .touchDown)
        button.addTarget(self, action: #selector(handleButtonPressEnd(_:)), for: [.touchUpInside, .touchUpOutside, .touchCancel, .touchDragExit])
    }

    private func setupGestureRecognizers() {
        let tapGesture = UITapGestureRecognizer(target: self, action: #selector(handlePageTap(_:)))
        tapGesture.cancelsTouchesInView = false
        tapGesture.delaysTouchesBegan = false
        tapGesture.delegate = self
        view.addGestureRecognizer(tapGesture)
    }

    public func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
        guard let touchedView = touch.view else { return true }
        if let companion = companion, touchedView.isDescendant(of: companion) { return false }
        var ancestor: UIView? = touchedView
        while let node = ancestor {
            if let image = node as? UIImageView, image.isUserInteractionEnabled { return false }
            if let text = node as? UITextView, text.isScrollEnabled { return false }
            ancestor = node.superview
        }
        return !touchedView.isDescendant(of: topBarView) && !touchedView.isDescendant(of: bottomBarView)
    }

    @objc private func handlePageTap(_ gesture: UITapGestureRecognizer) {
        let location = gesture.location(in: view)
        let relativeX = location.x / max(view.bounds.width, 1)
        if relativeX < 0.24 {
            navigate(to: currentPageIndex - 1)
        } else if relativeX > 0.76 {
            navigate(to: currentPageIndex + 1)
        } else {
            toggleControls()
        }
    }

    @objc private func handleButtonPressDown(_ sender: UIButton) {
        feedbackGenerator.impactOccurred(intensity: 0.72)
        feedbackGenerator.prepare()
        UIView.animate(withDuration: 0.06, delay: 0, options: [.beginFromCurrentState, .allowUserInteraction]) {
            sender.transform = CGAffineTransform(scaleX: 0.86, y: 0.86)
            sender.alpha = 0.62
        }
    }

    @objc private func handleButtonPressEnd(_ sender: UIButton) {
        UIView.animate(withDuration: 0.10, delay: 0, options: [.beginFromCurrentState, .allowUserInteraction]) {
            sender.transform = .identity
            sender.alpha = 1
        }
    }

    @objc private func handleControlFeedback() {
        feedbackGenerator.impactOccurred(intensity: 0.72)
        feedbackGenerator.prepare()
    }

    private func toggleControls() {
        areControlsHidden.toggle()
        topBarView.isUserInteractionEnabled = !areControlsHidden
        bottomBarView.isUserInteractionEnabled = !areControlsHidden
        companion?.isUserInteractionEnabled = !areControlsHidden
        UIView.animate(withDuration: 0.18, delay: 0, options: [.curveEaseOut, .allowUserInteraction]) {
            self.topBarView.alpha = self.areControlsHidden ? 0 : 1
            self.bottomBarView.alpha = self.areControlsHidden ? 0 : 1
            self.companion?.alpha = self.areControlsHidden ? 0 : 1
            self.setNeedsStatusBarAppearanceUpdate()
        }
    }

    private func updateControlsTheme() {
        view.backgroundColor = currentTheme.backgroundColor
        let tint = currentTheme.textColor
        closeButton.tintColor = UIColor(white: 23 / 255, alpha: 1)
        bookTitleLabel.textColor = tint
        fontDecreaseButton.tintColor = tint
        fontIncreaseButton.tintColor = tint
        themeButton.tintColor = tint
        downloadButton.tintColor = tint
        listenButton.tintColor = tint
        musicButton.tintColor = tint
        pageSlider.minimumTrackTintColor = tint.withAlphaComponent(0.72)
        pageSlider.maximumTrackTintColor = currentTheme.secondaryTextColor.withAlphaComponent(0.22)
        pageIndicatorLabel.textColor = currentTheme.secondaryTextColor
        topBarView.apply(theme: currentTheme)
        bottomBarView.apply(theme: currentTheme)

        updateThemeMenu()
        setNeedsStatusBarAppearanceUpdate()
    }

    private func updatePageIndicator() {
        let total = pages.count
        let current = min(currentPageIndex + 1, max(total, 1))
        let percentage = total <= 1
            ? 100
            : Int(round((Double(currentPageIndex) / Double(total - 1)) * 100))
        pageIndicatorLabel.text = "Sayfa \(current) / \(total) • %\(percentage)"
        pageSlider.maximumValue = Float(max(0, total - 1))
        pageSlider.value = Float(currentPageIndex)
        pageSlider.isEnabled = total > 1
        reportPosition()
    }

    private func repaginate(force: Bool) {
        guard !isRepaginating, !isProgrammaticTransition, !isUserTransition, view.bounds.width > 0, view.bounds.height > 0 else { return }
        let size = view.bounds.size
        if !force, size == lastPaginationSize { return }
        isRepaginating = true

        let anchor = (pageViewController.viewControllers?.first as? BookPageViewController)?.pageData
        let paginated = isFairyTale ? sourcePages : BookPagePaginator.paginate(
            sources: sourcePages,
            viewportSize: size,
            safeAreaInsets: view.safeAreaInsets,
            theme: currentTheme,
            fontScale: fontScale
        )
        pages = paginated
        lastPaginationSize = size

        if let source = initialSourceIndex {
            currentPageIndex = pages.lastIndex(where: { $0.sourceIndex == source && $0.contentStartOffset <= initialContentOffset }) ?? 0
            initialSourceIndex = nil; initialRenderedPageIndex = nil
        } else if let requestedIndex = initialRenderedPageIndex {
            currentPageIndex = min(requestedIndex, pages.count - 1)
            initialRenderedPageIndex = nil
        } else if let anchor {
            currentPageIndex = pages.lastIndex(where: {
                $0.sourceIndex == anchor.sourceIndex &&
                $0.contentStartOffset <= anchor.contentStartOffset
            }) ?? min(currentPageIndex, pages.count - 1)
        } else {
            currentPageIndex = min(currentPageIndex, pages.count - 1)
        }

        let currentVC = createPageViewController(for: currentPageIndex)
        pageViewController.setViewControllers([currentVC], direction: .forward, animated: false)
        updatePageIndicator()
        isRepaginating = false
    }

    private func reportPosition(active: Bool? = nil) {
        guard readerVisible, !isClosing, !pages.isEmpty, !sourceWeights.isEmpty else { return }
        let page = pages[min(currentPageIndex, pages.count - 1)]
        let source = min(max(0, page.sourceIndex), sourceWeights.count - 1)
        let before = sourceWeights.prefix(source).reduce(0, +)
        let total = max(1, sourceWeights.reduce(0, +))
        let next = currentPageIndex + 1 < pages.count ? pages[currentPageIndex + 1] : nil
        let end = next?.sourceIndex == source ? next!.contentStartOffset : sourceWeights[source]
        onPosition?([
            "sourceIndex": source, "contentStartOffset": page.contentStartOffset,
            "pageIndex": currentPageIndex, "pageCount": pages.count,
            "rangeStart": Double(before + page.contentStartOffset) / Double(total),
            "rangeEnd": Double(before + end) / Double(total),
            "isLast": currentPageIndex == pages.count - 1,
            "theme": currentTheme.rawValue, "fontScale": Double(fontScale),
            "active": active ?? (UIApplication.shared.applicationState == .active && !imagePreviewOpen)
        ])
    }

    @objc private func handleClose() { closeReader() }

    public func closeReader(action: String = "close", completion: (() -> Void)? = nil) {
        guard !isClosing else { completion?(); return }
        reportPosition(active: false)
        readerVisible = false
        progressTimer?.invalidate()
        isClosing = true
        closeAction = action
        pauseNarration()
        narration.stop(deactivate: isFairyTale)
        companion?.stopGame()
        dismiss(animated: true) { [weak self] in
            if let self { self.onDismiss?(self.currentPageIndex) }
            completion?()
        }
    }

    private func updateThemeMenu() {
        let themes: [(ReaderTheme, String)] = [(.sepia, "Sepya"), (.light, "Açık"), (.dark, "Koyu"), (.pink, "Pembe"), (.blue, "Açık mavi")]
        themeButton.accessibilityValue = themes.first(where: { $0.0 == currentTheme })?.1
        themeButton.menu = UIMenu(title: "Okuyucu zemini", children: themes.map { theme, title in
            let swatch = UIGraphicsImageRenderer(size: CGSize(width: 28, height: 28)).image { context in
                let circle = CGRect(x: 3, y: 3, width: 22, height: 22)
                theme.backgroundColor.setFill()
                context.cgContext.fillEllipse(in: circle)
                UIColor.gray.withAlphaComponent(0.5).setStroke()
                context.cgContext.strokeEllipse(in: circle)
            }.withRenderingMode(.alwaysOriginal)
            return UIAction(title: title, image: swatch, state: theme == currentTheme ? .on : .off) { [weak self] _ in
                guard let self, !self.isProgrammaticTransition, !self.isUserTransition, !self.isClosing else { return }
                self.currentTheme = theme
                self.updateControlsTheme()
                self.repaginate(force: true)
            }
        })
    }

    @objc private func handleFontDecrease() {
        guard !isProgrammaticTransition, !isUserTransition, fontScale > 0.80 else { return }
        fontScale = max(0.80, fontScale - 0.10)
        repaginate(force: true)
    }

    @objc private func handleFontIncrease() {
        guard !isProgrammaticTransition, !isUserTransition, fontScale < 1.50 else { return }
        fontScale = min(1.50, fontScale + 0.10)
        repaginate(force: true)
    }

    @objc private func handleSliderReleased(_ slider: UISlider) {
        navigate(to: Int(round(slider.value)))
    }

    private func navigate(to targetIndex: Int) {
        guard !isProgrammaticTransition, !isUserTransition, !isClosing,
              targetIndex >= 0,
              targetIndex < pages.count,
              targetIndex != currentPageIndex else {
            pageSlider.value = Float(currentPageIndex)
            return
        }

        narrationAdvance?.cancel()
        narrationAdvance = nil
        narration.pause()
        let direction: UIPageViewController.NavigationDirection = targetIndex > currentPageIndex ? .forward : .reverse
        let targetVC = createPageViewController(for: targetIndex)
        isProgrammaticTransition = true
        pageViewController.view.isUserInteractionEnabled = false
        pageViewController.setViewControllers([targetVC], direction: direction, animated: true) { [weak self] completed in
            guard let self else { return }
            self.isProgrammaticTransition = false
            self.pageViewController.view.isUserInteractionEnabled = true
            guard !self.isClosing else { return }
            if completed {
                self.currentPageIndex = targetIndex
                self.updatePageIndicator()
                self.feedbackGenerator.impactOccurred(intensity: 0.55)
                self.feedbackGenerator.prepare()
                if self.narrationEnabled { self.playCurrentNarration() }
            } else if self.narrationEnabled { self.resumeCurrentNarration() }
        }
    }

    private func createPageViewController(for index: Int) -> BookPageViewController {
        let safeIndex = min(max(0, index), pages.count - 1)
        let controller = BookPageViewController(
            pageData: pages[safeIndex],
            theme: currentTheme,
            fontScale: fontScale,
            preserveNarratedPage: isFairyTale
        )
        controller.onImagePreview = { [weak self] image, title in self?.showImagePreview(image, title: title) }
        return controller
    }

    private func showImagePreview(_ image: UIImage, title: String) {
        guard !isClosing, !isUserTransition, !isProgrammaticTransition, presentedViewController == nil else { return }
        let resumeListening = narrationEnabled
        pauseNarration()
        reportPosition(active: false)
        imagePreviewOpen = true
        let preview = ReaderImagePreviewController(image: image, title: title,
            closeLabel: companionLabels["cancel"] ?? "Close", shareLabel: companionLabels["share"] ?? "Share")
        preview.onClose = { [weak self] in
            guard let self else { return }
            self.imagePreviewOpen = false
            self.reportPosition()
            if resumeListening, !self.isClosing, UIApplication.shared.applicationState == .active {
                self.narrationEnabled = true
                self.resumeCurrentNarration()
            }
        }
        present(preview, animated: true)
    }

    public func pageViewController(_ pageViewController: UIPageViewController, willTransitionTo pendingViewControllers: [UIViewController]) {
        isUserTransition = true
        narrationAdvance?.cancel(); narrationAdvance = nil
        narration.pause()
    }

    public func pageViewController(
        _ pageViewController: UIPageViewController,
        viewControllerBefore viewController: UIViewController
    ) -> UIViewController? {
        guard let pageVC = viewController as? BookPageViewController else { return nil }
        let index = pageVC.pageData.pageNumber - 1
        guard index > 0 else { return nil }
        return createPageViewController(for: index - 1)
    }

    public func pageViewController(
        _ pageViewController: UIPageViewController,
        viewControllerAfter viewController: UIViewController
    ) -> UIViewController? {
        guard let pageVC = viewController as? BookPageViewController else { return nil }
        let index = pageVC.pageData.pageNumber - 1
        guard index < pages.count - 1 else { return nil }
        return createPageViewController(for: index + 1)
    }

    public func pageViewController(
        _ pageViewController: UIPageViewController,
        didFinishAnimating finished: Bool,
        previousViewControllers: [UIViewController],
        transitionCompleted completed: Bool
    ) {
        isUserTransition = false
        guard !isClosing else { return }
        guard completed else {
            if narrationEnabled { resumeCurrentNarration() }
            return
        }
        guard let currentVC = pageViewController.viewControllers?.first as? BookPageViewController else { return }
        currentPageIndex = currentVC.pageData.pageNumber - 1
        if narrationEnabled { playCurrentNarration() }
        updatePageIndicator()
        feedbackGenerator.impactOccurred(intensity: 0.55)
        feedbackGenerator.prepare()
    }
    private func setScreenAwake(_ awake: Bool) {
        if awake {
            if previousIdleTimerDisabled == nil { previousIdleTimerDisabled = UIApplication.shared.isIdleTimerDisabled }
            UIApplication.shared.isIdleTimerDisabled = true
        } else if let previous = previousIdleTimerDisabled {
            UIApplication.shared.isIdleTimerDisabled = previous
            previousIdleTimerDisabled = nil
        }
    }

    private func updateListenControl(state: String) {
        listenButton.setImage(UIImage(systemName: narrationEnabled ? "pause.fill" : "play.fill"), for: .normal)
        listenButton.accessibilityLabel = narrationEnabled ? "Sesli okumayı duraklat" : "Dinle"
        listenButton.accessibilityValue = state == "loading" ? "Ses yükleniyor" : nil
    }

    @objc private func handleMusic() {
        narration.musicEnabled.toggle()
        musicButton.setImage(UIImage(systemName: narration.musicEnabled ? "speaker.wave.2.fill" : "speaker.slash.fill"), for: .normal)
        musicButton.accessibilityLabel = narration.musicEnabled ? "Fon müziğini kapat" : "Fon müziğini aç"
    }

    @objc private func handleListen() {
        guard !isProgrammaticTransition, !isUserTransition, !isClosing else { return }
        if narrationEnabled { pauseNarration(); return }
        narrationEnabled = true
        setScreenAwake(true)
        resumeCurrentNarration()
    }

    private func pauseNarration() {
        narrationEnabled = false
        narrationAdvance?.cancel(); narrationAdvance = nil
        narration.pause(deactivate: isFairyTale)
        setScreenAwake(false)
        updateListenControl(state: "paused")
    }

    private func resumeCurrentNarration() {
        if narrationPageIndex != currentPageIndex { playCurrentNarration() }
        else if narration.atEnd && currentPageIndex < pages.count - 1 { scheduleNarrationAdvance() }
        else if narration.canResume { narration.resume() }
        else { playCurrentNarration() }
    }

    private func playCurrentNarration() {
        guard narrationEnabled, !isClosing else { return }
        setScreenAwake(true)
        narration.stop(deactivate: false)
        narrationPageIndex = nil
        guard let source = pages[currentPageIndex].audioSrc, !source.isEmpty else {
            pauseNarration()
            let alert = UIAlertController(title: "Seslendirme hazır değil", message: "Bu masalın sesli sürümünü hazırlayabilirsin.", preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "İptal", style: .cancel))
            alert.addAction(UIAlertAction(title: "Sesli sürümü hazırla", style: .default) { [weak self] _ in self?.closeReader(action: "prepareNarration") })
            present(alert, animated: true)
            return
        }
        narrationPageIndex = currentPageIndex
        narration.play(source)
        if currentPageIndex + 1 < pages.count { narration.prefetch(pages[currentPageIndex + 1].audioSrc) }
    }

    private func scheduleNarrationAdvance() {
        guard narrationEnabled, !isClosing else { return }
        narrationAdvance?.cancel()
        guard currentPageIndex < pages.count - 1 else {
            pauseNarration(); narration.stop(); return
        }
        let expectedPage = currentPageIndex
        let task = DispatchWorkItem { [weak self] in
            guard let self, self.narrationEnabled, !self.isClosing,
                  !self.isUserTransition, self.currentPageIndex == expectedPage else { return }
            self.narrationAdvance = nil
            self.navigate(to: expectedPage + 1)
        }
        narrationAdvance = task
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45, execute: task)
    }

}
