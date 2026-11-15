// packages/ai-ui/src/components/tool-call-batch-review.tsx
"use client";

import { useState } from "react";
import { AsyncForm, ChoiceField, ControlPanel, ItemList } from "../lib/component-controls.js";

export type ToolBatchDecision = "approve" | "deny";
export interface ToolBatchCall { id: string; tool: string; summary: string }
export interface ReviewedToolBatchCall { id: string; decision: ToolBatchDecision }

export interface ToolCallBatchReviewProps {
  calls: readonly ToolBatchCall[];
  onSubmit: (decisions: ReviewedToolBatchCall[]) => void | Promise<void>;
  className?: string;
}

export function ToolCallBatchReview({ calls, onSubmit, className }: ToolCallBatchReviewProps) {
  const [choices,setChoices] = useState(() => new Map<string,ToolBatchDecision>());
  const decisions = calls.flatMap((item) => {
    const decision = choices.get(item.id);
    return decision ? [{id:item.id,decision}] : [];
  });
  return <ControlPanel slot="tool-call-batch-review" title="Review tool call batch" className={className}>
    <AsyncForm label="Review tool call batch" submitLabel="Submit decisions" disabled={!calls.length}
      onSubmit={() => {
        if (decisions.length !== calls.length) throw new Error("Choose a decision for every call.");
        return onSubmit(decisions);
      }}>
      <ItemList items={calls} empty="No calls to review." render={(item) => <>
        <p className="text-sm break-words">{item.summary}</p>
        <ChoiceField label={"Decision for " + item.tool} value={choices.get(item.id) ?? ""} placeholder="Choose a decision"
          options={[{value:"approve",label:"Approve"},{value:"deny",label:"Deny"}]} onChange={(value) => setChoices((old) => {
            const next = new Map(old);
            if (value) next.set(item.id,value); else next.delete(item.id);
            return next;
          })} />
      </>} />
    </AsyncForm>
  </ControlPanel>;
}
