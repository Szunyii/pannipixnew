import { ValidationError, type CollectionBeforeChangeHook, type CollectionConfig, type Where } from "payload";
import { CATEGORIES, categoryName } from "@/lib/categories";
import { designName } from "@/lib/design-name";
import type { Design } from "@/payload-types";
import { adminOrVisible, isAdmin } from "../access";
import { guardDesignDelete } from "../booking/guards";

/**
 * Trims the number, refuses one the collection already has, and names the design "P’CONs #027" for admin lists and
 * pickers. Only a limited design has a limit; clearing it otherwise keeps an old value from coming back with the rule.
 */
const prepareDesign: CollectionBeforeChangeHook<Design> = async ({ data, originalDoc, req }) => {
  if (typeof data.number === "string") data.number = data.number.trim();
  if ((data.rule ?? originalDoc?.rule) !== "limited") data.limit = null;
  const category = data.category ?? originalDoc?.category;
  const number = data.number ?? originalDoc?.number;
  if (!category || !number) return data;

  // Checked here, a clash shows on the number field; the unique (category, number) index still settles two saves at once.
  const sameNumber: Where[] = [{ category: { equals: category } }, { number: { equals: number } }];
  if (originalDoc?.id) sameNumber.push({ id: { not_equals: originalDoc.id } });
  const { totalDocs } = await req.payload.count({
    collection: "designs",
    where: { and: sameNumber },
    overrideAccess: true,
    req,
  });
  if (totalDocs > 0) {
    throw new ValidationError(
      {
        collection: "designs",
        errors: [{ path: "number", label: "Sorszám", message: "Ebben a kollekcióban már van ilyen sorszámú minta." }],
      },
      req.t,
    );
  }

  data.title = designName({ collection: categoryName(category), number });
  return data;
};

export const Designs: CollectionConfig = {
  slug: "designs",
  labels: { singular: "Flash minta", plural: "Flash minták" },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "price", "rule", "visible", "updatedAt"],
    group: "Flash",
    listSearchableFields: ["title", "number"],
  },
  defaultSort: "-createdAt",
  // A copy would keep the number, which its collection already has.
  disableDuplicate: true,
  access: { read: adminOrVisible, create: isAdmin, update: isAdmin, delete: isAdmin },
  indexes: [{ fields: ["category", "number"], unique: true }],
  hooks: { beforeChange: [prepareDesign], beforeDelete: [guardDesignDelete] },
  fields: [
    { name: "title", type: "text", label: "Minta", admin: { hidden: true, disableBulkEdit: true } },
    {
      type: "row",
      fields: [
        {
          name: "category",
          type: "select",
          required: true,
          label: "Kollekció",
          options: CATEGORIES.map(({ label, value }) => ({ label, value })),
        },
        {
          name: "number",
          type: "text",
          required: true,
          label: "Sorszám",
          admin: { description: "A név után áll: 027 → P’CONs #027." },
        },
      ],
    },
    {
      type: "row",
      fields: [
        {
          name: "rule",
          type: "select",
          required: true,
          defaultValue: "single",
          label: "Foglalhatóság",
          options: [
            { label: "Egyszeri – egyszer foglalható", value: "single" },
            { label: "Limitált – x alkalommal foglalható", value: "limited" },
            { label: "Korlátlan – bármennyiszer foglalható", value: "unlimited" },
          ],
          admin: { description: "Hányszor foglalható ez a minta." },
        },
        {
          name: "limit",
          type: "number",
          // Selects Payload's single-number field type, so validate's arguments below are typed.
          hasMany: false,
          label: "Alkalmak száma",
          admin: {
            condition: (_, siblingData) => siblingData?.rule === "limited",
            description: "Ennyiszer foglalható a minta.",
            step: 1,
          },
          validate: (value, { siblingData }) =>
            (siblingData as { rule?: string }).rule !== "limited" ||
            (typeof value === "number" && Number.isInteger(value) && value >= 2) ||
            "Limitált mintánál legalább 2 alkalmat adj meg.",
        },
      ],
    },
    {
      type: "row",
      fields: [
        {
          name: "price",
          type: "number",
          required: true,
          min: 0,
          label: "Ár (Ft)",
          admin: { description: "Tájékoztató ár, az oldalon nincs fizetés." },
        },
        {
          name: "badge",
          type: "select",
          label: "Címke",
          options: [
            { label: "Új", value: "new" },
            { label: "Utolsó", value: "last" },
          ],
          admin: { description: "Az „Elkelt” címke magától kerül fel." },
        },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "size", type: "text", label: "Ajánlott méret", admin: { placeholder: "15–18 cm" } },
        { name: "placements", type: "text", label: "Ajánlott testtájak", admin: { placeholder: "alkar, comb, oldal" } },
      ],
    },
    { name: "description", type: "textarea", label: "Leírás" },
    {
      name: "images",
      type: "array",
      label: "Képek",
      labels: { singular: "Kép", plural: "Képek" },
      minRows: 1,
      required: true,
      admin: { description: "Az első kép jelenik meg a kártyán. A rajz fehér hátterű legyen, így ráolvad a panelre." },
      fields: [
        { name: "image", type: "upload", relationTo: "media", required: true, label: "Kép" },
        {
          type: "row",
          fields: [
            {
              name: "kind",
              type: "select",
              required: true,
              defaultValue: "art",
              label: "Típus",
              options: [
                { label: "Rajz", value: "art" },
                { label: "Fotó", value: "photo" },
              ],
            },
            {
              name: "label",
              type: "text",
              defaultValue: "Minta",
              label: "Felirat",
              admin: { description: "pl. Minta, Bőrön, Részlet" },
            },
          ],
        },
      ],
    },
    {
      name: "visible",
      type: "checkbox",
      defaultValue: true,
      label: "Megjelenik az oldalon",
      admin: { position: "sidebar" },
    },
  ],
};
