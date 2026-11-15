// packages/ai-ui/src/components/action-menu.tsx
"use client";

import { ContextMenu } from "@base-ui/react/context-menu";
import { Menu } from "@base-ui/react/menu";
import { CheckIcon, ChevronRightIcon } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import { popupSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { usePortalContainer } from "../lib/portal.js";

export type MenuEntry =
  | {
      type?: "item";
      id: string;
      label: ReactNode;
      icon?: ReactNode;
      /** Shown on the right, e.g. "⌘C". */
      shortcut?: string;
      disabled?: boolean;
      destructive?: boolean;
      /** Renders a check mark and exposes the item as a menu checkbox; for toggles such as "Bold" and the current choice in a list. */
      checked?: boolean;
      onSelect: () => void;
    }
  | { type: "separator"; id: string }
  | { type: "label"; id: string; label: ReactNode }
  | { type: "submenu"; id: string; label: ReactNode; icon?: ReactNode; items: MenuEntry[]; disabled?: boolean };

const itemClass =
  "flex min-h-8 cursor-default items-center gap-2 rounded-md px-2 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0";

type Parts = typeof Menu | typeof ContextMenu;

function Entries({ parts, items }: { parts: Parts; items: MenuEntry[] }) {
  const Part = parts as typeof Menu;
  const container = usePortalContainer();
  return items.map((entry) => {
    if (entry.type === "separator") return <Part.Separator key={entry.id} className="my-1 h-px bg-border" />;
    if (entry.type === "label") {
      return (
        <div key={entry.id} className="px-2 py-1 text-xs font-medium text-muted-foreground">
          {entry.label}
        </div>
      );
    }
    if (entry.type === "submenu") {
      return (
        <Part.SubmenuRoot key={entry.id} disabled={entry.disabled}>
          <Part.SubmenuTrigger className={itemClass}>
            {entry.icon}
            <span className="flex-1">{entry.label}</span>
            <ChevronRightIcon aria-hidden="true" className="text-muted-foreground" />
          </Part.SubmenuTrigger>
          <Part.Portal container={container}>
            <Part.Positioner sideOffset={4} className="z-50">
              <Part.Popup className={cn(popupSurface, "min-w-44 p-1 outline-none")}>
                <Entries parts={parts} items={entry.items} />
              </Part.Popup>
            </Part.Positioner>
          </Part.Portal>
        </Part.SubmenuRoot>
      );
    }
    const shortcut = entry.shortcut && <kbd className="font-sans text-xs text-muted-foreground">{entry.shortcut}</kbd>;
    if (entry.checked !== undefined) {
      return (
        <Part.CheckboxItem key={entry.id} checked={entry.checked} onCheckedChange={() => entry.onSelect()} closeOnClick disabled={entry.disabled} className={itemClass}>
          <CheckIcon aria-hidden="true" className={cn(!entry.checked && "invisible")} />
          <span className="flex-1">{entry.label}</span>
          {shortcut}
        </Part.CheckboxItem>
      );
    }
    return (
      <Part.Item key={entry.id} disabled={entry.disabled} onClick={entry.onSelect} className={cn(itemClass, entry.destructive && "text-destructive data-[highlighted]:text-destructive")}>
        {entry.icon}
        <span className="flex-1">{entry.label}</span>
        {shortcut}
      </Part.Item>
    );
  });
}

export interface ActionMenuProps {
  /** The button that opens the menu, e.g. `<button type="button" aria-label="More">…</button>`. */
  trigger: ReactElement;
  items: MenuEntry[];
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  onOpenChange?: (open: boolean) => void;
}

/** Dropdown menu of actions built on Base UI Menu: keyboard navigation, typeahead, submenus. */
export function ActionMenu({ trigger, items, align = "start", side = "bottom", onOpenChange }: ActionMenuProps) {
  const container = usePortalContainer();
  return (
    <Menu.Root onOpenChange={onOpenChange}>
      <Menu.Trigger render={trigger} />
      <Menu.Portal container={container}>
        <Menu.Positioner sideOffset={4} align={align} side={side} className="z-50">
          <Menu.Popup className={cn(popupSurface, "max-h-[var(--available-height)] min-w-44 overflow-y-auto p-1 outline-none")}>
            <Entries parts={Menu} items={items} />
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export interface ActionContextMenuProps {
  children: ReactNode;
  items: MenuEntry[];
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

/** Right-click (and context-menu key) menu for an area, sharing ActionMenu's entries. */
export function ActionContextMenu({ children, items, disabled, onOpenChange, className }: ActionContextMenuProps) {
  const container = usePortalContainer();
  return (
    <ContextMenu.Root disabled={disabled} onOpenChange={onOpenChange}>
      <ContextMenu.Trigger className={className}>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal container={container}>
        <ContextMenu.Positioner className="z-50">
          <ContextMenu.Popup className={cn(popupSurface, "max-h-[var(--available-height)] min-w-48 overflow-y-auto p-1 outline-none")}>
            <Entries parts={ContextMenu} items={items} />
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
