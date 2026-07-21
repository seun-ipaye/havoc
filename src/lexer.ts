// Stage 1: Lexer.
// Turns raw source text into a flat list of Tokens.
// MVP scope: integers and + - * / ( ) only. Nothing else exists yet.

export enum TokenType {
  NUMBER = "NUMBER",
  PLUS = "PLUS",
  MINUS = "MINUS",
  STAR = "STAR",
  SLASH = "SLASH",
  LPAREN = "LPAREN",
  RPAREN = "RPAREN",
  EOF = "EOF",
}

export interface Token {
  type: TokenType;
  // The exact text this token came from, e.g. "42". Useful for error messages.
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

  function isAtEnd(): boolean {
    return current >= source.length;
  }

  while (!isAtEnd()) {
    const char = source[current];

    if (char === " " || char === "\t" || char === "\n") {
      current++;
      continue;
    }

    if (isDigit(char)) {
      let start = current;
      while (!isAtEnd() && isDigit(source[current])) {
        current++;
      }
      const lexeme = source.slice(start, current);
      tokens.push({ type: TokenType.NUMBER, lexeme, value: Number(lexeme) });
      continue;
    }

    const singleCharTokens: Record<string, TokenType> = {
      "+": TokenType.PLUS,
      "-": TokenType.MINUS,
      "*": TokenType.STAR,
      "/": TokenType.SLASH,
      "(": TokenType.LPAREN,
      ")": TokenType.RPAREN,
    };

    if (char in singleCharTokens) {
      tokens.push({ type: singleCharTokens[char], lexeme: char, value: null });
      current++;
      continue;
    }

    throw new Error(`Unexpected character '${char}' at position ${current}`);
  }

  tokens.push({ type: TokenType.EOF, lexeme: "", value: null });
  return tokens;
}
