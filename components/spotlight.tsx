"use client";

import Image from "next/image";
import { useState } from "react";
import { type DesignImage, type FlashDesign, designName, designs, formatPrice } from "./data";
import { Check, ChevronLeft, ChevronRight, Heart, Plus, Resize, Sparkle, Torso } from "./icons";
import { useStore } from "./store";
import { Arrow, Pcons, StyleTags, btn, container } from "./ui";

function Picture({ image, sizes, thumb = false }: { image: DesignImage; sizes: string; thumb?: boolean }) {
  if (image.kind === "art") {
    return (
      <Image
        src={image.src}
        alt={thumb ? "" : image.alt}
        fill
        quality={90}
        sizes={sizes}
        className={`object-contain mix-blend-multiply ${thumb ? "p-[8%]" : "p-[5%]"}`}
      />
    );
  }
  // Photos are shown as a small print laid on the panel rather than stretched to fill it.
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div
        className={`bg-white shadow-[0_1px_2px_rgb(0_0_0/0.06),0_18px_40px_-18px_rgb(0_0_0/0.25)] ${
          thumb ? "w-[62%] p-1 pb-3" : "w-[min(58%,17rem)] -rotate-[1.25deg] p-2.5 pb-11"
        }`}
      >
        <div className="relative aspect-[216/250] overflow-hidden">
          <Image src={image.src} alt={thumb ? "" : image.alt} fill quality={90} sizes={sizes} className="object-cover" />
        </div>
        {!thumb && <p className="label mt-4 text-[0.6875rem] text-muted">{image.label}</p>}
      </div>
    </div>
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

function Detail({ design }: { design: FlashDesign }) {
  const { favorites, cart, toggleFavorite, toggleCart } = useStore();
  const [active, setActive] = useState(0);
  const name = designName(design);
  const image = design.images[active];
  const saved = favorites.has(design.id);
  const inCart = cart.has(design.id);

  return (
    <div className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-20">
      <div>
        <div className="relative aspect-[4/5] overflow-hidden rounded-[3px] bg-stencil">
          <Picture key={image.src} image={image} sizes="(min-width: 1024px) 48vw, 92vw" />
          {design.sold && (
            <span className="label absolute left-4 top-4 rounded-[3px] bg-paper px-2.5 py-2 text-[0.625rem]">Elkelt</span>
          )}
        </div>

        {design.images.length > 1 && (
          <div role="group" aria-label="Nézetek" className="mt-3 grid grid-cols-3 gap-3">
            {design.images.map((img, i) => (
              <button
                key={img.src}
                type="button"
                onClick={() => setActive(i)}
                aria-pressed={active === i}
                aria-label={img.label}
                className="relative aspect-[5/6] overflow-hidden rounded-[3px] border border-transparent bg-stencil transition-[border-color,scale] duration-200 hover:border-ash active:scale-[0.97] aria-pressed:border-ink"
              >
                <Picture image={img} sizes="16vw" thumb />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="lg:pt-2">
        <div className="flex items-baseline justify-between">
          <p className="label text-muted">{design.collection}</p>
          <p className="font-display text-[1.0625rem] text-muted">#{design.id}</p>
        </div>
        <h3 className="mt-5 font-display text-[clamp(2.6rem,4.4vw,3.9rem)] font-normal leading-none tracking-[-0.02em]">
          {design.collection === "P’CONs" ? <Pcons suffix={` #${design.id}`} /> : name}
        </h3>
        <StyleTags className="mt-5" />
        <p className="mt-7 font-display text-[1.875rem] leading-none">
          {design.sold ? <span className="italic text-muted">Elkelt</span> : formatPrice(design.price)}
        </p>

        <dl className="mt-9 space-y-7 border-t border-hairline pt-8">
          <Fact icon={<Resize size={22} />} term="Ajánlott méret">
            <span className="font-display text-[1.1875rem]">{design.size}</span>
          </Fact>
          <Fact icon={<Sparkle size={22} />} term="Egyszer elkészíthető minta">
            <span className="text-[0.9375rem] leading-relaxed text-graphite">
              {design.sold ? "Ez a minta már elkészült, többé nem tetoválom." : "Ez a design csak egyszer készül el."}
            </span>
          </Fact>
          <Fact icon={<Torso size={22} />} term="Ajánlott testtájak">
            <span className="font-display text-[1.1875rem]">{design.placements}</span>
            <span className="mt-2 block text-[0.9375rem] leading-relaxed text-graphite">
              Más testtájra is kérhető, erről a konzultáción egyeztetünk.
            </span>
          </Fact>
        </dl>

        <div className="mt-10 grid gap-3">
          {design.sold ? (
            <a href="#kapcsolat" className={`${btn.primary} w-full justify-between`}>
              Hasonló egyedi tervet kérek <Arrow />
            </a>
          ) : (
            <button
              type="button"
              onClick={() => toggleCart(design.id)}
              aria-pressed={inCart}
              className={`${btn.primary} w-full justify-between`}
            >
              {inCart ? "A kosárban van" : "Ezt a mintát szeretném"}
              {inCart ? <Check size={18} /> : <Arrow />}
            </button>
          )}
          <button
            type="button"
            onClick={() => toggleFavorite(design.id)}
            aria-pressed={saved}
            className={`${btn.outline} w-full`}
          >
            <Heart size={18} filled={saved} />
            {saved ? "Elmentve" : "Mentés későbbre"}
          </button>
        </div>

        <div className="mt-10 border-t border-hairline">
          {[
            ["Leírás", design.description],
            [
              "Fontos információk",
              "A méret csak kis mértékben módosítható, hogy a részletek tiszták maradjanak. Kisebb változtatásokat, például egy elem elhagyását, a konzultáción egyeztetünk.",
            ],
            [
              "Hogyan működik?",
              "Megvásárlod a mintát, ezzel lekerül a kollekcióból. Utána egyeztetünk időpontot és pontos elhelyezést, majd elkészül a tetoválás.",
            ],
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
  );
}

export function Spotlight() {
  const { featured, feature } = useStore();
  const index = Math.max(0, designs.findIndex((d) => d.id === featured));
  const design = designs[index];
  const step = (dir: 1 | -1) => feature(designs[(index + dir + designs.length) % designs.length].id);

  return (
    <section id="kiemelt" data-nav="flash" aria-labelledby="spotlight-title" className="bg-paper">
      <div className={`${container} pb-28 lg:pb-36`}>
        <div className="flex items-center justify-between border-t border-hairline pt-8">
          <h2 id="spotlight-title" className="label text-muted">
            A minta közelről
          </h2>
          <div className="label flex items-center text-[0.6875rem]">
            <button type="button" onClick={() => step(-1)} className="flex min-h-11 items-center gap-1.5 px-2.5 transition-opacity hover:opacity-60 active:opacity-40">
              <ChevronLeft size={15} /> Előző
            </button>
            <span aria-hidden="true" className="h-3.5 w-px bg-hairline" />
            <button type="button" onClick={() => step(1)} className="-mr-2.5 flex min-h-11 items-center gap-1.5 px-2.5 transition-opacity hover:opacity-60 active:opacity-40">
              Következő <ChevronRight size={15} />
            </button>
          </div>
        </div>
        <p className="sr-only" aria-live="polite">
          {designName(design)}
        </p>
        <Detail key={design.id} design={design} />
      </div>
    </section>
  );
}
