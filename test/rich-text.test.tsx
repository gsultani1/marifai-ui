// packages/ai-ui/test/rich-text.test.tsx
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { DOMParser as ProseMirrorDOMParser } from "prosemirror-model";
import { EditorState, TextSelection } from "prosemirror-state";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { docCounts, docText } from "../src/components/rich-text-parts.js";
import { countText, docToMarkdown, htmlToDoc, markdownToDoc, RichTextEditor, type RichTextEditorHandle, richTextSchema } from "../src/index.js";
import { buildFindPattern, findMatches, preserveCase } from "../src/lib/rich-text/plugins.js";

describe("rich text markdown", () => {
  it("round-trips headings, marks, lists, tasks, tables, code, quotes and images", () => {
    const markdown = [
      "# Store opening plan",
      "",
      "We open **Saturday** at *9 AM* with ~~two~~ three registers, `POS-2` and [the checklist](https://example.com/list).",
      "",
      "> Bring the keys.",
      "",
      "- Stock shelves",
      "- Test scanners",
      "",
      "1. Count drawers",
      "2. Unlock doors",
      "",
      "- [x] Order signage",
      "- [ ] Train staff",
      "",
      "| Aisle | Owner |",
      "| --- | --- |",
      "| Paint | Ana |",
      "",
      "```ts",
      "const open = true;",
      "```",
      "",
      "---",
      "",
      "![Storefront](https://example.com/front.jpg)",
      "",
    ].join("\n");
    expect(docToMarkdown(markdownToDoc(markdown))).toBe(markdown);
  });

  it("keeps underline and highlight as inline HTML and escapes literal markdown characters", () => {
    const doc = markdownToDoc("Use <u>care</u> and <mark>caution</mark>.\n");
    const marks = new Set<string>();
    doc.descendants((node) => node.marks.forEach((mark) => marks.add(mark.type.name)));
    expect([...marks].sort()).toEqual(["highlight", "underline"]);
    expect(docToMarkdown(doc)).toBe("Use <u>care</u> and <mark>caution</mark>.\n");
    const literal = richTextSchema.nodes.doc!.create(null, richTextSchema.nodes.paragraph!.create(null, richTextSchema.text("2 * 3 = 6 and # is a hash")));
    expect(docToMarkdown(literal)).toBe("2 \\* 3 = 6 and # is a hash\n");
    expect(docToMarkdown(markdownToDoc(docToMarkdown(literal))).trim()).toBe("2 \\* 3 = 6 and # is a hash");
  });

  it("drops unsafe link and image URLs from markdown and pasted HTML", () => {
    const doc = markdownToDoc("[click](javascript:alert(1)) ![pic](javascript:alert(2)) <script>alert(3)</script>");
    let links = 0;
    let images = 0;
    doc.descendants((node) => {
      if (node.type.name === "image") images++;
      if (node.marks.some((mark) => mark.type.name === "link")) links++;
    });
    expect([links, images]).toEqual([0, 0]);
    expect(doc.textContent).toContain("click");
    expect(doc.textContent).toContain("<script>");

    const html = document.createElement("div");
    html.innerHTML = '<p><a href="javascript:alert(1)">bad</a> <a href="https://ok.example">good</a><img src="javascript:x"><script>alert(1)</script></p>';
    const parsed = ProseMirrorDOMParser.fromSchema(richTextSchema).parse(html);
    const hrefs: string[] = [];
    parsed.descendants((node) => node.marks.forEach((mark) => mark.type.name === "link" && hrefs.push(mark.attrs.href as string)));
    expect(hrefs).toEqual(["https://ok.example/"]);
    expect(parsed.textContent).not.toContain("alert");
  });

  it("finds matches with whole-word and case options and preserves case on replace", () => {
    const doc = markdownToDoc("Paint the paint aisle. Painting later.");
    const pattern = buildFindPattern({ query: "paint", caseSensitive: false, wholeWord: true, regex: false });
    expect(pattern).toBeInstanceOf(RegExp);
    expect(findMatches(doc, pattern as RegExp)).toHaveLength(2);
    expect(buildFindPattern({ query: "(", caseSensitive: false, wholeWord: false, regex: true })).toEqual(expect.any(String));
    expect([preserveCase("PAINT", "stain"), preserveCase("Paint", "stain"), preserveCase("paint", "Stain")]).toEqual(["STAIN", "Stain", "stain"]);
  });

  it("counts words and characters with emoji as one character", () => {
    expect(countText("Open at 9 👍🏽 today")).toEqual({ words: 4, characters: 17 });
  });

  it("counts a document block by block with the same result as counting its whole text", () => {
    const docs = [
      markdownToDoc("# Spring reset\n\nMove **grills** to aisle 4.\n\n- Stock shelves\n- [ ] Price tags\n\n> Bring the keys.\n\n---\n\n| Item | Qty |\n| --- | --- |\n| Deck screws | 12 |\n\n```\nPOS-2\n```"),
      htmlToDoc('<h1>Store reset report</h1><div data-toc=""></div><p>Sales<sup data-footnote="Register reports."></sup> rose 👍🏽.</p><aside data-callout="warning"><p>Ladder safety</p><ul><li><p>Two people</p></li></ul></aside><figure><img src="https://example.com/a.png" alt="Aisle"><figcaption>Aisle 4</figcaption></figure><div data-columns="2"><div data-column=""><p>Left</p></div><div data-column=""><p>Right</p></div></div><p></p><hr><div data-page-break=""></div><table><tbody><tr><td><p>Paint</p></td><td><p></p></td></tr></tbody></table><p>Done</p>'),
      htmlToDoc("<p></p>"),
      htmlToDoc("<hr><p>After a rule</p>"),
    ];
    for (const doc of docs) expect(docCounts(doc)).toEqual(countText(docText(doc)));
    const edited = EditorState.create({ doc: docs[0] }).tr.insertText("New ", 1).doc;
    expect(docCounts(edited)).toEqual(countText(docText(edited)));
  });
});

