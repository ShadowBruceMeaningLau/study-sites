#!/usr/bin/env node
/**
 * Python 代码块修复（迭代式，py_compile 作为唯一判据）
 *
 * 只用两种手段，且每一步都必须通过 python -m py_compile 验收才会写回：
 *   1) 按"复合语句开头"重新构建缩进（纯文本规则，不依赖原缩进）；
 *   2) 若编译报 "expected an indented block after X on line N"，则把 N+1 行及其
 *      后续行整体加深一层，反复迭代（这是确定性的收敛过程）。
 * 已经正确的块一律不动。
 *
 * 用法：node tools/repair-python2.mjs [--dry] [--verbose]
 */
import { readdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, openSync, closeSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");
const DRY = process.argv.includes("--dry");
const VERBOSE = process.argv.includes("--verbose");

const tmp = mkdtempSync(join(tmpdir(), "cs-repair2-"));
const pyFile = join(tmp, "b.py");
const logFile = join(tmp, "log.txt");

function compileCheck(code) {
  writeFileSync(pyFile, code, "utf8");
  const fd = openSync(logFile, "w");
  const r = spawnSync("python", ["-X", "utf8", "-m", "py_compile", pyFile], { stdio: ["ignore", "ignore", fd], timeout: 30000 });
  closeSync(fd);
  const msg = existsSync(logFile) ? readFileSync(logFile, "utf8") : "";
  const m = msg.match(/line (\d+)/);
  return { ok: r.status === 0, msg, errLine: m ? Number(m[1]) : null };
}

const COMPOUND = /^(def |class |for |while |if |try\b|with |match |case )/;
const MIDDLE = /^(else|elif|except|finally)\b/;

function stripComment(line) {
  // 粗略去掉行尾注释（忽略字符串里的 #）
  let out = "";
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) { if (c === "\\") { out += c + (line[++i] || ""); continue; } if (c === quote) quote = null; out += c; continue; }
    if (c === '"' || c === "'") { quote = c; out += c; continue; }
    if (c === "#") break;
    out += c;
  }
  return out;
}

/** 手段 1：按复合语句开头重建缩进 */
function rebuild(code) {
  const lines = code.split("\n");
  const out = [];
  let depth = 0;
  let bracket = 0;
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) { out.push(""); continue; }
    const body = stripComment(t).trimEnd();
    const opens = (body.match(/[\(\[\{]/g) || []).length;
    const closes = (body.match(/[\)\]\}]/g) || []).length;

    if (bracket > 0) {
      out.push("    ".repeat(depth + 1) + t); // 续行
    } else if (MIDDLE.test(body)) {
      depth = Math.max(0, depth - 1);
      out.push("    ".repeat(depth) + t);
      if (body.endsWith(":")) depth += 1;
    } else {
      if (/^(@|def |class )/.test(body) && depth > 0) depth = depth; // 装饰器/定义放在当前层
      out.push("    ".repeat(depth) + t);
      if (COMPOUND.test(body) && body.endsWith(":") && bracket === 0) depth += 1;
      else if (body.endsWith(":") && bracket === 0 && !body.startsWith("#")) depth += 1;
    }
    bracket += opens - closes;
    if (bracket < 0) bracket = 0;
  }
  // 收尾：顶层 def/class 结束后多余缩进归零（下一行若仍是 def/class 则回到 0 层）
  return out.join("\n");
}

/** 手段 2：把 errLine+1 起的"块体"整体加深一层 */
function deepenAfter(code, errLine) {
  const lines = code.split("\n");
  const idx = errLine; // 0-based：errLine 行是 def/if...，下一行是 idx
  if (idx >= lines.length) return null;
  const out = lines.slice();
  // 找到该块体的范围：从 idx 开始，直到缩进 <= 该复合语句缩进 的非空行
  const baseIndent = (lines[errLine - 1].match(/^\s*/) || [""])[0].length;
  let end = lines.length;
  for (let i = idx; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim()) continue;
    const ind = (l.match(/^\s*/) || [""])[0].length;
    if (ind <= baseIndent) { end = i; break; }
  }
  for (let i = idx; i < end; i++) out[i] = lines[i].trim() ? "    " + lines[i] : lines[i];
  return out.join("\n");
}

function repairBlock(code) {
  if (compileCheck(code).ok) return { changed: false, code };
  let cur = rebuild(code);
  for (let i = 0; i < 8; i++) {
    const r = compileCheck(cur);
    if (r.ok) return { changed: true, code: cur };
    const m = /expected an indented block after .* on line (\d+)/.exec(r.msg);
    if (m) {
      const next = deepenAfter(cur, Number(m[1]));
      if (next && next !== cur) { cur = next; continue; }
    }
    // 其他错误：尝试 rebuild 一次作为兜底后放弃
    return { changed: false, code, err: r.msg.split("\n").filter((x) => /Error/.test(x))[0] || "unknown" };
  }
  return { changed: false, code, err: "迭代未收敛" };
}

function readStringLiteral(src, start) {
  const quote = src[start];
  let i = start + 1, raw = "";
  while (i < src.length) {
    const c = src[i];
    if (c === "\\") { raw += src.slice(i, i + 2); i += 2; continue; }
    if (c === quote) return { raw, end: i };
    raw += c; i++;
  }
  return null;
}
const unescape = (s) => s.replace(/\\(.)/g, (m, c) => (c === "n" ? "\n" : c === "t" ? "\t" : c === "r" ? "\r" : c));
const escape = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");

let totalFixed = 0;
const unresolved = [];

for (const file of readdirSync(DATA).filter((x) => x.endsWith(".js")).sort()) {
  const path = join(DATA, file);
  let src = readFileSync(path, "utf8");
  const jobs = [];
  const re = /lang:\s*"python"/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const codeKey = src.indexOf("code:", m.index);
    if (codeKey < 0 || codeKey - m.index > 900) continue;
    const q = src.indexOf('"', codeKey + 5);
    if (q < 0) continue;
    const lit = readStringLiteral(src, q);
    if (!lit) continue;
    jobs.push({ from: q, to: lit.end, raw: lit.raw });
  }
  let fixedHere = 0;
  for (const job of jobs.reverse()) {
    const code = unescape(job.raw);
    if (!code.includes("\n")) continue;
    if (compileCheck(code).ok) continue;
    const r = repairBlock(code);
    if (!r.changed) { unresolved.push(file + " → " + (r.err || "未修复") + "（" + (code.split("\n")[0] || "").slice(0, 40) + "…）"); continue; }
    if (!DRY) src = src.slice(0, job.from) + '"' + escape(r.code) + '"' + src.slice(job.to + 1);
    fixedHere++;
    if (VERBOSE) console.log("    ✓ " + file + "：" + code.split("\n").length + " 行块已修复");
  }
  if (fixedHere || unresolved.length) {
    if (fixedHere && !DRY) writeFileSync(path, src, "utf8");
    if (fixedHere) console.log("  " + file + "：修复 " + fixedHere + " 个块");
  }
  totalFixed += fixedHere;
}

rmSync(tmp, { recursive: true, force: true });
console.log(`\n${DRY ? "[dry-run] " : ""}共修复 ${totalFixed} 个 Python 代码块。`);
if (unresolved.length) {
  console.log("\n仍需处理：");
  unresolved.forEach((u) => console.log("  ! " + u));
  process.exit(1);
}
