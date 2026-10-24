/* ==========================================================================
   validate-reading.mjs —— 阅读轨迹（data/reading-*.js）校验器
   依据 READING-PLAN-SPEC.md。

   用法：
     node tools/validate-reading.mjs                # 校验全部轨迹
     node tools/validate-reading.mjs reading-western # 只校验某一条

   退出码：0 = 全部通过；1 = 有错误
   ========================================================================== */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { findUnterminatedString, findModuleSyntax } from "./lex.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");
const only = process.argv[2];

const BANNED = ["显然", "显而易见", "易得", "众所周知", "不言而喻", "毋庸置疑", "读者自证"];
const errors = [];
const warnings = [];
let file = "";
function err(where, msg) { errors.push(file + " · " + where + "：" + msg); }
function warn(where, msg) { warnings.push(file + " · " + where + "：" + msg); }
function scanBanned(where, ...texts) {
  texts.forEach((t) => {
    if (typeof t !== "string") return;
    BANNED.forEach((w) => { if (t.includes(w)) warn(where, "出现禁用词「" + w + "」"); });
  });
}

/* ---------------------------------------------- 先收集真实的 lesson id */
const lessonIds = new Set();
const courseIds = new Set();
for (const f of readdirSync(DATA).filter((x) => x.startsWith("philo-") && x.endsWith(".js"))) {
  const win = {};
  win.window = win; win.COURSE_PACKS = [];
  try {
    new Function("window", "self", "globalThis", readFileSync(join(DATA, f), "utf8"))(win, win, win);
    const c = win.COURSE_PACKS[0];
    if (c) {
      courseIds.add(c.id);
      (c.lessons || []).forEach((l) => lessonIds.add(l.id));
    }
  } catch { /* 课程文件的问题由 validate-curriculum 负责 */ }
}
console.log("已知课程 " + courseIds.size + " 门 / 讲 " + lessonIds.size + " 讲");

/* ---------------------------------------------- 逐条轨迹校验 */
const files = readdirSync(DATA).filter((f) => f.startsWith("reading-") && f.endsWith(".js")).sort();
if (!files.length) { console.error("✗ data/ 下还没有阅读轨迹文件（reading-*.js）"); process.exit(1); }

let totalBooks = 0, totalStages = 0;
const globalBookIds = new Map();   // id -> file（全局唯一性）

