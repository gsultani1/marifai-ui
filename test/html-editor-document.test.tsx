// packages/ai-ui/test/html-editor-document.test.tsx
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { redo, undo, undoDepth } from "prosemirror-history";
import { EditorState, NodeSelection, TextSelection } from "prosemirror-state";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { pagePrintCss } from "../src/components/html-editor-document.js";
import { HtmlEditorView, type HtmlEditorHandle, type HtmlEditorViewProps } from "../src/components/html-editor-view.js";
import { docToHtml, htmlSchema, htmlToDoc } from "../src/lib/rich-text/html.js";
import {
  cleanFootnoteText,
  collapseMargins,
  createDocumentFeature,
  cssString,
  type DocumentSettings,
  documentKey,
  fillPageTemplate,
  footnoteList,
  formatPageDate,
  insertFootnote,
  insertPageBreak,
  insertTableOfContents,
  PAGE_SIZES,
  type PageBlock,
  pageAt,
  paginate,
  templateCssContent,
} from "../src/lib/rich-text/html-document.js";

const block = (height: number, extra: Partial<PageBlock> = {}): PageBlock => ({ height, marginTop: 0, marginBottom: 0, spacingBefore: 0, ...extra });

describe("pagination math", () => {
  it("keeps blocks that fit on one page and reports the space left", () => {
    expect(paginate([block(100), block(200, { spacingBefore: 10 })], 864)).toEqual({ breaks: [], lastFill: 554 });
    expect(paginate([], 864)).toEqual({ breaks: [], lastFill: 864 });
  });

  it("moves the first block that would overflow to the next page", () => {
    const blocks = [block(400, { marginBottom: 16 }), block(400, { marginTop: 8, spacingBefore: 16 }), block(100, { marginTop: 24, spacingBefore: 24 })];
    // 400 + 16 + 400 = 816 fits in 864; 816 + 24 + 100 = 940 does not.
    expect(paginate(blocks, 864)).toEqual({ breaks: [{ index: 2, fill: 864 - 816 }], lastFill: 864 - 124 });
  });

  it("starts a page after a page break even with room left, and lets the marker hang into the margin", () => {
    const blocks = [block(850), block(28, { hang: true, spacingBefore: 4 }), block(50, { breakBefore: true, spacingBefore: 4 }), block(40, { spacingBefore: 8 })];
    expect(paginate(blocks, 864)).toEqual({ breaks: [{ index: 2, fill: 864 - 882 }], lastFill: 864 - 98 });
  });

  it("puts a block taller than a page alone on its page without splitting it", () => {
    const flow = paginate([block(100), block(2000, { spacingBefore: 10 }), block(50, { spacingBefore: 10 })], 864);
    expect(flow.breaks.map((at) => at.index)).toEqual([1, 2]);
    expect(flow.breaks[1]!.fill).toBe(864 - 2000);
  });

  it("collapses margins like CSS and finds the page holding a position", () => {
    expect(collapseMargins(16, 24)).toBe(24);
    expect(collapseMargins(16, -4)).toBe(12);
    expect(pageAt([40, 90], 10)).toBe(1);
    expect(pageAt([40, 90], 40)).toBe(2);
    expect(pageAt([40, 90], 200)).toBe(3);
  });

  it("measures Letter and A4 at 96 px per inch with one inch margins", () => {
    expect(PAGE_SIZES.letter).toMatchObject({ width: 816, height: 1056, margin: 96, contentWidth: 624, contentHeight: 864 });
    expect(PAGE_SIZES.a4.width).toBeCloseTo(793.7, 1);
    expect(PAGE_SIZES.a4.height).toBeCloseTo(1122.5, 1);
  });
});

