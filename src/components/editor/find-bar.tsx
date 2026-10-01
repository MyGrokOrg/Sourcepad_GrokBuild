import { FieldButton } from "@/components/editor/ui";
import { applyQuery, findMatch, replaceEvery, replaceOne, type QueryOpts } from "@/lib/editor/engine";
import { cn } from "@/lib/cn";
import { ArrowDown, ArrowUp, CaseSensitive, Regex, WholeWord, X } from "lucide-react";
import { useEffect, useState } from "react";

export function FindBar({
  replace,
  initial,
  onClose,
}: {
  replace: boolean;
  initial: string;
  onClose: () => void;
}) {
  const [find, setFind] = useState(initial);
  const [repl, setRepl] = useState("");
  const [showReplace, setShowReplace] = useState(replace);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [regexp, setRegexp] = useState(false);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setShowReplace(replace);
  }, [replace]);

  useEffect(() => {
    if (initial) setFind(initial);
  }, [initial]);

  useEffect(() => {
    const opts: QueryOpts = { search: find, replace: repl, caseSensitive, wholeWord, regexp };
    const result = applyQuery(find ? opts : null);
    setCount(result.count);
    setError(result.error);
  }, [find, repl, caseSensitive, wholeWord, regexp]);

  useEffect(() => {
    return () => {
      applyQuery(null);
    };
  }, []);

  return (
    <div className="flex shrink-0 flex-col gap-2 border-b border-border bg-surface px-2 py-2 sm:px-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          autoFocus
          value={find}
          onChange={(event) => setFind(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              findMatch(event.shiftKey);
            } else if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            }
          }}
          placeholder="Find  (\\n and \\t)"
          aria-label="Find"
          className="h-10 min-w-40 flex-1 rounded-sm border border-border bg-editor px-2 text-base text-fg outline-none focus:border-primary md:text-sm"
        />
        <FieldButton label="Match case" pressed={caseSensitive} onClick={() => setCaseSensitive((value) => !value)}>
          <CaseSensitive className="size-4" />
        </FieldButton>
        <FieldButton label="Whole word" pressed={wholeWord} onClick={() => setWholeWord((value) => !value)}>
          <WholeWord className="size-4" />
        </FieldButton>
        <FieldButton label="Regular expression" pressed={regexp} onClick={() => setRegexp((value) => !value)}>
          <Regex className="size-4" />
        </FieldButton>
        <FieldButton label="Previous match" onClick={() => findMatch(true)}>
          <ArrowUp className="size-4" />
        </FieldButton>
        <FieldButton label="Next match" onClick={() => findMatch(false)}>
          <ArrowDown className="size-4" />
        </FieldButton>
        <FieldButton label="Close find" onClick={onClose}>
          <X className="size-4" />
        </FieldButton>
      </div>
      {showReplace ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            value={repl}
            onChange={(event) => setRepl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                replaceOne();
              } else if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              }
            }}
            placeholder="Replace"
            aria-label="Replace"
            className="h-10 min-w-40 flex-1 rounded-sm border border-border bg-editor px-2 text-base text-fg outline-none focus:border-primary md:text-sm"
          />
          <button
            type="button"
            onClick={() => replaceOne()}
            className="h-10 rounded-sm border border-border px-3 text-sm text-fg hover:bg-elevated"
          >
            Replace
          </button>
          <button
            type="button"
            onClick={() => {
              const replaced = replaceEvery();
              setCount(0);
              if (replaced) setFind((value) => value);
            }}
            className="h-10 rounded-sm bg-primary px-3 text-sm font-medium text-primary-fg hover:opacity-90"
          >
            All
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowReplace(true)}
          className="self-start text-sm text-muted hover:text-fg"
        >
          Replace…
        </button>
      )}
      <p className={cn("text-xs", error ? "text-danger" : "text-muted")}>
        {error ? error : find ? (count > 5000 ? "5000+ matches" : `${count} match${count === 1 ? "" : "es"}`) : "Type to search this file"}
      </p>
    </div>
  );
}
