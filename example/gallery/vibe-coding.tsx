// packages/ai-ui/example/gallery/vibe-coding.tsx
import { ArrowUpRightIcon, CheckIcon, FileDiffIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  builderBlockLabel,
  builderToHtml,
  Button,
  createBuilderBlock,
  createBuilderDocument,
  duplicateBuilderBlock,
  findBuilderBlock,
  insertBuilderBlock,
  removeBuilderBlock,
  ROOT_CONTAINER,
  type BuilderAlign,
  type BuilderBlock,
  type BuilderBlockType,
  type BuilderDocument,
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

const ADD_TYPES: Readonly<Record<string, BuilderBlockType>> = {
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

const STARTER_PROJECT: DemoProject = { document: STARTER, revision: "1", proposal: null, thread: [], status: "" };

export function VibeCodingGallery() {
  const [project, setProject] = useState(STARTER_PROJECT);
  const [activePath, setActivePath] = useState<string | null>(SOURCE_FILE);
  const [view, setView] = useState<VibeBuilderView>("design");
  const nextRevision = useRef(2);
  const nextProposal = useRef(1);
  const latest = useRef(project);
  const html = useMemo(() => builderToHtml(project.document, { target: "web" }), [project.document]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [project.thread.length]);

  function update(value: DemoProject) {
    latest.current = value;
    setProject(value);
  }

  function submit(request: VibeBuilderPromptRequest) {
    const current = latest.current;
    if (request.baseRevision !== current.revision) throw new Error("The page changed. Send the request again.");
    const selected = request.scope.kind === "block" ? findBuilderBlock(current.document, request.scope.blockId)?.block : null;
    const scope = selected ? builderBlockLabel(selected) : "Whole page";
    const design = proposeEdit(current.document, request);
    const before = builderToHtml(current.document, { target: "web" });
    const after = design ? builderToHtml(design, { target: "web" }) : before;
    const proposal = design && (after !== before || JSON.stringify(design) !== JSON.stringify(current.document)) ? {
      id: "demo-" + nextProposal.current++,
      baseRevision: current.revision,
      summary: request.prompt,
      baseDocument: current.document,
      document: design,
      files: after === before ? [] : [{ id: SOURCE_FILE, path: SOURCE_FILE, kind: "modified" as const, before, after }],
    } : null;
    const reply = proposal ? "I’ve prepared that change for review."
      : design ? "That change is already on the canvas."
      : "Try one of the suggestions for the selected block or page.";
    update({ ...current, proposal: proposal ?? current.proposal, thread: [...current.thread, { request: request.prompt, scope, reply }], status: "" });
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

  return (
    <section id={VIBE_CODING_SECTION} aria-label="Vibe coding editor">
      <VibeCodingEditor projectId="vibe-gallery" title={project.document.title} revision={project.revision}
        document={project.document} view={view} onViewChange={setView} previewAllowedOrigins={PREVIEW_ORIGINS}
        suggestions={PAGE_SUGGESTIONS} getBlockSuggestions={getBlockSuggestions}
        onDocumentChange={(document) => update({ ...latest.current, document, revision: String(nextRevision.current++), status: "" })}
        onRequest={submit}
        conversation={<div className="grid gap-3">
          <div ref={logRef} role="log" aria-label="Builder chat" className="max-h-[min(38svh,23rem)] space-y-4 overflow-auto">
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
          </div>
          {project.proposal && <div className="grid gap-2 rounded-lg border border-border bg-background p-3">
            <span className="flex items-center gap-2 text-sm font-medium">
              <FileDiffIcon className="size-4" aria-hidden="true" />
              {project.proposal.baseRevision === project.revision ? "Proposed change" : "Outdated proposal"}
            </span>
            <Button type="button" variant="outline" size="sm" className="justify-between" onClick={() => setView("review")}>
              Review change <ArrowUpRightIcon aria-hidden="true" />
            </Button>
          </div>}
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
