/**
 * 生成数学站引擎隔离自测入口 math/tools/fixture.html：
 * 保留 math/index.html 的全部引擎脚本，但把 data/*.js 换成 tools/fixture-data.js。
 * 用法：node math/tools/make-fixture.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MATH = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(MATH, "index.html"), "utf8");

const out = html
  .split("\n")
  .filter((l) => !/<script src="data\/[\w-]+\.js"><\/script>/.test(l))
  .flatMap((l) => {
    if (/src="app\/markdown\.js"/.test(l)) return ['  <script src="tools/fixture-data.js"></script>', l];
    if (/window\.COURSE_PACKS = \[\]/.test(l)) return ["  COURSE_PACKS = [];"];
    return [l];
  })
  .join("\n");

writeFileSync(join(MATH, "tools", "fixture.html"), out, "utf8");
const srcs = [...out.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
console.log("已生成 math/tools/fixture.html，脚本顺序：\n  " + srcs.join("\n  "));
