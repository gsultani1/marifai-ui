// packages/ai-ui/src/components/logo-cloud.tsx
"use client";

import type { ReactNode } from "react";

import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { defaultRenderLink, type RenderLink } from "./breadcrumbs.js";
import { SiteSection, type SiteSectionProps } from "./site-section.js";

export interface LogoItem {
  /** Stable key; defaults to the index. */
  id?: string;
  /** Accessible name, such as the brand name; used as the image's alt text. */
  name: string;
  /** Image URL; use `logo` for an inline SVG or text mark instead. */
  src?: string;
  logo?: ReactNode;
  /** Intrinsic size of the image, which avoids layout shift while it loads. */
  width?: number;
  height?: number;
  href?: string;
}

export interface LogoCloudProps extends Omit<SiteSectionProps, "children"> {
  items: LogoItem[];
  /** An even grid, or a centered row that wraps. */
  layout?: "grid" | "row";
  /** Grayscale images and muted marks that regain color on hover and focus; text marks keep AA contrast. */
  muted?: boolean;
  renderLink?: RenderLink;
}

const gridColumns = (count: number) => (count >= 6 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" : count >= 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3");

/** Logos of partners, brands carried or customers, each with a required accessible name, in a grid or a row. */
export function LogoCloud({ items, layout = "row", muted = false, size = "sm", align = "center", renderLink = defaultRenderLink, ...props }: LogoCloudProps) {
  const mark = (item: LogoItem) =>
    item.src ? (
      <img src={item.src} alt={item.name} width={item.width} height={item.height} loading="lazy" decoding="async" className={cn("h-8 w-auto max-w-[9rem] object-contain sm:h-10", muted && "grayscale transition-[filter] group-hover:grayscale-0 group-focus-visible:grayscale-0 motion-reduce:transition-none")} />
    ) : (
      <span role="img" aria-label={item.name} className={cn("flex h-10 items-center text-lg font-semibold [&_svg]:h-8 [&_svg]:w-auto", muted ? "text-muted-foreground transition-colors group-hover:text-foreground group-focus-visible:text-foreground motion-reduce:transition-none" : "text-foreground")}>
        {item.logo ?? item.name}
      </span>
    );

  return (
    <SiteSection data-slot="logo-cloud" data-layout={layout} size={size} align={align} {...props}>
      {items.length > 0 && (
        <ul className={cn(layout === "grid" ? cn("grid items-center gap-x-6 gap-y-8", gridColumns(items.length)) : "flex flex-wrap items-center justify-center gap-x-10 gap-y-6 sm:gap-x-14")}>
          {items.map((item, index) => (
            <li key={item.id ?? index} className="flex min-w-0 items-center justify-center">
              {item.href !== undefined ? renderLink({ href: item.href, className: cn("group flex items-center rounded-md p-1", focusRing), children: mark(item) }) : <span className="group flex items-center p-1">{mark(item)}</span>}
            </li>
          ))}
        </ul>
      )}
    </SiteSection>
  );
}
