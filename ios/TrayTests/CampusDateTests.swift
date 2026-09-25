import Foundation
import Testing
@testable import Tray

// Ports of src/lib/dates.test.ts. The web and iOS apps have to agree on which
// day and which meal "now" is, so these are the same cases.

private func period(_ start: String?, _ end: String?, id: Int = 0) -> MealPeriod {
    MealPeriod(id: id, name: "", timeLabel: nil, startTime: start, endTime: end)
}

private let chase = [
    period("07:00", "10:45"), period("11:00", "15:00"), period("15:00", "17:00"),
    period("17:00", "20:00"), period("20:00", "21:00"), period("21:00", "00:00"),
]

@Suite struct CampusDateTests {
    @Test func usesChapelHillTimeNotUTC() {
        let lateNight = ISO8601DateFormatter().date(from: "2026-08-21T02:30:00Z")!
        #expect(CampusDate.today(now: lateNight) == "2026-08-20")
        #expect(CampusDate.timeOfDay(now: lateNight) == "22:30")
    }

    @Test func rollsOverAtLocalMidnight() {
        let f = ISO8601DateFormatter()
        #expect(CampusDate.today(now: f.date(from: "2026-08-21T03:59:00Z")!) == "2026-08-20")
        #expect(CampusDate.today(now: f.date(from: "2026-08-21T04:01:00Z")!) == "2026-08-21")
    }

    @Test func addsDaysAcrossBoundaries() {
        #expect(CampusDate.addDays("2026-08-20", 1) == "2026-08-21")
        #expect(CampusDate.addDays("2026-08-20", -1) == "2026-08-19")
        #expect(CampusDate.addDays("2026-08-31", 1) == "2026-09-01")
        #expect(CampusDate.addDays("2026-12-31", 1) == "2027-01-01")
        #expect(CampusDate.addDays("2028-02-28", 1) == "2028-02-29")
        #expect(CampusDate.range(from: "2026-08-20", count: 3) == ["2026-08-20", "2026-08-21", "2026-08-22"])
    }

    @Test func picksThePeriodBeingServed() {
        #expect(CampusDate.currentPeriodIndex(chase, now: "08:00") == 0)
        #expect(CampusDate.currentPeriodIndex(chase, now: "12:30") == 1)
        #expect(CampusDate.currentPeriodIndex(chase, now: "18:00") == 3)
        #expect(CampusDate.currentPeriodIndex(chase, now: "21:00") == 5)
        #expect(CampusDate.currentPeriodIndex(chase, now: "23:59") == 5)
    }

    @Test func treatsAfterMidnightAsClosed() {
        #expect(CampusDate.currentPeriodIndex(chase, now: "00:30") == 0)
    }

    @Test func keepsServingAPeriodThatRunsPastMidnight() {
        let lateBar = [period("11:00", "15:00"), period("21:00", "02:00")]
        #expect(CampusDate.currentPeriodIndex(lateBar, now: "23:30") == 1)
        #expect(CampusDate.currentPeriodIndex(lateBar, now: "01:30") == 1)
        #expect(CampusDate.currentPeriodIndex(lateBar, now: "03:00") == 0)
    }

    @Test func endsPeriodsExclusively() {
        #expect(CampusDate.currentPeriodIndex(chase, now: "15:00") == 2)
        #expect(CampusDate.currentPeriodIndex(chase, now: "17:00") == 3)
    }

    @Test func fallsForwardBetweenServicesAndBeforeTheDay() {
        #expect(CampusDate.currentPeriodIndex(chase, now: "10:50") == 1)
        #expect(CampusDate.currentPeriodIndex(chase, now: "05:00") == 0)
        #expect(CampusDate.currentPeriodIndex([], now: "12:00") == 0)
    }

    @Test func servingNowIsStrict() {
        let short = [period("07:00", "10:45"), period("11:00", "15:00"), period("21:00", "00:00")]
        #expect(CampusDate.servingPeriodIndex(short, now: "08:00") == 0)
        #expect(CampusDate.servingPeriodIndex(short, now: "23:00") == 2)
        #expect(CampusDate.servingPeriodIndex(short, now: "05:00") == nil)
        #expect(CampusDate.servingPeriodIndex(short, now: "10:50") == nil)
        #expect(CampusDate.servingPeriodIndex(short, now: "17:00") == nil)
    }

    @Test func formatsClockTimes() {
        #expect(CampusDate.formatClock("17:00") == "5:00pm")
        #expect(CampusDate.formatClock("14:30") == "2:30pm")
        #expect(CampusDate.formatClock("07:00") == "7:00am")
        #expect(CampusDate.formatClock("10:45") == "10:45am")
        #expect(CampusDate.formatClock("12:00") == "12:00pm")
        #expect(CampusDate.formatClock("00:00") == "12:00am")
        #expect(CampusDate.formatClock(nil) == nil)
        #expect(CampusDate.formatClock("5pm") == nil)
        #expect(CampusDate.formatClock("25:00") == nil)
    }

    @Test func normalisesPostgresTimes() {
        #expect(CampusDate.toHHMM("15:00:00") == "15:00")
        #expect(CampusDate.toHHMM("07:30:00") == "07:30")
        #expect(CampusDate.toHHMM("15:00") == "15:00")
        #expect(CampusDate.toHHMM(nil) == nil)
        #expect(CampusDate.toHHMM("3pm") == nil)
        #expect(CampusDate.toHHMM("") == nil)
    }

    @Test func databaseShapedTimesStartOnTheirFirstMinute() {
        let raw = [period(CampusDate.toHHMM("15:00:00"), CampusDate.toHHMM("17:00:00")),
                   period(CampusDate.toHHMM("17:00:00"), CampusDate.toHHMM("20:00:00"))]
        #expect(CampusDate.servingPeriodIndex(raw, now: "15:00") == 0)
        #expect(CampusDate.servingPeriodIndex(raw, now: "17:00") == 1)
    }
}
