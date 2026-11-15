// packages/ai-ui/src/lib/codemirror.ts
import { HighlightStyle, LanguageDescription, type LanguageSupport, syntaxHighlighting } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { Annotation, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

const MONO = "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)";

/** Marks transactions that sync an externally supplied value, so they are not echoed back. */
export const externalChange = Annotation.define<boolean>();

const theme = EditorView.theme({
  "&": {
    height: "100%",
    color: "var(--code-foreground)",
    backgroundColor: "var(--code-background)",
    fontSize: "0.875rem",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: MONO, lineHeight: "1.5rem" },
  ".cm-content": { caretColor: "var(--foreground)", padding: "0.75rem 0" },
  ".cm-line": { padding: "0 0.75rem", color: "var(--code-foreground) !important" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--foreground)" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
    { backgroundColor: "color-mix(in oklab, var(--ring) 35%, transparent)" },
  ".cm-activeLine": { backgroundColor: "color-mix(in oklab, var(--accent) 60%, transparent)" },
  ".cm-gutters": { backgroundColor: "var(--code-background)", color: "var(--muted-foreground)", border: "none" },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--foreground)" },
  ".cm-foldPlaceholder": { backgroundColor: "var(--muted)", border: "none", color: "var(--muted-foreground)" },
  ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
    backgroundColor: "color-mix(in oklab, var(--ring) 25%, transparent)",
  },
  ".cm-searchMatch": { backgroundColor: "color-mix(in oklab, var(--warning) 30%, transparent)" },
  ".cm-placeholder": { color: "var(--muted-foreground)" },
  ".cm-tooltip, .cm-panels": {
    backgroundColor: "var(--popover)",
    color: "var(--popover-foreground)",
    border: "1px solid var(--border)",
    borderRadius: "0.5rem",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--accent)",
    color: "var(--accent-foreground)",
  },
  ".cm-panels input, .cm-panels button": { fontFamily: "inherit" },
});

const highlightStyle = HighlightStyle.define([
  { tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment], color: "var(--code-comment)", fontStyle: "italic" },
  {
    tag: [tags.keyword, tags.controlKeyword, tags.operatorKeyword, tags.definitionKeyword, tags.moduleKeyword, tags.modifier, tags.self],
    color: "var(--code-keyword)",
  },
  { tag: [tags.string, tags.special(tags.string), tags.regexp, tags.character, tags.escape], color: "var(--code-string)" },
  { tag: [tags.number, tags.bool, tags.null, tags.atom, tags.unit], color: "var(--code-number)" },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.function(tags.definition(tags.variableName))],
    color: "var(--code-function)",
  },
  { tag: [tags.typeName, tags.className, tags.namespace, tags.standard(tags.variableName)], color: "var(--code-type)" },
  { tag: [tags.propertyName, tags.attributeName], color: "var(--code-property)" },
  { tag: [tags.tagName, tags.angleBracket], color: "var(--code-tag)" },
  { tag: [tags.meta, tags.processingInstruction, tags.annotation], color: "var(--code-meta)" },
  { tag: [tags.operator, tags.punctuation, tags.bracket, tags.separator], color: "var(--code-punctuation)" },
  { tag: tags.inserted, color: "var(--code-inserted)" },
  { tag: tags.deleted, color: "var(--code-deleted)" },
  { tag: tags.heading, color: "var(--code-function)", fontWeight: "600" },
  { tag: tags.quote, color: "var(--code-comment)" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "600" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: [tags.link, tags.url], color: "var(--code-string)" },
  { tag: tags.monospace, color: "var(--code-string)" },
  { tag: tags.invalid, color: "var(--destructive)" },
]);

export const editorAppearance: Extension = [theme, syntaxHighlighting(highlightStyle)];

export { languages };

/** Resolves a language name, alias or file extension through @codemirror/language-data and loads it on demand. */
export async function loadLanguage(name: string | undefined): Promise<LanguageSupport | null> {
  if (!name) return null;
  const description =
    LanguageDescription.matchLanguageName(languages, name, true) ??
    LanguageDescription.matchFilename(languages, `file.${name}`);
  return description ? description.load() : null;
}
