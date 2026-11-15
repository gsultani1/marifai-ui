// packages/ai-ui/example/gallery/publishing.tsx
import { useState } from "react";

import { type BuilderDocument, HtmlEditor, type HtmlAiRequest, PageBuilder, type RichTextComment } from "../../src/index.js";
import { Demo, GallerySection } from "./section.js";

const PRODUCT = [
  "<h2>Behr Premium Plus exterior paint</h2>",
  '<p><span style="color: #b91c1c"><strong>Spring sale:</strong></span> 20% off every gallon through April 30.</p>',
  '<p>One-coat hide, mildew resistant and rated for <span style="background-color: #fef9c3">15 years</span> on wood, brick and vinyl siding.</p>',
  "<ul><li><p>Covers 250 to 400 sq ft per gallon</p></li><li><p>Dry to the touch in 1 hour, recoat in 4</p></li></ul>",
  '<div data-embed="iframe"><iframe src="https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ" title="Prepping siding for paint"></iframe></div>',
  '<p style="text-align: center;">Ask the paint desk about color matching.</p>',
].join("");

const BANNER = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" viewBox="0 0 1200 400"><rect width="1200" height="400" fill="#dcfce7"/><circle cx="170" cy="200" r="110" fill="#16a34a"/><circle cx="300" cy="250" r="70" fill="#22c55e"/><rect x="420" y="150" width="680" height="100" rx="16" fill="#14532d"/><text x="760" y="215" font-family="Arial, sans-serif" font-size="48" font-weight="700" fill="#f0fdf4" text-anchor="middle">Garden center open</text></svg>')}`;

const SPRING_EMAIL: BuilderDocument = {
  title: "Spring sale at Whitten Hardware",
  preheader: "20% off exterior paint, grills and garden tools this weekend.",
  settings: { width: 600, background: "#f4f4f5", contentBackground: "#ffffff", fontFamily: "Arial, Helvetica, sans-serif", textColor: "#1f2937", linkColor: "#1d4ed8", padding: 24 },
  blocks: [
    {
      id: "hero",
      type: "section",
      background: "#7c2d12",
      padding: 24,
      blocks: [
        { id: "hero-title", type: "heading", text: "Spring sale starts Friday", level: 1, align: "center", color: "#ffffff" },
        { id: "hero-copy", type: "text", html: '<p style="text-align: center;"><span style="color: #ffedd5">20% off exterior paint, grills and garden tools through Sunday.</span></p>' },
        { id: "hero-button", type: "button", label: "See the deals", href: "https://example.com/spring", align: "center", background: "#ffffff", color: "#7c2d12", radius: 6, fullWidth: false },
      ],
    },
    { id: "banner", type: "image", src: BANNER, alt: "Garden center open", width: 100, align: "center" },
    { id: "intro", type: "text", html: "<p>Hi neighbor,</p><p>Our garden center reopens this week with <strong>perennials from $6.99</strong>, fresh potting soil and the first grills of the season.</p>" },
    {
      id: "deals",
      type: "columns",
      gap: 16,
      columns: [
        { id: "deals-paint", blocks: [{ id: "paint-title", type: "heading", text: "Exterior paint", level: 3, align: "left" }, { id: "paint-copy", type: "text", html: "<p>Behr Premium Plus, 20% off every gallon.</p>" }] },
        { id: "deals-garden", blocks: [{ id: "garden-title", type: "heading", text: "Garden tools", level: 3, align: "left" }, { id: "garden-copy", type: "text", html: "<p>Rakes, hoes and hose reels from $9.99.</p>" }] },
      ],
    },
    { id: "rule", type: "divider", color: "#e4e4e7", thickness: 1 },
    {
      id: "follow",
      type: "social",
      align: "center",
      links: [
        { id: "facebook", network: "facebook", url: "https://facebook.com/example" },
        { id: "instagram", network: "instagram", url: "https://instagram.com/example" },
        { id: "website", network: "website", url: "https://example.com" },
      ],
    },
    { id: "footer", type: "text", html: '<p style="text-align: center;"><span style="color: #52525b">Whitten Hardware · 123 Main St · Open 7 AM to 7 PM</span></p>' },
  ],
};

