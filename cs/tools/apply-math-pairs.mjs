#!/usr/bin/env node
/**
 * apply-math-pairs.mjs —— 安全批量改写：给一批「原文 → 新文」精确替换，工具负责把关。
 *
 * 为什么需要它：逐个手改几百处太慢，但用正则全局扫一遍又会把文件改坏
 *（本站历史上真的被一次正则替换毁过一个课程文件）。这个工具取中间路线：
 *   · 只做**精确字符串替换**，找不到 / 找到多处 都直接报错；
 *   · 改完立刻在内存里重新求值课程文件，并比对结构指纹（课程/讲/块/题/实验数量）；
 *   · 任何一步不过 → 自动还原成原文件，退出码 1。
 *
 * 用法：
 *   node tools/apply-math-pairs.mjs --file data/xxx.js --pairs pairs.json [--dry] [--keep-bak]
 *
 * pairs.json（from / to 都是**文件里原样的字符**，不需要额外转义层次）：
 *   [
 *     { "from": "\"√2 不是有理数\"", "to": "\"$\\\\sqrt{2}$ 不是有理数\"" },
 *     { "from": "O(n log n)", "to": "$O(n \\\\log n)$", "all": true }
 *   ]
 *   · 默认要求 from 在文件里**只出现一次**；确实要全改就加 "all": true。
 *   · "note" 字段随便写，仅用于报告。
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync, unlinkSync } from "node:fs";
import { join, dirname, resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const getArg = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);

const fileArg = getArg("--file");
const pairsArg = getArg("--pairs");
const dry = argv.includes("--dry");
const keepBak = argv.includes("--keep-bak");

if (!fileArg || !pairsArg) {
  console.log("用法: node tools/apply-math-pairs.mjs --file data/xxx.js --pairs pairs.json [--dry]");
  process.exit(1);
}
const target = isAbsolute(fileArg) ? fileArg : join(ROOT, fileArg);
const pairsPath = isAbsolute(pairsArg) ? pairsArg : join(process.cwd(), pairsArg);
if (!existsSync(target)) { console.log("找不到目标文件: " + target); process.exit(1); }
if (!existsSync(pairsPath)) { console.log("找不到 replacements 文件: " + pairsPath); process.exit(1); }

const original = readFileSync(target, "utf8");
const pairs = JSON.parse(readFileSync(pairsPath, "utf8"));
if (!Array.isArray(pairs) || !pairs.length) { console.log("pairs.json 必须是非空数组"); process.exit(1); }

/* ------------------------------------------------ 结构指纹（判定有没有改坏） */
function fingerprint(src, label) {
  const arr = [];
  new Function("window", "globalThis", src + ";")({ COURSE_PACKS: arr }, { COURSE_PACKS: arr });
  if (!arr.length) throw new Error(label + "：没有向 COURSE_PACKS 推送内容");
  const fp = { courses: arr.length, lessons: 0, blocks: 0, quiz: 0, labs: 0, chars: 0 };
  const count = (v, key) => {
    if (typeof v === "string") { if (key !== "code") fp.chars += v.replace(/\s/g, "").length; return; }
    if (Array.isArray(v)) { v.forEach((x) => count(x, key)); return; }
    if (v && typeof v === "object") { for (const k of Object.keys(v)) count(v[k], k); }
  };
  for (const c of arr) {
    count(c.meta || {}, "meta");
    for (const l of c.lessons || []) {
      fp.lessons++;
      fp.chars += String(l.goal || "").length + String(l.title || "").length;
      for (const b of l.blocks || []) { fp.blocks++; if (b.type === "interactive") fp.labs++; count(b, b.type); }
      for (const q of l.quiz || []) { fp.quiz++; count(q, "quiz"); }
    }
  }
  return fp;
}

let before;
try {
  before = fingerprint(original, "原文件");
} catch (e) {
  console.log("原文件就无法求值，先修好它再改写：" + e.message);
  process.exit(1);
}

