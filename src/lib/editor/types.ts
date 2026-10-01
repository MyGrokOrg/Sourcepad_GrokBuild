export type Eol = "lf" | "crlf";
export type ThemeName = "dark" | "light";

export type Doc = {
  id: string;
  name: string;
  language: string;
  eol: Eol;
  dirty: boolean;
};

export type Settings = {
  theme: ThemeName;
  wordWrap: boolean;
  showWhitespace: boolean;
  tabSize: number;
  insertSpaces: boolean;
  fontSize: number;
  showFunctions: boolean;
};

export type Stats = {
  line: number;
  col: number;
  selChars: number;
  selLines: number;
  length: number;
  lines: number;
};

export const EMPTY_STATS: Stats = {
  line: 1,
  col: 1,
  selChars: 0,
  selLines: 0,
  length: 0,
  lines: 1,
};
