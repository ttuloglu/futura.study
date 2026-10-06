import UIKit
import WebKit

// Reading companion has a reserved space in the toolbar, outside the page text.
final class ReaderCompanionView: UIView {
    private let webView = WKWebView(frame: .zero)
    var onStatistics: (() -> Void)?
    init(file: URL) {
        super.init(frame: .zero)
        backgroundColor = .clear
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        webView.isUserInteractionEnabled = false
        addSubview(webView)
        webView.loadFileURL(file, allowingReadAccessTo: file.deletingLastPathComponent())
        let doubleTap = UITapGestureRecognizer(target: self, action: #selector(statistics))
        doubleTap.numberOfTapsRequired = 2
        addGestureRecognizer(doubleTap)
        isAccessibilityElement = true
        accessibilityLabel = "Okuma hatıram"
        accessibilityHint = "Okuma istatistiklerini göster"
        accessibilityTraits = .button
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    func dock(in rect: CGRect) {
        frame = rect
        webView.transform = .identity
        webView.frame = CGRect(x: 0, y: 0, width: 96, height: 116)
        webView.transform = CGAffineTransform(scaleX: 0.48, y: 0.48)
        webView.center = CGPoint(x: bounds.midX, y: bounds.midY)
    }
    @objc private func statistics() { onStatistics?() }
    override func accessibilityActivate() -> Bool { onStatistics?(); return true }
    func stopGame() { }
}
