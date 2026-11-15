// packages/ai-ui/src/lib/js-kernel.ts
import type { ExecutionOutput } from "./execution.js";

export interface NotebookKernel {
  /** Shown in the notebook header, e.g. "Python 3". */
  name: string;
  /** Runs code, streaming outputs; rejects with an AbortError when the signal aborts. */
  execute: (code: string, context: { signal: AbortSignal; onOutput: (output: ExecutionOutput) => void }) => Promise<{ status: "ok" | "error" }>;
  /** Clears the kernel's state. */
  restart?: () => Promise<void>;
}

const WORKER_SOURCE = `
const format = (value) => {
  if (typeof value === "string") return value;
  try { return JSON.stringify(value, null, 2) ?? String(value); } catch { return String(value); }
};
let current = 0;
const send = (output) => {
  try { self.postMessage({ id: current, output }); }
  catch { self.postMessage({ id: current, output: { type: "stdout", text: format(output.value ?? output.text) + "\\n" } }); }
};
const writer = (type) => (...args) => send({ type, text: args.map(format).join(" ") + "\\n" });
console.log = console.info = console.debug = writer("stdout");
console.warn = console.error = writer("stderr");
self.display = (value) => send(value !== null && typeof value === "object" ? { type: "json", value } : { type: "stdout", text: format(value) + "\\n" });
self.html = (markup) => send({ type: "html", html: String(markup) });
self.onmessage = async (event) => {
  current = event.data.id;
  try {
    let result = (0, eval)(event.data.code);
    if (result instanceof Promise) result = await result;
    if (result !== undefined) self.display(result);
    self.postMessage({ id: current, done: true, status: "ok" });
  } catch (error) {
    send({ type: "error", name: (error && error.name) || "Error", message: (error && error.message) || String(error), traceback: error && error.stack ? String(error.stack) : undefined });
    self.postMessage({ id: current, done: true, status: "error" });
  }
};
`;

/**
 * Notebook kernel that runs JavaScript in a Web Worker, off the page and
 * without access to it. console output streams as stdout and stderr, the
 * last expression is displayed, `display(value)` and `html(markup)` add rich
 * outputs, and top-level `var` and functions persist between cells.
 * Interrupting stops the worker, which also clears its state.
 */
export function createJavaScriptKernel({ name = "JavaScript" }: { name?: string } = {}): NotebookKernel & { dispose: () => void } {
  let worker: Worker | null = null;
  let nextId = 0;

  const start = (): Worker => {
    if (worker) return worker;
    const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
    worker = new Worker(url);
    URL.revokeObjectURL(url);
    return worker;
  };

  const stop = () => {
    worker?.terminate();
    worker = null;
  };

  return {
    name,
    execute: (code, { signal, onOutput }) =>
      new Promise((resolve, reject) => {
        if (signal.aborted) {
          reject(new DOMException("Interrupted", "AbortError"));
          return;
        }
        const target = start();
        const id = ++nextId;
        const cleanup = () => {
          target.removeEventListener("message", onMessage);
          target.removeEventListener("error", onError);
          signal.removeEventListener("abort", onAbort);
        };
        const onMessage = (event: MessageEvent<{ id: number; output?: ExecutionOutput; done?: boolean; status?: "ok" | "error" }>) => {
          if (event.data.id !== id) return;
          if (event.data.output) onOutput(event.data.output);
          if (event.data.done) {
            cleanup();
            resolve({ status: event.data.status ?? "ok" });
          }
        };
        const onError = (event: ErrorEvent) => {
          cleanup();
          stop();
          onOutput({ type: "error", name: "WorkerError", message: event.message || "The kernel stopped unexpectedly." });
          resolve({ status: "error" });
        };
        const onAbort = () => {
          cleanup();
          stop();
          reject(new DOMException("Interrupted", "AbortError"));
        };
        target.addEventListener("message", onMessage);
        target.addEventListener("error", onError);
        signal.addEventListener("abort", onAbort);
        target.postMessage({ id, code });
      }),
    restart: async () => stop(),
    dispose: stop,
  };
}
