// packages/ai-ui/src/lib/upload-queue.ts
export type UploadStatus = "queued" | "uploading" | "paused" | "needs-file" | "failed" | "done";

export interface UploadItem {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  /** Folder-relative path for folder uploads. */
  path?: string;
  status: UploadStatus;
  /** 0 to 1. */
  progress: number;
  error?: string;
  addedAt: number;
  /** Missing after a reload until the user re-attaches the file. */
  file?: File;
}

export interface RejectedFile {
  name: string;
  reason: string;
}

export interface UploadContext {
  signal: AbortSignal;
  onProgress: (fraction: number) => void;
  item: UploadItem;
}

export type UploadFn = (file: File, context: UploadContext) => Promise<void>;

export interface UploadQueueOptions {
  upload: UploadFn;
  concurrency?: number;
  /** Largest accepted file in bytes. Defaults to 1 GiB. */
  maxSize?: number;
  /** Same syntax as the input accept attribute: ".csv,image/*,application/pdf". */
  accept?: string;
  /** Keeps the queue (without file contents) in localStorage so it survives a reload. */
  persistKey?: string;
}

export interface UploadQueueSnapshot {
  items: UploadItem[];
  rejected: RejectedFile[];
}

const GIB = 1024 ** 3;

type UploadPatch = { [K in keyof UploadItem]?: UploadItem[K] | undefined };

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Whether a file passes an accept list such as ".csv,image/*". An empty list accepts everything. */
export function fileMatchesAccept(file: Pick<File, "name" | "type">, accept: string | undefined): boolean {
  if (!accept?.trim()) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return accept
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .some((entry) => (entry.startsWith(".") ? name.endsWith(entry) : entry.endsWith("/*") ? type.startsWith(entry.slice(0, -1)) : type === entry));
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Upload failed";
}

/**
 * Framework-free upload queue: concurrency limit, pause (aborts the request)
 * and resume, retry, removal, and persistence of everything but file
 * contents. After a reload unfinished items become "needs-file" until the
 * same file (name, size and modified time) is attached again.
 */
export class UploadQueueStore {
  private options: Required<Omit<UploadQueueOptions, "accept" | "persistKey">> & Pick<UploadQueueOptions, "accept" | "persistKey">;
  private snapshot: UploadQueueSnapshot = { items: [], rejected: [] };
  private readonly listeners = new Set<() => void>();
  private readonly controllers = new Map<string, AbortController>();

  constructor(options: UploadQueueOptions) {
    this.options = { concurrency: 3, maxSize: GIB, ...options };
    this.snapshot = { items: this.load(), rejected: [] };
  }

