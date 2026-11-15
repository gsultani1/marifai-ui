// packages/ai-ui/src/components/retrieval-inspector.tsx
"use client";

import { ChevronDownIcon, SearchCodeIcon } from "lucide-react";
import { useId, useState } from "react";

import { badge, button, buttonVariants, card, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatDuration } from "../lib/format.js";
import { JsonViewer } from "./json-viewer.js";

export interface RetrievedItem {
  id: string;
  title: string;
  /** e.g. "Recent conversation", "Long-term memory" or "Documents". */
  tier: string;
  /** Retrieval score, 0 to 1. */
  score: number;
  confidence?: number;
  /** Age of the item in milliseconds. */
  ageMs?: number;
  /** Share of the final context this item contributed, 0 to 1. */
  contribution?: number;
  excerpt?: string;
}

export interface RetrievalTrace {
  query: string;
  /** e.g. ["hybrid", "rerank"] or ["vector"]. */
  strategies: string[];
  latencyMs?: number;
  items: RetrievedItem[];
  /** Named entities extracted from the query. */
  entities?: string[];
  /** The raw retrieval response for debugging. */
  raw?: unknown;
}

export interface RetrievalInspectorProps {
  trace: RetrievalTrace;
  className?: string;
}

/**
 * How context was retrieved for a message: the query, strategies and
 * latency, entities found, and each item's tier, score, confidence, age
 * and contribution, grouped by tier, with the raw response on request.
 */
export function RetrievalInspector({ trace, className }: RetrievalInspectorProps) {
  const [raw, setRaw] = useState(false);
  const id = useId();
  const tiers = [...new Set(trace.items.map((item) => item.tier))];
  const sorted = (tier: string) => trace.items.filter((item) => item.tier === tier).sort((a, b) => b.score - a.score);

  return (
    <section aria-labelledby={`${id}-title`} data-slot="retrieval-inspector" className={cn(card, "flex flex-col gap-3 p-3 text-sm", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <SearchCodeIcon aria-hidden="true" className="size-4 text-muted-foreground" />
        <h3 id={`${id}-title`} className="font-medium">
          Retrieval
        </h3>
        {trace.strategies.map((strategy) => (
          <span key={strategy} className={badge}>
            {strategy}
          </span>
        ))}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {trace.items.length} items{trace.latencyMs !== undefined ? ` · ${trace.latencyMs < 1000 ? `${Math.round(trace.latencyMs)} ms` : formatDuration(trace.latencyMs)}` : ""}
        </span>
      </div>
      <p className="rounded-md bg-muted/50 px-2 py-1 font-mono text-xs">{trace.query}</p>
      {trace.entities && trace.entities.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <span className="text-muted-foreground">Entities</span>
          {trace.entities.map((entity) => (
            <span key={entity} className={badge}>
              {entity}
            </span>
          ))}
        </div>
      )}
      {tiers.map((tier) => (
        <div key={tier} className="flex flex-col gap-1">
          <h4 className="text-xs font-medium text-muted-foreground">{tier}</h4>
          <table className="w-full text-left text-xs">
            <thead className="sr-only">
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Score</th>
                <th scope="col">Confidence</th>
                <th scope="col">Age</th>
                <th scope="col">Contribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted(tier).map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="py-1.5 pr-3">
                    <span className="font-medium">{item.title}</span>
                    {item.excerpt && <span className="mt-0.5 line-clamp-2 block text-muted-foreground">{item.excerpt}</span>}
                  </td>
                  <td className="py-1.5 pr-3 whitespace-nowrap tabular-nums">score {item.score.toFixed(2)}</td>
                  <td className="py-1.5 pr-3 whitespace-nowrap text-muted-foreground tabular-nums">{item.confidence !== undefined ? `${Math.round(item.confidence * 100)}% sure` : ""}</td>
                  <td className="py-1.5 pr-3 whitespace-nowrap text-muted-foreground tabular-nums">{item.ageMs !== undefined ? `${formatDuration(item.ageMs)} old` : ""}</td>
                  <td className="w-28 py-1.5">
                    {item.contribution !== undefined && (
                      <span className="flex items-center gap-1.5">
                        <span aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.round(item.contribution * 100)}%` }} />
                        </span>
                        <span className="tabular-nums">{Math.round(item.contribution * 100)}%</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {trace.items.length === 0 && <p className="text-muted-foreground">Nothing was retrieved for this message.</p>}
      {trace.raw !== undefined && (
        <div className="flex flex-col gap-2">
          <button type="button" aria-expanded={raw} onClick={() => setRaw(!raw)} className={cn(button, buttonVariants.ghost, "h-7 self-start px-2 text-xs", focusRing)}>
            Raw response
            <ChevronDownIcon aria-hidden="true" className={cn("transition-transform motion-reduce:transition-none", raw && "rotate-180")} />
          </button>
          {raw && <JsonViewer value={trace.raw} label="Raw retrieval response" defaultExpandDepth={1} className="max-h-72" />}
        </div>
      )}
    </section>
  );
}
