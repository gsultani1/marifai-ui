// packages/ai-ui/test/shared-controls.test.tsx
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DiffView } from "../src/index.js";
import { wallClockTime } from "../src/lib/dates.js";
import { FilteredList, LabeledTree, OrderedList } from "../src/lib/collection-controls.js";
import {
  AsyncForm,
  ChoiceField,
  ControlAction,
  ControlPanel,
  ItemHeading,
  ItemList,
  matchesQuery,
  optionalNumber,
  requiredNumber,
} from "../src/lib/component-controls.js";

describe("matchesQuery", () => {
  it("matches everything for an empty query, including items with no searchable text", () => {
    expect(matchesQuery("", "Claw hammer")).toBe(true);
    expect(matchesQuery("   ", undefined)).toBe(true);
    expect(matchesQuery("")).toBe(true);
  });

  it("matches case-insensitively against any provided value", () => {
    expect(matchesQuery("HAMMER", "Claw hammer", undefined)).toBe(true);
    expect(matchesQuery("saw", undefined, "Hand saw")).toBe(true);
    expect(matchesQuery("drill", "Claw hammer", undefined)).toBe(false);
  });
});

describe("optionalNumber and requiredNumber", () => {
  it("parses blank input as missing and enforces minimums and whole numbers", () => {
    expect(optionalNumber("  ", "Delay", 0)).toBeUndefined();
    expect(optionalNumber("2.5", "Delay", 0)).toBe(2.5);
    expect(() => optionalNumber("2.5", "Attempts", 1, true)).toThrow("Attempts must be a whole number of at least 1.");
    expect(() => optionalNumber("-1", "Delay", 0)).toThrow("Delay must be a number of at least 0.");
    expect(() => optionalNumber("ten", "Delay", 0)).toThrow("Delay must be a number of at least 0.");
    expect(() => requiredNumber("", "Attempts", 1, true)).toThrow("Attempts is required.");
    expect(requiredNumber("3", "Attempts", 1, true)).toBe(3);
  });
});

describe("ControlPanel, ItemList and ItemHeading", () => {
  it("labels the panel by its heading and shows the empty message when there are no items", () => {
    render(<ControlPanel slot="stock" title="Low stock"><ItemList items={[]} empty="Nothing is low." render={() => null} /></ControlPanel>);
    expect(screen.getByRole("region", { name: "Low stock" }).getAttribute("data-slot")).toBe("stock");
    expect(screen.getByText("Nothing is low.")).toBeTruthy();
  });

  it("renders one list item per entry with its title and detail", () => {
    render(<ItemList items={[{ id: "a", title: "Claw hammer" }, { id: "b", title: "Hand saw" }]} empty="None"
      render={(item) => <ItemHeading title={item.title} detail="Aisle 4" />} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText("Claw hammer")).toBeTruthy();
    expect(within(items[1]!).getAllByText("Aisle 4")).toHaveLength(1);
  });
});

