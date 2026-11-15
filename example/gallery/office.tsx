// packages/ai-ui/example/gallery/office.tsx
import { useState } from "react";

import { type Design, DesignEditor, type RichTextComment, RichTextEditor, Spreadsheet, type SpreadsheetSheet } from "../../src/index.js";
import { Demo, GallerySection } from "./section.js";

const INVENTORY: SpreadsheetSheet[] = [
  {
    id: "inventory",
    name: "Inventory",
    frozenRows: 1,
    columnWidths: { 0: 180, 4: 120 },
    formats: {
      A1: { bold: true },
      B1: { bold: true, align: "right" },
      C1: { bold: true, align: "right" },
      D1: { bold: true, align: "right" },
      E1: { bold: true },
      C2: { numberFormat: "currency" },
      C3: { numberFormat: "currency" },
      C4: { numberFormat: "currency" },
      C5: { numberFormat: "currency" },
      C6: { numberFormat: "currency" },
      D2: { numberFormat: "currency" },
      D3: { numberFormat: "currency" },
      D4: { numberFormat: "currency" },
      D5: { numberFormat: "currency" },
      D6: { numberFormat: "currency" },
      D8: { numberFormat: "currency", bold: true },
      A8: { bold: true },
    },
    cells: {
      A1: "Item", B1: "On hand", C1: "Unit cost", D1: "Value", E1: "Reorder",
      A2: "Deck screws 3in (5 lb)", B2: "42", C2: "18.97", D2: "=B2*C2", E2: '=IF(B2<20,"Order","OK")',
      A3: "Exterior paint, gallon", B3: "12", C3: "34.5", D3: "=B3*C3", E3: '=IF(B3<20,"Order","OK")',
      A4: "Pressure-treated 2x4 8ft", B4: "180", C4: "4.12", D4: "=B4*C4", E4: '=IF(B4<20,"Order","OK")',
      A5: "Garden hose 50ft", B5: "9", C5: "27.99", D5: "=B5*C5", E5: '=IF(B5<20,"Order","OK")',
      A6: "Work gloves", B6: "64", C6: "6.49", D6: "=B6*C6", E6: '=IF(B6<20,"Order","OK")',
      A8: "Total", B8: "=SUM(B2:B6)", D8: "=SUM(D2:D6)", E8: '=COUNTIF(E2:E6,"Order")&" to order"',
    },
  },
  {
    id: "summary",
    name: "Summary",
    columnWidths: { 0: 200, 1: 140 },
    cells: {
      A1: "Inventory value", B1: "=Inventory!D8",
      A2: "Average unit cost", B2: "=ROUND(AVERAGE(Inventory!C2:C6),2)",
      A3: "Most stocked", B3: "=INDEX(Inventory!A2:A6, MATCH(MAX(Inventory!B2:B6), Inventory!B2:B6, 0))",
      A4: "Items to reorder", B4: "=COUNTIF(Inventory!E2:E6,\"Order\")",
    },
    formats: { B1: { numberFormat: "currency" }, B2: { numberFormat: "currency" } },
  },
];

const MEMO = `# Spring reset plan

The garden center reopens **March 15**. Goals for the first two weeks:

- Move seasonal stock to the front aisles
- Price check every endcap before opening
- Train two people on the *paint mixing* station

## Checklist

- [x] Order mulch and soil pallets
- [ ] Confirm delivery window with the supplier
- [ ] Print new shelf tags

| Area | Owner | Due |
| --- | --- | --- |
| Garden center | Ana | Mar 10 |
| Paint desk | Ben | Mar 12 |

> Keep the front entrance clear for pallet deliveries before 8 AM.
`;

const FLYER: Design = {
  width: 1080,
  height: 1080,
  pages: [
    {
      id: "flyer",
      name: "Sale flyer",
      background: "#fff7ed",
      elements: [
        { id: "band", kind: "rect", x: 0, y: 0, width: 1080, height: 300, fill: "#d95926" },
        { id: "title", kind: "text", x: 80, y: 70, width: 920, height: 120, text: "Spring Garden Sale", fontSize: 96, fontWeight: 800, color: "#ffffff" },
        { id: "subtitle", kind: "text", x: 80, y: 200, width: 920, height: 50, text: "March 15 to 30 · All weekend", fontSize: 40, fontWeight: 500, color: "#fff7ed" },
        { id: "badge", kind: "star", x: 760, y: 360, width: 240, height: 240, fill: "#c98500", rotation: 12 },
        { id: "badge-text", kind: "text", x: 790, y: 440, width: 180, height: 60, text: "20% off", fontSize: 44, fontWeight: 800, color: "#111111", textAlign: "center", rotation: 12 },
        { id: "card", kind: "rect", x: 80, y: 380, width: 600, height: 420, fill: "#ffffff", stroke: "#fed7aa", strokeWidth: 4, radius: 24 },
        { id: "list", kind: "text", x: 120, y: 420, width: 520, height: 300, text: "Potting soil, 3 for $20\nPerennials from $6.99\nHose reels 25% off\nFree delivery over $75", fontSize: 40, lineHeight: 1.6, color: "#431407" },
        { id: "rule", kind: "line", x: 80, y: 880, width: 920, height: 0, stroke: "#d95926", strokeWidth: 6 },
        { id: "footer", kind: "text", x: 80, y: 920, width: 920, height: 60, text: "Whitten Hardware · 123 Main St · Open 7 AM to 7 PM", fontSize: 34, color: "#431407", textAlign: "center" },
      ],
    },
    { id: "back", name: "Back", background: "#ffffff", elements: [{ id: "back-title", kind: "text", x: 80, y: 80, width: 920, height: 80, text: "Store map", fontSize: 64, fontWeight: 700, color: "#111111" }] },
  ],
};

export function OfficeGallery() {
  const [comments, setComments] = useState<RichTextComment[]>([]);
  const [markdown, setMarkdown] = useState(MEMO);
  return (
    <GallerySection id="gallery-office" title="Spreadsheet, documents and canvas">
      <Demo title="Spreadsheet" className="w-full">
        <Spreadsheet className="w-full" defaultSheets={INVENTORY} height="22rem" label="Inventory workbook" />
      </Demo>
      <Demo title="Design canvas" className="w-full">
        <DesignEditor className="w-full" defaultDesign={FLYER} title="spring-sale" height="40rem" label="Spring sale flyer" />
      </Demo>
      <Demo title="Document editor" className="flex w-full flex-col gap-2">
        <RichTextEditor className="w-full" defaultValue={MEMO} onValueChange={setMarkdown} comments={comments} onCommentsChange={setComments} author="Store manager" title="Spring reset plan" height="24rem" aria-label="Spring reset plan" />
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Markdown output</summary>
          <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted p-2 font-mono text-xs" tabIndex={0}>
            {markdown}
          </pre>
        </details>
      </Demo>
    </GallerySection>
  );
}
