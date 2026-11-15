// packages/ai-ui/example/gallery/workflow-tools.tsx
import { useState } from "react";

import {
  AgentHandoffQueue,
  AssistantAgenda,
  AutomationRunControls,
  BrowserPageQueue,
  ChatContextTray,
  IdeProblemsPanel,
  PromptVariantPicker,
  TaskTriageBoard,
  type AgentHandoff,
  type ChatContextItem,
  type IdeProblem,
  type TriageTask,
} from "../../src/index.js";
import { GallerySection } from "./section.js";

const PROBLEMS = [
  { id: "p1", severity: "error", message: "Property 'quantity' can be undefined", file: "src/cart.ts", line: 18 },
  { id: "p2", severity: "warning", message: "Unused formatCurrency import", file: "src/report.ts", line: 3 },
] as const;

const SOURCE_LINES: Record<string, string> = {
  p1: "const total = item.price * item.quantity;",
  p2: 'import { formatCurrency } from "./currency.js";',
};

const PROMPTS = [
  { id: "summary", label: "Summarize", prompt: "Summarize the selected sources in five bullets and cite each claim." },
  { id: "review", label: "Review", prompt: "Review the selected files for correctness and list the most important findings first." },
];

export function WorkflowToolsGallery() {
  const [pages, setPages] = useState([
    { id: "returns", title: "Returns policy", address: "example.com/policies/returns", included: true },
    { id: "stock", title: "Inventory guide", address: "example.com/guides/inventory", included: false },
  ]);
  const [context, setContext] = useState<ChatContextItem[]>([
    { id: "cart", kind: "file", label: "src/cart.ts", tokens: 380 },
    { id: "notes", kind: "note", label: "Audit notes", tokens: 210 },
  ]);
  const [handoffs, setHandoffs] = useState<AgentHandoff[]>([
    { id: "audit", from: "Researcher", to: "Reviewer", summary: "Verify the two flagged stock discrepancies.", state: "pending" },
  ]);
  const [runState, setRunState] = useState<"running" | "paused">("running");
  const [tasks, setTasks] = useState<TriageTask[]>([
    { id: "t1", title: "Confirm the supplier cutoff", rationale: "The delivery window changes next week.", priority: "high", state: "suggested" },
    { id: "t2", title: "Draft the restock report", rationale: "The weekly audit is complete.", priority: "normal", state: "suggested" },
  ]);
  const [problem, setProblem] = useState<IdeProblem | null>(null);
  const [prompt, setPrompt] = useState("");
  const pageContext = pages.filter((page) => page.included).map((page): ChatContextItem =>
    ({ id: page.id, kind: "page", label: page.title, tokens: 640 }));

  function includePage(id: string, included: boolean) {
    setPages((current) => current.map((page) => page.id === id ? { ...page, included } : page));
  }

  function removeContext(id: string) {
    includePage(id, false);
    setContext((current) => current.filter((item) => item.id !== id));
  }

  return (
    <GallerySection id="gallery-workflow-tools" title="Browser, IDE and assistant tools">
      <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <BrowserPageQueue pages={pages} onIncludeChange={includePage} />
        <div className="space-y-2">
          <IdeProblemsPanel problems={PROBLEMS} onOpen={setProblem} />
          {problem && (
            <figure className="rounded-md border border-border bg-muted/30 p-2">
              <figcaption className="text-xs text-muted-foreground">{problem.file}:{problem.line}</figcaption>
              <pre className="mt-1 overflow-x-auto text-xs"><code>{SOURCE_LINES[problem.id]}</code></pre>
            </figure>
          )}
        </div>
        <ChatContextTray items={[...context, ...pageContext]} onRemove={removeContext} />
        <div className="space-y-2">
          <PromptVariantPicker variants={PROMPTS} onUse={(variant) => setPrompt(variant.prompt)} />
          {prompt && (
            <label className="block space-y-1 text-xs text-muted-foreground">
              <span>Chat draft</span>
              <textarea value={prompt} onChange={(event) => setPrompt(event.currentTarget.value)}
                className="block w-full rounded-md border border-input bg-background p-2 text-sm text-foreground" />
            </label>
          )}
        </div>
        <AgentHandoffQueue handoffs={handoffs} onDecision={(id, state) => {
          setHandoffs((current) => current.map((handoff) => handoff.id === id ? { ...handoff, state } : handoff));
        }} />
        <AutomationRunControls name="Weekly inventory audit" state={runState} completed={7} total={12} onStateChange={setRunState} />
        <TaskTriageBoard tasks={tasks} onDecision={(id, state) => {
          setTasks((current) => current.map((task) => task.id === id ? { ...task, state } : task));
        }} />
        <AssistantAgenda items={[
          { id: "a1", time: "9:00 AM", title: "Supplier check-in", brief: "Ask about the revised delivery cutoff and the lead time on backorders." },
          { id: "a2", time: "11:30 AM", title: "Inventory review", brief: "Bring the audit summary and flag the two warehouses with discrepancies." },
        ]} />
      </div>
    </GallerySection>
  );
}
