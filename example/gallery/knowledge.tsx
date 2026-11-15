// packages/ai-ui/example/gallery/knowledge.tsx
import { useMemo, useState } from "react";

import {
  type AgentEdge,
  type AgentNode,
  AgentRunView,
  type AgentRunStatus,
  type AppNotification,
  AnalyzeButton,
  CandidatePicker,
  CitedText,
  type Claim,
  ClaimLedger,
  EvidencePanel,
  InsightCard,
  KnowledgeBase,
  type KnowledgeCollection,
  ModelComparison,
  NotificationCenter,
  QueryExpansion,
  type QueryExpansionTerm,
  RetrievalInspector,
  rewriteCitations,
  type SearchResult,
  SearchResultCard,
  SearchScope,
  type SearchScopeValue,
  SentimentBadge,
  SuggestionCard,
} from "../../src/index.js";
import { Demo, GallerySection } from "./section.js";

const HOUR = 3_600_000;

function KnowledgeDemo() {
  const [collections, setCollections] = useState<KnowledgeCollection[]>(() => [
    {
      id: "policies",
      name: "Store policies",
      description: "Returns, warranties and special orders",
      documents: [
        { id: "d1", name: "returns-policy.pdf", size: 182_000, status: "indexed", chunks: 24, updatedAt: Date.now() - 3 * 24 * HOUR },
        { id: "d2", name: "warranty-terms.docx", size: 64_000, status: "failed", error: "The file is password protected." },
        { id: "d3", name: "special-orders.md", size: 9000, status: "stale", chunks: 6, updatedAt: Date.now() - 40 * 24 * HOUR },
      ],
    },
    {
      id: "catalog",
      name: "Product catalog",
      description: "Orgill and local vendor items",
      documents: [
        { id: "d4", name: "paint-and-sundries.csv", size: 2_400_000, status: "processing", progress: 0.46 },
        { id: "d5", name: "hardware.csv", size: 5_100_000, status: "indexed", chunks: 812, updatedAt: Date.now() - 2 * HOUR },
      ],
    },
  ]);
  const [sources, setSources] = useState(["policies"]);
  const update = (collectionId: string, change: (collection: KnowledgeCollection) => KnowledgeCollection) => setCollections((list) => list.map((collection) => (collection.id === collectionId ? change(collection) : collection)));
  return (
    <KnowledgeBase
      className="w-full"
      collections={collections}
      sourceIds={sources}
      onSourceIdsChange={setSources}
      onUpload={(collectionId, files) => update(collectionId, (collection) => ({ ...collection, documents: [...collection.documents, ...files.map((file, index) => ({ id: `${file.name}-${index}-${collection.documents.length}`, name: file.name, size: file.size, status: "queued" as const }))] }))}
      onRetry={(collectionId, documentId) => update(collectionId, (collection) => ({ ...collection, documents: collection.documents.map((document) => (document.id === documentId ? { id: document.id, name: document.name, status: "processing" as const, progress: 0.1 } : document)) }))}
      onRemoveDocument={(collectionId, documentId) => update(collectionId, (collection) => ({ ...collection, documents: collection.documents.filter((document) => document.id !== documentId) }))}
      onReindex={(collectionId) =>
        new Promise<void>((resolve) =>
          setTimeout(() => {
            update(collectionId, (collection) => ({ ...collection, documents: collection.documents.map((document) => (document.status === "stale" ? { ...document, status: "indexed" as const } : document)) }));
            resolve();
          }, 800),
        )
      }
      onCreateCollection={(name) => setCollections((list) => [...list, { id: name.toLowerCase().replace(/\W+/g, "-"), name, documents: [] }])}
    />
  );
}

