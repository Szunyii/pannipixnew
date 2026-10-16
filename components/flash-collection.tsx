"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import { type FlashDesign, designName, designPath, formatPrice, rowOrder } from "./data";
import { ArrowRight, ChevronLeft, ChevronRight, Eye, Heart } from "./icons";
import { useStore } from "./store";
import { Arrow, Pcons, btn, container } from "./ui";

export function showFlashProcess() {
  window.dispatchEvent(new CustomEvent("process-tab", { detail: "flash" }));
}

// Kept on its own layer: a button at a fractional offset otherwise snaps a pixel sideways as it starts to scale.
const roundBtn =
  "grid size-11 place-items-center rounded-full bg-paper text-ink transition-[scale] duration-300 ease-[ease] will-change-transform hover:scale-105 active:scale-95 active:duration-150 active:ease-settle";

function FlashCard({ design }: { design: FlashDesign }) {
  const { favorites, toggleFavorite } = useStore();
  const [onSkin, setOnSkin] = useState(false);
  const name = designName(design);
  const href = designPath(design);
  const saved = favorites.has(design.id);
  const { soldOut } = design.availability;
  const badge = soldOut ? "Elkelt" : design.badge;
  // The eye fades the piece on skin in over the sheet, when there is a photo of it.
  const sheet = design.images[0];
  const photo = design.images.find((i) => i.kind === "photo" && i !== sheet);
  const sizes = "(min-width: 640px) 19rem, 72vw";
  // Hover zooms slowly, the photo fades quicker. Each image scales on its own layer: a shared
  // scaled wrapper would cut the drawing's multiply off from the paper.
  const layer =
    "[transition:scale_700ms_ease,opacity_300ms_var(--ease-settle)] will-change-transform motion-safe:group-hover:scale-[1.035]";

  return (
    <li className="w-[72vw] max-w-[20rem] shrink-0 snap-start sm:w-[19rem]">
      <article className="group">
        {/* The sheet: the drawing between two rules, the way the flash sheets lay the pieces out. */}
        <div className="relative aspect-[3/4] border-t border-hairline">
          <span aria-hidden="true" className="absolute inset-y-0 left-[9%] w-px bg-hairline" />
          <span aria-hidden="true" className="absolute inset-y-0 right-[9%] w-px bg-hairline" />
          <Link href={href} className="absolute inset-x-[9%] inset-y-0 overflow-hidden focus-visible:-outline-offset-4">
            <Image
              src={sheet.src}
              alt={photo && onSkin ? "" : sheet.alt}
              fill
              quality={90}
              sizes={sizes}
              className={`${layer} ${sheet.kind === "art" ? "object-contain p-[7%] mix-blend-multiply" : "object-cover"} ${soldOut ? "opacity-35" : ""}`}
            />
            {photo && (
              <Image
                src={photo.src}
                alt={onSkin ? photo.alt : ""}
                fill
                quality={90}
                sizes={sizes}
                className={`${layer} object-cover ${onSkin ? "" : "opacity-0"}`}
              />
            )}
          </Link>

          {badge && (
            <span className="pointer-events-none absolute left-[9%] top-4 ml-3 rounded-[3px] bg-paper px-2 py-1.5 font-sans text-[0.625rem] uppercase leading-none tracking-[0.18em]">
              {badge}
            </span>
          )}

          {/* The controls sit on the right rule. */}
          <div className="absolute right-[9%] top-3 flex translate-x-1/2 flex-col gap-1">
            <button
              type="button"
              onClick={() => toggleFavorite(design.id)}
              aria-pressed={saved}
              aria-label={`${name} mentése későbbre`}
              className={roundBtn}
            >
              <Heart size={19} filled={saved} />
            </button>
            {photo && (
              <button
                type="button"
                onClick={() => setOnSkin((v) => !v)}
                aria-pressed={onSkin}
                aria-label={`${name} bőrön`}
                className={`${roundBtn} aria-pressed:bg-ink aria-pressed:text-paper`}
              >
                <Eye size={19} />
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 font-display">
          <h3 className="truncate text-[1.375rem] leading-tight">
            {design.collection === "P’CONs" ? <Pcons suffix={` #${design.number}`} /> : name}
          </h3>
          <p className="mt-1 text-[1.25rem] leading-tight text-graphite">
            {soldOut ? <span className="italic text-muted">Lefoglalva</span> : formatPrice(design.price)}
          </p>
        </div>

        <Link
          href={href}
          className="group/more mt-4 flex h-12 items-center justify-center gap-3 rounded-[8px] border border-hairline text-[0.9375rem] transition-[border-color,scale] duration-300 hover:border-ink active:scale-[0.98] active:duration-100"
        >
          <ArrowRight size={18} className="transition-transform duration-300 ease-settle group-hover/more:translate-x-1" />
          Részletek<span className="sr-only">: {name}</span>
        </Link>
      </article>
    </li>
  );
}

const rowBtn = "flex size-11 items-center justify-center transition-opacity hover:opacity-60 active:opacity-40";

/** One collection: its tagline over a row of its designs, dragged sideways on touch and stepped with the arrows. */
function Row({ label, heading, designs }: { label: string; heading: string; designs: FlashDesign[] }) {
  const list = useRef<HTMLUListElement>(null);
  const [scrolls, setScrolls] = useState(false);

  // Arrows only while the row runs past the screen.
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const measure = () => setScrolls(el.scrollWidth > el.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const step = (dir: 1 | -1) => {
    const el = list.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * ((card?.offsetWidth ?? el.clientWidth) + gap), behavior: reduce ? "auto" : "smooth" });
  };

  // Shrinks to its cards when they all fit, so a short row's label lines up with the centred cards.
  return (
    <section aria-label={`${label} minták`} className="mx-auto mt-16 w-fit max-w-full first:mt-12 lg:mt-24 lg:first:mt-16">
      <h3 className="mx-auto max-w-[30rem] text-center font-display text-[clamp(1.75rem,3.2vw,2.6rem)] leading-[1.1] tracking-[-0.01em]">
        {heading}
      </h3>

      <div className="mt-8 flex items-center justify-between lg:mt-10">
        <p className="label text-[0.6875rem] text-muted">
          {label} · {designs.length} minta
        </p>
        {scrolls && (
          <div className="-mr-3.5 flex items-center">
            <button type="button" onClick={() => step(-1)} aria-label="Előző minták" className={rowBtn}>
              <ChevronLeft size={16} />
            </button>
            <button type="button" onClick={() => step(1)} aria-label="Következő minták" className={rowBtn}>
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Bleeds to the screen's edges, so the next card shows there is more; a short row centres under its tagline. */}
      <ul
        ref={list}
        className="-mx-(--gutter) mt-5 flex snap-x snap-mandatory gap-5 overflow-x-auto overscroll-x-contain px-(--gutter) pb-2 scroll-px-(--gutter) justify-center-safe scrollbar-none"
      >
        {rowOrder(designs).map((d) => (
          <FlashCard key={d.id} design={d} />
        ))}
      </ul>
    </section>
  );
}

export function FlashCollection({ designs }: { designs: FlashDesign[] }) {
  // The listed collections in their order, then any collection that left the list but still has designs.
  const known = new Set<string>(CATEGORIES.map((c) => c.label));
  const others = [...new Set(designs.map((d) => d.collection))].filter((label) => !known.has(label));
  const rows = [
    ...CATEGORIES.map((c) => ({ key: c.value, label: c.label, heading: c.tagline })),
    ...others.map((label) => ({ key: label, label, heading: label })),
  ]
    .map((row) => ({ ...row, designs: designs.filter((d) => d.collection === row.label) }))
    .filter((row) => row.designs.length > 0);

  return (
    <section id="flash" data-nav="flash" aria-labelledby="flash-title" className="border-t border-hairline">
      <div className={`${container} py-20 lg:py-28`}>
        <h2 id="flash-title" tabIndex={-1} className="label text-center text-muted focus:outline-none">
          Flash designs
        </h2>

        {rows.length > 0 ? (
          rows.map((row) => <Row key={row.key} label={row.label} heading={row.heading} designs={row.designs} />)
        ) : (
          <div className="mt-12 flex flex-col items-center rounded-[3px] border border-dashed border-ash/70 px-6 py-24 text-center">
            <p className="max-w-[30rem] font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight">
              Most nincs elérhető flash minta.
            </p>
            <p className="mt-4 max-w-[26rem] leading-[1.7] text-graphite">
              Kérj egyedi tervet a saját ötletedből, vagy nézz vissza később.
            </p>
            <a href="#kapcsolat" className={`${btn.primary} mt-9`}>
              Egyedi tervet kérek <Arrow />
            </a>
          </div>
        )}

        <p className="mt-14 text-center lg:mt-20">
          <a href="#info" onClick={showFlashProcess} className="group label inline-flex min-h-11 items-center gap-3">
            Hogyan működik a flash <Arrow />
          </a>
        </p>
      </div>
    </section>
  );
}
