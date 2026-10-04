import Image from "next/image";
import { Arrow, Axis, StyleTags, Tags, btn, container } from "./ui";

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
        className={`${container} relative grid gap-y-10 pb-20 pt-10 xl:min-h-[calc(100svh-4.5rem)] xl:grid-cols-[1fr_auto_1fr] xl:grid-rows-[auto_1fr_auto] xl:gap-y-0 xl:pb-12 xl:pt-12`}
      >
        <Axis className="axis-draw inset-y-0 hidden xl:block" />

        <div className="fade-up xl:col-start-1 xl:row-start-1" style={delay(1100)}>
          <Tags items={["Egyedi tetoválás", "Flash minták"]} className="text-muted" />
        </div>

        <h1
          id="hero-title"
          className="font-display text-[clamp(3.4rem,min(11vw,16svh),6.75rem)] xl:text-[clamp(3.4rem,7.3vw,8.75rem)] font-normal leading-[0.9] tracking-[-0.025em] xl:col-span-3 xl:col-start-1 xl:row-start-2 xl:grid xl:grid-cols-subgrid xl:grid-rows-[auto_1fr_auto] xl:py-10"
        >
          <span className="block xl:col-start-1 xl:row-start-1 xl:-mr-16 xl:justify-self-end xl:text-right">
            <Line at={250}>Minden</Line>{" "}
            <Line at={380}>minta</Line>
          </span>{" "}
          <span className="mt-1 block text-right xl:col-start-3 xl:row-start-3 xl:-ml-16 xl:mt-0 xl:justify-self-start xl:text-left">
            <Line at={520} className="italic">
              egyszer
            </Line>{" "}
            <Line at={650}>készül el.</Line>
          </span>
        </h1>

        <figure className="relative z-10 mx-auto w-[min(76vw,23rem)] md:w-[25rem] mix-blend-multiply xl:col-start-2 xl:row-span-3 xl:row-start-1 xl:w-auto xl:self-center xl:px-2">
          <div
            className="ink-in relative aspect-[722/926] xl:h-[clamp(24rem,calc(100svh-16rem),42rem)]"
            style={delay(800)}
          >
            {/* The artwork's own bar sits 2% left of centre; nudge it onto the page axis. */}
            <Image
              src="/flash/pcons-027-large.webp"
              alt="P’CONs #027 flash minta: szitakötő és robotkéz egy függőleges sáv két oldalán, bolygókkal"
              fill
              loading="eager"
              fetchPriority="high"
              quality={90}
              sizes="(min-width: 1280px) 36vw, (min-width: 768px) 25rem, 76vw"
              className="translate-x-[2.1%] object-contain"
            />
          </div>
          {/* Drawn over the art on mobile so it runs through it; on desktop the section axis shows through the multiply. */}
          <Axis className="axis-draw -bottom-10 top-0 xl:hidden" />
          <figcaption
            className="label fade-up absolute left-[calc(50%+0.85rem)] top-full mt-4 whitespace-nowrap text-[0.6875rem] text-muted"
            style={delay(1500)}
          >
            P’CONs #027<span className="hidden sm:inline"> — elérhető</span>
          </figcaption>
        </figure>

        <div
          className="fade-up mt-8 max-w-[27rem] xl:col-start-3 xl:row-start-3 xl:mt-0 xl:self-end xl:justify-self-end xl:pl-10"
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

        <StyleTags className="fade-up xl:col-start-1 xl:row-start-3 xl:self-end" />
      </div>
    </section>
  );
}
