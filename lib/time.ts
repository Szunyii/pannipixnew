export const TIME_ZONE = "Europe/Budapest";

const hu = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("hu-HU", { timeZone: TIME_ZONE, ...options });

// en-CA on purpose: it formats as YYYY-MM-DD, which zonedTimeToUtc and the seed build dates from. Don't "simplify" it
// to hu-HU, that gives "2026. 10. 14.".
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dayLabelFormat = hu({ month: "short", day: "numeric", weekday: "long" });
const timeFormat = hu({ hour: "2-digit", minute: "2-digit" });
const fullFormat = hu({ year: "numeric", month: "long", day: "numeric", weekday: "long", hour: "2-digit", minute: "2-digit" });
const numericDateFormat = hu({ year: "numeric", month: "2-digit", day: "2-digit" });
const weekdayFormat = hu({ weekday: "long" });

/** A Date, or an ISO string with "Z" or an offset, as Payload returns dates (a date-time string without either is read in the machine's zone). */
type DateInput = Date | string;
const toDate = (value: DateInput) => (value instanceof Date ? value : new Date(value));

/** The Budapest calendar day, e.g. "2026-10-14"; slots are grouped by it. */
export const dayKey = (value: DateInput) => dayKeyFormat.format(toDate(value));
/** "okt. 14., szerda" */
export const formatSlotDay = (value: DateInput) => dayLabelFormat.format(toDate(value));
/** "10:00" */
export const formatSlotTime = (value: DateInput) => timeFormat.format(toDate(value));
/** "2026. október 14., szerda 10:00" */
export const formatSlotFull = (value: DateInput) => fullFormat.format(toDate(value));

/** "2026. 10. 14. (szerda) 10:00": a slot's name in the admin. */
export function formatSlotTitle(value: DateInput) {
  const date = toDate(value);
  return `${numericDateFormat.format(date)} (${weekdayFormat.format(date)}) ${timeFormat.format(date)}`;
}

const shortDateFormat = hu({ month: "short", day: "numeric" });
const shortDateWithYearFormat = hu({ year: "numeric", month: "short", day: "numeric" });

/**
 * The calendar day before a day key: "2026-03-01" → "2026-02-28". A day key has no time of day, so a clock change
 * can't shift it.
 */
function previousDayKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}

/**
 * When a booking came in, as the admin dashboard says it: "ma 14:32", "tegnap 19:05", "okt. 13.", or "2025. okt. 13."
 * from another year. Today and yesterday are Budapest days. `now` comes in so one page renders one moment.
 */
export function formatReceivedAt(value: DateInput, now: DateInput) {
  const day = dayKey(value);
  const today = dayKey(now);
  if (day === today) return `ma ${formatSlotTime(value)}`;
  if (day === previousDayKey(today)) return `tegnap ${formatSlotTime(value)}`;
  const format = day.slice(0, 4) === today.slice(0, 4) ? shortDateFormat : shortDateWithYearFormat;
  return format.format(toDate(value));
}

const offsetFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

/** How far Budapest is ahead of UTC at an instant, in ms (1 or 2 hours). Built from formatted parts, so the machine's time zone never enters. */
function offsetAt(ms: number) {
  const p = Object.fromEntries(offsetFormat.formatToParts(ms).map((part) => [part.type, part.value]));
  // The parts have whole-second resolution.
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000;
}

/**
 * Reads a wall-clock time as Budapest time and returns it as a UTC ISO string. The input is trusted, not validated:
 * `day` is "YYYY-MM-DD" and `time` is "HH:mm", e.g. ("2026-10-14", "10:00"). A time skipped by the spring clock change
 * moves forward one hour; a time repeated in autumn resolves to the later, winter-time instant.
 */
export function zonedTimeToUtc(day: string, time: string): string {
  const asUtc = Date.parse(`${day}T${time}:00.000Z`);
  // The first guess can lie across a summer-time change from asUtc, so read the offset again at the guess.
  const guess = asUtc - offsetAt(asUtc);
  return new Date(asUtc - offsetAt(guess)).toISOString();
}

export type OpenSlot = { id: number; startsAt: string; time: string; label: string };
export type SlotDay = { key: string; label: string; slots: OpenSlot[] };

/** Groups slots into Budapest calendar days, earliest first. */
export function groupSlotsByDay(slots: { id: number; startsAt: string }[]): SlotDay[] {
  const days = new Map<string, SlotDay>();
  const sorted = [...slots].sort((a, b) => toDate(a.startsAt).getTime() - toDate(b.startsAt).getTime());
  for (const slot of sorted) {
    const key = dayKey(slot.startsAt);
    let day = days.get(key);
    if (!day) {
      day = { key, label: formatSlotDay(slot.startsAt), slots: [] };
      days.set(key, day);
    }
    day.slots.push({
      id: slot.id,
      startsAt: slot.startsAt,
      time: formatSlotTime(slot.startsAt),
      label: formatSlotFull(slot.startsAt),
    });
  }
  return [...days.values()];
}
