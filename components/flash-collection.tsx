"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { type BookingRule, type FlashCategory, type FlashDesign, designName, formatPrice, sharedRule } from "./data";
import { Calendar, ChevronDown, Heart } from "./icons";
import { useStore } from "./store";
import { Arrow, Pcons, StyleTags, btn, container } from "./ui";

type Sort = "newest" | "price-asc" | "price-desc";

/** Cards shown at first, and added by each "Több minta mutatása". */
const PAGE = 8;

// A sold-out design can't be had at any price, so the price sorts put it last.
const soldOutLast = (a: FlashDesign, b: FlashDesign) => Number(a.availability.soldOut) - Number(b.availability.soldOut);

const sorters: Record<Sort, (a: FlashDesign, b: FlashDesign) => number> = {
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
  "price-asc": (a, b) => soldOutLast(a, b) || a.price - b.price,
  "price-desc": (a, b) => soldOutLast(a, b) || b.price - a.price,
};

/** How often a design is tattooed, when every collection books by the same rule. */
const ruleIntro: Record<BookingRule, string> = {
  single: "Mindegyik csak egyszer kerül bőrre, utána lekerül a kínálatból.",
  limited: "Mindegyik csak meghatározott számú alkalommal készül el.",
  unlimited: "Bármelyik többször is elkészülhet.",
};
const mixedIntro = "Van, amelyik csak egyszer kerül bőrre, és van, amelyik többször is: ezt a kollekció dönti el.";

export function showFlashProcess() {
  window.dispatchEvent(new CustomEvent("process-tab", { detail: "flash" }));
}

function FlashCard({ design }: { design: FlashDesign }) {
  const { favorites, toggleFavorite, feature, openBooking } = useStore();
  const name = designName(design);
  const saved = favorites.has(design.id);
  const { soldOut, rule, remaining } = design.availability;
  const badge = soldOut ? "Elkelt" : design.badge;
  const image = design.images[0];

  return (
    <article className="group">
      <div className="relative aspect-[219/344] overflow-hidden rounded-[3px] bg-stencil">
        <a
          href="#kiemelt"
          onClick={() => feature(design.id)}
          aria-label={`${name} részletei${soldOut ? " – elkelt" : ""}`}
          className="absolute inset-0 focus-visible:-outline-offset-4"
        >
          <Image
            src={image.src}
            alt={image.alt}
            fill
            quality={90}
            sizes="(min-width: 1440px) 320px, (min-width: 1024px) 22vw, (min-width: 640px) 45vw, 50vw"
            className={`object-contain mix-blend-multiply transition-[transform,opacity] duration-700 ease-settle group-hover:scale-[1.035] ${soldOut ? "opacity-35" : ""}`}
          />
        </a>

        {badge && (
          <span className="pointer-events-none absolute left-3 top-3 rounded-[3px] bg-paper px-2 py-1.5 font-sans text-[0.625rem] uppercase leading-none tracking-[0.18em]">
            {badge}
          </span>
        )}

        <button
          type="button"
          onClick={() => toggleFavorite(design.id)}
          aria-pressed={saved}
          aria-label={`${name} mentése későbbre`}
          className="absolute right-2 top-2 grid size-11 place-items-center rounded-full bg-paper/90 transition-[scale] duration-300 hover:scale-105 active:scale-90 active:duration-75"
        >
          <Heart size={19} filled={saved} />
        </button>
      </div>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-[1.0625rem] leading-snug sm:text-[1.1875rem]">
            {design.collection === "P’CONs" ? <Pcons suffix={` #${design.number}`} /> : name}
          </h3>
          <p className="mt-1 font-display text-[1rem] text-graphite sm:text-[1.0625rem]">
            {soldOut ? <span className="italic text-muted">Lefoglalva</span> : formatPrice(design.price)}
          </p>
          {!soldOut && rule === "limited" && (
            <p className="mt-1.5 text-[0.8125rem] text-muted">még {remaining} alkalom</p>
          )}
        </div>
        {!soldOut && (
          <button
            type="button"
            onClick={() => openBooking(design.id)}
            aria-label={`${name} – időpontfoglalás`}
            className="grid size-11 shrink-0 place-items-center rounded-[6px] border border-hairline bg-white transition-[background-color,border-color,color,scale] duration-300 hover:border-ink hover:bg-ink hover:text-paper active:scale-90 active:duration-75"
          >
            <Calendar size={19} />
          </button>
        )}
      </div>
    </article>
  );
}

