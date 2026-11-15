// packages/ai-ui/src/components/automation-run-cancellation.tsx
"use client";

import { ControlPanel } from "../lib/component-controls.js";
import { Button } from "./button.js";
import { ConfirmDialog } from "./confirm-dialog.js";

export interface AutomationRunCancellationProps {
  runId: string;
  name: string;
  affected: readonly string[];
  onConfirm: (id: string) => void | Promise<void>;
  unavailableReason?: string;
  className?: string;
}

export function AutomationRunCancellation({ runId, name, affected, onConfirm, unavailableReason, className }: AutomationRunCancellationProps) {
  return <ControlPanel slot="automation-run-cancellation" title="Cancel automation run" className={className}>
    <p className="text-sm break-words">{name}</p>
    {unavailableReason ? <p className="text-sm text-muted-foreground">{unavailableReason}</p> :
      <ConfirmDialog key={runId} title="Cancel this run?" description={name} confirmLabel="Cancel run" cancelLabel="Keep running"
        tone="destructive" onConfirm={() => onConfirm(runId)}
        trigger={<Button type="button" size="sm" variant="outline">Review cancellation</Button>}>
        {affected.length > 0 && <ul aria-label="Affected work" className="list-disc ps-5 text-sm">
          {affected.map((item,index) => <li key={index}>{item}</li>)}
        </ul>}
      </ConfirmDialog>}
  </ControlPanel>;
}
