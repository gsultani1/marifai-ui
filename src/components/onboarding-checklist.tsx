// packages/ai-ui/src/components/onboarding-checklist.tsx
"use client";

import { CheckCircle2Icon, ChevronDownIcon, CircleIcon, XIcon } from "lucide-react";
import { type ReactNode, useId, useState, useSyncExternalStore } from "react";

import { button, buttonVariants, card, focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { defaultRenderLink, type RenderLink } from "./breadcrumbs.js";

export interface ChecklistTask {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  /** Computed from your data, so finishing the real task checks it off. */
  done: boolean;
  actionLabel?: string;
  onAction?: () => void;
  href?: string;
}

export interface OnboardingChecklistProps {
  tasks: ChecklistTask[];
  title?: string;
  /** Hides the checklist after dismissal, remembered under this key for `dismissForMs`. */
  dismissKey?: string;
  dismissForMs?: number;
  onDismiss?: () => void;
  completeMessage?: ReactNode;
  defaultOpen?: boolean;
  renderLink?: RenderLink;
  className?: string;
}

const DAY = 24 * 60 * 60 * 1000;
const noopSubscribe = () => () => undefined;

function dismissedAt(key: string | undefined): number {
  if (!key) return 0;
  try {
    return Number(window.localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

/**
 * Getting-started card whose items check themselves off from real state,
 * with progress, a link or button for each open task, a completion message,
 * and a dismissal that lasts a day by default.
 */
export function OnboardingChecklist({ tasks, title = "Get started", dismissKey, dismissForMs = DAY, onDismiss, completeMessage = "You're all set.", defaultOpen = true, renderLink = defaultRenderLink, className }: OnboardingChecklistProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [hiddenNow, setHiddenNow] = useState(false);
  const stored = useSyncExternalStore(noopSubscribe, () => dismissedAt(dismissKey), () => 0);
  const [mountedAt] = useState(() => Date.now());
  const id = useId();
  const done = tasks.filter((task) => task.done).length;
  const complete = done === tasks.length;

  if (hiddenNow || (stored && mountedAt - stored < dismissForMs)) return null;

  const dismiss = () => {
    if (dismissKey) {
      try {
        window.localStorage.setItem(dismissKey, String(Date.now()));
      } catch {
        // Dismissal then lasts until reload.
      }
    }
    setHiddenNow(true);
    onDismiss?.();
  };

  return (
    <section aria-labelledby={`${id}-title`} className={cn(card, "flex flex-col gap-3 p-4", className)}>
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h3 id={`${id}-title`} className="text-sm font-semibold">
            {title}
          </h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div role="progressbar" aria-label={`${title} progress`} aria-valuemin={0} aria-valuemax={tasks.length} aria-valuenow={done} aria-valuetext={`${done} of ${tasks.length} done`} className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${tasks.length ? (done / tasks.length) * 100 : 0}%` }} />
            </div>
            <span>
              {done} of {tasks.length} done
            </span>
          </div>
        </div>
        <button type="button" aria-expanded={open} aria-controls={`${id}-tasks`} aria-label={open ? "Collapse checklist" : "Expand checklist"} onClick={() => setOpen(!open)} className={cn(iconButton, focusRing)}>
          <ChevronDownIcon aria-hidden="true" className={cn("transition-transform motion-reduce:transition-none", open && "rotate-180")} />
        </button>
        <button type="button" aria-label={dismissKey ? "Hide checklist for now" : "Hide checklist"} onClick={dismiss} className={cn(iconButton, focusRing)}>
          <XIcon aria-hidden="true" />
        </button>
      </div>
      <div id={`${id}-tasks`} hidden={!open}>
        {complete ? (
          <p role="status" className="flex items-center gap-2 text-sm">
            <CheckCircle2Icon aria-hidden="true" className="size-4 text-success" />
            {completeMessage}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-start gap-3 py-2.5">
                {task.done ? <CheckCircle2Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" /> : <CircleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={cn("text-sm font-medium", task.done && "text-muted-foreground line-through")}>
                    {task.title}
                    <span className="sr-only">{task.done ? " (done)" : " (to do)"}</span>
                  </span>
                  {task.description && !task.done && <span className="text-xs text-muted-foreground">{task.description}</span>}
                </div>
                {!task.done && task.actionLabel && (task.href ? renderLink({ href: task.href, className: cn(button, buttonVariants.outline, "h-7 px-2.5 text-xs", focusRing), children: task.actionLabel }) : <button type="button" onClick={task.onAction} className={cn(button, buttonVariants.outline, "h-7 px-2.5 text-xs", focusRing)}>{task.actionLabel}</button>)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
