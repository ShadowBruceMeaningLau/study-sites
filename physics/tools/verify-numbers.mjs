#!/usr/bin/env node
/**
 * verify-numbers.mjs —— calc 块数值复核（物理站的"数必须算对"门禁）
 *
 * 校验对象：course.lessons[].blocks[] 里 type:"calc" 且带 verify 的块。
 *   verify = { expr:"v0^2*sind(2*theta)/g", value:"40.8", unit:"m", tol:0.1, map:{v0:20, theta:45, g:9.8} }
 *
 * 表达式用**自写的词法+语法分析器**求值（不用 eval，也不引入任何依赖）。
 *
 * 三角函数默认按**弧度**；物理里角度更常用，所以另给了度数版本：
 *   sin cos tan asin acos atan        —— 弧度
 *   sind cosd tand                    —— 度数
 *   还有 sqrt exp ln log10 abs，常量 pi 与 e
 * 运算符：+ - * / ^ ( )，一元负号，幂用 ^（右结合）
 *
 * 用法：
 *   node tools/verify-numbers.mjs          # 全量复核；有失败则退出码 1
 *   node tools/verify-numbers.mjs --quiet  # 只打印汇总
 *   node tools/verify-numbers.mjs mechanics # 只查文件名含该串的课程
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = join(ROOT, "data");
const argv = process.argv.slice(2);
const QUIET = argv.includes("--quiet");
const filter = argv.filter((a) => !a.startsWith("--"))[0] || null;

/* ====================================================== 表达式求值器 */
const FUNCS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sind: (d) => Math.sin((d * Math.PI) / 180),
  cosd: (d) => Math.cos((d * Math.PI) / 180),
  tand: (d) => Math.tan((d * Math.PI) / 180),
  sqrt: Math.sqrt, exp: Math.exp, ln: Math.log, log10: Math.log10, abs: Math.abs,
  min: Math.min, max: Math.max, pow: Math.pow
};
const CONSTS = { pi: Math.PI, PI: Math.PI, e: Math.E };

function tokenize(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      const m = /^\d*\.?\d+(?:[eE][+-]?\d+)?/.exec(src.slice(i));
      if (!m) throw new Error(`无法解析数字（位置 ${i}）："${src.slice(i, i + 12)}"`);
      const num = Number(m[0]);
      if (!isFinite(num)) throw new Error(`无法解析数字："${m[0]}"`);
      out.push({ t: "num", v: num });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      out.push({ t: "id", v: src.slice(i, j) });
      i = j;
      continue;
    }
    if ("+-*/^(),".includes(c)) { out.push({ t: c }); i++; continue; }
    throw new Error(`表达式里有不认识的字符："${c}"`);
  }
  return out;
}

function parse(tokens, vars) {
  let p = 0;
  const peek = () => tokens[p];
  const eat = (t) => { if (!peek() || peek().t !== t) throw new Error(`期望 "${t}"，实际 "${peek() ? peek().t : "结束"}"`); return tokens[p++]; };

  function expr() {
    let v = term();
    while (peek() && (peek().t === "+" || peek().t === "-")) {
      const op = tokens[p++].t;
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  function term() {
    let v = power();
    while (peek() && (peek().t === "*" || peek().t === "/")) {
      const op = tokens[p++].t;
      const r = power();
      v = op === "*" ? v * r : v / r;
    }
    return v;
  }
  function power() {
    const base = unary();
    if (peek() && peek().t === "^") { p++; return Math.pow(base, power()); }   // 右结合
    return base;
  }
  function unary() {
    if (peek() && peek().t === "-") { p++; return -unary(); }
    if (peek() && peek().t === "+") { p++; return unary(); }
    return atom();
  }
  function atom() {
    const tk = peek();
    if (!tk) throw new Error("表达式意外结束");
    if (tk.t === "num") { p++; return tk.v; }
    if (tk.t === "(") { p++; const v = expr(); eat(")"); return v; }
    if (tk.t === "id") {
      p++;
      const name = tk.v;
      if (peek() && peek().t === "(") {
        p++;
        const args = [];
        if (!(peek() && peek().t === ")")) {
          args.push(expr());
          while (peek() && peek().t === ",") { p++; args.push(expr()); }
        }
        eat(")");
        const fn = FUNCS[name];
        if (!fn) throw new Error(`不支持的函数："${name}"`);
        return fn(...args);
      }
      if (Object.prototype.hasOwnProperty.call(vars, name)) return vars[name];
      if (Object.prototype.hasOwnProperty.call(CONSTS, name)) return CONSTS[name];
      throw new Error(`未定义的符号："${name}"（请在 verify.map 里给出取值）`);
    }
    throw new Error(`表达式语法错误：遇到 "${tk.t}"`);
  }

  const v = expr();
  if (p !== tokens.length) throw new Error("表达式结尾有多余内容");
  return v;
}

/** 从表达式里抽出所有标识符（用来检查 map 是否给全了） */
function identifiers(expr) {
  const ids = new Set();
  for (const m of String(expr).matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) {
    const name = m[0];
    if (FUNCS[name] || CONSTS[name]) continue;
    ids.add(name);
  }
  return [...ids];
}

function evalExpr(expr, vars) {
  return parse(tokenize(String(expr)), vars || {});
}

/* ====================================================== 主流程 */
/** 求值器自检：工具本身也要能被验证（--selftest） */
function selftest() {
  const cases = [
    ["2+3*4", {}, 14],
    ["(2+3)*4", {}, 20],
    ["2^3^2", {}, 512],                      // 幂右结合
    ["-2^2", {}, 4],                         // 一元负号先作用于最近的数：-2^2 = (-2)^2；要 -(2^2) 请写 -(2^2)
    ["sind(30)", {}, 0.5],                   // 度数版本
    ["sin(pi/2)", {}, 1],
    ["cosd(60)", {}, 0.5],
    ["sqrt(16)", {}, 4],
    ["1e-3*1000", {}, 1],
    ["20^2*sind(90)/9.8", {}, 40.816326530612244],
    ["v0^2*sind(2*theta)/g", { v0: 20, theta: 45, g: 9.8 }, 40.816326530612244],
    ["max(3,7)", {}, 7],
    ["abs(-5)+ln(1)", {}, 5]
  ];
  let bad = 0;
  for (const [expr, vars, want] of cases) {
    let got;
    try { got = evalExpr(expr, vars); }
    catch (e) { console.log(`  ✗ ${expr} 抛异常：${e.message}`); bad++; continue; }
    if (Math.abs(got - want) > 1e-9 * Math.max(1, Math.abs(want))) { console.log(`  ✗ ${expr} = ${got}，期望 ${want}`); bad++; }
    else console.log(`  ✓ ${expr} = ${got}`);
  }
  // 未定义符号必须报错（而不是悄悄变成 NaN）
  try { evalExpr("v0*t", {}); console.log("  ✗ 未定义符号没有报错"); bad++; }
  catch { console.log("  ✓ 未定义符号会报错（不会静默变成 NaN）"); }
  console.log(`\n求值器自检：${cases.length + 1} 项，失败 ${bad} 项。`);
  process.exit(bad ? 1 : 0);
}
if (argv.includes("--selftest")) selftest();

function loadPacks() {
  const packs = [];
  let files = [];
  try { files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".js")).sort(); } catch { files = []; }
  for (const f of files) {
    if (filter && !f.includes(filter)) continue;
    const code = readFileSync(join(DATA_DIR, f), "utf8");
    const got = [];
    const sandbox = { COURSE_PACKS: got };
    try {
      new Function("window", "globalThis", `${code}\n;`)(sandbox, sandbox);
    } catch (e) {
      console.error(`✗ ${f} 无法求值：${e.message}`);
      continue;
    }
    for (const c of got) packs.push({ file: f, course: c });
  }
  return packs;
}

