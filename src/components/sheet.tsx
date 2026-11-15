// packages/ai-ui/src/components/sheet.tsx
"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { Drawer as BaseDrawer } from "@base-ui/react/drawer";
import { XIcon } from "lucide-react";

import { modalBackdrop } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { usePortalContainer } from "../lib/portal.js";
import type { WithClassName } from "../lib/types.js";
import {
  DialogBody,
  type DialogBodyProps,
  DialogClose,
  type DialogCloseProps,
  dialogCloseButtonClass,
  DialogDescription,
  type DialogDescriptionProps,
  DialogFooter,
  type DialogFooterProps,
  DialogHeader,
  type DialogHeaderProps,
  DialogTitle,
  type DialogTitleProps,
  DialogTrigger,
  type DialogTriggerProps,
} from "./dialog.js";

export type SheetSide = "top" | "right" | "bottom" | "left";

const SIDE_CLASSES: Record<SheetSide, string> = {
  right: "inset-y-0 right-0 h-full w-3/4 max-w-sm border-l data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full",
  left: "inset-y-0 left-0 h-full w-3/4 max-w-sm border-r data-[ending-style]:-translate-x-full data-[starting-style]:-translate-x-full",
  top: "inset-x-0 top-0 max-h-[85dvh] border-b data-[ending-style]:-translate-y-full data-[starting-style]:-translate-y-full",
  bottom: "inset-x-0 bottom-0 max-h-[85dvh] border-t pb-[calc(1.25rem+env(safe-area-inset-bottom))] data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full",
};

export type SheetProps = BaseDialog.Root.Props;

/** Panel that slides in from an edge of the screen, built on Base UI Dialog (modal, Escape closes, focus returns to the trigger). */
export function Sheet(props: SheetProps) {
  return <BaseDialog.Root {...props} />;
}

export type SheetTriggerProps = DialogTriggerProps;

export function SheetTrigger(props: SheetTriggerProps) {
  return <DialogTrigger data-slot="sheet-trigger" {...props} />;
}

export interface SheetContentProps extends WithClassName<BaseDialog.Popup.Props> {
  /** Edge the sheet slides in from. */
  side?: SheetSide;
  showCloseButton?: boolean;
  closeLabel?: string;
  backdropClassName?: string;
}

export function SheetContent({ side = "right", showCloseButton = true, closeLabel = "Close", backdropClassName, className, children, ...props }: SheetContentProps) {
  const container = usePortalContainer();
  return (
    <BaseDialog.Portal container={container}>
      <BaseDialog.Backdrop data-slot="sheet-backdrop" className={cn(modalBackdrop, backdropClassName)} />
      <BaseDialog.Popup
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed z-50 flex flex-col gap-4 border-border bg-background p-5 text-foreground shadow-xl outline-none transition-transform duration-200 ease-out motion-reduce:transition-none",
          SIDE_CLASSES[side],
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <BaseDialog.Close aria-label={closeLabel} data-slot="sheet-close-button" className={dialogCloseButtonClass}>
            <XIcon aria-hidden="true" />
          </BaseDialog.Close>
        )}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  );
}

export type SheetHeaderProps = DialogHeaderProps;

export function SheetHeader(props: SheetHeaderProps) {
  return <DialogHeader data-slot="sheet-header" {...props} />;
}

export type SheetTitleProps = DialogTitleProps;

export function SheetTitle(props: SheetTitleProps) {
  return <DialogTitle data-slot="sheet-title" {...props} />;
}

export type SheetDescriptionProps = DialogDescriptionProps;

export function SheetDescription(props: SheetDescriptionProps) {
  return <DialogDescription data-slot="sheet-description" {...props} />;
}

export type SheetBodyProps = DialogBodyProps;

/** Scrolling middle of the sheet; give the content a flex-1 slot between header and footer. */
export function SheetBody({ className, ...props }: SheetBodyProps) {
  return <DialogBody data-slot="sheet-body" className={cn("flex-1", className)} {...props} />;
}

export type SheetFooterProps = DialogFooterProps;

