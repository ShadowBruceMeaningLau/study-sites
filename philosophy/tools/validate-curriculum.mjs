/* ==========================================================================
   validate-curriculum.mjs —— 哲学站课程结构校验器
   依据 PHILO-CONTENT-SPEC.md，逐条检查 data/*.js。

   用法：
     node tools/validate-curriculum.mjs            # 校验全部课程
     node tools/validate-curriculum.mjs philo-intro # 只校验某一门

   退出码：0 = 全部通过；1 = 有错误
   ========================================================================== */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { findUnterminatedString, findModuleSyntax } from "./lex.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");
const only = process.argv[2];

const TERMS = ["入门", "逻辑工具", "第一学期", "第二学期", "第三学期", "第四学期", "专题选修"];
const BLOCK_TYPES = ["concept", "analogy", "steps", "pitfall", "close", "socratic", "writing", "calc", "interactive", "lab", "code"];
const LAB_TYPES = ["steplab", "datalab", "tablelab", "pathlab", "schedlab", "cpulab", "pagelab", "arbitlab"];
const QUIZ_TYPES = ["single", "multi", "fill", "order"];
const ROLES = ["premise", "conclusion", "noise"];
const VERDICTS = ["good", "weak", "bad"];
const BANNED = ["显然", "显而易见", "易得", "众所周知", "不言而喻", "毋庸置疑", "读者自证"];

const errors = [];
const warnings = [];
const seen = new Set();   // 全局 id 唯一性
let file = "";

function err(where, msg) { errors.push(file + " · " + where + "：" + msg); }
function warn(where, msg) { warnings.push(file + " · " + where + "：" + msg); }
function uniq(where, id) {
  if (!id) { err(where, "缺少 id"); return false; }
  if (seen.has(id)) { err(where, "id 重复：" + id); return false; }
  seen.add(id);
  return true;
}
function need(where, obj, keys) {
  keys.forEach((k) => {
    if (obj[k] == null || obj[k] === "") err(where, "缺少必填字段 " + k);
    else if (Array.isArray(obj[k]) && obj[k].length === 0) warn(where, "字段 " + k + " 是空数组");
  });
}
function scanBanned(where, text) {
  if (typeof text !== "string") return;
  BANNED.forEach((w) => { if (text.includes(w)) warn(where, "出现禁用词「" + w + "」"); });
}
function deepStrings(o, out = []) {
  if (typeof o === "string") out.push(o);
  else if (Array.isArray(o)) o.forEach((x) => deepStrings(x, out));
  else if (o && typeof o === "object") Object.values(o).forEach((x) => deepStrings(x, out));
  return out;
}
/** 解析 "30%" / "30 %" / 30 为数字 */
function weightOf(w) {
  if (typeof w === "number") return w;
  const m = String(w || "").match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : NaN;
}


/* ------------------------------------------------------------ 主流程 */
// 只校验课程文件（philo-*.js）；阅读轨迹由 validate-reading.mjs 负责
const files = readdirSync(DATA).filter((f) => f.startsWith("philo-") && f.endsWith(".js")).sort();
if (!files.length) { console.error("✗ data/ 目录下没有课程文件"); process.exit(1); }

let totalLessons = 0, totalQuiz = 0, totalCards = 0, totalArgs = 0, totalWriting = 0, totalBlocks = 0;

