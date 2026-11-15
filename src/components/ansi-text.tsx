// packages/ai-ui/src/components/ansi-text.tsx
import type { CSSProperties, ReactNode } from "react";

import { type AnsiSegment, applyCarriageReturns, parseAnsi } from "../lib/ansi.js";

function segmentStyle(segment: AnsiSegment): CSSProperties | undefined {
  const fg = segment.fg ?? (segment.dim ? "var(--ansi-white)" : undefined);
  const color = segment.inverse ? (segment.bg ?? "var(--code-background)") : fg;
  const background = segment.inverse ? (fg ?? "var(--code-foreground)") : segment.bg;
  const decoration = [segment.underline && "underline", segment.strike && "line-through"].filter(Boolean).join(" ");
  if (!color && !background && !segment.bold && !segment.italic && !decoration) return undefined;
  return {
    ...(color ? { color } : {}),
    ...(background ? { backgroundColor: background } : {}),
    ...(segment.bold ? { fontWeight: 600 } : {}),
    ...(segment.italic ? { fontStyle: "italic" } : {}),
    ...(decoration ? { textDecorationLine: decoration } : {}),
  };
}

export interface AnsiTextProps {
  /** Text with ANSI escape sequences. */
  text: string;
  /** Wraps matches of this text in <mark>, case-insensitively. */
  highlight?: string;
}

function highlightText(text: string, query: string | undefined, key: string): ReactNode {
  if (!query) return text;
  const lower = text.toLowerCase();
  const needle = query.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (let index = lower.indexOf(needle); index !== -1; index = lower.indexOf(needle, index + needle.length)) {
    parts.push(text.slice(cursor, index));
    parts.push(
      <mark key={`${key}-${index}`} className="rounded-sm bg-warning/30 text-inherit">
        {text.slice(index, index + needle.length)}
      </mark>,
    );
    cursor = index + needle.length;
  }
  parts.push(text.slice(cursor));
  return parts;
}

/** Renders terminal output with its colors and styles as spans; carriage returns redraw the line. */
export function AnsiText({ text, highlight }: AnsiTextProps) {
  return (
    <>
      {parseAnsi(applyCarriageReturns(text)).map((segment, index) => {
        const style = segmentStyle(segment);
        const content = highlightText(segment.text, highlight, String(index));
        return style ? (
          <span key={index} style={style}>
            {content}
          </span>
        ) : (
          <span key={index}>{content}</span>
        );
      })}
    </>
  );
}
