/* 数学分析（三）：含参积分与场论 —— 课程数据（纯数据文件，无 BOM，UTF-8） */
window.COURSE_PACKS.push({
  id: "math-analysis-3",
  title: "数学分析（三）：含参积分与场论",
  icon: "🧭",
  term: "大二上",
  advanced: {texts:["《数学分析》华东师大版下册（含参积分与场论）","《向量分析与场论》或卓里奇对应章节"],labs:["手算格林/高斯/斯托克斯各 5 题并两路对照（曲线积分 vs 重积分）","用程序数值计算通量与环量验证公式"],project:"写一份「三大公式其实是一个定理」的讲义（外微分视角）",criteria:"能判断向量场是否保守并求出势函数；能写出三大公式并说明条件"},
  need: "建议先学「数学分析（一）（二）」；本课用到重积分与一致收敛。",
  hours: 64,
  blurb: "把一元积分推向反常与含参情形，再把积分搬进平面与空间：格林、高斯、斯托克斯三大公式是场论与数学物理的共同语言，最后用分析眼光进入常微分方程。",
  tags: ["数学主干", "证明训练"],
  lessons: [
    /* ==================================================================== 第 1 讲 */
    {
      id: "ma3-improper-integral",
      title: "反常积分：极限观点、判别法与欧拉积分",
      goal: "能判断无穷限积分与瑕积分的收敛性（比较、柯西、狄利克雷、阿贝尔判别法），分清绝对收敛与条件收敛，并会用 Γ 函数与 B 函数算积分。",
      est: 50,
      blocks: [
        {
          type: "analogy",
          title: "先把「积分到无穷」想成铺地毯",
          md: "定积分 $\\int_a^b f(x)\\,dx$ 的几何意义是「在有限宽的地毯上量面积」。反常积分（improper integral）把地毯换成两种极端情形：\n- **无穷限**：地毯一直铺到无穷远，面积只能靠截断后取极限来定义。例如 $\\int_1^{\\infty} \\frac{dx}{x^2}$ 问的是 $\\lim_{R \\to \\infty} \\int_1^R \\frac{dx}{x^2}$ 是否存在；\n- **瑕积分**：地毯在某处「破了洞」，被积函数在端点附近无界。例如 $\\int_0^1 \\frac{dx}{\\sqrt{x}}$ 在 $x = 0$ 附近高度趋于无穷，只能先对 $[\\varepsilon, 1]$ 积分，再令 $\\varepsilon \\to 0^+$。\n两种情形的共同点是：**先算有限部分，再取极限**。这正是「极限观点」——反常积分不是一种新运算，而是一个极限。物理上它回答「总能量是否有限」「总流量是否有限」这类问题：$\\int_1^{\\infty} \\frac{dx}{x}$ 发散，就意味着调和型的累积量会无限增长。"
        },
        {
          type: "concept",
          title: "两类反常积分的严格定义与柯西准则",
          md: "**定义（无穷限积分）**：设 $f$ 在每个有限区间 $[a, R]$ 上黎曼可积。若极限 $\\lim_{R \\to +\\infty} \\int_a^R f(x)\\,dx$ 存在且有限，就称 $\\int_a^{\\infty} f(x)\\,dx$ 收敛（convergent），该极限就是积分值；否则称发散（divergent）。$\\int_{-\\infty}^b f$ 类似；$\\int_{-\\infty}^{\\infty} f$ 要求 $\\int_{-\\infty}^c f$ 与 $\\int_c^{\\infty} f$ 同时收敛（$c$ 任取）。\n**定义（瑕积分）**：若 $f$ 在 $(a, b]$ 上局部可积、在 $a$ 附近无界（$a$ 称为瑕点），则定义 $\\int_a^b f(x)\\,dx = \\lim_{\\varepsilon \\to 0^+} \\int_{a+\\varepsilon}^b f(x)\\,dx$。瑕点在内部时必须拆成两段，两段都收敛才算收敛。\n**柯西准则（Cauchy criterion）**：$\\int_a^{\\infty} f$ 收敛 $\\Leftrightarrow$ 对任意 $\\varepsilon > 0$ 存在 $A > a$，使当 $A_2 > A_1 > A$ 时恒有 $\\left|\\int_{A_1}^{A_2} f(x)\\,dx\\right| < \\varepsilon$。\n它的意义在于：**收敛性只由「尾部」决定，与前面有限段的积分值无关**——这是后面所有判别法的出发点，也是「改变有限项不影响收敛性」的严格版本。\n> 直观不能代替证明：把 ∞ 当成一个很大的数代进原函数，等于默认了极限存在。牛顿-莱布尼茨公式用于反常积分时必须写成极限形式：$\\int_1^{\\infty} \\frac{dx}{x^2} = \\lim_{R \\to \\infty} \\left(1 - \\frac{1}{R}\\right) = 1$。"
        },
        {
          type: "steps",
          title: "判断一个反常积分收敛性的标准流程",
          items: [
            { t: "定类型、拆区间", d: "找出无穷限与瑕点（两者都有就拆开），每一段都按定义写成极限。瑕点在区间内部时，必须左右分别取极限。" },
            { t: "看被积函数的符号", d: "非负时走比较判别法与柯西判别法；变号时先试绝对收敛，行不通再用狄利克雷判别法或阿贝尔判别法。" },
            { t: "找控制函数或比阶", d: "无穷远处与 $\\frac{1}{x^p}$ 比阶（$p > 1$ 收敛），瑕点附近与 $\\frac{1}{(x - a)^p}$ 比阶（$p < 1$ 收敛）。" },
            { t: "写出判别依据", d: "明确写出用了哪个判别法、控制函数的积分为什么收敛，例如 $|\\sin x| \\le 1$ 给出 $\\frac{1}{x^2}$ 型控制。" },
            { t: "算值", d: "收敛后先用换元或分部积分算出有限区间上的值，再取极限，**边界项不能丢**。" },
            { t: "复核发散情形", d: "若极限为 $\\infty$ 或出现 $\\infty - \\infty$，结论是发散，不能记成 $0$ 或某个有限值。" }
          ],
          note: "顺序很重要：先用判别法断定收敛，再去算值；否则可能在发散积分上白算一场。"
        },
        {
          type: "concept",
          title: "比较判别法、柯西判别法、绝对收敛与条件收敛",
          md: "**比较判别法（comparison test）**：设 $0 \\le f(x) \\le g(x)$ 在 $[a, +\\infty)$ 上成立，两者局部可积，则 $\\int g$ 收敛 $\\Rightarrow$ $\\int f$ 收敛；$\\int f$ 发散 $\\Rightarrow$ $\\int g$ 发散。**非负条件不可省**：$f$ 变号时 $f \\le g$ 且 $\\int g$ 收敛推不出 $\\int f$ 收敛（取 $g \\equiv 0$、$f = -\\frac{1}{x}$ 即可反例）。\n**柯西判别法（Cauchy test，$p$ 判别法）**：设 $f \\ge 0$ 且 $\\lim_{x \\to \\infty} x^p f(x) = L$（$0 \\le L \\le +\\infty$）。则 $p > 1$ 且 $L < +\\infty$ 时 $\\int_a^{\\infty} f$ 收敛；$p \\le 1$ 且 $L > 0$（含 $L = +\\infty$）时发散。瑕点 $x \\to a^+$ 时把 $x^p$ 换成 $(x - a)^p$，收敛的阈值改为 $p < 1$。\n**绝对收敛与条件收敛**：若 $\\int |f|$ 收敛，称 $\\int f$ 绝对收敛（absolutely convergent），此时 $\\int f$ 必收敛；若 $\\int f$ 收敛但 $\\int |f|$ 发散，称 $\\int f$ 条件收敛（conditionally convergent）。典型例子：$\\int_1^{\\infty} \\frac{\\sin x}{x}\\,dx$ 条件收敛——狄利克雷判别法给出收敛，而 $\\int_1^T \\frac{|\\sin x|}{x}\\,dx$ 与 $\\frac{2}{\\pi} \\ln T$ 同阶，随 $T \\to \\infty$ 发散。\n**狄利克雷判别法（Dirichlet test）**：若 $F(A) = \\int_a^A f(x)\\,dx$ 关于 $A$ 有界，$g$ 单调且 $\\lim_{x \\to \\infty} g(x) = 0$，则 $\\int_a^{\\infty} f(x) g(x)\\,dx$ 收敛。\n**阿贝尔判别法（Abel test）**：若 $\\int_a^{\\infty} f$ 收敛，$g$ 单调有界，则 $\\int_a^{\\infty} f(x) g(x)\\,dx$ 收敛。\n两条判别法都不要求绝对收敛，但**都要求 $g$ 单调**（这是证明中分部积分估计的关键前提）。"
        },
        {
          type: "pitfall",
          title: "易错点：把「极限存在」当成理所当然",
          items: [
            { t: "把 $\\infty$ 当数代入原函数", d: "$\\int_1^{\\infty} \\frac{dx}{x^2}$ 要写成 $\\lim_{R \\to \\infty} \\left(1 - \\frac{1}{R}\\right) = 1$，不能因为 $\\frac{1}{x}$ 在无穷远处「像 $0$」就跳过极限；对不收敛的积分这样写会直接得到错答案。" },
            { t: "忽略瑕点", d: "$\\int_{-1}^1 \\frac{dx}{x^2}$ 在 $x = 0$ 有瑕点，按原函数 $-\\frac{1}{x}$ 代入得 $-2$，看似漂亮，其实两侧极限都发散，积分发散。" },
            { t: "比较判别法用在变号函数上", d: "$f(x) = -\\frac{1}{x} \\le g(x) = 0$ 且 $\\int g$ 收敛，但 $\\int f$ 发散；必须先验证 $0 \\le f \\le g$，或改为对 $|f|$ 使用。" },
            { t: "分部积分的边界项漏掉", d: "算 $\\int_1^{\\infty} \\frac{\\ln x}{x^2}\\,dx$ 时要完整写出 $\\left[-\\frac{\\ln x}{x} - \\frac{1}{x}\\right]$ 在 $1$ 与 $R$ 处的差再取极限，边界项趋于 $0$ 才得到 $1$。" },
            { t: "以为「收敛」就能随意拆项换序", d: "条件收敛的积分对换元、重排、交换求和与积分次序都很敏感，需要额外的一致收敛或绝对收敛条件才安全。" }
          ]
        },
        {
          type: "interactive",
          lab: "datalab",
          title: "反常积分单步演算：$\\int_0^{\\infty} x e^{-x}\\,dx$（分部积分 + 换元 + 收敛性）",
          config: {
            state: { 当前积分: "∫₀^∞ x e^(-x) dx", 方法: "先截断再取极限", 关键式子: "I(R) = ∫₀^R x e^(-x) dx", 数值: "待算", 收敛性: "待定" },
            steps: [
              { desc: "写出定义：把无限区间截成 $[0, R]$，先算 $I(R)$，再令 $R \\to \\infty$。", state: { 当前积分: "∫₀^∞ x e^(-x) dx", 方法: "极限观点（截断 + 取极限）", 关键式子: "I(R) = ∫₀^R x e^(-x) dx", 数值: "R = 5 时待算", 收敛性: "待定" }, note: "反常积分的值是 $\\lim_{R \\to \\infty} I(R)$，不是把无穷大直接代入原函数。" },
              { desc: "分部积分：取 $u = x$、$dv = e^{-x}\\,dx$，则 $du = dx$、$v = -e^{-x}$。", state: { 当前积分: "∫₀^R x e^(-x) dx", 方法: "分部积分（integration by parts）", 关键式子: "[-x e^(-x)]₀^R + ∫₀^R e^(-x) dx", 数值: "边界项 = -R e^(-R)", 收敛性: "待定" }, note: "这个边界项正是后面让整体收敛的关键，不能省。" },
              { desc: "算出余下的初等积分：$\\int_0^R e^{-x}\\,dx = 1 - e^{-R}$。", state: { 当前积分: "∫₀^R e^(-x) dx", 方法: "基本积分表", 关键式子: "1 - e^(-R)", 数值: "R = 5 → 0.9932621", 收敛性: "待定" } },
              { desc: "合并成闭式：$I(R) = 1 - (R + 1) e^{-R}$。", state: { 当前积分: "1 - (R + 1) e^(-R)", 方法: "代数合并", 关键式子: "I(R) = 1 - (R + 1) e^(-R)", 数值: "I(5) = 1 - 6 × 0.0067379 = 0.9595723", 收敛性: "待定" } },
              { desc: "让 $R$ 变大，观察 $I(R)$ 单调上升并逼近 $1$。", state: { 当前积分: "I(R)", 方法: "数值观察趋势", 关键式子: "1 - (R + 1) e^(-R)", 数值: "I(10) = 0.9995006；I(20) = 0.9999999567", 收敛性: "趋于 1" } },
              { desc: "证明尾部趋于 $0$：$(R + 1) e^{-R} \\to 0$（指数衰减快于任何多项式）。", state: { 当前积分: "(R + 1) e^(-R)", 方法: "洛必达法则（或 e^(-R) 的泰勒展开）", 关键式子: "0 < (R + 1) e^(-R) → 0", 数值: "R = 20 时尾部只剩 4.33 × 10^(-8)", 收敛性: "收敛" } },
              { desc: "取极限得结论：积分收敛，值为 1。", state: { 当前积分: "∫₀^∞ x e^(-x) dx", 方法: "取极限", 关键式子: "I = lim(R→∞) [1 - (R + 1) e^(-R)] = 1", 数值: "1", 收敛性: "收敛，值为 1" }, note: "这个积分正是 $\\Gamma(2) = 1! = 1$。" },
              { desc: "换元视角：把被积函数认成 $\\Gamma$ 函数的形状，$\\Gamma(s) = \\int_0^{\\infty} t^{s-1} e^{-t}\\,dt$，取 $s = 2$。", state: { 当前积分: "Γ(2) = ∫₀^∞ t^(2-1) e^(-t) dt", 方法: "换元 t = x（识别为欧拉积分）", 关键式子: "Γ(s) = ∫₀^∞ t^(s-1) e^(-t) dt，Γ(2) = 1! = 1", 数值: "1", 收敛性: "s > 0 时收敛；s ≤ 0 在 t → 0+ 处发散" } },
              { desc: "另一种换元技巧：用 $x = \\frac{1}{t}$ 把无穷限积分搬回有限区间。", state: { 当前积分: "∫₁^∞ x^(-2) dx", 方法: "换元 x = 1/t，dx = -dt/t²", 关键式子: "∫₁^∞ x^(-2) dx = ∫₀¹ dt = 1", 数值: "1", 收敛性: "p = 2 > 1 收敛；p = 1 时 ∫₁^∞ dx/x 发散" }, note: "换元时必须同步改写积分限与 $dx$：$x = 1 \\leftrightarrow t = 1$，$x = \\infty \\leftrightarrow t = 0^+$。" }
            ],
            tasks: [
              { t: "先自己算 $I(5)$ 与 $I(10)$，再点「下一步」核对数值。", hint: "$I(R) = 1 - (R + 1) e^{-R}$", check: "能说明 $I(R)$ 随 $R$ 单调递增且始终小于 $1$。" },
              { t: "把最后一步的 $\\Gamma(2)$ 换成 $\\Gamma(3)$，预言它的值并说明理由。", hint: "$\\Gamma(s + 1) = s \\Gamma(s)$", check: "答出 $\\Gamma(3) = 2! = 2$，即 $\\int_0^{\\infty} x^2 e^{-x}\\,dx = 2$。" },
              { t: "用 $x = \\frac{1}{t}$ 换元把 $\\int_1^{\\infty} x^{-2}\\,dx$ 化为有限区间积分，写出积分限的变化过程。", check: "得到 $\\int_0^1 dt = 1$，并指出 $x = 1$ 对应 $t = 1$、$x = \\infty$ 对应 $t = 0^+$。" }
            ]
          }
        },
        {
          type: "concept",
          title: "欧拉积分：Γ 函数与 B 函数的定义、性质与联系",
          md: "**$\\Gamma$ 函数（Gamma function）**：$\\Gamma(s) = \\int_0^{\\infty} x^{s-1} e^{-x}\\,dx$，当且仅当 $s > 0$ 时收敛（$s \\le 0$ 时被积函数在 $x \\to 0^+$ 处与 $x^{s-1}$ 同阶而发散）。基本性质：$\\Gamma(s + 1) = s\\Gamma(s)$（分部积分即得）；$\\Gamma(n + 1) = n!$；$\\Gamma\\left(\\frac{1}{2}\\right) = \\sqrt{\\pi} \\approx 1.7724538509$。\n**$B$ 函数（Beta function）**：$B(p, q) = \\int_0^1 x^{p-1} (1 - x)^{q-1}\\,dx$，$p > 0$ 且 $q > 0$ 时收敛（两个端点分别要求 $p > 0$、$q > 0$）。性质：对称性 $B(p, q) = B(q, p)$（换元 $x = 1 - t$）；递推 $B(p, q) = \\frac{p - 1}{p + q - 1} B(p - 1, q)$。\n**联系公式**：$B(p, q) = \\frac{\\Gamma(p)\\Gamma(q)}{\\Gamma(p + q)}$。证明思路：把 $\\Gamma(p)\\Gamma(q)$ 写成 $(u, v)$ 平面第一象限上的二重积分，作换元 $u = xt$、$v = x(1 - t)$（雅可比行列式为 $x$），于是 $\\Gamma(p)\\Gamma(q) = \\Gamma(p + q) \\cdot B(p, q)$。\n**$\\Gamma\\left(\\frac{1}{2}\\right) = \\sqrt{\\pi}$ 的两条路**：① 换元 $x = t^2$ 把 $\\Gamma\\left(\\frac{1}{2}\\right)$ 化为 $2\\int_0^{\\infty} e^{-t^2}\\,dt$，再用二重积分与极坐标算出 $\\int_0^{\\infty} e^{-t^2}\\,dt = \\frac{\\sqrt{\\pi}}{2}$；② 在 $B$ 中取 $p = q = \\frac{1}{2}$，换元 $x = \\sin^2\\theta$ 得 $B\\left(\\frac{1}{2}, \\frac{1}{2}\\right) = \\pi$，再由联系公式解出 $\\Gamma\\left(\\frac{1}{2}\\right) = \\sqrt{\\pi}$。\n**常用变形**：$\\int_0^{\\infty} x^{s-1} e^{-ax}\\,dx = \\frac{\\Gamma(s)}{a^s}$（$a > 0$）；$\\int_0^{\\infty} e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2} \\approx 0.8862269255$；三角有理式常通过 $x = \\sin^2\\theta$ 化为 $B$ 函数。"
        },
        {
          type: "calc",
          title: "手算演练：反常积分的值与欧拉积分",
          inputs: [
            { name: "题目 1", value: "$\\int_1^{\\infty} \\frac{dx}{x^2}$（无穷限）" },
            { name: "题目 2", value: "$\\int_0^1 \\frac{dx}{\\sqrt{x}}$（瑕积分）" },
            { name: "题目 3", value: "$\\Gamma\\left(\\frac{1}{2}\\right)$ 与 $\\int_0^{\\infty} e^{-x^2}\\,dx$" },
            { name: "题目 4", value: "$B(2, 3)$ 与 $\\int_0^1 x (1 - x)^2\\,dx$" },
            { name: "题目 5", value: "$\\int_1^{\\infty} \\frac{\\ln x}{x^2}\\,dx$" }
          ],
          outputs: [
            "1) $\\int_1^{\\infty} x^{-2}\\,dx = \\left[-\\frac{1}{x}\\right]_1^{\\infty} = 0 - (-1) = 1$（$p = 2 > 1$，收敛）",
            "2) $\\int_0^1 x^{-1/2}\\,dx = \\left[2\\sqrt{x}\\right]_0^1 = 2$（瑕点在 $x = 0$，$p = \\frac{1}{2} < 1$，收敛）",
            "3) $\\Gamma\\left(\\frac{1}{2}\\right) = \\int_0^{\\infty} x^{-1/2} e^{-x}\\,dx = \\sqrt{\\pi} \\approx 1.7724538509$；换元 $x = t^2$ 得 $\\int_0^{\\infty} e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2} \\approx 0.8862269255$",
            "4) $B(2, 3) = \\frac{\\Gamma(2)\\Gamma(3)}{\\Gamma(5)} = \\frac{1 \\times 2}{24} = \\frac{1}{12} \\approx 0.0833333$，与 $\\int_0^1 x (1 - x)^2\\,dx = \\frac{1}{12}$ 一致",
            "5) $\\int_1^{\\infty} \\frac{\\ln x}{x^2}\\,dx = \\left[-\\frac{\\ln x}{x} - \\frac{1}{x}\\right]_1^{\\infty} = 0 - (-1) = 1$",
            "对照：$\\int_1^{\\infty} \\frac{dx}{x}$ 发散（$p = 1$ 是临界），$\\int_2^{\\infty} \\frac{dx}{x \\ln x}$ 也发散（换元 $u = \\ln x$ 化为 $\\int \\frac{du}{u}$）"
          ],
          note: "全部用「先求原函数、再取极限」手算；取极限时盯住边界项，不能把 $\\infty$ 当成数。"
        },
        {
          type: "lab",
          title: "动手实验：判别法与数值验证",
          steps: [
            "用柯西判别法判断 $\\int_1^{\\infty} \\frac{x + 1}{x^3 + 2}\\,dx$：先确认被积函数非负，再算 $\\lim_{x \\to \\infty} x^2 f(x) = 1$，说明 $p = 2 > 1$ 时收敛。",
            "证明 $\\int_1^{\\infty} \\frac{\\sin x}{x}\\,dx$ 条件收敛：写出 $\\left|\\int_1^A \\sin x\\,dx\\right| \\le 2$，说明 $\\frac{1}{x}$ 单调趋于 $0$，用狄利克雷判别法；再用 $\\int_{k\\pi}^{(k+1)\\pi} \\frac{|\\sin x|}{x}\\,dx \\ge \\frac{2}{(k + 1)\\pi}$ 说明绝对值积分发散。",
            "手算 $\\int_0^{\\infty} x^2 e^{-2x}\\,dx$，并与 $\\frac{\\Gamma(3)}{2^3} = \\frac{2}{8} = 0.25$ 对照。",
            "用换元 $x = t^2$ 验证 $\\int_0^{\\infty} e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2} \\approx 0.8862269$。",
            "数值验证：用梯形法算 $\\int_0^R x e^{-x}\\,dx$（$R = 5, 10, 20$），观察它与 $1$ 的差距是否按 $(R + 1) e^{-R}$ 衰减。"
          ],
          note: "每道题都先写「用什么判别法、控制函数是谁」，再动手算值。"
        }
      ],
      quiz: [
        {
          id: "ma3-improper-integral-q1",
          type: "single",
          q: "下列反常积分中，属于条件收敛（conditionally convergent）的是哪一个？",
          options: [
            "$\\int_1^{\\infty} \\frac{\\sin x}{x}\\,dx$：它收敛，但 $\\int_1^{\\infty} \\frac{|\\sin x|}{x}\\,dx$ 发散",
            "$\\int_1^{\\infty} \\frac{dx}{x^2}$：$p = 2 > 1$",
            "$\\int_0^1 \\frac{dx}{\\sqrt{x}}$：瑕点在 $x = 0$",
            "$\\int_1^{\\infty} e^{-x}\\,dx$：被积函数非负"
          ],
          answer: 0,
          why: "条件收敛的定义是「本身收敛、绝对值积分发散」。选项 0 由狄利克雷判别法收敛（部分积分有界、$\\frac{1}{x}$ 单调趋于 $0$），而 $\\frac{|\\sin x|}{x}$ 的积分与 $\\frac{2}{\\pi} \\ln T$ 同阶发散，正合定义。其余三项被积函数非负，收敛即绝对收敛：选项 1、4 是无穷限积分，选项 2 是瑕积分，都不存在「收敛但不绝对收敛」的现象。"
        },
        {
          id: "ma3-improper-integral-q2",
          type: "fill",
          q: "$\\Gamma\\left(\\frac{1}{2}\\right) =$ ____（用根式或小数作答，小数保留三位以上有效数字）",
          answer: ["√π", "1.7725", "1.772", "1.77", "sqrt(π)", "sqrt(pi)", "根号π"],
          why: "由换元 $x = t^2$ 把 $\\Gamma\\left(\\frac{1}{2}\\right)$ 化为 $2\\int_0^{\\infty} e^{-t^2}\\,dt$，而 $\\int_0^{\\infty} e^{-t^2}\\,dt = \\frac{\\sqrt{\\pi}}{2}$（用二重积分与极坐标算出），所以 $\\Gamma\\left(\\frac{1}{2}\\right) = \\sqrt{\\pi} \\approx 1.7724539$。这条恒等式是欧拉积分最常用的入口，配合 $\\Gamma(s + 1) = s\\Gamma(s)$ 可得到 $\\Gamma\\left(\\frac{3}{2}\\right) = \\frac{\\sqrt{\\pi}}{2} \\approx 0.8862269$。"
        },
        {
          id: "ma3-improper-integral-q3",
          type: "single",
          q: "关于反常积分的判别法，下列说法中错误的是哪一项？",
          options: [
            "若 $0 \\le f(x) \\le g(x)$ 且 $\\int g$ 收敛，则 $\\int f$ 收敛",
            "若 $0 \\le f(x) \\le g(x)$ 且 $\\int f$ 发散，则 $\\int g$ 发散",
            "只要 $f(x) \\le g(x)$ 且 $\\int g$ 收敛，就能推出 $\\int f$ 收敛，$f$ 不必非负",
            "柯西判别法中 $\\int_1^{\\infty} \\frac{dx}{x^p}$ 在 $p > 1$ 时收敛、$p \\le 1$ 时发散"
          ],
          answer: 2,
          why: "选项 2 丢掉了非负条件：取 $g(x) = 0$（$\\int g = 0$ 收敛）与 $f(x) = -\\frac{1}{x}$，有 $f \\le g$，但 $\\int_1^{\\infty} \\left(-\\frac{1}{x}\\right) dx$ 发散，所以 $f \\le g$ 单独不足以保证收敛，必须先有 $0 \\le f \\le g$ 或对 $|f|$ 使用判别法。选项 0、1 是比较判别法的两种用法（小控大得收敛、大控小反向推发散），选项 3 是柯西判别法的基准事实，p = 1 恰是临界情形。"
        },
        {
          id: "ma3-improper-integral-q4",
          type: "order",
          q: "把「证明 $\\int_1^{\\infty} \\frac{\\sin x}{x}\\,dx$ 条件收敛」的步骤排成正确顺序。",
          items: [
            "由狄利克雷判别法得出 $\\int_1^{\\infty} \\frac{\\sin x}{x}\\,dx$ 收敛",
            "确认 $\\int_1^A \\sin x\\,dx$ 关于 $A$ 一致有界，例如 $\\left|\\int_1^A \\sin x\\,dx\\right| \\le 2$",
            "得出「收敛但不绝对收敛」，即条件收敛",
            "说明 $g(x) = \\frac{1}{x}$ 在 $[1, +\\infty)$ 上单调递减且趋于 $0$",
            "证明绝对值积分发散：$\\int_1^T \\frac{|\\sin x|}{x}\\,dx \\ge c \\ln T \\to \\infty$"
          ],
          answer: [3, 1, 0, 4, 2],
          why: "正确顺序是先核对 g 的单调性与极限（第 4 项），再核对部分积分的有界性（第 2 项），两条前提齐备后才能引用狄利克雷判别法（第 1 项）；随后用周期估计证明绝对值积分发散（第 5 项），最后合起来得到条件收敛的结论（第 3 项）。反过来先下结论再补条件，或者用比较判别法处理变号函数，都是常见错误。"
        }
      ]
    },

    /* ==================================================================== 第 2 讲 */
    {
      id: "ma3-param-integral",
      title: "含参变量积分：一致收敛与欧拉积分技巧",
      goal: "掌握含参积分连续、可微、可积的条件与证明思路，会用魏尔斯特拉斯判别法判断一致收敛，并能用莱布尼茨法则算出狄利克雷积分。",
      est: 55,
      blocks: [
        {
          type: "analogy",
          title: "参数就是旋钮：读数会不会跳变、变化有多快",
          md: "含参变量积分（integral with a parameter）把积分值看成参数的函数：$F(y) = \\int_a^b f(x, y)\\,dx$。把 $f$ 想成「随旋钮 $y$ 变化的被积函数」，F(y) 就是读数盘上的数。工程上关心两件事：\n- 轻轻转动旋钮，读数会不会跳变？这就是 **$F$ 的连续性**；\n- 转动一点，读数变化多快？这就是 **$F$ 的可导性**，也就是「导数能不能搬进积分号」。\n物理原型来自热传导与势论：$F(y) = \\int_0^{\\infty} e^{-xy}\\,dx$ 在 $y > 0$ 上等于 $\\frac{1}{y}$，而当 $y \\to 0^+$ 时读数爆炸到 $\\infty$。同一个积分，参数取值范围不同，性质就完全不同。含参积分理论的主线就是一句话：**什么时候可以把极限、求导、积分与积分号交换次序**。\n> 结论先行：逐点收敛不够用，需要**一致收敛**（uniform convergence）才能安全换序。"
        },
        {
          type: "concept",
          title: "含参正常积分的三条定理：条件、证明思路与变限修正",
          md: "**定理 1（连续性）**：设 $f(x, y)$ 在矩形 $[a, b] \\times [c, d]$ 上连续，则 $F(y) = \\int_a^b f(x, y)\\,dx$ 在 $[c, d]$ 上连续。证明思路：闭矩形上连续 $\\Rightarrow$ 一致连续，于是 $|f(x, y) - f(x, y_0)| < \\varepsilon$ 对**所有 $x$ 同时**成立，积分后得 $|F(y) - F(y_0)| \\le \\varepsilon (b - a)$。注意用的是「一致」连续，不是逐点连续。\n**定理 2（可微性，莱布尼茨法则 Leibniz rule）**：若 $f$ 与 $\\frac{\\partial f}{\\partial y}$ 都在 $[a, b] \\times [c, d]$ 上连续，则 $F$ 在 $(c, d)$ 上可导且 $F'(y) = \\int_a^b \\frac{\\partial f}{\\partial y}(x, y)\\,dx$。证明思路：对 $F(y + h) - F(y)$ 在 $y$ 方向用拉格朗日中值定理写成 $h \\cdot \\frac{\\partial f}{\\partial y}(x, \\xi)$，再对 $x$ 积分；$\\frac{\\partial f}{\\partial y}$ 的一致连续性保证余项一致趋于 $0$。条件里「$\\frac{\\partial f}{\\partial y}$ 连续」不可省。\n**定理 3（可积性，交换积分次序）**：在定理 1 的条件下 $\\int_c^d F(y)\\,dy = \\int_a^b \\left(\\int_c^d f(x, y)\\,dy\\right) dx$。证明思路：两边都是二重积分的累次积分，用达布和（或富比尼定理）说明它们相等。\n**变限情形（最容易漏项）**：若 $F(y) = \\int_{a(y)}^{b(y)} f(x, y)\\,dx$，则 $F'(y) = \\int_{a(y)}^{b(y)} \\frac{\\partial f}{\\partial y}\\,dx + f(b(y), y) b'(y) - f(a(y), y) a'(y)$。多出来的两项来自上下限随参数移动，只写第一项必错。"
        },
        {
          type: "steps",
          title: "使用莱布尼茨法则的六步核查",
          items: [
            { t: "划出参数的取值区间", d: "先确认积分对哪些 $y$ 收敛、有意义，例如 $\\int_0^{\\infty} e^{-xy}\\,dx$ 只在 $y > 0$ 上有定义。" },
            { t: "核对定理条件", d: "正常积分要求 $f$ 与 $\\frac{\\partial f}{\\partial y}$ 在闭矩形上连续；反常积分要求在参数的每个紧子区间上 $\\int \\frac{\\partial f}{\\partial y}\\,dx$ 一致收敛。" },
            { t: "形式求导并找控制函数", d: "写出 $\\frac{\\partial f}{\\partial y}(x, y)$，寻找与 $y$ 无关的 $M(x)$ 使 $\\left|\\frac{\\partial f}{\\partial y}\\right| \\le M(x)$ 且 $\\int M$ 收敛。" },
            { t: "分别算出两个积分", d: "把 F(y)（或直接对 F'(y)）算出来并化简，边界项与符号都要写清。" },
            { t: "用初等办法交叉验证", d: "例如 $F(y) = \\frac{1}{y}$ 直接求导得 $-\\frac{1}{y^2}$，应与 $\\int_0^{\\infty} (-x) e^{-xy}\\,dx = -\\frac{1}{y^2}$ 完全一致。" },
            { t: "标明结论成立的区间", d: "写清是开区间还是紧子区间；不要把端点（如 $y \\to 0^+$）也写进可导范围。" }
          ],
          note: "把「条件 → 形式求导 → 控制函数 → 验证」四件事写在卷面上，比只写一个公式安全得多。"
        },
        {
          type: "concept",
          title: "一致收敛、魏尔斯特拉斯判别法与含参反常积分的性质",
          md: "**一致收敛（uniform convergence）的定义**：设 $F(y) = \\int_a^{\\infty} f(x, y)\\,dx$ 对每个 $y \\in Y$ 收敛。若对任意 $\\varepsilon > 0$ 存在 $A > a$（**只依赖 $\\varepsilon$，与 $y$ 无关**），使当 $A' > A$ 时 $\\left|\\int_{A'}^{\\infty} f(x, y)\\,dx\\right| < \\varepsilon$ 对**所有** $y \\in Y$ 同时成立，就称积分在 $Y$ 上一致收敛。等价说法：$\\sup_{y \\in Y} \\left|\\int_A^{\\infty} f(x, y)\\,dx\\right| \\to 0$（$A \\to \\infty$）。**逐点收敛是「每个 $y$ 各有一个 $A$」，一致收敛是「所有人共用一个 $A$」。**\n**魏尔斯特拉斯判别法（Weierstrass M-test）**：若 $|f(x, y)| \\le M(x)$ 对所有 $y \\in Y$ 成立，且 $\\int_a^{\\infty} M(x)\\,dx$ 收敛，则 $\\int_a^{\\infty} f(x, y)\\,dx$ 在 $Y$ 上一致收敛。这是最常用的充分条件，本质是「用控制函数把参数消掉」。\n**一致收敛带来的三条性质**：① $f$ 连续 + 积分一致收敛 $\\Rightarrow$ $F$ 连续；② $f$ 与 $\\frac{\\partial f}{\\partial y}$ 连续 + $\\int \\frac{\\partial f}{\\partial y}\\,dx$ 一致收敛 $\\Rightarrow$ $F'(y) = \\int \\frac{\\partial f}{\\partial y}\\,dx$；③ 一致收敛时极限与积分可交换次序。\n**含参反常积分的狄利克雷判别法**：若 $\\int_a^A f(x, y)\\,dx$ 关于 $A$ 一致有界，$g(x, y)$ 关于 $x$ 单调且当 $x \\to \\infty$ 时一致趋于 $0$，则 $\\int_a^{\\infty} f g\\,dx$ 在 $Y$ 上一致收敛。这是处理 $\\int_0^{\\infty} e^{-xy} \\sin x\\,dx$ 一类积分的标准工具。\n> 反例（逐点不够）：$F(y) = \\int_0^{\\infty} y e^{-xy}\\,dx = 1$（$y > 0$），但 $F(0) = 0$，函数在 $y = 0$ 处间断。原因是尾部 $\\int_A^{\\infty} y e^{-xy}\\,dx = e^{-Ay}$，它关于 $y > 0$ 的上确界为 $1$（$y \\to 0^+$ 时取到），不趋于 $0$，故不一致收敛。"
        },
        {
          type: "pitfall",
          title: "易错点：换序之前先问「凭什么」",
          items: [
            { t: "无条件把求导搬进积分号", d: "$F(y) = \\int_0^{\\infty} e^{-xy}\\,dx$ 在 $y > 0$ 可导，但 $y = 0$ 处积分本身发散；必须在参数的紧子区间上用魏尔斯特拉斯判别法证明 $\\int \\frac{\\partial f}{\\partial y}\\,dx$ 一致收敛，才能写 $F'(y) = \\int \\frac{\\partial f}{\\partial y}\\,dx$。" },
            { t: "漏掉变限积分的边界项", d: "对 $F(y) = \\int_0^y f(x, y)\\,dx$ 求导必须写成 $\\int_0^y \\frac{\\partial f}{\\partial y}\\,dx + f(y, y)$，只写前一项就少了一整块。" },
            { t: "用逐点收敛冒充一致收敛", d: "$\\int_0^{\\infty} y e^{-xy}\\,dx$ 对每个 $y > 0$ 都收敛且值为 $1$，但尾部 $e^{-Ay}$ 关于 $y$ 的上确界恒为 $1$，所以不一致收敛，极限函数在 $y = 0$ 处间断。" },
            { t: "忘记一致收敛是局部性质", d: "$\\int_0^{\\infty} e^{-xy}\\,dx$ 在 $(0, +\\infty)$ 上不一致收敛，却在任意 $[y_0, +\\infty)$（$y_0 > 0$）上一致收敛；结论要写在正确的区间上。" },
            { t: "交换累次积分次序不看条件", d: "重积分换序需要可积性（富比尼定理）或含参积分的一致收敛，把两个无穷限累次积分随意对调是错误的高发区。" }
          ]
        },
        {
          type: "interactive",
          lab: "datalab",
          title: "含参积分求导单步演算：$F(a) = \\int_0^{\\infty} e^{-ax}\\,dx$（莱布尼茨法则）",
          config: {
            state: { 参数a: "a > 0", 被积函数: "f(x, a) = e^(-a x)", 积分值F: "待算", F的数值: "待算", 求导后的被积函数: "∂f/∂a = -x e^(-a x)", 导数Fp: "待算", 条件与说明: "a ≤ 0 时积分发散，参数区间必须先划清" },
            steps: [
              { desc: "先确定参数范围：$F(a) = \\int_0^{\\infty} e^{-ax}\\,dx$ 只在 $a > 0$ 时收敛。", state: { 参数a: "a > 0", 被积函数: "f(x, a) = e^(-a x)", 积分值F: "待算", F的数值: "待算", 求导后的被积函数: "∂f/∂a = -x e^(-a x)", 导数Fp: "待算", 条件与说明: "a ≤ 0 时 ∫₀^∞ e^(-a x) dx 发散，必须先划清参数范围" } },
              { desc: "用初等办法算 $F(a)$：先算 $\\int_0^R e^{-ax}\\,dx = \\frac{1 - e^{-aR}}{a}$，再令 $R \\to \\infty$。", state: { 参数a: "a = 0.5", 被积函数: "e^(-0.5 x)", 积分值F: "1/a = 2", F的数值: "2", 求导后的被积函数: "-x e^(-0.5 x)", 导数Fp: "-1/a² = -4", 条件与说明: "F(a) = 1/a 是初等结果，可作为检验标准" } },
              { desc: "核对莱布尼茨法则的核：$\\frac{\\partial f}{\\partial a} = -x e^{-ax}$，在 $a = 1$ 处积分应等于 $-1$。", state: { 参数a: "a = 1", 被积函数: "e^(-x)", 积分值F: "1", F的数值: "1", 求导后的被积函数: "-x e^(-x)", 导数Fp: "-1", 条件与说明: "∫₀^∞ x e^(-x) dx = 1（即 Γ(2) = 1）" } },
              { desc: "取 $a = 2$ 再算一遍：$F(2) = 0.5$，$F'(2) = -0.25$。", state: { 参数a: "a = 2", 被积函数: "e^(-2 x)", 积分值F: "1/a = 0.5", F的数值: "0.5", 求导后的被积函数: "-x e^(-2 x)", 导数Fp: "-1/a² = -0.25", 条件与说明: "∫₀^∞ x e^(-2 x) dx = 1/4 = 0.25，与公式一致（数值积分已核对）" } },
              { desc: "取 $a = 3$：$F(3) = \\frac{1}{3} \\approx 0.3333333$，$F'(3) = -\\frac{1}{9} \\approx -0.1111111$。", state: { 参数a: "a = 3", 被积函数: "e^(-3 x)", 积分值F: "1/a = 0.3333333", F的数值: "0.3333333", 求导后的被积函数: "-x e^(-3 x)", 导数Fp: "-1/a² = -0.1111111", 条件与说明: "∫₀^∞ x e^(-3 x) dx = 1/9 ≈ 0.1111111" } },
              { desc: "写清可导性的依据：在 $[a_0, +\\infty)$（$a_0 > 0$）上用控制函数证明一致收敛。", state: { 参数a: "a ≥ a₀ > 0", 被积函数: "-x e^(-a x)", 积分值F: "1/a", F的数值: "随 a 变化", 求导后的被积函数: "|-x e^(-a x)| ≤ x e^(-a₀ x)", 导数Fp: "-1/a²", 条件与说明: "魏尔斯特拉斯判别法：∫₀^∞ x e^(-a₀ x) dx = 1/a₀² 收敛，故 ∫ (∂f/∂a) dx 在 [a₀, +∞) 上一致收敛" } },
              { desc: "换一个含参积分：$F(a) = \\int_0^1 x^a\\,dx = \\frac{1}{a + 1}$，这是正常积分，条件更宽松。", state: { 参数a: "a = 3", 被积函数: "x^a（在 [0, 1] 上有界）", 积分值F: "1/(a + 1) = 0.25", F的数值: "0.25", 求导后的被积函数: "x^a ln x", 导数Fp: "-1/(a + 1)² = -0.0625", 条件与说明: "f 与 ∂f/∂a 在 [0, 1] × [0, 5] 上连续 ⇒ 直接可用莱布尼茨法则" } },
              { desc: "反面提醒：$a \\to 0^+$ 时 $F(a) = \\frac{1}{a} \\to \\infty$，这个参数值不能写进可导区间。", state: { 参数a: "a → 0+", 被积函数: "e^(-a x)", 积分值F: "1/a → ∞", F的数值: "发散", 求导后的被积函数: "-x e^(-a x)", 导数Fp: "-1/a² → -∞", 条件与说明: "结论只在 a > 0 的紧子区间上成立；含 0 的区间上积分不一致收敛" } }
            ],
            tasks: [
              { t: "先在草稿纸上算 $F(2)$ 与 $F'(2)$，再逐步核对第 4 步。", check: "得到 $F(2) = 0.5$、$F'(2) = -0.25$，并说明 $F'(2)$ 也等于 $-\\int_0^{\\infty} x e^{-2x}\\,dx$。" },
              { t: "说明第 6 步的控制函数为什么能保证「求导与积分可交换」。", hint: "魏尔斯特拉斯判别法要求 $\\left|\\frac{\\partial f}{\\partial a}\\right| \\le M(x)$ 且 $\\int M$ 收敛", check: "能写出 $M(x) = x e^{-a_0 x}$ 并指出 $\\int_0^{\\infty} M\\,dx = \\frac{1}{a_0^2}$ 收敛。" },
              { t: "把第 7 步的参数换成 $a = 1$，验证 $\\int_0^1 x \\ln x\\,dx = -\\frac{1}{4}$。", check: "得到 $-\\frac{1}{(1 + 1)^2} = -0.25$。" }
            ]
          }
        },
        {
          type: "concept",
          title: "欧拉积分技巧与狄利克雷积分的计算",
          md: "**欧拉积分回顾**：$\\Gamma(s) = \\int_0^{\\infty} x^{s-1} e^{-x}\\,dx$ 与 $B(p, q) = \\int_0^1 x^{p-1} (1 - x)^{q-1}\\,dx$ 本身就是含参积分，前面的一般理论正是它们「连续、可导、可换序」的依据。\n**指数型积分的两个公式**（$a > 0$）：$\\int_0^{\\infty} e^{-ax} \\cos(bx)\\,dx = \\frac{a}{a^2 + b^2}$，$\\int_0^{\\infty} e^{-ax} \\sin(bx)\\,dx = \\frac{b}{a^2 + b^2}$。可以用两次分部积分直接算出，也可以把 $a$ 看成参数、用莱布尼茨法则从 $\\int_0^{\\infty} e^{-ax}\\,dx = \\frac{1}{a}$ 求导验证。\n**狄利克雷积分（Dirichlet integral）$\\int_0^{\\infty} \\frac{\\sin x}{x}\\,dx = \\frac{\\pi}{2}$ 的标准推导**：引入收敛因子 $e^{-ax}$（$a > 0$），令 $F(a) = \\int_0^{\\infty} e^{-ax} \\frac{\\sin x}{x}\\,dx$。控制函数 $\\left|e^{-ax} \\frac{\\sin x}{x}\\right| \\le e^{-a_0 x}$ 且 $\\int e^{-a_0 x}\\,dx$ 收敛，故可用莱布尼茨法则：$F'(a) = -\\int_0^{\\infty} e^{-ax} \\sin x\\,dx = -\\frac{1}{1 + a^2}$。于是 $F(a) = -\\arctan a + C$；由 $a \\to +\\infty$ 时 $F(a) \\to 0$ 定出 $C = \\frac{\\pi}{2}$；再令 $a \\to 0^+$（这一步需要一致收敛或阿贝尔型定理）得 $\\int_0^{\\infty} \\frac{\\sin x}{x}\\,dx = \\frac{\\pi}{2} \\approx 1.5707963$。\n**常用技巧清单**：① 乘收敛因子 $e^{-ax}$ 再求导；② 换元把参数搬进指数（$x = \\frac{t}{y}$）；③ 化为 $B$ 函数（$x = \\sin^2\\theta$ 或 $x = \\frac{t}{1 + t}$）；④ 两次分部积分；⑤ 利用对称性 $B(p, q) = B(q, p)$ 配对；⑥ 利用 $\\frac{\\Gamma(s)}{a^s}$ 与 Frullani 型公式。"
        },
        {
          type: "calc",
          title: "手算演练：含参积分求导、欧拉积分与狄利克雷积分",
          inputs: [
            { name: "题目 1", value: "$F(a) = \\int_0^{\\infty} e^{-ax}\\,dx$，求 $F'(a)$ 并取 $a = 2$" },
            { name: "题目 2", value: "$\\int_0^1 x^3 \\ln x\\,dx$" },
            { name: "题目 3", value: "$\\int_0^{\\infty} e^{-2x} \\cos x\\,dx$" },
            { name: "题目 4", value: "狄利克雷积分 $\\int_0^{\\infty} \\frac{\\sin x}{x}\\,dx$" },
            { name: "题目 5", value: "$\\int_0^{\\infty} \\frac{e^{-x} - e^{-2x}}{x}\\,dx$" }
          ],
          outputs: [
            "1) $F(a) = \\frac{1}{a}$（$a > 0$）；形式求导得 $F'(a) = -\\int_0^{\\infty} x e^{-ax}\\,dx = -\\frac{1}{a^2}$。$a = 2$ 时 $F = 0.5$、$F' = -0.25$，而 $\\int_0^{\\infty} x e^{-2x}\\,dx = \\frac{1}{4} = 0.25$，两者一致",
            "2) 用 $F(a) = \\int_0^1 x^a\\,dx = \\frac{1}{a + 1}$ 对 $a$ 求导：$F'(a) = \\int_0^1 x^a \\ln x\\,dx = -\\frac{1}{(a + 1)^2}$；取 $a = 3$ 得 $-\\frac{1}{16} = -0.0625$",
            "3) 用公式 $\\int_0^{\\infty} e^{-ax} \\cos(bx)\\,dx = \\frac{a}{a^2 + b^2}$，取 $a = 2$、$b = 1$ 得 $\\frac{2}{5} = 0.4$",
            "4) 先算 $\\int_0^{\\infty} e^{-ax} \\sin x\\,dx = \\frac{1}{1 + a^2}$，再对 $a$ 积分并用 $a \\to \\infty$ 定常数，得 $\\frac{\\pi}{2} \\approx 1.5707963$",
            "5) Frullani 型：$\\int_0^{\\infty} \\frac{e^{-x} - e^{-2x}}{x}\\,dx = \\ln 2 \\approx 0.6931472$",
            "对照：$\\int_0^{\\infty} e^{-2x} \\sin x\\,dx = \\frac{1}{5} = 0.2$；$\\int_0^1 x^3 \\ln x\\,dx$ 与 $-\\frac{1}{16}$ 的关系说明「求导移入积分号」是把对数因子变成代数因子的常用手法"
          ],
          note: "每一步「求导或取极限移入积分号」都要先写出一致收敛的依据（控制函数），再写等式。"
        },
        {
          type: "lab",
          title: "动手实验：一致收敛与数值对照",
          steps: [
            "用魏尔斯特拉斯判别法证明 $\\int_0^{\\infty} e^{-xy} \\sin x\\,dx$ 在参数区间 $[1, 2]$ 上一致收敛：控制函数取 $e^{-x}$。",
            "验证 $F(a) = \\int_0^{\\infty} e^{-ax}\\,dx = \\frac{1}{a}$ 与 $F'(a) = -\\int_0^{\\infty} x e^{-ax}\\,dx = -\\frac{1}{a^2}$，在 $a = 1, 2, 3$ 处把数值积分与解析值逐点对照。",
            "算 $\\int_0^1 x^3 \\ln x\\,dx$：从 $\\int_0^1 x^a\\,dx = \\frac{1}{a + 1}$ 出发对 $a$ 求导，取 $a = 3$ 得 $-\\frac{1}{16}$。",
            "把狄利克雷积分的推导补完整：写出 $F'(a)$、积分得 $F(a)$、用 $a \\to +\\infty$ 定常数、最后取 $a \\to 0^+$。",
            "用数值积分算 $\\int_0^T \\frac{\\sin x}{x}\\,dx$（$T = 10, 100, 1000$），观察它以振荡方式逼近 $\\frac{\\pi}{2}$，而不是单调逼近。"
          ],
          note: "数值只作验证：先有解析结果，再用数值确认，不要用数值代替一致性条件的检查。"
        }
      ],
      quiz: [
        {
          id: "ma3-param-integral-q1",
          type: "single",
          q: "关于含参反常积分的一致收敛（uniform convergence），下列说法正确的是？",
          options: [
            "一致收敛指存在与参数无关的 $A$，使 $A$ 之后所有参数的积分尾部都小于 $\\varepsilon$，即收敛速度对参数一致",
            "只要每个参数值下积分都收敛，就必然一致收敛",
            "一致收敛只是记号上的方便，与 F 的连续性和可导性无关",
            "魏尔斯特拉斯判别法要求控制函数满足 $\\int M(x)\\,dx$ 发散"
          ],
          answer: 0,
          why: "选项 0 就是定义：$A$ 只依赖 $\\varepsilon$ 而与 $y$ 无关，等价于 $\\sup_{y \\in Y} \\left|\\int_A^{\\infty} f\\,dx\\right| \\to 0$。选项 1 错在把逐点收敛当成一致收敛，反例是 $\\int_0^{\\infty} y e^{-xy}\\,dx$：每个 $y > 0$ 都收敛到 $1$，但尾部 $e^{-Ay}$ 的上确界恒为 $1$，$F$ 在 $y = 0$ 处间断。选项 2 错：一致收敛正是连续性、可导性与换序的通行证。选项 3 把条件说反了，魏尔斯特拉斯判别法要求 $\\int M$ 收敛。"
        },
        {
          id: "ma3-param-integral-q2",
          type: "multi",
          q: "要用莱布尼茨法则把求导移入积分号，即写成 $F'(y) = \\int_a^b \\frac{\\partial f}{\\partial y}(x, y)\\,dx$，需要哪些条件？",
          options: [
            "$f(x, y)$ 在矩形 $[a, b] \\times [c, d]$ 上连续",
            "$\\frac{\\partial f}{\\partial y}$ 在矩形上连续；若是含参反常积分，则要求 $\\int \\frac{\\partial f}{\\partial y}\\,dx$ 在参数的紧子区间上一致收敛",
            "积分上下限与参数无关；若上下限依赖参数，还要补上两个边界项 $f(b(y), y) b'(y) - f(a(y), y) a'(y)$",
            "$f$ 关于 $x$ 单调"
          ],
          answer: [0, 1, 2],
          why: "定理 2 的条件正是「$f$ 连续 + $\\frac{\\partial f}{\\partial y}$ 连续」，而含参反常积分情形要把 $\\frac{\\partial f}{\\partial y}$ 的连续性升级为 $\\int \\frac{\\partial f}{\\partial y}\\,dx$ 的一致收敛（通常用魏尔斯特拉斯判别法验证）。上下限依赖参数时，导数公式必须补边界项，这是漏项最多的地方。选项 4 是多余条件：单调性与求导换序无关，它出现在狄利克雷判别法里是用来处理含参反常积分的收敛性，而不是可微性。"
        },
        {
          id: "ma3-param-integral-q3",
          type: "fill",
          q: "狄利克雷积分 $\\int_0^{\\infty} \\frac{\\sin x}{x}\\,dx =$ ____（写成 $\\pi$ 的倍数，或给出三位以上有效数字）",
          answer: ["π/2", "pi/2", "1.5708", "1.571", "1.5707963"],
          why: "引入收敛因子 $e^{-ax}$ 后 $F(a) = \\int_0^{\\infty} e^{-ax} \\frac{\\sin x}{x}\\,dx$ 满足 $F'(a) = -\\frac{1}{1 + a^2}$，故 $F(a) = -\\arctan a + C$；由 $a \\to +\\infty$ 时 $F(a) \\to 0$ 得 $C = \\frac{\\pi}{2}$，再令 $a \\to 0^+$ 得 $\\frac{\\pi}{2} \\approx 1.5707963$。这个积分条件收敛，绝对值积分发散，所以不能拆成两个绝对收敛的积分来处理。"
        },
        {
          id: "ma3-param-integral-q4",
          type: "single",
          q: "关于 $F(y) = \\int_0^{\\infty} e^{-xy}\\,dx$ 的求导，下列做法中错误的是？",
          options: [
            "先算出 $F(y) = \\frac{1}{y}$（$y > 0$），直接求导得 $F'(y) = -\\frac{1}{y^2}$",
            "形式上把求导移入积分号，得 $F'(y) = -\\int_0^{\\infty} x e^{-xy}\\,dx = -\\frac{1}{y^2}$",
            "对 $y \\ge 0$ 的任意值都能套用该求导公式，包括 $y = 0$",
            "用控制函数 $x e^{-xy} \\le x e^{-y_0 x}$（$y \\ge y_0 > 0$）说明 $\\int \\frac{\\partial f}{\\partial y}\\,dx$ 在 $[y_0, +\\infty)$ 上一致收敛"
          ],
          answer: 2,
          why: "$y = 0$ 时 $\\int_0^{\\infty} e^{-x \\cdot 0}\\,dx = \\int_0^{\\infty} 1\\,dx$ 发散，函数本身没有定义，谈不上可导；一致收敛的论证只能在参数的一个紧子区间 $[y_0, +\\infty)$（$y_0 > 0$）上进行，再令 $y_0 \\to 0^+$ 时结论也不再保留。选项 0 是先算原函数再求导，选项 1 是莱布尼茨法则，两者结果一致（$-\\frac{1}{y^2}$），选项 3 正是所需要的控制函数论证，都是正确做法。"
        }
      ]
    },

    /* ==================================================================== 第 3 讲 */
    {
      id: "ma3-field",
      title: "曲线积分与场：梯度、散度、旋度与格林公式",
      goal: "理解三种微分算子的物理意义，掌握保守场的等价条件与势函数求法，能计算第二类曲线积分并用格林公式把曲线积分与二重积分互相转化。",
      est: 60,
      blocks: [
        {
          type: "analogy",
          title: "功、环量与势能：向量场的三张面孔",
          md: "把向量场（vector field）想成风场或水流：每一点都插着一支箭头，$\\mathbf{F}(x, y)$ 就是该点的流速。于是有三种问题：\n- 沿一条曲线推着物体走要做多少功？这是第二类曲线积分 $\\int_L P\\,dx + Q\\,dy$，物理上就是 $\\int_L \\mathbf{F} \\cdot d\\mathbf{r}$；\n- 沿闭合回路走一圈回到原处，净功是多少？这是环量（circulation）$\\oint_L \\mathbf{F} \\cdot d\\mathbf{r}$，衡量场的「旋转倾向」；\n- 箭头是「从某处冒出来」还是「绕圈流动」？前者由散度（divergence）刻画，后者由旋度（curl）刻画。\n最省力的场是**保守场（conservative field）**：像重力场、静电场那样，做功只与起点终点有关，绕一圈净功为零，于是可以定义势能函数（potential）。爬山时沿等高线走不费劲，因为位移与梯度垂直——这正是「无旋」的几何图像：**没有绕圈的分量，就没有环量**。"
        },
        {
          type: "concept",
          title: "数量场、向量场与梯度 / 散度 / 旋度",
          md: "**数量场与向量场**：数量场是标量函数 $f(x, y, z)$（温度、电位），向量场是向量值函数 $\\mathbf{F} = (P, Q, R)$（流速、电场、磁场）。\n**梯度（gradient）**：$\\nabla f = (f_x, f_y, f_z)$。物理意义：方向导数 $D_{\\mathbf{u}} f = \\nabla f \\cdot \\mathbf{u}$ 在 $\\mathbf{u} = \\frac{\\nabla f}{|\\nabla f|}$ 时取最大值 $|\\nabla f|$，所以梯度指向函数增长最快的方向，且垂直于等值面。\n**散度（divergence）**：$\\operatorname{div} \\mathbf{F} = \\nabla \\cdot \\mathbf{F} = \\frac{\\partial P}{\\partial x} + \\frac{\\partial Q}{\\partial y} + \\frac{\\partial R}{\\partial z}$。物理意义：单位体积内「源」的强度（通量的体密度）。$\\nabla \\cdot \\mathbf{F} > 0$ 的点像水龙头，$\\nabla \\cdot \\mathbf{F} = 0$ 的场称为无源场（solenoidal）。\n**旋度（curl）**：$\\operatorname{curl} \\mathbf{F} = \\nabla \\times \\mathbf{F} = \\left(\\frac{\\partial R}{\\partial y} - \\frac{\\partial Q}{\\partial z},\\ \\frac{\\partial P}{\\partial z} - \\frac{\\partial R}{\\partial x},\\ \\frac{\\partial Q}{\\partial x} - \\frac{\\partial P}{\\partial y}\\right)$。物理意义：单位面积上最大的环量，等于微元刚体转动角速度的两倍。$\\nabla \\times \\mathbf{F} = \\mathbf{0}$ 的场称为无旋场（irrotational）。\n**平面情形**：$\\mathbf{F} = (P, Q)$ 时旋度退化为标量 $\\frac{\\partial Q}{\\partial x} - \\frac{\\partial P}{\\partial y}$，它正是格林公式右端的被积函数。\n**两个恒等式**：$\\nabla \\times (\\nabla f) = \\mathbf{0}$（梯度场必无旋）与 $\\nabla \\cdot (\\nabla \\times \\mathbf{F}) = 0$（旋度场必无源）。两者按定义展开即可验证，前提是二阶偏导连续（混合偏导相等）。"
        },
        {
          type: "concept",
          title: "保守场的等价条件、单连通条件与势函数求法（含易错点）",
          md: "**定义**：若存在数量场 $\\varphi$ 使 $\\mathbf{F} = \\nabla \\varphi$，则称 $\\mathbf{F}$ 是保守场（梯度场），$\\varphi$ 称为势函数（potential function）。\n**四个等价条件**（$\\Omega$ 为开区域，$\\mathbf{F}$ 的分量有连续偏导）：\n1. $\\mathbf{F} = \\nabla \\varphi$，存在势函数；\n2. $\\Omega$ 内任意两点的 $\\int_L \\mathbf{F} \\cdot d\\mathbf{r}$ 与路径无关，只依赖起终点；\n3. $\\Omega$ 内任意闭曲线的 $\\oint_L \\mathbf{F} \\cdot d\\mathbf{r} = 0$；\n4. $\\nabla \\times \\mathbf{F} = \\mathbf{0}$（无旋）。\n**关键提醒**：1、2、3 彼此等价不需要额外条件；但 $4 \\Rightarrow 1$ 需要 **$\\Omega$ 单连通（simply connected）**，即区域内任意闭曲线都能在区域内连续收缩成一点。反例：$\\mathbf{F} = \\left(-\\frac{y}{x^2 + y^2}, \\frac{x}{x^2 + y^2}\\right)$ 在 $\\mathbb{R}^2$ 去掉原点后的区域上处处满足 $\\frac{\\partial Q}{\\partial x} = \\frac{\\partial P}{\\partial y}$（无旋），但沿单位圆的环量是 $2\\pi \\ne 0$，所以不是保守场——它其实是极角 $\\theta$ 的梯度，而 $\\theta$ 是多值函数，洞破坏了单连通性。\n**求势函数的两条路线**：\n- 曲线积分法：固定基点 $O$，$\\varphi(x, y, z) = \\int_O^{(x,y,z)} \\mathbf{F} \\cdot d\\mathbf{r}$，沿坐标轴折线算（保守时与路径无关）；\n- 偏积分法（手算首选）：由 $\\frac{\\partial \\varphi}{\\partial x} = P$ 对 $x$ 积分得 $\\varphi = \\int P\\,dx + g(y, z)$，再由 $\\frac{\\partial \\varphi}{\\partial y} = Q$、$\\frac{\\partial \\varphi}{\\partial z} = R$ 逐层定出 $g$，最后加常数 $C$。\n**易错点**：旋度为零只是必要条件；忘记检验定义域的单连通性，就会把「涡旋场」误判成保守场。另外势函数只确定到相差一个常数，算功时用势差即可。"
        },
        {
          type: "interactive",
          lab: "datalab",
          title: "判断向量场是否保守并求势函数：$\\mathbf{F} = (2xy + 3,\\ x^2 - 4y)$",
          config: {
            state: { 场与路径: "F = (2xy + 3, x² - 4y)，从 (0, 0) 到 (1, 2)", 旋度分量: "待算", 路径积分: "待算", 势函数: "待算", 检查: "先算两个偏导再决定方法" },
            steps: [
              { desc: "给出场与起终点：$\\mathbf{F} = (2xy + 3,\\ x^2 - 4y)$，沿某条路径从 $(0, 0)$ 走到 $(1, 2)$。", state: { 场与路径: "F = (2xy + 3, x² - 4y)；(0, 0) → (1, 2)", 旋度分量: "待算", 路径积分: "待算", 势函数: "待算", 检查: "先算 ∂P/∂y 与 ∂Q/∂x" } },
              { desc: "算 $\\frac{\\partial P}{\\partial y}$：$P = 2xy + 3$ 对 $y$ 求偏导。", state: { 场与路径: "P = 2xy + 3", 旋度分量: "∂P/∂y = 2x", 路径积分: "待算", 势函数: "待算", 检查: "把 x 当常数，对 y 求导" } },
              { desc: "算 $\\frac{\\partial Q}{\\partial x}$：$Q = x^2 - 4y$ 对 $x$ 求偏导。", state: { 场与路径: "Q = x² - 4y", 旋度分量: "∂Q/∂x = 2x", 路径积分: "待算", 势函数: "待算", 检查: "把 y 当常数，对 x 求导" } },
              { desc: "旋度为零 $\\Rightarrow$ 无旋；定义域是 $\\mathbb{R}^2$，单连通 $\\Rightarrow$ 保守场。", state: { 场与路径: "F 在整个 R² 上有定义", 旋度分量: "∂Q/∂x - ∂P/∂y = 2x - 2x = 0", 路径积分: "待算", 势函数: "存在", 检查: "偏导连续 + 单连通 ⇒ curl F = 0 是保守的充要条件" } },
              { desc: "沿折线第一条边积分：$(0, 0) \\to (1, 0)$，此时 $y = 0$、$dy = 0$。", state: { 场与路径: "(0, 0) → (1, 0)，y = 0", 旋度分量: "0", 路径积分: "∫₀¹ (2x·0 + 3) dx = 3", 势函数: "待算", 检查: "这一段只有 P dx 起作用" } },
              { desc: "沿折线第二条边积分：$(1, 0) \\to (1, 2)$，此时 $x = 1$、$dx = 0$。", state: { 场与路径: "(1, 0) → (1, 2)，x = 1", 旋度分量: "0", 路径积分: "∫₀² (1 - 4y) dy = 2 - 8 = -6", 势函数: "待算", 检查: "两段合计 3 + (-6) = -3" } },
              { desc: "求势函数：由 $\\frac{\\partial \\varphi}{\\partial x} = P$ 对 $x$ 积分，再定出关于 $y$ 的待定函数。", state: { 场与路径: "待求 φ", 旋度分量: "0", 路径积分: "-3（折线结果）", 势函数: "φ = x²y + 3x + g(y)", 检查: "由 ∂φ/∂y = x² + g'(y) = x² - 4y 得 g'(y) = -4y，故 g(y) = -2y² + C" } },
              { desc: "用势差算功，并与路径积分对照。", state: { 场与路径: "(0, 0) → (1, 2)", 旋度分量: "0", 路径积分: "φ(1, 2) - φ(0, 0) = (2 + 3 - 8) - 0 = -3", 势函数: "φ = x²y + 3x - 2y² + C", 检查: "与沿折线直接积分的 -3 一致 ⇒ 与路径无关" } },
              { desc: "对照一个非保守场：$\\mathbf{F} = (-y, x)$，它是绕原点旋转的涡旋场。", state: { 场与路径: "F = (-y, x)，沿单位圆正向走一圈", 旋度分量: "∂Q/∂x - ∂P/∂y = 1 - (-1) = 2 ≠ 0", 路径积分: "∮ = ∫₀^{2π} 1 dt = 2π ≈ 6.2831853", 势函数: "不存在（该场是极角的梯度，极角多值）", 检查: "环路积分不为 0 ⇒ 非保守；无旋只是保守的必要条件" } }
            ],
            tasks: [
              { t: "先自己算 $\\frac{\\partial Q}{\\partial x} - \\frac{\\partial P}{\\partial y}$，再逐步点开核对。", check: "得到 $0$，并指出还必须补一句「定义域 $\\mathbb{R}^2$ 单连通」才能断定保守。" },
              { t: "换另一条折线 $(0, 0) \\to (0, 2) \\to (1, 2)$ 再算一遍功。", hint: "第一段 $x = 0$、$dx = 0$，第二段 $y = 2$、$dy = 0$", check: "两段分别是 $-8$ 与 $5$，合计 $-3$，与势差一致。" }
            ]
          }
        },
        {
          type: "interactive",
          lab: "pathlab",
          title: "对照实验一（保守场）：所有单调路线代价相同",
          config: {
            grid: [[1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6]],
            start: [0, 0],
            end: [2, 3],
            algo: "dijkstra",
            legend: "格子里的数字代表「走进这一格要付出的代价」，S 是起点、E 是终点。",
            tasks: [
              { t: "点「▶ 单步」让 Dijkstra 走完，记下显示的累计代价。", check: "累计代价 = 20。" },
              { t: "手算全部 10 条只向右 / 向下的路线，看它们的代价是否相同。", hint: "格子值只依赖 $i + j$（反对角线上的数相同），每条单调路线恰好经过每条反对角线一次", check: "10 条路线代价全是 $2 + 3 + 4 + 5 + 6 = 20$。" },
              { t: "说明这个网格为什么对应「保守场中做功与路径无关」。", check: "能指出格子值存在一个只依赖 $i + j$ 的「势」，路径代价只由起点与终点的势决定。" }
            ]
          }
        },
        {
          type: "interactive",
          lab: "pathlab",
          title: "对照实验二（非保守场）：不同路线代价从 5 到 17",
          config: {
            grid: [[1, 1, 1, 1], [1, 5, 9, 1], [1, 1, 1, 1]],
            start: [0, 0],
            end: [2, 3],
            algo: "dijkstra",
            legend: "中央的两格 5 与 9 打破了上图的势结构，相当于出现了一个「涡旋」。",
            tasks: [
              { t: "用 Dijkstra 找出最省路线，记下累计代价。", check: "最省代价 = 5，路线沿边界的全 1 通道走。" },
              { t: "手算穿中心的路线 $(0,0) \\to (0,1) \\to (1,1) \\to (1,2) \\to (1,3) \\to (2,3)$ 的代价。", hint: "把进入的每一格的数字相加", check: "代价 $= 1 + 5 + 9 + 1 + 1 = 17$。" },
              { t: "把两个网格对照起来，说明「路径无关」与「环量不为零」的关系。", check: "能指出实验一的格子值只依赖 i + j（存在势），实验二破坏了这一结构，不同路线代价从 5 到 17 不等，最省路线唯一。" }
            ]
          }
        },
        {
          type: "concept",
          title: "第二类曲线积分的计算与格林公式（两种形式与应用）",
          md: "**第二类曲线积分的计算**：设 $L$ 有参数化 $\\mathbf{r}(t) = (x(t), y(t))$（$t$ 从 $\\alpha$ 到 $\\beta$），则 $\\int_L P\\,dx + Q\\,dy = \\int_{\\alpha}^{\\beta} \\left[P(x(t), y(t)) x'(t) + Q(x(t), y(t)) y'(t)\\right] dt$。方向决定符号：$t$ 增大的方向就是曲线方向，反向要添负号。\n**路径无关时的速算**：若 $\\mathbf{F} = (P, Q)$ 在单连通区域上旋度为零，则 $\\int_L P\\,dx + Q\\,dy = \\varphi(\\text{终点}) - \\varphi(\\text{起点})$，其中 $\\nabla \\varphi = \\mathbf{F}$。复杂路径的积分一下子变成两点相减。\n**格林公式（Green theorem）**：\n$$ \\oint_L P\\,dx + Q\\,dy = \\iint_D \\left(\\frac{\\partial Q}{\\partial x} - \\frac{\\partial P}{\\partial y}\\right) dx\\,dy $$\n两种形式：\n- 环量形式（切向）：$\\oint_L P\\,dx + Q\\,dy = \\iint_D \\left(\\frac{\\partial Q}{\\partial x} - \\frac{\\partial P}{\\partial y}\\right) dx\\,dy$；\n- 通量形式（法向，$\\mathbf{n}$ 取外法向）：$\\oint_L (P\\,dy - Q\\,dx) = \\iint_D \\left(\\frac{\\partial P}{\\partial x} + \\frac{\\partial Q}{\\partial y}\\right) dx\\,dy$。\n**条件（必须写清）**：$D$ 是由分段光滑闭曲线 $L$ 围成的有界闭区域；$L$ 取**正向**（沿 $L$ 前进时区域 $D$ 在左手边：外边界逆时针、内边界顺时针）；$P$、$Q$ 在包含 $D$ 的开集上有**连续偏导数**。若区域有洞，要对每条边界分别取正向，公式变成 $\\oint_{\\text{外}} + \\oint_{\\text{内}} = \\iint_D \\left(\\frac{\\partial Q}{\\partial x} - \\frac{\\partial P}{\\partial y}\\right) dx\\,dy$。\n**三类应用**：① 算面积：$A = \\frac{1}{2} \\oint_L (x\\,dy - y\\,dx) = \\oint_L x\\,dy = -\\oint_L y\\,dx$；② 把难算的曲线积分换成二重积分（或反向使用）；③ 用通量形式算流出边界的通量，等价于平面散度定理。\n> 直观提醒：格林公式说的是「边界上的环量 = 内部旋度的总和」，它是斯托克斯公式在平面上的特例。"
        },
        {
          type: "interactive",
          lab: "datalab",
          title: "格林公式两条路对照：$\\oint_L (x\\,dy - y\\,dx)$ 的单位圆与正方形",
          config: {
            state: { 曲线与区域: "L：单位圆正向，D：单位圆盘", 曲线积分: "待算", 二重积分: "待算", 数值: "待算", 对照检查: "格林公式要求 L 正向、P Q 偏导连续" },
            steps: [
              { desc: "写出格林公式与本题的 $P$、$Q$：$L$ 是单位圆的正向边界，$D$ 是单位圆盘。", state: { 曲线与区域: "L：x² + y² = 1 逆时针；D：x² + y² ≤ 1", 曲线积分: "∮_L (x dy - y dx)，P = -y、Q = x", 二重积分: "∬_D (∂Q/∂x - ∂P/∂y) dxdy", 数值: "待算", 对照检查: "条件：L 分段光滑取正向、P Q 在含 D 的开集上偏导连续 ✓" } },
              { desc: "路线一（左边）：参数化 $L$，$x = \\cos t$、$y = \\sin t$，$t$ 从 $0$ 到 $2\\pi$。", state: { 曲线与区域: "单位圆，逆时针", 曲线积分: "∫₀^{2π} [(cos t)(cos t) - (sin t)(-sin t)] dt = ∫₀^{2π} 1 dt", 二重积分: "待算", 数值: "待算", 对照检查: "dx = -sin t dt，dy = cos t dt" } },
              { desc: "算出曲线积分：被积函数化简为 $1$，积分就是区间长度。", state: { 曲线与区域: "单位圆，逆时针", 曲线积分: "2π", 二重积分: "待算", 数值: "6.2831853", 对照检查: "曲线积分得到 2π" } },
              { desc: "路线二（右边）：先算两个偏导。", state: { 曲线与区域: "单位圆盘 D", 曲线积分: "2π", 二重积分: "∬_D (1 - (-1)) dxdy = ∬_D 2 dxdy", 数值: "待算", 对照检查: "∂Q/∂x = 1，∂P/∂y = -1，被积函数是常数 2" } },
              { desc: "算出二重积分：2 乘以圆盘面积。", state: { 曲线与区域: "单位圆盘 D，面积 π", 曲线积分: "2π", 二重积分: "2 × π × 1² = 2π", 数值: "6.2831853", 对照检查: "两条路都是 2π ✓" } },
              { desc: "几何副产品：格林公式给出的面积公式。", state: { 曲线与区域: "A = (1/2) ∮_L (x dy - y dx)", 曲线积分: "(1/2) × 2π = π", 二重积分: "π（圆盘面积）", 数值: "3.1415927", 对照检查: "曲线积分算出面积，这是格林公式最常用的几何应用" } },
              { desc: "换区域：把 $L$ 换成正方形 $[0, 1]^2$ 的正向边界，两条路各算一遍。", state: { 曲线与区域: "正方形 [0, 1]² 的边界，逆时针", 曲线积分: "底边 0 + 右边 1 + 上边 1 + 左边 0 = 2", 二重积分: "∬ 2 dxdy = 2 × 1 = 2", 数值: "2", 对照检查: "两条路都是 2 ✓（面积公式给出 (1/2) × 2 = 1，正是正方形面积）" } },
              { desc: "反面提醒：把定向取反会怎样？", state: { 曲线与区域: "-L：顺时针", 曲线积分: "∮ 变为 -2π", 二重积分: "公式要求正向，取顺时针时右侧要写成 -∬_D 2 dxdy", 数值: "-6.2831853", 对照检查: "符号整体反转——定向是格林公式最容易错的地方" } }
            ],
            tasks: [
              { t: "先只看左边：把 $x\\,dy - y\\,dx$ 在单位圆上算一遍，再点开核对。", check: "得到 $\\int_0^{2\\pi} 1\\,dt = 2\\pi$。" },
              { t: "用面积公式算椭圆 $x = 2\\cos t$、$y = \\sin t$ 围成的面积。", hint: "$A = \\frac{1}{2} \\oint (x\\,dy - y\\,dx)$", check: "$x\\,dy - y\\,dx = 2\\,dt$，故 $A = \\frac{1}{2} \\times 2 \\times 2\\pi = 2\\pi$，与 $\\pi ab = 2\\pi$ 一致。" }
            ]
          }
        },
        {
          type: "calc",
          title: "手算演练：旋度、势函数、环量与格林公式",
          inputs: [
            { name: "题目 1", value: "$\\mathbf{F} = (2xy + 3,\\ x^2 - 4y)$：旋度、势函数与 $(0,0) \\to (1,2)$ 的功" },
            { name: "题目 2", value: "$\\oint_L (x\\,dy - y\\,dx)$，$L$ 为单位圆正向" },
            { name: "题目 3", value: "$\\mathbf{F} = (x^2 y,\\ yz,\\ xz^2)$ 在点 $(1, 1, 1)$ 的散度与旋度" },
            { name: "题目 4", value: "$\\varphi = x^2 y z$ 在点 $(1, 2, 3)$ 的梯度" },
            { name: "题目 5", value: "$\\mathbf{F} = (-y, x)$ 的旋度与沿单位圆的环量" }
          ],
          outputs: [
            "1) $\\frac{\\partial Q}{\\partial x} - \\frac{\\partial P}{\\partial y} = 2x - 2x = 0$（无旋 + $\\mathbb{R}^2$ 单连通 $\\Rightarrow$ 保守）；$\\varphi = x^2 y + 3x - 2y^2 + C$；功 $= \\varphi(1, 2) - \\varphi(0, 0) = (2 + 3 - 8) - 0 = -3$",
            "2) 格林公式：$\\oint (x\\,dy - y\\,dx) = \\iint (1 + 1)\\,dx\\,dy = 2 \\times \\pi = 2\\pi \\approx 6.2831853$；而 $\\frac{1}{2} \\oint (x\\,dy - y\\,dx) = \\pi$ 正是圆面积",
            "3) $\\nabla \\cdot \\mathbf{F} = 2xy + z + 2xz = 2 + 1 + 2 = 5$；$\\nabla \\times \\mathbf{F} = (-y,\\ -z^2,\\ -x^2) = (-1, -1, -1)$",
            "4) $\\nabla \\varphi = (2xyz,\\ x^2 z,\\ x^2 y) = (12, 3, 2)$",
            "5) $\\frac{\\partial Q}{\\partial x} - \\frac{\\partial P}{\\partial y} = 1 - (-1) = 2 \\ne 0$；沿单位圆 $\\oint = 2\\pi \\approx 6.2831853 \\ne 0$ $\\Rightarrow$ 非保守",
            "对照：若把题目 5 的场换成 $\\mathbf{F} = (y, x)$，势函数为 $\\varphi = xy$，从 $(0, 0)$ 到 $(2, 3)$ 的功 $= 6$，与路径无关"
          ],
          note: "见到「无旋」先别急着说保守：补一句定义域单连通（或举出带洞区域的反例）。"
        }
      ],
      quiz: [
        {
          id: "ma3-field-q1",
          type: "single",
          q: "「无旋场一定是保守场」这句话需要补充什么条件才成立？",
          options: [
            "定义域必须是单连通区域，且场的分量有连续偏导",
            "不需要任何补充条件，对任意开区域都成立",
            "只要场的分量连续即可",
            "只要场有界即可"
          ],
          answer: 0,
          why: "在单连通开区域上，「旋度为零」与「存在势函数」才是等价的，这条链（势函数 $\\leftrightarrow$ 路径无关 $\\leftrightarrow$ 环路积分为零 $\\leftrightarrow$ 无旋）中最后一步最关键。反例：$\\mathbf{F} = \\left(-\\frac{y}{x^2 + y^2}, \\frac{x}{x^2 + y^2}\\right)$ 在 $\\mathbb{R}^2$ 去掉原点后处处 $\\frac{\\partial Q}{\\partial x} = \\frac{\\partial P}{\\partial y}$，但绕单位圆的环量为 $2\\pi \\ne 0$，所以不保守——区域的「洞」破坏了单连通性。选项 1、2、3 都忽略了拓扑条件，连续性或有界性都不能替代它。"
        },
        {
          id: "ma3-field-q2",
          type: "order",
          q: "把「在保守场中求功与势函数」的步骤排成正确顺序。",
          items: [
            "由 $\\frac{\\partial \\varphi}{\\partial y} = Q$ 定出 $g'(y)$，积分得 $g(y) + C$",
            "验证旋度为零且定义域单连通，确认这个场是保守场",
            "对 $x$ 积分 $P$，得到 $\\varphi = \\int P\\,dx + g(y)$",
            "用 $\\varphi(\\text{终点}) - \\varphi(\\text{起点})$ 算出功，并用另一条路径的积分核对",
            "写出势函数 $\\varphi$ 并检查 $\\nabla \\varphi = \\mathbf{F}$"
          ],
          answer: [1, 2, 0, 4, 3],
          why: "正确顺序是先验证保守性（第 2 项），再用偏积分法：对 $x$ 积分 $P$ 得 $\\varphi = \\int P\\,dx + g(y)$（第 3 项），由 $\\frac{\\partial \\varphi}{\\partial y} = Q$ 定出 $g$（第 1 项），整理并检查 $\\nabla \\varphi = \\mathbf{F}$（第 5 项），最后用势差算功并与另一条路径对照（第 4 项）。若跳过第一步，遇到带洞区域上的无旋场就会算出错误结论；若跳过最后一步检查，符号或常数出错时无法发现。"
        },
        {
          id: "ma3-field-q3",
          type: "fill",
          q: "设 $\\mathbf{F} = (y, x)$，则沿任意路径从 $(0, 0)$ 到 $(2, 3)$ 的功 $\\int_L P\\,dx + Q\\,dy =$ ____",
          answer: ["6", "6.0"],
          why: "$\\mathbf{F} = (y, x)$ 满足 $\\frac{\\partial Q}{\\partial x} = 1 = \\frac{\\partial P}{\\partial y}$，在整个 $\\mathbb{R}^2$ 上无旋且区域单连通，因此是保守场；由 $\\frac{\\partial \\varphi}{\\partial x} = y$ 得 $\\varphi = xy + C$，于是功 $= \\varphi(2, 3) - \\varphi(0, 0) = 6 - 0 = 6$。若沿 $(0,0) \\to (2,0) \\to (2,3)$ 直接算：第一段 $y = 0$ 贡献 $0$，第二段 $x = 2$ 贡献 $\\int_0^3 2\\,dy = 6$，合计 $6$，与势差一致。"
        },
        {
          id: "ma3-field-q4",
          type: "single",
          q: "设 $L$ 是单位圆的正向（逆时针）边界，则 $\\oint_L (x\\,dy - y\\,dx)$ 等于多少？",
          options: ["$2\\pi$", "$\\pi$", "$0$", "$-2\\pi$"],
          answer: 0,
          why: "用格林公式：$P = -y$、$Q = x$，$\\frac{\\partial Q}{\\partial x} - \\frac{\\partial P}{\\partial y} = 1 - (-1) = 2$，二重积分 $= 2 \\times$ 圆盘面积 $= 2\\pi$。直接参数化也算得 $\\int_0^{2\\pi} (\\cos^2 t + \\sin^2 t)\\,dt = 2\\pi$。选项 $\\pi$ 是把面积公式 $A = \\frac{1}{2} \\oint (x\\,dy - y\\,dx)$ 的系数 $\\frac{1}{2}$ 漏掉了；选项 $0$ 是误以为 $x\\,dy$ 与 $y\\,dx$ 相消；选项 $-2\\pi$ 只在 $L$ 取顺时针（负向）时才对。"
        }
      ]
    },

    /* ==================================================================== 第 4 讲 */
    {
      id: "ma3-surface-integral",
      title: "曲面积分：通量、环量与高斯 / 斯托克斯公式",
      goal: "理解曲面定向与两类曲面积分，能用高斯公式与斯托克斯公式计算通量和环量，并能说出外微分与广义斯托克斯定理的统一图景。",
      est: 55,
      blocks: [
        {
          type: "analogy",
          title: "通量与环量：水穿过渔网，风车插进水流",
          md: "第一类曲面积分量的是「曲面上的面积分」：给一块弯曲的铁皮称重，面密度乘面积再逐点累加。第二类曲面积分量的是**通量（flux）**：问单位时间有多少水穿过这张网——这时网的方向（法向 $\\mathbf{n}$）决定「穿过去」算正还是算负，法向取反，通量变号。\n- 通量的原型：$\\mathbf{F}$ 是流速场，$\\iint_S \\mathbf{F} \\cdot \\mathbf{n}\\,dS$ 就是流量；散度是通量的体密度，所以「内部源的总强度 = 穿出边界的总通量」（高斯公式）。\n- 环量的原型（斯托克斯）：把一个小风车放进流场，转得越快说明场的旋度越大；沿闭曲线 $C$ 的环量 $\\oint_C \\mathbf{F} \\cdot d\\mathbf{r}$ 等于穿过 $C$ 所张曲面的「旋度通量」。\n- 定向（orientation）：曲面像纸一样有正反两面，能用**连续**法向场区分正反的曲面叫可定向曲面（orientable）；莫比乌斯带只有一个面，无法定向，也就谈不上第二类曲面积分。"
        },
        {
          type: "concept",
          title: "曲面定向、第一类与第二类曲面积分",
          md: "**曲面定向**：对光滑曲面 $S$，若能在每点指定单位法向 $\\mathbf{n}$ 且 $\\mathbf{n}$ 随点连续变化，则 $S$ 可定向，取定 $\\mathbf{n}$ 就是取定一个定向。闭曲面约定**外侧（outward）为正**；交换定向，第二类曲面积分整体变号。\n**第一类曲面积分（对面积）**：$\\iint_S f(x, y, z)\\,dS$ 由分割求和取极限定义，$dS$ 恒为正，**与定向无关**。若 $S$ 由 $z = z(x, y)$（$(x, y) \\in D$）给出，则 $\\iint_S f\\,dS = \\iint_D f(x, y, z(x, y)) \\sqrt{1 + z_x^2 + z_y^2}\\,dx\\,dy$。\n**第二类曲面积分（对坐标）**：$\\iint_S P\\,dy\\,dz + Q\\,dz\\,dx + R\\,dx\\,dy = \\iint_S (P \\cos\\alpha + Q \\cos\\beta + R \\cos\\gamma)\\,dS$，其中 $(\\cos\\alpha, \\cos\\beta, \\cos\\gamma)$ 是取定定向的单位法向。$dy\\,dz$、$dz\\,dx$、$dx\\,dy$ 分别是面积元在三个坐标平面上的**有向投影**，因此它依赖定向。\n**物理意义**：取 $\\mathbf{F} = (P, Q, R)$，则 $\\iint_S P\\,dy\\,dz + Q\\,dz\\,dx + R\\,dx\\,dy = \\iint_S \\mathbf{F} \\cdot \\mathbf{n}\\,dS$ 就是穿过 $S$ 的通量。散度是通量的体密度，旋度在法向上的分量是环量的面密度——三大公式正是把「边界上的积分」与「内部的微分」连接起来的桥梁。\n**两类积分的换算**：$\\iint_S \\mathbf{F} \\cdot \\mathbf{n}\\,dS = \\iint_S (\\mathbf{F} \\cdot \\mathbf{n})\\,dS$；把第二类化为第一类时只需乘上单位法向，但注意 $\\mathbf{n}$ 的定向必须与曲面定向一致，把它写成 $dx\\,dy$ 形式时符号由法向分量的正负决定。"
        },
        {
          type: "concept",
          title: "高斯公式与斯托克斯公式：条件、意义与退化关系",
          md: "**高斯公式（Gauss theorem，散度定理 divergence theorem）**：设 $V$ 是由分片光滑闭曲面 $S$ 围成的有界闭区域，$S$ 取**外侧**，$\\mathbf{F} = (P, Q, R)$ 的分量在包含 $V$ 的开集上有**连续偏导**，则\n$$ \\oiint_{\\partial V} \\mathbf{F} \\cdot d\\mathbf{S} = \\iiint_V \\nabla \\cdot \\mathbf{F}\\,dV $$\n展开写作 $\\oiint_S P\\,dy\\,dz + Q\\,dz\\,dx + R\\,dx\\,dy = \\iiint_V \\left(\\frac{\\partial P}{\\partial x} + \\frac{\\partial Q}{\\partial y} + \\frac{\\partial R}{\\partial z}\\right) dV$。\n物理意义：**内部所有源的总强度等于穿过边界的总通量**——水龙头出多少水，边界面就得流出多少水。\n**斯托克斯公式（Stokes theorem）**：设 $S$ 是分片光滑的有向曲面，边界 $C$ 是分段光滑闭曲线，$C$ 的方向与 $S$ 的定向按**右手法则（right-hand rule）**匹配，$\\mathbf{F}$ 分量有连续偏导，则\n$$ \\oint_C \\mathbf{F} \\cdot d\\mathbf{r} = \\iint_S (\\nabla \\times \\mathbf{F}) \\cdot d\\mathbf{S} $$\n展开写作 $\\oint_C P\\,dx + Q\\,dy + R\\,dz = \\iint_S \\left(\\frac{\\partial R}{\\partial y} - \\frac{\\partial Q}{\\partial z}\\right) dy\\,dz + \\left(\\frac{\\partial P}{\\partial z} - \\frac{\\partial R}{\\partial x}\\right) dz\\,dx + \\left(\\frac{\\partial Q}{\\partial x} - \\frac{\\partial P}{\\partial y}\\right) dx\\,dy$。\n物理意义：**沿边界环流的总量等于穿过曲面的旋度通量**。取 $S$ 为平面区域、$\\mathbf{n} = \\mathbf{k}$ 时，它退化成格林公式——格林公式是斯托克斯公式的平面特例。\n**条件清单（考试必写）**：高斯要求「闭曲面 + 外侧 + 偏导连续」；斯托克斯要求「曲面分片光滑可定向 + 边界曲线与定向右手匹配 + 偏导连续」。曲面不闭时补面，场在区域内有奇点时挖去小球再取极限。"
        },
        {
          type: "interactive",
          lab: "datalab",
          title: "高斯公式两条路对照：单位球面的通量与散度三重积分",
          config: {
            state: { 曲面与场: "S：单位球面外侧；F = (x, y, z)", 直接通量: "待算", 散度: "待算", 三重积分: "待算", 对照检查: "高斯公式要求闭曲面外侧、偏导连续" },
            steps: [
              { desc: "写出高斯公式与本题的场、曲面：$S$ 是单位球面，取外侧；$V$ 是单位球体。", state: { 曲面与场: "S：x² + y² + z² = 1（外侧）；F = (x, y, z)", 直接通量: "∬_S F · n dS，待算", 散度: "待算", 三重积分: "待算", 对照检查: "S 分片光滑闭曲面、V 有界、F 分量偏导连续 ✓" } },
              { desc: "直接算（左边）：单位球面上的外法向就是 $\\mathbf{n} = (x, y, z)$，且 $|\\mathbf{n}| = 1$。", state: { 曲面与场: "单位球面，单位外法向 n = (x, y, z)", 直接通量: "F · n = x² + y² + z² = 1", 散度: "待算", 三重积分: "待算", 对照检查: "球面上 F 恰好等于外法向，法向分量恒为 1" } },
              { desc: "于是直接通量等于球面面积。", state: { 曲面与场: "单位球面，面积 4π", 直接通量: "∬_S 1 dS = 4π", 散度: "待算", 三重积分: "待算", 数值: "12.5663706", 对照检查: "被积函数为 1 的第一类曲面积分就是面积" } },
              { desc: "换到右边：先算散度。", state: { 曲面与场: "F = (x, y, z)", 直接通量: "4π", 散度: "div F = 1 + 1 + 1 = 3", 三重积分: "∭_V 3 dV = 3 × Vol(V)", 对照检查: "散度是常数 3" } },
              { desc: "算三重积分：单位球体积是 $\\frac{4\\pi}{3}$。", state: { 曲面与场: "V：单位球体，体积 4π/3", 直接通量: "4π", 散度: "3", 三重积分: "3 × 4π/3 = 4π", 数值: "12.5663706", 对照检查: "两条路都是 4π ✓" } },
              { desc: "换一个场做对照：$\\mathbf{F} = (0, 0, z)$。", state: { 曲面与场: "F = (0, 0, z)，S 仍是单位球面外侧", 直接通量: "∬ z² dS = 4π/3", 散度: "div F = 1", 三重积分: "∭ 1 dV = 4π/3", 数值: "4.1887902", 对照检查: "两条路都是 4π/3 ✓" } },
              { desc: "再换区域：$\\mathbf{F} = (x, y, z)$ 穿过立方体 $[0, 1]^3$ 的边界。", state: { 曲面与场: "立方体 [0, 1]³ 的边界，外侧", 直接通量: "只有 x = 1、y = 1、z = 1 三个面各有通量 1，合计 3", 散度: "div F = 3", 三重积分: "∭ 3 dV = 3", 数值: "3", 对照检查: "两条路都是 3 ✓" } },
              { desc: "补面技巧：只给上半球面 $z = \\sqrt{1 - x^2 - y^2}$，$\\mathbf{F} = (0, 0, z)$，求外侧通量。", state: { 曲面与场: "上半球面 + 底面圆盘 = 闭曲面（外侧）", 直接通量: "闭曲面通量 = 2π/3；底面圆盘上 F = 0，且外法向为 (0, 0, -1)，故圆盘通量 = 0", 散度: "div F = 1", 三重积分: "∭ 1 dV = 2π/3（半个球的体积）", 数值: "2.0943951", 对照检查: "上半球面本身的通量 = 2π/3 - 0 = 2π/3" } }
            ],
            tasks: [
              { t: "先只算右边：$\\nabla \\cdot \\mathbf{F} = 3$，$\\iiint 3\\,dV = 4\\pi$，再点开左边核对。", check: "能说出两侧相等的原因是「散度的体积分等于边界的通量」。" },
              { t: "对 $\\mathbf{F} = (0, 0, z)$ 求上半球面（外侧）的通量，用补面法。", hint: "补上 $z = 0$ 的圆盘凑成闭曲面", check: "闭曲面通量 $\\frac{2\\pi}{3}$、圆盘通量 $0$，故半球面通量 $\\frac{2\\pi}{3} \\approx 2.0943951$。" }
            ]
          }
        },
        {
          type: "concept",
          title: "统一形式与场的分类：外微分、无旋、无源、调和",
          md: "**统一形式（外微分与广义斯托克斯定理）**：把「被积表达式」抽象成微分形式（differential form）$\\omega$，外微分算子 $d$ 把 $k$ 次形式变成 $k + 1$ 次形式，则三大公式可以写成一句话：**$\\oint_{\\partial M} \\omega = \\iint_M d\\omega$ —— 区域边界上的积分等于内部外微分的积分**。具体落地：\n- $\\omega = P\\,dx + Q\\,dy$（1 次形式）$\\Rightarrow$ $d\\omega = \\left(\\frac{\\partial Q}{\\partial x} - \\frac{\\partial P}{\\partial y}\\right) dx \\wedge dy$，就是格林公式；\n- $\\omega = P\\,dx + Q\\,dy + R\\,dz$ $\\Rightarrow$ $d\\omega$ 的三个分量正是旋度，积分区域取曲面就是斯托克斯公式；\n- $\\omega = P\\,dy\\,dz + Q\\,dz\\,dx + R\\,dx\\,dy$（2 次形式）$\\Rightarrow$ $d\\omega = \\left(\\frac{\\partial P}{\\partial x} + \\frac{\\partial Q}{\\partial y} + \\frac{\\partial R}{\\partial z}\\right) dx \\wedge dy \\wedge dz$，就是高斯公式。\n**场的分类（按散度与旋度）**：\n- 无旋场（irrotational）：$\\nabla \\times \\mathbf{F} = \\mathbf{0}$；在单连通区域上等价于保守场，可写成 $\\mathbf{F} = \\nabla \\varphi$；\n- 无源场（solenoidal）：$\\nabla \\cdot \\mathbf{F} = 0$；在单连通区域上可写成 $\\mathbf{F} = \\nabla \\times \\mathbf{A}$（向量势）；\n- 调和场（harmonic）：既无旋又无源，此时 $\\mathbf{F} = \\nabla \\varphi$ 且 $\\Delta \\varphi = \\nabla \\cdot (\\nabla \\varphi) = 0$，势函数满足拉普拉斯方程。\n**例子**：$\\mathbf{F} = (x, -y, 0)$ 满足 $\\nabla \\cdot \\mathbf{F} = 1 - 1 = 0$ 且 $\\nabla \\times \\mathbf{F} = \\mathbf{0}$，是调和场，对应势函数 $\\varphi = \\frac{x^2 - y^2}{2}$，而 $\\Delta \\varphi = 1 - 1 = 0$。\n**恒等式回顾**：$\\nabla \\times (\\nabla \\varphi) = \\mathbf{0}$ 说明「梯度场无旋」，$\\nabla \\cdot (\\nabla \\times \\mathbf{A}) = 0$ 说明「旋度场无源」，这两条正是上面分类的代数根源。"
        },
        {
          type: "steps",
          title: "计算通量或环量的路线选择",
          items: [
            { t: "看清积分类型与定向", d: "第一类 $dS$ 不带号；第二类或 $\\mathbf{F} \\cdot \\mathbf{n}\\,dS$ 必须先明确法向，闭曲面默认取外侧。" },
            { t: "判断曲面是否封闭", d: "封闭优先用高斯公式换成立体积分；不封闭就补一块简单的面（平面、底面、顶面）凑成闭曲面，最后减去补面的通量。" },
            { t: "检查场是否有奇点", d: "若场在 $V$ 内部有奇点（如 $\\frac{1}{r^2}$ 型场在原点），挖去以奇点为中心的小球，用「外边界 + 内边界」的多连通版本再取极限。" },
            { t: "算散度或旋度", d: "逐项求偏导，注意链式法则，例如 $\\nabla \\cdot (x^2 y, yz, xz^2) = 2xy + z + 2xz$。" },
            { t: "化为重积分并计算", d: "三重积分按对称性选球坐标、柱坐标或先一后二；二重积分写清投影区域。" },
            { t: "两侧对照检验", d: "条件允许时用另一条路（直接曲面积分或数值积分）核算，并检查符号与外向约定。" }
          ],
          note: "「补面」与「挖球」是两类标准修正，遇到不闭曲面或带奇点的场时先想它们。"
        },
        {
          type: "pitfall",
          title: "易错点：定向、闭曲面与奇点",
          items: [
            { t: "定向搞反", d: "第二类曲面积分与法向绑定：闭曲面取外侧，写成 $\\iint P\\,dy\\,dz + Q\\,dz\\,dx + R\\,dx\\,dy$ 时每一块的符号都由法向分量决定，取反一次结果差一个负号。" },
            { t: "非闭曲面直接套高斯公式", d: "只给上半球面时，必须先补上底面圆盘凑成闭曲面，再用「闭曲面通量 - 补面通量」；直接套公式会多算一整块。" },
            { t: "忽略场在区域内的奇点", d: "对 $\\mathbf{F} = \\frac{\\mathbf{r}}{|\\mathbf{r}|^3}$ 在包含原点的球体内用高斯公式会得到 $4\\pi$ 的「怪结果」，其实原点处散度无定义，必须挖去小球再取极限。" },
            { t: "把第一类曲面积分当成带号的", d: "$dS$ 恒为正，$\\iint_S f\\,dS$ 与定向无关；只有化成 $dx\\,dy$、$dy\\,dz$、$dz\\,dx$ 的有向投影时才出现符号。" },
            { t: "斯托克斯的边界方向弄错", d: "$C$ 的方向由 $S$ 的法向按右手法则决定；换一张以 $C$ 为边界的曲面环量不变，但把 $C$ 的方向取反结果变号。" }
          ]
        },
        {
          type: "calc",
          title: "手算演练：高斯公式、斯托克斯公式与曲面积分",
          inputs: [
            { name: "题目 1", value: "$\\mathbf{F} = (x, y, z)$ 穿过单位球面外侧的通量" },
            { name: "题目 2", value: "同一个 $\\mathbf{F}$ 穿过立方体 $[0, 1]^3$ 边界的通量" },
            { name: "题目 3", value: "单位球面上的 $\\iint (x^2 + y^2)\\,dS$" },
            { name: "题目 4", value: "斯托克斯：$\\mathbf{F} = (z, x, y)$，$S$ 为单位圆盘 $z = 0$ 上侧" },
            { name: "题目 5", value: "$\\mathbf{F} = (x^2, 0, 0)$ 穿过立方体 $[0, 1]^3$ 边界的通量" }
          ],
          outputs: [
            "1) $\\nabla \\cdot \\mathbf{F} = 3$，$\\iiint_V 3\\,dV = 3 \\times \\frac{4\\pi}{3} = 4\\pi \\approx 12.5663706$；直接算：球面上 $\\mathbf{F} \\cdot \\mathbf{n} = x^2 + y^2 + z^2 = 1$，$\\iint dS = 4\\pi$，两侧一致",
            "2) 六个面里只有 $x = 1$、$y = 1$、$z = 1$ 三面有通量，各贡献 $1$，合计 $3$；右侧 $\\iiint 3\\,dV = 3$，两侧一致",
            "3) 球面上 $x^2 + y^2$ 的平均值是 $\\frac{2}{3}$，故 $\\iint (x^2 + y^2)\\,dS = 4\\pi \\times \\frac{2}{3} = \\frac{8\\pi}{3} \\approx 8.3775804$",
            "4) $\\nabla \\times \\mathbf{F} = (1, 1, 1)$，圆盘法向 $\\mathbf{n} = (0, 0, 1)$，故 $\\iint (\\nabla \\times \\mathbf{F}) \\cdot \\mathbf{n}\\,dS = \\iint 1\\,dS = \\pi \\approx 3.1415927$；边界线积分 $\\int_0^{2\\pi} \\cos^2 t\\,dt = \\pi$，两侧一致",
            "5) $x = 1$ 面上 $\\mathbf{F} \\cdot \\mathbf{n} = 1$ 贡献 $1$，$x = 0$ 面上 $\\mathbf{F} \\cdot \\mathbf{n} = 0$ 贡献 $0$，其余面贡献 $0$，合计 $1$；右侧 $\\iiint 2x\\,dV = 2 \\times \\frac{1}{2} = 1$，两侧一致",
            "补充：上半球面上的 $\\iint z\\,dS = 2\\pi \\times \\frac{1}{2} = \\pi \\approx 3.1415927$（用球坐标逐项积分）"
          ],
          note: "曲面必须封闭（高斯）或必须有边界曲线（斯托克斯）；不封闭时先补面，再减去补面的贡献。"
        },
        {
          type: "lab",
          title: "动手实验：两侧对照与补面练习",
          steps: [
            "用高斯公式算 $\\mathbf{F} = (x, y, z)$ 穿过单位球面的通量，并把直接计算（$\\mathbf{F} \\cdot \\mathbf{n} = 1$）作为对照写在旁边。",
            "对 $\\mathbf{F} = (x^2, 0, 0)$ 穿过立方体 $[0, 1]^3$ 边界的通量：逐面算出只有 $x = 1$ 面贡献 $1$，再用 $\\iiint 2x\\,dV = 1$ 核对。",
            "验证斯托克斯公式：$\\mathbf{F} = (z, x, y)$，$S$ 为单位圆盘 $z = 0$ 的上侧，比较 $\\iint (\\nabla \\times \\mathbf{F}) \\cdot \\mathbf{n}\\,dS$ 与 $\\oint_C \\mathbf{F} \\cdot d\\mathbf{r}$。",
            "补面练习：$S$ 为上半球面 $z = \\sqrt{1 - x^2 - y^2}$，$\\mathbf{F} = (0, 0, z)$，用补面法求 $S$ 的外侧通量（答案 $\\frac{2\\pi}{3}$）。",
            "数值实验：用球坐标数值积分 $\\iint_S z^2\\,dS$（单位球面），验证它等于 $\\frac{4\\pi}{3}$，也就是单位球的体积。"
          ],
          note: "每次写公式前先声明定向与曲面是否封闭，这两句话往往就是评分的采分点。"
        }
      ],
      quiz: [
        {
          id: "ma3-surface-integral-q1",
          type: "single",
          q: "关于第一类与第二类曲面积分，下列说法正确的是？",
          options: [
            "第一类曲面积分 $\\iint f\\,dS$ 与曲面定向无关；第二类曲面积分 $\\iint P\\,dy\\,dz + Q\\,dz\\,dx + R\\,dx\\,dy$ 交换定向后整体变号",
            "两类曲面积分完全等价，可以随意互换而不考虑定向",
            "第二类曲面积分与定向无关，因为 $dy\\,dz$ 只是面积的投影",
            "只有闭曲面才能定义第一类曲面积分"
          ],
          answer: 0,
          why: "第一类曲面积分的面积元 $dS$ 恒为正，所以与定向无关；第二类曲面积分是面积元在坐标平面上的有向投影之和，本质是通量 $\\iint \\mathbf{F} \\cdot \\mathbf{n}\\,dS$，法向取反就整体变号（选项 2 恰好说反了）。选项 1 错在「随意互换」：化归时必须乘上与定向一致的单位法向。选项 3 错在把开放性当条件：任何分片光滑的可定向曲面都能定义第一类曲面积分。"
        },
        {
          id: "ma3-surface-integral-q2",
          type: "fill",
          q: "$\\mathbf{F} = (x, y, z)$ 穿过单位球面外侧的总通量 $=$ ____（写成 $\\pi$ 的倍数，或给出三位以上有效数字）",
          answer: ["4π", "4pi", "12.5664", "12.566", "12.5663706"],
          why: "用高斯公式：$\\nabla \\cdot \\mathbf{F} = \\frac{\\partial x}{\\partial x} + \\frac{\\partial y}{\\partial y} + \\frac{\\partial z}{\\partial z} = 3$，于是通量 $= \\iiint_V 3\\,dV = 3 \\times \\frac{4\\pi}{3} = 4\\pi \\approx 12.5663706$。直接算也一致：单位球面的外法向就是 $\\mathbf{n} = (x, y, z)$，所以 $\\mathbf{F} \\cdot \\mathbf{n} = x^2 + y^2 + z^2 = 1$，通量等于球面面积 $4\\pi$。若把外侧误取成内侧，答案会变成 $-4\\pi$。"
        },
        {
          id: "ma3-surface-integral-q3",
          type: "single",
          q: "用高斯公式计算曲面积分时，最常见的错误是下列哪一项？",
          options: [
            "曲面不封闭（例如只有上半球面）却直接套用高斯公式；正确做法是补上底面圆盘凑成闭曲面，再用闭曲面通量减去补面通量",
            "把散度误算成梯度",
            "把法向量取成单位向量",
            "把体积元 $dV$ 写成面积元 $dS$"
          ],
          answer: 0,
          why: "高斯公式的前提是「闭曲面 + 外侧 + 偏导连续」，非闭曲面必须补面，这是做题时最容易忽略的一步；例如上半球面（$\\mathbf{F} = (0,0,z)$）要先补 $z = 0$ 的圆盘，得闭曲面通量 $\\frac{2\\pi}{3}$，圆盘通量为 $0$，半球面通量才是 $\\frac{2\\pi}{3}$。选项 1、3 是计算失误而非方法错误，选项 2 说法本身正确（散度的定义里就用单位法向讨论通量密度），并非错误做法。"
        },
        {
          id: "ma3-surface-integral-q4",
          type: "multi",
          q: "关于斯托克斯公式 $\\oint_C \\mathbf{F} \\cdot d\\mathbf{r} = \\iint_S (\\nabla \\times \\mathbf{F}) \\cdot \\mathbf{n}\\,dS$，下列说法正确的是？",
          options: [
            "$C$ 是曲面 $S$ 的边界曲线，其方向与 $S$ 的定向按右手法则匹配",
            "取 $S$ 为平面区域、$\\mathbf{n}$ 为单位法向 $\\mathbf{k}$ 时，公式退化为格林公式",
            "$S$ 必须是与 $C$ 共面的平面区域",
            "公式要求 $\\mathbf{F}$ 的分量有连续偏导"
          ],
          answer: [0, 1, 3],
          why: "斯托克斯公式的完整条件是：$S$ 分片光滑且可定向、$C$ 是 $S$ 的边界并与之右手匹配、$\\mathbf{F}$ 分量连续可偏导。选项 2 是错的：任何以 $C$ 为边界的分片光滑有向曲面都可以，环量只依赖边界 $C$（这也是「换曲面环量不变」的来源）；把曲面限制成平面区域就丢掉了斯托克斯公式相对格林公式的一般性。选项 1 正是 $\\mathbf{n} = \\mathbf{k}$ 的退化情形。"
        }
      ]
    },

    /* ==================================================================== 第 5 讲 */
    {
      id: "ma3-ode-intro",
      title: "常微分方程初步：从一阶解法到皮卡迭代",
      goal: "会解可分离变量、齐次、一阶线性与伯努利方程，能叙述存在唯一性定理与皮卡迭代思想，掌握二阶常系数线性方程的解结构与特征方程法。",
      est: 50,
      blocks: [
        {
          type: "analogy",
          title: "微分方程是「变化的规则」，不是「求一个数」",
          md: "微分方程（differential equation）求的是**函数**，已知的是函数与它的导数之间的关系。三个原型：\n- 人口 / 细菌增长：增长速率与当前数量成正比，$N' = kN$，解是指数增长；\n- 放射性衰减：$N' = -kN$，解是指数衰减，半衰期由 $k$ 决定；\n- 弹簧振子：加速度与位移反向成正比，$m x'' = -k x$，解是正弦振荡，周期由 $\\frac{k}{m}$ 决定。\n几何直观：方程 $y' = f(x, y)$ 在平面每点给出一个斜率，解曲线就是「顺着这些小箭头走出来的路」，这叫方向场（direction field）。求初值问题等价于从给定点出发，沿方向场画一条光滑曲线。\n> 分析视角要回答两个问题：**解存在吗？唯一吗？**（存在唯一性定理与皮卡迭代）；**解能写成初等函数或级数吗？**（解法与级数解法）。"
        },
        {
          type: "concept",
          title: "基本概念与一阶方程的四类解法",
          md: "**基本概念**：方程中出现的最高阶导数的阶数称为方程的阶；若方程关于 $y$ 及其各阶导数是线性的，称为线性方程，否则称为非线性方程。$n$ 阶方程的通解含 $n$ 个独立任意常数；再加上 $n$ 个初值条件（$y(x_0)$、$y'(x_0)$、…）就得到特解，这样的问题叫初值问题（initial value problem）。\n**一阶方程的四类可解类型**：\n1. 可分离变量（separable）：$y' = f(x) g(y)$ $\\Rightarrow$ $\\int \\frac{dy}{g(y)} = \\int f(x)\\,dx$。要求 $g(y) \\ne 0$；**在除以 $g$ 之前，必须把 $g(y_0) = 0$ 给出的常数解 $y \\equiv y_0$ 单独记下来**。\n2. 齐次方程（homogeneous）：$y' = F\\left(\\frac{y}{x}\\right)$，令 $u = \\frac{y}{x}$ 化为可分离方程 $x u' = F(u) - u$。\n3. 一阶线性（first-order linear）：$y' + P(x) y = Q(x)$，积分因子 $\\mu = e^{\\int P\\,dx}$，通解 $y = \\frac{1}{\\mu}\\left(\\int \\mu Q\\,dx + C\\right)$；$Q \\equiv 0$ 时可直接分离变量。\n4. 伯努利方程（Bernoulli）：$y' + P(x) y = Q(x) y^n$（$n \\ne 0, 1$），令 $z = y^{1-n}$ 化为线性方程。\n**几何意义**：可分离变量对应方向场的斜率可分解成「只含 $x$」与「只含 $y$」两部分；积分因子法的本质是把左边凑成一个乘积的导数 $(\\mu y)'$。"
        },
        {
          type: "steps",
          title: "一阶线性方程的标准求解流程",
          items: [
            { t: "化成标准形", d: "整理成 $y' + P(x) y = Q(x)$，并指出 $P$、$Q$ 的连续区间——解只在这个区间内有效。" },
            { t: "求积分因子", d: "取 $\\mu(x) = e^{\\int P(x)\\,dx}$（任取一个原函数即可，常数因子不影响结果）。" },
            { t: "两边乘 μ 并凑导数", d: "左边恰好是 $(\\mu y)' = \\mu Q$，依据是乘积求导法则。" },
            { t: "两边积分", d: "$\\mu y = \\int \\mu Q\\,dx + C$，得到含一个常数的通解（隐式形式）。" },
            { t: "解出 y 并代入初值", d: "$y = \\frac{1}{\\mu}\\left(\\int \\mu Q\\,dx + C\\right)$，再用 $y(x_0) = y_0$ 定出 $C$，得到特解。" },
            { t: "说明有效区间与丢解", d: "写出最大存在区间；若过程中除以过可能为零的因式，补上被丢掉的常数解。" }
          ],
          note: "标准形、积分因子、常数 C 三件事写清楚，一阶线性方程就不会失分。"
        },
        {
          type: "concept",
          title: "存在唯一性定理与皮卡迭代思想",
          md: "**皮卡-林德勒夫定理（Picard-Lindelöf theorem）**：设 $f(x, y)$ 在矩形 $R = \\{|x - x_0| \\le a,\\ |y - y_0| \\le b\\}$ 上连续，且关于 $y$ 满足 **Lipschitz 条件（Lipschitz condition）**：存在常数 $L > 0$ 使 $|f(x, y_1) - f(x, y_2)| \\le L |y_1 - y_2|$ 对所有 $(x, y_1)$、$(x, y_2) \\in R$ 成立。则初值问题 $y' = f(x, y)$、$y(x_0) = y_0$ 在某个区间 $|x - x_0| \\le h$ 上**存在且唯一**，其中 $h = \\min(a, b/M)$，$M$ 是 $|f|$ 在 $R$ 上的上界。\n**为什么需要 Lipschitz 条件**：把初值问题改写成等价的积分方程 $y(x) = y_0 + \\int_{x_0}^x f(t, y(t))\\,dt$，并定义算子 $(Ty)(x) = y_0 + \\int_{x_0}^x f(t, y(t))\\,dt$。Lipschitz 条件保证 $T$ 在连续函数空间（上确界范数）上是压缩映射：$\\max|T y_1 - T y_2| \\le L h \\cdot \\max|y_1 - y_2|$，只要 $h < \\frac{1}{L}$，就能用**压缩映射原理（contraction mapping principle）**得到唯一不动点，也就是解。\n**皮卡迭代（Picard iteration）**：从 $y_0(x) \\equiv y_0$ 出发，令 $y_{n+1}(x) = y_0 + \\int_{x_0}^x f(t, y_n(t))\\,dt$，则 $\\{y_n\\}$ 在区间上一致收敛到解，并有误差估计 $|y_n(x) - y(x)| \\le \\frac{M L^n h^{n+1}}{(n+1)!}$ 型的界。\n**只有连续性时解可能不唯一**：$y' = 2\\sqrt{y}$，$y(0) = 0$ 同时有解 $y \\equiv 0$ 与 $y = x^2$（$x \\ge 0$），因为 $f = 2\\sqrt{y}$ 在 $y = 0$ 处不满足 Lipschitz 条件。\n**解只在局部存在**：$y' = y^2$，$y(0) = 1$ 的解是 $y = \\frac{1}{1 - x}$，到 $x = 1$ 就爆破，最大存在区间是 $(-\\infty, 1)$。"
        },
        {
          type: "interactive",
          lab: "datalab",
          title: "皮卡迭代单步演算：$y' = y$，$y(0) = 1$ 逐步逼近 $e^x$",
          config: {
            state: { 迭代次数: "n = 0", 近似解: "y₀(x) = 1", 在x1的值: 1, 与e的误差: "1.7182818", 误差上界: "e/1! = 2.7182818" },
            steps: [
              { desc: "把初值问题写成等价的积分方程：$y(x) = 1 + \\int_0^x y(t)\\,dt$，迭代从常函数 $y_0 \\equiv 1$ 开始。", state: { 迭代次数: "n = 0", 近似解: "y₀(x) = 1", 在x1的值: 1, 与e的误差: "1.7182818", 误差上界: "e/1! = 2.7182818", 说明: "皮卡迭代公式：y_{n+1}(x) = 1 + ∫₀^x y_n(t) dt" } },
              { desc: "第一次迭代：把 $y_0 = 1$ 代入积分。", state: { 迭代次数: "n = 1", 近似解: "y₁(x) = 1 + x", 在x1的值: 2, 与e的误差: "0.7182818", 误差上界: "e/2! = 1.3591409", 说明: "误差 = e - 2 = 0.7182818" } },
              { desc: "第二次迭代：代入 $y_1 = 1 + t$ 积分。", state: { 迭代次数: "n = 2", 近似解: "y₂(x) = 1 + x + x²/2", 在x1的值: 2.5, 与e的误差: "0.2182818", 误差上界: "e/3! = 0.4530470", 说明: "每次迭代恰好补上泰勒展开的一项" } },
              { desc: "第三次迭代：得到三次泰勒多项式。", state: { 迭代次数: "n = 3", 近似解: "y₃(x) = 1 + x + x²/2 + x³/6", 在x1的值: 2.6666667, 与e的误差: "0.0516152", 误差上界: "e/4! = 0.1132617", 说明: "y₃(1) 与 e 的差已降到 5% 左右" } },
              { desc: "第四次迭代。", state: { 迭代次数: "n = 4", 近似解: "y₄(x) = y₃(x) + x⁴/24", 在x1的值: 2.7083333, 与e的误差: "0.0099485", 误差上界: "e/5! = 0.0226523", 说明: "误差约 0.00995" } },
              { desc: "第五次迭代。", state: { 迭代次数: "n = 5", 近似解: "y₅(x) = y₄(x) + x⁵/120", 在x1的值: 2.7166667, 与e的误差: "0.0016152", 误差上界: "e/6! = 0.0037754", 说明: "误差约 0.00162" } },
              { desc: "第六次迭代：已经能看出 $y_n$ 就是 $e^x$ 的 $n$ 阶泰勒部分和。", state: { 迭代次数: "n = 6", 近似解: "y₆(x) = Σ (k 从 0 到 6) x^k/k!", 在x1的值: 2.7180556, 与e的误差: "0.0002263", 误差上界: "e/7! = 0.0005393", 说明: "误差约 2.26 × 10^(-4)" } },
              { desc: "第十次迭代：与 $e$ 的差进入 $10^{-8}$ 量级。", state: { 迭代次数: "n = 10", 近似解: "y₁₀(x) = Σ (k 从 0 到 10) x^k/k!", 在x1的值: 2.7182818, 与e的误差: "0.0000000273", 误差上界: "e/11! = 0.0000000681", 说明: "y_n 在 [0, 1] 上一致收敛到 e^x，误差上界 e/(n+1)! 随 n 迅速变小" } }
            ],
            tasks: [
              { t: "先手算 $y_1$ 与 $y_2$，再逐步点开核对。", check: "$y_1 = 1 + x$，$y_2 = 1 + x + \\frac{x^2}{2}$。" },
              { t: "把 $x = 1$ 换成 $x = 0.5$，用误差上界 $\\frac{e^{0.5} \\times 0.5^{11}}{11!}$ 估一下 $n = 10$ 的误差。", hint: "误差上界形如 $\\frac{e^x x^{n+1}}{(n+1)!}$", check: "得到约 $2 \\times 10^{-11}$，说明 $x$ 越小收敛越快。" }
            ]
          }
        },
        {
          type: "concept",
          title: "二阶常系数线性方程：解结构与特征方程法",
          md: "**二阶常系数线性方程**：$y'' + p y' + q y = f(x)$（$p$、$q$ 为常数）。齐次方程的解结构：若 $y_1$、$y_2$ 是齐次方程的两个线性无关解（Wronskian $W = y_1 y_2' - y_1' y_2 \\ne 0$），则齐次通解为 $C_1 y_1 + C_2 y_2$；非齐次方程的通解 = 对应齐次通解 + 一个特解。\n**特征方程法（characteristic equation）**：试 $y = e^{rx}$，代入得 $r^2 + p r + q = 0$。\n- 两个不同实根 $r_1 \\ne r_2$：通解 $C_1 e^{r_1 x} + C_2 e^{r_2 x}$；\n- 二重根 $r$：通解 $(C_1 + C_2 x) e^{rx}$（第二个解靠降阶或常数变易得到）；\n- 共轭复根 $\\alpha \\pm i\\beta$：通解 $e^{\\alpha x}(C_1 \\cos \\beta x + C_2 \\sin \\beta x)$，对应阻尼振动。\n**非齐次特解（待定系数法）**：当 $f(x) = P_m(x) e^{\\lambda x}$ 时试 $y_p = x^k Q_m(x) e^{\\lambda x}$，其中 $Q_m$ 是待定的 $m$ 次多项式，$k$ 是 $\\lambda$ 作为特征根的**重数**（$\\lambda$ 不是根取 $k = 0$，单根取 $k = 1$，重根取 $k = 2$）——「共振时乘 $x$」说的就是这一步。更一般的情形用常数变易公式 $y_p = -y_1 \\int \\frac{y_2 f}{W}\\,dx + y_2 \\int \\frac{y_1 f}{W}\\,dx$。\n**为什么特征方程法有效**：$e^{rx}$ 在求导下只差一个因子，把微分方程变成代数方程；解空间是二维线性空间，「解的线性组合仍是解」正是线性方程叠加原理的体现。"
        },
        {
          type: "concept",
          title: "级数解法初步与三个建模例子",
          md: "**级数解法（在常点附近）**：设方程在 $x_0$ 附近系数解析，令 $y = \\sum a_n (x - x_0)^n$，代入后比较同次幂系数，得到递推关系。例：Airy 方程 $y'' = x y$，取 $x_0 = 0$、$y(0) = 1$、$y'(0) = 0$。比较 $x^m$ 的系数得 $(m + 2)(m + 1) a_{m+2} = a_{m-1}$，即 $a_{n+2} = \\frac{a_{n-1}}{(n + 2)(n + 1)}$。于是 $a_0 = 1$、$a_3 = \\frac{1}{6}$、$a_6 = \\frac{1}{180}$、$a_9 = \\frac{1}{12960}$，得 $y = 1 + \\frac{x^3}{6} + \\frac{x^6}{180} + \\frac{x^9}{12960} + \\cdots$（对整个实轴收敛），在 $x = 1$ 处前四项给出 $1.1722994$。级数解法与皮卡迭代是同一件事的两种语言：一个按幂次组织，一个按迭代次数组织。\n**建模例 1（人口，logistic 模型）**：$N' = r N \\left(1 - \\frac{N}{K}\\right)$，解 $N = \\frac{K}{1 + C e^{-rt}}$：初期近似指数增长，后期趋于环境容量 $K$。它比单纯指数模型更真实，因为资源有限。\n**建模例 2（衰减与半衰期）**：$N' = -k N$ $\\Rightarrow$ $N = N_0 e^{-kt}$；半衰期 $T$ 满足 $e^{-kT} = \\frac{1}{2}$，即 $T = \\frac{\\ln 2}{k}$。取 $k = 0.1$ 得 $T = \\frac{\\ln 2}{0.1} \\approx 6.9314718$。\n**建模例 3（振动与能量）**：$x'' + \\omega^2 x = 0$ $\\Rightarrow$ $x = A \\cos(\\omega t + \\varphi)$，周期 $T = \\frac{2\\pi}{\\omega}$；能量 $E = \\frac{x'^2}{2} + \\frac{\\omega^2 x^2}{2}$ 沿解恒定（对 $t$ 求导即得 $0$）。这三例说明：**方程的类型决定了增长、衰减或振荡的行为**，而参数决定时间尺度。"
        },
        {
          type: "calc",
          title: "手算演练：一阶解法与二阶特征方程",
          inputs: [
            { name: "题目 1", value: "$\\frac{dy}{dx} = x y$，$y(0) = 1$，求 $y(1)$" },
            { name: "题目 2", value: "$y' + y = x$，$y(0) = 0$，求 $y(1)$" },
            { name: "题目 3", value: "$y' = y - y^2$，$y(0) = \\frac{1}{2}$，求 $y(1)$" },
            { name: "题目 4", value: "$y'' - 3y' + 2y = 0$，$y(0) = 0$，$y'(0) = 1$，求 $y(1)$" },
            { name: "题目 5", value: "$y'' - 3y' + 2y = e^x$ 的一个特解" }
          ],
          outputs: [
            "1) 分离变量：$\\int \\frac{dy}{y} = \\int x\\,dx$ $\\Rightarrow$ $\\ln|y| = \\frac{x^2}{2} + C$ $\\Rightarrow$ $y = e^{x^2/2}$；$y(1) = \\sqrt{e} \\approx 1.6487213$",
            "2) 积分因子 $\\mu = e^x$：$(y e^x)' = x e^x$ $\\Rightarrow$ $y = x - 1 + e^{-x}$；$y(1) = e^{-1} \\approx 0.3678794$，$y(2) = 1 + e^{-2} \\approx 1.1353353$",
            "3) 可分离（logistic）：$\\frac{dy}{y(1 - y)} = dx$ $\\Rightarrow$ $y = \\frac{1}{1 + e^{-x}}$；$y(1) = 0.7310586$，$y(2) = 0.8807971$",
            "4) 特征方程 $r^2 - 3r + 2 = 0$ $\\Rightarrow$ $r = 1, 2$；由初值定出 $y = e^{2x} - e^x$；$y(1) = e^2 - e \\approx 4.6707743$",
            "5) $r = 1$ 是单根（共振），设 $y_p = A x e^x$，代入得 $-A e^x = e^x$ $\\Rightarrow$ $A = -1$，故 $y_p = -x e^x$",
            "补充：半衰期 $T = \\frac{\\ln 2}{k}$，$k = 0.1$ 时 $T \\approx 6.9314718$；$y'' + 4y = 0$ 的通解是 $C_1 \\cos 2x + C_2 \\sin 2x$，周期 $\\pi \\approx 3.1415927$"
          ],
          note: "先判断方程类型再动手；分离变量时若除以可能为零的因式，务必单独检查丢掉的常数解。"
        },
        {
          type: "pitfall",
          title: "易错点：丢解、漏常数与共振",
          items: [
            { t: "分离变量时丢掉常数解", d: "解 $y' = y(1 - y)$ 时两边除以 $y(1 - y)$，就默认了 $y \\ne 0$ 且 $y \\ne 1$；而 $y \\equiv 0$ 与 $y \\equiv 1$ 同样是解，必须单独列出。" },
            { t: "通解的常数个数不对", d: "二阶方程的通解必须含两个独立常数；只写一个说明丢了一整族解，代入初值条件时也会立刻暴露。" },
            { t: "共振时特解形式不乘 x", d: "解 $y'' - 3y' + 2y = e^x$ 时若设 $y_p = A e^x$，左边恒为 $0$，凑不出 $e^x$；因为 $r = 1$ 是特征根，应设 $y_p = A x e^x$，代入得 $A = -1$。" },
            { t: "把 Lipschitz 条件当成连续性的同义词", d: "$f = 2\\sqrt{y}$ 在 $y = 0$ 附近连续但不满足 Lipschitz 条件，初值问题 $y(0) = 0$ 有无穷多解；存在唯一性定理的结论不能只靠连续性支撑。" },
            { t: "忘记解只在局部存在", d: "皮卡迭代只保证某个小区间上有解；$y' = y^2$、$y(0) = 1$ 的解 $y = \\frac{1}{1 - x}$ 到 $x = 1$ 就爆破，最大存在区间是 $(-\\infty, 1)$。" }
          ]
        }
      ],
      quiz: [
        {
          id: "ma3-ode-intro-q1",
          type: "single",
          q: "皮卡-林德勒夫存在唯一性定理中，要求 $f(x, y)$ 关于 $y$ 满足 Lipschitz 条件，它的作用是？",
          options: [
            "保证皮卡迭代的积分算子 $T$ 是压缩映射，从而迭代序列收敛到唯一解",
            "保证 $f(x, y)$ 连续",
            "保证解可以延拓到整个实轴",
            "保证微分方程是线性的"
          ],
          answer: 0,
          why: "把初值问题写成积分方程 $y = y_0 + \\int f(t, y)\\,dt$ 后，Lipschitz 条件给出 $\\max|T y_1 - T y_2| \\le L h \\cdot \\max|y_1 - y_2|$；只要区间足够短（$h < \\frac{1}{L}$），$T$ 就是压缩映射，由压缩映射原理得到唯一不动点即唯一解，迭代序列同时收敛。选项 1 说反了：连续性是定理的另一个前提，Lipschitz 比连续更强。选项 2 错：定理只保证局部解，$y' = y^2$ 的解会在有限点爆破。选项 3 错：Lipschitz 条件与线性无关，$y' = \\sin y$ 也满足。"
        },
        {
          id: "ma3-ode-intro-q2",
          type: "fill",
          q: "$y' = y - y^2$，$y(0) = \\frac{1}{2}$ 的解在 $x = 1$ 处的值约为 ____（保留三位小数）",
          answer: ["0.731", "0.7311", "0.73106"],
          why: "这是 logistic 方程 $y' = y(1 - y)$，分离变量得 $y = \\frac{1}{1 + e^{-x}}$（由 $y(0) = \\frac{1}{2}$ 定出常数为 $1$），代入 $x = 1$ 得 $\\frac{1}{1 + e^{-1}} \\approx 0.7310586$。检验方式：把 $y(1 - y)$ 展开并与 $y'$ 比较，或检查 $x \\to \\infty$ 时解趋于 $1$（环境容量）。"
        },
        {
          id: "ma3-ode-intro-q3",
          type: "order",
          q: "把「解一阶线性方程 $y' + P(x) y = Q(x)$」的步骤排成正确顺序。",
          items: [
            "两边同乘积分因子 $\\mu = e^{\\int P\\,dx}$，左边写成 $(\\mu y)'$",
            "把方程整理成标准形 $y' + P(x) y = Q(x)$，并写出 $P$、$Q$ 的连续区间",
            "代入初值条件定出常数 $C$，得到特解",
            "两边积分得 $\\mu y = \\int \\mu Q\\,dx + C$",
            "解出通解 $y = \\frac{1}{\\mu}\\left(\\int \\mu Q\\,dx + C\\right)$"
          ],
          answer: [1, 0, 3, 4, 2],
          why: "正确顺序是先化标准形并确定有效区间（第 2 项），再乘积分因子把左边凑成 $(\\mu y)'$（第 1 项），两边积分得到隐式通解（第 4 项），解出 $y$ 得通解（第 5 项），最后用初值定常数得特解（第 3 项）。先乘因子而不先化标准形会取错 $P(x)$，先解出 $y$ 再定常数则容易漏掉常数项。"
        },
        {
          id: "ma3-ode-intro-q4",
          type: "single",
          q: "求 $y'' - 3y' + 2y = e^x$ 的一个特解时，应该设成什么形式？",
          options: [
            "$y_p = A x e^x$，因为 $r = 1$ 是特征方程的单根（共振情形）",
            "$y_p = A e^x$",
            "$y_p = A x^2 e^x$",
            "$y_p = A e^{2x}$"
          ],
          answer: 0,
          why: "特征方程 $r^2 - 3r + 2 = 0$ 的根是 $r = 1$ 与 $r = 2$，而右端 $e^x$ 对应 $\\lambda = 1$，恰好是单根，所以特解要乘 $x$ 一次：$y_p = A x e^x$，代入得 $-A e^x = e^x$，即 $A = -1$。选项 1 直接设 $A e^x$ 会因为 $e^x$ 本身是齐次解而左边恒为 $0$，凑不出 $e^x$；选项 2 乘 $x^2$ 是重根情形的做法，这里会导致多出一个无法消去的 $x$ 项；选项 3 用的是齐次解 $e^{2x}$，代入左边也是 $0$。"
        }
      ]
    }
  ]
});
