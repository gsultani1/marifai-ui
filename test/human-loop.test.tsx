// packages/ai-ui/test/human-loop.test.tsx
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ActionApproval,
  AgentError,
  ApprovalQueue,
  BatchReview,
  BudgetBar,
  ChatAlert,
  ClarifyingQuestions,
  classifyError,
  ConsentCard,
  CostApproval,
  formatAmount,
  isReadOnlySql,
  JobList,
  QueryReview,
  splitSqlStatements,
} from "../src/index.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("ActionApproval", () => {
  it("gates high-risk approval on review and clears the review when the action changes", () => {
    const onApprove = vi.fn();
    const { rerender } = render(<ActionApproval title="Send email" risk="high" digest="abc123def4567890" onApprove={onApprove} onDeny={vi.fn()} />);
    expect(screen.getByText("High impact")).toBeTruthy();
    expect(screen.getByText(/Approval covers this exact action only/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(onApprove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox", { name: "I reviewed this action" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(onApprove).toHaveBeenCalledTimes(1);

    rerender(<ActionApproval title="Send email" risk="high" digest="ffff000011112222" onApprove={onApprove} onDeny={vi.fn()} />);
    expect((screen.getByRole("checkbox", { name: "I reviewed this action" }) as HTMLInputElement).checked).toBe(false);
  });

  it("offers a retry of the same decision when confirmation fails and requires a deny reason when asked", async () => {
    const onApprove = vi.fn().mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce(undefined);
    const onDeny = vi.fn();
    render(<ActionApproval title="Run migration" onApprove={onApprove} onDeny={onDeny} denyRequiresReason />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry approval" }));
    });
    expect(onApprove).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: "Deny" }));
    fireEvent.click(screen.getByRole("button", { name: "Deny" }));
    expect(onDeny).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "Reason (required)" }), { target: { value: "Wrong table" } });
    fireEvent.click(screen.getByRole("button", { name: "Deny" }));
    expect(onDeny).toHaveBeenCalledWith("Wrong table");
  });

  it("collapses to a closed summary once decided", () => {
    render(<ActionApproval title="Send email" state="expired" onApprove={vi.fn()} onDeny={vi.fn()} />);
    expect(screen.getByText(/Closed without a decision/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("ApprovalQueue", () => {
  it("shows one pending request at a time and moves decided ones to history", () => {
    const onApprove = vi.fn();
    const requests = [
      { id: "a", title: "Send email", source: "Inbox agent" },
      { id: "b", title: "Create issue" },
      { id: "c", title: "Post update", state: "approved" as const },
    ];
    render(<ApprovalQueue requests={requests} onApprove={onApprove} onDeny={vi.fn()} />);
    expect(screen.getByText("Request 1 of 2")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Send email" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next request" }));
    expect(screen.getByRole("heading", { name: "Create issue" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(onApprove).toHaveBeenCalledWith("b");
    fireEvent.click(screen.getByRole("tab", { name: /History/ }));
    expect(screen.getByText("Post update")).toBeTruthy();
  });
});

describe("cost and budget", () => {
  it("formats currencies and units", () => {
    expect(formatAmount(12.5, "USD", "en-US")).toBe("$12.50");
    expect(formatAmount(1200, "credits", "en-US")).toBe("1,200 credits");
  });

  it("shows the balance after a run and blocks approval when the balance cannot cover the cap", () => {
    const onApprove = vi.fn();
    const onTopUp = vi.fn();
    const { rerender } = render(<CostApproval title="Train model" price={4} maxCost={6} balance={20} onApprove={onApprove} onDecline={vi.fn()} script="print(1)" />);
    expect(screen.getByText(/Balance after: \$16.00 \(at least \$14.00\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "View script" }));
    expect(screen.getByRole("region", { name: "Train model" }).textContent).toContain("print(1)");
    fireEvent.click(screen.getByRole("button", { name: /Approve and run/ }));
    expect(onApprove).toHaveBeenCalledTimes(1);

    rerender(<CostApproval title="Train model" price={4} maxCost={6} balance={5} onApprove={onApprove} onDecline={vi.fn()} onTopUp={onTopUp} />);
    expect(screen.getByText(/does not cover the maximum cost/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add funds" }));
    expect(onTopUp).toHaveBeenCalledTimes(1);
  });

  it("reports used, held and left on the budget meter", () => {
    render(<BudgetBar budget={100} used={70} held={15} label="Monthly budget" />);
    const meter = screen.getByRole("meter", { name: "Monthly budget" });
    expect(meter.getAttribute("aria-valuetext")).toBe("$70.00 used, $15.00 held, $15.00 left of $100.00");
    expect(meter.closest("[data-slot='budget-bar']")?.getAttribute("data-level")).toBe("warn");
  });
});

describe("JobList", () => {
  it("offers cancel for running jobs, retry for failed ones and a status check for lost outcomes", () => {
    const onCancel = vi.fn();
    const onRetry = vi.fn();
    const onReconcile = vi.fn();
    render(
      <JobList
        onCancel={onCancel}
        onRetry={onRetry}
        onReconcile={onReconcile}
        jobs={[
          { id: "1", title: "Render video", status: "running", progress: 0.4, logs: ["frame 1", "frame 2"] },
          { id: "2", title: "Export CSV", status: "failed", error: "Disk full" },
          { id: "3", title: "Send invoices", status: "unknown" },
        ]}
      />,
    );
    expect(screen.getByRole("progressbar", { name: "Job progress" }).getAttribute("aria-valuenow")).toBe("40");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    fireEvent.click(screen.getByRole("button", { name: "Check status" }));
    expect([onCancel.mock.calls[0]?.[0], onRetry.mock.calls[0]?.[0], onReconcile.mock.calls[0]?.[0]]).toEqual(["1", "2", "3"]);
    expect(screen.getByText(/lost track of this job/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Details" })[0]!);
    expect(screen.getByRole("log", { name: "Job logs" }).textContent).toBe("frame 1\nframe 2");
  });
});

describe("ClarifyingQuestions", () => {
  it("walks through questions, lets a custom answer replace a choice and reports skipped ones as null", () => {
    const onSubmit = vi.fn();
    render(
      <ClarifyingQuestions
        onSubmit={onSubmit}
        questions={[
          { id: "stack", question: "Which stack?", options: [{ value: "react", label: "React" }, { value: "vue", label: "Vue" }], allowCustom: true, required: true },
          { id: "features", question: "Which features?", options: [{ value: "auth", label: "Auth" }, { value: "billing", label: "Billing" }], multiple: true },
          { id: "notes", question: "Anything else?" },
        ]}
      />,
    );
    expect(screen.getByRole("group", { name: "Question 1 of 3" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("radio", { name: "React" })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "React" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Or write your own answer" }), { target: { value: "Svelte" } });
    expect((screen.getByRole("radio", { name: "React" }) as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    fireEvent.click(screen.getByRole("checkbox", { name: "Auth" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Billing" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(onSubmit).toHaveBeenCalledWith({ stack: { selected: [], custom: "Svelte" }, features: { selected: ["auth", "billing"] }, notes: null });
  });
});

describe("classifyError", () => {
  it("classifies common provider errors and reads status, request id and Retry-After", () => {
    expect(classifyError({ status: 401, message: "Invalid API key" }).kind).toBe("auth");
    expect(classifyError({ status: 429, message: "You exceeded your current quota", code: "insufficient_quota" }).kind).toBe("quota");
    expect(classifyError(new Error("This model's maximum context length is 128000 tokens")).kind).toBe("context");
    expect(classifyError(new TypeError("Failed to fetch")).kind).toBe("network");
    expect(classifyError({ status: 529, message: "Overloaded" }).kind).toBe("server");
    const abort = new Error("aborted");
    abort.name = "AbortError";
    expect(classifyError(abort).kind).toBe("aborted");
    const limited = classifyError({ status: 429, message: "Rate limit reached", headers: new Headers({ "retry-after": "12", "x-request-id": "req_9" }) }, 0);
    expect(limited).toMatchObject({ kind: "rate-limit", retryable: true, retryAfterMs: 12_000, requestId: "req_9", status: 429 });
    expect(classifyError("weird").kind).toBe("unknown");
  });
});

describe("AgentError", () => {
  it("counts down a rate limit before allowing retry", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const onRetry = vi.fn();
    render(<AgentError error={{ status: 429, message: "Rate limit", retryAfterMs: 3000 }} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "Retry in 3s" }));
    expect(onRetry).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("hides blind retries once changes were applied and offers settings for auth errors", () => {
    const { rerender } = render(<AgentError error={{ status: 500, message: "Internal server error" }} applied={2} onRetry={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(screen.getByText(/2 changes were already applied/)).toBeTruthy();
    const onOpenSettings = vi.fn();
    rerender(<AgentError error={{ status: 401, message: "Unauthorized" }} onRetry={vi.fn()} onOpenSettings={onOpenSettings} />);
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.getByText("Unauthorized")).toBeTruthy();
  });
});

describe("ChatAlert", () => {
  it("sends the full error to the assistant while showing a clipped preview", () => {
    const onAskToFix = vi.fn();
    const content = `TypeError: x is undefined\n${"at line\n".repeat(200)}`;
    render(<ChatAlert source="terminal" content={content} onAskToFix={onAskToFix} maxPreview={40} />);
    expect(screen.getByRole("alert", { name: "Terminal error" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ask AI to fix" }));
    expect(onAskToFix).toHaveBeenCalledWith(content);
  });
});

describe("SQL review", () => {
  it("detects writes outside strings and comments", () => {
    expect(isReadOnlySql("select * from users where note = 'drop table x'; -- delete")).toBe(true);
    expect(isReadOnlySql("WITH gone AS (DELETE FROM users RETURNING *) SELECT * FROM gone")).toBe(false);
    expect(isReadOnlySql("select id into backup from users")).toBe(false);
    expect(isReadOnlySql("select 1; drop table users")).toBe(false);
    expect(isReadOnlySql("select $$ delete $$ as text")).toBe(true);
    expect(isReadOnlySql("")).toBe(false);
    expect(splitSqlStatements("select ';'; select 2")).toHaveLength(2);
  });

  it("runs read queries, blocks writes unless allowed and then requires confirmation", () => {
    const onRun = vi.fn();
    const { rerender } = render(<QueryReview sql="select * from orders" onRun={onRun} />);
    fireEvent.click(screen.getByRole("button", { name: "Run query" }));
    expect(onRun).toHaveBeenCalledWith("select * from orders");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "SQL" }), { target: { value: "delete from orders" } });
    expect(screen.getByText(/only read queries can run here/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Run write query" }));
    expect(onRun).toHaveBeenCalledTimes(1);

    rerender(<QueryReview sql="update orders set paid = true" onRun={onRun} allowWrites />);
    fireEvent.click(screen.getByRole("button", { name: "Run write query" }));
    expect(onRun).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("checkbox", { name: "I understand this query changes data" }));
    fireEvent.click(screen.getByRole("button", { name: "Run write query" }));
    expect(onRun).toHaveBeenLastCalledWith("update orders set paid = true");
  });
});

describe("BatchReview", () => {
  it("excludes conflicts by default, toggles groups and applies only the selection", () => {
    const onApply = vi.fn();
    render(
      <BatchReview
        noun={["shift", "shifts"]}
        onApply={onApply}
        groups={[
          { id: "mon", label: "Monday", items: [{ id: "m1", title: "Ana 9-5", cost: 120 }, { id: "m2", title: "Ben 9-5", cost: 110, conflict: "Ben is on leave" }] },
          { id: "tue", label: "Tuesday", items: [{ id: "t1", title: "Cara 12-8", cost: 130 }] },
        ]}
      />,
    );
    expect(screen.getByText(/1 shift conflicts with existing data/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Apply 2 shifts" })).toBeTruthy();
    const monday = screen.getByRole("checkbox", { name: "Include all in Monday" }) as HTMLInputElement;
    expect(monday.indeterminate).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Include all in Tuesday" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply 1 shift" }));
    expect(onApply).toHaveBeenCalledWith(["m1"]);
    expect(screen.getByText(/1 of 3 selected · \$120.00/)).toBeTruthy();
  });
});

describe("ConsentCard", () => {
  it("shows the redirect host, warns on plain HTTP and blocks unsafe redirects", () => {
    const onApprove = vi.fn();
    const { rerender } = render(
      <ConsentCard clientName="Notes App" redirectUri="http://notes.example.com/callback" scopes={[{ id: "mail.send", label: "Send email", sensitive: true }]} onApprove={onApprove} onCancel={vi.fn()} />,
    );
    const card = screen.getByRole("region", { name: "Notes App wants access to your account" });
    expect(within(card).getByText("notes.example.com")).toBeTruthy();
    expect(within(card).getByText(/does not use HTTPS/)).toBeTruthy();
    expect(within(card).getByText("Sensitive")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Allow access" }));
    expect(onApprove).toHaveBeenCalledTimes(1);

    rerender(<ConsentCard clientName="Notes App" redirectUri="javascript:alert(1)" scopes={[]} onApprove={onApprove} onCancel={vi.fn()} />);
    expect(screen.getByText(/redirect address is not allowed/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Allow access" }));
    expect(onApprove).toHaveBeenCalledTimes(1);
  });
});
