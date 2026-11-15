// packages/ai-ui/test/html-editor-ai.test.tsx
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import { EditorState, TextSelection } from "prosemirror-state";
import type { DecorationSet } from "prosemirror-view";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import type { HtmlAiAction, HtmlAiHandler, HtmlAiRequest } from "../src/components/html-editor-extension.js";
import { type HtmlEditorHandle, HtmlEditorView, type HtmlEditorViewProps } from "../src/components/html-editor-view.js";
import { docToHtml, htmlSchema, htmlToDoc, safeMarkId, safeTimestamp } from "../src/lib/rich-text/html.js";
import { aiSelectionRange, blockEnd, buildAiRequest, clipEnd, clipStart, collectAiText, DEFAULT_HTML_AI_ACTIONS, HTML_AI_CONTEXT_LENGTH, htmlAiKey, htmlAiPlugin, insertAiText, rangePlainText, sliceHtml } from "../src/lib/rich-text/html-ai.js";

/** Document positions of the first occurrence of `needle` inside one text node. */
function rangeOf(doc: ProseMirrorNode, needle: string): { from: number; to: number } {
  let found: { from: number; to: number } | null = null;
  doc.descendants((node, pos) => {
    if (found || !node.isText) return !found;
    const index = node.text!.indexOf(needle);
    if (index >= 0) found = { from: pos + index, to: pos + index + needle.length };
    return false;
  });
  if (!found) throw new Error(`"${needle}" not found`);
  return found;
}

function stateFor(html: string, range?: { from: number; to: number }): EditorState {
  const state = EditorState.create({ doc: htmlToDoc(html), schema: htmlSchema });
  return range ? state.apply(state.tr.setSelection(TextSelection.create(state.doc, range.from, range.to))) : state;
}

const action = (id: string): HtmlAiAction => DEFAULT_HTML_AI_ACTIONS.find((entry) => entry.id === id)!;

function gate() {
  let open = () => undefined as void;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { promise, open };
}

describe("AI request building", () => {
  it("sends the selected text, the HTML of the selected slice and the instruction", () => {
    const state = stateFor('<p>Behr Premium Plus is 20% off. The paint desk <strong>recieves</strong> extra <a href="https://example.com/cards">color cards</a> on Wednesday.</p><p>Restock brushes.</p>');
    const from = rangeOf(state.doc, "The paint").from;
    const to = rangeOf(state.doc, " on Wednesday.").to;
    const request = buildAiRequest(state, { from, to }, action("fix"));
    expect(request).toEqual({
      action: "fix",
      instruction: action("fix").instruction,
      text: "The paint desk recieves extra color cards on Wednesday.",
      html: 'The paint desk <strong>recieves</strong> extra <a href="https://example.com/cards" rel="noopener noreferrer nofollow">color cards</a> on Wednesday.',
      before: "Behr Premium Plus is 20% off. ",
      after: "\n\nRestock brushes.",
    });
  });

  it("keeps paragraphs in the slice HTML, leaves tracked deletions out of the text and adds the prompt", () => {
    const state = stateFor('<p>Schedule <ins data-change-id="c1">three</ins><del data-change-id="c2">two</del> cashiers.</p><ul><li><p>Grills up front</p></li></ul>');
    const request = buildAiRequest(state, { from: 1, to: state.doc.content.size - 3 }, { id: "custom", label: "Ask AI", instruction: "Make it a checklist" }, "  Make it a checklist ");
    expect(request.text).toBe("Schedule three cashiers.\n\nGrills up front");
    expect(request.html).toBe('<p>Schedule <ins data-change-id="c1">three</ins><del data-change-id="c2">two</del> cashiers.</p><ul><li><p>Grills up front</p></li></ul>');
    expect(request.prompt).toBe("Make it a checklist");
    expect(rangePlainText(state.doc, 0, state.doc.content.size)).toBe("Schedule three cashiers.\n\nGrills up front");
  });

  it("trims context to 1,500 characters at word boundaries on both sides", () => {
    const filler = "paint ".repeat(400);
    const state = stateFor(`<p>${filler}Start here.</p><p>Target sentence.</p><p>After this. ${filler}</p>`);
    const target = rangeOf(state.doc, "Target sentence.");
    const request = buildAiRequest(state, target, action("rewrite"));
    expect(request.before.length).toBeLessThanOrEqual(HTML_AI_CONTEXT_LENGTH);
    expect(request.before.length).toBeGreaterThan(HTML_AI_CONTEXT_LENGTH - 10);
    expect(request.before).toMatch(/^paint paint/);
    expect(request.before.endsWith("Start here.\n\n")).toBe(true);
    expect(request.after.length).toBeLessThanOrEqual(HTML_AI_CONTEXT_LENGTH);
    expect(request.after.startsWith("\n\nAfter this. paint")).toBe(true);
    expect(request.after).toMatch(/paint$/);
    expect(clipStart("alpha beta gamma", 8)).toBe("gamma");
    expect(clipEnd("alpha beta gamma", 8)).toBe("alpha");
    expect(clipStart("short", 8)).toBe("short");
  });

  it("sends no selected text for cursor actions and reads the selection range", () => {
    const state = stateFor("<p>Restock paint</p>", { from: 14, to: 14 });
    expect(aiSelectionRange(state)).toEqual({ from: 14, to: 14, hasText: false });
    const request = buildAiRequest(state, { from: 14, to: 14 }, action("continue"));
    expect(request).toMatchObject({ action: "continue", text: "", html: "", before: "Restock paint", after: "" });
    const selected = stateFor("<p>Restock paint</p>", { from: 1, to: 8 });
    expect(aiSelectionRange(selected)).toEqual({ from: 1, to: 8, hasText: true });
    expect(sliceHtml(selected.doc, 1, 8)).toBe("Restock");
  });
});

