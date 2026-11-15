// packages/ai-ui/src/components/url-context-button.tsx
"use client";

import { Popover } from "@base-ui/react/popover";
import { Link2Icon, LoaderCircleIcon } from "lucide-react";
import { type FormEvent, useId, useState } from "react";

import { button, buttonVariants, focusRing, iconButton, input, popupSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { usePortalContainer } from "../lib/portal.js";
import { safeUrl } from "../lib/safe-url.js";

export interface UrlContextButtonProps {
  /** Fetches or registers the page; a rejection keeps the popover open with the message. */
  onAdd: (url: string) => void | Promise<void>;
  label?: string;
  className?: string;
}

/** Popover for adding a web page as context: accepts http(s) links only, adds https:// when missing, and reports fetch failures in place. */
export function UrlContextButton({ onAdd, label = "Add a link", className }: UrlContextButtonProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const container = usePortalContainer();
  const id = useId();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    // The popover portals out of the DOM but React still bubbles submit to an enclosing PromptInput form.
    event.stopPropagation();
    const trimmed = text.trim();
    const url = safeUrl(/^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (!trimmed || !url || !/\.[a-z]{2,}|localhost/i.test(new URL(url).hostname)) {
      setError("Enter a web address such as example.com/page.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onAdd(url);
      setText("");
      setOpen(false);
    } catch (problem) {
      setError(problem instanceof Error && problem.message ? problem.message : "Couldn't add that page.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <Popover.Trigger aria-label={label} title={label} className={cn(iconButton, "rounded-full", focusRing, className)}>
        <Link2Icon aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Positioner side="top" align="start" sideOffset={8} className="z-50">
          <Popover.Popup className={cn(popupSurface, "w-80 p-3 outline-none")}>
            <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-2">
              <label htmlFor={`${id}-url`} className="text-sm font-medium">
                {label}
              </label>
              <div className="flex gap-2">
                <input
                  id={`${id}-url`}
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="example.com/page"
                  value={text}
                  aria-invalid={Boolean(error) || undefined}
                  aria-describedby={error ? `${id}-error` : undefined}
                  onChange={(event) => {
                    setText(event.target.value);
                    setError(null);
                  }}
                  className={cn(input, focusRing, "focus-visible:ring-offset-0")}
                />
                <button type="submit" disabled={busy} className={cn(button, buttonVariants.primary, "h-9", focusRing)}>
                  {busy && <LoaderCircleIcon aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
                  Add
                </button>
              </div>
              {error && (
                <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">
                  {error}
                </p>
              )}
            </form>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
