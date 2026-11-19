// packages/ai-ui/src/components/tool-execution-receipt.tsx
"use client";

import { ControlPanel, contentBlock } from "../lib/component-controls.js";

export interface ToolExecutionRecord {
  requestedTool: string;
  actualTool: string;
  outcome: string;
  durationMs?: number;
  usage?: string;
  /** Only supply inputs that are safe for the viewer to read. */
  redactedInputs?: string;
}

export interface ToolExecutionReceiptProps {
  receipt: ToolExecutionRecord;
  className?: string;
}

export function ToolExecutionReceipt({ receipt, className }: ToolExecutionReceiptProps) {
  return <ControlPanel slot="tool-execution-receipt" title="Tool execution receipt" className={className}>
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      {[
        ["Requested tool",receipt.requestedTool],["Actual tool",receipt.actualTool],["Outcome",receipt.outcome],
        ["Duration",receipt.durationMs !== undefined && Number.isFinite(receipt.durationMs) ? receipt.durationMs + " ms" : "Unavailable"],["Usage",receipt.usage ?? "Unavailable"],
      ].map(([label,value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="break-words">{value}</dd></div>)}
    </dl>
    {receipt.actualTool !== receipt.requestedTool && <p className="text-sm break-words">{receipt.actualTool} ran instead of the requested {receipt.requestedTool}.</p>}
    {receipt.redactedInputs !== undefined && <div><h4 className="text-sm font-medium">Redacted inputs</h4><pre className={contentBlock}>{receipt.redactedInputs}</pre></div>}
  </ControlPanel>;
}
