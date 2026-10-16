import type { CollectionBeforeChangeHook, CollectionConfig, FieldHook } from "payload";
import { SLOT_PICKING } from "@/lib/features";
import { TIME_ZONE, formatSlotTitle } from "@/lib/time";
import type { Slot } from "@/payload-types";
import { isAdmin } from "../access";
import { guardSlotDelete, guardSlotTimeChange } from "../booking/guards";

const setTitle: CollectionBeforeChangeHook<Slot> = ({ data, originalDoc }) => {
  const startsAt = data.startsAt ?? originalDoc?.startsAt;
  // Collection hooks run before field validation: a bad date is left for the date field to reject (400, not 500).
  if (startsAt && !Number.isNaN(Date.parse(startsAt))) data.title = formatSlotTitle(startsAt);
  return data;
};

/** List column: whether a booking holds the slot, or it passed unbooked. */
const slotState: FieldHook<Slot> = async ({ data, req }) => {
  if (!data?.id) return undefined;
  const { totalDocs } = await req.payload.count({
    collection: "bookings",
    where: { slot: { equals: data.id } },
    overrideAccess: true,
    req,
  });
  if (totalDocs > 0) return "Foglalt";
  return data.startsAt && new Date(data.startsAt).getTime() < Date.now() ? "Lejárt" : "Szabad";
};

export const Slots: CollectionConfig = {
  slug: "slots",
  labels: { singular: "Időpont", plural: "Időpontok" },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "state"],
    group: "Foglalás",
    description: SLOT_PICKING
      ? "Szabad időpontok, amelyekre az oldalon flash mintát lehet foglalni. Egy időpontra egy foglalás jut."
      : "Időpontok, amelyeket a foglalásokhoz rendelhetsz, a foglalás Időpont mezőjében. Egy időpontra egy foglalás jut. Az oldalon a vendégek most nem választanak időpontot.",
  },
  defaultSort: "startsAt",
  disableDuplicate: true,
  access: { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAdmin },
  hooks: { beforeChange: [guardSlotTimeChange, setTitle], beforeDelete: [guardSlotDelete] },
  fields: [
    { name: "title", type: "text", label: "Időpont", admin: { hidden: true, disableBulkEdit: true } },
    {
      name: "startsAt",
      type: "date",
      required: true,
      unique: true,
      label: "Kezdés",
      timezone: {
        defaultTimezone: TIME_ZONE,
        supportedTimezones: [{ label: "Budapest", value: TIME_ZONE }],
        // Budapest is the only zone and Payload fills it in; left required, the generated type would make every
        // slot create pass startsAt_tz. The admin's zone picker stays required: it follows startsAt's `required`.
        override: ({ baseField }) => ({
          ...baseField,
          required: false,
          label: "Időzóna",
          admin: { ...baseField.admin, disableListColumn: true, disableListFilter: true, disableBulkEdit: true },
        }),
      },
      admin: {
        date: {
          pickerAppearance: "dayAndTime",
          timeIntervals: 15,
          timeFormat: "HH:mm",
          displayFormat: "yyyy. MM. dd. HH:mm",
        },
      },
    },
    {
      name: "state",
      type: "text",
      virtual: true,
      label: "Állapot",
      admin: { readOnly: true },
      hooks: { afterRead: [slotState] },
    },
  ],
};
