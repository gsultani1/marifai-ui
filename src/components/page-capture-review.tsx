// packages/ai-ui/src/components/page-capture-review.tsx
"use client";

import { useState, type ReactNode } from "react";
import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
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
    {/* Focusable so keyboard users can scroll a capture larger than the panel. */}
    <div role="region" aria-label="Capture preview" tabIndex={0} className={cn("max-w-full overflow-auto rounded", focusRing)}>{preview}</div>
    <AsyncForm key={captureId} label="Review page capture" submitLabel="Attach capture" onSubmit={() => onAttach(captureId, label.trim())}>
      <Field label="Capture label"><input className={fieldClass} value={label} onChange={(event) => setDraft({ captureId, label: event.currentTarget.value })} /></Field>
      <ControlAction label="Discard capture" onClick={onDiscard && (() => onDiscard(captureId))} />
    </AsyncForm>
  </ControlPanel>;
}
