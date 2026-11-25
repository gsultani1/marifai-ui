// packages/ai-ui/test/dev-tools.test.tsx
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  BreakpointList,
  CodeReferenceList,
  CodeReviewFileNavigator,
  DebugCallStack,
  DebugVariableTree,
  DebugWatchExpressions,
  EditorDiagnosticsSummary,
  EditorFindReplace,
  EditorGoToLine,
  EditorLocationHistory,
  EditorSymbolOutline,
  GitBlamePanel,
  GitBranchPicker,
  GitCommitForm,
  GitCommitHistory,
  MergeConflictResolver,
  TestExplorer,
  type EditorSearchOptions,
} from "../src/index.js";
import { isDisabled } from "./helpers.js";

const button = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;

describe("BreakpointList", () => {
  const breakpoints = [
    { id: "b1", file: "src/cart.ts", line: 18, column: 4, enabled: true },
    { id: "b2", file: "src/tax.ts", line: 7, enabled: false, condition: "rate > 0.1" },
  ];

  it("lists each breakpoint with its location, status and condition in text", () => {
    render(<BreakpointList breakpoints={breakpoints} />);
    const items = screen.getAllByRole("listitem");
    expect(within(items[0]!).getByText("src/cart.ts:18:4")).toBeTruthy();
    expect(within(items[0]!).getByText("Enabled")).toBeTruthy();
    expect(within(items[1]!).getByText("Disabled · Condition: rate > 0.1")).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("toggles, edits and removes a breakpoint by id with controls named after its location", () => {
    const onEnabledChange = vi.fn();
    const onEdit = vi.fn();
    const onRemove = vi.fn();
    render(<BreakpointList breakpoints={breakpoints} onEnabledChange={onEnabledChange} onEdit={onEdit} onRemove={onRemove} />);
    const toggle = screen.getByRole("checkbox", { name: "Enabled src/cart.ts:18:4" }) as HTMLInputElement;
    expect(toggle.checked).toBe(true);
    fireEvent.click(toggle);
    expect(onEnabledChange).toHaveBeenCalledWith("b1", false);
    fireEvent.click(screen.getByRole("checkbox", { name: "Enabled src/tax.ts:7" }));
    expect(onEnabledChange).toHaveBeenLastCalledWith("b2", true);
    fireEvent.click(button("Edit src/tax.ts:7"));
    expect(onEdit).toHaveBeenCalledWith("b2");
    fireEvent.click(button("Remove src/cart.ts:18:4"));
    expect(onRemove).toHaveBeenCalledWith("b1");
  });

  it("blocks every control of a pending breakpoint and says it is updating", () => {
    const onEnabledChange = vi.fn();
    const onRemove = vi.fn();
    render(<BreakpointList breakpoints={breakpoints} pendingIds={["b1"]} onEnabledChange={onEnabledChange} onEdit={vi.fn()} onRemove={onRemove} />);
    expect((screen.getByRole("checkbox", { name: "Enabled src/cart.ts:18:4" }) as HTMLInputElement).disabled).toBe(true);
    expect(isDisabled(button("Edit src/cart.ts:18:4"))).toBe(true);
    fireEvent.click(button("Remove src/cart.ts:18:4"));
    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.getByText("Enabled · Updating…")).toBeTruthy();
    expect(button("Remove src/tax.ts:7").disabled).toBe(false);
  });

  it("shows an empty message without breakpoints", () => {
    render(<BreakpointList breakpoints={[]} onRemove={vi.fn()} />);
    expect(screen.getByRole("region", { name: "Breakpoints" })).toBeTruthy();
    expect(screen.getByText("No breakpoints.")).toBeTruthy();
  });
});

describe("CodeReferenceList", () => {
  it("groups references by file with a counted summary and opens the chosen range", () => {
    const onOpen = vi.fn();
    const end = { file: "src/cart.ts", line: 20 };
    render(<CodeReferenceList onOpen={onOpen} references={[
      { id: "r1", start: { file: "src/cart.ts", line: 18, column: 9 }, end, excerpt: "const total = subtotal(items);" },
      { id: "r2", start: { file: "src/cart.ts", line: 42 } },
      { id: "r3", start: { file: "src/report.ts", line: 3 }, excerpt: "import { subtotal } from \"./cart.js\";" },
    ]} />);
    expect(screen.getByText("src/cart.ts · 2 references")).toBeTruthy();
    expect(screen.getByText("src/report.ts · 1 reference")).toBeTruthy();
    expect(screen.getByText("Line 18:9")).toBeTruthy();
    expect(screen.getByText("const total = subtotal(items);")).toBeTruthy();
    fireEvent.click(button("Open reference src/cart.ts:18:9"));
    expect(onOpen).toHaveBeenCalledWith({ file: "src/cart.ts", line: 18, column: 9 }, end);
    fireEvent.click(button("Open reference src/report.ts:3"));
    expect(onOpen).toHaveBeenLastCalledWith({ file: "src/report.ts", line: 3 }, undefined);
  });

  it("shows an empty message without references", () => {
    render(<CodeReferenceList references={[]} onOpen={vi.fn()} />);
    expect(screen.getByText("No references.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("CodeReviewFileNavigator", () => {
  const files = [
    { id: "f1", path: "src/cart.ts", reviewed: false },
    { id: "f2", path: "src/tax.ts", reviewed: true },
    { id: "f3", path: "src/report.ts", reviewed: false },
  ];

  it("opens the next unreviewed file after the current one and wraps around", () => {
    const onOpen = vi.fn();
    const { rerender } = render(<CodeReviewFileNavigator files={files} activeId="f1" onOpen={onOpen} />);
    expect(screen.getByText("Unreviewed · Current")).toBeTruthy();
    fireEvent.click(button("Next unreviewed file"));
    expect(onOpen).toHaveBeenLastCalledWith("f3");
    rerender(<CodeReviewFileNavigator files={files} activeId="f3" onOpen={onOpen} />);
    fireEvent.click(button("Next unreviewed file"));
    expect(onOpen).toHaveBeenLastCalledWith("f1");
    rerender(<CodeReviewFileNavigator files={files} activeId={null} onOpen={onOpen} />);
    fireEvent.click(button("Next unreviewed file"));
    expect(onOpen).toHaveBeenLastCalledWith("f1");
    fireEvent.click(button("Open file src/tax.ts"));
    expect(onOpen).toHaveBeenLastCalledWith("f2");
  });

  it("filters to unreviewed files and disables the next action once everything is reviewed", () => {
    render(<CodeReviewFileNavigator files={files} activeId="f1" onOpen={vi.fn()} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Unreviewed only" }));
    expect(screen.queryByText("src/tax.ts")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);

    const reviewed = files.map((file) => ({ ...file, reviewed: true }));
    const onOpen = vi.fn();
    render(<CodeReviewFileNavigator files={reviewed} activeId="f2" onOpen={onOpen} className="second" />);
    const second = within(document.querySelector(".second") as HTMLElement);
    fireEvent.click(second.getByRole("checkbox", { name: "Unreviewed only" }));
    expect(second.getByText("All files are reviewed.")).toBeTruthy();
    fireEvent.click(second.getByRole("button", { name: "Next unreviewed file" }));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("shows an empty message without files", () => {
    render(<CodeReviewFileNavigator files={[]} activeId={null} onOpen={vi.fn()} />);
    expect(screen.getByText("No files to review.")).toBeTruthy();
    expect(isDisabled(button("Next unreviewed file"))).toBe(true);
  });
});

describe("DebugCallStack", () => {
  const threads = [
    { id: "main", label: "Main thread", frames: [
      { id: "fr1", label: "applyDiscount", source: { file: "src/cart.ts", line: 31, column: 5 } },
      { id: "fr2", label: "checkout", source: { file: "src/checkout.ts", line: 12 } },
      { id: "fr3", label: "node:internal/process" },
    ] },
    { id: "worker", label: "Price worker", frames: [] },
  ];

  it("switches threads, selects frames and opens their source", () => {
    const onThreadChange = vi.fn();
    const onFrameChange = vi.fn();
    const onOpenSource = vi.fn();
    render(<DebugCallStack threads={threads} threadId="main" frameId="fr1" onThreadChange={onThreadChange} onFrameChange={onFrameChange} onOpenSource={onOpenSource} />);
    expect(screen.getByText("src/cart.ts:31:5 · Selected frame")).toBeTruthy();
    expect(isDisabled(button("Select frame applyDiscount"))).toBe(true);
    fireEvent.click(button("Select frame checkout"));
    expect(onFrameChange).toHaveBeenCalledWith("main", "fr2");
    fireEvent.click(button("Open source checkout"));
    expect(onOpenSource).toHaveBeenCalledWith({ file: "src/checkout.ts", line: 12 });
    expect(screen.queryByRole("button", { name: "Open source node:internal/process" })).toBeNull();
    fireEvent.change(screen.getByRole("combobox", { name: "Thread" }), { target: { value: "worker" } });
    expect(onThreadChange).toHaveBeenCalledWith("worker");
  });

  it("explains empty stacks for a thread without frames, no selected thread and no threads", () => {
    const { rerender } = render(<DebugCallStack threads={threads} threadId="worker" onThreadChange={vi.fn()} onFrameChange={vi.fn()} />);
    expect(screen.getByText("No stack frames.")).toBeTruthy();
    rerender(<DebugCallStack threads={threads} threadId="gone" onThreadChange={vi.fn()} onFrameChange={vi.fn()} />);
    expect(screen.getByText("Select a thread to see its stack frames.")).toBeTruthy();
    expect((screen.getByRole("combobox", { name: "Thread" }) as HTMLSelectElement).value).toBe("");
    rerender(<DebugCallStack threads={[]} threadId={null} onThreadChange={vi.fn()} onFrameChange={vi.fn()} />);
    expect(screen.getByText("No threads.")).toBeTruthy();
  });
});

describe("DebugVariableTree", () => {
  it("shows scopes with each variable's type and value and expands nested variables", () => {
    render(<DebugVariableTree scopes={[
      { id: "locals", label: "Locals", children: [
        { id: "total", label: "total", type: "number", value: "42.5" },
        { id: "item", label: "item", type: "CartItem", children: [{ id: "sku", label: "sku", type: "string", value: "\"HAM-16\"" }] },
      ] },
      { id: "globals", label: "Globals" },
    ]} />);
    expect(screen.getByRole("tree", { name: "Variable scopes" })).toBeTruthy();
    const locals = screen.getByRole("treeitem", { name: "Locals" });
    expect(locals.getAttribute("aria-expanded")).toBe("false");
    fireEvent.keyDown(locals, { key: "ArrowRight" });
    expect(screen.getByRole("treeitem", { name: "total number · 42.5" })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("treeitem", { name: "item CartItem" }), { key: "ArrowRight" });
    expect(screen.getByRole("treeitem", { name: "sku string · \"HAM-16\"" })).toBeTruthy();
  });

  it("shows an empty message without scopes", () => {
    render(<DebugVariableTree scopes={[]} />);
    expect(screen.getByText("No variables in scope.")).toBeTruthy();
    expect(screen.queryByRole("tree")).toBeNull();
  });
});

describe("DebugWatchExpressions", () => {
  const expressions = [
    { id: "w1", expression: "cart.total", value: "42.5" },
    { id: "w2", expression: "discount.rate", error: "discount is not defined" },
    { id: "w3", expression: "items.length" },
  ];

  it("shows values, marks errors in text and refreshes or removes expressions by id", () => {
    const onRefresh = vi.fn();
    const onRemove = vi.fn();
    render(<DebugWatchExpressions expressions={expressions} onSave={vi.fn()} onRefresh={onRefresh} onRemove={onRemove} />);
    expect(screen.getByText("42.5")).toBeTruthy();
    expect(screen.getByText("Error: discount is not defined")).toBeTruthy();
    expect(screen.getByText("Not evaluated")).toBeTruthy();
    fireEvent.click(button("Refresh cart.total"));
    expect(onRefresh).toHaveBeenCalledWith("w1");
    fireEvent.click(button("Remove items.length"));
    expect(onRemove).toHaveBeenCalledWith("w3");
  });

  it("adds a trimmed expression and clears the draft after saving", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<DebugWatchExpressions expressions={expressions} onSave={onSave} />);
    expect(isDisabled(button("Add expression"))).toBe(true);
    const input = screen.getByRole("textbox", { name: "Expression" }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "  cart.items[0].sku  " } });
    await act(async () => {
      fireEvent.click(button("Add expression"));
    });
    expect(onSave).toHaveBeenCalledWith("cart.items[0].sku", undefined);
    expect(input.value).toBe("");
  });

  it("edits an existing expression by id, and cancelling restores the add form", async () => {
    const onSave = vi.fn();
    render(<DebugWatchExpressions expressions={expressions} onSave={onSave} />);
    fireEvent.click(button("Edit cart.total"));
    const input = screen.getByRole("textbox", { name: "Expression" }) as HTMLInputElement;
    expect(input.value).toBe("cart.total");
    fireEvent.change(input, { target: { value: "cart.total * 1.08" } });
    await act(async () => {
      fireEvent.click(button("Save expression"));
    });
    expect(onSave).toHaveBeenCalledWith("cart.total * 1.08", "w1");
    expect(button("Add expression")).toBeTruthy();

    fireEvent.click(button("Edit items.length"));
    fireEvent.click(button("Cancel editing"));
    expect(input.value).toBe("");
    expect(screen.queryByRole("button", { name: "Cancel editing" })).toBeNull();
  });

  it("falls back to adding when the expression being edited is removed", async () => {
    const onSave = vi.fn();
    const { rerender } = render(<DebugWatchExpressions expressions={expressions} onSave={onSave} />);
    fireEvent.click(button("Edit items.length"));
    rerender(<DebugWatchExpressions expressions={expressions.slice(0, 2)} onSave={onSave} />);
    expect(screen.queryByRole("button", { name: "Cancel editing" })).toBeNull();
    await act(async () => {
      fireEvent.click(button("Add expression"));
    });
    expect(onSave).toHaveBeenCalledWith("items.length", undefined);
  });

  it("shows a failed save as an alert and keeps the draft", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("The debugger is not paused."));
    render(<DebugWatchExpressions expressions={[]} onSave={onSave} />);
    expect(screen.getByText("No watch expressions.")).toBeTruthy();
    const input = screen.getByRole("textbox", { name: "Expression" }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "order.id" } });
    await act(async () => {
      fireEvent.click(button("Add expression"));
    });
    expect(screen.getByRole("alert").textContent).toBe("The debugger is not paused.");
    expect(input.value).toBe("order.id");
  });

  it("blocks row actions while an expression is pending", () => {
    const onRefresh = vi.fn();
    render(<DebugWatchExpressions expressions={expressions} onSave={vi.fn()} onRefresh={onRefresh} pendingIds={["w1"]} />);
    expect(screen.getByText("42.5 · Updating…")).toBeTruthy();
    expect(isDisabled(button("Edit cart.total"))).toBe(true);
    fireEvent.click(button("Refresh cart.total"));
    expect(onRefresh).not.toHaveBeenCalled();
  });
});

