/* ==========================================================================
   verify-truthtables.mjs —— 独立重算 tablelab 的真值表
   做法：用递归下降解析器把 cols 里的公式解析成布尔表达式，
         代入该行 vars 的取值，与作者在 cells 里填的 T/F 逐格比对。
   这是一次真正的独立核验（不依赖课程数据的自洽性）。

   用法：node tools/verify-truthtables.mjs
   ========================================================================== */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");

/* ---------------------------------------------------- 公式解析器 */
function normalize(expr) {
  return String(expr)
    .replace(/&and;/gi, "∧").replace(/&or;/gi, "∨")
    .replace(/[（]/g, "(").replace(/[）]/g, ")")
    .replace(/[¬~！]/g, "¬")
    .replace(/[∧&·×]/g, "∧")
    .replace(/[∨|]/g, "∨")
    .replace(/[→⊃]|->|=>/g, "→")
    .replace(/[↔≡]|<->|<=>/g, "↔")
    .replace(/\s+/g, "")
    .trim();
}

/** 剥掉整体包裹的括号：(A∧B) -> A∧B */
function stripOuter(s) {
  if (!s.startsWith("(") || !s.endsWith(")")) return s;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") {
      depth--;
      if (depth === 0) return i === s.length - 1 ? stripOuter(s.slice(1, -1)) : s;
    }
  }
  return s;
}

/** 在括号深度 0 处按 op（单个字符）分割 */
function splitTop(s, op) {
  const parts = [];
  let depth = 0, last = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === op && depth === 0) { parts.push(s.slice(last, i)); last = i + 1; }
  }
  parts.push(s.slice(last));
  return parts;
}

/**
 * 解析为布尔值。env: { P: true, Q: false }
 * 语法：↔ 最低，其次 →（右结合），再 ∧，再 ∨，最紧是 ¬ 与原子。
 * 返回 true/false，无法解析时抛错。
 */
function parse(s, env) {
  s = stripOuter(normalize(s));
  if (!s) throw new Error("空表达式");

  // ↔ 与 → 同级处理：先找 ↔，再找最左的 →（右结合：A→B→C 视作 A→(B→C)）
  const bi = splitTop(s, "↔");
  if (bi.length > 1) return bi.map((p) => parse(p, env)).every(Boolean) || bi.map((p) => parse(p, env)).every((v) => !v);

  const imps = splitTop(s, "→");
  if (imps.length > 1) {
    // 右结合
    let acc = parse(imps[imps.length - 1], env);
    for (let i = imps.length - 2; i >= 0; i--) acc = !parse(imps[i], env) || acc;
    return acc;
  }

  const ands = splitTop(s, "∧");
  if (ands.length > 1) return ands.every((p) => parse(p, env));

  const ors = splitTop(s, "∨");
  if (ors.length > 1) return ors.some((p) => parse(p, env));

  if (s.startsWith("¬")) return !parse(s.slice(1), env);

  if (s === "T" || s === "1" || s === "真" || s.toLowerCase() === "true") return true;
  if (s === "F" || s === "0" || s === "假" || s.toLowerCase() === "false") return false;
  if (Object.prototype.hasOwnProperty.call(env, s)) return env[s];

  // 单字母变元兜底：取 vars 里同名的
  const hit = Object.keys(env).find((k) => k.toLowerCase() === s.toLowerCase());
  if (hit) return env[hit];

  throw new Error("无法识别的记号：" + s);
}

/* ---------------------------------------------------- 主流程 */
let checked = 0, mismatch = 0, skipped = 0, unparsed = 0;
const problems = [];

for (const f of readdirSync(DATA).filter((x) => x.endsWith(".js")).sort()) {
  const win = {};
  win.window = win; win.COURSE_PACKS = [];
  try { new Function("window", "self", "globalThis", readFileSync(join(DATA, f), "utf8"))(win, win, win); }
  catch { continue; }

  for (const c of win.COURSE_PACKS) {
    for (const l of c.lessons || []) {
      for (const b of (l.blocks || []).filter((x) => x.type === "interactive" && x.lab === "tablelab")) {
        const cfg = b.config || {};
        const vars = cfg.vars || [];
        const cols = cfg.cols || [];
        // 只核验"看起来是公式"的列：含有变元名或联结词
        const formulaCols = cols.filter((col) => /[¬∧∨→↔]/.test(col) || vars.some((v) => normalize(col) === normalize(v)));
        for (const col of formulaCols) {
          for (const row of cfg.rows || []) {
            const expect = String((row.cells || {})[col] ?? "").trim().toUpperCase();
            if (expect !== "T" && expect !== "F") { skipped++; continue; }
            const env = {};
            vars.forEach((v, vi) => {
              const raw = String((row.vals || [])[vi] ?? "").trim().toUpperCase();
              env[v] = raw === "T" || raw === "1" || raw === "真";
            });
            try {
              const got = parse(col, env) ? "T" : "F";
              checked++;
              if (got !== expect) {
                mismatch++;
                problems.push("✗ " + f + " · " + l.title + " · " + vars.map((v) => v + "=" + ((row.vals || [])[vars.indexOf(v)] ?? "?")).join(",") +
                  " · 列「" + col + "」作者填 " + expect + "，重算得 " + got);
              }
            } catch (e) {
              unparsed++;
              problems.push("? " + f + " · " + l.title + " · 列「" + col + "」无法解析（" + e.message + "）");
            }
          }
        }
      }
    }
  }
}

console.log("");
console.log("════════ 真值表独立核验（tablelab）════════");
console.log("逐格比对 " + checked + " 格 ｜ 不一致 " + mismatch + " ｜ 无法解析 " + unparsed + " ｜ 跳过（非 T/F 单元格）" + skipped);
if (problems.length) {
  console.log("");
  const uniq = [...new Set(problems)];
  uniq.slice(0, 30).forEach((p) => console.log("  " + p));
  if (uniq.length > 30) console.log("  …（还有 " + (uniq.length - 30) + " 条去重后的问题）");
}
console.log("");
console.log(mismatch === 0 && unparsed === 0 ? "✓ 全部可机械求值的格子与作者答案一致。" : "");
process.exit(mismatch > 0 ? 1 : 0);
