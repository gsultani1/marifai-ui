// packages/ai-ui/src/components/inline-edit.tsx
"use client";

import { ArrowUpIcon, CheckIcon, CornerDownLeftIcon, RotateCcwIcon, SparklesIcon, SquareIcon, XIcon } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";

import { button, buttonVariants, focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { trackedSegments } from "./tracked-changes.js";

export interface InlineEditAction {
  id: string;
  label: string;
  /** What the model is asked to do with the selection. */
  instruction: string;
  icon?: ReactNode;
}

export const DEFAULT_INLINE_ACTIONS: readonly InlineEditAction[] = [
  { id: "improve", label: "Improve", instruction: "Improve the writing while keeping the meaning and tone." },
  { id: "fix", label: "Fix spelling and grammar", instruction: "Fix spelling, grammar and punctuation only." },
  { id: "shorten", label: "Shorten", instruction: "Make it shorter without losing information." },
  { id: "expand", label: "Expand", instruction: "Expand it with more detail." },
  { id: "simplify", label: "Simplify", instruction: "Rewrite it in plainer language." },
];

export interface InlineEditRequest {
  instruction: string;
  /** The preset used, when the request came from one. */
  actionId?: string;
  selection: string;
  signal: AbortSignal;
}

export interface InlineEditProps {
  /** The selected text being edited. */
  selection: string;
  /** Produces the replacement, streamed as chunks or returned whole. */
  onGenerate: (request: InlineEditRequest) => AsyncIterable<string> | Promise<string>;
  onReplace: (text: string) => void;
  /** Adds the result after the selection instead of replacing it. */
  onInsert?: (text: string) => void;
  /** Discards the edit. */
  onClose: () => void;
  actions?: readonly InlineEditAction[];
  placeholder?: string;
  className?: string;
}

type Phase = { kind: "prompt" } | { kind: "generating"; text: string } | { kind: "done"; text: string } | { kind: "error"; message: string; text: string };

function isAsyncIterable(value: unknown): value is AsyncIterable<string> {
  return typeof value === "object" && value !== null && Symbol.asyncIterator in value;
}

/**
 * AI edits for selected text: preset actions or a typed instruction, the
 * result streamed in with Stop, then Replace, Insert below, Retry or
 * Discard, with the changes against the original on request.
 */
export function InlineEdit({ selection, onGenerate, onReplace, onInsert, onClose, actions = DEFAULT_INLINE_ACTIONS, placeholder = "Tell the AI what to change…", className }: InlineEditProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "prompt" });
  const [instruction, setInstruction] = useState("");
  const [last, setLast] = useState<{ instruction: string; actionId?: string } | null>(null);
  const [showChanges, setShowChanges] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    inputRef.current?.focus();
    return () => controller.current?.abort();
  }, []);

  useEffect(() => {
    if (phase.kind === "done") resultRef.current?.focus();
  }, [phase.kind]);

  const generate = async (request: { instruction: string; actionId?: string }) => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setLast(request);
    setShowChanges(false);
    setPhase({ kind: "generating", text: "" });
    let text = "";
    try {
      const result = onGenerate({ ...request, selection, signal: abort.signal });
      if (isAsyncIterable(result)) {
        for await (const chunk of result) {
          if (abort.signal.aborted) break;
          text += chunk;
          setPhase({ kind: "generating", text });
        }
      } else text = await result;
      if (controller.current !== abort) return;
      controller.current = null;
      setPhase(abort.signal.aborted && !text ? { kind: "prompt" } : { kind: "done", text });
    } catch (reason) {
      if (controller.current !== abort) return;
      controller.current = null;
      if (abort.signal.aborted) setPhase(text ? { kind: "done", text } : { kind: "prompt" });
      else setPhase({ kind: "error", message: reason instanceof Error && reason.message ? reason.message : "Couldn't generate an edit.", text });
    }
  };

  const stop = () => controller.current?.abort();

  const submit = () => {
    const value = instruction.trim();
    if (value) void generate({ instruction: value });
  };

  const result = phase.kind === "done" || phase.kind === "generating" || phase.kind === "error" ? phase.text : "";

  return (
    <section
      aria-label="Edit selection with AI"
      data-slot="inline-edit"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        if (phase.kind === "generating") stop();
        else onClose();
      }}
      className={cn("flex w-full max-w-lg flex-col gap-2 rounded-lg border border-border bg-popover p-2 text-sm text-popover-foreground shadow-lg", className)}
    >
      <blockquote className="line-clamp-2 border-l-2 border-border pl-2 text-xs text-muted-foreground">{selection}</blockquote>
      {(phase.kind === "prompt" || phase.kind === "error") && (
        <>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
            className="flex items-center gap-1 rounded-md border border-input bg-background pr-1 focus-within:ring-2 focus-within:ring-ring"
          >
            <SparklesIcon aria-hidden="true" className="ml-2 size-4 shrink-0 text-muted-foreground" />
            <input ref={inputRef} aria-label="Instruction" value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder={placeholder} className="h-9 min-w-0 flex-1 bg-transparent px-1 outline-none placeholder:text-muted-foreground" />
            <button type="submit" aria-label="Generate" title="Generate" disabled={!instruction.trim()} className={cn(iconButton, "size-7 bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground hover:opacity-90", focusRing)}>
              <ArrowUpIcon aria-hidden="true" />
            </button>
          </form>
          <div role="group" aria-label="Quick actions" className="flex flex-wrap gap-1">
            {actions.map((action) => (
              <button key={action.id} type="button" onClick={() => void generate({ instruction: action.instruction, actionId: action.id })} className={cn(button, buttonVariants.outline, "h-7 px-2 text-xs", focusRing)}>
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
          {phase.kind === "error" && (
            <p role="alert" className="flex items-center gap-2 text-xs font-medium text-destructive">
              {phase.message}
              {last && (
                <button type="button" onClick={() => void generate(last)} className={cn("rounded-sm underline underline-offset-2", focusRing)}>
                  Retry
                </button>
              )}
            </p>
          )}
        </>
      )}
      {(phase.kind === "generating" || phase.kind === "done") && (
        <>
          <div
            ref={resultRef}
            id={`${id}-result`}
            tabIndex={-1}
            aria-label="Suggested text"
            aria-busy={phase.kind === "generating"}
            role="region"
            className={cn("max-h-64 min-h-12 overflow-auto rounded-md border border-border bg-background px-3 py-2 leading-6 whitespace-pre-wrap", focusRing)}
          >
            {showChanges && phase.kind === "done"
              ? trackedSegments(selection, result).map((segment, index) =>
                  segment.type === "same" ? (
                    <span key={index}>{segment.text}</span>
                  ) : (
                    <span key={index}>
                      {segment.removed && (
                        <del className="text-destructive">
                          <span className="sr-only">deleted: </span>
                          {segment.removed}
                        </del>
                      )}
                      {segment.added && (
                        <ins className="text-success">
                          <span className="sr-only">inserted: </span>
                          {segment.added}
                        </ins>
                      )}
                    </span>
                  ),
                )
              : result || <span className="text-muted-foreground">Writing…</span>}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {phase.kind === "generating" ? (
              <button type="button" onClick={stop} className={cn(button, buttonVariants.outline, "h-7 px-2 text-xs", focusRing)}>
                <SquareIcon aria-hidden="true" />
                Stop
              </button>
            ) : (
              <>
                <button type="button" disabled={!result} onClick={() => onReplace(result)} className={cn(button, buttonVariants.primary, "h-7 px-2 text-xs", focusRing)}>
                  <CheckIcon aria-hidden="true" />
                  Replace
                </button>
                {onInsert && (
                  <button type="button" disabled={!result} onClick={() => onInsert(result)} className={cn(button, buttonVariants.outline, "h-7 px-2 text-xs", focusRing)}>
                    <CornerDownLeftIcon aria-hidden="true" />
                    Insert below
                  </button>
                )}
                {last && (
                  <button type="button" onClick={() => void generate(last)} className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs", focusRing)}>
                    <RotateCcwIcon aria-hidden="true" />
                    Retry
                  </button>
                )}
                <button type="button" aria-pressed={showChanges} onClick={() => setShowChanges(!showChanges)} className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs aria-pressed:bg-accent aria-pressed:text-accent-foreground", focusRing)}>
                  Show changes
                </button>
              </>
            )}
            <button type="button" onClick={onClose} className={cn(button, buttonVariants.ghost, "ml-auto h-7 px-2 text-xs", focusRing)}>
              <XIcon aria-hidden="true" />
              Discard
            </button>
          </div>
        </>
      )}
      <span role="status" className="sr-only">
        {phase.kind === "generating" ? "Writing a suggestion" : phase.kind === "done" ? "Suggestion ready" : ""}
      </span>
    </section>
  );
}
