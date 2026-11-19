// example/gallery/vibe-coding.tsx
import { CheckIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  builderBlockLabel,
  builderToHtml,
  Button,
  ConfirmDialog,
  createBuilderBlock,
  createBuilderDocument,
  duplicateBuilderBlock,
  findBuilderBlock,
  insertBuilderBlock,
  restoreVibeBuilderSession,
  removeBuilderBlock,
  ROOT_CONTAINER,
  type BuilderAlign,
  type BuilderBlock,
  type BuilderBlockType,
  type BuilderDocument,
  type BuilderBlockDefinition,
  type VibeBuilderSession,
  type VibeBuilderApplyRequest,
  type VibeBuilderPromptRequest,
  type VibeBuilderProposal,
  type VibeBuilderView,
  updateBuilderBlock,
  VibeCodingEditor,
} from "../../src/index.js";
import { escapeHtml } from "../../src/lib/page-builder.js";

export const VIBE_CODING_SECTION = "gallery-vibe-coding";

const SOURCE_FILE = "index.html";
const CABIN_PHOTO = new URL("./fieldwork-cabin.webp", import.meta.url).href;
const PREVIEW_ORIGINS = [new URL(CABIN_PHOTO).origin];
const STUDIO_SETTINGS = createBuilderDocument("page").settings;
const STARTER: BuilderDocument = {
  ...createBuilderDocument("page", [
    { id: "wordmark", type: "text", html: "<p><strong>FIELDWORK</strong> &nbsp; / &nbsp; Architecture &amp; Design</p>" },
    { id: "intro", type: "heading", text: "Architecture shaped by place.", level: 1, align: "left", color: "#142d26" },
    { id: "description", type: "text", html: "<p>We design homes and retreats rooted in the landscapes around them.</p>" },
    {
      id: "contact", type: "button", label: "Explore our work", href: "#project", align: "left",
      background: "#173e33", color: "#ffffff", radius: 4, fullWidth: false,
    },
    { id: "project", type: "image", src: CABIN_PHOTO, alt: "A cedar cabin beside a lake in a forest", width: 100, align: "center" },
    { id: "caption", type: "text", html: "<p><strong>Lakeside House</strong> &nbsp; / &nbsp; Pacific Northwest</p>" },
  ]),
  title: "Fieldwork Studio",
  settings: { ...STUDIO_SETTINGS, padding: 32, width: 960, background: "#d9e0de", contentBackground: "#f8f7f2", textColor: "#273c35", fontFamily: "Georgia, serif" },
};

interface DemoMessage {
  request: string;
  scope: string;
  reply: string;
}

interface DemoProject {
  document: BuilderDocument;
  revision: string;
  proposal: VibeBuilderProposal | null;
  thread: DemoMessage[];
  status: string;
}

const ADD_TYPES: Readonly<Record<string, Exclude<BuilderBlockType, "custom">>> = {
  heading: "heading", text: "text", paragraph: "text", image: "image", button: "button",
  divider: "divider", spacer: "spacer", section: "section", columns: "columns",
};
const RENAME_HEADING = "Rename the heading to Built for the landscape.";
const PAGE_SUGGESTIONS = [RENAME_HEADING, "Add a divider"];

function getBlockSuggestions(block: BuilderBlock): readonly string[] {
  switch (block.type) {
    case "heading": return [RENAME_HEADING, "Center this block"];
    case "button": return ["Change the button to View our projects", "Set this button color to #9a3412"];
    case "text": return ["Change this text to Thoughtful homes in wild places.", "Duplicate this block"];
    default: return ["Duplicate this block", "Remove this block"];
  }
}

