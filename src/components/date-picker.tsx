// packages/ai-ui/src/components/date-picker.tsx
"use client";

import { Popover } from "@base-ui/react/popover";
import { CalendarIcon, XIcon } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { button, buttonVariants, focusRing, iconButton, popupSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { addDays, addMonths, startOfDay, type Weekday } from "../lib/dates.js";
import { usePortalContainer } from "../lib/portal.js";
import { CalendarMonth, type DateRangeValue } from "./calendar-month.js";

const triggerClass = cn(
  "inline-flex h-9 min-w-48 items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-sm hover:bg-accent/40 data-[popup-open]:ring-2 data-[popup-open]:ring-ring",
  focusRing,
);

export interface DatePickerProps {
  value?: Date | null;
  defaultValue?: Date | null;
  onValueChange?: (value: Date | null) => void;
  label: string;
  placeholder?: string;
  min?: Date;
  max?: Date;
  isDateDisabled?: (date: Date) => boolean;
  weekStartsOn?: Weekday;
  locale?: string;
  /** Shows a clear button when a date is set. */
  clearable?: boolean;
  disabled?: boolean;
  className?: string;
  formatOptions?: Intl.DateTimeFormatOptions;
}

/** Button that opens a month grid in a popover; keyboard focus moves into the grid on open and returns on close. */
export function DatePicker({ value, defaultValue = null, onValueChange, label, placeholder = "Pick a date", min, max, isDateDisabled, weekStartsOn, locale, clearable = true, disabled, className, formatOptions = { dateStyle: "medium" } }: DatePickerProps) {
  const [date, setDate] = useControllableState<Date | null>({ value, defaultValue, onChange: onValueChange });
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState<Date>(() => date ?? startOfDay(new Date()));
  const [month, setMonth] = useState<Date>(() => date ?? new Date());
  const container = usePortalContainer();
  const id = useId();
  const formatted = date ? new Intl.DateTimeFormat(locale, formatOptions).format(date) : null;

  return (
    <div className={cn("inline-flex flex-col gap-1", className)}>
      <span id={`${id}-label`} className="text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-1">
        <Popover.Root
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (next) {
              const start = date ?? startOfDay(new Date());
              setFocused(start);
              setMonth(start);
            }
          }}
        >
          <Popover.Trigger disabled={disabled} aria-labelledby={`${id}-label ${id}-value`} className={triggerClass}>
            <CalendarIcon aria-hidden="true" className="size-4 text-muted-foreground" />
            <span id={`${id}-value`} className={cn("flex-1", !formatted && "text-muted-foreground")}>
              {formatted ?? placeholder}
            </span>
          </Popover.Trigger>
          <Popover.Portal container={container}>
            <Popover.Positioner sideOffset={6} align="start" className="z-50">
              <Popover.Popup aria-label={label} className={cn(popupSurface, "w-72 p-3 outline-none")}>
                <CalendarMonth
                  month={month}
                  onMonthChange={setMonth}
                  focusedDate={focused}
                  onFocusedDateChange={setFocused}
                  selected={date}
                  onSelect={(next) => {
                    setDate(next);
                    setOpen(false);
                  }}
                  autoFocus
                  {...(min ? { min } : {})}
                  {...(max ? { max } : {})}
                  {...(isDateDisabled ? { isDateDisabled } : {})}
                  {...(weekStartsOn !== undefined ? { weekStartsOn } : {})}
                  {...(locale ? { locale } : {})}
                />
                <div className="mt-2 flex justify-between border-t border-border pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const today = startOfDay(new Date());
                      setFocused(today);
                      setMonth(today);
                    }}
                    className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs", focusRing)}
                  >
                    Today
                  </button>
                  <Popover.Close className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs", focusRing)}>Close</Popover.Close>
                </div>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
        {clearable && date && !disabled && (
          <button type="button" aria-label={`Clear ${label}`} onClick={() => setDate(null)} className={cn(iconButton, "size-8", focusRing)}>
            <XIcon aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

export interface DateRangePreset {
  id: string;
  label: string;
  range: () => DateRangeValue;
}

/** Common ranges relative to today. */
export function defaultDatePresets(now: Date = new Date()): DateRangePreset[] {
  const today = startOfDay(now);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  return [
    { id: "today", label: "Today", range: () => ({ start: today, end: today }) },
    { id: "yesterday", label: "Yesterday", range: () => ({ start: addDays(today, -1), end: addDays(today, -1) }) },
    { id: "7d", label: "Last 7 days", range: () => ({ start: addDays(today, -6), end: today }) },
    { id: "30d", label: "Last 30 days", range: () => ({ start: addDays(today, -29), end: today }) },
    { id: "month", label: "This month", range: () => ({ start: monthStart, end: today }) },
    { id: "last-month", label: "Last month", range: () => ({ start: addMonths(monthStart, -1), end: addDays(monthStart, -1) }) },
    { id: "year", label: "This year", range: () => ({ start: new Date(today.getFullYear(), 0, 1), end: today }) },
  ];
}

export interface DateRangePickerProps {
  value?: DateRangeValue | null;
  defaultValue?: DateRangeValue | null;
  onValueChange?: (value: DateRangeValue | null) => void;
  label: string;
  placeholder?: string;
  presets?: DateRangePreset[] | false;
  min?: Date;
  max?: Date;
  isDateDisabled?: (date: Date) => boolean;
  weekStartsOn?: Weekday;
  locale?: string;
  /** Months shown side by side; 1 on narrow layouts. */
  months?: 1 | 2;
  className?: string;
  /** Extra content after the presets, such as a comparison toggle. */
  footer?: ReactNode;
}

/**
 * Range picker with presets and one or two months: the first click sets the
 * start, hovering previews the range, the second click sets the end (the
 * two swap if needed). The active preset is recognized from the dates.
 */
export function DateRangePicker({ value, defaultValue = null, onValueChange, label, placeholder = "Pick a date range", presets, min, max, isDateDisabled, weekStartsOn, locale, months = 2, className, footer }: DateRangePickerProps) {
  const [range, setRange] = useControllableState<DateRangeValue | null>({ value, defaultValue, onChange: onValueChange });
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Date | null>(null);
  const [hover, setHover] = useState<Date | null>(null);
  const [focused, setFocused] = useState<Date>(() => range?.start ?? startOfDay(new Date()));
  const [month, setMonth] = useState<Date>(() => range?.start ?? new Date());
  const container = usePortalContainer();
  const id = useId();
  const presetList = presets === false ? [] : (presets ?? defaultDatePresets());
  const format = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" });
  const formatted = range ? (range.start.getTime() === range.end.getTime() ? format.format(range.start) : format.formatRange(range.start, range.end)) : null;
  const activePreset = range ? presetList.find((preset) => {
    const candidate = preset.range();
    return candidate.start.getTime() === range.start.getTime() && candidate.end.getTime() === range.end.getTime();
  }) : undefined;
  const preview = anchor ? { start: anchor, end: hover ?? anchor } : range;

  const choose = (date: Date) => {
    if (!anchor) {
      setAnchor(date);
      setHover(date);
      return;
    }
    const [start, end] = date < anchor ? [date, anchor] : [anchor, date];
    setRange({ start, end });
    setAnchor(null);
    setHover(null);
    setOpen(false);
  };

  const shared = {
    focusedDate: focused,
    onFocusedDateChange: (date: Date) => {
      setFocused(date);
      if (anchor) setHover(date);
    },
    range: preview,
    onSelect: choose,
    onHoverDate: (date: Date | null) => anchor && setHover(date),
    ...(min ? { min } : {}),
    ...(max ? { max } : {}),
    ...(isDateDisabled ? { isDateDisabled } : {}),
    ...(weekStartsOn !== undefined ? { weekStartsOn } : {}),
    ...(locale ? { locale } : {}),
  };

  return (
    <div className={cn("inline-flex flex-col gap-1", className)}>
      <span id={`${id}-label`} className="text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          setAnchor(null);
          setHover(null);
          if (next) {
            const start = range?.start ?? startOfDay(new Date());
            setFocused(start);
            setMonth(start);
          }
        }}
      >
        <Popover.Trigger aria-labelledby={`${id}-label ${id}-value`} className={triggerClass}>
          <CalendarIcon aria-hidden="true" className="size-4 text-muted-foreground" />
          <span id={`${id}-value`} className={cn("flex-1", !formatted && "text-muted-foreground")}>
            {activePreset ? `${activePreset.label} · ` : ""}
            {formatted ?? placeholder}
          </span>
        </Popover.Trigger>
        <Popover.Portal container={container}>
          <Popover.Positioner sideOffset={6} align="start" className="z-50">
            <Popover.Popup aria-label={label} className={cn(popupSurface, "flex max-w-[calc(100vw-2rem)] flex-col gap-3 p-3 outline-none sm:flex-row")}>
              {presetList.length > 0 && (
                <ul aria-label="Presets" className="flex shrink-0 flex-row flex-wrap gap-1 sm:w-36 sm:flex-col">
                  {presetList.map((preset) => (
                    <li key={preset.id}>
                      <button
                        type="button"
                        aria-pressed={activePreset?.id === preset.id}
                        onClick={() => {
                          setRange(preset.range());
                          setOpen(false);
                        }}
                        className={cn("w-full rounded-md px-2 py-1 text-left text-sm hover:bg-accent aria-pressed:bg-accent aria-pressed:font-medium", focusRing)}
                      >
                        {preset.label}
                      </button>
                    </li>
                  ))}
                  {footer}
                </ul>
              )}
              <div className="flex flex-col gap-2">
                <p aria-live="polite" className="text-xs text-muted-foreground">
                  {anchor ? "Select the end date" : "Select the start date"}
                </p>
                <div className="flex gap-4">
                  <CalendarMonth {...shared} month={month} onMonthChange={setMonth} hideNext={months === 2} autoFocus className="w-64" />
                  {months === 2 && (
                    <CalendarMonth
                      {...shared}
                      month={addMonths(month, 1)}
                      onMonthChange={(next) => setMonth(addMonths(next, -1))}
                      hidePrevious
                      className="hidden w-64 md:flex"
                    />
                  )}
                </div>
                {range && (
                  <button
                    type="button"
                    onClick={() => {
                      setRange(null);
                      setOpen(false);
                    }}
                    className={cn(button, buttonVariants.ghost, "h-7 self-start px-2 text-xs", focusRing)}
                  >
                    Clear
                  </button>
                )}
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
