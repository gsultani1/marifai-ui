// packages/ai-ui/src/components/usage-receipt.tsx
"use client";

import { ChevronDownIcon, CopyIcon, ReceiptIcon } from "lucide-react";
import { useId, useState } from "react";

import { useCopyToClipboard } from "../hooks/use-copy-to-clipboard.js";
import { focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatAmount, formatDuration } from "../lib/format.js";
import { formatTokenCount } from "../lib/models.js";

export interface UsageDetails {
  /** Model that answered. */
  model: string;
  /** Model that was asked for, when routing or a fallback changed it. */
  requestedModel?: string;
  provider?: string;
  /** Why this model was chosen, e.g. "Auto: short factual question". */
  reason?: string;
  fallbacks?: Array<{ model: string; reason: string }>;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  reasoningTokens?: number;
  effort?: string;
  timings?: { queueMs?: number; firstTokenMs?: number; totalMs?: number };
  cost?: number;
  currency?: string;
  /** The cost is an estimate rather than the provider's reported figure. */
  estimated?: boolean;
  requestId?: string;
}

function seconds(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/** Plain-text receipt for support or records; `redact` keeps only the last four characters of the request id. */
export function formatUsageReceipt(details: UsageDetails, { redact = true }: { redact?: boolean } = {}): string {
  const currency = details.currency ?? "USD";
  const lines = [
    `Model: ${details.model}${details.provider ? ` (${details.provider})` : ""}`,
    details.requestedModel && details.requestedModel !== details.model ? `Requested: ${details.requestedModel}` : "",
    details.reason ? `Why: ${details.reason}` : "",
    ...(details.fallbacks ?? []).map((fallback) => `Fallback from ${fallback.model}: ${fallback.reason}`),
    `Tokens: ${details.inputTokens} in, ${details.outputTokens} out${details.cachedTokens ? `, ${details.cachedTokens} cached` : ""}${details.reasoningTokens ? `, ${details.reasoningTokens} reasoning` : ""}`,
    details.effort ? `Effort: ${details.effort}` : "",
    details.timings?.queueMs !== undefined ? `Preparation: ${seconds(details.timings.queueMs)}` : "",
    details.timings?.firstTokenMs !== undefined ? `First text: ${seconds(details.timings.firstTokenMs)}` : "",
    details.timings?.totalMs !== undefined ? `Total: ${seconds(details.timings.totalMs)}` : "",
    details.cost !== undefined ? `Cost: ${formatAmount(details.cost, currency)}${details.estimated ? " (estimated)" : ""}` : "",
    details.requestId ? `Request: ${redact ? `…${details.requestId.slice(-4)}` : details.requestId}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

export interface UsageReceiptProps {
  details: UsageDetails;
  defaultOpen?: boolean;
  className?: string;
}

/**
 * One response's usage as a compact line (model, tokens, cost, time) that
 * opens to the full receipt: requested versus actual model and why,
 * fallbacks, cached and reasoning tokens, timing and whether the cost is
 * reported or estimated, with a redacted copy.
 */
export function UsageReceipt({ details, defaultOpen = false, className }: UsageReceiptProps) {
  const [open, setOpen] = useState(defaultOpen);
  const { copied, copy } = useCopyToClipboard();
  const id = useId();
  const currency = details.currency ?? "USD";
  const rerouted = details.requestedModel !== undefined && details.requestedModel !== details.model;
  const summary = [
    details.model,
    `${formatTokenCount(details.inputTokens)} in`,
    `${formatTokenCount(details.outputTokens)} out`,
    details.cost !== undefined ? `${details.estimated ? "~" : ""}${formatAmount(details.cost, currency)}` : "",
    details.timings?.totalMs !== undefined ? formatDuration(details.timings.totalMs) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const rows: Array<[string, string]> = [["Model", `${details.model}${details.provider ? ` (${details.provider})` : ""}`]];
  if (rerouted) rows.push(["Requested", details.requestedModel!]);
  if (details.reason) rows.push(["Why", details.reason]);
  for (const fallback of details.fallbacks ?? []) rows.push([`Fell back from ${fallback.model}`, fallback.reason]);
  rows.push(["Input", `${details.inputTokens.toLocaleString()} tokens${details.cachedTokens ? `, ${details.cachedTokens.toLocaleString()} cached` : ""}`]);
  rows.push(["Output", `${details.outputTokens.toLocaleString()} tokens${details.reasoningTokens ? `, ${details.reasoningTokens.toLocaleString()} reasoning` : ""}`]);
  if (details.effort) rows.push(["Effort", details.effort]);
  if (details.timings?.queueMs !== undefined) rows.push(["Preparation", seconds(details.timings.queueMs)]);
  if (details.timings?.firstTokenMs !== undefined) rows.push(["First text", seconds(details.timings.firstTokenMs)]);
  if (details.timings?.totalMs !== undefined) rows.push(["Total time", seconds(details.timings.totalMs)]);
  if (details.cost !== undefined) rows.push(["Cost", `${formatAmount(details.cost, currency)} ${details.estimated ? "(estimated)" : "(reported by provider)"}`]);

  return (
    <div data-slot="usage-receipt" className={cn("flex flex-col gap-1 text-xs", className)}>
      <div className="flex items-center gap-1">
        <button type="button" aria-expanded={open} aria-controls={`${id}-details`} onClick={() => setOpen(!open)} className={cn("inline-flex min-w-0 items-center gap-1.5 rounded-sm text-muted-foreground hover:text-foreground", focusRing)}>
          <ReceiptIcon aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate tabular-nums">{summary}</span>
          {rerouted && <span className="shrink-0 rounded-full border border-border px-1.5">rerouted</span>}
          <ChevronDownIcon aria-hidden="true" className={cn("size-3.5 shrink-0 transition-transform motion-reduce:transition-none", open && "rotate-180")} />
        </button>
        {open && (
          <button type="button" aria-label={copied ? "Copied" : "Copy receipt"} title="Copy receipt (request id redacted)" onClick={() => void copy(formatUsageReceipt(details))} className={cn(iconButton, "size-6", focusRing)}>
            <CopyIcon aria-hidden="true" />
          </button>
        )}
      </div>
      {open && (
        <dl id={`${id}-details`} className="grid max-w-md grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 rounded-md border border-border bg-card p-2">
          {rows.map(([term, value], index) => (
            <div key={`${term}-${index}`} className="contents">
              <dt className="text-muted-foreground">{term}</dt>
              <dd className="tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
