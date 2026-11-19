// packages/ai-ui/src/experimental/conversation-summary-editor.tsx
"use client";

import { useState } from "react";
import { AsyncForm, ControlPanel, Field, fieldClass } from "../lib/component-controls.js";


export interface ConversationSummaryEditorProps {
  initialSummary: string;
  sourceRange: string;
  onSubmit: (summary: string) => void | Promise<void>;
  className?: string;
}

export function ConversationSummaryEditor({ initialSummary, sourceRange, onSubmit, className }: ConversationSummaryEditorProps) {
  const [summary, setSummary] = useState(initialSummary);
  return <ControlPanel slot="conversation-summary-editor" title="Conversation summary" className={className}>
    <p className="text-sm text-muted-foreground">{sourceRange}</p>
    <AsyncForm label="Conversation summary" submitLabel="Save summary" disabled={!summary.trim()} onSubmit={() => onSubmit(summary.trim())}>
      <Field label="Summary"><textarea rows={5} className={fieldClass} value={summary} onChange={(event) => setSummary(event.currentTarget.value)} /></Field>
    </AsyncForm>
  </ControlPanel>;
}
