#!/usr/bin/env node
/**
 * 课程独立性检查器
 * 目标：每门课应当是自足的——不要求读者先去看别的课，也不假设别的课讲过。
 * 检查两类信号：
 *   A) 显式跨课指引：出现「见《某某课》」「数学站的…」「先看第 X 讲（指别的课）」「不熟的话先看」等
 *   B) 隐形依赖：出现「前面讲过」「前面学过」「上次说过」「如前所述」「已学过」这类回指
 * 用法：node <site>/tools/audit-independence.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(SITE, "data");

/** A 类：显式跨课指引 */
const EXPLICIT = [
  { re: /见《[^》]{2,20}》/g, label: "见《某课》" },
  { re: /数学站的?《?[^》，。；]{0,20}》?/g, label: "指向数学站" },
  { re: /不熟的话先看第\s*\d+\s*(?:讲|课)/g, label: "让他去看别的讲" },
  { re: /先去做[^，。；]{0,20}课/g, label: "让他先去做别的课" },
  { re: /本站《[^》]{2,20}》/g, label: "本站某课" },
  { re: /(?:去|看|学)\s*《[^》]{2,20}》\s*(?:第|的)/g, label: "跨课指路" }
];

/** B 类：隐形依赖（回指别的讲） */
const IMPLICIT = [
  { re: /前面(?:的)?(?:第\s*\d+\s*讲|几讲)(?:里)?(?:讲过|说过|学过|提过)/g, label: "回指前面某讲" },
  { re: /(?:前面|之前|上文)(?:已经)?(?:讲过|说过|学过|介绍过|提到过)/g, label: "回指前文" },
  { re: /如前所述/g, label: "如前所述" },
  { re: /我们在第\s*\d+\s*讲(?:讲过|学过)/g, label: "回指第 N 讲" },
  { re: /本课(?:第\s*\d+\s*讲)?之前(?:已经)?(?:讲过|学过)/g, label: "回指本课之前" }
];

const packs = [];
for (const f of readdirSync(DATA).filter((x) => x.endsWith(".js")).sort()) {
  const arr = [];
  try { new Function("window", "globalThis", readFileSync(join(DATA, f), "utf8") + ";")({ COURSE_PACKS: arr }, { COURSE_PACKS: arr }); }
  catch { continue; }
  arr.forEach((c) => packs.push({ file: f, course: c }));
}

/** 收集一门课的所有正文（不含 quiz 的 why，避免误报） */
function blocksText(course) {
  const parts = [];
  for (const l of course.lessons ?? []) {
    for (const b of l.blocks ?? []) {
      parts.push(b.md, b.title, b.note, b.code);
      (b.items || []).forEach((i) => parts.push(typeof i === "string" ? i : (i.t || "") + " " + (i.d || "")));
      if (b.type === "interactive" && b.config) {
        (b.config.steps || []).forEach((s) => parts.push(s.desc, s.note));
        (b.config.tasks || []).forEach((t) => parts.push(typeof t === "string" ? t : (t.t || "")));
        parts.push(b.config.legend);
      }
    }
  }
  return parts.filter(Boolean).join("\n");
}

const rows = [];
let totalExplicit = 0, totalImplicit = 0;
for (const { file, course } of packs) {
  // 课程级字段也要查（need / blurb / advanced 里最容易写"去学别的课"）
  const metaText = [course.need, course.blurb, JSON.stringify(course.advanced || {})].filter(Boolean).join("\n");
  const text = blocksText(course) + "\n" + metaText;
  const hits = [];
  for (const { re, label } of EXPLICIT) {
    for (const m of text.matchAll(re)) hits.push({ kind: "A", label, sample: m[0] });
  }
  for (const { re, label } of IMPLICIT) {
    for (const m of text.matchAll(re)) hits.push({ kind: "B", label, sample: m[0] });
  }
  const ex = hits.filter((h) => h.kind === "A").length;
  const im = hits.filter((h) => h.kind === "B").length;
  totalExplicit += ex; totalImplicit += im;
  rows.push({ id: course.id, title: course.title, ex, im, hits });
}

rows.sort((a, b) => (b.ex + b.im) - (a.ex + a.im));
const pad = (s, n) => String(s) + " ".repeat(Math.max(0, n - [...String(s)].reduce((a, c) => a + (c.charCodeAt(0) > 255 ? 2 : 1), 0)));
console.log("=== 课程独立性检查 ===");
console.log(pad("课程", 30) + pad("跨课指引", 10) + "回指前文");
for (const r of rows) {
  if (!r.ex && !r.im) continue;
  console.log(pad(r.title.length > 24 ? r.title.slice(0, 24) + "…" : r.title, 30) + pad(r.ex, 10) + r.im);
}
console.log("\n合计：显式跨课指引 " + totalExplicit + " 处；回指前文 " + totalImplicit + " 处（涉及 " + rows.filter((r) => r.ex + r.im > 0).length + " 门课）");

const worst = rows.filter((r) => r.ex > 0).slice(0, 6);
if (worst.length) {
  console.log("\n=== 显式跨课指引的具体位置（优先修）===");
  for (const r of worst) {
    console.log("【" + r.title + "】");
    r.hits.filter((h) => h.kind === "A").slice(0, 5).forEach((h) => console.log("   · [" + h.label + "] " + JSON.stringify(h.sample)));
  }
}
