import { Expr, FunctionDef, Item, Program, Stmt, Type } from "./ast";
import { RUNTIME_PRELUDE } from "./runtime";

// Part 4: transpile the typed AST straight to C. Static types map to
// unboxed C types (int64_t, bool, a data+length struct) with no boxing or
// dynamic dispatch, and the typed AST from Part 3 is consumed directly —
// codegen never re-derives a type, it only reads expr.type.
//
// Part 6: each Havoc function becomes a real C function. Prototypes for
// every function are emitted before any body, so forward references and
// mutual recursion just work — C itself only needs the declaration to
// exist above the call site, not the definition. Recursion needs nothing
// special: it's the native C call stack, not an emulated one.

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

// Unlike cType, "void" is a legal C return type — just not a legal variable type.
function cReturnType(type: Type): string {
  return type === "void" ? "void" : cType(type);
}

function zeroValue(type: Type): string {
  switch (type) {
    case "int":
      return "0LL";
    case "bool":
      return "false";
    case "int[]":
      return "{0}";
    case "void":
      throw new Error("codegen: void cannot be a variable's type");
  }
}

class CodeGenerator {
  private forCounter = 0;
  private functionNames = new Set<string>();

  generate(program: Program): string {
    const functionDefs = program.filter((item): item is FunctionDef => item.kind === "FunctionDef");
    const topLevelStmts = program.filter((item): item is Stmt => item.kind !== "FunctionDef");
    this.functionNames = new Set(functionDefs.map((fn) => fn.name));

    const prototypes = functionDefs.map((fn) => `${this.emitSignature(fn)};\n`).join("");
    const functionBodies = functionDefs.map((fn) => this.emitFunction(fn)).join("\n");

    const declarations = this.emitDeclarations(topLevelStmts);
    const body = this.emitStatements(topLevelStmts, INDENT);

    return (
      RUNTIME_PRELUDE +
      "\n" +
      prototypes +
      (prototypes ? "\n" : "") +
      functionBodies +
      (functionBodies ? "\n" : "") +
      "int main(void) {\n" +
      `${INDENT}havoc_arena_init();\n\n` +
      declarations +
      "\n" +
      body +
      `${INDENT}return 0;\n` +
      "}\n"
    );
  }

  private emitSignature(fn: FunctionDef): string {
    const params = fn.params.map((p) => `${cType(p.type)} h_${p.name}`).join(", ");
    return `${cReturnType(fn.returnType)} hfn_${fn.name}(${params || "void"})`;
  }

  private emitFunction(fn: FunctionDef): string {
    // Params are already declared as C function arguments — exclude them
    // from the local-variable declaration pass so they aren't redeclared.
    const paramNames = new Set(fn.params.map((p) => p.name));
    const declarations = this.emitDeclarations(fn.body, paramNames);
    const body = this.emitStatements(fn.body, INDENT);
    // No "all paths return" analysis (real control-flow work, deferred, same
    // as Part 5's definite-assignment gap): a non-void function that falls
    // off the end without an explicit `return` gets a default zero-value
    // return appended, so that's a defined-but-possibly-wrong value, never
    // undefined behavior in the caller.
    const trailingReturn = fn.returnType === "void" ? "" : `${INDENT}return ${zeroValue(fn.returnType)};\n`;
    return (
      `${this.emitSignature(fn)} {\n` +
      declarations +
      (declarations ? "\n" : "") +
      body +
      trailingReturn +
      "}\n"
    );
  }

  // Every variable is declared once at the top of its enclosing main()/
  // function; every later reference is a plain C assignment. Types come
  // straight from the typed AST Part 3 produced — one flat scope per
  // function (or the top level), so one declaration per name.
  private emitDeclarations(stmts: Stmt[], exclude: Set<string> = new Set()): string {
    const vars = new Map<string, Type>();
    this.collectDeclarations(stmts, vars);
    let out = "";
    for (const [name, type] of vars) {
      if (exclude.has(name)) {
        continue;
      }
      // Zero-initialized: the type-checker doesn't yet do definite-assignment
      // analysis (a variable set in only one `if`/`else` branch, or inside a
      // loop that might run zero times, still type-checks). Zero-init turns
      // "reads uninitialized stack memory" into "reads a defined but possibly
      // wrong 0" — not correct Havoc semantics, but not undefined behavior.
      out += `${INDENT}${cType(type)} h_${name} = ${zeroValue(type)};\n`;
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
        case "While":
          this.collectDeclarations(stmt.body, vars);
          break;
        case "If":
          this.collectDeclarations(stmt.body, vars);
          if (stmt.elseBody) {
            this.collectDeclarations(stmt.elseBody, vars);
          }
          break;
        case "Return":
        case "IndexAssign":
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

      case "IndexAssign":
        return (
          `${indent}*havoc_index_ptr(${this.emitExpr(stmt.array)}, ${this.emitExpr(stmt.index)}) = ` +
          `${this.emitExpr(stmt.value)};\n`
        );

      case "If": {
        let out =
          `${indent}if (${this.emitExpr(stmt.condition)}) {\n` +
          this.emitStatements(stmt.body, indent + INDENT) +
          `${indent}}`;
        if (stmt.elseBody) {
          out += ` else {\n` + this.emitStatements(stmt.elseBody, indent + INDENT) + `${indent}}`;
        }
        return out + "\n";
      }

      case "While":
        return (
          `${indent}while (${this.emitExpr(stmt.condition)}) {\n` +
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

      case "Return":
        return stmt.value === undefined
          ? `${indent}return;\n`
          : `${indent}return ${this.emitExpr(stmt.value)};\n`;

      case "ExprStmt":
        return `${indent}${this.emitExpr(stmt.expr)};\n`;
    }
  }

  private emitExpr(expr: Expr): string {
    switch (expr.kind) {
      case "NumberLiteral":
        return `${expr.value}LL`;

      case "BoolLiteral":
        return expr.value ? "true" : "false";

      case "Identifier":
        return `h_${expr.name}`;

      case "UnaryExpr":
        return `(${expr.op}${this.emitExpr(expr.operand)})`;

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
            if (this.functionNames.has(expr.callee)) {
              return `hfn_${expr.callee}(${expr.args.map((arg) => this.emitExpr(arg)).join(", ")})`;
            }
            // Unreachable post-typecheck: BUILTINS + the user function table
            // in typecheck.ts are the single source of truth for valid callees.
            throw new Error(`codegen: unhandled callee '${expr.callee}'`);
        }
    }
  }
}

export function generate(program: Program): string {
  return new CodeGenerator().generate(program);
}
