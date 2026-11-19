// packages/ai-ui/src/experimental/breakpoint-list.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading, ItemList } from "../lib/component-controls.js";
import type { EditorSourceLocation } from "./editor-symbol-outline.js";

export interface SourceBreakpoint extends EditorSourceLocation { id: string; enabled: boolean; condition?: string }
export interface BreakpointListProps {
  breakpoints: readonly SourceBreakpoint[];
  onEnabledChange?: (id: string, enabled: boolean) => void;
  onEdit?: (id: string) => void;
  onRemove?: (id: string) => void;
  pendingIds?: readonly string[];
  className?: string;
}
export function BreakpointList({ breakpoints, onEnabledChange, onEdit, onRemove, pendingIds = [], className }: BreakpointListProps) {
  return <ControlPanel slot="breakpoint-list" title="Breakpoints" className={className}>
    <ItemList items={breakpoints} empty="No breakpoints." render={(item) => {
      const location = item.file + ":" + item.line;
      const busy = pendingIds.includes(item.id);
      return <ItemHeading title={location} detail={item.condition ?? (item.enabled ? "Enabled" : "Disabled")}>
        {onEnabledChange && <label className="text-sm"><input type="checkbox" checked={item.enabled} disabled={busy}
          onChange={(event) => onEnabledChange(item.id, event.currentTarget.checked)} aria-label={"Enable breakpoint " + location} /> Enabled</label>}
        <ControlAction label="Edit" item={location} disabled={busy} onClick={onEdit && (() => onEdit(item.id))} />
        <ControlAction label="Remove" item={location} disabled={busy} onClick={onRemove && (() => onRemove(item.id))} />
      </ItemHeading>;
    }} />
  </ControlPanel>;
}
