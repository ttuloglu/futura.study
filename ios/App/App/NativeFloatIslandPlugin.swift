import Capacitor
import UIKit

@objc(NativeFloatIslandPlugin)
final class NativeFloatIslandPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "NativeFloatIslandPlugin"
    let jsName = "NativeFloatIsland"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hide", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getKeyboardState", returnType: CAPPluginReturnPromise)
    ]

    private var island: NativeFloatIslandView?
    private var requestedVisible = false
    private var keyboardVisible = false
    private var keyboardTop: CGFloat?
    private var observers: [NSObjectProtocol] = []

    private var keyboardState: JSObject {
        ["visible": keyboardVisible, "top": Double(keyboardTop ?? bridge?.webView?.bounds.height ?? 0)]
    }

    @objc func getKeyboardState(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { call.reject("Keyboard geometry is unavailable"); return }
            call.resolve(self.keyboardState)
        }
    }

    private func updateKeyboardGeometry(_ notification: Notification) {
        guard let webView = bridge?.webView, let window = webView.window,
              let frame = (notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue)?.cgRectValue else { return }
        let keyboard = webView.convert(window.convert(frame, from: nil), from: window)
        let overlap = webView.bounds.intersection(keyboard)
        keyboardVisible = !overlap.isNull && overlap.height > 1
        keyboardTop = keyboardVisible ? max(0, overlap.minY) : webView.bounds.height
        notifyListeners("keyboardGeometry", data: keyboardState)
        refreshVisibility()
    }

    override func load() {
        super.load()
        let center = NotificationCenter.default
        observers = [
            center.addObserver(forName: UIResponder.keyboardWillShowNotification, object: nil, queue: .main) { [weak self] _ in
                self?.keyboardVisible = true
                self?.refreshVisibility()
            },
            center.addObserver(forName: UIResponder.keyboardWillHideNotification, object: nil, queue: .main) { [weak self] _ in
                self?.keyboardVisible = false
                self?.keyboardTop = self?.bridge?.webView?.bounds.height
                if let self { self.notifyListeners("keyboardGeometry", data: self.keyboardState) }
                self?.refreshVisibility()
            },
            center.addObserver(forName: UIResponder.keyboardWillChangeFrameNotification, object: nil, queue: .main) { [weak self] notification in
                self?.updateKeyboardGeometry(notification)
            }
        ]
    }

    deinit {
        observers.forEach(NotificationCenter.default.removeObserver)
    }

    @objc func show(_ call: CAPPluginCall) { apply(call) }
    @objc func update(_ call: CAPPluginCall) { apply(call) }

    @objc func hide(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { call.reject("Native FloatIsland is unavailable"); return }
            self.requestedVisible = false
            self.refreshVisibility()
            call.resolve()
        }
    }

    private func apply(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self, let island = self.installIfNeeded() else {
                call.reject("Native FloatIsland requires a bridge host view")
                return
            }
            island.apply(active: call.getString("active") ?? "home",
                         labels: call.getObject("labels") ?? [:],
                         unreadCount: call.getInt("unreadCount") ?? 0)
            self.requestedVisible = call.getBool("visible") ?? true
            self.refreshVisibility()
            island.superview?.layoutIfNeeded()
            call.resolve()
        }
    }

    private func installIfNeeded() -> NativeFloatIslandView? {
        if let island { return island }
        guard let host = bridge?.viewController?.view else { return nil }
        let island = NativeFloatIslandView()
        island.translatesAutoresizingMaskIntoConstraints = false
        island.isHidden = true
        island.onAction = { [weak self] action in
            self?.notifyListeners("action", data: ["action": action])
        }
        host.addSubview(island)
        let preferredWidth = island.widthAnchor.constraint(equalToConstant: 300)
        preferredWidth.priority = .defaultHigh
        NSLayoutConstraint.activate([
            preferredWidth,
            island.centerXAnchor.constraint(equalTo: host.safeAreaLayoutGuide.centerXAnchor),
            island.leadingAnchor.constraint(greaterThanOrEqualTo: host.safeAreaLayoutGuide.leadingAnchor, constant: 16),
            island.trailingAnchor.constraint(lessThanOrEqualTo: host.safeAreaLayoutGuide.trailingAnchor, constant: -16),
            island.bottomAnchor.constraint(equalTo: host.safeAreaLayoutGuide.bottomAnchor, constant: -8),
            island.heightAnchor.constraint(equalToConstant: 54)
        ])
        self.island = island
        return island
    }

    private func refreshVisibility() {
        guard let island else { return }
        let visible = requestedVisible && !keyboardVisible
        // Immediate visibility avoids stale animation completions hiding a newer state.
        island.isHidden = !visible
        island.isUserInteractionEnabled = visible
        if visible { island.superview?.bringSubviewToFront(island) }
    }
}

private final class NativeFloatIslandView: UIVisualEffectView {
    var onAction: ((String) -> Void)?

    private let stack = UIStackView()
    private let badge = UILabel()
    private var buttons: [String: UIButton] = [:]
    private var activeWidth: [String: NSLayoutConstraint] = [:]
    private let destinations = ["home", "books", "settings"]
    private var labels = ["home": "Anasayfa", "books": "Kitaplarım", "settings": "Ayarlar"]
    private let feedbackGenerator = UIImpactFeedbackGenerator(style: .medium)

