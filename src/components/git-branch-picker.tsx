// packages/ai-ui/src/components/git-branch-picker.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading } from "../lib/component-controls.js";
import { FilteredList } from "../lib/collection-controls.js";
export interface GitBranchOption { id: string; name: string; scope: "local" | "remote"; current?: boolean; unavailableReason?: string }

export interface GitBranchPickerProps {
  branches: readonly GitBranchOption[];
  onCheckout: (id: string) => void;
  pendingIds?: readonly string[];
  className?: string;
}

export function GitBranchPicker({ branches, onCheckout, pendingIds = [], className }: GitBranchPickerProps) {
  return <ControlPanel slot="git-branch-picker" title="Git branches" className={className}>
    <FilteredList items={branches} searchLabel="Search branches" searchText={(item) => [item.name]}
      filterLabel="Branch scope" filters={[{value:"local",label:"Local"},{value:"remote",label:"Remote"}]} category={(item) => item.scope}
      empty="No matching branches." render={(item) => <ItemHeading title={item.name} detail={[item.scope,item.current ? "Current branch" : null,item.unavailableReason].filter(Boolean).join(" · ")}>
        <ControlAction label="Check out" item={item.name} disabled={item.current || Boolean(item.unavailableReason) || pendingIds.includes(item.id)} onClick={() => onCheckout(item.id)} />
      </ItemHeading>} />
  </ControlPanel>;
}
