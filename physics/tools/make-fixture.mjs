/**
 * 生成物理站引擎隔离自测入口 physics/tools/fixture.html：
 * 保留 physics/index.html 的全部引擎脚本，但把 data/*.js 换成 tools/fixture-data.js。
 * 这样引擎脚本清单一改动，fixture 不会悄悄落伍。
 * 用法：node tools/make-fixture.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(SITE, "index.html"), "utf8");

const out = html
  .split("\n")
  .filter((l) => !/<script src="data\/[\w-]+\.js"><\/script>/.test(l))
  .flatMap((l) => {
    if (/src="app\/glossary\.js"/.test(l)) return ['<script src="tools/fixture-data.js"></script>', l];
    if (/window\.COURSE_PACKS = \[\]/.test(l)) return ["  window.COURSE_PACKS = [];"];
    return [l];
  })
  .join("\n")
  .replace(/<title>[^<]*<\/title>/, "<title>物理站引擎隔离自测（fixture）</title>");

writeFileSync(join(SITE, "tools", "fixture.html"), out, "utf8");
const srcs = [...out.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
console.log("已生成 tools/fixture.html，脚本顺序：\n  " + srcs.join("\n  "));
