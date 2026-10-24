#!/usr/bin/env node
/**
 * scan-formulas.mjs —— 找出正文里「还是纯文本」的数学写法，为公式化改写定位。
 *
 * 用法：
 *   node tools/scan-formulas.mjs               # 汇总：每个文件有多少条待改
 *   node tools/scan-formulas.mjs --file xxx.js # 列出某文件逐条明细（含讲名/字段/片段）
 *   node tools/scan-formulas.mjs --json        # 导出 tools/formula-candidates.json
 *
 * 判定标准（保守）：出现数学符号、幂次、下标、常见函数式、O(...) 复杂度等。
 * 已经写在 $...$ 里的不再列出；code 字段（代码块）一律跳过。
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");

const PATTERNS = [
  [/[∑∏∫∮√∞∂∇παβγδεζηθικλμνξπρστυφχψωΓΔΘΛΞΠΣΦΨΩ]/, "希腊字母/大运算符"],
  [/[≤≥≠≈≡∝±×÷·⋅∈∉⊂⊆⊃⊇∪∩∀∃∅→←↔⇒⇔∴∵⊥∥∠°⌈⌉⌊⌋⟨⟩]/, "数学符号"],
  [/[²³¹⁰⁴⁵⁶⁷⁸⁹ⁿ₀₁₂₃₄₅₆₇₈₉]/, "上下标字符"],
  [/\^[0-9a-zA-Z({]/, "幂次 ^"],
  [/_[{0-9a-zA-Z(]/, "下标 _"],
  [/\b[OoΩθ]\([^)]*[nN][^)]*\)/, "复杂度 O(...)"],
  [/\b(log|ln|lg|sin|cos|tan|exp|max|min|lim|sup|inf|det|rank|mod|gcd)\b/, "函数名"],
  [/[A-Za-z0-9)\]}]\s*\/\s*[A-Za-z0-9({[]/, "分式斜杠"],
  [/\b\d+\s*[×*]\s*10\s*\^?\s*-?\d+/, "科学计数"],
  [/[A-Za-z0-9]\s*(≈|≃|∼)\s*[A-Za-z0-9]/, "近似等号"],
];

const args = process.argv.slice(2);
const only = args.includes("--file") ? args[args.indexOf("--file") + 1] : null;
const asJson = args.includes("--json");

const files = readdirSync(DATA).filter((f) => f.endsWith(".js")).sort();
const report = [];

/** 递归收集会走 Markdown 的字符串（跳过 code 字段） */
function collect(node, path, key, out) {
  if (typeof node === "string") {
    if (key !== "code") out.push({ path, text: node });
    return;
  }
  if (Array.isArray(node)) { node.forEach((v, i) => collect(v, path + "[" + i + "]", key, out)); return; }
  if (node && typeof node === "object") {
    for (const k of Object.keys(node)) collect(node[k], path + "." + k, k, out);
  }
}

for (const f of files) {
  if (only && f !== only) continue;
  const code = readFileSync(join(DATA, f), "utf8");
  const arr = [];
  try {
    new Function("window", "globalThis", code + ";")({ COURSE_PACKS: arr }, { COURSE_PACKS: arr });
  } catch (e) {
    console.log(`! ${f} 无法求值：${e.message}`);
    continue;
  }
  const items = [];
  for (const c of arr) {
    for (const l of c.lessons || []) {
      const strings = [];
      collect({ goal: l.goal, need: l.need, blocks: l.blocks, quiz: l.quiz }, "lesson", "", strings);
      for (const s of strings) {
        if (s.text.includes("$")) continue;
        const hits = PATTERNS.filter(([re]) => re.test(s.text)).map(([, n]) => n);
        if (!hits.length) continue;
        items.push({
          course: c.title || c.id,
          lesson: l.title || l.id,
          where: s.path,
          kinds: [...new Set(hits)].join("/"),
          text: s.text.length > 220 ? s.text.slice(0, 220) + "…" : s.text,
        });
      }
    }
  }
  report.push({ file: f, count: items.length, items });
}

if (asJson) {
  const out = join(ROOT, "tools", "formula-candidates.json");
  writeFileSync(out, JSON.stringify(report, null, 1) + "\n");
  console.log("已导出 " + out);
}

if (only) {
  const r = report[0];
  if (!r) { console.log("没有这个文件"); process.exit(); }
  console.log(`=== ${r.file}：${r.count} 条待改 ===`);
  r.items.forEach((it, i) => {
    console.log(`\n[${i + 1}] ${it.course} / ${it.lesson} / ${it.where}  <${it.kinds}>`);
    console.log("    " + it.text.replace(/\n/g, " ⏎ "));
  });
} else {
  console.log("=== 仍用纯文本写公式的字符串条数（越靠前越值得先改）===");
  report.sort((a, b) => b.count - a.count).forEach((r) => console.log(String(r.count).padStart(6) + "  " + r.file));
  const total = report.reduce((a, b) => a + b.count, 0);
  console.log("\n合计 " + total + " 条，分布在 " + report.filter((r) => r.count).length + " 个文件。");
  const hist = {};
  for (const r of report) for (const it of r.items) for (const k of it.kinds.split("/")) hist[k] = (hist[k] || 0) + 1;
  console.log("\n按命中类型：");
  Object.entries(hist).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(String(v).padStart(6) + "  " + k));
}
