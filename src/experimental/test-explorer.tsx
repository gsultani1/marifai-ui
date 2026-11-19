// packages/ai-ui/src/experimental/test-explorer.tsx
"use client";

import { FilteredList } from "../lib/collection-controls.js";
import { ControlAction, ControlPanel, ItemHeading } from "../lib/component-controls.js";

export type TestOutcome = "idle" | "running" | "passed" | "failed" | "skipped";
export interface TestExplorerEntry { id: string; name: string; kind: "test" | "suite"; parentName?: string; outcome: TestOutcome }
export interface TestExplorerProps {
  tests: readonly TestExplorerEntry[];
  onRun?: (id: string, kind: TestExplorerEntry["kind"]) => void;
  pendingIds?: readonly string[];
  className?: string;
}
const outcomes: readonly TestOutcome[] = ["idle", "running", "passed", "failed", "skipped"];
export function TestExplorer({ tests, onRun, pendingIds = [], className }: TestExplorerProps) {
  return <ControlPanel slot="test-explorer" title="Test explorer" className={className}>
    <FilteredList items={tests} searchLabel="Search tests" searchText={(item) => [item.name, item.parentName]}
      filterLabel="Outcome" filters={outcomes.map((value) => ({ value, label: value }))} category={(item) => item.outcome}
      empty="No matching tests." render={(item) => <ItemHeading title={item.name} detail={[item.parentName, item.outcome].filter(Boolean).join(" · ")}>
        <ControlAction label={item.kind === "suite" ? "Run suite" : "Run test"} item={item.name}
          disabled={item.outcome === "running" || pendingIds.includes(item.id)} onClick={onRun && (() => onRun(item.id, item.kind))} />
      </ItemHeading>} />
  </ControlPanel>;
}
