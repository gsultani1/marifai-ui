// packages/ai-ui/src/components/git-blame-panel.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading, ItemList } from "../lib/component-controls.js";

export interface GitBlameRange { id: string; startLine: number; endLine: number; author: string; commitId: string; summary?: string }

export interface GitBlamePanelProps {
  file: string;
  ranges: readonly GitBlameRange[];
  onOpenCommit: (id: string) => void;
  className?: string;
}

export function GitBlamePanel({ file, ranges, onOpenCommit, className }: GitBlamePanelProps) {
  return <ControlPanel slot="git-blame-panel" title="Line attribution" className={className}>
    <p className="text-sm break-all">{file}</p>
    <ItemList items={ranges} empty="No line attribution." render={(item) => <ItemHeading
      title={item.startLine === item.endLine ? "Line " + item.startLine : "Lines " + item.startLine + "–" + item.endLine}
      detail={[item.author,item.summary,item.commitId].filter(Boolean).join(" · ")}>
      <ControlAction label="Open commit" item={item.id} onClick={() => onOpenCommit(item.commitId)} />
    </ItemHeading>} />
  </ControlPanel>;
}
