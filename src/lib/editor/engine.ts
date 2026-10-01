import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from "@codemirror/autocomplete";
import {
  defaultKeymap,
  history,
  indentLess,
  indentMore,
  indentWithTab,
  redo,
  selectAll,
  toggleComment,
  undo,
  copyLineDown,
  deleteLine,
  deleteTrailingWhitespace,
} from "@codemirror/commands";
import {
  bracketMatching,
  codeFolding,
  foldAll,
  foldGutter,
  foldKeymap,
  indentOnInput,
  indentUnit,
  unfoldAll,
} from "@codemirror/language";
import {
  SearchQuery,
  findNext,
  findPrevious,
  getSearchQuery,
  highlightSelectionMatches,
  replaceAll,
  replaceNext,
  search,
  selectNextOccurrence,
  selectSelectionMatches,
  setSearchQuery,
} from "@codemirror/search";
import { Compartment, EditorSelection, EditorState, countColumn, type Extension } from "@codemirror/state";
import {
  EditorView,
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  highlightTrailingWhitespace,
  highlightWhitespace,
  keymap,
  lineNumbers,
  placeholder,
  rectangularSelection,
} from "@codemirror/view";
import { extensionFor } from "@/lib/editor/languages";
import { chromeTheme, fontTheme, syntaxTheme } from "@/lib/editor/theme";
import { EMPTY_STATS, type Stats } from "@/lib/editor/types";
import { contents, noteEdit, patchSettings, useStore } from "@/lib/editor/store";

const languageConf = new Compartment();
const wrapConf = new Compartment();
const whitespaceConf = new Compartment();
const fontConf = new Compartment();
const chromeConf = new Compartment();
const tabConf = new Compartment();

const states = new Map<string, EditorState>();
let view: EditorView | null = null;
let active: string | null = null;
let focusOnNext = false;

const statsListeners = new Set<(stats: Stats) => void>();
let statsFrame = 0;

export type QueryOpts = {
  search: string;
  replace: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  regexp: boolean;
};

function settings() {
  return useStore.getState().settings;
}

function wrapExtension(): Extension {
  return settings().wordWrap ? EditorView.lineWrapping : [];
}

function whitespaceExtension(): Extension {
  return settings().showWhitespace ? [highlightWhitespace(), highlightTrailingWhitespace()] : [];
}

function tabExtension(): Extension {
  const { tabSize, insertSpaces } = settings();
  const size = tabSize === 2 || tabSize === 8 ? tabSize : 4;
  return [EditorState.tabSize.of(size), indentUnit.of(insertSpaces ? " ".repeat(size) : "\t")];
}

function settingEffects() {
  return [
    wrapConf.reconfigure(wrapExtension()),
    whitespaceConf.reconfigure(whitespaceExtension()),
    fontConf.reconfigure(fontTheme(settings().fontSize)),
    chromeConf.reconfigure(chromeTheme(settings().theme === "dark")),
    tabConf.reconfigure(tabExtension()),
  ];
}

function computeStats(state: EditorState): Stats {
  const head = state.selection.main.head;
  const line = state.doc.lineAt(head);
  const tabSize = state.tabSize;
  let selChars = 0;
  let selLines = 0;
  for (const range of state.selection.ranges) {
    selChars += range.to - range.from;
    if (!range.empty) {
      selLines += state.doc.lineAt(range.to).number - state.doc.lineAt(range.from).number;
    }
  }
  return {
    line: line.number,
    col: countColumn(line.text, tabSize, head - line.from) + 1,
    selChars,
    selLines,
    length: state.doc.length,
    lines: state.doc.lines,
  };
}

function emitStats() {
  if (statsFrame) return;
  statsFrame = requestAnimationFrame(() => {
    statsFrame = 0;
    const stats = view ? computeStats(view.state) : EMPTY_STATS;
    for (const fn of statsListeners) fn(stats);
  });
}

export function subscribeStats(fn: (stats: Stats) => void) {
  statsListeners.add(fn);
  return () => {
    statsListeners.delete(fn);
  };
}

export function currentStats(): Stats {
  return view ? computeStats(view.state) : EMPTY_STATS;
}

function buildExtensions(languageId: string): Extension {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches({ minSelectionLength: 2 }),
    syntaxTheme,
    codeFolding(),
    search({ top: true }),
    keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...foldKeymap, ...completionKeymap, indentWithTab]),
    placeholder("Start typing, or drop a file here."),
    EditorView.contentAttributes.of({ "aria-label": "Document editor", spellcheck: "false" }),
    languageConf.of(extensionFor(languageId)),
    wrapConf.of(wrapExtension()),
    whitespaceConf.of(whitespaceExtension()),
    fontConf.of(fontTheme(settings().fontSize)),
    chromeConf.of(chromeTheme(settings().theme === "dark")),
    tabConf.of(tabExtension()),
    EditorView.domEventHandlers({
      wheel(event) {
        if (!event.ctrlKey && !event.metaKey) return false;
        const current = settings().fontSize;
        const next = Math.min(24, Math.max(11, current + (event.deltaY < 0 ? 1 : -1)));
        if (next !== current) {
          patchSettings({ fontSize: next });
          applySettings();
        }
        return true;
      },
    }),
    EditorView.updateListener.of((update) => {
      if (!active) return;
      if (update.docChanged) {
        const text = update.state.doc.toString();
        if (contents.get(active) !== text) noteEdit(active, text);
      }
      if (update.docChanged || update.selectionSet) emitStats();
      states.set(active, update.state);
    }),
  ];
}