describe("header and footer templates", () => {
  const values = { page: 2, pages: 5, title: "store-reset-report", date: "October 25, 2026" };

  it("fills page, pages, title and date and leaves other braces alone", () => {
    expect(fillPageTemplate("Whitten Hardware · {title}", values)).toBe("Whitten Hardware · store-reset-report");
    expect(fillPageTemplate("Page {page} of {pages} · {date} {unknown} {page}", values)).toBe("Page 2 of 5 · October 25, 2026 {unknown} 2");
    expect(formatPageDate(new Date(2026, 9, 25), "en-US")).toBe("October 25, 2026");
  });

  it("maps templates to CSS content with page counters and escaped strings", () => {
    expect(templateCssContent("Page {page} of {pages}", values)).toBe('"Page " counter(page) " of " counter(pages)');
    expect(templateCssContent("{page}", values)).toBe("counter(page)");
    expect(templateCssContent("{title} – {date}", values)).toBe('"store-reset-report – October 25, 2026"');
    expect(templateCssContent("", values)).toBe("");
    expect(cssString('say "hi" \\ bye\n</style><script>')).toBe('"say \\"hi\\" \\\\ bye\\a \\3c /style\\3e \\3c script\\3e "');
  });

  it("builds print CSS for the paper size with the header and footer in margin boxes", () => {
    const props: HtmlEditorViewProps = { pageSize: "letter", header: "Whitten Hardware · {title}", footer: "Page {page} of {pages}", title: "store-reset-report" };
    expect(pagePrintCss(props)).toBe(
      '@page{size:8.5in 11in;margin:1in;@top-center{content:"Whitten Hardware · store-reset-report";font:10pt/1.2 system-ui,sans-serif;color:#52525b}@bottom-center{content:"Page " counter(page) " of " counter(pages);font:10pt/1.2 system-ui,sans-serif;color:#52525b}}@media print{body{max-width:none;margin:0;padding:0}}',
    );
    const a4 = pagePrintCss({ pageSize: "a4", title: 'Q3 "final"' , defaultHeader: '{title}";}body{display:none' });
    expect(a4).toContain("size:210mm 297mm");
    expect(a4).toContain('@top-center{content:"Q3 \\"final\\"\\";}body{display:none"');
    expect(a4).toContain('@bottom-center{content:"Page " counter(page) " of " counter(pages)');
    expect(pagePrintCss({ header: "", footer: "" })).toBe("@page{size:8.5in 11in;margin:1in;}@media print{body{max-width:none;margin:0;padding:0}}");
  });
});

const SETTINGS: DocumentSettings = { enabled: true, readOnly: false, layout: "web", pageSize: "letter", header: "", footer: "Page {page} of {pages}", title: "Report" };

function stateFor(html: string, settings: Partial<DocumentSettings> = {}) {
  const { plugins } = createDocumentFeature({ getSettings: () => ({ ...SETTINGS, ...settings }), announce: () => undefined });
  return EditorState.create({ doc: htmlToDoc(html), plugins });
}

