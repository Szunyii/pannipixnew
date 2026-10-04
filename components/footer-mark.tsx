"use client";

import { useEffect, useRef } from "react";

// The traced SVG stays sharp at full container width, where the PNG would go soft.
const markMask = "url(/brand/pannipix-logo.svg) center / 100% 100% no-repeat";

/**
 * The full wordmark at the foot of the page (after payloadcms.com's footer):
 * ink-on-ink letters with a grain, brought up by a soft light that trails the cursor.
 */
export function FooterMark({ className = "" }: { className?: string }) {
  const markRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const mark = markRef.current;
    const glow = glowRef.current;
    if (!mark || !glow) return;
    // Touch screens and reduced motion keep the light resting in the middle.
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let pointer: { x: number; y: number } | null = null;
    const offset = { x: 0, y: 0 }; // the light's offset from the mark's centre
    let frame = 0;
    let last = 0;

    // Ease the light towards the pointer, frame-rate independent; stop once it has arrived.
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const rect = mark.getBoundingClientRect();
      const tx = pointer!.x - rect.left - rect.width / 2;
      const ty = pointer!.y - rect.top - rect.height / 2;
      const k = 1 - Math.exp(-dt * 9);
      offset.x += (tx - offset.x) * k;
      offset.y += (ty - offset.y) * k;
      glow.style.transform = `translate3d(${offset.x}px, ${offset.y}px, 0)`;
      frame =
        Math.abs(tx - offset.x) > 0.5 || Math.abs(ty - offset.y) > 0.5
          ? requestAnimationFrame(tick)
          : 0;
    };
    const run = () => {
      if (frame || !pointer) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      pointer = { x: e.clientX, y: e.clientY };
      run();
    };

    // Only listen while the footer is (nearly) on screen. Scroll counts too:
    // the mark moves under a still cursor.
    const listen = (on: boolean) => {
      const method = on ? "addEventListener" : "removeEventListener";
      window[method]("pointermove", onMove as EventListener, { passive: true });
      window[method]("scroll", run, { passive: true });
    };
    const observer = new IntersectionObserver(([entry]) => listen(entry.isIntersecting), {
      rootMargin: "240px 0px",
    });
    observer.observe(mark);

    return () => {
      observer.disconnect();
      listen(false);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={markRef}
      aria-hidden="true"
      className={`relative aspect-1277/181 w-full overflow-hidden bg-paper/[0.07] ${className}`}
      style={{ mask: markMask, WebkitMask: markMask }}
    >
      <span
        ref={glowRef}
        className="mark-glow absolute left-1/2 top-1/2 aspect-square w-[46%] -translate-x-1/2 -translate-y-1/2 will-change-transform"
      />
      <span className="mark-grain absolute inset-0" />
    </div>
  );
}
