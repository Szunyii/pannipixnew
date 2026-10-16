import Image from "next/image";
import { SLOT_PICKING } from "@/lib/features";
import { PER_DESIGN } from "./data";
import { Arrow, Axis, btn, container } from "./ui";

const customService = {
  id: "egyedi",
  label: "Egyedi tetoválás",
  title: "Megtervezem a te ötletedből.",
  body: "Elmeséled, mi foglalkoztat: egy emléket, egy szimbólumot, egy hangulatot. Ebből építek konceptuális kompozíciót, ami követi a testtájad formáját.",
  facts: [
    ["Kezdés", "Online konzultáció"],
    ["Tervezés", "2–3 hét"],
    ["Ár", "Egyedi ajánlat a konzultáció után"],
  ],
  cta: { href: "#kapcsolat", label: "Egyedi tervet kérek", style: btn.primary },
  visual: (
    <Image
      src="/studio/drawing-ipad.webp"
      alt="Panni iPaden rajzol egy mintát: egy öltönyös férfi a Szaturnusz gyűrűjén ül, geometrikus formák és apró alakok között"
      fill
      quality={90}
      sizes="(min-width: 1024px) 40vw, 90vw"
      className="object-cover"
    />
  ),
};

function flashService(price: string | null, rule: string) {
  return {
    id: "flash-minta",
    label: "Flash minták",
    title: "Válassz egy kész mintát.",
    body: SLOT_PICKING
      ? "Előre megrajzolt darabok a PANNIPIX kollekciókból, fix áron. Kiválasztod a mintát és egy szabad időpontot, én pedig visszaigazolom a foglalást."
      : "Előre megrajzolt darabok a PANNIPIX kollekciókból, fix áron. Kiválasztod és lefoglalod a mintát, én pedig visszaigazolom, és egyeztetjük az időpontot.",
    facts: [
      ["Ár", price ?? PER_DESIGN],
      ["Méret", PER_DESIGN],
      ["Alkalmak", rule],
    ],
    cta: { href: "#flash", label: "Flash minták böngészése", style: btn.outline },
    visual: (
      <Image
        src="/flash/pcons-022.webp"
        alt="P’CONs #022 flash minta: holdkorong egy függőleges vonalon"
        fill
        quality={90}
        sizes="(min-width: 1024px) 40vw, 90vw"
        className="object-contain py-[6%] mix-blend-multiply"
      />
    ),
  };
}

/** `flashRule` is the "Alkalmak" fact: the booking rule the designs share, or that each states its own. */
export function Paths({ flashPrice, flashRule }: { flashPrice: string | null; flashRule: string }) {
  const services = [customService, flashService(flashPrice, flashRule)];
  return (
    <section id="tattoo" data-nav="tattoo" aria-labelledby="paths-title" className="relative">
      <div className={`${container} relative pb-28 pt-12 lg:pb-40 lg:pt-16`}>
        <Axis className="inset-y-0 hidden lg:block" />

        <header className="relative mx-auto max-w-[40rem] bg-paper py-8 text-center">
          <p className="label text-muted">Szolgáltatások</p>
          <h2
            id="paths-title"
            className="mt-5 font-display text-[clamp(2.4rem,4.8vw,4.5rem)] font-normal leading-[1] tracking-[-0.02em]"
          >
            Két út egy mintához.
          </h2>
          <p className="mx-auto mt-6 max-w-[28rem] leading-[1.7] text-graphite">
            Hozd a saját történeted, vagy válassz a kész minták közül. Mindkét esetben olyan tetoválást kapsz,
            ami csak a tiéd.
          </p>
        </header>

        <div className="relative mt-14 grid gap-y-0 lg:mt-20 lg:grid-cols-[1fr_9rem_1fr] lg:grid-rows-[auto_auto]">
          {services.map((s, i) => (
            <article
              key={s.id}
              id={s.id}
              aria-labelledby={`${s.id}-title`}
              className={`grid lg:row-span-2 lg:grid-rows-subgrid ${i === 0 ? "lg:col-start-1" : "lg:col-start-3"}`}
            >
              <div className="relative aspect-square overflow-hidden rounded-[3px] bg-stencil sm:aspect-[6/5]">
                {s.visual}
              </div>
              <div className="pt-9">
                <p className="label text-muted">{s.label}</p>
                <h3
                  id={`${s.id}-title`}
                  className="mt-4 font-display text-[clamp(1.85rem,2.7vw,2.6rem)] font-normal leading-[1.08] tracking-[-0.01em]"
                >
                  {s.title}
                </h3>
                <p className="mt-5 max-w-[30rem] leading-[1.7] text-graphite">{s.body}</p>
                <dl className="mt-8 border-t border-hairline">
                  {s.facts.map(([term, value]) => (
                    <div key={term} className="flex items-baseline justify-between gap-6 border-b border-hairline py-3.5">
                      <dt className="label text-[0.6875rem] text-muted">{term}</dt>
                      <dd className="text-right font-display text-[1.0625rem]">{value}</dd>
                    </div>
                  ))}
                </dl>
                <a href={s.cta.href} className={`${s.cta.style} mt-9`}>
                  {s.cta.label} <Arrow />
                </a>
              </div>
            </article>
          ))}

          {/* "or" — a node on the axis between the two paths */}
          <div
            aria-hidden="true"
            className="relative row-start-2 flex items-center gap-5 py-14 lg:col-start-2 lg:row-start-1 lg:justify-center lg:py-0"
          >
            <span className="h-px flex-1 bg-hairline lg:hidden" />
            <span className="grid size-[4.25rem] place-items-center rounded-full border border-ink/75 bg-paper font-display text-[1.25rem] italic">
              vagy
            </span>
            <span className="h-px flex-1 bg-hairline lg:hidden" />
          </div>
        </div>
      </div>
    </section>
  );
}
