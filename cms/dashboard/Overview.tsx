import { Link } from "@payloadcms/ui";
import type { WidgetServerProps } from "payload";
import { WIDGET_TITLES, designsUrl, viewListUrl } from "@/lib/dashboard";
import styles from "./dashboard.module.css";
import { loadOverview, loadSafely } from "./data";
import { WidgetError, WidgetFrame } from "./parts";

const TITLE = WIDGET_TITLES.overview;

/** Four numbers: what waits for approval, what waits for a slot, what is coming up, and the sold-out designs. */
export async function Overview({ req }: WidgetServerProps) {
  const now = new Date();
  const overview = await loadSafely(req, "overview", () => loadOverview(req, now));
  if (!overview) return <WidgetError title={TITLE} />;

  const adminRoute = req.payload.config.routes.admin;
  const stats: { label: string; value: number; href?: string }[] = [
    { label: "Jóváhagyásra vár", value: overview.pending, href: viewListUrl(adminRoute, "pending", now) },
    { label: "Időpontra vár", value: overview.unscheduled, href: viewListUrl(adminRoute, "unscheduled", now) },
    { label: "Közelgő időpont", value: overview.upcoming, href: viewListUrl(adminRoute, "upcoming", now) },
    { label: "Elkelt minta", value: overview.soldOut.length, href: designsUrl(adminRoute, overview.soldOut) },
  ];

  return (
    <WidgetFrame title={TITLE}>
      <ul className={styles.stats}>
        {stats.map(({ label, value, href }) => {
          const content = (
            <>
              <strong className={styles.statValue}>{value}</strong>
              <span className={styles.statLabel}>{label}</span>
            </>
          );
          // A zero opens nothing worth seeing, so it isn't a link.
          return (
            <li key={label}>
              {value > 0 && href ? (
                <Link className={styles.stat} href={href} prefetch={false}>
                  {content}
                </Link>
              ) : (
                <div className={styles.stat}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </WidgetFrame>
  );
}
