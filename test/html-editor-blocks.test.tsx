// packages/ai-ui/test/html-editor-blocks.test.tsx
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { EditorState, NodeSelection, TextSelection, type Transaction } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { BLOCK_SLASH_ITEMS } from "../src/components/html-editor-blocks.js";
import type { HtmlSlashItem } from "../src/components/html-editor-extension.js";
import { type HtmlEditorHandle, HtmlEditorView, type HtmlEditorViewProps } from "../src/components/html-editor-view.js";
import {
  blocksKey,
  blocksPlugin,
  type BlocksPluginOptions,
  currentTurnInto,
  deleteBlock,
  duplicateBlock,
  filterSlashItems,
  insertDivider,
  insertSlashParagraph,
  insertTableBlock,
  moveBlock,
  moveBlockTo,
  moveCurrentBlock,
  selectBlockContent,
  slashMatches,
  topLevelBlock,
  turnInto,
  type TurnIntoKind,
} from "../src/lib/rich-text/html-blocks.js";
import { docToHtml, htmlToDoc } from "../src/lib/rich-text/html.js";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function options(overrides: Partial<BlocksPluginOptions> = {}): BlocksPluginOptions {
  return {
    slashMenu: () => true,
    blockHandles: () => true,
    bubbleToolbar: () => true,
    items: () => BLOCK_SLASH_ITEMS,
    listboxId: "slash",
    openBlockMenu: vi.fn(() => true),
    focusBubble: vi.fn(() => true),
    announce: vi.fn(),
    ...overrides,
  };
}

function makeView(html: string, pluginOptions = options()) {
  const view = new EditorView(document.createElement("div"), { state: EditorState.create({ doc: htmlToDoc(html), plugins: [blocksPlugin(pluginOptions)] }) });
  const type = (text: string) => {
    for (const char of text) view.dispatch(view.state.tr.insertText(char));
  };
  const press = (key: string, init: KeyboardEventInit = {}) => view.someProp("handleKeyDown", (handle) => handle(view, new KeyboardEvent("keydown", { key, ...init }))) ?? false;
  const cursor = (pos: number, to = pos) => view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos, to)));
  const slash = () => blocksKey.getState(view.state)?.slash ?? null;
  return { view, type, press, cursor, slash, html: () => docToHtml(view.state.doc) };
}

/** Applies a command to a fresh state with the cursor (or selection) at the given positions and returns the resulting state. */
function apply(html: string, command: (state: EditorState, dispatch: (tr: Transaction) => void) => unknown, from: number, to = from) {
  const doc = htmlToDoc(html);
  let state = EditorState.create({ doc, selection: TextSelection.create(doc, from, to) });
  const result = command(state, (tr) => {
    state = state.apply(tr);
  });
  return { state, result, html: docToHtml(state.doc) };
}

const turn = (html: string, kind: TurnIntoKind, from: number, to = from) => apply(html, turnInto(kind), from, to);

/* ------------------------------------------------------------------ */
/* Slash menu filtering                                                */
/* ------------------------------------------------------------------ */

describe("slash items", () => {
  const labels = (items: HtmlSlashItem[]) => items.map((item) => item.label);

  it("matches labels, word starts and keywords, best first", () => {
    expect(labels(filterSlashItems(BLOCK_SLASH_ITEMS, "h1"))).toEqual(["Heading 1"]);
    expect(labels(filterSlashItems(BLOCK_SLASH_ITEMS, "head 2"))).toEqual(["Heading 2"]);
    expect(labels(filterSlashItems(BLOCK_SLASH_ITEMS, "todo"))).toEqual(["To-do list"]);
    expect(labels(filterSlashItems(BLOCK_SLASH_ITEMS, "list"))).toEqual(["Bulleted list", "Numbered list", "To-do list"]);
    expect(labels(filterSlashItems(BLOCK_SLASH_ITEMS, "  YouTube "))).toEqual(["Video"]);
    expect(filterSlashItems(BLOCK_SLASH_ITEMS, "zzz")).toEqual([]);
  });

  it("keeps groups together in the order they first appear among the matches", () => {
    const item = (id: string, label: string, group: string, keywords: string[] = []): HtmlSlashItem => ({ id, label, group, keywords, run: () => undefined });
    const items = [item("a", "Callout", "Layout"), item("b", "Code", "Basic blocks"), item("c", "Columns", "Layout"), item("d", "Comment", "Review", ["note"])];
    expect(labels(filterSlashItems(items, ""))).toEqual(["Callout", "Columns", "Code", "Comment"]);
    expect(labels(filterSlashItems(items, "co"))).toEqual(["Code", "Columns", "Comment"]);
    expect(labels(filterSlashItems(items, "note"))).toEqual(["Comment"]);
  });

  it("offers text, headings, lists, quote and code under Turn into", () => {
    expect(BLOCK_SLASH_ITEMS.filter((entry) => entry.turnInto).map((entry) => entry.id)).toEqual(["text", "heading-1", "heading-2", "heading-3", "bulleted-list", "numbered-list", "to-do-list", "quote", "code-block"]);
    expect(new Set(BLOCK_SLASH_ITEMS.map((entry) => entry.group))).toEqual(new Set(["Basic blocks", "Media"]));
  });
});

