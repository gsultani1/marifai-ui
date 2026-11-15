// packages/ai-ui/src/components/site-footer.tsx
"use client";

import { ArrowUpIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useSyncExternalStore } from "react";

import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { defaultRenderLink, type RenderLink } from "./breadcrumbs.js";
import type { HeadingLevel } from "./site-section.js";

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterLinkColumn {
  title: string;
  links: FooterLink[];
}

export interface FooterSocialLink {
  /** Accessible name, such as "Riverside Hardware on Facebook". */
  label: string;
  href: string;
  /** Icon; it is hidden from screen readers in favor of `label`. */
  icon: ReactNode;
}

function subscribeNothing(): () => void {
  return () => undefined;
}

function readYear(): number {
  return new Date().getFullYear();
}

function serverYear(): null {
  return null;
}

export interface SiteFooterProps extends Omit<ComponentProps<"footer">, "children"> {
  brand?: ReactNode;
  /** A sentence or two about the business, or contact details. */
  blurb?: ReactNode;
  columns?: FooterLinkColumn[];
  social?: FooterSocialLink[];
  /** Newsletter form or other call to action, shown beside the columns. */
  newsletter?: ReactNode;
  /** Name after the copyright sign. */
  copyrightHolder?: string;
  /** Fixed copyright year; by default the visitor's current year, filled in after hydration so server and client markup match. */
  year?: number;
  /** Text after the copyright line, such as "All rights reserved." */
  legal?: ReactNode;
  legalLinks?: FooterLink[];
  /** Target of the back-to-top link; "#top" scrolls to the top of the document. False hides it. */
  backToTopHref?: string | false;
  backToTopLabel?: string;
  /** Level of the column headings. */
  headingLevel?: HeadingLevel;
  /** Accessible name of the footer navigation. */
  label?: string;
  socialLabel?: string;
  legalLabel?: string;
  renderLink?: RenderLink;
}

/**
 * Website footer: brand and blurb, link columns under headings, social links
 * with accessible names, a newsletter slot, a copyright line whose year is
 * safe for server rendering, legal links and a back-to-top link.
 */
export function SiteFooter({
  brand,
  blurb,
  columns = [],
  social = [],
  newsletter,
  copyrightHolder,
  year,
  legal,
  legalLinks = [],
  backToTopHref = "#top",
  backToTopLabel = "Back to top",
  headingLevel = 2,
  label = "Footer",
  socialLabel = "Social media",
  legalLabel = "Legal",
  renderLink = defaultRenderLink,
  className,
  ...props
}: SiteFooterProps) {
  const clientYear = useSyncExternalStore(subscribeNothing, readYear, serverYear);
  const shownYear = year ?? clientYear;
  const Heading = `h${headingLevel}` as const;
  const textLink = cn("rounded-sm text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline", focusRing);

  return (
    <footer data-slot="site-footer" className={cn("border-t border-border bg-background px-4 pt-12 pb-8 text-foreground sm:px-6 sm:pt-16 lg:px-8", className)} {...props}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <div className="grid gap-10 lg:grid-cols-12">
          {(brand || blurb || social.length > 0) && (
            <div className="flex flex-col gap-4 lg:col-span-4">
              {brand && <div className="flex items-center gap-2 font-semibold">{brand}</div>}
              {blurb && <div className="max-w-sm text-sm text-pretty text-muted-foreground">{blurb}</div>}
              {social.length > 0 && (
                <ul aria-label={socialLabel} className="flex flex-wrap gap-1">
                  {social.map((link) => (
                    <li key={link.href}>
                      {renderLink({
                        href: link.href,
                        "aria-label": link.label,
                        className: cn("inline-flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground [&_svg]:size-5", focusRing),
                        children: <span aria-hidden="true" className="flex">{link.icon}</span>,
                      })}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {columns.length > 0 && (
            <nav aria-label={label} className={cn("grid grid-cols-2 gap-8 sm:grid-cols-3", newsletter ? "lg:col-span-5" : "lg:col-span-8", columns.length >= 4 && "sm:grid-cols-4")}>
              {columns.map((column) => (
                <div key={column.title} className="flex min-w-0 flex-col gap-3">
                  <Heading className="text-sm font-semibold text-foreground">{column.title}</Heading>
                  <ul className="flex flex-col gap-2">
                    {column.links.map((link) => (
                      <li key={`${link.href}-${link.label}`}>{renderLink({ href: link.href, className: cn(textLink, "inline-flex min-h-6 items-center"), children: link.label })}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          )}
          {newsletter && <div className={cn("flex min-w-0 flex-col gap-3", columns.length > 0 ? "lg:col-span-3" : "lg:col-span-8")}>{newsletter}</div>}
        </div>
        <div className="flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            <span>&copy;</span>
            {shownYear !== null && <span> {shownYear}</span>}
            {copyrightHolder && <span> {copyrightHolder}</span>}
            {legal && <span> {legal}</span>}
          </p>
          {(legalLinks.length > 0 || backToTopHref !== false) && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {legalLinks.length > 0 && (
                <ul aria-label={legalLabel} className="flex flex-wrap gap-x-6 gap-y-2">
                  {legalLinks.map((link) => (
                    <li key={`${link.href}-${link.label}`}>{renderLink({ href: link.href, className: textLink, children: link.label })}</li>
                  ))}
                </ul>
              )}
              {backToTopHref !== false && (
                <a href={backToTopHref} className={cn(textLink, "inline-flex items-center gap-1 [&_svg]:size-4")}>
                  {backToTopLabel}
                  <ArrowUpIcon aria-hidden="true" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
