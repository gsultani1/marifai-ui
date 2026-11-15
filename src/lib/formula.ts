// packages/ai-ui/src/lib/formula.ts
export type FormulaErrorCode = "#DIV/0!" | "#REF!" | "#NAME?" | "#VALUE!" | "#N/A" | "#NUM!" | "#CYCLE!" | "#CALC!";

export interface FormulaError {
  readonly error: FormulaErrorCode;
}

export type CellValue = number | string | boolean | FormulaError | null;

const errorCache = new Map<FormulaErrorCode, FormulaError>();

export function formulaError(code: FormulaErrorCode): FormulaError {
  let error = errorCache.get(code);
  if (!error) {
    error = Object.freeze({ error: code });
    errorCache.set(code, error);
  }
  return error;
}

export function isFormulaError(value: unknown): value is FormulaError {
  return typeof value === "object" && value !== null && "error" in value;
}

/* ------------------------------------------------------------------ */
/* Addresses                                                           */
/* ------------------------------------------------------------------ */

/** 0 → "A", 25 → "Z", 26 → "AA". */
export function columnName(index: number): string {
  let name = "";
  let value = index + 1;
  while (value > 0) {
    const rest = (value - 1) % 26;
    name = String.fromCharCode(65 + rest) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

/** "A" → 0, "AA" → 26. Returns -1 for anything else. */
export function columnIndex(name: string): number {
  if (!/^[A-Za-z]{1,3}$/.test(name)) return -1;
  let index = 0;
  for (const char of name.toUpperCase()) index = index * 26 + (char.charCodeAt(0) - 64);
  return index - 1;
}

export function cellAddress(row: number, column: number): string {
  return `${columnName(column)}${row + 1}`;
}

export function parseCellAddress(address: string): { row: number; column: number } | null {
  const match = /^\$?([A-Za-z]{1,3})\$?(\d{1,7})$/.exec(address.trim());
  if (!match) return null;
  const row = Number(match[2]) - 1;
  const column = columnIndex(match[1]!);
  return row >= 0 && column >= 0 ? { row, column } : null;
}

/* ------------------------------------------------------------------ */
/* Literals                                                            */
/* ------------------------------------------------------------------ */

/**
 * Interprets typed input that is not a formula: numbers (with thousands
 * separators, currency signs and percents), TRUE/FALSE, and text. A leading
 * apostrophe keeps the rest as text.
 */
export function parseLiteral(raw: string): CellValue {
  if (raw === "") return null;
  if (raw.startsWith("'")) return raw.slice(1);
  const trimmed = raw.trim();
  if (/^true$/i.test(trimmed)) return true;
  if (/^false$/i.test(trimmed)) return false;
  const match = /^([+-])?\$?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)(?:e([+-]?\d+))?(%)?$/i.exec(trimmed);
  if (match) {
    let value = Number(match[2]!.replace(/,/g, "")) * (match[3] ? 10 ** Number(match[3]) : 1);
    if (match[1] === "-") value = -value;
    if (match[4]) value /= 100;
    if (Number.isFinite(value)) return value;
  }
  return raw;
}

/* ------------------------------------------------------------------ */
/* Tokenizer                                                           */
/* ------------------------------------------------------------------ */

type TokenType = "number" | "string" | "ref" | "range" | "name" | "op" | "paren" | "comma" | "error" | "bool";

interface Token {
  type: TokenType;
  text: string;
  start: number;
  end: number;
}

const REF_PART = String.raw`\$?[A-Za-z]{1,3}\$?\d{1,7}`;
const SHEET_PREFIX = String.raw`(?:'(?:[^']|'')+'|[A-Za-z_][\w.]*)!`;
const RANGE_RE = new RegExp(String.raw`^(${SHEET_PREFIX})?(${REF_PART}:${REF_PART}|\$?[A-Za-z]{1,3}:\$?[A-Za-z]{1,3}|\$?\d{1,7}:\$?\d{1,7})`);
const REF_RE = new RegExp(String.raw`^(${SHEET_PREFIX})?(${REF_PART})(?![\w(])`);
const ERROR_RE = /^#(?:DIV\/0!|REF!|NAME\?|VALUE!|N\/A|NUM!|CYCLE!|CALC!)/i;

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index]!;
    if (/\s/.test(char)) {
      index++;
      continue;
    }
    const rest = source.slice(index);
    const push = (type: TokenType, text: string) => {
      tokens.push({ type, text, start: index, end: index + text.length });
      index += text.length;
    };
    if (char === '"') {
      let end = index + 1;
      while (end < source.length) {
        if (source[end] === '"') {
          if (source[end + 1] === '"') {
            end += 2;
            continue;
          }
          break;
        }
        end++;
      }
      push("string", source.slice(index, Math.min(end + 1, source.length)));
      continue;
    }
    const number = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(rest);
    const range = RANGE_RE.exec(rest);
    if (range) {
      push("range", range[0]);
      continue;
    }
    const ref = REF_RE.exec(rest);
    if (ref) {
      push("ref", ref[0]);
      continue;
    }
    if (number) {
      push("number", number[0]);
      continue;
    }
    const error = ERROR_RE.exec(rest);
    if (error) {
      push("error", error[0].toUpperCase());
      continue;
    }
    const name = /^[A-Za-z_][\w.]*/.exec(rest);
    if (name) {
      push(/^(?:true|false)$/i.test(name[0]) && source[index + name[0].length] !== "(" ? "bool" : "name", name[0]);
      continue;
    }
    const op = /^(?:<>|<=|>=|[-+*/^&=<>%])/.exec(rest);
    if (op) {
      push("op", op[0]);
      continue;
    }
    if (char === "(" || char === ")") {
      push("paren", char);
      continue;
    }
    if (char === "," || char === ";") {
      push("comma", char);
      continue;
    }
    throw new SyntaxError(`Unexpected "${char}"`);
  }
  return tokens;
}

