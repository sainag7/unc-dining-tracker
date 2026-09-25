import SwiftUI

/// A ring that fills toward a goal and stops at a full turn; the overshoot is
/// carried by colour, not by winding past 100%.
struct ProgressRing<Center: View>: View {
    let value: Double
    let goal: Double
    var color: Color = .carolina
    var lineWidth: CGFloat = 8
    @ViewBuilder var center: () -> Center

    var body: some View {
        let progress = LogMath.goalProgress(value, goal: goal)
        ZStack {
            Circle().stroke(Color.surfaceAlt, lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: progress.pct / 100)
                .stroke(progress.over ? Color.danger : color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.snappy, value: progress.pct)
            center()
        }
    }
}
