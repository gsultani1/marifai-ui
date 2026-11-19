// packages/ai-ui/src/components/tool-resource-picker.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading } from "../lib/component-controls.js";
import { FilteredList } from "../lib/collection-controls.js";
export interface ToolResourceOption { id: string; title: string; address: string; description?: string }

export interface ToolResourcePickerProps {
  resources: readonly ToolResourceOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}

export function ToolResourcePicker({ resources, selectedId, onSelect, className }: ToolResourcePickerProps) {
  return <ControlPanel slot="tool-resource-picker" title="Tool resources" className={className}>
    <FilteredList items={resources} searchLabel="Search resources" searchText={(item) => [item.title, item.address, item.description]}
      empty={resources.length ? "No matching resources." : "No resources available."} render={(item) => <>
        <ItemHeading title={item.title} detail={item.address}>
          <ControlAction label={selectedId === item.id ? "Selected" : "Select"} item={item.title}
            disabled={selectedId === item.id} onClick={() => onSelect(item.id)} />
        </ItemHeading>
        {item.description && <p className="text-sm break-words">{item.description}</p>}
      </>} />
  </ControlPanel>;
}
