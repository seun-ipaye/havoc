import { lex } from "./lexer";
import { parse } from "./parser";

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
const tokens = lex(source);

if (process.argv[3] === "--tokens") {
  for (const token of tokens) {
    console.log(`${token.line}\t${token.type}\t${JSON.stringify(token.value)}`);
  }
} else {
  const program = parse(tokens);
  console.log(JSON.stringify(program, null, 2));
}
