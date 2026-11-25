// packages/ai-ui/src/components/worker-pool-status.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading, ItemList } from "../lib/component-controls.js";

export interface ReportedWorker { id: string; name: string; status: "available" | "busy" | "offline"; activeWork?: string; lastHeartbeat?: string }

export interface WorkerPoolStatusProps {
  workers: readonly ReportedWorker[];
  onOpen?: (id: string) => void;
  className?: string;
}

const statusLabels: Record<ReportedWorker["status"], string> = { available: "Available", busy: "Busy", offline: "Offline" };

export function WorkerPoolStatus({ workers, onOpen, className }: WorkerPoolStatusProps) {
  return <ControlPanel slot="worker-pool-status" title="Worker pool" className={className}>
    <p className="text-sm">{workers.filter((item) => item.status === "available").length} available of {workers.length} {workers.length === 1 ? "worker" : "workers"}</p>
    <ItemList items={workers} empty="No workers in this pool." render={(item) => <ItemHeading title={item.name}
      detail={[statusLabels[item.status],item.activeWork,item.lastHeartbeat ? "Last heartbeat " + item.lastHeartbeat : null].filter(Boolean).join(" · ")}>
      <ControlAction label="Open worker" item={item.name} onClick={onOpen && (() => onOpen(item.id))} />
    </ItemHeading>} />
  </ControlPanel>;
}
