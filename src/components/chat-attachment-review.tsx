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

const statusLabels: Record<ChatReviewAttachment["status"], string> = { ready: "Ready", uploading: "Uploading", failed: "Upload failed" };

export function ChatAttachmentReview({ attachments, onIncludeChange, onRemove, pendingIds = [], className }: ChatAttachmentReviewProps) {
  return <ControlPanel slot="chat-attachment-review" title="Attachments" className={className}>
    <ItemList items={attachments} empty="No attachments." render={(item) => {
      const pending = pendingIds.includes(item.id);
      // Without a checkbox the inclusion state would otherwise not be shown at all.
      const inclusion = onIncludeChange ? undefined : item.included ? "Included" : "Not included";
      return <ItemHeading title={item.name} detail={[statusLabels[item.status], item.detail, inclusion].filter(Boolean).join(" · ")}>
        {onIncludeChange && <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={item.included}
          aria-label={"Include " + item.name} disabled={item.status !== "ready" || pending}
          onChange={(event) => onIncludeChange(item.id, event.currentTarget.checked)} /> Include</label>}
        <ControlAction label="Remove" item={item.name} disabled={pending} onClick={onRemove && (() => onRemove(item.id))} />
      </ItemHeading>;
    }} />
  </ControlPanel>;
}
