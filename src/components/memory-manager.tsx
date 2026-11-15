// packages/ai-ui/src/components/memory-manager.tsx
"use client";

import { BrainIcon, CheckIcon, GitMergeIcon, PencilIcon, Trash2Icon, XIcon } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { useNow } from "../hooks/use-now.js";
import { badge, button, buttonVariants, card, focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatRelativeTime } from "../lib/format.js";
import { ConfirmDialog } from "./confirm-dialog.js";
import { FilterChips } from "./filter-chips.js";
import { SearchInput } from "./search-input.js";

export type MemoryStatus = "pending" | "approved" | "rejected";

export interface MemoryItem {
  id: string;
  text: string;
  status: MemoryStatus;
  /** 0 to 1. */
  confidence?: number;
  /** Where it was learned, e.g. a conversation title. */
  source?: string;
  category?: string;
  createdAt?: number;
  expiresAt?: number;
}

export type MemoryResolution = { keep: "existing" } | { keep: "incoming" } | { keep: "both" } | { keep: "merged"; text: string };

export interface MemoryConflictProps {
  existing: MemoryItem;
  incoming: MemoryItem;
  /** Why they conflict, e.g. "Different store opening hours". */
  reason?: string;
  onResolve: (resolution: MemoryResolution) => void;
  className?: string;
}

/** Two memories that disagree, side by side, resolved by keeping one, both, or a merged version. */
export function MemoryConflict({ existing, incoming, reason, onResolve, className }: MemoryConflictProps) {
  const [merging, setMerging] = useState(false);
  const [text, setText] = useState(`${existing.text}\n${incoming.text}`);
  const id = useId();

  return (
    <section aria-labelledby={`${id}-title`} data-slot="memory-conflict" className={cn(card, "flex flex-col gap-2 border-warning/50 p-3 text-sm", className)}>
      <h4 id={`${id}-title`} className="flex items-center gap-2 font-medium">
        <GitMergeIcon aria-hidden="true" className="size-4 text-warning" />
        These memories disagree
      </h4>
      {reason && <p className="text-xs text-muted-foreground">{reason}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        {[
          { label: "Saved", memory: existing },
          { label: "New", memory: incoming },
        ].map(({ label, memory }) => (
          <figure key={label} className="flex flex-col gap-1 rounded-md border border-border p-2">
            <figcaption className="text-xs font-medium text-muted-foreground">{label}</figcaption>
            <p>{memory.text}</p>
            {memory.source && <p className="text-xs text-muted-foreground">From {memory.source}</p>}
          </figure>
        ))}
      </div>
      {merging ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (text.trim()) onResolve({ keep: "merged", text: text.trim() });
          }}
          className="flex flex-col gap-2"
        >
          <label htmlFor={`${id}-merged`} className="text-xs font-medium">
            Merged memory
          </label>
          <textarea id={`${id}-merged`} rows={3} value={text} onChange={(event) => setText(event.target.value)} className={cn("w-full resize-y rounded-md border border-input bg-background px-2 py-1.5", focusRing, "focus-visible:ring-offset-0")} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setMerging(false)} className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs", focusRing)}>
              Cancel
            </button>
            <button type="submit" disabled={!text.trim()} className={cn(button, buttonVariants.primary, "h-7 px-2 text-xs", focusRing)}>
              Save merged
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => onResolve({ keep: "existing" })} className={cn(button, buttonVariants.outline, "h-7 px-2 text-xs", focusRing)}>
            Keep saved
          </button>
          <button type="button" onClick={() => onResolve({ keep: "incoming" })} className={cn(button, buttonVariants.outline, "h-7 px-2 text-xs", focusRing)}>
            Use new
          </button>
          <button type="button" onClick={() => onResolve({ keep: "both" })} className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs", focusRing)}>
            Keep both
          </button>
          <button type="button" onClick={() => setMerging(true)} className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs", focusRing)}>
            Merge…
          </button>
        </div>
      )}
    </section>
  );
}

export interface MemoryConflictEntry {
  id: string;
  existing: MemoryItem;
  incoming: MemoryItem;
  reason?: string;
}

