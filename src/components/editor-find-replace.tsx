// packages/ai-ui/src/components/editor-find-replace.tsx
"use client";

import { ControlAction, ControlPanel, Field, fieldClass } from "../lib/component-controls.js";

export interface EditorSearchOptions { query: string; replacement: string; matchCase: boolean; wholeWord: boolean }
export interface EditorFindReplaceProps {
  value: EditorSearchOptions;
  onChange: (value: EditorSearchOptions) => void;
  matches: number;
  onMove: (direction: "previous" | "next") => void;
  onReplace?: (scope: "one" | "all", value: EditorSearchOptions) => void;
  pending?: boolean;
  className?: string;
}
export function EditorFindReplace({ value, onChange, matches, onMove, onReplace, pending, className }: EditorFindReplaceProps) {
  const disabled = Boolean(pending) || !value.query || matches < 1;
  return <ControlPanel slot="editor-find-replace" title="Find and replace" className={className}>
    <Field label="Find"><input className={fieldClass} value={value.query} onChange={(event) => onChange({ ...value, query: event.currentTarget.value })} /></Field>
    {onReplace && <Field label="Replace with"><input className={fieldClass} value={value.replacement} onChange={(event) => onChange({ ...value, replacement: event.currentTarget.value })} /></Field>}
    <div className="flex flex-wrap gap-3 text-sm">
      <label><input type="checkbox" checked={value.matchCase} onChange={(event) => onChange({ ...value, matchCase: event.currentTarget.checked })} /> Match case</label>
      <label><input type="checkbox" checked={value.wholeWord} onChange={(event) => onChange({ ...value, wholeWord: event.currentTarget.checked })} /> Whole word</label>
    </div>
    <p role="status" className="text-sm text-muted-foreground">
      {pending ? "Searching…" : !value.query ? "Enter text to find." : matches === 1 ? "1 match" : matches + " matches"}
    </p>
    <div className="flex flex-wrap gap-2">
      <ControlAction label="Previous match" disabled={disabled} onClick={() => onMove("previous")} />
      <ControlAction label="Next match" disabled={disabled} onClick={() => onMove("next")} />
      <ControlAction label="Replace next" disabled={disabled} onClick={onReplace && (() => onReplace("one", value))} />
      <ControlAction label="Replace all" disabled={disabled} onClick={onReplace && (() => onReplace("all", value))} />
    </div>
  </ControlPanel>;
}
