// packages/ai-ui/src/components/diff-view.tsx
"use client";

import { diffLines, diffWordsWithSpace } from "diff";
import { ChevronsUpDownIcon } from "lucide-react";
import { type ComponentProps, Fragment, type ReactNode, useMemo, useRef, useState } from "react";

import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

type LineKind = "context" | "added" | "removed";

interface DiffLine {
  kind: LineKind;
  text: string;
  oldNumber?: number;
  newNumber?: number;
  /** Word-level segments when this line pairs with a changed counterpart. */
  segments?: Array<{ text: string; changed: boolean }>;
  /** Last line of an input that lacks the trailing newline the other input has. */
  noFinalNewline?: boolean;
}

interface SplitRow {
  removed?: DiffLine | undefined;
  added?: DiffLine | undefined;
  context?: DiffLine | undefined;
}

type DiffRow = { type: "line"; line: DiffLine } | ({ type: "pair" } & SplitRow) | { type: "gap"; id: number; hidden: number };

function splitLines(value: string): string[] {
  const lines = value.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

const DIFF_TIMEOUT_MS = 1000;
const WORD_DIFF_TIMEOUT_MS = 50;
const MAX_WORD_DIFF_LINE = 2000;

function wordSegments(from: string, to: string): [DiffLine["segments"], DiffLine["segments"]] {
  if (from.length > MAX_WORD_DIFF_LINE || to.length > MAX_WORD_DIFF_LINE) return [undefined, undefined];
  const parts = diffWordsWithSpace(from, to, { timeout: WORD_DIFF_TIMEOUT_MS });
  if (!parts) return [undefined, undefined];
  const removed: NonNullable<DiffLine["segments"]> = [];
  const added: NonNullable<DiffLine["segments"]> = [];
  for (const part of parts) {
    if (!part.added) removed.push({ text: part.value, changed: Boolean(part.removed) });
    if (!part.removed) added.push({ text: part.value, changed: Boolean(part.added) });
  }
  return [removed, added];
}

/** Returns null when the inputs exceed `maxLength` or the diff exceeds its time budget. */
function computeLines(oldValue: string, newValue: string, wordDiff: boolean, maxLength: number): DiffLine[] | null {
  if (oldValue.length + newValue.length > maxLength) return null;
  const changes = diffLines(oldValue, newValue, { timeout: DIFF_TIMEOUT_MS });
  if (!changes) return null;
  const lines: DiffLine[] = [];
  let oldNumber = 1;
  let newNumber = 1;
  for (let index = 0; index < changes.length; index++) {
    const change = changes[index]!;
    const next = changes[index + 1];
    if (change.removed && next?.added) {
      const removed = splitLines(change.value);
      const added = splitLines(next.value);
      const removedLines: DiffLine[] = removed.map((text) => ({ kind: "removed", text, oldNumber: oldNumber++ }));
      const addedLines: DiffLine[] = added.map((text) => ({ kind: "added", text, newNumber: newNumber++ }));
      if (wordDiff) {
        for (let pair = 0; pair < Math.min(removedLines.length, addedLines.length); pair++) {
          const removedLine = removedLines[pair]!;
          const addedLine = addedLines[pair]!;
          [removedLine.segments, addedLine.segments] = wordSegments(removedLine.text, addedLine.text);
        }
      }
      lines.push(...removedLines, ...addedLines);
      index++;
      continue;
    }
    for (const text of splitLines(change.value)) {
      if (change.added) lines.push({ kind: "added", text, newNumber: newNumber++ });
      else if (change.removed) lines.push({ kind: "removed", text, oldNumber: oldNumber++ });
      else lines.push({ kind: "context", text, oldNumber: oldNumber++, newNumber: newNumber++ });
    }
  }
  if (oldValue.endsWith("\n") !== newValue.endsWith("\n")) {
    const lacking = oldValue.endsWith("\n") ? "newNumber" : "oldNumber";
    for (let index = lines.length - 1; index >= 0; index--) {
      if (lines[index]![lacking] === undefined) continue;
      lines[index]!.noFinalNewline = true;
      break;
    }
  }
  return lines;
}

function pairForSplit(lines: DiffLine[]): SplitRow[] {
  const rows: SplitRow[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index]!;
    if (line.kind === "context") {
      rows.push({ context: line });
      index++;
      continue;
    }
    const removed: DiffLine[] = [];
    const added: DiffLine[] = [];
    while (lines[index]?.kind === "removed") removed.push(lines[index++]!);
    while (lines[index]?.kind === "added") added.push(lines[index++]!);
    for (let pair = 0; pair < Math.max(removed.length, added.length); pair++) {
      rows.push({ removed: removed[pair], added: added[pair] });
    }
  }
  return rows;
}

