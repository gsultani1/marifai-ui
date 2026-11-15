// packages/ai-ui/src/components/file-changes.tsx
"use client";

import { Popover } from "@base-ui/react/popover";
import { ChevronDownIcon, FileDiffIcon, GitCompareIcon, Undo2Icon } from "lucide-react";
import { useState } from "react";

import { button, buttonVariants, focusRing, iconButton, popupSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { baseName, type FileChangeStatus, parentPath } from "../lib/file-tree.js";
import { usePortalContainer } from "../lib/portal.js";
import { ConfirmDialog } from "./confirm-dialog.js";
import { FileStatusBadge } from "./file-tree.js";

export interface FileChange {
  path: string;
  status: FileChangeStatus;
  additions?: number;
  deletions?: number;
  /** Former path of a renamed file. */
  previousPath?: string;
}

export interface FileChangesProps {
  changes: FileChange[];
  onOpen?: (path: string) => void;
  onViewDiff?: (path: string) => void;
  /** Reverts changes after confirmation; called with one path or all of them. */
  onDiscard?: (paths: string[]) => void | Promise<void>;
  className?: string;
}

/** Totals of added and removed lines across changes. */
export function sumLineChanges(changes: FileChange[]): { additions: number; deletions: number } {
  return changes.reduce((total, change) => ({ additions: total.additions + (change.additions ?? 0), deletions: total.deletions + (change.deletions ?? 0) }), { additions: 0, deletions: 0 });
}

function LineCounts({ additions, deletions }: { additions: number; deletions: number }) {
  return (
    <span className="inline-flex shrink-0 gap-1.5 font-mono text-xs tabular-nums">
      <span className="text-success">
        <span aria-hidden="true">+</span>
        {additions}
        <span className="sr-only"> lines added</span>
      </span>
      <span className="text-destructive">
        <span aria-hidden="true">−</span>
        {deletions}
        <span className="sr-only"> lines removed</span>
      </span>
    </span>
  );
}

/**
 * "3 files changed +12 −4" button that opens the list of changed files,
 * each with its status and line counts, to open, compare or discard.
 */
export function FileChanges({ changes, onOpen, onViewDiff, onDiscard, className }: FileChangesProps) {
  const [open, setOpen] = useState(false);
  const [discarding, setDiscarding] = useState<string[] | null>(null);
  const container = usePortalContainer();
  if (changes.length === 0) return null;
  const totals = sumLineChanges(changes);
  const summary = `${changes.length} ${changes.length === 1 ? "file" : "files"} changed`;

  return (
    <>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger className={cn("inline-flex h-8 items-center gap-2 rounded-md border border-border bg-background px-2.5 text-xs font-medium hover:bg-accent data-[popup-open]:bg-accent [&_svg]:size-3.5", focusRing, className)}>
          <FileDiffIcon aria-hidden="true" />
          {summary}
          <LineCounts {...totals} />
          <ChevronDownIcon aria-hidden="true" className="text-muted-foreground" />
        </Popover.Trigger>
        <Popover.Portal container={container}>
          <Popover.Positioner sideOffset={6} align="start" collisionPadding={8} className="z-50">
            <Popover.Popup className={cn(popupSurface, "flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-1 p-2 outline-none")}>
              <Popover.Title className="px-1 text-sm font-semibold">{summary}</Popover.Title>
              <ul className="flex max-h-80 flex-col overflow-y-auto">
                {changes.map((change) => {
                  const folder = parentPath(change.path);
                  return (
                    <li key={change.path} className="group flex items-center gap-1 rounded-md hover:bg-accent/60">
                      <button
                        type="button"
                        disabled={!onOpen}
                        onClick={() => {
                          onOpen?.(change.path);
                          setOpen(false);
                        }}
                        className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm disabled:cursor-default", focusRing, "focus-visible:ring-offset-0")}
                      >
                        <span className="flex min-w-0 flex-col">
                          <span className={cn("truncate", change.status === "deleted" && "line-through")}>{baseName(change.path)}</span>
                          <span className="truncate text-xs text-muted-foreground">{change.previousPath ? `from ${change.previousPath}` : folder || "root"}</span>
                        </span>
                        <FileStatusBadge status={change.status} className="order-first" />
                        <span className="ml-auto">
                          <LineCounts additions={change.additions ?? 0} deletions={change.deletions ?? 0} />
                        </span>
                      </button>
                      {onViewDiff && (
                        <button type="button" aria-label={`Compare ${change.path}`} title="Compare" onClick={() => onViewDiff(change.path)} className={cn(iconButton, "size-7", focusRing)}>
                          <GitCompareIcon aria-hidden="true" />
                        </button>
                      )}
                      {onDiscard && (
                        <button type="button" aria-label={`Discard changes to ${change.path}`} title="Discard changes" onClick={() => setDiscarding([change.path])} className={cn(iconButton, "size-7", focusRing)}>
                          <Undo2Icon aria-hidden="true" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              {onDiscard && changes.length > 1 && (
                <button type="button" onClick={() => setDiscarding(changes.map((change) => change.path))} className={cn(button, buttonVariants.destructive, "self-end", focusRing)}>
                  Discard all
                </button>
              )}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      <ConfirmDialog
        open={discarding !== null}
        onOpenChange={(next) => !next && setDiscarding(null)}
        title={discarding?.length === 1 ? `Discard changes to ${baseName(discarding[0]!)}?` : `Discard changes to ${discarding?.length ?? 0} files?`}
        description="The files go back to their last saved version. This can't be undone."
        confirmLabel="Discard"
        tone="destructive"
        onConfirm={async () => {
          if (discarding) await onDiscard?.(discarding);
        }}
      />
    </>
  );
}
