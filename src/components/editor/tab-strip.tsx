import { closeIds, dirtyTargets, renameDoc } from "@/lib/editor/actions";
import { setActive, useStore } from "@/lib/editor/store";
import { cn } from "@/lib/cn";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function TabStrip({ onAskClose }: { onAskClose: (ids: string[]) => void }) {
  const docs = useStore((state) => state.docs);
  const activeId = useStore((state) => state.activeId);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = stripRef.current?.querySelector<HTMLElement>("[data-active='true']");
    node?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [activeId]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [menu]);

  function commit(id: string) {
    renameDoc(id, draft);
    setRenaming(null);
  }

  function ask(ids: string[]) {
    const dirty = dirtyTargets(ids);
    if (dirty.length) onAskClose(ids);
    else closeIds(ids);
  }

  return (
    <div ref={stripRef} role="tablist" aria-label="Documents" className="flex h-11 shrink-0 overflow-x-auto border-b border-border bg-bg">
      {docs.map((doc) => {
        const active = doc.id === activeId;
        return (
          <div
            key={doc.id}
            data-active={active}
            role="tab"
            aria-selected={active}
            onMouseDown={(event) => {
              if (event.button === 1) {
                event.preventDefault();
                ask([doc.id]);
              }
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              setMenu({ x: event.clientX, y: event.clientY, id: doc.id });
            }}
            className={cn(
              "group relative flex h-full shrink-0 items-center border-r border-border",
              active ? "bg-editor text-fg" : "text-muted hover:bg-surface hover:text-fg",
            )}
          >
            {active ? <span className="absolute inset-x-0 top-0 h-0.5 bg-primary" /> : null}
            {renaming === doc.id ? (
              <input
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={() => commit(doc.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commit(doc.id);
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    setRenaming(null);
                  }
                }}
                aria-label="Rename file"
                className="mx-2 h-8 w-36 rounded-sm border border-border bg-editor px-2 text-sm text-fg outline-none focus:border-primary"
              />
            ) : (
              <button
                type="button"
                onClick={() => setActive(doc.id)}
                onDoubleClick={() => {
                  setRenaming(doc.id);
                  setDraft(doc.name);
                }}
                className="flex h-full max-w-40 items-center gap-2 px-3 text-sm sm:max-w-56"
              >
                {doc.dirty ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warn" aria-label="Unsaved" /> : null}
                <span className="truncate">{doc.name}</span>
              </button>
            )}
            <button
              type="button"
              aria-label={`Close ${doc.name}`}
              onClick={() => ask([doc.id])}
              className="mr-1 inline-flex h-8 w-8 items-center justify-center rounded-sm text-muted hover:bg-elevated hover:text-fg"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
      {menu ? (
        <div
          className="fixed z-50 w-48 border border-border bg-elevated py-1 shadow-lg"
          style={{ left: Math.min(menu.x, window.innerWidth - 200), top: Math.min(menu.y, window.innerHeight - 180) }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-surface" onClick={() => { setRenaming(menu.id); setDraft(docs.find((doc) => doc.id === menu.id)?.name ?? ""); setMenu(null); }}>
            Rename
          </button>
          <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-surface" onClick={() => { ask([menu.id]); setMenu(null); }}>
            Close
          </button>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm hover:bg-surface"
            onClick={() => {
              ask(docs.filter((doc) => doc.id !== menu.id).map((doc) => doc.id));
              setMenu(null);
            }}
          >
            Close others
          </button>
          <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-surface" onClick={() => { ask(docs.map((doc) => doc.id)); setMenu(null); }}>
            Close all
          </button>
        </div>
      ) : null}
    </div>
  );
}
