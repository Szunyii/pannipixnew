"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { SLOT_PICKING } from "@/lib/features";
import { type BookingRule, type DesignImage, type FlashDesign, designName, designPath, formatPrice } from "./data";
import { ChevronLeft, ChevronRight, Heart, Plus, Resize, Sparkle, Torso } from "./icons";
import { useStore } from "./store";
import { Arrow, Pcons, StyleTags, btn, container } from "./ui";

function Picture({
  image,
  sizes,
  thumb = false,
  priority = false,
}: {
  image: DesignImage;
  sizes: string;
  thumb?: boolean;
  priority?: boolean;
}) {
  if (image.kind === "art") {
    return (
      <Image
        src={image.src}
        alt={thumb ? "" : image.alt}
        fill
        priority={priority}
        quality={90}
        sizes={sizes}
        className={`object-contain mix-blend-multiply ${thumb ? "p-[8%]" : "p-[5%]"}`}
      />
    );
  }
  // Photos fill the panel, the way the card shows them.
  return (
    <Image
      src={image.src}
      alt={thumb ? "" : image.alt}
      fill
      priority={priority}
      quality={90}
      sizes={sizes}
      className="object-cover"
    />
  );
}

function Fact({ icon, term, children }: { icon: React.ReactNode; term: string; children: React.ReactNode }) {
  return (
    <div className="relative pl-12">
      <dt className="label text-[0.6875rem] text-muted">
        <span className="absolute left-0 top-0 text-ink">{icon}</span>
        {term}
      </dt>
      <dd className="mt-2">{children}</dd>
    </div>
  );
}

/** What the design's booking rule means, in one term and one sentence. */
function ruleFact({ rule, limit, remaining, soldOut }: FlashDesign["availability"]) {
  if (rule === "single") {
    return {
      term: "Egyszer elkészíthető minta",
      body: soldOut ? "Ez a minta már gazdára talált." : "Ez a design csak egyszer készül el.",
    };
  }
  if (rule === "limited") {
    return {
      term: "Limitált minta",
      body: soldOut
        ? `Mind a ${limit} alkalom elkelt.`
        : `Összesen ${limit} alkalommal készül el, ebből még ${remaining} foglalható.`,
    };
  }
  return { term: "Korlátlanul foglalható", body: "Ez a minta többször is elkészülhet." };
}

const bookingSteps = SLOT_PICKING
  ? "Kiválasztasz egy szabad időpontot, és elküldöd a foglalást. Most nem fizetsz semmit: átnézem a foglalást, és e-mailben visszaigazolom."
  : "Elküldöd a foglalást, és most nem fizetsz semmit: átnézem, e-mailben visszaigazolom, és egyeztetjük az időpontot.";

/** The booking steps, and what a booking takes from the offer under the design's rule. */
function howItWorks(rule: BookingRule) {
  if (rule === "single") return `${bookingSteps} A foglalással a minta lekerül a kínálatból.`;
  if (rule === "limited") return `${bookingSteps} A foglalással a minta egy alkalma lekerül a kínálatból.`;
  return bookingSteps;
}

const stepLink = "flex min-h-11 items-center gap-1.5 px-2.5";

/** The design before or after this one in its collection's row; greyed out at the row's ends. */
function Neighbour({ design, children }: { design: FlashDesign | null; children: React.ReactNode }) {
  if (!design) {
    return (
      <span aria-disabled="true" className={`${stepLink} opacity-40`}>
        {children}
      </span>
    );
  }
  return (
    <Link href={designPath(design)} className={`${stepLink} transition-opacity hover:opacity-60 active:opacity-40`}>
      {children}
    </Link>
  );
}

