// packages/ai-ui/src/components/install-prompt.tsx
"use client";

import { DownloadIcon, ShareIcon, SquarePlusIcon, XIcon } from "lucide-react";
import { type ReactNode, useState, useSyncExternalStore } from "react";

import { useInstallPrompt } from "../hooks/use-install-prompt.js";
import { button, buttonVariants, card, focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export interface InstallPromptProps {
  appName: string;
  description?: ReactNode;
  icon?: ReactNode;
  /** Remembers a dismissal under this key for `dismissForMs` (30 days by default). */
  dismissKey?: string;
  dismissForMs?: number;
  onInstalled?: () => void;
  className?: string;
}

const MONTH = 30 * 24 * 60 * 60 * 1000;
const noopSubscribe = () => () => undefined;

function readDismissed(key: string | undefined): number {
  if (!key) return 0;
  try {
    return Number(window.localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

/**
 * Invitation to install the app: a button where the browser offers
 * installation, step-by-step Add to Home Screen instructions on iPhone and
 * iPad, and nothing once installed or after a dismissal (30 days by default).
 */
export function InstallPrompt({ appName, description, icon, dismissKey, dismissForMs = MONTH, onInstalled, className }: InstallPromptProps) {
  const { platform, installed, install } = useInstallPrompt();
  const dismissedAt = useSyncExternalStore(noopSubscribe, () => readDismissed(dismissKey), () => 0);
  const [hidden, setHidden] = useState(false);
  const [mountedAt] = useState(() => Date.now());

  if (installed || platform === "unsupported" || hidden || (dismissedAt && mountedAt - dismissedAt < dismissForMs)) return null;

  const dismiss = () => {
    if (dismissKey) {
      try {
        window.localStorage.setItem(dismissKey, String(Date.now()));
      } catch {
        // Dismissal lasts until reload without storage.
      }
    }
    setHidden(true);
  };

  return (
    <section aria-label={`Install ${appName}`} className={cn(card, "flex items-start gap-3 p-3", className)}>
      {icon && <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted [&_img]:size-full">{icon}</div>}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
        <p className="font-medium">Install {appName}</p>
        {description && <p className="text-muted-foreground">{description}</p>}
        {platform === "ios" ? (
          <ol className="flex flex-col gap-1 text-muted-foreground">
            <li className="flex items-center gap-1.5">
              1. Tap <ShareIcon aria-hidden="true" className="size-4 text-foreground" /> <span className="font-medium text-foreground">Share</span> in Safari's toolbar.
            </li>
            <li className="flex items-center gap-1.5">
              2. Choose <SquarePlusIcon aria-hidden="true" className="size-4 text-foreground" /> <span className="font-medium text-foreground">Add to Home Screen</span>.
            </li>
          </ol>
        ) : (
          <button
            type="button"
            onClick={() =>
              void install().then((outcome) => {
                if (outcome === "accepted") onInstalled?.();
              })
            }
            className={cn(button, buttonVariants.primary, "self-start", focusRing)}
          >
            <DownloadIcon aria-hidden="true" />
            Install
          </button>
        )}
      </div>
      <button type="button" aria-label="Not now" onClick={dismiss} className={cn(iconButton, focusRing)}>
        <XIcon aria-hidden="true" />
      </button>
    </section>
  );
}
