// packages/ai-ui/src/components/form-field.tsx
"use client";

import { Field } from "@base-ui/react/field";
import { Input } from "@base-ui/react/input";
import type { ReactNode } from "react";

import { focusRing, input } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export interface FormFieldProps extends Omit<Field.Root.Props, "children" | "className" | "render"> {
  label: ReactNode;
  description?: ReactNode;
  /** Error from outside the field, such as a server response; marks the field invalid while set. */
  error?: ReactNode;
  /** Shows a required marker; put `required` on the control for validation. */
  required?: boolean;
  /** Shows "(optional)" after the label. */
  optional?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Label, control, description and error wired together by Base UI Field, so
 * any Base UI control inside (TextInput, NumberInput, OTPInput, TagInput,
 * PasswordField) gets the label, description and invalid state without ids.
 * `validate` runs on `validationMode` (submit by default; "onBlur" re-checks
 * on change after the first error, so messages clear as soon as they are fixed).
 */
export function FormField({ label, description, error, required = false, optional = false, invalid, className, children, ...props }: FormFieldProps) {
  return (
    <Field.Root invalid={invalid ?? (error ? true : undefined)} className={cn("flex min-w-0 flex-col gap-1.5", className)} {...props}>
      <Field.Label className="text-sm font-medium text-foreground">
        {label}
        {required && (
          <span aria-hidden="true" className="text-destructive">
            {" "}
            *
          </span>
        )}
        {optional && <span className="font-normal text-muted-foreground"> (optional)</span>}
      </Field.Label>
      {children}
      {description && <Field.Description className="text-xs text-muted-foreground">{description}</Field.Description>}
      {error ? (
        <Field.Error match className="text-xs font-medium text-destructive">
          {error}
        </Field.Error>
      ) : (
        <Field.Error className="text-xs font-medium text-destructive" />
      )}
    </Field.Root>
  );
}

export interface TextInputProps extends Omit<Input.Props, "className"> {
  className?: string;
}

/** Styled text input that joins the surrounding FormField. */
export function TextInput({ className, ...props }: TextInputProps) {
  return <Input className={cn(input, focusRing, "focus-visible:ring-offset-0", className)} {...props} />;
}
