import Foundation

/// Every "today" in this app is Chapel Hill's today. Port of src/lib/dates.ts.
///
/// The device's own time zone would push an 8pm ET dinner onto tomorrow's log
/// for anyone whose phone is set elsewhere, so all date resolution goes through
/// here.
enum CampusDate {
    static let timeZone = TimeZone(identifier: "America/New_York")!

    private static var calendar: Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        return cal
    }

    /// Current date at UNC as "YYYY-MM-DD".
    static func today(now: Date = .now) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: now)
        return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
    }

    /// Current wall-clock time at UNC as "HH:MM" (24h).
    static func timeOfDay(now: Date = .now) -> String {
        let c = calendar.dateComponents([.hour, .minute], from: now)
        return String(format: "%02d:%02d", c.hour!, c.minute!)
    }

    /// Adds whole days to a "YYYY-MM-DD" string, in UTC so no zone can shift it.
    static func addDays(_ iso: String, _ days: Int) -> String {
        guard let date = utcDate(iso) else { return iso }
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC")!
        let moved = utc.date(byAdding: .day, value: days, to: date)!
        let c = utc.dateComponents([.year, .month, .day], from: moved)
        return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
    }

    /// `[start, start+1, …]` for `count` days.
    static func range(from start: String, count: Int) -> [String] {
        (0..<count).map { addDays(start, $0) }
    }

    /// Index of the period being served right now, or nil between services.
    ///
    /// Kept strict and separate from tab selection: the "serving now" badge must
    /// never appear at 5am just because Breakfast is the sensible tab to open on.
    static func servingPeriodIndex(_ periods: [MealPeriod], now hhmm: String = timeOfDay()) -> Int? {
        periods.firstIndex { p in
            guard let start = p.startTime, let end = p.endTime else { return false }
            // A period ending at or before its start crosses midnight (9pm-2am).
            return end <= start
                ? hhmm >= start || hhmm < end
                : hhmm >= start && hhmm < end
        }
    }

    /// Which meal period to open on: the one being served, else the next to
    /// start today, else the first of the day.
    static func currentPeriodIndex(_ periods: [MealPeriod], now hhmm: String = timeOfDay()) -> Int {
        if periods.isEmpty { return 0 }
        if let serving = servingPeriodIndex(periods, now: hhmm) { return serving }
        return periods.firstIndex { p in p.startTime.map { hhmm < $0 } ?? false } ?? 0
    }

    /// Postgres `time` ("15:00:00") → "15:00". Comparing the two forms as strings
    /// is wrong at the edges — "15:00" >= "15:00:00" is false — so everything is
    /// normalised on the way in.
    static func toHHMM(_ raw: String?) -> String? {
        guard let raw, let match = raw.wholeMatch(of: /(\d{2}):(\d{2})(?::\d{2})?/) else { return nil }
        return "\(match.1):\(match.2)"
    }

    /// "17:00" → "5:00pm".
    static func formatClock(_ raw: String?) -> String? {
        guard let hhmm = toHHMM(raw), let hour = Int(hhmm.prefix(2)), hour <= 23 else { return nil }
        let minute = hhmm.suffix(2)
        let hour12 = hour % 12 == 0 ? 12 : hour % 12
        return "\(hour12):\(minute)\(hour < 12 ? "am" : "pm")"
    }

    /// "2026-08-21" → a formatted string, resolved in UTC so the day never shifts.
    static func format(_ iso: String, _ style: Date.FormatStyle) -> String {
        guard let date = utcDate(iso) else { return iso }
        var style = style
        style.timeZone = TimeZone(identifier: "UTC")!
        return date.formatted(style)
    }

    private static func utcDate(_ iso: String) -> Date? {
        let parts = iso.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC")!
        return utc.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    }
}
