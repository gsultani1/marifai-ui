// packages/ai-ui/test/page-builder.test.tsx
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  type BuilderDocument,
  builderToHtml,
  canContain,
  createBuilderBlock,
  createBuilderDocument,
  duplicateBuilderBlock,
  findBuilderBlock,
  insertBuilderBlock,
  moveBuilderBlock,
  normalizeBuilderDocument,
  nudgeBuilderBlock,
  PageBuilder,
  removeBuilderBlock,
  renderLeafHtml,
  ROOT_CONTAINER,
  setColumnCount,
} from "../src/index.js";

const DESIGN: BuilderDocument = {
  title: "Spring sale",
  preheader: "20% off this weekend",
  settings: { width: 600, background: "#f4f4f5", contentBackground: "#ffffff", fontFamily: "Arial, Helvetica, sans-serif", textColor: "#1f2937", linkColor: "#1d4ed8", padding: 24 },
  blocks: [
    { id: "title", type: "heading", text: "Spring sale", level: 1, align: "center" },
    { id: "intro", type: "text", html: '<p>Hi <a href="https://example.com">neighbor</a></p><p>Perennials from $6.99.</p>' },
    {
      id: "deals",
      type: "columns",
      gap: 16,
      columns: [
        { id: "left", blocks: [{ id: "paint", type: "heading", text: "Paint", level: 3, align: "left" }] },
        { id: "right", blocks: [] },
      ],
    },
    { id: "cta", type: "button", label: "Shop now", href: "https://example.com/spring", align: "center", background: "#1d4ed8", color: "#ffffff", radius: 6, fullWidth: false },
  ],
};

const order = (doc: BuilderDocument) => doc.blocks.map((block) => block.id);
const columnBlocks = (doc: BuilderDocument, column: number) => {
  const block = doc.blocks.find((item) => item.type === "columns");
  return block?.type === "columns" ? block.columns[column]!.blocks : [];
};

