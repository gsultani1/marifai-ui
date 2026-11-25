// packages/ai-ui/src/components/automation-run-cancellation.tsx
"use client";

import { useEffect, useRef } from "react";

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
  const message = useRef<HTMLParagraphElement>(null);
  // Focus events from the dialog bubble here through its portal, so this tracks focus in the trigger and the dialog.
  const focusInside = useRef(false);
  // `unavailableReason` replaces the trigger and closes an open dialog. If that removed the focused control,
  // focus would fall to the page, so it moves to the message that took their place.
  useEffect(() => {
    if (!unavailableReason || !focusInside.current) return;
    const active = document.activeElement;
    if (!active || active === document.body) message.current?.focus();
  }, [unavailableReason]);
  return <ControlPanel slot="automation-run-cancellation" title="Cancel automation run" className={className}>
    <p className="text-sm break-words">{name}</p>
    <div onFocus={() => { focusInside.current = true; }} onBlur={(event) => { if (event.relatedTarget) focusInside.current = false; }}>
      {!unavailableReason && <ConfirmDialog key={runId} title="Cancel this run?" description={name} confirmLabel="Cancel run" cancelLabel="Keep running"
        tone="destructive" onConfirm={() => onConfirm(runId)}
        trigger={<Button type="button" size="sm" variant="outline">Review cancellation</Button>}>
        {affected.length > 0 && <ul aria-label="Affected work" className="list-disc ps-5 text-sm">
          {affected.map((item,index) => <li key={index} className="break-words">{item}</li>)}
        </ul>}
      </ConfirmDialog>}
      <div role="status">{unavailableReason && <p ref={message} tabIndex={-1} className="text-sm text-muted-foreground outline-none">{unavailableReason}</p>}</div>
    </div>
  </ControlPanel>;
}
