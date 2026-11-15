// packages/ai-ui/src/components/app-shell.tsx
"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Tooltip } from "@base-ui/react/tooltip";
import { MenuIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, XIcon } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { focusRing, iconButton, modalBackdrop, tooltipPopup } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { usePortalContainer } from "../lib/portal.js";
import { defaultRenderLink, type RenderLink } from "./breadcrumbs.js";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon?: ReactNode;
  /** Count or short text, such as unread messages; 100 and above shows "99+". */
  badge?: number | string;
  /** Extra paths that mark this item current, or a test, for hubs whose child routes live elsewhere. */
  match?: string[] | ((path: string) => boolean);
}

export interface NavSection {
  id: string;
  label?: string;
  items: NavItem[];
}

/** Current when the path is the item's href, one of its child routes, or matches `match`. */
export function isNavItemCurrent(item: NavItem, path: string): boolean {
  const clean = path.split(/[?#]/)[0] || "/";
  const under = (href: string) => clean === href || (href !== "/" && clean.startsWith(href.endsWith("/") ? href : `${href}/`));
  if (under(item.href)) return true;
  if (typeof item.match === "function") return item.match(clean);
  return item.match?.some(under) ?? false;
}

/** The most specific current item, so "/inventory/orders" picks Orders over Inventory. */
function currentItemId(items: NavItem[], path: string): string | undefined {
  return items.filter((item) => isNavItemCurrent(item, path)).sort((a, b) => b.href.length - a.href.length)[0]?.id;
}

function badgeText(badge: number | string): string {
  return typeof badge === "number" ? (badge > 99 ? "99+" : String(badge)) : badge;
}

export interface AppShellProps {
  nav: NavSection[];
  currentPath: string;
  /** Items for the phone bottom bar; defaults to the first four. False hides the bar. */
  bottomNav?: NavItem[] | false;
  brand?: ReactNode;
  /** Top-bar content after the brand, such as search and the account menu. */
  header?: ReactNode;
  sidebarFooter?: ReactNode;
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  renderLink?: RenderLink;
  label?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Application frame: a sidebar on wide screens that collapses to an icon
 * rail with tooltips, a drawer with the same navigation on narrow screens,
 * and a bottom tab bar on phones that respects the safe area. Hubs stay
 * current on their child routes, a skip link jumps to the content, and every
 * link can render through your router.
 */
export function AppShell({ nav, currentPath, bottomNav, brand, header, sidebarFooter, collapsed, defaultCollapsed = false, onCollapsedChange, renderLink = defaultRenderLink, label = "Main", children, className }: AppShellProps) {
  const [rail, setRail] = useControllableState<boolean>({ value: collapsed, defaultValue: defaultCollapsed, onChange: onCollapsedChange });
  const [drawer, setDrawer] = useState(false);
  const container = usePortalContainer();
  const id = useId();
  const allItems = nav.flatMap((section) => section.items);
  const current = currentItemId(allItems, currentPath);
  const bottomItems = bottomNav === false ? [] : (bottomNav ?? allItems.slice(0, 4));

  const link = (item: NavItem, compact: boolean, onNavigate?: () => void) => {
    const isCurrent = item.id === current;
    const content = (
      <>
        <span className="flex size-5 shrink-0 items-center justify-center [&_svg]:size-4">{item.icon}</span>
        <span className={cn("min-w-0 flex-1 truncate", compact && "sr-only")}>{item.label}</span>
        {item.badge !== undefined && item.badge !== 0 && (
          <span className={cn("rounded-full bg-primary px-1.5 text-[10px] leading-4 font-semibold text-primary-foreground tabular-nums", compact && "absolute top-0.5 right-0.5")}>
            {badgeText(item.badge)}
            <span className="sr-only"> new</span>
          </span>
        )}
      </>
    );
    return renderLink({
      href: item.href,
      "aria-current": isCurrent ? "page" : undefined,
      ...(onNavigate ? { onClick: onNavigate } : {}),
      className: cn(
        "relative flex h-9 items-center gap-2.5 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground aria-[current=page]:bg-accent aria-[current=page]:font-medium aria-[current=page]:text-foreground",
        compact && "w-9 justify-center px-0",
        focusRing,
      ),
      children: content,
    });
  };

  const navList = (compact: boolean, onNavigate?: () => void) => (
    <div className="flex flex-col gap-4">
      {nav.map((section) => (
        <div key={section.id} className="flex flex-col gap-0.5">
          {section.label && (compact ? <span className="sr-only">{section.label}</span> : <span className="px-2 pb-1 text-xs font-medium text-muted-foreground">{section.label}</span>)}
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => (
              <li key={item.id}>
                {compact ? (
                  <Tooltip.Root>
                    <Tooltip.Trigger render={link(item, true, onNavigate)} />
                    <Tooltip.Portal container={container}>
                      <Tooltip.Positioner side="right" sideOffset={8} className="z-50">
                        <Tooltip.Popup className={tooltipPopup}>{item.label}</Tooltip.Popup>
                      </Tooltip.Positioner>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                ) : (
                  link(item, false, onNavigate)
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );

  return (
    <div data-slot="app-shell" className={cn("flex h-full min-h-0 flex-col bg-background text-foreground", className)}>
      <a href={`#${id}-main`} className={cn("sr-only rounded-md bg-background px-3 py-2 text-sm font-medium focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50", focusRing)}>
        Skip to content
      </a>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
        <button type="button" aria-label="Open navigation" aria-expanded={drawer} onClick={() => setDrawer(true)} className={cn(iconButton, "md:hidden", focusRing)}>
          <MenuIcon aria-hidden="true" />
        </button>
        <button type="button" aria-label={rail ? "Expand sidebar" : "Collapse sidebar"} aria-pressed={rail} onClick={() => setRail(!rail)} className={cn(iconButton, "max-md:hidden", focusRing)}>
          {rail ? <PanelLeftOpenIcon aria-hidden="true" /> : <PanelLeftCloseIcon aria-hidden="true" />}
        </button>
        {brand && <div className="flex min-w-0 items-center gap-2 font-semibold">{brand}</div>}
        <div className="ml-auto flex min-w-0 items-center gap-2">{header}</div>
      </header>
      <div className="flex min-h-0 flex-1">
        <nav aria-label={label} className={cn("flex shrink-0 flex-col justify-between gap-4 overflow-y-auto border-r border-border p-2 max-md:hidden", rail ? "w-14 items-center" : "w-60")}>
          {navList(rail)}
          {sidebarFooter && <div className={cn(rail && "flex flex-col items-center")}>{sidebarFooter}</div>}
        </nav>
        <main id={`${id}-main`} tabIndex={-1} className="min-h-0 min-w-0 flex-1 overflow-y-auto outline-none">
          {children}
        </main>
      </div>
      {bottomItems.length > 0 && (
        <nav aria-label={`${label}, tabs`} className="shrink-0 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] sm:hidden">
          <ul className="flex">
            {bottomItems.map((item) => (
              <li key={item.id} className="flex-1">
                {renderLink({
                  href: item.href,
                  "aria-current": item.id === current ? "page" : undefined,
                  className: cn("relative flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] text-muted-foreground aria-[current=page]:font-medium aria-[current=page]:text-foreground [&_svg]:size-5", focusRing, "focus-visible:ring-inset"),
                  children: (
                    <>
                      {item.icon}
                      <span className="max-w-full truncate px-1">{item.label}</span>
                      {item.badge !== undefined && item.badge !== 0 && (
                        <span className="absolute top-2 left-1/2 ml-2 rounded-full bg-primary px-1.5 text-[10px] leading-4 font-semibold text-primary-foreground">
                          {badgeText(item.badge)}
                          <span className="sr-only"> new</span>
                        </span>
                      )}
                    </>
                  ),
                })}
              </li>
            ))}
          </ul>
        </nav>
      )}
      <Dialog.Root open={drawer} onOpenChange={setDrawer}>
        <Dialog.Portal container={container}>
          <Dialog.Backdrop className={cn(modalBackdrop, "md:hidden")} />
          <Dialog.Popup className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col gap-4 border-r border-border bg-background p-3 shadow-xl transition-transform data-[ending-style]:-translate-x-full data-[starting-style]:-translate-x-full motion-reduce:transition-none md:hidden">
            <div className="flex items-center justify-between">
              <Dialog.Title className="font-semibold">{brand ?? "Navigation"}</Dialog.Title>
              <Dialog.Close aria-label="Close navigation" className={cn(iconButton, focusRing)}>
                <XIcon aria-hidden="true" />
              </Dialog.Close>
            </div>
            <nav aria-label={label} className="flex flex-1 flex-col justify-between gap-4 overflow-y-auto">
              {navList(false, () => setDrawer(false))}
              {sidebarFooter}
            </nav>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
