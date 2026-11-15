// packages/ai-ui/src/components/dialog.tsx
"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { focusRing, iconButton, modalBackdrop, modalPopup } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { usePortalContainer } from "../lib/portal.js";
import type { WithClassName } from "../lib/types.js";
import { ScrollArea, type ScrollAreaProps } from "./scroll-area.js";

export type DialogSize = "sm" | "md" | "lg" | "xl" | "full";

const SIZE_CLASSES: Record<DialogSize, string> = {
  sm: "w-[min(24rem,calc(100vw-2rem))]",
  md: "w-[min(28rem,calc(100vw-2rem))]",
  lg: "w-[min(36rem,calc(100vw-2rem))]",
  xl: "w-[min(48rem,calc(100vw-2rem))]",
  full: "h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)]",
};

/** Close icon button pinned to the top-right corner of a dialog, sheet or drawer surface. */
export const dialogCloseButtonClass = cn(iconButton, focusRing, "absolute top-3 right-3");
export const dialogHeaderClass = "flex flex-col gap-1.5 pr-8";
export const dialogFooterClass = "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end";
export const dialogTitleClass = "text-base leading-snug font-semibold";
export const dialogDescriptionClass = "text-sm text-muted-foreground";

export type DialogProps = BaseDialog.Root.Props;

/** Modal dialog on Base UI Dialog: focus is trapped inside, Escape and an outside press close it, and focus returns to the trigger. */
export function Dialog(props: DialogProps) {
  return <BaseDialog.Root {...props} />;
}

export type DialogTriggerProps = BaseDialog.Trigger.Props;

/** Opens the dialog; use `render={<Button />}` to style it. */
export function DialogTrigger(props: DialogTriggerProps) {
  return <BaseDialog.Trigger data-slot="dialog-trigger" {...props} />;
}

export interface DialogContentProps extends WithClassName<BaseDialog.Popup.Props> {
  /** Width: sm 24rem, md 28rem, lg 36rem, xl 48rem, or full to fill the screen less a margin. */
  size?: DialogSize;
  /** Shows an X button in the top-right corner. */
  showCloseButton?: boolean;
  /** Accessible name of the X button. */
  closeLabel?: string;
  backdropClassName?: string;
}

/** The dialog surface with its backdrop, portaled into the nearest portal container. */
export function DialogContent({ size = "md", showCloseButton = true, closeLabel = "Close", backdropClassName, className, children, ...props }: DialogContentProps) {
  const container = usePortalContainer();
  return (
    <BaseDialog.Portal container={container}>
      <BaseDialog.Backdrop data-slot="dialog-backdrop" className={cn(modalBackdrop, backdropClassName)} />
      <BaseDialog.Popup
        data-slot="dialog-content"
        data-size={size}
        className={cn(modalPopup, "max-h-[calc(100dvh-2rem)]", SIZE_CLASSES[size], className)}
        {...props}
      >
        {children}
        {showCloseButton && (
          <BaseDialog.Close aria-label={closeLabel} data-slot="dialog-close-button" className={dialogCloseButtonClass}>
            <XIcon aria-hidden="true" />
          </BaseDialog.Close>
        )}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  );
}

export type DialogHeaderProps = ComponentProps<"div">;

export function DialogHeader({ className, ...props }: DialogHeaderProps) {
  return <div data-slot="dialog-header" className={cn(dialogHeaderClass, className)} {...props} />;
}

export type DialogTitleProps = WithClassName<BaseDialog.Title.Props>;

/** Heading that names the dialog. */
export function DialogTitle({ className, ...props }: DialogTitleProps) {
  return <BaseDialog.Title data-slot="dialog-title" className={cn(dialogTitleClass, className)} {...props} />;
}

export type DialogDescriptionProps = WithClassName<BaseDialog.Description.Props>;

/** Text that describes the dialog to assistive technology. */
export function DialogDescription({ className, ...props }: DialogDescriptionProps) {
  return <BaseDialog.Description data-slot="dialog-description" className={cn(dialogDescriptionClass, className)} {...props} />;
}

export type DialogBodyProps = ScrollAreaProps;

/**
 * Main content that scrolls when the dialog reaches the screen height; it
 * joins the tab order only while it overflows.
 */
export function DialogBody({ className, viewportClassName, ...props }: DialogBodyProps) {
  return <ScrollArea data-slot="dialog-body" className={cn("-mx-5", className)} viewportClassName={cn("px-5 py-0.5", viewportClassName)} {...props} />;
}

export type DialogFooterProps = ComponentProps<"div">;

/** Action row: stacked with the primary action first on phones, right-aligned from the sm breakpoint. */
export function DialogFooter({ className, ...props }: DialogFooterProps) {
  return <div data-slot="dialog-footer" className={cn(dialogFooterClass, className)} {...props} />;
}

export type DialogCloseProps = BaseDialog.Close.Props;

/** Closes the dialog; use `render={<Button variant="outline" />}` to style it. */
export function DialogClose(props: DialogCloseProps) {
  return <BaseDialog.Close data-slot="dialog-close" {...props} />;
}
