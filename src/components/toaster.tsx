// packages/ai-ui/src/components/toaster.tsx
"use client";

import { CircleAlertIcon, CircleCheckIcon, InfoIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import { button, buttonVariants, focusRing, iconButton, type Tone, toneIcon } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

const DEFAULT_TIMEOUT_MS = 5000;
const ERROR_TIMEOUT_MS = 7000;

const TONE_ICONS: Record<Tone, ReactNode> = {
  neutral: null,
  info: <InfoIcon aria-hidden="true" />,
  success: <CircleCheckIcon aria-hidden="true" />,
  warning: <TriangleAlertIcon aria-hidden="true" />,
  danger: <CircleAlertIcon aria-hidden="true" />,
};

export interface ToastOptions {
  title?: ReactNode;
  description?: ReactNode;
  tone?: Tone;
  /** Milliseconds before auto-dismiss; 0 keeps it open. Errors default to 7s. */
  timeout?: number;
  /** One action button, e.g. "View" or "Retry". Clicking it also closes the toast. */
  action?: { label: string; onClick: () => void };
  /** Reusing an id updates that toast in place instead of stacking a new one. */
  id?: string;
  /** Runs once when the toast closes for any reason. */
  onClose?: () => void;
}

export interface UndoToastOptions extends Omit<ToastOptions, "action" | "tone" | "onClose"> {
  /** Runs when the toast closes without Undo, so the change happens only then. */
  onCommit: () => void;
  onUndo?: () => void;
  undoLabel?: string;
}

export interface ToastApi {
  toast: (options: ToastOptions) => string;
  /** Shows a toast with Undo and calls `onCommit` only if the user lets it close. */
  undoable: (options: UndoToastOptions) => string;
  /** Closes one toast, or all of them without an id. */
  dismiss: (id?: string) => void;
}

interface ToastRecord extends Omit<ToastOptions, "id"> {
  id: string;
  tone: Tone;
  timeout: number;
}

export interface ToastManager extends ToastApi {
  subscribe: (listener: () => void) => () => void;
  getToasts: () => readonly ToastRecord[];
}

let toastCounter = 0;

/** Creates a toast queue that can be used outside React; pass it to `<Toaster manager>`. */
export function createToastManager(): ToastManager {
  let toasts: readonly ToastRecord[] = [];
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());

  const close = (id?: string) => {
    const closing = id === undefined ? toasts : toasts.filter((toast) => toast.id === id);
    if (closing.length === 0) return;
    toasts = id === undefined ? [] : toasts.filter((toast) => toast.id !== id);
    emit();
    closing.forEach((toast) => toast.onClose?.());
  };

  const add = ({ id, tone = "neutral", timeout, ...options }: ToastOptions) => {
    const toastId = id ?? `toast-${++toastCounter}`;
    const record: ToastRecord = {
      ...options,
      id: toastId,
      tone,
      timeout: timeout ?? (tone === "danger" ? ERROR_TIMEOUT_MS : DEFAULT_TIMEOUT_MS),
    };
    toasts = toasts.some((toast) => toast.id === toastId)
      ? toasts.map((toast) => (toast.id === toastId ? record : toast))
      : [...toasts, record];
    emit();
    return toastId;
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getToasts: () => toasts,
    toast: add,
    undoable: ({ onCommit, onUndo, undoLabel = "Undo", ...options }) => {
      let undone = false;
      return add({
        ...options,
        action: {
          label: undoLabel,
          onClick: () => {
            undone = true;
            onUndo?.();
          },
        },
        onClose: () => {
          if (!undone) onCommit();
        },
      });
    },
    dismiss: close,
  };
}

/** Kept for symmetry with older releases; a manager already exposes the toast API. */
export function bindToastManager(manager: ToastManager): ToastApi {
  return { toast: manager.toast, undoable: manager.undoable, dismiss: manager.dismiss };
}

const ToastContext = createContext<ToastManager | null>(null);

/** Toast helpers bound to the nearest `<Toaster>`. */
export function useToast(): ToastApi {
  const manager = use(ToastContext);
  if (!manager) throw new Error("useToast must be used inside <Toaster>.");
  return useMemo(() => bindToastManager(manager), [manager]);
}

export interface ToasterProps {
  children?: ReactNode;
  manager?: ToastManager;
  /** Most toasts visible at once; older ones wait their turn. */
  limit?: number;
  className?: string;
}

/**
 * Renders queued toasts in one live region at the bottom corner. Errors are
 * announced assertively, others politely. F6 moves focus into the region,
 * Escape dismisses the focused toast, and timers pause while the pointer or
 * focus is inside.
 */
export function Toaster({ children, manager: managerProp, limit = 3, className }: ToasterProps) {
  const [ownManager] = useState(createToastManager);
  const manager = managerProp ?? ownManager;
  const toasts = useSyncExternalStore(manager.subscribe, manager.getToasts, manager.getToasts);
  const [paused, setPaused] = useState(false);
  const regionRef = useRef<HTMLElement>(null);
  const [mounted, setMounted] = useState(false);
  const visible = toasts.slice(0, limit);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (visible.length === 0) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "F6" || event.defaultPrevented) return;
      event.preventDefault();
      regionRef.current?.querySelector<HTMLElement>("[data-slot='toast']")?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible.length]);

  const region = (
    <section
      ref={regionRef}
      aria-label="Notifications"
      data-slot="toaster"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
      className={cn("pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2", className)}
    >
      <div aria-live="polite" aria-relevant="additions text" className="flex flex-col gap-2">
        {visible.map((toast) => (
          <ToastItem key={toast.id} toast={toast} paused={paused} dismiss={manager.dismiss} />
        ))}
      </div>
    </section>
  );

  return (
    <ToastContext value={manager}>
      {children}
      {mounted && createPortal(region, document.body)}
    </ToastContext>
  );
}

interface ToastItemProps {
  toast: ToastRecord;
  paused: boolean;
  dismiss: (id: string) => void;
}

function ToastItem({ toast, paused, dismiss }: ToastItemProps) {
  const remaining = useRef(toast.timeout);
  const startedAt = useRef(0);
  const { id } = toast;
  const onClose = useCallback(() => dismiss(id), [dismiss, id]);

  useEffect(() => {
    remaining.current = toast.timeout;
  }, [toast.timeout]);

  useEffect(() => {
    if (toast.timeout <= 0 || paused) return;
    startedAt.current = Date.now();
    const timer = setTimeout(onClose, remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
    };
  }, [paused, toast.timeout, onClose]);

  return (
    <div
      role={toast.tone === "danger" ? "alert" : undefined}
      tabIndex={-1}
      data-slot="toast"
      data-tone={toast.tone}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        onClose();
      }}
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {TONE_ICONS[toast.tone] && (
        <span className={cn("mt-0.5 shrink-0 [&_svg]:size-4", toneIcon[toast.tone])}>{TONE_ICONS[toast.tone]}</span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
        {toast.title && <p className="font-medium">{toast.title}</p>}
        {toast.description && <p className="text-muted-foreground">{toast.description}</p>}
      </div>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick();
            onClose();
          }}
          className={cn(button, buttonVariants.outline, "h-7 px-2.5", focusRing)}
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" aria-label="Dismiss notification" onClick={onClose} className={cn(iconButton, "-my-1 -mr-1 size-7", focusRing)}>
        <XIcon aria-hidden="true" />
      </button>
    </div>
  );
}
