// packages/ai-ui/example/docs-catalog.tsx
/// <reference types="vite/client" />
import { useState, type ReactNode } from "react";
import {
  ActionApproval,
  Badge,
  BrowserTabStrip,
  Button,
  CodeBlock,
  DiffView,
  Message,
  Progress,
  StatusPill,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TaskInbox,
  Textarea,
} from "../src/index.js";
import publicIndex from "../src/index.ts?raw";

export const PACKAGE = "@sultanico/ai-ui";
export const INSTALL = `npm install ${PACKAGE}`;
export const PRESET = `@import "tailwindcss";\n@import "${PACKAGE}/preset.css";`;

const GROUPS = ["AI & Chat", "Agents & Tools", "Editors & Files", "Browser", "Tasks & Automation", "Forms & Controls", "Foundations"] as const;
export const CATEGORIES = GROUPS;
export type Category = typeof GROUPS[number];

interface Example {
  description: string;
  render?: () => ReactNode;
  code?: string;
  href?: string;
}

function ButtonExample() {
  const [clicks, setClicks] = useState(0);
  return <div className="flex flex-wrap items-center gap-2">
    <Button onClick={() => setClicks((count) => count + 1)}>Run action</Button>
    <Button variant="outline" onClick={() => setClicks(0)}>Reset</Button>
    <span className="ml-1 text-sm text-muted-foreground" role="status">{clicks} {clicks === 1 ? "run" : "runs"}</span>
  </div>;
}

function ApprovalExample() {
  const [decision, setDecision] = useState("");
  return decision ? <div className="grid justify-items-center gap-3">
    <StatusPill>{decision}</StatusPill>
    <Button variant="outline" onClick={() => setDecision("")}>Reset preview</Button>
  </div> : <ActionApproval title="Update the landing page"
    description="Replace the hero heading in index.html."
    onApprove={() => setDecision("Approved")} onDeny={() => setDecision("Denied")} />;
}

const BROWSER_TABS = [{ id: "docs", title: "Documentation" }, { id: "app", title: "Preview" }];

function BrowserExample() {
  const [active, setActive] = useState("docs");
  return <div className="w-full rounded-md border border-border bg-background">
    <BrowserTabStrip tabs={BROWSER_TABS} activeId={active} onActiveChange={setActive} />
    <p className="border-t border-border p-4 text-sm text-muted-foreground" role="status">
      {active === "docs" ? "Documentation is active." : "Preview is active."}
    </p>
  </div>;
}

function TaskExample() {
  const [opened, setOpened] = useState("");
  return <div className="space-y-2">
    <TaskInbox tasks={[
      { id: "review", title: "Review the release notes", status: "Open", priority: "High" },
      { id: "prepare", title: "Prepare screenshots", status: "Done", priority: "Normal" },
    ]} onOpen={setOpened} />
    {opened && <p role="status" className="text-sm text-muted-foreground">Opened task {opened}.</p>}
  </div>;
}

const EXAMPLES: Readonly<Partial<Record<string, Example>>> = {
  button: {
    description: "Trigger an action with variants for primary, secondary, and destructive work.",
    render: () => <ButtonExample />,
    code: '<Button onClick={runAction}>Run action</Button>\n<Button variant="outline" onClick={reset}>Reset</Button>',
  },
  badge: {
    description: "Label an item with a status, category, or removable filter.",
    render: () => <div className="flex flex-wrap gap-2"><Badge>Default</Badge><Badge variant="info" dot>In review</Badge><Badge variant="success" dot>Published</Badge></div>,
    code: '<Badge variant="success" dot>Published</Badge>',
  },
  switch: {
    description: "Toggle a setting and associate it with an accessible label and description.",
    render: () => <Switch label="Desktop notifications" description="Show a notification when a run finishes." defaultChecked />,
    code: '<Switch label="Desktop notifications" defaultChecked />',
  },
  textarea: {
    description: "Collect multiline input with optional autosizing and a character count.",
    render: () => <Textarea aria-label="Release note" placeholder="Write a release note…" autosize minRows={2} maxRows={5} maxLength={180} showCount />,
    code: '<Textarea aria-label="Release note" autosize maxLength={180} showCount />',
  },
  tabs: {
    description: "Switch between related views with keyboard navigation.",
    render: () => <Tabs defaultValue="overview">
      <TabsList aria-label="Project views"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="activity">Activity</TabsTrigger></TabsList>
      <TabsContent value="overview" className="p-3 text-sm">Your project is ready.</TabsContent>
      <TabsContent value="activity" className="p-3 text-sm">The latest run completed.</TabsContent>
    </Tabs>,
    code: '<Tabs defaultValue="overview">\n  <TabsList aria-label="Project views">\n    <TabsTrigger value="overview">Overview</TabsTrigger>\n    <TabsTrigger value="activity">Activity</TabsTrigger>\n  </TabsList>\n  <TabsContent value="overview">Your project is ready.</TabsContent>\n  <TabsContent value="activity">The latest run completed.</TabsContent>\n</Tabs>',
  },
  progress: {
    description: "Show how much work has completed, or indicate an operation with an unknown duration.",
    render: () => <Progress value={68} label="Indexing components" />,
    code: '<Progress value={68} label="Indexing components" />',
  },
  "code-block": {
    description: "Display source code with syntax highlighting and a copy control.",
    render: () => <CodeBlock code={'export const project = {\n  name: "Fieldwork Studio",\n  status: "ready",\n};'} language="javascript" showLineNumbers />,
    code: '<CodeBlock code={source} language="javascript" showLineNumbers />',
  },
  "diff-view": {
    description: "Review changes to a file or block of text in a unified or split diff.",
    render: () => <DiffView oldValue={'title: "Welcome"\nstatus: "draft"'} newValue={'title: "Fieldwork Studio"\nstatus: "ready"'} />,
    code: '<DiffView oldValue={before} newValue={after} mode="unified" />',
  },
  "action-approval": {
    description: "Ask users to approve or deny a proposed action with its scope and preview.",
    render: () => <ApprovalExample />,
    code: '<ActionApproval\n  title="Update the landing page"\n  description="Replace the hero heading in index.html."\n  onApprove={applyChange}\n  onDeny={dismissChange}\n/>',
  },
  message: {
    description: "Display messages from users, assistants, systems, or tools in a conversation.",
    render: () => <div className="space-y-4">
      <Message from="user"><p className="rounded-lg bg-muted px-3 py-2 text-sm">Summarize the release.</p></Message>
      <Message from="assistant"><p className="text-sm">This update adds live examples, a component index, and an install guide.</p></Message>
    </div>,
    code: '<Message from="assistant">\n  <p>This update adds live component examples.</p>\n</Message>',
  },
  "browser-tab-strip": {
    description: "Display and select host-owned browser tabs, with optional pin, close, and reorder actions.",
    render: () => <BrowserExample />,
    code: '<BrowserTabStrip tabs={tabs} activeId={activeId} onActiveChange={setActiveId} />',
  },
  "task-inbox": {
    description: "Browse tasks and filter by status, priority, or search text.",
    render: () => <TaskExample />,
    code: '<TaskInbox tasks={tasks} onOpen={openTask} />',
  },
  "vibe-coding-editor": {
    description: "Compose a page-building workspace with drag-and-drop design, chat requests, code, and review.",
    code: '<VibeCodingEditor\n  projectId="studio"\n  title="Fieldwork Studio"\n  revision={revision}\n  document={document}\n  onDocumentChange={updateDocument}\n  onRequest={requestChange}\n  proposal={proposal}\n  onApplyProposal={applyProposal}\n/>',
    href: "#gallery-vibe-coding",
  },
};