/* ------------------------------------------------------------------ */
/* Slash plugin                                                        */
/* ------------------------------------------------------------------ */

describe("slash plugin", () => {
  it("opens on a slash typed at the start of a line or after a space and filters as you type", () => {
    const { view, type, cursor, slash } = makeView("<p>Restock</p><p></p>");
    cursor(8);
    type(" /");
    expect(slash()).toEqual({ from: 9, query: "", index: 0 });
    expect(view.dom.getAttribute("aria-controls")).toBe("slash");
    expect(view.dom.getAttribute("aria-activedescendant")).toBe("slash-0");
    type("he");
    expect(slash()?.query).toBe("he");
    expect(slashMatches(view.state, BLOCK_SLASH_ITEMS)?.matches.map((item) => item.label)).toEqual(["Heading 1", "Heading 2", "Heading 3"]);
    expect(view.dom.querySelector(".bg-accent")?.textContent).toBe("/he");

    cursor(14);
    type("/");
    expect(slash()).toEqual({ from: 14, query: "", index: 0 });
  });

  it("ignores slashes inside words, in code blocks, in figure captions and in pastes, and when turned off", () => {
    const words = makeView("<p>and</p>");
    words.cursor(4);
    words.type("/or");
    expect(words.slash()).toBeNull();

    const code = makeView("<pre><code>x</code></pre>");
    code.cursor(2);
    code.type(" /");
    expect(code.slash()).toBeNull();

    const caption = makeView('<figure><img src="https://example.com/saw.jpg" alt="Saw"><figcaption>Saw</figcaption></figure>');
    caption.cursor(4);
    caption.type(" /");
    expect(caption.slash()).toBeNull();

    const paste = makeView("<p></p>");
    paste.view.dispatch(paste.view.state.tr.insertText("/").setMeta("uiEvent", "paste"));
    expect(paste.slash()).toBeNull();

    const off = makeView("<p></p>", options({ slashMenu: () => false }));
    off.type("/");
    expect(off.slash()).toBeNull();
    expect(off.view.dom.hasAttribute("aria-activedescendant")).toBe(false);
  });

  it("moves with the arrow keys, closes on Escape keeping the text, and closes when the slash is deleted or the cursor leaves", () => {
    const { view, type, press, cursor, slash, html } = makeView("<p>Aisle 4</p><p></p>");
    cursor(10);
    type("/");
    expect(press("ArrowDown")).toBe(true);
    expect(press("ArrowDown")).toBe(true);
    expect(slash()?.index).toBe(2);
    expect(view.dom.getAttribute("aria-activedescendant")).toBe("slash-2");
    expect(press("ArrowUp")).toBe(true);
    expect(slash()?.index).toBe(1);
    type("b");
    expect(slash()?.index).toBe(0);
    expect(press("Escape")).toBe(true);
    expect(slash()).toBeNull();
    expect(html()).toBe("<p>Aisle 4</p><p>/b</p>");
    expect(press("ArrowDown")).toBe(false);

    type(" /");
    expect(slash()).not.toBeNull();
    view.dispatch(view.state.tr.delete(view.state.selection.from - 1, view.state.selection.from));
    expect(slash()).toBeNull();

    type("/");
    expect(slash()).not.toBeNull();
    cursor(3);
    expect(slash()).toBeNull();
  });

  it("stays open but lets keys through while nothing matches, and closes once a space follows a query with no matches", () => {
    const { type, press, slash } = makeView("<p></p>");
    type("/zz");
    expect(slash()?.query).toBe("zz");
    expect(press("ArrowDown")).toBe(false);
    expect(press("Escape")).toBe(false);
    type(" ");
    expect(slash()).toBeNull();
    type("/ ");
    expect(slash()).toBeNull();
  });

  it("removes the query and runs the active item with Enter or Tab", () => {
    const heading = makeView("<p>Spring sale</p><p></p>");
    heading.cursor(14);
    heading.type("/h2");
    expect(heading.press("Enter")).toBe(true);
    expect(heading.slash()).toBeNull();
    expect(heading.view.state.doc.child(1).type.name).toBe("heading");
    expect(heading.view.state.doc.child(1).attrs.level).toBe(2);
    expect(heading.view.state.doc.child(1).textContent).toBe("");

    const table = makeView("<p>Prices</p><p></p>");
    table.cursor(9);
    table.type("/tab");
    expect(table.press("Tab")).toBe(true);
    expect(table.html()).toMatch(/^<p>Prices<\/p><table><tbody><tr><th><p><\/p><\/th>/);
    expect(table.view.state.selection.$from.parent.type.name).toBe("paragraph");
    expect(table.view.state.selection.$from.node(-1).type.name).toBe("table_header");

    const list = makeView("<p>Brushes</p>");
    list.cursor(8);
    list.type(" /num");
    list.press("Enter");
    expect(list.html()).toBe("<ol><li><p>Brushes </p></li></ol>");
  });

  it("handles Ctrl+/, Alt+Shift+Arrow keys and Alt+F10 only while their features are on", () => {
    const pluginOptions = options();
    const { press, cursor, html } = makeView("<p>A</p><p>B</p><p>C</p>", pluginOptions);
    cursor(4);
    expect(press("/", { ctrlKey: true })).toBe(true);
    expect(pluginOptions.openBlockMenu).toHaveBeenCalledWith(3);
    expect(press("ArrowDown", { altKey: true, shiftKey: true })).toBe(true);
    expect(html()).toBe("<p>A</p><p>C</p><p>B</p>");
    expect(pluginOptions.announce).toHaveBeenLastCalledWith("Moved block down");
    expect(press("ArrowDown", { altKey: true, shiftKey: true })).toBe(true);
    expect(pluginOptions.announce).toHaveBeenLastCalledWith("Already at the bottom");
    expect(press("F10", { altKey: true })).toBe(true);
    expect(pluginOptions.focusBubble).toHaveBeenCalledTimes(1);

    const off = makeView("<p>A</p><p>B</p>", options({ blockHandles: () => false, bubbleToolbar: () => false }));
    off.cursor(4);
    expect(off.press("/", { ctrlKey: true })).toBe(false);
    expect(off.press("ArrowUp", { altKey: true, shiftKey: true })).toBe(false);
    expect(off.press("F10", { altKey: true })).toBe(false);
    expect(off.html()).toBe("<p>A</p><p>B</p>");
  });

  it("shows a hint in an empty line holding the cursor while focused, and fades the dragged block", () => {
    const { view, cursor } = makeView("<p>Intro</p><p></p>", options({ hint: "Type / for blocks" }));
    cursor(8);
    view.dispatch(view.state.tr.setMeta(blocksKey, { type: "focus", focused: true }));
    expect(view.dom.querySelector("p.is-empty")?.getAttribute("data-placeholder")).toBe("Type / for blocks");
    view.dispatch(view.state.tr.setMeta(blocksKey, { type: "focus", focused: false }));
    expect(view.dom.querySelector("p.is-empty")).toBeNull();
    view.dispatch(view.state.tr.setMeta(blocksKey, { type: "drag", pos: 0 }));
    expect(view.dom.firstElementChild?.classList.contains("opacity-40")).toBe(true);
    view.dispatch(view.state.tr.setMeta(blocksKey, { type: "drag", pos: null }));
    expect(view.dom.querySelector(".opacity-40")).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Turn into                                                           */
/* ------------------------------------------------------------------ */

describe("turn into", () => {
  it("converts paragraphs and headings, keeping alignment and indent", () => {
    expect(turn('<p style="text-align: center; margin-left: 40px">Hours</p>', "heading2", 2).html).toBe('<h2 style="text-align: center; margin-left: 40px;">Hours</h2>');
    expect(turn("<h1>Hours</h1>", "paragraph", 2).html).toBe("<p>Hours</p>");
    expect(turn("<p>npm run build</p>", "code", 2).html).toBe("<pre><code>npm run build</code></pre>");
    expect(turn("<p>Measure twice</p>", "quote", 2).html).toBe("<blockquote><p>Measure twice</p></blockquote>");
  });

  it("wraps text in lists, converts lists in place and unwraps them", () => {
    expect(turn("<p>Caulk</p>", "bullet", 2).html).toBe("<ul><li><p>Caulk</p></li></ul>");
    expect(turn("<h2>Caulk</h2>", "ordered", 2).html).toBe("<ol><li><p>Caulk</p></li></ol>");
    expect(turn("<ul><li><p>One</p></li><li><p>Two</p></li></ul>", "task", 3).html).toBe('<ul data-type="task-list"><li data-type="task-item" data-checked="false"><p>One</p></li><li data-type="task-item" data-checked="false"><p>Two</p></li></ul>');
    expect(turn("<ul><li><p>One</p></li><li><p>Two</p></li></ul>", "paragraph", 10).html).toBe("<ul><li><p>One</p></li></ul><p>Two</p>");
    expect(turn("<ul><li><p>One</p></li><li><p>Two</p></li></ul>", "heading1", 3, 10).html).toBe("<h1>One</h1><h1>Two</h1>");
    expect(turn("<ul><li><p>Gloves</p></li></ul>", "quote", 4).html).toBe("<blockquote><p>Gloves</p></blockquote>");
    expect(turn("<blockquote><p>Quote</p></blockquote>", "heading1", 3).html).toBe("<h1>Quote</h1>");
  });

  it("reports the current kind, treats the same kind as done and leaves captions alone", () => {
    const kind = (html: string, pos: number) => currentTurnInto(EditorState.create({ doc: htmlToDoc(html), selection: TextSelection.create(htmlToDoc(html), pos) }));
    expect(kind("<h3>x</h3>", 1)).toBe("heading3");
    expect(kind("<h4>x</h4>", 1)).toBeNull();
    expect(kind("<ol><li><p>x</p></li></ol>", 3)).toBe("ordered");
    expect(kind("<blockquote><p>x</p></blockquote>", 2)).toBe("quote");
    expect(kind("<table><tr><td><p>x</p></td></tr></table>", 4)).toBe("paragraph");
    const same = turn("<h2>Hours</h2>", "heading2", 2);
    expect(same.result).toBe(true);
    expect(same.html).toBe("<h2>Hours</h2>");
    const caption = turn('<figure><img src="https://example.com/saw.jpg" alt="Saw"><figcaption>Saw</figcaption></figure>', "heading1", 2);
    expect(caption.result).toBe(false);
    expect(caption.html).toContain("<figure");
  });
});

/* ------------------------------------------------------------------ */
/* Block commands                                                      */
/* ------------------------------------------------------------------ */

describe("block commands", () => {
  const three = "<p>A</p><p>B</p><p>C</p>";

  it("finds the top-level block around a position", () => {
    const doc = htmlToDoc("<p>A</p><ul><li><p>B</p></li></ul>");
    expect(topLevelBlock(doc, 1)).toMatchObject({ pos: 0, index: 0 });
    expect(topLevelBlock(doc, 6)?.node.type.name).toBe("bullet_list");
    expect(topLevelBlock(doc, 3)).toMatchObject({ pos: 3, index: 1 });
    expect(topLevelBlock(doc, doc.content.size)).toMatchObject({ pos: 3, index: 1 });
  });

  it("moves blocks up, down and to any gap, keeping the cursor in the moved block", () => {
    const up = apply(three, moveBlock(3, -1), 5);
    expect(up.html).toBe("<p>B</p><p>A</p><p>C</p>");
    expect(up.state.selection.$from.parent.textContent).toBe("B");
    expect(up.state.selection.from).toBe(2);
    expect(apply(three, moveBlock(3, 1), 5).html).toBe("<p>A</p><p>C</p><p>B</p>");
    expect(apply(three, moveBlock(0, -1), 1).result).toBe(false);
    const end = apply(three, moveBlockTo(0, 3), 1);
    expect(end.html).toBe("<p>B</p><p>C</p><p>A</p>");
    expect(end.state.selection.$from.parent.textContent).toBe("A");
    expect(apply(three, moveBlockTo(6, 0), 2).html).toBe("<p>C</p><p>A</p><p>B</p>");
    expect(apply(three, moveBlockTo(3, 2), 5).result).toBe(false);
  });

  it("moves a list item among its siblings from the keyboard and stops at the list's edge", () => {
    const html = "<ul><li><p>One</p></li><li><p>Two</p></li></ul><p>After</p>";
    const moved = apply(html, moveCurrentBlock(-1), 11);
    expect(moved.result).toBe("item");
    expect(moved.html).toBe("<ul><li><p>Two</p></li><li><p>One</p></li></ul><p>After</p>");
    expect(moved.state.selection.$from.parent.textContent).toBe("Two");
    expect(apply(html, moveCurrentBlock(-1), 3).result).toBe(false);
    expect(apply(html, moveCurrentBlock(-1), 20).html).toBe("<p>After</p><ul><li><p>One</p></li><li><p>Two</p></li></ul>");
  });

  it("keeps a selected block selected when it moves", () => {
    const doc = htmlToDoc("<p>A</p><hr><p>C</p>");
    let state = EditorState.create({ doc, selection: NodeSelection.create(doc, 3) });
    moveBlock(3, -1)(state, (tr) => {
      state = state.apply(tr);
    });
    expect(state.selection).toBeInstanceOf(NodeSelection);
    expect((state.selection as NodeSelection).node.type.name).toBe("horizontal_rule");
    expect(state.selection.from).toBe(0);
  });

  it("duplicates a block without its comment anchors and deletes blocks", () => {
    const copy = apply('<p><span data-comment-id="c1">Bolts</span></p><p>Nuts</p>', duplicateBlock(0), 3);
    expect(copy.html).toBe('<p><span data-comment-id="c1">Bolts</span></p><p>Bolts</p><p>Nuts</p>');
    expect(copy.state.selection.from).toBe(10);
    expect(apply(three, deleteBlock(3), 4).html).toBe("<p>A</p><p>C</p>");
    const last = apply("<h2>Only</h2>", deleteBlock(0), 2);
    expect(last.state.doc.childCount).toBe(1);
    expect(last.state.doc.firstChild?.type.name).toBe("paragraph");
    expect(last.state.doc.firstChild?.content.size).toBe(0);
  });

  it("inserts a paragraph with an open slash menu below a block, or reuses an empty one", () => {
    const { view, slash, html } = makeView("<h2>Title</h2><p></p>");
    insertSlashParagraph(0)(view.state, view.dispatch);
    expect(html()).toBe("<h2>Title</h2><p>/</p><p></p>");
    expect(slash()).toEqual({ from: 8, query: "", index: 0 });
    expect(view.state.selection.from).toBe(9);

    const empty = makeView("<p>Intro</p><p></p>");
    insertSlashParagraph(7)(empty.view.state, empty.view.dispatch);
    expect(empty.html()).toBe("<p>Intro</p><p>/</p>");
    insertSlashParagraph(0, "above")(empty.view.state, empty.view.dispatch);
    expect(empty.html()).toBe("<p>/</p><p>Intro</p><p>/</p>");
  });

  it("inserts dividers and tables in place of an empty paragraph", () => {
    const divider = apply("<p>Top</p><p></p>", insertDivider, 6);
    expect(divider.html).toBe("<p>Top</p><hr><p></p>");
    expect(divider.state.selection.$from.parent.type.name).toBe("paragraph");
    expect(divider.state.selection.from).toBe(7);
    expect(apply("<p>Left right</p>", insertDivider, 5).html).toBe("<p>Left</p><hr><p> right</p>");
    const table = apply("<p></p>", insertTableBlock(2, 2), 1);
    expect(table.html).toBe("<table><tbody><tr><th><p></p></th><th><p></p></th></tr><tr><td><p></p></td><td><p></p></td></tr></tbody></table><p></p>");
    expect(table.state.selection.from).toBe(4);
  });

  it("selects all the text in a block", () => {
    const list = apply("<p>x</p><ul><li><p>One</p></li><li><p>Two</p></li></ul>", selectBlockContent(3), 1);
    expect(list.state.selection.from).toBe(6);
    expect(list.state.selection.to).toBe(16);
    expect(apply("<p>x</p><hr><p>y</p>", selectBlockContent(3), 1).result).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* In HtmlEditorView                                                   */
/* ------------------------------------------------------------------ */

async function setup(props: Partial<HtmlEditorViewProps> = {}) {
  const ref = createRef<HtmlEditorHandle>();
  render(<HtmlEditorView ref={ref} defaultValue="<h2>Paint aisle</h2><p>Restock brushes.</p>" {...props} />);
  const editor = await screen.findByRole("textbox", { name: "Document" });
  const view = () => ref.current!.getView()!;
  const focus = async () => {
    act(() => view().focus());
    await act(async () => undefined);
  };
  const select = (from: number, to = from) => act(() => view().dispatch(view().state.tr.setSelection(TextSelection.create(view().state.doc, from, to))));
  const type = (text: string) =>
    act(() => {
      for (const char of text) view().dispatch(view().state.tr.insertText(char));
    });
  return { ref, editor, view, focus, select, type };
}

describe("HtmlEditorView blocks", () => {
  it("shows the slash menu as a grouped listbox tied to the editor, and runs an item from the keyboard", async () => {
    const { ref, editor, focus, select, type } = await setup();
    await focus();
    select(30);
    type(" /");
    const listbox = screen.getByRole("listbox", { name: "Insert block" });
    expect(within(listbox).getByRole("group", { name: "Basic blocks" })).toBeTruthy();
    expect(within(listbox).getByRole("group", { name: "Media" })).toBeTruthy();
    const first = within(listbox).getAllByRole("option")[0]!;
    expect(first.getAttribute("aria-selected")).toBe("true");
    expect(editor.getAttribute("aria-activedescendant")).toBe(first.id);
    expect(editor.getAttribute("aria-controls")).toBe(listbox.id);

    type("num");
    expect(within(listbox).getAllByRole("option").map((option) => option.textContent)).toEqual(["Numbered listList with numbers"]);
    fireEvent.keyDown(editor, { key: "Enter" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(ref.current!.getHTML()).toBe("<h2>Paint aisle</h2><ol><li><p>Restock brushes. </p></li></ol>");
  });

  it("closes the slash menu on Escape and runs items clicked with the pointer", async () => {
    const { ref, editor, focus, select, type } = await setup();
    await focus();
    select(30);
    type(" /");
    fireEvent.keyDown(editor, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(ref.current!.getHTML()).toBe("<h2>Paint aisle</h2><p>Restock brushes. /</p>");
    type(" /quo");
    fireEvent.click(screen.getByRole("option", { name: /Quote/ }));
    expect(ref.current!.getHTML()).toBe("<h2>Paint aisle</h2><blockquote><p>Restock brushes. / </p></blockquote>");
  });

  it("floats a formatting toolbar over selected text that Alt+F10 focuses and Escape leaves", async () => {
    const { ref, editor, focus, select } = await setup();
    expect(screen.queryByRole("toolbar", { name: "Format selection" })).toBeNull();
    await focus();
    select(14, 21);
    const bubble = screen.getByRole("toolbar", { name: "Format selection" });
    expect(within(bubble).getByRole("button", { name: "Turn into: Text" })).toBeTruthy();
    fireEvent.click(within(bubble).getByRole("button", { name: "Bold" }));
    expect(ref.current!.getHTML()).toBe("<h2>Paint aisle</h2><p><strong>Restock</strong> brushes.</p>");
    expect(within(bubble).getByRole("button", { name: "Bold" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.keyDown(editor, { key: "F10", altKey: true });
    expect(document.activeElement).toBe(within(bubble).getByRole("button", { name: "Bold" }));
    await act(async () => undefined);
    expect(screen.getByRole("toolbar", { name: "Format selection" })).toBe(bubble);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(document.activeElement).toBe(editor);
    await act(async () => undefined);
    expect(screen.getByRole("toolbar", { name: "Format selection" })).toBeTruthy();

    select(16);
    expect(screen.queryByRole("toolbar", { name: "Format selection" })).toBeNull();
  });

  it("keeps the selection toolbar open in its own Turn into menu but hides it when another feature's popup takes focus", async () => {
    const { ref, editor, focus, select } = await setup();
    await focus();
    select(14, 21);
    const bubble = screen.getByRole("toolbar", { name: "Format selection" });
    fireEvent.click(within(bubble).getByRole("button", { name: "Turn into: Text" }));
    const menu = await screen.findByRole("menu", { name: "Turn into" });
    await waitFor(() => expect(menu.contains(document.activeElement)).toBe(true));
    expect(screen.getByRole("toolbar", { name: "Format selection" })).toBe(bubble);
    fireEvent.click(within(menu).getByRole("menuitemradio", { name: "Heading 3" }));
    expect(ref.current!.getHTML()).toBe("<h2>Paint aisle</h2><h3>Restock brushes.</h3>");
    await waitFor(() => expect(document.activeElement).toBe(editor));
    expect(screen.getByRole("toolbar", { name: "Format selection" })).toBeTruthy();

    const foreign = document.createElement("div");
    foreign.setAttribute("role", "dialog");
    foreign.innerHTML = '<input aria-label="Comment">';
    document.body.append(foreign);
    act(() => foreign.querySelector("input")!.focus());
    expect(screen.queryByRole("toolbar", { name: "Format selection" })).toBeNull();
    await focus();
    expect(screen.getByRole("toolbar", { name: "Format selection" })).toBeTruthy();
    foreign.remove();
  });

  it("keeps the selection toolbar away from code blocks, node selections and pointer drags", async () => {
    const { view, editor, focus, select } = await setup({ defaultValue: "<pre><code>let x = 1;</code></pre><p>Hammer</p><hr>" });
    await focus();
    select(2, 6);
    expect(screen.queryByRole("toolbar", { name: "Format selection" })).toBeNull();
    act(() => view().dispatch(view().state.tr.setSelection(NodeSelection.create(view().state.doc, 20))));
    expect(screen.queryByRole("toolbar", { name: "Format selection" })).toBeNull();
    fireEvent.pointerDown(editor, { button: 0 });
    select(13, 19);
    expect(screen.queryByRole("toolbar", { name: "Format selection" })).toBeNull();
    fireEvent.pointerUp(window);
    expect(screen.getByRole("toolbar", { name: "Format selection" })).toBeTruthy();
  });

  it("shows block handles for the cursor's block, adds a block with the slash menu open and opens the block menu with Ctrl+/", async () => {
    const onValueChange = vi.fn();
    const { editor, focus, select } = await setup({ onValueChange });
    expect(screen.queryByRole("button", { name: "Block actions" })).toBeNull();
    await focus();
    select(16);
    expect(screen.getByRole("button", { name: "Block actions" }).getAttribute("aria-haspopup")).toBe("menu");
    expect(editor.closest("[data-theme]")?.className).toContain("[&>.ProseMirror]:pl-16");

    fireEvent.click(screen.getByRole("button", { name: "Add block below" }));
    expect(onValueChange).toHaveBeenLastCalledWith("<h2>Paint aisle</h2><p>Restock brushes.</p><p>/</p>");
    expect(screen.getByRole("listbox", { name: "Insert block" })).toBeTruthy();

    select(16);
    fireEvent.keyDown(editor, { key: "/", ctrlKey: true });
    const menu = await screen.findByRole("menu", { name: "Block actions" });
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Turn into", "Duplicate", "Move upAlt+Shift+↑", "Move downAlt+Shift+↓", "Delete"]);
    fireEvent.click(within(menu).getByRole("menuitem", { name: /Move up/ }));
    expect(onValueChange).toHaveBeenLastCalledWith("<p>Restock brushes.</p><h2>Paint aisle</h2><p>/</p>");
    expect(screen.getByRole("status").textContent).toBe("Moved block up");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("moves, duplicates, deletes and converts blocks from the menu and the keyboard", async () => {
    const { ref, editor, focus, select } = await setup();
    await focus();
    select(3);
    fireEvent.keyDown(editor, { key: "ArrowDown", altKey: true, shiftKey: true });
    expect(ref.current!.getHTML()).toBe("<p>Restock brushes.</p><h2>Paint aisle</h2>");
    expect(screen.getByRole("status").textContent).toBe("Moved block down");

    fireEvent.click(screen.getByRole("button", { name: "Block actions" }));
    fireEvent.click(within(await screen.findByRole("menu", { name: "Block actions" })).getByRole("menuitem", { name: "Duplicate" }));
    expect(ref.current!.getHTML()).toBe("<p>Restock brushes.</p><h2>Paint aisle</h2><h2>Paint aisle</h2>");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

    fireEvent.keyDown(editor, { key: "/", ctrlKey: true });
    fireEvent.click(within(await screen.findByRole("menu", { name: "Block actions" })).getByRole("menuitem", { name: "Delete" }));
    expect(ref.current!.getHTML()).toBe("<p>Restock brushes.</p><h2>Paint aisle</h2>");
    expect(screen.getByRole("status").textContent).toBe("Deleted block");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

    select(3);
    fireEvent.keyDown(editor, { key: "/", ctrlKey: true });
    fireEvent.click(within(await screen.findByRole("menu", { name: "Block actions" })).getByRole("menuitem", { name: "Turn into" }));
    const submenu = await screen.findByRole("menu", { name: "Turn into" });
    expect(within(submenu).getByRole("menuitemradio", { name: "Text" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(within(submenu).getByRole("menuitemradio", { name: "Bulleted list" }));
    expect(ref.current!.getHTML()).toBe("<ul><li><p>Restock brushes.</p></li></ul><h2>Paint aisle</h2>");
    expect(screen.getByRole("status").textContent).toBe("Turned into Bulleted list");
  });

  it("drags a block by its handle to the gap under the pointer, and Escape cancels", async () => {
    const { ref, view, focus, select } = await setup({ defaultValue: "<p>One</p><p>Two</p><p>Three</p>" });
    await focus();
    select(2);
    view().state.doc.forEach((_node, pos, index) => {
      const dom = view().nodeDOM(pos) as HTMLElement;
      dom.getBoundingClientRect = () => new DOMRect(64, 100 + index * 40, 500, 28);
    });
    const grip = screen.getByRole("button", { name: "Block actions" });
    fireEvent.pointerDown(grip, { button: 0, pointerId: 1, clientX: 40, clientY: 110 });
    fireEvent.pointerMove(grip, { pointerId: 1, clientX: 40, clientY: 200 });
    expect(view().dom.firstElementChild?.classList.contains("opacity-40")).toBe(true);
    const line = document.querySelector<HTMLElement>("[data-blocks-handles] ~ div[aria-hidden]")!;
    expect(line.hidden).toBe(false);
    fireEvent.pointerUp(grip, { pointerId: 1, clientX: 40, clientY: 200 });
    fireEvent.click(grip);
    expect(ref.current!.getHTML()).toBe("<p>Two</p><p>Three</p><p>One</p>");
    expect(screen.getByRole("status").textContent).toBe("Moved block down");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(view().dom.querySelector(".opacity-40")).toBeNull();

    select(2);
    view().state.doc.forEach((_node, pos, index) => {
      (view().nodeDOM(pos) as HTMLElement).getBoundingClientRect = () => new DOMRect(64, 100 + index * 40, 500, 28);
    });
    fireEvent.pointerDown(grip, { button: 0, pointerId: 2, clientX: 40, clientY: 110 });
    fireEvent.pointerMove(grip, { pointerId: 2, clientX: 40, clientY: 200 });
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerUp(grip, { pointerId: 2, clientX: 40, clientY: 200 });
    expect(ref.current!.getHTML()).toBe("<p>Two</p><p>Three</p><p>One</p>");
    expect(screen.getByRole("status").textContent).toBe("Move canceled");
  });

  it("renders no editing UI when compact, read-only or switched off", async () => {
    const compact = await setup({ compact: true });
    await compact.focus();
    compact.select(14, 21);
    compact.type(" /");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.queryByRole("toolbar", { name: "Format selection" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Block actions" })).toBeNull();
    expect(compact.editor.closest("[data-theme]")?.className).not.toContain("pl-16");
    compact.ref.current!.setHTML("");
  });

  it("follows the slashMenu, bubbleToolbar and blockHandles props", async () => {
    const { editor, focus, select, type } = await setup({ slashMenu: false, bubbleToolbar: false, blockHandles: false });
    await focus();
    select(14, 21);
    expect(screen.queryByRole("toolbar", { name: "Format selection" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Block actions" })).toBeNull();
    select(30);
    type(" /");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(editor.closest("[data-theme]")?.className).not.toContain("pl-16");
  });

  it("hides everything in read-only mode", async () => {
    render(<HtmlEditorView defaultValue="<p>Locked</p>" readOnly aria-label="Notes" />);
    const editor = await screen.findByRole("textbox", { name: "Notes" });
    fireEvent.pointerMove(editor, { clientY: 10 });
    expect(screen.queryByRole("button", { name: "Block actions" })).toBeNull();
    expect(screen.queryByRole("toolbar", { name: "Format selection" })).toBeNull();
  });
});
