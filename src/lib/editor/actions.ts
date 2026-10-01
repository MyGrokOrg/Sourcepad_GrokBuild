import {
  activate,
  forget,
  getContent,
  gotoSpec,
  requestFocus,
  runEdit,
  setLanguage,
} from "@/lib/editor/engine";
import { languageFromName } from "@/lib/editor/languages";
import { downloadText, serialize, splitEol } from "@/lib/editor/session";
import {
  activeDoc,
  docById,
  handles,
  insertDoc,
  markClean,
  nextUntitled,
  patchSettings,
  removeDocs,
  setEol,
  showToast,
  updateDoc,
  useStore,
  type FileHandle,
} from "@/lib/editor/store";
import type { Doc } from "@/lib/editor/types";

type OpenPicker = (options?: { multiple?: boolean }) => Promise<FileHandle[]>;
type SavePicker = (options?: { suggestedName?: string }) => Promise<FileHandle>;

function openPicker(): OpenPicker | null {
  const picker = (window as unknown as { showOpenFilePicker?: OpenPicker }).showOpenFilePicker;
  return picker ?? null;
}

function savePicker(): SavePicker | null {
  const picker = (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
  return picker ?? null;
}

function isAbort(err: unknown) {
  return err instanceof DOMException && err.name === "AbortError";
}

export function createFromText(name: string, text: string) {
  const { eol, content } = splitEol(text);
  const doc: Doc = {
    id: crypto.randomUUID(),
    name,
    language: languageFromName(name) ?? "text",
    eol,
    dirty: true,
  };
  insertDoc(doc, content);
}

export function createUntitled() {
  const doc: Doc = {
    id: crypto.randomUUID(),
    name: nextUntitled(),
    language: "text",
    eol: "lf",
    dirty: false,
  };
  requestFocus();
  insertDoc(doc, "");
}

export async function openFromDisk() {
  const picker = openPicker();
  if (!picker) {
    document.getElementById("sourcepad-file")?.click();
    return;
  }
  try {
    const picked = await picker({ multiple: true });
    for (const handle of picked) {
      const file = await handle.getFile();
      await addFile(file, handle);
    }
  } catch (err) {
    if (!isAbort(err)) showToast("Couldn't open that file");
  }
}

export async function addFile(file: File, handle?: FileHandle) {
  if (file.type.startsWith("image/") || file.type.startsWith("audio/") || file.type.startsWith("video/")) {
    showToast(`Skipped ${file.name}`);
    return;
  }
  const raw = await file.text();
  const { eol, content } = splitEol(raw);
  if (content.length > 1_500_000) showToast(`${file.name} is large and may not survive a refresh`);
  const doc: Doc = {
    id: crypto.randomUUID(),
    name: file.name,
    language: languageFromName(file.name) ?? "text",
    eol,
    dirty: false,
  };
  insertDoc(doc, content, handle);
}

export async function saveDoc(id: string, saveAs = false): Promise<boolean> {
  const doc = docById(id);
  if (!doc) return false;
  const data = serialize(getContent(id), doc.eol);
  const existing = handles.get(id);
  try {
    if (!saveAs && existing) {
      const writable = await existing.createWritable();
      await writable.write(data);
      await writable.close();
      markClean(id);
      showToast(`Saved ${doc.name}`);
      return true;
    }
    const picker = saveAs ? savePicker() : null;
    if (picker) {
      try {
        const handle = await picker({ suggestedName: doc.name });
        const writable = await handle.createWritable();
        await writable.write(data);
        await writable.close();
        handles.set(id, handle);
        const language = languageFromName(handle.name);
        updateDoc(id, { name: handle.name, dirty: false, ...(language ? { language } : {}) });
        if (language) setLanguage(id, language);
        showToast(`Saved ${handle.name}`);
        return true;
      } catch (err) {
        if (isAbort(err)) return false;
      }
    }
  } catch {
    // Fall through to a download.
  }
  downloadText(doc.name, data);
  markClean(id);
  showToast(`Downloaded ${doc.name}`);
  return true;
}

export async function saveActive(saveAs = false) {
  const doc = activeDoc();
  if (!doc) return false;
  return saveDoc(doc.id, saveAs);
}

export async function saveAll() {
  const dirty = useStore.getState().docs.filter((doc) => doc.dirty);
  if (dirty.length === 0) {
    showToast("Nothing to save");
    return;
  }
  for (const doc of dirty) {
    const ok = await saveDoc(doc.id, false);
    if (!ok) break;
  }
}

export function renameDoc(id: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const doc = docById(id);
  const detected = languageFromName(trimmed);
  const language = detected ?? doc?.language ?? "text";
  updateDoc(id, { name: trimmed, language });
  if (doc && language !== doc.language) setLanguage(id, language);
}

export function setDocLanguage(id: string, language: string) {
  updateDoc(id, { language });
  setLanguage(id, language);
}

export function cycleTabSize() {
  const current = useStore.getState().settings.tabSize;
  const next = current === 2 ? 4 : current === 4 ? 8 : 2;
  patchSettings({ tabSize: next });
}

export function closeIds(ids: string[]) {
  if (ids.length === 0) return;
  const state = useStore.getState();
  const closing = new Set(ids);
  let next = state.activeId;
  if (closing.has(next)) {
    const index = state.docs.findIndex((doc) => doc.id === state.activeId);
    const neighbor = [...state.docs.slice(index + 1), ...state.docs.slice(0, index)].find(
      (doc) => !closing.has(doc.id),
    );
    next = neighbor?.id ?? "";
  }
  if (next !== state.activeId) activate(next);
  else if (!next) activate("");
  for (const id of ids) forget(id);
  removeDocs(ids, next);
}

export function dirtyTargets(ids: string[]): string[] {
  const docs = useStore.getState().docs;
  return ids.filter((id) => docs.find((doc) => doc.id === id)?.dirty);
}

export function toggleEol() {
  const doc = activeDoc();
  if (!doc) return;
  const eol = doc.eol === "lf" ? "crlf" : "lf";
  setEol(doc.id, eol);
  showToast(eol === "lf" ? "Line endings set to LF" : "Line endings set to CRLF");
}

export function jumpTo(spec: string) {
  if (!gotoSpec(spec)) showToast("Use a line, line:column, +10, or 50%");
}

export function nudgeFont(dir: number) {
  const current = useStore.getState().settings.fontSize;
  patchSettings({ fontSize: Math.min(24, Math.max(11, current + dir)) });
}

export { runEdit };
