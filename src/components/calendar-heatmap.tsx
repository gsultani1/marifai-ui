// packages/ai-ui/src/components/calendar-heatmap.tsx
"use client";

import { Tooltip } from "@base-ui/react/tooltip";
import { type ComponentProps, type KeyboardEvent, useMemo, useRef, useState } from "react";

import { tooltipPopup } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { addDays, differenceInDays, parseIsoDate, startOfDay, startOfWeek, toIsoDate, type Weekday, weekdayNames } from "../lib/dates.js";
import { usePortalContainer } from "../lib/portal.js";

export interface HeatmapValue {
  /** A Date or a "YYYY-MM-DD" local date. */
  date: Date | string;
  value: number;
}

export interface HeatmapDay {
  date: Date;
  /** Local "YYYY-MM-DD". */
  key: string;
  value: number;
  /** 0 for no activity, then 1 to 4 by share of the busiest day. */
  level: 0 | 1 | 2 | 3 | 4;
  /** Row, counted from `weekStartsOn`. */
  row: number;
  week: number;
}

export interface HeatmapMonthLabel {
  week: number;
  month: number;
  year: number;
}

export interface HeatmapMatrix {
  /** `weeks[w][row]`, null for padding days outside the range. */
  weeks: Array<Array<HeatmapDay | null>>;
  months: HeatmapMonthLabel[];
  max: number;
  /** In-range days in order. */
  days: HeatmapDay[];
}

function toLocalDay(value: Date | string): Date {
  if (typeof value === "string") {
    const parsed = parseIsoDate(value);
    if (parsed) return parsed;
  }
  return startOfDay(value);
}

/** Activity level from 0 (none) to 4 for a value relative to the busiest day. */
export function heatmapLevel(value: number, max: number): HeatmapDay["level"] {
  if (!(value > 0) || !(max > 0)) return 0;
  return Math.min(4, Math.max(1, Math.ceil((value / max) * 4))) as HeatmapDay["level"];
}

/**
 * Week-by-day matrix for a date range, with weeks as columns starting on
 * `weekStartsOn`. Days are stepped by calendar date, so daylight saving
 * changes and year boundaries neither skip nor repeat a day. Values on the
 * same date are summed; month labels sit on the week holding each 1st.
 */
export function buildHeatmapMatrix(start: Date | string, end: Date | string, values: readonly HeatmapValue[] = [], weekStartsOn: Weekday = 0): HeatmapMatrix {
  let first = toLocalDay(start);
  let last = toLocalDay(end);
  if (last < first) [first, last] = [last, first];
  const totals = new Map<string, number>();
  for (const entry of values) {
    if (!Number.isFinite(entry.value)) continue;
    const key = toIsoDate(toLocalDay(entry.date));
    totals.set(key, (totals.get(key) ?? 0) + entry.value);
  }
  const gridStart = startOfWeek(first, weekStartsOn);
  const lead = differenceInDays(first, gridStart);
  const length = differenceInDays(last, first) + 1;
  const weekCount = Math.ceil((lead + length) / 7);
  let max = 0;
  const raw: Array<Array<Omit<HeatmapDay, "level"> | null>> = [];
  for (let week = 0; week < weekCount; week++) {
    const column: Array<Omit<HeatmapDay, "level"> | null> = [];
    for (let row = 0; row < 7; row++) {
      const offset = week * 7 + row - lead;
      if (offset < 0 || offset >= length) {
        column.push(null);
        continue;
      }
      const date = addDays(first, offset);
      const key = toIsoDate(date);
      const value = totals.get(key) ?? 0;
      if (value > max) max = value;
      column.push({ date, key, value, row, week });
    }
    raw.push(column);
  }
  const weeks = raw.map((column) => column.map((day) => (day ? { ...day, level: heatmapLevel(day.value, max) } : null)));
  const days = weeks.flatMap((column) => column.filter((day): day is HeatmapDay => day !== null));
  const months: HeatmapMonthLabel[] = [];
  for (const day of days) {
    if (day.date.getDate() === 1 || day === days[0]) months.push({ week: day.week, month: day.date.getMonth(), year: day.date.getFullYear() });
  }
  if (months.length > 1 && months[1]!.week - months[0]!.week < 3) months.shift();
  return { weeks, months, max, days };
}

