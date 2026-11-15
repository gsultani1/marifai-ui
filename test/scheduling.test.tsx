// packages/ai-ui/test/scheduling.test.tsx
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  addMonths,
  type CalendarEvent,
  DatePicker,
  DateRangePicker,
  describeRecurrence,
  differenceInDays,
  EventCalendar,
  expandEvents,
  KanbanBoard,
  type KanbanCard,
  layoutDay,
  monthGrid,
  parseIsoDate,
  rankAt,
  rankBetween,
  Timeline,
  toIsoDate,
} from "../src/index.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("date helpers", () => {
  it("builds month grids, clamps month math and parses ISO dates", () => {
    const grid = monthGrid(2026, 9, 1);
    expect(grid).toHaveLength(42);
    expect(toIsoDate(grid[0]!)).toBe("2026-09-28");
    expect(toIsoDate(addMonths(new Date(2026, 0, 31), 1))).toBe("2026-02-28");
    expect(differenceInDays(new Date(2026, 2, 30), new Date(2026, 2, 1))).toBe(29);
    expect(parseIsoDate("2026-02-30")).toBeNull();
    expect(toIsoDate(parseIsoDate("2026-10-24")!)).toBe("2026-10-24");
  });

  it("expands recurring events within a range and describes the rule", () => {
    const weekly: CalendarEvent = { id: "w", title: "Staff meeting", start: new Date(2026, 9, 5, 9), end: new Date(2026, 9, 5, 10), recurrence: "FREQ=WEEKLY;BYDAY=MO,TH;COUNT=5" };
    const occurrences = expandEvents([weekly], new Date(2026, 9, 1), new Date(2026, 10, 1));
    expect(occurrences.map((item) => toIsoDate(item.start))).toEqual(["2026-10-05", "2026-10-08", "2026-10-12", "2026-10-15", "2026-10-19"]);
    expect(occurrences[1]!.start.getHours()).toBe(9);
    const monthly: CalendarEvent = { id: "m", title: "Rent", start: new Date(2026, 0, 31, 8), end: new Date(2026, 0, 31, 9), recurrence: "FREQ=MONTHLY;UNTIL=20260601" };
    expect(expandEvents([monthly], new Date(2026, 0, 1), new Date(2026, 11, 31)).map((item) => toIsoDate(item.start))).toEqual(["2026-01-31", "2026-03-31", "2026-05-31"]);
    expect(describeRecurrence("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=10", "en-US")).toBe("Every 2 weeks on Mon and Wed, 10 times");
    expect(describeRecurrence("FREQ=DAILY")).toBe("Daily");
    expect(describeRecurrence("FREQ=SECONDLY")).toBe("Custom repeat");
  });

  it("lays out overlapping events in columns", () => {
    const day = new Date(2026, 9, 24);
    const at = (hour: number, minutes = 0) => new Date(2026, 9, 24, hour, minutes);
    const events: CalendarEvent[] = [
      { id: "a", title: "A", start: at(9), end: at(10) },
      { id: "b", title: "B", start: at(9, 30), end: at(11) },
      { id: "c", title: "C", start: at(10), end: at(10, 30) },
      { id: "d", title: "D", start: at(13), end: at(13, 5) },
    ];
    const layout = layoutDay(expandEvents(events, day, new Date(2026, 9, 25)), day);
    const byId = Object.fromEntries(layout.map((item) => [item.event.id, item]));
    expect([byId.a!.column, byId.b!.column, byId.c!.column]).toEqual([0, 1, 0]);
    expect(byId.a!.columns).toBe(2);
    expect(byId.d).toMatchObject({ columns: 1, top: 780, height: 15 });
  });

  it("ranks between neighbours", () => {
    expect([rankBetween(undefined, undefined), rankBetween(1, 2), rankBetween(undefined, 1), rankBetween(4, undefined)]).toEqual([1, 1.5, 0, 5]);
    const cards: KanbanCard[] = [
      { id: "a", columnId: "c", title: "A", rank: 1 },
      { id: "b", columnId: "c", title: "B", rank: 2 },
    ];
    expect([rankAt(cards, 0), rankAt(cards, 1), rankAt(cards, 2)]).toEqual([0, 1.5, 3]);
  });
});

