// packages/ai-ui/src/components/chat-attachment-review.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading, ItemList } from "../lib/component-controls.js";

export interface ChatReviewAttachment { id: string; name: string; status: "ready" | "uploading" | "failed"; included: boolean; detail?: string }

export interface ChatAttachmentReviewProps {
  attachments: readonly ChatReviewAttachment[];
  onIncludeChange?: (id: string, included: boolean) => void;
  onRemove?: (id: string) => void;
  pendingIds?: readonly string[];
  className?: string;
}

export function ChatAttachmentReview({ attachments, onIncludeChange, onRemove, pendingIds = [], className }: ChatAttachmentReviewProps) {
  return <ControlPanel slot="chat-attachment-review" title="Attachments" className={className}>
    <ItemList items={attachments} empty="No attachments." render={(item) => <ItemHeading title={item.name}
      detail={[item.status, item.detail].filter(Boolean).join(" · ")}>
      {onIncludeChange && <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={item.included}
        aria-label={"Include " + item.name} disabled={item.status !== "ready" || pendingIds.includes(item.id)}
        onChange={(event) => onIncludeChange(item.id, event.currentTarget.checked)} /> Include</label>}
      <ControlAction label="Remove" item={item.name} disabled={pendingIds.includes(item.id)} onClick={onRemove && (() => onRemove(item.id))} />
    </ItemHeading>} />
  </ControlPanel>;
}
