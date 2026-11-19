// packages/ai-ui/src/components/tool-result-compare.tsx
"use client";

import { useState } from "react";
import { ChoiceField, ControlPanel, comparisonGrid, contentBlock } from "../lib/component-controls.js";
import { DiffView } from "./diff-view.js";
export interface ComparableToolResult { label: string; text: string }

export interface ToolResultCompareProps {
  left: ComparableToolResult;
  right: ComparableToolResult;
  className?: string;
}

export function ToolResultCompare({ left, right, className }: ToolResultCompareProps) {
  const [mode,setMode] = useState<"raw" | "diff">("diff");
  return <ControlPanel slot="tool-result-compare" title="Compare tool results" className={className}>
    <ChoiceField label="Result view" value={mode} options={[{value:"raw",label:"Raw"},{value:"diff",label:"Diff"}]} onChange={(value) => { if (value) setMode(value); }} />
    {mode === "diff" ? <DiffView oldValue={left.text} newValue={right.text} oldTitle={left.label} newTitle={right.label} />
      : <div className={comparisonGrid}>{[left,right].map((item,index) => <div key={index}><h4 className="text-sm font-medium">{item.label}</h4>
        <pre className={contentBlock}>{item.text}</pre></div>)}</div>}
  </ControlPanel>;
}
