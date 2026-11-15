// packages/ai-ui/test/artifacts-media.test.tsx
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  artifactDocument,
  artifactExtension,
  ArtifactThumbnail,
  ArtifactViewer,
  buildSandboxedDocument,
  createMermaidPreview,
  cropAreaFor,
  CsvExplorer,
  formatMediaTime,
  ImageGallery,
  jsonPath,
  JsonViewer,
  MediaPlayer,
  openSandboxedWindow,
  parseNumericCell,
  PdfViewer,
  profileColumns,
  SlideDeck,
  slidesFromMarkdown,
} from "../src/index.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("artifact helpers", () => {
  it("maps kinds and languages to download extensions", () => {
    expect([artifactExtension("react"), artifactExtension("code", "Python"), artifactExtension("code", "brainfuck"), artifactExtension("mermaid"), artifactExtension("markdown")]).toEqual(["tsx", "py", "txt", "mmd", "md"]);
  });

  it("builds runnable documents with their origins and keeps code out of the markup", () => {
    const mermaid = createMermaidPreview("graph TD; A-->B</script><script>alert(1)");
    expect(mermaid.allowedOrigins).toEqual(["https://cdn.jsdelivr.net"]);
    expect(mermaid.html).not.toContain("</script><script>alert(1)");
    expect(mermaid.html).toContain('securityLevel: "strict"');
    expect(artifactDocument("markdown", "# Hi")).toBeNull();
    expect(artifactDocument("react", "export default () => null")?.allowedOrigins).toContain("https://esm.sh");
    const sandboxed = buildSandboxedDocument("<!doctype html><p>x</p>", { allowedOrigins: ["https://cdn.example.com/lib.js", "javascript:alert(1)"] });
    expect(sandboxed.startsWith("<!doctype html><meta http-equiv=\"Content-Security-Policy\"")).toBe(true);
    expect(sandboxed).toContain("https://cdn.example.com");
    expect(sandboxed).not.toContain("javascript:");
    expect(sandboxed).toContain("script-src 'none'");
    expect(artifactDocument("html", "<p>x</p>")?.allowScripts).toBe(true);
    expect(artifactDocument("svg", "<svg/>")?.allowScripts).toBe(false);
    const withModule = buildSandboxedDocument("<body><p>x</p></body>", { allowScripts: true, script: 'console.log("</script>")' });
    expect(withModule).toContain(`<script type="module" src="data:text/javascript;base64,`);
    expect(withModule).toMatch(/<\/script><\/body>$/);
    expect(buildSandboxedDocument("<p>x</p>", { script: "alert(1)" })).not.toContain("<script");
  });

  it("opens previews in a sandboxed frame inside a new window", () => {
    const frameDocument = document.implementation.createHTMLDocument("");
    const fakeWindow = { opener: {}, document: frameDocument } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(fakeWindow);
    expect(openSandboxedWindow("<p>Hello</p>", "Demo <page>")).toBe(true);
    expect(fakeWindow.opener).toBeNull();
    let frame = frameDocument.querySelector("iframe")!;
    expect(frame.getAttribute("sandbox")).toBe("allow-forms allow-modals allow-popups allow-downloads");
    expect(frame.srcdoc).toContain("script-src 'none'");
    expect(frameDocument.title).toBe("Demo <page>");
    expect(openSandboxedWindow("<p>Hello</p>", "Demo", { allowScripts: true })).toBe(true);
    frame = frameDocument.querySelector("iframe")!;
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts allow-forms allow-modals allow-popups allow-downloads");
    expect(frame.srcdoc).toContain("script-src 'unsafe-inline'");
    vi.spyOn(window, "open").mockReturnValue(null);
    expect(openSandboxedWindow("<p>x</p>", "x")).toBe(false);
  });
});

