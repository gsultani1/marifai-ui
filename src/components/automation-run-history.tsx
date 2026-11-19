// packages/ai-ui/src/components/automation-run-history.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading } from "../lib/component-controls.js";
import { FilteredList } from "../lib/collection-controls.js";
export interface AutomationHistoryRun { id: string; title: string; startedAt: string; status: string; detail?: string }

export interface AutomationRunHistoryProps {
  runs: readonly AutomationHistoryRun[];
  onOpen: (id: string) => void;
  className?: string;
}

export function AutomationRunHistory({ runs, onOpen, className }: AutomationRunHistoryProps) {
  return <ControlPanel slot="automation-run-history" title="Automation run history" className={className}>
    <FilteredList items={runs} searchLabel="Search runs" searchText={(item) => [item.title, item.startedAt, item.detail]}
      filterLabel="Run status" filters={[...new Set(runs.map((item) => item.status))].map((value) => ({ value, label: value }))}
      category={(item) => item.status} empty={runs.length ? "No matching runs." : "No runs yet."} render={(item) => <ItemHeading title={item.title}
        detail={[item.startedAt, item.status, item.detail].filter(Boolean).join(" · ")}>
        <ControlAction label="Open run" item={item.title} onClick={() => onOpen(item.id)} />
      </ItemHeading>} />
  </ControlPanel>;
}
