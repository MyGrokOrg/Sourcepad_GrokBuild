import { applySettings, activate, attach, detach, discardDraftStates } from "@/lib/editor/engine";
import { boot, contents, useStore } from "@/lib/editor/store";
import { useLayoutEffect, useRef, useState } from "react";

export function EditorHost() {
  const ref = useRef<HTMLDivElement>(null);
  const activeId = useStore((state) => state.activeId);
  const [ready, setReady] = useState(false);
  const preview = contents.get(activeId) ?? "";

  useLayoutEffect(() => {
    if (!useStore.getState().booted) {
      const swapped = boot();
      if (swapped) discardDraftStates();
    }
    if (ref.current) attach(ref.current);
    applySettings();
    setReady(true);
    return () => detach();
  }, []);

  useLayoutEffect(() => {
    if (!useStore.getState().booted) return;
    if (useStore.getState().activeId !== activeId) return;
    activate(activeId);
  }, [activeId]);

  return (
    <>
      <div ref={ref} className={ready ? "absolute inset-0" : "absolute inset-0 invisible"} />
      {ready || !activeId ? null : (
        <pre className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre p-3 font-mono text-sm leading-relaxed text-fg">
          {preview}
        </pre>
      )}
    </>
  );
}