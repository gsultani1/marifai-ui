// packages/ai-ui/src/experimental/browser-console-panel.tsx
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

export function BrowserConsolePanel({ entries, onOpenSource, className }: BrowserConsolePanelProps) {
  return <ControlPanel slot="browser-console-panel" title="Browser console" className={className}>
    <FilteredList items={entries} searchLabel="Search console" searchText={(item) => [item.text, item.source?.address]}
      filterLabel="Level" filters={["debug", "info", "warning", "error"].map((value) => ({ value, label: value }))}
      category={(item) => item.level} empty="No matching console entries." render={(item) => {
        const source = item.source;
        return <ItemHeading title={item.text} detail={item.level + (source ? " · " + source.address + ":" + source.line : "")}>
          <ControlAction label="Open source" item={item.text} onClick={onOpenSource && source && (() => onOpenSource(source))} />
        </ItemHeading>;
      }} />
  </ControlPanel>;
}
