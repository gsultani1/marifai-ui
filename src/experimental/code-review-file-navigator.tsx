// packages/ai-ui/src/experimental/code-review-file-navigator.tsx
"use client";

import { useState } from "react";
import { ControlAction, ControlPanel, ItemHeading, ItemList } from "../lib/component-controls.js";

export interface CodeReviewFile { id: string; path: string; reviewed: boolean }

export interface CodeReviewFileNavigatorProps {
  files: readonly CodeReviewFile[];
  activeId: string | null;
  onOpen: (id: string) => void;
  className?: string;
}

export function CodeReviewFileNavigator({ files, activeId, onOpen, className }: CodeReviewFileNavigatorProps) {
  const [unreviewed, setUnreviewed] = useState(false);
  const index = files.findIndex((file) => file.id === activeId);
  const next = files.slice(index+1).find((file) => !file.reviewed) ?? files.slice(0,Math.max(index,0)).find((file) => !file.reviewed);
  return <ControlPanel slot="code-review-file-navigator" title="Files to review" className={className}>
    <label className="text-sm"><input type="checkbox" checked={unreviewed} onChange={(event) => setUnreviewed(event.currentTarget.checked)} /> Unreviewed only</label>
    <ControlAction label="Next unreviewed file" disabled={!next} onClick={() => { if (next) onOpen(next.id); }} />
    <ItemList items={files.filter((file) => !unreviewed || !file.reviewed)} empty="No matching files." render={(item) => <ItemHeading title={item.path}
      detail={(item.reviewed ? "Reviewed" : "Unreviewed") + (item.id === activeId ? " · Current" : "")}>
      <ControlAction label="Open file" item={item.path} onClick={() => onOpen(item.id)} />
    </ItemHeading>} />
  </ControlPanel>;
}
