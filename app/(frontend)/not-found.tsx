import Link from "next/link";
import { Arrow, btn, container } from "@/components/ui";

// A design page whose design is gone or hidden lands here, inside the site's header and footer.
export default function NotFound() {
  return (
    <section aria-labelledby="not-found-title" className="bg-paper">
      <div className={`${container} flex flex-col items-center py-28 text-center lg:py-40`}>
        <p className="label text-muted">404</p>
        <h1
          id="not-found-title"
          className="mt-5 font-display text-[clamp(2.4rem,5vw,4rem)] font-normal leading-none tracking-[-0.02em]"
        >
          Ez az oldal nem létezik.
        </h1>
        <p className="mt-6 max-w-[26rem] leading-[1.7] text-graphite">
          Lehet, hogy a minta, amit kerestél, már nem elérhető. A többi mintát a főoldalon találod.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link href="/#flash" className={btn.primary}>
            Flash minták <Arrow />
          </Link>
          <Link href="/" className={btn.outline}>
            Vissza a főoldalra
          </Link>
        </div>
      </div>
    </section>
  );
}
