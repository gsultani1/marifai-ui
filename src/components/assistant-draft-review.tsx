// packages/ai-ui/src/components/assistant-draft-review.tsx
"use client";

import { useState } from "react";
import { AsyncForm, ControlPanel, Field, fieldClass } from "../lib/component-controls.js";

export type AssistantDraftDecision = "approve" | "return";

export interface AssistantDraftReviewProps {
  initialText: string;
  recipient?: string;
  onDecide: (decision: AssistantDraftDecision, text: string) => void | Promise<void>;
  className?: string;
}

export function AssistantDraftReview({ initialText, recipient, onDecide, className }: AssistantDraftReviewProps) {
  const [text, setText] = useState(initialText);
  const [decision, setDecision] = useState<AssistantDraftDecision>("approve");
  const [source, setSource] = useState(initialText);
  if (source !== initialText) {
    // A new draft from the assistant replaces the edited one and starts a fresh decision.
    setSource(initialText);
    setText(initialText);
    setDecision("approve");
  }
  return <ControlPanel slot="assistant-draft-review" title="Review draft" className={className}>
    {recipient && <p className="text-sm break-words">Recipient · {recipient}</p>}
    <AsyncForm label="Review assistant draft" submitLabel="Submit decision" onSubmit={() => {
      if (decision === "approve" && !text.trim()) throw new Error("Enter a draft before approving.");
      return onDecide(decision, text);
    }}>
      <Field label="Draft"><textarea className={fieldClass} rows={5} value={text} onChange={(event) => setText(event.currentTarget.value)} /></Field>
      <Field label="Decision"><select className={fieldClass} value={decision} onChange={(event) => setDecision(event.currentTarget.value === "return" ? "return" : "approve")}>
        <option value="approve">Approve draft</option><option value="return">Return for revision</option>
      </select></Field>
    </AsyncForm>
  </ControlPanel>;
}
