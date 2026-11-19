// packages/ai-ui/src/experimental/assistant-contact-picker.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading } from "../lib/component-controls.js";
import { FilteredList } from "../lib/collection-controls.js";
export interface AssistantContactOption { id: string; label: string; kind: "person" | "group"; detail?: string }

export interface AssistantContactPickerProps {
  contacts: readonly AssistantContactOption[];
  value?: string | null;
  onSelect: (id: string, kind: AssistantContactOption["kind"]) => void;
  className?: string;
}

export function AssistantContactPicker({ contacts, value, onSelect, className }: AssistantContactPickerProps) {
  return <ControlPanel slot="assistant-contact-picker" title="Contacts" className={className}>
    <FilteredList items={contacts} searchLabel="Search contacts" searchText={(item) => [item.label, item.detail]}
      filterLabel="Contact type" filters={[{ value: "person", label: "People" }, { value: "group", label: "Groups" }]} category={(item) => item.kind}
      empty="No matching contacts." render={(item) => <ItemHeading title={item.label} detail={[item.kind, item.detail].filter(Boolean).join(" · ")}>
        <ControlAction label={value === item.id ? "Selected" : "Select"} item={item.label} disabled={value === item.id} onClick={() => onSelect(item.id, item.kind)} />
      </ItemHeading>} />
  </ControlPanel>;
}
