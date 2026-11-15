// packages/ai-ui/test/html-editor-review.test.tsx
import { joinBackward } from "prosemirror-commands";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { history, redo, undo } from "prosemirror-history";
import { Slice } from "prosemirror-model";
import { AllSelection, type Command, EditorState, TextSelection, type Transaction } from "prosemirror-state";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { type HtmlEditorHandle, HtmlEditorView, type HtmlEditorViewProps } from "../src/components/html-editor-view.js";
import type { RichTextComment } from "../src/components/rich-text-editor-view.js";
import { EXTERNAL_UPDATE } from "../src/components/rich-text-parts.js";
import { docToHtml, htmlToDoc } from "../src/lib/rich-text/html.js";
import {
  acceptAllChanges,
  acceptChange,
  acceptChanges,
  addComment,
  listChanges,
  rejectAllChanges,
  rejectChange,
  rejectChanges,
  removeComment,
  trackChangesKey,
  trackChangesPlugin,
  type TrackChangesMode,
} from "../src/lib/rich-text/html-review.js";

const DATE = "2026-10-25T12:00:00.000Z";
const ins = (id: string, text: string, author = "Dana") => `<ins data-change-id="${id}" data-author="${author}" data-date="${DATE}">${text}</ins>`;
const del = (id: string, text: string, author = "Dana") => `<del data-change-id="${id}" data-author="${author}" data-date="${DATE}">${text}</del>`;

function editor(html: string, { mode = "track" as TrackChangesMode, author = "Dana" } = {}) {
  let counter = 0;
  const settings = { mode, author };
  let state = EditorState.create({
    doc: htmlToDoc(html),
    plugins: [trackChangesPlugin({ mode: () => settings.mode, author: () => settings.author, now: () => new Date(DATE), createId: (prefix) => `${prefix}-${++counter}`, skip: (tr) => Boolean(tr.getMeta(EXTERNAL_UPDATE)) }), history()],
  });
  const apply = (tr: Transaction) => {
    state = state.apply(tr);
  };
  const api = {
    settings,
    get state() {
      return state;
    },
    html: () => docToHtml(state.doc),
    /** Position just after the nth (1-based) occurrence of `text`'s first character offset by `offset`. */
    pos: (text: string, offset = 0) => {
      let found = -1;
      state.doc.descendants((node, position) => {
        if (found >= 0) return false;
        if (node.isText) {
          const index = node.text!.indexOf(text);
          if (index >= 0) found = position + index + offset;
        }
        return true;
      });
      if (found < 0) throw new Error(`"${text}" not found`);
      return found;
    },
    select: (from: number, to = from) => apply(state.tr.setSelection(TextSelection.create(state.doc, from, to))),
    type: (text: string) => apply(state.tr.insertText(text)),
    backspace: () => {
      const { from, empty, $from } = state.selection;
      if (empty && $from.parentOffset === 0) joinBackward(state, apply);
      else apply(empty ? state.tr.delete(from - 1, from) : state.tr.deleteSelection());
    },
    forwardDelete: () => {
      const { from, empty } = state.selection;
      apply(empty ? state.tr.delete(from, from + 1) : state.tr.deleteSelection());
    },
    paste: (html: string) => {
      const doc = htmlToDoc(html);
      apply(state.tr.replaceSelection(new Slice(doc.content, 1, 1)).setMeta("uiEvent", "paste"));
    },
    run: (command: Command) => command(state, apply),
    apply,
  };
  return api;
}

