import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type BookingEmailData,
  type BookingEmailKind,
  adminNewBookingEmail,
  bookingEmailsFor,
  customerCancelledEmail,
  customerConfirmedEmail,
  customerReceivedEmail,
  customerRejectedEmail,
  escapeHtml,
} from "@/cms/emails/templates";
import type { BookingStatus } from "@/lib/booking-rules";
import { PAYMENT_NOTE } from "@/lib/copy";

// Both settings of the switch are pinned here, so the tests hold whichever way lib/features.ts has it.
const features = vi.hoisted(() => ({ slotPicking: true }));
vi.mock("@/lib/features", () => ({
  get SLOT_PICKING() {
    return features.slotPicking;
  },
}));

beforeEach(() => {
  features.slotPicking = true;
});

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

describe("templates for a booking with a time", () => {
  const time = "2026. október 14., szerda 10:00";

  it("put the time into the subject of the confirmation and the cancellation", () => {
    expect(customerConfirmedEmail(data).subject).toBe(`Visszaigazolva: P’CONs #027, ${time}`);
    expect(customerCancelledEmail(data).subject).toBe(`Lemondva: P’CONs #027, ${time}`);
  });

  it("name the time the customer loses", () => {
    expect(customerRejectedEmail(data).text).toContain(`Sajnos a ${time} időpontra szóló foglalásodat nem tudom vállalni.`);
    expect(customerCancelledEmail(data).text).toContain(`A ${time} időpontra szóló foglalásod le lett mondva.`);
  });

  it("tell a confirmed customer they are expected", () => {
    const { text } = customerConfirmedEmail(data);
    expect(text).toContain("Visszaigazolom a foglalásodat, várlak!");
    expect(text).toContain("Ha mégsem tudsz jönni, kérlek, minél előbb válaszolj erre a levélre.");
  });
});

describe("templates for a booking that has no time yet", () => {
  const untimed: BookingEmailData = { ...data, slotStartsAt: null };
  const all = [
    customerReceivedEmail,
    customerConfirmedEmail,
    customerRejectedEmail,
    customerCancelledEmail,
    adminNewBookingEmail,
  ];

  it("leave the time out instead of showing a placeholder for it", () => {
    for (const build of all) {
      const { subject, text, html } = build(untimed);
      expect(text).not.toMatch(/Időpont:|időpontra szóló/);
      expect(html).not.toMatch(/Időpont<|időpontra szóló/);
      // The dash that used to stand in for a missing time.
      expect(`${subject}\n${text}`).not.toMatch(/[,:–] –/);
    }
  });

  it("still show the design and the price", () => {
    for (const build of [customerReceivedEmail, customerConfirmedEmail, adminNewBookingEmail]) {
      const { text } = build(untimed);
      expect(text).toContain("Minta: P’CONs #027");
      expect(text).toContain("Ár: 90 000 Ft");
    }
  });

  it("tell the customer on receipt that the time is arranged after the confirmation", () => {
    expect(customerReceivedEmail(untimed).text).toContain(
      "Megkaptam a foglalásodat. Hamarosan átnézem, és e-mailben visszaigazolom; az időpontot utána egyeztetjük.",
    );
  });

  it("confirm the booking and leave the time to be settled by reply", () => {
    const { subject, text } = customerConfirmedEmail(untimed);
    expect(subject).toBe("Visszaigazolva: P’CONs #027");
    expect(text).toContain("Visszaigazolom a foglalásodat!");
    expect(text).toContain("Az időpontot és a részleteket, például a pontos elhelyezést, válaszlevélben egyeztetjük.");
    expect(text).toContain("Ha meggondoltad magad, kérlek, minél előbb válaszolj erre a levélre.");
    expect(text).not.toMatch(/várlak|mégsem tudsz jönni/);
  });

  it("reject and cancel the booking itself", () => {
    expect(customerRejectedEmail(untimed).text).toContain("Sajnos ezt a foglalásodat nem tudom vállalni.");
    const cancelled = customerCancelledEmail(untimed);
    expect(cancelled.subject).toBe("Lemondva: P’CONs #027");
    expect(cancelled.text).toContain("A foglalásod le lett mondva.");
  });

  it("tell the admin that the booking waits for a time as well as for approval", () => {
    const { subject, text } = adminNewBookingEmail(untimed);
    expect(subject).toBe("Új foglalás: P’CONs #027");
    expect(text).toContain("Új foglalás érkezett az oldalról: jóváhagyásra és időpontra vár.");
  });
});

describe("the way back to the site in a rejection or a cancellation", () => {
  it("offers the free slots while visitors pick one", () => {
    const rejected = customerRejectedEmail(data).text;
    expect(rejected).toContain("Ha másik időpont vagy minta is jó, itt találod a szabadokat:");
    expect(rejected).toContain("Flash minták és szabad időpontok: https://pannipix.test/#flash");
    expect(customerCancelledEmail(data).text).toContain("Ha új időpontot szeretnél, itt foglalhatsz:");
  });

  it("offers only the designs while they don't: the site lists no slots then", () => {
    features.slotPicking = false;
    const rejected = customerRejectedEmail(data).text;
    expect(rejected).toContain("Ha másik minta is tetszik, itt találod a foglalhatókat:");
    expect(rejected).toContain("Flash minták: https://pannipix.test/#flash");
    const cancelled = customerCancelledEmail(data).text;
    expect(cancelled).toContain("Ha újra foglalnál, itt találod a mintákat:");
    expect(cancelled).toContain("Flash minták: https://pannipix.test/#flash");
    for (const text of [rejected, cancelled]) expect(text).not.toMatch(/szabad időpont|új időpontot/);
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