describe("EditorDiagnosticsSummary", () => {
  const counts = [
    { file: "src/cart.ts", severity: "error" as const, count: 2 },
    { file: "src/cart.ts", severity: "warning" as const, count: 1 },
    { file: "src/tax.ts", severity: "error" as const, count: 1 },
    { file: "src/tax.ts", severity: "info" as const, count: 3 },
    { file: "src/report.ts", severity: "warning" as const, count: 0 },
  ];

  it("totals each severity in words and opens totals or one file's diagnostics", () => {
    const onOpen = vi.fn();
    render(<EditorDiagnosticsSummary counts={counts} onOpen={onOpen} />);
    fireEvent.click(button("3 errors in all files"));
    expect(onOpen).toHaveBeenCalledWith(null, "error");
    fireEvent.click(button("1 warning in all files"));
    expect(onOpen).toHaveBeenLastCalledWith(null, "warning");
    fireEvent.click(button("2 errors in src/cart.ts"));
    expect(onOpen).toHaveBeenLastCalledWith("src/cart.ts", "error");
    fireEvent.click(button("3 info messages in src/tax.ts"));
    expect(onOpen).toHaveBeenLastCalledWith("src/tax.ts", "info");
    expect(screen.queryByRole("button", { name: /warning in src\/tax.ts/ })).toBeNull();
  });

  it("leaves out files whose counts are all zero", () => {
    render(<EditorDiagnosticsSummary counts={counts} onOpen={vi.fn()} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByText("src/report.ts")).toBeNull();
  });

  it("disables zero totals and shows an empty message without diagnostics", () => {
    const onOpen = vi.fn();
    render(<EditorDiagnosticsSummary counts={[]} onOpen={onOpen} />);
    expect(screen.getByText("No diagnostics.")).toBeTruthy();
    fireEvent.click(button("0 errors in all files"));
    expect(onOpen).not.toHaveBeenCalled();
    expect(isDisabled(button("0 info messages in all files"))).toBe(true);
  });
});