const REPORT = [
  "<h1>Store reset report</h1>",
  "<nav data-toc></nav>",
  '<p>The garden center reopens Friday. This plan covers the floor reset, staffing and the paint promotion<sup data-footnote="Sales figures are from the March register reports.">*</sup>.</p>',
  '<aside data-callout="warning"><p><strong>Deadline:</strong> fixtures must be in place by Thursday at 6 PM.</p></aside>',
  "<h2>Floor reset</h2>",
  `<figure data-align="center"><img src="${BANNER}" alt="Garden center entrance banner" width="560"><figcaption>New entrance banner for the garden center</figcaption></figure>`,
  '<p>Move the grills to the front endcap and <span data-comment-id="c-grills">put the seed racks beside the registers</span>.</p>',
  '<div data-columns="2"><div data-column=""><h3>Front of store</h3><p>Grills, patio furniture and the paint promotion table.</p></div><div data-column=""><h3>Garden center</h3><p>Perennials, potting soil and hose reels.</p></div></div>',
  "<h2>Staffing</h2>",
  '<p>Schedule <ins data-change-id="ch-1" data-author="Sam Whitten" data-date="2026-10-24T15:00:00Z">three</ins><del data-change-id="ch-2" data-author="Sam Whitten" data-date="2026-10-24T15:00:00Z">two</del> cashiers on Saturday morning.</p>',
  "<table><tr><th><p>Shift</p></th><th><p>Cashiers</p></th></tr><tr><td><p>Saturday 7 to 11</p></td><td style=\"background-color: #fef3c7\"><p>3</p></td></tr><tr><td><p>Saturday 11 to 3</p></td><td><p>2</p></td></tr></table>",
  "<div data-page-break></div>",
  "<h2>Paint promotion</h2>",
  "<p>Behr Premium Plus is 20% off. The paint desk recieves extra color cards on Wednesday.</p>",
].join("");

const REPORT_COMMENTS: RichTextComment[] = [{ id: "c-grills", body: "Do we have room for both seed racks?", author: "Dana Ortiz", createdAt: Date.UTC(2026, 9, 24, 14, 30) }];

/** Canned rewrites for the gallery, streamed word by word, so the AI menu works without a model. */
function demoAiText({ action, text, prompt }: HtmlAiRequest): string {
  const sentences = text.match(/[^.!?]+[.!?]?/g)?.map((sentence) => sentence.trim()) ?? [text];
  switch (action) {
    case "shorten":
      return sentences[0] ?? text;
    case "expand":
      return `${text} Each gallon covers 250 to 400 square feet and dries to the touch in an hour.`;
    case "fix":
      return text.replace(/recieves/g, "receives").replace(/\s{2,}/g, " ");
    case "tone-friendly":
      return `Good news! ${text}`;
    case "tone-professional":
      return text.replace(/^Good news! /, "").replace(/!/g, ".");
    case "continue":
      return " Restock the end caps every morning before opening.";
    case "custom":
      return `${text} (${prompt ?? "edited"})`;
    default:
      return sentences.map((sentence) => sentence.replace(/^\w/, (letter) => letter.toUpperCase())).join(" ");
  }
}

async function* demoAi(request: HtmlAiRequest, signal: AbortSignal): AsyncIterable<string> {
  for (const word of demoAiText(request).split(/(?<=\s)/)) {
    if (signal.aborted) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
    yield word;
  }
}

/** Demo upload: keeps the file in the page as an object URL instead of sending it anywhere. */
async function keepLocally(file: File): Promise<string> {
  return URL.createObjectURL(file);
}

/** Keeps the HTML output state local, so typing re-renders only this demo and not the editors beside it. */
function ProductEditorDemo() {
  const [html, setHtml] = useState(PRODUCT);
  return (
    <Demo title="HTML editor" className="flex w-full flex-col gap-2">
      <HtmlEditor className="w-full" defaultValue={PRODUCT} onValueChange={setHtml} onImageUpload={keepLocally} title="exterior-paint" height="22rem" aria-label="Product description" />
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">HTML output</summary>
        <pre data-testid="html-output" className="mt-2 max-h-48 overflow-auto rounded-md bg-muted p-2 font-mono text-xs whitespace-pre-wrap" tabIndex={0}>
          {html}
        </pre>
      </details>
    </Demo>
  );
}

export function PublishingGallery() {
  const [comments, setComments] = useState(REPORT_COMMENTS);
  return (
    <GallerySection id="gallery-publishing" title="HTML editor, pages and email">
      <ProductEditorDemo />
      <Demo title="Document editor with pages, review and AI" className="flex w-full flex-col gap-2">
        <HtmlEditor
          className="w-full"
          defaultValue={REPORT}
          onImageUpload={keepLocally}
          title="store-reset-report"
          height="36rem"
          aria-label="Store reset report"
          defaultHeader="Whitten Hardware · {title}"
          comments={comments}
          onCommentsChange={setComments}
          author="Dana Ortiz"
          review
          onAiRequest={demoAi}
        />
      </Demo>
      <Demo title="Email builder" className="w-full">
        <PageBuilder className="w-full" defaultValue={SPRING_EMAIL} onImageUpload={keepLocally} label="Spring sale email" height="40rem" />
      </Demo>
    </GallerySection>
  );
}
