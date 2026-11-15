// packages/ai-ui/src/components/agent-error.tsx
"use client";

import { CircleAlertIcon, CircleStopIcon, ClockIcon, CopyIcon, KeyRoundIcon, WifiOffIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useId, useState } from "react";

import { useCopyToClipboard } from "../hooks/use-copy-to-clipboard.js";
import { useNow } from "../hooks/use-now.js";
import { button, buttonVariants, focusRing, type Tone, toneIcon, toneSurface } from "../lib/classes.js";
import { type AgentErrorKind, classifyError, type ClassifiedError } from "../lib/classify-error.js";
import { cn } from "../lib/cn.js";

const KIND_STYLE: Record<AgentErrorKind, { tone: Tone; icon: ReactNode }> = {
  auth: { tone: "danger", icon: <KeyRoundIcon aria-hidden="true" /> },
  "rate-limit": { tone: "warning", icon: <ClockIcon aria-hidden="true" /> },
  quota: { tone: "warning", icon: <CircleAlertIcon aria-hidden="true" /> },
  context: { tone: "warning", icon: <CircleAlertIcon aria-hidden="true" /> },
  network: { tone: "warning", icon: <WifiOffIcon aria-hidden="true" /> },
  server: { tone: "danger", icon: <CircleAlertIcon aria-hidden="true" /> },
  aborted: { tone: "neutral", icon: <CircleStopIcon aria-hidden="true" /> },
  unknown: { tone: "danger", icon: <CircleAlertIcon aria-hidden="true" /> },
};

export interface AgentErrorProps extends Omit<ComponentProps<"div">, "children"> {
  /** Raw error from the provider or transport; classified with `classifyError`. */
  error: unknown;
  /** Pre-classified error, when the server already knows the kind. */
  classified?: ClassifiedError;
  /** When the error happened; Retry-After counts down from here. Defaults to first render. */
  occurredAt?: number;
  /** Changes already applied before the failure. Blocks blind retries. */
  applied?: number;
  onRetry?: () => void;
  onRetryWithoutTools?: () => void;
  onRetryWithoutAttachments?: () => void;
  onSwitchModel?: () => void;
  onOpenSettings?: () => void;
  /** Puts the failed message back in the composer. */
  onRestorePrompt?: () => void;
  /** Extra fields for "Copy diagnostics", such as model and conversation id. */
  diagnostics?: Record<string, unknown>;
}

/**
 * Error card that says what failed and what to do: fix the key, wait out a
 * rate limit, add credits, shorten the context or retry. Retry is offered only
 * when it is safe: the error is retryable and nothing was applied yet.
 */
export function AgentError({
  error,
  classified,
  occurredAt,
  applied = 0,
  onRetry,
  onRetryWithoutTools,
  onRetryWithoutAttachments,
  onSwitchModel,
  onOpenSettings,
  onRestorePrompt,
  diagnostics,
  className,
  ...props
}: AgentErrorProps) {
  const [mountedAt] = useState(() => Date.now());
  const at = occurredAt ?? mountedAt;
  const info = classified ?? classifyError(error, at);
  const waitUntil = info.retryAfterMs !== undefined ? at + info.retryAfterMs : undefined;
  const now = useNow(1000, waitUntil !== undefined);
  const waitMs = waitUntil !== undefined ? Math.max(0, waitUntil - now) : 0;
  const [showDetails, setShowDetails] = useState(false);
  const { status: copyStatus, copy } = useCopyToClipboard();
  const id = useId();
  const style = KIND_STYLE[info.kind];
  const safeToRetry = info.retryable && applied === 0;

  const copyDiagnostics = () =>
    copy(
      JSON.stringify(
        { kind: info.kind, status: info.status, requestId: info.requestId, message: info.message, applied, occurredAt: new Date(at).toISOString(), ...diagnostics },
        null,
        2,
      ),
    );

  return (
    <div
      role="alert"
      aria-labelledby={`${id}-title`}
      data-slot="agent-error"
      data-kind={info.kind}
      className={cn("flex flex-col gap-2 rounded-lg border p-3 text-sm", toneSurface[style.tone], className)}
      {...props}
    >
      <div className="flex items-start gap-2">
        <span className={cn("mt-0.5 [&_svg]:size-4", toneIcon[style.tone])}>{style.icon}</span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p id={`${id}-title`} className="font-medium">
            {info.title}
            {info.status !== undefined && <span className="font-normal text-muted-foreground"> · {info.status}</span>}
          </p>
          <p className="text-foreground/90">{info.hint}</p>
          {applied > 0 && (
            <p className="text-foreground/90">
              {applied} change{applied === 1 ? " was" : "s were"} already applied. Retrying could apply {applied === 1 ? "it" : "them"} twice, so review the current state first.
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {onRetry && safeToRetry && (
          <button type="button" aria-disabled={waitMs > 0 || undefined} onClick={() => waitMs === 0 && onRetry()} className={cn(button, buttonVariants.primary, focusRing)}>
            {waitMs > 0 ? `Retry in ${Math.ceil(waitMs / 1000)}s` : "Retry"}
          </button>
        )}
        {onRetryWithoutAttachments && applied === 0 && info.kind === "context" && (
          <button type="button" onClick={onRetryWithoutAttachments} className={cn(button, buttonVariants.outline, focusRing)}>
            Retry without attachments
          </button>
        )}
        {onRetryWithoutTools && applied === 0 && info.kind !== "auth" && info.kind !== "quota" && (
          <button type="button" onClick={onRetryWithoutTools} className={cn(button, buttonVariants.outline, focusRing)}>
            Retry without tools
          </button>
        )}
        {onSwitchModel && info.kind !== "aborted" && (
          <button type="button" onClick={onSwitchModel} className={cn(button, buttonVariants.outline, focusRing)}>
            Switch model
          </button>
        )}
        {onOpenSettings && (info.kind === "auth" || info.kind === "quota") && (
          <button type="button" onClick={onOpenSettings} className={cn(button, buttonVariants.outline, focusRing)}>
            Open settings
          </button>
        )}
        {onRestorePrompt && (
          <button type="button" onClick={onRestorePrompt} className={cn(button, buttonVariants.ghost, focusRing)}>
            Restore my message
          </button>
        )}
        <span className="ml-auto flex gap-1">
          <button type="button" aria-expanded={showDetails} onClick={() => setShowDetails(!showDetails)} className={cn(button, buttonVariants.ghost, "h-7 px-2", focusRing)}>
            {showDetails ? "Hide details" : "Details"}
          </button>
          <button type="button" onClick={copyDiagnostics} className={cn(button, buttonVariants.ghost, "h-7 px-2", focusRing)}>
            <CopyIcon aria-hidden="true" />
            {copyStatus === "copied" ? "Copied" : copyStatus === "error" ? "Copy failed" : "Copy diagnostics"}
          </button>
        </span>
      </div>
      {showDetails && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md border border-border bg-background p-2 text-xs">
          <dt className="text-muted-foreground">Message</dt>
          <dd className="break-words whitespace-pre-wrap">{info.message}</dd>
          {info.requestId && (
            <>
              <dt className="text-muted-foreground">Request</dt>
              <dd className="font-mono">{info.requestId}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Type</dt>
          <dd>{info.kind}</dd>
        </dl>
      )}
    </div>
  );
}
