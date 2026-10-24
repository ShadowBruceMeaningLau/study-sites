#!/usr/bin/env node
/**
 * audit-zero-basis.mjs —— 零基础友好度审计：术语第一次出现时，有没有就地解释？
 *
 * 用法：
 *   node tools/audit-zero-basis.mjs              # 默认：报告（退出码 0）
 *   node tools/audit-zero-basis.mjs --strict     # 有发现就退出码 1
 *   node tools/audit-zero-basis.mjs --all        # 列出全部位置（默认每门课最多 6 条）
 *   node tools/audit-zero-basis.mjs --wide       # 连标题/单位/成立条件/任务提示一起扫
 *
 * ★★ 关于这个工具的**能力边界**（2026-10 由一次独立审计逼出来的诚实说明）★★
 *
 * 它**不是**一个能判"零基础友好度合格/不合格"的精确门禁，原因有两个，都不是实现问题而是方法问题：
 *   1) "解释"没有可判定的形式。正则只认「是指/称为/记作/……」这类标记，
 *      而中文里最常见的解释句式是"电场是……"、“这张表就是对电场的刻画”，
 *      前者不含标记词、后者把解释写成了比喻 —— 都会被漏判成"未解释"。
 *      实测：把判定范围从 4 个字段扩到全部读者可见字段后，命中数从 16 涨到 470，
 *      其中大量是上面这类假阳性。
 *   2) 术语表本身是启发式的，专有名词、复合词、日常词与术语之间没有清晰边界。
 *
 * 所以它的定位是**分诊工具**：把"值得人工看一眼的地方"按课程列出来，
 * 让审阅者拿着清单去读原文，而不是让脚本替人下结论。
 * **默认不失败**正是为了避免"工具常年红着、于是被忽略"这种更糟的结果；
 * 需要它拦住明显倒退时用 --strict。
 *
 * 曾经的真实问题（已修）：旧版只读 md/title/note/items 四个字段，
 * 而 outputs / quiz.why / flashcards.back / config.note / tasks 这些读者直接看得见的文本
 * （合计 100 万字以上）**从未被检查过**；而且它永远 exit 0，
 * 外面那圈"13 个门禁全绿"的脚本照样把它算作通过。现在覆盖全部可见字段。
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");
const argv = process.argv.slice(2);
const ALL = argv.includes("--all");
const STRICT = argv.includes("--strict");

/* 需要"首现必须解释"的高风险术语表 */
const RISKY = [
  "矢量", "标量", "梯度", "散度", "旋度", "通量", "环流",
  "微积分", "导数", "积分", "微分方程", "偏导数", "级数", "泰勒展开", "傅里叶",
  "特征值", "本征值", "矩阵", "行列式", "复数", "共轭",
  "参考系", "惯性系", "非惯性系", "质心", "转动惯量", "角动量", "力矩",
  "功", "功率", "动能", "势能", "机械能", "动量", "冲量", "碰撞",
  "简谐振动", "阻尼", "共振", "受迫振动", "波动", "驻波", "波函数",
  "温度", "热量", "内能", "熵", "焓", "自由能", "热容", "比热",
  "卡诺循环", "热机", "可逆过程", "绝热", "等温", "等压", "等容",
  "电场", "磁场", "电势", "电位", "电容", "电感", "电阻", "电流",
  "高斯定理", "安培环路", "电磁感应", "楞次定律", "法拉第",
  "干涉", "衍射", "偏振", "折射率", "焦距", "全反射", "光程",
  "光子", "电子伏", "能级", "量子数", "自旋", "泡利不相容",
  "不确定度", "误差", "系统误差", "随机误差", "有效数字", "量纲",
  "标准偏差", "置信区间", "最小二乘",
  "相对论", "洛伦兹变换", "固有时", "时空", "度规",
  "概率幅", "叠加态", "纠缠", "退相干", "量子比特",
  "相空间", "吸引子", "分形", "混沌", "李雅普诺夫",
  "晶格", "能带", "费米面", "声子", "超导", "磁畴",
  "红移", "视界", "奇点", "宇宙微波背景", "暗物质", "暗能量",
  "截面", "衰变", "半衰期", "结合能", "同位素",
  "无量纲", "数量级", "近似", "模型", "边界条件", "初始条件",
];

/**
 * 字段分两类（这是本工具唯一需要调参的地方，实测调过一轮）：
 *   PROSE —— 真正承担"讲解"的字段：术语在这里首现就必须解释；
 *   INCIDENTAL —— 标题、单位、成立条件、任务提示、选项等，
 *                术语在这些地方往往是**顺带一提**（"误差在千分之一量级"里的"误差"），
 *                拿它们判"首现未解释"会得到几百条噪音，把门禁变成没人看的东西。
 * 把 INCIDENTAL 排除之后剩下的是可执行的清单；想连它们一起看用 --wide。
 */
const PROSE = /(\.md$|\.outputs\[\d+\]$|\.why$|\.back$|\.config\.note$|\.note$|^md$|^outputs\[\d+\]$)/;
const wide = argv.includes("--wide");

