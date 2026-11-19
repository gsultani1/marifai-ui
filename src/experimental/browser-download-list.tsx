// packages/ai-ui/src/experimental/browser-download-list.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading, ItemList } from "../lib/component-controls.js";

export type BrowserDownloadAction = "pause" | "resume" | "cancel" | "retry";
export interface BrowserDownload {
  id: string;
  name: string;
  status: "queued" | "downloading" | "paused" | "completed" | "failed" | "canceled";
  receivedBytes: number;
  totalBytes?: number;
  detail?: string;
}

export interface BrowserDownloadListProps {
  downloads: readonly BrowserDownload[];
  onAction?: (id: string, action: BrowserDownloadAction) => void;
  pendingIds?: readonly string[];
  className?: string;
}

const actions: Record<BrowserDownload["status"], readonly BrowserDownloadAction[]> = {
  queued: ["cancel"], downloading: ["pause", "cancel"], paused: ["resume", "cancel"],
  completed: [], failed: ["retry"], canceled: ["retry"],
};

export function BrowserDownloadList({ downloads, onAction, pendingIds = [], className }: BrowserDownloadListProps) {
  return <ControlPanel slot="browser-download-list" title="Downloads" className={className}>
    <ItemList items={downloads} empty="No downloads." render={(download) => <>
      <ItemHeading title={download.name} detail={download.status + (download.detail ? " · " + download.detail : "")}>
        {actions[download.status].map((action) => <ControlAction key={action} label={action[0]!.toUpperCase() + action.slice(1)}
          item={download.name} disabled={pendingIds.includes(download.id)} onClick={onAction && (() => onAction(download.id, action))} />)}
      </ItemHeading>
      {(download.status === "downloading" || download.status === "paused") && <progress className="w-full accent-primary" aria-label={download.name + " progress"}
        max={download.totalBytes && download.totalBytes > 0 ? download.totalBytes : undefined}
        value={download.totalBytes && download.totalBytes > 0 ? Math.max(0, Math.min(download.totalBytes, download.receivedBytes)) : undefined} />}
    </>} />
  </ControlPanel>;
}
