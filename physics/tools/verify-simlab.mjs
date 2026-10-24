#!/usr/bin/env node
/**
 * verify-simlab.mjs —— 仿真模型的**物理不变量自检**
 *
 * 这是物理站唯一"能证明模型没算错"的机器门禁：对 app/simlab-models-*.js 里注册的
 * 每一个模型，跑它声明的 tests（能量守恒、开普勒第三定律、共振峰位置、维恩位移……），
 * 并把每个模型的输出与**独立推出的解析结果**逐条比对。
 *
 * 顺带做两件内容一致性检查：
 *   · 正文 interactive 块里引用的 model 必须已注册（防止写错名字导致实验白屏）；
 *   · 列出"已注册但没有任何课程引用"的模型（提示可以删或补课）。
 *
 * 用法：
 *   node tools/verify-simlab.mjs            # 全部模型
 *   node tools/verify-simlab.mjs kepler     # 只跑名字含 kepler 的模型
 *   node tools/verify-simlab.mjs --list     # 只列出模型与参数
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP = join(ROOT, "app");
const DATA = join(ROOT, "data");

const argv = process.argv.slice(2);
const filter = argv.filter((a) => !a.startsWith("--"))[0] || null;
const listOnly = argv.includes("--list");

/* --------------------------------------------------- 在 Node 里加载仿真引擎 */
globalThis.window = globalThis;
const engineFiles = ["simlab.js", ...readdirSync(APP).filter((f) => /^simlab-models-.*\.js$/.test(f)).sort()];
for (const f of engineFiles) {
  const code = readFileSync(join(APP, f), "utf8");
  try {
    vm.runInThisContext(code, { filename: f });
  } catch (e) {
    console.error(`✗ 加载 ${f} 失败：${e.message}`);
    process.exit(1);
  }
}
const SIM = globalThis.SIM;
if (!SIM) {
  console.error("✗ app/simlab.js 没有注册 window.SIM");
  process.exit(1);
}

const models = SIM.models;
const names = Object.keys(models).sort();
if (!names.length) {
  console.error("✗ 没有注册任何仿真模型（app/simlab-models-*.js）");
  process.exit(1);
}

if (listOnly) {
  console.log(`\n仿真模型共 ${names.length} 个：\n`);
  for (const n of names) {
    const d = models[n];
    const ps = Object.keys(d.params || {}).map((k) => `${k}=${d.params[k].def}${d.params[k].unit ? d.params[k].unit : ""}`).join(", ");
    console.log(`  ${n.padEnd(18)} ${d.title}`);
    console.log(`  ${"".padEnd(18)} 参数：${ps || "（无）"}　自检 ${(d.tests || []).length} 条`);
  }
  console.log("");
  process.exit(0);
}

/* ------------------------------------------------------------ 跑物理自检 */
let fails = 0, total = 0;
console.log(`\n=== simlab 物理不变量自检（${engineFiles.join(" + ")}）===\n`);

for (const n of names) {
  if (filter && !n.includes(filter)) continue;
  const def = models[n];
  const results = SIM.runTests(n);
  const bad = results.filter((r) => !r.ok);
  total += results.length;
  fails += bad.length;
  const flag = bad.length ? "✗" : "✓";
  console.log(`${flag} ${n} —— ${def.title}（${results.length} 条自检）`);
  for (const r of results) {
    console.log(`    ${r.ok ? "✓" : "✗"} ${r.name}`);
    if (!r.ok) console.log(`        ${r.detail}`);
  }
  if (!results.length) console.log("    （该模型没有声明自检）");
}

/* ------------------------------------- 内容引用一致性：model 名字必须存在 */
let refFails = 0;
const used = new Set();
let dataFiles = [];
try { dataFiles = readdirSync(DATA).filter((f) => f.endsWith(".js")).sort(); } catch { dataFiles = []; }

for (const f of dataFiles) {
  const code = readFileSync(join(DATA, f), "utf8");
  // 只做文本级扫描：找出 lab:"simlab" 附近的 model:"xxx"
  const re = /lab:\s*"simlab"[\s\S]{0,400}?model:\s*"([\w-]+)"/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    const id = m[1];
    used.add(id);
    if (!models[id]) {
      console.log(`✗ ${f}：引用了未注册的仿真模型 "${id}"`);
      refFails++;
    }
  }
}

if (dataFiles.length) {
  console.log("");
  if (refFails === 0) console.log(`✓ 课程引用的仿真模型全部已注册（共引用 ${used.size} 个模型）`);
  else { console.log(`✗ 有 ${refFails} 处引用了不存在的模型`); fails += refFails; }
  const unused = names.filter((n) => !used.has(n));
  if (unused.length) {
    console.log(`\n[提示] 已注册但暂无课程引用：${unused.join(", ")}`);
    console.log("       （W1 阶段先建好模型、后续波次课程再引用，属预期）");
  }
}

console.log(`\n合计：${total} 条物理自检，失败 ${fails} 条。`);
process.exit(fails ? 1 : 0);
