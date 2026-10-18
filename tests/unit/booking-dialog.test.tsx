import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BookingDialog } from "@/components/booking-dialog";
import type { FlashDesign } from "@/components/data";
import { availability } from "@/lib/booking-rules";

// The dialog renders whatever design the store says is being booked; each test sets it.
const store = vi.hoisted(() => ({ design: null as FlashDesign | null }));
vi.mock("@/components/store", () => ({ useStore: () => ({ bookingFor: store.design, closeBooking: () => {} }) }));
// The server actions import the Payload config. The markup needs neither.
vi.mock("@/app/(frontend)/actions", () => ({ bookFlash: vi.fn(), getOpenSlots: vi.fn() }));
// next/image reads the app's image config, which a test doesn't load. createElement, not JSX: the lint rule against
// <img> is about the app's own pages, not a stand-in.
vi.mock("next/image", () => ({ default: ({ src, alt }: { src: string; alt: string }) => createElement("img", { src, alt }) }));

const design: FlashDesign = {
  id: 1,
  number: "028",
  category: "pcons",
  collection: "P’CONs",
  price: 90000,
  size: "",
  placements: "",
  description: "",
  createdAt: "2026-10-01T10:00:00.000Z",
  images: [{ src: "/flash/teszt.webp", alt: "Tesztminta", kind: "art", label: "Minta" }],
  availability: availability({ rule: "single" }, 0),
};

describe("the booking form's honeypot", () => {
  it("is out of autofill's reach: not rendered, and read-only", () => {
    store.design = design;
    const html = renderToStaticMarkup(<BookingDialog />);

    const input = html.match(/<input[^>]*name="website"[^>]*>/)?.[0];
    expect(input).toBeDefined();
    // Autofill and password managers skip read-only fields; a bot that sets every field's value doesn't.
    // React writes the attribute as readOnly; HTML attribute names ignore case.
    expect(input).toMatch(/\sreadonly=""/i);
    // Nor do they fill a field that isn't rendered at all. Off-screen isn't enough: they fill fields placed there.
    expect(html).toMatch(/<div[^>]*\shidden=""[^>]*>(?:(?!<\/div>)[\s\S])*name="website"/i);
  });
});
