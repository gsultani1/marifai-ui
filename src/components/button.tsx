// packages/ai-ui/src/components/button.tsx
"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import { LoaderCircleIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { button, buttonVariants, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import type { WithClassName } from "../lib/types.js";

export type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "destructive" | "link";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  default: buttonVariants.primary,
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  outline: buttonVariants.outline,
  ghost: buttonVariants.ghost,
  destructive: buttonVariants.destructive,
  link: "h-auto px-0 text-foreground underline-offset-4 hover:underline",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-7 gap-1 px-2.5 text-xs [&_svg]:size-3.5",
  md: "",
  lg: "h-10 px-4",
  icon: "size-8 px-0",
};

export interface ButtonClassOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

/**
 * Button classes for elements that must stay links or other tags, such as a
 * router link styled as a button (Base UI Button is for button semantics only).
 */
export function buttonClasses({ variant = "default", size = "md", className }: ButtonClassOptions = {}): string {
  return cn(button, VARIANT_CLASSES[variant], variant === "link" ? "" : SIZE_CLASSES[size], focusRing, className);
}

export interface ButtonProps extends WithClassName<BaseButton.Props> {
  variant?: ButtonVariant;
  /** "icon" is a square button; give it an `aria-label`. */
  size?: ButtonSize;
  /**
   * Shows a spinner, sets aria-busy and ignores clicks while keeping focus on
   * the button, so keyboard users do not lose their place.
   */
  loading?: boolean;
}

/**
 * Button on Base UI Button with six variants and four sizes. `render` swaps
 * the element (for example a menu or dialog trigger); keep links as anchors
 * styled with `buttonClasses`.
 */
export function Button({ variant = "default", size = "md", loading = false, disabled, focusableWhenDisabled, className, children, ...props }: ButtonProps) {
  return (
    <BaseButton
      data-slot="button"
      data-variant={variant}
      data-size={size}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      focusableWhenDisabled={loading || focusableWhenDisabled}
      className={cn(buttonClasses({ variant, size }), loading && "cursor-progress", className)}
      {...props}
    >
      {loading && <LoaderCircleIcon aria-hidden="true" data-slot="button-spinner" className="motion-safe:animate-spin motion-reduce:animate-pulse" />}
      {loading && size === "icon" ? null : children}
    </BaseButton>
  );
}

export interface ButtonGroupProps extends ComponentProps<"div"> {
  orientation?: "horizontal" | "vertical";
}

/**
 * Buttons joined into one control with shared borders, horizontal or
 * stacked. It is a group; give it an `aria-label` when the buttons alone do
 * not explain what they act on.
 */
export function ButtonGroup({ orientation = "horizontal", className, ...props }: ButtonGroupProps) {
  return (
    <div
      role="group"
      data-slot="button-group"
      data-orientation={orientation}
      className={cn(
        "isolate inline-flex w-fit [&>*]:relative [&>*:focus-visible]:z-10",
        orientation === "horizontal"
          ? "flex-row [&>*:not(:first-child)]:-ml-px [&>*:not(:first-child)]:rounded-l-none [&>*:not(:last-child)]:rounded-r-none"
          : "flex-col [&>*:not(:first-child)]:-mt-px [&>*:not(:first-child)]:rounded-t-none [&>*:not(:last-child)]:rounded-b-none",
        className,
      )}
      {...props}
    />
  );
}