const RESULTS: SearchResult[] = [
  { id: "r1", title: "Exterior paint: choosing a finish", url: "https://www.example.com/guides/exterior-paint", source: "web", publishedAt: "Mar 2026", score: 0.86, snippet: "Satin exterior paint hides surface flaws better than gloss and cleans more easily than flat.", passages: [{ id: "p1", text: "For siding, a satin exterior paint balances durability with a forgiving finish. Gloss shows every flaw.", location: "Finishes" }, { id: "p2", text: "Apply exterior paint when it is above 50°F and no rain is expected for 24 hours.", location: "Weather" }] },
  { id: "r2", title: "Paint department pricing, October", source: "local", score: 0.74, snippet: "Exterior paint, satin, gallon: $42.99. Five-gallon: $189.00. Primer sold separately.", passages: [{ id: "p3", text: "Exterior paint, satin, gallon: $42.99. Five-gallon: $189.00. Primer sold separately. Contractor pricing at 10% off for accounts.", location: "page 3" }] },
];

function SearchDemo() {
  const [scope, setScope] = useState<SearchScopeValue>("both");
  const [added, setAdded] = useState<string[]>(["r2"]);
  const [terms, setTerms] = useState<QueryExpansionTerm[]>([
    { term: "house paint", reason: "synonym", enabled: true },
    { term: "siding", reason: "common surface", enabled: true },
    { term: "stain", reason: "related product", enabled: false },
  ]);
  const shown = RESULTS.filter((result) => scope === "both" || result.source === scope);
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <SearchScope value={scope} onValueChange={setScope} />
        <span className="text-sm text-muted-foreground">
          {added.length} added to context
        </span>
      </div>
      <QueryExpansion query="exterior paint" terms={terms} onToggle={(term, enabled) => setTerms((list) => list.map((item) => (item.term === term ? { ...item, enabled } : item)))} onSearchExact={() => setTerms((list) => list.map((item) => ({ ...item, enabled: false })))} />
      <div className="grid gap-3 md:grid-cols-2">
        {shown.map((result) => (
          <SearchResultCard key={result.id} result={result} query="exterior paint" added={added.includes(result.id)} onAddedChange={(next) => setAdded((list) => (next ? [...list, result.id] : list.filter((id) => id !== result.id)))} />
        ))}
      </div>
    </div>
  );
}

const ANSWER = "Satin is the better choice for siding [^guide] and costs $42.99 a gallon here [^pricing]. Contractors get 10% off [^pricing], and it should go on above 50°F [^guide]. Our competitor charges less [^rumor].";

function EvidenceDemo() {
  const evidence = useMemo(
    () => [
      { id: "guide", title: "Exterior paint: choosing a finish", url: "https://www.example.com/guides/exterior-paint", quote: "a satin exterior paint balances durability with a forgiving finish", location: "Finishes" },
      { id: "pricing", title: "Paint department pricing, October", quote: "Contractor pricing at 15% off for accounts", quoteVerified: false, location: "page 3" },
      { id: "weather", title: "Painting weather checklist", location: "Weather" },
      { id: "sds", title: "Safety data sheet", location: "Section 7" },
    ],
    [],
  );
  const cited = rewriteCitations(ANSWER, evidence.map((item) => item.id));
  const ordered = cited.order.map((citedId) => evidence.find((item) => item.id === citedId)!).concat(evidence.filter((item) => !cited.order.includes(item.id)));
  const [claims, setClaims] = useState<Claim[]>([
    { id: "c1", text: "Satin suits siding better than gloss.", status: "supported", sources: [1], confidence: 0.9 },
    { id: "c2", text: "Satin exterior paint is $42.99 a gallon.", status: "supported", sources: [2], confidence: 0.95 },
    { id: "c3", text: "Contractors get 10% off.", status: "contradicted", sources: [2], note: "The quote says 15%." },
    { id: "c4", text: "Paint above 50°F.", status: "unverified", sources: [1] },
  ]);
  return (
    <div className="grid w-full gap-4 md:grid-cols-2">
      <div className="flex flex-col gap-3">
        <CitedText text={cited.text} sourceTitles={ordered.map((item) => item.title)} idPrefix="gallery-answer" className="rounded-md border border-border bg-card p-3 text-sm" />
        <p className="text-xs text-muted-foreground">Unresolved citation removed: {cited.unresolved.join(", ")}</p>
        <EvidencePanel evidence={ordered} idPrefix="gallery-answer" coverage={0.75} limitations={["Competitor prices weren't searched.", "Weather guidance is general, not local."]} />
      </div>
      <ClaimLedger claims={claims} onDecide={(id, decision) => setClaims((list) => list.map((claim) => (claim.id === id ? { ...claim, status: decision } : claim)))} onCite={(n) => document.getElementById(`gallery-answer-evidence-${n}`)?.focus()} />
    </div>
  );
}

