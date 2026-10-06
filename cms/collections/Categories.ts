import type { CollectionAfterChangeHook, CollectionConfig } from "payload";
import type { Category } from "@/payload-types";
import { anyone, isAdmin } from "../access";
import { guardCategoryDelete } from "../booking/guards";

/** Designs carry the collection's name ("P’CONs #027"); re-saving them after a rename lets their setTitle hook catch up. */
const renameDesigns: CollectionAfterChangeHook<Category> = async ({ doc, operation, previousDoc, req }) => {
  if (operation !== "update" || previousDoc.name === doc.name) return;
  const { errors } = await req.payload.update({
    collection: "designs",
    where: { category: { equals: doc.id } },
    data: {},
    depth: 0,
    overrideAccess: true,
    req,
  });
  // A bulk update reports failed documents instead of throwing; the rename itself is already saved.
  if (errors.length > 0) req.payload.logger.error({ errors, msg: "Some designs kept the collection's old name" });
};

export const Categories: CollectionConfig = {
  slug: "categories",
  labels: { singular: "Kollekció", plural: "Kollekciók" },
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "rule", "limit", "order"],
    group: "Flash",
    description: "A kollekció dönti el, hányszor foglalható egy-egy mintája.",
  },
  defaultSort: "order",
  access: { read: anyone, create: isAdmin, update: isAdmin, delete: isAdmin },
  hooks: { afterChange: [renameDesigns], beforeDelete: [guardCategoryDelete] },
  fields: [
    { name: "name", type: "text", required: true, unique: true, label: "Név" },
    {
      name: "rule",
      type: "select",
      required: true,
      defaultValue: "single",
      label: "Foglalhatóság",
      options: [
        { label: "Egyszeri – minden minta egyszer foglalható", value: "single" },
        { label: "Limitált – minden minta x alkalommal foglalható", value: "limited" },
        { label: "Korlátlan – bármennyiszer foglalható", value: "unlimited" },
      ],
    },
    {
      name: "limit",
      type: "number",
      // Selects Payload's single-number field type, so validate's arguments below are typed.
      hasMany: false,
      label: "Alkalmak száma",
      admin: {
        condition: (_, siblingData) => siblingData?.rule === "limited",
        description: "Hányszor foglalható egy minta ebben a kollekcióban.",
        step: 1,
      },
      validate: (value, { siblingData }) =>
        (siblingData as { rule?: string }).rule !== "limited" ||
        (typeof value === "number" && Number.isInteger(value) && value >= 2) ||
        "Limitált kollekciónál legalább 2 alkalmat adj meg.",
    },
    {
      name: "order",
      type: "number",
      defaultValue: 0,
      label: "Sorrend",
      admin: { position: "sidebar", description: "A kisebb szám előrébb kerül az oldalon." },
    },
  ],
};
