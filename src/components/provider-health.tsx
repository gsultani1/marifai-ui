// packages/ai-ui/src/components/provider-health.tsx
"use client";

import { LoaderCircleIcon, RefreshCwIcon } from "lucide-react";
import { useId, useState } from "react";

import { useNow } from "../hooks/use-now.js";
import { badge, button, buttonVariants, card, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatRelativeTime } from "../lib/format.js";
import { HEALTH_LABELS, type HealthState } from "../lib/models.js";

const DOT: Record<HealthState, string> = {
  operational: "bg-success",
  degraded: "bg-warning",
  down: "bg-destructive",
  unknown: "bg-muted-foreground/50",
  checking: "bg-ring motion-safe:animate-pulse",
};

export interface HealthBadgeProps {
  state: HealthState;
  /** Shown after the state, e.g. a latency. */
  detail?: string;
  /** Shows only the dot; the state stays in the accessible name. */
  compact?: boolean;
  className?: string;
}

/** A provider's or model's health as a colored dot with its state in words, so color is never the only signal. */
export function HealthBadge({ state, detail, compact = false, className }: HealthBadgeProps) {
  const label = detail ? `${HEALTH_LABELS[state]}, ${detail}` : HEALTH_LABELS[state];
  if (compact) {
    return <span role="img" aria-label={label} title={label} data-slot="health-badge" data-state={state} className={cn("inline-block size-2 shrink-0 rounded-full", DOT[state], className)} />;
  }
  return (
    <span data-slot="health-badge" data-state={state} className={cn(badge, "gap-1.5", className)}>
      <span aria-hidden="true" className={cn("size-2 rounded-full", DOT[state])} />
      {HEALTH_LABELS[state]}
      {detail && <span className="font-normal text-muted-foreground">· {detail}</span>}
    </span>
  );
}

export interface ProviderStatus {
  id: string;
  name: string;
  state: HealthState;
  latencyMs?: number;
  checkedAt?: number;
  /** Shown when degraded or down, e.g. the last error. */
  message?: string;
}

export interface ProviderHealthProps {
  providers: ProviderStatus[];
  /** Re-checks one provider; the row shows Checking until the promise settles. */
  onVerify?: (id: string) => void | Promise<void>;
  /** Re-checks every provider. */
  onVerifyAll?: () => void | Promise<void>;
  label?: string;
  className?: string;
}

/** Health of each model provider: state, latency and when it was last checked, with a per-provider and overall Verify. */
export function ProviderHealth({ providers, onVerify, onVerifyAll, label = "Provider status", className }: ProviderHealthProps) {
  const [checking, setChecking] = useState<Set<string>>(new Set());
  const [checkingAll, setCheckingAll] = useState(false);
  const now = useNow(30_000);
  const id = useId();
  const healthy = providers.filter((provider) => provider.state === "operational").length;

  const verify = async (providerId: string) => {
    setChecking((current) => new Set(current).add(providerId));
    try {
      await onVerify?.(providerId);
    } finally {
      setChecking((current) => {
        const next = new Set(current);
        next.delete(providerId);
        return next;
      });
    }
  };

  const verifyAll = async () => {
    setCheckingAll(true);
    try {
      await onVerifyAll?.();
    } finally {
      setCheckingAll(false);
    }
  };

  return (
    <section aria-labelledby={`${id}-title`} data-slot="provider-health" className={cn(card, "flex flex-col text-sm", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h3 id={`${id}-title`} className="font-medium">
          {label}
        </h3>
        <span className="text-xs text-muted-foreground">
          {healthy} of {providers.length} operational
        </span>
        {onVerifyAll && (
          <button type="button" disabled={checkingAll} onClick={() => void verifyAll()} className={cn(button, buttonVariants.ghost, "ml-auto h-7 px-2 text-xs", focusRing)}>
            <RefreshCwIcon aria-hidden="true" className={cn(checkingAll && "motion-safe:animate-spin")} />
            Check all
          </button>
        )}
      </div>
      <ul className="divide-y divide-border">
        {providers.map((provider) => {
          const state: HealthState = checking.has(provider.id) || checkingAll ? "checking" : provider.state;
          return (
            <li key={provider.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <span className="min-w-28 font-medium">{provider.name}</span>
              <HealthBadge state={state} {...(provider.latencyMs !== undefined && state !== "checking" ? { detail: `${Math.round(provider.latencyMs)} ms` } : {})} />
              {provider.checkedAt !== undefined && state !== "checking" && <span className="text-xs text-muted-foreground">checked {formatRelativeTime(provider.checkedAt, now)}</span>}
              {onVerify && (
                <button type="button" aria-label={`Verify ${provider.name}`} disabled={state === "checking"} onClick={() => void verify(provider.id)} className={cn(button, buttonVariants.outline, "ml-auto h-7 px-2 text-xs", focusRing)}>
                  {state === "checking" ? <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" /> : null}
                  Verify
                </button>
              )}
              {provider.message && (provider.state === "degraded" || provider.state === "down") && <p className={cn("w-full text-xs", provider.state === "down" ? "text-destructive" : "text-muted-foreground")}>{provider.message}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
