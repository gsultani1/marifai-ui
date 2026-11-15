// packages/ai-ui/src/components/worker-pool-status.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading, ItemList } from "../lib/component-controls.js";

export interface ReportedWorker { id: string; name: string; status: "available" | "busy" | "offline"; activeWork?: string; lastHeartbeat?: string }

export interface WorkerPoolStatusProps {
  workers: readonly ReportedWorker[];
  onOpen?: (id: string) => void;
  className?: string;
}

export function WorkerPoolStatus({ workers, onOpen, className }: WorkerPoolStatusProps) {
  return <ControlPanel slot="worker-pool-status" title="Worker pool" className={className}>
    <p className="text-sm">{workers.filter((item) => item.status === "available").length} available of {workers.length} workers</p>
    <ItemList items={workers} empty="No workers available." render={(item) => <ItemHeading title={item.name}
      detail={[item.status,item.activeWork,item.lastHeartbeat ? "Last heartbeat " + item.lastHeartbeat : null].filter(Boolean).join(" · ")}>
      <ControlAction label="Open worker" item={item.name} onClick={onOpen && (() => onOpen(item.id))} />
    </ItemHeading>} />
  </ControlPanel>;
}
