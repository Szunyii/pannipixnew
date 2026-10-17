import type { DashboardConfig, SanitizedConfig, Widget } from "payload";
import { BOOKING_VIEWS, type BookingView, WIDGET_TITLES } from "@/lib/dashboard";

// Paths are relative to the import map's baseDir (the repo root). After adding or renaming a component here, run
// `npm run generate:importmap`; `next dev` regenerates it too.
const bookingList = (view: BookingView): Widget => ({
  // One widget per view, named after it.
  slug: `${view}-bookings`,
  label: BOOKING_VIEWS[view].title,
  Component: { path: "/cms/dashboard/BookingList#BookingList", serverProps: { view } },
  minWidth: "small",
  maxWidth: "full",
});

/**
 * The admin home. Each admin can add, remove, resize and reorder these widgets in the dashboard's edit mode; Payload
 * saves the layout per admin. The default layout is what an admin sees before saving one, and after "reset".
 */
export const dashboard = {
  widgets: [
    {
      slug: "overview",
      label: WIDGET_TITLES.overview,
      Component: "/cms/dashboard/Overview#Overview",
      minWidth: "medium",
      maxWidth: "full",
    },
    bookingList("pending"),
    bookingList("unscheduled"),
    bookingList("upcoming"),
    bookingList("recent"),
    {
      slug: "booked-designs",
      label: WIDGET_TITLES.bookedDesigns,
      Component: "/cms/dashboard/BookedDesigns#BookedDesigns",
      minWidth: "medium",
      maxWidth: "full",
    },
  ],
  defaultLayout: [
    { widgetSlug: "overview", width: "full" },
    { widgetSlug: "pending-bookings", width: "medium" },
    { widgetSlug: "unscheduled-bookings", width: "medium" },
    { widgetSlug: "upcoming-bookings", width: "medium" },
    { widgetSlug: "recent-bookings", width: "medium" },
    { widgetSlug: "booked-designs", width: "full" },
    // Payload's own collection cards, registered by Payload itself.
    { widgetSlug: "collections", width: "full" },
  ],
} satisfies DashboardConfig;

/**
 * Payload always appends its collection-cards widget, without a label, so the add-widget list would call it
 * "Collections". A widget of our own with that slug would show up twice, so the built config gets the label instead.
 */
export function labelPayloadWidgets(config: SanitizedConfig) {
  const cards = config.admin.dashboard?.widgets.find((widget) => widget.slug === "collections");
  if (cards) cards.label = "Gyűjtemények";
  return config;
}