const packs = loadPacks();
if (!packs.length) {
  console.error("✗ data/ 下没有可用课程文件（先写课程，或检查文件名过滤）");
  process.exit(1);
}

let checked = 0, failed = 0, noVerify = 0;
const failures = [];
const missing = [];

for (const { file, course } of packs) {
  for (const lesson of course.lessons || []) {
    for (const blk of lesson.blocks || []) {
      if (blk.type !== "calc") continue;
      if (!blk.verify) {
        noVerify++;
        missing.push(`${course.id} · ${lesson.title} · ${blk.title || "手算演练"}`);
        continue;
      }
      checked++;
      const where = `${file} → ${course.id} · ${lesson.id} · ${blk.title || "calc"}`;
      const { expr, value, tol = 1e-6, map = {} } = blk.verify;
      // 1) map 必须覆盖表达式里的所有符号
      const ids = identifiers(expr);
      const absent = ids.filter((s) => !Object.prototype.hasOwnProperty.call(map, s));
      if (absent.length) {
        failed++;
        failures.push(`${where}\n    表达式里用到但 verify.map 未给值：${absent.join(", ")}`);
        continue;
      }
      // 2) 重算
      let got;
      try {
        got = evalExpr(expr, map);
      } catch (e) {
        failed++;
        failures.push(`${where}\n    表达式求值失败：${e.message}`);
        continue;
      }
      const want = Number(String(value).replace(/[^\d.eE+-]/g, ""));
      if (!isFinite(want)) {
        failed++;
        failures.push(`${where}\n    verify.value 不是数字："${value}"`);
        continue;
      }
      const diff = Math.abs(got - want);
      const okRel = want !== 0 ? diff / Math.abs(want) <= Math.max(tol, 1e-12) : diff <= Math.max(tol, 1e-12);
      const okAbs = diff <= tol;
      if (!(okAbs || okRel)) {
        failed++;
        failures.push(`${where}\n    ${expr} = ${got}\n    但正文写的是 ${want}（容差 ±${tol}，实际差 ${diff}）`);
      } else if (!QUIET) {
        console.log(`  ✓ ${where}\n      ${expr} = ${got}  ≈ 正文的 ${want} ${blk.verify.unit || ""}`);
      }
    }
  }
}

console.log("");
if (failures.length) {
  console.log("=== 数值复核失败 ===");
  for (const f of failures) console.log("✗ " + f + "\n");
}
console.log(`数值复核：检查 ${checked} 个 calc.verify，失败 ${failed} 个。`);
if (missing.length) {
  console.log(`另有 ${noVerify} 个 calc 块没有 verify（建议补上，让机器替你验算）：`);
  for (const m of missing.slice(0, 25)) console.log("   · " + m);
  if (missing.length > 25) console.log(`   …… 其余 ${missing.length - 25} 个`);
}
process.exit(failed ? 1 : 0);
