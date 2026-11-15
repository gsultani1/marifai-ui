// packages/ai-ui/src/components/context-menu.tsx
"use client";

import { ContextMenu as BaseContextMenu } from "@base-ui/react/context-menu";

import { cn } from "../lib/cn.js";
import { usePortalContainer } from "../lib/portal.js";
import type { WithClassName } from "../lib/types.js";
import {
  DropdownMenuCheckboxItem,
  type DropdownMenuCheckboxItemProps,
  DropdownMenuGroup,
  type DropdownMenuGroupProps,
  DropdownMenuItem,
  type DropdownMenuItemProps,
  DropdownMenuLabel,
  type DropdownMenuLabelProps,
  DropdownMenuRadioGroup,
  type DropdownMenuRadioGroupProps,
  DropdownMenuRadioItem,
  type DropdownMenuRadioItemProps,
  DropdownMenuSeparator,
  type DropdownMenuSeparatorProps,
  DropdownMenuShortcut,
  type DropdownMenuShortcutProps,
  DropdownMenuSub,
  DropdownMenuSubContent,
  type DropdownMenuSubContentProps,
  type DropdownMenuSubProps,
  DropdownMenuSubTrigger,
  type DropdownMenuSubTriggerProps,
  menuContentClass,
} from "./dropdown-menu.js";

export type ContextMenuProps = BaseContextMenu.Root.Props;

/**
 * Composable right-click menu on Base UI Context Menu. It also opens with a
 * long press on touch and with the context-menu key or Shift+F10, and shares
 * the dropdown menu's items. For a data-driven menu, use ActionContextMenu.
 */
export function ContextMenu(props: ContextMenuProps) {
  return <BaseContextMenu.Root {...props} />;
}

export type ContextMenuTriggerProps = WithClassName<BaseContextMenu.Trigger.Props>;

/** The area that opens the menu. */
export function ContextMenuTrigger({ className, ...props }: ContextMenuTriggerProps) {
  return <BaseContextMenu.Trigger data-slot="context-menu-trigger" className={cn("select-none", className)} {...props} />;
}

export type ContextMenuContentProps = WithClassName<BaseContextMenu.Popup.Props>;

/** The menu surface, opened at the pointer. */
export function ContextMenuContent({ className, ...props }: ContextMenuContentProps) {
  const container = usePortalContainer();
  return (
    <BaseContextMenu.Portal container={container}>
      <BaseContextMenu.Positioner collisionPadding={8} className="z-50 outline-none">
        <BaseContextMenu.Popup data-slot="context-menu-content" className={cn(menuContentClass, "min-w-48", className)} {...props} />
      </BaseContextMenu.Positioner>
    </BaseContextMenu.Portal>
  );
}

export type ContextMenuItemProps = DropdownMenuItemProps;

export function ContextMenuItem(props: ContextMenuItemProps) {
  return <DropdownMenuItem data-slot="context-menu-item" {...props} />;
}

export type ContextMenuCheckboxItemProps = DropdownMenuCheckboxItemProps;

export function ContextMenuCheckboxItem(props: ContextMenuCheckboxItemProps) {
  return <DropdownMenuCheckboxItem data-slot="context-menu-checkbox-item" {...props} />;
}

export type ContextMenuRadioGroupProps = DropdownMenuRadioGroupProps;

export function ContextMenuRadioGroup(props: ContextMenuRadioGroupProps) {
  return <DropdownMenuRadioGroup data-slot="context-menu-radio-group" {...props} />;
}

export type ContextMenuRadioItemProps = DropdownMenuRadioItemProps;

export function ContextMenuRadioItem(props: ContextMenuRadioItemProps) {
  return <DropdownMenuRadioItem data-slot="context-menu-radio-item" {...props} />;
}

export type ContextMenuLabelProps = DropdownMenuLabelProps;

export function ContextMenuLabel(props: ContextMenuLabelProps) {
  return <DropdownMenuLabel data-slot="context-menu-label" {...props} />;
}

export type ContextMenuSeparatorProps = DropdownMenuSeparatorProps;

export function ContextMenuSeparator(props: ContextMenuSeparatorProps) {
  return <DropdownMenuSeparator data-slot="context-menu-separator" {...props} />;
}

export type ContextMenuShortcutProps = DropdownMenuShortcutProps;

export function ContextMenuShortcut(props: ContextMenuShortcutProps) {
  return <DropdownMenuShortcut data-slot="context-menu-shortcut" {...props} />;
}

export type ContextMenuGroupProps = DropdownMenuGroupProps;

export function ContextMenuGroup(props: ContextMenuGroupProps) {
  return <DropdownMenuGroup data-slot="context-menu-group" {...props} />;
}

export type ContextMenuSubProps = DropdownMenuSubProps;

export function ContextMenuSub(props: ContextMenuSubProps) {
  return <DropdownMenuSub {...props} />;
}

export type ContextMenuSubTriggerProps = DropdownMenuSubTriggerProps;

export function ContextMenuSubTrigger(props: ContextMenuSubTriggerProps) {
  return <DropdownMenuSubTrigger data-slot="context-menu-sub-trigger" {...props} />;
}

export type ContextMenuSubContentProps = DropdownMenuSubContentProps;

export function ContextMenuSubContent(props: ContextMenuSubContentProps) {
  return <DropdownMenuSubContent data-slot="context-menu-sub-content" {...props} />;
}
