// packages/ai-ui/src/components/automation-change-review.tsx
"use client";

import { useId } from "react";
import { ControlPanel } from "../lib/component-controls.js";
import { DiffView } from "./diff-view.js";
export interface AutomationConfigurationSummary { trigger: string; schedule: string; actions: readonly string[] }

export interface AutomationChangeReviewProps {
  before: AutomationConfigurationSummary;
  after: AutomationConfigurationSummary;
  className?: string;
}

function ChangedSetting({ label, before, after }: { label: string; before: string; after: string }) {
  const id = useId();
  return <div role="group" aria-labelledby={id} className="space-y-1">
    <h4 id={id} className="text-sm font-medium">{label}</h4>
    {before === after ? <p className="text-sm text-muted-foreground">Unchanged</p> : <DiffView oldValue={before} newValue={after} label={label + " changes"} />}
  </div>;
}

export function AutomationChangeReview({ before, after, className }: AutomationChangeReviewProps) {
  return <ControlPanel slot="automation-change-review" title="Review automation changes" className={className}>
    <ChangedSetting label="Trigger" before={before.trigger} after={after.trigger} />
    <ChangedSetting label="Schedule" before={before.schedule} after={after.schedule} />
    <ChangedSetting label="Actions" before={before.actions.join("\n")} after={after.actions.join("\n")} />
  </ControlPanel>;
}
