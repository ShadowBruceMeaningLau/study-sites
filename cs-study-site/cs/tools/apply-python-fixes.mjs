#!/usr/bin/env node
/**
 * 把 tools/python-fixes/<数据文件>__<lessonId>[--<序号>].py 里的权威代码写回 data/*.js。
 * 文件名规则：
 *   <数据文件>__<lessonId>.py         → 该课**唯一**的 python 代码块
 *   <数据文件>__<lessonId>--<n>.py    → 该课第 n 个 python 代码块（从 0 开始）
 * 写回前先用 py_compile 验收，通过才写，避免把坏代码带进课程数据。
 * 用法：node tools/apply-python-fixes.mjs [--dry]
 */
import { readdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, openSync, closeSync } from "node:fs";
import { join, dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");
const FIXES = join(ROOT, "tools", "python-fixes");
const DRY = process.argv.includes("--dry");

if (!existsSync(FIXES)) { console.log("没有 tools/python-fixes 目录，无需处理。"); process.exit(0); }

const tmp = mkdtempSync(join(tmpdir(), "cs-apply-"));
const logFile = join(tmp, "log.txt");
function pyOk(code) {
  const f = join(tmp, "chk.py");
  writeFileSync(f, code, "utf8");
  const fd = openSync(logFile, "w");
  const r = spawnSync("python", ["-X", "utf8", "-m", "py_compile", f], { stdio: ["ignore", "ignore", fd], timeout: 30000 });
  closeSync(fd);
  return r.status === 0;
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
const escape = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");

let applied = 0, failed = 0;
for (const fixFile of readdirSync(FIXES).filter((x) => x.endsWith(".py")).sort()) {
  const m = /^(.+?\.js)__(.+?)(?:--(\d+))?\.py$/.exec(fixFile);
  if (!m) { console.log("跳过无法解析的文件名：" + fixFile); continue; }
  const [, dataFile, lessonId, idxRaw] = m;
  const dataPath = join(DATA, dataFile);
  if (!existsSync(dataPath)) { console.log("找不到数据文件：" + dataFile); failed++; continue; }

  const fixCode = readFileSync(join(FIXES, fixFile), "utf8").replace(/\r\n/g, "\n").replace(/\n$/, "");
  if (!pyOk(fixCode)) { console.log("✗ " + fixFile + "：修复源自身未通过 py_compile，已跳过"); failed++; continue; }

  let src = readFileSync(dataPath, "utf8");
  // 定位该课的所有 python 块
  const lessonKey = 'id: "' + lessonId + '"';
  const lessonPos = src.indexOf(lessonKey);
  if (lessonPos < 0) { console.log("✗ " + dataFile + "：找不到课程 " + lessonId); failed++; continue; }
  const jobs = [];
  const re = /lang:\s*"python"/g;
  re.lastIndex = lessonPos;
  let mm;
  while ((mm = re.exec(src)) !== null) {
    // 粗略边界：下一个 lesson 的 id 出现即认为离开本课
    const nextLesson = src.indexOf('id: "', mm.index);
    if (nextLesson > 0 && /^(h|k|s|a|c|d|o|p|m)[\w-]*-/.test(src.slice(nextLesson + 5, nextLesson + 9)) && !src.slice(nextLesson + 5, nextLesson + 5 + lessonId.length + 1).startsWith(lessonId + '"')) {
      // 只在明显跨课时停止（保守处理：继续扫描，由序号匹配兜底）
    }
    const codeKey = src.indexOf("code:", mm.index);
    if (codeKey < 0 || codeKey - mm.index > 1200) continue;
    const q = src.indexOf('"', codeKey + 5);
    if (q < 0) continue;
    const lit = readStringLiteral(src, q);
    if (!lit) continue;
    jobs.push({ from: q, to: lit.end });
    if (jobs.length >= 30) break;
  }
  const idx = idxRaw === undefined ? 0 : Number(idxRaw);
  if (!jobs.length) { console.log("✗ " + dataFile + "：" + lessonId + " 下没找到 python 块"); failed++; continue; }
  if (idx >= jobs.length) { console.log("✗ " + dataFile + "：" + lessonId + " 只有 " + jobs.length + " 个 python 块，取不到 #" + idx); failed++; continue; }

  const job = jobs[idx];
  src = src.slice(0, job.from) + '"' + escape(fixCode) + '"' + src.slice(job.to + 1);
  if (!DRY) writeFileSync(dataPath, src, "utf8");
  console.log("✓ " + dataFile + " :: " + lessonId + " #" + idx + " ← " + fixFile + "（" + fixCode.split("\n").length + " 行）");
  applied++;
}

rmSync(tmp, { recursive: true, force: true });
console.log(`\n${DRY ? "[dry-run] " : ""}写回 ${applied} 个块${failed ? "，失败 " + failed + " 个" : ""}。`);
if (failed) process.exit(1);
void basename;
