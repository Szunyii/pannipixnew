import { describe, expect, it } from "vitest";
import {
  dayKey,
  formatReceivedAt,
  formatSlotDay,
  formatSlotFull,
  formatSlotTime,
  formatSlotTitle,
  groupSlotsByDay,
  zonedTimeToUtc,
} from "@/lib/time";

// These constants are UTC instants, named after their Budapest wall-clock time (OCT_15_00_30 is 00:30 on 15 October
// in Budapest). tests/setup.ts pins TZ=UTC, so any accidental use of the machine's time zone shows up here.
// 2026-10-14 is a Wednesday in summer time (UTC+2); 2026-11-03 a Tuesday in winter time (UTC+1).
const OCT_14_10_00 = "2026-10-14T08:00:00.000Z";
const NOV_03_14_30 = "2026-11-03T13:30:00.000Z";
const OCT_15_00_30 = "2026-10-14T22:30:00.000Z";

describe("Budapest formatting", () => {
  it("formats day, time, full and admin labels in Hungarian", () => {
    expect(formatSlotDay(OCT_14_10_00)).toBe("okt. 14., szerda");
    expect(formatSlotTime(NOV_03_14_30)).toBe("14:30");
    expect(formatSlotFull(OCT_14_10_00)).toBe("2026. október 14., szerda 10:00");
    expect(formatSlotTitle(OCT_14_10_00)).toBe("2026. 10. 14. (szerda) 10:00");
  });

  it("puts a slot on its Budapest day, not its UTC day", () => {
    expect(dayKey(OCT_15_00_30)).toBe("2026-10-15");
    // 22:30 UTC on the 14th is already the 15th in Budapest, so the day label, date and weekday must follow.
    expect(formatSlotDay(OCT_15_00_30)).toBe("okt. 15., csütörtök");
    expect(formatSlotTitle(OCT_15_00_30)).toBe("2026. 10. 15. (csütörtök) 00:30");
  });

  it("accepts a Date as well as an ISO string", () => {
    expect(dayKey(new Date(OCT_15_00_30))).toBe("2026-10-15");
    expect(formatSlotTime(new Date(NOV_03_14_30))).toBe("14:30");
  });
});

describe("zonedTimeToUtc", () => {
  it("reads a wall-clock time as Budapest time in both summer and winter", () => {
    expect(zonedTimeToUtc("2026-10-14", "10:00")).toBe(OCT_14_10_00);
    expect(zonedTimeToUtc("2026-11-03", "14:30")).toBe(NOV_03_14_30);
  });

  it("reads times on the summer-time change days correctly", () => {
    expect(zonedTimeToUtc("2026-03-29", "01:30")).toBe("2026-03-29T00:30:00.000Z"); // still winter time
    expect(zonedTimeToUtc("2026-03-29", "03:30")).toBe("2026-03-29T01:30:00.000Z"); // summer time
    expect(zonedTimeToUtc("2026-10-25", "01:30")).toBe("2026-10-24T23:30:00.000Z"); // still summer time
    expect(zonedTimeToUtc("2026-10-25", "03:30")).toBe("2026-10-25T02:30:00.000Z"); // winter time
  });

  it("moves a skipped spring time forward and reads a repeated autumn time as winter time", () => {
    expect(zonedTimeToUtc("2026-03-29", "02:30")).toBe("2026-03-29T01:30:00.000Z"); // skipped: 03:30 summer time
    expect(zonedTimeToUtc("2026-10-25", "02:30")).toBe("2026-10-25T01:30:00.000Z"); // happens twice: the later, winter-time one
  });
});

describe("groupSlotsByDay", () => {
  it("groups by Budapest day, earliest first", () => {
    const days = groupSlotsByDay([
      { id: 3, startsAt: OCT_15_00_30 },
      { id: 2, startsAt: "2026-10-14T12:00:00.000Z" },
      { id: 1, startsAt: OCT_14_10_00 },
    ]);
    expect(days.map((d) => d.key)).toEqual(["2026-10-14", "2026-10-15"]);
    expect(days[0].label).toBe("okt. 14., szerda");
    expect(days[0].slots.map((s) => [s.id, s.time])).toEqual([
      [1, "10:00"],
      [2, "14:00"],
    ]);
    expect(days[1].slots[0]).toEqual({
      id: 3,
      startsAt: OCT_15_00_30,
      time: "00:30",
      label: "2026. október 15., csütörtök 00:30",
    });
  });

  it("leaves the caller's array in its original order", () => {
    const slots = [
      { id: 3, startsAt: OCT_15_00_30 },
      { id: 2, startsAt: "2026-10-14T12:00:00.000Z" },
      { id: 1, startsAt: OCT_14_10_00 },
    ];
    const before = structuredClone(slots);
    groupSlotsByDay(slots);
    expect(slots).toEqual(before);
  });
});

describe("formatReceivedAt", () => {
  it("says today and yesterday by Budapest days, with the time", () => {
    // Now is 00:30 on 15 October in Budapest, still the 14th in UTC.
    expect(formatReceivedAt("2026-10-14T22:10:00.000Z", OCT_15_00_30)).toBe("ma 00:10");
    expect(formatReceivedAt("2026-10-14T21:50:00.000Z", OCT_15_00_30)).toBe("tegnap 23:50");
  });

  it("gives an older booking's date, with the year when it is from another year", () => {
    expect(formatReceivedAt("2026-10-13T08:00:00.000Z", OCT_15_00_30)).toBe("okt. 13.");
    expect(formatReceivedAt("2025-10-13T08:00:00.000Z", OCT_15_00_30)).toBe("2025. okt. 13.");
  });

  it("finds yesterday across a month, a year and the autumn clock change", () => {
    expect(formatReceivedAt("2026-02-28T12:00:00.000Z", "2026-03-01T12:00:00.000Z")).toBe("tegnap 13:00");
    expect(formatReceivedAt("2025-12-31T12:00:00.000Z", "2026-01-01T12:00:00.000Z")).toBe("tegnap 13:00");
    // 00:10 on 25 October (summer time), seen at 00:30 on the 26th (winter time): 25 hours apart, yet yesterday.
    expect(formatReceivedAt("2026-10-24T22:10:00.000Z", "2026-10-25T23:30:00.000Z")).toBe("tegnap 00:10");
  });
});
