// packages/ai-ui/src/lib/execution.ts
export type ExecutionOutput =
  | { type: "stdout"; text: string }
  | { type: "stderr"; text: string }
  | { type: "image"; src: string; alt: string }
  | { type: "html"; html: string; title?: string }
  | { type: "json"; value: unknown; label?: string }
  | { type: "error"; name?: string; message: string; traceback?: string };

export type NotebookCellType = "code" | "markdown";
export type NotebookCellStatus = "idle" | "queued" | "running" | "success" | "error";

export interface NotebookCell {
  id: string;
  type: NotebookCellType;
  source: string;
  outputs?: ExecutionOutput[];
  executionCount?: number | null;
  status?: NotebookCellStatus;
}

export interface NotebookMetadata {
  kernelName?: string;
  /** e.g. "python". */
  language?: string;
}

type Multiline = string | string[];

interface IpynbOutput {
  output_type: string;
  name?: string;
  text?: Multiline;
  data?: Record<string, unknown>;
  ename?: string;
  evalue?: string;
  traceback?: string[];
  execution_count?: number | null;
  metadata?: Record<string, unknown>;
}

interface IpynbCell {
  id?: string;
  cell_type: string;
  source: Multiline;
  metadata?: Record<string, unknown>;
  outputs?: IpynbOutput[];
  execution_count?: number | null;
}

function utf8ToBase64(text: string): string {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function toLines(text: string): string[] {
  if (!text) return [];
  const lines = text.split("\n");
  return lines.map((line, index) => (index < lines.length - 1 ? `${line}\n` : line)).filter((line, index, all) => line !== "" || index < all.length - 1);
}

function fromMultiline(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string").join("");
  return "";
}

function outputToIpynb(output: ExecutionOutput): IpynbOutput {
  switch (output.type) {
    case "stdout":
    case "stderr":
      return { output_type: "stream", name: output.type, text: toLines(output.text) };
    case "image": {
      const match = /^data:(image\/(?:png|jpeg|gif|svg\+xml));base64,(.*)$/.exec(output.src);
      return { output_type: "display_data", data: match ? { [match[1]!]: match[2]!, "text/plain": [output.alt] } : { "text/html": [`<img src="${output.src.replace(/"/g, "&quot;")}" alt="${output.alt.replace(/"/g, "&quot;")}">`], "text/plain": [output.alt] }, metadata: {} };
    }
    case "html":
      return { output_type: "display_data", data: { "text/html": toLines(output.html), "text/plain": [output.title ?? "HTML output"] }, metadata: {} };
    case "json":
      return { output_type: "display_data", data: { "application/json": output.value, "text/plain": [JSON.stringify(output.value)] }, metadata: {} };
    case "error":
      return { output_type: "error", ename: output.name ?? "Error", evalue: output.message, traceback: output.traceback ? output.traceback.split("\n") : [] };
  }
}

function outputFromIpynb(output: IpynbOutput): ExecutionOutput | null {
  if (output.output_type === "stream") return { type: output.name === "stderr" ? "stderr" : "stdout", text: fromMultiline(output.text) };
  if (output.output_type === "error") return { type: "error", name: output.ename ?? "Error", message: output.evalue ?? "", ...(output.traceback?.length ? { traceback: output.traceback.join("\n") } : {}) };
  const data = output.data ?? {};
  const plain = fromMultiline(data["text/plain"]);
  for (const mime of ["image/png", "image/jpeg", "image/gif"]) {
    const base64 = fromMultiline(data[mime]).replace(/\s/g, "");
    if (base64) return { type: "image", src: `data:${mime};base64,${base64}`, alt: plain || "Output image" };
  }
  const svg = fromMultiline(data["image/svg+xml"]);
  if (svg) return { type: "image", src: `data:image/svg+xml;base64,${utf8ToBase64(svg)}`, alt: plain || "Output image" };
  const html = fromMultiline(data["text/html"]);
  if (html) return { type: "html", html, ...(plain ? { title: plain } : {}) };
  if (data["application/json"] !== undefined) return { type: "json", value: data["application/json"] };
  if (plain) return { type: "stdout", text: plain };
  return null;
}

/** Notebook as Jupyter nbformat 4.5 JSON. */
export function notebookToIpynb(cells: NotebookCell[], { kernelName = "Python 3", language = "python" }: NotebookMetadata = {}): string {
  const notebook = {
    cells: cells.map((cell): IpynbCell => {
      if (cell.type === "markdown") return { id: cell.id, cell_type: "markdown", metadata: {}, source: toLines(cell.source) };
      return { id: cell.id, cell_type: "code", metadata: {}, execution_count: cell.executionCount ?? null, outputs: (cell.outputs ?? []).map(outputToIpynb), source: toLines(cell.source) };
    }),
    metadata: { kernelspec: { display_name: kernelName, language, name: language === "python" ? "python3" : language }, language_info: { name: language } },
    nbformat: 4,
    nbformat_minor: 5,
  };
  return `${JSON.stringify(notebook, null, 1)}\n`;
}

export type IpynbResult = { ok: true; cells: NotebookCell[]; metadata: NotebookMetadata } | { ok: false; error: string };

/** Reads a Jupyter notebook (nbformat 4) with caps on size and cell count. Raw cells become code cells. */
export function notebookFromIpynb(text: string, { maxBytes = 20 * 1024 * 1024, maxCells = 2000 }: { maxBytes?: number; maxCells?: number } = {}): IpynbResult {
  if (new Blob([text]).size > maxBytes) return { ok: false, error: `The notebook is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.` };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "This isn't a notebook (the file isn't valid JSON)." };
  }
  const record = data as { cells?: unknown; nbformat?: unknown; metadata?: { kernelspec?: { display_name?: unknown; language?: unknown }; language_info?: { name?: unknown } } } | null;
  if (!record || typeof record !== "object" || !Array.isArray(record.cells)) return { ok: false, error: "This isn't a Jupyter notebook." };
  if (typeof record.nbformat === "number" && record.nbformat < 4) return { ok: false, error: "Only nbformat 4 notebooks are supported. Re-save the notebook in a recent Jupyter." };
  if (record.cells.length > maxCells) return { ok: false, error: `The notebook has more than ${maxCells.toLocaleString()} cells.` };
  const cells: NotebookCell[] = [];
  for (const [index, raw] of (record.cells as unknown[]).entries()) {
    const cell = raw as IpynbCell | null;
    if (!cell || typeof cell !== "object" || typeof cell.cell_type !== "string") return { ok: false, error: `Cell ${index + 1} is not in a supported format.` };
    const id = typeof cell.id === "string" && cell.id ? cell.id : `cell-${index + 1}`;
    const source = fromMultiline(cell.source);
    if (cell.cell_type === "markdown") cells.push({ id, type: "markdown", source });
    else
      cells.push({
        id,
        type: "code",
        source,
        executionCount: typeof cell.execution_count === "number" ? cell.execution_count : null,
        outputs: Array.isArray(cell.outputs) ? cell.outputs.flatMap((output) => (output && typeof output === "object" ? (outputFromIpynb(output) ?? []) : [])) : [],
      });
  }
  const kernelspec = record.metadata?.kernelspec;
  const language = typeof kernelspec?.language === "string" ? kernelspec.language : typeof record.metadata?.language_info?.name === "string" ? record.metadata.language_info.name : undefined;
  return { ok: true, cells, metadata: { ...(typeof kernelspec?.display_name === "string" ? { kernelName: kernelspec.display_name } : {}), ...(language ? { language } : {}) } };
}