export interface MemoryManagerProps {
  memories: MemoryItem[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit?: (id: string, text: string) => void;
  /** Deletes a memory after confirmation. */
  onForget: (id: string) => void;
  conflicts?: MemoryConflictEntry[];
  onResolveConflict?: (conflictId: string, resolution: MemoryResolution) => void;
  className?: string;
}

const STATUS_LABEL: Record<MemoryStatus, string> = { pending: "Needs review", approved: "Approved", rejected: "Rejected" };

/**
 * What the assistant remembers: conflicts first, then memories to review
 * with approve and reject, confidence, source, age and expiry; search,
 * status and category filters; edit in place and forget with confirmation.
 */
export function MemoryManager({ memories, onApprove, onReject, onEdit, onForget, conflicts = [], onResolveConflict, className }: MemoryManagerProps) {
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [forgetting, setForgetting] = useState<MemoryItem | null>(null);
  const now = useNow(60_000);
  const id = useId();
  const allCategories = useMemo(() => [...new Set(memories.map((memory) => memory.category).filter((category): category is string => Boolean(category)))].sort(), [memories]);
  const order: Record<MemoryStatus, number> = { pending: 0, approved: 1, rejected: 2 };
  const needle = query.trim().toLowerCase();
  const shown = memories
    .filter((memory) => (!statuses.length || statuses.includes(memory.status)) && (!categories.length || (memory.category !== undefined && categories.includes(memory.category))) && (!needle || `${memory.text} ${memory.source ?? ""} ${memory.category ?? ""}`.toLowerCase().includes(needle)))
    .sort((a, b) => order[a.status] - order[b.status] || (b.createdAt ?? 0) - (a.createdAt ?? 0));
  const pending = memories.filter((memory) => memory.status === "pending").length;

  return (
    <section aria-labelledby={`${id}-title`} data-slot="memory-manager" className={cn("flex flex-col gap-3 text-sm", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <BrainIcon aria-hidden="true" className="size-4 text-muted-foreground" />
        <h3 id={`${id}-title`} className="font-medium">
          Memory
        </h3>
        <span className="text-xs text-muted-foreground">
          {memories.length} saved · {pending} to review
        </span>
      </div>
      {onResolveConflict && conflicts.map((conflict) => <MemoryConflict key={conflict.id} existing={conflict.existing} incoming={conflict.incoming} {...(conflict.reason ? { reason: conflict.reason } : {})} onResolve={(resolution) => onResolveConflict(conflict.id, resolution)} />)}
      <SearchInput label="Search memories" value={query} onValueChange={setQuery} placeholder="Search memories" resultCount={shown.length} />
      <div className="flex flex-wrap gap-3">
        <FilterChips label="Status" value={statuses} onValueChange={setStatuses} options={(Object.keys(STATUS_LABEL) as MemoryStatus[]).map((status) => ({ value: status, label: STATUS_LABEL[status], count: memories.filter((memory) => memory.status === status).length }))} />
        {allCategories.length > 0 && <FilterChips label="Category" value={categories} onValueChange={setCategories} clearLabel={false} options={allCategories.map((category) => ({ value: category, label: category }))} />}
      </div>
      <ul className="flex flex-col gap-2">
        {shown.map((memory) => {
          const expired = memory.expiresAt !== undefined && memory.expiresAt <= now;
          const meta = [
            memory.confidence !== undefined ? `${Math.round(memory.confidence * 100)}% confident` : "",
            memory.source ? `from ${memory.source}` : "",
            memory.createdAt !== undefined ? `saved ${formatRelativeTime(memory.createdAt, now)}` : "",
            memory.expiresAt !== undefined ? (expired ? "expired" : `expires ${formatRelativeTime(memory.expiresAt, now)}`) : "",
          ].filter(Boolean);
          return (
            <li key={memory.id} data-status={memory.status} className={cn(card, "flex flex-col gap-2 p-3", memory.status === "pending" && "border-ring")}>
              {editing?.id === memory.id ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (editing.text.trim()) onEdit?.(memory.id, editing.text.trim());
                    setEditing(null);
                  }}
                  className="flex flex-col gap-2"
                >
                  <label htmlFor={`${id}-${memory.id}`} className="sr-only">
                    Memory text
                  </label>
                  <textarea id={`${id}-${memory.id}`} rows={2} autoFocus value={editing.text} onChange={(event) => setEditing({ id: memory.id, text: event.target.value })} className={cn("w-full resize-y rounded-md border border-input bg-background px-2 py-1.5", focusRing, "focus-visible:ring-offset-0")} />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setEditing(null)} className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs", focusRing)}>
                      Cancel
                    </button>
                    <button type="submit" className={cn(button, buttonVariants.primary, "h-7 px-2 text-xs", focusRing)}>
                      Save
                    </button>
                  </div>
                </form>
              ) : (
                <p className={cn(memory.status === "rejected" && "text-muted-foreground line-through")}>{memory.text}</p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn(badge, memory.status === "pending" && "border-ring")}>{STATUS_LABEL[memory.status]}</span>
                {memory.category && <span className={badge}>{memory.category}</span>}
                {meta.length > 0 && <span className={cn("text-xs", expired ? "font-medium text-destructive" : "text-muted-foreground")}>{meta.join(" · ")}</span>}
                <span className="ml-auto flex items-center gap-1">
                  {memory.status !== "approved" && (
                    <button type="button" aria-label={`Approve: ${memory.text}`} title="Approve" onClick={() => onApprove(memory.id)} className={cn(button, buttonVariants.outline, "h-7 px-2 text-xs", focusRing)}>
                      <CheckIcon aria-hidden="true" />
                      Approve
                    </button>
                  )}
                  {memory.status === "pending" && (
                    <button type="button" aria-label={`Reject: ${memory.text}`} title="Reject" onClick={() => onReject(memory.id)} className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs", focusRing)}>
                      <XIcon aria-hidden="true" />
                      Reject
                    </button>
                  )}
                  {onEdit && editing?.id !== memory.id && (
                    <button type="button" aria-label={`Edit: ${memory.text}`} title="Edit" onClick={() => setEditing({ id: memory.id, text: memory.text })} className={cn(iconButton, "size-7", focusRing)}>
                      <PencilIcon aria-hidden="true" />
                    </button>
                  )}
                  <button type="button" aria-label={`Forget: ${memory.text}`} title="Forget" onClick={() => setForgetting(memory)} className={cn(iconButton, "size-7 hover:text-destructive", focusRing)}>
                    <Trash2Icon aria-hidden="true" />
                  </button>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 && <p className="text-muted-foreground">{memories.length ? "No memories match." : "Nothing remembered yet."}</p>}
      <ConfirmDialog
        open={forgetting !== null}
        onOpenChange={(next) => !next && setForgetting(null)}
        title="Forget this memory?"
        description={forgetting?.text ?? ""}
        confirmLabel="Forget"
        tone="destructive"
        onConfirm={() => {
          if (forgetting) onForget(forgetting.id);
        }}
      />
    </section>
  );
}
