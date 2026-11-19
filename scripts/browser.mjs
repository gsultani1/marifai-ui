// scripts/browser.mjs
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";
import { build, preview } from "vite";

import { checkEditor } from "./browser-editor.mjs";
import { checkVibeEditor } from "./browser-vibe-editor.mjs";
import { checkGeneral } from "./browser-general.mjs";

const output = resolve(process.env.MARIFAI_BROWSER_ARTIFACTS ?? ".browser-artifacts");
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const checks = [];
const pass = (label) => {
  checks.push(label);
  console.log(`ok - ${label}`);
};

async function expectNoViolations(page, label) {
  await page.waitForFunction(() => document.getAnimations().every((animation) => !(animation instanceof CSSTransition)));
  // Frames sandboxed without scripts have no execution context for axe to run in, so it would wait forever.
  const report = await new AxeBuilder({ page }).exclude('iframe[sandbox]:not([sandbox~="allow-scripts"])').withTags(WCAG).analyze();
  await writeFile(resolve(output, `${label}-axe.json`), `${JSON.stringify(report.violations, null, 2)}\n`);
  const found = report.violations.map((violation) => ({
    id: violation.id,
    targets: violation.nodes.map((node) => node.target.join(" ")),
  }));
  assert.deepEqual(found, [], `${label}: accessibility violations`);
  await page.screenshot({ path: resolve(output, `${label}.png`), fullPage: false });
  pass(`${label}: no WCAG 2.1 AA violations`);
}

const distanceFromBottom = (locator) => locator.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight);

