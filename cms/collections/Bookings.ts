import type { CollectionConfig, Where } from "payload";
import { PLACEMENTS } from "@/lib/booking-input";
import { STATUS_LABELS, relationId } from "@/lib/booking-rules";
import { isAdmin } from "../access";
import { prepareBooking } from "../booking/hooks";
import { sendBookingEmails } from "../emails/send";

export const Bookings: CollectionConfig = {
  slug: "bookings",
  labels: { singular: "Foglalás", plural: "Foglalások" },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "slotStartsAt", "status", "phone", "createdAt"],
    group: "Foglalás",
    description:
      "Az oldalon beküldött és a kézzel felvett foglalások. Elutasításkor vagy lemondáskor az időpont és a minta egy alkalma újra foglalható lesz.",
    listSearchableFields: ["name", "email", "phone", "designName"],
  },
  defaultSort: "-createdAt",
  disableDuplicate: true,
  access: { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAdmin },
  // Together with the unique slot this keeps simultaneous requests from overbooking (SQLite allows many NULLs).
  indexes: [{ fields: ["design", "seat"], unique: true }],
  hooks: { beforeChange: [prepareBooking], afterChange: [sendBookingEmails] },
  fields: [
    { name: "title", type: "text", label: "Foglalás", admin: { hidden: true, disableBulkEdit: true } },
    {
      type: "row",
      fields: [
        {
          name: "design",
          type: "relationship",
          relationTo: "designs",
          required: true,
          label: "Minta",
          // "Edit many" saves the bookings in parallel: moved onto one design together, they'd all pick the same seat.
          admin: { disableBulkEdit: true },
        },
        {
          name: "slot",
          type: "relationship",
          relationTo: "slots",
          unique: true,
          label: "Időpont",
          admin: { description: "Csak szabad időpont választható." },
          // The picker only offers slots no other booking holds.
          filterOptions: async ({ id, req }) => {
            const conditions: Where[] = [{ slot: { exists: true } }];
            if (id) conditions.push({ id: { not_equals: id } });
            const held = await req.payload.find({
              collection: "bookings",
              where: { and: conditions },
              select: { slot: true },
              depth: 0,
              pagination: false,
              overrideAccess: true,
              req,
            });
            const taken = held.docs.map((b) => relationId(b.slot)).filter((v): v is number => v !== null);
            return taken.length > 0 ? { id: { not_in: taken } } : true;
          },
        },
      ],
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "pending",
      label: "Állapot",
      options: Object.entries(STATUS_LABELS).map(([value, label]) => ({ label, value })),
      admin: {
        position: "sidebar",
        description:
          "Az ügyfél e-mailt kap, amikor függő vagy jóváhagyott foglalás jön létre, illetve amikor jóváhagyod, elutasítod vagy lemondod; a törlés nem küld levelet. Elutasított vagy lemondott foglalás nem aktiválható újra: ilyenkor hozz létre újat.",
      },
    },
    {
      type: "row",
      fields: [
        { name: "name", type: "text", required: true, label: "Név" },
        { name: "email", type: "email", required: true, label: "E-mail" },
        { name: "phone", type: "text", required: true, label: "Telefon" },
      ],
    },
    {
      name: "placement",
      type: "select",
      required: true,
      label: "Testtáj",
      options: PLACEMENTS.map(({ label, value }) => ({ label, value })),
    },
    { name: "note", type: "textarea", maxLength: 1000, label: "Megjegyzés" },
    {
      name: "adultConfirmed",
      type: "checkbox",
      required: true,
      label: "Elmúlt 18 éves",
      validate: (value) => value === true || "Csak 18 év feletti ügyfél foglalhat.",
    },
    {
      name: "seat",
      type: "number",
      label: "Sorszám (belső)",
      // "Edit many" still lists hidden fields; a bulk-set seat would clash with the unique (design, seat) index.
      admin: { hidden: true, disableListColumn: true, disableListFilter: true, disableBulkEdit: true },
    },
    { name: "designName", type: "text", label: "Minta (foglaláskor)", admin: { readOnly: true, position: "sidebar" } },
    {
      name: "slotStartsAt",
      type: "date",
      label: "Időpont (foglaláskor)",
      admin: {
        readOnly: true,
        position: "sidebar",
        date: { pickerAppearance: "dayAndTime", displayFormat: "yyyy. MM. dd. HH:mm" },
      },
    },
    { name: "price", type: "number", label: "Ár a foglaláskor (Ft)", admin: { readOnly: true, position: "sidebar" } },
  ],
};
