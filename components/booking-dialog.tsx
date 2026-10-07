"use client";

import Image from "next/image";
import { unstable_isUnrecognizedActionError, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { type BookFlashState, bookFlash, getOpenSlots } from "@/app/(frontend)/actions";
import { PLACEMENTS } from "@/lib/booking-input";
import { PAYMENT_NOTE } from "@/lib/copy";
import type { OpenSlot, SlotDay } from "@/lib/time";
import { type FlashDesign, availabilityLabel, designName, formatPrice } from "./data";
import { Check, ChevronDown, ChevronLeft, Close } from "./icons";
import { useStore } from "./store";
import { Arrow, btn } from "./ui";

type Step = "slot" | "details" | "done";
// "outdated": the site was redeployed while the page was open, so its server actions no longer exist.
type ErrorCode = Extract<BookFlashState, { status: "error" }>["code"] | "outdated";
type Result = BookFlashState | { status: "error"; code: "outdated" };

const ERROR_TEXT: Record<ErrorCode, string> = {
  invalid: "Nézd át a jelölt mezőket.",
  rate_limited: "Túl sok foglalás érkezett erről a hálózatról. Próbáld újra később, vagy írj Instagramon: @pannipix.",
  design_unavailable: "Ez a minta jelenleg nem foglalható.",
  sold_out: "Ez a minta közben betelt.",
  slot_taken: "Ezt az időpontot közben lefoglalták, válassz másikat.",
  slot_past: "Ez az időpont már elmúlt, válassz másikat.",
  unknown: "Valami hiba történt. Próbáld újra, vagy írj Instagramon: @pannipix.",
  outdated: "Az oldal közben frissült. Töltsd újra, és foglalj még egyszer.",
};

const field =
  "mt-1.5 block w-full border-0 border-b border-hairline bg-transparent pb-3 pt-2 text-[1.0625rem] text-ink placeholder:text-ash transition-colors focus:border-ink focus:outline-none aria-invalid:border-ink";

function ErrorText({ id, children }: { id: string; children?: string }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-2 text-[0.875rem] italic">
      {children}
    </p>
  );
}

function TextField({
  label,
  error,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="label text-[0.6875rem] text-muted">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={field}
        {...props}
      />
      <ErrorText id={`${id}-error`}>{error}</ErrorText>
    </div>
  );
}

