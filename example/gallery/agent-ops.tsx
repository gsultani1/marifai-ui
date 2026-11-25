// packages/ai-ui/example/gallery/agent-ops.tsx
import { useState } from "react";

import {
  AgentArtifactInbox,
  AgentAttentionQueue,
  AgentEscalationCard,
  AgentMailbox,
  AgentRunComparison,
  AgentRunEventStream,
  AgentRunQueue,
  AgentTraceTree,
  Button,
  DelegationRequestEditor,
  DelegationTree,
  McpResourceSubscriptions,
  RunArtifactManifest,
  RunBudgetBreakdown,
  RunDependencyInspector,
  RunRecoveryPanel,
  TraceSpanDetails,
  WorkerPoolStatus,
  type AgentAttentionItem,
  type AgentMailboxMessage,
  type AgentQueueRun,
  type AgentQueueStatus,
  type AgentTraceSpan,
  type DelegationRequest,
  type DelegationRun,
  type DisplayedRunEvent,
  type DisplayedTraceSpan,
  type InspectedRunDependency,
  type McpResourceSubscription,
} from "../../src/index.js";
import { Demo, GallerySection } from "./section.js";

const wait = (ms: number) => new Promise<void>((resolve) => { window.setTimeout(resolve, ms); });

const ATTENTION: AgentAttentionItem[] = [
  { id: "returns", title: "Returns policy answer", reason: "answer", detail: "Asks whether opened paint cans can be returned" },
  { id: "vendor", title: "Vendor reorder email", reason: "approval", detail: "Wants to send a $1,840 purchase order to a supplier" },
  { id: "sync", title: "Nightly stock sync", reason: "retry", detail: "Timed out three times reaching the warehouse API" },
];

const ESCALATION_DECISIONS = [
  { id: "extend", label: "Add $10 and continue", effect: "Raises the run budget to $35" },
  { id: "summarize", label: "Summarize what it found", effect: "Stops searching and writes up current results" },
  { id: "person", label: "Hand off to a buyer", effect: "Assigns the run to the purchasing team", unavailableReason: "No buyer is on shift" },
];

const RECIPIENTS = [
  { id: "research", label: "Research agent" },
  { id: "catalog", label: "Catalog agent" },
  { id: "writer", label: "Writer agent" },
];

const TOOLS = [
  { id: "web", label: "Web search" },
  { id: "pos", label: "Point of sale reports" },
  { id: "sheets", label: "Spreadsheet export" },
];

const TRACE: AgentTraceSpan[] = [
  { id: "answer", label: "answer_customer", durationMs: 4310, status: "ok", children: [
    { id: "lookup", label: "lookup_inventory", durationMs: 820, status: "ok" },
    { id: "policy", label: "search_policies", durationMs: 1240, status: "ok", children: [
      { id: "rerank", label: "rerank_passages", durationMs: 310, status: "ok" },
    ] },
    { id: "draft", label: "draft_reply", durationMs: 1980, status: "error" },
  ] },
];

const SPAN_DETAILS: Record<string, DisplayedTraceSpan> = {
  answer: { id: "answer", label: "answer_customer", status: "ok", startedAt: "9:14:02 AM", durationMs: 4310, input: "Do you have 3/4 inch copper elbows at the Elm Street store?", output: "Yes, 42 in stock in aisle 9, bin C4." },
  lookup: { id: "lookup", label: "lookup_inventory", status: "ok", startedAt: "9:14:02 AM", durationMs: 820, input: "sku: CU-ELB-075, store: elm-street", output: "on_hand: 42, aisle: 9, bin: C4" },
  policy: { id: "policy", label: "search_policies", status: "ok", startedAt: "9:14:03 AM", durationMs: 1240, input: "query: hold items for pickup", output: "3 passages from the pickup policy" },
  rerank: { id: "rerank", label: "rerank_passages", status: "ok", startedAt: "9:14:04 AM", durationMs: 310, input: "3 passages", output: "Kept 2 passages above the relevance cutoff" },
  draft: { id: "draft", label: "draft_reply", status: "error", startedAt: "9:14:04 AM", durationMs: 1980, input: "2 passages, inventory result", error: "The reply exceeded the 600 character limit and was retried." },
};

const EVENTS: DisplayedRunEvent[] = [
  { id: "e1", title: "Run started", timestamp: "9:14:02 AM", detail: "Customer chat on the store website" },
  { id: "e2", title: "Checked inventory", timestamp: "9:14:02 AM", detail: "42 copper elbows on hand" },
  { id: "e3", title: "Searched store policies", timestamp: "9:14:03 AM", detail: "3 passages matched" },
];

