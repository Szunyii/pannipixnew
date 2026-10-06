import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Jost } from "next/font/google";
import "./globals.css";

// Bodoni's hairline contrast mirrors single-needle fine-line work.
const bodoni = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "PANNIPIX — egyedi tetoválás és flash minták",
  description:
    "Konceptuális, absztrakt és mikrorealista tetoválások. Egyedi tervezés vagy egyszer elkészíthető flash minták a P’CONs kollekcióból.",
};

export const viewport: Viewport = {
  // The page is light-only (color-scheme: light), so one colour matches the header in both OS themes.
  themeColor: "#f7f7f5",
  // Paint edge to edge; the gutter, header and menu pad themselves back with env(safe-area-inset-*).
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="hu"
      className={`${bodoni.variable} ${jost.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
