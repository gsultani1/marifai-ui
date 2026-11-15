// packages/ai-ui/src/components/agent-graph.tsx
"use client";

import { PauseIcon, PlayIcon, PlusIcon, SquareIcon } from "lucide-react";
import { type KeyboardEvent, useId, useMemo, useRef } from "react";

import { useNow } from "../hooks/use-now.js";
import { button, buttonVariants, card, focusRing, type Tone } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatAmount, formatDuration } from "../lib/format.js";
import { type GraphPosition, layoutLayers } from "../lib/graph-layout.js";
import { type StepStatus, StepStatusIcon, stepStatusLabel } from "../lib/step-status.js";
import { BudgetBar } from "./budget-bar.js";
import { StatusPill } from "./status-pill.js";

export interface AgentNode {
  id: string;
  label: string;
  /** e.g. "Planner" or "Researcher". */
  role?: string;
  model?: string;
  status?: StepStatus;
  turns?: number;
  steps?: number;
  elapsedMs?: number;
  cost?: number;
}

export interface AgentEdge {
  from: string;
  to: string;
  /** What passes along the edge, e.g. "plan" or "findings". */
  label?: string;
}

const NODE_WIDTH = 184;
const NODE_HEIGHT = 76;
const GAP_X = 72;
const GAP_Y = 24;

