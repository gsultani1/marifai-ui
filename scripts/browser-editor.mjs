// packages/ai-ui/scripts/browser-editor.mjs
import assert from "node:assert/strict";

import AxeBuilder from "@axe-core/playwright";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function expectClean(page, include, label) {
  const report = await new AxeBuilder({ page }).include(include).withTags(WCAG).analyze();
  const found = report.violations.map((violation) => ({ id: violation.id, targets: violation.nodes.map((node) => node.target.join(" ")) }));
  assert.deepEqual(found, [], `${label}: accessibility violations`);
}

/** Selects `text` inside the editor through the DOM selection, the way a person dragging would. */
async function selectText(editor, text) {
  await editor.focus();
  await editor.page().waitForTimeout(80);
  await editor.evaluate((root, target) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const index = node.data.indexOf(target);
      if (index >= 0) {
        document.getSelection().setBaseAndExtent(node, index, node, index + target.length);
        return;
      }
    }
    throw new Error(`text not found: ${target}`);
  }, text);
  await editor.page().waitForTimeout(120);
}

const focusedLabel = (page) => page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent?.trim() ?? "");

/** Puts known paragraphs in the product editor through the HTML source view, whatever earlier checks left there. */
async function resetProduct(page, frame, product) {
  const toggle = frame.getByRole("button", { name: "HTML source" });
  await toggle.click();
  const source = frame.getByRole("textbox", { name: "HTML source" });
  await source.waitFor();
  await source.click();
  await page.keyboard.press("Control+a");
  await page.keyboard.insertText("<p>One-coat hide, mildew resistant and rated for 15 years.</p><p>Ask the paint desk about color matching.</p>");
  await toggle.click();
  await product.locator("p", { hasText: "Ask the paint desk" }).waitFor();
}

async function checkBlocks(page, pass) {
  const product = page.getByRole("textbox", { name: "Product description" });
  const frame = page.locator('[data-slot="html-editor"]').filter({ has: page.locator('[aria-label="Product description"]') });
  await product.scrollIntoViewIfNeeded();
  await resetProduct(page, frame, product);
  await product.locator("p", { hasText: "One-coat hide" }).click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/");
  const menu = page.getByRole("listbox", { name: "Insert block" });
  await menu.waitFor();
  await page.keyboard.type("head");
  await page.keyboard.press("ArrowDown");
  const active = await product.getAttribute("aria-activedescendant");
  assert.match(await page.locator(`[id="${active}"]`).textContent(), /Heading 2/);
  await page.keyboard.press("Enter");
  await menu.waitFor({ state: "detached" });
  await page.keyboard.type("Store hours");
  await product.locator("h2", { hasText: "Store hours" }).waitFor();
  await page.keyboard.type(" /");
  await menu.waitFor();
  await page.keyboard.press("Escape");
  await menu.waitFor({ state: "detached" });
  await product.locator("h2", { hasText: "Store hours /" }).waitFor();
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  pass("slash menu filters blocks, turns a line into a heading and keeps the text on Escape");

  await selectText(product, "One-coat hide");
  const bubble = page.getByRole("toolbar", { name: "Format selection" });
  await bubble.waitFor();
  await page.keyboard.press("Alt+F10");
  assert.equal(await focusedLabel(page), "Bold");
  await page.keyboard.press("ArrowRight");
  assert.equal(await focusedLabel(page), "Italic");
  await page.keyboard.press("Escape");
  assert.equal(await focusedLabel(page), "Product description");
  pass("selection toolbar appears over selected text and is reachable with Alt+F10");

  await product.locator("p", { hasText: "Ask the paint desk" }).click();
  await page.keyboard.press("Control+/");
  const blockMenu = page.getByRole("menu", { name: "Block actions" });
  await blockMenu.waitFor();
  await expectClean(page, '[role="menu"]', "block menu");
  await page.keyboard.press("Escape");
  await blockMenu.waitFor({ state: "detached" });
  await page.keyboard.press("Alt+Shift+ArrowUp");
  await frame.getByRole("status").filter({ hasText: "Moved block up" }).waitFor();
  await page.keyboard.press("Alt+Shift+ArrowDown");
  pass("block menu opens with Ctrl+/ and Alt+Shift+arrows move the current block");
}