export function FlashCollection({ designs, categories }: { designs: FlashDesign[]; categories: FlashCategory[] }) {
  /** The collection shown, by name; null shows every collection. */
  const [filter, setFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("newest");
  const [shown, setShown] = useState(PAGE);
  const grid = useRef<HTMLDivElement>(null);
  const allChip = useRef<HTMLButtonElement>(null);

  const visible = designs.filter((d) => filter === null || d.collection === filter).sort(sorters[sort]);
  const rule = sharedRule(categories);

  const choose = (name: string | null) => {
    setFilter(name);
    setShown(PAGE);
  };

  // Focus moves on to the first card just revealed, instead of staying behind on the button
  // (or falling to <body> when the last page takes the button away).
  const showMore = () => {
    const first = shown;
    flushSync(() => setShown((n) => n + PAGE));
    grid.current?.children[first]?.querySelector("a")?.focus();
  };

  // The empty state's "Összes minta" goes away once clicked; focus lands on the filter it switched to, not on <body>.
  const showAll = () => {
    flushSync(() => choose(null));
    allChip.current?.focus();
  };

  return (
    <section id="flash" data-nav="flash" aria-labelledby="flash-title" className="border-t border-hairline">
      <div className={`${container} py-24 lg:py-32`}>
        <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="label text-muted">Flash kollekció</p>
            <h2
              id="flash-title"
              className="mt-4 font-display text-[clamp(4rem,10vw,8.75rem)] font-normal leading-[0.88] tracking-[-0.03em]"
            >
              <Pcons />
            </h2>
            <StyleTags className="mt-6" />
          </div>
          <div className="max-w-[23rem] lg:pb-2">
            <p className="leading-[1.7] text-graphite">
              Előre megtervezett minták, amelyek a PANNIPIX világát képviselik. {rule ? ruleIntro[rule] : mixedIntro}
            </p>
            <a href="#info" onClick={showFlashProcess} className="group label -mb-3 mt-3 inline-flex items-center gap-3 py-3">
              Hogyan működik a flash <Arrow />
            </a>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-6 border-b border-hairline pb-6 md:flex-row md:items-center md:justify-between">
          <div role="group" aria-label="Kollekció szűrése" className="-mx-5 flex gap-2.5 overflow-x-auto overscroll-x-contain px-5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
            {[null, ...categories].map((c) => (
              <button
                key={c?.id ?? "all"}
                ref={c ? undefined : allChip}
                type="button"
                aria-pressed={filter === (c?.name ?? null)}
                onClick={() => choose(c?.name ?? null)}
                className="h-11 shrink-0 rounded-[6px] bg-stencil px-5 font-display text-[1.0625rem] transition-[background-color,color,scale] duration-300 hover:bg-[#e3e3df] active:scale-[0.97] active:duration-75 aria-pressed:bg-ink aria-pressed:text-paper"
              >
                {c?.name ?? "Összes"}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-8 md:justify-end">
            {/* Read out whole, filter included, so switching to a collection of the same size is still announced. */}
            <p className="text-[0.9375rem] text-muted" aria-live="polite" aria-atomic="true">
              <span className="sr-only">{filter ?? "Összes"}: </span>
              {visible.length} minta
            </p>
            <label className="relative flex items-center gap-3 text-[0.9375rem]">
              <span className="text-muted">Rendezés</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="min-h-11 cursor-pointer appearance-none bg-transparent pr-7 text-ink [field-sizing:content] focus-visible:outline-offset-2"
              >
                <option value="newest">Legújabb</option>
                <option value="price-asc">Ár szerint növekvő</option>
                <option value="price-desc">Ár szerint csökkenő</option>
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-0" />
            </label>
          </div>
        </div>

        {visible.length > 0 ? (
          <div ref={grid} className="mt-10 grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 lg:grid-cols-4 lg:gap-y-16">
            {visible.slice(0, shown).map((d) => (
              <FlashCard key={d.id} design={d} />
            ))}
          </div>
        ) : (
          <div className="mt-10 flex flex-col items-center rounded-[3px] border border-dashed border-ash/70 px-6 py-24 text-center">
            <p className="max-w-[30rem] font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight">
              {filter === null ? "Most nincs elérhető flash minta." : "Ebben a kollekcióban most nincs elérhető minta."}
            </p>
            <p className="mt-4 max-w-[26rem] leading-[1.7] text-graphite">
              {filter === null
                ? "Kérj egyedi tervet a saját ötletedből, vagy nézz vissza később."
                : "Nézz körül a többi kollekcióban, vagy kérj egyedi tervet a saját ötletedből."}
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              {filter !== null && (
                <button type="button" onClick={showAll} className={btn.outline}>
                  Összes minta
                </button>
              )}
              <a href="#kapcsolat" className={btn.primary}>
                Egyedi tervet kérek <Arrow />
              </a>
            </div>
          </div>
        )}

        {visible.length > shown && (
          <div className="mt-20 flex justify-center">
            <button type="button" onClick={showMore} className={`${btn.primary} min-w-[18rem]`}>
              Több minta mutatása <Arrow />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
