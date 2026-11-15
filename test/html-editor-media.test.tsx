// packages/ai-ui/test/html-editor-media.test.tsx
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import { Slice } from "prosemirror-model";
import { type Command, EditorState, NodeSelection, type Selection, TextSelection } from "prosemirror-state";
import { CellSelection } from "prosemirror-tables";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { createMediaExtension } from "../src/components/html-editor-media.js";
import { type HtmlEditorHandle, HtmlEditorView, type HtmlEditorViewProps } from "../src/components/html-editor-view.js";
import { setBlock } from "../src/lib/rich-text/commands.js";
import { docToHtml, htmlToDoc } from "../src/lib/rich-text/html.js";
import {
  addColumn,
  calloutAround,
  clampFigureWidth,
  currentCellBackground,
  currentColumnWidth,
  embeddedImageProblem,
  embedStatus,
  evenTableColumns,
  FIGURE_MIN_WIDTH,
  figureSizePreset,
  insertColumns,
  MAX_EMBEDDED_IMAGE_BYTES,
  mediaUiPlugin,
  removeColumn,
  resizeTableColumn,
  retypesFigure,
  setCalloutTone,
  setCellBackground,
  setLayoutColumnCount,
  setFigureAlign,
  setFigureWidth,
  steppedFigureWidth,
  unwrapCallout,
  unwrapColumns,
  updateFigure,
  wrapInCallout,
} from "../src/lib/rich-text/html-media.js";

const FIGURE = '<figure data-align="center"><img src="https://example.com/aisle.jpg" alt="Aisle 4" width="400"><figcaption>Paint aisle</figcaption></figure>';
const EMPTY_FIGURE = '<figure data-align="center"><img src="https://example.com/aisle.jpg" alt="Aisle 4"></figure>';
const COLUMNS = '<div data-columns="2"><div data-column=""><p>Front</p></div><div data-column=""><p>Garden</p></div></div>';
const TABLE = '<table><tr><th><p>Shift</p></th><th><p>Cashiers</p></th></tr><tr><td><p>Morning</p></td><td style="background-color: #fef3c7"><p>3</p></td></tr></table>';

/** Position just inside the first occurrence of `text`. */
function textPos(doc: ProseMirrorNode, text: string): number {
  let found = -1;
  doc.descendants((node, pos) => {
    if (found >= 0) return false;
    if (node.isText && node.text?.includes(text)) found = pos + node.text.indexOf(text);
    return true;
  });
  if (found < 0) throw new Error(`"${text}" not found`);
  return found;
}

function nodePos(doc: ProseMirrorNode, name: string, index = 0): number {
  const positions: number[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === name) positions.push(pos);
  });
  const pos = positions[index];
  if (pos === undefined) throw new Error(`no ${name} #${index}`);
  return pos;
}

function stateAt(html: string, select: (doc: ProseMirrorNode) => Selection): EditorState {
  const doc = htmlToDoc(html);
  return EditorState.create({ doc, selection: select(doc) });
}

const cursorIn = (text: string, offset = 1) => (doc: ProseMirrorNode) => TextSelection.create(doc, textPos(doc, text) + offset);

function apply(state: EditorState, command: Command): { ok: boolean; state: EditorState; html: string } {
  let next = state;
  const ok = command(state, (tr) => {
    next = state.apply(tr);
  });
  return { ok, state: next, html: docToHtml(next.doc) };
}

const COLUMN_STYLE = (count: number) => `style="display: grid; grid-template-columns: repeat(${count}, minmax(0, 1fr)); gap: 24px;"`;

