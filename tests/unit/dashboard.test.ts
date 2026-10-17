import * as qs from "qs-esm";
import { describe, expect, it } from "vitest";
import { availability, countActiveByDesign } from "@/lib/booking-rules";
import {
  BOOKING_VIEWS,
  adminListUrl,
  bookedLabel,
  bookingUrl,
  designBookingsUrl,
  designsUrl,
  rankBookedDesigns,
  viewListUrl,
} from "@/lib/dashboard";

// 12:00 on Friday 16 October 2026 in Budapest (summer time, UTC+2).
const NOW = new Date("2026-10-16T10:00:00.000Z");

describe("BOOKING_VIEWS", () => {
  it("lists pending bookings, oldest first", () => {
    expect(BOOKING_VIEWS.pending.where(NOW)).toEqual({ status: { equals: "pending" } });
    expect(BOOKING_VIEWS.pending.sort).toBe("createdAt");
  });

  it("lists confirmed bookings without a slot, oldest first", () => {
    expect(BOOKING_VIEWS.unscheduled.where(NOW)).toEqual({
      and: [{ status: { equals: "confirmed" } }, { slot: { exists: false } }],
    });
    expect(BOOKING_VIEWS.unscheduled.sort).toBe("createdAt");
  });

  it("lists pending and confirmed bookings whose slot is still ahead, soonest first", () => {
    expect(BOOKING_VIEWS.upcoming.where(NOW)).toEqual({
      and: [
        { status: { in: ["pending", "confirmed"] } },
        { slotStartsAt: { greater_than: "2026-10-16T10:00:00.000Z" } },
      ],
    });
    expect(BOOKING_VIEWS.upcoming.sort).toBe("slotStartsAt");
  });

  it("lists every booking, newest first", () => {
    expect(BOOKING_VIEWS.recent.where(NOW)).toEqual({});
    expect(BOOKING_VIEWS.recent.sort).toBe("-createdAt");
  });

  it("dates a row by when it came in, or by its slot on the upcoming list", () => {
    // In at 19:05 on Thursday; booked for 10:00 on Tuesday 20 October.
    const booking = { createdAt: "2026-10-15T17:05:00.000Z", slotStartsAt: "2026-10-20T08:00:00.000Z" };
    expect(BOOKING_VIEWS.pending.when(booking, NOW)).toBe("beérkezett tegnap 19:05");
    expect(BOOKING_VIEWS.unscheduled.when(booking, NOW)).toBe("beérkezett tegnap 19:05");
    expect(BOOKING_VIEWS.recent.when(booking, NOW)).toBe("tegnap 19:05");
    expect(BOOKING_VIEWS.upcoming.when(booking, NOW)).toBe("okt. 20., kedd 10:00");
  });

  it("has a heading and an empty-state line for every list", () => {
    for (const view of Object.values(BOOKING_VIEWS)) {
      expect(view.title).not.toBe("");
      expect(view.empty).not.toBe("");
    }
  });
});

describe("bookedLabel", () => {
  const label = (rule: Parameters<typeof availability>[0], active: number) =>
    bookedLabel(availability(rule, active), active);

  it("marks a full design as sold out, with its bookings and its limit", () => {
    expect(label({ rule: "single" }, 1)).toEqual({ text: "Elkelt · 1/1", soldOut: true });
    expect(label({ rule: "limited", limit: 3 }, 3)).toEqual({ text: "Elkelt · 3/3", soldOut: true });
  });

  it("shows the true count when the limit was lowered under the bookings", () => {
    expect(label({ rule: "limited", limit: 3 }, 4)).toEqual({ text: "Elkelt · 4/3", soldOut: true });
  });

  it("counts a limited design's bookings against its limit while it has room", () => {
    expect(label({ rule: "limited", limit: 3 }, 2)).toEqual({ text: "2 / 3 alkalom", soldOut: false });
  });

  it("counts an unlimited design's bookings", () => {
    expect(label({ rule: "unlimited" }, 4)).toEqual({ text: "4 foglalás", soldOut: false });
  });
});

