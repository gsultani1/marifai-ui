// packages/ai-ui/test/spreadsheet.test.tsx
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Spreadsheet, type SpreadsheetSheet } from "../src/index.js";

const workbook = (cells: Record<string, string>): SpreadsheetSheet[] => [{ id: "s1", name: "Sheet1", cells }];

function setup(cells: Record<string, string> = {}, props: Partial<Parameters<typeof Spreadsheet>[0]> = {}) {
  const onSheetsChange = vi.fn();
  render(<Spreadsheet defaultSheets={workbook(cells)} onSheetsChange={onSheetsChange} {...props} />);
  const grid = screen.getByRole("grid");
  act(() => grid.focus());
  const cell = (row: number, column: number) => grid.querySelector<HTMLElement>(`[data-row="${row}"][data-column="${column}"]`)!;
  const key = (key: string, init: KeyboardEventInit = {}) => fireEvent.keyDown(grid, { key, ...init });
  const bar = () => screen.getByRole("textbox", { name: /^Contents of/ }) as HTMLInputElement;
  return { grid, cell, key, bar, onSheetsChange };
}

function clipboardEvent(type: "copy" | "cut" | "paste", data: Record<string, string> = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const store = { ...data };
  Object.assign(event, {
    clipboardData: {
      setData: (format: string, value: string) => {
        store[format] = value;
      },
      getData: (format: string) => store[format] ?? "",
    },
  });
  act(() => {
    document.dispatchEvent(event);
  });
  return store;
}

