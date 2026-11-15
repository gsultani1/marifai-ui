// packages/ai-ui/src/components/surface-state.tsx
"use client";

import { CircleAlertIcon, InboxIcon, LockIcon, RotateCwIcon, SearchXIcon, WifiOffIcon } from "lucide-react";
import { Component, type ComponentProps, type ErrorInfo, type ReactNode, Suspense, useState } from "react";

import { button, buttonVariants, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export type SurfaceKind = "loading" | "empty" | "no-results" | "error" | "offline" | "permission";

const DEFAULTS: Record<SurfaceKind, { title: string; description?: string; icon?: ReactNode }> = {
  loading: { title: "Loading" },
  empty: { title: "Nothing here yet", icon: <InboxIcon aria-hidden="true" /> },
  "no-results": {
    title: "No matches",
    description: "Try a different search or clear the filters.",
    icon: <SearchXIcon aria-hidden="true" />,
  },
  error: { title: "Something went wrong", description: "This could not be loaded.", icon: <CircleAlertIcon aria-hidden="true" /> },
  offline: { title: "You are offline", description: "This will load when the connection returns.", icon: <WifiOffIcon aria-hidden="true" /> },
  permission: { title: "You do not have access", description: "Ask an owner to share it with you.", icon: <LockIcon aria-hidden="true" /> },
};

export interface SkeletonProps extends ComponentProps<"div"> {
  /** Number of text lines; the last one is shorter. */
  lines?: number;
}

/** Placeholder bars for content that is still loading. Hidden from assistive technology. */
export function Skeleton({ lines = 3, className, ...props }: SkeletonProps) {
  return (
    <div aria-hidden="true" data-slot="skeleton" className={cn("flex w-full flex-col gap-2", className)} {...props}>
      {Array.from({ length: lines }, (_, index) => (
        <div
          key={index}
          className={cn("h-3 rounded-full bg-muted motion-safe:animate-pulse", index === lines - 1 && lines > 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}

export interface SurfaceStateProps extends Omit<ComponentProps<"div">, "title"> {
  kind: SurfaceKind;
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  /** Shows "Try again" for error and offline states. */
  onRetry?: () => void;
  /** Extra actions, e.g. "Request access" or "Clear filters". */
  actions?: ReactNode;
  /**
   * Content from the last successful load. With "loading" it stays visible and
   * marked busy; with "error" or "offline" it stays visible under a notice.
   */
  children?: ReactNode;
}

/**
 * One component for every non-ideal state of a panel: loading, empty, no
 * results, error, offline and no permission, keeping stale content visible
 * when a refresh fails.
 */
export function SurfaceState({
  kind,
  title,
  description,
  icon,
  onRetry,
  actions,
  className,
  children,
  ...props
}: SurfaceStateProps) {
  const defaults = DEFAULTS[kind];
  const retry = onRetry && (kind === "error" || kind === "offline") && (
    <button type="button" onClick={onRetry} className={cn(button, buttonVariants.outline, focusRing)}>
      <RotateCwIcon aria-hidden="true" />
      Try again
    </button>
  );

  if (children !== undefined && kind !== "empty" && kind !== "no-results" && kind !== "permission") {
    if (kind === "loading") {
      return (
        <div aria-busy="true" data-slot="surface-state" data-kind={kind} className={cn("relative", className)} {...props}>
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-muted">
            <div className="h-full w-1/3 bg-ring motion-safe:animate-pulse" />
          </div>
          {children}
        </div>
      );
    }
    return (
      <div data-slot="surface-state" data-kind={kind} className={cn("flex flex-col gap-2", className)} {...props}>
        <div
          role="status"
          className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-sm"
        >
          <span className="text-muted-foreground [&_svg]:size-4">{icon ?? defaults.icon}</span>
          <span className="min-w-0 flex-1">
            {title ?? (kind === "offline" ? "Offline. Showing the last loaded data." : "Could not refresh. Showing the last loaded data.")}
          </span>
          {retry}
        </div>
        {children}
      </div>
    );
  }

  if (kind === "loading") {
    return (
      <div role="status" data-slot="surface-state" data-kind={kind} className={cn("flex flex-col gap-3 p-4", className)} {...props}>
        <span className="sr-only">{title ?? defaults.title}</span>
        <Skeleton />
      </div>
    );
  }

  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      data-slot="surface-state"
      data-kind={kind}
      className={cn("flex flex-col items-center justify-center gap-2 p-8 text-center", className)}
      {...props}
    >
      {(icon ?? defaults.icon) && <div className="text-muted-foreground [&_svg]:size-7">{icon ?? defaults.icon}</div>}
      <p className="font-medium">{title ?? defaults.title}</p>
      {(description ?? defaults.description) && (
        <p className="max-w-sm text-sm text-muted-foreground">{description ?? defaults.description}</p>
      )}
      {(retry || actions) && (
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {retry}
          {actions}
        </div>
      )}
    </div>
  );
}

interface BoundaryProps {
  resetKey: number;
  onError?: ((error: unknown, info: ErrorInfo) => void) | undefined;
  fallback: (error: unknown) => ReactNode;
  children: ReactNode;
}

class SurfaceErrorBoundary extends Component<BoundaryProps, { error: unknown; key: number }> {
  override state = { error: null as unknown, key: this.props.resetKey };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  static getDerivedStateFromProps(props: BoundaryProps, state: { error: unknown; key: number }) {
    return props.resetKey === state.key ? null : { error: null, key: props.resetKey };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  override render() {
    return this.state.error ? this.props.fallback(this.state.error) : this.props.children;
  }
}

export interface DeferredSurfaceProps {
  children: ReactNode;
  /** Shown while lazy children suspend; a skeleton by default. */
  fallback?: ReactNode;
  errorTitle?: ReactNode;
  onError?: (error: unknown, info: ErrorInfo) => void;
  className?: string;
}

/**
 * Suspense plus an error boundary for lazily loaded panels: shows a skeleton
 * while loading and an error with "Try again" that remounts the children.
 */
export function DeferredSurface({ children, fallback, errorTitle = "This panel could not load", onError, className }: DeferredSurfaceProps) {
  const [attempt, setAttempt] = useState(0);
  return (
    <SurfaceErrorBoundary
      resetKey={attempt}
      onError={onError}
      fallback={() => (
        <SurfaceState kind="error" title={errorTitle} onRetry={() => setAttempt((count) => count + 1)} className={className} />
      )}
    >
      <Suspense key={attempt} fallback={fallback ?? <SurfaceState kind="loading" className={className} />}>
        {children}
      </Suspense>
    </SurfaceErrorBoundary>
  );
}