describe("ArtifactViewer", () => {
  const versions = [
    { id: "v1", content: "<h1>First</h1>" },
    { id: "v2", content: "<h1>Second</h1>\n<p>More</p>", label: "Added text" },
  ];

  it("shows the latest version, toggles code view and steps back to restore an older one", () => {
    const onRestoreVersion = vi.fn();
    render(<ArtifactViewer title="Landing page" kind="html" versions={versions} onRestoreVersion={onRestoreVersion} />);
    expect(screen.getByText("Version 2 of 2 · Added text")).toBeTruthy();
    expect(screen.getByText("Latest")).toBeTruthy();
    expect(screen.getByTitle("Landing page").tagName).toBe("IFRAME");
    expect(screen.getByText(/Web page · 2 lines/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Code" }));
    expect(screen.getByRole("region", { name: "Landing page" }).textContent).toContain("<h1>Second</h1>");
    fireEvent.click(screen.getByRole("button", { name: "Previous version" }));
    expect(screen.getByText("Version 1 of 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Restore this version" }));
    expect(onRestoreVersion).toHaveBeenCalledWith("v1");
  });

  it("forces code view and shows Building while a runnable artifact streams", () => {
    render(<ArtifactViewer title="Widget" kind="react" content="export default function W() {" streaming />);
    expect(screen.getByText("Building…")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Preview" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Code" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("button", { name: "Open in new tab" })).toBeNull();
  });

  it("collects runtime errors from the preview frame and offers Fix it", () => {
    const onFix = vi.fn();
    render(<ArtifactViewer title="Broken" kind="html" content="<script>boom()</script>" onFix={onFix} />);
    const frame = screen.getByTitle("Broken") as HTMLIFrameElement;
    const post = (message: string) =>
      act(() => {
        window.dispatchEvent(new MessageEvent("message", { data: { source: "ai-ui-preview", type: "error", message }, source: frame.contentWindow }));
      });
    post("ReferenceError: boom is not defined");
    post("ReferenceError: boom is not defined");
    post("TypeError: x");
    const alert = screen.getByRole("alert");
    expect(within(alert).getByText("The preview hit 2 errors")).toBeTruthy();
    fireEvent.click(within(alert).getByRole("button", { name: "Fix it" }));
    expect(onFix).toHaveBeenCalledWith(["ReferenceError: boom is not defined", "TypeError: x"]);
    fireEvent.click(within(alert).getByRole("button", { name: "Dismiss errors" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders markdown, JSON, CSV and SVG previews and code-only kinds", () => {
    const { rerender } = render(<ArtifactViewer title="Notes" kind="markdown" content={"# Plan\n\n- One"} />);
    expect(screen.getByRole("heading", { name: "Plan" })).toBeTruthy();
    rerender(<ArtifactViewer title="Config" kind="json" content='{"store":{"open":true}}' />);
    expect(screen.getByRole("tree", { name: "Config" })).toBeTruthy();
    rerender(<ArtifactViewer title="Sales" kind="csv" content={"item,qty\nnails,4\nscrews,9"} />);
    expect(screen.getByText("2 rows · 2 columns")).toBeTruthy();
    rerender(<ArtifactViewer title="Logo" kind="svg" content='<svg xmlns="http://www.w3.org/2000/svg"><circle r="4"/></svg>' />);
    expect(screen.getByRole("img", { name: "Logo" }).getAttribute("src")).toMatch(/^data:image\/svg\+xml/);
    rerender(<ArtifactViewer title="Script" kind="code" language="python" content="print('hi')" />);
    expect(screen.queryByRole("group", { name: "View" })).toBeNull();
    expect(screen.getByText(/python · 1 line/)).toBeTruthy();
  });
});

describe("ArtifactThumbnail", () => {
  it("renders static previews and reads as its title", () => {
    render(<ArtifactThumbnail title="Logo" subtitle="SVG" kind="svg" content="<svg xmlns='http://www.w3.org/2000/svg'/>" />);
    const card = screen.getByRole("button", { name: "Logo SVG" });
    expect(card.querySelector("img")?.getAttribute("src")).toMatch(/^data:image\/svg/);
  });
});

describe("JsonViewer", () => {
  it("expands, filters, navigates with the keyboard and reports invalid JSON", () => {
    expect(jsonPath(["items", 2, "first name"])).toBe('$.items[2]["first name"]');
    render(<JsonViewer json='{"store":{"name":"Whitten","aisles":[{"id":1},{"id":2}]},"open":true}' label="Store" defaultExpandDepth={2} />);
    const tree = screen.getByRole("tree", { name: "Store" });
    expect(within(tree).getByText('"Whitten"')).toBeTruthy();
    expect(within(tree).queryByText("aisles")).toBeTruthy();
    fireEvent.keyDown(tree, { key: "ArrowDown" });
    expect(tree.getAttribute("aria-activedescendant")).toContain("$.store");
    fireEvent.keyDown(tree, { key: "ArrowLeft" });
    expect(within(tree).queryByText('"Whitten"')).toBeNull();
    fireEvent.change(screen.getByRole("searchbox", { name: "Filter keys and values" }), { target: { value: "whitten" } });
    expect(within(tree).getByText('"Whitten"')).toBeTruthy();
    expect(within(tree).queryByText("open")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
  });

  it("shows the parse error for invalid JSON", () => {
    render(<JsonViewer json="{oops" />);
    expect(screen.getByRole("alert").textContent).toContain("This is not valid JSON");
  });
});

describe("CsvExplorer", () => {
  it("detects delimiters and numeric columns, keeps quoted delimiters, and profiles columns", () => {
    expect([parseNumericCell("$1,200.50"), parseNumericCell("(15)"), parseNumericCell("12%"), parseNumericCell("12 apples")]).toEqual([1200.5, -15, 0.12, null]);
    const profiles = profileColumns(["item", "qty"], [["nails", "4"], ["screws", "9"], ["nails", ""]]);
    expect(profiles[0]).toMatchObject({ numeric: false, unique: 2, top: [{ value: "nails", count: 2 }, { value: "screws", count: 1 }] });
    expect(profiles[1]).toMatchObject({ numeric: true, filled: 2, min: 4, max: 9, mean: 6.5 });
    render(<CsvExplorer text={'name;note;price\nAna;"likes ; semicolons";$12.50\nBen;plain;$3'} />);
    expect(screen.getByText("2 rows · 3 columns")).toBeTruthy();
    expect(screen.getByText("likes ; semicolons")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Columns" }));
    expect(screen.getByRole("list", { name: "Column profiles" }).textContent).toContain("Range");
  });
});

describe("SlideDeck", () => {
  it("splits markdown into slides with notes, navigates by keyboard and shows notes", () => {
    const slides = slidesFromMarkdown("# Welcome\nIntro\nNote: smile\n---\n## Agenda\n- Sales\n---\n## Questions");
    expect(slides.map((slide) => slide.title)).toEqual(["Welcome", "Agenda", "Questions"]);
    render(<SlideDeck slides={slides} label="Kickoff" />);
    const deck = screen.getByRole("region", { name: "Kickoff" });
    expect(screen.getByText("Slide 1 of 3")).toBeTruthy();
    fireEvent.keyDown(deck, { key: "ArrowRight" });
    expect(screen.getByText("Slide 2 of 3")).toBeTruthy();
    fireEvent.keyDown(deck, { key: "End" });
    expect(screen.getByText("Slide 3 of 3")).toBeTruthy();
    fireEvent.keyDown(deck, { key: "Home" });
    fireEvent.click(screen.getByRole("button", { name: "Notes" }));
    expect(screen.getByRole("region", { name: "Speaker notes" }).textContent).toContain("smile");
    fireEvent.click(within(screen.getByRole("list", { name: "Slides" })).getByRole("button", { name: /3\. Questions/ }));
    expect(screen.getByText("Slide 3 of 3")).toBeTruthy();
  });
});

describe("ImageGallery", () => {
  const images = [
    { id: "a", src: "https://example.com/a.jpg", alt: "Front of the store" },
    { id: "b", src: "https://example.com/b.jpg", alt: "Paint aisle", caption: "Aisle 4" },
    { id: "c", src: "javascript:alert(1)", alt: "Unsafe" },
  ];

  it("opens a lightbox, wraps with arrow keys and closes with Escape", async () => {
    render(<ImageGallery images={images} />);
    expect(screen.getByText("Unsafe (unavailable)")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Front of the store" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("1 / 3")).toBeTruthy();
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(within(dialog).getByText("3 / 3")).toBeTruthy();
    expect(within(dialog).getByText("This image could not be loaded.")).toBeTruthy();
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(within(dialog).getByRole("heading", { name: "Aisle 4" })).toBeTruthy();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("media helpers", () => {
  it("computes crop areas and formats media times", () => {
    expect(cropAreaFor({ width: 1000, height: 500 }, { width: 200, height: 200 }, 0.4, { x: 0, y: 0 })).toEqual({ x: 250, y: 0, width: 500, height: 500 });
    expect(cropAreaFor({ width: 1000, height: 500 }, { width: 200, height: 200 }, 0.4, { x: 100, y: 0 })).toEqual({ x: 0, y: 0, width: 500, height: 500 });
    expect([formatMediaTime(65), formatMediaTime(3729), formatMediaTime(Number.NaN)]).toEqual(["1:05", "1:02:09", "0:00"]);
  });

  it("renders player controls and rejects unsafe media URLs", () => {
    render(<MediaPlayer src="https://example.com/intro.mp3" kind="audio" title="Store radio spot" />);
    expect(screen.getByRole("group", { name: "Audio: Store radio spot" })).toBeTruthy();
    expect(screen.getByRole("slider", { name: "Seek" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    render(<PdfViewer src="javascript:alert(1)" title="Bad" />);
    expect(screen.getByText("This file address is not allowed.")).toBeTruthy();
  });
});
