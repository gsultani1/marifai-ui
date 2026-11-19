// packages/ai-ui/src/components/page-find-bar.tsx
"use client";

import { ControlAction, ControlPanel, SearchField } from "../lib/component-controls.js";

export interface PageFindBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  /** The current match is one-based, or null when none is selected. */
  currentMatch: number | null;
  matchCount: number;
  onMove: (direction: "previous" | "next") => void;
  onClose?: () => void;
  pending?: boolean;
  className?: string;
}

export function PageFindBar({ query, onQueryChange, currentMatch, matchCount, onMove, onClose, pending, className }: PageFindBarProps) {
  const disabled = !query.trim() || Boolean(pending) || matchCount < 1;
  return <ControlPanel slot="page-find-bar" title="Find on page" className={className}>
    <div onKeyDown={(event) => {
      if (event.key === "Enter" && event.target instanceof HTMLInputElement && !disabled) {
        event.preventDefault();
        onMove(event.shiftKey ? "previous" : "next");
      }
    }}>
      <SearchField label="Find text" value={query} onChange={onQueryChange} />
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <span role="status" className="text-sm text-muted-foreground">{pending ? "Searching…" : query.trim() ? currentMatch !== null ? currentMatch + " of " + matchCount : matchCount + " matches" : ""}</span>
      <ControlAction label="Previous match" disabled={disabled} onClick={() => onMove("previous")} />
      <ControlAction label="Next match" disabled={disabled} onClick={() => onMove("next")} />
      <ControlAction label="Close find bar" onClick={onClose} />
    </div>
  </ControlPanel>;
}
