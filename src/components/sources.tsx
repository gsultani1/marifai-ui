// packages/ai-ui/src/components/sources.tsx
"use client";

import { Collapsible } from "@base-ui/react/collapsible";
import { PreviewCard } from "@base-ui/react/preview-card";
import { BookOpenIcon, ChevronDownIcon, GlobeIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { collapsibleChevron, collapsiblePanel, focusRing, popupSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { displayHost } from "../lib/format.js";
import { usePortalContainer } from "../lib/portal.js";
import { safeUrl } from "../lib/safe-url.js";
import type { WithClassName } from "../lib/types.js";

export interface SourceItem {
  url: string;
  title?: string | undefined;
  description?: string | undefined;
}

export function Sources({ className, ...props }: WithClassName<Collapsible.Root.Props>) {
  return <Collapsible.Root data-slot="sources" className={cn("w-full text-sm", className)} {...props} />;
}

export interface SourcesTriggerProps extends WithClassName<Collapsible.Trigger.Props> {
  count: number;
  /** Replaces the default "Used N sources" label. */
  children?: ReactNode;
}

export function SourcesTrigger({ count, className, children, ...props }: SourcesTriggerProps) {
  return (
    <Collapsible.Trigger
      data-slot="sources-trigger"
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-md py-1 text-muted-foreground transition-colors hover:text-foreground",
        focusRing,
        className,
      )}
      {...props}
    >
      <BookOpenIcon aria-hidden="true" className="size-4 shrink-0" />
      <span>{children ?? `Used ${count} ${count === 1 ? "source" : "sources"}`}</span>
      <ChevronDownIcon aria-hidden="true" className={collapsibleChevron} />
    </Collapsible.Trigger>
  );
}

export function SourcesContent({ className, children, ...props }: WithClassName<Collapsible.Panel.Props>) {
  return (
    <Collapsible.Panel data-slot="sources-content" className={collapsiblePanel} {...props}>
      <ol className={cn("mt-2 grid gap-2 sm:grid-cols-2", className)}>{children}</ol>
    </Collapsible.Panel>
  );
}

export interface SourceProps extends Omit<ComponentProps<"a">, "title"> {
  href: string;
  title?: ReactNode;
  description?: ReactNode;
  /** Citation number shown before the title. */
  index?: number;
  icon?: ReactNode;
}

const sourceCard = "flex h-full flex-col gap-1 rounded-lg border border-border bg-card p-3 text-card-foreground";

/** Links only to absolute http(s) URLs without credentials; anything else renders as unlinked text. */
export function Source({ href, title, description, index, icon, className, ...props }: SourceProps) {
  const url = safeUrl(href);
  const host = displayHost(href);
  const body = (
    <>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {index !== undefined && <span className="font-medium text-foreground">{index}.</span>}
        {icon ?? <GlobeIcon aria-hidden="true" className="size-3.5 shrink-0" />}
        <span className="truncate">{host}</span>
      </span>
      <span className="line-clamp-2 font-medium">{title ?? host}</span>
      {description && <span className="line-clamp-2 text-xs text-muted-foreground">{description}</span>}
    </>
  );
  return (
    <li data-slot="source" className="min-w-0">
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(sourceCard, "transition-colors hover:bg-accent/50", focusRing, className)}
          {...props}
        >
          {body}
          <span className="sr-only"> (opens in new tab)</span>
        </a>
      ) : (
        <div className={cn(sourceCard, className)}>
          {body}
          <span className="text-xs text-muted-foreground">Link unavailable</span>
        </div>
      )}
    </li>
  );
}

export interface InlineCitationProps extends WithClassName<Omit<PreviewCard.Trigger.Props, "children" | "href">> {
  index: number;
  source: SourceItem;
}

const citationBadge =
  "mx-0.5 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-muted px-1 align-super text-[0.625rem] leading-none font-medium text-muted-foreground no-underline";

export function InlineCitation({ index, source, className, ...props }: InlineCitationProps) {
  const container = usePortalContainer();
  const url = safeUrl(source.url);
  const host = displayHost(source.url);
  if (!url) {
    return (
      <span
        role="img"
        aria-label={`Source ${index}: ${source.title ?? host} (link unavailable)`}
        data-slot="inline-citation"
        className={cn(citationBadge, className)}
      >
        {index}
      </span>
    );
  }
  return (
    <PreviewCard.Root>
      <PreviewCard.Trigger
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Source ${index}: ${source.title ?? host} (opens in new tab)`}
        data-slot="inline-citation"
        className={cn(
          citationBadge,
          "transition-colors hover:bg-accent hover:text-accent-foreground",
          focusRing,
          className,
        )}
        {...props}
      >
        {index}
      </PreviewCard.Trigger>
      <PreviewCard.Portal container={container}>
        <PreviewCard.Positioner sideOffset={6} className="z-50">
          <PreviewCard.Popup className={cn(popupSurface, "flex w-72 flex-col gap-1 p-3 text-sm")}>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <GlobeIcon aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="truncate">{host}</span>
            </span>
            <span className="line-clamp-2 font-medium">{source.title ?? host}</span>
            {source.description && (
              <span className="line-clamp-3 text-xs text-muted-foreground">{source.description}</span>
            )}
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  );
}
