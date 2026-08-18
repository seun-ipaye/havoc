export type TokenType =
  | "NUMBER"
  | "IDENTIFIER"
  | "IF"
  | "ELSE"
  | "WHILE"
  | "FOR"
  | "IN"
  | "PLUS"
  | "MINUS"
  | "STAR"
  | "SLASH"
  | "PERCENT"
  | "ASSIGN"
  | "EQ"
  | "NEQ"
  | "LT"
  | "LTE"
  | "GT"
  | "GTE"
  | "LPAREN"
  | "RPAREN"
  | "LBRACE"
  | "RBRACE"
  | "LBRACKET"
  | "RBRACKET"
  | "NEWLINE"
  | "EOF";

export interface Token {
  type: TokenType;
  value: string;
  line: number;
}

const KEYWORDS: Record<string, TokenType> = {
  if: "IF",
  else: "ELSE",
  while: "WHILE",
  for: "FOR",
  in: "IN",
};

const TWO_CHAR_OPERATORS: Record<string, TokenType> = {
  "==": "EQ",
  "!=": "NEQ",
  "<=": "LTE",
  ">=": "GTE",
};

const ONE_CHAR_OPERATORS: Record<string, TokenType> = {
  "+": "PLUS",
  "-": "MINUS",
  "*": "STAR",
  "/": "SLASH",
  "%": "PERCENT",
  "=": "ASSIGN",
  "<": "LT",
  ">": "GT",
  "(": "LPAREN",
  ")": "RPAREN",
  "{": "LBRACE",
  "}": "RBRACE",
  "[": "LBRACKET",
  "]": "RBRACKET",
};

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function isIdentifierStart(ch: string): boolean {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
}

function isIdentifierPart(ch: string): boolean {
  return isIdentifierStart(ch) || isDigit(ch);
}

export function lex(source: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  let line = 1;

  const peek = (offset = 0): string => source[pos + offset] ?? "";
  const lastTokenType = (): TokenType | undefined =>
    tokens.length > 0 ? tokens[tokens.length - 1].type : undefined;

  while (pos < source.length) {
    const ch = peek();

    if (ch === "\n") {
      if (lastTokenType() !== undefined && lastTokenType() !== "NEWLINE") {
        tokens.push({ type: "NEWLINE", value: "\n", line });
      }
      line++;
      pos++;
      continue;
    }

    if (ch === " " || ch === "\t" || ch === "\r") {
      pos++;
      continue;
    }

    if (ch === "/" && peek(1) === "/") {
      while (pos < source.length && peek() !== "\n") {
        pos++;
      }
      continue;
    }

    if (isDigit(ch)) {
      const start = pos;
      while (isDigit(peek())) {
        pos++;
      }
      tokens.push({ type: "NUMBER", value: source.slice(start, pos), line });
      continue;
    }

    if (isIdentifierStart(ch)) {
      const start = pos;
      while (isIdentifierPart(peek())) {
        pos++;
      }
      const text = source.slice(start, pos);
      const keywordType = KEYWORDS[text];
      tokens.push({ type: keywordType ?? "IDENTIFIER", value: text, line });
      continue;
    }

    const twoChar = ch + peek(1);
    if (TWO_CHAR_OPERATORS[twoChar]) {
      tokens.push({ type: TWO_CHAR_OPERATORS[twoChar], value: twoChar, line });
      pos += 2;
      continue;
    }

    if (ONE_CHAR_OPERATORS[ch]) {
      tokens.push({ type: ONE_CHAR_OPERATORS[ch], value: ch, line });
      pos++;
      continue;
    }

    throw new Error(`Unexpected character '${ch}' at line ${line}`);
  }

  if (lastTokenType() === "NEWLINE") {
    tokens.pop();
  }

  tokens.push({ type: "EOF", value: "", line });
  return tokens;
}
