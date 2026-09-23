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
        case .light:
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
    public var onDismiss: ((Int) -> Void)?

    private var pages: [BookPageData]
    private var pageViewController: UIPageViewController!
    private var currentPageIndex: Int = 0
    private var currentTheme: ReaderTheme = .sepia
    private var fontScale: CGFloat = 1.0
    private var lastPaginationSize: CGSize = .zero
    private var isRepaginating = false
    private var isProgrammaticTransition = false

    private var areControlsHidden = false
    private let topBarView = ReaderChromeView()
    private let bottomBarView = ReaderChromeView()

    private let closeButton = UIButton(type: .system)
    private let bookTitleLabel = UILabel()
    private let themeButton = UIButton(type: .system)
    private let fontDecreaseButton = UIButton(type: .system)
    private let fontIncreaseButton = UIButton(type: .system)
    private let pageSlider = UISlider()
    private let pageIndicatorLabel = UILabel()
    private let feedbackGenerator = UIImpactFeedbackGenerator(style: .light)

    public init(
        title: String,
        bookType: String,
        pages: [BookPageData],
        initialPageIndex: Int = 0,
        initialTheme: String = "sepia"
    ) {
        let fallback = BookPageData(
            pageNumber: 1,
            sourceIndex: 0,
            contentHtml: "<p>İçerik yüklenemedi.</p>"
        )
        let safePages = pages.isEmpty ? [fallback] : pages
        self.bookTitle = title
        self.bookType = bookType
        self.sourcePages = safePages
        self.pages = safePages
        self.currentPageIndex = min(max(0, initialPageIndex), safePages.count - 1)
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
        setupGestureRecognizers()
        updateControlsTheme()
        updatePageIndicator()
        feedbackGenerator.prepare()
    }

    public override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        let size = view.bounds.size
        guard size.width > 0, size.height > 0 else { return }
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

        configureButton(closeButton, title: "✕", fontSize: 17)
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

        configureButton(themeButton, title: "◐", fontSize: 17)
        themeButton.addTarget(self, action: #selector(handleCycleTheme), for: .touchDown)
        topContent.addSubview(themeButton)

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

        let safeArea = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            topBarView.topAnchor.constraint(equalTo: safeArea.topAnchor, constant: 8),
            topBarView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            topBarView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            topBarView.heightAnchor.constraint(equalToConstant: 48),

            closeButton.leadingAnchor.constraint(equalTo: topContent.leadingAnchor, constant: 10),
            closeButton.centerYAnchor.constraint(equalTo: topContent.centerYAnchor),
            closeButton.widthAnchor.constraint(equalToConstant: 40),
            closeButton.heightAnchor.constraint(equalToConstant: 40),

            themeButton.trailingAnchor.constraint(equalTo: topContent.trailingAnchor, constant: -8),
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
            pageSlider.leadingAnchor.constraint(equalTo: bottomContent.leadingAnchor, constant: 16),
            pageSlider.trailingAnchor.constraint(equalTo: bottomContent.trailingAnchor, constant: -16),

            pageIndicatorLabel.topAnchor.constraint(equalTo: pageSlider.bottomAnchor, constant: 3),
            pageIndicatorLabel.leadingAnchor.constraint(equalTo: bottomContent.leadingAnchor, constant: 16),
            pageIndicatorLabel.trailingAnchor.constraint(equalTo: bottomContent.trailingAnchor, constant: -16)
        ])
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

    private func toggleControls() {
        areControlsHidden.toggle()
        topBarView.isUserInteractionEnabled = !areControlsHidden
        bottomBarView.isUserInteractionEnabled = !areControlsHidden
        UIView.animate(withDuration: 0.18, delay: 0, options: [.curveEaseOut, .allowUserInteraction]) {
            self.topBarView.alpha = self.areControlsHidden ? 0 : 1
            self.bottomBarView.alpha = self.areControlsHidden ? 0 : 1
            self.setNeedsStatusBarAppearanceUpdate()
        }
    }

    private func updateControlsTheme() {
        view.backgroundColor = currentTheme.backgroundColor
        let tint = currentTheme.textColor
        closeButton.tintColor = tint
        bookTitleLabel.textColor = tint
        fontDecreaseButton.tintColor = tint
        fontIncreaseButton.tintColor = tint
        themeButton.tintColor = tint
        pageSlider.minimumTrackTintColor = tint.withAlphaComponent(0.72)
        pageSlider.maximumTrackTintColor = currentTheme.secondaryTextColor.withAlphaComponent(0.22)
        pageIndicatorLabel.textColor = currentTheme.secondaryTextColor
        topBarView.apply(theme: currentTheme)
        bottomBarView.apply(theme: currentTheme)

        switch currentTheme {
        case .dark: themeButton.setTitle("☀️", for: .normal)
        case .sepia: themeButton.setTitle("🌙", for: .normal)
        case .light: themeButton.setTitle("📜", for: .normal)
        }
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
    }

    private func repaginate(force: Bool) {
        guard !isRepaginating, view.bounds.width > 0, view.bounds.height > 0 else { return }
        let size = view.bounds.size
        if !force, size == lastPaginationSize { return }
        isRepaginating = true

        let anchor = (pageViewController.viewControllers?.first as? BookPageViewController)?.pageData
        let paginated = BookPagePaginator.paginate(
            sources: sourcePages,
            viewportSize: size,
            safeAreaInsets: view.safeAreaInsets,
            theme: currentTheme,
            fontScale: fontScale
        )
        pages = paginated
        lastPaginationSize = size

        if let anchor {
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

    @objc private func handleClose() {
        dismiss(animated: true) { [weak self] in
            guard let self else { return }
            self.onDismiss?(self.currentPageIndex)
        }
    }

    @objc private func handleCycleTheme() {
        switch currentTheme {
        case .sepia: currentTheme = .dark
        case .dark: currentTheme = .light
        case .light: currentTheme = .sepia
        }
        updateControlsTheme()
        repaginate(force: true)
    }

    @objc private func handleFontDecrease() {
        guard fontScale > 0.80 else { return }
        fontScale = max(0.80, fontScale - 0.10)
        repaginate(force: true)
    }

    @objc private func handleFontIncrease() {
        guard fontScale < 1.50 else { return }
        fontScale = min(1.50, fontScale + 0.10)
        repaginate(force: true)
    }

    @objc private func handleSliderReleased(_ slider: UISlider) {
        navigate(to: Int(round(slider.value)))
    }

    private func navigate(to targetIndex: Int) {
        guard !isProgrammaticTransition,
              targetIndex >= 0,
              targetIndex < pages.count,
              targetIndex != currentPageIndex else {
            pageSlider.value = Float(currentPageIndex)
            return
        }

        let direction: UIPageViewController.NavigationDirection = targetIndex > currentPageIndex ? .forward : .reverse
        let targetVC = createPageViewController(for: targetIndex)
        isProgrammaticTransition = true
        pageViewController.setViewControllers([targetVC], direction: direction, animated: true) { [weak self] completed in
            guard let self else { return }
            self.isProgrammaticTransition = false
            if completed {
                self.currentPageIndex = targetIndex
                self.updatePageIndicator()
                self.feedbackGenerator.impactOccurred(intensity: 0.55)
                self.feedbackGenerator.prepare()
            }
        }
    }

    private func createPageViewController(for index: Int) -> BookPageViewController {
        let safeIndex = min(max(0, index), pages.count - 1)
        return BookPageViewController(
            pageData: pages[safeIndex],
            theme: currentTheme,
            fontScale: fontScale
        )
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
        guard completed,
              let currentVC = pageViewController.viewControllers?.first as? BookPageViewController else { return }
        currentPageIndex = currentVC.pageData.pageNumber - 1
        updatePageIndicator()
        feedbackGenerator.impactOccurred(intensity: 0.55)
        feedbackGenerator.prepare()
    }
}