export interface AgentGraphProps {
  nodes: AgentNode[];
  edges: AgentEdge[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  label?: string;
  currency?: string;
  className?: string;
}

/**
 * Agents and how work flows between them, laid out left to right without
 * a graph library: each node shows its role, model and status, edges are
 * labeled, nodes are buttons, and arrow keys move between columns and
 * rows; each node's connections are read with it.
 */
export function AgentGraph({ nodes, edges, selectedId, onSelect, label = "Agents", currency = "USD", className }: AgentGraphProps) {
  const id = useId();
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const positions = useMemo(() => layoutLayers(nodes, edges), [nodes, edges]);
  const layers = Math.max(0, ...[...positions.values()].map((position) => position.layer + 1));
  const rows = Math.max(0, ...[...positions.values()].map((position) => position.order + 1));
  const width = layers * NODE_WIDTH + Math.max(0, layers - 1) * GAP_X;
  const height = rows * NODE_HEIGHT + Math.max(0, rows - 1) * GAP_Y;
  const place = (position: GraphPosition) => ({ x: position.layer * (NODE_WIDTH + GAP_X), y: position.order * (NODE_HEIGHT + GAP_Y) });
  const name = (nodeId: string) => nodes.find((node) => node.id === nodeId)?.label ?? nodeId;

  const move = (event: KeyboardEvent<HTMLButtonElement>, nodeId: string) => {
    const current = positions.get(nodeId);
    if (!current) return;
    const delta = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[event.key];
    if (!delta) return;
    event.preventDefault();
    const [dx, dy] = delta as [number, number];
    let target: string | undefined;
    if (dx !== 0) {
      const linked = edges.filter((edge) => (dx > 0 ? edge.from === nodeId : edge.to === nodeId)).map((edge) => (dx > 0 ? edge.to : edge.from));
      const candidates = (linked.length ? linked : nodes.map((node) => node.id)).filter((other) => positions.get(other)?.layer === current.layer + dx);
      target = candidates.sort((a, b) => Math.abs(positions.get(a)!.order - current.order) - Math.abs(positions.get(b)!.order - current.order))[0];
    } else {
      target = nodes.find((node) => positions.get(node.id)?.layer === current.layer && positions.get(node.id)?.order === current.order + dy)?.id;
    }
    if (target) refs.current.get(target)?.focus();
  };

  return (
    <div role="region" aria-label={label} data-slot="agent-graph" className={cn("overflow-auto rounded-lg border border-border bg-muted/30 p-4", className)}>
      <div className="relative" style={{ width, height }}>
        <svg aria-hidden="true" width={width} height={height} className="pointer-events-none absolute inset-0 overflow-visible text-muted-foreground">
          <defs>
            <marker id={`${id}-arrow`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
              <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
            </marker>
          </defs>
          {edges.map((edge, index) => {
            const from = positions.get(edge.from);
            const to = positions.get(edge.to);
            if (!from || !to) return null;
            const a = place(from);
            const b = place(to);
            const forward = to.layer > from.layer;
            const x1 = forward ? a.x + NODE_WIDTH : a.x + NODE_WIDTH / 2;
            const y1 = forward ? a.y + NODE_HEIGHT / 2 : a.y + NODE_HEIGHT;
            const x2 = forward ? b.x : b.x + NODE_WIDTH / 2;
            const y2 = forward ? b.y + NODE_HEIGHT / 2 : b.y + NODE_HEIGHT;
            const bend = forward ? GAP_X / 2 : NODE_HEIGHT;
            const path = forward ? `M${x1} ${y1} C${x1 + bend} ${y1} ${x2 - bend} ${y2} ${x2} ${y2}` : `M${x1} ${y1} C${x1} ${y1 + bend} ${x2} ${y2 + bend} ${x2} ${y2}`;
            return (
              <g key={`${edge.from}-${edge.to}-${index}`}>
                <path d={path} fill="none" stroke="currentColor" strokeWidth={1.5} strokeDasharray={forward ? undefined : "4 3"} markerEnd={`url(#${id}-arrow)`} />
                {edge.label && (
                  <text x={(x1 + x2) / 2} y={(forward ? (y1 + y2) / 2 : Math.max(y1, y2) + bend * 0.75) - 4} textAnchor="middle" className="fill-foreground text-[10px]">
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        <ul aria-label={`${label} (${nodes.length})`}>
          {nodes.map((node) => {
            const position = positions.get(node.id);
            if (!position) return null;
            const { x, y } = place(position);
            const inbound = edges.filter((edge) => edge.to === node.id).map((edge) => name(edge.from));
            const outbound = edges.filter((edge) => edge.from === node.id).map((edge) => `${name(edge.to)}${edge.label ? ` (${edge.label})` : ""}`);
            const stats = [node.steps !== undefined ? `${node.steps} steps` : "", node.cost !== undefined ? formatAmount(node.cost, currency) : ""].filter(Boolean).join(" · ");
            return (
              <li key={node.id} className="absolute" style={{ left: x, top: y, width: NODE_WIDTH, height: NODE_HEIGHT }}>
                <button
                  ref={(element) => {
                    if (element) refs.current.set(node.id, element);
                    else refs.current.delete(node.id);
                  }}
                  type="button"
                  aria-pressed={onSelect ? node.id === selectedId : undefined}
                  aria-describedby={`${id}-${node.id}-links`}
                  onClick={() => onSelect?.(node.id)}
                  onKeyDown={(event) => move(event, node.id)}
                  data-status={node.status}
                  className={cn(card, "flex size-full flex-col gap-0.5 p-2 text-left text-xs shadow-sm hover:bg-accent/40 aria-pressed:border-ring aria-pressed:ring-2 aria-pressed:ring-ring", node.status === "running" && "border-ring", node.status === "failed" && "border-destructive/60", focusRing)}
                >
                  <span className="flex items-center gap-1.5">
                    {node.status && <StepStatusIcon status={node.status} />}
                    <span className="truncate text-sm font-medium">{node.label}</span>
                  </span>
                  {(node.role || node.model) && <span className="truncate text-muted-foreground">{[node.role, node.model].filter(Boolean).join(" · ")}</span>}
                  {stats && <span className="truncate tabular-nums">{stats}</span>}
                </button>
                <span id={`${id}-${node.id}-links`} className="sr-only">
                  {[inbound.length ? `Receives from ${inbound.join(", ")}.` : "Starts the run.", outbound.length ? `Sends to ${outbound.join(", ")}.` : "Produces the result."].join(" ")}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export type AgentRunStatus = "running" | "paused" | "completed" | "failed" | "stopped";

const RUN_STATUS: Record<AgentRunStatus, { label: string; tone: Tone }> = {
  running: { label: "Running", tone: "info" },
  paused: { label: "Paused", tone: "warning" },
  completed: { label: "Completed", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  stopped: { label: "Stopped", tone: "neutral" },
};

export interface AgentRunViewProps extends Omit<AgentGraphProps, "className"> {
  status: AgentRunStatus;
  startedAt?: number;
  finishedAt?: number;
  /** Spend so far against the run's budget. */
  budget?: { spent: number; limit: number };
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  /** Continues a run that stopped at its budget, adding this amount. */
  onContinueWithBudget?: (extra: number) => void;
  /** Amount offered by "Continue with". */
  continueAmount?: number;
  className?: string;
}

/**
 * A multi-agent run: overall status, elapsed time, turns, steps and cost,
 * the budget, pause, resume and stop, continuing with more budget once it
 * runs out, the graph with each agent's state, and the selected agent's
 * details.
 */
export function AgentRunView({ nodes, edges, status, startedAt, finishedAt, budget, onPause, onResume, onStop, onContinueWithBudget, continueAmount = 1, selectedId, onSelect, currency = "USD", label = "Agents in this run", className }: AgentRunViewProps) {
  const now = useNow(1000, status === "running" && startedAt !== undefined);
  const id = useId();
  const elapsed = startedAt === undefined ? undefined : Math.max(0, (finishedAt ?? (status === "running" ? now : startedAt)) - startedAt);
  const totals = {
    turns: nodes.reduce((sum, node) => sum + (node.turns ?? 0), 0),
    steps: nodes.reduce((sum, node) => sum + (node.steps ?? 0), 0),
    cost: nodes.reduce((sum, node) => sum + (node.cost ?? 0), 0),
  };
  const selected = nodes.find((node) => node.id === selectedId);
  const outOfBudget = budget !== undefined && budget.spent >= budget.limit;
  const meta = RUN_STATUS[status];

  return (
    <section aria-labelledby={`${id}-title`} data-slot="agent-run-view" data-status={status} className={cn("flex flex-col gap-3 text-sm", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={`${id}-title`} className="font-medium">
          Run
        </h3>
        <StatusPill tone={meta.tone} pulse={status === "running"} live>
          {meta.label}
        </StatusPill>
        <span className="text-xs text-muted-foreground tabular-nums">{[elapsed !== undefined ? formatDuration(elapsed) : "", `${totals.turns} turns`, `${totals.steps} steps`, formatAmount(totals.cost, currency)].filter(Boolean).join(" · ")}</span>
        <span className="ml-auto flex gap-2">
          {status === "running" && onPause && (
            <button type="button" onClick={onPause} className={cn(button, buttonVariants.outline, "h-7 px-2 text-xs", focusRing)}>
              <PauseIcon aria-hidden="true" />
              Pause
            </button>
          )}
          {status === "paused" && onResume && !outOfBudget && (
            <button type="button" onClick={onResume} className={cn(button, buttonVariants.primary, "h-7 px-2 text-xs", focusRing)}>
              <PlayIcon aria-hidden="true" />
              Resume
            </button>
          )}
          {(status === "running" || status === "paused") && onStop && (
            <button type="button" onClick={onStop} className={cn(button, buttonVariants.destructive, "h-7 px-2 text-xs", focusRing)}>
              <SquareIcon aria-hidden="true" />
              Stop
            </button>
          )}
        </span>
      </div>
      {budget && <BudgetBar budget={budget.limit} used={budget.spent} unit={currency} label="Run budget" />}
      {outOfBudget && onContinueWithBudget && status !== "completed" && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-xs">
          <span className="flex-1">The run paused because it reached its budget.</span>
          <button type="button" onClick={() => onContinueWithBudget(continueAmount)} className={cn(button, buttonVariants.outline, "h-7 px-2 text-xs", focusRing)}>
            <PlusIcon aria-hidden="true" />
            Continue with {formatAmount(continueAmount, currency)} more
          </button>
        </div>
      )}
      <AgentGraph nodes={nodes} edges={edges} label={label} currency={currency} {...(selectedId !== undefined ? { selectedId } : {})} {...(onSelect ? { onSelect } : {})} />
      {selected && (
        <div className={cn(card, "flex flex-col gap-1 p-3")}>
          <span className="flex items-center gap-2 font-medium">
            {selected.status && <StepStatusIcon status={selected.status} />}
            {selected.label}
          </span>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs sm:grid-cols-4">
            {[
              ["Status", selected.status ? stepStatusLabel(selected.status) : "Not started"],
              ["Model", selected.model ?? "Default"],
              ["Turns", String(selected.turns ?? 0)],
              ["Steps", String(selected.steps ?? 0)],
              ["Time", selected.elapsedMs !== undefined ? formatDuration(selected.elapsedMs) : "None yet"],
              ["Cost", formatAmount(selected.cost ?? 0, currency)],
            ].map(([term, value]) => (
              <div key={term} className="flex flex-col">
                <dt className="text-muted-foreground">{term}</dt>
                <dd className="tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}