const LEVEL_MIX = [8, 30, 52, 76, 100] as const;

/** Background for a level: chart-1 mixed into the page background. */
export function heatmapColor(level: HeatmapDay["level"]): string {
  return `color-mix(in oklab, var(--chart-1) ${LEVEL_MIX[level]}%, var(--background))`;
}

export interface CalendarHeatmapProps extends Omit<ComponentProps<"div">, "children"> {
  values: readonly HeatmapValue[];
  start: Date | string;
  end: Date | string;
  /** Accessible name of the grid, such as "Daily sales". */
  label: string;
  weekStartsOn?: Weekday;
  locale?: string;
  /** Spoken and tooltip text for a day; defaults to "14 sales on Tuesday, March 4, 2026" using `unit`. */
  formatDay?: (day: HeatmapDay, dateText: string) => string;
  /** Singular and plural unit for the default text. */
  unit?: [singular: string, plural: string];
  /** Cell size in pixels. */
  cellSize?: number;
  /** Shows the "Less to More" legend. */
  legend?: boolean;
}

interface TooltipPayload {
  text: string;
}

const GAP = 3;

/**
 * GitHub-style activity grid for a date range: weeks as columns, weekdays
 * as rows, month labels and a five-step legend from a color-mix of chart-1
 * with the background. It is an ARIA grid with one tab stop: arrow keys
 * move by day and week, Home and End to the ends of a row, Ctrl+Home and
 * Ctrl+End to the first and last day. Each day has a label and a tooltip
 * such as "14 sales on Tuesday, March 4, 2026".
 */
