import { APIError, type CollectionBeforeDeleteHook, type CollectionSlug, type Where } from "payload";

/** A delete the guards turn down on purpose: the admin sees the message, and the server logs it at info (payload.config.ts). */
export class DeleteRefusedError extends APIError {
  constructor(message: string) {
    super(message, 400, null, true);
    // Set by hand: loggingLevels matches on the name, and a minifier may rename the class.
    this.name = "DeleteRefusedError";
  }
}

function refuseWhileReferenced(collection: CollectionSlug, field: string, message: string): CollectionBeforeDeleteHook {
  return async ({ id, req }) => {
    const where: Where = { [field]: { equals: id } };
    const { totalDocs } = await req.payload.count({ collection, where, overrideAccess: true, req });
    if (totalDocs > 0) throw new DeleteRefusedError(message);
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

// Payload removes an upload's files before the row, so without this check the row delete would fail on the design's
// image reference only after the artwork was gone from disk.
export const guardMediaDelete = refuseWhileReferenced(
  "designs",
  "images.image",
  "A kép nem törölhető, mert flash minta használja. Előbb cseréld le a mintában.",
);
