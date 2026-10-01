import type { Eol, Settings } from "@/lib/editor/types";

export type SessionDoc = {
  id: string;
  name: string;
  language: string;
  eol: Eol;
  content: string;
};

export type Session = {
  v: 1;
  activeId: string;
  settings: Settings;
  docs: SessionDoc[];
};

const KEY = "sourcepad.session.v1";

function isEol(value: unknown): value is Eol {
  return value === "lf" || value === "crlf";
}

export function readSession(): Session | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<Session>;
    if (data.v !== 1 || !Array.isArray(data.docs) || !data.settings) return null;
    const docs: SessionDoc[] = [];
    for (const item of data.docs) {
      if (!item || typeof item !== "object") continue;
      const doc = item as Partial<SessionDoc>;
      if (typeof doc.id !== "string" || typeof doc.name !== "string" || typeof doc.content !== "string") continue;
      docs.push({
        id: doc.id,
        name: doc.name,
        language: typeof doc.language === "string" ? doc.language : "text",
        eol: isEol(doc.eol) ? doc.eol : "lf",
        content: doc.content,
      });
    }
    return {
      v: 1,
      activeId: typeof data.activeId === "string" ? data.activeId : (docs[0]?.id ?? ""),
      settings: data.settings,
      docs,
    };
  } catch {
    return null;
  }
}

export function writeSession(session: Session): boolean {
  try {
    const raw = JSON.stringify(session);
    if (raw.length > 4_000_000) return false;
    localStorage.setItem(KEY, raw);
    return true;
  } catch {
    return false;
  }
}

export function serialize(text: string, eol: Eol): string {
  const lf = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return eol === "crlf" ? lf.replace(/\n/g, "\r\n") : lf;
}

export function splitEol(text: string): { eol: Eol; content: string } {
  const eol: Eol = text.includes("\r\n") ? "crlf" : "lf";
  const content = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return { eol, content };
}

export function downloadText(name: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name || "untitled.txt";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
