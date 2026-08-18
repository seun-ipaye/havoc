import { Expr, Program, Stmt, Type } from "./ast";
import { RUNTIME_PRELUDE } from "./runtime";

// Part 4: transpile the typed AST straight to C. Static types map to
// unboxed C types (int64_t, bool, a data+length struct) with no boxing or
// dynamic dispatch, and the typed AST from Part 3 is consumed directly —
// codegen never re-derives a type, it only reads expr.type.

const INDENT = "    ";

function cType(type: Type): string {
  switch (type) {
    case "int":
      return "int64_t";
    case "bool":
      return "bool";
    case "int[]":
      return "HavocIntArray";
    case "void":
      throw new Error("codegen: void cannot be a variable's type");
  }
}

class CodeGenerator {
  private forCounter = 0;

  generate(program: Program): string {
    const declarations = this.emitDeclarations(program);
    const body = this.emitStatements(program, INDENT);
    return (
      RUNTIME_PRELUDE +
      "\nint main(void) {\n" +
      `${INDENT}havoc_arena_init();\n\n` +
      declarations +
      "\n" +
      body +
      `${INDENT}return 0;\n` +
      "}\n"
    );
  }

  // Every variable is declared once at the top of main(); every later
  // reference is a plain C assignment. Types come straight from the typed
  // AST Part 3 produced — one flat scope, so one declaration per name.
  private emitDeclarations(stmts: Stmt[]): string {
    const vars = new Map<string, Type>();
    this.collectDeclarations(stmts, vars);
    let out = "";
    for (const [name, type] of vars) {
      out += `${INDENT}${cType(type)} h_${name};\n`;
    }
    return out;
  }

  private collectDeclarations(stmts: Stmt[], vars: Map<string, Type>): void {
    for (const stmt of stmts) {
      switch (stmt.kind) {
        case "Assign":
          if (!vars.has(stmt.name)) {
            vars.set(stmt.name, stmt.value.type!);
          }
          break;
        case "For":
          if (!vars.has(stmt.varName)) {
            vars.set(stmt.varName, "int");
          }
          this.collectDeclarations(stmt.body, vars);
          break;
        case "If":
          this.collectDeclarations(stmt.body, vars);
          break;
        case "ExprStmt":
          break;
      }
    }
  }

  private emitStatements(stmts: Stmt[], indent: string): string {
    return stmts.map((stmt) => this.emitStmt(stmt, indent)).join("");
  }

  private emitStmt(stmt: Stmt, indent: string): string {
    switch (stmt.kind) {
      case "Assign":
        return `${indent}h_${stmt.name} = ${this.emitExpr(stmt.value)};\n`;

      case "If":
        return (
          `${indent}if (${this.emitExpr(stmt.condition)}) {\n` +
          this.emitStatements(stmt.body, indent + INDENT) +
          `${indent}}\n`
        );

      case "For": {
        // The iterable is evaluated once into a temporary — inlining it
        // into the loop condition would re-run it (and any side effects,
        // like reading stdin) on every single iteration check.
        const id = this.forCounter++;
        const arrVar = `__havoc_arr${id}`;
        const idxVar = `__havoc_idx${id}`;
        return (
          `${indent}{\n` +
          `${indent}${INDENT}HavocIntArray ${arrVar} = ${this.emitExpr(stmt.iterable)};\n` +
          `${indent}${INDENT}for (int64_t ${idxVar} = 0; ${idxVar} < ${arrVar}.length; ${idxVar}++) {\n` +
          `${indent}${INDENT}${INDENT}h_${stmt.varName} = ${arrVar}.data[${idxVar}];\n` +
          this.emitStatements(stmt.body, indent + INDENT + INDENT) +
          `${indent}${INDENT}}\n` +
          `${indent}}\n`
        );
      }

      case "ExprStmt":
        return `${indent}${this.emitExpr(stmt.expr)};\n`;
    }
  }

  private emitExpr(expr: Expr): string {
    switch (expr.kind) {
      case "NumberLiteral":
        return `${expr.value}LL`;

      case "Identifier":
        return `h_${expr.name}`;

      case "BinaryExpr":
        // Havoc's operator lexemes (+ - * / % == != < <= > >=) are all
        // valid, identical C operators — no translation table needed.
        // Integer division truncates toward zero in both languages.
        return `(${this.emitExpr(expr.left)} ${expr.op} ${this.emitExpr(expr.right)})`;

      case "IndexExpr":
        return `havoc_index(${this.emitExpr(expr.array)}, ${this.emitExpr(expr.index)})`;

      case "CallExpr":
        switch (expr.callee) {
          case "read_int":
            return "havoc_read_int()";
          case "read_ints":
            return `havoc_read_ints(${this.emitExpr(expr.args[0])})`;
          case "print":
            return `havoc_print_int(${this.emitExpr(expr.args[0])})`;
          default:
            // Unreachable post-typecheck: BUILTINS in typecheck.ts is the
            // single source of truth for valid callees.
            throw new Error(`codegen: unhandled builtin '${expr.callee}'`);
        }
    }
  }
}

export function generate(program: Program): string {
  return new CodeGenerator().generate(program);
}
