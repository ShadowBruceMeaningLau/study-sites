/* ==========================================================================
   glossary.js —— 数学站术语表（零依赖；由 math/tools/make-math-glossary.mjs 生成）
   结构：window.GLOSSARY = { cats: [{ cat, items: [{ t, en, d, where }] }] }
   ========================================================================== */
(function (global) {
  "use strict";

  var TERMS = [
    {
      cat: "零基础从这里看",
      items: [
        { t: "数学符号 ∑（求和）", en: "sigma", d: "把一串数加起来。下面写起点、上面写终点，如 ∑ 从 k=1 到 n 表示把 k=1,2,…,n 全加起来。", where: "数学分析（一）· 第 2 讲" },
        { t: "数学符号 ∫（积分）", en: "integral", d: "把无穷多个\"无穷小的贡献\"累加起来，几何上常表示面积。", where: "数学分析（一）· 第 6 讲" },
        { t: "数学符号 ∀ 与 ∃", en: "for all / exists", d: "∀ 表示\"对所有的\"，∃ 表示\"存在（至少有一个）\"。ε-N 定义就靠这两个符号写出来。", where: "数学分析（一）· 第 2 讲" },
        { t: "函数（function）", en: "function", d: "把一个输入变成唯一输出的规则，记作 y = f(x)。", where: "数学分析（一）· 第 3 讲" },
        { t: "数列（sequence）", en: "sequence", d: "按顺序排好的一串数 a1, a2, a3, …，研究它\"最终会走向哪里\"。", where: "数学分析（一）· 第 2 讲" },
        { t: "区间（interval）", en: "interval", d: "数轴上的一段，如 (0,1) 不含端点、[0,1] 含端点。", where: "数学分析（一）· 第 1 讲" },
        { t: "绝对值 ", en: "x", d: "（绝对值）", where: "absolute value" },
        { t: "证明（proof）", en: "proof", d: "从已知前提出发、每一步都有依据地推出结论的书写过程。数学课的核心训练。", where: "数学分析（一）· 第 2 讲" },
        { t: "反例（counterexample）", en: "counterexample", d: "一个满足条件但不满足结论的例子，用来推翻一个命题。", where: "数学分析（一）· 第 4 讲" }
      ]
    },
    {
      cat: "分析",
      items: [
        { t: "极限（limit）", en: "limit", d: "描述\"无限接近\"的严格工具。ε-N 用于数列，ε-δ 用于函数。", where: "数学分析（一）· 第 2~3 讲" },
        { t: "连续（continuity）", en: "continuity", d: "函数在某点\"不跳、不断\"，等价于该点极限值等于函数值。", where: "数学分析（一）· 第 3 讲" },
        { t: "导数（derivative）", en: "derivative", d: "函数在某点的瞬时变化率，几何上是切线斜率，也是最佳线性近似的系数。", where: "数学分析（一）· 第 4 讲" },
        { t: "中值定理（MVT）", en: "Mean Value Theorem", d: "在区间内存在一点，其切线平行于两端连线。条件是闭区间连续、开区间可导。", where: "数学分析（一）· 第 4 讲" },
        { t: "泰勒展开（Taylor）", en: "Taylor expansion", d: "用多项式在一点附近逼近函数，项数越多越准。误差由余项控制。", where: "数学分析（一）· 第 4 讲" },
        { t: "级数（series）", en: "series", d: "无穷多项相加。部分和收敛才说级数收敛；∑1/n 发散而 ∑1/n² 收敛。", where: "数学分析（二）· 第 1 讲" },
        { t: "一致收敛（uniform convergence）", en: "uniform convergence", d: "收敛速度与位置无关，是\"逐项求导/求积\"能交换次序的关键条件。", where: "数学分析（二）· 第 2 讲" },
        { t: "重积分（multiple integral）", en: "multiple integral", d: "二元或多元函数的积分，几何上可表示体积；计算时常化为累次积分。", where: "数学分析（二）· 第 6 讲" },
        { t: "散度与旋度", en: "divergence / curl", d: "描述向量场\"是否有源\"与\"是否旋转\"，是格林/高斯/斯托克斯公式的主角。", where: "数学分析（三）· 第 3~4 讲" },
        { t: "反常积分（improper integral）", en: "improper integral", d: "积分区间无穷或被积函数无界时的积分，用极限定义其收敛性。", where: "数学分析（三）· 第 1 讲" },
        { t: "测度（measure）", en: "measure", d: "给集合赋\"大小\"的函数，满足可数可加性。勒贝格测度让积分能处理更一般的函数。", where: "实变函数 · 第 2 讲" },
        { t: "可测函数（measurable）", en: "measurable function", d: "使 {f > a} 对一切实数 a 都可测的函数，是可做勒贝格积分的前提。", where: "实变函数 · 第 3 讲" },
        { t: "L^p 空间", en: "L^p space", d: "使 ", where: "f" }
      ]
    },
    {
      cat: "代数",
      items: [
        { t: "矩阵（matrix）", en: "matrix", d: "数的矩形排列，可看作线性变换的表格表示。", where: "高等代数（一）· 第 2 讲" },
        { t: "行列式（determinant）", en: "determinant", d: "方阵的一个数值，几何上是有向体积的伸缩倍数；为 0 表示变换把空间压扁（不可逆）。", where: "高等代数（一）· 第 3 讲" },
        { t: "线性无关（linear independence）", en: "linear independence", d: "一组向量中任何一个都不能用其余的组合表示；等价于它们张成的空间维数等于个数。", where: "高等代数（一）· 第 4 讲" },
        { t: "秩（rank）", en: "rank", d: "矩阵线性无关的行（或列）的个数，等于线性映射像空间的维数。", where: "高等代数（一）· 第 5 讲" },
        { t: "特征值与特征向量", en: "eigenvalue / eigenvector", d: "变换在某个方向只发生伸缩、方向不变，那个伸缩倍数叫特征值，方向叫特征向量。", where: "高等代数（二）· 第 1 讲" },
        { t: "二次型（quadratic form）", en: "quadratic form", d: "形如 xᵀAx 的齐次二次多项式，可用正交变换化为标准形，主轴是特征向量方向。", where: "高等代数（二）· 第 3 讲" },
        { t: "SVD（奇异值分解）", en: "Singular Value Decomposition", d: "把任意矩阵分解为 UΣVᵀ，用于降维、压缩与最小二乘，是 PCA 的基础。", where: "高等代数（二）· 第 5 讲" },
        { t: "群（group）", en: "group", d: "一个集合加一种运算，满足封闭、结合律、有单位元、每元有逆元。刻画\"对称性\"。", where: "抽象代数 · 第 1 讲" },
        { t: "同态（homomorphism）", en: "homomorphism", d: "保持运算结构的映射；同态基本定理说\"商掉核\"就得到同构的像。", where: "抽象代数 · 第 1 讲" },
        { t: "理想（ideal）", en: "ideal", d: "环中对加法与\"被环元素乘\"都封闭的子集，用它作商就能得到商环。", where: "抽象代数 · 第 3 讲" },
        { t: "域扩张（field extension）", en: "field extension", d: "把一个小域\"加进新元素\"得到更大的域，扩张次数是它作为线性空间的维数。", where: "抽象代数 · 第 4 讲" }
      ]
    },
    {
      cat: "几何",
      items: [
        { t: "向量（vector）", en: "vector", d: "有大小和方向的量；在坐标下就是一串数，可以做加法与数乘。", where: "解析几何 · 第 1 讲" },
        { t: "内积与投影", en: "inner product / projection", d: "内积衡量两个向量的\"对齐程度\"；投影是沿某方向的影子，最小二乘就是投影。", where: "解析几何 · 第 1 讲 / 高等代数（一）· 第 6 讲" },
        { t: "曲率（curvature）", en: "curvature", d: "曲线弯曲程度的度量（单位弧长上切线转过的角）；圆的曲率是 1/r。", where: "微分几何 · 第 1 讲" },
        { t: "测地线（geodesic）", en: "geodesic", d: "曲面上\"最直的线\"，局部最短；球面上的测地线是大圆。", where: "微分几何 · 第 4 讲" },
        { t: "高斯曲率（Gaussian curvature）", en: "Gaussian curvature", d: "曲面上两个主曲率之积。高斯绝妙定理说它是内蕴量，只靠曲面上的测量就能得到。", where: "微分几何 · 第 3~4 讲" },
        { t: "拓扑空间（topological space）", en: "topological space", d: "指定了哪些子集算\"开集\"的集合；连续、紧致、连通都由开集定义。", where: "拓扑学 · 第 1 讲" },
        { t: "紧致（compact）", en: "compact", d: "任何开覆盖都有有限子覆盖；在欧氏空间里等价于\"有界且闭\"。", where: "拓扑学 · 第 2 讲" },
        { t: "基本群（fundamental group）", en: "fundamental group", d: "把\"能连续变形的闭回路\"归为一类所形成的群，用来区分空间的\"洞\"。", where: "拓扑学 · 第 4 讲" }
      ]
    },
    {
      cat: "随机",
      items: [
        { t: "随机变量（random variable）", en: "random variable", d: "把随机试验的结果映射成数值的函数，分离散型与连续型。", where: "概率论 · 第 2 讲" },
        { t: "分布函数（CDF）", en: "cumulative distribution function", d: "F(x) = P(X ≤ x)，单调不减、右连续，从 0 升到 1。", where: "概率论 · 第 2 讲" },
        { t: "期望（expectation）", en: "expectation", d: "随机变量的长期平均值，加权平均的推广。", where: "概率论 · 第 4 讲" },
        { t: "方差（variance）", en: "variance", d: "衡量随机变量偏离期望的程度，Var(X) = E(X²) − (EX)²。", where: "概率论 · 第 4 讲" },
        { t: "独立（independence）", en: "independence", d: "联合概率等于边缘概率之积；注意\"不相关\"弱于\"独立\"。", where: "概率论 · 第 3 讲" },
        { t: "大数定律（LLN）", en: "Law of Large Numbers", d: "样本均值随样本量增大依概率收敛到期望值，是\"频率稳定\"的理论依据。", where: "概率论 · 第 5 讲" },
        { t: "中心极限定理（CLT）", en: "Central Limit Theorem", d: "大量独立同分布变量之和标准化后近似服从正态分布，是统计推断的基石。", where: "概率论 · 第 5 讲" },
        { t: "估计量（estimator）", en: "estimator", d: "用样本算出的、用来猜总体参数的统计量，评价标准有无偏性、有效性、一致性。", where: "数理统计 · 第 2 讲" },
        { t: "置信区间（CI）", en: "confidence interval", d: "按某种方法构造的区间，长期使用时有指定比例覆盖真值；不是\"参数有 95% 概率落在里面\"。", where: "数理统计 · 第 3 讲" },
        { t: "p 值（p-value）", en: "p-value", d: "在原假设成立时出现当前或更极端结果的概率，不是原假设为真的概率。", where: "数理统计 · 第 4 讲" }
      ]
    },
    {
      cat: "计算",
      items: [
        { t: "算法（algorithm）", en: "algorithm", d: "有限步内给出答案的明确步骤。", where: "数值分析 · 第 1 讲" },
        { t: "误差阶（order of error）", en: "order of error", d: "记作 O(hᵏ)：步长减半时误差约缩小 2ᵏ 倍，用来比较方法精度。", where: "数值分析 · 第 1 讲" },
        { t: "插值（interpolation）", en: "interpolation", d: "用经过已知点的简单函数近似未知函数；高次插值会出现龙格现象。", where: "数值分析 · 第 2 讲" },
        { t: "条件数（condition number）", en: "condition number", d: "衡量问题对输入扰动有多敏感；条件数大说明问题病态，结果可能不可信。", where: "数值分析 · 第 4 讲" },
        { t: "收敛阶（order of convergence）", en: "order of convergence", d: "迭代法每步误差缩小的速度：二分法是 1/2，牛顿法是平方级（误差平方）。", where: "数值分析 · 第 5 讲" },
        { t: "刚性方程（stiff）", en: "stiff equation", d: "含变化速度差异极大的分量，显式方法需要极小步长，通常改用隐式方法。", where: "数值分析 · 第 6 讲" }
      ]
    }
  ];

  global.GLOSSARY = {
    cats: TERMS,
    flat: function () {
      var out = [];
      TERMS.forEach(function (c) { c.items.forEach(function (it) { out.push({ cat: c.cat, t: it.t, en: it.en, d: it.d, where: it.where }); }); });
      return out;
    },
    count: function () { return TERMS.reduce(function (n, c) { return n + c.items.length; }, 0); }
  };
})(window);
