/* ==========================================================================
   simlab-models-fluid.js —— 连续介质（流体）仿真模型（W5 契约 §13.B.4，2 个）

     · flow            伯努利与连续性
                         支 0「变截面管道」：入口定压 p₁ + 高度差 h 驱动，出口通大气；
                                            收缩段流速升高、压强下降，读数给流量与伯努利常数
                         支 1「托里拆利」  ：v = √(2gh)；液面气压 p₁ ≠ p_atm 时用总水头
                                            H = h + (p₁ − p_atm)/ρg，v₂ = √(2gH)
                         支 2「文丘里」    ：压差 Δp = ½ρ(v₂² − v₁²) 反推流量
                                            Q = A₂√(2Δp/[ρ(1 − (A₂/A₁)²)])
     · boundary-layer  边界层与雷诺数
                         支 0「边界层厚度」：Re_x = Ux/ν、层流 δ = 5x/√Re_x、
                                            湍流对照 δ ≈ 0.37x/Re_x^{1/5}
                         支 1「雷诺数」    ：Re_x 沿板增长、平板转捩判据 Re_cr = 5×10⁵
                         支 2「管流摩阻」  ：圆管层流 f = 64/Re（精确）、转捩 Re ≈ 2300、
                                            湍流 Blasius f = 0.316Re^{−1/4}（光滑管对照）

   ★ 约束（与 simlab.js 顶部一致）：
     · 加载时**只调用 SIM.register**，绝不触碰 DOM —— tools/verify-simlab.mjs 在 Node 里
       用 window 桩直接加载本文件跑 compute() 与 tests 做物理不变量自检；
     · **不调用 Math.random**（全文搜不到 random）：两个模型都是确定性的，同一组参数
       给出同一条曲线，逐位可重复；
     · 纯 ES5：var / 无箭头函数 / 无模板字符串 / 无 import-export；
     · 边界安全：任意滑块取值都不抛异常、不出 NaN/Infinity。
       重点兜底（题目点名要求）：
         flow —— A₂ ≥ A₁（不收缩/扩压）、h = 0、p₁ 很小（驱动压差为负、空化）、v = 0；
         boundary-layer —— U = 0（Re = 0 → δ 的分母为 0）、x → 0、ν 极小（Re 极大）。
       兜底策略统一为"**先判物理条件、再进曲线**"：无稳态解或无水头时取静止解
       （v ≡ 0、Q = 0，压强退化为静水压分布），而不是让公式去开负数或除以 0。

   物理常量（数值照抄 app/constants.js；本文件在 Node 里被单独加载，不能假设
   window.PHYSICS_CONSTANTS 已存在，所以直接写在文件里）：
     g_n   = 9.806 65 m/s²   —— constants.js「标准重力加速度 g_n」条目（2019 SI 定义值）
     p_atm = 101 325 Pa      —— constants.js「标准大气压 atm」条目（精确值）
   模型自定的物性与经验常数（constants.js 里没有，这里写明取值与出处）：
     ρ_水   = 1000 kg/m³     —— 20 °C 实测 998.2 kg/m³，本模型按题目约定取教学整值 1000
     p_vap  = 2339 Pa        —— 水 20 °C 的饱和蒸气压（常用物性表值），只用于空化余量提示
     ρ_空气 = 1.225 kg/m³    —— 15 °C 标准大气下的空气密度，只用于把 c_f 换算成壁面剪应力
     ν 的默认值 1.5×10⁻⁵ m²/s 对应空气（15 °C）；水（20 °C）约 1.004×10⁻⁶ m²/s
   经验系数（平板边界层与圆管摩阻，均为教科书标准值，出处写在各自注释里）：
     δ = 5.0x/√Re_x、δ* = 1.7208x/√Re_x、θ = 0.664x/√Re_x、c_f = 0.664/√Re_x（Blasius 层流解）
     δ_湍 = 0.37x/Re_x^{1/5}（1/5 次方律，Re_x ≳ 5×10⁵ 才适用）
     f_层流 = 64/Re（圆管层流精确解）、f_湍 = 0.316Re^{−1/4}（Blasius 光滑管，4×10³ < Re < 10⁵）
   ========================================================================== */
