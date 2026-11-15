// packages/ai-ui/src/components/page-builder-panels.tsx
"use client";

import { Switch } from "@base-ui/react/switch";
import { PlusIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { type ReactNode, useId, useRef, useState } from "react";

import { button, buttonVariants, focusRing, iconButton, input, switchRoot, switchThumb } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { contrastRatio, parseColor } from "../lib/color.js";
import {
  type BlockPatch,
  type BuilderAlign,
  type BuilderBlock,
  type BuilderBlockPatch,
  type BuilderDocument,
  type BuilderDocumentPatch,
  type BuilderMode,
  type BuilderSettings,
  type ButtonBlock,
  type ColumnsBlock,
  type DividerBlock,
  type HeadingBlock,
  type ImageBlock,
  newBuilderId,
  type SectionBlock,
  setColumnCount,
  type SocialBlock,
  SOCIAL_LABELS,
  type SocialNetwork,
  type SpacerBlock,
  type TextBlock,
  type VideoBlock,
} from "../lib/page-builder.js";
import { DEFAULT_HTML_FONTS } from "../lib/rich-text/html-options.js";
import { embedFromUrl } from "../lib/rich-text/html.js";
import { safeImageSrc, safeLinkHref } from "../lib/safe-url.js";
import { ColorPicker } from "./color-picker.js";
import { HtmlEditor } from "./html-editor.js";
import { SegmentedControl } from "./segmented-control.js";

function TextField({ label, value, onChange, placeholder, multiline = false, problem, hint, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; multiline?: boolean; problem?: string | null; hint?: string; type?: "text" | "url" }) {
  const id = useId();
  const note = problem || hint;
  const shared = {
    id,
    value,
    placeholder,
    "aria-invalid": problem ? true : undefined,
    "aria-describedby": note ? `${id}-note` : undefined,
    className: cn(input, multiline && "h-auto py-2", focusRing, "focus-visible:ring-offset-0"),
  };
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {multiline ? <textarea {...shared} rows={2} onChange={(event) => onChange(event.target.value)} /> : <input {...shared} type={type} onChange={(event) => onChange(event.target.value)} />}
      {note && (
        <p id={`${id}-note`} className={cn("text-xs", problem ? "text-destructive" : "text-muted-foreground")}>
          {note}
        </p>
      )}
    </div>
  );
}

function NumberField({ label, value, min, max, unit = "px", onChange }: { label: string; value: number; min: number; max: number; unit?: string; onChange: (value: number) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label} <span className="font-normal">({unit})</span>
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (event.target.value !== "" && Number.isFinite(next)) onChange(Math.min(max, Math.max(min, Math.round(next))));
        }}
        className={cn(input, focusRing, "focus-visible:ring-offset-0")}
      />
    </div>
  );
}

function RangeField({ label, value, min, max, step = 1, unit, onChange }: { label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (value: number) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex justify-between text-xs font-medium text-muted-foreground">
        {label}
        <span className="text-foreground tabular-nums">
          {value}
          {unit}
        </span>
      </label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} aria-valuetext={`${value}${unit}`} onChange={(event) => onChange(Number(event.target.value))} className={cn("accent-primary", focusRing)} />
    </div>
  );
}

function AlignField({ value, onChange }: { value: BuilderAlign; onChange: (value: BuilderAlign) => void }) {
  return (
    <SegmentedControl<BuilderAlign>
      label="Alignment"
      size="sm"
      fullWidth
      value={value}
      onValueChange={onChange}
      options={[
        { value: "left", label: "Left" },
        { value: "center", label: "Center" },
        { value: "right", label: "Right" },
      ]}
    />
  );
}

function SwitchField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Switch.Root checked={checked} onCheckedChange={onChange} className={cn(switchRoot, focusRing)}>
        <Switch.Thumb className={switchThumb} />
      </Switch.Root>
    </label>
  );
}

function linkProblem(value: string | undefined): string | null {
  return value && !safeLinkHref(value) ? "Use a web, mail or phone link (https://, mailto:, tel:)." : null;
}

interface PanelProps<T extends BuilderBlock> {
  block: T;
  /** `field` groups consecutive edits of one field into a single undo step. */
  onChange: (patch: BlockPatch<T>, field?: string) => void;
}

