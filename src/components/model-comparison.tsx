// packages/ai-ui/src/components/model-comparison.tsx
"use client";

import { CircleAlertIcon, ThumbsUpIcon, TrophyIcon } from "lucide-react";
import { useId } from "react";

import { badge, button, buttonVariants, card, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatAmount } from "../lib/format.js";
import { formatTokenCount } from "../lib/models.js";
import { MessageContent } from "./message-content.js";

export interface ComparisonMetrics {
  /** 0 to 1, e.g. from an evaluator. */
  quality?: number;
  /** Sources cited. */
  evidence?: number;
  latencyMs?: number;
  tokens?: number;
  cost?: number;
}

export interface ComparisonCandidate {
  id: string;
  model: string;
  /** Markdown answer. */
  output: string;
  metrics?: ComparisonMetrics;
  error?: string;
}

type MetricKey = keyof ComparisonMetrics;

const HIGHER_IS_BETTER: Record<MetricKey, boolean> = { quality: true, evidence: true, latencyMs: false, tokens: false, cost: false };

/** For each metric, the ids of the candidates with the best value; ties share it, and a metric nobody reports has none. */
export function bestByMetric(candidates: readonly ComparisonCandidate[]): Record<MetricKey, string[]> {
  const result = { quality: [], evidence: [], latencyMs: [], tokens: [], cost: [] } as Record<MetricKey, string[]>;
  for (const key of Object.keys(HIGHER_IS_BETTER) as MetricKey[]) {
    const values = candidates.filter((candidate) => !candidate.error && candidate.metrics?.[key] !== undefined).map((candidate) => ({ id: candidate.id, value: candidate.metrics![key]! }));
    if (values.length < 2) continue;
    const best = HIGHER_IS_BETTER[key] ? Math.max(...values.map((item) => item.value)) : Math.min(...values.map((item) => item.value));
    result[key] = values.filter((item) => item.value === best).map((item) => item.id);
  }
  return result;
}

export interface ModelComparisonProps {
  prompt?: string;
  candidates: ComparisonCandidate[];
  preferredId?: string;
  onPrefer?: (id: string) => void;
  currency?: string;
  className?: string;
}

/**
 * The same prompt answered by several models side by side: each answer
 * with quality, evidence, latency, tokens and cost, the best value of each
 * metric marked in words, failures shown in place, and a vote for the
 * preferred answer.
 */
export function ModelComparison({ prompt, candidates, preferredId, onPrefer, currency = "USD", className }: ModelComparisonProps) {
  const id = useId();
  const best = bestByMetric(candidates);
  const metric = (candidate: ComparisonCandidate, key: MetricKey, label: string, value: string) => {
    const winner = best[key].includes(candidate.id);
    return (
      <div className="flex flex-col">
        <dt className="text-muted-foreground">{label}</dt>
        <dd className={cn("flex items-center gap-1 tabular-nums", winner && "font-semibold")}>
          {value}
          {winner && (
            <>
              <TrophyIcon aria-hidden="true" className="size-3 text-warning" />
              <span className="sr-only">(best)</span>
            </>
          )}
        </dd>
      </div>
    );
  };

  return (
    <section aria-labelledby={`${id}-title`} data-slot="model-comparison" className={cn("flex flex-col gap-3 text-sm", className)}>
      <div className="flex flex-col gap-1">
        <h3 id={`${id}-title`} className="font-medium">
          Compare {candidates.length} models
        </h3>
        {prompt && <p className="line-clamp-2 text-xs text-muted-foreground">Prompt: {prompt}</p>}
      </div>
      <ul className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, 16rem), 1fr))` }}>
        {candidates.map((candidate) => {
          const metrics = candidate.metrics ?? {};
          const preferred = candidate.id === preferredId;
          return (
            <li key={candidate.id} aria-label={candidate.model} className={cn(card, "flex min-w-0 flex-col gap-2 p-3", preferred && "border-ring ring-1 ring-ring")}>
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{candidate.model}</span>
                {preferred && <span className={cn(badge, "border-primary/40")}>Preferred</span>}
              </div>
              {!candidate.error && (
                <dl className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
                  {metrics.quality !== undefined && metric(candidate, "quality", "Quality", `${Math.round(metrics.quality * 100)}%`)}
                  {metrics.evidence !== undefined && metric(candidate, "evidence", "Sources", String(metrics.evidence))}
                  {metrics.latencyMs !== undefined && metric(candidate, "latencyMs", "Latency", metrics.latencyMs < 1000 ? `${Math.round(metrics.latencyMs)} ms` : `${(metrics.latencyMs / 1000).toFixed(1)} s`)}
                  {metrics.tokens !== undefined && metric(candidate, "tokens", "Tokens", formatTokenCount(metrics.tokens))}
                  {metrics.cost !== undefined && metric(candidate, "cost", "Cost", formatAmount(metrics.cost, currency))}
                </dl>
              )}
              {candidate.error ? (
                <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-destructive">
                  <CircleAlertIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                  {candidate.error}
                </p>
              ) : (
                <div tabIndex={0} role="region" aria-label={`${candidate.model} answer`} className={cn("max-h-80 overflow-auto rounded-md border border-border p-2", focusRing, "focus-visible:ring-offset-0")}>
                  <MessageContent>{candidate.output}</MessageContent>
                </div>
              )}
              {onPrefer && !candidate.error && (
                <button type="button" aria-pressed={preferred} aria-label={`Prefer ${candidate.model}`} onClick={() => onPrefer(candidate.id)} className={cn(button, preferred ? buttonVariants.primary : buttonVariants.outline, "mt-auto h-7 self-start px-2 text-xs", focusRing)}>
                  <ThumbsUpIcon aria-hidden="true" />
                  Prefer
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
