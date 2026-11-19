// packages/ai-ui/src/experimental/model-benchmark-scorecard.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading, ItemList } from "../lib/component-controls.js";

export interface ModelBenchmarkResult { id: string; model: string; quality?: number; latencyMs?: number; cost?: number }
export interface ModelBenchmarkUnits { quality: string; cost: string }

export interface ModelBenchmarkScorecardProps {
  results: readonly ModelBenchmarkResult[];
  units: ModelBenchmarkUnits;
  onOpen?: (id: string) => void;
  className?: string;
}

export function ModelBenchmarkScorecard({ results, units, onOpen, className }: ModelBenchmarkScorecardProps) {
  return <ControlPanel slot="model-benchmark-scorecard" title="Model benchmarks" className={className}>
    <ItemList items={results} empty="No benchmark results." render={(item) => <>
      <ItemHeading title={item.model}><ControlAction label="Open" item={item.model} onClick={onOpen && (() => onOpen(item.id))} /></ItemHeading>
      <dl className="grid gap-1 text-sm sm:grid-cols-3">
        {([{ label: "Quality", value: item.quality, unit: units.quality }, { label: "Latency", value: item.latencyMs, unit: "ms" },
          { label: "Cost", value: item.cost, unit: units.cost }]).map(({ label, value, unit }) => <div key={label}>
            <dt className="text-muted-foreground">{label}</dt><dd className="tabular-nums">{value !== undefined && Number.isFinite(value) ? value + " " + unit : "Unavailable"}</dd>
          </div>)}
      </dl>
    </>} />
  </ControlPanel>;
}
