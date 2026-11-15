// packages/ai-ui/src/components/dropdown-menu.tsx
"use client";

import { Menu } from "@base-ui/react/menu";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react";
import { type ComponentProps, createContext, use } from "react";

import { useApplePlatform } from "../hooks/use-shortcuts.js";
import { popupSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { usePortalContainer } from "../lib/portal.js";
import { formatShortcut } from "../lib/shortcuts.js";
import type { WithClassName } from "../lib/types.js";

/** Popup surface shared by dropdown, context and menubar menus. */
export const menuContentClass = cn(popupSurface, "max-h-[var(--available-height)] min-w-44 overflow-y-auto p-1 outline-none");
/** Row shared by every menu item, checkbox, radio and submenu trigger. */
export const menuItemClass =
  "group/menu-item relative flex min-h-8 cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[popup-open]:bg-accent data-[popup-open]:text-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0";
export const menuItemDestructiveClass = "text-destructive data-[highlighted]:bg-destructive data-[highlighted]:text-background";
/** Left padding that lines an item up with checkbox and radio items. */
export const menuItemInsetClass = "pl-8";
export const menuIndicatorClass = "pointer-events-none absolute left-2 flex size-4 items-center justify-center";
export const menuLabelClass = "px-2 py-1.5 text-xs font-medium text-muted-foreground";
export const menuSeparatorClass = "-mx-1 my-1 h-px bg-border";
export const menuShortcutClass = "ml-auto pl-4 font-sans text-xs tracking-wide text-muted-foreground group-data-[highlighted]/menu-item:text-current";

export type MenuSide = "top" | "right" | "bottom" | "left";
export type MenuAlign = "start" | "center" | "end";

const MenuGroupContext = createContext(false);

export type DropdownMenuProps = Menu.Root.Props;

/**
 * Composable dropdown menu on Base UI Menu: arrow keys, Home and End,
 * typeahead, Escape, submenus and focus return are built in. For a
 * data-driven menu, use ActionMenu.
 */
export function DropdownMenu(props: DropdownMenuProps) {
  return <Menu.Root {...props} />;
}

export type DropdownMenuTriggerProps = Menu.Trigger.Props;

/** Opens the menu on click, Enter, Space or Arrow Down; use `render={<Button />}` to style it. */
export function DropdownMenuTrigger(props: DropdownMenuTriggerProps) {
  return <Menu.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

export interface DropdownMenuContentProps extends WithClassName<Menu.Popup.Props> {
  side?: MenuSide;
  align?: MenuAlign;
  sideOffset?: number;
  alignOffset?: number;
}

export function DropdownMenuContent({ side = "bottom", align = "start", sideOffset = 4, alignOffset = 0, className, ...props }: DropdownMenuContentProps) {
  const container = usePortalContainer();
  return (
    <Menu.Portal container={container}>
      <Menu.Positioner side={side} align={align} sideOffset={sideOffset} alignOffset={alignOffset} collisionPadding={8} className="z-50 outline-none">
        <Menu.Popup data-slot="dropdown-menu-content" className={cn(menuContentClass, className)} {...props} />
      </Menu.Positioner>
    </Menu.Portal>
  );
}

export interface DropdownMenuItemProps extends WithClassName<Menu.Item.Props> {
  /** "destructive" colors the item for deletes and other hard-to-undo actions. */
  variant?: "default" | "destructive";
  /** Indents the item to line up with checkbox and radio items. */
  inset?: boolean;
}

/** An action; `onClick` runs on click, Enter and Space, then the menu closes. */
export function DropdownMenuItem({ variant = "default", inset = false, className, ...props }: DropdownMenuItemProps) {
  return (
    <Menu.Item
      data-slot="dropdown-menu-item"
      data-variant={variant}
      className={cn(menuItemClass, inset && menuItemInsetClass, variant === "destructive" && menuItemDestructiveClass, className)}
      {...props}
    />
  );
}

export type DropdownMenuCheckboxItemProps = WithClassName<Menu.CheckboxItem.Props>;

/** A toggle exposed as menuitemcheckbox; stays open on click unless `closeOnClick` is set. */
export function DropdownMenuCheckboxItem({ className, children, ...props }: DropdownMenuCheckboxItemProps) {
  return (
    <Menu.CheckboxItem data-slot="dropdown-menu-checkbox-item" className={cn(menuItemClass, menuItemInsetClass, className)} {...props}>
      <span className={menuIndicatorClass}>
        <Menu.CheckboxItemIndicator>
          <CheckIcon aria-hidden="true" />
        </Menu.CheckboxItemIndicator>
      </span>
      {children}
    </Menu.CheckboxItem>
  );
}

export type DropdownMenuRadioGroupProps = Menu.RadioGroup.Props;

/** Group of radio items with `value`, `defaultValue` and `onValueChange`. */
export function DropdownMenuRadioGroup(props: DropdownMenuRadioGroupProps) {
  return (
    <MenuGroupContext value={true}>
      <Menu.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />
    </MenuGroupContext>
  );
}

export type DropdownMenuRadioItemProps = WithClassName<Menu.RadioItem.Props>;

/** One choice in a DropdownMenuRadioGroup, exposed as menuitemradio. */
export function DropdownMenuRadioItem({ className, children, ...props }: DropdownMenuRadioItemProps) {
  return (
    <Menu.RadioItem data-slot="dropdown-menu-radio-item" className={cn(menuItemClass, menuItemInsetClass, className)} {...props}>
      <span className={menuIndicatorClass}>
        <Menu.RadioItemIndicator>
          <CircleIcon aria-hidden="true" className="size-2! fill-current" />
        </Menu.RadioItemIndicator>
      </span>
      {children}
    </Menu.RadioItem>
  );
}

export interface DropdownMenuLabelProps extends ComponentProps<"div"> {
  inset?: boolean;
}

/** Section heading; inside a DropdownMenuGroup or DropdownMenuRadioGroup it also names the group. */
export function DropdownMenuLabel({ inset = false, className, ...props }: DropdownMenuLabelProps) {
  const inGroup = use(MenuGroupContext);
  const classes = cn(menuLabelClass, inset && menuItemInsetClass, className);
  if (inGroup) return <Menu.GroupLabel data-slot="dropdown-menu-label" className={classes} {...props} />;
  return <div data-slot="dropdown-menu-label" className={classes} {...props} />;
}

export type DropdownMenuSeparatorProps = WithClassName<Menu.Separator.Props>;

export function DropdownMenuSeparator({ className, ...props }: DropdownMenuSeparatorProps) {
  return <Menu.Separator data-slot="dropdown-menu-separator" className={cn(menuSeparatorClass, className)} {...props} />;
}

export interface DropdownMenuShortcutProps extends ComponentProps<"kbd"> {
  /** Shortcut such as "Mod+S", shown as ⌘S on Apple platforms and Ctrl+S elsewhere; children are used when omitted. */
  keys?: string;
}

/** Keyboard shortcut hint at the end of an item. */
export function DropdownMenuShortcut({ keys, className, children, ...props }: DropdownMenuShortcutProps) {
  const apple = useApplePlatform();
  return (
    <kbd data-slot="dropdown-menu-shortcut" className={cn(menuShortcutClass, className)} {...props}>
      {keys ? formatShortcut(keys, apple) : children}
    </kbd>
  );
}

export type DropdownMenuGroupProps = Menu.Group.Props;

/** Groups related items; a DropdownMenuLabel inside names the group. */
export function DropdownMenuGroup(props: DropdownMenuGroupProps) {
  return (
    <MenuGroupContext value={true}>
      <Menu.Group data-slot="dropdown-menu-group" {...props} />
    </MenuGroupContext>
  );
}

export type DropdownMenuSubProps = Menu.SubmenuRoot.Props;

/** Nested menu; opens on hover, click, Enter or Arrow Right and closes with Arrow Left. */
export function DropdownMenuSub(props: DropdownMenuSubProps) {
  return <Menu.SubmenuRoot {...props} />;
}

export interface DropdownMenuSubTriggerProps extends WithClassName<Menu.SubmenuTrigger.Props> {
  inset?: boolean;
}

export function DropdownMenuSubTrigger({ inset = false, className, children, ...props }: DropdownMenuSubTriggerProps) {
  return (
    <Menu.SubmenuTrigger data-slot="dropdown-menu-sub-trigger" className={cn(menuItemClass, inset && menuItemInsetClass, className)} {...props}>
      {children}
      <ChevronRightIcon aria-hidden="true" className="ml-auto text-muted-foreground group-data-[highlighted]/menu-item:text-current" />
    </Menu.SubmenuTrigger>
  );
}

export interface DropdownMenuSubContentProps extends WithClassName<Menu.Popup.Props> {
  sideOffset?: number;
  alignOffset?: number;
}

export function DropdownMenuSubContent({ sideOffset = 4, alignOffset = -5, className, ...props }: DropdownMenuSubContentProps) {
  const container = usePortalContainer();
  return (
    <Menu.Portal container={container}>
      <Menu.Positioner sideOffset={sideOffset} alignOffset={alignOffset} collisionPadding={8} className="z-50 outline-none">
        <Menu.Popup data-slot="dropdown-menu-sub-content" className={cn(menuContentClass, className)} {...props} />
      </Menu.Positioner>
    </Menu.Portal>
  );
}
