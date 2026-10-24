#!/usr/bin/env node
/**
 * 前置声明校验器（LLM 站新增的依赖门）
 * 目标：每门课的 need 字段里的「课名」引用必须能解析到站内真实课程。
 *   - 悬空引用（引用了不存在的课）→ 失败
 *   - 自指（need 里引用自己）→ 失败
 *   - 跨站引用（指向别的学习站/外部课程）→ 失败
 *   - 引用格式不合约定 → 警告
 * 用法：node <site>/tools/audit-prereqs.mjs
 *
 * need 字段的两种合法写法（CONTENT-SPEC §1.1）：
 *   1) "零基础可学：……" 或 "零基础可学（……）"
 *   2) "建议先学「课名A」「课名B」；……"（课名必须与站内课程 title 或 id 完全一致）
 * 引用只允许出现在"建议先学"之后；「」用于站内课名，不得用于其它词。
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(SITE, "data");

const packs = [];
for (const f of readdirSync(DATA).filter((x) => x.endsWith(".js")).sort()) {
  const arr = [];
  try { new Function("window", "globalThis", readFileSync(join(DATA, f), "utf8") + ";")({ COURSE_PACKS: arr }, { COURSE_PACKS: arr }); }
  catch { continue; }
  arr.forEach((c) => packs.push({ file: f, course: c }));
}

// 可解析的名字集合：title（去掉空白）与 id
const byTitle = new Map();
const byId = new Map();
for (const { course } of packs) {
  byTitle.set(course.title.replace(/\s+/g, ""), course);
  byId.set(course.id, course);
}

let errors = 0;
let warnings = 0;

console.log("=== 前置声明校验（audit-prereqs）===");
for (const { file, course } of packs) {
  const need = (course.need || "").trim();
  if (!need) {
    console.log("[警告] " + course.id + "（" + course.title + "）没有 need 字段");
    warnings++;
    continue;
  }

  // 1) 提取所有「...」引用
  const refs = [...need.matchAll(/「([^」]{1,30})」/g)].map((m) => m[1].trim());
  const problems = [];

  // 2) 逐条解析引用
  for (const ref of refs) {
    const norm = ref.replace(/\s+/g, "");
    const hit = byTitle.get(norm) || byId.get(ref);
    if (!hit) {
      // 允许"（第 N 讲）"这类尾巴：取「」内主体再试一次
      const body = norm.replace(/（第\s*\d+\s*讲）$/, "").replace(/\(第\s*\d+\s*讲\)$/, "");
      const hit2 = byTitle.get(body);
      if (hit2) continue;
      problems.push("悬空引用：「" + ref + "」解析不到任何站内课程");
      continue;
    }
    if (hit.id === course.id) problems.push("自指：need 引用了本课自己「" + ref + "」");
  }

  // 3) 零基础课不允许"建议先学"
  if (/零基础/.test(need) && /建议先学|先学/.test(need)) {
    problems.push("矛盾写法：声称零基础可学，又写「建议先学」");
  }

  // 4) 跨站信号
  for (const pat of [/数学站/g, /物理站/g, /哲学站/g, /计算机站/g, /CS 站/gi, /Python 课/gi, /torch/gi, /numpy/gi]) {
    if (pat.test(need)) {
      problems.push("跨站/外部依赖信号：" + JSON.stringify(need.match(pat)[0]));
    }
  }

  if (problems.length) {
    errors += problems.length;
    console.log("\n【" + course.title + "】（" + file + "）");
    console.log("  need: " + need);
    for (const p of problems) console.log("   ✗ " + p);
  } else {
    const tag = /零基础/.test(need) ? "零基础可学" : "前置 " + refs.length + " 门（" + refs.join("、") + "）";
    console.log(pad(course.id, 30) + pad(course.title, 24) + tag);
  }
}

// 5) 反查：有课引用别人，别人也要存在——已由悬空引用覆盖；输出 DAG 边数
const edges = [];
for (const { course } of packs) {
  const need = (course.need || "");
  for (const m of need.matchAll(/「([^」]{1,30})」/g)) {
    const norm = m[1].trim().replace(/\s+/g, "").replace(/（第\s*\d+\s*讲）$/, "");
    const hit = byTitle.get(norm);
    if (hit && hit.id !== course.id) edges.push(course.id + " -> " + hit.id);
  }
}
console.log("\n前置 DAG：共 " + edges.length + " 条有向边（" + new Set(edges).size + " 条去重后）");
console.log("合计：错误 " + errors + " 处；警告 " + warnings + " 处");

function pad(s, n) {
  s = String(s);
  return s + " ".repeat(Math.max(0, n - [...s].reduce((a, c) => a + (c.charCodeAt(0) > 255 ? 2 : 1), 0)));
}

process.exit(errors > 0 ? 1 : 0);
