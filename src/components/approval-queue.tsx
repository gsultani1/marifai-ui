// packages/ai-ui/src/components/approval-queue.tsx
"use client";

import { Tabs } from "@base-ui/react/tabs";
import { ChevronLeftIcon, ChevronRightIcon, InboxIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useState } from "react";

import { useNow } from "../hooks/use-now.js";
import { focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatRelativeTime } from "../lib/format.js";
import { type ActionRisk, ActionApproval, type ApprovalState } from "./action-approval.js";

export interface ApprovalRequest {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  preview?: ReactNode;
  risk?: ActionRisk;
  scopes?: string[];
  digest?: string;
  /** Who is asking, e.g. "Research agent". */
  source?: ReactNode;
  requestedAt?: number;
  state?: ApprovalState;
}

export interface ApprovalQueueProps extends Omit<ComponentProps<"section">, "children"> {
  requests: ApprovalRequest[];
  onApprove: (id: string) => void | Promise<void>;
  onDeny: (id: string, reason?: string) => void | Promise<void>;
  denyRequiresReason?: boolean;
  label?: string;
}

const tabClass = cn(
  "relative z-10 inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground data-[active]:text-foreground",
  focusRing,
);

/**
 * Pending agent requests shown one at a time, so every approval is a separate
 * decision. Decided requests move to a history tab with their outcome.
 */
export function ApprovalQueue({ requests, onApprove, onDeny, denyRequiresReason, label = "Approvals", className, ...props }: ApprovalQueueProps) {
  const pending = requests.filter((request) => (request.state ?? "pending") === "pending");
  const decided = requests.filter((request) => (request.state ?? "pending") !== "pending");
  const [currentId, setCurrentId] = useState<string | null>(null);
  const foundIndex = pending.findIndex((request) => request.id === currentId);
  const index = foundIndex === -1 ? 0 : foundIndex;
  const current = pending[index];
  const now = useNow(60_000);

  const step = (delta: number) => {
    const next = pending[index + delta];
    if (next) setCurrentId(next.id);
  };

  return (
    <section aria-label={label} data-slot="approval-queue" className={cn("flex flex-col gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground", className)} {...props}>
      <Tabs.Root defaultValue="pending" className="flex flex-col gap-3">
        <Tabs.List aria-label={label} className="relative flex w-fit gap-1 rounded-lg bg-muted p-0.5">
          <Tabs.Tab value="pending" className={tabClass}>
            Pending
            <span className="tabular-nums">{pending.length}</span>
          </Tabs.Tab>
          <Tabs.Tab value="history" className={tabClass}>
            History
            <span className="tabular-nums">{decided.length}</span>
          </Tabs.Tab>
          <Tabs.Indicator className="absolute top-0.5 left-[var(--active-tab-left)] h-7 w-[var(--active-tab-width)] rounded-md bg-background shadow-sm transition-[left,width] duration-150 motion-reduce:transition-none" />
        </Tabs.List>
        <Tabs.Panel value="pending" className="outline-none">
          {current ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span aria-live="polite">
                  Request {index + 1} of {pending.length}
                </span>
                {current.source && <span>· {current.source}</span>}
                {current.requestedAt !== undefined && <span>· {formatRelativeTime(current.requestedAt, now)}</span>}
                {pending.length > 1 && (
                  <span className="ml-auto flex gap-1">
                    <button type="button" aria-label="Previous request" disabled={index === 0} onClick={() => step(-1)} className={cn(iconButton, "size-7", focusRing)}>
                      <ChevronLeftIcon aria-hidden="true" />
                    </button>
                    <button type="button" aria-label="Next request" disabled={index === pending.length - 1} onClick={() => step(1)} className={cn(iconButton, "size-7", focusRing)}>
                      <ChevronRightIcon aria-hidden="true" />
                    </button>
                  </span>
                )}
              </div>
              <ActionApproval
                key={current.id}
                title={current.title}
                description={current.description}
                preview={current.preview}
                risk={current.risk}
                scopes={current.scopes}
                digest={current.digest}
                denyRequiresReason={denyRequiresReason}
                onApprove={() => onApprove(current.id)}
                onDeny={(reason) => onDeny(current.id, reason)}
              />
            </div>
          ) : (
            <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground [&_svg]:size-4">
              <InboxIcon aria-hidden="true" />
              Nothing is waiting for your approval.
            </p>
          )}
        </Tabs.Panel>
        <Tabs.Panel value="history" className="outline-none">
          {decided.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No decisions yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {decided.map((request) => (
                <li key={request.id}>
                  <ActionApproval title={request.title} digest={request.digest} state={request.state} onApprove={() => undefined} onDeny={() => undefined} />
                </li>
              ))}
            </ul>
          )}
        </Tabs.Panel>
      </Tabs.Root>
    </section>
  );
}