function collapse<T>(items: T[], isContext: (item: T) => boolean, context: number, expanded: Set<number>) {
  const result: Array<{ item: T } | { gap: number; hidden: number }> = [];
  let index = 0;
  while (index < items.length) {
    if (!isContext(items[index]!)) {
      result.push({ item: items[index++]! });
      continue;
    }
    let end = index;
    while (end < items.length && isContext(items[end]!)) end++;
    const lead = index === 0 ? 0 : context;
    const trail = end === items.length ? 0 : context;
    if (end - index > lead + trail + 1 && !expanded.has(index)) {
      for (let keep = index; keep < index + lead; keep++) result.push({ item: items[keep]! });
      result.push({ gap: index, hidden: end - index - lead - trail });
      for (let keep = end - trail; keep < end; keep++) result.push({ item: items[keep]! });
    } else {
      for (let keep = index; keep < end; keep++) result.push({ item: items[keep]! });
    }
    index = end;
  }
  return result;
}

function LineText({ line }: { line: DiffLine }) {
  const marker = line.noFinalNewline && (
    <span className="ml-2 font-sans text-xs text-muted-foreground select-none">No newline at end of file</span>
  );
  if (!line.segments) {
    return (
      <>
        {line.text || " "}
        {marker}
      </>
    );
  }
  return (
    <>
      {line.segments.map((segment, index) =>
        segment.changed ? (
          <span
            key={index}
            className={cn("rounded-sm", line.kind === "added" ? "bg-code-inserted/25" : "bg-code-deleted/25")}
          >
            {segment.text}
          </span>
        ) : (
          <Fragment key={index}>{segment.text}</Fragment>
        ),
      )}
      {marker}
    </>
  );
}

const ROW_TONE: Record<LineKind, string> = {
  context: "",
  added: "bg-code-inserted/10",
  removed: "bg-code-deleted/10",
};
const MARKER: Record<LineKind, { symbol: string; label: string }> = {
  context: { symbol: " ", label: "" },
  added: { symbol: "+", label: "Added: " },
  removed: { symbol: "-", label: "Removed: " },
};
const numberCell = "w-px px-2 text-right align-top text-muted-foreground/70 tabular-nums select-none";
const codeCell = "px-2 align-top whitespace-pre-wrap break-all";

function CodeCell({ line, className }: { line: DiffLine | undefined; className?: string }) {
  if (!line) return <td className={cn(codeCell, "bg-muted/40", className)} />;
  return (
    <td className={cn(codeCell, ROW_TONE[line.kind], className)}>
      <span aria-hidden="true" className="mr-2 inline-block w-2 text-muted-foreground select-none">
        {MARKER[line.kind].symbol}
      </span>
      <span className="sr-only">{MARKER[line.kind].label}</span>
      <LineText line={line} />
    </td>
  );
}

export interface DiffViewProps extends ComponentProps<"div"> {
  oldValue: string;
  newValue: string;
  mode?: "unified" | "split";
  /** Highlights changed words inside modified lines. */
  wordDiff?: boolean;
  /** Unchanged lines kept around each change; longer unchanged runs collapse behind a toggle. */
  contextLines?: number;
  oldTitle?: ReactNode;
  newTitle?: ReactNode;
  /** Combined input length above which the diff is not computed. */
  maxLength?: number;
  /** Accessible name of the scrolling diff region. Give each diff on a page its own, such as "Schedule changes". */
  label?: string;
}

