// packages/ai-ui/test/html-editor.test.tsx
import { EditorView as CodeMirrorView } from "@codemirror/view";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NodeSelection, TextSelection } from "prosemirror-state";
import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { cleanPastedHtml, docToHtml, embedFromUrl, formatHtml, HtmlEditor, type HtmlEditorHandle, htmlToDoc, htmlToText, sanitizeHtml, safeCssColor, safeFontSize } from "../src/index.js";
import { RICH_TEXT_EVENTS } from "../src/lib/rich-text/events.js";
import { headingSlug, safeAuthor, safeMarkId, safeTimestamp, tocHeadings } from "../src/lib/rich-text/html.js";

describe("HTML sanitizing", () => {
  it("keeps allowed structure and styles and drops scripts, handlers and unsafe URLs", () => {
    const html = sanitizeHtml(
      [
        '<h2 style="text-align: justify">Hours</h2>',
        '<p onclick="steal()" style="margin-left: 80px">Open <a href="javascript:alert(1)">daily</a> <a href="https://example.com/x" target="_blank">here</a></p>',
        "<script>alert(1)</script><style>p{color:red}</style>",
        '<p><span style="color: rgb(185, 28, 28); font-size: 12pt; font-family: Georgia, serif">Sale</span> <span style="font-family: expression(alert(1))">plain</span></p>',
        '<p><img src="javascript:alert(1)"><img src="https://example.com/a.png" alt="Shelf" width="240" onerror="x()"></p>',
      ].join(""),
    );
    expect(html).toBe(
      '<h2 style="text-align: justify;">Hours</h2>' +
        '<p style="margin-left: 80px;">Open daily <a href="https://example.com/x" rel="noopener noreferrer nofollow">here</a></p>' +
        '<p><span style="font-family: Georgia, serif;"><span style="font-size: 16px;"><span style="color: rgb(185, 28, 28);">Sale</span></span></span> plain</p>' +
        '<p><img src="https://example.com/a.png" alt="Shelf" width="240"></p>',
    );
  });

  it("allows embeds only from YouTube, Vimeo, Loom and https video files", () => {
    const html = sanitizeHtml('<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe><iframe src="https://evil.example/embed"></iframe><video src="http://example.com/clip.mp4"></video>');
    expect(html).toContain('<div data-embed="iframe"><iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" title="YouTube video"');
    expect(html).toContain('sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"');
    expect(html).not.toContain("evil.example");
    expect(html).not.toContain("clip.mp4");
  });

  it("normalizes embed links", () => {
    expect(embedFromUrl("https://youtu.be/dQw4w9WgXcQ?t=1m30s")).toEqual({ kind: "iframe", provider: "YouTube", src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90" });
    expect(embedFromUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.src).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(embedFromUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")?.src).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(embedFromUrl("https://vimeo.com/76979871/abc123def")?.src).toBe("https://player.vimeo.com/video/76979871?h=abc123def");
    expect(embedFromUrl("https://www.loom.com/share/0123456789abcdef0123456789abcdef")?.src).toBe("https://www.loom.com/embed/0123456789abcdef0123456789abcdef");
    expect(embedFromUrl("https://cdn.example.com/tour.mp4")).toEqual({ kind: "video", provider: "Video", src: "https://cdn.example.com/tour.mp4" });
    expect(embedFromUrl("https://www.youtube.com/watch?v=<script>")).toBeNull();
    expect(embedFromUrl("javascript:alert(1)")).toBeNull();
    expect(embedFromUrl("https://example.com/page")).toBeNull();
  });

  it("normalizes colors and sizes and rejects anything that could escape a style attribute", () => {
    expect(safeCssColor("RGB(0, 128, 255)")).toBe("#0080ff");
    expect(safeCssColor("rebeccapurple")).toBe("rebeccapurple");
    expect(safeCssColor("red;background:url(x)")).toBeNull();
    expect(safeCssColor("transparent")).toBeNull();
    expect(safeFontSize("11pt")).toBe("15px");
    expect(safeFontSize("x-large")).toBe("24px");
    expect(safeFontSize("900px")).toBeNull();
  });

  it("serializes an empty document as an empty string and extracts text without a DOM", () => {
    expect(docToHtml(htmlToDoc("<p></p>"))).toBe("");
    expect(htmlToText("<p>Fish &amp; chips</p><script>bad()</script><ul><li>One</li><li>Two&nbsp;more</li></ul>")).toBe("Fish & chips\nOne\nTwo more");
  });

  it("formats source with block elements on indented lines and round-trips it", () => {
    const html = sanitizeHtml("<p>Intro <strong>bold</strong></p><ul><li><p>One</p><ul><li><p>Nested</p></li></ul></li></ul><pre><code>a\n  b</code></pre>");
    const formatted = formatHtml(html);
    expect(formatted).toBe(
      ["<p>Intro <strong>bold</strong></p>", "<ul>", "  <li>", "    <p>One</p>", "    <ul>", "      <li>", "        <p>Nested</p>", "      </li>", "    </ul>", "  </li>", "</ul>", "<pre><code>a\n  b</code></pre>"].join("\n"),
    );
    expect(sanitizeHtml(formatted)).toBe(html);
  });
});

describe("document blocks and review marks", () => {
  it("keeps captioned figures with a safe source, width and alignment", () => {
    const html = sanitizeHtml('<figure style="float: right"><img src="https://example.com/drill.jpg" alt="Drill" width="300" onerror="x()"><figcaption>Cordless <strong>drill</strong></figcaption></figure>');
    expect(html).toBe('<figure data-align="right" style="float: right; margin: 0.25em 0px 1em 1.5em; max-width: 50%; width: 300px;"><img src="https://example.com/drill.jpg" alt="Drill" width="300" style="max-width: 100%; height: auto;"><figcaption>Cordless <strong>drill</strong></figcaption></figure>');
    expect(sanitizeHtml(html)).toBe(html);
    expect(sanitizeHtml('<figure data-align="wide"><img src="https://example.com/a.png" alt=""></figure>')).toContain('<img src="https://example.com/a.png" alt="" style="width: 100%; height: auto;">');
    expect(sanitizeHtml('<figure><img src="javascript:alert(1)"><figcaption>Bad</figcaption></figure>')).not.toContain("<figure");
    expect(sanitizeHtml('<figure data-align="sideways"><img src="https://example.com/a.png"></figure>')).toContain('data-align="center"');
  });

  it("keeps callouts with known tones, two and three columns, page breaks and cell colors", () => {
    expect(sanitizeHtml('<aside data-callout="warning"><p>Wear gloves.</p></aside>')).toBe('<aside data-callout="warning"><p>Wear gloves.</p></aside>');
    expect(sanitizeHtml('<aside data-callout="purple" onclick="x()"><p>x</p></aside>')).toBe('<aside data-callout="info"><p>x</p></aside>');
    const columns = '<div data-columns="3"><div data-column=""><p>A</p></div><div data-column=""><p>B</p></div><div data-column=""><p>C</p></div></div>';
    expect(sanitizeHtml(columns)).toBe('<div data-columns="3" style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px;"><div data-column=""><p>A</p></div><div data-column=""><p>B</p></div><div data-column=""><p>C</p></div></div>');
    expect(sanitizeHtml('<table><tr><td data-colwidth="180"><p>Item</p></td><td colspan="2" data-colwidth="90,120"><p>Qty</p></td></tr></table>')).toContain('<table><colgroup><col style="width: 180px"><col style="width: 90px"><col style="width: 120px"></colgroup><tbody>');
    expect(sanitizeHtml("<p>One</p><div data-page-break></div><p>Two</p>")).toBe('<p>One</p><div data-page-break="" style="break-after: page; page-break-after: always;"></div><p>Two</p>');
    const pastedCell = '<table><tr><td style="background-color: #fef3c7">Low</td><td style="background-color: #ffffff">Plain</td></tr></table>';
    expect(cleanPastedHtml(pastedCell, { keepStyles: true })).toContain('<td data-background="rgb(254, 243, 199)">Low</td>');
    expect(cleanPastedHtml(`<p class="MsoNormal">x</p>${pastedCell}`, { keepStyles: true })).toContain('<td data-background="rgb(254, 243, 199)">Low</td><td>Plain</td>');
    expect(cleanPastedHtml(`<p class="MsoNormal">x</p>${pastedCell}`)).not.toContain("background");
    expect(sanitizeHtml('<table><tr><td style="background-color: rgb(254, 243, 199)"><p>Low</p></td><td style="background-color: url(x)"><p>x</p></td></tr></table>')).toContain('<td style="background-color: rgb(254, 243, 199);"><p>Low</p></td><td><p>x</p></td>');
  });

  it("fills the table of contents with links to slugged headings and parses it back to one block", () => {
    const html = sanitizeHtml('<nav data-toc><ol><li><a href="javascript:x()">stale</a></li></ol></nav><h1>Spring Sale</h1><p>x</p><h2>Paint &amp; Stain</h2><h2>Spring Sale</h2><h4>Too deep</h4>');
    expect(html).toBe(
      '<nav data-toc="" aria-label="Table of contents"><ol><li data-level="1"><a href="#spring-sale">Spring Sale</a></li><li data-level="2"><a href="#paint-stain">Paint &amp; Stain</a></li><li data-level="2"><a href="#spring-sale-2">Spring Sale</a></li></ol></nav><h1 id="spring-sale">Spring Sale</h1><p>x</p><h2 id="paint-stain">Paint &amp; Stain</h2><h2 id="spring-sale-2">Spring Sale</h2><h4>Too deep</h4>',
    );
    expect(sanitizeHtml(html)).toBe(html);
    expect(tocHeadings(htmlToDoc(html)).map((heading) => heading.text)).toEqual(["Spring Sale", "Paint & Stain", "Spring Sale"]);
    expect(headingSlug("Café crème", new Set())).toBe("cafe-creme");
    expect(headingSlug("!!!", new Set())).toBe("section");
  });

  it("numbers footnotes, lists them at the end linked both ways and round-trips", () => {
    const html = sanitizeHtml('<p>Primer<sup data-footnote="Per the label on the can.">*</sup> then paint<sup data-footnote="Two coats &lt;b&gt;minimum&lt;/b&gt;.">x</sup>.</p>');
    expect(html).toBe(
      '<p>Primer<sup data-footnote="Per the label on the can." id="fnref-1"><a href="#fn-1">1</a></sup> then paint<sup data-footnote="Two coats <b>minimum</b>." id="fnref-2"><a href="#fn-2">2</a></sup>.</p><section data-footnotes="" aria-label="Footnotes"><ol><li id="fn-1">Per the label on the can. <a href="#fnref-1" aria-label="Back to reference 1">↩</a></li><li id="fn-2">Two coats &lt;b&gt;minimum&lt;/b&gt;. <a href="#fnref-2" aria-label="Back to reference 2">↩</a></li></ol></section>',
    );
    expect(sanitizeHtml(html)).toBe(html);
  });

  it("keeps comments and tracked changes with valid ids, authors and dates", () => {
    expect(sanitizeHtml('<p><span data-comment-id="c-1">checked</span> <span data-comment-id="bad id!">dropped</span></p>')).toBe('<p><span data-comment-id="c-1">checked</span> dropped</p>');
    expect(sanitizeHtml('<p><ins data-change-id="ch1" data-author="Dana" data-date="2026-10-25T14:00:00Z">new</ins><del data-change-id="ch2" data-date="yesterday">old</del><del>struck</del></p>')).toBe('<p><ins data-change-id="ch1" data-author="Dana" data-date="2026-10-25T14:00:00Z">new</ins><del data-change-id="ch2">old</del><s>struck</s></p>');
    expect(safeMarkId("a".repeat(65))).toBeNull();
    expect(safeAuthor(" Dana\u0007 Ortiz ")).toBe("Dana Ortiz");
    expect(safeTimestamp("2026-10-25T14:00:00.123+02:00")).toBe("2026-10-25T14:00:00.123+02:00");
    expect(safeTimestamp("2026-10-25")).toBe("");
  });
});

describe("paste cleanup", () => {
  const word = [
    '<html xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta name=Generator content="Microsoft Word 15"><style>p.MsoNormal{margin:0}</style></head><body>',
    '<p class=MsoNormal style="mso-margin-top-alt:auto"><span style="font-family:Calibri;font-size:11.0pt;color:black">Weekly <b>checklist</b></span><span style="color:#C00000">urgent</span><o:p></o:p></p>',
    '<p class=MsoNormal><o:p>&nbsp;</o:p></p>',
    "<!--[if !supportLists]-->",
    '<p class=MsoListParagraphCxSpFirst style="text-indent:-.25in;mso-list:l0 level1 lfo1"><span style="font-family:Symbol"><span style="mso-list:Ignore">·<span style="font:7.0pt">&nbsp;&nbsp;</span></span></span>Count drawers</p>',
    '<p class=MsoListParagraphCxSpMiddle style="mso-list:l0 level2 lfo1"><span style="mso-list:Ignore">o<span>&nbsp;</span></span>Two people</p>',
    '<p class=MsoListParagraphCxSpLast style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">·<span>&nbsp;</span></span>Lock up</p>',
    '<p class=MsoListParagraphCxSpFirst style="mso-list:l1 level1 lfo2"><span style="mso-list:Ignore">1.<span>&nbsp;</span></span>First</p>',
    '<p class=MsoListParagraphCxSpLast style="mso-list:l1 level1 lfo2"><span style="mso-list:Ignore">2.<span>&nbsp;</span></span>Second</p>',
    "</body></html>",
  ].join("");

  it("turns Word list paragraphs into nested lists and drops spacers, metadata and styles", () => {
    const html = sanitizeHtml(cleanPastedHtml(word));
    expect(html).toBe(
      "<p>Weekly <strong>checklist</strong>urgent</p>" +
        "<ul><li><p>Count drawers</p><ul><li><p>Two people</p></li></ul></li><li><p>Lock up</p></li></ul>" +
        "<ol><li><p>First</p></li><li><p>Second</p></li></ol>",
    );
  });

  it("keeps chosen colors but not Office defaults when styles are kept", () => {
    const html = sanitizeHtml(cleanPastedHtml(word, { keepStyles: true }));
    expect(html).toContain('<p>Weekly <strong>checklist</strong><span style="color: rgb(192, 0, 0);">urgent</span></p>');
    expect(html).not.toContain("Calibri");
    expect(html).not.toContain("font-size");
  });

  it("reads Google Docs formatting and ignores its bold wrapper", () => {
    const docs = '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1234"><p dir="ltr" style="line-height:1.38;margin-top:0pt"><span style="font-size:11pt;font-family:Arial;color:#000000;background-color:transparent;font-weight:700">Bold</span><span style="font-size:11pt;font-family:Arial;color:#000000;font-style:italic;vertical-align:super"> note</span></p></b>';
    expect(sanitizeHtml(cleanPastedHtml(docs))).toBe("<p><strong>Bold</strong><em><sup> note</sup></em></p>");
  });

  it("keeps styles in HTML copied from the editor itself", () => {
    const copied = '<p data-pm-slice="1 1 []"><span style="color: #1d4ed8">Blue</span></p>';
    expect(sanitizeHtml(cleanPastedHtml(copied))).toBe('<p><span style="color: rgb(29, 78, 216);">Blue</span></p>');
  });
});

async function setup(props: Partial<Parameters<typeof HtmlEditor>[0]> = {}) {
  const ref = createRef<HtmlEditorHandle>();
  const onValueChange = vi.fn();
  render(<HtmlEditor ref={ref} defaultValue="<h1>Title</h1><p>Hello world</p>" onValueChange={onValueChange} {...props} />);
  const editor = await screen.findByRole("textbox", { name: props["aria-label"] ?? "Document" });
  const view = () => ref.current!.getView()!;
  const select = (from: number, to = from) =>
    act(() => {
      view().dispatch(view().state.tr.setSelection(TextSelection.create(view().state.doc, from, to)));
    });
  return { ref, editor, view, select, onValueChange };
}

describe("HtmlEditor", () => {
  it("shows the text on the server and while loading, without markup", () => {
    const markup = renderToStaticMarkup(<HtmlEditor defaultValue={'<p>Fresh <b>paint</b></p><script>alert("x")</script>'} />);
    expect(markup).toContain("Fresh paint");
    expect(markup).not.toContain("<script");
    expect(markup).not.toContain("<b>");
  });

  it("loads lazily, renders HTML and applies toolbar formatting", async () => {
    const { ref, editor, select, onValueChange } = await setup();
    expect(editor.querySelector("h1")?.textContent).toBe("Title");
    expect(editor.closest('[data-theme="light"]')).not.toBeNull();
    select(8, 13);
    fireEvent.click(screen.getByRole("button", { name: "Bold" }));
    expect(onValueChange).toHaveBeenLastCalledWith("<h1>Title</h1><p><strong>Hello</strong> world</p>");
    fireEvent.click(screen.getByRole("button", { name: "Superscript" }));
    expect(ref.current!.getHTML()).toBe("<h1>Title</h1><p><strong><sup>Hello</sup></strong> world</p>");
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(ref.current!.getHTML()).toBe("<h1>Title</h1><p>Hello world</p>");
  });

  it("sets fonts, sizes and colors and reflects them in the toolbar", async () => {
    const { ref, select } = await setup();
    select(8, 13);
    fireEvent.click(screen.getByRole("button", { name: /Font: Default/ }));
    fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: "Georgia" }));
    fireEvent.click(screen.getByRole("button", { name: /Font size: Size/ }));
    fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: "24 px" }));
    expect(ref.current!.getHTML()).toBe('<h1>Title</h1><p><span style="font-family: Georgia, serif;"><span style="font-size: 24px;">Hello</span></span> world</p>');
    expect(screen.getByRole("button", { name: /Font: Georgia/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Font size: 24/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Text color" }));
    const popup = await screen.findByRole("dialog", { name: "Text color" });
    fireEvent.click(within(popup).getByRole("button", { name: "#1d4ed8" }));
    expect(ref.current!.getHTML()).toContain('<span style="color: rgb(29, 78, 216);">Hello</span>');
    fireEvent.click(within(popup).getByRole("button", { name: "Remove color" }));
    expect(ref.current!.getHTML()).not.toContain("color:");
  });

  it("indents and aligns paragraphs and nests list items", async () => {
    const { ref, select } = await setup();
    select(9);
    expect(screen.getByRole("button", { name: "Decrease indent" }).getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Increase indent" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase indent" }));
    fireEvent.click(screen.getByRole("button", { name: "Align justify" }));
    expect(ref.current!.getHTML()).toBe('<h1>Title</h1><p style="text-align: justify; margin-left: 80px;">Hello world</p>');
    expect(screen.getByRole("button", { name: "Align justify" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Decrease indent" }));
    expect(ref.current!.getHTML()).toContain("margin-left: 40px");
    fireEvent.click(screen.getByRole("button", { name: "Bulleted list" }));
    expect(ref.current!.getHTML()).toMatch(/<ul><li><p style="[^"]*">Hello world<\/p><\/li><\/ul>/);
  });

  it("embeds allowed videos and explains which links work", async () => {
    const { ref, select, editor } = await setup();
    select(19);
    fireEvent.click(screen.getByRole("button", { name: "Embed video" }));
    const link = await screen.findByRole("textbox", { name: /YouTube, Vimeo or Loom link/ });
    fireEvent.change(link, { target: { value: "https://example.com/video" } });
    fireEvent.click(screen.getByRole("button", { name: "Embed" }));
    expect(screen.getByRole("alert").textContent).toContain("Use a YouTube, Vimeo or Loom link");
    fireEvent.change(link, { target: { value: "https://youtu.be/dQw4w9WgXcQ" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Title/ }), { target: { value: "Store tour" } });
    fireEvent.click(screen.getByRole("button", { name: "Embed" }));
    expect(editor.querySelector(".html-embed")?.textContent).toContain("Store tour");
    expect(editor.querySelector("iframe")).toBeNull();
    expect(ref.current!.getHTML()).toContain('<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" title="Store tour"');
  });

  it("inserts, edits and uploads images", async () => {
    const onImageUpload = vi.fn(async (file: File) => `https://cdn.example.com/${file.name}`);
    const { ref, view, select } = await setup({ onImageUpload });
    select(19);
    fireEvent.click(screen.getByRole("button", { name: "Insert image" }));
    fireEvent.change(await screen.findByRole("textbox", { name: "Image URL" }), { target: { value: "https://example.com/aisle.jpg" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Description (alt text)" }), { target: { value: "Aisle 4" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Width in pixels (optional)" }), { target: { value: "320" } });
    fireEvent.click(screen.getByRole("button", { name: "Insert" }));
    expect(ref.current!.getHTML()).toContain('<figure data-align="center" style="margin: 1em auto; text-align: center;"><img src="https://example.com/aisle.jpg" alt="Aisle 4" width="320" style="max-width: 100%; height: auto;"></figure>');
    await waitFor(() => expect(document.querySelector("form")).toBeNull());

    let imagePos = -1;
    view().state.doc.descendants((node, pos) => {
      if (node.type.name === "figure") imagePos = pos;
    });
    act(() => view().dispatch(view().state.tr.setSelection(NodeSelection.create(view().state.doc, imagePos))));
    fireEvent.click(screen.getByRole("button", { name: "Edit image" }));
    const width = await screen.findByRole("spinbutton", { name: "Width in pixels (optional)" });
    expect((width as HTMLInputElement).value).toBe("320");
    fireEvent.change(width, { target: { value: "200" } });
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    expect(ref.current!.getHTML()).toContain('width="200"');
    await waitFor(() => expect(document.querySelector("form")).toBeNull());

    select(3);
    fireEvent.click(screen.getByRole("button", { name: "Insert image" }));
    await screen.findByRole("button", { name: "Upload from your computer" });
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File(["x"], "door.png", { type: "image/png" })] } });
    });
    expect(onImageUpload).toHaveBeenCalledTimes(1);
    expect(ref.current!.getHTML()).toContain('<img src="https://cdn.example.com/door.png" alt="door" style="max-width: 100%; height: auto;">');
    expect(screen.getByRole("status").textContent).toBe("Uploaded door.png");
  });

  it("fills the image dialog from the selected figure when an editor event opens it, and replaces the source on upload", async () => {
    const onImageUpload = vi.fn(async (file: File) => `https://cdn.example.com/${file.name}`);
    const { ref, view } = await setup({ onImageUpload, defaultValue: '<figure><img src="https://example.com/old.jpg" alt="Old sign" width="300"></figure><p>After</p>' });
    act(() => view().dispatch(view().state.tr.setSelection(NodeSelection.create(view().state.doc, 0))));
    act(() => {
      view().dom.dispatchEvent(new CustomEvent(RICH_TEXT_EVENTS.openImage, { bubbles: true }));
    });
    expect(((await screen.findByRole("textbox", { name: "Image URL" })) as HTMLInputElement).value).toBe("https://example.com/old.jpg");
    expect((screen.getByRole("textbox", { name: "Description (alt text)" }) as HTMLInputElement).value).toBe("Old sign");
    expect((screen.getByRole("spinbutton", { name: "Width in pixels (optional)" }) as HTMLInputElement).value).toBe("300");
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File(["x"], "new.png", { type: "image/png" })] } });
    });
    const html = ref.current!.getHTML();
    expect(html.match(/<figure/g)).toHaveLength(1);
    expect(html).toContain('<img src="https://cdn.example.com/new.png" alt="Old sign" width="300"');
    expect(screen.getByRole("status").textContent).toBe("Replaced the image with new.png");
  });

  it("edits the HTML source and sanitizes it when switching back", async () => {
    const { ref, onValueChange } = await setup();
    fireEvent.click(screen.getByRole("button", { name: "HTML source" }));
    expect(screen.getByRole("button", { name: "Bold" }).getAttribute("aria-disabled")).toBe("true");
    const source = await screen.findByRole("textbox", { name: "HTML source" }, { timeout: 10_000 });
    expect(source.textContent).toContain("<h1>Title</h1>");
    const code = CodeMirrorView.findFromDOM(source)!;
    act(() => code.dispatch({ changes: { from: 0, to: code.state.doc.length, insert: '<h2 onclick="x()">New</h2><p>Body<script>bad()</script></p>' } }));
    fireEvent.click(screen.getByRole("button", { name: "HTML source" }));
    expect(ref.current!.getHTML()).toBe("<h2>New</h2><p>Body</p>");
    expect(onValueChange).toHaveBeenLastCalledWith("<h2>New</h2><p>Body</p>");
    expect(screen.getByRole("button", { name: "Bold" }).getAttribute("aria-disabled")).toBe("false");
  });

  it("follows a controlled value without echoing it back", async () => {
    const onValueChange = vi.fn();
    const { rerender } = render(<HtmlEditor value="<p>First</p>" onValueChange={onValueChange} />);
    const editor = await screen.findByRole("textbox", { name: "Document" });
    rerender(<HtmlEditor value="<p>Second <em>take</em></p>" onValueChange={onValueChange} />);
    expect(editor.textContent).toBe("Second take");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("renders read-only without a toolbar", async () => {
    render(<HtmlEditor defaultValue="<p>Locked</p>" readOnly />);
    const editor = await screen.findByRole("textbox", { name: "Document" });
    expect(editor.getAttribute("contenteditable")).toBe("false");
    expect(screen.queryByRole("toolbar", { name: "Formatting" })).toBeNull();
  });
});
