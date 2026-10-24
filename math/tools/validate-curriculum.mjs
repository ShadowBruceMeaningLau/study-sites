#!/usr/bin/env node
/**
 * 课程内容校验器（零依赖）
 * 用法：node tools/validate-curriculum.mjs
 * 退出码 0 = 全部通过；1 = 存在错误。
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = join(ROOT, "data");
const STRICT = !process.argv.includes("--lenient");

const errors = [];
const warnings = [];
const seenLessonIds = new Map();
const seenQuizIds = new Map();
const seenQuestionText = new Map();

const err = (file, where, msg) => errors.push(`[${file}] ${where}: ${msg}`);
const warn = (file, where, msg) => warnings.push(`[${file}] ${where}: ${msg}`);

const isStr = (v) => typeof v === "string";
const isNonEmptyStr = (v) => isStr(v) && v.trim().length > 0;
const isInt = (v) => Number.isInteger(v);
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isArr = (v) => Array.isArray(v);

const CODE_LANGS = new Set(["c", "cpp", "python", "java", "js", "asm", "sql", "bash", "text"]);
const BLOCK_TYPES = new Set(["concept", "steps", "analogy", "code", "pitfall", "calc", "interactive", "lab"]);
const LABS = new Set(["pathlab", "schedlab", "cpulab", "pagelab", "arbitlab", "datalab"]);
const QUIZ_TYPES = new Set(["single", "multi", "fill", "order"]);

/** 中文可用字数（粗略）：不算标点与空白，用于判断解释是否敷衍 */
const contentLen = (s) => (s ?? "").replace(/[\s，。、；：？！「」（）()《》"'`.,;:!?\-_/\\|]/g, "").length;

function loadPackFrom(file, code) {
  const packs = [];
  const sandbox = { COURSE_PACKS: packs };
  const fn = new Function("window", "globalThis", `${code}\n;`);
  fn(sandbox, sandbox);
  return packs;
}

// ---------------------------------------------------------------- lesson 校验
function checkInteractive(file, where, blk, courseId) {
  if (!BLOCK_TYPES.has(blk.type)) return err(file, where, `未知 block type: ${blk.type}`);
  if (!isNonEmptyStr(blk.title)) err(file, where, "缺少 title");

  switch (blk.type) {
    case "concept":
    case "analogy": {
      if (!isNonEmptyStr(blk.md)) err(file, where, `${blk.type} 缺少 md`);
      else if (contentLen(blk.md) < 80) warn(file, where, `${blk.type} 内容偏短（<80 字），可能讲不透`);
      break;
    }
    case "steps": {
      if (!isArr(blk.items) || blk.items.length < 2) err(file, where, "steps 需要 items 数组(>=2)");
      else
        blk.items.forEach((it, i) => {
          if (isStr(it)) {
            if (!isNonEmptyStr(it)) err(file, where, `steps.items[${i}] 为空`);
          } else if (isObj(it)) {
            if (!isNonEmptyStr(it.t)) err(file, where, `steps.items[${i}] 缺少 t`);
            if (!isNonEmptyStr(it.d)) err(file, where, `steps.items[${i}] 缺少 d`);
          } else err(file, where, `steps.items[${i}] 类型非法`);
        });
      break;
    }
    case "code": {
      if (!isNonEmptyStr(blk.code)) err(file, where, "code 缺少代码内容");
      if (!CODE_LANGS.has(blk.lang)) err(file, where, `code.lang 非法: ${blk.lang}`);
      break;
    }
    case "pitfall": {
      if (!isArr(blk.items) || blk.items.length < 2) err(file, where, "pitfall 需要 items 数组(>=2)");
      break;
    }
    case "calc": {
      if (!isArr(blk.inputs) || blk.inputs.length < 1) err(file, where, "calc 需要 inputs 数组");
      else
        blk.inputs.forEach((it, i) => {
          if (!isObj(it) || !isNonEmptyStr(it.name)) err(file, where, `calc.inputs[${i}] 缺少 name`);
          else if (!isStr(it.value)) err(file, where, `calc.inputs[${i}].value 必须是字符串`);
        });
      if (!isArr(blk.outputs) || blk.outputs.length < 1) err(file, where, "calc 需要 outputs 数组");
      else if (!blk.outputs.every(isStr)) err(file, where, "calc.outputs 元素必须是字符串");
      break;
    }
    case "lab": {
      if (!isArr(blk.steps) || blk.steps.length < 2) err(file, where, "lab 需要 steps 数组(>=2)");
      break;
    }
    case "interactive": {
      if (!LABS.has(blk.lab)) {
        err(file, where, `interactive.lab 非法: ${blk.lab}（可选 ${[...LABS].join("/")}）`);
        break;
      }
      if (!isObj(blk.config)) {
        err(file, where, "interactive 缺少 config 对象");
        break;
      }
      const c = blk.config;
      const numGrid = (g) => isArr(g) && g.length > 0 && g.every((r) => isArr(r) && r.length === g[0].length && r.every((v) => isInt(v) && v >= 0 && v <= 9));
      if (blk.lab === "pathlab") {
        if (!numGrid(c.grid)) err(file, where, "pathlab.config.grid 必须是等长数字矩阵(0=墙,1..9=代价)");
        else {
          const h = c.grid.length, w = c.grid[0].length;
          for (const key of ["start", "end"]) {
            const p = c[key];
            if (!isArr(p) || p.length !== 2 || !isInt(p[0]) || !isInt(p[1])) err(file, where, `pathlab.config.${key} 必须是 [row,col]`);
            else if (p[0] < 0 || p[0] >= h || p[1] < 0 || p[1] >= w) err(file, where, `pathlab.config.${key} 越界`);
            else if (c.grid[p[0]][p[1]] === 0) err(file, where, `pathlab.config.${key} 落在墙上`);
          }
          if (!["bfs", "dijkstra"].includes(c.algo)) err(file, where, 'pathlab.config.algo 必须是 "bfs" 或 "dijkstra"');
        }
      }
      if (blk.lab === "schedlab") {
        if (!isArr(c.procs) || c.procs.length < 2 || c.procs.length > 6) err(file, where, "schedlab.config.procs 需要 2~6 个进程");
        else
          c.procs.forEach((p, i) => {
            if (!isObj(p) || !isNonEmptyStr(p.name) || !isInt(p.arrival) || !isInt(p.burst) || p.arrival < 0 || p.burst < 1)
              err(file, where, `schedlab.procs[${i}] 需要 {name, arrival>=0, burst>=1}`);
          });
        if (c.quantum !== undefined && (!isInt(c.quantum) || c.quantum < 1)) err(file, where, "schedlab.config.quantum 必须 >=1");
        if (c.algos !== undefined && (!isArr(c.algos) || !c.algos.every((a) => ["FCFS", "SJF", "SRTF", "RR", "优先级"].includes(a))))
          err(file, where, "schedlab.config.algos 含非法算法名");
      }
      if (blk.lab === "cpulab") {
        if (!isArr(c.program) || c.program.length < 3) err(file, where, "cpulab.config.program 至少 3 条指令");
        else
          c.program.forEach((p, i) => {
            if (!isObj(p) || !isNonEmptyStr(p.asm)) err(file, where, `cpulab.program[${i}] 需要 {asm, note}`);
          });
        if (!isObj(c.regs) || Object.keys(c.regs).length < 2) err(file, where, "cpulab.config.regs 至少 2 个寄存器");
      }
      if (blk.lab === "pagelab") {
        if (!isInt(c.frames) || c.frames < 1 || c.frames > 6) err(file, where, "pagelab.config.frames 需要 1~6 的整数");
        if (!isArr(c.refs) || c.refs.length < 5 || c.refs.length > 24 || !c.refs.every((r) => isInt(r) && r >= 0 && r <= 9))
          err(file, where, "pagelab.config.refs 需要 5~24 个 0~9 的页号");
        if (c.algos !== undefined && (!isArr(c.algos) || !c.algos.every((a) => ["OPT", "FIFO", "LRU", "CLOCK"].includes(a))))
          err(file, where, "pagelab.config.algos 含非法算法名");
      }
      if (blk.lab === "arbitlab") {
        if (!isInt(c.bits) || c.bits < 4 || c.bits > 64) err(file, where, "arbitlab.config.bits 需要 4~64 的整数（32 位用于 IEEE 754 单精度）");
        if (c.modes !== undefined && (!isArr(c.modes) || c.modes.length === 0)) err(file, where, "arbitlab.config.modes 必须是非空数组");
      }
      if (blk.lab === "datalab") {
        if (!isArr(c.steps) || c.steps.length < 4) err(file, where, "datalab.config.steps 至少 4 步");
        else
          c.steps.forEach((s, i) => {
            if (!isObj(s) || !isNonEmptyStr(s.desc)) err(file, where, `datalab.steps[${i}] 需要 {desc, state}`);
            if (!isObj(s.state)) err(file, where, `datalab.steps[${i}].state 必须是对象`);
          });
        if (!isObj(c.state)) warn(file, where, "datalab.config.state 缺失（建议给出初始状态）");
      }
      if (c.tasks !== undefined) {
        if (!isArr(c.tasks)) err(file, where, "interactive.config.tasks 必须是数组");
        else c.tasks.forEach((t, i) => (isStr(t) || (isObj(t) && isNonEmptyStr(t.t))) || err(file, where, `config.tasks[${i}] 非法`));
      }
      break;
    }
    default:
      break;
  }
  void courseId;
}

function checkQuiz(file, where, q, courseId, prefix) {
  if (!isNonEmptyStr(q.id)) err(file, where, "题目缺少 id");
  else {
    if (seenQuizIds.has(q.id)) err(file, where, `题目 id 重复（已出现在 ${seenQuizIds.get(q.id)}）`);
    else seenQuizIds.set(q.id, where);
    if (!q.id.startsWith(prefix + "-")) err(file, where, `题目 id "${q.id}" 必须与课程统一前缀 "${prefix}-" 一致`);
  }
  if (!QUIZ_TYPES.has(q.type)) return err(file, where, `未知题型: ${q.type}`);
  if (!isNonEmptyStr(q.q)) err(file, where, "缺少题干 q");
  else {
    const key = q.q.trim();
    if (seenQuestionText.has(key)) err(file, where, `题干与 ${seenQuestionText.get(key)} 重复`);
    else seenQuestionText.set(key, where);
  }
  if (!isNonEmptyStr(q.why)) err(file, where, "缺少解析 why");
  else if (contentLen(q.why) < 15) warn(file, where, `解析过短（${contentLen(q.why)} 字），要写清"为什么对 + 干扰项错在哪"`);

  if (q.type === "single" || q.type === "multi") {
    if (!isArr(q.options) || q.options.length < 3) err(file, where, "选择题需要 >=3 个 options");
    else if (!q.options.every(isNonEmptyStr)) err(file, where, "options 元素必须是非空字符串");
    if (q.type === "single") {
      if (!isInt(q.answer)) err(file, where, "single.answer 必须是整数索引");
      else if (q.answer < 0 || q.answer >= (q.options?.length ?? 0)) err(file, where, `single.answer=${q.answer} 越界`);
    } else {
      if (!isArr(q.answer) || q.answer.length < 2) err(file, where, "multi.answer 至少 2 个索引");
      else {
        if (!q.answer.every(isInt)) err(file, where, "multi.answer 必须都是整数");
        if (new Set(q.answer).size !== q.answer.length) err(file, where, "multi.answer 有重复索引");
        if (q.answer.some((i) => i < 0 || i >= (q.options?.length ?? 0))) err(file, where, "multi.answer 索引越界");
      }
    }
  }
  if (q.type === "fill") {
    if (!isArr(q.answer) || q.answer.length < 1) err(file, where, "fill.answer 需要至少 1 个可接受答案");
    else if (!q.answer.every(isNonEmptyStr)) err(file, where, "fill.answer 元素必须是字符串");
  }
  if (q.type === "order") {
    if (!isArr(q.items) || q.items.length < 3) err(file, where, "order 需要 >=3 个 items");
    if (!isArr(q.answer) || q.answer.length !== (q.items?.length ?? -1)) err(file, where, "order.answer 长度必须与 items 相同");
    else if (new Set(q.answer).size !== q.answer.length || q.answer.some((i) => i < 0 || i >= q.items.length))
      err(file, where, "order.answer 必须是 items 索引的一个排列");
  }
  void STRICT;
}

function checkLesson(file, course, lesson, prefix) {
  const where = `lesson ${lesson?.id ?? "?"}`;
  if (!isNonEmptyStr(lesson.id)) return err(file, where, "缺少 lesson.id");
  if (!lesson.id.startsWith(prefix + "-")) err(file, where, `lesson.id "${lesson.id}" 必须与课程统一前缀 "${prefix}-" 一致`);
  if (seenLessonIds.has(lesson.id)) err(file, where, `lesson.id 重复（已出现在 ${seenLessonIds.get(lesson.id)}）`);
  else seenLessonIds.set(lesson.id, where);
  if (!isNonEmptyStr(lesson.title)) err(file, where, "缺少 title");
  if (!isNonEmptyStr(lesson.goal)) err(file, where, "缺少 goal（学习目标）");
  if (!isInt(lesson.est) || lesson.est < 5 || lesson.est > 240) err(file, where, "est 需要 5~240 的整数(分钟)");

  if (!isArr(lesson.blocks) || lesson.blocks.length < 3) err(file, where, "blocks 至少 3 块");
  else lesson.blocks.forEach((b, i) => checkInteractive(file, `${where}.blocks[${i}]`, b, course.id));

  if (!isArr(lesson.quiz) || lesson.quiz.length < 2) err(file, where, "quiz 至少 2 题");
  else lesson.quiz.forEach((q, i) => checkQuiz(file, `${where}.quiz[${i}]`, q, course.id, prefix));

  const hasLab = isArr(lesson.blocks) && lesson.blocks.some((b) => b.type === "lab" || b.type === "interactive");
  if (!hasLab) warn(file, where, "本课没有任何 lab / interactive 动手环节");
  const hasCode = isArr(lesson.blocks) && lesson.blocks.some((b) => b.type === "code");
  const hasCalc = isArr(lesson.blocks) && lesson.blocks.some((b) => b.type === "calc");
  const types = new Set((lesson.quiz ?? []).map((q) => q.type));
  if (!types.has("single") && !types.has("multi")) warn(file, where, "缺少选择题");
  void hasCode;
  void hasCalc;
}

function checkCourse(file, course) {
  const where = `course ${course?.id ?? "?"}`;
  if (!isNonEmptyStr(course.id)) return err(file, where, "缺少 course.id");
  if (!isNonEmptyStr(course.title)) err(file, where, "缺少 title");
  if (!isNonEmptyStr(course.blurb)) err(file, where, "缺少 blurb");
  if (contentLen(course.blurb) < 12) warn(file, where, "blurb 过短");
  if (!isNonEmptyStr(course.icon)) warn(file, where, "缺少 icon");
  if (!isNonEmptyStr(course.term)) warn(file, where, "缺少 term（建议修读时间）");
  if (!isInt(course.hours) || course.hours < 8) warn(file, where, "hours 建议为 >=8 的整数");
  if (!isArr(course.tags)) warn(file, where, "缺少 tags");
  if (!isArr(course.lessons) || course.lessons.length < 3) return err(file, where, "lessons 至少 3 课");

  // 前缀一致性：课程内所有 lesson/quiz id 必须共用同一个短前缀
  const prefixes = {};
  course.lessons.forEach((l) => {
    const p = String(l?.id || "").split("-")[0];
    if (p) prefixes[p] = (prefixes[p] || 0) + 1;
  });
  const prefix = Object.keys(prefixes).sort((a, b) => prefixes[b] - prefixes[a])[0];
  if (!prefix) return err(file, where, "无法推断 id 前缀");
  const odd = Object.keys(prefixes).filter((p) => p !== prefix);
  if (odd.length) err(file, where, `课程内 id 前缀不一致：多数为 "${prefix}-"，另有 ${odd.map((o) => o + "-").join(", ")}`);
  course.prefix = prefix;

  const labCount = course.lessons.reduce(
    (n, l) => n + ((l.blocks ?? []).filter((b) => b.type === "interactive").length),
    0
  );
  if (labCount < 2) warn(file, where, `交互式实验偏少（${labCount} 个），建议每课都有可动手的实验`);
  course.lessons.forEach((l) => checkLesson(file, course, l, prefix));
}

// ------------------------------------------------------------------- 主流程
let files = [];
try {
  files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".js")).sort();
} catch {
  console.error(`找不到目录 ${DATA_DIR}`);
  process.exit(1);
}
if (files.length === 0) {
  console.error("data/ 下没有任何课程文件");
  process.exit(1);
}