export function DiffView({
  oldValue,
  newValue,
  mode = "unified",
  wordDiff = true,
  contextLines = 3,
  oldTitle = "Before",
  newTitle = "After",
  maxLength = 200_000,
  label = "Diff lines",
  className,
  ...props
}: DiffViewProps) {
  const computed = useMemo(
    () => computeLines(oldValue, newValue, wordDiff, maxLength),
    [oldValue, newValue, wordDiff, maxLength],
  );
  const lines = useMemo(() => computed ?? [], [computed]);
  const layoutKey = useMemo(() => ({ lines, mode }), [lines, mode]);
  const [expansion, setExpansion] = useState<{ key: typeof layoutKey; ids: Set<number> } | null>(null);
  const expanded = useMemo(
    () => (expansion?.key === layoutKey ? expansion.ids : new Set<number>()),
    [expansion, layoutKey],
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const stats = useMemo(
    () => ({
      added: lines.filter((line) => line.kind === "added").length,
      removed: lines.filter((line) => line.kind === "removed").length,
    }),
    [lines],
  );

  const rows: DiffRow[] = useMemo(() => {
    if (mode === "split") {
      return collapse(pairForSplit(lines), (row) => Boolean(row.context), contextLines, expanded).map((entry) =>
        "gap" in entry ? { type: "gap", id: entry.gap, hidden: entry.hidden } : { type: "pair", ...entry.item },
      );
    }
    return collapse(lines, (line) => line.kind === "context", contextLines, expanded).map((entry) =>
      "gap" in entry ? { type: "gap", id: entry.gap, hidden: entry.hidden } : { type: "line", line: entry.item },
    );
  }, [lines, mode, contextLines, expanded]);

  const columns = mode === "split" ? 4 : 3;

  return (
    <div
      data-slot="diff-view"
      data-mode={mode}
      className={cn("overflow-hidden rounded-lg border border-border bg-code-background text-code-foreground", className)}
      {...props}
    >
      <div className="flex items-center gap-3 border-b border-border px-3 py-1.5 text-xs text-muted-foreground">
        {mode === "split" ? (
          <span className="grid flex-1 grid-cols-2">
            <span className="truncate">{oldTitle}</span>
            <span className="truncate">{newTitle}</span>
          </span>
        ) : (
          <span className="flex-1 truncate">
            {oldTitle} → {newTitle}
          </span>
        )}
        {computed && (
          <span className="shrink-0 font-medium tabular-nums">
            <span className="text-code-inserted">+{stats.added}</span>{" "}
            <span className="text-code-deleted">-{stats.removed}</span>
          </span>
        )}
      </div>
      {!computed ? (
        <p role="status" className="px-3 py-6 text-center font-sans text-sm text-muted-foreground">
          These versions are too large to compare here.
        </p>
      ) : (
        <div
          ref={scrollRef}
          tabIndex={0}
          aria-label={label}
          role="region"
          className="overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <table className="w-full border-collapse font-mono text-[0.8125rem] leading-6">
            <caption className="sr-only">
              Changes from {oldTitle} to {newTitle}: {stats.added} {stats.added === 1 ? "line" : "lines"} added,{" "}
              {stats.removed} {stats.removed === 1 ? "line" : "lines"} removed
            </caption>
            {mode === "split" && (
              // The visible column titles sit above the table, so name the columns for screen readers too.
              <thead className="sr-only">
                <tr>
                  <th scope="col">Line in {oldTitle}</th>
                  <th scope="col">{oldTitle}</th>
                  <th scope="col">Line in {newTitle}</th>
                  <th scope="col">{newTitle}</th>
                </tr>
              </thead>
            )}
            <tbody>
              {rows.map((row, index) => {
                if (row.type === "gap") {
                  return (
                    <tr key={`gap-${row.id}`}>
                      <td colSpan={columns} className="bg-muted/50 p-0">
                        <button
                          type="button"
                          onClick={() => {
                            setExpansion({ key: layoutKey, ids: new Set(expanded).add(row.id) });
                            scrollRef.current?.focus({ preventScroll: true });
                          }}
                          className={cn(
                            "flex w-full items-center gap-2 px-3 py-1 text-left font-sans text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                            focusRing,
                          )}
                        >
                          <ChevronsUpDownIcon aria-hidden="true" className="size-3.5" />
                          Show {row.hidden} unchanged {row.hidden === 1 ? "line" : "lines"}
                        </button>
                      </td>
                    </tr>
                  );
                }
                if (row.type === "line") {
                  const { line } = row;
                  return (
                    <tr key={index} data-kind={line.kind}>
                      <td className={cn(numberCell, ROW_TONE[line.kind])}>{line.oldNumber}</td>
                      <td className={cn(numberCell, ROW_TONE[line.kind])}>{line.newNumber}</td>
                      <CodeCell line={line} />
                    </tr>
                  );
                }
                const left = row.context ?? row.removed;
                const right = row.context ?? row.added;
                return (
                  <tr key={index}>
                    <td className={cn(numberCell, left && ROW_TONE[left.kind])}>{left?.oldNumber}</td>
                    <CodeCell line={left} className="w-1/2 border-r border-border" />
                    <td className={cn(numberCell, right && ROW_TONE[right.kind])}>{right?.newNumber}</td>
                    <CodeCell line={right} className="w-1/2" />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
