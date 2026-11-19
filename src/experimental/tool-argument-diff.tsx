// packages/ai-ui/src/experimental/tool-argument-diff.tsx
"use client";

import { ControlPanel, ItemList } from "../lib/component-controls.js";
import { DiffView } from "../components/diff-view.js";
export interface ToolArgumentChange { id: string; key: string; before?: string; after?: string }

export interface ToolArgumentDiffProps {
  changes: readonly ToolArgumentChange[];
  className?: string;
}

export function ToolArgumentDiff({ changes, className }: ToolArgumentDiffProps) {
  return <ControlPanel slot="tool-argument-diff" title="Argument changes" className={className}>
    <ItemList items={changes} empty="No argument changes." render={(item) => <>
      <h4 className="text-sm font-medium break-words">{item.key} · {item.before === undefined ? "Added" : item.after === undefined ? "Removed" : "Changed"}</h4>
      <DiffView oldValue={item.before ?? ""} newValue={item.after ?? ""} />
    </>} />
  </ControlPanel>;
}
