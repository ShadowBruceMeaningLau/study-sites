#!/usr/bin/env node
/**
 * 零基础友好度审计器
 * 检查每门课的每个 concept/analogy 块是否"先解释后使用"：
 *   1) 收集"高危术语"（微积分/线代/专业词），检查首次出现时附近 120 字内是否有解释标记
 *      （即/是指/称为/叫做/记作/意思是/也就是说/读作/（英文）/"是一种"/定义）
 *   2) 输出每门课的"未解释术语命中数"，并按严重度排序
 * 用法：node <site>/tools/audit-zero-basis.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(SITE, "data");

/** 高危术语表：零基础读者很可能第一次见 */
const RISKY = [
  // 微积分
  "未定式", "洛必达", "中值定理", "泰勒", "麦克劳林", "无穷小", "无穷大", "极限", "导数", "微分", "积分",
  "原函数", "定积分", "不定积分", "级数", "收敛", "发散", "一致连续", "连续", "可导", "间断点", "渐近线",
  "拐点", "凹凸性", "偏导", "全微分", "梯度", "重积分", "曲线积分", "曲面积分", "场论", "散度", "旋度",
  "格林公式", "高斯公式", "斯托克斯", "含参积分", "反常积分", "广义积分", "柯西", "黎曼", "达布",
  // 线性代数
  "行列式", "矩阵", "秩", "特征值", "特征向量", "二次型", "线性无关", "线性相关", "向量空间", "子空间",
  "基", "维数", "正交", "投影", "最小二乘", "若尔当", "相似", "合同", "正定", "奇异值", "范数", "内积",
  "转置", "逆矩阵", "克拉默", "施密特", "幂迭代", "瑞利商", "雅可比",
  // 概率统计
  "随机变量", "分布函数", "期望", "方差", "协方差", "相关系数", "大数定律", "中心极限", "极大似然",
  "置信区间", "假设检验", "p 值", "无偏", "充分统计量", "贝叶斯", "先验", "后验", "泊松", "正态",
  // 计算机
  "算法复杂度", "递归", "指针", "栈", "堆", "哈希", "二叉树", "图灵机", "进程", "线程", "死锁", "信号量",
  "缺页", "虚拟内存", "页表", "中断", "DMA", "流水线", "Cache", "总线", "协议", "子网", "拥塞", "三次握手",
  "范式", "事务", "索引", "编译器", "词法分析", "语法分析", "正则", "编译", "解释器", "虚拟机",
  // 数学基础
  "ε-N", "ε-δ", "确界", "完备性", "基数", "测度", "可测", "拓扑", "同胚", "紧致", "连通", "同伦",
  "基本群", "流形", "测地线", "高斯曲率", "泛函", "巴拿赫", "希尔伯特", "算子", "谱", "弱收敛"
];

/**
 * 误报过滤：有些词是常用词的一部分，不能算"用了专业术语却没解释"。
 * 例：基本功里的「基」、秩序的「秩」、与边数线性相关里的「线性相关」、Ctrl+C 中断程序里的「中断」。
 */
const FALSE_POSITIVE = [
  { term: "基", next: /^(本|础|金|因|地|准|于|层|数|建)/ },
  { term: "秩", next: /^序/ },
  { term: "堆", next: /^(积|放|满|砌|叠|在)/ },
  { term: "栈", next: /^(道|桥)/ },
  { term: "线性相关", next: /^的?边数|^性|^系/ },
  { term: "中断", next: /^(正在运行|程序)/ },
  { term: "协议", next: /^书/ },
  { term: "收敛", next: /^(了|到)/ },
  { term: "极限", next: /^(运动|限)/ },
  { term: "事务", next: /^(所|局)/ },
  { term: "索引", next: /^擎/ },
  { term: "正则", next: /^(常|式方程)/ },
  { term: "算子", next: /^法/ },
  { term: "谱", next: /^(写|曲|子)/ },
  { term: "测度", next: /^量/ },
  { term: "投影", next: /^(仪|机|布)/ },
  { term: "范数", next: /^(围|畴|文)/ }
];

