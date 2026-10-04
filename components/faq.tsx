import { Plus } from "./icons";
import { container } from "./ui";

const faqs = [
  {
    q: "Mennyibe kerül egy egyedi tetoválás?",
    a: "A méret, a részletesség és a testtáj alapján adok árajánlatot a konzultáció után. A flash minták ára fix, mindegyiknél fel van tüntetve.",
  },
  {
    q: "Módosítható egy flash minta?",
    a: "Kisebb változtatások igen, például egy elem elhagyása vagy a méret finomhangolása. A kompozíció lényegét nem alakítom át.",
  },
  {
    q: "Mi történik a flash mintával, miután elkészült?",
    a: "Lekerül a kollekcióból, és többé nem tetoválom. Ezért egyszer elkészíthető minden darab.",
  },
  {
    q: "Első tetoválásom lenne. Hol kezdjem?",
    a: "Írd meg, mi tetszik a mintáim közül, és milyen testtájra gondolsz. A konzultáción segítek eldönteni a méretet és az elhelyezést.",
  },
  {
    q: "Mennyi ideig tart a gyógyulás?",
    a: "A felszín általában 2–3 hét alatt gyógyul, a bőr teljes regenerációja 4–6 hét. Részletes utógondozási útmutatót kapsz.",
  },
];

export function Faq() {
  return (
    <section id="gyik" data-nav="info" aria-labelledby="faq-title" className="border-t border-hairline">
      <div className={`${container} grid gap-12 py-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20 lg:py-36`}>
        <div className="lg:sticky lg:top-32 lg:self-start">
          <p className="label text-muted">Gyakori kérdések</p>
          <h2
            id="faq-title"
            className="mt-5 font-display text-[clamp(2.4rem,4.8vw,4.5rem)] font-normal leading-[1] tracking-[-0.02em]"
          >
            Mielőtt jelentkezel.
          </h2>
          <p className="mt-6 max-w-[22rem] leading-[1.7] text-graphite">
            Ha nem találod a választ, írd meg a kérdésed a jelentkezésben.
          </p>
        </div>

        <div className="border-t border-ink/80">
          {faqs.map(({ q, a }) => (
            <details key={q} className="border-b border-hairline">
              <summary className="flex items-start justify-between gap-8 py-7 font-display text-[clamp(1.25rem,1.8vw,1.5rem)] leading-snug">
                {q}
                <Plus size={20} className="acc-icon mt-1 shrink-0 transition-transform duration-300 ease-settle" />
              </summary>
              <p className="max-w-[36rem] pb-8 leading-[1.75] text-graphite">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
