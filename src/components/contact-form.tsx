// packages/ai-ui/src/components/contact-form.tsx
"use client";

import { Select } from "@base-ui/react/select";
import { CheckIcon, ChevronsUpDownIcon, LoaderCircleIcon } from "lucide-react";
import { type ComponentProps, type FormEvent, type ReactNode, useRef, useState } from "react";

import { useSubmitStatus } from "../hooks/use-submit-status.js";
import { button, buttonVariants, focusRing, input, popupSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { usePortalContainer } from "../lib/portal.js";
import { FormField, TextInput } from "./form-field.js";
import { SubmitStatusMessage } from "./site-section.js";

export interface ContactValues {
  name: string;
  email: string;
  phone: string;
  topic: string;
  message: string;
}

export type ContactField = keyof ContactValues;

export type ContactErrors = Partial<Record<ContactField, string>>;

export interface ValidateContactOptions {
  /** Allowed topic values; when there are any, a topic is required. */
  topics?: readonly string[];
  requirePhone?: boolean;
  nameMaxLength?: number;
  messageMinLength?: number;
  messageMaxLength?: number;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;
const PHONE_PATTERN = /^\+?[\d\s().-]+$/;
const FIELD_ORDER: ContactField[] = ["name", "email", "phone", "topic", "message"];

/** True for a plausible address such as name@example.com: one @, no spaces, and a dotted domain. */
export function isValidEmail(value: string): boolean {
  const email = value.trim();
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}

/** Characters as a person counts them, so an emoji counts once. */
export function characterCount(value: string): number {
  return Array.from(value).length;
}

const formatCount = (value: number) => new Intl.NumberFormat("en-US").format(value);

/**
 * Checks contact form values and returns a message per invalid field (empty
 * when everything is valid). Name, email and message are required; the phone
 * is optional unless `requirePhone`, and must hold 7 to 15 digits when given.
 */
export function validateContact(values: ContactValues, { topics = [], requirePhone = false, nameMaxLength = 100, messageMinLength = 10, messageMaxLength = 1000 }: ValidateContactOptions = {}): ContactErrors {
  const errors: ContactErrors = {};
  const name = values.name.trim();
  if (!name) errors.name = "Enter your name.";
  else if (characterCount(name) > nameMaxLength) errors.name = `Keep your name to ${formatCount(nameMaxLength)} characters or fewer.`;

  const email = values.email.trim();
  if (!email) errors.email = "Enter your email address.";
  else if (!isValidEmail(email)) errors.email = "Enter an email address like name@example.com.";

  const phone = values.phone.trim();
  const digits = phone.replace(/\D/g, "").length;
  if (!phone) {
    if (requirePhone) errors.phone = "Enter your phone number.";
  } else if (!PHONE_PATTERN.test(phone) || digits < 7 || digits > 15) errors.phone = "Enter a phone number with 7 to 15 digits.";

  if (topics.length > 0 && !topics.includes(values.topic)) errors.topic = "Choose a topic.";

  const message = values.message.trim();
  if (!message) errors.message = "Enter a message.";
  else if (characterCount(message) < messageMinLength) errors.message = `Add a little more detail: at least ${formatCount(messageMinLength)} characters.`;
  else if (characterCount(values.message) > messageMaxLength) errors.message = `Shorten your message to ${formatCount(messageMaxLength)} characters or fewer.`;

  return errors;
}

export interface ContactTopic {
  value: string;
  label: string;
}

const EMPTY_VALUES: ContactValues = { name: "", email: "", phone: "", topic: "", message: "" };

export interface ContactFormProps extends Omit<ComponentProps<"form">, "onSubmit" | "children" | "defaultValue"> {
  /** Receives trimmed values. A returned promise shows the pending state; a rejection shows the error message. */
  onSubmit: (values: ContactValues) => Promise<void> | void;
  /** Options for the topic select; the select is hidden when empty. */
  topics?: ContactTopic[];
  phone?: "optional" | "required" | "hidden";
  defaultValues?: Partial<ContactValues>;
  messageMinLength?: number;
  messageMaxLength?: number;
  labels?: Partial<Record<ContactField, string>>;
  topicPlaceholder?: string;
  submitLabel?: string;
  pendingLabel?: string;
  successMessage?: ReactNode;
  /** Shown when `onSubmit` rejects; a function receives the error. */
  errorMessage?: ReactNode | ((error: unknown) => ReactNode);
  /** Name of the hidden field that only bots fill in. */
  honeypotName?: string;
  /** Called instead of `onSubmit` when the hidden field was filled in; the visitor still sees the success message. */
  onSpam?: (values: ContactValues) => void;
}

/**
 * Contact form with name, email, optional phone, a topic select and a
 * message with a character limit. Fields validate on blur and on submit
 * with errors linked to their fields, focus moves to the first problem, a
 * hidden honeypot silently drops bot submissions, and the async `onSubmit`
 * gets pending, success and error states announced politely. The form
 * resets after a successful send and ignores double submits.
 */
export function ContactForm({
  onSubmit,
  topics = [],
  phone = "optional",
  defaultValues,
  messageMinLength = 10,
  messageMaxLength = 1000,
  labels = {},
  topicPlaceholder = "Choose a topic",
  submitLabel = "Send message",
  pendingLabel = "Sending…",
  successMessage = "Thanks, your message has been sent. We will get back to you soon.",
  errorMessage = "Your message could not be sent. Check your connection and try again.",
  honeypotName = "website",
  onSpam,
  className,
  ...props
}: ContactFormProps) {
  const blank = (): ContactValues => ({ ...EMPTY_VALUES, ...defaultValues });
  const [values, setValues] = useState<ContactValues>(blank);
  const [touched, setTouched] = useState<Partial<Record<ContactField, boolean>>>({});
  const [topicOpen, setTopicOpen] = useState(false);
  const { status, error, submit, succeed, reset } = useSubmitStatus(onSubmit);
  const honeypot = useRef<HTMLInputElement>(null);
  const container = usePortalContainer();
  const pending = status === "pending";
  const errors = validateContact(phone === "hidden" ? { ...values, phone: "" } : values, {
    topics: topics.map((topic) => topic.value),
    requirePhone: phone === "required",
    messageMinLength,
    messageMaxLength,
  });
  const shownError = (field: ContactField) => (touched[field] ? errors[field] : undefined);
  const touch = (field: ContactField) => setTouched((current) => (current[field] ? current : { ...current, [field]: true }));
  const update = (field: ContactField) => (next: string) => {
    setValues((current) => ({ ...current, [field]: next }));
    if (status === "success" || status === "error") reset();
  };
  const remaining = messageMaxLength - characterCount(values.message);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const trimmed: ContactValues = { name: values.name.trim(), email: values.email.trim(), phone: phone === "hidden" ? "" : values.phone.trim(), topic: values.topic, message: values.message.trim() };
    if (honeypot.current?.value) {
      onSpam?.(trimmed);
      setValues(blank());
      setTouched({});
      succeed();
      return;
    }
    setTouched({ name: true, email: true, phone: true, topic: true, message: true });
    const firstInvalid = FIELD_ORDER.find((field) => errors[field]);
    if (firstInvalid) {
      event.currentTarget.querySelector<HTMLElement>(`[data-field="${firstInvalid}"]`)?.focus();
      return;
    }
    if (await submit(trimmed)) {
      setValues(blank());
      setTouched({});
    }
  };

  return (
    <form data-slot="contact-form" noValidate aria-busy={pending || undefined} onSubmit={handleSubmit} className={cn("relative flex w-full flex-col gap-5", className)} {...props}>
      <div aria-hidden="true" className="absolute top-0 -left-[10000px] size-px overflow-hidden">
        <label>
          Leave this field empty
          <input ref={honeypot} type="text" name={honeypotName} tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <fieldset disabled={pending} className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label={labels.name ?? "Name"} required error={shownError("name")}>
            <TextInput data-field="name" name="name" autoComplete="name" aria-required="true" value={values.name} onValueChange={update("name")} onBlur={() => touch("name")} className="h-10" />
          </FormField>
          <FormField label={labels.email ?? "Email"} required error={shownError("email")}>
            <TextInput data-field="email" name="email" type="email" inputMode="email" autoComplete="email" aria-required="true" value={values.email} onValueChange={update("email")} onBlur={() => touch("email")} className="h-10" />
          </FormField>
          {phone !== "hidden" && (
            <FormField label={labels.phone ?? "Phone"} required={phone === "required"} optional={phone === "optional"} error={shownError("phone")}>
              <TextInput data-field="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" aria-required={phone === "required" || undefined} value={values.phone} onValueChange={update("phone")} onBlur={() => touch("phone")} className="h-10" />
            </FormField>
          )}
          {topics.length > 0 && (
            <FormField label={labels.topic ?? "Topic"} required error={shownError("topic")}>
              <Select.Root
                items={topics}
                value={values.topic || null}
                onValueChange={(next) => {
                  update("topic")(next ?? "");
                  touch("topic");
                }}
                onOpenChange={setTopicOpen}
                name="topic"
              >
                <Select.Trigger
                  data-field="topic"
                  aria-required="true"
                  onBlur={() => {
                    if (!topicOpen) touch("topic");
                  }}
                  className={cn(input, focusRing, "flex h-10 cursor-default items-center justify-between gap-2 text-left focus-visible:ring-offset-0")}
                >
                  <Select.Value placeholder={topicPlaceholder} className="min-w-0 truncate data-[placeholder]:text-muted-foreground" />
                  <Select.Icon className="flex text-muted-foreground">
                    <ChevronsUpDownIcon aria-hidden="true" className="size-4" />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal container={container}>
                  <Select.Positioner sideOffset={4} alignItemWithTrigger={false} className="z-50 outline-none">
                    <Select.Popup className={cn(popupSurface, "max-h-[var(--available-height)] min-w-[var(--anchor-width)] overflow-y-auto p-1 outline-none")}>
                      <Select.List>
                        {topics.map((topic) => (
                          <Select.Item key={topic.value} value={topic.value} className="grid min-h-10 cursor-default grid-cols-[1rem_1fr] items-center gap-2 rounded-md px-2 text-sm outline-none select-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground">
                            <Select.ItemIndicator className="col-start-1 flex">
                              <CheckIcon aria-hidden="true" className="size-4" />
                            </Select.ItemIndicator>
                            <Select.ItemText className="col-start-2">{topic.label}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.List>
                    </Select.Popup>
                  </Select.Positioner>
                </Select.Portal>
              </Select.Root>
            </FormField>
          )}
        </div>
        <FormField
          label={labels.message ?? "Message"}
          required
          error={shownError("message")}
          description={<span className="tabular-nums">{remaining >= 0 ? `${formatCount(remaining)} characters left` : `${formatCount(-remaining)} characters over the limit`}</span>}
        >
          <TextInput data-field="message" name="message" aria-required="true" render={<textarea rows={5} />} value={values.message} onValueChange={update("message")} onBlur={() => touch("message")} className="h-auto min-h-32 resize-y py-2" />
        </FormField>
      </fieldset>
      <div className="flex flex-col gap-3">
        <div>
          <button type="submit" aria-disabled={pending || undefined} className={cn(button, buttonVariants.primary, "h-11 w-full px-5 text-base sm:w-auto", focusRing)}>
            {pending && <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" />}
            {pending ? pendingLabel : submitLabel}
          </button>
        </div>
        <SubmitStatusMessage status={status} pendingLabel={pendingLabel} successMessage={successMessage} errorMessage={status !== "error" ? null : typeof errorMessage === "function" ? errorMessage(error) : errorMessage} />
      </div>
    </form>
  );
}
