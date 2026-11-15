// packages/ai-ui/src/components/insight-card.tsx
"use client";

import { CheckIcon, ChevronDownIcon, CircleAlertIcon, InfoIcon, LoaderCircleIcon, SparklesIcon, TrendingUpIcon, TriangleAlertIcon } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

import { useNow } from "../hooks/use-now.js";
import { badge, button, buttonVariants, card, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatRelativeTime } from "../lib/format.js";

export type InsightSeverity = "info" | "positive" | "warning" | "critical";

const SEVERITY: Record<InsightSeverity, { label: string; icon: ReactNode; border: string; iconClass: string }> = {
  info: { label: "Info", icon: <InfoIcon aria-hidden="true" />, border: "border-l-ring", iconClass: "text-muted-foreground" },
  positive: { label: "Good news", icon: <TrendingUpIcon aria-hidden="true" />, border: "border-l-success", iconClass: "text-success" },
  warning: { label: "Needs attention", icon: <TriangleAlertIcon aria-hidden="true" />, border: "border-l-warning", iconClass: "text-warning" },
  critical: { label: "Urgent", icon: <CircleAlertIcon aria-hidden="true" />, border: "border-l-destructive", iconClass: "text-destructive" },
};

export type AnalyzeResult = void | { failed: number; total: number };

export interface AnalyzeButtonProps {
  /** Runs the analysis; resolve with failure counts when it covers several parts that settle separately. */
  onAnalyze: () => AnalyzeResult | Promise<AnalyzeResult>;
  label?: string;
  /** When it last ran, shown as "Updated 5 minutes ago". */
  lastRunAt?: number;
  className?: string;
}

/** Starts an AI analysis and reports it: Analyzing while it runs, then when it finished, a partial failure count or an error. */
export function AnalyzeButton({ onAnalyze, label = "Analyze", lastRunAt, className }: AnalyzeButtonProps) {
  const [state, setState] = useState<{ status: "idle" | "running" | "done" | "error"; message: string; at?: number }>({ status: "idle", message: "" });
  const now = useNow(30_000);
  const last = state.at ?? lastRunAt;

  const run = async (event: { timeStamp: number }) => {
    setState({ status: "running", message: "Analyzing…" });
    try {
      const result = await onAnalyze();
      const at = performance.timeOrigin + event.timeStamp;
      setState(result && result.failed > 0 ? { status: "error", message: `${result.failed} of ${result.total} parts couldn't be analyzed.`, at } : { status: "done", message: "", at });
    } catch (reason) {
      setState({ status: "error", message: reason instanceof Error && reason.message ? reason.message : "Couldn't analyze. Try again." });
    }
  };

  return (
    <span data-slot="analyze-button" className={cn("inline-flex flex-wrap items-center gap-2", className)}>
      <button type="button" disabled={state.status === "running"} onClick={(event) => void run(event)} className={cn(button, buttonVariants.outline, focusRing)}>
        {state.status === "running" ? <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" /> : <SparklesIcon aria-hidden="true" />}
        {state.status === "running" ? "Analyzing…" : label}
      </button>
      <span role="status" className={cn("text-xs", state.status === "error" ? "font-medium text-destructive" : "text-muted-foreground")}>
        {state.status === "error" ? state.message : state.status === "running" ? "" : last !== undefined ? `Updated ${formatRelativeTime(Math.min(last, now), now)}` : ""}
      </span>
    </span>
  );
}

export interface InsightMetric {
  label: string;
  value: string;
  hint?: string;
}

export interface InsightAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

export interface InsightCardProps {
  title: string;
  severity?: InsightSeverity;
  summary: string;
  /** More explanation, shown on request. */
  details?: ReactNode;
  generatedAt?: number;
  metrics?: InsightMetric[];
  actions?: InsightAction[];
  acknowledged?: boolean;
  onAcknowledge?: () => void;
  /** Re-runs the analysis behind this insight. */
  onRefresh?: () => AnalyzeResult | Promise<AnalyzeResult>;
  className?: string;
}

/**
 * One finding from an AI analysis: severity in words and color, a summary
 * with expandable detail, supporting numbers, follow-up actions, when it
 * was generated, refresh, and acknowledge to set it aside.
 */
export function InsightCard({ title, severity = "info", summary, details, generatedAt, metrics = [], actions = [], acknowledged = false, onAcknowledge, onRefresh, className }: InsightCardProps) {
  const [open, setOpen] = useState(false);
  const now = useNow(60_000);
  const id = useId();
  const meta = SEVERITY[severity];

  return (
    <article aria-labelledby={`${id}-title`} data-slot="insight-card" data-severity={severity} className={cn(card, "flex flex-col gap-2 border-l-4 p-3 text-sm", meta.border, className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("[&_svg]:size-4", meta.iconClass)}>{meta.icon}</span>
        <h3 id={`${id}-title`} className="font-medium">
          {title}
        </h3>
        <span className={badge}>{meta.label}</span>
        {acknowledged && (
          <span className={badge}>
            <CheckIcon aria-hidden="true" />
            Acknowledged
          </span>
        )}
        {generatedAt !== undefined && <span className="ml-auto text-xs text-muted-foreground">{formatRelativeTime(Math.min(generatedAt, now), now)}</span>}
      </div>
      <p className={cn(acknowledged && "text-muted-foreground")}>{summary}</p>
      {metrics.length > 0 && (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-md border border-border px-2 py-1.5">
              <dt className="text-xs text-muted-foreground">{metric.label}</dt>
              <dd className="font-semibold tabular-nums">{metric.value}</dd>
              {metric.hint && <dd className="text-xs text-muted-foreground">{metric.hint}</dd>}
            </div>
          ))}
        </dl>
      )}
      {details && (
        <>
          <button type="button" aria-expanded={open} aria-controls={`${id}-details`} onClick={() => setOpen(!open)} className={cn("inline-flex items-center gap-1 self-start rounded-sm text-xs font-medium underline-offset-2 hover:underline", focusRing)}>
            {open ? "Hide details" : "Why?"}
            <ChevronDownIcon aria-hidden="true" className={cn("size-3.5 transition-transform motion-reduce:transition-none", open && "rotate-180")} />
          </button>
          {open && (
            <div id={`${id}-details`} className="rounded-md bg-muted/50 p-2 text-xs leading-5">
              {details}
            </div>
          )}
        </>
      )}
      {(actions.length > 0 || onAcknowledge || onRefresh) && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {actions.map((action) => (
            <button key={action.label} type="button" onClick={action.onClick} className={cn(button, action.primary ? buttonVariants.primary : buttonVariants.outline, "h-7 px-2 text-xs", focusRing)}>
              {action.label}
            </button>
          ))}
          {onAcknowledge && !acknowledged && (
            <button type="button" onClick={onAcknowledge} className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs", focusRing)}>
              <CheckIcon aria-hidden="true" />
              Acknowledge
            </button>
          )}
          {onRefresh && <AnalyzeButton label="Refresh" onAnalyze={onRefresh} className="ml-auto [&_button]:h-7 [&_button]:px-2 [&_button]:text-xs" />}
        </div>
      )}
    </article>
  );
}
