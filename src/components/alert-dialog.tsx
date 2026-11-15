// packages/ai-ui/src/components/alert-dialog.tsx
"use client";

import { AlertDialog as BaseAlertDialog } from "@base-ui/react/alert-dialog";

import { modalBackdrop, modalPopup } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { usePortalContainer } from "../lib/portal.js";
import type { WithClassName } from "../lib/types.js";
import { type ButtonVariant, buttonClasses } from "./button.js";
import { DialogDescription, type DialogDescriptionProps, DialogFooter, type DialogFooterProps, DialogHeader, type DialogHeaderProps, DialogTitle, type DialogTitleProps } from "./dialog.js";

export type AlertDialogProps = BaseAlertDialog.Root.Props;

/**
 * Composable confirmation dialog on Base UI Alert Dialog: role="alertdialog",
 * focus trapped, and no dismissal by an outside press. For a ready-made
 * version with pending and error states, use ConfirmDialog.
 */
export function AlertDialog(props: AlertDialogProps) {
  return <BaseAlertDialog.Root {...props} />;
}

export type AlertDialogTriggerProps = BaseAlertDialog.Trigger.Props;

export function AlertDialogTrigger(props: AlertDialogTriggerProps) {
  return <BaseAlertDialog.Trigger data-slot="alert-dialog-trigger" {...props} />;
}

export interface AlertDialogContentProps extends WithClassName<BaseAlertDialog.Popup.Props> {
  size?: "sm" | "md";
  backdropClassName?: string;
}

/** The alert dialog surface and backdrop. Focus starts on the first button, so put Cancel first in the footer. */
export function AlertDialogContent({ size = "md", backdropClassName, className, ...props }: AlertDialogContentProps) {
  const container = usePortalContainer();
  return (
    <BaseAlertDialog.Portal container={container}>
      <BaseAlertDialog.Backdrop data-slot="alert-dialog-backdrop" className={cn(modalBackdrop, backdropClassName)} />
      <BaseAlertDialog.Popup
        data-slot="alert-dialog-content"
        className={cn(modalPopup, size === "sm" && "w-[min(24rem,calc(100vw-2rem))]", className)}
        {...props}
      />
    </BaseAlertDialog.Portal>
  );
}

export type AlertDialogHeaderProps = DialogHeaderProps;

export function AlertDialogHeader({ className, ...props }: AlertDialogHeaderProps) {
  return <DialogHeader data-slot="alert-dialog-header" className={cn("pr-0", className)} {...props} />;
}

export type AlertDialogTitleProps = DialogTitleProps;

export function AlertDialogTitle(props: AlertDialogTitleProps) {
  return <DialogTitle data-slot="alert-dialog-title" {...props} />;
}

export type AlertDialogDescriptionProps = DialogDescriptionProps;

export function AlertDialogDescription(props: AlertDialogDescriptionProps) {
  return <DialogDescription data-slot="alert-dialog-description" {...props} />;
}

export type AlertDialogFooterProps = DialogFooterProps;

export function AlertDialogFooter(props: AlertDialogFooterProps) {
  return <DialogFooter data-slot="alert-dialog-footer" {...props} />;
}

export type AlertDialogCancelProps = WithClassName<BaseAlertDialog.Close.Props>;

/** Closes without acting; styled as an outline button. */
export function AlertDialogCancel({ className, children = "Cancel", ...props }: AlertDialogCancelProps) {
  return (
    <BaseAlertDialog.Close data-slot="alert-dialog-cancel" className={buttonClasses({ variant: "outline", className })} {...props}>
      {children}
    </BaseAlertDialog.Close>
  );
}

export interface AlertDialogActionProps extends WithClassName<BaseAlertDialog.Close.Props> {
  /** "destructive" for deletes and other actions that are hard to undo. */
  variant?: Extract<ButtonVariant, "default" | "destructive">;
}

/** Runs `onClick` and closes the dialog. */
export function AlertDialogAction({ variant = "default", className, ...props }: AlertDialogActionProps) {
  return <BaseAlertDialog.Close data-slot="alert-dialog-action" className={buttonClasses({ variant, className })} {...props} />;
}