async function checkChat(page, url, requests) {
  await page.goto(`${url}#chat`);
  const log = page.getByRole("log", { name: "Conversation" });
  await log.waitFor();
  await page.waitForFunction(() => {
    const el = document.querySelector('[role="log"]');
    return el && el.scrollHeight - el.scrollTop - el.clientHeight < 2;
  });
  pass("conversation opens at the latest message");

  const codeBlock = log.locator('[data-slot="code-block"]').filter({ hasText: "export async function getJson" });
  await codeBlock.getByRole("button", { name: "Copy", exact: true }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(copied, /export async function getJson/);
  pass("code block copies to the real clipboard");

  const tool = page.getByRole("button", { name: /search_docs/ });
  await tool.focus();
  await page.keyboard.press("Enter");
  assert.equal(await tool.getAttribute("aria-expanded"), "true");
  await page.getByRole("button", { name: /Used 2 sources/ }).click();
  pass("tool call and sources disclose from the keyboard and pointer");

  const approve = page.getByRole("button", { name: "Approve" });
  await approve.click();
  await page.getByRole("button", { name: /clear_cache.*Completed/ }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Approve" }).count(), 0);
  pass("async tool approval completes and removes the controls");

  await expectNoViolations(page, "chat-light");
  await page.getByRole("button", { name: "Use dark theme" }).click();
  await expectNoViolations(page, "chat-dark");

  const input = page.getByRole("textbox", { name: "Message" });
  const singleLine = await input.evaluate((el) => el.clientHeight);
  await input.fill("one\ntwo\nthree\nfour");
  assert.ok((await input.evaluate((el) => el.clientHeight)) > singleLine, "textarea did not grow");
  await input.fill("");
  assert.equal(await input.evaluate((el) => el.clientHeight), singleLine, "textarea did not shrink");
  pass("prompt textarea grows and shrinks with its content");

  await input.fill("Walk me through the cleanup");
  await input.press("Enter");
  await page.getByRole("button", { name: "Stop generating" }).waitFor();
  await page.waitForFunction(() => (document.querySelector('[aria-busy="true"] [data-slot="message-content"]')?.textContent?.length ?? 0) > 400);
  assert.ok((await distanceFromBottom(log)) < 2, "streaming did not follow the output");
  await log.evaluate((el) => el.scrollBy({ top: -400, behavior: "instant" }));
  await page.getByRole("button", { name: "Scroll to latest message" }).waitFor();
  const reading = await log.evaluate((el) => el.scrollTop);
  const before = await page.locator('[aria-busy="true"] [data-slot="message-content"]').last().textContent();
  await page.waitForFunction(
    (length) => (document.querySelector('[aria-busy="true"] [data-slot="message-content"]')?.textContent?.length ?? 0) > length + 150,
    before.length,
  );
  assert.ok(Math.abs((await log.evaluate((el) => el.scrollTop)) - reading) < 2, "streaming moved the reading position");
  await page.getByRole("button", { name: "Scroll to latest message" }).click();
  await page.waitForFunction(() => {
    const el = document.querySelector('[role="log"]');
    return el && el.scrollHeight - el.scrollTop - el.clientHeight < 2;
  });
  pass("streaming follows, releases while the user reads back, and resumes on request");

  await page.getByRole("button", { name: "Stop generating" }).click();
  await page.getByRole("button", { name: "Send message" }).waitFor();
  assert.equal(await input.evaluate((el) => el === document.activeElement), true, "stop did not return focus to the input");
  pass("stop ends the stream and returns focus to the input");

  const model = page.getByRole("combobox", { name: "Model" });
  await model.click();
  await page.getByRole("option", { name: /Marifai Deep/ }).click();
  assert.match(await model.textContent(), /Marifai Deep/);
  pass("model selector changes the model");

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, `mobile layout overflows by ${overflow}px`);
  assert.ok(await input.isVisible());
  await expectNoViolations(page, "chat-mobile-dark");
  await page.setViewportSize({ width: 1280, height: 900 });

  assert.ok(!requests.some((request) => /code-mirror|codemirror/i.test(request)), "the chat page downloaded CodeMirror");
  pass("chat page never downloads the editor chunk");
}

async function checkWorkbench(page, url) {
  await page.goto("about:blank");
  await page.goto(`${url}#workbench`);
  const code = page.getByRole("textbox", { name: "Example code" });
  await code.waitFor({ timeout: 20_000 });
  await code.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type("// edited");
  await page.getByRole("region", { name: "Diff lines" }).getByText("// edited").waitFor();
  await page.keyboard.press("ControlOrMeta+z");
  await page.waitForFunction(() => !document.querySelector('[aria-label="Diff lines"]')?.textContent?.includes("// edited"));
  await page.keyboard.press("Escape");
  await page.keyboard.press("Tab");
  assert.equal(await code.evaluate((el) => el === document.activeElement), false, "the code editor trapped Tab");
  pass("lazy code editor edits, undoes, feeds the diff and releases focus after Escape");

  const source = page.getByRole("textbox", { name: "Release notes source" });
  await source.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("Shipped");
  await page.keyboard.press("ControlOrMeta+a");
  await page.getByRole("button", { name: "Bold" }).click();
  await page.getByRole("region", { name: "Release notes preview" }).locator("strong", { hasText: "Shipped" }).waitFor();
  pass("document editor formats markdown and updates the live preview");

  const cell = page.getByRole("gridcell", { name: "24", exact: true });
  await cell.click();
  await page.keyboard.press("Enter");
  const editor = page.getByRole("spinbutton", { name: "Edit On hand" });
  await editor.fill("30");
  await editor.press("Enter");
  await page.getByRole("gridcell", { name: "30", exact: true }).waitFor();
  pass("data table edits a numeric cell from the keyboard");

  const separator = page.getByRole("separator", { name: "Resize workspace" });
  const start = Number(await separator.getAttribute("aria-valuenow"));
  await separator.focus();
  await page.keyboard.press("ArrowLeft");
  assert.ok(Number(await separator.getAttribute("aria-valuenow")) < start, "separator did not resize");
  pass("canvas separator resizes from the keyboard");

  const artifact = page.locator('[data-slot="artifact"]');
  await page.getByRole("button", { name: "Full screen", exact: true }).click();
  const box = await artifact.boundingBox();
  assert.ok(box && box.width >= 1270 && box.height >= 890, "artifact did not fill the viewport");
  const reportModel = page.getByRole("combobox", { name: "Report model" });
  await reportModel.click();
  await page.getByRole("option", { name: "Analyst" }).click();
  assert.match(await reportModel.textContent(), /Analyst/);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Full screen", exact: true }).waitFor();
  pass("artifact goes full screen, keeps popups usable inside it and returns on Escape");

  const probe = page.frameLocator('iframe[title="Isolation probe"]');
  await probe.locator("body[data-network]").waitFor();
  assert.equal(await probe.locator("body").getAttribute("data-parent-access"), "blocked");
  assert.equal(await probe.locator("body").getAttribute("data-network"), "blocked");
  pass("sandboxed HTML cannot reach the host page or the network");

  const optedIn = page.frameLocator('iframe[title="Scripts opted in"]');
  await optedIn.getByText("Module kept </script> intact", { exact: true }).waitFor();
  const inert = page.frameLocator('iframe[title="Inert by default"]');
  assert.equal(await inert.locator("#state").textContent(), "Scripts off");
  pass("generated HTML stays inert by default and runs the script prop byte for byte only when opted in");

  const counter = page.frameLocator('iframe[title="Generated component"]');
  const button = counter.getByRole("button", { name: /Clicked 0 times/ });
  await button.click({ timeout: 30_000 });
  await counter.getByRole("button", { name: "Clicked 1 times" }).waitFor();
  pass("generated React component compiles and runs under the preview policy");

  const plan = page.getByRole("button", { name: "Rectangle: Plan" });
  await plan.focus();
  await page.keyboard.press("c");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Rectangle: Ship" }).focus();
  await page.keyboard.press("Enter");
  await page.getByText("3 shapes, 2 connectors").waitFor();
  pass("whiteboard connects shapes from the keyboard");

  await expectNoViolations(page, "workbench-light");
  await page.getByRole("button", { name: "Use dark theme" }).click();
  await expectNoViolations(page, "workbench-dark");
}

const WORD = [
  '<html xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta name=Generator content="Microsoft Word 15"></head><body><!--StartFragment-->',
  '<p class=MsoNormal><span style="font-family:Calibri;font-size:11.0pt">Before you paint:</span></p>',
  '<p class=MsoListParagraphCxSpFirst style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">·<span>&nbsp;</span></span>Stir before use</p>',
  '<p class=MsoListParagraphCxSpLast style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">·<span>&nbsp;</span></span>Keep above 50°F</p>',
  "<!--EndFragment--></body></html>",
].join("");

async function checkBuilder(page) {
  const builder = page.getByRole("region", { name: "Spring sale email", exact: true });
  await builder.scrollIntoViewIfNeeded();
  const canvas = builder.getByRole("region", { name: "Spring sale email canvas" });
  const intro = canvas.getByRole("group", { name: /^Text: Hi neighbor/ });
  await builder.getByRole("button", { name: "Add Button" }).dragTo(intro, { targetPosition: { x: 40, y: 4 } });
  const added = canvas.getByRole("group", { name: "Button: Shop now" });
  await added.waitFor();
  const order = await canvas.locator(":scope > div > [data-container-id] > [data-block-id]").evaluateAll((items) => items.map((item) => item.getAttribute("aria-label")));
  assert.equal(order[2], "Button: Shop now", `dropped at ${order.indexOf("Button: Shop now")}: ${order.join(" | ")}`);
  const panel = builder.getByRole("complementary", { name: "Block settings" });
  await panel.getByRole("textbox", { name: "Label" }).fill("Plan your garden");
  await canvas.getByRole("group", { name: "Button: Plan your garden" }).getByText("Plan your garden").waitFor();
  pass("email builder drops a palette block between blocks and edits it in the settings panel");

  await canvas.getByRole("group", { name: /^Text: Hi neighbor/ }).click();
  const text = panel.getByRole("textbox", { name: "Text block content" });
  await text.waitFor();
  await text.locator("p").last().click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Free delivery over $75.");
  await canvas.getByRole("group", { name: /^Text: Hi neighbor/ }).getByText(/Free delivery over \$75\./).waitFor();
  pass("email builder edits text blocks with the HTML editor and updates the canvas");

  const button = canvas.getByRole("group", { name: "Button: Plan your garden" });
  await button.focus();
  await page.keyboard.press("Alt+ArrowUp");
  const moved = await canvas.locator(":scope > div > [data-container-id] > [data-block-id]").evaluateAll((items) => items.map((item) => item.getAttribute("aria-label")));
  assert.equal(moved[1], "Button: Plan your garden");
  await page.keyboard.press("Delete");
  await canvas.getByRole("group", { name: "Button: Plan your garden" }).waitFor({ state: "detached" });
  await builder.getByRole("status").getByText("Deleted button. Press Ctrl+Z to undo.").waitFor();
  await canvas.getByRole("group", { name: "Image: Garden center open" }).focus();
  await page.keyboard.press("Control+z");
  await canvas.getByRole("group", { name: "Button: Plan your garden" }).waitFor();
  pass("email builder moves and deletes blocks from the keyboard and undoes");

  await builder.getByRole("radio", { name: "Mobile" }).click();
  const columns = canvas.getByRole("group", { name: "2 columns" }).locator(":scope > div.flex").first();
  assert.equal(await columns.evaluate((element) => getComputedStyle(element).flexDirection), "column");
  await builder.getByRole("radio", { name: "Preview" }).click();
  const frame = builder.locator('iframe[title="Spring sale email preview"]');
  await frame.waitFor();
  assert.equal(await frame.getAttribute("sandbox"), "");
  assert.ok((await frame.evaluate((element) => element.getBoundingClientRect().width)) < 420, "mobile preview is not narrow");
  await page.frameLocator('iframe[title="Spring sale email preview"]').getByText("Spring sale starts Friday").waitFor();
  await builder.getByRole("button", { name: "Export" }).click();
  await page.getByRole("menuitem", { name: "Copy email HTML" }).click();
  await builder.getByRole("status").getByText("Copied HTML").waitFor();
  const exported = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(exported, /class="pb-container" width="600"/);
  assert.match(exported, /Free delivery over \$75\./);
  await builder.getByRole("radio", { name: "Edit" }).click();
  await builder.getByRole("radio", { name: "Desktop" }).click();
  pass("email builder stacks columns on mobile, previews the real email in a sandboxed frame and copies it");
}

async function checkPublishing(page) {
  const section = page.locator("#gallery-publishing");
  await section.scrollIntoViewIfNeeded();
  const htmlEditor = section.locator('[data-slot="html-editor"]').filter({ has: page.locator('[aria-label="Product description"]') });
  const product = htmlEditor.getByRole("textbox", { name: "Product description" });
  await product.waitFor();
  await product.locator("p", { hasText: "One-coat hide" }).click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Tint base sold separately.");
  await page.keyboard.press("Shift+Home");
  await htmlEditor.getByRole("button", { name: /Font size/ }).click();
  await page.getByRole("menuitemcheckbox", { name: "18 px" }).click();
  await htmlEditor.getByRole("button", { name: "Text color" }).click();
  await page.getByRole("dialog", { name: "Text color" }).getByRole("button", { name: "#1d4ed8" }).click();
  await page.keyboard.press("Escape");
  await section.getByText("HTML output").click();
  const html = section.getByTestId("html-output");
  await html.getByText(/<span style="font-size: 18px;"><span style="color: rgb\(29, 78, 216\);">Tint base sold separately\.<\/span><\/span>/).waitFor();
  pass("HTML editor applies a font size and a text color to the selection");

  await product.locator("p", { hasText: "Ask the paint desk" }).click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.evaluate((markup) => {
    const data = new DataTransfer();
    data.setData("text/html", markup);
    data.setData("text/plain", "Before you paint: Stir before use. Keep above 50°F.");
    document.activeElement?.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  }, WORD);
  await product.locator("ul li", { hasText: "Keep above 50°F" }).waitFor();
  const pasted = await html.textContent();
  assert.ok(!/mso|Calibri|MsoList/i.test(pasted), "Office markup survived the paste");
  assert.match(pasted, /<ul><li><p>Stir before use<\/p><\/li><li><p>Keep above 50°F<\/p><\/li><\/ul>/);
  pass("HTML editor turns pasted Word lists into real lists and drops Office styling");

  await htmlEditor.getByRole("button", { name: "HTML source" }).click();
  const source = htmlEditor.getByRole("textbox", { name: "HTML source" });
  await source.waitFor();
  assert.equal(await htmlEditor.getByRole("button", { name: "Bold" }).getAttribute("aria-disabled"), "true");
  await source.click();
  await page.keyboard.press("Control+a");
  await page.keyboard.insertText('<h2>Paint guide</h2><p onclick="steal()">Brush the <b>edges</b> first.</p><script>alert(1)</script>');
  await htmlEditor.getByRole("button", { name: "HTML source" }).click();
  await product.locator("h2", { hasText: "Paint guide" }).waitFor();
  await html.getByText("<h2>Paint guide</h2><p>Brush the <strong>edges</strong> first.</p>", { exact: true }).waitFor();
  pass("HTML source edits come back sanitized when switching to the editor");

  await checkBuilder(page);
}

async function checkRegionCapture(page, previews, web) {
  await page.evaluate(() => {
    const media = navigator.mediaDevices;
    const original = media.getDisplayMedia.bind(media);
    const diagnostics = [];
    globalThis.__marifaiCaptureDiagnostics = diagnostics;
    media.getDisplayMedia = async (options) => {
      diagnostics.push({ stage: "request", active: navigator.userActivation.isActive, focused: document.hasFocus(), visibility: document.visibilityState });
      try {
        const stream = await original(options);
        diagnostics.push({ stage: "stream", video: stream.getVideoTracks().map((track) => {
          const { displaySurface, width, height } = track.getSettings();
          return { displaySurface, width, height, readyState: track.readyState };
        }) });
        return stream;
      } catch (error) {
        diagnostics.push({ stage: "error", name: error.name, message: error.message });
        throw error;
      }
    };
  });
  await web.getByRole("button", { name: "Capture", exact: true }).click();
  const overlay = previews.getByRole("dialog", { name: "Select an area to capture" });
  await overlay.waitFor();
  await page.keyboard.press("Escape");
  await overlay.waitFor({ state: "detached" });
  await web.getByRole("button", { name: "Capture", exact: true }).click();
  const area = await overlay.boundingBox();
  assert.ok(area);
  await page.mouse.move(area.x + 40, area.y + 120);
  await page.mouse.down();
  await page.mouse.move(area.x + 240, area.y + 260, { steps: 4 });
  await overlay.getByText("200 × 140").waitFor();
  await page.mouse.up();
  const captured = previews.getByRole("img", { name: "Captured area of the preview" });
  try {
    await captured.waitFor({ timeout: 15_000 });
    await captured.evaluate((image) => image.decode());
  } catch (error) {
    const diagnostics = await page.evaluate(() => globalThis.__marifaiCaptureDiagnostics);
    const status = await previews.locator('[data-slot="region-capture"] [role="status"]').allTextContents();
    await page.screenshot({ path: resolve(output, "region-capture-failure.png") });
    throw new Error(`Region capture did not finish: ${JSON.stringify({ diagnostics, status })}`, { cause: error });
  }
  const shot = await captured.evaluate((image) => ({ width: image.naturalWidth, height: image.naturalHeight }));
  assert.ok(shot.width > 0 && shot.height > 0, `captured ${shot.width}×${shot.height}`);
  // The capture stream may downscale CSS pixels; preserve the selected aspect ratio within rounding error.
  assert.ok(Math.abs(shot.width * 140 - shot.height * 200) <= 340, `captured ${shot.width}×${shot.height} for a 200×140 selection`);
  pass("region capture draws a selection, cancels with Escape and screenshots the dragged area of the tab");

}

async function checkGallery(page, url) {
  await page.goto("about:blank");
  await page.goto(`${url}#gallery`);
  await page.getByRole("heading", { name: "Feedback and status" }).waitFor();
  await checkGeneral(page, pass);

  await page.getByRole("button", { name: "Delete with undo" }).click();
  await page.locator('[data-slot="toaster"]').getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Delete with undo" }).click();
  const toast = page.locator("[data-tone]").filter({ hasText: "Chat deleted" });
  await toast.getByRole("button", { name: "Dismiss notification" }).click();
  await page.getByText("1 deleted").waitFor();
  pass("undo toast commits only when it closes without Undo");

  await page.getByRole("button", { name: "Error toast" }).click();
  const errorToast = page.getByRole("alert").filter({ hasText: "Generation failed" });
  await errorToast.waitFor();
  const toastReport = await new AxeBuilder({ page }).include('[data-slot="toaster"]').withTags(WCAG).analyze();
  assert.deepEqual(toastReport.violations.map((violation) => violation.id), [], "open toast accessibility violations");
  await page.keyboard.press("F6");
  assert.equal(await errorToast.evaluate((el) => el === document.activeElement), true, "F6 did not focus the toast");
  await page.keyboard.press("Escape");
  await errorToast.waitFor({ state: "detached" });
  pass("open toasts pass axe, F6 focuses them and Escape dismisses");

  await page.getByRole("button", { name: "Delete project" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Delete this project?" });
  await dialog.waitFor();
  assert.equal(await dialog.getByRole("button", { name: "Cancel" }).evaluate((el) => el === document.activeElement), true, "confirm dialog did not focus Cancel");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  pass("confirm dialog starts on Cancel and closes on Escape");

  await page.getByRole("button", { name: "Stream 60 chunks" }).click();
  const renders = Number((await page.getByLabel("Renders").textContent()).split(" ")[0]);
  assert.ok(renders >= 1 && renders <= 2, `stream buffer rendered ${renders} times`);
  pass("stream buffer applies a burst of chunks in one render");

  await page.getByRole("button", { name: "Pause to edit" }).click();
  await page.getByRole("textbox", { name: "New step" }).fill("Deploy to staging");
  await page.locator("#gallery-agent").getByRole("button", { name: "Add", exact: true }).click();
  assert.equal(await page.getByRole("textbox", { name: "Step 5" }).inputValue(), "Deploy to staging");
  await page.locator("#gallery-agent").getByRole("button", { name: "Resume" }).click();
  pass("plan card edits remaining steps only while paused");

  await page.getByRole("button", { name: /Read 3 files/ }).click();
  await page.getByRole("button", { name: /Failed to run npm test -- counter/ }).click();
  await page.getByText("1 failing: resets to zero").waitFor();
  await page.getByRole("button", { name: "EUR" }).click();
  await page.getByText("Answered: EUR").waitFor();
  pass("tool trace groups and expands calls, task questions take answers");

  const queue = page.getByRole("region", { name: "Approvals", exact: true });
  await queue.getByText("Request 1 of 2").waitFor();
  await queue.getByRole("button", { name: "Approve" }).click();
  await queue.getByText("Request 1 of 1").waitFor();
  await queue.getByRole("tab", { name: /History/ }).click();
  await queue.getByText("Send the weekly summary email").waitFor();
  pass("approval queue takes one decision at a time and records history");

  const questions = page.getByRole("region", { name: "A few questions before I start" });
  await questions.getByRole("radio", { name: /Store managers/ }).check();
  await questions.getByRole("button", { name: "Next" }).click();
  await questions.getByRole("checkbox", { name: "Inventory" }).check();
  await questions.getByRole("button", { name: "Next" }).click();
  await questions.getByRole("button", { name: "Skip" }).click();
  await page.getByText(/Answers sent:/).waitFor();
  pass("clarifying questions submit answers and skips");

  await page.getByRole("button", { name: "Apply 3 shifts" }).click();
  await page.getByText("Applied 3 shifts.").waitFor();
  pass("batch review applies only included items");

  const sheet = page.locator('[data-slot="spreadsheet"]');
  const grid = sheet.getByRole("grid");
  const cellAt = (row, column) => grid.locator(`[data-row="${row}"][data-column="${column}"]`);
  await cellAt(1, 3).click();
  assert.equal(await sheet.getByRole("textbox", { name: "Contents of D2" }).inputValue(), "=B2*C2");
  await cellAt(9, 1).click();
  await page.keyboard.type("=SUM(B2:B6)");
  await page.keyboard.press("Enter");
  assert.equal(await cellAt(9, 1).textContent(), "307");
  pass("spreadsheet edits cells and evaluates formulas in the browser");

  await cellAt(1, 5).click();
  await page.keyboard.type("Week 1");
  await page.keyboard.press("Enter");
  await cellAt(1, 5).click();
  const handle = grid.locator("[data-fill-handle]");
  const from = await handle.boundingBox();
  const to = await cellAt(4, 5).boundingBox();
  await page.mouse.move(from.x + 3, from.y + 3);
  await page.mouse.down();
  await page.mouse.move(to.x + 20, to.y + 10, { steps: 6 });
  await page.mouse.up();
  assert.equal(await cellAt(4, 5).textContent(), "Week 4");
  pass("spreadsheet fill handle continues a series");

  const separator = grid.getByRole("separator", { name: "Resize column B" });
  const before = Number(await separator.getAttribute("aria-valuenow"));
  const box = await separator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 60, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  const after = Number(await separator.getAttribute("aria-valuenow"));
  assert.ok(after >= before + 50, `column B resized from ${before} to ${after}`);
  pass("spreadsheet columns resize by dragging the header edge");

  await cellAt(2, 0).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Insert row above" }).click();
  assert.equal(await cellAt(2, 0).textContent(), "");
  assert.equal(await cellAt(3, 0).textContent(), "Exterior paint, gallon");
  assert.equal(await cellAt(8, 3).textContent(), "$2,619.61");
  await grid.focus();
  await page.keyboard.press("Control+z");
  assert.equal(await cellAt(2, 0).textContent(), "Exterior paint, gallon");
  await sheet.getByRole("tab", { name: "Summary" }).click();
  assert.equal(await cellAt(2, 1).textContent(), "Pressure-treated 2x4 8ft");
  pass("spreadsheet context menu inserts rows, undo restores, and other sheets read the data");

  const doc = page.getByRole("textbox", { name: "Spring reset plan" });
  await doc.waitFor();
  const quote = doc.locator("blockquote p");
  const quoteBox = await quote.boundingBox();
  await quote.click({ position: { x: quoteBox.width - 2, y: quoteBox.height / 2 } });
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("## ");
  await page.keyboard.type("Staffing");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Schedule **two** cashiers");
  assert.equal(await doc.locator("h2").last().textContent(), "Staffing");
  assert.equal(await doc.locator("strong").last().textContent(), "two");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/to");
  const slashMenu = page.getByRole("listbox", { name: "Insert block" });
  await slashMenu.getByRole("option", { name: /To-do list/ }).waitFor();
  await page.keyboard.press("Enter");
  await page.keyboard.type("Post the new hours");
  await page.getByText("Markdown output").click();
  const output = page.locator("#gallery-office details pre");
  await output.getByText("- [ ] Post the new hours").waitFor();
  assert.ok((await output.textContent()).includes("## Staffing\n\nSchedule **two** cashiers"));
  pass("document editor turns markdown shortcuts and slash commands into blocks");

  await doc.locator("h1").click();
  await page.keyboard.press("Control+f");
  await page.getByRole("searchbox", { name: "Find", exact: true }).fill("shelf");
  await page.getByText("1 of 1").waitFor();
  await page.keyboard.press("Escape");
  await doc.locator("p", { hasText: "The garden center reopens" }).dblclick();
  await page.locator("#gallery-office").getByRole("button", { name: "Add comment" }).click();
  await page.getByRole("textbox", { name: "Comment" }).fill("Confirm the date with the owner");
  await page.getByRole("button", { name: "Comment", exact: true }).click();
  await page.getByRole("complementary", { name: "Comments" }).getByText("Confirm the date with the owner").waitFor();
  pass("document editor finds text and anchors comments to a selection");

  const designer = page.locator('[data-slot="design-editor"]');
  const surface = designer.getByRole("application");
  await designer.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await designer.getByRole("toolbar", { name: "Design tools" }).getByRole("button", { name: "Ellipse" }).click();
  const art = designer.getByRole("img", { name: /^Page 1/ });
  const artBox = await art.boundingBox();
  const scale = artBox.width / 1080;
  const at = (x, y) => ({ x: artBox.x + x * scale, y: artBox.y + y * scale });
  const start = at(120, 860);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 100 * scale, start.y + 60 * scale, { steps: 4 });
  await page.mouse.up();
  const layersPanel = designer.getByRole("region", { name: "Layers" });
  await layersPanel.getByRole("button", { name: "Ellipse", exact: true }).waitFor();
  assert.equal(await layersPanel.getByRole("button", { name: "Ellipse", exact: true }).getAttribute("aria-pressed"), "true");
  pass("design canvas draws a shape by dragging and selects it");

  const props = designer.getByRole("complementary", { name: "Properties" });
  const xField = props.getByRole("spinbutton", { name: "X", exact: true });
  const beforeX = Number(await xField.inputValue());
  const shapeCenter = at(beforeX + 50, 890);
  await page.mouse.move(shapeCenter.x, shapeCenter.y);
  await page.mouse.down();
  const target = at(540, 890);
  await page.mouse.move(target.x + 2 * scale, target.y, { steps: 8 });
  const guide = designer.locator("[data-overlay] line[stroke='#e11d74']");
  assert.ok((await guide.count()) > 0, "no smart guide while dragging near the page center");
  await page.mouse.up();
  assert.equal(Number(await xField.inputValue()), 490);
  pass("design canvas snaps a dragged shape to the page center with a guide");

  const resizeHandle = designer.locator('[data-handle="se"]');
  const handleBox = await resizeHandle.boundingBox();
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + 60 * scale, handleBox.y + 40 * scale, { steps: 4 });
  await page.mouse.up();
  const widthField = props.getByRole("spinbutton", { name: "Width", exact: true });
  assert.ok(Number(await widthField.inputValue()) > 140, `width after resize ${await widthField.inputValue()}`);
  await surface.focus();
  await page.keyboard.press("Control+z");
  assert.equal(Number(await widthField.inputValue()), 100);
  pass("design canvas resizes from a handle and undoes it");

  const downloadPromise = page.waitForEvent("download");
  await designer.getByRole("button", { name: "Export" }).click();
  await page.getByRole("menuitem", { name: "PNG", exact: true }).click();
  const pngDownload = await downloadPromise;
  assert.equal(pngDownload.suggestedFilename(), "spring-sale-1.png");
  const bytes = await readFile(await pngDownload.path());
  assert.deepEqual([...bytes.subarray(1, 4)], [0x50, 0x4e, 0x47]);
  pass("design canvas exports the page as a PNG file");

  const viewer = page.locator('[data-slot="artifact-viewer"][aria-label="Sale landing page"]');
  await viewer.evaluate((element) => element.scrollIntoView({ block: "center" }));
  const viewerAlert = viewer.getByRole("alert");
  await viewerAlert.getByText(/storeHours is not defined/).waitFor();
  await viewerAlert.getByRole("button", { name: "Fix it" }).click();
  await page.getByText(/Sent to the assistant:/).waitFor();
  await viewer.getByRole("button", { name: "Next version" }).click();
  await viewer.getByText("Latest").waitFor();
  const pageFrame = page.frameLocator('[data-slot="artifact-viewer"][aria-label="Sale landing page"] iframe');
  // The button is parsed before the inline script that attaches its click handler, so a click can land in
  // between on a slow runner. The same script fills in the store hours, so wait for those first.
  await pageFrame.getByText(/Sun 10 AM/).waitFor();
  await pageFrame.getByRole("button", { name: "Remind me" }).click();
  await pageFrame.getByText("We'll remind you").waitFor();
  assert.equal(await viewer.getByRole("alert").count(), 0);
  assert.equal(await page.evaluate(() => { try { return window.frames[0]?.document === undefined; } catch { return true; } }), true);
  pass("artifact viewer runs the page in a sandbox, reports errors with Fix it and switches versions");

  await page.getByRole("button", { name: "Garden center with seedlings on tables" }).click();
  const lightbox = page.getByRole("dialog");
  await lightbox.getByText("2 / 4").waitFor();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await lightbox.getByText("4 / 4").waitFor();
  await page.keyboard.press("Escape");
  await lightbox.waitFor({ state: "detached" });
  pass("lightbox wraps with arrow keys and closes with Escape");

  const deck = page.getByRole("region", { name: "Q2 store review" });
  await deck.getByRole("button", { name: "Next slide" }).click();
  await deck.getByText("Slide 2 of 4").waitFor();
  await deck.getByRole("button", { name: "Notes" }).click();
  await deck.getByRole("region", { name: "Speaker notes" }).getByText(/supplier delay/).waitFor();
  pass("slide deck moves between slides and shows speaker notes");

  await page.getByRole("button", { name: "Use as avatar" }).click();
  await page.getByRole("img", { name: "Cropped avatar" }).waitFor();
  const player = page.getByRole("group", { name: "Audio: Store radio spot" });
  await player.getByRole("button", { name: "Play", exact: true }).click();
  await player.getByRole("button", { name: "Pause", exact: true }).waitFor();
  await player.getByRole("button", { name: "Pause", exact: true }).click();
  pass("image cropper produces a cropped image and the audio player plays and pauses");

  const calendar = page.locator('[data-slot="event-calendar"]');
  await calendar.evaluate((element) => element.scrollIntoView({ block: "center" }));
  const vendorCall = calendar.getByRole("button", { name: /^Vendor call, 2:00\sPM to 3:00\sPM/ });
  const callBox = await vendorCall.boundingBox();
  await page.mouse.move(callBox.x + callBox.width / 2, callBox.y + 8);
  await page.mouse.down();
  await page.mouse.move(callBox.x + callBox.width / 2, callBox.y + 8 + 48, { steps: 6 });
  await page.mouse.up();
  const movedCall = calendar.getByRole("button", { name: /^Vendor call, 3:00\sPM to 4:00\sPM/ });
  await movedCall.waitFor();
  await movedCall.focus();
  for (let step = 0; step < 2; step += 1) await page.keyboard.press("Alt+ArrowUp");
  await calendar.getByRole("button", { name: /^Vendor call, 2:00\sPM to 3:00\sPM/ }).waitFor();
  await calendar.getByRole("button", { name: /^Stand-up, .*repeats$/ }).first().focus();
  await page.keyboard.press("Alt+ArrowDown");
  await calendar.getByRole("status").getByText("Stand-up cannot be moved").waitFor();
  pass("calendar moves an event by dragging and with Alt+arrows, and refuses to move a recurring one");

  await calendar.locator("[data-day-column]").first().click({ position: { x: 20, y: 10 * 48 + 10 } });
  await calendar.getByRole("button", { name: /^New event, 10:00\sAM to 11:00\sAM/ }).waitFor();
  pass("calendar creates an event from a click on an empty slot");

  for (const view of ["Month", "Agenda", "Week"]) {
    await calendar.getByRole("button", { name: view, exact: true }).click();
    const report = await new AxeBuilder({ page }).include('[data-slot="event-calendar"]').withTags(WCAG).analyze();
    assert.deepEqual(report.violations.map((violation) => violation.id), [], `calendar ${view.toLowerCase()} view accessibility violations`);
  }
  pass("calendar month, agenda and week views pass axe");

  const delivery = page.getByRole("button", { name: /^Delivery date/ });
  await delivery.click();
  await page.waitForFunction(() => document.activeElement?.closest("[role=grid]"));
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  const expectedDelivery = await page.evaluate(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 4);
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
  });
  await page.waitForFunction((text) => document.activeElement?.textContent?.includes(text), expectedDelivery);
  pass("date picker selects a day from the keyboard and returns focus to the trigger");

  const period = page.getByRole("button", { name: /^Report period/ });
  await period.click();
  await page.getByRole("button", { name: "Last 30 days" }).click();
  await page.waitForFunction(() => document.activeElement?.textContent?.startsWith("Last 30 days"));
  await period.click();
  await page.getByText("Select the start date").waitFor();
  await page.keyboard.press("Enter");
  await page.getByText("Select the end date").waitFor();
  const pickerReport = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(WCAG).analyze();
  assert.deepEqual(pickerReport.violations.map((violation) => violation.id), [], "open date range picker accessibility violations");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.getByText("Select the end date").waitFor({ state: "detached" });
  assert.ok(!(await period.textContent()).includes("Last"), "custom range still shows a preset label");
  pass("date range picker applies presets, passes axe while open and picks a custom range from the keyboard");

  const board = page.getByRole("region", { name: "Store tasks" });
  await board.evaluate((element) => element.scrollIntoView({ block: "center" }));
  const signage = board.getByRole("button", { name: /^Update aisle signage/ });
  const done = board.getByRole("group", { name: "Done" });
  const signageBox = await signage.boundingBox();
  const doneBox = await done.boundingBox();
  await page.mouse.move(signageBox.x + 30, signageBox.y + 12);
  await page.mouse.down();
  await page.mouse.move(doneBox.x + doneBox.width / 2, doneBox.y + doneBox.height - 40, { steps: 10 });
  await page.mouse.up();
  await done.getByRole("button", { name: /^Update aisle signage/ }).waitFor();
  const rollers = board.locator('[data-kanban-card="c1"] [role="button"]');
  await rollers.focus();
  await page.keyboard.press("Alt+ArrowRight");
  await board.getByRole("status").getByText("Reorder paint rollers moved to In progress, position 1 of 3").waitFor();
  await board.getByRole("group", { name: "In progress" }).getByText("(over the limit)").waitFor();
  await page.waitForFunction(() => document.activeElement?.closest('[data-kanban-card="c1"]'));
  pass("kanban board moves cards by dragging and with Alt+arrows, keeps focus and flags the WIP limit");

  const forms = page.locator("#gallery-forms");
  await forms.evaluate((element) => element.scrollIntoView({ block: "start" }));
  const labels = forms.getByRole("combobox", { name: "Labels" });
  await labels.click();
  await page.keyboard.type("paint");
  await page.keyboard.press("Enter");
  await forms.getByRole("button", { name: "Remove paint" }).waitFor();
  await page.keyboard.type("plu");
  await page.getByRole("option", { name: "plumbing" }).waitFor();
  const listboxReport = await new AxeBuilder({ page }).include('[role="listbox"]').withTags(WCAG).analyze();
  assert.deepEqual(listboxReport.violations.map((violation) => violation.id), [], "tag suggestions accessibility violations");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await forms.getByRole("button", { name: "Remove plumbing" }).waitFor();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Backspace");
  await forms.getByRole("button", { name: "Remove plumbing" }).waitFor({ state: "detached" });
  pass("tag input adds typed and suggested tags and Backspace removes the last one");

  await forms.getByLabel("Verification code").first().click();
  await page.keyboard.type("123456");
  await forms.getByText("Code 123456 entered").waitFor();
  const price = forms.getByRole("textbox", { name: "Unit price" });
  await price.click();
  await page.keyboard.type("12.5");
  await page.keyboard.press("Tab");
  assert.equal(await price.inputValue(), "$12.50");
  await forms.getByText("Stored as 1250 cents").waitFor();
  await forms.getByRole("button", { name: "Generate password" }).click();
  assert.equal(await forms.getByRole("meter", { name: "Password strength" }).getAttribute("aria-valuenow"), "5");
  assert.equal(await forms.getByRole("button", { name: "Show password" }).getAttribute("aria-pressed"), "true");
  pass("OTP fills from typing, currency stores minor units and the password generator scores strong");

  await forms.getByRole("button", { name: /^Brand color/ }).click();
  const colorReport = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(WCAG).analyze();
  assert.deepEqual(colorReport.violations.map((violation) => violation.id), [], "open color picker accessibility violations");
  await page.getByRole("textbox", { name: "Hex color" }).fill("#16a34a");
  await page.keyboard.press("Escape");
  await forms.getByRole("button", { name: /^Brand color #16a34a/ }).waitFor();
  await forms.getByRole("button", { name: /^Brand color/ }).click();
  await page.getByRole("group", { name: "Recent colors" }).getByRole("button", { name: "#16a34a" }).waitFor();
  await page.getByRole("slider", { name: "Saturation and brightness" }).focus();
  await page.keyboard.press("ArrowDown");
  await forms.getByRole("button", { name: /^Brand color #16a049/ }).waitFor();
  await page.keyboard.press("Escape");
  pass("color picker takes hex entry and arrow keys and remembers recent colors");

  await page.locator("body").click({ position: { x: 2, y: 2 } });
  await page.keyboard.press("/");
  await page.keyboard.type("ham");
  const products = forms.getByRole("list", { name: "Products" });
  await page.waitForFunction(() => document.querySelectorAll('[aria-label="Products"] li').length === 2);
  await forms.getByRole("button", { name: /^Low/ }).click();
  assert.deepEqual(await products.getByRole("listitem").allTextContents(), ["Hammer drill"]);
  pass("search focuses from the / shortcut and filter chips narrow the results");

  const storeName = forms.getByRole("textbox", { name: "Store name", exact: true }).last();
  await storeName.fill("Whitten Hardware");
  await page.waitForTimeout(500);
  // The reload below resets every demo, so scan the interacted states first.
  await expectNoViolations(page, "gallery-interacted");
  await page.reload();
  await page.locator("#gallery-forms").evaluate((element) => element.scrollIntoView({ block: "start" }));
  await forms.getByText("You have an unsent draft").waitFor();
  await forms.getByRole("button", { name: "Restore" }).click();
  assert.equal(await storeName.inputValue(), "Whitten Hardware");
  await forms.getByRole("button", { name: "Next" }).click();
  await forms.getByRole("alert").getByText("Enter a phone number.").waitFor();
  await forms.getByRole("textbox", { name: "Phone" }).fill("(901) 555-0142");
  await forms.getByRole("button", { name: "Next" }).click();
  await page.waitForFunction(() => document.activeElement?.textContent === "Opening hour");
  await forms.getByRole("textbox", { name: /Opens at/ }).fill("9");
  await forms.getByRole("button", { name: "Next" }).click();
  await forms.getByRole("button", { name: "Create store" }).click();
  await forms.getByText("Whitten Hardware opens at 9:00.").waitFor();
  assert.equal(await page.evaluate(() => window.localStorage.getItem("ai-ui-gallery:store-draft")), null);
  pass("form draft survives a reload, the wizard validates each step and submit clears the draft");

  const pad = forms.getByRole("img", { name: /Signature drawing area/ });
  await pad.scrollIntoViewIfNeeded();
  const padBox = await pad.boundingBox();
  await page.mouse.move(padBox.x + 60, padBox.y + 80);
  await page.mouse.down();
  await page.mouse.move(padBox.x + 200, padBox.y + 40, { steps: 8 });
  await page.mouse.move(padBox.x + 300, padBox.y + 100, { steps: 8 });
  await page.mouse.up();
  await forms.getByRole("img", { name: "Signature preview" }).waitFor();
  assert.equal(await pad.getAttribute("aria-label"), "Signature drawing area, 1 stroke");
  pass("signature pad draws a stroke and exports SVG");

  await forms.getByRole("button", { name: "Import 5 rows" }).click();
  await forms.getByText("Imported 5 rows.").waitFor();
  await forms.getByRole("button", { name: "Add sample files" }).click();
  const uploadList = forms.getByRole("region", { name: "Uploads" });
  await uploadList.getByRole("alert").getByText(/empty\.txt/).waitFor();
  await uploadList.getByText("The server rejected this file.").waitFor();
  await uploadList.getByRole("button", { name: "Retry fail-invoice.pdf" }).waitFor();
  await uploadList.getByRole("status").filter({ hasText: "1 need attention · 2 done" }).waitFor({ timeout: 10_000 });
  pass("column mapper imports mapped rows and the upload queue reports progress, rejections and failures");

  const shellSection = page.locator("#gallery-shell");
  const shell = shellSection.locator('[data-slot="app-shell"]');
  await shell.evaluate((element) => element.scrollIntoView({ block: "start" }));
  const mainNav = shell.getByRole("navigation", { name: "Main" });
  await mainNav.getByRole("link", { name: "Cash" }).click();
  await shell.getByRole("heading", { name: "Cash", level: 3 }).waitFor();
  await shell.getByRole("button", { name: "Collapse sidebar" }).click();
  await mainNav.getByRole("link", { name: "Schedule" }).hover();
  await page.locator('[data-side="right"][data-open]').filter({ hasText: /^Schedule$/ }).last().waitFor();
  await shell.getByRole("button", { name: "Expand sidebar" }).click();
  await page.locator("body").click({ position: { x: 2, y: 2 } });
  await page.keyboard.press("g");
  await page.keyboard.press("o");
  await shell.getByRole("heading", { name: "Orders", level: 3 }).waitFor();
  await shell.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Inventory" }).click();
  await shell.getByRole("heading", { name: "Inventory", level: 3 }).waitFor();
  await page.keyboard.press("Shift+?");
  const help = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await help.getByRole("heading", { name: "Navigation" }).waitFor();
  const helpReport = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(WCAG).analyze();
  assert.deepEqual(helpReport.violations.map((violation) => violation.id), [], "shortcut help accessibility violations");
  await page.keyboard.press("Escape");
  await help.waitFor({ state: "detached" });
  pass("app shell navigates, collapses to a rail with tooltips, and shortcut sequences and help work");

  await page.setViewportSize({ width: 390, height: 844 });
  await shell.evaluate((element) => element.scrollIntoView({ block: "start" }));
  const tabs = shell.getByRole("navigation", { name: "Main, tabs" });
  await tabs.getByRole("link", { name: "Home" }).click();
  await shell.getByRole("heading", { name: "Home", level: 3 }).waitFor();
  await shell.getByRole("button", { name: "Open navigation" }).click();
  const drawer = page.getByRole("dialog", { name: "Whitten Hardware" });
  await drawer.getByRole("link", { name: "People" }).click();
  await drawer.waitFor({ state: "detached" });
  await shell.getByRole("heading", { name: "People", level: 3 }).waitFor();
  const phoneReport = await new AxeBuilder({ page }).include('[data-slot="app-shell"]').withTags(WCAG).analyze();
  assert.deepEqual(phoneReport.violations.map((violation) => violation.id), [], "phone app shell accessibility violations");
  await page.setViewportSize({ width: 1280, height: 900 });
  pass("on phones the app shell shows bottom tabs and a navigation drawer");

  await shellSection.getByRole("button", { name: "Start tour" }).click();
  await page.waitForFunction(() => document.activeElement?.textContent === "Next");
  await page.getByRole("dialog", { name: "Your store" }).waitFor();
  await page.keyboard.press("Enter");
  await page.getByRole("dialog", { name: "Today at a glance" }).waitFor();
  const tourReport = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(WCAG).analyze();
  assert.deepEqual(tourReport.violations.map((violation) => violation.id), [], "tour accessibility violations");
  await page.getByRole("dialog", { name: "Today at a glance" }).getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("dialog", { name: "Light or dark" }).getByRole("button", { name: "Done" }).click();
  await page.getByRole("dialog", { name: "Light or dark" }).waitFor({ state: "detached" });
  pass("tour steps through anchored popovers with focus on Next");

  await shellSection.getByRole("button", { name: "Page 3", exact: true }).click();
  assert.equal(await shellSection.getByRole("list", { name: "Orders" }).getByRole("listitem").first().textContent(), "Order #10020");
  const filesSeparator = shellSection.getByRole("separator", { name: "Resize files" });
  await filesSeparator.focus();
  await page.keyboard.press("Shift+ArrowRight");
  assert.equal(await filesSeparator.getAttribute("aria-valuenow"), "35");
  pass("pagination pages through items and panel separators resize from the keyboard");

  await shellSection.getByRole("button", { name: "Simulate install offer" }).click();
  await shellSection.getByRole("region", { name: "Install Whitten Hardware" }).getByRole("button", { name: "Install" }).waitFor();
  await shellSection.getByRole("button", { name: "Simulate update" }).click();
  await shellSection.getByLabel("Unsaved changes").check();
  assert.equal(await shellSection.getByRole("button", { name: "Refresh" }).isDisabled(), true);
  await shellSection.getByLabel("Unsaved changes").uncheck();
  await shellSection.getByRole("button", { name: "Refresh" }).click();
  await shellSection.getByRole("button", { name: "Refresh" }).waitFor({ state: "detached" });
  await shellSection.getByRole("button", { name: "Simulate session ending" }).click();
  const timeout = page.getByRole("alertdialog", { name: "Are you still there?" });
  await timeout.waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), "Stay signed in");
  const timeoutReport = await new AxeBuilder({ page }).include('[role="alertdialog"]').withTags(WCAG).analyze();
  assert.deepEqual(timeoutReport.violations.map((violation) => violation.id), [], "session timeout accessibility violations");
  await timeout.getByRole("button", { name: "Stay signed in" }).click();
  await shellSection.getByText("Session extended.").waitFor();
  pass("install offer, blocked update and session timeout warning behave");

  const outboxPanel = shellSection.getByRole("region", { name: "Changes waiting to sync" });
  await shellSection.getByRole("button", { name: "Queue a price change" }).click();
  await outboxPanel.waitFor();
  await outboxPanel.waitFor({ state: "detached" });
  await shellSection.getByLabel("Server rejects changes").check();
  await shellSection.getByRole("button", { name: "Queue a price change" }).click();
  await outboxPanel.getByText("1 change needs attention").waitFor({ timeout: 10_000 });
  await shellSection.getByLabel("Server rejects changes").uncheck();
  await outboxPanel.getByRole("button", { name: /^Retry Set/ }).click();
  await outboxPanel.waitFor({ state: "detached" });
  pass("offline queue sends, parks after repeated failures and retries on request");

  await shellSection.getByRole("checkbox", { name: /^All Cash permissions for Stocker/ }).check();
  await shellSection.getByText("3 unsaved changes").waitFor();
  await shellSection.getByRole("button", { name: "Save", exact: true }).click();
  await shellSection.getByText("No unsaved changes").waitFor();
  await shellSection.getByLabel(/Listen for a handheld scanner/).check();
  await page.locator("body").click({ position: { x: 2, y: 2 } });
  await page.keyboard.type("041234567890");
  await page.keyboard.press("Enter");
  await shellSection.getByRole("list", { name: "Scanned items" }).getByText("041234567890").waitFor();
  await shellSection.getByLabel(/Listen for a handheld scanner/).uncheck();
  await shellSection.getByLabel("$100").fill("3");
  await shellSection.getByLabel("$20").fill("2");
  await shellSection.getByLabel("Quarters ($10 roll)").fill("1");
  await shellSection.getByText("Drawer balances.").waitFor();
  await shellSection.getByRole("button", { name: "Submit count" }).click();
  await shellSection.getByText("Submitted $350.00, balanced.").waitFor();
  pass("permission matrix grants by category, a keyboard-wedge scan registers and the cash count balances");

  const composer = page.locator("#gallery-composer");
  await composer.evaluate((element) => element.scrollIntoView({ block: "start" }));
  const composerBox = composer.getByRole("textbox", { name: "Message" });
  await composerBox.click();
  await page.keyboard.type("Check @order");
  const mentions = page.getByRole("listbox", { name: "Mentions" });
  await mentions.getByRole("option", { name: "src/routes/orders.tsx" }).waitFor();
  const mentionReport = await new AxeBuilder({ page }).include('[role="listbox"]').withTags(WCAG).analyze();
  assert.deepEqual(mentionReport.violations.map((violation) => violation.id), [], "mention list accessibility violations");
  await page.keyboard.press("Enter");
  assert.equal(await composerBox.inputValue(), "Check @src/routes/orders.tsx ");
  await composer.getByRole("button", { name: "Remove orders.tsx" }).waitFor();
  await page.keyboard.type("/sum");
  await page.getByRole("listbox", { name: "Commands" }).getByRole("option", { name: /summarize/ }).waitFor();
  await page.keyboard.press("Tab");
  assert.equal(await composerBox.inputValue(), "Check @src/routes/orders.tsx /summarize ");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Message");
  await page.waitForFunction(() => window.localStorage.getItem("ai-ui-gallery:composer")?.endsWith("/summarize "));
  pass("composer mentions and commands insert at the caret, keep focus, add context and save the draft");

  await composer.getByRole("button", { name: "Improve prompt" }).click();
  await composer.getByRole("button", { name: "Undo prompt improvement" }).click();
  assert.equal(await composerBox.inputValue(), "Check @src/routes/orders.tsx /summarize ");
  await composer.getByRole("button", { name: "Add a link" }).click();
  await page.getByRole("textbox", { name: "Add a link" }).fill("docs.example.com/guide");
  await page.keyboard.press("Enter");
  await composer.getByRole("button", { name: "Remove docs.example.com" }).waitFor();
  await composer.getByRole("button", { name: /^Options:/ }).click();
  await page.getByRole("checkbox", { name: /Email drafts/ }).check();
  await page.keyboard.press("Escape");
  await composer.getByRole("button", { name: "Options: Medium · 3 tools" }).waitFor();
  pass("prompt improvement undoes, links become context and composer options apply");

  await composer.getByRole("region", { name: "Prompt templates" }).getByRole("button", { name: /^Reorder email/ }).click();
  const templateDialog = page.getByRole("dialog", { name: "Reorder email" });
  await templateDialog.getByLabel("Supplier").fill("Orgill");
  await templateDialog.getByLabel("Items").fill("paint rollers");
  await templateDialog.getByLabel("Date").fill("Friday");
  await templateDialog.getByRole("button", { name: "Use prompt" }).click();
  assert.equal(await composerBox.inputValue(), "Write a short, polite email to Orgill asking to restock paint rollers by Friday.");
  await composerBox.focus();
  await page.keyboard.press("Enter");
  const sentList = composer.getByRole("list", { name: "Sent messages" });
  await sentList.getByText("Write a short, polite email to Orgill").waitFor();
  assert.equal(await sentList.getByRole("list", { name: "Context sent with this message" }).getByRole("button").count(), 0);
  assert.equal(await composerBox.inputValue(), "");
  await page.waitForFunction(() => window.localStorage.getItem("ai-ui-gallery:composer") === null);
  await composer.getByRole("button", { name: "Draft the weekly staff schedule" }).click();
  assert.equal(await composerBox.inputValue(), "Draft the weekly staff schedule");
  pass("templates fill variables into the composer, sending freezes context and clears the draft");

  await composer.locator('[data-slot="file-dropzone"] input[type="file"]').first().setInputFiles([
    { name: "index.ts", mimeType: "text/plain", buffer: Buffer.from("export const a = 1;") },
    { name: "logo.png", mimeType: "image/png", buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0]) },
  ]);
  await composer.getByText("Imported 1 file, skipped 1.").waitFor();
  pass("file import skips binary files with a reason");

  const conversation = page.locator("#gallery-conversation");
  await conversation.evaluate((element) => element.scrollIntoView({ block: "start" }));
  const history = conversation.getByRole("navigation", { name: "Chat history" });
  await history.getByRole("button", { name: /^Spring mulch promotion/ }).focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("F2");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("Saturday paint coverage");
  await page.keyboard.press("Enter");
  await history.getByRole("button", { name: /^Unread: Saturday paint coverage/ }).waitFor();
  await history.getByRole("button", { name: /^Orgill backorder report/ }).focus();
  await page.keyboard.press("Delete");
  const deleteDialog = page.getByRole("alertdialog", { name: 'Delete "Orgill backorder report"?' });
  await deleteDialog.getByRole("button", { name: "Delete" }).click();
  await deleteDialog.waitFor({ state: "detached" });
  assert.equal(await history.getByRole("button", { name: /^Orgill backorder report/ }).count(), 0);
  pass("chat history renames with F2 and deletes with confirmation from the keyboard");

  await conversation.getByRole("button", { name: "Insert emoji" }).click();
  const emojiDialog = page.getByRole("dialog", { name: "Emoji" });
  await emojiDialog.getByRole("searchbox", { name: "Search emoji" }).waitFor();
  const emojiReport = await new AxeBuilder({ page }).include('[data-slot="emoji-picker"]').withTags(WCAG).analyze();
  assert.deepEqual(emojiReport.violations.map((violation) => violation.id), [], "emoji picker accessibility violations");
  await page.keyboard.type("rocket");
  await page.keyboard.press("Enter");
  await emojiDialog.waitFor({ state: "detached" });
  assert.equal(await conversation.getByRole("textbox", { name: "Message" }).inputValue(), "Great work on the end-cap 🚀");
  pass("emoji picker passes axe and picks the first search match with Enter");

  const thread = conversation.getByRole("region", { name: "Team thread" });
  await thread.getByRole("button", { name: "Add reaction" }).last().click();
  await page.getByRole("dialog", { name: "Emoji" }).getByRole("button", { name: "thumbs up", exact: true }).click();
  const thumbs = thread.getByRole("button", { name: /^thumbs up, 1 reaction, including you/ });
  assert.equal(await thumbs.getAttribute("aria-pressed"), "true");
  await thumbs.click();
  await thumbs.waitFor({ state: "detached" });
  await conversation.getByRole("button", { name: "2 new messages" }).click();
  await conversation.getByRole("button", { name: "2 new messages" }).waitFor({ state: "detached" });
  await thread.getByRole("button", { name: "Show 6 of 10 earlier messages" }).click();
  await thread.getByRole("button", { name: /^2 replies/ }).click();
  const replyBox = thread.getByRole("textbox", { name: "Reply in thread" });
  await replyBox.fill("I'll call the two big accounts.");
  await replyBox.press("Enter");
  await thread.getByText("I'll call the two big accounts.").waitFor();
  await thread.getByRole("button", { name: /^3 replies/ }).waitFor();
  await conversation.getByRole("button", { name: "Simulate typing" }).click();
  await conversation.getByRole("status").filter({ hasText: "Dana Webb and Luis Ortega are typing" }).waitFor();
  pass("reactions toggle, unread jump clears, earlier messages load, thread replies send and typing shows names");

  const outbox = conversation.getByRole("region", { name: "Outbox" });
  await outbox.getByRole("button", { name: "Edit" }).click();
  const queuedField = outbox.getByRole("textbox", { name: "Edit queued message" });
  await queuedField.fill("Order 80 bags of black mulch for Monday.");
  await queuedField.press("Enter");
  await outbox.getByText("Order 80 bags of black mulch for Monday.").waitFor();
  await outbox.getByRole("button", { name: "Retry" }).click();
  await outbox.getByText("Sending").waitFor();
  await outbox.getByText("Send the backorder note to contractor accounts.").locator("xpath=..").getByText("Delivered").waitFor();
  pass("outbox edits queued messages and retries failures until delivered");

  await conversation.getByRole("toolbar", { name: "Response actions" }).getByRole("button", { name: "Bad response" }).click();
  const feedback = page.getByRole("dialog", { name: "What went wrong?" });
  await feedback.getByRole("button", { name: "Incomplete or too short" }).click();
  await expectNoViolations(page, "feedback-dialog");
  await feedback.getByRole("button", { name: "Send feedback" }).click();
  await conversation.getByText("Thanks. Sent negative feedback: Incomplete or too short.").waitFor();
  pass("feedback dialog collects a reason after thumbs down");

  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Bad response");
  await page.keyboard.press("Control+j");
  const assistant = page.getByRole("dialog", { name: "Assistant" });
  await assistant.waitFor();
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Ask the assistant" && document.activeElement.tagName === "TEXTAREA");
  await expectNoViolations(page, "assistant-panel");
  await page.keyboard.type("How is Q3 tracking?");
  await page.keyboard.press("Enter");
  await assistant.getByText("Q3 revenue is 8% above plan").waitFor();
  await assistant.getByRole("radio", { name: "Edit" }).click();
  await assistant.getByRole("textbox", { name: "Describe an edit" }).waitFor();
  await assistant.getByRole("button", { name: "Remove context" }).click();
  assert.equal(await assistant.getByText("Context:").count(), 0);
  await page.keyboard.press("Escape");
  await assistant.waitFor({ state: "detached" });
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Bad response");
  await conversation.getByRole("button", { name: "Ask the assistant" }).click();
  await assistant.waitFor();
  await page.keyboard.press("Escape");
  await assistant.waitFor({ state: "detached" });
  await page.waitForFunction(() => document.activeElement?.textContent === "Ask the assistant");
  pass("assistant panel opens with Ctrl+J or its launcher, focuses the composer, switches mode and returns focus on Escape");

  const workspace = page.locator("#gallery-workspace");
  await workspace.evaluate((element) => element.scrollIntoView({ block: "start" }));
  const fileTree = workspace.getByRole("tree", { name: "Files" });
  await fileTree.getByRole("treeitem", { name: /^lib/ }).click();
  await fileTree.getByRole("treeitem", { name: /^tax\.ts/ }).focus();
  await page.keyboard.press("Enter");
  const taxTab = workspace.getByRole("tab", { name: "tax.ts", exact: true });
  assert.equal(await taxTab.getAttribute("aria-selected"), "true");
  const taxEditor = workspace.getByRole("textbox", { name: "Editing tax.ts" });
  await taxEditor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type("\nexport const LOCAL_RATE = 0.0275;");
  await workspace.getByRole("tab", { name: "tax.ts, unsaved" }).waitFor();
  await workspace.getByRole("button", { name: /^1 file changed/ }).waitFor();
  await page.keyboard.press("Control+s");
  await workspace.getByRole("status").filter({ hasText: "Saved tax.ts" }).waitFor();
  await workspace.getByRole("tab", { name: "tax.ts", exact: true }).waitFor();
  pass("file tree opens files in tabs, edits mark them unsaved and Ctrl+S saves");

  await workspace.getByRole("radio", { name: "Search" }).click();
  const searchBox = workspace.getByRole("searchbox", { name: "Search in files" });
  await searchBox.fill("priceFor");
  await searchBox.press("Enter");
  await workspace.getByText("3 results in 2 files").waitFor();
  await workspace.getByRole("button", { name: "Line 3: export function priceFor(list: number, contractor: boolean): number {" }).click();
  assert.equal(await workspace.getByRole("tab", { name: "pricing.ts" }).getAttribute("aria-selected"), "true");
  await page.waitForFunction(() => document.activeElement?.closest(".cm-editor") && document.querySelector(".cm-activeLine")?.textContent?.startsWith("export function priceFor"));
  pass("find in files groups matches and opens the result at its line");

  await workspace.getByRole("radio", { name: "Files" }).click();
  await workspace.getByRole("tree", { name: "Files" }).getByRole("treeitem", { name: /^\.env/ }).click();
  const envEditor = workspace.locator('[data-slot="code-editor"]');
  await envEditor.getByText("STRIPE_SECRET_KEY=").waitFor();
  assert.equal(await envEditor.locator(".cm-content").innerText().then((text) => text.includes("demo_stripe_secret") || text.includes("hunter2secret")), false);
  await envEditor.getByRole("button", { name: "Show secrets" }).click();
  await envEditor.getByText("demo_stripe_secret_7f3a9c21", { exact: false }).waitFor();
  pass("secrets in .env stay masked until revealed and locked files are read-only");

  await page.keyboard.press("Control+k");
  const palette = page.getByRole("combobox", { name: "Command palette" });
  await palette.waitFor();
  await page.keyboard.type("receipt");
  const commandReport = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(WCAG).analyze();
  assert.deepEqual(commandReport.violations.map((violation) => violation.id), [], "command palette accessibility violations");
  await page.keyboard.press("Enter");
  await workspace.getByRole("status").filter({ hasText: "The assistant is writing this file" }).waitFor();
  await workspace.getByRole("status").filter({ hasText: "The assistant created receipt.ts" }).waitFor({ timeout: 10_000 });
  await workspace.getByRole("tab", { name: "receipt.ts" }).waitFor();
  pass("command palette passes axe and runs a command that streams a new file into a read-only editor");

  const receiptTab = workspace.getByRole("tab", { name: "receipt.ts" });
  await receiptTab.focus();
  await page.keyboard.press("Delete");
  await receiptTab.waitFor({ state: "detached" });
  await workspace.getByRole("button", { name: "Recently closed" }).click();
  await page.getByRole("menuitem", { name: "src/lib/receipt.ts" }).click();
  await workspace.getByRole("tab", { name: "receipt.ts" }).waitFor();
  pass("tabs close with Delete and reopen from recently closed");

  await workspace.getByRole("button", { name: "Show database" }).click();
  const rowsGrid = workspace.getByRole("grid", { name: "Rows of orders" });
  await rowsGrid.getByRole("gridcell", { name: "Ana Ruiz" }).first().waitFor();
  await rowsGrid.getByRole("button", { name: "total", exact: true }).click();
  await rowsGrid.getByRole("columnheader", { name: /total/ }).and(page.locator('[aria-sort="ascending"]')).waitFor();
  await rowsGrid.getByRole("gridcell").first().click();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await workspace.getByRole("complementary", { name: /^customer · row 1/ }).waitFor();
  await expectNoViolations(page, "workspace-database");
  pass("database viewer sorts on the server, moves through cells and shows cell detail");

  const docs = workspace.getByRole("navigation", { name: "On this page" });
  await docs.getByRole("link", { name: "Deploying" }).click();
  assert.equal(await docs.getByRole("link", { name: "Deploying" }).getAttribute("aria-current"), "location");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "doc-deploying");
  pass("docs outline jumps to sections and marks the current one");

  const execution = page.locator("#gallery-execution");
  await execution.evaluate((element) => element.scrollIntoView({ block: "start" }));
  const bash = execution.getByRole("region", { name: "bash terminal" });
  await bash.locator(".xterm-rows").waitFor();
  await bash.click();
  await page.keyboard.type("help");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector('[aria-label="bash terminal"] .xterm-rows')?.textContent?.includes("Commands: ls"));
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "bash terminal input");
  await execution.getByRole("tab", { name: "npm install, running" }).click();
  await execution.getByRole("tab", { name: "npm install, exited with code 0" }).waitFor({ timeout: 10_000 });
  await page.waitForFunction(() => document.querySelector('[aria-label="npm install terminal"] .xterm-rows')?.textContent?.includes("added 214 packages"));
  pass("xterm.js terminals take typed input, stream progress output and report exit codes on their tabs");

  const buildLog = execution.getByRole("region", { name: "Build output" });
  await execution.getByRole("button", { name: "Run build" }).click();
  await buildLog.getByText("built in 1.84s").waitFor();
  await buildLog.getByText("transforming (312) src/lib/pricing.ts", { exact: true }).waitFor();
  await buildLog.getByRole("button", { name: /^Errors/ }).click();
  assert.equal(await buildLog.locator('[role="log"] [data-stream]').count(), 1);
  await buildLog.getByRole("button", { name: /^Errors/ }).click();
  const commandLine = buildLog.getByRole("textbox", { name: "Command" });
  await commandLine.fill("pwd");
  await commandLine.press("Enter");
  await buildLog.getByText("/home/george/pos").waitFor();
  await commandLine.press("ArrowUp");
  assert.equal(await commandLine.inputValue(), "pwd");
  pass("log viewer streams colored output, redraws progress lines, filters errors and runs commands with history");

  const runPanel = execution.locator('[data-slot="run-panel"]');
  await runPanel.getByRole("button", { name: "Run", exact: true }).click();
  await runPanel.getByRole("status").filter({ hasText: "Succeeded" }).waitFor();
  await runPanel.getByText("11035").waitFor();
  await runPanel.getByText("Saturday is missing").waitFor();
  await runPanel.getByRole("combobox", { name: "Runner" }).selectOption("chart");
  await page.keyboard.press("ControlOrMeta+Enter");
  await runPanel.getByRole("img", { name: /^Bar chart of daily sales/ }).waitFor();
  pass("run panel runs JavaScript in a worker, shows stdout and stderr, and renders image output from Ctrl+Enter");

  const notebook = execution.locator('[data-slot="notebook"]');
  await notebook.getByRole("button", { name: "Run all" }).click();
  await notebook.getByRole("group", { name: "Cell 4, code" }).and(page.locator('[data-status="success"]')).waitFor({ timeout: 10_000 });
  assert.deepEqual(await notebook.locator("[data-status]").evaluateAll((elements) => elements.map((element) => element.getAttribute("data-status"))), ["idle", "success", "success", "success"]);
  await notebook.getByText("3 items loaded").waitFor();
  assert.equal(await notebook.locator("iframe").getAttribute("sandbox"), "");
  const download = page.waitForEvent("download");
  await notebook.getByRole("button", { name: "Export .ipynb" }).click();
  assert.equal((await download).suggestedFilename(), "margins.ipynb");
  pass("notebook runs every cell on the worker kernel, renders rich outputs and exports .ipynb");

  const previews = page.locator("#gallery-preview");
  await previews.evaluate((element) => element.scrollIntoView({ block: "start" }));
  const web = previews.locator('[data-slot="web-preview"]');
  assert.equal(await web.getByRole("combobox", { name: "Device" }).inputValue(), "iphone-15");
  await web.getByText(/^393 × 852/).waitFor();
  const store = page.frameLocator('iframe[title="Store preview"]');
  await store.getByRole("button", { name: "Add to cart" }).first().waitFor();
  await web.getByRole("combobox", { name: "Device" }).selectOption("ipad-mini");
  await web.getByRole("button", { name: "Landscape" }).click();
  await web.getByText(/^1024 × 768/).waitFor();
  // Playwright maps clicks into iframes without their ancestors' CSS scale, so pick elements at full size.
  await web.getByRole("combobox", { name: "Device" }).selectOption("responsive");
  const inspect = web.getByRole("button", { name: "Select an element" });
  await inspect.click();
  assert.equal(await inspect.getAttribute("aria-pressed"), "true");
  await store.locator("#add-drill").click();
  await previews.getByRole("list", { name: "Selected element" }).getByText("<button#add-drill>").waitFor();
  assert.equal(await inspect.getAttribute("aria-pressed"), "false");
  const width = web.getByRole("separator", { name: "Preview width" });
  await width.focus();
  await page.keyboard.press("Home");
  assert.equal(await width.getAttribute("aria-valuenow"), "200");
  const frameWidth = await store.locator("body").evaluate(() => window.innerWidth);
  assert.ok(frameWidth <= 200, `responsive frame is ${frameWidth}px wide`);
  await web.getByRole("button", { name: "Fill" }).click();
  await web.getByRole("button", { name: "Full screen" }).click();
  await web.getByRole("button", { name: "Exit full screen" }).click();
  await web.getByRole("button", { name: "Full screen" }).waitFor();
  pass("web preview switches devices and orientation, resizes from the keyboard, inspects elements and toggles fullscreen");

  const orderFrame = page.frameLocator('iframe[title="Order total"]');
  await orderFrame.getByText("$153").waitFor({ timeout: 10_000 });
  await previews.getByRole("button", { name: "Break it again" }).click();
  await previews.getByText(/^Auto-fix attempt 2 of 3\.$/).waitFor({ timeout: 10_000 });
  await orderFrame.getByText("$153").waitFor({ timeout: 10_000 });
  pass("preview runtime errors trigger an automatic fix that replaces the broken artifact");

  await previews.getByRole("button", { name: "Restore v2" }).click();
  const confirmRestore = previews.getByRole("group", { name: "Confirm restoring v2" });
  await page.waitForFunction(() => document.activeElement?.textContent === "Restore v2" && document.activeElement.closest('[role="group"]') !== null);
  await confirmRestore.getByRole("button", { name: "Restore v2" }).click();
  await previews.locator('[data-slot="version-history"] li[data-current]').getByText("Restored v2").waitFor();
  pass("version history restores in two steps and adds the restored copy as the current version");

  await previews.getByText("3 files changed").waitFor();
  const change = previews.locator('[data-slot="change-review"]');
  await change.getByRole("checkbox").first().uncheck();
  await change.getByRole("button", { name: "Apply 1 of 2 changes" }).click();
  await previews.getByText("Applied. Discard resets the demo.").waitFor();
  const tracked = previews.locator('[data-slot="tracked-changes"]');
  await tracked.getByRole("button", { name: "Accept all" }).click();
  await tracked.getByText("All changes reviewed").waitFor();
  await tracked.getByRole("button", { name: "Finish" }).click();
  await previews.getByRole("paragraph").filter({ hasText: "We open at 7 a.m. on weekdays and close at 4 p.m. on Sundays. Returns within 30 days need a receipt." }).waitFor();
  pass("diff review summarizes files, selective accept applies one hunk and tracked changes resolve to the accepted text");

  const inline = previews.locator('[data-slot="inline-edit"]');
  await inline.getByRole("button", { name: "Fix spelling and grammar" }).click();
  await inline.getByRole("region", { name: "Suggested text" }).getByText("Our store has a lot of tools, and we can help you find what you need for your project.").waitFor();
  await inline.getByRole("button", { name: "Replace" }).click();
  await previews.getByRole("button", { name: "Edit with AI" }).waitFor();
  await previews.getByText("Our store has a lot of tools, and we can help you find what you need for your project.").waitFor();
  const comments = previews.locator('[data-slot="review-comments"]');
  const reply = comments.getByRole("textbox", { name: "Reply on src/cart.ts, line 2" });
  await reply.fill("Defaulting quantity to 1.");
  await reply.press("ControlOrMeta+Enter");
  await comments.getByText("Defaulting quantity to 1.").waitFor();
  pass("inline AI edit streams a suggestion and replaces the text; review comments take replies");

  const divider = previews.getByRole("slider", { name: "Divider between before and after" });
  await divider.focus();
  await page.keyboard.press("End");
  assert.equal(await divider.getAttribute("aria-valuetext"), "100% before");
  const deployment = previews.locator('[data-slot="deployment-status"]');
  await deployment.getByRole("button", { name: "Deploy" }).click();
  await deployment.getByRole("link", { name: "pos.example.com" }).waitFor({ timeout: 10_000 });
  await previews.getByRole("heading", { name: "q3-sales-report.pdf is ready" }).waitFor({ timeout: 10_000 });
  // Exercise the real clipboard fallback on platforms with native share sheets too.
  await page.evaluate(() => Object.defineProperty(navigator, "canShare", { configurable: true, value: () => false }));
  try {
    await previews.getByRole("button", { name: "Share" }).click();
    await previews.getByRole("button", { name: "Link copied" }).waitFor();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "https://example.com/reports/q3");
  } finally {
    await page.evaluate(() => delete navigator.canShare);
  }
  pass("image compare, deployment, export and share demos reach their finished states");

  const secret = previews.locator('[data-slot="secret-field"]').first();
  await secret.getByRole("button", { name: "Replace key" }).click();
  await secret.getByLabel("Anthropic API key").fill("short");
  await secret.getByRole("button", { name: "Save" }).click();
  await secret.getByRole("alert").filter({ hasText: "That key looks too short." }).waitFor();
  await secret.getByLabel("Anthropic API key").fill("sk-ant-demo-123456");
  await secret.getByRole("button", { name: "Save" }).click();
  await secret.getByText("Saved (…3456)").waitFor();
  await page.frameLocator('iframe[title="Multi-file project"]').getByText("Total $46").waitFor();
  pass("secret field validates and saves without showing the key; the project preview runs ES modules across files");

  const settings = page.locator("#gallery-settings");
  await settings.evaluate((element) => element.scrollIntoView({ block: "start" }));
  const parameters = settings.locator('[data-slot="model-parameters"]');
  await parameters.getByRole("button", { name: "Raise to 16K" }).click();
  await parameters.getByRole("button", { name: /^Raise to/ }).waitFor({ state: "detached" });
  await settings.getByRole("combobox", { name: "Model: Claude Sonnet", exact: true }).click();
  const modelSearch = page.getByRole("combobox", { name: "Search models" });
  await modelSearch.fill("olla");
  const modelList = page.getByRole("listbox");
  await modelList.getByRole("option", { name: /^Claude Sonnet/ }).waitFor({ state: "detached" });
  await modelList.getByRole("option", { name: /^Llama 3\.1 8B/ }).waitFor();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await settings.getByRole("combobox", { name: "Model: Llama 3.1 8B", exact: true }).waitFor();
  assert.equal(await parameters.getByRole("radiogroup", { name: "Reasoning effort" }).count(), 0);
  assert.equal(await parameters.getByRole("textbox", { name: "Temperature" }).isDisabled(), false);
  pass("model picker searches fuzzily and selects from the keyboard; parameters follow the model's capabilities");

  const providerSettings = settings.locator('[data-slot="provider-settings"]');
  await providerSettings.getByRole("switch", { name: "Enable OpenAI" }).click();
  await providerSettings.getByText("From $OPENAI_API_KEY").waitFor();
  const ollama = providerSettings.getByRole("region", { name: "Ollama" });
  await ollama.getByRole("button", { name: "Test connection" }).click();
  await ollama.getByText("Couldn't reach http://localhost:11434. Is Ollama running?").waitFor();
  const health = settings.locator('[data-slot="provider-health"]');
  await health.getByRole("button", { name: "Verify Anthropic" }).click();
  await health.getByText("checked just now").waitFor();
  const qwen = settings.locator('[data-slot="model-card"]').filter({ hasText: "Qwen 2.5 Coder 7B" });
  await qwen.getByRole("button", { name: "Resume" }).click();
  await qwen.getByRole("button", { name: "Pause" }).click();
  await qwen.getByText("Paused").waitFor();
  pass("provider settings enable providers and test connections; health checks and local model downloads update");

  const roles = settings.locator('[data-slot="model-config-list"]');
  await roles.getByRole("button", { name: "Reset Coder to Claude Sonnet" }).click();
  await roles.getByText("1 unsaved change").waitFor();
  await roles.getByRole("button", { name: "Save" }).click();
  await roles.getByText("1 unsaved change").waitFor({ state: "detached" });
  await roles.getByRole("button", { name: "Test Planner" }).click();
  await roles.getByText("Planner replied in 630 ms").waitFor();
  const meter = settings.getByRole("meter", { name: "Context" });
  const contextBefore = await meter.getAttribute("aria-valuetext");
  const snapshot = settings.locator('[data-slot="context-snapshot"]');
  await snapshot.getByRole("button", { name: /^Files/ }).click();
  await snapshot.getByRole("button", { name: "Leave out inventory-october.csv" }).click();
  await page.waitForFunction(([element, previous]) => element?.getAttribute("aria-valuetext") !== previous, [await meter.elementHandle(), contextBefore]);
  pass("role overrides save after review; leaving context out of the next request shrinks the context meter");

  const usage = settings.locator('[data-slot="usage-dashboard"]');
  await usage.getByRole("button", { name: "Cost" }).click();
  assert.match(await usage.getByRole("row").nth(1).textContent(), /Supplier price comparison/);
  const csv = page.waitForEvent("download");
  await usage.getByRole("button", { name: "CSV" }).click();
  assert.equal((await csv).suggestedFilename(), "october-usage.csv");
  const banner = settings.locator('[data-slot="usage-limit-banner"]');
  await banner.getByText("You've used 86% of your messages.").waitFor();
  await banner.getByRole("button", { name: "Dismiss" }).click();
  await settings.getByText("Banner dismissed.").waitFor();
  const receipt = settings.locator('[data-slot="usage-receipt"]');
  await receipt.getByRole("button", { expanded: false }).click();
  await receipt.getByText("Sonnet was overloaded, so the request fell back").waitFor();
  await receipt.getByRole("button", { name: "Copy receipt" }).click();
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /Request: …4c2e/);
  pass("usage dashboard sorts and exports runs; limit banner dismisses; the receipt opens and copies with the request id redacted");

  const runBudget = settings.locator('[data-slot="run-budget-control"]');
  await runBudget.getByRole("button", { name: "$5.00" }).click();
  assert.equal(await runBudget.getByRole("button", { name: "$5.00" }).getAttribute("aria-pressed"), "true");
  await runBudget.getByRole("radio", { name: /Your Anthropic key/ }).check();
  await runBudget.getByRole("switch", { name: "Stop at the cap" }).click();
  await runBudget.getByText("The run stops when it reaches the cap.").waitFor();
  const mcp = settings.locator('[data-slot="mcp-server-list"]');
  await mcp.getByRole("button", { name: /^Filesystem/ }).click();
  await mcp.getByRole("list", { name: "Filesystem tools" }).getByText("list_directory").waitFor();
  await mcp.getByRole("switch", { name: "Enable CRM" }).click();
  assert.equal(await mcp.getByText("401 Unauthorized", { exact: false }).count(), 0);
  const audit = settings.locator('[data-slot="tool-audit-log"]');
  await audit.getByRole("button", { name: /^Denied/ }).click();
  await audit.getByRole("button", { name: /send_email/ }).click();
  await audit.getByText("Blocked: sending email needs approval.").waitFor();
  pass("run budget, MCP servers and the tool audit log respond to keyboard and pointer input");

  const prompts = settings.locator('[data-slot="prompt-library"]');
  await prompts.getByRole("button", { name: "Use Order follow-up" }).click();
  const promptForm = prompts.getByRole("form", { name: "Use Order follow-up" });
  await promptForm.getByLabel("customer").fill("Dana");
  await promptForm.getByLabel("order").fill("#1042");
  await promptForm.getByLabel("when").fill("tomorrow");
  await promptForm.getByRole("button", { name: "Use prompt" }).click();
  await settings.getByText("Write a short, friendly note to Dana about order #1042. Mention that it ships tomorrow.").waitFor();
  const memory = settings.locator('[data-slot="memory-manager"]');
  await memory.getByRole("button", { name: "Use new" }).click();
  await memory.locator('[data-slot="memory-conflict"]').waitFor({ state: "detached" });
  await memory.getByText("The store opens at 7 AM on weekdays starting November.").waitFor();
  await memory.getByRole("button", { name: "Approve: The paint department is moving to aisle 12 in November." }).click();
  assert.equal(await memory.getByText("0 to review", { exact: false }).count(), 1);
  const agents = settings.locator('[data-slot="agent-picker"]');
  await agents.getByRole("tab", { name: "Team" }).click();
  await agents.getByRole("radio", { name: /Research team/ }).check();
  await agents.getByRole("button", { name: "Add member" }).click();
  assert.equal(await agents.getByRole("combobox", { name: /model$/ }).count(), 3);
  pass("prompt variables fill into the composer, memory conflicts resolve, and teams gain members with roles");

  const knowledge = page.locator("#gallery-knowledge");
  await knowledge.evaluate((element) => element.scrollIntoView({ block: "start" }));
  const kb = knowledge.locator('[data-slot="knowledge-base"]');
  await kb.getByRole("checkbox", { name: "Use Product catalog as a source" }).check();
  await kb.getByRole("button", { name: /^Product catalog/ }).click();
  await kb.getByRole("progressbar", { name: "Indexing paint-and-sundries.csv" }).waitFor();
  await kb.getByRole("button", { name: /^Store policies/ }).click();
  await kb.getByRole("button", { name: "Re-index" }).click();
  await kb.getByRole("list", { name: "Store policies documents" }).getByText("Out of date").waitFor({ state: "detached" });
  pass("knowledge base toggles sources, shows indexing progress and re-indexes stale documents");

  const scope = knowledge.getByRole("radiogroup", { name: "Search in" });
  await scope.getByRole("radio", { name: "Your files" }).click();
  assert.equal(await knowledge.locator('[data-slot="search-result-card"]').count(), 1);
  await scope.getByRole("radio", { name: "Both" }).click();
  await knowledge.getByRole("button", { name: "stain" }).click();
  assert.equal(await knowledge.getByRole("button", { name: "stain" }).getAttribute("aria-pressed"), "true");
  await knowledge.getByRole("button", { name: "Read 2 passages from Exterior paint: choosing a finish" }).click();
  const passage = page.getByRole("dialog", { name: "Exterior paint: choosing a finish" });
  await passage.getByRole("button", { name: "Next passage" }).click();
  await passage.getByText(/above 50°F/).waitFor();
  await passage.getByRole("button", { name: "Add to context" }).click();
  await page.keyboard.press("Escape");
  await passage.waitFor({ state: "detached" });
  await knowledge.getByText("2 added to context").waitFor();
  pass("search scope filters results, expansion terms toggle, and passages are read before adding to context");

  await knowledge.getByRole("button", { name: "Source 2: Paint department pricing, October" }).first().click();
  assert.equal(await page.evaluate(() => document.activeElement?.id), "gallery-answer-evidence-2");
  const ledger = knowledge.locator('[data-slot="claim-ledger"]');
  await ledger.getByText("2 still need a decision").waitFor();
  await ledger.getByRole("button", { name: "Accept: Contractors get 10% off." }).click();
  await ledger.getByText("1 still need a decision").waitFor();
  await knowledge.getByRole("button", { name: "Raw response" }).click();
  await knowledge.getByRole("tree", { name: "Raw retrieval response" }).waitFor();
  await knowledge.getByRole("button", { name: "Prefer Claude Haiku" }).click();
  assert.equal(await knowledge.getByRole("button", { name: "Prefer Claude Haiku" }).getAttribute("aria-pressed"), "true");
  pass("citations focus their evidence, claims settle, retrieval shows its raw response and comparisons record a preference");

  const register = knowledge.locator('[data-slot="insight-card"]').filter({ hasText: "Register 2 was short" });
  await register.getByRole("button", { name: "Why?" }).click();
  await register.getByText(/Three sales were voided/).waitFor();
  await register.getByRole("button", { name: "Acknowledge" }).click();
  await register.getByText("Acknowledged").waitFor();
  await knowledge.getByRole("button", { name: "Refresh all insights" }).click();
  await knowledge.getByText("1 of 4 parts couldn't be analyzed.").waitFor();
  const suggestion = knowledge.locator('[data-slot="suggestion-card"]');
  await suggestion.getByRole("button", { name: "Apply" }).click();
  await knowledge.getByText("Task: due Thursday, owner Dana Reyes").waitFor();
  await suggestion.getByRole("button", { name: "Undo" }).click();
  await knowledge.getByText("Task: due not set, owner Unassigned").waitFor();
  const picker = knowledge.locator('[data-slot="candidate-picker"]');
  await picker.getByText("PVC elbow 90°, 3/4 in.", { exact: true }).click();
  assert.equal(await picker.getByRole("radio", { name: /PVC elbow 90°, 3\/4 in\. Schedule 40/ }).isChecked(), true);
  await picker.getByRole("button", { name: "Use this one" }).click();
  await knowledge.getByText("3 of 5 matched").waitFor();
  await knowledge.getByText("Last choice: pv-34-90").waitFor();
  pass("insights expand, acknowledge and refresh; suggestions apply and undo; the candidate picker advances to the next item");

  const run = knowledge.locator('[data-slot="agent-run-view"]');
  await run.getByRole("alert").filter({ hasText: "reached its budget" }).waitFor();
  await run.getByRole("button", { name: "Continue with $1.00 more" }).click();
  await run.getByRole("button", { name: "Pause" }).waitFor();
  const planner = run.getByRole("button", { name: /Planner/ });
  await planner.focus();
  await page.keyboard.press("ArrowRight");
  assert.match(await page.evaluate(() => document.activeElement?.textContent ?? ""), /Price researcher|Inventory analyst/);
  await page.keyboard.press("Enter");
  pass("agent run continues past its budget, and arrow keys move between connected agents in the graph");

  await knowledge.getByRole("button", { name: "Notifications, 2 unread" }).click();
  const inbox = page.getByRole("dialog", { name: "Notifications" });
  await inbox.getByRole("button", { name: /Restock report ready/ }).click();
  await knowledge.getByText("Opened: Restock report ready").waitFor();
  await inbox.getByRole("button", { name: "Load more" }).click();
  await inbox.getByText("Price change from Orgill").waitFor();
  await inbox.getByRole("button", { name: "Mark all read" }).click();
  await page.keyboard.press("Escape");
  await knowledge.getByRole("button", { name: "Notifications", exact: true }).waitFor();
  pass("notification center opens items, loads more and marks everything read");

  await checkPublishing(page);
  await checkEditor(page, pass);
  await checkVibeEditor(page, pass);

  await expectNoViolations(page, "gallery-light");
  await page.getByRole("button", { name: "Use dark theme" }).click();
  await expectNoViolations(page, "gallery-dark");
  const htmlPage = page.locator('[data-slot="html-editor"]').filter({ has: page.locator('[aria-label="Product description"]') }).locator('[data-theme="light"]');
  assert.equal(await htmlPage.evaluate((element) => getComputedStyle(element).backgroundColor), "oklch(1 0 0)", "the HTML editor page followed the dark theme");
  pass("HTML editor keeps a white page in the dark theme so chosen colors stay true");
}

