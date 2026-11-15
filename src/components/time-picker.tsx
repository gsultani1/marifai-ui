// packages/ai-ui/src/components/time-picker.tsx
"use client";

import { Input } from "@base-ui/react/input";
import { ClockIcon } from "lucide-react";
import { type ChangeEvent, type FocusEvent, type KeyboardEvent, type ReactNode, useId, useRef, useState } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { cn } from "../lib/cn.js";

/** A time of day in 24-hour parts. */
export interface TimeParts {
  /** 0 to 23. */
  hours: number;
  /** 0 to 59. */
  minutes: number;
}

const TIME_PATTERN = /^(\d{1,2})(?::(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?)?\s*(?:([ap])\.?\s*m?\.?)?$/i;
const DAY_MINUTES = 24 * 60;

/**
 * Parses a typed or stored time into 24-hour parts: "14:30", "14:30:15",
 * "2:30 PM", "2:30pm", "2 p.m." and "12 AM" (midnight) all work. Seconds are
 * dropped. Returns null for anything else, including "24:00", "13 PM" and a
 * bare hour without AM or PM.
 */
export function parseTime(input: string): TimeParts | null {
  const match = TIME_PATTERN.exec(input.trim());
  if (!match) return null;
  const [, hourText = "", minuteText, secondText, meridiem] = match;
  if (minuteText === undefined && meridiem === undefined) return null;
  const hour = Number(hourText);
  const minutes = minuteText === undefined ? 0 : Number(minuteText);
  if (minutes > 59 || (secondText !== undefined && Number(secondText) > 59)) return null;
  if (meridiem !== undefined) {
    if (hour < 1 || hour > 12) return null;
    return { hours: (hour % 12) + (meridiem.toLowerCase() === "p" ? 12 : 0), minutes };
  }
  return hour > 23 ? null : { hours: hour, minutes };
}

export interface FormatTimeOptions {
  /** 24 (default) gives the "HH:mm" value format; 12 gives "2:05 PM". */
  hourCycle?: 12 | 24;
  /** Words for before and after noon in 12-hour output. */
  meridiem?: readonly [am: string, pm: string];
}

function isTimeParts(parts: TimeParts): boolean {
  return Number.isInteger(parts.hours) && Number.isInteger(parts.minutes) && parts.hours >= 0 && parts.hours <= 23 && parts.minutes >= 0 && parts.minutes <= 59;
}

const pad = (number: number) => String(number).padStart(2, "0");

/**
 * Formats parts or a parseable string as "HH:mm" (24-hour) or "h:mm AM"
 * (12-hour). Returns "" for null, unparseable text or out-of-range parts.
 */
export function formatTime(time: TimeParts | string | null | undefined, { hourCycle = 24, meridiem = ["AM", "PM"] }: FormatTimeOptions = {}): string {
  const parts = typeof time === "string" ? parseTime(time) : (time ?? null);
  if (!parts || !isTimeParts(parts)) return "";
  if (hourCycle === 24) return `${pad(parts.hours)}:${pad(parts.minutes)}`;
  return `${parts.hours % 12 || 12}:${pad(parts.minutes)} ${parts.hours < 12 ? meridiem[0] : meridiem[1]}`;
}

type SegmentName = "hour" | "minute" | "period";

interface Segments {
  /** Hour as shown: 1 to 12, or 0 to 23. */
  hour: number | null;
  minute: number | null;
  /** 0 for AM, 1 for PM; unused in 24-hour mode. */
  period: 0 | 1 | null;
}

const EMPTY: Segments = { hour: null, minute: null, period: null };

function toSegments(time: string | null, hourCycle: 12 | 24): Segments {
  const parts = time ? parseTime(time) : null;
  if (!parts) return EMPTY;
  if (hourCycle === 24) return { hour: parts.hours, minute: parts.minutes, period: null };
  return { hour: parts.hours % 12 || 12, minute: parts.minutes, period: parts.hours < 12 ? 0 : 1 };
}

function fromSegments({ hour, minute, period }: Segments, hourCycle: 12 | 24): TimeParts | null {
  if (hour === null || minute === null) return null;
  if (hourCycle === 24) return { hours: hour, minutes: minute };
  if (period === null) return null;
  return { hours: (hour % 12) + (period === 1 ? 12 : 0), minutes: minute };
}

const toMinutes = (parts: TimeParts) => parts.hours * 60 + parts.minutes;
const fromMinutes = (total: number): TimeParts => {
  const wrapped = ((total % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return { hours: Math.floor(wrapped / 60), minutes: wrapped % 60 };
};
const distance = (a: number, b: number) => Math.min(Math.abs(a - b), DAY_MINUTES - Math.abs(a - b));

/** Whether `total` falls within min and max; a min later than max is an overnight range such as 22:00 to 02:00. */
function inRange(total: number, min: number | null, max: number | null): boolean {
  if (min !== null && max !== null && min > max) return total >= min || total <= max;
  return (min === null || total >= min) && (max === null || total <= max);
}

function clampToRange(total: number, min: number | null, max: number | null): number {
  if (inRange(total, min, max)) return total;
  if (min === null) return max ?? total;
  if (max === null) return min;
  return distance(total, max) < distance(total, min) ? max : min;
}

export interface TimePickerProps {
  /** "HH:mm" in 24-hour time, or null when empty. */
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
  /** 12 shows hour, minute and AM/PM segments; 24 shows hour and minute. */
  hourCycle?: 12 | 24;
  /** Minutes the arrow keys move by; typed minutes snap to it when focus leaves. */
  minuteStep?: number;
  /** Earliest time, "HH:mm"; arrows stop here and earlier entries move to it when focus leaves. */
  min?: string;
  /** Latest time, "HH:mm". A max earlier than min allows an overnight range. */
  max?: string;
  /** Visible label; inside a FormField the field label names the picker instead. */
  label?: ReactNode;
  /** Accessible names of the segments, for translation. */
  segmentLabels?: Partial<Record<SegmentName, string>>;
  /** Words for AM and PM. */
  meridiem?: readonly [am: string, pm: string];
  name?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  className?: string;
}

const DEFAULT_SEGMENT_LABELS: Record<SegmentName, string> = { hour: "Hours", minute: "Minutes", period: "AM/PM" };

/**
 * Time-of-day field with spin-button segments like a native time input: type
 * digits (focus moves on once a segment is complete), Up and Down step the
 * focused segment, Home and End jump to its ends, A or P sets the period,
 * Backspace clears a segment, and Left, Right or ":" move between segments.
 * The value is "HH:mm". Inside a FormField the field label, description,
 * error and `required` validation apply through a hidden Base UI input.
 */
export function TimePicker({
  value,
  defaultValue = null,
  onValueChange,
  hourCycle = 12,
  minuteStep = 1,
  min,
  max,
  label,
  segmentLabels,
  meridiem = ["AM", "PM"],
  name,
  id,
  required,
  disabled = false,
  readOnly = false,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  className,
}: TimePickerProps) {
  const [time, setTime] = useControllableState<string | null>({ value, defaultValue, onChange: onValueChange });
  const canonical = time ? formatTime(time) || null : null;
  const [segments, setSegments] = useState<Segments>(() => toSegments(canonical, hourCycle));
  const [synced, setSynced] = useState({ canonical, hourCycle });
  const [typed, setTyped] = useState<{ segment: SegmentName; text: string } | null>(null);
  const generatedId = useId();
  const labelId = `${generatedId}-label`;
  const hourRef = useRef<HTMLInputElement>(null);
  const minuteRef = useRef<HTMLInputElement>(null);
  const periodRef = useRef<HTMLInputElement>(null);
  const refs = { hour: hourRef, minute: minuteRef, period: periodRef };
  const order: SegmentName[] = hourCycle === 12 ? ["hour", "minute", "period"] : ["hour", "minute"];
  const names = { ...DEFAULT_SEGMENT_LABELS, ...segmentLabels };
  const step = Math.max(1, Math.min(60, Math.floor(minuteStep)));
  const minParts = min ? parseTime(min) : null;
  const maxParts = max ? parseTime(max) : null;
  const minTotal = minParts ? toMinutes(minParts) : null;
  const maxTotal = maxParts ? toMinutes(maxParts) : null;

  if (synced.canonical !== canonical || synced.hourCycle !== hourCycle) {
    setSynced({ canonical, hourCycle });
    const shown = fromSegments(segments, synced.hourCycle);
    if (synced.hourCycle !== hourCycle || (shown ? formatTime(shown) : null) !== canonical) setSegments(toSegments(canonical, hourCycle));
  }

  const commit = (next: Segments) => {
    setSegments(next);
    const parts = fromSegments(next, hourCycle);
    const nextValue = parts ? formatTime(parts) : null;
    if (nextValue !== canonical) setTime(nextValue);
  };

  const commitClamped = (next: Segments) => {
    const parts = fromSegments(next, hourCycle);
    if (!parts) return commit(next);
    const total = clampToRange(toMinutes(parts), minTotal, maxTotal);
    commit(total === toMinutes(parts) ? next : toSegments(formatTime(fromMinutes(total)), hourCycle));
  };

  const focusSibling = (name: SegmentName, offset: 1 | -1) => {
    const target = order[order.indexOf(name) + offset];
    if (target) refs[target].current?.focus();
  };

  const lastMinute = Math.floor(59 / step) * step;
  const stepped = (name: SegmentName, direction: 1 | -1): Segments => {
    if (name === "period") return { ...segments, period: segments.period === null ? (direction > 0 ? 0 : 1) : segments.period === 0 ? 1 : 0 };
    if (name === "hour") {
      const { hour } = segments;
      if (hourCycle === 12) return { ...segments, hour: hour === null ? (direction > 0 ? 1 : 12) : ((hour - 1 + direction + 12) % 12) + 1 };
      return { ...segments, hour: hour === null ? (direction > 0 ? 0 : 23) : (hour + direction + 24) % 24 };
    }
    const { minute } = segments;
    if (minute === null) return { ...segments, minute: direction > 0 ? 0 : lastMinute };
    if (direction > 0) {
      const next = Math.floor(minute / step) * step + step;
      return { ...segments, minute: next > 59 ? 0 : next };
    }
    const next = minute % step === 0 ? minute - step : Math.floor(minute / step) * step;
    return { ...segments, minute: next < 0 ? lastMinute : next };
  };

  const edge = (name: SegmentName, end: boolean): Segments => {
    if (name === "period") return { ...segments, period: end ? 1 : 0 };
    if (name === "minute") return { ...segments, minute: end ? lastMinute : 0 };
    return { ...segments, hour: hourCycle === 12 ? (end ? 12 : 1) : end ? 23 : 0 };
  };

  const typeDigit = (name: "hour" | "minute", digit: number) => {
    const limit = name === "minute" ? 59 : hourCycle === 12 ? 12 : 23;
    const floor = name === "hour" && hourCycle === 12 ? 1 : 0;
    let text = `${typed?.segment === name ? typed.text : ""}${digit}`;
    if (Number(text) > limit) text = String(digit);
    const number = Number(text);
    if (number < floor) {
      setTyped(text.length >= 2 ? null : { segment: name, text });
      return;
    }
    commit({ ...segments, [name]: number });
    if (text.length >= 2 || number * 10 > limit) {
      setTyped(null);
      focusSibling(name, 1);
    } else {
      setTyped({ segment: name, text });
    }
  };

  const setPeriod = (key: string) => {
    const lower = key.toLowerCase();
    const am = meridiem[0].toLowerCase();
    const pm = meridiem[1].toLowerCase();
    if (lower === am[0] && lower !== pm[0]) commit({ ...segments, period: 0 });
    else if (lower === pm[0]) commit({ ...segments, period: 1 });
  };

  const onKeyDown = (name: SegmentName, event: KeyboardEvent<HTMLInputElement>, locked: boolean) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const { key } = event;
    if (key === "ArrowLeft" || key === "ArrowRight") {
      event.preventDefault();
      setTyped(null);
      focusSibling(name, key === "ArrowRight" ? 1 : -1);
      return;
    }
    if (locked) return;
    if (key === "ArrowUp" || key === "ArrowDown") {
      event.preventDefault();
      setTyped(null);
      commitClamped(stepped(name, key === "ArrowUp" ? 1 : -1));
    } else if (key === "Home" || key === "End") {
      event.preventDefault();
      setTyped(null);
      commitClamped(edge(name, key === "End"));
    } else if (key === "Backspace" || key === "Delete") {
      event.preventDefault();
      setTyped(null);
      commit({ ...segments, [name]: null });
    } else if (/^\d$/.test(key) && name !== "period") {
      event.preventDefault();
      typeDigit(name, Number(key));
    } else if (name === "period" && key.length === 1) {
      event.preventDefault();
      setPeriod(key);
    } else if ((key === ":" || key === "." || key === " ") && name !== "period") {
      event.preventDefault();
      setTyped(null);
      focusSibling(name, 1);
    }
  };

  /** Soft keyboards often send no usable key code, so read the inserted character instead. */
  const onChange = (name: SegmentName, event: ChangeEvent<HTMLInputElement>, locked: boolean) => {
    if (locked) return;
    const character = event.currentTarget.value.slice(-1);
    if (!event.currentTarget.value) commit({ ...segments, [name]: null });
    else if (name === "period") setPeriod(character);
    else if (/^\d$/.test(character)) typeDigit(name, Number(character));
  };

  const onGroupBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    setTyped(null);
    const parts = fromSegments(segments, hourCycle);
    if (!parts || readOnly) return;
    const original = toMinutes(parts);
    const snapped = step > 1 ? Math.round(original / step) * step : original;
    const total = clampToRange(snapped % DAY_MINUTES, minTotal, maxTotal);
    if (total !== original) commit(toSegments(formatTime(fromMinutes(total)), hourCycle));
  };

  const current = fromSegments(segments, hourCycle);
  const outOfRange = current !== null && !inRange(toMinutes(current), minTotal, maxTotal);

  return (
    <Input
      id={id}
      name={name}
      value={canonical ?? ""}
      required={required}
      disabled={disabled}
      render={(inputProps, state) => {
        const locked = readOnly;
        const inactive = disabled || state.disabled;
        const invalid = outOfRange || state.valid === false;
        const groupLabels = [inputProps["aria-labelledby"], ariaLabelledBy, label ? labelId : undefined].filter(Boolean).join(" ") || undefined;
        const describedBy = [inputProps["aria-describedby"], ariaDescribedBy].filter(Boolean).join(" ") || undefined;

        const segment = (segmentName: SegmentName) => {
          const segmentValue = segments[segmentName];
          const typing = typed?.segment === segmentName ? typed.text : null;
          const display =
            typing !== null ? typing.padStart(2, "0") : segmentValue === null ? "--" : segmentName === "period" ? meridiem[segmentValue] : pad(segmentValue);
          const segmentId = `${generatedId}-${segmentName}`;
          const bounds = segmentName === "period" ? [0, 1] : segmentName === "minute" ? [0, 59] : hourCycle === 12 ? [1, 12] : [0, 23];
          return (
            <input
              key={segmentName}
              ref={refs[segmentName]}
              id={segmentId}
              type="text"
              role="spinbutton"
              inputMode={segmentName === "period" ? "text" : "numeric"}
              autoComplete="off"
              spellCheck={false}
              value={display}
              disabled={inactive}
              readOnly={locked}
              aria-label={groupLabels ? names[segmentName] : [ariaLabel, names[segmentName]].filter(Boolean).join(" ")}
              aria-labelledby={groupLabels ? `${groupLabels} ${segmentId}` : undefined}
              aria-valuemin={bounds[0]}
              aria-valuemax={bounds[1]}
              aria-valuenow={segmentValue ?? undefined}
              aria-valuetext={segmentValue === null ? "Empty" : segmentName === "period" ? meridiem[segmentValue] : String(segmentValue)}
              aria-invalid={invalid || undefined}
              aria-required={required || undefined}
              data-placeholder={segmentValue === null && typing === null ? "" : undefined}
              onKeyDown={(event) => onKeyDown(segmentName, event, locked)}
              onChange={(event) => onChange(segmentName, event, locked)}
              onFocus={(event) => event.currentTarget.select()}
              onBlur={() => typed?.segment === segmentName && setTyped(null)}
              className={cn(
                "rounded-sm bg-transparent text-center text-foreground tabular-nums caret-transparent outline-none selection:bg-transparent focus:bg-accent focus:text-accent-foreground disabled:cursor-not-allowed data-[placeholder]:text-muted-foreground focus:data-[placeholder]:text-accent-foreground",
                segmentName === "period" ? "w-9" : "w-7",
              )}
            />
          );
        };

        return (
          <div data-slot="time-picker" className={cn("inline-flex flex-col gap-1.5", className)}>
            {label && (
              <label id={labelId} htmlFor={inputProps.id} className="text-sm font-medium text-foreground">
                {label}
              </label>
            )}
            <div
              role="group"
              aria-labelledby={groupLabels}
              aria-label={groupLabels ? undefined : ariaLabel}
              aria-describedby={describedBy}
              data-invalid={invalid || undefined}
              data-disabled={inactive || undefined}
              onBlur={onGroupBlur}
              className="inline-flex h-9 w-fit items-center gap-0.5 rounded-md border border-input bg-background px-2 text-sm focus-within:ring-2 focus-within:ring-ring data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[invalid]:border-destructive"
            >
              <ClockIcon aria-hidden="true" className="mr-1 size-4 shrink-0 text-muted-foreground" />
              {segment("hour")}
              <span aria-hidden="true" className="text-muted-foreground">
                :
              </span>
              {segment("minute")}
              {hourCycle === 12 && segment("period")}
              <input
                {...inputProps}
                type="text"
                tabIndex={-1}
                aria-hidden="true"
                className="sr-only"
                onFocus={() => refs[order[0] ?? "hour"].current?.focus()}
                onBlur={undefined}
              />
            </div>
          </div>
        );
      }}
    />
  );
}
