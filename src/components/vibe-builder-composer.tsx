// packages/ai-ui/src/components/vibe-builder-composer.tsx
"use client";

import { useId, useRef, useState } from "react";
import { ArrowUpIcon, FocusIcon, LayoutTemplateIcon } from "lucide-react";

import { cn } from "../lib/cn.js";
import { Button } from "./button.js";
import { Textarea } from "./textarea.js";

export type VibeBuilderPromptScope = { kind: "page" } | { kind: "block"; blockId: string };

export interface VibeBuilderPromptRequest {
  prompt: string;
  scope: VibeBuilderPromptScope;
  /** Project revision displayed when the prompt was submitted. */
  baseRevision: string;
}

export interface VibeBuilderSelectedBlock {
  id: string;
  label: string;
}

export interface VibeBuilderComposerProps {
  revision: string;
  selectedBlock?: VibeBuilderSelectedBlock | null | undefined;
  onSubmit: (request: VibeBuilderPromptRequest) => void | Promise<void>;
  generating?: boolean | undefined;
  onStop?: (() => void) | undefined;
  suggestions?: readonly string[] | undefined;
  blockSuggestions?: readonly string[] | undefined;
  className?: string;
}

export function VibeBuilderComposer({
  revision, selectedBlock, onSubmit, generating = false, onStop, suggestions, blockSuggestions, className,
}: VibeBuilderComposerProps) {
  const scopeId = useId();
  const submitting = useRef(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const [prompt, setPrompt] = useState("");
  const [pageScopeFor, setPageScopeFor] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const block = selectedBlock?.id === pageScopeFor ? null : selectedBlock;
  const examples = block ? blockSuggestions ?? suggestions : suggestions;

  async function submit() {
    const text = prompt.trim();
    if (!text || submitting.current || generating) return;
    submitting.current = true;
    setPending(true);
    setError("");
    try {
      await onSubmit({ prompt: text, scope: block ? { kind: "block", blockId: block.id } : { kind: "page" }, baseRevision: revision });
      setPrompt("");
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : "Couldn’t submit the request. Try again.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <form aria-label="Request a build change" data-slot="vibe-builder-composer"
      className={cn("min-w-0 space-y-2", className)} onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span id={scopeId} className="flex min-w-0 items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-foreground">
          {block ? <FocusIcon className="size-3.5 shrink-0" aria-hidden="true" /> : <LayoutTemplateIcon className="size-3.5 shrink-0" aria-hidden="true" />}
          <span className="min-w-0 truncate" title={block?.label}>{block?.label ?? "Whole page"}</span>
        </span>
        {selectedBlock && (
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={pending}
            onClick={() => setPageScopeFor(block ? selectedBlock.id : null)}>
            {block ? "Use whole page" : "Use selected block"}
          </Button>
        )}
      </div>
      {examples && examples.length > 0 && !prompt.trim() && <div className="flex flex-wrap gap-1.5">
        {examples.map((suggestion) => (
          <Button key={suggestion} type="button" size="sm" variant="outline" disabled={pending}
            className="h-auto whitespace-normal py-1 text-start text-xs" onClick={() => {
              setPrompt(suggestion);
              setError("");
              input.current?.focus();
            }}>
            {suggestion}
          </Button>
        ))}
      </div>}
      <div className="rounded-lg border border-border bg-background p-1.5 focus-within:border-ring">
        <Textarea ref={input} aria-label="Describe a change" aria-describedby={scopeId} value={prompt} onValueChange={setPrompt}
          aria-keyshortcuts="Control+Enter Meta+Enter" onKeyDown={(event) => {
            if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey) || event.nativeEvent.isComposing) return;
            event.preventDefault();
            void submit();
          }}
          className="rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0"
          readOnly={pending} autosize minRows={2} maxRows={6} placeholder="Ask for a change…" />
        <div className="flex flex-wrap items-center justify-end gap-2 px-0.5 pb-0.5">
          {generating && onStop && <Button type="button" size="sm" variant="outline" onClick={onStop}>Stop generation</Button>}
          <Button type="submit" size="sm" loading={pending} disabled={generating || !prompt.trim()}>
            Send request <ArrowUpIcon aria-hidden="true" />
          </Button>
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
