import type { CollectionConfig } from "payload";
import { anyone, isAdmin } from "../access";
import { guardCategoryDelete } from "../booking/guards";

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
  hooks: { beforeDelete: [guardCategoryDelete] },
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