describe("callout commands", () => {
  it("wraps the block with the cursor and unwraps it, keeping the cursor in the text", () => {
    const wrapped = apply(stateAt("<p>Count the drawers</p><p>Lock up</p>", cursorIn("Count", 2)), wrapInCallout("warning"));
    expect(wrapped.ok).toBe(true);
    expect(wrapped.html).toBe('<aside data-callout="warning"><p>Count the drawers</p></aside><p>Lock up</p>');
    expect(wrapped.state.selection.$from.parent.textContent).toBe("Count the drawers");
    expect(calloutAround(wrapped.state)?.node.attrs.tone).toBe("warning");

    const unwrapped = apply(wrapped.state, unwrapCallout());
    expect(unwrapped.html).toBe("<p>Count the drawers</p><p>Lock up</p>");
    expect(unwrapped.state.selection.from).toBe(textPos(unwrapped.state.doc, "Count") + 2);
    expect(unwrapCallout()(unwrapped.state)).toBe(false);
  });

  it("wraps every selected block, wraps a whole list from inside an item and changes the tone inside a callout", () => {
    const both = stateAt("<p>One</p><p>Two</p>", (doc) => TextSelection.create(doc, textPos(doc, "One"), textPos(doc, "Two") + 2));
    expect(apply(both, wrapInCallout()).html).toBe('<aside data-callout="info"><p>One</p><p>Two</p></aside>');

    const list = apply(stateAt("<ul><li><p>Gloves</p></li><li><p>Goggles</p></li></ul>", cursorIn("Goggles")), wrapInCallout("note"));
    expect(list.html).toBe('<aside data-callout="note"><ul><li><p>Gloves</p></li><li><p>Goggles</p></li></ul></aside>');

    const toned = apply(list.state, wrapInCallout("danger"));
    expect(toned.html).toBe('<aside data-callout="danger"><ul><li><p>Gloves</p></li><li><p>Goggles</p></li></ul></aside>');
    expect(apply(toned.state, setCalloutTone(0, "success")).html).toContain('data-callout="success"');
    expect(setCalloutTone(0, "purple" as never)(toned.state)).toBe(false);
  });
});

describe("column commands", () => {
  it("puts the current block in the first of two new columns and keeps the cursor there", () => {
    const result = apply(stateAt("<p>Intro</p><p>Grills</p>", cursorIn("Grills", 3)), insertColumns(2));
    expect(result.html).toBe(`<p>Intro</p><div data-columns="2" ${COLUMN_STYLE(2)}><div data-column=""><p>Grills</p></div><div data-column=""><p></p></div></div>`);
    expect(result.state.selection.from).toBe(textPos(result.state.doc, "Grills") + 3);

    const three = apply(stateAt("<p>Seeds</p>", cursorIn("Seeds")), insertColumns(3));
    expect(three.html).toBe(`<div data-columns="3" ${COLUMN_STYLE(3)}><div data-column=""><p>Seeds</p></div><div data-column=""><p></p></div><div data-column=""><p></p></div></div>`);
  });

  it("wraps a whole list rather than one item, and changes the count inside a layout", () => {
    const list = apply(stateAt("<ul><li><p>Hoses</p></li></ul>", cursorIn("Hoses")), insertColumns(2));
    expect(list.html).toContain('<div data-column=""><ul><li><p>Hoses</p></li></ul></div>');

    const grown = apply(stateAt(COLUMNS, cursorIn("Front")), insertColumns(3));
    expect(grown.state.doc.firstChild?.childCount).toBe(3);
    const shrunk = apply(grown.state, insertColumns(2));
    expect(shrunk.html).toBe(`<div data-columns="2" ${COLUMN_STYLE(2)}><div data-column=""><p>Front</p></div><div data-column=""><p>Garden</p></div></div>`);
  });

  it("adds a column after the one with the cursor, up to three", () => {
    const state = stateAt(COLUMNS, cursorIn("Front"));
    const added = apply(state, addColumn(0, 0));
    expect(added.html).toBe(`<div data-columns="3" ${COLUMN_STYLE(3)}><div data-column=""><p>Front</p></div><div data-column=""><p></p></div><div data-column=""><p>Garden</p></div></div>`);
    expect(added.state.selection.$from.node(2).type.name).toBe("column");
    expect(added.state.selection.$from.index(1)).toBe(1);
    expect(addColumn(0)(added.state)).toBe(false);
  });

  it("removes a column by moving its content into a neighbor, never below two columns", () => {
    const three = `<div data-columns="3"><div data-column=""><p>A</p></div><div data-column=""><p>B</p></div><div data-column=""><p>C</p></div></div>`;
    const middle = apply(stateAt(three, cursorIn("B", 0)), removeColumn(0, 1));
    expect(middle.html).toBe(`<div data-columns="2" ${COLUMN_STYLE(2)}><div data-column=""><p>A</p><p>B</p></div><div data-column=""><p>C</p></div></div>`);
    expect(middle.state.selection.$from.parent.textContent).toBe("B");

    const first = apply(stateAt(three, cursorIn("C", 0)), removeColumn(0, 0));
    expect(first.html).toBe(`<div data-columns="2" ${COLUMN_STYLE(2)}><div data-column=""><p>A</p><p>B</p></div><div data-column=""><p>C</p></div></div>`);
    expect(removeColumn(0, 0)(middle.state)).toBe(false);

    const empty = `<div data-columns="3"><div data-column=""><p>A</p></div><div data-column=""><p></p></div><div data-column=""><p>C</p></div></div>`;
    expect(apply(stateAt(empty, cursorIn("A")), removeColumn(0, 1)).html).toBe(`<div data-columns="2" ${COLUMN_STYLE(2)}><div data-column=""><p>A</p></div><div data-column=""><p>C</p></div></div>`);
    expect(apply(stateAt(three, cursorIn("A")), setLayoutColumnCount(0, 2)).html).toContain("<p>B</p><p>C</p>");
  });

  it("removes the layout, putting content back in order, dropping empty columns and keeping the cursor", () => {
    const html = `<p>Before</p><div data-columns="3"><div data-column=""><h3>Front</h3><p>Grills</p></div><div data-column=""><p></p></div><div data-column=""><p>Garden</p></div></div>`;
    const result = apply(stateAt(html, cursorIn("Garden", 2)), unwrapColumns());
    expect(result.html).toBe("<p>Before</p><h3>Front</h3><p>Grills</p><p>Garden</p>");
    expect(result.state.selection.from).toBe(textPos(result.state.doc, "Garden") + 2);

    const blank = `<div data-columns="2"><div data-column=""><p></p></div><div data-column=""><p></p></div></div>`;
    const cleared = apply(stateAt(blank, (doc) => TextSelection.create(doc, 3)), unwrapColumns());
    expect(cleared.state.doc.childCount).toBe(1);
    expect(cleared.state.doc.firstChild?.type.name).toBe("paragraph");
    expect(unwrapColumns()(cleared.state)).toBe(false);
  });
});

