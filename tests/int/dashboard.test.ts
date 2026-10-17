import * as qs from "qs-esm";
import { createLocalReq, type Payload, type PayloadRequest, type Where } from "payload";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { loadBookedDesigns, loadBookingView, loadOverview, loadSafely } from "@/cms/dashboard/data";
import { designsUrl } from "@/lib/dashboard";
import { getFlashCatalog } from "@/lib/flash";
import { createBooking, createDesign, createSlot, getTestPayload, resetDatabase } from "../helpers";

let payload: Payload;
let req: PayloadRequest;

beforeAll(async () => {
  payload = await getTestPayload();
  const admin = await payload.create({
    collection: "users",
    data: { email: "admin@example.com", password: "dashboard-test-password" },
  });
  req = await createLocalReq({ user: { ...admin, collection: "users" } }, payload);
});

beforeEach(async () => {
  await resetDatabase(payload);
});

// createdAt has millisecond precision; a short pause keeps "oldest first" and "newest first" well defined.
const tick = () => new Promise((resolve) => setTimeout(resolve, 10));
const ids = (docs: { id: number }[]) => docs.map((doc) => doc.id);
const sorted = (values: number[]) => values.toSorted((a, b) => a - b);
const reject = (id: number) => payload.update({ collection: "bookings", id, data: { status: "rejected" } });

describe("booking lists", () => {
  it("lists pending bookings oldest first, with the design's name and image and the customer's name", async () => {
    const design = await createDesign(payload, { rule: "unlimited", number: "027" });
    const first = await createBooking(payload, design.id, null);
    await tick();
    const second = await createBooking(payload, design.id, null);
    await createBooking(payload, design.id, null, { status: "confirmed" });

    const { rows, total } = await loadBookingView(req, "pending", new Date());

    expect(total).toBe(2);
    expect(ids(rows)).toEqual([first.id, second.id]);
    expect(rows[0]).toMatchObject({
      design: "P’CONs #027",
      customer: "Teszt Elek",
      status: "pending",
      slotStartsAt: null,
    });
    expect(rows[0].image).toMatch(/^\/api\/media\/file\/.+/);
  });

  it("lists confirmed bookings without a slot, and only those", async () => {
    const design = await createDesign(payload, { rule: "unlimited" });
    const waiting = await createBooking(payload, design.id, null, { status: "confirmed" });
    await createBooking(payload, design.id, (await createSlot(payload)).id, { status: "confirmed" });
    // A pending booking has no slot either, but it waits for approval first.
    await createBooking(payload, design.id, null);

    const { rows, total } = await loadBookingView(req, "unscheduled", new Date());

    expect(total).toBe(1);
    expect(ids(rows)).toEqual([waiting.id]);
  });

  it("lists pending and confirmed bookings whose slot is ahead, soonest first", async () => {
    const design = await createDesign(payload, { rule: "unlimited" });
    // Each createSlot call lands an hour later than the one before.
    const sooner = await createSlot(payload);
    const later = await createSlot(payload);
    const confirmed = await createBooking(payload, design.id, later.id, { status: "confirmed" });
    const pending = await createBooking(payload, design.id, sooner.id);
    await createBooking(payload, design.id, (await createSlot(payload, { past: true })).id, { status: "confirmed" });
    const rejected = await createBooking(payload, design.id, (await createSlot(payload)).id);
    await reject(rejected.id);

    const { rows, total } = await loadBookingView(req, "upcoming", new Date());

    expect(total).toBe(2);
    expect(ids(rows)).toEqual([pending.id, confirmed.id]);
    expect(rows[0].slotStartsAt).toBe(sooner.startsAt);
  });

  it("lists every booking newest first, five of them, with the total", async () => {
    const design = await createDesign(payload, { rule: "unlimited" });
    const made = [];
    for (let i = 0; i < 6; i += 1) {
      made.push(await createBooking(payload, design.id, null));
      await tick();
    }
    await reject(made[5].id);

    const { rows, total } = await loadBookingView(req, "recent", new Date());

    expect(total).toBe(6);
    expect(ids(rows)).toEqual(ids(made.slice(1).reverse()));
    expect(rows[0].status).toBe("rejected");
  });
});

