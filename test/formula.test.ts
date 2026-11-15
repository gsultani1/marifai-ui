// packages/ai-ui/test/formula.test.ts
import { describe, expect, it } from "vitest";

import {
  type CellValue,
  columnIndex,
  columnName,
  createWorkbookEvaluator,
  deleteAxis,
  detectDelimiter,
  displayCellValue,
  fillRange,
  inferFillSeries,
  insertAxis,
  matchesCriteria,
  parseLiteral,
  renameSheet,
  rowsToCells,
  sheetToRows,
  shiftFormulaReferences,
  sortRange,
  type SpreadsheetSheet,
  toDelimited,
  transformFormulaReferences,
} from "../src/index.js";

const book = (cells: Record<string, string>, extra: Array<{ name: string; cells: Record<string, string> }> = []) =>
  createWorkbookEvaluator([{ name: "Sheet1", cells }, ...extra]);

const show = (value: CellValue) => displayCellValue(value);

describe("addresses and literals", () => {
  it("converts column names and parses typed values", () => {
    expect([columnName(0), columnName(25), columnName(26), columnName(701), columnName(702)]).toEqual(["A", "Z", "AA", "ZZ", "AAA"]);
    expect([columnIndex("A"), columnIndex("aa"), columnIndex("AAA"), columnIndex("A1")]).toEqual([0, 26, 702, -1]);
    expect(parseLiteral("1,234.50")).toBe(1234.5);
    expect(parseLiteral("$12")).toBe(12);
    expect(parseLiteral("-45%")).toBe(-0.45);
    expect(parseLiteral("true")).toBe(true);
    expect(parseLiteral("'00123")).toBe("00123");
    expect(parseLiteral("12 apples")).toBe("12 apples");
    expect(parseLiteral("")).toBeNull();
  });
});

