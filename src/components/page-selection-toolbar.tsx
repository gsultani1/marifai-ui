// packages/ai-ui/src/components/page-selection-toolbar.tsx
"use client";

import { ControlAction, ControlPanel, contentBlock } from "../lib/component-controls.js";
import { CopyButton } from "./copy-button.js";

export interface PageSelectionToolbarProps {
  selection: string;
  onQuote?: (text: string) => void;
  onAttach?: (text: string) => void;
  className?: string;
}

export function PageSelectionToolbar({ selection, onQuote, onAttach, className }: PageSelectionToolbarProps) {
  return <ControlPanel slot="page-selection-toolbar" title="Page selection" className={className}>
    {selection.trim() ? <>
      <blockquote className={contentBlock}>{selection}</blockquote>
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton value={selection} label="Copy selection" />
        <ControlAction label="Quote selection" onClick={onQuote && (() => onQuote(selection))} />
        <ControlAction label="Add selection to context" onClick={onAttach && (() => onAttach(selection))} />
      </div>
    </> : <p className="text-sm text-muted-foreground">Select text on a page to use it here.</p>}
  </ControlPanel>;
}
