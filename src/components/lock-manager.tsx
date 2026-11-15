// packages/ai-ui/src/components/lock-manager.tsx
"use client";

import { LockIcon, LockOpenIcon } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

import { card } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { createIgnoreMatcher } from "../lib/file-tree.js";
import { fileIcon } from "./file-tree.js";
import { SearchInput } from "./search-input.js";

export interface FileLock {
  path: string;
  /** Who locked it, e.g. "Dana" or "Release agent". */
  lockedBy?: string;
}

export interface LockManagerProps {
  /** Every lockable file path. */
  files: string[];
  locks: FileLock[];
  onLockChange: (path: string, locked: boolean) => void;
  ignore?: string[];
  description?: ReactNode;
  /** Rows shown before asking the user to narrow the search. */
  limit?: number;
  className?: string;
}

/**
 * Protects files from agent edits: locked files are listed first with who
 * locked them, and any file can be found and locked from the same list.
 */
export function LockManager({ files, locks, onLockChange, ignore = [], description = "The assistant can read locked files but won't change them.", limit = 200, className }: LockManagerProps) {
  const [query, setQuery] = useState("");
  const id = useId();
  const isIgnored = createIgnoreMatcher(ignore);
  const lockFor = new Map(locks.map((lock) => [lock.path, lock]));
  const needle = query.trim().toLowerCase();
  const matching = files.filter((path) => !isIgnored(path) && (!needle || path.toLowerCase().includes(needle))).sort((a, b) => Number(lockFor.has(b)) - Number(lockFor.has(a)) || a.localeCompare(b));
  const shown = matching.slice(0, limit);

  return (
    <section aria-labelledby={`${id}-title`} data-slot="lock-manager" className={cn(card, "flex min-h-0 flex-col gap-2 p-3 text-sm", className)}>
      <div className="flex items-center gap-2">
        <LockIcon aria-hidden="true" className="size-4 text-muted-foreground" />
        <h3 id={`${id}-title`} className="font-medium">
          Locked files
        </h3>
        <span className="text-xs text-muted-foreground">{locks.length === 0 ? "None" : `${locks.length} locked`}</span>
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <SearchInput label="Find a file to lock" placeholder="Find a file" value={query} onValueChange={setQuery} resultCount={matching.length} />
      <ul className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {shown.map((path) => {
          const lock = lockFor.get(path);
          return (
            <li key={path} className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-accent/40">
              <span className="text-muted-foreground [&_svg]:size-4">{fileIcon(path)}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{path}</span>
                {lock?.lockedBy && <span className="text-xs text-muted-foreground">Locked by {lock.lockedBy}</span>}
              </span>
              <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                <input type="checkbox" role="switch" checked={Boolean(lock)} onChange={(event) => onLockChange(path, event.target.checked)} aria-label={`Lock ${path}`} className="peer sr-only" />
                <span aria-hidden="true" className="flex h-5 w-9 items-center rounded-full border border-border bg-muted p-0.5 transition-colors peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background motion-reduce:transition-none [&>span]:transition-transform peer-checked:[&>span]:translate-x-4 motion-reduce:[&>span]:transition-none">
                  <span className="flex size-3.5 items-center justify-center rounded-full bg-background shadow-sm [&_svg]:size-2.5 [&_svg]:text-muted-foreground">{lock ? <LockIcon /> : <LockOpenIcon />}</span>
                </span>
              </label>
            </li>
          );
        })}
        {matching.length === 0 && <li className="px-1 py-3 text-muted-foreground">No files match.</li>}
      </ul>
      {matching.length > shown.length && <p className="text-xs text-muted-foreground">Showing {shown.length} of {matching.length.toLocaleString()} files. Search to narrow the list.</p>}
    </section>
  );
}
