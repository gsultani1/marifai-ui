// packages/ai-ui/src/hooks/use-autosize-textarea.ts
import { type RefObject, useEffect, useLayoutEffect } from "react";

export interface UseAutosizeTextareaOptions {
  minRows?: number;
  maxRows?: number;
}

export function useAutosizeTextarea(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  { minRows = 1, maxRows = 8 }: UseAutosizeTextareaOptions = {},
): void {
  useLayoutEffect(() => {
    if (ref.current) resizeTextarea(ref.current, minRows, maxRows);
  }, [ref, value, minRows, maxRows]);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    let width = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth === width) return;
      width = element.clientWidth;
      resizeTextarea(element, minRows, maxRows);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, minRows, maxRows]);
}

function resizeTextarea(element: HTMLTextAreaElement, minRows: number, maxRows: number): void {
  const style = getComputedStyle(element);
  const fontSize = parseFloat(style.fontSize) || 16;
  const lineHeight = parseFloat(style.lineHeight) || fontSize * 1.5;
  const padding = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
  const border = (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0);
  const min = lineHeight * minRows + padding + border;
  const max = lineHeight * maxRows + padding + border;
  element.style.height = "auto";
  const content = element.scrollHeight + border;
  element.style.height = `${Math.min(Math.max(content, min), max)}px`;
  element.style.overflowY = content > max ? "auto" : "hidden";
}