function InspectDemo() {
  const [preferred, setPreferred] = useState<string | undefined>(undefined);
  return (
    <div className="flex w-full flex-col gap-4">
      <RetrievalInspector
        trace={{
          query: "contractor discount exterior paint",
          strategies: ["hybrid", "rerank"],
          latencyMs: 212,
          entities: ["contractor", "exterior paint"],
          items: [
            { id: "1", title: "pricing-october.pdf, page 3", tier: "Documents", score: 0.91, confidence: 0.88, contribution: 0.52, excerpt: "Contractor pricing at 15% off for accounts." },
            { id: "2", title: "returns-policy.pdf, section 4", tier: "Documents", score: 0.48, contribution: 0.08 },
            { id: "3", title: "Dana asked about bulk paint orders", tier: "Recent conversation", score: 0.66, ageMs: 18 * 60_000, contribution: 0.25 },
            { id: "4", title: "Contractor accounts need a tax ID", tier: "Long-term memory", score: 0.59, confidence: 0.7, ageMs: 9 * 24 * HOUR, contribution: 0.15 },
          ],
          raw: { index: "store-knowledge", k: 8, filters: { collection: ["policies", "catalog"] }, rerank: { model: "rerank-v3", kept: 4 } },
        }}
      />
      <ModelComparison
        prompt="Write a two-sentence product blurb for satin exterior paint."
        preferredId={preferred}
        onPrefer={setPreferred}
        candidates={[
          { id: "a", model: "Claude Sonnet", output: "**Satin exterior paint** that shrugs off weather and hides imperfections.\n\nOne gallon covers up to 400 sq ft, and it cleans up with soap and water.", metrics: { quality: 0.91, evidence: 2, latencyMs: 2600, tokens: 820, cost: 0.0062 } },
          { id: "b", model: "Claude Haiku", output: "Durable satin finish for siding and trim. Covers 400 sq ft per gallon.", metrics: { quality: 0.78, evidence: 1, latencyMs: 900, tokens: 610, cost: 0.0011 } },
          { id: "c", model: "GPT mini", output: "", error: "Rate limited. Try again in 20 seconds." },
        ]}
      />
    </div>
  );
}

