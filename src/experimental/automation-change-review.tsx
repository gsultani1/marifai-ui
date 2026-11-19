// packages/ai-ui/src/experimental/automation-change-review.tsx
"use client";

import { ControlPanel } from "../lib/component-controls.js";
import { DiffView } from "../components/diff-view.js";
export interface AutomationConfigurationSummary { trigger: string; schedule: string; actions: readonly string[] }

export interface AutomationChangeReviewProps {
  before: AutomationConfigurationSummary;
  after: AutomationConfigurationSummary;
  className?: string;
}

export function AutomationChangeReview({ before, after, className }: AutomationChangeReviewProps) {
  return <ControlPanel slot="automation-change-review" title="Review automation changes" className={className}>
    {([
      {label:"Trigger",before:before.trigger,after:after.trigger}, {label:"Schedule",before:before.schedule,after:after.schedule},
      {label:"Actions",before:before.actions.join("\n"),after:after.actions.join("\n")},
    ]).map((item) => <div key={item.label} className="space-y-1">
      <h4 className="text-sm font-medium">{item.label}</h4>
      {item.before === item.after ? <p className="text-sm text-muted-foreground">Unchanged</p> : <DiffView oldValue={item.before} newValue={item.after} />}
    </div>)}
  </ControlPanel>;
}
