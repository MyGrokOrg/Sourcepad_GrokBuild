import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

export const highlightStyle = HighlightStyle.define([
  { tag: [t.keyword, t.modifier, t.operatorKeyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword], color: "var(--syn-keyword)" },
  { tag: [t.string, t.special(t.string), t.regexp, t.character, t.docString], color: "var(--syn-string)" },
  { tag: [t.number, t.integer, t.float, t.bool, t.atom, t.null, t.self], color: "var(--syn-number)" },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: "var(--syn-comment)", fontStyle: "italic" },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.labelName, t.function(t.definition(t.variableName))], color: "var(--syn-fn)" },
  { tag: [t.typeName, t.className, t.namespace, t.standard(t.typeName)], color: "var(--syn-type)" },
  { tag: [t.propertyName, t.attributeName, t.macroName, t.annotation], color: "var(--syn-prop)" },
  { tag: [t.variableName, t.name, t.definition(t.variableName)], color: "var(--syn-fg)" },
  { tag: [t.operator, t.punctuation, t.bracket, t.separator], color: "var(--syn-fg)" },
  { tag: [t.tagName, t.standard(t.tagName)], color: "var(--syn-keyword)" },
  { tag: [t.heading, t.heading1, t.heading2, t.heading3], color: "var(--syn-keyword)", fontWeight: "600" },
  { tag: [t.link, t.url], color: "var(--syn-fn)", textDecoration: "underline" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.invalid, color: "var(--color-danger)" },
  { tag: [t.meta, t.processingInstruction, t.documentMeta], color: "var(--color-muted)" },
  { tag: t.inserted, color: "var(--syn-keyword)" },
  { tag: t.deleted, color: "var(--color-danger)" },
]);

export const syntaxTheme = syntaxHighlighting(highlightStyle);

const chrome: Record<string, Record<string, string>> = {
  "&": {
    color: "var(--color-fg)",
    backgroundColor: "var(--color-editor)",
    height: "100%",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-content": {
    fontFamily: "var(--font-mono)",
    caretColor: "var(--color-primary)",
    padding: "8px 0 48px",
  },
  ".cm-line": { padding: "0 12px 0 2px" },
  ".cm-gutters": {
    backgroundColor: "var(--color-editor)",
    color: "var(--color-muted)",
    borderRight: "1px solid var(--color-border)",
    fontFamily: "var(--font-mono)",
  },
  ".cm-activeLineGutter": {
    color: "var(--color-fg)",
    backgroundColor: "transparent",
  },
  ".cm-activeLine": {
    backgroundColor: "color-mix(in srgb, var(--color-fg) 5%, transparent)",
  },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--color-primary)" },
  ".cm-selectionBackground": {
    backgroundColor: "color-mix(in srgb, var(--color-primary) 32%, transparent)",
  },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
    backgroundColor: "color-mix(in srgb, var(--color-primary) 38%, transparent)",
  },
  ".cm-matchingBracket": {
    backgroundColor: "color-mix(in srgb, var(--color-primary) 28%, transparent)",
    outline: "1px solid var(--color-primary)",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "var(--color-elevated)",
    border: "none",
    color: "var(--color-muted)",
    padding: "0 6px",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--color-elevated)",
    color: "var(--color-fg)",
    border: "1px solid var(--color-border)",
    borderRadius: "6px",
  },
  ".cm-tooltip-autocomplete": { fontFamily: "var(--font-mono)" },
  ".cm-panels": {
    backgroundColor: "var(--color-surface)",
    color: "var(--color-fg)",
  },
  ".cm-placeholder": { color: "var(--color-faint)" },
  ".cm-lintRange-error": { backgroundImage: "none", textDecoration: "underline wavy var(--color-danger)" },
};

export function chromeTheme(dark: boolean): Extension {
  return EditorView.theme(chrome, { dark });
}

export function fontTheme(size: number): Extension {
  const px = `${size}px`;
  return EditorView.theme({
    ".cm-content": { fontSize: px },
    ".cm-gutters": { fontSize: px },
  });
}
