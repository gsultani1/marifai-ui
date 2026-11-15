// packages/ai-ui/src/components/context-chips.tsx
"use client";

import { BracesIcon, FileIcon, FileTextIcon, FolderIcon, ImageIcon, LinkIcon, SquareDashedMousePointerIcon, StickyNoteIcon, TextSelectIcon, XIcon } from "lucide-react";
import { type ReactNode, useId } from "react";

import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { type InspectedElement, inspectedElementName } from "../lib/preview-inspector.js";

export type ContextKind = "file" | "folder" | "url" | "selection" | "image" | "document" | "symbol" | "note" | "element";

export interface ContextItem {
  id: string;
  label: string;
  kind?: ContextKind;
  /** Short qualifier such as a line range ("L10–24") or a size. */
  detail?: string;
  /** Full path or URL, shown on hover. */
  title?: string;
  icon?: ReactNode;
}

export interface ContextChipsProps {
  items: ContextItem[];
  /** Makes chips removable; omit for context frozen on a sent message. */
  onRemove?: (id: string) => void;
  onOpen?: (item: ContextItem) => void;
  label?: string;
  className?: string;
}

const ICONS: Record<ContextKind, ReactNode> = {
  file: <FileTextIcon aria-hidden="true" />,
  folder: <FolderIcon aria-hidden="true" />,
  url: <LinkIcon aria-hidden="true" />,
  selection: <TextSelectIcon aria-hidden="true" />,
  image: <ImageIcon aria-hidden="true" />,
  document: <FileIcon aria-hidden="true" />,
  symbol: <BracesIcon aria-hidden="true" />,
  note: <StickyNoteIcon aria-hidden="true" />,
  element: <SquareDashedMousePointerIcon aria-hidden="true" />,
};

/** A context chip for an element picked in a preview: its tag, id and first class, with its text as the detail. */
export function inspectedElementToContext(element: InspectedElement): ContextItem {
  const text = element.text.length > 24 ? `${element.text.slice(0, 24)}…` : element.text;
  return {
    id: `element:${element.path}:${element.selector}`,
    label: `<${inspectedElementName(element)}>`,
    kind: "element",
    ...(text ? { detail: `"${text}"` } : {}),
    title: element.path ? `${element.selector} on ${element.path}` : element.selector,
  };
}

/**
 * Files, links, selections and other context attached to a prompt, as chips
 * with an icon per kind and an optional line range. Removing a chip moves
 * focus to the next one so keyboard users don't lose their place.
 */
export function ContextChips({ items, onRemove, onOpen, label = "Context", className }: ContextChipsProps) {
  const id = useId();
  if (items.length === 0) return null;

  const remove = (index: number) => {
    const item = items[index]!;
    onRemove?.(item.id);
    const target = items[index + 1] ?? items[index - 1];
    requestAnimationFrame(() => (target ? document.getElementById(`${id}-remove-${target.id}`) : null)?.focus());
  };

  return (
    <ul aria-label={label} data-slot="context-chips" className={cn("flex flex-wrap gap-1.5", className)}>
      {items.map((item, index) => {
        const content = (
          <>
            <span className="flex shrink-0 text-muted-foreground [&_svg]:size-3.5">{item.icon ?? ICONS[item.kind ?? "file"]}</span>
            <span className="max-w-48 truncate">{item.label}</span>
            {item.detail && <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{item.detail}</span>}
          </>
        );
        return (
          <li key={item.id} title={item.title ?? item.label} className="flex h-7 max-w-full items-center gap-1 rounded-md border border-border bg-muted/50 pr-0.5 pl-2 text-xs">
            {onOpen ? (
              <button type="button" onClick={() => onOpen(item)} className={cn("flex min-w-0 items-center gap-1.5 rounded-sm hover:underline", focusRing)}>
                {content}
              </button>
            ) : (
              <span className="flex min-w-0 items-center gap-1.5">{content}</span>
            )}
            {onRemove ? (
              <button type="button" id={`${id}-remove-${item.id}`} aria-label={`Remove ${item.label}${item.detail ? ` ${item.detail}` : ""}`} onClick={() => remove(index)} className={cn("flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-background hover:text-foreground", focusRing)}>
                <XIcon aria-hidden="true" className="size-3" />
              </button>
            ) : (
              <span className="w-1.5" />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export interface SelectedElementChipProps {
  element: InspectedElement;
  onRemove?: () => void;
  className?: string;
}

/** The element picked in a preview, shown as a context chip above the composer. */
export function SelectedElementChip({ element, onRemove, className }: SelectedElementChipProps) {
  return <ContextChips items={[inspectedElementToContext(element)]} label="Selected element" {...(onRemove ? { onRemove: () => onRemove() } : {})} {...(className ? { className } : {})} />;
}
