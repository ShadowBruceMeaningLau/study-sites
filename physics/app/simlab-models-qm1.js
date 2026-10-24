/* ==========================================================================
   simlab-models-qm1.js —— 量子力学（一）仿真模型（6 个）

     wave-packet      高斯波包与色散：Δx·Δk = 1/2、群速 v_g = dω/dk、展宽 σ(t)
     infinite-well    一维无限深势阱：ψ_n、E_n = n²E₁、节点数、正交归一
     tunneling        方势垒隧穿：精确 T 公式（E<V₀ 与 E>V₀ 两支）、T + R = 1、
                      三区域波函数匹配、k′a = nπ 的共振透明
     qm-oscillator    量子谐振子：E_n = n + 1/2、厄米多项式波函数、Δx·Δp = n + 1/2
     spin-bloch       自旋与拉比振荡：P↑ = sin²(Ω_Rt/2)、广义拉比频率、布洛赫球轨迹
     hydrogen         氢原子：拉盖尔径向函数 R_nl、E_n = −13.6/n² eV、⟨r⟩、径向节点

   ★ 与 simlab.js 相同的约束：**加载时不触碰 DOM**——只在加载时调用 SIM.register，
     所有 DOM 操作由引擎在函数体内完成，这样 tools/verify-simlab.mjs 能在 Node 里
     用 window 桩直接跑 compute() 与 tests 做解析不变量自检。
   ★ 全部确定性：不使用任何随机数；任意滑块取值都不抛异常、不产生 NaN/Infinity
     （枚举下标、l ≤ n−1、E = V₀、大 κa、高阶厄米递推都做了夹取与退化处理）。
   ★ 每个 tests 的 expect 都是**解析值**（解析公式写在注释里），measure 尽量从返回的
     series / metrics 现算，而不是模型自报一个数。

   单位约定：
     · 波包、谐振子、拉比振荡用**归一化单位** ħ = m = ω = 1（可读性与数值稳定性最好），
       在各自的 legend / info 里写明；
     · 隧穿、氢原子回到 SI，常量取 app/constants.js 的 CODATA 2018 值（逐位一致，
       直接写在文件里——模型在 Node 里被单独加载，不能依赖 window.PHYSICS_CONSTANTS 已存在）。
   ========================================================================== */
