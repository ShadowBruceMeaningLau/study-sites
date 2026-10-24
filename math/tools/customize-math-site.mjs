// 一次性脚本：把复制来的 CS 站引擎改造成数学站（幂等，可重复运行）
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MATH = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const log = [];

function patch(rel, rules) {
  const p = join(MATH, rel);
  if (!existsSync(p)) { log.push("跳过（不存在）：" + rel); return; }
  let src = readFileSync(p, "utf8");
  let n = 0;
  for (const [from, to] of rules) {
    if (src.includes(to) && !src.includes(from)) continue;   // 已改过
    if (!src.includes(from)) { log.push("未匹配：" + rel + " ← " + from.slice(0, 40).replace(/\n/g, "\\n")); continue; }
    src = src.split(from).join(to);
    n++;
  }
  if (n) { writeFileSync(p, src, "utf8"); log.push("已改 " + rel + "（" + n + " 处）"); }
}

/* ---------------------------------------------------- app.js：数学站课程顺序 */
patch("app/app.js", [
  [
    `  var ORDER = [
    "programming-basics", "math-foundation", "discrete-math",
    "data-structures", "algorithms", "computer-organization",
    "operating-systems", "computer-networks", "database-systems",
    "software-engineering", "compilers", "computer-architecture", "ai-ml",
    "cs408-intensive", "systems-practice"
  ];`,
    `  var ORDER = [
    "math-analysis-1", "math-analysis-2", "math-analysis-3",
    "linear-algebra-1", "linear-algebra-2", "abstract-algebra",
    "analytic-geometry", "probability", "statistics",
    "complex-analysis", "ode", "real-analysis", "number-theory",
    "set-theory"
  ];`
  ],
  [
    `  var TERM_ORDER = [
    "大一上", "大一上~大一下", "大一下", "大二上", "大二下",
    "大三上", "大三下", "大三下~大四上", "大三下~大四（实践课）", "大四上", "大四上/选修", "大四"
  ];`,
    `  var TERM_ORDER = [
    "大一上", "大一下", "大二上", "大二下", "大三上", "大三下", "大四上", "大四", "选修"
  ];`
  ],
  // 首页大标题与导语
  [`wrap.appendChild(el("h1", "page-title", "计算机科学与技术 · 本科学习总览"));`,
   `wrap.appendChild(el("h1", "page-title", "基础数学 · 本科学习总览"));`],
  [`      " 个可点运行的交互实验与 " + g.quiz + " 道随堂测验题。所有进度与错题存在浏览器本地（localStorage），不联网。"));`,
   `      " 个可点运行的交互实验与 " + g.quiz + " 道随堂测验题。按「直观 → 严格定义 → 证明 → 计算 → 反例」的顺序编排，" +
      "所有进度与错题存在浏览器本地（localStorage），不联网。"));`],
  // 总览页「怎么用」文案改为数学学习法
  [`      "1. **先看「为什么」**：每讲开头的核心讲解会说明这个知识解决什么问题、不用它会怎样；跳过它会变成背名词。",`,
   `      "1. **先要直观，再要严格**：每讲先给几何图像或物理意义，再给 ε-N / ε-δ 这类严格表述；两者都要，缺一个都会学歪。",`],
  [`      "2. **动手跑实验**：带 \`交互实验\` 标签的块可以直接单步运行（路径搜索、调度甘特图、CPU 指令执行、页面置换、位模式、算法单步）。先猜结果，再点运行。",`,
   `      "2. **动手跑实验**：带 \`交互实验\` 标签的块可以单步运行（ε-N 验证、黎曼和逼近、泰勒展开、高斯消元、幂迭代、施密特正交化、大数定律、贝叶斯更新、中心极限定理、蒙特卡洛）。先猜结果，再点运行。",`],
  [`      "4. **每周点一次「🔁 复习」**：系统按错题与正确率挑出最薄弱的课，随机抽题重做。",`,
   `      "4. **把证明当练习**：每讲的「易错点」列出的都是证明里最容易跳步的地方；错题本会自动收集你答错的题，每周点一次「🔁 复习」重做。",`]
]);

/* -------------------------------------------------- progress.js：独立存储键 */
patch("app/progress.js", [
  [`var KEY = "cs-learn:v1";`, `var KEY = "math-learn:v1";`]
]);

/* -------------------------------------------------------- app.css：数学站配色 */
patch("app/app.css", [
  [`/* ==========================================================================
   计算机科学与技术 · 本科互动学习站  样式`,
   `/* ==========================================================================
   基础数学 · 本科互动学习站  样式`]
]);

/* ------------------------------------------- serve.mjs：默认端口换 8124 并改文案 */
patch("tools/serve.mjs", [
  [`const PORT = Number(process.argv[2] || process.env.PORT || 8123);`,
   `const PORT = Number(process.argv[2] || process.env.PORT || 8124);`],
  [`  console.log("  CS 本科互动学习站 已启动");`,
   `  console.log("  基础数学 本科学习站 已启动");`],
  [`      "或改用其它端口：node tools\\\\serve.mjs 8124");`,
   `      "或改用其它端口：node math\\\\tools\\\\serve.mjs 8125");`]
]);

console.log(log.join("\n"));
