/**
 * 生成引擎隔离自测入口 tools/fixture.html：
 * 保留 index.html 的全部引擎脚本，但把 data/*.js 换成 tools/fixture-data.js（极小数据），
 * 并把 window.COURSE_PACKS 的初始化改成 vm 沙箱可见的全局赋值。
 * 用法：node tools/make-fixture.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const out = html
  .split("\n")
  .filter((l) => !/<script src="data\/[\w-]+\.js"><\/script>/.test(l))
  .flatMap((l) => {
    if (/src="app\/markdown\.js"/.test(l)) return ['  <script src="tools/fixture-data.js"></script>', l];
    if (/window\.COURSE_PACKS = \[\]/.test(l)) return ["  COURSE_PACKS = [];"];
    return [l];
  })
  .join("\n");

writeFileSync(join(ROOT, "tools", "fixture.html"), out, "utf8");
const srcs = [...out.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
console.log("已生成 tools/fixture.html，脚本顺序：\n  " + srcs.join("\n  "));
