// packages/ai-ui/src/components/action-result-card.tsx
import { CalendarIcon, CheckSquareIcon, ExternalLinkIcon, FileTextIcon, MailIcon, RocketIcon, SparklesIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { button, buttonVariants, card, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { safeUrl } from "../lib/safe-url.js";

export type ActionResultKind = "document" | "event" | "task" | "message" | "deployment" | "other";

const KIND_ICONS: Record<ActionResultKind, ReactNode> = {
  document: <FileTextIcon aria-hidden="true" />,
  event: <CalendarIcon aria-hidden="true" />,
  task: <CheckSquareIcon aria-hidden="true" />,
  message: <MailIcon aria-hidden="true" />,
  deployment: <RocketIcon aria-hidden="true" />,
  other: <SparklesIcon aria-hidden="true" />,
};

export interface ActionResultCardProps extends Omit<ComponentProps<"article">, "title"> {
  kind?: ActionResultKind;
  title: ReactNode;
  /** One line about what was made, e.g. "Draft · not sent" or "Tue 10:00–10:30". */
  description?: ReactNode;
  /** Opens the result; only http(s) and relative links are used. */
  href?: string;
  onOpen?: () => void;
  openLabel?: string;
  icon?: ReactNode;
  /** Extra actions such as Undo or Send now. */
  actions?: ReactNode;
}

/** Shows what an agent action produced (a draft, an event, a task, a deployment) with a way to open it. */
export function ActionResultCard({
  kind = "other",
  title,
  description,
  href,
  onOpen,
  openLabel = "Open",
  icon,
  actions,
  className,
  ...props
}: ActionResultCardProps) {
  const link = safeUrl(href, ["http:", "https:"], { allowRelative: true });
  return (
    <article data-slot="action-result-card" data-kind={kind} className={cn(card, "flex items-center gap-3 p-3 text-sm", className)} {...props}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-4">{icon ?? KIND_ICONS[kind]}</span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{title}</span>
        {description && <span className="truncate text-xs text-muted-foreground">{description}</span>}
      </div>
      {actions}
      {onOpen ? (
        <button type="button" onClick={onOpen} className={cn(button, buttonVariants.outline, "h-7 px-2.5", focusRing)}>
          {openLabel}
        </button>
      ) : (
        link && (
          <a href={link} target="_blank" rel="noopener noreferrer" className={cn(button, buttonVariants.outline, "h-7 px-2.5", focusRing)}>
            {openLabel}
            <ExternalLinkIcon aria-hidden="true" />
            <span className="sr-only"> (opens in new tab)</span>
          </a>
        )
      )}
    </article>
  );
}
