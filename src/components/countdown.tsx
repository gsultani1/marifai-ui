// packages/ai-ui/src/components/countdown.tsx
"use client";

import { PauseIcon, PlayIcon, RotateCcwIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { useNow } from "../hooks/use-now.js";
import { button, buttonVariants, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export type DurationUnit = "days" | "hours" | "minutes" | "seconds";

export interface DurationParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
  /** The clamped input in milliseconds. */
  total: number;
}

const UNIT_MS: Record<DurationUnit, number> = { days: 86_400_000, hours: 3_600_000, minutes: 60_000, seconds: 1000 };
const UNITS: DurationUnit[] = ["days", "hours", "minutes", "seconds"];

/**
 * Splits milliseconds into whole days, hours, minutes and seconds plus the
 * leftover milliseconds. Units above `largestUnit` fold into it (36 hours
 * stays 36 hours with "hours"). Negative, NaN and infinite input count as 0.
 */
export function splitDuration(ms: number, largestUnit: DurationUnit = "days"): DurationParts {
  let rest = Number.isFinite(ms) && ms > 0 ? Math.floor(ms) : 0;
  const total = rest;
  const parts: DurationParts = { days: 0, hours: 0, minutes: 0, seconds: 0, milliseconds: 0, total };
  for (const unit of UNITS.slice(UNITS.indexOf(largestUnit))) {
    parts[unit] = Math.floor(rest / UNIT_MS[unit]);
    rest -= parts[unit] * UNIT_MS[unit];
  }
  parts.milliseconds = rest;
  return parts;
}

function plural(value: number, unit: string): string {
  return `${value} ${value === 1 ? unit.replace(/s$/, "") : unit}`;
}

function joinWords(words: string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/** Spoken duration to the minute, such as "2 days, 3 hours and 1 minute". */
function spokenMinutes(ms: number): string {
  const parts = splitDuration(ms);
  if (parts.total < 60_000) return "less than a minute";
  const words = (["days", "hours", "minutes"] as const).filter((unit) => parts[unit] > 0).map((unit) => plural(parts[unit], unit));
  return joinWords(words);
}

/** Spoken duration to the second, such as "4 minutes and 5 seconds". */
function spokenSeconds(ms: number): string {
  const parts = splitDuration(ms, "hours");
  const words = (["hours", "minutes", "seconds"] as const).filter((unit) => parts[unit] > 0).map((unit) => plural(parts[unit], unit));
  return words.length ? joinWords(words) : "0 seconds";
}

function subscribeNothing(): () => void {
  return () => undefined;
}

/** False during server rendering and hydration, true afterwards. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
}

function toTime(value: Date | string | number): number {
  return value instanceof Date ? value.getTime() : typeof value === "number" ? value : new Date(value).getTime();
}

const pad = (value: number) => String(value).padStart(2, "0");

export interface CountdownProps extends Omit<ComponentProps<"div">, "children"> {
  /** When the countdown reaches zero. */
  target: Date | string | number;
  /** Accessible name, such as "Spring sale ends in". */
  label: string;
  /** "compact" is one line of text; "segmented" shows a box per unit. */
  variant?: "compact" | "segmented";
  /** Units above it fold into it, such as 50 hours with "hours". */
  largestUnit?: "days" | "hours" | "minutes";
  /** Shows the days unit even when it is zero. */
  showZeroDays?: boolean;
  /** Called once when the target time is reached (also when it has already passed on mount). */
  onComplete?: () => void;
  /** Shown once the target time has passed. */
  completedLabel?: ReactNode;
  /**
   * Current time used for server rendering and hydration so both produce the
   * same output; without it, placeholders render until the client mounts.
   */
  serverNow?: number;
  /** Unit names for the segmented style. */
  unitLabels?: Partial<Record<DurationUnit, string>>;
}

/**
 * Countdown to a target date in days, hours, minutes and seconds, as compact
 * text or segmented boxes. The digits are hidden from assistive technology;
 * a polite live region instead announces the time left at most once a
 * minute. Server rendering produces a stable value (from `serverNow`, or
 * placeholders), and `onComplete` fires once at zero.
 */
export function Countdown({
  target,
  label,
  variant = "segmented",
  largestUnit = "days",
  showZeroDays = false,
  onComplete,
  completedLabel = "Ended",
  serverNow,
  unitLabels,
  className,
  ...props
}: CountdownProps) {
  const hydrated = useHydrated();
  const targetMs = toTime(target);
  const clock = useNow(250, hydrated);
  const now = hydrated ? clock : serverNow;
  const remaining = now === undefined || !Number.isFinite(targetMs) ? null : Math.max(0, targetMs - now);
  const complete = remaining === 0;
  const fired = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!hydrated || !complete || fired.current === targetMs) return;
    fired.current = targetMs;
    onCompleteRef.current?.();
  }, [hydrated, complete, targetMs]);

  const parts = splitDuration(remaining ?? 0, largestUnit);
  const units = UNITS.slice(UNITS.indexOf(largestUnit)).filter((unit) => unit !== "days" || showZeroDays || parts.days > 0);
  const names: Record<DurationUnit, string> = { days: "days", hours: "hours", minutes: "minutes", seconds: "seconds", ...unitLabels };
  const short: Record<DurationUnit, string> = { days: "d", hours: "h", minutes: "m", seconds: "s" };
  const value = (unit: DurationUnit) => (remaining === null ? "--" : pad(parts[unit]));
  const spoken = remaining === null ? "" : complete ? null : `${spokenMinutes(remaining)} remaining`;

  return (
    <div role="group" aria-label={label} data-slot="countdown" data-complete={complete ? "" : undefined} className={cn("inline-flex flex-col gap-1", className)} {...props}>
      {complete ? (
        <span className="text-sm font-medium text-muted-foreground">{completedLabel}</span>
      ) : variant === "compact" ? (
        <span aria-hidden="true" className="font-mono text-sm font-medium tabular-nums">
          {units.map((unit) => `${value(unit)}${short[unit]}`).join(" ")}
        </span>
      ) : (
        <span aria-hidden="true" className="flex items-start gap-2">
          {units.map((unit) => (
            <span key={unit} className="flex min-w-14 flex-col items-center rounded-lg border border-border bg-card px-2 py-1.5 text-card-foreground">
              <span className="text-2xl leading-tight font-semibold tabular-nums">{value(unit)}</span>
              <span className="text-xs text-muted-foreground">{names[unit]}</span>
            </span>
          ))}
        </span>
      )}
      <span aria-live="polite" aria-atomic="true" className="sr-only">
        {complete ? completedLabel : spoken}
      </span>
    </div>
  );
}

