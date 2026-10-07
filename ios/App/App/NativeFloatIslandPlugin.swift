import Capacitor
import UIKit

// A UIKit field keeps the keyboard and its layout outside WKWebView's input assistant.
private final class NativeLibrarySearchController: UIViewController, UITextFieldDelegate, UIGestureRecognizerDelegate {
    var onFinish: ((Bool, String) -> Void)?
    private let field = UITextField()
    private let panel = UIView()
    private let initialQuery: String
    private let searchTitle: String
    private let searchLabel: String
    private let cancelLabel: String
    private var finished = false
    private var panelWidth: NSLayoutConstraint?
    private var panelDock: NSLayoutConstraint?
    private var panelCenter: NSLayoutConstraint?
    private var panelClearance: NSLayoutConstraint?

    init(query: String, title: String, search: String, cancel: String) {
        initialQuery = query
        searchTitle = title
        searchLabel = search
        cancelLabel = cancel
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .overFullScreen
        modalTransitionStyle = .crossDissolve
        overrideUserInterfaceStyle = .dark
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    override func viewDidLoad() {
        super.viewDidLoad()
        let cream = UIColor(white: 0.88, alpha: 1)
        view.backgroundColor = UIColor(red: 20 / 255, green: 23 / 255, blue: 27 / 255, alpha: 1)
        view.accessibilityViewIsModal = true
        panel.backgroundColor = UIColor(red: 40 / 255, green: 44 / 255, blue: 49 / 255, alpha: 1)
        panel.layer.cornerRadius = 26
        panel.layer.cornerCurve = .continuous
        panel.layer.borderWidth = 1
        panel.layer.borderColor = cream.withAlphaComponent(0.2).cgColor
        panel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(panel)

        let logo = UIImageView(image: NativeFloatIslandView.fortaleMark())
        logo.contentMode = .scaleAspectFit
        logo.widthAnchor.constraint(equalToConstant: 28).isActive = true
        let title = UILabel()
        title.text = searchTitle
        title.font = .systemFont(ofSize: 19, weight: .semibold)
        title.textColor = cream
        title.adjustsFontForContentSizeCategory = true
        let close = UIButton(type: .custom)
        close.setImage(NativeFloatIslandView.dialogCloseIcon(), for: .normal)
        close.tintColor = UIColor(white: 23 / 255, alpha: 1)
        close.backgroundColor = .white
        close.layer.cornerRadius = 18
        close.layer.borderWidth = 0.5
        close.layer.borderColor = UIColor.white.cgColor
        close.layer.shadowColor = UIColor.black.cgColor
        close.layer.shadowOpacity = 0.18
        close.layer.shadowRadius = 5
        close.layer.shadowOffset = CGSize(width: 0, height: 2)
        close.accessibilityLabel = cancelLabel
        close.accessibilityIdentifier = "fortale.library.search.cancel"
        close.widthAnchor.constraint(equalToConstant: 36).isActive = true
        close.heightAnchor.constraint(equalToConstant: 36).isActive = true
        close.addTarget(self, action: #selector(cancelSearch), for: .touchUpInside)
        let header = UIStackView(arrangedSubviews: [logo, title, close])
        header.spacing = 10
        header.alignment = .center
        header.heightAnchor.constraint(equalToConstant: 40).isActive = true

        field.text = initialQuery
        field.font = .systemFont(ofSize: 17)
        field.textColor = cream
        field.tintColor = cream
        field.backgroundColor = UIColor(red: 29 / 255, green: 33 / 255, blue: 38 / 255, alpha: 1)
        field.layer.cornerRadius = 14
        field.layer.borderWidth = 1
        field.layer.borderColor = cream.withAlphaComponent(0.18).cgColor
        field.attributedPlaceholder = NSAttributedString(string: searchTitle, attributes: [.foregroundColor: cream.withAlphaComponent(0.6)])
        field.clearButtonMode = .whileEditing
        field.autocapitalizationType = .none
        field.autocorrectionType = .no
        field.spellCheckingType = .no
        field.keyboardAppearance = .dark
        field.returnKeyType = .search
        field.inputAssistantItem.leadingBarButtonGroups = []
        field.inputAssistantItem.trailingBarButtonGroups = []
        field.inputAccessoryView = nil
        field.accessibilityLabel = searchTitle
        field.accessibilityIdentifier = "fortale.library.search.field"
        field.delegate = self
        let iconContainer = UIView(frame: CGRect(x: 0, y: 0, width: 42, height: 48))
        let icon = UIImageView(image: UIImage(systemName: "magnifyingglass"))
        icon.tintColor = cream
        icon.frame = CGRect(x: 14, y: 14, width: 20, height: 20)
        iconContainer.addSubview(icon)
        field.leftView = iconContainer
        field.leftViewMode = .always
        field.heightAnchor.constraint(equalToConstant: 48).isActive = true

        let submit = UIButton(type: .system)
        submit.setTitle(searchLabel, for: .normal)
        submit.titleLabel?.font = .systemFont(ofSize: 16, weight: .semibold)
        submit.setTitleColor(UIColor(white: 0.12, alpha: 1), for: .normal)
        submit.backgroundColor = cream
        submit.layer.cornerRadius = 14
        submit.heightAnchor.constraint(equalToConstant: 48).isActive = true
        submit.accessibilityIdentifier = "fortale.library.search.submit"
        submit.addTarget(self, action: #selector(submitSearch), for: .touchUpInside)
        let stack = UIStackView(arrangedSubviews: [header, field, submit])
        stack.axis = .vertical
        stack.spacing = 18
        stack.translatesAutoresizingMaskIntoConstraints = false
        panel.addSubview(stack)

        // UIKit animates these anchors with the keyboard, including hardware keyboards.
        // A floating iPad keyboard must not move the entire dialog toward its top edge.
        view.keyboardLayoutGuide.followsUndockedKeyboard = UIDevice.current.userInterfaceIdiom != .pad
        let dock = panel.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor, constant: -12)
        dock.priority = .defaultHigh
        let center = panel.centerYAnchor.constraint(equalTo: view.safeAreaLayoutGuide.centerYAnchor, constant: -32)
        center.priority = .defaultHigh
        panelDock = dock
        panelCenter = center
        let widthLimit = panel.widthAnchor.constraint(lessThanOrEqualToConstant: 520)
        panelWidth = widthLimit
        let clearance = panel.bottomAnchor.constraint(lessThanOrEqualTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -80)
        panelClearance = clearance
        let width = panel.widthAnchor.constraint(equalTo: view.widthAnchor, constant: -24)
        width.priority = .defaultHigh
        NSLayoutConstraint.activate([
            panel.centerXAnchor.constraint(equalTo: view.centerXAnchor), width,
            widthLimit,
            panel.topAnchor.constraint(greaterThanOrEqualTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
            panel.bottomAnchor.constraint(lessThanOrEqualTo: view.keyboardLayoutGuide.topAnchor, constant: -12),
            clearance, dock,
            stack.topAnchor.constraint(equalTo: panel.topAnchor, constant: 18),
            stack.leadingAnchor.constraint(equalTo: panel.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: panel.trailingAnchor, constant: -16),
            stack.bottomAnchor.constraint(equalTo: panel.bottomAnchor, constant: -18)
        ])
        let dismiss = UITapGestureRecognizer(target: self, action: #selector(cancelSearch))
        dismiss.delegate = self
        view.addGestureRecognizer(dismiss)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        field.becomeFirstResponder()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        let tablet = view.bounds.width >= 700
        panelWidth?.constant = tablet ? 640 : 520
        panelClearance?.constant = tablet ? -94 : -80
        panelDock?.isActive = !tablet
        panelCenter?.isActive = tablet
    }

    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
        !panel.frame.contains(touch.location(in: view))
    }

    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        finish(submitted: true)
        return false
    }

    @objc private func submitSearch() { finish(submitted: true) }
    @objc private func cancelSearch() { finish(submitted: false) }

    func finish(submitted: Bool) {
        guard !finished else { return }
        finished = true
        field.resignFirstResponder()
        onFinish?(submitted, field.text ?? "")
    }
}

@objc(NativeFloatIslandPlugin)
final class NativeFloatIslandPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "NativeFloatIslandPlugin"
    let jsName = "NativeFloatIsland"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hide", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getKeyboardState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setPageScrollLocked", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showLibrarySearch", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "dismissLibrarySearch", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showCompanionMenu", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "dismissCompanionMenu", returnType: CAPPluginReturnPromise)
    ]

    private var island: NativeFloatIslandView?
    private var islandWidth: NSLayoutConstraint?
    private var islandHeight: NSLayoutConstraint?
    private var islandBottom: NSLayoutConstraint?
    private var requestedVisible = false
    private var keyboardVisible = false
    private var keyboardTop: CGFloat?
    private var observers: [NSObjectProtocol] = []
    private var companionMenuButton: CompanionMenuButton?
    private var companionMenuCall: CAPPluginCall?
    private var companionMenuRequest: String?
    private var companionActionSheet: UIAlertController?
    private var companionMenuAction = ""
    private var pageScrollState: (enabled: Bool, bounces: Bool, offset: CGPoint)?
    private var librarySearch: NativeLibrarySearchController?
    private var librarySearchRequest: String?

    @objc func showLibrarySearch(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self, let host = self.bridge?.viewController,
                  self.librarySearch == nil, host.presentedViewController == nil else {
                call.reject("Another native window is already open")
                return
            }
            let labels = call.getObject("labels") ?? [:]
            let controller = NativeLibrarySearchController(query: call.getString("query") ?? "",
                title: labels["title"] as? String ?? "Kitap ara",
                search: labels["search"] as? String ?? "Ara",
                cancel: labels["cancel"] as? String ?? "Kapat")
            controller.onFinish = { [weak self, weak controller] submitted, query in
                controller?.dismiss(animated: true) {
                    self?.librarySearch = nil
                    self?.librarySearchRequest = nil
                    self?.refreshVisibility()
                    call.resolve(["submitted": submitted, "query": query])
                }
            }
            self.librarySearch = controller
            self.librarySearchRequest = call.getString("requestId")
            self.refreshVisibility()
            host.present(controller, animated: true)
        }
    }

    @objc func dismissLibrarySearch(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            if self?.librarySearchRequest == call.getString("requestId") {
                self?.librarySearch?.finish(submitted: false)
            }
            call.resolve()
        }
    }

    @objc func setPageScrollLocked(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self, let scroll = self.bridge?.webView?.scrollView else {
                call.reject("Page scroll requires a web view")
                return
            }
            if call.getBool("locked") == true {
                if self.pageScrollState == nil {
                    self.pageScrollState = (scroll.isScrollEnabled, scroll.bounces, scroll.contentOffset)
                }
                // The app's CSS scroll areas remain separate from this outer viewport.
                scroll.isScrollEnabled = false
                scroll.bounces = false
            } else if let previous = self.pageScrollState {
                scroll.setContentOffset(previous.offset, animated: false)
                scroll.isScrollEnabled = previous.enabled
                scroll.bounces = previous.bounces
                self.pageScrollState = nil
            }
            call.resolve()
        }
    }

    @objc func showCompanionMenu(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self, let host = self.bridge?.viewController?.view,
                  let webView = self.bridge?.webView, let rect = call.getObject("rect") else {
                call.reject("Avatar menu requires a bridge host view")
                return
            }
            guard self.companionMenuCall == nil, self.companionMenuButton == nil else {
                call.reject("Avatar menu is already open")
                return
            }
            let source = CGRect(x: (rect["x"] as? NSNumber)?.doubleValue ?? 0,
                                y: (rect["y"] as? NSNumber)?.doubleValue ?? 0,
                                width: (rect["width"] as? NSNumber)?.doubleValue ?? 96,
                                height: (rect["height"] as? NSNumber)?.doubleValue ?? 104)
            let labels = call.getObject("labels") ?? [:]
            let label: (String, String) -> String = { labels[$0] as? String ?? $1 }
            let items = [("avatar", "Avatarı değiştir", "person.crop.circle.badge.plus"), ("hide", "Gizle", "eye.slash"), ("sit", "Otur", "chair"),
                         ("walk", "Gezin", "figure.walk"), ("exercise", "Spor yap", "figure.strengthtraining.traditional"),
                         ("statistics", "İstatistik göster", "chart.bar"), ("auto", "Kendi haline bırak", "shuffle")]
            self.companionMenuCall = call
            self.companionMenuRequest = call.getString("requestId")
            let frame = host.convert(source, from: webView).intersection(host.bounds)
            if #available(iOS 17.4, *) {
                let button = CompanionMenuButton(type: .custom)
                button.frame = frame.isNull ? CGRect(x: host.bounds.midX, y: host.bounds.midY, width: 1, height: 1) : frame
                button.backgroundColor = .clear
                button.accessibilityLabel = label("menu", "Avatar menüsü")
                button.showsMenuAsPrimaryAction = true
                button.preferredMenuElementOrder = .fixed
                button.menu = UIMenu(children: items.map { key, fallback, symbol in
                    UIAction(title: label(key, fallback), image: UIImage(systemName: symbol)) { [weak self] _ in
                        self?.companionMenuAction = key
                    }
                })
                button.onMenuDismissed = { [weak self, weak button] in
                    guard let self, self.companionMenuButton === button else { return }
                    self.finishCompanionMenu()
                }
                self.companionMenuButton = button
                host.addSubview(button)
                host.layoutIfNeeded()
                button.performPrimaryAction()
            } else {
                let sheet = UIAlertController(title: label("menu", "Avatar menüsü"), message: nil, preferredStyle: .actionSheet)
                items.forEach { key, fallback, _ in
                    sheet.addAction(UIAlertAction(title: label(key, fallback), style: .default) { [weak self] _ in
                        self?.companionMenuAction = key; self?.finishCompanionMenu()
                    })
                }
                sheet.addAction(UIAlertAction(title: label("cancel", "Kapat"), style: .cancel) { [weak self] _ in self?.finishCompanionMenu() })
                sheet.popoverPresentationController?.sourceView = host
                sheet.popoverPresentationController?.sourceRect = frame.isNull ? host.bounds : frame
                self.companionActionSheet = sheet
                self.bridge?.viewController?.present(sheet, animated: true)
            }
        }
    }

    @objc func dismissCompanionMenu(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { call.resolve(); return }
            if self.companionMenuRequest == call.getString("requestId") {
                self.companionMenuButton?.contextMenuInteraction?.dismissMenu()
                self.companionActionSheet?.dismiss(animated: true)
                self.finishCompanionMenu()
            }
            call.resolve()
        }
    }

    private func finishCompanionMenu() {
        companionMenuCall?.resolve(["action": companionMenuAction])
        companionMenuCall = nil
        companionMenuButton?.removeFromSuperview()
        companionMenuButton = nil
        companionActionSheet = nil
        companionMenuRequest = nil
        companionMenuAction = ""
    }

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
        // Undocked and split iPad keyboards do not consume the full window height.
        let docked = keyboard.maxY >= webView.bounds.maxY - 20 && overlap.width >= webView.bounds.width * 0.75
        keyboardVisible = !overlap.isNull && overlap.height > 1 && docked
        keyboardTop = keyboardVisible ? max(0, overlap.minY) : webView.bounds.height
        notifyListeners("keyboardGeometry", data: keyboardState)
        refreshVisibility()
    }

    override func load() {
        super.load()
        let center = NotificationCenter.default
        observers = [
            center.addObserver(forName: UIResponder.keyboardWillShowNotification, object: nil, queue: .main) { [weak self] notification in
                self?.updateKeyboardGeometry(notification)
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
        islandWidth = preferredWidth
        let height = island.heightAnchor.constraint(equalToConstant: 54)
        islandHeight = height
        let bottom = island.bottomAnchor.constraint(equalTo: host.safeAreaLayoutGuide.bottomAnchor, constant: -8)
        islandBottom = bottom
        NSLayoutConstraint.activate([
            preferredWidth,
            island.centerXAnchor.constraint(equalTo: host.safeAreaLayoutGuide.centerXAnchor),
            island.leadingAnchor.constraint(greaterThanOrEqualTo: host.safeAreaLayoutGuide.leadingAnchor, constant: 16),
            island.trailingAnchor.constraint(lessThanOrEqualTo: host.safeAreaLayoutGuide.trailingAnchor, constant: -16),
            bottom, height
        ])
        self.island = island
        updateLayout()
        return island
    }

    func updateLayout() {
        guard let island, let host = island.superview else { return }
        let tablet = host.bounds.width >= 700
        islandWidth?.constant = tablet ? min(560, max(420, host.bounds.width * 0.46)) : 300
        islandHeight?.constant = tablet ? 64 : 54
        islandBottom?.constant = tablet ? -12 : -8
        island.updateLayout(tablet: tablet)
    }

    private func refreshVisibility() {
        guard let island else { return }
        let visible = requestedVisible && !keyboardVisible && librarySearch == nil
        // Immediate visibility avoids stale animation completions hiding a newer state.
        island.isHidden = !visible
        island.isUserInteractionEnabled = visible
        if visible { island.superview?.bringSubviewToFront(island) }
    }
}

private final class CompanionMenuButton: UIButton {
    var onMenuDismissed: (() -> Void)?
    override func contextMenuInteraction(_ interaction: UIContextMenuInteraction, willEndFor configuration: UIContextMenuConfiguration, animator: UIContextMenuInteractionAnimating?) {
        super.contextMenuInteraction(interaction, willEndFor: configuration, animator: animator)
        if let animator { animator.addCompletion { [weak self] in self?.onMenuDismissed?() } }
        else { onMenuDismissed?() }
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
    private var tabletLayout = false
    private var selectedDestination = "home"
    private var lastUnreadCount = 0
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
        selectedDestination = active
        lastUnreadCount = unreadCount
        accessibilityLabel = incoming["navigation"] as? String ?? "Fortale gezinme"
        // Deactivate the previous constraint before enabling the next one.
        activeWidth.values.forEach { $0.isActive = false }
        for id in destinations {
            if let label = incoming[id] as? String, !label.isEmpty { labels[id] = label }
            guard let button = buttons[id], var config = button.configuration else { continue }
            let selected = id == active
            config.title = selected ? labels[id] : nil
            config.imagePadding = selected ? (tabletLayout ? 8 : 6) : 0
            config.baseForegroundColor = .white
            config.background.backgroundColor = selected ? .black : .clear
            config.background.cornerRadius = tabletLayout ? 26 : 21
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

    func updateLayout(tablet: Bool) {
        guard tabletLayout != tablet else { return }
        tabletLayout = tablet
        stack.spacing = tablet ? 6 : 4
        if #unavailable(iOS 26.0) { layer.cornerRadius = tablet ? 32 : 27 }
        for (id, button) in buttons {
            guard var config = button.configuration else { continue }
            config.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { attributes in
                var attributes = attributes
                attributes.font = .systemFont(ofSize: tablet ? 13 : 11, weight: .bold)
                return attributes
            }
            if id != "home" {
                config.image = UIImage(systemName: id == "books" ? "books.vertical" : "gearshape",
                    withConfiguration: UIImage.SymbolConfiguration(pointSize: tablet ? 22 : 18, weight: .semibold))
            }
            button.configuration = config
        }
        apply(active: selectedDestination, labels: [:], unreadCount: lastUnreadCount)
    }

    @objc private func tapped(_ sender: UIButton) {
        guard let action = sender.accessibilityIdentifier else { return }
        feedbackGenerator.impactOccurred()
        feedbackGenerator.prepare()
        onAction?(action)
    }

    fileprivate static func dialogCloseIcon() -> UIImage {
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

    fileprivate static func fortaleMark() -> UIImage {
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
