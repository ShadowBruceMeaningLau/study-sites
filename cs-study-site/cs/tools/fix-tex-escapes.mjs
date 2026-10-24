#!/usr/bin/env node
/**
 * fix-tex-escapes.mjs —— 修复「TeX 命令被 JS 吃掉首字母」的损坏。
 *
 * 症状：源码里写单个反斜杠时，`\frac` 的 `\f` 变成换页符、`\right` 的 `\r` 变成回车、
 * `\times`/`\to`/`\theta` 的 `\t` 变成制表符、`\nabla` 的 `\n` 变成换行 ——
 * 文件语法仍然合法，但公式会渲染成「rac{...}」「ight]」「imes」「o」。
 * 这类损坏用语法检查抓不到，只能按「TeX 命令名」反查。
 *
 * 做法：把源码里「单个反斜杠 + 已知 TeX 命令名」改成「两个反斜杠 + 命令名」。
 * 已经是双反斜杠的不会被误伤（负向后顾断言），`"\n"` 这类真正的转义也不会（后面必须紧跟命令名）。
 *
 * 用法：
 *   node tools/fix-tex-escapes.mjs data/xxx.js [--dry]
 */
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const files = args.filter((a) => !a.startsWith("--"));

// 只认「高置信度」的残渣：这些词尾在代码里几乎不可能当标识符，但在 TeX 里非常常见。
// 例如 \frac 被吃掉后剩下 换页符 + "rac"，于是源码文本里就是 "\frac"（单反斜杠）。
// 故意不收 "eq"/"i"/"u"/"o" 这种短残渣，避免把 Python 里的 "\ni = 1"（换行 + 变量 i）误改。
const TAILS = [
  "rac", "ight", "eft", "imes", "heta", "abla", "arphi", "arepsilon", "bmod", "orall", "riangle",
  "oint", "iint", "iiint", "oiint", "loor", "ceil", "angle", "infty", "partial", "emptyset",
  "varnothing", "subseteq", "supseteq", "subset", "supset", "propto", "approx", "equiv", "otimes", "oplus",
];
const ESCAPE_LETTERS = "bfnrtvxu";

const CMDS = [];
for (const L of ESCAPE_LETTERS) for (const t of TAILS) CMDS.push(L + t);
// \tan \top \to 这类「t + 短词尾」：只在公式内匹配（下面的 inMath 过滤会保证），
// 因为制表符后面跟 "an"/"op"/"o" 几乎只可能来自被吃掉的 \tan \top \to
for (const t of ["an", "op", "o"]) CMDS.push("t" + t);

// 第二类：首字母**不是** JS 转义字母的命令（l/a/c/d/e/g/i/m/o/p/s/w/z 与大写）。
// 这类命令写成单个反斜杠时，JS 会**直接把反斜杠丢掉**（"\left" 就是 "left"），
// 所以源码里出现「单反斜杠 + 这些命令名」必然是 bug，可以放心加倍。
const SAFE_CMDS = [
  "alpha", "approx", "angle", "ast", "aligned", "array",
  "cdot", "cdots", "cup", "cap", "cos", "cot", "csc", "cong", "cases", "chi", "cfrac",
  "delta", "dfrac", "div", "dots", "ddots", "det", "dim", "deg",
  "epsilon", "equiv", "exists", "exp", "eta", "end",
  "gamma", "ge", "geq", "gcd",
  "hat", "hbar",
  "in", "infty", "int", "iint", "iiint", "iff", "iota", "implies",
  "kappa", "ker",
  "left", "le", "leq", "lambda", "ldots", "lim", "limsup", "liminf", "ln", "log",
  "lfloor", "lceil", "langle", "lbrace",
  "max", "min", "mu", "mathbb", "mathcal", "mathrm", "mathbf", "mathit",
  "oplus", "otimes", "oint", "omega", "omicron", "operatorname", "overline", "overset",
  "pi", "pm", "pmatrix", "partial", "phi", "psi", "prod", "propto", "parallel", "perp", "pmod", "varphi",
  "quad", "qquad",
  "sum", "sigma", "sqrt", "subset", "subseteq", "supset", "supseteq", "sin", "sec", "simeq", "sim",
  "stackrel", "space", "square",
  "wedge", "widehat",
  "zeta",
  "Gamma", "Delta", "Theta", "Lambda", "Xi", "Pi", "Sigma", "Phi", "Psi", "Omega",
];

let grand = 0;
for (const f of files) {
  const src = readFileSync(f, "utf8");
  // 只修「位于 $...$ 或 $$...$$ 之内」的命令 —— 否则会把代码里的 "\ni = 1"（换行 + Python 变量 i）误改成 "\\ni"
  const inMath = new Array(src.length).fill(false);
  {
    for (let i = 0; i < src.length; i++) {
      if (src[i] === "\\") { i++; continue; }
      if (src[i] !== "$") continue;
      // $$ ... $$ 大公式：整块内容都算「在公式里」
      if (src[i + 1] === "$") {
        let j = i + 2;
        while (j < src.length - 1) {
          if (src[j] === "\\") { j += 2; continue; }
          if (src[j] === "$" && src[j + 1] === "$") break;
          j++;
        }
        if (j < src.length - 1) {
          for (let k = i; k <= j + 1; k++) inMath[k] = true;
          i = j + 1;
        }
        continue;
      }
      // 行内 $ ... $
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === "\\") { j += 2; continue; }
        if (src[j] === "\n" || src[j] === "$") break;
        j++;
      }
      if (j < src.length && src[j] === "$") {
        for (let k = i; k <= j; k++) inMath[k] = true;
        i = j;
      }
    }
  }
  let out = src;
  let n = 0;
  const found = [];
  for (const c of CMDS.concat(SAFE_CMDS)) {
    const re = new RegExp("(?<!\\\\)\\\\" + c + "(?![A-Za-z])", "g");
    out = out.replace(re, (m, off) => {
      if (!inMath[off]) return m;          // 不在公式里，别动
      n++;
      if (found.length < 40) found.push(c);
      return "\\\\" + c;
    });
  }
  if (n) {
    const tally = {};
    found.forEach((c) => { tally[c] = (tally[c] || 0) + 1; });
    console.log(`${f}：修正 ${n} 处（${Object.entries(tally).map(([k, v]) => k + "×" + v).join(" ")}）`);
    if (!dry) writeFileSync(f, out);
    grand += n;
  }
}
console.log(`\n合计 ${grand} 处` + (dry ? "（--dry：未写入）" : ""));
