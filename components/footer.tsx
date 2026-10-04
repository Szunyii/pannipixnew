import { FooterMark } from "./footer-mark";
import { container } from "./ui";

const links = [
  ["#tattoo", "Tattoo"],
  ["#flash", "Flash"],
  ["#info", "Info"],
  ["#rolam", "Rólam"],
  ["#kapcsolat", "Kapcsolat"],
];

export function Footer() {
  return (
    <footer className="bg-ink text-paper">
      {/* Bottom padding matches the side gutter, so the wordmark sits in an even frame (plus the home-indicator inset). */}
      <div className={`${container} border-t border-paper/15 pb-[calc(var(--gutter)+env(safe-area-inset-bottom,0px))] pt-12`}>
        <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <p className="max-w-[18rem] text-[0.9375rem] leading-relaxed text-ash">
            Konceptuális, absztrakt és mikrorealista tetoválások.
          </p>
          <nav aria-label="Lábléc">
            <ul className="label -my-3 flex flex-wrap gap-x-8 text-[0.6875rem] text-ash">
              {links.map(([href, label]) => (
                <li key={href}>
                  <a href={href} className="inline-flex min-h-11 items-center transition-colors hover:text-paper active:text-paper">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="label mt-12 flex flex-col gap-3 text-[0.625rem] text-ash/80 sm:flex-row sm:justify-between">
          <p>© 2026 PANNIPIX</p>
          <p className="-my-3 flex gap-6">
            <a href="#" className="inline-flex min-h-11 items-center hover:text-paper active:text-paper">Adatkezelés</a>
            <a href="#" className="inline-flex min-h-11 items-center hover:text-paper active:text-paper">ÁSZF</a>
          </p>
        </div>
        <FooterMark className="mt-14 sm:mt-20 lg:mt-24" />
      </div>
    </footer>
  );
}