function BookingFlow({ design, onClose }: { design: FlashDesign; onClose: () => void }) {
  const router = useRouter();
  // Keep the header as it was when the dialog opened, even after the page refreshes availability.
  const [snapshot] = useState(design);
  const [step, setStep] = useState<Step>("slot");
  const [days, setDays] = useState<SlotDay[] | null>(null);
  const [loadError, setLoadError] = useState<"failed" | "outdated" | null>(null);
  const [slot, setSlot] = useState<OpenSlot | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<Result>({ status: "idle" });
  const [pending, startTransition] = useTransition();
  const placementId = useId();
  const noteId = useId();
  const slotHeading = useRef<HTMLHeadingElement>(null);
  const detailsHeading = useRef<HTMLHeadingElement>(null);
  const doneHeading = useRef<HTMLHeadingElement>(null);
  // The step whose heading has focus. The first step opens with focus where the dialog put it; tracking the step
  // (not a "mounted" flag) also keeps Strict Mode's second effect run from moving it.
  const focusedStep = useRef<Step>("slot");
  const form = useRef<HTMLFormElement>(null);

  const loadSlots = useCallback(() => {
    getOpenSlots().then(
      (next) => {
        setDays(next);
        setLoadError(null);
      },
      (err: unknown) => setLoadError(unstable_isUnrecognizedActionError(err) ? "outdated" : "failed"),
    );
  }, []);

  useEffect(loadSlots, [loadSlots]);

  // Move focus to the new step's heading, so keyboard and screen reader users follow along.
  useEffect(() => {
    if (focusedStep.current === step) return;
    focusedStep.current = step;
    ({ slot: slotHeading, details: detailsHeading, done: doneHeading })[step].current?.focus();
  }, [step]);

  // Like the browser's own checks: when the server rejects fields, focus the first one it marked.
  useEffect(() => {
    if (result.status === "error" && result.code === "invalid") {
      form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [result]);

  function retry() {
    // The button gives way to the loading text; keep focus in the step instead of losing it to <body>.
    slotHeading.current?.focus();
    setLoadError(null);
    setDays(null);
    loadSlots();
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // The submit button stays enabled while sending (see there), so a second press ends here.
    if (pending) return;
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      // A rejected action (dropped connection, redeploy, server error) must not reach the page's error boundary:
      // the visitor keeps the form and gets a message instead.
      let next: Result;
      try {
        next = await bookFlash(formData);
      } catch (err) {
        next = { status: "error", code: unstable_isUnrecognizedActionError(err) ? "outdated" : "unknown" };
      }
      setResult(next);
      if (next.status === "success") {
        setStep("done");
        router.refresh();
      } else if (next.status === "error" && (next.code === "slot_taken" || next.code === "slot_past")) {
        setNotice(ERROR_TEXT[next.code]);
        setSlot(null);
        setDays(null);
        setStep("slot");
        loadSlots();
      }
    });
  }

  const image = snapshot.images.find((i) => i.kind === "art") ?? snapshot.images[0];
  const name = designName(snapshot);
  const errors = result.status === "error" && result.code === "invalid" ? (result.fieldErrors ?? {}) : {};
  const formError =
    result.status === "error" && !["invalid", "slot_taken", "slot_past"].includes(result.code)
      ? ERROR_TEXT[result.code]
      : null;

  return (
    <div className="fade-up flex h-full max-h-[inherit] flex-col">
      <header className="flex items-start gap-4 border-b border-hairline px-5 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8 sm:pt-7">
        <div className="relative aspect-[219/344] w-14 shrink-0 overflow-hidden rounded-[3px] bg-stencil">
          <Image src={image.src} alt="" fill sizes="56px" quality={90} className="object-contain mix-blend-multiply" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="label text-[0.6875rem] text-muted">Időpontfoglalás</p>
          <h2 id="booking-title" className="mt-2 font-display text-[1.75rem] leading-tight">
            {name}
          </h2>
          <p className="mt-1 text-[0.9375rem] text-graphite">
            {formatPrice(snapshot.price)} · {availabilityLabel(snapshot.availability)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Bezárás"
          className="-mr-2 -mt-1 grid size-11 shrink-0 place-items-center rounded-full transition-[background-color,scale] duration-200 hover:bg-ink/5 active:scale-95"
        >
          <Close size={22} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-7 sm:px-8">
        {step === "done" ? (
          <section aria-live="polite" className="py-2">
            <span className="grid size-12 place-items-center rounded-full border border-ink">
              <Check size={22} />
            </span>
            <h3
              ref={doneHeading}
              tabIndex={-1}
              className="mt-6 font-display text-[clamp(1.9rem,4vw,2.4rem)] leading-tight focus:outline-none"
            >
              Megkaptam a foglalásod.
            </h3>
            <p className="mt-4 font-display text-[1.1875rem]">
              {name} · {slot?.label}
            </p>
            <p className="mt-4 max-w-[28rem] leading-[1.7] text-graphite">
              Hamarosan átnézem, és e-mailben visszaigazolom. Ha nem találod a levelet, nézd meg a spam mappát is.
            </p>
            <button type="button" onClick={onClose} className={`${btn.primary} mt-9`}>
              Rendben
            </button>
          </section>
        ) : (
          <>
            <section hidden={step !== "slot"} aria-labelledby="booking-slot-step">
              <h3
                id="booking-slot-step"
                ref={slotHeading}
                tabIndex={-1}
                className="label text-muted focus:outline-none"
              >
                1 · Válassz időpontot
              </h3>
              {notice && (
                <p role="alert" className="mt-5 border-l border-ink pl-4 text-[0.9375rem] leading-relaxed">
                  {notice}
                </p>
              )}

              {loadError === "outdated" ? (
                <div className="mt-6">
                  <p className="leading-relaxed text-graphite">{ERROR_TEXT.outdated}</p>
                  <button type="button" onClick={() => window.location.reload()} className={`${btn.outline} mt-5`}>
                    Újratöltés
                  </button>
                </div>
              ) : loadError === "failed" ? (
                <div className="mt-6">
                  <p className="leading-relaxed text-graphite">Nem sikerült betölteni az időpontokat.</p>
                  <button type="button" onClick={retry} className={`${btn.outline} mt-5`}>
                    Újrapróbálom
                  </button>
                </div>
              ) : days === null ? (
                <p className="mt-6 text-graphite" aria-live="polite">
                  Időpontok betöltése…
                </p>
              ) : days.length === 0 ? (
                <p className="mt-6 max-w-[28rem] leading-[1.7] text-graphite">
                  Most nincs szabad időpont. Írj Instagramon (
                  <a href="https://instagram.com/pannipix" className="underline underline-offset-4">
                    @pannipix
                  </a>
                  ), és szólok, ha újakat nyitok.
                </p>
              ) : (
                <div className="mt-6 space-y-7">
                  {days.map((day) => (
                    <fieldset key={day.key}>
                      <legend className="font-display text-[1.25rem]">{day.label}</legend>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {day.slots.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            aria-pressed={slot?.id === s.id}
                            aria-label={s.label}
                            onClick={() => {
                              setSlot(s);
                              setNotice(null);
                            }}
                            className="h-11 min-w-[5.5rem] rounded-[6px] bg-stencil px-4 font-display text-[1.0625rem] transition-[background-color,color,scale] duration-300 hover:bg-[#e3e3df] active:scale-[0.97] active:duration-75 aria-pressed:bg-ink aria-pressed:text-paper"
                          >
                            {s.time}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                </div>
              )}

              <div className="mt-10 flex flex-col gap-5 border-t border-hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-[22rem] text-[0.875rem] leading-snug text-muted">{PAYMENT_NOTE}</p>
                <button
                  type="button"
                  disabled={!slot}
                  onClick={() => setStep("details")}
                  className={`${btn.primary} shrink-0 disabled:opacity-40`}
                >
                  Tovább <Arrow />
                </button>
              </div>
            </section>

            {/* Stays mounted while the visitor goes back to change the time, so typed details survive. */}
            <form ref={form} hidden={step !== "details"} onSubmit={submit} aria-labelledby="booking-details-step">
              <div className="flex items-center justify-between gap-4">
                <h3
                  id="booking-details-step"
                  ref={detailsHeading}
                  tabIndex={-1}
                  className="label text-muted focus:outline-none"
                >
                  2 · Adataid
                </h3>
                <button
                  type="button"
                  onClick={() => setStep("slot")}
                  className="label -mr-2 flex min-h-11 items-center gap-1.5 px-2 text-[0.6875rem] transition-opacity hover:opacity-60"
                >
                  <ChevronLeft size={15} /> Időpont
                </button>
              </div>
              <p className="mt-3 font-display text-[1.25rem]">{slot?.label}</p>

              <input type="hidden" name="designId" value={snapshot.id} />
              <input type="hidden" name="slotId" value={slot?.id ?? ""} />
              {/* Honeypot: hidden from people and screen readers, tempting to bots. */}
              <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
                <label>
                  Weboldal
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>

              <div className="mt-8 grid gap-x-8 gap-y-8 sm:grid-cols-2">
                <TextField
                  label="Név"
                  name="name"
                  maxLength={100}
                  autoComplete="name"
                  autoCapitalize="words"
                  enterKeyHint="next"
                  required
                  error={errors.name}
                />
                <TextField
                  label="E-mail"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  enterKeyHint="next"
                  required
                  error={errors.email}
                />
                <TextField
                  label="Telefon"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  enterKeyHint="next"
                  required
                  error={errors.phone}
                />
                <div>
                  <label htmlFor={placementId} className="label text-[0.6875rem] text-muted">
                    Testtáj
                  </label>
                  <div className="relative">
                    <select
                      id={placementId}
                      name="placement"
                      required
                      defaultValue=""
                      aria-invalid={errors.placement ? true : undefined}
                      aria-describedby={errors.placement ? `${placementId}-error` : undefined}
                      className={`${field} cursor-pointer appearance-none pr-8`}
                    >
                      <option value="" disabled>
                        Válassz
                      </option>
                      {PLACEMENTS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="pointer-events-none absolute bottom-4 right-0 text-muted" />
                  </div>
                  <ErrorText id={`${placementId}-error`}>{errors.placement}</ErrorText>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor={noteId} className="label text-[0.6875rem] text-muted">
                    Megjegyzés (nem kötelező)
                  </label>
                  <textarea
                    id={noteId}
                    name="note"
                    rows={3}
                    maxLength={1000}
                    placeholder="Pontos hely, méret, kérdés…"
                    aria-invalid={errors.note ? true : undefined}
                    aria-describedby={errors.note ? `${noteId}-error` : undefined}
                    className={`${field} resize-none leading-[1.6]`}
                  />
                  <ErrorText id={`${noteId}-error`}>{errors.note}</ErrorText>
                </div>
              </div>

              <label className="mt-8 flex min-h-11 cursor-pointer select-none items-center gap-3 text-[0.9375rem] text-graphite">
                <input
                  type="checkbox"
                  name="adult"
                  required
                  aria-invalid={errors.adult ? true : undefined}
                  aria-describedby={errors.adult ? "booking-adult-error" : undefined}
                  className="size-[1.125rem] cursor-pointer accent-ink"
                />
                Elmúltam 18 éves.
              </label>
              <ErrorText id="booking-adult-error">{errors.adult}</ErrorText>

              {formError && (
                <p role="alert" className="mt-6 border-l border-ink pl-4 text-[0.9375rem] leading-relaxed">
                  {formError}
                </p>
              )}
              {result.status === "error" && result.code === "outdated" && (
                <button type="button" onClick={() => window.location.reload()} className={`${btn.outline} mt-5`}>
                  Újratöltés
                </button>
              )}

              <div className="mt-8 border-t border-hairline pt-6">
                <button
                  type="submit"
                  // Not disabled while sending: a focused button that turns disabled drops focus to <body>,
                  // and after a failed send the visitor would have to find their way back into the form.
                  disabled={!slot}
                  aria-disabled={pending || undefined}
                  className={`${btn.primary} w-full justify-between disabled:opacity-60 aria-disabled:opacity-60 sm:w-auto sm:min-w-[17rem]`}
                >
                  {pending ? "Küldés…" : "Foglalás elküldése"} <Arrow />
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export function BookingDialog({ designs }: { designs: FlashDesign[] }) {
  const { bookingFor, closeBooking } = useStore();
  const design = designs.find((d) => d.id === bookingFor) ?? null;
  const ref = useRef<HTMLDialogElement>(null);
  // The button that opened the dialog. A booking can remove it from the page (the design sells out).
  const opener = useRef<HTMLElement | null>(null);

  // The store decides whether the native dialog is open; Esc and the close button report back via onClose.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (design && !dialog.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    }
    if (!design && dialog.open) dialog.close();
  }, [design]);

  // A modal dialog doesn't stop the page behind it from scrolling on touch devices.
  useEffect(() => {
    if (!design) return;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [design]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="booking-title"
      onClose={() => {
        closeBooking();
        // The dialog hands focus back to its opener; if that button is gone, land on the collection's heading.
        requestAnimationFrame(() => {
          if (!opener.current?.isConnected) document.getElementById("flash-title")?.focus();
        });
      }}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself.
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      className="m-0 h-dvh max-h-none w-full max-w-none overflow-hidden bg-paper p-0 text-ink backdrop:bg-ink/45 sm:m-auto sm:h-auto sm:max-h-[min(54rem,calc(100dvh-4rem))] sm:w-[min(42rem,calc(100vw-4rem))] sm:rounded-[6px]"
    >
      {design && <BookingFlow key={design.id} design={design} onClose={() => ref.current?.close()} />}
    </dialog>
  );
}