describe("reading handler results", () => {
  it("streams chunks from an async iterable and returns the whole text from a promise", async () => {
    const onText = vi.fn();
    async function* chunks() {
      yield "The paint ";
      yield "desk";
    }
    await expect(collectAiText(chunks(), new AbortController().signal, onText)).resolves.toBe("The paint desk");
    expect(onText.mock.calls).toEqual([["The paint "], ["The paint desk"]]);
    const whole = vi.fn();
    await expect(collectAiText(Promise.resolve("Done."), new AbortController().signal, whole)).resolves.toBe("Done.");
    expect(whole).toHaveBeenCalledWith("Done.");
    await expect(collectAiText(Promise.reject(new Error("Model is busy")), new AbortController().signal, vi.fn())).rejects.toThrow("Model is busy");
  });

  it("stops at once when aborted, even if the handler ignores the signal", async () => {
    let calls = 0;
    const iterator: AsyncIterator<string> = {
      next: () => (calls++ === 0 ? Promise.resolve({ done: false, value: "Partial" }) : new Promise<IteratorResult<string>>(() => undefined)),
      return: vi.fn(() => Promise.resolve({ done: true as const, value: undefined })),
    };
    const controller = new AbortController();
    const onText = vi.fn();
    const result = collectAiText({ [Symbol.asyncIterator]: () => iterator }, controller.signal, onText);
    await vi.waitFor(() => expect(onText).toHaveBeenCalledWith("Partial"));
    controller.abort();
    await expect(result).resolves.toBe("Partial");
    expect(iterator.return).toHaveBeenCalled();
    const hanging = new AbortController();
    const pending = collectAiText(new Promise<string>(() => undefined), hanging.signal, vi.fn());
    hanging.abort();
    await expect(pending).resolves.toBe("");
  });
});