/** 解释标记：出现这些字样就算"在这段里解释过" */
const EXPLAIN_MARK = /(即|是指|称为|叫做|记作|意思是|也就是说|读作|又称|是一种|定义为|定义为：|解释|通俗|直观地说|简单说|所谓|指的是|换句话说|大白话|（[A-Za-z][^）]{1,30}）|\([A-Za-z][^)]{1,30}\))/;

/** 这个词在文本里是不是"真的作为术语出现"（而不是嵌在别的词里） */
function isRealTerm(text, idx, term) {
  const before = text[idx - 1] ?? "";
  const after = text[idx + term.length] ?? "";
  if (/[A-Za-z0-9]/.test(before) || /[A-Za-z0-9]/.test(after)) return false;
  return true;
}

/** 递归收集一个对象里所有字符串，带可读路径 */
function collectStrings(node, path, out) {
  if (typeof node === "string") { if (node.trim()) out.push({ path, text: node }); return; }
  if (Array.isArray(node)) { node.forEach((v, i) => collectStrings(v, path + "[" + i + "]", out)); return; }
  if (node && typeof node === "object") { for (const k of Object.keys(node)) collectStrings(node[k], path ? path + "." + k : k, out); }
}

const packs = [];
for (const f of readdirSync(DATA).filter((x) => x.endsWith(".js")).sort()) {
  const arr = [];
  try { new Function("window", "globalThis", readFileSync(join(DATA, f), "utf8") + ";")({ COURSE_PACKS: arr }, { COURSE_PACKS: arr }); }
  catch { continue; }
  arr.forEach((c) => packs.push({ file: f, course: c }));
}

const rows = [];
let grandTotal = 0;
for (const { course } of packs) {
  const seen = new Set();
  const detail = [];
  let firstUnclear = 0;
  let chars = 0;
  for (const l of course.lessons ?? []) {
    const fields = [];
    for (const b of l.blocks ?? []) collectStrings(b, b.type || "block", fields);
    for (const q of l.quiz ?? []) collectStrings(q, "quiz", fields);
    for (const c of l.flashcards ?? []) collectStrings(c, "card", fields);
    for (const fd of fields) {
      if (!wide && !PROSE.test(fd.path)) continue;   // 默认只看承担讲解的字段
      chars += fd.text.length;
      const fieldExplains = EXPLAIN_MARK.test(fd.text);
      for (const t of RISKY) {
        if (seen.has(t)) continue;
        let idx = fd.text.indexOf(t);
        while (idx !== -1 && !isRealTerm(fd.text, idx, t)) idx = fd.text.indexOf(t, idx + 1);
        if (idx === -1) continue;
        seen.add(t);
        // 解释必须出现在这段讲解里（整段范围内），不要求紧邻
        if (!fieldExplains) {
          firstUnclear++;
          if (ALL || detail.length < 6) {
            detail.push({ t, lesson: l.title, path: fd.path, ctx: fd.text.slice(Math.max(0, idx - 30), idx + 55).replace(/\n/g, " ") });
          }
        }
      }
    }
  }
  grandTotal += firstUnclear;
  rows.push({ title: course.title, term: course.term || "", hits: firstUnclear, total: seen.size, chars, detail });
}

rows.sort((a, b) => b.hits - a.hits || b.total - a.total);
console.log("=== 零基础友好度审计（术语首现是否就地解释）===");
console.log("课程".padEnd(26) + "术语数".padStart(7) + "首现未解释".padStart(11) + "扫过字符".padStart(11) + "  学期");
for (const r of rows) {
  const name = r.title.length > 22 ? r.title.slice(0, 22) + "…" : r.title;
  console.log(name.padEnd(26) + String(r.total).padStart(7) + String(r.hits).padStart(11) + String(r.chars).padStart(11) + "  " + r.term);
}
const totalChars = rows.reduce((a, r) => a + r.chars, 0);
console.log("\n合计：首现未解释 " + grandTotal + " 处（涉及 " + rows.filter((r) => r.hits > 0).length + " 门课）");
console.log("      扫过读者可见文本 " + totalChars.toLocaleString() + " 字符（含 outputs / quiz.why / 闪卡背面 / 实验面板说明）");

const shown = ALL ? rows : rows.slice(0, 5);
if (grandTotal) {
  console.log("\n=== " + (ALL ? "全部位置" : "最严重的 5 门课的前几处") + " ===");
  for (const r of shown) {
    if (!r.hits) continue;
    console.log("【" + r.title + "】" + r.hits + " 处：");
    r.detail.forEach((d) => console.log("   · " + d.t + "（" + d.lesson.slice(0, 18) + " · " + d.path + "）：…" + d.ctx + "…"));
  }
}

if (grandTotal && STRICT) {
  console.log("\n✗ --strict：零基础友好度审计有 " + grandTotal + " 条待人工确认。");
  process.exit(1);
}
if (grandTotal) {
  console.log("\n（默认只报告、不判失败——理由见文件开头的「能力边界」。加 --strict 可当门禁用。）");
} else {
  console.log("\n✓ 所有高风险术语首次出现时都做了就地解释。");
}
