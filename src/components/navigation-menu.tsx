// packages/ai-ui/src/components/navigation-menu.tsx
"use client";

import { NavigationMenu as BaseNavigationMenu } from "@base-ui/react/navigation-menu";
import { ChevronDownIcon } from "lucide-react";
import { createContext, use } from "react";

import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { usePortalContainer } from "../lib/portal.js";
import type { WithClassName } from "../lib/types.js";
import { defaultRenderLink, type RenderLink } from "./breadcrumbs.js";
import { popupArrowClass } from "./popover.js";

/** Top-level trigger look; apply it to a NavigationMenuLink that sits directly in the list. */
export const navigationMenuTriggerClass = cn(
  "inline-flex h-9 items-center justify-center gap-1 rounded-md px-3 text-sm font-medium text-foreground transition-colors outline-none select-none hover:bg-accent hover:text-accent-foreground data-[active]:bg-accent data-[popup-open]:bg-accent data-[popup-open]:text-accent-foreground",
  focusRing,
);

const RenderLinkContext = createContext<RenderLink>(defaultRenderLink);

export interface NavigationMenuProps extends WithClassName<BaseNavigationMenu.Root.Props> {
  /** Renders every NavigationMenuLink through your router, such as React Router's Link; defaults to an anchor. */
  renderLink?: RenderLink;
  /** Renders the shared NavigationMenuViewport; turn off to place your own. */
  viewport?: boolean;
  /** Shows an arrow on the default viewport pointing at the open trigger. */
  indicator?: boolean;
}

/**
 * Site navigation on Base UI Navigation Menu: links plus triggers that open
 * rich panels in one shared, animated viewport. Panels open on hover or
 * click, arrow keys move between items, and Escape closes. Give it an
 * `aria-label`.
 */
export function NavigationMenu({ renderLink = defaultRenderLink, viewport = true, indicator = false, className, children, ...props }: NavigationMenuProps) {
  return (
    <RenderLinkContext value={renderLink}>
      <BaseNavigationMenu.Root data-slot="navigation-menu" className={cn("relative flex max-w-max items-center", className)} {...props}>
        {children}
        {viewport && <NavigationMenuViewport>{indicator && <NavigationMenuIndicator />}</NavigationMenuViewport>}
      </BaseNavigationMenu.Root>
    </RenderLinkContext>
  );
}

export type NavigationMenuListProps = WithClassName<BaseNavigationMenu.List.Props>;

export function NavigationMenuList({ className, ...props }: NavigationMenuListProps) {
  return <BaseNavigationMenu.List data-slot="navigation-menu-list" className={cn("flex flex-wrap items-center gap-1", className)} {...props} />;
}

export type NavigationMenuItemProps = WithClassName<BaseNavigationMenu.Item.Props>;

export function NavigationMenuItem({ className, ...props }: NavigationMenuItemProps) {
  return <BaseNavigationMenu.Item data-slot="navigation-menu-item" className={cn("relative", className)} {...props} />;
}

export type NavigationMenuTriggerProps = WithClassName<BaseNavigationMenu.Trigger.Props>;

/** Button that opens the item's NavigationMenuContent; the chevron turns while it is open. */
export function NavigationMenuTrigger({ className, children, ...props }: NavigationMenuTriggerProps) {
  return (
    <BaseNavigationMenu.Trigger data-slot="navigation-menu-trigger" className={cn(navigationMenuTriggerClass, className)} {...props}>
      {children}
      <BaseNavigationMenu.Icon className="flex transition-transform duration-200 data-[popup-open]:rotate-180 motion-reduce:transition-none">
        <ChevronDownIcon aria-hidden="true" className="size-3.5 text-muted-foreground" />
      </BaseNavigationMenu.Icon>
    </BaseNavigationMenu.Trigger>
  );
}

export type NavigationMenuContentProps = WithClassName<BaseNavigationMenu.Content.Props>;

