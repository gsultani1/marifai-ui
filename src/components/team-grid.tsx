// packages/ai-ui/src/components/team-grid.tsx
"use client";

import { Avatar } from "@base-ui/react/avatar";
import type { ReactNode } from "react";

import { card, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { initials } from "../lib/format.js";
import { defaultRenderLink, type RenderLink } from "./breadcrumbs.js";
import { childHeadingLevel, SiteSection, type SiteSectionProps } from "./site-section.js";

export interface TeamMemberLink {
  /** Accessible name, such as "Email Dana Ortiz" or "Dana Ortiz on LinkedIn". */
  label: string;
  href: string;
  /** Icon; it is hidden from screen readers in favor of `label`. */
  icon: ReactNode;
}

export interface TeamMember {
  /** Stable key; defaults to the name. */
  id?: string;
  name: string;
  role?: string;
  bio?: ReactNode;
  /** Photo URL; initials are shown without one or while it loads. */
  photoUrl?: string;
  links?: TeamMemberLink[];
}

export interface TeamGridProps extends Omit<SiteSectionProps, "children"> {
  members: TeamMember[];
  /** Columns on wide screens. */
  columns?: 2 | 3 | 4;
  /** Bordered cards, or plain centered blocks. */
  variant?: "card" | "plain";
  renderLink?: RenderLink;
}

const columnClasses = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
} as const;

/** People with a photo or initials, name, role, short bio and icon links that carry accessible names. */
export function TeamGrid({ members, columns = 3, variant = "card", headingLevel = 2, renderLink = defaultRenderLink, ...props }: TeamGridProps) {
  const NameHeading = `h${childHeadingLevel(headingLevel)}` as const;
  return (
    <SiteSection data-slot="team-grid" headingLevel={headingLevel} {...props}>
      {members.length > 0 && (
        <ul className={cn("grid gap-6", columnClasses[columns])}>
          {members.map((member) => (
            <li key={member.id ?? member.name} className={cn("flex flex-col items-center gap-4 text-center", variant === "card" && cn(card, "p-6"))}>
              <Avatar.Root className="inline-flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-2xl font-semibold text-muted-foreground select-none">
                {member.photoUrl && <Avatar.Image src={member.photoUrl} alt="" className="size-full object-cover" />}
                <Avatar.Fallback aria-hidden="true">{initials(member.name)}</Avatar.Fallback>
              </Avatar.Root>
              <div className="flex flex-col gap-1">
                <NameHeading className="text-base font-semibold text-foreground">{member.name}</NameHeading>
                {member.role && <p className="text-sm text-muted-foreground">{member.role}</p>}
              </div>
              {member.bio && <div className="text-sm text-pretty text-muted-foreground">{member.bio}</div>}
              {member.links && member.links.length > 0 && (
                <ul aria-label={`${member.name} links`} className="mt-auto flex flex-wrap justify-center gap-1">
                  {member.links.map((link) => (
                    <li key={link.href}>
                      {renderLink({
                        href: link.href,
                        "aria-label": link.label,
                        className: cn("inline-flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground [&_svg]:size-5", focusRing),
                        children: <span aria-hidden="true" className="flex">{link.icon}</span>,
                      })}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </SiteSection>
  );
}