for (const f of files) {
  if (only && basename(f, ".js") !== only) continue;
  file = f;
  const src = readFileSync(join(DATA, f), "utf8").replace(/^\uFEFF/, "");

  /* --- 文件级格式 --- */
  if (/^\uFEFF/.test(readFileSync(join(DATA, f), "utf8"))) err("文件", "含 BOM，应为无 BOM UTF-8");
  if (/`/.test(src)) err("文件", "含反引号（模板字符串），契约禁止");
  // 只匹配真正的模块语法：行首的 import/export，或调用形式的 require(…
  // （不能简单匹配单词——英文术语如 existential import 会被误伤）
  const modHits = findModuleSyntax(src);
  if (modHits.length) err("文件", "含模块语法：第 " + modHits[0].line + " 行 " + modHits[0].text);
  const pushCount = (src.match(/COURSE_PACKS\.push\(/g) || []).length;
  if (pushCount !== 1) err("文件", "应恰好有 1 个 COURSE_PACKS.push，实际 " + pushCount);
  if (/\$[^$\n]*\\[a-zA-Z]+\{/.test(src)) warn("文件", "疑似 LaTeX 公式，渲染器不支持");

  // 字符串里出现真实换行（而不是 \n）：这是最容易犯、后果最严重的错误——
  // 整个文件会被 JS 解析器拒绝，学习站会直接加载不出这门课。
  {
    const hit = findUnterminatedString(src);
    if (hit) {
      err("文件", "第 " + hit + " 行起的字符串里出现了真实换行（字符串未闭合）。" +
        "多行文本必须写在同一行内、用 \\n\\n 连接，例如 md: \"第一段\\n\\n第二段\"");
    }
  }

  /* --- 求值（按浏览器的方式：window 自身可解析、COURSE_PACKS 预先存在） --- */
  let course;
  try {
    const win = {};
    win.window = win;
    win.COURSE_PACKS = [];
    new Function("window", "self", "globalThis", src)(win, win, win);
    course = win.COURSE_PACKS[0];
  } catch (e) {
    err("文件", "求值失败：" + e.message);
    continue;
  }
  if (!course) { err("文件", "没有产出课程对象"); continue; }

  /* --- 课程元数据 --- */
  const cid = basename(f, ".js");
  if (course.id !== cid) err("课程", "id（" + course.id + "）与文件名（" + cid + "）不一致");
  if (!/^philo-/.test(String(course.id))) err("课程", "id 必须以 philo- 开头");
  need("课程", course, ["id", "title", "icon", "term", "need", "blurb"]);
  if (course.term && !TERMS.includes(course.term)) err("课程", "term 取值非法：" + course.term + "（允许：" + TERMS.join("/") + "）");
  // 本课程不设时间线：hours（建议学时）与 lesson.est（预计分钟数）都不得出现
  if (course.hours != null) err("课程", "不应再出现 hours 字段（本课程已移除全部时间线内容）");
  if (!Array.isArray(course.lessons) || course.lessons.length < 1) { err("课程", "lessons 必须是非空数组"); continue; }
  if (!Array.isArray(course.tags) || !course.tags.length) warn("课程", "建议提供 tags");
  deepStrings({ need: course.need, blurb: course.blurb }).forEach((s) => scanBanned("课程 " + course.title, s));

  const prefix = String(course.id);   // 讲 id 前缀
  for (const [li, lesson] of course.lessons.entries()) {
    const L = "第 " + (li + 1) + " 讲《" + (lesson.title || "?") + "》";
    totalLessons++;
    uniq(L, lesson.id);
    // 注意：不要求 est（预计分钟数）。本课程只对质量有要求，
    // 不告诉读者"这一讲要花多久"——所以时间字段已从内容与界面中全部移除。
    need(L, lesson, ["id", "title", "goal", "blocks"]);
    if (lesson.id && !String(lesson.id).startsWith(prefix + "-") && !String(lesson.id).startsWith("philo-")) {
      err(L, "lesson.id 命名异常：" + lesson.id);
    }
    if (lesson.est != null) err(L, "不应再出现 est 字段（本课程已移除全部时间线内容）");
    deepStrings({ goal: lesson.goal }).forEach((s) => scanBanned(L, s));

    /* ---------------- blocks ---------------- */
    const blocks = lesson.blocks || [];
    totalBlocks += blocks.length;
    if (blocks.length < 4) err(L, "blocks 过少（" + blocks.length + "），至少 6 个");
    else if (blocks.length < 6) warn(L, "blocks 偏少（" + blocks.length + "），建议 6~10 个");
    if (blocks.length > 12) warn(L, "blocks 偏多（" + blocks.length + "），建议 6~10 个");

    const counts = {};
    for (const [bi, b] of blocks.entries()) {
      const B = L + " 第 " + (bi + 1) + " 块";
      if (!b || typeof b !== "object") { err(B, "不是对象"); continue; }
      if (!b.type) { err(B, "缺少 type"); continue; }
      if (!BLOCK_TYPES.includes(b.type)) { err(B, "未知 block 类型：" + b.type); continue; }
      counts[b.type] = (counts[b.type] || 0) + 1;
      deepStrings(b).forEach((s) => scanBanned(B, s));

      switch (b.type) {
        case "concept":
        case "analogy":
          need(B, b, ["title", "md"]);
          if (b.md && b.md.length < 200) warn(B, b.type + " 正文偏短（" + b.md.length + " 字），核心讲解应更充分");
          break;
        case "steps":
        case "pitfall":
          need(B, b, ["title", "items"]);
          break;
        case "lab":
          need(B, b, ["title", "steps"]);
          break;
        case "calc":
          need(B, b, ["title", "inputs", "outputs"]);
          if (Array.isArray(b.inputs)) b.inputs.forEach((x, xi) => {
            if (typeof x.value !== "string") err(B, "inputs[" + xi + "].value 必须是字符串");
          });
          if (Array.isArray(b.outputs)) b.outputs.forEach((x, xi) => {
            if (typeof x !== "string") err(B, "outputs[" + xi + "] 必须是字符串");
          });
          break;
        case "code":
          need(B, b, ["title", "code"]);
          break;
        case "interactive": {
          need(B, b, ["title", "lab"]);
          if (!LAB_TYPES.includes(b.lab)) { err(B, "未知 lab 类型：" + b.lab); break; }
          const cfg = b.config || {};
          if (b.lab === "steplab" || b.lab === "datalab") {
            if (!Array.isArray(cfg.steps) || cfg.steps.length < 4) err(B, "steplab 需要至少 4 个 steps");
            else cfg.steps.forEach((s, si) => {
              if (!s.desc) err(B, "steps[" + si + "] 缺少 desc");
              if (!s.state || typeof s.state !== "object") err(B, "steps[" + si + "] 缺少 state 对象");
              else Object.entries(s.state).forEach(([k, v]) => {
                if (typeof v !== "string" && typeof v !== "number") err(B, "steps[" + si + "].state." + k + " 必须是字符串或数字");
              });
            });
          } else if (b.lab === "tablelab") {
            if (!Array.isArray(cfg.vars) || !Array.isArray(cfg.cols)) err(B, "tablelab 需要 vars[] 与 cols[]");
            if (!Array.isArray(cfg.rows) || cfg.rows.length < 2) err(B, "tablelab 需要至少 2 行 rows");
            else cfg.rows.forEach((r, ri) => {
              if (!Array.isArray(r.vals)) err(B, "rows[" + ri + "] 缺少 vals 数组");
              else if (cfg.vars && r.vals.length !== cfg.vars.length) err(B, "rows[" + ri + "].vals 长度与 vars 不一致");
              (cfg.cols || []).forEach((c) => {
                if (!r.cells || r.cells[c] == null) err(B, "rows[" + ri + "] 缺少列 " + c + " 的结果");
              });
            });
          }
          break;
        }
        case "close": {
          need(B, b, ["title", "author", "work", "passage"]);
          const anns = b.annotations || [];
          if (anns.length < 4) err(B, "close 块的 annotations 少于 4 条（实际 " + anns.length + "）");
          const passage = String(b.passage || "");
          anns.forEach((a, ai) => {
            if (!a || !a.line || !a.note) { err(B, "annotations[" + ai + "] 需要 line 与 note"); return; }
            if (!passage.includes(a.line)) {
              err(B, "annotations[" + ai + "].line 不是 passage 的逐字子串：「" + String(a.line).slice(0, 28) + "…」");
            }
            if (a.note.length < 15) warn(B, "annotations[" + ai + "].note 过短");
          });
          // 章节号可以是阿拉伯数字（§21、514a）、中文数字（第二沉思、第一部分）、
          // 或西文出处标记（Lecture III、AT VII、ch.13、II.xxvii.9）
          const workOk = /(卷|篇|章|节|讲|沉思|部分|命题|定义|序言|§|\bch\.|\bLecture\b|\bAT\b|\bII?\.|\d{1,4}\s*[ab]?\b)/i.test(String(b.work || ""));
          // 例外：明确声明是自撰教学范例、不是任何原文的块，不需要出处
          // （「分析一段自撰范文的结构」是正当的写作教学手段）
          const selfAuthored = /(自撰|自拟|非引文|不是任何|教学范例|请勿引用|本课撰写|编者撰写)/.test(
            String(b.author || "") + " " + String(b.work || "") + " " + String(b.note || "") + " " + String(b.passage || "").slice(0, 200)
          );
          if (!workOk && !selfAuthored) {
            warn(B, "close 块的 work 建议标明章节号（如《理想国》514a、《第一哲学沉思集》沉思二）");
          }
          if (!(b.questions || []).length) warn(B, "close 块建议给 2~4 个追问");
          break;
        }
        case "socratic": {
          need(B, b, ["title", "opening", "turns"]);
          const turns = b.turns || [];
          if (turns.length < 3) err(B, "socratic 需要至少 3 个 turns（实际 " + turns.length + "）");
          if (turns.length > 6) warn(B, "socratic 的 turns 多于 6 个，建议 3~6 个");
          const ids = turns.map((t) => t.id);
          ids.forEach((id, ti) => { if (!id) err(B, "turns[" + ti + "] 缺少 id"); });
          if (new Set(ids).size !== ids.length) err(B, "socratic 的 turn id 有重复");
          let hasGood = false, hasEnd = false;
          turns.forEach((t, ti) => {
            const T = B + " turn[" + (t.id || ti) + "]";
            need(T, t, ["id", "prompt", "options"]);
            if (!t.prompt) return;
            if (t.prompt.length > 200) warn(T, "prompt 偏长（" + t.prompt.length + " 字），一次只问一件事");
            const opts = t.options || [];
            if (opts.length < 3) err(T, "options 少于 3 个（实际 " + opts.length + "）");
            if (opts.length > 4) warn(T, "options 多于 4 个，建议 3~4 个");
            opts.forEach((o, oi) => {
              const O = T + " option[" + oi + "]";
              if (!o.t) err(O, "缺少 t");
              if (!o.reply) err(O, "缺少 reply（必须讲清为什么）");
              if (!VERDICTS.includes(o.verdict)) err(O, "verdict 必须是 good/weak/bad，实际：" + o.verdict);
              if (o.verdict === "good") hasGood = true;
              if (o.next) {
                if (!ids.includes(o.next)) err(O, "next 指向不存在的 turn：" + o.next);
                if (o.next === t.id) err(O, "next 指向自己，形成环");
              } else hasEnd = true;
              if (o.reply && o.reply.length < 12) warn(O, "reply 过短");
            });
          });
          if (!hasGood) err(B, "socratic 至少要有 1 个 verdict 为 good 的选项（要给读者出路）");
          if (!hasEnd) warn(B, "socratic 建议至少有一个 turn 不设 next（表示对话收敛）");
          // 环检测（沿 next 走，看是否回到访问过的节点）
          const graph = {};
          turns.forEach((t) => { graph[t.id] = (t.options || []).map((o) => o.next).filter(Boolean); });
          const state2 = {};
          function dfs(n) {
            if (state2[n] === 1) { err(B, "socratic 的 next 存在环，经过：" + n); return true; }
            if (state2[n] === 2) return false;
            state2[n] = 1;
            for (const m of graph[n] || []) if (dfs(m)) return true;
            state2[n] = 2;
            return false;
          }
          Object.keys(graph).forEach((n) => dfs(n));
          break;
        }
        case "writing": {
          need(B, b, ["title", "prompt"]);
          checkWriting(B, b);
          break;
        }
      }
    }

    /* 每讲的结构性要求 */
    if (!counts.close) err(L, "缺少 close（原著精读）块");
    if (!counts.socratic) err(L, "缺少 socratic（苏格拉底式提问）块");
    if (!counts.interactive && !counts.calc) err(L, "缺少 interactive 或 calc 块（每讲至少 1 个推演）");
    if (!counts.analogy) warn(L, "建议加 1 个 analogy 块建立直觉");
    if (!counts.pitfall) warn(L, "建议加 1 个 pitfall 块");
    if ((counts.concept || 0) < 2) warn(L, "concept 块少于 2 个，核心讲解可能不够");

    /* ---------------- quiz ---------------- */
    const quiz = lesson.quiz || [];
    totalQuiz += quiz.length;
    if (quiz.length < 3) err(L, "quiz 少于 3 题（实际 " + quiz.length + "）");
    if (quiz.length > 6) warn(L, "quiz 多于 6 题（实际 " + quiz.length + "）");
    const qtexts = new Set();
    quiz.forEach((q, qi) => {
      const Q = L + " 测验 Q" + (qi + 1);
      uniq(Q, q.id);
      need(Q, q, ["id", "type", "q", "answer", "why"]);
      if (!QUIZ_TYPES.includes(q.type)) { err(Q, "未知题型：" + q.type); return; }
      if (qtexts.has(q.q)) err(Q, "题干与前面重复");
      qtexts.add(q.q);
      if (!q.why || q.why.length < 25) err(Q, "why 过短或缺失（必须写清为什么对 + 干扰项错在哪）");
      deepStrings({ q: q.q, why: q.why, options: q.options, items: q.items }).forEach((s) => scanBanned(Q, s));
      if (q.type === "single") {
        if (!Array.isArray(q.options) || q.options.length < 3) err(Q, "single 需要至少 3 个 options");
        if (typeof q.answer !== "number" || q.answer < 0 || q.answer >= (q.options || []).length) err(Q, "single 的 answer 索引越界：" + q.answer);
      } else if (q.type === "multi") {
        if (!Array.isArray(q.options) || q.options.length < 3) err(Q, "multi 需要至少 3 个 options");
        if (!Array.isArray(q.answer) || !q.answer.length) err(Q, "multi 的 answer 必须是非空数组");
        else {
          const a = q.answer.slice();
          if (a.some((i) => typeof i !== "number" || i < 0 || i >= (q.options || []).length)) err(Q, "multi 的 answer 索引越界");
          if (a.some((v, i) => i > 0 && v <= a[i - 1])) err(Q, "multi 的 answer 必须是升序数组");
        }
      } else if (q.type === "fill") {
        if (!Array.isArray(q.answer) || !q.answer.length) err(Q, "fill 的 answer 必须是非空字符串数组");
      } else if (q.type === "order") {
        if (!Array.isArray(q.items) || q.items.length < 3) err(Q, "order 需要至少 3 个 items");
        if (!Array.isArray(q.answer) || q.answer.length !== (q.items || []).length) err(Q, "order 的 answer 长度必须等于 items 长度");
        else {
          const sorted = q.answer.slice().sort((x, y) => x - y);
          if (sorted.some((v, i) => v !== i)) err(Q, "order 的 answer 必须是 0..n-1 的一个排列，实际：" + JSON.stringify(q.answer));
        }
      }
    });

    /* ---------------- flashcards ---------------- */
    const cards = lesson.flashcards || [];
    totalCards += cards.length;
    if (!cards.length) warn(L, "没有 flashcards（建议每讲都有）");
    if (cards.length && cards.length < 6) warn(L, "flashcards 偏少（" + cards.length + "），建议 6~12 张");
    const kinds = new Set();
    cards.forEach((f, fi) => {
      const F = L + " 闪卡 " + (fi + 1);
      uniq(F, f.id);
      need(F, f, ["id", "kind", "front", "back"]);
      if (!["term", "argument", "figure", "position"].includes(f.kind)) err(F, "kind 非法：" + f.kind);
      kinds.add(f.kind);
      if (f.back && f.back.length < 20) warn(F, "back 过短，应含一句话定义 + 例子或出处");
      if (f.where && !String(f.where).startsWith("philo-")) warn(F, "where 疑似不是 lesson id：" + f.where);
      deepStrings({ front: f.front, back: f.back }).forEach((s) => scanBanned(F, s));
    });

    /* ---------------- arguments ---------------- */
    const args = lesson.arguments || [];
    totalArgs += args.length;
    if (!args.length && !(lesson.blocks || []).some((b) => b.type === "writing")) {
      warn(L, "既没有 arguments 也没有 writing 块，本讲缺少可操作练习");
    }
    args.forEach((a, ai) => {
      const A = L + " 论证 " + (ai + 1);
      uniq(A, a.id);
      need(A, a, ["id", "title", "lines", "valid", "sound", "gap"]);
      const lines = a.lines || [];
      if (lines.length < 3) err(A, "lines 少于 3 条（实际 " + lines.length + "）");
      if (lines.length > 7) warn(A, "lines 多于 7 条，建议 3~7 条");
      const roleCount = { premise: 0, conclusion: 0, noise: 0 };
      lines.forEach((ln, li) => {
        if (!ln.t) err(A, "lines[" + li + "] 缺少 t");
        if (!ROLES.includes(ln.role)) err(A, "lines[" + li + "].role 非法：" + ln.role);
        else roleCount[ln.role]++;
      });
      if (roleCount.conclusion !== 1) err(A, "必须恰好 1 条 conclusion，实际 " + roleCount.conclusion);
      if (roleCount.premise < 2) err(A, "至少 2 条 premise，实际 " + roleCount.premise);
      if (roleCount.noise < 1) err(A, "至少 1 条 noise（干扰句），实际 " + roleCount.noise);
      if (typeof a.valid !== "boolean") err(A, "valid 必须是布尔值");
      if (typeof a.sound !== "boolean") err(A, "sound 必须是布尔值");
      if (a.valid === false && a.sound === true) err(A, "无效论证不可能同时是可靠的（sound）");
      if (!a.gap || a.gap.length < 30) err(A, "gap 过短（必须指出最弱前提及什么会推翻它）");
      deepStrings({ title: a.title, form: a.form, gap: a.gap, lines: lines.map((x) => x.t) }).forEach((s) => scanBanned(A, s));
    });

    /* ---------------- writing ---------------- */
    const ws = [...(lesson.writing || [])];
    ws.forEach((w, wi) => {
      const W = L + " 写作 " + (wi + 1);
      uniq(W, w.id);
      need(W, w, ["id", "title", "prompt"]);
      checkWriting(W, w);
    });
  }
  totalWriting += course.lessons.reduce((n, l) =>
    n + (l.writing || []).length + (l.blocks || []).filter((b) => b.type === "writing").length, 0);
}

/* ------------------------------------------------------------ 写作块校验 */
function checkWriting(where, w) {
  if (!(w.considerations || []).length) err(where, "缺少 considerations（至少 3 条）");
  else if (w.considerations.length < 3) err(where, "considerations 少于 3 条（实际 " + w.considerations.length + "）");
  else w.considerations.forEach((s) => scanBanned(where, s));
  const rb = w.rubric || [];
  if (rb.length < 4) err(where, "rubric 少于 4 项（实际 " + rb.length + "）");
  else {
    let sum = 0, bad = false;
    rb.forEach((r, ri) => {
      if (!r.k || !r.d) { err(where, "rubric[" + ri + "] 需要 k 与 d"); bad = true; }
      const v = weightOf(r.w);
      if (Number.isNaN(v)) { err(where, "rubric[" + ri + "].w 无法解析权重：" + r.w); bad = true; }
      else sum += v;
      scanBanned(where, r.k); scanBanned(where, r.d);
    });
    if (!bad && Math.round(sum) !== 100) err(where, "rubric 权重合计为 " + Math.round(sum) + "%，必须正好 100%");
  }
  if (!(w.pitfalls || []).length) warn(where, "建议给 2~4 条 pitfalls（常见失分点）");
  scanBanned(where, w.prompt);
  // sample 必须让学生看出这是范例而非标准答案：接受「范例/示例/样例/示范」等写法
  if (w.sample && !/范例|示例|样例|示范|仅供|不是标准答案/.test(w.sample)) {
    warn(where, "sample 建议明确标为范例（如开头写「以下为范例片段，不是标准答案」）");
  }
}

/* ------------------------------------------------------------ 输出 */
console.log("");
console.log("════════ 哲学站课程校验 ════════");
console.log("课程文件 " + files.length + " 个 ｜ 讲 " + totalLessons + " ｜ 讲解块 " + totalBlocks +
  " ｜ 测验 " + totalQuiz + " 题 ｜ 闪卡 " + totalCards + " 张 ｜ 论证重构 " + totalArgs + " 组 ｜ 写作 " + totalWriting + " 个");
console.log("");

if (warnings.length) {
  console.log("⚠ 警告 " + warnings.length + " 条：");
  warnings.slice(0, 60).forEach((w) => console.log("   " + w));
  if (warnings.length > 60) console.log("   …（还有 " + (warnings.length - 60) + " 条）");
  console.log("");
}
if (errors.length) {
  console.log("✗ 错误 " + errors.length + " 条：");
  errors.forEach((e) => console.log("   " + e));
  console.log("");
  console.log("合计：错误 " + errors.length + " ｜ 警告 " + warnings.length + " —— 未通过");
  process.exit(1);
} else {
  console.log("✓ 结构校验全部通过（警告 " + warnings.length + " 条）");
}
