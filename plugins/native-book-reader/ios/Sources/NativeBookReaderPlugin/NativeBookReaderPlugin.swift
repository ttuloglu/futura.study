import Foundation
import Capacitor
import UIKit

@objc(NativeBookReaderPlugin)
public class NativeBookReaderPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeBookReaderPlugin"
    public let jsName = "NativeBookReader"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "openBook", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "closeBook", returnType: CAPPluginReturnPromise)
    ]

    private var activeReaderVC: NativeReaderViewController?
    private var currentCall: CAPPluginCall?

    @objc func openBook(_ call: CAPPluginCall) {
        guard let pagesData = call.getArray("pages", [String: Any].self), !pagesData.isEmpty else {
            call.reject("Kitap sayfaları bulunamadı")
            return
        }

        let title = call.getString("title") ?? "Kitap"
        let bookType = call.getString("bookType") ?? "novel"
        let themeName = call.getString("theme") ?? "sepia"
        let initialPageIndex = call.getInt("initialPageIndex") ?? 0

        var pages: [BookPageData] = []
        for (index, dict) in pagesData.enumerated() {
            let pageTitle = dict["title"] as? String
            let chapterTitle = dict["chapterTitle"] as? String
            let contentHtml = dict["contentHtml"] as? String ?? ""
            let plainText = dict["plainText"] as? String
            let imageSrc = dict["imageSrc"] as? String
            let imageAlt = dict["imageAlt"] as? String
            let pageNum = dict["pageNumber"] as? Int ?? (index + 1)

            pages.append(BookPageData(
                pageNumber: pageNum,
                sourceIndex: index,
                chapterTitle: chapterTitle,
                title: pageTitle,
                contentHtml: contentHtml,
                plainText: plainText,
                imageSrc: imageSrc,
                imageAlt: imageAlt,
                audioSrc: dict["audioSrc"] as? String
            ))
        }

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            guard self.activeReaderVC == nil else { call.reject("Kitap okuyucu zaten açık"); return }
            self.currentCall = call

            let readerVC = NativeReaderViewController(
                title: title,
                bookType: bookType,
                pages: pages,
                initialPageIndex: initialPageIndex,
                initialTheme: themeName,
                autoPlay: call.getBool("autoPlay") ?? false,
                backgroundAudioSrc: call.getString("backgroundAudioSrc"),
                initialFontScale: call.getDouble("fontScale") ?? 1,
                initialSourceIndex: call.getInt("initialSourceIndex"),
                initialContentOffset: call.getInt("initialContentOffset") ?? 0
            )

            readerVC.companionInitiallyHidden = call.getBool("companionHidden") ?? false
            readerVC.companionLabels = call.getObject("companionLabels") as? [String: String] ?? [:]
            readerVC.companionAvatar = call.getString("companionAvatar") ?? "dost"
            readerVC.companionLegendary = call.getBool("companionLegendary") ?? false

            let sessionId = call.getString("sessionId") ?? ""
            readerVC.onPosition = { [weak self] position in
                var event = position; event["sessionId"] = sessionId
                self?.notifyListeners("readingProgress", data: event)
            }
            readerVC.modalPresentationStyle = .fullScreen
            readerVC.modalTransitionStyle = .coverVertical
            readerVC.onDismiss = { [weak self, weak readerVC] lastIndex in
                self?.currentCall?.resolve([
                    "closed": true,
                    "companionHidden": readerVC?.companionIsHidden ?? false,
                    "lastPageIndex": lastIndex,
                    "action": readerVC?.closeAction ?? "close",
                    "theme": readerVC?.themeValue ?? themeName,
                    "fontScale": readerVC?.fontScaleValue ?? 1
                ])
                self?.currentCall = nil
                self?.activeReaderVC = nil
            }

            self.activeReaderVC = readerVC
            self.bridge?.viewController?.present(readerVC, animated: true)
        }
    }

    @objc func closeBook(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            if let active = self?.activeReaderVC {
                active.closeReader {
                    call.resolve(["closed": true])
                }
            } else {
                call.resolve(["closed": true])
            }
        }
    }
}
