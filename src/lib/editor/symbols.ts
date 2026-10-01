export type SymbolHit = {
  line: number;
  label: string;
  kind: string;
  level: number;
};

type Rule = { kind: string; re: RegExp };

const RULES: Record<string, Rule[]> = {
  python: [
    { kind: "class", re: /^\s*class\s+(\w+)/ },
    { kind: "def", re: /^\s*(?:async\s+)?def\s+(\w+)/ },
  ],
  javascript: [
    { kind: "fn", re: /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)/ },
    { kind: "class", re: /^\s*(?:export\s+)?class\s+(\w+)/ },
    { kind: "fn", re: /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_][\w]*\s*=>)/ },
  ],
  jsx: [],
  typescript: [],
  tsx: [],
  java: [
    { kind: "type", re: /^\s*(?:public|private|protected|abstract|final|static|\s)*\s*(?:class|interface|enum|record)\s+(\w+)/ },
    { kind: "fn", re: /^\s*(?:public|private|protected|static|final|synchronized|\s)+[\w<>\[\],\s.?]+\s+(\w+)\s*\([^;]*\)\s*\{?\s*$/ },
  ],
  c: [],
  cpp: [
    { kind: "type", re: /^\s*(?:template\s*<[^>]+>\s*)?(?:class|struct|enum|union)\s+(\w+)/ },
    { kind: "fn", re: /^[\w:<>,\s\*&:~]+\s+(\w+)\s*\([^;]*\)\s*(?:const)?\s*\{?\s*$/ },
  ],
  csharp: [
    { kind: "type", re: /^\s*(?:public|private|protected|internal|abstract|sealed|static|partial|\s)*(?:class|interface|enum|struct|record)\s+(\w+)/ },
  ],
  go: [
    { kind: "fn", re: /^\s*func\s+(?:\([^)]+\)\s*)?(\w+)/ },
    { kind: "type", re: /^\s*type\s+(\w+)/ },
  ],
  rust: [
    { kind: "fn", re: /^\s*(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/ },
    { kind: "type", re: /^\s*(?:pub\s+)?(?:struct|enum|trait|type|impl)\s+(\w+)/ },
  ],
  php: [
    { kind: "fn", re: /^\s*(?:public|private|protected|static|\s)*function\s+(\w+)/ },
    { kind: "type", re: /^\s*(?:abstract\s+|final\s+)?class\s+(\w+)/ },
  ],
  ruby: [
    { kind: "def", re: /^\s*def\s+(?:self\.)?([\w?!=]+)/ },
    { kind: "class", re: /^\s*class\s+([\w:]+)/ },
  ],
  swift: [
    { kind: "fn", re: /^\s*(?:public|private|internal|open|fileprivate|\s)*(?:static\s+)?func\s+(\w+)/ },
    { kind: "type", re: /^\s*(?:public|private|internal|open|final|\s)*(?:class|struct|enum|protocol)\s+(\w+)/ },
  ],
  kotlin: [
    { kind: "fn", re: /^\s*(?:suspend\s+|private\s+|public\s+|internal\s+|override\s+)*fun\s+(\w+)/ },
    { kind: "type", re: /^\s*(?:data\s+|sealed\s+|abstract\s+|open\s+)*(?:class|interface|object)\s+(\w+)/ },
  ],
  scala: [
    { kind: "fn", re: /^\s*def\s+(\w+)/ },
    { kind: "type", re: /^\s*(?:class|object|trait)\s+(\w+)/ },
  ],
  shell: [
    { kind: "fn", re: /^\s*(?:function\s+)?(\w+)\s*\(\s*\)\s*\{/ },
    { kind: "fn", re: /^\s*(\w+)\s*\(\)\s*\{/ },
  ],
  lua: [
    { kind: "fn", re: /^\s*(?:local\s+)?function\s+([\w.:]+)/ },
  ],
  perl: [{ kind: "fn", re: /^\s*sub\s+(\w+)/ }],
  markdown: [
    { kind: "h1", re: /^#\s+(.+)/ },
    { kind: "h2", re: /^##\s+(.+)/ },
    { kind: "h3", re: /^###\s+(.+)/ },
    { kind: "h4", re: /^####+\s+(.+)/ },
  ],
  css: [{ kind: "rule", re: /^([^{}/][^{]*)\{/ }],
  less: [{ kind: "rule", re: /^([^{}/][^{]*)\{/ }],
  html: [{ kind: "id", re: /\sid=["']([^"']+)["']/ }],
  xml: [{ kind: "id", re: /\sid=["']([^"']+)["']/ }],
  json: [{ kind: "key", re: /^ {2}"([^"]+)"\s*:/ }],
};

const JS_FAMILY = ["javascript", "jsx", "typescript", "tsx"];
const C_FAMILY = ["c", "cpp", "objectivec"];

export function extractSymbols(language: string, content: string): SymbolHit[] {
  let rules = RULES[language];
  if (!rules?.length && JS_FAMILY.includes(language)) rules = RULES.javascript;
  if (!rules?.length && C_FAMILY.includes(language)) rules = RULES.cpp;
  if (!rules?.length) {
    rules = [
      { kind: "fn", re: /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/ },
      { kind: "class", re: /^\s*(?:export\s+)?class\s+(\w+)/ },
      { kind: "fn", re: /^\s*(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/ },
      { kind: "fn", re: /^\s*def\s+(\w+)/ },
    ];
  }
  const hits: SymbolHit[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length && hits.length < 300; i++) {
    const line = lines[i] ?? "";
    if (!line.trim() || line.trim().startsWith("//") || line.trim().startsWith("#")) {
      if (language !== "markdown" && language !== "python" && language !== "shell") continue;
    }
    for (const rule of rules) {
      const match = rule.re.exec(line);
      const label = match?.[1]?.trim();
      if (!label) continue;
      const indent = line.match(/^\s*/)?.[0].length ?? 0;
      hits.push({
        line: i + 1,
        label: label.length > 72 ? `${label.slice(0, 69)}…` : label,
        kind: rule.kind,
        level: Math.min(4, Math.floor(indent / 2)),
      });
      break;
    }
  }
  return hits;
}