describe("inserting AI results", () => {
  const html = (state: EditorState, text: string, mode: "replace" | "below" | "suggest", range = { from: state.selection.from, to: state.selection.to }) => {
    const tr = insertAiText(state, range, text, mode, { author: "Dana Ortiz", date: "2026-10-25T12:00:00.000Z", newId: (() => { let n = 0; return () => `ai-${++n}`; })() });
    return tr ? docToHtml(tr.doc) : null;
  };

  it("replaces inline within a paragraph, keeping the marks across the range", () => {
    const base = stateFor("<p>The desk <strong>recieves cards</strong> today.</p>");
    const state = stateFor("<p>The desk <strong>recieves cards</strong> today.</p>", rangeOf(base.doc, "recieves cards"));
    expect(html(state, "receives cards\n", "replace")).toBe("<p>The desk <strong>receives cards</strong> today.</p>");
  });

  it("splits blank-line paragraphs, turns single newlines into hard breaks and keeps markup as text", () => {
    const base = stateFor("<p>A. B. C.</p>");
    const state = stateFor("<p>A. B. C.</p>", rangeOf(base.doc, "B."));
    expect(html(state, "B1.\n\nB2.\nline", "replace")).toBe("<p>A. B1.</p><p>B2.<br>line C.</p>");
    expect(html(state, '<img src="x" onerror="alert(1)">', "replace")).toBe('<p>A. &lt;img src="x" onerror="alert(1)"&gt; C.</p>');
    expect(html(state, "  \n ", "replace")).toBeNull();
  });

  it("keeps a figure caption on one line and code as plain text", () => {
    const figure = stateFor('<figure><img src="https://example.com/a.jpg" alt="Aisle"><figcaption>Old caption</figcaption></figure>');
    const caption = rangeOf(figure.doc, "Old caption");
    expect(html(figure, "New\n\ncaption", "replace", caption)).toContain("<figcaption>New<br>caption</figcaption>");
    const code = stateFor("<pre><code>let a = 1</code></pre>");
    expect(html(code, "let b = 2\n\nlet c = 3", "replace", rangeOf(code.doc, "let a = 1"))).toBe("<pre><code>let b = 2\n\nlet c = 3</code></pre>");
  });

  it("inserts paragraphs below the block, after a list when the range is in one", () => {
    const base = stateFor("<ul><li><p>Grills</p></li><li><p>Seeds</p></li></ul><p>Next</p>");
    const state = stateFor("<ul><li><p>Grills</p></li><li><p>Seeds</p></li></ul><p>Next</p>", rangeOf(base.doc, "Grills"));
    expect(html(state, "Summary one.\n\nSummary two.", "below")).toBe("<ul><li><p>Grills</p></li><li><p>Seeds</p></li></ul><p>Summary one.</p><p>Summary two.</p><p>Next</p>");
    expect(blockEnd(base.doc, 0)).toBe(0);
  });

  it("continues at the cursor with a joining space and selects the end of the new text", () => {
    const state = stateFor("<p>Restock paint</p><p>Next</p>", { from: 14, to: 14 });
    const tr = insertAiText(state, { from: 14, to: 14 }, "and brushes.", "replace")!;
    expect(docToHtml(tr.doc)).toBe("<p>Restock paint and brushes.</p><p>Next</p>");
    expect(tr.selection.from).toBe(14 + " and brushes.".length);
    expect(docToHtml(insertAiText(state, { from: 14, to: 14 }, " Then sweep.\n\nLock up.", "replace")!.doc)).toBe("<p>Restock paint Then sweep.</p><p>Lock up.</p><p>Next</p>");
  });

  it("suggests a change with deletion and insertion marks, and drops pending insertions it replaces", () => {
    const base = stateFor("<p>The desk recieves cards.</p>");
    const state = stateFor("<p>The desk recieves cards.</p>", rangeOf(base.doc, "recieves"));
    expect(html(state, "receives", "suggest")).toBe(
      '<p>The desk <del data-change-id="ai-1" data-author="Dana Ortiz" data-date="2026-10-25T12:00:00.000Z">recieves</del><ins data-change-id="ai-2" data-author="Dana Ortiz" data-date="2026-10-25T12:00:00.000Z">receives</ins> cards.</p>',
    );
    const pending = '<p>Schedule <ins data-change-id="c1" data-author="Sam">three</ins> cashiers.</p>';
    const pendingBase = stateFor(pending);
    const range = { from: rangeOf(pendingBase.doc, "Schedule").from, to: rangeOf(pendingBase.doc, "three").to };
    expect(html(stateFor(pending, range), "Book four", "suggest")).toBe(
      '<p><del data-change-id="ai-1" data-author="Dana Ortiz" data-date="2026-10-25T12:00:00.000Z">Schedule </del><ins data-change-id="ai-2" data-author="Dana Ortiz" data-date="2026-10-25T12:00:00.000Z">Book four</ins> cashiers.</p>',
    );
  });
});

