// packages/ai-ui/src/components/blog-card.tsx
"use client";

import { Avatar } from "@base-ui/react/avatar";
import type { ComponentProps, ReactNode } from "react";

import { card } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { initials } from "../lib/format.js";
import { defaultRenderLink, type RenderLink } from "./breadcrumbs.js";
import { childHeadingLevel, type HeadingLevel, SiteSection, type SiteSectionProps } from "./site-section.js";

export interface BlogPost {
  /** Stable key; defaults to the href. */
  id?: string;
  title: string;
  href: string;
  excerpt?: ReactNode;
  /** Cover image; alt defaults to empty because the title already names the post. */
  image?: { src: string; alt?: string; width?: number; height?: number };
  category?: string;
  author?: { name: string; avatarUrl?: string };
  /** Publication date; a "YYYY-MM-DD" string is shown as that calendar day in every time zone. */
  date?: Date | string | number;
  readingMinutes?: number;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Machine-readable value and display text for a post date, or null when it is not a valid date. */
export function formatPostDate(value: Date | string | number, locale?: string): { dateTime: string; text: string } | null {
  if (typeof value === "string" && DATE_ONLY.test(value)) {
    const day = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(day.getTime())) return null;
    return { dateTime: value, text: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(day) };
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return { dateTime: date.toISOString(), text: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date) };
}

export interface BlogCardProps extends Omit<ComponentProps<"article">, "title"> {
  post: BlogPost;
  headingLevel?: HeadingLevel;
  locale?: string;
  renderLink?: RenderLink;
}

/**
 * Post preview with cover image, category, title, excerpt, author, date and
 * reading time. The title link stretches over the card, so the whole card is
 * clickable while the only interactive element is the link itself.
 */
export function BlogCard({ post, headingLevel = 3, locale, renderLink = defaultRenderLink, className, ...props }: BlogCardProps) {
  const Heading = `h${headingLevel}` as const;
  const date = post.date === undefined ? null : formatPostDate(post.date, locale);
  const minutes = post.readingMinutes !== undefined && post.readingMinutes > 0 ? new Intl.NumberFormat(locale, { style: "unit", unit: "minute", unitDisplay: "short", maximumFractionDigits: 0 }).format(post.readingMinutes) : null;

  return (
    <article
      data-slot="blog-card"
      className={cn(card, "group relative flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-offset-2 has-[a:focus-visible]:ring-offset-background motion-reduce:transition-none", className)}
      {...props}
    >
      {post.image && (
        <div className="aspect-[16/9] overflow-hidden bg-muted">
          <img src={post.image.src} alt={post.image.alt ?? ""} width={post.image.width} height={post.image.height} loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-3 p-5">
        {post.category && <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{post.category}</p>}
        <Heading className="text-lg font-semibold text-balance text-foreground">
          {renderLink({ href: post.href, className: "outline-none after:absolute after:inset-0 after:content-[''] group-hover:underline underline-offset-4", children: post.title })}
        </Heading>
        {post.excerpt && <div className="line-clamp-3 text-sm text-pretty text-muted-foreground">{post.excerpt}</div>}
        {(post.author || date || minutes) && (
          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-2 text-sm text-muted-foreground">
            {post.author && (
              <span className="flex items-center gap-2">
                <Avatar.Root className="inline-flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[0.6875rem] font-medium text-muted-foreground select-none">
                  {post.author.avatarUrl && <Avatar.Image src={post.author.avatarUrl} alt="" className="size-full object-cover" />}
                  <Avatar.Fallback aria-hidden="true">{initials(post.author.name)}</Avatar.Fallback>
                </Avatar.Root>
                <span className="font-medium text-foreground">{post.author.name}</span>
              </span>
            )}
            {date && <time dateTime={date.dateTime}>{date.text}</time>}
            {minutes && <span>{minutes} read</span>}
          </div>
        )}
      </div>
    </article>
  );
}

export interface BlogGridProps extends Omit<SiteSectionProps, "children"> {
  posts: BlogPost[];
  /** Columns on wide screens. */
  columns?: 2 | 3;
  locale?: string;
  renderLink?: RenderLink;
}

/** Section of BlogCards in a responsive grid, with card titles one level below the section title. */
export function BlogGrid({ posts, columns = 3, locale, headingLevel = 2, renderLink = defaultRenderLink, ...props }: BlogGridProps) {
  return (
    <SiteSection data-slot="blog-grid" headingLevel={headingLevel} {...props}>
      {posts.length > 0 && (
        <ul className={cn("grid gap-6", columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3")}>
          {posts.map((post) => (
            <li key={post.id ?? post.href}>
              <BlogCard post={post} headingLevel={childHeadingLevel(headingLevel)} locale={locale} renderLink={renderLink} />
            </li>
          ))}
        </ul>
      )}
    </SiteSection>
  );
}
