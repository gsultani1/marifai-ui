// packages/ai-ui/src/components/site-section.tsx
"use client";

import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useId } from "react";

import type { SubmitStatus } from "../hooks/use-submit-status.js";
import { button, type ButtonVariant, buttonVariants, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { defaultRenderLink, type RenderLink } from "./breadcrumbs.js";

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/** The level for headings nested one step under `level`, capped at 6. */
export function childHeadingLevel(level: HeadingLevel): HeadingLevel {
  return Math.min(level + 1, 6) as HeadingLevel;
}

/** A call to action: a link when `href` is set (rendered through `renderLink`), otherwise a button. */
export interface SiteAction {
  label: ReactNode;
  href?: string;
  onClick?: () => void;
  /** Icon after the label, such as an arrow; mark it aria-hidden. */
  icon?: ReactNode;
  /** Accessible name when the visible label is ambiguous out of context. */
  "aria-label"?: string;
}

/** Button looks for actions: the shared variants plus two for use on a `bg-primary` band. */
export type SiteActionVariant = ButtonVariant | "inverse" | "inverseOutline";

const actionVariants: Record<SiteActionVariant, string> = {
  ...buttonVariants,
  inverse: "bg-primary-foreground text-primary hover:opacity-90",
  inverseOutline: "border border-primary-foreground/50 text-primary-foreground hover:bg-primary-foreground/10",
};

const actionSizes = {
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
} as const;

export interface SiteActionButtonProps {
  action: SiteAction;
  variant?: SiteActionVariant;
  size?: keyof typeof actionSizes;
  renderLink?: RenderLink;
  className?: string;
}

/** Renders a SiteAction as a link or button with touch-friendly sizing and a visible focus ring. */
export function SiteActionButton({ action, variant = "primary", size = "md", renderLink = defaultRenderLink, className }: SiteActionButtonProps) {
  const classes = cn(button, actionVariants[variant], actionSizes[size], focusRing, className);
  const content = (
    <>
      {action.label}
      {action.icon}
    </>
  );
  if (action.href !== undefined) {
    return renderLink({ href: action.href, className: classes, children: content, "aria-label": action["aria-label"], onClick: action.onClick });
  }
  return (
    <button type="button" aria-label={action["aria-label"]} onClick={action.onClick} className={classes}>
      {content}
    </button>
  );
}

export interface SiteSectionHeadingProps {
  /** Short line above the title, such as a category. */
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  /** Level of the section title; item headings inside use the next level. */
  headingLevel?: HeadingLevel;
  /** Alignment of the heading block. */
  align?: "start" | "center";
}

export interface SiteSectionProps extends SiteSectionHeadingProps, Omit<ComponentProps<"section">, "title"> {
  /** Content beside the heading on wide screens, such as a toggle or a "View all" link. */
  headingAside?: ReactNode;
  /** Small, muted title for quiet sections such as a logo strip. */
  size?: "md" | "sm";
  /** Class for the inner, width-limited container. */
  containerClassName?: string;
}

/**
 * Page section with an optional eyebrow, title and description, named by its
 * title for assistive technology. Content sits in a centered container that
 * keeps a comfortable gutter from 320px phones to wide desktops.
 */
export function SiteSection({ eyebrow, title, description, headingLevel = 2, align = "start", headingAside, size = "md", containerClassName, className, children, ...props }: SiteSectionProps) {
  const id = useId();
  const Heading = `h${headingLevel}` as const;
  const hasHeading = Boolean(eyebrow || title || description || headingAside);
  return (
    <section data-slot="site-section" aria-labelledby={title && !props["aria-label"] ? `${id}-title` : undefined} className={cn("px-4 py-12 sm:px-6 sm:py-16 lg:px-8", className)} {...props}>
      <div className={cn("mx-auto flex w-full max-w-6xl flex-col gap-8 sm:gap-10", containerClassName)}>
        {hasHeading && (
          <div className={cn("flex flex-col gap-4", headingAside && "md:flex-row md:items-end md:justify-between", align === "center" && !headingAside && "items-center text-center")}>
            <div className={cn("flex max-w-2xl flex-col gap-3", align === "center" && !headingAside && "items-center")}>
              {eyebrow && <p className="text-sm font-semibold text-muted-foreground">{eyebrow}</p>}
              {title && (
                <Heading id={`${id}-title`} className={cn("text-balance text-foreground", size === "sm" ? "text-sm font-medium text-muted-foreground" : "text-2xl font-semibold tracking-tight sm:text-3xl")}>
                  {title}
                </Heading>
              )}
              {description && <div className="text-pretty text-base text-muted-foreground sm:text-lg">{description}</div>}
            </div>
            {headingAside && <div className="flex shrink-0 flex-wrap items-center gap-3">{headingAside}</div>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

export interface SubmitStatusMessageProps extends Omit<ComponentProps<"div">, "children"> {
  status: SubmitStatus;
  /** Spoken while the submission is in flight. */
  pendingLabel: ReactNode;
  successMessage: ReactNode;
  errorMessage: ReactNode;
}

/**
 * Polite live region for a form's submission outcome. It stays mounted while
 * idle so screen readers announce each change of state.
 */
export function SubmitStatusMessage({ status, pendingLabel, successMessage, errorMessage, className, ...props }: SubmitStatusMessageProps) {
  const tone = status === "success" ? "border-success/40 bg-success/10" : "border-destructive/40 bg-destructive/10";
  return (
    <div role="status" data-slot="submit-status" data-status={status} className={className} {...props}>
      {status === "pending" && <span className="sr-only">{pendingLabel}</span>}
      {(status === "success" || status === "error") && (
        <p className={cn("flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm text-foreground", tone)}>
          {status === "success" ? <CircleCheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" /> : <CircleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />}
          <span>{status === "success" ? successMessage : errorMessage}</span>
        </p>
      )}
    </div>
  );
}