describe("rankBookedDesigns", () => {
  const booking = (design: unknown, status: string, createdAt: string) => ({ design, status, createdAt });

  it("puts the most recently booked design first, with its number of active bookings", () => {
    const ranked = rankBookedDesigns([
      booking(1, "completed", "2026-10-01T10:00:00.000Z"),
      booking(2, "pending", "2026-10-15T10:00:00.000Z"),
      booking(1, "confirmed", "2026-10-12T10:00:00.000Z"),
    ]);
    expect(ranked).toEqual([
      { id: 2, active: 1, lastBookedAt: "2026-10-15T10:00:00.000Z" },
      { id: 1, active: 2, lastBookedAt: "2026-10-12T10:00:00.000Z" },
    ]);
  });

  it("leaves out rejected and cancelled bookings, and the designs that only have those", () => {
    const ranked = rankBookedDesigns([
      booking(1, "rejected", "2026-10-15T10:00:00.000Z"),
      booking(2, "cancelled", "2026-10-15T11:00:00.000Z"),
      booking(2, "pending", "2026-10-10T10:00:00.000Z"),
    ]);
    expect(ranked).toEqual([{ id: 2, active: 1, lastBookedAt: "2026-10-10T10:00:00.000Z" }]);
  });

  it("keeps the twelve most recently booked", () => {
    const bookings = Array.from({ length: 14 }, (_, i) =>
      booking(i + 1, "pending", new Date(Date.UTC(2026, 9, 1 + i)).toISOString()),
    );
    const ranked = rankBookedDesigns(bookings);
    expect(ranked).toHaveLength(12);
    expect(ranked[0].id).toBe(14);
    expect(ranked.at(-1)?.id).toBe(3);
  });

  it("reads a populated design as well as an id", () => {
    expect(rankBookedDesigns([booking({ id: 5 }, "pending", "2026-10-15T10:00:00.000Z")])).toEqual([
      { id: 5, active: 1, lastBookedAt: "2026-10-15T10:00:00.000Z" },
    ]);
  });

  it("counts each design's active bookings the way the site's sold-out tag does", () => {
    // The cards' "Elkelt · n/m" and the site's "Elkelt" must agree, so the two counts must match.
    const bookings = [
      booking(1, "pending", "2026-10-01T10:00:00.000Z"),
      booking(1, "rejected", "2026-10-02T10:00:00.000Z"),
      booking(2, "completed", "2026-10-03T10:00:00.000Z"),
      booking({ id: 2 }, "confirmed", "2026-10-04T10:00:00.000Z"),
      booking(null, "pending", "2026-10-05T10:00:00.000Z"),
    ];
    const ranked = new Map(rankBookedDesigns(bookings).map(({ id, active }): [number, number] => [id, active]));
    expect(ranked).toEqual(countActiveByDesign(bookings));
  });
});

describe("admin links", () => {
  it("writes a filter the way the admin's list view reads it back", () => {
    const url = adminListUrl("/admin", "bookings", {
      where: { and: [{ status: { equals: "confirmed" } }, { slot: { exists: false } }] },
      sort: "createdAt",
    });
    expect(decodeURIComponent(url)).toBe(
      "/admin/collections/bookings?where[and][0][status][equals]=confirmed&where[and][1][slot][exists]=false&sort=createdAt",
    );
    // The admin parses its URL with qs-esm; the values come back as strings, which Payload's query reads as usual.
    const [path, query] = url.split("?");
    expect(path).toBe("/admin/collections/bookings");
    expect(qs.parse(query)).toEqual({
      where: { and: [{ status: { equals: "confirmed" } }, { slot: { exists: "false" } }] },
      sort: "createdAt",
    });
  });

  it("narrows the designs list to the given designs", () => {
    expect(decodeURIComponent(designsUrl("/admin", [3, 7]))).toBe(
      "/admin/collections/designs?where[id][in][0]=3&where[id][in][1]=7",
    );
  });

  it("leaves the query off when there is nothing to filter or sort", () => {
    expect(adminListUrl("/admin", "bookings", { where: {} })).toBe("/admin/collections/bookings");
  });

  it("links a list's full view, a design's bookings and a booking's page", () => {
    expect(decodeURIComponent(viewListUrl("/admin", "pending", NOW))).toBe(
      "/admin/collections/bookings?where[status][equals]=pending&sort=createdAt",
    );
    expect(decodeURIComponent(designBookingsUrl("/admin", 5))).toBe(
      "/admin/collections/bookings?where[design][equals]=5&sort=-createdAt",
    );
    expect(bookingUrl("/admin", 42)).toBe("/admin/collections/bookings/42");
  });
});