describe("document commands and plugin state", () => {
  it("numbers footnotes in document order and cleans their text", () => {
    const doc = htmlToDoc('<p>A<sup data-footnote="First">*</sup></p><table><tr><td><p>B<sup data-footnote="In a table">*</sup></p></td></tr></table><p>C<sup data-footnote="">*</sup></p>');
    expect(footnoteList(doc).map((entry) => entry.text)).toEqual(["First", "In a table", ""]);
    expect(cleanFootnoteText("  Two\u0007 coats\n\tminimum  ")).toBe("Two coats\n\tminimum");
    expect(cleanFootnoteText("x".repeat(3000))).toHaveLength(2000);
  });

  it("inserts a page break at the cursor, after the enclosing block when nested", () => {
    let state = stateFor("<p>Front of store</p>");
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 6)));
    insertPageBreak(state, (tr) => (state = state.apply(tr)));
    expect(docToHtml(state.doc)).toBe('<p>Front</p><div data-page-break="" style="break-after: page; page-break-after: always;"></div><p> of store</p>');

    expect(state.selection.$from.parent.textContent).toBe(" of store");

    state = stateFor("<p>Front</p><p></p>");
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 8)));
    insertPageBreak(state, (tr) => (state = state.apply(tr)));
    expect(state.doc.childCount).toBe(3);
    expect(state.doc.child(1).type.name).toBe("page_break");
    expect(state.selection.from).toBe(9);

    state = stateFor("<p>Front</p>");
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 6)));
    insertPageBreak(state, (tr) => (state = state.apply(tr)));
    expect(state.doc.childCount).toBe(3);
    expect(state.doc.lastChild!.type.name).toBe("paragraph");

    state = stateFor("<ul><li><p>Grills</p></li></ul><p>After</p>");
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 4)));
    insertPageBreak(state, (tr) => (state = state.apply(tr)));
    expect(state.doc.child(1).type.name).toBe("page_break");
    expect(state.doc.child(2).textContent).toBe("After");

    state = stateFor("<pre><code>x</code></pre>");
    expect(insertPageBreak(state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1))))).toBe(false);
  });

  it("inserts a table of contents and an empty footnote whose editor opens right away", () => {
    let state = stateFor("<p></p>");
    insertTableOfContents(state, (tr) => (state = state.apply(tr)));
    expect(state.doc.firstChild!.type.name).toBe("toc");

    state = stateFor("<p>Primer</p>");
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1, 7)));
    insertFootnote(state, (tr) => (state = state.apply(tr)));
    expect(state.doc.nodeAt(7)?.type.name).toBe("footnote");
    expect(documentKey.getState(state)?.editing).toMatchObject({ pos: 7, fresh: true, source: "reference" });
    expect(documentKey.getState(state)?.footnotes).toEqual([{ pos: 7, text: "" }]);
    state = state.apply(state.tr.insertText("Fresh ", 1));
    expect(documentKey.getState(state)?.editing?.pos).toBe(13);
    expect(insertFootnote(stateFor("<pre><code>x</code></pre>"))).toBe(false);
  });

  it("maps page breaks through edits and drops them in compact editors", () => {
    let state = stateFor("<p>One</p><p>Two</p>", { layout: "page" });
    expect(documentKey.getState(state)?.paged).toBe(true);
    state = state.apply(state.tr.setMeta(documentKey, { pages: { breaks: [{ pos: 5, fill: 12 }], lastFill: 40 } }));
    state = state.apply(state.tr.insertText("Day ", 1));
    expect(documentKey.getState(state)?.breaks).toEqual([{ pos: 9, fill: 12 }]);
    state = state.apply(state.tr.delete(4, 10));
    expect(documentKey.getState(state)?.breaks).toEqual([]);
    expect(documentKey.getState(stateFor("<p>x</p>", { layout: "page", enabled: false }))?.paged).toBe(false);
  });
});

/** The status bar's page indicator, as opposed to footers inside the document that may read the same. */
function statusText(editor: HTMLElement): string | undefined {
  return screen.queryAllByText(/^Page \d+ of \d+$/).find((element) => !editor.contains(element))?.textContent ?? undefined;
}

async function setup(props: Partial<HtmlEditorViewProps> = {}) {
  const ref = createRef<HtmlEditorHandle>();
  const onValueChange = vi.fn();
  render(<HtmlEditorView ref={ref} defaultValue="<h1>Title</h1><p>Hello world</p>" onValueChange={onValueChange} title="Report" {...props} />);
  const editor = await screen.findByRole("textbox", { name: props["aria-label"] ?? "Document" });
  const view = () => ref.current!.getView()!;
  const select = (from: number, to = from) =>
    act(() => {
      view().dispatch(view().state.tr.setSelection(TextSelection.create(view().state.doc, from, to)));
    });
  return { ref, editor, view, select, onValueChange };
}

