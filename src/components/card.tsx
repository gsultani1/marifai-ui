// packages/ai-ui/src/components/card.tsx
import type { ComponentProps } from "react";

import { card } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export type CardProps = ComponentProps<"div">;

/** Bordered surface that groups related content; compose it from the Card parts. */
export function Card({ className, ...props }: CardProps) {
  return <div data-slot="card" className={cn(card, "flex flex-col gap-4 py-4 shadow-xs", className)} {...props} />;
}

export type CardHeaderProps = ComponentProps<"div">;

/** Title, description and an optional CardAction aligned to the top right. */
export function CardHeader({ className, ...props }: CardHeaderProps) {
  return (
    <div
      data-slot="card-header"
      className={cn("grid auto-rows-min grid-rows-[auto_auto] items-start gap-1 px-4 has-data-[slot=card-action]:grid-cols-[1fr_auto]", className)}
      {...props}
    />
  );
}

export interface CardTitleProps extends ComponentProps<"h3"> {
  /** Heading level that fits the page outline. */
  as?: "h2" | "h3" | "h4" | "h5" | "h6";
}

export function CardTitle({ as: Heading = "h3", className, ...props }: CardTitleProps) {
  return <Heading data-slot="card-title" className={cn("text-base leading-snug font-semibold", className)} {...props} />;
}

export type CardDescriptionProps = ComponentProps<"p">;

export function CardDescription({ className, ...props }: CardDescriptionProps) {
  return <p data-slot="card-description" className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export type CardActionProps = ComponentProps<"div">;

/** Button or menu placed in the header's top-right corner. */
export function CardAction({ className, ...props }: CardActionProps) {
  return <div data-slot="card-action" className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)} {...props} />;
}

export type CardContentProps = ComponentProps<"div">;

export function CardContent({ className, ...props }: CardContentProps) {
  return <div data-slot="card-content" className={cn("px-4 text-sm", className)} {...props} />;
}

export type CardFooterProps = ComponentProps<"div">;

/** Bottom row of actions or metadata; it stays at the bottom when the card is stretched. */
export function CardFooter({ className, ...props }: CardFooterProps) {
  return <div data-slot="card-footer" className={cn("mt-auto flex items-center gap-2 px-4", className)} {...props} />;
}
