// packages/ai-ui/src/components/open-tab-picker.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading } from "../lib/component-controls.js";
import { FilteredList } from "../lib/collection-controls.js";
export interface OpenBrowserTab { id: string; title: string; address: string; window: string }

export interface OpenTabPickerProps {
  tabs: readonly OpenBrowserTab[];
  onOpen?: (id: string) => void;
  onAttach?: (id: string) => void;
  attachedIds?: readonly string[];
  className?: string;
}

export function OpenTabPicker({ tabs, onOpen, onAttach, attachedIds = [], className }: OpenTabPickerProps) {
  return <ControlPanel slot="open-tab-picker" title="Open tabs" className={className}>
    <FilteredList items={tabs} searchLabel="Search open tabs" searchText={(item) => [item.title, item.address, item.window]}
      filterLabel="Window" filters={[...new Set(tabs.map((item) => item.window))].map((value) => ({ value, label: value }))}
      category={(item) => item.window} empty="No matching tabs." render={(item) => <ItemHeading title={item.title} detail={item.window + " · " + item.address}>
        <ControlAction label="Open" item={item.title} onClick={onOpen && (() => onOpen(item.id))} />
        <ControlAction label={attachedIds.includes(item.id) ? "Attached" : "Attach"} item={item.title}
          disabled={attachedIds.includes(item.id)} onClick={onAttach && (() => onAttach(item.id))} />
      </ItemHeading>} />
  </ControlPanel>;
}
