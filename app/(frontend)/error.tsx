"use client";

import { btn } from "@/components/ui";

// Last resort when something on the page throws: keep the visitor on a styled, Hungarian page.
// Next 16.3: `retry` re-fetches the page and renders it again; `reset` would only re-render what failed.
export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="grid min-h-svh place-items-center px-5 text-center">
      <div>
        <p className="label text-muted">Hiba</p>
        <h1 className="mt-5 font-display text-[clamp(2.4rem,5vw,4rem)] font-normal leading-none tracking-[-0.02em]">
          Valami elromlott.
        </h1>
        <p className="mx-auto mt-5 max-w-[26rem] leading-[1.7] text-graphite">
          Próbáld újra, vagy írj Instagramon: @pannipix.
        </p>
        <button type="button" onClick={retry} className={`${btn.primary} mt-9`}>
          Újrapróbálom
        </button>
      </div>
    </main>
  );
}
