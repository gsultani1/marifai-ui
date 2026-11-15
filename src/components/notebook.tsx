// packages/ai-ui/src/components/notebook.tsx
"use client";

import { ArrowDownIcon, ArrowUpIcon, CodeIcon, DownloadIcon, EraserIcon, FileUpIcon, LoaderCircleIcon, MoreHorizontalIcon, PilcrowIcon, PlayIcon, PlusIcon, RotateCcwIcon, SquareIcon, Trash2Icon } from "lucide-react";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { button, buttonVariants, focusRing, iconButton, type Tone } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { downloadText } from "../lib/download.js";
import { type ExecutionOutput, type NotebookCell, type NotebookCellType, notebookFromIpynb, notebookToIpynb } from "../lib/execution.js";
import type { NotebookKernel } from "../lib/js-kernel.js";
import { ActionMenu } from "./action-menu.js";
import { CodeEditor } from "./code-editor.js";
import { ExecutionOutputView } from "./execution-output.js";
import { MessageContent } from "./message-content.js";
import { StatusPill } from "./status-pill.js";

export type KernelStatus = "idle" | "busy" | "restarting";

export interface NotebookProps {
  kernel: NotebookKernel;
  cells?: NotebookCell[];
  defaultCells?: NotebookCell[];
  onCellsChange?: (cells: NotebookCell[]) => void;
  /** Language of code cells for highlighting and export, e.g. "python" or "javascript". */
  language?: string;
  title?: string;
  /** File name for "Export". */
  fileName?: string;
  /** Lets HTML outputs run scripts inside their sandboxed frame. */
  allowScripts?: boolean;
  className?: string;
}

const MAX_STREAM = 1_000_000;

