// packages/ai-ui/src/components/diff-review.tsx
"use client";

import { ChevronRightIcon, ExternalLinkIcon, Undo2Icon } from "lucide-react";
import { type ComponentProps, useState } from "react";

import { card, focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { type PatchFile, parseUnifiedDiff } from "../lib/patch.js";
import { ConfirmDialog } from "./confirm-dialog.js";
import { FileStatusBadge } from "./file-tree.js";
import { PatchHunkView } from "./patch-hunk.js";

export interface DiffSummaryProps extends Omit<ComponentProps<"p">, "children"> {
  files: Pick<PatchFile, "additions" | "deletions">[];
}

/** "3 files changed, +12 −4" with a five-block bar of the added and removed share. */
export function DiffSummary({ files, className, ...props }: DiffSummaryProps) {
  const additions = files.reduce((sum, file) => sum + file.additions, 0);
  const deletions = files.reduce((sum, file) => sum + file.deletions, 0);
  const total = additions + deletions;
  const green = total ? Math.round((additions / total) * 5) : 0;
  const red = total ? Math.min(5 - green, Math.round((deletions / total) * 5)) : 0;
  return (
    <p data-slot="diff-summary" className={cn("inline-flex flex-wrap items-center gap-2 text-sm", className)} {...props}>
      <span>
        {files.length} {files.length === 1 ? "file" : "files"} changed
      </span>
      <span className="font-mono text-xs tabular-nums">
        <span className="text-success">+{additions}</span> <span className="text-destructive">−{deletions}</span>
        <span className="sr-only">
          {" "}
          ({additions} lines added, {deletions} removed)
        </span>
      </span>
      <span aria-hidden="true" className="inline-flex gap-0.5">
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} className={cn("size-2 rounded-[2px]", index < green ? "bg-success" : index < green + red ? "bg-destructive" : "bg-muted-foreground/30")} />
        ))}
      </span>
    </p>
  );
}

export interface DiffReviewProps {
  /** Unified diff text, such as `git diff` output. */
  patch?: string;
  /** Already parsed files; takes precedence over `patch`. */
  files?: PatchFile[];
  onOpen?: (path: string) => void;
  /** Reverts one file after confirmation. */
  onRevert?: (file: PatchFile) => void | Promise<void>;
  /** Files with more changed lines than this start collapsed. */
  collapseAbove?: number;
  className?: string;
}

/**
 * Review a change set as per-file cards: status, line counts, hunks with
 * old and new line numbers, collapsed large files, open in editor and
 * revert with confirmation.
 */
export function DiffReview({ patch = "", files: filesProp, onOpen, onRevert, collapseAbove = 300, className }: DiffReviewProps) {
  const files = filesProp ?? parseUnifiedDiff(patch);
  const [toggled, setToggled] = useState<Set<string>>(new Set());
  const [reverting, setReverting] = useState<PatchFile | null>(null);

  return (
    <div data-slot="diff-review" className={cn("flex flex-col gap-3", className)}>
      <DiffSummary files={files} />
      {files.map((file) => {
        const large = file.additions + file.deletions > collapseAbove;
        const open = large ? toggled.has(file.path) : !toggled.has(file.path);
        const bodyId = `diff-${file.path.replace(/[^\w-]/g, "-")}`;
        return (
          <section key={file.path} aria-label={file.path} data-status={file.status} className={cn(card, "overflow-hidden")}>
            <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={bodyId}
                onClick={() => {
                  const next = new Set(toggled);
                  if (next.has(file.path)) next.delete(file.path);
                  else next.add(file.path);
                  setToggled(next);
                }}
                className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left", focusRing)}
              >
                <ChevronRightIcon aria-hidden="true" className={cn("size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", open && "rotate-90")} />
                <FileStatusBadge status={file.status} />
                <span className="min-w-0 truncate font-mono text-xs">{file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}</span>
              </button>
              <span className="font-mono text-xs tabular-nums">
                <span className="text-success">+{file.additions}</span> <span className="text-destructive">−{file.deletions}</span>
              </span>
              {onOpen && file.status !== "deleted" && (
                <button type="button" aria-label={`Open ${file.path}`} title="Open" onClick={() => onOpen(file.path)} className={cn(iconButton, "size-7", focusRing)}>
                  <ExternalLinkIcon aria-hidden="true" />
                </button>
              )}
              {onRevert && (
                <button type="button" aria-label={`Revert ${file.path}`} title="Revert" onClick={() => setReverting(file)} className={cn(iconButton, "size-7", focusRing)}>
                  <Undo2Icon aria-hidden="true" />
                </button>
              )}
            </div>
            {open && (
              <div id={bodyId} className="divide-y divide-border border-t border-border">
                {file.binary ? <p className="px-3 py-2 text-sm text-muted-foreground">Binary file changed.</p> : file.hunks.map((hunk, index) => <PatchHunkView key={index} hunk={hunk} />)}
                {!file.binary && file.hunks.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">{file.status === "renamed" ? "Renamed without changes." : "No content changes."}</p>}
              </div>
            )}
            {!open && large && <p className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground">Large change collapsed. Expand to review.</p>}
          </section>
        );
      })}
      {files.length === 0 && <p className="text-sm text-muted-foreground">No changes.</p>}
      <ConfirmDialog
        open={reverting !== null}
        onOpenChange={(next) => !next && setReverting(null)}
        title={`Revert ${reverting?.path ?? ""}?`}
        description={reverting?.status === "added" ? "The new file will be removed." : "The file goes back to its previous version."}
        confirmLabel="Revert"
        tone="destructive"
        onConfirm={async () => {
          if (reverting) await onRevert?.(reverting);
        }}
      />
    </div>
  );
}
