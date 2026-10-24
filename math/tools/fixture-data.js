/* 数学站引擎自测用的极小课程数据（math/tools/fixture.html 专用，不参与正式站点加载）
   目的：把"引擎是否有 bug"与"数学内容是否正确"分开验证。 */
window.COURSE_PACKS.push({
  id: "math-fixture",
  title: "数学站引擎自测",
  icon: "🧪",
  term: "大一上",
  hours: 4,
  blurb: "用于隔离验证数学站引擎：覆盖全部 block 类型、6 种实验、4 种题型与导航点击。",
  tags: ["fixture"],
  lessons: [
    {
      id: "mf-blocks",
      title: "第一讲：块类型与题型",
      goal: "验证 concept/steps/analogy/code/pitfall/calc/lab 与四种题型都能渲染。",
      est: 10,
      blocks: [
        { type: "concept", title: "核心讲解", md: "这是**粗体**与公式 `lim 1/n = 0` 的渲染测试。\n\n- 列表项一\n- 列表项二\n\n> 提示块：应渲染为 callout。\n\n| 判别法 | 适用 | 结论 |\n|---|---|---|\n| 比值法 | 正项级数 | 极限 < 1 收敛 |" },
        { type: "analogy", title: "几何直观", md: "把 ε-N 定义想成一场博弈：对手给 ε，你回一个 N，此后所有项都被困在带子里。" },
        { type: "steps", title: "证明骨架", items: [{ t: "任给 ε > 0", d: "把结论中的任意量先固定下来" }, "解不等式求 N，取 N = ceil(1/ε)"] },
        { type: "code", lang: "python", title: "数值实验", code: "def limit_check(eps):\n    n = 1\n    while abs(1.0 / n - 0) >= eps:\n        n += 1\n    return n\n\n\nfor e in [0.1, 0.01, 0.001]:\n    print(\"eps =\", e, \"需要 N >=\", limit_check(e))" },
        { type: "pitfall", title: "易错点", items: ["把 N 写成依赖 n 的量", "只验证有限项就宣称收敛"] },
        { type: "calc", title: "手算演练", inputs: [{ name: "数列", value: "a_n = 1/n" }, { name: "ε", value: "0.01" }], outputs: ["取 N = 100 即可", "|1/n - 0| < 0.01 当 n > 100"], note: "先自己算再展开。" },
        { type: "lab", title: "纸笔练习", steps: ["用定义证明 lim (2n+1)/n = 2", "写出你取的 N 并验证"], note: "验收：证明中明确出现 ε 与 N 的关系。" },
        { type: "interactive", lab: "datalab", title: "ε-N 单步验证", config: { state: { eps: 0.01, N: 0 }, steps: [{ desc: "任给 ε = 0.01", state: { eps: 0.01, N: 0 }, note: "ε 是任意小的正数" }, { desc: "解 |1/n| < 0.01", state: { eps: 0.01, N: 100 }, note: "等价于 n > 100" }, { desc: "取 N = 100", state: { eps: 0.01, N: 100, n: 101, err: 0.0099 }, note: "从此之后误差都小于 ε" }, { desc: "n = 101 时误差 0.0099 < ε", state: { n: 101, err: 0.0099, ok: "是" }, note: "验证通过" }, { desc: "n = 1000 时误差 0.001 < ε", state: { n: 1000, err: 0.001, ok: "是" }, note: "后面所有项都满足" }, { desc: "结论：极限为 0", state: { 结论: "lim 1/n = 0" }, note: "ε 的任意性保证了极限" }], tasks: ["先猜 N，再点单步验证", "把 ε 改成 0.001 重做一遍"] } }
      ],
      quiz: [
        { id: "mf-q1", type: "single", q: "ε-N 定义中 N 的选取应当？", options: ["依赖 n", "只依赖 ε", "依赖极限值以外的任意量", "必须是整数倍"], answer: 1, why: "定义要求「对任意 ε 存在 N」，N 只能依赖 ε（可依赖数列本身），不能依赖 n，否则就变成对每个 n 单独成立而非最终成立。" },
        { id: "mf-q2", type: "multi", q: "下列哪些是级数收敛的必要条件或判别法？", options: ["通项趋于 0", "比值判别法", "部分和有界（正项级数）", "通项单调递减"], answer: [0, 1, 2], why: "通项趋于 0 是必要条件（非充分，调和级数即反例）；比值判别法与正项级数部分和有界都是有效判据。通项单调递减既不必要也不充分。" },
        { id: "mf-q3", type: "fill", q: "∑_{n≥1} 1/n² 的和是 ____", answer: ["π²/6", "pi^2/6", "π^2/6"], why: "这是欧拉 1735 年解决的巴塞尔问题，和为 π²/6 ≈ 1.6449；注意调和级数 ∑1/n 发散，两者不可混淆。" },
        { id: "mf-q4", type: "order", q: "把用定义证明 lim a_n = a 的步骤排序", items: ["解不等式 |a_n - a| < ε 求出 n 的下界", "任给 ε > 0", "验证此后所有项都满足定义"], answer: [1, 0, 2], why: "逻辑顺序是先固定任意的 ε，再据此找到 N（通过解不等式），最后说明 n > N 时结论成立，颠倒顺序会把「任意」写成「存在」。" }
      ]
    },
    {
      id: "mf-labs",
      title: "第二讲：六种交互实验",
      goal: "验证 pathlab/datalab/arbitlab/pagelab/schedlab 渲染与计算。",
      est: 12,
      blocks: [
        { type: "concept", title: "实验说明", md: "本讲放置多个实验组件用于检查渲染与数值计算。" },
        { type: "interactive", lab: "pathlab", title: "最短路与代价", config: { grid: [[1, 1, 9, 1], [1, 0, 1, 1], [1, 1, 1, 2]], start: [0, 0], end: [2, 3], algo: "dijkstra", legend: "0 是墙，数字是通过代价", tasks: ["先猜最短路，再点播放验证"] } },
        { type: "interactive", lab: "arbitlab", title: "浮点与位模式", config: { bits: 8, modes: ["无符号", "原码", "反码", "补码", "移码"], legend: "点击位切换，观察补码与移码的差别" } },
        { type: "interactive", lab: "pagelab", title: "有限窗口替换", config: { frames: 3, refs: [7, 0, 1, 2, 0, 3, 0, 4, 2, 3], algos: ["OPT", "FIFO", "LRU"] } },
        { type: "interactive", lab: "schedlab", title: "迭代收敛速度对比", config: { procs: [{ name: "P1", arrival: 0, burst: 5 }, { name: "P2", arrival: 1, burst: 3 }, { name: "P3", arrival: 2, burst: 1 }], quantum: 2, algos: ["FCFS", "SJF", "RR"] } },
        { type: "interactive", lab: "datalab", title: "黎曼和逼近", config: { state: { n: 1, sum: 0 }, steps: [{ desc: "n = 1，用一个大矩形近似", state: { n: 1, sum: 0.5, err: 0.1667 }, note: "误差较大" }, { desc: "n = 2", state: { n: 2, sum: 0.375, err: 0.0417 }, note: "误差下降约 4 倍" }, { desc: "n = 4", state: { n: 4, sum: 0.34375, err: 0.0104 }, note: "继续下降" }, { desc: "n = 8", state: { n: 8, sum: 0.3359, err: 0.0026 }, note: "误差按 1/n 下降" }, { desc: "n = 100", state: { n: 100, sum: 0.33334, err: 0.00003 }, note: "已非常接近 1/3" }, { desc: "结论", state: { 极限: "1/3" }, note: "黎曼和收敛到定积分" }] } }
      ],
      quiz: [
        { id: "mf-q5", type: "single", q: "Dijkstra 与 BFS 的主要差别是？", options: ["BFS 不能用于网格", "Dijkstra 考虑边的代价，BFS 只看层数", "两者等价", "Dijkstra 只能处理无权图"], answer: 1, why: "BFS 按层扩展，隐含每边权重相同；Dijkstra 每次取当前距离最小者并松弛邻边，可处理非负权。两者都不能处理负权边。" },
        { id: "mf-q6", type: "fill", q: "8 位补码能表示的最小整数是 ____", answer: ["-128", "－128"], why: "8 位补码范围是 -128 到 127：1000_0000 表示 -128，这正是补码比原码多表示一个负数的原因。" }
      ]
    }
  ]
});
