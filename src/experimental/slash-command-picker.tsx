// packages/ai-ui/src/experimental/slash-command-picker.tsx
"use client";

import { ControlPanel, ItemHeading, ControlAction } from "../lib/component-controls.js";
import { FilteredList } from "../lib/collection-controls.js";
export interface SlashCommand { id: string; name: string; description?: string; parameters?: readonly string[] }

export interface SlashCommandPickerProps {
  commands: readonly SlashCommand[];
  onSelect: (id: string, command: string) => void;
  className?: string;
}

export function SlashCommandPicker({ commands, onSelect, className }: SlashCommandPickerProps) {
  return <ControlPanel slot="slash-command-picker" title="Slash commands" className={className}>
    <FilteredList items={commands} searchLabel="Filter commands" searchText={(item) => [item.name,item.description,...item.parameters ?? []]}
      empty="No matching commands." render={(item) => {
        const command = "/" + item.name.replace(/^\/+/, "");
        return <ItemHeading title={command} detail={[item.description,item.parameters?.join(" ")].filter(Boolean).join(" · ")}>
          <ControlAction label="Insert" item={command} onClick={() => onSelect(item.id,command)} />
        </ItemHeading>;
      }} />
  </ControlPanel>;
}