function HeadingSettings({ block, onChange, settings }: PanelProps<HeadingBlock> & { settings: BuilderSettings }) {
  return (
    <>
      <TextField label="Text" multiline value={block.text} onChange={(text) => onChange({ text }, "text")} />
      <SegmentedControl
        label="Size"
        size="sm"
        fullWidth
        value={String(block.level)}
        onValueChange={(level) => onChange({ level: Number(level) as HeadingBlock["level"] })}
        options={[
          { value: "1", label: "Large" },
          { value: "2", label: "Medium" },
          { value: "3", label: "Small" },
        ]}
      />
      <AlignField value={block.align} onChange={(align) => onChange({ align })} />
      <ColorPicker label="Color" value={block.color ?? settings.textColor} onValueChange={(color) => onChange({ color }, "color")} />
    </>
  );
}

function TextSettings({ block, onChange }: PanelProps<TextBlock>) {
  return <HtmlEditor compact value={block.html} onValueChange={(html) => onChange({ html }, "html")} aria-label="Text block content" height="14rem" title="text" />;
}

function ImageSettings({ block, onChange, onImageUpload, onStatus }: PanelProps<ImageBlock> & { onImageUpload: ((file: File) => Promise<string>) | undefined; onStatus: (message: string) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const upload = async (file: File) => {
    if (!onImageUpload) return;
    setUploading(true);
    onStatus(`Uploading ${file.name}…`);
    try {
      const src = safeImageSrc(await onImageUpload(file));
      if (!src) throw new Error("unsafe image URL");
      onChange({ src, alt: block.alt || file.name.replace(/\.[^.]+$/, "") });
      onStatus(`Uploaded ${file.name}`);
    } catch {
      onStatus(`Couldn't upload ${file.name}`);
    } finally {
      setUploading(false);
    }
  };
  return (
    <>
      <TextField label="Image URL" type="url" value={block.src} placeholder="https://example.com/photo.jpg" problem={block.src && !safeImageSrc(block.src) ? "Use an https:// image address or a data:image URI." : null} onChange={(src) => onChange({ src }, "src")} />
      {onImageUpload && (
        <>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void upload(file);
            }}
          />
          <button type="button" disabled={uploading} onClick={() => fileInput.current?.click()} className={cn(button, buttonVariants.outline, focusRing)}>
            <UploadIcon aria-hidden="true" />
            {uploading ? "Uploading…" : "Upload image"}
          </button>
        </>
      )}
      <TextField label="Description (alt text)" value={block.alt} hint="Read aloud by screen readers and shown when images are blocked." onChange={(alt) => onChange({ alt }, "alt")} />
      <TextField label="Link (optional)" type="url" value={block.href ?? ""} placeholder="https://example.com" problem={linkProblem(block.href)} onChange={(href) => onChange({ href }, "href")} />
      <RangeField label="Width" value={block.width} min={10} max={100} step={5} unit="%" onChange={(width) => onChange({ width }, "width")} />
      <AlignField value={block.align} onChange={(align) => onChange({ align })} />
    </>
  );
}

function ButtonSettings({ block, onChange }: PanelProps<ButtonBlock>) {
  const background = parseColor(block.background);
  const foreground = parseColor(block.color);
  const ratio = background && foreground ? contrastRatio(background, foreground) : null;
  return (
    <>
      <TextField label="Label" value={block.label} onChange={(label) => onChange({ label }, "label")} />
      <TextField label="Link" type="url" value={block.href} placeholder="https://example.com" problem={linkProblem(block.href)} onChange={(href) => onChange({ href }, "href")} />
      <AlignField value={block.align} onChange={(align) => onChange({ align })} />
      <SwitchField label="Full width" checked={block.fullWidth} onChange={(fullWidth) => onChange({ fullWidth })} />
      <div className="grid grid-cols-2 gap-2">
        <ColorPicker label="Button color" value={block.background} onValueChange={(value) => onChange({ background: value }, "background")} />
        <ColorPicker label="Text color" value={block.color} onValueChange={(value) => onChange({ color: value }, "color")} />
      </div>
      {ratio !== null && ratio < 4.5 && (
        <p className="text-xs text-destructive">
          Low contrast ({ratio.toFixed(1)}:1). Aim for 4.5:1 so the label stays readable.
        </p>
      )}
      <NumberField label="Corner radius" value={block.radius} min={0} max={40} onChange={(radius) => onChange({ radius }, "radius")} />
    </>
  );
}

