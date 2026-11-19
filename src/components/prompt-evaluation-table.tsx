// packages/ai-ui/src/components/prompt-evaluation-table.tsx
"use client";

import { useState } from "react";
import { ChoiceField, ControlAction, ControlPanel } from "../lib/component-controls.js";

export interface PromptEvaluation { id: string; name: string; expected: string; actual: string; result: "passed" | "failed" | "pending" }

export interface PromptEvaluationTableProps {
  evaluations: readonly PromptEvaluation[];
  onOpen?: (id: string) => void;
  className?: string;
}

export function PromptEvaluationTable({ evaluations, onOpen, className }: PromptEvaluationTableProps) {
  const [result, setResult] = useState("");
  const rows = evaluations.filter((item) => !result || item.result === result);
  return <ControlPanel slot="prompt-evaluation-table" title="Prompt evaluations" className={className}>
    <ChoiceField label="Result" value={result} placeholder="All" options={["passed", "failed", "pending"].map((value) => ({ value, label: value }))} onChange={setResult} />
    {rows.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <caption className="sr-only">Expected and actual outputs</caption>
      <thead><tr>{["Evaluation", "Expected", "Actual", "Result"].map((label) => <th key={label} scope="col" className="p-1.5">{label}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row.id} className="border-t border-border">
        <th scope="row" className="p-1.5 text-left"><span>{row.name}</span>
          <ControlAction label="Open" item={row.name} onClick={onOpen && (() => onOpen(row.id))} /></th>
        <td className="p-1.5 whitespace-pre-wrap break-words">{row.expected}</td>
        <td className="p-1.5 whitespace-pre-wrap break-words">{row.actual}</td>
        <td className="p-1.5">{row.result}</td>
      </tr>)}</tbody>
    </table></div> : <p className="text-sm text-muted-foreground">No matching evaluations.</p>}
  </ControlPanel>;
}
