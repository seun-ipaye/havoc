import { lex } from "./lexer";

const defaultSource = `n = read_int()
arr = read_ints(n)
max = arr[0]
for x in arr {
    if x > max {
        max = x
    }
}
print(max)
`;

const source = process.argv[2] ?? defaultSource;
console.log(`source:\n${source}`);
console.log(
  lex(source)
    .map((t) => `${t.type}${t.value !== null ? `(${t.value})` : t.lexeme ? `(${t.lexeme})` : ""}`)
    .join(" ")
);
