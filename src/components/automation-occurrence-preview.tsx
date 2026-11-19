// packages/ai-ui/src/components/automation-occurrence-preview.tsx
"use client";

import { ControlPanel, ItemHeading, ItemList } from "../lib/component-controls.js";

export interface AutomationOccurrence { id: string; localDate: string; localTime: string; state: "scheduled" | "skipped"; detail?: string }

export interface AutomationOccurrencePreviewProps {
  occurrences: readonly AutomationOccurrence[];
  timeZone: string;
  className?: string;
}

export function AutomationOccurrencePreview({ occurrences, timeZone, className }: AutomationOccurrencePreviewProps) {
  return <ControlPanel slot="automation-occurrence-preview" title="Upcoming occurrences" className={className}>
    <p className="text-sm text-muted-foreground">{timeZone}</p>
    <ItemList items={occurrences} empty="No upcoming occurrences." render={(item) => <ItemHeading
      title={item.localDate + " · " + item.localTime}
      detail={[item.state === "skipped" ? "Skipped" : "Scheduled",item.detail].filter(Boolean).join(" · ")} />} />
  </ControlPanel>;
}
