// packages/ai-ui/src/components/breadcrumbs.tsx
"use client";

import { ChevronRightIcon } from "lucide-react";
import { Fragment, type ReactElement, type ReactNode, useState } from "react";

import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export interface LinkRenderProps {
  href: string;
  className?: string;
  children: ReactNode;
  "aria-current"?: "page";
  "aria-label"?: string;
  onClick?: () => void;
}

/** Renders a link through your router, such as React Router's Link; defaults to an anchor. */
export type RenderLink = (props: LinkRenderProps) => ReactElement;

export const defaultRenderLink: RenderLink = ({ children, ...props }) => <a {...props}>{children}</a>;

export interface BreadcrumbItem {
  label: ReactNode;
  /** Omit for the current page. */
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  /** Collapses the middle of longer trails behind a "Show full path" button. */
  maxItems?: number;
  renderLink?: RenderLink;
  label?: string;
  className?: string;
}

/** Trail of links ending at the current page (aria-current), collapsing the middle of long paths. */
export function Breadcrumbs({ items, maxItems = 4, renderLink = defaultRenderLink, label = "Breadcrumb", className }: BreadcrumbsProps) {
  const [expanded, setExpanded] = useState(false);
  const collapse = !expanded && items.length > maxItems && maxItems >= 2;
  const shown: Array<BreadcrumbItem | "collapsed"> = collapse ? [items[0]!, "collapsed", ...items.slice(items.length - (maxItems - 1))] : items;

  return (
    <nav aria-label={label} className={cn("min-w-0 text-sm", className)}>
      <ol className="flex min-w-0 flex-wrap items-center gap-1 text-muted-foreground">
        {shown.map((item, index) => {
          const last = index === shown.length - 1;
          return (
            <Fragment key={index}>
              <li className={cn("flex min-w-0 items-center", last && "text-foreground")}>
                {item === "collapsed" ? (
                  <button type="button" aria-label="Show full path" onClick={() => setExpanded(true)} className={cn("rounded px-1 hover:bg-accent hover:text-accent-foreground", focusRing)}>
                    …
                  </button>
                ) : item.href && !last ? (
                  renderLink({ href: item.href, className: cn("truncate rounded px-1 hover:text-foreground hover:underline", focusRing), children: item.label })
                ) : (
                  <span aria-current={last ? "page" : undefined} className="truncate px-1 font-medium">
                    {item.label}
                  </span>
                )}
              </li>
              {!last && (
                <li aria-hidden="true" className="flex items-center">
                  <ChevronRightIcon className="size-3.5" />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
