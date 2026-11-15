// packages/ai-ui/src/components/automation-toggle-list.tsx
"use client";

import { ControlPanel, ItemHeading, ItemList } from "../lib/component-controls.js";

export interface ToggleableAutomation { id: string; title: string; enabled: boolean; nextRun?: string; unavailableReason?: string }

export interface AutomationToggleListProps {
  automations: readonly ToggleableAutomation[];
  onToggle?: (id: string, enabled: boolean) => void;
  pendingIds?: readonly string[];
  className?: string;
}

export function AutomationToggleList({ automations, onToggle, pendingIds = [], className }: AutomationToggleListProps) {
  return <ControlPanel slot="automation-toggle-list" title="Automations" className={className}>
    <ItemList items={automations} empty="No automations." render={(item) => <ItemHeading title={item.title}
      detail={[item.enabled ? "Enabled" : "Disabled", item.nextRun, item.unavailableReason].filter(Boolean).join(" · ")}>
      {onToggle && <label className="text-sm"><input type="checkbox" role="switch" aria-label={item.title} checked={item.enabled}
        disabled={Boolean(item.unavailableReason) || pendingIds.includes(item.id)} onChange={(event) => onToggle(item.id, event.currentTarget.checked)} /> Enabled</label>}
    </ItemHeading>} />
  </ControlPanel>;
}
