import { describe, expect, it } from "vitest";
import {
  type BookingEmailData,
  type BookingEmailKind,
  adminNewBookingEmail,
  bookingEmailsFor,
  customerConfirmedEmail,
  customerReceivedEmail,
  customerRejectedEmail,
  escapeHtml,
} from "@/cms/emails/templates";
import type { BookingStatus } from "@/lib/booking-rules";
import { PAYMENT_NOTE } from "@/lib/copy";

const data: BookingEmailData = {
  name: "Kovács Anna",
  email: "anna@example.com",
  phone: "+36 30 123 4567",
  placement: "Alkar",
  note: "<script>alert(1)</script>",
  designName: "P’CONs #027",
  slotStartsAt: "2026-10-14T08:00:00.000Z",
  price: 90000,
  adminUrl: "https://pannipix.test/admin/collections/bookings/5",
  siteUrl: "https://pannipix.test",
};

describe("templates", () => {
  it("escapes HTML", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });

  it("confirms receipt with the design, Budapest time and price", () => {
    const email = customerReceivedEmail(data);
    expect(email.subject).toBe("Megkaptam a foglalásod – P’CONs #027");
    expect(email.text).toContain("Szia Kovács Anna!");
    expect(email.text).toContain("Időpont: 2026. október 14., szerda 10:00");
    expect(email.text).toContain("Ár: 90 000 Ft");
    expect(email.text).toContain("most nem fizetsz semmit");
  });

  it("tells the customer, in the wording the site shares, that booking costs nothing now, and invites a reply", () => {
    const { text, html } = customerReceivedEmail(data);
    expect(text).toContain(`${PAYMENT_NOTE} Ha kérdésed van, válaszolj erre a levélre.`);
    expect(html).toContain(PAYMENT_NOTE);
  });

  it("tells a confirmed customer that the details, such as the exact placement, are settled by reply, as the site promises", () => {
    const { text, html } = customerConfirmedEmail(data);
    const note = "A részleteket, például a pontos elhelyezést, válaszlevélben egyeztetjük.";
    expect(text).toContain(note);
    expect(html).toContain(note);
  });

  it("gives the admin the customer's details with a link, and never raw HTML from the form", () => {
    const email = adminNewBookingEmail(data);
    expect(email.subject).toBe("Új foglalás: P’CONs #027 – 2026. október 14., szerda 10:00");
    expect(email.text).toContain("Telefon: +36 30 123 4567");
    expect(email.text).toContain("https://pannipix.test/admin/collections/bookings/5");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("links a rejected customer back to the designs", () => {
    expect(customerRejectedEmail(data).text).toContain("https://pannipix.test/#flash");
  });

  it.each(["\n", "\r\n"])("turns a line break (%j) in a note into <br> after escaping it, and keeps it in the text", (lineBreak) => {
    const email = adminNewBookingEmail({ ...data, note: `Bal alkar${lineBreak}külső <oldal>` });
    expect(email.html).toContain("Bal alkar<br>külső &lt;oldal&gt;");
    expect(email.text).toContain(`Megjegyzés: Bal alkar${lineBreak}külső <oldal>`);
  });

  it("is a full HTML document that scales on a phone and keeps its look on the wrapper, not only on <body>", () => {
    const { html } = customerRejectedEmail(data);
    expect(html).toMatch(/<head>.*<meta charset="utf-8">.*<\/head>/);
    expect(html).toContain('<meta name="viewport" content="width=device-width,initial-scale=1">');
    const body = /<body style="([^"]*)"/.exec(html)?.[1] ?? "";
    const wrapper = /<div style="([^"]*)"/.exec(html)?.[1] ?? "";
    for (const declaration of ["background:#f7f7f5", "color:#121211", "font-family:Georgia", "font-size:16px", "line-height:1.6"]) {
      expect(body).toContain(declaration);
      expect(wrapper).toContain(declaration);
    }
  });
});

describe("bookingEmailsFor", () => {
  it("tells the admin and the customer about a website booking", () => {
    expect(bookingEmailsFor({ operation: "create", isPublic: true, status: "pending" })).toEqual([
      "admin-new",
      "customer-received",
    ]);
  });

  it("does not tell the admin about a booking the admin made", () => {
    expect(bookingEmailsFor({ operation: "create", isPublic: false, status: "pending" })).toEqual(["customer-received"]);
    expect(bookingEmailsFor({ operation: "create", isPublic: false, status: "confirmed" })).toEqual(["customer-confirmed"]);
    expect(bookingEmailsFor({ operation: "create", isPublic: false, status: "completed" })).toEqual([]);
  });

  describe("on an update", () => {
    // Status before, status after, emails sent. Only a decision on an open booking is news for the customer:
    // completing a booking and correcting a status afterwards (completed to confirmed, rejected to cancelled) are not.
    it.each<[BookingStatus, BookingStatus, BookingEmailKind[]]>([
      ["pending", "confirmed", ["customer-confirmed"]],
      ["pending", "rejected", ["customer-rejected"]],
      ["pending", "cancelled", ["customer-cancelled"]],
      ["confirmed", "cancelled", ["customer-cancelled"]],
      ["confirmed", "rejected", ["customer-rejected"]],
      ["pending", "completed", []],
      ["confirmed", "completed", []],
      ["completed", "confirmed", []],
      ["rejected", "confirmed", []],
      ["cancelled", "confirmed", []],
      ["rejected", "cancelled", []],
      ["cancelled", "rejected", []],
    ])("%s to %s sends %j", (previousStatus, status, expected) => {
      expect(bookingEmailsFor({ operation: "update", isPublic: false, status, previousStatus })).toEqual(expected);
    });

    it.each<BookingStatus>(["pending", "confirmed", "completed", "rejected", "cancelled"])(
      "sends nothing while the status stays %s",
      (status) => {
        expect(bookingEmailsFor({ operation: "update", isPublic: false, status, previousStatus: status })).toEqual([]);
      },
    );

    it("sends nothing when the previous status is unknown", () => {
      for (const status of ["confirmed", "rejected", "cancelled"] as const) {
        expect(bookingEmailsFor({ operation: "update", isPublic: false, status })).toEqual([]);
        expect(bookingEmailsFor({ operation: "update", isPublic: false, status, previousStatus: null })).toEqual([]);
      }
    });
  });
});
