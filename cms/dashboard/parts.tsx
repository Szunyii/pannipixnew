import { Banner, Pill, Thumbnail } from "@payloadcms/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { type BookingStatus, STATUS_LABELS } from "@/lib/booking-rules";
import styles from "./dashboard.module.css";

const STATUS_PILLS: Record<BookingStatus, "warning" | "success" | "light" | "light-gray"> = {
  pending: "warning",
  confirmed: "success",
  completed: "light",
  rejected: "light-gray",
  cancelled: "light-gray",
};

export function StatusPill({ status }: { status: BookingStatus }) {
  return (
    <Pill pillStyle={STATUS_PILLS[status]} size="small">
      {STATUS_LABELS[status]}
    </Pill>
  );
}

/** A design's image. Without one, or when it fails to load, Payload's Thumbnail shows its file icon. */
export function DesignImage({ src }: { src: string | null }) {
  return <Thumbnail className={styles.image} fileSrc={src ?? undefined} size="small" />;
}

/** A widget's frame: its heading, a link on the right when there is one, and its content. */
export function WidgetFrame({
  title,
  link,
  children,
}: {
  title: string;
  link?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <section className={styles.widget}>
      <header className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {link && (
          <Link className={styles.more} href={link.href}>
            {link.label}
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

/** What a widget shows when its query failed (see loadSafely); the rest of the dashboard still works. */
export function WidgetError({ title }: { title: string }) {
  return (
    <WidgetFrame title={title}>
      <Banner type="error">Nem sikerült betölteni. Töltsd újra az oldalt.</Banner>
    </WidgetFrame>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}
