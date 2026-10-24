#!/usr/bin/env node
/**
 * 彻底清除 math/data 正文里的 $ 公式标记，回到"纯文本公式"状态。
 * 原因：早期自动包裹规则不完善，留下了错配标记；数学内容本身是正确的，
 *       公式标记只是可选的排版增强，去掉后内容更干净，也不会与渲染器冲突。
 * 只处理正文类字符串（跳过 code/id/lang/title 等）。
 * 用法：node math/tools/strip-math-marks.mjs [--dry]
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MATH = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(MATH, "data");
const DRY = process.argv.includes("--dry");
const SKIP_KEYS = new Set(["code", "id", "lang", "icon", "term", "title", "blurb"]);

const unescape = (s) => s.replace(/\\(.)/g, (m, c) => (c === "n" ? "\n" : c === "t" ? "\t" : c === "r" ? "\r" : c));
const escape = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");

function literals(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1, raw = "";
      while (j < src.length) {
        if (src[j] === "\\") { raw += src.slice(j, j + 2); j += 2; continue; }
        if (src[j] === quote) break;
        raw += src[j]; j++;
      }
      let k = i - 1;
      while (k >= 0 && /\s/.test(src[k])) k--;
      let key = null;
      if (src[k] === ":") {
        let e = k - 1;
        while (e >= 0 && /\s/.test(src[e])) e--;
        let b = e;
        while (b >= 0 && /[\w$]/.test(src[b])) b--;
        key = src.slice(b + 1, e + 1);
      }
      out.push({ start: i, end: j, quote, raw, key });
      i = j + 1;
      continue;
    }
    i++;
  }
  return out;
}

let total = 0;
const report = [];
for (const file of readdirSync(DATA).filter((x) => x.endsWith(".js")).sort()) {
  const path = join(DATA, file);
  let src = readFileSync(path, "utf8");
  const jobs = literals(src).filter((l) => l.quote === '"' && l.key && !SKIP_KEYS.has(l.key));
  let n = 0;
  for (const job of jobs.reverse()) {
    const text = unescape(job.raw);
    if (!text.includes("$")) continue;
    const stripped = text.replace(/\$/g, "");
    src = src.slice(0, job.start) + '"' + escape(stripped) + '"' + src.slice(job.end + 1);
    n++;
  }
  if (!n) continue;
  try { new Function("window", "globalThis", src + ";"); }
  catch (e) { report.push("  ✗ " + file + "：" + e.message); continue; }
  if (!DRY) writeFileSync(path, src, "utf8");
  total += n;
  report.push("  · " + file + "：清理 " + n + " 个串");
}
console.log(report.join("\n"));
console.log(`\n${DRY ? "[dry-run] " : ""}共清理 ${total} 个字符串中的公式标记。`);