/* ------------------------------------------------------------------ */
/* Parser                                                              */
/* ------------------------------------------------------------------ */

interface RefTarget {
  sheet?: string;
  row: number;
  column: number;
}

type Node =
  | { type: "number"; value: number }
  | { type: "string"; value: string }
  | { type: "bool"; value: boolean }
  | { type: "error"; value: FormulaError }
  | { type: "ref"; target: RefTarget }
  | { type: "range"; sheet?: string; top: number; left: number; bottom: number; right: number }
  | { type: "unary"; op: string; operand: Node }
  | { type: "postfix"; op: "%"; operand: Node }
  | { type: "binary"; op: string; left: Node; right: Node }
  | { type: "call"; name: string; args: Node[] };

const BINARY: Record<string, number> = { "=": 1, "<>": 1, "<": 1, ">": 1, "<=": 1, ">=": 1, "&": 2, "+": 3, "-": 3, "*": 4, "/": 4, "^": 5 };
const UNBOUNDED = 1_048_575;

function sheetName(prefix: string | undefined): string | undefined {
  if (!prefix) return undefined;
  const name = prefix.slice(0, -1);
  return name.startsWith("'") ? name.slice(1, -1).replace(/''/g, "'") : name;
}

function splitSheet(text: string): { sheet?: string; body: string } {
  const bang = text.lastIndexOf("!");
  if (bang === -1) return { body: text };
  const sheet = sheetName(text.slice(0, bang + 1));
  return sheet === undefined ? { body: text.slice(bang + 1) } : { sheet, body: text.slice(bang + 1) };
}

function parseRangeBody(body: string): { top: number; left: number; bottom: number; right: number } {
  const [a, b] = body.split(":") as [string, string];
  if (/^\$?\d+$/.test(a)) {
    const top = Number(a.replace("$", "")) - 1;
    const bottom = Number(b.replace("$", "")) - 1;
    return { top: Math.min(top, bottom), bottom: Math.max(top, bottom), left: 0, right: 16_383 };
  }
  if (/^\$?[A-Za-z]+$/.test(a)) {
    const left = columnIndex(a.replace("$", ""));
    const right = columnIndex(b.replace("$", ""));
    return { top: 0, bottom: UNBOUNDED, left: Math.min(left, right), right: Math.max(left, right) };
  }
  const start = parseCellAddress(a)!;
  const end = parseCellAddress(b)!;
  return { top: Math.min(start.row, end.row), bottom: Math.max(start.row, end.row), left: Math.min(start.column, end.column), right: Math.max(start.column, end.column) };
}

function parse(source: string): Node {
  const tokens = tokenize(source);
  let position = 0;
  const peek = () => tokens[position];
  const next = () => tokens[position++];

  const primary = (): Node => {
    const token = next();
    if (!token) throw new SyntaxError("Unexpected end of formula");
    switch (token.type) {
      case "number":
        return { type: "number", value: Number(token.text) };
      case "string":
        if (!token.text.endsWith('"') || token.text.length < 2) throw new SyntaxError("Unclosed string");
        return { type: "string", value: token.text.slice(1, -1).replace(/""/g, '"') };
      case "bool":
        return { type: "bool", value: /^true$/i.test(token.text) };
      case "error":
        return { type: "error", value: formulaError(token.text as FormulaErrorCode) };
      case "ref": {
        const { sheet, body } = splitSheet(token.text);
        const cell = parseCellAddress(body)!;
        return { type: "ref", target: sheet === undefined ? { row: cell.row, column: cell.column } : { sheet, row: cell.row, column: cell.column } };
      }
      case "range": {
        const { sheet, body } = splitSheet(token.text);
        return sheet === undefined ? { type: "range", ...parseRangeBody(body) } : { type: "range", sheet, ...parseRangeBody(body) };
      }
      case "name": {
        if (peek()?.text !== "(") throw new SyntaxError(`Unknown name ${token.text}`);
        next();
        const args: Node[] = [];
        if (peek()?.text !== ")") {
          for (;;) {
            if (peek()?.type === "comma" || peek()?.text === ")") args.push({ type: "string", value: "" });
            else args.push(expression(0));
            if (peek()?.type === "comma") {
              next();
              continue;
            }
            break;
          }
        }
        if (next()?.text !== ")") throw new SyntaxError("Missing )");
        return { type: "call", name: token.text.toUpperCase(), args };
      }
      case "paren": {
        if (token.text !== "(") throw new SyntaxError("Unexpected )");
        const inner = expression(0);
        if (next()?.text !== ")") throw new SyntaxError("Missing )");
        return inner;
      }
      case "op":
        if (token.text === "-" || token.text === "+") return { type: "unary", op: token.text, operand: expression(6) };
        throw new SyntaxError(`Unexpected ${token.text}`);
      default:
        throw new SyntaxError(`Unexpected ${token.text}`);
    }
  };

  const expression = (minPrecedence: number): Node => {
    let left = primary();
    for (;;) {
      const token = peek();
      if (token?.type === "op" && token.text === "%") {
        next();
        left = { type: "postfix", op: "%", operand: left };
        continue;
      }
      const precedence = token?.type === "op" ? BINARY[token.text] : undefined;
      if (precedence === undefined || precedence <= minPrecedence) break;
      next();
      left = { type: "binary", op: token!.text, left, right: expression(precedence) };
    }
    return left;
  };

  const tree = expression(0);
  if (position < tokens.length) throw new SyntaxError(`Unexpected ${tokens[position]!.text}`);
  return tree;
}

