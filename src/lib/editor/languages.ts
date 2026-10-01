import { css } from "@codemirror/lang-css";
import { cpp } from "@codemirror/lang-cpp";
import { go } from "@codemirror/lang-go";
import { html } from "@codemirror/lang-html";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { less } from "@codemirror/lang-less";
import { markdown } from "@codemirror/lang-markdown";
import { php } from "@codemirror/lang-php";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { sql } from "@codemirror/lang-sql";
import { xml } from "@codemirror/lang-xml";
import { yaml } from "@codemirror/lang-yaml";
import { StreamLanguage, type StreamParser } from "@codemirror/language";
import { linter, type Diagnostic } from "@codemirror/lint";
import type { Extension } from "@codemirror/state";
import { csharp, kotlin, objectiveC, scala } from "@codemirror/legacy-modes/mode/clike";
import { diff } from "@codemirror/legacy-modes/mode/diff";
import { dockerFile } from "@codemirror/legacy-modes/mode/dockerfile";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { perl } from "@codemirror/legacy-modes/mode/perl";
import { powerShell } from "@codemirror/legacy-modes/mode/powershell";
import { properties } from "@codemirror/legacy-modes/mode/properties";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { swift } from "@codemirror/legacy-modes/mode/swift";
import { toml } from "@codemirror/legacy-modes/mode/toml";

export type LanguageDef = {
  id: string;
  label: string;
  extensions: string[];
  build: () => Extension;
};

function stream(parser: StreamParser<unknown>, line?: string): Extension {
  const lang = StreamLanguage.define(parser);
  if (!line) return lang;
  return [lang, lang.data.of({ commentTokens: { line } })];
}

function jsonWithLint(): Extension {
  return [
    json(),
    linter((view): Diagnostic[] => {
      const text = view.state.doc.toString();
      if (!text.trim()) return [];
      try {
        JSON.parse(text);
        return [];
      } catch (err) {
        const message = err instanceof Error ? err.message : "Invalid JSON";
        const pos = /position\s+(\d+)/i.exec(message);
        let at = pos ? Number(pos[1]) : 0;
        const line = /line\s+(\d+)/i.exec(message);
        const column = /column\s+(\d+)/i.exec(message);
        if (!pos && line) {
          const n = Number(line[1]);
          if (n >= 1 && n <= view.state.doc.lines) {
            const row = view.state.doc.line(n);
            at = row.from + Math.max(0, (column ? Number(column[1]) : 1) - 1);
          }
        }
        at = Math.max(0, Math.min(at, text.length));
        return [{ from: at, to: Math.min(text.length, at + 1), severity: "error", message }];
      }
    }),
  ];
}

const DEFS: LanguageDef[] = [
  { id: "text", label: "Plain text", extensions: ["txt", "log", "csv"], build: () => [] },
  { id: "c", label: "C", extensions: ["c"], build: () => cpp() },
  { id: "cpp", label: "C++", extensions: ["cpp", "cc", "cxx", "h", "hh", "hpp", "hxx"], build: () => cpp() },
  { id: "csharp", label: "C#", extensions: ["cs"], build: () => stream(csharp, "//") },
  { id: "css", label: "CSS", extensions: ["css", "scss"], build: () => css() },
  { id: "diff", label: "Diff", extensions: ["diff", "patch"], build: () => stream(diff) },
  { id: "dockerfile", label: "Dockerfile", extensions: ["dockerfile"], build: () => stream(dockerFile, "#") },
  { id: "go", label: "Go", extensions: ["go"], build: () => go() },
  { id: "html", label: "HTML", extensions: ["html", "htm", "vue"], build: () => html() },
  { id: "ini", label: "INI", extensions: ["ini", "cfg", "conf", "properties", "env"], build: () => stream(properties, "#") },
  { id: "java", label: "Java", extensions: ["java"], build: () => java() },
  { id: "javascript", label: "JavaScript", extensions: ["js", "mjs", "cjs"], build: () => javascript() },
  { id: "json", label: "JSON", extensions: ["json"], build: () => jsonWithLint() },
  { id: "jsx", label: "JSX", extensions: ["jsx"], build: () => javascript({ jsx: true }) },
  { id: "kotlin", label: "Kotlin", extensions: ["kt", "kts"], build: () => stream(kotlin, "//") },
  { id: "less", label: "Less", extensions: ["less"], build: () => less() },
  { id: "lua", label: "Lua", extensions: ["lua"], build: () => stream(lua, "--") },
  { id: "markdown", label: "Markdown", extensions: ["md", "markdown", "mdx"], build: () => markdown() },
  { id: "objectivec", label: "Objective-C", extensions: ["m", "mm"], build: () => stream(objectiveC, "//") },
  { id: "perl", label: "Perl", extensions: ["pl", "pm"], build: () => stream(perl, "#") },
  { id: "php", label: "PHP", extensions: ["php"], build: () => php() },
  { id: "powershell", label: "PowerShell", extensions: ["ps1"], build: () => stream(powerShell, "#") },
  { id: "python", label: "Python", extensions: ["py"], build: () => python() },
  { id: "ruby", label: "Ruby", extensions: ["rb"], build: () => stream(ruby, "#") },
  { id: "rust", label: "Rust", extensions: ["rs"], build: () => rust() },
  { id: "scala", label: "Scala", extensions: ["scala"], build: () => stream(scala, "//") },
  { id: "shell", label: "Shell", extensions: ["sh", "bash", "zsh"], build: () => stream(shell, "#") },
  { id: "sql", label: "SQL", extensions: ["sql"], build: () => sql() },
  { id: "swift", label: "Swift", extensions: ["swift"], build: () => stream(swift, "//") },
  { id: "toml", label: "TOML", extensions: ["toml"], build: () => stream(toml, "#") },
  { id: "typescript", label: "TypeScript", extensions: ["ts", "mts", "cts"], build: () => javascript({ typescript: true }) },
  { id: "tsx", label: "TSX", extensions: ["tsx"], build: () => javascript({ jsx: true, typescript: true }) },
  { id: "xml", label: "XML", extensions: ["xml", "svg", "xsl"], build: () => xml() },
  { id: "yaml", label: "YAML", extensions: ["yml", "yaml"], build: () => yaml() },
];

const byId = new Map(DEFS.map((lang) => [lang.id, lang]));
const byExt = new Map<string, string>();
for (const lang of DEFS) {
  for (const ext of lang.extensions) byExt.set(ext, lang.id);
}

const cache = new Map<string, Extension>();

export const LANGUAGES: LanguageDef[] = [
  DEFS[0],
  ...DEFS.slice(1).sort((a, b) => a.label.localeCompare(b.label)),
];

export function languageLabel(id: string): string {
  return byId.get(id)?.label ?? "Plain text";
}

export function extensionFor(id: string): Extension {
  const hit = cache.get(id);
  if (hit) return hit;
  const built = byId.get(id)?.build() ?? [];
  cache.set(id, built);
  return built;
}

const SPECIAL: Record<string, string> = {
  dockerfile: "dockerfile",
  makefile: "shell",
  gemfile: "ruby",
};

export function languageFromName(filename: string): string | null {
  const base = filename.split(/[/\\]/).pop() ?? filename;
  const special = SPECIAL[base.toLowerCase()];
  if (special) return special;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return null;
  return byExt.get(base.slice(dot + 1).toLowerCase()) ?? null;
}
