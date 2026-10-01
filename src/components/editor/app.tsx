import { EditorHost } from "@/components/editor/editor-host";
import { FindBar } from "@/components/editor/find-bar";
import { FunctionList } from "@/components/editor/function-list";
import { LanguageList } from "@/components/editor/language-list";
import { StatusBar } from "@/components/editor/status-bar";
import { TabStrip } from "@/components/editor/tab-strip";
import { IconButton, MenuItem, MenuPanel } from "@/components/editor/ui";
import {
  addFile,
  closeIds,
  createFromText,
  createUntitled,
  dirtyTargets,
  nudgeFont,
  openFromDisk,
  jumpTo,
  renameDoc,
  runEdit,
  saveActive,
  saveAll,
  saveDoc,
  setDocLanguage,
} from "@/lib/editor/actions";
import { applySettings, editClipboard, findMatch, focus, pasteFromClipboard, selectedSnippet } from "@/lib/editor/engine";
import { languageLabel } from "@/lib/editor/languages";
import { patchSettings, setActive, showToast, useStore } from "@/lib/editor/store";
import { cn } from "@/lib/cn";
import {
  FileCode2,
  FilePlus,
  FolderOpen,
  ListTree,
  Menu,
  Moon,
  Redo2,
  Replace,
  Save,
  Search,
  Space,
  Sun,
  Undo2,
  WrapText,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

type MenuId = "file" | "edit" | "search" | "view" | "language" | null;

export function EditorApp() {
  const docs = useStore((state) => state.docs);
  const activeId = useStore((state) => state.activeId);
  const settings = useStore((state) => state.settings);
  const toast = useStore((state) => state.toast);
  const doc = docs.find((item) => item.id === activeId);
  const [menu, setMenu] = useState<MenuId>(null);
  const [drawer, setDrawer] = useState(false);
  const [prompt, setPrompt] = useState<string[] | null>(null);
  const [gotoOpen, setGotoOpen] = useState(false);
  const [gotoValue, setGotoValue] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [find, setFind] = useState({ open: false, replace: false, seed: "", nonce: 0 });
  const ui = useRef({ menu, drawer, prompt, gotoOpen, findOpen: find.open });
  ui.current = { menu, drawer, prompt, gotoOpen, findOpen: find.open };

  useEffect(() => {
    if (!useStore.getState().booted) return;
    applySettings();
  }, [settings]);

  useEffect(() => {
    const name = doc ? `${doc.dirty ? "• " : ""}${doc.name} — Sourcepad` : "Sourcepad";
    document.title = name;
  }, [doc?.name, doc?.dirty, doc]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (ui.current.prompt) {
          setPrompt(null);
          return;
        }
        if (ui.current.gotoOpen) {
          setGotoOpen(false);
          return;
        }
        if (ui.current.drawer || ui.current.menu) {
          setDrawer(false);
          setMenu(null);
          return;
        }
        if (ui.current.findOpen) {
          setFind((state) => ({ ...state, open: false }));
          focus();
          return;
        }
      }
      const meta = event.ctrlKey || event.metaKey;
      if (!meta && event.key === "F3") {
        event.preventDefault();
        findMatch(event.shiftKey);
        return;
      }
      if (!meta) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        void saveActive(event.shiftKey);
      } else if (key === "o") {
        event.preventDefault();
        void openFromDisk();
      } else if (key === "n") {
        event.preventDefault();
        createUntitled();
      } else if (key === "w") {
        event.preventDefault();
        const id = useStore.getState().activeId;
        if (id) askClose([id]);
      } else if (key === "f") {
        event.preventDefault();
        openFind(false);
      } else if (key === "h") {
        event.preventDefault();
        openFind(true);
      } else if (key === "g" && !event.shiftKey) {
        event.preventDefault();
        setGotoValue("");
        setGotoOpen(true);
      } else if (key === "d" && !event.shiftKey && !event.altKey) {
        const target = event.target;
        if (target instanceof Element && target.closest(".cm-editor")) {
          event.preventDefault();
          runEdit("duplicate");
        }
      } else if (event.key === "PageDown") {
        event.preventDefault();
        cycle(1);
      } else if (event.key === "PageUp") {
        event.preventDefault();
        cycle(-1);
      } else if (key === "tab") {
        event.preventDefault();
        cycle(event.shiftKey ? -1 : 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!menu) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-popup]")) return;
      setMenu(null);
    };
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, [menu]);

  function openFind(replace: boolean) {
    setFind((state) => ({ open: true, replace, seed: selectedSnippet() || state.seed, nonce: state.nonce + 1 }));
    setMenu(null);
    setDrawer(false);
  }

  function askClose(ids: string[]) {
    if (dirtyTargets(ids).length) setPrompt(ids);
    else closeIds(ids);
  }

  function cycle(dir: number) {
    const state = useStore.getState();
    if (state.docs.length < 2) return;
    const index = state.docs.findIndex((item) => item.id === state.activeId);
    const next = state.docs[(index + dir + state.docs.length) % state.docs.length];
    if (next) setActive(next.id);
  }

  function closeMenu(run: () => void) {
    setMenu(null);
    setDrawer(false);
    run();
  }

  const themeIcon = settings.theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />;

  return (
    <div
      className="flex h-dvh min-h-0 flex-col overflow-hidden bg-bg text-fg"
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragOver(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        const files = [...event.dataTransfer.files];
        if (files.length === 0) {
          const text = event.dataTransfer.getData("text/plain");
          if (text) createFromText("dropped.txt", text);
          return;
        }
        void Promise.all(files.map((file) => addFile(file)));
      }}
    >
      <div className="h-0.5 shrink-0 bg-primary" />
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-border bg-bg px-2">
        <FileCode2 className="ml-1 size-5 shrink-0 text-primary" aria-hidden="true" />
        <span className="px-1 text-sm font-semibold tracking-tight">Sourcepad</span>
        <nav className="ml-2 hidden items-center md:flex" aria-label="Editor menu">
          <MenuButton id="file" label="File" open={menu} setOpen={setMenu}>
            <MenuItem label="New" shortcut="Ctrl+N" onClick={() => closeMenu(createUntitled)} />
            <MenuItem label="Open" shortcut="Ctrl+O" onClick={() => closeMenu(() => void openFromDisk())} />
            <MenuItem label="Save" shortcut="Ctrl+S" disabled={!doc} onClick={() => closeMenu(() => void saveActive(false))} />
            <MenuItem label="Save as" shortcut="Ctrl+Shift+S" disabled={!doc} onClick={() => closeMenu(() => void saveActive(true))} />
            <MenuItem label="Save all" disabled={!docs.some((item) => item.dirty)} onClick={() => closeMenu(() => void saveAll())} />
            <div className="my-1 h-px bg-border" />
            <MenuItem
              label="Rename"
              disabled={!doc}
              onClick={() => closeMenu(() => { setRenameValue(doc?.name ?? ""); setRenaming(true); })}
            />
            <MenuItem label="Close" shortcut="Ctrl+W" disabled={!doc} onClick={() => closeMenu(() => doc && askClose([doc.id]))} />
            <MenuItem label="Close others" disabled={docs.length < 2} onClick={() => closeMenu(() => doc && askClose(docs.filter((item) => item.id !== doc.id).map((item) => item.id)))} />
            <MenuItem label="Close all" disabled={docs.length === 0} onClick={() => closeMenu(() => askClose(docs.map((item) => item.id)))} />
          </MenuButton>
          <MenuButton id="edit" label="Edit" open={menu} setOpen={setMenu}>
            <MenuItem label="Undo" shortcut="Ctrl+Z" onClick={() => closeMenu(() => runEdit("undo"))} />
            <MenuItem label="Redo" shortcut="Ctrl+Y" onClick={() => closeMenu(() => runEdit("redo"))} />
            <div className="my-1 h-px bg-border" />
            <MenuItem label="Cut" shortcut="Ctrl+X" onClick={() => closeMenu(() => { if (!editClipboard("cut")) showToast("Clipboard is blocked"); })} />
            <MenuItem label="Copy" shortcut="Ctrl+C" onClick={() => closeMenu(() => { if (!editClipboard("copy")) showToast("Clipboard is blocked"); })} />
            <MenuItem label="Paste" shortcut="Ctrl+V" onClick={() => closeMenu(() => { void pasteFromClipboard().then((ok) => { if (!ok) showToast("Clipboard is blocked"); }); })} />
            <MenuItem label="Select all" shortcut="Ctrl+A" onClick={() => closeMenu(() => runEdit("selectAll"))} />
            <div className="my-1 h-px bg-border" />
            <MenuItem label="Duplicate line" shortcut="Ctrl+D" onClick={() => closeMenu(() => runEdit("duplicate"))} />
            <MenuItem label="Toggle comment" shortcut="Ctrl+/" onClick={() => closeMenu(() => runEdit("comment"))} />
            <MenuItem label="Indent" shortcut="Tab" onClick={() => closeMenu(() => runEdit("indent"))} />
            <MenuItem label="Outdent" shortcut="Shift+Tab" onClick={() => closeMenu(() => runEdit("outdent"))} />
            <MenuItem label="Delete line" onClick={() => closeMenu(() => runEdit("deleteLine"))} />
            <div className="my-1 h-px bg-border" />
            <MenuItem label="Uppercase" onClick={() => closeMenu(() => runEdit("upper"))} />
            <MenuItem label="Lowercase" onClick={() => closeMenu(() => runEdit("lower"))} />
            <MenuItem label="Trim trailing space" onClick={() => closeMenu(() => runEdit("trim"))} />
            <MenuItem label="Tabs to spaces" onClick={() => closeMenu(() => runEdit("tabsToSpaces"))} />
            <MenuItem label="Spaces to tabs" onClick={() => closeMenu(() => runEdit("spacesToTabs"))} />
            <MenuItem label="Sort lines" onClick={() => closeMenu(() => runEdit("sort"))} />
            <MenuItem label="Select next occurrence" onClick={() => closeMenu(() => runEdit("selectNext"))} />
            <MenuItem label="Select all matches" onClick={() => closeMenu(() => runEdit("selectMatches"))} />
          </MenuButton>
          <MenuButton id="search" label="Search" open={menu} setOpen={setMenu}>
            <MenuItem label="Find" shortcut="Ctrl+F" onClick={() => openFind(false)} />
            <MenuItem label="Replace" shortcut="Ctrl+H" onClick={() => openFind(true)} />
            <MenuItem label="Find next" shortcut="F3" onClick={() => closeMenu(() => findMatch(false))} />
            <MenuItem label="Find previous" shortcut="Shift+F3" onClick={() => closeMenu(() => findMatch(true))} />
            <MenuItem label="Go to line" shortcut="Ctrl+G" onClick={() => closeMenu(() => { setGotoValue(""); setGotoOpen(true); })} />
          </MenuButton>
          <MenuButton id="view" label="View" open={menu} setOpen={setMenu}>
            <MenuItem label="Word wrap" checked={settings.wordWrap} onClick={() => closeMenu(() => patchSettings({ wordWrap: !settings.wordWrap }))} />
            <MenuItem label="Show whitespace" checked={settings.showWhitespace} onClick={() => closeMenu(() => patchSettings({ showWhitespace: !settings.showWhitespace }))} />
            <MenuItem label="Symbol list" checked={settings.showFunctions} onClick={() => closeMenu(() => patchSettings({ showFunctions: !settings.showFunctions }))} />
            <div className="my-1 h-px bg-border" />
            <MenuItem label="Fold all" onClick={() => closeMenu(() => runEdit("foldAll"))} />
            <MenuItem label="Unfold all" onClick={() => closeMenu(() => runEdit("unfoldAll"))} />
            <div className="my-1 h-px bg-border" />
            <MenuItem label="Increase font" onClick={() => closeMenu(() => nudgeFont(1))} />
            <MenuItem label="Decrease font" onClick={() => closeMenu(() => nudgeFont(-1))} />
            <MenuItem label={`Font size ${settings.fontSize}`} onClick={() => closeMenu(() => patchSettings({ fontSize: 14 }))} />
            <div className="my-1 h-px bg-border" />
            <MenuItem label="Dark theme" checked={settings.theme === "dark"} onClick={() => closeMenu(() => patchSettings({ theme: "dark" }))} />
            <MenuItem label="Light theme" checked={settings.theme === "light"} onClick={() => closeMenu(() => patchSettings({ theme: "light" }))} />
            <MenuItem label={settings.insertSpaces ? "Insert spaces" : "Insert tabs"} checked={settings.insertSpaces} onClick={() => closeMenu(() => patchSettings({ insertSpaces: !settings.insertSpaces }))} />
            <MenuItem label="Tab size 2" checked={settings.tabSize === 2} onClick={() => closeMenu(() => patchSettings({ tabSize: 2 }))} />
            <MenuItem label="Tab size 4" checked={settings.tabSize === 4} onClick={() => closeMenu(() => patchSettings({ tabSize: 4 }))} />
            <MenuItem label="Tab size 8" checked={settings.tabSize === 8} onClick={() => closeMenu(() => patchSettings({ tabSize: 8 }))} />
          </MenuButton>
          <MenuButton id="language" label="Language" open={menu} setOpen={setMenu} panelClass="w-64 p-0">
            <LanguageList
              current={doc?.language ?? "text"}
              onPick={(id) => {
                if (doc) setDocLanguage(doc.id, id);
                setMenu(null);
              }}
            />
          </MenuButton>
        </nav>
        <div className="ml-auto flex items-center">
          <IconButton
            label={settings.theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            onClick={() => patchSettings({ theme: settings.theme === "dark" ? "light" : "dark" })}
          >
            {themeIcon}
          </IconButton>
          <IconButton label="Menu" className="md:hidden" onClick={() => setDrawer(true)}>
            <Menu className="size-4" />
          </IconButton>
        </div>
      </header>

      <div className="flex h-11 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border bg-bg px-1">
        <IconButton label="New file" onClick={createUntitled}><FilePlus className="size-4" /></IconButton>
        <IconButton label="Open file" onClick={() => void openFromDisk()}><FolderOpen className="size-4" /></IconButton>
        <IconButton label="Save file" disabled={!doc} onClick={() => void saveActive(false)}><Save className="size-4" /></IconButton>
        <span className="mx-1 h-5 w-px shrink-0 bg-border" />
        <IconButton label="Undo" onClick={() => runEdit("undo")}><Undo2 className="size-4" /></IconButton>
        <IconButton label="Redo" onClick={() => runEdit("redo")}><Redo2 className="size-4" /></IconButton>
        <span className="mx-1 h-5 w-px shrink-0 bg-border" />
        <IconButton label="Find" pressed={find.open && !find.replace} onClick={() => openFind(false)}><Search className="size-4" /></IconButton>
        <IconButton label="Replace" pressed={find.open && find.replace} onClick={() => openFind(true)}><Replace className="size-4" /></IconButton>
        <span className="mx-1 h-5 w-px shrink-0 bg-border" />
        <IconButton label="Word wrap" pressed={settings.wordWrap} onClick={() => patchSettings({ wordWrap: !settings.wordWrap })}><WrapText className="size-4" /></IconButton>
        <IconButton label="Show whitespace" pressed={settings.showWhitespace} onClick={() => patchSettings({ showWhitespace: !settings.showWhitespace })}><Space className="size-4" /></IconButton>
        <IconButton label="Symbol list" pressed={settings.showFunctions} onClick={() => patchSettings({ showFunctions: !settings.showFunctions })}><ListTree className="size-4" /></IconButton>
      </div>

      <div className="relative flex min-h-0 min-w-0 flex-1">
        {settings.showFunctions ? <FunctionList /> : null}
        <div className="flex min-w-0 flex-1 flex-col">
          <TabStrip onAskClose={askClose} />
          {find.open ? (
            <FindBar
              key={find.nonce}
              replace={find.replace}
              initial={find.seed}
              onClose={() => setFind((state) => ({ ...state, open: false }))}
            />
          ) : null}
          <div className="relative min-h-0 flex-1 bg-editor">
            <EditorHost />
            {!doc ? (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-editor px-6 text-center">
                <FileCode2 className="size-10 text-primary" aria-hidden="true" />
                <div>
                  <h1 className="text-lg font-semibold text-balance">No documents open</h1>
                  <p className="mt-1 max-w-sm text-sm text-pretty text-muted">
                    Start a file or open one from this device. Tabs stay in this browser.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={createUntitled} className="h-11 rounded-sm bg-primary px-4 text-sm font-medium text-primary-fg">
                    New file
                  </button>
                  <button type="button" onClick={() => void openFromDisk()} className="h-11 rounded-sm border border-border px-4 text-sm text-fg">
                    Open
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <StatusBar />

      {dragOver ? (
        <div className="pointer-events-none fixed inset-4 z-40 flex items-center justify-center rounded-md border-2 border-dashed border-primary bg-overlay">
          <p className="bg-elevated px-4 py-2 text-sm font-medium text-fg">Drop text files to open</p>
        </div>
      ) : null}

      {toast ? (
        <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-14 left-1/2 z-40 -translate-x-1/2 border border-border bg-elevated px-3 py-2 text-sm text-fg shadow-lg">
          {toast}
        </div>
      ) : null}

      {drawer ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" className="absolute inset-0 bg-overlay" aria-label="Close menu" onClick={() => setDrawer(false)} />
          <div role="dialog" aria-label="Editor menu" className="absolute inset-y-0 right-0 flex w-80 max-w-full flex-col border-l border-border bg-surface">
            <div className="flex h-12 items-center justify-between border-b border-border px-3">
              <span className="text-sm font-semibold">Menu</span>
              <button type="button" aria-label="Close menu" onClick={() => setDrawer(false)} className="inline-flex h-11 w-11 items-center justify-center text-muted">
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto py-2">
              <DrawerLabel>File</DrawerLabel>
              <DrawerItem label="New" onClick={() => closeMenu(createUntitled)} />
              <DrawerItem label="Open" onClick={() => closeMenu(() => void openFromDisk())} />
              <DrawerItem label="Save" onClick={() => closeMenu(() => void saveActive(false))} />
              <DrawerItem label="Save as" onClick={() => closeMenu(() => void saveActive(true))} />
              <DrawerItem label="Close tab" onClick={() => closeMenu(() => doc && askClose([doc.id]))} />
              <DrawerLabel>Edit</DrawerLabel>
              <DrawerItem label="Undo" onClick={() => closeMenu(() => runEdit("undo"))} />
              <DrawerItem label="Redo" onClick={() => closeMenu(() => runEdit("redo"))} />
              <DrawerItem label="Duplicate line" onClick={() => closeMenu(() => runEdit("duplicate"))} />
              <DrawerItem label="Toggle comment" onClick={() => closeMenu(() => runEdit("comment"))} />
              <DrawerItem label="Trim trailing space" onClick={() => closeMenu(() => runEdit("trim"))} />
              <DrawerLabel>Search</DrawerLabel>
              <DrawerItem label="Find" onClick={() => openFind(false)} />
              <DrawerItem label="Replace" onClick={() => openFind(true)} />
              <DrawerItem label="Go to line" onClick={() => closeMenu(() => setGotoOpen(true))} />
              <DrawerLabel>View</DrawerLabel>
              <DrawerItem label={settings.wordWrap ? "Word wrap on" : "Word wrap off"} onClick={() => patchSettings({ wordWrap: !settings.wordWrap })} />
              <DrawerItem label={settings.showWhitespace ? "Whitespace on" : "Whitespace off"} onClick={() => patchSettings({ showWhitespace: !settings.showWhitespace })} />
              <DrawerItem label="Symbols" onClick={() => closeMenu(() => patchSettings({ showFunctions: !settings.showFunctions }))} />
              <DrawerItem label="Larger text" onClick={() => nudgeFont(1)} />
              <DrawerItem label="Smaller text" onClick={() => nudgeFont(-1)} />
              <DrawerItem label={settings.theme === "dark" ? "Light theme" : "Dark theme"} onClick={() => patchSettings({ theme: settings.theme === "dark" ? "light" : "dark" })} />
              <DrawerLabel>Language · {doc ? languageLabel(doc.language) : "Plain text"}</DrawerLabel>
              <LanguageList current={doc?.language ?? "text"} onPick={(id) => { if (doc) setDocLanguage(doc.id, id); setDrawer(false); }} />
            </div>
          </div>
        </div>
      ) : null}

      {gotoOpen ? (
        <Dialog title="Go to" onClose={() => setGotoOpen(false)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              jumpTo(gotoValue);
              setGotoOpen(false);
            }}
          >
            <label className="block text-sm text-muted" htmlFor="goto-line">Line, line:column, +10, or 50%</label>
            <input
              id="goto-line"
              autoFocus
              value={gotoValue}
              onChange={(event) => setGotoValue(event.target.value)}
              className="mt-2 h-11 w-full rounded-sm border border-border bg-editor px-3 text-base text-fg outline-none focus:border-primary"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setGotoOpen(false)} className="h-11 rounded-sm px-3 text-sm text-muted hover:text-fg">Cancel</button>
              <button type="submit" className="h-11 rounded-sm bg-primary px-4 text-sm font-medium text-primary-fg">Go</button>
            </div>
          </form>
        </Dialog>
      ) : null}

      {prompt ? (
        <Dialog title="Unsaved changes" onClose={() => setPrompt(null)}>
          <p className="text-sm text-pretty text-muted">
            {prompt.length === 1
              ? `${docs.find((item) => item.id === prompt[0])?.name ?? "This file"} has unsaved edits.`
              : `${dirtyTargets(prompt).length} files have unsaved edits.`}
          </p>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setPrompt(null)} className="h-11 rounded-sm px-3 text-sm text-muted hover:text-fg">Cancel</button>
            <button
              type="button"
              onClick={() => {
                const ids = prompt;
                setPrompt(null);
                closeIds(ids);
              }}
              className="h-11 rounded-sm border border-border px-3 text-sm text-fg"
            >
              Don't save
            </button>
            <button
              type="button"
              onClick={() => {
                const ids = prompt;
                setPrompt(null);
                void (async () => {
                  for (const id of dirtyTargets(ids)) {
                    const ok = await saveDoc(id, false);
                    if (!ok) return;
                  }
                  closeIds(ids);
                })();
              }}
              className="h-11 rounded-sm bg-primary px-4 text-sm font-medium text-primary-fg"
            >
              Save
            </button>
          </div>
        </Dialog>
      ) : null}

      {renaming && doc ? (
        <Dialog title="Rename" onClose={() => setRenaming(false)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              renameDoc(doc.id, renameValue);
              setRenaming(false);
            }}
          >
            <input
              autoFocus
              aria-label="File name"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              className="h-11 w-full rounded-sm border border-border bg-editor px-3 text-base text-fg outline-none focus:border-primary"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setRenaming(false)} className="h-11 rounded-sm px-3 text-sm text-muted">Cancel</button>
              <button type="submit" className="h-11 rounded-sm bg-primary px-4 text-sm font-medium text-primary-fg">Rename</button>
            </div>
          </form>
        </Dialog>
      ) : null}

      <input
        id="sourcepad-file"
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          void Promise.all(files.map((file) => addFile(file)));
          event.target.value = "";
        }}
      />
    </div>
  );
}