function InsightsDemo() {
  const [acknowledged, setAcknowledged] = useState(false);
  const [lastRun, setLastRun] = useState(() => Date.now() - 2 * HOUR);
  const [task, setTask] = useState({ due: "", owner: "Unassigned" });
  const [loadedAt] = useState(() => Date.now());
  return (
    <div className="grid w-full gap-4 md:grid-cols-2">
      <div className="flex flex-col gap-3">
        <AnalyzeButton
          label="Refresh all insights"
          lastRunAt={lastRun}
          onAnalyze={() =>
            new Promise((resolve) =>
              setTimeout(() => {
                setLastRun(Date.now());
                resolve({ failed: 1, total: 4 });
              }, 900),
            )
          }
        />
        <InsightCard
          title="Register 2 was short"
          severity="critical"
          summary="Register 2 came up $84.20 short on Friday's close, the third short day this month."
          details="Three sales were voided after 8 PM with no manager override. Two of them were cash."
          generatedAt={loadedAt - 40 * 60_000}
          metrics={[
            { label: "Short", value: "$84.20" },
            { label: "Voids", value: "3", hint: "after close" },
          ]}
          actions={[{ label: "Review voids", onClick: () => undefined, primary: true }]}
          acknowledged={acknowledged}
          onAcknowledge={() => setAcknowledged(true)}
          onRefresh={() => new Promise((resolve) => setTimeout(() => resolve(undefined), 700))}
        />
        <InsightCard title="Paint sales up" severity="positive" summary="Exterior paint sales are 18% above last October, led by satin finishes." generatedAt={loadedAt - 3 * HOUR} metrics={[{ label: "vs last year", value: "+18%" }]} />
      </div>
      <div className="flex flex-col gap-3">
        <SuggestionCard
          title="Suggested details for “Reorder satin exterior paint”"
          values={[
            { field: "due", label: "Due date", current: task.due, suggested: "Thursday", reason: "The supplier's truck comes Friday; orders close Thursday at noon." },
            { field: "owner", label: "Owner", current: task.owner, suggested: "Dana Reyes", reason: "Dana placed the last three paint orders." },
          ]}
          onApply={(values) => setTask({ due: values.due ?? "", owner: values.owner ?? "" })}
          onUndo={(previous) => setTask({ due: previous.due ?? "", owner: previous.owner ?? "" })}
        />
        <p className="text-xs text-muted-foreground">
          Task: due {task.due || "not set"}, owner {task.owner}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Reviews:</span>
          <SentimentBadge score={0.82} />
          <SentimentBadge score={0.05} />
          <SentimentBadge score={-0.64} showScore />
        </div>
      </div>
    </div>
  );
}

function CandidatesDemo() {
  const [matched, setMatched] = useState(2);
  const [choice, setChoice] = useState("");
  return (
    <div className="flex w-full max-w-2xl flex-col gap-2">
      <CandidatePicker
        key={matched}
        question={`Which “3/4 in. PVC elbow” did you mean? (item ${matched + 1} of 5)`}
        progress={{ matched, total: 5 }}
        candidates={[
          { id: "pv-34-90", title: "PVC elbow 90°, 3/4 in.", subtitle: "Schedule 40, slip x slip", sku: "PV-34-90", price: 1.29, matched: "Exact size" },
          { id: "pv-34-45", title: "PVC elbow 45°, 3/4 in.", subtitle: "Schedule 40, slip x slip", sku: "PV-34-45", price: 1.19, matched: "Same size" },
          { id: "pv-34-90t", title: "PVC elbow 90°, 3/4 in., threaded", subtitle: "Schedule 40, FPT x FPT", sku: "PV-34-90T", price: 2.49 },
        ]}
        onSelect={(id) =>
          new Promise<void>((resolve) =>
            setTimeout(() => {
              setChoice(id);
              setMatched((value) => Math.min(5, value + 1));
              resolve();
            }, 600),
          )
        }
        onNone={() => setChoice("none")}
        onReport={() => setChoice("reported")}
      />
      {choice && <p className="text-xs text-muted-foreground">Last choice: {choice}</p>}
    </div>
  );
}

const NODES: AgentNode[] = [
  { id: "lead", label: "Planner", role: "Lead", model: "Claude Opus", status: "complete", turns: 2, steps: 4, elapsedMs: 48_000, cost: 0.31 },
  { id: "pricing", label: "Price researcher", role: "Researcher", model: "Claude Sonnet", status: "complete", turns: 3, steps: 9, elapsedMs: 96_000, cost: 0.18 },
  { id: "stock", label: "Inventory analyst", role: "Analyst", model: "Claude Haiku", status: "running", turns: 2, steps: 5, elapsedMs: 41_000, cost: 0.03 },
  { id: "writer", label: "Report writer", role: "Writer", model: "Claude Sonnet", status: "pending" },
  { id: "review", label: "Reviewer", role: "Reviewer", model: "Claude Haiku", status: "pending" },
];

