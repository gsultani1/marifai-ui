// src/components/vibe-coding-editor.tsx
"use client";

import { HistoryIcon, Redo2Icon, SlidersHorizontalIcon, SparklesIcon, Undo2Icon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useControllableState } from "../hooks/use-controllable-state.js";
import { builderBlockLabel, findBuilderBlock, newBuilderId, type BuilderBlock, type BuilderBlockDefinition, type BuilderBreakpoint, type BuilderDesignToken, type BuilderDocument } from "../lib/page-builder.js";
import { restoreVibeBuilderSession, changedVibeBuilderBlockIds, type VibeBuilderHistoryState, type VibeBuilderSaveState, type VibeBuilderSession } from "../lib/vibe-builder-session.js";
import { Button } from "./button.js";
import { PageBuilderInspector } from "./page-builder-inspector.js";
import type { PageBuilderChange } from "./page-builder.js";
import { VibeBuilderCanvas, type VibeBuilderCanvasProps } from "./vibe-builder-canvas.js";
import { VibeBuilderChangeReview, type VibeBuilderApplyRequest, type VibeBuilderProposal } from "./vibe-builder-change-review.js";
import { VibeBuilderCodePanel, type VibeBuilderCodePanelProps } from "./vibe-builder-code-panel.js";
import { VibeBuilderComposer, type VibeBuilderPromptRequest } from "./vibe-builder-composer.js";
import { VibeBuilderLayers } from "./vibe-builder-layers.js";
import { VibeBuilderPreview, type VibeBuilderPreviewSource } from "./vibe-builder-preview.js";
import { VibeBuilderWorkbench, type VibeBuilderView } from "./vibe-builder-workbench.js";

export interface VibeCodingEditorProps {
  projectId: string;
  title: string;
  revision: string;
  document: BuilderDocument;
  onDocumentChange: (document: BuilderDocument, change?: PageBuilderChange) => void;
  onRequest: (request: VibeBuilderPromptRequest) => void | Promise<void>;
  conversation?: ReactNode;
  generating?: boolean;
  onStop?: () => void;
  suggestions?: readonly string[];
  getBlockSuggestions?: (block: BuilderBlock) => readonly string[];
  view?: VibeBuilderView;
  onViewChange?: (view: VibeBuilderView) => void;
  code?: VibeBuilderCodePanelProps;
  previewSource?: VibeBuilderPreviewSource;
  allowPreviewScripts?: boolean;
  previewAllowedOrigins?: readonly string[];
  onPreviewError?: (message: string) => void;
  proposal?: VibeBuilderProposal | null;
  onApplyProposal: (request: VibeBuilderApplyRequest) => void | Promise<void>;
  onDiscardProposal?: (id: string) => void;
  onImageUpload?: VibeBuilderCanvasProps["onImageUpload"];
  selectedBlockId?: string | null;
  onSelectedBlockChange?: (id: string | null) => void;
  panelSizes?: number[];
  onPanelSizesChange?: (sizes: number[]) => void;
  breakpoint?: BuilderBreakpoint;
  onBreakpointChange?: (breakpoint: BuilderBreakpoint) => void;
  registry?: readonly BuilderBlockDefinition[];
  tokens?: readonly BuilderDesignToken[];
  /** The host supplies this document and revision as well as the restored editor session. */
  initialSession?: VibeBuilderSession;
  onSessionChange?: (session: VibeBuilderSession) => void;
  onSaveSession?: (session: VibeBuilderSession) => void | Promise<void>;
  saveState?: VibeBuilderSaveState;
  draft?: string;
  onDraftChange?: (draft: string) => void;
  toolbar?: ReactNode;
  className?: string;
}

export function VibeCodingEditor(props: VibeCodingEditorProps) {
  return <ProjectEditor key={props.projectId} {...props} />;
}

