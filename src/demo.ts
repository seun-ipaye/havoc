import { lex } from "./lexer";
import { parse } from "./parser";
import { typecheck } from "./typecheck";

const DEFAULT_PROGRAM = `n = read_int()
arr = read_ints(n)
max = arr[0]
for x in arr {
    if x > max {
        max = x
    }
}
print(max)
`;

const source = process.argv[2] ?? DEFAULT_PROGRAM;
const mode = process.argv[3];
const tokens = lex(source);

if (mode === "--tokens") {
  for (const token of tokens) {
    console.log(`${token.line}\t${token.type}\t${JSON.stringify(token.value)}`);
  }
} else {
  const program = parse(tokens);
  if (mode !== "--ast") {
    typecheck(program);
  }
  console.log(JSON.stringify(program, null, 2));
}
