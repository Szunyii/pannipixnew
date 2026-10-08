import type { CollectionAfterChangeHook } from "payload";
import { placementLabel } from "@/lib/booking-input";
import type { Booking } from "@/payload-types";
import { siteUrl } from "../env";
import { loggableError } from "../log";
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
 *
 * This assumes the site runs as one long-running Node process (`next start`, as on Hostinger): a send
 * nobody waits for still finishes after the response has gone out. A send still in flight when the
 * process restarts is lost, and no failure is logged for it. A host that freezes the function once it
 * has responded would need these sends awaited.
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

  const site = siteUrl();
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
    adminUrl: `${site}/admin/collections/bookings/${doc.id}`,
    siteUrl: site,
  };

  for (const kind of kinds) {
    const toAdmin = kind === "admin-new";
    if (toAdmin && !adminEmail) {
      // The line names the setting to fix and nothing about the booking: no personal data in the log.
      req.payload.logger.warn("ADMIN_EMAIL is not set; the new-booking email was not sent.");
      continue;
    }
    const failed = (err: unknown) => {
      // Not the error itself: a mail error holds the addresses in its message, response and rejected list.
      req.payload.logger.error({
        err: loggableError(err),
        msg: `Booking email "${kind}" for booking ${doc.id} failed`,
      });
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
          // Marks the mail as machine-sent, so out-of-office replies and other auto-responders leave it alone.
          headers: { "Auto-Submitted": "auto-generated" },
        })
        .catch(failed);
    } catch (err) {
      // Building the email or handing it to the mail adapter threw at once, before any promise existed.
      failed(err);
    }
  }
  return doc;
};