describe("ControlAction", () => {
  it("renders nothing without a handler and names repeated actions after their item", () => {
    const { container } = render(<ControlAction label="Remove" item="Claw hammer" />);
    expect(container.innerHTML).toBe("");
    const onClick = vi.fn();
    render(<ControlAction label="Remove" item="Claw hammer" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Claw hammer" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire while disabled", () => {
    const onClick = vi.fn();
    render(<ControlAction label="Retry" onClick={onClick} disabled />);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("stays focusable when it becomes disabled so keyboard focus is not dropped", () => {
    const onClick = vi.fn();
    const { rerender } = render(<ControlAction label="Retry" item="Order 4410" onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Retry Order 4410" }) as HTMLButtonElement;
    button.focus();
    rerender(<ControlAction label="Retry" item="Order 4410" onClick={onClick} disabled />);
    expect(button.disabled).toBe(false);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.tabIndex).toBeGreaterThanOrEqual(0);
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("ChoiceField", () => {
  const options = [
    { value: "fixed", label: "Fixed" },
    { value: "exponential", label: "Exponential" },
    { value: "custom", label: "Custom", disabled: true },
  ] as const;

  it("reports enabled choices, ignores disabled ones and can clear back to the placeholder", () => {
    const onChange = vi.fn();
    render(<ChoiceField label="Delay policy" value="fixed" options={options} placeholder="Any" onChange={onChange} />);
    const select = screen.getByRole("combobox", { name: "Delay policy" });
    fireEvent.change(select, { target: { value: "exponential" } });
    expect(onChange).toHaveBeenLastCalledWith("exponential");
    fireEvent.change(select, { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith("");
    onChange.mockClear();
    fireEvent.change(select, { target: { value: "custom" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("never offers a required field's placeholder once a choice is made, and marks the select required", () => {
    const onChange = vi.fn();
    const { rerender } = render(<ChoiceField label="Format" value="" options={options} placeholder="Choose a format" required onChange={onChange} />);
    const select = screen.getByRole("combobox", { name: "Format" }) as HTMLSelectElement;
    expect(select.required).toBe(true);
    expect((screen.getByRole("option", { name: "Choose a format" }) as HTMLOptionElement).disabled).toBe(true);
    rerender(<ChoiceField label="Format" value="fixed" options={options} placeholder="Choose a format" required onChange={onChange} />);
    expect(screen.queryByRole("option", { name: "Choose a format" })).toBeNull();
    fireEvent.change(select, { target: { value: "" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("describes the select without adding the description to its name, and takes a fuller name per row", () => {
    render(<ChoiceField label="Decision" ariaLabel="Decision for Book the forklift inspection" description="Applies to this action only."
      value="fixed" options={options} onChange={vi.fn()} />);
    const select = screen.getByRole("combobox", { name: "Decision for Book the forklift inspection" });
    const description = document.getElementById(select.getAttribute("aria-describedby") ?? "");
    expect(description?.textContent).toBe("Applies to this action only.");
    expect(select.closest("label")?.textContent).not.toContain("Applies to this action only.");
  });

  it("shows a disabled prompt when the value matches no option and there is no placeholder", () => {
    render(<ChoiceField label="Branch" value="" options={options} onChange={vi.fn()} />);
    const prompt = screen.getByRole("option", { name: "Choose an option" }) as HTMLOptionElement;
    expect(prompt.disabled).toBe(true);
  });
});

describe("AsyncForm", () => {
  it("shows validation errors without submitting", () => {
    const onSubmit = vi.fn();
    render(<AsyncForm label="Retry policy" submitLabel="Save" validate={() => "Attempts is required."} onSubmit={onSubmit}><input aria-label="Attempts" /></AsyncForm>);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert").textContent).toBe("Attempts is required.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits once while busy, disables its fields and reports a thrown error", async () => {
    let finish: () => void = () => undefined;
    const onSubmit = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }))
      .mockRejectedValueOnce(new Error("The scheduler is offline."));
    render(<AsyncForm label="Retry policy" submitLabel="Save" onSubmit={onSubmit}><input aria-label="Attempts" /></AsyncForm>);
    const form = screen.getByRole("form", { name: "Retry policy" });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("textbox", { name: "Attempts" }) as HTMLInputElement).closest("fieldset")?.disabled).toBe(true);
    await act(async () => finish());
    expect((screen.getByRole("textbox", { name: "Attempts" }) as HTMLInputElement).closest("fieldset")?.disabled).toBe(false);

    await act(async () => { fireEvent.submit(form); });
    expect(screen.getByRole("alert").textContent).toBe("The scheduler is offline.");
  });

  it("locks widgets that a disabled fieldset cannot, such as clickable rows, while it is busy", async () => {
    let finish: () => void = () => undefined;
    const onRow = vi.fn();
    render(<AsyncForm label="Restore tabs" submitLabel="Restore" onSubmit={() => new Promise<void>((resolve) => { finish = resolve; })}>
      <div role="treeitem" aria-selected={false} tabIndex={0} onClick={onRow} onKeyDown={onRow}>Window 1</div>
    </AsyncForm>);
    const row = screen.getByRole("treeitem", { name: "Window 1" });
    fireEvent.click(row);
    expect(onRow).toHaveBeenCalledTimes(1);
    fireEvent.submit(screen.getByRole("form", { name: "Restore tabs" }));
    expect(screen.getByRole("form", { name: "Restore tabs" }).getAttribute("aria-busy")).toBe("true");
    fireEvent.click(row);
    fireEvent.keyDown(row, { key: "Enter" });
    fireEvent.keyDown(row, { key: "Tab" });
    expect(onRow).toHaveBeenCalledTimes(2);
    await act(async () => finish());
    fireEvent.click(row);
    expect(onRow).toHaveBeenCalledTimes(3);
  });

  it("shows a short submit label while naming the item for assistive technology", () => {
    render(<AsyncForm label="Review restock" submitLabel="Submit decision" submitAriaLabel="Submit decision for Ask for a freight quote" onSubmit={vi.fn()}>{null}</AsyncForm>);
    const submit = screen.getByRole("button", { name: "Submit decision for Ask for a freight quote" });
    expect(submit.textContent).toBe("Submit decision");
  });

  it("keeps its submit button focusable when the form becomes disabled after a submit", () => {
    const { rerender } = render(<AsyncForm label="Feedback" submitLabel="Send feedback" onSubmit={vi.fn()}>{null}</AsyncForm>);
    const submit = screen.getByRole("button", { name: "Send feedback" }) as HTMLButtonElement;
    rerender(<AsyncForm label="Feedback" submitLabel="Send feedback" onSubmit={vi.fn()} disabled>{null}</AsyncForm>);
    expect(submit.disabled).toBe(false);
    expect(submit.getAttribute("aria-disabled")).toBe("true");
  });

  it("falls back to a generic message when the error has none and does nothing while disabled", async () => {
    const onSubmit = vi.fn().mockRejectedValue("nope");
    const { rerender } = render(<AsyncForm label="Policy" submitLabel="Save" onSubmit={onSubmit}>{null}</AsyncForm>);
    await act(async () => { fireEvent.submit(screen.getByRole("form", { name: "Policy" })); });
    expect(screen.getByRole("alert").textContent).toBe("The action failed. Try again.");
    onSubmit.mockClear();
    rerender(<AsyncForm label="Policy" submitLabel="Save" onSubmit={onSubmit} disabled>{null}</AsyncForm>);
    await act(async () => { fireEvent.submit(screen.getByRole("form", { name: "Policy" })); });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("FilteredList", () => {
  const items = [
    { id: "a", name: "Claw hammer", kind: "tools", note: undefined },
    { id: "b", name: "Deck stain", kind: "paint", note: "Cedar" },
    { id: "c", name: undefined, kind: "tools", note: undefined },
  ];

  it("shows every item, including one with no searchable text, until the user searches or filters", () => {
    render(<FilteredList items={items} searchLabel="Search stock" searchText={(item) => [item.name, item.note]}
      filterLabel="Department" filters={[{ value: "tools", label: "Tools" }, { value: "paint", label: "Paint" }]}
      category={(item) => item.kind} empty="No matches." render={(item) => <span>{item.name ?? "Unnamed item"}</span>} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search stock" }), { target: { value: "cedar" } });
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Deck stain"]);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search stock" }), { target: { value: "" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Department" }), { target: { value: "tools" } });
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Claw hammer", "Unnamed item"]);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search stock" }), { target: { value: "stain" } });
    expect(screen.getByText("No matches.")).toBeTruthy();
  });
});

describe("FilteredList messages and announcements", () => {
  const stock = [{ id: "a", name: "Claw hammer" }, { id: "b", name: "Hand saw" }, { id: "c", name: "Tape measure" }];
  const list = (items: typeof stock) => <FilteredList items={items} searchLabel="Search stock" searchText={(item) => [item.name]}
    empty="Nothing in stock." noMatches="No tools match." render={(item) => <span>{item.name}</span>} />;

  it("tells an empty list apart from a search with no matches", () => {
    const { unmount } = render(list([]));
    expect(screen.getByText("Nothing in stock.")).toBeTruthy();
    unmount();
    render(list(stock));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search stock" }), { target: { value: "drill" } });
    expect(screen.getByText("No tools match.")).toBeTruthy();
    expect(screen.queryByText("Nothing in stock.")).toBeNull();
  });

  it("announces how many items the search shows, and stays quiet without one", () => {
    render(list(stock));
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("");
    fireEvent.change(screen.getByRole("searchbox", { name: "Search stock" }), { target: { value: "ha" } });
    expect(status.textContent).toBe("Showing 2 of 3");
    fireEvent.change(screen.getByRole("searchbox", { name: "Search stock" }), { target: { value: "drill" } });
    expect(status.textContent).toBe("Showing 0 of 3");
  });
});

describe("OrderedList", () => {
  it("shows an empty message and otherwise reports the new order as ids", () => {
    const onReorder = vi.fn();
    const { rerender } = render(<OrderedList items={[]} label="Fallback order" itemLabel={() => ""} onReorder={onReorder} />);
    expect(screen.getByText("No items to order.")).toBeTruthy();
    rerender(<OrderedList items={[{ id: "a", name: "Primary" }, { id: "b", name: "Backup" }]} label="Fallback order"
      itemLabel={(item) => item.name} onReorder={onReorder} />);
    expect(screen.getByText("Primary")).toBeTruthy();
    expect(screen.getByText("Backup")).toBeTruthy();
    expect(screen.getByRole("list", { name: "Fallback order" }).tagName).toBe("OL");
  });

  it("shows its own empty message", () => {
    render(<OrderedList items={[]} label="Fallback order" itemLabel={() => ""} onReorder={vi.fn()} empty="No fallback models." />);
    expect(screen.getByText("No fallback models.")).toBeTruthy();
  });
});

describe("LabeledTree", () => {
  const scopes = [
    { id: "local", label: "Local", children: [{ id: "qty", label: "quantity", children: [] }, { id: "sku", label: "sku", children: [] }] },
    { id: "global", label: "Global", children: [] },
  ];

  it("filters to matching nodes, keeps their parents expanded and reports selection", () => {
    const onSelect = vi.fn();
    render(<LabeledTree items={scopes} label="Variable scopes" searchable onSelect={onSelect} detail={(item) => (item.id === "qty" ? "number" : undefined)} />);
    expect(screen.getByRole("tree", { name: "Variable scopes" })).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search variable scopes" }), { target: { value: "quant" } });
    expect(screen.getByText("quantity")).toBeTruthy();
    expect(screen.getByText("number")).toBeTruthy();
    expect(screen.queryByText("sku")).toBeNull();
    expect(screen.queryByText("Global")).toBeNull();
    fireEvent.click(screen.getByText("quantity"));
    expect(onSelect).toHaveBeenCalledWith("qty");
  });

  it("starts with the active node's ancestors expanded and reveals a new active node in a collapsed branch", () => {
    const tree = [
      { id: "main", label: "Main conversation", children: [
        { id: "fork-a", label: "Price check", children: [{ id: "fork-a1", label: "Supplier follow-up", children: [] }] },
      ] },
      { id: "other", label: "Returns thread", children: [{ id: "fork-b", label: "Refund wording", children: [] }] },
    ];
    const { rerender } = render(<LabeledTree items={tree} label="Forks" activeId="fork-a1" onSelect={vi.fn()} />);
    expect(screen.getByText("Supplier follow-up")).toBeTruthy();
    expect(screen.queryByText("Refund wording")).toBeNull();
    rerender(<LabeledTree items={tree} label="Forks" activeId="fork-b" onSelect={vi.fn()} />);
    expect(screen.getByText("Refund wording")).toBeTruthy();
    expect(screen.getByText("Supplier follow-up")).toBeTruthy();
  });

  it("reports the already active node again when it is clicked, but not twice for a new node", () => {
    const onSelect = vi.fn();
    render(<LabeledTree items={scopes} label="Variable scopes" activeId="global" onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Global"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenLastCalledWith("global");
    fireEvent.click(screen.getByText("Local"));
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenLastCalledWith("local");
  });

  it("reports the already active node again when it is activated with Enter", () => {
    const onSelect = vi.fn();
    render(<LabeledTree items={scopes} label="Variable scopes" activeId="global" onSelect={onSelect} />);
    const active = screen.getByRole("treeitem", { name: /Global/ });
    fireEvent.keyDown(active, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("global");
  });
});

describe("wallClockTime", () => {
  it("orders local date-times by wall clock, with or without seconds, and rejects invalid ones", () => {
    expect(wallClockTime("2026-03-08T08:00")).toBe(wallClockTime("2026-03-08T08:00:00"));
    expect(wallClockTime("2026-03-08T02:30")).toBeLessThan(wallClockTime("2026-03-08T03:00"));
    expect(wallClockTime("2026-03-08T02:30:15.5")).toBe(wallClockTime("2026-03-08T02:30") + 15_500);
    expect(wallClockTime("2026-02-30T10:00")).toBeNaN();
    expect(wallClockTime("2026-03-08T24:00")).toBeNaN();
    expect(wallClockTime("2026-03-08 10:00")).toBeNaN();
  });
});

describe("DiffView", () => {
  it("takes its own region name and counts single lines in the singular", () => {
    const { container } = render(<DiffView oldValue={"a\n"} newValue={"b\n"} label="Changes to quantity" oldTitle="Monday" newTitle="Tuesday" />);
    expect(screen.getByRole("region", { name: "Changes to quantity" })).toBeTruthy();
    expect(container.querySelector("caption")?.textContent).toBe("Changes from Monday to Tuesday: 1 line added, 1 line removed");
  });

  it("names the side-by-side columns after the two versions", () => {
    render(<DiffView oldValue={"a\nb\n"} newValue={"a\nc\n"} mode="split" oldTitle="Monday" newTitle="Tuesday" />);
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Line in Monday", "Monday", "Line in Tuesday", "Tuesday"]);
  });
});
