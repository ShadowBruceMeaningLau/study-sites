window.COURSE_PACKS.push({
  id: "differential-geometry",
  title: "微分几何",
  icon: "🌀",
  term: "大四上",
  advanced: {texts:["do Carmo《曲线与曲面的微分几何》或《微分几何初步》陈维桓","《微分几何及其应用》Pressley（友好）"],labs:["手算曲线曲率挠率、曲面第一/第二基本形式各 10 题","用程序算球面/环面的高斯曲率并可视化"],project:"写一个曲面曲率可视化工具，实测高斯-博内定理",criteria:"能区分内蕴与外蕴；能独立计算高斯曲率并解释绝妙定理的含义"},
  need: "建议先学「高等代数（一）」与「数学分析（三）」；本课用到多元微分与线性代数。",
  hours: 64,
  blurb: "把「弯曲」变成能算的量：从曲线的曲率与挠率、Frenet 标架，到曲面的第一、第二基本形式，再到高斯绝妙定理、测地线与高斯-博内定理，最后走向流形、黎曼度量与霍奇理论。",
  tags: ["数学主干", "几何", "分析"],
  lessons: [
    {
      id: "dg-curve",
      title: "曲线论：弧长参数化、曲率、挠率与 Frenet 标架",
      goal: "能把参数曲线改写成弧长参数，独立算出曲率 $\\kappa$ 与挠率 $\\tau$，写出 Frenet 标架并逐项验证 Frenet-Serret 公式，说清旋转指标、等周不等式与空间曲线基本定理的含义。",
      est: 75,
      blocks: [
        {
          type: "analogy",
          title: "几何直观：曲率是「转弯的快慢」，挠率是「离开平面的快慢」",
          md: "把一条曲线想象成一条公路，你开着车沿它行驶：\n\n- **曲率（curvature）** 衡量方向盘转得多快。单位弧长上切向量转过的角度就是曲率：直路的曲率是 0，急弯的曲率大，半径 $r$ 的圆周转一整圈正好转过 $2\\pi$，所以曲率恰好是 $\\frac{1}{r}$。这就是「曲率 = 弯曲程度」的精确化。\n- **挠率（torsion）** 衡量公路本身有没有「拧」。一条完全躺在一张平面上的公路挠率为 0；螺旋线（盘山公路、弹簧、DNA 双螺旋）一边转一边往上爬，就需要挠率来描述它离开当前平面的快慢。\n- 生活里的常数曲率常数挠率曲线就是**圆柱螺旋线（helix）**：楼梯扶手、螺纹、铁轨的过渡段都是它。铁轨在直线与圆弧之间还专门插入「回旋线（clothoid）」，因为回旋线的曲率与弧长成正比，方向盘可以匀速打，乘客不会被突然的曲率跳变甩一下。\n\n把三个互相垂直的单位向量绑在曲线的每一点上——切向量 $\\mathbf{T}$、主法向量 $\\mathbf{N}$、副法向量 $\\mathbf{B}$——就得到随曲线移动的活动坐标系，称为 **Frenet 标架（Frenet frame）**。它的意义是：曲线的全部弯曲信息，都可以翻译成「这个标架怎么随弧长转动」：绕 $\\mathbf{B}$ 转的快慢是曲率 $\\kappa$，绕 $\\mathbf{T}$ 转的快慢是挠率 $\\tau$。于是空间曲线基本定理说：$\\kappa$ 与 $\\tau$ 这两个函数就把曲线（在刚体运动意义下）完全决定了。\n\n> 直观只负责给方向：$\\kappa$ 与 $\\tau$ 的具体数值必须回到导数与叉积去算，「看起来弯」不能代替计算。"
        },
        {
          type: "concept",
          title: "参数曲线与弧长参数化：为什么要在弧长参数下算",
          md: "**定义**：参数曲线（parametric curve）是一个光滑映射 $\\mathbf{r}: I \\to \\mathbb{R}^3$，$t \\mapsto \\mathbf{r}(t) = (x(t), y(t), z(t))$，其中 $I$ 是区间。若处处 $\\mathbf{r}'(t) \\ne 0$，称曲线是**正则的（regular）**。\n\n**为什么必须要求正则**：切向量 $\\mathbf{r}'(t)$ 是曲线在该点的速度。若 $\\mathbf{r}'(t) = 0$，速度为零，切线方向无从谈起，曲率公式的分母也会变成 0；更本质地说，只有 $\\mathbf{r}'(t) \\ne 0$ 才能保证**弧长参数化存在**：弧长函数\n\n$$ s(t) = \\int_{t_0}^{t} |\\mathbf{r}'(u)|\\,du $$\n\n满足 $\\frac{ds}{dt} = |\\mathbf{r}'(t)| > 0$，是严格单调的光滑函数，由反函数定理它有光滑的反函数 $t = t(s)$。把 $t$ 用 $s$ 替换回 $\\mathbf{r}$，就得到以弧长为参数的表示。这一步「为什么合法」完全依赖 $|\\mathbf{r}'| > 0$，而不是别的什么。\n\n**三个立刻的化简**：在弧长参数下记 $\\mathbf{r}(s)$：\n\n- $\\left|\\frac{d\\mathbf{r}}{ds}\\right| \\equiv 1$，速率恒为 $1$，弧长就是参数本身；\n- 曲率 $\\kappa = \\left|\\frac{d^2\\mathbf{r}}{ds^2}\\right|$，因为切向量 $\\mathbf{T} = \\frac{d\\mathbf{r}}{ds}$ 已经是单位向量，它的变化率大小就是转弯的角速度；\n- 挠率 $\\tau = \\frac{(\\mathbf{r}', \\mathbf{r}'', \\mathbf{r}''')}{|\\mathbf{r}' \\times \\mathbf{r}''|^2}$ 中的分母变成 $1$，直接读三阶导数的混合积。\n\n**一个例子算到底**：圆 $\\mathbf{r}(t) = (R\\cos t, R\\sin t, 0)$ 的速率 $|\\mathbf{r}'| = R$ 是常数，于是 $s = Rt$，弧长参数表示是 $\\mathbf{r}(s) = (R\\cos(s/R), R\\sin(s/R), 0)$。而螺旋线 $\\mathbf{r}(t) = (\\cos t, \\sin t, t)$ 的速率是常数 $\\sqrt{2}$，于是 $s = \\sqrt{2}\\,t$。速率是常数意味着参数与弧长只差一个伸缩因子，这也是这类曲线的导数计算特别干净的原因。\n\n**关键观念**：曲率与挠率是曲线的**几何不变量**，与选取哪个参数无关。换参数化后中间量 $|\\mathbf{r}'|$ 会变，但 $\\kappa$、$\\tau$ 不变；如果换完参数结果变了，那一定是算错了。"
        },
        {
          type: "concept",
          title: "曲率、挠率与 Frenet-Serret 公式：反对称性一步到位",
          md: "**三个向量**：设 $\\mathbf{r}(t)$ 正则，令\n\n- 切向量 $\\mathbf{T} = \\mathbf{r}'/|\\mathbf{r}'|$；\n- 主法向量 $\\mathbf{N} = \\mathbf{T}'/|\\mathbf{T}'|$（要求 $\\kappa > 0$，否则 $\\mathbf{N}$ 不唯一）；\n- 副法向量 $\\mathbf{B} = \\mathbf{T} \\times \\mathbf{N}$。\n\n因为 $|\\mathbf{T}| \\equiv 1$，求导得 $\\mathbf{T} \\cdot \\mathbf{T}' = 0$，即 $\\mathbf{T}' \\perp \\mathbf{T}$；又 $\\mathbf{B} \\perp \\mathbf{T}$，所以在每一点 $\\{\\mathbf{N}, \\mathbf{B}\\}$ 是垂直于 $\\mathbf{T}$ 的平面的一组正交基，于是 $\\mathbf{T}'$ 只能写成 $a\\mathbf{N} + b\\mathbf{B}$。**再算一步**：$\\mathbf{B} \\cdot \\mathbf{T} \\equiv 0$ 两边求导得 $\\mathbf{B}' \\cdot \\mathbf{T} + \\mathbf{B} \\cdot \\mathbf{T}' = 0$，而 $\\mathbf{B} \\cdot \\mathbf{T}' = b$（因为 $\\mathbf{T}'$ 的 $\\mathbf{B}$ 分量就是 $\\mathbf{B} \\cdot \\mathbf{T}'$），于是 $b = -\\mathbf{B}' \\cdot \\mathbf{T} = \\mathbf{T} \\cdot \\mathbf{B}'$；把这个结果与 $\\mathbf{T}'$ 的表达式合起来看，正是「导数矩阵反对称」的雏形。\n\n**Frenet-Serret 公式**（$v = |\\mathbf{r}'|$ 是速率）：\n\n- $\\mathbf{T}' = \\kappa v\\mathbf{N}$\n- $\\mathbf{N}' = -\\kappa v\\mathbf{T} + \\tau v\\mathbf{B}$\n- $\\mathbf{B}' = -\\tau v\\mathbf{N}$\n\n**为什么是反对称的**：把 $(\\mathbf{T}, \\mathbf{N}, \\mathbf{B})$ 写成列向量 $M(t)$，则 $M$ 的每列是单位向量且两两正交，所以 $M^{\\mathrm{T}}M = I$。对 $t$ 求导得 $M^{\\mathrm{T}}M' + (M')^{\\mathrm{T}}M = 0$，即矩阵 $\\Omega = M^{\\mathrm{T}}M'$ 是**反对称矩阵**：$\\Omega + \\Omega^{\\mathrm{T}} = 0$。三维反对称矩阵只有 3 个独立分量，分别对应「绕 T 转」「绕 N 转」「绕 B 转」。Frenet-Serret 公式只是给这三个分量起了名字：绕 B 转的分量记为 $\\kappa v$，绕 T 转的分量记为 $-\\tau v$，而绕 N 转的分量恰好为 $0$（可以证明 $\\Omega$ 的 $(1,3)$ 项是 $\\mathbf{T}' \\cdot \\mathbf{B} = 0$）。**这一步是整个曲线论的枢纽**：不需要任何几何技巧，正交矩阵求导必得反对称矩阵。\n\n**三个量的计算公式**（非弧长参数下的通用版本，务必背分母的幂次）：\n\n- $\\kappa = \\frac{|\\mathbf{T}'|}{|\\mathbf{r}'|} = \\frac{|\\mathbf{r}' \\times \\mathbf{r}''|}{|\\mathbf{r}'|^3}$\n- $\\tau = -\\frac{\\mathbf{B}' \\cdot \\mathbf{N}}{|\\mathbf{r}'|} = \\frac{(\\mathbf{r}', \\mathbf{r}'', \\mathbf{r}''')}{|\\mathbf{r}' \\times \\mathbf{r}''|^2}$，其中 $(\\mathbf{r}', \\mathbf{r}'', \\mathbf{r}''')$ 是三个向量张成的平行六面体有向体积（混合积）。\n\n**特别提醒**：$\\kappa \\ge 0$ 恒成立，而 $\\tau$ 可以为负。$\\tau$ 的符号反映曲线「左手拧还是右手拧」，把曲线作镜像反射，$\\tau$ 变号。\n\n**空间曲线基本定理**：给定区间 $I$ 上的连续函数 $\\kappa(t) > 0$ 与 $\\tau(t)$，必存在以它们为曲率与挠率的正则曲线，且这样的曲线在刚体运动（平移 + 旋转，可能再加一个反射）意义下唯一。证明思路是：把 Frenet-Serret 公式当成关于标架 $(\\mathbf{T}, \\mathbf{N}, \\mathbf{B})$ 的线性常微分方程组，由解的存在唯一性定理得到唯一解，再由 $\\mathbf{T}$ 积分出曲线 $\\mathbf{r}$。**为什么要 $\\kappa > 0$**：$\\kappa = 0$ 时 $\\mathbf{N}$ 没有定义，方程组退化，直线就无法用这个框架唯一描述。"
        },
        {
          type: "calc",
          title: "手算演练：螺旋线 $\\mathbf{r}(t) = (\\cos t, \\sin t, t)$ 的弧长、曲率与挠率",
          inputs: [
            { name: "曲线", value: "$\\mathbf{r}(t) = (\\cos t, \\sin t, t)$，$t \\in [0, 2\\pi]$" },
            { name: "要求", value: "弧长 $s(t)$、曲率 $\\kappa$、挠率 $\\tau$、Frenet 标架在 $t = 0$ 与 $t = \\frac{\\pi}{2}$ 的值" }
          ],
          outputs: [
            "$\\mathbf{r}'(t) = (-\\sin t, \\cos t, 1)$，$|\\mathbf{r}'(t)| = \\sqrt{\\sin^2 t + \\cos^2 t + 1} = \\sqrt{2}$（常数，所以 $s = \\sqrt{2}\\,t$，$t$ 不是弧长参数）",
            "总弧长 $s(2\\pi) = \\sqrt{2} \\times 2\\pi = 2\\sqrt{2}\\,\\pi \\approx 8.8858$",
            "$\\mathbf{r}''(t) = (-\\cos t, -\\sin t, 0)$；$\\mathbf{r}' \\cdot \\mathbf{r}'' = \\sin t\\cos t - \\cos t\\sin t + 0 = 0$，速度与加速度处处垂直（速率恒定时必然如此）",
            "$\\mathbf{r}'(t) \\times \\mathbf{r}''(t) = (\\sin t, -\\cos t, 1)$，于是 $|\\mathbf{r}' \\times \\mathbf{r}''| = \\sqrt{\\sin^2 t + \\cos^2 t + 1} = \\sqrt{2}$",
            "$\\kappa = \\frac{|\\mathbf{r}' \\times \\mathbf{r}''|}{|\\mathbf{r}'|^3} = \\frac{\\sqrt{2}}{(\\sqrt{2})^3} = \\frac{\\sqrt{2}}{2\\sqrt{2}} = \\frac{1}{2} = 0.5$（常数：螺旋线是常曲率曲线）",
            "$\\mathbf{r}'''(t) = (\\sin t, -\\cos t, 0)$，混合积 $(\\mathbf{r}', \\mathbf{r}'', \\mathbf{r}''') = (\\sin t)(\\sin t) + (-\\cos t)(-\\cos t) + 1 \\times 0 = 1$",
            "$\\tau = \\frac{(\\mathbf{r}', \\mathbf{r}'', \\mathbf{r}''')}{|\\mathbf{r}' \\times \\mathbf{r}''|^2} = \\frac{1}{2} = 0.5$（常数：$\\kappa = \\tau = 0.5$ 是这条螺旋线的特征）",
            "$t = 0$：$\\mathbf{T} = (0, 1, 1)/\\sqrt{2} \\approx (0, 0.7071, 0.7071)$，$\\mathbf{N} = (-\\cos 0, -\\sin 0, 0) = (-1, 0, 0)$，$\\mathbf{B} = \\mathbf{T} \\times \\mathbf{N} \\approx (0, -0.7071, 0.7071)$",
            "$t = \\frac{\\pi}{2}$：$\\mathbf{T} = (-1, 0, 1)/\\sqrt{2} \\approx (-0.7071, 0, 0.7071)$，$\\mathbf{N} = (0, -1, 0)$，$\\mathbf{B} \\approx (0.7071, 0, 0.7071)$",
            "不变量检查：$\\kappa^2 + \\tau^2 = 0.25 + 0.25 = 0.5$，恰好等于 $\\frac{1}{|\\mathbf{r}'|^2} = \\frac{1}{2}$，与螺旋线的恒等式 $\\kappa^2 + \\tau^2 = \\frac{1}{c^2}$（$c$ 为速率）一致",
            "对照：圆 $\\mathbf{r}(t) = (2\\cos t, 2\\sin t, 0)$ 的 $\\kappa = \\frac{1}{2} = 0.5$、$\\tau = 0$。两者曲率相同而挠率不同，所以它们不是同一条曲线——这正是「$\\kappa$ 与 $\\tau$ 一起才决定曲线」的直接证据"
          ],
          note: "整条螺旋线的 $\\kappa$、$\\tau$ 都只用 $\\mathbf{r}'$、$\\mathbf{r}''$、$\\mathbf{r}'''$ 三个向量算出来，这就是非弧长参数下最省事的算法。分母上 $|\\mathbf{r}'|^3$ 与 $|\\mathbf{r}' \\times \\mathbf{r}''|^2$ 的幂次是最容易丢分的地方，建议每算一次都回头检查量纲：$\\kappa$ 的单位是 1/长度，$\\tau$ 也是 1/长度。"
        },
        {
          type: "interactive",
          lab: "datalab",
          title: "Frenet 标架逐步计算：$\\mathbf{r}(t) = (\\cos t, \\sin t, t)$",
          config: {
            state: { t: 0, 位置: "(1, 0, 0)", 切向量T: "待算", 主法向量N: "待算", 副法向量B: "待算", 曲率κ: "待算", 挠率τ: "待算" },
            steps: [
              { desc: "第一步：写出曲线与它的前三个导数（先求导，后代入数值）", state: { 参数曲线: "r(t) = (cos t, sin t, t)", "r'(t)": "(-sin t, cos t, 1)", "r''(t)": "(-cos t, -sin t, 0)", "r'''(t)": "(sin t, -cos t, 0)" }, note: "r'' 与 r''' 会一直用到最后算挠率，先一次性写清楚，避免中途重复求导出错。" },
              { desc: "第二步：取 $t = 0$，写出位置与速度，并检查正则性", state: { t: 0, 位置: "(1, 0, 0)", "r'(0)": "(0, 1, 1)", "速率|r'(0)|": "√2 ≈ 1.4142", 是否正则: "是（速度为非零向量）" }, note: "速率为常数 $\\sqrt{2}$，所以弧长 $s = \\sqrt{2}\\,t$ 与参数 $t$ 只差一个常数因子。" },
              { desc: "第三步：单位化速度，得到切向量 $\\mathbf{T}$", state: { T: "(0, 1, 1)/√2 ≈ (0, 0.7071, 0.7071)", "|T|": 1, 用途: "T 是标架的第一根轴" }, note: "单位化就是除以 $|\\mathbf{r}'|$；这一步之后所有向量都应该是单位长度。" },
              { desc: "第四步：把加速度中平行于 $\\mathbf{T}$ 的部分减掉", state: { "r''(0)": "(-1, 0, 0)", "r''(0)·T": 0, "r'' - (r''·T)T": "(-1, 0, 0)", 解读: "加速度没有切向分量（因为速率恒定）" }, note: "若 $\\mathbf{r}'' \\cdot \\mathbf{T}$ 不为 $0$，必须先减掉这个投影，否则剩下的向量不垂直于 $\\mathbf{T}$，也就不能当 $\\mathbf{N}$。" },
              { desc: "第五步：单位化得到 $\\mathbf{N}$，再用叉积得到 $\\mathbf{B}$，验证右手正交", state: { N: "(-1, 0, 0)", "B = T × N": "(0, -0.7071, 0.7071)", 正交性检查: "T·N = 0、T·B = 0、N·B = 0", 定向: "T × N = B，构成右手系" }, note: "$\\mathbf{N}$ 指向曲线弯曲的内侧（密切圆圆心一侧），$\\mathbf{B}$ 垂直于密切平面。" },
              { desc: "第六步：算曲率，注意分母是 $|\\mathbf{r}'|$ 的三次方", state: { "r'(0)×r''(0)": "(0, -1, 1)", "|r'×r''|": "√2 ≈ 1.4142", "|r'|³": "(√2)³ = 2√2 ≈ 2.8284", κ: "√2 / (2√2) = 0.5" }, note: "$\\kappa = \\frac{|\\mathbf{r}' \\times \\mathbf{r}''|}{|\\mathbf{r}'|^3}$ 是通用公式；只有当 $\\mathbf{r}' \\perp \\mathbf{r}''$ 时才能化简成 $\\frac{|\\mathbf{r}''|}{|\\mathbf{r}'|^2}$，别把特例当定义。" },
              { desc: "第七步：算挠率（混合积除以叉积模的平方）", state: { "(r', r'', r''')": 1, "|r'×r''|²": 2, τ: "1 / 2 = 0.5", 解读: "κ = τ = 0.5：这条螺旋线既在弯又在拧" }, note: "混合积为正是右手拧；把 $t$ 换成 $-t$，混合积变号，曲线镜像，挠率随之为负。" },
              { desc: "第八步：换到 $t = \\frac{\\pi}{2}$ 复核（标架在转，$\\kappa$ 与 $\\tau$ 不变）", state: { t: "π/2 ≈ 1.5708", 位置: "(0, 1, 1.5708)", T: "(-0.7071, 0, 0.7071)", N: "(0, -1, 0)", B: "(0.7071, 0, 0.7071)", κ: 0.5, τ: 0.5 }, note: "标架随点转动正是 Frenet-Serret 公式的内容：$\\mathbf{T}' = \\kappa v\\mathbf{N}$、$\\mathbf{N}' = -\\kappa v\\mathbf{T} + \\tau v\\mathbf{B}$、$\\mathbf{B}' = -\\tau v\\mathbf{N}$，其中 $v = \\sqrt{2}$。" },
              { desc: "第九步：收尾——把结果读成几何结论", state: { 弧长: "s = √2 t，t ∈ [0, 2π] 对应总长 ≈ 8.8858", 曲率: "κ ≡ 0.5（处处一样弯）", 挠率: "τ ≡ 0.5（处处一样拧）", 结论: "圆柱螺旋线是唯一的「常曲率且常挠率」空间曲线（κ、τ 都非零）" } }
            ],
            tasks: [
              { t: "自己取 $t = 0.7$ 重算整套标架，并检查 $\\mathbf{T}$、$\\mathbf{N}$、$\\mathbf{B}$ 两两垂直。", hint: "$\\mathbf{T} \\approx (-0.4555, 0.5408, 0.7071)$，$\\mathbf{N} = (-\\cos 0.7, -\\sin 0.7, 0) \\approx (-0.7648, -0.6442, 0)$。" },
              { t: "把曲线换成 $\\mathbf{r}(t) = (2\\cos t, 2\\sin t, t)$，先按公式预测 $\\kappa$ 与 $\\tau$，再逐项算一遍验证。", check: "能说出为什么 $\\kappa$ 变成 $\\frac{2}{5} = 0.4$、$\\tau$ 变成 $\\frac{1}{5} = 0.2$（螺旋线公式 $\\kappa = \\frac{a}{a^2+b^2}$、$\\tau = \\frac{b}{a^2+b^2}$，这里 $a = 2$、$b = 1$）。" }
            ]
          }
        },
        {
          type: "interactive",
          lab: "datalab",
          title: "螺旋线 / 圆 / 直线：曲率与挠率的对比",
          config: {
            state: { 曲线: "圆（R = 2）", 曲率κ: "待算", 挠率τ: "待算", 速率: "待算", 结论: "待算" },
            steps: [
              { desc: "第一条：圆 $\\mathbf{r}(t) = (2\\cos t, 2\\sin t, 0)$", state: { 曲线: "圆 R = 2", "r'(t)": "(-2sin t, 2cos t, 0)", 速率: "2（常数）", κ: "1/R = 0.5", τ: 0, 弧长: "2πR = 4π ≈ 12.5664" }, note: "圆的挠率为 $0$，因为它整条躺在一张平面内；$\\kappa$ 恰好是半径的倒数。" },
              { desc: "第二条：直线 $\\mathbf{r}(t) = (1, 2, 3) + t(1, 1, 0)$", state: { 曲线: "直线", "r'(t)": "(1, 1, 0)", 速率: "√2 ≈ 1.4142", κ: 0, τ: 0, Frenet标架: "不存在唯一的 N（切向量永不转动）" }, note: "$\\kappa \\equiv 0$ 是直线的判别准则。这时 $\\mathbf{T}' = 0$，$\\mathbf{N}$ 无定义，Frenet 标架退化——这正是基本定理要求 $\\kappa > 0$ 的原因。" },
              { desc: "第三条：螺旋线 $\\mathbf{r}(t) = (\\cos t, \\sin t, t)$（$a = 1, b = 1$）", state: { 曲线: "螺旋线 a=1 b=1", 速率: "√(a²+b²) = √2 ≈ 1.4142", κ: "a/(a²+b²) = 0.5", τ: "b/(a²+b²) = 0.5", 检查: "κ² + τ² = 0.5 = 1/速率²" }, note: "$\\kappa$ 与 $\\tau$ 都不为零，所以它既弯又拧，且弯曲与扭转的「强度」相同。" },
              { desc: "第四条：把半径参数换成 $a = 2$、$b = 1$", state: { 曲线: "螺旋线 a=2 b=1", 速率: "√5 ≈ 2.2361", κ: "2/5 = 0.4", τ: "1/5 = 0.2", 检查: "0.16 + 0.04 = 0.2 = 1/5" }, note: "圈变大、上升变慢：$\\kappa$ 与 $\\tau$ 同时变小，但 $\\kappa$ 仍大于 $\\tau$。" },
              { desc: "第五条：再换成 $a = 1$、$b = 2$（圈小、上升快）", state: { 曲线: "螺旋线 a=1 b=2", 速率: "√5 ≈ 2.2361", κ: "1/5 = 0.2", τ: "2/5 = 0.4", 检查: "0.04 + 0.16 = 0.2 = 1/5", τ比κ: "τ/κ = b/a = 2" }, note: "与第四条相比，速率相同而 $\\kappa$、$\\tau$ 互换。两条曲线形状完全不同，但 $\\kappa^2 + \\tau^2$ 相等。" },
              { desc: "第六条：直接对比「$\\kappa$ 相同」的两条曲线", state: { 圆R2: "κ = 0.5，τ = 0", 螺旋线a1b1: "κ = 0.5，τ = 0.5", 判断: "无法通过刚体运动把一个变成另一个", 依据: "空间曲线基本定理：κ 与 τ 一起才是不变量组" }, note: "这是「曲率相同不等于曲线相同」的标准反例：必须把挠率一起比较。" },
              { desc: "第七条：读出螺旋线的两个结构常数", state: { "τ/κ 圆": "无定义（τ = 0）", "τ/κ 螺旋线a=1,b=1": "1", "τ/κ 螺旋线a=2,b=1": "0.5", "τ/κ 螺旋线a=1,b=2": 2, 含义: "τ/κ = b/a 就是螺旋线的「螺距角」正切值" }, note: "螺旋线沿圆柱面上升，把圆柱剪开展平后它变成一条直线，直线的斜率正是 $b/a$，所以 $\\tau/\\kappa$ 是内蕴于这条曲线的形状参数。" },
              { desc: "第八条：归纳三条分类准则", state: { "κ≡0": "直线（或直线段）", "κ 不恒为 0、τ≡0": "平面曲线（可含直的部分）", "κ、τ 均为非零常数": "圆柱螺旋线", 总结: "κ 度量「弯」，τ 度量「拧」；两者都是参数化不变量" } }
            ],
            tasks: [
              { t: "把圆的半径改成 3，重新填一遍 $\\kappa$、$\\tau$、弧长三栏，说明为什么 $\\tau$ 始终为 $0$。", hint: "平面曲线的挠率恒为 $0$，因为副法向量恒定，$\\mathbf{B}' = -\\tau v\\mathbf{N} = 0$ 迫使 $\\tau = 0$。" },
              { t: "对螺旋线 $\\mathbf{r}(t) = (3\\cos t, 3\\sin t, 4t)$ 先预测 $\\kappa$、$\\tau$（用 $\\kappa^2 + \\tau^2 = \\frac{1}{\\text{速率}^2}$ 与 $\\tau/\\kappa = b/a$ 联立），再算一遍验证。", check: "答案为 $\\kappa = \\frac{3}{25} = 0.12$、$\\tau = \\frac{4}{25} = 0.16$，且 $0.0144 + 0.0256 = 0.04 = \\frac{1}{25}$。" }
            ]
          }
        },
        {
          type: "pitfall",
          title: "常见误区：曲率挠率的公式、特例与退化点",
          items: [
            "把 $\\kappa = |\\mathbf{r}''|$ 当成通用公式：它只在弧长参数下成立。一般的参数 $t$ 下必须用 $\\kappa = \\frac{|\\mathbf{r}' \\times \\mathbf{r}''|}{|\\mathbf{r}'|^3}$，分母的三次方是最常被漏掉的因子。",
            "把「某点 $\\tau = 0$」当成「曲线是平面曲线」：只有 $\\tau$ 在整个区间上恒等于 $0$，才能断定曲线落在一张平面内；单点 $\\tau = 0$ 只说明该点处三阶近似不拧。",
            "在 $\\kappa = 0$ 的点硬算主法向量：此时 $\\mathbf{T}' = 0$，$\\mathbf{N} = \\mathbf{T}'/|\\mathbf{T}'|$ 没有定义，Frenet 标架不唯一（直线段上任何与 $\\mathbf{T}$ 垂直的方向都能充当 $\\mathbf{N}$）。这也是空间曲线基本定理要求 $\\kappa > 0$ 的原因。",
            "换了参数化发现 $\\kappa$ 变了，就以为曲率不是几何量：$\\kappa$ 与 $\\tau$ 都是参数化不变量。变的只是中间因子 $|\\mathbf{r}'|$；若结果真的变了，一定是导数算错或代错了点。",
            "把曲率半径 $\\rho = \\frac{1}{\\kappa}$ 当成向量：$\\rho$ 是一个长度量，只在密切圆的意义下有几何解释，它本身没有方向。",
            "记了螺旋线公式却忘了它依附的参数化：$\\kappa = \\frac{a}{a^2+b^2}$、$\\tau = \\frac{b}{a^2+b^2}$ 只对 $\\mathbf{r}(t) = (a\\cos t, a\\sin t, bt)$ 这种速率恒为 $\\sqrt{a^2+b^2}$ 的写法成立。换了参数化（例如把 $t$ 换成 $2t$）必须重新推。"
          ]
        },
        {
          type: "lab",
          title: "动手练习：弧长、标架与基本定理",
          steps: [
            "对 $\\mathbf{r}(t) = (\\cos t, \\sin t, t)$ 写出弧长函数 $s(t) = \\sqrt{2}\\,t$，把曲线改写成弧长参数形式 $\\mathbf{r}(s) = (\\cos(s/\\sqrt{2}), \\sin(s/\\sqrt{2}), s/\\sqrt{2})$，再验证 $\\left|\\frac{d\\mathbf{r}}{ds}\\right| \\equiv 1$。",
            "在弧长参数下用 $\\kappa = \\left|\\frac{d^2\\mathbf{r}}{ds^2}\\right|$ 重新算一次曲率，应得 $\\frac{1}{2}$，与 $\\frac{|\\mathbf{r}' \\times \\mathbf{r}''|}{|\\mathbf{r}'|^3}$ 的结果一致——两条路线必须给出同一个数。",
            "对柱面 $R = 2$ 上的螺旋线 $\\mathbf{r}(t) = (2\\cos t, 2\\sin t, 0.5t)$ 算 $\\kappa$ 与 $\\tau$：答案 $\\kappa = \\frac{8}{17} \\approx 0.4706$、$\\tau = \\frac{2}{17} \\approx 0.1176$，并检查 $\\kappa^2 + \\tau^2 = \\frac{1}{4.25} \\approx 0.2353$。",
            "对平面抛物线 $\\mathbf{r}(t) = (t, t^2, 0)$ 推出 $\\kappa(t) = \\frac{2}{(1 + 4t^2)^{3/2}}$，算出顶点处 $\\kappa(0) = 2$，并说明为什么抛物线不是圆（圆的 $\\kappa$ 是常数）。",
            "对 $\\mathbf{r}(t) = (t, t^2, t^3)$ 算 $t = 0$ 处的 $\\kappa$ 与 $\\tau$：答案 $\\kappa = 2$、$\\tau = 3$，用行列式复核混合积 $12$ 与 $|\\mathbf{r}' \\times \\mathbf{r}''|^2 = 4$。",
            "用 Python 或计算器对上述曲线做数值微分（中心差分），把 $\\kappa$、$\\tau$ 与手算结果对比，误差应随步长减小而下降。"
          ],
          note: "这一讲的所有公式都可以只用 $\\mathbf{r}'$、$\\mathbf{r}''$、$\\mathbf{r}'''$ 算出来。练习目标是形成「先求导、再叉积、最后除幂次」的手感，做到不用查公式也不出错。"
        }
      ],
      quiz: [
        {
          id: "dg-curve-q1",
          type: "single",
          q: "关于空间曲线的曲率 $\\kappa$ 与挠率 $\\tau$，下列说法正确的是？",
          options: [
            "$\\kappa$ 衡量曲线偏离切线的快慢，$\\tau$ 衡量曲线偏离密切平面的快慢；$\\tau$ 在整个区间恒为 $0$ 说明曲线落在同一张平面内",
            "$\\kappa$ 与 $\\tau$ 都是非负的，且某点 $\\kappa = 0$ 说明曲线在该点是直线",
            "$\\tau$ 越大说明曲线越弯，$\\kappa$ 越大说明曲线越扭曲",
            "$\\kappa$ 与 $\\tau$ 的数值由参数化的选取决定，换一个参数就会改变"
          ],
          answer: 0,
          why: "由 $|\\mathbf{T}| \\equiv 1$ 知 $\\mathbf{T} \\cdot \\mathbf{T}' = 0$，所以 $\\kappa = \\frac{|\\mathbf{T}'|}{|\\mathbf{r}'|}$ 度量单位弧长上切向量转过的角度，即「弯」的快慢；$\\tau = -\\frac{\\mathbf{B}' \\cdot \\mathbf{N}}{|\\mathbf{r}'|}$ 度量标架绕切向量转动的快慢，即离开密切平面的快慢，而 $\\tau \\equiv 0$ 等价于 $\\mathbf{B}$ 恒定，也就是曲线落在一张平面内。选项二有两处错误：$\\kappa \\ge 0$ 成立但 $\\tau$ 可以为负（镜像反射变号），并且某点 $\\kappa = 0$ 只是该点不弯，只有 $\\kappa$ 恒为 $0$ 才是直线，例如 $y = x^3$ 在原点曲率为 $0$ 却不直。选项三把两个量说反了。选项四违背事实：$\\kappa$ 与 $\\tau$ 是曲线的几何不变量，换参数化只改变中间出现的 $|\\mathbf{r}'|$ 因子。"
        },
        {
          id: "dg-curve-q2",
          type: "fill",
          q: "曲线 $\\mathbf{r}(t) = (\\cos t, \\sin t, t)$ 的曲率 $\\kappa$ 等于 ____（填小数或分数）",
          answer: ["0.5", "1/2", ".5"],
          why: "先算 $\\mathbf{r}'(t) = (-\\sin t, \\cos t, 1)$，速率 $|\\mathbf{r}'| = \\sqrt{2}$；再算 $\\mathbf{r}''(t) = (-\\cos t, -\\sin t, 0)$，叉积 $\\mathbf{r}' \\times \\mathbf{r}'' = (\\sin t, -\\cos t, 1)$，模恒为 $\\sqrt{2}$。代入通用公式 $\\kappa = \\frac{|\\mathbf{r}' \\times \\mathbf{r}''|}{|\\mathbf{r}'|^3} = \\frac{\\sqrt{2}}{(\\sqrt{2})^3} = \\frac{\\sqrt{2}}{2\\sqrt{2}} = \\frac{1}{2}$。注意不能写成 $\\kappa = |\\mathbf{r}''| = 1$：那只在弧长参数下才对，这里的参数 $t$ 不是弧长（弧长是 $\\sqrt{2}\\,t$）。这条曲线处处 $\\kappa = 0.5$ 且 $\\tau = 0.5$，是常曲率常挠率的螺旋线。"
        },
        {
          id: "dg-curve-q3",
          type: "order",
          q: "把「用非弧长参数算出一条空间曲线的 Frenet 标架、曲率与挠率」的步骤排成正确顺序",
          items: [
            "作叉积 $\\mathbf{B} = \\mathbf{T} \\times \\mathbf{N}$，并检查 $\\mathbf{T}$、$\\mathbf{N}$、$\\mathbf{B}$ 两两垂直且构成右手系",
            "把 $\\mathbf{r}''$ 中平行于 $\\mathbf{T}$ 的分量减掉，把剩下的向量单位化得到 $\\mathbf{N}$",
            "写出 $\\mathbf{r}'(t)$、$\\mathbf{r}''(t)$、$\\mathbf{r}'''(t)$，并确认 $|\\mathbf{r}'| \\ne 0$（曲线正则）",
            "用 $\\kappa = \\frac{|\\mathbf{r}' \\times \\mathbf{r}''|}{|\\mathbf{r}'|^3}$ 与 $\\tau = \\frac{(\\mathbf{r}', \\mathbf{r}'', \\mathbf{r}''')}{|\\mathbf{r}' \\times \\mathbf{r}''|^2}$ 算出曲率与挠率",
            "把 $\\mathbf{r}'(t)$ 单位化得到切向量 $\\mathbf{T}$"
          ],
          answer: [2, 4, 1, 0, 3],
          why: "必须先求导并确认正则，否则后面所有分母都可能为 $0$；正则性成立后才能单位化速度得到 $\\mathbf{T}$；$\\mathbf{N}$ 必须由「$\\mathbf{r}''$ 减去它在 $\\mathbf{T}$ 上的投影」再单位化得到，直接单位化 $\\mathbf{r}''$ 一般得不到垂直于 $\\mathbf{T}$ 的向量；有了 $\\mathbf{T}$ 与 $\\mathbf{N}$ 才能作叉积得到 $\\mathbf{B}$ 并检查右手系；最后才用叉积的模与混合积算 $\\kappa$ 与 $\\tau$，因为这两个公式的分母要用到 $|\\mathbf{r}'|$ 与 $|\\mathbf{r}' \\times \\mathbf{r}''|$。顺序颠倒的常见后果是拿一个不垂直于 $\\mathbf{T}$ 的向量当 $\\mathbf{N}$，导致标架不正交、后续结果全错。"
        },
        {
          id: "dg-curve-q4",
          type: "single",
          q: "设正则曲线 $\\mathbf{r}(t)$ 满足 $|\\mathbf{r}'(t)| \\equiv 3$（速率恒为常数），则曲率 $\\kappa$ 等于？",
          options: [
            "$\\kappa = \\frac{|\\mathbf{r}''|}{9}$",
            "$\\kappa = \\frac{|\\mathbf{r}''|}{27}$",
            "$\\kappa = |\\mathbf{r}''|$，因为 $|\\mathbf{r}'|$ 是常数可以约掉",
            "$\\kappa = \\frac{3|\\mathbf{r}''|}{27}$，即 $\\frac{|\\mathbf{r}''|}{9}$ 的 3 倍"
          ],
          answer: 0,
          why: "由 $|\\mathbf{r}'|^2 = \\mathbf{r}' \\cdot \\mathbf{r}' \\equiv 9$ 求导得 $2\\mathbf{r}' \\cdot \\mathbf{r}'' = 0$，所以 $\\mathbf{r}' \\perp \\mathbf{r}''$，于是 $|\\mathbf{r}' \\times \\mathbf{r}''| = |\\mathbf{r}'| \\cdot |\\mathbf{r}''| = 3|\\mathbf{r}''|$。代入通用公式 $\\kappa = \\frac{|\\mathbf{r}' \\times \\mathbf{r}''|}{|\\mathbf{r}'|^3} = \\frac{3|\\mathbf{r}''|}{27} = \\frac{|\\mathbf{r}''|}{9}$。选项二只把 $27$ 当分母却漏掉了分子里的 $|\\mathbf{r}'| = 3$；选项三把非弧长参数当成了弧长参数，犯的是 $\\kappa = |\\mathbf{r}''|$ 的经典错误；选项四在数值上等于 $|\\mathbf{r}''|/3$，是把 $|\\mathbf{r}'|$ 的幂次记混的结果。"
        }
      ]
    },
    {
      id: "dg-surface",
      title: "曲面论初步：正则曲面、切平面与第一基本形式",
      goal: "能写出球面、环面、旋转曲面与函数图像的参数化，算出切向量与单位法向量，求出第一基本形式的系数 E、F、G，并用它们计算曲面上的弧长、夹角与面积，判断曲面是否可定向。",
      est: 70,
      blocks: [
        {
          type: "analogy",
          title: "几何直观：曲面是一张可以被坐标纸覆盖的橡皮膜",
          md: "一张世界地图能把地球画在平面上，靠的是把球面「贴」到平面坐标系上：地图上的每一小块，在球面上都对应一小块曲面。这就是参数化（parametrization）的全部含义——用两个参数 (u, v) 给曲面打上网格，像给地球标上经纬度。\n\n- **网格线**：固定 v 让 u 变，得到一条 u-曲线；固定 u 让 v 变，得到一条 v-曲线。地球上的经线与纬线就是它们。两组网格线在每一点给出两个切方向。\n- **切平面（tangent plane）**：把这两个切方向张成的平面放在该点，它就是曲面在这一点的最佳线性近似——放大到足够近，曲面看起来就是这张平面。\n- **法向量（normal vector）**：垂直于切平面的方向。对参数化 X(u, v)，它就是 X_u × X_v 的方向。\n- **第一基本形式（first fundamental form）**：曲面上量长度用的「尺子」。在地图上按比例尺量距离，得到的只是坐标距离；真正的曲面距离要用度量（metric）来算。E、F、G 就是这把尺子在每个网格点的三个读数。\n\n内蕴与外蕴的区别从这里开始变得具体：**切平面、法向量、曲面怎么弯在三维空间里（外蕴，extrinsic）要靠外面的空间才能描述；而曲面上两点之间的路程、两条曲线的夹角、一块区域的面积只靠 E、F、G 就能算（内蕴，intrinsic）。** 一只趴在曲面上的蚂蚁没有第三个维度可用，它手里的尺子就是第一基本形式。后面高斯绝妙定理之所以惊人，正是因为它证明了高斯曲率这样一个看起来必须靠「外面」才能定义的量，居然也只依赖这把内蕴的尺子。\n\n> 注意：地图一定有形变。球面不能毫无失真地铺平（这正是本课程后半段要证明的结论），所以「按地图上的直线走近路」是一个典型的内蕴几何错误。"
        },
        {
          type: "concept",
          title: "正则曲面与参数表示：为什么要求 $X_u \\times X_v \\ne 0$",
          md: "**定义**：设 $D$ 是 $\\mathbb{R}^2$ 中的开区域，映射 $X: D \\to \\mathbb{R}^3$，$(u, v) \\mapsto X(u, v)$ 是光滑的（各阶偏导连续）。若在 D 内处处\n\nX_u × X_v ≠ 0，\n\n就称 $X$ 是 $\\mathbb{R}^3$ 中的一张**正则曲面（regular surface）**的参数化，$X_u$、$X_v$ 是两个偏导向量。\n\n**为什么必须是叉积非零**：$X_u \\times X_v \\ne 0$ 等价于 $X_u$ 与 $X_v$ 线性无关，也就是两个切方向真正张开一张平面。若某点叉积为零，两个方向共线，法方向无从确定：常见后果是出现尖点（锥面的顶点）、参数化的退化点（球坐标在南北极，此时纬线缩成一点，X_v = 0），或者自交点。**去掉这些坏点之后**，曲面在每点都有唯一的法方向，才能继续谈切平面与后面的第二基本形式。\n\n**四个标准例子**（都要能默写）：\n\n- 球面：$X(u, v) = (R \\sin u \\cos v, R \\sin u \\sin v, R \\cos u)$，$u \\in (0, \\pi)$、$v \\in (0, 2\\pi)$；极点是参数化奇点，必须挖掉。\n- 环面（torus）：$X(u, v) = ((R + r \\cos u) \\cos v, (R + r \\cos u) \\sin v, r \\sin u)$。\n- 函数图像：$X(x, y) = (x, y, f(x, y))$，这是最简单的一类参数化。\n- 旋转曲面：把平面曲线 $(r(v), z(v))$ 绕 $z$ 轴旋转，$X(u, v) = (r(v) \\cos u, r(v) \\sin u, z(v))$，要求 $r(v) > 0$。\n\n**隐式曲面与显式曲面**：方程 $F(x, y, z) = 0$ 给出的曲面（如 $x^2 + y^2 + z^2 = R^2$）称为隐式的；只要梯度 $\\nabla F \\ne 0$，由隐函数定理就能在局部解出 $z = f(x, y)$ 或某个变量，从而得到显式（图像型）参数化。反过来，图像型参数化也总能写成隐式方程。两种描述等价，但计算难度常常差很多：隐式方程方便判断点是否在曲面上，参数化方便求切向量、算法向量与算积分。\n\n**术语对照**：正则曲面（regular surface）、参数化（parametrization）、切平面（tangent plane）、法向量（normal vector）、定向（orientation）。"
        },
        {
          type: "concept",
          title: "切平面、法向量与曲面的定向",
          md: "**切平面**：在点 $p = X(u_0, v_0)$ 处，曲面 $S$ 的切空间定义为所有过 $p$ 的曲线速度向量的集合，可以证明它恰好是由 $X_u$、$X_v$ 张成的二维平面：\n\n$T_p S = \\mathrm{span}\\{ X_u(u_0, v_0), X_v(u_0, v_0) \\}$。\n\n**为什么恰好是这两个向量张成的平面**：任取曲面上一条曲线 $u = u(t)$、$v = v(t)$，它的速度是 $\\frac{dX}{dt} = u' X_u + v' X_v$，一定落在这个张成空间里；反过来，对任意 $(a, b) \\ne 0$，取 $u = u_0 + at$、$v = v_0 + bt$ 就把 (a, b) 实现为某条网格线的速度。两个包含关系合起来就是等式。\n\n**单位法向量**：\n\n$\\mathbf{n} = \\frac{X_u \\times X_v}{|X_u \\times X_v|}$。\n\n由正则性分母不为零。曲面的隐式表示 F(x, y, z) = 0 时，法方向就是 ∇F，两者在局部只差一个非零倍数。\n\n**定向（orientation）**：切平面里没有「自然的」正方向，只有把单位法向量场连续地选出来，曲面才有整体的正反面。能选出处处连续的单位法向量场的曲面称为**可定向的（orientable）**。球面、环面、柱面都可定向；**莫比乌斯带（Möbius band）不可定向**——沿它走一圈回来，法向量会反转，正反面变成同一面。\n\n一个实用的判定：参数化 $X$ 本身就给出一张定向，因为 $X_u \\times X_v$ 连续且非零；两个参数化给出相同定向当且仅当它们的 Jacobi 行列式（即 (u, v) 与 (u', v') 之间的坐标变换的行列式）恒为正。交换 $u$、$v$ 的角色（或把 $v$ 换成 $-v$）就会翻转定向。\n\n**内蕴与外蕴的分界**：切平面与法向量都是外蕴概念，它们需要「曲面外面还有一个三维空间」才能谈；而可定向性虽然常用法向量描述，实际上是拓扑性质——它不依赖曲面怎么放在 R³ 里。"
        },
        {
          type: "concept",
          title: "第一基本形式：曲面自己的度量",
          md: "**定义**：设 X(u, v) 是正则参数化，令\n\n- $E = X_u \\cdot X_u$\n- $F = X_u \\cdot X_v$\n- $G = X_v \\cdot X_v$\n\n则称 $I = E\\,du^2 + 2F\\,du\\,dv + G\\,dv^2$ 为该参数下的**第一基本形式（first fundamental form）**，矩阵 $\\begin{pmatrix} E & F \\\\ F & G \\end{pmatrix}$ 是切空间上的内积矩阵。\n\n**它管三件事**：\n\n- 弧长：若曲面上曲线写成 $(u(t), v(t))$，则长度 $= \\int \\sqrt{Eu'^2 + 2Fu'v' + Gv'^2}\\,dt$。这是因为 $\\frac{dX}{dt} = u' X_u + v' X_v$，直接做内积即得。\n- 夹角：两条曲线在交点处切向量为 $a$、$b$（用 $(u, v)$ 坐标表示），则 $\\cos \\theta = \\frac{\\text{a 与 b 的内积}}{|a|\\,|b|}$，而内积由 $E$、$F$、$G$ 给出。\n- 面积：面积元 $dA = \\sqrt{EG - F^2}\\,du\\,dv$，区域面积 $= \\iint \\sqrt{EG - F^2}\\,du\\,dv$。\n\n**面积元公式的来源**：以 $X_u\\,du$ 与 $X_v\\,dv$ 为邻边的平行四边形的面积是 $|X_u\\,du \\times X_v\\,dv| = |X_u \\times X_v|\\,du\\,dv$，而由拉格朗日恒等式\n\n$$ |X_u \\times X_v|^2 = |X_u|^2\\,|X_v|^2 - (X_u \\cdot X_v)^2 = EG - F^2 $$\n\n所以 $|X_u \\times X_v| = \\sqrt{EG - F^2}$。当 $F = 0$（两组网格线正交，如球面的经纬线）时面积元退化成 $\\sqrt{EG}\\,du\\,dv$。\n\n**两个基本例子**：\n\n| 曲面 | 参数化 | E | F | G | √(EG - F²) |\n|---|---|---|---|---|---|\n| 球面半径 $R$ | $(R \\sin u \\cos v, R \\sin u \\sin v, R \\cos u)$ | $R^2$ | $0$ | $R^2 \\sin^2 u$ | $R^2 \\sin u$ |\n| 图像 $z = f(x, y)$ | $(x, y, f)$ | $1 + f_x^2$ | $f_x f_y$ | $1 + f_y^2$ | $\\sqrt{1 + f_x^2 + f_y^2}$ |\n| 环面 | $((R + r \\cos u) \\cos v, (R + r \\cos u) \\sin v, r \\sin u)$ | $r^2$ | $0$ | $(R + r \\cos u)^2$ | $r(R + r \\cos u)$ |\n\n**最重要的观念**：E、F、G 是内蕴量。曲面上的蚂蚁不需要知道曲面在 R³ 里怎么弯，只要手里有 E、F、G 这三个函数，就能算出所有曲线的长度、所有区域的面积。凡是能只靠 E、F、G 表达的几何量，都称为**内蕴量（intrinsic quantity）**。第一基本形式就是曲面自己的「度量」，它是后面等距、测地线与高斯绝妙定理的出发点。"
        },
        {
          type: "calc",
          title: "手算演练：球面 R = 2 的第一基本形式与面积",
          inputs: [
            { name: "曲面", value: "球面 $X(u, v) = 2(\\sin u\\cos v, \\sin u\\sin v, \\cos u)$" },
            { name: "要求", value: "$E$、$F$、$G$、面积元、总面积，以及在 $(u, v) = (\\pi/2, 0)$ 处的单位法向量" }
          ],
          outputs: [
            "$X_u = 2(\\cos u \\cos v, \\cos u \\sin v, -\\sin u)$，$X_v = 2(-\\sin u \\sin v, \\sin u \\cos v, 0)$",
            "$E = X_u \\cdot X_u = 4(\\cos^2 u \\cos^2 v + \\cos^2 u \\sin^2 v + \\sin^2 u) = 4(\\cos^2 u + \\sin^2 u) = 4$（常数！）",
            "$F = X_u \\cdot X_v = 4(-\\cos u \\sin u \\cos v \\sin v + \\cos u \\sin u \\sin v \\cos v) = 0$（两组网格线正交，经纬线正交）",
            "$G = X_v \\cdot X_v = 4(\\sin^2 u \\sin^2 v + \\sin^2 u \\cos^2 v) = 4 \\sin^2 u$",
            "面积元 $\\sqrt{EG - F^2} = \\sqrt{4 \\times 4 \\sin^2 u} = 4 \\sin u$（把 $u$、$v$ 想成纬度与经度，靠近极点 $\\sin u \\to 0$，网格被挤扁，面积元随之变小）",
            "总面积 $= \\int_0^{2\\pi} \\int_0^{\\pi} 4 \\sin u\\,du\\,dv = 2\\pi \\times 4 \\times [-\\cos u]_0^{\\pi} = 2\\pi \\times 4 \\times 2 = 16\\pi \\approx 50.2655$，与 $4\\pi R^2 = 4\\pi \\times 4 = 16\\pi$ 一致",
            "在 $(u, v) = (\\pi/2, 0)$：$X_u = (0, 0, -2)$，$X_v = (0, 2, 0)$，$X_u \\times X_v = (4, 0, 0)$，$|X_u \\times X_v| = 4$，故 $\\mathbf{n} = (1, 0, 0)$ = 位置向量除以 $R$（外法向）",
            "再取一点 $(u, v) = (\\pi/4, 0)$ 检查：$E = 4 \\to 4$，$F = 0$，$G = 4\\sin^2(\\pi/4) = 2$，面积元 $= \\sqrt{8} = 2\\sqrt{2} \\approx 2.8284$",
            "环面对照：$E = r^2 = 1$，$F = 0$，$G = (R + r \\cos u)^2 = (2 + \\cos u)^2$，面积元 $= (2 + \\cos u)$；总面积 $= \\int_0^{2\\pi}\\int_0^{2\\pi}(2 + \\cos u)\\,du\\,dv = 2\\pi \\times 4\\pi = 8\\pi^2 \\approx 78.9568 = 4\\pi^2 R r$"
          ],
          note: "算 $E$、$F$、$G$ 的诀窍是先用三角恒等式把 $\\cos^2 v + \\sin^2 v$ 合并掉，再代入数字。球面的 $G = R^2\\sin^2 u$ 是最容易写错成 $R^2$ 的一步：纬度圈的长度随 $\\sin u$ 缩短，这个因子必须保留。"
        },
        {
          type: "interactive",
          lab: "datalab",
          title: "第一基本形式 $E$、$F$、$G$ 逐步计算：球面 $R = 2$ 在 $(\\pi/2, 0)$ 处",
          config: {
            state: { 曲面: "球面 R = 2", 点uv: "(π/2, 0)", E: "待算", F: "待算", G: "待算", 面积元: "待算" },
            steps: [
              { desc: "第一步：写出参数化并确认它是正则的", state: { 参数化: "X(u, v) = 2(sin u cos v, sin u sin v, cos u)", 参数范围: "u ∈ (0, π)、v ∈ (0, 2π)", 极点说明: "u = 0 与 u = π 是参数化奇点，要挖掉" }, note: "球坐标在极点会退化：那里 X_v = 0，叉积为零，不满足正则性条件。" },
              { desc: "第二步：求两个偏导向量", state: { X_u: "2(cos u cos v, cos u sin v, -sin u)", X_v: "2(-sin u sin v, sin u cos v, 0)", 说明: "X_u 沿经线方向，X_v 沿纬线方向" }, note: "求偏导时把另一个参数当常数，这是参数化计算的全部套路。" },
              { desc: "第三步：在 (u, v) = (π/2, 0) 处取具体向量", state: { 位置: "(2, 0, 0)", X_u: "(0, 0, -2)", X_v: "(0, 2, 0)" }, note: "cos(π/2) = 0、sin(π/2) = 1 是关键代入；这一点恰好在赤道上。" },
              { desc: "第四步：算 E = X_u·X_u", state: { E: "0 + 0 + (-2)² = 4", 通用式: "E = 4 对一切 (u, v) 都成立" }, note: "E = R² 是常数，说明沿经线方向的度量处处相同（经线是大圆）。" },
              { desc: "第五步：算 F = X_u·X_v", state: { F: "0×0 + 0×2 + (-2)×0 = 0", 通用式: "F = 0 对一切 (u, v) 都成立", 几何含义: "两组网格线处处正交（经纬线垂直）" }, note: "F = 0 的参数化称为正交参数化，此时面积元与弧长公式都最简。" },
              { desc: "第六步：算 G = X_v·X_v", state: { G: "0 + 2² + 0 = 4", 通用式: "G = R² sin²u = 4 sin²u", 校验: "sin(π/2) = 1，与通用式一致" }, note: "离开赤道后 G 会变小：u = π/4 时 G = 2，纬线长度随之按 sin u 缩短。" },
              { desc: "第七步：算面积元 $\\sqrt{EG - F^2}$", state: { "EG - F²": "4 × 4 - 0 = 16", 面积元: "√16 = 4", 通用式: "√(EG - F²) = 2 × 2 sin u = 4 sin u" }, note: "面积元是「参数平面上一个单位小方格对应多大曲面面积」的伸缩因子。" },
              { desc: "第八步：用面积元积分求总面积", state: { 积分: "∫₀^{2π}∫₀^{π} 4 sin u du dv", 结果: "2π × 4 × 2 = 16π ≈ 50.2655", 对照: "4πR² = 16π，一致" }, note: "球面面积公式被第一基本形式完整地重算了一遍，说明度量确实包含了面积信息。" },
              { desc: "第九步：算出单位法向量并检查定向", state: { "X_u × X_v": "(4, 0, 0)", "|X_u × X_v|": 4, n: "(1, 0, 0)", 解读: "n 与位置向量同向，这是外法向（指向球外）" }, note: "把 v 换成 -v 会让 X_v 反向、n 反向，这就是定向翻转：球面可定向，因为可以整体一致地取外法向。" }
            ],
            tasks: [
              { t: "把参数化换成 R = 3 的球面，重算 E、F、G 与总面积，并说明为什么 G 里的 R² 因子不能丢。", hint: "$E = 9$、$F = 0$、$G = 9 \\sin^2 u$，面积元 $9 \\sin u$，总面积 $36\\pi \\approx 113.0973$。" },
              { t: "对柱面 X(u, v) = (cos u, sin u, v) 算 E、F、G 与面积元，再对图像 z = x² + y² 算 E、F、G，比较两者 F 是否为零。", check: "柱面得到 $E = 1$、$F = 0$、$G = 1$；抛物面在 (1, 1) 处得到 $E = 5$、$F = 4$、$G = 5$，$F \\ne 0$ 说明网格线不正交。" }
            ]
          }
        },
        {
          type: "code",
          lang: "python",
          title: "用数值微分复核球面与环面的 E、F、G 与面积",
          code: "import math\n\ndef dot(a, b):\n    return sum(x * y for x, y in zip(a, b))\n\ndef partials(X, u, v, h):\n    Xu = tuple((X(u + h, v)[i] - X(u - h, v)[i]) / (2 * h) for i in range(3))\n    Xv = tuple((X(u, v + h)[i] - X(u, v - h)[i]) / (2 * h) for i in range(3))\n    return Xu, Xv\n\nR = 2.0\nsphere = lambda u, v: (R * math.sin(u) * math.cos(v), R * math.sin(u) * math.sin(v), R * math.cos(u))\nfor (u, v) in [(math.pi / 2, 0.0), (0.7, 0.3)]:\n    Xu, Xv = partials(sphere, u, v, 1e-6)\n    E, F, G = dot(Xu, Xu), dot(Xu, Xv), dot(Xv, Xv)\n    print('sphere u=%.4f v=%.4f  E=%.6f F=%.6f G=%.6f  sqrt(EG-F^2)=%.6f' % (u, v, E, F, G, math.sqrt(E * G - F * F)))\n    print('    analytic      E=%.6f F=0.000000 G=%.6f' % (R * R, R * R * math.sin(u) ** 2))\n\nN = 400\ntotal = 0.0\nfor i in range(N):\n    for j in range(N):\n        u = (i + 0.5) * math.pi / N\n        total += R * R * math.sin(u) * (math.pi / N) * (2 * math.pi / N)\nprint('sphere area numeric = %.6f   exact 4*pi*R^2 = %.6f' % (total, 4 * math.pi * R * R))\n\nRt, rt = 2.0, 1.0\ntorus = lambda u, v: ((Rt + rt * math.cos(u)) * math.cos(v), (Rt + rt * math.cos(u)) * math.sin(v), rt * math.sin(u))\nXu, Xv = partials(torus, 0.9, 0.4, 1e-6)\nprint('torus E=%.6f F=%.6f G=%.6f  (analytic E=%.6f F=0 G=%.6f)' % (dot(Xu, Xu), dot(Xu, Xv), dot(Xv, Xv), rt * rt, (Rt + rt * math.cos(0.9)) ** 2))\ntotal = 0.0\nfor i in range(N):\n    for j in range(N):\n        u = (i + 0.5) * 2 * math.pi / N\n        total += rt * (Rt + rt * math.cos(u)) * (2 * math.pi / N) * (2 * math.pi / N)\nprint('torus area numeric = %.6f   exact 4*pi^2*R*r = %.6f' % (total, 4 * math.pi ** 2 * Rt * rt))\n\ngraph = lambda x, y: (x, y, x * y)\nXu, Xv = partials(graph, 0.0, 0.0, 1e-6)\nprint('saddle z=x*y at origin: E=%.6f F=%.6f G=%.6f' % (dot(Xu, Xu), dot(Xu, Xv), dot(Xv, Xv)))\n"
        },
        {
          type: "pitfall",
          title: "常见误区：E、F、G 的算法与「内蕴」的边界",
          items: [
            "把面积元写成 $du\\,dv$ 或 $|X_u| \\cdot |X_v|\\,du\\,dv$：正确公式是 $\\sqrt{EG - F^2}\\,du\\,dv$。只有当 $F = 0$ 时才等于 $|X_u| \\cdot |X_v|\\,du\\,dv$，参数网格不正交时这个简化会高估面积。",
            "算 $G$ 时把 $\\sin^2 u$ 丢掉：球面的 $G = R^2 \\sin^2 u = 4 \\sin^2 u$，漏掉 $\\sin^2 u$ 会让面积元变成常数，积出错误的面积。检查办法是让 u → 0，面积元必须趋于 0（极点附近网格缩成一点）。",
            "把 E、F、G 当成三个独立的函数随便取：它们由同一个参数化决定，必须一起算。换参数化后 E、F、G 会变（例如把 u 换成 2u，E 变成 4E），但内蕴几何不变——这正是「度量是张量」的含义。",
            "把切平面与曲面本身混为一谈：切平面只是局部线性近似，离开切点后误差是二阶的；说「曲面在切平面附近」必须加「局部」与「到二阶」。",
            "认为法向量是内蕴量：法向量需要第三个维度才能定义，属于外蕴数据。曲面上的蚂蚁既看不到法向量，也算不出它。可定向性虽然常用法向量描述，其实是拓扑性质。",
            "把可定向性当成所有曲面的通性：莫比乌斯带不可定向，沿它走一圈法向量会反向；写积分公式时如果不先确认定向，符号会出错。"
          ]
        },
        {
          type: "lab",
          title: "动手练习：参数化、切平面与面积",
          steps: [
            "写出环面 $X(u, v) = ((2 + \\cos u) \\cos v, (2 + \\cos u) \\sin v, \\sin u)$ 的 $X_u$、$X_v$，算出 $E = 1$、$F = 0$、$G = (2 + \\cos u)^2$，再求总面积 $8\\pi^2 \\approx 78.9568$。",
            "求该环面在 $(u, v) = (0, 0)$ 处的单位法向量：$X_u = (0, 0, 1)$、$X_v = (0, 3, 0)$，叉积为 $(-3, 0, 0)$，故 $\\mathbf{n} = (-1, 0, 0)$，并说明它指向环面「外侧」还是「内侧」。",
            "对柱面 $X(u, v) = (\\cos u, \\sin u, v)$ 求 $E$、$F$、$G$ 与面积元，再求高度为 $h$ 的一段的面积（答案 $2\\pi h$），并解释为什么它能剪开摊平而不改变任何长度。",
            "对图像 $z = x^2 + y^2$ 求 $E = 1 + 4x^2$、$F = 4xy$、$G = 1 + 4y^2$，在原点处算出 $\\sqrt{EG - F^2} = 1$，并解释为什么原点处面积元与平面相同。",
            "用 Python 做数值微分，把上面所有 E、F、G 与代码输出的数值对比，误差应随步长减小而收敛。",
            "判断以下哪些量是内蕴量并说明理由：曲线的弧长、两条曲线的夹角、区域面积、单位法向量、主曲率。"
          ],
          note: "这一讲的计算量集中在「求偏导 + 做内积」。建议把所有例子整理成一张表（参数化、E、F、G、面积元、面积），后面讲第二基本形式时直接在同一张表上接着加列即可。"
        }
      ],
      quiz: [
        {
          id: "dg-surface-q1",
          type: "single",
          q: "设 $X(u, v)$ 是曲面 $S$ 的光滑参数化，下列说法正确的是？",
          options: [
            "只要 $X_u \\times X_v \\ne 0$，$X_u$ 与 $X_v$ 就线性无关，切平面就是它们张成的平面",
            "$X_u \\times X_v = 0$ 的点不影响讨论，因为那里只是参数化「选得不好」",
            "切平面就是曲面本身，只是换了一种说法",
            "单位法向量 $\\mathbf{n} = X_u \\times X_v$ 总是单位向量"
          ],
          answer: 0,
          why: "叉积为零等价于两个向量线性无关性被破坏，而由曲面曲线的速度 $\\frac{dX}{dt} = u'X_u + v'X_v$ 可知切空间恰好等于它们的张成空间，所以叉积非零是正则性条件，也是切平面存在的前提。选项二错在把坏点当成无害：在 X_u × X_v = 0 处法方向不存在，参数化退化（如球坐标的极点）或出现尖点，必须挖掉。选项三错在把局部线性近似当成了曲面本身，二者相差二阶项。选项四漏了单位化，$\\mathbf{n} = \\frac{X_u \\times X_v}{|X_u \\times X_v|}$ 才是单位向量。"
        },
        {
          id: "dg-surface-q2",
          type: "multi",
          q: "在只给出第一基本形式系数 $E$、$F$、$G$（不知道曲面在 $\\mathbb{R}^3$ 中如何弯曲）的前提下，下列哪些量可以算出来？",
          options: [
            "曲面上一条曲线的弧长",
            "两条相交曲线在交点处的夹角",
            "曲面上一块区域的面积",
            "某点沿某方向的法曲率",
            "高斯曲率"
          ],
          answer: [0, 1, 2, 4],
          why: "弧长由 $\\int \\sqrt{Eu'^2 + 2Fu'v' + Gv'^2}\\,dt$ 给出，夹角由内积矩阵 $\\begin{pmatrix} E & F \\\\ F & G \\end{pmatrix}$ 给出，面积由 $\\iint \\sqrt{EG - F^2}\\,du\\,dv$ 给出，三者都是第一基本形式的直接推论，属于内蕴量。高斯曲率也内蕴，这一点由高斯绝妙定理保证——它虽然通常用第二基本形式算，但结果只依赖 E、F、G。法曲率不行：它的定义要用到单位法向量与第二基本形式，属于外蕴量，蚂蚁在曲面上无法测量。"
        },
        {
          id: "dg-surface-q3",
          type: "fill",
          q: "球面 $X(u, v) = 2(\\sin u \\cos v, \\sin u \\sin v, \\cos u)$ 的第一基本形式系数 $E$ 等于 ____（填数字）",
          answer: ["4", "4.0"],
          why: "先算 X_u = 2(cos u cos v, cos u sin v, -sin u)，再与自己做内积得 E = 4(cos²u cos²v + cos²u sin²v + sin²u) = 4(cos²u + sin²u) = 4。注意 E = R² 与 u、v 都无关，这反映经线方向的度量处处相同；而 G = R² sin²u = 4 sin²u 会随纬度变化，两者不要混为一谈。若误写成 E = 4 sin²u，就是把它与 G 记反了。"
        },
        {
          id: "dg-surface-q4",
          type: "order",
          q: "把「用参数化计算曲面上一块区域的面积」的步骤排成正确顺序",
          items: [
            "代入面积元公式，写出二重积分 $\\iint \\sqrt{EG - F^2}\\,du\\,dv$ 并确定参数区域的范围",
            "写出参数化 $X(u, v)$ 并求偏导向量 $X_u$、$X_v$",
            "用内积算出 $E = X_u \\cdot X_u$、$F = X_u \\cdot X_v$、$G = X_v \\cdot X_v$",
            "算出面积元 $\\sqrt{EG - F^2}$，并用恒等式 $|X_u \\times X_v|^2 = EG - F^2$ 复核",
            "先检查 $X_u \\times X_v \\ne 0$，确认参数化在讨论的区域上是正则的"
          ],
          answer: [1, 4, 2, 3, 0],
          why: "正确的流程是先写出参数化与偏导，再检查正则性（否则积分可能包含退化点，结果不可信），然后用内积得到 E、F、G，再由拉格朗日恒等式得到面积元并复核，最后才写出二重积分并定出参数范围。把正则性检查放到最后是常见错误：球坐标如果连极点一起积分，面积元在 u = 0 处退化为 0，表面上「没问题」，但当被积函数在极点有奇性时结果就会失真。"
        }
      ]
    },
    {
      id: "dg-curvature",
      title: "曲面的曲率：第二基本形式、主曲率与高斯曲率",
      goal: "能算出第二基本形式系数 $L$、$M$、$N$ 与形状算子，求出主曲率、高斯曲率 $K$ 与平均曲率 $H$，说明高斯映射与球面像的含义，并对球面、柱面、鞍面、螺旋面判断 $K$ 的符号与几何意义。",
      est: 75,
      blocks: [
        {
          type: "analogy",
          title: "几何直观：法曲率就是「朝某个方向摸过去的弯曲程度」",
          md: "把一张纸卷成圆筒，再用手去摸：\n\n- 沿筒的母线方向摸，纸是**直的**，弯曲程度为 0；\n- 绕筒的圆周方向摸，纸弯成一个半径 R 的圆，弯曲程度是 1/R。\n\n同一张纸、同一个点，沿不同方向的弯曲程度居然不同，这就是曲面比曲线复杂的地方。为了说清「沿某个方向弯多少」，我们在一点 p 取一个单位切向量 v，用曲面在 p 点的单位法向量 n 去切一刀（由 v 与 n 张成的平面截曲面），得到的截线是一条平面曲线，它的有符号曲率就称为**法曲率（normal curvature）$\\kappa_n(v)$**。\n\n- 法曲率的**最大值与最小值**称为两个**主曲率（principal curvature）** κ₁、κ₂，对应的方向称为主方向，两个主方向必定正交。\n- **高斯曲率（Gaussian curvature）$K = \\kappa_1\\kappa_2$**，**平均曲率（mean curvature）$H = \\frac{\\kappa_1 + \\kappa_2}{2}$**。\n- 欧拉公式说：沿任意方向的法曲率是 $\\kappa_n(\\theta) = \\kappa_1\\cos^2\\theta + \\kappa_2\\sin^2\\theta$，所以法曲率永远夹在两个主曲率之间。\n\n**三种点的「形状」**（这正是 K 的符号的几何含义）：\n\n- $K > 0$（椭圆点）：两个方向朝同一侧弯，像鸡蛋壳、球面，曲面局部在切平面的一侧。\n- K = 0（抛物点）：一个主曲率为 0，像圆筒面，沿母线方向是直的，曲面可以展平。\n- $K < 0$（双曲点）：两个方向朝相反侧弯，像马鞍、薯片，曲面在切平面两侧都有。\n\n**高斯映射（Gauss map）** 是另一个漂亮的图像：把每点的单位法向量 n(p) 平移到原点，它的端点落在单位球面上，于是曲面被映到单位球面。K 正是这个映射的局部面积伸缩率——曲面弯得越厉害，法向量跑得越快，球面像被撑得越大。\n\n> 直观告诉我们 K 描述「弯曲的乘积」，但千万不要以为 K 是外蕴量：高斯绝妙定理会证明 K 只依赖第一基本形式 E、F、G。这是本课程最重要的反转。"
        },
        {
          type: "concept",
          title: "第二基本形式与 Weingarten 映射：二阶偏离切平面的量",
          md: "**定义**：设 $X(u, v)$ 是正则参数化，$\\mathbf{n} = \\frac{X_u \\times X_v}{|X_u \\times X_v|}$ 是单位法向量，令\n\n- $L = X_{uu} \\cdot \\mathbf{n}$\n- $M = X_{uv} \\cdot \\mathbf{n}$\n- $N = X_{vv} \\cdot \\mathbf{n}$\n\n则 $II = L\\,du^2 + 2M\\,du\\,dv + N\\,dv^2$ 称为**第二基本形式（second fundamental form）**。\n\n**几何意义（为什么这样定义）**：把曲面在 p 附近展开，X(u + du, v + dv) 到切平面的有符号距离是\n\n$(X(u + du, v + dv) - X(u, v)) \\cdot \\mathbf{n} = \\frac{1}{2}\\left(L\\,du^2 + 2M\\,du\\,dv + N\\,dv^2\\right) + \\text{高阶项}$，\n\n因为一阶项 X_u·n 与 X_v·n 都等于 0（X_u、X_v 在切平面内）。所以第二基本形式正是曲面偏离切平面的**二阶**信息，符号告诉我们曲面往哪一侧偏。\n\n**Weingarten 映射（形状算子）**：考虑单位法向量随点变化的速率。可以证明 $d\\mathbf{n}$ 把切空间映到自身（因为 $\\mathbf{n} \\cdot \\mathbf{n} \\equiv 1$ 求导得 $d\\mathbf{n} \\cdot \\mathbf{n} = 0$），于是定义线性映射\n\n$S = -d\\mathbf{n}: T_pS \\to T_pS$。\n\n在基 $\\{X_u, X_v\\}$ 下，$S$ 的矩阵就是 $\\begin{pmatrix} E & F \\\\ F & G \\end{pmatrix}^{-1}\\begin{pmatrix} L & M \\\\ M & N \\end{pmatrix}$。它的两个特征值正是主曲率 $\\kappa_1$、$\\kappa_2$。\n\n**法曲率与 S 的关系**：单位切向量 v 方向的法曲率\n\n$\\kappa_n(v) = \\frac{II(v, v)}{I(v, v)} = \\frac{\\langle S v, v \\rangle}{\\langle v, v \\rangle}$。\n\n**为什么 $S$ 是自伴的（这一步必须讲清楚）**：要证 $\\langle S X_u, X_v \\rangle = \\langle X_u, S X_v \\rangle$，等价于 $M = M$，而这来自 $X_{uv} \\cdot \\mathbf{n} = X_{vu} \\cdot \\mathbf{n}$，用到的正是「X 二次连续可微 ⇒ 混合偏导相等」这一条件。**没有光滑性假设，主曲率就未必是实数，主方向也未必正交。** 自伴算子的谱定理随后保证：两个主曲率是实数，两个主方向互相垂直。这就是「为什么主方向一定正交」的完整理由，而不是一句「显然」。\n\n**两件必须记住的事**：\n\n- 把法向量换成 $-\\mathbf{n}$，则 $L$、$M$、$N$ 全部变号，形状算子变号，$H$ 变号，而 $K = \\det S$ 不变。所以 **K 与定向无关，H 与定向有关**。\n- 计算时不必真的去解特征值：K = (LN - M²)/(EG - F²)，H = (EN - 2FM + GL)/(2(EG - F²))。这两个公式由矩阵的行列式与迹直接得到。"
        },
        {
          type: "concept",
          title: "主曲率、高斯曲率、平均曲率与高斯映射",
          md: "**从形状算子读出四个量**：设 S 的矩阵为 (E F; F G)⁻¹ (L M; M N)，则\n\n- κ₁、κ₂ 是 S 的两个特征值（主曲率）；\n- $K = \\det S = \\kappa_1\\kappa_2 = \\frac{LN - M^2}{EG - F^2}$；\n- $H = \\frac{1}{2}\\mathrm{tr}\\,S = \\frac{\\kappa_1 + \\kappa_2}{2} = \\frac{EN - 2FM + GL}{2(EG - F^2)}$；\n- 欧拉公式 $\\kappa_n(\\theta) = \\kappa_1\\cos^2\\theta + \\kappa_2\\sin^2\\theta$ 把任意方向的法曲率与两个主曲率连起来。\n\n**当 $F = M = 0$ 时**（所谓曲率线参数化）公式退化得极简单：$\\kappa_1 = \\frac{L}{E}$，$\\kappa_2 = \\frac{N}{G}$，$K = \\frac{LN}{EG}$，$H = \\frac{EN + GL}{2EG}$。球面的经纬线参数化就满足 F = M = 0，这是它计算特别干净的原因。\n\n**点的分类**：\n\n- K > 0：椭圆点（elliptic），例如球面上每一点；\n- K < 0：双曲点（hyperbolic），例如鞍面 z = xy 的原点；\n- K = 0 但 L、M、N 不全为 0：抛物点（parabolic），例如柱面上每一点；\n- L = M = N = 0：平点（planar），例如平面上每一点。\n\n**高斯映射与球面像**：$N: S \\to S^2$，$p \\mapsto \\mathbf{n}(p)$。可以证明 $dN = -S$，于是 $K = \\det(dN)$。它的几何解读是面积伸缩率：曲面上一小块区域的球面像的面积，约等于 $|K|$ 乘以原面积。对整张闭曲面，球面像（按重数计）的面积等于 $\\iint |K|\\,dA$。**由此还得到一个漂亮的事实**：如果 K ≡ 0，那么球面像退化成一个点或一条曲线——柱面、锥面的法向量只在一维的集合里取值，这正是「可展曲面」的几何含义。\n\n**高斯绝妙定理（Theorema Egregium）**：$K$ 只依赖第一基本形式 $E$、$F$、$G$，是内蕴量。\n\n这条定理为什么惊人：K 的定义要先用第二章的外蕴数据 n（法向量），再用外蕴的 L、M、N，最后做乘法。可结果居然能只靠内蕴的 E、F、G 算出来。Gauss 在 1827 年把它称为「绝妙定理」，因为它的推论是：**一只生活在曲面上的蚂蚁，不出曲面也能测出高斯曲率**。由此立刻得到两个不可完成的任务：球面不能等距地展成平面（球面 K = 1/R² ≠ 0，平面 K = 0），而圆柱面可以（两者 K 都是 0）。地图必然有形变，根源就在这里。"
        },
        {
          type: "concept",
          title: "特殊曲面：球面、柱面、可展曲面、极小曲面与常平均曲率曲面",
          md: "**四类必须能立刻报出 K 与 H 的曲面**（以下取外向法向量）：\n\n| 曲面 | 主曲率 | K | H | 说明 |\n|---|---|---|---|---|\n| 球面半径 $R$ | 都是 $-\\frac{1}{R}$ | $\\frac{1}{R^2}$ | $-\\frac{1}{R}$ | $K$ 为正常数，最对称的曲面 |\n| 柱面半径 $R$ | $-\\frac{1}{R}$ 与 $0$ | $0$ | $-\\frac{1}{2R}$ | $K = 0$ 但 $H \\ne 0$，不是平面 |\n| 平面 | 都是 0 | 0 | 0 | 唯一的 L = M = N = 0 情形 |\n| 鞍面 $z = xy$（原点） | $+1$ 与 $-1$ | $-1$ | $0$ | 双曲点，且恰好是极小曲面 |\n\n**可展曲面（developable surface）**：$K \\equiv 0$ 的曲面。除了平面与柱面，还有锥面与切线面（空间曲线的切线族）。它们的特点是可以沿一条母线剪开并无拉伸地摊平到平面上：$K = 0$ 与平面的 $K$ 相同，二者局部等距。这正是「K = 0 不等于曲面是平面」的准确含义——K = 0 说的是**内蕴**上平坦，而柱面在外蕴上依然弯着（H ≠ 0）。\n\n反过来说，只要 K 不恒为 0，就不可能把曲面摊平：这就是「球面地图一定有形变」的严格证明。\n\n**极小曲面（minimal surface）**：$H \\equiv 0$，即 $\\kappa_1 = -\\kappa_2$，两个主曲率大小相等方向相反。它是面积泛函的临界点，物理实现就是肥皂膜：肥皂膜会自动收缩到面积最小的形状。\n\n- 螺旋面 $X(u, v) = (v\\cos u, v\\sin u, u)$ 是极小曲面：算出来 $L = 0$、$M = \\frac{1}{\\sqrt{1+v^2}}$、$N = 0$，于是 $H = 0$，而 $K = -\\frac{1}{(1+v^2)^2} < 0$，处处仍是负曲率。**H = 0 绝不意味着「不弯」**。\n- 悬链面（catenoid）也是极小曲面，K = -1/cosh⁴v。经典结论是：悬链面与螺旋面局部等距——两个形状看起来完全不同的曲面，在蚂蚁眼里一样。\n\n**常平均曲率曲面（CMC surface）**：$H \\equiv \\text{常数}$。球面是最简单的例子（$H = \\pm\\frac{1}{R}$）。两个著名定理：Hopf（1951）证明 R³ 中常平均曲率的拓扑球面必是标准球面；Alexandrov（1958）证明嵌入 R³ 的紧致常平均曲率曲面必是球面。**注意这里 H 是外蕴量**，所以这些定理本质上讲的是「怎么嵌进 R³」的问题，而不是内蕴几何问题——这与高斯绝妙定理形成鲜明对比。"
        },
        {
          type: "calc",
          title: "手算演练：球面 $R = 2$、柱面 $R = 1$、鞍面 $z = xy$ 的 $K$ 与 $H$",
          inputs: [
            { name: "曲面一", value: "球面 $X(u, v) = 2(\\sin u \\cos v, \\sin u \\sin v, \\cos u)$，取 $u = \\frac{\\pi}{2}$，外向法向量" },
            { name: "曲面二", value: "柱面 X(u, v) = (cos u, sin u, v)，外向法向量" },
            { name: "曲面三", value: "鞍面 $z = xy$ 在原点" },
            { name: "要求", value: "各自的 $E$、$F$、$G$、$L$、$M$、$N$，以及 $K$、$H$、$\\kappa_1$、$\\kappa_2$" }
          ],
          outputs: [
            "球面：$E = 4$、$F = 0$、$G = 4$、$L = -2$、$M = 0$、$N = -2$（$u = \\pi/2$ 处），$EG - F^2 = 16$，$LN - M^2 = 4$",
            "球面：$K = \\frac{4}{16} = 0.25 = \\frac{1}{R^2}$；$H = \\frac{4 \\times (-2) + 4 \\times (-2)}{2 \\times 16} = -\\frac{16}{32} = -0.5 = -\\frac{1}{R}$",
            "球面：$\\kappa_1 = L/E = -0.5$、$\\kappa_2 = N/G = -0.5$（两个方向弯得一样，所以是椭圆点，$K > 0$）",
            "柱面：$X_u = (-\\sin u, \\cos u, 0)$、$X_v = (0, 0, 1)$、$\\mathbf{n} = (\\cos u, \\sin u, 0)$；$E = 1$、$F = 0$、$G = 1$、$L = -1$、$M = 0$、$N = 0$",
            "柱面：$K = \\frac{LN - M^2}{EG - F^2} = \\frac{0}{1} = 0$；$H = \\frac{1 \\times 0 + 1 \\times (-1)}{2 \\times 1} = -0.5$；$\\kappa_1 = -1$、$\\kappa_2 = 0$",
            "柱面解读：绕圆周方向弯（$\\kappa_1 = -1$），沿母线方向直（$\\kappa_2 = 0$），乘积 $K = 0$，所以柱面内蕴平坦、可以剪开摊平；但 $H = -0.5 \\ne 0$，它在三维空间里确实弯着，不是平面",
            "鞍面：$X = (x, y, xy)$，$E = 1 + y^2$、$F = xy$、$G = 1 + x^2$，原点处 $E = G = 1$、$F = 0$；$L = 0$、$M = 1$、$N = 0$",
            "鞍面：$K = \\frac{0 - 1}{1} = -1$；$H = \\frac{0 + 0 - 0}{2 \\times 1} = 0$；形状算子矩阵为 $\\begin{pmatrix} 0 & 1 \\\\ 1 & 0 \\end{pmatrix}$，特征值 $\\pm 1$，故 $\\kappa_1 = 1$、$\\kappa_2 = -1$",
            "鞍面解读：一个主方向向上弯、一个向下弯，所以 K < 0（双曲点）；K = -1 与 H = 0 同时成立，说明它是极小曲面而不是平面",
            "螺旋面 $a = 1$：E = 1 + v²、F = 0、G = 1、L = 0、M = 1/√(1+v²)、N = 0，于是 $K = -\\frac{1}{(1+v^2)^2}$、$H = 0$；v = 0 时 K = -1，v = 1 时 K = -0.25，v = 2 时 K = -0.04",
            "尺度对照：球面 $R = 3$ 时 $K = \\frac{1}{9} \\approx 0.1111$，比 $R = 2$ 的 $0.25$ 小——半径越大越平，弯曲程度随尺度衰减"
          ],
          note: "算 $K$ 与 $H$ 的固定套路：$E$、$F$、$G$ → 单位法向量 $\\mathbf{n}$ → $L$、$M$、$N$ → 代入两个公式。$K$ 的分母 $EG - F^2$ 与第二基本形式的分母完全相同，所以两张表可以一起做。最后一定检查符号：$K$ 与定向无关，$H$ 会随法向量反向而变号。"
        },
        {
          type: "interactive",
          lab: "datalab",
          title: "第二基本形式 L、M、N 逐步计算：球面 R = 2 在 (π/2, 0) 处",
          config: {
            state: { 曲面: "球面 R = 2", 点uv: "(π/2, 0)", L: "待算", M: "待算", N: "待算", K: "待算", H: "待算" },
            steps: [
              { desc: "第一步：先备好第一基本形式（第二基本形式的分母要用它）", state: { E: 4, F: 0, G: 4, "EG - F²": 16, "√(EG - F²)": 4 }, note: "分母 EG - F² 是面积元的平方，先算出来能省一半时间。" },
              { desc: "第二步：写出单位法向量", state: { "X_u × X_v": "(4, 0, 0)", "|X_u × X_v|": 4, n: "(1, 0, 0)", 几何含义: "n 与位置向量同向（外法向）" }, note: "第二基本形式依赖法向量的选择：取内法向则 L、M、N 全部变号，H 变号而 K 不变。" },
              { desc: "第三步：求三个二阶偏导", state: { X_uu: "2(-sin u cos v, -sin u sin v, -cos u) = (-2, 0, 0)", X_uv: "2(-cos u sin v, cos u cos v, 0) = (0, 0, 0)", X_vv: "2(-sin u cos v, -sin u sin v, 0) = (-2, 0, 0)" }, note: "X_uv 在 u = π/2 处为零是赤道位置的巧合，不是普遍现象。" },
              { desc: "第四步：算 $L = X_{uu} \\cdot \\mathbf{n}$", state: { "X_uu·n": "(-2)×1 + 0 + 0 = -2", L: -2, 解读: "负号说明曲面朝法向量的反方向弯（球面朝球心弯）" }, note: "L 是沿 u 方向的二阶偏离量，E 是同一方向的一阶长度平方，两者之比才是主曲率。" },
              { desc: "第五步：算 $M = X_{uv} \\cdot \\mathbf{n}$", state: { "X_uv·n": "0", M: 0, 含义: "M = 0 说明经纬线方向正是主方向（曲率线参数化）" }, note: "M = 0 与 F = 0 同时成立时，κ₁ = L/E、κ₂ = N/G 可以直接读出来。" },
              { desc: "第六步：算 $N = X_{vv} \\cdot \\mathbf{n}$", state: { "X_vv·n": "(-2)×1 + 0 + 0 = -2", N: -2, 解读: "沿纬线方向弯的程度与沿经线方向相同" }, note: "球面上 $\\frac{L}{E} = \\frac{N}{G} = -\\frac{1}{R}$，这就是「球面各方向一样弯」的代数表达。" },
              { desc: "第七步：代入公式算 K", state: { "LN - M²": "(-2)(-2) - 0 = 4", "EG - F²": 16, K: "4 / 16 = 0.25", 对照: "1/R² = 1/4 = 0.25，一致" }, note: "K > 0 说明这是椭圆点；K 与参数化、定向都无关，是曲面自身的曲率。" },
              { desc: "第八步：算 H 与两个主曲率", state: { "EN - 2FM + GL": "4×(-2) + 4×(-2) = -16", H: "-16 / 32 = -0.5", "κ1": "L/E = -0.5", "κ2": "N/G = -0.5" }, note: "$H$ 为负只是因为取了外法向：换成内法向，$H = +0.5$，而 $K$ 依然是 $0.25$。" },
              { desc: "第九步：验证欧拉公式并读结论", state: { 法曲率: "κ_n(θ) = κ₁cos²θ + κ₂sin²θ = -0.5（对一切 θ）", 结论: "球面上每个方向的法曲率都等于 -1/R，两个主曲率相等", 推论: "球面是脐点曲面（umbilical），每一点都是脐点" } }
            ],
            tasks: [
              { t: "改用内法向量 n = (-1, 0, 0) 重算 L、M、N、K、H，说明哪些量变了、哪些没变。", check: "能说出 L、M、N 与 H 全部变号，而 K = 0.25 不变——K 与定向无关。" },
              { t: "对柱面 X(u, v) = (cos u, sin u, v) 算 L、M、N，并解释为什么 K 会变成 0。", hint: "n = (cos u, sin u, 0)，X_uu = (-cos u, -sin u, 0) 给出 L = -1，而 X_vv = 0 给出 N = 0。" }
            ]
          }
        },
        {
          type: "interactive",
          lab: "datalab",
          title: "高斯曲率计算：球面 / 柱面 / 鞍面的 K 与 H 对比",
          config: {
            state: { 曲面: "球面 R = 2", κ1: "待算", κ2: "待算", K: "待算", H: "待算", 点的类型: "待判断" },
            steps: [
              { desc: "第一站：球面 R = 2，取外向法向量", state: { E: 4, G: 4, L: -2, N: -2, κ1: -0.5, κ2: -0.5, K: "κ1κ2 = 0.25", H: "(κ1+κ2)/2 = -0.5", 点的类型: "椭圆点（K > 0）" }, note: "球面的两个主曲率相等，$K = \\frac{1}{R^2}$ 处处相同：它是弯曲最均匀的曲面。" },
              { desc: "第二站：柱面 R = 1，取外向法向量", state: { E: 1, G: 1, L: -1, N: 0, κ1: -1, κ2: 0, K: "(-1)×0 = 0", H: "(κ1+κ2)/2 = -0.5", 点的类型: "抛物点（K = 0）" }, note: "沿圆周方向弯成半径 1 的圆（κ₁ = -1），沿母线方向是直线（κ₂ = 0），乘积为零。" },
              { desc: "第三站：把柱面剪开摊平", state: { 操作: "沿一条母线剪开", 结果: "可以无拉伸地摊成平面", 依据: "柱面与平面都有 K ≡ 0，局部等距", 反例: "球面做不到（K = 0.25 ≠ 0）" }, note: "「能不能摊平」是内蕴问题，答案只看 K；这与柱面看起来是弯的（H ≠ 0）并不矛盾。" },
              { desc: "第四站：柱面的 K = 0 不等于它是平面", state: { K: 0, H: -0.5, 平面的H: 0, 判据: "平面要求 L = M = N = 0（三个全为零）", 结论: "柱面在三维空间里确实弯着，只是内蕴平坦" }, note: "这是本章最重要的易错点：K = 0 只说明可展，不说明形状是平的。" },
              { desc: "第五站：鞍面 z = xy 在原点", state: { E: 1, F: 0, G: 1, L: 0, M: 1, N: 0, 形状算子: "矩阵 (0 1; 1 0)", 特征值: "±1", K: "(0 - 1)/1 = -1", H: "(0 + 0 - 0)/(2×1) = 0" }, note: "特征值 ±1 说明一个方向向上弯、一个方向向下弯，所以 K < 0（双曲点）。" },
              { desc: "第六站：鞍面同时是极小曲面", state: { H: 0, κ1: 1, κ2: -1, K: -1, 解读: "H = 0 表示两个主曲率大小相等方向相反，不是「不弯」" }, note: "把 z = xy 换成 z = x² - y²（旋转 45 度）会得到同一个曲面，只是坐标换了。" },
              { desc: "第七站：螺旋面 a = 1（处处极小）", state: { E: "1 + v²", F: 0, G: 1, L: 0, M: "1/√(1+v²)", N: 0, K: "-1/(1+v²)²", H: 0, 取值: "v = 0 时 K = -1；v = 1 时 K = -0.25；v = 2 时 K = -0.04" }, note: "K 随 |v| 增大迅速趋于 0，但永远为负：螺旋面处处是双曲点，且面积一阶变分为零。" },
              { desc: "第八站：尺度效应与总结", state: { "球面R=2": "K = 0.25", "球面R=3": "K = 1/9 ≈ 0.1111", "柱面R=1": "K = 0", "鞍面原点": "K = -1", 总结: "K 的符号分类曲面局部形状，K 的大小随尺度按 1/长度² 变化" } },
              { desc: "第九站：为什么 K 是内蕴的（绝妙定理预告）", state: { K: "由 L、M、N 与 E、F、G 算出", 但: "K 只依赖 E、F、G", 证据: "柱面 K = 0 与平面 K = 0 相同 → 局部等距", 推论: "球面 K = 0.25 ≠ 0 → 不存在保长的平面地图" }, note: "下一讲会用只含 E、F、G 的公式直接把 K 算出来，那时你会看到「绝妙」二字的分量。" }
            ],
            tasks: [
              { t: "把球面半径改成 4，先预测 K 与 |H|，再按同样步骤算一遍验证。", hint: "K = 1/16 = 0.0625，|H| = 0.25，主曲率都是 -0.25。" },
              { t: "对旋转曲面 $X(u, v) = (r(v)\\cos u, r(v)\\sin u, v)$（取 $r(v) = \\cosh v$，即悬链面）推出 $K = -\\frac{1}{\\cosh^4 v}$ 与 $H = 0$，并说明它是极小曲面。", check: "能说清 H = 0 与 K < 0 为什么不矛盾：两个主曲率等大反号，乘积为负。" }
            ]
          }
        },
        {
          type: "pitfall",
          title: "常见误区：K、H 的符号与「K = 0」的含义",
          items: [
            "把 $K = 0$ 当成「曲面是平面」：柱面 $K = 0$，但它在外蕴上明显弯着（$H = -\\frac{1}{2R} \\ne 0$）。$K = 0$ 只说明曲面内蕴平坦、可以剪开摊平；平面要求 $L = M = N = 0$。",
            "忘记法向量反向会让 L、M、N 全部变号：K 不变、H 变号。写答案时必须说明取的是外法向还是内法向，否则 H 的符号没有意义。",
            "用 $K = \\frac{LN - M^2}{EG - F^2}$ 时漏掉分母：球面上 $E = R^2$、$G = R^2\\sin^2 u$，漏掉分母会算出 $K = R^2\\sin^2 u$ 这类量纲都不对的结果（K 的量纲是 $1/\\text{长度}^2$）。",
            "把平均曲率 $H$ 理解成「曲率的平均值」以外的意思：$H = \\frac{\\kappa_1 + \\kappa_2}{2}$ 是两个主曲率的算术平均，既不等于 $\\sqrt{|K|}$，也不等于 $|\\kappa_1|$ 或 $|\\kappa_2|$。",
            "以为法曲率可以超出主曲率的范围：由欧拉公式 $\\kappa_n(\\theta) = \\kappa_1\\cos^2\\theta + \\kappa_2\\sin^2\\theta$ 可知法曲率永远夹在 $\\kappa_1$ 与 $\\kappa_2$ 之间，极值恰好是两个主曲率。",
            "把极小曲面（$H \\equiv 0$）当成「曲率为零的曲面」：螺旋面 $H = 0$ 而 $K = -\\frac{1}{(1+v^2)^2} < 0$，处处都在弯。$H = 0$ 的真实含义是两个主曲率大小相等、方向相反。"
          ]
        },
        {
          type: "lab",
          title: "动手练习：主曲率、高斯曲率与极小曲面",
          steps: [
            "对球面 R = 2 完整填写一张表：E、F、G、n、L、M、N、K、H、κ₁、κ₂，并说明为什么球面上每一点都是脐点。",
            "对环面 $X(u, v) = ((2 + \\cos u)\\cos v, (2 + \\cos u)\\sin v, \\sin u)$ 用公式 $K = \\frac{\\cos u}{2 + \\cos u}$ 算出 $u = 0$、$\\pi/2$、$\\pi$ 三处的 K：答案分别是 1/3 ≈ 0.3333、0、-1，并解释为什么外侧 $K > 0$、内侧 $K < 0$。",
            "验证环面的曲率积分 $\\iint K\\,dA = 0$：由于 $K\\,dA = \\cos u\\,du\\,dv$，直接对 $u$ 积分得 $0$；再算出 $\\iint |K|\\,dA = 8\\pi \\approx 25.1327$，说明「K 有正有负、积分抵消」与「K 不恒为零」并不矛盾。",
            "对鞍面 z = xy 算出 K = -1/(1 + x² + y²)²，检查它在原点的值 -1 与沿径向衰减的趋势。",
            "对螺旋面 $X(u, v) = (v\\cos u, v\\sin u, u)$ 算出 $H = 0$ 与 $K = -\\frac{1}{(1+v^2)^2}$，并用 Python 数值验证 v = 0、1、2 三点的 K。",
            "搜索（或回忆）一个生活中的极小曲面例子（肥皂膜、P 曲面、悬链面），说明为什么肥皂膜会自动取面积最小的形状。"
          ],
          note: "这一讲的核心是一张「系数表」：E、F、G 决定内蕴，L、M、N 决定外蕴，K 同时是两者的桥。把表做成习惯，后面讲绝妙定理与高斯-博内时你会反复用到它。"
        }
      ],
      quiz: [
        {
          id: "dg-curvature-q1",
          type: "single",
          q: "已知某曲面上处处 K = 0，下列判断正确的是？",
          options: [
            "曲面内蕴平坦，可以沿一条曲线剪开并无拉伸地展成平面，但它未必是平面",
            "曲面一定是平面，因为高斯曲率为零说明不弯",
            "曲面一定是柱面",
            "曲面上每一点的两个主曲率都等于零"
          ],
          answer: 0,
          why: "K = κ₁κ₂ ≡ 0 说明每个点至少有一个主曲率为零，曲面沿该方向是直的，因而属于可展曲面（平面、柱面、锥面或切线面），可以剪开摊平，与平面局部等距，所以第一项正确。第二项错在把内蕴平坦当成外蕴平坦：柱面的 H = -1/(2R) ≠ 0，在三维空间里确实弯着，只是内蕴几何与平面相同。第三项以偏概全，锥面与切线面同样满足 K = 0。第四项错在把「乘积为零」当成「两个因子都为零」：柱面有 κ₁ = -1/R ≠ 0，只有平面才两个主曲率都为零（等价于 L = M = N = 0）。"
        },
        {
          id: "dg-curvature-q2",
          type: "multi",
          q: "关于曲面的主曲率与法曲率，下列说法正确的有？",
          options: [
            "主曲率是法曲率在两个互相垂直的主方向上的取值，它们是法曲率的极值",
            "两个主方向必定正交，这一点来自形状算子的自伴性",
            "沿任意方向的法曲率满足 $\\kappa_n(\\theta) = \\kappa_1\\cos^2\\theta + \\kappa_2\\sin^2\\theta$，因此介于两个主曲率之间",
            "把单位法向量换成相反方向后，两个主曲率都变号，而高斯曲率不变",
            "平均曲率等于两个主曲率的算术平均，也等于 √|K|"
          ],
          answer: [0, 1, 2, 3],
          why: "法曲率作为单位切向量的函数，其极值由自伴算子 S 的特征值给出，正是两个主曲率，且自伴性（源于 X_uv = X_vu 这一光滑性条件）保证特征向量正交，所以前两项正确。欧拉公式是 S 在正交基下对角化的直接结果，法曲率因此夹在 κ₁ 与 κ₂ 之间，第三项正确。法向量反向时 L、M、N 全部变号，S 变号，κ₁、κ₂ 随之变号，但 K = det S 是二阶量、符号不变，第四项正确。第五项错在后半句：H = (κ₁+κ₂)/2 与 √|K| = √|κ₁κ₂| 一般不等，例如鞍面原点 H = 0 而 √|K| = 1。"
        },
        {
          id: "dg-curvature-q3",
          type: "fill",
          q: "半径 $R = 1$ 的圆柱面（取曲率 $\\kappa_1 = -1$、$\\kappa_2 = 0$ 的法向约定）的高斯曲率 $K$ 等于 ____",
          answer: ["0", "0.0"],
          why: "柱面的参数化 X(u, v) = (cos u, sin u, v) 给出 X_u = (-sin u, cos u, 0)、X_v = (0, 0, 1)、单位法向量 n = (cos u, sin u, 0)，于是 E = 1、F = 0、G = 1、L = X_uu·n = -1、M = 0、N = X_vv·n = 0。代入 K = (LN - M²)/(EG - F²) = (0 - 0)/1 = 0。几何上就是「一个方向弯、一个方向直」，乘积为零；注意此时 H = -0.5 ≠ 0，所以 K = 0 并不表示柱面是平面。"
        },
        {
          id: "dg-curvature-q4",
          type: "order",
          q: "把「算出曲面在某点的高斯曲率与平均曲率」的步骤排成正确顺序",
          items: [
            "代入 $K = \\frac{LN - M^2}{EG - F^2}$ 与 $H = \\frac{EN - 2FM + GL}{2(EG - F^2)}$ 得到结果",
            "求 X_u、X_v，并算出 E、F、G 与面积元 √(EG - F²)",
            "求单位法向量 $n = \\frac{X_u \\times X_v}{|X_u \\times X_v|}$",
            "求二阶偏导 X_uu、X_uv、X_vv，并与 n 做内积得到 L、M、N",
            "写出曲面的正则参数化 $X(u, v)$，并确认 $X_u \\times X_v \\ne 0$"
          ],
          answer: [4, 1, 2, 3, 0],
          why: "顺序的根本原因是公式的依赖链：K 与 H 同时用到第一、第二基本形式，而第二基本形式的 L、M、N 必须由二阶偏导与单位法向量做内积得到，单位法向量又要靠 X_u × X_v 算出，所以必须先有参数化与一阶偏导。第二基本形式的计算必须放在法向量之后，否则内积没有对象；而 K、H 只有在两套系数都齐了以后才能代入。常见的错误是先算 L、M、N 再用未单位化的 X_u × X_v 做内积，结果整体差一个因子 |X_u × X_v|。"
        }
      ]
    },
    {
      id: "dg-intrinsic",
      title: "内蕴几何与测地线：Christoffel 符号、指数映射与高斯绝妙定理",
      goal: "能判断一个量是内蕴还是外蕴，算出球面的 Christoffel 符号并写出测地线方程，用变分与协变导数两种方式说明测地线的意义，叙述高斯绝妙定理并解释「局部等距不保持高斯曲率」这句话为什么说反了。",
      est: 80,
      blocks: [
        {
          type: "analogy",
          title: "几何直观：测地线是曲面上的「直线」，也是最短路径",
          md: "一只蚂蚁在球面上想从 A 走到 B，它没有第三个维度可用，只能沿曲面爬。它发现最短的走法既不是「地图上的直线」，也不是「挖穿地球的弦」，而是一段**大圆（great circle）**弧：赤道、所有经线以及任何一个过球心的平面截出的圆都是大圆。\n\n- 这类「曲面上的最短路径」称为**测地线（geodesic）**，也叫短程线。它们的共同刻画是：在每一点，曲线的密切平面都包含曲面的法向量，等价地说曲线没有「侧向」的加速度，等价地说它是长度泛函的临界点。\n- **内蕴距离（intrinsic distance）** 定义为曲面上连接两点的所有曲线的长度之下确界。单位球面上 $A = (0.7071, 0, 0.7071)$ 与 $B = (0, 0.7071, 0.7071)$（同纬度 45°、经度差 90°）的内蕴距离是 $\\pi/3 \\approx 1.0472$；沿纬线爬要走 1.1107；而三维空间中的直线弦长是 1.0000——弦根本不在球面上，不属于允许的路径。这个对比正是「内蕴」二字的分量。\n- 现实版本：飞机的长途航线在墨卡托投影地图上是弯的，但在球面上是直的；地图把直线画弯了，因为地图不是等距映射。\n\n**内蕴与外蕴的分界**在这里正式登场：\n\n- 内蕴的（intrinsic）：弧长、夹角、面积、测地线、测地曲率、Christoffel 符号、高斯曲率。蚂蚁凭手里的尺子（第一基本形式 E、F、G）就能全部测出来。\n- 外蕴的（extrinsic）：单位法向量、切平面、主曲率、平均曲率、第二基本形式。这些必须借助 R³ 才能定义。\n\n**高斯绝妙定理（Gauss Egregium, 1827）** 说：$K = \\kappa_1\\kappa_2$ 虽然定义为两个外蕴量的乘积，但它其实只依赖 $E$、$F$、$G$，是内蕴量。「绝妙（egregium）」二字的分量在于：**地球上的居民不需要飞出太空，只要在地面上量三角形内角和，就能测出地球的高斯曲率。** 这也是「局部等距不能改变高斯曲率」的准确说法：任何保长的对应都保持 K，所以球面永远不会与平面局部等距。"
        },
        {
          type: "concept",
          title: "等距与内蕴量：只靠 E、F、G 能算出什么",
          md: "**等距（isometry）的定义**：两张曲面 $S_1$、$S_2$ 之间的光滑双射 $\\varphi$ 若保持第一基本形式（等价地保持所有曲线的长度），就称为等距。局部地看，这意味着在合适的参数下两张曲面的 E、F、G **完全相同**。\n\n**一句话判别法**：如果两个参数化的 (E, F, G) 在对应点相同，那么它们的内蕴几何完全一样——蚂蚁无法区分。\n\n**三个标准例子**：\n\n- 平面与柱面：平面用极坐标参数化 $(r \\cos \\theta, r \\sin \\theta, 0)$ 时 $E = 1$、$F = 0$、$G = r^2$，柱面 (cos u, sin u, v) 展开后也是 E = 1、F = 0、G = 1 的形式（把 r 与 u 对应、θ 与 v 对应），两者局部等距。\n- 悬链面与螺旋面：两个形状差别极大的曲面局部等距（经典结论），因为它们的 E、F、G 可以配成相同的形式。\n- 球面与平面：球面 $K = 1/R^2 \\ne 0$，平面 $K = 0$，无论怎么参数化都不可能等距。这不是「找不到」，而是**由绝妙定理禁止**。\n\n**内蕴量清单**（能只靠 E、F、G 算出来）：曲线的弧长、两条曲线的夹角、区域面积、测地线、测地曲率 k_g、Christoffel 符号、高斯曲率 K。\n\n**外蕴量清单**（必须借助 R³）：单位法向量、切平面、第二基本形式 $L$、$M$、$N$、主曲率 $\\kappa_1$、$\\kappa_2$、平均曲率 $H$。\n\n**三个必须分清的「不」**：\n\n- **局部等距 ≠ 整体等距**。柱面与平面局部等距，但柱面卷起来了：整体上不存在把整个柱面无撕裂无重叠地摊成平面的等距映射（需要剪开），它们的整体拓扑也不同（柱面与平面甚至不同胚）。\n- **保角（conformal）≠ 等距**。球极投影与墨卡托投影保持角度（保角），却改变长度与面积，因此一般不保持 K：球面 K = 1/R² 而平面 K = 0，二者之间存在保角映射却不存在等距映射。把「保角」当成「保内蕴几何」是典型错误。\n- **K = 0 ≠ 是平面**。见上一讲的柱面：内蕴平坦，外蕴弯曲。\n\n**高斯绝妙定理的两种等价叙述**：① $K$ 只依赖第一基本形式 $E$、$F$、$G$；② 局部等距保持高斯曲率（等距不变量）。它们互为因果，是同一件事的两面。"
        },
        {
          type: "concept",
          title: "Christoffel 符号与协变导数：把「坐标的弯曲」扣掉",
          md: "**问题的来源**：在平面直角坐标里，直线就是「坐标的二阶导数为零」的曲线。可是在球面的 (u, v) 坐标里，赤道 u = π/2、v = t 的二阶导数也不是零（准确说 u'' = 0、v'' = 0 恰好为零，但一般测地线的坐标二阶导数不为零），因为**坐标网格本身是弯的**。要把「几何上是否在转弯」和「坐标网格造成的假转弯」分开，就需要 Christoffel 符号。\n\n**定义与公式**：Christoffel 符号（Christoffel symbols）由第一基本形式及其一阶导数决定：\n\n$$ \\Gamma^k_{ij} = \\frac{1}{2}g^{kl}(\\partial_i g_{jl} + \\partial_j g_{il} - \\partial_l g_{ij}) $$\n\n在正交参数化（$F = 0$）下它们退化成很好记的形式：\n\n- $\\Gamma^u_{uu} = \\frac{E_u}{2E}$，$\\Gamma^u_{uv} = \\frac{E_v}{2E}$，$\\Gamma^u_{vv} = -\\frac{G_u}{2E}$；\n- $\\Gamma^v_{uu} = -\\frac{E_v}{2G}$，$\\Gamma^v_{uv} = \\frac{G_u}{2G}$，$\\Gamma^v_{vv} = \\frac{G_v}{2G}$。\n\n**关键事实**：Christoffel 符号只用到 E、F、G，所以它们**是内蕴量**。这也解释了为什么它们能刻画测地线。\n\n**协变导数（covariant derivative）**：把向量场 Y 沿曲线 γ 的变化率分解成「几何变化」与「坐标网格带来的变化」两部分，扣掉后者剩下的就是协变导数 $\\nabla_{\\gamma'}Y$。它的坐标公式是\n\n$$ (\\nabla_{\\gamma'}Y)^k = Y'^k + \\Gamma^k_{ij}\\gamma'^i Y^j $$\n\n**测地线方程**：曲线 γ 是测地线当且仅当它的**协变加速度为零**：\n\n$\\nabla_{\\gamma'}\\gamma' = 0$，写成坐标就是 $\\gamma''^k + \\Gamma^k_{ij}\\gamma'^i\\gamma'^j = 0$。\n\n**球面的具体形式**（$R = 1$，$E = 1$、$F = 0$、$G = \\sin^2 u$）：\n\n- $\\Gamma^u_{vv} = -\\sin u\\cos u$，$\\Gamma^v_{uv} = \\Gamma^v_{vu} = \\cot u$，其余全部为 $0$；\n- 测地线方程：$u'' - \\sin u\\cos u\\,(v')^2 = 0$ 与 $v'' + 2\\cot u\\,u'v' = 0$。\n\n**立刻能读出的三件事**：\n\n- 经线（$v \\equiv$ 常数，$u$ 为参数）：$v' = 0$，两个方程都变成恒等式，所以经线是测地线；\n- 赤道（$u \\equiv \\pi/2$）：$\\sin u\\cos u = 0$ 且 $\\cot u = 0$，两个方程同样恒成立，所以赤道是测地线；\n- 其他纬线（$u \\equiv u_0 \\ne \\pi/2$）：$u' = 0$ 使得第一个方程变成 $-\\sin u_0\\cos u_0\\,(v')^2 \\ne 0$，**不满足**，所以纬线（除赤道）都不是测地线。它的测地曲率是 $k_g = \\cot u_0$。"
        },
        {
          type: "steps",
          title: "测地线方程的三条推导路线与指数映射",
          items: [
            { t: "路线一：长度泛函的变分", d: "把曲线长度 $L(\\gamma) = \\int|\\gamma'|\\,dt$ 在所有固定端点的曲线族里做一阶变分，令 $\\delta L = 0$，得到垂直于 $\\gamma'$ 的那部分加速度为零，即曲线没有侧向加速度（密切平面含法向量）。这条路线的缺点是 |γ'| 在参数化不良时不可微，需要分段讨论。" },
            { t: "路线二：能量泛函的变分（更常用）", d: "改用 $E(\\gamma) = \\frac{1}{2}\\int|\\gamma'|^2\\,dt$。能量泛函是长度泛函的「良性版本」，被积函数对 γ' 光滑，变分直接给出 ∇_{γ'}γ' = 0。随后用柯西不等式说明：能量泛函的临界点自动是常速的，于是它也是长度泛函的临界点。为什么合法：能量 ≥ 长度²/(2Δt)，等号成立当且仅当速率恒定。" },
            { t: "路线三：协变导数恒为零", d: "直接把 $\\nabla_{\\gamma'}\\gamma' = 0$ 翻译成坐标方程 $\\gamma''^k + \\Gamma^k_{ij}\\gamma'^i\\gamma'^j = 0$。这是二阶常微分方程组，由解的存在唯一性定理，给定初始点 p 与初始速度 v 就唯一确定一条测地线。" },
            { t: "为什么三者等价", d: "长度泛函与能量泛函在「常速参数化」下只差一个常数因子，所以临界点重合；而变分算出的「无侧向加速度」与协变加速度为零是同一件事的几何说法。理解这三者的等价，是理解测地线为什么既能叫「最短路径」又能叫「直线」的关键。" },
            { t: "初始条件与唯一性", d: "测地线满足二阶方程组，初值 (γ(0), γ'(0)) = (p, v) 唯一决定一条曲线，记作 γ_v(t)。这解决了「存在性」，而「两点之间是否总有一条测地线」「是不是最短」是另外两个问题，需要完备性（Hopf-Rinow）与共轭点理论。" },
            { t: "指数映射（exponential map）", d: "定义 $\\exp_p(v) = \\gamma_v(1)$，即从 $p$ 出发以初速 $v$ 沿测地线走「单位时间」到达的点。由于测地线在常速下可重新缩放参数（$\\gamma_v(t) = \\gamma_{tv}(1)$），这个定义是自洽的。$\\exp_p$ 把切空间的一个邻域微分同胚地映到曲面上的一个邻域，于是我们得到以 $p$ 为中心、看起来像极坐标的**测地极坐标**。" },
            { t: "测地极坐标与局部最短性", d: "在测地极坐标 $(r, \\theta)$ 下，第一基本形式变成 $dr^2 + G(r, \\theta)\\,d\\theta^2$（没有 $dr\\,d\\theta$ 交叉项）。这个「无交叉项」正是 Gauss 引理的内容：测地线垂直于它扫过的「测地圆」。由此立刻得到测地线的局部最短性：足够短的一段测地线是两点间唯一最短曲线。" },
            { t: "全局最短性与完备性", d: "Hopf-Rinow 定理：若曲面（更一般地，黎曼流形）作为度量空间完备，则任意两点之间都存在一条最短测地线，且 exp_p 处处有定义。反过来，球面上的一整条大圆虽然是测地线，但绕行超过 π 之后就不再是两端点间的最短路径——**测地线只是局部最短，全局最短需要额外条件**。" }
          ]
        },
        {
          type: "calc",
          title: "手算演练：单位球面的 Christoffel 符号与测地线验证",
          inputs: [
            { name: "曲面", value: "单位球面 $X(u, v) = (\\sin u\\cos v, \\sin u\\sin v, \\cos u)$" },
            { name: "度量", value: "$E = 1$、$F = 0$、$G = \\sin^2 u$" },
            { name: "要求", value: "全部 Christoffel 符号、测地线方程，并验证赤道与经线是测地线、纬线不是" }
          ],
          outputs: [
            "因为 $F = 0$、$E = 1$（常数），$E_u = E_v = 0$，只有含 $G_u = 2\\sin u\\cos u$ 与 $G_v = 0$ 的符号不为零",
            "$\\Gamma^u_{vv} = -\\frac{G_u}{2E} = -\\frac{2\\sin u\\cos u}{2} = -\\sin u\\cos u$；$\\Gamma^v_{uv} = \\Gamma^v_{vu} = \\frac{G_u}{2G} = \\frac{2\\sin u\\cos u}{2\\sin^2 u} = \\cot u$",
            "其余四个符号 $\\Gamma^u_{uu}$、$\\Gamma^u_{uv}$、$\\Gamma^v_{uu}$、$\\Gamma^v_{vv}$ 全部为 $0$（因为它们都含 E_u、E_v 或 G_v，而这些导数为零）",
            "测地线方程：$u'' - \\sin u\\cos u\\,(v')^2 = 0$ 与 $v'' + 2\\cot u\\,u'v' = 0$",
            "验证赤道 $u \\equiv \\pi/2$、$v = t$：$u' = 0$、$u'' = 0$，代入得 $0 - \\sin(\\pi/2)\\cos(\\pi/2)\\times 1 = 0 - 0 = 0$，且 $\\cot(\\pi/2) = 0$ 使第二式也为 0，所以赤道是测地线",
            "验证经线 $v \\equiv \\text{常数}$、$u = t$：$v' = v'' = 0$，两式都成为 $0 = 0$，所以经线都是测地线（它们都是大圆）",
            "验证纬线 $u \\equiv u_0$（$u_0 \\ne \\pi/2$）、$v = t$：$u' = u'' = 0$，第一式变成 $-\\sin u_0\\cos u_0 \\ne 0$，方程不成立，所以纬线不是测地线",
            "纬线的测地曲率 $k_g = \\cot u_0$：$u_0 = \\pi/4$ 时 $k_g = 1$；$u_0 = \\pi/6$ 时 $k_g = \\cot(\\pi/6) = \\sqrt{3} \\approx 1.7321$；u₀ = π/2 时 k_g = 0（回到赤道）",
            "纬线长度：$u_0 = \\pi/4$ 的纬线周长 $= 2\\pi\\sin(\\pi/4) = 2\\pi \\times 0.7071 \\approx 4.4429$；赤道周长 $= 2\\pi \\approx 6.2832$，所以纬线既不是测地线、也不是同纬度两点间的最短路径",
            "内蕴距离对照：$A = (0.7071, 0, 0.7071)$ 与 $B = (0, 0.7071, 0.7071)$ 的大圆距离 $= \\pi/3 \\approx 1.0472$（中心角 60°），沿同纬度绕行 $= \\cos(\\pi/4) \\times (\\pi/2) \\approx 1.1107$，三维弦长 $= 1.0000$（不在曲面上）"
          ],
          note: "Christoffel 符号只用到 E、F、G 的导数，这是它们内蕴性的直接证据。算完后务必做两项检查：第一，赤道与经线必须满足方程（大圆是测地线）；第二，非赤道的纬线必须不满足（否则说明符号算错了）。"
        },
        {
          type: "interactive",
          lab: "datalab",
          title: "测地线方程数值积分：单位球面上的大圆",
          config: {
            state: { 步数: 0, 位置uv: "(π/6, π/2)", 速度uv: "(0, 2)", 位置xyz: "(0, 0.5000, 0.8660)", 是否测地: "待检验" },
            steps: [
              { desc: "第一步：设定初值——从球面上一点出发，给一个切向量", state: { 起点uv: "u = π/6 ≈ 0.5236，v = π/2 ≈ 1.5708", 起点xyz: "(0, 0.5000, 0.8660)", 初速: "u' = 0，v' = 2", 速率: "|γ'| = √(E u'² + G v'²) = √(0 + sin²(π/6)×4) = 1" }, note: "取单位速率是为了让参数 t 就是弧长，读数更方便。" },
              { desc: "第二步：在该点算 Christoffel 符号", state: { "Γ^u_vv": "-sin u cos u = -0.4330（即 -√3/4）", "Γ^v_uv": "cot u = 1.7321（即 √3）", 其余符号: 0 }, note: "这两个数只依赖当前的 u，与 v 无关——球面的度量沿经度方向是旋转对称的。" },
              { desc: "第三步：写出初始时刻的坐标加速度", state: { "u'' = -Γ^u_vv (v')²": "+0.4330 × 4 = 1.7321", "v'' = -2 Γ^v_uv u' v'": "0（因为 u' = 0）", 几何含义: "加速度沿 u 增大方向，速度方向沿 v 方向" }, note: "u'' 不为零并不矛盾：坐标加速度包含「网格弯曲」的部分，真正要为零的是协变加速度。" },
              { desc: "第四步：检验测地条件（协变加速度为零）", state: { 第一式: "u'' - sin u cos u (v')² = 1.7321 - 1.7321 = 0", 第二式: "v'' + 2 cot u u' v' = 0 + 0 = 0", 结论: "初始时刻满足测地线方程，所以这条曲线就是测地线" }, note: "这就是「∇_{γ'}γ' = 0」的坐标表达；两个方程同时为零才有资格叫测地线。" },
              { desc: "第五步：积分一步到 t = 0.1", state: { t: 0.1, u: "0.5322（从 0.5236 增大）", v: "1.7688", "u'": 0.1704, "v'": 1.9419, 位置xyz: "(-0.0998, 0.4975, 0.8617)" }, note: "v' 在减小、u' 在增大：曲线正在从「沿纬线走」转向「向北爬」，这正是大圆的运动方式。" },
              { desc: "第六步：再积两步到 t = 0.2 与 0.3", state: { "t = 0.2": "u = 0.5572、v = 1.9560、u' = 0.3254、v' = 1.7883，位置 (-0.1987, 0.4900, 0.8488)", "t = 0.3": "u = 0.5964、v = 2.1248、u' = 0.4556、v' = 1.5848，位置 (-0.2955, 0.4777, 0.8273)", 检验: "每一步都把 u'' 与 v'' 回代方程，残差在 10⁻³ 以内" }, note: "数值积分用四阶龙格-库塔即可；步长越小，残差越小。" },
              { desc: "第七步：检验不变量（Clairaut 关系）", state: { 不变量: "sin²u × v'", "t = 0": "0.2500 × 2.0000 = 0.5000", "t = 0.1": "0.2577 × 1.9419 = 0.5000", "t = 0.3": "0.3163 × 1.5848 = 0.5013（数值误差）", 含义: "沿测地线 sin²u v' 守恒，这是旋转对称性带来的第一积分" }, note: "球面绕 z 轴旋转对称，于是有一条守恒量；这与力学里的角动量守恒是同一件事。" },
              { desc: "第八步：检验轨迹落在一张过球心的平面上", state: { 平面法向量: "n = (0, -sin 60°, cos 60°) = (0, -0.8660, 0.5000)", "t = 0": "n·P = -0.8660×0.5 + 0.5×0.8660 = 0", "t = 0.3": "n·P = -0.8660×0.4777 + 0.5×0.8273 ≈ 0", 加速度方向: "P'' = -P，指向球心", 结论: "这是一条大圆（测地曲率为零）" }, note: "「加速度平行于位置向量」正是球面上测地线的几何特征：它没有切向加速度，只有被球面约束的法向加速度。" },
              { desc: "第九步：走到 t = 2π 看看会发生什么", state: { t: "2π ≈ 6.2832", 位置: "回到起点 (0, 0.5000, 0.8660)（数值误差约 10⁻⁵）", 长度: "2π ≈ 6.2832 = 大圆周长", 结论: "球面上的测地线是闭曲线（大圆），与平面上的直线不同" }, note: "闭合性是球面拓扑造成的整体现象，局部方程看不出这一点——这正是局部几何与整体几何的分界。" },
              { desc: "第十步：收尾——把数值结果翻译成几何命题", state: { 已证明: "给定点与切向量，测地线存在唯一", 已验证: "协变加速度为零、Clairaut 守恒、轨迹是大圆", 提醒: "测地线只保证局部最短：绕行超过半圈后它就不是最短路径了" } }
            ],
            tasks: [
              { t: "把初速改成 (u', v') = (0, 1)（速率变为 sin(π/6) = 0.5），重新积分并观察轨迹是否仍是同一族大圆。", hint: "改变速率只改变参数化快慢，轨迹形状不变——因为测地线方程对参数是齐次的。" },
              { t: "改从 $u = \\pi/3$、$v = 0$、$u' = 0$、$v' = \\frac{1}{\\sin(\\pi/3)} \\approx 1.1547$ 出发，预测 Clairaut 不变量并与积分结果对照。", check: "能算出 $\\sin^2 u\\,v' \\approx 0.8660$ 保持不变，对应一条与赤道夹角 60° 的大圆。" }
            ]
          }
        },
        {
          type: "interactive",
          lab: "pathlab",
          title: "曲面上的最短路径：欧氏直线与测地线的对比（内蕴距离）",
          config: {
            grid: [
              [1, 1, 1, 9, 9, 9, 1, 1, 1],
              [1, 1, 1, 9, 9, 9, 1, 1, 1],
              [1, 1, 1, 2, 2, 2, 1, 1, 1],
              [1, 1, 1, 9, 9, 9, 1, 1, 1],
              [1, 1, 1, 1, 1, 1, 1, 1, 1]
            ],
            start: [0, 0],
            end: [0, 8],
            algo: "dijkstra",
            legend: "把网格看成一张曲面上的地图：格子里的数字是「穿过这一小格在曲面上真正要走的距离」（1 是平地，9 是陡坡，2 是山口通道）。这就是离散版本的第一基本形式——它只给出长度信息，不给出曲面在三维空间里怎么弯。此时从 S(0,0) 到 E(0,8)：BFS 只数格子数，走第 0 行直穿，得到 9 格、累计代价 32 的「坐标直线」；Dijkstra 按权重求和，得到 13 格、累计代价 15 的绕行路线——它先下到第 2 行的山口再折回，因为绕路的格子虽多，代价却更小。这条带权最短路径就是离散版测地线：它避开度量被拉长的区域，正如光线进入光密介质时折向法线（费马原理与 Snell 定律）。连续模型里有完全相同的现象：单位球面上 $A = (0.7071, 0, 0.7071)$ 与 $B = (0, 0.7071, 0.7071)$ 的内蕴距离是 $\\pi/3 \\approx 1.0472$（大圆），沿纬线走要 1.1107，而三维弦长 1.0000 根本不在曲面上。结论：内蕴距离只看度量（权重），不看坐标上的直线。"
          },
          tasks: [
            { t: "先切到 BFS 再切回 Dijkstra，记录两次的路径格数、累计代价与扩展节点数，解释为什么「格子少」不等于「代价小」。", check: "能说出 BFS 把每一步都当成 1，忽略权重；Dijkstra 把进入每格的代价累加，因此会选择更长的绕行路线。" },
            { t: "把第 2 行山口的代价从 2 改成 1，重新预测 Dijkstra 的累计代价，再运行验证。", hint: "山口变便宜后最优路径仍是走山口，代价会从 15 降到 12（2 + 8 + 2 段各为 1）。" },
            { t: "把山口那一行改成 9（堵死山口），比较 Dijkstra 与 BFS 的结果，并说明这时哪条路径是「测地线」。", hint: "此时绕山脚（第 4 行）的代价 16 优于直穿的 32，Dijkstra 会改走山脚。" },
            { t: "用球面数据手算验证内蕴距离：算出大圆距离 1.0472、纬线距离 1.1107 与弦长 1.0000，并说明为什么弦长不是合法路径。" }
          ]
        },
        {
          type: "pitfall",
          title: "常见误区：内蕴与外蕴、局部与整体、等距与保角",
          items: [
            "把「局部等距」当成「整体等距」：柱面与平面局部等距（K 都是 0），但整张柱面无法无撕裂、无重叠地摊成平面，必须剪开；它们的整体拓扑也不同（柱面与平面甚至不同胚）。",
            "以为保角（conformal）就保持内蕴几何：球极投影与墨卡托投影保持角度，却改变长度与面积，因此不保持高斯曲率（球面 $K = 1/R^2$，平面 $K = 0$）。保角 ≠ 等距。",
            "把测地线当成「全局最短曲线」：测地线只保证局部最短。球面上沿大圆走过半圈以后，继续走就不再是两端点间的最短路径；对径点之间甚至有无穷多条最短测地线。",
            "以为 K 是外蕴量：高斯绝妙定理说明 K 由 E、F、G 唯一决定，是内蕴量。主曲率 κ₁、κ₂ 与平均曲率 H 才是外蕴量（球面内外翻转时 H 变号，K 不变）。",
            "忘记测地线方程的坐标依赖性：方程里出现 Christoffel 符号，换坐标系后表达式会变，但「协变加速度为零」这个几何事实不变。把某个坐标系下的方程当成测地线的定义，会导致「换个坐标就不是测地线了」的困惑。",
            "把内蕴距离与三维欧氏弦长混用：球面上 A、B 的内蕴距离是 1.0472，三维弦长只有 1.0000，但弦不在曲面上，不是允许的路径。距离必须沿曲面测量。"
          ]
        },
        {
          type: "lab",
          title: "动手练习：Christoffel 符号、测地线与指数映射",
          steps: [
            "对单位球面写全六个 Christoffel 符号，答案只有两个非零：$\\Gamma^u_{vv} = -\\sin u\\cos u$ 与 $\\Gamma^v_{uv} = \\Gamma^v_{vu} = \\cot u$。逐项说明另外四个为什么是零。",
            "把赤道、经线、纬线 $u_0 = \\pi/4$ 分别代入测地线方程，判断哪些是测地线；对不是测地线的那一族算出测地曲率 $k_g = \\cot u_0 = 1$。",
            "对球面验证高斯绝妙定理的内蕴计算：用 $K = -\\frac{1}{2\\sqrt{EG}}\\left[\\left(\\frac{G_u}{\\sqrt{EG}}\\right)_u + \\left(\\frac{E_v}{\\sqrt{EG}}\\right)_v\\right]$ 代入 $E = 1$、$G = \\sin^2 u$，得到 $K \\equiv 1$。这个公式里只出现 E、F、G。",
            "在同一公式里代入柱面的 $E = 1$、$G = 1$，得到 $K \\equiv 0$，并说明柱面与平面为什么局部等距、而球面与平面为什么不可能局部等距。",
            "对球面上的点 $p = (0, 0, 1)$（北极）写出指数映射 $\\exp_p$ 在切平面上的作用：切向量 v 对应从北极沿经线出发的测地线，$\\exp_p(v)$ 落在同一条经线上；说明当 $|v| = \\pi$ 时所有方向都映到南极（指数映射在南极不单射，这就是共轭点现象）。",
            "用 Python 对球面测地线方程做数值积分，画出 $u(t)$、$v(t)$ 以及不变量 $\\sin^2 u\\,v'$，验证它保持常数。"
          ],
          note: "这一讲把「内蕴」从一个形容词变成了一套可操作的工具：只要是能从 E、F、G 推出来的量，蚂蚁都能测；凡是需要法向量的量，蚂蚁都测不到。绝妙定理的惊人之处，就在于 K 竟然属于前者。"
        }
      ],
      quiz: [
        {
          id: "dg-intrinsic-q1",
          type: "single",
          q: "关于「内蕴」与「外蕴」，下列说法正确的是？",
          options: [
            "高斯曲率 $K$ 是内蕴量，而平均曲率 $H$、主曲率 $\\kappa_1$、$\\kappa_2$ 是外蕴量",
            "高斯曲率 K 是外蕴量，因为它必须用单位法向量与 L、M、N 才能算出来",
            "面积是外蕴量，因为它要用到三维空间中的叉积",
            "把曲面作刚体运动后，内蕴量会改变，外蕴量保持不变"
          ],
          answer: 0,
          why: "高斯绝妙定理指出 $K$ 只依赖第一基本形式 $E$、$F$、$G$，因此是内蕴量；而 $H$ 与主曲率依赖单位法向量的选择（法向量反向时 H 变号、κ₁、κ₂ 变号），所以是外蕴量，第一项正确。第二项混淆了「怎么算」与「是什么」：K 常用 L、M、N 计算，但结果可化为只含 E、F、G 的表达式，这说明它是内蕴的。第三项错在面积：面积元 $\\sqrt{EG - F^2}$ 完全由 $E$、$F$、$G$ 决定，是标准的内蕴量，叉积只是证明过程中的工具。第四项把结论说反了：刚体运动（平移与旋转）同时保持内蕴量与外蕴量，真正会改变 H 的是法向量反向或镜像反射。"
        },
        {
          id: "dg-intrinsic-q2",
          type: "multi",
          q: "关于曲面上的测地线，下列说法正确的有？",
          options: [
            "测地线的协变加速度为零，等价地说它的密切平面包含曲面的法向量",
            "给定一点与一个切向量，存在唯一的测地线以它们为初始条件",
            "测地线在每一点都局部最短，但整体上未必是两端点间的最短路径",
            "球面上所有纬线都是测地线，因为它们都是圆",
            "测地线方程 $\\gamma''^k + \\Gamma^k_{ij}\\gamma'^i\\gamma'^j = 0$ 中的 Christoffel 符号由第一基本形式决定，所以「是不是测地线」是内蕴问题"
          ],
          answer: [0, 1, 2, 4],
          why: "测地线的定义就是协变加速度 ∇_{γ'}γ' = 0，把它展开到 R³ 里看就是「加速度平行于法向量」，也就是密切平面含法向量，第一项正确；测地线方程是二阶常微分方程组，由解的存在唯一性定理，初值 (p, v) 唯一决定一条测地线，第二项正确；局部最短性来自测地极坐标与 Gauss 引理，而球面上绕大圆超过半圈后就不最短、对径点间有无穷多条最短测地线，都说明整体最短需要额外条件，第三项正确。第四项错在「所有纬线」：只有赤道是测地线，其余纬线 $u \\equiv u_0$ 使测地线方程左边等于 $-\\sin u_0\\cos u_0\\,(v')^2 \\ne 0$，其测地曲率为 $\\cot u_0$。第五项正确，Christoffel 符号只依赖 E、F、G 的导数，所以测地线是内蕴概念。"
        },
        {
          id: "dg-intrinsic-q3",
          type: "fill",
          q: "单位球面上 A = (1, 0, 0) 与 B = (0, 1, 0) 之间的内蕴（测地）距离等于 ____（用 π 表示或填小数）",
          answer: ["π/2", "pi/2", "1.5708", "1.57"],
          why: "$A$ 与 $B$ 都是单位向量且内积 $A \\cdot B = 0$，所以它们之间的中心角是 $\\arccos(0) = \\pi/2$，对应的最短路径是过 A、B 的大圆（这里是赤道的一段），长度等于半径 1 乘以中心角，即 π/2 ≈ 1.5708。注意不能填三维欧氏距离 $\\sqrt{2} \\approx 1.4142$：线段 $AB$ 穿过球体内部，不在曲面上，不属于允许的路径。这正是内蕴距离与外围空间距离的区别，也是「内蕴」二字在测地线问题上的具体体现。"
        },
        {
          id: "dg-intrinsic-q4",
          type: "order",
          q: "把「从长度泛函出发推出测地线方程」的思路排成正确顺序",
          items: [
            "把变分结果整理成坐标方程 $\\gamma''^k + \\Gamma^k_{ij}\\gamma'^i\\gamma'^j = 0$，并说明它由 $E$、$F$、$G$ 决定",
            "写出固定端点的曲线族 γ(t, s)，并对长度泛函 $L(s) = \\int\\left|\\frac{\\partial\\gamma}{\\partial t}\\right|dt$ 求一阶变分",
            "引入能量泛函 $E(s) = \\frac{1}{2}\\int\\left|\\frac{\\partial\\gamma}{\\partial t}\\right|^2 dt$，令 $\\delta E = 0$ 得到更简洁的方程",
            "用柯西不等式说明能量泛函的临界点必为常速参数化，因此也是长度泛函的临界点",
            "把「一阶变分为零」翻译成几何语言：加速度没有切向分量，即 $\\nabla_{\\gamma'}\\gamma' = 0$"
          ],
          answer: [1, 2, 3, 4, 0],
          why: "正确的路线是先写出带参数的曲线族并对长度泛函做一阶变分，但 |∂γ/∂t| 在参数化不良时不可微，于是改用被积函数更光滑的能量泛函，再用柯西不等式说明能量临界点自动常速、因而也是长度临界点，接着把变分为零翻译成协变加速度为零的几何陈述，最后展开成含 Christoffel 符号的坐标方程。把坐标方程放在第一步是常见错误：坐标形式依赖参数化与坐标系，而「协变加速度为零」才是与坐标无关的几何内容。"
        }
      ]
    },
    {
      id: "dg-gauss-bonnet",
      title: "高斯-博内定理与整体性质：欧拉示性数、亏格与向量场指标",
      goal: "能写出局部与整体高斯-博内公式，用测地三角形的球面盈余做验证，说明三角剖分证明的代数骨架，算出常见曲面的欧拉示性数与曲率积分，并叙述庞加莱-霍普夫定理与毛球定理。",
      est: 70,
      blocks: [
        {
          type: "analogy",
          title: "几何直观：不管怎么揉，曲率的总量被拓扑锁死",
          md: "回忆平面上的一个初等事实：任意凸多边形的外角和都等于 2π，与边数、形状无关。你把它拉长、压扁、扭一扭，外角和永远是 2π。高斯-博内定理（Gauss-Bonnet theorem）就是这件事在曲面上的版本：\n\n$$ \\oint k_g\\,ds + \\iint K\\,dA = 2\\pi\\chi $$\n\n其中 $k_g$ 是边界的测地曲率、$K$ 是高斯曲率、$\\chi$ 是欧拉示性数。右边**只与曲面的拓扑有关**，左边却是一堆几何量。它意味着：曲面上「总共弯了多少」不是可以随意调节的，它被曲面的「洞数」锁死了。\n\n三个画面：\n\n- **球面**：$K = \\frac{1}{R^2}$ 处处为正，$\\iint K\\,dA = \\frac{1}{R^2}(4\\pi R^2) = 4\\pi$，与半径无关——不管球多大，总弯曲量都是 $4\\pi$，因为 $\\chi = 2$。\n- **环面（甜甜圈）**：外圈像球面一样正弯，内圈却是马鞍形（$K < 0$），两者**正好抵消**，$\\iint K\\,dA = 0$，因为 $\\chi = 0$。\n- **球面三角形**：三条边都是大圆（测地线，$k_g = 0$），此时公式退化为「$\\text{内角和} - \\pi = \\text{面积}$」，这就是球面盈余（spherical excess）。地球上的测量员正是靠它测出地球是圆的：地面上画一个足够大的三角形，内角和超过 180°，多出来的角度直接读出面积与曲率。\n\n> 组合证明的直觉：把曲面切成许多测地三角形。所有内部边上的 ∮k_g 两两抵消（同一条边被两个三角形以相反方向走过），剩下的只有每个顶点处的「角亏损」——顶点周围的角度凑不满 2π 的那部分。于是总弯曲量就等于总角亏损，而后者只数顶点、边、面，是纯组合量。"
        },
        {
          type: "concept",
          title: "局部高斯-博内公式：边界、测地曲率与顶点转角",
          md: "**测地曲率（geodesic curvature）**：设 $\\gamma(s)$ 是曲面上以弧长为参数的曲线，$T = \\gamma'$，$\\mathbf{n}$ 是曲面单位法向量，则\n\n$k_g = (\\gamma'' \\cdot (\\mathbf{n} \\times T))$，\n\n它衡量曲线在**曲面内部**（切平面里）的转弯程度。两条重要性质：\n\n- 测地线恰好是 k_g ≡ 0 的曲线；\n- 把曲线投影到切平面上得到的曲率就是 |k_g|，而垂直于切平面的那部分弯曲由曲面的法曲率承担。**这就是「测地曲率 + 法曲率」分解的完整内容**：曲线在 $\\mathbb{R}^3$ 中的曲率平方等于两者平方和（$\\kappa^2 = k_g^2 + \\kappa_n^2$）。\n\n**局部高斯-博内公式**：设 R 是曲面上一个单连通区域，边界 ∂R 分段光滑、按「区域在左侧」的正向取定向，边界的光滑弧段为 $C_1, \\ldots, C_m$，顶点处的外角为 $\\theta_1, \\ldots, \\theta_m$（$\\text{外角} = \\pi - \\text{内角}$），则\n\n$$ \\iint_R K\\,dA + \\oint_{\\partial R} k_g\\,ds + \\sum \\theta_i = 2\\pi $$\n\n**每一步为什么合法**：把左端写成某个 1-形式沿 ∂R 的积分（这一步用的是 Stokes 定理），Stokes 定理要求边界分段光滑且区域紧致、有诱导定向；顶点处曲线不可微，Stokes 定理覆盖不到，必须把「转过的角度」单独作为离散项补上——这就是三个顶点项 θ_i 的来源。拆开看就是：\n\n- $\\iint_R K\\,dA$：区域内所有点的总弯曲；\n- $\\oint k_g\\,ds$：边界在切平面内的总转弯；\n- $\\sum \\theta_i$：边界在顶点处「拐硬弯」的角度。\n\n**两个直接推论**：\n\n- 平面的测地直线多边形（$K = 0$、$k_g = 0$）：$\\sum \\theta_i = 2\\pi$，回到初等几何的外角和定理。\n- 曲面上的**测地三角形**（$k_g = 0$）：$\\iint_R K\\,dA = 2\\pi - \\sum \\theta_i = \\sum \\text{内角} - \\pi$，即「球面盈余 = 曲率积分」。单位球面上内角全为 π/2 的八分之一球面三角形，面积正好是 3×(π/2) − π = π/2 ≈ 1.5708，与 4π/8 一致。"
        },
        {
          type: "concept",
          title: "整体高斯-博内定理与三角剖分的组合证明",
          md: "**整体高斯-博内定理**：设 M 是紧致、可定向、无边界的曲面，则\n\n$\\iint_M K\\,dA = 2\\pi\\chi(M)$，\n\n其中 $\\chi(M) = V - E + F$ 是欧拉示性数（Euler characteristic），也可以写成亏格形式 $\\chi = 2 - 2g$。\n\n**注意左边与度量无关的惊人程度**：左边看起来依赖曲面在 R³ 里怎么弯（K 依赖度量），右边却只是数顶点、边、面。于是任何两个同胚的曲面，无论怎么压扁拉长，曲率积分都相同。这是整体微分几何的第一个大定理，也是「局部的弯曲」与「整体的拓扑」之间的桥梁。\n\n**三角剖分证明的骨架**（每一步都可独立检验）：\n\n1. 把 $M$ 三角剖分成 $F$ 个测地三角形（每个三角形的边都是测地线），共 $V$ 个顶点、$E$ 条边。\n2. 对每个三角形用局部高斯-博内公式：$\\iint_{T} K\\,dA + \\oint_{\\partial T} k_g\\,ds + \\sum \\text{外角} = 2\\pi$。因为边是测地线，$k_g = 0$，所以每一项退化成 $\\iint_{T} K\\,dA + (\\pi - \\alpha) + (\\pi - \\beta) + (\\pi - \\gamma) = 2\\pi$，即\n\n$\\iint_{T} K\\,dA = \\alpha + \\beta + \\gamma - \\pi$（球面盈余公式）。\n\n3. 把 $F$ 个等式全部相加。左边是 $\\iint_M K\\,dA$；右边是 $3\\pi F - \\sum \\text{所有角}$。\n4. 用组合计数化简：无边界三角剖分满足 $3F = 2E$（每条边被两个三角形共用），而每个内部顶点周围的角度和是 $2\\pi$，所以 $\\sum \\text{所有角} = 2\\pi V$。于是\n\n$\\iint_M K\\,dA = 3\\pi F - 2\\pi V$。\n\n5. 代入 $3F = 2E$ 与 $\\chi = V - E + F$，得到 $3\\pi F - 2\\pi V = 2\\pi V - 2\\pi E + 2\\pi F = 2\\pi\\chi$。证毕。\n\n用正四面体检验：V = 4、E = 6、F = 4，3F = 12 = 2E；总角亏损 = 4 × (2π − 3×(π/3)) = 4π，而 2πχ = 2π × 2 = 4π，一致。\n\n**为什么这个证明「组合」**：第 4 步之后，几何量 K、k_g 全部消失了，只剩下数顶点、边、面的算术。这也解释了定理为什么对度量不敏感：**曲率的积分被拓扑强制固定**。"
        },
        {
          type: "concept",
          title: "曲面的分类、亏格与欧拉示性数",
          md: "**闭曲面的分类定理**：每个紧致、连通、无边界的曲面都同胚于下面两类之一：\n\n- **可定向**：亏格 $g \\ge 0$ 的「把手曲面」$\\Sigma_g$（球面上装 $g$ 个环柄），$\\chi = 2 - 2g$；\n- **不可定向**：射影平面 $\\mathrm{RP}^2$（$\\chi = 1$）或克莱因瓶（$\\chi = 0$），更一般地是 $\\mathrm{RP}^2$ 与若干环柄的连通和。\n\n**亏格（genus）g** 就是「洞的个数」：g = 0 是球面，g = 1 是环面，g = 2 是双环面（像 8 字形的椒盐卷饼）。欧拉示性数 χ = 2 − 2g 与它一一对应：\n\n| 曲面 | 亏格 $g$ | $\\chi$ | $\\iint K\\,dA$ |\n|---|---|---|---|\n| 球面 $S^2$ | $0$ | $2$ | $4\\pi \\approx 12.5664$ |\n| 环面 $T^2$ | $1$ | $0$ | $0$ |\n| 双环面 | $2$ | $-2$ | $-4\\pi \\approx -12.5664$ |\n| 射影平面 $\\mathrm{RP}^2$ | 不可定向 | $1$ | $2\\pi \\approx 6.2832$ |\n| 克莱因瓶 | 不可定向 | $0$ | $0$ |\n\n**关于不可定向曲面**：曲面不可定向时，K dA 作为面积形式需要靠定向二重覆盖来定义，但公式 ∬K dA = 2πχ 依然成立（对二重覆盖用定理再除以 2）。一个实用的推论是\n\n$\\iint |K|\\,dA \\ge 2\\pi|\\chi|$，\n\n等号成立当且仅当 $K$ 不变号。环面正是严格大于的例子：$\\chi = 0$ 而 $\\iint |K|\\,dA = 8\\pi \\approx 25.1327 > 0$。\n\n**欧拉示性数的两种算法**：\n\n- 组合法：χ = V − E + F，对任意三角剖分都相同（这是定理，不是定义）；\n- 同调法：$\\chi = \\sum (-1)^k b_k$，其中 $b_k$ 是第 $k$ 个贝蒂数（b₀ 是连通分支数，b₁ 是「独立的环」数，b₂ 是「封闭空腔」数）。球面 $(1, 0, 1) \\to 1 - 0 + 1 = 2$；环面 $(1, 2, 1) \\to 1 - 2 + 1 = 0$；双环面 $(1, 4, 1) \\to 1 - 4 + 1 = -2$。最后这个算法在第六讲的霍奇理论里会以「调和形式的维数」的身份再次出现。"
        },
        {
          type: "concept",
          title: "向量场的指标与庞加莱-霍普夫定理",
          md: "**向量场的零点指标**：设 V 是曲面上一个只有孤立零点的连续切向量场，p 是零点。在 $p$ 周围取一个足够小的正向圆圈，$V$ 沿这圈的方向角总共转了 $2\\pi k$，则定义指标 $\\mathrm{ind}_p(V) = k$。直观上：\n\n- 源点、汇点、涡旋点：指标 +1（方向绕一圈正好转一圈）；\n- 鞍点：指标 −1（方向绕一圈反而倒退一圈）；\n- 例如平面向量场 $V = (x, y)$ 在原点是源，指标 $+1$；$V = (x, -y)$ 在原点是鞍点，指标 $-1$。\n\n**庞加莱-霍普夫定理（Poincaré-Hopf）**：对紧致可定向曲面 M 上只有孤立零点的连续切向量场 V，\n\n$\\sum_p \\mathrm{ind}_p(V) = \\chi(M)$。\n\n于是零点个数与指标类型都被拓扑决定：\n\n- 球面 $\\chi = 2$：任何连续切向量场至少有两个零点，且指标和为 $2$（例如「等高线梯度场」在南极与北极各有一个 +1 的零点）。\n- **毛球定理（hairy ball theorem）**：球面上不存在处处非零的连续切向量场——你无法把椰子上的毛全部梳平而不留一个「旋」。\n- 环面 χ = 0：存在处处非零的连续切向量场，甜甜圈可以梳平（比如沿经线方向一致的场，虽然它沿纬线转一圈会回到自身，但整体没有零点）。\n\n**与高斯-博内的联系**：Hopf 的证明思路是把曲率「集中」到有限个点上。取一个只有孤立零点的向量场，用它的球面像把 K dA 拉回到零点附近：每个指标为 $k$ 的零点贡献 $2\\pi k$ 的角度，求和正好是 $2\\pi\\chi$。这与三角剖分证明是同一件事的两种语言——一个用面积，一个用角度。\n\n**小结三句话**：局部高斯-博内讲「区域内部的弯曲 = 边界转弯 + 顶点转角」；整体高斯-博内讲「总弯曲 $= 2\\pi\\chi$」；庞加莱-霍普夫讲「向量场的零点指标和 $= \\chi$」。三者是同一个拓扑量的三种几何表现。"
        },
        {
          type: "calc",
          title: "手算演练：曲率积分、测地三角形与正多面体的角亏损",
          inputs: [
            { name: "曲面一", value: "球面 R = 1 与 R = 3" },
            { name: "曲面二", value: "环面 R = 2、r = 1" },
            { name: "曲面三", value: "单位球面上的测地三角形（三个内角都是 π/2）" },
            { name: "曲面四", value: "正四面体、正十二面体" },
            { name: "要求", value: "各自的 ∬K dA 与 2πχ，检查高斯-博内是否成立" }
          ],
          outputs: [
            "球面 $R = 1$：$K = 1$，面积 $= 4\\pi$，$\\iint K\\,dA = 4\\pi \\approx 12.5664$；$2\\pi\\chi = 2\\pi \\times 2 = 4\\pi$，一致",
            "球面 $R = 3$：$K = \\frac{1}{9} \\approx 0.1111$，面积 $= 4\\pi R^2 = 36\\pi$，$\\iint K\\,dA = \\frac{36\\pi}{9} = 4\\pi \\approx 12.5664$，与半径无关——因为 $\\chi = 2$ 只认拓扑",
            "环面：面积元 $\\sqrt{EG - F^2} = 2 + \\cos u$，$K = \\frac{\\cos u}{2 + \\cos u}$，于是 $K\\,dA = \\cos u\\,du\\,dv$，$\\iint K\\,dA = \\int_0^{2\\pi} \\int_0^{2\\pi} \\cos u\\,du\\,dv = 0$；$2\\pi\\chi = 2\\pi \\times 0 = 0$，一致",
            "环面的绝对值积分：$\\iint |K|\\,dA = \\int_0^{2\\pi} \\int_0^{2\\pi} |\\cos u|\\,du\\,dv = 2\\pi \\times 4 = 8\\pi \\approx 25.1327 > 2\\pi|\\chi| = 0$，验证了不等式在 $K$ 变号时严格成立",
            "测地三角形（单位球面，$A$、$B$、$C$ 三个内角都是 $\\pi/2$）：面积 $= (\\pi/2 + \\pi/2 + \\pi/2) - \\pi = \\pi/2 \\approx 1.5708$，恰好是八分之一球面面积 $4\\pi/8$",
            "同一三角形的局部高斯-博内核对：$\\oint k_g\\,ds = 0$（三边都是大圆），三个外角各为 $\\pi - \\pi/2 = \\pi/2$，和 $= 3\\pi/2 \\approx 4.7124$，于是 0 + 4.7124 + 1.5708 = 6.2832 = 2π，成立",
            "另一个测地三角形（内角 1.0、1.2、1.4 弧度）：面积 = 1.0 + 1.2 + 1.4 − π ≈ 0.4584，数值验证与球面盈余公式完全一致",
            "正四面体：V = 4、E = 6、F = 4，V − E + F = 2；每个顶点的角亏损 $= 2\\pi - 3 \\times (\\pi/3) = \\pi$，总角亏损 $= 4\\pi \\approx 12.5664 = 2\\pi\\chi$，成立",
            "正十二面体：每个顶点汇聚 3 个正五边形，内角各为 $3\\pi/5$，角亏损 $= 2\\pi - 9\\pi/5 = \\pi/5$；20 个顶点共 $20 \\times \\pi/5 = 4\\pi \\approx 12.5664 = 2\\pi\\chi$，成立",
            "正二十面体：12 个顶点各汇聚 5 个正三角形，角亏损 $= 2\\pi - 5\\pi/3 = \\pi/3$，总和 $= 12 \\times \\pi/3 = 4\\pi$，同样成立（它们都同胚于球面，$\\chi = 2$）",
            "亏格 2 的曲面的把手曲面：$\\chi = 2 - 2 \\times 2 = -2$，$\\iint K\\,dA = 2\\pi \\times (-2) = -4\\pi \\approx -12.5664$（K 必须整体偏负，事实上双环面可以取到 K < 0 的度量）",
            "贝蒂数算法复核：球面 $b = (1, 0, 1)$ 给出 $\\chi = 1 - 0 + 1 = 2$；环面 $b = (1, 2, 1)$ 给出 $1 - 2 + 1 = 0$；双环面 $b = (1, 4, 1)$ 给出 $1 - 4 + 1 = -2$"
          ],
          note: "做这类题先分清「要算 $\\iint K\\,dA$ 还是 $\\iint |K|\\,dA$」：前者由 $2\\pi\\chi$ 直接读出，后者需要知道 $K$ 的符号分布。环面是唯一能把两者差别展示得最清楚的例子：$\\iint K\\,dA = 0$ 而 $\\iint |K|\\,dA = 8\\pi$。"
        },
        {
          type: "interactive",
          lab: "datalab",
          title: "高斯-博内定理验证：测地三角形、多面体与环面",
          config: {
            state: { 对象: "单位球面", 曲率积分: "待算", "2πχ": "待算", 是否成立: "待检验" },
            steps: [
              { desc: "第一步：单位球面（χ = 2）的总曲率", state: { K: "1（处处相同）", 面积: "4π ≈ 12.5664", "∬K dA": "4π ≈ 12.5664", "2πχ": "2π × 2 = 4π", 核对: "一致" }, note: "球面是最容易的例子：K 是常数，积分就是乘法。" },
              { desc: "第二步：取八分之一球面的测地三角形", state: { 顶点: "A = (1,0,0)、B = (0,1,0)、C = (0,0,1)", 边: "三段大圆弧，都是测地线，k_g = 0", di: "三个内角都是 π/2 ≈ 1.5708" }, note: "「测地三角形」意味着三条边都满足协变加速度为零，因此边界项 ∮k_g ds 直接为零。" },
              { desc: "第三步：算球面盈余（内角和减 π）", state: { 内角和: "3 × π/2 = 3π/2 ≈ 4.7124", 减π: "3π/2 − π = π/2 ≈ 1.5708", 独立算法: "八分之一球面面积 = 4π/8 = π/2", 核对: "两种算法结果相同" }, note: "球面盈余公式「面积 = 内角和 − π」是局部高斯-博内最直观的特例。" },
              { desc: "第四步：算三个顶点的外角", state: { 每个外角: "π − π/2 = π/2 ≈ 1.5708", 外角总和: "3 × π/2 = 3π/2 ≈ 4.7124", 含义: "外角是「边界拐硬弯」的角度" }, note: "顶点处曲线不可微，Stokes 定理管不到，必须单独补上这些离散项——这是局部公式里最容易被忘掉的部分。" },
              { desc: "第五步：核对局部高斯-博内公式", state: { "∮k_g ds": 0, 外角总和: "3π/2 ≈ 4.7124", "∬K dA": "π/2 ≈ 1.5708", 合计: "0 + 4.7124 + 1.5708 = 6.2832", "2π": "6.2832", 核对: "成立" }, note: "三部分的角色很清楚：区域内部弯曲、边界测地弯曲、顶点转角。" },
              { desc: "第六步：换成多面体逼近——正四面体", state: { V: 4, E: 6, F: 4, "V - E + F": 2, 每个顶点角亏损: "2π − 3 × (π/3) = π", 总角亏损: "4π ≈ 12.5664", "2πχ": "4π", 核对: "成立" }, note: "多面体的「曲率」全集中在顶点：面是平的（K = 0），边是直的（k_g = 0），只剩角亏损。" },
              { desc: "第七步：再换两个正多面体复核", state: { 正十二面体: "20 顶点 × (2π − 3 × 3π/5) = 20 × π/5 = 4π", 正二十面体: "12 顶点 × (2π − 5 × π/3) = 12 × π/3 = 4π", 共同点: "χ 都是 2，所以总角亏损都是 4π" }, note: "不管怎么剖分、多少个面，只要同胚于球面，总角亏损就是 4π——这就是「拓扑锁定几何」。" },
              { desc: "第八步：环面（χ = 0）——正负曲率精确抵消", state: { K: "cos u / (2 + cos u)", 面积元: "2 + cos u", "K dA": "cos u du dv", "∬K dA": "0（数值积分 0.0000）", "2πχ": 0, 核对: "成立" }, note: "外圈 $u = 0$ 处 $K = \\frac{1}{3} > 0$，内圈 $u = \\pi$ 处 $K = -1 < 0$：正负部分面积不同但积分相同，正好抵消。" },
              { desc: "第九步：绝对值积分与亏格的推广", state: { "∬|K| dA": "∫∫|cos u| du dv = 8π ≈ 25.1327", 不等式: "∬|K| dA ≥ 2π|χ| = 0，严格大于", 亏格公式: "χ = 2 − 2g", "g = 2": "χ = −2，∬K dA = −4π ≈ −12.5664" }, note: "$\\iint K\\,dA$ 只认 $\\chi$，$\\iint |K|\\,dA$ 才反映 $K$ 的分布；两者相等当且仅当 K 不变号。" },
              { desc: "第十步：把三件事串起来", state: { 局部公式: "∬_R K dA + ∮ k_g ds + Σ外角 = 2π", 整体公式: "∬_M K dA = 2πχ(M)", 向量场版本: "Σ ind_p(V) = χ(M)", 共同点: "同一个拓扑量的三种几何表现" } }
            ],
            tasks: [
              { t: "在球面上取一个内角为 π/2、π/3、π/4 的测地三角形，先算面积（答案 π/2 + π/3 + π/4 − π = π/12 ≈ 0.2618），再用球面盈余公式核对。", hint: "面积只由三个内角决定，与三角形的位置和大小无关。" },
              { t: "把四面体的每个顶点「切掉」做成截角四面体，重新数 V、E、F 与角亏损，验证 χ 仍然是 2。", check: "能说明角亏损总和始终等于 2πχ，与剖分方式无关。" }
            ]
          }
        },
        {
          type: "pitfall",
          title: "常见误区：把积分、示性数与「K 是否为零」混起来",
          items: [
            "把 $\\iint K\\,dA = 0$ 当成 $K \\equiv 0$：环面的 $K$ 处处不为零（外圈 1/3、内圈 −1），只是正负贡献抵消。积分是零，函数不是零。",
            "把 χ 与曲率大小混起来：χ 是拓扑不变量，与度量无关。同一个环面无论压扁、拉长、扭成什么形状，∬K dA 始终是 0。",
            "忘记局部公式里的顶点项：分段光滑边界在顶点处不可微，Stokes 定理覆盖不到，必须补上外角 $\\sum \\theta_i$。漏掉它会让测地三角形算出 $0 = 2\\pi$ 的矛盾。",
            "以为球面三角形的内角和等于 π：单位球面上「内角和 − π = 面积」，所以内角和总大于 π，只有面积趋于 0 时才趋近 π。把平面几何的结论直接搬到球面上是初学者最常见的错误。",
            "把角亏损的结论限定在正多面体上：任何三角剖分都满足「总角亏损 = 2πχ」，正多面体只是最好算的例子；用不同的剖分算同一个曲面，结果必然相同。",
            "把不可定向曲面排除在定理之外：高斯-博内对不可定向闭曲面同样成立（射影平面 χ = 1，克莱因瓶 χ = 0），只是积分号里的 K dA 需要用定向二重覆盖来定义，并且要区分 ∬K dA 与 ∬|K| dA。"
          ]
        },
        {
          type: "lab",
          title: "动手练习：曲率积分与向量场指标",
          steps: [
            "对球面 R = 1、2、3 分别算出 ∬K dA，验证结果都是 4π，并解释为什么它与半径无关。",
            "对环面 $X(u, v) = ((2 + \\cos u) \\cos v, (2 + \\cos u) \\sin v, \\sin u)$ 验证 $K\\,dA = \\cos u\\,du\\,dv$，从而 $\\iint K\\,dA = 0$ 与 $\\iint |K|\\,dA = 8\\pi$，并指出 K = 0 的两条纬线（u = π/2 与 u = 3π/2）。",
            "用测地三角形面积公式算出一个内角为 π/2、π/2、π/3 的球面三角形面积，答案 π/3 ≈ 1.0472，并在球面上标出它大致的位置。",
            "在球面上画一个「从南极到北极的梯度场」，找出它的两个零点并算出指标（都是 $+1$），验证指标和为 $2 = \\chi$；再解释为什么这个向量场不可能处处非零。",
            "在环面上构造一个处处非零的连续切向量场（例如沿经线方向的场），说明它与 χ = 0 为什么不矛盾。",
            "把正八面体（6 顶点、12 条边、8 个面）与正二十面体的角亏损都算一遍，验证它们都等于 4π。"
          ],
          note: "这一讲把前面所有工具串成一条线：E、F、G 给出度量，度量给出 K，K 的积分给出拓扑。学完后你应该能一眼看出「哪些量可以随意改变、哪些被拓扑锁死」。"
        }
      ],
      quiz: [
        {
          id: "dg-gauss-bonnet-q1",
          type: "single",
          q: "设 T 是嵌入 R³ 的标准环面（甜甜圈形状），则它上面的高斯曲率 K 与曲率积分满足？",
          options: [
            "K 在环面上有正有负且处处不为零，但 ∬K dA = 0",
            "K 恒等于零，因此 ∬K dA = 0",
            "K 处处为正，但正负相消使 ∬K dA = 0",
            "K 有正有负，且 ∬K dA = 4π，因为它同胚于球面"
          ],
          answer: 0,
          why: "环面外侧（离旋转轴较远的一圈）像球面一样朝同一侧弯，K > 0；内侧（靠近中心孔的一圈）像马鞍面，K < 0，两侧之间存在 K = 0 的过渡纬线，所以 K 处处不为零但会变号。由整体高斯-博内定理 $\\iint K\\,dA = 2\\pi\\chi$，环面 $\\chi = 2 - 2 \\times 1 = 0$，积分必为 $0$，这与正负贡献恰好抵消一致。选项二把「积分为零」错当成「函数为零」；选项三错在说 K 处处为正，那样积分不可能为 0；选项四既说错了 χ（环面与球面不同胚，χ 分别为 0 与 2），又说错了积分值。"
        },
        {
          id: "dg-gauss-bonnet-q2",
          type: "single",
          q: "关于庞加莱-霍普夫定理与毛球定理，下列说法正确的是？",
          options: [
            "球面上任何只有孤立零点的连续切向量场的零点指标和都等于 2，因此不存在处处非零的连续切向量场",
            "球面上存在处处非零的连续切向量场，只是它必须绕极点旋转",
            "环面上任何连续切向量场都必有零点，因为它的曲率积分等于零",
            "向量场的零点指标只能取 +1，所以零点个数一定等于欧拉示性数"
          ],
          answer: 0,
          why: "庞加莱-霍普夫定理说零点指标和等于欧拉示性数，球面 $\\chi = 2$，所以任何只有孤立零点的连续切向量场指标和都是 $2$；若存在处处非零的场，指标和就是空集之和 $0$，矛盾，这就是毛球定理，第一项成立。第二项与毛球定理直接冲突：椰子上的毛无法全部梳平。第三项把两件事错误地联系起来：环面 χ = 0 恰恰允许存在处处非零的连续切向量场（例如沿一个固定方向的场），曲率积分为零是 χ = 0 的推论，而不是「必有零点」的理由。第四项错在指标不只有 +1：鞍点的指标是 −1，球面上也可能出现一个 −1 与三个 +1 的零点组合，只要总和为 2。"
        },
        {
          id: "dg-gauss-bonnet-q3",
          type: "fill",
          q: "正四面体四个顶点处的角亏损总和等于 ____（用 π 表示或填小数）",
          answer: ["4π", "4pi", "12.5664", "4*π"],
          why: "正四面体每个顶点汇聚 3 个正三角形，每个内角是 π/3，所以顶点周围的角度和是 3 × π/3 = π，而平面上一圈是 2π，角亏损为 2π − π = π。四个顶点共 $4\\pi \\approx 12.5664$。由高斯-博内的组合形式，总角亏损等于 $2\\pi\\chi$，而正四面体同胚于球面，$V - E + F = 4 - 6 + 4 = 2$，故 $2\\pi\\chi = 4\\pi$，两种算法一致。若误把内角当成 π/6 或把角亏损写成 2π − 3π/6，就会得到错误答案。"
        },
        {
          id: "dg-gauss-bonnet-q4",
          type: "order",
          q: "把「用三角剖分证明整体高斯-博内定理」的步骤排成正确顺序",
          items: [
            "把 M 三角剖分成 F 个测地三角形，记顶点数为 V、边数为 E",
            "对每个三角形用局部高斯-博内，得到面积项等于三个内角之和减 π",
            "把所有三角形上的等式相加，左边合并为 $\\iint_M K\\,dA$",
            "利用 $3F = 2E$（每条内边被两个三角形共用）与 $\\sum \\text{所有角} = 2\\pi V$ 化简右边",
            "代入 $\\chi = V - E + F$，得到 $\\iint_M K\\,dA = 2\\pi\\chi$"
          ],
          answer: [0, 1, 2, 3, 4],
          why: "这条证明的骨架是：先剖分（否则没有可用局部公式的对象），再逐片用局部高斯-博内把曲率积分换成角度的代数和，然后求和让内部边的测地曲率贡献两两抵消、只剩角度，接着用组合计数 3F = 2E 与每个内部顶点周围角度和为 2π 把角度和写成 2πV，最后代入欧拉示性数的定义完成。顺序中任何一步提前都会失去依据：没有剖分就无法逐片求和；不先求和就无法利用「内边互相抵消」这一关键事实；不化简成 V、E、F 就得不出与度量无关的结论。"
        }
      ]
    },
    {
      id: "dg-modern",
      title: "从曲面到流形：黎曼度量、曲率张量、霍奇理论与应用",
      goal: "能说清光滑流形与切空间的定义动机，写出黎曼度量与截面曲率的定义并计算常曲率空间的曲率量，叙述测地线与指数映射的推广形式，表述霍奇定理与霍奇分解，并举例说明微分几何在广义相对论与拓扑数据分析中的应用。",
      est: 72,
      blocks: [
        {
          type: "analogy",
          title: "几何直观：住在曲面里的人，看不见外面的空间",
          md: "地球表面是二维的：站在任何一点，你看到的地面都像一张平面，走遍全球也找不到「边缘」。可是地球整体又不是平面——它是球面。这种「局部像欧氏空间、整体可以完全不同」的对象就是**流形（manifold）**。\n\n前五讲的所有概念，其实都不需要「外面还有一个 R³」：\n\n- 第一基本形式 E、F、G 只活在曲面内部，蚂蚁靠它量长度；\n- 测地线方程由 Christoffel 符号给出，而符号只依赖 E、F、G；\n- 高斯绝妙定理告诉我们 K 也是内蕴的。\n\n既然如此，为什么不干脆把 R³ 丢掉？于是有了三个层次的推广：\n\n1. **流形**：局部像 Rⁿ 的空间，配上光滑的坐标图册。它是「可以谈微积分的最一般的舞台」。\n2. **黎曼流形**：在每点的切空间上装一个正定内积 $g$，于是能测长度与角度。度量 $g$ 就是 $E$、$F$、$G$ 的高维版本。\n3. **曲率**：由度量出发定义联络与曲率张量，再取出截面曲率。二维情形下截面曲率只有一个值，正是高斯曲率 K。\n\n**为什么广义相对论需要这套语言**：时空是 4 维流形，而且**没有**「外面」可以嵌入进去；引力不是力，而是时空的弯曲，自由下落的粒子沿测地线运动。要写下 Einstein 方程，必须先有流形、度量、联络、曲率张量这一整套不依赖外围空间的工具。\n\n**为什么拓扑数据分析需要它**：一堆点云数据没有坐标纸，但可以给它装上度量（相似度），再算它的持久同调——这本质上是「数据形状」的 Betti 数与 Euler 示性数，而后者正是高斯-博内定理右边那个 $\\chi$。"
        },
        {
          type: "concept",
          title: "光滑流形、切空间与黎曼度量",
          md: "**光滑流形（smooth manifold）**：一个 $n$ 维流形 $M$ 是带有一族坐标卡 $\\{(U_\\alpha, \\varphi_\\alpha)\\}$ 的拓扑空间，每个 $\\varphi_\\alpha: U_\\alpha \\to \\mathbb{R}^n$ 是同胚，覆盖整个 $M$，且任意两张卡之间的转移映射 $\\varphi_\\beta \\circ \\varphi_\\alpha^{-1}$ 在重叠区域上光滑。**一句话动机：流形就是「局部可以当 Rⁿ 用」的空间，图册让「求导」这件事变得有意义。**\n\n**切空间（tangent space）**：在点 p 处，把所有过 p 的曲线的速度向量按「在同一坐标下相等」等价起来，得到的线性空间记作 T_pM，维数等于 n。\n\n**一句话动机：切空间是「在 p 点能走的所有方向」构成的线性空间，有了线性结构才能做线性代数。** 三种等价的定义方式：\n\n- 曲线定义：$T_pM = \\{\\gamma'(0) : \\gamma \\text{ 是过 } p \\text{ 的光滑曲线}\\}$，两个曲线若在某组坐标下一阶导数相同就视为同一个切向量；\n- 导子定义：$T_pM = \\{\\text{满足 Leibniz 法则的线性映射 } D: C^\\infty(M) \\to \\mathbb{R}\\}$，这是与坐标无关的定义，最优雅；\n- 等价类定义：用图册上的 (p, v) 的等价类。\n\n**黎曼度量（Riemannian metric）**：在每点 $p$ 指定 $T_pM$ 上一个正定的对称双线性型 $g_p$，并要求它随 $p$ 光滑变化。在坐标 $(x^1, \\ldots, x^n)$ 下写成\n\n$$ g = \\sum g_{ij}\\,dx^i dx^j $$\n\n其中 $g_{ij} = g(\\partial/\\partial x^i, \\partial/\\partial x^j)$。装上黎曼度量的流形称为**黎曼流形（Riemannian manifold）**，记作 $(M, g)$。\n\n**度量立刻给你三样东西**：\n\n- 长度：曲线 $\\gamma$ 的长度 $= \\int\\sqrt{\\sum g_{ij}\\gamma'^i\\gamma'^j}\\,dt$，这正是曲面上 $\\int\\sqrt{E u'^2 + 2F u'v' + G v'^2}\\,dt$ 的推广；\n- 体积：体积元 $dV = \\sqrt{\\det(g_{ij})}\\,dx^1\\cdots dx^n$，二维时 $\\sqrt{EG - F^2}\\,du\\,dv$ 就是它的特例；\n- 距离：两点间距离 = 最短曲线的长度，于是流形变成度量空间。\n\n**两个例子**：单位球面 $S^2$ 用球坐标时 $g = du^2 + \\sin^2 u\\,dv^2$（即 E = 1、F = 0、G = sin²u）；双曲平面用上半平面 $y > 0$ 上的度量 $g = \\frac{dx^2 + dy^2}{y^2}$，它的截面曲率恒为 $-1$，是「处处马鞍」的世界，也是非欧几何的第一个具体模型。"
        },
        {
          type: "concept",
          title: "曲率张量与截面曲率",
          md: "**从联络到曲率**：黎曼度量唯一确定一个无挠、与度量相容的联络 $\\nabla$（Levi-Civita 联络），它就是 Christoffel 符号在高维的写法。有了联络，就能定义**黎曼曲率张量（Riemann curvature tensor）**：\n\n$R(X, Y)Z = \\nabla_X\\nabla_Y Z - \\nabla_Y\\nabla_X Z - \\nabla_{[X, Y]}Z$。\n\n**怎么读这个式子**：它衡量「先沿 X 求导、再沿 Y 求导」与「反过来」的差别。在平坦空间里两种顺序结果相同，差为零；在弯曲空间里差别正是曲率。特别地，把向量沿一个无穷小闭环平行移动一圈回来，它相对自身转过的角度就由 R 给出。\n\n**截面曲率（sectional curvature）**：取 $p$ 点切空间里任意一个二维平面 $\\sigma = \\mathrm{span}\\{X, Y\\}$（$X$、$Y$ 线性无关），定义\n\n$K(\\sigma) = \\frac{\\langle R(X, Y)Y, X\\rangle}{|X|^2|Y|^2 - \\langle X, Y\\rangle^2}$。\n\n**三个要点**：\n\n- 截面曲率只需要一个二维平面，不需要四个向量；\n- 分母是 X、Y 张成的平行四边形面积的平方，所以定义与 X、Y 的具体选取无关，只依赖平面 σ；\n- **二维流形只有一个截面（就是切空间本身），此时截面曲率就是高斯曲率 K。** 所以高斯曲率是截面曲率的二维特例——这句话解释了为什么第二讲的 K 会「自动」是一个内蕴量：截面曲率一开始就是内蕴定义的。\n\n**三个缩并量**：\n\n- Ricci 曲率：$\\mathrm{Ric}(X, Y) = \\mathrm{tr}(Z \\mapsto R(Z, X)Y)$，是对截面曲率在某个方向上的求和；\n- 标量曲率：$s = \\mathrm{tr}_g\\mathrm{Ric}$，是 Ricci 的度量缩并；\n- 在常曲率空间（截面曲率恒为 $K$）中三者关系极简：$\\mathrm{Ric} = (n - 1)Kg$，$s = n(n - 1)K$。\n\n**Einstein 方程**（示意写法，不追究常数约定）：\n\n$\\mathrm{Ric} - \\frac{1}{2}sg = 8\\pi G T$，\n\n左边是纯几何（时空的弯曲），右边是物质能量动量张量 T。**「物质告诉时空如何弯曲，时空告诉物质如何运动」** 这句名言的前半句就是这条方程，后半句是「自由粒子沿测地线运动」。\n\n**Schwarzschild 解的一个细节**：它是真空解，所以 $\\mathrm{Ric} = 0$，但黎曼曲率张量**不**为零（潮汐力仍在）；衡量「弯曲强度」的 Kretschmann 标量 $R_{abcd}R^{abcd} = \\frac{48M^2}{r^6}$，取 $M = 1$、$r = 10$ 时约为 $4.8 \\times 10^{-5}$，随 $r$ 迅速衰减——这就是为什么远处的引力场几乎可以当成平坦的。"
        },
        {
          type: "concept",
          title: "测地线与指数映射的推广",
          md: "**推广几乎逐字照搬**：把第二讲的讨论从曲面搬到 $n$ 维黎曼流形，所有公式只要把 $(u, v)$ 换成 $(x^1, \\ldots, x^n)$、把 $E$、$F$、$G$ 换成 $g_{ij}$ 即可。\n\n- **测地线**：满足 $\\nabla_{\\gamma'}\\gamma' = 0$ 的曲线，坐标形式为\n\n$\\gamma''^k + \\Gamma^k_{ij}\\gamma'^i\\gamma'^j = 0$，其中 $\\Gamma^k_{ij} = \\frac{1}{2}g^{kl}(\\partial_i g_{jl} + \\partial_j g_{il} - \\partial_l g_{ij})$。\n\n- **它与「最短」的关系**：测地线是能量泛函（等价地，长度泛函）的临界点，在局部是最短的；这正是「测地线 = 曲面上的直线」在任意维度的版本。\n- **指数映射**：$\\exp_p: T_pM \\to M$ 定义为 $\\exp_p(v) = \\gamma_v(1)$，其中 $\\gamma_v$ 是从 $p$ 出发、初速为 $v$ 的测地线。它把切空间的一个邻域微分同胚地映到流形上的一个邻域，是「用平坦的切空间给弯曲的流形画局部地图」的标准工具。\n- **测地极坐标与 Gauss 引理**：在以 $p$ 为原点的测地极坐标下，度量写成 $dr^2 + (\\text{只含角向的项})$，没有 $dr$ 与角向的交叉项。这条「没有交叉项」的事实就是 Gauss 引理，它保证测地线垂直于测地圆，也是「测地线局部最短」的证明关键。\n- **Hopf-Rinow 定理**：对连通的黎曼流形，以下三条等价：度量空间完备；存在闭的有界子集都紧致；$\\exp_p$ 对每个 $p$ 都在整个 $T_pM$ 上有定义。满足时任意两点之间都存在最短测地线。**它给「最短测地线是否存在」这个看似显然的问题提供了真正的答案。**\n- **共轭点**：沿一条测地线，若存在非零的 Jacobi 场在该点为零，则该点称为共轭点。过了第一个共轭点，测地线就不再是局部最短的。球面上北极的对径点是共轭点：所有从北极出发的测地线（经线）在走完长度 π 后重新汇聚到南极——这就是指数映射不再单射的地方。\n- **比较定理（一句话）**：曲率越大，测地线越倾向于汇聚（正曲率 → 共轭点来得早，球面就是极端例子），曲率越小越倾向于发散（负曲率 → 测地线散开，双曲空间如此）。这一条把「曲率」与「测地线的整体行为」连了起来，是整体黎曼几何的主线。"
        },
        {
          type: "concept",
          title: "霍奇理论与霍奇分解的表述",
          md: "**为什么需要它**：高斯-博内定理告诉我们「曲率的积分」等于一个拓扑不变量 χ。可是 χ 是怎么来的？为什么偏偏是 χ？霍奇理论（Hodge theory）给出代数化的答案：拓扑不变量可以用**微分形式的方程**解出来。\n\n**准备三个算子**：\n\n- 外微分 $d: \\Omega^k \\to \\Omega^{k+1}$，满足 $d^2 = 0$；\n- 余微分 $\\delta: \\Omega^k \\to \\Omega^{k-1}$，是 $d$ 关于 $L^2$ 内积的形式伴随；\n- 霍奇拉普拉斯算子 $\\Delta = d\\delta + \\delta d$，它是一个二阶椭圆算子。\n\n**调和形式**：满足 $\\Delta\\omega = 0$ 的形式。在紧致无边界流形上可以证明 $\\Delta\\omega = 0$ 等价于 $d\\omega = 0$ 且 $\\delta\\omega = 0$（既闭又余闭）。\n\n**de Rham 上同调**：$H^k_{dR}(M) = \\text{闭 } k \\text{-形式} / \\text{恰当 } k \\text{-形式}$，它的维数就是第 $k$ 个贝蒂数 $b_k$。\n\n**霍奇定理**：设 M 是紧致、可定向、无边界的黎曼流形，则每个 de Rham 上同调类中恰有一个调和代表元，即\n\n$H^k_{dR}(M) \\cong H^k(M) := \\{\\text{调和 } k \\text{-形式}\\}$，于是 $b_k = \\dim H^k(M)$。\n\n**霍奇分解（Hodge decomposition）**：微分形式空间有正交直和分解\n\n$$ \\Omega^k(M) = \\mathrm{Im}\\,d \\oplus \\mathrm{Im}\\,\\delta \\oplus H^k(M) $$\n\n即每个 k-形式都能**唯一**地写成\n\n$\\omega = d\\alpha + \\delta\\beta + \\gamma$，其中 $\\gamma$ 是调和形式。\n\n**这个分解的两点意义**：\n\n- 它是一个「解方程的工具」：给一个形式，判断它是否恰当 / 余恰当 / 调和，等价于看它落在哪一块；\n- 它把分析（椭圆算子的解空间）与拓扑（贝蒂数）焊在一起：调和形式的维数是纯分析的量，却等于纯拓扑的 b_k。\n\n**与前面内容的呼应**：第二讲用高斯-博内把「曲率积分」化为「χ」；这里用霍奇理论把「χ」化为「椭圆方程解空间的维数」，而\n\n$\\chi(M) = \\sum_k (-1)^k b_k$。\n\n在二维情形 $b_0 - b_1 + b_2 = 2 - 2g$，正好回到亏格公式。**同一批数字，三次换了身份。**\n\n**两个应用方向的落点**：\n\n- 广义相对论：Einstein 方程是一个关于度量的二阶非线性椭圆 / 双曲系统，调和形式与 Hodge 分解是研究其解空间与守恒量的常规工具（例如稳态解中的各种「荷」常来自调和形式）。\n- 拓扑数据分析（TDA）：数据点云的持续同调（persistent homology）计算的正是不同尺度下的贝蒂数，用「条形码」把拓扑特征按尺度筛出来；它的理论根基就是「拓扑不变量可以被算出来」，而这条思路的源头正是高斯-博内与霍奇理论。"
        },
        {
          type: "calc",
          title: "手算演练：常曲率空间的截面曲率、Ricci 与标量曲率",
          inputs: [
            { name: "流形一", value: "球面 $S^2(R = 3)$ 与 $S^3(R = 2)$" },
            { name: "流形二", value: "双曲空间 $H^2$ 与 $H^3$（截面曲率 $-1$）" },
            { name: "流形三", value: "平坦环面 $T^2 = \\mathbb{R}^2/\\mathbb{Z}^2$" },
            { name: "要求", value: "截面曲率、Ricci 张量、标量曲率，并用 χ 检验高斯-博内" }
          ],
          outputs: [
            "常曲率空间的一般公式：$\\mathrm{Ric} = (n - 1)Kg$，标量曲率 $s = n(n - 1)K$，黎曼张量 $R_{ijkl} = K(g_{ik}g_{jl} - g_{il}g_{jk})$",
            "$S^2(R = 3)$：截面曲率 $K = \\frac{1}{R^2} = \\frac{1}{9} \\approx 0.1111$；$n = 2$ 故 $\\mathrm{Ric} = (2 - 1)Kg = \\frac{1}{9}g$；标量曲率 $= 2 \\times 1 \\times \\frac{1}{9} = \\frac{2}{9} \\approx 0.2222$",
            "$S^2(R = 3)$ 的面积 $= 4\\pi R^2 = 36\\pi \\approx 113.0973$，于是 $\\iint K\\,dA = 36\\pi \\times \\frac{1}{9} = 4\\pi \\approx 12.5664 = 2\\pi\\chi$（$\\chi = 2$），与半径无关",
            "$S^3(R = 2)$：截面曲率 $= \\frac{1}{4} = 0.25$；$\\mathrm{Ric} = (3 - 1) \\times 0.25g = 0.5g$；标量曲率 $= 3 \\times 2 \\times 0.25 = 1.5$；体积 $= 2\\pi^2 R^3 = 16\\pi^2 \\approx 157.9137$",
            "双曲空间：截面曲率恒为 $-1$，$H^2$ 的标量曲率 $= 2 \\times 1 \\times (-1) = -2$，$H^3$ 的标量曲率 $= 3 \\times 2 \\times (-1) = -6$",
            "平坦环面：存在 $K \\equiv 0$ 的度量，所以标量曲率 $= 0$，而 $\\iint K\\,dA = 0 = 2\\pi\\chi$（$\\chi = 0$），与高斯-博内一致",
            "黎曼张量的分量检验：对 $S^2(R)$ 取 $g_{11} = R^2$、$g_{22} = R^2 \\sin^2 u$，则 $R_{1212} = K(g_{11}g_{22} - g_{12}g_{21}) = \\frac{1}{R^2}(R^4 \\sin^2 u) = R^2 \\sin^2 u$；$R = 3$ 时即 $9 \\sin^2 u$",
            "Schwarzschild 的弯曲强度：Ricci 张量为零（真空），但 Kretschmann 标量 $R_{abcd}R^{abcd} = \\frac{48M^2}{r^6}$；$M = 1$、$r = 10$ 时约 $4.8 \\times 10^{-5}$，说明远离中心时曲率迅速衰减",
            "贝蒂数与欧拉示性数：球面 $(b_0, b_1, b_2) = (1, 0, 1)$ 给出 $\\chi = 2$；环面 $(1, 2, 1)$ 给出 $\\chi = 0$；双环面 (1, 4, 1) 给出 χ = −2，与 Σ(−1)^k b_k 完全一致"
          ],
          note: "常曲率空间的三个量记住一条链就够了：截面曲率 $K \\to$ Ricci $= (n - 1)Kg \\to$ 标量曲率 $= n(n - 1)K$。标量曲率依赖维数：同样是 $K = 0.25$，$S^2$ 的标量曲率是 $2 \\times 1 \\times 0.25 = 0.5$，$S^3$ 的则是 $3 \\times 2 \\times 0.25 = 1.5$。先写维数 $n$ 再代数，是避免这类失分的最简单办法。"
        },
        {
          type: "code",
          lang: "python",
          title: "用 Python 验证球面测地三角形的盈余与常曲率量",
          code: "import math\n\ndef dot(a, b):\n    return sum(x * y for x, y in zip(a, b))\n\ndef cross(a, b):\n    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])\n\ndef norm(a):\n    return math.sqrt(dot(a, a))\n\ndef sub(a, b):\n    return tuple(x - y for x, y in zip(a, b))\n\ndef scale(c, a):\n    return tuple(c * x for x in a)\n\ndef normalize(a):\n    n = norm(a)\n    return tuple(x / n for x in a)\n\ndef angle_between(a, b):\n    return math.acos(max(-1.0, min(1.0, dot(a, b) / (norm(a) * norm(b)))))\n\ndef interior_angle(P, Q, R):\n    t1 = sub(sub(Q, P), scale(dot(sub(Q, P), P), P))\n    t2 = sub(sub(R, P), scale(dot(sub(R, P), P), P))\n    return angle_between(t1, t2)\n\ndef triangle_excess(A, B, C):\n    a1 = interior_angle(A, B, C)\n    a2 = interior_angle(B, C, A)\n    a3 = interior_angle(C, A, B)\n    det = dot(A, cross(B, C))\n    area = 2 * math.atan2(abs(det), 1 + dot(A, B) + dot(B, C) + dot(C, A))\n    return a1 + a2 + a3 - math.pi, area\n\nA = (1.0, 0.0, 0.0)\nB = (0.0, 1.0, 0.0)\nC = (0.0, 0.0, 1.0)\nex, ar = triangle_excess(A, B, C)\nprint('octant: angles all %.6f, sum-pi = %.6f, area = %.6f' % (interior_angle(A, B, C), ex, ar))\nprint('Gauss-Bonnet check: excess - area = %.2e' % (ex - ar))\n\nP = normalize((1.0, 2.0, 3.0))\nQ = normalize((2.0, -1.0, 1.0))\nRr = normalize((-1.0, 1.0, 2.0))\nex2, ar2 = triangle_excess(P, Q, Rr)\nprint('random triangle: sum-pi = %.6f, area = %.6f, diff = %.2e' % (ex2, ar2, ex2 - ar2))\n\nfor (n, R) in [(2, 3.0), (3, 2.0), (2, 1.0)]:\n    K = 1.0 / (R * R)\n    print('S^%d(R=%.1f): sectional K = %.6f, Ricci = (n-1)K = %.6f, scalar = n(n-1)K = %.6f'\n          % (n, R, K, (n - 1) * K, n * (n - 1) * K))\nprint('H^2: K = -1, scalar = -2 ; H^3: K = -1, scalar = -6 ; flat torus: K = 0, chi = 0')\nprint('Euler characteristic from Betti numbers: sphere 1-0+1 = %d, torus 1-2+1 = %d, genus2 1-4+1 = %d'\n      % (1 - 0 + 1, 1 - 2 + 1, 1 - 4 + 1))\n"
        },
        {
          type: "pitfall",
          title: "常见误区：把曲面论的概念原样搬到流形上",
          items: [
            "把「流形」当成「曲面」的同义词：曲面只是 2 维流形的特例，流形的维数可以任意，而且不依赖任何外围空间。写成「流形就是 R³ 里的曲面」会丢掉这套语言的全部价值。",
            "以为霍奇定理对任何流形都成立：标准形式要求 M 紧致、可定向、无边界；非紧或带边界的情形需要加权 Sobolev 空间或加边界条件的版本，结论形式也要相应修改。",
            "把截面曲率与 Ricci 曲率混为一谈：截面曲率是「一个二维平面」的函数，Ricci 是对截面曲率在某方向求和后的结果；只有常曲率空间才有 $\\mathrm{Ric} = (n - 1)Kg$ 这样简洁的关系。",
            "把常曲率空间的标量曲率当成 K：正确关系是 s = n(n − 1)K。S²(R = 2) 的 K = 0.25 而 s = 0.5；S³(R = 2) 的 K = 0.25 而 s = 1.5，两者差别来自维数。",
            "把 $K \\equiv 0$ 的平坦环面与嵌入 $\\mathbb{R}^3$ 的圆环面混为一谈：圆环面的高斯曲率有正有负，而平坦环面存在内蕴 $K \\equiv 0$ 的度量。平坦环面不能等距嵌入 $\\mathbb{R}^3$——因为紧致嵌入曲面必有一点 $K > 0$，与 $K \\equiv 0$ 矛盾。",
            "把「测地线」与「全局最短曲线」等同：测地线只是能量泛函的临界点，过了第一个共轭点就不再最短（球面上走过半圈的经线就是例子）；全局最短的存在性需要 Hopf-Rinow 那样的完备性条件。"
          ]
        },
        {
          type: "lab",
          title: "动手练习：从曲面到流形的概念迁移",
          steps: [
            "把第二讲的第一基本形式改写成度量张量形式：对球面写出 $g_{ij}$ 的 2×2 矩阵（$g_{11} = 1$、$g_{12} = g_{21} = 0$、$g_{22} = \\sin^2 u$），再算出 $\\sqrt{\\det(g)} = \\sin u$ 与面积元的关系。",
            "对双曲上半平面 $g = \\frac{dx^2 + dy^2}{y^2}$ 算出 $\\sqrt{\\det(g)} = \\frac{1}{y^2}$，并求一条从 $(0, 1)$ 到 $(0, 2)$ 的竖直测地线的长度（答案 $\\ln 2 \\approx 0.6931$），说明为什么在这套度量下竖直直线是测地线。",
            "对 S²(R = 3) 与 S³(R = 2) 分别列出截面曲率、Ricci 与标量曲率，并说明为什么「截面曲率相同」的两个流形在 Ricci 上取值不同。",
            "用 Python 验证：随机取单位球面上的三个点构成测地三角形，用「内角和 − π」与球面多边形面积公式两种方法算面积，结果应当一致（差值应在 10⁻¹² 量级）。",
            "写出霍奇分解 $\\Omega^k = \\mathrm{Im}\\,d \\oplus \\mathrm{Im}\\,\\delta \\oplus H^k$ 中每一项的维数含义，并解释为什么对环面有 $b_0 = 1$、$b_1 = 2$、$b_2 = 1$，从而 $\\chi = 0$。",
            "各举一个应用例子：广义相对论中「自由粒子沿测地线运动」的具体含义；拓扑数据分析中「用持续同调识别点云有几个环」的含义。"
          ],
          note: "这一讲的目标不是把高维流形的计算都做一遍，而是确认一件事：前五讲学到的每一个概念（度量、联络、测地线、曲率、示性数）都能脱离 R³ 独立存在。想清楚这一点，你才算真正进入了现代微分几何。"
        }
      ],
      quiz: [
        {
          id: "dg-modern-q1",
          type: "single",
          q: "设 M 是紧致、可定向、无边界的黎曼流形，关于霍奇理论下列说法正确的是？",
          options: [
            "霍奇定理给出 de Rham 上同调群与调和形式空间的同构，霍奇分解把 $\\Omega^k$ 正交分解为 $\\mathrm{Im}\\,d$、$\\mathrm{Im}\\,\\delta$ 与调和形式三部分",
            "霍奇分解说明每个 k-形式都能写成 dα + δβ 两项之和，调和项总可以吸收进前两项",
            "调和空间 H^k 的维数等于贝蒂数 b_{k+1}",
            "霍奇理论要求流形可缩成一点，否则分解不成立"
          ],
          answer: 0,
          why: "霍奇定理断言每个 de Rham 上同调类中存在唯一的调和代表元，于是 $H^k_{dR}(M)$ 与调和 $k$-形式空间同构，维数就是 $b_k$；霍奇分解进一步给出 $\\Omega^k = \\mathrm{Im}\\,d \\oplus \\mathrm{Im}\\,\\delta \\oplus H^k$ 的正交直和，所以第一项正确。第二项错在丢掉调和项：一般形式的调和部分 γ 不为零，只有当 ω 的上同调类为零时才能省掉它。第三项把指标写错了：调和空间的维数是 b_k，不是 b_{k+1}。第四项与定理的前提矛盾：霍奇定理要求的正是紧致、可定向、无边界，可缩性完全不是条件（球面可缩吗？不可缩，但霍奇定理照样成立）。"
        },
        {
          id: "dg-modern-q2",
          type: "multi",
          q: "关于黎曼流形、曲率张量与截面曲率，下列说法正确的有？",
          options: [
            "黎曼度量是每点切空间上的正定对称双线性型，在坐标下就是矩阵 (g_ij)，它是曲面第一基本形式 E、F、G 的推广",
            "截面曲率只需要一个由两个线性无关切向量张成的二维平面即可定义，二维流形的截面曲率就是高斯曲率",
            "常曲率空间的黎曼曲率张量满足 $R_{ijkl} = K(g_{ik}g_{jl} - g_{il}g_{jk})$，完全由常数 $K$ 与度量决定",
            "常曲率空间的标量曲率就等于该常数 K",
            "Ricci 张量是曲率张量的缩并，在常曲率情形满足 Ric = (n − 1)K g"
          ],
          answer: [0, 1, 2, 4],
          why: "黎曼度量正是第一基本形式的高维版本，坐标分量 g_ij 就是 E、F、G 的推广，第一项正确。截面曲率以切空间中的一个二维平面为自变量，分母是平行四边形面积的平方，因此只依赖平面本身；二维流形切空间里只有一个平面，截面曲率随之就是高斯曲率，第二项正确。常曲率空间是「各方向弯曲程度相同」的最对称情形，其曲率张量由 K 与度量完全决定，第三项正确。Ricci 是曲率张量的缩并，常曲率时 Ric = (n − 1)K g，第五项正确。第四项错在漏掉维数因子：标量曲率是 $s = n(n - 1)K$，例如 $S^2(R = 2)$ 的 $K = 0.25$ 而 $s = 0.5$，两者并不相等。"
        },
        {
          id: "dg-modern-q3",
          type: "fill",
          q: "半径 $R = 2$ 的三维球面 $S^3(R = 2)$ 的截面曲率等于 ____（填小数或分数）",
          answer: ["0.25", "1/4", ".25"],
          why: "常曲率空间的截面曲率处处等于 1/R²，与维数无关：取任意二维平面 σ，用 R_ijkl = K(g_ik g_jl − g_il g_jk) 代入截面曲率定义即可算出 K(σ) = 1/R²。R = 2 时 K = 1/4 = 0.25。要注意与它相关的另外两个量：Ricci 是 (n − 1)K = 2 × 0.25 = 0.5 倍的度量，标量曲率是 n(n − 1)K = 3 × 2 × 0.25 = 1.5，都与截面曲率数值不同，原因是缩并时出现了维数因子。"
        },
        {
          id: "dg-modern-q4",
          type: "order",
          q: "把「从流形出发构造曲率这一套概念」的逻辑顺序排成正确顺序",
          items: [
            "在每点切空间上取正定对称双线性型，得到黎曼度量 (g_ij)",
            "定义光滑流形：局部同胚于 Rⁿ 并带有光滑转移函数的坐标图册",
            "由度量定义 Levi-Civita 联络（协变导数），再由它构造曲率张量 R(X, Y)Z",
            "从曲率张量取出二维平面上的截面曲率，并在常曲率情形得到 Ric = (n − 1)K g",
            "写出测地线方程并用指数映射 exp_p 描述从切空间到流形的映射"
          ],
          answer: [1, 0, 2, 3, 4],
          why: "依赖关系是层层递进的：先要有流形（否则没有切空间可以谈），再在切空间上装度量（否则无法比较长度与角度），度量唯一确定 Levi-Civita 联络（否则无法对向量场求导），联络给出曲率张量，从曲率张量才能定义截面曲率并做缩并，最后才是用联络写出测地线方程与指数映射。把度量放在流形之前是常见错误：没有图册就无法说明「光滑地依赖于点」是什么意思；把测地线放在联络之前也不行，因为测地线方程里的 Christoffel 符号恰恰来自联络。"
        }
      ]
    }
  ]
});