/** 该次出现是否算"真术语"（排除常用词误报） */
function isRealTerm(text, idx, term) {
  const after = text.slice(idx + term.length, idx + term.length + 4);
  for (const fp of FALSE_POSITIVE) {
    if (fp.term !== term) continue;
    if (fp.next && fp.next.test(after)) return false;
  }
  return true;
}

const EXPLAIN_MARK = /(即|是指|称为|叫做|记作|意思是|也就是说|读作|又称|是一种|定义为|定义为：|解释|通俗|直观地说|简单说|所谓|指的是|（[A-Za-z][^）]{1,30}）|\([A-Za-z][^)]{1,30}\))/;

const packs = [];
for (const f of readdirSync(DATA).filter((x) => x.endsWith(".js")).sort()) {
  const arr = [];
  try { new Function("window", "globalThis", readFileSync(join(DATA, f), "utf8") + ";")({ COURSE_PACKS: arr }, { COURSE_PACKS: arr }); }
  catch { continue; }
  arr.forEach((c) => packs.push({ file: f, course: c }));
}

const rows = [];
let grandTotal = 0;
let grandLazy = 0;
for (const { file, course } of packs) {
  const seen = new Set();
  let lazy = 0;                    // 概念块里"用了却没在本块解释"的术语
  let firstUnclear = 0;            // 首次出现时所在块没有解释
  const detail = [];
  for (const l of course.lessons ?? []) {
    for (const b of l.blocks ?? []) {
      const text = [b.md, b.title, b.note, (b.items || []).map((i) => (typeof i === "string" ? i : (i.t || "") + (i.d || ""))).join(" ")].filter(Boolean).join(" ");
      if (!text) continue;
      const blockExplains = EXPLAIN_MARK.test(text);
      for (const t of RISKY) {
        if (!text.includes(t)) continue;
        if (!isRealTerm(text, text.indexOf(t), t)) continue;
        const first = !seen.has(t);
        if (first) {
          seen.add(t);
          if (!blockExplains) {
            firstUnclear++;
            if (detail.length < 6) detail.push({ t, lesson: l.title, ctx: text.slice(Math.max(0, text.indexOf(t) - 30), text.indexOf(t) + 55).replace(/\n/g, " ") });
          }
        }
        // 之后再次出现在 concept 块里、而该块没有任何解释标记 → 记为"假设已懂"
        if (!first && b.type === "concept" && !blockExplains) lazy++;
      }
    }
  }
  grandTotal += firstUnclear;
  grandLazy += lazy;
  rows.push({ id: course.id, title: course.title, term: course.term || "", hits: firstUnclear, lazy, total: seen.size, detail });
}

rows.sort((a, b) => (b.hits + b.lazy) - (a.hits + a.lazy));
console.log("=== 零基础友好度审计 ===");
console.log("课程".padEnd(26) + "术语数".padStart(7) + "首现未解释".padStart(11) + "后续仅使用".padStart(11) + "  学期");
for (const r of rows) {
  const name = r.title.length > 22 ? r.title.slice(0, 22) + "…" : r.title;
  console.log(name.padEnd(26) + String(r.total).padStart(7) + String(r.hits).padStart(11) + String(r.lazy).padStart(11) + "  " + r.term);
}
console.log("\n合计：首现未解释 " + grandTotal + " 处；后续「假设已懂」" + grandLazy + " 处（涉及 " + rows.filter((r) => r.hits + r.lazy > 0).length + " 门课）");
console.log("\n=== 最严重的 5 门课的前几处 ===");
rows.slice(0, 5).forEach((r) => {
  if (!r.hits && !r.lazy) return;
  console.log("【" + r.title + "】首现未解释 " + r.hits + " / 后续仅使用 " + r.lazy + "，例如：");
  r.detail.slice(0, 3).forEach((d) => console.log("   · " + d.t + "（" + d.lesson.slice(0, 18) + "）：…" + d.ctx + "…"));
});
