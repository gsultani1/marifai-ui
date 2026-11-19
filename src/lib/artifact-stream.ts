// packages/ai-ui/src/lib/artifact-stream.ts
import { readArtifactPayload, type ArtifactPayload } from "./artifact-payload.js";

export type ArtifactAttributes = Record<string, string>;

export type ArtifactSegment =
  | { type: "text"; text: string }
  | { type: "artifact"; tag: string; attributes: ArtifactAttributes; content: string; complete: boolean; payload?: ArtifactPayload };

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" };

export function decodeEntities(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|apos|#39);/g, (_, name: string) => ENTITIES[name] ?? _);
}

export function parseAttributes(source: string): ArtifactAttributes {
  const attributes: ArtifactAttributes = {};
  for (const match of source.matchAll(/([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    attributes[match[1]!] = decodeEntities(match[2] ?? match[3] ?? "");
  }
  return attributes;
}

/** Removes one wrapping markdown fence, which models often add inside artifact blocks. */
export function stripFence(content: string): string {
  const trimmed = content.replace(/^\s*\n/, "").replace(/\s+$/, "");
  const match = /^```[^\n`]*\n([\s\S]*?)(?:\n```)?$/.exec(trimmed);
  return match ? match[1]! : content.trim();
}

function partialTagLength(text: string, tags: readonly string[]): number {
  const lastOpen = text.lastIndexOf("<");
  if (lastOpen === -1 || text.indexOf(">", lastOpen) !== -1) return 0;
  const fragment = text.slice(lastOpen + 1);
  if (/^\s/.test(fragment)) return 0;
  const name = fragment.replace(/^\//, "").split(/[\s>]/)[0] ?? "";
  return tags.some((tag) => tag.startsWith(name) || (fragment.length > tag.length && fragment.replace(/^\//, "").startsWith(tag)))
    ? text.length - lastOpen
    : 0;
}

/**
 * Splits model output into prose and `<artifact …>…</artifact>` blocks. An
 * unclosed block is returned with `complete: false`; with `streaming`, a
 * half-written opening tag at the end is hidden instead of shown as text.
 */
export function parseArtifactSegments(
  text: string,
  { tags = ["artifact"], streaming = false }: { tags?: readonly string[]; streaming?: boolean } = {},
): ArtifactSegment[] {
  const segments: ArtifactSegment[] = [];
  const names = tags.map((tag) => tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const open = new RegExp(`<(${names})(\\s[^>]*)?>`, "g");
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = open.exec(text))) {
    if (match.index > cursor) segments.push({ type: "text", text: text.slice(cursor, match.index) });
    const tag = match[1]!;
    const start = match.index + match[0].length;
    const end = text.indexOf(`</${tag}>`, start);
    const content = end === -1 ? text.slice(start) : text.slice(start, end);
    const attributes = parseAttributes(match[2] ?? "");
    const value = stripFence(content);
    const complete = end !== -1;
    if (complete && tag === "artifact" && ("kind" in attributes || "schema-version" in attributes)) {
      const payload = readArtifactPayload(attributes, value);
      if (payload) segments.push({ type: "artifact", tag, attributes, content: value, complete, payload });
      else segments.push({ type: "text", text: text.slice(match.index, end + tag.length + 3) });
    } else {
      segments.push({ type: "artifact", tag, attributes, content: value, complete });
    }
    cursor = end === -1 ? text.length : end + tag.length + 3;
    open.lastIndex = cursor;
  }
  if (cursor < text.length) {
    const rest = text.slice(cursor);
    const hidden = streaming ? partialTagLength(rest, tags) : 0;
    const visible = hidden ? rest.slice(0, rest.length - hidden) : rest;
    if (visible) segments.push({ type: "text", text: visible });
  }
  return segments;
}

export interface TagStreamHandlers {
  /** Prose outside any tracked tag. */
  onText?: (text: string) => void;
  onOpen?: (tag: string, attributes: ArtifactAttributes, id: number) => void;
  /** Content of the innermost open tag, delivered as it arrives. */
  onContent?: (tag: string, chunk: string, id: number) => void;
  onClose?: (tag: string, id: number, content: string) => void;
}

export interface TagStreamParser {
  push: (chunk: string) => void;
  /** Flushes buffered text and closes tags that never closed. */
  end: () => void;
}

/**
 * Incremental parser for streamed tags such as `<artifact>` and nested
 * `<action>` blocks. Tags split across chunks are buffered until complete.
 */
export function createTagStreamParser(tags: readonly string[], handlers: TagStreamHandlers): TagStreamParser {
  const stack: Array<{ tag: string; id: number; content: string }> = [];
  let buffer = "";
  let nextId = 0;
  const names = tags.map((tag) => tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const pattern = new RegExp(`<(/?)(${names})(\\s[^>]*)?>`, "g");

  const emit = (text: string) => {
    if (!text) return;
    const top = stack.at(-1);
    if (top) {
      top.content += text;
      handlers.onContent?.(top.tag, text, top.id);
    } else {
      handlers.onText?.(text);
    }
  };

  const drain = (final: boolean) => {
    pattern.lastIndex = 0;
    let cursor = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(buffer))) {
      emit(buffer.slice(cursor, match.index));
      cursor = match.index + match[0].length;
      const [, closing, tag] = match as unknown as [string, string, string];
      if (closing) {
        const index = stack.map((entry) => entry.tag).lastIndexOf(tag);
        if (index === -1) {
          emit(match[0]);
          continue;
        }
        while (stack.length > index) {
          const entry = stack.pop()!;
          handlers.onClose?.(entry.tag, entry.id, entry.content);
        }
      } else {
        const id = nextId++;
        stack.push({ tag, id, content: "" });
        handlers.onOpen?.(tag, parseAttributes(match[3] ?? ""), id);
      }
    }
    const rest = buffer.slice(cursor);
    const hold = final ? 0 : partialTagLength(rest, tags);
    emit(rest.slice(0, rest.length - hold));
    buffer = rest.slice(rest.length - hold);
  };

  return {
    push: (chunk) => {
      buffer += chunk;
      drain(false);
    },
    end: () => {
      drain(true);
      while (stack.length > 0) {
        const entry = stack.pop()!;
        handlers.onClose?.(entry.tag, entry.id, entry.content);
      }
    },
  };
}

export interface QuickAction {
  type: string;
  label: string;
  value: string;
}

/**
 * Pulls `<quick-action type="message" value="…">Label</quick-action>` chips out
 * of a reply: decoded, de-duplicated by label, length-capped and limited to
 * `max`. Returns the reply without the tags.
 */
export function extractQuickActions(
  text: string,
  { tag = "quick-action", max = 4, maxLength = 80 }: { tag?: string; max?: number; maxLength?: number } = {},
): { text: string; actions: QuickAction[] } {
  const actions: QuickAction[] = [];
  const seen = new Set<string>();
  const pattern = new RegExp(`<${tag}(\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g");
  const stripped = text.replace(pattern, (_, attributeSource: string | undefined, body: string) => {
    const attributes = parseAttributes(attributeSource ?? "");
    const label = decodeEntities(body.replace(/<[^>]*>/g, "")).trim().slice(0, maxLength);
    const key = label.toLowerCase();
    if (label && !seen.has(key) && actions.length < max) {
      seen.add(key);
      actions.push({ type: attributes.type ?? "message", label, value: (attributes.value ?? label).slice(0, 2000) });
    }
    return "";
  });
  return { text: stripped.replace(/\n{3,}/g, "\n\n").trim(), actions };
}