describe("EditorFindReplace", () => {
  const value: EditorSearchOptions = { query: "subtotal", replacement: "netTotal", matchCase: false, wholeWord: false };

  it("reports changes to every field merged into the current options", () => {
    const onChange = vi.fn();
    render(<EditorFindReplace value={value} onChange={onChange} matches={3} onMove={vi.fn()} onReplace={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Find" }), { target: { value: "total" } });
    expect(onChange).toHaveBeenLastCalledWith({ ...value, query: "total" });
    fireEvent.change(screen.getByRole("textbox", { name: "Replace with" }), { target: { value: "grandTotal" } });
    expect(onChange).toHaveBeenLastCalledWith({ ...value, replacement: "grandTotal" });
    fireEvent.click(screen.getByRole("checkbox", { name: "Match case" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...value, matchCase: true });
    fireEvent.click(screen.getByRole("checkbox", { name: "Whole word" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...value, wholeWord: true });
  });

  it("moves between matches and replaces one or all with the current options", () => {
    const onMove = vi.fn();
    const onReplace = vi.fn();
    render(<EditorFindReplace value={value} onChange={vi.fn()} matches={3} onMove={onMove} onReplace={onReplace} />);
    expect(screen.getByRole("status").textContent).toBe("3 matches");
    fireEvent.click(button("Previous match"));
    fireEvent.click(button("Next match"));
    expect(onMove.mock.calls).toEqual([["previous"], ["next"]]);
    fireEvent.click(button("Replace next"));
    fireEvent.click(button("Replace all"));
    expect(onReplace.mock.calls).toEqual([["one", value], ["all", value]]);
  });

  it("announces the match count in words and blocks actions while searching, empty or without matches", () => {
    const onMove = vi.fn();
    const props = { onChange: vi.fn(), onMove, onReplace: vi.fn() };
    const { rerender } = render(<EditorFindReplace value={value} matches={1} {...props} />);
    expect(screen.getByRole("status").textContent).toBe("1 match");
    rerender(<EditorFindReplace value={value} matches={1} pending {...props} />);
    expect(screen.getByRole("status").textContent).toBe("Searching…");
    fireEvent.click(button("Next match"));
    rerender(<EditorFindReplace value={value} matches={0} {...props} />);
    expect(screen.getByRole("status").textContent).toBe("0 matches");
    expect(isDisabled(button("Replace all"))).toBe(true);
    rerender(<EditorFindReplace value={{ ...value, query: "" }} matches={0} {...props} />);
    expect(screen.getByRole("status").textContent).toBe("Enter text to find.");
    fireEvent.click(button("Previous match"));
    expect(onMove).not.toHaveBeenCalled();
  });

  it("hides replacement controls without onReplace", () => {
    render(<EditorFindReplace value={value} onChange={vi.fn()} matches={2} onMove={vi.fn()} />);
    expect(screen.queryByRole("textbox", { name: "Replace with" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Replace all" })).toBeNull();
  });
});

describe("EditorGoToLine", () => {
  it("goes to a line or a line and column", () => {
    const onGoTo = vi.fn();
    render(<EditorGoToLine lineCount={120} onGoTo={onGoTo} />);
    const input = screen.getByRole("textbox", { name: "Line or line:column" });
    expect(button("Go to line").disabled).toBe(true);
    fireEvent.change(input, { target: { value: " 42 " } });
    fireEvent.click(button("Go to line"));
    expect(onGoTo).toHaveBeenLastCalledWith(42, undefined);
    fireEvent.change(input, { target: { value: "42:8" } });
    fireEvent.submit(screen.getByRole("form", { name: "Go to source line" }));
    expect(onGoTo).toHaveBeenLastCalledWith(42, 8);
  });

  it("rejects lines out of range, malformed positions and zero columns with an alert tied to the input", () => {
    const onGoTo = vi.fn();
    render(<EditorGoToLine lineCount={120} onGoTo={onGoTo} />);
    const input = screen.getByRole("textbox", { name: "Line or line:column" });
    for (const position of ["121", "0", "ten", "4:"]) {
      fireEvent.change(input, { target: { value: position } });
      fireEvent.click(button("Go to line"));
      expect(screen.getByRole("alert").textContent).toBe("Enter a line from 1 to 120. Use line:column to include a column.");
    }
    fireEvent.change(input, { target: { value: "12:0" } });
    fireEvent.click(button("Go to line"));
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("Enter a positive column number.");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(alert.id);
    expect(onGoTo).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "12" } });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("cannot submit for an empty document", () => {
    render(<EditorGoToLine lineCount={0} onGoTo={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Line or line:column" }), { target: { value: "1" } });
    expect(button("Go to line").disabled).toBe(true);
  });
});

describe("EditorLocationHistory", () => {
  const entries = [
    { id: "l1", file: "src/cart.ts", line: 12 },
    { id: "l2", file: "src/cart.ts", line: 48, column: 3, title: "applyDiscount" },
    { id: "l3", file: "src/tax.ts", line: 7 },
  ];

  it("moves back and forward from the current location", () => {
    const onOpen = vi.fn();
    render(<EditorLocationHistory entries={entries} activeId="l2" onOpen={onOpen} />);
    expect(screen.getByText("src/cart.ts:48:3 · Current")).toBeTruthy();
    fireEvent.click(button("Previous location"));
    expect(onOpen).toHaveBeenLastCalledWith(entries[0]);
    fireEvent.click(button("Next location"));
    expect(onOpen).toHaveBeenLastCalledWith(entries[2]);
  });

  it("names each open action after its location so entries in one file stay distinct", () => {
    const onOpen = vi.fn();
    render(<EditorLocationHistory entries={entries} activeId="l1" onOpen={onOpen} />);
    fireEvent.click(button("Open location applyDiscount src/cart.ts:48:3"));
    expect(onOpen).toHaveBeenLastCalledWith(entries[1]);
    fireEvent.click(button("Open location src/cart.ts:12"));
    expect(onOpen).toHaveBeenLastCalledWith(entries[0]);
    expect(isDisabled(button("Previous location"))).toBe(true);
  });

  it("disables both directions without a current entry and shows an empty message without entries", () => {
    const { rerender } = render(<EditorLocationHistory entries={entries} activeId={null} onOpen={vi.fn()} />);
    expect(isDisabled(button("Previous location"))).toBe(true);
    expect(isDisabled(button("Next location"))).toBe(true);
    rerender(<EditorLocationHistory entries={[]} activeId={null} onOpen={vi.fn()} />);
    expect(screen.getByText("No recorded locations.")).toBeTruthy();
  });
});

describe("EditorSymbolOutline", () => {
  const symbols = [
    { id: "cart", label: "Cart", kind: "class", start: { file: "src/cart.ts", line: 4 }, end: { file: "src/cart.ts", line: 60 }, children: [
      { id: "add", label: "addItem", kind: "method", start: { file: "src/cart.ts", line: 12, column: 3 } },
      { id: "total", label: "total", kind: "getter", start: { file: "src/cart.ts", line: 40, column: 3 } },
    ] },
    { id: "rate", label: "TAX_RATE", kind: "constant", start: { file: "src/cart.ts", line: 62 } },
  ];

  it("opens the chosen symbol's range and marks the active one", () => {
    const onOpen = vi.fn();
    render(<EditorSymbolOutline symbols={symbols} activeId="rate" onOpen={onOpen} />);
    expect(screen.getByRole("treeitem", { name: "TAX_RATE constant" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("treeitem", { name: "Cart class" }));
    expect(onOpen).toHaveBeenCalledWith(symbols[0]!.start, symbols[0]!.end);
  });

  it("searches nested symbols and opens a match", () => {
    const onOpen = vi.fn();
    render(<EditorSymbolOutline symbols={symbols} onOpen={onOpen} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search symbols" }), { target: { value: "add" } });
    expect(screen.queryByRole("treeitem", { name: "TAX_RATE constant" })).toBeNull();
    fireEvent.click(screen.getByRole("treeitem", { name: "addItem method" }));
    expect(onOpen).toHaveBeenCalledWith({ file: "src/cart.ts", line: 12, column: 3 }, undefined);
  });

  it("shows an empty message without symbols", () => {
    render(<EditorSymbolOutline symbols={[]} onOpen={vi.fn()} />);
    expect(screen.getByText("No symbols in this file.")).toBeTruthy();
    expect(screen.queryByRole("tree")).toBeNull();
  });
});

describe("GitBlamePanel", () => {
  it("attributes line ranges to authors and opens the commit by its id", () => {
    const onOpenCommit = vi.fn();
    render(<GitBlamePanel file="src/cart.ts" onOpenCommit={onOpenCommit} ranges={[
      { id: "r1", startLine: 1, endLine: 4, author: "Dana Ortiz", commitId: "3f2a1bc", summary: "Add cart totals" },
      { id: "r2", startLine: 5, endLine: 5, author: "Lee Park", commitId: "9c4e7d0" },
    ]} />);
    expect(screen.getByText("src/cart.ts")).toBeTruthy();
    expect(screen.getByText("Lines 1–4")).toBeTruthy();
    expect(screen.getByText("Dana Ortiz · Add cart totals · 3f2a1bc")).toBeTruthy();
    expect(screen.getByText("Line 5")).toBeTruthy();
    fireEvent.click(button("Open commit 3f2a1bc for lines 1–4"));
    expect(onOpenCommit).toHaveBeenCalledWith("3f2a1bc");
    fireEvent.click(button("Open commit 9c4e7d0 for line 5"));
    expect(onOpenCommit).toHaveBeenLastCalledWith("9c4e7d0");
  });

  it("shows an empty message without attribution", () => {
    render(<GitBlamePanel file="src/new.ts" ranges={[]} onOpenCommit={vi.fn()} />);
    expect(screen.getByText("No line attribution.")).toBeTruthy();
  });
});

describe("GitBranchPicker", () => {
  const branches = [
    { id: "main", name: "main", scope: "local" as const, current: true },
    { id: "feat", name: "feature/receipt-printer", scope: "local" as const },
    { id: "origin-feat", name: "origin/feature/receipt-printer", scope: "remote" as const },
    { id: "locked", name: "release/2.4", scope: "local" as const, unavailableReason: "Checked out in another worktree" },
  ];

  it("checks out a branch by id and blocks the current, unavailable and pending ones", () => {
    const onCheckout = vi.fn();
    render(<GitBranchPicker branches={branches} onCheckout={onCheckout} pendingIds={["origin-feat"]} />);
    fireEvent.click(button("Check out feature/receipt-printer"));
    expect(onCheckout).toHaveBeenCalledWith("feat");
    expect(screen.getByText("Local · Current branch")).toBeTruthy();
    expect(isDisabled(button("Check out main"))).toBe(true);
    expect(screen.getByText("Local · Checked out in another worktree")).toBeTruthy();
    fireEvent.click(button("Check out release/2.4"));
    expect(screen.getByText("Remote · Checking out…")).toBeTruthy();
    fireEvent.click(button("Check out origin/feature/receipt-printer"));
    expect(onCheckout).toHaveBeenCalledTimes(1);
  });

  it("searches by name, filters by scope and shows an empty message when nothing matches", () => {
    render(<GitBranchPicker branches={branches} onCheckout={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Branch scope" }), { target: { value: "remote" } });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    fireEvent.change(screen.getByRole("combobox", { name: "Branch scope" }), { target: { value: "" } });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search branches" }), { target: { value: "receipt" } });
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search branches" }), { target: { value: "hotfix" } });
    expect(screen.getByText("No matching branches.")).toBeTruthy();
  });
});

describe("GitCommitForm", () => {
  const stagedFiles = [{ id: "s1", path: "src/cart.ts" }, { id: "s2", path: "src/tax.ts" }];

  it("commits the trimmed message with every staged file and clears the draft", async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    render(<GitCommitForm stagedFiles={stagedFiles} onCommit={onCommit} initialValue={{ summary: "Round tax", body: "" }} />);
    expect(screen.getByText("src/cart.ts")).toBeTruthy();
    const summary = screen.getByRole("textbox", { name: "Summary" }) as HTMLInputElement;
    expect(summary.value).toBe("Round tax");
    fireEvent.change(summary, { target: { value: "  Round tax to the nearest cent " } });
    fireEvent.change(screen.getByRole("textbox", { name: "Description" }), { target: { value: "\nMatches the register.\n" } });
    await act(async () => {
      fireEvent.click(button("Commit"));
    });
    expect(onCommit).toHaveBeenCalledWith({ summary: "Round tax to the nearest cent", body: "Matches the register.", fileIds: ["s1", "s2"] });
    expect(summary.value).toBe("");
    expect((screen.getByRole("textbox", { name: "Description" }) as HTMLTextAreaElement).value).toBe("");
  });

  it("requires a summary before committing", async () => {
    const onCommit = vi.fn();
    render(<GitCommitForm stagedFiles={stagedFiles} onCommit={onCommit} />);
    await act(async () => {
      fireEvent.click(button("Commit"));
    });
    expect(screen.getByRole("alert").textContent).toBe("Enter a commit summary.");
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("shows a failed commit as an alert and keeps the message", async () => {
    const onCommit = vi.fn().mockRejectedValue(new Error("A pre-commit hook failed."));
    render(<GitCommitForm stagedFiles={stagedFiles} onCommit={onCommit} />);
    const summary = screen.getByRole("textbox", { name: "Summary" }) as HTMLInputElement;
    fireEvent.change(summary, { target: { value: "Fix receipt layout" } });
    await act(async () => {
      fireEvent.click(button("Commit"));
    });
    expect(screen.getByRole("alert").textContent).toBe("A pre-commit hook failed.");
    expect(summary.value).toBe("Fix receipt layout");
  });

  it("cannot commit without staged files", () => {
    render(<GitCommitForm stagedFiles={[]} onCommit={vi.fn()} />);
    expect(screen.getByText("No staged files.")).toBeTruthy();
    expect(isDisabled(button("Commit"))).toBe(true);
  });
});

describe("GitCommitHistory", () => {
  const commits = [
    { id: "3f2a1bc", summary: "Add cart totals", author: "Dana Ortiz", timestamp: "2026-11-18 14:02", ref: "HEAD -> main" },
    { id: "9c4e7d0", summary: "Fix typo", author: "Lee Park", timestamp: "2026-11-17 09:40" },
    { id: "51d0e2a", summary: "Fix typo", author: "Dana Ortiz", timestamp: "2026-11-16 16:15" },
  ];

  it("opens and compares commits by id with actions that tell repeated summaries apart", () => {
    const onOpen = vi.fn();
    const onCompare = vi.fn();
    render(<GitCommitHistory commits={commits} onOpen={onOpen} onCompare={onCompare} />);
    expect(screen.getByText("HEAD -> main · 3f2a1bc · Dana Ortiz · 2026-11-18 14:02")).toBeTruthy();
    fireEvent.click(button("Open commit Fix typo 51d0e2a"));
    expect(onOpen).toHaveBeenCalledWith("51d0e2a");
    fireEvent.click(button("Compare commit Fix typo 9c4e7d0"));
    expect(onCompare).toHaveBeenCalledWith("9c4e7d0");
  });

  it("searches by author or id, omits compare without a handler and shows an empty message", () => {
    render(<GitCommitHistory commits={commits} onOpen={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /^Compare commit/ })).toBeNull();
    const search = screen.getByRole("searchbox", { name: "Search commits" });
    fireEvent.change(search, { target: { value: "lee" } });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    fireEvent.change(search, { target: { value: "51d0" } });
    expect(button("Open commit Fix typo 51d0e2a")).toBeTruthy();
    fireEvent.change(search, { target: { value: "revert" } });
    expect(screen.getByText("No matching commits.")).toBeTruthy();
  });
});

describe("MergeConflictResolver", () => {
  const conflicts = [
    { id: "c1", file: "src/tax.ts", current: "export const RATE = 0.07;\n", incoming: "export const RATE = 0.0725;\n" },
    { id: "c2", file: "src/cart.ts", current: "const limit = 10;\n", incoming: "const limit = 25;\n", choice: "both" as const },
  ];

  it("shows each conflict as a labelled current-to-incoming diff and resolves it with the chosen side", () => {
    const onResolve = vi.fn();
    render(<MergeConflictResolver conflicts={conflicts} onResolve={onResolve} />);
    expect(screen.getByRole("heading", { name: "src/tax.ts" })).toBeTruthy();
    const first = screen.getAllByRole("listitem")[0]!;
    expect(within(first).getByText("Current → Incoming")).toBeTruthy();
    expect(within(first).getByRole("status").textContent).toBe("Unresolved");
    fireEvent.click(button("Use incoming src/tax.ts"));
    expect(onResolve).toHaveBeenCalledWith("c1", "incoming");
    fireEvent.click(button("Use current src/tax.ts"));
    expect(onResolve).toHaveBeenLastCalledWith("c1", "current");
  });

  it("replaces the choices with an announced resolution once a conflict is resolved", () => {
    const { rerender } = render(<MergeConflictResolver conflicts={conflicts} onResolve={vi.fn()} />);
    const second = screen.getAllByRole("listitem")[1]!;
    expect(within(second).getByRole("status").textContent).toBe("Resolved: kept both changes.");
    expect(within(second).queryByRole("button", { name: /^Use/ })).toBeNull();
    const status = within(screen.getAllByRole("listitem")[0]!).getByRole("status");
    rerender(<MergeConflictResolver conflicts={[{ ...conflicts[0]!, choice: "current" }, conflicts[1]!]} onResolve={vi.fn()} />);
    expect(status.isConnected).toBe(true);
    expect(status.textContent).toBe("Resolved: kept the current change.");
  });

  it("blocks the choices of a pending conflict and shows an empty message without conflicts", () => {
    const onResolve = vi.fn();
    const { rerender } = render(<MergeConflictResolver conflicts={conflicts} onResolve={onResolve} pendingIds={["c1"]} />);
    expect(screen.getByText("Resolving…")).toBeTruthy();
    fireEvent.click(button("Use both src/tax.ts"));
    expect(onResolve).not.toHaveBeenCalled();
    rerender(<MergeConflictResolver conflicts={[]} onResolve={onResolve} />);
    expect(screen.getByText("No merge conflicts.")).toBeTruthy();
  });
});

describe("TestExplorer", () => {
  const tests = [
    { id: "s1", name: "cart", kind: "suite" as const, outcome: "failed" as const },
    { id: "t1", name: "adds items", kind: "test" as const, parentName: "cart", outcome: "passed" as const },
    { id: "t2", name: "applies tax", kind: "test" as const, parentName: "cart", outcome: "failed" as const },
    { id: "t3", name: "applies tax", kind: "test" as const, parentName: "receipt", outcome: "running" as const },
    { id: "t4", name: "prints a footer", kind: "test" as const, parentName: "receipt", outcome: "idle" as const },
  ];

  it("summarizes test outcomes in a live status and shows each outcome in words", () => {
    const { rerender } = render(<TestExplorer tests={tests} />);
    const status = screen.getAllByRole("status").find((element) => element.textContent?.includes("tests:"));
    if (!status) throw new Error("no test summary status");
    expect(status.textContent).toBe("4 tests: 1 not run, 1 running, 1 passed, 1 failed");
    expect(screen.getByText("receipt · Not run")).toBeTruthy();
    rerender(<TestExplorer tests={tests.map((test) => test.id === "t3" ? { ...test, outcome: "passed" as const } : test)} />);
    expect(status.textContent).toBe("4 tests: 1 not run, 2 passed, 1 failed");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("runs tests and suites by id and kind with actions named after their suite", () => {
    const onRun = vi.fn();
    render(<TestExplorer tests={tests} onRun={onRun} pendingIds={["t4"]} />);
    fireEvent.click(button("Run suite cart"));
    expect(onRun).toHaveBeenCalledWith("s1", "suite");
    fireEvent.click(button("Run test applies tax in cart"));
    expect(onRun).toHaveBeenLastCalledWith("t2", "test");
    expect(isDisabled(button("Run test applies tax in receipt"))).toBe(true);
    expect(screen.getByText("receipt · Not run · Starting…")).toBeTruthy();
    fireEvent.click(button("Run test prints a footer in receipt"));
    expect(onRun).toHaveBeenCalledTimes(2);
  });

  it("filters by outcome, searches by name or suite and shows an empty message", () => {
    render(<TestExplorer tests={tests} onRun={vi.fn()} />);
    const outcome = screen.getByRole("combobox", { name: "Outcome" });
    expect(within(outcome).getByRole("option", { name: "Not run" })).toBeTruthy();
    fireEvent.change(outcome, { target: { value: "failed" } });
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    fireEvent.change(outcome, { target: { value: "" } });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search tests" }), { target: { value: "receipt" } });
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search tests" }), { target: { value: "refund" } });
    expect(screen.getByText("No matching tests.")).toBeTruthy();
  });

  it("shows an empty message and no summary without tests", () => {
    render(<TestExplorer tests={[]} />);
    expect(screen.getByText("No tests.")).toBeTruthy();
    expect(screen.getAllByRole("status").map((element) => element.textContent)).toEqual(["", ""]);
  });
});