for (const f of files) {
  if (only && basename(f, ".js") !== only) continue;
  file = f;
  const raw = readFileSync(join(DATA, f), "utf8");
  const src = raw.replace(/^\uFEFF/, "");

  /* --- 文件级 --- */
  if (/^\uFEFF/.test(raw)) err("文件", "含 BOM，应为无 BOM UTF-8");
  if (/`/.test(src)) err("文件", "含反引号，契约禁止");
  const modHits = findModuleSyntax(src);
  if (modHits.length) err("文件", "含 import/export/require：第 " + modHits[0].line + " 行 " + modHits[0].text);
  const pushCount = (src.match(/READING_PLANS\.push\(/g) || []).length;
  if (pushCount !== 1) err("文件", "应恰好有 1 个 READING_PLANS.push，实际 " + pushCount);
  // 字符串内真实换行检测（与课程校验器共用同一套词法扫描，已处理英文撇号）
  {
    const badLine = findUnterminatedString(src);
    if (badLine) {
      err("文件", "第 " + badLine + " 行起的字符串里出现真实换行（字符串未闭合）。多行文本必须用 \\n\\n 写在同一行内");
    }
  }

  /* --- 求值 --- */
  let plan;
  try {
    const win = {};
    win.window = win; win.READING_PLANS = [];
    new Function("window", "self", "globalThis", src)(win, win, win);
    plan = win.READING_PLANS[0];
  } catch (e) { err("文件", "求值失败：" + e.message); continue; }
  if (!plan) { err("文件", "没有产出轨迹对象"); continue; }

  /* --- 元数据 --- */
  const id = basename(f, ".js");
  if (plan.id !== id) err("轨迹", "id（" + plan.id + "）与文件名（" + id + "）不一致");
  ["id", "title", "icon", "blurb", "intro", "stages"].forEach((k) => {
    if (plan[k] == null || plan[k] === "") err("轨迹", "缺少必填字段 " + k);
  });
  // 本课程只对质量有要求：不再有 weeks（建议周数）这类时间线字段
  if (plan.weeks != null) err("轨迹", "不应再出现 weeks 字段（本课程已移除全部时间线内容）");
  if (!Array.isArray(plan.stages) || plan.stages.length < 3) { err("轨迹", "stages 至少 3 个"); continue; }
  if (plan.stages.length > 8) warn("轨迹", "stages 多于 8 个");
  scanBanned("轨迹 " + plan.title, plan.blurb, plan.intro, plan.title);

  /* --- books --- */
  const bookIds = new Map();   // id -> book（本文件内）
  const stagesBooks = plan.stages.map((s, si) => {
    const S = "stage[" + (si + 1) + "]《" + (s.title || "?") + "》";
    if (!s.title) err(S, "缺少 title");
    if (!s.goal) err(S, "缺少 goal");
    scanBanned(S, s.title, s.goal);
    const books = s.books || [];
    if (books.length < 3) err(S, "书目少于 3 本（实际 " + books.length + "）");
    books.forEach((b, bi) => {
      const B = S + " book[" + (bi + 1) + "]";
      ["id", "author", "title", "level", "why", "focus", "lessons"].forEach((k) => {
        if (b[k] == null || b[k] === "") err(B, "缺少必填字段 " + k);
      });
      if (b.weeks != null) err(B, "不应再出现 weeks 字段（本课程已移除全部时间线内容）");
      if (b.id) {
        if (bookIds.has(b.id)) err(B, "本文件内 book id 重复：" + b.id);
        if (globalBookIds.has(b.id)) err(B, "book id 与其他文件重复：" + b.id + "（已见于 " + globalBookIds.get(b.id) + "）");
        bookIds.set(b.id, b);
        globalBookIds.set(b.id, f);
      }
      if (b.level != null && ![1, 2, 3, 4].includes(b.level)) err(B, "level 必须是 1~4，实际 " + b.level);
      if (!Array.isArray(b.focus) || b.focus.length < 3) err(B, "focus 至少 3 条（实际 " + (b.focus || []).length + " 条）");
      if (!Array.isArray(b.lessons) || !b.lessons.length) err(B, "lessons 必须是非空数组");
      else b.lessons.forEach((lid) => {
        if (!lessonIds.has(lid)) err(B, "lessons 里的 id 不存在于任何课程：" + lid);
      });
      if (b.why && b.why.length < 40) warn(B, "why 过短（" + b.why.length + " 字），要说清这本书在路径里的功能");
      scanBanned(B, b.title, b.why, b.tip, b.zh, b.en, (b.focus || []).join(" "));
      // 编造版本信息的粗筛：出现 ISBN 或"第 X 版"这类硬信息时提示复核
      if (/ISBN|isbn/.test(String(b.zh || "") + String(b.en || ""))) warn(B, "出现 ISBN，请确认来源可靠（原则 A 要求不确定就不要写具体版次）");
    });
    return books;
  });

  const all = stagesBooks.flat();
  totalBooks += all.length; totalStages += plan.stages.length;

  /* --- 硬性数量要求 --- */
  if (all.length < 20) err("轨迹", "书目总数少于 20（实际 " + all.length + "）");
  if (all.length > 45) warn("轨迹", "书目总数多于 45（实际 " + all.length + "）");
  const lvl4 = all.filter((b) => b.level === 4);
  if (lvl4.length / all.length > 0.25) {
    err("轨迹", "level 4 占比 " + Math.round((lvl4.length / all.length) * 100) + "% 超过 25%");
  }
  lvl4.forEach((b) => {
    if (!b.ladder) err("轨迹", "level 4 的书必须给 ladder（缺：" + b.id + "）");
  });

  /* --- ladder 有效性 + 环检测 --- */
  all.forEach((b) => {
    if (b.ladder && !bookIds.has(b.ladder)) {
      err("轨迹", "ladder 指向不存在的 book id：" + b.id + " -> " + b.ladder);
    }
  });
  {
    const seen2 = {};
    function dfs(bid, path) {
      if (seen2[bid] === 1) { err("轨迹", "ladder 成环：" + path.concat(bid).join(" → ")); return true; }
      if (seen2[bid] === 2) return false;
      seen2[bid] = 1;
      const b = bookIds.get(bid);
      if (b && b.ladder) { if (dfs(b.ladder, path.concat(bid))) return true; }
      seen2[bid] = 2;
      return false;
    }
    [...bookIds.keys()].forEach((bid) => dfs(bid, []));
  }

  /* --- 必须含至少 3 本非原著（导论/研究/工具书） --- */
  const nonPrimary = all.filter((b) => /(导论|入门|指南|研究|读本|选集|词典|百科|通史|教程|手册|批评|解读|概论)/.test(String(b.title || "") + " " + String(b.why || "")));
  if (nonPrimary.length < 3) {
    err("轨迹", "至少需要 3 本非原著（导论/研究/工具书）作为梯子，实际识别到 " + nonPrimary.length + " 本");
  }

  console.log("  " + plan.icon + " " + plan.title + "：" + plan.stages.length + " 阶段 / " + all.length +
    " 本（level4 " + lvl4.length + " 本，非原著梯子 " + nonPrimary.length + " 本）");
}

/* ---------------------------------------------- 汇总 */
console.log("");
console.log("════════ 阅读轨迹校验 ════════");
console.log("轨迹 " + files.length + " 条 ｜ 阶段 " + totalStages + " ｜ 书目 " + totalBooks + " 本");
console.log("");
if (warnings.length) {
  console.log("⚠ 警告 " + warnings.length + " 条：");
  warnings.slice(0, 40).forEach((w) => console.log("   " + w));
  if (warnings.length > 40) console.log("   …（还有 " + (warnings.length - 40) + " 条）");
  console.log("");
}
if (errors.length) {
  console.log("✗ 错误 " + errors.length + " 条：");
  errors.slice(0, 50).forEach((e) => console.log("   " + e));
  if (errors.length > 50) console.log("   …（还有 " + (errors.length - 50) + " 条）");
  process.exit(1);
}
console.log("✓ 阅读轨迹校验全部通过（警告 " + warnings.length + " 条）");
