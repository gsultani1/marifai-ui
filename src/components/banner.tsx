// packages/ai-ui/src/components/banner.tsx
"use client";

import { CircleAlertIcon, CircleCheckIcon, InfoIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useState, useSyncExternalStore } from "react";

import { focusRing, iconButton, type Tone, toneIcon, toneSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

const TONE_ICONS: Record<Tone, ReactNode> = {
  neutral: <InfoIcon aria-hidden="true" />,
  info: <InfoIcon aria-hidden="true" />,
  success: <CircleCheckIcon aria-hidden="true" />,
  warning: <TriangleAlertIcon aria-hidden="true" />,
  danger: <CircleAlertIcon aria-hidden="true" />,
};

const DISMISS_PREFIX = "ai-ui:banner:";

function readDismissed(key: string | undefined): boolean {
  if (!key) return false;
  try {
    return window.sessionStorage.getItem(DISMISS_PREFIX + key) === "1";
  } catch {
    return false;
  }
}

const DISMISS_EVENT = "ai-ui:banner-dismissed";

function writeDismissed(key: string | undefined): void {
  if (!key) return;
  try {
    window.sessionStorage.setItem(DISMISS_PREFIX + key, "1");
  } catch {
    return;
  }
  window.dispatchEvent(new Event(DISMISS_EVENT));
}

function subscribeDismissed(onChange: () => void): () => void {
  window.addEventListener(DISMISS_EVENT, onChange);
  return () => window.removeEventListener(DISMISS_EVENT, onChange);
}

export interface BannerProps extends Omit<ComponentProps<"div">, "title"> {
  tone?: Tone;
  title?: ReactNode;
  /** Replaces the tone's icon; pass `null` for none. */
  icon?: ReactNode;
  /** Buttons or links shown at the end, e.g. "Open in new tab" or "Retry". */
  actions?: ReactNode;
  /** Shows a close button. */
  onDismiss?: () => void;
  /** Remembers the dismissal for this browser session under this key. */
  dismissKey?: string;
}

/**
 * Inline notice for compatibility warnings, offline state, truncated output
 * and similar. Danger banners use role="alert" so they are announced.
 */
export function Banner({
  tone = "info",
  title,
  icon,
  actions,
  onDismiss,
  dismissKey,
  className,
  children,
  ...props
}: BannerProps) {
  const [hidden, setHidden] = useState(false);
  const remembered = useSyncExternalStore(
    subscribeDismissed,
    () => readDismissed(dismissKey),
    () => false,
  );
  if (hidden || remembered) return null;
  const dismissible = Boolean(onDismiss || dismissKey);

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      data-slot="banner"
      data-tone={tone}
      className={cn("flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm", toneSurface[tone], className)}
      {...props}
    >
      {icon !== null && (
        <span className={cn("mt-0.5 shrink-0 [&_svg]:size-4", toneIcon[tone])}>{icon ?? TONE_ICONS[tone]}</span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="text-foreground/90">{children}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      {dismissible && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            setHidden(true);
            writeDismissed(dismissKey);
            onDismiss?.();
          }}
          className={cn(iconButton, "-my-1 -mr-1 size-7", focusRing)}
        >
          <XIcon aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
