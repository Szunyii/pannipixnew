import { describe, expect, it } from "vitest";
import {
  ACTIVE_STATUSES,
  RELEASED_STATUSES,
  STATUS_LABELS,
  availability,
  effectiveLimit,
  isActiveStatus,
  isReleasedStatus,
  lowestFreeSeat,
  nextSeat,
  relationId,
} from "@/lib/booking-rules";

describe("effectiveLimit", () => {
  it("is 1 for single, the set number for limited and none for unlimited", () => {
    expect(effectiveLimit({ rule: "single" })).toBe(1);
    expect(effectiveLimit({ rule: "limited", limit: 3 })).toBe(3);
    expect(effectiveLimit({ rule: "unlimited", limit: 3 })).toBeNull();
  });

  it("falls back to 1 when a limited collection has no number", () => {
    expect(effectiveLimit({ rule: "limited", limit: null })).toBe(1);
  });

  it("rounds a fractional limit down and never goes below 1", () => {
    expect(effectiveLimit({ rule: "limited", limit: 2.9 })).toBe(2);
    expect(effectiveLimit({ rule: "limited", limit: 0 })).toBe(1);
    expect(effectiveLimit({ rule: "limited", limit: -4 })).toBe(1);
  });

  it.each([NaN, Infinity])("fails closed on a limit of %s", (limit) => {
    expect(effectiveLimit({ rule: "limited", limit })).toBe(1);
  });

  it("ignores the limit of a single collection", () => {
    expect(effectiveLimit({ rule: "single", limit: 3 })).toBe(1);
  });
});

describe("availability", () => {
  it("counts down the remaining bookings and sells out at zero", () => {
    expect(availability({ rule: "single" }, 0)).toEqual({ rule: "single", limit: 1, remaining: 1, soldOut: false });
    expect(availability({ rule: "single" }, 1)).toEqual({ rule: "single", limit: 1, remaining: 0, soldOut: true });
    expect(availability({ rule: "limited", limit: 3 }, 1)).toEqual({ rule: "limited", limit: 3, remaining: 2, soldOut: false });
  });

  it("never goes below zero when a limit was lowered under the active bookings", () => {
    expect(availability({ rule: "limited", limit: 3 }, 5)).toEqual({ rule: "limited", limit: 3, remaining: 0, soldOut: true });
  });

  it("never sells out an unlimited design", () => {
    expect(availability({ rule: "unlimited" }, 40)).toEqual({ rule: "unlimited", limit: null, remaining: null, soldOut: false });
  });
});

describe("lowestFreeSeat", () => {
  it("returns the smallest seat nobody holds", () => {
    expect(lowestFreeSeat([], 3)).toBe(1);
    expect(lowestFreeSeat([1, 3], 3)).toBe(2);
    expect(lowestFreeSeat([null, 2], 2)).toBe(1);
  });

  it("returns null when every seat is taken", () => {
    expect(lowestFreeSeat([1, 2, 3], 3)).toBeNull();
  });

  it("handles a design with a single seat", () => {
    expect(lowestFreeSeat([], 1)).toBe(1);
    expect(lowestFreeSeat([1], 1)).toBeNull();
  });

  it("finds the free seat at either end", () => {
    expect(lowestFreeSeat([1, 2], 3)).toBe(3);
    expect(lowestFreeSeat([2, 3], 3)).toBe(1);
  });

  it("ignores seats above the limit and repeated seats", () => {
    expect(lowestFreeSeat([3, 4], 2)).toBe(1);
    expect(lowestFreeSeat([3, 1, 1], 3)).toBe(2);
  });

  it("takes any iterable", () => {
    expect(lowestFreeSeat(new Set([2, 1]), 3)).toBe(3);
  });
});

describe("nextSeat", () => {
  it("takes the lowest free seat while the design has room", () => {
    expect(nextSeat([], 1)).toBe(1);
    expect(nextSeat([1, 2], 3)).toBe(3);
  });

  it("is null when the limit was lowered under the active bookings", () => {
    expect(nextSeat([1, 3], 2)).toBeNull();
  });

  it("counts bookings without a seat, made while the collection was unlimited", () => {
    expect(nextSeat([null, null, 1], 3)).toBeNull();
    expect(nextSeat([null, null], 3)).toBe(1);
  });
});

describe("statuses", () => {
  it("treats pending, confirmed and completed as active", () => {
    expect(["pending", "confirmed", "completed"].every(isActiveStatus)).toBe(true);
    expect(isActiveStatus("rejected")).toBe(false);
  });

  it("treats rejected and cancelled as released", () => {
    expect(["rejected", "cancelled"].every(isReleasedStatus)).toBe(true);
    expect(isReleasedStatus(undefined)).toBe(false);
  });

  it("does not treat a missing status as active", () => {
    expect(isActiveStatus(undefined)).toBe(false);
    expect(isActiveStatus(null)).toBe(false);
  });

  it("has an admin label for every status and for nothing else", () => {
    expect(Object.keys(STATUS_LABELS).sort()).toEqual([...ACTIVE_STATUSES, ...RELEASED_STATUSES].sort());
  });
});

describe("relationId", () => {
  it("reads an id from a number, a numeric string or a populated document", () => {
    expect(relationId(5)).toBe(5);
    expect(relationId("7")).toBe(7);
    expect(relationId({ id: 9, name: "x" })).toBe(9);
  });

  it("returns null for anything else", () => {
    expect(relationId(null)).toBeNull();
    expect(relationId("")).toBeNull();
    expect(relationId({})).toBeNull();
  });

  it("trims a numeric string and reads a string id inside a populated document", () => {
    expect(relationId(" 7 ")).toBe(7);
    expect(relationId({ id: "9" })).toBe(9);
  });

  it("rejects strings that are not plain digits", () => {
    expect(relationId("abc")).toBeNull();
    expect(relationId("7abc")).toBeNull();
  });

  it("returns null for a populated document without a usable id", () => {
    expect(relationId({ id: null })).toBeNull();
  });

  it.each([0, -1, 1.5, NaN])("rejects %s, which is not a row id", (value) => {
    expect(relationId(value)).toBeNull();
  });
});
