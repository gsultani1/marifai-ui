// packages/ai-ui/src/hooks/use-upload-queue.ts
import { useEffect, useState, useSyncExternalStore } from "react";

import { type UploadQueueOptions, type UploadQueueSnapshot, UploadQueueStore } from "../lib/upload-queue.js";

const EMPTY: UploadQueueSnapshot = { items: [], rejected: [] };
const serverSnapshot = () => EMPTY;

export interface UploadQueueApi extends UploadQueueSnapshot {
  add: (files: File[]) => void;
  pause: (id: string) => void;
  resume: (id: string) => void;
  retry: (id: string) => void;
  remove: (id: string) => void;
  reattach: (id: string, file: File) => boolean;
  pauseAll: () => void;
  resumeAll: () => void;
  clearCompleted: () => void;
}

/** React binding for UploadQueueStore; running uploads pause when the component unmounts. */
export function useUploadQueue(options: UploadQueueOptions): UploadQueueApi {
  const [store] = useState(() => new UploadQueueStore(options));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, serverSnapshot);

  useEffect(() => {
    store.configure(options);
  });

  useEffect(() => () => store.abortAll(), [store]);

  return {
    ...snapshot,
    add: (files) => void store.add(files),
    pause: (id) => store.pause(id),
    resume: (id) => store.resume(id),
    retry: (id) => store.retry(id),
    remove: (id) => store.remove(id),
    reattach: (id, file) => store.reattach(id, file),
    pauseAll: () => store.pauseAll(),
    resumeAll: () => store.resumeAll(),
    clearCompleted: () => store.clearCompleted(),
  };
}
