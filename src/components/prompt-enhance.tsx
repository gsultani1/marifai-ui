// packages/ai-ui/src/components/prompt-enhance.tsx
"use client";

import { LoaderCircleIcon, Undo2Icon, WandSparklesIcon } from "lucide-react";
import { useState } from "react";

import { focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { usePromptInput } from "./prompt-input.js";

export interface PromptInputEnhanceProps {
  /** Returns an improved prompt, such as a clearer or more specific version. */
  onEnhance: (text: string) => Promise<string>;
  onError?: (error: unknown) => void;
  label?: string;
  className?: string;
}

/**
 * Rewrites the PromptInput draft with `onEnhance` and offers Undo until the
 * user edits the result, so a worse rewrite is one click from gone.
 */
export function PromptInputEnhance({ onEnhance, onError, label = "Improve prompt", className }: PromptInputEnhanceProps) {
  const { value, setValue, disabled, textareaRef } = usePromptInput();
  const [busy, setBusy] = useState(false);
  const [undo, setUndo] = useState<{ before: string; after: string } | null>(null);
  const [message, setMessage] = useState("");
  const canUndo = undo !== null && undo.after === value;

  if (canUndo) {
    return (
      <button
        type="button"
        aria-label="Undo prompt improvement"
        title="Undo prompt improvement"
        onClick={() => {
          setValue(undo.before);
          setUndo(null);
          setMessage("Restored your original prompt");
          textareaRef.current?.focus();
        }}
        className={cn(iconButton, "rounded-full", focusRing, className)}
      >
        <Undo2Icon aria-hidden="true" />
        <span role="status" className="sr-only">
          {message}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled || busy || !value.trim()}
      aria-busy={busy || undefined}
      onClick={async () => {
        const before = value;
        setBusy(true);
        setMessage("Improving your prompt");
        try {
          const after = (await onEnhance(before)).trim();
          if (after && after !== before) {
            setValue(after);
            setUndo({ before, after });
            setMessage("Prompt improved. Undo is available.");
          } else setMessage("No changes suggested");
        } catch (error) {
          setMessage("Couldn't improve the prompt");
          onError?.(error);
        } finally {
          setBusy(false);
        }
      }}
      className={cn(iconButton, "rounded-full", focusRing, className)}
    >
      {busy ? <LoaderCircleIcon aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <WandSparklesIcon aria-hidden="true" />}
      <span role="status" className="sr-only">
        {message}
      </span>
    </button>
  );
}
