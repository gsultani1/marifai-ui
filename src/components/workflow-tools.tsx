// packages/ai-ui/src/components/workflow-tools.tsx
"use client";

import {
  BotIcon, CalendarDaysIcon, CircleAlertIcon, ClipboardListIcon, Code2Icon, FileTextIcon,
  Globe2Icon, LinkIcon, PauseIcon, PlayIcon, SparklesIcon, XIcon,
} from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { Button } from "./button.js";

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="min-w-0 rounded-lg border border-border bg-card p-4 text-card-foreground">
      <h3 id={id} className="mb-3 flex items-center gap-2 text-sm font-semibold [&_svg]:size-4 [&_svg]:text-muted-foreground">
        {icon}{title}
      </h3>
      {children}
    </section>
  );
}

const listClass = "divide-y divide-border";
const rowClass = "flex min-w-0 items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0";
const descriptionClass = "text-xs break-words text-muted-foreground";
const inputClass = cn("h-8 w-full rounded-md border border-input bg-background px-2 text-sm", focusRing);

export interface BrowserPage {
  id: string;
  title: string;
  /** Display address. The host app decides how to open or share it. */
  address: string;
  included: boolean;
}

export interface BrowserPageQueueProps {
  pages: readonly BrowserPage[];
  onIncludeChange: (id: string, included: boolean) => void;
}

