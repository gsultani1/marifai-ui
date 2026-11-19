// packages/ai-ui/src/components/browser-session-restore.tsx
"use client";

import { useState } from "react";
import { AsyncForm, ControlPanel } from "../lib/component-controls.js";
import { TreeView, type TreeNode } from "./tree-view.js";

export interface BrowserRestoreWindow {
  id: string;
  title: string;
  tabs: readonly { id: string; title: string }[];
}

export interface BrowserSessionRestoreProps {
  windows: readonly BrowserRestoreWindow[];
  onRestore: (selection: readonly { windowId: string; tabIds: readonly string[] }[]) => void | Promise<void>;
  className?: string;
}

export function BrowserSessionRestore({ windows, onRestore, className }: BrowserSessionRestoreProps) {
  const [checked, setChecked] = useState<string[]>([]);
  const nodes: TreeNode[] = windows.map((window) => ({
    id: JSON.stringify([window.id]), label: window.title, disabled: !window.tabs.length,
    children: window.tabs.map((tab) => ({ id: JSON.stringify([window.id, tab.id]), label: tab.title })),
  }));
  const selection = windows.map((window) => ({
    windowId: window.id,
    tabIds: window.tabs.filter((tab) => checked.includes(JSON.stringify([window.id, tab.id]))).map((tab) => tab.id),
  })).filter((window) => window.tabIds.length);
  return <ControlPanel slot="browser-session-restore" title="Restore browser session" className={className}>
    <AsyncForm label="Restore browser session" submitLabel="Restore selected tabs" disabled={!selection.length} onSubmit={() => onRestore(selection)}>
      <TreeView label="Windows and tabs" nodes={nodes} selectionMode="none" checkboxes checked={checked} onCheckedChange={setChecked} emptyLabel="No windows to restore." />
    </AsyncForm>
  </ControlPanel>;
}
