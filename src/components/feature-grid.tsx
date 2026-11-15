// packages/ai-ui/src/components/feature-grid.tsx
"use client";

import { ArrowRightIcon } from "lucide-react";
import type { ReactNode } from "react";

import { card, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { defaultRenderLink, type RenderLink } from "./breadcrumbs.js";
import { childHeadingLevel, SiteSection, type SiteSectionProps } from "./site-section.js";

export interface FeatureItem {
  /** Stable key; defaults to the index. */
  id?: string;
  /** Icon or small illustration; mark it aria-hidden. */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  href?: string;
  /** Visible link text; the feature title is added in parentheses for screen readers. */
  linkLabel?: string;
}

export interface FeatureGridProps extends Omit<SiteSectionProps, "children"> {
  items: FeatureItem[];
  /** Columns on wide screens; phones show one and small tablets two. */
  columns?: 2 | 3 | 4;
  /** Bordered cards, or plain blocks for quieter pages. */
  variant?: "card" | "plain";
  renderLink?: RenderLink;
}

const columnClasses = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
} as const;

/** Grid of features or services, each with an icon, title, description and optional "Learn more" link. */
export function FeatureGrid({ items, columns = 3, variant = "card", headingLevel = 2, renderLink = defaultRenderLink, className, ...props }: FeatureGridProps) {
  const ItemHeading = `h${childHeadingLevel(headingLevel)}` as const;
  return (
    <SiteSection data-slot="feature-grid" headingLevel={headingLevel} className={className} {...props}>
      {items.length > 0 && (
        <ul className={cn("grid gap-4 sm:gap-6", columnClasses[columns])}>
          {items.map((item, index) => (
            <li key={item.id ?? index} className={cn("flex flex-col gap-3", variant === "card" ? cn(card, "p-5 sm:p-6") : "py-1")}>
              {item.icon && (
                <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground [&_svg]:size-5">
                  {item.icon}
                </span>
              )}
              <ItemHeading className="text-base font-semibold text-foreground">{item.title}</ItemHeading>
              {item.description && <div className="text-sm text-pretty text-muted-foreground">{item.description}</div>}
              {item.href !== undefined && (
                <div className="mt-auto pt-1">
                  {renderLink({
                    href: item.href,
                    className: cn("inline-flex items-center gap-1 rounded-sm text-sm font-medium text-foreground underline-offset-4 hover:underline [&_svg]:size-4", focusRing),
                    children: (
                      <>
                        {item.linkLabel ?? "Learn more"}
                        <span className="sr-only"> ({item.title})</span>
                        <ArrowRightIcon aria-hidden="true" />
                      </>
                    ),
                  })}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </SiteSection>
  );
}
