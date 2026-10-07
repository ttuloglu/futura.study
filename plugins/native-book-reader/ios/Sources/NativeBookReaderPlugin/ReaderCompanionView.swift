import UIKit
import WebKit

// Reading companion has a reserved space in the toolbar, outside the page text.
final class ReaderCompanionView: UIView, WKNavigationDelegate {
    private let webView = WKWebView(frame: .zero)
    private let menuButton = UIButton(type: .custom)
    private let restoreButton = UIButton(type: .system)
    private var activityTimer: Timer?
    private var labels: [String: String]
    private(set) var characterHidden: Bool
    var onStatistics: (() -> Void)?
    var onChangeAvatar: (() -> Void)?
    private let avatar: String
    private let legendary: Bool

    init(file: URL, hidden: Bool = false, labels: [String: String] = [:], avatar: String = "dost", legendary: Bool = false) {
        characterHidden = hidden
        self.labels = labels
        let allowed = ["dost", "koz", "misket", "pus", "lumen", "nova", "koala", "panda"]
        self.avatar = allowed.contains(avatar) ? avatar : "dost"
        self.legendary = legendary && avatar == "nova"
        super.init(frame: .zero)
        backgroundColor = .clear
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        webView.isUserInteractionEnabled = false
        webView.navigationDelegate = self
        addSubview(webView)
        webView.loadFileURL(file, allowingReadAccessTo: file.deletingLastPathComponent())
        restoreButton.setImage(UIImage(systemName: "eye"), for: .normal)
        restoreButton.tintColor = .secondaryLabel
        restoreButton.addTarget(self, action: #selector(showCharacter), for: .touchUpInside)
        restoreButton.accessibilityLabel = label("show", "Avatarı göster")
        addSubview(restoreButton)
        updateVisibility()
        menuButton.backgroundColor = .clear
        menuButton.showsMenuAsPrimaryAction = true
        menuButton.menu = UIMenu(children: actions().map { item in
            UIAction(title: item.0, image: UIImage(systemName: item.1)) { _ in item.2() }
        })
        if #available(iOS 16.0, *) { menuButton.preferredMenuElementOrder = .fixed }
        addSubview(menuButton)
        updateVisibility()
        isAccessibilityElement = true
        accessibilityTraits = .button
        accessibilityCustomActions = [UIAccessibilityCustomAction(name: label("menu", "Avatar menüsü"), actionHandler: { [weak self] _ in
            guard let self = self else { return false }
            self.presentAccessibleMenu()
            return true
        })]
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    private func label(_ key: String, _ fallback: String) -> String { labels[key] ?? fallback }
    private func updateVisibility() {
        webView.isHidden = characterHidden
        restoreButton.isHidden = !characterHidden
        menuButton.isHidden = characterHidden
        accessibilityLabel = characterHidden ? label("show", "Avatarı göster") : label("menu", "Avatar menüsü")
        accessibilityHint = characterHidden ? nil : label("statistics", "İstatistik göster")
    }
    @objc private func showCharacter() { characterHidden = false; updateVisibility() }
    private func hideCharacter() { characterHidden = true; activityTimer?.invalidate(); updateVisibility() }
    func dock(in rect: CGRect) {
        frame = rect
        restoreButton.frame = bounds
        menuButton.frame = bounds
        webView.transform = .identity
        webView.frame = CGRect(x: 0, y: 0, width: 96, height: 116)
        webView.transform = CGAffineTransform(scaleX: 0.48, y: 0.48)
        webView.center = CGPoint(x: bounds.midX, y: bounds.midY)
    }
    @objc private func statistics() { if !characterHidden { onStatistics?() } }
    override func accessibilityActivate() -> Bool {
        if characterHidden { showCharacter() } else { presentAccessibleMenu() }
        return true
    }
    private func setActivity(_ mood: String) {
        activityTimer?.invalidate()
        // Mood comes only from the menu's fixed action list.
        webView.evaluateJavaScript("window.setCompanionMood('\(mood)')", completionHandler: nil)
        if mood != "read" {
            activityTimer = Timer.scheduledTimer(withTimeInterval: 14, repeats: false) { [weak self] _ in self?.setActivity("read") }
        }
    }
    private func actions() -> [(String, String, () -> Void)] {
        return [
            (label("avatar", "Avatarı değiştir"), "person.crop.circle.badge.plus", { [weak self] in self?.onChangeAvatar?() }),
            (label("hide", "Gizle"), "eye.slash", { [weak self] in self?.hideCharacter() }),
            (label("sit", "Otur"), "chair", { [weak self] in self?.setActivity("sit") }),
            (label("walk", "Gezin"), "figure.walk", { [weak self] in self?.setActivity("walk") }),
            (label("exercise", "Spor yap"), "figure.strengthtraining.traditional", { [weak self] in self?.setActivity("exercise") }),
            (label("statistics", "İstatistik göster"), "chart.bar", { [weak self] in self?.statistics() }),
            (label("auto", "Kendi haline bırak"), "shuffle", { [weak self] in self?.setActivity("read") })
        ]
    }
    private func presentAccessibleMenu() {
        if #available(iOS 17.4, *) { menuButton.performPrimaryAction(); return }
        var responder: UIResponder? = self
        while let current = responder {
            if let controller = current as? UIViewController {
                let sheet = UIAlertController(title: label("menu", "Avatar menüsü"), message: nil, preferredStyle: .actionSheet)
                actions().forEach { item in sheet.addAction(UIAlertAction(title: item.0, style: .default) { _ in item.2() }) }
                sheet.addAction(UIAlertAction(title: label("cancel", "Kapat"), style: .cancel))
                sheet.popoverPresentationController?.sourceView = self
                sheet.popoverPresentationController?.sourceRect = bounds
                controller.present(sheet, animated: true)
                return
            }
            responder = current.next
        }
    }
    func stopGame() { activityTimer?.invalidate(); activityTimer = nil }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webView.evaluateJavaScript("window.setCompanionAvatar('\(avatar)', \(legendary ? "true" : "false"))", completionHandler: nil)
    }
    deinit { activityTimer?.invalidate() }
}