/** Panel for one item; it moves into the shared viewport while its trigger is open. */
export function NavigationMenuContent({ className, ...props }: NavigationMenuContentProps) {
  return (
    <BaseNavigationMenu.Content
      data-slot="navigation-menu-content"
      className={cn(
        "h-full w-[calc(100vw-2rem)] p-2 transition-[opacity,translate] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 data-[starting-style]:data-[activation-direction=left]:-translate-x-1/2 data-[starting-style]:data-[activation-direction=right]:translate-x-1/2 data-[ending-style]:data-[activation-direction=left]:translate-x-1/2 data-[ending-style]:data-[activation-direction=right]:-translate-x-1/2 motion-reduce:transition-none sm:w-max sm:max-w-[40rem]",
        className,
      )}
      {...props}
    />
  );
}

export interface NavigationMenuLinkProps extends WithClassName<Omit<BaseNavigationMenu.Link.Props, "render" | "href">> {
  href: string;
  /** Marks the current page: aria-current="page" and the active style. */
  active?: boolean;
}

/**
 * A link rendered through the menu's `renderLink`. Inside content it is a
 * block with room for a title and a description; directly in the list, pass
 * `className={navigationMenuTriggerClass}`.
 */
export function NavigationMenuLink({ href, active = false, className, children, ...props }: NavigationMenuLinkProps) {
  const renderLink = use(RenderLinkContext);
  return (
    <BaseNavigationMenu.Link
      active={active}
      data-slot="navigation-menu-link"
      className={cn(
        "flex flex-col gap-1 rounded-md p-3 text-sm text-foreground transition-colors outline-none hover:bg-accent hover:text-accent-foreground data-[active]:bg-accent data-[active]:text-accent-foreground [&_p]:text-muted-foreground",
        focusRing,
        className,
      )}
      render={renderLink({ href, children })}
      {...props}
    />
  );
}

export interface NavigationMenuViewportProps extends WithClassName<BaseNavigationMenu.Popup.Props> {
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
}

/**
 * Shared floating surface that hosts whichever content is open, resizing
 * between panels. NavigationMenu renders one by default; children (such as
 * NavigationMenuIndicator) render inside the surface.
 */
export function NavigationMenuViewport({ side = "bottom", align = "start", sideOffset = 8, className, children, ...props }: NavigationMenuViewportProps) {
  const container = usePortalContainer();
  return (
    <BaseNavigationMenu.Portal container={container}>
      <BaseNavigationMenu.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={8}
        className="z-50 h-[var(--positioner-height)] w-[var(--positioner-width)] max-w-[var(--available-width)] transition-[top,left,right,bottom] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] before:absolute before:content-[''] data-[instant]:transition-none data-[side=bottom]:before:inset-x-0 data-[side=bottom]:before:-top-2.5 data-[side=bottom]:before:h-2.5 data-[side=left]:before:inset-y-0 data-[side=left]:before:-right-2.5 data-[side=left]:before:w-2.5 data-[side=right]:before:inset-y-0 data-[side=right]:before:-left-2.5 data-[side=right]:before:w-2.5 data-[side=top]:before:inset-x-0 data-[side=top]:before:-bottom-2.5 data-[side=top]:before:h-2.5 motion-reduce:transition-none"
      >
        <BaseNavigationMenu.Popup
          data-slot="navigation-menu-viewport"
          className={cn(
            "relative h-[var(--popup-height)] w-[var(--popup-width)] origin-[var(--transform-origin)] rounded-lg border border-border bg-popover text-popover-foreground shadow-lg outline-none transition-[opacity,scale,width,height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:duration-150 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 motion-reduce:transition-none",
            className,
          )}
          {...props}
        >
          {children}
          <BaseNavigationMenu.Viewport className="relative size-full overflow-hidden rounded-[inherit]" />
        </BaseNavigationMenu.Popup>
      </BaseNavigationMenu.Positioner>
    </BaseNavigationMenu.Portal>
  );
}

export type NavigationMenuIndicatorProps = WithClassName<BaseNavigationMenu.Arrow.Props>;

/** Arrow on the viewport pointing at the open trigger; place it inside NavigationMenuViewport. */
export function NavigationMenuIndicator({ className, ...props }: NavigationMenuIndicatorProps) {
  return <BaseNavigationMenu.Arrow data-slot="navigation-menu-indicator" className={cn(popupArrowClass, "transition-[left,right] duration-300 motion-reduce:transition-none", className)} {...props} />;
}
