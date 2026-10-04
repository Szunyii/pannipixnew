"use client";

import Image from "next/image";
import { useState } from "react";
import { type Collection, type FlashDesign, collections, designName, designs, formatPrice } from "./data";
import { Bag, Check, ChevronDown, Heart } from "./icons";
import { useStore } from "./store";
import { Arrow, Pcons, StyleTags, btn, container } from "./ui";

type Filter = "Összes" | Collection;
type Sort = "newest" | "price-asc" | "price-desc";

const sorters: Record<Sort, (a: FlashDesign, b: FlashDesign) => number> = {
  newest: (a, b) => Number(b.id) - Number(a.id),
  "price-asc": (a, b) => a.price - b.price,
  "price-desc": (a, b) => b.price - a.price,
};

export function showFlashProcess() {
  window.dispatchEvent(new CustomEvent("process-tab", { detail: "flash" }));
}

function FlashCard({ design }: { design: FlashDesign }) {
  const { favorites, cart, toggleFavorite, toggleCart, feature } = useStore();
  const name = designName(design);
  const saved = favorites.has(design.id);
  const inCart = cart.has(design.id);
  const image = design.images[0];

  return (
    <article className="group">
      <div className="relative aspect-[219/344] overflow-hidden rounded-[3px] bg-stencil">
        <a
          href="#kiemelt"
          onClick={() => feature(design.id)}
          aria-label={`${name} részletei`}
          className="absolute inset-0 focus-visible:-outline-offset-4"
        >
          <Image
            src={image.src}
            alt={image.alt}
            fill
            quality={90}
            sizes="(min-width: 1024px) 22vw, (min-width: 640px) 45vw, 50vw"
            className={`object-contain mix-blend-multiply transition-[transform,opacity] duration-700 ease-settle group-hover:scale-[1.035] ${design.sold ? "opacity-35" : ""}`}
          />
        </a>

        {(design.badge || design.sold) && (
          <span className="pointer-events-none absolute left-3 top-3 rounded-[3px] bg-paper px-2 py-1.5 font-sans text-[0.625rem] uppercase leading-none tracking-[0.18em]">
            {design.sold ? "Elkelt" : design.badge}
          </span>
        )}

        <button
          type="button"
          onClick={() => toggleFavorite(design.id)}
          aria-pressed={saved}
          aria-label={saved ? `${name} eltávolítása a mentettek közül` : `${name} mentése későbbre`}
          className="absolute right-2 top-2 grid size-11 place-items-center rounded-full bg-paper/90 transition-[scale] duration-300 hover:scale-105 active:scale-90 active:duration-75"
        >
          <Heart size={19} filled={saved} />
        </button>
      </div>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-[1.0625rem] leading-snug sm:text-[1.1875rem]">
            {design.collection === "P’CONs" ? <Pcons suffix={` #${design.id}`} /> : name}
          </h3>
          <p className="mt-1 font-display text-[1rem] text-graphite sm:text-[1.0625rem]">
            {design.sold ? <span className="italic text-muted">Már bőrön</span> : formatPrice(design.price)}
          </p>
        </div>
        {!design.sold && (
          <button
            type="button"
            onClick={() => toggleCart(design.id)}
            aria-pressed={inCart}
            aria-label={inCart ? `${name} kivétele a kosárból` : `${name} kosárba`}
            className={`grid size-11 shrink-0 place-items-center rounded-[6px] border transition-[background-color,border-color,color,scale] duration-300 active:scale-90 active:duration-75 ${
              inCart ? "border-ink bg-ink text-paper" : "border-hairline bg-white hover:border-ink"
            }`}
          >
            {inCart ? <Check size={19} /> : <Bag size={19} />}
          </button>
        )}
      </div>
    </article>
  );
}

export function FlashCollection() {
  const [filter, setFilter] = useState<Filter>("Összes");
  const [sort, setSort] = useState<Sort>("newest");

  const visible = designs
    .filter((d) => filter === "Összes" || d.collection === filter)
    .sort(sorters[sort]);

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
              Előre megtervezett minták, amelyek a PANNIPIX világát képviselik. Mindegyik csak egyszer kerül
              bőrre, utána lekerül a kollekcióból.
            </p>
            <a href="#info" onClick={showFlashProcess} className="group label -mb-3 mt-3 inline-flex items-center gap-3 py-3">
              Hogyan működik a flash <Arrow />
            </a>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-6 border-b border-hairline pb-6 md:flex-row md:items-center md:justify-between">
          <div role="group" aria-label="Kollekció szűrése" className="-mx-5 flex gap-2.5 overflow-x-auto overscroll-x-contain px-5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
            {(["Összes", ...collections] as Filter[]).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={filter === c}
                onClick={() => setFilter(c)}
                className="h-11 shrink-0 rounded-[6px] bg-stencil px-5 font-display text-[1.0625rem] transition-[background-color,color,scale] duration-300 hover:bg-[#e3e3df] active:scale-[0.97] active:duration-75 aria-pressed:bg-ink aria-pressed:text-paper"
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-8 md:justify-end">
            <p className="text-[0.9375rem] text-muted" aria-live="polite">
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
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 lg:grid-cols-4 lg:gap-y-16">
            {visible.map((d) => (
              <FlashCard key={d.id} design={d} />
            ))}
          </div>
        ) : (
          <div className="mt-10 flex flex-col items-center rounded-[3px] border border-dashed border-ash/70 px-6 py-24 text-center">
            <p className="max-w-[30rem] font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight">
              Ebben a kollekcióban most nincs elérhető minta.
            </p>
            <p className="mt-4 max-w-[26rem] leading-[1.7] text-graphite">
              Nézd meg a P’CONs darabjait, vagy kérj egyedi tervet a saját ötletedből.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={() => setFilter("P’CONs")} className={btn.outline}>
                P’CONs minták
              </button>
              <a href="#kapcsolat" className={btn.primary}>
                Egyedi tervet kérek <Arrow />
              </a>
            </div>
          </div>
        )}

        {visible.length > 0 && (
          <div className="mt-20 flex justify-center">
            <button type="button" className={`${btn.primary} min-w-[18rem]`}>
              Több minta mutatása <Arrow />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