(function (global) {
  "use strict";
  var SIM = global.SIM;
  if (!SIM) return;                       // 在 Node 里若未先加载 simlab.js，安静退出

  var lin = SIM.linspace, fmt = SIM.fmt, opt = SIM.opt;
  var PI = Math.PI;

  /* ------------------------------------------------------------ 物理常量
     CODATA 2018 / 2019 年 SI 定义值，与 app/constants.js 逐一对应：
       ħ = 1.054 571 817 × 10^-34 J·s        e = 1.602 176 634 × 10^-19 C
       m_e = 9.109 383 7015 × 10^-31 kg      a₀ = 5.291 772 109 03 × 10^-11 m
       E₁(氢基态) = −13.605 693 124 eV
     在 Node 的 verify-simlab 里 constants.js 不会被加载，所以必须自带。 */
  var H_BAR = 1.054571817e-34;            // ħ (J·s)
  var M_E = 9.1093837015e-31;             // 电子质量 (kg)
  var E_CHARGE = 1.602176634e-19;         // 基本电荷 (C)，eV → J
  var A_0 = 5.29177210903e-11;            // 玻尔半径 (m)
  var E_H_EV = -13.605693124;             // 氢原子基态能量 (eV)

  /* ------------------------------------------------------------- 通用工具 */
  /** 数值夹取（非有限值回落到默认值，保证任何输入都不产生 NaN） */
  function clampNum(v, lo, hi, dflt) {
    var x = Number(v);
    if (!isFinite(x)) x = dflt;
    if (x < lo) x = lo;
    if (x > hi) x = hi;
    return x;
  }
  /** 取整并夹到 [lo, hi]（枚举下标 / 量子数越界也不会崩） */
  function clampInt(v, lo, hi) {
    var n = Math.round(Number(v));
    if (!isFinite(n)) n = lo;
    return n < lo ? lo : (n > hi ? hi : n);
  }
  /** 最大值（忽略非有限值；全空时返回 0） */
  function maxOf(a) {
    var m = -Infinity, i, v;
    for (i = 0; i < a.length; i++) { v = a[i]; if (typeof v === "number" && isFinite(v) && v > m) m = v; }
    return m === -Infinity ? 0 : m;
  }
  /** 数组中最接近 x 的下标（空数组返回 0） */
  function nearestIndex(xs, x) {
    var best = 0, bd = Infinity, i, d;
    for (i = 0; i < xs.length; i++) { d = Math.abs(xs[i] - x); if (d < bd) { bd = d; best = i; } }
    return best;
  }
  /** 梯形法 ∫y dx（网格可以非均匀） */
  function trapz(xs, ys) {
    var s = 0, i, m = Math.min(xs.length, ys.length);
    for (i = 0; i < m - 1; i++) s += 0.5 * (ys[i] + ys[i + 1]) * (xs[i + 1] - xs[i]);
    return s;
  }
  /**
   * 复合辛普森法 ∫y dx（要求 xs 均匀；区间数取偶数）。
   * 对 sin²、多项式×高斯这类光滑被积函数，600 段的误差在 1e-14 量级
   * （见 infinite-well / qm-oscillator 的归一化自检）。
   */
  function simpson(xs, ys) {
    var m = Math.min(xs.length, ys.length), n, h, s = 0, i;
    if (m < 3) return 0;
    n = m - 1;
    if (n % 2) n -= 1;
    h = (xs[n] - xs[0]) / n;
    s = ys[0] + ys[n];
    for (i = 1; i < n; i++) s += ys[i] * (i % 2 ? 4 : 2);
    return (s * h) / 3;
  }
  /**
   * 数内部零点个数（符号变化）：|y| < eps·max|y| 的点视为落在零点上而跳过
   * （sin(nπx/L) 在节点处会得到 ~1e-16，不能当成一次符号变化）。
   */
  function countInteriorZeros(xs, ys) {
    var mx = 0, i, last = 0, zeros = 0, v;
    for (i = 0; i < ys.length; i++) { v = Math.abs(ys[i]); if (isFinite(v) && v > mx) mx = v; }
    if (!(mx > 0)) return 0;
    var eps = mx * 1e-9;
    for (i = 0; i < ys.length; i++) {
      v = ys[i];
      if (!isFinite(v) || Math.abs(v) < eps) continue;   // 跳过节点附近的点
      var sg = v > 0 ? 1 : -1;
      if (last !== 0 && sg !== last) zeros++;
      last = sg;
    }
    void xs;
    return zeros;
  }
  /** 三点抛物线细化峰值位置（网格步长之外再提高一档精度，误差 ~h²） */
  function refinePeak(xs, ys, i) {
    if (i <= 0 || i >= xs.length - 1) return xs[i];
    var x0 = xs[i - 1], x1 = xs[i], x2 = xs[i + 1];
    var y0 = ys[i - 1], y1 = ys[i], y2 = ys[i + 1];
    var den = (x0 - x1) * (x0 - x2) * (x1 - x2);
    if (!isFinite(den) || den === 0) return x1;
    var A = (x2 * (y1 - y0) + x1 * (y0 - y2) + x0 * (y2 - y1)) / den;
    var B = (x2 * x2 * (y0 - y1) + x1 * x1 * (y2 - y0) + x0 * x0 * (y1 - y2)) / den;
    if (!isFinite(A) || A === 0) return x1;
    var xp = -B / (2 * A);
    var lo = Math.min(x0, x2), hi = Math.max(x0, x2);
    return xp < lo ? lo : (xp > hi ? hi : xp);
  }
  /** 下标最大处的下标 */
  function argmaxIndex(ys) {
    var k = 0, i;
    for (i = 1; i < ys.length; i++) if (ys[i] > ys[k]) k = i;
    return k;
  }

  /* ==========================================================================
     1. wave-packet —— 高斯波包与色散（归一化单位 ħ = m = 1）

     ψ(x, 0) = (2πa²)^{−1/4} e^{−x²/(4a²)} e^{ik₀x}，a = 1/(2σ)
       |ψ(x,0)|² ∝ e^{−x²/(2a²)} ⇒ Δx = a；k 空间 |φ(k)|² ∝ e^{−2a²(k−k₀)²} ⇒ Δk = 1/(2a) = σ
       ⇒ **Δx·Δk = 1/2**（高斯波包是最小不确定态）

     自由演化 ω(k) = k²/2 有闭式解：
       ψ(x,t) = (2πa²)^{−1/4}(1 + iτ)^{−1/2} exp[−(x−k₀t)²/(4a²(1+iτ))]·e^{i(k₀x − k₀²t/2)}，τ = t/(2a²)
       |ψ(x,t)|² = N(x̄, σx)：x̄ = k₀t（群速 v_g = dω/dk|k₀ = k₀），σx² = a² + t²/(4a²)
       ⇒ Δx(t)·Δk = √(1/4 + σ⁴t²) ≥ 1/2，且随 t 单调增大（色散展宽）

     「无色散」对照支：把 ω(k) 换成线性 ω = k₀k（群速同为 k₀，但没有 k 依赖的相速）
       ⇒ ψ(x,t) = ψ(x − k₀t, 0)：包络刚性平移，Δx 与 t 无关。
     ========================================================================== */
  var WP_KINDS = ["自由粒子（色散）", "无色散"];
  var WP_NX = 801;                 // |ψ|² 的采样点数
  var WP_SPAN = 9;                 // 窗口取 ±9σx（高斯尾部已到 1e-18）

  /** 波包特征量：a = Δx(0)、σx(t)、中心 x̄、Δk = σ */
  function wpPack(kind, k0, sg, t) {
    var a = 1 / (2 * sg);
    var spread = (kind === 0) ? (t * t) / (4 * a * a) : 0;
    return { a: a, sg: sg, sx: Math.sqrt(a * a + spread), xc: k0 * t, k0: k0, kind: kind, t: t };
  }
  /** |ψ(x,t)|² 的采样：严格高斯 N(x̄, σx) */
  function wpOut(kind, k0, sg, t) {
    var pk = wpPack(kind, k0, sg, t);
    var W = WP_SPAN * pk.sx;
    var xs = [], ys = [], i, x, d;
    var nrm = 1 / (Math.sqrt(2 * PI) * pk.sx);
    for (i = 0; i < WP_NX; i++) {
      x = pk.xc - W + (2 * W * i) / (WP_NX - 1);
      d = x - pk.xc;
      xs.push(x);
      ys.push(nrm * Math.exp(-(d * d) / (2 * pk.sx * pk.sx)));
    }
    return { x: xs, y: ys, pk: pk };
  }
  /**
   * 精确复波函数 ψ(x,t)，返回 [Re, Im]。
   *   kind = 0：上面的闭式解（1 + iτ 用极坐标形式算，避免复数运算）
   *   kind = 1：ψ(x − k₀t, 0)
   */
  function wpPsi(kind, k0, sg, t, x) {
    var a = 1 / (2 * sg), d = x - k0 * t;
    if (kind === 1) {
      var amp1 = Math.pow(2 * PI * a * a, -0.25) * Math.exp(-(d * d) / (4 * a * a));
      var ph1 = k0 * d;
      return [amp1 * Math.cos(ph1), amp1 * Math.sin(ph1)];
    }
    var tau = t / (2 * a * a), den = 1 + tau * tau;
    var amp = Math.pow(2 * PI * a * a, -0.25) / Math.pow(den, 0.25);
    /* −d²/(4a²(1+iτ)) = −d²(1−iτ)/(4a²(1+τ²)) ⇒ 模 e^{−d²/(4a²(1+τ²))}，相位 +d²τ/(4a²(1+τ²)) */
    var mag = Math.exp(-(d * d) / (4 * a * a * den));
    var ph = -0.5 * Math.atan2(tau, 1) + (d * d * tau) / (4 * a * a * den) + k0 * x - 0.5 * k0 * k0 * t;
    return [amp * mag * Math.cos(ph), amp * mag * Math.sin(ph)];
  }
  /** 从采样现算 {归一化, 质心, 方差}（梯形法；二阶矩必须对被积函数 x²P 用梯形，不能用中点） */
  function wpMoments(xs, ys) {
    var n = ys.length, p1 = [], p2 = [], i, x, a, mean;
    for (i = 0; i < n; i++) { x = xs[i]; p1.push(x * ys[i]); p2.push(x * x * ys[i]); }
    a = trapz(xs, ys);
    if (!(Math.abs(a) > 0)) return { norm: 0, mean: 0, var: 0 };
    mean = trapz(xs, p1) / a;
    return { norm: a, mean: mean, var: Math.max(0, trapz(xs, p2) / a - mean * mean) };
  }

  SIM.register("wave-packet", {
    title: "高斯波包与色散",
    legend: "归一化单位 ħ = m = 1：ω = k²/2（自由粒子）或 ω = k₀k（无色散对照）。"
      + "Δx·Δk 恒 ≥ 1/2，t = 0 时取等号；色散支的包络按 σx = √(a² + t²/(4a²)) 展宽，"
      + "无色散支只是整体平移（波形不变）。",
    axes: { xlabel: "x（ħ = m = 1）", ylabel: "|ψ(x, t)|²" },
    params: {
      k0: { label: "中心波数 k₀", unit: "", def: 5, min: 1, max: 20, step: 0.1 },
      sigma: { label: "宽度 Δk = σ", unit: "", def: 1, min: 0.3, max: 5, step: 0.05 },
      t: { label: "时间 t", unit: "", def: 0, min: 0, max: 5, step: 0.02 },
      kind: { label: "色散关系 ω(k)", type: "enum", options: WP_KINDS, def: 0 }
    },
    plots: [
      { key: "prob", label: "|ψ(x, t)|²", color: "#5aa9ff" }
    ],
    compute: function (p) {
      var kind = clampInt(p.kind, 0, 1);
      var k0 = clampNum(p.k0, 1, 20, 5);
      var sg = clampNum(p.sigma, 0.3, 5, 1);
      var t = clampNum(p.t, 0, 5, 0);
      var o = wpOut(kind, k0, sg, t);
      var m = wpMoments(o.x, o.y);
      var dx = Math.sqrt(Math.max(0, m.var));
      var dxdk = dx * sg;

      /* extra：波函数实部 + ±|ψ| 包络（同一横轴，各自一条曲线） */
      var re = [], env = [], i, ps;
      for (i = 0; i < o.x.length; i++) {
        ps = wpPsi(kind, k0, sg, t, o.x[i]);
        re.push(ps[0]);
        env.push(Math.sqrt(ps[0] * ps[0] + ps[1] * ps[1]));
      }
      var negEnv = [], j;
      for (j = 0; j < env.length; j++) negEnv.push(-env[j]);

      return {
        t: o.x,
        series: { prob: o.y },
        info: [
          { k: "色散关系", v: opt(WP_KINDS, kind) + "（ω = k²/2 或 ω = k₀k）" },
          { k: "Δx（数值二阶矩）", v: fmt(dx, 6) + "　解析 σx = " + fmt(o.pk.sx, 6) },
          { k: "Δk = σ", v: fmt(sg, 6) },
          { k: "Δx·Δk", v: fmt(dxdk, 6) + "（≥ 1/2；t = 0 取等号 √(1/4 + σ⁴t²)）" },
          { k: "群速 v_g = dω/dk|k₀", v: fmt(k0, 6) + "　（包络中心 x̄ = " + fmt(m.mean, 4) + " = k₀t）" },
          { k: "峰值 |ψ|²", v: fmt(maxOf(o.y), 6) + "　归一化 ∫|ψ|²dx = " + fmt(m.norm, 6) },
          { k: "t = 0 时的 Δx = a = 1/(2σ)", v: fmt(o.pk.a, 6) }
        ],
        extra: {
          lines: [
            { x: o.x, y: re, label: "Re ψ(x, t)", color: "#ffb84d" },
            { x: o.x, y: env, label: "±|ψ| 包络", color: "#63d6a5", dash: "4 3" },
            { x: o.x, y: negEnv, color: "#63d6a5", dash: "4 3" }
          ],
          xlabel: "x", ylabel: "Re ψ",
          title: "波函数实部与包络（|ψ|² 的高斯形状由 ±|ψ| 给出）"
        },
        metrics: { kind: kind, k0: k0, sigma: sg, t: t, a: o.pk.a, sx: o.pk.sx, xc: o.pk.xc, dx: dx, dk: sg, dxdk: dxdk, norm: m.norm, mean: m.mean }
      };
    },
    tests: [
      /* ① Δx·Δk = 1/2：t = 0 时 |ψ|² 是标准差 a = 1/(2σ) 的高斯，
            而 Δk = 1/(2a) = σ ⇒ Δx·Δk = 1/2（数值二阶矩由 series 现算） */
      { name: "Δx·Δk = 1/2（t = 0 的最小不确定高斯波包）", params: { kind: 0, t: 0, sigma: 1 },
        measure: function (o, p) {
          var m = wpMoments(o.t, o.series.prob);
          return Math.sqrt(Math.max(0, m.var)) * p.sigma;
        }, expect: 0.5, tol: 1e-6 },
      /* ② Δx·Δk = √(1/4 + σ⁴t²) ≥ 1/2 恒成立（扫 t、σ、k₀） */
      { name: "Δx·Δk ≥ 1/2 恒成立（扫 t、σ、k₀）", params: {},
        measure: function () {
          var ts = [0, 0.5, 1, 2, 3, 5], sgs = [0.3, 1, 2, 5], k0s = [1, 5, 20];
          var i, j, k, ok = true, o, m, v;
          for (i = 0; i < ts.length; i++) {
            for (j = 0; j < sgs.length; j++) {
              for (k = 0; k < k0s.length; k++) {
                o = wpOut(0, k0s[k], sgs[j], ts[i]);
                m = wpMoments(o.x, o.y);
                v = Math.sqrt(Math.max(0, m.var)) * sgs[j];
                if (!(v >= 0.5 - 1e-9)) ok = false;
              }
            }
          }
          return ok ? 1 : 0;
        }, expect: 1, tol: 0 },
      /* ③ 无色散（ω = k₀k ⇒ ψ(x,t) = ψ(x−k₀t,0)）：Δx 与 t 无关 */
      { name: "无色散时 Δx 不随 t 变（刚性平移，容差 1e-6）", params: { kind: 1, sigma: 1 },
        measure: function (o, p) {
          var ts = [0, 1, 2, 3, 5], i, m, worst = 0, a, v;
          void o;
          a = 1 / (2 * p.sigma);
          for (i = 0; i < ts.length; i++) {
            m = wpOut(1, 5, p.sigma, ts[i]);
            v = Math.abs(Math.sqrt(Math.max(0, wpMoments(m.x, m.y).var)) - a);
            if (v > worst) worst = v;
          }
          return worst;
        }, expect: 0, tol: 1e-6 },
      /* ④ 色散时 Δx = √(a² + t²/(4a²)) 随 t 单调增大 */
      { name: "色散时 Δx 随 t 单调增大", params: { kind: 0, sigma: 1 },
        measure: function (o, p) {
          var ts = [0, 0.5, 1, 2, 3, 5], i, m, prev = -1, ok = true, v;
          void o;
          for (i = 0; i < ts.length; i++) {
            m = wpOut(0, 5, p.sigma, ts[i]);
            v = Math.sqrt(Math.max(0, wpMoments(m.x, m.y).var));
            if (!(v > prev)) ok = false;
            prev = v;
          }
          return ok ? 1 : 0;
        }, expect: 1, tol: 0 },
      /* ⑤ 群速 v_g = dω/dk|k₀ = k₀（ħ = m = 1）：包络中心 x̄(t) = k₀t
            ⇒ 数值质心 / t = k₀ */
      { name: "群速 v_g = k₀（数值质心 x̄/t = k₀，容差 1e-6）", params: { kind: 0, t: 2, k0: 5 },
        measure: function (o, p) {
          var m = wpMoments(o.t, o.series.prob);
          return m.mean / p.t;
        }, expect: 5, tol: 1e-6 },
      /* ⑥ 精确解满足自由粒子薛定谔方程 iψ_t = −ψ_xx/2（二阶中心差分相对残差） */
      { name: "精确解代回 iψ_t = −ψ_xx/2（相对残差 < 1e-3）", params: { kind: 0, k0: 5, sigma: 1, t: 1 },
        measure: function (o, p) {
          var hx = 1e-3, ht = 1e-4, worst = 0, i, x, a, b, c, tt, xx;
          for (i = 2; i < o.t.length - 2; i += 7) {
            x = o.t[i];
            a = wpPsi(0, p.k0, p.sigma, p.t + ht, x);
            b = wpPsi(0, p.k0, p.sigma, p.t - ht, x);
            c = wpPsi(0, p.k0, p.sigma, p.t, x + hx);
            tt = wpPsi(0, p.k0, p.sigma, p.t, x - hx);
            xx = wpPsi(0, p.k0, p.sigma, p.t, x);
            var tr = (a[0] - b[0]) / (2 * ht), ti = (a[1] - b[1]) / (2 * ht);        // ψ_t
            var xr = (c[0] - 2 * xx[0] + tt[0]) / (hx * hx);                        // ψ_xx
            var xi = (c[1] - 2 * xx[1] + tt[1]) / (hx * hx);
            /* iψ_t + ½ψ_xx 的两个分量 */
            var r1 = -ti + 0.5 * xr, r2 = tr + 0.5 * xi;
            var den = Math.max(Math.sqrt(tr * tr + ti * ti), 0.5 * Math.sqrt(xr * xr + xi * xi), 1e-12);
            var res = Math.sqrt(r1 * r1 + r2 * r2) / den;
            if (res > worst) worst = res;
          }
          return worst;
        }, expect: 0, tol: 1e-3 }
    ]
  });

  /* ==========================================================================
     2. infinite-well —— 一维无限深势阱（归一化单位 ħ = m = 1）

     ψ_n(x, t) = √(2/L)·sin(nπx/L)·cos(E_n t)，E_n = n²π²ħ²/(2mL²) = n²π²/(2L²)
       · 边界 ψ(0) = ψ(L) = 0；节点数 = n − 1；|ψ|² = (2/L)sin²(nπx/L) 与 t 无关
       · 正交归一 ∫₀^L ψ_mψ_n dx = δ_{mn}
       · E_n = n²E₁，E₁ = π²ħ²/(2mL²)（ħ = m = L = 1 时 = π²/2 = 4.9348022005）
     时间因子只贡献一个整体相位 e^{−iE_nt}，所以概率分布不随时间变化（定态）。
     ========================================================================== */
  var IW_NX = 601;

  /** E_n = n²π²/(2L²)（ħ = m = 1） */
  function iwEnergy(n, L) { return (n * n * PI * PI) / (2 * L * L); }
  /** ψ_n(x, t) = √(2/L)sin(nπx/L)cos(E_n t) */
  function iwPsi(n, L, t, x) {
    return Math.sqrt(2 / L) * Math.sin((n * PI * x) / L) * Math.cos(iwEnergy(n, L) * t);
  }
  /** 均匀网格上的 ψ_n 与 |ψ_n|² */
  function iwOut(n, L, t) {
    var xs = lin(0, L, IW_NX), psi = [], prob = [], i, x, s;
    for (i = 0; i < IW_NX; i++) {
      x = xs[i];
      s = Math.sin((n * PI * x) / L);
      psi.push(iwPsi(n, L, t, x));
      prob.push((2 / L) * s * s);
    }
    return { x: xs, psi: psi, prob: prob };
  }

  SIM.register("infinite-well", {
    title: "一维无限深势阱",
    legend: "归一化单位 ħ = m = 1：E_n = n²π²/(2L²)，ψ_n = √(2/L)·sin(nπx/L)。"
      + "节点数 = n − 1；能级按 n² 拉开；概率分布是定态、不随时间变化。",
    axes: { xlabel: "x（阱宽 L）", ylabel: "ψ_n(x, t) ／ |ψ_n|²" },
    params: {
      n: { label: "能级 n", unit: "", def: 1, min: 1, max: 6, step: 1 },
      L: { label: "阱宽 L", unit: "", def: 1, min: 0.5, max: 3, step: 0.05 },
      t: { label: "时刻 t", unit: "", def: 0, min: 0, max: 5, step: 0.02 }
    },
    plots: [
      { key: "psi", label: "ψ_n(x, t)", color: "#5aa9ff" },
      { key: "prob", label: "|ψ_n|²", color: "#ffb84d" }
    ],
    compute: function (p) {
      var n = clampInt(p.n, 1, 6);
      var L = clampNum(p.L, 0.5, 3, 1);
      var t = clampNum(p.t, 0, 5, 0);
      var o = iwOut(n, L, t);
      var E1 = iwEnergy(1, L), En = iwEnergy(n, L);
      var nodes = countInteriorZeros(o.x, o.psi);
      var norm = simpson(o.x, o.prob);

      /* extra：能级阶梯（每级画成 [0, E_k] 的水平线段，当前级高亮） */
      var lines = [], k, Ek;
      for (k = 1; k <= 6; k++) {
        Ek = iwEnergy(k, L);
        lines.push({
          x: [0, Ek], y: [Ek, Ek], color: k === n ? "#ff7b7b" : "#5aa9ff",
          label: k === n ? "E" + k + "（当前，n = " + n + "）" : ""
        });
      }
      return {
        t: o.x,
        series: { psi: o.psi, prob: o.prob },
        info: [
          { k: "E_n = n²π²ħ²/(2mL²)", v: fmt(En, 6) + "（ħ = m = 1，n = " + n + "，L = " + fmt(L, 4) + "）" },
          { k: "E₁ = π²ħ²/(2mL²)", v: fmt(E1, 6) + "　E_n/E₁ = " + fmt(En / E1, 6) + " = n² = " + (n * n) },
          { k: "节点数（阱内）", v: nodes + " = n − 1 = " + (n - 1) },
          { k: "归一化 ∫|ψ|²dx", v: fmt(norm, 9) + "（辛普森法，精确到机器精度）" },
          { k: "ψ(0)、ψ(L)", v: fmt(o.psi[0], 12) + "、"+ fmt(o.psi[IW_NX - 1], 12) + "（边界条件）" },
          { k: "定态性质", v: "|ψ|² = (2/L)sin²(nπx/L) 与 t 无关（时间只贡献整体相位 e^(−iE_nt)）" }
        ],
        extra: {
          lines: lines,
          xlabel: "能量（ħ = m = 1）", ylabel: "能级",
          title: "能级阶梯：E_n = n²E₁（间距按 2n+1 拉开）"
        },
        metrics: { n: n, L: L, t: t, E1: E1, En: En, nodes: nodes, norm: norm }
      };
    },
    tests: [
      /* ① E₁ = π²ħ²/(2mL²)（ħ = m = L = 1 ⇒ π²/2 = 4.9348022005447） */
      { name: "E₁ = π²ħ²/(2mL²) = π²/2 = 4.9348022（L = 1，容差 1e-9）", params: { n: 1, L: 1 },
        measure: function (o) { return o.metrics.E1; }, expect: 4.9348022, tol: 1e-9 },
      /* ② E_n = n²E₁（n = 1…6，E₁ = π²ħ²/(2mL²)） */
      { name: "E_n = n²E₁（n = 1…6，容差 1e-9）", params: { n: 1, L: 1 },
        measure: function (o) {
          var n, worst = 0, v;
          for (n = 1; n <= 6; n++) {
            v = Math.abs(iwEnergy(n, o.metrics.L) - n * n * o.metrics.E1);
            if (v > worst) worst = v;
          }
          return worst;
        }, expect: 0, tol: 1e-9 },
      /* ③ ψ(0) = ψ(L) = 0（sin0 = 0、sin(nπ) = 0；n ≤ 6 时 |sin(nπ)| ≈ 1e-15） */
      { name: "边界条件 ψ(0) = ψ(L) = 0（容差 1e-12）", params: { n: 6, L: 1, t: 0.3 },
        measure: function (o) {
          var v = o.series.psi;
          return Math.abs(v[0]) + Math.abs(v[v.length - 1]);
        }, expect: 0, tol: 1e-12 },
      /* ④ 节点数 = n − 1（从 series.psi 数符号变化） */
      { name: "节点数 = n − 1（n = 1…6，从 ψ 曲线现算）", params: { L: 1, t: 0 },
        measure: function (o) {
          var n, worst = 0, v, k;
          for (n = 1; n <= 6; n++) {
            k = iwOut(n, o.metrics.L, 0);
            v = Math.abs(countInteriorZeros(k.x, k.psi) - (n - 1));
            if (v > worst) worst = v;
          }
          return worst;
        }, expect: 0, tol: 0 },
      /* ⑤ 归一化 ∫|ψ_n|²dx = 1（辛普森法，600 段；sin² 是低阶三角多项式，误差 ~1e-15） */
      { name: "归一化 ∫|ψ_n|²dx = 1（辛普森法，n = 1…6，容差 1e-9）", params: { L: 1 },
        measure: function (o) {
          var n, worst = 0, v, k;
          for (n = 1; n <= 6; n++) {
            k = iwOut(n, o.metrics.L, 0);
            v = Math.abs(simpson(k.x, k.prob) - 1);
            if (v > worst) worst = v;
          }
          return worst;
        }, expect: 0, tol: 1e-9 },
      /* ⑥ 正交性 ∫ψ_mψ_n dx = 0（m ≠ n，同一 L，辛普森法） */
      { name: "正交性 ∫ψ_mψ_n dx = 0（m ≠ n，容差 1e-9）", params: { L: 1 },
        measure: function (o) {
          var m, n, worst = 0, v, km, kn, i, prod;
          for (m = 1; m <= 6; m++) {
            for (n = 1; n <= 6; n++) {
              if (m === n) continue;
              km = iwOut(m, o.metrics.L, 0);
              kn = iwOut(n, o.metrics.L, 0);
              prod = [];
              for (i = 0; i < km.psi.length; i++) prod.push(km.psi[i] * kn.psi[i]);
              v = Math.abs(simpson(km.x, prod));
              if (v > worst) worst = v;
            }
          }
          return worst;
        }, expect: 0, tol: 1e-9 }
    ]
  });

  /* ==========================================================================
     3. tunneling —— 方势垒（宽 a、高 V₀）隧穿

     精确透射系数（平面波、单势垒）：
       E < V₀：T = 1/(1 + V₀²sinh²(κa)/(4E(V₀−E)))，κ = √(2m(V₀−E))/ħ
       E > V₀：T = 1/(1 + V₀²sin²(k′a)/(4E(E−V₀)))，k′ = √(2m(E−V₀))/ħ
     等价改写（数值稳定，E → V₀ 不再是 0/0）：
       V₀²sinh²(κa)/(4E(V₀−E)) = (mV₀²a²/(2ħ²E))·[sinh(κa)/(κa)]²  ≡ pre·s²
       E = V₀ 时两支同时退化到 pre·1 ⇒ T = 1/(1 + mV₀a²/(2ħ²E))（左右极限相同）

     反射系数由三区域波函数匹配现算（入射振幅取 1）：
       ψ_I = e^{ikx} + r e^{−ikx}（x<0）；ψ_II = A e^{κx} + B e^{−κx}（0<x<a）；
       ψ_III = t e^{ik(x−a)}（x>a）
       匹配给出 t = 2/(2C + iS(1/q − q))、r = t(C − iqS) − 1（E<V₀，q = k/κ，C = coshκa，S = sinhκa；
       E>V₀ 把 C→cos k′a、S→i sin k′a、q→k/(ik′)），于是 |r|² = R = 1 − T。
     共振：k′a = nπ ⇒ sin = 0 ⇒ T = 1（势垒对德布罗意波"透明"）。
     ========================================================================== */
  var TN_NX = 400;                 // T(E) 扫描点数

  /** 势垒的 T、R 与匹配系数（全部 SI：E、V0 单位 J，a 单位 m） */
  function tunCoeff(E, V0, a) {
    var k = Math.sqrt(2 * M_E * E) / H_BAR;
    var pre = (M_E * V0 * V0 * a * a) / (2 * E * H_BAR * H_BAR);      // mV₀²a²/(2ħ²E)
    var d = E - V0, rel = Math.abs(d) / Math.max(E, V0, 1e-300);
    var T, R, kap = 0, kp = 0, tr, rr, A = { re: 0, im: 0 }, B = { re: 0, im: 0 }, lim = false;
    var dr, di, dd, S, C, q, one;

    if (rel < 1e-12) {
      /* E = V₀：两支的公共极限（κ→0 与 k′→0 给出同一个式子） */
      lim = true;
      T = 1 / (1 + pre);
      dd = 4 + k * k * a * a;
      tr = { re: 4 / dd, im: (-2 * k * a) / dd };                     // t = 2/(2 − ika)
      rr = { re: tr.re - tr.im * k * a - 1, im: tr.im + tr.re * k * a };  // r = t(1 − ika) − 1
      R = rr.re * rr.re + rr.im * rr.im;
    } else if (d < 0) {
      kap = Math.sqrt(2 * M_E * (V0 - E)) / H_BAR;
      q = k / kap;
      var ka = kap * a;
      S = Math.sinh(ka);
      C = Math.cosh(ka);
      one = (ka < 1e-6) ? 1 : S / ka;                                 // sinh(κa)/(κa)
      T = 1 / (1 + pre * one * one);
      dr = 2 * C;
      di = S * (1 / q - q);
      dd = dr * dr + di * di;
      tr = { re: (2 * dr) / dd, im: (-2 * di) / dd };
      rr = { re: tr.re * C + tr.im * q * S - 1, im: tr.im * C - tr.re * q * S };
      R = rr.re * rr.re + rr.im * rr.im;
      A = { re: ((tr.re - tr.im * q) / 2) * Math.exp(-ka), im: ((tr.im + tr.re * q) / 2) * Math.exp(-ka) };
      B = { re: ((tr.re + tr.im * q) / 2) * Math.exp(ka), im: ((tr.im - tr.re * q) / 2) * Math.exp(ka) };
    } else {
      kp = Math.sqrt(2 * M_E * (E - V0)) / H_BAR;
      q = k / kp;
      var ka2 = kp * a;
      S = Math.sin(ka2);
      C = Math.cos(ka2);
      one = (ka2 < 1e-6) ? 1 : S / ka2;                               // sin(k′a)/(k′a)
      T = 1 / (1 + pre * one * one);
      dr = 2 * C;
      di = (ka2 < 1e-6) ? -(k * a) : -(q + 1 / q) * S;                // (q+1/q)sin(k′a) → ka（避免 ∞·0）
      dd = dr * dr + di * di;
      tr = { re: (2 * dr) / dd, im: (-2 * di) / dd };
      rr = { re: tr.re * C + tr.im * q * S - 1, im: tr.im * C - tr.re * q * S };
      R = rr.re * rr.re + rr.im * rr.im;
      /* 势垒内系数：A e^{ik′a} = t(1+q)/2、B e^{−ik′a} = t(1−q)/2
         （q 很大时 A、B 各自很大，只用它们的组合检验匹配，绘图另走稳定形式） */
      var ar = tr.re * (1 + q), ai = tr.im * (1 + q);
      var br = tr.re * (1 - q), bi = tr.im * (1 - q);
      A = { re: (ar * C + ai * S) / 2, im: (ai * C - ar * S) / 2 };
      B = { re: (br * C - bi * S) / 2, im: (bi * C + br * S) / 2 };
    }
    return { T: T, R: R, k: k, kap: kap, kp: kp, t: tr, r: rr, A: A, B: B, limit: lim };
  }
  /* 复数小工具（ES5 写法，专供下面的匹配残差用） */
  function cAdd(x, y) { return { re: x.re + y.re, im: x.im + y.im }; }
  function cSub(x, y) { return { re: x.re - y.re, im: x.im - y.im }; }
  function cMul(x, y) { return { re: x.re * y.re - x.im * y.im, im: x.re * y.im + x.im * y.re }; }
  function cMod(x) { return Math.sqrt(x.re * x.re + x.im * x.im); }
  /**
   * 三区域匹配的四条条件（x = 0 与 x = a 处 ψ 与 ψ′ 连续）的归一化残差：
   *   ψ_I = e^{ikx} + r e^{−ikx}；ψ_II = A e^{w x} + B e^{−w x}；ψ_III = t e^{ik(x−a)}
   *   （E < V₀：w = κ；E > V₀：w = ik′。）
   * 返回 max|残差| / 公共尺度，尺度取 max(1, |A|, |B|, k|t|)——q = k/k′ 很大时 A、B 本身
   * 很大（两者之差的组合才有物理意义），所以用相对残差。
   */
  function tunMatch(E, V0, a) {
    var c = tunCoeff(E, V0, a), A = c.A, B = c.B, t = c.t, r = c.r, k = c.k;
    if (c.limit) return 0;                        // E = V₀ 时 A、B 发散，残差改用稳定形式另测
    var psiI0 = { re: 1 + r.re, im: r.im };
    var dpsiI0 = { re: k * r.im, im: k * (1 - r.re) };             // ψ_I′(0) = ik(1 − r)
    var psiII0, dpsiII0, psiIIa, dpsiIIa, wantA, wantD;
    var C, S, ch, sh, w;
    if (c.kap > 0) {
      w = c.kap;
      ch = Math.cosh(w * a);
      sh = Math.sinh(w * a);
      psiII0 = cAdd(A, B);
      dpsiII0 = { re: w * (A.re - B.re), im: w * (A.im - B.im) };
      psiIIa = cAdd({ re: A.re * (ch + sh), im: A.im * (ch + sh) }, { re: B.re * (ch - sh), im: B.im * (ch - sh) });
      dpsiIIa = { re: w * (A.re * (ch + sh) - B.re * (ch - sh)), im: w * (A.im * (ch + sh) - B.im * (ch - sh)) };
    } else {
      w = c.kp;
      C = Math.cos(w * a);
      S = Math.sin(w * a);
      psiII0 = cAdd(A, B);
      dpsiII0 = { re: -w * (A.im - B.im), im: w * (A.re - B.re) };
      psiIIa = cAdd(cMul(A, { re: C, im: S }), cMul(B, { re: C, im: -S }));
      dpsiIIa = cMul({ re: 0, im: w }, cSub(cMul(A, { re: C, im: S }), cMul(B, { re: C, im: -S })));
    }
    wantA = t;                                                     // ψ_II(a) = t
    wantD = { re: -k * t.im, im: k * t.re };                       // ψ_II′(a) = ik t
    var sc = Math.max(1, cMod(A), cMod(B), k * cMod(t));
    var res = cMod(cSub(psiI0, psiII0)) + cMod(cSub(dpsiI0, dpsiII0))
      + cMod(cSub(psiIIa, wantA)) + cMod(cSub(dpsiIIa, wantD));
    return res / sc;
  }
  /** 三区域波函数的曲线（x 用 nm，方便与 a 的量级对照） */
  function tunWave(E, V0, a, c) {
    var aNm = a * 1e9;
    var lamNm = (2 * PI) / c.k * 1e9;                  // 波长 (nm)
    var W = Math.max(2 * aNm, 2.5 * lamNm);            // 两侧各画多宽
    var NI = 181, NII = 61, NIII = 181;
    var xsI = [], xsII = [], xsIII = [], rI = [], rII = [], rIII = [], i, x, xm, ph, cs, sn, ch, sh, q, sc;
    for (i = 0; i < NI; i++) {
      x = (-W * (NI - 1 - i)) / (NI - 1);              // 从 −W 到 0（nm）
      xm = x * 1e-9;
      cs = Math.cos(c.k * xm);
      sn = Math.sin(c.k * xm);
      /* Re[e^{ikx} + r e^{−ikx}] = (1 + Re r)cos kx + (Im r) sin kx */
      xsI.push(x);
      rI.push(cs + c.r.re * cs + c.r.im * sn);
    }
    /* 区域 II 用**稳定形式**（A、B 在 k′→0 时各自发散，两者之差才有意义）：
         E < V₀：ψ_II(x) = t·[cosh(κ(x−a)) + i q sinh(κ(x−a))]，q = k/κ
         E > V₀：ψ_II(x) = t·[cos φ + i k(x−a)·sin φ/φ]，φ = k′(x−a)
         E = V₀：两式同时退化为 t·[1 + i k(x−a)]（κ = k′ = 0），不会出现 ∞·0。 */
    for (i = 0; i < NII; i++) {
      x = (a * i) / (NII - 1);
      xsII.push(x * 1e9);
      if (c.kap > 0) {
        q = c.k / c.kap;
        sh = Math.sinh(c.kap * (x - a));
        ch = Math.cosh(c.kap * (x - a));
        rII.push(c.t.re * ch - c.t.im * q * sh);
      } else {
        ph = c.kp * (x - a);
        sc = (Math.abs(ph) < 1e-8) ? 1 : Math.sin(ph) / ph;
        rII.push(c.t.re * Math.cos(ph) - c.t.im * c.k * (x - a) * sc);
      }
    }
    for (i = 0; i < NIII; i++) {
      x = a + (W * i) / (NIII - 1) * 1e-9;
      xsIII.push(x * 1e9);
      ph = c.k * (x - a);
      rIII.push(c.t.re * Math.cos(ph) - c.t.im * Math.sin(ph));
    }
    return {
      lines: [
        { x: xsI, y: rI, label: "区域 I：入射 + 反射", color: "#5aa9ff" },
        { x: xsII, y: rII, label: "区域 II：势垒内（|ψ| 按 e^(−κx) 衰减）", color: "#ff7b7b" },
        { x: xsIII, y: rIII, label: "区域 III：透射（振幅 √T）", color: "#63d6a5" }
      ]
    };
  }

  SIM.register("tunneling", {
    title: "方势垒隧穿",
    legend: "电子（m_e）入射到宽 a(nm)、高 V₀(eV) 的方势垒。主图是 T(E) 与 R(E)："
      + "E < V₀ 时 T 按 e^(−2κa) 量级衰减，E > V₀ 时 T 在 k′a = nπ 处出现 T = 1 的共振透明；"
      + "两条曲线处处满足 T + R = 1。第二张图给 T(a)，下方给三个区域的波函数（入射振幅取 1）。",
    axes: { xlabel: "入射能量 E (eV)", ylabel: "T、R" },
    params: {
      E: { label: "入射能量 E", unit: "eV", def: 5, min: 0.1, max: 20, step: 0.05 },
      V0: { label: "势垒高度 V₀", unit: "eV", def: 10, min: 0.1, max: 20, step: 0.1 },
      a: { label: "势垒宽度 a", unit: "nm", def: 0.5, min: 0.05, max: 2, step: 0.01 }
    },
    plots: [
      { key: "T_E", label: "透射系数 T(E)", color: "#5aa9ff" },
      { key: "R_E", label: "反射系数 R(E) = 1 − T", color: "#ff7b7b" }
    ],
    compute: function (p) {
      var EeV = clampNum(p.E, 0.1, 20, 5);
      var V0eV = clampNum(p.V0, 0.1, 20, 10);
      var aNm = clampNum(p.a, 0.05, 2, 0.5);
      var a = aNm * 1e-9;
      var E = EeV * E_CHARGE, V0 = V0eV * E_CHARGE;
      var c = tunCoeff(E, V0, a);

      /* 主图：T(E)、R(E) 沿能量扫描（范围取滑块的完整量程） */
      var NE = TN_NX, Es = lin(0.05, 20, NE), TE = [], RE = [], i, e, ci;
      for (i = 0; i < NE; i++) {
        e = Es[i] * E_CHARGE;
        ci = tunCoeff(e, V0, a);
        TE.push(ci.T);
        RE.push(ci.R);
      }
      /* 第二张图：固定 E，T 随 a 变化 */
      var Na = 300, as = lin(0.05, 2, Na), Ta = [];
      for (i = 0; i < Na; i++) Ta.push(tunCoeff(E, V0, as[i] * 1e-9).T);

      var kapInv = c.kap > 0 ? 1 / c.kap : Infinity;
      var Er1 = V0eV + (PI * PI * H_BAR * H_BAR) / (2 * M_E * a * a) / E_CHARGE;   // 第一共振能量 (eV)
      var wf = tunWave(E, V0, a, c);

      return {
        t: Es,
        series: { T_E: TE, R_E: RE },
        info: [
          { k: "透射系数 T", v: fmt(c.T, 6) + "（E = " + fmt(EeV, 4) + " eV，V₀ = " + fmt(V0eV, 4) + " eV，a = " + fmt(aNm, 4) + " nm）" },
          { k: "反射系数 R = |r|²", v: fmt(c.R, 6) + "　T + R = " + fmt(c.T + c.R, 12) },
          { k: c.kap > 0 ? "衰减长度 κ⁻¹" : "势垒内波数 k′", v: c.kap > 0
            ? fmt(kapInv, 6) + " m（κ = " + fmt(c.kap, 6) + " m⁻¹，κa = " + fmt(c.kap * a, 4) + "）"
            : fmt(c.kp, 6) + " m⁻¹（E > V₀，势垒内是行波）" },
          { k: "共振（T = 1）条件", v: "E > V₀ 时 k′a = nπ ⇒ E_n = V₀ + n²π²ħ²/(2ma²)；第一条在 " + fmt(Er1, 4) + " eV" },
          { k: "入射波数 k", v: fmt(c.k, 6) + " m⁻¹（波长 " + fmt((2 * PI) / c.k * 1e9, 4) + " nm，与 a 同量级才有明显隧穿）" },
          { k: "本轮扫描", v: "T(E) 共 " + NE + " 点、E ∈ [0.05, 20] eV；T(a) 共 " + Na + " 点、a ∈ [0.05, 2] nm" }
        ],
        extra: {
          lines: wf.lines,
          xlabel: "x (nm)", ylabel: "Re ψ（入射振幅 = 1）",
          title: "三个区域的波函数（区域 II 的指数衰减就是隧穿的来源）"
        },
        series2: [{
          x: as,
          series: [{ label: "T(a)，E = " + fmt(EeV, 4) + " eV", y: Ta, color: "#63d6a5" }],
          xlabel: "势垒宽度 a (nm)", ylabel: "透射系数 T"
        }],
        metrics: {
          E: E, V0: V0, a: a, EeV: EeV, V0eV: V0eV, aNm: aNm,
          T: c.T, R: c.R, k: c.k, kap: c.kap, kp: c.kp,
          kappaInv: isFinite(kapInv) ? kapInv : 0, Er1: Er1, limit: c.limit,
          tre: c.t.re, tim: c.t.im, rre: c.r.re, rim: c.r.im,
          Are: c.A.re, Aim: c.A.im, Bre: c.B.re, Bim: c.B.im,
          Eres: V0eV + (PI * PI * H_BAR * H_BAR) / (2 * M_E * a * a) / E_CHARGE
        }
      };
    },
    tests: [
      /* ① T + R = 1：T 来自解析公式、R 来自波函数匹配的 |r|²，两条独立路径必须一致 */
      { name: "T + R = 1（E < V₀，容差 1e-12）", params: { E: 5, V0: 10, a: 0.5 },
        measure: function (o, p) {
          var c = tunCoeff(p.E * E_CHARGE, p.V0 * E_CHARGE, p.a * 1e-9);
          return Math.abs(c.T + c.R - 1);
        }, expect: 0, tol: 1e-12 },
      { name: "T + R = 1（E > V₀，容差 1e-12）", params: { E: 15, V0: 10, a: 0.5 },
        measure: function (o, p) {
          var c = tunCoeff(p.E * E_CHARGE, p.V0 * E_CHARGE, p.a * 1e-9);
          return Math.abs(c.T + c.R - 1);
        }, expect: 0, tol: 1e-12 },
      { name: "整条 T(E) 曲线上 T + R = 1（逐点，容差 1e-12）", params: { V0: 10, a: 0.5 },
        measure: function (o) {
          var i, worst = 0, v;
          for (i = 0; i < o.series.T_E.length; i++) {
            v = Math.abs(o.series.T_E[i] + o.series.R_E[i] - 1);
            if (v > worst) worst = v;
          }
          return worst;
        }, expect: 0, tol: 1e-12 },
      /* ② E < V₀：T = 1/(1 + V₀²sinh²(κa)/(4E(V₀−E)))，κ = √(2m(V₀−E))/ħ
            （自检里用教科书写法直接重算，与模型的等价改写逐点比对） */
      { name: "E < V₀ 时 T = 1/(1 + V₀²sinh²(κa)/(4E(V₀−E)))（逐点容差 1e-12）", params: { V0: 10, a: 0.5 },
        measure: function (o, p) {
          var V0 = p.V0 * E_CHARGE, aM = p.a * 1e-9, i, e, kap, si, want, v, worst = 0;
          for (i = 0; i < o.series.T_E.length; i++) {
            e = o.t[i] * E_CHARGE;
            if (!(e < V0 * 0.999)) continue;
            kap = Math.sqrt(2 * M_E * (V0 - e)) / H_BAR;
            si = 1 + (V0 * V0 * Math.sinh(kap * aM) * Math.sinh(kap * aM)) / (4 * e * (V0 - e));
            want = 1 / si;
            v = Math.abs(o.series.T_E[i] - want);
            if (v > worst) worst = v;
          }
          return worst;
        }, expect: 0, tol: 1e-12 },
      /* ③ E > V₀：把 sinh 换成 sin、κ 换成 k′ */
      { name: "E > V₀ 时 T = 1/(1 + V₀²sin²(k′a)/(4E(E−V₀)))（逐点容差 1e-12）", params: { V0: 10, a: 0.5 },
        measure: function (o, p) {
          var V0 = p.V0 * E_CHARGE, aM = p.a * 1e-9, i, e, kp, si, want, v, worst = 0;
          for (i = 0; i < o.series.T_E.length; i++) {
            e = o.t[i] * E_CHARGE;
            if (!(e > V0 * 1.001)) continue;
            kp = Math.sqrt(2 * M_E * (e - V0)) / H_BAR;
            si = 1 + (V0 * V0 * Math.sin(kp * aM) * Math.sin(kp * aM)) / (4 * e * (e - V0));
            want = 1 / si;
            v = Math.abs(o.series.T_E[i] - want);
            if (v > worst) worst = v;
          }
          return worst;
        }, expect: 0, tol: 1e-12 },
      /* ④ E < V₀ 时 T 随 a 单调下降（sinh(κa) 随 a 增大） */
      { name: "E < V₀ 时 T 随 a 单调下降", params: { E: 5, V0: 10 },
        measure: function (o, p) {
          var i, prev = Infinity, ok = true, v;
          void o;
          for (i = 0; i <= 40; i++) {
            v = tunCoeff(p.E * E_CHARGE, p.V0 * E_CHARGE, (0.05 + i * 0.04875) * 1e-9).T;
            if (!(v < prev)) ok = false;
            prev = v;
          }
          return ok ? 1 : 0;
        }, expect: 1, tol: 0 },
      /* ⑤ 共振透明：k′a = π ⇒ sin(k′a) = 0 ⇒ T = 1（解析共振能量 E = V₀ + π²ħ²/(2ma²)） */
      { name: "共振透明：E = V₀ + π²ħ²/(2ma²) 时 T = 1（容差 1e-9）", params: { V0: 10, a: 0.5 },
        measure: function (o, p) {
          var aM = p.a * 1e-9, V0 = p.V0 * E_CHARGE;
          var Er = V0 + (PI * PI * H_BAR * H_BAR) / (2 * M_E * aM * aM);
          return tunCoeff(Er, V0, aM).T;
        }, expect: 1, tol: 1e-9 },
      { name: "T(E) 曲线上出现 T ≥ 0.999 的共振峰（扫描范围含共振）", params: { V0: 10, a: 0.5 },
        measure: function (o) { return maxOf(o.series.T_E); }, expect: 1, tol: 1e-3 },
      /* ⑥ E = V₀ 的退化点：两支公式给出同一极限 T = 1/(1 + mV₀a²/(2ħ²E))，且连续 */
      { name: "E → V₀ 两侧极限相同且等于 1/(1 + mV₀a²/(2ħ²E))（a = 0.1 nm ⇒ 0.6038）",
        params: { V0: 10, a: 0.1 },
        measure: function (o, p) {
          var aM = p.a * 1e-9, V0 = p.V0 * E_CHARGE;
          var lim = 1 / (1 + (M_E * V0 * aM * aM) / (2 * H_BAR * H_BAR));
          var lo = tunCoeff(V0 * (1 - 1e-9), V0, aM).T, hi = tunCoeff(V0 * (1 + 1e-9), V0, aM).T;
          var mid = tunCoeff(V0, V0, aM).T;
          void o;
          return Math.max(Math.abs(lo - mid), Math.abs(hi - mid), Math.abs(mid - lim));
        }, expect: 0, tol: 1e-9 },
      { name: "薄势垒在 E = V₀ 处仍然透明：T > 0.5（a = 0.1 nm ⇒ 0.603802）", params: { V0: 10, a: 0.1 },
        measure: function (o, p) { void o; return tunCoeff(p.V0 * E_CHARGE, p.V0 * E_CHARGE, p.a * 1e-9).T; },
        expect: 0.603802, tol: 1e-6 },
      /* ⑦ 三区域波函数在 x = 0 与 x = a 处的四条匹配条件（ψ 与 ψ′ 各自连续） */
      { name: "匹配条件全部成立（E < V₀：ψ、ψ′ 在 x = 0、a 连续，容差 1e-9）", params: { E: 5, V0: 10, a: 0.5 },
        measure: function (o, p) { void o; return tunMatch(p.E * E_CHARGE, p.V0 * E_CHARGE, p.a * 1e-9); },
        expect: 0, tol: 1e-9 },
      { name: "匹配条件全部成立（E > V₀：ψ、ψ′ 在 x = 0、a 连续，容差 1e-9）", params: { E: 15, V0: 10, a: 0.5 },
        measure: function (o, p) { void o; return tunMatch(p.E * E_CHARGE, p.V0 * E_CHARGE, p.a * 1e-9); },
        expect: 0, tol: 1e-9 }
    ]
  });

  /* ==========================================================================
     4. qm-oscillator —— 一维量子谐振子（归一化单位 ħ = m = ω = 1）

     ψ_n(x) = (1/√(2ⁿn!√π))·H_n(x)·e^{−x²/2}，H 用三项递推 H_{n+1} = 2xH_n − 2nH_{n−1}
       · E_n = n + 1/2（等间距 1，零点能 1/2）
       · 节点数 = n；Δx·Δp = n + 1/2（ħ = 1）：⟨x²⟩ = ⟨p²⟩ = n + 1/2
       · n ≤ 6、|x| ≤ 10 时 H_n 最大约 6.4×10⁷，递推不会溢出
     ========================================================================== */
  var QO_NX = 601;

  /** 厄米多项式 H_n(x)（三项递推；n ≤ 6 时数值完全安全） */
  function qoHermite(n, x) {
    var h0 = 1, h1 = 2 * x, i, h2;
    if (n <= 0) return h0;
    if (n === 1) return h1;
    for (i = 1; i < n; i++) { h2 = 2 * x * h1 - 2 * i * h0; h0 = h1; h1 = h2; }
    return h1;
  }
  function qoFact(n) { var r = 1, i; for (i = 2; i <= n; i++) r *= i; return r; }
  /** ψ_n(x) */
  function qoPsi(n, x) {
    var c = 1 / Math.sqrt(Math.pow(2, n) * qoFact(n) * Math.sqrt(PI));
    return c * qoHermite(n, x) * Math.exp(-(x * x) / 2);
  }
  /** ψ′_n(x) = [2nH_{n−1}(x) − xH_n(x)]·归一化因子·e^{−x²/2}（用 dH_n/dx = 2nH_{n−1}） */
  function qoDpsi(n, x) {
    var c = 1 / Math.sqrt(Math.pow(2, n) * qoFact(n) * Math.sqrt(PI));
    return c * (2 * n * qoHermite(n - 1, x) - x * qoHermite(n, x)) * Math.exp(-(x * x) / 2);
  }

  SIM.register("qm-oscillator", {
    title: "量子谐振子",
    legend: "归一化单位 ħ = m = ω = 1：E_n = n + 1/2（等间距 1，零点能 1/2），"
      + "ψ_n ∝ H_n(x)e^(−x²/2)。节点数 = n；不确定度乘积 Δx·Δp = n + 1/2（基态取最小值 1/2）。",
    axes: { xlabel: "x（ħ = m = ω = 1）", ylabel: "ψ_n(x) ／ |ψ_n|²" },
    params: {
      n: { label: "能级 n", unit: "", def: 0, min: 0, max: 6, step: 1 },
      xmax: { label: "横轴范围 ±xmax", unit: "", def: 6, min: 1, max: 10, step: 0.5 }
    },
    plots: [
      { key: "psi", label: "ψ_n(x)", color: "#5aa9ff" },
      { key: "prob", label: "|ψ_n(x)|²", color: "#ffb84d" }
    ],
    compute: function (p) {
      var n = clampInt(p.n, 0, 6);
      var xmax = clampNum(p.xmax, 1, 10, 6);
      var xs = lin(-xmax, xmax, QO_NX), psi = [], prob = [], i, x;
      for (i = 0; i < QO_NX; i++) {
        x = xs[i];
        psi.push(qoPsi(n, x));
        prob.push(psi[i] * psi[i]);
      }
      var norm = simpson(xs, prob);
      var den = maxOf(prob) > 0 ? maxOf(prob) : 1;
      var nodes = countInteriorZeros(xs, psi);

      /* extra：等间距能级阶梯 */
      var lines = [], k, Ek;
      for (k = 0; k <= 6; k++) {
        Ek = k + 0.5;
        lines.push({
          x: [0, Ek], y: [Ek, Ek], color: k === n ? "#ff7b7b" : "#5aa9ff",
          label: k === n ? "E" + k + " = " + fmt(Ek, 2) + "（当前）" : ""
        });
      }
      return {
        t: xs,
        series: { psi: psi, prob: prob },
        info: [
          { k: "E_n = n + 1/2（ħω = 1）", v: fmt(n + 0.5, 6) + "　零点能 E₀ = " + fmt(0.5, 6) },
          { k: "能级间距", v: "E_{n+1} − E_n = 1（等间距，量子谐振子的特征）" },
          { k: "节点数", v: nodes + " = n = " + n },
          { k: "∫|ψ_n|²dx（±" + fmt(xmax, 2) + " 内）", v: fmt(norm, 9) + (xmax < 8 ? "（截断域：n 大时尾部被切掉）" : "") },
          { k: "⟨x²⟩（数值二阶矩）", v: fmt(simpson(xs, xs.map(function (x, i2) { return x * x * prob[i2]; })) / (norm || 1), 6) + "　解析 n + 1/2 = " + fmt(n + 0.5, 2) },
          { k: "经典转折点 x_t = √(2n+1)", v: fmt(Math.sqrt(2 * n + 1), 6) + "（|ψ|² 在它附近开始快速衰减）" },
          { k: "峰值 |ψ|²", v: fmt(den, 6) }
        ],
        extra: {
          lines: lines,
          xlabel: "能量（ħω = 1）", ylabel: "能级",
          title: "能级阶梯：E_n = n + 1/2，间距恒为 1（与无限深势阱的 n² 拉开对照）"
        },
        metrics: { n: n, xmax: xmax, En: n + 0.5, nodes: nodes, norm: norm }
      };
    },
    tests: [
      /* ① E_n = n + 1/2（ħω = 1，容差 1e-12）；能级等间距 1 */
      { name: "E_n = n + 1/2（n = 0…6，容差 1e-12）", params: { n: 3 },
        measure: function (o) { return o.metrics.En - (o.metrics.n + 0.5); }, expect: 0, tol: 1e-12 },
      /* 能级等间距：从**模型自己的输出**取 E_{n+1} − E_n。
         ★ 这条自检曾经是**空转的**：measure 完全不碰 o，只在循环变量上做恒等式
           ((n+1)+0.5)−(n+0.5)−1 ≡ 0，恒返回 0 再与 expect 0 比，永远通过
           （变异测试实测：把 compute 换成返回 {} 的空壳，7 条里仍有 4 条通过，包括这条）。
           现在改成对相邻两个量子数各跑一次 compute，用真实读数相减。 */
      { name: "能级等间距：E_{n+1} − E_n = 1（n = 0…5，逐对从模型输出取，容差 1e-12）",
        params: { n: 0 },
        measure: function (o) {
          var m = SIM.models["qm-oscillator"], worst = 0, k, a, b, d;
          for (k = 0; k < 6; k++) {
            a = m.compute(SIM.paramsOf("qm-oscillator", { n: k + 1, xmax: 6 }));
            b = m.compute(SIM.paramsOf("qm-oscillator", { n: k, xmax: 6 }));
            d = Math.abs((a.metrics.En - b.metrics.En) - 1);
            if (d > worst) worst = d;
          }
          return worst;
        }, expect: 0, tol: 1e-12 },
      /* ② 基态 ψ₀ ∝ e^{−x²/2}：ψ₀ = π^{−1/4}e^{−x²/2} */
      { name: "基态 ψ₀ = π^(−1/4)e^(−x²/2)（整条曲线，相对容差 1e-9）", params: { n: 0, xmax: 6 },
        measure: function (o) {
          var i, x, want, worst = 0, v, mx = maxOf(o.series.psi.map(function (y) { return Math.abs(y); }));
          for (i = 0; i < o.t.length; i++) {
            x = o.t[i];
            want = Math.pow(PI, -0.25) * Math.exp(-(x * x) / 2);
            v = Math.abs(o.series.psi[i] - want) / (mx || 1);
            if (v > worst) worst = v;
          }
          return worst;
        }, expect: 0, tol: 1e-9 },
      /* ③ 节点数 = n（n = 0…6，从 ψ 曲线现算） */
      { name: "节点数 = n（n = 0…6）", params: { xmax: 8 },
        measure: function (o) {
          var n, i, xs = lin(-o.metrics.xmax, o.metrics.xmax, QO_NX), ys, worst = 0, v;
          for (n = 0; n <= 6; n++) {
            ys = [];
            for (i = 0; i < xs.length; i++) ys.push(qoPsi(n, xs[i]));
            v = Math.abs(countInteriorZeros(xs, ys) - n);
            if (v > worst) worst = v;
          }
          return worst;
        }, expect: 0, tol: 0 },
      /* ④ 归一化 ∫|ψ_n|²dx = 1（辛普森法）。
            域取 ±8：n = 6 的尾部在 |x| > 8 外只剩 ~1e-15；
            默认 xmax = 6 时 n = 6 的截断误差约 3×10⁻⁹，所以自检取 xmax = 8。 */
      { name: "归一化 ∫|ψ_n|²dx = 1（±8 内，n = 0…6，容差 1e-9）", params: { xmax: 8 },
        measure: function (o) {
          var n, i, xs = lin(-8, 8, QO_NX), ys, worst = 0, v;
          for (n = 0; n <= 6; n++) {
            ys = [];
            for (i = 0; i < xs.length; i++) ys.push(qoPsi(n, xs[i]) * qoPsi(n, xs[i]));
            v = Math.abs(simpson(xs, ys) - 1);
            if (v > worst) worst = v;
          }
          void o;
          return worst;
        }, expect: 0, tol: 1e-9 },
      /* ⑤ Δx·Δp = n + 1/2（ħ = 1）：⟨x²⟩ = ⟨p²⟩ = n + 1/2，
            ⟨p²⟩ = ∫|ψ′|²dx（实波函数分部积分），两者都从曲线上现算 */
      { name: "Δx·Δp = n + 1/2（ħ = 1，n = 0…6，容差 1e-6）", params: { xmax: 8 },
        measure: function (o) {
          var n, i, xs = lin(-8, 8, QO_NX), p, d, x2, p2, worst = 0, v, dx, dp;
          void o;
          for (n = 0; n <= 6; n++) {
            p = []; d = []; x2 = []; p2 = [];
            for (i = 0; i < xs.length; i++) {
              p.push(qoPsi(n, xs[i]) * qoPsi(n, xs[i]));
              d.push(qoDpsi(n, xs[i]) * qoDpsi(n, xs[i]));
              x2.push(xs[i] * xs[i] * p[i]);
            }
            var nn = simpson(xs, p);
            dx = Math.sqrt(Math.max(0, simpson(xs, x2) / nn));
            dp = Math.sqrt(Math.max(0, simpson(xs, d) / nn));
            v = Math.abs(dx * dp - (n + 0.5));
            if (v > worst) worst = v;
          }
          return worst;
        }, expect: 0, tol: 1e-6 },
      /* ⑥ 递推关系 dH_n/dx = 2nH_{n−1}（对厄米多项式本身的检查） */
      { name: "厄米递推 dH_n/dx = 2nH_{n−1}（n = 1…6，x = 0.37）", params: {},
        measure: function () {
          var h = 1e-6, n, worst = 0, v;
          for (n = 1; n <= 6; n++) {
            v = Math.abs((qoHermite(n, 0.37 + h) - qoHermite(n, 0.37 - h)) / (2 * h) - 2 * n * qoHermite(n - 1, 0.37));
            if (v > worst) worst = v;
          }
          return worst;
        }, expect: 0, tol: 1e-6 }
    ]
  });

  /* ==========================================================================
     5. spin-bloch —— 自旋 1/2 与拉比振荡（归一化单位 ħ = 1，旋磁比 γ = 1）

     二能级系统：静态场沿 z，ω₀ = γB = B；横向驱动幅度取归一化 Ω_R = 1（除非注明）
     失谐 Δ = ω − ω₀ = ω − B，广义拉比频率 Ω = √(Ω_R² + Δ²)
       · 从 |↓⟩ 出发：P↑(t) = (Ω_R²/Ω²)·sin²(Ωt/2)
         共振（Δ = 0）时退化为 P↑ = sin²(Ω_Rt/2)；π 脉冲 t = π/Ω_R 时 P↑ = 1
       · 布洛赫矢量（旋转坐标系，绕 n = (Ω_R, 0, Δ)/Ω 进动）：
         b = (−(Ω_RΔ/Ω²)(1−cosΩt), (Ω_R/Ω)sinΩt, −cosΩt − (Δ²/Ω²)(1−cosΩt))，|b| = 1
         实验室系再绕 z 转 ωt：b_lab = R_z(ωt)·b
       · 进动支（kind = 1）：关掉驱动，初态沿 +x，绕 z 以 ω₀ 进动 ⇒ P↑ ≡ 1/2，
         布洛赫矢量在赤道面上画圆（这正是"自旋进动"的图像）
     ========================================================================== */
  var SB_KINDS = ["拉比振荡", "进动", "布洛赫球"];
  var SB_NX = 801;
  var SB_OMEGA_R = 1;              // 归一化驱动幅度（拉比频率）

  /** 三个视角下的布洛赫矢量（t 时刻，实验室系分量） */
  function sbBloch(kind, B, om, t) {
    var OmR = (kind === 1) ? 0 : SB_OMEGA_R;
    var D = om - B;
    var Om = Math.sqrt(OmR * OmR + D * D);
    var c, s, X, Y, Z, cw, sw;
    if (kind === 1) {
      return { b: [Math.cos(B * t), Math.sin(B * t), 0], OmR: 0, D: D, Om: Math.abs(B), pup: 0.5 };
    }
    if (!(Om > 0)) return { b: [0, 0, -1], OmR: OmR, D: D, Om: 0, pup: 0 };
    c = Math.cos(Om * t);
    s = Math.sin(Om * t);
    X = -((OmR * D) / (Om * Om)) * (1 - c);
    Y = (OmR / Om) * s;
    Z = -c - ((D * D) / (Om * Om)) * (1 - c);
    cw = Math.cos(om * t);
    sw = Math.sin(om * t);
    return {
      b: [X * cw - Y * sw, X * sw + Y * cw, Z],
      bRot: [X, Y, Z],
      OmR: OmR, D: D, Om: Om, pup: 0.5 * (1 + Z)
    };
  }
  /** 正交投影到屏幕（z 向上，x 与 y 各成 120°）：球面仍投成半径 1 的圆 */
  function sbProj(b) {
    return { x: 0.8660254037844386 * (b[0] - b[1]), y: b[2] - 0.5 * (b[0] + b[1]) };
  }

  SIM.register("spin-bloch", {
    title: "自旋与拉比振荡",
    legend: "归一化单位 ħ = 1、γ = 1：ω₀ = B，驱动幅度 Ω_R = 1。"
      + "共振时 P↑ = sin²(Ω_Rt/2)（π 脉冲处回到上态）；失谐 Δ 时振幅降到 Ω_R²/Ω²、"
      + "振荡加快到广义拉比频率 Ω = √(Ω_R²+Δ²)。滑块 t 决定横轴画到多久（它同时就是当前时刻）。",
    axes: { xlabel: "t（ħ = 1）", ylabel: "P↑(t)" },
    params: {
      B: { label: "静磁场 B（ω₀ = B）", unit: "", def: 1, min: 0, max: 3, step: 0.05 },
      omega: { label: "驱动频率 ω", unit: "", def: 1, min: 0, max: 3, step: 0.05 },
      t: { label: "画到时刻 t", unit: "", def: 1, min: 0, max: 20, step: 0.1 },
      kind: { label: "视角", type: "enum", options: SB_KINDS, def: 0 }
    },
    plots: [
      { key: "pup", label: "P↑(t)", color: "#5aa9ff" }
    ],
    compute: function (p) {
      var kind = clampInt(p.kind, 0, 2);
      var B = clampNum(p.B, 0, 3, 1);
      var om = clampNum(p.omega, 0, 3, 1);
      var tEnd = Math.max(clampNum(p.t, 0, 20, 1), 1e-3);
      var i, tt, st, pup = [], traj = [], rot = [], b, pr;
      for (i = 0; i < SB_NX; i++) {
        tt = (tEnd * i) / (SB_NX - 1);
        st = sbBloch(kind, B, om, tt);
        pup.push(Math.min(1, Math.max(0, st.pup)));
      }
      /* 布洛赫轨迹：kind = 2 画旋转坐标系（锥面），其余画实验室系 */
      var useRot = (kind === 2), NT = 361, bv, dev = 0;
      for (i = 0; i < NT; i++) {
        tt = (tEnd * i) / (NT - 1);
        b = sbBloch(kind, B, om, tt);
        bv = (useRot && b.bRot) ? b.bRot : b.b;
        pr = sbProj(bv);
        traj.push({ x: pr.x, y: pr.y });
        var nrm = Math.sqrt(b.b[0] * b.b[0] + b.b[1] * b.b[1] + b.b[2] * b.b[2]);
        if (Math.abs(nrm - 1) > dev) dev = Math.abs(nrm - 1);
        if (useRot && b.bRot) {
          var pr2 = sbProj(b.b);
          rot.push({ x: pr2.x, y: pr2.y });
        }
      }
      var cur = sbBloch(kind, B, om, tEnd);
      var curP = sbProj((useRot && cur.bRot) ? cur.bRot : cur.b);
      var Om = cur.Om, D = cur.D;

      /* 布洛赫球轮廓 + 三个坐标轴（同一个 extra 图里画） */
      var circ = [], cx = [], cy = [], cz = [], NT2 = 97, th;
      for (i = 0; i < NT2; i++) {
        th = (2 * PI * i) / (NT2 - 1);
        circ.push({ x: Math.cos(th), y: Math.sin(th) });
      }
      cx = [{ x: -0.866, y: 0.5 }, { x: 0.866, y: -0.5 }];
      cy = [{ x: 0.866, y: 0.5 }, { x: -0.866, y: -0.5 }];
      cz = [{ x: 0, y: -1 }, { x: 0, y: 1 }];
      var lines = [
        { x: [circ[0].x].concat(circ.map(function (q) { return q.x; })), y: [circ[0].y].concat(circ.map(function (q) { return q.y; })), label: "布洛赫球（半径 1）", color: "#7fd8e8", dash: "3 3" },
        { x: [cx[0].x, cx[1].x], y: [cx[0].y, cx[1].y], label: "x / y / z 轴", color: "#9fe870", dash: "2 4" },
        { x: [cy[0].x, cy[1].x], y: [cy[0].y, cy[1].y], color: "#9fe870", dash: "2 4" },
        { x: [cz[0].x, cz[1].x], y: [cz[0].y, cz[1].y], color: "#9fe870", dash: "2 4" },
        { x: traj.map(function (q) { return q.x; }), y: traj.map(function (q) { return q.y; }),
          label: (useRot ? "旋转坐标系轨迹（绕有效场进动）" : "实验室系轨迹 0 → t"), color: "#ffb84d" }
      ];
      if (useRot && rot.length) {
        lines.push({ x: rot.map(function (q) { return q.x; }), y: rot.map(function (q) { return q.y; }),
          label: "实验室系（同一段轨迹，绕 z 快速进动）", color: "#ff7b7b", dash: "4 3" });
      }

      return {
        t: lin(0, tEnd, SB_NX),
        series: { pup: pup },
        info: [
          { k: "视角 / 初态", v: opt(SB_KINDS, kind) + (kind === 1 ? "：驱动关闭，初态沿 +x（ω₀ = B = " + fmt(B, 3) + "）"
            : "：初态 |↓⟩，驱动幅度 Ω_R = " + SB_OMEGA_R) },
          { k: "拉比频率 Ω_R / 失谐 Δ", v: fmt(cur.OmR, 4) + " / " + fmt(D, 4) + "（Δ = ω − ω₀ = " + fmt(om, 3) + " − " + fmt(B, 3) + "）" },
          { k: (kind === 1) ? "进动频率 ω₀ = B" : "广义拉比频率 Ω = √(Ω_R²+Δ²)",
            v: (kind === 1)
              ? fmt(B, 6) + "（驱动关闭 Ω_R = 0 ⇒ 布洛赫矢量在赤道面上以 ω₀ 画圆，P↑ ≡ 1/2）"
              : fmt(Om, 6) + "　振荡幅度 Ω_R²/Ω² = " + fmt(Om > 0 ? (cur.OmR * cur.OmR) / (Om * Om) : 1, 6) },
          { k: (kind === 1) ? "已转过角度 ω₀·t" : "旋转角 Ω·t",
            v: fmt((kind === 1 ? Math.abs(B) : Om) * tEnd, 6) + " rad（π 脉冲要 Ω_R·t = π，即 t = " + fmt(SB_OMEGA_R > 0 ? PI / SB_OMEGA_R : 0, 4) + "）" },
          { k: "P↑(t)", v: fmt(cur.pup, 6) + "（布洛赫矢量 z 分量 " + fmt((useRot && cur.bRot ? cur.bRot[2] : cur.b[2]), 6) + "）" },
          { k: "共振条件", v: "ω = ω₀ = B = " + fmt(B, 3) + (Math.abs(D) < 1e-12 ? "（当前正好共振）" : "（当前失谐，振幅被压低）") }
        ],
        extra: {
          lines: lines,
          markers: [{ x: curP.x, y: curP.y, label: "t = " + fmt(tEnd, 3) }],
          xlabel: "布洛赫球投影 x", ylabel: "布洛赫球投影 z",
          title: useRot ? "旋转坐标系下的布洛赫轨迹（绕有效场 n = (Ω_R,0,Δ)/Ω 的锥面）"
            : "布洛赫矢量轨迹（z 轴 = 自旋向上）"
        },
        metrics: {
          kind: kind, B: B, omega: om, t: tEnd, OmR: cur.OmR, Delta: D, Om: Om,
          angle: Om * tEnd, pup: cur.pup, bloch: cur.b, blochNormDev: dev,
          amp: Om > 0 ? (cur.OmR * cur.OmR) / (Om * Om) : 1
        }
      };
    },
    tests: [
      /* ① 共振（ω = ω₀ = B）时 P↑(t) = sin²(Ω_Rt/2)，逐点比对整条曲线 */
      { name: "共振时 P↑ = sin²(Ω_Rt/2)（逐点，容差 1e-9）", params: { kind: 0, B: 1, omega: 1, t: 20 },
        measure: function (o) {
          var i, worst = 0, v, want;
          for (i = 0; i < o.t.length; i++) {
            want = Math.pow(Math.sin((SB_OMEGA_R * o.t[i]) / 2), 2);
            v = Math.abs(o.series.pup[i] - want);
            if (v > worst) worst = v;
          }
          return worst;
        }, expect: 0, tol: 1e-9 },
      /* ② 非共振时振幅被压低：包络 = Ω_R²/Ω² < 1（Δ = 1 时 = 1/2）
            采样最大值的误差由步长决定：Δt = t/800，峰附近 P↑ ≈ A(1 − (ΩΔt/4)²)，取容差 1e-3 */
      { name: "非共振（Δ = 1）时振荡幅度 = Ω_R²/Ω² = 0.5 < 1（容差 1e-3）", params: { kind: 0, B: 1, omega: 2, t: 20 },
        measure: function (o) { return maxOf(o.series.pup); }, expect: 0.5, tol: 1e-3 },
      { name: "失谐越大振幅越小（Δ = 0 / 1 / 2 的包络 1 > 0.5 > 0.2）", params: { kind: 0, B: 1, t: 20 },
        measure: function (o) {
          var i, ds = [0, 1, 2], vals = [], ok = true, st;
          void o;
          for (i = 0; i < ds.length; i++) {
            st = sbBloch(0, 1, 1 + ds[i], 20);
            vals.push((st.OmR * st.OmR) / (st.Om * st.Om));
          }
          if (!(vals[0] > vals[1] && vals[1] > vals[2])) ok = false;
          return ok ? 1 : 0;
        }, expect: 1, tol: 0 },
      /* ③ 广义拉比频率 Ω = √(Ω_R² + Δ²) */
      { name: "广义拉比频率 Ω = √(Ω_R² + Δ²)（Δ = 1 ⇒ √2，容差 1e-9）", params: { kind: 2, B: 0.5, omega: 1.5 },
        measure: function (o, p) {
          var D = p.omega - p.B;
          return Math.abs(o.metrics.Om - Math.sqrt(SB_OMEGA_R * SB_OMEGA_R + D * D));
        }, expect: 0, tol: 1e-9 },
      /* ③b P↑ 的周期 = 2π/Ω（sin²(Ωt/2) 的周期），从解析式逐点验证 */
      { name: "P↑ 的振荡周期 = 2π/Ω（逐点，容差 1e-9）", params: { kind: 0, B: 1, omega: 2 },
        measure: function (o, p) {
          var st = sbBloch(0, p.B, p.omega, 0), T = (2 * PI) / st.Om, i, t, worst = 0, v;
          for (i = 0; i < 40; i++) {
            t = i * 0.1;
            v = Math.abs(sbBloch(0, p.B, p.omega, t).pup - sbBloch(0, p.B, p.omega, t + T).pup);
            if (v > worst) worst = v;
          }
          void o;
          return worst;
        }, expect: 0, tol: 1e-9 },
      /* ④ π 脉冲：t = π/Ω_R 时 P↑ = 1。t 就是横轴上端，曲线的最后一个采样点正好落在 t 上 */
      { name: "π 脉冲 t = π/Ω_R 时 P↑ = 1（曲线末点，容差 1e-9）", params: { kind: 0, B: 1, omega: 1, t: PI },
        measure: function (o) { return o.series.pup[o.series.pup.length - 1]; }, expect: 1, tol: 1e-9 },
      { name: "2π 脉冲（t = 2π/Ω_R）时回到下态 P↑ = 0（容差 1e-9）", params: { kind: 0, B: 1, omega: 1, t: 2 * PI },
        measure: function (o) { return o.series.pup[o.series.pup.length - 1]; }, expect: 0, tol: 1e-9 },
      /* ⑤ P↑ ∈ [0, 1] 恒成立（扫 B、ω、t、三种视角） */
      { name: "P↑ ∈ [0, 1] 恒成立（扫 B、ω、t、视角）", params: {},
        measure: function () {
          var ks = [0, 1, 2], Bs = [0, 0.5, 1, 3], os = [0, 1, 2, 3], ts = [0.5, 5, 20];
          var i, j, k, l, m, ok = true, v, pr;
          for (i = 0; i < ks.length; i++) {
            for (j = 0; j < Bs.length; j++) {
              for (k = 0; k < os.length; k++) {
                for (l = 0; l < ts.length; l++) {
                  for (m = 0; m <= 20; m++) {
                    v = sbBloch(ks[i], Bs[j], os[k], (ts[l] * m) / 20).pup;
                    if (!(v >= -1e-12 && v <= 1 + 1e-12)) ok = false;
                  }
                }
              }
            }
          }
          void pr;
          return ok ? 1 : 0;
        }, expect: 1, tol: 0 },
      /* ⑥ 布洛赫矢量恒为单位矢量（|b| = 1，纯态演化不丢失信息） */
      { name: "布洛赫矢量 |b| = 1（三种视角、任意参数，容差 1e-9）", params: { kind: 0, B: 1, omega: 2, t: 20 },
        measure: function (o, p) {
          var ks = [0, 1, 2], i, j, tt, b, worst = 0, v;
          for (i = 0; i < ks.length; i++) {
            for (j = 0; j <= 40; j++) {
              tt = (p.t * j) / 40;
              b = sbBloch(ks[i], p.B, p.omega, tt).b;
              v = Math.abs(Math.sqrt(b[0] * b[0] + b[1] * b[1] + b[2] * b[2]) - 1);
              if (v > worst) worst = v;
            }
          }
          void o;
          return worst;
        }, expect: 0, tol: 1e-9 }
    ]
  });

  /* ==========================================================================
     6. hydrogen —— 氢原子（SI，Z = 1）

     径向函数（r 以 a₀ 为单位，R 以 a₀^{−3/2} 为单位）：
       R_nl(r) = √[(2/n)³·(n−l−1)!/(2n(n+l)!)]·e^{−ρ/2}ρ^l L^{2l+1}_{n−l−1}(ρ)，ρ = 2r/n
     广义拉盖尔多项式用三项递推 (k+1)L^α_{k+1} = (2k+1+α−x)L^α_k − (k+α)L^α_{k−1}，
     所以 n ≤ 4、l ≤ n−1 的所有组合（1s、2s、2p、3s、3p、3d、4s…4f）都能算。
       · E_n = −13.605 693 124 eV / n²（与 l 无关，简并度 2n²）
       · 径向节点数 = n − l − 1；∫₀^∞ r²|R_nl|²dr = 1
       · ⟨r⟩_nl = (3n² − l(l+1))/2 · a₀；1s 的 r²|R|² 峰值恰在 r = a₀
     网格取 r = Rmax·u²（u 均匀，Rmax = 8n²+8）：
       ∫r²|R|²dr = ∫₀¹ r²|R(r)|²·2Rmax·u du —— 换元后在均匀 u 上用辛普森法，
       既能把点聚在 r ~ a₀ 的精细结构处，又能把尾巴积到 e^{−2Rmax/n} 以下
       （1s 的截断只剩 ~1e-11，n = 4 也只有 ~1e-13），归一化自检因此能过 1e-9。
     ========================================================================== */
  var HY_NX = 601;
  var HY_LMAX = 3;

  /** 广义拉盖尔多项式 L^a_n(x)（三项递推） */
  function hyLaguerre(n, a, x) {
    var l0 = 1, l1 = 1 + a - x, l2, k;
    if (n <= 0) return l0;
    if (n === 1) return l1;
    for (k = 1; k < n; k++) {
      l2 = ((2 * k + 1 + a - x) * l1 - (k + a) * l0) / (k + 1);
      l0 = l1;
      l1 = l2;
    }
    return l1;
  }
  function hyFact(n) { var r = 1, i; for (i = 2; i <= n; i++) r *= i; return r; }
  /** R_nl(r)，r 以 a₀ 为单位（返回值单位 a₀^{−3/2}） */
  function hyR(n, l, r) {
    var rho = (2 * r) / n;
    var c = Math.sqrt(Math.pow(2 / n, 3) * (hyFact(n - l - 1) / (2 * n * hyFact(n + l))));
    return c * Math.exp(-rho / 2) * Math.pow(rho, l) * hyLaguerre(n - l - 1, 2 * l + 1, rho);
  }
  /** ⟨r⟩_nl = (3n² − l(l+1))/2 · a₀（克拉默斯关系 / 维里定理的直接结果） */
  function hyAvgR(n, l) { return (3 * n * n - l * (l + 1)) / 2; }
  /** 径向节点数 = n − l − 1 */
  function hyNodes(n, l) { return n - l - 1; }
  /** 采样网格（r = Rmax·u²）与 r²|R|² */
  function hyOut(n, l) {
    var Rmax = 8 * n * n + 8, xs = [], p = [], rr = [], i, u, r, R;
    for (i = 0; i < HY_NX; i++) {
      u = i / (HY_NX - 1);
      r = Rmax * u * u;
      R = hyR(n, l, r);
      xs.push(r);
      rr.push(R);
      p.push(r * r * R * R);
    }
    return { x: xs, p: p, R: rr, Rmax: Rmax };
  }
  /** 换元积分 ∫r²|R|²dr = ∫₀¹ P(Rmax u²)·2Rmax·u du（均匀 u 上的辛普森法） */
  function hyIntegral(n, l, power) {
    var Rmax = 8 * n * n + 8, N = HY_NX, i, u, r, R, s = 0, h, w;
    N = N - ((N - 1) % 2) - 1;                       // 保证区间数为偶数
    h = 1 / N;
    for (i = 0; i <= N; i++) {
      u = i * h;
      r = Rmax * u * u;
      R = hyR(n, l, r);
      w = (i === 0 || i === N) ? 1 : (i % 2 ? 4 : 2);
      s += w * Math.pow(r, power) * R * R * 2 * Rmax * u;
    }
    return (s * h) / 3;
  }

  SIM.register("hydrogen", {
    title: "氢原子：径向分布与能级",
    legend: "r 以玻尔半径 a₀ 为单位，纵轴 r²|R_nl|² 已归一化（∫₀^∞ r²|R_nl|²dr = 1）。"
      + "能级只由 n 决定（E_n = −13.6057/n² eV，简并度 2n²），l 决定径向节点数 n−l−1 与离心势垒；"
      + "l ≤ n−1 由模型自动夹取。",
    axes: { xlabel: "r (a₀)", ylabel: "r²|R_nl(r)|²" },
    params: {
      n: { label: "主量子数 n", unit: "", def: 1, min: 1, max: 4, step: 1 },
      l: { label: "角量子数 l（自动夹到 ≤ n−1）", unit: "", def: 0, min: 0, max: 3, step: 1 },
      r: { label: "观察半径 r", unit: "a₀", def: 1, min: 0, max: 20, step: 0.1 }
    },
    plots: [
      { key: "radial", label: "r²|R_nl|²", color: "#5aa9ff" },
      { key: "R", label: "R_nl(r)（a₀^(−3/2)）", color: "#63d6a5" }
    ],
    compute: function (p) {
      var n = clampInt(p.n, 1, 4);
      var l = clampInt(p.l, 0, Math.min(HY_LMAX, n - 1));      // 关键夹取：l ≤ n−1
      var rCur = clampNum(p.r, 0, 20, 1);
      var o = hyOut(n, l);
      var norm = hyIntegral(n, l, 2);
      var avgNum = hyIntegral(n, l, 3) / (norm || 1);
      var nodes = countInteriorZeros(o.x, o.R);
      var pk = argmaxIndex(o.p);
      var rPeak = refinePeak(o.x, o.p, pk);
      var En = E_H_EV / (n * n);
      var rOnGrid = Math.min(rCur, o.Rmax);
      var Rc = hyR(n, l, rOnGrid);

      /* extra：能级图（n = 1…4，E_n = −13.6057/n² eV，当前 n 高亮） */
      var lines = [], k, Ek;
      for (k = 1; k <= 4; k++) {
        Ek = E_H_EV / (k * k);
        lines.push({
          x: [Ek, 0], y: [k, k], color: k === n ? "#ff7b7b" : "#5aa9ff",
          label: k === n ? "n = " + k + "：E = " + fmt(Ek, 4) + " eV（当前）" : ""
        });
      }
      return {
        t: o.x,
        series: { radial: o.p, R: o.R },
        info: [
          { k: "能级 E_n = −13.605693/n² eV", v: fmt(En, 6) + " eV（n = " + n + "，与 l 无关；E_n/E₁ = 1/n² = " + fmt(1 / (n * n), 6) + "）" },
          { k: "量子数 (n, l)", v: "(" + n + ", " + l + ")　简并度 2n² = " + (2 * n * n) + "（含自旋）" },
          { k: "径向节点数", v: nodes + " = n − l − 1 = " + hyNodes(n, l) },
          { k: "⟨r⟩ = (3n² − l(l+1))/2 · a₀", v: fmt(hyAvgR(n, l), 6) + " a₀（数值积分 " + fmt(avgNum, 6) + " a₀）" },
          { k: "归一化 ∫r²|R_nl|²dr", v: fmt(norm, 9) + "（换元 r = Rmax·u² 后的辛普森法）" },
          { k: "r²|R|² 的峰值位置", v: fmt(rPeak, 4) + " a₀" + (n === 1 && l === 0 ? "（= a₀，1s 最可几半径）" : "") },
          { k: "观察半径 r = " + fmt(rCur, 3) + " a₀", v: "R_nl = " + fmt(Rc, 6) + " a₀^(−3/2)，r²|R|² = " + fmt(rOnGrid * rOnGrid * Rc * Rc, 6) },
          { k: "网格", v: "r ∈ [0, " + fmt(o.Rmax, 4) + "] a₀，共 " + HY_NX + " 点（r = Rmax·u²，靠近核处更密）" }
        ],
        extra: {
          lines: lines,
          xlabel: "能量 (eV)", ylabel: "主量子数 n",
          title: "能级图：E_n = −13.605693/n² eV（能级越高越密，0 处为电离阈）"
        },
        metrics: { n: n, l: l, r: rCur, En: En, E1: E_H_EV, nodes: nodes, norm: norm, avgR: avgNum, avgRTheory: hyAvgR(n, l), rPeak: rPeak, rMax: o.Rmax }
      };
    },
    tests: [
      /* ① E_n = −13.605 693 124 eV / n²（constants.js 的氢基态能量） */
      { name: "E₁ = −13.605693124 eV（n = 1，容差 1e-9）", params: { n: 1, l: 0 },
        measure: function (o) { return o.metrics.En; }, expect: -13.605693124, tol: 1e-9 },
      /* 附：R_nl 满足径向薛定谔方程（这是"E_n 与 l 无关、且等于 −13.6057/n² eV"的独立证据）。
            原子单位（ħ = m_e = e = 1，能量单位 Hartree）：E_n = −1/(2n²)，V = −1/r，于是
              R″ + (2/r)R′ = [l(l+1)/r² − 2/r + 1/n²]·R
            （若写成 u = rR 满足的方程则没有一阶项，别漏掉 (2/r)R′。） */
      { name: "R_nl 满足径向薛定谔方程（原子单位，相对残差 < 1e-3）", params: { n: 3, l: 1 },
        measure: function (o, p) {
          var h = 1e-4, worst = 0, i, r, R, Rp, Rpp, rhs, den, v;
          for (i = 1; i <= 60; i++) {
            r = 0.6 + i * 0.6;                                    // 避开 r → 0 处的奇异项
            R = hyR(p.n, p.l, r);
            Rp = (hyR(p.n, p.l, r + h) - hyR(p.n, p.l, r - h)) / (2 * h);
            Rpp = (hyR(p.n, p.l, r + h) - 2 * R + hyR(p.n, p.l, r - h)) / (h * h);
            rhs = ((p.l * (p.l + 1)) / (r * r) - 2 / r + 1 / (p.n * p.n)) * R - (2 / r) * Rp;
            den = Math.max(Math.abs(Rpp), Math.abs(rhs), 1e-12);
            v = Math.abs(Rpp - rhs) / den;
            if (v > worst) worst = v;
          }
          void o;
          return worst;
        }, expect: 0, tol: 1e-3 },
      /* ② 径向节点数 = n − l − 1（从 R_nl 曲线数符号变化，n ≤ 4、l ≤ n−1 全部组合） */
      { name: "径向节点数 = n − l − 1（全部 (n,l) 组合，容差 0）", params: {},
        measure: function () {
          var n, l, k, worst = 0, v;
          for (n = 1; n <= 4; n++) {
            for (l = 0; l <= n - 1; l++) {
              k = hyOut(n, l);
              v = Math.abs(countInteriorZeros(k.x, k.R) - (n - l - 1));
              if (v > worst) worst = v;
            }
          }
          return worst;
        }, expect: 0, tol: 0 },
      /* ③ 归一化 ∫r²|R_nl|²dr = 1（全部 (n,l) 组合，容差 1e-9） */
      { name: "归一化 ∫r²|R_nl|²dr = 1（全部 (n,l) 组合，容差 1e-9）", params: {},
        measure: function () {
          var n, l, worst = 0, v;
          for (n = 1; n <= 4; n++) {
            for (l = 0; l <= n - 1; l++) {
              v = Math.abs(hyIntegral(n, l, 2) - 1);
              if (v > worst) worst = v;
            }
          }
          return worst;
        }, expect: 0, tol: 1e-9 },
      /* ④ ⟨r⟩₁ₛ = 1.5 a₀（解析 (3n² − l(l+1))/2 = 3/2），从 series 现算 */
      { name: "⟨r⟩₁ₛ = 1.5 a₀（1s，容差 1e-6）", params: { n: 1, l: 0 },
        measure: function (o) {
          var xs = o.t, p = o.series.radial;
          return trapz(xs, xs.map(function (x, i) { return x * p[i]; })) / trapz(xs, p);
        }, expect: 1.5, tol: 1e-6 },
      { name: "⟨r⟩_nl = (3n² − l(l+1))/2 a₀（全部组合，容差 1e-6）", params: {},
        measure: function () {
          var n, l, worst = 0, v;
          for (n = 1; n <= 4; n++) {
            for (l = 0; l <= n - 1; l++) {
              v = Math.abs(hyIntegral(n, l, 3) - hyAvgR(n, l));     // 归一化已由 ③ 保证
              if (v > worst) worst = v;
            }
          }
          return worst;
        }, expect: 0, tol: 1e-6 },
      /* ⑤ 1s 的 r²|R|² 峰值在 r = a₀（r²e^{−2r} 的极大点在 r = 1），抛物线细化到网格以下 */
      { name: "1s 的 r²|R|² 峰值在 r = a₀（容差 1e-3）", params: { n: 1, l: 0 },
        measure: function (o) {
          var k = argmaxIndex(o.series.radial);
          return refinePeak(o.t, o.series.radial, k);
        }, expect: 1, tol: 1e-3 },
      /* ⑥ l 越界的自动夹取：给出 l = 3、n = 2 时不抛异常，且等价于 l = 1（2p） */
      { name: "l > n−1 时自动夹到 l = n−1（n = 2, l = 3 ⇒ 2p）", params: { n: 2, l: 3 },
        measure: function (o) { return o.metrics.l; }, expect: 1, tol: 0 },
      /* ⑦ 同 l、不同 n 的径向正交性 ∫R_nl R_n'l r²dr = 0 */
      { name: "径向正交性 ∫R_nl R_n'l r²dr = 0（同 l、n ≠ n′，容差 1e-9）", params: {},
        measure: function () {
          var Rmax = 8 * 4 * 4 + 8, N = 600, i, u, r, h, w, s, w2 = 0, n1, n2, l, v;
          for (l = 0; l <= 3; l++) {
            for (n1 = l + 1; n1 <= 4; n1++) {
              for (n2 = l + 1; n2 <= 4; n2++) {
                if (n1 === n2) continue;
                s = 0;
                h = 1 / N;
                for (i = 0; i <= N; i++) {
                  u = i * h;
                  r = Rmax * u * u;
                  w = (i === 0 || i === N) ? 1 : (i % 2 ? 4 : 2);
                  s += w * hyR(n1, l, r) * hyR(n2, l, r) * r * r * 2 * Rmax * u;
                }
                v = Math.abs((s * h) / 3);
                if (v > w2) w2 = v;
              }
            }
          }
          return w2;
        }, expect: 0, tol: 1e-9 }
    ]
  });

})(typeof window !== "undefined" ? window : globalThis);
