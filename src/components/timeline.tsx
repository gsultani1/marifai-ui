// packages/ai-ui/src/components/timeline.tsx
import type { ComponentProps, ReactNode } from "react";

import { badge, type Tone, toneDot } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { isSameDay, toDate } from "../lib/dates.js";

export interface TimelineItem {
  id: string;
  title: ReactNode;
  time: Date | string | number;
  description?: ReactNode;
  /** Replaces the dot. */
  icon?: ReactNode;
  tone?: Tone;
  badges?: string[];
}

export interface TimelineProps extends Omit<ComponentProps<"ol">, "children"> {
  items: TimelineItem[];
  /** Adds a date heading whenever the day changes. */
  groupByDay?: boolean;
  locale?: string;
  emptyLabel?: ReactNode;
}

/** Vertical activity timeline with a dot and connector per entry, optional day headings and badges such as "manual". */
export function Timeline({ items, groupByDay = false, locale, emptyLabel = "No activity yet.", className, ...props }: TimelineProps) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" });
  const day = new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric" });
  return (
    <ol data-slot="timeline" className={cn("flex flex-col text-sm", className)} {...props}>
      {items.map((item, index) => {
        const when = toDate(item.time);
        const previous = items[index - 1];
        const newDay = groupByDay && (!previous || !isSameDay(previous.time, when));
        const last = index === items.length - 1;
        return (
          <li key={item.id} className="flex flex-col">
            {newDay && <h3 className={cn("pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase", index > 0 && "pt-3")}>{day.format(when)}</h3>}
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className={cn("mt-1 flex size-5 shrink-0 items-center justify-center [&_svg]:size-4", item.icon ? "text-muted-foreground" : "")}>
                  {item.icon ?? <span className={cn("size-2.5 rounded-full", toneDot[item.tone ?? "neutral"])} />}
                </span>
                {!last && <span aria-hidden="true" className="w-px flex-1 bg-border" />}
              </div>
              <div className={cn("flex min-w-0 flex-1 flex-col gap-0.5", !last && "pb-4")}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{item.title}</span>
                  {item.badges?.map((text) => (
                    <span key={text} className={badge}>
                      {text}
                    </span>
                  ))}
                  <time dateTime={when.toISOString()} className="ml-auto text-xs text-muted-foreground tabular-nums">
                    {groupByDay ? time.format(when) : `${day.format(when)}, ${time.format(when)}`}
                  </time>
                </div>
                {item.description && <div className="text-muted-foreground">{item.description}</div>}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
