/* ==========================================================================
   simlab-models-gr.js —— 广义相对论仿真模型（W5 契约 §13.B.3，2 个）

     · schwarzschild  史瓦西时空：光线偏折 Δφ = 4GM/(c²b)、水星近日点进动
                      Δω = 6πGM/(a(1−e²)c²) 每圈、引力红移 z = 1/√(1−r_s/r) − 1、
                      强场轨道（Binet 方程 d²u/dφ² + u = GM/L² + 3GMu²/c² 的数值解）
     · gravity-wave    双星与引力波：啁啾质量、df/dt = (96/5)π^{8/3}(GM_c/c³)^{5/3}f^{11/3}、
                      并合时间 t_c ∝ f₀^{−8/3}、应变波形 h(t) 与解析包络

   ★ 约束（与 simlab.js 顶部一致）：
     · 加载时**只调用 SIM.register**，绝不触碰 DOM —— tools/verify-simlab.mjs 在 Node 里
       用 window 桩直接跑 compute() 与 tests 做物理不变量自检；
     · **不调用 Math.random**（两个模型都是确定性解析/数值计算，同参数两次运行逐位相同）；
     · 纯 ES5：var / 无箭头函数 / 无模板字符串 / 无 import-export；
     · 边界安全：任意滑块取值都不抛异常、不出 NaN/Infinity。四处重点专门处理：
         – schwarzschild 的 r → r_s：1/√(1−r_s/r) 在视界发散 ⇒ r 先夹到 ≥ 1.0001 r_s；
         – schwarzschild 的 b → b_c：零测地线的临界碰撞参数是 b_c = 3√3 M = 2.598 r_s
           （用 r_s 表达即 1.5√3 r_s），b < b_c 的光线被捕获 ⇒ 精确偏折的求积里 b 夹到
           1.0005 b_c，曲线在 b_c 处发散是**物理**的（不是数值事故），info 里明确标注"捕获"；
         – schwarzschild 的轨道积分：黑洞附近 1/r 跨若干量级，直接积 u 会出现 GM/L² 与 u²
           的量级抵消 ⇒ 改用无量纲 U = r_s·u，Binet 方程成为 U″ = −U + 1/b + (3/2)U²（b = 半通径/r_s），
            首积分 U′² = C − U² + U³ + 2U/b ⇒ 转折点是三次式 U³ − U² + (2/b)U + C = 0
            的根（Vieta 三根之和 = 1）。给定远心点 r_a = r（滑块）与 b 即可解出另两根，不必另给能量；
           再把 U 换回 r = r_s/U 画图；
         – gravity-wave 的 f₀ 很大：t_c ∝ f₀^{−8/3}，f₀ = 100 Hz 时 t_c ≈ 13 ms ⇒ 采样点数按
           t_c 自适应，峰值应变处的频率夹在 f_c = min(2f_ISCO, 2000 Hz)。

   物理常量（与 app/constants.js 、课程正文同一套：CODATA 2018 的 G、c，IAU 名义 GM_☉）：
     G    = 6.674 30×10^-11 m³/(kg·s²)   （CODATA 2018，相对不确定度 2.2×10^-5）
     c    = 2.997 924 58×10^8 m/s        （定义值）
     M_☉  = GM_☉/G = 1.988 409 9×10^30 kg            （IAU 2015 名义引力参数 GM_☉ = 1.327 124 4×10^20 m³/s²；
                                          GM_☉/c³ = 4.925 490 9×10^-6 s；与 CODATA 的 M_☉ = 1.988 47×10^30 kg 差 4×10^-5，
                                          正是 G 的不确定度量级。★ 太阳公式里出现的都是乘积 G·M_☉，
                                          所以本文件由 GM_☉ 反定 M_☉（M_SUN = GM_SUN/G_C），G_C·M_SUN ≡ GM_SUN 逐位自洽）
     AU   = 1.495 978 707×10^11 m        （定义值）
     pc   = 3.085 677 581×10^16 m        （定义值）⇒ 1 Mpc = 3.085 677 581×10^22 m
     另有 constants.js 未列、本节必需的天体常数（来源写清）：
       R_☉       = 6.957×10^8 m（IAU 2015 名义太阳半径；契约 ② 的检验点 b = R_☉）
       水星轨道  a = 5.790 9×10^10 m、e = 0.205 63、周期 87.969 d（契约 ③ 给定的轨道根数，
                 43″/世纪 这个经典数字就由这三者定出）
       1″ = 1/206265 rad（契约 §13.B.3 指定的换算，本文件统一用它）
   ========================================================================== */
