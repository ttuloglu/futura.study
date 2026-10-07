import UIKit

private let imageMemoryCache = NSCache<NSString, UIImage>()

public class BookPageViewController: UIViewController {
    public let pageData: BookPageData
    public var currentTheme: ReaderTheme {
        didSet { applyTheme() }
    }
    public var fontScale: CGFloat = 1.0
    var onImagePreview: ((UIImage, String) -> Void)?
    private var imageLoaded = false
    private let preserveNarratedPage: Bool

    private let contentStack = UIStackView()
    private let chapterLabel = UILabel()
    private let titleLabel = UILabel()
    private let bodyTextView = UITextView()
    private let imageView = UIImageView()
    private let imageActivityIndicator = UIActivityIndicatorView(style: .medium)
    private var imageTask: URLSessionDataTask?
    private var imageHeightConstraint: NSLayoutConstraint?

    public init(pageData: BookPageData, theme: ReaderTheme, fontScale: CGFloat, preserveNarratedPage: Bool = false) {
        self.pageData = pageData
        self.currentTheme = theme
        self.fontScale = fontScale
        self.preserveNarratedPage = preserveNarratedPage
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    public override func viewDidLoad() {
        super.viewDidLoad()
        setupViews()
        applyContent()
        applyTheme()
    }

    deinit {
        imageTask?.cancel()
    }

    public override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        guard preserveNarratedPage else { return }
        let available = max(120, view.bounds.height - view.safeAreaInsets.top - view.safeAreaInsets.bottom - BookPageLayout.contentTopInset - BookPageLayout.contentBottomInset)
        let width = BookPageLayout.textWidth(for: view.bounds.width)
        let ratio = imageView.image.map { $0.size.height / max(1, $0.size.width) } ?? (2.0 / 3.0)
        imageHeightConstraint?.constant = min(width * ratio, min(view.bounds.width >= 700 ? 480 : 320, available * 0.44))
    }

