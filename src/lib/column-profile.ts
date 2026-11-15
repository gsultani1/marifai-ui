// packages/ai-ui/src/lib/column-profile.ts
export type ProfiledType = "number" | "text" | "boolean" | "date" | "json" | "empty" | "mixed";

export interface ColumnProfileData {
  count: number;
  nulls: number;
  distinct: number;
  type: ProfiledType;
  min?: number | string;
  max?: number | string;
  mean?: number;
  /** Most common values, most frequent first. */
  top: Array<{ value: string; count: number }>;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

function kindOf(value: unknown): Exclude<ProfiledType, "empty" | "mixed"> {
  if (typeof value === "number" || typeof value === "bigint") return "number";
  if (typeof value === "boolean") return "boolean";
  if (value instanceof Date || (typeof value === "string" && ISO_DATE.test(value))) return "date";
  if (typeof value === "object") return "json";
  return "text";
}

/** Displays a cell value as text, with objects as compact JSON. */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** The most frequent values, most frequent first, ties in text order. */
export function topValues(values: string[], limit = 5): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([value, count]) => ({ value, count }));
}

/** Summary statistics for one column of loaded rows: nulls, distinct values, range, mean and top values. */
export function profileColumn(values: unknown[], topCount = 5): ColumnProfileData {
  const present = values.filter((value) => value !== null && value !== undefined && value !== "");
  const kinds = new Set(present.map(kindOf));
  const type: ProfiledType = present.length === 0 ? "empty" : kinds.size === 1 ? [...kinds][0]! : "mixed";
  const texts = present.map(cellText);
  const profile: ColumnProfileData = { count: values.length, nulls: values.length - present.length, distinct: new Set(texts).size, type, top: topValues(texts, topCount) };
  if (type === "number") {
    const numbers = present.map(Number);
    profile.min = numbers.reduce((low, value) => Math.min(low, value), Infinity);
    profile.max = numbers.reduce((high, value) => Math.max(high, value), -Infinity);
    profile.mean = numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
  } else if (type === "date" || type === "text") {
    const sorted = [...texts].sort();
    profile.min = sorted[0]!;
    profile.max = sorted[sorted.length - 1]!;
  }
  return profile;
}