(function (global) {
  "use strict";
  var SIM = global.SIM;
  if (!SIM) return;   // 在 Node 里若未先加载 simlab.js，安静退出

  var lin = SIM.linspace, fmt = SIM.fmt, opt = SIM.opt;

  /* ------------------------------------------------------------- 物理常量 */
  var G = 9.80665;          // 标准重力加速度 m/s²（constants.js: g_n）
  var P_ATM = 101325;       // 标准大气压 Pa（constants.js: atm）
  var RHO_W = 1000;         // 水的密度 kg/m³（教学整值）
  var P_VAP = 2339;         // 水 20 °C 饱和蒸气压 Pa（空化判据用）
  var RHO_AIR = 1.225;      // 空气密度 kg/m³（15 °C，仅用于 τ_w）

  var RE_CR_PLATE = 5e5;    // 平板边界层转捩临界雷诺数（工程判据）
  var RE_CR_PIPE = 2300;    // 圆管层流→过渡的临界雷诺数
  var RE_TURB_PIPE = 4000;  // 圆管过渡→充分湍流
  var LAM_COEF = 5.0;       // δ = 5.0x/√Re_x
  var DSTAR_COEF = 1.7208;  // δ* = 1.7208x/√Re_x
  var THETA_COEF = 0.664;   // θ = 0.664x/√Re_x
  var CF_COEF = 0.664;      // c_f = 0.664/√Re_x
  var TURB_COEF = 0.37;     // δ_湍 = 0.37x/Re_x^{1/5}
  var BLASIUS_COEF = 0.316; // f_湍 = 0.316Re^{−1/4}

  /* --------------------------------------------------------------- 小工具 */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  /** 参数安全取值：课程 config 不受滑块范围限制，NaN/非数字都换成默认值 */
  function num(v, d) { var x = Number(v); return isFinite(x) ? x : d; }
  /** 有限性兜底：把 ±Infinity/NaN 换成 fallback */
  function fin(v, d) { return isFinite(v) ? v : d; }
  function maxAbs(a) {
    var m = 0, i, x;
    for (i = 0; i < a.length; i++) { x = Math.abs(a[i]); if (isFinite(x) && x > m) m = x; }
    return m;
  }
  function minOf(a) {
    var m = Infinity, i;
    for (i = 0; i < a.length; i++) if (isFinite(a[i]) && a[i] < m) m = a[i];
    return m;
  }
  /** 统计所有曲线里非有限值的个数（自检"不出 NaN/Infinity"用） */
  function badCount(o) {
    var bad = 0, ks = Object.keys(o.series || {}), i, j, a;
    for (i = 0; i < ks.length; i++) {
      a = o.series[ks[i]];
      for (j = 0; j < a.length; j++) if (!isFinite(a[j])) bad++;
    }
    return bad;
  }
  /** 数组中离 target 最近的元素下标 */
  function nearestIndex(xs, target) {
    var best = 0, bd = Infinity, i, d;
    for (i = 0; i < xs.length; i++) {
      d = Math.abs(xs[i] - target);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  /** 有序去重合并（构造"均匀网格 + 精确锚点"的非均匀网格） */
  function mergeSorted(base, extra) {
    var all = base.concat(extra).sort(function (a, b) { return a - b; });
    var out = [], i;
    for (i = 0; i < all.length; i++) {
      if (!isFinite(all[i])) continue;
      if (!out.length || Math.abs(all[i] - out[out.length - 1]) > 1e-12 * Math.max(1, Math.abs(all[i]))) out.push(all[i]);
    }
    return out;
  }

  /* ============================================================ 1. 伯努利与连续性 */
  /**
   * 伯努利（无黏、定常、不可压、沿同一条流线）：
   *     p + ½ρv² + ρgz = B = 常数                                    ……(1)
   * 连续性（不可压、定常、同一流管）：
   *     A₁v₁ = A₂v₂ = Q                                              ……(2)
   *
   * 【支 0 变截面管道 / 支 2 文丘里】截面 1 在高度 h、压强 p₁；出口截面 2 在高度 0、通大气 p_atm。
   *   (1) 写在这两个截面之间：p₁ + ½ρv₁² + ρgh = p_atm + ½ρv₂²，与 (2) 联立（v₁ = v₂A₂/A₁）：
   *       Δp = p₁ + ρgh − p_atm                                       ……(3) 净驱动压差
   *       v₂ = √( 2Δp / [ρ(1 − (A₂/A₁)²)] )                            ……(4)
   *       Q  = A₂v₂ = A₁v₁                                             ……(5)
   *   (4) 只在 **A₂ < A₁（收缩）且 Δp > 0** 时有正的实数解：
   *     · A₂ ≥ A₁（等截面/扩压）：连续性要求 v₂ ≤ v₁，而 (1) 要求压强沿流向下降，
   *       两者与"入口定压、出口通大气"的边界条件矛盾 —— 无黏定常解不存在；
   *     · Δp ≤ 0：压差推不动流体正向流动。
   *   两种情况下模型取**静止解**（v ≡ 0、Q = 0，压强退化为静水压 p₁ + ρg(z₁ − z)），
   *   并在读数里说明原因 —— 绝不返回 NaN/复数。
   *   沿流道第 i 站（A_i、z_i 由几何给出）：
   *       v_i = Q/A_i                                                  ……(6)
   *       p_i = p₁ + ½ρ(v_ref² − v_i²) + ρg(z_ref − z_i)               ……(7)
   *   支 0/2 取参考截面 (v_ref, z_ref) = (v₁, h)；代入 (4)(5) 可验证 p(出口) = p_atm。
   *
   * 【支 1 托里拆利】自由液面（截面 1：面积 A₁、气压 p₁、高度 h）→ 孔口（截面 2：面积 A₂、高度 0）。
   *   液面缓慢下降（A₁ ≫ A₂），把 (1) 用在"液面驻点 → 孔口"这条流线上：
   *       p₁ + ρgh = p_atm + ½ρv₂²   ⇒   v₂ = √(2gH),
   *       H = h + (p₁ − p_atm)/(ρg)                                    ……(8) 总水头（m）
   *   p₁ = p_atm 时 (8) 就是托里拆利定律 v = √(2gh)。
   *   罐内流线的速度剖面取幂律（横轴 s = 液面下深度，u = s/h）：
   *       v(s) = v₂·u⁴ = v₂·(s/h)⁴                                       ……(9)
   *   它满足四个端点条件（与 (7) 的参考量 v_ref = 0、z_ref = h 配合，全部精确成立）：
   *       v(0) = 0（液面是驻点）    p(0) = p₁        （液面压强就是给定的 p₁）
   *       v(h) = v₂ = √(2gH)        p(h) = p₁ + ρgh − ½ρv₂² = p_atm
   *   指数 4 只决定**中间剖面的形状**（孔口附近才明显加速，符合罐内汇流的图像；
   *   严格的理想汇流是 v ∝ 1/r²，在孔口发散，这里用单调幂律代替），四个端点值与
   *   伯努利常数 B 都与指数无关，所以取值不影响任何自检。沿程压强由 (7) 给出：
   *   p 先随深度静水上升（ρgs 项），快到孔口时被 ½ρv² 拉下来 —— 最后落到 p_atm。
   *   由连续性反推的流管面积 A(s) = Q/v(s) 在液面处发散（流体从整个罐体汇入孔口），
   *   这与"液面缓慢下降、A₁ ≫ A₂"的图像一致。
   *
   * 【空化】液体里压强降到饱和蒸气压 p_vap 以下就会汽化（空化）。读数给出沿流道的
   *   最低压强与空化余量 p_min − p_vap，并标出是否已经"汽化"。
   */
  var FLOW_KINDS = ["变截面管道", "托里拆利", "文丘里"];

  /** ① 连续性：逐站 |A_i v_i − Q| 的最大相对偏差（Q = 0 的静止解退化为"速度全为 0"检查） */
  function relDriftAV(o) {
    var m = o.metrics, i, x, d = 0;
    var ref = Math.abs(m.A[0] * o.series.v[0]);
    if (!(ref > 0)) return maxAbs(o.series.v);
    for (i = 0; i < o.series.v.length; i++) {
      x = Math.abs(m.A[i] * o.series.v[i] - ref) / ref;
      if (x > d) d = x;
    }
    return d;
  }
  /** ② 伯努利：逐站 |B_i − B_0|/|B_0|，B = p + ½ρv² + ρgz（图上的 p 是表压 kPa，这里还原成绝对压强） */
  function relDriftB(o) {
    var m = o.metrics, i, x, d = 0, B0 = 0, B;
    for (i = 0; i < o.series.v.length; i++) {
      B = o.series.p[i] * 1000 + P_ATM + 0.5 * RHO_W * o.series.v[i] * o.series.v[i] + RHO_W * G * m.z[i];
      if (i === 0) B0 = B;
      x = Math.abs(B - B0) / Math.abs(B0);
      if (x > d) d = x;
    }
    return d;
  }
  /** 流道末端的速度（托里拆利支＝孔口速度 √(2gH)；支 0/2＝出口速度 v₂） */
  function exitV(o) { var v = o.series.v; return v[v.length - 1]; }
  /** 沿流道的最低绝对压强（空化判据的分子） */
  function minP(o) { return minOf(o.metrics.pAbs); }
  /** ④ 文丘里压差：|Δp − ½ρ(v₂² − v₁²) − ρg(z₂ − z₁)|（由 (1) 直接推出的一般式，水平管时末项为 0） */
  function venturiDP(o) {
    var m = o.metrics, i = m.i2, j = m.i1;
    var dP = (o.series.p[j] - o.series.p[i]) * 1000;                 // 表压差 = 绝对压差
    var dyn = 0.5 * RHO_W * (o.series.v[i] * o.series.v[i] - o.series.v[j] * o.series.v[j]);
    return Math.abs(dP - dyn - RHO_W * G * (m.z[i] - m.z[j]));
  }
  /** 静止解自检：曲线非有限值个数 + 最大速度（都应为 0） */
  function staticResidual(o) { return badCount(o) + maxAbs(o.series.v); }
  /** 有限性自检：曲线非有限值个数 */
  function finiteResidual(o) { return badCount(o); }

  function flowCompute(p) {
    var ki = clamp(Math.round(num(p.kind, 0)), 0, FLOW_KINDS.length - 1);
    var name = opt(FLOW_KINDS, ki);
    var A1 = clamp(num(p.A1, 0.01), 1e-9, 1e9);          // m²
    var A2 = clamp(num(p.A2, 0.005), 1e-9, 1e9);         // m²
    var h = clamp(num(p.h, 1), 0, 1e6);                  // m
    var p1 = clamp(num(p.p1, 100), 0, 1e9) * 1000;       // kPa → Pa

    var N = 241, i, u, s = [], A = [], z = [];
    var L, u0, u1, why = "";

    /* ---- 1) 几何：沿流道的横截面积 A(s) 与高度 z(s) ---- */
    if (ki === 1) {
      // 托里拆利：横轴 s 就是液面下深度（0 → h）
      L = h;
      for (i = 0; i < N; i++) {
        u = i / (N - 1);
        s.push(L * u);
        A.push(A1 + (A2 - A1) * u);       // 线性收缩流管：液面 A₁ → 孔口 A₂
        z.push(h - L * u);                // 液面 z = h → 孔口 z = 0
      }
      u0 = 0; u1 = 1;
    } else {
      L = (ki === 0) ? 2 : 0.6;           // 管长：变截面管道 2 m，文丘里测量段 0.6 m
      u0 = (ki === 0) ? 0.35 : 0.15;      // 收缩段起点（占管长比例）
      u1 = (ki === 0) ? 0.65 : 0.55;      // 收缩段终点（之后保持 A₂ 直到出口）
      for (i = 0; i < N; i++) {
        u = i / (N - 1);
        s.push(L * u);
        A.push(u <= u0 ? A1 : (u >= u1 ? A2 : A1 + (A2 - A1) * (u - u0) / (u1 - u0)));
        z.push(h * (1 - u));              // 入口 z = h → 出口 z = 0
      }
    }

    /* ---- 2) 流量：连续性 + 伯努利 ---- */
    var v1 = 0, v2 = 0, Q = 0, head = 0, dpDrive = 0, vref = 0, ok = true;
    if (ki === 1) {
      head = h + (p1 - P_ATM) / (RHO_W * G);          // (8) 总水头
      if (head > 0) {
        v2 = Math.sqrt(2 * G * head);                 // v = √(2gH)
        v1 = v2 * A2 / A1;                            // 液面下降速度（由连续性 A₁v₁ = A₂v₂）
        Q = A1 * v1;
      } else {
        ok = false;
        why = "总水头 H = h + (p₁ − p_atm)/ρg ≤ 0：没有可用水头，液体流不出来（取 v = 0、Q = 0）";
      }
      vref = 0;                                       // 参考点是液面驻点
    } else {
      dpDrive = p1 + RHO_W * G * h - P_ATM;           // (3)
      if (!(A2 < A1 * (1 - 1e-12))) {
        ok = false;
        why = "A₂ ≥ A₁（等截面或扩压）：连续性要求 v₂ ≤ v₁，而伯努利要求压强沿流向下降，" +
          "与「入口定压 p₁ + 出口通大气」矛盾 —— 无黏定常解不存在，取静止（v = 0、Q = 0）";
      } else if (!(dpDrive > 0)) {
        ok = false;
        why = "驱动压差 p₁ + ρgh − p_atm ≤ 0：压差推不动流体正向流动，取静止（v = 0、Q = 0）。" +
          "把 h 调大或把 p₁ 调到 101.325 kPa 以上即可恢复流动";
      } else {
        v2 = Math.sqrt(2 * dpDrive / (RHO_W * (1 - (A2 / A1) * (A2 / A1))));   // (4)
        v1 = v2 * A2 / A1;                            // (5)
        Q = A1 * v1;
      }
      vref = v1;
    }

    /* ---- 3) 沿流道逐站：速度 (6) 与压强 (7) ---- */
    var v = [], pa = [], pg = [], vv, pp;
    for (i = 0; i < N; i++) {
      vv = Q / A[i];                                  // A[i] ≥ 1e-9 > 0，不会除零
      pp = p1 + 0.5 * RHO_W * (vref * vref - vv * vv) + RHO_W * G * (h - z[i]);   // (7)
      v.push(vv);
      pa.push(pp);                                    // 绝对压强 Pa（自检与读数用）
      pg.push((pp - P_ATM) / 1000);                    // 表压 kPa（画图用：量级才和 m/s 可比）
    }

    var i2 = (ki === 1) ? (N - 1) : Math.min(N - 1, Math.round(u1 * (N - 1)));
    var p2 = pa[i2], B = p1 + 0.5 * RHO_W * vref * vref + RHO_W * G * h;
    var pMin = minOf(pa), cav = (pMin < P_VAP);

    /* ---- 4) 读数 ---- */
    var info = [
      { k: "视图", v: name },
      { k: "流量 Q = A₁v₁ = A₂v₂", v: fmt(Q, 6) + " m³/s" },
      { k: "截面 1 速度 v₁（入口/液面）", v: fmt(v1, 4) + " m/s" },
      { k: "截面 2 速度 v₂（喉部/孔口/出口）", v: fmt(v2, 4) + " m/s" },
      { k: "速度比 v₂/v₁ = A₁/A₂", v: (v1 > 0 ? fmt(v2 / v1, 4) : "—（静止）") },
      { k: "截面 1 压强 p₁（给定）", v: fmt(p1 / 1000, 4) + " kPa" },
      { k: "截面 2 压强 p₂（算出）", v: fmt(p2 / 1000, 4) + " kPa" },
      { k: "压差 Δp = p₁ − p₂", v: fmt((p1 - p2) / 1000, 4) + " kPa" },
      { k: "伯努利常数 B = p + ½ρv² + ρgz", v: fmt(B / 1000, 4) + " kPa（沿整条流线恒定）" },
      { k: "总水头 H = B/(ρg)", v: fmt(B / (RHO_W * G), 4) + " m" },
      { k: "沿流道最低压强 p_min（空化判据）",
        v: fmt(pMin / 1000, 4) + " kPa，" + (cav
          ? "⚠ 已低于水 20 °C 的饱和蒸气压 " + fmt(P_VAP / 1000, 3) + " kPa —— 会发生空化"
          : "高于饱和蒸气压 " + fmt(P_VAP / 1000, 3) + " kPa，无空化") },
      { k: "说明", v: why || (ki === 1
        ? "理想无黏：沿流线的压强在运动段恒等于大气压（动能全部来自重力势能）"
        : "收缩处流速升高、压强下降（伯努利），扩张则相反") }
    ];

    return {
      t: s,
      series: { v: v, p: pg },
      info: info,
      bars: [
        { label: "压强水头 p₂/ρg", value: p2 / (RHO_W * G), color: "#5aa9ff", unit: "m" },
        { label: "速度水头 v₂²/2g", value: v2 * v2 / (2 * G), color: "#ffb84d", unit: "m" },
        { label: "位置水头 z₂", value: z[i2], color: "#63d6a5", unit: "m" }
      ],
      metrics: {
        s: s, A: A, z: z, vAbs: v, pAbs: pa, pGauge: pg,
        A1: A1, A2: A2, h: h, p1: p1, kind: ki, name: name, ok: ok, why: why,
        Q: Q, v1: v1, v2: v2, p2: p2, B: B, head: head, dpDrive: dpDrive,
        pMin: pMin, cav: cav, i1: 0, i2: i2, N: N
      }
    };
  }

  SIM.register("flow", {
    title: "伯努利与连续性",
    legend: "伯努利 p + ½ρv² + ρgz = 常数，连续性 A₁v₁ = A₂v₂。管道收缩处流速升高、压强下降" +
      "（文丘里流量计就靠这个压差读流量）；托里拆利支给出孔口出流 v = √(2gh)。" +
      "为了把 m/s 的速度和 kPa 的压强画在同一根纵轴上，图上的 p 用**表压** p − p_atm。",
    axes: { xlabel: "沿流道位置 s (m)（管道轴向 / 液面下深度）", ylabel: "速度 v (m/s)　　静压 p（表压，kPa）" },
    params: {
      kind: { label: "视图", type: "enum", options: FLOW_KINDS, def: 0 },
      A1: { label: "截面 1 面积 A₁", unit: "m²", def: 0.01, min: 0.001, max: 0.1, step: 0.001 },
      A2: { label: "截面 2 面积 A₂（喉部/孔口）", unit: "m²", def: 0.005, min: 0.001, max: 0.1, step: 0.001 },
      h: { label: "高度差 h（入口高于出口）", unit: "m", def: 1, min: 0, max: 10, step: 0.05 },
      p1: { label: "截面 1 压强 p₁（绝对压强）", unit: "kPa", def: 100, min: 10, max: 500, step: 1 }
    },
    plots: [
      { key: "v", label: "速度 v (m/s)", color: "#5aa9ff" },
      { key: "p", label: "静压 p（表压 kPa）", color: "#ff7b7b" }
    ],
    compute: flowCompute,
    tests: [
      // ① 连续性 A₁v₁ = A₂v₂：沿流道 241 站核对 A(s)v(s) = Q（相对漂移 < 1e-9）
      { name: "连续性 A₁v₁ = A₂v₂ = Q（变截面管道，沿流道 241 站相对漂移 < 1e-9）",
        params: { kind: 0, A1: 0.01, A2: 0.005, h: 1, p1: 100 },
        measure: function (o) { return relDriftAV(o); }, expect: 0, tol: 1e-9 },
      // ①b 托里拆利支：A₁v₁ = A₂v₂（v₂ 从曲线末端现算，v₁ 是液面下降速度）
      { name: "托里拆利支连续性 A₁v₁ = A₂v₂（A₁ = 0.1 m²、A₂ = 0.001 m²，相对偏差 < 1e-9）",
        params: { kind: 1, A1: 0.1, A2: 0.001, h: 1, p1: 101.325 },
        measure: function (o) {
          var m = o.metrics, v2 = exitV(o);
          return Math.abs(m.A1 * m.v1 - m.A2 * v2) / (m.Q > 0 ? m.Q : 1);
        }, expect: 0, tol: 1e-9 },
      // ② 伯努利 p + ½ρv² + ρgz = B 沿流线恒定（入口 h=1 m 到出口，相对漂移 < 1e-9）
      { name: "伯努利恒等式 p + ½ρv² + ρgz = B（变截面管道，h = 1 m，相对漂移 < 1e-9）",
        params: { kind: 0, A1: 0.01, A2: 0.005, h: 1, p1: 100 },
        measure: function (o) { return relDriftB(o); }, expect: 0, tol: 1e-9 },
      // ②b 托里拆利支同样满足伯努利，且要跨过"静止层（v=0，压强静水上升）+ 自由下落段"两段：
      //    p₁ = 100 kPa < p_atm ⇒ s₀ = (p_atm − p₁)/(ρg) = 0.1351 m > 0，正是含静止层的情形
      { name: "伯努利恒等式（托里拆利支，跨静止层与自由下落段，相对漂移 < 1e-9）",
        params: { kind: 1, A1: 0.01, A2: 0.005, h: 1, p1: 100 },
        measure: function (o) { return relDriftB(o); }, expect: 0, tol: 1e-9 },
      // ③ 托里拆利 v = √(2gh)：h = 1 m → 契约 §13.B.4 写作 4.4272 m/s
      //    该数字是 g = 9.8 时的 √(2×9.8×1) = 4.427188724 的四舍五入（5 位有效数字），
      //    所以容差只能取到契约值本身的量级（1.5e-3）；与 g = 9.80665 的精确值差 1.5e-3。
      { name: "托里拆利 v = √(2gh)：h = 1 m → 4.4272 m/s（契约值，对应 g = 9.8，容差 1.5e-3）",
        params: { kind: 1, A1: 0.1, A2: 0.001, h: 1, p1: 101.325 },
        measure: function (o) { return exitV(o); }, expect: 4.4272, tol: 1.5e-3 },
      // ③b 同一式子的精确值（本模型取 g = 9.80665）：√(2×9.80665×1) = 4.428690551393
      { name: "托里拆利精确值 v = √(2gh) = √(2×9.80665×1) = 4.428691 m/s（容差 1e-6）",
        params: { kind: 1, A1: 0.1, A2: 0.001, h: 1, p1: 101.325 },
        measure: function (o) { return exitV(o); }, expect: 4.428690551393, tol: 1e-6 },
      // ③c v ∝ √h：h = 4 m → √(2×9.80665×4) = 8.857381102787 m/s（4 倍水头给出 2 倍速度）
      { name: "托里拆利 v ∝ √h：h = 4 m → √(2gh) = 8.857381 m/s（容差 1e-6）",
        params: { kind: 1, A1: 0.1, A2: 0.001, h: 4, p1: 101.325 },
        measure: function (o) { return exitV(o); }, expect: 8.857381102787, tol: 1e-6 },
      // ③d 孔口压强必须落回大气压：p(h) = p₁ + ρgh − ½ρv₂² = p_atm = 101 325 Pa
      //    （它同时检验了 (7) 与 (8) 的自洽性；p₁ = p_atm 时 H = h，v₂ = √(2gh)）
      //    注意：这里必须读**孔口**压强 p₂，不能读沿流线的最小压强 ——
      //    后者在 A₁/A₂ = 100 的急缩流道里比 p_atm 低约 1 Pa（速度沿程分布造成），
      //    曾经误用 minP(o) 使这条自检恒失败。
      { name: "托里拆利孔口压强 p₂ = p_atm = 101 325 Pa（与 v₂ = √(2gH) 自洽，容差 1e-6）",
        params: { kind: 1, A1: 0.1, A2: 0.001, h: 1, p1: 101.325 },
        measure: function (o) { return o.metrics.p2; }, expect: 101325, tol: 1e-6 },
      // ④ 文丘里压差 Δp = ½ρ(v₂² − v₁²)：水平管（h = 0 m）时 z₂ = z₁，契约的简化式严格成立
      { name: "文丘里压差 Δp = ½ρ(v₂² − v₁²)（水平管 h = 0，p₁ = 200 kPa，容差 1e-9）",
        params: { kind: 2, A1: 0.01, A2: 0.005, h: 0, p1: 200 },
        measure: function (o) { return venturiDP(o); }, expect: 0, tol: 1e-9 },
      // ④b 倾斜管的一般式：p₁ − p₂ = ½ρ(v₂² − v₁²) + ρg(z₂ − z₁)（喉部比入口低 h = 1 m）
      { name: "倾斜文丘里 Δp = ½ρ(v₂² − v₁²) + ρg(z₂ − z₁)（h = 1 m，容差 1e-9）",
        params: { kind: 2, A1: 0.01, A2: 0.005, h: 1, p1: 200 },
        measure: function (o) { return venturiDP(o); }, expect: 0, tol: 1e-9 },
      // ⑤ 出口压强 = 大气压（支 0：入口 h=1 m、p₁=100 kPa，出口 z=0；由 (4)(7) 精确给出）
      { name: "变截面管道出口压强 = p_atm = 101 325 Pa（解析，容差 1e-6）",
        params: { kind: 0, A1: 0.01, A2: 0.005, h: 1, p1: 100 },
        measure: function (o) { var a = o.metrics.pAbs; return a[a.length - 1]; },
        expect: 101325, tol: 1e-6 },
      // ⑥ 边界安全：A₂ > A₁（扩压）没有无黏定常解 → 取静止解：v ≡ 0、Q = 0，且不出 NaN
      { name: "边界安全：A₂ > A₁（扩压）时无稳态解 → v ≡ 0、无 NaN/Infinity",
        params: { kind: 0, A1: 0.005, A2: 0.01, h: 1, p1: 100 },
        measure: function (o) { return staticResidual(o); }, expect: 0, tol: 0 },
      // ⑥b 边界安全：h = 0 且 p₁ = 10 kPa（驱动压差 −91.3 kPa < 0）→ 静止解，无 NaN
      { name: "边界安全：h = 0、p₁ = 10 kPa（驱动压差为负）→ v ≡ 0、无 NaN/Infinity",
        params: { kind: 0, A1: 0.01, A2: 0.005, h: 0, p1: 10 },
        measure: function (o) { return staticResidual(o); }, expect: 0, tol: 0 },
      // ⑥c 边界安全：托里拆利 h = 0 且 p₁ = 10 kPa（H = −9.3 m < 0）→ 静止解，无 NaN
      { name: "边界安全：托里拆利 H < 0（h = 5 m、p₁ = 10 kPa）→ v ≡ 0、无 NaN/Infinity",
        params: { kind: 1, A1: 0.01, A2: 0.005, h: 5, p1: 10 },
        measure: function (o) { return staticResidual(o); }, expect: 0, tol: 0 },
      // ⑥d 边界安全：滑块极值组合（A₁ = 0.1、A₂ = 0.001、h = 10 m、p₁ = 500 kPa）曲线全有限
      { name: "边界安全：滑块极值组合（A₁=0.1、A₂=0.001、h=10、p₁=500 kPa）曲线全有限",
        params: { kind: 2, A1: 0.1, A2: 0.001, h: 10, p1: 500 },
        measure: function (o) { return finiteResidual(o); }, expect: 0, tol: 0 }
    ]
  });

  /* ==================================================== 2. 边界层与雷诺数 */
  /**
   * 平板绕流（不可压、定常、零压强梯度）：
   *     Re_x = Ux/ν                                                  ……(9)
   *   层流（Blasius 解，Re_x < 5×10⁵）：
   *     δ(x)  = 5.0 x/√Re_x              （δ₉₉，即 u = 0.99U 处）      ……(10)
   *     δ*(x) = 1.7208 x/√Re_x           （位移厚度）
   *     θ(x)  = 0.664 x/√Re_x            （动量损失厚度）
   *     c_f   = 0.664/√Re_x              （局部摩阻系数），τ_w = c_f·½ρU²
   *   (10) 的直接推论：δ ∝ √x（x 变 100 倍，δ 变 10 倍），且 δ/√(νx/U) 与 Re 无关。
   *   湍流（1/5 次方律，只对 Re_x ≳ 5×10⁵ 有效）：
   *     δ_湍(x) ≈ 0.37 x/Re_x^{1/5}                                   ……(11)
   *   转捩判据（工程常用）：Re_x < 5×10⁵ 视为层流，超过即转捩 → 转捩位置
   *     x_cr = Re_cr·ν/U = 5×10⁵ ν/U                                  ……(12)
   *
   * 圆管流动（达西摩阻系数 f，水头损失 h_f = f(L/d)U²/2g）：
   *     层流（Re_d < 2300，Hagen–Poiseuille 精确解）：f = 64/Re_d        ……(13)
   *     过渡（2300 ≤ Re_d < 4000）：没有可靠解析式，模型用 lg–lg 线性桥接，仅作示意
   *     湍流（Re_d ≥ 4000，光滑管 Blasius）：f = 0.316 Re_d^{−1/4}       ……(14)
   *   注意 (14) 是**光滑管**经验式，适用范围 4×10³ < Re_d < 10⁵；粗糙管要用 Moody 图。
   *   管流的 Re_d 用**管径 d** 作特征长度（本模型在"管流摩阻"支里把参数 x 当作管径 d 用）。
   */
  var BL_KINDS = ["边界层厚度", "雷诺数", "管流摩阻"];

  /** 圆管达西摩阻系数：层流精确解 64/Re、湍流 Blasius、过渡区 lg–lg 桥接 */
  function pipeF(Re) {
    if (!(Re > 0)) return 0;
    if (Re < RE_CR_PIPE) return 64 / Re;                                     // (13)
    if (Re >= RE_TURB_PIPE) return BLASIUS_COEF * Math.pow(Re, -0.25);       // (14)
    var a = Math.log10(RE_CR_PIPE), b = Math.log10(RE_TURB_PIPE);
    var fa = Math.log10(64 / RE_CR_PIPE), fb = Math.log10(BLASIUS_COEF * Math.pow(RE_TURB_PIPE, -0.25));
    var w = (Math.log10(Re) - a) / (b - a);
    return Math.pow(10, fa + (fb - fa) * w);
  }
  /** 从曲线现算：层流支上 max|f·Re − 64|（(13) 的逐点残差，Re < 2300 的网格点） */
  function lamFResidual(o) {
    var d = 0, i, re, x;
    for (i = 0; i < o.t.length; i++) {
      re = Math.pow(10, o.t[i]);
      if (!(re < RE_CR_PIPE)) continue;
      x = Math.abs(Math.pow(10, o.series.lgf[i]) * re - 64);
      if (x > d) d = x;
    }
    return d;
  }
  /** 从曲线现算：max_i |δ_i·√(Ux_i/ν)/(5x_i) − 1|（(10) 的逐点相对偏差） */
  function deltaRelResidual(o, U, nu) {
    var d = 0, i, x, re, dev;
    for (i = 0; i < o.t.length; i++) {
      x = o.t[i];
      if (!(x > 0)) continue;
      re = U * x / nu;
      if (!(re > 0)) continue;
      dev = Math.abs(o.series.delta[i] * Math.sqrt(re) / (LAM_COEF * x) - 1);
      if (dev > d) d = dev;
    }
    return d;
  }

  function blCompute(p) {
    var ki = clamp(Math.round(num(p.kind, 0)), 0, BL_KINDS.length - 1);
    var name = opt(BL_KINDS, ki);
    var U = Math.abs(num(p.U, 1));                        // 来流速度 m/s（取绝对值，U = 0 单独兜底）
    var x = Math.max(0, num(p.x, 0.5));                   // 特征长度 m（平板：距前缘；圆管：直径 d）
    var nu = Math.max(1e-15, Math.abs(num(p.nu, 1.5e-5))); // 运动黏度 m²/s（下限挡住 ν = 0）
    var noFlow = !(U > 0) || !(x > 0);                    // 无流动/无长度：Re = 0

    var Re = U * x / nu;                                  // (9) Re_x（或管流 Re_d）
    if (!(Re > 0)) Re = 0;
    var sq = Re > 0 ? Math.sqrt(Re) : 0;
    var delta = Re > 0 ? LAM_COEF * x / sq : 0;           // (10)
    var dstar = Re > 0 ? DSTAR_COEF * x / sq : 0;
    var theta = Re > 0 ? THETA_COEF * x / sq : 0;
    var cf = Re > 0 ? CF_COEF / sq : 0;
    var tau = cf * 0.5 * RHO_AIR * U * U;                 // τ_w = c_f·½ρU²（取空气密度 1.225）
    var deltaTurb = Re > 0 ? TURB_COEF * x / Math.pow(Re, 0.2) : 0;   // (11)
    var xCr = noFlow ? 0 : RE_CR_PLATE * nu / U;          // (12)
    var fCur = pipeF(Re > 0 ? Re : 1e-12);
    var uTau = (Re > 0 && fCur > 0) ? U * Math.sqrt(fCur / 8) : 0;    // 摩阻速度 u_τ = U√(f/8)
    var dVisc = uTau > 0 ? 11.6 * nu / uTau : 0;          // 黏性底层厚度 δ_v ≈ 11.6ν/u_τ

    var regime, regimeCode;
    if (ki === 2) {
      if (noFlow) { regime = "无流动（Re = 0）"; regimeCode = -1; }
      else if (Re < RE_CR_PIPE) { regime = "层流（Re_d < 2300）"; regimeCode = 0; }
      else if (Re < RE_TURB_PIPE) { regime = "过渡区（2300 ≤ Re_d < 4000，无可靠解析式）"; regimeCode = 1; }
      else { regime = "湍流（Re_d ≥ 4000，光滑管）"; regimeCode = 2; }
    } else {
      if (noFlow) { regime = "无流动（U = 0 或 x = 0）"; regimeCode = -1; }
      else if (Re < RE_CR_PLATE) { regime = "层流（Re_x < 5×10⁵）"; regimeCode = 0; }
      else { regime = "转捩/湍流（Re_x ≥ 5×10⁵）"; regimeCode = 1; }
    }

    var N = 201, i, x0 = x > 0 ? x / 100 : 0, xs, series = {}, t;
    var base = [
      { k: "视图", v: name },
      { k: "雷诺数 Re_x = Ux/ν（管流用 Re_d = Ud/ν）", v: fmt(Re, 6) },
      { k: "流态判据", v: regime }
    ];

    if (ki === 0) {
      /* 层流边界层厚度 δ(x)：横轴 x（从 x/100 到 x，跨两个数量级才看得出 δ ∝ √x 的凹形） */
      xs = lin(x0, x, N);
      var dArr = [], dtArr = [], ri;
      for (i = 0; i < N; i++) {
        ri = U * xs[i] / nu;
        if (!(ri > 0)) { dArr.push(0); dtArr.push(0); continue; }
        dArr.push(LAM_COEF * xs[i] / Math.sqrt(ri));
        dtArr.push(TURB_COEF * xs[i] / Math.pow(ri, 0.2));
      }
      t = xs;
      series.delta = dArr;
      series.deltaTurb = dtArr;
      base.push({ k: "层流边界层厚度 δ(x) = 5x/√Re_x", v: fmt(delta * 1000, 4) + " mm" });
      base.push({ k: "湍流对照 δ ≈ 0.37x/Re_x^{1/5}", v: fmt(deltaTurb * 1000, 4) + " mm（只对 Re_x ≳ 5×10⁵ 有效）" });
      base.push({ k: "位移厚度 δ* = 1.7208x/√Re_x", v: fmt(dstar * 1000, 4) + " mm" });
      base.push({ k: "动量损失厚度 θ = 0.664x/√Re_x", v: fmt(theta * 1000, 4) + " mm" });
      base.push({ k: "局部摩阻系数 c_f = 0.664/√Re_x", v: fmt(cf, 6) });
      base.push({ k: "壁面剪应力 τ_w = c_f·½ρU²（ρ = 1.225 kg/m³）", v: fmt(tau, 6) + " Pa" });
      base.push({ k: "平板转捩位置 x_cr = 5×10⁵ν/U", v: fmt(xCr, 4) + " m" +
        (noFlow ? "（无流动）" : (x < xCr ? "（当前 x 还在层流段）" : "（当前 x 已在转捩之后）")) });
    } else if (ki === 1) {
      /* 雷诺数沿板增长：横轴 x，纵轴 lg Re_x —— Re ∝ x 在 lg 坐标下是一条直线，
         与 lg(5×10⁵) = 5.698970 的水平线相交处就是转捩位置 */
      xs = lin(x0, x, N);
      var lgArr = [], critArr = [], lgCrit = Math.log10(RE_CR_PLATE), rj;
      for (i = 0; i < N; i++) {
        rj = U * xs[i] / nu;
        lgArr.push(Math.log10(rj > 1e-300 ? rj : 1e-300));   // 下限 1e-300：U = 0 时也不会是 −Infinity
        critArr.push(lgCrit);
      }
      t = xs;
      series.lgRe = lgArr;
      series.lgReCrit = critArr;
      base.push({ k: "临界雷诺数 Re_cr（平板转捩）", v: fmt(RE_CR_PLATE, 0) });
      base.push({ k: "转捩位置 x_cr = Re_cr·ν/U", v: fmt(xCr, 4) + " m" });
      base.push({ k: "当前 x 处的边界层厚度 δ（层流式）", v: fmt(delta * 1000, 4) + " mm" });
      base.push({ k: "当前 x 距转捩点", v: noFlow ? "—" : fmt(Math.abs(x - xCr), 4) + " m" });
      base.push({ k: "判据", v: "Re_x < 5×10⁵ → 层流；超过即转捩为湍流" });
    } else {
      /* 圆管摩阻：横轴 lg Re_d，纵轴 lg f —— 层流支是斜率 −1 的直线，
         湍流支是斜率 −1/4 的直线，两者之间（2300 ~ 4000）是过渡区的桥接段 */
      var grid = mergeSorted(lin(2, 7, 401),
        [Math.log10(RE_CR_PIPE), Math.log10(RE_TURB_PIPE)]);
      var lgfArr = [], lgfLamArr = [], rg, fg;
      for (i = 0; i < grid.length; i++) {
        rg = Math.pow(10, grid[i]);
        fg = pipeF(rg);
        lgfArr.push(Math.log10(fg));
        lgfLamArr.push(Math.log10(64 / rg));                 // 层流律延伸到全范围（虚线对照）
      }
      t = grid;
      series.lgf = lgfArr;
      series.lgfLam = lgfLamArr;
      if (!noFlow && Math.log10(Re) >= 2 && Math.log10(Re) <= 7) {
        var cArr = [];
        for (i = 0; i < grid.length; i++) cArr.push(Math.log10(fCur));   // 当前工况的水平参考线
        series.lgfCur = cArr;
      }
      base.push({ k: "当前摩阻系数 f（Re_d = " + fmt(Re, 4) + "）", v: fmt(fCur, 6) });
      base.push({ k: "层流律对照 f = 64/Re_d", v: fmt(64 / (Re > 0 ? Re : 1e-12), 6) +
        (Re > 0 && Re < RE_CR_PIPE ? "（当前适用，精确解）" : "（已越出层流范围，仅作外推对照）") });
      base.push({ k: "Blasius 湍流对照 f = 0.316Re_d^{−1/4}", v: fmt(BLASIUS_COEF * Math.pow(Re > 0 ? Re : 1e-12, -0.25), 6) +
        "（光滑管，4×10³ < Re_d < 10⁵）" });
      base.push({ k: "摩阻速度 u_τ = U√(f/8)", v: fmt(uTau, 6) + " m/s" });
      base.push({ k: "黏性底层厚度 δ_v ≈ 11.6ν/u_τ", v: fmt(dVisc * 1000, 5) + " mm" });
      base.push({ k: "单位管长水头损失 i = f·U²/(2gd)", v: fmt(fCur * U * U / (2 * G * (x > 0 ? x : 1e-12)), 6) + " m/m" });
      base.push({ k: "单位管长压降 Δp/L = f·ρU²/(2d)", v: fmt(fCur * RHO_W * U * U / (2 * (x > 0 ? x : 1e-12)) / 1000, 6) + " kPa/m" });
    }
    if (ki !== 2 && !noFlow && delta > x) {
      base.push({ k: "⚠ 适用范围", v: "δ > x：边界层厚度已可与板长相比，薄边界层（Blasius）近似失效" });
    }
    if (noFlow) base.push({ k: "⚠ 边界条件", v: "U = 0 或 x = 0：雷诺数为 0，一切黏性量取 0（不会出现除零）" });

    var bars = [];
    if (ki === 0) {
      bars = [
        { label: "层流 δ", value: delta * 1000, color: "#5aa9ff", unit: "mm" },
        { label: "湍流 δ（对照）", value: deltaTurb * 1000, color: "#ffb84d", unit: "mm" },
        { label: "位移厚度 δ*", value: dstar * 1000, color: "#63d6a5", unit: "mm" }
      ];
    } else if (ki === 1) {
      bars = [
        { label: "Re_x", value: Re, color: "#5aa9ff" },
        { label: "Re_cr（平板转捩）", value: RE_CR_PLATE, color: "#ff7b7b" }
      ];
    } else {
      bars = [
        { label: "f（当前）", value: fCur, color: "#5aa9ff" },
        { label: "64/Re（层流律）", value: 64 / (Re > 0 ? Re : 1e-12), color: "#63d6a5" },
        { label: "Blasius 0.316Re^{−1/4}", value: BLASIUS_COEF * Math.pow(Re > 0 ? Re : 1e-12, -0.25), color: "#ffb84d" }
      ];
    }

    return {
      t: t,
      series: series,
      info: base,
      bars: bars,
      metrics: {
        Re: Re, U: U, x: x, nu: nu, kind: ki, name: name, noFlow: noFlow,
        delta: delta, deltaTurb: deltaTurb, dstar: dstar, theta: theta,
        cf: cf, tau: tau, xCr: xCr, regime: regime, regimeCode: regimeCode,
        f: fCur, uTau: uTau, dVisc: dVisc, lgReCrit: Math.log10(RE_CR_PLATE)
      }
    };
  }

  SIM.register("boundary-layer", {
    title: "边界层与雷诺数",
    legend: "Re_x = Ux/ν 是判定流态的唯一无量纲数：平板 Re_x < 5×10⁵ 时边界层是层流，" +
      "厚度 δ = 5x/√Re_x（∝√x，很薄）；超过 5×10⁵ 就转捩成湍流，δ ≈ 0.37x/Re_x^{1/5}，明显更厚。" +
      "圆管同理：Re_d < 2300 层流 f = 64/Re（精确），Re_d > 4000 湍流用 Blasius f = 0.316Re^{−1/4}。" +
      "「管流摩阻」视图把参数 x 当作管径 d 用。",
    axes: { xlabel: "x (m)　或　lg Re（视所选视图）", ylabel: "δ (m)　/　lg Re_x　/　lg f" },
    params: {
      kind: { label: "视图", type: "enum", options: BL_KINDS, def: 0 },
      U: { label: "来流速度 U", unit: "m/s", def: 1, min: 0.01, max: 100, step: 0.01 },
      x: { label: "特征长度 x（平板距前缘 / 圆管直径 d）", unit: "m", def: 0.5, min: 0.001, max: 10, step: 0.001 },
      nu: { label: "运动黏度 ν", unit: "m²/s", def: 1.5e-5, min: 1e-6, max: 1e-3, step: 1e-7 }
    },
    plots: [
      { key: "delta", label: "层流 δ(x) (m)", color: "#5aa9ff" },
      { key: "deltaTurb", label: "湍流 δ 对照 (m)", color: "#ffb84d", dash: "5 4" },
      { key: "lgRe", label: "lg Re_x", color: "#5aa9ff" },
      { key: "lgReCrit", label: "lg(5×10⁵) 转捩线", color: "#ff7b7b", dash: "5 4" },
      { key: "lgf", label: "lg f（分段摩阻律）", color: "#5aa9ff" },
      { key: "lgfLam", label: "lg(64/Re) 层流律延伸", color: "#63d6a5", dash: "5 4" },
      { key: "lgfCur", label: "当前工况 lg f", color: "#ff7b7b", dash: "2 3" }
    ],
    compute: blCompute,
    tests: [
      // ① Re_x = Ux/ν：U = 1 m/s、x = 0.5 m、ν = 1.5×10⁻⁵ m²/s → Re_x = 33333.3333
      //    measure 从曲线现算（「雷诺数」支的纵轴是 lg Re_x，取末端点再取 10 的幂）
      { name: "Re_x = Ux/ν = 1×0.5/1.5e−5 = 33333.3333（容差 1e-9）",
        params: { kind: 1, U: 1, x: 0.5, nu: 1.5e-5 },
        measure: function (o) { var a = o.series.lgRe; return Math.pow(10, a[a.length - 1]); },
        expect: 33333.333333333336, tol: 1e-9 },
      // ①b 换一组参数（U = 25 m/s、x = 2 m）：Re_x = 25×2/1.5e−5 = 3333333.3333
      { name: "Re_x = Ux/ν = 25×2/1.5e−5 = 3333333.3333（容差 1e-6）",
        params: { kind: 1, U: 25, x: 2, nu: 1.5e-5 },
        measure: function (o) { var a = o.series.lgRe; return Math.pow(10, a[a.length - 1]); },
        expect: 3333333.3333333335, tol: 1e-6 },
      // ② 层流边界层 δ = 5x/√Re_x：5×0.5/√33333.3333 = 0.013693063937629 m（容差 1e-9）
      { name: "层流边界层 δ = 5x/√Re_x = 0.013693063937629 m（U=1、x=0.5、ν=1.5e−5，容差 1e-9）",
        params: { kind: 0, U: 1, x: 0.5, nu: 1.5e-5 },
        measure: function (o) { var a = o.series.delta; return a[a.length - 1]; },
        expect: 0.013693063937629, tol: 1e-9 },
      // ②b 逐点核对（201 个网格点）max|δ·√Re_x/(5x) − 1| = 0（容差 1e-12）
      { name: "逐点核对 δ = 5x/√Re_x（201 点最大相对偏差，容差 1e-12）",
        params: { kind: 0, U: 3, x: 0.8, nu: 1.5e-5 },
        measure: function (o) { return deltaRelResidual(o, 3, 1.5e-5); }, expect: 0, tol: 1e-12 },
      // ②c δ ∝ √x 的直接推论：横轴从 x/100 扫到 x（跨度 100 倍）⇒ δ 末/首 = √100 = 10
      { name: "标度律 δ ∝ √x：δ(100x₀)/δ(x₀) = √100 = 10（容差 1e-9）",
        params: { kind: 0, U: 1, x: 0.5, nu: 1.5e-5 },
        measure: function (o) {
          var a = o.series.delta;
          return a[a.length - 1] / a[0];
        }, expect: 10, tol: 1e-9 },
      // ②d 湍流对照 δ ≈ 0.37x/Re_x^{1/5}：0.37×0.5/33333.3333^{0.2} = 0.023046022382887 m
      { name: "湍流边界层对照 δ ≈ 0.37x/Re_x^{1/5} = 0.023046022382887 m（容差 1e-9）",
        params: { kind: 0, U: 1, x: 0.5, nu: 1.5e-5 },
        measure: function (o) { var a = o.series.deltaTurb; return a[a.length - 1]; },
        expect: 0.023046022382887, tol: 1e-9 },
      // ③ 平板转捩位置 x_cr = Re_cr·ν/U = 5×10⁵×1.5×10⁻⁵/1 = 7.5 m（容差 1e-9）
      { name: "平板转捩位置 x_cr = 5×10⁵ν/U = 7.5 m（U=1、ν=1.5e−5，容差 1e-9）",
        params: { kind: 0, U: 1, x: 0.5, nu: 1.5e-5 },
        measure: function (o) { return o.metrics.xCr; }, expect: 7.5, tol: 1e-9 },
      // ③b 判据给出层流：x = 7.4 m → Re_x = 4.93×10⁵ < 5×10⁵ ⇒ regimeCode = 0
      { name: "转捩判据：x = 7.4 m（Re_x = 4.93×10⁵ < 5×10⁵）判为层流（0）",
        params: { kind: 0, U: 1, x: 7.4, nu: 1.5e-5 },
        measure: function (o) { return o.metrics.regimeCode; }, expect: 0, tol: 0 },
      // ③c 判据给出湍流：x = 7.6 m → Re_x = 5.07×10⁵ ≥ 5×10⁵ ⇒ regimeCode = 1
      { name: "转捩判据：x = 7.6 m（Re_x = 5.07×10⁵ ≥ 5×10⁵）判为湍流（1）",
        params: { kind: 0, U: 1, x: 7.6, nu: 1.5e-5 },
        measure: function (o) { return o.metrics.regimeCode; }, expect: 1, tol: 0 },
      // ④ 圆管层流 f = 64/Re（精确）：U = 0.05 m/s、d = 0.5 m、ν = 1.5×10⁻⁵ → Re_d = 1666.67，
      //    f = 64/1666.6667 = 0.0384（也可写成 f = 64ν/(Ud)，与 Re 无关的显式形式）
      { name: "圆管层流 f = 64/Re_d = 0.0384（Re_d = 1666.6667，容差 1e-9）",
        params: { kind: 2, U: 0.05, x: 0.5, nu: 1.5e-5 },
        measure: function (o) { return o.metrics.f; }, expect: 0.0384, tol: 1e-9 },
      // ④b 逐点核对层流支（lg Re 网格上 Re < 2300 的全部点）max|f·Re − 64| = 0（容差 1e-9）
      { name: "逐点核对 f·Re = 64（曲线层流支全部网格点，容差 1e-9）",
        params: { kind: 2, U: 1, x: 0.5, nu: 1.5e-5 },
        measure: function (o) { return lamFResidual(o); }, expect: 0, tol: 1e-9 },
      // ④c 转捩判据 Re ≈ 2300：Re_d = 2000 → 层流(0)、3000 → 过渡(1)、5000 → 湍流(2)
      { name: "管流转捩判据：Re_d = 2000 判为层流（0）",
        params: { kind: 2, U: 0.06, x: 0.5, nu: 1.5e-5 },
        measure: function (o) { return o.metrics.regimeCode; }, expect: 0, tol: 0 },
      { name: "管流转捩判据：Re_d = 3000（2300 ≤ Re < 4000）判为过渡区（1）",
        params: { kind: 2, U: 0.09, x: 0.5, nu: 1.5e-5 },
        measure: function (o) { return o.metrics.regimeCode; }, expect: 1, tol: 0 },
      { name: "管流转捩判据：Re_d = 5000（≥ 4000）判为湍流（2）",
        params: { kind: 2, U: 0.15, x: 0.5, nu: 1.5e-5 },
        measure: function (o) { return o.metrics.regimeCode; }, expect: 2, tol: 0 },
      // ④d Blasius 光滑管对照 f = 0.316Re_d^{−1/4}：Re_d = 5000 → 0.316/5000^{0.25} = 0.0375789448…
      //     期望值直接写成算式（曾经手算成 0.037578583，错了 1e-5 相对量，被 1e-9 容差抓住）
      { name: "Blasius 湍流对照 f = 0.316Re^{−1/4} = 0.0375789448（Re_d = 5000，容差 1e-9）",
        params: { kind: 2, U: 0.15, x: 0.5, nu: 1.5e-5 },
        measure: function (o) { return o.metrics.f; }, expect: 0.316 / Math.pow(5000, 0.25), tol: 1e-9 },
      // ⑤ 边界安全：U = 0（Re = 0 ⇒ δ 的 1/√Re 会发散）、x = 0、ν = 0（会除零）→ 曲线全有限
      { name: "边界安全：U = 0、x = 0、ν = 0 时曲线仍全为有限值（无 NaN/Infinity）",
        params: { kind: 0, U: 0, x: 0, nu: 0 },
        measure: function (o) { return badCount(o); }, expect: 0, tol: 0 },
      // ⑤b 边界安全：ν 极小 ⇒ Re 极大（U = 100、x = 10、ν = 1e−6 → Re = 10⁹），δ 仍为解析值
      //     5×10/√10⁹ = 0.0015811388300841897 m
      { name: "边界安全：Re = 10⁹（ν = 1e−6）时 δ = 5x/√Re_x = 0.001581138830084 m（容差 1e-9）",
        params: { kind: 0, U: 100, x: 10, nu: 1e-6 },
        measure: function (o) { var a = o.series.delta; return a[a.length - 1]; },
        expect: 0.0015811388300841897, tol: 1e-9 },
      // ⑤c 边界安全：滑块最小值组合（U = 0.01、x = 0.001、ν = 1e−3 ⇒ Re = 10⁻⁵，δ 反而很大）
      { name: "边界安全：滑块最小值组合（Re = 10⁻⁵）时曲线全有限（不抛异常、不出 NaN）",
        params: { kind: 2, U: 0.01, x: 0.001, nu: 1e-3 },
        measure: function (o) { return badCount(o); }, expect: 0, tol: 0 }
    ]
  });
})(typeof window !== "undefined" ? window : globalThis);
