// packages/ai-ui/src/components/browser-page-diff.tsx
"use client";

import { useState } from "react";
import { ChoiceField, ControlPanel } from "../lib/component-controls.js";
import { DiffView } from "./diff-view.js";
export interface BrowserPageSnapshot { label: string; text: string }

export interface BrowserPageDiffProps {
  before: BrowserPageSnapshot;
  after: BrowserPageSnapshot;
  className?: string;
}

export function BrowserPageDiff({ before, after, className }: BrowserPageDiffProps) {
  const [mode, setMode] = useState<"unified" | "split">("unified");
  return <ControlPanel slot="browser-page-diff" title="Page changes" className={className}>
    {before.text === after.text ? <p className="text-sm text-muted-foreground">No changes between {before.label} and {after.label}.</p> : <>
      <ChoiceField label="Diff layout" value={mode} options={[{ value: "unified", label: "Unified" }, { value: "split", label: "Side by side" }]}
        onChange={(value) => { if (value) setMode(value); }} />
      <DiffView oldTitle={before.label} oldValue={before.text} newTitle={after.label} newValue={after.text} mode={mode} label={"Changes from " + before.label + " to " + after.label} />
    </>}
  </ControlPanel>;
}
