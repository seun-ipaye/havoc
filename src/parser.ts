import { Token, TokenType } from "./lexer";
import { Expr, FunctionDef, Item, Param, Program, Stmt, Type } from "./ast";

const COMPARISON_OPS: TokenType[] = ["EQ", "NEQ", "LT", "LTE", "GT", "GTE"];
const ADDITIVE_OPS: TokenType[] = ["PLUS", "MINUS"];
const MULTIPLICATIVE_OPS: TokenType[] = ["STAR", "SLASH", "PERCENT"];

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)];
  }

  private check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private advance(): Token {
    const token = this.peek();
    if (token.type !== "EOF") {
      this.pos++;
    }
    return token;
  }

  private match(type: TokenType): Token | undefined {
    return this.check(type) ? this.advance() : undefined;
  }

  private expect(type: TokenType, message: string): Token {
    if (this.check(type)) {
      return this.advance();
    }
    const token = this.peek();
    throw new Error(
      `${message} at line ${token.line}, got ${token.type} ${JSON.stringify(token.value)}`
    );
  }

  private skipNewlines(): void {
    while (this.match("NEWLINE")) {
      // consume
    }
  }

  parseProgram(): Program {
    // Top-level only: this is deliberately separate from parseStatementList
    // (used for blocks) so `func` can never appear nested inside an if/for/
    // while/function body — function definitions only exist at the top level.
    const items: Item[] = [];
    this.skipNewlines();
    while (!this.check("EOF")) {
      items.push(this.check("FUNC") ? this.parseFunctionDef() : this.parseStatement());
      if (this.check("EOF")) {
        break;
      }
      this.expect("NEWLINE", "Expected newline after statement");
      this.skipNewlines();
    }
    this.expect("EOF", "Expected end of file");
    return items;
  }

  private parseFunctionDef(): FunctionDef {
    const line = this.expect("FUNC", "Expected 'func'").line;
    const name = this.expect("IDENTIFIER", "Expected function name").value;
    this.expect("LPAREN", "Expected '('");
    const params: Param[] = [];
    if (!this.check("RPAREN")) {
      params.push(this.parseParam());
      while (this.match("COMMA")) {
        params.push(this.parseParam());
      }
    }
    this.expect("RPAREN", "Expected ')'");
    const returnType: Type = this.match("ARROW") ? this.parseType() : "void";
    const body = this.parseBlock();
    return { kind: "FunctionDef", name, params, returnType, body, line };
  }

  private parseParam(): Param {
    const name = this.expect("IDENTIFIER", "Expected parameter name").value;
    this.expect("COLON", "Expected ':'");
    const type = this.parseType();
    return { name, type };
  }

  private parseType(): Type {
    if (this.match("LBRACKET")) {
      const inner = this.expect("IDENTIFIER", "Expected element type");
      this.expect("RBRACKET", "Expected ']'");
      if (inner.value !== "int") {
        throw new Error(`Unknown array element type '${inner.value}' at line ${inner.line}`);
      }
      return "int[]";
    }
    const name = this.expect("IDENTIFIER", "Expected type name");
    if (name.value === "int" || name.value === "bool") {
      return name.value;
    }
    throw new Error(`Unknown type '${name.value}' at line ${name.line}`);
  }

  private parseStatementList(terminator: TokenType): Stmt[] {
    const stmts: Stmt[] = [];
    this.skipNewlines();
    while (!this.check(terminator) && !this.check("EOF")) {
      stmts.push(this.parseStatement());
      if (this.check(terminator) || this.check("EOF")) {
        break;
      }
      this.expect("NEWLINE", "Expected newline after statement");
      this.skipNewlines();
    }
    return stmts;
  }

  private parseBlock(): Stmt[] {
    this.expect("LBRACE", "Expected '{'");
    const stmts = this.parseStatementList("RBRACE");
    this.expect("RBRACE", "Expected '}'");
    return stmts;
  }

  private parseStatement(): Stmt {
    if (this.check("IF")) {
      return this.parseIf();
    }
    if (this.check("WHILE")) {
      return this.parseWhile();
    }
    if (this.check("FOR")) {
      return this.parseFor();
    }
    if (this.check("RETURN")) {
      return this.parseReturn();
    }

    // Parse a full expression first, then check for a trailing '=' — this
    // handles both `name = value` and `arr[i] = value` through the same
    // path, since parsePostfix already produces Identifier or IndexExpr
    // nodes for either. No separate lookahead special-case needed.
    const line = this.peek().line;
    const expr = this.parseExpr();
    if (!this.match("ASSIGN")) {
      return { kind: "ExprStmt", expr, line };
    }
    const value = this.parseExpr();
    if (expr.kind === "Identifier") {
      return { kind: "Assign", name: expr.name, value, line };
    }
    if (expr.kind === "IndexExpr") {
      return { kind: "IndexAssign", array: expr.array, index: expr.index, value, line };
    }
    throw new Error(`Invalid assignment target at line ${line}`);
  }

  private parseReturn(): Stmt {
    const line = this.expect("RETURN", "Expected 'return'").line;
    if (this.check("NEWLINE") || this.check("RBRACE") || this.check("EOF")) {
      return { kind: "Return", line };
    }
    return { kind: "Return", value: this.parseExpr(), line };
  }

  private parseIf(): Stmt {
    const line = this.expect("IF", "Expected 'if'").line;
    const condition = this.parseExpr();
    const body = this.parseBlock();
    if (!this.match("ELSE")) {
      return { kind: "If", condition, body, line };
    }
    // `else if` is just an else-block containing one more If statement —
    // no separate `elif` keyword needed.
    const elseBody = this.check("IF") ? [this.parseIf()] : this.parseBlock();
    return { kind: "If", condition, body, elseBody, line };
  }

  private parseWhile(): Stmt {
    const line = this.expect("WHILE", "Expected 'while'").line;
    const condition = this.parseExpr();
    const body = this.parseBlock();
    return { kind: "While", condition, body, line };
  }

  private parseFor(): Stmt {
    const line = this.expect("FOR", "Expected 'for'").line;
    const varName = this.expect("IDENTIFIER", "Expected loop variable name").value;
    this.expect("IN", "Expected 'in'");
    const iterable = this.parseExpr();
    const body = this.parseBlock();
    return { kind: "For", varName, iterable, body, line };
  }

  private parseExpr(): Expr {
    return this.parseComparison();
  }

  private parseComparison(): Expr {
    let left = this.parseAdditive();
    while (COMPARISON_OPS.includes(this.peek().type)) {
      const opToken = this.advance();
      const right = this.parseAdditive();
      left = { kind: "BinaryExpr", op: opToken.value, left, right, line: opToken.line };
    }
    return left;
  }

  private parseAdditive(): Expr {
    let left = this.parseMultiplicative();
    while (ADDITIVE_OPS.includes(this.peek().type)) {
      const opToken = this.advance();
      const right = this.parseMultiplicative();
      left = { kind: "BinaryExpr", op: opToken.value, left, right, line: opToken.line };
    }
    return left;
  }

  private parseMultiplicative(): Expr {
    let left = this.parseUnary();
    while (MULTIPLICATIVE_OPS.includes(this.peek().type)) {
      const opToken = this.advance();
      const right = this.parseUnary();
      left = { kind: "BinaryExpr", op: opToken.value, left, right, line: opToken.line };
    }
    return left;
  }

  private parseUnary(): Expr {
    if (this.check("MINUS")) {
      const opToken = this.advance();
      const operand = this.parseUnary();
      return { kind: "UnaryExpr", op: opToken.value, operand, line: opToken.line };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Expr {
    let expr = this.parsePrimary();
    while (this.check("LBRACKET")) {
      const bracket = this.advance();
      const index = this.parseExpr();
      this.expect("RBRACKET", "Expected ']'");
      expr = { kind: "IndexExpr", array: expr, index, line: bracket.line };
    }
    return expr;
  }

  private parsePrimary(): Expr {
    const token = this.peek();

    if (this.match("NUMBER")) {
      return { kind: "NumberLiteral", value: Number(token.value), line: token.line };
    }

    if (this.match("TRUE")) {
      return { kind: "BoolLiteral", value: true, line: token.line };
    }

    if (this.match("FALSE")) {
      return { kind: "BoolLiteral", value: false, line: token.line };
    }

    if (this.match("IDENTIFIER")) {
      if (this.check("LPAREN")) {
        this.advance();
        const args: Expr[] = [];
        if (!this.check("RPAREN")) {
          args.push(this.parseExpr());
          while (this.match("COMMA")) {
            args.push(this.parseExpr());
          }
        }
        this.expect("RPAREN", "Expected ')'");
        return { kind: "CallExpr", callee: token.value, args, line: token.line };
      }
      return { kind: "Identifier", name: token.value, line: token.line };
    }

    if (this.match("LPAREN")) {
      const expr = this.parseExpr();
      this.expect("RPAREN", "Expected ')'");
      return expr;
    }

    throw new Error(
      `Unexpected token ${token.type} ${JSON.stringify(token.value)} at line ${token.line}`
    );
  }
}

export function parse(tokens: Token[]): Program {
  return new Parser(tokens).parseProgram();
}
