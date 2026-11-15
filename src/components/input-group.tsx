// packages/ai-ui/src/components/input-group.tsx
"use client";

import { Input } from "@base-ui/react/input";
import { type ComponentProps, createContext, type MouseEvent, use, useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from "react";

import { button, buttonVariants } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

interface InputGroupContextValue {
  addonIds: string[];
  registerAddon: (id: string) => () => void;
}

const InputGroupContext = createContext<InputGroupContextValue | null>(null);

const groupSizes = {
  sm: "h-8 text-sm",
  md: "h-9 text-sm",
  lg: "h-10 text-base",
} as const;

export interface InputGroupProps extends ComponentProps<"div"> {
  size?: keyof typeof groupSizes;
}

/**
 * One bordered field that holds an input plus prefixes, suffixes, icons and
 * inline buttons, with a single focus ring around the whole group. Text in an
 * addon ("$", "ft") is added to the input's description so screen readers
 * hear the unit, and clicking an addon focuses the input.
 */
export function InputGroup({ size = "md", className, children, ...props }: InputGroupProps) {
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const registerAddon = useCallback((id: string) => {
    setAddonIds((current) => (current.includes(id) ? current : [...current, id]));
    return () => setAddonIds((current) => current.filter((existing) => existing !== id));
  }, []);
  const context = useMemo(() => ({ addonIds, registerAddon }), [addonIds, registerAddon]);
  return (
    <InputGroupContext value={context}>
      <div
        role="group"
        data-slot="input-group"
        className={cn(
          "flex w-full min-w-0 items-center overflow-hidden rounded-md border border-input bg-background text-foreground transition-shadow focus-within:ring-2 focus-within:ring-ring has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[[aria-invalid=true]]:border-destructive has-[[data-invalid]]:border-destructive",
          "has-[>[data-align=start]]:[&>[data-slot=input-group-control]]:pl-1.5 has-[>[data-align=end]]:[&>[data-slot=input-group-control]]:pr-1.5",
          groupSizes[size],
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </InputGroupContext>
  );
}

export interface InputGroupAddonProps extends ComponentProps<"div"> {
  /** Which side of the input the addon sits on; sets the spacing next to the input. */
  align?: "start" | "end";
}

/** Prefix or suffix text or icon, such as "$", "ft" or a search glyph. */
export function InputGroupAddon({ align = "start", id, className, onMouseDown, children, ...props }: InputGroupAddonProps) {
  const context = use(InputGroupContext);
  const generatedId = useId();
  const addonId = id ?? generatedId;
  const ref = useRef<HTMLDivElement>(null);
  const registerAddon = context?.registerAddon;

  useLayoutEffect(() => {
    if (!registerAddon || !ref.current?.textContent?.trim() || ref.current.getAttribute("aria-hidden") === "true") return;
    return registerAddon(addonId);
  }, [registerAddon, addonId, children]);

  const focusControl = (event: MouseEvent<HTMLDivElement>) => {
    onMouseDown?.(event);
    if (event.defaultPrevented || (event.target instanceof Element && event.target.closest("button, a, input, select, textarea"))) return;
    const control = event.currentTarget.parentElement?.querySelector<HTMLElement>("[data-slot=input-group-control]");
    if (!control) return;
    event.preventDefault();
    control.focus();
  };

  return (
    <div
      ref={ref}
      id={addonId}
      data-slot="input-group-addon"
      data-align={align}
      onMouseDown={focusControl}
      className={cn("flex h-full shrink-0 cursor-text items-center gap-1.5 text-muted-foreground select-none [&_svg]:size-4 [&_svg]:shrink-0", align === "start" ? "pl-3" : "pr-3", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export interface InputGroupInputProps extends Omit<Input.Props, "className"> {
  className?: string;
}

/** The text input inside an InputGroup; joins a surrounding FormField like TextInput. */
export function InputGroupInput({ className, "aria-describedby": describedBy, ...props }: InputGroupInputProps) {
  const context = use(InputGroupContext);
  const description = [describedBy, ...(context?.addonIds ?? [])].filter(Boolean).join(" ") || undefined;
  return (
    <Input
      data-slot="input-group-control"
      aria-describedby={description}
      className={cn("h-full w-full min-w-0 flex-1 bg-transparent px-3 text-inherit outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed", className)}
      {...props}
    />
  );
}

const groupButtonSizes = {
  sm: "h-6 px-1.5 text-xs",
  md: "h-7 px-2",
  icon: "size-7 px-0",
} as const;

export interface InputGroupButtonProps extends ComponentProps<"button"> {
  variant?: "ghost" | "primary" | "outline";
  /** "icon" is square; give it an `aria-label`. */
  size?: keyof typeof groupButtonSizes;
}

/** Inline action inside an InputGroup, such as clear, copy or search. Icon-only buttons need an `aria-label`. */
export function InputGroupButton({ variant = "ghost", size = "md", type = "button", className, ...props }: InputGroupButtonProps) {
  return (
    <button
      type={type}
      data-slot="input-group-button"
      className={cn(button, buttonVariants[variant], groupButtonSizes[size], "mx-1 rounded-sm outline-none focus-visible:bg-accent focus-visible:text-accent-foreground", className)}
      {...props}
    />
  );
}
