// packages/ai-ui/src/components/message-feedback-form.tsx
"use client";

import { useState } from "react";
import { AsyncForm, ChoiceField, ControlPanel, Field, fieldClass } from "../lib/component-controls.js";

export interface MessageFeedback { rating: "positive" | "negative"; comment: string }

export interface MessageFeedbackFormProps {
  messageId: string;
  onSubmit: (id: string, feedback: MessageFeedback) => void | Promise<void>;
  className?: string;
}

export function MessageFeedbackForm({ messageId, onSubmit, className }: MessageFeedbackFormProps) {
  return <MessageFeedbackDraft key={messageId} messageId={messageId} onSubmit={onSubmit} {...(className ? { className } : {})} />;
}

function MessageFeedbackDraft({ messageId, onSubmit, className }: MessageFeedbackFormProps) {
  const [rating, setRating] = useState<MessageFeedback["rating"] | "">("");
  const [comment,setComment] = useState("");
  const [sent, setSent] = useState(false);
  return <ControlPanel slot="message-feedback-form" title="Response feedback" className={className}>
    <AsyncForm label="Response feedback" submitLabel="Send feedback" disabled={!rating}
      onSubmit={async () => { if (rating) { setSent(false); await onSubmit(messageId,{rating,comment:comment.trim()}); setRating(""); setComment(""); setSent(true); } }}>
      <ChoiceField label="Rating" value={rating} placeholder="Choose a rating" options={[{value:"positive",label:"Helpful"},{value:"negative",label:"Unhelpful"}]}
        onChange={(value) => { setRating(value); setSent(false); }} />
      <Field label="Feedback (optional)"><textarea className={fieldClass} value={comment} onChange={(event) => setComment(event.currentTarget.value)} /></Field>
    </AsyncForm>
    {/* The form clears after sending, so confirm in a live region that stays mounted. */}
    <p role="status" className="text-sm text-muted-foreground">{sent ? "Feedback sent. Thank you." : ""}</p>
  </ControlPanel>;
}
