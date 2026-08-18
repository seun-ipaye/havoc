export type Type = "int" | "bool" | "int[]" | "void";

export type Expr =
  | { kind: "NumberLiteral"; value: number; line: number; type?: Type }
  | { kind: "Identifier"; name: string; line: number; type?: Type }
  | { kind: "UnaryExpr"; op: string; operand: Expr; line: number; type?: Type }
  | { kind: "BinaryExpr"; op: string; left: Expr; right: Expr; line: number; type?: Type }
  | { kind: "IndexExpr"; array: Expr; index: Expr; line: number; type?: Type }
  | { kind: "CallExpr"; callee: string; args: Expr[]; line: number; type?: Type };

export type Stmt =
  | { kind: "Assign"; name: string; value: Expr; line: number }
  | { kind: "If"; condition: Expr; body: Stmt[]; elseBody?: Stmt[]; line: number }
  | { kind: "While"; condition: Expr; body: Stmt[]; line: number }
  | { kind: "For"; varName: string; iterable: Expr; body: Stmt[]; line: number }
  | { kind: "ExprStmt"; expr: Expr; line: number };

export type Program = Stmt[];
