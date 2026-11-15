// packages/ai-ui/src/components/secret-field.tsx
"use client";

import { CheckIcon, CopyIcon, EyeIcon, EyeOffIcon, KeyRoundIcon, Trash2Icon } from "lucide-react";
import { type FormEvent, type ReactNode, useId, useState } from "react";

import { useCopyToClipboard } from "../hooks/use-copy-to-clipboard.js";
import { button, buttonVariants, focusRing, iconButton, input } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export type SecretSource = "saved" | "environment" | "none";

export interface SecretFieldProps {
  label: string;
  /** Where the current value comes from: saved here, an environment variable, or not set. */
  source: SecretSource;
  /** Masked preview of the saved value, such as the last four characters ("…a1b2"). Never pass the secret itself. */
  hint?: string;
  /** Environment variable that supplies it, shown when `source` is "environment". */
  envName?: string;
  /** Saves a new value; the field clears and shows the error while a returned promise rejects. */
  onSave: (value: string) => void | Promise<void>;
  onRemove?: () => void | Promise<void>;
  /** Checks a typed value before saving; return an error message or null. */
  validate?: (value: string) => string | null;
  placeholder?: string;
  description?: string;
  /** Rendered beside the status, e.g. a link to create a key. */
  action?: ReactNode;
  className?: string;
}

/** Last four characters behind an ellipsis, for showing which saved key is in use. */
export function maskSecretHint(value: string, visible = 4): string {
  return value.length <= visible ? "•".repeat(value.length) : `…${value.slice(-visible)}`;
}

/**
 * Entry for an API key or token: shows whether one is saved, supplied by
 * the environment or missing, without ever displaying a saved value; new
 * values can be revealed while typing, are validated, saved and removed.
 */
export function SecretField({ label, source, hint, envName, onSave, onRemove, validate, placeholder = "Paste a key", description, action, className }: SecretFieldProps) {
  const [editing, setEditing] = useState(source === "none");
  const [value, setValue] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { copied, copy } = useCopyToClipboard();
  const id = useId();

  const save = async (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const trimmed = value.trim();
    const problem = !trimmed ? "Enter a value." : (validate?.(trimmed) ?? null);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(trimmed);
      setValue("");
      setReveal(false);
      setEditing(false);
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : "Couldn't save the key.");
    } finally {
      setBusy(false);
    }
  };

  const status = source === "saved" ? `Saved${hint ? ` (${hint})` : ""}` : source === "environment" ? `From ${envName ? `$${envName}` : "the environment"}` : "Not set";

  return (
    <div data-slot="secret-field" data-source={source} className={cn("flex flex-col gap-1.5 text-sm", className)}>
      <div className="flex items-center gap-2">
        <KeyRoundIcon aria-hidden="true" className="size-4 text-muted-foreground" />
        <span id={`${id}-label`} className="font-medium">
          {label}
        </span>
        <span id={`${id}-status`} className={cn("ml-auto rounded-full border px-2 text-xs", source === "none" ? "border-border text-muted-foreground" : "border-success/40 bg-success/10")}>
          {status}
        </span>
        {action}
      </div>
      {description && (
        <p id={`${id}-description`} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {editing ? (
        <form onSubmit={(event) => void save(event)} className="flex flex-wrap items-start gap-2">
          <div className="relative min-w-48 flex-1">
            <input
              id={`${id}-input`}
              type={reveal ? "text" : "password"}
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setError(null);
              }}
              autoComplete="off"
              spellCheck={false}
              aria-labelledby={`${id}-label`}
              aria-describedby={[description ? `${id}-description` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined}
              aria-invalid={error ? true : undefined}
              placeholder={placeholder}
              className={cn(input, "pr-9 font-mono", focusRing, "focus-visible:ring-offset-0")}
            />
            <button type="button" aria-label="Show key" aria-pressed={reveal} title={reveal ? "Hide key" : "Show key"} onClick={() => setReveal(!reveal)} className={cn(iconButton, "absolute top-0.5 right-0.5 size-8", focusRing)}>
              {reveal ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
            </button>
          </div>
          <button type="submit" disabled={busy} className={cn(button, buttonVariants.primary, "h-9", focusRing)}>
            Save
          </button>
          {source !== "none" && (
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setValue("");
                setError(null);
              }}
              className={cn(button, buttonVariants.ghost, "h-9", focusRing)}
            >
              Cancel
            </button>
          )}
          {error && (
            <p id={`${id}-error`} role="alert" className="w-full text-xs font-medium text-destructive">
              {error}
            </p>
          )}
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setEditing(true)} aria-describedby={`${id}-status`} className={cn(button, buttonVariants.outline, focusRing)}>
            {source === "saved" ? "Replace key" : "Add key"}
          </button>
          {source === "environment" && envName && (
            <button type="button" aria-label={copied ? "Copied" : `Copy variable name ${envName}`} title="Copy variable name" onClick={() => void copy(envName)} className={cn(iconButton, focusRing)}>
              {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
            </button>
          )}
          {source === "saved" && onRemove && (
            <button type="button" onClick={() => void onRemove()} className={cn(button, buttonVariants.ghost, "text-destructive", focusRing)}>
              <Trash2Icon aria-hidden="true" />
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}
