// packages/ai-ui/src/lib/models.ts
import { fuzzyMatch } from "./fuzzy.js";

export type ModelCapability = "reasoning" | "vision" | "tools" | "json" | "audio";

/** Five health states: checked and fine, slow or erroring, unreachable, not yet known, and being checked now. */
export type HealthState = "operational" | "degraded" | "down" | "unknown" | "checking";

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  description?: string;
  /** Context window in tokens. */
  contextWindow?: number;
  /** Largest response in tokens. */
  maxOutput?: number;
  capabilities?: ModelCapability[];
  /** Price in dollars per million tokens. */
  pricing?: { input: number; output: number };
  free?: boolean;
  health?: HealthState;
  /** Median response latency in milliseconds. */
  latencyMs?: number;
  deprecated?: boolean;
  /** Runs on this device rather than through a provider's API. */
  local?: boolean;
}

/** "8K", "200K", "1M" for a token count. */
export function formatTokenCount(tokens: number): string {
  if (!Number.isFinite(tokens) || tokens < 0) return "";
  if (tokens >= 1_000_000) return `${Number((tokens / 1_000_000).toFixed(tokens % 1_000_000 ? 1 : 0))}M`;
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}K`;
  return String(Math.round(tokens));
}

/** "$3 / $15 per 1M tokens", or "Free". */
export function formatModelPrice(model: Pick<ModelInfo, "pricing" | "free">): string {
  if (model.free || (model.pricing && model.pricing.input === 0 && model.pricing.output === 0)) return "Free";
  if (!model.pricing) return "";
  const money = (value: number) => `$${value < 1 ? value.toFixed(2).replace(/0$/, "") : Number(value.toFixed(2))}`;
  return `${money(model.pricing.input)} in / ${money(model.pricing.output)} out per 1M tokens`;
}

/** Dollar cost of a request from its token counts. */
export function estimateCost(model: Pick<ModelInfo, "pricing" | "free">, inputTokens: number, outputTokens: number): number {
  if (model.free || !model.pricing) return 0;
  return (inputTokens * model.pricing.input + outputTokens * model.pricing.output) / 1_000_000;
}

/** True when the model's id, name, provider or description fuzzily matches the query. */
export function modelMatches(model: ModelInfo, query: string): boolean {
  const value = query.trim();
  if (!value) return true;
  return [model.name, model.id, model.provider, model.description ?? ""].some((field) => fuzzyMatch(value, field) !== null);
}

/** Models grouped by provider in first-seen order, for grouped lists. */
export function groupModelsByProvider<T extends Pick<ModelInfo, "provider">>(models: readonly T[]): Array<{ value: string; items: T[] }> {
  const groups = new Map<string, T[]>();
  for (const model of models) groups.set(model.provider, [...(groups.get(model.provider) ?? []), model]);
  return [...groups.entries()].map(([value, items]) => ({ value, items }));
}

export const HEALTH_LABELS: Record<HealthState, string> = {
  operational: "Operational",
  degraded: "Degraded",
  down: "Down",
  unknown: "Not checked",
  checking: "Checking",
};
