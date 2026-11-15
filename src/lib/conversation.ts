// packages/ai-ui/src/lib/conversation.ts
import { isSameDay, startOfDay, toDate } from "./dates.js";

export interface DatedItem {
  updatedAt: Date | string | number;
}

export interface DateGroup<T> {
  label: string;
  items: T[];
}

/** Buckets items by last activity: Today, Yesterday, Previous 7 days, Previous 30 days, then by month. Items keep their order. */
export function groupByRecency<T extends DatedItem>(items: T[], now: Date | number = Date.now(), locale?: string): DateGroup<T>[] {
  const today = startOfDay(now).getTime();
  const day = 24 * 60 * 60 * 1000;
  const month = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
  const groups: DateGroup<T>[] = [];
  for (const item of items) {
    const time = toDate(item.updatedAt).getTime();
    const label = time >= today ? "Today" : time >= today - day ? "Yesterday" : time >= today - 7 * day ? "Previous 7 days" : time >= today - 30 * day ? "Previous 30 days" : month.format(time);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(item);
    else {
      const existing = groups.find((group) => group.label === label);
      if (existing) existing.items.push(item);
      else groups.push({ label, items: [item] });
    }
  }
  return groups;
}

/** "Today", "Yesterday", a weekday within the week, or a full date. */
export function formatDayLabel(value: Date | string | number, now: Date | number = Date.now(), locale?: string): string {
  const date = toDate(value);
  if (isSameDay(date, now)) return "Today";
  const yesterday = new Date(startOfDay(now).getTime() - 12 * 60 * 60 * 1000);
  if (isSameDay(date, yesterday)) return "Yesterday";
  const days = (startOfDay(now).getTime() - startOfDay(date).getTime()) / (24 * 60 * 60 * 1000);
  if (days > 0 && days < 7) return new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date);
  return new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric", ...(toDate(now).getFullYear() === date.getFullYear() ? {} : { year: "numeric" }) }).format(date);
}

export interface GroupableMessage {
  id: string;
  /** Who sent it; consecutive messages from the same sender within `gapMs` share a group. */
  sender: string;
  createdAt: Date | string | number;
}

export interface MessageGroup<T> {
  sender: string;
  /** Set on the first group of each day, for a date divider. */
  day?: string;
  messages: T[];
}

/** Runs of messages by sender, split by long pauses and day changes, for showing the avatar and name once per run. */
export function groupMessages<T extends GroupableMessage>(messages: T[], { gapMs = 5 * 60 * 1000, now = Date.now(), locale }: { gapMs?: number; now?: Date | number; locale?: string } = {}): MessageGroup<T>[] {
  const groups: MessageGroup<T>[] = [];
  let previous: T | undefined;
  for (const message of messages) {
    const at = toDate(message.createdAt);
    const newDay = !previous || !isSameDay(previous.createdAt, at);
    const last = groups[groups.length - 1];
    if (last && previous && !newDay && previous.sender === message.sender && at.getTime() - toDate(previous.createdAt).getTime() <= gapMs) last.messages.push(message);
    else groups.push({ sender: message.sender, ...(newDay ? { day: formatDayLabel(at, now, locale) } : {}), messages: [message] });
    previous = message;
  }
  return groups;
}

export type TranscriptRole = "user" | "assistant" | "system" | "tool";

export interface TranscriptMessage {
  id?: string;
  role: TranscriptRole;
  content: string;
  createdAt?: string | number;
  /** Model or person that wrote it. */
  author?: string;
  attachments?: Array<{ name: string; url?: string }>;
}

export interface Transcript {
  title: string;
  messages: TranscriptMessage[];
  createdAt?: string;
}

const ROLE_HEADINGS: Record<TranscriptRole, string> = { user: "You", assistant: "Assistant", system: "System", tool: "Tool" };