const packs = [];
for (const f of files) {
  const full = join(DATA_DIR, f);
  let code = readFileSync(full, "utf8");
  if (code.charCodeAt(0) === 0xfeff) {
    err(f, "file", "文件含 BOM，请保存为「UTF-8 无 BOM」");
    code = code.replace(/^\uFEFF/, "");
  }
  // 模块系统禁令：只在"真的当代码用"时判定，避免正文里的英文单词误报
  const codeViolation =
    /(^|\n)\s*(const|let|var)\s+[\w${},\s]+\s*=\s*require\s*\(/.test(code) ||
    /(^|\n)\s*(import|export)\s+[{*\w]/.test(code) ||
    /(^|\n)\s*module\.exports\s*=/.test(code) ||
    /(^|\n)\s*export\s+default\b/.test(code);
  if (codeViolation) err(f, "file", "课程文件不得使用 require / import / export（此为纯数据文件）");
  if (/`/.test(code)) warn(f, "file", "建议避免反引号模板字符串，改用普通字符串以免转义问题");
  let got;
  try {
    got = loadPackFrom(f, code);
  } catch (e) {
    err(f, "file", `无法求值：${e.message}`);
    continue;
  }
  if (got.length === 0) {
    err(f, "file", "没有向 window.COURSE_PACKS 推送内容");
    continue;
  }
  if (got.length > 1) warn(f, "file", `推送了 ${got.length} 个课程，建议一个文件一门课`);
  got.forEach((c) => {
    const expectedId = f.replace(/\.js$/, "");
    if (c.id !== expectedId) warn(f, "file", `course.id "${c.id}" 与文件名 "${expectedId}" 不一致`);
    packs.push({ file: f, course: c });
  });
}

packs.forEach(({ file, course }) => checkCourse(file, course));

// 统计
const stat = packs.map(({ file, course }) => {
  const lessons = course.lessons ?? [];
  const labs = lessons.reduce((n, l) => n + (l.blocks ?? []).filter((b) => b.type === "interactive").length, 0);
  const quiz = lessons.reduce((n, l) => n + (l.quiz ?? []).length, 0);
  const minutes = lessons.reduce((n, l) => n + (l.est ?? 0), 0);
  return { file, id: course.id, title: course.title, lessons: lessons.length, labs, quiz, minutes };
});

const pad = (s, n) => String(s) + " ".repeat(Math.max(0, n - [...String(s)].reduce((a, c) => a + (c.charCodeAt(0) > 255 ? 2 : 1), 0)));
console.log("\n=== 课程统计 ===");
console.log(pad("课程", 34) + pad("课时", 8) + pad("实验", 8) + pad("题量", 8) + "时长");
for (const s of stat) {
  console.log(pad(s.title, 34) + pad(s.lessons, 8) + pad(s.labs, 8) + pad(s.quiz, 8) + `${Math.round(s.minutes / 60)}h`);
}
const total = stat.reduce(
  (a, s) => ({ lessons: a.lessons + s.lessons, labs: a.labs + s.labs, quiz: a.quiz + s.quiz, minutes: a.minutes + s.minutes }),
  { lessons: 0, labs: 0, quiz: 0, minutes: 0 }
);
console.log(
  `\n合计：${stat.length} 门课 / ${total.lessons} 课 / ${total.labs} 个交互实验 / ${total.quiz} 道题 / 约 ${Math.round(total.minutes / 60)} 学时`
);

if (warnings.length) {
  console.log(`\n=== 提示 (${warnings.length}) ===`);
  warnings.forEach((w) => console.log("· " + w));
}
if (errors.length) {
  console.log(`\n=== 错误 (${errors.length}) ===`);
  errors.forEach((e) => console.log("✗ " + e));
  console.log("\n校验失败。请按 CONTENT-SPEC.md 修正后重跑。");
  process.exit(1);
}
console.log("\n✓ 内容校验通过。");