await mkdir(output, { recursive: true });
await build({ logLevel: "error" });
const server = await preview({ preview: { host: "127.0.0.1", port: 0, strictPort: false } });
const address = server.httpServer.address();
assert.ok(address && typeof address === "object");
const url = `http://127.0.0.1:${address.port}/`;
// Region capture needs tab capture, which the full Chromium build supports headlessly and the headless shell does not;
// the switch accepts the share prompt for the current tab.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const captureArgs = ["--auto-accept-this-tab-capture"];
// Use software compositing on Windows to ensure headless tab capture receives video frames.
if (process.platform === "win32") captureArgs.push("--disable-gpu");
const browser = await chromium.launch({ ...(executablePath ? { executablePath } : { channel: "chromium" }), args: captureArgs });
try {
  const viewport = { width: 1280, height: 900 };
  const errors = [];
  // Capture the tab from a fresh context before the gallery changes preview and focus state.
  const captureContext = await browser.newContext({ viewport, reducedMotion: "reduce" });
  try {
    const page = await captureContext.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(url + "#gallery");
    await page.getByRole("heading", { name: "Feedback and status" }).waitFor();
    const previews = page.locator("#gallery-preview");
    const web = previews.locator('[data-slot="web-preview"]').first();
    await web.getByRole("combobox", { name: "Device" }).selectOption("responsive");
    await web.getByRole("button", { name: "Full screen" }).click();
    await web.getByRole("button", { name: "Exit full screen" }).click();
    await checkRegionCapture(page, previews, web);
    await previews.locator('[data-slot="region-capture"]').locator("..").screenshot({ path: resolve(output, "region-capture.png") });
  } finally {
    await captureContext.close();
  }
  if (!process.argv.includes("--region-capture")) {
    const context = await browser.newContext({
      viewport,
      reducedMotion: "reduce",
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const page = await context.newPage();
    const requests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => requests.push(request.url()));
    await checkChat(page, url, requests);
    await checkWorkbench(page, url);
    await checkGallery(page, url);
  }
  // The artifact viewer demos throw on purpose inside their sandboxed frames to show "Fix it" and auto-fix.
  const expectedFrameErrors = new Set(["storeHours is not defined", "order is not defined"]);
  assert.deepEqual(errors.filter((message) => !expectedFrameErrors.has(message)), [], "uncaught page errors");
  pass("no uncaught page errors");
  await writeFile(resolve(output, "evidence.json"), `${JSON.stringify({ browser: browser.version(), checks }, null, 2)}\n`);
} finally {
  await browser.close();
  await new Promise((done) => server.httpServer.close(done));
}
