// packages/ai-ui/src/experimental/code-reference-list.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading, ItemList } from "../lib/component-controls.js";
import type { EditorSourceLocation } from "./editor-symbol-outline.js";
export interface CodeReference { id: string; start: EditorSourceLocation; end?: EditorSourceLocation; excerpt?: string }

export interface CodeReferenceListProps {
  references: readonly CodeReference[];
  onOpen: (start: EditorSourceLocation, end?: EditorSourceLocation) => void;
  className?: string;
}

export function CodeReferenceList({ references, onOpen, className }: CodeReferenceListProps) {
  const groups = new Map<string,CodeReference[]>();
  for (const item of references) {
    const group = groups.get(item.start.file) ?? [];
    group.push(item);
    groups.set(item.start.file,group);
  }
  return <ControlPanel slot="code-reference-list" title="Code references" className={className}>
    {groups.size ? [...groups].map(([file,items]) => <details key={file} open className="space-y-2">
      <summary className="cursor-pointer text-sm font-medium break-all">{file} · {items.length}</summary>
      <ItemList items={items} empty="No references." render={(item) => <ItemHeading
        title={"Line " + item.start.line + (item.start.column === undefined ? "" : ":" + item.start.column)} detail={item.excerpt}>
        <ControlAction label="Open reference" item={item.id} onClick={() => onOpen(item.start,item.end)} />
      </ItemHeading>} />
    </details>) : <p className="text-sm text-muted-foreground">No references.</p>}
  </ControlPanel>;
}
