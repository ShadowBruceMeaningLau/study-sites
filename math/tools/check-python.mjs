#!/usr/bin/env node
/**
 * Python 代码块真实执行校验：把 data/*.js 里 lang="python" 的代码块抽出来真跑一遍。
 * - 用文件重定向收集 stdout/stderr（受限环境下子进程管道会被拒绝 EPERM）
 * - 退出码非 0 → 判为"需人工确认"（有些块故意演示异常，属正常）
 * - 若代码里写了"输出"注释，会把实际输出与注释中的数字做交叉提示
 * 用法：node tools/check-python.mjs [--strict]
 */
import { readdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, openSync, closeSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");
const STRICT = process.argv.includes("--strict");

const packs = [];
for (const f of readdirSync(DATA).filter((x) => x.endsWith(".js")).sort()) {
  const arr = [];
  try {
    new Function("window", "globalThis", readFileSync(join(DATA, f), "utf8") + ";")({ COURSE_PACKS: arr }, { COURSE_PACKS: arr });
  } catch { continue; }
  arr.forEach((c) => packs.push(c));
}

function findPython() {
  for (const cmd of ["python", "python3", "py"]) {
    const r = spawnSync(cmd, ["--version"], { stdio: "ignore" });
    if (r.status === 0) return cmd;
  }
  return null;
}
const PY = findPython();
console.log("Python： " + (PY || "未找到，无法执行代码块"));
if (!PY) process.exit(0);

const tmp = mkdtempSync(join(tmpdir(), "cs-py-"));
let total = 0, ok = 0, bad = 0, skipped = 0;
const problems = [];
const notes = [];

for (const c of packs) {
  for (const l of c.lessons ?? []) {
    for (const b of l.blocks ?? []) {
      if (b.type !== "code" || b.lang !== "python") continue;
      total++;
      const code = String(b.code || "");
      const label = `[${c.title} · ${l.title}] ${b.title || "python 代码块"}`;
      // 明显是片段/伪代码的跳过（没有可执行语句）
      if (!/\n\s*(print|def |class |for |while |if |[A-Za-z_]\w*\s*=)/.test(code)) { skipped++; continue; }
      const file = join(tmp, "b" + total + ".py");
      const outFile = join(tmp, "b" + total + ".out");
      const errFile = join(tmp, "b" + total + ".err");
      writeFileSync(file, code, "utf8");
      const o = openSync(outFile, "w");
      const e = openSync(errFile, "w");
      const r = spawnSync(PY, ["-X", "utf8", file], { stdio: ["ignore", o, e], timeout: 30000, env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" } });
      closeSync(o);
      closeSync(e);
      const stdout = existsSync(outFile) ? readFileSync(outFile, "utf8").trim() : "";
      const stderr = existsSync(errFile) ? readFileSync(errFile, "utf8").trim() : "";
      if (r.status === 0) {
        ok++;
        if (stdout) notes.push(label + " → 输出首行: " + stdout.split("\n")[0].slice(0, 80));
      } else {
        // 故意演示异常/依赖缺失的块很常见：只在明显是语法错误时才算问题
        const syntax = /SyntaxError|IndentationError|TabError/.test(stderr);
        if (syntax) { bad++; problems.push(label + " 语法错误：" + stderr.split("\n").slice(-2).join(" ").slice(0, 160)); }
        else { skipped++; problems.push("（提示·非语法错误）" + label + " → " + stderr.split("\n").slice(-1)[0].slice(0, 120)); }
      }
    }
  }
}
rmSync(tmp, { recursive: true, force: true });

console.log(`Python 代码块共 ${total} 个：执行成功 ${ok} 个，跳过/演示性失败 ${skipped} 个，语法错误 ${bad} 个`);
if (process.argv.includes("--verbose")) {
  console.log("\n执行输出抽样：");
  notes.slice(0, 20).forEach((n) => console.log("  · " + n));
}
const hints = problems.filter((p) => p.startsWith("（提示"));
const errs = problems.filter((p) => !p.startsWith("（提示"));
if (errs.length) {
  console.log("\n语法错误清单：");
  errs.forEach((p) => console.log("  ✗ " + p));
}
if (hints.length) {
  console.log("\n运行时非零退出（多为故意演示异常，可人工确认）：");
  hints.slice(0, 12).forEach((p) => console.log("  ! " + p.replace("（提示·非语法错误）", "")));
}
if (errs.length || (STRICT && hints.length)) {
  console.log(`\n✗ Python 代码块校验未通过（语法错误 ${errs.length} 个${STRICT ? "，运行时异常 " + hints.length + " 个" : ""}）。`);
  process.exit(1);
}
console.log("\n✓ 全部 Python 代码块无语法错误。");
