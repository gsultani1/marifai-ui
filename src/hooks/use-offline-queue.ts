// packages/ai-ui/src/hooks/use-offline-queue.ts
import { useEffect, useState, useSyncExternalStore } from "react";

import { type OfflineQueueOptions, type OfflineQueueSnapshot, OfflineQueueStore, type QueuedAction } from "../lib/offline-queue.js";

const SERVER: OfflineQueueSnapshot = { actions: [], loaded: false, online: true };
const serverSnapshot = () => SERVER;

export interface OfflineQueueApi<Payload> extends OfflineQueueSnapshot {
  enqueue: (type: string, payload: Payload) => Promise<QueuedAction<Payload>>;
  retry: (id: string) => void;
  discard: (id: string) => void;
  flush: () => Promise<void>;
}

/** React binding for OfflineQueueStore. Create one queue per signed-in user (give each its own storage key). */
export function useOfflineQueue<Payload = unknown>(options: OfflineQueueOptions<Payload>): OfflineQueueApi<Payload> {
  const [store] = useState(() => new OfflineQueueStore<Payload>(options));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, serverSnapshot);

  useEffect(() => {
    store.configure(options);
  });

  useEffect(() => store.connect(), [store]);

  return {
    ...snapshot,
    enqueue: (type, payload) => store.enqueue(type, payload),
    retry: (id) => store.retry(id),
    discard: (id) => store.discard(id),
    flush: () => store.flush(),
  };
}
