/* ==========================================================================
   audit-zero-basis.mjs —— 零基础友好度审计（哲学站）
   依据 ZERO-BASIS-STANDARD.md，输出两张数字：

     · 首现未解释 —— 术语第一次出现时，所在讲解块里没有任何解释标记（要修的问题）
     · 后续仅使用 —— 术语在后面（隔了 2 个块以上）的讲解块里再次出现，而该块没有复述

   用法：node tools/audit-zero-basis.mjs [课程id]
   ========================================================================== */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");
const only = process.argv[2];

/* 同词不同义 / 高频常识词的误报过滤表（发现新的误报就往这里加） */
const FALSE_POSITIVE = new Set([
  "对象", "存在", "概念", "问题", "关系", "内容", "形式", "方法", "结果", "原因",
  "语言", "知识", "价值", "意义", "行为", "选择", "理由", "观点", "标准", "经验",
  "自然", "世界", "社会", "个人", "传统", "历史", "生活", "思考", "理解", "判断",
  "意识", "感觉", "情感", "欲望", "原则", "规则", "目的", "手段", "条件", "结构",
  "理论", "实践", "证据", "命题", "真理", "真假", "可能", "必然",
  // 本站自己就在教的通用方法词：属于"读者正在学的技能"，不是需要解释的专业术语
  "重构", "反例", "论证", "前提", "结论", "有效性", "可靠性", "定义", "主张",
  "反驳", "回应", "立场", "直觉", "假设", "推论", "证据链"
]);

/* 解释标记：出现任一，即认为该位置对这个术语做过解释 */
const EXPLAIN_MARKS = [
  /[（(][^）)]{2,40}[）)]/,      // 括号里的英文原文或解释
  /是指/, /指的是/, /意思(是|指)/, /意为/, /叫做/, /称作/, /称为/,
  /也就是/, /即/, /就是说/, /换句话说/, /通俗(地|地讲|来说)/, /大白话/,
  /例如/, /比如/, /举个/, /举个例子/, /好比/, /好比说/,
  /[—－]{1,2}/,                  // 破折号后面常直接跟解释
  /＝|=/,                        // 等式式定义
  /读作/, /理解为/, /的定义是/, /界定为/, /用来指/
];