async function setup(props: Partial<Parameters<typeof RichTextEditor>[0]> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const onValueChange = vi.fn();
  render(<RichTextEditor ref={ref} defaultValue={"# Title\n\nHello world"} onValueChange={onValueChange} {...props} />);
  const editor = await screen.findByRole("textbox", { name: props["aria-label"] ?? "Document" });
  const view = () => ref.current!.getView()!;
  const select = (from: number, to = from) =>
    act(() => {
      view().dispatch(view().state.tr.setSelection(TextSelection.create(view().state.doc, from, to)));
    });
  return { ref, editor, view, select, onValueChange };
}

describe("RichTextEditor", () => {
  it("loads lazily, renders markdown and applies toolbar formatting", async () => {
    const { ref, editor, select, onValueChange } = await setup();
    expect(editor.querySelector("h1")?.textContent).toBe("Title");
    select(8, 13);
    fireEvent.click(screen.getByRole("button", { name: "Bold" }));
    expect(ref.current!.getMarkdown()).toBe("# Title\n\n**Hello** world\n");
    expect(onValueChange).toHaveBeenLastCalledWith("# Title\n\n**Hello** world\n");
    expect(screen.getByRole("button", { name: "Bold" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(ref.current!.getMarkdown()).toBe("# Title\n\nHello world\n");
  });

  it("opens the slash menu, moves with the keyboard and runs a command", async () => {
    const { ref, editor, view, select } = await setup({ defaultValue: "Intro\n\n" });
    select(view().state.doc.content.size - 1);
    act(() => {
      view().dispatch(view().state.tr.split(view().state.selection.from).insertText("/hea"));
    });
    const menu = screen.getByRole("listbox", { name: "Insert block" });
    expect(within(menu).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Heading 1Large section title",
      "Heading 2Medium section title",
      "Heading 3Small section title",
    ]);
    fireEvent.keyDown(editor, { key: "ArrowDown" });
    expect(within(menu).getByRole("option", { selected: true }).textContent).toContain("Heading 2");
    fireEvent.keyDown(editor, { key: "Enter" });
    expect(screen.queryByRole("listbox", { name: "Insert block" })).toBeNull();
    act(() => ref.current!.insertText("Agenda"));
    expect(ref.current!.getMarkdown()).toBe("Intro\n\n## Agenda\n");
  });

  it("finds and replaces across the document", async () => {
    const { ref } = await setup({ defaultValue: "Paint aisle. paint cans. PAINT sale." });
    fireEvent.click(screen.getByRole("button", { name: "Find and replace" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Find" }), { target: { value: "paint" } });
    expect(screen.getByText("1 of 3")).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "Replace with" }), { target: { value: "stain" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Preserve case" }));
    fireEvent.click(screen.getByRole("button", { name: "Replace all" }));
    expect(ref.current!.getMarkdown()).toBe("Stain aisle. stain cans. STAIN sale.\n");
    expect(screen.getByText("No results")).toBeTruthy();
  });

  it("toggles to-do items with their checkbox", async () => {
    const { ref } = await setup({ defaultValue: "- [ ] Order nails\n- [x] Call supplier\n" });
    const boxes = screen.getAllByRole("checkbox", { name: "Done" }) as HTMLInputElement[];
    expect(boxes.map((box) => box.checked)).toEqual([false, true]);
    fireEvent.click(boxes[0]!);
    expect(ref.current!.getMarkdown()).toBe("- [x] Order nails\n- [x] Call supplier\n");
  });

  it("anchors comments to the selection and resolves them", async () => {
    const onCommentsChange = vi.fn();
    const { editor, select } = await setup({ comments: [], onCommentsChange, author: "Ana" });
    select(8, 13);
    fireEvent.click(screen.getByRole("button", { name: "Add comment" }));
    fireEvent.change(await screen.findByRole("textbox", { name: "Comment" }), { target: { value: "Say good morning instead" } });
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));
    const added = onCommentsChange.mock.lastCall![0];
    expect(added).toEqual([expect.objectContaining({ body: "Say good morning instead", author: "Ana" })]);
    expect(editor.querySelector(`[data-comment-id="${added[0].id}"]`)?.textContent).toBe("Hello");
  });

  it("shows comment threads in document order and removes the anchor on resolve", async () => {
    const onCommentsChange = vi.fn();
    const comments = [{ id: "c1", body: "Check the date", author: "Ben" }];
    const { editor } = await setup({ defaultValue: "Opening day is Saturday.", comments, onCommentsChange });
    expect(screen.getByText("The commented text was deleted")).toBeTruthy();
    expect(editor.querySelector(".rich-text-comment")).toBeNull();
    const panel = screen.getByRole("complementary", { name: "Comments" });
    fireEvent.click(within(panel).getByRole("button", { name: "Resolve" }));
    expect(onCommentsChange).toHaveBeenCalledWith([{ ...comments[0], resolved: true }]);
  });

  it("rejects unsafe link URLs and applies safe ones", async () => {
    const { ref, select } = await setup();
    select(8, 13);
    fireEvent.click(screen.getByRole("button", { name: "Link" }));
    const input = await screen.findByRole("textbox", { name: "URL" });
    fireEvent.change(input, { target: { value: "javascript:alert(1)" } });
    fireEvent.click(screen.getByRole("button", { name: "Add link" }));
    expect(screen.getByRole("alert").textContent).toContain("Use a web, mail or phone link");
    fireEvent.change(input, { target: { value: "https://example.com/hours" } });
    fireEvent.click(screen.getByRole("button", { name: "Add link" }));
    expect(ref.current!.getMarkdown()).toBe("# Title\n\n[Hello](https://example.com/hours) world\n");
  });

  it("follows a controlled value without echoing it back", async () => {
    const onValueChange = vi.fn();
    const { rerender } = render(<RichTextEditor value="First" onValueChange={onValueChange} />);
    const editor = await screen.findByRole("textbox", { name: "Document" });
    rerender(<RichTextEditor value="Second **bold**" onValueChange={onValueChange} />);
    expect(editor.textContent).toBe("Second bold");
    expect(onValueChange).not.toHaveBeenCalledWith("Second **bold**\n");
  });

  it("adopts a caret the browser moved before ProseMirror read it", async () => {
    const { ref, editor, view } = await setup();
    act(() => editor.focus());
    const text = editor.querySelector("p")!.firstChild!;
    const range = document.createRange();
    range.setStart(text, 5);
    range.collapse(true);
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    expect(view().state.selection.from).not.toBe(13);
    fireEvent.keyDown(editor, { key: "x" });
    expect(view().state.selection.from).toBe(13);
    act(() => ref.current!.insertText("!"));
    expect(ref.current!.getMarkdown()).toBe("# Title\n\nHello! world\n");
  });

  it("renders read-only without a toolbar", async () => {
    render(<RichTextEditor defaultValue="Locked" readOnly />);
    const editor = await screen.findByRole("textbox", { name: "Document" });
    expect(editor.getAttribute("contenteditable")).toBe("false");
    expect(screen.queryByRole("toolbar", { name: "Formatting" })).toBeNull();
  });
});