const UPCOMING_EVENTS: DisplayedRunEvent[] = [
  { id: "e4", title: "Drafted a reply", timestamp: "9:14:04 AM", detail: "Retried once to fit the length limit" },
  { id: "e5", title: "Offered to hold the items", timestamp: "9:14:06 AM", detail: "Waiting for the customer to confirm" },
  { id: "e6", title: "Run finished", timestamp: "9:14:19 AM", detail: "Customer accepted the pickup hold" },
];

const MESSAGES: AgentMailboxMessage[] = [
  { id: "m1", agentId: "research", agent: "Research agent", subject: "Competitor deck stain prices", excerpt: "Two nearby stores dropped prices by 8 percent", unread: true },
  { id: "m2", agentId: "catalog", agent: "Catalog agent", subject: "Missing photos for 14 new items", excerpt: "Spring garden tools from the latest supplier feed", unread: true },
  { id: "m3", agentId: "research", agent: "Research agent", subject: "Sources for the weekend promotion", unread: false },
  { id: "m4", agentId: "writer", agent: "Writer agent", subject: "Draft of the weekly store newsletter", excerpt: "Ready for a final read", unread: false },
];

const INBOX_ARTIFACTS = [
  { id: "forecast", title: "Restock forecast workbook", agent: "Inventory agent", kind: "Spreadsheet" },
  { id: "pricing", title: "Deck stain price survey", agent: "Research agent", kind: "Report" },
  { id: "newsletter", title: "Weekly newsletter draft", agent: "Writer agent", kind: "Document" },
  { id: "photos", title: "Product photo shot list", agent: "Catalog agent", kind: "Document", available: false },
];

const MANIFEST = [
  { id: "csv", title: "restock-forecast.csv", kind: "CSV", size: "84 KB", version: "v2" },
  { id: "chart", title: "weekly-demand-chart.png", kind: "Image", size: "212 KB" },
  { id: "log", title: "supplier-feed-raw.json", kind: "JSON", size: "3.1 MB", unavailableReason: "Removed after 7 days" },
];

const DEPENDENCIES: Record<string, InspectedRunDependency> = {
  feed: { id: "feed", label: "Import supplier feed", status: "Completed" },
  prices: { id: "prices", label: "Refresh competitor prices", status: "Running" },
  index: { id: "index", label: "Rebuild catalog index", status: "Blocked", blockingReason: "Waiting for competitor prices" },
  storefront: { id: "storefront", label: "Publish storefront update", status: "Waiting" },
  newsletter: { id: "newsletter", label: "Send weekly newsletter", status: "Waiting" },
};

const DEPENDENCY_LINKS: Record<string, { prerequisites: string[]; dependents: string[] }> = {
  feed: { prerequisites: [], dependents: ["index"] },
  prices: { prerequisites: [], dependents: ["index"] },
  index: { prerequisites: ["feed", "prices"], dependents: ["storefront", "newsletter"] },
  storefront: { prerequisites: ["index"], dependents: [] },
  newsletter: { prerequisites: ["index"], dependents: [] },
};

const CHECKPOINTS = [
  { id: "c1", label: "After reading sales history" },
  { id: "c2", label: "After forecasting demand" },
  { id: "c3", label: "After writing purchase orders", unavailableReason: "Orders were already sent to suppliers" },
];

const WORKERS = [
  { id: "w1", name: "gpu-east-1", status: "busy" as const, activeWork: "Embedding the spring catalog", lastHeartbeat: "4 s ago" },
  { id: "w2", name: "gpu-east-2", status: "available" as const, lastHeartbeat: "2 s ago" },
  { id: "w3", name: "cpu-west-1", status: "available" as const, lastHeartbeat: "6 s ago" },
  { id: "w4", name: "cpu-west-2", status: "offline" as const, lastHeartbeat: "18 min ago" },
];

const RUN_UPDATES: Record<AgentQueueStatus, string> = {
  queued: "Waiting for a free worker",
  running: "Working again",
  paused: "Paused from the queue",
  failed: "Stopped with an error",
  completed: "Finished",
  canceled: "Canceled",
};

