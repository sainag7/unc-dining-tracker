import SwiftUI

/// Selection as a filled pill in a groove. Used for the hall and meal-period
/// switchers — every option visible, one filled. Port of
/// src/components/ui/segmented-control.tsx.
struct PillPicker<Value: Hashable>: View {
    struct Option: Identifiable {
        let value: Value
        let label: String
        /// The "serving now" dot.
        var live = false
        var id: Value { value }
    }

    let options: [Option]
    @Binding var selection: Value
    @Namespace private var pill

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 2) {
                ForEach(options) { option in
                    let selected = option.value == selection
                    Button {
                        withAnimation(.snappy(duration: 0.2)) { selection = option.value }
                    } label: {
                        HStack(spacing: 5) {
                            if option.live {
                                Circle()
                                    .fill(selected ? Color.accentFg : Color.carolina)
                                    .frame(width: 6, height: 6)
                                    .accessibilityLabel("Serving now")
                            }
                            Text(option.label)
                                .font(.subheadline.weight(selected ? .bold : .medium))
                                .lineLimit(1)
                        }
                        .padding(.horizontal, 14)
                        .frame(minHeight: 36)
                        .foregroundStyle(selected ? Color.accentFg : Color.textMid)
                        .background {
                            if selected {
                                Capsule().fill(Color.carolina).matchedGeometryEffect(id: "pill", in: pill)
                            }
                        }
                        .contentShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(selected ? .isSelected : [])
                }
            }
            .padding(3)
            .background(Color.surfaceAlt, in: Capsule())
        }
        .scrollClipDisabled()
    }
}
