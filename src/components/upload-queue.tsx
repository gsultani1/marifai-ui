// packages/ai-ui/src/components/upload-queue.tsx
"use client";

import { AlertCircleIcon, CheckCircle2Icon, FileIcon, LoaderCircleIcon, PauseIcon, PaperclipIcon, PlayIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { useId, useRef, useState } from "react";

import { button, buttonVariants, focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatBytes } from "../lib/format.js";
import type { RejectedFile, UploadItem, UploadStatus } from "../lib/upload-queue.js";
import { FileDropzone } from "./file-dropzone.js";

export interface UploadQueueProps {
  items: UploadItem[];
  rejected?: RejectedFile[];
  onAddFiles?: (files: File[]) => void;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onRetry?: (id: string) => void;
  onRemove?: (id: string) => void;
  onReattach?: (id: string, file: File) => void;
  onClearCompleted?: () => void;
  /** Adds an "Add folder" button that keeps relative paths. */
  allowFolders?: boolean;
  /** Items shown before "Show N more". */
  visibleLimit?: number;
  label?: string;
  className?: string;
}

const isOsClutter = (path: string) => /(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini)$/.test(path);

const STATUS_TEXT: Record<UploadStatus, string> = {
  queued: "Waiting",
  uploading: "Uploading",
  paused: "Paused",
  "needs-file": "Attach the file again to continue",
  failed: "Failed",
  done: "Uploaded",
};

function StatusIcon({ status }: { status: UploadStatus }) {
  if (status === "done") return <CheckCircle2Icon aria-hidden="true" className="size-4 text-success" />;
  if (status === "failed" || status === "needs-file") return <AlertCircleIcon aria-hidden="true" className="size-4 text-destructive" />;
  if (status === "uploading") return <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none" />;
  return <FileIcon aria-hidden="true" className="size-4 text-muted-foreground" />;
}

/**
 * Upload list with a FileDropzone (dropped folders are walked), one progress
 * bar per file and overall, and per-item pause, resume, retry, remove and re-attach.
 * Rejected files are listed with the reason. Pair it with `useUploadQueue`.
 */
export function UploadQueue({ items, rejected = [], onAddFiles, onPause, onResume, onRetry, onRemove, onReattach, onClearCompleted, allowFolders = false, visibleLimit = 30, label = "Uploads", className }: UploadQueueProps) {
  const [expanded, setExpanded] = useState(false);
  const [reattachId, setReattachId] = useState<string | null>(null);
  const reattachInput = useRef<HTMLInputElement>(null);
  const id = useId();
  const active = items.filter((item) => item.status !== "done");
  const totalBytes = active.reduce((sum, item) => sum + item.size, 0);
  const sentBytes = active.reduce((sum, item) => sum + item.size * item.progress, 0);
  const counts = items.reduce<Partial<Record<UploadStatus, number>>>((result, item) => ({ ...result, [item.status]: (result[item.status] ?? 0) + 1 }), {});
  const attention = (counts.failed ?? 0) + (counts["needs-file"] ?? 0);
  const shown = expanded ? items : items.slice(0, visibleLimit);
  const summary = [counts.uploading && `${counts.uploading} uploading`, counts.queued && `${counts.queued} waiting`, counts.paused && `${counts.paused} paused`, attention && `${attention} need attention`, counts.done && `${counts.done} done`].filter(Boolean).join(" · ");

  return (
    <section aria-label={label} className={cn("flex flex-col gap-3 text-sm", className)}>
      {onAddFiles && <FileDropzone onFiles={(files) => onAddFiles(files)} allowFolders={allowFolders} ignore={isOsClutter} />}
      {rejected.length > 0 && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs">
          <p className="font-medium">
            {rejected.length === 1 ? "1 file wasn't added:" : `${rejected.length} files weren't added:`}
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {rejected.slice(0, 10).map((file, index) => (
              <li key={`${file.name}-${index}`}>
                <span className="font-medium">{file.name}</span>: {file.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      {items.length > 0 && (
        <>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span role="status" className="text-muted-foreground">
                {summary}
              </span>
              {onClearCompleted && counts.done ? (
                <button type="button" onClick={onClearCompleted} className={cn("rounded px-1 font-medium text-muted-foreground hover:text-foreground", focusRing)}>
                  Clear completed
                </button>
              ) : null}
            </div>
            {totalBytes > 0 && (
              <div role="progressbar" aria-label="Overall upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((sentBytes / totalBytes) * 100)} className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${(sentBytes / totalBytes) * 100}%` }} />
              </div>
            )}
          </div>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {shown.map((item) => {
              const name = item.path ?? item.name;
              return (
                <li key={item.id} className="flex items-center gap-3 px-3 py-2">
                  <StatusIcon status={item.status} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium" title={name}>
                        {name}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{item.status === "uploading" ? `${Math.round(item.progress * 100)}% of ${formatBytes(item.size)}` : formatBytes(item.size)}</span>
                    </div>
                    {item.status === "uploading" || item.status === "paused" ? (
                      <div role="progressbar" aria-label={`${name} upload`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(item.progress * 100)} className="h-1 overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full rounded-full", item.status === "paused" ? "bg-muted-foreground" : "bg-primary")} style={{ width: `${item.progress * 100}%` }} />
                      </div>
                    ) : null}
                    <span className={cn("text-xs", item.status === "failed" || item.status === "needs-file" || item.error ? "font-medium text-destructive" : "text-muted-foreground")}>{item.error ?? STATUS_TEXT[item.status]}</span>
                  </div>
                  <div className="flex shrink-0 items-center">
                    {(item.status === "uploading" || item.status === "queued") && onPause && (
                      <button type="button" aria-label={`Pause ${name}`} onClick={() => onPause(item.id)} className={cn(iconButton, "size-7", focusRing)}>
                        <PauseIcon aria-hidden="true" />
                      </button>
                    )}
                    {item.status === "paused" && onResume && (
                      <button type="button" aria-label={`Resume ${name}`} onClick={() => onResume(item.id)} className={cn(iconButton, "size-7", focusRing)}>
                        <PlayIcon aria-hidden="true" />
                      </button>
                    )}
                    {item.status === "failed" && onRetry && (
                      <button type="button" aria-label={`Retry ${name}`} onClick={() => onRetry(item.id)} className={cn(iconButton, "size-7", focusRing)}>
                        <RotateCcwIcon aria-hidden="true" />
                      </button>
                    )}
                    {item.status === "needs-file" && onReattach && (
                      <button
                        type="button"
                        aria-label={`Attach ${name} again`}
                        onClick={() => {
                          setReattachId(item.id);
                          reattachInput.current?.click();
                        }}
                        className={cn(iconButton, "size-7", focusRing)}
                      >
                        <PaperclipIcon aria-hidden="true" />
                      </button>
                    )}
                    {onRemove && (
                      <button type="button" aria-label={item.status === "done" ? `Remove ${name} from the list` : `Cancel ${name}`} onClick={() => onRemove(item.id)} className={cn(iconButton, "size-7", focusRing)}>
                        <XIcon aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {items.length > visibleLimit && (
            <button type="button" onClick={() => setExpanded(!expanded)} className={cn(button, buttonVariants.ghost, "self-start", focusRing)}>
              {expanded ? "Show fewer" : `Show ${items.length - visibleLimit} more`}
            </button>
          )}
        </>
      )}
      <input
        ref={reattachInput}
        id={`${id}-reattach`}
        type="file"
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file && reattachId) onReattach?.(reattachId, file);
          setReattachId(null);
        }}
      />
    </section>
  );
}