describe("DatePicker", () => {
  it("opens a month grid, moves with the keyboard and selects a day", async () => {
    const onValueChange = vi.fn();
    render(<DatePicker label="Delivery date" defaultValue={new Date(2026, 9, 24)} onValueChange={onValueChange} locale="en-US" />);
    fireEvent.click(screen.getByRole("button", { name: /^Delivery date/ }));
    const grid = await screen.findByRole("grid", { name: "October 2026" });
    await vi.waitFor(() => expect(document.activeElement?.getAttribute("aria-label")).toBe("Saturday, October 24, 2026"));
    fireEvent.keyDown(grid, { key: "ArrowRight" });
    fireEvent.keyDown(grid, { key: "ArrowDown" });
    await vi.waitFor(() => expect(screen.getByRole("grid", { name: "November 2026" })).toBeTruthy());
    fireEvent.keyDown(screen.getByRole("grid"), { key: "Enter" });
    expect(toIsoDate(onValueChange.mock.lastCall![0])).toBe("2026-11-01");
  });

  it("disables days outside min and max", async () => {
    const onValueChange = vi.fn();
    render(<DatePicker label="Pickup" defaultValue={new Date(2026, 9, 10)} min={new Date(2026, 9, 5)} onValueChange={onValueChange} locale="en-US" />);
    fireEvent.click(screen.getByRole("button", { name: /^Pickup/ }));
    const day = await screen.findByRole("button", { name: "Saturday, October 3, 2026" });
    expect(day.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(day);
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe("DateRangePicker", () => {
  it("selects a range in two clicks, swapping reversed picks, and recognizes presets", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 24, 12));
    const onValueChange = vi.fn();
    render(<DateRangePicker label="Report period" onValueChange={onValueChange} locale="en-US" months={1} />);
    fireEvent.click(screen.getByRole("button", { name: /Report period/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Tuesday, October 20, 2026" }));
    expect(screen.getByText("Select the end date")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Thursday, October 8, 2026" }));
    const range = onValueChange.mock.lastCall![0];
    expect([toIsoDate(range.start), toIsoDate(range.end)]).toEqual(["2026-10-08", "2026-10-20"]);
    fireEvent.click(screen.getByRole("button", { name: /Report period/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Last 7 days" }));
    const preset = onValueChange.mock.lastCall![0];
    expect([toIsoDate(preset.start), toIsoDate(preset.end)]).toEqual(["2026-10-18", "2026-10-24"]);
    expect(screen.getByRole("button", { name: /Report period/ }).textContent).toContain("Last 7 days");
  });
});

describe("EventCalendar", () => {
  const events: CalendarEvent[] = [
    { id: "open", title: "Open store", start: new Date(2026, 9, 20, 7), end: new Date(2026, 9, 20, 8) },
    { id: "delivery", title: "Lumber delivery", start: new Date(2026, 9, 21, 10), end: new Date(2026, 9, 21, 11), location: "Dock 2" },
    { id: "sale", title: "Garden sale", start: new Date(2026, 9, 22), end: new Date(2026, 9, 25), allDay: true },
    { id: "standup", title: "Standup", start: new Date(2026, 9, 19, 8, 30), end: new Date(2026, 9, 19, 8, 45), recurrence: "FREQ=DAILY;COUNT=10" },
  ];

  it("shows the week with events and moves an event with Alt+arrows", () => {
    const onEventChange = vi.fn();
    render(<EventCalendar events={events} defaultDate={new Date(2026, 9, 21)} onEventChange={onEventChange} locale="en-US" />);
    expect(screen.getByRole("heading", { name: /Oct 18\s*–\s*24, 2026/ })).toBeTruthy();
    const delivery = screen.getByRole("button", { name: /^Lumber delivery, 10:00 AM to 11:00 AM, Dock 2/ });
    fireEvent.keyDown(delivery, { key: "ArrowDown", altKey: true });
    expect(onEventChange.mock.lastCall![1].start).toEqual(new Date(2026, 9, 21, 10, 30));
    fireEvent.keyDown(delivery, { key: "ArrowRight", altKey: true });
    expect(onEventChange.mock.lastCall![1].start).toEqual(new Date(2026, 9, 22, 10));
    fireEvent.keyDown(delivery, { key: "ArrowDown", altKey: true, shiftKey: true });
    expect(onEventChange.mock.lastCall![1]).toEqual({ start: new Date(2026, 9, 21, 10), end: new Date(2026, 9, 21, 11, 30) });
    const standups = screen.getAllByRole("button", { name: /^Standup, 8:30 AM to 8:45 AM, repeats/ });
    expect(standups.length).toBe(6);
    onEventChange.mockClear();
    fireEvent.keyDown(standups[0]!, { key: "ArrowDown", altKey: true });
    expect(onEventChange).not.toHaveBeenCalled();
    expect(screen.getAllByRole("button", { name: /^Garden sale, all day/ })).toHaveLength(3);
  });

  it("switches to month view with more links, opens a day, and navigates", () => {
    const busy = Array.from({ length: 5 }, (_, index): CalendarEvent => ({ id: `e${index}`, title: `Task ${index}`, start: new Date(2026, 9, 14, 9 + index), end: new Date(2026, 9, 14, 10 + index) }));
    render(<EventCalendar events={busy} defaultDate={new Date(2026, 9, 14)} defaultView="month" maxEventsPerDay={3} locale="en-US" />);
    expect(screen.getByRole("heading", { name: "October 2026" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "+2 more" }));
    expect(screen.getByRole("heading", { name: "Wednesday, October 14, 2026" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Task/ })).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Thursday, October 15, 2026" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Agenda" }));
    expect(screen.getByText("Nothing in the next 30 days.")).toBeTruthy();
  });

  it("creates an event from an empty slot and reports clicks", () => {
    const onCreate = vi.fn();
    const onEventClick = vi.fn();
    render(<EventCalendar events={events} defaultDate={new Date(2026, 9, 21)} defaultView="day" onCreate={onCreate} onEventClick={onEventClick} locale="en-US" />);
    const column = screen.getByRole("group", { name: "Wednesday, October 21" });
    column.getBoundingClientRect = () => ({ top: 0, left: 0, right: 100, bottom: 1152, width: 100, height: 1152, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.click(column, { clientY: 14 * 48 + 10 });
    expect(onCreate.mock.lastCall![0]).toEqual({ start: new Date(2026, 9, 21, 14), end: new Date(2026, 9, 21, 15), allDay: false });
    fireEvent.keyDown(screen.getByRole("button", { name: /^Lumber delivery/ }), { key: "Enter" });
    expect(onEventClick.mock.lastCall![0].event.id).toBe("delivery");
  });
});

describe("KanbanBoard", () => {
  const columns = [
    { id: "todo", title: "To do" },
    { id: "doing", title: "Doing", limit: 1 },
    { id: "done", title: "Done" },
  ];
  const cards: KanbanCard[] = [
    { id: "a", columnId: "todo", title: "Count drawers", rank: 1 },
    { id: "b", columnId: "todo", title: "Order mulch", rank: 2, due: new Date(2020, 0, 1) },
    { id: "c", columnId: "doing", title: "Price endcaps", rank: 1 },
    { id: "d", columnId: "doing", title: "Fix sign", rank: 2 },
  ];

  it("moves cards with Alt+arrows and the move menu, and warns over the limit", async () => {
    const onCardMove = vi.fn();
    render(<KanbanBoard columns={columns} cards={cards} onCardMove={onCardMove} />);
    expect(within(screen.getByRole("group", { name: "Doing" })).getByText("(over the limit)")).toBeTruthy();
    expect(screen.getByText("(overdue)")).toBeTruthy();
    const card = screen.getByRole("button", { name: /^Count drawers/ });
    fireEvent.keyDown(card, { key: "ArrowRight", altKey: true });
    expect(onCardMove).toHaveBeenLastCalledWith("a", "doing", 0);
    expect(screen.getByRole("status").textContent).toBe("Count drawers moved to Doing, position 1 of 3");
    fireEvent.keyDown(card, { key: "ArrowDown", altKey: true });
    expect(onCardMove).toHaveBeenLastCalledWith("a", "todo", 3);
    fireEvent.click(screen.getByRole("button", { name: "Move Order mulch" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Move to Done" }));
    expect(onCardMove).toHaveBeenLastCalledWith("b", "done", 1);
    expect(within(screen.getByRole("group", { name: "Done" })).getByText("Drop cards here")).toBeTruthy();
  });

  it("adds cards inline", () => {
    const onCardAdd = vi.fn();
    render(<KanbanBoard columns={columns} cards={cards} onCardMove={vi.fn()} onCardAdd={onCardAdd} />);
    fireEvent.click(screen.getByRole("button", { name: "Add card to Done" }));
    const input = screen.getByRole("textbox", { name: "New card in Done" });
    fireEvent.change(input, { target: { value: "Restock paint" } });
    fireEvent.submit(input);
    expect(onCardAdd).toHaveBeenCalledWith("done", "Restock paint");
    act(() => {
      fireEvent.keyDown(input, { key: "Escape" });
    });
    expect(screen.queryByRole("textbox", { name: "New card in Done" })).toBeNull();
  });
});

describe("Timeline", () => {
  it("groups entries by day with badges", () => {
    render(
      <Timeline
        groupByDay
        locale="en-US"
        items={[
          { id: "1", title: "Clocked in", time: new Date(2026, 9, 23, 7, 58), badges: ["manual"] },
          { id: "2", title: "Break", time: new Date(2026, 9, 23, 12), tone: "warning" },
          { id: "3", title: "Clocked in", time: new Date(2026, 9, 24, 8, 2) },
        ]}
      />,
    );
    expect(screen.getAllByRole("heading").map((heading) => heading.textContent)).toEqual(["Friday, October 23", "Saturday, October 24"]);
    expect(screen.getByText("manual")).toBeTruthy();
  });
});