describe("page builder model", () => {
  it("normalizes stored designs: drops unknown and misplaced blocks and clamps values", () => {
    const doc = normalizeBuilderDocument({
      settings: { width: 99_999, textColor: "red;background:url(x)", fontFamily: "Arial; color:red" },
      blocks: [
        { id: "ok", type: "spacer", height: 9000 },
        { type: "marquee" },
        { id: "outer", type: "section", blocks: [{ id: "inner", type: "section", blocks: [] }, { id: "pic", type: "image", src: "https://example.com/a.png", width: 400 }] },
        { id: "cols", type: "columns", columns: [{ id: "c1", blocks: [{ id: "nested", type: "columns", columns: [] }, { id: "h", type: "heading", text: "Hi", level: 9 }] }] },
      ],
    });
    expect(doc.settings.width).toBe(1400);
    expect(doc.settings.textColor).toBe("#1f2937");
    expect(doc.settings.fontFamily).toBe("Arial, Helvetica, sans-serif");
    expect(doc.blocks.map((block) => block.type)).toEqual(["spacer", "section", "columns"]);
    expect(doc.blocks[0]).toMatchObject({ height: 200 });
    expect(doc.blocks[1]).toMatchObject({ blocks: [{ id: "pic", width: 100 }] });
    const columns = doc.blocks[2]!;
    expect(columns.type === "columns" && columns.columns.length).toBe(2);
    expect(columns.type === "columns" && columns.columns[0]!.blocks).toEqual([{ id: "h", type: "heading", text: "Hi", level: 2, align: "left" }]);
  });

  it("stores only normalized colors, so crafted values cannot reach the exported HTML", () => {
    const payload = 'rgb(1,2,3)" onmouseover="alert(1))';
    const doc = normalizeBuilderDocument({ settings: { background: payload, textColor: "RGB(0, 128, 255)" }, blocks: [{ id: "s", type: "section", background: payload, blocks: [{ id: "h", type: "heading", text: "Hi", level: 1, color: payload }] }] });
    expect(doc.settings.background).toBe("#f4f4f5");
    expect(doc.settings.textColor).toBe("#0080ff");
    expect(doc.blocks[0]).toMatchObject({ background: "#f8fafc", blocks: [{ id: "h" }] });
    expect(doc.blocks[0]!.type === "section" && "color" in doc.blocks[0]!.blocks[0]!).toBe(false);
    for (const target of ["email", "web"] as const) expect(builderToHtml(doc, { target })).not.toContain("onmouseover");
  });

  it("enforces nesting rules and moves blocks between containers", () => {
    expect(canContain(DESIGN, ROOT_CONTAINER, "section")).toBe(true);
    expect(canContain(DESIGN, "left", "columns")).toBe(false);
    expect(canContain(DESIGN, "left", "button")).toBe(true);
    expect(insertBuilderBlock(DESIGN, createBuilderBlock("section"), "left", 0)).toBe(DESIGN);

    const moved = moveBuilderBlock(DESIGN, "cta", "right", 0);
    expect(order(moved)).toEqual(["title", "intro", "deals"]);
    expect(findBuilderBlock(moved, "cta")).toMatchObject({ containerId: "right", index: 0, depth: 1 });
    expect(order(moveBuilderBlock(DESIGN, "title", ROOT_CONTAINER, 2))).toEqual(["intro", "title", "deals", "cta"]);
    expect(order(nudgeBuilderBlock(DESIGN, "intro", 1))).toEqual(["title", "deals", "intro", "cta"]);
    expect(nudgeBuilderBlock(DESIGN, "title", -1)).toBe(DESIGN);
    expect(order(removeBuilderBlock(DESIGN, "deals"))).toEqual(["title", "intro", "cta"]);
  });

  it("duplicates with fresh ids all the way down and merges columns when reducing", () => {
    const { doc, id } = duplicateBuilderBlock(DESIGN, "deals");
    const copy = findBuilderBlock(doc, id!)!.block;
    expect(findBuilderBlock(doc, id!)?.index).toBe(3);
    expect(copy.type === "columns" && copy.columns.map((column) => column.id)).not.toEqual(["left", "right"]);
    expect(copy.type === "columns" && copy.columns[0]!.blocks[0]!.id).not.toBe("paint");
    const three = setColumnCount({ id: "c", type: "columns", gap: 8, columns: [{ id: "a", blocks: [] }, { id: "b", blocks: [] }] }, 3);
    expect(three.columns).toHaveLength(3);
    const back = setColumnCount({ ...three, columns: [three.columns[0]!, three.columns[1]!, { id: "z", blocks: [createBuilderBlock("spacer") as never] }] }, 2);
    expect(back.columns[1]!.blocks).toHaveLength(1);
  });

  it("escapes, checks and sanitizes everything it renders", () => {
    const context = { target: "email" as const, settings: DESIGN.settings, available: 552 };
    expect(renderLeafHtml({ id: "h", type: "heading", text: '<img src=x onerror="alert(1)">', level: 2, align: "left" }, context)).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(renderLeafHtml({ id: "b", type: "button", label: "Go", href: "javascript:alert(1)", align: "center", background: "url(x)", color: "#fff", radius: 4, fullWidth: false }, context)).toMatch(/bgcolor="#1d4ed8".*href="#"/s);
    expect(renderLeafHtml({ id: "i", type: "image", src: "javascript:alert(1)", alt: "", width: 100, align: "center" }, context)).toBe("");
    expect(renderLeafHtml({ id: "i", type: "image", src: "", alt: "", width: 100, align: "center" }, { ...context, editing: true })).toContain("Add an image");
    const text = renderLeafHtml({ id: "t", type: "text", html: '<p onclick="x()">Hi <a href="https://example.com">there</a></p><div data-embed="iframe"><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe></div><script>bad()</script>' }, context);
    expect(text).not.toMatch(/onclick|script|iframe/);
    expect(text).toContain('<a href="https://example.com/" rel="noopener noreferrer nofollow" style="color: rgb(29, 78, 216); text-decoration: underline;">there</a>');
    expect(text).toMatch(/<p style="margin: 0px[ 0px]*;">Hi/);
  });

  it("builds email HTML with tables, inline styles, a preheader and Outlook guards", () => {
    const html = builderToHtml({ ...DESIGN, blocks: [...DESIGN.blocks, { id: "clip", type: "video", url: "https://youtu.be/dQw4w9WgXcQ?t=30", title: "Store tour" }] }, { target: "email" });
    expect(html).toMatch(/^<!doctype html><html lang="en"/);
    expect(html).toContain('<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">20% off this weekend</div>');
    expect(html).toContain("<!--[if mso]><table role=\"presentation\" width=\"600\"");
    expect(html).toContain('<td class="pb-col" width="50%" valign="top"');
    expect(html).toContain('<td bgcolor="#1d4ed8" style="background:#1d4ed8;border-radius:6px;text-align:center"><a href="https://example.com/spring"');
    expect(html).toContain('<a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ&amp;t=30s" style="display:block"><img src="https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" alt="Play: Store tour"');
    expect(html).not.toContain("<iframe");
  });

  it("builds a responsive web page with players and flex columns", () => {
    const html = builderToHtml({ ...DESIGN, blocks: [...DESIGN.blocks, { id: "clip", type: "video", url: "https://vimeo.com/76979871", title: "Tour" }] }, { target: "web", lang: "es" });
    expect(html).toContain('<html lang="es">');
    expect(html).toContain('<div class="pb-cols" style="display:flex;gap:16px;padding:0 24px">');
    expect(html).toContain("@media (max-width:600px){.pb-cols{flex-direction:column}}");
    expect(html).toContain('<iframe src="https://player.vimeo.com/video/76979871" title="Tour" loading="lazy"');
    expect(html).toContain('sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"');
  });
});