/** Readable Markdown transcript with a heading per message. */
export function messagesToMarkdown({ title, messages }: Transcript, locale?: string): string {
  const time = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const parts = [`# ${title.trim() || "Conversation"}`];
  for (const message of messages) {
    const heading = message.author ? `${ROLE_HEADINGS[message.role]} (${message.author})` : ROLE_HEADINGS[message.role];
    const when = message.createdAt !== undefined ? ` · ${time.format(toDate(message.createdAt))}` : "";
    parts.push(`## ${heading}${when}`);
    parts.push(message.content.trim());
    if (message.attachments?.length) parts.push(message.attachments.map((file) => (file.url ? `- [${file.name}](${file.url})` : `- ${file.name}`)).join("\n"));
  }
  return `${parts.join("\n\n")}\n`;
}

export const TRANSCRIPT_FORMAT = "marifai.conversation";

/** Versioned JSON export that `parseConversationImport` reads back. */
export function exportConversation(transcript: Transcript): string {
  return JSON.stringify({ format: TRANSCRIPT_FORMAT, version: 1, exportedAt: new Date().toISOString(), ...transcript }, null, 2);
}

export interface ImportLimits {
  maxBytes?: number;
  maxMessages?: number;
  maxMessageLength?: number;
}

export type ImportResult = { ok: true; transcript: Transcript; warnings: string[] } | { ok: false; error: string };

const ROLES = new Set<TranscriptRole>(["user", "assistant", "system", "tool"]);

/**
 * Validates an exported conversation before it touches your data: size,
 * message count and length caps, known roles and string content only.
 * Also accepts a bare array of `{ role, content }` messages.
 */
export function parseConversationImport(text: string, { maxBytes = 5 * 1024 * 1024, maxMessages = 5000, maxMessageLength = 200_000 }: ImportLimits = {}): ImportResult {
  if (new Blob([text]).size > maxBytes) return { ok: false, error: `The file is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.` };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "This isn't a conversation export (the file isn't valid JSON)." };
  }
  const record = Array.isArray(data) ? { title: "Imported conversation", messages: data } : (data as Record<string, unknown> | null);
  if (!record || typeof record !== "object") return { ok: false, error: "This isn't a conversation export." };
  if ("format" in record && record.format !== TRANSCRIPT_FORMAT) return { ok: false, error: "This file is from a different app." };
  if ("version" in record && typeof record.version === "number" && record.version > 1) return { ok: false, error: "This export is from a newer version. Update the app and try again." };
  if (!Array.isArray(record.messages)) return { ok: false, error: "The file has no messages." };
  if (record.messages.length > maxMessages) return { ok: false, error: `The conversation has more than ${maxMessages.toLocaleString()} messages.` };
  const warnings: string[] = [];
  const messages: TranscriptMessage[] = [];
  for (const [index, raw] of (record.messages as unknown[]).entries()) {
    const entry = raw as Record<string, unknown> | null;
    if (!entry || typeof entry !== "object" || typeof entry.content !== "string" || !ROLES.has(entry.role as TranscriptRole)) return { ok: false, error: `Message ${index + 1} is not in a supported format.` };
    let content = entry.content;
    if (content.length > maxMessageLength) {
      content = content.slice(0, maxMessageLength);
      warnings.push(`Message ${index + 1} was shortened to ${maxMessageLength.toLocaleString()} characters.`);
    }
    messages.push({
      role: entry.role as TranscriptRole,
      content,
      ...(typeof entry.id === "string" ? { id: entry.id } : {}),
      ...(typeof entry.createdAt === "string" || typeof entry.createdAt === "number" ? { createdAt: entry.createdAt } : {}),
      ...(typeof entry.author === "string" ? { author: entry.author } : {}),
    });
  }
  const title = typeof record.title === "string" && record.title.trim() ? record.title.trim().slice(0, 200) : "Imported conversation";
  return { ok: true, transcript: { title, messages, ...(typeof record.createdAt === "string" ? { createdAt: record.createdAt } : {}) }, warnings };
}
