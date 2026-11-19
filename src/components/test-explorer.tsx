// packages/ai-ui/src/components/test-explorer.tsx
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
const outcomeLabels: Record<TestOutcome, string> = { idle: "Not run", running: "Running", passed: "Passed", failed: "Failed", skipped: "Skipped" };
export function TestExplorer({ tests, onRun, pendingIds = [], className }: TestExplorerProps) {
  const cases = tests.filter((item) => item.kind === "test");
  const summary = outcomes.map((outcome) => [outcome, cases.filter((item) => item.outcome === outcome).length] as const)
    .filter(([, count]) => count > 0).map(([outcome, count]) => count + " " + outcomeLabels[outcome].toLowerCase()).join(", ");
  return <ControlPanel slot="test-explorer" title="Test explorer" className={className}>
    {/* Outcomes change after a run; the polite summary tells screen reader users without moving focus. */}
    <p role="status" className="text-sm text-muted-foreground empty:hidden">{cases.length ? cases.length + (cases.length === 1 ? " test: " : " tests: ") + summary : null}</p>
    <FilteredList items={tests} searchLabel="Search tests" searchText={(item) => [item.name, item.parentName]}
      filterLabel="Outcome" filters={outcomes.map((value) => ({ value, label: outcomeLabels[value] }))} category={(item) => item.outcome}
      empty="No matching tests." render={(item) => {
        const busy = pendingIds.includes(item.id);
        return <ItemHeading title={item.name} detail={[item.parentName, outcomeLabels[item.outcome], busy && "Starting…"].filter(Boolean).join(" · ")}>
          <ControlAction label={item.kind === "suite" ? "Run suite" : "Run test"} item={item.parentName ? item.name + " in " + item.parentName : item.name}
            disabled={item.outcome === "running" || busy} onClick={onRun && (() => onRun(item.id, item.kind))} />
        </ItemHeading>;
      }} />
  </ControlPanel>;
}
