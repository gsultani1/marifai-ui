// src/lib/vibe-builder-session.ts
import { builderBlockLabel, normalizeBuilderDocument, type BuilderBlock, type BuilderDocument } from "./page-builder.js";
import type { VibeBuilderView } from "../components/vibe-builder-workbench.js";

export interface VibeBuilderHistoryEntry {
  id: string;
  label: string;
  document: BuilderDocument;
  selectedBlockId: string | null;
}

export interface VibeBuilderHistoryState {
  past: readonly VibeBuilderHistoryEntry[];
  present: VibeBuilderHistoryEntry;
  future: readonly VibeBuilderHistoryEntry[];
}

/** Serializable editor state. Storage and conversation data belong to the host. */
export interface VibeBuilderSession {
  version: 1;
  projectId: string;
  revision: string;
  document: BuilderDocument;
  selectedBlockId: string | null;
  draft: string;
  view: VibeBuilderView;
  panelSizes: number[];
  history: VibeBuilderHistoryState;
}

export interface VibeBuilderSaveState {
  status: "idle" | "saving" | "saved" | "error";
  message?: string;
}

export function describeVibeBuilderChanges(before: BuilderDocument, after: BuilderDocument): string[] {
  const prior = new Map(before.blocks.map(block => [block.id, block]));
  const next = new Map(after.blocks.map(block => [block.id, block]));
  const result: string[] = [];
  for (const block of before.blocks) {
    const changed = next.get(block.id);
    if (!changed) result.push("Removed " + builderBlockLabel(block));
    else if (JSON.stringify(block) !== JSON.stringify(changed)) result.push("Changed " + builderBlockLabel(changed));
  }
  for (const block of after.blocks) {
    if (!prior.has(block.id)) result.push("Added " + builderBlockLabel(block));
  }
  if (JSON.stringify(before.settings) !== JSON.stringify(after.settings)) result.push("Changed page settings");
  if (before.title !== after.title) result.push("Renamed page");
  return result;
}

export function changedVibeBuilderBlockIds(before: BuilderDocument, after: BuilderDocument): string[] {
  const flatten = (blocks: readonly BuilderBlock[]): BuilderBlock[] => blocks.flatMap(block => [block,
    ...flatten(block.type === "section" ? block.blocks : block.type === "columns" ? block.columns.flatMap(column => column.blocks) : []),
  ]);
  const originals = new Map(flatten(before.blocks).map(block => [block.id, JSON.stringify(block)]));
  return flatten(after.blocks).filter(block => originals.get(block.id) !== JSON.stringify(block)).map(block => block.id);
}

const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

function documentValue(value: unknown): BuilderDocument | null {
  const doc = object(value);
  if (!doc || typeof doc.title !== "string" || !Array.isArray(doc.blocks) || !object(doc.settings)) return null;
  return normalizeBuilderDocument(doc, "page");
}

function historyEntry(value: unknown): VibeBuilderHistoryEntry | null {
  const entry = object(value);
  if (!entry || typeof entry.id !== "string" || typeof entry.label !== "string"
    || !(entry.selectedBlockId === null || typeof entry.selectedBlockId === "string")) return null;
  const document = documentValue(entry.document);
  return document ? { id: entry.id, label: entry.label, document, selectedBlockId: entry.selectedBlockId } : null;
}

/** Validates untrusted persisted state without accessing storage or changing host data. */
export function restoreVibeBuilderSession(value: unknown, projectId: string): VibeBuilderSession | null {
  const session = object(value);
  if (!session || session.version !== 1 || session.projectId !== projectId || typeof session.revision !== "string"
    || typeof session.draft !== "string" || !(session.selectedBlockId === null || typeof session.selectedBlockId === "string")
    || !["design", "code", "preview", "review"].includes(String(session.view))) return null;
  const document = documentValue(session.document);
  const savedHistory = object(session.history);
  if (!document || !savedHistory || !Array.isArray(savedHistory.past) || !Array.isArray(savedHistory.future)) return null;
  const present = historyEntry(savedHistory.present);
  const past = savedHistory.past.slice(-100).map(historyEntry);
  const future = savedHistory.future.slice(-100).map(historyEntry);
  if (!present || past.some(entry => !entry) || future.some(entry => !entry)) return null;
  if (!Array.isArray(session.panelSizes) || session.panelSizes.length !== 3
    || !session.panelSizes.every(size => typeof size === "number" && Number.isFinite(size) && size > 0)
    || Math.abs(session.panelSizes.reduce((total: number, size: number) => total + size, 0) - 100) > 1) return null;
  return {
    version: 1, projectId, revision: session.revision, document,
    selectedBlockId: session.selectedBlockId, draft: session.draft, view: session.view as VibeBuilderView,
    panelSizes: [...session.panelSizes] as number[],
    history: { past: past as VibeBuilderHistoryEntry[], present: { ...present, document }, future: future as VibeBuilderHistoryEntry[] },
  };
}