describe("track changes plugin", () => {
  it("marks typed text as one insertion and continues it while typing", () => {
    const doc = editor("<p>Restock aisle 4</p>");
    doc.select(doc.pos("aisle"));
    doc.type("p");
    doc.type("aint ");
    expect(doc.html()).toBe(`<p>Restock ${ins("ins-1", "paint ")}aisle 4</p>`);
    expect(doc.state.selection.from).toBe(doc.pos("aisle"));
  });

  it("starts a new insertion away from the last one and for another author", () => {
    const doc = editor("<p>Restock aisle 4</p>");
    doc.select(doc.pos("aisle"));
    doc.type("paint ");
    doc.select(doc.pos("4", 1));
    doc.type("B");
    doc.settings.author = "Sam Whitten";
    doc.type("!");
    expect(doc.html()).toBe(`<p>Restock ${ins("ins-1", "paint ")}aisle 4${ins("ins-2", "B")}${ins("ins-3", "!", "Sam Whitten")}</p>`);
  });

  it("marks text deleted with Backspace instead of removing it and moves the caret before it", () => {
    const doc = editor("<p>Restock aisle 4</p>");
    doc.select(doc.pos(" 4"));
    doc.backspace();
    doc.backspace();
    expect(doc.html()).toBe(`<p>Restock ais${del("del-1", "le")} 4</p>`);
    expect(doc.state.selection.from).toBe(doc.pos("le"));
    doc.backspace();
    expect(doc.html()).toBe(`<p>Restock ai${del("del-1", "sle")} 4</p>`);
  });

  it("moves past deleted text with Delete and walks over text that is already deleted", () => {
    const doc = editor("<p>Restock aisle 4</p>");
    doc.select(doc.pos("aisle"));
    doc.forwardDelete();
    doc.forwardDelete();
    expect(doc.html()).toBe(`<p>Restock ${del("del-1", "ai")}sle 4</p>`);
    expect(doc.state.selection.from).toBe(doc.pos("sle"));
    doc.backspace();
    doc.backspace();
    expect(doc.html()).toBe(`<p>Restock ${del("del-1", "ai")}sle 4</p>`);
    expect(doc.state.selection.from).toBe(doc.pos("ai"));
  });

  it("removes your own pending insertion outright and marks someone else's as deleted", () => {
    const doc = editor(`<p>Order ${ins("theirs", "six", "Sam Whitten")} pallets</p>`);
    doc.select(doc.pos(" pallets"));
    doc.type("ty");
    expect(doc.html()).toBe(`<p>Order ${ins("theirs", "six", "Sam Whitten")}${ins("ins-1", "ty")} pallets</p>`);
    doc.backspace();
    doc.backspace();
    expect(doc.html()).toBe(`<p>Order ${ins("theirs", "six", "Sam Whitten")} pallets</p>`);
    doc.backspace();
    expect(doc.html()).toBe(`<p>Order ${ins("theirs", "si", "Sam Whitten")}${del("del-2", "x")} pallets</p>`);
  });

  it("deletes a selection as one deletion with the caret after it", () => {
    const doc = editor("<p>Fresh potting soil on aisle 9</p>");
    doc.select(doc.pos("potting"), doc.pos("soil"));
    doc.backspace();
    expect(doc.html()).toBe(`<p>Fresh ${del("del-1", "potting ")}soil on aisle 9</p>`);
    expect(doc.state.selection.from).toBe(doc.pos("soil"));
  });

  it("puts deleted text before the text typed over a selection", () => {
    const doc = editor("<p>Schedule two cashiers</p>");
    doc.select(doc.pos("two"), doc.pos(" cashiers"));
    doc.type("three");
    expect(doc.html()).toBe(`<p>Schedule ${del("del-2", "two")}${ins("ins-1", "three")} cashiers</p>`);
    expect(doc.state.selection.from).toBe(doc.pos(" cashiers"));
  });

  it("tracks a paste over a selection, including across paragraphs, and rejecting it restores the text", () => {
    const doc = editor("<p>Grills on the endcap</p><p>Seeds by the door</p>");
    doc.select(doc.pos("endcap"), doc.pos(" by"));
    doc.paste("<p>front</p><p>Hoses</p>");
    const html = doc.html();
    expect(html).toBe(`<p>Grills on the ${del("del-2", "endcap")}</p><p>${del("del-2", "Seeds")}${ins("ins-1", "front")}</p><p>${ins("ins-1", "Hoses")} by the door</p>`);
    expect(rejectAllChanges(html)).toBe("<p>Grills on the endcap</p><p>Seeds by the door</p>");
    expect(acceptAllChanges(html)).toBe("<p>Grills on the front</p><p>Hoses by the door</p>");
  });

  it("tracks cut like a deletion", () => {
    const doc = editor("<p>Paint and stain</p>");
    doc.select(doc.pos(" and"), doc.pos(" stain"));
    doc.apply(doc.state.tr.deleteSelection().setMeta("uiEvent", "cut"));
    expect(doc.html()).toBe(`<p>Paint${del("del-1", " and")} stain</p>`);
  });

  it("tracks select all followed by typing", () => {
    const doc = editor("<p>Old plan</p>");
    doc.apply(doc.state.tr.setSelection(new AllSelection(doc.state.doc)));
    doc.type("New");
    expect(doc.html()).toBe(`<p>${del("del-2", "Old plan")}</p><p>${ins("ins-1", "New")}</p>`);
  });

  it("lets block structure, block nodes and code blocks change normally", () => {
    const doc = editor("<p>First</p><p>Second</p><pre><code>npm run build</code></pre>");
    doc.select(doc.pos("Second"));
    doc.backspace();
    expect(doc.html()).toBe("<p>FirstSecond</p><pre><code>npm run build</code></pre>");
    doc.select(doc.pos("build"), doc.pos("build", 5));
    doc.backspace();
    expect(doc.html()).toBe("<p>FirstSecond</p><pre><code>npm run </code></pre>");
    doc.select(doc.pos("Second"));
    doc.type("x");
    expect(doc.html()).toBe(`<p>First${ins("ins-1", "x")}Second</p><pre><code>npm run </code></pre>`);
  });

  it("undoes a tracked edit in one step and leaves undo and redo untracked", () => {
    const doc = editor("<p>Two cashiers</p>");
    doc.select(doc.pos("Two"), doc.pos(" cashiers"));
    doc.type("Three");
    const tracked = doc.html();
    doc.run(undo);
    expect(doc.html()).toBe("<p>Two cashiers</p>");
    doc.run(redo);
    expect(doc.html()).toBe(tracked);
  });

  it("skips content applied from props and transactions marked for it", () => {
    const doc = editor("<p>Draft</p>");
    const replacement = htmlToDoc("<p>Published</p>");
    doc.apply(doc.state.tr.replaceWith(0, doc.state.doc.content.size, replacement.content).setMeta(EXTERNAL_UPDATE, true).setMeta("addToHistory", false));
    expect(doc.html()).toBe("<p>Published</p>");
    doc.apply(doc.state.tr.insertText("!", doc.pos("Published", 9)).setMeta(trackChangesKey, "skip"));
    expect(doc.html()).toBe("<p>Published!</p>");
  });

  it("leaves a full document replacement alone", () => {
    const doc = editor("<p>Draft</p>");
    doc.apply(doc.state.tr.replaceWith(0, doc.state.doc.content.size, htmlToDoc("<h2>From source</h2>").content));
    expect(doc.html()).toBe("<h2>From source</h2>");
  });

  it("leaves transactions that write change marks themselves alone, such as an AI suggestion", () => {
    for (const mode of ["track", "idle"] as const) {
      const doc = editor("<p>The desk recieves cards</p>", { mode });
      const from = doc.pos("recieves");
      const to = from + "recieves".length;
      const { insertion, deletion } = doc.state.schema.marks;
      const tr = doc.state.tr.addMark(from, to, deletion!.create({ id: "ai-1", author: "AI assistant", date: DATE }));
      doc.apply(tr.insert(to, doc.state.schema.text("receives", [insertion!.create({ id: "ai-2", author: "AI assistant", date: DATE })])));
      expect(doc.html()).toBe(`<p>The desk ${del("ai-1", "recieves", "AI assistant")}${ins("ai-2", "receives", "AI assistant")} cards</p>`);
    }
  });

  it("does nothing when off and keeps typed text out of change marks when idle", () => {
    const off = editor("<p>Hello</p>", { mode: "off" });
    off.select(off.pos("Hello", 5));
    off.type("!");
    expect(off.html()).toBe("<p>Hello!</p>");
    const idle = editor(`<p>Schedule ${del("d", "two")} cashiers</p>`, { mode: "idle" });
    idle.select(idle.pos("two", 1));
    idle.type("x");
    expect(idle.html()).toBe(`<p>Schedule ${del("d", "t")}x${del("d", "wo")} cashiers</p>`);
    idle.select(idle.pos(" cashiers"));
    idle.backspace();
    expect(idle.html()).toBe(`<p>Schedule ${del("d", "t")}x${del("d", "wo")} cashiers</p>`);
    expect(idle.state.selection.from).toBe(idle.pos("wo", 1));
    idle.select(idle.pos("x"), idle.pos(" cashiers"));
    idle.backspace();
    expect(idle.html()).toBe(`<p>Schedule ${del("d", "t")} cashiers</p>`);
  });
});