describe("table commands", () => {
  it("colors every selected cell, including ones that already had the color, and removes it", () => {
    const doc = htmlToDoc(TABLE);
    const cells: number[] = [];
    doc.descendants((node, pos) => {
      if (node.type.name === "table_cell") cells.push(pos);
    });
    const selection = CellSelection.create(doc, cells[1]!, cells[0]!);
    const state = EditorState.create({ doc, selection });
    expect(currentCellBackground(state)).toEqual({ value: null, mixed: true });

    const colored = apply(state, setCellBackground("#fef3c7"));
    expect(colored.html).toContain('<td style="background-color: rgb(254, 243, 199);"><p>Morning</p></td><td style="background-color: rgb(254, 243, 199);"><p>3</p></td>');
    expect(currentCellBackground(colored.state)).toEqual({ value: "#fef3c7", mixed: false });

    const cleared = apply(colored.state, setCellBackground(null));
    expect(cleared.html).not.toContain("background-color");
    expect(setCellBackground("red;background:url(x)")(state)).toBe(false);
    expect(setCellBackground("#dcfce7")(stateAt("<p>Outside</p>", cursorIn("Outside")))).toBe(false);
  });

  it("colors the cell with the cursor when no cells are selected", () => {
    const result = apply(stateAt(TABLE, cursorIn("Morning")), setCellBackground("rgb(220, 252, 231)"));
    expect(result.html).toContain('<td style="background-color: rgb(220, 252, 231);"><p>Morning</p></td>');
    expect(currentCellBackground(result.state)).toEqual({ value: "#dcfce7", mixed: false });
  });

  it("widens and narrows a column from the keyboard and evens the widths out", () => {
    const state = stateAt(TABLE, cursorIn("Morning"));
    const measure = vi.fn(() => 150);
    const wider = apply(state, resizeTableColumn(20, measure));
    expect(wider.html).toContain('<th data-colwidth="170"><p>Shift</p></th>');
    expect(wider.html).toContain('<td data-colwidth="170"><p>Morning</p></td>');
    expect(currentColumnWidth(wider.state, measure)).toBe(170);

    const narrower = apply(wider.state, resizeTableColumn(-200, measure));
    expect(narrower.html).toContain('data-colwidth="48"');
    expect(resizeTableColumn(-20, measure)(narrower.state)).toBe(false);

    const even = apply(narrower.state, evenTableColumns);
    expect(even.html).not.toContain("data-colwidth");
    expect(evenTableColumns(even.state)).toBe(false);
  });
});

