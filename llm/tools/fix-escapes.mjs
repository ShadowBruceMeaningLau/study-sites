#!/usr/bin/env node
/**
 * fix-escapes.mjs —— 修复「JS 字符串里 TeX 反斜杠写少了」这一类 bug。
 *
 * 症状：源码里写 "\xi"、"\times"、"\frac" 这种单个反斜杠时，JS 会把它当转义序列：
 *   \x → 十六进制转义（\xi 直接语法错）、\t → 制表符、\f → 换页符、\n → 换行……
 *   结果公式渲染成 "times"、"rac{...}" 或者整个文件无法求值。
 * 正确写法是双反斜杠 "\\xi"。
 *
 * 本工具只做一件事：在**字符串字面量内部**，把「不构成合法 JS 转义」的反斜杠加倍。
 * 合法转义（保留不动）：\n \t \r \b \f \v \0 \\ \' \" \` \xHH \uHHHH \u{...} \ 换行
 * 其余一律加倍 —— 因为那些几乎必然是本想写给 KaTeX 的 TeX 命令。
 *
 * 用法：
 *   node tools/fix-escapes.mjs data/xxx.js          # 修复并报告
 *   node tools/fix-escapes.mjs data/*.js --dry      # 只报告不写
 */
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const files = args.filter((a) => !a.startsWith("--"));

const VALID_ONE = new Set(["n", "t", "r", "b", "f", "v", "0", "\\", "'", '"', "`", "\n", "\r", "\u2028", "\u2029"]);

function fixOne(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  let state = "code"; // code | sq | dq | tpl | line | block
  let fixed = 0;
  const samples = [];
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    if (state === "code") {
      if (c === "/" && c2 === "/") { state = "line"; out += c + c2; i += 2; continue; }
      if (c === "/" && c2 === "*") { state = "block"; out += c + c2; i += 2; continue; }
      if (c === "'") { state = "sq"; out += c; i++; continue; }
      if (c === '"') { state = "dq"; out += c; i++; continue; }
      if (c === "`") { state = "tpl"; out += c; i++; continue; }
      out += c; i++; continue;
    }
    if (state === "line") { out += c; i++; if (c === "\n") state = "code"; continue; }
    if (state === "block") { out += c; i++; if (c === "*" && c2 === "/") { out += "/"; i++; state = "code"; } continue; }
    // 字符串内部
    const quote = state === "sq" ? "'" : state === "dq" ? '"' : "`";
    if (c === "\\") {
      const nx = src[i + 1] || "";
      let ok = false;
      if (VALID_ONE.has(nx)) ok = true;
      else if (nx === "x" && /^[0-9a-fA-F]{2}/.test(src.slice(i + 2, i + 4))) ok = true;
      else if (nx === "u" && (/^[0-9a-fA-F]{4}/.test(src.slice(i + 2, i + 6)) || src[i + 2] === "{")) ok = true;
      if (ok) { out += c + nx; i += 2; continue; }
      out += "\\\\"; i++; fixed++;
      if (samples.length < 8) samples.push(JSON.stringify(src.slice(i - 1, i + 14)));
      continue;
    }
    if (c === quote) { state = "code"; out += c; i++; continue; }
    out += c; i++;
  }
  return { out, fixed, samples, state };
}

let total = 0;
for (const f of files) {
  const src = readFileSync(f, "utf8");
  const { out, fixed, samples, state } = fixOne(src);
  console.log(`${f}：修正 ${fixed} 处` + (state !== "code" ? `  ⚠ 扫描结束时仍处在 ${state} 状态（字符串/注释未闭合），请人工检查` : ""));
  if (fixed) {
    samples.forEach((s) => console.log("    " + s));
    if (!dry) writeFileSync(f, out);
    total += fixed;
  }
}
console.log(`\n合计修正 ${total} 处` + (dry ? "（--dry：未写入）" : ""));
