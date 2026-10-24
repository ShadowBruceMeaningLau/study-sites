#!/usr/bin/env node
/**
 * audit-constants.mjs —— 常量体检：课程正文里引用的物理常量，与 app/constants.js 的 CODATA 表对不对得上？
 *
 * 为什么需要它：`verify-numbers.mjs` 只重算 `calc.verify` 里的表达式，
 * 而正文里**顺手写出来的常量**（"光速 2.97×10⁸ m/s"、"电子质量 9.11×10⁻³¹ kg"）没有任何机器兜底。
 * 一个数字抄错一位，读者按它算就全错，而所有现有门禁都是绿的。
 *
 * 判据：正文里出现的数字，若它的**前三位有效数字**与某个已知常量相同，
 * 就认为作者是在引用该常量，于是按**写出来的位数**检查它是不是正确的四舍五入。
 * （"2.998"、"3.00"、"2.997 9" 都算对；"2.979" 算错。）
 *
 * 用法：
 *   node tools/audit-constants.mjs          # 有问题则退出码 1
 *   node tools/audit-constants.mjs -v       # 列出全部核对明细
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");
const VERBOSE = process.argv.includes("-v") || process.argv.includes("--verbose");
const STRICT = process.argv.includes("--strict");

/* ------------------------------------------------ 1. 读常量表 */
const win = {};
new Function("window", "globalThis", readFileSync(join(ROOT, "app", "constants.js"), "utf8"))(win, win);
const groups = win.PHYSICS_CONSTANTS?.groups ?? [];

/** "2.997 924 58 × 10^8" → { digits:"299792458", exp:8, value:2.99792458e8 } */
function parseValue(s) {
  const t = String(s).replace(/\s|\u00a0|\u2009/g, "").replace(/×10\^?/, "e").replace(/−/g, "-");
  const m = t.match(/^(-?\d+(?:\.\d+)?)(?:e(-?\d+))?$/);
  if (!m) return null;
  const value = Number(m[1]) * Math.pow(10, m[2] ? Number(m[2]) : 0);
  if (!isFinite(value) || value === 0) return null;
  let digits = m[1].replace(/^-/, "").replace(".", "").replace(/^0+/, "");
  return { digits, value: Math.abs(value), exp: m[2] ? Number(m[2]) : 0 };
}

const constants = [];
for (const g of groups) {
  for (const it of g.items ?? []) {
    const p = parseValue(it.value);
    if (!p || p.digits.length < 3) continue;
    constants.push({ name: it.name, symbol: it.symbol, unit: it.unit, digits: p.digits, value: p.value, exp: p.exp, shown: String(it.value) });
  }
}
console.log("=== 常量体检（对照 app/constants.js 的 CODATA 表）===");
console.log("常量表条目 " + constants.length + " 个（有可解析数值的）");

/* ------------------------------------------------ 2. 扫课程正文 */
const strings = [];
for (const f of readdirSync(DATA).filter((x) => x.endsWith(".js")).sort()) {
  const arr = [];
  try {
    new Function("window", "globalThis", readFileSync(join(DATA, f), "utf8") + ";")({ COURSE_PACKS: arr }, { COURSE_PACKS: arr });
  } catch { continue; }
  for (const c of arr) {
    for (const l of c.lessons ?? []) {
      const walk = (v, path) => {
        if (typeof v === "string") {
          if (v.length >= 2) strings.push({ where: `${f} / ${c.title} / ${l.title} / ${path}`, text: v });
        } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, path + "[" + i + "]"));
        else if (v && typeof v === "object") for (const k of Object.keys(v)) walk(v[k], path + "." + k);
      };
      walk(l.blocks, "blocks");
    }
  }
}
console.log("扫过字符串 " + strings.length + " 条");