describe("figure commands", () => {
  const selectFigure = (doc: ProseMirrorNode) => NodeSelection.create(doc, nodePos(doc, "figure"));

  it("aligns, sizes and describes a figure and keeps it selected", () => {
    const state = stateAt(`<p>Intro</p>${FIGURE}`, selectFigure);
    const left = apply(state, setFigureAlign("left"));
    expect(left.html).toContain('<figure data-align="left"');
    expect(left.state.selection).toBeInstanceOf(NodeSelection);

    const small = apply(left.state, setFigureWidth(240));
    expect(small.html).toContain('width="240"');
    const original = apply(small.state, setFigureWidth(null));
    expect(original.html).not.toContain("width=");

    const described = apply(original.state, updateFigure(nodePos(original.state.doc, "figure"), { alt: "  Paint\u0007 aisle  " }));
    expect(described.html).toContain('alt="Paint aisle"');
    expect(apply(described.state, updateFigure(nodePos(described.state.doc, "figure"), { alt: "" })).html).toContain('alt=""');
    expect(setFigureAlign("left")(described.state)).toBe(false);
  });

  it("moves a wide figure to the center when it gets a width and clamps widths", () => {
    const wide = stateAt(FIGURE.replace('data-align="center"', 'data-align="wide"'), selectFigure);
    const sized = apply(wide, setFigureWidth(10));
    expect(sized.html).toContain('data-align="center"');
    expect(sized.html).toContain(`width="${FIGURE_MIN_WIDTH}"`);
    expect(clampFigureWidth(99999)).toBe(4000);
    expect(clampFigureWidth(300.6, 200)).toBe(200);
  });

  it("works from the caption cursor too, and does nothing elsewhere", () => {
    const caption = stateAt(FIGURE, cursorIn("Paint"));
    expect(apply(caption, setFigureAlign("right")).html).toContain('data-align="right"');
    expect(setFigureAlign("right")(stateAt("<p>Plain</p>", cursorIn("Plain")))).toBe(false);
  });

  it("never turns a figure into another block, which would drop its image", () => {
    const plugin = mediaUiPlugin({ isEditing: () => true, setStatus: () => undefined, focusFigureToolbar: () => false, views: new Set() });
    const doc = htmlToDoc(`<p>Intro</p>${FIGURE}`);
    const state = EditorState.create({ doc, selection: TextSelection.create(doc, textPos(doc, "Paint")), plugins: [plugin] });
    const tr = state.tr.setBlockType(state.selection.from, state.selection.from, state.schema.nodes.heading!, { level: 1 });
    expect(retypesFigure(tr)).toBe(true);
    expect(state.apply(tr).doc.eq(state.doc)).toBe(true);
    expect(apply(state, setBlock("heading1")).html).toBe(docToHtml(doc));
    const intro = state.tr.setBlockType(1, 1, state.schema.nodes.heading!, { level: 2 });
    expect(retypesFigure(intro)).toBe(false);
    expect(docToHtml(state.apply(intro).doc)).toContain("<h2>Intro</h2>");
    expect(apply(state, wrapInCallout()).html).toContain('<aside data-callout="info"><figure');
  });

  it("steps keyboard resizing by a tenth of the text width, within the allowed range", () => {
    expect(steppedFigureWidth(400, 600, 1)).toBe(460);
    expect(steppedFigureWidth(580, 600, 1)).toBe(600);
    expect(steppedFigureWidth(280, 600, 1, true)).toBe(300);
    expect(steppedFigureWidth(100, 600, -1)).toBe(FIGURE_MIN_WIDTH);
    expect(steppedFigureWidth(400, 0, 1)).toBe(440);
    expect(figureSizePreset(400)?.label).toBe("Medium");
    expect(figureSizePreset(null)?.label).toBe("Original");
    expect(figureSizePreset(333)).toBeNull();
  });
});

describe("embedding images without onImageUpload", () => {
  it("checks type and size and explains refusals", () => {
    expect(embeddedImageProblem({ type: "image/png", size: 1000 })).toBeNull();
    expect(embeddedImageProblem({ type: "image/AVIF", size: MAX_EMBEDDED_IMAGE_BYTES })).toBeNull();
    expect(embeddedImageProblem({ type: "image/webp", size: MAX_EMBEDDED_IMAGE_BYTES + 1 })).toBe("size");
    expect(embeddedImageProblem({ type: "image/svg+xml", size: 10 })).toBe("type");
    expect(embeddedImageProblem({ type: "image/bmp", size: 10 })).toBe("type");
    expect(embedStatus({ added: ["door.png"], tooLarge: [], wrongType: [], failed: [] })).toBe("Added door.png.");
    expect(embedStatus({ added: ["a.png", "b.png"], tooLarge: ["banner.jpg"], wrongType: ["logo.svg"], failed: [] })).toBe(
      "Added 2 images. banner.jpg is larger than 2 MB. Pass onImageUpload to HtmlEditor to add large images. logo.svg wasn't added: only PNG, JPEG, GIF, WebP and AVIF images can be embedded.",
    );
  });
});

