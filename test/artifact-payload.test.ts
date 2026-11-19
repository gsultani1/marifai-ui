// test/artifact-payload.test.ts
import { describe, expect, it } from "vitest";
import { parseArtifactSegments } from "../src/lib/artifact-stream.js";

const wrap = (kind: string, content: string, extra = "") =>
  `<artifact kind="${kind}" slug="sample" title="Sample" ${extra}>${content}</artifact>`;
const chart = { chartType: "bar", xKey: "x", series: [{ key: "y", label: "Count" }], data: [{ x: "A", y: 3 }] };

describe("completed version 1 artifacts", () => {
  it("validates each supported kind and exposes typed chart data", () => {
    for (const kind of ["markdown", "html", "code"]) {
      expect(parseArtifactSegments(wrap(kind, "sample", 'language="ts"'))[0])
        .toMatchObject({ type: "artifact", complete: true, payload: { kind, content: "sample" } });
    }
    expect(parseArtifactSegments(wrap("chart", JSON.stringify(chart)))[0])
      .toMatchObject({ type: "artifact", payload: { kind: "chart", data: chart } });
  });
  it("keeps invalid completed input as text and continues parsing", () => {
    for (const input of [
      wrap("code", "x"), wrap("markdown", " "), wrap("chart", "{"), wrap("other", "x"),
      wrap("chart", JSON.stringify({ ...chart, data: [{ y: 1 }] })),
      wrap("chart", JSON.stringify({ ...chart, data: [{ x: "A", y: "bad" }] })),
      wrap("html", "x", 'schema-version="2"'),
      '<artifact kind="html" title="Sample">x</artifact>',
    ]) {
      expect(parseArtifactSegments(input + wrap("markdown", "ok"))).toMatchObject([
        { type: "text", text: input }, { type: "artifact", payload: { kind: "markdown" } },
      ]);
    }
  });
  it("keeps legacy tags intact and waits for the closing tag", () => {
    expect(parseArtifactSegments('<artifact type="react">x</artifact>')[0]).toEqual({
      type: "artifact", tag: "artifact", attributes: { type: "react" }, content: "x", complete: true,
    });
    const input = wrap("chart", JSON.stringify(chart));
    for (let i = input.indexOf(">") + 1; i < input.length; i++) {
      const segment = parseArtifactSegments(input.slice(0, i), { streaming: true })[0];
      expect(segment).toMatchObject({ type: "artifact", complete: false });
      expect(segment).not.toHaveProperty("payload");
    }
  });
});
