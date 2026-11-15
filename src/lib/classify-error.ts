// packages/ai-ui/src/lib/classify-error.ts
export type AgentErrorKind = "auth" | "rate-limit" | "quota" | "context" | "network" | "server" | "aborted" | "unknown";

export interface ClassifiedError {
  kind: AgentErrorKind;
  title: string;
  hint: string;
  /** Safe to send the same request again without changes. */
  retryable: boolean;
  status?: number;
  requestId?: string;
  retryAfterMs?: number;
  message: string;
}

const COPY: Record<AgentErrorKind, { title: string; hint: string; retryable: boolean }> = {
  auth: { title: "The provider rejected the API key", hint: "Check the key in settings or switch to another provider.", retryable: false },
  "rate-limit": { title: "Too many requests", hint: "The provider is limiting requests. Wait a moment and try again.", retryable: true },
  quota: { title: "Out of credits or quota", hint: "Add credits, raise the limit or switch to another model.", retryable: false },
  context: { title: "The conversation is too long for this model", hint: "Remove attachments, start a new chat or pick a model with a larger context.", retryable: false },
  network: { title: "Connection problem", hint: "Check your connection and try again.", retryable: true },
  server: { title: "The provider had a problem", hint: "This is usually temporary. Try again or switch models.", retryable: true },
  aborted: { title: "Stopped", hint: "The request was cancelled before it finished.", retryable: true },
  unknown: { title: "Something went wrong", hint: "Try again. If it keeps happening, copy the diagnostics and report it.", retryable: true },
};

const PATTERNS: Array<[AgentErrorKind, RegExp]> = [
  ["context", /context(?:[ _-]length|[ _-]window)?[ _-]exceeded|maximum context|too many tokens|prompt is too long|token limit|context_length/i],
  ["quota", /quota|insufficient[ _-](?:credits|funds|balance)|billing|credit balance|payment required|exceeded your current/i],
  ["auth", /api[ _-]?key|unauthori[sz]ed|invalid[ _-](?:token|credentials|x-api-key)|authentication|forbidden|permission denied/i],
  ["rate-limit", /rate[ _-]?limit|too many requests|slow down|throttl/i],
  ["network", /network|fetch failed|failed to fetch|econnreset|econnrefused|enotfound|etimedout|socket hang up|timed? ?out|offline|load failed/i],
  ["server", /overloaded|internal server error|bad gateway|service unavailable|gateway timeout|upstream/i],
];

function read(value: unknown, ...path: string[]): unknown {
  let current: unknown = value;
  for (const key of path) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function header(error: unknown, name: string): string | undefined {
  const headers = read(error, "headers") ?? read(error, "response", "headers");
  if (!headers) return undefined;
  if (typeof (headers as Headers).get === "function") return (headers as Headers).get(name) ?? undefined;
  const value = (headers as Record<string, unknown>)[name] ?? (headers as Record<string, unknown>)[name.toLowerCase()];
  return typeof value === "string" ? value : undefined;
}

function parseRetryAfter(value: string | undefined, now: number): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : undefined;
}

function kindFromStatus(status: number | undefined): AgentErrorKind | undefined {
  if (status === undefined) return undefined;
  if (status === 401 || status === 403) return "auth";
  if (status === 402) return "quota";
  if (status === 413) return "context";
  if (status === 408) return "network";
  if (status === 429) return "rate-limit";
  if (status >= 500) return "server";
  return undefined;
}

/**
 * Maps provider and transport errors to a kind the UI can act on: fix the
 * key, wait, add credits, shorten the context, or retry. Reads HTTP status,
 * Retry-After and request ids from common SDK error shapes.
 */
export function classifyError(error: unknown, now = Date.now()): ClassifiedError {
  const message =
    typeof error === "string"
      ? error
      : String(read(error, "error", "message") ?? read(error, "message") ?? (error === undefined || error === null ? "" : JSON.stringify(error)));
  const rawStatus = read(error, "status") ?? read(error, "statusCode") ?? read(error, "response", "status");
  const status = typeof rawStatus === "number" ? rawStatus : typeof rawStatus === "string" && /^\d{3}$/.test(rawStatus) ? Number(rawStatus) : undefined;
  const name = read(error, "name");
  const code = String(read(error, "code") ?? read(error, "error", "type") ?? "");

  let kind: AgentErrorKind | undefined;
  if (name === "AbortError") kind = "aborted";
  else if (status === 429 && /quota|insufficient|billing/i.test(`${message} ${code}`)) kind = "quota";
  else kind = PATTERNS.find(([, pattern]) => pattern.test(`${message} ${code}`))?.[0] ?? kindFromStatus(status);
  if (kind === "auth" && status !== undefined && status >= 500) kind = "server";
  const resolved = kind ?? "unknown";

  const requestId =
    header(error, "x-request-id") ?? header(error, "request-id") ?? (typeof read(error, "requestId") === "string" ? (read(error, "requestId") as string) : undefined) ?? (typeof read(error, "request_id") === "string" ? (read(error, "request_id") as string) : undefined);
  const retryAfterMs = parseRetryAfter(header(error, "retry-after"), now) ?? (typeof read(error, "retryAfterMs") === "number" ? (read(error, "retryAfterMs") as number) : undefined);

  return {
    kind: resolved,
    ...COPY[resolved],
    message: message || COPY[resolved].title,
    ...(status !== undefined ? { status } : {}),
    ...(requestId ? { requestId } : {}),
    ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
  };
}
