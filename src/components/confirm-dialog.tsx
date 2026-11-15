// packages/ai-ui/src/components/confirm-dialog.tsx
"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { LoaderCircleIcon } from "lucide-react";
import { type ReactElement, type ReactNode, useRef, useState } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { button, buttonVariants, focusRing, modalBackdrop, modalPopup } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { usePortalContainer } from "../lib/portal.js";

export interface ConfirmDialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Element that opens the dialog, e.g. a delete button. */
  trigger?: ReactElement;
  title: ReactNode;
  description?: ReactNode;
  /** Extra content between the description and the buttons, e.g. a list of what will be deleted. */
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "destructive" styles the confirm button as a warning. */
  tone?: "default" | "destructive";
  /**
   * Runs on confirm. The dialog stays open with a pending state while a
   * returned promise is unsettled, and shows `errorMessage` if it rejects.
   */
  onConfirm: () => void | Promise<void>;
  errorMessage?: ReactNode;
  className?: string;
}

/**
 * Confirmation step for actions that are hard to undo. Focus starts on
 * Cancel so an accidental Enter never confirms.
 */
export function ConfirmDialog({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
  errorMessage = "That did not work. Try again.",
  className,
}: ConfirmDialogProps) {
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const container = usePortalContainer();

  const confirm = () => {
    if (pending) return;
    setFailed(false);
    let result: void | Promise<void>;
    try {
      result = onConfirm();
    } catch {
      setFailed(true);
      return;
    }
    if (!(result instanceof Promise)) {
      setOpen(false);
      return;
    }
    setPending(true);
    result.then(
      () => {
        setPending(false);
        setOpen(false);
      },
      () => {
        setPending(false);
        setFailed(true);
      },
    );
  };

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (!next) setFailed(false);
        setOpen(next);
      }}
    >
      {trigger && <AlertDialog.Trigger render={trigger} />}
      <AlertDialog.Portal container={container}>
        <AlertDialog.Backdrop className={modalBackdrop} />
        <AlertDialog.Popup
          initialFocus={cancelRef}
          data-slot="confirm-dialog"
          className={cn(modalPopup, className)}
        >
          <div className="flex flex-col gap-1.5">
            <AlertDialog.Title className="text-base font-semibold">{title}</AlertDialog.Title>
            {description && (
              <AlertDialog.Description className="text-sm text-muted-foreground">{description}</AlertDialog.Description>
            )}
          </div>
          {children}
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <AlertDialog.Close ref={cancelRef} className={cn(button, buttonVariants.outline, focusRing)}>
              {cancelLabel}
            </AlertDialog.Close>
            <button
              type="button"
              aria-disabled={pending || undefined}
              onClick={confirm}
              className={cn(button, tone === "destructive" ? buttonVariants.destructive : buttonVariants.primary, focusRing)}
            >
              {pending && <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
