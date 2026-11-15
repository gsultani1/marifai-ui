// packages/ai-ui/src/components/meeting-actions-review.tsx
"use client";

import { useState } from "react";
import { AsyncForm, ChoiceField, ControlPanel, Field, fieldClass, ItemList } from "../lib/component-controls.js";

export interface MeetingActionSuggestion { id: string; title: string; detail?: string }
export type MeetingActionDecision = "accept" | "dismiss";
export interface MeetingActionsReviewProps {
  actions: readonly MeetingActionSuggestion[];
  onDecide: (id: string, decision: MeetingActionDecision, title: string) => void | Promise<void>;
  className?: string;
}
function ActionReview({ item, onDecide }: { item: MeetingActionSuggestion; onDecide: MeetingActionsReviewProps["onDecide"] }) {
  const [title,setTitle] = useState(item.title);
  const [decision,setDecision] = useState<MeetingActionDecision>("accept");
  return <AsyncForm label={"Review " + item.title} submitLabel={"Submit decision for " + item.title} onSubmit={() => {
    if (decision === "accept" && !title.trim()) throw new Error("Enter an action title.");
    return onDecide(item.id,decision,title.trim());
  }}>
    {item.detail && <p className="text-sm text-muted-foreground">{item.detail}</p>}
    <Field label="Action title"><input className={fieldClass} value={title} onChange={(event) => setTitle(event.currentTarget.value)} /></Field>
    <ChoiceField label="Action decision" value={decision} options={[{value:"accept",label:"Accept"},{value:"dismiss",label:"Dismiss"}]}
      onChange={(value) => { if (value) setDecision(value); }} />
  </AsyncForm>;
}
export function MeetingActionsReview({ actions, onDecide, className }: MeetingActionsReviewProps) {
  return <ControlPanel slot="meeting-actions-review" title="Review meeting actions" className={className}>
    <ItemList items={actions} empty="No proposed actions." render={(item) => <ActionReview item={item} onDecide={onDecide} />} />
  </ControlPanel>;
}
