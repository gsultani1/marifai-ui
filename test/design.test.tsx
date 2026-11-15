// packages/ai-ui/test/design.test.tsx
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  alignElements,
  arrangeElements,
  type Design,
  DesignEditor,
  type DesignElement,
  distributeElements,
  elementAt,
  elementBounds,
  resizeElement,
  rotationFor,
  safeColor,
  scaleElements,
  snapBox,
  wrapText,
} from "../src/index.js";

const rect = (id: string, x: number, y: number, width = 100, height = 50, extra: Partial<DesignElement> = {}): DesignElement => ({ id, kind: "rect", x, y, width, height, fill: "#3987e5", ...extra });

describe("design geometry", () => {
  it("computes rotated bounds and hit tests inside rotated boxes", () => {
    const box = rect("a", 0, 0, 100, 100, { rotation: 45 });
    const bounds = elementBounds(box);
    expect(bounds.width).toBeCloseTo(141.42, 1);
    expect(bounds.x).toBeCloseTo(-20.71, 1);
    expect(elementAt([box], { x: 50, y: -15 })?.id).toBe("a");
    expect(elementAt([box], { x: 2, y: 2 }, { tolerance: 0 })).toBeUndefined();
    const line: DesignElement = { id: "l", kind: "line", x: 0, y: 0, width: 100, height: 100, strokeWidth: 2 };
    expect(elementAt([line], { x: 50, y: 52 })?.id).toBe("l");
    expect(elementAt([line], { x: 50, y: 70 })).toBeUndefined();
    expect(elementAt([rect("hidden", 0, 0, 100, 100, { hidden: true }), rect("locked", 0, 0, 100, 100, { locked: true })], { x: 10, y: 10 })).toBeUndefined();
  });

  it("snaps to page centers and other elements and reports guides", () => {
    const result = snapBox({ x: 487, y: 10, width: 100, height: 50 }, [{ x: 0, y: 200, width: 80, height: 80 }], { width: 1080, height: 1080 }, 6);
    expect(result.dx).toBe(3);
    expect(result.guides).toEqual([expect.objectContaining({ axis: "x", position: 540 })]);
    expect(snapBox({ x: 300, y: 300, width: 10, height: 10 }, [], { width: 1080, height: 1080 }, 2)).toEqual({ dx: 0, dy: 0, guides: [] });
  });

  it("resizes from a handle keeping the opposite corner fixed, with and without aspect lock", () => {
    const box = rect("a", 100, 100, 200, 100);
    expect(resizeElement(box, "se", { x: 400, y: 260 })).toEqual({ x: 100, y: 100, width: 300, height: 160 });
    expect(resizeElement(box, "nw", { x: 50, y: 80 })).toEqual({ x: 50, y: 80, width: 250, height: 120 });
    expect(resizeElement(box, "se", { x: 500, y: 150 }, { keepAspect: true })).toEqual({ x: 100, y: 100, width: 400, height: 200 });
    const rotated = rect("r", 0, 0, 100, 100, { rotation: 90 });
    const resized = { ...rotated, ...resizeElement(rotated, "e", { x: 50, y: 150 }) };
    expect(resized.width).toBeCloseTo(150);
    const corners = elementBounds(resized);
    expect(corners.y).toBeCloseTo(0);
  });

  it("rotates in 15 degree steps when snapping and aligns, distributes, arranges and scales", () => {
    expect(rotationFor({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(90);
    expect(rotationFor({ x: 0, y: 0 }, { x: 10, y: 9 }, true)).toBe(135);
    const items = [rect("a", 0, 0), rect("b", 300, 40), rect("c", 120, 80)];
    expect(alignElements(items, "left", { x: 0, y: 0, width: 1000, height: 1000 }).map((item) => item.x)).toEqual([0, 0, 0]);
    expect(alignElements(items, "middle", { x: 0, y: 0, width: 1000, height: 1000 }).map((item) => item.y)).toEqual([475, 475, 475]);
    expect(distributeElements(items, "horizontal").map((item) => item.x)).toEqual([0, 300, 150]);
    expect(arrangeElements(items, new Set(["a"]), "front").map((item) => item.id)).toEqual(["b", "c", "a"]);
    expect(arrangeElements(items, new Set(["c"]), "backward").map((item) => item.id)).toEqual(["a", "c", "b"]);
    const scaled = scaleElements([rect("a", 100, 100, 100, 100, { fontSize: 20 })], { x: 100, y: 100, width: 100, height: 100 }, { x: 0, y: 0, width: 200, height: 200 });
    expect(scaled[0]).toMatchObject({ x: 0, y: 0, width: 200, height: 200, fontSize: 40 });
  });

  it("wraps text by width, keeps explicit line breaks and rejects unsafe colors", () => {
    expect(wrapText("one two three four", 80, { fontSize: 20 })).toEqual(["one two", "three", "four"]);
    expect(wrapText("a\nb", 500)).toEqual(["a", "b"]);
    expect(safeColor("#ff0000")).toBe("#ff0000");
    expect(safeColor("rgb(1, 2, 3)")).toBe("rgb(1, 2, 3)");
    expect(safeColor('red" onload="x', "none")).toBe("none");
    expect(safeColor("url(#gradient)", "none")).toBe("none");
  });
});

const DESIGN: Design = {
  width: 1000,
  height: 1000,
  pages: [
    {
      id: "p1",
      name: "",
      background: "#ffffff",
      elements: [rect("box", 100, 100), { id: "title", kind: "text", x: 100, y: 300, width: 400, height: 60, text: "Hello", fontSize: 40 }],
    },
  ],
};

function setup(props: Partial<Parameters<typeof DesignEditor>[0]> = {}) {
  const onDesignChange = vi.fn();
  render(<DesignEditor defaultDesign={DESIGN} onDesignChange={onDesignChange} {...props} />);
  const canvas = screen.getByRole("application", { name: /Design canvas/ });
  const layers = screen.getByRole("region", { name: "Layers" });
  const last = () => onDesignChange.mock.lastCall![0] as Design;
  return { canvas, layers, onDesignChange, last };
}

describe("DesignEditor", () => {
  it("selects from the layers list, nudges with arrow keys and undoes", () => {
    const { canvas, layers, last } = setup();
    fireEvent.click(within(layers).getByRole("button", { name: "Rectangle" }));
    expect(screen.getByRole("status").textContent).toBe("Rectangle selected");
    fireEvent.keyDown(canvas, { key: "ArrowRight", shiftKey: true });
    fireEvent.keyDown(canvas, { key: "ArrowDown" });
    expect(last().pages[0]!.elements[0]).toMatchObject({ x: 110, y: 101 });
    fireEvent.keyDown(canvas, { key: "z", ctrlKey: true });
    expect(last().pages[0]!.elements[0]).toMatchObject({ x: 110, y: 100 });
  });

  it("duplicates, deletes, and leaves locked elements in place", () => {
    const { canvas, layers, last } = setup();
    fireEvent.click(within(layers).getByRole("button", { name: "Rectangle" }));
    fireEvent.keyDown(canvas, { key: "d", ctrlKey: true });
    expect(last().pages[0]!.elements).toHaveLength(3);
    expect(last().pages[0]!.elements[2]).toMatchObject({ kind: "rect", x: 124, y: 124 });
    fireEvent.keyDown(canvas, { key: "Delete" });
    expect(last().pages[0]!.elements).toHaveLength(2);
    fireEvent.click(within(layers).getByRole("button", { name: "Lock Rectangle" }));
    fireEvent.click(within(layers).getByRole("button", { name: "Rectangle" }));
    fireEvent.keyDown(canvas, { key: "Delete" });
    fireEvent.keyDown(canvas, { key: "ArrowLeft" });
    expect(last().pages[0]!.elements[0]).toMatchObject({ x: 100, locked: true });
  });

  it("edits position and colors from the properties panel and aligns to the page", () => {
    const { layers, last } = setup();
    fireEvent.click(within(layers).getByRole("button", { name: "Rectangle" }));
    const properties = screen.getByRole("complementary", { name: "Properties" });
    fireEvent.change(within(properties).getByRole("spinbutton", { name: "X" }), { target: { value: "250" } });
    expect(last().pages[0]!.elements[0]!.x).toBe(250);
    fireEvent.change(within(properties).getByRole("textbox", { name: "Fill value" }), { target: { value: "#ff0000" } });
    expect(last().pages[0]!.elements[0]!.fill).toBe("#ff0000");
    fireEvent.click(within(properties).getByRole("button", { name: "Align centers horizontally" }));
    expect(last().pages[0]!.elements[0]!.x).toBe(450);
    fireEvent.click(within(properties).getByRole("button", { name: "Bring to front" }));
    expect(last().pages[0]!.elements.map((element) => element.id)).toEqual(["title", "box"]);
  });

  it("creates shapes with tool shortcuts and edits text in place", () => {
    const { canvas, last } = setup();
    fireEvent.keyDown(canvas, { key: "r" });
    expect(within(screen.getByRole("toolbar", { name: "Design tools" })).getByRole("button", { name: "Rectangle" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    expect(last().pages[0]!.elements).toHaveLength(3);
    expect(last().pages[0]!.elements[2]).toMatchObject({ kind: "rect", width: 240, height: 160 });
    fireEvent.keyDown(canvas, { key: "t" });
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    const editor = screen.getByRole("textbox", { name: "Edit text" });
    fireEvent.change(editor, { target: { value: "Grand opening" } });
    fireEvent.keyDown(editor, { key: "Escape" });
    expect(last().pages[0]!.elements.at(-1)).toMatchObject({ kind: "text", text: "Grand opening" });
  });

  it("removes a text element whose text was cleared", () => {
    const { canvas, layers, last } = setup();
    fireEvent.click(within(layers).getByRole("button", { name: "Text: Hello" }));
    fireEvent.keyDown(canvas, { key: "Enter" });
    const editor = screen.getByRole("textbox", { name: "Edit text" });
    fireEvent.change(editor, { target: { value: "   " } });
    act(() => editor.blur());
    expect(last().pages[0]!.elements.map((element) => element.id)).toEqual(["box"]);
  });

  it("adds and deletes pages and hides layers", () => {
    const { layers, last } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Add page" }));
    expect(last().pages).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Page 2" }).getAttribute("aria-current")).toBe("page");
    fireEvent.click(screen.getByRole("button", { name: "Delete page 2" }));
    expect(last().pages).toHaveLength(1);
    fireEvent.click(within(layers).getByRole("button", { name: "Hide Rectangle" }));
    expect(last().pages[0]!.elements[0]!.hidden).toBe(true);
  });

  it("resizes the design and scales its content", () => {
    const { last } = setup();
    const properties = screen.getByRole("complementary", { name: "Properties" });
    fireEvent.change(within(properties).getByRole("combobox", { name: "Size" }), { target: { value: "slide" } });
    expect(last()).toMatchObject({ width: 1920, height: 1080 });
    expect(last().pages[0]!.elements[0]).toMatchObject({ x: 192, y: 108 });
  });

  it("shows pages without editing controls in read-only mode", () => {
    render(<DesignEditor defaultDesign={{ ...DESIGN, pages: [...DESIGN.pages, { id: "p2", name: "", background: "#000000", elements: [] }] }} readOnly />);
    expect(screen.queryByRole("toolbar", { name: "Design tools" })).toBeNull();
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();
  });
});