function DividerSettings({ block, onChange }: PanelProps<DividerBlock>) {
  return (
    <>
      <ColorPicker label="Color" value={block.color} onValueChange={(color) => onChange({ color }, "color")} />
      <NumberField label="Thickness" value={block.thickness} min={1} max={12} onChange={(thickness) => onChange({ thickness }, "thickness")} />
    </>
  );
}

function SpacerSettings({ block, onChange }: PanelProps<SpacerBlock>) {
  return <RangeField label="Height" value={block.height} min={4} max={200} step={4} unit="px" onChange={(height) => onChange({ height }, "height")} />;
}

function SocialSettings({ block, onChange }: PanelProps<SocialBlock>) {
  const update = (index: number, patch: Partial<SocialBlock["links"][number]>) => onChange({ links: block.links.map((link, at) => (at === index ? { ...link, ...patch } : link)) }, `link-${index}`);
  return (
    <>
      <ul aria-label="Social links" className="flex flex-col gap-2">
        {block.links.map((link, index) => (
          <li key={link.id} className="flex flex-col gap-1 rounded-md border border-border p-2">
            <div className="flex items-center gap-2">
              <select aria-label={`Network for link ${index + 1}`} value={link.network} onChange={(event) => update(index, { network: event.target.value as SocialNetwork })} className={cn(input, "h-8 flex-1", focusRing)}>
                {(Object.keys(SOCIAL_LABELS) as SocialNetwork[]).map((network) => (
                  <option key={network} value={network}>
                    {SOCIAL_LABELS[network]}
                  </option>
                ))}
              </select>
              <button type="button" aria-label={`Remove ${SOCIAL_LABELS[link.network]} link`} onClick={() => onChange({ links: block.links.filter((_, at) => at !== index) })} className={cn(iconButton, focusRing)}>
                <Trash2Icon aria-hidden="true" />
              </button>
            </div>
            <TextField label={link.network === "email" ? "Email address" : "Profile URL"} value={link.url} problem={link.network === "email" ? null : linkProblem(link.url)} onChange={(url) => update(index, { url })} />
          </li>
        ))}
      </ul>
      <button type="button" disabled={block.links.length >= 12} onClick={() => onChange({ links: [...block.links, { id: newBuilderId("link"), network: "website", url: "https://" }] })} className={cn(button, buttonVariants.outline, focusRing)}>
        <PlusIcon aria-hidden="true" />
        Add link
      </button>
      <AlignField value={block.align} onChange={(align) => onChange({ align })} />
    </>
  );
}

function VideoSettings({ block, onChange, mode }: PanelProps<VideoBlock> & { mode: BuilderMode }) {
  const embed = block.url ? embedFromUrl(block.url) : null;
  return (
    <>
      <TextField
        label="Video link"
        type="url"
        value={block.url}
        placeholder="https://www.youtube.com/watch?v=…"
        problem={block.url && !embed ? "Use a YouTube, Vimeo or Loom link, or an https:// link to an .mp4 or .webm file." : null}
        hint={mode === "email" ? "Email can't play video: YouTube shows its thumbnail, others a link." : `${embed?.provider ?? "YouTube, Vimeo or Loom"} player.`}
        onChange={(url) => onChange({ url }, "url")}
      />
      <TextField label="Title" value={block.title} hint="Names the player for screen readers." onChange={(title) => onChange({ title }, "title")} />
    </>
  );
}

function ColumnsSettings({ block, onChange }: PanelProps<ColumnsBlock>) {
  return (
    <>
      <SegmentedControl
        label="Columns"
        size="sm"
        fullWidth
        value={String(block.columns.length)}
        onValueChange={(count) => onChange({ columns: setColumnCount(block, Number(count)).columns })}
        options={[
          { value: "2", label: "Two" },
          { value: "3", label: "Three" },
        ]}
      />
      <NumberField label="Gap" value={block.gap} min={0} max={64} onChange={(gap) => onChange({ gap }, "gap")} />
      <p className="text-xs text-muted-foreground">Columns stack on narrow screens. Drag blocks into a column, or select a block in it and add after it.</p>
    </>
  );
}

