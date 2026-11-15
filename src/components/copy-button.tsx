// packages/ai-ui/src/components/copy-button.tsx
"use client";

import { CheckIcon, CircleAlertIcon, CopyIcon } from "lucide-react";

import { useCopyToClipboard } from "../hooks/use-copy-to-clipboard.js";
import { Button, type ButtonProps } from "./button.js";

export interface CopyButtonProps extends Omit<ButtonProps, "value" | "onClick" | "onCopy" | "children" | "loading"> {
  /** Text to copy, or a function that reads it at click time. */
  value: string | (() => string);
  /** Accessible name and visible text (with `showLabel`); defaults to "Copy". */
  label?: string;
  copiedLabel?: string;
  /** Shown and announced when the clipboard refuses the write. */
  errorLabel?: string;
  /** Shows the label next to the icon instead of an icon-only button. */
  showLabel?: boolean;
  /** How long the copied or failed state stays before resetting. */
  resetAfterMs?: number;
  /** Runs after a successful copy with the text that was written. */
  onCopy?: (text: string) => void;
  onCopyError?: (error: unknown) => void;
}

/**
 * Copies text to the clipboard, swaps to a check mark and announces "Copied"
 * through a polite live region; a refused write shows an alert icon and
 * announces the failure instead.
 */
export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  errorLabel = "Copy failed",
  showLabel = false,
  resetAfterMs = 2000,
  onCopy,
  onCopyError,
  variant = "ghost",
  size,
  ...props
}: CopyButtonProps) {
  const { status, copy } = useCopyToClipboard({ resetAfterMs, onError: onCopyError });
  const current = status === "copied" ? copiedLabel : status === "error" ? errorLabel : label;
  const icon =
    status === "copied" ? (
      <CheckIcon aria-hidden="true" className="text-success" />
    ) : status === "error" ? (
      <CircleAlertIcon aria-hidden="true" className="text-destructive" />
    ) : (
      <CopyIcon aria-hidden="true" />
    );

  const handleClick = async () => {
    const text = typeof value === "function" ? value() : value;
    if (await copy(text)) onCopy?.(text);
  };

  return (
    <Button
      variant={variant}
      size={size ?? (showLabel ? "md" : "icon")}
      aria-label={current}
      data-slot="copy-button"
      data-status={status}
      onClick={() => void handleClick()}
      {...props}
    >
      {icon}
      {showLabel && <span>{current}</span>}
      <span aria-live="polite" className="sr-only">
        {status === "copied" ? copiedLabel : status === "error" ? errorLabel : ""}
      </span>
    </Button>
  );
}