export function AgentOpsGallery() {
  const [runs, setRuns] = useState<AgentQueueRun[]>([
    { id: "restock", title: "Spring restock forecast", agent: "Inventory agent", status: "running", detail: "Reading 14 weeks of sales" },
    { id: "prices", title: "Competitor price check", agent: "Research agent", status: "paused", detail: "Paused before the weekend" },
    { id: "feed", title: "Supplier catalog import", agent: "Catalog agent", status: "failed", detail: "The supplier feed returned an error" },
    { id: "digest", title: "Weekly store digest", agent: "Writer agent", status: "queued" },
  ]);
  const [pendingRuns, setPendingRuns] = useState<string[]>([]);
  const [viewedRun, setViewedRun] = useState("");
  const [attention, setAttention] = useState(ATTENTION);
  const [attentionNote, setAttentionNote] = useState("");
  const [decision, setDecision] = useState("");
  const [delegations, setDelegations] = useState<DelegationRun[]>([
    { id: "launch", label: "Plan the spring garden launch", agent: "Lead agent", status: "running", children: [
      { id: "survey", label: "Survey competitor garden prices", agent: "Research agent", status: "completed" },
      { id: "copy", label: "Write the launch email", agent: "Writer agent", status: "running" },
    ] },
  ]);
  const [activeDelegation, setActiveDelegation] = useState<string | null>("launch");
  const [spanId, setSpanId] = useState("answer");
  const [events, setEvents] = useState(EVENTS);
  const [openedEvent, setOpenedEvent] = useState("");
  const [messages, setMessages] = useState(MESSAGES);
  const [reading, setReading] = useState("");
  const [openedArtifact, setOpenedArtifact] = useState("");
  const [dependency, setDependency] = useState("index");
  const [recovering, setRecovering] = useState(false);
  const [recovery, setRecovery] = useState("");
  const [viewedWorker, setViewedWorker] = useState("");
  const [resources, setResources] = useState<McpResourceSubscription[]>([
    { id: "orders", title: "Online orders", server: "Storefront server", subscribed: true },
    { id: "stock", title: "Stock level changes", server: "Warehouse server", subscribed: false },
    { id: "audit", title: "Register audit trail", server: "Point of sale server", subscribed: false, unavailableReason: "Needs the manager scope" },
  ]);
  const [pendingResources, setPendingResources] = useState<string[]>([]);

  function updateRun(id: string, status: AgentQueueStatus) {
    setPendingRuns((current) => [...current, id]);
    window.setTimeout(() => {
      setRuns((current) => current.map((run) => run.id === id ? { ...run, status, detail: RUN_UPDATES[status] } : run));
      setPendingRuns((current) => current.filter((item) => item !== id));
    }, 700);
  }

  function openAttention(id: string, reason: AgentAttentionItem["reason"]) {
    const item = attention.find((entry) => entry.id === id);
    setAttention((current) => current.filter((entry) => entry.id !== id));
    if (item) setAttentionNote(`Opened ${item.title} to ${reason === "answer" ? "reply" : reason === "approval" ? "review the approval" : "review the retry"}.`);
  }

  async function delegate(request: DelegationRequest) {
    await wait(500);
    const recipient = RECIPIENTS.find((item) => item.id === request.recipientId)?.label ?? "Agent";
    const id = `delegation-${Date.now()}`;
    setDelegations((current) => [...current, { id, label: request.task, agent: recipient, status: "queued" }]);
    setActiveDelegation(id);
  }

  function recover(label: string) {
    setRecovering(true);
    setRecovery("");
    window.setTimeout(() => {
      setRecovering(false);
      setRecovery(label);
    }, 900);
  }

  function toggleResource(id: string, subscribed: boolean) {
    setPendingResources((current) => [...current, id]);
    window.setTimeout(() => {
      setResources((current) => current.map((resource) => resource.id === id ? { ...resource, subscribed } : resource));
      setPendingResources((current) => current.filter((item) => item !== id));
    }, 600);
  }

  const links = DEPENDENCY_LINKS[dependency] ?? { prerequisites: [], dependents: [] };
  const nextEvent = UPCOMING_EVENTS[events.length - EVENTS.length];

  return (
    <GallerySection id="gallery-agent-ops" title="Agent operations and traces">
      <Demo title="Run queue and attention" className="grid w-full items-start gap-3 md:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <AgentRunQueue runs={runs} pendingRunIds={pendingRuns} onOpen={(id) => setViewedRun(runs.find((run) => run.id === id)?.title ?? "")}
            onPause={(id) => updateRun(id, "paused")} onResume={(id) => updateRun(id, "running")} onRetry={(id) => updateRun(id, "running")} />
          <p role="status" className="text-xs text-muted-foreground">{viewedRun && `Viewing the ${viewedRun} run.`}</p>
        </div>
        <div className="min-w-0 space-y-2">
          <AgentAttentionQueue items={attention} onOpen={openAttention} />
          <p role="status" className="text-xs text-muted-foreground">{attentionNote}</p>
          {!attention.length && <Button type="button" size="sm" variant="outline" onClick={() => { setAttention(ATTENTION); setAttentionNote(""); }}>Restore attention samples</Button>}
        </div>
      </Demo>

      <Demo title="Escalation and delegation" className="grid w-full items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div className="min-w-0 space-y-2">
          <AgentEscalationCard escalationId="esc-restock" title="Restock run reached its budget"
            description="The forecast run spent its $25 budget while comparing supplier lead times."
            decisions={ESCALATION_DECISIONS}
            onDecide={async (_id, choice) => {
              await wait(500);
              setDecision(ESCALATION_DECISIONS.find((item) => item.id === choice)?.label ?? "");
            }} />
          <p role="status" className="text-xs text-muted-foreground">{decision && `Recorded decision: ${decision}.`}</p>
        </div>
        <DelegationRequestEditor recipients={RECIPIENTS} tools={TOOLS} budgetLabel="Budget (USD)" onSubmit={delegate}
          initialValue={{ recipientId: "research", task: "Find three suppliers for raised garden bed kits", toolIds: ["web"] }} />
        <DelegationTree runs={delegations} activeId={activeDelegation} onSelect={setActiveDelegation} />
      </Demo>

      <Demo title="Trace inspection" className="grid w-full items-start gap-3 md:grid-cols-2">
        <AgentTraceTree spans={TRACE} activeId={spanId} onSelect={setSpanId} />
        <TraceSpanDetails span={SPAN_DETAILS[spanId] ?? null} />
      </Demo>

      <Demo title="Live run events" className="grid w-full items-start gap-3 md:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <AgentRunEventStream events={events} onOpen={(id) => setOpenedEvent(events.find((event) => event.id === id)?.title ?? "")} />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" disabled={!nextEvent} onClick={() => { if (nextEvent) setEvents((current) => [...current, nextEvent]); }}>
              Simulate next run event
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={events.length === EVENTS.length} onClick={() => setEvents(EVENTS)}>Replay run events</Button>
          </div>
          <p role="status" className="text-xs text-muted-foreground">{openedEvent && `Opened event: ${openedEvent}.`}</p>
        </div>
        <AgentRunComparison currency="USD"
          left={{ label: "With store policy search", outcome: "Answered with the pickup hold offer", elapsedMs: 4310, toolCalls: 4, cost: 0.0184 }}
          right={{ label: "Without policy search", outcome: "Answered without pickup details", elapsedMs: 2870, toolCalls: 2 }} />
      </Demo>

      <Demo title="Mailbox and artifacts" className="grid w-full items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div className="min-w-0 space-y-2">
          <AgentMailbox messages={messages} onOpen={(id) => {
            setMessages((current) => current.map((message) => message.id === id ? { ...message, unread: false } : message));
            setReading(messages.find((message) => message.id === id)?.subject ?? "");
          }} />
          <p role="status" className="text-xs text-muted-foreground">{reading && `Reading: ${reading}.`}</p>
        </div>
        <div className="min-w-0 space-y-2">
          <AgentArtifactInbox artifacts={INBOX_ARTIFACTS} onOpen={(id) => setOpenedArtifact(INBOX_ARTIFACTS.find((item) => item.id === id)?.title ?? "")} />
          <RunArtifactManifest artifacts={MANIFEST} onOpen={(id) => setOpenedArtifact(MANIFEST.find((item) => item.id === id)?.title ?? "")} />
          <p role="status" className="text-xs text-muted-foreground">{openedArtifact && `Opened artifact: ${openedArtifact}.`}</p>
        </div>
        <RunBudgetBreakdown currency="USD" amounts={{ reserved: "25.00", settled: "17.42", released: "4.08" }} />
      </Demo>

      <Demo title="Dependencies and recovery" className="grid w-full items-start gap-3 md:grid-cols-2">
        <RunDependencyInspector node={DEPENDENCIES[dependency]!} onSelect={setDependency}
          prerequisites={links.prerequisites.map((id) => DEPENDENCIES[id]!)}
          dependents={links.dependents.map((id) => DEPENDENCIES[id]!)} />
        <div className="min-w-0 space-y-2">
          <RunRecoveryPanel checkpoints={CHECKPOINTS} pending={recovering}
            onResume={(id) => recover(`Resumed the restock run ${CHECKPOINTS.find((item) => item.id === id)?.label.toLowerCase() ?? ""}.`)}
            onRestart={() => recover("Restarted the restock run from the beginning.")} />
          <p role="status" className="text-xs text-muted-foreground">{recovery}</p>
        </div>
      </Demo>

      <Demo title="Workers and resource subscriptions" className="grid w-full items-start gap-3 md:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <WorkerPoolStatus workers={WORKERS} onOpen={(id) => setViewedWorker(WORKERS.find((worker) => worker.id === id)?.name ?? "")} />
          <p role="status" className="text-xs text-muted-foreground">{viewedWorker && `Viewing worker ${viewedWorker}.`}</p>
        </div>
        <McpResourceSubscriptions resources={resources} pendingIds={pendingResources} onToggle={toggleResource} />
      </Demo>
    </GallerySection>
  );
}