    init() {
        let effect: UIVisualEffect
        if #available(iOS 26.0, *) {
            let glass = UIGlassEffect(style: .regular)
            glass.isInteractive = true
            effect = glass
        } else {
            effect = UIBlurEffect(style: .systemUltraThinMaterialDark)
        }
        super.init(effect: effect)
        overrideUserInterfaceStyle = .dark
        accessibilityIdentifier = "fortale-native-float-island"
        if #available(iOS 26.0, *) {
            cornerConfiguration = .capsule()
        } else {
            layer.cornerRadius = 27
            clipsToBounds = true
        }
        configureButtons()
        apply(active: "home", labels: [:], unreadCount: 0)
        feedbackGenerator.prepare()
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func configureButtons() {
        stack.axis = .horizontal
        stack.alignment = .fill
        stack.distribution = .fill
        stack.spacing = 4
        stack.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 6),
            stack.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -6),
            stack.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 6),
            stack.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -6)
        ])

        for id in destinations {
            var config = UIButton.Configuration.plain()
            config.baseForegroundColor = .white
            config.contentInsets = NSDirectionalEdgeInsets(top: 0, leading: 8, bottom: 0, trailing: 8)
            config.titleLineBreakMode = .byTruncatingTail
            config.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { attributes in
                var attributes = attributes
                attributes.font = .systemFont(ofSize: 11, weight: .bold)
                return attributes
            }
            let symbol = id == "books" ? "books.vertical" : "gearshape"
            config.image = id == "home" ? Self.fortaleMark() : UIImage(
                systemName: symbol, withConfiguration: UIImage.SymbolConfiguration(pointSize: 18, weight: .semibold))
            let button = UIButton(configuration: config)
            button.accessibilityIdentifier = id
            button.addTarget(self, action: #selector(tapped(_:)), for: .touchUpInside)
            button.translatesAutoresizingMaskIntoConstraints = false
            stack.addArrangedSubview(button)
            buttons[id] = button
            // The selected item gets half the space; the other two share the rest.
            activeWidth[id] = button.widthAnchor.constraint(equalTo: stack.widthAnchor, multiplier: 0.5, constant: -4)
        }
        let home = buttons["home"]!
        let books = buttons["books"]!
        let settings = buttons["settings"]!
        for (first, second) in [(home, books), (books, settings), (home, settings)] {
            let equal = first.widthAnchor.constraint(equalTo: second.widthAnchor)
            equal.priority = .defaultLow
            equal.isActive = true
        }

        badge.translatesAutoresizingMaskIntoConstraints = false
        badge.backgroundColor = .systemRed
        badge.textColor = .white
        badge.font = .systemFont(ofSize: 9, weight: .bold)
        badge.textAlignment = .center
        badge.layer.cornerRadius = 8
        badge.clipsToBounds = true
        settings.addSubview(badge)
        NSLayoutConstraint.activate([
            badge.topAnchor.constraint(equalTo: settings.topAnchor, constant: 1),
            badge.trailingAnchor.constraint(equalTo: settings.trailingAnchor, constant: -1),
            badge.heightAnchor.constraint(equalToConstant: 16),
            badge.widthAnchor.constraint(greaterThanOrEqualToConstant: 16)
        ])
    }

    func apply(active requested: String, labels incoming: JSObject, unreadCount: Int) {
        let active = destinations.contains(requested) ? requested : "home"
        accessibilityLabel = incoming["navigation"] as? String ?? "Fortale gezinme"
        // Deactivate the previous constraint before enabling the next one.
        activeWidth.values.forEach { $0.isActive = false }
        for id in destinations {
            if let label = incoming[id] as? String, !label.isEmpty { labels[id] = label }
            guard let button = buttons[id], var config = button.configuration else { continue }
            let selected = id == active
            config.title = selected ? labels[id] : nil
            config.imagePadding = selected ? 6 : 0
            config.baseForegroundColor = .white
            config.background.backgroundColor = selected ? .black : .clear
            config.background.cornerRadius = 21
            config.background.backgroundColorTransformer = UIConfigurationColorTransformer { _ in
                selected ? .black : .clear
            }
            button.configuration = config
            button.accessibilityLabel = labels[id]
            button.accessibilityTraits = selected ? [.button, .selected] : [.button]
            activeWidth[id]?.isActive = selected
        }
        badge.text = unreadCount > 99 ? "99+" : String(max(0, unreadCount))
        badge.isHidden = unreadCount <= 0
    }

    @objc private func tapped(_ sender: UIButton) {
        guard let action = sender.accessibilityIdentifier else { return }
        feedbackGenerator.impactOccurred()
        feedbackGenerator.prepare()
        onAction?(action)
    }

    private static func fortaleMark() -> UIImage {
        UIGraphicsImageRenderer(size: CGSize(width: 32, height: 32)).image { renderer in
            let context = renderer.cgContext
            context.scaleBy(x: 32 / 1024, y: 32 / 1024)
            let bars: [(CGFloat, CGFloat, CGFloat, Bool)] = [
                (232, 352, 320, false), (362, 242, 540, false), (492, 172, 680, true),
                (622, 242, 540, false), (752, 352, 320, false)
            ]
            for (x, y, height, accent) in bars {
                let color: UIColor = accent ? UIColor(red: 192 / 255, green: 66 / 255, blue: 53 / 255, alpha: 1) : .white
                context.setFillColor(color.cgColor)
                context.addPath(UIBezierPath(roundedRect: CGRect(x: x, y: y, width: 64, height: height), cornerRadius: 32).cgPath)
                context.fillPath()
            }
        }.withRenderingMode(.alwaysOriginal)
    }
}
