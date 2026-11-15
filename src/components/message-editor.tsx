// packages/ai-ui/src/components/message-editor.tsx
"use client";

import { LoaderCircleIcon } from "lucide-react";
import { type FormEvent, type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";

import { useAutosizeTextarea } from "../hooks/use-autosize-textarea.js";
import { button, buttonVariants, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export interface MessageEditorProps {
  defaultValue: string;
  /** Receives the trimmed text; the editor stays open with an error while a returned promise rejects. */
  onSave: (text: string) => void | Promise<void>;
  onCancel: () => void;
  label?: string;
  saveLabel?: string;
  /** Shown under the field, e.g. "Saving starts a new branch from this message." */
  hint?: ReactNode;
  /** Enter saves and Shift+Enter adds a line; set false for multi-line content. */
  submitOnEnter?: boolean;
  maxRows?: number;
  className?: string;
}

/**
 * Inline edit for a sent message: the field takes focus with the caret at
 * the end, Enter saves, Escape cancels, and saving is disabled until the
 * text changes.
 */
export function MessageEditor({ defaultValue, onSave, onCancel, label = "Edit message", saveLabel = "Save", hint, submitOnEnter = true, maxRows = 12, className }: MessageEditorProps) {
  const [value, setValue] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const text = value.trim();
  const canSave = Boolean(text) && text !== defaultValue.trim() && !busy;
  useAutosizeTextarea(ref, value, { minRows: 2, maxRows });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.focus();
    element.setSelectionRange(element.value.length, element.value.length);
  }, []);

  const save = async (event?: FormEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(text);
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : "Couldn't save the change. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    } else if (event.key === "Enter" && !event.nativeEvent.isComposing && (event.metaKey || event.ctrlKey || (submitOnEnter && !event.shiftKey))) {
      event.preventDefault();
      void save();
    }
  };

  return (
    <form data-slot="message-editor" onSubmit={(event) => void save(event)} className={cn("flex w-full flex-col gap-2", className)}>
      <label htmlFor={`${id}-field`} className="sr-only">
        {label}
      </label>
      <textarea
        ref={ref}
        id={`${id}-field`}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        aria-describedby={[hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined}
        aria-invalid={error ? true : undefined}
        className={cn("w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm leading-6", focusRing, "focus-visible:ring-offset-0")}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {hint && (
          <p id={`${id}-hint`} className="mr-auto text-xs text-muted-foreground">
            {hint}
          </p>
        )}
        <button type="button" onClick={onCancel} className={cn(button, buttonVariants.ghost, focusRing)}>
          Cancel
        </button>
        <button type="submit" disabled={!canSave} className={cn(button, buttonVariants.primary, focusRing)}>
          {busy && <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" />}
          {saveLabel}
        </button>
      </div>
    </form>
  );
}
