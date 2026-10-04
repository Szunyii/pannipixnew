import { container } from "./ui";

const styleNotes = [
  ["Conceptual", "A minta egy gondolatból indul, nem egy képből. Minden elemnek szerepe van a kompozícióban."],
  ["Abstract", "Tengelyek, körök, metszéspontok. A geometria tartja egyben a mintát."],
  ["Microrealism", "Apró, fotószerű részletek: egy szárny erezete, egy pikkely, egy szempilla."],
];

export function About() {
  return (
    <section id="rolam" data-nav="rolam" aria-labelledby="about-title" className="border-t border-hairline">
      <div className={`${container} grid gap-14 py-24 lg:grid-cols-12 lg:gap-x-8 lg:py-36`}>
        <div className="lg:col-span-6">
          <p className="label text-muted">Rólam</p>
          <h2
            id="about-title"
            className="mt-5 font-display text-[clamp(2.6rem,5.4vw,5.25rem)] font-normal leading-[0.98] tracking-[-0.025em]"
          >
            Gondolatokat tetoválok, <em>nem csak képeket.</em>
          </h2>
        </div>

        <div className="lg:col-span-5 lg:col-start-8 lg:pt-12">
          <p className="text-[1.125rem] leading-[1.75] text-graphite">
            A PANNIPIX mintái egy függőleges tengelyre épülnek. Köré rendezem a köröket, pályákat és a
            mikrorealista részleteket, így egy kompozíció egyszerre szerkezet és történet. Black &amp; grey
            technikával, finom vonalakkal dolgozom, és minden mintát a test formájához igazítok.
          </p>

          <dl className="mt-12 border-t border-hairline">
            {styleNotes.map(([term, note]) => (
              <div key={term} className="grid gap-2 border-b border-hairline py-6 sm:grid-cols-[10.5rem_1fr] sm:gap-8">
                <dt className="font-display text-[1.5rem] italic leading-tight">{term}</dt>
                <dd className="leading-[1.7] text-graphite">{note}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
