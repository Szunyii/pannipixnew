import { APIError, type CollectionBeforeDeleteHook, type CollectionSlug, type Where } from "payload";

function refuseWhileReferenced(collection: CollectionSlug, field: string, message: string): CollectionBeforeDeleteHook {
  return async ({ id, req }) => {
    const where: Where = { [field]: { equals: id } };
    const { totalDocs } = await req.payload.count({ collection, where, overrideAccess: true, req });
    if (totalDocs > 0) throw new APIError(message, 400, null, true);
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
