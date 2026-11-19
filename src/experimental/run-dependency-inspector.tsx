// packages/ai-ui/src/experimental/run-dependency-inspector.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading, ItemList } from "../lib/component-controls.js";

export interface InspectedRunDependency { id: string; label: string; status: string; blockingReason?: string }

export interface RunDependencyInspectorProps {
  node: InspectedRunDependency;
  prerequisites: readonly InspectedRunDependency[];
  dependents: readonly InspectedRunDependency[];
  onSelect?: (id: string) => void;
  className?: string;
}

export function RunDependencyInspector({ node, prerequisites, dependents, onSelect, className }: RunDependencyInspectorProps) {
  return <ControlPanel slot="run-dependency-inspector" title="Run dependencies" className={className}>
    <ItemHeading title={node.label} detail={[node.status,node.blockingReason].filter(Boolean).join(" · ")} />
    {([{label:"Prerequisites",items:prerequisites},{label:"Dependents",items:dependents}]).map(({label,items}) => <div key={label} className="space-y-1">
      <h4 className="text-sm font-medium">{label}</h4>
      <ItemList items={items} empty={"No " + label.toLowerCase() + "."} render={(item) => <ItemHeading title={item.label}
        detail={[item.status,item.blockingReason].filter(Boolean).join(" · ")}>
        <ControlAction label="Inspect" item={item.label} onClick={onSelect && (() => onSelect(item.id))} />
      </ItemHeading>} />
    </div>)}
  </ControlPanel>;
}