describe("Spreadsheet", () => {
  it("edits from the keyboard, evaluates formulas and shows the raw formula in the bar", () => {
    const { cell, key, bar, onSheetsChange } = setup({ A1: "2", A2: "3" });
    key("ArrowDown");
    key("ArrowDown");
    key("=");
    const editor = screen.getByRole("textbox", { name: "Edit A3" }) as HTMLInputElement;
    expect(editor.value).toBe("=");
    fireEvent.change(editor, { target: { value: "=A1+A2*2" } });
    fireEvent.keyDown(editor, { key: "Enter" });
    expect(cell(2, 0).textContent).toBe("8");
    expect(onSheetsChange).toHaveBeenLastCalledWith([expect.objectContaining({ cells: { A1: "2", A2: "3", A3: "=A1+A2*2" } })]);
    key("ArrowUp");
    expect(bar().value).toBe("=A1+A2*2");
    expect(screen.getByLabelText("Selected range").textContent).toBe("A3");
  });

  it("suggests functions while typing a formula and accepts one with Tab", () => {
    const { key } = setup();
    key("=");
    const editor = screen.getByRole("textbox", { name: "Edit A1" }) as HTMLInputElement;
    fireEvent.change(editor, { target: { value: "=SU" } });
    const listbox = screen.getByRole("listbox", { name: "Functions" });
    expect(within(listbox).getAllByRole("option").map((option) => option.textContent)).toContain("SUMIF");
    fireEvent.keyDown(editor, { key: "Tab" });
    expect(editor.value).toBe("=SUM(");
  });

  it("undoes and redoes edits and clears a selection with Delete", () => {
    const { cell, key } = setup({ A1: "1", A2: "2" });
    key("Delete");
    expect(cell(0, 0).textContent).toBe("");
    key("z", { ctrlKey: true });
    expect(cell(0, 0).textContent).toBe("1");
    key("y", { ctrlKey: true });
    expect(cell(0, 0).textContent).toBe("");
    key("z", { ctrlKey: true });
    key("ArrowDown", { shiftKey: true });
    key("Delete");
    expect([cell(0, 0).textContent, cell(1, 0).textContent]).toEqual(["", ""]);
  });

  it("summarizes a selection and fills down with Ctrl+D", () => {
    const { cell, key } = setup({ A1: "5", A2: "7", A3: "x" });
    key("ArrowDown", { shiftKey: true });
    key("ArrowDown", { shiftKey: true });
    expect(screen.getByText("Sum: 12")).toBeTruthy();
    expect(screen.getByText("Count: 3")).toBeTruthy();
    expect(screen.getByLabelText("Selected range").textContent).toBe("A1:A3");
    key("d", { ctrlKey: true });
    expect([cell(1, 0).textContent, cell(2, 0).textContent]).toEqual(["5", "5"]);
  });

  it("jumps to the edge of data with Ctrl+Arrow", () => {
    const { key } = setup({ A1: "1", A2: "2", A3: "3", A8: "8" });
    key("ArrowDown", { ctrlKey: true });
    expect(screen.getByLabelText("Selected range").textContent).toBe("A3");
    key("ArrowDown", { ctrlKey: true });
    expect(screen.getByLabelText("Selected range").textContent).toBe("A8");
    key("Home", { ctrlKey: true });
    expect(screen.getByLabelText("Selected range").textContent).toBe("A1");
  });

  it("copies cells and pastes formulas with shifted references", () => {
    const { key, bar } = setup({ A1: "1", A2: "2", B1: "=A1*2" });
    key("ArrowRight");
    const copied = clipboardEvent("copy");
    expect(copied["text/plain"]).toBe("2");
    expect(copied["text/html"]).toContain("<td>2</td>");
    key("ArrowDown");
    clipboardEvent("paste", { "text/plain": copied["text/plain"]! });
    expect(bar().value).toBe("=A2*2");
    key("ArrowDown");
    clipboardEvent("paste", { "text/plain": "a\tb\nc\td" });
    expect(screen.getByLabelText("Selected range").textContent).toBe("B3:C4");
  });

  it("sorts rows below the header by the active column", () => {
    const { cell } = setup({ A1: "Fruit", A2: "pear", A3: "apple", A4: "fig", B2: "3", B3: "1", B4: "2" });
    fireEvent.click(screen.getByRole("button", { name: "Sort by column A, A to Z" }));
    expect([cell(1, 0).textContent, cell(2, 0).textContent, cell(3, 0).textContent]).toEqual(["apple", "fig", "pear"]);
    expect([cell(1, 1).textContent, cell(2, 1).textContent, cell(3, 1).textContent]).toEqual(["1", "2", "3"]);
    expect(cell(0, 0).textContent).toBe("Fruit");
  });

  it("applies formats and number formats to the selection", () => {
    const { cell, key } = setup({ A1: "1234.5" });
    key("b", { ctrlKey: true });
    expect(cell(0, 0).className).toContain("font-semibold");
    expect(screen.getByRole("button", { name: "Bold" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("adds, renames and switches sheets, and keeps cross-sheet formulas pointing at renamed sheets", () => {
    const sheets: SpreadsheetSheet[] = [
      { id: "a", name: "Data", cells: { A1: "21" } },
      { id: "b", name: "Report", cells: { A1: "=Data!A1*2" } },
    ];
    const onSheetsChange = vi.fn();
    render(<Spreadsheet defaultSheets={sheets} onSheetsChange={onSheetsChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "Report" }));
    expect(screen.getByRole("grid").querySelector('[data-row="0"][data-column="0"]')!.textContent).toBe("42");
    fireEvent.doubleClick(screen.getByRole("tab", { name: "Data" }));
    const input = screen.getByRole("textbox", { name: "Sheet name" });
    fireEvent.change(input, { target: { value: "Q1 Sales" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSheetsChange.mock.lastCall![0][1].cells.A1).toBe("='Q1 Sales'!A1*2");
    fireEvent.click(screen.getByRole("button", { name: "Add sheet" }));
    expect(screen.getByRole("tab", { name: "Sheet3" }).getAttribute("aria-selected")).toBe("true");
  });

  it("rejects duplicate sheet names", () => {
    render(<Spreadsheet defaultSheets={[{ id: "a", name: "Data", cells: {} }, { id: "b", name: "Other", cells: {} }]} />);
    fireEvent.doubleClick(screen.getByRole("tab", { name: "Other" }));
    const input = screen.getByRole("textbox", { name: "Sheet name" });
    fireEvent.change(input, { target: { value: "data" } });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe("Another sheet has this name.");
  });

  it("does not edit in read-only mode", () => {
    const { key } = setup({ A1: "1" }, { readOnly: true });
    key("x");
    expect(screen.queryByRole("textbox", { name: "Edit A1" })).toBeNull();
    key("Delete");
    expect(screen.getByRole("grid").querySelector('[data-row="0"][data-column="0"]')!.textContent).toBe("1");
  });
});
