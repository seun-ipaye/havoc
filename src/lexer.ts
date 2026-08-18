// Stage 1: Lexer.
// Turns raw source text into a flat list of Tokens.
// Scope: everything Part 0 decided for v1 — integers, identifiers/keywords,
// arithmetic + comparison operators, () [] {}, // comments, and newline as
// the statement terminator. No strings, no floats, no bool literals yet.

export enum TokenType {
  NUMBER = "NUMBER",
  IDENTIFIER = "IDENTIFIER",

  // Keywords
  IF = "IF",
  FOR = "FOR",
  IN = "IN",

  // Arithmetic operators
  PLUS = "PLUS",
  MINUS = "MINUS",
  STAR = "STAR",
  SLASH = "SLASH",
  PERCENT = "PERCENT",

  // Assignment and comparison operators
  ASSIGN = "ASSIGN",
  EQ = "EQ",
  NEQ = "NEQ",
  LT = "LT",
  LTE = "LTE",
  GT = "GT",
  GTE = "GTE",

  // Punctuation
  LPAREN = "LPAREN",
  RPAREN = "RPAREN",
  LBRACE = "LBRACE",
  RBRACE = "RBRACE",
  LBRACKET = "LBRACKET",
  RBRACKET = "RBRACKET",

  NEWLINE = "NEWLINE",
  EOF = "EOF",
}

const KEYWORDS: Record<string, TokenType> = {
  if: TokenType.IF,
  for: TokenType.FOR,
  in: TokenType.IN,
};

export interface Token {
  type: TokenType;
  // The exact text this token came from, e.g. "42" or "read_int". Useful for error messages.
  lexeme: string;
  // The actual value, only meaningful for NUMBER tokens right now.
  value: number | null;
}

export function lex(source: string): Token[] {
  const tokens: Token[] = [];
  let current = 0; // index of the character we're looking at

  function isDigit(char: string): boolean {
    return char >= "0" && char <= "9";
  }

  function isIdentifierStart(char: string): boolean {
    return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z") || char === "_";
  }

  function isIdentifierChar(char: string): boolean {
    return isIdentifierStart(char) || isDigit(char);
  }

  function isAtEnd(): boolean {
    return current >= source.length;
  }

  function peekNext(): string {
    return current + 1 < source.length ? source[current + 1] : "\0";
  }

  function lastTokenType(): TokenType | null {
    return tokens.length > 0 ? tokens[tokens.length - 1].type : null;
  }

  while (!isAtEnd()) {
    const char = source[current];

    if (char === " " || char === "\t" || char === "\r") {
      current++;
      continue;
    }

    if (char === "\n") {
      // Collapse blank lines into a single NEWLINE, and don't emit a
      // leading NEWLINE before any real token has appeared.
      const last = lastTokenType();
      if (last !== null && last !== TokenType.NEWLINE) {
        tokens.push({ type: TokenType.NEWLINE, lexeme: "\n", value: null });
      }
      current++;
      continue;
    }

    if (char === "/" && peekNext() === "/") {
      while (!isAtEnd() && source[current] !== "\n") {
        current++;
      }
      continue;
    }

    if (isDigit(char)) {
      const start = current;
      while (!isAtEnd() && isDigit(source[current])) {
        current++;
      }
      const lexeme = source.slice(start, current);
      tokens.push({ type: TokenType.NUMBER, lexeme, value: Number(lexeme) });
      continue;
    }

    if (isIdentifierStart(char)) {
      const start = current;
      while (!isAtEnd() && isIdentifierChar(source[current])) {
        current++;
      }
      const lexeme = source.slice(start, current);
      const keywordType = KEYWORDS[lexeme];
      tokens.push({ type: keywordType ?? TokenType.IDENTIFIER, lexeme, value: null });
      continue;
    }

    // Two-character operators must be checked before their one-character prefixes.
    const two = char + peekNext();
    const twoCharTokens: Record<string, TokenType> = {
      "==": TokenType.EQ,
      "!=": TokenType.NEQ,
      "<=": TokenType.LTE,
      ">=": TokenType.GTE,
    };

    if (two in twoCharTokens) {
      tokens.push({ type: twoCharTokens[two], lexeme: two, value: null });
      current += 2;
      continue;
    }

    const singleCharTokens: Record<string, TokenType> = {
      "+": TokenType.PLUS,
      "-": TokenType.MINUS,
      "*": TokenType.STAR,
      "/": TokenType.SLASH,
      "%": TokenType.PERCENT,
      "=": TokenType.ASSIGN,
      "<": TokenType.LT,
      ">": TokenType.GT,
      "(": TokenType.LPAREN,
      ")": TokenType.RPAREN,
      "{": TokenType.LBRACE,
      "}": TokenType.RBRACE,
      "[": TokenType.LBRACKET,
      "]": TokenType.RBRACKET,
    };

    if (char in singleCharTokens) {
      tokens.push({ type: singleCharTokens[char], lexeme: char, value: null });
      current++;
      continue;
    }

    throw new Error(`Unexpected character '${char}' at position ${current}`);
  }

  // Drop a trailing NEWLINE right before EOF — it doesn't terminate a statement.
  if (lastTokenType() === TokenType.NEWLINE) {
    tokens.pop();
  }

  tokens.push({ type: TokenType.EOF, lexeme: "", value: null });
  return tokens;
}