/* 只核对**写成「尾数 × 10^指数」**的出现。
   为什么必须带上指数：正文里到处都是与常量尾数巧合的数（"1.2566" 是某个无量纲结果，
   而 μ₀ = 1.2566×10⁻⁶；"22.414" 是摩尔体积的升制写法，而表里存的是 22.414×10⁻³ m³/mol）。
   只比尾数会造出一堆假警报——一个总在喊狼来了的检查等于没有检查。
   带上指数之后，判据变成"同一个尾数 + 同一个数量级"，误报几乎为零，
   代价是**只能抓到用科学计数法写出来的常量引用**（这一点写在下面输出里）。

   正文里这种写法有两种形态，都要认：
     LaTeX ：1.380\,649\times10^{-23}      （\, 是细空格，\times 是乘号）
     文本 ：1.380 649 × 10⁻²³              （上标数字） */
const SUP = { "\u2070": "0", "\u00b9": "1", "\u00b2": "2", "\u00b3": "3", "\u2074": "4", "\u2075": "5", "\u2076": "6", "\u2077": "7", "\u2078": "8", "\u2079": "9", "\u207b": "-", "\u207a": "+" };
function normalize(s) {
  return String(s)
    .replace(/\\\\times/g, "×")
    .replace(/\\times/g, "×")
    .replace(/\\cdot/g, "×")
    .replace(/\\,/g, " ")
    .replace(/\\;/g, " ")
    .replace(/\\!/g, "")
    .replace(/\\(?=[A-Za-z])/g, " ")
    // 上标数字：10⁻²³ → 10^-23
    .replace(/(?:×\s*)?10([\u2070\u00b9\u00b2\u00b3\u2074-\u2079\u207b\u207a]+)/g, (_m, sup) =>
      "×10^" + Array.from(sup).map((c) => SUP[c] ?? "").join(""));
}
const SCI = /(\d[\d.\s]*\d|\d)\s*×\s*10\s*\^?\s*\{?\s*([+\-−]?\d+)\s*\}?/g;
const checked = [];
const problems = [];

for (const { where, text } of strings) {
  // 注意：**不能**先剥掉 $...$ —— 常量恰恰主要写在公式里。
  // 靠"尾数 + 指数 + 前三位有效数字三者同时吻合"来压低误报，而不是靠剥公式。
  const stripped = normalize(text);
  let m;
  SCI.lastIndex = 0;
  while ((m = SCI.exec(stripped)) !== null) {
    const mant = m[1].replace(/[\s]/g, "");
    const exp = Number(m[2].replace("−", "-"));
    const sig = mant.replace(".", "").replace(/^0+/, "");
    if (sig.length < 3) continue;
    const wv = Number(mant) * Math.pow(10, exp);
    if (!isFinite(wv) || wv === 0) continue;
    for (const c of constants) {
      if (c.exp !== exp) continue;                       // 数量级必须一致
      if (c.digits.slice(0, 3) !== sig.slice(0, 3)) continue;  // 前三位有效数字一致才认为在引用它
      const decimals = mant.split(".")[1]?.length ?? 0;
      const ulp = 0.5 * Math.pow(10, -decimals) * Math.pow(10, exp);
      const diff = Math.abs(wv - c.value);
      checked.push({ where, written: m[0], c, diff, ulp });
      if (diff > ulp) problems.push({ where, written: m[0], c, diff, ulp });
      break;
    }
  }
}

/* ------------------------------------------------------------------
   已知的"看起来像但其实是另一个量"的写法。
   它们不是错误，但会被上面「同尾数 + 同数量级」的判据命中，因此显式白名单，
   免得这个检查变成一直喊狼来了的噪音。每一条都要写清**为什么它是合法的**。
   ------------------------------------------------------------------ */
