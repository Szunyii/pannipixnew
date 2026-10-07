import { describe, expect, it } from "vitest";
import {
  type BookingEmailData,
  adminNewBookingEmail,
  bookingEmailsFor,
  customerReceivedEmail,
  customerRejectedEmail,
  escapeHtml,
} from "@/cms/emails/templates";

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

  it("writes to the customer when the status changes to confirmed, rejected or cancelled", () => {
    const change = (status: string, previousStatus = "pending") =>
      bookingEmailsFor({ operation: "update", isPublic: false, status, previousStatus });
    expect(change("confirmed")).toEqual(["customer-confirmed"]);
    expect(change("rejected")).toEqual(["customer-rejected"]);
    expect(change("cancelled", "confirmed")).toEqual(["customer-cancelled"]);
    expect(change("completed", "confirmed")).toEqual([]);
    expect(change("confirmed", "confirmed")).toEqual([]);
  });
});
