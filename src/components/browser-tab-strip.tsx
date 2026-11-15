// packages/ai-ui/src/components/browser-tab-strip.tsx
"use client";

import { type ReactNode } from "react";
import { cn } from "../lib/cn.js";
import { WorkspaceTabs } from "./workspace-tabs.js";

export interface BrowserTab {
  id: string;
  title: string;
  address?: string;
  pinned?: boolean;
  icon?: ReactNode;
}

export interface BrowserTabStripProps {
  tabs: readonly BrowserTab[];
  activeId: string | null;
  onActiveChange: (id: string) => void;
  onClose?: (ids: string[]) => void;
  onReorder?: (ids: string[]) => void;
  onPinChange?: (id: string, pinned: boolean) => void;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function BrowserTabStrip({ tabs, className, ...props }: BrowserTabStripProps) {
  return <div data-slot="browser-tab-strip" className={cn("min-w-0", className)}>
    <WorkspaceTabs {...props} tabs={tabs.map((tab) => ({ ...tab, ...(tab.address ? { path: tab.address } : {}) }))} label="Browser tabs" />
  </div>;
}