async function setup(props: Partial<HtmlEditorViewProps> = {}) {
  const ref = createRef<HtmlEditorHandle>();
  const onValueChange = vi.fn();
  render(<HtmlEditorView ref={ref} defaultValue={`<p>Intro</p>${FIGURE}<p>After</p>`} onValueChange={onValueChange} aria-label="Report" {...props} />);
  const editor = await screen.findByRole("textbox", { name: "Report" });
  const view = () => ref.current!.getView()!;
  const html = () => ref.current!.getHTML();
  const dispatchSelection = (make: (doc: ProseMirrorNode) => Selection) =>
    act(() => {
      view().dispatch(view().state.tr.setSelection(make(view().state.doc)));
    });
  const selectFigure = () => dispatchSelection((doc) => NodeSelection.create(doc, nodePos(doc, "figure")));
  return { ref, editor, view, html, dispatchSelection, selectFigure, onValueChange };
}

const status = () => screen.getAllByRole("status").find((element) => element.className.includes("ml-auto"))!;

describe("embedding pasted and dropped images", () => {
  const paste = (view: ReturnType<Awaited<ReturnType<typeof setup>>["view"]>, files: File[], text = "") =>
    act(async () => {
      const event = { clipboardData: { files, getData: (type: string) => (type === "text/plain" ? text : "") }, preventDefault: vi.fn() } as unknown as ClipboardEvent;
      view.someProp("handlePaste", (handle) => handle(view, event, Slice.empty));
    });

  it("pastes the text, not a picture of it, when the clipboard holds both", async () => {
    const { view, html } = await setup({ defaultValue: "<p>Intro</p>" });
    await paste(view(), [new File(["x"], "image.png", { type: "image/png" })], "Q3 shrink by aisle");
    expect(html()).not.toContain("<figure");
  });

  it("embeds a small pasted image as a data URL figure and refuses a large one", async () => {
    const { view, html, dispatchSelection } = await setup({ defaultValue: "<p>Intro</p>" });
    dispatchSelection((doc) => TextSelection.create(doc, 6));
    await paste(view(), [new File(["x"], "door.png", { type: "image/png" })]);
    await waitFor(() => expect(status().textContent).toBe("Added door.png."));
    expect(html()).toContain('<img src="data:image/png;base64,eA==" alt="door"');

    await paste(view(), [new File([new Uint8Array(MAX_EMBEDDED_IMAGE_BYTES + 1)], "banner.jpg", { type: "image/jpeg" })]);
    await waitFor(() => expect(status().textContent).toContain("banner.jpg is larger than 2 MB. Pass onImageUpload"));
    expect(html().match(/<figure/g)).toHaveLength(1);
  });

  it("embeds dropped images at the drop point", async () => {
    const { view, html } = await setup({ defaultValue: "<p>Intro</p><p>Outro</p>" });
    vi.spyOn(view(), "posAtCoords").mockReturnValue({ pos: 1, inside: -1 });
    await act(async () => {
      const event = { dataTransfer: { files: [new File(["x"], "shelf.webp", { type: "image/webp" })] }, clientX: 0, clientY: 0, preventDefault: vi.fn() } as unknown as DragEvent;
      view().someProp("handleDrop", (handle) => handle(view(), event, Slice.empty, false));
    });
    await waitFor(() => expect(html()).toMatch(/^<figure[^>]*><img src="data:image\/webp;base64,eA==" alt="shelf"/));
  });

  it("leaves pasted files to onImageUpload when it is set", async () => {
    const onImageUpload = vi.fn(async () => "https://cdn.example.com/door.png");
    const { view, html } = await setup({ defaultValue: "<p>Intro</p>", onImageUpload });
    await paste(view(), [new File(["x"], "door.png", { type: "image/png" })]);
    await waitFor(() => expect(html()).toContain("https://cdn.example.com/door.png"));
    expect(onImageUpload).toHaveBeenCalledTimes(1);
    expect(html()).not.toContain("data:image");
  });
});