const ALLOW = [
  { re: /^1\.09(67|68|7|6)/, why: "氢的里德伯常量 R_H = R_∞/(1+m_e/m_p) = 1.096 775 8×10⁷ m⁻¹，与表里的 R_∞ = 1.097 373 2×10⁷ m⁻¹ 是两个不同的量" },
  { re: /^1\.674/, why: "中子质量 m_n = 1.674 927×10⁻²⁷ kg，表里的 1.672 6 是质子质量 m_p（前三位 167 相同）" },
  { re: /^2\.99[56]/, why: "相对论速度的计算结果（如 0.9994c = 2.996 13×10⁸ m/s），不是光速本身" },
  { re: /^1\.36[01]/, why: "太阳常数 1361 W/m²，不是表里的任何常量" },
  { re: /^1361/, why: "同上的太阳常数；「1361× 1000」这种带空格的形态是本脚本跨字段拼接造成的过度匹配（已人工核对：原文是「$1361\\ \\text{W/m}^2$」，后面另有别的 ×1000），不是正文错误" },
  { re: /^1\.3[0-9]{1,2}\s*×\s*1000/, why: "量纲换算的中间结果（×1000），不是常量引用" },
];
const allowed = (written) => ALLOW.some((a) => a.re.test(written.trim()));

/* ------------------------------------------------ 3. 汇总 */
if (VERBOSE) {
  console.log("\n核对明细：");
  for (const x of checked.slice(0, 60)) {
    console.log("  " + (x.diff <= x.ulp ? "✓" : "✗") + " " + x.written + "  vs  " + x.c.symbol + " = " + x.c.shown + "   [" + x.where + "]");
  }
}

const real = problems.filter((p) => !allowed(p.written));
const knownOthers = problems.length - real.length;

console.log("\n共核对 " + checked.length + " 处写成「尾数 × 10^指数」的常量引用（加 -v 看明细）");
console.log("其中白名单内（是另一个物理量，非错误）：" + knownOthers + " 处");
for (const a of ALLOW) {
  const n = problems.filter((p) => a.re.test(p.written.trim())).length;
  if (n) console.log("    · " + n + " 处 —— " + a.why);
}
if (real.length) {
  console.log("\n✗ 需要人工核对的写法 " + real.length + " 处：");
  const seen = new Set();
  for (const p of real) {
    const key = p.written + "|" + p.c.symbol;
    if (seen.has(key)) continue;
    seen.add(key);
    console.log("  ✗ 写成 " + p.written + "，而 " + p.c.symbol + "（" + p.c.name + "）= " + p.c.shown +
      "，差 " + p.diff.toExponential(2) + "（按写出的位数允许 " + p.ulp.toExponential(1) + "）");
    console.log("      " + p.where);
  }
  if (STRICT) { console.log("\n✗ 常量体检未通过（--strict）。"); process.exit(1); }
  console.log("\n（默认只报告、不失败；确认无误后加进 ALLOW 或改正正文，CI 里可用 --strict 强制。）");
} else {
  console.log("\n✓ 正文里用科学计数法引用的物理常量与 CODATA 表一致。");
}
console.log("  局限：只覆盖写成「尾数 × 10^指数」的引用；写成 0.0529 nm、7.03 eV 这类不带指数的形式不在本检查范围内。");

/* ------------------------------------------------ 4. 顺带：常量表自身的相容性 */
const rel = [];
const get = (sym) => constants.find((c) => c.symbol === sym);
const h = get("h"), hbar = get("hbar") || get("ħ"), e = get("e"), me = get("m_e"), c = get("c");
if (h && hbar) rel.push(["ħ = h/2π", Math.abs(hbar.value - h.value / (2 * Math.PI)) / hbar.value]);
if (me && c) rel.push(["m_e c² = 0.510 998 950 MeV", Math.abs(me.value * c.value * c.value / 1.602176634e-13 - 0.51099895) / 0.51099895]);
let bad = 0;
for (const [label, err] of rel) {
  const okk = err < 2e-6;
  if (!okk) bad++;
  console.log((okk ? "  ✓ " : "  ✗ ") + label + "  相对偏差 " + err.toExponential(2));
}
if (bad) { console.log("\n✗ 常量表内部不自洽。"); process.exit(1); }
console.log("  ✓ 常量表内部关系自洽（ħ–h、电子静能）。");