/* ------------------------------------------------------------------ */
/* Reference rewriting                                                 */
/* ------------------------------------------------------------------ */

export interface ReferencePosition {
  /** Sheet named in the reference, or undefined for the formula's own sheet. */
  sheet?: string;
  row: number;
  column: number;
  absoluteRow: boolean;
  absoluteColumn: boolean;
  /** "start" and "end" are the corners of a range, so deletions can shrink it. */
  role: "cell" | "start" | "end";
}

/** Return the new position, or null to turn the reference into #REF!. */
export type ReferenceTransform = (position: ReferencePosition) => { row: number; column: number } | null;

function rewritePart(part: string, sheet: string | undefined, role: ReferencePosition["role"], transform: ReferenceTransform): { text: string; row: number; column: number } | null {
  const match = /^(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})$/.exec(part);
  if (!match) return null;
  const position: ReferencePosition = { row: Number(match[4]) - 1, column: columnIndex(match[2]!), absoluteColumn: match[1] === "$", absoluteRow: match[3] === "$", role };
  const next = transform(sheet === undefined ? position : { ...position, sheet });
  if (!next || next.row < 0 || next.column < 0) return null;
  return { text: `${match[1]}${columnName(next.column)}${match[3]}${next.row + 1}`, row: next.row, column: next.column };
}

/**
 * Rewrites every cell reference in a formula through `transform`, leaving
 * strings and everything else as typed. Used for copy, fill, sort and
 * row/column insertion.
 */
export function transformFormulaReferences(formula: string, transform: ReferenceTransform): string {
  if (!formula.startsWith("=")) return formula;
  let tokens: Token[];
  try {
    tokens = tokenize(formula.slice(1));
  } catch {
    return formula;
  }
  let output = "";
  let cursor = 0;
  const body = formula.slice(1);
  for (const token of tokens) {
    if (token.type !== "ref" && token.type !== "range") continue;
    output += body.slice(cursor, token.start);
    cursor = token.end;
    const bang = token.text.lastIndexOf("!");
    const prefix = bang === -1 ? "" : token.text.slice(0, bang + 1);
    const sheet = sheetName(prefix || undefined);
    const parts = token.text.slice(prefix.length).split(":");
    if (parts.some((part) => /^\$?[A-Za-z]+$/.test(part) || /^\$?\d+$/.test(part))) {
      output += token.text;
      continue;
    }
    const rewritten = parts.map((part, index) => rewritePart(part, sheet, parts.length === 1 ? "cell" : index === 0 ? "start" : "end", transform));
    const [start, end] = rewritten;
    const collapsed = start && end && (start.row > end.row || start.column > end.column);
    output += rewritten.some((part) => part === null) || collapsed ? "#REF!" : prefix + rewritten.map((part) => part!.text).join(":");
  }
  return `=${output}${body.slice(cursor)}`;
}

/** Quotes a sheet name for use in a reference when it needs it: 'Q1 Sales'!A1. */
export function quoteSheetName(name: string): string {
  return /^[A-Za-z_][\w.]*$/.test(name) && !/^[A-Za-z]{1,3}\d+$/.test(name) ? name : `'${name.replace(/'/g, "''")}'`;
}

/** Points references at a renamed sheet: 'Old'!A1 becomes 'New'!A1. */
export function renameSheetInFormula(formula: string, from: string, to: string): string {
  if (!formula.startsWith("=")) return formula;
  let tokens: Token[];
  try {
    tokens = tokenize(formula.slice(1));
  } catch {
    return formula;
  }
  const body = formula.slice(1);
  let output = "";
  let cursor = 0;
  for (const token of tokens) {
    if (token.type !== "ref" && token.type !== "range") continue;
    const bang = token.text.lastIndexOf("!");
    if (bang === -1 || sheetName(token.text.slice(0, bang + 1))?.toLowerCase() !== from.toLowerCase()) continue;
    output += body.slice(cursor, token.start) + quoteSheetName(to) + token.text.slice(bang);
    cursor = token.end;
  }
  return `=${output}${body.slice(cursor)}`;
}

/** Shifts relative references by an offset, as copy and paste do. `$` parts stay put. */
export function shiftFormulaReferences(formula: string, rowOffset: number, columnOffset: number): string {
  return transformFormulaReferences(formula, (position) => ({
    row: position.absoluteRow ? position.row : position.row + rowOffset,
    column: position.absoluteColumn ? position.column : position.column + columnOffset,
  }));
}

/* ------------------------------------------------------------------ */
/* Evaluation                                                          */
/* ------------------------------------------------------------------ */

type Matrix = CellValue[][];
type Arg = CellValue | Matrix;

const isMatrix = (value: Arg): value is Matrix => Array.isArray(value);

function toNumber(value: CellValue): number | FormulaError {
  if (value === null || value === "") return 0;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (isFormulaError(value)) return value;
  const parsed = parseLiteral(value);
  return typeof parsed === "number" ? parsed : formulaError("#VALUE!");
}

function toText(value: CellValue): string | FormulaError {
  if (value === null) return "";
  if (isFormulaError(value)) return value;
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return formatNumber(value);
  return value;
}

