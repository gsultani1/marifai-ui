// packages/ai-ui/src/components/run-recovery-panel.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading, ItemList } from "../lib/component-controls.js";

export interface RecoveryCheckpoint { id: string; label: string; unavailableReason?: string }

export interface RunRecoveryPanelProps {
  checkpoints: readonly RecoveryCheckpoint[];
  onResume?: (checkpointId: string) => void;
  onRestart?: () => void;
  pending?: boolean;
  restartUnavailableReason?: string;
  className?: string;
}

export function RunRecoveryPanel({ checkpoints, onResume, onRestart, pending, restartUnavailableReason, className }: RunRecoveryPanelProps) {
  return <ControlPanel slot="run-recovery-panel" title="Run recovery" className={className}>
    <ItemList items={checkpoints} empty="No checkpoints available." render={(item) => <ItemHeading title={item.label}
      detail={item.unavailableReason ?? "Available"}>
      <ControlAction label="Resume from" item={item.label} disabled={pending || Boolean(item.unavailableReason)} onClick={onResume && (() => onResume(item.id))} />
    </ItemHeading>} />
    {restartUnavailableReason && <p className="text-sm text-muted-foreground">{restartUnavailableReason}</p>}
    <ControlAction label="Restart run" disabled={pending || Boolean(restartUnavailableReason)} onClick={onRestart} />
  </ControlPanel>;
}