export interface TimerProps extends Omit<ComponentProps<"div">, "children" | "onPause" | "onReset"> {
  /** Accessible name, such as "Paint drying timer". */
  label: string;
  /** Counts up from zero, or down from `duration`. */
  mode?: "stopwatch" | "countdown";
  /** Countdown length in milliseconds. */
  duration?: number;
  onStart?: () => void;
  onPause?: (elapsed: number) => void;
  onReset?: () => void;
  /** Countdown reached zero. */
  onComplete?: () => void;
}

interface TimerState {
  status: "idle" | "running" | "paused" | "done";
  startedAt: number;
  accumulated: number;
}

function formatClock(ms: number, roundUp: boolean): string {
  const seconds = roundUp ? Math.ceil(ms / 1000) : Math.floor(ms / 1000);
  const parts = splitDuration(seconds * 1000, "hours");
  return parts.hours > 0 ? `${parts.hours}:${pad(parts.minutes)}:${pad(parts.seconds)}` : `${pad(parts.minutes)}:${pad(parts.seconds)}`;
}

/**
 * Stopwatch, or countdown from a duration, with Start, Pause, Resume and
 * Reset buttons. The time is a `timer` element screen readers can read on
 * demand, and each state change is announced politely, including the time
 * when paused and "Time is up" at zero.
 */
export function Timer({ label, mode = "stopwatch", duration = 0, onStart, onPause, onReset, onComplete, className, ...props }: TimerProps) {
  const [state, setState] = useState<TimerState>({ status: "idle", startedAt: 0, accumulated: 0 });
  const [announcement, setAnnouncement] = useState("");
  const running = state.status === "running";
  const now = useNow(250, running);
  const countdown = mode === "countdown";
  const length = Math.max(0, duration);
  const elapsed = state.status === "done" ? length : state.accumulated + (running ? Math.max(0, now - state.startedAt) : 0);
  const shown = countdown ? Math.max(0, length - elapsed) : elapsed;
  const onCompleteRef = useRef(onComplete);
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!countdown || state.status !== "running") return;
    const left = length - state.accumulated - (Date.now() - state.startedAt);
    const timer = setTimeout(
      () => {
        setState({ status: "done", startedAt: 0, accumulated: length });
        setAnnouncement(`${label}: time is up`);
        onCompleteRef.current?.();
      },
      Math.max(0, left),
    );
    return () => clearTimeout(timer);
  }, [countdown, length, label, state]);

  const onPrimary = () => {
    const time = Date.now();
    if (state.status === "running") {
      const total = state.accumulated + Math.max(0, time - state.startedAt);
      setState({ status: "paused", startedAt: 0, accumulated: total });
      setAnnouncement(`${label} paused at ${spokenSeconds(countdown ? Math.max(0, length - total) : total)}${countdown ? " left" : ""}`);
      onPause?.(total);
    } else if (state.status === "paused") {
      setState({ status: "running", startedAt: time, accumulated: state.accumulated });
      setAnnouncement(`${label} resumed`);
      onStart?.();
    } else {
      setState({ status: "running", startedAt: time, accumulated: 0 });
      setAnnouncement(`${label} started`);
      onStart?.();
    }
  };
  const reset = () => {
    setState({ status: "idle", startedAt: 0, accumulated: 0 });
    setAnnouncement(`${label} reset`);
    primaryRef.current?.focus();
    onReset?.();
  };

  const primaryText = state.status === "running" ? "Pause" : state.status === "paused" ? "Resume" : state.status === "done" ? "Start again" : "Start";
  return (
    <div role="group" aria-label={label} data-slot="timer" data-status={state.status} className={cn("inline-flex flex-col items-start gap-2", className)} {...props}>
      <div role="timer" aria-atomic="true" className={cn("font-mono text-3xl font-semibold tabular-nums", state.status === "done" && "text-destructive")}>
        {formatClock(shown, countdown)}
      </div>
      <div className="flex flex-wrap gap-2">
        <button ref={primaryRef} type="button" onClick={onPrimary} disabled={countdown && length === 0} className={cn(button, focusRing, running ? buttonVariants.outline : buttonVariants.primary)}>
          {running ? <PauseIcon aria-hidden="true" /> : <PlayIcon aria-hidden="true" />}
          {primaryText}
        </button>
        {state.status !== "idle" && (
          <button type="button" onClick={reset} className={cn(button, focusRing, buttonVariants.ghost)}>
            <RotateCcwIcon aria-hidden="true" />
            Reset
          </button>
        )}
      </div>
      <span aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}