(function (global) {
  "use strict";
  var SIM = global.SIM;
  if (!SIM) return;   // 在 Node 里若未先加载 simlab.js，安静退出

  var rk4 = SIM.rk4, lin = SIM.linspace, fmt = SIM.fmt, opt = SIM.opt;

  /* ------------------------------------------------------------- 物理常量 */
  var PI = Math.PI;
  var G_C = 6.67430e-11;              // 引力常量 G（CODATA 2018）
  var C_LIGHT = 2.99792458e8;         // 光速 c（定义值）
  var GM_SUN = 1.3271244e20;          // 太阳引力参数 GM_☉（IAU 2015 名义值，m³/s²）
  var M_SUN = GM_SUN / G_C;           // 太阳质量 M_☉ = GM_☉/G（≈ 1.988 41×10^30 kg）
                                      // ★ 由 GM_☉ 反定，保证 G_C·M_SUN ≡ GM_SUN：课程正文的
                                      //   r_s = 2.953 km、偏折 1.751″、进动 43″/世纪 都对得上
  var R_SUN = 6.957e8;                // 太阳半径 R_☉（IAU 2015 名义值）
  var AU_M = 1.495978707e11;          // 天文单位 AU（定义值）
  var PC_M = 3.085677581e16;          // 秒差距 pc（定义值）
  var MPC_M = PC_M * 1e6;             // 1 Mpc
  var ARCSEC = 206265;                // 1 rad = 206265″（契约指定的换算）
  var YEAR_S = 3.15576e7;             // 儒略年（constants.js 的 ly 就按它定义）
  var DAY_S = 86400;                  // 日
  var B_CRIT = 1.5 * Math.sqrt(3);    // 零测地线临界碰撞参数 b_c = 3√3 M = 2.598076 r_s
  // 水星轨道根数（契约 §13.B.3 ③ 指定：a、e、周期 87.969 d）
  var MERC_A = 5.7909e10;             // m
  var MERC_E = 0.20563;               // 无量纲
  var MERC_T = 87.969 * DAY_S;        // s
  var D_L_M = 100 * MPC_M;            // gravity-wave 的约定光度距离：100 Mpc（见 legend）

  /* --------------------------------------------------------------- 小工具 */
  /** 数值参数兜底：非数/越界一律夹回合法区间（滑块或 config 写坏也不许出 NaN） */
  function num(v, lo, hi, dflt) {
    var x = Number(v);
    if (!isFinite(x)) x = dflt;
    return x < lo ? lo : (x > hi ? hi : x);
  }
  /** 整数参数（枚举下标）兜底 */
  function int(v, lo, hi, dflt) {
    var x = Math.round(Number(v));
    if (!isFinite(x)) x = dflt;
    return x < lo ? lo : (x > hi ? hi : x);
  }
  /** 非有限值（NaN / ±Infinity）个数 */
  function nonFinite(vals) {
    var n = 0, i;
    for (i = 0; i < vals.length; i++) {
      if (typeof vals[i] !== "number" || !isFinite(vals[i])) n++;
    }
    return n;
  }
  /** 一份输出里所有曲线（含 extra.lines）的非有限值个数：边界安全自检用 */
  function countBad(o) {
    var bad = nonFinite(o.t || []), i, k;
    var keys = Object.keys(o.series || {});
    for (k = 0; k < keys.length; k++) bad += nonFinite(o.series[keys[k]] || []);
    var lines = (o.extra && o.extra.lines) || [];
    for (i = 0; i < lines.length; i++) {
      bad += nonFinite(lines[i].x || []) + nonFinite(lines[i].y || []);
    }
    return bad;
  }
  /** 两条曲线的最大绝对偏差（"整条曲线都对"而不是只对一个点） */
  function maxAbsDiff(a, b) {
    var m = 0, i, d;
    for (i = 0; i < a.length && i < b.length; i++) {
      d = Math.abs(a[i] - b[i]);
      if (d > m) m = d;
    }
    return m;
  }
  /** 网格上离 target 最近的点（用来从曲线上现读某个自变量的函数值） */
  function nearestIndex(xs, target) {
    var best = 0, bd = Infinity, i, d;
    for (i = 0; i < xs.length; i++) {
      d = Math.abs(xs[i] - target);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  /** 对数网格：自变量跨若干数量级时比线性网格好读（r/r_s = 1~100 就是这种情况） */
  function logGrid(a, b, n) {
    var out = [], i, la, lb;
    if (n <= 1) return [a];
    la = Math.log(Math.max(1e-300, a)); lb = Math.log(Math.max(1e-300, b));
    for (i = 0; i < n; i++) out.push(Math.exp(la + ((lb - la) * i) / (n - 1)));
    return out;
  }
  /** 把某个"特殊值"塞进网格（替换最近的点、点数不变），便于在曲线上按全精度现读 */
  function withPoint(grid, v) {
    var i = nearestIndex(grid, v), out = grid.slice();
    if (isFinite(v) && v > 0) out[i] = v;
    return out;
  }
  /** 三次方程 x³ + a x² + b x + c = 0 的实根（三角函数解法；判别式 ≤ 0 时三个实根） */
  function cubicRealRoots(a, b, c) {
    var p = b - a * a / 3;
    var q = 2 * a * a * a / 27 - a * b / 3 + c;
    var disc = q * q / 4 + p * p * p / 27;
    var out = [], i, th, r;
    if (disc > 1e-18 || p >= 0) {
      r = Math.sqrt(Math.max(0, disc));
      out.push(Math.cbrt(-q / 2 + r) + Math.cbrt(-q / 2 - r) - a / 3);
    } else {
      // 三个实根：x_k = 2√(−p/3)·cos[(θ + 2πk)/3] − a/3，cosθ = (3q/2p)√(−3/p)
      th = Math.acos(Math.max(-1, Math.min(1, (3 * q) / (2 * p) * Math.sqrt(-3 / p))));
      for (i = 0; i < 3; i++) out.push(2 * Math.sqrt(-p / 3) * Math.cos((th + 2 * PI * i) / 3) - a / 3);
    }
    return out;
  }
  /** 通过 (x1,y1) (x2,y2) 的线性插值在 y = 0 处的 x（步长足够小时精度足够） */
  function linRoot(x1, y1, x2, y2) {
    var d = y2 - y1;
    if (Math.abs(d) < 1e-300) return x1;
    return x1 - y1 * (x2 - x1) / d;
  }

  /* -------------------------------------------------------------- 公共公式 */
  /** 史瓦西半径 r_s = 2GM/c²（m）；mSun 单位 M_☉ */
  function rsOf(mSun) {
    return (2 * G_C * mSun * M_SUN) / (C_LIGHT * C_LIGHT);
  }
  /** 弱场光线偏折 Δφ = 4GM/(c²b) = 2r_s/b（rad）；b 单位 r_s */
  function deflWeakRad(mSun, bRs) {
    var rs = rsOf(mSun);
    return (4 * G_C * mSun * M_SUN) / (C_LIGHT * C_LIGHT * (Math.max(bRs, 1e-9) * rs));
  }
  /** 水星近日点进动 Δω = 6πGM/(a(1−e²)c²) 每圈（rad） */
  function mercuryPrecRad(mSun) {
    return (6 * PI * G_C * mSun * M_SUN) / (MERC_A * (1 - MERC_E * MERC_E) * C_LIGHT * C_LIGHT);
  }
  /** 任意半长轴 a（AU）上的每世纪进动（角秒）：a^{−3/2} 标度 × 100 yr / T(a) */
  function precCentAt(mSun, aAu) {
    var aM = Math.max(aAu, 1e-6) * AU_M;
    var perOrbit = (6 * PI * G_C * mSun * M_SUN) / (aM * (1 - MERC_E * MERC_E) * C_LIGHT * C_LIGHT);
    var per = 2 * PI * Math.sqrt(aM * aM * aM / (G_C * mSun * M_SUN));
    return perOrbit * ARCSEC * (100 * YEAR_S / per);
  }
  /** 引力红移精确式 z = 1/√(1−r_s/r) − 1（r 单位 r_s；r → 1 处夹住，绝不出 ∞） */
  function zExactAt(rRs) {
    var f = 1 - 1 / Math.max(rRs, 1 + 1e-12);
    return 1 / Math.sqrt(Math.max(1e-15, f)) - 1;
  }
  /** 有效势 U_eff(r) = −GM/r + L²/(2r²) − GML²/(c²r³)（L² = (b r_s)·GM）的极小 = 稳定圆轨道。
   *  dU/dr = 0 ⇒ GM r² − L² r + 3GML²/c² = 0，代入 L² = 2b G²M²/c² 得
   *      r_c/r_s = (b/2)[1 + √(1 − 6/b)]      （另一个根是不稳定圆轨道，取"+"号）
   *  b = 6 r_s 时 r_c = 3 r_s 即 ISCO；b < 6 r_s 没有稳定圆轨道（返回 0）。 */
  function circRadiusRs(bRs) {
    var b = Math.max(bRs, 0);
    if (b <= 6) return 0;
    return 0.5 * b * (1 + Math.sqrt(1 - 6 / b));
  }
  /** 第一类完全椭圆积分 K(k) = ∫₀^{π/2} dθ/√(1 − k²sin²θ)，用 AGM 算：
   *  K(k) = π/(2·AGM(1, √(1−k²)))，二次收敛 ⇒ 十几步就到双精度。 */
  function ellipK(k) {
    var a = 1, b = Math.sqrt(Math.max(0, 1 - k * k)), t, i;
    for (i = 0; i < 60; i++) {
      if (Math.abs(a - b) <= 1e-17 * Math.abs(a)) break;
      t = 0.5 * (a + b);
      b = Math.sqrt(Math.max(0, a * b));
      a = t;
    }
    return PI / (2 * Math.max(a, 1e-300));
  }

  /* ======================================================================
     1. schwarzschild —— 史瓦西时空

     四个参数：kind 显示内容、M 中心质量（M_☉）、r 半径（r_s）、b 碰撞参数（r_s）

     kind = 0 光线偏折
       · deflection：Δφ = 4GM/(c²b)，横轴 b/r_s ∈ [2.65, 40] 对数网格，
         并把 b = R_☉/r_s ≈ 2.355×10^5 这个点塞进网格 —— 契约 ② 的 1.7515″ 就从这个
         弱场解析曲线上按 8 位有效数字读出（强场求积那套在 b ~ 10^5 时会被双精度相消吃掉）。
       · captured：强场**精确**偏折，Δφ = π − 2∫₀^{v₁} dv/√(1 − v² + (r_s/b)v³)
         （v = b/r，来自零测地线 (du/dφ)² = 1/b² − u² + r_s u³），b ≤ b_c = 2.598 r_s 时
         三次式没有实根 ⇒ 光子被捕获，曲线在 b_c 处发散。与 RK4 直接积分轨迹对照过。
       · extra：四条真实光线轨迹 + 视界 r = 1、光子球 r = 1.5、临界碰撞参数参考线。

     kind = 1 水星近日点进动
       · precession：Δω_100(a) = 6πGM/(a(1−e²)c²) × (100 yr / T(a)) × 206265（a 单位 AU，
         对数网格，每**世纪**进动 ∝ a^{−5/2} —— 每圈 ∝ 1/a，再乘开普勒的 100 yr/T(a) ∝ a^{−3/2}），
         水星的实际 a 被塞进网格 ⇒ 契约 ③ 的 43″/世纪。
       · cumul（放在 extra 里，横轴 = 千圈）：累积进动 = 每圈角秒 × 转数 ——
         "每圈 0.1035″、一万圈才 0.29°"。它与主图横轴（AU）不是同一根轴，所以不能塞进 series。

     kind = 2 引力红移
       · redshift：精确式 z = 1/√(1−r_s/r) − 1；weak：弱场 z = GM/(rc²) = r_s/(2r)；
         dev：|z − z_weak|/z（≈ r_s/(4r)，r → r_s 时升到 ~1）。

     kind = 3 强场轨道
       · ueff / ueffN：单位质量的相对论/牛顿有效势
             U_eff(r) = −GM/r + L²/(2r²) − GML²/(c²r³)，取 L² = (b r_s)GM（b 单位 r_s）
         横轴 r/r_s 对数；相对论项把势整体压低，最小值处即圆轨道、ISCO 落在 3 r_s。
       · extra：Binet 方程 d²u/dφ² + u = GM/L² + 3GMu²/c² 的 RK4 解。无量纲化后
             U″ = −U + 1/b + 3U²，U = r_s/r
         起点取**近心点** U_p = 1/(b(1+e))（e = √(1 − (3/b)(1 + 1/b))，由三次式
         U³b² − U b + 1 = 0 的根精确解出），积一个径向周期 ⇒ 轨道不闭合、缺口就是进动。
       · 数值测到的每圈进动与弱场解析式 Δω = 6π/(b(1−b/r_p)(1−3/b)) 对照（见 tests）。
      ====================================================================== */
  SIM.register("schwarzschild", {
    title: "史瓦西时空：光线偏折 1.7515″、水星进动 43″/世纪、引力红移、强场轨道",
    legend: "史瓦西半径 r_s = 2GM/c²：太阳只有 2.953 km（把太阳压进半径 3 km 的球才是黑洞）。" +
      "光走零测地线，掠过质量 M、碰撞参数 b 的光线偏折 Δφ = 4GM/(c²b)：擦过太阳表面（b = R_☉）" +
      "应偏 1.7515″，1919 年日食观测证实 —— b 小于 3√3M = 2.598 r_s 的光线则直接被捕获。" +
      "行星轨道按 Binet 方程多出一项 3GMu²/c²，水星因此每世纪多转 43″（不是牛顿摄动，" +
      "是时空弯曲本身）。引力红移 z = 1/√(1−r_s/r) − 1：r → r_s 时 z → ∞（光爬不出来），" +
      "r ≫ r_s 时退回 z ≈ GM/(rc²)。" +
      "四个滑块：M 中心质量、r 半径（单位 r_s）、b 碰撞参数（单位 r_s）。" +
      "强场区 r ~ 10 r_s 的进动一眼可见；水星在 r ≈ 8.3×10⁷ r_s 处，要积累一个世纪才够 43″。",
    axes: {
      xlabel: "横轴随选项变化：b/r_s（碰撞参数）、a (AU)、r/r_s、千圈（累积）、r/r_s",
      ylabel: "见各条曲线标签（角秒、无量纲 z、U_eff/c²）"
    },
    params: {
      kind: {
        label: "显示内容", type: "enum",
        options: ["光线偏折", "水星近日点进动", "引力红移", "强场轨道"], def: 0
      },
      M: { label: "中心质量 M", unit: "M_☉", def: 1, min: 0.1, max: 10, step: 0.1 },
      r: { label: "半径 r", unit: "r_s", def: 10, min: 1.1, max: 100, step: 0.1 },
      b: { label: "碰撞参数 b", unit: "r_s", def: 5, min: 0.5, max: 50, step: 0.1 }
    },
    plots: [
      { key: "deflection", label: "Δφ = 4GM/(c²b)（弱场，角秒）", color: "#5aa9ff" },
      { key: "captured", label: "强场精确偏折（零测地线求积，角秒）", color: "#ffb84d" },
      { key: "precession", label: "Δω（角秒/世纪）", color: "#63d6a5" },
      { key: "cumul", label: "累积进动（角秒）", color: "#63d6a5" },
      { key: "redshift", label: "z = 1/√(1−r_s/r) − 1", color: "#5aa9ff" },
      { key: "weak", label: "弱场极限 z = GM/(rc²)", color: "#ffb84d", dash: "5 4" },
      { key: "dev", label: "|z − z_weak|/z（相对偏差）", color: "#ff7b7b", dash: "3 3" },
      { key: "ueff", label: "U_eff/(c²)（相对论有效势）", color: "#c792ea" },
      { key: "ueffN", label: "牛顿有效势 −GM/r + L²/(2r²)", color: "#7fd8e8", dash: "5 4" }
    ],
    compute: function (p) {
      var kind = int(p.kind, 0, 3, 0);
      var M = num(p.M, 0.1, 10, 1);
      var rRs = num(p.r, 1.0001, 100, 10);              // 滑块下限 1.1 r_s；但 config/自检可以一路逼近视界：这里夹到 ≥ 1.0001 r_s
              // （zExactAt 里还有第二道 1 + 1e-12 的夹子），保证 z 有限、不出 NaN/∞
      var bRs = num(p.b, 0.5, 50, 5);
      var rs = rsOf(M);                              // m
      var series = {}, info = [], lines = [], markers = [], t = [], extra = null;
      var bar = null;
      var i;

      /* ---- 公共读数（契约要求的四项：r_s、偏折、进动、红移） ---- */
      var deflSun = deflWeakRad(M, R_SUN / rs) * ARCSEC;      // b = R_☉ 时的偏折（″）
      var precOrbit = mercuryPrecRad(M) * ARCSEC;             // 每圈角秒
      var precCent = precOrbit * (100 * YEAR_S / MERC_T);     // 每世纪角秒
      var zNow = zExactAt(rRs);
      var deflNow = deflWeakRad(M, bRs) * ARCSEC;
      var strongNow = nullGeodesicDeflectionRad(bRs) * ARCSEC;

      info = [
        { k: "史瓦西半径 r_s = 2GM/c²", v: fmt(rs / 1000, 6) + " km（M = " + fmt(M, 3) + " M_☉；契约值 2.953 km）" },
        { k: "光子球 r = 1.5 r_s / 临界碰撞参数", v: fmt(1.5 * rs / 1000, 6) + " km / b_c = 3√3M = " + fmt(B_CRIT, 6) + " r_s = " + fmt(B_CRIT * rs / 1000, 6) + " km" },
        { k: "最内稳定圆轨道 ISCO（r = 3 r_s）", v: fmt(3 * rs / 1000, 6) + " km（" + fmt(3, 0) + " r_s = " + fmt(3 * rs, 6) + " m）" },
        { k: "光线偏折（b = R_☉ = 6.957×10⁸ m）", v: fmt(deflSun, 8) + "″" + "（= 4GM/(c²R_☉)，契约值 1.7515″）" },
        { k: "水星近日点进动", v: fmt(precCent, 6) + "″/世纪（= " + fmt(precOrbit, 6) + "″/圈，契约值 43″/世纪）" },
        { k: "当前 r 处的引力红移 z", v: fmt(zNow, 6) + (rRs <= 1.001 ? "（r → r_s：z → ∞，已夹住）" : "") },
        { k: "当前 b 处的偏折", v: "弱场 " + fmt(deflNow, 6) + "″ / 强场精确 " + fmt(strongNow, 6) + "″" + (bRs < B_CRIT ? "（b < b_c：被捕获）" : "") }
      ];

      /* ============================== kind 0：光线偏折 ============================== */
      if (kind === 0) {
        var bGrid = logGrid(2.65, 40, 320);
        bGrid = withPoint(bGrid, R_SUN / rs);       // b = R_☉/r_s ≈ 2.355×10^5（契约 ② 的检验点）
        var defl = [];
        for (i = 0; i < bGrid.length; i++) defl.push(deflWeakRad(M, bGrid[i]) * ARCSEC);
        t = bGrid;
        series.deflection = defl;

        // 强场精确偏折：与弱场曲线共用同一条横轴（同一 b 网格，含 b = R_☉/r_s 那个点），
        // b ≤ b_c = 2.598 r_s 已被求积内部夹住 ⇒ 曲线在 b_c 处翘起但不 NaN
        var strong = [];
        for (i = 0; i < bGrid.length; i++) strong.push(nullGeodesicDeflectionRad(bGrid[i]) * ARCSEC);
        series.captured = strong;

        // extra：真实光线轨迹（RK4 积零测地线）
        var bRays = [2.65, 3.5, 5, 8], cols = ["#ff7b7b", "#ffb84d", "#5aa9ff", "#63d6a5"];
        for (i = 0; i < bRays.length; i++) {
          var ray = photonTrajectory(bRays[i]);
          lines.push({
            x: ray.x, y: ray.y, color: cols[i],
            label: "b = " + fmt(bRays[i], 2) + " r_s（Δφ = " + fmt(nullGeodesicDeflectionRad(bRays[i]) * ARCSEC, 4) + "″）"
          });
        }
        var hz = circlePath(1), ph = circlePath(1.5);
        lines.push({ x: hz.x, y: hz.y, color: "#000000", dash: "1 0", label: "视界 r = r_s" });
        lines.push({ x: ph.x, y: ph.y, color: "#ffb84d", dash: "3 3", label: "光子球 r = 1.5 r_s" });
        extra = {
          lines: lines, markers: markers,
          xlabel: "x / r_s", ylabel: "y / r_s",
          title: "光线轨迹（RK4 积零测地线）：b 越小弯得越狠，b < 2.598 r_s 直接落进视界"
        };
        info.push({ k: "当前 b 的偏折读数", v: "b = " + fmt(bRs, 4) + " r_s = " + fmt(bRs * rs / 1000, 6) + " km ⇒ 弱场 " + fmt(deflNow, 8) + "″" });
        info.push({ k: "捕获判据", v: bRs < B_CRIT ? "b < b_c：光子被捕获，偏折发散（曲线在 b_c 处翘到无穷）" : "b > b_c：偏折有限、光子逃到无穷远" });
      }

      /* ========================= kind 1：水星近日点进动 ========================= */
      if (kind === 1) {
        var aGrid = logGrid(0.1, 3, 320);                    // AU
        aGrid = withPoint(aGrid, MERC_A / AU_M);             // 水星实际 a（自检在曲线上现读）
        var pre = [];
        for (i = 0; i < aGrid.length; i++) pre.push(precCentAt(M, aGrid[i]));
        t = aGrid;
        series.precession = pre;

        var nK = lin(0, 10, 101), cum = [];                  // 累积进动：横轴 = 千圈
        for (i = 0; i < nK.length; i++) cum.push(precOrbit * nK[i] * 1000);
        // 累积进动的横轴是"千圈"、与主图的"AU"不是同一根轴 ⇒ 放进 extra（extra.lines 每条自带横轴），
        // 否则会被按主图横轴画到 0.1~0.44 AU 那一段上去（错位）。
        extra = {
          lines: [{ x: nK, y: cum, color: "#63d6a5", label: "累积进动（角秒）" }],
          xlabel: "转数（千圈）", ylabel: "累积进动（角秒）",
          title: "累积进动 = 每圈 Δω × 转数：水星每圈 0.1035″，一万圈才 1035″ ≈ 0.29°"
        };
        markers.push({ x: MERC_A / AU_M, y: precCent, label: "水星 " + fmt(precCent, 4) + "″/世纪" });

        info.push({ k: "水星轨道根数", v: "a = 5.7909×10¹⁰ m = " + fmt(MERC_A / AU_M, 6) + " AU，e = " + fmt(MERC_E, 6) + "，T = 87.969 d" });
        info.push({ k: "每圈进动 Δω = 6πGM/(a(1−e²)c²)", v: fmt(precOrbit, 8) + "″/圈 = " + fmt(mercuryPrecRad(M) * 1e9, 6) + "×10⁻⁹ rad/圈" });
        info.push({ k: "每世纪进动", v: fmt(precCent, 8) + "″/世纪（一世纪 = " + fmt(100 * YEAR_S / MERC_T, 6) + " 圈）" });
        info.push({ k: "每世纪 ∝ a^{−5/2}（每圈 ∝ 1/a × 开普勒 a^{−3/2}）", v: "a = 0.1 AU 处 " + fmt(precCentAt(M, 0.1), 6) + "″/世纪；a = 1 AU 处 " + fmt(precCentAt(M, 1), 6) + "″/世纪（金星、地球因此小得多）" });
        bar = [
          { label: "水星每圈（角秒 ×10⁻³）", value: precOrbit * 1000, color: "#63d6a5" },
          { label: "水星每世纪（角秒）", value: precCent, color: "#5aa9ff" },
          { label: "地球轨道处每世纪（角秒）", value: precCentAt(M, 1), color: "#ffb84d" }
        ];
      }

      /* ============================ kind 2：引力红移 ============================ */
      if (kind === 2) {
        var rGrid = logGrid(1.05, 100, 400);
        rGrid = withPoint(rGrid, rRs);                       // 把滑块当前 r 塞进网格
        var zEx = [], zWk = [], dz = [];
        for (i = 0; i < rGrid.length; i++) {
          zEx.push(zExactAt(rGrid[i]));
          zWk.push(1 / (2 * Math.max(rGrid[i], 1e-9)));       // GM/(rc²) = r_s/(2r)
          dz.push(Math.abs(zEx[i] - zWk[i]) / Math.max(zEx[i], 1e-300));
        }
        t = rGrid;
        series.redshift = zEx;
        series.weak = zWk;
        series.dev = dz;
        markers.push({ x: rRs, y: zNow, label: "r = " + fmt(rRs, 3) + " r_s → z = " + fmt(zNow, 4) });

        var iNow = nearestIndex(rGrid, rRs);
        info.push({ k: "精确式 z = 1/√(1−r_s/r) − 1", v: fmt(zEx[iNow], 8) + "（r = " + fmt(rRs, 3) + " r_s）" });
        info.push({ k: "弱场极限 z ≈ GM/(rc²) = r_s/(2r)", v: fmt(zWk[iNow], 8, 8) });
        info.push({ k: "两者相对偏差", v: fmt(dz[iNow], 8) + "（≈ r_s/(4r)；契约 ④ 的 1% 检验点在 r ≳ 75 r_s）" });
        info.push({ k: "两端", v: "r = 1.05 r_s 处 z = " + fmt(zEx[0], 4) + "（趋于发散）；r = 100 r_s 处 z = " + fmt(zEx[zEx.length - 1], 6) });
        info.push({ k: "时间膨胀换算", v: "无穷远观察者看到那里的钟慢 1/(1+z) = " + fmt(1 / (1 + zNow), 6) + " 倍（GPS 卫星每天 45 μs 就是这个效应）" });
      }

      /* ============================= kind 3：强场轨道 ============================= */
      var orbitMetric = null;
      if (kind === 3) {
        /* 有效势 U_eff(r) = −GM/r + L²/(2r²) − GML²/(c²r³)，取 L² = (b r_s)·GM（b 单位 r_s）。
           它的极小 = 稳定圆轨道 r_c = (b/2)[1 + √(1 − 6/b)] r_s（b = 6 r_s ⇒ r_c = 3 r_s = ISCO）。 */
        var RG = logGrid(1.05, Math.max(120, 4 * rRs), 400);
        var GM = G_C * M * M_SUN;
        var L2 = (bRs * rs) * GM;                            // (m²/s)²
        var uef = [], uefN = [];
        for (i = 0; i < RG.length; i++) {
          var rr = RG[i] * rs;
          var base = -GM / rr + L2 / (2 * rr * rr);
          uefN.push(base / (C_LIGHT * C_LIGHT));
          uef.push((base - (GM * L2) / (C_LIGHT * C_LIGHT * rr * rr * rr)) / (C_LIGHT * C_LIGHT));
        }
        t = RG;
        series.ueff = uef;
        series.ueffN = uefN;

        /* Binet 数值轨道：起点取**远心点** r_a = r（滑块），转折点由首积分三次式的 Vieta 关系解出
           （见 orbitTrajectory），积一个径向周期；首尾的缺口就是每圈进动。 */
        var orb = orbitTrajectory(rRs, bRs);
        orbitMetric = orb;
        lines.push({ x: orb.x, y: orb.y, color: "#5aa9ff", label: "轨道（Binet 数值解：r_a = " + fmt(orb.ra, 3) + " r_s，r_p = " + fmt(orb.rp, 3) + " r_s，e = " + fmt(orb.e, 4) + "）" });
        var c1 = circlePath(1), c2 = circlePath(1.5), c3 = circlePath(3);
        lines.push({ x: c1.x, y: c1.y, color: "#000000", label: "视界 r = r_s" });
        lines.push({ x: c2.x, y: c2.y, color: "#ffb84d", dash: "3 3", label: "光子球 r = 1.5 r_s" });
        lines.push({ x: c3.x, y: c3.y, color: "#c792ea", dash: "2 4", label: "ISCO r = 3 r_s" });
        markers.push({ x: orb.rp, y: 0, label: "近心点 " + fmt(orb.rp, 3) + " r_s" });

        extra = {
          lines: lines, markers: markers,
          xlabel: "x / r_s", ylabel: "y / r_s",
          title: "强场轨道（Binet 方程数值解）：一个径向周期后轨道**不闭合**，缺口就是近日点进动"
        };

        var rcNow = circRadiusRs(bRs);
        info.push({ k: "轨道参数（半通径 b、远心点 r_a）", v: "b = " + fmt(orb.b, 6) + " r_s，r_a = " + fmt(orb.ra, 4) + " r_s，r_p = " + fmt(orb.rp, 4) + " r_s，e = " + fmt(orb.e, 4) + (orb.clamped ? "（该 r/b 组合没有束缚轨道，已夹到边界）" : "") });
        info.push({ k: "数值每圈进动 Δω_num（RK4 积 Binet 方程）", v: fmt(orb.precRad * 180 / PI, 6) + "° = " + fmt(orb.precRad * ARCSEC, 4) + "″/圈（" + fmt(orb.precRad, 6) + " rad/圈）" });
        info.push({ k: "精确闭式 4K(k)/√(U₃−U_a) − 2π（椭圆积分）", v: fmt(orb.precExactRad * 180 / PI, 6) + "°（数值解与它的相对偏差 " + fmt(Math.abs(orb.precRad - orb.precExactRad) / Math.max(1e-300, Math.abs(orb.precExactRad)), 4) + "）" });
        info.push({ k: "弱场一阶（1PN）对照 6πGM/(a(1−e²)c²) = 3π r_s/p", v: fmt(orb.prec1PNRad * 180 / PI, 6) + "°；精确值是它的 " + fmt(orb.precExactRad / Math.max(1e-300, orb.prec1PNRad), 4) + " 倍，差的就是高阶修正" });
        info.push({ k: "与水星对照", v: "水星每圈 " + fmt(mercuryPrecRad(M) * ARCSEC, 6) + "″（r ≈ 8.3×10⁷ r_s，一个世纪才 43″）；这里一圈就进动 " + fmt(orb.precRad * ARCSEC, 4) + "″ = 水星的 " + fmt(orb.precRad / Math.max(1e-300, mercuryPrecRad(M)), 4) + " 倍" });
        info.push({ k: "稳定圆轨道（有效势极小）", v: "r_c = (b/2)[1+√(1−6/b)] = " + fmt(rcNow, 6) + " r_s（b = 6 r_s 时 r_c = 3 r_s 即 ISCO）；远心点 > r_c 才有束缚轨道" });
        bar = [
          { label: "数值每圈进动（度）", value: orb.precRad * 180 / PI, color: "#5aa9ff" },
          { label: "弱场 1PN（度）", value: orb.prec1PNRad * 180 / PI, color: "#ffb84d" },
          { label: "近心点（r_s）", value: orb.rp, color: "#63d6a5" }
        ];
      }
      var metrics = {
        kind: kind, M: M, rRs: rRs, bRs: bRs, rs: rs, bCrit: B_CRIT,
        deflectionSunArcsec: deflSun,
        deflWeakArcsec: deflNow,
        deflStrongArcsec: strongNow,
        precessionArcsecPerOrbit: precOrbit,
        precessionArcsecPerCentury: precCent,
        zExact: zNow,
        zWeak: 1 / (2 * rRs),
        nDefl: (series.deflection || []).length,
        nStrong: (series.captured || []).length,
        precCentAt: function (aAu) { return precCentAt(M, aAu); },
        mercuryPrecRad: mercuryPrecRad(M)
      };
      if (orbitMetric) {
        metrics.orbitPrecessionRad = orbitMetric.precRad;
        metrics.orbitE = orbitMetric.e;
        metrics.orbitB = orbitMetric.b;
        metrics.orbitRp = orbitMetric.rp;
        metrics.orbitRa = orbitMetric.ra;
        metrics.orbitPrecExactRad = orbitMetric.precExactRad;
        metrics.orbitPrec1PNRad = orbitMetric.prec1PNRad;
        metrics.orbitSemiLatus = orbitMetric.pRs;
        metrics.orbitRadiusAt = function (phi) { return orbitMetric.radiusAt(phi); };
      }

      return { t: t, series: series, info: info, extra: extra, bars: bar, metrics: metrics };
    },
    tests: [
      { // ① r_s = 2GM_☉/c² = 2×1.327 124 4×10^20/(2.997 924 58×10^8)² = 2953.250076 m = 2.953 km
        //    课程正文与契约 §13.B.3 ① 的 2.953 km（容差 1%）；这里锁到 10^-9 km = 1 μm
        name: "① 史瓦西半径 r_s = 2GM/c²：太阳（1 M_☉）→ 2.953 km",
        params: { kind: 0, M: 1, b: 5 },
        measure: function (o) { return o.metrics.rs / 1000; },
        expect: 2.9532500761002498, tol: 1e-9 },
      { // ② 光线偏折 Δφ = 4GM_☉/(c²b)：b = R_☉ = 6.957×10⁸ m
        //    4GM_☉/c² = 5906.5009 m ⇒ Δφ = 8.49001028×10^-6 rad = 1.75119197″
        name: "② 光线偏折 Δφ = 4GM/(c²b)：b = R_☉ → 1.75119197″（在 deflection 曲线上现读）",
        params: { kind: 0, M: 1, b: 5 },
        measure: function (o) {
          var bSun = R_SUN / o.metrics.rs;
          return o.series.deflection[nearestIndex(o.t, bSun)];
        },
        expect: 1.7511919705241283, tol: 1e-9 },
      { // ② 偏折曲线逐点等于 4GM/(c²b)×206265（不是把常数记在别处，整条曲线都对）
        name: "② 偏折曲线逐点等于 4GM/(c²b)×206265（整条曲线相对偏差 < 1e-14）",
        params: { kind: 0, M: 1, b: 5 },
        measure: function (o) {
          var m = 0, i, want, bM;
          for (i = 0; i < o.t.length; i++) {
            bM = o.t[i] * o.metrics.rs;
            want = 4 * G_C * M_SUN / (C_LIGHT * C_LIGHT * bM) * 206265;
            m = Math.max(m, Math.abs(o.series.deflection[i] - want) / want);
          }
          return m;
        },
        expect: 0, tol: 1e-14 },
      { // ② 强场精确偏折在 b ≫ b_c 时趋于弱场 2r_s/b。b = 20~60 r_s 与 4 阶后牛顿展开对照：
        //    Δφ = 2/b + 15π/(16b²) + 16/(3b³) + 3465π/(1024b⁴) + …  （b 单位 r_s，rad）
        //    b = 20 处截断误差 7.3×10^-5 相对 ⇒ 容差 1e-3 足够紧（旧自检写 1e-5 是**物理上不可能**的：
        //    那里二阶项本身就有 7.4%）
        name: "② 强场精确偏折 = 弱场 2r_s/b 的 4 阶后牛顿展开（b ≥ 20 r_s，相对偏差 < 1e-3）",
        params: { kind: 0, M: 1, b: 5 },
        measure: function (o) {
          var m = 0, i, b, want;
          for (i = 0; i < o.t.length; i++) {
            b = o.t[i];
            if (b < 20 || b > 60) continue;                 // 只取中等 b；R_☉ 那个点由下一条专测
            want = 2 / b + 15 * PI / (16 * b * b) + 16 / (3 * b * b * b) + 3465 * PI / (1024 * b * b * b * b);
            m = Math.max(m, Math.abs(o.series.captured[i] / 206265 - want) / want);
          }
          return m;
        },
        expect: 0, tol: 1e-3 },
      { // ② 太阳边缘 b = R_☉/r_s ≈ 2.355 709 8×10^5：精确偏折与弱场只差 (15π/32)(r_s/b) = 6.25×10^-6 相对
        //    —— 这就是"强场精确求积在太阳表面必须退回弱场公式"的定量检验
        name: "② 太阳边缘 b = R_☉：精确偏折与弱场 4GM/(c²b) 的相对偏差 = 6.25×10⁻⁶（< 1×10⁻⁵）",
        params: { kind: 0, M: 1, b: 5 },
        measure: function (o) {
          var i = nearestIndex(o.t, R_SUN / o.metrics.rs);
          var weak = 2 / o.t[i];
          return Math.abs(o.series.captured[i] / 206265 - weak) / weak;
        },
        expect: 0, tol: 1e-5 },
      { // ② b = 5 r_s 的强场精确偏折：独立求积（v = v₁ − s²，40 万段）得 0.590395787606 rad = 33.82719°，
        //    弱场式只有 0.4 rad = 22.91831° —— 强场修正把偏折抬高 47.6%
        name: "② b = 5 r_s 的强场精确偏折 = 33.827187°（弱场只有 22.918312°，修正 +47.6%）",
        params: { kind: 0, M: 1, b: 5 },
        measure: function (o) { return o.metrics.deflStrongArcsec; },
        expect: 121777.98713055158, tol: 0.01 },
      { // ③ 水星近日点进动：6πGM_☉/(a(1−e²)c²) 每圈 × (100 yr / T(a))（在 precession 曲线上现读水星 a 处）
        //    每圈 5.0186673×10⁻⁷ rad = 0.10351754″；一世纪 415.20308 圈 ⇒ 42.9808267″
        name: "③ 水星近日点进动 = 42.9808267″/世纪（在 precession 曲线上现读水星 a 处）",
        params: { kind: 1, M: 1 },
        measure: function (o) {
          var aAu = 5.7909e10 / 1.495978707e11;
          return o.series.precession[nearestIndex(o.t, aAu)];
        },
        expect: 42.980826666309518, tol: 1e-9 },
      { // ③ 每圈进动 Δω = 6πGM/(a(1−e²)c²) = 5.0186673×10⁻⁷ rad = 0.10351754″/圈
        name: "③ 每圈进动 Δω = 6πGM/(a(1−e²)c²) → 0.10351754″/圈",
        params: { kind: 1, M: 1 },
        measure: function (o) { return o.metrics.precessionArcsecPerOrbit; },
        expect: 0.10351754088343113, tol: 1e-12 },
      { // ③ 每**世纪**进动率 ∝ a^{−5/2}：每圈 ∝ 1/a（6πGM/(a(1−e²)c²)），
        //    换算成每世纪再乘开普勒的 100 yr/T ∝ a^{−3/2} ⇒ 合起来 a^{−5/2}。
        //    a = 0.2 与 0.8 AU 之比 = (0.8/0.2)^{5/2} = 4^{5/2} = 32（旧自检写 2^{3/2} = 2.828 是错的：
        //    指数不对，而且 0.2/0.8 是 4 倍不是 2 倍）
        name: "③ 每世纪进动率 ∝ a^{−5/2}（每圈 ∝ 1/a × 开普勒 a^{−3/2}）：0.2 与 0.8 AU 之比 = 32",
        params: { kind: 1, M: 1 },
        measure: function (o) { return o.metrics.precCentAt(0.2) / o.metrics.precCentAt(0.8); },
        expect: 32, tol: 1e-9 },
      { // ③ 质量标度：每圈进动 ∝ M，但换算成每世纪还要乘 100 yr/T ∝ M^{−1/2} ⇒ 每世纪 ∝ M^{3/2}。
        //    M = 2 M_☉ 时 = 42.9808267 × 2^{3/2} = 121.5681360″（旧自检写的 2×42.986 = 85.97 是错的）
        name: "③ 每世纪进动 ∝ M^{3/2}（每圈 ∝ M，周期 ∝ M^{−1/2}）：M = 2 M_☉ → 121.5681360″",
        params: { kind: 1, M: 2 },
        measure: function (o) {
          var aAu = 5.7909e10 / 1.495978707e11;
          return o.series.precession[nearestIndex(o.t, aAu)];
        },
        expect: 121.56813598700423, tol: 1e-9 },
      { // ④ 弱场红移 z ≈ GM/(rc²) 与精确式的相对偏差：r = 100 r_s 时
        //    精确 z = 1/√(1−1/100) − 1 = 0.0050378153；弱场 = 0.005 ⇒ 偏差 0.0075062814 < 1%
        name: "④ 弱场红移：r = 100 r_s 时 |z_exact − r_s/2r|/z_exact = 0.0075062814 < 1%",
        params: { kind: 2, M: 1, r: 100 },
        measure: function (o) {
          var i = nearestIndex(o.t, 100);
          return Math.abs(o.series.redshift[i] - o.series.weak[i]) / o.series.redshift[i];
        },
        expect: 0.0075062814466942936, tol: 1e-12 },
      { // ④ 红移曲线逐点等于精确式（不是拿弱场近似冒充）
        name: "④ redshift 曲线逐点等于 1/√(1−r_s/r) − 1（整条曲线相对偏差 < 1e-14）",
        params: { kind: 2, M: 1, r: 10 },
        measure: function (o) {
          var m = 0, i, want;
          for (i = 0; i < o.t.length; i++) {
            want = 1 / Math.sqrt(1 - 1 / o.t[i]) - 1;
            m = Math.max(m, Math.abs(o.series.redshift[i] - want) / want);
          }
          return m;
        },
        expect: 0, tol: 1e-14 },
      { // ④ 弱场曲线逐点等于 r_s/(2r)
        name: "④ weak 曲线逐点等于 GM/(rc²) = r_s/(2r)（相对偏差 < 1e-14）",
        params: { kind: 2, M: 1, r: 10 },
        measure: function (o) {
          var m = 0, i;
          for (i = 0; i < o.t.length; i++) m = Math.max(m, Math.abs(o.series.weak[i] - 1 / (2 * o.t[i])) * 2 * o.t[i]);
          return m;
        },
        expect: 0, tol: 1e-14 },
      { // ④ 视界发散被夹住：r = 1.0001 r_s 时 z = 1/√(1−1/1.0001) − 1 = 99.005（有限、不抛异常）
        //    实现里 r 先夹到 ≥ 1.0001 r_s、zExactAt 里再夹 max(r, 1+1e-12)，两道都夹住
        name: "④ 视界保护：r = 1.0001 r_s 时 z = 99.005（有限）且整份输出无 NaN/∞",
        params: { kind: 2, M: 10, r: 1.0001 },
        measure: function (o) {
          var bad = countBad(o);
          return (bad === 0 && isFinite(o.metrics.zExact)) ? o.metrics.zExact : -1;
        },
        expect: 99.004999874997935, tol: 5e-3 },
      { // ⑤ 强场轨道：数值 RK4 解测到的每圈进动 = 精确椭圆积分闭式（两条独立路径）
        //    转折点从**轨迹本身**量出（min/max 半径），再用 Vieta 三根之和 = 1 补出第三根，
        //    闭式 Δφ = 4K(k)/√(U₃−U_a)（AGM 算 K），Δω = Δφ − 2π = 0.5214062152 rad = 29.874376°
        name: "⑤ 数值每圈进动 = 精确闭式 4K(k)/√(U₃−U_a) − 2π（椭圆积分，相对偏差 < 1e-5）",
        params: { kind: 3, M: 1, r: 25, b: 22 },
        measure: function (o) {
          var ln = o.extra.lines[0], i, rr, rmin = Infinity, rmax = 0;
          for (i = 0; i < ln.x.length; i++) {
            rr = Math.sqrt(ln.x[i] * ln.x[i] + ln.y[i] * ln.y[i]);
            if (rr < rmin) rmin = rr;
            if (rr > rmax) rmax = rr;
          }
          var Ua = 1 / rmax, Up = 1 / rmin, U3 = 1 - Ua - Up;      // Vieta：三根之和 = 1
          var k2 = (Up - Ua) / (U3 - Ua);
          var a = 1, b2 = Math.sqrt(Math.max(0, 1 - k2)), t, j;
          for (j = 0; j < 60; j++) { t = 0.5 * (a + b2); b2 = Math.sqrt(Math.max(0, a * b2)); a = t; }
          var exact = 4 * (PI / (2 * a)) / Math.sqrt(U3 - Ua) - 2 * PI;
          return Math.abs(o.metrics.orbitPrecessionRad - exact) / exact;
        },
        expect: 0, tol: 1e-5 },
      { // ⑤ 进动必须为正（GR 的符号特征；牛顿轨道恒为闭合，进动 = 0），且比水星每圈大 6 个数量级
        //    0.5214062152 rad/圈 ÷ 5.0186673×10⁻⁷ rad/圈 = 1.0389336×10⁶
        name: "⑤ 强场轨道每圈进动 > 0 且 ≫ 水星量级（= 水星每圈的 1.0389×10⁶ 倍）",
        params: { kind: 3, M: 1, r: 25, b: 22 },
        measure: function (o) {
          var ratio = o.metrics.orbitPrecessionRad / o.metrics.mercuryPrecRad;
          return (o.metrics.orbitPrecessionRad > 0 && ratio > 100) ? ratio : -1;
        },
        expect: 1038933.615036096, tol: 100 },
      { // ⑤ 远心点 = 起始半径 r（滑块），近心点必须落在视界外；两者都由轨迹本身量出
        //    解析值：U_a = 1/25，U_p = 0.0582288427 ⇒ r_p = 17.1736197 r_s
        name: "⑤ 远心点 = 起始半径 25 r_s、近心点 r_p = 17.1736197 r_s > 1 r_s（视界外）",
        params: { kind: 3, M: 1, r: 25, b: 22 },
        measure: function (o) {
          var ln = o.extra.lines[0], i, rr, rmin = Infinity, rmax = 0;
          for (i = 0; i < ln.x.length; i++) {
            rr = Math.sqrt(ln.x[i] * ln.x[i] + ln.y[i] * ln.y[i]);
            if (rr < rmin) rmin = rr;
            if (rr > rmax) rmax = rr;
          }
          return (rmin > 1 && Math.abs(rmax - 25) < 0.01) ? rmin : -1;
        },
        expect: 17.173619684535797, tol: 0.01 },
      { // ⑤ 有效势极小（= 稳定圆轨道半径）落在 ISCO 之外：b = 22 r_s 时
        //    r_c = (b/2)[1+√(1−6/b)] = 20.3808315 r_s > 3 r_s（曲线网格步长 ~0.24 ⇒ 容差 0.3）
        name: "⑤ 有效势极小（稳定圆轨道）落在 ISCO(3 r_s) 之外：b = 22 时 r_c = 20.380832 r_s",
        params: { kind: 3, M: 1, r: 25, b: 22 },
        measure: function (o) {
          var i, bi = -1, best = Infinity;
          for (i = 0; i < o.series.ueff.length; i++) {
            if (o.t[i] < 3.001) continue;
            if (o.series.ueff[i] < best) { best = o.series.ueff[i]; bi = i; }
          }
          return o.t[bi];
        },
        expect: 20.3808315196, tol: 0.3 },
      { // ⑥ 边界安全：b = 0.5 r_s（< b_c，被捕获）+ kind 0
        name: "⑥ 边界安全：b = 0.5 r_s（< b_c，捕获）无 NaN/±∞",
        params: { kind: 0, M: 1, b: 0.5 },
        measure: function (o) { return countBad(o); }, expect: 0, tol: 0 },
      { // ⑥ 边界安全：r = 1.1 r_s（贴近视界）+ kind 2（红移）
        name: "⑥ 边界安全：r = 1.1 r_s、kind = 2（红移）无 NaN/±∞",
        params: { kind: 2, M: 0.1, r: 1.1, b: 0.5 },
        measure: function (o) { return countBad(o); }, expect: 0, tol: 0 },
      { // ⑥ 边界安全：kind 3 的极端组合（r = 1.1 r_s 在 ISCO 以内 ⇒ 无束缚轨道，轨道退化到 r_c；b = 50 r_s、M = 10）
        name: "⑥ 边界安全：kind = 3、r = 1.1 r_s、b = 50 r_s、M = 10 无 NaN/±∞",
        params: { kind: 3, M: 10, r: 1.1, b: 50 },
        measure: function (o) { return countBad(o); }, expect: 0, tol: 0 },
      { // ⑥ 边界安全：kind 1 + 所有参数取上下限
        name: "⑥ 边界安全：kind = 1、M = 10、r = 100、b = 50 无 NaN/±∞",
        params: { kind: 1, M: 10, r: 100, b: 50 },
        measure: function (o) { return countBad(o); }, expect: 0, tol: 0 }
    ]
  });

  /* ======================================================================
     2. gravity-wave —— 双星与引力波

     参数：m1、m2 双星质量（M_☉）、f0 初始引力波频率（Hz）、kind 0 啁啾波形 / 1 轨道演化

     啁啾质量  M_c = (m₁m₂)^{3/5}/(m₁+m₂)^{1/5}（30+30 M_☉ → 26.116512 M_☉）

     演化用**牛顿级（四极公式）**，不含自旋、偏心与高阶 PN；t → t_c 是形式极限：
       频率演化  df/dt = (96/5)π^{8/3}(GM_c/c³)^{5/3}f^{11/3}
                 ⇔ f(τ) = f_c τ^{−3/8}，τ = t_c − t（τ → 0 时频率发散，所以峰值处夹到 f_c）
       并合时间  t_c = (5/256)(GM_c/c³)^{−5/3}(πf₀)^{−8/3} ∝ f₀^{−8/3} ∝ M_c^{−5/3}
                 30+30 M_☉、f₀ = 35 Hz ⇒ t_c = 0.2147209 s（双黑洞"一闪而过"）
       应变振幅  h₀(t) = (4/D_L)(GM_c/c²)^{5/3}(πf(t)/c)^{2/3}，D_L = 100 Mpc（约定距离：契约
                 没有距离参数，这个常数在 legend 与 info 里都写明），峰值取 f_c = min(2f_ISCO, 2000 Hz)
                 —— 注意是 GM_c/c² 而不是 GM_c/c³：(GM/c²)^{5/3} = (GM/c³)^{5/3}·c^{5/3}，
                 少了这个 c^{5/3} 峰值应变会小 1.3×10^14 倍（30+30、100 Mpc 应为 7.6×10^-21）
       相位      Φ(t) = ∫2πf dt 的闭式解：Φ(τ) = 2(5GM_c/c³)^{−5/8}τ^{5/8}
                 （实现里只用这一个式子，并与"从 t_c 倒推"的等价写法对照过，见 tests ②）

     kind = 0 啁啾波形：h（带符号应变）+ hUpper/hLower（±解析包络）
     kind = 1 轨道演化：r（分离距离，r_s 单位）+ rkm + orbit（累计圈数）
     两种 kind 的 extra 都给 f(t)；kind 0 另画 f_ISCO 参考线。
     采样点数按 t_c 自适应：f₀ = 100 Hz 时 t_c ≈ 13 ms，f₀ = 10 Hz 时 t_c ≈ 6.1 s。
      ====================================================================== */
  SIM.register("gravity-wave", {
    title: "双星与引力波：啁啾质量、df/dt、并合时间 t_c ∝ f₀^{−8/3}、应变波形",
    legend: "两个致密星互相绕转 = 一个随时间变化的质量四极矩，它把轨道能量以引力波带走：" +
      "轨道收缩、频率升高、振幅变大 —— 这就是啁啾（chirp）。波形只由**啁啾质量**" +
      " M_c = (m₁m₂)^{3/5}/(m₁+m₂)^{1/5} 决定（30+30 M_☉ → 26.12 M_☉，10+90 M_☉ 只有 23.58 M_☉，" +
      "所以引力波测到的是 M_c 而不是单个质量）。频率演化 df/dt = (96/5)π^{8/3}(GM_c/c³)^{5/3}f^{11/3}，" +
      "并合时间 t_c = (5/256)(GM_c/c³)^{−5/3}(πf₀)^{−8/3} ∝ f₀^{−8/3}：30+30 M_☉ 从 35 Hz 起只要" +
      " 0.2147 s 就并合，把 f₀ 拖到 10 Hz 则要 6.06 s（28 倍）—— 8/3 次方的威力。" +
      "应变按 D_L = 100 Mpc 的约定距离给出（契约没有距离参数），30+30 M_☉ 的峰值 ~7.6×10⁻²¹，" +
      "与 GW150914（36+29 M_☉、410 Mpc、峰值 1×10⁻²¹）同量级。" +
      "说明：这是牛顿级（四极）演化，t → t_c 时频率与振幅形式发散，真实并合波形要数值相对论。",
    axes: {
      xlabel: "t（s，从 f₀ 对应的那一刻起算到并合）",
      ylabel: "见各条曲线标签（无量纲应变 h、分离距离、圈数）"
    },
    params: {
      m1: { label: "质量 m₁", unit: "M_☉", def: 30, min: 1, max: 100, step: 1 },
      m2: { label: "质量 m₂", unit: "M_☉", def: 30, min: 1, max: 100, step: 1 },
      f0: { label: "初始引力波频率 f₀", unit: "Hz", def: 35, min: 10, max: 100, step: 1 },
      kind: { label: "显示内容", type: "enum", options: ["啁啾波形", "轨道演化"], def: 0 }
    },
    plots: [
      { key: "h", label: "应变 h(t) = h₀cosΦ", color: "#5aa9ff" },
      { key: "hUpper", label: "解析包络 +h₀(t)", color: "#ffb84d", dash: "5 4" },
      { key: "hLower", label: "解析包络 −h₀(t)", color: "#ffb84d", dash: "5 4" },
      { key: "r", label: "分离距离 r（r_s，总质量）", color: "#63d6a5" },
      { key: "rkm", label: "分离距离 r（km）", color: "#5aa9ff" },
      { key: "orbit", label: "累计圈数 N_orb（转）", color: "#c792ea" }
    ],
    compute: function (p) {
      var kind = int(p.kind, 0, 1, 0);
      /* m → 0 的边界：m₁ = m₂ = 0 会让 M_c → 0、t_c → ∞，所以质量先夹到 ≥ 0.1 M_☉ */
      var m1 = num(p.m1, 0.1, 100, 30);
      var m2 = num(p.m2, 0.1, 100, 30);
      var f0 = num(p.f0, 1, 200, 35);
      var mc = chirpMass(m1, m2);                       // M_☉
      var mTot = m1 + m2;                               // M_☉
      var mcSec = G_C * mc * M_SUN / (C_LIGHT * C_LIGHT * C_LIGHT);                 // GM_c/c³（s）
      var tauC = Math.pow(mcSec, 5 / 3);                                            // (GM_c/c³)^{5/3}
      var tc = (5 / 256) / tauC * Math.pow(PI * f0, -8 / 3);                        // s
      var fIsco = C_LIGHT * C_LIGHT * C_LIGHT / (6 * Math.sqrt(6) * PI * G_C * mTot * M_SUN);
      var fc = Math.min(2 * fIsco, 2000);
      if (fc < f0) fc = f0;

      /* 采样点数：波形要分辨 2f₀（起点处最高的可分辨频率之一），点数随 t_c 走，夹在 [600, 20000] */
      var N = Math.round(tc * (2 * f0) * 12) + 600;
      N = Math.max(600, Math.min(20000, N));
      var tg = lin(0, tc, N);
      var h = [], hUp = [], hDn = [], fArr = [], rArr = [], rkmArr = [], orbArr = [];
      var phi0 = phaseAt(tauC, tc);                     // Φ(0) = 2(5GM_c/c³)^{−5/8} t_c^{5/8}
      var ampC = (4 / D_L_M) * Math.pow(mcSec * C_LIGHT, 5 / 3);   // h₀ = ampC·(πf/c)^{2/3}
      var nCycles = orbitsTo(tauC, tc);                 // 从 f₀ 一路到并合的累计圈数 = Φ(t_c)/(4π)
      var i, tau, f, phi, amp0, rSI;
      for (i = 0; i < N; i++) {
        tau = Math.max(1e-30, tc - tg[i]);              // τ = t_c − t
        f = fRel(tauC, tau);
        if (!isFinite(f) || f <= 0) f = f0;             // 兜底（理论上走不到）
        fArr.push(Math.min(f, fc));                     // f 本身也夹到 f_c（否则 f(t) 曲线上翘到 10^12 Hz）
        if (kind === 0) {
          phi = phi0 - phaseAt(tauC, tau);              // Φ(t) 单调增
          amp0 = ampC * Math.pow(PI * Math.min(f, fc) / C_LIGHT, 2 / 3);
          h.push(amp0 * Math.cos(phi));
          hUp.push(amp0);
          hDn.push(-amp0);
        } else {
          rSI = sepOf(mTot, tauC, tau);
          rArr.push(rSI / rsOf(mTot));
          rkmArr.push(rSI / 1000);
          orbArr.push(nCycles - orbitsTo(tauC, tau));   // 累计圈数：从 0 涨到 N_total（也可画"剩余圈数"）
        }
      }

      var peak = 0;
      for (i = 0; i < hUp.length; i++) if (hUp[i] > peak) peak = hUp[i];   // 峰值应变 = 包络最大值（在 f_c 处）
      var ampAtFc = ampC * Math.pow(PI * fc / C_LIGHT, 2 / 3);
      var r0 = sepOf(mTot, tauC, tc);

      var series, t, extra, lines = [], markers = [], mainInfo = [];
      if (kind === 0) {
        t = tg;
        series = { h: h, hUpper: hUp, hLower: hDn };
        lines.push({ x: tg, y: fArr, color: "#5aa9ff", label: "引力波频率 f(t)（Hz）" });
        lines.push({ x: [tg[0], tg[tg.length - 1]], y: [fIsco, fIsco], color: "#ff7b7b", dash: "4 4", label: "f_ISCO = " + fmt(fIsco, 4) + " Hz" });
        extra = {
          lines: lines, markers: markers,
          xlabel: "t (s)", ylabel: "f (Hz)",
          title: "频率演化 f(τ) ∝ τ^{−3/8}：最后 1/8 的时间里有 27% 的圈数，波形越到后面越密"
        };
      } else {
        t = tg;
        series = { r: rArr, rkm: rkmArr, orbit: orbArr };
        lines.push({ x: tg, y: fArr, color: "#5aa9ff", label: "引力波频率 f(t)（Hz）" });
        lines.push({ x: tg, y: orbArr, color: "#c792ea", label: "累计圈数 N_orb（转）" });
        extra = {
          lines: lines, markers: markers,
          xlabel: "t (s)", ylabel: "f (Hz) / N_orb",
          title: "轨道收缩 r ∝ (t_c − t)^{1/4}：越到最后收缩得越慢，可频率反而越高"
        };
      }

      mainInfo = [
        { k: "啁啾质量 M_c = (m₁m₂)^{3/5}/(m₁+m₂)^{1/5}", v: fmt(mc, 8) + " M_☉（30+30 → 26.116512 M_☉，契约值 26.12）" },
        { k: "总质量 / 对称质量比 η", v: fmt(mTot, 6) + " M_☉ / " + fmt(m1 * m2 / (mTot * mTot), 6) + "（η = m₁m₂/(m₁+m₂)²）" },
        { k: "并合时间 t_c = (5/256)(GM_c/c³)^{−5/3}(πf₀)^{−8/3}", v: fmt(tc, 8) + " s（f₀ = " + fmt(f0, 4) + " Hz）" },
        { k: "频率演化 df/dt = (96/5)π^{8/3}(GM_c/c³)^{5/3}f^{11/3}", v: "f₀ 处 " + fmt(fDotOf(mc, f0), 6) + " Hz/s；峰值频率 f_c = " + fmt(fc, 6) + " Hz" },
        { k: "ISCO 频率 f_ISCO = c³/(6√6πGM_tot)", v: fmt(fIsco, 6) + " Hz（GW150914 约 67 Hz）" },
        { k: "峰值应变（D_L = 100 Mpc，约定距离）", v: fmt(ampAtFc, 6) + "（量级 10⁻²¹ = LIGO 4 km 臂上 10⁻¹⁸ m 的位移）" },
        { k: "起始分离距离 r(t = 0)", v: fmt(r0 / 1000, 6) + " km = " + fmt(r0 / rsOf(mTot), 6) + " r_s（按总质量）" },
        { k: "从 f₀ 积到并合的累计圈数", v: fmt(nCycles, 6) + " 转（引力波周期数 = 2 倍 = " + fmt(2 * nCycles, 6) + "），总相位 Φ = " + fmt(phi0, 6) + " rad" },
        { k: "提醒", v: "牛顿级（四极）演化：τ → 0 时 f 与 h 形式发散；不含自旋/偏心/高阶 PN" }
      ];
      if (f0 >= fIsco) {
        mainInfo.push({ k: "注意", v: "f₀ = " + fmt(f0, 4) + " Hz ≥ f_ISCO = " + fmt(fIsco, 4) + " Hz：按四极公式并合几乎是瞬间的（t_c = " + fmt(tc, 6) + " s），真实系统此时已进入并合阶段" });
      }

      var metrics = {
        kind: kind, m1: m1, m2: m2, f0: f0, mc: mc, mTot: mTot, eta: m1 * m2 / (mTot * mTot),
        tc: tc, fIsco: fIsco, fc: fc, peak: peak, peakAtFc: ampAtFc,
        phi0: phi0, nCycles: nCycles, r0: r0,
        fArr: fArr,
        fDotAt: function (f) { return fDotOf(mc, f); },
        chirpIndep: function (a, b) {
          /* 独立算一遍（不复用 chirpMass 的实现）：M_c = m₁^{3/5}·m₂^{3/5}·(m₁+m₂)^{−1/5} */
          return Math.pow(a, 0.6) * Math.pow(b, 0.6) / Math.pow(a + b, 0.2);
        },
        tcAnalytic: function (f) { return (5 / 256) / tauC * Math.pow(PI * Math.max(f, 1e-9), -8 / 3); },
        fDotFormula: function (mcSun, f) { return fDotOf(mcSun, f); },
        phiAnalytic: function (tau) { return 2 * Math.pow(5 * tauC, -5 / 8) * Math.pow(Math.max(tau, 1e-30), 5 / 8); },
        sepAnalytic: function (tau) { return sepOf(mTot, tauC, tau); }
      };

      return { t: t, series: series, info: mainInfo, extra: extra, metrics: metrics };
    },
    tests: [
      { // ① 啁啾质量：30 + 30 M_☉ → 30^{3/5}·30^{3/5}·60^{−1/5} = 30·60^{−1/5} = 26.116517 M_☉
        name: "① 啁啾质量 M_c = (m₁m₂)^{3/5}/(m₁+m₂)^{1/5}：30+30 → 26.116512 M_☉（含 1e-6 相对容差）",
        params: { m1: 30, m2: 30, f0: 35, kind: 0 },
        measure: function (o) { return o.metrics.chirpIndep(30, 30); },
        expect: 26.116511895531827, tol: 2.6e-5 },
      { // ① M_c 对质量比敏感：10+90 M_☉（总质量同为 100）→ 10^{0.6}·90^{0.6}/100^{0.2} = 23.580093 M_☉
        //    （旧自检写 21.333990 —— 那是 64/3，与公式无关，算错了）
        name: "① 啁啾质量随质量比下降：10+90 → 23.580093 M_☉（总质量同为 100）",
        params: { m1: 10, m2: 90, f0: 35, kind: 0 },
        measure: function (o) { return o.metrics.mc; },
        expect: 23.580092567898681, tol: 2.4e-5 },
      { // ② df/dt 公式自洽：由 f(τ) = f_cτ^{−3/8} 得 −df/dτ = (3/8)f/τ，
        //    与 df/dt = (96/5)π^{8/3}(GM_c/c³)^{5/3}f^{11/3} 相对偏差 < 1e-9
        //    （τ 由解析反解 τ = t_c(f₀/f)^{8/3} 得到，f 取波形中点的瞬时频率）
        name: "② df/dt = (96/5)π^{8/3}(GM_c/c³)^{5/3}f^{11/3} 与 f(τ) 解析解自洽（相对偏差 < 1e-9）",
        params: { m1: 30, m2: 30, f0: 35, kind: 0 },
        measure: function (o) {
          var f = o.metrics.fArr[Math.floor(o.metrics.fArr.length * 0.5)];
          var tau = o.metrics.tc * Math.pow(o.metrics.f0 / f, 8 / 3);
          return Math.abs(o.metrics.fDotAt(f) - (3 / 8) * f / tau) / o.metrics.fDotAt(f);
        },
        expect: 0, tol: 1e-9 },
      { // ③ 并合时间绝对值：30+30、f₀ = 35 Hz
        //    t_c = (5/256)(GM_c/c³)^{−5/3}(π·35)^{−8/3}，GM_c/c³ = 26.116517×4.925490947×10⁻⁶ = 1.2863667×10⁻⁴ s
        //    ⇒ t_c = 0.2147208868 s（旧自检写 0.242371：与公式不符，算错了）
        name: "③ 并合时间 t_c = (5/256)(GM_c/c³)^{−5/3}(πf₀)^{−8/3}：30+30、35 Hz → 0.2147209 s",
        params: { m1: 30, m2: 30, f0: 35, kind: 0 },
        measure: function (o) { return o.metrics.tc; },
        expect: 0.21472088683404933, tol: 1e-12 },
      { // ③ t_c ∝ f₀^{−8/3}：f₀ = 35 Hz 与 70 Hz 之比 = 2^{8/3} = 6.349604207872798
        name: "③ t_c ∝ f₀^{−8/3}：f₀ = 35 与 70 Hz 之比 = 2^{8/3} = 6.3496042",
        params: { m1: 30, m2: 30, f0: 35, kind: 0 },
        measure: function (o) { return o.metrics.tcAnalytic(35) / o.metrics.tcAnalytic(70); },
        expect: 6.349604207872798, tol: 1e-12 },
      { // ③ 双对数斜率 = −8/3：ln[t_c(20)/t_c(40)]/ln2 = 8/3 = 2.6666666666666665
        name: "③ 并合时间的双对数斜率 = −8/3（ln[t_c(20)/t_c(40)]/ln2 = 2.6666667）",
        params: { m1: 30, m2: 30, f0: 20, kind: 0 },
        measure: function (o) { return Math.log(o.metrics.tcAnalytic(20) / o.metrics.tcAnalytic(40)) / Math.LN2; },
        expect: 2.6666666666666665, tol: 1e-12 },
      { // ③ t_c ∝ M_c^{−5/3}：等质量双星的 M_c = m/2^{1/5}，所以 30+30 与 10+10 的 M_c 之比恰为 3，
        //    并合时间之比应为 3^{5/3} = 6.2402515。
        //    ★ 这条自检曾经是**空转的**：measure 写成 tc/tcAnalytic(35)*3^{5/3}，而 tc 与 tcAnalytic(35)
        //      由同一公式算出，比值恒为 1，于是 measure 恒等于 expect，无论模型实现对不对都会通过。
        //      现在改成真正取另一个质量组态的 compute 结果来比，缩放律一旦被写错就会失败。
        name: "③ t_c ∝ M_c^{−5/3}：10+10 与 30+30 的并合时间之比 = 3^{5/3} = 6.2402515",
        params: { m1: 30, m2: 30, f0: 35, kind: 0 },
        measure: function (o) {
          var light = SIM.models["gravity-wave"].compute(
            SIM.paramsOf("gravity-wave", { m1: 10, m2: 10, f0: 35, kind: 0 }));
          return light.metrics.tc / o.metrics.tc;
        },
        expect: Math.pow(3, 5 / 3), tol: 1e-9 },
      { // ③ 由系列的横轴读出并合时间 = t_c（series 的 t 是 0 → t_c）
        name: "③ 系列横轴的末端 = t_c：t 从 0 到 0.2147209 s",
        params: { m1: 30, m2: 30, f0: 35, kind: 0 },
        measure: function (o) { return o.t[o.t.length - 1] - o.t[0]; },
        expect: 0.21472088683404933, tol: 1e-12 },
      { // ④ 同参数完全可重复：两次 compute 逐位相同（本模型不用随机数）
        name: "④ 同参数完全可重复：两次 compute 的 h(t) 逐位相同（最大偏差 = 0）",
        params: { m1: 30, m2: 30, f0: 35, kind: 0 },
        measure: function (o) {
          var o2 = global.SIM.run("gravity-wave", { m1: 30, m2: 30, f0: 35, kind: 0 });
          return maxAbsDiff(o.series.h, o2.series.h) + maxAbsDiff(o.t, o2.t);
        },
        expect: 0, tol: 0 },
      { // ④ 峰值应变 = 解析包络的最大值 = (4/D_L)(GM_c/c²)^{5/3}(πf_c/c)^{2/3}
        //    D_L = 100 Mpc ⇒ h_peak = 7.596374×10⁻²¹（旧实现的振幅少了 c^{5/3} 因子，只有 10⁻³⁵）
        name: "④ 峰值应变 = 包络 (4/D_L)(GM_c/c²)^{5/3}(πf_c/c)^{2/3}（相对偏差 < 1e-9）",
        params: { m1: 30, m2: 30, f0: 35, kind: 0 },
        measure: function (o) {
          var DL = 100 * 3.085677581e22;                                     // 100 Mpc
          var mcSec = o.metrics.mc * G_C * M_SUN / (C_LIGHT * C_LIGHT * C_LIGHT);
          var want = (4 / DL) * Math.pow(mcSec * C_LIGHT, 5 / 3) * Math.pow(PI * o.metrics.fc / C_LIGHT, 2 / 3);
          var up = o.series.hUpper, mx = 0, i;
          for (i = 0; i < up.length; i++) if (up[i] > mx) mx = up[i];
          return Math.abs(mx - want) / want;
        },
        expect: 0, tol: 1e-9 },
      { // ④ 振幅包络 ∝ τ^{−1/4}：h₀ ∝ min(f, f_c)^{2/3} ∝ τ^{−1/4}（在没被 f_c 夹住的区间里）
        //    τ = t_c 与 τ = t_c/16 之比 = 16^{1/4} = 2（均匀时间网格 ⇒ τ = t_c/16 在 t = 15/16·t_c 处，
        //    那里 f = 35×16^{3/8} = 98.76 Hz < f_c = 146.57 Hz，未饱和，才符合幂律）
        name: "④ 振幅包络 ∝ τ^{−1/4}：h₀(t_c)/h₀(t_c/16) = 16^{1/4} = 2",
        params: { m1: 30, m2: 30, f0: 35, kind: 0 },
        measure: function (o) {
          var up = o.series.hUpper, n = up.length;
          var iLate = n - 1 - Math.round((n - 1) / 16);
          return up[iLate] / up[0];
        },
        expect: 2, tol: 0.01 },
      { // ④ 频率单调增（啁啾的定义），起点 = f₀、终点 = f_c = 2f_ISCO（30+30 M_☉ ⇒ 146.57249 Hz）
        //    旧自检写 331.4 Hz —— 那对应总质量 ~26.5 M_☉，与 30+30 不符
        name: "④ 频率单调增：f(0) = f₀、f(t_c) = f_c = 2f_ISCO(60 M_☉) = 146.5724920 Hz",
        params: { m1: 30, m2: 30, f0: 35, kind: 0 },
        measure: function (o) {
          var f = o.metrics.fArr, d = 0, i;
          for (i = 1; i < f.length; i++) d = Math.max(d, f[i - 1] - f[i]);
          var ok = d <= 1e-9 && Math.abs(f[0] - 35) < 1e-6 && Math.abs(f[f.length - 1] - o.metrics.fc) / o.metrics.fc < 1e-9;
          return ok ? f[f.length - 1] : -1;
        },
        expect: 146.57249202122676, tol: 1e-6 },
      { // ⑤ 初始分离距离与开普勒定律自洽：r₀ = (4GM_tot/(2πf₀)²)^{1/3}（相对偏差 < 1e-12）
        name: "⑤ 初始分离距离与开普勒定律自洽：r₀ = (4GM_tot/(2πf₀)²)^{1/3}",
        params: { m1: 30, m2: 30, f0: 35, kind: 1 },
        measure: function (o) {
          var want = Math.pow(4 * G_C * o.metrics.mTot * M_SUN / Math.pow(2 * Math.PI * o.metrics.f0, 2), 1 / 3);
          return Math.abs(o.metrics.r0 - want) / want;
        },
        expect: 0, tol: 1e-12 },
      { // ⑤ 轨道收缩 r ∝ τ^{1/4}（开普勒 + 牛顿啁啾）：r(t_c)/r(t_c/16) = 16^{1/4} = 2
        name: "⑤ 轨道收缩 r ∝ (t_c − t)^{1/4}：r(t_c)/r(t_c/16) = 16^{1/4} = 2",
        params: { m1: 30, m2: 30, f0: 35, kind: 1 },
        measure: function (o) {
          var r = o.series.r, n = r.length;
          var iLate = n - 1 - Math.round((n - 1) / 16);
          return r[0] / r[iLate];
        },
        expect: 2, tol: 0.01 },
      { // ⑤ 累计圈数由 ∫f dt 现算：N_orb = Φ_GW(t_c)/(4π) = (1/64π)(π GM_c f₀/c³)^{−5/3}
        //    = 6.01218483 转（GW 周期数是它的 2 倍 = 12.024，与 GW150914 在 35 Hz 以上 ~10 圈相符）
        //    旧自检写死 4.9971 转，与公式不符
        name: "⑤ 累计圈数 N_orb = 6.0121848 转（30+30、35 Hz，由 ∫f dt 闭式现算）",
        params: { m1: 30, m2: 30, f0: 35, kind: 1 },
        measure: function (o) {
          var s = o.series.orbit, d = 0, i;
          for (i = 1; i < s.length; i++) d = Math.max(d, s[i - 1] - s[i]);   // 累计圈数必须单调不减
          return d <= 1e-12 ? s[s.length - 1] : -1;
        },
        expect: 6.0121848313533786, tol: 1e-9 },
      { // ⑥ 边界安全：m₁ = m₂ = 0（滑块给不到，但 config 可能写）+ f₀ = 100 Hz（t_c 极短）
        name: "⑥ 边界安全：m₁ = m₂ = 0、f₀ = 100 Hz（t_c 极短）无 NaN/±∞",
        params: { m1: 0, m2: 0, f0: 100, kind: 0 },
        measure: function (o) { return countBad(o) + (isFinite(o.metrics.tc) ? 0 : 1); },
        expect: 0, tol: 0 },
      { // ⑥ 边界安全：kind 1 + f₀ = 10 Hz（t_c ≈ 64.9 s，点数最多）+ 极端质量比 100+1
        name: "⑥ 边界安全：kind = 1、100+1 M_☉、f₀ = 10 Hz（t_c ≈ 64.9 s）无 NaN/±∞",
        params: { m1: 100, m2: 1, f0: 10, kind: 1 },
        measure: function (o) { return countBad(o); }, expect: 0, tol: 0 },
      { // ⑥ 边界安全：所有质量与频率取上限（f₀ = 100 Hz、100+100）
        name: "⑥ 边界安全：100+100 M_☉、f₀ = 100 Hz、kind = 0 无 NaN/±∞",
        params: { m1: 100, m2: 100, f0: 100, kind: 0 },
        measure: function (o) { return countBad(o); }, expect: 0, tol: 0 }
    ]
  });

  /* ====================================================================
     内部函数（纯函数、不碰 DOM；放在 register 之后便于顺序阅读）
     ==================================================================== */

  /** 单位圆折线（画视界/光子球/ISCO 参考圈用） */
  function circlePath(rad) {
    var xs = [], ys = [], a;
    for (a = 0; a <= 72; a++) {
      xs.push(rad * Math.cos(2 * PI * a / 72));
      ys.push(rad * Math.sin(2 * PI * a / 72));
    }
    return { x: xs, y: ys };
  }

  /** 零测地线偏折（强场精确）。b 单位 r_s。
   *
   *  由 (du/dφ)² = 1/b² − u² + r_s u³ 换元 v = b u 得 (dv/dφ)² = 1 − v² + (r_s/b)v³ =: F(v)，
   *  光子从 v = 0（无穷远）走到转折点 v₁（F 的最小正根 ∈ (1, 2/(3k))），扫过 φ = ∫₀^{v₁} dv/√F(v)，
   *  于是 Δφ = 2∫₀^{v₁} dv/√F(v) − π。b ≤ b_c = 3√3 M = 1.5√3 r_s 时 F 恒正、没有转折点 ⇒ 光子被捕获
   *  （这是**物理**发散，不是数值事故），求积里把 b 夹到略大于 b_c。
   *
   *  求积用换元 v = v₁ − s²（v ∈ [0, v₁] ⇔ s ∈ [0, √v₁]）做掉转折点的 1/√ 奇异：
   *  把 F 按 (v₁ − v) 做多项式除法（v₁ 是根 ⇒ 余项 = F(v₁) ≈ 0）得
   *      F(v₁ − s²) = s²·Q(s) + F(v₁)，   Q = −k v² + (1 − k v₁)v + v₁(1 − k v₁)，  v = v₁ − s²，k = 1/b
   *  于是 ∫₀^{v₁} dv/√F = ∫₀^{√v₁} 2 ds/√Q(s)，被积函数在 s = 0 处 → 2/√(2v₁ − 3kv₁²) 是**有限正数**，
   *  整段光滑、量级 O(1)：既没有 1/√ 奇异，也没有"两个相近大数相减"的相消 —— 所以
   *  b = R_☉/r_s ≈ 2.36×10^5（太阳表面）照样能算到 10^-14 相对精度（那里的偏折只有 1.75″，
   *  与弱场式 2r_s/b 差 6.25×10^-6 相对，正是二阶后牛顿项的 (15π/32)(r_s/b)）。
   *  Simpson 4000 段的相对误差 ~10^-14；与独立的高阶求积（40 万段）逐点对照过。 */
  function nullGeodesicDeflectionRad(bRs) {
    var b = Math.max(bRs, B_CRIT * 1.0005);        // 捕获区夹住（F 无实根）
    var k = 1 / b;
    /* 转折点 v₁：F(v) = 1 − v² + k v³ 在 (1, 2/(3k)) 上单调减、F(1) = k > 0 > F(2/(3k))，
       （b > b_c 时 F 的极小值 1 − 4b²/27 < 0），二分求唯一零点 */
    var lo = 1, hi = Math.max(1.5, 2 * b / 3), mv, it;
    for (it = 0; it < 80; it++) {
      mv = 0.5 * (lo + hi);
      if (1 - mv * mv + k * mv * mv * mv > 0) lo = mv; else hi = mv;
    }
    var v1 = isFinite(lo) && isFinite(hi) ? 0.5 * (lo + hi) : 1.5;
    var S = Math.sqrt(Math.max(0, v1));
    var cA = 1 - k * v1, cB = v1 * (1 - k * v1);   // Q(s) = −k v² + cA·v + cB
    var N = 4000, hh = S / N, sum = 0, i, s, v, Q, val;
    for (i = 0; i <= N; i++) {
      s = i * hh;
      v = v1 - s * s;
      Q = -k * v * v + cA * v + cB;
      val = 2 / Math.sqrt(Math.max(1e-300, Q));
      sum += (i === 0 || i === N) ? val : ((i % 2) ? 4 * val : 2 * val);
    }
    var defl = 2 * (sum * hh / 3) - PI;
    if (!isFinite(defl)) return PI;                // 安全网（理论上走不到）
    return defl < 0 ? 0 : defl;
  }

  /** 光线轨迹：零测地线 Binet 方程 d²u/dφ² = −u + (3/2)r_s u²（u = 1/r，u 单位 1/r_s）。
   *  从 r = 1/u₀ = 10⁴ r_s 射入，初值 du/dφ = +√(1/b² − u₀² + r_s u₀³)（b 单位 r_s）。
   *  返回 (x, y)，单位 r_s；被捕获（b < b_c）时 u 一直涨到视界，循环截断。 */
  function photonTrajectory(bRs) {
    var u0 = 1e-4, u00 = u0 * u0 * u0;
    var b = Math.max(bRs, B_CRIT * 1.0005);
    var dudp = Math.sqrt(Math.max(0, 1 / (b * b) - u0 * u0 + u00));
    var n = b < 8 ? 8000 : 4000;
    var res = rk4(function (phi, y) {
      void phi;
      return [y[1], -y[0] + 1.5 * y[0] * y[0]];
    }, [u0, dudp], 0, 2 * PI, n);
    var xs = [], ys = [], i, uu, pp, rr;
    for (i = 0; i < res.t.length; i++) {
      uu = res.y[0][i];
      if (!isFinite(uu) || uu <= 0) break;
      if (uu > 4) break;                           // 落进视界（r < 0.25 r_s）：截断
      pp = res.t[i];
      rr = 1 / uu;
      xs.push(rr * Math.cos(pp));
      ys.push(rr * Math.sin(pp));
      if (i > 4 && uu < u0) break;                 // 已出射到 r > 10⁴ r_s
    }
    return { x: xs, y: ys };
  }

  /** 精确每圈进动（rad）：椭圆积分闭式。U_a = r_s/r_a 远心点、U_p = r_s/r_p 近心点，
   *  U_3 = 1 − U_a − U_p 是三次式 U³ − U² + (2/b)U + C = 0 的第三根（Vieta：三根之和 = 1）。
   *  一个径向周期扫过
   *      Δφ = 2∫_{U_a}^{U_p} dU/√[(U−U_a)(U_p−U)(U_3−U)] = 4K(k)/√(U_3 − U_a)，
   *      k² = (U_p − U_a)/(U_3 − U_a)
   *  所以每圈进动 = Δφ − 2π。退化轨道（U_p = U_a）返回 0。 */
  function precExactRad(Ua, Up) {
    var U3 = 1 - Ua - Up;
    if (!(U3 > Up) || !(Up >= Ua)) return 0;
    var k2 = (Up - Ua) / (U3 - Ua);
    if (!(k2 > 0)) return 0;
    k2 = Math.min(k2, 1 - 1e-15);
    var dphi = 4 * ellipK(Math.sqrt(k2)) / Math.sqrt(U3 - Ua);
    return isFinite(dphi) ? dphi - 2 * PI : 0;
  }

  /** 强场束缚轨道（精确史瓦西，无自旋、无电荷）。
   *
   *  无量纲 Binet 方程（U = r_s/r，b = 半通径/r_s）：
   *      U″ = −U + 1/b + (3/2)U²
   *  首积分 U′² = C − U² + U³ + 2U/b，于是**转折点**是三次式
   *      U³ − U² + (2/b)U + C = 0      （Vieta：三根之和 = 1）
   *  的根。给定额定远心点 r_a（滑块 r）与 b，另两根由 Vieta 直接解出：
   *      U_a = r_s/r_a，  U_p + U_3 = 1 − U_a，  U_p·U_3 = 2/b − U_a(1 − U_a)
   *  有束缚轨道的充要条件是判别式 ≥ 0 且 U_p > U_a，等价于 r_a > r_c = (b/2)(1+√(1−6/b))
   *  （r_c 正是同一个 b 对应的**稳定圆轨道**半径 ⇒ "远心点必须落在圆轨道之外"）。
   *  滑块给出的组合不满足时夹到边界（退化轨道）：b ≤ 6 r_s（ISCO 以内）或 r_a ≤ r_c
   *  ⇒ 取圆轨道，轨迹是个圆、进动为 0，绝不产生 NaN。
   *
   *  每圈进动的**精确闭式**见 precExactRad（椭圆积分）；数值 RK4 解与它对照（见 tests ⑤），
   *  同时给出弱场一阶（1PN）值 6πGM/(a(1−e²)c²) = 3π r_s/p（p = 2r_p r_a/(r_p+r_a)）作对比 ——
   *  b = 22 r_s 处高阶修正让精确值比 1PN 大 ~13%，这正是"强场"要展示的东西。
   *
   *  轨迹：从远心点 (U_a, 0) 起积一个径向周期 Δφ = 2π，画 (r cosφ, r sinφ)（单位 r_s）。
   *  第二个远心点在 φ = 2π + Δω 处 ⇒ 首尾的缺口就是进动（轨道不闭合）。 */
  function orbitTrajectory(rRs, bRs) {
    var b = Math.max(bRs, 6 * (1 + 1e-9));      // b ≤ 6 r_s：没有稳定圆轨道 ⇒ 退化到 ISCO
    var d = Math.sqrt(Math.max(0, 1 - 6 / b));
    var Ulo = (1 - 2 * d) / 3;                  // 判别式 ≥ 0 的下界
    var Uhi = (1 - d) / 3;                      // U_a 的上界（= 1/r_c，圆轨道）
    var Ua = Math.min(Math.max(1 / Math.max(rRs, 1.0001), Ulo * (1 + 1e-9)), Uhi * (1 - 1e-9));
    var clamped = !(bRs > 6 && rRs > 0 && 1 / rRs < Uhi * (1 - 1e-9));
    var S = 1 - Ua, P = 2 / b - Ua * S;
    var disc = Math.max(0, S * S - 4 * P);
    var Up = 0.5 * (S - Math.sqrt(disc));       // 近心点（最大 U）
    if (!(Up > 0) || !isFinite(Up)) Up = Ua;
    var U3 = 1 - Ua - Up;
    var ra = 1 / Ua, rp = 1 / Math.max(Up, 1e-12);
    var e = (ra - rp) / (ra + rp);
    var pRs = 2 * rp * ra / (rp + ra);          // 半通径（椭圆定义：2 r_p r_a/(r_p+r_a)）
    var nStep = Math.round(1200 * Math.max(1, ra / Math.max(1, b))) + 6000;
    nStep = Math.max(6000, Math.min(20000, nStep));
    function f(phi, y) { void phi; return [y[1], -y[0] + 1 / b + 1.5 * y[0] * y[0]]; }
    var res = rk4(f, [Ua, 0], 0, 2 * PI, nStep);
    var xs = [], ys = [], uu, pp, i;
    for (i = 0; i < res.t.length; i++) {
      uu = res.y[0][i];
      if (!isFinite(uu) || uu <= 1e-9) break;
      pp = res.t[i];
      xs.push(Math.cos(pp) / uu);
      ys.push(Math.sin(pp) / uu);
    }
    /* 进动：再积到 6π，取前两个 U 极大（两个近心点）φ₁ < φ₂ ⇒ Δω = φ₂ − φ₁ − 2π。
       轨道对每个转折点对称 ⇒ 相邻近心点之间正好是一个径向周期 P = 2π + Δω。 */
    var n2 = Math.min(60000, nStep * 3);
    var res2 = rk4(f, [Ua, 0], 0, 6 * PI, n2);
    var maxPhi = [], hstep = res2.t.length > 1 ? res2.t[1] - res2.t[0] : 0;
    var y1, y2, y3, den, dl;
    for (i = 1; i < res2.t.length - 1 && maxPhi.length < 2; i++) {
      y1 = res2.y[0][i - 1]; y2 = res2.y[0][i]; y3 = res2.y[0][i + 1];
      if (!(y2 > y1 && y2 >= y3)) continue;
      den = y1 - 2 * y2 + y3;
      dl = Math.abs(den) > 1e-300 ? 0.5 * (y1 - y3) / den : 0;
      if (!isFinite(dl)) dl = 0;
      dl = Math.max(-1, Math.min(1, dl));
      maxPhi.push(res2.t[i] + dl * hstep);
    }
    var prec = maxPhi.length >= 2 ? maxPhi[1] - maxPhi[0] - 2 * PI : 0;
    if (!isFinite(prec)) prec = 0;
    return {
      x: xs, y: ys, b: b, e: e, rp: rp, ra: ra, Ua: Ua, Up: Up, U3: U3, pRs: pRs,
      precRad: prec, precExactRad: precExactRad(Ua, Up), prec1PNRad: 3 * PI / Math.max(1e-9, pRs),
      clamped: clamped,
      radiusAt: function (phi) {
        var k = Math.round((phi / (2 * PI)) * (res.t.length - 1));
        k = Math.max(0, Math.min(res.t.length - 1, k));
        var u = res.y[0][k];
        return isFinite(u) && u > 1e-9 ? 1 / u : 0;
      }
    };
  }

  /* ---------------------------------------------------- gravity-wave 公式 */
  /** 啁啾质量 M_c = (m₁m₂)^{3/5}/(m₁+m₂)^{1/5}（单位 M_☉） */
  function chirpMass(m1, m2) {
    var a = Math.max(m1, 1e-6), b = Math.max(m2, 1e-6);
    return Math.pow(a * b, 0.6) / Math.pow(a + b, 0.2);
  }
  /** (GM_c/c³)^{5/3}（s^{5/3}） */
  function tauOf(mcSun) {
    return Math.pow(G_C * mcSun * M_SUN / (C_LIGHT * C_LIGHT * C_LIGHT), 5 / 3);
  }
  /** df/dt = (96/5)π^{8/3}(GM_c/c³)^{5/3}f^{11/3}（Hz/s） */
  function fDotOf(mcSun, f) {
    return (96 / 5) * Math.pow(PI, 8 / 3) * tauOf(mcSun) * Math.pow(Math.max(f, 1e-9), 11 / 3);
  }
  /** 频率的解析解 f(τ) = (5/(256τC))^{3/8}π^{−1}τ^{−3/8}（τ = t_c − t，s） */
  function fRel(tauC, tau) {
    return Math.pow(5 / (256 * tauC), 3 / 8) / PI * Math.pow(Math.max(tau, 1e-30), -3 / 8);
  }
  /** 相位 Φ(τ) = 2(5GM_c/c³)^{−5/8}τ^{5/8} = ∫2πf dτ 的闭式解（τ 从 τ 积到并合）。
   *  ★ 参数 tauC 是 (GM_c/c³)^{5/3}，不是 GM_c/c³：所以 (5·tauC)^{−5/8} 要写成
   *  5^{−5/8}·tauC^{−3/8}，因为 tauC^{−3/8} = (GM_c/c³)^{−5/8}。
   *  与 fRel 自洽：dΦ/dτ = (5/4)5^{−5/8}tauC^{−3/8}τ^{−3/8} = 2π·fRel(τ)。 */
  function phaseAt(tauC, tau) {
    return 2 * Math.pow(5, -5 / 8) * Math.pow(tauC, -3 / 8) * Math.pow(Math.max(tau, 1e-30), 5 / 8);
  }
  /** 分离距离 r(τ) = (GM_tot/(2πf_orb)²)^{1/3}，f_orb = f_GW/2 = (4GM_tot/(2πf)²)^{1/3} */
  function sepOf(mTotSun, tauC, tau) {
    var f = fRel(tauC, tau);
    return Math.pow(4 * G_C * mTotSun * M_SUN / Math.pow(2 * PI * f, 2), 1 / 3);
  }
  /** 从 τ 到并合累计的轨道圈数 N_orb = Φ/(4π)（Φ 是引力波相位，圈数是它的一半） */
  function orbitsTo(tauC, tau) {
    return phaseAt(tauC, Math.max(tau, 1e-30)) / (4 * PI);
  }

})(typeof window !== "undefined" ? window : globalThis);
