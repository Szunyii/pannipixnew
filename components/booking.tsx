"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { PLACEMENTS } from "@/lib/booking-input";
import { SLOT_PICKING } from "@/lib/features";
import { ChevronDown, Instagram, Mail } from "./icons";
import { Arrow, btn, container } from "./ui";

// From lg the section is a ledger on the axis: labels left of it, fields right of it, rules running across.
const cols = "lg:grid-cols-[minmax(0,4fr)_minmax(0,6fr)]";
const labelSide = "lg:pr-10 xl:pr-14";
const fieldSide = "lg:pl-10 xl:pl-14";

// Fields inherit the section's paper colour, so the select can grey out its own text while it is empty.
const surface =
  "w-full rounded-xs border border-paper/15 bg-paper/4 px-4.5 text-[1.0625rem] placeholder:text-ash/60 transition-[border-color,box-shadow] duration-200 hover:border-paper/30 focus:border-paper focus:shadow-[0_0_0_3px_rgb(247_247_245/0.08)] focus:outline-none";
// 48px, the height of every button on the site, the send button below included.
const box = `${surface} h-12`;

/** One ledger row: numeral, label and hint left of the axis, the field right of it; stacked on phones. */
function Row({
  n,
  label,
  htmlFor,
  hint,
  hintId,
  children,
}: {
  n: string;
  label: string;
  htmlFor: string;
  hint?: string;
  hintId?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`group grid gap-y-4 border-b border-paper/15 py-6 lg:gap-y-0 lg:py-0 ${cols}`}>
      <div className={`grid grid-cols-[3.5rem_1fr] content-start items-start lg:grid-cols-[6rem_1fr] lg:py-7 ${labelSide}`}>
        {/* Lights up while its field has focus, so the row reads across the axis. */}
        <span
          aria-hidden="true"
          className="row-span-2 font-display text-[2.5rem] leading-[0.9] text-paper/30 transition-colors duration-300 group-focus-within:text-paper lg:text-[3.5rem]"
        >
          {n}
        </span>
        {/* From lg the label sits on its field's text line (both centred 48px below the rule), the box level with the numeral. */}
        <label htmlFor={htmlFor} className="label pt-1.5 text-paper lg:pt-3">
          {label}
        </label>
        {/* Small Bodoni needs the small optical size; at the pinned opsz 28 its hairlines fade out. */}
        {hint && (
          <p
            id={hintId}
            className="col-start-2 mt-2 font-display text-base italic leading-snug text-ash [font-variation-settings:'opsz'_11] lg:mt-2.5 lg:text-[1.0625rem]"
          >
            {hint}
          </p>
        )}
      </div>
      <div className={`lg:py-6 ${fieldSide}`}>{children}</div>
    </div>
  );
}

