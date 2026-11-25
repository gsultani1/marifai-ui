// packages/ai-ui/src/lib/dates.ts
export const DAY_MS = 86_400_000;

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function toDate(value: Date | string | number): Date {
  return value instanceof Date ? new Date(value.getTime()) : new Date(value);
}

export function startOfDay(value: Date | string | number): Date {
  const date = toDate(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function addDays(value: Date | string | number, days: number): Date {
  const date = toDate(value);
  date.setDate(date.getDate() + days);
  return date;
}

/** Adds months, clamping to the last day when the target month is shorter (Jan 31 + 1 month = Feb 28). */
export function addMonths(value: Date | string | number, months: number): Date {
  const date = toDate(value);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  date.setDate(Math.min(day, daysInMonth(date.getFullYear(), date.getMonth())));
  return date;
}

export function addMinutes(value: Date | string | number, minutes: number): Date {
  return new Date(toDate(value).getTime() + minutes * 60_000);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function startOfWeek(value: Date | string | number, weekStartsOn: Weekday = 0): Date {
  const date = startOfDay(value);
  const offset = (date.getDay() - weekStartsOn + 7) % 7;
  return addDays(date, -offset);
}

export function isSameDay(a: Date | string | number, b: Date | string | number): boolean {
  const x = toDate(a);
  const y = toDate(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/** Calendar days between two dates, ignoring time and daylight saving shifts. */
export function differenceInDays(a: Date | string | number, b: Date | string | number): number {
  const x = startOfDay(a);
  const y = startOfDay(b);
  return Math.round((Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()) - Date.UTC(y.getFullYear(), y.getMonth(), y.getDate())) / DAY_MS);
}

/** The 42 days (six weeks) shown for a month, starting on `weekStartsOn`. */
export function monthGrid(year: number, month: number, weekStartsOn: Weekday = 0): Date[] {
  const first = startOfWeek(new Date(year, month, 1), weekStartsOn);
  return Array.from({ length: 42 }, (_, index) => addDays(first, index));
}

/** ISO date "2026-10-24" in local time. */
export function toIsoDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

/** Parses "2026-10-24" as a local date, or returns null. */
export function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getMonth() === Number(match[2]) - 1 ? date : null;
}

/**
 * Orders a local date and time such as "2026-03-08T02:30" or "2026-03-08T02:30:15" as wall-clock time,
 * without any time zone, or returns NaN when it is not a valid date and time. Use it to compare values from
 * `datetime-local` inputs: `Date.parse` reads them in the browser's time zone, which shifts times inside a
 * daylight-saving gap even when they belong to another zone.
 */
export function wallClockTime(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(value.trim());
  if (!match) return Number.NaN;
  const [year, month, day, hour, minute] = match.slice(1, 6).map(Number) as [number, number, number, number, number];
  const second = Number(match[6] ?? 0);
  const millisecond = Number((match[7] ?? "0").padEnd(3, "0"));
  // UTC has no daylight-saving gaps, so it orders wall-clock times exactly; reject dates that roll over.
  const time = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const date = new Date(time);
  const valid = date.getUTCMonth() === month - 1 && date.getUTCDate() === day && date.getUTCHours() === hour && date.getUTCMinutes() === minute;
  return valid ? time : Number.NaN;
}

export function clampDate(value: Date, min?: Date, max?: Date): Date {
  if (min && value < startOfDay(min)) return startOfDay(min);
  if (max && value > startOfDay(max)) return startOfDay(max);
  return value;
}

export function weekdayNames(locale: string | undefined, weekStartsOn: Weekday = 0, width: "short" | "narrow" | "long" = "short"): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: width });
  const sunday = new Date(2026, 0, 4);
  return Array.from({ length: 7 }, (_, index) => formatter.format(addDays(sunday, (index + weekStartsOn) % 7)));
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date | string;
  end: Date | string;
  allDay?: boolean;
  /** CSS color of the event chip. */
  color?: string;
  location?: string;
  /** Read-only events cannot be dragged or resized. */
  readOnly?: boolean;
  /** RRULE subset: FREQ, INTERVAL, BYDAY, COUNT, UNTIL. */
  recurrence?: string;
}