/* 人名识别：教科书会直接用人名，不需要"就地解释"，这类不算零基础缺陷 */
function looksLikePersonName(t) {
  if (t.includes("·")) return true;                        // 劳伦斯·邦久
  if (/[（(]/.test(t)) return false;
  return /^[\u4e00-\u9fff]{2,5}$/.test(t) &&
    /(斯|德|尔|图|顿|特|克|勒|兹|逊|根|修|谟|特|拉|梭|农|德)$/.test(t);
}

function read(p) { return readFileSync(p, "utf8").replace(/^\uFEFF/, ""); }

/* --------------------------------------------------- 收集术语表 */
const glossaryTerms = new Set();
const glossaryWhere = new Map();
const gPath = join(ROOT, "app", "glossary.js");
let glossaryCount = 0;
if (exists(gPath)) {
  const win = {};
  try {
    new Function("window", read(gPath))(win);
    const g = win.GLOSSARY;
    if (g && g.cats) {
      g.cats.forEach((c) => (c.items || []).forEach((it) => {
        glossaryCount++;
        if (it.t) { glossaryTerms.add(String(it.t).trim()); glossaryWhere.set(String(it.t).trim(), c.cat + "（词条自身）"); }
      }));
    }
  } catch (e) { console.warn("⚠ 术语表解析失败，将只用闪卡术语：" + e.message); }
}
function exists(p) { try { readFileSync(p); return true; } catch { return false; } }

/* --------------------------------------------------- 载入课程 */
const files = readdirSync(DATA).filter((f) => f.endsWith(".js")).sort();
const courses = [];
for (const f of files) {
  if (only && basename(f, ".js") !== only) continue;
  const win = {};
  win.window = win;
  win.COURSE_PACKS = [];
  try {
    new Function("window", "self", "globalThis", read(join(DATA, f)))(win, win, win);
    if (win.COURSE_PACKS[0]) courses.push({ file: f, course: win.COURSE_PACKS[0] });
  } catch (e) { console.warn("⚠ " + f + " 求值失败：" + e.message); }
}
if (!courses.length) { console.error("✗ 没有可审计的课程"); process.exit(1); }

/* --------------------------------------------- 每门课的术语清单 */
function termsOfCourse(course) {
  const set = new Set();
  for (const l of course.lessons || []) {
    for (const f of l.flashcards || []) {
      // 闪卡正面常写成「术语（原文）：解释」或「术语」——取开头的术语部分
      const front = String(f.front || "");
      const m = front.match(/^([^：:（(，,。；;]{2,14})[：:（(，,。；;]?/);
      if (m) {
        const t = m[1].replace(/^(什么是|何谓|解释|定义)/, "").trim();
        if (t.length >= 2 && t.length <= 14) set.add(t);
      }
    }
  }
  for (const t of glossaryTerms) set.add(t);
  for (const t of FALSE_POSITIVE) set.delete(t);
  return [...set];
}

/* 哪个块"解释"了这个术语：允许解释出现在术语之后不远的地方（同块内 400 字内） */
function blockExplains(text, term) {
  let from = 0;
  while (true) {
    const i = text.indexOf(term, from);
    if (i < 0) return false;
    // 前 30 字（括号原文常写在术语前）+ 后 400 字（解释常紧跟其后）
    const win = text.slice(Math.max(0, i - 30), i + term.length + 400);
    if (EXPLAIN_MARKS.some((re) => re.test(win))) return true;
    from = i + term.length;
  }
}

/* --------------------------------------------------- 逐课审计 */
let grandFirst = 0, grandLater = 0;
const report = [];

for (const { file, course } of courses) {
  const terms = termsOfCourse(course);
  let firstBad = 0, laterBad = 0;
  const details = [];

  for (const lesson of course.lessons || []) {
    // 把每个 block 合并成一个"阅读单元"（含标题、精读原文、苏格拉底问答、推演说明等），
    // 再附加闪卡背面与论证缺口分析——它们同样是读者会读到的解释性文本。
    // 注意：必须按块合并，否则"标题里解释、正文里使用"这类正常写法会被误报。
    const units = [];
    (lesson.blocks || []).forEach((b, bi) => {
      let text = "";
      if (b.title) text += b.title + "\n";
      if (b.md) text += b.md + "\n";
      if (b.passage) text += b.passage + "\n";
      if (b.opening) text += b.opening + "\n";
      if (b.note) text += b.note + "\n";
      if (b.author) text += b.author + "\n";
      if (b.work) text += b.work + "\n";
      if (b.items) text += b.items.map((x) => (typeof x === "string" ? x : (x.t || "") + " " + (x.d || ""))).join("\n") + "\n";
      if (b.steps) text += b.steps.map((x) => (typeof x === "string" ? x : (x.t || "") + " " + (x.d || ""))).join("\n") + "\n";
      if (b.questions) text += b.questions.join("\n") + "\n";
      if (b.annotations) text += b.annotations.map((a) => (a.line || "") + " " + (a.note || "")).join("\n") + "\n";
      if (b.turns) text += b.turns.map((t) => (t.prompt || "") + " " + (t.options || []).map((o) => (o.t || "") + " " + (o.reply || "")).join(" ")).join("\n") + "\n";
      if (b.config) {
        if (b.config.steps) text += b.config.steps.map((s) => (s.desc || "") + " " + (s.note || "")).join("\n") + "\n";
        if (b.config.legend) text += b.config.legend + "\n";
      }
      if (b.outputs) text += b.outputs.join("\n") + "\n";
      if (b.considerations) text += b.considerations.join("\n") + "\n";
      if (b.rubric) text += b.rubric.map((r) => (r.k || "") + " " + (r.d || "")).join("\n") + "\n";
      if (text.trim()) units.push({ bi, type: b.type, text, isBlock: true });
    });
    const tail = [];
    (lesson.flashcards || []).forEach((f) => tail.push((f.front || "") + " " + (f.back || "")));
    (lesson.arguments || []).forEach((a) => tail.push((a.gap || "") + " " + (a.form || "")));
    if (tail.length) units.push({ bi: 900, type: "闪卡/论证解析", text: tail.join("\n"), isBlock: false });

    for (const term of terms) {
      if (looksLikePersonName(term)) continue;
      let firstAt = -1;
      for (let u = 0; u < units.length; u++) {
        if (units[u].text.includes(term)) { firstAt = u; break; }
      }
      if (firstAt < 0) continue;                       // 本讲没出现
      const firstUnit = units[firstAt];
      if (!firstUnit.isBlock) continue;                // 只出现在附录里，不算正文首现

      // 判定"就地解释"：本块内解释，或紧接的 2 块内解释（标题里的解释也算）
      const near = units.slice(firstAt, firstAt + 3).map((u) => u.text).join("\n");
      if (!blockExplains(near, term)) {
        firstBad++;
        details.push({ kind: "首现未解释", lesson: lesson.title, term, block: "第 " + (firstUnit.bi + 1) + " 块（" + firstUnit.type + "）" });
      } else {
        // 已解释：检查它后面（隔 2 块以上）是否"只用不复述"。
        // 只盯多词专业术语：像「孔子」「鉴赏判断」这类，读者早已认识，不该被追究。
        if (term.length < 4) continue;
        for (let u = firstAt + 3; u < units.length; u++) {
          const unit = units[u];
          if (!unit.isBlock) continue;
          if (!unit.text.includes(term)) continue;
          if (blockExplains(unit.text, term)) continue;
          laterBad++;
          details.push({ kind: "后续仅使用", lesson: lesson.title, term, block: "第 " + (unit.bi + 1) + " 块（" + unit.type + "）" });
          break;   // 每个术语每讲只报一次
        }      }
    }
  }

  grandFirst += firstBad;
  grandLater += laterBad;
  report.push({ course: course.title, id: course.id, lessons: (course.lessons || []).length, terms: terms.length, firstBad, laterBad, details });
}

/* --------------------------------------------------- 输出 */
console.log("");
console.log("════════ 零基础友好度审计（哲学站）════════");
console.log("术语表词条 " + glossaryCount + " 条 ｜ 审计课程 " + report.length + " 门");
if (glossaryCount === 0) console.log("提示：app/glossary.js 还没有词条，本次只用各课闪卡里的术语。");
console.log("");
for (const r of report) {
  console.log("【" + r.course + "】" + r.lessons + " 讲 ｜ 候选术语 " + r.terms +
    " ｜ 首现未解释 " + r.firstBad + " ｜ 后续仅使用 " + r.laterBad);
}
console.log("");
console.log("合计：首现未解释 " + grandFirst + " ｜ 后续仅使用 " + grandLater);

const all = report.flatMap((r) => r.details.map((d) => ({ ...d, course: r.course })));
if (all.length) {
  const show = all.filter((d) => d.kind === "首现未解释").slice(0, 40);
  if (show.length) {
    console.log("");
    console.log("—— 首现未解释（前 40 条，这些是要修的问题）——");
    show.forEach((d) => console.log("  [" + d.course + "] " + d.lesson + " · " + d.block + " 未解释术语：「" + d.term + "」"));
  }
  const show2 = all.filter((d) => d.kind === "后续仅使用").slice(0, 20);
  if (show2.length) {
    console.log("");
    console.log("—— 后续仅使用（前 20 条，可考虑补一句短语复述）——");
    show2.forEach((d) => console.log("  [" + d.course + "] " + d.lesson + " · " + d.block + " 仅使用术语：「" + d.term + "」"));
  }
  console.log("");
  console.log("（误报请加入脚本顶部的 FALSE_POSITIVE 表，或改用「术语（英文）」的写法让解释标记生效。）");
} else {
  console.log("");
  console.log("✓ 没有发现问题。");
}
