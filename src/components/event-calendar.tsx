// packages/ai-ui/src/components/event-calendar.tsx
"use client";

import { ChevronLeftIcon, ChevronRightIcon, RepeatIcon } from "lucide-react";
import { type ComponentProps, type KeyboardEvent, type MouseEvent, type PointerEvent as ReactPointerEvent, useEffect, useId, useMemo, useRef, useState } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { useNow } from "../hooks/use-now.js";
import { button, buttonVariants, focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import {
  addDays,
  addMinutes,
  addMonths,
  type CalendarEvent,
  differenceInDays,
  type EventOccurrence,
  expandEvents,
  isSameDay,
  isSameMonth,
  layoutDay,
  monthGrid,
  occursOn,
  snapMinutes,
  startOfDay,
  startOfWeek,
  type Weekday,
  weekdayNames,
} from "../lib/dates.js";

export type CalendarView = "month" | "week" | "day" | "agenda";

const HOUR_PX = 48;
const MINUTE_PX = HOUR_PX / 60;
const DRAG_THRESHOLD = 5;

export interface EventCalendarProps extends Omit<ComponentProps<"section">, "onChange"> {
  events: CalendarEvent[];
  view?: CalendarView;
  defaultView?: CalendarView;
  onViewChange?: (view: CalendarView) => void;
  /** Day the view is anchored to. */
  date?: Date;
  defaultDate?: Date;
  onDateChange?: (date: Date) => void;
  onEventClick?: (occurrence: EventOccurrence) => void;
  /** Called after a drag, resize or keyboard move with the new times. Recurring and read-only events do not move. */
  onEventChange?: (event: CalendarEvent, change: { start: Date; end: Date }) => void;
  /** Called when the user picks an empty slot or day. */
  onCreate?: (slot: { start: Date; end: Date; allDay: boolean }) => void;
  weekStartsOn?: Weekday;
  locale?: string;
  /** Height of the scrolling time grid. */
  height?: number | string;
  /** Hour the time grid scrolls to on open. */
  scrollToHour?: number;
  snapTo?: number;
  agendaDays?: number;
  maxEventsPerDay?: number;
  readOnly?: boolean;
  label?: string;
}

interface DragState {
  occurrence: EventOccurrence;
  mode: "move" | "resize";
  pointer: { x: number; y: number };
  moved: boolean;
}

const VIEWS: Array<{ id: CalendarView; label: string }> = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "day", label: "Day" },
  { id: "agenda", label: "Agenda" },
];

const fallbackColor = "var(--primary)";
/** Secondary chip text; muted-foreground is too faint on tinted chips. */
const chipSecondary = "text-foreground/75";

function chipStyle(color: string | undefined) {
  const tone = color ?? fallbackColor;
  return { background: `color-mix(in oklab, ${tone} 16%, var(--background))`, borderColor: `color-mix(in oklab, ${tone} 55%, var(--background))` };
}

/**
 * Scheduling calendar with month, week, day and agenda views. Overlapping
 * events share width, a line marks the current time, recurring events
 * (RRULE subset) expand into occurrences, and multi-day events appear on
 * every day they cover. Drag to move or resize in 30-minute steps (across
 * days in week view), click an empty slot to create, and use Alt+arrows on
 * a focused event to move it by keyboard (Alt+Shift+Up/Down resizes).
 */
