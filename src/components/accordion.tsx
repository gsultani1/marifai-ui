// packages/ai-ui/src/components/accordion.tsx
"use client";

import { Accordion as BaseAccordion } from "@base-ui/react/accordion";
import { ChevronDownIcon } from "lucide-react";

import { collapsibleChevron, collapsiblePanel, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export interface AccordionProps extends Omit<BaseAccordion.Root.Props<string>, "className"> {
  className?: string;
}

/**
 * Stacked sections that expand and collapse on Base UI Accordion. One open at
 * a time by default; pass `multiple` to allow several. Each header is a
 * button with `aria-expanded`, Enter or Space toggles, and panels animate
 * their height (instantly under reduced motion).
 */
export function Accordion({ className, ...props }: AccordionProps) {
  return <BaseAccordion.Root<string> data-slot="accordion" className={cn("flex w-full flex-col", className)} {...props} />;
}

export interface AccordionItemProps extends Omit<BaseAccordion.Item.Props, "className"> {
  className?: string;
}

export function AccordionItem({ className, ...props }: AccordionItemProps) {
  return <BaseAccordion.Item data-slot="accordion-item" className={cn("border-b border-border last:border-b-0", className)} {...props} />;
}

export interface AccordionTriggerProps extends Omit<BaseAccordion.Trigger.Props, "className"> {
  /** Heading level that wraps the trigger, so the sections appear in the page outline. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}

const headings = { 2: <h2 />, 3: <h3 />, 4: <h4 />, 5: <h5 />, 6: <h6 /> } as const;

/** The heading button that toggles its item, with a chevron that turns when open. */
export function AccordionTrigger({ headingLevel = 3, className, children, ...props }: AccordionTriggerProps) {
  return (
    <BaseAccordion.Header render={headings[headingLevel]} className="flex">
      <BaseAccordion.Trigger
        data-slot="accordion-trigger"
        className={cn("group flex flex-1 cursor-pointer items-center justify-between gap-3 rounded-sm py-3 text-left text-sm font-medium text-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-50", focusRing, className)}
        {...props}
      >
        {children}
        <ChevronDownIcon aria-hidden="true" className={collapsibleChevron} />
      </BaseAccordion.Trigger>
    </BaseAccordion.Header>
  );
}

export interface AccordionContentProps extends Omit<BaseAccordion.Panel.Props, "className"> {
  className?: string;
}

/** The collapsible body of an item. */
export function AccordionContent({ className, children, ...props }: AccordionContentProps) {
  return (
    <BaseAccordion.Panel data-slot="accordion-content" className={cn(collapsiblePanel, "[--collapsible-panel-height:var(--accordion-panel-height)]")} {...props}>
      <div className={cn("pb-3 text-sm text-muted-foreground", className)}>{children}</div>
    </BaseAccordion.Panel>
  );
}
