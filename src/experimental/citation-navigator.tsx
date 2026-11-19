// packages/ai-ui/src/experimental/citation-navigator.tsx
"use client";

import { ChoiceField, ControlAction, ControlPanel } from "../lib/component-controls.js";

export interface NavigableCitation { id: string; title: string; excerpt?: string }

export interface CitationNavigatorProps {
  citations: readonly NavigableCitation[];
  activeId: string | null;
  onChange: (id: string) => void;
  onOpen: (id: string) => void;
  className?: string;
}

export function CitationNavigator({ citations, activeId, onChange, onOpen, className }: CitationNavigatorProps) {
  const index = citations.findIndex((item) => item.id === activeId);
  const selected = citations[index];
  const previous = index > 0 ? citations[index - 1] : undefined;
  const next = citations[index + 1];
  return <ControlPanel slot="citation-navigator" title="Citations" className={className}>
    <ChoiceField label="Citation" value={selected?.id ?? ""} placeholder="Choose a citation"
      options={citations.map((item) => ({ label: item.title, value: item.id }))}
      onChange={(id) => { if (id) onChange(id); }} />
    {selected?.excerpt && <p className="text-sm break-words">{selected.excerpt}</p>}
    <div className="flex flex-wrap gap-2">
      <ControlAction label="Previous citation" disabled={!previous} onClick={() => { if (previous) onChange(previous.id); }} />
      <ControlAction label="Next citation" disabled={!next} onClick={() => { if (next) onChange(next.id); }} />
      <ControlAction label="Open source" disabled={!selected} onClick={() => { if (selected) onOpen(selected.id); }} />
    </div>
  </ControlPanel>;
}
