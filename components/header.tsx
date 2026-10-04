"use client";

import { useEffect, useState } from "react";
import { Bag, Close, Menu, User } from "./icons";
import { useStore } from "./store";
import { Logo, Tags, container } from "./ui";

const nav = [
  { id: "tattoo", label: "Tattoo" },
  { id: "flash", label: "Flash" },
  { id: "info", label: "Info" },
  { id: "rolam", label: "Rólam" },
  { id: "kapcsolat", label: "Kapcsolat" },
];

const iconBtn =
  "relative grid size-11 place-items-center rounded-full text-ink transition-[background-color,scale] duration-200 hover:bg-ink/5 active:scale-95 active:bg-ink/10 active:duration-75";

export function Header() {
  const { cart } = useStore();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  // Underline the nav item for the section in the middle of the viewport.
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
    document.documentElement.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-hairline bg-paper/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        {/* Three columns so the nav sits exactly on the page axis, whatever the logo's width. */}
        <div className={`${container} grid h-[4.5rem] grid-cols-[1fr_auto_1fr] items-center`}>
          <Logo />

          <nav aria-label="Fő navigáció" className="hidden lg:block">
            <ul className="flex items-center gap-11">
              {nav.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    aria-current={active === item.id ? "true" : undefined}
                    className="label relative py-2 text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:scale-x-0 after:bg-ink after:transition-transform after:duration-500 after:ease-settle hover:after:scale-x-100 aria-[current]:after:scale-x-100"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="col-start-3 -mr-2.5 flex items-center justify-self-end">
            <button type="button" aria-label="Fiókom" className={`${iconBtn} hidden sm:grid`}>
              <User size={22} />
            </button>
            <a href="#flash" aria-label={`Kosár: ${cart.size} minta`} className={iconBtn}>
              <Bag size={22} />
              {cart.size > 0 && (
                <span className="absolute right-1.5 top-1.5 grid size-[1.05rem] place-items-center rounded-full bg-ink font-sans text-[0.625rem] leading-none text-paper">
                  {cart.size}
                </span>
              )}
            </a>
            <button
              type="button"
              aria-label={open ? "Menü bezárása" : "Menü megnyitása"}
              aria-expanded={open}
              aria-controls="mobile-menu"
              onClick={() => setOpen((o) => !o)}
              className={`${iconBtn} lg:hidden`}
            >
              {open ? <Close size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      {/* Outside the header: its backdrop-filter would otherwise trap position:fixed. */}
      <div
        id="mobile-menu"
        hidden={!open}
        className="fixed inset-x-0 bottom-0 top-[calc(4.5rem+env(safe-area-inset-top))] z-40 overflow-y-auto overscroll-contain bg-paper lg:hidden"
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
                <a
                  href={`#${item.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-baseline justify-between py-5 pl-6 font-display text-[2.5rem] leading-none transition-opacity active:opacity-50"
                >
                  {item.label}
                </a>
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
