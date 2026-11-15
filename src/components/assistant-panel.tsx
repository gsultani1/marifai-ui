// packages/ai-ui/src/components/assistant-panel.tsx
"use client";

import { Dialog } from "@base-ui/react/dialog";
import { SparklesIcon, XIcon } from "lucide-react";
import { type ReactNode, useRef } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { useApplePlatform, useShortcuts } from "../hooks/use-shortcuts.js";
import { focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { usePortalContainer } from "../lib/portal.js";
import { formatShortcut } from "../lib/shortcuts.js";
import { SegmentedControl } from "./segmented-control.js";

export type AssistantMode = "ask" | "edit";

export interface AssistantPanelProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  /** Toggles the panel from anywhere, including inside fields; false disables it. */
  hotkey?: string | false;
  /** What the assistant is looking at, e.g. "Q3 forecast.xlsx · B2:F40". */
  contextLabel?: ReactNode;
  onClearContext?: () => void;
  /** Shows an Ask / Edit switch when `onModeChange` is set. */
  mode?: AssistantMode;
  onModeChange?: (mode: AssistantMode) => void;
  /** Floating card in the corner, or a full-height sheet docked to the right. */
  placement?: "floating" | "docked";
  launcherLabel?: string;
  /** Renders no launcher; open the panel with the hotkey or `open`. */
  hideLauncher?: boolean;
  launcherClassName?: string;
  headerActions?: ReactNode;
  /** Conversation and composer. */
  children: ReactNode;
  className?: string;
}

/**
 * In-app assistant beside your own UI: a launcher button and hotkey open a
 * non-modal panel, so the page stays usable, with the current context and
 * an Ask / Edit mode in the header. Escape closes it and returns focus.
 */
export function AssistantPanel({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  title = "Assistant",
  hotkey = "mod+j",
  contextLabel,
  onClearContext,
  mode = "ask",
  onModeChange,
  placement = "floating",
  launcherLabel = "Ask the assistant",
  hideLauncher = false,
  launcherClassName,
  headerActions,
  children,
  className,
}: AssistantPanelProps) {
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const container = usePortalContainer();
  const bodyRef = useRef<HTMLDivElement>(null);
  const apple = useApplePlatform();
  const shortcut = hotkey ? formatShortcut(hotkey, apple) : undefined;

  useShortcuts([
    {
      id: "assistant-panel-toggle",
      keys: hotkey || "mod+j",
      description: open ? `Close ${title.toLowerCase()}` : `Open ${title.toLowerCase()}`,
      group: "General",
      allowInInputs: true,
      enabled: hotkey !== false,
      handler: (event) => {
        event.preventDefault();
        setOpen(!open);
      },
    },
  ]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen} modal={false} disablePointerDismissal>
      {!hideLauncher && (
        <Dialog.Trigger
          aria-keyshortcuts={hotkey ? hotkey.replace(/mod/i, apple ? "Meta" : "Control").replace(/\b\w/g, (letter) => letter.toUpperCase()) : undefined}
          title={shortcut ? `${launcherLabel} (${shortcut})` : launcherLabel}
          className={cn(
            "fixed right-4 bottom-4 z-40 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-lg hover:opacity-90 data-[popup-open]:invisible [&_svg]:size-4",
            focusRing,
            launcherClassName,
          )}
        >
          <SparklesIcon aria-hidden="true" />
          {launcherLabel}
        </Dialog.Trigger>
      )}
      <Dialog.Portal container={container}>
        <Dialog.Popup
          data-slot="assistant-panel"
          data-placement={placement}
          initialFocus={(type) => {
            if (type === "touch") return true;
            return bodyRef.current?.querySelector<HTMLElement>("textarea, [contenteditable='true'], input:not([type='hidden']):not([aria-hidden='true'])") ?? true;
          }}
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden border border-border bg-popover text-popover-foreground shadow-2xl outline-none transition-[opacity,transform] duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none",
            placement === "floating"
              ? "right-4 bottom-4 h-[min(40rem,calc(100dvh-2rem))] w-[min(26rem,calc(100vw-2rem))] rounded-xl data-[ending-style]:translate-y-2 data-[starting-style]:translate-y-2"
              : "inset-y-0 right-0 w-[min(28rem,100vw)] border-y-0 border-r-0 data-[ending-style]:translate-x-4 data-[starting-style]:translate-x-4",
            className,
          )}
        >
          <header className="flex flex-col gap-2 border-b border-border p-3">
            <div className="flex items-center gap-2">
              <SparklesIcon aria-hidden="true" className="size-4 text-muted-foreground" />
              <Dialog.Title className="text-sm font-semibold">{title}</Dialog.Title>
              {shortcut && (
                <kbd aria-hidden="true" className="rounded border border-border px-1 font-sans text-[0.6875rem] text-muted-foreground">
                  {shortcut}
                </kbd>
              )}
              <div className="ml-auto flex items-center gap-1">
                {headerActions}
                <Dialog.Close aria-label={`Close ${title.toLowerCase()}`} className={cn(iconButton, focusRing)}>
                  <XIcon aria-hidden="true" />
                </Dialog.Close>
              </div>
            </div>
            {(contextLabel || onModeChange) && (
              <div className="flex flex-wrap items-center gap-2">
                {contextLabel && (
                  <p className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-md border border-border bg-muted/50 py-0.5 pr-0.5 pl-2 text-xs">
                    <span className="text-muted-foreground">Context:</span>
                    <span className="truncate font-medium">{contextLabel}</span>
                    {onClearContext ? (
                      <button type="button" aria-label="Remove context" title="Remove context" onClick={onClearContext} className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground [&_svg]:size-3", focusRing)}>
                        <XIcon aria-hidden="true" />
                      </button>
                    ) : (
                      <span className="pr-1.5" />
                    )}
                  </p>
                )}
                {onModeChange && (
                  <SegmentedControl
                    label="Mode"
                    size="sm"
                    value={mode}
                    onValueChange={onModeChange}
                    className="ml-auto"
                    options={[
                      { value: "ask", label: "Ask" },
                      { value: "edit", label: "Edit" },
                    ]}
                  />
                )}
              </div>
            )}
          </header>
          <div ref={bodyRef} className="flex min-h-0 flex-1 flex-col">
            {children}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
