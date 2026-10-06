import { describe, expect, it } from "vitest";
import {
  dayKey,
  formatSlotDay,
  formatSlotFull,
  formatSlotTime,
  formatSlotTitle,
  groupSlotsByDay,
  zonedTimeToUtc,
} from "@/lib/time";

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
});