describe("overview", () => {
  it("counts what each list holds, and every sold-out design, hidden ones too", async () => {
    const single = await createDesign(payload, { rule: "single" });
    const limited = await createDesign(payload, { rule: "limited", limit: 2 });
    const hidden = await createDesign(payload, { rule: "single", visible: false });
    const unlimited = await createDesign(payload, { rule: "unlimited" });
    await createBooking(payload, single.id, null);
    await createBooking(payload, limited.id, null, { status: "confirmed" });
    await createBooking(payload, limited.id, (await createSlot(payload)).id, { status: "confirmed" });
    await createBooking(payload, hidden.id, (await createSlot(payload, { past: true })).id, { status: "completed" });
    await createBooking(payload, unlimited.id, null, { status: "completed" });

    const overview = await loadOverview(req, new Date());

    expect(overview).toMatchObject({ pending: 1, unscheduled: 1, upcoming: 1 });
    expect(sorted(overview.soldOut)).toEqual(sorted([single.id, limited.id, hidden.id]));
    // The site marks the same designs sold out; it only leaves out the hidden one, which it doesn't show.
    const siteSoldOut = (await getFlashCatalog()).filter((d) => d.availability.soldOut).map((d) => d.id);
    expect(sorted(overview.soldOut.filter((id) => id !== hidden.id))).toEqual(sorted(siteSoldOut));
  });

  it("links the sold-out number to exactly those designs, even more than 21 of them", async () => {
    const soldOut: number[] = [];
    for (let i = 0; i < 22; i += 1) {
      const design = await createDesign(payload, { rule: "single" });
      await createBooking(payload, design.id, null);
      soldOut.push(design.id);
    }
    await createDesign(payload, { rule: "single" });

    const overview = await loadOverview(req, new Date());
    // Read the link the way the admin reads its list URLs (@payloadcms/next, views/Root).
    const query = designsUrl("/admin", overview.soldOut)?.split("?")[1] ?? "";
    const { where } = qs.parse(query, { depth: 10, ignoreQueryPrefix: true }) as { where: Where };
    const listed = await payload.find({ collection: "designs", where, depth: 0, pagination: false });

    expect(sorted(ids(listed.docs))).toEqual(sorted(soldOut));
  });
});

describe("booked designs", () => {
  it("shows the designs with active bookings, the most recently booked first, each with its tag", async () => {
    const single = await createDesign(payload, { rule: "single", number: "027" });
    const limited = await createDesign(payload, { category: "ornx", rule: "limited", limit: 3, number: "002" });
    const released = await createDesign(payload, { rule: "single" });
    await createBooking(payload, limited.id, null);
    await tick();
    await createBooking(payload, single.id, null, { status: "confirmed" });
    await tick();
    await createBooking(payload, limited.id, null, { status: "completed" });
    await reject((await createBooking(payload, released.id, null)).id);

    const cards = await loadBookedDesigns(req);

    expect(ids(cards)).toEqual([limited.id, single.id]);
    expect(cards[0]).toMatchObject({ name: "ORNX #002", label: "2 / 3 alkalom", soldOut: false });
    expect(cards[1]).toMatchObject({ name: "P’CONs #027", label: "Elkelt · 1/1", soldOut: true });
    expect(cards[0].image).toMatch(/^\/api\/media\/file\/.+/);
  });

  it("is empty while no booking holds a design", async () => {
    await createDesign(payload);
    expect(await loadBookedDesigns(req)).toEqual([]);
  });
});

describe("access", () => {
  it("refuses to load anything without a logged-in admin", async () => {
    const anonymous = await createLocalReq({}, payload);
    await expect(loadBookingView(anonymous, "recent", new Date())).rejects.toMatchObject({ name: "Forbidden" });
    await expect(loadOverview(anonymous, new Date())).rejects.toMatchObject({ name: "Forbidden" });
    await expect(loadBookedDesigns(anonymous)).rejects.toMatchObject({ name: "Forbidden" });
  });
});

describe("loadSafely", () => {
  it("logs only what is safe to log, and gives the widget null, when a query fails", async () => {
    const logged = vi.spyOn(payload.logger, "error").mockImplementation(() => undefined);
    // Drizzle puts the query's parameters, a customer's name among them, into its error message.
    const failure = Object.assign(new Error("Failed query: … params: Teszt Elek"), {
      name: "LibsqlError",
      code: "SQLITE_BUSY",
    });

    const result = await loadSafely(req, "overview", () => Promise.reject(failure));

    expect(result).toBeNull();
    expect(logged).toHaveBeenCalledWith({
      err: { name: "LibsqlError", code: "SQLITE_BUSY" },
      widget: "overview",
      msg: "Dashboard widget failed to load",
    });
    expect(JSON.stringify(logged.mock.calls)).not.toContain("Teszt Elek");
    logged.mockRestore();
  });

  it("hands the result over when the query works", async () => {
    expect(await loadSafely(req, "overview", async () => 42)).toBe(42);
  });
});