export interface EventOccurrence {
  event: CalendarEvent;
  start: Date;
  end: Date;
  /** Index of the occurrence for recurring events. */
  occurrence: number;
}

export interface Recurrence {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  byDay: Weekday[];
  count?: number;
  until?: Date;
}

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** Parses an RRULE subset, e.g. "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=10". Returns null for anything unsupported. */
export function parseRecurrence(rule: string): Recurrence | null {
  const parts = Object.fromEntries(
    rule
      .replace(/^RRULE:/i, "")
      .split(";")
      .filter(Boolean)
      .map((part) => {
        const [key, value = ""] = part.split("=");
        return [key!.toUpperCase(), value.toUpperCase()];
      }),
  );
  const freq = parts.FREQ;
  if (freq !== "DAILY" && freq !== "WEEKLY" && freq !== "MONTHLY" && freq !== "YEARLY") return null;
  const interval = parts.INTERVAL ? Number(parts.INTERVAL) : 1;
  if (!Number.isInteger(interval) || interval < 1 || interval > 999) return null;
  const byDay = (parts.BYDAY ? parts.BYDAY.split(",") : []).map((code) => DAY_CODES.indexOf(code.slice(-2))).filter((day) => day >= 0) as Weekday[];
  const recurrence: Recurrence = { freq, interval, byDay };
  if (parts.COUNT) {
    const count = Number(parts.COUNT);
    if (!Number.isInteger(count) || count < 1) return null;
    recurrence.count = Math.min(count, 2000);
  }
  if (parts.UNTIL) {
    const match = /^(\d{4})(\d{2})(\d{2})/.exec(parts.UNTIL);
    if (!match) return null;
    recurrence.until = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 59);
  }
  return recurrence;
}

/** Plain-English summary: "Every 2 weeks on Mon and Wed, 10 times". */
export function describeRecurrence(rule: string, locale?: string): string {
  const recurrence = parseRecurrence(rule);
  if (!recurrence) return "Custom repeat";
  const unit = { DAILY: "day", WEEKLY: "week", MONTHLY: "month", YEARLY: "year" }[recurrence.freq];
  const single = { DAILY: "Daily", WEEKLY: "Weekly", MONTHLY: "Monthly", YEARLY: "Yearly" }[recurrence.freq];
  let text = recurrence.interval === 1 ? single : `Every ${recurrence.interval} ${unit}s`;
  if (recurrence.freq === "WEEKLY" && recurrence.byDay.length) {
    const names = weekdayNames(locale, 0, "short");
    const days = recurrence.byDay.map((day) => names[day]!);
    text += ` on ${days.length > 1 ? `${days.slice(0, -1).join(", ")} and ${days.at(-1)}` : days[0]}`;
  }
  if (recurrence.count) text += `, ${recurrence.count} ${recurrence.count === 1 ? "time" : "times"}`;
  if (recurrence.until) text += `, until ${new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(recurrence.until)}`;
  return text;
}

const MAX_OCCURRENCES = 1000;

