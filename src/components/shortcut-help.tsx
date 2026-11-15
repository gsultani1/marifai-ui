// packages/ai-ui/src/components/shortcut-help.tsx
"use client";

import { Dialog } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { Fragment } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { useApplePlatform, useRegisteredShortcuts, useShortcuts } from "../hooks/use-shortcuts.js";
import { focusRing, iconButton, modalBackdrop, popupSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { usePortalContainer } from "../lib/portal.js";
import { formatShortcut } from "../lib/shortcuts.js";

export interface ShortcutHelpProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Key that opens the dialog; false to open it only from your own control. */
  trigger?: string | false;
  title?: string;
}

/** Keys rendered as separate kbd elements, such as ⌘ K or Ctrl + K. */
export function ShortcutKeys({ keys, className }: { keys: string; className?: string }) {
  const mac = useApplePlatform();
  const text = formatShortcut(keys, mac);
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {text.split(" then ").map((step, index) => (
        <Fragment key={index}>
          {index > 0 && <span className="text-xs text-muted-foreground">then</span>}
          <kbd className="min-w-6 rounded border border-border bg-muted px-1.5 py-0.5 text-center font-mono text-xs text-foreground">{step}</kbd>
        </Fragment>
      ))}
    </span>
  );
}

/**
 * Dialog listing every shortcut registered with `useShortcuts`, grouped,
 * opened with "?" by default (never while typing in a field).
 */
export function ShortcutHelp({ open, defaultOpen = false, onOpenChange, trigger = "?", title = "Keyboard shortcuts" }: ShortcutHelpProps) {
  const [isOpen, setOpen] = useControllableState<boolean>({ value: open, defaultValue: defaultOpen, onChange: onOpenChange });
  const shortcuts = useRegisteredShortcuts();
  const container = usePortalContainer();
  useShortcuts(trigger ? [{ id: "shortcut-help", keys: trigger, description: "Show keyboard shortcuts", group: "General", handler: () => setOpen(true) }] : []);

  const groups = new Map<string, typeof shortcuts>();
  for (const shortcut of shortcuts) {
    const group = shortcut.group ?? "General";
    groups.set(group, [...(groups.get(group) ?? []), shortcut]);
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(next) => setOpen(next)}>
      <Dialog.Portal container={container}>
        <Dialog.Backdrop className={modalBackdrop} />
        <Dialog.Popup className={cn(popupSurface, "fixed top-1/2 left-1/2 z-50 flex max-h-[min(80vh,40rem)] w-[min(calc(100vw-2rem),32rem)] -translate-x-1/2 -translate-y-1/2 flex-col outline-none")}>
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
            <Dialog.Close aria-label="Close" className={cn(iconButton, focusRing)}>
              <XIcon aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="flex flex-col gap-4 overflow-y-auto p-4">
            {[...groups].map(([group, list]) => (
              <section key={group} aria-labelledby={`shortcut-group-${group}`} className="flex flex-col gap-1">
                <h3 id={`shortcut-group-${group}`} className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {group}
                </h3>
                <dl className="flex flex-col">
                  {list.map((shortcut) => (
                    <div key={`${shortcut.id}-${shortcut.keys}`} className="flex items-center justify-between gap-4 border-b border-border py-1.5 text-sm last:border-0">
                      <dt>{shortcut.description}</dt>
                      <dd>
                        <ShortcutKeys keys={shortcut.keys} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
