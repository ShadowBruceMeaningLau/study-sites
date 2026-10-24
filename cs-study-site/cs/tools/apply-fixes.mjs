/**
 * 站内内容的一键修正脚本（可重复运行，幂等）：
 * 1) 组成原理里讲 IEEE 754 的 arbitlab 由 bits=16 提升为 32（真实单精度格式）；
 * 2) 操作系统 inode 示例中 st_blocks 是 Linux 专有成员，改为可移植写法并注明差异。
 * 用法：node tools/apply-fixes.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const report = [];

/* ---------------------------------------------------- 修正 1：IEEE754 位宽 */
const coFile = join(ROOT, "data", "computer-organization.js");
if (existsSync(coFile)) {
  let src = readFileSync(coFile, "utf8");
  let changed = 0;
  const positions = [...src.matchAll(/lab:\s*"arbitlab"/g)].map((m) => m.index).reverse();
  for (const pos of positions) {
    const win = src.slice(pos, pos + 700);
    if (!win.includes("IEEE754")) continue;
    const m = /bits:\s*16/.exec(win);
    if (!m) continue;
    src = src.slice(0, pos + m.index) + "bits: 32" + src.slice(pos + m.index + m[0].length);
    changed++;
  }
  if (changed) writeFileSync(coFile, src, "utf8");
  report.push("computer-organization.js：IEEE754 arbitlab 位宽修正 " + changed + " 处");
}

/* ------------------------------------------- 修正 2：st_blocks 可移植性 */const osFile = join(ROOT, "data", "operating-systems.js");
if (existsSync(osFile)) {
  let src = readFileSync(osFile, "utf8");
  const bad = "    printf(\\\"占用磁盘块数(512B 为单位) = %lld\\\\n\\\", (long long)st.st_blocks);\\n";
  const good =
    "    /* 注意: st_blocks 是 Linux 专有成员(以 512B 为单位计块), Windows/macOS 下不存在,\\n" +
    "     * 跨平台代码应改为读 st_size 或按块大小自行计算, 否则编译报 struct stat has no member。 */\\n" +
    "    printf(\\\"文件占用块数(按 4KB 块估算) = %lld\\\\n\\\", (long long)((st.st_size + 4095) / 4096));\\n";
  if (src.includes(bad)) {
    src = src.replace(bad, good);
    writeFileSync(osFile, src, "utf8");
    report.push("operating-systems.js：st_blocks 已改为可移植写法（附平台差异说明）");
  } else {
    report.push("operating-systems.js：未匹配到 st_blocks 写法（可能已修正）");
  }
}

/* ------------------------------- 修正 3：有符号/无符号比较的 -Wsign-compare */
const coFile2 = join(ROOT, "data", "computer-organization.js");
if (existsSync(coFile2)) {
  let src = readFileSync(coFile2, "utf8");
  const bad = "printf(\\\"-1 < 1u  : %d\\\\n\\\", -1 < 1u);";
  const good =
    "/* 下面这行是故意演示的陷阱: 编译器会给出 -Wsign-compare 警告, 但结果正是我们要展示的 */\\n" +
    "    printf(\\\"-1 < 1u  : %d  (编译器会警告 -Wsign-compare, 这正是要看的现象)\\\\n\\\", -1 < 1u);";
  if (src.includes(bad)) {
    src = src.replace(bad, good);
    writeFileSync(coFile2, src, "utf8");
    report.push("computer-organization.js：为故意演示的 -Wsign-compare 增加说明注释");
  }
}

console.log(report.join("\n"));