describe("figure editing", () => {
  it("shows a toolbar for the selected figure that aligns, sizes, describes and deletes it", async () => {
    const { html, selectFigure, editor } = await setup();
    expect(screen.queryByRole("toolbar", { name: "Image" })).toBeNull();
    selectFigure();
    const toolbar = screen.getByRole("toolbar", { name: "Image" });
    expect(within(toolbar).getByRole("button", { name: "Center image" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(toolbar).getByRole("button", { name: "Align image right" }));
    expect(html()).toContain('<figure data-align="right"');
    expect(within(toolbar).getByRole("button", { name: "Align image right" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(within(toolbar).getByRole("button", { name: /Image size: Medium/ }));
    fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: "Small (240 px)" }));
    expect(html()).toContain('width="240"');
    expect(status().textContent).toBe("Image size Small, 240 pixels");

    fireEvent.click(within(toolbar).getByRole("button", { name: "Alt text" }));
    const dialog = await screen.findByRole("dialog", { name: "Alt text" });
    const description = within(dialog).getByRole("textbox", { name: "Description" });
    expect((description as HTMLTextAreaElement).value).toBe("Aisle 4");
    fireEvent.change(description, { target: { value: "  " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(within(dialog).getByRole("alert").textContent).toBe("Describe the image, or mark it as decorative.");
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /Decorative image/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(html()).toContain('alt=""');
    expect(status().textContent).toBe("Image marked as decorative");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Alt text" })).toBeNull());

    fireEvent.click(within(toolbar).getByRole("button", { name: "Delete image" }));
    expect(html()).not.toContain("<figure");
    expect(status().textContent).toBe("Image deleted");
    expect(screen.queryByRole("toolbar", { name: "Image" })).toBeNull();
    expect(editor.querySelector("figure")).toBeNull();
  });

  it("asks the host to replace the image from the toolbar", async () => {
    const { selectFigure } = await setup();
    selectFigure();
    fireEvent.click(screen.getByRole("button", { name: "Replace image" }));
    expect(await screen.findByRole("dialog", { name: "Edit image" })).toBeTruthy();
  });

  it("resizes with Alt+Arrow keys, moves to the toolbar with Tab and back with Escape", async () => {
    const { editor, html, selectFigure, view } = await setup();
    selectFigure();
    fireEvent.keyDown(editor, { key: "ArrowRight", altKey: true });
    expect(html()).toContain('width="440"');
    expect(status().textContent).toBe("Image width 440 pixels");
    fireEvent.keyDown(editor, { key: "ArrowLeft", altKey: true });
    expect(html()).toContain('width="396"');
    expect(view().state.selection).toBeInstanceOf(NodeSelection);

    act(() => view().focus());
    fireEvent.keyDown(editor, { key: "Tab" });
    const toolbar = screen.getByRole("toolbar", { name: "Image" });
    expect(document.activeElement).toBe(within(toolbar).getByRole("button", { name: "Center image" }));
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(document.activeElement).toBe(editor);
  });

  it("resizes by dragging an edge handle, live and as one change", async () => {
    const { editor, html, view } = await setup();
    const handle = editor.querySelector<HTMLElement>('[data-figure-handle="right"]')!;
    const figure = editor.querySelector("figure")!;
    fireEvent.pointerDown(handle, { clientX: 100, button: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 150, pointerId: 1 });
    expect(figure.style.width).toBe("500px");
    expect(html()).toContain('width="400"');
    fireEvent.pointerUp(handle, { clientX: 150, pointerId: 1 });
    expect(html()).toContain('width="500"');
    expect(view().state.selection).toBeInstanceOf(NodeSelection);
    expect(status().textContent).toBe("Image width 500 pixels");

    fireEvent.pointerDown(handle, { clientX: 100, button: 0, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 100, pointerId: 1 });
    expect(html()).toContain('width="500"');
  });

  it("selects the figure with Escape in the caption and continues below it with Enter", async () => {
    const { editor, html, view, dispatchSelection } = await setup();
    dispatchSelection((doc) => TextSelection.create(doc, textPos(doc, "aisle")));
    fireEvent.keyDown(editor, { key: "Escape" });
    expect(view().state.selection).toBeInstanceOf(NodeSelection);
    expect((view().state.selection as NodeSelection).node.type.name).toBe("figure");

    dispatchSelection((doc) => TextSelection.create(doc, textPos(doc, "Paint") + 1));
    fireEvent.keyDown(editor, { key: "ArrowLeft" });
    expect(view().state.selection).toBeInstanceOf(TextSelection);
    dispatchSelection((doc) => TextSelection.create(doc, textPos(doc, "Paint")));
    fireEvent.keyDown(editor, { key: "ArrowLeft" });
    expect(view().state.selection).toBeInstanceOf(NodeSelection);

    dispatchSelection((doc) => TextSelection.create(doc, textPos(doc, "Paint") + 2));
    fireEvent.keyDown(editor, { key: "Enter" });
    expect(html()).toMatch(/<figcaption>Paint aisle<\/figcaption><\/figure><p><\/p><p>After<\/p>$/);
    expect(view().state.selection.$from.parent.type.name).toBe("paragraph");
  });

  it("keeps markdown block shortcuts typed in a caption as text", async () => {
    const { html, view, dispatchSelection } = await setup();
    const start = textPos(view().state.doc, "Paint");
    dispatchSelection((doc) => TextSelection.create(doc, start));
    act(() => view().dispatch(view().state.tr.insertText("#", start)));
    act(() => {
      view().someProp("handleTextInput", (handle) => handle(view(), start + 1, start + 1, " ", () => view().state.tr.insertText(" ", start + 1)));
    });
    expect(html()).toContain("<figcaption># Paint aisle</figcaption>");
  });

  it("shows the caption placeholder only while an empty caption is in use", async () => {
    const { editor, dispatchSelection, selectFigure } = await setup({ defaultValue: `<p>Intro</p>${EMPTY_FIGURE}<p>After</p>` });
    const caption = editor.querySelector("figcaption")!;
    expect(caption.dataset.placeholder).toBeUndefined();
    selectFigure();
    expect(caption.dataset.placeholder).toBe("Add a caption");
    dispatchSelection((doc) => TextSelection.create(doc, textPos(doc, "After")));
    expect(caption.dataset.placeholder).toBeUndefined();
    dispatchSelection((doc) => TextSelection.create(doc, nodePos(doc, "figure") + 1));
    expect(caption.dataset.placeholder).toBe("Add a caption");
  });

  it("shows no editing controls when read-only", async () => {
    const { editor, selectFigure } = await setup({ readOnly: true, defaultValue: `${EMPTY_FIGURE}<aside data-callout="warning"><p>Gloves</p></aside>${COLUMNS}` });
    selectFigure();
    expect(screen.queryByRole("toolbar", { name: "Image" })).toBeNull();
    expect([...editor.querySelectorAll<HTMLElement>("[data-figure-handle]")].every((handle) => handle.hidden)).toBe(true);
    expect(editor.querySelector("figcaption")!.hidden).toBe(true);
    expect(within(editor).queryByRole("button")).toBeNull();
    expect(within(editor).getByRole("img", { name: "Warning" })).toBeTruthy();
  });
});

describe("callouts in the editor", () => {
  it("changes the tone from the icon's menu and removes the callout", async () => {
    const { editor, html } = await setup({ defaultValue: '<aside data-callout="warning"><p>Wear gloves.</p></aside>' });
    const button = within(editor).getByRole("button", { name: "Callout type: Warning" });
    expect(button.getAttribute("aria-haspopup")).toBe("menu");
    fireEvent.click(button);
    await screen.findByRole("menu", { name: "Callout type" });
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("menuitemradio", { name: "Warning" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Danger" }));
    expect(html()).toBe('<aside data-callout="danger"><p>Wear gloves.</p></aside>');
    expect(within(editor).getByRole("button", { name: "Callout type: Danger" })).toBe(button);
    await waitFor(() => expect(screen.queryByRole("menu", { name: "Callout type" })).toBeNull());

    fireEvent.click(button);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remove callout" }));
    expect(html()).toBe("<p>Wear gloves.</p>");
    expect(status().textContent).toBe("Callout removed");
  });

  it("removes and restores editing controls when read-only changes", async () => {
    const value = `<aside data-callout="info"><p>Tip</p></aside>${COLUMNS}`;
    const { rerender } = render(<HtmlEditorView defaultValue={value} aria-label="Report" />);
    const editor = await screen.findByRole("textbox", { name: "Report" });
    expect(within(editor).getByRole("button", { name: "Callout type: Info" })).toBeTruthy();
    rerender(<HtmlEditorView defaultValue={value} aria-label="Report" readOnly />);
    await waitFor(() => expect(within(editor).queryByRole("button")).toBeNull());
    expect(within(editor).queryByRole("toolbar", { name: "Column layout" })).toBeNull();
    rerender(<HtmlEditorView defaultValue={value} aria-label="Report" />);
    await waitFor(() => expect(within(editor).getByRole("toolbar", { name: "Column layout" })).toBeTruthy());
    expect(within(editor).getByRole("button", { name: "Callout type: Info" })).toBeTruthy();
  });

  it("focuses the callout's button with Alt+F10", async () => {
    const { editor, dispatchSelection } = await setup({ defaultValue: '<aside data-callout="note"><p>Restock Friday.</p></aside>' });
    dispatchSelection((doc) => TextSelection.create(doc, textPos(doc, "Friday")));
    fireEvent.keyDown(editor, { key: "F10", altKey: true });
    expect(document.activeElement).toBe(within(editor).getByRole("button", { name: "Callout type: Note" }));
  });
});

describe("columns in the editor", () => {
  it("adds and removes columns and removes the layout from its toolbar", async () => {
    const { editor, html, dispatchSelection } = await setup({ defaultValue: COLUMNS });
    const bar = within(editor).getByRole("toolbar", { name: "Column layout" });
    expect(within(bar).getByRole("button", { name: "Remove column" }).getAttribute("aria-disabled")).toBe("true");
    dispatchSelection((doc) => TextSelection.create(doc, textPos(doc, "Front")));
    expect(editor.querySelector("[data-columns]")?.getAttribute("data-active")).toBe("true");

    fireEvent.click(within(bar).getByRole("button", { name: "Add column" }));
    expect(html()).toContain('data-columns="3"');
    expect(status().textContent).toBe("Added a column. 3 columns.");
    expect(within(bar).getByRole("button", { name: "Add column" }).getAttribute("aria-disabled")).toBe("true");

    fireEvent.click(within(bar).getByRole("button", { name: "Remove column" }));
    expect(html()).toContain('data-columns="2"');
    expect(status().textContent).toBe("Removed column 2. 2 columns.");

    fireEvent.click(within(bar).getByRole("button", { name: "Remove layout" }));
    expect(html()).toBe("<p>Front</p><p>Garden</p>");
    expect(status().textContent).toBe("Removed the column layout");
  });

  it("inserts layouts and callouts from its slash items", async () => {
    const { view, html, dispatchSelection } = await setup({ defaultValue: "<p>Seeds</p>" });
    const { slashItems = [] } = createMediaExtension({ getView: view, getProps: () => ({}), setStatus: () => undefined });
    expect(slashItems.map((item) => [item.label, item.group, Boolean(item.turnInto)])).toEqual([
      ["Callout", "Basic blocks", true],
      ["Warning callout", "Basic blocks", true],
      ["Note", "Basic blocks", true],
      ["2 columns", "Layout", false],
      ["3 columns", "Layout", false],
    ]);
    dispatchSelection((doc) => TextSelection.create(doc, 2));
    act(() => slashItems.find((item) => item.id === "columns-2")!.run(view()));
    expect(html()).toContain('<div data-column=""><p>Seeds</p></div><div data-column=""><p></p></div>');
    act(() => slashItems.find((item) => item.id === "callout-warning")!.run(view()));
    expect(html()).toContain('<div data-column=""><aside data-callout="warning"><p>Seeds</p></aside></div>');
  });
});

describe("tables in the editor", () => {
  it("offers cell colors and column widths only while the selection is in a table", async () => {
    const { html, dispatchSelection } = await setup({ defaultValue: `<p>Intro</p>${TABLE}` });
    expect(screen.queryByRole("button", { name: /^Cell color/ })).toBeNull();
    dispatchSelection((doc) => TextSelection.create(doc, textPos(doc, "3")));
    const colorButton = screen.getByRole("button", { name: "Cell color: Yellow" });
    fireEvent.click(colorButton);
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "Green" }));
    expect(html()).toContain('<td style="background-color: rgb(220, 252, 231);"><p>3</p></td>');
    expect(status().textContent).toBe("Green applied to the cell");

    fireEvent.click(screen.getByRole("button", { name: "Cell color: Green" }));
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "No color" }));
    expect(html()).not.toContain("background-color");

    fireEvent.click(screen.getByRole("button", { name: "Column width" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Widen column" }));
    expect(html()).toContain('<td data-colwidth="120"><p>3</p></td>');
    expect(status().textContent).toBe("Column width 120 pixels");

    dispatchSelection((doc) => TextSelection.create(doc, textPos(doc, "Intro")));
    expect(screen.queryByRole("button", { name: /^Cell color/ })).toBeNull();
  });

  it("adds nothing in compact editors", async () => {
    const { editor, dispatchSelection } = await setup({ compact: true, defaultValue: `${TABLE}<aside data-callout="info"><p>Tip</p></aside>${COLUMNS}` });
    dispatchSelection((doc) => TextSelection.create(doc, textPos(doc, "Morning")));
    expect(screen.queryByRole("button", { name: /^Cell color/ })).toBeNull();
    expect(within(editor).queryByRole("button")).toBeNull();
    expect(within(editor).queryByRole("toolbar")).toBeNull();
  });
});
