import { gotoLine } from "@/lib/editor/engine";
import { contents, patchSettings, subscribeContent, useStore } from "@/lib/editor/store";
import { extractSymbols } from "@/lib/editor/symbols";
import { cn } from "@/lib/cn";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

const PAD = ["pl-2", "pl-4", "pl-6", "pl-8", "pl-10"] as const;

export function FunctionList() {
  const active = useStore((state) => state.docs.find((doc) => doc.id === state.activeId));
  const [hits, setHits] = useState(() => extractSymbols(active?.language ?? "text", contents.get(active?.id ?? "") ?? ""));

  useEffect(() => {
    let timer = 0;
    const run = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const doc = useStore.getState().docs.find((item) => item.id === useStore.getState().activeId);
        setHits(extractSymbols(doc?.language ?? "text", contents.get(doc?.id ?? "") ?? ""));
      }, 120);
    };
    run();
    const stop = subscribeContent(run);
    return () => {
      stop();
      window.clearTimeout(timer);
    };
  }, [active?.id, active?.language]);

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-30 bg-overlay lg:hidden"
        aria-label="Close symbol list"
        onClick={() => patchSettings({ showFunctions: false })}
      />
      <aside className="absolute inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-surface lg:static lg:z-0 lg:w-60 lg:shrink-0">
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
          <h2 className="text-sm font-medium text-fg">Symbols</h2>
          <button
            type="button"
            aria-label="Close symbol list"
            onClick={() => patchSettings({ showFunctions: false })}
            className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-muted hover:bg-elevated hover:text-fg"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {hits.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted">No symbols in this file.</p>
          ) : (
            <ul>
              {hits.map((hit, index) => (
                <li key={`${hit.line}-${hit.label}-${index}`}>
                  <button
                    type="button"
                    onClick={() => {
                      gotoLine(hit.line);
                      if (window.innerWidth < 1024) patchSettings({ showFunctions: false });
                    }}
                    className={cn(
                      "flex w-full items-baseline gap-2 py-1.5 pr-3 text-left hover:bg-elevated",
                      PAD[hit.level] ?? "pl-2",
                    )}
                  >
                    <span className="w-10 shrink-0 text-xs uppercase tracking-wide text-faint">{hit.kind}</span>
                    <span className="min-w-0 flex-1 truncate font-mono text-sm text-fg">{hit.label}</span>
                    <span className="shrink-0 text-xs text-faint tabular-nums">{hit.line}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
