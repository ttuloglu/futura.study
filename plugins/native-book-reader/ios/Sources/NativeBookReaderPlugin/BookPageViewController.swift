import UIKit

private let imageMemoryCache = NSCache<NSString, UIImage>()

public class BookPageViewController: UIViewController {
    public let pageData: BookPageData
    public var currentTheme: ReaderTheme {
        didSet {
            applyTheme()
        }
    }
    public var fontScale: CGFloat = 1.0 {
        didSet {
            applyContent()
        }
    }

    private let scrollView = UIScrollView()
    private let contentView = UIView()
    private let chapterLabel = UILabel()
    private let titleLabel = UILabel()
    private let bodyTextView = UITextView()
    private let imageView = UIImageView()
    private let pageNumberLabel = UILabel()
    private var imageTask: URLSessionDataTask?
    private var imageAspectRatioConstraint: NSLayoutConstraint?
    private var imageHeightConstraint: NSLayoutConstraint?

    public init(pageData: BookPageData, theme: ReaderTheme, fontScale: CGFloat) {
        self.pageData = pageData
        self.currentTheme = theme
        self.fontScale = fontScale
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    public override func viewDidLoad() {
        super.viewDidLoad()
        setupViews()
        applyTheme()
        applyContent()
    }

    deinit {
        imageTask?.cancel()
    }

    private func setupViews() {
        view.backgroundColor = currentTheme.backgroundColor

        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.alwaysBounceVertical = false
        scrollView.showsVerticalScrollIndicator = false
        scrollView.showsHorizontalScrollIndicator = false
        view.addSubview(scrollView)

        contentView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(contentView)

        chapterLabel.translatesAutoresizingMaskIntoConstraints = false
        chapterLabel.textAlignment = .center
        chapterLabel.numberOfLines = 2
        chapterLabel.font = UIFont.systemFont(ofSize: 11, weight: .bold)
        contentView.addSubview(chapterLabel)

        imageView.translatesAutoresizingMaskIntoConstraints = false
        imageView.contentMode = .scaleAspectFill
        imageView.clipsToBounds = true
        imageView.layer.cornerRadius = 14
        imageView.layer.borderWidth = 1.0
        imageView.isHidden = true
        contentView.addSubview(imageView)

        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.numberOfLines = 0
        titleLabel.textAlignment = .left
        contentView.addSubview(titleLabel)

        bodyTextView.translatesAutoresizingMaskIntoConstraints = false
        bodyTextView.isEditable = false
        bodyTextView.isSelectable = true
        bodyTextView.isScrollEnabled = false
        bodyTextView.textContainerInset = .zero
        bodyTextView.textContainer.lineFragmentPadding = 0
        bodyTextView.backgroundColor = .clear
        contentView.addSubview(bodyTextView)

        pageNumberLabel.translatesAutoresizingMaskIntoConstraints = false
        pageNumberLabel.textAlignment = .center
        pageNumberLabel.font = UIFont.monospacedDigitSystemFont(ofSize: 11, weight: .medium)
        contentView.addSubview(pageNumberLabel)

        let safeArea = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: safeArea.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: safeArea.bottomAnchor),

            contentView.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
            contentView.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor),
            contentView.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor),
            contentView.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor),
            contentView.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor),

            chapterLabel.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 16),
            chapterLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 28),
            chapterLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -28),

            imageView.topAnchor.constraint(equalTo: chapterLabel.bottomAnchor, constant: 14),
            imageView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 28),
            imageView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -28),

            titleLabel.topAnchor.constraint(equalTo: imageView.bottomAnchor, constant: 16),
            titleLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 28),
            titleLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -28),

            bodyTextView.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 12),
            bodyTextView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 28),
            bodyTextView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -28),

            pageNumberLabel.topAnchor.constraint(equalTo: bodyTextView.bottomAnchor, constant: 24),
            pageNumberLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 28),
            pageNumberLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -28),
            pageNumberLabel.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -20)
        ])

        imageHeightConstraint = imageView.heightAnchor.constraint(equalToConstant: 0)
        imageHeightConstraint?.isActive = true
    }

    public func applyTheme() {
        view.backgroundColor = currentTheme.backgroundColor
        contentView.backgroundColor = currentTheme.backgroundColor
        scrollView.backgroundColor = currentTheme.backgroundColor

        chapterLabel.textColor = currentTheme.secondaryTextColor
        titleLabel.textColor = currentTheme.textColor
        bodyTextView.textColor = currentTheme.textColor
        pageNumberLabel.textColor = currentTheme.secondaryTextColor
        imageView.layer.borderColor = currentTheme.borderToneColor.cgColor

        // Reapply attributed text with new colors
        applyContent()
    }

    public func applyContent() {
        // Chapter Header
        if let chapter = pageData.chapterTitle, !chapter.isEmpty {
            chapterLabel.text = chapter.uppercased()
            chapterLabel.isHidden = false
        } else {
            chapterLabel.text = nil
            chapterLabel.isHidden = true
        }

        // Title
        let baseTitleFont: UIFont
        if let customSerif = UIFont(name: "NewYork-Bold", size: 21 * fontScale) ?? UIFont(name: "Georgia-Bold", size: 21 * fontScale) {
            baseTitleFont = customSerif
        } else {
            baseTitleFont = UIFont.systemFont(ofSize: 21 * fontScale, weight: .bold)
        }

        if let title = pageData.title, !title.isEmpty {
            titleLabel.font = baseTitleFont
            titleLabel.text = title
            titleLabel.isHidden = false
        } else {
            titleLabel.text = nil
            titleLabel.isHidden = true
        }

        // Page Number
        pageNumberLabel.text = "\(pageData.pageNumber)"

        // Body Text
        let rawHtml = pageData.contentHtml.trimmingCharacters(in: .whitespacesAndNewlines)
        if !rawHtml.isEmpty {
            let styledHtml = formatHtmlForReader(
                html: rawHtml,
                theme: currentTheme,
                scale: fontScale
            )
            if let data = styledHtml.data(using: .utf8),
               let attributed = try? NSMutableAttributedString(
                data: data,
                options: [
                    .documentType: NSAttributedString.DocumentType.html,
                    .characterEncoding: String.Encoding.utf8.rawValue
                ],
                documentAttributes: nil
               ) {
                bodyTextView.attributedText = attributed
            } else {
                bodyTextView.font = UIFont(name: "Georgia", size: 16 * fontScale) ?? UIFont.systemFont(ofSize: 16 * fontScale)
                bodyTextView.text = pageData.plainText ?? rawHtml
            }
        } else if let plain = pageData.plainText, !plain.isEmpty {
            let paragraphStyle = NSMutableParagraphStyle()
            paragraphStyle.lineSpacing = 6 * fontScale
            paragraphStyle.paragraphSpacing = 14 * fontScale

            let font = UIFont(name: "Georgia", size: 16 * fontScale) ?? UIFont.systemFont(ofSize: 16 * fontScale)
            let attr = NSAttributedString(string: plain, attributes: [
                .font: font,
                .foregroundColor: currentTheme.textColor,
                .paragraphStyle: paragraphStyle
            ])
            bodyTextView.attributedText = attr
        } else {
            bodyTextView.attributedText = nil
        }

        // Image
        loadImageIfNeeded()
    }

    private func loadImageIfNeeded() {
        guard let src = pageData.imageSrc, let url = URL(string: src) else {
            imageView.isHidden = true
            imageHeightConstraint?.constant = 0
            return
        }

        imageView.isHidden = false
        if let cached = imageMemoryCache.object(forKey: src as NSString) {
            imageView.image = cached
            adjustImageHeight(image: cached)
            return
        }

        imageHeightConstraint?.constant = 180
        imageTask?.cancel()
        imageTask = URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
            guard let self = self, let data = data, let image = UIImage(data: data) else { return }
            imageMemoryCache.setObject(image, forKey: src as NSString)
            DispatchQueue.main.async {
                self.imageView.image = image
                self.adjustImageHeight(image: image)
            }
        }
        imageTask?.resume()
    }

    private func adjustImageHeight(image: UIImage) {
        let maxWidth = view.bounds.width > 0 ? (view.bounds.width - 56) : 320
        let ratio = image.size.height / max(image.size.width, 1)
        let computedHeight = min(maxWidth * ratio, 280)
        imageHeightConstraint?.constant = max(computedHeight, 140)
        view.layoutIfNeeded()
    }

    private func formatHtmlForReader(html: String, theme: ReaderTheme, scale: CGFloat) -> String {
        let baseFontSize = Int(16.5 * scale)
        let lineHeight = 1.62
        let textColorHex = theme == .dark ? "#E3E5E8" : (theme == .sepia ? "#382D22" : "#1A1A1A")
        let linkColorHex = theme == .dark ? "#88B4FF" : (theme == .sepia ? "#8A5424" : "#1D64D8")

        return """
        <!DOCTYPE html>
        <html>
        <head>
        <meta charset="utf-8">
        <style>
            body {
                font-family: -apple-system-ui-serif, 'New York', Georgia, 'Times New Roman', serif;
                font-size: \(baseFontSize)px;
                line-height: \(lineHeight);
                color: \(textColorHex);
                margin: 0;
                padding: 0;
                background-color: transparent;
                text-rendering: optimizeLegibility;
                -webkit-font-smoothing: antialiased;
            }
            p {
                margin-top: 0;
                margin-bottom: 0.95em;
                text-align: justify;
                text-justify: inter-word;
            }
            p:first-of-type::first-letter {
                font-size: 1.15em;
                font-weight: bold;
            }
            h1, h2, h3, h4, h5, h6 {
                font-family: -apple-system, system-ui, sans-serif;
                font-weight: 700;
                line-height: 1.25;
                margin-top: 1.2em;
                margin-bottom: 0.5em;
            }
            h2 { font-size: \(Int(CGFloat(baseFontSize) * 1.22))px; }
            h3 { font-size: \(Int(CGFloat(baseFontSize) * 1.10))px; }
            blockquote {
                margin: 1em 0;
                padding-left: 14px;
                border-left: 3px solid rgba(130, 100, 70, 0.35);
                font-style: italic;
            }
            ul, ol {
                padding-left: 20px;
                margin-bottom: 0.8em;
            }
            li {
                margin-bottom: 0.35em;
            }
            a {
                color: \(linkColorHex);
                text-decoration: none;
            }
            strong, b {
                font-weight: 700;
            }
            code {
                font-family: Menlo, monospace;
                font-size: 0.9em;
                background: rgba(128, 128, 128, 0.12);
                padding: 2px 4px;
                border-radius: 4px;
            }
        </style>
        </head>
        <body>
        \(html)
        </body>
        </html>
        """
    }
}
