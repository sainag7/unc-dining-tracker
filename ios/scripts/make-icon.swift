// Renders the App Store icon from the same geometry as public/icon.svg.
//
//   swift scripts/make-icon.swift Tray/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon.png
//
// Square and opaque on purpose: iOS applies its own corner mask, and App Store
// Connect rejects an icon with an alpha channel. The svg's rx=96 corner is
// therefore dropped, and the tray's opacities are pre-blended onto the navy.
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let size = 1024
let scale = CGFloat(size) / 512

func rgb(_ hex: UInt32, over base: UInt32? = nil, alpha: CGFloat = 1) -> CGColor {
    func parts(_ h: UInt32) -> (CGFloat, CGFloat, CGFloat) {
        (CGFloat((h >> 16) & 0xff) / 255, CGFloat((h >> 8) & 0xff) / 255, CGFloat(h & 0xff) / 255)
    }
    let (r, g, b) = parts(hex)
    guard let base else { return CGColor(srgbRed: r, green: g, blue: b, alpha: 1) }
    let (br, bg, bb) = parts(base)
    return CGColor(
        srgbRed: r * alpha + br * (1 - alpha),
        green: g * alpha + bg * (1 - alpha),
        blue: b * alpha + bb * (1 - alpha),
        alpha: 1
    )
}

let navy: UInt32 = 0x13294B
let carolina: UInt32 = 0x4B9CD3

let ctx = CGContext(
    data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0,
    space: CGColorSpace(name: CGColorSpace.sRGB)!,
    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
)!
// SVG's y axis points down.
ctx.translateBy(x: 0, y: CGFloat(size))
ctx.scaleBy(x: scale, y: -scale)

ctx.setFillColor(rgb(navy))
ctx.fill(CGRect(x: 0, y: 0, width: 512, height: 512))

func rounded(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ r: CGFloat) -> CGPath {
    CGPath(roundedRect: CGRect(x: x, y: y, width: w, height: h), cornerWidth: r, cornerHeight: r, transform: nil)
}

ctx.addPath(rounded(80, 128, 352, 256, 40))
ctx.setStrokeColor(rgb(carolina))
ctx.setLineWidth(24)
ctx.strokePath()

ctx.addPath(rounded(128, 176, 140, 160, 20))
ctx.setFillColor(rgb(carolina, over: navy, alpha: 0.9))
ctx.fillPath()

ctx.setFillColor(rgb(carolina, over: navy, alpha: 0.55))
ctx.addPath(rounded(296, 176, 88, 72, 16))
ctx.fillPath()
ctx.addPath(rounded(296, 264, 88, 72, 16))
ctx.fillPath()

let out = URL(fileURLWithPath: CommandLine.arguments[1])
let dest = CGImageDestinationCreateWithURL(out as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dest, ctx.makeImage()!, nil)
CGImageDestinationFinalize(dest)
print("wrote \(out.path)")
