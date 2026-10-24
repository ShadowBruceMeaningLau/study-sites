#!/usr/bin/env node
/**
 * 给每个课程文件注入"前置知识提示"字段 need（面向零基础学习者）。
 * 只**新增**一个字段，不改动任何已有内容；幂等（已有 need 就跳过）。
 * 用法：node cs/tools/inject-needs.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(SITE, "data");

/** 每门课的前置提示（面向零基础：写清"学之前最好会什么"） */
const NEEDS = {
  "programming-basics": "完全零基础可以开始。只需要会开机关机、用浏览器、复制粘贴文件；本课会带你装编译器、写第一个程序。",
  "oop-java": "建议先学完「程序设计基础」的变量、分支、循环、函数（第 1~4 讲）。不需要任何 Java 经验。",
  "math-foundation": "需要高中数学基础（函数、三角、数列、简单求导）。如果这些也忘了，先看每讲开头的直观部分，再回来补公式。",
  "discrete-math": "只需要初中数学的集合与基本逻辑常识；本课从命题和真值表讲起。",
  "digital-logic": "零基础可学。只要理解「0 和 1」和初中的电路常识（开关通断）即可，本课从数制与布尔代数开始。",
  "data-structures": "建议先能读懂一段 C 或 Python 代码（会变量、循环、函数、数组）。这是全站后续课程的共同地基。",
  "ds-sorting-searching": "建议先学完「数据结构」的复杂度分析与线性表（第 1~2 讲）；本课会反复用 O(...) 记号。",
  "ds-graph-advanced": "建议先学完「数据结构」的图与哈希一讲；拓扑排序与关键路径都建立在图的存储与遍历之上。",
  "algorithms": "建议先学完「数据结构」（尤其是复杂度、树、图、堆）。本课默认你会用 C/C++ 或 Python 写完整程序。",
  "computer-organization": "建议先学「数字逻辑与数字电路」的组合/时序电路部分；至少要知道什么是二进制、逻辑门与触发器。",
  "operating-systems": "建议先学「程序设计基础」（会 C 语言与指针）与「计算机组成原理」（懂 CPU、内存、中断）。零基础直接看会吃力。",
  "computer-networks": "零基础可以开始，但建议先了解「计算机组成原理」里的 I/O 与中断概念；本课从分层模型讲起。",
  "database-systems": "零基础可学。只要会一点表格（Excel 的行列）就能理解关系模型；SQL 部分从零讲起。",
  "software-engineering": "建议先有至少一门语言的编程经验（写过几百行程序），否则「重构」「测试」会缺少体感。",
  "compilers": "建议先学「数据结构」（树、图、栈）与「程序设计基础」；本课会用到自动机与递归下降，不需要事先学过形式语言。",
  "computer-architecture": "建议先学「计算机组成原理」；本课的 Amdahl 定律、Cache、流水线、乱序执行都建立在组成原理之上。",
  "information-security": "建议先了解「计算机网络」的 TCP/IP 与「离散数学」的模运算（或直接看本课第 6 讲的数学基础一节）。",
  "parallel-distributed": "建议先学「操作系统」（进程线程、锁）与「计算机体系结构」（Cache、流水线）；本课不要求会写 CUDA。",
  "computation-theory": "零基础可以开始（只需要集合与函数的概念）。它是「编译原理」的理论前置，先学本课再看编译原理会更轻松。",
  "ai-ml": "建议先学「高等数学与线性代数」（矩阵乘法、导数、概率基础）并能用 Python 写函数；本课不依赖任何深度学习框架。",
  "cs408-intensive": "这是冲刺课：建议先学完数据结构、计算机组成原理、操作系统、计算机网络四门主课，再来做本课的题型训练。",
  "cs408-drills": "这是冲刺课：建议先过一遍四门主课，再用本课的交互实验把手算过程练熟。",
  "systems-practice": "建议先学完「程序设计基础」「操作系统」；本课的六个项目都要自己写代码（C 或 Python）。"
};

