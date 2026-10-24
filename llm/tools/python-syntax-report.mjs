#!/usr/bin/env node
/**
 * Python 代码块语法体检（只读，不修改任何文件）
 * 用 python -m py_compile 逐个编译，列出语法错误块，供人工/定点修复。
 * 用法：node tools/python-syntax-report.mjs
 */
import { readdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, openSync, closeSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");

const packs = [];
for (const f of readdirSync(DATA).filter((x) => x.endsWith(".js")).sort()) {
  const arr = [];
  try {
    new Function("window", "globalThis", readFileSync(join(DATA, f), "utf8") + ";")({ COURSE_PACKS: arr }, { COURSE_PACKS: arr });
  } catch (e) {
    console.log("!! " + f + " 无法求值：" + e.message);
    continue;
  }
  arr.forEach((c) => packs.push({ file: f, c }));
}

const tmp = mkdtempSync(join(tmpdir(), "cs-pyreport-"));
const log = join(tmp, "log.txt");
let total = 0;
const bad = [];
const good = [];

for (const { file, c } of packs) {
  for (const l of c.lessons ?? []) {
    for (const b of l.blocks ?? []) {
      if (b.type !== "code" || b.lang !== "python") continue;
      total++;
      const code = String(b.code || "");
      if (!code.includes("\n")) continue;
      const f = join(tmp, "b.py");
      writeFileSync(f, code, "utf8");
      const fd = openSync(log, "w");
      const r = spawnSync("python", ["-X", "utf8", "-m", "py_compile", f], { stdio: ["ignore", "ignore", fd], timeout: 30000 });
      closeSync(fd);
      const msg = existsSync(log) ? readFileSync(log, "utf8") : "";
      if (r.status === 0) good.push({ file, id: l.id, title: b.title });
      else {
        const line = (msg.match(/line (\d+)/) || [])[1] || "?";
        const kind = (msg.match(/(IndentationError|SyntaxError|TabError)/) || [])[1] || "?";
        bad.push({ file, id: l.id, title: b.title, line, kind, detail: msg.split("\n").filter((x) => /Error/.test(x))[0] || "" });
      }
    }
  }
}
rmSync(tmp, { recursive: true, force: true });

console.log(`Python 代码块共 ${total} 个：语法正确 ${good.length} 个，语法错误 ${bad.length} 个`);
if (bad.length) {
  console.log("\n损坏清单（按文件）：");
  const byFile = {};
  bad.forEach((b) => { (byFile[b.file] = byFile[b.file] || []).push(b); });
  for (const f of Object.keys(byFile)) {
    console.log("\n  " + f + "（" + byFile[f].length + " 个）");
    byFile[f].forEach((b) => console.log("    ✗ " + b.id + " | " + (b.title || "").slice(0, 34) + " | " + b.kind + " line " + b.line));
  }
}
process.exit(bad.length ? 1 : 0);