export function CalendarHeatmap({ values, start, end, label, weekStartsOn = 0, locale, formatDay, unit = ["activity", "activities"], cellSize = 12, legend = true, className, ...props }: CalendarHeatmapProps) {
  const container = usePortalContainer();
  const [handle] = useState(() => Tooltip.createHandle<TooltipPayload>());
  const matrix = useMemo(() => buildHeatmapMatrix(start, end, values, weekStartsOn), [start, end, values, weekStartsOn]);
  const [focused, setFocused] = useState<string | null>(null);
  const cells = useRef(new Map<string, HTMLDivElement>());
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric", year: "numeric" }), [locale]);
  const monthFormat = useMemo(() => new Intl.DateTimeFormat(locale, { month: "short" }), [locale]);
  const numberFormat = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const shortDays = weekdayNames(locale, weekStartsOn, "short");
  const longDays = weekdayNames(locale, weekStartsOn, "long");
  const describe = (day: HeatmapDay) => {
    const dateText = dateFormat.format(day.date);
    if (formatDay) return formatDay(day, dateText);
    return `${day.value === 0 ? "No" : numberFormat.format(day.value)} ${day.value === 1 ? unit[0] : unit[1]} on ${dateText}`;
  };
  const activeKey = matrix.days.some((day) => day.key === focused) ? focused : (matrix.days[matrix.days.length - 1]?.key ?? null);
  const weekCount = matrix.weeks.length;
  const step = cellSize + GAP;
  const rowHeaderWidth = 32;

  const focusDay = (day: HeatmapDay | null | undefined) => {
    if (!day) return;
    setFocused(day.key);
    cells.current.get(day.key)?.focus();
  };

  const find = (week: number, row: number, dWeek: number, dRow: number): HeatmapDay | null => {
    let w = week + dWeek;
    let r = row + dRow;
    while (w >= 0 && w < weekCount && r >= 0 && r < 7) {
      const day = matrix.weeks[w]?.[r];
      if (day) return day;
      if (dWeek === 0 && dRow === 0) return null;
      w += dWeek;
      r += dRow;
    }
    return null;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, day: HeatmapDay) => {
    let target: HeatmapDay | null | undefined = null;
    if (event.key === "ArrowRight") target = find(day.week, day.row, 1, 0);
    else if (event.key === "ArrowLeft") target = find(day.week, day.row, -1, 0);
    else if (event.key === "ArrowDown") target = find(day.week, day.row, 0, 1) ?? find(day.week + 1, -1, 0, 1);
    else if (event.key === "ArrowUp") target = find(day.week, day.row, 0, -1) ?? find(day.week - 1, 7, 0, -1);
    else if (event.key === "Home") target = event.ctrlKey || event.metaKey ? matrix.days[0] : find(-1, day.row, 1, 0);
    else if (event.key === "End") target = event.ctrlKey || event.metaKey ? matrix.days[matrix.days.length - 1] : find(weekCount, day.row, -1, 0);
    else if (event.key === "PageDown") target = find(Math.min(weekCount - 1, day.week + 4) + 1, day.row, -1, 0);
    else if (event.key === "PageUp") target = find(Math.max(0, day.week - 4) - 1, day.row, 1, 0);
    else return;
    event.preventDefault();
    focusDay(target);
  };

  return (
    <div data-slot="calendar-heatmap" className={cn("flex max-w-full flex-col gap-2", className)} {...props}>
      <div className="max-w-full overflow-x-auto pb-1">
        <div className="inline-flex flex-col" style={{ gap: GAP }}>
          <div aria-hidden="true" className="relative h-4 text-xs text-muted-foreground" style={{ marginInlineStart: rowHeaderWidth + GAP, width: weekCount * step }}>
            {matrix.months.map((month) => (
              <span key={`${month.year}-${month.month}`} className="absolute top-0 whitespace-nowrap" style={{ insetInlineStart: month.week * step }}>
                {monthFormat.format(new Date(month.year, month.month, 1))}
              </span>
            ))}
          </div>
          <div role="grid" aria-label={label} aria-readonly="true" className="flex flex-col" style={{ gap: GAP }}>
            {Array.from({ length: 7 }, (_, row) => (
              <div key={row} role="row" className="flex items-center" style={{ gap: GAP }}>
                <div role="rowheader" className="shrink-0 text-xs leading-none text-muted-foreground" style={{ width: rowHeaderWidth }}>
                  <span aria-hidden="true">{row % 2 === 1 ? shortDays[row] : ""}</span>
                  <span className="sr-only">{longDays[row]}</span>
                </div>
                {matrix.weeks.map((column, week) => {
                  const day = column[row];
                  if (!day) return <div key={week} role="gridcell" className="shrink-0" style={{ width: cellSize, height: cellSize }} />;
                  const text = describe(day);
                  return (
                    <Tooltip.Trigger
                      key={week}
                      handle={handle}
                      payload={{ text }}
                      delay={150}
                      render={
                        <div
                          ref={(element: HTMLDivElement | null) => {
                            if (element) cells.current.set(day.key, element);
                            else cells.current.delete(day.key);
                          }}
                          role="gridcell"
                          aria-label={text}
                          tabIndex={day.key === activeKey ? 0 : -1}
                          data-level={day.level}
                          data-date={day.key}
                          onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => onKeyDown(event, day)}
                          onFocus={() => {
                            if (focused !== day.key) setFocused(day.key);
                          }}
                          className="shrink-0 rounded-[3px] outline-none ring-inset ring-foreground/10 not-focus-visible:ring-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                          style={{ width: cellSize, height: cellSize, background: heatmapColor(day.level) }}
                        />
                      }
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      {legend && (
        <div className="flex items-center gap-1.5 self-end text-xs text-muted-foreground">
          <span>Less</span>
          <span aria-hidden="true" className="flex" style={{ gap: GAP }}>
            {([0, 1, 2, 3, 4] as const).map((level) => (
              <span key={level} className="rounded-[3px] ring-1 ring-inset ring-foreground/10" style={{ width: cellSize, height: cellSize, background: heatmapColor(level) }} />
            ))}
          </span>
          <span>More</span>
        </div>
      )}
      <Tooltip.Root handle={handle}>
        {({ payload }) => (
          <Tooltip.Portal container={container}>
            <Tooltip.Positioner sideOffset={6} className="z-50">
              <Tooltip.Popup className={tooltipPopup}>{payload?.text}</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        )}
      </Tooltip.Root>
    </div>
  );
}
