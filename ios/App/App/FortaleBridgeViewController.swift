import Capacitor
import WebKit

final class FortaleBridgeViewController: CAPBridgeViewController {
    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let configuration = super.webViewConfiguration(for: instanceConfiguration)
        configuration.userContentController.addUserScript(WKUserScript(
            source: "document.documentElement.classList.add('native-ios'); document.documentElement.dataset.fortaleNativeFloatIsland = 'available';",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        return configuration
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        // Keep native controls beside WKWebView, outside its managed subviews.
        guard let webView else { return }
        let host = UIView()
        host.backgroundColor = .black
        webView.translatesAutoresizingMaskIntoConstraints = false
        host.addSubview(webView)
        view = host
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: host.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: host.trailingAnchor),
            webView.topAnchor.constraint(equalTo: host.topAnchor),
            webView.bottomAnchor.constraint(equalTo: host.bottomAnchor)
        ])
        statusBarStyle = .lightContent
        extendedLayoutIncludesOpaqueBars = true
        edgesForExtendedLayout = .all
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.automaticallyAdjustsScrollIndicatorInsets = false
        webView.scrollView.contentInset = .zero
        webView.scrollView.scrollIndicatorInsets = .zero
        bridge?.registerPluginInstance(NativeFloatIslandPlugin())
    }
}
