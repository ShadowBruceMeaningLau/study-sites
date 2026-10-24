// 给 CS 数学基础课补术语解释 + 零基础前置指引（精确字符串替换，改前校验）
import { readFileSync, writeFileSync } from "node:fs";

const P = "D:/ObsidianLocalLib/system1/DSH/2/cs/data/math-foundation.js";
let src = readFileSync(P, "utf8");
const before = src;
const applied = [];

/** 安全替换：只在唯一命中时替换，并打印是否命中 */
function rep(from, to, label) {
  const n = src.split(from).length - 1;
  if (n !== 1) { applied.push("  ✗ " + label + "：命中 " + n + " 次（跳过）"); return; }
  src = src.replace(from, to);
  applied.push("  ✓ " + label);
}

// ① 首页/课程层：加零基础前置指引（插在 blurb 之后）
rep(
  '  blurb: "',
  '  need: "这是给计算机专业开的数学课，节奏很快：一讲要覆盖数学分析里好几章的内容。如果你连极限、导数、矩阵都没系统学过，先去做数学站的《数学分析（一）》《高等代数（一）》——那两门课每一讲只讲一个概念，术语第一次出现就会解释。本课适合学完那两门后来复习与速查。",\n  blurb: "',
  "加 need 前置指引"
);

// ② 洛必达法则：首次出现处补一句解释
rep(
  "求极限的标准流程（含洛必达法则）",
  "求极限的标准流程（含洛必达法则——洛必达法则就是「0/0 或 ∞/∞ 型未定式可以对分子分母分别求导再取极限」这条捷径）",
  "解释洛必达法则"
);
rep(
  "两题可用洛必达或泰勒",
  "两题可用洛必达法则（分子分母分别求导）或泰勒展开（用多项式逼近函数，见本讲后面的说明）",
  "解释泰勒（calc 块）"
);

const out = src;
try { new Function("window", "globalThis", out + ";"); }
catch (e) { console.log("✗ 改后语法失败，未写回：" + e.message); process.exit(1); }

writeFileSync(P, out, "utf8");
console.log(applied.join("\n"));
console.log("文件已写回（" + before.length + " → " + out.length + " 字节）");