export function EventCalendar({
  events,
  view: viewProp,
  defaultView = "week",
  onViewChange,
  date: dateProp,
  defaultDate,
  onDateChange,
  onEventClick,
  onEventChange,
  onCreate,
  weekStartsOn = 0,
  locale,
  height = "36rem",
  scrollToHour = 7.5,
  snapTo = 30,
  agendaDays = 30,
  maxEventsPerDay = 3,
  readOnly = false,
  label = "Calendar",
  className,
  ...props
}: EventCalendarProps) {
  const [view, setView] = useControllableState({ value: viewProp, defaultValue: defaultView, onChange: onViewChange });
  const [anchor, setAnchor] = useState(() => startOfDay(defaultDate ?? new Date()));
  const [date, setDate] = useControllableState({ value: dateProp ? startOfDay(dateProp) : undefined, defaultValue: anchor, onChange: (next: Date) => {
    setAnchor(next);
    onDateChange?.(next);
  } });
  const [preview, setPreview] = useState<{ key: string; start: Date; end: Date } | null>(null);
  const [focusedDay, setFocusedDay] = useState<Date>(date);
  const [announcement, setAnnouncement] = useState("");
  const [drag, setDrag] = useState<DragState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const now = useNow(60_000);
  const nowDate = new Date(now);

  const range = useMemo(() => {
    if (view === "month") {
      const grid = monthGrid(date.getFullYear(), date.getMonth(), weekStartsOn);
      return { from: grid[0]!, to: addDays(grid[41]!, 1), days: grid };
    }
    if (view === "week") {
      const start = startOfWeek(date, weekStartsOn);
      const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
      return { from: start, to: addDays(start, 7), days };
    }
    if (view === "day") return { from: date, to: addDays(date, 1), days: [date] };
    return { from: date, to: addDays(date, agendaDays), days: Array.from({ length: agendaDays }, (_, index) => addDays(date, index)) };
  }, [view, date, weekStartsOn, agendaDays]);

  const occurrences = useMemo(() => expandEvents(events, range.from, range.to), [events, range]);
  const keyOf = (occurrence: EventOccurrence) => `${occurrence.event.id}:${occurrence.occurrence}`;
  const displayed = (occurrence: EventOccurrence): EventOccurrence => (preview && preview.key === keyOf(occurrence) ? { ...occurrence, start: preview.start, end: preview.end } : occurrence);
  const shown = occurrences.map(displayed);
  const timeFormat = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" });
  const canMove = (occurrence: EventOccurrence) => !readOnly && !occurrence.event.readOnly && !occurrence.event.recurrence && Boolean(onEventChange);

  useEffect(() => {
    if ((view === "week" || view === "day") && scrollRef.current) scrollRef.current.scrollTop = Math.max(0, scrollToHour * HOUR_PX - 12);
  }, [view, scrollToHour]);

  const navigate = (direction: -1 | 0 | 1) => {
    if (direction === 0) {
      setDate(startOfDay(new Date()));
      setFocusedDay(startOfDay(new Date()));
      return;
    }
    const next = view === "month" ? addMonths(date, direction) : view === "week" ? addDays(date, 7 * direction) : view === "day" ? addDays(date, direction) : addDays(date, agendaDays * direction);
    setDate(next);
    setFocusedDay(next);
  };

  const heading = (() => {
    if (view === "month") return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(date);
    if (view === "day") return new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(date);
    const end = addDays(range.to, -1);
    return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).formatRange(range.from, end);
  })();

  const commitChange = (occurrence: EventOccurrence, start: Date, end: Date) => {
    if (!canMove(occurrence)) return;
    onEventChange?.(occurrence.event, { start, end });
    setAnnouncement(`${occurrence.event.title} moved to ${new Intl.DateTimeFormat(locale, { weekday: "short", hour: "numeric", minute: "2-digit" }).format(start)}`);
  };

  /* ---------------- time grid pointer handling ---------------- */

  const dayFromPoint = (x: number, y: number): Date | null => {
    const column = document.elementFromPoint?.(x, y)?.closest<HTMLElement>("[data-day-column]");
    return column?.dataset.dayColumn ? new Date(Number(column.dataset.dayColumn)) : null;
  };

  const onEventPointerDown = (event: ReactPointerEvent<HTMLElement>, occurrence: EventOccurrence, mode: "move" | "resize") => {
    if (event.button !== 0) return;
    event.stopPropagation();
    if (!canMove(occurrence)) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDrag({ occurrence, mode, pointer: { x: event.clientX, y: event.clientY }, moved: false });
  };

  const onGridPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!drag) return;
    const dx = event.clientX - drag.pointer.x;
    const dy = event.clientY - drag.pointer.y;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!drag.moved) setDrag({ ...drag, moved: true });
    const minutes = snapMinutes(dy / MINUTE_PX, snapTo);
    const { start, end } = drag.occurrence;
    if (drag.mode === "resize") {
      const nextEnd = addMinutes(end, minutes);
      setPreview({ key: keyOf(drag.occurrence), start, end: nextEnd.getTime() - start.getTime() < 15 * 60_000 ? addMinutes(start, 15) : nextEnd });
      return;
    }
    const day = dayFromPoint(event.clientX, event.clientY);
    const dayShift = day ? differenceInDays(day, start) : 0;
    setPreview({ key: keyOf(drag.occurrence), start: addMinutes(addDays(start, dayShift), minutes), end: addMinutes(addDays(end, dayShift), minutes) });
  };

  const onGridPointerUp = () => {
    setDrag(null);
    if (!drag) return;
    if (drag.moved && preview) commitChange(drag.occurrence, preview.start, preview.end);
    else if (!drag.moved) onEventClick?.(drag.occurrence);
    setPreview(null);
  };

  const onColumnClick = (event: MouseEvent<HTMLElement>, day: Date) => {
    if (readOnly || !onCreate || event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const minutes = Math.max(0, Math.min(1410, snapMinutes((event.clientY - rect.top) / MINUTE_PX - snapTo / 2, snapTo)));
    const start = addMinutes(day, minutes);
    onCreate({ start, end: addMinutes(start, 60), allDay: false });
  };

  const onEventKeyDown = (event: KeyboardEvent<HTMLElement>, occurrence: EventOccurrence) => {
    if (!event.altKey) return;
    const { start, end } = occurrence;
    let next: { start: Date; end: Date } | null = null;
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const delta = event.key === "ArrowUp" ? -snapTo : snapTo;
      next = event.shiftKey ? { start, end: addMinutes(end, delta).getTime() - start.getTime() >= 15 * 60_000 ? addMinutes(end, delta) : end } : { start: addMinutes(start, delta), end: addMinutes(end, delta) };
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const days = event.key === "ArrowLeft" ? -1 : 1;
      next = { start: addDays(start, days), end: addDays(end, days) };
    }
    if (next) {
      event.preventDefault();
      if (canMove(occurrence)) commitChange(occurrence, next.start, next.end);
      else setAnnouncement(`${occurrence.event.title} cannot be moved`);
    }
  };

  const eventLabel = (occurrence: EventOccurrence) =>
    `${occurrence.event.title}, ${occurrence.event.allDay ? "all day" : `${timeFormat.format(occurrence.start)} to ${timeFormat.format(occurrence.end)}`}${occurrence.event.location ? `, ${occurrence.event.location}` : ""}${occurrence.event.recurrence ? ", repeats" : ""}`;
  // Chips show a compact layout; the spoken name comes from this full label so visible text and name never disagree.
  const chipLabel = (occurrence: EventOccurrence) => <span className="sr-only">{eventLabel(occurrence)}</span>;

  /* ---------------- views ---------------- */

  const renderTimeGrid = () => {
    const days = range.days;
    const allDay = (day: Date) => shown.filter((occurrence) => (occurrence.event.allDay || differenceInDays(occurrence.end, occurrence.start) >= 1) && occursOn(occurrence, day));
    return (
      <div className="flex min-h-0 flex-col">
        <div className="flex border-b border-border">
          <div className="w-14 shrink-0" />
          {days.map((day) => (
            <div key={day.getTime()} className="flex min-w-0 flex-1 flex-col items-center border-l border-border py-1">
              <button
                type="button"
                onClick={() => {
                  setDate(day);
                  setView("day");
                }}
                aria-current={isSameDay(day, nowDate) ? "date" : undefined}
                className={cn("flex flex-col items-center rounded-md px-2 text-xs hover:bg-accent", focusRing)}
              >
                <span aria-hidden="true" className="text-muted-foreground">{new Intl.DateTimeFormat(locale, { weekday: "short" }).format(day)}</span>
                <span aria-hidden="true" className={cn("flex size-7 items-center justify-center rounded-full text-base tabular-nums", isSameDay(day, nowDate) && "bg-primary text-primary-foreground")}>{day.getDate()}</span>
                <span className="sr-only">{new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric" }).format(day)}</span>
              </button>
            </div>
          ))}
        </div>
        <div className="flex border-b border-border">
          <div className="flex w-14 shrink-0 items-center justify-end pr-2 text-[10px] text-muted-foreground">all day</div>
          {days.map((day) => (
            <div key={day.getTime()} className="flex min-h-7 min-w-0 flex-1 flex-col gap-0.5 border-l border-border p-0.5">
              {allDay(day).map((occurrence) => (
                <button key={keyOf(occurrence)} type="button" onClick={() => onEventClick?.(occurrence)} className={cn("truncate rounded border px-1 text-left text-xs", focusRing)} style={chipStyle(occurrence.event.color)}>
                  <span aria-hidden="true">{occurrence.event.title}</span>
                  {chipLabel(occurrence)}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div ref={scrollRef} className="relative min-h-0 overflow-y-auto" style={{ height }} onPointerMove={onGridPointerMove} onPointerUp={onGridPointerUp} onPointerCancel={() => {
          setDrag(null);
          setPreview(null);
        }}>
          <div className="relative flex" style={{ height: 24 * HOUR_PX }}>
            <div aria-hidden="true" className="relative w-14 shrink-0">
              {Array.from({ length: 23 }, (_, index) => (
                <span key={index} className="absolute right-2 -translate-y-1/2 text-[10px] text-muted-foreground tabular-nums" style={{ top: (index + 1) * HOUR_PX }}>
                  {timeFormat.format(new Date(2026, 0, 1, index + 1))}
                </span>
              ))}
            </div>
            {days.map((day) => {
              const positioned = layoutDay(
                shown.filter((occurrence) => !occurrence.event.allDay && differenceInDays(occurrence.end, occurrence.start) < 1),
                day,
              );
              const today = isSameDay(day, nowDate);
              const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
              return (
                <div
                  key={day.getTime()}
                  data-day-column={day.getTime()}
                  role="group"
                  aria-label={new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric" }).format(day)}
                  onClick={(event) => onColumnClick(event, day)}
                  className={cn("relative min-w-0 flex-1 border-l border-border bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_47px,var(--border)_47px,var(--border)_48px)]", !readOnly && onCreate && "cursor-cell")}
                >
                  {positioned.map((occurrence) => {
                    const movable = canMove(occurrence);
                    const dragging = preview?.key === keyOf(occurrence);
                    return (
                      <div
                        key={keyOf(occurrence)}
                        role="button"
                        tabIndex={0}
                        aria-keyshortcuts={movable ? "Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight Alt+Shift+ArrowUp Alt+Shift+ArrowDown" : undefined}
                        data-event-id={occurrence.event.id}
                        onPointerDown={(event) => onEventPointerDown(event, occurrence, "move")}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (!movable) onEventClick?.(occurrence);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onEventClick?.(occurrence);
                          } else onEventKeyDown(event, occurrence);
                        }}
                        className={cn("absolute overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-xs shadow-sm select-none", movable ? "cursor-grab" : "cursor-pointer", dragging && "z-10 opacity-90 ring-2 ring-ring", focusRing)}
                        style={{
                          top: occurrence.top * MINUTE_PX,
                          height: Math.max(18, occurrence.height * MINUTE_PX - 2),
                          left: `calc(${(occurrence.column / occurrence.columns) * 100}% + 2px)`,
                          width: `calc(${100 / occurrence.columns}% - 4px)`,
                          ...chipStyle(occurrence.event.color),
                        }}
                      >
                        <span aria-hidden="true" className="flex items-center gap-1 font-medium">
                          <span className="truncate">{occurrence.event.title}</span>
                          {occurrence.event.recurrence && <RepeatIcon className="size-3 shrink-0" />}
                        </span>
                        {occurrence.height >= 40 && (
                          <span aria-hidden="true" className={cn("block truncate tabular-nums", chipSecondary)}>
                            {timeFormat.format(occurrence.start)} – {timeFormat.format(occurrence.end)}
                          </span>
                        )}
                        {chipLabel(occurrence)}
                        {movable && <span aria-hidden="true" onPointerDown={(event) => onEventPointerDown(event, occurrence, "resize")} className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize" />}
                      </div>
                    );
                  })}
                  {today && (
                    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-destructive" style={{ top: nowMinutes * MINUTE_PX }}>
                      <span className="absolute -top-1 -left-1 size-2.5 rounded-full bg-destructive" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderMonth = () => {
    const names = weekdayNames(locale, weekStartsOn, "short");
    const longNames = weekdayNames(locale, weekStartsOn, "long");
    const onKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
      if ((event.target as HTMLElement).dataset.day === undefined) return;
      const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      const delta = moves[event.key];
      if (delta !== undefined) {
        event.preventDefault();
        const next = addDays(focusedDay, delta);
        setFocusedDay(next);
        if (!isSameMonth(next, date)) setDate(next);
        requestAnimationFrame(() => document.getElementById(`${id}-day-${next.getTime()}`)?.focus());
      }
    };
    return (
      <table role="grid" aria-label={heading} onKeyDown={onKeyDown} className="w-full table-fixed border-collapse">
        <thead>
          <tr>
            {names.map((name, index) => (
              <th key={name} scope="col" abbr={longNames[index]} className="border-b border-border py-1 text-xs font-normal text-muted-foreground">
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }, (_, week) => (
            <tr key={week}>
              {range.days.slice(week * 7, week * 7 + 7).map((day) => {
                const dayEvents = shown.filter((occurrence) => occursOn(occurrence, day));
                const extra = dayEvents.length - maxEventsPerDay;
                const focused = isSameDay(day, focusedDay) && isSameMonth(focusedDay, date) ? true : isSameDay(day, date) && !isSameMonth(focusedDay, date);
                return (
                  <td key={day.getTime()} role="gridcell" className={cn("h-24 border border-border p-1 align-top", !isSameMonth(day, date) && "bg-muted/40")} onDoubleClick={() => !readOnly && onCreate?.({ start: addMinutes(day, 9 * 60), end: addMinutes(day, 10 * 60), allDay: false })}>
                    <div className="flex flex-col gap-0.5">
                      <button
                        id={`${id}-day-${day.getTime()}`}
                        type="button"
                        data-day=""
                        tabIndex={focused ? 0 : -1}
                        aria-label={`${new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric" }).format(day)}, ${dayEvents.length} ${dayEvents.length === 1 ? "event" : "events"}`}
                        aria-current={isSameDay(day, nowDate) ? "date" : undefined}
                        onFocus={() => setFocusedDay(day)}
                        onClick={() => {
                          setDate(day);
                          setView("day");
                        }}
                        className={cn("flex size-6 items-center justify-center self-end rounded-full text-xs tabular-nums hover:bg-accent", !isSameMonth(day, date) && "text-muted-foreground", isSameDay(day, nowDate) && "bg-primary text-primary-foreground hover:bg-primary", focusRing)}
                      >
                        {day.getDate()}
                      </button>
                      {dayEvents.slice(0, maxEventsPerDay).map((occurrence) => (
                        <button key={keyOf(occurrence)} type="button" onClick={() => onEventClick?.(occurrence)} className={cn("truncate rounded border px-1 text-left text-xs", focusRing)} style={chipStyle(occurrence.event.color)}>
                          <span aria-hidden="true">
                            {!occurrence.event.allDay && isSameDay(occurrence.start, day) && <span className={cn("tabular-nums", chipSecondary)}>{timeFormat.format(occurrence.start)} </span>}
                            {occurrence.event.title}
                          </span>
                          {chipLabel(occurrence)}
                        </button>
                      ))}
                      {extra > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setDate(day);
                            setView("day");
                          }}
                          className={cn("rounded px-1 text-left text-xs text-muted-foreground hover:bg-accent", focusRing)}
                        >
                          +{extra} more
                        </button>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderAgenda = () => {
    const groups = range.days.map((day) => ({ day, items: shown.filter((occurrence) => occursOn(occurrence, day)) })).filter((group) => group.items.length);
    if (groups.length === 0) return <p className="p-6 text-center text-muted-foreground">Nothing in the next {agendaDays} days.</p>;
    return (
      <ol className="flex flex-col gap-4 overflow-y-auto p-3" style={{ maxHeight: height }}>
        {groups.map(({ day, items }) => (
          <li key={day.getTime()} className="flex gap-4">
            <span className={cn("w-24 shrink-0 text-sm font-medium", isSameDay(day, nowDate) && "text-primary")}>{new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" }).format(day)}</span>
            <ul className="flex min-w-0 flex-1 flex-col gap-1">
              {items.map((occurrence) => (
                <li key={keyOf(occurrence)}>
                  <button type="button" onClick={() => onEventClick?.(occurrence)} className={cn("flex w-full items-center gap-3 rounded-md border px-2 py-1.5 text-left text-sm hover:bg-accent/50", focusRing)} style={chipStyle(occurrence.event.color)}>
                    <span className={cn("w-28 shrink-0 text-xs tabular-nums", chipSecondary)}>{occurrence.event.allDay ? "All day" : `${timeFormat.format(occurrence.start)} – ${timeFormat.format(occurrence.end)}`}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{occurrence.event.title}</span>
                    {occurrence.event.location && <span className={cn("truncate text-xs", chipSecondary)}>{occurrence.event.location}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    );
  };

  return (
    <section aria-label={label} data-slot="event-calendar" className={cn("flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-background text-sm text-foreground", className)} {...props}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <button type="button" onClick={() => navigate(0)} className={cn(button, buttonVariants.outline, "h-7", focusRing)}>
          Today
        </button>
        <button type="button" aria-label="Previous" onClick={() => navigate(-1)} className={cn(iconButton, "size-7", focusRing)}>
          <ChevronLeftIcon aria-hidden="true" />
        </button>
        <button type="button" aria-label="Next" onClick={() => navigate(1)} className={cn(iconButton, "size-7", focusRing)}>
          <ChevronRightIcon aria-hidden="true" />
        </button>
        <h2 aria-live="polite" className="min-w-0 flex-1 truncate font-medium">
          {heading}
        </h2>
        <div role="group" aria-label="View" className="flex gap-0.5 rounded-lg bg-muted p-0.5">
          {VIEWS.map((item) => (
            <button key={item.id} type="button" aria-pressed={view === item.id} onClick={() => setView(item.id)} className={cn("h-7 rounded-md px-2.5 text-xs aria-pressed:bg-background aria-pressed:shadow-sm", focusRing)}>
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1">{view === "month" ? renderMonth() : view === "agenda" ? renderAgenda() : renderTimeGrid()}</div>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}
