import { type BookingStatus, isActiveStatus } from "@/lib/booking-rules";
import { PAYMENT_NOTE } from "@/lib/copy";
import { formatPrice } from "@/lib/format";
import { formatSlotFull } from "@/lib/time";

export type BookingEmailData = {
  name: string;
  email: string;
  phone: string;
  /** Hungarian label, e.g. "Lábszár". */
  placement: string;
  note?: string | null;
  designName: string;
  slotStartsAt?: string | null;
  price?: number | null;
  adminUrl: string;
  siteUrl: string;
};

export type EmailContent = { subject: string; html: string; text: string };

type Block = { p: string } | { rows: [string, string][] } | { link: [string, string] };

export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}

/** A value for an HTML table cell: escaped first, then its line breaks (a note comes from a textarea) become <br>. */
const multiline = (value: string) => escapeHtml(value).replace(/\r?\n/g, "<br>");

/** Set on <body> and again on the wrapper <div>: some mail clients drop the styles of <body>. */
const BASE_STYLE = "background:#f7f7f5;color:#121211;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6";

const when = (d: BookingEmailData) => (d.slotStartsAt ? formatSlotFull(d.slotStartsAt) : "–");
const price = (d: BookingEmailData) => (typeof d.price === "number" ? formatPrice(d.price) : "–");

function render(subject: string, blocks: Block[]): EmailContent {
  const text = blocks
    .map((b) => {
      if ("p" in b) return b.p;
      if ("rows" in b) return b.rows.map(([k, v]) => `${k}: ${v}`).join("\n");
      return `${b.link[0]}: ${b.link[1]}`;
    })
    .join("\n\n");

  const body = blocks
    .map((b) => {
      if ("p" in b) return `<p style="margin:0 0 16px">${escapeHtml(b.p)}</p>`;
      if ("rows" in b) {
        const rows = b.rows
          .map(
            ([k, v]) =>
              `<tr><td style="padding:4px 16px 4px 0;color:#6e6d66;font-size:12px;letter-spacing:.16em;text-transform:uppercase;vertical-align:top">${escapeHtml(k)}</td><td style="padding:4px 0">${multiline(v)}</td></tr>`,
          )
          .join("");
        return `<table role="presentation" style="margin:0 0 20px;border-collapse:collapse">${rows}</table>`;
      }
      return `<p style="margin:0 0 16px"><a href="${escapeHtml(b.link[1])}" style="color:#121211">${escapeHtml(b.link[0])}</a></p>`;
    })
    .join("");

  const html = `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;${BASE_STYLE}"><div style="max-width:560px;margin:0 auto;padding:32px 24px;${BASE_STYLE}"><p style="margin:0 0 28px;font-size:13px;letter-spacing:.3em">PANNIPIX</p>${body}</div></body></html>`;
  return { subject, html, text };
}

const details = (d: BookingEmailData): Block => ({
  rows: [
    ["Minta", d.designName],
    ["Időpont", when(d)],
    ["Ár", price(d)],
  ],
});
const greeting = (d: BookingEmailData): Block => ({ p: `Szia ${d.name}!` });
const signature: Block = { p: "PANNIPIX" };
const designsLink = (d: BookingEmailData): Block => ({ link: ["Flash minták és szabad időpontok", `${d.siteUrl}/#flash`] });

export function customerReceivedEmail(d: BookingEmailData): EmailContent {
  return render(`Megkaptam a foglalásod – ${d.designName}`, [
    greeting(d),
    { p: "Megkaptam a foglalásodat. Hamarosan átnézem, és e-mailben visszaigazolom." },
    details(d),
    { p: `${PAYMENT_NOTE} Ha kérdésed van, válaszolj erre a levélre.` },
    signature,
  ]);
}

export function customerConfirmedEmail(d: BookingEmailData): EmailContent {
  return render(`Visszaigazolva: ${d.designName}, ${when(d)}`, [
    greeting(d),
    { p: "Visszaigazolom a foglalásodat, várlak!" },
    details(d),
    { p: "A részleteket, például a pontos elhelyezést, válaszlevélben egyeztetjük." },
    { p: "Ha mégsem tudsz jönni, kérlek, minél előbb válaszolj erre a levélre." },
    signature,
  ]);
}

export function customerRejectedEmail(d: BookingEmailData): EmailContent {
  return render(`A foglalásod nem jött létre – ${d.designName}`, [
    greeting(d),
    { p: `Sajnos a ${when(d)} időpontra szóló foglalásodat nem tudom vállalni.` },
    { p: "Ha másik időpont vagy minta is jó, itt találod a szabadokat:" },
    designsLink(d),
    signature,
  ]);
}

export function customerCancelledEmail(d: BookingEmailData): EmailContent {
  return render(`Lemondva: ${d.designName}, ${when(d)}`, [
    greeting(d),
    { p: `A ${when(d)} időpontra szóló foglalásod le lett mondva.` },
    { p: "Ha új időpontot szeretnél, itt foglalhatsz:" },
    designsLink(d),
    signature,
  ]);
}

export function adminNewBookingEmail(d: BookingEmailData): EmailContent {
  const rows: [string, string][] = [
    ["Minta", d.designName],
    ["Időpont", when(d)],
    ["Ár", price(d)],
    ["Név", d.name],
    ["E-mail", d.email],
    ["Telefon", d.phone],
    ["Testtáj", d.placement],
  ];
  if (d.note) rows.push(["Megjegyzés", d.note]);
  return render(`Új foglalás: ${d.designName} – ${when(d)}`, [
    { p: "Új foglalás érkezett az oldalról, jóváhagyásra vár." },
    { rows },
    { link: ["Megnyitás az adminban", d.adminUrl] },
  ]);
}

export type BookingEmailKind =
  | "admin-new"
  | "customer-received"
  | "customer-confirmed"
  | "customer-rejected"
  | "customer-cancelled";

/**
 * Which emails a booking change sends. The customer hears about a decision once: a confirmation when a pending booking
 * is confirmed, a rejection or cancellation when an active booking is let go. Completing a booking, moving it to
 * another slot and correcting a status afterwards (completed to confirmed, rejected to cancelled) send none.
 */
export function bookingEmailsFor({
  operation,
  isPublic,
  status,
  previousStatus,
}: {
  operation: "create" | "update";
  isPublic: boolean;
  status: BookingStatus;
  previousStatus?: BookingStatus | null;
}): BookingEmailKind[] {
  if (operation === "create") {
    const kinds: BookingEmailKind[] = isPublic ? ["admin-new"] : [];
    if (status === "pending") kinds.push("customer-received");
    if (status === "confirmed") kinds.push("customer-confirmed");
    return kinds;
  }
  if (status === "confirmed") return previousStatus === "pending" ? ["customer-confirmed"] : [];
  if (status === "rejected" && isActiveStatus(previousStatus)) return ["customer-rejected"];
  if (status === "cancelled" && isActiveStatus(previousStatus)) return ["customer-cancelled"];
  return [];
}
