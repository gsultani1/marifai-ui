// packages/ai-ui/src/components/prompt-input.tsx
"use client";

import { ArrowUpIcon, LoaderCircleIcon, PaperclipIcon, SquareIcon } from "lucide-react";
import {
  type ComponentProps,
  createContext,
  type DragEvent,
  type ReactNode,
  type RefObject,
  use,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { useAutosizeTextarea } from "../hooks/use-autosize-textarea.js";
import { useControllableState } from "../hooks/use-controllable-state.js";
import { useStoredDraft, writeDraft } from "../hooks/use-draft-store.js";
import { focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { InputCounter, type InputCounterProps } from "./input-counter.js";

/** Matches the `status` values of the Vercel AI SDK `useChat` hook. */
export type ChatStatus = "ready" | "submitted" | "streaming" | "error";

/** "desktop" sends on Enter except on touch screens without a keyboard, where Enter adds a line. Ctrl or Cmd+Enter always sends. */
export type SubmitOnEnter = "desktop" | "always" | "never";

interface PromptInputContextValue {
  value: string;
  setValue: (value: string) => void;
  status: ChatStatus;
  disabled: boolean;
  busy: boolean;
  /** True while the promise returned by `onSubmit` is unsettled. */
  pending: boolean;
  /** Id of the error message while the last submit failed, for `aria-describedby`. */
  errorId: string | undefined;
  canSubmit: boolean;
  submit: () => void;
  stop: (() => void) | undefined;
  attach: ((files: File[]) => void) | undefined;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  maxLength: number | undefined;
  submitOnEnter: SubmitOnEnter;
  flushDraft: () => void;
}

const PromptInputContext = createContext<PromptInputContextValue | null>(null);

export function usePromptInput(): PromptInputContextValue {
  const context = use(PromptInputContext);
  if (!context) throw new Error("PromptInput parts must be rendered inside <PromptInput>.");
  return context;
}

export interface PromptInputProps extends Omit<ComponentProps<"form">, "onSubmit" | "defaultValue"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /**
   * Uncontrolled inputs clear after this returns, or after the returned
   * promise resolves. A throw or rejection keeps the draft and shows
   * `errorMessage`; a second submit is ignored while the promise is pending.
   */
  onSubmit: (text: string) => void | Promise<void>;
  onSubmitError?: (error: unknown) => void;
  /** Shown after a failed submit. Pass `false` to render your own. */
  errorMessage?: ReactNode;
  /** Shows a stop button while `status` is "submitted" or "streaming". */
  onStop?: () => void;
  /** Enables the attach button, paste and drop of files. */
  onAttach?: (files: File[]) => void;
  status?: ChatStatus;
  disabled?: boolean;
  /** Allows submitting without text, e.g. when attachments are present. */
  allowEmpty?: boolean;
  /** Keeps the unsent text in localStorage under this key (one per conversation) and restores it on return. Uncontrolled inputs only. */
  draftKey?: string;
  /** Blocks sending past this many characters; show the count with PromptInputCounter. */
  maxLength?: number;
  submitOnEnter?: SubmitOnEnter;
}

export function PromptInput({
  value: valueProp,
  defaultValue = "",
  onValueChange,
  onSubmit,
  onSubmitError,
  errorMessage = "Unable to send. Your draft has been kept.",
  onStop,
  onAttach,
  status = "ready",
  disabled = false,
  allowEmpty = false,
  draftKey,
  maxLength,
  submitOnEnter = "desktop",
  className,
  children,
  ...props
}: PromptInputProps) {
  const [value, setValue, controlled] = useControllableState({
    value: valueProp,
    defaultValue,
    onChange: onValueChange,
  });
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [touched, setTouched] = useState(false);
  const storedDraft = useStoredDraft(controlled ? undefined : draftKey);
  const current = controlled || touched || storedDraft === null ? value : storedDraft;
  const pendingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const latestValue = useRef(current);
  const touchedRef = useRef(touched);
  const onSubmitErrorRef = useRef(onSubmitError);
  const errorId = useId();
  const busy = status === "submitted" || status === "streaming";
  const tooLong = maxLength !== undefined && current.length > maxLength;
  const canSubmit = !disabled && !busy && !pending && !tooLong && (allowEmpty || current.trim() !== "");

  useEffect(() => {
    latestValue.current = current;
    touchedRef.current = touched;
    onSubmitErrorRef.current = onSubmitError;
  }, [current, touched, onSubmitError]);

  useEffect(() => {
    if (!draftKey || controlled || !touched) return;
    const timer = setTimeout(() => writeDraft(draftKey, current), 250);
    return () => clearTimeout(timer);
  }, [draftKey, controlled, touched, current]);

  const flushDraft = useCallback(() => {
    if (draftKey && !controlled && touchedRef.current) writeDraft(draftKey, latestValue.current);
  }, [draftKey, controlled]);

  useEffect(() => {
    window.addEventListener("pagehide", flushDraft);
    return () => window.removeEventListener("pagehide", flushDraft);
  }, [flushDraft]);

  const updateValue = useCallback(
    (next: string) => {
      setFailed(false);
      setTouched(true);
      setValue(next);
    },
    [setValue],
  );

  const clearSent = useCallback(() => {
    setTouched(true);
    setValue("");
  }, [setValue]);

  const submit = useCallback(() => {
    if (!canSubmit || pendingRef.current) return;
    const text = current;
    const fail = (error: unknown) => {
      setFailed(true);
      onSubmitErrorRef.current?.(error);
    };
    setFailed(false);
    let result: void | Promise<void>;
    try {
      result = onSubmit(text);
    } catch (error) {
      fail(error);
      textareaRef.current?.focus();
      return;
    }
    textareaRef.current?.focus();
    if (!(result instanceof Promise)) {
      if (!controlled) clearSent();
      return;
    }
    pendingRef.current = true;
    setPending(true);
    result
      .then(() => {
        if (!controlled && latestValue.current === text) clearSent();
      }, fail)
      .finally(() => {
        pendingRef.current = false;
        setPending(false);
      });
  }, [canSubmit, controlled, onSubmit, clearSent, current]);

  const showError = failed && errorMessage !== false;
  const context = useMemo<PromptInputContextValue>(
    () => ({
      value: current,
      setValue: updateValue,
      status,
      disabled,
      busy,
      pending,
      errorId: showError ? errorId : undefined,
      canSubmit,
      submit,
      stop: onStop,
      attach: disabled ? undefined : onAttach,
      textareaRef,
      maxLength,
      submitOnEnter,
      flushDraft,
    }),
    [current, updateValue, status, disabled, busy, pending, showError, errorId, canSubmit, submit, onStop, onAttach, maxLength, submitOnEnter, flushDraft],
  );

  const acceptsFiles = (event: DragEvent) => Boolean(context.attach) && event.dataTransfer.types.includes("Files");

  return (
    <PromptInputContext value={context}>
      <form
        data-slot="prompt-input"
        data-status={status}
        data-pending={pending || undefined}
        data-dragging={dragging || undefined}
        className={cn(
          "flex w-full flex-col rounded-2xl border border-input bg-background shadow-xs transition-shadow focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30 data-[dragging]:border-ring data-[dragging]:ring-3 data-[dragging]:ring-ring/30",
          className,
        )}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        onDragOver={(event) => {
          if (!acceptsFiles(event)) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(event) => {
          setDragging(false);
          if (!acceptsFiles(event)) return;
          event.preventDefault();
          const files = Array.from(event.dataTransfer.files);
          if (files.length > 0) context.attach?.(files);
        }}
        {...props}
      >
        {children}
        {showError && (
          <p id={errorId} role="alert" data-slot="prompt-input-error" className="px-4 pb-2.5 text-sm text-destructive">
            {errorMessage}
          </p>
        )}
      </form>
    </PromptInputContext>
  );
}

export interface PromptInputTextareaProps extends Omit<ComponentProps<"textarea">, "value" | "defaultValue"> {
  minRows?: number;
  maxRows?: number;
}

export function PromptInputTextarea({
  minRows = 1,
  maxRows = 8,
  ref,
  onChange,
  onKeyDown,
  onPaste,
  onBlur,
  "aria-describedby": describedBy,
  className,
  ...props
}: PromptInputTextareaProps) {
  const { value, setValue, submit, attach, disabled, errorId, textareaRef, submitOnEnter, flushDraft } = usePromptInput();
  useAutosizeTextarea(textareaRef, value, { minRows, maxRows });

  const setRef = useCallback(
    (element: HTMLTextAreaElement | null) => {
      textareaRef.current = element;
      if (typeof ref === "function") ref(element);
      else if (ref) ref.current = element;
    },
    [ref, textareaRef],
  );

  return (
    <textarea
      ref={setRef}
      name="message"
      rows={minRows}
      aria-label="Message"
      placeholder="Send a message"
      value={value}
      disabled={disabled}
      aria-describedby={[describedBy, errorId].filter(Boolean).join(" ") || undefined}
      data-slot="prompt-input-textarea"
      className={cn(
        "w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-base leading-6 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm",
        className,
      )}
      onChange={(event) => {
        onChange?.(event);
        setValue(event.target.value);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || event.key !== "Enter" || event.shiftKey) return;
        if (event.nativeEvent.isComposing || event.keyCode === 229) return;
        const forced = event.metaKey || event.ctrlKey;
        if (!forced && (submitOnEnter === "never" || (submitOnEnter === "desktop" && isTouchOnly()))) return;
        event.preventDefault();
        submit();
      }}
      onBlur={(event) => {
        onBlur?.(event);
        flushDraft();
      }}
      onPaste={(event) => {
        onPaste?.(event);
        if (event.defaultPrevented || !attach) return;
        const files = Array.from(event.clipboardData.files);
        if (files.length === 0) return;
        event.preventDefault();
        attach(files);
      }}
      {...props}
    />
  );
}

/** Touch screen with no hover-capable pointer, where Enter should add a line rather than send. */
function isTouchOnly(): boolean {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.("(hover: none) and (pointer: coarse)").matches);
}

