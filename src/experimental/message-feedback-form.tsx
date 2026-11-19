// packages/ai-ui/src/experimental/message-feedback-form.tsx
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
  return <ControlPanel slot="message-feedback-form" title="Response feedback" className={className}>
    <AsyncForm label="Response feedback" submitLabel="Send feedback" disabled={!rating}
      onSubmit={async () => { if (rating) { await onSubmit(messageId,{rating,comment:comment.trim()}); setRating(""); setComment(""); } }}>
      <ChoiceField label="Rating" value={rating} placeholder="Choose a rating" options={[{value:"positive",label:"Helpful"},{value:"negative",label:"Unhelpful"}]} onChange={setRating} />
      <Field label="Feedback (optional)"><textarea className={fieldClass} value={comment} onChange={(event) => setComment(event.currentTarget.value)} /></Field>
    </AsyncForm>
  </ControlPanel>;
}
