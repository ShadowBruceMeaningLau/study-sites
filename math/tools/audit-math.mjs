#!/usr/bin/env node
/**
 * audit-math.mjs —— 公式体检：把课程里每一段 $...$ 真渲染一遍，有错就报。
 *
 * 用法：
 *   node tools/audit-math.mjs              # 全站体检（有错则退出码 1）
 *   node tools/audit-math.mjs -v           # 同时列出所有公式（抽查排版用）
 *   node tools/audit-math.mjs --render '\frac{a}{b}'   # 单独渲染一段 TeX，看看对不对
 *
 * 为什么需要它：$...$ 写错时（少一个花括号、\begin 没配对、中文没包 \text{}）
 * 浏览器里只会无声地渲染成一团红字。这个脚本用**运行时同一套扫描器**
 * （app/mathrender.js 的 splitMath）加 KaTeX 本体来验收，写完立刻能查。
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");

/* ---------------------------------------------------------------- KaTeX */
const katexSrc = readFileSync(join(ROOT, "vendor", "katex", "katex.min.js"), "utf8");
const katexMod = { exports: {} };
new Function("module", "exports", katexSrc)(katexMod, katexMod.exports);
const katex = katexMod.exports;

/* --------------------------- 运行时同一套扫描器（不是复制的第二份） */
const winStub = { katex };
new Function("window", "globalThis", readFileSync(join(ROOT, "app", "mathrender.js"), "utf8"))(winStub, winStub);
const MATHR = winStub.MATHR;

const argv = process.argv.slice(2);
const VERBOSE = argv.includes("-v") || argv.includes("--verbose");
const rIdx = argv.indexOf("--render");
if (rIdx > -1) {
  const tex = argv[rIdx + 1] ?? "";
  try {
    console.log("TeX 解析通过：");
    console.log(katex.renderToString(tex, { displayMode: false, throwOnError: true, strict: false }));
  } catch (e) {
    console.log("TeX 有错：" + e.message);
    process.exitCode = 1;
  }
  process.exit();
}

/* ------------------------------------------------------------ 载入课程 */
const packs = [];
for (const f of readdirSync(DATA).filter((x) => x.endsWith(".js")).sort()) {
  const code = readFileSync(join(DATA, f), "utf8");
  const arr = [];
  try {
    new Function("window", "globalThis", code + ";")({ COURSE_PACKS: arr }, { COURSE_PACKS: arr });
  } catch (e) {
    console.log(`! ${f} 无法求值：${e.message}`);
    process.exitCode = 1;
    continue;
  }
  arr.forEach((c) => packs.push({ file: f, c }));
}

/* --------------------------------------------- 收集所有会走 Markdown 的字符串 */
const strings = [];   // { where, text }
const nonRender = []; // 不会渲染公式的字段（code / state），用来反向检查误写
function walk(node, where, key) {
  if (typeof node === "string") {
    // code 字段走语法高亮，不解析 $...$；state/数值字段也不走 Markdown
    if (key === "code" || key === "state") {
      nonRender.push({ where, text: node, key });
      return;
    }
    strings.push({ where, text: node });
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((v, i) => walk(v, where + "[" + i + "]", key));
    return;
  }
  if (node && typeof node === "object") {
    for (const k of Object.keys(node)) walk(node[k], where + "." + k, k);
  }
}
for (const { file, c } of packs) {
  walk(c.meta || {}, file + " meta");
  for (const l of c.lessons || []) {
    const base = file + " / " + (c.title || c.id) + " / " + (l.title || l.id);
    walk({ goal: l.goal, need: l.need, summary: l.summary }, base);
    (l.blocks || []).forEach((b, bi) => walk(b, base + " / 块" + (bi + 1) + "(" + (b.type || "?") + ")"));
    (l.quiz || []).forEach((q, qi) => walk(q, base + " / 题" + (qi + 1)));
  }
}

/* ------------------------- 反向检查：$...$ 有没有写进「不会渲染」的字段里 */
const misplaced = [];
for (const { where, text, key } of nonRender) {
  const parts = MATHR.splitMath(text);
  // 只有「真的像 TeX」的才算误写：SQL 里的 $1/$2、awk 里的 $1 这些没有反斜杠/上下标，属正常
  const hits = parts.filter((p) => p.math && /[\\^_{}]/.test(p.text));
  if (hits.length) misplaced.push({ where, key, n: hits.length, sample: hits[0].text.slice(0, 50) });
}

/* ------------------------------------------------------------------ 体检 */
const errors = [];
const warns = [];
let nMath = 0;
const perFile = new Map();

