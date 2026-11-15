// packages/ai-ui/src/components/testimonials.tsx
"use client";

import { Avatar } from "@base-ui/react/avatar";
import type { ReactNode } from "react";

import { card } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { initials } from "../lib/format.js";
import { Rating } from "./rating.js";
import { SiteSection, type SiteSectionProps } from "./site-section.js";

export interface Testimonial {
  /** Stable key; defaults to the index. */
  id?: string;
  quote: ReactNode;
  name: string;
  role?: string;
  company?: string;
  avatarUrl?: string;
  /** Star rating shown above the quote. */
  rating?: number;
}

export interface TestimonialsProps extends Omit<SiteSectionProps, "children"> {
  items: Testimonial[];
  /** A grid of cards, or the first quote featured large with the rest in a grid below. */
  layout?: "grid" | "featured";
  /** Columns on wide screens for the grid. */
  columns?: 2 | 3;
  /** Highest rating, for the stars and the spoken "4 out of 5". */
  ratingMax?: number;
}

function Byline({ item, large }: { item: Testimonial; large: boolean }) {
  const detail = [item.role, item.company].filter(Boolean).join(", ");
  return (
    <figcaption className={cn("flex items-center gap-3", large && "justify-center")}>
      <Avatar.Root className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-medium text-muted-foreground select-none", large ? "size-12 text-sm" : "size-10 text-xs")}>
        {item.avatarUrl && <Avatar.Image src={item.avatarUrl} alt="" className="size-full object-cover" />}
        <Avatar.Fallback aria-hidden="true">{initials(item.name)}</Avatar.Fallback>
      </Avatar.Root>
      <span className={cn("flex min-w-0 flex-col", large && "text-left")}>
        <span className="text-sm font-semibold text-foreground">{item.name}</span>
        {detail && <span className="text-sm text-muted-foreground">{detail}</span>}
      </span>
    </figcaption>
  );
}

function Quote({ item, large, ratingMax }: { item: Testimonial; large: boolean; ratingMax: number }) {
  return (
    <figure className={cn("flex h-full flex-col gap-5", large ? "mx-auto max-w-3xl items-center text-center" : cn(card, "p-6"))}>
      {item.rating !== undefined && <Rating readOnly value={item.rating} max={ratingMax} size={large ? "md" : "sm"} label="Rating" />}
      <blockquote className={cn("flex-1 text-pretty text-foreground", large ? "text-xl font-medium sm:text-2xl" : "text-base")}>
        {typeof item.quote === "string" ? <p>{item.quote}</p> : item.quote}
      </blockquote>
      <Byline item={item} large={large} />
    </figure>
  );
}

/**
 * Customer quotes as figure, blockquote and figcaption with the author's
 * name, role, company and avatar (initials when there is no photo) and an
 * optional read-only star rating, in a grid or with one quote featured.
 */
export function Testimonials({ items, layout = "grid", columns = 3, ratingMax = 5, ...props }: TestimonialsProps) {
  const [first, ...rest] = items;
  const featured = layout === "featured" && first ? first : undefined;
  const grid = featured ? rest : items;
  return (
    <SiteSection data-slot="testimonials" data-layout={layout} {...props}>
      {featured && <Quote item={featured} large ratingMax={ratingMax} />}
      {grid.length > 0 && (
        <ul className={cn("grid gap-6", columns === 2 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3")}>
          {grid.map((item, index) => (
            <li key={item.id ?? index}>
              <Quote item={item} large={false} ratingMax={ratingMax} />
            </li>
          ))}
        </ul>
      )}
    </SiteSection>
  );
}
