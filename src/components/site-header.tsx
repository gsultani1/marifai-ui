// packages/ai-ui/src/components/site-header.tsx
"use client";

import { Dialog } from "@base-ui/react/dialog";
import { NavigationMenu } from "@base-ui/react/navigation-menu";
import { ChevronDownIcon, MenuIcon, XIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useEffect, useId, useSyncExternalStore } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { focusRing, iconButton, modalBackdrop } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { usePortalContainer } from "../lib/portal.js";
import { isNavItemCurrent } from "./app-shell.js";
import { defaultRenderLink, type RenderLink } from "./breadcrumbs.js";

export interface SiteNavLink {
  label: string;
  href: string;
  /** Second line under the label inside dropdown groups. */
  description?: string;
  /** Icon shown inside dropdown groups; mark it aria-hidden. */
  icon?: ReactNode;
  /** Forces the current-page state; otherwise it follows `currentPath`. */
  current?: boolean;
  /** Extra paths, or a test, that also mark this link current, for sections with child pages. */
  match?: string[] | ((path: string) => boolean);
}

export interface SiteNavGroup {
  label: string;
  items: SiteNavLink[];
}

export type SiteNavEntry = SiteNavLink | SiteNavGroup;

function isGroup(entry: SiteNavEntry): entry is SiteNavGroup {
  return "items" in entry;
}

