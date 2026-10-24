#!/usr/bin/env node
/**
 * lesson-coverage.mjs —— 逐讲覆盖率自查：哪几讲已经有公式、哪几讲还是 0。
 *
 * 用法：node tools/lesson-coverage.mjs [data]
 * 输出：每个课程文件一行，`✓ 全覆盖` 表示每一讲都至少有一个 $...$；
 *       `… 部分` 会列出还没改的讲次（最多列 6 个，多的用 … 表示）。
 *
 * 收尾时用它确认没有漏掉整讲 —— 「课程级字段全改完」不等于「每讲都改到了」。
 */
import { readdirSync, readFileSync } from "node:fs";

const dir = process.argv[2] || "data";
const rows = [];
for (const f of readdirSync(dir).filter((x) => x.endsWith(".js") && !x.startsWith("_"))) {
  const packs = [];
  try {
    new Function("window", "globalThis", readFileSync(dir + "/" + f, "utf8") + ";")({ COURSE_PACKS: packs }, { COURSE_PACKS: packs });
  } catch (e) {
    rows.push([f, "求值失败", 0, 0, e.message.slice(0, 40)]);
    continue;
  }
  let withMath = 0;
  let total = 0;
  const empty = [];
  for (const c of packs) {
    for (const l of c.lessons || []) {
      total++;
      const s = JSON.stringify({ b: l.blocks, q: l.quiz, g: l.goal, n: l.need });
      if (s.includes("$")) withMath++;
      else empty.push(l.id);
    }
  }
  rows.push([f, withMath === total ? "✓ 全覆盖" : "… 部分", withMath, total, empty.join(", ")]);
}
rows.sort((a, b) => a[2] / (a[3] || 1) - b[2] / (b[3] || 1));
console.log("文件".padEnd(32) + "状态".padEnd(10) + "有公式讲/总讲");
for (const [f, st, w, t, empty] of rows) {
  const list = empty ? (empty.split(", ").slice(0, 6).join(", ") + (empty.split(", ").length > 6 ? " …" : "")) : "";
  console.log(String(f).padEnd(32) + String(st).padEnd(10) + w + "/" + t + (list ? "   未改讲: " + list : ""));
}
const done = rows.filter((r) => r[1] === "✓ 全覆盖").length;
console.log(`\n合计：${done}/${rows.length} 个文件每讲都有公式。`);
