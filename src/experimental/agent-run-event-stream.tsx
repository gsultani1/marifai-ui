// packages/ai-ui/src/experimental/agent-run-event-stream.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { ControlAction, ControlPanel, ItemHeading, ItemList } from "../lib/component-controls.js";

export interface DisplayedRunEvent { id: string; title: string; timestamp?: string; detail?: string }
export interface AgentRunEventStreamProps {
  /** Events in display order. */
  events: readonly DisplayedRunEvent[];
  onOpen?: (id: string) => void;
  className?: string;
}
export function AgentRunEventStream({ events, onOpen, className }: AgentRunEventStreamProps) {
  const [cutoff, setCutoff] = useState<ReadonlySet<string> | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const last = events.at(-1)?.id;
  useEffect(() => {
    if (!cutoff && viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
  }, [cutoff, last, events.length]);
  const visible = cutoff ? events.filter((item) => cutoff.has(item.id)) : events;
  return <ControlPanel slot="agent-run-event-stream" title="Run events" className={className}>
    <ControlAction label={cutoff ? "Follow latest" : "Pause following"}
      onClick={() => setCutoff(cutoff ? null : new Set(events.map((item) => item.id)))} />
    {cutoff && <p role="status" className="text-sm text-muted-foreground">{events.length - visible.length} new events</p>}
    <div ref={viewport} role="log" aria-label="Run event stream" className="max-h-72 overflow-y-auto">
      <ItemList items={visible} empty="No run events." render={(item) => <ItemHeading title={item.title}
        detail={[item.timestamp,item.detail].filter(Boolean).join(" · ")}>
        <ControlAction label="Open event" item={item.title} onClick={onOpen && (() => onOpen(item.id))} />
      </ItemHeading>} />
    </div>
  </ControlPanel>;
}
