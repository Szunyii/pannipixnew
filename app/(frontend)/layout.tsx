import type { Metadata, Viewport } from "next";
import { BookingDialog } from "@/components/booking-dialog";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { StoreProvider } from "@/components/store";
import { SLOT_PICKING } from "@/lib/features";
import { bodoni, jost } from "../fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "PANNIPIX — egyedi tetoválás és flash minták", template: "%s – PANNIPIX" },
  description: `Konceptuális, absztrakt és mikrorealista tetoválások. Egyedi tervezés vagy ${
    SLOT_PICKING ? "időpontra foglalható" : "foglalható"
  } flash minták a PANNIPIX kollekciókból.`,
};

export const viewport: Viewport = {
  // The page is light-only (color-scheme: light), so one colour matches the header in both OS themes.
  themeColor: "#f7f7f5",
  // Paint edge to edge; the gutter, header and menu pad themselves back with env(safe-area-inset-*).
  viewportFit: "cover",
};

// The header, footer, favourites and the booking dialog are shared by the landing page and the design pages.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="hu"
      className={`${bodoni.variable} ${jost.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <StoreProvider>
          <a
            href="#main"
            className="label sr-only z-60 rounded-[5px] bg-ink px-4 py-3 text-paper focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
          >
            Ugrás a tartalomra
          </a>
          <Header />
          <main id="main">{children}</main>
          <Footer />
          <BookingDialog />
        </StoreProvider>
      </body>
    </html>
  );
}