function MenuButton({
  id,
  label,
  open,
  setOpen,
  children,
  panelClass,
}: {
  id: Exclude<MenuId, null>;
  label: string;
  open: MenuId;
  setOpen: (id: MenuId) => void;
  children: ReactNode;
  panelClass?: string;
}) {
  const shown = open === id;
  return (
    <div className="relative" data-popup={id}>
      <button
        type="button"
        aria-expanded={shown}
        aria-haspopup="menu"
        onClick={() => setOpen(shown ? null : id)}
        className={cn(
          "h-10 rounded-sm px-2.5 text-sm text-muted hover:bg-elevated hover:text-fg",
          shown && "bg-elevated text-fg",
        )}
      >
        {label}
      </button>
      {shown ? <MenuPanel className={panelClass}>{children}</MenuPanel> : null}
    </div>
  );
}

function DrawerLabel({ children }: { children: ReactNode }) {
  return <p className="px-4 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-faint">{children}</p>;
}

function DrawerItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex h-11 w-full items-center px-4 text-left text-sm text-fg hover:bg-elevated">
      {label}
    </button>
  );
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" className="absolute inset-0 bg-overlay" aria-label="Dismiss" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} className="relative z-10 w-full max-w-md rounded-t-md border border-border bg-surface p-4 shadow-lg sm:rounded-md">
        <h2 className="mb-3 text-base font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