async function checkMedia(page, pass, report, frame) {
  await report.locator("figure img").click();
  const imageTools = page.getByRole("toolbar", { name: "Image" });
  await imageTools.waitFor();
  await imageTools.getByRole("button", { name: "Align image left" }).click();
  assert.equal(await report.locator("figure").getAttribute("data-align"), "left");
  await report.locator("figure img").click();
  await page.keyboard.press("Alt+ArrowRight");
  await frame.getByRole("status").filter({ hasText: /^Image width \d+ pixels/ }).waitFor();
  await expectClean(page, '[role="toolbar"][aria-label="Image"]', "figure toolbar");
  await imageTools.getByRole("button", { name: "Center image" }).click();
  pass("figure toolbar aligns the image and Alt+Right resizes it with an announcement");

  await report.getByRole("button", { name: "Callout type: Warning" }).click();
  const tones = page.getByRole("menu", { name: "Callout type" });
  await tones.waitFor();
  await expectClean(page, '[role="menu"]', "callout tone menu");
  await tones.getByRole("menuitemradio", { name: "Danger" }).click();
  assert.equal(await report.locator("aside").getAttribute("data-callout"), "danger");
  pass("callout tone menu changes the callout type");

  await report.locator("[data-columns] p").first().click();
  const layout = report.getByRole("toolbar", { name: "Column layout" });
  await layout.getByRole("button", { name: "Add column" }).click();
  assert.equal(await report.locator("[data-columns]").getAttribute("data-columns"), "3");
  await layout.getByRole("button", { name: "Remove column" }).click();
  assert.equal(await report.locator("[data-columns]").getAttribute("data-columns"), "2");
  pass("column layout controls add and remove a column");

  await report.locator("td").nth(1).click();
  await frame.getByRole("button", { name: /^Cell color/ }).click();
  await page.getByRole("menuitemradio", { name: "Green" }).click();
  assert.match((await report.locator("td").nth(1).getAttribute("style")) ?? "", /background-color: rgb\(220, 252, 231\)/);
  pass("table cells take a background color from the cell color menu");
}

async function checkDocument(page, pass, report, frame) {
  const toggle = frame.getByRole("button", { name: "Page layout" });
  await toggle.click();
  assert.equal(await toggle.getAttribute("aria-pressed"), "true");
  await report.locator(":scope > [data-page-gap]").first().waitFor();
  assert.equal((await report.locator("[data-page-head]").first().textContent())?.trim(), "Whitten Hardware · store-reset-report");
  await frame.getByText(/^Page \d+ of \d+$/).last().waitFor();
  pass("page layout paginates the report with the header and a page count");

  await report.getByRole("button", { name: "Footnote 1" }).click();
  const footnote = page.getByRole("dialog", { name: "Footnote 1" });
  await footnote.waitFor();
  assert.equal(await footnote.getByRole("textbox", { name: "Footnote text" }).inputValue(), "Sales figures are from the March register reports.");
  await expectClean(page, '[role="dialog"]', "footnote editor");
  await page.keyboard.press("Escape");
  await footnote.waitFor({ state: "detached" });
  pass("footnotes open in an editor with their text");

  await report.getByRole("group", { name: "Table of contents" }).getByRole("button", { name: /Paint promotion/ }).click();
  assert.ok(await page.evaluate(() => document.getSelection()?.anchorNode?.parentElement?.closest("h2")?.textContent?.includes("Paint promotion")), "the table of contents did not move the cursor to the heading");
  await toggle.click();
  assert.equal(await toggle.getAttribute("aria-pressed"), "false");
  pass("table of contents jumps to a heading and page layout switches back to web layout");
}

