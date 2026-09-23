import UIKit

public enum ReaderTheme: String {
    case sepia
    case light
    case dark

    public var backgroundColor: UIColor {
        switch self {
        case .sepia:
            return UIColor(red: 0.97, green: 0.94, blue: 0.89, alpha: 1.00) // Warm paper
        case .light:
            return UIColor(red: 0.99, green: 0.99, blue: 0.99, alpha: 1.00)
        case .dark:
            return UIColor(red: 0.09, green: 0.10, blue: 0.12, alpha: 1.00) // OLED Dark
        }
    }

    public var textColor: UIColor {
        switch self {
        case .sepia:
            return UIColor(red: 0.24, green: 0.18, blue: 0.13, alpha: 1.00)
        case .light:
            return UIColor(red: 0.12, green: 0.12, blue: 0.14, alpha: 1.00)
        case .dark:
            return UIColor(red: 0.91, green: 0.92, blue: 0.94, alpha: 1.00)
        }
    }

    public var secondaryTextColor: UIColor {
        switch self {
        case .sepia:
            return UIColor(red: 0.52, green: 0.44, blue: 0.36, alpha: 1.00)
        case .light:
            return UIColor(red: 0.45, green: 0.47, blue: 0.52, alpha: 1.00)
        case .dark:
            return UIColor(red: 0.60, green: 0.62, blue: 0.67, alpha: 1.00)
        }
    }

    public var borderToneColor: UIColor {
        switch self {
        case .sepia:
            return UIColor(red: 0.86, green: 0.80, blue: 0.72, alpha: 0.6)
        case .light:
            return UIColor(white: 0.0, alpha: 0.08)
        case .dark:
            return UIColor(white: 1.0, alpha: 0.12)
        }
    }

    public var statusBarStyle: UIStatusBarStyle {
        switch self {
        case .sepia, .light:
            if #available(iOS 13.0, *) {
                return .darkContent
            }
            return .default
        case .dark:
            return .lightContent
        }
    }
}

public struct BookPageData {
    public let pageNumber: Int
    public let sourceIndex: Int
    public let contentStartOffset: Int
    public let chapterTitle: String?
    public let title: String?
    public let contentHtml: String
    public let plainText: String?
    public let imageSrc: String?
    public let imageAlt: String?
    public let attributedContent: NSAttributedString?

    public init(
        pageNumber: Int,
        sourceIndex: Int = 0,
        contentStartOffset: Int = 0,
        chapterTitle: String? = nil,
        title: String? = nil,
        contentHtml: String,
        plainText: String? = nil,
        imageSrc: String? = nil,
        imageAlt: String? = nil,
        attributedContent: NSAttributedString? = nil
    ) {
        self.pageNumber = pageNumber
        self.sourceIndex = sourceIndex
        self.contentStartOffset = contentStartOffset
        self.chapterTitle = chapterTitle
        self.title = title
        self.contentHtml = contentHtml
        self.plainText = plainText
        self.imageSrc = imageSrc
        self.imageAlt = imageAlt
        self.attributedContent = attributedContent
    }
}
