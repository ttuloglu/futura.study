import UIKit

enum BookPageLayout {
    static let horizontalInset: CGFloat = 28
    static let maximumTextWidth: CGFloat = 740
    static let contentTopInset: CGFloat = 64
    static let contentBottomInset: CGFloat = 92
    static let elementSpacing: CGFloat = 8

    static func textWidth(for viewportWidth: CGFloat) -> CGFloat {
        min(maximumTextWidth, max(120, viewportWidth - horizontalInset * 2))
    }

    static func imageHeight(for textWidth: CGFloat) -> CGFloat {
        min(max(textWidth * 0.58, 150), textWidth >= 640 ? 360 : 230)
    }
}

enum BookPagePaginator {
    static func paginate(
        sources: [BookPageData],
        viewportSize: CGSize,
        safeAreaInsets: UIEdgeInsets,
        theme: ReaderTheme,
        fontScale: CGFloat
    ) -> [BookPageData] {
        let textWidth = BookPageLayout.textWidth(for: viewportSize.width)
        let pageHeight = max(
            180,
            viewportSize.height
                - safeAreaInsets.top
                - safeAreaInsets.bottom
                - BookPageLayout.contentTopInset
                - BookPageLayout.contentBottomInset
        )

        var output: [BookPageData] = []

        for (fallbackIndex, source) in sources.enumerated() {
            let sourceIndex = source.sourceIndex >= 0 ? source.sourceIndex : fallbackIndex
            let attributed = makeAttributedContent(from: source, theme: theme, fontScale: fontScale)
            var contentOffset = 0
            var isFirstVisualPage = true

            repeat {
                let hasFrontMatter = isFirstVisualPage && (
                    !(source.chapterTitle ?? "").isEmpty ||
                    !(source.title ?? "").isEmpty ||
                    source.imageSrc != nil
                )
                let chapter = isFirstVisualPage ? source.chapterTitle : nil
                let title = isFirstVisualPage ? source.title : nil
                let imageSrc = isFirstVisualPage ? source.imageSrc : nil
                let imageAlt = isFirstVisualPage ? source.imageAlt : nil
                let availableTextHeight = max(
                    32,
                    pageHeight - fixedContentHeight(
                        chapter: chapter,
                        title: title,
                        hasImage: imageSrc != nil,
                        textWidth: textWidth,
                        fontScale: fontScale
                    )
                )

                let remainingRange = NSRange(
                    location: contentOffset,
                    length: max(0, attributed.length - contentOffset)
                )
                var fittingRange = fittingCharacterRange(
                    in: attributed,
                    remainingRange: remainingRange,
                    width: textWidth,
                    height: availableTextHeight
                )
                if fittingRange.length == 0, remainingRange.length > 0, !hasFrontMatter {
                    fittingRange = NSRange(location: contentOffset, length: 1)
                }

                let pageText: NSAttributedString?
                if fittingRange.length > 0 {
                    pageText = attributed.attributedSubstring(from: fittingRange)
                    contentOffset = NSMaxRange(fittingRange)
                    let string = attributed.string as NSString
                    while contentOffset < attributed.length {
                        let next = string.substring(with: NSRange(location: contentOffset, length: 1))
                        if next.rangeOfCharacter(from: .whitespacesAndNewlines) == nil { break }
                        contentOffset += 1
                    }
                } else {
                    pageText = nil
                }

                output.append(BookPageData(
                    pageNumber: output.count + 1,
                    sourceIndex: sourceIndex,
                    contentStartOffset: fittingRange.location,
                    chapterTitle: chapter,
                    title: title,
                    contentHtml: "",
                    imageSrc: imageSrc,
                    imageAlt: imageAlt,
                    attributedContent: pageText
                ))

                isFirstVisualPage = false

                // A visual-only source still needs exactly one page. A very small text
                // area also must never leave pagination stuck at the same character.
                if attributed.length == 0 || contentOffset >= attributed.length {
                    break
                }
            } while true
        }

        return output.isEmpty
            ? [BookPageData(pageNumber: 1, contentHtml: "", plainText: "İçerik yüklenemedi.")]
            : output
    }

    private static func fixedContentHeight(
        chapter: String?,
        title: String?,
        hasImage: Bool,
        textWidth: CGFloat,
        fontScale: CGFloat
    ) -> CGFloat {
        var heights: [CGFloat] = []

        if let chapter, !chapter.isEmpty {
            let font = UIFont.systemFont(ofSize: 11, weight: .bold)
            heights.append(measuredHeight(chapter.uppercased(), font: font, width: textWidth, maximumLines: 2))
        }
        if hasImage {
            heights.append(BookPageLayout.imageHeight(for: textWidth))
        }
        if let title, !title.isEmpty {
            heights.append(measuredHeight(title, font: titleFont(scale: fontScale), width: textWidth, maximumLines: 0))
        }

        guard !heights.isEmpty else { return 0 }
        return heights.reduce(0, +) + (CGFloat(heights.count) * BookPageLayout.elementSpacing)
    }

