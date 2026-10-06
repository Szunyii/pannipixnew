export const TIME_ZONE = "Europe/Budapest";

const hu = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("hu-HU", { timeZone: TIME_ZONE, ...options });

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

/** Reads a wall-clock time ("2026-10-14", "10:00") as Budapest time and returns it as a UTC ISO string. */
export function zonedTimeToUtc(day: string, time: string): string {
  const asUtc = new Date(`${day}T${time}:00.000Z`);
  // How far Budapest is ahead of UTC at that moment: 1 or 2 hours, depending on summer time.
  const local = new Date(asUtc.toLocaleString("en-US", { timeZone: TIME_ZONE }));
  const utc = new Date(asUtc.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(asUtc.getTime() - (local.getTime() - utc.getTime())).toISOString();
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