function toBool(value: CellValue): boolean | FormulaError {
  if (isFormulaError(value)) return value;
  if (typeof value === "boolean") return value;
  if (value === null || value === "") return false;
  if (typeof value === "number") return value !== 0;
  if (/^true$/i.test(value)) return true;
  if (/^false$/i.test(value)) return false;
  return formulaError("#VALUE!");
}

/** Up to 10 significant digits without float noise: 0.1 + 0.2 shows 0.3. */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "#NUM!";
  if (Number.isInteger(value) && Math.abs(value) < 1e15) return String(value);
  const rounded = Number(value.toPrecision(10));
  return Math.abs(rounded) >= 1e15 || (Math.abs(rounded) < 1e-9 && rounded !== 0) ? rounded.toExponential(4) : String(rounded);
}

function scalar(value: Arg): CellValue {
  if (!isMatrix(value)) return value;
  return value[0]?.[0] ?? null;
}

function flatten(args: Arg[]): Array<{ value: CellValue; fromRange: boolean }> {
  const values: Array<{ value: CellValue; fromRange: boolean }> = [];
  for (const arg of args) {
    if (isMatrix(arg)) for (const row of arg) for (const value of row) values.push({ value, fromRange: true });
    else values.push({ value: arg, fromRange: false });
  }
  return values;
}

/** Numbers for aggregate functions: ranges skip text and blanks, direct arguments coerce. */
function numbers(args: Arg[]): number[] | FormulaError {
  const result: number[] = [];
  for (const { value, fromRange } of flatten(args)) {
    if (isFormulaError(value)) return value;
    if (fromRange) {
      if (typeof value === "number") result.push(value);
      continue;
    }
    if (value === null) continue;
    const number = toNumber(value);
    if (isFormulaError(number)) return number;
    result.push(number);
  }
  return result;
}

function compare(left: CellValue, right: CellValue): number {
  const rank = (value: CellValue) => (typeof value === "number" || value === null ? 0 : typeof value === "string" ? 1 : 2);
  const a = left === null ? (typeof right === "string" ? "" : 0) : left;
  const b = right === null ? (typeof left === "string" ? "" : 0) : right;
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if (typeof a === "string" && typeof b === "string") return a.localeCompare(b, undefined, { sensitivity: "base" });
  const x = Number(a);
  const y = Number(b);
  return x === y ? 0 : x < y ? -1 : 1;
}

function wildcard(pattern: string): RegExp {
  const source = pattern.replace(/~([*?~])|([*?])|[.+^${}()|[\]\\]/g, (match, escaped: string | undefined, wild: string | undefined) =>
    escaped ? `\\${escaped}` : wild === "*" ? ".*" : wild === "?" ? "." : `\\${match}`,
  );
  return new RegExp(`^${source}$`, "i");
}

/** SUMIF/COUNTIF criteria: 5, ">5", "<>done", "a*". */
export function matchesCriteria(value: CellValue, criteria: CellValue): boolean {
  if (typeof criteria !== "string") return compare(value, criteria) === 0 && value !== null;
  const match = /^(<>|>=|<=|=|>|<)?([\s\S]*)$/.exec(criteria)!;
  const op = match[1] ?? "=";
  const operand = parseLiteral(match[2]!);
  if (typeof operand === "string" && (op === "=" || op === "<>")) {
    const hit = /[*?]/.test(operand) ? typeof value === "string" && wildcard(operand).test(value) : compare(value ?? "", operand) === 0;
    return op === "=" ? hit : !hit;
  }
  if (operand === null) return op === "=" ? value === null || value === "" : value !== null && value !== "";
  if (typeof operand === "number" && typeof value !== "number") return op === "<>";
  const order = compare(value, operand);
  switch (op) {
    case ">":
      return order > 0;
    case "<":
      return order < 0;
    case ">=":
      return order >= 0;
    case "<=":
      return order <= 0;
    case "<>":
      return order !== 0;
    default:
      return order === 0;
  }
}

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
const DAY = 86_400_000;

export function dateToSerial(date: Date): number {
  return (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()) - EXCEL_EPOCH) / DAY;
}

export function serialToDate(serial: number): Date {
  const date = new Date(EXCEL_EPOCH + Math.round(serial * DAY));
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());
}

type Fn = (args: Arg[]) => CellValue | Matrix;

function numericFn(fn: (...values: number[]) => number, arity: [number, number]): Fn {
  return (args) => {
    if (args.length < arity[0] || args.length > arity[1]) return formulaError("#VALUE!");
    const values: number[] = [];
    for (const arg of args) {
      const value = toNumber(scalar(arg));
      if (isFormulaError(value)) return value;
      values.push(value);
    }
    const result = fn(...values);
    return Number.isFinite(result) ? result : formulaError("#NUM!");
  };
}

function textFn(fn: (text: string, ...rest: number[]) => CellValue, arity: [number, number]): Fn {
  return (args) => {
    if (args.length < arity[0] || args.length > arity[1]) return formulaError("#VALUE!");
    const text = toText(scalar(args[0]!));
    if (isFormulaError(text)) return text;
    const rest: number[] = [];
    for (const arg of args.slice(1)) {
      const value = toNumber(scalar(arg));
      if (isFormulaError(value)) return value;
      rest.push(value);
    }
    return fn(text, ...rest);
  };
}

function aggregate(fn: (values: number[]) => number | FormulaError): Fn {
  return (args) => {
    const values = numbers(args);
    return isFormulaError(values) ? values : fn(values);
  };
}

