import { Fragment } from "react";
import { preload } from "react-dom";
import { styles } from "./data";
import { ArrowRight } from "./icons";

export const container = "mx-auto w-full max-w-[90rem] gutter";

// Press feedback lands on touch-down (fast in, slower out), not on release.
const btnBase =
  "group label inline-flex h-12 items-center justify-center gap-3 rounded-[5px] px-6 transition-[background-color,color,border-color,scale] duration-300 active:scale-[0.98] active:duration-100 disabled:cursor-not-allowed";

export const btn = {
  primary: `${btnBase} bg-ink text-paper hover:bg-[#2b2b29]`,
  outline: `${btnBase} border border-ink/70 text-ink hover:bg-ink hover:text-paper`,
  light: `${btnBase} bg-paper text-ink hover:bg-white`,
};

export function Arrow() {
  return (
    <ArrowRight
      size={18}
      className="shrink-0 transition-transform duration-300 ease-settle group-hover:translate-x-1"
    />
  );
}

const logoSrc = "/brand/pannipix-logo.png";
const logoMask = `url(${logoSrc}) left center / contain no-repeat`;

/** The PANNIPIX wordmark, applied as a mask so it takes the surrounding text colour (ink or paper). */
export function Logo({ className = "h-6 sm:h-7" }: { className?: string }) {
  preload(logoSrc, { as: "image" });
  return (
    <a href="#top" aria-label="PANNIPIX – vissza az oldal tetejére" className="block w-fit shrink-0 py-2.5">
      <span
        aria-hidden="true"
        className={`block aspect-1277/181 bg-current ${className}`}
        style={{ mask: logoMask, WebkitMask: logoMask }}
      />
    </a>
  );
}

/** The thin centred rule every P’CONs composition is built on. */
export function Axis({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute left-1/2 w-px -translate-x-1/2 bg-ink/75 ${className}`}
    />
  );
}

/**
 * Labels split by middots. Each label stays whole, and when the row wraps the dot that would
 * start the new line falls into the clipped left margin, so no line begins or ends on a dot.
 */
export function Tags({ items, className = "" }: { items: readonly string[]; className?: string }) {
  return (
    <p className={`label overflow-hidden ${className}`}>
      <span className="-ml-[1.5em] flex flex-wrap">
        {items.map((item, i) => (
          <Fragment key={item}>
            {i > 0 && " "}
            <span className="relative whitespace-nowrap pl-[1.5em] before:absolute before:left-[0.45em] before:content-['·'_/_'']">
              {item}
            </span>
          </Fragment>
        ))}
      </span>
    </p>
  );
}

export function StyleTags({ className = "" }: { className?: string }) {
  return (
    <Tags
      items={styles}
      className={`text-[0.6875rem] tracking-[0.16em] text-muted sm:text-xs sm:tracking-[0.22em] ${className}`}
    />
  );
}

/** Bodoni's apostrophe crowds the P at display sizes; give it a hair of room. */
export function Pcons({ suffix = "" }: { suffix?: string }) {
  return (
    <>
      P<span className="ml-[0.035em] mr-[0.015em]">’</span>CONs{suffix}
    </>
  );
}
