// packages/ai-ui/src/components/tooltip.tsx
"use client";

import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import type { ReactElement, ReactNode } from "react";

import { tooltipPopup } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { usePortalContainer } from "../lib/portal.js";

export interface TooltipProviderProps {
  /** Hover delay in milliseconds before the first tooltip opens. */
  delay?: number;
  closeDelay?: number;
  /** Window after one tooltip closes during which the next opens instantly. */
  timeout?: number;
  children?: ReactNode;
}

/** Shares delays across tooltips so moving between triggers opens the next tooltip instantly. */
export function TooltipProvider({ delay = 500, closeDelay, timeout, children }: TooltipProviderProps) {
  return (
    <BaseTooltip.Provider delay={delay} closeDelay={closeDelay} timeout={timeout}>
      {children}
    </BaseTooltip.Provider>
  );
}

export interface TooltipProps {
  /** Text or small content shown on hover and keyboard focus. */
  content: ReactNode;
  /**
   * One focusable element, such as a Button. Tooltips are visual only, so give
   * an icon-only trigger an `aria-label` matching the tooltip text.
   */
  children: ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  /** Hover delay in milliseconds; inherits from TooltipProvider when omitted. */
  delay?: number;
  closeDelay?: number;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Turns the tooltip off while keeping the trigger. */
  disabled?: boolean;
  className?: string;
}

/**
 * Short label on hover and keyboard focus, built on Base UI Tooltip. Escape
 * closes it, and it stays open while the pointer moves onto it.
 */
export function Tooltip({ content, children, side = "top", align = "center", sideOffset = 6, delay, closeDelay, open, defaultOpen, onOpenChange, disabled, className }: TooltipProps) {
  const container = usePortalContainer();
  return (
    <BaseTooltip.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange ? (next) => onOpenChange(next) : undefined} disabled={disabled}>
      <BaseTooltip.Trigger delay={delay} closeDelay={closeDelay} render={children} />
      <BaseTooltip.Portal container={container}>
        <BaseTooltip.Positioner side={side} align={align} sideOffset={sideOffset} collisionPadding={8} className="z-50">
          <BaseTooltip.Popup data-slot="tooltip" className={cn(tooltipPopup, "max-w-xs", className)}>
            {content}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
