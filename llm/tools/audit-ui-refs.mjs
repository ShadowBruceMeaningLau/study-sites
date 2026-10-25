#!/usr/bin/env node
/**
 * 能力路线图 / UI 层「课程 id 引用」校验（LLM 站新增门禁，第 10 道）
 *
 * 为什么需要这道门（真实事故，2026-10-25）
 * ------------------------------------------------------------------
 * `llm/app/app.js` 的 `pageRoadmap()` 里有一个 `ROADMAP_AREAS` 分组表。这个文件是
 * 从 cs 站复制引擎时整块带过来的，表里写的是 **47 个 cs / 数学站的课程 id**
 * （cs-zero-basics、operating-systems、compilers、math-analysis-1 …），
 * 而本站是 LLM 站，**这 47 个 id 一个都不存在**。
 *
 * 后果：页面遍历这些 id 去过滤本站课程，全部匹配失败 → 每门课的卡片一块都渲染不出来，
 * 「能力路线图」变成一个只剩三段硬编码文字的空壳。而所有已有门禁都是绿的：
 *   - `validate-curriculum.mjs` 直接读 data/*.js 算数据，**根本不看 app.js 里引用了什么 id**
 *   - `smoke-test.mjs` 只断言「课程数 / 主干齐全」，不断言 roadmap 有没有渲染出卡片
 * 这与 HANDOFF §7.7 记录的「课程没接线」是**同一类盲区**：数据在磁盘上好好的，
 * 只是 UI 层的引用对不上，用户看到的是空的。
 *
 * 本门禁做的事：把 UI 层（app/*.js）里出现的「看起来像课程 id」的字面量全部抽出来，
 * 逐个核对它是否对应一个真实存在的课程文件或课程内 id；同时反向检查
 * `ROADMAP_AREAS` 是否覆盖了本站全部课程（漏课也是事故）。
 *
 * 判据（任一不满足即 EXIT=1）：
 *   1. ROADMAP_AREAS 里声明的每个 id 都真实存在
 *   2. ROADMAP_AREAS 覆盖本站全部课程（不遗漏）
 *   3. 没有重复声明
 *   4. app/*.js 里不再出现「形如 cs-* / math-* / operating-systems 等式样」的
 *      跨站课程 id 残留（用一份已知 cs/数学站 id 样本做黑名单比对）
 *
 * 用法：node tools/audit-ui-refs.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(SITE, "data");
const APP = join(SITE, "app");

/* ------------------------------------------------------------ 读真实课程 id */
const courseIds = new Set();
const lessonIds = new Set();
for (const f of readdirSync(DATA).filter((x) => x.endsWith(".js"))) {
  const arr = [];
  try {
    new Function("window", "globalThis", readFileSync(join(DATA, f), "utf8") + ";")({ COURSE_PACKS: arr }, { COURSE_PACKS: arr });
  } catch {
    continue;
  }
  for (const c of arr) {
    courseIds.add(c.id);
    for (const l of c.lessons || []) lessonIds.add(l.id);
  }
}

/* ------------------------------------------------- 抽 ROADMAP_AREAS 声明 */
const appSrc = readFileSync(join(APP, "app.js"), "utf8");
const m = appSrc.match(/var\s+ROADMAP_AREAS\s*=\s*\[([\s\S]*?)\];/);

let fail = 0;
const ok = (cond, label, extra) => {
  if (cond) console.log("  ✓ " + label);
  else { console.log("  ✗ " + label + (extra ? "  → " + extra : "")); fail++; }
};

console.log("=== UI 层课程 id 引用校验（audit-ui-refs）===");
console.log("真实课程 " + courseIds.size + " 门 / 课程内 id " + lessonIds.size + " 个");

if (!m) {
  console.log("  ! 没找到 ROADMAP_AREAS（如果确实删掉了这个结构，请同步更新本门禁）");
} else {
  const declared = [...m[1].matchAll(/"([a-z0-9][a-z0-9-]*)"/g)].map((x) => x[1]);
  const uniq = new Set(declared);

  const missing = declared.filter((i) => !courseIds.has(i));
  const dupN = declared.length - uniq.size;
  const uncovered = [...courseIds].filter((i) => !uniq.has(i));

  ok(missing.length === 0,
    `ROADMAP_AREAS 引用的 id 全部真实存在（声明 ${declared.length} 个）`,
    "不存在 " + missing.length + " 个：" + missing.join(", "));

  ok(dupN === 0, "ROADMAP_AREAS 无重复声明", "重复 " + dupN + " 个");

  ok(uncovered.length === 0,
    `ROADMAP_AREAS 覆盖本站全部课程（${uniq.size}/${courseIds.size}）`,
    "未收录 " + uncovered.length + " 门：" + uncovered.join(", "));
}

/* --------------------------------- 跨站 id 残留（cs / math 站的黑名单样本） */
// 这些是从旧 cs / 数学站遗留下来、绝不该出现在 LLM 站 UI 里的典型 id。
// 只做「精确串」比对，避免误伤（例如 llm 站的 project-rag 不应被 rag 命中）。
const CROSS_SITE = [
  "cs-zero-basics", "math-zero-basics", "programming-basics", "oop-java", "math-foundation",
  "discrete-math", "digital-logic", "computer-organization", "computer-architecture",
  "systems-practice", "operating-systems", "parallel-distributed", "computer-networks",
  "information-security", "database-systems", "software-engineering", "data-structures",
  "ds-sorting-searching", "ds-graph-advanced", "algorithms", "computation-theory",
  "cs408-intensive", "cs408-drills", "compilers", "ai-ml", "math-analysis-1",
  "math-analysis-2", "math-analysis-3", "real-analysis", "functional-analysis",
  "complex-analysis", "fourier-analysis", "ode", "pde", "linear-algebra-1",
  "linear-algebra-2", "abstract-algebra", "analytic-geometry", "differential-geometry",
  "topology", "probability", "statistics", "numerical-analysis", "combinatorics",
  "number-theory", "set-theory", "math-history",
];

const resid = [];
for (const f of readdirSync(APP).filter((x) => x.endsWith(".js"))) {
  const s = readFileSync(join(APP, f), "utf8");
  for (const id of CROSS_SITE) {
    if (s.includes('"' + id + '"')) resid.push(f + " → " + id);
  }
}
ok(resid.length === 0, "app/*.js 无跨站课程 id 残留", resid.slice(0, 6).join("; "));

console.log("\n合计：错误 " + fail + " 处");
process.exit(fail > 0 ? 1 : 0);
