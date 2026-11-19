// test/page-builder-extensions.test.tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  builderResponsiveCss, builderToHtml, createBuilderDocument, createCustomBuilderBlock, insertBuilderBlock,
  normalizeBuilderDocument, resolveBuilderBlockStyle, type BuilderBlockDefinition, type BuilderDocument,
} from "../src/lib/page-builder.js";
import { PageBuilder } from "../src/components/page-builder.js";
import { PageBuilderInspector } from "../src/components/page-builder-inspector.js";

afterEach(cleanup);

const registry: readonly BuilderBlockDefinition[] = [{
  type: "product", label: "Product card", create: () => ({ title: "Garden tools", price: 12 }),
  render: (block) => <article>{String(block.props.title)}</article>,
  renderToHtml: (block) => `<article><p>${String(block.props.title)}</p><script>steal()</script><img src="x" onerror="steal()"></article>`,
  renderInspector: (block, change) => <label>Product title<input value={String(block.props.title)} onChange={(event) => change({ ...block.props, title: event.target.value })} /></label>,
  allowedParents: ["section"],
}];

function styledDocument(): BuilderDocument {
  return createBuilderDocument("page", [{
    id: "hero", type: "heading", text: "Hello", level: 1, align: "left",
    style: { fontSize: 48, padding: 20 }, responsive: { tablet: { fontSize: 36 }, mobile: { padding: 8 } },
  }]);
}

describe("page builder extensions", () => {
  it("keeps unavailable custom data across normalization and sanitizes registered exports", () => {
    const custom = createCustomBuilderBlock(registry[0]!);
    const doc = normalizeBuilderDocument(createBuilderDocument("page", [custom]), "page");
    expect(doc.blocks[0]).toMatchObject({ type: "custom", name: "product", props: { title: "Garden tools", price: 12 } });
    expect(builderToHtml(doc, { target: "web" })).toContain("Unavailable block: product");
    const html = builderToHtml(doc, { target: "web", registry });
    expect(html).toContain("Garden tools");
    expect(html).not.toContain("steal()");
    expect(html).not.toContain("onerror");
  });

  it("enforces a custom block's nesting rules for model insertion and palette actions", () => {
    const doc = createBuilderDocument("page", [{ id: "section", type: "section", background: "#fff", padding: 10, blocks: [] }]);
    const block = createCustomBuilderBlock(registry[0]!);
    expect(insertBuilderBlock(doc, block, "root", 0, registry)).toBe(doc);
    expect(insertBuilderBlock(doc, block, "section", 0, registry).blocks[0]).toMatchObject({ blocks: [{ id: block.id }] });
    const change = vi.fn();
    render(<PageBuilder value={doc} onValueChange={change} mode="page" registry={registry} />);
    fireEvent.click(screen.getByRole("button", { name: "Add Product card" }));
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("group", { name: "Section, 0 blocks" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Product card" }));
    expect(change).toHaveBeenCalledWith(expect.objectContaining({ blocks: [expect.objectContaining({ blocks: [expect.objectContaining({ type: "custom", name: "product" })] })] }), expect.objectContaining({ label: "Added Product card" }));
  });

  it("inherits tablet styles on mobile and removes only the requested override", () => {
    function Inspector() {
      const [doc, change] = useState(styledDocument);
      return <><PageBuilderInspector document={doc} selectedBlockId="hero" breakpoint="mobile" onDocumentChange={change} />
        <output data-testid="styles">{JSON.stringify(resolveBuilderBlockStyle(doc.blocks[0]!, "mobile"))}</output></>;
    }
    render(<Inspector />);
    expect(screen.getByTestId("styles").textContent).toContain('"fontSize":36');
    fireEvent.change(screen.getByLabelText(/Font size inherited/), { target: { value: "24" } });
    expect(screen.getByTestId("styles").textContent).toContain('"fontSize":24');
    fireEvent.click(screen.getByRole("button", { name: "Reset font size" }));
    expect(screen.getByTestId("styles").textContent).toContain('"fontSize":36');
    expect(screen.getByTestId("styles").textContent).toContain('"padding":8');
  });

  it("shares sanitized responsive rules with exported HTML and strips malformed style values", () => {
    const doc = styledDocument();
    expect(resolveBuilderBlockStyle(doc.blocks[0]!, "mobile")).toEqual({ fontSize: 36, padding: 8 });
    const rules = builderResponsiveCss(doc);
    expect(rules).toContain("@media(max-width:768px)");
    expect(rules).toContain("@media(max-width:480px)");
    expect(builderToHtml(doc, { target: "web" })).toContain(rules);
    const normalized = normalizeBuilderDocument({ ...doc, blocks: [{ ...doc.blocks[0], style: { color: "red;position:fixed", padding: Infinity, lineHeight: -5 } }] });
    expect(normalized.blocks[0]?.style).toEqual({ lineHeight: 0.8 });
  });

  it("uses host history without adding the host's undo result as another local undo step", () => {
    const original = styledDocument();
    const after = createBuilderDocument("page", []);
    const undo = vi.fn();
    const change = vi.fn();
    const { rerender } = render(<PageBuilder mode="page" value={after} onValueChange={change}
      historyControls={{ canUndo: true, canRedo: false, onUndo: undo, onRedo: vi.fn() }} />);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(undo).toHaveBeenCalledOnce();
    expect(change).not.toHaveBeenCalled();
    rerender(<PageBuilder mode="page" value={original} onValueChange={change}
      historyControls={{ canUndo: false, canRedo: true, onUndo: undo, onRedo: vi.fn() }} />);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Undo" }).disabled).toBe(true);
    expect(screen.getByRole("heading", { name: "Hello" })).toBeTruthy();
  });

  it("keeps an invalid color draft visible and reports the error before calling the host", () => {
    const change = vi.fn();
    render(<PageBuilderInspector document={styledDocument()} selectedBlockId="hero" onDocumentChange={change} />);
    const field = screen.getByLabelText("Style text color");
    fireEvent.change(field, { target: { value: "red;position:fixed" } });
    fireEvent.blur(field);
    expect(screen.getByRole("alert").textContent).toContain("valid CSS color");
    expect(change).not.toHaveBeenCalled();
  });
});
