import type { Metadata } from "next";
import Link from "next/link";
import { bodoni, jost } from "./fonts";
import "./(frontend)/globals.css";

export const metadata: Metadata = { title: "Az oldal nem található – PANNIPIX" };

// Unknown URLs skip both root layouts, so this page brings its own fonts and styles.
export default function GlobalNotFound() {
  return (
    <html lang="hu" className={`${bodoni.variable} ${jost.variable} h-full antialiased`}>
      <body className="grid min-h-full place-items-center px-5 text-center">
        <main>
          <p className="label text-muted">404</p>
          <h1 className="mt-5 font-display text-[clamp(2.4rem,5vw,4rem)] leading-none tracking-[-0.02em]">
            Ez az oldal nem létezik.
          </h1>
          <Link href="/" className="label mt-9 inline-flex h-12 items-center rounded-[5px] bg-ink px-6 text-paper">
            Vissza a főoldalra
          </Link>
        </main>
      </body>
    </html>
  );
}
