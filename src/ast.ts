export type Expr =
  | { kind: "NumberLiteral"; value: number }
  | { kind: "Identifier"; name: string }
  | { kind: "BinaryExpr"; op: string; left: Expr; right: Expr }
  | { kind: "IndexExpr"; array: Expr; index: Expr }
  | { kind: "CallExpr"; callee: string; args: Expr[] };

export type Stmt =
  | { kind: "Assign"; name: string; value: Expr }
  | { kind: "If"; condition: Expr; body: Stmt[] }
  | { kind: "For"; varName: string; iterable: Expr; body: Stmt[] }
  | { kind: "ExprStmt"; expr: Expr };

export type Program = Stmt[];
