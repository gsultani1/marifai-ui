// packages/ai-ui/src/components/share-button.tsx
"use client";

import { CheckIcon, Share2Icon } from "lucide-react";
import { type ComponentProps, useEffect, useRef, useState } from "react";

import { button, buttonVariants, type ButtonVariant, focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { type ShareContent, type ShareOutcome, shareOrCopy } from "../lib/share.js";

export interface ShareButtonProps extends Omit<ComponentProps<"button">, "onClick" | "children" | "content"> {
  content: ShareContent | (() => ShareContent | Promise<ShareContent>);
  label?: string;
  variant?: ButtonVariant;
  /** Shows only the icon. */
  iconOnly?: boolean;
  onShared?: (outcome: ShareOutcome) => void;
}

const MESSAGES: Record<ShareOutcome, string> = {
  shared: "Shared",
  copied: "Link copied",
  cancelled: "",
  failed: "Couldn't share. Copy the link instead.",
};

/** Shares through the system share sheet, or copies the link where there is none, and says which happened. */
export function ShareButton({ content, label = "Share", variant = "outline", iconOnly = false, onShared, disabled, className, ...props }: ShareButtonProps) {
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const share = async () => {
    setBusy(true);
    try {
      const resolved = typeof content === "function" ? await content() : content;
      const result = await shareOrCopy(resolved);
      setOutcome(result);
      onShared?.(result);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setOutcome(null), 2500);
    } catch {
      setOutcome("failed");
      onShared?.("failed");
    } finally {
      setBusy(false);
    }
  };

  const done = outcome === "shared" || outcome === "copied";
  const visible = done ? MESSAGES[outcome] : label;

  return (
    <>
      <button
        type="button"
        aria-label={iconOnly ? (done ? MESSAGES[outcome] : label) : undefined}
        title={iconOnly ? label : undefined}
        disabled={disabled || busy}
        onClick={() => void share()}
        data-slot="share-button"
        className={cn(iconOnly ? iconButton : cn(button, buttonVariants[variant]), focusRing, className)}
        {...props}
      >
        {done ? <CheckIcon aria-hidden="true" /> : <Share2Icon aria-hidden="true" />}
        {!iconOnly && visible}
      </button>
      <span role="status" className={cn(outcome === "failed" ? "text-xs text-destructive" : "sr-only")}>
        {outcome ? MESSAGES[outcome] : ""}
      </span>
    </>
  );
}