    private func setupViews() {
        view.backgroundColor = currentTheme.backgroundColor

        contentStack.translatesAutoresizingMaskIntoConstraints = false
        contentStack.axis = .vertical
        contentStack.alignment = .fill
        contentStack.distribution = .fill
        contentStack.spacing = BookPageLayout.elementSpacing
        view.addSubview(contentStack)

        chapterLabel.textAlignment = .center
        chapterLabel.numberOfLines = 2
        chapterLabel.font = UIFont.systemFont(ofSize: 11, weight: .bold)
        chapterLabel.setContentCompressionResistancePriority(.required, for: .vertical)
        contentStack.addArrangedSubview(chapterLabel)

        imageView.translatesAutoresizingMaskIntoConstraints = false
        imageView.contentMode = .scaleAspectFit
        imageView.clipsToBounds = true
        imageView.isAccessibilityElement = true
        imageView.isUserInteractionEnabled = true
        imageView.accessibilityTraits = .button
        imageView.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(previewImage)))
        contentStack.addArrangedSubview(imageView)

        imageActivityIndicator.translatesAutoresizingMaskIntoConstraints = false
        imageView.addSubview(imageActivityIndicator)
        NSLayoutConstraint.activate([
            imageActivityIndicator.centerXAnchor.constraint(equalTo: imageView.centerXAnchor),
            imageActivityIndicator.centerYAnchor.constraint(equalTo: imageView.centerYAnchor)
        ])

        titleLabel.numberOfLines = preserveNarratedPage ? 2 : 0
        titleLabel.textAlignment = .left
        titleLabel.setContentCompressionResistancePriority(.required, for: .vertical)
        contentStack.addArrangedSubview(titleLabel)

        bodyTextView.isEditable = false
        bodyTextView.isSelectable = false
        bodyTextView.isScrollEnabled = preserveNarratedPage
        bodyTextView.isUserInteractionEnabled = preserveNarratedPage
        bodyTextView.textContainerInset = .zero
        bodyTextView.textContainer.lineFragmentPadding = 0
        bodyTextView.backgroundColor = .clear
        bodyTextView.setContentCompressionResistancePriority(preserveNarratedPage ? .defaultLow : .required, for: .vertical)
        contentStack.addArrangedSubview(bodyTextView)

        let safeArea = view.safeAreaLayoutGuide
        let preferredWidth = contentStack.widthAnchor.constraint(equalTo: view.widthAnchor, constant: -BookPageLayout.horizontalInset * 2)
        preferredWidth.priority = .defaultHigh
        NSLayoutConstraint.activate([
            preferredWidth,
            contentStack.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            contentStack.widthAnchor.constraint(lessThanOrEqualToConstant: BookPageLayout.maximumTextWidth),
            contentStack.topAnchor.constraint(
                equalTo: safeArea.topAnchor,
                constant: BookPageLayout.contentTopInset
            ),
            contentStack.leadingAnchor.constraint(
                greaterThanOrEqualTo: view.leadingAnchor,
                constant: BookPageLayout.horizontalInset
            ),
            contentStack.trailingAnchor.constraint(
                lessThanOrEqualTo: view.trailingAnchor,
                constant: -BookPageLayout.horizontalInset
            ),
            contentStack.bottomAnchor.constraint(
                lessThanOrEqualTo: safeArea.bottomAnchor,
                constant: -BookPageLayout.contentBottomInset
            )
        ])
        if preserveNarratedPage {
            contentStack.bottomAnchor.constraint(equalTo: safeArea.bottomAnchor, constant: -BookPageLayout.contentBottomInset).isActive = true
        }
    }

    private func applyContent() {
        if let chapter = pageData.chapterTitle, !chapter.isEmpty {
            chapterLabel.text = chapter.uppercased()
            chapterLabel.isHidden = false
        } else {
            chapterLabel.text = nil
            chapterLabel.isHidden = true
        }

        if let title = pageData.title, !title.isEmpty {
            titleLabel.font = BookPagePaginator.titleFont(scale: fontScale)
            titleLabel.text = title
            titleLabel.isHidden = false
        } else {
            titleLabel.text = nil
            titleLabel.isHidden = true
        }

        let attributed = BookPagePaginator.makeAttributedContent(
            from: pageData,
            theme: currentTheme,
            fontScale: fontScale
        )
        bodyTextView.attributedText = attributed
        bodyTextView.isHidden = attributed.length == 0

        configureImage()
    }

    public func applyTheme() {
        view.backgroundColor = currentTheme.backgroundColor
        chapterLabel.textColor = currentTheme.secondaryTextColor
        titleLabel.textColor = currentTheme.textColor
        bodyTextView.textColor = currentTheme.textColor
        imageView.backgroundColor = .clear
        imageView.tintColor = currentTheme.secondaryTextColor.withAlphaComponent(0.55)
        imageActivityIndicator.color = currentTheme.secondaryTextColor
    }

    private func configureImage() {
        imageLoaded = false
        guard let source = pageData.imageSrc?.trimmingCharacters(in: .whitespacesAndNewlines),
              !source.isEmpty else {
            imageView.isHidden = true
            imageHeightConstraint?.isActive = false
            imageHeightConstraint = nil
            return
        }

        imageView.isHidden = false
        imageView.accessibilityLabel = pageData.imageAlt ?? "İçerik görseli"
        imageHeightConstraint?.isActive = false
        imageHeightConstraint = imageView.heightAnchor.constraint(
            equalToConstant: BookPageLayout.imageHeight(
                for: BookPageLayout.textWidth(for: view.bounds.width)
            )
        )
        imageHeightConstraint?.isActive = true
        loadImage(source: source)
    }

    private func loadImage(source: String) {
        imageTask?.cancel()
        imageView.image = nil

        if let cached = imageMemoryCache.object(forKey: source as NSString) {
            showImage(cached, source: source)
            return
        }

        if let localImage = loadSynchronousImage(source: source) {
            showImage(localImage, source: source)
            return
        }

        guard let url = encodedURL(from: source),
              url.scheme == "http" || url.scheme == "https" else {
            showImageFailure()
            return
        }

        imageActivityIndicator.startAnimating()
        var request = URLRequest(url: url)
        request.cachePolicy = .returnCacheDataElseLoad
        request.timeoutInterval = 20
        imageTask = URLSession.shared.dataTask(with: request) { [weak self] data, response, _ in
            guard let self else { return }
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 200
            guard (200..<300).contains(statusCode),
                  let data,
                  let image = UIImage(data: data) else {
                DispatchQueue.main.async { self.showImageFailure() }
                return
            }
            imageMemoryCache.setObject(image, forKey: source as NSString)
            DispatchQueue.main.async { self.showImage(image, source: source) }
        }
        imageTask?.resume()
    }

    private func loadSynchronousImage(source: String) -> UIImage? {
        if source.lowercased().hasPrefix("data:image"),
           let comma = source.firstIndex(of: ",") {
            let metadata = String(source[..<comma])
            let payload = String(source[source.index(after: comma)...])
            let data = metadata.contains(";base64")
                ? Data(base64Encoded: payload, options: .ignoreUnknownCharacters)
                : payload.removingPercentEncoding?.data(using: .utf8)
            return data.flatMap(UIImage.init(data:))
        }

        guard let url = encodedURL(from: source) else {
            return UIImage(contentsOfFile: source)
        }
        if url.isFileURL {
            return UIImage(contentsOfFile: url.path)
        }

        if let markerRange = url.path.range(of: "/_capacitor_file_") {
            let filePath = String(url.path[markerRange.upperBound...]).removingPercentEncoding ?? ""
            let absolutePath = filePath.hasPrefix("/") ? filePath : "/\(filePath)"
            return UIImage(contentsOfFile: absolutePath)
        }

        if url.scheme == nil || url.host == "localhost" {
            let path = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            if let file = Bundle.main.resourceURL?.appendingPathComponent("public").appendingPathComponent(path) {
                return UIImage(contentsOfFile: file.path)
            }
        }

        return nil
    }

    private func encodedURL(from source: String) -> URL? {
        if let url = URL(string: source) { return url }
        return URL(string: source.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")
    }

    private func showImage(_ image: UIImage, source: String) {
        imageLoaded = true
        imageActivityIndicator.stopAnimating()
        imageView.contentMode = .scaleAspectFit
        imageView.image = image
        if preserveNarratedPage { view.setNeedsLayout() }
        imageMemoryCache.setObject(image, forKey: source as NSString)
    }

    private func showImageFailure() {
        imageLoaded = false
        imageActivityIndicator.stopAnimating()
        imageView.contentMode = .center
        imageView.image = UIImage(systemName: "photo")
    }

    @objc private func previewImage() {
        guard imageLoaded, let image = imageView.image else { return }
        onImagePreview?(image, pageData.imageAlt ?? pageData.title ?? "Fortale")
    }
}