function conditional(kind: "sum" | "count" | "average"): Fn {
  return (args) => {
    const [range, criteria, sumRange] = args;
    if (!range || criteria === undefined) return formulaError("#VALUE!");
    const cells = isMatrix(range) ? range : [[range]];
    const targets = sumRange === undefined ? cells : isMatrix(sumRange) ? sumRange : [[sumRange]];
    const test = scalar(criteria);
    let total = 0;
    let count = 0;
    cells.forEach((row, r) =>
      row.forEach((value, c) => {
        if (!matchesCriteria(value, test)) return;
        const target = targets[r]?.[c] ?? null;
        if (kind === "count") count++;
        else if (typeof target === "number") {
          total += target;
          count++;
        }
      }),
    );
    if (kind === "count") return count;
    if (kind === "sum") return total;
    return count === 0 ? formulaError("#DIV/0!") : total / count;
  };
}

function round(value: number, digits: number, mode: "round" | "up" | "down"): number {
  const factor = 10 ** Math.trunc(digits);
  const scaled = Math.abs(value) * factor;
  const nudged = Number(scaled.toPrecision(15));
  const rounded = mode === "round" ? Math.round(nudged) : mode === "up" ? Math.ceil(nudged) : Math.floor(nudged);
  return (Math.sign(value) * rounded) / factor;
}

function lookupIndex(needle: CellValue, haystack: CellValue[], mode: number): number {
  if (mode === 0) {
    const pattern = typeof needle === "string" && /[*?]/.test(needle) ? wildcard(needle) : null;
    return haystack.findIndex((value) => (pattern ? typeof value === "string" && pattern.test(value) : compare(value, needle) === 0 && value !== null));
  }
  let found = -1;
  for (let index = 0; index < haystack.length; index++) {
    const value = haystack[index] ?? null;
    if (value === null) continue;
    const order = compare(value, needle);
    if (mode > 0 ? order <= 0 : order >= 0) found = index;
    else break;
  }
  return found;
}

const median = (values: number[]) => {
  if (values.length === 0) return formulaError("#NUM!");
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

const stdev = (values: number[], sample: boolean) => {
  const n = values.length;
  if (n < (sample ? 2 : 1)) return formulaError("#DIV/0!");
  const mean = values.reduce((sum, value) => sum + value, 0) / n;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (sample ? n - 1 : n));
};

