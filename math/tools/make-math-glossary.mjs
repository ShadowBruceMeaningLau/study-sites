#!/usr/bin/env node
/**
 * 生成数学站专属术语表（math/app/glossary.js）。
 * 数据写成"用 | 分隔的纯文本行"，避免中文里混入 ASCII 引号导致语法错误（这个坑踩过一次）。
 * 用法：node math/tools/make-math-glossary.mjs
 */
import { writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const MATH = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** 每行：分类|术语|英文|解释|出处 */
const RAW = `
零基础从这里看|数学符号 ∑（求和）|sigma|把一串数加起来。下面写起点、上面写终点，如 ∑ 从 k=1 到 n 表示把 k=1,2,…,n 全加起来。|数学分析（一）· 第 2 讲
零基础从这里看|数学符号 ∫（积分）|integral|把无穷多个"无穷小的贡献"累加起来，几何上常表示面积。|数学分析（一）· 第 6 讲
零基础从这里看|数学符号 ∀ 与 ∃|for all / exists|∀ 表示"对所有的"，∃ 表示"存在（至少有一个）"。ε-N 定义就靠这两个符号写出来。|数学分析（一）· 第 2 讲
零基础从这里看|函数（function）|function|把一个输入变成唯一输出的规则，记作 y = f(x)。|数学分析（一）· 第 3 讲
零基础从这里看|数列（sequence）|sequence|按顺序排好的一串数 a1, a2, a3, …，研究它"最终会走向哪里"。|数学分析（一）· 第 2 讲
零基础从这里看|区间（interval）|interval|数轴上的一段，如 (0,1) 不含端点、[0,1] 含端点。|数学分析（一）· 第 1 讲
零基础从这里看|绝对值 |x|（绝对值）|absolute value|x 到 0 的距离，永远非负。|x-1| 表示 x 到 1 的距离。|数学分析（一）· 第 2 讲
零基础从这里看|证明（proof）|proof|从已知前提出发、每一步都有依据地推出结论的书写过程。数学课的核心训练。|数学分析（一）· 第 2 讲
零基础从这里看|反例（counterexample）|counterexample|一个满足条件但不满足结论的例子，用来推翻一个命题。|数学分析（一）· 第 4 讲
分析|极限（limit）|limit|描述"无限接近"的严格工具。ε-N 用于数列，ε-δ 用于函数。|数学分析（一）· 第 2~3 讲
分析|连续（continuity）|continuity|函数在某点"不跳、不断"，等价于该点极限值等于函数值。|数学分析（一）· 第 3 讲
分析|导数（derivative）|derivative|函数在某点的瞬时变化率，几何上是切线斜率，也是最佳线性近似的系数。|数学分析（一）· 第 4 讲
分析|中值定理（MVT）|Mean Value Theorem|在区间内存在一点，其切线平行于两端连线。条件是闭区间连续、开区间可导。|数学分析（一）· 第 4 讲
分析|泰勒展开（Taylor）|Taylor expansion|用多项式在一点附近逼近函数，项数越多越准。误差由余项控制。|数学分析（一）· 第 4 讲
分析|级数（series）|series|无穷多项相加。部分和收敛才说级数收敛；∑1/n 发散而 ∑1/n² 收敛。|数学分析（二）· 第 1 讲
分析|一致收敛（uniform convergence）|uniform convergence|收敛速度与位置无关，是"逐项求导/求积"能交换次序的关键条件。|数学分析（二）· 第 2 讲
分析|重积分（multiple integral）|multiple integral|二元或多元函数的积分，几何上可表示体积；计算时常化为累次积分。|数学分析（二）· 第 6 讲
分析|散度与旋度|divergence / curl|描述向量场"是否有源"与"是否旋转"，是格林/高斯/斯托克斯公式的主角。|数学分析（三）· 第 3~4 讲
分析|反常积分（improper integral）|improper integral|积分区间无穷或被积函数无界时的积分，用极限定义其收敛性。|数学分析（三）· 第 1 讲
分析|测度（measure）|measure|给集合赋"大小"的函数，满足可数可加性。勒贝格测度让积分能处理更一般的函数。|实变函数 · 第 2 讲
分析|可测函数（measurable）|measurable function|使 {f > a} 对一切实数 a 都可测的函数，是可做勒贝格积分的前提。|实变函数 · 第 3 讲
分析|L^p 空间|L^p space|使 |f|^p 可积的函数构成的空间，是泛函分析里最常见的巴拿赫空间。|实变函数 · 第 5 讲
代数|矩阵（matrix）|matrix|数的矩形排列，可看作线性变换的表格表示。|高等代数（一）· 第 2 讲
代数|行列式（determinant）|determinant|方阵的一个数值，几何上是有向体积的伸缩倍数；为 0 表示变换把空间压扁（不可逆）。|高等代数（一）· 第 3 讲
代数|线性无关（linear independence）|linear independence|一组向量中任何一个都不能用其余的组合表示；等价于它们张成的空间维数等于个数。|高等代数（一）· 第 4 讲
代数|秩（rank）|rank|矩阵线性无关的行（或列）的个数，等于线性映射像空间的维数。|高等代数（一）· 第 5 讲
代数|特征值与特征向量|eigenvalue / eigenvector|变换在某个方向只发生伸缩、方向不变，那个伸缩倍数叫特征值，方向叫特征向量。|高等代数（二）· 第 1 讲
代数|二次型（quadratic form）|quadratic form|形如 xᵀAx 的齐次二次多项式，可用正交变换化为标准形，主轴是特征向量方向。|高等代数（二）· 第 3 讲
代数|SVD（奇异值分解）|Singular Value Decomposition|把任意矩阵分解为 UΣVᵀ，用于降维、压缩与最小二乘，是 PCA 的基础。|高等代数（二）· 第 5 讲
代数|群（group）|group|一个集合加一种运算，满足封闭、结合律、有单位元、每元有逆元。刻画"对称性"。|抽象代数 · 第 1 讲
代数|同态（homomorphism）|homomorphism|保持运算结构的映射；同态基本定理说"商掉核"就得到同构的像。|抽象代数 · 第 1 讲
代数|理想（ideal）|ideal|环中对加法与"被环元素乘"都封闭的子集，用它作商就能得到商环。|抽象代数 · 第 3 讲
代数|域扩张（field extension）|field extension|把一个小域"加进新元素"得到更大的域，扩张次数是它作为线性空间的维数。|抽象代数 · 第 4 讲
几何|向量（vector）|vector|有大小和方向的量；在坐标下就是一串数，可以做加法与数乘。|解析几何 · 第 1 讲
几何|内积与投影|inner product / projection|内积衡量两个向量的"对齐程度"；投影是沿某方向的影子，最小二乘就是投影。|解析几何 · 第 1 讲 / 高等代数（一）· 第 6 讲
几何|曲率（curvature）|curvature|曲线弯曲程度的度量（单位弧长上切线转过的角）；圆的曲率是 1/r。|微分几何 · 第 1 讲
几何|测地线（geodesic）|geodesic|曲面上"最直的线"，局部最短；球面上的测地线是大圆。|微分几何 · 第 4 讲
几何|高斯曲率（Gaussian curvature）|Gaussian curvature|曲面上两个主曲率之积。高斯绝妙定理说它是内蕴量，只靠曲面上的测量就能得到。|微分几何 · 第 3~4 讲
几何|拓扑空间（topological space）|topological space|指定了哪些子集算"开集"的集合；连续、紧致、连通都由开集定义。|拓扑学 · 第 1 讲
几何|紧致（compact）|compact|任何开覆盖都有有限子覆盖；在欧氏空间里等价于"有界且闭"。|拓扑学 · 第 2 讲
几何|基本群（fundamental group）|fundamental group|把"能连续变形的闭回路"归为一类所形成的群，用来区分空间的"洞"。|拓扑学 · 第 4 讲
随机|随机变量（random variable）|random variable|把随机试验的结果映射成数值的函数，分离散型与连续型。|概率论 · 第 2 讲
随机|分布函数（CDF）|cumulative distribution function|F(x) = P(X ≤ x)，单调不减、右连续，从 0 升到 1。|概率论 · 第 2 讲
随机|期望（expectation）|expectation|随机变量的长期平均值，加权平均的推广。|概率论 · 第 4 讲
随机|方差（variance）|variance|衡量随机变量偏离期望的程度，Var(X) = E(X²) − (EX)²。|概率论 · 第 4 讲
随机|独立（independence）|independence|联合概率等于边缘概率之积；注意"不相关"弱于"独立"。|概率论 · 第 3 讲
随机|大数定律（LLN）|Law of Large Numbers|样本均值随样本量增大依概率收敛到期望值，是"频率稳定"的理论依据。|概率论 · 第 5 讲
随机|中心极限定理（CLT）|Central Limit Theorem|大量独立同分布变量之和标准化后近似服从正态分布，是统计推断的基石。|概率论 · 第 5 讲
随机|估计量（estimator）|estimator|用样本算出的、用来猜总体参数的统计量，评价标准有无偏性、有效性、一致性。|数理统计 · 第 2 讲
随机|置信区间（CI）|confidence interval|按某种方法构造的区间，长期使用时有指定比例覆盖真值；不是"参数有 95% 概率落在里面"。|数理统计 · 第 3 讲
随机|p 值（p-value）|p-value|在原假设成立时出现当前或更极端结果的概率，不是原假设为真的概率。|数理统计 · 第 4 讲
计算|算法（algorithm）|algorithm|有限步内给出答案的明确步骤。|数值分析 · 第 1 讲
计算|误差阶（order of error）|order of error|记作 O(hᵏ)：步长减半时误差约缩小 2ᵏ 倍，用来比较方法精度。|数值分析 · 第 1 讲
计算|插值（interpolation）|interpolation|用经过已知点的简单函数近似未知函数；高次插值会出现龙格现象。|数值分析 · 第 2 讲
计算|条件数（condition number）|condition number|衡量问题对输入扰动有多敏感；条件数大说明问题病态，结果可能不可信。|数值分析 · 第 4 讲
计算|收敛阶（order of convergence）|order of convergence|迭代法每步误差缩小的速度：二分法是 1/2，牛顿法是平方级（误差平方）。|数值分析 · 第 5 讲
计算|刚性方程（stiff）|stiff equation|含变化速度差异极大的分量，显式方法需要极小步长，通常改用隐式方法。|数值分析 · 第 6 讲
`;

const cats = new Map();
for (const line of RAW.split("\n")) {
  const s = line.trim();
  if (!s) continue;
  const parts = s.split("|");
  if (parts.length < 5) continue;
  const [cat, t, en, d, where] = parts;
  if (!cats.has(cat)) cats.set(cat, []);
  cats.get(cat).push({ t, en, d, where });
}

const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const L = [];
L.push("/* ==========================================================================");
L.push("   glossary.js —— 数学站术语表（零依赖；由 math/tools/make-math-glossary.mjs 生成）");
L.push("   结构：window.GLOSSARY = { cats: [{ cat, items: [{ t, en, d, where }] }] }");
L.push("   ========================================================================== */");
L.push("(function (global) {");
L.push('  "use strict";');
L.push("");
L.push("  var TERMS = [");
const catList = [...cats.entries()];
catList.forEach(([cat, items], ci) => {
  L.push("    {");
  L.push('      cat: "' + esc(cat) + '",');
  L.push("      items: [");
  items.forEach((it, ii) => {
    L.push('        { t: "' + esc(it.t) + '", en: "' + esc(it.en) + '", d: "' + esc(it.d) + '", where: "' + esc(it.where) + '" }' + (ii === items.length - 1 ? "" : ","));
  });
  L.push("      ]");
  L.push("    }" + (ci === catList.length - 1 ? "" : ","));
});
L.push("  ];");
L.push("");
L.push("  global.GLOSSARY = {");
L.push("    cats: TERMS,");
L.push("    flat: function () {");
L.push("      var out = [];");
L.push("      TERMS.forEach(function (c) { c.items.forEach(function (it) { out.push({ cat: c.cat, t: it.t, en: it.en, d: it.d, where: it.where }); }); });");
L.push("      return out;");
L.push("    },");
L.push("    count: function () { return TERMS.reduce(function (n, c) { return n + c.items.length; }, 0); }");
L.push("  };");
L.push("})(window);");
L.push("");

const out = L.join("\n");
const w = {};
new Function("window", "globalThis", out)(w, w);
console.log("分类:", catList.map(([c, i]) => c + "(" + i.length + ")").join(" | "));
console.log("术语总数:", w.GLOSSARY.count());
writeFileSync(join(MATH, "app", "glossary.js"), out, "utf8");
console.log("已写入 math/app/glossary.js");