    private static func measuredHeight(
        _ text: String,
        font: UIFont,
        width: CGFloat,
        maximumLines: Int
    ) -> CGFloat {
        let paragraph = NSMutableParagraphStyle()
        paragraph.lineBreakMode = .byWordWrapping
        let bounding = (text as NSString).boundingRect(
            with: CGSize(width: width, height: .greatestFiniteMagnitude),
            options: [.usesLineFragmentOrigin, .usesFontLeading],
            attributes: [.font: font, .paragraphStyle: paragraph],
            context: nil
        )
        let naturalHeight = ceil(bounding.height)
        if maximumLines > 0 {
            return min(naturalHeight, ceil(font.lineHeight * CGFloat(maximumLines)))
        }
        return naturalHeight
    }

    private static func fittingCharacterRange(
        in text: NSAttributedString,
        remainingRange: NSRange,
        width: CGFloat,
        height: CGFloat
    ) -> NSRange {
        guard remainingRange.length > 0 else {
            return NSRange(location: remainingRange.location, length: 0)
        }

        let remainingText = text.attributedSubstring(from: remainingRange)
        let textStorage = NSTextStorage(attributedString: remainingText)
        let layoutManager = NSLayoutManager()
        let textContainer = NSTextContainer(size: CGSize(width: width, height: height))
        textContainer.lineFragmentPadding = 0
        textContainer.maximumNumberOfLines = 0
        textContainer.lineBreakMode = .byWordWrapping
        layoutManager.addTextContainer(textContainer)
        textStorage.addLayoutManager(layoutManager)

        let glyphRange = layoutManager.glyphRange(for: textContainer)
        var characterRange = layoutManager.characterRange(forGlyphRange: glyphRange, actualGlyphRange: nil)
        characterRange.location += remainingRange.location

        // Avoid beginning a new page with whitespace introduced by an HTML paragraph.
        while characterRange.length > 0 {
            let finalIndex = NSMaxRange(characterRange) - 1
            let scalar = (text.string as NSString).substring(with: NSRange(location: finalIndex, length: 1))
            if scalar.rangeOfCharacter(from: .whitespacesAndNewlines) == nil { break }
            characterRange.length -= 1
        }
        return characterRange
    }

    static func titleFont(scale: CGFloat) -> UIFont {
        UIFont(name: "NewYork-Bold", size: 21 * scale)
            ?? UIFont(name: "Georgia-Bold", size: 21 * scale)
            ?? UIFont.systemFont(ofSize: 21 * scale, weight: .bold)
    }

    static func makeAttributedContent(
        from page: BookPageData,
        theme: ReaderTheme,
        fontScale: CGFloat
    ) -> NSAttributedString {
        if let attributed = page.attributedContent {
            return attributed
        }

        let rawHtml = page.contentHtml.trimmingCharacters(in: .whitespacesAndNewlines)
        if !rawHtml.isEmpty {
            let styledHtml = formatHtmlForReader(html: rawHtml, theme: theme, scale: fontScale)
            if let data = styledHtml.data(using: .utf8),
               let attributed = try? NSMutableAttributedString(
                    data: data,
                    options: [
                        .documentType: NSAttributedString.DocumentType.html,
                        .characterEncoding: String.Encoding.utf8.rawValue
                    ],
                    documentAttributes: nil
               ) {
                return attributed
            }
        }

        let plain = page.plainText ?? rawHtml
        guard !plain.isEmpty else { return NSAttributedString(string: "") }
        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.lineSpacing = 6 * fontScale
        paragraphStyle.paragraphSpacing = 14 * fontScale
        let font = UIFont(name: "Georgia", size: 16 * fontScale)
            ?? UIFont.systemFont(ofSize: 16 * fontScale)
        return NSAttributedString(string: plain, attributes: [
            .font: font,
            .foregroundColor: theme.textColor,
            .paragraphStyle: paragraphStyle
        ])
    }

    private static func formatHtmlForReader(html: String, theme: ReaderTheme, scale: CGFloat) -> String {
        let baseFontSize = Int(16.5 * scale)
        let textColorHex = theme == .dark ? "#E3E5E8" : (theme == .sepia ? "#382D22" : "#1A1A1A")
        let linkColorHex = theme == .dark ? "#88B4FF" : (theme == .sepia ? "#8A5424" : "#1D64D8")

        return """
        <!DOCTYPE html>
        <html><head><meta charset="utf-8"><style>
        body {
            font-family: -apple-system-ui-serif, 'New York', Georgia, 'Times New Roman', serif;
            font-size: \(baseFontSize)px; line-height: 1.62; color: \(textColorHex);
            margin: 0; padding: 0; background-color: transparent;
            text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased;
        }
        p { margin: 0 0 0.95em; text-align: left; }
        h1, h2, h3, h4, h5, h6 {
            font-family: -apple-system, system-ui, sans-serif; font-weight: 700;
            line-height: 1.25; margin: 1.2em 0 0.5em;
        }
        h2 { font-size: \(Int(CGFloat(baseFontSize) * 1.22))px; }
        h3 { font-size: \(Int(CGFloat(baseFontSize) * 1.10))px; }
        blockquote { margin: 1em 0; padding-left: 14px; border-left: 3px solid rgba(130,100,70,.35); font-style: italic; }
        ul, ol { padding-left: 20px; margin-bottom: .8em; }
        li { margin-bottom: .35em; }
        a { color: \(linkColorHex); text-decoration: none; }
        strong, b { font-weight: 700; }
        code { font-family: Menlo, monospace; font-size: .9em; background: rgba(128,128,128,.12); }
        </style></head><body>\(html)</body></html>
        """
    }
}