function proposeEdit(document: BuilderDocument, request: VibeBuilderPromptRequest) {
  const selected = request.scope.kind === "block" ? findBuilderBlock(document, request.scope.blockId)?.block : null;
  if (request.scope.kind === "block" && !selected) throw new Error("Select a block that is still on the canvas.");
  const prompt = request.prompt;

  if (selected && /^duplicate this block\.?$/i.test(prompt)) return duplicateBuilderBlock(document, selected.id).doc;
  if (selected && /^remove this block\.?$/i.test(prompt)) return removeBuilderBlock(document, selected.id);
  const copy = /^(?:change|rewrite|set) this text to\s+(.+)$/is.exec(prompt)?.[1]?.trim();
  if (selected?.type === "text" && copy) {
    return updateBuilderBlock(document, selected.id, { html: "<p>" + escapeHtml(copy).replace(/\r?\n/g, "<br>") + "</p>" });
  }
  const color = /^set this button color to (#[0-9a-f]{6})\.?$/i.exec(prompt)?.[1];
  if (selected?.type === "button" && color) {
    return updateBuilderBlock(document, selected.id, { background: color.toLowerCase() });
  }

  const rename = /^(?:rename|change|set) (?:the )?(?:(?:selected|main) )?(heading|button|page title) to\s+(.+)$/is.exec(prompt);
  if (rename) {
    const [, type, rawText = ""] = rename;
    const text = rawText.trim().replace(/^["“]|["”]$/g, "").trim();
    if (!text) throw new Error("Enter the new title or label.");
    if (type?.toLowerCase() === "page title" && !selected) return { ...document, title: text };
    const block = selected ?? document.blocks.find((candidate) => candidate.type === type?.toLowerCase());
    if (block?.type === "heading" && type?.toLowerCase() === "heading") return updateBuilderBlock(document, block.id, { text });
    if (block?.type === "button" && type?.toLowerCase() === "button") return updateBuilderBlock(document, block.id, { label: text });
  }

  const alignment = /^(?:align (?:it|this(?: block)?|(?:the )?(?:selected )?block) (left|center|right)|(center) (?:it|this(?: block)?|(?:the )?(?:selected )?block))\.?$/i.exec(prompt);
  if (alignment && selected && "align" in selected) {
    const align = (alignment[1] ?? alignment[2])?.toLowerCase() as BuilderAlign;
    return updateBuilderBlock(document, selected.id, { align });
  }

  const add = /^add (?:a |an )?(heading|text|paragraph|image|button|divider|spacer|section|columns)\.?$/i.exec(prompt);
  if (add?.[1] && !selected) {
    const type = ADD_TYPES[add[1].toLowerCase()];
    if (type) return insertBuilderBlock(document, createBuilderBlock(type), ROOT_CONTAINER, document.blocks.length);
  }
  return null;
}


const PROJECT_ID = "vibe-gallery";
const STORAGE_KEY = "marifai-ui:vibe-gallery:v2";
type StarterId = "architecture" | "product" | "blank";
type DemoBehavior = "success" | "fail";

const STARTERS: Record<StarterId, BuilderDocument> = {
  architecture: STARTER,
  product: {
    ...createBuilderDocument("page", [
      { id: "product-title", type: "heading", text: "Tools for better weekends.", level: 1, align: "left", color: "#173e33" },
      { id: "product-copy", type: "text", html: "<p>Thoughtful equipment for projects of every size.</p>" },
      { id: "product-action", type: "button", label: "Browse the collection", href: "#collection", align: "left", background: "#173e33", color: "#ffffff", radius: 8, fullWidth: false },
    ]),
    title: "Weekend Supply",
  },
  blank: { ...createBuilderDocument("page"), title: "Untitled page" },
};

const CUSTOM_BLOCKS: readonly BuilderBlockDefinition[] = [{
  type: "notice",
  label: "Notice card",
  allowedParents: ["root", "section", "column"],
  create: () => ({ title: "A little more detail", detail: "Your application can supply its own React blocks." }),
  render: (block) => (
    <aside className="rounded-lg border border-emerald-800/25 bg-emerald-50 p-5 text-emerald-950">
      <h3 className="text-lg font-semibold">{String(block.props.title ?? "")}</h3>
      <p className="mt-2 text-sm">{String(block.props.detail ?? "")}</p>
    </aside>
  ),
  renderToHtml: (block) => '<aside style="border:1px solid #a7c7b8;border-radius:8px;background:#ecfdf5;padding:20px;color:#052e16"><h3>'
    + escapeHtml(String(block.props.title ?? "")) + "</h3><p>" + escapeHtml(String(block.props.detail ?? "")) + "</p></aside>",
  renderInspector: (block, onChange) => (
    <div className="space-y-3">
      <label className="grid gap-1 text-sm">Notice title
        <input className="min-w-0 rounded-md border border-input bg-background p-2 text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          value={String(block.props.title ?? "")} onChange={(event) => onChange({ ...block.props, title: event.target.value })} />
      </label>
      <label className="grid gap-1 text-sm">Notice detail
        <textarea className="min-w-0 rounded-md border border-input bg-background p-2 text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          value={String(block.props.detail ?? "")} onChange={(event) => onChange({ ...block.props, detail: event.target.value })} />
      </label>
    </div>
  ),
  suggestions: ["Duplicate this block", "Remove this block"],
}];

interface SavedDemo {
  session: VibeBuilderSession;
  thread: DemoMessage[];
  starter: StarterId;
}

function readSavedDemo(): SavedDemo | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    const session = restoreVibeBuilderSession(record.session, PROJECT_ID);
    if (!session) return null;
    if (record.starter !== "architecture" && record.starter !== "product" && record.starter !== "blank") return null;
    if (!Array.isArray(record.thread) || !record.thread.every((turn: unknown) => turn !== null && typeof turn === "object"
      && "request" in turn && typeof turn.request === "string" && "scope" in turn && typeof turn.scope === "string"
      && "reply" in turn && typeof turn.reply === "string")) return null;
    return { session, thread: record.thread as DemoMessage[], starter: record.starter };
  } catch {
    return null;
  }
}