describe("formula evaluation", () => {
  it("follows precedence, references, ranges and other sheets", () => {
    const evaluator = book(
      { A1: "2", A2: "3", A3: "=A1+A2*2", A4: "=-2^2", A5: "=(A1+A2)%", A6: "=SUM(A1:A3)", A7: "='Q1 Sales'!B2*10", A8: '="Total: "&A6', A9: "=0.1+0.2" },
      [{ name: "Q1 Sales", cells: { B2: "4" } }],
    );
    expect(evaluator.value(0, 2, 0)).toBe(8);
    expect(evaluator.value(0, 3, 0)).toBe(4);
    expect(evaluator.value(0, 4, 0)).toBe(0.05);
    expect(evaluator.value(0, 5, 0)).toBe(13);
    expect(evaluator.value(0, 6, 0)).toBe(40);
    expect(evaluator.value(0, 7, 0)).toBe("Total: 13");
    expect(show(evaluator.value(0, 8, 0))).toBe("0.3");
  });

  it("reports errors and circular references instead of throwing", () => {
    const evaluator = book({ A1: "=B1", B1: "=A1", C1: "=1/0", D1: "=NOPE(1)", E1: "=Sheet9!A1", F1: '="a"+1', G1: "=SUM(", H1: "=foo", I1: "=C1+1" });
    expect(show(evaluator.value(0, 0, 0))).toBe("#CYCLE!");
    expect(show(evaluator.value(0, 0, 1))).toBe("#CYCLE!");
    expect(show(evaluator.value(0, 0, 2))).toBe("#DIV/0!");
    expect(show(evaluator.value(0, 0, 3))).toBe("#NAME?");
    expect(show(evaluator.value(0, 0, 4))).toBe("#REF!");
    expect(show(evaluator.value(0, 0, 5))).toBe("#VALUE!");
    expect(show(evaluator.value(0, 0, 6))).toBe("#VALUE!");
    expect(show(evaluator.value(0, 0, 7))).toBe("#NAME?");
    expect(show(evaluator.value(0, 0, 8))).toBe("#DIV/0!");
  });

  it("evaluates IF lazily so untaken branches cannot fail", () => {
    const evaluator = book({ A1: "=IF(TRUE, 1, B1)", B1: "=A1", C1: '=IFERROR(1/0, "none")', D1: "=IFS(A1>5, \"big\", A1>0, \"small\")" });
    expect(evaluator.value(0, 0, 0)).toBe(1);
    expect(evaluator.value(0, 0, 2)).toBe("none");
    expect(evaluator.value(0, 0, 3)).toBe("small");
  });

  it("supports aggregates, conditionals, text and lookups", () => {
    const evaluator = book({
      A1: "Apples", B1: "3", C1: "1.2",
      A2: "Pears", B2: "5", C2: "0.8",
      A3: "Plums", B3: "text", C3: "2",
      A4: "=COUNT(B1:B3)", B4: "=AVERAGE(B1:B3)", C4: "=SUMPRODUCT(B1:B2,C1:C2)",
      A5: '=SUMIF(A1:A3,"P*",C1:C3)', B5: '=COUNTIF(B1:B3,">3")', C5: "=VLOOKUP(\"Pears\",A1:C3,3,FALSE)",
      A6: "=INDEX(A1:C3, MATCH(\"Plums\", A1:A3, 0), 3)", B6: '=XLOOKUP("Figs",A1:A3,B1:B3,"missing")', C6: "=ROUND(2.675, 2)",
      A7: '=TEXTJOIN(", ", TRUE, A1:A3)', B7: '=PROPER("hello wORLD")', C7: "=MEDIAN(1,9,4,7)",
    });
    expect(evaluator.value(0, 3, 0)).toBe(2);
    expect(evaluator.value(0, 3, 1)).toBe(4);
    expect(evaluator.value(0, 3, 2)).toBeCloseTo(7.6);
    expect(evaluator.value(0, 4, 0)).toBeCloseTo(2.8);
    expect(evaluator.value(0, 4, 1)).toBe(1);
    expect(evaluator.value(0, 4, 2)).toBe(0.8);
    expect(evaluator.value(0, 5, 0)).toBe(2);
    expect(evaluator.value(0, 5, 1)).toBe("missing");
    expect(evaluator.value(0, 5, 2)).toBe(2.68);
    expect(evaluator.value(0, 6, 0)).toBe("Apples, Pears, Plums");
    expect(evaluator.value(0, 6, 1)).toBe("Hello World");
    expect(evaluator.value(0, 6, 2)).toBe(5.5);
  });

  it("matches criteria with operators and wildcards", () => {
    expect(matchesCriteria(5, ">3")).toBe(true);
    expect(matchesCriteria("done", "<>done")).toBe(false);
    expect(matchesCriteria("Pears", "p?ars")).toBe(true);
    expect(matchesCriteria(null, "")).toBe(true);
    expect(matchesCriteria("x", 5)).toBe(false);
  });
});

describe("reference rewriting and fill", () => {
  it("shifts relative references, keeps absolute ones and turns lost references into #REF!", () => {
    expect(shiftFormulaReferences("=A1+$B$1+C$2+$D3", 1, 2)).toBe("=C2+$B$1+E$2+$D4");
    expect(shiftFormulaReferences('=SUM(A1:B2)&"A1"', 2, 0)).toBe('=SUM(A3:B4)&"A1"');
    expect(shiftFormulaReferences("='Q1 Sales'!A1*2", 0, 1)).toBe("='Q1 Sales'!B1*2");
    expect(shiftFormulaReferences("=A1", -1, 0)).toBe("=#REF!");
    const deleted = transformFormulaReferences("=A1+A3", (position) => (position.row === 1 ? null : { row: position.row > 1 ? position.row - 1 : position.row, column: position.column }));
    expect(deleted).toBe("=A1+A2");
  });

  it("continues numeric, date and numbered-text series and repeats anything else", () => {
    expect(inferFillSeries(["1", "3"], 3)).toEqual(["5", "7", "9"]);
    expect(inferFillSeries(["7"], 2)).toEqual(["7", "7"]);
    expect(inferFillSeries(["Item-007"], 3)).toEqual(["Item-008", "Item-009", "Item-010"]);
    expect(inferFillSeries(["2026-01-30", "2026-01-31"], 2)).toEqual(["2026-02-01", "2026-02-02"]);
    expect(inferFillSeries(["a", "b"], 3)).toEqual(["a", "b", "a"]);
    expect(inferFillSeries(["0.1", "0.2"], 2)).toEqual(["0.3", "0.4"]);
    expect(inferFillSeries(["Mon"], 2)).toEqual(["Tue", "Wed"]);
  });
});

