// packages/ai-ui/src/components/calendar-month.tsx
"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { type ComponentProps, type KeyboardEvent, useEffect, useRef } from "react";

import { focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { addDays, addMonths, isSameDay, isSameMonth, monthGrid, startOfDay, startOfWeek, type Weekday, weekdayNames } from "../lib/dates.js";

export interface DateRangeValue {
  start: Date;
  end: Date;
}

export interface CalendarMonthProps extends Omit<ComponentProps<"div">, "onSelect"> {
  /** Any day in the month shown. */
  month: Date;
  onMonthChange?: (month: Date) => void;
  /** Day that holds keyboard focus. */
  focusedDate: Date;
  onFocusedDateChange: (date: Date) => void;
  selected?: Date | null;
  /** Selected or previewed range, drawn as a band. */
  range?: DateRangeValue | null;
  onSelect: (date: Date) => void;
  onHoverDate?: (date: Date | null) => void;
  min?: Date;
  max?: Date;
  isDateDisabled?: (date: Date) => boolean;
  weekStartsOn?: Weekday;
  locale?: string;
  /** Hides the previous or next button when months sit side by side. */
  hidePrevious?: boolean;
  hideNext?: boolean;
  /** Moves DOM focus to `focusedDate` when it changes. */
  autoFocus?: boolean;
}

/**
 * One month as an ARIA grid: arrows move by day and week, Home and End to
 * the week's ends, Page Up/Down by month (Shift for a year), Enter or Space
 * selects. Disabled and out-of-range days are skipped for selection.
 */
export function CalendarMonth({
  month,
  onMonthChange,
  focusedDate,
  onFocusedDateChange,
  selected,
  range,
  onSelect,
  onHoverDate,
  min,
  max,
  isDateDisabled,
  weekStartsOn = 0,
  locale,
  hidePrevious = false,
  hideNext = false,
  autoFocus = false,
  className,
  ...props
}: CalendarMonthProps) {
  const gridRef = useRef<HTMLTableElement>(null);
  const days = monthGrid(month.getFullYear(), month.getMonth(), weekStartsOn);
  const names = weekdayNames(locale, weekStartsOn, "short");
  const longNames = weekdayNames(locale, weekStartsOn, "long");
  const title = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(month);
  const labelFor = new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const today = startOfDay(new Date());
  const disabled = (date: Date) => (min !== undefined && date < startOfDay(min)) || (max !== undefined && date > startOfDay(max)) || Boolean(isDateDisabled?.(date));
  const rangeStart = range ? startOfDay(range.start < range.end ? range.start : range.end) : null;
  const rangeEnd = range ? startOfDay(range.start < range.end ? range.end : range.start) : null;

  useEffect(() => {
    if (!autoFocus) return;
    gridRef.current?.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus({ preventScroll: true });
  }, [autoFocus, focusedDate]);

  const moveFocus = (next: Date) => {
    onFocusedDateChange(next);
    if (!isSameMonth(next, month)) onMonthChange?.(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => addDays(focusedDate, -1),
      ArrowRight: () => addDays(focusedDate, 1),
      ArrowUp: () => addDays(focusedDate, -7),
      ArrowDown: () => addDays(focusedDate, 7),
      Home: () => startOfWeek(focusedDate, weekStartsOn),
      End: () => addDays(startOfWeek(focusedDate, weekStartsOn), 6),
      PageUp: () => addMonths(focusedDate, event.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focusedDate, event.shiftKey ? 12 : 1),
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      moveFocus(move());
    } else if ((event.key === "Enter" || event.key === " ") && !disabled(focusedDate)) {
      event.preventDefault();
      onSelect(startOfDay(focusedDate));
    }
  };

  return (
    <div data-slot="calendar-month" className={cn("flex flex-col gap-2 text-sm", className)} {...props}>
      <div className="flex items-center gap-1">
        {!hidePrevious ? (
          <button type="button" aria-label="Previous month" onClick={() => moveFocus(addMonths(focusedDate, -1))} className={cn(iconButton, "size-7", focusRing)}>
            <ChevronLeftIcon aria-hidden="true" />
          </button>
        ) : (
          <span className="size-7" />
        )}
        <h3 aria-live="polite" className="flex-1 text-center font-medium">
          {title}
        </h3>
        {!hideNext ? (
          <button type="button" aria-label="Next month" onClick={() => moveFocus(addMonths(focusedDate, 1))} className={cn(iconButton, "size-7", focusRing)}>
            <ChevronRightIcon aria-hidden="true" />
          </button>
        ) : (
          <span className="size-7" />
        )}
      </div>
      <table ref={gridRef} role="grid" aria-label={title} onKeyDown={onKeyDown} onMouseLeave={() => onHoverDate?.(null)} className="w-full border-collapse">
        <thead>
          <tr>
            {names.map((name, index) => (
              <th key={name} scope="col" abbr={longNames[index]} className="h-8 text-xs font-normal text-muted-foreground">
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }, (_, week) => (
            <tr key={week}>
              {days.slice(week * 7, week * 7 + 7).map((day) => {
                const outside = !isSameMonth(day, month);
                const isSelected = Boolean(selected && isSameDay(day, selected));
                const inRange = rangeStart && rangeEnd ? day >= rangeStart && day <= rangeEnd : false;
                const isEdge = Boolean((rangeStart && isSameDay(day, rangeStart)) || (rangeEnd && isSameDay(day, rangeEnd)));
                const off = disabled(day);
                const focused = isSameDay(day, focusedDate);
                return (
                  <td key={day.toISOString()} role="gridcell" aria-selected={isSelected || isEdge || undefined} className={cn("p-0 text-center", inRange && !isEdge && "bg-accent", isEdge && rangeStart && rangeEnd && !isSameDay(rangeStart, rangeEnd) && (isSameDay(day, rangeStart) ? "rounded-l-md bg-accent" : "rounded-r-md bg-accent"))}>
                    <button
                      type="button"
                      tabIndex={focused ? 0 : -1}
                      aria-label={labelFor.format(day)}
                      aria-current={isSameDay(day, today) ? "date" : undefined}
                      aria-disabled={off || undefined}
                      onClick={() => {
                        onFocusedDateChange(day);
                        if (!off) onSelect(startOfDay(day));
                      }}
                      onMouseEnter={() => !off && onHoverDate?.(day)}
                      className={cn(
                        "inline-flex size-9 items-center justify-center rounded-md text-sm tabular-nums hover:bg-accent aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-transparent",
                        outside && "text-muted-foreground",
                        isSameDay(day, today) && "font-semibold underline underline-offset-4",
                        (isSelected || isEdge) && "bg-primary text-primary-foreground hover:bg-primary",
                        focusRing,
                      )}
                    >
                      {day.getDate()}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
