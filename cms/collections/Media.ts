import path from "node:path";
import type { CollectionConfig } from "payload";
import { anyone, isAdmin } from "../access";
import { guardMediaDelete } from "../booking/guards";
import { dataLocation } from "../env";

export const Media: CollectionConfig = {
  slug: "media",
  labels: { singular: "Kép", plural: "Képek" },
  admin: { group: "Flash", defaultColumns: ["filename", "alt", "updatedAt"] },
  access: { read: anyone, create: isAdmin, update: isAdmin, delete: isAdmin },
  hooks: { beforeDelete: [guardMediaDelete] },
  upload: {
    // Outside the deploy folder in production (MEDIA_DIR), so uploads survive a redeploy.
    staticDir: path.resolve(/* turbopackIgnore: true */ dataLocation("MEDIA_DIR", ".data/media")),
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
    imageSizes: [{ name: "thumbnail", width: 320 }],
    adminThumbnail: "thumbnail",
    crop: false,
    focalPoint: false,
  },
  fields: [
    {
      name: "alt",
      type: "text",
      label: "Alternatív szöveg",
      required: true,
      admin: { description: "Egy mondat arról, mi látható a képen. Ezt olvassák fel a képernyőolvasók." },
    },
  ],
};
