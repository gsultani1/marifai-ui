// packages/ai-ui/src/components/number-input.tsx
"use client";

import { NumberField } from "@base-ui/react/number-field";
import { MinusIcon, PlusIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/cn.js";

export interface NumberInputProps extends Omit<NumberField.Root.Props, "className" | "children" | "render" | "prefix"> {
  placeholder?: string;
  /** Text or icon before the number, such as a unit symbol. */
  startContent?: ReactNode;
  /** Text after the number, such as "kg" or "%". */
  endContent?: ReactNode;
  hideSteppers?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
  inputClassName?: string;
}

const stepper = "flex w-8 shrink-0 items-center justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-40 [&_svg]:size-3.5";

/**
 * Locale-aware number field on Base UI NumberField: parses what the user
 * types in their locale, formats on blur, clamps to min and max, steps with
 * the arrows (Shift for the large step, Alt for the small one) and selects
 * the text on focus so typing replaces it.
 */
export function NumberInput({ placeholder, startContent, endContent, hideSteppers = false, "aria-label": ariaLabel, "aria-labelledby": ariaLabelledBy, className, inputClassName, ...props }: NumberInputProps) {
  return (
    <NumberField.Root className={cn("inline-flex min-w-0 flex-col", className)} {...props}>
      <NumberField.Group className="flex h-9 items-stretch overflow-hidden rounded-md border border-input bg-background text-sm focus-within:ring-2 focus-within:ring-ring data-[disabled]:opacity-50 data-[invalid]:border-destructive">
        {!hideSteppers && (
          <NumberField.Decrement aria-label="Decrease" className={cn(stepper, "border-r border-input")}>
            <MinusIcon aria-hidden="true" />
          </NumberField.Decrement>
        )}
        {startContent && <span className="flex items-center pl-2.5 text-muted-foreground">{startContent}</span>}
        <NumberField.Input
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          onFocus={(event) => event.currentTarget.select()}
          className={cn("w-full min-w-0 flex-1 bg-transparent px-2.5 text-foreground tabular-nums outline-none placeholder:text-muted-foreground", inputClassName)}
        />
        {endContent && <span className="flex items-center pr-2.5 text-muted-foreground">{endContent}</span>}
        {!hideSteppers && (
          <NumberField.Increment aria-label="Increase" className={cn(stepper, "border-l border-input")}>
            <PlusIcon aria-hidden="true" />
          </NumberField.Increment>
        )}
      </NumberField.Group>
    </NumberField.Root>
  );
}

export interface CurrencyInputProps extends Omit<NumberInputProps, "value" | "defaultValue" | "onValueChange" | "onValueCommitted" | "format" | "smallStep"> {
  /** Amount in minor units, such as cents. */
  value?: number | null;
  defaultValue?: number | null;
  onValueChange?: (minorUnits: number | null) => void;
  onValueCommitted?: (minorUnits: number | null) => void;
  /** ISO 4217 code. */
  currency?: string;
  locale?: string;
}

/** Number of decimal places a currency uses (2 for USD, 0 for JPY, 3 for KWD). */
export function currencyFractionDigits(currency: string, locale?: string): number {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

/**
 * Money field that stores integer minor units, so 12.34 dollars round-trips
 * as 1234 with no floating-point drift, and formats with the currency's own
 * decimal places on blur.
 */
export function CurrencyInput({ value, defaultValue, onValueChange, onValueCommitted, currency = "USD", locale, hideSteppers = true, step = 1, ...props }: CurrencyInputProps) {
  const digits = currencyFractionDigits(currency, locale);
  const factor = 10 ** digits;
  const toMajor = (minor: number | null | undefined) => (minor == null ? minor : minor / factor);
  const toMinor = (major: number | null) => (major == null ? null : Math.round(major * factor));
  const controlled = value !== undefined ? { value: toMajor(value) ?? null } : defaultValue != null ? { defaultValue: defaultValue / factor } : {};
  return (
    <NumberInput
      {...props}
      {...controlled}
      locale={locale}
      step={step}
      smallStep={1 / factor}
      hideSteppers={hideSteppers}
      format={{ style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }}
      onValueChange={(major) => onValueChange?.(toMinor(major))}
      onValueCommitted={(major) => onValueCommitted?.(toMinor(major))}
    />
  );
}