export interface CatalogEntry {
  id: string;
  name: string;
  names: { local: string; exported: string }[];
  category: Category;
  example?: Example;
}

function classify(id: string): Category {
  if (/^(browser|bookmark|open-tab|page-(capture|find|link|selection))/.test(id)) return "Browser";
  if (/^(vibe|ide|editor|git|debug|code|diff|merge|file|terminal|artifact|canvas|design|page-builder|sheet|rich-text|html|document-editor|pdf)/.test(id)) return "Editors & Files";
  if (/^(agent|worker|run|tool|trace|mcp|delegation|action-approval|approval)/.test(id)) return "Agents & Tools";
  if (/^(task|automation|assistant|personal|meeting|calendar|schedule)/.test(id)) return "Tasks & Automation";
  if (/^(ai|chat|conversation|message|model|prompt|citation|reasoning|response|structured-output|slash-command)/.test(id)) return "AI & Chat";
  if (/(button|form|field|picker|select|input|toggle|radio|check|switch|slider|textarea|combobox|rating)/.test(id)) return "Forms & Controls";
  return "Foundations";
}

export const catalog: CatalogEntry[] = [...publicIndex.matchAll(/export\s*\{([^{}]+)\}\s*from "\.\/components\/([\w-]+)\.js";/g)]
  .flatMap(([, symbols = "", id = ""]) => {
    const names = symbols.split(",").flatMap((symbol) => {
      const match = /^([A-Z]\w*)(?:\s+as\s+([A-Z]\w*))?$/.exec(symbol.trim());
      return match?.[1] ? [{ local: match[1], exported: match[2] ?? match[1] }] : [];
    });
    const normal = (value: string) => value.replaceAll("-", "").toLowerCase();
    const primary = names.find(({ exported }) => normal(exported) === normal(id)) ?? names[0];
    const example = EXAMPLES[id];
    return primary ? [{ id, name: primary.exported, names, category: classify(id), ...(example ? { example } : {}) }] : [];
  })
  .sort((a, b) => a.name.localeCompare(b.name));

export const featured = ["message", "action-approval", "vibe-coding-editor", "diff-view", "browser-tab-strip", "task-inbox",
  "button", "tabs", "switch", "textarea", "badge", "progress", "code-block"]
  .flatMap((id) => catalog.find((entry) => entry.id === id) ?? []);

export function searchCatalog(query: string) {
  const input = query.toLowerCase().trim();
  if (!input) return catalog;
  const terms = input.split(/\s+/);
  const compact = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const key = compact(input);
  const rank = (entry: CatalogEntry) => {
    const names = [entry.id, ...entry.names.map(({ exported }) => exported)].map(compact);
    if (names.includes(key)) return 0;
    return names.some((name) => name.startsWith(key)) ? 1 : 2;
  };
  return catalog.filter((entry) => {
    const searchable = [entry.name, ...entry.names.map(({ exported }) => exported), entry.id.replaceAll("-", " "),
      entry.category, entry.example?.description].join(" ").toLowerCase();
    return terms.every((word) => searchable.includes(word));
  }).sort((left, right) => rank(left) - rank(right));
}
