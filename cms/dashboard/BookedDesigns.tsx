import { Link, Pill } from "@payloadcms/ui";
import type { WidgetServerProps } from "payload";
import { WIDGET_TITLES, designBookingsUrl } from "@/lib/dashboard";
import styles from "./dashboard.module.css";
import { loadBookedDesigns, loadSafely } from "./data";
import { DesignImage, EmptyState, WidgetError, WidgetFrame } from "./parts";

const TITLE = WIDGET_TITLES.bookedDesigns;

/** The designs with active bookings; a card opens that design's bookings. */
export async function BookedDesigns({ req }: WidgetServerProps) {
  const cards = await loadSafely(req, "booked-designs", () => loadBookedDesigns(req));
  if (!cards) return <WidgetError title={TITLE} />;

  const adminRoute = req.payload.config.routes.admin;
  return (
    <WidgetFrame title={TITLE}>
      {cards.length === 0 ? (
        <EmptyState>Még nincs lefoglalt minta.</EmptyState>
      ) : (
        <ul className={styles.cards}>
          {cards.map((card) => (
            <li key={card.id}>
              <Link className={styles.card} href={designBookingsUrl(adminRoute, card.id)} prefetch={false}>
                <DesignImage src={card.image} />
                <strong>{card.name}</strong>
                <Pill pillStyle={card.soldOut ? "dark" : "light"} size="small">
                  {card.label}
                </Pill>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WidgetFrame>
  );
}
