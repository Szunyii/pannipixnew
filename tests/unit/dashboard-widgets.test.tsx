import type { WidgetServerProps } from "payload";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookedDesigns } from "@/cms/dashboard/BookedDesigns";
import { BookingList } from "@/cms/dashboard/BookingList";
import { Overview } from "@/cms/dashboard/Overview";
import { type BookingRow, loadBookedDesigns, loadBookingView, loadOverview } from "@/cms/dashboard/data";
import type { BookingView } from "@/lib/dashboard";

// The widgets are async server components built from Payload's UI elements, which import SCSS: here the elements are
// plain markup. The queries are stubbed too, but loadSafely stays real, so a widget whose query or row formatting
// fails takes the same path as in the admin. The components are called as functions and their markup is read as text.
vi.mock("@payloadcms/ui", () => ({
  Banner: ({ children }: { children: ReactNode }) => <div data-banner="">{children}</div>,
  Link: ({ children, className, href }: { children: ReactNode; className?: string; href: string }) => (
    <a className={className} href={href}>{children}</a>
  ),
  Pill: ({ children, pillStyle }: { children: ReactNode; pillStyle?: string }) => (
    <span data-pill={pillStyle}>{children}</span>
  ),
  // createElement, not JSX: the lint rule against <img> is about the app's own pages, not a stand-in for Payload's.
  Thumbnail: ({ doc, fileSrc }: { doc?: { filename?: string }; fileSrc?: string }) =>
    createElement("img", { alt: doc?.filename, src: fileSrc }),
}));

vi.mock("@/cms/dashboard/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/cms/dashboard/data")>()),
  loadBookedDesigns: vi.fn(),
  loadBookingView: vi.fn(),
  loadOverview: vi.fn(),
}));

const logged = vi.fn();
const req = { payload: { config: { routes: { admin: "/admin" } }, logger: { error: logged } } };
// The widgets read nothing but `req` and their registered slug from the admin's props (a list also its `view`).
const widgetProps = (widgetSlug: string) => ({ req, widgetSlug }) as unknown as WidgetServerProps;
const listProps = (view: BookingView, widgetSlug: string) =>
  ({ req, view, widgetSlug }) as unknown as WidgetServerProps & { view: BookingView };

const row = (overrides: Partial<BookingRow> = {}): BookingRow => ({
  id: 7,
  design: "P’CONs #027",
  image: "/media/x.png",
  customer: "Szabó Lili",
  status: "pending",
  createdAt: "2026-10-16T10:00:00.000Z",
  slotStartsAt: null,
  ...overrides,
});

