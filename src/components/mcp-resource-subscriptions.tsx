// packages/ai-ui/src/components/mcp-resource-subscriptions.tsx
"use client";

import { ControlPanel, ItemHeading, ItemList } from "../lib/component-controls.js";

export interface McpResourceSubscription { id: string; title: string; server: string; subscribed: boolean; unavailableReason?: string }

export interface McpResourceSubscriptionsProps {
  resources: readonly McpResourceSubscription[];
  onToggle?: (id: string, subscribed: boolean) => void;
  pendingIds?: readonly string[];
  className?: string;
}

export function McpResourceSubscriptions({ resources, onToggle, pendingIds = [], className }: McpResourceSubscriptionsProps) {
  return <ControlPanel slot="mcp-resource-subscriptions" title="Resource subscriptions" className={className}>
    <ItemList items={resources} empty="No subscriptions available." render={(item) => <ItemHeading title={item.title}
      detail={[item.server,item.subscribed ? "Subscribed" : "Unsubscribed",pendingIds.includes(item.id) ? "Updating" : null,item.unavailableReason].filter(Boolean).join(" · ")}>
      {onToggle && <label className="text-sm"><input type="checkbox" checked={item.subscribed}
        aria-label={"Subscribe to " + item.title} disabled={Boolean(item.unavailableReason) || pendingIds.includes(item.id)}
        onChange={(event) => onToggle(item.id,event.currentTarget.checked)} /> Subscribe</label>}
    </ItemHeading>} />
  </ControlPanel>;
}
