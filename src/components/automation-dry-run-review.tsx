// packages/ai-ui/src/components/automation-dry-run-review.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading, ItemList } from "../lib/component-controls.js";

export interface DryRunAction { id: string; title: string; affectedItems: readonly string[]; requiresApproval?: boolean; detail?: string }

export interface AutomationDryRunReviewProps {
  actions: readonly DryRunAction[];
  onReviewApproval?: (id: string) => void;
  className?: string;
}

export function AutomationDryRunReview({ actions, onReviewApproval, className }: AutomationDryRunReviewProps) {
  return <ControlPanel slot="automation-dry-run-review" title="Dry run review" className={className}>
    <ItemList items={actions} empty="No actions were planned." render={(item) => <>
      <ItemHeading title={item.title} detail={item.detail}>
        {item.requiresApproval && <ControlAction label="Review approval" item={item.title} onClick={onReviewApproval && (() => onReviewApproval(item.id))} />}
      </ItemHeading>
      {item.requiresApproval && <p className="text-sm text-muted-foreground">Approval required</p>}
      {item.affectedItems.length > 0 && <ul aria-label={"Items affected by " + item.title} className="list-disc ps-5 text-sm">
        {item.affectedItems.map((target, index) => <li key={index} className="break-words">{target}</li>)}
      </ul>}
    </>} />
  </ControlPanel>;
}