function initialProject(saved: SavedDemo | null): DemoProject {
  return { document: saved?.session.document ?? STARTER, revision: saved?.session.revision ?? "1",
    proposal: null, thread: saved?.thread ?? [], status: "" };
}

function waitForDemo(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      reject(new Error("Request stopped. Your draft has been kept."));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", cancel);
      resolve();
    }, 650);
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) cancel();
  });
}

export function VibeCodingGallery() {
  const [saved] = useState(readSavedDemo);
  const [project, setProject] = useState(() => initialProject(saved));
  const [starter, setStarter] = useState<StarterId>(saved?.starter ?? "architecture");
  const [starterToLoad, setStarterToLoad] = useState<StarterId | null>(null);
  const [generation, setGeneration] = useState(0);
  const [initialSession, setInitialSession] = useState(saved?.session);
  const [activePath, setActivePath] = useState<string | null>(SOURCE_FILE);
  const [view, setView] = useState<VibeBuilderView>(saved?.session.view ?? "design");
  const [requestBehavior, setRequestBehavior] = useState<DemoBehavior>("success");
  const [saveBehavior, setSaveBehavior] = useState<DemoBehavior>("success");
  const [generating, setGenerating] = useState(false);
  const [saveState, setSaveState] = useState<{ status: "idle" | "saving" | "saved" | "error"; message?: string }>({ status: "idle" });
  const nextRevision = useRef(Number(project.revision) + 1);
  const nextProposal = useRef(1);
  const latest = useRef(project);
  const latestSession = useRef(saved?.session);
  const currentStarter = useRef(starter);
  const requestController = useRef<AbortController | null>(null);
  const html = useMemo(() => builderToHtml(project.document, { target: "web", registry: CUSTOM_BLOCKS }), [project.document]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [project.thread.length]);

  useEffect(() => () => requestController.current?.abort(), []);

  function update(value: DemoProject) {
    latest.current = value;
    setProject(value);
  }

  function recover(session: VibeBuilderSession) {
    latestSession.current = session;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ session, thread: latest.current.thread, starter: currentStarter.current }));
    } catch {
      setSaveState({ status: "error", message: "Browser storage is unavailable. Keep this tab open and retry saving." });
    }
  }

  async function submit(request: VibeBuilderPromptRequest) {
    if (requestController.current) return;
    const current = latest.current;
    if (request.baseRevision !== current.revision) throw new Error("The page changed. Send the request again.");
    const controller = new AbortController();
    requestController.current = controller;
    setGenerating(true);
    try {
      await waitForDemo(controller.signal);
      if (requestBehavior === "fail") {
        setRequestBehavior("success");
        throw new Error("Demo request failed. Your draft is ready to retry.");
      }
      if (latest.current.revision !== current.revision) throw new Error("The page changed while the request was running. Send it again.");
      const selected = request.scope.kind === "block" ? findBuilderBlock(current.document, request.scope.blockId)?.block : null;
      const scope = selected ? builderBlockLabel(selected) : "Whole page";
      const design = proposeEdit(current.document, request);
      const before = builderToHtml(current.document, { target: "web", registry: CUSTOM_BLOCKS });
      const after = design ? builderToHtml(design, { target: "web", registry: CUSTOM_BLOCKS }) : before;
      const proposal: VibeBuilderProposal | null = design && JSON.stringify(design) !== JSON.stringify(current.document) ? {
        id: "demo-" + nextProposal.current++,
        baseRevision: current.revision,
        summary: request.prompt,
        baseDocument: current.document,
        document: design,
        files: after === before ? [] : [{ id: SOURCE_FILE, path: SOURCE_FILE, kind: "modified", before, after }],
      } : null;
      const reply = proposal ? "Preview the change on the canvas, then apply or discard it."
        : design ? "That change is already on the canvas."
        : "This local demo supports the example prompts, rename, add, duplicate, remove, and align. Choose a suggestion for the selected block.";
      update({ ...current, proposal: proposal ?? current.proposal, thread: [...current.thread, { request: request.prompt, scope, reply }], status: "" });
    } finally {
      requestController.current = null;
      setGenerating(false);
    }
  }

  function apply({ proposalId, expectedRevision }: VibeBuilderApplyRequest) {
    const current = latest.current;
    const proposal = current.proposal;
    if (proposal?.id !== proposalId || expectedRevision !== current.revision || proposal.baseRevision !== current.revision || !proposal.document) {
      throw new Error("This proposal is out of date. Send a fresh request.");
    }
    update({ ...current, document: proposal.document, revision: String(nextRevision.current++), proposal: null, status: "Proposal applied." });
    setView("design");
  }

  async function save(session: VibeBuilderSession) {
    setSaveState({ status: "saving" });
    try {
      await waitForDemo();
      if (saveBehavior === "fail") {
        setSaveBehavior("success");
        throw new Error("Demo save failed. Retry to save this session.");
      }
      const newest = latestSession.current ?? session;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ session: newest, thread: latest.current.thread, starter: currentStarter.current }));
      setSaveState({ status: "saved", message: "Saved in this browser" });
    } catch (reason) {
      setSaveState({ status: "error", message: reason instanceof Error ? reason.message : "Save failed. Retry saving." });
      throw reason;
    }
  }

  function reset() {
    const nextStarter = starterToLoad ?? starter;
    requestController.current?.abort();
    currentStarter.current = nextStarter;
    setStarter(nextStarter);
    setStarterToLoad(null);
    latestSession.current = undefined;
    setInitialSession(undefined);
    nextRevision.current = 2;
    nextProposal.current = 1;
    update({ document: STARTERS[nextStarter], revision: "1", proposal: null, thread: [], status: "" });
    setActivePath(SOURCE_FILE);
    setView("design");
    setSaveState({ status: "idle" });
    setGeneration((value) => value + 1);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* Reset still works when storage is blocked. */ }
  }

  return (
    <section id={VIBE_CODING_SECTION} aria-label="Vibe coding editor" className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground">
        <label className="grid gap-1 text-xs font-medium">Starter page
          <select aria-label="Starter page" value={starter} disabled={generating || saveState.status === "saving"}
            onChange={(event) => setStarterToLoad(event.target.value as StarterId)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring">
            <option value="architecture">Architecture studio</option>
            <option value="product">Product page</option>
            <option value="blank">Blank page</option>
          </select>
        </label>
        <ConfirmDialog open={starterToLoad !== null} onOpenChange={(open) => { if (!open) setStarterToLoad(null); }}
          title="Load another starter?" description="This resets the current page, conversation, draft, and undo history."
          confirmLabel="Load starter" onConfirm={reset} />
        <ConfirmDialog trigger={<Button type="button" size="sm" variant="outline" disabled={generating || saveState.status === "saving"}>Reset demo</Button>}
          title="Reset this demo?" description="Restore the selected starter and clear its conversation, draft, and undo history."
          confirmLabel="Reset demo" onConfirm={reset} />
        <label className="grid gap-1 text-xs font-medium">Request behavior
          <select aria-label="Request behavior" value={requestBehavior} disabled={generating}
            onChange={(event) => setRequestBehavior(event.target.value as DemoBehavior)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring">
            <option value="success">Successful response</option>
            <option value="fail">Fail next request</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium">Save behavior
          <select aria-label="Save behavior" value={saveBehavior} disabled={saveState.status === "saving"}
            onChange={(event) => setSaveBehavior(event.target.value as DemoBehavior)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring">
            <option value="success">Successful save</option>
            <option value="fail">Fail next save</option>
          </select>
        </label>
        <p className="max-w-prose text-xs text-muted-foreground">Local demo assistant · Sessions recover in this browser. Each consuming app supplies its own model and storage callbacks.</p>
      </div>
      <VibeCodingEditor key={generation} projectId={PROJECT_ID} title={project.document.title} revision={project.revision}
        initialSession={initialSession} onSessionChange={recover} onSaveSession={save} saveState={saveState}
        document={project.document} view={view} onViewChange={setView} previewAllowedOrigins={PREVIEW_ORIGINS}
        registry={CUSTOM_BLOCKS} tokens={[{ id: "forest", label: "Forest", value: "#173e33" }, { id: "paper", label: "Paper", value: "#f8f7f2" }]}
        suggestions={PAGE_SUGGESTIONS} getBlockSuggestions={getBlockSuggestions} generating={generating}
        onStop={() => requestController.current?.abort()}
        onDocumentChange={(document) => {
          setSaveState({ status: "idle" });
          update({ ...latest.current, document, revision: String(nextRevision.current++), status: "" });
        }}
        onRequest={submit}
        conversation={<div ref={logRef} role="log" aria-label="Builder chat" className="max-h-[min(38svh,23rem)] space-y-4 overflow-auto">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Drag a block onto the page. Select it to ask for a change to that block, or ask about the whole page.
          </p>
          {project.thread.map((turn, index) => <div key={index} className="space-y-2 break-words text-sm">
            <div className="ms-3 rounded-lg border border-border bg-background p-2.5">
              <span className="text-xs text-muted-foreground">{turn.scope}</span>
              <p>{turn.request}</p>
            </div>
            <p className="text-muted-foreground">{turn.reply}</p>
          </div>)}
        </div>}
        toolbar={<span role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {project.status ? <><CheckIcon className="size-3.5" aria-hidden="true" />{project.status}</> : "Local demo assistant"}
        </span>}
        code={{ files: [{ path: SOURCE_FILE, content: html, language: "html" }], activePath, onOpenFile: setActivePath }}
        proposal={project.proposal} onApplyProposal={apply}
        onDiscardProposal={(id) => {
          const current = latest.current;
          if (current.proposal?.id === id) {
            update({ ...current, proposal: null, status: "Proposal discarded." });
            setView("design");
          }
        }} />
    </section>
  );
}
