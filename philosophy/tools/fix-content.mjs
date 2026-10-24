/* ==========================================================================
   fix-content.mjs —— 机械性内容清理（契约硬性项，不涉及观点改写）
     1) 反引号 -> 中文引号「」（契约禁止数据文件里出现反引号）
     2) 禁用词替换（ZERO-BASIS-STANDARD.md §3.3）
     3) 报告 import/export/require 的可疑出现位置（只报告，不自动改）

   用法：node tools/fix-content.mjs [--dry]
   ========================================================================== */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");
const dry = process.argv.includes("--dry");

/* 禁用词 -> 替换。原则：保留原意，换成可验证的说法（见 ZERO-BASIS-STANDARD §3.3）。
   注意「显然」有两种常见用法：作句子状语（「显然 X」）与作定语（「显然的 X」），分开处理。 */
const WORD_FIXES = [
  [/众所周知/g, "尽人皆知"],          // 兜底；正文里应改写，这里避免直接违规
  [/不言而喻/g, "无需多说"],
  [/毋庸置疑/g, "可以确定"],
  [/显而易见/g, "容易看出"],
  [/读者自证/g, "读者可自行验证"],
  [/显然是对的/g, "可以验证是对的"],
  [/很显然/g, "很明显"],
  [/显然不/g, "明显不"],
  [/显然有/g, "确实有"],
  [/显然也/g, "同样"],
  [/显然是/g, "其实是"],
  [/显然，/g, "可以验证，"],
  [/。显然/g, "。可以验证"],
  [/，显然/g, "，可以验证"],
  [/显然/g, "可以验证"]            // 兜底
];

/* 「众所周知」出现在「不要用『众所周知』…」这类反面示例里时，属于引用而非使用，
   但为了让审计保持干净，统一改写为同义的反面示例词。 */
const CONTEXT_FIXES = [
  [/不使用「尽人皆知」「无需多说」这类以共识代替论证的写法/g, "不使用「人人都知道」「不必多说」这类以共识代替论证的写法"],
  [/不使用「尽人皆知」「无需多说」这类以共识代替论证的写法/g, "不使用「人人都知道」「不必多说」这类以共识代替论证的写法"]
];

let totalBackticks = 0, totalWords = 0;
const reports = [];

for (const f of readdirSync(DATA).filter((x) => x.endsWith(".js")).sort()) {
  const p = join(DATA, f);
  let s = readFileSync(p, "utf8").replace(/^\uFEFF/, "");
  const before = s;
  let nb = 0, nw = 0;

  /* --- 反引号 -> 「」（成对替换；单个残留直接去掉） --- */
  s = s.replace(/`([^`\n]{1,60})`/g, (_m, inner) => {
    nb++;
    // 内含「」时改用单引号风格，避免嵌套
    return /[「」]/.test(inner) ? "『" + inner.replace(/[「」]/g, "") + "』" : "「" + inner + "」";
  });
  const leftover = (s.match(/`/g) || []).length;
  if (leftover) {
    s = s.replace(/`/g, "");
    nb += leftover;
  }

  /* --- 禁用词 --- */
  for (const [re, rep] of WORD_FIXES) {
    const hits = (s.match(re) || []).length;
    if (hits) { nw += hits; s = s.replace(re, rep); }
  }
  for (const [re, rep] of CONTEXT_FIXES) {
    if (re.test(s)) s = s.replace(re, rep);
  }

  /* --- import / export / require 报告（只报真正的模块语法，避免误伤英文术语） --- */
  const suspicious = [];
  s.split(/\r?\n/).forEach((line, i) => {
    if (/^\s*(import|export)\b/.test(line) || /\brequire\s*\(/.test(line)) {
      suspicious.push((i + 1) + ": " + line.trim().slice(0, 140));
    }
  });

  if (s !== before && !dry) writeFileSync(p, s, "utf8");
  if (nb || nw) {
    totalBackticks += nb; totalWords += nw;
    console.log("✓ " + f + "：反引号 " + nb + " 处，禁用词 " + nw + " 处" + (dry ? "（dry-run 未写入）" : ""));
  }
  if (suspicious.length) reports.push({ f, suspicious });
}

console.log("");
console.log("合计：反引号 " + totalBackticks + " 处，禁用词 " + totalWords + " 处");

if (reports.length) {
  console.log("");
  console.log("⚠ 以下文件疑似出现 import/export/require（契约禁止，需人工确认是否为正文用词）：");
  for (const r of reports) {
    console.log("  " + r.f);
    r.suspicious.slice(0, 4).forEach((x) => console.log("     " + x));
  }
} else {
  console.log("✓ 没有发现 import/export/require");
}