function ensureState(id: string): EditorState {
  const existing = states.get(id);
  if (existing) return existing;
  const doc = useStore.getState().docs.find((item) => item.id === id);
  const state = EditorState.create({
    doc: contents.get(id) ?? "",
    extensions: buildExtensions(doc?.language ?? "text"),
  });
  states.set(id, state);
  return state;
}

export function attach(parent: HTMLElement) {
  const id = useStore.getState().activeId;
  if (!id) return;
  active = id;
  const state = ensureState(id);
  if (!view) {
    view = new EditorView({ parent, state });
  } else {
    if (view.dom.parentElement !== parent) parent.appendChild(view.dom);
    if (view.state !== state) view.setState(state);
  }
  emitStats();
  if (focusOnNext) {
    focusOnNext = false;
    view.focus();
  }
}

export function detach() {
  if (view && active) {
    states.set(active, view.state);
    const text = view.state.doc.toString();
    if (contents.get(active) !== text) contents.set(active, text);
  }
  view?.destroy();
  view = null;
}

export function discardDraftStates() {
  states.clear();
  active = null;
}

export function requestFocus() {
  focusOnNext = true;
}

export function focus() {
  view?.focus();
}

export function activate(id: string) {
  if (!id) {
    active = null;
    return;
  }
  if (view && active && active !== id) {
    states.set(active, view.state);
    const text = view.state.doc.toString();
    if (contents.has(active)) contents.set(active, text);
  }
  active = id;
  const state = ensureState(id);
  if (view && view.state !== state) view.setState(state);
  emitStats();
  if (focusOnNext) {
    focusOnNext = false;
    view?.focus();
  }
}

export function forget(id: string) {
  states.delete(id);
  if (active === id) active = null;
}

export function applySettings() {
  const effects = settingEffects();
  const current = active;
  for (const [id, state] of states) {
    if (id === current && view) continue;
    states.set(id, state.update({ effects }).state);
  }
  if (view && current) {
    view.dispatch({ effects });
    states.set(current, view.state);
  }
}

export function setLanguage(id: string, languageId: string) {
  const effect = languageConf.reconfigure(extensionFor(languageId));
  if (view && active === id) {
    view.dispatch({ effects: effect });
    states.set(id, view.state);
    return;
  }
  const state = states.get(id);
  if (state) states.set(id, state.update({ effects: effect }).state);
}

export function getContent(id: string): string {
  if (view && active === id) return view.state.doc.toString();
  return contents.get(id) ?? "";
}

export function selectedSnippet(): string {
  if (!view) return "";
  const range = view.state.selection.main;
  if (range.empty) return "";
  const text = view.state.sliceDoc(range.from, range.to);
  if (text.includes("\n") || text.length > 200) return "";
  return text;
}

export function applyQuery(opts: QueryOpts | null): { count: number; error: string | null } {
  if (!view) return { count: 0, error: null };
  if (!opts || !opts.search) {
    view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: "" })) });
    return { count: 0, error: null };
  }
  const query = new SearchQuery({
    search: opts.search,
    replace: opts.replace,
    caseSensitive: opts.caseSensitive,
    wholeWord: opts.wholeWord,
    regexp: opts.regexp,
    literal: false,
  });
  view.dispatch({ effects: setSearchQuery.of(query) });
  if (!query.valid) {
    return { count: 0, error: opts.regexp ? "Invalid regular expression" : null };
  }
  return { count: countQuery(query), error: null };
}

function countQuery(query: SearchQuery): number {
  if (!view) return 0;
  const iter = query.getCursor(view.state);
  let count = 0;
  for (;;) {
    const step = iter.next();
    if (step.done) break;
    count += 1;
    if (count > 5000) break;
  }
  return count;
}

export function countMatches(): number {
  if (!view) return 0;
  const query = getSearchQuery(view.state);
  if (!query.search || !query.valid) return 0;
  return countQuery(query);
}

export function findMatch(reverse = false) {
  if (!view) return;
  if (reverse) findPrevious(view);
  else findNext(view);
  view.focus();
}

export function replaceOne() {
  if (!view) return;
  replaceNext(view);
}

export function replaceEvery(): number {
  if (!view) return 0;
  const count = countMatches();
  replaceAll(view);
  return count;
}

