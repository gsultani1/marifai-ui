// packages/ai-ui/src/components/usage-dashboard.tsx
"use client";

import { ArrowDownIcon, ArrowUpIcon, DownloadIcon } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { button, buttonVariants, card, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { downloadText } from "../lib/download.js";
import { formatAmount } from "../lib/format.js";
import { formatTokenCount } from "../lib/models.js";
import { toDelimited } from "../lib/sheet-ops.js";
import { BudgetBar } from "./budget-bar.js";
import { CurrencyInput } from "./number-input.js";
import { StatTile } from "./stat-tile.js";

export type UsageRunStatus = "succeeded" | "failed" | "canceled" | "running";

export interface UsageRun {
  id: string;
  title?: string;
  startedAt: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  /** The cost is estimated rather than reported by the provider. */
  estimated?: boolean;
  status?: UsageRunStatus;
}

/** Runs as CSV with a header row, for spreadsheets and accounting. */
export function usageRunsToCsv(runs: readonly UsageRun[]): string {
  return toDelimited([
    ["started_at", "id", "title", "model", "input_tokens", "output_tokens", "cost", "cost_source", "status"],
    ...runs.map((run) => [new Date(run.startedAt).toISOString(), run.id, run.title ?? "", run.model, String(run.inputTokens), String(run.outputTokens), run.cost.toFixed(6), run.estimated ? "estimated" : "reported", run.status ?? ""]),
  ]);
}

export interface UsageDashboardProps {
  runs: UsageRun[];
  /** Spending limit for the period. */
  limit: number;
  /** Defaults to the sum of the runs' costs. */
  spent?: number;
  /** Held by running or approved work. */
  reserved?: number;
  currency?: string;
  /** e.g. "October" or "This month". */
  periodLabel?: string;
  /** Largest cost a single run may reach, in minor units such as cents. */
  perRunCap?: number | null;
  onPerRunCapChange?: (minorUnits: number | null) => void;
  /** File name for exports, without extension. */
  exportName?: string;
  className?: string;
}

type SortKey = "startedAt" | "cost";

/**
 * Spending for a period: tiles for spent, held, available and runs, the
 * budget bar, a per-run cap, and a filterable, sortable table of runs that
 * marks estimated costs and exports to CSV or JSON.
 */
export function UsageDashboard({ runs, limit, spent: spentProp, reserved = 0, currency = "USD", periodLabel = "This month", perRunCap, onPerRunCapChange, exportName = "usage", className }: UsageDashboardProps) {
  const [model, setModel] = useState("all");
  const [status, setStatus] = useState("all");
  const [reportedOnly, setReportedOnly] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; direction: "ascending" | "descending" }>({ key: "startedAt", direction: "descending" });
  const id = useId();
  const spent = spentProp ?? runs.reduce((sum, run) => sum + run.cost, 0);
  const available = Math.max(0, limit - spent - reserved);
  const models = useMemo(() => [...new Set(runs.map((run) => run.model))].sort(), [runs]);
  const estimatedCount = runs.filter((run) => run.estimated).length;

  const shown = useMemo(() => {
    const filtered = runs.filter((run) => (model === "all" || run.model === model) && (status === "all" || run.status === status) && (!reportedOnly || !run.estimated));
    const factor = sort.direction === "ascending" ? 1 : -1;
    return filtered.sort((a, b) => (a[sort.key] - b[sort.key]) * factor);
  }, [runs, model, status, reportedOnly, sort]);
  const shownCost = shown.reduce((sum, run) => sum + run.cost, 0);

  const sortButton = (key: SortKey, label: string) => {
    const active = sort.key === key;
    return (
      <button type="button" onClick={() => setSort({ key, direction: active && sort.direction === "descending" ? "ascending" : "descending" })} className={cn("inline-flex items-center gap-1 rounded-sm font-medium", focusRing)}>
        {label}
        {active && (sort.direction === "descending" ? <ArrowDownIcon aria-hidden="true" className="size-3" /> : <ArrowUpIcon aria-hidden="true" className="size-3" />)}
      </button>
    );
  };

  return (
    <section aria-labelledby={`${id}-title`} data-slot="usage-dashboard" className={cn("flex flex-col gap-4 text-sm", className)}>
      <h3 id={`${id}-title`} className="text-base font-semibold">
        Usage · {periodLabel}
      </h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Spent" value={formatAmount(spent, currency)} subtitle={estimatedCount ? `${estimatedCount} estimated` : "All reported"} />
        <StatTile label="Held" value={formatAmount(reserved, currency)} subtitle="Running or approved" />
        <StatTile label="Available" value={formatAmount(available, currency)} subtitle={`of ${formatAmount(limit, currency)}`} />
        <StatTile label="Runs" value={runs.length.toLocaleString()} subtitle={`${runs.filter((run) => run.status === "failed").length} failed`} />
      </div>
      <BudgetBar budget={limit} used={spent} held={reserved} unit={currency} label={`${periodLabel} budget`} />
      {onPerRunCapChange && (
        <div className="flex flex-wrap items-center gap-2">
          <span id={`${id}-cap`} className="text-sm">
            Stop any single run at
          </span>
          <CurrencyInput aria-labelledby={`${id}-cap`} currency={currency} value={perRunCap ?? null} onValueCommitted={onPerRunCapChange} placeholder="No cap" className="w-32" />
        </div>
      )}
      <div className={cn(card, "flex flex-col")}>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
          <select aria-label="Model" value={model} onChange={(event) => setModel(event.target.value)} className={cn("h-8 rounded-md border border-input bg-background px-2 text-xs", focusRing)}>
            <option value="all">All models</option>
            {models.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)} className={cn("h-8 rounded-md border border-input bg-background px-2 text-xs", focusRing)}>
            <option value="all">Any status</option>
            <option value="succeeded">Succeeded</option>
            <option value="failed">Failed</option>
            <option value="canceled">Canceled</option>
            <option value="running">Running</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={reportedOnly} onChange={(event) => setReportedOnly(event.target.checked)} className="size-3.5 accent-primary" />
            Reported costs only
          </label>
          <span className="ml-auto flex gap-1">
            <button type="button" onClick={() => downloadText(`${exportName}.csv`, usageRunsToCsv(shown), "text/csv;charset=utf-8")} className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs", focusRing)}>
              <DownloadIcon aria-hidden="true" />
              CSV
            </button>
            <button type="button" onClick={() => downloadText(`${exportName}.json`, JSON.stringify(shown, null, 2), "application/json")} className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs", focusRing)}>
              <DownloadIcon aria-hidden="true" />
              JSON
            </button>
          </span>
        </div>
        <div tabIndex={0} role="region" aria-label="Runs" className="overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th scope="col" aria-sort={sort.key === "startedAt" ? sort.direction : undefined} className="px-3 py-2">
                  {sortButton("startedAt", "When")}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Run
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Model
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Tokens in / out
                </th>
                <th scope="col" aria-sort={sort.key === "cost" ? sort.direction : undefined} className="px-3 py-2 text-right">
                  {sortButton("cost", "Cost")}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((run) => (
                <tr key={run.id}>
                  <td className="px-3 py-1.5 whitespace-nowrap">{new Date(run.startedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                  <td className="max-w-48 truncate px-3 py-1.5">{run.title ?? run.id}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">{run.model}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {formatTokenCount(run.inputTokens)} / {formatTokenCount(run.outputTokens)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {formatAmount(run.cost, currency)}
                    {run.estimated && (
                      <abbr title="Estimated" className="ml-1 no-underline">
                        est.
                      </abbr>
                    )}
                  </td>
                  <td className={cn("px-3 py-1.5 capitalize", run.status === "failed" && "font-medium text-destructive")}>{run.status ?? ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-border">
              <tr>
                <th scope="row" colSpan={4} className="px-3 py-2 text-left font-medium">
                  {shown.length} of {runs.length} runs
                </th>
                <td className="px-3 py-2 text-right font-medium tabular-nums">{formatAmount(shownCost, currency)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
          {shown.length === 0 && <p className="px-3 py-3 text-muted-foreground">No runs match these filters.</p>}
        </div>
      </div>
    </section>
  );
}