for (const { where, text } of strings) {
  const parts = MATHR.splitMath(text);
  const hasMath = parts.some((p) => p.math);
  if (hasMath) {
    const f = where.split(" / ")[0];
    perFile.set(f, (perFile.get(f) || 0) + parts.filter((p) => p.math).length);
  }
  for (const p of parts) {
    if (!p.math) continue;
    nMath++;
    if (VERBOSE) console.log("  $ " + p.text + "   ← " + where);
    try {
      katex.renderToString(p.text, { displayMode: false, throwOnError: true, strict: false, trust: false });
    } catch (e) {
      errors.push({ where, tex: p.text, msg: e.message.replace(/\s+/g, " ").slice(0, 140) });
    }
  }
  // 落单的 $ （含 \$ 转义后剩下的）：提示作者确认是不是漏了配对。
  // 先挖掉独占一行的 $$...$$ 大公式与行内 $$...$$，它们由 markdown.js 单独处理，不是落单。
  const forDollar = text
    .replace(/^\s*\$\$[^$\n]*\$\$\s*$/gm, "")
    .replace(/\$\$[^$\n]*\$\$/g, "")
    .replace(/\\\$/g, "");
  const bare = forDollar.split("$").length - 1;
  const paired = parts.filter((p) => p.math).length * 2;
  if (bare - paired > 0 && bare - paired <= 3) {
    warns.push({ where, n: bare - paired, text: text.slice(0, 70).replace(/\n/g, " ") });
  }
}

/* ------------------------- 反向检查 2：丢了反斜杠的 TeX 命令（不报错但很难看） */
const RESIDUE = /\b(alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|lambda|mu|nu|xi|pi|rho|sigma|tau|phi|varphi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Pi|Sigma|Phi|Psi|Omega|frac|dfrac|sqrt|sum|prod|int|oint|lim|log|ln|sin|cos|tan|exp|max|min|sup|inf|det|dim|ker|cdot|cdots|times|div|pm|le|leq|ge|geq|ne|neq|approx|equiv|to|infty|partial|nabla|forall|exists|in|notin|subset|subseteq|cup|cap|mathbb|mathcal|mathrm|text|overline|vec|bar|hat)\b/g;
const residue = [];
const doubled = [];
for (const { where, text } of strings) {
  for (const p of MATHR.splitMath(text)) {
    if (!p.math) continue;
    // 去掉 \text{...} 之类的整块内容与真正的 \命令，剩下的命令名才是丢了反斜杠的
    const stripped = p.text
      .replace(/\\(text|mathrm|operatorname|mbox|textbf|textit)\{[^{}]*\}/g, "")
      .replace(/\\[A-Za-z]+/g, "")
      .replace(/\\./g, "");
    const hit = new Set();
    for (const m of stripped.matchAll(RESIDUE)) {
      // 紧跟在下标/上标里的词是标签（如 C_{in}、H_{out}、x_{max}），不是丢了反斜杠，不算
      const before = stripped.slice(0, m.index).replace(/\s+$/, "");
      const p1 = before.slice(-1);
      const p2 = before.slice(-2);
      if (p1 === "_" || p1 === "^" || p2 === "_{" || p2 === "^{") continue;
      hit.add(m[0]);
    }
    if (hit.size) residue.push({ where, tex: p.text.slice(0, 60), hit: [...hit] });
    // 反斜杠写多了：\\frac、\\%、\\pi —— 矩阵换行 \\ 后面只会跟空格或 &，绝不会跟字母
    const extra = p.text.match(/\\\\[A-Za-z%]/);
    if (extra) doubled.push({ where, tex: p.text.slice(0, 60), at: extra[0] });
  }
}

/* ------------------------- 反向检查 3：看着像公式、却被判定成普通文本的 $...$ */
const rejected = [];
for (const { where, text } of strings) {
  // 先把「已经被正确识别为公式」的片段换成等长占位符，再找剩下的 $...$ 候选。
  // 另外要把 \$ 转义先换掉 —— splitMath 会把 \$ 渲染成字面 $ 并丢掉反斜杠，
  // 不先换掉的话，\$esp 这种「本意就是字面美元符」的写法会被误报成一对 $esp$。
  const masked = MATHR.splitMath(String(text).replace(/\\\$/g, "\u0000"))
    .map((p) => (p.math ? "$" + "M".repeat(p.text.length) + "$" : p.text))
    .join("")
    .replace(/\$\$[^$\n]*\$\$/g, "");
  const raw = masked.match(/\$[^$\n]*\$/g) || [];
  for (const r of raw) {
    const body = r.slice(1, -1);
    const why = MATHR.whyNotMath(body);
    if (why) rejected.push({ where, body, why });
  }
}

