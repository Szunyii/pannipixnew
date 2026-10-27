import Image from "next/image";
import { Arrow, StyleTags, Tags, btn, container } from "./ui";

const delay = (ms: number) => ({ animationDelay: `${ms}ms` });

// Each line rises out of its own mask; padding keeps accents and descenders inside it.
function Line({ children, at, className = "" }: { children: React.ReactNode; at: number; className?: string }) {
  return (
    <span className={`-my-[0.12em] block overflow-hidden whitespace-nowrap py-[0.12em] ${className}`}>
      <span className="line-rise" style={delay(at)}>
        {children}
      </span>
    </span>
  );
}

export function Hero() {
  return (
    <section id="top" aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-paper">
      <div
        className={`${container} relative grid gap-y-10 pb-20 pt-10 lg:max-xl:grid-cols-[minmax(0,1fr)_auto] lg:max-xl:gap-x-12 xl:min-h-[calc(100svh-4.5rem)] xl:grid-cols-[1fr_auto_1fr] xl:grid-rows-[auto_1fr_auto] xl:gap-y-0 xl:pb-12 xl:pt-12`}
      >
        {/* From lg the copy and the portrait sit side by side, so the CTA stays in the first screen; from xl the
            three-column composition. No axis here: it continued the drawing's bar, and on the photo it ended in her head. */}

        <div className="fade-up lg:max-xl:col-start-1 lg:max-xl:row-start-1 xl:col-start-1 xl:row-start-1" style={delay(1100)}>
          <Tags items={["Egyedi tetoválás", "Flash minták"]} className="text-muted" />
        </div>

        {/* One scale across the three layouts: no jump at lg or xl, and capped at 1.5× the section headings (4.5rem). */}
        <h1
          id="hero-title"
          className="font-display text-[clamp(3.4rem,min(11vw,16svh),5.25rem)] lg:max-xl:col-start-1 lg:max-xl:row-start-2 lg:max-xl:text-[clamp(3.4rem,min(8.2vw,10.2svh),5.5rem)] xl:text-[clamp(3.4rem,7.3vw,7rem)] leading-[0.9] tracking-[-0.025em] xl:col-span-3 xl:col-start-1 xl:row-start-2 xl:grid xl:grid-cols-subgrid xl:grid-rows-[auto_1fr_auto] xl:py-10"
        >
          {/* The halves stop short of the portrait: an opaque photo would swallow letters that ran under it. */}
          <span className="block xl:col-start-1 xl:row-start-1 xl:justify-self-end xl:pr-8 xl:text-right">
            <Line at={250}>Minden</Line>{" "}
            <Line at={380}>minta</Line>
          </span>{" "}
          <span className="mt-1 block text-right xl:col-start-3 xl:row-start-3 xl:mt-0 xl:justify-self-start xl:pl-8 xl:text-left">
            <Line at={520} className="italic">
              egyszer
            </Line>{" "}
            <Line at={650}>készül el.</Line>
          </span>
        </h1>

        {/* From lg the portrait stands on the section's bottom edge (the negative margins cancel the bottom padding),
            so the photo's cut through the trousers is the page's edge. At lg–xl the section's height comes from the
            copy, so a fixed-width column stretches over it and the photo fills it from the bottom; from xl it's sized
            by the viewport. Narrower than lg it sits between the copy blocks, cropped to head and torso, fading out. */}
        <figure className="relative z-10 mx-auto w-[min(76vw,22rem)] lg:-mb-20 lg:w-88 lg:max-xl:col-start-2 lg:max-xl:row-span-4 lg:max-xl:row-start-1 lg:max-xl:self-stretch xl:col-start-2 xl:row-span-3 xl:row-start-1 xl:-mb-12 xl:w-auto xl:self-end">
          <div
            className="ink-in relative aspect-4/5 mask-[linear-gradient(to_bottom,#000_70%,transparent)] lg:aspect-auto lg:h-full lg:mask-none xl:aspect-1056/2400 xl:h-[clamp(30rem,calc(100svh-8rem),52rem)]"
            style={delay(800)}
          >
            <Image
              src="/studio/hero-portrait.webp"
              alt="Mosolygó nő tetovált karokkal és nyakkal, fehér topban és ingben, karba tett kézzel"
              fill
              loading="eager"
              fetchPriority="high"
              quality={90}
              sizes="(min-width: 1024px) 23rem, 76vw"
              className="object-cover object-top lg:object-contain lg:object-bottom"
            />
          </div>
        </figure>

        <div
          className="fade-up mt-8 max-w-[27rem] lg:max-xl:col-start-1 lg:max-xl:row-start-3 xl:col-start-3 xl:row-start-3 xl:mt-0 xl:self-end xl:justify-self-end xl:pl-10"
          style={delay(1000)}
        >
          <p className="text-[1.0625rem] leading-[1.7] text-graphite">
            Konceptuális, absztrakt és mikrorealista tetoválások. Megtervezem a te történetedből, vagy
            választhatsz egy kész flash mintát. Ami egyszer bőrre került, azt másnak már nem tetoválom.
          </p>
          <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
            <a href="#kapcsolat" className={btn.primary}>
              Egyedi tervet kérek <Arrow />
            </a>
            <a href="#flash" className={btn.outline}>
              Flash minták böngészése
            </a>
          </div>
        </div>

        <StyleTags className="fade-up lg:max-xl:col-start-1 lg:max-xl:row-start-4 xl:col-start-1 xl:row-start-3 xl:self-end" />
      </div>
    </section>
  );
}
