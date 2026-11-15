// packages/ai-ui/src/components/tour.tsx
"use client";

import { Popover } from "@base-ui/react/popover";
import { XIcon } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useSyncExternalStore } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { button, buttonVariants, focusRing, iconButton, popupSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { usePortalContainer } from "../lib/portal.js";

export interface TourStep {
  id: string;
  /** CSS selector or a function returning the element to point at; omit for a centered step. */
  target?: string | (() => Element | null);
  title: string;
  content: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}

export interface TourProps {
  steps: TourStep[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step?: number;
  defaultStep?: number;
  onStepChange?: (index: number) => void;
  /** Called when the last step is completed (not when skipped). */
  onFinish?: () => void;
}

function resolveTarget(step: TourStep | undefined): Element | null {
  if (!step?.target || typeof document === "undefined") return null;
  return typeof step.target === "function" ? step.target() : document.querySelector(step.target);
}

const PADDING = 6;

/** Stand-in anchor near the top third of the viewport for steps without a target. */
const centerAnchor = { getBoundingClientRect: () => new DOMRect(window.innerWidth / 2, window.innerHeight * 0.3, 0, 0) };

/**
 * Guided tour: dims the page around each step's target, anchors a popover to
 * it (scrolling it into view), and steps with Back, Next and Done. Escape or
 * Skip ends the tour; targets that are missing fall back to a centered card.
 */
export function Tour({ steps, open, onOpenChange, step, defaultStep = 0, onStepChange, onFinish }: TourProps) {
  const [index, setIndex] = useControllableState<number>({ value: step, defaultValue: defaultStep, onChange: onStepChange });
  const container = usePortalContainer();
  const nextRef = useRef<HTMLButtonElement>(null);
  const current = steps[Math.min(index, steps.length - 1)];
  const last = index >= steps.length - 1;

  const subscribe = useCallback(
    (notify: () => void) => {
      if (!open) return () => undefined;
      window.addEventListener("resize", notify);
      window.addEventListener("scroll", notify, true);
      const observer = typeof MutationObserver === "undefined" ? null : new MutationObserver(notify);
      observer?.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });
      return () => {
        window.removeEventListener("resize", notify);
        window.removeEventListener("scroll", notify, true);
        observer?.disconnect();
      };
    },
    [open],
  );
  const rectKey = useSyncExternalStore(
    subscribe,
    () => {
      const rect = open ? resolveTarget(current)?.getBoundingClientRect() : undefined;
      return rect && rect.width + rect.height > 0 ? `${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.width)},${Math.round(rect.height)}` : "";
    },
    () => "",
  );
  const rect = rectKey ? rectKey.split(",").map(Number) : null;

  useEffect(() => {
    if (!open) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    resolveTarget(current)?.scrollIntoView({ block: "center", inline: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [open, current]);

  if (!open || !current) return null;

  const finish = () => {
    onOpenChange(false);
    onFinish?.();
  };

  return (
    <>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50">
        {rect ? (
          <div className="absolute rounded-md ring-2 ring-ring transition-all duration-200 motion-reduce:transition-none" style={{ left: rect[0]! - PADDING, top: rect[1]! - PADDING, width: rect[2]! + PADDING * 2, height: rect[3]! + PADDING * 2, boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.45)" }} />
        ) : (
          <div className="absolute inset-0 bg-black/45" />
        )}
      </div>
      <Popover.Root
        open
        onOpenChange={(next, details) => {
          if (!next && (details.reason === "escape-key" || details.reason === "close-press")) onOpenChange(false);
        }}
      >
        <Popover.Portal container={container}>
          <Popover.Positioner anchor={() => resolveTarget(current) ?? centerAnchor} side={rect ? (current.side ?? "bottom") : "bottom"} sideOffset={rect ? PADDING + 8 : 0} collisionPadding={12} className="z-50">
            <Popover.Popup initialFocus={nextRef} className={cn(popupSurface, "flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-3 p-4 outline-none")}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">
                    Step {index + 1} of {steps.length}
                  </span>
                  <Popover.Title className="text-sm font-semibold">{current.title}</Popover.Title>
                </div>
                <Popover.Close aria-label="Skip tour" className={cn(iconButton, "-mt-1 -mr-1", focusRing)}>
                  <XIcon aria-hidden="true" />
                </Popover.Close>
              </div>
              <div className="text-sm text-muted-foreground">{current.content}</div>
              <div className="flex items-center justify-between gap-2">
                <div aria-hidden="true" className="flex gap-1">
                  {steps.map((item, position) => (
                    <span key={item.id} className={cn("size-1.5 rounded-full", position === index ? "bg-foreground" : "bg-muted-foreground/40")} />
                  ))}
                </div>
                <div className="flex gap-2">
                  {index > 0 && (
                    <button type="button" onClick={() => setIndex(index - 1)} className={cn(button, buttonVariants.ghost, "h-7 px-2.5 text-xs", focusRing)}>
                      Back
                    </button>
                  )}
                  <button ref={nextRef} type="button" onClick={() => (last ? finish() : setIndex(index + 1))} className={cn(button, buttonVariants.primary, "h-7 px-2.5 text-xs", focusRing)}>
                    {last ? "Done" : "Next"}
                  </button>
                </div>
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}
