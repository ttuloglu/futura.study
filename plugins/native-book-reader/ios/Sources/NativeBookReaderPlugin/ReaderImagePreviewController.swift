import UIKit
import ISVImageScrollView

// This overlay retains the current UIPageViewController and its pagination state.
final class ReaderImagePreviewController: UIViewController, UIScrollViewDelegate, UIGestureRecognizerDelegate {
    var onClose: (() -> Void)?
    private let image: UIImage
    private let imageTitle: String
    private let closeLabel: String
    private let shareLabel: String
    private let panel = UIView()
    private let scroll = ISVImageScrollView()
    private let imageView = UIImageView()
    private let shareButton = UIButton(type: .system)
    private var closing = false

    init(image: UIImage, title: String, closeLabel: String, shareLabel: String) {
        self.image = image
        self.imageTitle = title
        self.closeLabel = closeLabel
        self.shareLabel = shareLabel
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .overFullScreen
        modalTransitionStyle = .crossDissolve
        overrideUserInterfaceStyle = .dark
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    override func viewDidLoad() {
        super.viewDidLoad()
        let cream = UIColor(red: 218 / 255, green: 211 / 255, blue: 198 / 255, alpha: 1)
        view.backgroundColor = UIColor.black.withAlphaComponent(0.68)
        view.accessibilityViewIsModal = true
        let blur = UIVisualEffectView(effect: UIBlurEffect(style: .systemUltraThinMaterialDark))
        blur.frame = view.bounds
        blur.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        blur.isUserInteractionEnabled = false
        view.addSubview(blur)
        panel.translatesAutoresizingMaskIntoConstraints = false
        panel.backgroundColor = UIColor(red: 37 / 255, green: 41 / 255, blue: 46 / 255, alpha: 1)
        panel.layer.cornerRadius = 26
        panel.layer.cornerCurve = .continuous
        panel.layer.borderWidth = 1
        panel.layer.borderColor = cream.withAlphaComponent(0.2).cgColor
        view.addSubview(panel)

        let logo = UIImageView(image: Self.logo())
        logo.contentMode = .scaleAspectFit
        logo.widthAnchor.constraint(equalToConstant: 28).isActive = true
        let title = UILabel()
        title.text = imageTitle
        title.textColor = cream
        title.font = .systemFont(ofSize: 17, weight: .semibold)
        title.lineBreakMode = .byTruncatingTail
        let close = UIButton(type: .custom)
        close.setImage(UIImage(systemName: "xmark", withConfiguration: UIImage.SymbolConfiguration(pointSize: 17, weight: .medium)), for: .normal)
        close.tintColor = UIColor(white: 23 / 255, alpha: 1)
        close.backgroundColor = .white
        close.layer.cornerRadius = 18
        close.layer.shadowColor = UIColor.black.cgColor
        close.layer.shadowOpacity = 0.18
        close.layer.shadowRadius = 5
        close.layer.shadowOffset = CGSize(width: 0, height: 2)
        close.accessibilityLabel = closeLabel
        close.accessibilityIdentifier = "fortale.reader.image.close"
        close.widthAnchor.constraint(equalToConstant: 36).isActive = true
        close.heightAnchor.constraint(equalToConstant: 36).isActive = true
        close.addTarget(self, action: #selector(closePreview), for: .touchUpInside)
        shareButton.setImage(UIImage(systemName: "square.and.arrow.up", withConfiguration: UIImage.SymbolConfiguration(pointSize: 19, weight: .medium)), for: .normal)
        shareButton.tintColor = cream
        shareButton.widthAnchor.constraint(equalToConstant: 36).isActive = true
        shareButton.heightAnchor.constraint(equalToConstant: 36).isActive = true
        shareButton.accessibilityLabel = shareLabel
        shareButton.accessibilityIdentifier = "fortale.reader.image.share"
        shareButton.addTarget(self, action: #selector(shareImage), for: .touchUpInside)
        let header = UIStackView(arrangedSubviews: [logo, title, shareButton, close])
        header.spacing = 10
        header.alignment = .center
        header.heightAnchor.constraint(equalToConstant: 44).isActive = true

        scroll.delegate = self
        scroll.minimumZoomScale = 1
        scroll.maximumZoomScale = 3
        scroll.showsHorizontalScrollIndicator = false
        scroll.showsVerticalScrollIndicator = false
        scroll.layer.cornerRadius = 18
        scroll.clipsToBounds = true
        imageView.image = image
        imageView.contentMode = .scaleAspectFit
        imageView.accessibilityLabel = imageTitle
        imageView.isAccessibilityElement = true
        // ISV owns image fitting, pinch/double-tap zoom and rotation geometry.
        scroll.imageView = imageView
        let stack = UIStackView(arrangedSubviews: [header, scroll])
        stack.axis = .vertical
        stack.spacing = 18
        stack.translatesAutoresizingMaskIntoConstraints = false
        panel.addSubview(stack)
        NSLayoutConstraint.activate([
            panel.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 12),
            panel.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -12),
            panel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
            panel.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -12),
            stack.topAnchor.constraint(equalTo: panel.topAnchor, constant: 12),
            stack.bottomAnchor.constraint(equalTo: panel.bottomAnchor, constant: -12),
            stack.leadingAnchor.constraint(equalTo: panel.leadingAnchor, constant: 12),
            stack.trailingAnchor.constraint(equalTo: panel.trailingAnchor, constant: -12)
        ])
        let backdrop = UITapGestureRecognizer(target: self, action: #selector(closePreview))
        backdrop.delegate = self
        view.addGestureRecognizer(backdrop)
    }

    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
        !(touch.view?.isDescendant(of: panel) ?? false)
    }
    func viewForZooming(in scrollView: UIScrollView) -> UIView? { imageView }
    @objc private func closePreview() {
        guard !closing, presentedViewController == nil else { return }
        closing = true
        dismiss(animated: true) { [weak self] in self?.onClose?() }
    }
    @objc private func shareImage() {
        guard presentedViewController == nil else { return }
        let activity = UIActivityViewController(activityItems: [image], applicationActivities: nil)
        activity.popoverPresentationController?.sourceView = shareButton
        activity.popoverPresentationController?.sourceRect = shareButton.bounds
        present(activity, animated: true)
    }
    private static func logo() -> UIImage {
        UIGraphicsImageRenderer(size: CGSize(width: 28, height: 28)).image { _ in
            let heights: [CGFloat] = [9, 15, 19, 15, 9]
            for index in 0..<5 {
                (index == 2 ? UIColor(red: 192 / 255, green: 66 / 255, blue: 53 / 255, alpha: 1) : .white).setFill()
                UIBezierPath(roundedRect: CGRect(x: 5 + CGFloat(index) * 4, y: (28 - heights[index]) / 2, width: 2, height: heights[index]), cornerRadius: 1).fill()
            }
        }
    }
}
