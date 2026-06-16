import { readFile, writeFile } from "node:fs/promises";
import { transform } from "esbuild";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const result = await transform(source, {
  format: "iife",
  jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment",
  loader: "jsx",
  minify: true,
  sourcemap: false,
  target: "es2020"
});

await writeFile(new URL("../public/app.bundle.js", import.meta.url), result.code);
