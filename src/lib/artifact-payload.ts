// src/lib/artifact-payload.ts
import { z } from "zod";

const shortName = z.string().trim().min(1).max(64);
const chart = z.object({
  chartType: z.enum(["line", "bar", "area", "pie"]),
  xKey: shortName,
  xLabel: z.string().max(80).optional(),
  yLabel: z.string().max(80).optional(),
  stacked: z.boolean().optional(),
  series: z.array(z.object({
    key: shortName, label: z.string().trim().min(1).max(80),
    color: z.string().regex(/^#[a-f0-9]{6}$/i).optional(),
  })).min(1).max(8),
  data: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))).min(1).max(500),
}).refine(spec => spec.chartType !== "pie" || spec.series.length === 1)
  .refine(spec => spec.data.every(row => Object.hasOwn(row, spec.xKey) &&
    spec.series.every(({ key }) => row[key] == null || typeof row[key] === "number")));

const metadata = z.object({
  title: z.string().trim().min(1).max(120),
  slug: shortName.regex(/^[a-z0-9][a-z0-9-]*$/),
});
const body = z.string().max(200_000).refine(s => s.trim().length > 0);
const contract = z.discriminatedUnion("kind", [
  metadata.extend({ kind: z.literal("markdown"), content: body }),
  metadata.extend({ kind: z.literal("html"), content: body }),
  metadata.extend({ kind: z.literal("code"), language: z.string().trim().min(1).max(32), content: body }),
  metadata.extend({ kind: z.literal("chart"), data: chart }),
]);

export type ArtifactPayload = z.infer<typeof contract>;

/** Version 1 represents charts as JSON in the tag body; other kinds carry text. */
export function readArtifactPayload(attributes: Record<string, string>, content: string): ArtifactPayload | null {
  if ((attributes["schema-version"] ?? "1") !== "1" || content.length > 200_000) return null;
  let data: unknown;
  if (attributes.kind === "chart") {
    try { data = JSON.parse(content); } catch { return null; }
  }
  const result = contract.safeParse({ ...attributes, content, data });
  return result.success ? result.data : null;
}