function SectionSettings({ block, onChange }: PanelProps<SectionBlock>) {
  return (
    <>
      <ColorPicker label="Background" value={block.background} onValueChange={(background) => onChange({ background }, "background")} />
      <NumberField label="Padding" value={block.padding} min={0} max={96} onChange={(padding) => onChange({ padding }, "padding")} />
    </>
  );
}

export interface BlockSettingsProps {
  block: BuilderBlock;
  settings: BuilderSettings;
  mode: BuilderMode;
  onChange: (patch: BuilderBlockPatch, field?: string) => void;
  onImageUpload: ((file: File) => Promise<string>) | undefined;
  onStatus: (message: string) => void;
}

/** The settings for one selected block. */
export function BlockSettings({ block, settings, mode, onChange, onImageUpload, onStatus }: BlockSettingsProps) {
  let body: ReactNode;
  switch (block.type) {
    case "heading":
      body = <HeadingSettings block={block} onChange={onChange} settings={settings} />;
      break;
    case "text":
      body = <TextSettings block={block} onChange={onChange} />;
      break;
    case "image":
      body = <ImageSettings block={block} onChange={onChange} onImageUpload={onImageUpload} onStatus={onStatus} />;
      break;
    case "button":
      body = <ButtonSettings block={block} onChange={onChange} />;
      break;
    case "divider":
      body = <DividerSettings block={block} onChange={onChange} />;
      break;
    case "spacer":
      body = <SpacerSettings block={block} onChange={onChange} />;
      break;
    case "social":
      body = <SocialSettings block={block} onChange={onChange} />;
      break;
    case "video":
      body = <VideoSettings block={block} onChange={onChange} mode={mode} />;
      break;
    case "columns":
      body = <ColumnsSettings block={block} onChange={onChange} />;
      break;
    case "section":
      body = <SectionSettings block={block} onChange={onChange} />;
      break;
  }
  return <div className="flex flex-col gap-3">{body}</div>;
}

/** Document-wide settings, shown when no block is selected. */
export function DocumentSettings({ doc, mode, onChange }: { doc: BuilderDocument; mode: BuilderMode; onChange: (patch: BuilderDocumentPatch, field?: string) => void }) {
  const fontId = useId();
  const { settings } = doc;
  const setting = (patch: Partial<BuilderSettings>, field?: string) => onChange({ settings: patch }, field);
  const fonts = DEFAULT_HTML_FONTS.some((font) => font.value === settings.fontFamily) ? DEFAULT_HTML_FONTS : [{ label: settings.fontFamily.split(",")[0]!.replace(/["']/g, ""), value: settings.fontFamily }, ...DEFAULT_HTML_FONTS];
  return (
    <div className="flex flex-col gap-3">
      <TextField label={mode === "email" ? "Subject or title" : "Page title"} value={doc.title} onChange={(title) => onChange({ title }, "title")} />
      {mode === "email" && <TextField label="Preview text" value={doc.preheader} hint="Shown after the subject line in most inboxes." onChange={(preheader) => onChange({ preheader }, "preheader")} />}
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Content width" value={settings.width} min={320} max={1400} onChange={(width) => setting({ width }, "width")} />
        <NumberField label="Side padding" value={settings.padding} min={0} max={96} onChange={(padding) => setting({ padding }, "padding")} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={fontId} className="text-xs font-medium text-muted-foreground">
          Font
        </label>
        <select id={fontId} value={settings.fontFamily} onChange={(event) => setting({ fontFamily: event.target.value })} className={cn(input, focusRing)}>
          {fonts.map((font) => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <ColorPicker label="Background" value={settings.background} onValueChange={(background) => setting({ background }, "background")} />
        <ColorPicker label="Content" value={settings.contentBackground} onValueChange={(contentBackground) => setting({ contentBackground }, "contentBackground")} />
        <ColorPicker label="Text" value={settings.textColor} onValueChange={(textColor) => setting({ textColor }, "textColor")} />
        <ColorPicker label="Links" value={settings.linkColor} onValueChange={(linkColor) => setting({ linkColor }, "linkColor")} />
      </div>
    </div>
  );
}
