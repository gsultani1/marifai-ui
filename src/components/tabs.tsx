// packages/ai-ui/src/components/tabs.tsx
"use client";

import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { createContext, type ReactNode, use, useState } from "react";

import { focusRing, tabList, tabTrigger } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export type TabsVariant = "pill" | "underline";

const TabsVariantContext = createContext<TabsVariant>("pill");

export interface TabsProps extends Omit<BaseTabs.Root.Props, "className"> {
  /** "pill" is a compact segmented bar; "underline" is a full-width row with a moving underline. */
  variant?: TabsVariant;
  className?: string;
}

/**
 * Tabs on Base UI Tabs with an animated indicator that slides to the active
 * tab. Arrow keys move between tabs (Left/Right, or Up/Down when vertical),
 * Home and End jump to the ends, and Enter or Space activates.
 */
export function Tabs({ variant = "pill", orientation = "horizontal", className, ...props }: TabsProps) {
  return (
    <TabsVariantContext value={variant}>
      <BaseTabs.Root data-slot="tabs" data-variant={variant} orientation={orientation} className={cn("flex min-w-0 gap-3", orientation === "vertical" ? "flex-row gap-4" : "flex-col", className)} {...props} />
    </TabsVariantContext>
  );
}

export interface TabsListProps extends Omit<BaseTabs.List.Props, "className"> {
  className?: string;
}

/** The row (or column) of tabs and its sliding indicator. */
export function TabsList({ className, children, ...props }: TabsListProps) {
  const variant = use(TabsVariantContext);
  return (
    <BaseTabs.List
      data-slot="tabs-list"
      className={cn(
        "relative isolate",
        variant === "pill"
          ? cn(tabList, "data-[orientation=vertical]:flex-col")
          : "flex gap-4 data-[orientation=horizontal]:border-b data-[orientation=horizontal]:border-border data-[orientation=vertical]:flex-col data-[orientation=vertical]:gap-1 data-[orientation=vertical]:border-l data-[orientation=vertical]:border-border",
        className,
      )}
      {...props}
    >
      {children}
      <BaseTabs.Indicator
        data-slot="tabs-indicator"
        className={cn(
          "absolute top-0 left-0 -z-10 transition-[translate,width,height] duration-200 ease-out motion-reduce:transition-none",
          variant === "pill"
            ? "h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) translate-y-(--active-tab-top) rounded-md bg-background shadow-sm"
            : "bg-primary data-[orientation=horizontal]:top-auto data-[orientation=horizontal]:-bottom-px data-[orientation=horizontal]:h-0.5 data-[orientation=horizontal]:w-(--active-tab-width) data-[orientation=horizontal]:translate-x-(--active-tab-left) data-[orientation=vertical]:-left-px data-[orientation=vertical]:h-(--active-tab-height) data-[orientation=vertical]:w-0.5 data-[orientation=vertical]:translate-y-(--active-tab-top)",
        )}
      />
    </BaseTabs.List>
  );
}

export interface TabsTriggerProps extends Omit<BaseTabs.Tab.Props, "className"> {
  className?: string;
}

/** One tab; pass the same `value` as its TabsContent. */
export function TabsTrigger({ className, ...props }: TabsTriggerProps) {
  const variant = use(TabsVariantContext);
  return (
    <BaseTabs.Tab
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 data-[active]:text-foreground [&_svg]:size-3.5 [&_svg]:shrink-0",
        variant === "pill" ? tabTrigger : "h-9 px-1 text-sm font-medium text-muted-foreground data-[orientation=vertical]:justify-start data-[orientation=vertical]:px-3",
        focusRing,
        className,
      )}
      {...props}
    />
  );
}

export interface TabsContentProps extends Omit<BaseTabs.Panel.Props, "className" | "keepMounted"> {
  /**
   * `false` (default) mounts the panel only while active; `true` keeps it
   * mounted from the start; "visited" mounts it on first activation and then
   * keeps it, so form input and scroll position survive switching tabs.
   */
  keepMounted?: boolean | "visited";
  className?: string;
}

function VisitedGate({ hidden, children }: { hidden: boolean; children: ReactNode }) {
  const [visited, setVisited] = useState(!hidden);
  if (!hidden && !visited) setVisited(true);
  return visited || !hidden ? children : null;
}

/** The panel for one tab. */
export function TabsContent({ keepMounted = false, className, children, ...props }: TabsContentProps) {
  return (
    <BaseTabs.Panel
      data-slot="tabs-content"
      keepMounted={keepMounted !== false}
      className={cn("min-w-0 flex-1 rounded-md", focusRing, className)}
      render={keepMounted === "visited" ? (panelProps, state) => <div {...panelProps}><VisitedGate hidden={state.hidden}>{children}</VisitedGate></div> : undefined}
      {...props}
    >
      {children}
    </BaseTabs.Panel>
  );
}