describe("sheet operations", () => {
  const sheet = (cells: Record<string, string>): SpreadsheetSheet => ({ id: "s1", name: "Data", cells });

  it("inserts and deletes rows while rewriting references in every sheet", () => {
    const sheets: SpreadsheetSheet[] = [sheet({ A1: "1", A2: "2", A3: "=SUM(A1:A2)" }), { id: "s2", name: "Summary", cells: { B1: "=Data!A3*2" } }];
    const inserted = insertAxis(sheets, 0, "rows", 1, 1);
    expect(inserted[0]!.cells).toEqual({ A1: "1", A3: "2", A4: "=SUM(A1:A3)" });
    expect(inserted[1]!.cells.B1).toBe("=Data!A4*2");
    const deleted = deleteAxis(sheets, 0, "rows", 0, 1);
    expect(deleted[0]!.cells).toEqual({ A1: "2", A2: "=SUM(A1:A1)" });
    expect(deleteAxis([sheet({ A3: "=SUM(A1:A2)+B3" })], 0, "rows", 0, 2)[0]!.cells).toEqual({ A1: "=SUM(#REF!)+B1" });
    expect(deleted[1]!.cells.B1).toBe("=Data!A2*2");
  });

  it("renames sheets in references, fills series and formulas, sorts with blanks last", () => {
    const renamed = renameSheet([sheet({}), { id: "s2", name: "Other", cells: { A1: "=Data!B2+'Data'!C3" } }], 0, "Q1 Sales");
    expect(renamed[1]!.cells.A1).toBe("='Q1 Sales'!B2+'Q1 Sales'!C3");

    const filled = fillRange(sheet({ A1: "1", A2: "2", B1: "=A1*10" }), { top: 0, left: 0, bottom: 1, right: 0 }, { top: 0, left: 0, bottom: 3, right: 0 }, "down");
    expect([filled.cells.A3, filled.cells.A4]).toEqual(["3", "4"]);
    const formulas = fillRange(sheet({ B1: "=A1*10" }), { top: 0, left: 1, bottom: 0, right: 1 }, { top: 0, left: 1, bottom: 2, right: 1 }, "down");
    expect([formulas.cells.B2, formulas.cells.B3]).toEqual(["=A2*10", "=A3*10"]);

    const data = sheet({ A1: "Name", A2: "pear", A3: "", A4: "Apple", A5: "fig", B2: "=ROW_REF", B4: "x" });
    const evaluator = createWorkbookEvaluator([data]);
    const sorted = sortRange(data, { top: 1, left: 0, bottom: 4, right: 1 }, 0, "asc", (row, column) => evaluator.value(0, row, column));
    expect([sorted.cells.A2, sorted.cells.A3, sorted.cells.A4, sorted.cells.A5]).toEqual(["Apple", "fig", "pear", undefined]);
    expect(sorted.cells.B2).toBe("x");
  });

  it("detects delimiters, quotes fields and neutralizes formula-like text on export", () => {
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(detectDelimiter('name\tnote\n"x, y"\tz')).toBe("\t");
    expect(toDelimited([["a,b", 'say "hi"', "plain"]])).toBe('"a,b","say ""hi""",plain');
    const data = sheet({ A1: "'=HYPERLINK(1)", B1: "-5", C1: "=1+1" });
    const evaluator = createWorkbookEvaluator([data]);
    expect(sheetToRows(data, (row, column) => evaluator.value(0, row, column))).toEqual([["'=HYPERLINK(1)", "-5", "2"]]);
    expect(rowsToCells([["a", ""], ["", "b"]])).toEqual({ A1: "a", B2: "b" });
  });
});
