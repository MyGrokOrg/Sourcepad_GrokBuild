import { BLEND_JSON, EXAMPLE_PY, README_MD } from "@/lib/editor/samples";
import { readSession, writeSession, type Session } from "@/lib/editor/session";
import type { Doc, Eol, Settings, ThemeName } from "@/lib/editor/types";
import { create } from "zustand";

export const contents = new Map<string, string>();

export type FileHandle = {
  name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }>;
};

export const handles = new Map<string, FileHandle>();

export const defaultSettings: Settings = {
  theme: "dark",
  wordWrap: false,
  showWhitespace: false,
  tabSize: 4,
  insertSpaces: true,
  fontSize: 14,
  showFunctions: false,
};

const STARTER_DOCS: Doc[] = [
  { id: "example-py", name: "example.py", language: "python", eol: "lf", dirty: false },
  { id: "readme", name: "README.md", language: "markdown", eol: "lf", dirty: false },
  { id: "blend-json", name: "blend.json", language: "json", eol: "lf", dirty: false },
];

function seedStarters() {
  contents.set("example-py", EXAMPLE_PY);
  contents.set("readme", README_MD);
  contents.set("blend-json", BLEND_JSON);
}

seedStarters();

type Store = {
  booted: boolean;
  docs: Doc[];
  activeId: string;
  settings: Settings;
  toast: string | null;
};

export const useStore = create<Store>(() => ({
  booted: false,
  docs: STARTER_DOCS,
  activeId: "example-py",
  settings: defaultSettings,
  toast: null,
}));

const contentListeners = new Set<() => void>();

export function subscribeContent(fn: () => void) {
  contentListeners.add(fn);
  return () => {
    contentListeners.delete(fn);
  };
}

function emitContent() {
  for (const fn of contentListeners) fn();
}

let toastTimer = 0;
let quotaWarned = false;
let persistTimer = 0;

export function showToast(text: string) {
  if (typeof window === "undefined") return;
  window.clearTimeout(toastTimer);
  useStore.setState({ toast: text });
  toastTimer = window.setTimeout(() => useStore.setState({ toast: null }), 2400);
}

export function applyTheme(theme: ThemeName) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", theme === "dark" ? "#121418" : "#e4e7ec");
}

export function flushPersist() {
  const state = useStore.getState();
  if (!state.booted) return;
  const session: Session = {
    v: 1,
    activeId: state.activeId,
    settings: state.settings,
    docs: state.docs.map((doc) => ({
      id: doc.id,
      name: doc.name,
      language: doc.language,
      eol: doc.eol,
      content: contents.get(doc.id) ?? "",
    })),
  };
  const ok = writeSession(session);
  if (!ok && !quotaWarned) {
    quotaWarned = true;
    showToast("Session is too large to keep after refresh");
  }
}

export function schedulePersist() {
  if (typeof window === "undefined") return;
  window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(flushPersist, 400);
}

export function noteEdit(id: string, text: string) {
  const prev = contents.get(id);
  if (prev === text) return;
  contents.set(id, text);
  const { docs } = useStore.getState();
  const doc = docs.find((item) => item.id === id);
  if (doc && !doc.dirty) {
    useStore.setState({
      docs: docs.map((item) => (item.id === id ? { ...item, dirty: true } : item)),
    });
  }
  emitContent();
  schedulePersist();
}

export function patchSettings(patch: Partial<Settings>) {
  useStore.setState((state) => ({ settings: { ...state.settings, ...patch } }));
  if (patch.theme) applyTheme(patch.theme);
  schedulePersist();
}

export function updateDoc(id: string, patch: Partial<Pick<Doc, "name" | "language" | "eol" | "dirty">>) {
  useStore.setState((state) => ({
    docs: state.docs.map((doc) => (doc.id === id ? { ...doc, ...patch } : doc)),
  }));
  schedulePersist();
}

export function setActive(id: string) {
  useStore.setState({ activeId: id });
  schedulePersist();
}

export function insertDoc(doc: Doc, content: string, handle?: FileHandle) {
  contents.set(doc.id, content);
  if (handle) handles.set(doc.id, handle);
  useStore.setState((state) => ({ docs: [...state.docs, doc], activeId: doc.id }));
  emitContent();
  schedulePersist();
}

export function removeDocs(ids: string[], nextId: string) {
  const drop = new Set(ids);
  for (const id of ids) {
    contents.delete(id);
    handles.delete(id);
  }
  useStore.setState((state) => ({
    docs: state.docs.filter((doc) => !drop.has(doc.id)),
    activeId: nextId,
  }));
  emitContent();
  schedulePersist();
}

export function markClean(id: string) {
  updateDoc(id, { dirty: false });
}

export function boot(): boolean {
  if (useStore.getState().booted) return false;
  const session = readSession();
  const narrow = window.innerWidth < 768;
  const compact = window.innerWidth < 1024;
  const base = session?.settings ? { ...defaultSettings, ...session.settings } : { ...useStore.getState().settings };
  if (typeof base.fontSize !== "number") base.fontSize = 14;
  base.fontSize = Math.min(24, Math.max(11, base.fontSize));
  if (compact) base.showFunctions = false;
  if (narrow) base.wordWrap = true;
  if (!session || session.docs.length === 0) {
    if (!compact) base.showFunctions = true;
    useStore.setState({ booted: true, settings: base });
    applyTheme(base.theme === "light" ? "light" : "dark");
    return false;
  }
  contents.clear();
  for (const doc of session.docs) contents.set(doc.id, doc.content);
  const activeId = session.docs.some((doc) => doc.id === session.activeId) ? session.activeId : session.docs[0].id;
  useStore.setState({
    booted: true,
    docs: session.docs.map((doc) => ({
      id: doc.id,
      name: doc.name,
      language: doc.language,
      eol: doc.eol,
      dirty: false,
    })),
    activeId,
    settings: base,
  });
  applyTheme(base.theme === "light" ? "light" : "dark");
  return true;
}

export function nextUntitled(): string {
  const names = new Set(useStore.getState().docs.map((doc) => doc.name));
  let n = 1;
  while (names.has(`untitled-${n}.txt`)) n += 1;
  return `untitled-${n}.txt`;
}

export function docById(id: string): Doc | undefined {
  return useStore.getState().docs.find((doc) => doc.id === id);
}

export function activeDoc(): Doc | undefined {
  const { docs, activeId } = useStore.getState();
  return docs.find((doc) => doc.id === activeId);
}

export function setEol(id: string, eol: Eol) {
  updateDoc(id, { eol });
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushPersist);
}
