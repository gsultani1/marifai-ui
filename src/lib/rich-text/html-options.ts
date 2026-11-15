// packages/ai-ui/src/lib/rich-text/html-options.ts
export interface HtmlFontOption {
  label: string;
  /** A CSS font-family list. */
  value: string;
}

/** Web- and email-safe font stacks for HtmlEditor's font menu. */
export const DEFAULT_HTML_FONTS: HtmlFontOption[] = [
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', Helvetica, sans-serif" },
  { label: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
  { label: "Courier New", value: "'Courier New', Courier, monospace" },
  { label: "System UI", value: "system-ui, sans-serif" },
];

/** Font sizes in pixels for HtmlEditor's size menu. */
export const DEFAULT_HTML_FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48];

/** Swatches for HtmlEditor's text and highlight color menus. */
export const DEFAULT_HTML_COLORS = [
  "#000000",
  "#434343",
  "#666666",
  "#999999",
  "#d9d9d9",
  "#ffffff",
  "#b91c1c",
  "#c2410c",
  "#a16207",
  "#15803d",
  "#0f766e",
  "#1d4ed8",
  "#6d28d9",
  "#be185d",
  "#fee2e2",
  "#ffedd5",
  "#fef9c3",
  "#dcfce7",
  "#dbeafe",
  "#f3e8ff",
];
