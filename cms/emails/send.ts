import type { CollectionAfterChangeHook } from "payload";
import { placementLabel } from "@/lib/booking-input";
import type { Booking } from "@/payload-types";
import {
  type BookingEmailData,
  type BookingEmailKind,
  type EmailContent,
  adminNewBookingEmail,
  bookingEmailsFor,
  customerCancelledEmail,
  customerConfirmedEmail,
  customerReceivedEmail,
  customerRejectedEmail,
} from "./templates";

const builders: Record<BookingEmailKind, (d: BookingEmailData) => EmailContent> = {
  "admin-new": adminNewBookingEmail,
  "customer-received": customerReceivedEmail,
  "customer-confirmed": customerConfirmedEmail,
  "customer-rejected": customerRejectedEmail,
  "customer-cancelled": customerCancelledEmail,
};

/**
 * Starts the booking's emails without waiting for them: a slow mail server must not hold up the
 * visitor or the admin. An email that fails to build, start or send is logged and skipped: it never
 * undoes the booking or keeps the other emails from going out.
 */
export const sendBookingEmails: CollectionAfterChangeHook<Booking> = async ({
  doc,
  previousDoc,
  operation,
  req,
  context,
}) => {
  const kinds = bookingEmailsFor({
    operation,
    isPublic: context.publicBooking === true,
    status: doc.status,
    previousStatus: previousDoc?.status,
  });
  if (kinds.length === 0) return doc;

  const siteUrl = (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const adminEmail = process.env.ADMIN_EMAIL;
  const data: BookingEmailData = {
    name: doc.name,
    email: doc.email,
    phone: doc.phone,
    placement: placementLabel(doc.placement),
    note: doc.note,
    designName: doc.designName ?? "",
    slotStartsAt: doc.slotStartsAt,
    price: doc.price,
    adminUrl: `${siteUrl}/admin/collections/bookings/${doc.id}`,
    siteUrl,
  };

  for (const kind of kinds) {
    const toAdmin = kind === "admin-new";
    if (toAdmin && !adminEmail) continue;
    const failed = (err: unknown) => {
      req.payload.logger.error({ err, msg: `Booking email "${kind}" for booking ${doc.id} failed` });
    };
    try {
      const { subject, html, text } = builders[kind](data);
      req.payload
        .sendEmail({
          to: toAdmin ? adminEmail : doc.email,
          replyTo: toAdmin ? doc.email : adminEmail,
          subject,
          html,
          text,
        })
        .catch(failed);
    } catch (err) {
      // Building the email or handing it to the mail adapter threw at once, before any promise existed.
      failed(err);
    }
  }
  return doc;
};