describe("accepting and rejecting changes", () => {
  const report = `<p>Schedule ${ins("ch-1", "three", "Sam Whitten")}${del("ch-2", "two", "Sam Whitten")} cashiers on Saturday.</p>`;

  it("lists changes in document order with kind, author, date and text", () => {
    const changes = listChanges(htmlToDoc(`${report}<p>Move the ${del("ch-3", "grills", "Sam Whitten")} up front</p>`));
    expect(changes.map(({ id, kind, author, date, text }) => ({ id, kind, author, date, text }))).toEqual([
      { id: "ch-1", kind: "insertion", author: "Sam Whitten", date: DATE, text: "three" },
      { id: "ch-2", kind: "deletion", author: "Sam Whitten", date: DATE, text: "two" },
      { id: "ch-3", kind: "deletion", author: "Sam Whitten", date: DATE, text: "grills" },
    ]);
    expect(changes[0]!.ranges).toEqual([{ from: 10, to: 15 }]);
  });

  it("accepts and rejects single changes", () => {
    const doc = editor(report);
    expect(doc.run(acceptChange("ch-1"))).toBe(true);
    expect(doc.html()).toBe(`<p>Schedule three${del("ch-2", "two", "Sam Whitten")} cashiers on Saturday.</p>`);
    doc.run(acceptChange("ch-2"));
    expect(doc.html()).toBe("<p>Schedule three cashiers on Saturday.</p>");
    expect(doc.run(acceptChange("ch-2"))).toBe(false);

    const other = editor(report);
    other.run(rejectChange("ch-1"));
    expect(other.html()).toBe(`<p>Schedule ${del("ch-2", "two", "Sam Whitten")} cashiers on Saturday.</p>`);
    other.run(rejectChange("ch-2"));
    expect(other.html()).toBe("<p>Schedule two cashiers on Saturday.</p>");
  });

  it("accepts and rejects all changes, with commands and on HTML", () => {
    const accepted = editor(report);
    accepted.run(acceptChanges());
    expect(accepted.html()).toBe("<p>Schedule three cashiers on Saturday.</p>");
    const rejected = editor(report);
    rejected.run(rejectChanges(["ch-1", "ch-2"]));
    expect(rejected.html()).toBe("<p>Schedule two cashiers on Saturday.</p>");
    expect(acceptAllChanges(report)).toBe("<p>Schedule three cashiers on Saturday.</p>");
    expect(rejectAllChanges(report)).toBe("<p>Schedule two cashiers on Saturday.</p>");
  });

  it("removes a paragraph whose only text was rejected or accepted away, and is not tracked itself", () => {
    const html = `<p>Keep</p><p>${ins("a", "Added line")}</p><p>${del("b", "Removed line")}</p>`;
    expect(rejectAllChanges(html)).toBe("<p>Keep</p><p>Removed line</p>");
    expect(acceptAllChanges(html)).toBe("<p>Keep</p><p>Added line</p>");
    const doc = editor(html);
    doc.run(acceptChanges());
    expect(doc.html()).toBe("<p>Keep</p><p>Added line</p>");
    doc.run(undo);
    expect(doc.html()).toBe(html);
  });
});

