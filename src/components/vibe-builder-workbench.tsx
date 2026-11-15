// packages/ai-ui/src/components/vibe-builder-workbench.tsx
"use client";

import type { ReactNode } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { cn } from "../lib/cn.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs.js";

export type VibeBuilderView = "design" | "code" | "preview" | "review";

export interface VibeBuilderWorkbenchProps {
  title: string;
  assistant: ReactNode;
  design: ReactNode;
  code?: ReactNode;
  preview?: ReactNode;
  review?: ReactNode;
  toolbar?: ReactNode;
  view?: VibeBuilderView;
  defaultView?: VibeBuilderView;
  onViewChange?: (view: VibeBuilderView) => void;
  className?: string;
}

export function VibeBuilderWorkbench({
  title, assistant, design, code, preview, review, toolbar, view, defaultView = "design", onViewChange, className,
}: VibeBuilderWorkbenchProps) {
  const [active, select] = useControllableState({ value: view, defaultValue: defaultView, onChange: onViewChange });
  const panels = ([
    { id: "design", label: "Design", content: design },
    { id: "code", label: "Code", content: code },
    { id: "preview", label: "Preview", content: preview },
    { id: "review", label: "Review", content: review },
  ] as const).filter(({ id, content }) => id === "design" || content != null);
  const current = panels.some(({ id }) => id === active) ? active : "design";

  return (
    <section aria-label={title} data-slot="vibe-builder-workbench"
      className={cn("@container min-w-0 overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-sm", className)}>
      <Tabs value={current} onValueChange={(next) => {
        const panel = panels.find(({ id }) => id === next);
        if (panel) select(panel.id);
      }} className="min-w-0">
        <header className="grid min-w-0 items-center gap-x-5 gap-y-2 border-b border-border px-3 py-2.5 @min-[54rem]:grid-cols-[1fr_auto_1fr] @min-[54rem]:px-4">
          <h2 className="min-w-0 break-words text-[0.9375rem] font-semibold tracking-tight">{title}</h2>
          <TabsList aria-label="Builder views" className="max-w-full flex-wrap justify-self-start">
            {panels.map(({ id, label }) => (
              <TabsTrigger key={id} value={id} className="gap-1.5">
                {id === "review" && <span aria-hidden="true" className="size-1.5 rounded-full bg-teal-600 dark:bg-teal-400" />}
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          {toolbar && <div className="min-w-0 @min-[54rem]:justify-self-end">{toolbar}</div>}
        </header>
        <div className="grid min-w-0 @min-[54rem]:grid-cols-[minmax(16rem,18.5rem)_minmax(0,1fr)]">
          <aside aria-label="Build assistant" className="min-w-0 border-b border-border bg-muted/25 @min-[54rem]:border-r @min-[54rem]:border-b-0">
            {assistant}
          </aside>
          <div className="@container min-w-0">
            {panels.map(({ id, content }) => (
              <TabsContent key={id} value={id} keepMounted={id === "design" || id === "code" ? "visited" : false}
                className={id === "design" ? "m-0 min-w-0" : "m-0 min-w-0 p-3 sm:p-4"}>
                {content}
              </TabsContent>
            ))}
          </div>
        </div>
      </Tabs>
    </section>
  );
}
