// packages/ai-ui/src/components/assistant-conflict-review.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading, ItemList } from "../lib/component-controls.js";

export interface AssistantConflictResolution { id: string; label: string; detail?: string }
export interface AssistantScheduleConflict { id: string; title: string; commitments: readonly string[]; resolutions: readonly AssistantConflictResolution[] }

export interface AssistantConflictReviewProps {
  conflicts: readonly AssistantScheduleConflict[];
  onChoose: (conflictId: string, resolutionId: string) => void;
  pendingIds?: readonly string[];
  className?: string;
}

export function AssistantConflictReview({ conflicts, onChoose, pendingIds = [], className }: AssistantConflictReviewProps) {
  return <ControlPanel slot="assistant-conflict-review" title="Schedule conflicts" className={className}>
    <ItemList items={conflicts} empty="No overlapping commitments." render={(item) => <>
      <h4 className="text-sm font-medium">{item.title}</h4>
      {item.commitments.length > 0 && <ul className="list-disc ps-5 text-sm">{item.commitments.map((commitment, index) => <li key={index} className="break-words">{commitment}</li>)}</ul>}
      <ItemList items={item.resolutions} empty="No resolutions available." render={(option) => <ItemHeading title={option.label} detail={option.detail}>
        <ControlAction label="Choose" item={option.label + " for " + item.title} disabled={pendingIds.includes(item.id)} onClick={() => onChoose(item.id, option.id)} />
      </ItemHeading>} />
    </>} />
  </ControlPanel>;
}
