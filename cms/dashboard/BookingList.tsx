import Link from "next/link";
import type { WidgetServerProps } from "payload";
import { BOOKING_VIEWS, type BookingView, bookingUrl, viewListUrl } from "@/lib/dashboard";
import styles from "./dashboard.module.css";
import { loadBookingView, loadSafely } from "./data";
import { DesignImage, EmptyState, StatusPill, WidgetError, WidgetFrame } from "./parts";

/** One of the four booking lists. Which one comes from its registration in cms/dashboard/widgets.ts (serverProps). */
export async function BookingList({ req, view }: WidgetServerProps & { view: BookingView }) {
  const spec = BOOKING_VIEWS[view];
  const now = new Date();
  // The row dates are written inside loadSafely too, so nothing in this widget can fail outside it.
  const list = await loadSafely(req, `${view}-bookings`, async () => {
    const { rows, total } = await loadBookingView(req, view, now);
    return { total, rows: rows.map((row) => ({ ...row, when: spec.when(row, now) })) };
  });
  if (!list) return <WidgetError title={spec.title} />;

  const adminRoute = req.payload.config.routes.admin;
  const all =
    list.total > 0 ? { href: viewListUrl(adminRoute, view, now), label: `Mind (${list.total}) →` } : undefined;

  return (
    <WidgetFrame title={spec.title} link={all}>
      {list.rows.length === 0 ? (
        <EmptyState>{spec.empty}</EmptyState>
      ) : (
        <ul className={styles.rows}>
          {list.rows.map((row) => (
            <li key={row.id}>
              <Link className={styles.row} href={bookingUrl(adminRoute, row.id)}>
                <DesignImage src={row.image} />
                <span className={styles.rowText}>
                  <strong>{row.design}</strong>
                  <span>
                    {row.customer} · {row.when}
                  </span>
                </span>
                <StatusPill status={row.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WidgetFrame>
  );
}
