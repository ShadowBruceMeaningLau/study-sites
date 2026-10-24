/* 物理站引擎自测用的极小课程数据（physics/tools/fixture.html 专用，不参与正式站点加载）
   目的：把「引擎是否有 bug」与「课程内容是否正确」分开验证。
   覆盖：全部 block 类型（含物理站新增的 formula）、simlab + datalab + pathlab + arbitlab、
        四种题型（含数值填空）、闪卡 SM-2、公式速查与常量表页面。 */
window.COURSE_PACKS.push({
  id: "physics-fixture",
  title: "物理站引擎自测",
  icon: "🧪",
  term: "入门",
  hours: 4,
  blurb: "用于隔离验证物理站引擎：覆盖全部块类型、仿真与通用实验、四种题型、闪卡与公式速查。",
  need: "不需要任何物理基础，本课只是为了验证引擎。",
  tags: ["fixture"],
  formulas: [
    { name: "课程级公式示例", tex: "E = \\frac{1}{2}mv^2", note: "课程级 formulas[] 也会汇总到公式速查页。", units: "E: J，m: kg，v: m/s", condition: "v ≪ c" }
  ],
  lessons: [
    {
      id: "pf-blocks",
      title: "第一讲：块类型与题型",
      goal: "验证 concept/analogy/steps/code/pitfall/calc/formula/lab 与四种题型都能渲染。",
      est: 10,
      blocks: [
        { type: "concept", title: "核心讲解", md: "这是**粗体**、行内公式 $E = mc^2$ 与列表的渲染测试。\n\n- 列表项一\n- 列表项二\n\n> 提示块：应渲染为 callout。\n\n| 量 | 符号 | 单位 |\n|---|---|---|\n| 力 | $F$ | N |\n| 能量 | $E$ | J |" },
        { type: "analogy", title: "生活类比", md: "把电势想成「海拔」：电荷像小球，从高处滚向低处，不需要知道路上的每一个坡。" },
        { type: "steps", title: "推导骨架", items: [{ t: "写出量纲关系", d: "左边 m/s²，右边 N/kg = kg·m/s²/kg = m/s²，一致" }, "代入数值求结果"] },
        { type: "formula", title: "本讲公式", items: [{ name: "牛顿第二定律", tex: "\\vec{F} = m\\vec{a}", note: "力是改变运动状态的原因。", units: "F: N，m: kg，a: m/s²", condition: "惯性系、质点、$v \\ll c$" }] },
        { type: "code", lang: "python", title: "数值实验", code: "import math\n\ng = 9.8\nv0 = 20.0\nfor deg in (15, 30, 45, 60):\n    print(deg, \"度 -> 射程\", round(v0 * v0 * math.sin(2 * math.radians(deg)) / g, 3), \"m\")" },
        { type: "pitfall", title: "易错点", items: ["把「质量」与「重量」混为一谈", "用摄氏度代入理想气体定律"] },
        { type: "calc", title: "手算演练", inputs: [{ name: "初速度 v₀", value: "20 m/s" }, { name: "抛射角 θ", value: "45°" }, { name: "重力加速度 g", value: "9.8 m/s²" }], outputs: ["R ≈ 40.8 m"], verify: { expr: "v0^2*sind(2*theta)/g", value: "40.8", unit: "m", tol: 0.05, map: { v0: 20, theta: 45, g: 9.8 } }, note: "先自己算再展开。" },
        { type: "lab", title: "纸笔练习", steps: ["用有效数字规则写出一组测量结果", "写出它的 A 类不确定度"], note: "验收：结果写成 $x = \\bar{x} \\pm u$ 的形式。" },
        { type: "interactive", lab: "datalab", title: "量级估算单步过程", config: { state: { 步骤: 0 }, steps: [{ desc: "问：一座城市有多少钢琴调音师？", state: { 人口: "800 万", 步骤: 1 }, note: "先别急着算，拆成能猜的量" }, { desc: "每户约 3 人 → 约 270 万户", state: { 户数: "270 万", 步骤: 2 }, note: "这一步误差 2 倍以内就够" }, { desc: "约 5% 的家庭有钢琴 → 13.5 万台", state: { 钢琴数: "13.5 万", 步骤: 3 }, note: "百分比凭常识估" }, { desc: "每台每年调音 1 次 → 13.5 万次/年", state: { 年调音次数: "13.5 万", 步骤: 4 }, note: "量级已经出来了" }, { desc: "每人每天调 4 台、每年工作 250 天 → 1000 台/人·年", state: { 人均: "1000 台/年", 步骤: 5 }, note: "这一步最容易估错，但影响不大" }, { desc: "13.5 万 ÷ 1000 ≈ 135 人", state: { 结论: "约 135 名调音师", 步骤: 6 }, note: "量级答案，不是精确答案" }], tasks: ["自己换一组假设重算一次", "说明哪个假设带来的误差最大"] } }
      ],
      quiz: [
        { id: "pf-q1", type: "single", q: "关于「量纲」，下列说法正确的是？", options: ["量纲相同的两个物理量一定相等", "量纲不同则等式一定错误", "量纲只与单位大小有关", "量纲相同意味着物理意义相同"], answer: 1, why: "量纲是等式的必要条件：两边量纲不同，等式必错（选项 B 正确）。但量纲相同不代表相等，也不代表物理意义相同——黏度与压强都可以是 kg/(m·s²)，所以 A、D 错；量纲与单位大小无关，C 错。" },
        { id: "pf-q2", type: "multi", q: "下列哪些属于「理想化模型」？", options: ["质点", "刚体", "理想气体", "标准大气压"], answer: [0, 1, 2], why: "质点（忽略大小）、刚体（忽略形变）、理想气体（忽略分子体积与相互作用）都是为计算而做的理想化。标准大气压是一个约定的数值常量，不是模型。" },
        { id: "pf-q3", type: "fill", q: "v₀ = 20 m/s、θ = 45°、g = 9.8 m/s² 时，抛体射程约为 ____ m（保留三位有效数字）", answer: ["40.8"], numeric: true, tol: 0.15, unit: "m", why: "R = v₀²sin2θ/g = 400×1/9.8 ≈ 40.8 m。常见错误是把 sin2θ 写成 2sinθ，或者忘记 g 的单位换算。" },
        { id: "pf-q4", type: "order", q: "把「用数量级估算解决一个新问题」的步骤排成正确顺序", items: ["把结论与常识对照，判断是否合理", "把大问题拆成一串能猜的量级", "逐项估算并相乘", "写清每一步用了什么近似"], answer: [1, 2, 3, 0], why: "顺序是先拆解、再估算、然后写出近似假设，最后一定回到常识对照——没有第 4 步就不知道自己错在哪。" }
      ],
      flashcards: [
        { id: "pf-f1", kind: "公式", front: "抛体射程公式与成立条件？", back: "$R = v_0^2\\sin 2\\theta / g$。条件：初末高度相同、忽略空气阻力。45° 时射程最大。", why: "常见错误是把 sin2θ 写成 2sinθ。" },
        { id: "pf-f2", kind: "常量", front: "标准重力加速度 g 的值？", back: "定义值 9.806 65 m/s²；地表实测约 9.78~9.83 m/s²，做题无特别说明可用 9.8 m/s²。", why: "g 是随纬度与海拔变化的，只有标准值是常量。" },
        { id: "pf-f3", kind: "量级", front: "室温下的热能量 k_BT 约是多少 eV？", back: "约 0.0259 eV（T = 300 K）。它决定了室温下哪些能级差能被热运动激发。", why: "可见光光子约 2 eV，比 k_BT 大 80 倍，所以热运动无法直接把原子激发到可见光能级。" },
        { id: "pf-f4", kind: "单位", front: "1 eV 等于多少焦耳？对应的波长是多少？", back: "1 eV = 1.602×10⁻¹⁹ J；对应波长 λ ≈ 1240 nm。可见光 400~700 nm 对应 1.8~3.1 eV。", why: "记住 1240 nm·eV 这个换算，比每次代 h 和 c 快得多。" },
        { id: "pf-f5", kind: "定律", front: "机械能守恒的成立条件是什么？", back: "只有保守力做功（没有摩擦、没有外力做功）。用之前先检查这一条，否则必须改用能量守恒的一般形式。", why: "最常见的错误是见到「光滑」就以为可以用，其实还要检查有没有外力做功。" },
        { id: "pf-f6", kind: "方法", front: "A 类与 B 类不确定度有什么区别？", back: "A 类来自多次测量的分散程度（∝ s/√n），多测能减小；B 类来自仪器精度等非统计信息，换更好的仪器才能减小。", why: "把 B 类当成 A 类去「多测几次」，是实验报告里最常见的错误。" }
      ]
    },
    {
      id: "pf-labs",
      title: "第二讲：仿真与通用实验",
      goal: "验证 simlab 与 pathlab/arbitlab/datalab 的渲染与数值计算。",
      est: 12,
      blocks: [
        { type: "concept", title: "实验说明", md: "本讲放置多个实验组件，用于检查渲染与数值计算。" },
        { type: "interactive", lab: "simlab", title: "简谐振动：能量守恒", config: { model: "shm", params: { k: 4, m: 1, x0: 1, v0: 0 }, plots: ["x", "v"], note: "拖动 k 与 m，看周期如何变化；再看能量条是不是始终守恒。", tasks: ["把 k 变成 16，验证周期减半", "把 m 变成 4，验证周期加倍"] } },
        { type: "interactive", lab: "simlab", title: "抛体运动与空气阻力", config: { model: "projectile", params: { v0: 20, angle: 45, k: 0 }, vary: [{ key: "k", label: "阻力 k", values: [0, 0.3, 0.8] }], note: "三条曲线分别是无阻力与两种阻力下的轨迹。" } },
        { type: "interactive", lab: "pathlab", title: "最陡下降路径", config: { grid: [[1, 1, 9, 1], [1, 0, 1, 1], [1, 1, 1, 2]], start: [0, 0], end: [2, 3], algo: "dijkstra", legend: "0 是墙，数字是通过代价", tasks: ["先猜最短路，再点播放验证"] } },
        { type: "interactive", lab: "arbitlab", title: "浮点与有效数字", config: { bits: 32, modes: ["原码", "反码", "补码", "移码"], legend: "点击位切换，观察 32 位下的浮点表示" } }
      ],
      quiz: [
        { id: "pf-q5", type: "single", q: "简谐振动的周期 T = 2π√(m/k)，把它代入 k=4、m=1 得到？", options: ["π s", "2π s", "π/2 s", "4π s"], answer: 0, why: "ω = √(k/m) = 2 rad/s，T = 2π/ω = π ≈ 3.14 s。选 2π 是忘了除以 ω，选 π/2 是把 ω 与 T 弄反。" },
        { id: "pf-q6", type: "fill", q: "k = 9 N/m、m = 4 kg 时，简谐振动周期 T = ____ s（用 π 表示，如 4π/3）", answer: ["4π/3", "4*pi/3", "4pi/3"], why: "ω = √(9/4) = 1.5 rad/s，T = 2π/1.5 = 4π/3 ≈ 4.19 s。注意先开方再取倒数。" },
        { id: "pf-q7", type: "multi", q: "关于简谐振动，下列说法正确的有？", options: ["周期与振幅无关", "机械能守恒", "速度最大时位移为零", "加速度与位移同向"], answer: [0, 1, 2], why: "简谐振动的周期只取决于 m 与 k，与振幅无关（A 对）；保守系统机械能守恒（B 对）；速度最大出现在平衡位置即位移为零处（C 对）；加速度 a = −ω²x 与位移**反向**，D 错。" }
      ],
      flashcards: [
        { id: "pf-f7", kind: "公式", front: "简谐振动的周期公式与关键性质？", back: "$T = 2\\pi\\sqrt{m/k}$，与振幅**无关**。这是钟摆与石英钟能用来计时的根本原因。", why: "若周期与振幅有关，振动幅度一衰减，计时就不准了。" },
        { id: "pf-f8", kind: "概念", front: "为什么说「向心力不是一种新的力」？", back: "向心力是重力、张力、摩擦力等真实力的**合力效果**，大小为 mv²/r、方向指向圆心。受力分析时不能额外再加一个向心力。", why: "多做一道力就多一个错误方程。" }
      ]
    }
  ]
});
