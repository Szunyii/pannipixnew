import {
  APIError,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type CollectionSlug,
  type PayloadRequest,
  ValidationError,
  type Where,
} from "payload";
import type { Slot } from "@/payload-types";

/** A delete the guards turn down on purpose: the admin sees the message, and the server logs it at info (payload.config.ts). */
export class DeleteRefusedError extends APIError {
  constructor(message: string) {
    super(message, 400, null, true);
    // Set by hand: loggingLevels matches on the name, and a minifier may rename the class.
    this.name = "DeleteRefusedError";
  }
}

/** Whether any document in `collection` points at `id` through `field`. */
async function isReferenced(collection: CollectionSlug, field: string, id: number | string, req: PayloadRequest) {
  const where: Where = { [field]: { equals: id } };
  const { totalDocs } = await req.payload.count({ collection, where, overrideAccess: true, req });
  return totalDocs > 0;
}

function refuseWhileReferenced(collection: CollectionSlug, field: string, message: string): CollectionBeforeDeleteHook {
  return async ({ id, req }) => {
    if (await isReferenced(collection, field, id, req)) throw new DeleteRefusedError(message);
  };
}

export const guardCategoryDelete = refuseWhileReferenced(
  "designs",
  "category",
  "A kollekció nem törölhető, amíg minta tartozik hozzá. Előbb helyezd át vagy töröld a mintáit.",
);

export const guardDesignDelete = refuseWhileReferenced(
  "bookings",
  "design",
  "A minta nem törölhető, mert foglalás tartozik hozzá. Ha nem szeretnéd az oldalon mutatni, kapcsold ki a „Megjelenik az oldalon” beállítást.",
);

// Rejected and cancelled bookings no longer hold a slot, so only active ones block this.
export const guardSlotDelete = refuseWhileReferenced(
  "bookings",
  "slot",
  "Az időpont nem törölhető, mert foglalás tartozik hozzá. Előbb utasítsd el vagy mondd le a foglalást.",
);

/**
 * A booking copies its slot's time (`slotStartsAt`) when it takes the slot. The emails and the admin list show the
 * copy, and only moving the booking to another slot refreshes it. So a slot a booking holds keeps its time: to
 * reschedule, the admin makes a new slot and moves the booking onto it. A rejected or cancelled booking has let go
 * of its slot, so only an active one blocks this.
 */
export const guardSlotTimeChange: CollectionBeforeChangeHook<Slot> = async ({ data, originalDoc, operation, req }) => {
  if (operation !== "update" || !data.startsAt || !originalDoc?.startsAt) return data;
  const next = new Date(data.startsAt).getTime();
  // A date that doesn't parse is left for the date field to reject (400, not 500). The same moment written another
  // way (an offset instead of Z) is no change, which keeps the admin's whole-document save of a booked slot working.
  if (Number.isNaN(next) || next === new Date(originalDoc.startsAt).getTime()) return data;

  if (await isReferenced("bookings", "slot", originalDoc.id, req)) {
    throw new ValidationError(
      {
        collection: "slots",
        errors: [
          {
            path: "startsAt",
            label: "Kezdés",
            message: "Foglalt időpont nem módosítható: vegyél fel új időpontot, és tedd át rá a foglalást.",
          },
        ],
      },
      req.t,
    );
  }
  return data;
};

// Payload removes an upload's files before the row, so without this check the row delete would fail on the design's
// image reference only after the artwork was gone from disk.
export const guardMediaDelete = refuseWhileReferenced(
  "designs",
  "images.image",
  "A kép nem törölhető, mert flash minta használja. Előbb cseréld le a mintában.",
);