async function checkAi(page, pass, report) {
  await selectText(report, "The paint desk recieves extra color cards on Wednesday.");
  await page.keyboard.press("Control+j");
  await page.getByRole("group", { name: "Ask AI" }).waitFor();
  await page.keyboard.press("ArrowDown");
  const active = await page.getByRole("combobox", { name: "Ask AI to edit or write" }).getAttribute("aria-activedescendant");
  assert.match(await page.locator(`[id="${active}"]`).textContent(), /Fix spelling and grammar/);
  await expectClean(page, '[data-slot="html-ai-menu"]', "AI menu");
  await page.keyboard.press("Enter");
  const preview = page.getByRole("region", { name: "AI suggestion" });
  await preview.getByRole("button", { name: "Replace" }).waitFor();
  await expectClean(page, '[data-slot="html-ai-preview"]', "AI preview");
  await preview.getByRole("button", { name: "Replace" }).click();
  await report.getByText("The paint desk receives extra color cards on Wednesday.").waitFor();
  assert.equal(await report.getByText("recieves").count(), 0);
  pass("AI menu fixes the selected sentence with a streamed suggestion and replaces it");
}

async function checkReview(page, pass, report, frame) {
  const panel = frame.getByRole("complementary", { name: "Review" });
  await selectText(report, "grills");
  await page.getByRole("toolbar", { name: "Format selection" }).getByRole("button", { name: /^Comment/ }).click();
  const composer = page.getByRole("dialog", { name: "Add a comment" });
  await composer.waitFor();
  await page.keyboard.type("Check the endcap measurements");
  await page.keyboard.press("Control+Enter");
  await composer.waitFor({ state: "detached" });
  const threads = panel.getByRole("list", { name: "Open comments" }).getByRole("article");
  await threads.nth(1).waitFor();
  assert.match(await threads.first().textContent(), /grills/);
  pass("comments are added from the selection toolbar and listed in document order");

  const tracking = frame.getByRole("button", { name: "Track changes" });
  await tracking.click();
  assert.equal(await tracking.getAttribute("aria-pressed"), "true");
  await report.locator("p", { hasText: "cashiers on Saturday" }).click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Add a bagger.");
  await report.locator("ins", { hasText: "Add a bagger." }).waitFor();
  await panel.getByRole("tab", { name: /Changes/ }).click();
  const added = panel.getByRole("listitem").filter({ hasText: "Add a bagger." });
  await added.getByRole("button", { name: /^Accept/ }).click();
  await report.locator("p", { hasText: "Add a bagger." }).waitFor();
  assert.equal(await report.locator("ins", { hasText: "Add a bagger." }).count(), 0);
  await tracking.click();
  assert.equal(await tracking.getAttribute("aria-pressed"), "false");
  await expectClean(page, '[data-slot="html-editor"]:has([aria-label="Store reset report"])', "review panel");
  pass("track changes records typing as a suggestion that the changes panel accepts");
}

/** Interaction checks for the upgraded HtmlEditor: blocks, media, page layout, AI writing and review. */
export async function checkEditor(page, pass) {
  await checkBlocks(page, pass);
  const report = page.getByRole("textbox", { name: "Store reset report" });
  const frame = page.locator('[data-slot="html-editor"]').filter({ has: page.locator('[aria-label="Store reset report"]') });
  await report.scrollIntoViewIfNeeded();
  await checkMedia(page, pass, report, frame);
  await checkDocument(page, pass, report, frame);
  await checkAi(page, pass, report);
  await checkReview(page, pass, report, frame);

  await page.setViewportSize({ width: 390, height: 844 });
  await report.scrollIntoViewIfNeeded();
  assert.equal(await frame.getByRole("complementary", { name: "Review" }).count(), 0, "the review panel did not collapse in a narrow editor");
  const openReview = frame.getByRole("button", { name: /^Review \d+$/ });
  await openReview.click();
  const overlay = frame.getByRole("complementary", { name: "Review" });
  await overlay.waitFor();
  await expectClean(page, '[data-slot="html-editor"]:has([aria-label="Store reset report"])', "review overlay on a phone");
  await page.keyboard.press("Escape");
  await overlay.waitFor({ state: "detached" });
  await page.setViewportSize({ width: 1280, height: 900 });
  pass("review panel collapses to an overlay in a narrow editor and closes on Escape");
}
