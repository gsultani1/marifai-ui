// packages/ai-ui/src/experimental/tool-registry-picker.tsx
"use client";

import { useState } from "react";
import { ChoiceField, ControlPanel, ItemHeading, ItemList, matchesQuery, SearchField } from "../lib/component-controls.js";

export interface RegistryTool { id: string; name: string; description?: string; capabilities: readonly string[]; unavailableReason?: string }

export interface ToolRegistryPickerProps {
  tools: readonly RegistryTool[];
  selectedIds: readonly string[];
  onSelectionChange: (id: string, selected: boolean) => void;
  className?: string;
}

export function ToolRegistryPicker({ tools, selectedIds, onSelectionChange, className }: ToolRegistryPickerProps) {
  const [query, setQuery] = useState("");
  const [capability, setCapability] = useState("");
  const capabilities = [...new Set(tools.flatMap((item) => item.capabilities))].sort();
  const active = capabilities.includes(capability) ? capability : "";
  const visible = tools.filter((item) => matchesQuery(query, item.name, item.description, ...item.capabilities) && (!active || item.capabilities.includes(active)));
  return <ControlPanel slot="tool-registry-picker" title="Tool registry" className={className}>
    <SearchField label="Search tools" value={query} onChange={setQuery} />
    <ChoiceField label="Capability" value={active} placeholder="All" options={capabilities.map((value) => ({ value, label: value }))} onChange={setCapability} />
    <ItemList items={visible} empty="No matching tools." render={(item) => <ItemHeading title={item.name}
      detail={[item.description, item.capabilities.join(", "), item.unavailableReason].filter(Boolean).join(" · ")}>
      <label className="text-sm"><input type="checkbox" aria-label={"Select " + item.name} checked={selectedIds.includes(item.id)}
        disabled={Boolean(item.unavailableReason)} onChange={(event) => onSelectionChange(item.id, event.currentTarget.checked)} /> Select</label>
    </ItemHeading>} />
  </ControlPanel>;
}
