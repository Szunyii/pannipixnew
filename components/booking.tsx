"use client";

import { useId, useState } from "react";
import { PLACEMENTS } from "@/lib/booking-input";
import { ChevronDown, Instagram, Mail } from "./icons";
import { Arrow, btn, container } from "./ui";

const field =
  "mt-1.5 block w-full border-0 border-b border-paper/25 bg-transparent pb-3 pt-2 text-[1.0625rem] text-paper placeholder:text-ash/60 transition-colors focus:border-paper focus:outline-none";

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
  const [placement, setPlacement] = useState("");
  const ideaId = useId();
  const placeId = useId();

  return (
    <section id="kapcsolat" data-nav="kapcsolat" aria-labelledby="booking-title" className="bg-ink text-paper">
      <div className={`${container} grid gap-16 py-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-24 lg:py-36`}>
        <div>
          <p className="label text-ash">Kapcsolat</p>
          <h2
            id="booking-title"
            className="mt-5 font-display text-[clamp(2.75rem,5.6vw,5.25rem)] font-normal leading-[0.98] tracking-[-0.025em]"
          >
            Kezdjük a te <em>mintáddal.</em>
          </h2>
          <p className="mt-7 max-w-[25rem] leading-[1.7] text-ash">
            Írd le, mit szeretnél, és pár napon belül válaszolok. Flash mintára közvetlenül a mintánál tudsz
            időpontot foglalni.
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
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
          className="lg:pt-3"
        >
          <p className="label text-[0.6875rem] text-ash">Egyedi tetoválás</p>
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
                  value={placement}
                  onChange={(e) => setPlacement(e.target.value)}
                  className={`${field} cursor-pointer appearance-none pr-8 ${placement ? "" : "text-ash/60"}`}
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
      </div>
    </section>
  );
}
