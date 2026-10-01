import { LANGUAGES } from "@/lib/editor/languages";
import { cn } from "@/lib/cn";
import { useMemo, useState } from "react";

export function LanguageList({
  current,
  onPick,
}: {
  current: string;
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return LANGUAGES;
    return LANGUAGES.filter((lang) => lang.label.toLowerCase().includes(needle));
  }, [query]);

  return (
    <div className="flex flex-col">
      <div className="border-b border-border p-2">
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter languages"
          aria-label="Filter languages"
          className="h-10 w-full rounded-sm border border-border bg-editor px-2 text-base text-fg outline-none focus:border-primary md:text-sm"
        />
      </div>
      <ul className="max-h-72 overflow-y-auto py-1">
        {items.length === 0 ? (
          <li className="px-3 py-2 text-sm text-muted">No languages</li>
        ) : (
          items.map((lang) => (
            <li key={lang.id}>
              <button
                type="button"
                onClick={() => onPick(lang.id)}
                className={cn(
                  "flex w-full items-center px-3 py-2 text-left text-sm hover:bg-surface",
                  lang.id === current ? "text-primary" : "text-fg",
                )}
              >
                {lang.label}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
