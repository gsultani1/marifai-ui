// packages/ai-ui/src/components/kbd.tsx
"use client";

import { type ComponentProps, Fragment } from "react";

import { useApplePlatform } from "../hooks/use-shortcuts.js";
import { cn } from "../lib/cn.js";
import { formatShortcut, parseShortcut } from "../lib/shortcuts.js";

/** One key of a shortcut: what is printed on the key cap and what a screen reader says. */
export interface ShortcutKey {
  label: string;
  spoken: string;
}

const SPOKEN_KEYS: Record<string, string> = {
  arrowup: "Up Arrow",
  arrowdown: "Down Arrow",
  arrowleft: "Left Arrow",
  arrowright: "Right Arrow",
  escape: "Escape",
  " ": "Space",
  "+": "Plus",
};

/**
 * Splits a shortcut such as "Mod+Shift+K" or the sequence "G I" into steps of
 * keys. "Mod" (also Ctrl, Cmd or Meta) is ⌘ on Apple platforms and Ctrl
 * elsewhere, matching `formatShortcut` and `useShortcuts`.
 */
export function shortcutKeys(shortcut: string, apple = false): ShortcutKey[][] {
  return parseShortcut(shortcut).map((step) => {
    const keys: ShortcutKey[] = [];
    if (step.mod) keys.push(apple ? { label: "⌘", spoken: "Command" } : { label: "Ctrl", spoken: "Control" });
    if (step.alt) keys.push(apple ? { label: "⌥", spoken: "Option" } : { label: "Alt", spoken: "Alt" });
    if (step.shift) keys.push(apple ? { label: "⇧", spoken: "Shift" } : { label: "Shift", spoken: "Shift" });
    const label = formatShortcut(step.key === " " ? "space" : step.key === "+" ? "plus" : step.key, apple);
    keys.push({ label, spoken: SPOKEN_KEYS[step.key] ?? label });
    return keys;
  });
}

const keyCap =
  "inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 font-sans text-[0.6875rem] leading-none font-medium text-foreground shadow-[inset_0_-1px_0_var(--border)] [&_svg]:size-3";

export type KbdProps = ComponentProps<"kbd">;

/** A single key cap, such as Esc or an icon. */
export function Kbd({ className, ...props }: KbdProps) {
  return <kbd data-slot="kbd" className={cn(keyCap, className)} {...props} />;
}

export interface KbdGroupProps extends ComponentProps<"kbd"> {
  /**
   * Shortcut to render as key caps, such as "Mod+K", "Shift+?" or the
   * sequence "G I". Mod shows ⌘ on Apple platforms after mount and Ctrl during
   * server rendering and elsewhere. Without it, children are rendered as-is.
   */
  keys?: string;
}

/**
 * A key combination as separate key caps with a spoken equivalent for screen
 * readers ("Command K"), or any Kbd children grouped together.
 */
export function KbdGroup({ keys, className, children, ...props }: KbdGroupProps) {
  const apple = useApplePlatform();
  const steps = keys ? shortcutKeys(keys, apple) : [];
  return (
    <kbd data-slot="kbd-group" className={cn("inline-flex items-center gap-1 font-sans", className)} {...props}>
      {keys ? (
        <>
          <span aria-hidden="true" className="inline-flex items-center gap-1">
            {steps.map((step, stepIndex) => (
              <Fragment key={stepIndex}>
                {stepIndex > 0 && <span className="text-xs text-muted-foreground">then</span>}
                {step.map((key, keyIndex) => (
                  <Fragment key={keyIndex}>
                    {keyIndex > 0 && !apple && <span className="text-xs text-muted-foreground">+</span>}
                    <kbd className={keyCap}>{key.label}</kbd>
                  </Fragment>
                ))}
              </Fragment>
            ))}
          </span>
          <span className="sr-only">{steps.map((step) => step.map((key) => key.spoken).join(" ")).join(", then ")}</span>
        </>
      ) : (
        children
      )}
    </kbd>
  );
}