/* ------------------------------------------------------------ 逐条应用 */
let out = original;
let applied = 0;
const problems = [];
const report = [];
for (let i = 0; i < pairs.length; i++) {
  const p = pairs[i];
  // 方便写法：toTex 里按 TeX 原样写单个反斜杠（如 \frac），工具负责转成 JS 源码里的 \\
  if (typeof p.toTex === "string" && typeof p.to !== "string") {
    if (/[\r\n]/.test(p.toTex)) { problems.push(`#${i + 1} toTex 不能含换行，请改用 to`); continue; }
    p.to = p.toTex.replace(/\\/g, "\\\\");
  }
  // 方便写法：fromLines 是行数组（JSON 字符串里放不下真实换行），工具按文件里的换行拼回来
  if (Array.isArray(p.fromLines) && typeof p.from !== "string") p.from = p.fromLines.join("\n");
  if (typeof p.from !== "string" || typeof p.to !== "string") { problems.push(`#${i + 1} 缺 from/to`); continue; }
  // 方便写法：to 里的占位符 @@NL@@ 表示 JS 源码中的转义换行（两个字符 \ 与 n），避开 JSON 转义层
  if (p.to.includes("@@NL@@")) p.to = p.to.split("@@NL@@").join("\\n");
  const hits = out.split(p.from).length - 1;
  if (hits === 0) { problems.push(`#${i + 1} 找不到原文：${JSON.stringify(p.from.slice(0, 60))}`); continue; }
  if (hits > 1 && !p.all) { problems.push(`#${i + 1} 原文出现 ${hits} 次（要么写得更精确，要么加 "all": true）：${JSON.stringify(p.from.slice(0, 60))}`); continue; }
  if (p.expected != null && hits !== p.expected) { problems.push(`#${i + 1} 期望命中 ${p.expected} 次，实际 ${hits} 次`); continue; }
  // 注意：正文里到处是 $...$，而 String.replace 会在**替换串**里把 $&、$$、$1 当特殊记号，
  // 所以必须用函数式替换串（返回值原样插入），否则 $ 会被悄悄吞掉。
  out = p.all ? out.split(p.from).join(p.to) : out.replace(p.from, () => p.to);
  applied++;
  report.push(`  ✓ #${i + 1} ${hits} 处  ${p.note || p.from.slice(0, 40)}`);
}

if (problems.length) {
  console.log("=== 没有写入任何改动，先解决这些问题 ===");
  problems.forEach((x) => console.log("  ✗ " + x));
  console.log(`\n成功解析 ${applied}/${pairs.length} 条。`);
  process.exit(1);
}

/* ------------------------------------------------- 改完立刻验收，不过就还原 */
let after;
try {
  after = fingerprint(out, "改后文件");
} catch (e) {
  console.log("✗ 改后文件无法求值，已放弃写入：" + e.message);
  process.exit(1);
}
const keys = ["courses", "lessons", "blocks", "quiz", "labs"];
const bad = keys.filter((k) => before[k] !== after[k]);
if (bad.length) {
  console.log("✗ 结构被改动，已放弃写入：" + bad.map((k) => `${k} ${before[k]}→${after[k]}`).join("，"));
  process.exit(1);
}

const dPct = ((after.chars - before.chars) / before.chars) * 100;
console.log(`应用 ${applied} 条替换（共 ${pairs.length} 条）：`);
report.forEach((r) => console.log(r));
console.log(`结构不变：${after.courses} 课 / ${after.lessons} 讲 / ${after.blocks} 块 / ${after.quiz} 题 / ${after.labs} 实验`);
console.log(`正文字数 ${before.chars} → ${after.chars} (${dPct >= 0 ? "+" : ""}${dPct.toFixed(2)}%)`);

if (dry) { console.log("\n--dry：只是演练，没有写入。"); process.exit(0); }

copyFileSync(target, target + ".bak");
writeFileSync(target, out);
console.log("\n已写入 " + target + "（备份：" + target + ".bak）");
console.log("接着跑：node tools/audit-math.mjs && node tools/validate-curriculum.mjs");