describe("comment commands", () => {
  it("anchors a comment on the selection and removes only its marks", () => {
    const doc = editor('<p>Put the seed racks <span data-comment-id="other">beside</span> the registers</p>', { mode: "off" });
    doc.select(doc.pos("seed"), doc.pos(" the registers"));
    expect(doc.run(addComment("c-new"))).toBe(true);
    expect(doc.html()).toBe('<p>Put the <span data-comment-id="c-new">seed racks </span><span data-comment-id="other"><span data-comment-id="c-new">beside</span></span> the registers</p>');
    expect(doc.run(removeComment("c-new"))).toBe(true);
    expect(doc.html()).toBe('<p>Put the seed racks <span data-comment-id="other">beside</span> the registers</p>');
    expect(doc.run(removeComment("c-new"))).toBe(false);
    doc.select(doc.pos("Put"));
    expect(doc.run(addComment("c-2"))).toBe(false);
    doc.select(doc.pos("Put"), doc.pos(" the"));
    expect(doc.run(addComment("bad id!"))).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Editor UI                                                           */
/* ------------------------------------------------------------------ */

const REPORT = [
  "<h2>Floor reset</h2>",
  '<p>Move the grills to the front endcap and <span data-comment-id="c-grills">put the seed racks beside the registers</span>.</p>',
  '<p>Schedule <ins data-change-id="ch-1" data-author="Sam Whitten" data-date="2026-10-24T15:00:00Z">three</ins><del data-change-id="ch-2" data-author="Sam Whitten" data-date="2026-10-24T15:00:00Z">two</del> cashiers on Saturday morning.</p>',
].join("");

const THREAD: RichTextComment = { id: "c-grills", body: "Do we have room for both seed racks?", author: "Sam Whitten", createdAt: Date.UTC(2026, 9, 24, 14, 30) };

function Harness({ initialComments = [THREAD], onComments, ...props }: Partial<HtmlEditorViewProps> & { initialComments?: RichTextComment[]; onComments?: (comments: RichTextComment[]) => void }) {
  const [comments, setComments] = useState(initialComments);
  return (
    <HtmlEditorView
      defaultValue={REPORT}
      aria-label="Store reset report"
      author="Dana Ortiz"
      comments={comments}
      onCommentsChange={(next) => {
        onComments?.(next);
        setComments(next);
      }}
      {...props}
    />
  );
}

async function mount(props: Parameters<typeof Harness>[0] = {}) {
  const ref = createRef<HtmlEditorHandle>();
  const onValueChange = vi.fn();
  const utils = render(<Harness ref={ref} onValueChange={onValueChange} {...props} />);
  const editor = await screen.findByRole("textbox", { name: "Store reset report" });
  const view = () => ref.current!.getView()!;
  const find = (text: string, offset = 0) => {
    let found = -1;
    view().state.doc.descendants((node, position) => {
      if (found < 0 && node.isText && node.text!.includes(text)) found = position + node.text!.indexOf(text) + offset;
      return found < 0;
    });
    if (found < 0) throw new Error(`"${text}" not found`);
    return found;
  };
  const select = (from: number, to = from) => act(() => view().dispatch(view().state.tr.setSelection(TextSelection.create(view().state.doc, from, to))));
  const typeText = (text: string) => act(() => view().dispatch(view().state.tr.insertText(text)));
  const panel = () => screen.getByRole("complementary", { name: "Review" });
  return { ...utils, ref, editor, view, find, select, typeText, panel, onValueChange };
}

describe("review panel and comments", () => {
  it("adds a comment from the toolbar, then replies, resolves, reopens and deletes it", async () => {
    const onComments = vi.fn();
    const { ref, find, select, panel, editor } = await mount({ onComments });
    expect(screen.getByRole("button", { name: "Add comment" }).getAttribute("aria-disabled")).toBe("true");
    select(find("grills"), find("grills", 6));
    fireEvent.click(screen.getByRole("button", { name: "Add comment" }));
    const composer = await screen.findByRole("dialog", { name: "Add a comment" });
    expect(within(composer).getByText("grills")).toBeTruthy();
    expect(editor.querySelector(".review-comment-draft")?.textContent).toBe("grills");
    const field = within(composer).getByRole("textbox", { name: "Comment" });
    await waitFor(() => expect(document.activeElement).toBe(field));
    expect(within(composer).getByRole("button", { name: "Comment" }).hasAttribute("disabled")).toBe(true);
    fireEvent.change(field, { target: { value: "Which grills go first?" } });
    fireEvent.keyDown(field, { key: "Enter", ctrlKey: true });
    const added = onComments.mock.lastCall![0] as RichTextComment[];
    expect(added).toHaveLength(2);
    const thread = added[1]!;
    expect(thread).toMatchObject({ body: "Which grills go first?", author: "Dana Ortiz" });
    expect(thread.id).toMatch(/^comment-[\w-]+$/);
    expect(ref.current!.getHTML()).toContain(`<span data-comment-id="${thread.id}">grills</span>`);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add a comment" })).toBeNull());
    expect(screen.getByRole("status").textContent).toBe("Comment added");

    const list = within(panel()).getByRole("list", { name: "Open comments" });
    const cards = within(list).getAllByRole("article");
    expect(cards.map((card) => within(card).getByRole("button", { name: /Go to commented text/ }).textContent)).toEqual(["Go to commented text: grills", "Go to commented text: put the seed racks beside the registers"]);
    const card = cards[0]!;
    fireEvent.change(within(card).getByRole("textbox", { name: "Reply to Dana Ortiz" }), { target: { value: "The gas ones" } });
    fireEvent.click(within(card).getByRole("button", { name: "Reply" }));
    expect((onComments.mock.lastCall![0] as RichTextComment[])[1]!.replies).toMatchObject([{ body: "The gas ones", author: "Dana Ortiz" }]);
    expect(within(card).getByText("The gas ones")).toBeTruthy();

    fireEvent.click(within(card).getByRole("button", { name: "Resolve" }));
    expect((onComments.mock.lastCall![0] as RichTextComment[])[1]!.resolved).toBe(true);
    expect(within(panel()).getAllByRole("article")).toHaveLength(1);
    expect(editor.querySelectorAll(".review-comment")).toHaveLength(1);
    fireEvent.click(within(panel()).getByRole("button", { name: "Resolved 1" }));
    const resolved = within(panel()).getByRole("article");
    expect(within(resolved).queryByRole("textbox")).toBeNull();
    fireEvent.click(within(resolved).getByRole("button", { name: "Reopen" }));
    expect(screen.getByRole("status").textContent).toBe("Comment reopened");
    fireEvent.click(within(panel()).getByRole("button", { name: "Open 2" }));
    fireEvent.click(within(within(panel()).getAllByRole("article")[0]!).getByRole("button", { name: "Delete" }));
    expect(onComments.mock.lastCall![0]).toEqual([THREAD]);
    expect(ref.current!.getHTML()).not.toContain(thread.id);
    expect(screen.getByRole("status").textContent).toBe("Comment deleted");
  });

  it("opens the composer with Ctrl+Alt+M, cancels with Escape and highlights the thread at the cursor", async () => {
    const { find, select, editor, panel } = await mount();
    expect(editor.querySelector(".review-comment")?.textContent).toBe("put the seed racks beside the registers");
    expect(editor.querySelector(".review-comment-active")).toBeNull();
    select(find("seed"));
    expect(editor.querySelector(".review-comment-active")?.textContent).toBe("put the seed racks beside the registers");
    expect(within(panel()).getByRole("article").hasAttribute("data-active")).toBe(true);
    select(find("Saturday"), find("Saturday", 8));
    fireEvent.keyDown(editor, { key: "m", code: "KeyM", ctrlKey: true, altKey: true });
    const composer = await screen.findByRole("dialog", { name: "Add a comment" });
    fireEvent.keyDown(within(composer).getByRole("textbox", { name: "Comment" }), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add a comment" })).toBeNull());
    expect(editor.querySelector(".review-comment-draft")).toBeNull();
  });

  it("selects a thread's text from the panel and lists threads whose text was deleted", async () => {
    const { view, panel, find } = await mount({ initialComments: [THREAD, { id: "gone", body: "Old note", author: "Sam Whitten" }] });
    const card = within(panel()).getByRole("button", { name: /Go to commented text/ });
    fireEvent.click(card);
    const { from, to } = view().state.selection;
    expect(view().state.doc.textBetween(from, to)).toBe("put the seed racks beside the registers");
    expect(from).toBe(find("put"));
    expect(within(panel()).getByRole("heading", { name: "Text removed" })).toBeTruthy();
    expect(within(within(panel()).getByRole("list", { name: "Comments on removed text" })).getByText("Old note")).toBeTruthy();
  });

  it("shows comments read-only without composers or actions", async () => {
    await mount({ readOnly: true });
    expect(screen.queryByRole("toolbar", { name: "Formatting" })).toBeNull();
    const panel = screen.getByRole("complementary", { name: "Review" });
    expect(within(panel).getByText("Do we have room for both seed racks?")).toBeTruthy();
    expect(within(panel).queryByRole("textbox")).toBeNull();
    expect(within(panel).queryByRole("button", { name: "Resolve" })).toBeNull();
    expect(within(panel).queryByRole("tab", { name: /Changes/ })).toBeNull();
  });

  it("collapses the panel to a toggle in a narrow editor and opens it over the document", async () => {
    const rect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 390, 600));
    try {
      const { editor, view } = await mount({ review: true });
      await waitFor(() => expect(screen.queryByRole("complementary", { name: "Review" })).toBeNull());
      const toggle = screen.getByRole("button", { name: "Review 3" });
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      toggle.focus();
      fireEvent.click(toggle);
      const panel = screen.getByRole("complementary", { name: "Review" });
      expect(panel.hasAttribute("data-overlay")).toBe(true);
      expect(panel.style.width).toBe("288px");
      await waitFor(() => expect(document.activeElement).toBe(within(panel).getByRole("tab", { name: "Comments 1" })));
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
      fireEvent.keyDown(document.activeElement!, { key: "Escape" });
      expect(screen.queryByRole("complementary", { name: "Review" })).toBeNull();
      expect(document.activeElement).toBe(toggle);

      fireEvent.click(screen.getByRole("button", { name: "Review panel" }));
      const reopened = screen.getByRole("complementary", { name: "Review" });
      fireEvent.click(within(reopened).getByRole("button", { name: /Go to commented text/ }));
      expect(screen.queryByRole("complementary", { name: "Review" })).toBeNull();
      expect(document.activeElement).toBe(editor);
      expect(view().state.doc.textBetween(view().state.selection.from, view().state.selection.to)).toBe("put the seed racks beside the registers");

      fireEvent.click(screen.getByRole("button", { name: "Review panel" }));
      fireEvent.click(within(screen.getByRole("complementary", { name: "Review" })).getByRole("button", { name: "Close review panel" }));
      expect(screen.queryByRole("complementary", { name: "Review" })).toBeNull();
    } finally {
      rect.mockRestore();
    }
  });

  it("renders nothing and records nothing when compact", async () => {
    const { typeText, select, find, ref } = await mount({ compact: true, review: true, defaultTrackChanges: true });
    expect(screen.queryByRole("complementary", { name: "Review" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Track changes" })).toBeNull();
    select(find("Saturday"));
    typeText("this ");
    expect(ref.current!.getHTML()).toContain("cashiers on this Saturday");
  });
});

describe("track changes in the editor", () => {
  it("toggles tracking from the toolbar, records typing and accepts and rejects from the panel", async () => {
    const onTrackChangesChange = vi.fn();
    const { ref, find, select, typeText, panel, editor } = await mount({ review: true, onTrackChangesChange });
    const toggle = screen.getByRole("button", { name: "Track changes" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(toggle);
    expect(onTrackChangesChange).toHaveBeenLastCalledWith(true);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("status").textContent).toBe("Track changes on. Edits are suggested as changes.");
    expect(screen.getByText("Tracking changes")).toBeTruthy();

    select(find("Saturday"));
    typeText("this ");
    expect(ref.current!.getHTML()).toMatch(/cashiers on <ins data-change-id="ins-[\w-]+" data-author="Dana Ortiz" data-date="[^"]+">this <\/ins>Saturday/);
    select(find("morning"), find("morning", 7));
    act(() => view(ref).dispatch(view(ref).state.tr.deleteSelection()));
    expect(ref.current!.getHTML()).toMatch(/<del data-change-id="del-[\w-]+" data-author="Dana Ortiz" data-date="[^"]+">morning<\/del>/);

    fireEvent.click(within(panel()).getByRole("tab", { name: /Changes/ }));
    const items = within(within(panel()).getByRole("list", { name: "Tracked changes" })).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringMatching(/^Addedthree.*Sam Whitten/),
      expect.stringMatching(/^Deletedtwo.*Sam Whitten/),
      expect.stringMatching(/^Addedthis.*Dana Ortiz/),
      expect.stringMatching(/^Deletedmorning.*Dana Ortiz/),
    ]);
    fireEvent.click(within(items[0]!).getByRole("button", { name: /^Added\s*three/ }));
    expect(editor.querySelector(".review-change-active")?.textContent).toBe("three");

    fireEvent.click(within(items[0]!).getByRole("button", { name: "Accept" }));
    expect(screen.getByRole("status").textContent).toBe("Accepted added text: three");
    fireEvent.click(within(within(panel()).getAllByRole("listitem")[0]!).getByRole("button", { name: "Accept" }));
    expect(ref.current!.getHTML()).toContain("<p>Schedule three cashiers on <ins");
    fireEvent.click(within(within(panel()).getAllByRole("listitem")[1]!).getByRole("button", { name: "Reject" }));
    expect(screen.getByRole("status").textContent).toBe("Rejected deleted text: morning");
    fireEvent.click(within(panel()).getByRole("button", { name: "Reject all" }));
    expect(ref.current!.getHTML()).toContain("<p>Schedule three cashiers on Saturday morning.</p>");
    expect(within(panel()).getByText("No tracked changes. Turn on Track changes to suggest edits.")).toBeTruthy();
  });

  it("asks before accepting more than ten changes", async () => {
    const many = Array.from({ length: 11 }, (_, index) => `<ins data-change-id="n-${index}" data-author="Sam Whitten">item ${index} </ins>`).join("");
    const { ref } = await mount({ review: true, defaultValue: `<p>${many}</p>` });
    fireEvent.click(screen.getByRole("tab", { name: "Changes 11" }));
    fireEvent.click(screen.getByRole("button", { name: "Accept all" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Accept all 11 changes?" });
    expect(ref.current!.getHTML()).toContain("<ins");
    fireEvent.click(within(dialog).getByRole("button", { name: "Accept all" }));
    expect(ref.current!.getHTML()).not.toContain("<ins");
    expect(screen.getByRole("status").textContent).toBe("Accepted 11 changes");
  });

  it("does not record content applied from a new value", async () => {
    const { rerender } = render(<HtmlEditorView value="<p>First draft</p>" review trackChanges aria-label="Notes" />);
    const editor = await screen.findByRole("textbox", { name: "Notes" });
    rerender(<HtmlEditorView value="<p>Second draft</p>" review trackChanges aria-label="Notes" />);
    expect(editor.innerHTML).toContain("Second draft");
    expect(editor.querySelector("ins, del")).toBeNull();
  });
});

function view(ref: { current: HtmlEditorHandle | null }) {
  return ref.current!.getView()!;
}