const FUNCTIONS: Record<string, Fn> = {
  SUM: aggregate((values) => values.reduce((sum, value) => sum + value, 0)),
  AVERAGE: aggregate((values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : formulaError("#DIV/0!"))),
  MIN: aggregate((values) => (values.length ? Math.min(...values) : 0)),
  MAX: aggregate((values) => (values.length ? Math.max(...values) : 0)),
  MEDIAN: aggregate(median),
  PRODUCT: aggregate((values) => values.reduce((product, value) => product * value, 1)),
  STDEV: aggregate((values) => stdev(values, true)),
  STDEVP: aggregate((values) => stdev(values, false)),
  COUNT: (args) => flatten(args).filter(({ value, fromRange }) => typeof value === "number" || (!fromRange && typeof toNumber(value) === "number" && value !== null)).length,
  COUNTA: (args) => flatten(args).filter(({ value }) => value !== null && value !== "").length,
  COUNTBLANK: (args) => flatten(args).filter(({ value }) => value === null || value === "").length,
  SUMIF: conditional("sum"),
  COUNTIF: conditional("count"),
  AVERAGEIF: conditional("average"),
  SUMPRODUCT: (args) => {
    const matrices = args.map((arg) => (isMatrix(arg) ? arg.flat() : [scalar(arg)]));
    const length = matrices[0]?.length ?? 0;
    if (matrices.some((values) => values.length !== length)) return formulaError("#VALUE!");
    let total = 0;
    for (let index = 0; index < length; index++) {
      let product = 1;
      for (const values of matrices) {
        const value = values[index] ?? null;
        if (isFormulaError(value)) return value;
        product *= typeof value === "number" ? value : 0;
      }
      total += product;
    }
    return total;
  },
  ABS: numericFn(Math.abs, [1, 1]),
  SQRT: numericFn((value) => (value < 0 ? Number.NaN : Math.sqrt(value)), [1, 1]),
  POWER: numericFn((base, exponent) => base ** exponent, [2, 2]),
  EXP: numericFn(Math.exp, [1, 1]),
  LN: numericFn((value) => (value <= 0 ? Number.NaN : Math.log(value)), [1, 1]),
  LOG10: numericFn((value) => (value <= 0 ? Number.NaN : Math.log10(value)), [1, 1]),
  INT: numericFn(Math.floor, [1, 1]),
  SIGN: numericFn(Math.sign, [1, 1]),
  PI: numericFn(() => Math.PI, [0, 0]),
  MOD: (args) => {
    const [a, b] = args.map((arg) => toNumber(scalar(arg)));
    if (a === undefined || b === undefined) return formulaError("#VALUE!");
    if (isFormulaError(a)) return a;
    if (isFormulaError(b)) return b;
    if (b === 0) return formulaError("#DIV/0!");
    return a - b * Math.floor(a / b);
  },
  ROUND: numericFn((value, digits = 0) => round(value, digits, "round"), [1, 2]),
  ROUNDUP: numericFn((value, digits = 0) => round(value, digits, "up"), [1, 2]),
  ROUNDDOWN: numericFn((value, digits = 0) => round(value, digits, "down"), [1, 2]),
  CEILING: numericFn((value, step = 1) => (step === 0 ? 0 : Math.ceil(value / step) * step), [1, 2]),
  FLOOR: numericFn((value, step = 1) => (step === 0 ? 0 : Math.floor(value / step) * step), [1, 2]),
  LEN: textFn((text) => [...text].length, [1, 1]),
  UPPER: textFn((text) => text.toUpperCase(), [1, 1]),
  LOWER: textFn((text) => text.toLowerCase(), [1, 1]),
  PROPER: textFn((text) => text.toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase()), [1, 1]),
  TRIM: textFn((text) => text.trim().replace(/ {2,}/g, " "), [1, 1]),
  LEFT: textFn((text, count = 1) => (count < 0 ? formulaError("#VALUE!") : [...text].slice(0, count).join("")), [1, 2]),
  RIGHT: textFn((text, count = 1) => (count < 0 ? formulaError("#VALUE!") : count === 0 ? "" : [...text].slice(-count).join("")), [1, 2]),
  MID: textFn((text, start = 1, count = 0) => (start < 1 || count < 0 ? formulaError("#VALUE!") : [...text].slice(start - 1, start - 1 + count).join("")), [3, 3]),
  REPT: textFn((text, count = 0) => (count < 0 || text.length * count > 32_767 ? formulaError("#VALUE!") : text.repeat(Math.floor(count))), [2, 2]),
  VALUE: (args) => toNumber(scalar(args[0] ?? null)),
  FIND: (args) => {
    const needle = toText(scalar(args[0] ?? null));
    const haystack = toText(scalar(args[1] ?? null));
    if (isFormulaError(needle)) return needle;
    if (isFormulaError(haystack)) return haystack;
    const index = haystack.indexOf(needle);
    return index === -1 ? formulaError("#VALUE!") : index + 1;
  },
  SUBSTITUTE: (args) => {
    const [text, from, to] = args.map((arg) => toText(scalar(arg)));
    if (text === undefined || from === undefined || to === undefined) return formulaError("#VALUE!");
    if (isFormulaError(text)) return text;
    if (isFormulaError(from)) return from;
    if (isFormulaError(to)) return to;
    return from === "" ? text : text.split(from).join(to);
  },
  CONCAT: (args) => {
    let output = "";
    for (const { value } of flatten(args)) {
      const text = toText(value);
      if (isFormulaError(text)) return text;
      output += text;
    }
    return output;
  },
  TEXTJOIN: (args) => {
    const [delimiterArg, ignoreArg, ...rest] = args;
    const delimiter = toText(scalar(delimiterArg ?? ""));
    const ignore = toBool(scalar(ignoreArg ?? true));
    if (isFormulaError(delimiter)) return delimiter;
    if (isFormulaError(ignore)) return ignore;
    const parts: string[] = [];
    for (const { value } of flatten(rest)) {
      const text = toText(value);
      if (isFormulaError(text)) return text;
      if (!ignore || text !== "") parts.push(text);
    }
    return parts.join(delimiter);
  },
  NOT: (args) => {
    const value = toBool(scalar(args[0] ?? null));
    return isFormulaError(value) ? value : !value;
  },
  AND: (args) => {
    let result = true;
    for (const { value } of flatten(args)) {
      if (value === null) continue;
      const bool = toBool(value);
      if (isFormulaError(bool)) return bool;
      result &&= bool;
    }
    return result;
  },
  OR: (args) => {
    let result = false;
    for (const { value } of flatten(args)) {
      if (value === null) continue;
      const bool = toBool(value);
      if (isFormulaError(bool)) return bool;
      result ||= bool;
    }
    return result;
  },
  ISBLANK: (args) => scalar(args[0] ?? null) === null,
  ISNUMBER: (args) => typeof scalar(args[0] ?? null) === "number",
  ISTEXT: (args) => typeof scalar(args[0] ?? null) === "string",
  ISERROR: (args) => isFormulaError(scalar(args[0] ?? null)),
  NA: () => formulaError("#N/A"),
  TODAY: () => Math.floor(dateToSerial(new Date())),
  NOW: () => dateToSerial(new Date()),
  DATE: numericFn((year, month, day) => (Date.UTC(year < 1900 ? year + 1900 : year, month - 1, day) - EXCEL_EPOCH) / DAY, [3, 3]),
  YEAR: numericFn((serial) => serialToDate(serial).getFullYear(), [1, 1]),
  MONTH: numericFn((serial) => serialToDate(serial).getMonth() + 1, [1, 1]),
  DAY: numericFn((serial) => serialToDate(serial).getDate(), [1, 1]),
  WEEKDAY: numericFn((serial) => serialToDate(serial).getDay() + 1, [1, 1]),
  MATCH: (args) => {
    const [needleArg, rangeArg, typeArg] = args;
    if (needleArg === undefined || rangeArg === undefined) return formulaError("#VALUE!");
    const mode = typeArg === undefined ? 1 : toNumber(scalar(typeArg));
    if (isFormulaError(mode)) return mode;
    const values = isMatrix(rangeArg) ? rangeArg.flat() : [rangeArg];
    const index = lookupIndex(scalar(needleArg), values, Math.sign(mode));
    return index === -1 ? formulaError("#N/A") : index + 1;
  },
  INDEX: (args) => {
    const [rangeArg, rowArg, columnArg] = args;
    if (!rangeArg) return formulaError("#VALUE!");
    const range = isMatrix(rangeArg) ? rangeArg : [[rangeArg]];
    const row = toNumber(scalar(rowArg ?? 1));
    const column = toNumber(scalar(columnArg ?? 1));
    if (isFormulaError(row)) return row;
    if (isFormulaError(column)) return column;
    const r = range.length === 1 && columnArg === undefined ? 1 : row;
    const c = range.length === 1 && columnArg === undefined ? row : column;
    const value = range[r - 1]?.[c - 1];
    return value === undefined ? formulaError("#REF!") : value;
  },
  VLOOKUP: (args) => {
    const [needleArg, rangeArg, columnArg, approxArg] = args;
    if (needleArg === undefined || !rangeArg || !isMatrix(rangeArg) || columnArg === undefined) return formulaError("#VALUE!");
    const column = toNumber(scalar(columnArg));
    const approx = approxArg === undefined ? true : toBool(scalar(approxArg));
    if (isFormulaError(column)) return column;
    if (isFormulaError(approx)) return approx;
    if (column < 1 || column > (rangeArg[0]?.length ?? 0)) return formulaError("#REF!");
    const index = lookupIndex(scalar(needleArg), rangeArg.map((row) => row[0] ?? null), approx ? 1 : 0);
    return index === -1 ? formulaError("#N/A") : (rangeArg[index]![column - 1] ?? null);
  },
  HLOOKUP: (args) => {
    const [needleArg, rangeArg, rowArg, approxArg] = args;
    if (needleArg === undefined || !rangeArg || !isMatrix(rangeArg) || rowArg === undefined) return formulaError("#VALUE!");
    const row = toNumber(scalar(rowArg));
    const approx = approxArg === undefined ? true : toBool(scalar(approxArg));
    if (isFormulaError(row)) return row;
    if (isFormulaError(approx)) return approx;
    if (row < 1 || row > rangeArg.length) return formulaError("#REF!");
    const index = lookupIndex(scalar(needleArg), rangeArg[0] ?? [], approx ? 1 : 0);
    return index === -1 ? formulaError("#N/A") : (rangeArg[row - 1]![index] ?? null);
  },
  XLOOKUP: (args) => {
    const [needleArg, lookupArg, returnArg, missingArg] = args;
    if (needleArg === undefined || !lookupArg || !returnArg) return formulaError("#VALUE!");
    const lookup = isMatrix(lookupArg) ? lookupArg.flat() : [lookupArg];
    const results = isMatrix(returnArg) ? returnArg.flat() : [returnArg];
    const index = lookupIndex(scalar(needleArg), lookup, 0);
    if (index === -1) return missingArg === undefined ? formulaError("#N/A") : scalar(missingArg);
    return results[index] ?? formulaError("#REF!");
  },
  CHOOSE: (args) => {
    const index = toNumber(scalar(args[0] ?? null));
    if (isFormulaError(index)) return index;
    const choice = args[Math.trunc(index)];
    return index < 1 || choice === undefined ? formulaError("#VALUE!") : scalar(choice);
  },
};
FUNCTIONS.CONCATENATE = FUNCTIONS.CONCAT!;
FUNCTIONS.AVG = FUNCTIONS.AVERAGE!;