export function DesignDetail({
  design,
  prev,
  next,
}: {
  design: FlashDesign;
  prev: FlashDesign | null;
  next: FlashDesign | null;
}) {
  const { favorites, toggleFavorite, openBooking } = useStore();
  const [active, setActive] = useState(0);
  // A refresh keeps the picked view but can bring fewer images; past the end, show the first.
  const current = active < design.images.length ? active : 0;
  const name = designName(design);
  const image = design.images[current];
  const saved = favorites.has(design.id);
  const { soldOut } = design.availability;
  const fact = ruleFact(design.availability);

  return (
    <section aria-labelledby="design-title" className="bg-paper">
      <div className={`${container} pb-28 pt-6 lg:pb-36 lg:pt-8`}>
        <div className="label flex items-center justify-between text-[0.6875rem]">
          <Link
            href="/#flash"
            className="-ml-2.5 flex min-h-11 items-center gap-1.5 px-2.5 text-muted transition-colors hover:text-ink"
          >
            <ChevronLeft size={15} /> Flash minták
          </Link>
          <nav aria-label="Szomszédos minták" className="-mr-2.5 flex items-center">
            <Neighbour design={prev}>
              <ChevronLeft size={15} /> Előző
            </Neighbour>
            <span aria-hidden="true" className="h-3.5 w-px bg-hairline" />
            <Neighbour design={next}>
              Következő <ChevronRight size={15} />
            </Neighbour>
          </nav>
        </div>

        <div className="relative mt-8 grid gap-12 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-20 lg:px-12">
          {/* The rules that frame the sheets frame the piece here too. */}
          <span aria-hidden="true" className="absolute inset-y-0 -left-2.5 w-px bg-hairline lg:left-0" />
          <span aria-hidden="true" className="absolute inset-y-0 -right-2.5 w-px bg-hairline lg:right-0" />
          <div>
            <div className="relative aspect-[4/5] overflow-hidden rounded-[3px] bg-stencil">
              <Picture
                key={image.src}
                image={image}
                priority
                sizes="(min-width: 1440px) 700px, (min-width: 1024px) 48vw, 92vw"
              />
              {soldOut && (
                <span className="label absolute left-4 top-4 rounded-[3px] bg-paper px-2.5 py-2 text-[0.625rem]">Elkelt</span>
              )}
            </div>

            {design.images.length > 1 && (
              <div role="group" aria-label="Nézetek" className="mt-3 grid grid-cols-3 gap-3">
                {design.images.map((img, i) => (
                  <button
                    // By position: the same image can be attached twice.
                    key={i}
                    type="button"
                    onClick={() => setActive(i)}
                    aria-pressed={current === i}
                    aria-label={img.label}
                    className="relative aspect-[5/6] overflow-hidden rounded-[3px] border border-transparent bg-stencil transition-[border-color,scale] duration-200 hover:border-ash active:scale-[0.97] aria-pressed:border-ink"
                  >
                    <Picture image={img} sizes="(min-width: 1024px) 230px, 30vw" thumb />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="lg:pt-2">
            <StyleTags />
            <h1
              id="design-title"
              className="mt-5 font-display text-[clamp(2.6rem,4.4vw,3.9rem)] font-normal leading-none tracking-[-0.02em]"
            >
              {design.collection === "P’CONs" ? <Pcons suffix={` #${design.number}`} /> : name}
            </h1>
            <p className="label mt-4 text-muted">{design.collection}</p>
            <p className="mt-7 font-display text-[1.875rem] leading-none">
              {soldOut ? <span className="italic text-muted">Elkelt</span> : formatPrice(design.price)}
            </p>

            <dl className="mt-9 space-y-7 border-t border-hairline pt-8">
              <Fact icon={<Resize size={22} />} term="Ajánlott méret">
                <span className="font-display text-[1.1875rem]">{design.size}</span>
              </Fact>
              <Fact icon={<Sparkle size={22} />} term={fact.term}>
                <span className="text-[0.9375rem] leading-relaxed text-graphite">{fact.body}</span>
              </Fact>
              <Fact icon={<Torso size={22} />} term="Ajánlott testtájak">
                <span className="font-display text-[1.1875rem]">{design.placements}</span>
                <span className="mt-2 block text-[0.9375rem] leading-relaxed text-graphite">
                  Más testtájra is kérhető, erről a konzultáción egyeztetünk.
                </span>
              </Fact>
            </dl>

            <div className="mt-10 grid gap-3">
              {soldOut ? (
                <Link href="/#kapcsolat" className={`${btn.primary} w-full justify-between`}>
                  Hasonló egyedi tervet kérek <Arrow />
                </Link>
              ) : (
                <button type="button" onClick={() => openBooking(design)} className={`${btn.primary} w-full justify-between`}>
                  {SLOT_PICKING ? "Időpontot foglalok" : "Ezt a mintát szeretném"} <Arrow />
                </button>
              )}
              <button
                type="button"
                onClick={() => toggleFavorite(design.id)}
                aria-pressed={saved}
                className={`${btn.outline} w-full aria-pressed:bg-ink aria-pressed:text-paper`}
              >
                {/* The label stays put; aria-pressed (drawn as an ink fill) and the filled heart carry the state. */}
                <Heart size={18} filled={saved} />
                Mentés későbbre
              </button>
            </div>

            <div className="mt-10 border-t border-hairline">
              {[
                ["Leírás", design.description],
                [
                  "Fontos információk",
                  "A méret csak kis mértékben módosítható, hogy a részletek tiszták maradjanak. Kisebb változtatásokat, például egy elem elhagyását, a konzultáción egyeztetünk.",
                ],
                ["Hogyan működik?", howItWorks(design.availability.rule)],
              ].map(([title, body]) => (
                <details key={title} className="border-b border-hairline">
                  <summary className="label flex items-center justify-between py-5 text-[0.75rem]">
                    {title}
                    <Plus size={18} className="acc-icon transition-transform duration-300 ease-settle" />
                  </summary>
                  <p className="max-w-[34rem] pb-6 text-[0.9375rem] leading-[1.7] text-graphite">{body}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
