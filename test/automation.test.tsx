// packages/ai-ui/test/automation.test.tsx
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  AutomationActionBuilder,
  AutomationChangeReview,
  AutomationConcurrencyEditor,
  AutomationDeadLetterQueue,
  AutomationDryRunReview,
  AutomationExecutionWindowIndicator,
  AutomationOccurrencePreview,
  AutomationPauseWindowEditor,
  AutomationRetryPolicyEditor,
  AutomationRunCancellation,
  AutomationRunHistory,
  AutomationRunInputForm,
  AutomationScheduleEditor,
  AutomationTemplatePicker,
  AutomationToggleList,
  AutomationTriggerPicker,
  type AutomationSchedule,
  type ToolParameter,
} from "../src/index.js";
import { isDisabled } from "./helpers.js";

function textbox(name: string) {
  return screen.getByRole("textbox", { name }) as HTMLInputElement;
}

function combobox(name: string) {
  return screen.getByRole("combobox", { name }) as HTMLSelectElement;
}

describe("AutomationActionBuilder", () => {
  const actions = [
    { id: "check", label: "Check stock levels" },
    { id: "email", label: "Email the supplier" },
    { id: "post", label: "Post to #inventory" },
  ];
  const steps = [
    { id: "s1", label: "Check stock levels", detail: "All aisles" },
    { id: "s2", label: "Email the supplier" },
  ];

  it("adds the chosen action, then clears the choice so it cannot be added twice by accident", () => {
    const onAdd = vi.fn();
    render(<AutomationActionBuilder steps={steps} actions={actions} onAdd={onAdd} onRemove={vi.fn()} onReorder={vi.fn()} />);
    const add = screen.getByRole("button", { name: "Add action" }) as HTMLButtonElement;
    expect(isDisabled(add)).toBe(true);
    fireEvent.change(combobox("Action"), { target: { value: "post" } });
    expect(add.disabled).toBe(false);
    fireEvent.click(add);
    expect(onAdd).toHaveBeenCalledWith("post");
    expect(combobox("Action").value).toBe("");
    expect(isDisabled(add)).toBe(true);
  });

  it("lists steps in order with their detail and removes a step by id", () => {
    const onRemove = vi.fn();
    render(<AutomationActionBuilder steps={steps} actions={actions} onAdd={vi.fn()} onRemove={onRemove} onReorder={vi.fn()} />);
    const list = screen.getByRole("list", { name: "Action order" });
    expect(within(list).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Check stock levels · All aisles Remove",
      "Email the supplier Remove",
    ]);
    expect(screen.getByRole("status").textContent).toBe("2 actions");
    fireEvent.click(screen.getByRole("button", { name: "Remove Email the supplier" }));
    expect(onRemove).toHaveBeenCalledWith("s2");
  });

  it("reorders steps from the keyboard and reports the new order as ids", () => {
    const onReorder = vi.fn();
    render(<AutomationActionBuilder steps={steps} actions={actions} onAdd={vi.fn()} onRemove={vi.fn()} onReorder={onReorder} />);
    const handle = screen.getByRole("button", { name: "Reorder Check stock levels" });
    act(() => handle.focus());
    fireEvent.keyDown(handle, { key: " " });
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    fireEvent.keyDown(handle, { key: " " });
    expect(onReorder).toHaveBeenCalledWith(["s2", "s1"]);
  });

  it("announces the step count, says when there are no steps and drops a choice that is no longer offered", () => {
    const { rerender } = render(<AutomationActionBuilder steps={[]} actions={actions} onAdd={vi.fn()} onRemove={vi.fn()} onReorder={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toBe("No actions added yet.");
    expect(screen.queryByRole("list")).toBeNull();
    fireEvent.change(combobox("Action"), { target: { value: "email" } });
    rerender(<AutomationActionBuilder steps={[steps[0]!]} actions={actions.filter((item) => item.id !== "email")} onAdd={vi.fn()} onRemove={vi.fn()} onReorder={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toBe("1 action");
    expect(combobox("Action").value).toBe("");
    expect(isDisabled((screen.getByRole("button", { name: "Add action" }) as HTMLButtonElement))).toBe(true);
  });
});

describe("AutomationChangeReview", () => {
  const before = { trigger: "Stock below reorder point", schedule: "Weekdays at 6:00 AM", actions: ["Check stock levels", "Email the supplier"] };

  it("shows a labelled before and after diff for each changed setting and marks the rest unchanged", () => {
    render(<AutomationChangeReview before={before} after={{ ...before, schedule: "Daily at 5:30 AM", actions: ["Check stock levels", "Post to #inventory"] }} />);
    expect(within(screen.getByRole("group", { name: "Trigger" })).getByText("Unchanged")).toBeTruthy();
    const schedule = screen.getByRole("group", { name: "Schedule" });
    expect(within(schedule).getByText("Before → After")).toBeTruthy();
    const lines = within(schedule).getByRole("region", { name: "Diff lines" });
    expect(lines.textContent).toContain("Removed: Weekdays at 6:00 AM");
    expect(lines.textContent).toContain("Added: Daily at 5:30 AM");
    const actionLines = within(screen.getByRole("group", { name: "Actions" })).getByRole("region", { name: "Diff lines" });
    expect(actionLines.textContent).toContain("Removed: Email the supplier");
    expect(actionLines.textContent).toContain("Added: Post to #inventory");
  });

  it("shows every setting as unchanged when nothing differs", () => {
    render(<AutomationChangeReview before={before} after={{ ...before, actions: [...before.actions] }} />);
    expect(screen.getAllByText("Unchanged")).toHaveLength(3);
    expect(screen.queryByRole("region", { name: "Diff lines" })).toBeNull();
  });
});

describe("AutomationConcurrencyEditor", () => {
  const policies = [{ id: "skip", label: "Skip the new run" }, { id: "queue", label: "Queue the new run" }];

  it("submits the parsed run limit and the chosen overlap policy", async () => {
    const onSubmit = vi.fn();
    render(<AutomationConcurrencyEditor initialValue={{ maxActiveRuns: 1, overlapPolicyId: "skip" }} policies={policies} onSubmit={onSubmit} />);
    fireEvent.change(textbox("Maximum active runs"), { target: { value: "3" } });
    fireEvent.change(combobox("Overlap policy"), { target: { value: "queue" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save concurrency" })); });
    expect(onSubmit).toHaveBeenCalledWith({ maxActiveRuns: 3, overlapPolicyId: "queue" });
  });

  it("rejects a run limit that is not a whole number of at least one", async () => {
    const onSubmit = vi.fn();
    render(<AutomationConcurrencyEditor initialValue={{ maxActiveRuns: 2, overlapPolicyId: "skip" }} policies={policies} onSubmit={onSubmit} />);
    for (const value of ["0", "1.5", "many", ""]) {
      fireEvent.change(textbox("Maximum active runs"), { target: { value } });
      await act(async () => { fireEvent.submit(screen.getByRole("form", { name: "Automation concurrency" })); });
      expect(screen.getByRole("alert").textContent).toMatch(/^Maximum active runs (must be a whole number of at least 1|is required)\.$/);
    }
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("requires a policy when the saved one is no longer offered and surfaces a failed save", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("The scheduler is offline."));
    render(<AutomationConcurrencyEditor initialValue={{ maxActiveRuns: 2, overlapPolicyId: "cancel" }} policies={policies} onSubmit={onSubmit} />);
    expect(combobox("Overlap policy").value).toBe("");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save concurrency" })); });
    expect(screen.getByRole("alert").textContent).toBe("Choose an overlap policy.");
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.change(combobox("Overlap policy"), { target: { value: "skip" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save concurrency" })); });
    expect(onSubmit).toHaveBeenCalledWith({ maxActiveRuns: 2, overlapPolicyId: "skip" });
    expect(screen.getByRole("alert").textContent).toBe("The scheduler is offline.");
  });

  it("locks the fields and ignores a second submit while a save is pending", async () => {
    let finish: () => void = () => undefined;
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<AutomationConcurrencyEditor initialValue={{ maxActiveRuns: 2, overlapPolicyId: "skip" }} policies={policies} onSubmit={onSubmit} />);
    const form = screen.getByRole("form", { name: "Automation concurrency" });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(textbox("Maximum active runs").closest("fieldset")?.disabled).toBe(true);
    await act(async () => finish());
    expect(textbox("Maximum active runs").closest("fieldset")?.disabled).toBe(false);
  });
});

describe("AutomationDeadLetterQueue", () => {
  const deliveries = [
    { id: "d1", title: "Restock email to Orgill", reason: "Mailbox full", kind: "Email", timestamp: "Nov 18, 6:02 AM" },
    { id: "d2", title: "Price sync webhook", reason: "HTTP 503 from the POS", kind: "Webhook", timestamp: "Nov 18, 6:05 AM" },
    { id: "d3", title: "Low stock post", reason: "Channel archived", kind: "Chat", timestamp: "Nov 18, 6:07 AM", retryUnavailableReason: "Choose a new channel first" },
  ];

  it("inspects and retries a failure by id and names each action after its delivery", () => {
    const onInspect = vi.fn();
    const onRetry = vi.fn();
    render(<AutomationDeadLetterQueue deliveries={deliveries} onInspect={onInspect} onRetry={onRetry} />);
    expect(screen.getByText("Nov 18, 6:05 AM · HTTP 503 from the POS")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Inspect Price sync webhook" }));
    fireEvent.click(screen.getByRole("button", { name: "Retry Price sync webhook" }));
    expect(onInspect).toHaveBeenCalledWith("d2");
    expect(onRetry).toHaveBeenCalledWith("d2");
  });

  it("blocks retry while one is pending or when retry is unavailable, and says why in text", () => {
    const onRetry = vi.fn();
    render(<AutomationDeadLetterQueue deliveries={deliveries} onInspect={vi.fn()} onRetry={onRetry} pendingIds={["d1"]} />);
    const pending = screen.getByRole("button", { name: "Retry Restock email to Orgill" }) as HTMLButtonElement;
    const unavailable = screen.getByRole("button", { name: "Retry Low stock post" }) as HTMLButtonElement;
    expect(isDisabled(pending)).toBe(true);
    expect(isDisabled(unavailable)).toBe(true);
    expect(screen.getByText("Nov 18, 6:02 AM · Mailbox full · Retrying")).toBeTruthy();
    expect(screen.getByText("Nov 18, 6:07 AM · Channel archived · Choose a new channel first")).toBeTruthy();
    fireEvent.click(pending);
    fireEvent.click(unavailable);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("offers no retry without a handler and filters by search text and delivery type", () => {
    render(<AutomationDeadLetterQueue deliveries={deliveries} onInspect={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /^Retry/ })).toBeNull();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search deliveries" }), { target: { value: "503" } });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search deliveries" }), { target: { value: "" } });
    fireEvent.change(combobox("Delivery type"), { target: { value: "Chat" } });
    expect(screen.getByRole("listitem").textContent).toContain("Low stock post");
    fireEvent.change(screen.getByRole("searchbox", { name: "Search deliveries" }), { target: { value: "orgill" } });
    expect(screen.getByText("No matching failures.")).toBeTruthy();
  });

  it("says there are no failed deliveries when the queue is empty", () => {
    render(<AutomationDeadLetterQueue deliveries={[]} onInspect={vi.fn()} />);
    expect(screen.getByText("No failed deliveries.")).toBeTruthy();
  });
});

describe("AutomationDryRunReview", () => {
  it("lists each planned action with its affected items and the approvals it needs", () => {
    const onReviewApproval = vi.fn();
    render(<AutomationDryRunReview onReviewApproval={onReviewApproval} actions={[
      { id: "a1", title: "Reorder 3 products", affectedItems: ["Claw hammer 16 oz", "Deck stain, cedar", "Box of 3-inch screws"], requiresApproval: true, detail: "Purchase order total $412.80" },
      { id: "a2", title: "Post a low stock summary", affectedItems: [] },
    ]} />);
    const affected = screen.getByRole("list", { name: "Items affected by Reorder 3 products" });
    expect(within(affected).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Claw hammer 16 oz", "Deck stain, cedar", "Box of 3-inch screws"]);
    expect(screen.queryByRole("list", { name: "Items affected by Post a low stock summary" })).toBeNull();
    expect(screen.getByText("Purchase order total $412.80")).toBeTruthy();
    expect(screen.getAllByText("Approval required")).toHaveLength(1);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Review approval Reorder 3 products" }));
    expect(onReviewApproval).toHaveBeenCalledWith("a1");
  });

  it("still says approval is required when no review handler is given", () => {
    render(<AutomationDryRunReview actions={[{ id: "a1", title: "Reorder 3 products", affectedItems: [], requiresApproval: true }]} />);
    expect(screen.getByText("Approval required")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("says when nothing was planned", () => {
    render(<AutomationDryRunReview actions={[]} />);
    expect(screen.getByText("No actions were planned.")).toBeTruthy();
  });
});

describe("AutomationExecutionWindowIndicator", () => {
  it("announces the window state, the reason and the next eligible time in one status", () => {
    const { rerender } = render(<AutomationExecutionWindowIndicator window={{ eligible: true, reason: "Store hours 6:00 AM to 9:00 PM", nextEligibleAt: "Tomorrow 6:00 AM" }} />);
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("Eligible nowStore hours 6:00 AM to 9:00 PM");
    rerender(<AutomationExecutionWindowIndicator window={{ eligible: false, reason: "The store is closed", nextEligibleAt: "Tomorrow 6:00 AM" }} />);
    expect(screen.getByRole("status")).toBe(status);
    expect(within(status).getByText("Outside execution window")).toBeTruthy();
    expect(within(status).getByText("The store is closed")).toBeTruthy();
    expect(within(status).getByText("Next eligible · Tomorrow 6:00 AM")).toBeTruthy();
  });

  it("omits the reason and next time when they are not known", () => {
    render(<AutomationExecutionWindowIndicator window={{ eligible: false }} />);
    expect(screen.getByRole("status").textContent).toBe("Outside execution window");
  });
});

describe("AutomationOccurrencePreview", () => {
  it("labels the time zone and says in words whether each occurrence runs or is skipped", () => {
    render(<AutomationOccurrencePreview timeZone="America/Chicago" occurrences={[
      { id: "o1", localDate: "Mon, Nov 23", localTime: "6:00 AM", state: "scheduled" },
      { id: "o2", localDate: "Thu, Nov 26", localTime: "6:00 AM", state: "skipped", detail: "Thanksgiving closure" },
    ]} />);
    expect(screen.getByText("Time zone · America/Chicago")).toBeTruthy();
    const items = screen.getAllByRole("listitem");
    expect(within(items[0]!).getByText("Mon, Nov 23 · 6:00 AM")).toBeTruthy();
    expect(within(items[0]!).getByText("Scheduled")).toBeTruthy();
    expect(within(items[1]!).getByText("Skipped · Thanksgiving closure")).toBeTruthy();
  });

  it("says when nothing is coming up", () => {
    render(<AutomationOccurrencePreview timeZone="UTC" occurrences={[]} />);
    expect(screen.getByText("No upcoming occurrences.")).toBeTruthy();
  });
});

describe("AutomationPauseWindowEditor", () => {
  function field(name: string) {
    return screen.getByLabelText(name) as HTMLInputElement;
  }

  it("prefills the saved window and submits the edited start and end", async () => {
    const onSubmit = vi.fn();
    render(<AutomationPauseWindowEditor initialValue={{ start: "2026-11-26T00:00", end: "2026-11-27T06:00" }} onSubmit={onSubmit} />);
    expect(field("Pause starts").value).toBe("2026-11-26T00:00");
    fireEvent.change(field("Pause ends"), { target: { value: "2026-11-28T06:00" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save pause window" })); });
    expect(onSubmit).toHaveBeenCalledWith({ start: "2026-11-26T00:00", end: "2026-11-28T06:00" });
  });

  it("asks for both times, then for an end after the start, without submitting", async () => {
    const onSubmit = vi.fn();
    render(<AutomationPauseWindowEditor onSubmit={onSubmit} />);
    const form = screen.getByRole("form", { name: "Pause interval" });
    await act(async () => { fireEvent.submit(form); });
    expect(screen.getByRole("alert").textContent).toBe("Choose when the pause starts and ends.");
    fireEvent.change(field("Pause starts"), { target: { value: "2026-11-26T08:00" } });
    fireEvent.change(field("Pause ends"), { target: { value: "2026-11-26T08:00" } });
    await act(async () => { fireEvent.submit(form); });
    expect(screen.getByRole("alert").textContent).toBe("Choose an end after the start.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("compares times rather than text, so seconds in a saved value do not hide an empty window", async () => {
    const onSubmit = vi.fn();
    render(<AutomationPauseWindowEditor initialValue={{ start: "2026-11-26T08:00", end: "2026-11-26T08:00:00" }} onSubmit={onSubmit} />);
    await act(async () => { fireEvent.submit(screen.getByRole("form", { name: "Pause interval" })); });
    expect(screen.getByRole("alert").textContent).toBe("Choose an end after the start.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows a failed save as an alert", async () => {
    render(<AutomationPauseWindowEditor initialValue={{ start: "2026-11-26T00:00", end: "2026-11-27T00:00" }} onSubmit={() => Promise.reject(new Error("Pause windows are locked during a release."))} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save pause window" })); });
    expect(screen.getByRole("alert").textContent).toBe("Pause windows are locked during a release.");
  });
});

describe("AutomationRetryPolicyEditor", () => {
  it("submits whole-number attempts and delay with the chosen delay policy", async () => {
    const onSubmit = vi.fn();
    render(<AutomationRetryPolicyEditor initialValue={{ attempts: 3, delaySeconds: 30, mode: "fixed" }} onSubmit={onSubmit} />);
    fireEvent.change(textbox("Maximum attempts"), { target: { value: "5" } });
    fireEvent.change(textbox("Delay in seconds"), { target: { value: "0" } });
    fireEvent.change(combobox("Delay policy"), { target: { value: "exponential" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save retry policy" })); });
    expect(onSubmit).toHaveBeenCalledWith({ attempts: 5, delaySeconds: 0, mode: "exponential" });
  });

  it("names the field in validation errors and does not submit invalid numbers", async () => {
    const onSubmit = vi.fn();
    render(<AutomationRetryPolicyEditor initialValue={{ attempts: 3, delaySeconds: 30, mode: "fixed" }} onSubmit={onSubmit} />);
    const form = screen.getByRole("form", { name: "Automation retry policy" });
    fireEvent.change(textbox("Maximum attempts"), { target: { value: "0" } });
    await act(async () => { fireEvent.submit(form); });
    expect(screen.getByRole("alert").textContent).toBe("Maximum attempts must be a whole number of at least 1.");
    fireEvent.change(textbox("Maximum attempts"), { target: { value: "2" } });
    fireEvent.change(textbox("Delay in seconds"), { target: { value: "-5" } });
    await act(async () => { fireEvent.submit(form); });
    expect(screen.getByRole("alert").textContent).toBe("Delay in seconds must be a whole number of at least 0.");
    fireEvent.change(textbox("Delay in seconds"), { target: { value: "" } });
    await act(async () => { fireEvent.submit(form); });
    expect(screen.getByRole("alert").textContent).toBe("Delay in seconds is required.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows a failed save as an alert", async () => {
    render(<AutomationRetryPolicyEditor initialValue={{ attempts: 3, delaySeconds: 30, mode: "fixed" }} onSubmit={() => Promise.reject(new Error("Retry limits are managed by your admin."))} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save retry policy" })); });
    expect(screen.getByRole("alert").textContent).toBe("Retry limits are managed by your admin.");
  });
});

describe("AutomationRunCancellation", () => {
  it("confirms cancellation with the affected work listed and passes the run id", async () => {
    const onConfirm = vi.fn();
    render(<AutomationRunCancellation runId="run-42" name="Weekly inventory audit" affected={["3 purchase orders in draft", "Supplier email queue"]} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "Review cancellation" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Cancel this run?" });
    expect(within(dialog).getByText("Weekly inventory audit")).toBeTruthy();
    expect(within(within(dialog).getByRole("list", { name: "Affected work" })).getAllByRole("listitem")).toHaveLength(2);
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel run" }));
    expect(onConfirm).toHaveBeenCalledWith("run-42");
    await vi.waitFor(() => expect(dialog.isConnected).toBe(false));
  });

  it("keeps the run going when the user backs out", async () => {
    const onConfirm = vi.fn();
    render(<AutomationRunCancellation runId="run-42" name="Weekly inventory audit" affected={[]} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "Review cancellation" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Cancel this run?" });
    expect(within(dialog).queryByRole("list")).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep running" }));
    await vi.waitFor(() => expect(dialog.isConnected).toBe(false));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("stays open with an error when cancellation fails", async () => {
    render(<AutomationRunCancellation runId="run-42" name="Weekly inventory audit" affected={[]} onConfirm={() => Promise.reject(new Error("Run already finished"))} />);
    fireEvent.click(screen.getByRole("button", { name: "Review cancellation" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Cancel this run?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel run" }));
    expect((await within(dialog).findByRole("alert")).textContent).toBe("That did not work. Try again.");
    expect(dialog.isConnected).toBe(true);
  });

  it("replaces the action with an announced reason when the run cannot be cancelled", () => {
    const { rerender } = render(<AutomationRunCancellation runId="run-42" name="Weekly inventory audit" affected={[]} onConfirm={vi.fn()} />);
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("");
    rerender(<AutomationRunCancellation runId="run-42" name="Weekly inventory audit" affected={[]} onConfirm={vi.fn()} unavailableReason="The run is writing purchase orders and cannot stop safely." />);
    expect(screen.getByRole("status")).toBe(status);
    expect(status.textContent).toBe("The run is writing purchase orders and cannot stop safely.");
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("AutomationRunHistory", () => {
  const runs = [
    { id: "r1", title: "Weekly inventory audit", startedAt: "Nov 16, 6:00 AM", status: "Succeeded", detail: "412 products checked" },
    { id: "r2", title: "Nightly price sync", startedAt: "Nov 18, 2:00 AM", status: "Failed", detail: "POS returned HTTP 503" },
    { id: "r3", title: "Nightly price sync", startedAt: "Nov 17, 2:00 AM", status: "Succeeded" },
  ];

  it("shows when each run started and its status in words, and opens a run by id", () => {
    const onOpen = vi.fn();
    render(<AutomationRunHistory runs={runs.slice(0, 2)} onOpen={onOpen} />);
    expect(screen.getByText("Nov 18, 2:00 AM · Failed · POS returned HTTP 503")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open run Nightly price sync" }));
    expect(onOpen).toHaveBeenCalledWith("r2");
  });

  it("filters by status and searches titles, start times and details", () => {
    render(<AutomationRunHistory runs={runs} onOpen={vi.fn()} />);
    fireEvent.change(combobox("Run status"), { target: { value: "Succeeded" } });
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search runs" }), { target: { value: "Nov 17" } });
    expect(screen.getByRole("listitem").textContent).toContain("Nightly price sync");
    fireEvent.change(screen.getByRole("searchbox", { name: "Search runs" }), { target: { value: "503" } });
    expect(screen.getByText("No matching runs.")).toBeTruthy();
  });

  it("says there are no runs yet when the history is empty", () => {
    render(<AutomationRunHistory runs={[]} onOpen={vi.fn()} />);
    expect(screen.getByText("No runs yet.")).toBeTruthy();
  });
});

describe("AutomationRunInputForm", () => {
  const parameters: ToolParameter[] = [
    { name: "store", label: "Store", kind: "enum", required: true, options: [{ value: "north", label: "North Avenue" }, { value: "lake", label: "Lakeside" }] },
    { name: "threshold", label: "Reorder threshold", kind: "number" },
    { name: "note", label: "Note for the buyer", kind: "string" },
  ];

  it("requests a run with the automation id and typed values", async () => {
    const onRun = vi.fn();
    render(<AutomationRunInputForm automationId="audit" automationName="Weekly inventory audit" parameters={parameters} initialValues={{ threshold: 10 }} onRun={onRun} />);
    expect(screen.getByRole("region", { name: "Run automation" }).textContent).toContain("Weekly inventory audit");
    expect(textbox("Reorder threshold").value).toBe("10");
    fireEvent.change(combobox("Store (required)"), { target: { value: "lake" } });
    fireEvent.change(textbox("Reorder threshold"), { target: { value: "12" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Request run" })); });
    expect(onRun).toHaveBeenCalledWith("audit", { store: "lake", threshold: 12 });
  });

  it("blocks a run until required inputs are filled and surfaces a failed request", async () => {
    const onRun = vi.fn().mockRejectedValue(new Error("Another run is in progress."));
    render(<AutomationRunInputForm automationId="audit" automationName="Weekly inventory audit" parameters={parameters} onRun={onRun} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Request run" })); });
    expect(screen.getByRole("alert").textContent).toBe("Store is required.");
    expect(onRun).not.toHaveBeenCalled();
    fireEvent.change(combobox("Store (required)"), { target: { value: "north" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Request run" })); });
    expect(onRun).toHaveBeenCalledWith("audit", { store: "north" });
    expect(screen.getByRole("alert").textContent).toBe("Another run is in progress.");
  });

  it("starts with fresh inputs when it switches to another automation", () => {
    const { rerender } = render(<AutomationRunInputForm automationId="audit" automationName="Weekly inventory audit" parameters={parameters} onRun={vi.fn()} />);
    fireEvent.change(textbox("Note for the buyer"), { target: { value: "Check aisle 4" } });
    rerender(<AutomationRunInputForm automationId="sync" automationName="Nightly price sync" parameters={parameters} onRun={vi.fn()} />);
    expect(textbox("Note for the buyer").value).toBe("");
    expect(screen.getByText("Nightly price sync")).toBeTruthy();
  });
});

describe("AutomationScheduleEditor", () => {
  const zones = ["America/Chicago", "America/New_York", "UTC"];
  const weekly: AutomationSchedule = { frequency: "weekly", date: null, time: "06:30", timeZone: "America/Chicago", weekdays: [1] };

  it("edits a weekly schedule, reports each draft and submits the selected days in order", async () => {
    const onDraftChange = vi.fn();
    const onSubmit = vi.fn();
    render(<AutomationScheduleEditor initialValue={weekly} timeZones={zones} onDraftChange={onDraftChange} onSubmit={onSubmit} />);
    const days = screen.getByRole("group", { name: "Days of week" });
    expect((within(days).getByRole("checkbox", { name: "Monday" }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(within(days).getByRole("checkbox", { name: "Saturday" }));
    fireEvent.click(within(days).getByRole("checkbox", { name: "Wednesday" }));
    fireEvent.change(combobox("Time zone"), { target: { value: "UTC" } });
    expect(onDraftChange).toHaveBeenLastCalledWith({ ...weekly, timeZone: "UTC", weekdays: [1, 6, 3] });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save schedule" })); });
    expect(onSubmit).toHaveBeenCalledWith({ ...weekly, timeZone: "UTC", weekdays: [1, 3, 6] });
  });

  it("asks for a weekday, a valid time and an offered time zone before saving", async () => {
    const onSubmit = vi.fn();
    render(<AutomationScheduleEditor initialValue={{ ...weekly, time: null, timeZone: "Europe/Paris" }} timeZones={zones} onSubmit={onSubmit} />);
    const form = screen.getByRole("form", { name: "Automation schedule" });
    await act(async () => { fireEvent.submit(form); });
    expect(screen.getByRole("alert").textContent).toBe("Choose a valid run time.");
    const hours = screen.getByRole("spinbutton", { name: "Run time Hours" });
    act(() => hours.focus());
    fireEvent.keyDown(hours, { key: "7" });
    fireEvent.keyDown(screen.getByRole("spinbutton", { name: "Run time Minutes" }), { key: "1" });
    fireEvent.keyDown(screen.getByRole("spinbutton", { name: "Run time Minutes" }), { key: "5" });
    fireEvent.keyDown(screen.getByRole("spinbutton", { name: "Run time AM/PM" }), { key: "a" });
    expect(combobox("Time zone").value).toBe("");
    await act(async () => { fireEvent.submit(form); });
    expect(screen.getByRole("alert").textContent).toBe("Choose an available time zone.");
    fireEvent.change(combobox("Time zone"), { target: { value: "America/New_York" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Monday" }));
    await act(async () => { fireEvent.submit(form); });
    expect(screen.getByRole("alert").textContent).toBe("Choose at least one weekday.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("needs a date for a one-time run and drops weekdays from it", async () => {
    const onSubmit = vi.fn();
    const date = new Date(2026, 10, 27);
    const { rerender } = render(<AutomationScheduleEditor key="none" initialValue={{ ...weekly, frequency: "once" }} timeZones={zones} onSubmit={onSubmit} />);
    expect(screen.queryByRole("group", { name: "Days of week" })).toBeNull();
    expect(screen.getByRole("button", { name: /^Run date/ })).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save schedule" })); });
    expect(screen.getByRole("alert").textContent).toBe("Choose a date for the one-time run.");
    rerender(<AutomationScheduleEditor key="set" initialValue={{ ...weekly, frequency: "once", date }} timeZones={zones} onSubmit={onSubmit} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save schedule" })); });
    expect(onSubmit).toHaveBeenCalledWith({ ...weekly, frequency: "once", date, weekdays: [] });
  });

  it("switches frequency, clears the date from a daily schedule and announces the next run", async () => {
    const onSubmit = vi.fn();
    const { rerender } = render(<AutomationScheduleEditor initialValue={{ ...weekly, date: new Date(2026, 10, 27) }} timeZones={zones} onSubmit={onSubmit} />);
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("");
    fireEvent.change(combobox("Repeat"), { target: { value: "daily" } });
    expect(screen.queryByRole("group", { name: "Days of week" })).toBeNull();
    rerender(<AutomationScheduleEditor initialValue={{ ...weekly, date: new Date(2026, 10, 27) }} timeZones={zones} nextRun="Tomorrow at 6:30 AM CST" onSubmit={onSubmit} />);
    expect(screen.getByRole("status")).toBe(status);
    expect(status.textContent).toBe("Next run · Tomorrow at 6:30 AM CST");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save schedule" })); });
    expect(onSubmit).toHaveBeenCalledWith({ ...weekly, frequency: "daily", date: null, weekdays: [] });
  });
});

describe("AutomationTemplatePicker", () => {
  const templates = [
    { id: "restock", title: "Low stock restock", trigger: "When stock falls below the reorder point", actions: ["Draft purchase order", "Email the supplier"], requiredInputs: ["Supplier email"] },
    { id: "digest", title: "Morning sales digest", trigger: "Every day at 7:00 AM", actions: ["Summarize yesterday's sales"], requiredInputs: [] },
  ];

  it("shows each template's trigger, actions and required inputs and selects by id", () => {
    const onSelect = vi.fn();
    render(<AutomationTemplatePicker templates={templates} onSelect={onSelect} />);
    const [restock, digest] = screen.getAllByRole("listitem");
    expect(within(restock!).getByText("When stock falls below the reorder point")).toBeTruthy();
    expect(within(restock!).getByText("Draft purchase order → Email the supplier")).toBeTruthy();
    expect(within(restock!).getByText("Supplier email")).toBeTruthy();
    expect(within(digest!).getByText("None")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Use template Morning sales digest" }));
    expect(onSelect).toHaveBeenCalledWith("digest");
  });

  it("searches titles, triggers and actions", () => {
    render(<AutomationTemplatePicker templates={templates} onSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search templates" }), { target: { value: "supplier" } });
    expect(screen.getByRole("listitem").textContent).toContain("Low stock restock");
    fireEvent.change(screen.getByRole("searchbox", { name: "Search templates" }), { target: { value: "payroll" } });
    expect(screen.getByText("No matching templates.")).toBeTruthy();
  });

  it("says when no templates are available", () => {
    render(<AutomationTemplatePicker templates={[]} onSelect={vi.fn()} />);
    expect(screen.getByText("No templates available.")).toBeTruthy();
  });
});

describe("AutomationToggleList", () => {
  const automations = [
    { id: "audit", title: "Weekly inventory audit", enabled: true, nextRun: "Mon 6:00 AM" },
    { id: "sync", title: "Nightly price sync", enabled: false },
    { id: "post", title: "Low stock post", enabled: false, unavailableReason: "Reconnect Slack to turn this on" },
  ];

  it("names each switch after its automation, including the visible label, and reports the new state", () => {
    const onToggle = vi.fn();
    render(<AutomationToggleList automations={automations} onToggle={onToggle} />);
    const audit = screen.getByRole("switch", { name: "Enabled Weekly inventory audit" }) as HTMLInputElement;
    expect(audit.checked).toBe(true);
    expect(screen.getByText("Enabled · Mon 6:00 AM")).toBeTruthy();
    fireEvent.click(audit);
    expect(onToggle).toHaveBeenCalledWith("audit", false);
    fireEvent.click(screen.getByRole("switch", { name: "Enabled Nightly price sync" }));
    expect(onToggle).toHaveBeenLastCalledWith("sync", true);
  });

  it("disables unavailable and pending automations and says why in text", () => {
    render(<AutomationToggleList automations={automations} onToggle={vi.fn()} pendingIds={["sync"]} />);
    expect((screen.getByRole("switch", { name: "Enabled Weekly inventory audit" }) as HTMLInputElement).disabled).toBe(false);
    expect((screen.getByRole("switch", { name: "Enabled Nightly price sync" }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("switch", { name: "Enabled Low stock post" }) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText("Disabled · Updating")).toBeTruthy();
    expect(screen.getByText("Disabled · Reconnect Slack to turn this on")).toBeTruthy();
  });

  it("shows state as text without switches when read-only, and says when there are none", () => {
    const { rerender } = render(<AutomationToggleList automations={automations} />);
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.getByText("Enabled · Mon 6:00 AM")).toBeTruthy();
    rerender(<AutomationToggleList automations={[]} />);
    expect(screen.getByText("No automations.")).toBeTruthy();
  });
});

describe("AutomationTriggerPicker", () => {
  const triggers = [
    { id: "manual", label: "Run on request", kind: "manual" as const },
    { id: "weekly", label: "Every Monday", kind: "scheduled" as const, description: "Runs at 6:00 AM store time." },
    { id: "stock", label: "Stock below reorder point", kind: "event" as const, description: "Runs when any product drops below its reorder point." },
  ];

  it("lists triggers with their kind in words and reports the chosen trigger id", () => {
    const onChange = vi.fn();
    render(<AutomationTriggerPicker triggers={triggers} value={null} onChange={onChange} />);
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Choose a trigger", "Run on request · Manual", "Every Monday · Scheduled", "Stock below reorder point · Event",
    ]);
    fireEvent.change(combobox("Trigger"), { target: { value: "stock" } });
    expect(onChange).toHaveBeenCalledWith("stock");
  });

  it("describes the selected trigger in a live region and ignores the placeholder", () => {
    const onChange = vi.fn();
    const { container, rerender } = render(<AutomationTriggerPicker triggers={triggers} value="weekly" onChange={onChange} />);
    const live = container.querySelector("[aria-live='polite']")!;
    expect(live.textContent).toBe("Runs at 6:00 AM store time.");
    fireEvent.change(combobox("Trigger"), { target: { value: "" } });
    expect(onChange).not.toHaveBeenCalled();
    rerender(<AutomationTriggerPicker triggers={triggers} value="manual" onChange={onChange} />);
    expect(live.textContent).toBe("");
  });

  it("falls back to the placeholder when the value is not an offered trigger", () => {
    render(<AutomationTriggerPicker triggers={triggers} value="deleted" onChange={vi.fn()} />);
    expect(combobox("Trigger").value).toBe("");
  });
});