describe("AI target plugin", () => {
  it("highlights the target, maps it while the menu is open and drops it on edits during a preview", () => {
    let enabled = true;
    const plugin = htmlAiPlugin({ enabled: () => enabled, open: () => true, escape: () => true, lost: () => undefined });
    let state = EditorState.create({ doc: htmlToDoc("<p>Hello world</p>"), plugins: [plugin] });
    const decorations = () => plugin.spec.props!.decorations!.call(plugin, state) as DecorationSet | null;
    state = state.apply(state.tr.setMeta(htmlAiKey, { type: "set", target: { from: 1, to: 6, mode: "menu" } }));
    expect(decorations()!.find().map((decoration) => [decoration.from, decoration.to])).toEqual([[1, 6]]);
    state = state.apply(state.tr.insertText("Big ", 1));
    expect(htmlAiKey.getState(state)).toEqual({ from: 5, to: 10, mode: "menu" });
    state = state.apply(state.tr.setMeta(htmlAiKey, { type: "set", target: { from: 13, to: 13, mode: "preview" } }));
    expect(decorations()!.find()).toHaveLength(1);
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 2)));
    expect(htmlAiKey.getState(state)).not.toBeNull();
    state = state.apply(state.tr.insertText("!", 13));
    expect(htmlAiKey.getState(state)).toBeNull();
    state = state.apply(state.tr.setMeta(htmlAiKey, { type: "set", target: { from: 1, to: 2, mode: "menu" } }));
    enabled = false;
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 3)));
    expect(htmlAiKey.getState(state)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* In the editor                                                       */
/* ------------------------------------------------------------------ */

const REPORT = "<p>Behr Premium Plus is 20% off. The paint desk recieves extra color cards on Wednesday.</p><p>Restock the brushes.</p>";
const SENTENCE = "The paint desk recieves extra color cards on Wednesday.";

async function setup(props: Partial<HtmlEditorViewProps> = {}) {
  const ref = createRef<HtmlEditorHandle>();
  const onValueChange = vi.fn();
  render(<HtmlEditorView ref={ref} defaultValue={REPORT} onValueChange={onValueChange} {...props} />);
  const editor = await screen.findByRole("textbox", { name: "Document" });
  const view = () => ref.current!.getView()!;
  const select = (from: number, to = from) =>
    act(() => {
      view().dispatch(view().state.tr.setSelection(TextSelection.create(view().state.doc, from, to)));
    });
  const selectText = (needle: string) => {
    const range = rangeOf(view().state.doc, needle);
    select(range.from, range.to);
    return range;
  };
  const hostStatus = () => screen.getAllByRole("status").find((element) => !element.closest('[data-slot="html-ai-preview"]'))!;
  return { ref, editor, view, select, selectText, onValueChange, hostStatus };
}

function streaming(chunks: string[], gates: Array<Promise<void>> = []) {
  const requests: HtmlAiRequest[] = [];
  const signals: AbortSignal[] = [];
  const handler: HtmlAiHandler = (request, signal) => {
    requests.push(request);
    signals.push(signal);
    return (async function* () {
      for (const [index, chunk] of chunks.entries()) {
        if (gates[index]) await gates[index];
        yield chunk;
      }
    })();
  };
  return { handler, requests, signals };
}

describe("HtmlEditor AI writing", () => {
  it("opens the menu from the toolbar with grouped presets and returns focus on Escape", async () => {
    const { handler } = streaming(["x"]);
    const { selectText } = await setup({ onAiRequest: handler });
    selectText(SENTENCE);
    const trigger = screen.getByRole("button", { name: "AI" });
    expect(trigger.getAttribute("aria-keyshortcuts")).toBe("Control+J");
    fireEvent.click(trigger);
    const menu = screen.getByRole("group", { name: "Ask AI" });
    const field = within(menu).getByRole("combobox", { name: "Ask AI to edit or write" });
    await waitFor(() => expect(document.activeElement).toBe(field));
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(within(menu).getByRole("group", { name: "Edit" })).toBeTruthy();
    expect(within(within(menu).getByRole("group", { name: "Tone" })).getAllByRole("option").map((option) => option.textContent)).toEqual(["Professional", "Friendly", "Confident", "Casual"]);
    expect(within(within(menu).getByRole("group", { name: "Write" })).getAllByRole("option").map((option) => option.textContent)).toEqual(["Continue writing", "Summarize"]);
    expect(document.querySelector(".html-ai-target")?.textContent).toBe(SENTENCE);
    fireEvent.keyDown(field, { key: "Escape" });
    expect(screen.queryByRole("group", { name: "Ask AI" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(document.querySelector(".html-ai-target")).toBeNull();
  });

  it("disables selection actions at the cursor and filters presets as you type", async () => {
    const { handler } = streaming(["x"]);
    const { editor, select } = await setup({ onAiRequest: handler });
    select(5);
    fireEvent.keyDown(editor, { key: "j", ctrlKey: true });
    const field = screen.getByRole("combobox", { name: "Ask AI to edit or write" });
    expect(screen.getByRole("option", { name: "Improve writing" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("option", { name: "Summarize" }).getAttribute("aria-disabled")).toBe("true");
    const proceed = screen.getByRole("option", { name: "Continue writing" });
    expect(proceed.getAttribute("aria-disabled")).toBeNull();
    expect(field.getAttribute("aria-activedescendant")).toBe(proceed.id);
    expect(field.getAttribute("aria-describedby")).toBeTruthy();
    expect(document.querySelector(".html-ai-cursor")).not.toBeNull();
    fireEvent.change(field, { target: { value: "tone" } });
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Ask AI “tone”", "Professional", "Friendly", "Confident", "Casual"]);
    fireEvent.keyDown(field, { key: "Escape" });
    await waitFor(() => expect(document.activeElement).toBe(editor));
  });

  it("streams a fix into the preview, announces when ready and replaces in one undo step", async () => {
    const first = gate();
    const second = gate();
    const { handler, requests } = streaming(["The paint desk ", "receives extra color cards", " on Wednesday."], [Promise.resolve(), first.promise, second.promise]);
    const { ref, editor, selectText, hostStatus } = await setup({ onAiRequest: handler });
    selectText(SENTENCE);
    fireEvent.keyDown(editor, { key: "j", ctrlKey: true });
    const field = screen.getByRole("combobox", { name: "Ask AI to edit or write" });
    const fix = screen.getByRole("option", { name: "Fix spelling and grammar" });
    fireEvent.keyDown(field, { key: "ArrowDown" });
    expect(field.getAttribute("aria-activedescendant")).toBe(fix.id);
    expect(fix.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(field, { key: "Enter" });

    const preview = await screen.findByRole("region", { name: "AI suggestion" });
    expect(requests[0]).toMatchObject({ action: "fix", text: SENTENCE, before: "Behr Premium Plus is 20% off. ", after: "\n\nRestock the brushes." });
    await within(preview).findByText("The paint desk");
    const live = within(preview).getByRole("status");
    expect(live.textContent).toBe("");
    const stop = within(preview).getByRole("button", { name: "Stop" });
    await waitFor(() => expect(document.activeElement).toBe(stop));
    expect(document.querySelector(".html-ai-target")?.textContent).toBe(SENTENCE);
    await act(async () => first.open());
    await within(preview).findByText("The paint desk receives extra color cards");
    expect(live.textContent).toBe("");
    await act(async () => second.open());
    await waitFor(() => expect(live.textContent).toBe("Suggestion ready."));
    const replace = within(preview).getByRole("button", { name: "Replace" });
    await waitFor(() => expect(document.activeElement).toBe(replace));
    expect(within(preview).queryByRole("button", { name: "Suggest as change" })).toBeNull();
    fireEvent.click(replace);
    expect(ref.current!.getHTML()).toBe("<p>Behr Premium Plus is 20% off. The paint desk receives extra color cards on Wednesday.</p><p>Restock the brushes.</p>");
    expect(screen.queryByRole("region", { name: "AI suggestion" })).toBeNull();
    expect(hostStatus().textContent).toBe("Replaced the text with the AI suggestion");
    expect(document.activeElement).toBe(editor);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(ref.current!.getHTML()).toBe(REPORT);
  });

  it("inserts a promised summary below and continues writing at the cursor", async () => {
    const onAiRequest = vi.fn<HtmlAiHandler>(async (request) => (request.action === "summarize" ? "Paint is 20% off.\n\nCards arrive Wednesday." : "Then restock the rollers."));
    const { ref, editor, view, select, selectText, hostStatus } = await setup({ onAiRequest });
    selectText(SENTENCE);
    fireEvent.click(screen.getByRole("button", { name: "AI" }));
    fireEvent.click(screen.getByRole("option", { name: "Summarize" }));
    const insertBelow = await screen.findByRole("button", { name: "Insert below" });
    expect(screen.getByText("Cards arrive Wednesday.")).toBeTruthy();
    fireEvent.click(insertBelow);
    expect(ref.current!.getHTML()).toBe(`<p>Behr Premium Plus is 20% off. ${SENTENCE}</p><p>Paint is 20% off.</p><p>Cards arrive Wednesday.</p><p>Restock the brushes.</p>`);
    expect(hostStatus().textContent).toBe("Inserted the AI suggestion below");

    const end = rangeOf(view().state.doc, "Restock the brushes.").to;
    select(end);
    fireEvent.keyDown(editor, { key: "j", ctrlKey: true });
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Ask AI to edit or write" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("button", { name: "Insert at cursor" }));
    expect(onAiRequest.mock.calls[1]![0]).toMatchObject({ action: "continue", text: "", html: "" });
    expect(ref.current!.getHTML()).toContain("<p>Restock the brushes. Then restock the rollers.</p>");
    expect(hostStatus().textContent).toBe("Inserted the AI text at the cursor");
  });

  it("shows errors with Try again and stops silently on abort", async () => {
    const onAiRequest = vi
      .fn<HtmlAiHandler>()
      .mockRejectedValueOnce(new Error("The model is busy."))
      .mockResolvedValueOnce("The paint desk receives extra color cards on Wednesday.")
      .mockImplementationOnce((_request, signal) => new Promise<string>((_resolve, reject) => signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))));
    const { ref, editor, selectText } = await setup({ onAiRequest });
    selectText(SENTENCE);
    fireEvent.click(screen.getByRole("button", { name: "AI" }));
    fireEvent.click(screen.getByRole("option", { name: "Fix spelling and grammar" }));
    const preview = await screen.findByRole("region", { name: "AI suggestion" });
    await within(preview).findByText("The model is busy.");
    expect(within(preview).getByRole("status").textContent).toBe("Couldn't get a suggestion. The model is busy.");
    const retry = within(preview).getByRole("button", { name: "Try again" });
    await waitFor(() => expect(document.activeElement).toBe(retry));
    fireEvent.click(retry);
    fireEvent.click(await within(preview).findByRole("button", { name: "Replace" }));
    expect(ref.current!.getHTML()).toContain("desk receives extra");

    selectText("Restock the brushes.");
    fireEvent.click(screen.getByRole("button", { name: "AI" }));
    fireEvent.click(screen.getByRole("option", { name: "Make shorter" }));
    fireEvent.click(await screen.findByRole("button", { name: "Stop" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "AI suggestion" })).toBeNull());
    expect(onAiRequest.mock.calls[2]![1].aborted).toBe(true);
    expect(screen.queryByText(/Couldn't get a suggestion/)).toBeNull();
    expect(document.activeElement).toBe(editor);
    expect(document.querySelector(".html-ai-target")).toBeNull();
  });

  it("keeps partial text after Stop and discards on Escape or when the document is edited", async () => {
    const hold = gate();
    const { handler, signals } = streaming(["Shorter text.", " More."], [Promise.resolve(), hold.promise]);
    const { ref, view, selectText, hostStatus } = await setup({ onAiRequest: handler });
    selectText(SENTENCE);
    fireEvent.click(screen.getByRole("button", { name: "AI" }));
    fireEvent.click(screen.getByRole("option", { name: "Make shorter" }));
    const preview = await screen.findByRole("region", { name: "AI suggestion" });
    await within(preview).findByText("Shorter text.");
    fireEvent.click(within(preview).getByRole("button", { name: "Stop" }));
    await within(preview).findByText("Stopped early");
    expect(signals[0]!.aborted).toBe(true);
    expect(within(preview).getByRole("status").textContent).toBe("Stopped. Suggestion ready.");
    fireEvent.keyDown(within(preview).getByRole("button", { name: "Replace" }), { key: "Escape" });
    expect(screen.queryByRole("region", { name: "AI suggestion" })).toBeNull();
    expect(ref.current!.getHTML()).toBe(REPORT);

    selectText(SENTENCE);
    fireEvent.click(screen.getByRole("button", { name: "AI" }));
    fireEvent.click(screen.getByRole("option", { name: "Make shorter" }));
    await screen.findByRole("region", { name: "AI suggestion" });
    act(() => view().dispatch(view().state.tr.insertText("Note: ", 1)));
    expect(screen.queryByRole("region", { name: "AI suggestion" })).toBeNull();
    expect(signals[1]!.aborted).toBe(true);
    expect(hostStatus().textContent).toBe("AI suggestion discarded");
    expect(ref.current!.getHTML()).toContain("<p>Note: Behr Premium");
    await act(async () => hold.open());
  });

  it("suggests the result as a tracked change with the author and a custom prompt", async () => {
    const onAiRequest = vi.fn<HtmlAiHandler>(async (request) => (request.action === "custom" ? "Cards arrive Wednesday." : "Extra cards arrive Wednesday."));
    const { ref, selectText, hostStatus } = await setup({ onAiRequest, review: true, author: "Dana Ortiz" });
    selectText(SENTENCE);
    fireEvent.click(screen.getByRole("button", { name: "AI" }));
    fireEvent.click(screen.getByRole("option", { name: "Make shorter" }));
    fireEvent.click(await screen.findByRole("button", { name: "Suggest as change" }));
    const html = ref.current!.getHTML();
    const deletion = /<del data-change-id="([^"]+)" data-author="Dana Ortiz" data-date="([^"]+)">The paint desk recieves extra color cards on Wednesday\.<\/del>/.exec(html);
    const insertion = /<ins data-change-id="([^"]+)" data-author="Dana Ortiz" data-date="([^"]+)">Extra cards arrive Wednesday\.<\/ins>/.exec(html);
    expect(deletion && insertion).toBeTruthy();
    expect(safeMarkId(deletion![1])).toBe(deletion![1]);
    expect(safeMarkId(insertion![1])).toBe(insertion![1]);
    expect(deletion![1]).not.toBe(insertion![1]);
    expect(safeTimestamp(deletion![2])).toBe(deletion![2]);
    expect(hostStatus().textContent).toBe("Added the AI suggestion as a tracked change");

    selectText("Restock the brushes.");
    fireEvent.click(screen.getByRole("button", { name: "AI" }));
    const field = screen.getByRole("combobox", { name: "Ask AI to edit or write" });
    fireEvent.change(field, { target: { value: "Mention the card delivery" } });
    fireEvent.keyDown(field, { key: "Enter" });
    await screen.findByRole("button", { name: "Suggest as change" });
    expect(onAiRequest.mock.calls[1]![0]).toMatchObject({ action: "custom", prompt: "Mention the card delivery", instruction: "Mention the card delivery", text: "Restock the brushes." });
    expect(screen.getByRole("region", { name: "AI suggestion" }).textContent).toContain("“Mention the card delivery”");
  });

  it("uses the AI assistant as author without one, and aiActions replaces the presets", async () => {
    const onAiRequest = vi.fn<HtmlAiHandler>(async () => "Brushes are restocked.");
    const aiActions: HtmlAiAction[] = [{ id: "headline", label: "Write a headline", group: "Marketing", instruction: "Write a short headline for this text." }];
    const { ref, selectText } = await setup({ onAiRequest, review: true, aiActions });
    selectText("Restock the brushes.");
    fireEvent.click(screen.getByRole("button", { name: "AI" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Write a headline"]);
    expect(screen.getByRole("group", { name: "Marketing" })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Ask AI to edit or write" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("button", { name: "Suggest as change" }));
    expect(onAiRequest.mock.calls[0]![0].action).toBe("headline");
    expect(ref.current!.getHTML()).toContain('data-author="AI assistant"');
  });

  it("is off without a handler, in compact editors and when read-only", async () => {
    const onAiRequest = vi.fn<HtmlAiHandler>(async () => "x");
    const ctrlJ = (element: HTMLElement) => {
      const event = new KeyboardEvent("keydown", { key: "j", ctrlKey: true, bubbles: true, cancelable: true });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    };
    for (const props of [{ "aria-label": "Plain" }, { "aria-label": "Compact", compact: true, onAiRequest }, { "aria-label": "Locked", readOnly: true, onAiRequest }]) {
      const { unmount } = render(<HtmlEditorView defaultValue={REPORT} {...props} />);
      const editor = await screen.findByRole("textbox", { name: props["aria-label"] });
      expect(screen.queryByRole("button", { name: "AI" })).toBeNull();
      expect(ctrlJ(editor)).toBe(false);
      expect(document.querySelector('[data-slot="html-ai-menu"]')).toBeNull();
      unmount();
    }
    expect(onAiRequest).not.toHaveBeenCalled();
  });
});
