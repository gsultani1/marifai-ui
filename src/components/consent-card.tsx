// packages/ai-ui/src/components/consent-card.tsx
"use client";

import { BadgeCheckIcon, LoaderCircleIcon, ShieldAlertIcon, TriangleAlertIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useId, useState } from "react";

import { badge, button, buttonVariants, card, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { initials } from "../lib/format.js";
import { safeUrl } from "../lib/safe-url.js";

export interface ConsentScope {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  /** Highlights scopes that write, send or delete. */
  sensitive?: boolean;
}

export interface ConsentCardProps extends Omit<ComponentProps<"section">, "title"> {
  clientName: string;
  clientIcon?: string;
  /** Publisher verified by the authorization server. */
  verified?: boolean;
  /** Where the user is sent after approving. */
  redirectUri: string;
  scopes: ConsentScope[];
  /** The signed-in account that grants access. */
  account?: ReactNode;
  onApprove: () => void | Promise<void>;
  onCancel: () => void;
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * OAuth-style consent: which app, which account, what it can do and where the
 * user goes next. The redirect host is shown on its own, and an unsafe or
 * plain-HTTP redirect blocks or warns before approval.
 */
export function ConsentCard({ clientName, clientIcon, verified = false, redirectUri, scopes, account, onApprove, onCancel, className, ...props }: ConsentCardProps) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const id = useId();
  const href = safeUrl(redirectUri, ["http:", "https:"]);
  const url = href ? new URL(href) : undefined;
  const insecure = url !== undefined && url.protocol === "http:" && !LOOPBACK.has(url.hostname);
  const icon = safeUrl(clientIcon, ["https:", "data:"]);

  const approve = () => {
    if (!url || pending) return;
    setFailed(false);
    let outcome: void | Promise<void>;
    try {
      outcome = onApprove();
    } catch {
      setFailed(true);
      return;
    }
    if (!(outcome instanceof Promise)) return;
    setPending(true);
    outcome.then(
      () => setPending(false),
      () => {
        setPending(false);
        setFailed(true);
      },
    );
  };

  return (
    <section aria-labelledby={`${id}-title`} data-slot="consent-card" className={cn(card, "flex max-w-md flex-col gap-4 p-4 text-sm", className)} {...props}>
      <div className="flex items-center gap-3">
        {icon ? (
          <img src={icon} alt="" className="size-10 rounded-lg border border-border object-cover" />
        ) : (
          <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-lg bg-muted font-medium">
            {initials(clientName)}
          </span>
        )}
        <div className="flex min-w-0 flex-col">
          <h3 id={`${id}-title`} className="font-medium">
            {clientName} wants access to your account
          </h3>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {verified ? (
              <>
                <BadgeCheckIcon aria-hidden="true" className="size-3.5 text-success" />
                Verified publisher
              </>
            ) : (
              <>
                <ShieldAlertIcon aria-hidden="true" className="size-3.5 text-warning" />
                Unverified publisher
              </>
            )}
          </span>
        </div>
      </div>
      {account && <p className="text-muted-foreground">Signed in as {account}</p>}
      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">It will be able to</h4>
        <ul className="flex flex-col gap-2">
          {scopes.map((scope) => (
            <li key={scope.id} className="flex flex-col gap-0.5 rounded-md border border-border px-3 py-2">
              <span className="flex items-center gap-2">
                <span className="font-medium">{scope.label}</span>
                {scope.sensitive && <span className={cn(badge, "border-warning/50")}>Sensitive</span>}
              </span>
              {scope.description && <span className="text-xs text-muted-foreground">{scope.description}</span>}
              <code className="font-mono text-xs text-muted-foreground">{scope.id}</code>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/50 px-3 py-2">
        <span className="text-xs text-muted-foreground">After approving you will be sent to</span>
        {url ? (
          <>
            <span className="font-medium">{url.host}</span>
            <code className="font-mono text-xs break-all text-muted-foreground">{url.href}</code>
          </>
        ) : (
          <span className="text-destructive">This redirect address is not allowed, so access cannot be granted.</span>
        )}
        {insecure && (
          <span className="flex items-center gap-1 text-xs">
            <TriangleAlertIcon aria-hidden="true" className="size-3.5 shrink-0 text-warning" />
            This address does not use HTTPS. Only continue if you trust the network.
          </span>
        )}
      </div>
      {failed && (
        <p role="alert" className="text-destructive">
          Access could not be granted. Try again.
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={cn(button, buttonVariants.outline, focusRing)}>
          Cancel
        </button>
        <button type="button" aria-disabled={!url || pending || undefined} onClick={approve} className={cn(button, buttonVariants.primary, focusRing)}>
          {pending && <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" />}
          Allow access
        </button>
      </div>
    </section>
  );
}
