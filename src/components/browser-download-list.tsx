// packages/ai-ui/src/components/browser-download-list.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading, ItemList } from "../lib/component-controls.js";
import { formatBytes } from "../lib/format.js";

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

const statuses: Record<BrowserDownload["status"], string> = {
  queued: "Queued", downloading: "Downloading", paused: "Paused", completed: "Completed", failed: "Failed", canceled: "Canceled",
};

function transferred(download: BrowserDownload, total: number | undefined) {
  if (download.status === "completed") return formatBytes(total ?? download.receivedBytes);
  if (download.status !== "downloading" && download.status !== "paused") return "";
  const received = formatBytes(Math.max(0, total ? Math.min(total, download.receivedBytes) : download.receivedBytes));
  return total ? received + " of " + formatBytes(total) : received;
}

export function BrowserDownloadList({ downloads, onAction, pendingIds = [], className }: BrowserDownloadListProps) {
  return <ControlPanel slot="browser-download-list" title="Downloads" className={className}>
    <ItemList items={downloads} empty="No downloads." render={(download) => {
      const total = download.totalBytes && download.totalBytes > 0 ? download.totalBytes : undefined;
      return <>
        <ItemHeading title={download.name} detail={[statuses[download.status], transferred(download, total), download.detail].filter(Boolean).join(" · ")}>
          {actions[download.status].map((action) => <ControlAction key={action} label={action[0]!.toUpperCase() + action.slice(1)}
            item={download.name} disabled={pendingIds.includes(download.id)} onClick={onAction && (() => onAction(download.id, action))} />)}
        </ItemHeading>
        {(download.status === "downloading" || (download.status === "paused" && total)) && <progress className="w-full accent-primary" aria-label={download.name + " progress"}
          max={total} value={total ? Math.max(0, Math.min(total, download.receivedBytes)) : undefined} />}
      </>;
    }} />
  </ControlPanel>;
}
