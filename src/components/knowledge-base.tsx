// packages/ai-ui/src/components/knowledge-base.tsx
"use client";

import { DatabaseIcon, FileTextIcon, LoaderCircleIcon, PlusIcon, RefreshCwIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { type FormEvent, useId, useState } from "react";

import { useNow } from "../hooks/use-now.js";
import { badge, button, buttonVariants, card, focusRing, iconButton, input, type Tone, toneDot } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatBytes, formatRelativeTime } from "../lib/format.js";
import { ConfirmDialog } from "./confirm-dialog.js";
import { FileDropzone } from "./file-dropzone.js";

export type IngestionStatus = "queued" | "processing" | "indexed" | "failed" | "stale";

export interface KnowledgeDocument {
  id: string;
  name: string;
  size?: number;
  status: IngestionStatus;
  /** 0 to 1 while processing. */
  progress?: number;
  chunks?: number;
  updatedAt?: number;
  error?: string;
}

export interface KnowledgeCollection {
  id: string;
  name: string;
  description?: string;
  documents: KnowledgeDocument[];
  updatedAt?: number;
}

const STATUS: Record<IngestionStatus, { label: string; tone: Tone }> = {
  queued: { label: "Queued", tone: "neutral" },
  processing: { label: "Indexing", tone: "info" },
  indexed: { label: "Ready", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  stale: { label: "Out of date", tone: "warning" },
};

/** Overall state of a collection: indexing while any document is, then failed, out of date or ready. */
export function collectionHealth(documents: readonly KnowledgeDocument[]): IngestionStatus {
  if (documents.some((document) => document.status === "processing" || document.status === "queued")) return "processing";
  if (documents.some((document) => document.status === "failed")) return "failed";
  if (documents.some((document) => document.status === "stale")) return "stale";
  return "indexed";
}

export interface KnowledgeBaseProps {
  collections: KnowledgeCollection[];
  /** Collections the assistant searches when answering. */
  sourceIds: string[];
  onSourceIdsChange: (ids: string[]) => void;
  onUpload?: (collectionId: string, files: File[]) => void;
  onReindex?: (collectionId: string) => void | Promise<void>;
  onRetry?: (collectionId: string, documentId: string) => void;
  /** Removes a document after confirmation. */
  onRemoveDocument?: (collectionId: string, documentId: string) => void;
  onCreateCollection?: (name: string) => void;
  defaultSelectedId?: string;
  className?: string;
}

/**
 * Document collections the assistant can search: each with its health and
 * a "use as source" switch, and for the open collection an upload area and
 * every document's indexing status with progress, chunk count, retry,
 * re-index and removal.
 */
export function KnowledgeBase({ collections, sourceIds, onSourceIdsChange, onUpload, onReindex, onRetry, onRemoveDocument, onCreateCollection, defaultSelectedId, className }: KnowledgeBaseProps) {
  const [selectedId, setSelectedId] = useState(defaultSelectedId ?? collections[0]?.id ?? "");
  const [reindexing, setReindexing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [removing, setRemoving] = useState<KnowledgeDocument | null>(null);
  const now = useNow(60_000);
  const id = useId();
  const selected = collections.find((collection) => collection.id === selectedId) ?? collections[0];

  const create = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    onCreateCollection?.(name.trim());
    setName("");
    setCreating(false);
  };

  const reindex = async () => {
    if (!selected) return;
    setReindexing(true);
    try {
      await onReindex?.(selected.id);
    } finally {
      setReindexing(false);
    }
  };

  return (
    <section aria-labelledby={`${id}-title`} data-slot="knowledge-base" className={cn("grid gap-3 text-sm md:grid-cols-[16rem_1fr]", className)}>
      <h3 id={`${id}-title`} className="sr-only">
        Knowledge base
      </h3>
      <div className="flex flex-col gap-2">
        <ul aria-label="Collections" className="flex flex-col gap-1">
          {collections.map((collection) => {
            const health = STATUS[collectionHealth(collection.documents)];
            const active = collection.id === selected?.id;
            return (
              <li key={collection.id} className={cn("flex items-center gap-2 rounded-md border px-2 py-1.5", active ? "border-ring bg-accent/40" : "border-transparent")}>
                <input
                  type="checkbox"
                  aria-label={`Use ${collection.name} as a source`}
                  checked={sourceIds.includes(collection.id)}
                  onChange={(event) => onSourceIdsChange(event.target.checked ? [...sourceIds, collection.id] : sourceIds.filter((item) => item !== collection.id))}
                  className="size-4 shrink-0 accent-primary"
                />
                <button type="button" aria-current={active ? "true" : undefined} onClick={() => setSelectedId(collection.id)} className={cn("flex min-w-0 flex-1 flex-col rounded-sm text-left", focusRing)}>
                  <span className="truncate font-medium">{collection.name}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span aria-hidden="true" className={cn("size-1.5 rounded-full", toneDot[health.tone])} />
                    {health.label} · {collection.documents.length} {collection.documents.length === 1 ? "document" : "documents"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {onCreateCollection &&
          (creating ? (
            <form onSubmit={create} className="flex gap-1">
              <label htmlFor={`${id}-name`} className="sr-only">
                Collection name
              </label>
              <input id={`${id}-name`} autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Escape" && setCreating(false)} placeholder="Collection name" className={cn(input, "h-8", focusRing, "focus-visible:ring-offset-0")} />
              <button type="submit" disabled={!name.trim()} className={cn(button, buttonVariants.primary, focusRing)}>
                Create
              </button>
            </form>
          ) : (
            <button type="button" onClick={() => setCreating(true)} className={cn(button, buttonVariants.ghost, "self-start", focusRing)}>
              <PlusIcon aria-hidden="true" />
              New collection
            </button>
          ))}
      </div>
      {selected ? (
        <div aria-label={selected.name} role="region" className={cn(card, "flex min-w-0 flex-col gap-3 p-3")}>
          <div className="flex flex-wrap items-start gap-2">
            <DatabaseIcon aria-hidden="true" className="mt-0.5 size-4 text-muted-foreground" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium">{selected.name}</span>
              {selected.description && <span className="text-xs text-muted-foreground">{selected.description}</span>}
            </div>
            {sourceIds.includes(selected.id) && <span className={cn(badge, "border-primary/40")}>Used as a source</span>}
            {onReindex && (
              <button type="button" disabled={reindexing} onClick={() => void reindex()} className={cn(button, buttonVariants.outline, "h-7 px-2 text-xs", focusRing)}>
                <RefreshCwIcon aria-hidden="true" className={cn(reindexing && "motion-safe:animate-spin")} />
                Re-index
              </button>
            )}
          </div>
          {onUpload && <FileDropzone onFiles={(files) => files.length && onUpload(selected.id, files)} title="Drop documents here, or" description="PDF, Word, Markdown, text and CSV" />}
          <ul aria-label={`${selected.name} documents`} className="flex flex-col divide-y divide-border">
            {selected.documents.map((document) => {
              const status = STATUS[document.status];
              const percent = Math.round(Math.min(1, Math.max(0, document.progress ?? 0)) * 100);
              return (
                <li key={document.id} data-status={document.status} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <FileTextIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{document.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{[document.size !== undefined ? formatBytes(document.size) : "", document.chunks !== undefined ? `${document.chunks} chunks` : "", document.updatedAt !== undefined ? formatRelativeTime(document.updatedAt, now) : ""].filter(Boolean).join(" · ")}</span>
                  <span className={badge}>
                    {document.status === "processing" ? <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" /> : <span aria-hidden="true" className={cn("size-2 rounded-full", toneDot[status.tone])} />}
                    {status.label}
                    {document.status === "processing" && document.progress !== undefined && <span className="tabular-nums"> {percent}%</span>}
                  </span>
                  {document.status === "failed" && onRetry && (
                    <button type="button" aria-label={`Retry ${document.name}`} title="Retry" onClick={() => onRetry(selected.id, document.id)} className={cn(iconButton, "size-7", focusRing)}>
                      <RotateCcwIcon aria-hidden="true" />
                    </button>
                  )}
                  {onRemoveDocument && (
                    <button type="button" aria-label={`Remove ${document.name}`} title="Remove" onClick={() => setRemoving(document)} className={cn(iconButton, "size-7 hover:text-destructive", focusRing)}>
                      <Trash2Icon aria-hidden="true" />
                    </button>
                  )}
                  {document.status === "processing" && document.progress !== undefined && (
                    <div role="progressbar" aria-label={`Indexing ${document.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-1 w-full overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                    </div>
                  )}
                  {document.status === "failed" && document.error && <p className="w-full pl-7 text-xs font-medium text-destructive">{document.error}</p>}
                </li>
              );
            })}
          </ul>
          {selected.documents.length === 0 && <p className="text-muted-foreground">No documents yet.</p>}
        </div>
      ) : (
        <p className="text-muted-foreground">Create a collection to add documents.</p>
      )}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(next) => !next && setRemoving(null)}
        title={`Remove ${removing?.name ?? ""}?`}
        description="It is removed from the collection and its index. The assistant can no longer cite it."
        confirmLabel="Remove"
        tone="destructive"
        onConfirm={() => {
          if (removing && selected) onRemoveDocument?.(selected.id, removing.id);
        }}
      />
    </section>
  );
}
