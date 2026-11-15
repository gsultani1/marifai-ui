// packages/ai-ui/src/components/tool-call.tsx
"use client";

import { Collapsible } from "@base-ui/react/collapsible";
import {
  ChevronDownIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleXIcon,
  LoaderCircleIcon,
  ShieldAlertIcon,
  ShieldXIcon,
  WrenchIcon,
} from "lucide-react";
import {
  type ComponentProps,
  createContext,
  isValidElement,
  type ReactNode,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { collapsibleChevron, collapsiblePanel, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import type { WithClassName } from "../lib/types.js";
import { CodeBlock } from "./code-block.js";

/**
 * Lifecycle of a tool invocation. Vercel AI SDK tool part states map as
 * input-streaming to "pending", input-available to "running",
 * approval-requested to "awaiting-approval", output-available to
 * "completed", output-error to "error" and output-denied to "denied".
 */
export type ToolCallStatus = "pending" | "running" | "awaiting-approval" | "completed" | "error" | "denied";

const STATUS: Record<ToolCallStatus, { label: string; icon: ReactNode; className: string }> = {
  pending: {
    label: "Pending",
    icon: <CircleDashedIcon aria-hidden="true" />,
    className: "text-muted-foreground",
  },
  running: {
    label: "Running",
    icon: <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" />,
    className: "text-muted-foreground",
  },
  "awaiting-approval": {
    label: "Awaiting approval",
    icon: <ShieldAlertIcon aria-hidden="true" />,
    className: "text-warning",
  },
  completed: {
    label: "Completed",
    icon: <CircleCheckIcon aria-hidden="true" />,
    className: "text-success",
  },
  error: {
    label: "Error",
    icon: <CircleXIcon aria-hidden="true" />,
    className: "text-destructive",
  },
  denied: {
    label: "Denied",
    icon: <ShieldXIcon aria-hidden="true" />,
    className: "text-muted-foreground",
  },
};

interface ToolCallContextValue {
  name: string;
  status: ToolCallStatus;
}

const ToolCallContext = createContext<ToolCallContextValue | null>(null);

function useToolCall(): ToolCallContextValue {
  const context = use(ToolCallContext);
  if (!context) throw new Error("ToolCall parts must be rendered inside <ToolCall>.");
  return context;
}

export interface ToolCallProps
  extends WithClassName<Omit<Collapsible.Root.Props, "open" | "defaultOpen" | "onOpenChange">> {
  name: string;
  status: ToolCallStatus;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Opens whenever `status` becomes "awaiting-approval" so the approval
 * controls are visible; pass `defaultOpen={false}` to opt out.
 */
export function ToolCall({
  name,
  status,
  open: openProp,
  defaultOpen,
  onOpenChange,
  className,
  ...props
}: ToolCallProps) {
  const [open, setOpen] = useControllableState({
    value: openProp,
    defaultValue: defaultOpen ?? status === "awaiting-approval",
    onChange: onOpenChange,
  });
  const context = useMemo(() => ({ name, status }), [name, status]);

  useEffect(() => {
    if (status === "awaiting-approval" && defaultOpen !== false) setOpen(true);
  }, [status, defaultOpen, setOpen]);

  return (
    <ToolCallContext value={context}>
      <Collapsible.Root
        data-slot="tool-call"
        data-status={status}
        open={open}
        onOpenChange={(next) => setOpen(next)}
        className={cn("w-full rounded-lg border border-border bg-card text-sm text-card-foreground", className)}
        {...props}
      />
    </ToolCallContext>
  );
}

function focusTrigger(root: Element | null): void {
  root?.querySelector<HTMLElement>('[data-slot="tool-call-trigger"]')?.focus();
}

export interface ToolCallStatusBadgeProps extends ComponentProps<"span"> {
  status: ToolCallStatus;
}

export function ToolCallStatusBadge({ status, className, ...props }: ToolCallStatusBadgeProps) {
  const { label, icon, className: tone } = STATUS[status];
  return (
    <span
      data-slot="tool-call-status"
      className={cn("inline-flex shrink-0 items-center gap-1 text-xs font-medium [&_svg]:size-3.5", tone, className)}
      {...props}
    >
      {icon}
      {label}
    </span>
  );
}

export interface ToolCallTriggerProps extends WithClassName<Collapsible.Trigger.Props> {
  /** Replaces the tool name, e.g. a human-readable action title. */
  children?: ReactNode;
}

export function ToolCallTrigger({ className, children, ...props }: ToolCallTriggerProps) {
  const { name, status } = useToolCall();
  return (
    <Collapsible.Trigger
      data-slot="tool-call-trigger"
      className={cn(
        "group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-accent/50",
        focusRing,
        className,
      )}
      {...props}
    >
      <WrenchIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate font-mono text-[0.8125rem]">{children ?? name}</span>
      <ToolCallStatusBadge status={status} />
      <ChevronDownIcon aria-hidden="true" className={collapsibleChevron} />
    </Collapsible.Trigger>
  );
}

export function ToolCallContent({ className, children, ...props }: WithClassName<Collapsible.Panel.Props>) {
  return (
    <Collapsible.Panel data-slot="tool-call-content" className={collapsiblePanel} {...props}>
      <div className={cn("flex flex-col gap-3 border-t border-border p-3", className)}>{children}</div>
    </Collapsible.Panel>
  );
}

function jsonReplacer(): (key: string, value: unknown) => unknown {
  const ancestors: object[] = [];
  return function replace(this: unknown, _key: string, value: unknown) {
    if (typeof value === "bigint") return `${value}n`;
    if (typeof value !== "object" || value === null) return value;
    while (ancestors.length > 0 && ancestors.at(-1) !== this) ancestors.pop();
    if (ancestors.includes(value)) return "[Circular]";
    ancestors.push(value);
    return value;
  };
}

function formatValue(value: unknown): { code: string; language: string | undefined } {
  if (typeof value === "string") return { code: value, language: undefined };
  try {
    const json = JSON.stringify(value, jsonReplacer(), 2);
    return json === undefined ? { code: String(value), language: undefined } : { code: json, language: "json" };
  } catch {
    return { code: String(value), language: undefined };
  }
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{children}</div>;
}

export interface ToolCallInputProps extends Omit<ComponentProps<"div">, "children"> {
  input: unknown;
  label?: ReactNode;
}

export function ToolCallInput({ input, label = "Input", className, ...props }: ToolCallInputProps) {
  const { code, language } = formatValue(input);
  return (
    <div data-slot="tool-call-input" className={cn("flex flex-col gap-1.5", className)} {...props}>
      <SectionLabel>{label}</SectionLabel>
      <CodeBlock code={code} language={language} />
    </div>
  );
}

export interface ToolCallResultProps extends ComponentProps<"div"> {
  /** Rendered as JSON unless it is a string or a React element. */
  result?: unknown;
  error?: ReactNode;
  label?: ReactNode;
}

export function ToolCallResult({
  result,
  error,
  label = error ? "Error" : "Result",
  className,
  children,
  ...props
}: ToolCallResultProps) {
  if (children === undefined && result === undefined && !error) return null;

  let body: ReactNode = children;
  if (error) {
    body = (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">{error}</div>
    );
  } else if (body === undefined) {
    if (isValidElement(result)) {
      body = result;
    } else {
      const { code, language } = formatValue(result);
      body = <CodeBlock code={code} language={language} />;
    }
  }

  return (
    <div data-slot="tool-call-result" className={cn("flex flex-col gap-1.5", className)} {...props}>
      <SectionLabel>{label}</SectionLabel>
      {body}
    </div>
  );
}

export interface ToolCallApprovalProps extends ComponentProps<"div"> {
  /** May return a promise; both buttons are inert until it settles and a rejection shows `errorMessage`. */
  onApprove: () => void | Promise<void>;
  onDeny: () => void | Promise<void>;
  approveLabel?: string;
  denyLabel?: string;
  errorMessage?: ReactNode;
  onError?: (error: unknown) => void;
}

type Decision = "approve" | "deny";

const decisionButton =
  "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium aria-disabled:cursor-not-allowed aria-disabled:opacity-60 [&_svg]:size-3.5";

/**
 * Approve and deny controls, rendered only while the tool call is
 * "awaiting-approval". Children describe what approving will do. When the
 * controls disappear while focused, focus returns to the tool call trigger.
 */
export function ToolCallApproval({
  onApprove,
  onDeny,
  approveLabel = "Approve",
  denyLabel = "Deny",
  errorMessage = "Your decision could not be sent. Try again.",
  onError,
  onFocus,
  onBlur,
  className,
  children,
  ...props
}: ToolCallApprovalProps) {
  const { status } = useToolCall();
  const [pending, setPending] = useState<Decision | null>(null);
  const [failed, setFailed] = useState(false);
  const pendingRef = useRef(false);
  const hadFocus = useRef(false);
  const rootRef = useRef<Element | null>(null);
  const onErrorRef = useRef(onError);
  const awaiting = status === "awaiting-approval";

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (awaiting || !hadFocus.current) return;
    hadFocus.current = false;
    const active = document.activeElement;
    if (!active || active === document.body) focusTrigger(rootRef.current);
  }, [awaiting]);

  if (!awaiting) return null;

  const decide = (decision: Decision) => {
    if (pendingRef.current) return;
    const fail = (error: unknown) => {
      setFailed(true);
      onErrorRef.current?.(error);
    };
    setFailed(false);
    let result: void | Promise<void>;
    try {
      result = decision === "approve" ? onApprove() : onDeny();
    } catch (error) {
      fail(error);
      return;
    }
    if (!(result instanceof Promise)) return;
    pendingRef.current = true;
    setPending(decision);
    result.catch(fail).finally(() => {
      pendingRef.current = false;
      setPending(null);
    });
  };

  const spinner = <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" />;

  return (
    <div
      role="group"
      aria-label="Approval required"
      aria-busy={pending !== null || undefined}
      data-slot="tool-call-approval"
      className={cn("flex flex-col gap-3 rounded-md border border-warning/40 bg-warning/10 p-3", className)}
      onFocus={(event) => {
        onFocus?.(event);
        hadFocus.current = true;
        rootRef.current = event.currentTarget.closest('[data-slot="tool-call"]');
      }}
      onBlur={(event) => {
        onBlur?.(event);
        const next = event.relatedTarget;
        if (next instanceof Node && !event.currentTarget.contains(next)) hadFocus.current = false;
      }}
      {...props}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 text-sm">{children ?? "This tool needs your approval before it runs."}</div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            aria-disabled={pending !== null || undefined}
            onClick={() => decide("deny")}
            className={cn(decisionButton, "border border-border bg-background transition-colors hover:bg-accent", focusRing)}
          >
            {pending === "deny" && spinner}
            {denyLabel}
          </button>
          <button
            type="button"
            aria-disabled={pending !== null || undefined}
            onClick={() => decide("approve")}
            className={cn(decisionButton, "bg-primary text-primary-foreground transition-opacity hover:opacity-90", focusRing)}
          >
            {pending === "approve" && spinner}
            {approveLabel}
          </button>
        </div>
      </div>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
