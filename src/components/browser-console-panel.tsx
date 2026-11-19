// packages/ai-ui/src/components/browser-console-panel.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading } from "../lib/component-controls.js";
import { FilteredList } from "../lib/collection-controls.js";
export interface BrowserConsoleSource { address: string; line: number; column?: number }
export interface BrowserConsoleEntry { id: string; level: "debug" | "info" | "warning" | "error"; text: string; source?: BrowserConsoleSource }

export interface BrowserConsolePanelProps {
  entries: readonly BrowserConsoleEntry[];
  onOpenSource?: (source: BrowserConsoleSource) => void;
  className?: string;
}

const levels: Record<BrowserConsoleEntry["level"], string> = { debug: "Debug", info: "Info", warning: "Warning", error: "Error" };
const levelFilters = Object.entries(levels).map(([value, label]) => ({ value, label }));

function location(source: BrowserConsoleSource) {
  return source.address + ":" + source.line + (source.column === undefined ? "" : ":" + source.column);
}

export function BrowserConsolePanel({ entries, onOpenSource, className }: BrowserConsolePanelProps) {
  return <ControlPanel slot="browser-console-panel" title="Browser console" className={className}>
    <FilteredList items={entries} searchLabel="Search console" searchText={(item) => [item.text, item.source?.address]}
      filterLabel="Level" filters={levelFilters}
      category={(item) => item.level} empty={entries.length ? "No matching console entries." : "The console is empty."} render={(item) => {
        const source = item.source;
        return <ItemHeading title={item.text} detail={levels[item.level] + (source ? " · " + location(source) : "")}>
          <ControlAction label="Open source" item={item.text} onClick={onOpenSource && source && (() => onOpenSource(source))} />
        </ItemHeading>;
      }} />
  </ControlPanel>;
}
