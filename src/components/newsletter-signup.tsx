// packages/ai-ui/src/components/newsletter-signup.tsx
"use client";

import { Checkbox } from "@base-ui/react/checkbox";
import { CheckIcon, LoaderCircleIcon } from "lucide-react";
import { type ComponentProps, type FormEvent, type ReactNode, useId, useState } from "react";

import { useSubmitStatus } from "../hooks/use-submit-status.js";
import { button, buttonVariants, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { isValidEmail } from "./contact-form.js";
import { FormField, TextInput } from "./form-field.js";
import { type HeadingLevel, SubmitStatusMessage } from "./site-section.js";

export interface NewsletterSubscription {
  email: string;
  /** Whether the consent box was checked; false when there is none. */
  consent: boolean;
}

export interface NewsletterSignupProps extends Omit<ComponentProps<"form">, "onSubmit" | "children" | "title"> {
  /** Receives the trimmed address. A returned promise shows the pending state; a rejection shows the error message. */
  onSubscribe: (email: string, details: NewsletterSubscription) => Promise<void> | void;
  title?: ReactNode;
  description?: ReactNode;
  headingLevel?: HeadingLevel;
  label?: string;
  /** Keeps the label for screen readers only, for compact footers. */
  hideLabel?: boolean;
  placeholder?: string;
  submitLabel?: string;
  pendingLabel?: string;
  /** Shows a consent checkbox with this label. */
  consentLabel?: ReactNode;
  /** Requires the consent box to be checked before subscribing. */
  consentRequired?: boolean;
  successMessage?: ReactNode;
  /** Shown when `onSubscribe` rejects; a function receives the error. */
  errorMessage?: ReactNode | ((error: unknown) => ReactNode);
  /** Field and button side by side from small screens up, or stacked. */
  layout?: "inline" | "stacked";
}

/**
 * Email signup with validation, an optional consent checkbox, and an async
 * `onSubscribe` whose pending, success and error states are announced
 * politely. Double submits are ignored and the field clears on success.
 */
export function NewsletterSignup({
  onSubscribe,
  title,
  description,
  headingLevel = 2,
  label = "Email address",
  hideLabel = false,
  placeholder = "you@example.com",
  submitLabel = "Subscribe",
  pendingLabel = "Subscribing…",
  consentLabel,
  consentRequired = true,
  successMessage = "Thanks for subscribing. Check your inbox to confirm your address.",
  errorMessage = "We could not sign you up just now. Try again in a moment.",
  layout = "inline",
  className,
  ...props
}: NewsletterSignupProps) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [touched, setTouched] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const { status, error, submit, reset } = useSubmitStatus<NewsletterSubscription>((value) => onSubscribe(value.email, value));
  const pending = status === "pending";
  const Heading = `h${headingLevel}` as const;
  const emailError = !email.trim() ? "Enter your email address." : isValidEmail(email) ? undefined : "Enter an email address like name@example.com.";
  const consentError = consentLabel !== undefined && consentRequired && !consent ? "Check the box to agree before subscribing." : undefined;
  const shownEmailError = touched || attempted ? emailError : undefined;
  const shownConsentError = attempted ? consentError : undefined;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setAttempted(true);
    if (emailError || consentError) {
      event.currentTarget.querySelector<HTMLElement>(emailError ? '[data-field="email"]' : '[data-field="consent"]')?.focus();
      return;
    }
    if (await submit({ email: email.trim(), consent })) {
      setEmail("");
      setConsent(false);
      setTouched(false);
      setAttempted(false);
    }
  };

  const edited = () => {
    if (status === "success" || status === "error") reset();
  };

  return (
    <form data-slot="newsletter-signup" noValidate aria-busy={pending || undefined} aria-labelledby={title ? `${id}-title` : undefined} onSubmit={handleSubmit} className={cn("flex w-full flex-col gap-3", className)} {...props}>
      {(title || description) && (
        <div className="flex flex-col gap-1">
          {title && (
            <Heading id={`${id}-title`} className="text-base font-semibold text-foreground">
              {title}
            </Heading>
          )}
          {description && <div className="text-sm text-pretty text-muted-foreground">{description}</div>}
        </div>
      )}
      <FormField label={label} error={shownEmailError} className={cn(hideLabel && "[&>label]:sr-only")}>
        <div className={cn("flex flex-col gap-2", layout === "inline" && "sm:flex-row")}>
          <TextInput
            data-field="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            aria-required="true"
            readOnly={pending}
            placeholder={placeholder}
            value={email}
            onValueChange={(next: string) => {
              setEmail(next);
              edited();
            }}
            onBlur={() => {
              if (email.trim()) setTouched(true);
            }}
            className="h-10 min-w-0 flex-1"
          />
          <button type="submit" aria-disabled={pending || undefined} className={cn(button, buttonVariants.primary, "h-10 px-4", focusRing)}>
            {pending && <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" />}
            {pending ? pendingLabel : submitLabel}
          </button>
        </div>
      </FormField>
      {consentLabel !== undefined && (
        <div className="flex flex-col gap-1">
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-muted-foreground">
            <Checkbox.Root
              data-field="consent"
              checked={consent}
              readOnly={pending}
              onCheckedChange={(checked) => {
                setConsent(checked);
                edited();
              }}
              aria-required={consentRequired || undefined}
              aria-invalid={shownConsentError ? true : undefined}
              aria-describedby={shownConsentError ? `${id}-consent-error` : undefined}
              className={cn(
                "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input bg-background text-primary-foreground transition-colors data-[checked]:border-primary data-[checked]:bg-primary aria-invalid:border-destructive",
                focusRing,
              )}
            >
              <Checkbox.Indicator className="flex">
                <CheckIcon aria-hidden="true" className="size-3" />
              </Checkbox.Indicator>
            </Checkbox.Root>
            <span>{consentLabel}</span>
          </label>
          {shownConsentError && (
            <p id={`${id}-consent-error`} className="text-xs font-medium text-destructive">
              {shownConsentError}
            </p>
          )}
        </div>
      )}
      <SubmitStatusMessage status={status} pendingLabel={pendingLabel} successMessage={successMessage} errorMessage={status !== "error" ? null : typeof errorMessage === "function" ? errorMessage(error) : errorMessage} />
    </form>
  );
}
