// packages/ai-ui/src/lib/offline-queue.ts
export type QueuedActionStatus = "pending" | "sending" | "parked";

export interface QueuedAction<Payload = unknown> {
  id: string;
  type: string;
  payload: Payload;
  createdAt: number;
  attempts: number;
  status: QueuedActionStatus;
  lastError?: string;
  /** Earliest time of the next automatic attempt. */
  retryAt?: number;
}

/** Async storage for the queue; keep one key per signed-in user. */
export interface OfflineQueueStorage {
  load: () => Promise<QueuedAction[]>;
  save: (actions: QueuedAction[]) => Promise<void>;
}

export interface OfflineQueueOptions<Payload = unknown> {
  send: (action: QueuedAction<Payload>) => Promise<void>;
  storage: OfflineQueueStorage;
  /** Failed attempts before an action is parked for review. Parked actions are never dropped automatically. */
  maxAttempts?: number;
  /** Delay before retry n (1-based). */
  backoffMs?: (attempt: number) => number;
}

export interface OfflineQueueSnapshot {
  actions: QueuedAction[];
  loaded: boolean;
  online: boolean;
}

const defaultBackoff = (attempt: number) => Math.min(60_000, 1000 * 2 ** (attempt - 1));

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function message(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Couldn't sync";
}

/** Stores the queue in localStorage under one key. */
export function localStorageQueueStorage(key: string): OfflineQueueStorage {
  return {
    load: async () => {
      try {
        const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
        return Array.isArray(parsed) ? (parsed as QueuedAction[]) : [];
      } catch {
        return [];
      }
    },
    save: async (actions) => {
      window.localStorage.setItem(key, JSON.stringify(actions));
    },
  };
}

/** Stores the queue in IndexedDB, which holds more than localStorage and survives storage pressure better. */
export function indexedDbQueueStorage(key: string, databaseName = "ai-ui-offline-queue"): OfflineQueueStorage {
  const open = () =>
    new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("queues");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  const run = async <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) => {
    const db = await open();
    try {
      return await new Promise<T>((resolve, reject) => {
        const request = action(db.transaction("queues", mode).objectStore("queues"));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  };
  return {
    load: async () => {
      const value = await run<unknown>("readonly", (store) => store.get(key));
      return Array.isArray(value) ? (value as QueuedAction[]) : [];
    },
    save: async (actions) => {
      await run("readwrite", (store) => store.put(actions, key));
    },
  };
}

/**
 * Offline outbox for writes: actions persist through reloads, send in order
 * when online (one at a time, so later actions never overtake earlier ones),
 * back off between failures, and park after `maxAttempts` for the user to
 * retry or discard. Nothing is ever dropped without an explicit discard.
 * Call `connect()` to start syncing (the React hook does this while mounted).
 */
export class OfflineQueueStore<Payload = unknown> {
  private options: Required<OfflineQueueOptions<Payload>>;
  private snapshot: OfflineQueueSnapshot = { actions: [], loaded: false, online: true };
  private readonly listeners = new Set<() => void>();
  private flushing = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly ready: Promise<void>;
  private connections = 0;

  constructor(options: OfflineQueueOptions<Payload>) {
    this.options = { maxAttempts: 5, backoffMs: defaultBackoff, ...options };
    this.snapshot = { ...this.snapshot, online: typeof navigator === "undefined" ? true : navigator.onLine };
    this.ready = this.options.storage.load().then(
      (actions) => {
        const restored = actions.map((action) => (action.status === "sending" ? { ...action, status: "pending" as const } : action));
        this.set({ ...this.snapshot, actions: [...restored, ...this.snapshot.actions.filter((action) => !restored.some((item) => item.id === action.id))], loaded: true });
        void this.flush();
      },
      () => this.set({ ...this.snapshot, loaded: true }),
    );
  }

  /** Starts syncing and following online state; returns the matching disconnect. */
  connect(): () => void {
    this.connections++;
    if (this.connections === 1 && typeof window !== "undefined") {
      window.addEventListener("online", this.onOnline);
      window.addEventListener("offline", this.onOffline);
      this.set({ ...this.snapshot, online: navigator.onLine });
      void this.flush();
    }
    return () => {
      this.connections = Math.max(0, this.connections - 1);
      if (this.connections > 0) return;
      clearTimeout(this.timer);
      if (typeof window !== "undefined") {
        window.removeEventListener("online", this.onOnline);
        window.removeEventListener("offline", this.onOffline);
      }
    };
  }

  configure(options: OfflineQueueOptions<Payload>) {
    this.options = { maxAttempts: 5, backoffMs: defaultBackoff, ...options };
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  async enqueue(type: string, payload: Payload): Promise<QueuedAction<Payload>> {
    await this.ready;
    const action: QueuedAction<Payload> = { id: newId(), type, payload, createdAt: Date.now(), attempts: 0, status: "pending" };
    this.set({ ...this.snapshot, actions: [...this.snapshot.actions, action] });
    void this.flush();
    return action;
  }

  /** Moves a parked action back into the queue and tries again. */
  retry(id: string) {
    this.patch(id, { status: "pending", attempts: 0, retryAt: undefined });
    void this.flush();
  }

  /** Removes an action for good; only call this from an explicit user choice. */
  discard(id: string) {
    this.set({ ...this.snapshot, actions: this.snapshot.actions.filter((action) => action.id !== id) });
  }

  async flush(): Promise<void> {
    if (this.flushing || this.connections === 0 || !this.snapshot.online) return;
    this.flushing = true;
    clearTimeout(this.timer);
    try {
      for (;;) {
        const next = this.snapshot.actions.find((action) => action.status === "pending");
        if (!next || !this.snapshot.online) break;
        if (next.retryAt && next.retryAt > Date.now()) {
          this.timer = setTimeout(() => void this.flush(), next.retryAt - Date.now());
          break;
        }
        this.patch(next.id, { status: "sending" });
        try {
          await this.options.send(next as QueuedAction<Payload>);
          this.set({ ...this.snapshot, actions: this.snapshot.actions.filter((action) => action.id !== next.id) });
        } catch (error) {
          const attempts = next.attempts + 1;
          const parked = attempts >= this.options.maxAttempts;
          this.patch(next.id, { status: parked ? "parked" : "pending", attempts, lastError: message(error), retryAt: parked ? undefined : Date.now() + this.options.backoffMs(attempts) });
          if (!parked) continue;
        }
      }
    } finally {
      this.flushing = false;
    }
  }

  private onOnline = () => {
    this.set({ ...this.snapshot, online: true });
    void this.flush();
  };

  private onOffline = () => this.set({ ...this.snapshot, online: false });

  private patch(id: string, patch: { [K in keyof QueuedAction]?: QueuedAction[K] | undefined }) {
    this.set({
      ...this.snapshot,
      actions: this.snapshot.actions.map((action) => {
        if (action.id !== id) return action;
        const next: Record<string, unknown> = { ...action, ...patch };
        for (const [key, value] of Object.entries(patch)) if (value === undefined) delete next[key];
        return next as unknown as QueuedAction;
      }),
    });
  }

  private set(snapshot: OfflineQueueSnapshot) {
    const persist = snapshot.actions !== this.snapshot.actions;
    this.snapshot = snapshot;
    if (persist && snapshot.loaded) void this.options.storage.save(snapshot.actions).catch(() => undefined);
    for (const listener of this.listeners) listener();
  }
}
