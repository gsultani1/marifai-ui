// packages/ai-ui/src/components/editor-symbol-outline.tsx
"use client";

import { LabeledTree } from "../lib/collection-controls.js";
import { ControlPanel } from "../lib/component-controls.js";

export interface EditorSourceLocation { file: string; line: number; column?: number }
export interface EditorSymbol {
  id: string;
  label: string;
  kind: string;
  start: EditorSourceLocation;
  end?: EditorSourceLocation;
  children?: readonly EditorSymbol[];
}
export interface EditorSymbolOutlineProps {
  symbols: readonly EditorSymbol[];
  activeId?: string | null;
  onOpen: (start: EditorSourceLocation, end?: EditorSourceLocation) => void;
  className?: string;
}
export function EditorSymbolOutline({ symbols, activeId, onOpen, className }: EditorSymbolOutlineProps) {
  function open(items: readonly EditorSymbol[], id: string): boolean {
    for (const item of items) {
      if (item.id === id) { onOpen(item.start, item.end); return true; }
      if (item.children && open(item.children, id)) return true;
    }
    return false;
  }
  return <ControlPanel slot="editor-symbol-outline" title="Symbol outline" className={className}>
    {symbols.length
      ? <LabeledTree items={symbols} label="Symbols" activeId={activeId ?? null} detail={(item) => item.kind} searchable onSelect={(id) => { open(symbols, id); }} />
      : <p className="text-sm text-muted-foreground">No symbols in this file.</p>}
  </ControlPanel>;
}
