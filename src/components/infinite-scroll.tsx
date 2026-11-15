// packages/ai-ui/src/components/infinite-scroll.tsx
"use client";

import { LoaderCircleIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, type RefObject, useEffect, useRef, useState } from "react";

import { button, buttonVariants, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { SurfaceState } from "./surface-state.js";

export interface InfiniteScrollProps extends Omit<ComponentProps<"div">, "children"> {
  /** The items loaded so far. */
  children: ReactNode;
  /** Loads the next page. Return a promise so duplicate calls are blocked until it settles and failures show a retry. */
  onLoadMore: () => Promise<unknown> | void;
  /** Whether more pages exist. */
  hasMore: boolean;
  /** Loading state tracked by the parent, for an `onLoadMore` that does not return a promise. */
  loading?: boolean;
  /** Scroll container to watch; defaults to the viewport. */
  scrollRoot?: RefObject<HTMLElement | null>;
  /** How early to load, as an IntersectionObserver root margin. */
  rootMargin?: string;
  /** Text of the fallback button, such as "Load more orders". */
  loadMoreLabel?: string;
  loadingLabel?: string;
  /** Shown after the last page. */
  endMessage?: ReactNode;
  errorTitle?: ReactNode;
}

/**
 * Loads the next page when a sentinel below the items scrolls into view.
 * Calls are blocked while a returned promise is pending, a failure shows an
 * error with "Try again", and a visible "Load more" button covers keyboard
 * users and browsers without IntersectionObserver. The end of the list
 * shows a message and keeps focus in place.
 */
export function InfiniteScroll({
  children,
  onLoadMore,
  hasMore,
  loading = false,
  scrollRoot,
  rootMargin = "320px",
  loadMoreLabel = "Load more",
  loadingLabel = "Loading more",
  endMessage = "You have reached the end.",
  errorTitle = "Could not load more",
  className,
  ...props
}: InfiniteScrollProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string>("");
  const pending = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLParagraphElement>(null);
  const buttonFocused = useRef(false);
  const latest = useRef({ onLoadMore, hasMore, loading });
  const busy = status === "loading" || loading;

  useEffect(() => {
    latest.current = { onLoadMore, hasMore, loading };
  }, [onLoadMore, hasMore, loading]);

  const load = () => {
    if (pending.current || !latest.current.hasMore || latest.current.loading) return;
    let result: Promise<unknown> | void;
    try {
      result = latest.current.onLoadMore();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("error");
      return;
    }
    if (!result || typeof result.then !== "function") return;
    pending.current = true;
    setStatus("loading");
    result.then(
      () => {
        pending.current = false;
        setStatus("idle");
      },
      (caught: unknown) => {
        pending.current = false;
        setError(caught instanceof Error ? caught.message : String(caught));
        setStatus("error");
      },
    );
  };
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    const target = sentinel.current;
    if (!target || !hasMore || busy || status === "error" || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadRef.current();
      },
      { root: scrollRoot?.current ?? null, rootMargin },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, busy, status, rootMargin, scrollRoot]);

  useEffect(() => {
    if (!hasMore && buttonFocused.current) {
      buttonFocused.current = false;
      endRef.current?.focus();
    }
  }, [hasMore]);

  return (
    <div data-slot="infinite-scroll" aria-busy={busy || undefined} className={cn("flex flex-col", className)} {...props}>
      {children}
      <div data-slot="infinite-scroll-footer" className="flex flex-col items-center gap-2 py-3">
        {status === "error" && hasMore ? (
          <SurfaceState
            kind="error"
            title={errorTitle}
            description={error || undefined}
            onRetry={() => {
              setStatus("idle");
              load();
            }}
            className="p-3"
          />
        ) : hasMore ? (
          <button
            type="button"
            aria-disabled={busy || undefined}
            onClick={() => {
              if (!busy) load();
            }}
            onFocus={() => {
              buttonFocused.current = true;
            }}
            onBlur={() => {
              buttonFocused.current = false;
            }}
            className={cn(button, buttonVariants.outline, focusRing)}
          >
            {busy && <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" />}
            {busy ? loadingLabel : loadMoreLabel}
          </button>
        ) : (
          <p ref={endRef} tabIndex={-1} className="text-sm text-muted-foreground outline-none">
            {endMessage}
          </p>
        )}
        <div ref={sentinel} aria-hidden="true" className="h-px w-full" />
      </div>
      <div role="status" className="sr-only">
        {busy ? loadingLabel : ""}
      </div>
    </div>
  );
}
