import { readFileSync } from "node:fs";
import config from "@payload-config";
import { initI18n } from "@payloadcms/translations";
import { hu } from "@payloadcms/translations/languages/hu";
import type { SanitizedConfig } from "payload";
import { beforeAll, describe, expect, it } from "vitest";
import { dashboardTranslations } from "@/cms/dashboard/translations";
import { dashboard } from "@/cms/dashboard/widgets";

// The built config is all these tests read: no database, no Payload instance.
let built: SanitizedConfig;

beforeAll(async () => {
  built = await config;
});

describe("dashboard widgets", () => {
  it("lays out only widgets that are registered, Payload's collection cards included", () => {
    const registered = new Set(built.admin.dashboard?.widgets.map((widget) => widget.slug));
    for (const { widgetSlug } of dashboard.defaultLayout) expect(registered, widgetSlug).toContain(widgetSlug);
  });

  it("has every widget component in the generated import map", () => {
    // `npm run generate:importmap` writes it; without an entry the admin can't render the widget.
    const importMap = readFileSync(new URL("../../app/(payload)/admin/importMap.js", import.meta.url), "utf8");
    for (const { slug, Component } of dashboard.widgets) {
      const path = typeof Component === "object" ? Component.path : Component;
      expect(typeof path, slug).toBe("string");
      expect(importMap).toContain(`"${path}"`);
    }
  });

  it("names Payload's collection cards in Hungarian in the add-widget list", () => {
    const cards = built.admin.dashboard?.widgets.find((widget) => widget.slug === "collections");
    expect(cards?.label).toBe("Gyűjtemények");
  });

  it("keeps Payload's own widget out of the module's widget list", () => {
    expect(dashboard.widgets.map((widget) => widget.slug)).not.toContain("collections");
  });
});

describe("dashboard translations", () => {
  it("replaces only strings Payload's Hungarian translation has", () => {
    // A Payload upgrade that renames a key would otherwise leave the old Hungarian text in place unnoticed.
    const payloadStrings = hu.translations as unknown as Record<string, Record<string, string>>;
    for (const [group, strings] of Object.entries(dashboardTranslations)) {
      for (const key of Object.keys(strings)) expect(payloadStrings[group], `${group}:${key}`).toHaveProperty(key);
    }
  });

  it("reaches the admin's translations", async () => {
    const i18n = await initI18n({ config: built.i18n, context: "client", language: "hu" });
    expect(i18n.t("dashboard:resetLayout")).toBe("Alapelrendezés visszaállítása");
    expect(i18n.t("error:failedToResetLayout")).toBe("Nem sikerült visszaállítani az alapelrendezést.");
    // Strings we don't replace keep Payload's text.
    expect(i18n.t("dashboard:discardConfirmLabel")).toBe("Elvetés");
  });
});
