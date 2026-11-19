// packages/ai-ui/test/agent-ops.test.tsx
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  AgentArtifactInbox,
  AgentAttentionQueue,
  AgentEscalationCard,
  AgentMailbox,
  AgentRunComparison,
  AgentRunEventStream,
  AgentRunQueue,
  AgentTraceTree,
  DelegationRequestEditor,
  DelegationTree,
  McpResourceSubscriptions,
  RunArtifactManifest,
  RunBudgetBreakdown,
  RunDependencyInspector,
  RunRecoveryPanel,
  TraceSpanDetails,
  WorkerPoolStatus,
  type AgentInboxArtifact,
  type AgentMailboxMessage,
  type AgentQueueRun,
  type AgentTraceSpan,
  type DelegationRun,
  type DisplayedRunEvent,
  type ManifestArtifact,
  type McpResourceSubscription,
  type ReportedWorker,
} from "../src/index.js";

const select = (name: string) => screen.getByRole("combobox", { name }) as HTMLSelectElement;
const button = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;
const itemTexts = () => screen.getAllByRole("listitem").map((item) => item.textContent);

describe("AgentArtifactInbox", () => {
  const artifacts: AgentInboxArtifact[] = [
    { id: "a1", title: "Q3 churn analysis", agent: "Research agent", kind: "report" },
    { id: "a2", title: "Pricing experiments", agent: "Data agent", kind: "dataset" },
    { id: "a3", title: "Support macro draft", agent: "Support agent", kind: "report", available: false },
  ];

  it("lists each artifact with its agent and kind, filters by kind and search, and opens the chosen artifact by id", () => {
    const onOpen = vi.fn();
    render(<AgentArtifactInbox artifacts={artifacts} onOpen={onOpen} />);
    expect(screen.getByRole("region", { name: "Agent artifacts" })).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("Research agent · report")).toBeTruthy();
    fireEvent.click(button("Open Q3 churn analysis"));
    expect(onOpen).toHaveBeenCalledWith("a1");

    fireEvent.change(select("Kind"), { target: { value: "dataset" } });
    expect(itemTexts()).toEqual(["Pricing experimentsData agent · datasetOpen"]);
    fireEvent.change(select("Kind"), { target: { value: "" } });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search artifacts" }), { target: { value: "support agent" } });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("Support macro draft")).toBeTruthy();
  });

  it("says an artifact is unavailable in text and does not open it", () => {
    const onOpen = vi.fn();
    render(<AgentArtifactInbox artifacts={artifacts} onOpen={onOpen} />);
    expect(screen.getByText("Support agent · report · Unavailable")).toBeTruthy();
    const open = button("Open Support macro draft");
    expect(open.disabled).toBe(true);
    fireEvent.click(open);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("tells an empty inbox apart from a search with no matches", () => {
    const { rerender } = render(<AgentArtifactInbox artifacts={[]} onOpen={vi.fn()} />);
    expect(screen.getByText("No agent artifacts yet.")).toBeTruthy();
    rerender(<AgentArtifactInbox artifacts={artifacts} onOpen={vi.fn()} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search artifacts" }), { target: { value: "invoice" } });
    expect(screen.getByText("No matching artifacts.")).toBeTruthy();
  });
});

describe("AgentAttentionQueue", () => {
  it("names each action after its reason and run and reports the id and reason", () => {
    const onOpen = vi.fn();
    render(<AgentAttentionQueue onOpen={onOpen} items={[
      { id: "r1", title: "Refund triage", reason: "answer", detail: "Asked which refund policy applies" },
      { id: "r2", title: "Vendor email", reason: "approval" },
      { id: "r3", title: "Nightly sync", reason: "retry", detail: "Timed out after 3 attempts" },
    ]} />);
    expect(screen.getByRole("region", { name: "Runs needing attention" })).toBeTruthy();
    expect(screen.getByText("Asked which refund policy applies")).toBeTruthy();
    fireEvent.click(button("Answer Refund triage"));
    fireEvent.click(button("Review approval Vendor email"));
    fireEvent.click(button("Review retry Nightly sync"));
    expect(onOpen.mock.calls).toEqual([["r1", "answer"], ["r2", "approval"], ["r3", "retry"]]);
  });

  it("shows an empty state when no runs need attention", () => {
    render(<AgentAttentionQueue items={[]} onOpen={vi.fn()} />);
    expect(screen.getByText("No runs need attention.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("AgentEscalationCard", () => {
  const decisions = [
    { id: "extend", label: "Extend budget", effect: "Adds $20 and continues the run" },
    { id: "stop", label: "Stop run", effect: "Cancels remaining steps" },
    { id: "handoff", label: "Hand off to a person", effect: "Assigns the run to support", unavailableReason: "No one is on call" },
  ];

  it("lists each decision with its effect and keeps submit disabled until an available decision is chosen", () => {
    render(<AgentEscalationCard escalationId="esc-1" title="Budget limit reached" description="The research run used its $50 budget."
      decisions={decisions} onDecide={vi.fn()} />);
    expect(screen.getByRole("region", { name: "Agent escalation" })).toBeTruthy();
    expect(screen.getByText("The research run used its $50 budget.")).toBeTruthy();
    expect(screen.getByText("Assigns the run to support · No one is on call")).toBeTruthy();
    expect(button("Submit decision").disabled).toBe(true);
    expect((screen.getByRole("option", { name: "Hand off to a person" }) as HTMLOptionElement).disabled).toBe(true);
    fireEvent.change(select("Decision"), { target: { value: "handoff" } });
    expect(select("Decision").value).toBe("");
    expect(button("Submit decision").disabled).toBe(true);
  });

  it("sends the escalation and decision ids and clears the choice once the decision is accepted", async () => {
    const onDecide = vi.fn().mockResolvedValue(undefined);
    render(<AgentEscalationCard escalationId="esc-1" title="Budget limit reached" description="Choose how to continue."
      decisions={decisions} onDecide={onDecide} />);
    fireEvent.change(select("Decision"), { target: { value: "extend" } });
    expect(button("Submit decision").disabled).toBe(false);
    await act(async () => { fireEvent.click(button("Submit decision")); });
    expect(onDecide).toHaveBeenCalledWith("esc-1", "extend");
    expect(select("Decision").value).toBe("");
    expect(button("Submit decision").disabled).toBe(true);
  });

  it("shows a failed decision as an alert and keeps the choice for another try", async () => {
    const onDecide = vi.fn().mockRejectedValue(new Error("The run already finished."));
    render(<AgentEscalationCard escalationId="esc-1" title="Budget limit reached" description="Choose how to continue."
      decisions={decisions} onDecide={onDecide} />);
    fireEvent.change(select("Decision"), { target: { value: "stop" } });
    await act(async () => { fireEvent.click(button("Submit decision")); });
    expect(screen.getByRole("alert").textContent).toBe("The run already finished.");
    expect(select("Decision").value).toBe("stop");
  });

  it("drops the choice when a different escalation is shown", () => {
    const { rerender } = render(<AgentEscalationCard escalationId="esc-1" title="Budget limit reached" description="Choose."
      decisions={decisions} onDecide={vi.fn()} />);
    fireEvent.change(select("Decision"), { target: { value: "stop" } });
    rerender(<AgentEscalationCard escalationId="esc-2" title="Unknown tool requested" description="Choose."
      decisions={decisions} onDecide={vi.fn()} />);
    expect(select("Decision").value).toBe("");
    expect(button("Submit decision").disabled).toBe(true);
  });

  it("says when no decisions are available", () => {
    render(<AgentEscalationCard escalationId="esc-1" title="Budget limit reached" description="Choose." decisions={[]} onDecide={vi.fn()} />);
    expect(screen.getByText("No decisions available.")).toBeTruthy();
    expect(button("Submit decision").disabled).toBe(true);
  });
});

describe("AgentMailbox", () => {
  const messages: AgentMailboxMessage[] = [
    { id: "m1", agentId: "research", agent: "Research agent", subject: "Competitor pricing summary", excerpt: "Three vendors raised prices", unread: true },
    { id: "m2", agentId: "support", agent: "Support agent", subject: "Escalated ticket", unread: false },
    { id: "m3", agentId: "research", agent: "Research agent", subject: "Sources for the churn memo", unread: false },
  ];

  it("filters by agent, unread state and search, announces the match count and opens a message by id", () => {
    const onOpen = vi.fn();
    render(<AgentMailbox messages={messages} onOpen={onOpen} />);
    expect(screen.getByRole("region", { name: "Agent mailbox" })).toBeTruthy();
    expect(screen.getByText("Research agent · Unread · Three vendors raised prices")).toBeTruthy();
    expect(screen.getByRole("status").textContent?.trim()).toBe("");

    fireEvent.change(select("Agent"), { target: { value: "research" } });
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("status").textContent?.trim()).toBe("2 matching messages");
    fireEvent.click(screen.getByRole("checkbox", { name: "Unread only" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("status").textContent?.trim()).toBe("1 matching message");
    fireEvent.click(button("Open Competitor pricing summary"));
    expect(onOpen).toHaveBeenCalledWith("m1");

    fireEvent.click(screen.getByRole("checkbox", { name: "Unread only" }));
    fireEvent.change(select("Agent"), { target: { value: "" } });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search agent messages" }), { target: { value: "ticket" } });
    expect(screen.getAllByRole("listitem").map((item) => within(item).getByRole("button").getAttribute("aria-label"))).toEqual(["Open Escalated ticket"]);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search agent messages" }), { target: { value: "invoice" } });
    expect(screen.getByText("No matching messages.")).toBeTruthy();
  });

  it("shows an empty mailbox with only the all agents choice", () => {
    render(<AgentMailbox messages={[]} onOpen={vi.fn()} />);
    expect(screen.getByText("No agent messages yet.")).toBeTruthy();
    expect(within(select("Agent")).getAllByRole("option").map((option) => option.textContent)).toEqual(["All agents"]);
  });
});

describe("AgentRunComparison", () => {
  it("labels each run's side by its name and formats elapsed time, tool calls and cost", () => {
    render(<AgentRunComparison currency="USD"
      left={{ label: "Claude Sonnet run", outcome: "Answered with 4 citations", elapsedMs: 8420, toolCalls: 6, cost: 0.1 + 0.2 }}
      right={{ label: "Baseline run", outcome: "Stopped at the step limit" }} />);
    expect(screen.getByRole("region", { name: "Compare agent runs" })).toBeTruthy();
    const left = screen.getByRole("group", { name: "Claude Sonnet run" });
    const right = screen.getByRole("group", { name: "Baseline run" });
    expect(within(left).getByText("Answered with 4 citations")).toBeTruthy();
    expect(within(left).getByText("8420 ms")).toBeTruthy();
    expect(within(left).getByText("6")).toBeTruthy();
    expect(within(left).getByText("$0.30")).toBeTruthy();
    expect(within(right).getAllByText("Unavailable")).toHaveLength(3);
  });

  it("appends units that are not currency codes as words", () => {
    render(<AgentRunComparison currency="credits" left={{ label: "Run A", outcome: "Done", cost: 1200 }} right={{ label: "Run B", outcome: "Done", cost: 0 }} />);
    expect(within(screen.getByRole("group", { name: "Run A" })).getByText("1,200 credits")).toBeTruthy();
    expect(within(screen.getByRole("group", { name: "Run B" })).getByText("0 credits")).toBeTruthy();
  });
});

describe("AgentRunEventStream", () => {
  const events: DisplayedRunEvent[] = [
    { id: "e1", title: "Run started", timestamp: "10:02:11" },
    { id: "e2", title: "Searched the knowledge base", timestamp: "10:02:14", detail: "12 passages" },
  ];

  it("pauses on the events shown, counts new ones in a status and catches up when following again", () => {
    const { rerender } = render(<AgentRunEventStream events={events} />);
    const log = screen.getByRole("log", { name: "Run event stream" });
    expect(within(log).getByText("10:02:14 · 12 passages")).toBeTruthy();
    fireEvent.click(button("Pause following"));
    rerender(<AgentRunEventStream events={[...events, { id: "e3", title: "Drafted the answer" }]} />);
    expect(within(log).queryByText("Drafted the answer")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("1 new event");
    rerender(<AgentRunEventStream events={[...events, { id: "e3", title: "Drafted the answer" }, { id: "e4", title: "Run finished" }]} />);
    expect(screen.getByRole("status").textContent).toBe("2 new events");
    fireEvent.click(button("Follow latest"));
    expect(within(log).getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("opens an event by id and leaves out open buttons without a handler", () => {
    const onOpen = vi.fn();
    const { rerender } = render(<AgentRunEventStream events={events} onOpen={onOpen} />);
    fireEvent.click(button("Open event Searched the knowledge base"));
    expect(onOpen).toHaveBeenCalledWith("e2");
    rerender(<AgentRunEventStream events={events} />);
    expect(screen.queryByRole("button", { name: /^Open event/ })).toBeNull();
  });

  it("keeps the scrolling log reachable from the keyboard and shows an empty state", () => {
    render(<AgentRunEventStream events={[]} />);
    expect(screen.getByRole("log", { name: "Run event stream" }).tabIndex).toBe(0);
    expect(screen.getByText("No run events.")).toBeTruthy();
  });
});

describe("AgentRunQueue", () => {
  const runs: AgentQueueRun[] = [
    { id: "q1", title: "Summarize support tickets", agent: "Support agent", status: "running", detail: "Step 3 of 7" },
    { id: "q2", title: "Refresh price index", status: "paused" },
    { id: "q3", title: "Import supplier catalog", status: "failed", detail: "Feed returned 503" },
    { id: "q4", title: "Weekly digest", status: "queued" },
    { id: "q5", title: "Tag new products", status: "completed" },
  ];

  it("states each status in words and offers pause, resume or retry to match it", () => {
    const onOpen = vi.fn();
    const onPause = vi.fn();
    const onResume = vi.fn();
    const onRetry = vi.fn();
    render(<AgentRunQueue runs={runs} onOpen={onOpen} onPause={onPause} onResume={onResume} onRetry={onRetry} />);
    expect(screen.getByRole("region", { name: "Agent runs" })).toBeTruthy();
    for (const word of ["Running", "Paused", "Failed", "Queued", "Completed"]) expect(screen.getByText(word)).toBeTruthy();
    expect(screen.getByText("Support agent")).toBeTruthy();
    fireEvent.click(button("Pause Summarize support tickets"));
    fireEvent.click(button("Resume Refresh price index"));
    fireEvent.click(button("Retry Import supplier catalog"));
    fireEvent.click(button("Open Weekly digest"));
    expect([onPause.mock.calls, onResume.mock.calls, onRetry.mock.calls, onOpen.mock.calls]).toEqual([[["q1"]], [["q2"]], [["q3"]], [["q4"]]]);
    const queued = screen.getAllByRole("listitem")[3]!;
    expect(within(queued).getAllByRole("button").map((item) => item.getAttribute("aria-label"))).toEqual(["Open Weekly digest"]);
  });

  it("marks a pending run's action busy and ignores clicks on it", () => {
    const onPause = vi.fn();
    render(<AgentRunQueue runs={runs} onPause={onPause} pendingRunIds={["q1"]} />);
    const pause = button("Pause Summarize support tickets");
    expect(pause.getAttribute("aria-busy")).toBe("true");
    fireEvent.click(pause);
    expect(onPause).not.toHaveBeenCalled();
  });

  it("offers no actions without handlers and shows an empty state", () => {
    const { rerender } = render(<AgentRunQueue runs={runs} />);
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<AgentRunQueue runs={[]} />);
    expect(screen.getByText("No agent runs yet.")).toBeTruthy();
  });
});

describe("AgentTraceTree", () => {
  const spans: AgentTraceSpan[] = [
    { id: "root", label: "answer_question", durationMs: 4200, status: "ok", children: [
      { id: "search", label: "search_docs", durationMs: 900, status: "ok" },
      { id: "draft", label: "draft_answer", status: "error" },
    ] },
  ];

  it("shows spans with status and duration in a labelled tree and reports the selected span", () => {
    const onSelect = vi.fn();
    render(<AgentTraceTree spans={spans} onSelect={onSelect} />);
    expect(screen.getByRole("region", { name: "Run trace" })).toBeTruthy();
    const root = screen.getByRole("treeitem", { name: /answer_question/ });
    expect(within(root).getByText("ok · 4200 ms")).toBeTruthy();
    fireEvent.keyDown(root, { key: "ArrowRight" });
    expect(within(screen.getByRole("treeitem", { name: /draft_answer/ })).getByText("error")).toBeTruthy();
    fireEvent.click(screen.getByText("search_docs"));
    expect(onSelect).toHaveBeenCalledWith("search");
  });

  it("marks the active span as selected", () => {
    render(<AgentTraceTree spans={spans} activeId="root" onSelect={vi.fn()} />);
    expect(screen.getByRole("treeitem", { name: /answer_question/ }).getAttribute("aria-selected")).toBe("true");
  });

  it("shows the tree's empty state when there are no spans", () => {
    render(<AgentTraceTree spans={[]} onSelect={vi.fn()} />);
    expect(screen.getByText("Nothing to show")).toBeTruthy();
  });
});

describe("DelegationRequestEditor", () => {
  const recipients = [{ id: "research", label: "Research agent" }, { id: "billing", label: "Billing agent" }];
  const tools = [{ id: "web", label: "Web search" }, { id: "sheets", label: "Spreadsheet export" }];

  it("explains what is missing or invalid before sending anything", async () => {
    const onSubmit = vi.fn();
    render(<DelegationRequestEditor recipients={recipients} tools={tools} onSubmit={onSubmit} />);
    expect(screen.getByRole("region", { name: "Delegation request" })).toBeTruthy();
    await act(async () => { fireEvent.click(button("Request delegation")); });
    expect(screen.getByRole("alert").textContent).toBe("Choose a recipient.");
    fireEvent.change(select("Recipient"), { target: { value: "research" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Task" }), { target: { value: "   " } });
    await act(async () => { fireEvent.click(button("Request delegation")); });
    expect(screen.getByRole("alert").textContent).toBe("Enter a task.");
    fireEvent.change(screen.getByRole("textbox", { name: "Task" }), { target: { value: "Compare vendor prices" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Budget" }), { target: { value: "-5" } });
    await act(async () => { fireEvent.click(button("Request delegation")); });
    expect(screen.getByRole("alert").textContent).toBe("Budget must be a number of at least 0.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("sends the trimmed request with only tools that still exist and then clears the draft", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<DelegationRequestEditor recipients={recipients} tools={tools} budgetLabel="Budget (USD)" onSubmit={onSubmit}
      initialValue={{ recipientId: "billing", task: "  Reconcile March invoices  ", toolIds: ["sheets", "retired-tool"], budget: 12.5 }} />);
    expect((screen.getByRole("checkbox", { name: "Spreadsheet export" }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Web search" }));
    await act(async () => { fireEvent.click(button("Request delegation")); });
    expect(onSubmit).toHaveBeenCalledWith({ recipientId: "billing", task: "Reconcile March invoices", toolIds: ["sheets", "web"], budget: 12.5 });
    expect(select("Recipient").value).toBe("");
    expect((screen.getByRole("textbox", { name: "Task" }) as HTMLTextAreaElement).value).toBe("");
    expect((screen.getByRole("textbox", { name: "Budget (USD)" }) as HTMLInputElement).value).toBe("");
    expect(screen.getAllByRole("checkbox").every((box) => !(box as HTMLInputElement).checked)).toBe(true);
  });

  it("leaves the budget out when blank and removes a tool when unchecked", async () => {
    const onSubmit = vi.fn();
    render(<DelegationRequestEditor recipients={recipients} tools={tools} onSubmit={onSubmit} />);
    fireEvent.change(select("Recipient"), { target: { value: "research" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Task" }), { target: { value: "Find three suppliers" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Web search" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Spreadsheet export" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Web search" }));
    await act(async () => { fireEvent.click(button("Request delegation")); });
    expect(onSubmit).toHaveBeenCalledWith({ recipientId: "research", task: "Find three suppliers", toolIds: ["sheets"] });
  });

  it("keeps the draft and shows the error when sending fails", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("The research agent is at capacity."));
    render(<DelegationRequestEditor recipients={recipients} tools={[]} onSubmit={onSubmit}
      initialValue={{ recipientId: "research", task: "Summarize reviews", toolIds: [] }} />);
    expect(screen.getByText("No tools available.")).toBeTruthy();
    await act(async () => { fireEvent.click(button("Request delegation")); });
    expect(screen.getByRole("alert").textContent).toBe("The research agent is at capacity.");
    expect((screen.getByRole("textbox", { name: "Task" }) as HTMLTextAreaElement).value).toBe("Summarize reviews");
  });
});

describe("DelegationTree", () => {
  const runs: DelegationRun[] = [
    { id: "lead", label: "Plan launch email", agent: "Lead agent", status: "running", children: [
      { id: "copy", label: "Write copy", agent: "Writer", status: "done" },
    ] },
  ];

  it("shows each delegated run with its agent and status and reports the selected run", () => {
    const onSelect = vi.fn();
    render(<DelegationTree runs={runs} activeId="lead" onSelect={onSelect} />);
    expect(screen.getByRole("region", { name: "Delegations" })).toBeTruthy();
    const lead = screen.getByRole("treeitem", { name: /Plan launch email/ });
    expect(within(lead).getByText("Lead agent · running")).toBeTruthy();
    expect(lead.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(lead, { key: "ArrowRight" });
    fireEvent.click(screen.getByText("Write copy"));
    expect(onSelect).toHaveBeenCalledWith("copy");
  });

  it("is read-only without a selection handler", () => {
    render(<DelegationTree runs={runs} />);
    expect(screen.getByRole("tree", { name: "Delegated runs" })).toBeTruthy();
    expect(screen.getByRole("treeitem", { name: /Plan launch email/ }).getAttribute("aria-selected")).toBeNull();
  });
});

describe("McpResourceSubscriptions", () => {
  const resources: McpResourceSubscription[] = [
    { id: "r1", title: "Order events", server: "Shop server", subscribed: true },
    { id: "r2", title: "Inventory levels", server: "Warehouse server", subscribed: false },
    { id: "r3", title: "Audit log", server: "Admin server", subscribed: false, unavailableReason: "Requires admin scope" },
  ];

  it("toggles a subscription with the resource id and the requested state", () => {
    const onToggle = vi.fn();
    render(<McpResourceSubscriptions resources={resources} onToggle={onToggle} />);
    expect(screen.getByRole("region", { name: "Resource subscriptions" })).toBeTruthy();
    expect(screen.getByText("Shop server · Subscribed")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Subscribe to Order events" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Subscribe to Inventory levels" }));
    expect(onToggle.mock.calls).toEqual([["r1", false], ["r2", true]]);
  });

  it("blocks unavailable and pending resources and says so in text", () => {
    render(<McpResourceSubscriptions resources={resources} onToggle={vi.fn()} pendingIds={["r2"]} />);
    expect((screen.getByRole("checkbox", { name: "Subscribe to Audit log" }) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText("Admin server · Unsubscribed · Requires admin scope")).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: "Subscribe to Inventory levels" }) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText("Warehouse server · Unsubscribed · Updating")).toBeTruthy();
  });

  it("is read-only without a toggle handler and shows an empty state", () => {
    const { rerender } = render(<McpResourceSubscriptions resources={resources} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
    rerender(<McpResourceSubscriptions resources={[]} />);
    expect(screen.getByText("No subscriptions available.")).toBeTruthy();
  });
});

describe("RunArtifactManifest", () => {
  const artifacts: ManifestArtifact[] = [
    { id: "f1", title: "quarterly-report.pdf", kind: "PDF", size: "1.2 MB", version: "v3" },
    { id: "f2", title: "raw-export.csv", kind: "CSV", unavailableReason: "Expired after 7 days" },
  ];

  it("lists artifacts with kind, size and version and opens one by id", () => {
    const onOpen = vi.fn();
    render(<RunArtifactManifest artifacts={artifacts} onOpen={onOpen} />);
    expect(screen.getByRole("region", { name: "Run artifacts" })).toBeTruthy();
    expect(screen.getByText("PDF · 1.2 MB · v3")).toBeTruthy();
    fireEvent.click(button("Open artifact quarterly-report.pdf"));
    expect(onOpen).toHaveBeenCalledWith("f1");
  });

  it("disables an unavailable artifact and gives the reason", () => {
    const onOpen = vi.fn();
    render(<RunArtifactManifest artifacts={artifacts} onOpen={onOpen} />);
    expect(screen.getByText("CSV · Expired after 7 days")).toBeTruthy();
    fireEvent.click(button("Open artifact raw-export.csv"));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("is read-only without a handler and shows an empty state", () => {
    const { rerender } = render(<RunArtifactManifest artifacts={artifacts} />);
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<RunArtifactManifest artifacts={[]} />);
    expect(screen.getByText("No run artifacts.")).toBeTruthy();
  });
});

describe("RunBudgetBreakdown", () => {
  it("names each budget amount and marks missing ones unavailable", () => {
    render(<RunBudgetBreakdown currency="USD" amounts={{ reserved: "25.00", settled: "18.42", released: "6.58" }} />);
    expect(screen.getByRole("region", { name: "Run budget breakdown" })).toBeTruthy();
    const terms = screen.getAllByRole("term").map((term) => term.textContent);
    const values = screen.getAllByRole("definition").map((value) => value.textContent);
    expect(terms).toEqual(["Reserved", "Settled", "Released", "Uncertain"]);
    expect(values).toEqual(["25.00 USD", "18.42 USD", "6.58 USD", "Unavailable"]);
  });
});

describe("RunDependencyInspector", () => {
  it("shows the run with its blocking reason and lets the user inspect prerequisites and dependents", () => {
    const onSelect = vi.fn();
    render(<RunDependencyInspector onSelect={onSelect}
      node={{ id: "build", label: "Build catalog index", status: "Blocked", blockingReason: "Waiting for the supplier import" }}
      prerequisites={[{ id: "import", label: "Import supplier feed", status: "Running" }]}
      dependents={[{ id: "publish", label: "Publish storefront", status: "Waiting" }]} />);
    expect(screen.getByRole("region", { name: "Run dependencies" })).toBeTruthy();
    expect(screen.getByText("Blocked · Waiting for the supplier import")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Prerequisites" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Dependents" })).toBeTruthy();
    fireEvent.click(button("Inspect Import supplier feed"));
    fireEvent.click(button("Inspect Publish storefront"));
    expect(onSelect.mock.calls).toEqual([["import"], ["publish"]]);
  });

  it("says when a run has no prerequisites or dependents and hides inspect without a handler", () => {
    render(<RunDependencyInspector node={{ id: "solo", label: "Send digest", status: "Ready" }} prerequisites={[]} dependents={[]} />);
    expect(screen.getByText("No prerequisites.")).toBeTruthy();
    expect(screen.getByText("No dependents.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("RunRecoveryPanel", () => {
  const checkpoints = [
    { id: "c1", label: "After search step" },
    { id: "c2", label: "After drafting", unavailableReason: "Snapshot was corrupted" },
  ];

  it("resumes from an available checkpoint by id and restarts the run", () => {
    const onResume = vi.fn();
    const onRestart = vi.fn();
    render(<RunRecoveryPanel checkpoints={checkpoints} onResume={onResume} onRestart={onRestart} />);
    expect(screen.getByRole("region", { name: "Run recovery" })).toBeTruthy();
    expect(screen.getByText("Available")).toBeTruthy();
    expect(screen.getByText("Snapshot was corrupted")).toBeTruthy();
    fireEvent.click(button("Resume from After search step"));
    fireEvent.click(button("Resume from After drafting"));
    fireEvent.click(button("Restart run"));
    expect(onResume.mock.calls).toEqual([["c1"]]);
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it("blocks every action while recovery is pending and says so in a status", () => {
    const onResume = vi.fn();
    const onRestart = vi.fn();
    const { rerender } = render(<RunRecoveryPanel checkpoints={checkpoints} onResume={onResume} onRestart={onRestart} />);
    expect(screen.getByRole("status").textContent).toBe("");
    rerender(<RunRecoveryPanel checkpoints={checkpoints} onResume={onResume} onRestart={onRestart} pending />);
    expect(screen.getByRole("status").textContent).toBe("Recovery in progress.");
    fireEvent.click(button("Resume from After search step"));
    fireEvent.click(button("Restart run"));
    expect(onResume).not.toHaveBeenCalled();
    expect(onRestart).not.toHaveBeenCalled();
  });

  it("explains why restart is unavailable and shows an empty state", () => {
    const onRestart = vi.fn();
    render(<RunRecoveryPanel checkpoints={[]} onRestart={onRestart} restartUnavailableReason="The run already sent emails." />);
    expect(screen.getByText("No checkpoints available.")).toBeTruthy();
    expect(screen.getByText("The run already sent emails.")).toBeTruthy();
    expect(button("Restart run").disabled).toBe(true);
    fireEvent.click(button("Restart run"));
    expect(onRestart).not.toHaveBeenCalled();
  });
});

describe("TraceSpanDetails", () => {
  it("asks for a selection when no span is chosen", () => {
    render(<TraceSpanDetails span={null} />);
    expect(screen.getByRole("region", { name: "Trace span details" })).toBeTruthy();
    expect(screen.getByText("Select a span to inspect it.")).toBeTruthy();
  });

  it("shows the span's status, timing and labelled input, output and error", () => {
    const { rerender } = render(<TraceSpanDetails span={{ id: "s1", label: "search_docs", status: "error", startedAt: "10:02:14", durationMs: 900,
      input: "query: return policy", output: "0 passages", error: "Index is rebuilding" }} />);
    expect(screen.getByText("error · 10:02:14 · 900 ms")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Input" }).nextElementSibling?.textContent).toBe("query: return policy");
    expect(screen.getByRole("heading", { name: "Output" }).nextElementSibling?.textContent).toBe("0 passages");
    expect(screen.getByRole("heading", { name: "Error" }).nextElementSibling?.textContent).toBe("Index is rebuilding");
    rerender(<TraceSpanDetails span={{ id: "s2", label: "draft_answer", input: "4 passages" }} />);
    expect(screen.getByRole("heading", { name: "Input" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Output" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Error" })).toBeNull();
  });
});

describe("WorkerPoolStatus", () => {
  const workers: ReportedWorker[] = [
    { id: "w1", name: "gpu-worker-1", status: "busy", activeWork: "Embedding catalog", lastHeartbeat: "5 s ago" },
    { id: "w2", name: "gpu-worker-2", status: "available", lastHeartbeat: "2 s ago" },
    { id: "w3", name: "cpu-worker-1", status: "offline", lastHeartbeat: "12 min ago" },
  ];

  it("summarizes availability, states each worker's status in words and opens a worker by id", () => {
    const onOpen = vi.fn();
    render(<WorkerPoolStatus workers={workers} onOpen={onOpen} />);
    expect(screen.getByRole("region", { name: "Worker pool" })).toBeTruthy();
    expect(screen.getByText("1 available of 3 workers")).toBeTruthy();
    expect(screen.getByText("Busy · Embedding catalog · Last heartbeat 5 s ago")).toBeTruthy();
    expect(screen.getByText("Offline · Last heartbeat 12 min ago")).toBeTruthy();
    fireEvent.click(button("Open worker gpu-worker-2"));
    expect(onOpen).toHaveBeenCalledWith("w2");
  });

  it("uses the singular for one worker, hides open without a handler and shows an empty pool", () => {
    const { rerender } = render(<WorkerPoolStatus workers={[workers[1]!]} />);
    expect(screen.getByText("1 available of 1 worker")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<WorkerPoolStatus workers={[]} />);
    expect(screen.getByText("0 available of 0 workers")).toBeTruthy();
    expect(screen.getByText("No workers in this pool.")).toBeTruthy();
  });
});
