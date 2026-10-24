#!/usr/bin/env node
/**
 * 内容质量审计：在结构校验之上，检查"讲得够不够透"。
 * 用法：node tools/audit-content.mjs
 * 只输出报告，退出码始终为 0（供人工抽查使用）。
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");

const len = (s) => (s ?? "").toString().replace(/\s/g, "").length;

const packs = [];
for (const f of readdirSync(DATA).filter((x) => x.endsWith(".js")).sort()) {
  const code = readFileSync(join(DATA, f), "utf8");
  const arr = [];
  try {
    new Function("window", "globalThis", code + ";")({ COURSE_PACKS: arr }, { COURSE_PACKS: arr });
  } catch (e) {
    console.log(`! ${f} 无法求值：${e.message}`);
    continue;
  }
  arr.forEach((c) => packs.push({ file: f, c }));
}

const issues = [];
const pad = (s, n) => String(s) + " ".repeat(Math.max(0, n - [...String(s)].reduce((a, ch) => a + (ch.charCodeAt(0) > 255 ? 2 : 1), 0)));

console.log("=== 每门课体量（字符数，反映讲解厚度） ===");
console.log(pad("课程", 30) + pad("讲", 6) + pad("块", 7) + pad("代码块", 9) + pad("实验", 7) + pad("题", 6) + pad("讲解字数", 10) + "题均解析");
let allLessons = 0, allBlocks = 0, allChars = 0, allQ = 0, quizCode = 0, labN = 0;
const blockTypes = {};
for (const { c } of packs) {
  let blocks = 0, chars = 0, code = 0, labs = 0, q = 0, why = 0;
  for (const l of c.lessons ?? []) {
    allLessons++;
    for (const b of l.blocks ?? []) {
      blocks++; allBlocks++;
      blockTypes[b.type] = (blockTypes[b.type] || 0) + 1;
      if (b.type === "code") code++;
      if (b.type === "interactive") { labs++; labN++; }
      chars += len(b.md) + len((b.items || []).map((i) => (typeof i === "string" ? i : (i.t || "") + (i.d || ""))).join("")) + len(b.code);
    }
    for (const qq of l.quiz ?? []) { q++; allQ++; why += len(qq.why); }
  }
  allChars += chars;
  console.log(pad(c.title, 30) + pad((c.lessons ?? []).length, 6) + pad(blocks, 7) + pad(code, 9) + pad(labs, 7) + pad(q, 6) + pad(chars, 10) + (q ? Math.round(why / q) + " 字" : "—"));
}
void quizCode;
console.log(`\n合计：${packs.length} 门课 / ${allLessons} 讲 / ${allBlocks} 个内容块 / ${labN} 个交互实验 / ${allQ} 道题 / 讲解约 ${(allChars / 10000).toFixed(1)} 万字`);
console.log("块类型分布：" + Object.entries(blockTypes).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + "×" + v).join("  "));

console.log("\n=== 逐讲体检（标记偏薄的讲） ===");
const rows = [];
for (const { c } of packs) {
  for (const l of c.lessons ?? []) {
    let chars = 0, labs = 0, codes = 0, calcs = 0, pitfalls = 0, concepts = 0;
    for (const b of l.blocks ?? []) {
      chars += len(b.md) + len((b.items || []).map((i) => (typeof i === "string" ? i : (i.t || "") + (i.d || ""))).join(""));
      if (b.type === "interactive") labs++;
      if (b.type === "code") codes++;
      if (b.type === "calc") calcs++;
      if (b.type === "pitfall") pitfalls++;
      if (b.type === "concept") concepts++;
    }
    const flags = [];
    if (labs === 0) flags.push("无交互实验");
    if (concepts === 0) flags.push("无核心讲解块");
    if (chars < 1200) flags.push("讲解偏薄(" + chars + "字)");
    if ((l.quiz ?? []).length < 2) flags.push("题量不足");
    if (codes === 0 && calcs === 0) flags.push("无代码/无手算");
    if (pitfalls === 0) flags.push("无易错点");
    rows.push({ course: c.title, l, chars, labs, q: (l.quiz ?? []).length, flags });
  }
}
rows.sort((a, b) => a.chars - b.chars);
rows.slice(0, 12).forEach((r) => {
  console.log("  " + pad(r.course, 22) + pad(r.l.title, 30) + pad(r.chars + "字", 10) + pad("实验" + r.labs, 7) + pad("题" + r.q, 6) + (r.flags.length ? "⚠ " + r.flags.join("、") : "✓"));
});
const flagged = rows.filter((r) => r.flags.length);
console.log(`\n共 ${rows.length} 讲，其中 ${flagged.length} 讲带有体检标记。`);

console.log("\n=== 填空题答案的可接受答案是否过窄 ===");
let narrow = 0;
for (const { c } of packs) {
  for (const l of c.lessons ?? []) {
    for (const q of l.quiz ?? []) {
      if (q.type !== "fill") continue;
      const hasBlank = /_{2,}|（\s*）|\(\s*\)|____|【\s*】/.test(q.q);
      if (!hasBlank) { console.log("  · [" + c.title + "] " + q.id + " 题干没有明显空格标记：" + q.q.slice(0, 40)); narrow++; }
    }
  }
}
if (!narrow) console.log("  ✓ 所有填空题题干都带空格/括号标记。");

console.log("\n=== 重复题干 / 重复解析（跨课程） ===");
const stems = new Map(), whys = new Map();
let dupS = 0, dupW = 0;
for (const { c } of packs) {
  for (const l of c.lessons ?? []) {
    for (const q of l.quiz ?? []) {
      const k = (q.q || "").trim();
      if (stems.has(k)) { console.log("  · 重复题干：" + k.slice(0, 44) + "（" + stems.get(k) + " / " + c.title + "）"); dupS++; }
      else stems.set(k, c.title);
      const wk = (q.why || "").trim().slice(0, 60);
      if (wk.length > 40 && whys.has(wk)) { console.log("  · 重复解析：" + wk.slice(0, 44) + "（" + whys.get(wk) + " / " + c.title + "）"); dupW++; }
      else whys.set(wk, c.title);
    }
  }
}
if (!dupS && !dupW) console.log("  ✓ 未发现跨课程重复题干或重复解析。");

console.log("\n=== 覆盖度检查（每门课是否覆盖关键主题） ===");
const COVER = {
  "data-structures": ["复杂度", "链表", "栈", "队列", "串", "树", "图", "哈希", "排序"],
  "algorithms": ["分治", "贪心", "动态规划", "图", "字符串", "NP"],
  "computer-organization": ["补码", "IEEE 754", "Cache", "流水线", "总线", "中断", "寻址"],
  "operating-systems": ["进程", "线程", "调度", "同步", "死锁", "分页", "虚拟内存", "文件系统", "I/O"],
  "computer-networks": ["链路", "IP", "路由", "TCP", "UDP", "拥塞", "DNS", "HTTP"],
  "database-systems": ["关系代数", "SQL", "范式", "索引", "B+", "事务", "并发", "恢复"],
  "compilers": ["词法", "语法", "LL", "LR", "语义", "中间代码", "优化", "代码生成"],
  "computer-architecture": ["Amdahl", "流水线", "乱序", "Cache", "RAID", "一致性", "GPU"],
  "ai-ml": ["搜索", "A*", "评估", "梯度", "正则", "决策树", "集成", "神经网络", "反向传播"],
  "software-engineering": ["需求", "设计", "测试", "重构", "Git", "CI", "度量"],
  "systems-practice": ["shell", "分配器", "调度", "Cache", "TCP", "解释器"],
  "cs408-intensive": ["二叉树", "排序", "Cache", "流水线", "调度", "页面置换", "子网", "CRC"],
  "math-foundation": ["极限", "导数", "级数", "矩阵", "特征值", "最小二乘", "概率"],
  "discrete-math": ["逻辑", "归纳", "关系", "图论", "计数", "数论"],
  "programming-basics": ["指针", "内存", "结构体", "字符串", "文件", "递归", "复杂度"]
};
let missTotal = 0;
for (const { c } of packs) {
  const want = COVER[c.id];
  if (!want) continue;
  const text = JSON.stringify(c);
  const miss = want.filter((k) => !text.includes(k));
  missTotal += miss.length;
  console.log("  " + pad(c.title, 24) + (miss.length ? "⚠ 未提及：" + miss.join("、") : "✓ " + want.length + " 个主题全部覆盖"));
}
if (missTotal) console.log(`\n共 ${missTotal} 个主题关键词未出现（可能是用词不同，需人工确认）。`);
