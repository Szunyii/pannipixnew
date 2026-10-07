import { ValidationError, type CollectionBeforeChangeHook, type CollectionConfig, type Where } from "payload";
import { relationId } from "@/lib/booking-rules";
import type { Design } from "@/payload-types";
import { adminOrVisible, isAdmin } from "../access";
import { guardDesignDelete } from "../booking/guards";

/** Trims the number, refuses one the collection already has, and names the design "P’CONs #027" for admin lists and pickers. */
const prepareDesign: CollectionBeforeChangeHook<Design> = async ({ data, originalDoc, req }) => {
  if (typeof data.number === "string") data.number = data.number.trim();
  const categoryId = relationId(data.category ?? originalDoc?.category);
  const number = data.number ?? originalDoc?.number;
  if (categoryId === null || !number) return data;

  // Checked here, a clash shows on the number field; the unique (category, number) index still settles two saves at once.
  const sameNumber: Where[] = [{ category: { equals: categoryId } }, { number: { equals: number } }];
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

  const category = await req.payload.findByID({
    collection: "categories",
    id: categoryId,
    depth: 0,
    disableErrors: true,
    overrideAccess: true,
    req,
  });
  if (category) data.title = `${category.name} #${number}`;
  return data;
};

export const Designs: CollectionConfig = {
  slug: "designs",
  labels: { singular: "Flash minta", plural: "Flash minták" },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "price", "visible", "updatedAt"],
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
    { name: "title", type: "text", label: "Minta", admin: { hidden: true } },
    {
      type: "row",
      fields: [
        { name: "category", type: "relationship", relationTo: "categories", required: true, label: "Kollekció" },
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
