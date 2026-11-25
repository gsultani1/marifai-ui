// packages/ai-ui/src/components/editor-location-history.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading, ItemList } from "../lib/component-controls.js";
import type { EditorSourceLocation } from "./editor-symbol-outline.js";

export interface EditorLocationEntry extends EditorSourceLocation { id: string; title?: string }
export interface EditorLocationHistoryProps {
  entries: readonly EditorLocationEntry[];
  activeId: string | null;
  onOpen: (location: EditorLocationEntry) => void;
  className?: string;
}
export function EditorLocationHistory({ entries, activeId, onOpen, className }: EditorLocationHistoryProps) {
  const index = entries.findIndex((item) => item.id === activeId);
  const previous = index > 0 ? entries[index - 1] : undefined;
  const next = index >= 0 ? entries[index + 1] : undefined;
  return <ControlPanel slot="editor-location-history" title="Editor history" className={className}>
    <div className="flex flex-wrap gap-2">
      <ControlAction label="Previous location" disabled={!previous} onClick={() => { if (previous) onOpen(previous); }} />
      <ControlAction label="Next location" disabled={!next} onClick={() => { if (next) onOpen(next); }} />
    </div>
    <ItemList items={entries} empty="No recorded locations." render={(item) => {
      const location = item.file + ":" + item.line + (item.column === undefined ? "" : ":" + item.column);
      return <ItemHeading title={item.title ?? item.file} detail={location + (item.id === activeId ? " · Current" : "")}>
        <ControlAction label="Open location" item={item.title ? item.title + " " + location : location} onClick={() => onOpen(item)} />
      </ItemHeading>;
    }} />
  </ControlPanel>;
}