/* ------------------------- 反向检查 4：字符级损坏（历史上一次批量替换留下的伤） */
const CORRUPT = [
  [/_([0-9])\1{2,}/, "下标里同一个数字重复三次以上（如 a_000）"],
  [/[_^]([A-Za-z])\1{2,}/, "下标/上标里同一个字母重复三次以上（如 E_kkk、y_jjj）"],
  [/\^([0-9])\1{2,}/, "上标里同一个数字重复三次以上（如 2^666）"],
  [/\({4,}/, "连续四个以上左括号（如 ((((((）"],
];
const corrupt = [];
for (const { where, text } of strings) {
  if (/\.state\.|\(code\)/.test(where)) continue;   // 实验数据与代码块里的下标不参与「损坏」判定
  for (const [re, why] of CORRUPT) {
    const m = String(text).match(re);
    if (m) { corrupt.push({ where, why, at: m[0] }); break; }
  }
}

/* ------------------------------------------------------------------ 报告 */
console.log("=== 公式体检（引擎：" + (MATHR.engine && MATHR.engine() ? "KaTeX " + katex.version : "纯 CSS") + "）===");
console.log("扫过字符串 " + strings.length + " 条，识别出公式 " + nMath + " 段。");
if (perFile.size) {
  console.log("\n各文件公式数：");
  [...perFile.entries()].sort((a, b) => b[1] - a[1]).forEach(([f, n]) => console.log("  " + String(n).padStart(5) + "  " + f));
}

if (errors.length) {
  console.log("\n=== ✗ 语法错误 " + errors.length + " 处 ===");
  for (const e of errors) {
    console.log("  ✗ " + e.where);
    console.log("      TeX: " + e.tex);
    console.log("      原因: " + e.msg);
  }
} else {
  console.log("\n✓ 所有公式 TeX 语法正确，KaTeX 全部渲染通过。");
}

if (warns.length) {
  console.log("\n=== ! 落单的 $（不是公式，但请确认是有意为之）" + warns.length + " 处 ===");
  if (VERBOSE) for (const w of warns) console.log("  ! " + w.where + "  ($ ×" + w.n + ")\n      " + w.text);
  else console.log("  （加 -v 查看明细；常见于 shell 的 echo $?、SQL 的 $1 占位符，属正常）");
}

if (misplaced.length) {
  console.log("\n=== ! 公式写进了「不会渲染」的字段 " + misplaced.length + " 处 ===");
  console.log("  （code 代码块与 interactive.config.state 是按纯文本显示的，写 $...$ 只会原样露出）");
  for (const m of misplaced.slice(0, VERBOSE ? 999 : 12)) {
    console.log("  ! " + m.where + "  (" + m.key + " ×" + m.n + ")  " + m.sample);
  }
  if (!VERBOSE && misplaced.length > 12) console.log("  ……加 -v 看全部");
} else {
  console.log("\n✓ 没有把 $...$ 写进代码块或实验数据字段。");
}

if (residue.length) {
  console.log("\n=== ! 疑似丢了反斜杠的 TeX 命令 " + residue.length + " 处 ===");
  console.log("  （JS 字符串里写单个 \\frac，反斜杠会被当成转义符吃掉，公式不会报错但会渲染成歪的斜体字母）");
  for (const r of residue.slice(0, VERBOSE ? 999 : 15)) {
    console.log("  ! " + r.where + "  →  " + r.hit.join(", "));
    console.log("      TeX: " + r.tex);
  }
  if (!VERBOSE && residue.length > 15) console.log("  ……加 -v 看全部");
} else {
  console.log("\n✓ 没有发现丢反斜杠的 TeX 命令。");
}

if (rejected.length) {
  const byWhy = {};
  rejected.forEach((r) => { byWhy[r.why] = (byWhy[r.why] || 0) + 1; });
  console.log("\n=== ! 写了 $...$ 但没被当成公式（会原样显示美元符号）" + rejected.length + " 处 ===");
  Object.entries(byWhy).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log("  " + String(v).padStart(4) + "  " + k));
  for (const r of rejected.slice(0, VERBOSE ? 999 : 10)) {
    console.log("  ! " + r.where + "  →  $" + r.body.slice(0, 40) + "$");
    console.log("      " + r.why);
  }
  if (!VERBOSE && rejected.length > 10) console.log("  ……加 -v 看全部（这一节多数是 ${} 占位符、echo $? 之类，属正常；但出现「首尾有空格」或「中文没包 text」就要改内容）");
}

if (doubled.length) {
  console.log("\n=== ! 反斜杠写多了 " + doubled.length + " 处 ===");
  console.log("  （源码里应当写 \\frac（两个反斜杠），写成了 \\\\frac（四个）就会渲染失败）");
  for (const d of doubled.slice(0, VERBOSE ? 999 : 10)) {
    console.log("  ! " + d.where + "  →  " + d.at + "   in  " + d.tex);
  }
  if (!VERBOSE && doubled.length > 10) console.log("  ……加 -v 看全部");
}

if (corrupt.length) {
  console.log("\n=== ! 疑似字符级损坏 " + corrupt.length + " 处 ===");
  console.log("  （历史上一次正则批量替换留下的伤：字符被重复或吃掉，公式意思会变，请人工核对上下文再修）");
  for (const c of corrupt.slice(0, VERBOSE ? 999 : 12)) {
    console.log("  ! " + c.where + "  →  " + c.at + "   " + c.why);
  }
  if (!VERBOSE && corrupt.length > 12) console.log("  ……加 -v 看全部");
}

if (errors.length) process.exitCode = 1;
