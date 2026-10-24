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
const seenCardIds = new Map();
const seenQuestionText = new Map();

const err = (file, where, msg) => errors.push(`[${file}] ${where}: ${msg}`);
const warn = (file, where, msg) => warnings.push(`[${file}] ${where}: ${msg}`);

const isStr = (v) => typeof v === "string";
const isNonEmptyStr = (v) => isStr(v) && v.trim().length > 0;
const isInt = (v) => Number.isInteger(v);
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isArr = (v) => Array.isArray(v);

const CODE_LANGS = new Set(["c", "cpp", "python", "java", "js", "asm", "sql", "bash", "text"]);
const BLOCK_TYPES = new Set(["concept", "steps", "analogy", "code", "pitfall", "calc", "interactive", "lab", "formula"]);
const LABS = new Set(["pathlab", "schedlab", "cpulab", "pagelab", "arbitlab", "datalab", "simlab"]);
const QUIZ_TYPES = new Set(["single", "multi", "fill", "order"]);
const CARD_KINDS = new Set(["公式", "常量", "量级", "定律", "单位", "方法", "概念", "实验"]);

/* ------------------------------------------------ 载入 simlab 模型注册表
   让校验器能当场指出「引用了不存在的仿真模型」或「params/plots 写错了键」，
   而不是等到浏览器里打开才发现实验白屏。缺文件时降级为跳过（不阻塞结构校验）。 */
