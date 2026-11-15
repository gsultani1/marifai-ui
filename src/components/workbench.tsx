// packages/ai-ui/src/components/workbench.tsx
"use client";

import { PanelBottomIcon, PanelLeftIcon } from "lucide-react";
import type { ReactNode } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { useApplePlatform, useShortcuts } from "../hooks/use-shortcuts.js";
import { focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatShortcut } from "../lib/shortcuts.js";
import { ResizablePanels } from "./resizable-panels.js";

export interface WorkbenchProps {
  /** File tree, search or other side views. */
  sidebar?: ReactNode;
  sidebarLabel?: string;
  sidebarOpen?: boolean;
  defaultSidebarOpen?: boolean;
  onSidebarOpenChange?: (open: boolean) => void;
  /** Tabs and editor. */
  editor: ReactNode;
  /** Terminal, logs or problems under the editor. */
  panel?: ReactNode;
  panelLabel?: string;
  panelOpen?: boolean;
  defaultPanelOpen?: boolean;
  onPanelOpenChange?: (open: boolean) => void;
  /** Left of the layout toggles in the top bar. */
  header?: ReactNode;
  /** Bottom strip, e.g. branch, cursor position and sync state. */
  statusBar?: ReactNode;
  /** Remembers pane sizes in localStorage. */
  storageKey?: string;
  sidebarShortcut?: string | false;
  panelShortcut?: string | false;
  className?: string;
}

/**
 * IDE layout: a resizable sidebar beside the editor, a resizable bottom
 * panel, toggles with shortcuts (Ctrl or Cmd+B for the sidebar, Ctrl+` for
 * the panel), an optional header and status bar, and remembered sizes.
 */
export function Workbench({
  sidebar,
  sidebarLabel = "Explorer",
  sidebarOpen: sidebarProp,
  defaultSidebarOpen = true,
  onSidebarOpenChange,
  editor,
  panel,
  panelLabel = "Panel",
  panelOpen: panelProp,
  defaultPanelOpen = true,
  onPanelOpenChange,
  header,
  statusBar,
  storageKey,
  sidebarShortcut = "mod+b",
  panelShortcut = "mod+`",
  className,
}: WorkbenchProps) {
  const [sidebarOpen, setSidebarOpen] = useControllableState({ value: sidebarProp, defaultValue: defaultSidebarOpen, onChange: onSidebarOpenChange });
  const [panelOpen, setPanelOpen] = useControllableState({ value: panelProp, defaultValue: defaultPanelOpen, onChange: onPanelOpenChange });
  const apple = useApplePlatform();
  const showSidebar = Boolean(sidebar) && sidebarOpen;
  const showPanel = Boolean(panel) && panelOpen;

  useShortcuts([
    { id: "workbench-sidebar", keys: sidebarShortcut || "mod+b", description: `Toggle ${sidebarLabel.toLowerCase()}`, group: "Layout", allowInInputs: true, enabled: Boolean(sidebar) && sidebarShortcut !== false, handler: (event) => {
        event.preventDefault();
        setSidebarOpen(!sidebarOpen);
      } },
    { id: "workbench-panel", keys: panelShortcut || "mod+`", description: `Toggle ${panelLabel.toLowerCase()}`, group: "Layout", allowInInputs: true, enabled: Boolean(panel) && panelShortcut !== false, handler: (event) => {
        event.preventDefault();
        setPanelOpen(!panelOpen);
      } },
  ]);

  const hint = (keys: string | false) => (keys ? ` (${formatShortcut(keys, apple)})` : "");

  const main = showPanel ? (
    <ResizablePanels
      orientation="vertical"
      {...(storageKey ? { storageKey: `${storageKey}:rows` } : {})}
      panels={[
        { id: "editor", label: "editor", minSize: 20, children: <div className="flex h-full min-h-0 flex-col">{editor}</div> },
        {
          id: "panel",
          defaultSize: 30,
          minSize: 10,
          children: (
            <section aria-label={panelLabel} className="flex h-full min-h-0 flex-col border-t border-border">
              {panel}
            </section>
          ),
        },
      ]}
      className="h-full"
    />
  ) : (
    <div className="flex h-full min-h-0 flex-col">{editor}</div>
  );

  return (
    <div data-slot="workbench" className={cn("flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-background", className)}>
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border px-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">{header}</div>
        {sidebar && (
          <button type="button" aria-pressed={sidebarOpen} aria-label={`Show ${sidebarLabel.toLowerCase()}`} title={`Toggle ${sidebarLabel.toLowerCase()}${hint(sidebarShortcut)}`} onClick={() => setSidebarOpen(!sidebarOpen)} className={cn(iconButton, "size-7 aria-pressed:text-foreground", focusRing)}>
            <PanelLeftIcon aria-hidden="true" />
          </button>
        )}
        {panel && (
          <button type="button" aria-pressed={panelOpen} aria-label={`Show ${panelLabel.toLowerCase()}`} title={`Toggle ${panelLabel.toLowerCase()}${hint(panelShortcut)}`} onClick={() => setPanelOpen(!panelOpen)} className={cn(iconButton, "size-7 aria-pressed:text-foreground", focusRing)}>
            <PanelBottomIcon aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1">
        {showSidebar ? (
          <ResizablePanels
            {...(storageKey ? { storageKey: `${storageKey}:columns` } : {})}
            panels={[
              {
                id: "sidebar",
                label: sidebarLabel.toLowerCase(),
                defaultSize: 24,
                minSize: 12,
                maxSize: 50,
                collapsible: true,
                children: (
                  <aside aria-label={sidebarLabel} className="flex h-full min-h-0 flex-col overflow-hidden border-r border-border bg-muted/20">
                    {sidebar}
                  </aside>
                ),
              },
              { id: "main", minSize: 30, children: main },
            ]}
            className="h-full"
          />
        ) : (
          main
        )}
      </div>
      {statusBar && <div className="flex h-6 shrink-0 items-center gap-3 border-t border-border bg-muted/40 px-2 text-xs text-muted-foreground">{statusBar}</div>}
    </div>
  );
}
