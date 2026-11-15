// packages/ai-ui/src/components/hero.tsx
"use client";

import { type ComponentProps, type ReactNode, useId } from "react";

import { cn } from "../lib/cn.js";
import { defaultRenderLink, type RenderLink } from "./breadcrumbs.js";
import { type HeadingLevel, type SiteAction, SiteActionButton } from "./site-section.js";

export type HeroBackground = "none" | "muted" | "gradient" | "grid";

const backgrounds: Record<Exclude<HeroBackground, "none">, string> = {
  muted: "bg-muted/50",
  gradient: "[background-image:radial-gradient(ellipse_80%_60%_at_50%_0%,color-mix(in_oklab,var(--chart-1)_16%,transparent),transparent_70%),radial-gradient(ellipse_50%_40%_at_90%_90%,color-mix(in_oklab,var(--chart-3)_10%,transparent),transparent_70%)]",
  grid: "[background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:2.5rem_2.5rem] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,black,transparent)]",
};

export interface HeroProps extends Omit<ComponentProps<"section">, "title"> {
  /** Short line above the title, such as "Family owned since 1979". */
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  primaryAction?: SiteAction;
  secondaryAction?: SiteAction;
  /** Image, video or illustration; give images real alt text or alt="" when decorative. */
  media?: ReactNode;
  /** Centered text with media below, or text beside media on wide screens. */
  layout?: "centered" | "split";
  /** Side of the media in the split layout on wide screens. */
  mediaPosition?: "start" | "end";
  /** Decorative backdrop drawn from theme tokens. */
  background?: HeroBackground;
  /** The page's main heading by default. */
  headingLevel?: HeadingLevel;
  renderLink?: RenderLink;
}

/**
 * Opening section of a page: eyebrow, title, description, primary and
 * secondary actions and a media slot, centered or split, over an optional
 * token-based background. Content below the actions goes in `children`.
 */
export function Hero({
  eyebrow,
  title,
  description,
  primaryAction,
  secondaryAction,
  media,
  layout = "centered",
  mediaPosition = "end",
  background = "none",
  headingLevel = 1,
  renderLink = defaultRenderLink,
  className,
  children,
  ...props
}: HeroProps) {
  const id = useId();
  const Heading = `h${headingLevel}` as const;
  const centered = layout === "centered";
  const split = !centered && Boolean(media);

  return (
    <section data-slot="hero" data-layout={layout} aria-labelledby={props["aria-label"] ? undefined : `${id}-title`} className={cn("relative isolate overflow-hidden px-4 py-16 sm:px-6 sm:py-24 lg:px-8", className)} {...props}>
      {background !== "none" && <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 -z-10", backgrounds[background])} />}
      <div className={cn("mx-auto grid w-full max-w-6xl gap-10 lg:gap-16", split && "lg:grid-cols-2 lg:items-center")}>
        <div className={cn("flex min-w-0 flex-col gap-6", centered && "mx-auto max-w-3xl items-center text-center", split && mediaPosition === "start" && "lg:order-last")}>
          {eyebrow && <p className="text-sm font-semibold text-muted-foreground">{eyebrow}</p>}
          <Heading id={`${id}-title`} className="text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl lg:text-6xl">
            {title}
          </Heading>
          {description && <div className="max-w-2xl text-lg text-pretty text-muted-foreground sm:text-xl">{description}</div>}
          {(primaryAction || secondaryAction) && (
            <div className={cn("flex w-full flex-col gap-3 sm:w-auto sm:flex-row", centered && "sm:justify-center")}>
              {primaryAction && <SiteActionButton action={primaryAction} size="lg" renderLink={renderLink} />}
              {secondaryAction && <SiteActionButton action={secondaryAction} variant="outline" size="lg" renderLink={renderLink} />}
            </div>
          )}
          {children}
        </div>
        {media && <div className={cn("min-w-0 overflow-hidden rounded-xl", centered && "mx-auto w-full max-w-5xl")}>{media}</div>}
      </div>
    </section>
  );
}
