// packages/ai-ui/src/components/chat-redaction-review.tsx
"use client";

import { useState } from "react";
import { AsyncForm, ControlPanel, ItemHeading, ItemList, comparisonGrid, contentBlock } from "../lib/component-controls.js";

/** Preview text should already be safe to display. */
export interface ChatRedactionSuggestion { id: string; label: string; before: string; after: string }

export interface ChatRedactionReviewProps {
  suggestions: readonly ChatRedactionSuggestion[];
  initialAcceptedIds?: readonly string[];
  onSubmit: (acceptedIds: string[]) => void | Promise<void>;
  className?: string;
}

export function ChatRedactionReview({ suggestions, initialAcceptedIds = [], onSubmit, className }: ChatRedactionReviewProps) {
  const [accepted,setAccepted] = useState(() => new Set(initialAcceptedIds));
  return <ControlPanel slot="chat-redaction-review" title="Review redactions" className={className}>
    <AsyncForm label="Review redactions" submitLabel="Apply redactions" disabled={!suggestions.length}
      onSubmit={() => onSubmit(suggestions.filter((item) => accepted.has(item.id)).map((item) => item.id))}>
      <ItemList items={suggestions} empty="No suggested redactions." render={(item) => <>
        <ItemHeading title={item.label}><label className="text-sm"><input type="checkbox" checked={accepted.has(item.id)}
          aria-label={"Accept " + item.label} onChange={(event) => {
            const checked=event.currentTarget.checked;
            setAccepted((old) => { const next = new Set(old); if (checked) next.add(item.id); else next.delete(item.id); return next; });
          }} /> Accept</label></ItemHeading>
        <div className={comparisonGrid}><p className={contentBlock}>{item.before}</p><p className={contentBlock}>{item.after}</p></div>
      </>} />
    </AsyncForm>
  </ControlPanel>;
}
