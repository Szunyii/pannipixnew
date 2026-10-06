import type { CollectionConfig } from "payload";

export const Users: CollectionConfig = {
  slug: "users",
  labels: { singular: "Admin", plural: "Adminok" },
  admin: { useAsTitle: "email", group: "Beállítások" },
  auth: true,
  fields: [],
};
