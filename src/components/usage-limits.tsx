// packages/ai-ui/src/components/usage-limits.tsx
"use client";

import { GaugeIcon, XIcon } from "lucide-react";
import { useId } from "react";

import { useNow } from "../hooks/use-now.js";
import { button, buttonVariants, card, focusRing, iconButton, type Tone, toneSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatDuration } from "../lib/format.js";

export interface UsageLimit {
  id: string;
  /** e.g. "Messages", "Tokens" or "Image generations". */
  label: string;
  used: number;
  limit: number;
  /** e.g. "messages"; used in sentences. */
  unit?: string;
  resetsAt?: number;
}

/** The limit with the least headroom, which decides whether to warn. */
export function mostConstrainedLimit<T extends UsageLimit>(limits: readonly T[]): T | undefined {
  return [...limits].sort((a, b) => b.used / Math.max(1, b.limit) - a.used / Math.max(1, a.limit))[0];
}

/** Neutral below `warnAt`, a warning from it, danger once the limit is reached. */
export function usageLimitTone(limit: Pick<UsageLimit, "used" | "limit">, warnAt = 0.8): Tone {
  const ratio = limit.limit > 0 ? limit.used / limit.limit : 1;
  return ratio >= 1 ? "danger" : ratio >= warnAt ? "warning" : "neutral";
}

function resetText(resetsAt: number | undefined, now: number): string {
  if (resetsAt === undefined) return "";
  const ms = resetsAt - now;
  return ms <= 0 ? "Resets now" : `Resets in ${formatDuration(ms)}`;
}

export interface UsageLimitCardProps {
  limits: UsageLimit[];
  title?: string;
  warnAt?: number;
  /** e.g. "Upgrade" or "Add credits". */
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

/** What's left of each plan limit, with a bar, the reset countdown and a warning near each limit. */
export function UsageLimitCard({ limits, title = "Plan limits", warnAt = 0.8, actionLabel, onAction, className }: UsageLimitCardProps) {
  const now = useNow(60_000);
  const id = useId();
  return (
    <section aria-labelledby={`${id}-title`} data-slot="usage-limit-card" className={cn(card, "flex flex-col gap-3 p-3 text-sm", className)}>
      <div className="flex items-center gap-2">
        <GaugeIcon aria-hidden="true" className="size-4 text-muted-foreground" />
        <h3 id={`${id}-title`} className="font-medium">
          {title}
        </h3>
        {onAction && actionLabel && (
          <button type="button" onClick={onAction} className={cn(button, buttonVariants.outline, "ml-auto h-7 px-2 text-xs", focusRing)}>
            {actionLabel}
          </button>
        )}
      </div>
      <ul className="flex flex-col gap-3">
        {limits.map((limit) => {
          const tone = usageLimitTone(limit, warnAt);
          const left = Math.max(0, limit.limit - limit.used);
          const percent = limit.limit > 0 ? Math.min(100, (limit.used / limit.limit) * 100) : 100;
          return (
            <li key={limit.id} data-tone={tone} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span id={`${id}-${limit.id}`} className="font-medium">
                  {limit.label}
                </span>
                <span className={cn("text-xs tabular-nums", tone === "danger" ? "font-medium text-destructive" : "text-muted-foreground")}>{tone === "danger" ? "Limit reached" : `${left.toLocaleString()} left`}</span>
              </div>
              <div
                role="meter"
                aria-labelledby={`${id}-${limit.id}`}
                aria-valuemin={0}
                aria-valuemax={limit.limit}
                aria-valuenow={Math.min(limit.used, limit.limit)}
                aria-valuetext={`${limit.used.toLocaleString()} of ${limit.limit.toLocaleString()}${limit.unit ? ` ${limit.unit}` : ""} used`}
                className="h-1.5 overflow-hidden rounded-full bg-muted"
              >
                <span className={cn("block h-full rounded-full", tone === "danger" ? "bg-destructive" : tone === "warning" ? "bg-warning" : "bg-primary")} style={{ width: `${percent}%` }} />
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                {limit.used.toLocaleString()} of {limit.limit.toLocaleString()}
                {limit.unit ? ` ${limit.unit}` : ""}
                {limit.resetsAt !== undefined ? ` · ${resetText(limit.resetsAt, now)}` : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export interface UsageLimitBannerProps {
  /** Usually `mostConstrainedLimit(limits)`. */
  limit: UsageLimit;
  warnAt?: number;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  className?: string;
}

/**
 * Strip under the composer once a limit is close or reached: how much is
 * used, when it resets and an action such as upgrading. It renders nothing
 * while the limit is comfortable.
 */
export function UsageLimitBanner({ limit, warnAt = 0.8, actionLabel, onAction, onDismiss, className }: UsageLimitBannerProps) {
  const now = useNow(60_000);
  const tone = usageLimitTone(limit, warnAt);
  if (tone === "neutral") return null;
  const unit = limit.unit ?? limit.label.toLowerCase();
  const percent = Math.round(limit.limit > 0 ? (limit.used / limit.limit) * 100 : 100);
  const message = tone === "danger" ? `You've used all ${limit.limit.toLocaleString()} ${unit}.` : `You've used ${percent}% of your ${unit}.`;

  return (
    <div role={tone === "danger" ? "alert" : "status"} data-slot="usage-limit-banner" data-tone={tone} className={cn("flex flex-wrap items-center gap-2 rounded-b-lg border border-t-0 px-3 py-1.5 text-xs", toneSurface[tone], className)}>
      <span className="font-medium">{message}</span>
      {limit.resetsAt !== undefined && <span>{resetText(limit.resetsAt, now)}.</span>}
      <span className="ml-auto flex items-center gap-1">
        {onAction && actionLabel && (
          <button type="button" onClick={onAction} className={cn(button, buttonVariants.outline, "h-6 px-2 text-xs", focusRing)}>
            {actionLabel}
          </button>
        )}
        {onDismiss && tone !== "danger" && (
          <button type="button" aria-label="Dismiss" title="Dismiss" onClick={onDismiss} className={cn(iconButton, "size-6", focusRing)}>
            <XIcon aria-hidden="true" />
          </button>
        )}
      </span>
    </div>
  );
}
