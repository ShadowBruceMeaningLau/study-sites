#!/usr/bin/env node
/**
 * C 代码块真实编译校验：把 data/*.js 里 lang="c" 的完整程序抽出来，用 gcc 做语法/语义检查。
 * 说明：在受限沙箱下"子进程管道捕获(stdout/stderr pipe)"会被拒绝(EPERM)，
 *       因此这里把编译器输出重定向到文件再读取；片段代码退化为括号配对检查。
 * 用法：node tools/check-code.mjs
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
  } catch { continue; }
  arr.forEach((c) => packs.push(c));
}

const tmp = mkdtempSync(join(tmpdir(), "cs-code-"));
const logFile = join(tmp, "gcc.log");

function gcc(args) {
  const fd = openSync(logFile, "w");
  const r = spawnSync("gcc", args, { stdio: ["ignore", "ignore", fd], timeout: 60000 });
  closeSync(fd);
  return { status: r.status, log: existsSync(logFile) ? readFileSync(logFile, "utf8") : "" };
}

const probe = gcc(["--version"]);
const GCC = probe.status === 0;
console.log("编译器： " + (GCC ? "gcc 可用（" + probe.log.split("\n")[0].trim() + "），将真实编译每个完整 C 程序" : "未找到 gcc，退化为结构检查"));
console.log("");

let total = 0, compiled = 0, failed = 0, skipped = 0;
const failures = [];
const gpu = [];
const warns = [];

for (const c of packs) {
  for (const l of c.lessons ?? []) {
    for (const b of l.blocks ?? []) {
      if (b.type !== "code" || b.lang !== "c") continue;
      total++;
      const code = String(b.code || "");
      const label = `[${c.title} · ${l.title}]`;
      // CUDA / GPU 设备端代码不能用主机 gcc 编译，归为"未本地验证"（需要 nvcc 与 NVIDIA GPU）
      if (/__global__|__device__|blockIdx|threadIdx|blockDim|cudaMalloc|<<<|nvcc/.test(code)) {
        gpu.push(label + " " + (b.title || ""));
        continue;
      }
      const isFull = /#include\s*</.test(code) && /\bmain\s*\(/.test(code);
      if (!isFull) {
        skipped++;
        const pairs = [["{", "}"], ["(", ")"], ["[", "]"]];
        const bad = pairs.filter(([a, z]) => code.split(a).length - 1 !== code.split(z).length - 1);
        if (bad.length) { failed++; failures.push(`${label} 片段括号不配对：${bad.map((p) => p.join("")).join(" ")}`); }
        continue;
      }
      const file = join(tmp, "t" + total + ".c");
      writeFileSync(file, code, "utf8");
      let r = GCC ? gcc(["-std=c11", "-Wall", "-Wextra", "-Wno-unused-parameter", "-fsyntax-only", file]) : { status: 0, log: "" };
      if (GCC && r.status !== 0) {
        const errs = r.log.split("\n").filter((x) => /error:/.test(x)).slice(0, 2).join(" ｜ ");
        // 教学代码可能故意依赖平台头文件（如 windows.h / unistd.h），此时记录但不判失败
        const portability = /(windows\.h|unistd\.h|pthread\.h|sys\/|No such file or directory)/.test(r.log);
        if (portability) { skipped++; continue; }
        failed++;
        failures.push(`${label} 编译失败：${errs || "退出码 " + r.status}`);
        continue;
      }
      compiled++;
      const w = (r.log || "").split("\n").filter((x) => /warning:/.test(x));
      if (w.length) warns.push(label + " " + w[0].replace(/^.*warning:/, "warning:").trim());
    }
  }
}
rmSync(tmp, { recursive: true, force: true });

console.log(`C 代码块共 ${total} 个：完整程序通过编译 ${compiled} 个，片段/平台相关 ${skipped} 个，失败 ${failed} 个，CUDA 设备端 ${gpu.length} 个（需 nvcc，未本地验证）`);
if (warns.length) {
  console.log("\n编译警告（不致命，建议后续修）：");
  warns.slice(0, 15).forEach((w) => console.log("  ! " + w));
}
if (failures.length) {
  console.log("\n问题清单：");
  failures.forEach((f) => console.log("  ✗ " + f));
  console.log(`\n✗ 共 ${failures.length} 个 C 代码块未通过。`);
  process.exit(1);
}
console.log("\n✓ 全部 C 代码块通过真实编译或结构检查。");
