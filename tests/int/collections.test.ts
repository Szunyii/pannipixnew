import fs from "node:fs";
import path from "node:path";
import { Forbidden, logError, type Payload, type SelectField } from "payload";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CATEGORIES } from "@/lib/categories";
import {
  createBooking,
  createDesign,
  createImage,
  createSlot,
  customer,
  getTestPayload,
  resetDatabase,
} from "../helpers";

let payload: Payload;

beforeAll(async () => {
  payload = await getTestPayload();
});

beforeEach(async () => {
  await resetDatabase(payload);
});

/** Whether an upload's file is in the media folder (tests/setup.ts points MEDIA_DIR at a temp folder). */
const onDisk = (filename: string | null | undefined) =>
  Boolean(filename) && fs.existsSync(path.join(process.env.MEDIA_DIR ?? "", filename ?? ""));

describe("collections", () => {
  it("names designs and slots for the admin", async () => {
    const design = await createDesign(payload, { category: "pcons" });
    expect(design.title).toBe(`P’CONs #${design.number}`);
    const other = await createDesign(payload, { category: "daddywillhateus" });
    expect(other.title).toBe(`daddywillhateus #${other.number}`);

    const slot = await payload.create({ collection: "slots", data: { startsAt: "2026-10-14T08:00:00.000Z" } });
    expect(slot.title).toBe("2026. 10. 14. (szerda) 10:00");
  });

  it("offers the listed collections as a design's choices, and takes no other", async () => {
    const field = payload.collections.designs.config.flattenedFields.find((f) => f.name === "category") as SelectField;
    expect(field.options).toEqual(CATEGORIES.map(({ label, value }) => ({ label, value })));
    expect(field.required).toBe(true);

    await expect(
      // @ts-expect-error a collection that isn't on the list
      createDesign(payload, { category: "nincs-ilyen" }),
    ).rejects.toMatchObject({ name: "ValidationError", data: { errors: [{ path: "category" }] } });
  });

  it("renames a design when it moves to another collection", async () => {
    const { id, number } = await createDesign(payload, { category: "pcons" });
    const moved = await payload.update({ collection: "designs", id, data: { category: "ornx" } });
    expect(moved.title).toBe(`ORNX #${number}`);
  });

  it("stores a design number trimmed", async () => {
    const design = await createDesign(payload, { number: " 027 " });
    expect(design.number).toBe("027");
    expect(design.title).toBe("P’CONs #027");
  });

  it("refuses a number its collection already has, but not another collection's", async () => {
    await createDesign(payload, { category: "pcons", number: "027" });

    await expect(createDesign(payload, { category: "pcons", number: "027" })).rejects.toMatchObject({
      name: "ValidationError",
      data: { errors: [{ path: "number", message: "Ebben a kollekcióban már van ilyen sorszámú minta." }] },
    });
    expect((await createDesign(payload, { category: "ornx", number: "027" })).number).toBe("027");
  });

  it("doesn't duplicate designs", async () => {
    const design = await createDesign(payload);
    await expect(payload.duplicate({ collection: "designs", id: design.id })).rejects.toThrow(/cannot be duplicated/);
  });

  it("books a design once unless the admin says otherwise", async () => {
    const image = await createImage(payload);
    // @ts-expect-error the rule is left out, as on a form the admin saved without touching the field
    const design = await payload.create({
      collection: "designs",
      data: { category: "pcons", number: "900", price: 90000, images: [{ image: image.id, kind: "art" }] },
    });
    expect(design.rule).toBe("single");
    expect(design.limit ?? null).toBeNull();
  });

  it("asks for at least two bookings on a limited design", async () => {
    await expect(createDesign(payload, { rule: "limited", limit: 1 })).rejects.toMatchObject({
      name: "ValidationError",
      data: { errors: [{ path: "limit", message: "Limitált mintánál legalább 2 alkalmat adj meg." }] },
    });
    await expect(createDesign(payload, { rule: "limited" })).rejects.toMatchObject({
      name: "ValidationError",
      data: { errors: [{ path: "limit" }] },
    });
    expect((await createDesign(payload, { rule: "limited", limit: 2 })).limit).toBe(2);
  });

  it("drops the limit of a design that isn't limited", async () => {
    const limited = await createDesign(payload, { rule: "limited", limit: 3 });
    const single = await payload.update({ collection: "designs", id: limited.id, data: { rule: "single" } });
    expect(single.limit).toBeNull();
    expect((await createDesign(payload, { rule: "unlimited", limit: 5 })).limit).toBeNull();
  });

  it("refuses a second slot at the same time", async () => {
    const { startsAt } = await createSlot(payload);
    await expect(payload.create({ collection: "slots", data: { startsAt } })).rejects.toMatchObject({
      name: "ValidationError",
      data: { errors: [{ path: "startsAt" }] },
    });
  });

  it("hides switched-off designs from visitors", async () => {
    await createDesign(payload, { visible: false });
    const shown = await createDesign(payload);
    const result = await payload.find({ collection: "designs", overrideAccess: false });
    expect(result.docs.map((d) => d.id)).toEqual([shown.id]);
  });

  it("keeps visitors away from bookings, slots and admin accounts", async () => {
    const design = await createDesign(payload);
    const slot = await createSlot(payload);

    for (const collection of ["bookings", "slots", "users"] as const) {
      await expect(payload.find({ collection, overrideAccess: false })).rejects.toBeInstanceOf(Forbidden);
    }
    await expect(
      payload.create({
        collection: "bookings",
        data: { ...customer, design: design.id, slot: slot.id, status: "pending" },
        overrideAccess: false,
      }),
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it("keeps referenced designs and slots from being deleted", async () => {
    const design = await createDesign(payload, { rule: "unlimited" });
    const slot = await createSlot(payload);
    await createBooking(payload, design.id, slot.id);

    await expect(payload.delete({ collection: "designs", id: design.id })).rejects.toThrow(/foglalás tartozik/);
    await expect(payload.delete({ collection: "slots", id: slot.id })).rejects.toThrow(/foglalás tartozik/);
  });

  describe("the time of a slot", () => {
    const HOUR = 60 * 60 * 1000;
    const hourLater = (startsAt: string) => new Date(new Date(startsAt).getTime() + HOUR).toISOString();

    /** A slot a booking holds, and the booking. */
    async function heldSlot() {
      const design = await createDesign(payload, { rule: "unlimited" });
      const slot = await createSlot(payload);
      const booking = await createBooking(payload, design.id, slot.id);
      return { slot, booking };
    }

    it("stays as it is while a booking holds the slot, so the booking and its emails never show an old time", async () => {
      const { slot, booking } = await heldSlot();

      const refusal = await payload
        .update({ collection: "slots", id: slot.id, data: { startsAt: hourLater(slot.startsAt) } })
        .catch((err: unknown) => err);

      expect(refusal).toMatchObject({
        name: "ValidationError",
        data: {
          errors: [
            {
              path: "startsAt",
              message: "Foglalt időpont nem módosítható: vegyél fel új időpontot, és tedd át rá a foglalást.",
            },
          ],
        },
      });
      // The admin's toast names the field, in Hungarian: the hook passes req.t.
      expect((refusal as Error).message).toBe("A következő mező érvénytelen: Kezdés");
      const unchanged = await payload.findByID({ collection: "slots", id: slot.id, depth: 0 });
      expect(unchanged).toMatchObject({ startsAt: slot.startsAt, title: slot.title });
      expect(await payload.findByID({ collection: "bookings", id: booking.id, depth: 0 })).toMatchObject({
        slot: slot.id,
        slotStartsAt: slot.startsAt,
      });
    });

    it("can change while the slot is free, and the slot is renamed", async () => {
      const slot = await payload.create({ collection: "slots", data: { startsAt: "2026-10-14T08:00:00.000Z" } });

      const moved = await payload.update({
        collection: "slots",
        id: slot.id,
        data: { startsAt: "2026-10-14T09:00:00.000Z" },
      });

      expect(moved.startsAt).toBe("2026-10-14T09:00:00.000Z");
      expect(moved.title).toBe("2026. 10. 14. (szerda) 11:00");
    });

    it("can change again once the booking that held the slot is rejected", async () => {
      const { slot, booking } = await heldSlot();
      await payload.update({ collection: "bookings", id: booking.id, data: { status: "rejected" } });

      const moved = await payload.update({
        collection: "slots",
        id: slot.id,
        data: { startsAt: hourLater(slot.startsAt) },
      });

      expect(moved.startsAt).toBe(hourLater(slot.startsAt));
    });

    it("lets a booked slot be saved when its time stays the same", async () => {
      const { slot } = await heldSlot();

      // Just the time, and the whole document back as the admin form sends it.
      await payload.update({ collection: "slots", id: slot.id, data: { startsAt: slot.startsAt } });
      const doc = await payload.findByID({ collection: "slots", id: slot.id, depth: 0 });
      const saved = await payload.update({ collection: "slots", id: slot.id, data: { ...doc } });

      expect(saved.startsAt).toBe(slot.startsAt);
      expect(saved.state).toBe("Foglalt");
    });

    it("counts the same moment, written with an offset, as no change", async () => {
      const { slot } = await heldSlot();

      const saved = await payload.update({
        collection: "slots",
        id: slot.id,
        data: { startsAt: slot.startsAt.replace("Z", "+00:00") },
      });

      expect(new Date(saved.startsAt).getTime()).toBe(new Date(slot.startsAt).getTime());
    });
  });

  it("keeps an image a design uses, files and all", async () => {
    const used = await createImage(payload);
    const unused = await createImage(payload);
    await createDesign(payload, { image: used.id });

    await expect(payload.delete({ collection: "media", id: used.id })).rejects.toThrow(
      "A kép nem törölhető, mert flash minta használja. Előbb cseréld le a mintában.",
    );
    expect(onDisk(used.filename)).toBe(true);
    expect(onDisk(used.sizes?.thumbnail?.filename)).toBe(true);

    await payload.delete({ collection: "media", id: unused.id });
    expect(onDisk(unused.filename)).toBe(false);
  });

  it("logs a refused delete as info, not as a server error", async () => {
    const design = await createDesign(payload);
    await createBooking(payload, design.id, (await createSlot(payload)).id);
    const refusal = await payload.delete({ collection: "designs", id: design.id }).catch((err: unknown) => err);
    expect(refusal).toMatchObject({ name: "DeleteRefusedError", status: 400, isPublic: true });

    const info = vi.spyOn(payload.logger, "info").mockImplementation(() => {});
    const error = vi.spyOn(payload.logger, "error").mockImplementation(() => {});
    try {
      logError({ err: refusal, payload });
      expect(info).toHaveBeenCalledOnce();
      expect(error).not.toHaveBeenCalled();
    } finally {
      info.mockRestore();
      error.mockRestore();
    }
  });

  it("shows whether a slot is free, booked or past", async () => {
    const design = await createDesign(payload, { rule: "unlimited" });
    const free = await createSlot(payload);
    const booked = await createSlot(payload);
    const past = await createSlot(payload, { past: true });
    await createBooking(payload, design.id, booked.id);

    const state = async (id: number) => (await payload.findByID({ collection: "slots", id })).state;
    expect(await state(free.id)).toBe("Szabad");
    expect(await state(booked.id)).toBe("Foglalt");
    expect(await state(past.id)).toBe("Lejárt");
  });

  it("tells the admin at the status when the customer is emailed and that a released booking stays released", () => {
    const status = payload.collections.bookings.config.flattenedFields.find((f) => f.name === "status");
    expect(status?.admin?.description).toBe(
      "Az ügyfél e-mailt kap, amikor függő vagy jóváhagyott foglalás jön létre, illetve amikor jóváhagyod, elutasítod vagy lemondod; a törlés nem küld levelet. Elutasított vagy lemondott foglalás nem aktiválható újra: ilyenkor hozz létre újat.",
    );
  });

  it("keeps internal fields and a booking's design out of the admin's bulk edit", () => {
    // "Edit many" skips fields that are unique, readOnly, disabled, top-level hidden or disableBulkEdit, but not admin.hidden.
    const field = (slug: "bookings" | "designs" | "slots", name: string) => {
      const found = payload.collections[slug].config.flattenedFields.find((f) => f.name === name);
      if (!found) throw new Error(`${slug}.${name} is not in the sanitized config`);
      return found;
    };

    expect(field("bookings", "seat").admin).toMatchObject({
      hidden: true,
      disableBulkEdit: true,
      disableListColumn: true,
      disableListFilter: true,
    });
    // A bulk edit saves its documents in parallel: bookings moved onto one design together would all pick the same seat.
    expect(field("bookings", "design").admin).toMatchObject({ disableBulkEdit: true });

    // Payload adds the zone picker beside startsAt; the override relabels it and keeps it out of lists and bulk edit.
    const timezone = field("slots", "startsAt_tz") as SelectField;
    expect(timezone.label).toBe("Időzóna");
    expect(timezone.required).toBeFalsy();
    expect(timezone.admin).toMatchObject({ disableListColumn: true, disableListFilter: true, disableBulkEdit: true });

    for (const slug of ["bookings", "designs", "slots"] as const) {
      expect(field(slug, "title").admin).toMatchObject({ hidden: true, disableBulkEdit: true });
    }
  });
});