/** Names of the built-in functions, for autocomplete. */
export const FORMULA_FUNCTIONS: readonly string[] = [...Object.keys(FUNCTIONS), "IF", "IFERROR", "IFNA", "IFS"].sort();

export interface SheetSource {
  name: string;
  /** Raw input by address, e.g. { A1: "Price", B2: "=A2*2" }. */
  cells: Readonly<Record<string, string>>;
}

export interface WorkbookEvaluator {
  /** Computed value of one cell. Results are cached until a new evaluator is created. */
  value: (sheet: number, row: number, column: number) => CellValue;
  /** Evaluates a formula as if typed into the given sheet. */
  evaluate: (formula: string, sheet?: number) => CellValue;
}

const MAX_DEPTH = 1500;
const MAX_RANGE_CELLS = 1_000_000;

/**
 * Lazy evaluator over a workbook: formulas are computed on first read and
 * cached; circular references resolve to #CYCLE!. Supports A1 and $A$1
 * references, ranges (A1:B3, A:A, 1:1) and other sheets ('Q1 Sales'!B2).
 */
export function createWorkbookEvaluator(sheets: readonly SheetSource[]): WorkbookEvaluator {
  const cache = new Map<string, CellValue>();
  const active = new Set<string>();
  const parsed = new Map<string, Node | FormulaError>();
  const extents = sheets.map((sheet) => {
    let rows = 0;
    let columns = 0;
    for (const address of Object.keys(sheet.cells)) {
      const cell = parseCellAddress(address);
      if (!cell) continue;
      rows = Math.max(rows, cell.row + 1);
      columns = Math.max(columns, cell.column + 1);
    }
    return { rows, columns };
  });
  let depth = 0;

  const sheetIndex = (name: string | undefined, current: number) => {
    if (name === undefined) return current;
    const lower = name.toLowerCase();
    return sheets.findIndex((sheet) => sheet.name.toLowerCase() === lower);
  };

  const compile = (formula: string): Node | FormulaError => {
    let node = parsed.get(formula);
    if (!node) {
      try {
        node = parse(formula.slice(1));
      } catch (error) {
        node = formulaError(error instanceof SyntaxError && /Unknown name/.test(error.message) ? "#NAME?" : "#VALUE!");
      }
      parsed.set(formula, node);
    }
    return node;
  };

  const value = (sheet: number, row: number, column: number): CellValue => {
    const source = sheets[sheet];
    if (!source) return formulaError("#REF!");
    const key = `${sheet}:${row}:${column}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const raw = source.cells[cellAddress(row, column)] ?? "";
    if (!raw.startsWith("=") || raw.length === 1) {
      const literal = parseLiteral(raw);
      cache.set(key, literal);
      return literal;
    }
    if (active.has(key)) return formulaError("#CYCLE!");
    if (depth >= MAX_DEPTH) return formulaError("#CALC!");
    active.add(key);
    depth++;
    let result: CellValue;
    try {
      const node = compile(raw);
      result = isFormulaError(node) ? node : scalar(evaluateNode(node, sheet));
    } finally {
      depth--;
      active.delete(key);
    }
    if (typeof result === "number" && !Number.isFinite(result)) result = formulaError("#NUM!");
    cache.set(key, result);
    return result;
  };

  const range = (sheet: number, top: number, left: number, bottom: number, right: number): Matrix | FormulaError => {
    const extent = extents[sheet];
    if (!extent) return formulaError("#REF!");
    const lastRow = Math.min(bottom, Math.max(top, extent.rows - 1));
    const lastColumn = Math.min(right, Math.max(left, extent.columns - 1));
    if ((lastRow - top + 1) * (lastColumn - left + 1) > MAX_RANGE_CELLS) return formulaError("#CALC!");
    const matrix: Matrix = [];
    for (let r = top; r <= lastRow; r++) {
      const row: CellValue[] = [];
      for (let c = left; c <= lastColumn; c++) row.push(value(sheet, r, c));
      matrix.push(row);
    }
    return matrix;
  };

  const evaluateNode = (node: Node, sheet: number): Arg => {
    switch (node.type) {
      case "number":
      case "string":
      case "bool":
        return node.value;
      case "error":
        return node.value;
      case "ref": {
        const target = sheetIndex(node.target.sheet, sheet);
        return target === -1 ? formulaError("#REF!") : value(target, node.target.row, node.target.column);
      }
      case "range": {
        const target = sheetIndex(node.sheet, sheet);
        return target === -1 ? formulaError("#REF!") : range(target, node.top, node.left, node.bottom, node.right);
      }
      case "unary": {
        const operand = toNumber(scalar(evaluateNode(node.operand, sheet)));
        return isFormulaError(operand) ? operand : node.op === "-" ? -operand : operand;
      }
      case "postfix": {
        const operand = toNumber(scalar(evaluateNode(node.operand, sheet)));
        return isFormulaError(operand) ? operand : operand / 100;
      }
      case "binary":
        return binary(node.op, scalar(evaluateNode(node.left, sheet)), scalar(evaluateNode(node.right, sheet)));
      case "call":
        return call(node, sheet);
    }
  };

  const call = (node: Extract<Node, { type: "call" }>, sheet: number): Arg => {
    const evalScalar = (arg: Node | undefined) => (arg ? scalar(evaluateNode(arg, sheet)) : null);
    switch (node.name) {
      case "IF": {
        const condition = toBool(evalScalar(node.args[0]));
        if (isFormulaError(condition)) return condition;
        const branch = condition ? node.args[1] : node.args[2];
        return branch ? evaluateNode(branch, sheet) : condition ? true : false;
      }
      case "IFERROR":
      case "IFNA": {
        const result = evaluateNode(node.args[0] ?? { type: "string", value: "" }, sheet);
        const first = scalar(result);
        const caught = isFormulaError(first) && (node.name === "IFERROR" || first.error === "#N/A");
        return caught ? evalScalar(node.args[1]) : result;
      }
      case "IFS": {
        for (let index = 0; index + 1 < node.args.length; index += 2) {
          const condition = toBool(evalScalar(node.args[index]));
          if (isFormulaError(condition)) return condition;
          if (condition) return evaluateNode(node.args[index + 1]!, sheet);
        }
        return formulaError("#N/A");
      }
    }
    const fn = FUNCTIONS[node.name];
    if (!fn) return formulaError("#NAME?");
    return fn(node.args.map((arg) => evaluateNode(arg, sheet)));
  };

  return {
    value,
    evaluate: (formula, sheet = 0) => {
      if (!formula.startsWith("=")) return parseLiteral(formula);
      const node = compile(formula);
      return isFormulaError(node) ? node : scalar(evaluateNode(node, sheet));
    },
  };
}

function binary(op: string, left: CellValue, right: CellValue): CellValue {
  if (isFormulaError(left)) return left;
  if (isFormulaError(right)) return right;
  switch (op) {
    case "&": {
      const a = toText(left);
      const b = toText(right);
      if (isFormulaError(a)) return a;
      if (isFormulaError(b)) return b;
      return a + b;
    }
    case "=":
      return compare(left, right) === 0;
    case "<>":
      return compare(left, right) !== 0;
    case "<":
      return compare(left, right) < 0;
    case ">":
      return compare(left, right) > 0;
    case "<=":
      return compare(left, right) <= 0;
    case ">=":
      return compare(left, right) >= 0;
  }
  const a = toNumber(left);
  const b = toNumber(right);
  if (isFormulaError(a)) return a;
  if (isFormulaError(b)) return b;
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/":
      return b === 0 ? formulaError("#DIV/0!") : a / b;
    case "^":
      return a === 0 && b < 0 ? formulaError("#DIV/0!") : a ** b;
    default:
      return formulaError("#VALUE!");
  }
}

/** Display text for a computed value. */
export function displayCellValue(value: CellValue): string {
  if (value === null) return "";
  if (isFormulaError(value)) return value.error;
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return formatNumber(value);
  return value;
}
