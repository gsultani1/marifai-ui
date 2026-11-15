// packages/ai-ui/test/markdown.test.ts
import { describe, expect, it } from "vitest";

import { repairMarkdown, splitMarkdownBlocks } from "../src/lib/markdown.js";

describe("splitMarkdownBlocks", () => {
  it("splits top-level blocks without losing any source text", () => {
    const markdown = "# Title\n\nFirst paragraph.\n\n- one\n- two\n\n```ts\nconst a = 1;\n```\n\nLast **bold** line.";
    const blocks = splitMarkdownBlocks(markdown);
    expect(blocks).toHaveLength(5);
    expect(blocks.join("")).toBe(markdown);
    expect(blocks[3]).toContain("```ts");
  });

  it("keeps documents with reference definitions or footnotes whole", () => {
    expect(splitMarkdownBlocks("See [docs][1].\n\n[1]: https://example.com")).toHaveLength(1);
    expect(splitMarkdownBlocks("Claim.[^1]\n\n[^1]: Source.")).toHaveLength(1);
  });

  it("returns the input for empty markdown", () => {
    expect(splitMarkdownBlocks("")).toEqual([""]);
  });
});

describe("repairMarkdown", () => {
  it.each([
    ["Hello **wor", "Hello **wor**"],
    ["Hello *wor", "Hello *wor*"],
    ["Hello __wor", "Hello __wor__"],
    ["Use `npm i", "Use `npm i`"],
    ["~~gone", "~~gone~~"],
    ["**bold *both", "**bold *both***"],
    ["**bold ", "**bold** "],
    ["Hello **", "Hello "],
    ["See [the docs](https://exa", "See the docs"],
    ["See [the do", "See the do"],
    ["Image ![alt](https://exa", "Image "],
  ])("repairs %j", (input, expected) => {
    expect(repairMarkdown(input)).toBe(expected);
  });

  it.each([
    "**bold** and *italic* done",
    "snake_case_name and 5 * 3",
    "~5 minutes",
    "array[0] and [link](https://example.com)",
    "- [ ] task",
    "Escaped \\*star",
  ])("leaves complete text %j unchanged", (input) => {
    expect(repairMarkdown(input)).toBe(input);
  });

  it("leaves open code fences alone", () => {
    const markdown = "Intro\n\n```js\nconst s = '**";
    expect(repairMarkdown(markdown)).toBe(markdown);
  });

  it("only repairs the trailing paragraph after closed fences", () => {
    expect(repairMarkdown("```\n**raw\n```\nThen **bo")).toBe("```\n**raw\n```\nThen **bo**");
    expect(repairMarkdown("Old *one\n\nNew **two")).toBe("Old *one\n\nNew **two**");
  });
});
