// packages/ai-ui/src/components/citation-navigator.tsx
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
  if (!citations.length) {
    return <ControlPanel slot="citation-navigator" title="Citations" className={className}>
      <p className="text-sm text-muted-foreground">No citations.</p>
    </ControlPanel>;
  }
  return <ControlPanel slot="citation-navigator" title="Citations" className={className}>
    {/* A citation cannot be cleared, so the prompt is offered only until one is chosen. */}
    <ChoiceField label="Citation" value={selected?.id ?? ""} {...(selected ? {} : { placeholder: "Choose a citation" })}
      options={citations.map((item) => ({ label: item.title, value: item.id }))}
      onChange={(id) => { if (id) onChange(id); }} />
    {/* Previous and Next change the citation without moving focus, so the new position is announced. */}
    <div aria-live="polite" className="space-y-1">
      <p className="text-xs text-muted-foreground">
        {selected
          ? <>Citation {index + 1} of {citations.length}<span className="sr-only">: {selected.title}</span></>
          : citations.length === 1 ? "1 citation" : citations.length + " citations"}
      </p>
      {selected?.excerpt && <p className="text-sm break-words">{selected.excerpt}</p>}
    </div>
    <div className="flex flex-wrap gap-2">
      <ControlAction label="Previous citation" disabled={!previous} onClick={() => { if (previous) onChange(previous.id); }} />
      <ControlAction label="Next citation" disabled={!next} onClick={() => { if (next) onChange(next.id); }} />
      <ControlAction label="Open source" disabled={!selected} onClick={() => { if (selected) onOpen(selected.id); }} />
    </div>
  </ControlPanel>;
}
