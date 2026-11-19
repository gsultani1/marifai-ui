// packages/ai-ui/src/experimental/automation-execution-window-indicator.tsx
"use client";

import { ControlPanel } from "../lib/component-controls.js";

export interface AutomationExecutionWindow { eligible: boolean; nextEligibleAt?: string; reason?: string }

export interface AutomationExecutionWindowIndicatorProps {
  window: AutomationExecutionWindow;
  className?: string;
}

export function AutomationExecutionWindowIndicator({ window, className }: AutomationExecutionWindowIndicatorProps) {
  return <ControlPanel slot="automation-execution-window-indicator" title="Execution window" className={className}>
    <p role="status" className="text-sm font-medium">{window.eligible ? "Eligible now" : "Outside execution window"}</p>
    {window.reason && <p className="text-sm break-words">{window.reason}</p>}
    {!window.eligible && window.nextEligibleAt && <p className="text-sm text-muted-foreground">Next eligible · {window.nextEligibleAt}</p>}
  </ControlPanel>;
}
