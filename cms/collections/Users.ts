import type { CollectionConfig } from "payload";

export const Users: CollectionConfig = {
  slug: "users",
  labels: { singular: "Admin", plural: "Adminok" },
  admin: { useAsTitle: "email", group: "Beállítások" },
  auth: {
    cookies: { secure: process.env.NODE_ENV === "production" },
    forgotPassword: {
      // serverURL stays unset (media URLs must stay relative), so the reset link is built from SITE_URL.
      generateEmailHTML: (args) => {
        const site = (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
        const url = `${site}/admin/reset/${args?.token ?? ""}`;
        return `<p>Új jelszót kértek ehhez a PANNIPIX admin fiókhoz. Ha nem te voltál, hagyd figyelmen kívül ezt a levelet.</p><p><a href="${url}">${url}</a></p>`;
      },
    },
  },
  fields: [],
};