/** Occurrences of events that overlap [from, to), with recurring events expanded. */
export function expandEvents(events: CalendarEvent[], from: Date, to: Date): EventOccurrence[] {
  const result: EventOccurrence[] = [];
  for (const event of events) {
    const start = toDate(event.start);
    const end = toDate(event.end);
    const duration = Math.max(0, end.getTime() - start.getTime());
    const recurrence = event.recurrence ? parseRecurrence(event.recurrence) : null;
    if (!recurrence) {
      if (start < to && (end > from || (duration === 0 && start >= from))) result.push({ event, start, end, occurrence: 0 });
      continue;
    }
    let occurrence = 0;
    let produced = 0;
    const emit = (when: Date) => {
      if (when < start) return true;
      if (recurrence.until && when > recurrence.until) return false;
      if (recurrence.count !== undefined && produced >= recurrence.count) return false;
      produced++;
      const occurrenceEnd = new Date(when.getTime() + duration);
      if (when < to && occurrenceEnd > from) result.push({ event, start: when, end: occurrenceEnd, occurrence });
      occurrence++;
      return when < to && produced < MAX_OCCURRENCES * 5;
    };
    const atTime = (day: Date) => {
      const date = new Date(day);
      date.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), start.getMilliseconds());
      return date;
    };
    if (recurrence.freq === "WEEKLY") {
      const days = recurrence.byDay.length ? [...recurrence.byDay].sort() : [start.getDay() as Weekday];
      let week = startOfWeek(start, 0);
      outer: for (let guard = 0; guard < 5000; guard++) {
        for (const day of days) {
          if (!emit(atTime(addDays(week, day)))) break outer;
        }
        week = addDays(week, 7 * recurrence.interval);
      }
    } else {
      for (let step = 0; step < 20_000; step++) {
        const when =
          recurrence.freq === "DAILY" ? atTime(addDays(start, step * recurrence.interval)) : recurrence.freq === "MONTHLY" ? atTime(addMonths(start, step * recurrence.interval)) : atTime(addMonths(start, step * recurrence.interval * 12));
        if (recurrence.freq === "MONTHLY" && when.getDate() !== start.getDate()) continue;
        if (!emit(when)) break;
      }
    }
  }
  return result.sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime()).slice(0, MAX_OCCURRENCES * 5);
}

/** Whether an occurrence touches a day; all-day and multi-day events span every day they cover. */
export function occursOn(occurrence: EventOccurrence, day: Date): boolean {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  if (occurrence.start.getTime() === occurrence.end.getTime()) return occurrence.start >= dayStart && occurrence.start < dayEnd;
  return occurrence.start < dayEnd && occurrence.end > dayStart;
}

export interface PositionedOccurrence extends EventOccurrence {
  /** Minutes from midnight, clamped to the day. */
  top: number;
  height: number;
  column: number;
  columns: number;
}

/**
 * Lays out timed occurrences for one day side by side when they overlap:
 * clusters of overlapping events share the width equally.
 */
export function layoutDay(occurrences: EventOccurrence[], day: Date, minDuration = 15): PositionedOccurrence[] {
  const dayStart = startOfDay(day).getTime();
  const items = occurrences
    .filter((item) => !item.event.allDay && occursOn(item, day))
    .map((item) => {
      const top = Math.max(0, (item.start.getTime() - dayStart) / 60_000);
      const bottom = Math.min(1440, Math.max(top + minDuration, (item.end.getTime() - dayStart) / 60_000));
      return { ...item, top, height: bottom - top, column: 0, columns: 1 };
    })
    .sort((a, b) => a.top - b.top || b.height - a.height);
  const result: PositionedOccurrence[] = [];
  let cluster: PositionedOccurrence[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const columnsEnd: number[] = [];
    for (const item of cluster) {
      let column = columnsEnd.findIndex((end) => end <= item.top);
      if (column === -1) column = columnsEnd.length;
      columnsEnd[column] = item.top + item.height;
      item.column = column;
    }
    for (const item of cluster) item.columns = columnsEnd.length;
    result.push(...cluster);
    cluster = [];
  };
  for (const item of items) {
    if (cluster.length && item.top >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.top + item.height);
  }
  flush();
  return result;
}

/** Rounds minutes to the nearest step: 37 with step 30 gives 30. */
export function snapMinutes(minutes: number, step = 30): number {
  return Math.round(minutes / step) * step;
}

/** A rank between two neighbours for ordering lists without renumbering. */
export function rankBetween(before: number | undefined, after: number | undefined): number {
  if (before === undefined && after === undefined) return 1;
  if (before === undefined) return after! - 1;
  if (after === undefined) return before + 1;
  return (before + after) / 2;
}
