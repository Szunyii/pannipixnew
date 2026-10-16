"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Close, Mail, Menu } from "./icons";
import { Logo, Tags, container } from "./ui";

// In the order the sections follow each other on the page.
const nav = [
  { id: "flash", label: "Flash" },
  { id: "tattoo", label: "Tattoo" },
  { id: "info", label: "Info" },
  { id: "rolam", label: "Rólam" },
  { id: "kapcsolat", label: "Kapcsolat" },
];

const iconBtn =
  "relative grid size-11 place-items-center rounded-full text-ink transition-[background-color,scale] duration-200 hover:bg-ink/5 active:scale-95 active:bg-ink/10 active:duration-75";

export function Header() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  // Mark the nav item of the section in the middle of the viewport.
  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>("[data-nav]");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive((entry.target as HTMLElement).dataset.nav ?? null);
        }
      },
      { rootMargin: "-48% 0px -48% 0px" },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    // Widening past the phone breakpoint hides the menu; close it so the page doesn't stay scroll-locked.
    const wide = window.matchMedia("(width >= 48rem)");
    const onWide = () => wide.matches && setOpen(false);
    document.documentElement.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    return () => {
      document.documentElement.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-hairline bg-paper/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        {/*
          Three columns so the centre item sits exactly on the page axis: the wordmark on phones, the nav
          from lg. In between there's no room for both beside a centred nav, so the nav sits on the right.
        */}
        <div
          className={`${container} grid h-[4.5rem] grid-cols-[1fr_auto_1fr] items-center md:flex md:justify-between lg:grid`}
        >
          <div className="col-start-2 md:col-start-1">
            <Logo />
          </div>

          <nav aria-label="Fő navigáció" className="hidden md:block">
            <ul className="flex items-center gap-7 lg:gap-9 xl:gap-11">
              {nav.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/#${item.id}`}
                    aria-current={active === item.id ? "true" : undefined}
                    className="label relative block py-2 text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:scale-x-0 after:bg-ink after:transition-transform after:duration-500 after:ease-settle hover:after:scale-x-100 aria-[current]:after:scale-x-100"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="col-start-3 -mr-2.5 flex items-center justify-self-end md:hidden lg:flex">
            <Link href="/#kapcsolat" aria-label="Kapcsolat" className={iconBtn}>
              <Mail size={22} />
            </Link>
            <button
              type="button"
              aria-label={open ? "Menü bezárása" : "Menü megnyitása"}
              aria-expanded={open}
              aria-controls="site-menu"
              onClick={() => setOpen((o) => !o)}
              className={`${iconBtn} md:hidden`}
            >
              {open ? <Close size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      {/* Phones only. Outside the header: its backdrop-filter would otherwise trap position:fixed. */}
      <div
        id="site-menu"
        hidden={!open}
        className="fixed inset-x-0 bottom-0 top-[calc(4.5rem+env(safe-area-inset-top))] z-40 overflow-y-auto overscroll-contain bg-paper md:hidden"
      >
        <nav
          aria-label="Mobil navigáció"
          className={`${container} relative flex min-h-full flex-col pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-10`}
        >
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-[calc(max(var(--gutter),env(safe-area-inset-left,0px))+0.5px)] w-px bg-hairline"
          />
          <ul className="flex flex-col">
            {nav.map((item) => (
              <li key={item.id} className="border-b border-hairline last:border-0">
                <Link
                  href={`/#${item.id}`}
                  aria-current={active === item.id ? "true" : undefined}
                  onClick={() => setOpen(false)}
                  className="flex items-baseline justify-between py-5 pl-6 font-display text-[2.5rem] leading-none transition-opacity active:opacity-50 aria-[current]:italic sm:text-[3rem]"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          {/* Padding lives outside Tags: its clipped margin has to sit against the clip edge. */}
          <div className="mt-auto pl-6 pt-10">
            <Tags items={["Egyedi tetoválás", "Flash minták"]} className="text-muted" />
          </div>
        </nav>
      </div>
    </>
  );
}