export function Booking() {
  const [sent, setSent] = useState(false);
  const [placement, setPlacement] = useState("");
  const nameId = useId();
  const emailId = useId();
  const emailHint = useId();
  const ideaId = useId();
  const ideaHint = useId();
  const placeId = useId();
  const placeHint = useId();

  return (
    <section id="kapcsolat" data-nav="kapcsolat" aria-labelledby="booking-title" className="surface-ink bg-ink text-paper">
      <div className={container}>
        <div className="relative py-24 lg:py-36">
          {/* The axis, top to bottom of the section; the columns split on it. */}
          <span aria-hidden="true" className="absolute inset-y-0 left-[40%] hidden w-px bg-paper/15 lg:block" />

          <div className={`grid ${cols}`}>
            <div className={labelSide}>
              <p className="label text-ash">Kapcsolat</p>
              <h2
                id="booking-title"
                className="mt-5 font-display text-[clamp(2.4rem,4.8vw,4.5rem)] leading-[1] tracking-[-0.02em]"
              >
                Kezdjük a te <em>mintáddal.</em>
              </h2>
            </div>
            <div className={`mt-8 lg:mt-0 lg:self-end ${fieldSide}`}>
              <p className="label text-ash">Egyedi tetoválás</p>
              <p className="mt-4 max-w-104 leading-[1.7] text-ash">
                Írd le, mit szeretnél, és pár napon belül válaszolok.{" "}
                {SLOT_PICKING
                  ? "Flash mintára közvetlenül a mintánál tudsz időpontot foglalni."
                  : "Flash mintát közvetlenül a mintánál tudsz foglalni."}
              </p>
            </div>
          </div>

          <form
            aria-label="Jelentkezés egyedi tetoválásra"
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
            }}
            className="mt-16 border-t border-paper/15 lg:mt-20"
          >
            <Row n="01" label="Név" htmlFor={nameId}>
              <input
                id={nameId}
                name="name"
                autoComplete="name"
                autoCapitalize="words"
                enterKeyHint="next"
                required
                className={box}
              />
            </Row>

            <Row n="02" label="E-mail" htmlFor={emailId} hint="Ide küldöm a választ." hintId={emailHint}>
              <input
                id={emailId}
                name="email"
                type="email"
                placeholder="nev@pelda.hu"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="next"
                required
                aria-describedby={emailHint}
                className={box}
              />
            </Row>

            <Row n="03" label="Az ötleted" htmlFor={ideaId} hint="Egy emlék, egy szimbólum, egy hangulat." hintId={ideaHint}>
              <textarea
                id={ideaId}
                name="idea"
                rows={6}
                placeholder="Mi foglalkoztat?"
                aria-describedby={ideaHint}
                className={`${surface} block resize-none py-3 leading-[1.6]`}
              />
            </Row>

            <Row n="04" label="Testtáj és méret" htmlFor={placeId} hint="Ha még nem tudod, hagyd üresen." hintId={placeHint}>
              <div className="flex gap-3 sm:gap-4">
                <div className="relative min-w-0 flex-1">
                  <select
                    id={placeId}
                    name="placement"
                    aria-label="Testtáj"
                    aria-describedby={placeHint}
                    value={placement}
                    onChange={(e) => setPlacement(e.target.value)}
                    className={`${box} cursor-pointer appearance-none pr-11 ${placement ? "" : "text-ash/60"}`}
                  >
                    <option value="" disabled className="text-ink">
                      Válassz
                    </option>
                    {PLACEMENTS.map((p) => (
                      <option key={p.value} value={p.value} className="text-ink">
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ash" />
                </div>
                <div className="relative w-32 shrink-0 sm:w-45">
                  <input
                    name="size"
                    aria-label="Méret (cm)"
                    aria-describedby={placeHint}
                    inputMode="numeric"
                    enterKeyHint="done"
                    placeholder="pl. 15"
                    className={`${box} pr-12`}
                  />
                  <span aria-hidden="true" className="pointer-events-none absolute right-4.5 top-1/2 -translate-y-1/2 text-sm text-ash">
                    cm
                  </span>
                </div>
              </div>
            </Row>

            {/* The send block comes first in the source, so on phones it follows the fields; from lg it sits right of the axis. */}
            <div className={`grid ${cols}`}>
              <div className={`pt-8 lg:col-start-2 lg:row-start-1 ${fieldSide}`}>
                <label className="flex min-h-11 w-fit cursor-pointer select-none items-center gap-3 text-[0.9375rem] text-ash">
                  <input type="checkbox" required className="size-[1.125rem] shrink-0 cursor-pointer accent-paper" />
                  Elmúltam 18 éves.
                </label>
                <button type="submit" className={`${btn.light} mt-6 w-full sm:justify-between`}>
                  Jelentkezés elküldése <Arrow />
                </button>
                <p role="status" className="text-[0.9375rem] leading-snug text-ash not-empty:mt-4">
                  {sent && "Az online jelentkezés hamarosan elérhető. Addig írj Instagramon: @pannipix."}
                </p>
              </div>

              {/* Photo strip beside the links from sm; only phones get the full-width photo. */}
              <div className={`mt-16 sm:flex sm:items-end sm:gap-6 lg:col-start-1 lg:row-start-1 lg:mt-0 lg:pt-10 ${labelSide}`}>
                <figure className="relative aspect-[4/3] overflow-hidden rounded-[3px] bg-paper/10 sm:aspect-3/4 sm:w-42 sm:shrink-0 lg:w-36 xl:w-42">
                  <Image
                    src="/studio/browsing.webp"
                    alt="Egy vendég a PANNIPIX Instagram-oldalát nézegeti a telefonján"
                    fill
                    quality={90}
                    sizes="(min-width: 1280px) 168px, (min-width: 1024px) 144px, 90vw"
                    className="object-cover object-[50%_42%]"
                  />
                </figure>
                <ul className="mt-9 space-y-1 border-t border-paper/15 pt-5 sm:mt-0 sm:border-0 sm:pt-0">
                  <li>
                    <a href="https://instagram.com/pannipix" className="inline-flex min-h-11 items-center gap-3.5 hover:text-ash">
                      <Instagram size={20} /> @pannipix
                    </a>
                  </li>
                  <li>
                    <a href="mailto:hello@pannipix.hu" className="inline-flex min-h-11 items-center gap-3.5 hover:text-ash">
                      <Mail size={20} /> hello@pannipix.hu
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
