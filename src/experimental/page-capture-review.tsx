// packages/ai-ui/src/experimental/page-capture-review.tsx
"use client";

import { useState, type ReactNode } from "react";
import { AsyncForm, ControlAction, ControlPanel, Field, fieldClass } from "../lib/component-controls.js";


export interface PageCaptureReviewProps {
  captureId: string;
  preview: ReactNode;
  initialLabel?: string;
  onAttach: (id: string, label: string) => void | Promise<void>;
  onDiscard?: (id: string) => void;
  className?: string;
}

export function PageCaptureReview({ captureId, preview, initialLabel = "", onAttach, onDiscard, className }: PageCaptureReviewProps) {
  const [draft, setDraft] = useState({ captureId, label: initialLabel });
  const label = draft.captureId === captureId ? draft.label : initialLabel;
  return <ControlPanel slot="page-capture-review" title="Review page capture" className={className}>
    <div className="max-w-full overflow-auto">{preview}</div>
    <AsyncForm key={captureId} label="Review page capture" submitLabel="Attach capture" onSubmit={() => onAttach(captureId, label.trim())}>
      <Field label="Capture label"><input className={fieldClass} value={label} onChange={(event) => setDraft({ captureId, label: event.currentTarget.value })} /></Field>
      <ControlAction label="Discard capture" onClick={onDiscard && (() => onDiscard(captureId))} />
    </AsyncForm>
  </ControlPanel>;
}
