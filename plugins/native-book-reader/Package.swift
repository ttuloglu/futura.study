// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "FortaleNativeBookReader",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "FortaleNativeBookReader",
            targets: ["NativeBookReaderPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0"),
        .package(url: "https://github.com/yuriiik/ISVImageScrollView.git", from: "0.3.0")
    ],
    targets: [
        .target(
            name: "NativeBookReaderPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "ISVImageScrollView", package: "ISVImageScrollView")
            ],
            path: "ios/Sources/NativeBookReaderPlugin")
    ]
)
