"use client";

import { useEffect, useRef, useState } from "react";
import { container } from "./ui";

type Tab = "egyedi" | "flash";

const tabs: { id: Tab; label: string }[] = [
  { id: "egyedi", label: "Egyedi tetoválás" },
  { id: "flash", label: "Flash minta" },
];

const steps: Record<Tab, { title: string; body: string }[]> = {
  egyedi: [
    {
      title: "Jelentkezés",
      body: "Írd le az ötleted, a kívánt testtájat és méretet. Ha van, csatolj referenciaképet is.",
    },
    {
      title: "Konzultáció",
      body: "Online vagy személyesen átbeszéljük a koncepciót, az elhelyezést és az árat.",
    },
    {
      title: "Tervezés",
      body: "Megrajzolom a mintát. Az időpont előtt megkapod, és egy körben módosíthatunk rajta.",
    },
    {
      title: "Tetoválás",
      body: "A stúdióban felkerül a stencil. Ha a helye és a mérete is stimmel, kezdünk.",
    },
    {
      title: "Utógondozás",
      body: "Írásos útmutatót kapsz a gyógyuláshoz, és a gyógyulás alatt is kérdezhetsz.",
    },
  ],
  flash: [
    {
      title: "Választás",
      body: "Kiválasztod a mintát. Mindegyiknél látod az ajánlott méretet és testtájakat.",
    },
    {
      title: "Vásárlás",
      body: "Megvásárlod a mintát, ezzel azonnal lekerül a kollekcióból.",
    },
    {
      title: "Időpont",
      body: "Egyeztetjük az időpontot és a pontos elhelyezést a testtájadon.",
    },
    {
      title: "Tetoválás",
      body: "Elkészül a tetoválás, a minta pedig véglegesen archívumba kerül.",
    },
  ],
};

export function Process() {
  const [tab, setTab] = useState<Tab>("egyedi");
  const [progress, setProgress] = useState(0);
  const [stops, setStops] = useState<number[]>([]);
  const listRef = useRef<HTMLOListElement>(null);

  // Other sections can open the flash tab ("Hogyan működik a flash").
  useEffect(() => {
    const onTab = (e: Event) => setTab((e as CustomEvent<Tab>).detail);
    window.addEventListener("process-tab", onTab);
    return () => window.removeEventListener("process-tab", onTab);
  }, []);

  // The axis fills with ink as the reader moves through the steps.
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const list = listRef.current;
      if (!list) return;
      const rect = list.getBoundingClientRect();
      const p = (window.innerHeight * 0.6 - rect.top) / rect.height;
      setProgress(Math.min(1, Math.max(0, p)));
      const items = Array.from(list.querySelectorAll<HTMLElement>(":scope > li"));
      setStops(items.map((li) => li.offsetTop / rect.height));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [tab]);

  const list = steps[tab];

  return (
    <section id="info" data-nav="info" aria-labelledby="process-title" className="border-t border-hairline">
      <div className={`${container} py-24 lg:py-36`}>
        <div className="grid gap-10 lg:grid-cols-2 lg:items-end">
          <div>
            <p className="label text-muted">Info</p>
            <h2
              id="process-title"
              className="mt-5 font-display text-[clamp(2.4rem,4.8vw,4.5rem)] font-normal leading-[1] tracking-[-0.02em]"
            >
              Így készül a <em>tetoválásod.</em>
            </h2>
          </div>
          <div
            role="tablist"
            aria-label="Folyamat típusa"
            className="grid w-full grid-cols-2 gap-1 rounded-[8px] bg-stencil p-1 sm:inline-flex sm:w-fit lg:justify-self-end"
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                role="tab"
                type="button"
                aria-selected={tab === t.id}
                aria-controls="process-panel"
                onClick={() => setTab(t.id)}
                className="h-11 whitespace-nowrap rounded-[6px] px-3 font-display text-base transition-[background-color,color,scale] duration-300 active:scale-[0.97] active:duration-75 aria-selected:bg-ink aria-selected:text-paper sm:px-5 sm:text-[1.0625rem]"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div id="process-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="mt-16 lg:mt-24">
          <ol key={tab} ref={listRef} className="fade-up relative">
            <span aria-hidden="true" className="absolute inset-y-0 left-[5px] w-px bg-hairline lg:left-1/2" />
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-[5px] w-px origin-top bg-ink transition-transform duration-150 ease-linear lg:left-1/2"
              style={{ transform: `scaleY(${progress})` }}
            />
            {list.map((s, i) => {
              const reached = stops[i] !== undefined && progress > stops[i];
              const left = i % 2 === 0;
              return (
                <li key={s.title} className="relative pb-14 pl-10 last:pb-0 lg:grid lg:grid-cols-2 lg:pb-16 lg:pl-0">
                  <span
                    aria-hidden="true"
                    className={`absolute left-0 top-[0.4rem] size-[11px] rounded-full border border-ink transition-colors duration-500 lg:left-1/2 lg:-translate-x-[5px] ${
                      reached ? "bg-ink" : "bg-paper"
                    }`}
                  />
                  <div className={left ? "lg:col-start-1 lg:pr-20 lg:text-right" : "lg:col-start-2 lg:pl-20"}>
                    <p className="font-display text-[1.0625rem] italic leading-none text-muted">
                      {String(i + 1).padStart(2, "0")}
                    </p>
                    <h3 className="mt-3 font-display text-[clamp(1.75rem,2.6vw,2.4rem)] font-normal leading-tight">
                      {s.title}
                    </h3>
                    <p className={`mt-3 max-w-[25rem] leading-[1.7] text-graphite ${left ? "lg:ml-auto" : ""}`}>{s.body}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
