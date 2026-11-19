// packages/ai-ui/test/assistant.test.tsx
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AssistantAvailabilityPicker,
  AssistantAvailabilityPollReview,
  AssistantConflictReview,
  AssistantContactPicker,
  AssistantDailyBriefing,
  AssistantDailyPlanEditor,
  AssistantDraftReview,
  AssistantFollowUpList,
  AssistantInboxTriage,
  AssistantNotificationPreferences,
  AssistantReminderEditor,
  AssistantRoutineChecklist,
  AssistantRoutineEditor,
  MeetingActionsReview,
  MeetingPrepCard,
  PersonalCommitmentsTimeline,
  toIsoDate,
  type AssistantRoutineDraft,
} from "../src/index.js";

afterEach(() => {
  vi.useRealTimers();
});

function select(name: string | RegExp) {
  return screen.getByRole<HTMLSelectElement>("combobox", { name });
}

function option(field: HTMLSelectElement, name: string) {
  return within(field).getByRole<HTMLOptionElement>("option", { name });
}

async function submit(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

function timeSegments(name: string) {
  const group = screen.getByRole("group", { name });
  return {
    hour: within(group).getByRole("spinbutton", { name: `${name} Hours` }),
    minute: within(group).getByRole("spinbutton", { name: `${name} Minutes` }),
    period: within(group).getByRole("spinbutton", { name: `${name} AM/PM` }),
  };
}

function typeTime(name: string, hour: string, minutes: string, period: "a" | "p") {
  const segments = timeSegments(name);
  act(() => segments.hour.focus());
  fireEvent.keyDown(segments.hour, { key: hour });
  for (const digit of minutes) fireEvent.keyDown(segments.minute, { key: digit });
  fireEvent.keyDown(segments.period, { key: period });
}

describe("AssistantAvailabilityPicker", () => {
  const slots = [
    { id: "tue-10", label: "Tue 10:00 AM" },
    { id: "tue-14", label: "Tue 2:00 PM", unavailableReason: "Busy with supplier call" },
    { id: "wed-9", label: "Wed 9:30 AM" },
  ];

  it("shows the time zone, explains unavailable slots in text and reports only available picks", () => {
    const onChange = vi.fn();
    render(<AssistantAvailabilityPicker slots={slots} timeZone="America/Chicago" value={null} onChange={onChange} />);
    expect(screen.getByRole("region", { name: "Scheduling availability" })).toBeTruthy();
    expect(screen.getByText("Time zone · America/Chicago")).toBeTruthy();
    const field = select("Time slot");
    expect(field.value).toBe("");
    expect(option(field, "Tue 2:00 PM · Busy with supplier call").disabled).toBe(true);

    fireEvent.change(field, { target: { value: "tue-14" } });
    fireEvent.change(field, { target: { value: "" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: "wed-9" } });
    expect(onChange).toHaveBeenCalledWith("wed-9");
  });

  it("reflects the chosen slot and ignores a value that is no longer offered", () => {
    const { rerender } = render(<AssistantAvailabilityPicker slots={slots} timeZone="UTC" value="tue-10" onChange={vi.fn()} />);
    expect(select("Time slot").value).toBe("tue-10");
    rerender(<AssistantAvailabilityPicker slots={slots} timeZone="UTC" value="fri-8" onChange={vi.fn()} />);
    expect(select("Time slot").value).toBe("");
  });

  it("says when there are no slots instead of showing an empty select", () => {
    render(<AssistantAvailabilityPicker slots={[]} timeZone="UTC" value={null} onChange={vi.fn()} />);
    expect(screen.getByText("No time slots available.")).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});

describe("AssistantAvailabilityPollReview", () => {
  const participants = [{ id: "dana", label: "Dana" }, { id: "luis", label: "Luis" }];
  const slots = [
    { id: "mon", label: "Mon 9:00 AM", responses: { dana: "yes", luis: "maybe" } },
    { id: "tue", label: "Tue 1:00 PM", responses: { dana: "no" } },
  ] as const;

  it("tabulates each participant's answer in words, including missing responses", () => {
    render(<AssistantAvailabilityPollReview slots={slots} participants={participants} timeZone="America/Denver" onPropose={vi.fn()} />);
    expect(screen.getByText("Time zone · America/Denver")).toBeTruthy();
    const table = screen.getByRole("table", { name: "Participant availability" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Participant", "Mon 9:00 AM", "Tue 1:00 PM"]);
    const luis = within(table).getByRole("row", { name: /Luis/ });
    expect(within(luis).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["Maybe", "No response"]);
    const dana = within(table).getByRole("row", { name: /Dana/ });
    expect(within(dana).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["Yes", "No"]);
  });

  it("proposes the chosen slot only after one is picked", async () => {
    const onPropose = vi.fn();
    render(<AssistantAvailabilityPollReview slots={slots} participants={participants} timeZone="UTC" onPropose={onPropose} />);
    const button = screen.getByRole<HTMLButtonElement>("button", { name: "Propose time" });
    expect(button.disabled).toBe(true);
    fireEvent.change(select("Proposed time"), { target: { value: "mon" } });
    expect(button.disabled).toBe(false);
    await submit("Propose time");
    expect(onPropose).toHaveBeenCalledWith("mon");
  });

  it("shows an alert when proposing fails", async () => {
    const onPropose = vi.fn().mockRejectedValue(new Error("Calendar is offline."));
    render(<AssistantAvailabilityPollReview slots={slots} participants={participants} timeZone="UTC" onPropose={onPropose} />);
    fireEvent.change(select("Proposed time"), { target: { value: "tue" } });
    await submit("Propose time");
    expect(screen.getByRole("alert").textContent).toBe("Calendar is offline.");
  });

  it("explains empty polls and polls with no participants", () => {
    const { rerender } = render(<AssistantAvailabilityPollReview slots={[]} participants={participants} timeZone="UTC" onPropose={vi.fn()} />);
    expect(screen.getByText("No time slots to review.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Propose time" })).toBeNull();
    rerender(<AssistantAvailabilityPollReview slots={slots} participants={[]} timeZone="UTC" onPropose={vi.fn()} />);
    expect(screen.getByText("No participants in this poll yet.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("button", { name: "Propose time" })).toBeTruthy();
  });
});

describe("AssistantConflictReview", () => {
  const conflicts = [
    {
      id: "c1",
      title: "Supplier call overlaps staff huddle",
      commitments: ["9:00 AM Supplier call", "9:15 AM Staff huddle"],
      resolutions: [
        { id: "move", label: "Move the huddle to 10 AM", detail: "Everyone is free at 10." },
        { id: "decline", label: "Decline the later event" },
      ],
    },
    {
      id: "c2",
      title: "Delivery window overlaps lunch",
      commitments: ["12:00 PM Lumber delivery", "12:30 PM Lunch with Sam"],
      resolutions: [{ id: "decline", label: "Decline the later event" }],
    },
  ];

  it("lists each conflict's commitments and names every choice by resolution and conflict", () => {
    const onChoose = vi.fn();
    render(<AssistantConflictReview conflicts={conflicts} onChoose={onChoose} />);
    expect(screen.getByRole("heading", { name: "Supplier call overlaps staff huddle" })).toBeTruthy();
    expect(screen.getByText("9:15 AM Staff huddle").tagName).toBe("LI");
    expect(screen.getByText("Everyone is free at 10.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Choose Decline the later event for Delivery window overlaps lunch" }));
    expect(onChoose).toHaveBeenCalledWith("c2", "decline");
    fireEvent.click(screen.getByRole("button", { name: "Choose Move the huddle to 10 AM for Supplier call overlaps staff huddle" }));
    expect(onChoose).toHaveBeenLastCalledWith("c1", "move");
  });

  it("locks only the conflict that is being resolved", () => {
    render(<AssistantConflictReview conflicts={conflicts} onChoose={vi.fn()} pendingIds={["c1"]} />);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Choose Decline the later event for Supplier call overlaps staff huddle" }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Choose Decline the later event for Delivery window overlaps lunch" }).disabled).toBe(false);
  });

  it("shows empty states for no conflicts and for a conflict without resolutions", () => {
    const { rerender } = render(<AssistantConflictReview conflicts={[]} onChoose={vi.fn()} />);
    expect(screen.getByText("No overlapping commitments.")).toBeTruthy();
    rerender(<AssistantConflictReview conflicts={[{ id: "c3", title: "Inventory count overlaps", commitments: [], resolutions: [] }]} onChoose={vi.fn()} />);
    expect(screen.getByText("No resolutions available.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("AssistantContactPicker", () => {
  const contacts = [
    { id: "dana", label: "Dana Whitten", kind: "person" as const, detail: "Store manager" },
    { id: "floor", label: "Floor staff", kind: "group" as const, detail: "8 people" },
    { id: "luis", label: "Luis Ortega", kind: "person" as const },
  ];

  it("searches and filters contacts by type and reports the chosen contact with its kind", () => {
    const onSelect = vi.fn();
    render(<AssistantContactPicker contacts={contacts} onSelect={onSelect} />);
    expect(screen.getByText("Group · 8 people")).toBeTruthy();
    expect(screen.getByText("Person · Store manager")).toBeTruthy();
    fireEvent.change(select("Contact type"), { target: { value: "group" } });
    expect(screen.queryByRole("button", { name: "Select Dana Whitten" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Select Floor staff" }));
    expect(onSelect).toHaveBeenCalledWith("floor", "group");

    fireEvent.change(select("Contact type"), { target: { value: "" } });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search contacts" }), { target: { value: "manager" } });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Select Dana Whitten" }));
    expect(onSelect).toHaveBeenLastCalledWith("dana", "person");
  });

  it("marks the current contact as selected and disables choosing it again", () => {
    render(<AssistantContactPicker contacts={contacts} value="luis" onSelect={vi.fn()} />);
    const current = screen.getByRole<HTMLButtonElement>("button", { name: "Selected Luis Ortega" });
    expect(current.disabled).toBe(true);
    expect(current.textContent).toBe("Selected");
  });

  it("says when no contact matches", () => {
    render(<AssistantContactPicker contacts={contacts} onSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search contacts" }), { target: { value: "zzz" } });
    expect(screen.getByText("No matching contacts.")).toBeTruthy();
  });
});

describe("AssistantDailyBriefing", () => {
  const briefing = {
    agenda: [{ id: "a1", title: "Supplier call", detail: "9:00 AM" }],
    priorities: [{ id: "p1", title: "Approve the paint order", detail: "Due by noon" }],
    followUps: [],
  };

  it("groups items under agenda, priorities and follow-ups and opens an item with its section", () => {
    const onOpen = vi.fn();
    render(<AssistantDailyBriefing briefing={briefing} onOpen={onOpen} />);
    expect(screen.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent)).toEqual(["Agenda", "Priorities", "Follow-ups"]);
    expect(screen.getByText("Due by noon")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open Approve the paint order" }));
    expect(onOpen).toHaveBeenCalledWith("priorities", "p1");
    fireEvent.click(screen.getByRole("button", { name: "Open Supplier call" }));
    expect(onOpen).toHaveBeenLastCalledWith("agenda", "a1");
  });

  it("gives each empty section its own message and hides Open without a handler", () => {
    render(<AssistantDailyBriefing briefing={{ agenda: [], priorities: [], followUps: [{ id: "f1", title: "Call Luis back" }] }} />);
    expect(screen.getByText("No agenda items today.")).toBeTruthy();
    expect(screen.getByText("No priorities set.")).toBeTruthy();
    expect(screen.getByText("Call Luis back")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("AssistantDailyPlanEditor", () => {
  const tasks = [
    { id: "t1", title: "Count the register", blockId: "morning" },
    { id: "t2", title: "Order deck screws", blockId: null },
  ];
  const blocks = [
    { id: "morning", label: "8:00 to 10:00 AM" },
    { id: "lunch", label: "12:00 to 1:00 PM", unavailable: true },
    { id: "afternoon", label: "2:00 to 4:00 PM" },
  ];

  it("places a task in a time block, back to unscheduled, and marks unavailable blocks in text", () => {
    const onPlace = vi.fn();
    render(<AssistantDailyPlanEditor tasks={tasks} blocks={blocks} onReorder={vi.fn()} onPlace={onPlace} />);
    const count = select("Time block for Count the register");
    expect(count.value).toBe("morning");
    expect(select("Time block for Order deck screws").value).toBe("");
    expect(option(count, "12:00 to 1:00 PM · Unavailable").disabled).toBe(true);

    fireEvent.change(select("Time block for Order deck screws"), { target: { value: "afternoon" } });
    expect(onPlace).toHaveBeenCalledWith("t2", "afternoon");
    fireEvent.change(count, { target: { value: "lunch" } });
    expect(onPlace).toHaveBeenCalledTimes(1);
    fireEvent.change(count, { target: { value: "" } });
    expect(onPlace).toHaveBeenLastCalledWith("t1", null);
  });

  it("reorders tasks from the keyboard and reports the new order", () => {
    const onReorder = vi.fn();
    render(<AssistantDailyPlanEditor tasks={tasks} blocks={blocks} onReorder={onReorder} onPlace={vi.fn()} />);
    expect(screen.getByRole("list", { name: "Daily priorities" })).toBeTruthy();
    const handle = screen.getByRole("button", { name: "Reorder Order deck screws" });
    act(() => handle.focus());
    fireEvent.keyDown(handle, { key: " " });
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    fireEvent.keyDown(screen.getByRole("button", { name: "Reorder Order deck screws" }), { key: "Enter" });
    expect(onReorder).toHaveBeenCalledWith(["t2", "t1"]);
  });

  it("says when there is nothing to plan", () => {
    render(<AssistantDailyPlanEditor tasks={[]} blocks={blocks} onReorder={vi.fn()} onPlace={vi.fn()} />);
    expect(screen.getByText("No tasks to plan.")).toBeTruthy();
  });
});

describe("AssistantDraftReview", () => {
  const draft = "Hi Sam, the cedar boards arrive Thursday. Want us to hold six for you?";

  it("submits the edited draft with the chosen decision", async () => {
    const onDecide = vi.fn();
    render(<AssistantDraftReview initialText={draft} recipient="Sam Patel" onDecide={onDecide} />);
    expect(screen.getByText("Recipient · Sam Patel")).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "Draft" }), { target: { value: draft + " Thanks!" } });
    await submit("Submit decision");
    expect(onDecide).toHaveBeenCalledWith("approve", draft + " Thanks!");

    fireEvent.change(select("Decision"), { target: { value: "return" } });
    await submit("Submit decision");
    expect(onDecide).toHaveBeenLastCalledWith("return", draft + " Thanks!");
  });

  it("refuses to approve an empty draft but lets it go back for revision", async () => {
    const onDecide = vi.fn();
    render(<AssistantDraftReview initialText={draft} onDecide={onDecide} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Draft" }), { target: { value: "  " } });
    await submit("Submit decision");
    expect(screen.getByRole("alert").textContent).toBe("Enter a draft before approving.");
    expect(onDecide).not.toHaveBeenCalled();
    fireEvent.change(select("Decision"), { target: { value: "return" } });
    await submit("Submit decision");
    expect(onDecide).toHaveBeenCalledWith("return", "  ");
  });

  it("surfaces a failed decision", async () => {
    render(<AssistantDraftReview initialText={draft} onDecide={vi.fn().mockRejectedValue(new Error("Mail server unavailable."))} />);
    await submit("Submit decision");
    expect(screen.getByRole("alert").textContent).toBe("Mail server unavailable.");
  });

  it("replaces the edited text and decision when the assistant sends a new draft", () => {
    const { rerender } = render(<AssistantDraftReview initialText={draft} onDecide={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Draft" }), { target: { value: "Edited" } });
    fireEvent.change(select("Decision"), { target: { value: "return" } });
    rerender(<AssistantDraftReview initialText="Revised: the cedar boards arrive Friday." onDecide={vi.fn()} />);
    expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Draft" }).value).toBe("Revised: the cedar boards arrive Friday.");
    expect(select("Decision").value).toBe("approve");
  });
});

describe("AssistantFollowUpList", () => {
  const items = [
    { id: "f1", title: "Call Luis about the mower repair", detail: "He asked for a quote.", due: "Today, 4:00 PM" },
    { id: "f2", title: "Send the deck stain estimate" },
  ];

  it("marks a follow-up done or snoozes it by id", () => {
    const onComplete = vi.fn();
    const onSnooze = vi.fn();
    render(<AssistantFollowUpList items={items} onComplete={onComplete} onSnooze={onSnooze} />);
    expect(screen.getByText("Today, 4:00 PM")).toBeTruthy();
    expect(screen.getByText("He asked for a quote.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mark done: Send the deck stain estimate" }));
    fireEvent.click(screen.getByRole("button", { name: "Snooze Call Luis about the mower repair" }));
    expect(onComplete).toHaveBeenCalledWith("f2");
    expect(onSnooze).toHaveBeenCalledWith("f1");
  });

  it("locks a pending follow-up and marks it busy", () => {
    render(<AssistantFollowUpList items={items} onComplete={vi.fn()} onSnooze={vi.fn()} pendingIds={["f1"]} />);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Mark done: Call Luis about the mower repair" }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Snooze Call Luis about the mower repair" }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Mark done: Send the deck stain estimate" }).disabled).toBe(false);
    expect(screen.getAllByRole("listitem")[0]!.getAttribute("aria-busy")).toBe("true");
  });

  it("hides actions without handlers and says when nothing is pending", () => {
    const { rerender } = render(<AssistantFollowUpList items={items} />);
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<AssistantFollowUpList items={[]} />);
    expect(screen.getByText("No follow-ups pending.")).toBeTruthy();
  });
});

describe("AssistantInboxTriage", () => {
  const items = [
    { id: "m1", title: "Invoice from Orgill", kind: "Email", detail: "Due Friday" },
    { id: "m2", title: "Voicemail from Dana", kind: "Voicemail", allowed: ["follow-up"] as const },
  ];

  it("offers only the allowed triage actions and reports each with the item id", () => {
    const onTriage = vi.fn();
    const onOpen = vi.fn();
    render(<AssistantInboxTriage items={items} onTriage={onTriage} onOpen={onOpen} />);
    expect(screen.getByText("Email · Due Friday")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "File Invoice from Orgill" }));
    fireEvent.click(screen.getByRole("button", { name: "Defer Invoice from Orgill" }));
    expect(screen.queryByRole("button", { name: "File Voicemail from Dana" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Follow up Voicemail from Dana" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Voicemail from Dana" }));
    expect(onTriage.mock.calls).toEqual([["m1", "file"], ["m1", "defer"], ["m2", "follow-up"]]);
    expect(onOpen).toHaveBeenCalledWith("m2");
  });

  it("locks triage for pending items while still allowing them to be opened", () => {
    render(<AssistantInboxTriage items={items} onTriage={vi.fn()} onOpen={vi.fn()} pendingIds={["m1"]} />);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "File Invoice from Orgill" }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Open Invoice from Orgill" }).disabled).toBe(false);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Follow up Voicemail from Dana" }).disabled).toBe(false);
  });

  it("searches the inbox and shows the empty message", () => {
    render(<AssistantInboxTriage items={items} onTriage={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /^Open/ })).toBeNull();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search inbox" }), { target: { value: "voicemail" } });
    expect(screen.queryByText("Invoice from Orgill")).toBeNull();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search inbox" }), { target: { value: "lumber" } });
    expect(screen.getByText("No inbox items to review.")).toBeTruthy();
  });
});

describe("AssistantNotificationPreferences", () => {
  const options = [
    { id: "push-briefing", channel: "Push", event: "Morning briefing", enabled: true },
    { id: "text-delivery", channel: "Text", event: "Delivery arrived", enabled: false },
  ];

  it("saves every preference with local changes applied and announces the save", async () => {
    const onSave = vi.fn();
    render(<AssistantNotificationPreferences options={options} onSave={onSave} />);
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("");
    fireEvent.click(screen.getByRole("checkbox", { name: "Text · Delivery arrived" }));
    await submit("Save preferences");
    expect(onSave).toHaveBeenCalledWith({ "push-briefing": true, "text-delivery": true });
    expect(status.textContent).toBe("Preferences saved.");
    fireEvent.click(screen.getByRole("checkbox", { name: "Push · Morning briefing" }));
    expect(status.textContent).toBe("");
  });

  it("keeps changes and shows the error when saving fails", async () => {
    render(<AssistantNotificationPreferences options={options} onSave={vi.fn().mockRejectedValue(new Error("Settings could not be saved."))} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Push · Morning briefing" }));
    await submit("Save preferences");
    expect(screen.getByRole("alert").textContent).toBe("Settings could not be saved.");
    expect(screen.getByRole("status").textContent).toBe("");
    expect(screen.getByRole<HTMLInputElement>("checkbox", { name: "Push · Morning briefing" }).checked).toBe(false);
  });

  it("disables saving when there are no channels", () => {
    render(<AssistantNotificationPreferences options={[]} onSave={vi.fn()} />);
    expect(screen.getByText("No channels available.")).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Save preferences" }).disabled).toBe(true);
  });
});

describe("AssistantReminderEditor", () => {
  it("requires a title, date and time before saving", async () => {
    const onSubmit = vi.fn();
    render(<AssistantReminderEditor timeZone="America/Chicago" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Reminder title" }), { target: { value: "Reorder propane tanks" } });
    await submit("Save reminder");
    expect(screen.getByRole("alert").textContent).toBe("Enter a title, date and time.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("creates a reminder from the date and time pickers, then clears for the next one and announces it", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 19, 9));
    const onSubmit = vi.fn();
    render(<AssistantReminderEditor timeZone="America/Chicago" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Reminder title" }), { target: { value: "  Reorder propane tanks " } });
    fireEvent.click(screen.getByRole("button", { name: /^Reminder date/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Friday, November 20, 2026" }));
    typeTime("Reminder time", "9", "30", "a");
    expect(screen.getByText("Time zone · America/Chicago")).toBeTruthy();
    await submit("Save reminder");

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const value = onSubmit.mock.calls[0]![0];
    expect({ ...value, date: toIsoDate(value.date) }).toEqual({ title: "Reorder propane tanks", date: "2026-11-20", time: "09:30", timeZone: "America/Chicago" });
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Reminder title" }).value).toBe("");
    expect(timeSegments("Reminder time").hour.getAttribute("aria-valuetext")).toBe("Empty");
    expect(screen.getByRole("status").textContent).toBe("Reminder saved.");
    fireEvent.change(screen.getByRole("textbox", { name: "Reminder title" }), { target: { value: "Next" } });
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("keeps an edited reminder in place and sends its time as HH:mm", async () => {
    const onSubmit = vi.fn();
    const date = new Date(2026, 10, 24);
    render(<AssistantReminderEditor initialValue={{ title: "Staff meeting", date, time: "2:30 PM", timeZone: "UTC" }} timeZone="America/Chicago" onSubmit={onSubmit} />);
    await submit("Save reminder");
    expect(onSubmit).toHaveBeenCalledWith({ title: "Staff meeting", date, time: "14:30", timeZone: "America/Chicago" });
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Reminder title" }).value).toBe("Staff meeting");
  });

  it("keeps the draft and shows the error when saving fails", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Reminder service is down."));
    render(<AssistantReminderEditor initialValue={{ title: "Pay the electric bill", date: new Date(2026, 10, 30), time: "08:00", timeZone: "UTC" }} timeZone="UTC" onSubmit={onSubmit} />);
    await submit("Save reminder");
    expect(screen.getByRole("alert").textContent).toBe("Reminder service is down.");
    expect(screen.getByRole("status").textContent).toBe("");
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Reminder title" }).value).toBe("Pay the electric bill");
  });
});

describe("AssistantRoutineChecklist", () => {
  const steps = [
    { id: "s1", title: "Unlock the doors", checked: true },
    { id: "s2", title: "Count the till", checked: false },
    { id: "s3", title: "Check overnight orders", checked: false },
  ];

  it("shows progress as a status and reports each toggle with the occurrence", () => {
    const onChange = vi.fn();
    render(<AssistantRoutineChecklist occurrenceId="open-1119" occurrenceLabel="Opening routine · Thursday" steps={steps} onChange={onChange} />);
    expect(screen.getByText("Opening routine · Thursday")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("1 of 3 done");
    fireEvent.click(screen.getByRole("checkbox", { name: "Count the till" }));
    expect(onChange).toHaveBeenCalledWith("open-1119", "s2", true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Unlock the doors" }));
    expect(onChange).toHaveBeenLastCalledWith("open-1119", "s1", false);
  });

  it("disables steps that are saving", () => {
    render(<AssistantRoutineChecklist occurrenceId="o" occurrenceLabel="Closing" steps={steps} onChange={vi.fn()} pendingIds={["s3"]} />);
    expect(screen.getByRole<HTMLInputElement>("checkbox", { name: "Check overnight orders" }).disabled).toBe(true);
    expect(screen.getByRole<HTMLInputElement>("checkbox", { name: "Count the till" }).disabled).toBe(false);
  });

  it("says when the routine has no steps", () => {
    render(<AssistantRoutineChecklist occurrenceId="o" occurrenceLabel="Closing" steps={[]} onChange={vi.fn()} />);
    expect(screen.getByText("No routine steps.")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("0 of 0 done");
  });
});

describe("AssistantRoutineEditor", () => {
  const routine: AssistantRoutineDraft = {
    title: "Opening routine",
    steps: [{ id: "s1", title: "Unlock the doors" }, { id: "s2", title: "Count the till" }],
    frequency: "manual",
    time: null,
    timeZone: "America/Chicago",
  };
  const zones = ["America/Chicago", "America/New_York"];

  it("adds steps with the button or Enter without submitting, removes and reorders them", async () => {
    const onSubmit = vi.fn();
    render(<AssistantRoutineEditor initialValue={routine} timeZones={zones} onSubmit={onSubmit} />);
    const addButton = screen.getByRole<HTMLButtonElement>("button", { name: "Add step" });
    expect(addButton.disabled).toBe(true);
    const field = screen.getByRole("textbox", { name: "New routine step" });
    fireEvent.change(field, { target: { value: " Turn on the lights " } });
    fireEvent.click(addButton);
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Step 3" }).value).toBe("Turn on the lights");
    fireEvent.change(field, { target: { value: "Check the safe" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Step 4" }).value).toBe("Check the safe");
    expect((field as HTMLInputElement).value).toBe("");
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Remove step Count the till" }));
    const handle = screen.getByRole("button", { name: "Reorder Check the safe" });
    act(() => handle.focus());
    fireEvent.keyDown(handle, { key: " " });
    fireEvent.keyDown(handle, { key: "Home" });
    fireEvent.keyDown(screen.getByRole("button", { name: "Reorder Check the safe" }), { key: "Enter" });
    await submit("Save routine");
    expect(onSubmit.mock.lastCall![0].steps.map((step: { title: string }) => step.title)).toEqual(["Check the safe", "Unlock the doors", "Turn on the lights"]);
  });

  it("names an untitled step's controls by position and blocks saving it", async () => {
    const onSubmit = vi.fn();
    render(<AssistantRoutineEditor initialValue={routine} timeZones={zones} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Step 2" }), { target: { value: " " } });
    expect(screen.getByRole("button", { name: "Remove step Step 2" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reorder Step 2" })).toBeTruthy();
    await submit("Save routine");
    expect(screen.getByRole("alert").textContent).toBe("Enter a routine name and at least one named step.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("saves a manual routine with trimmed text and no time", async () => {
    const onSubmit = vi.fn();
    render(<AssistantRoutineEditor initialValue={{ ...routine, time: "07:00", weekday: 2 }} timeZones={zones} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Routine name" }), { target: { value: "  Morning open  " } });
    expect(screen.queryByRole("group", { name: "Routine time" })).toBeNull();
    await submit("Save routine");
    expect(onSubmit).toHaveBeenCalledWith({ ...routine, title: "Morning open", time: null });
  });

  it("requires a time, an offered time zone and a weekday for weekly routines", async () => {
    const onSubmit = vi.fn();
    render(<AssistantRoutineEditor initialValue={{ ...routine, timeZone: "Asia/Tokyo" }} timeZones={zones} onSubmit={onSubmit} />);
    fireEvent.change(select("Repeat"), { target: { value: "weekly" } });
    await submit("Save routine");
    expect(screen.getByRole("alert").textContent).toBe("Choose a time and an available time zone.");
    typeTime("Routine time", "7", "15", "a");
    fireEvent.change(select("Time zone"), { target: { value: "America/New_York" } });
    await submit("Save routine");
    expect(screen.getByRole("alert").textContent).toBe("Choose a weekday.");
    fireEvent.change(select("Weekday"), { target: { value: "1" } });
    await submit("Save routine");
    expect(onSubmit).toHaveBeenCalledWith({ ...routine, frequency: "weekly", time: "07:15", timeZone: "America/New_York", weekday: 1 });
  });

  it("drops the weekday from daily routines and surfaces a failed save", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Routine could not be saved."));
    render(<AssistantRoutineEditor initialValue={{ ...routine, frequency: "daily", time: "06:45", weekday: 3 }} timeZones={zones} onSubmit={onSubmit} />);
    await submit("Save routine");
    expect(onSubmit).toHaveBeenCalledWith({ ...routine, frequency: "daily", time: "06:45" });
    expect(screen.getByRole("alert").textContent).toBe("Routine could not be saved.");
  });
});

describe("MeetingActionsReview", () => {
  const actions = [
    { id: "a1", title: "Send the revised quote to Acme", detail: "Dana asked for it by Friday." },
    { id: "a2", title: "Book the forklift inspection" },
  ];

  it("gives each suggested action its own form with fields named after it", async () => {
    const onDecide = vi.fn();
    render(<MeetingActionsReview actions={actions} onDecide={onDecide} />);
    const form = screen.getByRole("form", { name: "Review Send the revised quote to Acme" });
    expect(within(form).getByText("Dana asked for it by Friday.")).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "Action title for Send the revised quote to Acme" }), { target: { value: " Send Acme the revised quote today " } });
    await submit("Submit decision for Send the revised quote to Acme");
    expect(onDecide).toHaveBeenCalledWith("a1", "accept", "Send Acme the revised quote today");

    fireEvent.change(select("Action decision for Book the forklift inspection"), { target: { value: "dismiss" } });
    await submit("Submit decision for Book the forklift inspection");
    expect(onDecide).toHaveBeenLastCalledWith("a2", "dismiss", "Book the forklift inspection");
  });

  it("requires a title to accept, allows dismissing without one, and surfaces failures", async () => {
    const onDecide = vi.fn().mockRejectedValueOnce(new Error("Task list unavailable.")).mockResolvedValue(undefined);
    render(<MeetingActionsReview actions={actions.slice(1)} onDecide={onDecide} />);
    await submit("Submit decision for Book the forklift inspection");
    expect(screen.getByRole("alert").textContent).toBe("Task list unavailable.");
    fireEvent.change(screen.getByRole("textbox", { name: "Action title for Book the forklift inspection" }), { target: { value: "" } });
    await submit("Submit decision for Book the forklift inspection");
    expect(screen.getByRole("alert").textContent).toBe("Enter an action title.");
    expect(onDecide).toHaveBeenCalledTimes(1);
    fireEvent.change(select("Action decision for Book the forklift inspection"), { target: { value: "dismiss" } });
    await submit("Submit decision for Book the forklift inspection");
    expect(onDecide).toHaveBeenLastCalledWith("a2", "dismiss", "");
  });

  it("says when there are no proposed actions", () => {
    render(<MeetingActionsReview actions={[]} onDecide={vi.fn()} />);
    expect(screen.getByText("No proposed actions.")).toBeTruthy();
  });
});

describe("MeetingPrepCard", () => {
  const meeting = {
    title: "Quarterly review with Orgill",
    time: "Thursday, 2:00 PM",
    agenda: ["Fill rates", "Spring promotions"],
    attendees: ["Dana Whitten", "Sam Patel", "Orgill rep"],
    materials: [{ id: "m1", title: "Q3 fill rate report" }],
    questions: ["Can lead times drop below two weeks?"],
  };

  it("summarizes each section with its count, opens the agenda and opens materials", () => {
    const onOpenMaterial = vi.fn();
    const { container } = render(<MeetingPrepCard meeting={meeting} onOpenMaterial={onOpenMaterial} />);
    expect(screen.getByText("Quarterly review with Orgill")).toBeTruthy();
    expect(screen.getByText("Thursday, 2:00 PM")).toBeTruthy();
    const summaries = [...container.querySelectorAll("summary")].map((summary) => summary.textContent);
    expect(summaries).toEqual(["Agenda · 2", "Attendees · 3", "Open questions · 1", "Materials · 1"]);
    expect(container.querySelector("details")?.open).toBe(true);
    expect(screen.getByText("Can lead times drop below two weeks?").tagName).toBe("LI");
    fireEvent.click(screen.getByRole("button", { name: "Open Q3 fill rate report" }));
    expect(onOpenMaterial).toHaveBeenCalledWith("m1");
  });

  it("leaves out empty sections and hides Open without a handler", () => {
    const { container } = render(<MeetingPrepCard meeting={{ ...meeting, attendees: [], questions: [] }} />);
    expect([...container.querySelectorAll("summary")].map((summary) => summary.textContent)).toEqual(["Agenda · 2", "Materials · 1"]);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("says when there is nothing to prepare", () => {
    render(<MeetingPrepCard meeting={{ ...meeting, agenda: [], attendees: [], materials: [], questions: [] }} />);
    expect(screen.getByText("No preparation notes yet.")).toBeTruthy();
  });
});

describe("PersonalCommitmentsTimeline", () => {
  const items = [
    { id: "c1", title: "Dentist", day: "Today", time: "8:00 AM", source: "Calendar" },
    { id: "c2", title: "Pick up paint samples", day: "Today", source: "Email from Sam" },
    { id: "c3", title: "Soccer practice", day: "Saturday", time: "10:00 AM" },
  ];

  it("groups commitments by day in order and opens their source", () => {
    const onOpen = vi.fn();
    const { container } = render(<PersonalCommitmentsTimeline items={items} onOpen={onOpen} />);
    expect(screen.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent)).toEqual(["Today", "Saturday"]);
    expect(container.querySelector("ol")?.children).toHaveLength(2);
    expect(screen.getByText("8:00 AM · Calendar")).toBeTruthy();
    expect(screen.getByText("Email from Sam")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open source Soccer practice" }));
    expect(onOpen).toHaveBeenCalledWith("c3");
  });

  it("hides Open source without a handler and shows the empty state", () => {
    const { rerender } = render(<PersonalCommitmentsTimeline items={items} />);
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<PersonalCommitmentsTimeline items={[]} />);
    expect(screen.getByText("No upcoming commitments.")).toBeTruthy();
  });
});