/** A new empty cell with a unique id. */
export function createNotebookCell(type: NotebookCellType = "code", source = ""): NotebookCell {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `cell-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return { id, type, source, ...(type === "code" ? { outputs: [], executionCount: null } : {}) };
}

/** Adds an output, merging consecutive text from the same stream and capping very long streams. */
export function appendExecutionOutput(outputs: ExecutionOutput[], output: ExecutionOutput): ExecutionOutput[] {
  const last = outputs[outputs.length - 1];
  if (last && (output.type === "stdout" || output.type === "stderr") && last.type === output.type) {
    const text = last.text + output.text;
    return [...outputs.slice(0, -1), { type: output.type, text: text.length > MAX_STREAM ? `[earlier output truncated]\n${text.slice(-MAX_STREAM)}` : text }];
  }
  return [...outputs, output];
}

const KERNEL_STATUS: Record<KernelStatus, { label: string; tone: Tone }> = {
  idle: { label: "Idle", tone: "success" },
  busy: { label: "Busy", tone: "info" },
  restarting: { label: "Restarting", tone: "warning" },
};

interface CellViewProps {
  cell: NotebookCell;
  index: number;
  count: number;
  language: string;
  editing: boolean;
  focus: boolean;
  allowScripts: boolean;
  onSourceChange: (source: string) => void;
  onRun: (then: "stay" | "next" | "insert") => void;
  onEdit: () => void;
  onAction: (action: "up" | "down" | "convert" | "add-code" | "add-text" | "clear" | "delete") => void;
}

function NotebookCellView({ cell, index, count, language, editing, focus, allowScripts, onSourceChange, onRun, onEdit, onAction }: CellViewProps) {
  const number = index + 1;
  const isCode = cell.type === "code";
  const running = cell.status === "running";
  const status = running ? "running" : cell.status === "queued" ? "queued" : cell.status === "error" ? "failed" : cell.executionCount ? `ran as execution ${cell.executionCount}` : "not run";

  const onKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    const then = event.shiftKey ? "next" : event.metaKey || event.ctrlKey ? "stay" : event.altKey ? "insert" : null;
    if (!then) return;
    event.preventDefault();
    event.stopPropagation();
    onRun(then);
  };

  return (
    <div role="group" aria-label={`Cell ${number}, ${isCode ? "code" : "text"}`} data-status={cell.status ?? "idle"} className="group/cell flex gap-2">
      <div className="flex w-12 shrink-0 flex-col items-end gap-1 pt-1.5">
        <button type="button" aria-label={`Run cell ${number}`} title="Run cell (Shift+Enter)" onClick={() => onRun("stay")} className={cn(iconButton, "size-7", running && "text-foreground", focusRing)}>
          {running ? <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" /> : <PlayIcon aria-hidden="true" />}
        </button>
        {isCode && (
          <span className="font-mono text-[0.6875rem] text-muted-foreground tabular-nums">
            <span aria-hidden="true">[{running || cell.status === "queued" ? "*" : (cell.executionCount ?? " ")}]</span>
            <span className="sr-only">Cell {number} {status}</span>
          </span>
        )}
      </div>
      <div className={cn("flex min-w-0 flex-1 flex-col gap-2 rounded-lg border p-1.5 transition-colors", cell.status === "error" ? "border-destructive/50" : running ? "border-ring" : "border-transparent focus-within:border-border hover:border-border")}>
        <div onKeyDownCapture={onKeyDownCapture} className="relative">
          {isCode || editing ? (
            <CodeEditor
              value={cell.source}
              onValueChange={onSourceChange}
              language={isCode ? language : "markdown"}
              lineNumbers={false}
              autoFocus={focus}
              aria-label={`Cell ${number} ${isCode ? "code" : "text"}`}
              placeholder={isCode ? "Write code, then press Shift+Enter" : "Write Markdown, then press Shift+Enter"}
              className="min-h-0 rounded-md"
            />
          ) : (
            <div
              tabIndex={0}
              role="group"
              aria-label={`Text cell ${number}, press Enter to edit`}
              aria-keyshortcuts="Enter"
              data-rendered-cell={cell.id}
              onDoubleClick={onEdit}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  onEdit();
                }
              }}
              className={cn("cursor-text rounded-md px-3 py-2 text-sm", focusRing, "focus-visible:ring-offset-0")}
            >
              {cell.source.trim() ? <MessageContent>{cell.source}</MessageContent> : <p className="text-muted-foreground">Empty text cell. Press Enter to edit.</p>}
            </div>
          )}
          <div className="absolute top-1 right-1 z-10 opacity-0 group-focus-within/cell:opacity-100 group-hover/cell:opacity-100 [@media(hover:none)]:opacity-100">
            <ActionMenu
              align="end"
              items={[
                { id: "up", label: "Move up", icon: <ArrowUpIcon aria-hidden="true" />, disabled: index === 0, onSelect: () => onAction("up") },
                { id: "down", label: "Move down", icon: <ArrowDownIcon aria-hidden="true" />, disabled: index === count - 1, onSelect: () => onAction("down") },
                { id: "convert", label: isCode ? "Change to text" : "Change to code", icon: isCode ? <PilcrowIcon aria-hidden="true" /> : <CodeIcon aria-hidden="true" />, onSelect: () => onAction("convert") },
                { type: "separator", id: "separator-add" },
                { id: "add-code", label: "Add code cell below", icon: <PlusIcon aria-hidden="true" />, onSelect: () => onAction("add-code") },
                { id: "add-text", label: "Add text cell below", icon: <PlusIcon aria-hidden="true" />, onSelect: () => onAction("add-text") },
                ...(isCode ? [{ id: "clear", label: "Clear output", icon: <EraserIcon aria-hidden="true" />, disabled: !cell.outputs?.length, onSelect: () => onAction("clear") }] : []),
                { type: "separator", id: "separator-delete" },
                { id: "delete", label: "Delete cell", icon: <Trash2Icon aria-hidden="true" />, destructive: true, onSelect: () => onAction("delete") },
              ]}
              trigger={
                <button type="button" aria-label={`More actions for cell ${number}`} className={cn(iconButton, "size-7 bg-background/80 backdrop-blur", focusRing)}>
                  <MoreHorizontalIcon aria-hidden="true" />
                </button>
              }
            />
          </div>
        </div>
        {isCode && (cell.outputs?.length ?? 0) > 0 && (
          <div aria-label={`Output of cell ${number}`} role="region" className="pl-1">
            <ExecutionOutputView outputs={cell.outputs!} allowScripts={allowScripts} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Notebook with code and text cells on a pluggable kernel: Shift+Enter
 * runs and moves on, Ctrl or Cmd+Enter runs in place, Alt+Enter runs and
 * adds a cell; execution counts, queued and running states, run all that
 * stops at the first failure, interrupt, restart, rich outputs, and
 * .ipynb export and import.
 */
export function Notebook({ kernel, cells: cellsProp, defaultCells, onCellsChange, language = "python", title = "Notebook", fileName = "notebook.ipynb", allowScripts = false, className }: NotebookProps) {
  const [cells, setCells] = useControllableState<NotebookCell[]>({ value: cellsProp, defaultValue: defaultCells ?? [createNotebookCell("code")], onChange: onCellsChange });
  const [kernelStatus, setKernelStatus] = useState<KernelStatus>("idle");
  const [editing, setEditing] = useState<Set<string>>(() => new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<{ cell: NotebookCell; index: number } | null>(null);
  const latest = useRef(cells);
  const counter = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const generation = useRef(0);
  const pending = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const id = useId();

  // Arrays this component produced. Only cells from the parent replace the working copy; syncing our own
  // older snapshots back after a render would undo updates made since by a running cell.
  const produced = useRef(new WeakSet<NotebookCell[]>());

  useEffect(() => {
    if (!produced.current.has(cells)) latest.current = cells;
  }, [cells]);

  const commit = (next: NotebookCell[]) => {
    produced.current.add(next);
    latest.current = next;
    setCells(next);
  };
  const updateCell = (cellId: string, change: (cell: NotebookCell) => NotebookCell) => commit(latest.current.map((cell) => (cell.id === cellId ? change(cell) : cell)));
  const stopEditing = (cellId: string) =>
    setEditing((current) => {
      if (!current.has(cellId)) return current;
      const next = new Set(current);
      next.delete(cellId);
      return next;
    });

  const execute = async (cellId: string, run: number): Promise<"ok" | "error" | "skipped"> => {
    const cell = latest.current.find((item) => item.id === cellId);
    if (!cell) return "skipped";
    if (run !== generation.current) {
      updateCell(cellId, (item) => ({ ...item, status: "idle" }));
      return "skipped";
    }
    if (cell.type === "markdown") {
      stopEditing(cellId);
      return "ok";
    }
    updateCell(cellId, (item) => ({ ...item, status: "running", outputs: [], executionCount: null }));
    setKernelStatus("busy");
    const abort = new AbortController();
    controller.current = abort;
    let status: "ok" | "error" = "ok";
    try {
      const result = await kernel.execute(cell.source, { signal: abort.signal, onOutput: (output) => updateCell(cellId, (item) => ({ ...item, outputs: appendExecutionOutput(item.outputs ?? [], output) })) });
      status = result.status;
    } catch (error) {
      status = "error";
      const interrupted = abort.signal.aborted || (error instanceof DOMException && error.name === "AbortError");
      const output: ExecutionOutput = interrupted ? { type: "error", name: "Interrupted", message: "Execution was stopped." } : { type: "error", name: error instanceof Error ? error.name : "Error", message: error instanceof Error ? error.message : String(error) };
      updateCell(cellId, (item) => ({ ...item, outputs: [...(item.outputs ?? []), output] }));
    }
    if (controller.current === abort) controller.current = null;
    counter.current += 1;
    const executionCount = counter.current;
    updateCell(cellId, (item) => ({ ...item, status: status === "ok" ? "success" : "error", executionCount }));
    return status;
  };

  const enqueue = (ids: string[], stopOnError: boolean) => {
    const run = generation.current;
    setNotice(null);
    setDeleted(null);
    commit(latest.current.map((cell) => (ids.includes(cell.id) && cell.type === "code" ? { ...cell, status: "queued" } : cell)));
    pending.current += 1;
    const task = async () => {
      for (const [index, cellId] of ids.entries()) {
        const result = await execute(cellId, run);
        if (result === "error" && stopOnError) {
          const rest = ids.slice(index + 1);
          commit(latest.current.map((cell) => (rest.includes(cell.id) && cell.status === "queued" ? { ...cell, status: "idle" } : cell)));
          setNotice(`Stopped at cell ${latest.current.findIndex((cell) => cell.id === cellId) + 1} because it failed.`);
          break;
        }
      }
    };
    queue.current = queue.current.then(task, task).finally(() => {
      pending.current -= 1;
      if (pending.current === 0) setKernelStatus((current) => (current === "restarting" ? current : "idle"));
    });
  };

  const insertAfter = (index: number, type: NotebookCellType) => {
    const cell = createNotebookCell(type);
    const next = [...latest.current];
    next.splice(index + 1, 0, cell);
    commit(next);
    if (type === "markdown") setEditing((current) => new Set(current).add(cell.id));
    setFocusId(cell.id);
    return cell;
  };

  const runCell = (cellId: string, then: "stay" | "next" | "insert") => {
    enqueue([cellId], false);
    const index = latest.current.findIndex((cell) => cell.id === cellId);
    if (then === "insert" || (then === "next" && index === latest.current.length - 1)) insertAfter(index, "code");
    else if (then === "next") {
      const next = latest.current[index + 1]!;
      setFocusId(next.id);
      if (next.type === "markdown") requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-rendered-cell="${next.id}"]`)?.focus());
    }
  };

  const interrupt = () => {
    generation.current += 1;
    controller.current?.abort();
    commit(latest.current.map((cell) => (cell.status === "queued" ? { ...cell, status: "idle" } : cell)));
  };

  const restart = async () => {
    interrupt();
    setKernelStatus("restarting");
    try {
      await kernel.restart?.();
      counter.current = 0;
      setNotice("Kernel restarted. Variables were cleared.");
    } catch (error) {
      setNotice(`Couldn't restart the kernel: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setKernelStatus("idle");
    }
  };

  const onAction = (cell: NotebookCell, index: number, action: Parameters<CellViewProps["onAction"]>[0]) => {
    const list = [...latest.current];
    if (action === "up" || action === "down") {
      const target = action === "up" ? index - 1 : index + 1;
      [list[index], list[target]] = [list[target]!, list[index]!];
      commit(list);
    } else if (action === "convert") {
      updateCell(cell.id, (item) => (item.type === "code" ? { id: item.id, type: "markdown", source: item.source } : { ...createNotebookCell("code", item.source), id: item.id }));
      if (cell.type === "code") setEditing((current) => new Set(current).add(cell.id));
      setFocusId(cell.id);
    } else if (action === "add-code" || action === "add-text") insertAfter(index, action === "add-code" ? "code" : "markdown");
    else if (action === "clear") updateCell(cell.id, (item) => ({ ...item, outputs: [], executionCount: null, status: "idle" }));
    else if (action === "delete") {
      list.splice(index, 1);
      commit(list.length ? list : [createNotebookCell("code")]);
      setDeleted({ cell, index });
      setNotice(null);
    }
  };

  const busy = kernelStatus !== "idle";
  const meta = KERNEL_STATUS[kernelStatus];

  return (
    <section aria-labelledby={`${id}-title`} data-slot="notebook" className={cn("flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-background", className)}>
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
        <h3 id={`${id}-title`} className="mr-2 truncate text-sm font-semibold">
          {title}
        </h3>
        <button type="button" onClick={() => enqueue(latest.current.map((cell) => cell.id), true)} disabled={kernelStatus === "restarting"} className={cn(button, buttonVariants.ghost, "h-7 px-2", focusRing)}>
          <PlayIcon aria-hidden="true" />
          Run all
        </button>
        <button type="button" onClick={interrupt} disabled={kernelStatus !== "busy"} className={cn(button, buttonVariants.ghost, "h-7 px-2", focusRing)}>
          <SquareIcon aria-hidden="true" />
          Interrupt
        </button>
        <button type="button" onClick={() => void restart()} disabled={kernelStatus === "restarting" || !kernel.restart} className={cn(button, buttonVariants.ghost, "h-7 px-2", focusRing)}>
          <RotateCcwIcon aria-hidden="true" />
          Restart
        </button>
        <button type="button" onClick={() => commit(latest.current.map((cell) => (cell.type === "code" ? { ...cell, outputs: [], executionCount: null, status: "idle" } : cell)))} disabled={busy} className={cn(button, buttonVariants.ghost, "h-7 px-2", focusRing)}>
          <EraserIcon aria-hidden="true" />
          Clear outputs
        </button>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" aria-label="Import .ipynb" title="Import .ipynb" onClick={() => fileInput.current?.click()} className={cn(iconButton, "size-7", focusRing)}>
            <FileUpIcon aria-hidden="true" />
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".ipynb,application/x-ipynb+json,application/json"
            tabIndex={-1}
            aria-hidden="true"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              void file.text().then((text) => {
                const result = notebookFromIpynb(text);
                if (!result.ok) {
                  setNotice(result.error);
                  return;
                }
                interrupt();
                counter.current = Math.max(0, ...result.cells.map((cell) => cell.executionCount ?? 0));
                commit(result.cells.length ? result.cells : [createNotebookCell("code")]);
                setNotice(`Imported ${file.name} (${result.cells.length} ${result.cells.length === 1 ? "cell" : "cells"}).`);
              });
            }}
          />
          <button type="button" aria-label="Export .ipynb" title="Export .ipynb" onClick={() => downloadText(fileName, notebookToIpynb(latest.current, { kernelName: kernel.name, language }), "application/x-ipynb+json")} className={cn(iconButton, "size-7", focusRing)}>
            <DownloadIcon aria-hidden="true" />
          </button>
          <span className="ml-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="hidden sm:inline">{kernel.name}</span>
            <StatusPill tone={meta.tone} pulse={kernelStatus === "busy"}>
              {meta.label}
            </StatusPill>
          </span>
        </div>
      </div>
      <div role="status" className="empty:hidden">
        {(notice || deleted) && (
          <p className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-1.5 text-xs">
            <span className="flex-1">{notice ?? `Deleted cell ${deleted!.index + 1}.`}</span>
            {deleted && !notice && (
              <button
                type="button"
                onClick={() => {
                  const list = [...latest.current];
                  list.splice(Math.min(deleted.index, list.length), 0, deleted.cell);
                  commit(list);
                  setDeleted(null);
                }}
                className={cn("rounded px-1.5 py-0.5 font-medium underline underline-offset-2 hover:no-underline", focusRing)}
              >
                Undo
              </button>
            )}
          </p>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
        {cells.map((cell, index) => (
          <NotebookCellView
            key={cell.id}
            cell={cell}
            index={index}
            count={cells.length}
            language={language}
            editing={editing.has(cell.id)}
            focus={focusId === cell.id}
            allowScripts={allowScripts}
            onSourceChange={(source) => updateCell(cell.id, (item) => ({ ...item, source }))}
            onRun={(then) => runCell(cell.id, then)}
            onEdit={() => {
              setEditing((current) => new Set(current).add(cell.id));
              setFocusId(cell.id);
            }}
            onAction={(action) => onAction(cell, index, action)}
          />
        ))}
        <div className="flex gap-2 pl-14">
          <button type="button" onClick={() => insertAfter(latest.current.length - 1, "code")} className={cn(button, buttonVariants.outline, "h-7 px-2 text-xs", focusRing)}>
            <PlusIcon aria-hidden="true" />
            Code
          </button>
          <button type="button" onClick={() => insertAfter(latest.current.length - 1, "markdown")} className={cn(button, buttonVariants.outline, "h-7 px-2 text-xs", focusRing)}>
            <PlusIcon aria-hidden="true" />
            Text
          </button>
        </div>
      </div>
    </section>
  );
}
