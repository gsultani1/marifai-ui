// packages/ai-ui/src/hooks/use-install-prompt.ts
import { useCallback, useSyncExternalStore } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallPlatform = "prompt" | "ios" | "unsupported";

export interface InstallPromptState {
  /** "prompt" when the browser offered installation, "ios" for Safari's manual Add to Home Screen. */
  platform: InstallPlatform;
  installed: boolean;
  /** Shows the browser's install dialog; resolves with the user's choice. */
  install: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installedNow = false;
let listening = false;
const listeners = new Set<() => void>();
let version = 0;

function notify() {
  version++;
  for (const listener of listeners) listener();
}

/**
 * Starts listening for the browser's install offer. Call it early, such as
 * in your entry module, if the install UI mounts after the page loads;
 * `useInstallPrompt` calls it too.
 */
export function captureInstallPrompt(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installedNow = true;
    notify();
  });
}

function subscribe(listener: () => void) {
  captureInstallPrompt();
  listeners.add(listener);
  const media = window.matchMedia?.("(display-mode: standalone)");
  media?.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    media?.removeEventListener("change", listener);
  };
}

function isStandalone(): boolean {
  return Boolean(window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone);
}

/** iPhone, iPod and iPad, including iPadOS, which reports itself as a Mac with touch. */
export function isIosDevice(userAgent: string, maxTouchPoints: number): boolean {
  return /iphone|ipad|ipod/i.test(userAgent) || (/macintosh/i.test(userAgent) && maxTouchPoints > 1);
}

function snapshot(): string {
  const installed = installedNow || isStandalone();
  const platform: InstallPlatform = deferred ? "prompt" : isIosDevice(navigator.userAgent, navigator.maxTouchPoints ?? 0) ? "ios" : "unsupported";
  return `${platform}|${installed}|${version}`;
}

/** Install state for a PWA: the deferred browser prompt, iOS manual install, and whether it already runs installed. */
export function useInstallPrompt(): InstallPromptState {
  const key = useSyncExternalStore(subscribe, snapshot, () => "unsupported|false|0");
  const [platform, installed] = key.split("|") as [InstallPlatform, string];
  const install = useCallback(async () => {
    if (!deferred) return "unavailable" as const;
    const event = deferred;
    deferred = null;
    await event.prompt();
    const { outcome } = await event.userChoice;
    notify();
    return outcome;
  }, []);
  return { platform, installed: installed === "true", install };
}
