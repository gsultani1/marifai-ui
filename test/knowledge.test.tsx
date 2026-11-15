// packages/ai-ui/test/knowledge.test.tsx
import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AgentGraph,
  AgentRunView,
  AnalyzeButton,
  type AppNotification,
  badgeCount,
  bestByMetric,
  CandidatePicker,
  CitedText,
  type Claim,
  claimCoverage,
  ClaimLedger,
  collectionHealth,
  displayHost,
  EvidencePanel,
  highlightTerms,
  InsightCard,
  KnowledgeBase,
  layoutLayers,
  ModelComparison,
  NotificationCenter,
  QueryExpansion,
  queryTerms,
  RetrievalInspector,
  rewriteCitations,
  SearchResultCard,
  SearchScope,
  SentimentBadge,
  sentimentLabel,
  splitCitationNumbers,
  SuggestionCard,
  useNotificationPolling,
} from "../src/index.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("citations and evidence", () => {
  it("numbers citations in order of first use and drops unknown ones", () => {
    const result = rewriteCitations("Sales rose [^q3] and margins held [cite: q2, q3] per the memo【memo】 and a rumor [^nope].", ["q2", "q3", "memo"]);
    expect(result.text).toBe("Sales rose [1] and margins held [2][1] per the memo[3] and a rumor.");
    expect(result.order).toEqual(["q3", "q2", "memo"]);
    expect(result.unresolved).toEqual(["nope"]);
    expect(splitCitationNumbers("A [1] b [12].")).toEqual([{ text: "A " }, { citation: 1 }, { text: " b " }, { citation: 12 }, { text: "." }]);
    expect(displayHost("https://www.example.com/a")).toBe("example.com");
  });

  it("flags unverified quotes, folds extra sources and jumps from citations", () => {
    const evidence = [
      { id: "a", title: "Q3 sales report", url: "https://example.com/q3", quote: "Revenue grew 12%", location: "page 2" },
      { id: "b", title: "Board memo", quote: "Margins held at 31%", quoteVerified: false },
      { id: "c", title: "Supplier email" },
      { id: "d", title: "Inventory export" },
    ];
    render(
      <>
        <CitedText text="Revenue grew [1] while margins held [2]." sourceTitles={evidence.map((item) => item.title)} idPrefix="answer" />
        <EvidencePanel evidence={evidence} idPrefix="answer" coverage={0.75} limitations={["No data for October yet."]} />
      </>,
    );
    expect(screen.getByRole("note").textContent).toContain("One quote wasn't found in its source.");
    expect(screen.getByText("(not found in source)")).toBeTruthy();
    expect(screen.getByRole("meter", { name: "Claims backed by sources" }).getAttribute("aria-valuenow")).toBe("75");
    expect(screen.queryByText("Inventory export")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show 1 more" }));
    expect(screen.getByText("Inventory export")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Source 2: Board memo" }));
    expect(document.activeElement?.id).toBe("answer-evidence-2");
    expect(screen.getByText("No data for October yet.")).toBeTruthy();
  });

  it("settles claims and tracks coverage", () => {
    const claims: Claim[] = [
      { id: "1", text: "Revenue grew 12% in Q3.", status: "supported", sources: [1], confidence: 0.92 },
      { id: "2", text: "Margins held at 31%.", status: "unverified", sources: [2] },
      { id: "3", text: "Competitors cut prices.", status: "contradicted", note: "Source says prices rose" },
    ];
    expect(claimCoverage(claims)).toEqual({ covered: 1 / 3, settled: false });
    const onDecide = vi.fn();
    const onCite = vi.fn();
    render(<ClaimLedger claims={claims} onDecide={onDecide} onCite={onCite} />);
    expect(screen.getByRole("status").textContent).toBe("2 still need a decision");
    fireEvent.click(screen.getByRole("button", { name: "Accept: Margins held at 31%." }));
    expect(onDecide).toHaveBeenCalledWith("2", "accepted");
    fireEvent.click(screen.getByRole("button", { name: "Source 1" }));
    expect(onCite).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole("radio", { name: "Settled" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });
});

describe("knowledge and search", () => {
  it("summarizes collections, toggles sources and manages documents", async () => {
    expect(collectionHealth([{ id: "a", name: "a", status: "indexed" }, { id: "b", name: "b", status: "failed" }])).toBe("failed");
    const onSourceIdsChange = vi.fn();
    const onRetry = vi.fn();
    const onRemoveDocument = vi.fn();
    const onCreateCollection = vi.fn();
    render(
      <KnowledgeBase
        collections={[
          { id: "policies", name: "Store policies", documents: [{ id: "d1", name: "returns.pdf", status: "indexed", chunks: 24, size: 120_000 }, { id: "d2", name: "warranty.docx", status: "failed", error: "Couldn't read the file" }] },
          { id: "catalog", name: "Catalog", documents: [{ id: "d3", name: "paint.csv", status: "processing", progress: 0.4 }] },
        ]}
        sourceIds={["policies"]}
        onSourceIdsChange={onSourceIdsChange}
        onRetry={onRetry}
        onRemoveDocument={onRemoveDocument}
        onCreateCollection={onCreateCollection}
        onUpload={vi.fn()}
      />,
    );
    const collections = screen.getByRole("list", { name: "Collections" });
    expect(within(collections).getByText(/Failed · 2 documents/)).toBeTruthy();
    fireEvent.click(within(collections).getByRole("checkbox", { name: "Use Catalog as a source" }));
    expect(onSourceIdsChange).toHaveBeenCalledWith(["policies", "catalog"]);
    expect(screen.getByText("Couldn't read the file")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry warranty.docx" }));
    expect(onRetry).toHaveBeenCalledWith("policies", "d2");
    fireEvent.click(within(collections).getByRole("button", { name: /^Catalog/ }));
    expect(screen.getByRole("progressbar", { name: "Indexing paint.csv" }).getAttribute("aria-valuenow")).toBe("40");
    fireEvent.click(screen.getByRole("button", { name: "Remove paint.csv" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(onRemoveDocument).toHaveBeenCalledWith("catalog", "d3"));
    fireEvent.click(screen.getByRole("button", { name: "New collection" }));
    fireEvent.change(screen.getByLabelText("Collection name"), { target: { value: "Supplier terms" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(onCreateCollection).toHaveBeenCalledWith("Supplier terms");
  });

  it("highlights query terms, previews passages and adds results to context", async () => {
    expect(queryTerms('"exterior paint" price a')).toEqual(["exterior paint", "price"]);
    expect(highlightTerms("Exterior paint prices", ["exterior paint", "price"])).toEqual([
      { text: "Exterior paint", match: true },
      { text: " ", match: false },
      { text: "price", match: true },
      { text: "s", match: false },
    ]);
    function Demo() {
      const [added, setAdded] = useState(false);
      return (
        <SearchResultCard
          query="exterior paint"
          added={added}
          onAddedChange={setAdded}
          result={{ id: "r1", title: "Choosing exterior paint", url: "https://www.example.com/guide", source: "web", snippet: "Exterior paint lasts longer when...", score: 0.82, passages: [{ id: "p1", text: "Use exterior paint above 50°F.", location: "section 2" }, { id: "p2", text: "Two coats of exterior paint last ten years." }] }}
        />
      );
    }
    render(<Demo />);
    expect(screen.getByText("example.com")).toBeTruthy();
    expect(screen.getByText("82% match")).toBeTruthy();
    expect(screen.getAllByText("paint", { selector: "mark" }).length).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole("button", { name: "Read 2 passages from Choosing exterior paint" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Passage 1 of 2/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Next passage" }));
    expect(within(dialog).getByLabelText("Passage").textContent).toBe("Two coats of exterior paint last ten years.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Add to context" }));
    expect(within(dialog).getByRole("button", { name: "Added to context" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Added to context: Choosing exterior paint", hidden: true }).getAttribute("aria-pressed")).toBe("true");
  });

  it("switches scope and toggles expanded terms", () => {
    const onScope = vi.fn();
    render(<SearchScope value="local" onValueChange={onScope} />);
    fireEvent.click(screen.getByRole("radio", { name: "Both" }));
    expect(onScope).toHaveBeenCalledWith("both");
    const onToggle = vi.fn();
    const onSearchExact = vi.fn();
    render(<QueryExpansion query="deck stain" terms={[{ term: "wood sealer", enabled: true }, { term: "Thompson's", enabled: false, reason: "brand" }]} onToggle={onToggle} onSearchExact={onSearchExact} />);
    fireEvent.click(screen.getByRole("button", { name: "wood sealer" }));
    expect(onToggle).toHaveBeenCalledWith("wood sealer", false);
    expect(screen.getByRole("button", { name: "Thompson's" }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: 'Search only "deck stain"' }));
    expect(onSearchExact).toHaveBeenCalled();
  });

  it("inspects retrieval by tier with the raw response", () => {
    render(
      <RetrievalInspector
        trace={{
          query: "return policy for paint",
          strategies: ["hybrid", "rerank"],
          latencyMs: 184,
          entities: ["paint"],
          items: [
            { id: "1", title: "returns.pdf §3", tier: "Documents", score: 0.91, contribution: 0.6, excerpt: "Opened paint can be returned within 30 days" },
            { id: "2", title: "Customer asked about returns", tier: "Recent conversation", score: 0.55, ageMs: 120_000 },
          ],
          raw: { hits: 2 },
        }}
      />,
    );
    expect(screen.getByText("2 items · 184 ms")).toBeTruthy();
    expect(screen.getByText("score 0.91")).toBeTruthy();
    expect(screen.getByText("2m 00s old")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Raw response" }));
    expect(screen.getByRole("tree", { name: "Raw retrieval response" })).toBeTruthy();
  });
});

describe("comparison, insights and suggestions", () => {
  it("marks the best value per metric and records a preference", () => {
    const candidates = [
      { id: "a", model: "Claude Sonnet", output: "**Answer A**", metrics: { quality: 0.9, latencyMs: 2400, cost: 0.02 } },
      { id: "b", model: "Claude Haiku", output: "Answer B", metrics: { quality: 0.7, latencyMs: 800, cost: 0.004 } },
      { id: "c", model: "GPT mini", output: "", error: "Rate limited" },
    ];
    expect(bestByMetric(candidates)).toEqual({ quality: ["a"], evidence: [], latencyMs: ["b"], tokens: [], cost: ["b"] });
    const onPrefer = vi.fn();
    render(<ModelComparison prompt="Summarize Q3" candidates={candidates} onPrefer={onPrefer} preferredId="a" />);
    const sonnet = screen.getByRole("listitem", { name: "Claude Sonnet" });
    expect(within(sonnet).getAllByText("(best)")).toHaveLength(1);
    expect(within(sonnet).getByText("Answer A").tagName).toBe("STRONG");
    expect(within(screen.getByRole("listitem", { name: "GPT mini" })).getByRole("alert").textContent).toContain("Rate limited");
    fireEvent.click(screen.getByRole("button", { name: "Prefer Claude Haiku" }));
    expect(onPrefer).toHaveBeenCalledWith("b");
  });

  it("shows an insight with details, actions and acknowledgement, and analyzes with partial failures", async () => {
    const onAcknowledge = vi.fn();
    const onAction = vi.fn();
    const { rerender } = render(<InsightCard title="Cash drawer short" severity="critical" summary="Register 2 was $84 short on Friday." details="Three voided sales after close." metrics={[{ label: "Short", value: "$84" }]} actions={[{ label: "Review voids", onClick: onAction, primary: true }]} onAcknowledge={onAcknowledge} />);
    expect(screen.getByText("Urgent")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Why?" }));
    expect(screen.getByText("Three voided sales after close.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Review voids" }));
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge" }));
    expect(onAction).toHaveBeenCalled();
    expect(onAcknowledge).toHaveBeenCalled();
    rerender(<InsightCard title="Cash drawer short" severity="critical" summary="Register 2 was $84 short on Friday." acknowledged />);
    expect(screen.getByText("Acknowledged")).toBeTruthy();
    const onAnalyze = vi.fn().mockResolvedValueOnce({ failed: 1, total: 3 }).mockResolvedValueOnce(undefined);
    render(<AnalyzeButton label="Refresh all" onAnalyze={onAnalyze} />);
    fireEvent.click(screen.getByRole("button", { name: "Refresh all" }));
    expect(await screen.findByText("1 of 3 parts couldn't be analyzed.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Refresh all" }));
    expect(await screen.findByText(/Updated/)).toBeTruthy();
  });

  it("applies, edits and undoes suggested values", () => {
    const onApply = vi.fn();
    const onUndo = vi.fn();
    render(<SuggestionCard title="Suggested task details" values={[{ field: "due", label: "Due date", current: "", suggested: "Friday", reason: "Delivery arrives Thursday" }, { field: "owner", label: "Owner", current: "Unassigned", suggested: "Dana" }]} onApply={onApply} onUndo={onUndo} />);
    expect(screen.getByText("Delivery arrives Thursday")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Use as a starting point" }));
    fireEvent.change(screen.getByLabelText("Owner"), { target: { value: "Lee" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply edited" }));
    expect(onApply).toHaveBeenCalledWith({ due: "Friday", owner: "Lee" });
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalledWith({ due: "", owner: "Unassigned" });
    expect(screen.getByRole("button", { name: "Apply" })).toBeTruthy();
  });

  it("keeps undo available when the parent re-renders with the applied values", () => {
    function Demo() {
      const [owner, setOwner] = useState("Unassigned");
      return (
        <>
          <SuggestionCard title="Suggested owner" values={[{ field: "owner", label: "Owner", current: owner, suggested: "Dana" }]} onApply={(values) => setOwner(values.owner ?? "")} onUndo={(previous) => setOwner(previous.owner ?? "")} />
          <output>{owner}</output>
        </>
      );
    }
    render(<Demo />);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getAllByRole("status").map((element) => element.textContent)).toEqual(["Applied the suggested value.Undo", "Dana"]);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getAllByRole("status").map((element) => element.textContent)).toEqual(["Unassigned"]);
  });

  it("names sentiment in words", () => {
    expect([sentimentLabel(0.8), sentimentLabel(0), sentimentLabel(-0.6)]).toEqual(["Positive", "Neutral", "Negative"]);
    render(<SentimentBadge score={-0.62} />);
    expect(screen.getByText("Negative").closest("[data-slot=sentiment-badge]")?.textContent).toBe("Negative, score -0.62");
  });

  it("picks a candidate, locks while saving and reports errors", async () => {
    let finish: () => void = () => undefined;
    const onSelect = vi.fn().mockRejectedValueOnce(new Error("Item is out of stock")).mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
    render(
      <CandidatePicker
        question="Which 3/4 in. PVC elbow did you mean?"
        progress={{ matched: 2, total: 5 }}
        candidates={[
          { id: "a", title: "PVC elbow 90°, 3/4 in.", sku: "PV-34-90", price: 1.29, matched: "Exact size" },
          { id: "b", title: "PVC elbow 45°, 3/4 in.", sku: "PV-34-45", price: 1.19 },
        ]}
        onSelect={onSelect}
        onNone={vi.fn()}
      />,
    );
    expect(screen.getByText("2 of 5 matched")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Use this one" })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("radio", { name: /PVC elbow 90°/ }));
    fireEvent.click(screen.getByRole("button", { name: "Use this one" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Item is out of stock");
    fireEvent.click(screen.getByRole("button", { name: "Use this one" }));
    await waitFor(() => expect(screen.getByRole("radio", { name: /PVC elbow 45°/ }).matches(":disabled")).toBe(true));
    await act(async () => finish());
    expect(screen.getByRole("radio", { name: /PVC elbow 45°/ }).matches(":disabled")).toBe(false);
    expect(onSelect).toHaveBeenLastCalledWith("a");
  });
});

describe("agent graph", () => {
  const nodes = [
    { id: "plan", label: "Planner", role: "Lead", status: "complete" as const, steps: 3, turns: 2, cost: 0.04 },
    { id: "research", label: "Researcher", status: "running" as const, steps: 5, turns: 4, cost: 0.12 },
    { id: "data", label: "Analyst", status: "pending" as const },
    { id: "write", label: "Writer", status: "pending" as const },
  ];
  const edges = [
    { from: "plan", to: "research", label: "questions" },
    { from: "plan", to: "data" },
    { from: "research", to: "write", label: "findings" },
    { from: "data", to: "write" },
    { from: "write", to: "plan", label: "draft" },
  ];

  it("lays nodes out in layers despite cycles", () => {
    const positions = layoutLayers(nodes, edges);
    expect(Object.fromEntries([...positions].map(([id, position]) => [id, position.layer]))).toEqual({ plan: 0, research: 1, data: 1, write: 2 });
    expect(positions.get("research")?.order).not.toBe(positions.get("data")?.order);
  });

  it("describes connections and moves focus with the arrow keys", () => {
    const onSelect = vi.fn();
    render(<AgentGraph nodes={nodes} edges={edges} onSelect={onSelect} selectedId="plan" />);
    const planner = screen.getByRole("button", { name: /Planner/ });
    expect(planner.getAttribute("aria-pressed")).toBe("true");
    expect(document.getElementById(planner.getAttribute("aria-describedby")!)?.textContent).toBe("Receives from Writer. Sends to Researcher (questions), Analyst.");
    act(() => planner.focus());
    fireEvent.keyDown(planner, { key: "ArrowRight" });
    expect(document.activeElement?.textContent).toContain("Researcher");
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(document.activeElement?.textContent).toContain("Analyst");
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    expect(document.activeElement?.textContent).toContain("Writer");
    fireEvent.click(document.activeElement!);
    expect(onSelect).toHaveBeenCalledWith("write");
  });

  it("runs with controls, totals and continuing past the budget", () => {
    const onPause = vi.fn();
    const onContinueWithBudget = vi.fn();
    const { rerender } = render(<AgentRunView nodes={nodes} edges={edges} status="running" onPause={onPause} onStop={vi.fn()} />);
    expect(screen.getByText("6 turns · 8 steps · $0.16")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(onPause).toHaveBeenCalled();
    rerender(<AgentRunView nodes={nodes} edges={edges} status="paused" budget={{ spent: 2, limit: 2 }} onResume={vi.fn()} onContinueWithBudget={onContinueWithBudget} continueAmount={1} selectedId="research" />);
    expect(screen.queryByRole("button", { name: "Resume" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Continue with $1.00 more" }));
    expect(onContinueWithBudget).toHaveBeenCalledWith(1);
    expect(screen.getByText("In progress", { selector: "dd" })).toBeTruthy();
  });
});

describe("notifications", () => {
  const notifications: AppNotification[] = [
    { id: "n1", title: "Restock report ready", body: "37 items below reorder point", createdAt: Date.now() - 5 * 60_000, read: false },
    { id: "n2", title: "Delivery arrived", createdAt: Date.now() - 2 * 3_600_000, read: true },
    { id: "n3", title: "Price change from supplier", createdAt: Date.now() - 60_000, read: false, href: "/suppliers/orgill" },
  ];

  it("caps the badge", () => {
    expect([badgeCount(0), badgeCount(7), badgeCount(140)]).toEqual(["", "7", "99+"]);
  });

  it("lists, filters and marks notifications read", async () => {
    const onMarkRead = vi.fn();
    const onMarkAllRead = vi.fn();
    const onOpen = vi.fn();
    render(<NotificationCenter notifications={notifications} onMarkRead={onMarkRead} onMarkAllRead={onMarkAllRead} onOpen={onOpen} hasMore onLoadMore={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Notifications, 2 unread" }));
    const list = await screen.findByRole("list", { name: "All notifications" });
    expect(within(list).getAllByRole("listitem").map((item) => item.querySelector(".text-sm")?.firstChild?.textContent)).toEqual(["Price change from supplier", "Restock report ready", "Delivery arrived"]);
    fireEvent.click(within(list).getByRole("button", { name: /Restock report ready ?, unread/ }));
    expect(onMarkRead).toHaveBeenCalledWith("n1");
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "n1" }));
    fireEvent.click(screen.getByRole("radio", { name: "Unread (2)" }));
    expect(within(screen.getByRole("list", { name: "Unread notifications" })).getAllByRole("listitem")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Mark all read" }));
    expect(onMarkAllRead).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Load more" })).toBeTruthy();
  });

  it("polls faster while open, pauses while hidden and refreshes on focus", () => {
    vi.useFakeTimers();
    const poll = vi.fn();
    const { rerender } = renderHook((props: { open: boolean }) => useNotificationPolling(poll, { open: props.open, openIntervalMs: 1000, closedIntervalMs: 5000 }), { initialProps: { open: false } });
    act(() => vi.advanceTimersByTime(4999));
    expect(poll).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(poll).toHaveBeenCalledTimes(1);
    rerender({ open: true });
    expect(poll).toHaveBeenCalledTimes(2);
    act(() => vi.advanceTimersByTime(1000));
    expect(poll).toHaveBeenCalledTimes(3);
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => vi.advanceTimersByTime(3000));
    expect(poll).toHaveBeenCalledTimes(3);
    visibility.mockReturnValue("visible");
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(poll).toHaveBeenCalledTimes(4);
  });
});
