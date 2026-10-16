import { type BookingStatus, isActiveStatus } from "@/lib/booking-rules";
import { PAYMENT_NOTE } from "@/lib/copy";
import { SLOT_PICKING } from "@/lib/features";
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
  /** Empty until the booking has a slot: the emails then leave the time out. */
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

/** The booking's time, or null while it has no slot: each email words itself around a missing time. */
const when = (d: BookingEmailData) => (d.slotStartsAt ? formatSlotFull(d.slotStartsAt) : null);
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

/** The design, the time once the booking has one, and the price. */
function summary(d: BookingEmailData): [string, string][] {
  const time = when(d);
  const rows: [string, string][] = [["Minta", d.designName]];
  if (time) rows.push(["Időpont", time]);
  rows.push(["Ár", price(d)]);
  return rows;
}

const details = (d: BookingEmailData): Block => ({ rows: summary(d) });
const greeting = (d: BookingEmailData): Block => ({ p: `Szia ${d.name}!` });
const signature: Block = { p: "PANNIPIX" };
/** The site lists free slots only while visitors pick one. */
const designsLink = (d: BookingEmailData): Block => ({
  link: [SLOT_PICKING ? "Flash minták és szabad időpontok" : "Flash minták", `${d.siteUrl}/#flash`],
});

export function customerReceivedEmail(d: BookingEmailData): EmailContent {
  return render(`Megkaptam a foglalásod – ${d.designName}`, [
    greeting(d),
    {
      p: when(d)
        ? "Megkaptam a foglalásodat. Hamarosan átnézem, és e-mailben visszaigazolom."
        : "Megkaptam a foglalásodat. Hamarosan átnézem, és e-mailben visszaigazolom; az időpontot utána egyeztetjük.",
    },
    details(d),
    { p: `${PAYMENT_NOTE} Ha kérdésed van, válaszolj erre a levélre.` },
    signature,
  ]);
}

export function customerConfirmedEmail(d: BookingEmailData): EmailContent {
  const time = when(d);
  if (!time) {
    return render(`Visszaigazolva: ${d.designName}`, [
      greeting(d),
      { p: "Visszaigazolom a foglalásodat!" },
      details(d),
      { p: "Az időpontot és a részleteket, például a pontos elhelyezést, válaszlevélben egyeztetjük." },
      { p: "Ha meggondoltad magad, kérlek, minél előbb válaszolj erre a levélre." },
      signature,
    ]);
  }
  return render(`Visszaigazolva: ${d.designName}, ${time}`, [
    greeting(d),
    { p: "Visszaigazolom a foglalásodat, várlak!" },
    details(d),
    { p: "A részleteket, például a pontos elhelyezést, válaszlevélben egyeztetjük." },
    { p: "Ha mégsem tudsz jönni, kérlek, minél előbb válaszolj erre a levélre." },
    signature,
  ]);
}

export function customerRejectedEmail(d: BookingEmailData): EmailContent {
  const time = when(d);
  return render(`A foglalásod nem jött létre – ${d.designName}`, [
    greeting(d),
    {
      p: time
        ? `Sajnos a ${time} időpontra szóló foglalásodat nem tudom vállalni.`
        : "Sajnos ezt a foglalásodat nem tudom vállalni.",
    },
    {
      p: SLOT_PICKING
        ? "Ha másik időpont vagy minta is jó, itt találod a szabadokat:"
        : "Ha másik minta is tetszik, itt találod a foglalhatókat:",
    },
    designsLink(d),
    signature,
  ]);
}

export function customerCancelledEmail(d: BookingEmailData): EmailContent {
  const time = when(d);
  return render(time ? `Lemondva: ${d.designName}, ${time}` : `Lemondva: ${d.designName}`, [
    greeting(d),
    { p: time ? `A ${time} időpontra szóló foglalásod le lett mondva.` : "A foglalásod le lett mondva." },
    { p: SLOT_PICKING ? "Ha új időpontot szeretnél, itt foglalhatsz:" : "Ha újra foglalnál, itt találod a mintákat:" },
    designsLink(d),
    signature,
  ]);
}

export function adminNewBookingEmail(d: BookingEmailData): EmailContent {
  const time = when(d);
  const rows: [string, string][] = [
    ...summary(d),
    ["Név", d.name],
    ["E-mail", d.email],
    ["Telefon", d.phone],
    ["Testtáj", d.placement],
  ];
  if (d.note) rows.push(["Megjegyzés", d.note]);
  return render(time ? `Új foglalás: ${d.designName} – ${time}` : `Új foglalás: ${d.designName}`, [
    {
      p: time
        ? "Új foglalás érkezett az oldalról, jóváhagyásra vár."
        : "Új foglalás érkezett az oldalról: jóváhagyásra és időpontra vár.",
    },
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
 * is confirmed, a rejection or cancellation when an active booking is let go. Completing a booking, giving it a slot
 * or moving it to another one, and correcting a status afterwards (completed to confirmed, rejected to cancelled)
 * send none.
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
