import { LanguageList } from "@/components/editor/language-list";
import { currentStats, subscribeStats } from "@/lib/editor/engine";
import { languageLabel } from "@/lib/editor/languages";
import { setDocLanguage, toggleEol } from "@/lib/editor/actions";
import { patchSettings, useStore } from "@/lib/editor/store";
import { EMPTY_STATS, type Stats } from "@/lib/editor/types";
import { cn } from "@/lib/cn";
import { useEffect, useState } from "react";

export function StatusBar() {
  const doc = useStore((state) => state.docs.find((item) => item.id === state.activeId));
  const settings = useStore((state) => state.settings);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [langOpen, setLangOpen] = useState(false);
  const [indentOpen, setIndentOpen] = useState(false);

  useEffect(() => subscribeStats(setStats), []);
  useEffect(() => setStats(currentStats()), [doc?.id]);

  const indentLabel = `${settings.insertSpaces ? "Spaces" : "Tabs"}: ${settings.tabSize}`;

  return (
    <footer className="safe-bottom relative flex h-10 shrink-0 items-center gap-1 overflow-x-auto border-t border-border bg-surface px-2 text-xs text-muted">
      <span className="shrink-0 px-1.5 tabular-nums text-fg">
        Ln {stats.line}, Col {stats.col}
      </span>
      <span className="shrink-0 px-1.5 tabular-nums">
        {stats.selChars > 0
          ? `Sel ${stats.selChars.toLocaleString()}${stats.selLines ? ` · ${stats.selLines} ln` : ""}`
          : "Sel 0"}
      </span>
      <span className="shrink-0 px-1.5 tabular-nums">Len {stats.length.toLocaleString()}</span>
      <span className="shrink-0 px-1.5 tabular-nums">{stats.lines.toLocaleString()} lines</span>
      <span className="shrink-0 px-1.5">UTF-8</span>
      <button type="button" onClick={toggleEol} className="shrink-0 rounded-sm px-1.5 py-1 hover:bg-elevated hover:text-fg" title="Toggle line endings">
        {doc ? doc.eol.toUpperCase() : "LF"}
      </button>
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => {
            setLangOpen(false);
            setIndentOpen((open) => !open);
          }}
          className="rounded-sm px-1.5 py-1 hover:bg-elevated hover:text-fg"
        >
          {indentLabel}
        </button>
        {indentOpen ? (
          <div className="absolute bottom-full right-0 z-40 mb-1 w-44 border border-border bg-elevated p-1 shadow-lg">
            {[2, 4, 8].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => {
                  patchSettings({ tabSize: size });
                  setIndentOpen(false);
                }}
                className={cn(
                  "flex w-full rounded-sm px-2 py-2 text-left text-sm hover:bg-surface",
                  settings.tabSize === size && "text-primary",
                )}
              >
                Tab size {size}
              </button>
            ))}
            <button
              type="button"
              onClick={() => patchSettings({ insertSpaces: !settings.insertSpaces })}
              className="flex w-full rounded-sm px-2 py-2 text-left text-sm hover:bg-surface"
            >
              {settings.insertSpaces ? "Using spaces" : "Using tabs"}
            </button>
          </div>
        ) : null}
      </div>
      <div className="relative ml-auto shrink-0">
        <button
          type="button"
          onClick={() => {
            setIndentOpen(false);
            setLangOpen((open) => !open);
          }}
          className="rounded-sm px-1.5 py-1 text-fg hover:bg-elevated"
        >
          {doc ? languageLabel(doc.language) : "Plain text"}
        </button>
        {langOpen && doc ? (
          <div className="absolute bottom-full right-0 z-40 mb-1 w-64 border border-border bg-elevated shadow-lg">
            <LanguageList
              current={doc.language}
              onPick={(id) => {
                setDocLanguage(doc.id, id);
                setLangOpen(false);
              }}
            />
          </div>
        ) : null}
      </div>
      {settings.wordWrap ? <span className="shrink-0 px-1.5">Wrap</span> : null}
    </footer>
  );
}
