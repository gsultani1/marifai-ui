// packages/ai-ui/src/components/collapsible.tsx
"use client";

import { Collapsible as BaseCollapsible } from "@base-ui/react/collapsible";
import { ChevronDownIcon } from "lucide-react";

import { collapsibleChevron, collapsiblePanel, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export interface CollapsibleProps extends Omit<BaseCollapsible.Root.Props, "className"> {
  className?: string;
}

/** A section that shows and hides one panel, on Base UI Collapsible; `open`/`defaultOpen`/`onOpenChange` control it. */
export function Collapsible({ className, ...props }: CollapsibleProps) {
  return <BaseCollapsible.Root data-slot="collapsible" className={cn("flex flex-col", className)} {...props} />;
}

export interface CollapsibleTriggerProps extends Omit<BaseCollapsible.Trigger.Props, "className"> {
  /** Shows a chevron after the label that turns when open. */
  chevron?: boolean;
  className?: string;
}

/** Button with `aria-expanded` that toggles the panel. */
export function CollapsibleTrigger({ chevron = true, className, children, ...props }: CollapsibleTriggerProps) {
  return (
    <BaseCollapsible.Trigger
      data-slot="collapsible-trigger"
      className={cn("group inline-flex cursor-pointer items-center gap-2 self-start rounded-md text-sm font-medium text-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-50", focusRing, className)}
      {...props}
    >
      {children}
      {chevron && <ChevronDownIcon aria-hidden="true" className={collapsibleChevron} />}
    </BaseCollapsible.Trigger>
  );
}

export interface CollapsibleContentProps extends Omit<BaseCollapsible.Panel.Props, "className"> {
  className?: string;
}

/** The panel; its height animates open and closed, instantly under reduced motion. */
export function CollapsibleContent({ className, children, ...props }: CollapsibleContentProps) {
  return (
    <BaseCollapsible.Panel data-slot="collapsible-content" className={collapsiblePanel} {...props}>
      <div className={cn("pt-2", className)}>{children}</div>
    </BaseCollapsible.Panel>
  );
}