export function SheetFooter({ className, ...props }: SheetFooterProps) {
  return <DialogFooter data-slot="sheet-footer" className={cn("mt-auto", className)} {...props} />;
}

export type SheetCloseProps = DialogCloseProps;

export function SheetClose(props: SheetCloseProps) {
  return <DialogClose data-slot="sheet-close" {...props} />;
}

export type DrawerProps = Omit<BaseDrawer.Root.Props, "swipeDirection">;

/**
 * Bottom sheet on Base UI Drawer: swipe down (or press Escape, or tap the
 * backdrop) to dismiss, with optional `snapPoints`. Same parts as Sheet.
 */
export function Drawer(props: DrawerProps) {
  return <BaseDrawer.Root swipeDirection="down" {...props} />;
}

export type DrawerTriggerProps = DialogTriggerProps;

export function DrawerTrigger(props: DrawerTriggerProps) {
  return <DialogTrigger data-slot="drawer-trigger" {...props} />;
}

export interface DrawerContentProps extends WithClassName<BaseDrawer.Popup.Props> {
  showCloseButton?: boolean;
  closeLabel?: string;
  backdropClassName?: string;
  /** Classes for the inner content area that holds the children. */
  contentClassName?: string;
}

export function DrawerContent({ showCloseButton = true, closeLabel = "Close", backdropClassName, contentClassName, className, children, ...props }: DrawerContentProps) {
  const container = usePortalContainer();
  return (
    <BaseDrawer.Portal container={container}>
      <BaseDrawer.Backdrop
        data-slot="drawer-backdrop"
        className={cn(
          "fixed inset-0 z-50 bg-black/40 opacity-[calc(1-var(--drawer-swipe-progress,0))] transition-opacity duration-300 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 data-[swiping]:duration-0 motion-reduce:transition-none",
          backdropClassName,
        )}
      />
      <BaseDrawer.Viewport data-slot="drawer-viewport" className="fixed inset-0 z-50 flex items-end justify-center">
        <BaseDrawer.Popup
          data-slot="drawer-content"
          className={cn(
            "relative flex max-h-[85dvh] w-full max-w-xl flex-col rounded-t-xl border border-b-0 border-border bg-background text-foreground shadow-xl outline-none [transform:translateY(calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y,0px)))] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] data-[ending-style]:[transform:translateY(100%)] data-[starting-style]:[transform:translateY(100%)] data-[swiping]:select-none motion-reduce:transition-none",
            className,
          )}
          {...props}
        >
          <div aria-hidden="true" data-slot="drawer-handle" className="mx-auto mt-2.5 h-1.5 w-12 shrink-0 rounded-full bg-muted-foreground/40" />
          <BaseDrawer.Content
            data-slot="drawer-body"
            className={cn("flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]", contentClassName)}
          >
            {children}
          </BaseDrawer.Content>
          {showCloseButton && (
            <BaseDrawer.Close aria-label={closeLabel} data-slot="drawer-close-button" className={dialogCloseButtonClass}>
              <XIcon aria-hidden="true" />
            </BaseDrawer.Close>
          )}
        </BaseDrawer.Popup>
      </BaseDrawer.Viewport>
    </BaseDrawer.Portal>
  );
}

export type DrawerHeaderProps = DialogHeaderProps;

export function DrawerHeader(props: DrawerHeaderProps) {
  return <DialogHeader data-slot="drawer-header" {...props} />;
}

export type DrawerTitleProps = DialogTitleProps;

export function DrawerTitle(props: DrawerTitleProps) {
  return <DialogTitle data-slot="drawer-title" {...props} />;
}

export type DrawerDescriptionProps = DialogDescriptionProps;

export function DrawerDescription(props: DrawerDescriptionProps) {
  return <DialogDescription data-slot="drawer-description" {...props} />;
}

export type DrawerFooterProps = DialogFooterProps;

export function DrawerFooter(props: DrawerFooterProps) {
  return <DialogFooter data-slot="drawer-footer" {...props} />;
}

export type DrawerCloseProps = DialogCloseProps;

export function DrawerClose(props: DrawerCloseProps) {
  return <DialogClose data-slot="drawer-close" {...props} />;
}
