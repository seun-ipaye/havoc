import { Expr, Program, Stmt, Type } from "./ast";

// Part 3 scope: one flat variable scope for the whole program (if/for don't
// introduce their own scope, since there are no functions yet to isolate
// from), a single top-to-bottom pass with no forward references, and a
// fixed built-in signature table kept separate from user variables.

interface BuiltinSignature {
  params: Type[];
  returns: Type;
}

const BUILTINS: Record<string, BuiltinSignature> = {
  read_int: { params: [], returns: "int" },
  read_ints: { params: ["int"], returns: "int[]" },
  print: { params: ["int"], returns: "void" },
};

const COMPARISON_OPS = new Set(["==", "!=", "<", "<=", ">", ">="]);

export class TypeCheckError extends Error {}

class TypeChecker {
  private vars = new Map<string, Type>();

  check(program: Program): Program {
    for (const stmt of program) {
      this.checkStmt(stmt);
    }
    return program;
  }

  private checkStmt(stmt: Stmt): void {
    switch (stmt.kind) {
      case "Assign": {
        const valueType = this.checkExpr(stmt.value);
        this.declareOrCheck(stmt.name, valueType, stmt.line);
        return;
      }
      case "If": {
        const conditionType = this.checkExpr(stmt.condition);
        if (conditionType !== "bool") {
          throw new TypeCheckError(
            `if condition must be bool, got ${conditionType} at line ${stmt.line}`
          );
        }
        for (const inner of stmt.body) this.checkStmt(inner);
        if (stmt.elseBody) {
          for (const inner of stmt.elseBody) this.checkStmt(inner);
        }
        return;
      }
      case "While": {
        const conditionType = this.checkExpr(stmt.condition);
        if (conditionType !== "bool") {
          throw new TypeCheckError(
            `while condition must be bool, got ${conditionType} at line ${stmt.line}`
          );
        }
        for (const inner of stmt.body) this.checkStmt(inner);
        return;
      }
      case "For": {
        const iterableType = this.checkExpr(stmt.iterable);
        if (iterableType !== "int[]") {
          throw new TypeCheckError(
            `for loop can only iterate int[], got ${iterableType} at line ${stmt.line}`
          );
        }
        this.declareOrCheck(stmt.varName, "int", stmt.line);
        for (const inner of stmt.body) this.checkStmt(inner);
        return;
      }
      case "ExprStmt": {
        this.checkExpr(stmt.expr);
        return;
      }
    }
  }

  private declareOrCheck(name: string, valueType: Type, line: number): void {
    if (valueType === "void") {
      throw new TypeCheckError(`cannot assign a void value to '${name}' at line ${line}`);
    }
    const existing = this.vars.get(name);
    if (existing === undefined) {
      this.vars.set(name, valueType);
      return;
    }
    if (existing !== valueType) {
      throw new TypeCheckError(
        `cannot assign ${valueType} to '${name}', already declared as ${existing} at line ${line}`
      );
    }
  }

  private checkExpr(expr: Expr): Type {
    switch (expr.kind) {
      case "NumberLiteral":
        expr.type = "int";
        return expr.type;

      case "Identifier": {
        const type = this.vars.get(expr.name);
        if (type === undefined) {
          throw new TypeCheckError(`'${expr.name}' used before assignment at line ${expr.line}`);
        }
        expr.type = type;
        return type;
      }

      case "UnaryExpr": {
        const operandType = this.checkExpr(expr.operand);
        if (operandType !== "int") {
          throw new TypeCheckError(
            `unary '${expr.op}' requires an int operand, got ${operandType} at line ${expr.line}`
          );
        }
        expr.type = "int";
        return expr.type;
      }

      case "BinaryExpr": {
        const leftType = this.checkExpr(expr.left);
        const rightType = this.checkExpr(expr.right);
        if (leftType !== "int" || rightType !== "int") {
          throw new TypeCheckError(
            `operator '${expr.op}' requires int operands, got ${leftType} and ${rightType} at line ${expr.line}`
          );
        }
        expr.type = COMPARISON_OPS.has(expr.op) ? "bool" : "int";
        return expr.type;
      }

      case "IndexExpr": {
        const arrayType = this.checkExpr(expr.array);
        const indexType = this.checkExpr(expr.index);
        if (arrayType !== "int[]") {
          throw new TypeCheckError(`cannot index a value of type ${arrayType} at line ${expr.line}`);
        }
        if (indexType !== "int") {
          throw new TypeCheckError(`array index must be int, got ${indexType} at line ${expr.line}`);
        }
        expr.type = "int";
        return expr.type;
      }

      case "CallExpr": {
        const signature = BUILTINS[expr.callee];
        if (signature === undefined) {
          throw new TypeCheckError(`unknown function '${expr.callee}' at line ${expr.line}`);
        }
        if (expr.args.length !== signature.params.length) {
          throw new TypeCheckError(
            `'${expr.callee}' expects ${signature.params.length} argument(s), got ${expr.args.length} at line ${expr.line}`
          );
        }
        expr.args.forEach((arg, i) => {
          const argType = this.checkExpr(arg);
          const paramType = signature.params[i];
          if (argType !== paramType) {
            throw new TypeCheckError(
              `'${expr.callee}' argument ${i + 1} expects ${paramType}, got ${argType} at line ${expr.line}`
            );
          }
        });
        expr.type = signature.returns;
        return expr.type;
      }
    }
  }
}

// Type-checks `program` in place, decorating every Expr node with its
// resolved `type`, and returns it so Part 4 (codegen) can consume the same
// typed AST directly instead of re-deriving types itself.
export function typecheck(program: Program): Program {
  return new TypeChecker().check(program);
}
