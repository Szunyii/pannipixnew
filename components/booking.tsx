"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { PLACEMENTS } from "@/lib/booking-input";
import { SLOT_PICKING } from "@/lib/features";
import { ChevronDown, Instagram, Mail } from "./icons";
import { Arrow, btn, container } from "./ui";

const field =
  "mt-1.5 block w-full border-0 border-b border-paper/25 bg-transparent pb-3 pt-2 text-[1.0625rem] text-paper placeholder:text-ash/60 transition-[border-color,box-shadow] focus:border-paper focus:shadow-[0_1px_0_var(--color-paper)] focus:outline-none";

function Field({
  label,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="label text-[0.6875rem] text-ash">
        {label}
      </label>
      <input id={id} className={field} {...props} />
    </div>
  );
}

export function Booking() {
  const [sent, setSent] = useState(false);
  const formTitleId = useId();
  const ideaId = useId();
  const placeId = useId();

  return (
    <section id="kapcsolat" data-nav="kapcsolat" aria-labelledby="booking-title" className="surface-ink bg-ink text-paper">
      {/* The photo comes last in the source, so on phones the form follows its heading; from lg it sits under the intro. */}
      <div className={`${container} grid gap-16 py-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-x-24 lg:gap-y-12 lg:py-36`}>
        <div className="lg:col-start-1 lg:row-start-1">
          <p className="label text-ash">Kapcsolat</p>
          <h2
            id="booking-title"
            className="mt-5 font-display text-[clamp(2.75rem,5.6vw,5.25rem)] leading-[0.98] tracking-[-0.025em]"
          >
            Kezdjük a te <em>mintáddal.</em>
          </h2>
          <p className="mt-7 max-w-[25rem] leading-[1.7] text-ash">
            Írd le, mit szeretnél, és pár napon belül válaszolok.{" "}
            {SLOT_PICKING
              ? "Flash mintára közvetlenül a mintánál tudsz időpontot foglalni."
              : "Flash mintát közvetlenül a mintánál tudsz foglalni."}
          </p>
          <ul className="mt-12 space-y-1 border-t border-paper/15 pt-6">
            <li>
              <a href="https://instagram.com/pannipix" className="inline-flex items-center gap-3.5 py-2 hover:text-ash">
                <Instagram size={20} /> @pannipix
              </a>
            </li>
            <li>
              <a href="mailto:hello@pannipix.hu" className="inline-flex items-center gap-3.5 py-2 hover:text-ash">
                <Mail size={20} /> hello@pannipix.hu
              </a>
            </li>
          </ul>
        </div>

        <form
          aria-labelledby={formTitleId}
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
          className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:pt-3"
        >
          <p id={formTitleId} className="label text-[0.6875rem] text-ash">Egyedi tetoválás</p>
          <div className="mt-10 grid gap-x-10 gap-y-10 sm:grid-cols-2">
            <Field label="Név" name="name" autoComplete="name" autoCapitalize="words" enterKeyHint="next" required />
            <Field label="E-mail" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} enterKeyHint="next" required />

            <div className="sm:col-span-2">
              <label htmlFor={ideaId} className="label text-[0.6875rem] text-ash">
                Az ötleted
              </label>
              <textarea
                id={ideaId}
                name="idea"
                rows={3}
                placeholder="Mi foglalkoztat? Egy emlék, egy szimbólum, egy hangulat…"
                className={`${field} resize-none leading-[1.6]`}
              />
            </div>

            <div>
              <label htmlFor={placeId} className="label text-[0.6875rem] text-ash">
                Testtáj
              </label>
              <div className="relative">
                <select
                  id={placeId}
                  name="placement"
                  defaultValue=""
                  className={`${field} cursor-pointer appearance-none pr-8`}
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
                <ChevronDown size={16} className="pointer-events-none absolute bottom-4 right-0 text-ash" />
              </div>
            </div>
            <Field label="Méret (cm)" name="size" inputMode="numeric" enterKeyHint="done" placeholder="pl. 15" />
          </div>

          <label className="mt-8 flex min-h-11 cursor-pointer select-none items-center gap-3 text-[0.9375rem] text-ash">
            <input type="checkbox" required className="size-[1.125rem] cursor-pointer accent-paper" />
            Elmúltam 18 éves.
          </label>

          <div className="mt-12 flex flex-col gap-6 sm:flex-row sm:items-center">
            <button type="submit" className={`${btn.light} sm:min-w-[17rem] sm:justify-between`}>
              Jelentkezés elküldése <Arrow />
            </button>
            <p role="status" className="max-w-[20rem] text-[0.9375rem] leading-snug text-ash">
              {sent && "Az online jelentkezés hamarosan elérhető. Addig írj Instagramon: @pannipix."}
            </p>
          </div>
        </form>

        <figure className="relative aspect-[4/3] overflow-hidden rounded-[3px] bg-paper/10 lg:col-start-1 lg:row-start-2">
          <Image
            src="/studio/browsing.webp"
            alt="Egy vendég a PANNIPIX Instagram-oldalát nézegeti a telefonján"
            fill
            quality={90}
            sizes="(min-width: 1024px) 36vw, 90vw"
            className="object-cover object-[50%_42%]"
          />
        </figure>
      </div>
    </section>
  );
}
