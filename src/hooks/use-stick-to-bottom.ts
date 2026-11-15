// packages/ai-ui/src/hooks/use-stick-to-bottom.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface UseStickToBottomOptions {
  /** Distance in pixels from the bottom that still counts as "at the bottom". */
  threshold?: number;
  /** Starts pinned to the bottom. Pass false to keep a restored scroll position. */
  initialFollow?: boolean;
}

export interface UseStickToBottomResult {
  scrollRef: (element: HTMLElement | null) => void;
  contentRef: (element: HTMLElement | null) => void;
  scrollElement: HTMLElement | null;
  isAtBottom: boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
}

const RELEASE_KEYS = new Set(["ArrowUp", "PageUp", "Home"]);

/**
 * Keeps a scroll container pinned to the bottom while its content grows and
 * releases the pin as soon as the user scrolls up (wheel, touch, keyboard or
 * scrollbar). Scrolling back to the bottom re-engages it.
 */
export function useStickToBottom({
  threshold = 64,
  initialFollow = true,
}: UseStickToBottomOptions = {}): UseStickToBottomResult {
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  const [contentElement, setContentElement] = useState<HTMLElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(initialFollow);
  const following = useRef(initialFollow);
  const touching = useRef(false);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      if (!scrollElement) return;
      following.current = true;
      setIsAtBottom(true);
      scrollElement.scrollTo({ top: scrollElement.scrollHeight, behavior });
    },
    [scrollElement],
  );

  useEffect(() => {
    const element = scrollElement;
    if (!element) return;
    let lastScrollTop = element.scrollTop;
    const distance = () => element.scrollHeight - element.scrollTop - element.clientHeight;
    const scrollable = () => element.scrollHeight > element.clientHeight;

    const onScroll = () => {
      const atBottom = distance() <= threshold;
      if (atBottom) following.current = true;
      else if (element.scrollTop < lastScrollTop - 1) following.current = false;
      lastScrollTop = element.scrollTop;
      setIsAtBottom(atBottom);
    };
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY < 0 && scrollable()) following.current = false;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const releases = RELEASE_KEYS.has(event.key) || (event.key === " " && event.shiftKey);
      if (releases && !isEditable(event.target) && scrollable()) following.current = false;
    };
    const onTouchStart = () => {
      touching.current = true;
    };
    const onTouchEnd = () => {
      touching.current = false;
      following.current = distance() <= threshold;
    };

    element.addEventListener("scroll", onScroll, { passive: true });
    element.addEventListener("wheel", onWheel, { passive: true });
    element.addEventListener("keydown", onKeyDown);
    element.addEventListener("touchstart", onTouchStart, { passive: true });
    element.addEventListener("touchend", onTouchEnd, { passive: true });
    element.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      element.removeEventListener("scroll", onScroll);
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("keydown", onKeyDown);
      element.removeEventListener("touchstart", onTouchStart);
      element.removeEventListener("touchend", onTouchEnd);
      element.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [scrollElement, threshold]);

  useEffect(() => {
    const element = scrollElement;
    if (!element) return;
    const update = () => {
      if (following.current && !touching.current) {
        element.scrollTo({ top: element.scrollHeight, behavior: "instant" });
        return;
      }
      setIsAtBottom(element.scrollHeight - element.scrollTop - element.clientHeight <= threshold);
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (contentElement) observer.observe(contentElement);
    return () => observer.disconnect();
  }, [scrollElement, contentElement, threshold]);

  return useMemo(
    () => ({ scrollRef: setScrollElement, contentRef: setContentElement, scrollElement, isAtBottom, scrollToBottom }),
    [scrollElement, isAtBottom, scrollToBottom],
  );
}

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")
  );
}