/** Character count against PromptInput's `maxLength`; renders nothing without one. */
export function PromptInputCounter(props: Omit<InputCounterProps, "value" | "max">) {
  const { value, maxLength } = usePromptInput();
  if (maxLength === undefined) return null;
  return <InputCounter value={value} max={maxLength} {...props} />;
}

export function PromptInputFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="prompt-input-footer"
      className={cn("flex items-center justify-between gap-2 px-2 pb-2", className)}
      {...props}
    />
  );
}

export function PromptInputTools({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="prompt-input-tools" className={cn("flex min-w-0 items-center gap-1", className)} {...props} />;
}

export interface PromptInputButtonProps extends ComponentProps<"button"> {
  /** Accessible name for icon-only buttons. */
  label?: string;
}

export function PromptInputButton({ label, className, ...props }: PromptInputButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(iconButton, "rounded-full", focusRing, className)}
      {...props}
    />
  );
}

export interface PromptInputAttachButtonProps extends Omit<PromptInputButtonProps, "onClick"> {
  accept?: string;
  multiple?: boolean;
}

export function PromptInputAttachButton({
  accept,
  multiple = true,
  label = "Attach files",
  children,
  disabled,
  ...props
}: PromptInputAttachButtonProps) {
  const { attach } = usePromptInput();
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        tabIndex={-1}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length > 0) attach?.(files);
        }}
      />
      <PromptInputButton
        label={label}
        disabled={disabled || !attach}
        onClick={() => inputRef.current?.click()}
        {...props}
      >
        {children ?? <PaperclipIcon aria-hidden="true" />}
      </PromptInputButton>
    </>
  );
}

export function PromptInputSubmit({ className, children, ...props }: ComponentProps<"button">) {
  const { busy, pending, canSubmit, stop, textareaRef } = usePromptInput();
  const base = cn(
    "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4",
    focusRing,
    className,
  );

  if (busy && stop) {
    return (
      <button
        type="button"
        aria-label="Stop generating"
        onClick={() => {
          stop();
          textareaRef.current?.focus();
        }}
        className={base}
        {...props}
      >
        {children ?? <SquareIcon aria-hidden="true" className="fill-current" />}
      </button>
    );
  }
  if (busy || pending) {
    return (
      <button
        type="button"
        aria-label={busy ? "Generating response" : "Sending message"}
        aria-disabled="true"
        className={base}
        {...props}
      >
        {children ?? <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" />}
      </button>
    );
  }
  return (
    <button
      type="submit"
      aria-label="Send message"
      disabled={!canSubmit}
      className={base}
      {...props}
    >
      {children ?? <ArrowUpIcon aria-hidden="true" />}
    </button>
  );
}
