// packages/ai-ui/src/components/automation-dead-letter-queue.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading } from "../lib/component-controls.js";
import { FilteredList } from "../lib/collection-controls.js";
export interface FailedAutomationDelivery { id: string; title: string; reason: string; kind: string; timestamp: string; retryUnavailableReason?: string }

export interface AutomationDeadLetterQueueProps {
  deliveries: readonly FailedAutomationDelivery[];
  onInspect: (id: string) => void;
  onRetry?: (id: string) => void;
  pendingIds?: readonly string[];
  className?: string;
}

export function AutomationDeadLetterQueue({ deliveries, onInspect, onRetry, pendingIds = [], className }: AutomationDeadLetterQueueProps) {
  return <ControlPanel slot="automation-dead-letter-queue" title="Failed deliveries" className={className}>
    <FilteredList items={deliveries} searchLabel="Search deliveries" searchText={(item) => [item.title,item.reason]}
      filterLabel="Delivery type" filters={[...new Set(deliveries.map((item) => item.kind))].map((value) => ({value,label:value}))} category={(item) => item.kind}
      empty={deliveries.length ? "No matching failures." : "No failed deliveries."} render={(item) => {
        const pending = pendingIds.includes(item.id);
        return <ItemHeading title={item.title} detail={[item.timestamp,item.reason,item.retryUnavailableReason,pending && "Retrying"].filter(Boolean).join(" · ")}>
          <ControlAction label="Inspect" item={item.title} onClick={() => onInspect(item.id)} />
          <ControlAction label="Retry" item={item.title} disabled={pending || Boolean(item.retryUnavailableReason)} onClick={onRetry && (() => onRetry(item.id))} />
        </ItemHeading>;
      }} />
  </ControlPanel>;
}
