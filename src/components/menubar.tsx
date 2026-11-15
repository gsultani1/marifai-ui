// packages/ai-ui/src/components/menubar.tsx
"use client";

import { Menu } from "@base-ui/react/menu";
import { Menubar as BaseMenubar } from "@base-ui/react/menubar";

import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import type { WithClassName } from "../lib/types.js";
import {
  DropdownMenuCheckboxItem,
  type DropdownMenuCheckboxItemProps,
  DropdownMenuContent,
  type DropdownMenuContentProps,
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
} from "./dropdown-menu.js";

export type MenubarProps = WithClassName<BaseMenubar.Props>;

/**
 * Row of menus like a desktop app's File, Edit and View, on Base UI Menubar.
 * Arrow keys move between menus (and into an open one), Home and End jump to
 * the ends, and moving the pointer across opens each menu once one is open.
 * Give it an `aria-label`.
 */
export function Menubar({ className, ...props }: MenubarProps) {
  return <BaseMenubar data-slot="menubar" className={cn("flex h-9 w-fit items-center gap-0.5 rounded-lg border border-border bg-background p-1", className)} {...props} />;
}

export type MenubarMenuProps = Menu.Root.Props;

/** One menu in the bar; holds a MenubarTrigger and MenubarContent. */
export function MenubarMenu(props: MenubarMenuProps) {
  return <Menu.Root {...props} />;
}

export type MenubarTriggerProps = WithClassName<Menu.Trigger.Props>;

export function MenubarTrigger({ className, ...props }: MenubarTriggerProps) {
  return (
    <Menu.Trigger
      data-slot="menubar-trigger"
      className={cn(
        "flex h-7 items-center rounded-md px-2.5 text-sm font-medium text-foreground outline-none select-none hover:bg-accent hover:text-accent-foreground data-[disabled]:opacity-50 data-[popup-open]:bg-accent data-[popup-open]:text-accent-foreground",
        focusRing,
        "focus-visible:ring-offset-0",
        className,
      )}
      {...props}
    />
  );
}

export type MenubarContentProps = DropdownMenuContentProps;

export function MenubarContent({ align = "start", sideOffset = 6, alignOffset = -4, ...props }: MenubarContentProps) {
  return <DropdownMenuContent data-slot="menubar-content" align={align} sideOffset={sideOffset} alignOffset={alignOffset} {...props} />;
}

export type MenubarItemProps = DropdownMenuItemProps;

export function MenubarItem(props: MenubarItemProps) {
  return <DropdownMenuItem data-slot="menubar-item" {...props} />;
}

export type MenubarCheckboxItemProps = DropdownMenuCheckboxItemProps;

export function MenubarCheckboxItem(props: MenubarCheckboxItemProps) {
  return <DropdownMenuCheckboxItem data-slot="menubar-checkbox-item" {...props} />;
}

export type MenubarRadioGroupProps = DropdownMenuRadioGroupProps;

export function MenubarRadioGroup(props: MenubarRadioGroupProps) {
  return <DropdownMenuRadioGroup data-slot="menubar-radio-group" {...props} />;
}

export type MenubarRadioItemProps = DropdownMenuRadioItemProps;

export function MenubarRadioItem(props: MenubarRadioItemProps) {
  return <DropdownMenuRadioItem data-slot="menubar-radio-item" {...props} />;
}

export type MenubarLabelProps = DropdownMenuLabelProps;

export function MenubarLabel(props: MenubarLabelProps) {
  return <DropdownMenuLabel data-slot="menubar-label" {...props} />;
}

export type MenubarGroupProps = DropdownMenuGroupProps;

export function MenubarGroup(props: MenubarGroupProps) {
  return <DropdownMenuGroup data-slot="menubar-group" {...props} />;
}

export type MenubarSeparatorProps = DropdownMenuSeparatorProps;

export function MenubarSeparator(props: MenubarSeparatorProps) {
  return <DropdownMenuSeparator data-slot="menubar-separator" {...props} />;
}

export type MenubarShortcutProps = DropdownMenuShortcutProps;

export function MenubarShortcut(props: MenubarShortcutProps) {
  return <DropdownMenuShortcut data-slot="menubar-shortcut" {...props} />;
}

export type MenubarSubProps = DropdownMenuSubProps;

export function MenubarSub(props: MenubarSubProps) {
  return <DropdownMenuSub {...props} />;
}

export type MenubarSubTriggerProps = DropdownMenuSubTriggerProps;

export function MenubarSubTrigger(props: MenubarSubTriggerProps) {
  return <DropdownMenuSubTrigger data-slot="menubar-sub-trigger" {...props} />;
}

export type MenubarSubContentProps = DropdownMenuSubContentProps;

export function MenubarSubContent(props: MenubarSubContentProps) {
  return <DropdownMenuSubContent data-slot="menubar-sub-content" {...props} />;
}