/** Every link in the markup, in order: where it goes (decoded, so where[design][equals]=3) and what it says. */
function links(html: string) {
  return [...html.matchAll(/<a ([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attributes, inner]) => ({
    href: decodeURIComponent((/href="([^"]*)"/.exec(attributes)?.[1] ?? "").replaceAll("&amp;", "&")),
    text: inner.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
  }));
}

/** Where the counter with this label leads (decoded); undefined when it isn't a link. */
const counterHref = (html: string, label: string) => links(html).find((link) => link.text.endsWith(label))?.href;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Overview", () => {
  it("does not link a counter that is zero", async () => {
    vi.mocked(loadOverview).mockResolvedValue({ pending: 2, unscheduled: 0, upcoming: 1, soldOut: [3] });

    const html = renderToStaticMarkup(await Overview(widgetProps("overview")));

    expect(links(html).map((link) => link.text)).toEqual(["2 Jóváhagyásra vár", "1 Közelgő időpont", "1 Elkelt minta"]);
    // The zero is still shown, as plain text.
    expect(html).toContain("Időpontra vár");
  });

  it("links the booking counters to their own lists, and not the sold-out one while none is sold out", async () => {
    vi.mocked(loadOverview).mockResolvedValue({ pending: 1, unscheduled: 1, upcoming: 1, soldOut: [] });

    const html = renderToStaticMarkup(await Overview(widgetProps("overview")));

    expect(links(html).map((link) => link.text)).toEqual([
      "1 Jóváhagyásra vár",
      "1 Időpontra vár",
      "1 Közelgő időpont",
    ]);
    expect(html).toContain("Elkelt minta");
    // A counter opens the list filtered like the widget of the same name, so a counter on the wrong view would show.
    expect(counterHref(html, "Jóváhagyásra vár")).toBe("/admin/collections/bookings?where[status][equals]=pending");
    expect(counterHref(html, "Időpontra vár")).toBe(
      "/admin/collections/bookings?where[and][0][status][equals]=confirmed&where[and][1][slot][exists]=false",
    );
    // The upcoming filter ends in the time of the render, so its link is checked up to there.
    const upcoming =
      "/admin/collections/bookings?where[and][0][status][in][0]=pending&where[and][0][status][in][1]=confirmed" +
      "&where[and][1][slotStartsAt][greater_than]=";
    expect(counterHref(html, "Közelgő időpont")?.slice(0, upcoming.length)).toBe(upcoming);
  });

  it("links the sold-out counter to the designs list, narrowed to the sold-out designs", async () => {
    vi.mocked(loadOverview).mockResolvedValue({ pending: 0, unscheduled: 0, upcoming: 0, soldOut: [3, 7] });

    const html = renderToStaticMarkup(await Overview(widgetProps("overview")));

    expect(counterHref(html, "Elkelt minta")).toBe("/admin/collections/designs?where[id][in]=3,7");
  });
});

describe("BookingList", () => {
  it("logs the failure and shows an error, rather than throwing, when a row's date can't be written", async () => {
    vi.mocked(loadBookingView).mockResolvedValue({ rows: [row({ createdAt: "not a date" })], total: 1 });

    const html = renderToStaticMarkup(await BookingList(listProps("pending", "pending-bookings")));

    expect(html).toContain("Nem sikerült betölteni");
    expect(html).not.toContain("Szabó Lili");
    expect(logged).toHaveBeenCalledWith(expect.objectContaining({ widget: "pending-bookings" }));
  });

  it("links the rows to their bookings and the header to the whole list, with a decorative image", async () => {
    vi.mocked(loadBookingView).mockResolvedValue({ rows: [row()], total: 3 });

    const html = renderToStaticMarkup(await BookingList(listProps("pending", "pending-bookings")));

    expect(html).toContain("Mind (3) →");
    expect(links(html).map((link) => link.href)).toEqual([
      "/admin/collections/bookings?where[status][equals]=pending",
      "/admin/collections/bookings/7",
    ]);
    expect(html).toContain('alt=""');
  });

  it("shows the empty text and no link when there are no bookings", async () => {
    vi.mocked(loadBookingView).mockResolvedValue({ rows: [], total: 0 });

    const html = renderToStaticMarkup(await BookingList(listProps("upcoming", "upcoming-bookings")));

    expect(html).toContain("Nincs közelgő időpont.");
    expect(links(html)).toEqual([]);
  });
});

describe("BookedDesigns", () => {
  it("gives a sold-out design a dark pill, and every card a link to its design's bookings", async () => {
    vi.mocked(loadBookedDesigns).mockResolvedValue([
      { id: 3, name: "P’CONs #027", image: null, label: "Elkelt · 1/1", soldOut: true },
      { id: 5, name: "ORNX #002", image: null, label: "2 / 3 alkalom", soldOut: false },
    ]);

    const html = renderToStaticMarkup(await BookedDesigns(widgetProps("booked-designs")));

    expect(html).toContain('<span data-pill="dark">Elkelt · 1/1</span>');
    expect(html).toContain('<span data-pill="light">2 / 3 alkalom</span>');
    expect(links(html).map((link) => link.href)).toEqual([
      "/admin/collections/bookings?where[design][equals]=3",
      "/admin/collections/bookings?where[design][equals]=5",
    ]);
  });
});
