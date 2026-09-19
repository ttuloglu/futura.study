import UIKit

public class NativeReaderViewController: UIViewController, UIPageViewControllerDataSource, UIPageViewControllerDelegate {
    public let bookTitle: String
    public let bookType: String
    public let pages: [BookPageData]
    public var onDismiss: ((Int) -> Void)?

    private var pageViewController: UIPageViewController!
    private var currentPageIndex: Int = 0
    private var currentTheme: ReaderTheme = .sepia
    private var fontScale: CGFloat = 1.0

    private var areControlsHidden: Bool = false
    private let topBarView = UIVisualEffectView(effect: UIBlurEffect(style: .systemMaterial))
    private let bottomBarView = UIVisualEffectView(effect: UIBlurEffect(style: .systemMaterial))

    private let closeButton = UIButton(type: .system)
    private let bookTitleLabel = UILabel()
    private let themeButton = UIButton(type: .system)
    private let fontDecreaseButton = UIButton(type: .system)
    private let fontIncreaseButton = UIButton(type: .system)

    private let pageSlider = UISlider()
    private let pageIndicatorLabel = UILabel()
    private let feedbackGenerator = UISelectionFeedbackGenerator()

    public init(
        title: String,
        bookType: String,
        pages: [BookPageData],
        initialPageIndex: Int = 0,
        initialTheme: String = "sepia"
    ) {
        self.bookTitle = title
        self.bookType = bookType
        self.pages = pages.isEmpty ? [BookPageData(pageNumber: 1, chapterTitle: "", title: title, contentHtml: "<p>İçerik yüklenemedi.</p>")] : pages
        self.currentPageIndex = min(max(0, initialPageIndex), self.pages.count - 1)
        self.currentTheme = ReaderTheme(rawValue: initialTheme) ?? .sepia
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    public override var preferredStatusBarStyle: UIStatusBarStyle {
        return currentTheme.statusBarStyle
    }

    public override var prefersStatusBarHidden: Bool {
        return areControlsHidden
    }

    public override var preferredStatusBarUpdateAnimation: UIStatusBarAnimation {
        return .fade
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

    private func setupPageViewController() {
        let options: [UIPageViewController.OptionsKey: Any] = [
            .spineLocation: UIPageViewController.SpineLocation.min.rawValue
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
        pageViewController.setViewControllers([initialVC], direction: .forward, animated: false, completion: nil)

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
        // Top bar
        topBarView.translatesAutoresizingMaskIntoConstraints = false
        topBarView.layer.cornerRadius = 18
        topBarView.clipsToBounds = true
        view.addSubview(topBarView)

        let topContent = topBarView.contentView

        closeButton.translatesAutoresizingMaskIntoConstraints = false
        closeButton.setTitle("✕", for: .normal)
        closeButton.titleLabel?.font = UIFont.systemFont(ofSize: 17, weight: .bold)
        closeButton.addTarget(self, action: #selector(handleClose), for: .touchUpInside)
        topContent.addSubview(closeButton)

        bookTitleLabel.translatesAutoresizingMaskIntoConstraints = false
        bookTitleLabel.text = bookTitle
        bookTitleLabel.textAlignment = .center
        bookTitleLabel.font = UIFont.systemFont(ofSize: 14, weight: .semibold)
        bookTitleLabel.lineBreakMode = .byTruncatingTail
        topContent.addSubview(bookTitleLabel)

        fontDecreaseButton.translatesAutoresizingMaskIntoConstraints = false
        fontDecreaseButton.setTitle("A-", for: .normal)
        fontDecreaseButton.titleLabel?.font = UIFont.systemFont(ofSize: 13, weight: .bold)
        fontDecreaseButton.addTarget(self, action: #selector(handleFontDecrease), for: .touchUpInside)
        topContent.addSubview(fontDecreaseButton)

        fontIncreaseButton.translatesAutoresizingMaskIntoConstraints = false
        fontIncreaseButton.setTitle("A+", for: .normal)
        fontIncreaseButton.titleLabel?.font = UIFont.systemFont(ofSize: 14, weight: .bold)
        fontIncreaseButton.addTarget(self, action: #selector(handleFontIncrease), for: .touchUpInside)
        topContent.addSubview(fontIncreaseButton)

        themeButton.translatesAutoresizingMaskIntoConstraints = false
        themeButton.setTitle("◐", for: .normal)
        themeButton.titleLabel?.font = UIFont.systemFont(ofSize: 17, weight: .regular)
        themeButton.addTarget(self, action: #selector(handleCycleTheme), for: .touchUpInside)
        topContent.addSubview(themeButton)

        // Bottom bar
        bottomBarView.translatesAutoresizingMaskIntoConstraints = false
        bottomBarView.layer.cornerRadius = 18
        bottomBarView.clipsToBounds = true
        view.addSubview(bottomBarView)

        let bottomContent = bottomBarView.contentView

        pageSlider.translatesAutoresizingMaskIntoConstraints = false
        pageSlider.minimumValue = 0
        pageSlider.maximumValue = Float(max(0, pages.count - 1))
        pageSlider.value = Float(currentPageIndex)
        pageSlider.addTarget(self, action: #selector(handleSliderChanged(_:)), for: .valueChanged)
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

            closeButton.leadingAnchor.constraint(equalTo: topContent.leadingAnchor, constant: 14),
            closeButton.centerYAnchor.constraint(equalTo: topContent.centerYAnchor),
            closeButton.widthAnchor.constraint(equalToConstant: 32),
            closeButton.heightAnchor.constraint(equalToConstant: 32),

            themeButton.trailingAnchor.constraint(equalTo: topContent.trailingAnchor, constant: -12),
            themeButton.centerYAnchor.constraint(equalTo: topContent.centerYAnchor),
            themeButton.widthAnchor.constraint(equalToConstant: 32),
            themeButton.heightAnchor.constraint(equalToConstant: 32),

            fontIncreaseButton.trailingAnchor.constraint(equalTo: themeButton.leadingAnchor, constant: -8),
            fontIncreaseButton.centerYAnchor.constraint(equalTo: topContent.centerYAnchor),
            fontIncreaseButton.widthAnchor.constraint(equalToConstant: 28),
            fontIncreaseButton.heightAnchor.constraint(equalToConstant: 32),

            fontDecreaseButton.trailingAnchor.constraint(equalTo: fontIncreaseButton.leadingAnchor, constant: -4),
            fontDecreaseButton.centerYAnchor.constraint(equalTo: topContent.centerYAnchor),
            fontDecreaseButton.widthAnchor.constraint(equalToConstant: 28),
            fontDecreaseButton.heightAnchor.constraint(equalToConstant: 32),

            bookTitleLabel.leadingAnchor.constraint(equalTo: closeButton.trailingAnchor, constant: 8),
            bookTitleLabel.trailingAnchor.constraint(equalTo: fontDecreaseButton.leadingAnchor, constant: -8),
            bookTitleLabel.centerYAnchor.constraint(equalTo: topContent.centerYAnchor),

            bottomBarView.bottomAnchor.constraint(equalTo: safeArea.bottomAnchor, constant: -10),
            bottomBarView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            bottomBarView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            bottomBarView.heightAnchor.constraint(equalToConstant: 68),

            pageSlider.topAnchor.constraint(equalTo: bottomContent.topAnchor, constant: 10),
            pageSlider.leadingAnchor.constraint(equalTo: bottomContent.leadingAnchor, constant: 16),
            pageSlider.trailingAnchor.constraint(equalTo: bottomContent.trailingAnchor, constant: -16),

            pageIndicatorLabel.topAnchor.constraint(equalTo: pageSlider.bottomAnchor, constant: 4),
            pageIndicatorLabel.leadingAnchor.constraint(equalTo: bottomContent.leadingAnchor, constant: 16),
            pageIndicatorLabel.trailingAnchor.constraint(equalTo: bottomContent.trailingAnchor, constant: -16)
        ])
    }

    private func setupGestureRecognizers() {
        let tapGesture = UITapGestureRecognizer(target: self, action: #selector(handleCenterTap(_:)))
        tapGesture.cancelsTouchesInView = false
        view.addGestureRecognizer(tapGesture)
    }

    @objc private func handleCenterTap(_ gesture: UITapGestureRecognizer) {
        let location = gesture.location(in: view)
        let centerRect = CGRect(
            x: view.bounds.width * 0.25,
            y: view.bounds.height * 0.20,
            width: view.bounds.width * 0.50,
            height: view.bounds.height * 0.60
        )

        if centerRect.contains(location) {
            toggleControls()
        }
    }

    private func toggleControls() {
        areControlsHidden.toggle()
        UIView.animate(withDuration: 0.24, delay: 0, options: [.curveEaseInOut, .allowUserInteraction]) {
            self.topBarView.alpha = self.areControlsHidden ? 0.0 : 1.0
            self.bottomBarView.alpha = self.areControlsHidden ? 0.0 : 1.0
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
        pageSlider.tintColor = tint
        pageIndicatorLabel.textColor = currentTheme.secondaryTextColor

        switch currentTheme {
        case .dark:
            topBarView.effect = UIBlurEffect(style: .systemUltraThinMaterialDark)
            bottomBarView.effect = UIBlurEffect(style: .systemUltraThinMaterialDark)
            themeButton.setTitle("☀️", for: .normal)
        case .sepia:
            topBarView.effect = UIBlurEffect(style: .systemUltraThinMaterialLight)
            bottomBarView.effect = UIBlurEffect(style: .systemUltraThinMaterialLight)
            themeButton.setTitle("🌙", for: .normal)
        case .light:
            topBarView.effect = UIBlurEffect(style: .systemUltraThinMaterialLight)
            bottomBarView.effect = UIBlurEffect(style: .systemUltraThinMaterialLight)
            themeButton.setTitle("📜", for: .normal)
        }

        setNeedsStatusBarAppearanceUpdate()
    }

    private func updatePageIndicator() {
        let total = pages.count
        let current = currentPageIndex + 1
        let percentage = total > 0 ? Int((Double(current) / Double(total)) * 100) : 0
        pageIndicatorLabel.text = "Sayfa \(current) / \(total) • %\(percentage)"
        pageSlider.value = Float(currentPageIndex)
    }

    @objc private func handleClose() {
        dismiss(animated: true) { [weak self] in
            guard let self = self else { return }
            self.onDismiss?(self.currentPageIndex)
        }
    }

    @objc private func handleCycleTheme() {
        feedbackGenerator.selectionChanged()
        switch currentTheme {
        case .sepia:
            currentTheme = .dark
        case .dark:
            currentTheme = .light
        case .light:
            currentTheme = .sepia
        }

        updateControlsTheme()
        if let visibleVC = pageViewController.viewControllers?.first as? BookPageViewController {
            visibleVC.currentTheme = currentTheme
        }
    }

    @objc private func handleFontDecrease() {
        if fontScale > 0.85 {
            feedbackGenerator.selectionChanged()
            fontScale = max(0.80, fontScale - 0.10)
            applyFontScaleToVisible()
        }
    }

    @objc private func handleFontIncrease() {
        if fontScale < 1.45 {
            feedbackGenerator.selectionChanged()
            fontScale = min(1.50, fontScale + 0.10)
            applyFontScaleToVisible()
        }
    }

    private func applyFontScaleToVisible() {
        if let visibleVC = pageViewController.viewControllers?.first as? BookPageViewController {
            visibleVC.fontScale = fontScale
        }
    }

    @objc private func handleSliderChanged(_ slider: UISlider) {
        let targetIndex = Int(round(slider.value))
        if targetIndex != currentPageIndex && targetIndex >= 0 && targetIndex < pages.count {
            let direction: UIPageViewController.NavigationDirection = targetIndex > currentPageIndex ? .forward : .reverse
            currentPageIndex = targetIndex
            feedbackGenerator.selectionChanged()
            let vc = createPageViewController(for: targetIndex)
            pageViewController.setViewControllers([vc], direction: direction, animated: true, completion: nil)
            updatePageIndicator()
        }
    }

    private func createPageViewController(for index: Int) -> BookPageViewController {
        let pageData = pages[index]
        return BookPageViewController(
            pageData: pageData,
            theme: currentTheme,
            fontScale: fontScale
        )
    }

    // MARK: - UIPageViewControllerDataSource
    public func pageViewController(_ pageViewController: UIPageViewController, viewControllerBefore viewController: UIViewController) -> UIViewController? {
        guard let pageVC = viewController as? BookPageViewController else { return nil }
        let currentIndex = pageVC.pageData.pageNumber - 1
        guard currentIndex > 0 else { return nil }
        return createPageViewController(for: currentIndex - 1)
    }

    public func pageViewController(_ pageViewController: UIPageViewController, viewControllerAfter viewController: UIViewController) -> UIViewController? {
        guard let pageVC = viewController as? BookPageViewController else { return nil }
        let currentIndex = pageVC.pageData.pageNumber - 1
        guard currentIndex < pages.count - 1 else { return nil }
        return createPageViewController(for: currentIndex + 1)
    }

    // MARK: - UIPageViewControllerDelegate
    public func pageViewController(
        _ pageViewController: UIPageViewController,
        didFinishAnimating finished: Bool,
        previousViewControllers: [UIViewController],
        transitionCompleted completed: Bool
    ) {
        if completed,
           let currentVC = pageViewController.viewControllers?.first as? BookPageViewController {
            currentPageIndex = currentVC.pageData.pageNumber - 1
            updatePageIndicator()
            feedbackGenerator.selectionChanged()
        }
    }
}