export function BrowserPageQueue({ pages, onIncludeChange }: BrowserPageQueueProps) {
  const included = pages.filter((page) => page.included).length;
  return (
    <Panel title="Browser pages" icon={<Globe2Icon aria-hidden="true" />}>
      {pages.length ? (
        <ul className={listClass}>
          {pages.map((page) => (
            <li key={page.id} className={rowClass}>
              <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
                <input type="checkbox" checked={page.included} className={cn("mt-1 shrink-0 accent-primary", focusRing)}
                  onChange={(event) => onIncludeChange(page.id, event.currentTarget.checked)} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium break-words">{page.title}</span>
                  <span className="block text-xs break-all text-muted-foreground">{page.address}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      ) : <p className={descriptionClass}>No browser pages available.</p>}
      <p role="status" className={cn("mt-3", descriptionClass)}>{included} {included === 1 ? "page" : "pages"} in context</p>
    </Panel>
  );
}

export interface IdeProblem {
  id: string;
  severity: "error" | "warning";
  message: string;
  file: string;
  line: number;
}

export interface IdeProblemsPanelProps {
  problems: readonly IdeProblem[];
  onOpen: (problem: IdeProblem) => void;
}

export function IdeProblemsPanel({ problems, onOpen }: IdeProblemsPanelProps) {
  const [severity, setSeverity] = useState<IdeProblem["severity"] | "all">("all");
  const filtered = severity === "all" ? problems : problems.filter((problem) => problem.severity === severity);
  return (
    <Panel title="IDE problems" icon={<Code2Icon aria-hidden="true" />}>
      <div role="group" aria-label="Filter problems" className="mb-3 flex flex-wrap gap-1">
        {([["all", "All"], ["error", "Errors"], ["warning", "Warnings"]] as const).map(([value, label]) => (
          <Button key={value} size="sm" variant={severity === value ? "secondary" : "ghost"}
            aria-pressed={severity === value} onClick={() => setSeverity(value)}>{label}</Button>
        ))}
      </div>
      {filtered.length ? (
        <ul className={listClass}>
          {filtered.map((problem) => (
            <li key={problem.id} className={rowClass}>
              <button type="button" className={cn("flex min-w-0 gap-2 rounded text-left", focusRing)} onClick={() => onOpen(problem)}>
                <CircleAlertIcon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", problem.severity === "error" && "text-destructive")} />
                <span className="min-w-0">
                  <span className="block text-sm break-words">{problem.message}</span>
                  <span className={descriptionClass}>{problem.severity === "error" ? "Error" : "Warning"} · {problem.file}:{problem.line}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : <p role="status" className={descriptionClass}>No matching problems.</p>}
    </Panel>
  );
}

export interface PromptVariant {
  id: string;
  label: string;
  prompt: string;
}

export interface PromptVariantPickerProps {
  variants: readonly PromptVariant[];
  onUse: (variant: PromptVariant) => void;
}

export function PromptVariantPicker({ variants, onUse }: PromptVariantPickerProps) {
  const [variantId, setVariantId] = useState("");
  const active = variants.find((variant) => variant.id === variantId) ?? variants[0];
  return (
    <Panel title="Prompt variants" icon={<SparklesIcon aria-hidden="true" />}>
      {active ? (
        <div className="space-y-3">
          <select aria-label="Prompt variant" className={inputClass} value={active.id} onChange={(event) => setVariantId(event.currentTarget.value)}>
            {variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.label}</option>)}
          </select>
          <p className="rounded-md border border-border bg-muted/30 p-2 text-sm whitespace-pre-wrap break-words">{active.prompt}</p>
          <Button size="sm" variant="outline" onClick={() => onUse(active)}>Use prompt</Button>
        </div>
      ) : <p className={descriptionClass}>No prompt variants available.</p>}
    </Panel>
  );
}

export interface ChatContextItem {
  id: string;
  label: string;
  kind: "file" | "page" | "note";
  tokens: number;
}

export interface ChatContextTrayProps {
  items: readonly ChatContextItem[];
  onRemove: (id: string) => void;
}

export function ChatContextTray({ items, onRemove }: ChatContextTrayProps) {
  const total = items.reduce((sum, item) => sum + item.tokens, 0);
  return (
    <Panel title="Chat context" icon={<LinkIcon aria-hidden="true" />}>
      {items.length ? (
        <ul className={listClass}>
          {items.map((item) => (
            <li key={item.id} className={rowClass}>
              <div className="min-w-0">
                <p className="text-sm break-words">{item.label}</p>
                <p className={descriptionClass}>{item.kind} · {item.tokens.toLocaleString()} tokens</p>
              </div>
              <Button size="icon" variant="ghost" aria-label={`Remove ${item.label}`} onClick={() => onRemove(item.id)}>
                <XIcon aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      ) : <p className={descriptionClass}>No context attached.</p>}
      <p role="status" className={cn("mt-3 tabular-nums", descriptionClass)}>{total.toLocaleString()} context tokens</p>
    </Panel>
  );
}

export interface AgentHandoff {
  id: string;
  from: string;
  to: string;
  summary: string;
  state: "pending" | "accepted" | "returned";
}

export interface AgentHandoffQueueProps {
  handoffs: readonly AgentHandoff[];
  onDecision: (id: string, decision: "accepted" | "returned") => void;
}

export function AgentHandoffQueue({ handoffs, onDecision }: AgentHandoffQueueProps) {
  return (
    <Panel title="Agent handoffs" icon={<BotIcon aria-hidden="true" />}>
      {handoffs.length ? (
        <ul className={listClass}>
          {handoffs.map((handoff) => (
            <li key={handoff.id} className="space-y-1.5 py-2.5 first:pt-0 last:pb-0">
              <p className="text-sm font-medium break-words">{handoff.from} to {handoff.to}</p>
              <p className={descriptionClass}>{handoff.summary}</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label={`Handoff from ${handoff.from} to ${handoff.to}`}>
                {handoff.state === "pending" ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => onDecision(handoff.id, "accepted")}>Accept handoff</Button>
                    <Button size="sm" variant="ghost" onClick={() => onDecision(handoff.id, "returned")}>Return</Button>
                  </>
                ) : <p role="status" className={descriptionClass}>{handoff.state === "accepted" ? "Accepted" : "Returned"}</p>}
              </div>
            </li>
          ))}
        </ul>
      ) : <p className={descriptionClass}>No agent handoffs yet.</p>}
    </Panel>
  );
}

export interface AutomationRunControlsProps {
  name: string;
  state: "running" | "paused";
  completed: number;
  total: number;
  onStateChange: (state: "running" | "paused") => void;
}

export function AutomationRunControls({ name, state, completed, total, onStateChange }: AutomationRunControlsProps) {
  const running = state === "running";
  const progress = Math.max(0, Math.min(completed, total));
  return (
    <Panel title="Autonomous run" icon={<BotIcon aria-hidden="true" />}>
      <p className="text-sm font-medium break-words">{name}</p>
      <p role="status" className={cn("mt-1", descriptionClass)}>
        {running ? "Running" : "Paused"} · {total > 0 ? `${progress} of ${total} steps` : "Waiting for steps"}
      </p>
      <progress aria-label="Autonomous run progress" value={total > 0 ? progress : undefined} max={Math.max(total, 1)}
        className="mt-3 block h-2 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary" />
      <Button size="sm" variant="outline" className="mt-3" onClick={() => onStateChange(running ? "paused" : "running")}>
        {running ? <PauseIcon aria-hidden="true" /> : <PlayIcon aria-hidden="true" />}
        {running ? "Pause run" : "Resume run"}
      </Button>
    </Panel>
  );
}

export interface TriageTask {
  id: string;
  title: string;
  rationale: string;
  priority: "high" | "normal" | "low";
  state: "suggested" | "added" | "dismissed";
}

export interface TaskTriageBoardProps {
  tasks: readonly TriageTask[];
  onDecision: (id: string, decision: "added" | "dismissed") => void;
}

export function TaskTriageBoard({ tasks, onDecision }: TaskTriageBoardProps) {
  const suggested = tasks.filter((task) => task.state === "suggested");
  return (
    <Panel title="AI task triage" icon={<ClipboardListIcon aria-hidden="true" />}>
      {suggested.length ? (
        <ul className={listClass}>
          {suggested.map((task) => (
            <li key={task.id} className="space-y-1.5 py-2.5 first:pt-0 last:pb-0">
              <div className={rowClass}>
                <p className="min-w-0 text-sm font-medium break-words">{task.title}</p>
                <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs capitalize">{task.priority}</span>
              </div>
              <p className={descriptionClass}>{task.rationale}</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label={task.title}>
                <Button size="sm" variant="outline" onClick={() => onDecision(task.id, "added")}>Add to tasks</Button>
                <Button size="sm" variant="ghost" onClick={() => onDecision(task.id, "dismissed")}>Dismiss</Button>
              </div>
            </li>
          ))}
        </ul>
      ) : <p className={descriptionClass}>No tasks to review.</p>}
      <p role="status" className={cn("mt-3", descriptionClass)}>
        {suggested.length} to review · {tasks.filter((task) => task.state === "added").length} added
      </p>
    </Panel>
  );
}

export interface AgendaItem {
  id: string;
  time: string;
  title: string;
  brief?: string;
}

export interface AssistantAgendaProps {
  items: readonly AgendaItem[];
}

export function AssistantAgenda({ items }: AssistantAgendaProps) {
  return (
    <Panel title="Assistant agenda" icon={<CalendarDaysIcon aria-hidden="true" />}>
      {items.length ? (
        <ol className={listClass}>
          {items.map((item) => (
            <li key={item.id} className="py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-baseline gap-2">
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{item.time}</span>
                <span className="min-w-0 text-sm font-medium break-words">{item.title}</span>
              </div>
              {item.brief && (
                <details className="mt-1 text-sm">
                  <summary className={cn("w-fit cursor-pointer rounded text-xs", focusRing)}>
                    <FileTextIcon aria-hidden="true" className="mr-1 inline size-3" />Preparation notes
                  </summary>
                  <p className={cn("mt-1", descriptionClass)}>{item.brief}</p>
                </details>
              )}
            </li>
          ))}
        </ol>
      ) : <p className={descriptionClass}>Your agenda is clear.</p>}
    </Panel>
  );
}