/** 数学站的前置提示 */
const MATH_NEEDS = {
  "math-zero-basics": "真·零基础从这里开始：不需要任何公式基础。本课把数学符号（∑ ∫ lim √）、逻辑与证明、函数图像、代数运算从头讲一遍，还教你怎么学数学。",
  "math-analysis-1": "需要高中数学（函数、三角、数列、不等式）。ε-N 语言是本课的新东西，本课会从「为什么需要它」讲起。",
  "math-analysis-2": "建议先学「数学分析（一）」；级数与一致收敛都建立在极限与连续之上。",
  "math-analysis-3": "建议先学「数学分析（一）（二）」；本课用到重积分与一致收敛。",
  "linear-algebra-1": "需要会解二元一次方程组即可；矩阵与行列式从定义讲起。",
  "linear-algebra-2": "建议先学「高等代数（一）」；特征值、二次型都建立在矩阵与线性空间之上。",
  "analytic-geometry": "需要高中平面几何与三角函数基础；空间向量从零讲起。",
  "probability": "需要高中的排列组合与简单积分概念；概率的公理化定义会从零讲起。",
  "statistics": "建议先学「概率论」；本课的抽样分布、估计与检验都建立在随机变量与分布之上。",
  "abstract-algebra": "需要集合、映射、整数除法的基础；群的定义会从大量具体例子引入。",
  "ode": "建议先学「数学分析（一）」与「高等代数（一）」；本课用到导数、积分与矩阵。",
  "pde": "建议先学「常微分方程」与「数学分析（三）」；本课用到傅里叶级数与多重积分。",
  "complex-analysis": "建议先学「数学分析（一）（二）」；复数的运算本课会重新讲一遍。",
  "real-analysis": "建议先学「数学分析」全三册；本课把黎曼积分升级为勒贝格积分。",
  "functional-analysis": "建议先学「实变函数与测度论初步」与「高等代数（二）」；本课默认你熟悉 ε-δ 与线性空间。",
  "fourier-analysis": "建议先学「数学分析（二）」的级数部分；傅里叶变换用到积分与收敛性。",
  "topology": "需要集合与映射的基础；开集公理化会从度量空间的直观引入。",
  "differential-geometry": "建议先学「高等代数（一）」与「数学分析（三）」；本课用到多元微分与线性代数。",
  "numerical-analysis": "需要微积分与线性代数基础，并会一点编程（本课用 Python 演示）；算法细节从零讲清。",
  "combinatorics": "只需要高中排列组合的基础；生成函数与图论从定义讲起。",
  "number-theory": "需要整除与余数的常识；同余与欧拉定理从零讲起，会用到一点计算。",
  "set-theory": "零基础可以开始（只需要「集合」这个词的日常含义）；公理化部分会讲清动机。",
  "math-history": "完全零基础可读，不需要任何公式基础，重点是思想方法的演变。"
};

const TABLE = SITE.endsWith("math") ? MATH_NEEDS : NEEDS;
let injected = 0, skipped = 0;
const report = [];

for (const f of readdirSync(DATA).filter((x) => x.endsWith(".js")).sort()) {
  const id = f.replace(/\.js$/, "");
  const need = TABLE[id];
  if (!need) { report.push("  ? " + f + "：表中没有对应的前置提示"); skipped++; continue; }
  const p = join(DATA, f);
  let src = readFileSync(p, "utf8");
  if (/\n\s*need:\s*"/.test(src)) { skipped++; continue; }
  // 在 hours: N 或 term: "..." 之后插入 need 字段
  const anchor = src.match(/(\n\s*(?:hours|term):\s*(?:"[^"]*"|\d+),)/);
  if (!anchor) { report.push("  ! " + f + "：找不到插入锚点"); skipped++; continue; }
  const insertAt = anchor.index + anchor[1].length;
  const safe = need.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const next = src.slice(0, insertAt) + '\n  need: "' + safe + '",' + src.slice(insertAt);
  try { new Function("window", "globalThis", next + ";"); }
  catch (e) { report.push("  ✗ " + f + "：注入后语法失败，已跳过（" + e.message.slice(0, 40) + "）"); continue; }
  writeFileSync(p, next, "utf8");
  injected++;
}

console.log(report.join("\n"));
console.log("注入 need 字段: " + injected + " 门；跳过 " + skipped + " 门。");
