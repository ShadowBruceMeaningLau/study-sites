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

// 别名：允许 need 用「短名」引用，即 title 截到第一个分隔符为止的部分。
// 例如 title「Tokenizer 与词表：文字怎么变成数字」→ 别名「Tokenizer 与词表」。
// 只有当这个短名唯一定位到一门课、且没有别的课用全名占用它时才登记——
// 否则（两门课短名相同）宁可不登记，让它照旧报悬空引用，而不是张冠李戴。
const aliasLists = new Map();
for (const { course } of packs) {
  const full = course.title.replace(/\s+/g, "");
  const short = full.split(/[：:（(·]/)[0];
  if (short && short !== full) {
    if (!aliasLists.has(short)) aliasLists.set(short, []);
    aliasLists.get(short).push(course);
  }
}
for (const [name, list] of aliasLists) {
  if (list.length === 1 && !byTitle.has(name)) byTitle.set(name, list[0]);
}

let errors = 0;
let warnings = 0;

// 路线图上「尚未交付」的课：前置引用指向它们时只告警、不判悬空——
// 这门站是分批写的，后面几波要引用前面还没落盘的课。
// ★ 只登记真正计划内的课名；写错字或引用不存在的课仍然照旧报错。
const PLANNED = new Set([
  "Tokenizer 与词表", "注意力与 Transformer", "预训练与推理",
  "模型前沿专题（2026-10）", "后训练与对齐前沿", "提示词工程",
  "推理 API 与流式输出", "Harness 解剖", "Agent 协议生态（2026-10）",
  "工具调用", "RAG", "微调入门", "Agent 核心", "评测 Harness",
  "项目 1：本地 RAG 问答助手", "项目 2：CLI 工具型 Agent",
  "项目 3：给自家 Agent 写评测", "项目 4：DSH 扩展实战",
  "前沿追踪路线图", "神经网络"
].map((s) => s.replace(/\s+/g, "")));

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
      if (PLANNED.has(norm) || PLANNED.has(body)) {
        console.log("[提示] " + course.id + " 引用了计划中但尚未交付的课「" + ref + "」（等它落盘后自动变成正常前置）");
        continue;
      }
      problems.push("悬空引用：「" + ref + "」解析不到任何站内课程");
      continue;
    }
    if (hit.id === course.id) problems.push("自指：need 引用了本课自己「" + ref + "」");
  }

  // 3) 零基础课不允许"建议先学"
  //    先把站内课名引用「……」剥掉再判断：课名本身可能含"零基础"三个字
  //    （例如「LLM 零基础入门」），那是被引用的课名，不代表本课声称零基础。
  const needBare = need.replace(/「[^」]*」/g, "（课名）");
  if (/零基础/.test(needBare) && /建议先学|先学/.test(needBare)) {
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
    const tag = /零基础/.test(needBare) ? "零基础可学" : "前置 " + refs.length + " 门（" + refs.join("、") + "）";
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

// 6) 术语表 where 字段里的课名也必须解析到站内真实课程。
//    为什么加这条：where 是给学生「回去补这一讲」用的指路，课名写错就指向一门不存在的课，
//    而页面不会报错、只是点不过去。真实踩过：「Agent 协议生态 2026」「前沿模型专题 2026」
//    两处与真实 title 不一致（真实的是带全角括号的「（2026-10）」形态）。
const GLOSSARY = join(SITE, "app", "glossary.js");
let glossaryChecked = 0;
try {
  const gsrc = readFileSync(GLOSSARY, "utf8");
  const win = {};
  // glossary.js 是 IIFE，把 window 传进去就能拿到 GLOSSARY
  new Function("window", gsrc)(win);
  const cats = (win.GLOSSARY && win.GLOSSARY.cats) || [];
  const badWhere = [];
  for (const c of cats) {
    for (const it of c.items || []) {
      const where = (it.where || "").trim();
      if (!where) continue;
      glossaryChecked++;
      const body = where.split(/\s*·\s*/)[0].trim();
      // 允许「课名 · 第 N 讲」与「课名」两种写法；课名必须命中 title / id / 别名
      const norm = body.replace(/\s+/g, "");
      if (!byTitle.get(norm) && !byId.get(body) && !byTitle.get(norm.replace(/（第\s*\d+\s*讲）$/, ""))) {
        badWhere.push(c.cat + " / " + it.t + " → 「" + body + "」");
      }
    }
  }
  if (badWhere.length) {
    errors += badWhere.length;
    console.log("\n【术语表 glossary.js】where 里的课名解析不到站内课程 " + badWhere.length + " 处：");
    for (const b of badWhere) console.log("   ✗ " + b);
  } else {
    console.log("术语表 where 校验：" + glossaryChecked + " 条出处全部解析到站内真实课名。");
  }
} catch (e) {
  warnings++;
  console.log("[警告] 术语表 where 校验跳过：" + e.message);
}

console.log("\n前置 DAG：共 " + edges.length + " 条有向边（" + new Set(edges).size + " 条去重后）");
console.log("合计：错误 " + errors + " 处；警告 " + warnings + " 处");

function pad(s, n) {
  s = String(s);
  return s + " ".repeat(Math.max(0, n - [...s].reduce((a, c) => a + (c.charCodeAt(0) > 255 ? 2 : 1), 0)));
}

process.exit(errors > 0 ? 1 : 0);