/** The link marked `current`, or the most specific link matching `path`. */
function findCurrent(links: SiteNavLink[], path: string | undefined): SiteNavLink | undefined {
  const forced = links.find((link) => link.current === true);
  if (forced || path === undefined) return forced;
  return links
    .filter((link) => link.current !== false && isNavItemCurrent({ id: link.href, label: link.label, href: link.href, match: link.match }, path))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

const BREAKPOINTS = {
  sm: { desktop: "max-sm:hidden", mobile: "sm:hidden", query: "(min-width: 40rem)" },
  md: { desktop: "max-md:hidden", mobile: "md:hidden", query: "(min-width: 48rem)" },
  lg: { desktop: "max-lg:hidden", mobile: "lg:hidden", query: "(min-width: 64rem)" },
} as const;

function subscribeScroll(onChange: () => void): () => void {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

function subscribeNothing(): () => void {
  return () => undefined;
}

const readScrolled = () => window.scrollY > 0;
const notScrolled = () => false;

const desktopLink =
  "inline-flex h-9 items-center gap-1 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground aria-[current=page]:text-foreground aria-[current=page]:underline aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-8";

const panelLink =
  "flex min-h-11 items-center gap-3 rounded-md px-3 text-base font-medium text-foreground transition-colors hover:bg-accent aria-[current=page]:bg-accent aria-[current=page]:shadow-[inset_3px_0_0_var(--foreground)]";

export interface SiteHeaderProps extends Omit<ComponentProps<"header">, "children"> {
  /** Logo and name. */
  brand: ReactNode;
  /** Makes the brand a link, usually to the home page. */
  brandHref?: string;
  /** Accessible name for the brand link when the brand is only an image or icon. */
  brandLabel?: string;
  /** Links and dropdown groups. */
  nav?: SiteNavEntry[];
  /** Path of the current page; the most specific matching link gets aria-current="page". */
  currentPath?: string;
  /** Content at the end of the bar, such as a phone number or a "Visit us" button. */
  actions?: ReactNode;
  /** Content at the bottom of the small-screen menu panel, such as full-width buttons. */
  menuFooter?: ReactNode;
  /** Keeps the bar at the top of the viewport and shows a border once the page scrolls. */
  sticky?: boolean;
  /** Below this breakpoint the links move into a menu panel. */
  collapseBelow?: keyof typeof BREAKPOINTS;
  /** Renders a "Skip to content" link first, pointing at this fragment, such as "#main". */
  skipLinkHref?: string;
  skipLinkLabel?: string;
  menuOpen?: boolean;
  defaultMenuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
  /** Accessible name of the navigation landmark. */
  label?: string;
  /** Accessible name of the menu panel. */
  menuLabel?: string;
  renderLink?: RenderLink;
}

/**
 * Website header: brand, navigation with current-page state and dropdown
 * groups, and an action slot. Below `collapseBelow` the links move into a
 * full-height panel built on Base UI Dialog that traps focus, closes on
 * Escape or when a link is followed, and returns focus to the menu button.
 */
export function SiteHeader({
  brand,
  brandHref,
  brandLabel,
  nav = [],
  currentPath,
  actions,
  menuFooter,
  sticky = false,
  collapseBelow = "md",
  skipLinkHref,
  skipLinkLabel = "Skip to content",
  menuOpen,
  defaultMenuOpen = false,
  onMenuOpenChange,
  label = "Main",
  menuLabel = "Menu",
  renderLink = defaultRenderLink,
  className,
  ...props
}: SiteHeaderProps) {
  const [open, setOpen] = useControllableState({ value: menuOpen, defaultValue: defaultMenuOpen, onChange: onMenuOpenChange });
  const scrolled = useSyncExternalStore(sticky ? subscribeScroll : subscribeNothing, sticky ? readScrolled : notScrolled, notScrolled);
  const container = usePortalContainer();
  const id = useId();
  const breakpoint = BREAKPOINTS[collapseBelow];
  const current = findCurrent(
    nav.flatMap((entry) => (isGroup(entry) ? entry.items : [entry])),
    currentPath,
  );

  useEffect(() => {
    if (!open || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(breakpoint.query);
    const onChange = () => {
      if (media.matches) setOpen(false);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [open, breakpoint.query, setOpen]);

  const ariaCurrent = (link: SiteNavLink) => (link === current ? ("page" as const) : undefined);

  const groupLink = (link: SiteNavLink) => (
    <NavigationMenu.Link
      closeOnClick
      active={link === current}
      render={renderLink({
        href: link.href,
        "aria-current": ariaCurrent(link),
        className: cn("flex gap-3 rounded-md p-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground aria-[current=page]:bg-accent", focusRing, "focus-visible:ring-offset-0"),
        children: (
          <>
            {link.icon && <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center text-muted-foreground [&_svg]:size-4">{link.icon}</span>}
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">{link.label}</span>
              {link.description && <span className="text-xs text-muted-foreground">{link.description}</span>}
            </span>
          </>
        ),
      })}
    />
  );

  return (
    <header
      data-slot="site-header"
      data-scrolled={scrolled || undefined}
      className={cn(
        "relative z-40 w-full border-b bg-background text-foreground",
        sticky ? "sticky top-0 border-transparent transition-[border-color,box-shadow] data-[scrolled]:border-border data-[scrolled]:shadow-sm motion-reduce:transition-none" : "border-border",
        className,
      )}
      {...props}
    >
      {skipLinkHref && (
        <a href={skipLinkHref} className={cn("sr-only rounded-md bg-background px-3 py-2 text-sm font-medium text-foreground shadow-md focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50", focusRing)}>
          {skipLinkLabel}
        </a>
      )}
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 shrink items-center">
          {brandHref !== undefined
            ? renderLink({ href: brandHref, "aria-label": brandLabel, className: cn("flex min-w-0 items-center gap-2 rounded-md font-semibold", focusRing), children: brand })
            : <div className="flex min-w-0 items-center gap-2 font-semibold">{brand}</div>}
        </div>
        {nav.length > 0 && (
          <NavigationMenu.Root aria-label={label} className={cn("min-w-0", breakpoint.desktop)}>
            <NavigationMenu.List className="flex items-center gap-1">
              {nav.map((entry) =>
                isGroup(entry) ? (
                  <NavigationMenu.Item key={`group-${entry.label}`} value={entry.label}>
                    <NavigationMenu.Trigger data-current={(current !== undefined && entry.items.includes(current)) || undefined} className={cn(desktopLink, "data-[current]:text-foreground data-[current]:underline data-[current]:decoration-2 data-[current]:underline-offset-8 data-[popup-open]:bg-accent data-[popup-open]:text-accent-foreground", focusRing)}>
                      {entry.label}
                      <NavigationMenu.Icon className="flex transition-transform duration-200 data-[popup-open]:rotate-180 motion-reduce:transition-none">
                        <ChevronDownIcon aria-hidden="true" className="size-4" />
                      </NavigationMenu.Icon>
                    </NavigationMenu.Trigger>
                    <NavigationMenu.Content className="w-[min(32rem,calc(100vw-2rem))] p-2 transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none">
                      <ul className={cn("grid gap-1", entry.items.length > 3 && "sm:grid-cols-2")}>
                        {entry.items.map((link) => (
                          <li key={link.href}>{groupLink(link)}</li>
                        ))}
                      </ul>
                    </NavigationMenu.Content>
                  </NavigationMenu.Item>
                ) : (
                  <NavigationMenu.Item key={entry.href}>
                    <NavigationMenu.Link
                      active={entry === current}
                      render={renderLink({ href: entry.href, "aria-current": ariaCurrent(entry), className: cn(desktopLink, focusRing), children: entry.label })}
                    />
                  </NavigationMenu.Item>
                ),
              )}
            </NavigationMenu.List>
            <NavigationMenu.Portal container={container}>
              <NavigationMenu.Positioner
                sideOffset={8}
                collisionPadding={16}
                className="z-50 h-[var(--positioner-height)] w-[var(--positioner-width)] max-w-[var(--available-width)] transition-[top,left,right,bottom] duration-200 data-[instant]:transition-none motion-reduce:transition-none"
              >
                <NavigationMenu.Popup className="relative h-[var(--popup-height)] w-[var(--popup-width)] origin-[var(--transform-origin)] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg outline-none transition-[opacity,scale,width,height] duration-200 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 motion-reduce:transition-none">
                  <NavigationMenu.Viewport className="relative size-full overflow-hidden" />
                </NavigationMenu.Popup>
              </NavigationMenu.Positioner>
            </NavigationMenu.Portal>
          </NavigationMenu.Root>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {actions}
          {nav.length > 0 && (
            <Dialog.Root open={open} onOpenChange={setOpen}>
              <Dialog.Trigger aria-label={`Open ${menuLabel.toLowerCase()}`} className={cn(iconButton, "size-10 text-foreground [&_svg]:size-5", breakpoint.mobile, focusRing)}>
                <MenuIcon aria-hidden="true" />
              </Dialog.Trigger>
              <Dialog.Portal container={container}>
                <Dialog.Backdrop className={cn(modalBackdrop, breakpoint.mobile)} />
                <Dialog.Popup
                  className={cn(
                    "fixed inset-y-0 right-0 z-50 flex h-dvh w-full max-w-sm flex-col border-border bg-background text-foreground shadow-xl outline-none transition-transform duration-200 data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full motion-reduce:transition-none sm:border-l",
                    breakpoint.mobile,
                  )}
                >
                  <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
                    <div className="flex min-w-0 items-center gap-2 font-semibold">{brand}</div>
                    <Dialog.Title className="sr-only">
                      {menuLabel}
                    </Dialog.Title>
                    <Dialog.Close aria-label={`Close ${menuLabel.toLowerCase()}`} className={cn(iconButton, "size-10 text-foreground [&_svg]:size-5", focusRing)}>
                      <XIcon aria-hidden="true" />
                    </Dialog.Close>
                  </div>
                  <nav aria-label={label} className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
                    <ul className="flex flex-col gap-1">
                      {nav.map((entry, index) =>
                        isGroup(entry) ? (
                          <li key={`group-${entry.label}`} className="flex flex-col gap-1 pt-3">
                            <p id={`${id}-group-${index}`} className="px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                              {entry.label}
                            </p>
                            <ul aria-labelledby={`${id}-group-${index}`} className="flex flex-col gap-1">
                              {entry.items.map((link) => (
                                <li key={link.href}>
                                  {renderLink({ href: link.href, "aria-current": ariaCurrent(link), onClick: () => setOpen(false), className: cn(panelLink, focusRing, "focus-visible:ring-offset-0"), children: link.label })}
                                </li>
                              ))}
                            </ul>
                          </li>
                        ) : (
                          <li key={entry.href}>
                            {renderLink({ href: entry.href, "aria-current": ariaCurrent(entry), onClick: () => setOpen(false), className: cn(panelLink, focusRing, "focus-visible:ring-offset-0"), children: entry.label })}
                          </li>
                        ),
                      )}
                    </ul>
                  </nav>
                  {menuFooter && <div className="flex shrink-0 flex-col gap-2 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{menuFooter}</div>}
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          )}
        </div>
      </div>
    </header>
  );
}