const EDGES: AgentEdge[] = [
  { from: "lead", to: "pricing", label: "questions" },
  { from: "lead", to: "stock", label: "SKUs" },
  { from: "pricing", to: "writer", label: "prices" },
  { from: "stock", to: "writer", label: "stock levels" },
  { from: "writer", to: "review", label: "draft" },
  { from: "review", to: "writer", label: "edits" },
];

function AgentsDemo() {
  const [status, setStatus] = useState<AgentRunStatus>("running");
  const [selected, setSelected] = useState("stock");
  const [limit, setLimit] = useState(0.5);
  const [startedAt] = useState(() => Date.now() - 3 * 60_000);
  const spent = NODES.reduce((sum, node) => sum + (node.cost ?? 0), 0);
  return (
    <AgentRunView
      className="w-full"
      nodes={NODES}
      edges={EDGES}
      status={spent >= limit && status === "running" ? "paused" : status}
      startedAt={startedAt}
      budget={{ spent, limit }}
      selectedId={selected}
      onSelect={setSelected}
      onPause={() => setStatus("paused")}
      onResume={() => setStatus("running")}
      onStop={() => setStatus("stopped")}
      onContinueWithBudget={(extra) => {
        setLimit((value) => value + extra);
        setStatus("running");
      }}
      continueAmount={1}
    />
  );
}

function NotificationsDemo() {
  const [items, setItems] = useState<AppNotification[]>(() => [
    { id: "n1", title: "Restock report ready", body: "37 items are below their reorder point.", createdAt: Date.now() - 6 * 60_000, read: false, tone: "info" },
    { id: "n2", title: "Register 2 short $84.20", body: "Friday's close didn't balance.", createdAt: Date.now() - 50 * 60_000, read: false, tone: "danger" },
    { id: "n3", title: "Orgill delivery arrived", createdAt: Date.now() - 5 * HOUR, read: true, tone: "success" },
  ]);
  const [opened, setOpened] = useState("");
  const [more, setMore] = useState(true);
  return (
    <div className="flex items-center gap-3 text-sm">
      <NotificationCenter
        notifications={items}
        onMarkRead={(id) => setItems((list) => list.map((item) => (item.id === id ? { ...item, read: true } : item)))}
        onMarkAllRead={() => setItems((list) => list.map((item) => ({ ...item, read: true })))}
        onOpen={(item) => setOpened(item.title)}
        hasMore={more}
        onLoadMore={() => {
          setItems((list) => [...list, { id: "n4", title: "Price change from Orgill", body: "12 paint SKUs went up 4%.", createdAt: Date.now() - 26 * HOUR, read: false, tone: "warning" }]);
          setMore(false);
        }}
      />
      <span className="text-muted-foreground">{opened ? `Opened: ${opened}` : "Open the bell to see notifications."}</span>
    </div>
  );
}

export function KnowledgeGallery() {
  return (
    <GallerySection id="gallery-knowledge" title="Knowledge, evidence, insights and agents">
      <Demo title="Knowledge base" className="flex w-full">
        <KnowledgeDemo />
      </Demo>
      <Demo title="Search results, scope and query expansion" className="flex w-full">
        <SearchDemo />
      </Demo>
      <Demo title="Citations, evidence and claims" className="flex w-full">
        <EvidenceDemo />
      </Demo>
      <Demo title="Retrieval inspector and model comparison" className="flex w-full">
        <InspectDemo />
      </Demo>
      <Demo title="Insights, suggestions and sentiment" className="flex w-full">
        <InsightsDemo />
      </Demo>
      <Demo title="Candidate picker" className="flex w-full">
        <CandidatesDemo />
      </Demo>
      <Demo title="Agent graph and run" className="flex w-full">
        <AgentsDemo />
      </Demo>
      <Demo title="Notification center">
        <NotificationsDemo />
      </Demo>
    </GallerySection>
  );
}
