// packages/ai-ui/src/components/trace-span-details.tsx
"use client";

import { ControlPanel, ItemHeading, contentBlock } from "../lib/component-controls.js";

/** Supply display-safe input and output summaries. */
export interface DisplayedTraceSpan { id: string; label: string; startedAt?: string; durationMs?: number; status?: string; input?: string; output?: string; error?: string }

export interface TraceSpanDetailsProps {
  span: DisplayedTraceSpan | null;
  className?: string;
}

export function TraceSpanDetails({ span, className }: TraceSpanDetailsProps) {
  return <ControlPanel slot="trace-span-details" title="Trace span details" className={className}>
    {span ? <>
      <ItemHeading title={span.label} detail={[span.status,span.startedAt,span.durationMs === undefined ? null : span.durationMs + " ms"].filter(Boolean).join(" · ")} />
      {([{label:"Input",value:span.input},{label:"Output",value:span.output},{label:"Error",value:span.error}]).map(({label,value}) => value !== undefined &&
        <div key={label}><h4 className="text-sm font-medium">{label}</h4><p className={contentBlock}>{value}</p></div>)}
    </> : <p className="text-sm text-muted-foreground">Select a span to inspect it.</p>}
  </ControlPanel>;
}
