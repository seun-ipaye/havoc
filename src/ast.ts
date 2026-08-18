export type Type = "int" | "bool" | "int[]" | "void";

export type Expr =
  | { kind: "NumberLiteral"; value: number; line: number; type?: Type }
  | { kind: "BoolLiteral"; value: boolean; line: number; type?: Type }
  | { kind: "Identifier"; name: string; line: number; type?: Type }
  | { kind: "UnaryExpr"; op: string; operand: Expr; line: number; type?: Type }
  | { kind: "BinaryExpr"; op: string; left: Expr; right: Expr; line: number; type?: Type }
  | { kind: "IndexExpr"; array: Expr; index: Expr; line: number; type?: Type }
  | { kind: "CallExpr"; callee: string; args: Expr[]; line: number; type?: Type };

export type Stmt =
  | { kind: "Assign"; name: string; value: Expr; line: number }
  | { kind: "IndexAssign"; array: Expr; index: Expr; value: Expr; line: number }
  | { kind: "If"; condition: Expr; body: Stmt[]; elseBody?: Stmt[]; line: number }
  | { kind: "While"; condition: Expr; body: Stmt[]; line: number }
  | { kind: "For"; varName: string; iterable: Expr; body: Stmt[]; line: number }
  | { kind: "Return"; value?: Expr; line: number }
  | { kind: "ExprStmt"; expr: Expr; line: number };

export interface Param {
  name: string;
  type: Type;
}

export interface FunctionDef {
  kind: "FunctionDef";
  name: string;
  params: Param[];
  returnType: Type;
  body: Stmt[];
  line: number;
}

// Function definitions only ever appear at the top level, never nested
// inside a block — Item keeps that a type-level fact, not just a parser rule.
export type Item = FunctionDef | Stmt;
export type Program = Item[];
