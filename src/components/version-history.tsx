// packages/ai-ui/src/components/version-history.tsx
"use client";

import { GitCompareIcon, HistoryIcon, RotateCcwIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { useNow } from "../hooks/use-now.js";
import { badge, button, buttonVariants, focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatRelativeTime } from "../lib/format.js";

export interface VersionEntry {
  id: string;
  /** Short name such as "v3" or a commit hash. */
  label?: string;
  /** What changed, e.g. a commit message. */
  message?: string;
  author?: string;
  createdAt?: number;
  additions?: number;
  deletions?: number;
}

export interface VersionHistoryProps {
  /** Newest first. */
  versions: VersionEntry[];
  /** The version in use now; it can't be restored. */
  currentId: string;
  /** The version being viewed. */
  selectedId?: string;
  onSelect?: (id: string) => void;
  /** Makes an older version current, normally by saving a copy of it as a new version. */
  onRestore: (id: string) => void | Promise<void>;
  onCompare?: (id: string) => void;
  /** Explains what restoring does, shown while confirming. */
  restoreNote?: string;
  label?: string;
  className?: string;
}

/**
 * History of saved versions with who and when, the version in use marked,
 * and a two-step restore: Restore asks for confirmation in place before
 * anything changes.
 */
export function VersionHistory({ versions, currentId, selectedId, onSelect, onRestore, onCompare, restoreNote = "This saves a copy of it as the newest version. Nothing is lost.", label = "Version history", className }: VersionHistoryProps) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const now = useNow(60_000);
  const id = useId();
  const focusTarget = useRef<string | null>(null);

  useEffect(() => {
    const target = focusTarget.current;
    if (!target) return;
    focusTarget.current = null;
    document.getElementById(target)?.focus();
  });

  const ask = (versionId: string) => {
    setError(null);
    setConfirming(versionId);
    focusTarget.current = `${id}-confirm-${versionId}`;
  };

  const cancel = (versionId: string) => {
    setConfirming(null);
    focusTarget.current = `${id}-restore-${versionId}`;
  };

  const restore = async (versionId: string) => {
    setBusy(versionId);
    try {
      await onRestore(versionId);
      setConfirming(null);
    } catch (reason) {
      setError({ id: versionId, message: reason instanceof Error && reason.message ? reason.message : "Couldn't restore this version." });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby={`${id}-title`} data-slot="version-history" className={cn("flex flex-col gap-2 text-sm", className)}>
      <h3 id={`${id}-title`} className="flex items-center gap-2 font-medium">
        <HistoryIcon aria-hidden="true" className="size-4 text-muted-foreground" />
        {label}
        <span className="text-xs font-normal text-muted-foreground">{versions.length} versions</span>
      </h3>
      <ol className="flex flex-col">
        {versions.map((version, index) => {
          const current = version.id === currentId;
          const selected = version.id === (selectedId ?? currentId);
          const name = version.label ?? `Version ${versions.length - index}`;
          const meta = [version.author, version.createdAt !== undefined ? formatRelativeTime(version.createdAt, now) : ""].filter(Boolean).join(" · ");
          return (
            <li key={version.id} data-current={current || undefined} className="relative flex gap-3 pb-3 last:pb-0">
              <span aria-hidden="true" className="relative flex w-3 justify-center">
                <span className={cn("z-10 mt-1.5 size-2.5 rounded-full border-2", current ? "border-primary bg-primary" : "border-muted-foreground bg-background")} />
                {index < versions.length - 1 && <span className="absolute top-4 bottom-[-0.25rem] w-px bg-border" />}
              </span>
              <div className={cn("flex min-w-0 flex-1 flex-col gap-1 rounded-md px-2 py-1", selected && "ring-1 ring-ring")}>
                <div className="flex flex-wrap items-center gap-2">
                  {onSelect ? (
                    <button type="button" aria-current={selected ? "true" : undefined} onClick={() => onSelect(version.id)} className={cn("min-w-0 truncate text-left font-medium hover:underline", focusRing)}>
                      {name}
                    </button>
                  ) : (
                    <span className="min-w-0 truncate font-medium">{name}</span>
                  )}
                  {current && <span className={cn(badge, "border-primary/40")}>Current</span>}
                  {(version.additions !== undefined || version.deletions !== undefined) && (
                    <span className="font-mono text-xs">
                      <span className="text-success">+{version.additions ?? 0}</span> <span className="text-destructive">−{version.deletions ?? 0}</span>
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-0.5">
                    {onCompare && !current && (
                      <button type="button" aria-label={`Compare ${name} with current`} title="Compare with current" onClick={() => onCompare(version.id)} className={cn(iconButton, "size-7", focusRing)}>
                        <GitCompareIcon aria-hidden="true" />
                      </button>
                    )}
                    {!current && confirming !== version.id && (
                      <button type="button" id={`${id}-restore-${version.id}`} aria-label={`Restore ${name}`} onClick={() => ask(version.id)} className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs", focusRing)}>
                        <RotateCcwIcon aria-hidden="true" />
                        Restore
                      </button>
                    )}
                  </span>
                </div>
                {version.message && <p className="text-muted-foreground">{version.message}</p>}
                {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
                {confirming === version.id && (
                  <div role="group" aria-label={`Confirm restoring ${name}`} className="mt-1 flex flex-col gap-2 rounded-md border border-border bg-background p-2">
                    <p className="text-xs">
                      Restore {name}? {restoreNote}
                    </p>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button type="button" onClick={() => cancel(version.id)} disabled={busy === version.id} className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs", focusRing)}>
                        Cancel
                      </button>
                      <button type="button" id={`${id}-confirm-${version.id}`} onClick={() => void restore(version.id)} disabled={busy === version.id} className={cn(button, buttonVariants.primary, "h-7 px-2 text-xs", focusRing)}>
                        {busy === version.id ? "Restoring…" : `Restore ${name}`}
                      </button>
                    </div>
                    {error?.id === version.id && (
                      <p role="alert" className="text-xs font-medium text-destructive">
                        {error.message}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