  configure(options: UploadQueueOptions) {
    this.options = { concurrency: 3, maxSize: GIB, ...options };
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  add(files: File[]): RejectedFile[] {
    const rejected: RejectedFile[] = [];
    const added: UploadItem[] = [];
    for (const file of files) {
      const label = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      if (file.size === 0) rejected.push({ name: label, reason: "The file is empty." });
      else if (file.size > this.options.maxSize) rejected.push({ name: label, reason: "The file is too large." });
      else if (!fileMatchesAccept(file, this.options.accept)) rejected.push({ name: label, reason: "This file type isn't accepted." });
      else {
        const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
        added.push({ id: newId(), name: file.name, size: file.size, type: file.type, lastModified: file.lastModified, ...(path ? { path } : {}), status: "queued", progress: 0, addedAt: Date.now(), file });
      }
    }
    this.set({ items: [...this.snapshot.items, ...added], rejected });
    this.pump();
    return rejected;
  }

  pause(id: string) {
    const item = this.find(id);
    if (!item || (item.status !== "uploading" && item.status !== "queued")) return;
    this.controllers.get(id)?.abort();
    this.controllers.delete(id);
    this.update(id, { status: "paused" });
    this.pump();
  }

  resume(id: string) {
    const item = this.find(id);
    if (!item || item.status !== "paused") return;
    this.update(id, { status: item.file ? "queued" : "needs-file" });
    this.pump();
  }

  retry(id: string) {
    const item = this.find(id);
    if (!item || item.status !== "failed") return;
    this.update(id, { status: item.file ? "queued" : "needs-file", progress: 0, error: undefined });
    this.pump();
  }

  remove(id: string) {
    this.controllers.get(id)?.abort();
    this.controllers.delete(id);
    this.set({ ...this.snapshot, items: this.snapshot.items.filter((item) => item.id !== id) });
    this.pump();
  }

  /** Attaches the file again after a reload; returns false when it is a different file. */
  reattach(id: string, file: File): boolean {
    const item = this.find(id);
    if (!item) return false;
    const same = file.name === item.name && file.size === item.size && (!item.lastModified || !file.lastModified || file.lastModified === item.lastModified);
    if (!same) {
      this.update(id, { error: `That file doesn't match ${item.name}.` });
      return false;
    }
    this.update(id, { file, status: "queued", progress: 0, error: undefined });
    this.pump();
    return true;
  }

  pauseAll() {
    for (const item of this.snapshot.items) if (item.status === "uploading" || item.status === "queued") this.pause(item.id);
  }

  resumeAll() {
    for (const item of this.snapshot.items) if (item.status === "paused") this.resume(item.id);
  }

  clearCompleted() {
    this.set({ ...this.snapshot, items: this.snapshot.items.filter((item) => item.status !== "done") });
  }

  /** Aborts running uploads and marks them paused; call on teardown. */
  abortAll() {
    for (const [id, controller] of this.controllers) {
      controller.abort();
      this.update(id, { status: "paused" });
    }
    this.controllers.clear();
  }

  private find(id: string) {
    return this.snapshot.items.find((item) => item.id === id);
  }

  private update(id: string, patch: UploadPatch) {
    this.set({
      ...this.snapshot,
      items: this.snapshot.items.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...patch } as UploadItem;
        if ("error" in patch && patch.error === undefined) delete next.error;
        return next;
      }),
    });
  }

  private set(snapshot: UploadQueueSnapshot) {
    this.snapshot = snapshot;
    this.save();
    for (const listener of this.listeners) listener();
  }

  private pump() {
    let running = this.controllers.size;
    for (const item of this.snapshot.items) {
      if (running >= this.options.concurrency) break;
      if (item.status === "queued" && item.file) {
        this.start(item, item.file);
        running++;
      }
    }
  }

  private start(item: UploadItem, file: File) {
    const controller = new AbortController();
    this.controllers.set(item.id, controller);
    this.update(item.id, { status: "uploading", progress: 0, error: undefined });
    let last = 0;
    this.options
      .upload(file, {
        signal: controller.signal,
        item,
        onProgress: (fraction) => {
          if (controller.signal.aborted) return;
          const next = Math.min(1, Math.max(0, fraction));
          if (next - last >= 0.01 || next === 1) {
            last = next;
            this.update(item.id, { progress: next });
          }
        },
      })
      .then(
        () => {
          if (this.controllers.get(item.id) === controller) this.update(item.id, { status: "done", progress: 1 });
        },
        (error: unknown) => {
          if (this.controllers.get(item.id) === controller && !controller.signal.aborted) this.update(item.id, { status: "failed", error: errorMessage(error) });
        },
      )
      .finally(() => {
        if (this.controllers.get(item.id) === controller) this.controllers.delete(item.id);
        this.pump();
      });
  }

  private load(): UploadItem[] {
    if (!this.options.persistKey || typeof window === "undefined") return [];
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(this.options.persistKey) ?? "[]");
      if (!Array.isArray(parsed)) return [];
      return (parsed as UploadItem[])
        .filter((item) => typeof item?.id === "string" && typeof item.name === "string")
        .map((item) => (item.status === "done" || item.status === "failed" ? item : { ...item, status: "needs-file" as const, progress: 0 }));
    } catch {
      return [];
    }
  }

  private save() {
    if (!this.options.persistKey || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(this.options.persistKey, JSON.stringify(this.snapshot.items.map(({ file: _file, ...rest }) => rest)));
    } catch {
      // Without storage the queue still works; it just won't survive a reload.
    }
  }
}