function ProjectEditor({
  projectId, title, revision, document, onDocumentChange, onRequest, conversation, generating, onStop, suggestions,
  getBlockSuggestions, view, onViewChange, code, previewSource, allowPreviewScripts, previewAllowedOrigins, onPreviewError,
  proposal, onApplyProposal, onDiscardProposal, onImageUpload, registry, tokens, initialSession, onSessionChange,
  onSaveSession, saveState, draft: controlledDraft, onDraftChange, selectedBlockId: controlledSelection, onSelectedBlockChange,
  panelSizes: controlledPanelSizes, onPanelSizesChange, breakpoint: controlledBreakpoint, onBreakpointChange, toolbar, className,
}: VibeCodingEditorProps) {
  const [restored] = useState(() => {
    const candidate = restoreVibeBuilderSession(initialSession, projectId);
    return candidate && JSON.stringify(candidate.document) === JSON.stringify(document) ? candidate : null;
  });
  const [selectedId, selectBlock] = useControllableState<string | null>({ value: controlledSelection, defaultValue: restored?.selectedBlockId ?? null, onChange: onSelectedBlockChange });
  const [activeView, changeView] = useControllableState<VibeBuilderView>({ value: view, defaultValue: restored?.view ?? "design", onChange: onViewChange });
  const [draft, setDraft] = useControllableState({ value: controlledDraft, defaultValue: restored?.draft ?? "", onChange: onDraftChange });
  const [panelSizes, setPanelSizes] = useControllableState({ value: controlledPanelSizes, defaultValue: restored?.panelSizes ?? [25, 50, 25], onChange: onPanelSizesChange });
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [breakpoint, setBreakpoint] = useControllableState<BuilderBreakpoint>({ value: controlledBreakpoint, defaultValue: "desktop", onChange: onBreakpointChange });
  const [previewing, setPreviewing] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [saving, setSaving] = useState<VibeBuilderSaveState>({ status: "idle" });
  const savePending = useRef(false);
  const mergeKey = useRef<string | undefined>(undefined);
  const [externalLabel, setExternalLabel] = useState<string | null>(null);
  const [history, setHistory] = useState<VibeBuilderHistoryState>(() => ({
    past: restored?.history.past ?? [],
    present: { id: newBuilderId("edit"), label: restored?.history.present.label ?? "Initial page", document,
      selectedBlockId: restored?.selectedBlockId ?? null },
    future: restored?.history.future ?? [],
  }));
  const [seenProposal, setSeenProposal] = useState(proposal?.id);
  if (seenProposal !== proposal?.id) {
    setSeenProposal(proposal?.id);
    setPreviewing(false);
    setComparing(false);
  }
  if (document !== history.present.document) {
    setHistory(current => ({
      past: [...current.past, { ...current.present, selectedBlockId: selectedId }].slice(-100),
      present: { id: newBuilderId("edit"), label: externalLabel ?? "Host updated page", document, selectedBlockId: selectedId },
      future: [],
    }));
    setExternalLabel(null);
  }
  const selected = selectedId ? findBuilderBlock(document, selectedId)?.block : undefined;
  const selectedBlockId = selected?.id ?? null;
  const currentProposal = Boolean(proposal && proposal.baseRevision === revision);
  const session: VibeBuilderSession = {
    version: 1, projectId, revision, document, selectedBlockId, draft, view: activeView, panelSizes, history,
  };
  const sessionCallback = useRef(onSessionChange);
  useEffect(() => { sessionCallback.current = onSessionChange; });
  useEffect(() => {
    sessionCallback.current?.({
      version: 1, projectId, revision, document, selectedBlockId, draft, view: activeView, panelSizes, history,
    });
  }, [projectId, revision, document, selectedBlockId, draft, activeView, panelSizes, history]);

  function commit(next: BuilderDocument, change?: PageBuilderChange) {
    if (next === document) return;
    const label = change?.label ?? "Edit page";
    const merge = change?.mergeKey !== undefined && mergeKey.current === change.mergeKey;
    setHistory(current => ({
      past: merge ? current.past
        : [...current.past, { ...current.present, selectedBlockId }].slice(-100),
      present: { id: newBuilderId("edit"), label, document: next, selectedBlockId },
      future: [],
    }));
    mergeKey.current = change?.mergeKey;
    onDocumentChange(next, change);
  }

  function travel(direction: "undo" | "redo") {
    const source = direction === "undo" ? history.past : history.future;
    const target = source.at(-1);
    if (!target) return;
    const present = { ...history.present, selectedBlockId };
    setHistory({
      past: direction === "undo" ? history.past.slice(0, -1) : [...history.past, present].slice(-100),
      present: target,
      future: direction === "undo" ? [...history.future, present].slice(-100) : history.future.slice(0, -1),
    });
    selectBlock(target.selectedBlockId);
    mergeKey.current = undefined;
    onDocumentChange(target.document, { label: direction === "undo" ? "Undo " + present.label : "Redo " + target.label });
  }

  async function apply(request: VibeBuilderApplyRequest) {
    if (!proposal || proposal.id !== request.proposalId || proposal.baseRevision !== revision || request.expectedRevision !== revision) {
      throw new Error("This proposal is out of date. Request a fresh change.");
    }
    setExternalLabel(proposal.summary);
    mergeKey.current = undefined;
    try { await onApplyProposal(request); }
    catch (error) { setExternalLabel(null); throw error; }
    setPreviewing(false);
    setComparing(false);
  }

  async function save() {
    if (!onSaveSession || savePending.current || saveState?.status === "saving") return;
    savePending.current = true;
    setSaving({ status: "saving" });
    try {
      await onSaveSession(session);
      setSaving({ status: "saved" });
    } catch (error) {
      setSaving({ status: "error", message: error instanceof Error ? error.message : "Could not save. Your work is still here." });
    } finally { savePending.current = false; }
  }

  const saveFeedback = saveState ?? saving;
  const review = proposal && <VibeBuilderChangeReview proposal={proposal} revision={revision} currentDocument={document}
    onApply={apply} onDiscard={onDiscardProposal} allowedOrigins={previewAllowedOrigins} registry={registry} />;
  const inspector = <aside aria-label="Block properties" className="min-w-0 space-y-3 p-3">
    <details open className="rounded-md border border-border">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Layers</summary>
      <VibeBuilderLayers className="border-0 bg-transparent [&>h3]:sr-only" document={document} selectedBlockId={selectedBlockId} onSelectedBlockChange={selectBlock} />
    </details>
    <PageBuilderInspector document={document} selectedBlockId={selectedBlockId} onDocumentChange={commit}
      breakpoint={breakpoint} registry={registry} tokens={tokens} {...(onImageUpload ? { onImageUpload } : {})} />
    <details className="rounded-md border border-border p-3">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium"><HistoryIcon aria-hidden="true" className="size-4" />Edit history</summary>
      <ol aria-label="Edit history" className="mt-2 space-y-1 text-xs text-muted-foreground">
        {[...history.past, history.present].map(entry => <li key={entry.id} aria-current={entry.id === history.present.id ? "step" : undefined}>{entry.label}</li>)}
      </ol>
    </details>
  </aside>;

  return <VibeBuilderWorkbench title={title} view={activeView} onViewChange={changeView} className={className}
    panelSizes={propertiesOpen ? panelSizes : undefined} onPanelSizesChange={sizes => { if (sizes.length === 3) setPanelSizes(sizes); }}
    inspector={propertiesOpen ? inspector : undefined}
    toolbar={<div className="flex flex-wrap items-center gap-1">
      <Button size="sm" variant="ghost" aria-label="Undo" title={"Undo " + history.present.label}
        disabled={!history.past.length} onClick={() => travel("undo")}><Undo2Icon aria-hidden="true" /></Button>
      <Button size="sm" variant="ghost" aria-label="Redo" disabled={!history.future.length}
        onClick={() => travel("redo")}><Redo2Icon aria-hidden="true" /></Button>
      <Button size="sm" variant="ghost" aria-pressed={propertiesOpen} onClick={() => setPropertiesOpen(!propertiesOpen)}>
        <SlidersHorizontalIcon aria-hidden="true" />Properties
      </Button>
      {onSaveSession && <Button size="sm" variant="outline" loading={saveFeedback.status === "saving"}
        onClick={() => { void save(); }}>{saveFeedback.status === "error" ? "Retry save" : "Save session"}</Button>}
      {onSaveSession && saveFeedback.status !== "idle" && <span role={saveFeedback.status === "error" ? "alert" : "status"}
        className="max-w-48 break-words text-xs">{saveFeedback.message ?? ({ saving: "Saving…", saved: "Saved", error: "Save failed" } as const)[saveFeedback.status as "saving" | "saved" | "error"]}</span>}
      {toolbar}
    </div>}
    assistant={<div className="flex h-full min-w-0 flex-col">
      <h3 className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold">
        <SparklesIcon className="size-4 text-teal-700 dark:text-teal-300" aria-hidden="true" />Assistant
      </h3>
      <div className="min-h-0 flex-1 overflow-auto p-3">{conversation}</div>
      <VibeBuilderComposer revision={revision} onSubmit={onRequest} generating={generating} onStop={onStop}
        draft={draft} onDraftChange={setDraft} suggestions={suggestions}
        blockSuggestions={selected && (getBlockSuggestions?.(selected) ?? (selected.type === "custom" ? registry?.find(definition => definition.type === selected.name)?.suggestions : undefined))}
        className="border-t border-border bg-background p-3"
        selectedBlock={selected ? { id: selected.id, label: builderBlockLabel(selected) } : null} />
    </div>}
    design={<div className="min-w-0">
      {proposal && <div data-slot="vibe-builder-inline-review" className="space-y-2 border-b border-border bg-muted/20 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 break-words text-sm font-medium">{proposal.summary}</p>
          {proposal.document && <Button size="sm" variant="outline" aria-pressed={previewing} disabled={!currentProposal}
            onClick={() => setPreviewing(!previewing)}>Preview changes</Button>}
          {proposal.baseDocument && proposal.document && <Button size="sm" variant="outline" aria-pressed={comparing}
            onClick={() => setComparing(!comparing)}>Compare</Button>}
        </div>
        <VibeBuilderChangeReview proposal={proposal} revision={revision} currentDocument={document} showPreview={false}
          onApply={apply} onDiscard={onDiscardProposal} allowedOrigins={previewAllowedOrigins} registry={registry} />
      </div>}
      {comparing && proposal?.document && proposal.baseDocument && <div className="grid min-w-0 gap-2 p-2 @min-[48rem]:grid-cols-2">
        <VibeBuilderPreview source={{ kind: "design", document: proposal.baseDocument }} title="Before proposed change" allowedOrigins={previewAllowedOrigins} registry={registry} showToolbar={false} />
        <VibeBuilderPreview source={{ kind: "design", document: proposal.document }} title="After proposed change" allowedOrigins={previewAllowedOrigins} registry={registry} showToolbar={false} />
      </div>}
      {previewing && currentProposal && proposal?.document ? <VibeBuilderPreview source={{ kind: "design", document: proposal.document }}
        title="Proposed canvas preview" allowedOrigins={previewAllowedOrigins} registry={registry} /> :
        <VibeBuilderCanvas document={document} onDocumentChange={commit} selectedBlockId={selectedBlockId}
          onSelectedBlockChange={selectBlock} inspectorMode="external" highlightedBlockIds={proposal?.baseDocument && proposal.document ? changedVibeBuilderBlockIds(proposal.baseDocument, proposal.document) : undefined} registry={registry} tokens={tokens}
          breakpoint={breakpoint} onBreakpointChange={setBreakpoint}
          historyControls={{ canUndo: Boolean(history.past.length), canRedo: Boolean(history.future.length), onUndo: () => travel("undo"), onRedo: () => travel("redo") }}
          layout="workspace" height="clamp(24rem, calc(100svh - 17rem), 52rem)" {...(onImageUpload ? { onImageUpload } : {})} />}
    </div>}
    code={code && <VibeBuilderCodePanel {...code} />}
    preview={<VibeBuilderPreview source={previewSource ?? { kind: "design", document }} allowScripts={allowPreviewScripts}
      onRuntimeError={onPreviewError} allowedOrigins={previewAllowedOrigins} registry={registry} />}
    review={review} />;
}
