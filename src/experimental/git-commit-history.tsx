// packages/ai-ui/src/experimental/git-commit-history.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading } from "../lib/component-controls.js";
import { FilteredList } from "../lib/collection-controls.js";
export interface GitHistoryCommit { id: string; summary: string; author: string; timestamp: string; ref?: string }

export interface GitCommitHistoryProps {
  commits: readonly GitHistoryCommit[];
  onOpen: (id: string) => void;
  onCompare?: (id: string) => void;
  className?: string;
}

export function GitCommitHistory({ commits, onOpen, onCompare, className }: GitCommitHistoryProps) {
  return <ControlPanel slot="git-commit-history" title="Commit history" className={className}>
    <FilteredList items={commits} searchLabel="Search commits" searchText={(item) => [item.id,item.summary,item.author,item.ref]}
      empty="No matching commits." render={(item) => <ItemHeading title={item.summary} detail={[item.ref ?? item.id,item.author,item.timestamp].join(" · ")}>
        <ControlAction label="Open commit" item={item.summary} onClick={() => onOpen(item.id)} />
        <ControlAction label="Compare commit" item={item.summary} onClick={onCompare && (() => onCompare(item.id))} />
      </ItemHeading>} />
  </ControlPanel>;
}