function setup(props: Partial<Parameters<typeof PageBuilder>[0]> = {}) {
  const onValueChange = vi.fn();
  render(<PageBuilder defaultValue={DESIGN} onValueChange={onValueChange} label="Sale email" {...props} />);
  const canvas = screen.getByRole("region", { name: "Sale email canvas" });
  const block = (name: RegExp | string) => within(canvas).getByRole("group", { name });
  const last = () => onValueChange.mock.calls.at(-1)![0] as BuilderDocument;
  const status = () => within(screen.getByRole("group", { name: "Sale email actions" })).getByRole("status");
  return { onValueChange, canvas, block, last, status };
}

describe("PageBuilder", () => {
  it("adds blocks after the selection, selects them and edits them in the settings panel", () => {
    const { block, last, onValueChange } = setup();
    fireEvent.click(block("Heading: Spring sale"));
    fireEvent.click(screen.getByRole("button", { name: "Add Button" }));
    expect(order(last())).toEqual(["title", expect.stringMatching(/^button-/), "intro", "deals", "cta"]);
    const panel = screen.getByRole("complementary", { name: "Block settings" });
    const label = within(panel).getByRole("textbox", { name: "Label" });
    fireEvent.change(label, { target: { value: "B" } });
    fireEvent.change(label, { target: { value: "Bo" } });
    fireEvent.change(label, { target: { value: "Book a visit" } });
    expect(block("Button: Book a visit").textContent).toBe("Book a visit");
    const calls = onValueChange.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onValueChange.mock.calls.length).toBe(calls + 1);
    expect(screen.getAllByRole("group", { name: "Button: Shop now" })).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(order(last())).toEqual(["title", "intro", "deals", "cta"]);
  });

  it("adds into an empty column when a columns block is selected", () => {
    const { block, last } = setup();
    fireEvent.click(block("2 columns"));
    fireEvent.click(screen.getByRole("button", { name: "Add Text" }));
    expect(columnBlocks(last(), 1).map((block) => block.type)).toEqual(["text"]);
  });

  it("moves, duplicates and deletes blocks from the keyboard, with undo", () => {
    const { block, last, status } = setup();
    const intro = block(/^Text: Hi neighbor/);
    act(() => intro.focus());
    fireEvent.keyDown(intro, { key: "ArrowDown", altKey: true });
    expect(order(last())).toEqual(["title", "deals", "intro", "cta"]);
    fireEvent.keyDown(block(/^Text: Hi neighbor/), { key: "d", ctrlKey: true });
    expect(last().blocks).toHaveLength(5);
    fireEvent.keyDown(block("Heading: Paint"), { key: "ArrowRight", altKey: true });
    expect(findBuilderBlock(last(), "paint")?.containerId).toBe("right");
    fireEvent.keyDown(block("Button: Shop now"), { key: "Delete" });
    expect(order(last())).not.toContain("cta");
    expect(status().textContent).toBe("Deleted button. Press Ctrl+Z to undo.");
    fireEvent.keyDown(screen.getByRole("region", { name: "Sale email canvas" }), { key: "z", ctrlKey: true });
    expect(order(last())).toContain("cta");
  });

  it("drops palette blocks and existing blocks into containers", () => {
    const { canvas, block, last } = setup();
    const dataTransfer = { setData: vi.fn(), effectAllowed: "", dropEffect: "" };
    const right = canvas.querySelector('[data-container-id="right"]')!;
    fireEvent.dragStart(screen.getByRole("button", { name: "Add Image" }), { dataTransfer });
    fireEvent.dragOver(right, { dataTransfer, clientY: 10 });
    fireEvent.drop(right, { dataTransfer });
    expect(columnBlocks(last(), 1).map((block) => block.type)).toEqual(["image"]);

    fireEvent.dragStart(block("Heading: Spring sale"), { dataTransfer });
    const root = canvas.querySelector(`[data-container-id="${ROOT_CONTAINER}"]`)!;
    fireEvent.dragOver(root, { dataTransfer, clientY: 10 });
    fireEvent.drop(root, { dataTransfer });
    expect(order(last()).at(-1)).toBe("title");

    fireEvent.dragStart(screen.getByRole("button", { name: "Add Section" }), { dataTransfer });
    fireEvent.dragOver(right, { dataTransfer, clientY: 10 });
    fireEvent.drop(right, { dataTransfer });
    expect(last().blocks.at(-1)?.type).toBe("section");
    expect(findBuilderBlock(last(), last().blocks.at(-1)!.id)?.containerId).toBe(ROOT_CONTAINER);
  });

  it("edits text blocks with the HTML editor and document settings when nothing is selected", async () => {
    const { block, last } = setup();
    const panel = screen.getByRole("complementary", { name: "Design settings" });
    fireEvent.change(within(panel).getByRole("textbox", { name: "Preview text" }), { target: { value: "Last chance" } });
    expect(last().preheader).toBe("Last chance");
    fireEvent.click(block(/^Text: Hi neighbor/));
    const editor = await screen.findByRole("textbox", { name: "Text block content" });
    expect(editor.textContent).toContain("Perennials from $6.99.");
    expect(screen.queryByRole("button", { name: "Insert table" })).toBeNull();
    expect(screen.queryByRole("button", { name: "HTML source" })).toBeNull();
  });

  it("warns about low button contrast", () => {
    const { block } = setup();
    fireEvent.click(block("Button: Shop now"));
    expect(screen.queryByText(/Low contrast/)).toBeNull();
    const panel = screen.getByRole("complementary", { name: "Block settings" });
    fireEvent.click(within(panel).getByRole("button", { name: /Text color/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Hex color" }), { target: { value: "#3b82f6" } });
    fireEvent.blur(screen.getByRole("textbox", { name: "Hex color" }));
    expect(screen.getByText(/Low contrast \(1\.\d:1\)/)).toBeTruthy();
  });

  it("previews the real output in a sandboxed frame and copies it", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const { status } = setup();
    fireEvent.click(screen.getByRole("radio", { name: "Preview" }));
    const frame = screen.getByTitle("Sale email preview") as HTMLIFrameElement;
    expect(frame.getAttribute("sandbox")).toBe("");
    expect(frame.getAttribute("srcdoc")).toContain('role="presentation"');
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Copy email HTML" }));
    await waitFor(() => expect(status().textContent).toBe("Copied HTML"));
    expect(String((writeText.mock.calls[0] as unknown[])[0])).toContain("Spring sale");
  });

  it("opens a design file and rejects files that are not designs", async () => {
    const { last, status } = setup();
    const input = document.querySelector<HTMLInputElement>('input[accept="application/json,.json"]')!;
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File([JSON.stringify(createBuilderDocument("email", [createBuilderBlock("divider")]))], "design.json", { type: "application/json" })] } });
    });
    await waitFor(() => expect(last().blocks.map((block) => block.type)).toEqual(["divider"]));
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File(["not json"], "notes.json", { type: "application/json" })] } });
    });
    await waitFor(() => expect(status().textContent).toBe("notes.json isn't a design file"));
  });

  it("adopts a new controlled value", () => {
    const { rerender } = render(<PageBuilder value={DESIGN} label="Controlled" />);
    rerender(<PageBuilder value={{ ...DESIGN, blocks: [DESIGN.blocks[0]!] }} label="Controlled" />);
    expect(within(screen.getByRole("region", { name: "Controlled canvas" })).getAllByRole("group")).toHaveLength(1);
  });
});
