import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";
import { lex } from "./lexer";
import { parse } from "./parser";
import { typecheck } from "./typecheck";
import { generate } from "./codegen";

// The actual Havoc compiler: source file in, native binary out.
// Havoc source -> generated C -> cc -> native binary. No VM, no LLVM IR.

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("usage: compile.ts <source.havoc> [-o <output>]");
  process.exit(1);
}

const outFlagIndex = process.argv.indexOf("-o");
const parsed = path.parse(inputPath);
const outputPath =
  outFlagIndex !== -1 ? process.argv[outFlagIndex + 1] : path.join(parsed.dir || ".", parsed.name);

const source = fs.readFileSync(inputPath, "utf8");
const tokens = lex(source);
const program = parse(tokens);
typecheck(program);
const cSource = generate(program);

const cPath = `${outputPath}.c`;
fs.writeFileSync(cPath, cSource);

execFileSync("cc", ["-O2", cPath, "-o", outputPath], { stdio: "inherit" });

console.log(`Compiled ${inputPath} -> ${outputPath}`);