let SIM_MODELS = null;
try {
  globalThis.window = globalThis;
  const appDir = join(ROOT, "app");
  const engineFiles = ["simlab.js", ...readdirSync(appDir).filter((f) => /^simlab-models-.*\.js$/.test(f)).sort()];
  for (const f of engineFiles) {
    new Function(readFileSync(join(appDir, f), "utf8"))();
  }
  SIM_MODELS = globalThis.SIM ? globalThis.SIM.models : null;
} catch {
  SIM_MODELS = null;
}

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
      // 物理站特有：calc.verify 让「数必须算对」变成机器门禁（由 verify-numbers.mjs 真正重算）
      if (blk.verify !== undefined) {
        const v = blk.verify;
        if (!isObj(v)) err(file, where, "calc.verify 必须是对象");
        else {
          if (!isNonEmptyStr(v.expr)) err(file, where, "calc.verify.expr 缺失（要用 inputs 里的符号写算式）");
          if (v.value === undefined || !(isStr(v.value) || typeof v.value === "number")) err(file, where, "calc.verify.value 缺失（期望结果）");
          if (!isNonEmptyStr(v.unit)) warn(file, where, "calc.verify 建议写 unit（物理量必须带单位）");
          if (v.tol !== undefined && !(typeof v.tol === "number" && v.tol >= 0)) err(file, where, "calc.verify.tol 必须是非负数");
          if (v.map !== undefined && !isObj(v.map)) err(file, where, "calc.verify.map 必须是对象（符号 → 数值）");
        }
      }
      break;
    }
    case "formula": {
      if (!isArr(blk.items) || blk.items.length < 1) err(file, where, "formula 需要 items 数组(>=1)");
      else
        blk.items.forEach((it, i) => {
          if (!isObj(it)) { err(file, where, `formula.items[${i}] 必须是对象`); return; }
          if (!isNonEmptyStr(it.tex)) err(file, where, `formula.items[${i}] 缺少 tex（KaTeX 公式）`);
          // 物理站硬要求：单位与成立条件缺一不可（见 PHYSICS-CONTENT-SPEC §4）
          if (!isNonEmptyStr(it.units)) err(file, where, `formula.items[${i}] 缺少 units（各符号单位/量纲）`);
          if (!isNonEmptyStr(it.condition)) err(file, where, `formula.items[${i}] 缺少 condition（成立条件）`);
          if (!isNonEmptyStr(it.name)) warn(file, where, `formula.items[${i}] 建议写 name`);
          if (!isNonEmptyStr(it.note)) warn(file, where, `formula.items[${i}] 建议写 note（物理意义）`);
        });
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
      if (blk.lab === "simlab") {
        if (!isNonEmptyStr(c.model)) {
          err(file, where, "simlab.config.model 缺失（必须是已注册的模型名）");
        } else if (SIM_MODELS && !SIM_MODELS[c.model]) {
          err(file, where, `simlab.config.model 未注册: ${c.model}（可用：${Object.keys(SIM_MODELS).join(", ")}）`);
        } else if (SIM_MODELS) {
          const def = SIM_MODELS[c.model];
          if (c.params !== undefined) {
            if (!isObj(c.params)) err(file, where, "simlab.config.params 必须是对象");
            else
              for (const k of Object.keys(c.params)) {
                if (!def.params || !def.params[k]) { err(file, where, `simlab.config.params 里有模型 ${c.model} 不认识的参数 "${k}"`); continue; }
                if (typeof c.params[k] !== "number") { err(file, where, `simlab.config.params.${k} 必须是数字`); continue; }
                const pd = def.params[k];
                if (pd.type === "enum") {
                  const n = (pd.options || []).length;
                  if (!isInt(c.params[k]) || c.params[k] < 0 || c.params[k] >= n)
                    err(file, where, `simlab.config.params.${k} 是枚举参数，取值必须是 0~${n - 1} 的下标（0 = "${(pd.options || [])[0]}"）`);
                } else if (pd.min != null && pd.max != null && (c.params[k] < pd.min || c.params[k] > pd.max)) {
                  warn(file, where, `simlab.config.params.${k} = ${c.params[k]} 超出模型声明范围 ${pd.min}~${pd.max}`);
                }
              }
          }
          if (c.plots !== undefined) {
            if (!isArr(c.plots) || !c.plots.length) err(file, where, "simlab.config.plots 必须是非空数组（模型没有主图曲线时请整个省略 plots）");
            else {
              const known = (def.plots || []).map((p) => p.key);
              if (!known.length) {
                // 模型没有主图曲线（例如 ray-optics 全靠 extra.lines 画光路）：
                // 写任何 plots 都不会被画出来，属于"写了但没生效"的静默错误。
                err(file, where, `模型 ${c.model} 没有主图曲线（def.plots 为空），不应写 config.plots：${JSON.stringify(c.plots)}`);
              }
              for (const pk of c.plots) {
                if (!isStr(pk)) err(file, where, "simlab.config.plots 的元素必须是字符串");
                else if (known.length && !known.includes(pk)) err(file, where, `simlab.config.plots 里的 "${pk}" 不是模型 ${c.model} 的曲线（可用：${known.join(", ")}）`);
              }
            }
          }
          if (c.vary !== undefined) {
            if (!isArr(c.vary)) err(file, where, "simlab.config.vary 必须是数组");
            else {
              // 有主图曲线 → vary 叠加多条曲线；没有曲线但有读数条 → vary 生成"参数对比表"；
              // 两者都没有时 vary 才是真的什么都不做。
              if (!(def.plots || []).length) warn(file, where, `模型 ${c.model} 没有主图曲线，config.vary 将渲染成"参数对比表"（依赖模型的 bars 输出）`);
              c.vary.forEach((v, i) => {
                if (!isObj(v) || !isNonEmptyStr(v.key) || !isArr(v.values) || !v.values.length)
                  err(file, where, `simlab.config.vary[${i}] 需要 {key, values:[...]}`);
                else if (def.params && !def.params[v.key]) err(file, where, `simlab.config.vary[${i}].key "${v.key}" 不是模型参数`);
              });
            }
          }
        }
        if (!isNonEmptyStr(c.note)) warn(file, where, "simlab 建议写 note（告诉读者该看什么、该试什么）");
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
    // 物理站特有：数值填空题（引擎 quiz.js 已支持 numeric + tol 判分）
    if (q.numeric) {
      if (!(typeof q.tol === "number" && q.tol > 0)) err(file, where, "numeric 填空题必须给正的 tol（容差）");
      if (isArr(q.answer) && !q.answer.every((a) => a === undefined || a === null || isFinite(Number(String(a).replace(/[^\d.eE+-]/g, "")))))
        warn(file, where, "numeric 填空题的 answer 建议写成纯数字字符串（判分只比数值）");
      if (!isNonEmptyStr(q.unit)) warn(file, where, "数值题建议写 unit（判分与复习时会提示单位）");
    }
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
  const hasAnalogy = isArr(lesson.blocks) && lesson.blocks.some((b) => b.type === "analogy");
  const hasPitfall = isArr(lesson.blocks) && lesson.blocks.some((b) => b.type === "pitfall");
  const hasFormula = isArr(lesson.blocks) && lesson.blocks.some((b) => b.type === "formula");
  const types = new Set((lesson.quiz ?? []).map((q) => q.type));
  if (!types.has("single") && !types.has("multi")) warn(file, where, "缺少选择题");
  if (!hasAnalogy) warn(file, where, "缺少 analogy（物理站要求先建立直觉再上定量）");
  if (!hasPitfall) warn(file, where, "缺少 pitfall（物理学最容易错在单位、量纲与近似失效）");
  if (!hasFormula) warn(file, where, "缺少 formula 块（每讲至少把核心结论写成公式，并给单位与成立条件）");
  if (!hasCalc) warn(file, where, "缺少 calc（物理要能算，不能只讲道理）");

  // 闪卡（SM-2 间隔重复，见 app/cards.js）
  if (lesson.flashcards !== undefined) {
    if (!isArr(lesson.flashcards)) err(file, where, "flashcards 必须是数组");
    else {
      if (lesson.flashcards.length < 6) warn(file, where, `闪卡偏少（${lesson.flashcards.length} 张），建议 6~12 张`);
      lesson.flashcards.forEach((f, i) => {
        const w = `${where}.flashcards[${i}]`;
        if (!isObj(f)) return err(file, w, "闪卡必须是对象");
        if (!isNonEmptyStr(f.id)) err(file, w, "缺少 id");
        else {
          if (seenCardIds.has(f.id)) err(file, w, `闪卡 id 重复（已出现在 ${seenCardIds.get(f.id)}）`);
          else seenCardIds.set(f.id, w);
          if (!f.id.startsWith(prefix + "-")) err(file, w, `闪卡 id "${f.id}" 必须与课程统一前缀 "${prefix}-" 一致`);
        }
        if (!isNonEmptyStr(f.front)) err(file, w, "缺少 front");
        if (!isNonEmptyStr(f.back)) err(file, w, "缺少 back");
        else if (contentLen(f.back) < 12) warn(file, w, "back 过短，应含一句话定义 + 例子或成立条件");
        if (f.kind !== undefined && !CARD_KINDS.has(f.kind)) err(file, w, `kind 非法: ${f.kind}（可选 ${[...CARD_KINDS].join("/")}）`);
        if (f.kind === undefined) warn(file, w, "建议写 kind（公式/常量/量级/定律/单位/方法/概念/实验）");
      });
    }
  } else {
    warn(file, where, "没有 flashcards（物理站的公式与常量必须靠间隔重复记住）");
  }
  void hasCode;
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