describe("page layout", () => {
  it("toggles page layout and shows the header, footer and page count", async () => {
    const onLayoutChange = vi.fn();
    const { editor, view, select } = await setup({ layout: "page", onLayoutChange, header: "Whitten Hardware · {title}" });
    const toggle = screen.getByRole("button", { name: "Page layout" });
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Letter")).toBeTruthy();
    expect(editor.getAttribute("data-page-size")).toBe("letter");
    expect(editor.style.width).toBe("816px");
    expect(editor.querySelector("[data-page-head]")?.textContent).toBe("Whitten Hardware · Report");
    expect(editor.querySelector("[data-page-head]")?.getAttribute("aria-hidden")).toBe("true");
    expect(editor.querySelector("[data-page-tail]")?.textContent).toBe("Page 1 of 1");
    expect(statusText(editor)).toBe("Page 1 of 1");

    act(() => {
      view().dispatch(view().state.tr.setMeta(documentKey, { pages: { breaks: [{ pos: 7, fill: 120 }], lastFill: 300 } }));
    });
    const gaps = editor.querySelectorAll<HTMLElement>("[data-page-gap]");
    expect(gaps).toHaveLength(1);
    expect(gaps[0]!.nextElementSibling?.tagName).toBe("P");
    expect(gaps[0]!.textContent).toBe("Page 1 of 2Whitten Hardware · Report");
    expect(gaps[0]!.firstElementChild?.getAttribute("style")).toContain("height: 216px");
    expect(editor.querySelector("[data-page-tail]")?.textContent).toBe("Page 2 of 2");
    select(9);
    expect(statusText(editor)).toBe("Page 2 of 2");
    select(2);
    expect(statusText(editor)).toBe("Page 1 of 2");

    fireEvent.click(toggle);
    expect(onLayoutChange).toHaveBeenCalledWith("web");
  });

  it("leaves web layout and compact editors without page chrome", async () => {
    const { editor } = await setup();
    expect(screen.getByRole("button", { name: "Page layout" }).getAttribute("aria-pressed")).toBe("false");
    expect(editor.querySelector("[data-page-head], [data-page-tail]")).toBeNull();
    expect(screen.queryByRole("button", { name: "Header and footer" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Page layout" }));
    await waitFor(() => expect(editor.querySelector("[data-page-head]")).not.toBeNull());
    expect(screen.getByRole("button", { name: "Page layout" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("hides everything in compact editors", async () => {
    const { editor } = await setup({ compact: true, layout: "page", defaultValue: '<p>A<sup data-footnote="Note">*</sup></p>' });
    expect(editor.querySelector("[data-page-head], [data-footnotes-list]")).toBeNull();
    expect(screen.queryByRole("button", { name: "Page layout" })).toBeNull();
  });

  it("edits the header and footer in a dialog with field hints", async () => {
    const onHeaderChange = vi.fn();
    const onFooterChange = vi.fn();
    const { editor } = await setup({ defaultLayout: "page", defaultHeader: "Whitten Hardware", onHeaderChange, onFooterChange });
    fireEvent.click(screen.getByRole("button", { name: "Header and footer" }));
    const dialog = await screen.findByRole("dialog", { name: "Header and footer" });
    const header = within(dialog).getByRole("textbox", { name: "Header" });
    expect((header as HTMLInputElement).value).toBe("Whitten Hardware");
    fireEvent.change(header, { target: { value: "Whitten Hardware · " } });
    fireEvent.focus(header);
    (header as HTMLInputElement).setSelectionRange(19, 19);
    fireEvent.click(within(dialog).getByRole("button", { name: /\{title\}/ }));
    expect((header as HTMLInputElement).value).toBe("Whitten Hardware · {title}");
    expect(within(dialog).getByText("Page 1 shows: Whitten Hardware · Report")).toBeTruthy();
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Footer" }), { target: { value: "{page} / {pages}" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(onHeaderChange).toHaveBeenCalledWith("Whitten Hardware · {title}");
    expect(onFooterChange).toHaveBeenCalledWith("{page} / {pages}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Header and footer" })).toBeNull());
    expect(editor.querySelector("[data-page-head]")?.textContent).toBe("Whitten Hardware · Report");
    expect(editor.querySelector("[data-page-tail]")?.textContent).toBe("1 / 1");
    expect(screen.getByRole("status").textContent).toBe("Header and footer updated");
  });
});

describe("page breaks and the table of contents", () => {
  it("renders a labeled, selectable page break and inserts one with Ctrl+Enter", async () => {
    const { editor, ref, view, select } = await setup({ defaultValue: "<p>One</p><div data-page-break></div><p>Two</p>" });
    const separator = within(editor).getByRole("separator", { name: "Page break" });
    expect(separator.textContent).toBe("Page break");
    act(() => {
      view().dispatch(view().state.tr.setSelection(NodeSelection.create(view().state.doc, 5)));
    });
    expect(separator.classList.contains("ProseMirror-selectednode")).toBe(true);
    fireEvent.keyDown(editor, { key: "Backspace", keyCode: 8 });
    expect(ref.current!.getHTML()).toBe("<p>One</p><p>Two</p>");
    select(4);
    fireEvent.keyDown(editor, { key: "Enter", keyCode: 13, ctrlKey: true });
    expect(ref.current!.getHTML()).toContain("<p>One</p><div data-page-break=");
  });

  it("lists headings live, jumps to them and shows an empty state", async () => {
    const { editor, view } = await setup({ defaultValue: "<nav data-toc></nav><h1>Store reset</h1><p>x</p><h2>Floor reset</h2><h4>Too deep</h4>" });
    const toc = within(editor).getByRole("group", { name: "Table of contents" });
    expect(within(toc).getAllByRole("button").map((entry) => entry.textContent)).toEqual(["Store reset", "Floor reset"]);
    expect(within(toc).getAllByRole("button").map((entry) => entry.tabIndex)).toEqual([0, -1]);
    expect(within(toc).getByText("Floor reset").closest("[role=listitem]")?.className).toBe("ps-4");

    act(() => {
      const state = view().state;
      view().dispatch(state.tr.insert(state.doc.content.size, htmlSchema.nodes.heading!.create({ level: 3 }, htmlSchema.text("Staffing"))));
    });
    expect(within(toc).getAllByRole("button").map((entry) => entry.textContent)).toEqual(["Store reset", "Floor reset", "Staffing"]);

    fireEvent.click(within(toc).getByRole("button", { name: "Floor reset" }));
    expect(view().state.selection.$from.parent.textContent).toBe("Floor reset");
    expect(screen.getByRole("status").textContent).toBe("Moved to Floor reset");

    act(() => {
      const state = view().state;
      view().dispatch(state.tr.delete(1, state.doc.content.size));
    });
    expect(within(editor).getByText("Add headings to build the table of contents")).toBeTruthy();
  });

  it("selects the table of contents and moves into it with Enter and arrow keys", async () => {
    const { editor, view } = await setup({ defaultValue: "<nav data-toc></nav><h1>Store reset</h1><h2>Floor reset</h2>" });
    act(() => {
      view().dispatch(view().state.tr.setSelection(NodeSelection.create(view().state.doc, 0)));
    });
    fireEvent.keyDown(editor, { key: "Enter", keyCode: 13 });
    const entries = within(editor).getAllByRole("button");
    expect(document.activeElement).toBe(entries[0]);
    fireEvent.keyDown(entries[0]!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(entries[1]);
    expect(entries.map((entry) => entry.tabIndex)).toEqual([-1, 0]);
    fireEvent.keyDown(entries[1]!, { key: "Escape" });
    expect(view().state.selection).toBeInstanceOf(NodeSelection);
  });

  it("shows page numbers in page layout", async () => {
    const { editor, view } = await setup({ layout: "page", defaultValue: "<nav data-toc></nav><h1>Store reset</h1><p>x</p><h2>Paint</h2>" });
    act(() => {
      view().dispatch(view().state.tr.setMeta(documentKey, { pages: { breaks: [{ pos: 17, fill: 10 }], lastFill: 10 } }));
    });
    const toc = within(editor).getByRole("group", { name: "Table of contents" });
    expect(within(toc).getAllByRole("button").map((entry) => entry.textContent)).toEqual(["Store reset1, page 1", "Paint2, page 2"]);
  });
});

describe("footnotes", () => {
  const NOTE = '<p>Primer<sup data-footnote="Per the label on the can.">*</sup> then paint<sup data-footnote="Two coats.">*</sup>.</p>';

  it("numbers references live, shows their text and lists them at the end", async () => {
    const { editor, view } = await setup({ defaultValue: NOTE });
    const references = () => [...editor.querySelectorAll("sup[data-footnote] button")].map((button) => button.textContent);
    expect(references()).toEqual(["1", "2"]);
    const first = within(editor).getByRole("button", { name: "Footnote 1" });
    expect(document.getElementById(first.getAttribute("aria-describedby")!)?.textContent).toBe("Per the label on the can.");
    const list = within(editor).getByRole("group", { name: "Footnotes" });
    expect(within(list).getAllByRole("button").map((entry) => entry.textContent)).toEqual(["1.Per the label on the can.", "2.Two coats."]);

    act(() => {
      view().dispatch(view().state.tr.insert(1, htmlSchema.nodes.footnote!.create({ text: "New first" })));
    });
    expect(references()).toEqual(["1", "2", "3"]);
    expect(within(editor).getByRole("button", { name: "Footnote 2" }).closest("sup")?.querySelector("[role=tooltip]")?.textContent).toBe("Per the label on the can.");
    expect(within(within(editor).getByRole("group", { name: "Footnotes" })).getAllByRole("button")[0]!.textContent).toBe("1.New first");
  });

  it("inserts a footnote with Ctrl+Alt+F, saves it as one undo step and continues after it", async () => {
    const { editor, ref, view, select } = await setup({ defaultValue: "<p>Primer then paint</p>" });
    select(7);
    fireEvent.keyDown(editor, { key: "f", keyCode: 70, ctrlKey: true, altKey: true });
    const popup = await screen.findByRole("dialog", { name: "Footnote 1" });
    const field = within(popup).getByRole("textbox", { name: "Footnote text" });
    await waitFor(() => expect(document.activeElement).toBe(field));
    fireEvent.change(field, { target: { value: "  Per the label.  " } });
    fireEvent.click(within(popup).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(ref.current!.getHTML()).toContain('<p>Primer<sup data-footnote="Per the label." id="fnref-1"><a href="#fn-1">1</a></sup> then paint</p>');
    expect(view().state.selection.from).toBe(8);
    expect(screen.getByRole("status").textContent).toBe("Footnote 1 saved");
    act(() => {
      undo(view().state, view().dispatch);
    });
    expect(ref.current!.getHTML()).toBe("<p>Primer then paint</p>");
    act(() => {
      redo(view().state, view().dispatch);
    });
    expect(ref.current!.getHTML()).toContain('data-footnote="Per the label."');
  });

  it("removes a new footnote that closes empty without leaving an undo step", async () => {
    const { ref, view, select } = await setup({ defaultValue: "<p>Primer then paint</p>" });
    select(7);
    const depth = undoDepth(view().state);
    fireEvent.click(screen.getByRole("button", { name: "Insert footnote" }));
    const popup = await screen.findByRole("dialog", { name: "Footnote 1" });
    fireEvent.keyDown(within(popup).getByRole("textbox", { name: "Footnote text" }), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(ref.current!.getHTML()).toBe("<p>Primer then paint</p>");
    expect(undoDepth(view().state)).toBe(depth);
  });

  it("edits, cancels and deletes an existing footnote from its reference or the list", async () => {
    const { editor, ref } = await setup({ defaultValue: NOTE });
    fireEvent.click(within(editor).getByRole("button", { name: "Footnote 2" }));
    let popup = await screen.findByRole("dialog", { name: "Footnote 2" });
    const field = within(popup).getByRole("textbox", { name: "Footnote text" }) as HTMLTextAreaElement;
    expect(field.value).toBe("Two coats.");
    fireEvent.change(field, { target: { value: "Changed" } });
    fireEvent.click(within(popup).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(ref.current!.getHTML()).toContain('data-footnote="Two coats."');

    const list = within(editor).getByRole("group", { name: "Footnotes" });
    fireEvent.click(within(list).getAllByRole("button")[0]!);
    popup = await screen.findByRole("dialog", { name: "Footnote 1" });
    fireEvent.click(within(popup).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(ref.current!.getHTML()).not.toContain("Per the label");
    expect(screen.getByRole("status").textContent).toBe("Footnote 1 removed");
    expect(within(editor).getByRole("button", { name: "Footnote 1" })).toBeTruthy();
  });

  it("opens the editor with Enter on a selected footnote and keeps viewing in read-only editors", async () => {
    const { editor, view } = await setup({ defaultValue: NOTE });
    act(() => {
      view().focus();
      view().dispatch(view().state.tr.setSelection(NodeSelection.create(view().state.doc, 7)));
    });
    fireEvent.keyDown(editor, { key: "Enter", keyCode: 13 });
    expect(await screen.findByRole("dialog", { name: "Footnote 1" })).toBeTruthy();
  });

  it("shows footnotes without editing in read-only editors", async () => {
    const { editor } = await setup({ defaultValue: NOTE, readOnly: true });
    fireEvent.click(within(editor).getByRole("button", { name: "Footnote 1" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    const list = within(editor).getByRole("group", { name: "Footnotes" });
    expect(within(list).queryAllByRole("button")).toHaveLength(0);
    expect(list.textContent).toContain("Per the label on the can.");
  });
});
