// packages/ai-ui/src/components/cta-section.tsx
"use client";

import { type ComponentProps, type ReactNode, useId } from "react";

import { card } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { defaultRenderLink, type RenderLink } from "./breadcrumbs.js";
import { type HeadingLevel, type SiteAction, SiteActionButton } from "./site-section.js";

export interface CtaSectionProps extends Omit<ComponentProps<"section">, "title"> {
  title: ReactNode;
  description?: ReactNode;
  primaryAction?: SiteAction;
  secondaryAction?: SiteAction;
  /** A full-width band in the primary color, or a bordered card. */
  variant?: "banner" | "card";
  /** Centered text, or text beside the actions on wide screens. */
  align?: "center" | "start";
  headingLevel?: HeadingLevel;
  renderLink?: RenderLink;
}

/**
 * Closing call to action with a title, description and up to two actions,
 * as a primary-color banner or a card. Extra content, such as a phone
 * number or store hours, goes in `children`.
 */
export function CtaSection({ title, description, primaryAction, secondaryAction, variant = "banner", align = "center", headingLevel = 2, renderLink = defaultRenderLink, className, children, ...props }: CtaSectionProps) {
  const id = useId();
  const Heading = `h${headingLevel}` as const;
  const banner = variant === "banner";
  const centered = align === "center";

  return (
    <section data-slot="cta-section" data-variant={variant} aria-labelledby={props["aria-label"] ? undefined : `${id}-title`} className={cn("px-4 sm:px-6 lg:px-8", banner ? "bg-primary py-14 text-primary-foreground sm:py-20" : "py-12 sm:py-16", className)} {...props}>
      <div
        className={cn(
          "mx-auto flex w-full max-w-6xl flex-col gap-8",
          !banner && cn(card, "bg-muted/40 p-6 sm:p-10 lg:p-12"),
          centered ? "items-center text-center" : "lg:flex-row lg:items-center lg:justify-between",
        )}
      >
        <div className={cn("flex max-w-2xl flex-col gap-3", centered && "items-center")}>
          <Heading id={`${id}-title`} className={cn("text-2xl font-semibold tracking-tight text-balance sm:text-3xl", banner ? "text-primary-foreground" : "text-foreground")}>
            {title}
          </Heading>
          {description && <div className={cn("text-base text-pretty sm:text-lg", banner ? "text-primary-foreground/85" : "text-muted-foreground")}>{description}</div>}
          {children}
        </div>
        {(primaryAction || secondaryAction) && (
          <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:flex-row">
            {primaryAction && <SiteActionButton action={primaryAction} variant={banner ? "inverse" : "primary"} size="lg" renderLink={renderLink} />}
            {secondaryAction && <SiteActionButton action={secondaryAction} variant={banner ? "inverseOutline" : "outline"} size="lg" renderLink={renderLink} />}
          </div>
        )}
      </div>
    </section>
  );
}
