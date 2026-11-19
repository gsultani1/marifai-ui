// example/gallery/media.tsx
import { useMemo, useState } from "react";

import {
  type ArtifactVersion,
  ArtifactThumbnail,
  ArtifactViewer,
  type GalleryImage,
  ImageCropper,
  ImageGallery,
  JsonViewer,
  MediaPlayer,
  SlideDeck,
  slidesFromMarkdown,
} from "../../src/index.js";
import { Demo, GallerySection } from "./section.js";

const PAGE_V1 = `<!doctype html>
<html><body style="font-family:system-ui;margin:0;padding:32px;background:#fff7ed">
<h1 style="color:#9a3412">Spring Garden Sale</h1>
<p id="hours"></p>
<script>document.getElementById("hours").textContent = storeHours.join(" · ");</script>
</body></html>`;

const PAGE_V2 = `<!doctype html>
<html><body style="font-family:system-ui;margin:0;padding:32px;background:#fff7ed">
<h1 style="color:#9a3412">Spring Garden Sale</h1>
<p id="hours"></p>
<button id="remind" disabled style="padding:8px 14px;border-radius:8px;border:0;background:#9a3412;color:white">Remind me</button>
<script>
const storeHours = ["Mon–Fri 7 AM–7 PM", "Sat 8 AM–6 PM", "Sun 10 AM–4 PM"];
document.getElementById("hours").textContent = storeHours.join(" · ");
document.getElementById("remind").addEventListener("click", (event) => { event.target.textContent = "We'll remind you"; });
document.getElementById("remind").disabled = false;
</script>
</body></html>`;

const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="24" fill="#d95926"/><path d="M30 80 L60 30 L90 80 Z" fill="#fff7ed"/><circle cx="60" cy="62" r="10" fill="#d95926"/></svg>`;

const DECK = `# Q2 store review
Whitten Hardware · April
Note: Thank the team for the spring reset.
---
## Sales
- Garden center up **18%**
- Paint flat, tools down 4%
- Online orders now 9% of revenue
Note: Paint is flat because of the supplier delay in March.
---
## Next quarter
1. Expand the rental counter
2. Hire two seasonal staff
3. Launch the loyalty card
---
## Questions`;

function swatch(color: string, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360"><rect width="480" height="360" fill="${color}"/><text x="240" y="190" font-family="system-ui" font-size="36" fill="white" text-anchor="middle">${label}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

const PHOTOS: GalleryImage[] = [
  { id: "front", src: swatch("#d95926", "Storefront"), alt: "Storefront with spring banners", caption: "Storefront", downloadName: "storefront.svg" },
  { id: "garden", src: swatch("#199e70", "Garden center"), alt: "Garden center with seedlings on tables", caption: "Garden center" },
  { id: "paint", src: swatch("#3987e5", "Paint desk"), alt: "Paint mixing desk with color samples", caption: "Paint desk" },
  { id: "tools", src: swatch("#9085e9", "Tool wall"), alt: "Wall of hand tools", caption: "Tool wall" },
];

function toneDataUrl(): string {
  const rate = 8000;
  const seconds = 2;
  const samples = rate * seconds;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => [...text].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  write(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples * 2, true);
  for (let index = 0; index < samples; index++) view.setInt16(44 + index * 2, Math.sin((2 * Math.PI * 440 * index) / rate) * 8000 * Math.min(1, (samples - index) / 2000), true);
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

export function MediaGallery() {
  const [versions, setVersions] = useState<ArtifactVersion[]>([
    { id: "v1", content: PAGE_V1, label: "First draft" },
    { id: "v2", content: PAGE_V2, label: "Fixed hours, added reminder" },
  ]);
  const [version, setVersion] = useState("v1");
  const [fixRequest, setFixRequest] = useState<string | null>(null);
  const [cropped, setCropped] = useState<string | null>(null);
  const slides = useMemo(() => slidesFromMarkdown(DECK), []);
  const tone = useMemo(() => (typeof window === "undefined" ? "" : toneDataUrl()), []);

  return (
    <GallerySection id="gallery-media" title="Artifacts, slides and media">
      <Demo title="Artifact viewer" className="flex w-full flex-col gap-2">
        <ArtifactViewer
          className="h-[28rem] w-full"
          title="Sale landing page"
          kind="html"
          versions={versions}
          version={version}
          onVersionChange={setVersion}
          onRestoreVersion={(id) => {
            const restored = versions.find((item) => item.id === id);
            if (!restored) return;
            const next = { ...restored, id: `v${versions.length + 1}`, label: `Restored ${restored.label?.toLowerCase() ?? id}` };
            setVersions([...versions, next]);
            setVersion(next.id);
          }}
          onFix={(errors) => setFixRequest(errors.join("\n"))}
        />
        {fixRequest && <p className="text-sm">Sent to the assistant: <code className="font-mono text-xs">{fixRequest}</code></p>}
      </Demo>
      <Demo title="Artifact thumbnails" className="grid w-full grid-cols-2 gap-3 md:grid-cols-4">
        <ArtifactThumbnail title="Sale landing page" subtitle="Web page" kind="html" content={PAGE_V2} onClick={() => setVersion("v2")} />
        <ArtifactThumbnail title="Store logo" subtitle="SVG" kind="svg" content={LOGO} />
        <ArtifactThumbnail title="Q2 review" subtitle="Markdown" kind="markdown" content={DECK} />
        <ArtifactThumbnail title="restock.py" subtitle="Python" kind="code" content={"def reorder(items):\n    return [item for item in items if item.qty < item.min]"} />
      </Demo>
      <Demo title="JSON viewer" className="w-full">
        <JsonViewer className="max-h-72 w-full" label="Order payload" defaultExpandDepth={2} value={{ order: { id: "SO-1042", customer: { name: "Ana Ruiz", tier: "Pro" }, lines: [{ sku: "DS-3IN", qty: 4, price: 18.97 }, { sku: "PT-GAL", qty: 2, price: 34.5 }], paid: true, notes: null } }} />
      </Demo>
      <Demo title="Slide deck" className="w-full">
        <SlideDeck className="w-full" slides={slides} label="Q2 store review" />
      </Demo>
      <Demo title="Image gallery and lightbox" className="w-full">
        <ImageGallery className="w-full" images={PHOTOS} />
      </Demo>
      <Demo title="Image cropper and audio player" className="grid w-full items-start gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <ImageCropper src={PHOTOS[1]!.src} alt="Garden center photo" shape="round" outputWidth={256} onCrop={(blob) => setCropped(URL.createObjectURL(blob))} applyLabel="Use as avatar" />
          {cropped && <img src={cropped} alt="Cropped avatar" className="size-16 rounded-full" />}
        </div>
        {tone && <MediaPlayer kind="audio" src={tone} title="Store radio spot" />}
      </Demo>
    </GallerySection>
  );
}