export function gotoSpec(spec: string): boolean {
  if (!view) return false;
  const text = spec.trim();
  const relative = /^([+-])(\d+)$/.exec(text);
  if (relative) {
    const current = view.state.doc.lineAt(view.state.selection.main.head).number;
    const delta = Number(relative[2]);
    gotoLine(relative[1] === "+" ? current + delta : current - delta, 1);
    return true;
  }
  const percent = /^(\d+(?:\.\d+)?)%$/.exec(text);
  if (percent) {
    const line = Math.max(1, Math.round((Number(percent[1]) / 100) * view.state.doc.lines));
    gotoLine(line, 1);
    return true;
  }
  const match = /^(\d+)(?::(\d+))?$/.exec(text);
  if (!match) return false;
  gotoLine(Number(match[1]), match[2] ? Number(match[2]) : 1);
  return true;
}

export function gotoLine(line: number, column = 1) {
  if (!view) return;
  const doc = view.state.doc;
  const clamped = Math.max(1, Math.min(doc.lines, Math.floor(line) || 1));
  const row = doc.line(clamped);
  const col = Math.max(1, column);
  const offset = Math.min(row.text.length, Math.max(0, col - 1));
  const pos = Math.min(row.to, row.from + offset);
  view.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
  view.focus();
}

function replaceLines(mapLine: (line: string) => string) {
  if (!view) return;
  const doc = view.state.doc;
  const changes: { from: number; to: number; insert: string }[] = [];
  for (let n = 1; n <= doc.lines; n += 1) {
    const line = doc.line(n);
    const next = mapLine(line.text);
    if (next !== line.text) changes.push({ from: line.from, to: line.to, insert: next });
  }
  if (changes.length) view.dispatch({ changes });
}

function changeCase(upper: boolean) {
  if (!view) return;
  const state = view.state;
  view.dispatch(
    state.changeByRange((range) => {
      let from = range.from;
      let to = range.to;
      if (from === to) {
        const line = state.doc.lineAt(from);
        from = line.from;
        to = line.to;
      }
      const text = state.doc.sliceString(from, to);
      const next = upper ? text.toUpperCase() : text.toLowerCase();
      return {
        changes: { from, to, insert: next },
        range: EditorSelection.range(from, from + next.length),
      };
    }),
  );
}

function sortLines() {
  if (!view) return;
  const state = view.state;
  const sel = state.selection.main;
  const fromLine = sel.empty ? 1 : state.doc.lineAt(sel.from).number;
  const toLine = sel.empty ? state.doc.lines : state.doc.lineAt(sel.to).number;
  const lines: string[] = [];
  for (let n = fromLine; n <= toLine; n += 1) lines.push(state.doc.line(n).text);
  lines.sort((a, b) => a.localeCompare(b));
  const start = state.doc.line(fromLine).from;
  const end = state.doc.line(toLine).to;
  view.dispatch({ changes: { from: start, to: end, insert: lines.join("\n") } });
}

export type EditCommand =
  | "undo"
  | "redo"
  | "duplicate"
  | "comment"
  | "indent"
  | "outdent"
  | "upper"
  | "lower"
  | "trim"
  | "tabsToSpaces"
  | "spacesToTabs"
  | "sort"
  | "selectAll"
  | "selectMatches"
  | "selectNext"
  | "foldAll"
  | "unfoldAll"
  | "deleteLine";

export function runEdit(command: EditCommand) {
  if (!view) return;
  const size = settings().tabSize === 2 || settings().tabSize === 8 ? settings().tabSize : 4;
  switch (command) {
    case "undo":
      undo(view);
      break;
    case "redo":
      redo(view);
      break;
    case "duplicate":
      copyLineDown(view);
      break;
    case "comment":
      toggleComment(view);
      break;
    case "indent":
      indentMore(view);
      break;
    case "outdent":
      indentLess(view);
      break;
    case "upper":
      changeCase(true);
      break;
    case "lower":
      changeCase(false);
      break;
    case "trim":
      deleteTrailingWhitespace(view);
      break;
    case "tabsToSpaces":
      replaceLines((line) => line.replace(/\t/g, " ".repeat(size)));
      break;
    case "spacesToTabs":
      replaceLines((line) => line.replace(new RegExp(` {${size}}`, "g"), "\t"));
      break;
    case "sort":
      sortLines();
      break;
    case "selectAll":
      selectAll(view);
      break;
    case "selectMatches":
      selectSelectionMatches(view);
      break;
    case "selectNext":
      selectNextOccurrence(view);
      break;
    case "foldAll":
      foldAll(view);
      break;
    case "unfoldAll":
      unfoldAll(view);
      break;
    case "deleteLine":
      deleteLine(view);
      break;
    default:
      break;
  }
  view.focus();
}

export async function pasteFromClipboard() {
  if (!view) return false;
  try {
    const text = await navigator.clipboard.readText();
    const current = view;
    if (!current) return false;
    current.focus();
    current.dispatch(current.state.replaceSelection(text));
    return true;
  } catch {
    return false;
  }
}

export function editClipboard(action: "cut" | "copy") {
  if (!view) return false;
  view.focus();
  return document.execCommand(action);
}
