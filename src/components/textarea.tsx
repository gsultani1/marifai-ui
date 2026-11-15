// packages/ai-ui/src/components/textarea.tsx
"use client";

import { Field } from "@base-ui/react/field";
import { type ComponentProps, useCallback, useEffect, useRef } from "react";

import { useAutosizeTextarea } from "../hooks/use-autosize-textarea.js";
import { useControllableState } from "../hooks/use-controllable-state.js";
import { focusRing, input } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { InputCounter } from "./input-counter.js";

export interface TextareaProps extends Omit<ComponentProps<"textarea">, "value" | "defaultValue" | "children"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Grows with the text between `minRows` and `maxRows`, then scrolls. */
  autosize?: boolean;
  /** Visible rows when empty; also the starting height without `autosize`. */
  minRows?: number;
  /** Rows before an autosized textarea starts scrolling. */
  maxRows?: number;
  /** Shows a "120 / 500" counter under the field; requires `maxLength`. */
  showCount?: boolean;
  /** Lets typing pass `maxLength`: the counter turns red and the field is marked invalid instead of blocking input. */
  softLimit?: boolean;
  /** Class for the wrapper that holds the textarea and counter. */
  containerClassName?: string;
}

/**
 * Multi-line text field that joins a surrounding FormField (Base UI Field) for
 * its label, description, error and validation, with optional autosize and a
 * character counter that announces itself near the limit.
 */
export function Textarea({
  value,
  defaultValue = "",
  onValueChange,
  autosize = false,
  minRows = 3,
  maxRows = 10,
  showCount = false,
  softLimit = false,
  maxLength,
  rows,
  id,
  name,
  disabled,
  ref,
  className,
  containerClassName,
  "aria-invalid": ariaInvalid,
  ...props
}: TextareaProps) {
  const [text, setText] = useControllableState<string>({ value, defaultValue, onChange: onValueChange });
  const elementRef = useRef<HTMLTextAreaElement | null>(null);
  const inactiveRef = useRef<HTMLTextAreaElement | null>(null);
  useAutosizeTextarea(autosize ? elementRef : inactiveRef, text, { minRows, maxRows });

  useEffect(() => {
    const element = elementRef.current;
    if (autosize || !element) return;
    element.style.removeProperty("height");
    element.style.removeProperty("overflow-y");
  }, [autosize]);

  const setRef = useCallback(
    (node: HTMLElement | null) => {
      const element = node instanceof HTMLTextAreaElement ? node : null;
      elementRef.current = element;
      if (typeof ref === "function") ref(element);
      else if (ref) ref.current = element;
    },
    [ref],
  );

  const over = maxLength !== undefined && text.length > maxLength;
  const counter = showCount && maxLength !== undefined;
  const control = (
    <Field.Control
      ref={setRef}
      id={id}
      name={name}
      disabled={disabled}
      value={text}
      onValueChange={(next) => setText(next)}
      data-slot="textarea"
      className={cn(input, focusRing, "h-auto min-h-16 py-2 leading-6 focus-visible:ring-offset-0", autosize ? "resize-none" : "resize-y", className)}
      render={<textarea {...props} rows={rows ?? minRows} maxLength={softLimit ? undefined : maxLength} aria-invalid={over || ariaInvalid || undefined} />}
    />
  );

  if (!counter) return control;
  return (
    <div data-slot="textarea-group" className={cn("flex min-w-0 flex-col gap-1", containerClassName)}>
      {control}
      <InputCounter value={text} max={maxLength} className="self-end" />
    </div>
  );
}
