import { lex } from "./lexer";

const source = process.argv[2] ?? "2 + 3 * (4 - 1)";
console.log(`source: ${source}`);
console.log(lex(source));
