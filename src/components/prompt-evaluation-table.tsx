// packages/ai-ui/src/components/prompt-evaluation-table.tsx
"use client";

import { useState } from "react";
import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { ChoiceField, ControlAction, ControlPanel } from "../lib/component-controls.js";

export interface PromptEvaluation { id: string; name: string; expected: string; actual: string; result: "passed" | "failed" | "pending" }

export interface PromptEvaluationTableProps {
  evaluations: readonly PromptEvaluation[];
  onOpen?: (id: string) => void;
  className?: string;
}

const RESULTS = [{ value: "passed", label: "Passed" }, { value: "failed", label: "Failed" }, { value: "pending", label: "Pending" }] as const;
const RESULT_LABEL: Record<PromptEvaluation["result"], string> = { passed: "Passed", failed: "Failed", pending: "Pending" };

export function PromptEvaluationTable({ evaluations, onOpen, className }: PromptEvaluationTableProps) {
  const [result, setResult] = useState<PromptEvaluation["result"] | "">("");
  const rows = evaluations.filter((item) => !result || item.result === result);
  const columns = ["Evaluation", "Expected", "Actual", "Result", ...(onOpen ? ["Actions"] : [])];
  return <ControlPanel slot="prompt-evaluation-table" title="Prompt evaluations" className={className}>
    <ChoiceField label="Result" value={result} placeholder="All" options={RESULTS} onChange={setResult} />
    {rows.length ? <div role="region" aria-label="Evaluation results" tabIndex={0} className={cn("overflow-x-auto rounded", focusRing)}>
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Expected and actual outputs</caption>
        <thead><tr>{columns.map((label) => <th key={label} scope="col" className="p-1.5">{label}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id} className="border-t border-border">
          <th scope="row" className="p-1.5 text-left font-medium break-words">{row.name}</th>
          <td className="p-1.5 whitespace-pre-wrap break-words">{row.expected}</td>
          <td className="p-1.5 whitespace-pre-wrap break-words">{row.actual}</td>
          <td className="p-1.5">{RESULT_LABEL[row.result]}</td>
          {onOpen && <td className="p-1.5"><ControlAction label="Open" item={row.name} onClick={() => onOpen(row.id)} /></td>}
        </tr>)}</tbody>
      </table>
    </div> : <p className="text-sm text-muted-foreground">{evaluations.length ? "No matching evaluations." : "No evaluations."}</p>}
  </ControlPanel>;
}
