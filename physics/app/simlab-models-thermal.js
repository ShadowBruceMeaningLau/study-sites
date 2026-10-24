/* ==========================================================================
   simlab-models-thermal.js —— 热学与统计 仿真模型（W2 契约 §10.1，4 个）

     · kinetic-gas      麦克斯韦速率分布 f(v)，读数 v_p / v̄ / v_rms
     · thermo-cycle     卡诺循环 p–V 图，读数 η / Q₁ / Q₂ / W / 四个状态点
     · entropy-mixing   两半分布的微观态数 C(N,k) 与熵，读数 W_max / k_max / S_max / σ_k
     · random-walk      带种子的随机游走：⟨x²⟩–t 曲线 + 末态位移直方图

   ★ 约束（与 simlab.js 顶部一致）：
     · 加载时**只调用 SIM.register**，绝不触碰 DOM —— 这样 tools/verify-simlab.mjs
       能在 Node 里直接跑 compute() 与 tests 做物理不变量自检；
     · **不调用任何内置随机函数**（全文搜不到 random 调用）：random-walk 的随机数全部来自
       文件内自带的带种子 PRNG（Park–Miller LCG），同一个 seed 的结果逐位可重复。

   这 4 个模型都是解析式或统计模拟（没有微分方程），所以本文件用不到 rk4；
   仍按 mech 文件的骨架把引擎接口取出来，便于以后往这个文件里追加 ODE 模型。
   tests 的 expect 全部是**独立解析推出的值**（公式写在注释与测试名里），
   measure 尽量从 series / metrics 现场数值积分得到，而不是读模型自报的读数。
   ========================================================================== */
(function (global) {
  "use strict";
  var SIM = global.SIM;
  if (!SIM) return;   // 在 Node 里若未先加载 simlab.js，安静退出

  var rk4 = SIM.rk4, lin = SIM.linspace, fmt = SIM.fmt;

  /* ------------------------------------------------------------- 物理常量 */
  var R_GAS = 8.314462618;      // 摩尔气体常量 J/(mol·K)（= k_B·N_A，CODATA 2018 起为定义值）
  var K_B = 1.380649e-23;       // 玻尔兹曼常量 J/K（SI 定义值）
  var GAMMA = 1.4;              // 双原子理想气体绝热指数 γ = C_p/C_V

  /* --------------------------------------------------------------- 小工具 */
  /** 梯形积分 ∫ y dx（按数组顺序累加；x 不单调也照样对——卡诺循环绕一圈就是 ∮p dV） */
  function trapz(xs, ys) {
    var s = 0, n = Math.min(xs.length, ys.length);
    for (var i = 1; i < n; i++) s += 0.5 * (xs[i] - xs[i - 1]) * (ys[i] + ys[i - 1]);
    return s;
  }
  /** 逐元素相乘（算 ⟨v⟩、⟨v²⟩ 的积分核） */
  function mulv(a, b) {
    var o = [], n = Math.min(a.length, b.length);
    for (var i = 0; i < n; i++) o.push(a[i] * b[i]);
    return o;
  }
  /** 数组最大值下标 */
  function argmax(ys) {
    var m = 0;
    for (var i = 1; i < ys.length; i++) if (ys[i] > ys[m]) m = i;
    return m;
  }
  function maxAbs(vals) {
    var m = 0;
    for (var i = 0; i < vals.length; i++) {
      var a = Math.abs(vals[i]);
      if (isFinite(a) && a > m) m = a;
    }
    return m;
  }
  /**
   * 抛物顶点插值：过网格极值点 i 及其左右邻点作抛物线，取顶点横坐标（网格极值的精修）。
   * 单峰光滑函数上，这把峰值位置的误差从 O(h) 压到 O(h³)：采样 2000 点时
   * 素网格精度只有 ~1e-3（刚好卡在契约的 1e-3 相对容差上），插值后约 5e-7。
   */
  function peakX(xs, ys, i) {
    if (i <= 0 || i >= ys.length - 1) return xs[i];
    var y0 = ys[i - 1], y1 = ys[i], y2 = ys[i + 1];
    var den = y0 - 2 * y1 + y2;
    if (den === 0 || !isFinite(den)) return xs[i];
    var h = xs[i + 1] - xs[i];
    var x = xs[i] + 0.5 * h * (y0 - y2) / den;   // 顶点偏移量 ∈ (−h/2, h/2)
    if (x < xs[i - 1]) return xs[i - 1];
    if (x > xs[i + 1]) return xs[i + 1];
    return x;
  }
  /**
   * 抛物顶点处的**函数值**：与 peakX 过同一根抛物线（网格极值点 i 及其左右邻点），
   * 顶点值 = y1 − (y2−y0)²/(8·den)。
   * 直接在网格上取 max(ys) 有 O(h²) 误差（默认参数下 ≈ 9.8e-10，刚好卡在 1e-9 容差边缘），
   * 精修后 ≈ 2.5e-12 —— 峰值高度读数与该自检都靠它。
   */
  function peakY(ys, i) {
    if (i <= 0 || i >= ys.length - 1) return ys[i];
    var y0 = ys[i - 1], y1 = ys[i], y2 = ys[i + 1];
    var den = y0 - 2 * y1 + y2;
    if (den === 0 || !isFinite(den)) return y1;
    var v = y1 - (y2 - y0) * (y2 - y0) / (8 * den);
    return isFinite(v) ? v : y1;
  }
  /** 大整数计数：小于 1e15 时是精确整数，直接原样打印；再大就走 fmt 的科学计数 */
  function fmtCount(x) {
    if (!isFinite(x)) return "—";
    if (Math.abs(x) < 1e15) return String(Math.round(x));
    return fmt(x, 3);
  }

  /* ==================================================== 1. 麦克斯韦速率分布 */
  /**
   * f(v) = 4π (M/2πRT)^{3/2} v² exp(−Mv²/2RT)，  M 用 kg/mol
   * 归一化 ∫₀^∞ f dv = 1；三个特征速率：
   *   v_p = √(2RT/M)、v̄ = √(8RT/πM)、v_rms = √(3RT/M)
   * 峰值高度：把 v = v_p 代回指数，e 的指数恰为 −Mv_p²/2RT = **−1**（不是 −1/2），所以
   *   f(v_p) = A·v_p²·e^{−1} = 4/(e√π·v_p)，A = 4π(M/2πRT)^{3/2}
   * 无量纲不变量：v_p·f(v_p) = 4/(e√π) ≈ 0.830215（与 T、M 无关）。
   *   ★ 注意不是 4√π/e ≈ 2.608197 —— 那是把指数错写成 −1/2 才会得到的值。
   */
  SIM.register("kinetic-gas", {
    title: "麦克斯韦速率分布",
    legend: "f(v) = 4π(M/2πRT)^{3/2}v²e^{−Mv²/2RT}。升温曲线变平、峰值右移，但曲线下面积恒为 1。",
    axes: { xlabel: "速率 v (m/s)", ylabel: "概率密度 f(v)（s/m）" },
    params: {
      T: { label: "温度 T", unit: "K", def: 300, min: 50, max: 2000, step: 10 },
      M: { label: "摩尔质量 M", unit: "g/mol", def: 28, min: 1, max: 200, step: 1 }
    },
    plots: [
      { key: "f", label: "f(v)", color: "#5aa9ff" }
    ],
    compute: function (p) {
      var T = Math.max(1, p.T);                 // 防 0/负（滑块范围内不会发生，配置里写错也不会崩）
      var M = Math.max(1e-9, p.M) / 1000;       // g/mol → kg/mol
      var vp = Math.sqrt(2 * R_GAS * T / M);
      var vbar = Math.sqrt(8 * R_GAS * T / (Math.PI * M));
      var vrms = Math.sqrt(3 * R_GAS * T / M);
      // 采样到 4v_p：尾部 ∫_{4v_p}^∞ f dv ≈ 5e-7（被积函数 (4/√π)x²e^{−x²} 在 x=4 处 ~4e-6），
      // 归一化因此有 ~5e-7 的系统偏差，远小于契约要求的 1e-4。
      var N = 2000, vmax = 4 * vp;
      var v = lin(0, vmax, N), f = [];
      var A = 4 * Math.PI * Math.pow(M / (2 * Math.PI * R_GAS * T), 1.5);
      for (var i = 0; i < N; i++) {
        var vi = v[i], q = M * vi * vi / (2 * R_GAS * T);
        f.push(A * vi * vi * Math.exp(-q));
      }
      var iMax = argmax(f);
      var area = trapz(v, f);
      return {
        t: v, series: { f: f },
        info: [
          { k: "最概然速率 v_p = √(2RT/M)", v: fmt(vp, 4) + " m/s" },
          { k: "平均速率 v̄ = √(8RT/πM)", v: fmt(vbar, 4) + " m/s" },
          { k: "方均根速率 v_rms = √(3RT/M)", v: fmt(vrms, 4) + " m/s" },
          { k: "峰值高度 f(v_p)", v: fmt(A * vp * vp * Math.exp(-1), 6) + " s/m" },
          { k: "无量纲不变量 v_p·f(v_p)", v: fmt(vp * A * vp * vp * Math.exp(-1), 6) + "（= 4/(e√π)，与 T、M 无关）" },
          { k: "三个速率之比 v_p : v̄ : v_rms", v: "1 : " + fmt(vbar / vp, 5) + " : " + fmt(vrms / vp, 5) },
          { k: "曲线下面积 ∫f dv（数值）", v: fmt(area, 6) },
          { k: "峰值对应速率（曲线读出）", v: fmt(peakX(v, f, iMax), 4) + " m/s" }
        ],
        bars: [
          { label: "最概然速率 v_p", value: vp, color: "#5aa9ff", unit: "m/s" },
          { label: "平均速率 v̄", value: vbar, color: "#ffb84d", unit: "m/s" },
          { label: "方均根速率 v_rms", value: vrms, color: "#63d6a5", unit: "m/s" }
        ],
        metrics: { v: v, f: f, vp: vp, vbar: vbar, vrms: vrms, N: N, area: area }
      };
    },
    tests: [
      // ① 峰值位置 = √(2RT/M) = √(2·8.314462618·300/0.028) = 422.098 m/s（相对容差 1e-3 → 绝对 0.42）
      //    从 series 现算：取 f 的最大值下标 + 抛物顶点插值。
      { name: "分布峰值在 v_p = √(2RT/M) = 422.098 m/s（相对容差 1e-3）",
        measure: function (o) { return peakX(o.t, o.series.f, argmax(o.series.f)); },
        expect: 422.098396, tol: 0.42 },
      // ② v̄ = ∫v f(v) dv = √(8RT/πM) = 476.287 m/s（相对容差 1e-3 → 绝对 0.476）
      { name: "平均速率 v̄ = ∫v f dv = √(8RT/πM) = 476.287 m/s",
        measure: function (o) { return trapz(o.t, mulv(o.series.f, o.t)); },
        expect: 476.287037, tol: 0.476 },
      // ③ v_rms = √(∫v²f dv) = √(3RT/M) = 516.963 m/s（相对容差 1e-3 → 绝对 0.517）
      { name: "方均根速率 v_rms = √(∫v²f dv) = √(3RT/M) = 516.963 m/s",
        measure: function (o) { return Math.sqrt(trapz(o.t, mulv(o.series.f, mulv(o.t, o.t)))); },
        expect: 516.962846, tol: 0.517 },
      // ④ 归一化：∫₀^∞ f(v) dv = 1（梯形积分，容差 1e-4）
      { name: "归一化 ∫f(v) dv = 1（梯形积分，容差 1e-4）",
        measure: function (o) { return trapz(o.t, o.series.f); },
        expect: 1, tol: 1e-4 },
      // ⑤ 换一组参数（T=1000 K、M=2 g/mol，氢分子）：v_p = √(2RT/M) = √(2·8.314462618·1000/0.002) = 2883.481 m/s
      { name: "T=1000 K、M=2 g/mol 时峰值 = √(2RT/M) = 2883.481 m/s",
        params: { T: 1000, M: 2 },
        measure: function (o) { return peakX(o.t, o.series.f, argmax(o.series.f)); },
        expect: 2883.480990, tol: 2.883 },
      // ⑥ 形状不变量：v̄/v_p = 2/√π = 1.128379（与 T、M 无关，两个量都从 series 现算）
      { name: "形状不变量 v̄/v_p = 2/√π = 1.128379",
        params: { T: 1200, M: 4 },
        measure: function (o) {
          var vb = trapz(o.t, mulv(o.series.f, o.t));
          var vpk = peakX(o.t, o.series.f, argmax(o.series.f));
          return vb / vpk;
        },
        expect: 1.128379, tol: 1e-3 },
      // ⑦ 峰值高度：f(v_p) = A·v_p²·e^{−1} = 4/(e√π·v_p)。
      //    默认 T = 300 K、M = 28 g/mol ⇒ v_p = 422.098396 m/s、
      //    A = 4π(M/2πRT)^{3/2} = 3.00084766e-8 ⇒ f(v_p) = 1.9668755e-3 s/m。
      //    measure 从 series 现算（抛物顶点精修），expect 是独立解析值 —— 这条把
      //    "e 的指数误写成 −1/2（读数 3.2428e-3，恰差 e^{1/2} = 1.6487 倍）"钉死。
      { name: "峰值高度 f(v_p) = A·v_p²·e^{−1} = 1.9668755×10⁻³ s/m（从曲线现算，容差 1e-9）",
        measure: function (o) { return peakY(o.series.f, argmax(o.series.f)); },
        expect: 0.0019668755017, tol: 1e-9 },
      // ⑧ 无量纲不变量：v_p·f(v_p) = 4/(e√π) = 0.83021499（与 T、M 无关）。
      //    两个量都从 series 现算：峰值位置用 peakX、峰值高度用 peakY。
      //    （旧注释写的 4√π/e = 2.608197 是错的，差 (4/e√π)/(4√π/e) = 1/π。）
      { name: "无量纲不变量 v_p·f(v_p) = 4/(e√π) = 0.8302150（从曲线现算，容差 1e-5）",
        measure: function (o) {
          var i = argmax(o.series.f);
          return peakX(o.t, o.series.f, i) * peakY(o.series.f, i);
        },
        expect: 0.8302149948, tol: 1e-5 }
    ]
  });

  /* ======================================================== 2. 卡诺循环 */
  /**
   * 四步（γ = 1.4 的理想气体）：
   *   1→2  T₁ 等温膨胀   V: V₁ → V₂ = rV₁          Q₁ = nRT₁ ln r（吸热）
   *   2→3  绝热膨胀      V: V₂ → V₃ = V₂(T₁/T₂)^{1/(γ−1)}   T: T₁ → T₂
   *   3→4  T₂ 等温压缩   V: V₃ → V₄ = V₁(T₁/T₂)^{1/(γ−1)}   Q₂ = nRT₂ ln r（放热）
   *   4→1  绝热压缩      V: V₄ → V₁（由 T₂ 回到 T₁，循环因此闭合）
   * 于是 η = 1 − T₂/T₁、W = Q₁ − Q₂ = nR(T₁−T₂) ln r；Q₂/Q₁ = T₂/T₁。
   * 横轴是**体积 V**（契约规定），所以这里的 t 就是 V 数组；
   * V 沿循环先增后减，折线按采样顺序连起来正好画出一个闭合的 p–V 环。
   */
  SIM.register("thermo-cycle", {
    title: "卡诺循环（p–V 图）",
    legend: "两条等温线 + 两条绝热线围成的闭合环，环的面积就是净功 W；效率只由 T₁、T₂ 决定。",
    axes: { xlabel: "体积 V (m³)", ylabel: "压强 p (Pa)" },
    params: {
      n: { label: "物质的量 n", unit: "mol", def: 1, min: 0.1, max: 5, step: 0.1 },
      T1: { label: "高温热源 T₁", unit: "K", def: 600, min: 300, max: 1500, step: 10 },
      T2: { label: "低温热源 T₂", unit: "K", def: 300, min: 100, max: 1000, step: 10 },
      V1: { label: "初始体积 V₁", unit: "m³", def: 0.01, min: 0.001, max: 0.1, step: 0.001 },
      r: { label: "等温膨胀比 r = V₂/V₁", unit: "", def: 2, min: 1.2, max: 5, step: 0.1 }
    },
    plots: [
      { key: "p", label: "循环路径 p(V)", color: "#5aa9ff" }
    ],
    compute: function (p) {
      var n = Math.max(1e-9, p.n);
      var T1 = Math.max(1, p.T1), T2 = Math.max(1, p.T2);
      var V1 = Math.max(1e-12, p.V1);
      var r = p.r > 1e-9 ? p.r : 1e-9;          // 防御：r ≤ 0 时 V₂ ≤ 0 会炸；r = 1 只是退化成一条线段
      var k = Math.pow(T1 / T2, 1 / (GAMMA - 1));   // 绝热体积比 V₃/V₂（= V₄/V₁）
      var V2 = r * V1, V3 = V2 * k, V4 = V1 * k;
      var p1 = n * R_GAS * T1 / V1, p2 = n * R_GAS * T1 / V2;
      var p3 = n * R_GAS * T2 / V3, p4 = n * R_GAS * T2 / V4;

      var nPer = 300, V = [], P = [], i, vv;
      for (i = 0; i < nPer; i++) { vv = V1 + (V2 - V1) * i / (nPer - 1); V.push(vv); P.push(n * R_GAS * T1 / vv); }
      for (i = 0; i < nPer; i++) { vv = V2 + (V3 - V2) * i / (nPer - 1); V.push(vv); P.push(p2 * Math.pow(V2 / vv, GAMMA)); }
      for (i = 0; i < nPer; i++) { vv = V3 + (V4 - V3) * i / (nPer - 1); V.push(vv); P.push(n * R_GAS * T2 / vv); }
      for (i = 0; i < nPer; i++) { vv = V4 + (V1 - V4) * i / (nPer - 1); V.push(vv); P.push(p4 * Math.pow(V4 / vv, GAMMA)); }
      // 四条腿的端点下标，便于测试只对某一条腿做积分（metrics.legs 供 measure 使用）
      var legs = [0, nPer - 1, 2 * nPer - 1, 3 * nPer - 1, 4 * nPer - 1];

      var eta = 1 - T2 / T1;                                  // 卡诺效率（解析）
      var Q1 = n * R_GAS * T1 * Math.log(r);                  // 吸热
      var Q2 = n * R_GAS * T2 * Math.log(r);                  // 放热
      var W = Q1 - Q2;                                        // 净功 = nR(T₁−T₂)ln r
      // 数值反推（从画出来的 p–V 曲线积分），读数里给出以便和解析值对照
      var Q1num = trapz(V.slice(0, legs[1] + 1), P.slice(0, legs[1] + 1));
      var Wnum = trapz(V, P);
      var close = Math.max(Math.abs(V[V.length - 1] - V1) / V1, Math.abs(P[P.length - 1] - p1) / p1);

      var st = function (Vx, px) { return "V=" + fmt(Vx, 5) + " m³，p=" + fmt(px, 4) + " Pa"; };
      var note = T2 >= T1 ? "（T₂ ≥ T₁：循环反向，不是热机）" : "";
      return {
        t: V, series: { p: P },
        info: [
          { k: "卡诺效率 η = 1 − T₂/T₁" + note, v: fmt(eta, 4) + "（" + fmt(eta * 100, 2) + "%）" },
          { k: "吸热 Q₁ = nRT₁ ln r", v: fmt(Q1, 4) + " J" },
          { k: "放热 Q₂ = nRT₂ ln r", v: fmt(Q2, 4) + " J" },
          { k: "净功 W = Q₁ − Q₂ = nR(T₁−T₂) ln r", v: fmt(W, 4) + " J" },
          { k: "η 的数值反推 W/∮（p–V 环积分）", v: fmt(Q1num !== 0 ? Wnum / Q1num : eta, 6) },
          { k: "绝热体积比 V₃/V₂ = (T₁/T₂)^(1/(γ−1))", v: fmt(k, 4) },
          { k: "循环闭合度 max(相对 ΔV, 相对 Δp)", v: fmt(close, 3) },
          { k: "状态 1（T₁ 等温线起点）", v: st(V1, p1) },
          { k: "状态 2（T₁ 等温线终点）", v: st(V2, p2) },
          { k: "状态 3（T₂ 等温线起点）", v: st(V3, p3) },
          { k: "状态 4（T₂ 等温线终点）", v: st(V4, p4) }
        ],
        bars: [
          { label: "吸热 Q₁", value: Q1, color: "#ff7b7b", unit: "J" },
          { label: "放热 Q₂", value: Q2, color: "#5aa9ff", unit: "J" },
          { label: "净功 W", value: W, color: "#63d6a5", unit: "J" }
        ],
        metrics: { V: V, P: P, legs: legs, k: k, Q1: Q1, Q2: Q2, W: W, eta: eta, close: close, states: [V1, p1, V2, p2, V3, p3, V4, p4] }
      };
    },
    tests: [
      // ① η = 1 − T₂/T₁ = 1 − 300/600 = 0.5。measure 不看模型自报的 η，而是从 series 现算
      //    W/∮ = ∮p dV（绕环一圈的梯形积分）÷ 第一条腿 ∫p dV（T₁ 等温吸热）。
      { name: "卡诺效率 η = W/Q₁ = 1 − T₂/T₁ = 0.5（由 p–V 环数值积分反推）",
        measure: function (o) {
          var W = trapz(o.metrics.V, o.metrics.P);
          var L = o.metrics.legs[1];
          var Q1 = trapz(o.metrics.V.slice(0, L + 1), o.metrics.P.slice(0, L + 1));
          return W / Q1;
        }, expect: 0.5, tol: 1e-8 },
      // ② Q₁ = nRT₁ ln r = 1·8.314462618·600·ln2 = 3457.888 J（数值 ∫₁→₂ p dV，nPer=300 的梯形误差 ~3.5e-3 J）
      { name: "吸热 Q₁ = nRT₁ ln r = 3457.888 J（数值积分，容差 0.05 J）",
        measure: function (o) {
          var L = o.metrics.legs[1];
          return trapz(o.metrics.V.slice(0, L + 1), o.metrics.P.slice(0, L + 1));
        }, expect: 3457.887793, tol: 0.05 },
      // ③ W = Q₁ − Q₂ = nR(T₁−T₂) ln r = 1·8.314462618·300·ln2 = 1728.944 J
      { name: "净功 W = nR(T₁−T₂) ln r = 1728.944 J（数值 ∮p dV，容差 0.05 J）",
        measure: function (o) { return trapz(o.metrics.V, o.metrics.P); },
        expect: 1728.943896, tol: 0.05 },
      // ④ 卡诺定理：Q₂/Q₁ = T₂/T₁ = 0.5（两条等温线吸放热之比只由温度决定，与 n、V₁、r 无关）
      { name: "卡诺定理 Q₂/Q₁ = T₂/T₁ = 0.5",
        measure: function (o) {
          var L = o.metrics.legs[1];
          var Q1 = trapz(o.metrics.V.slice(0, L + 1), o.metrics.P.slice(0, L + 1));
          var W = trapz(o.metrics.V, o.metrics.P);
          return (Q1 - W) / Q1;
        }, expect: 0.5, tol: 1e-8 },
      // ⑤ 循环闭合：绝热步 V₃ = V₂(T₁/T₂)^{1/(γ−1)} 使末点严格回到起点（相对偏差 < 1e-9）
      { name: "循环闭合：末点与起点的 V、p 相对偏差 < 1e-9",
        measure: function (o) {
          var V = o.metrics.V, P = o.metrics.P;
          var relV = Math.abs(V[V.length - 1] - V[0]) / Math.abs(V[0]);
          var relp = Math.abs(P[P.length - 1] - P[0]) / Math.abs(P[0]);
          return Math.max(relV, relp);
        }, expect: 0, tol: 1e-9 },
      // ⑥ 换一组参数：n=2、T₁=1200 K、T₂=400 K → η = 1 − 400/1200 = 2/3 = 0.666667
      { name: "n=2、T₁=1200 K、T₂=400 K 时 η = 1 − T₂/T₁ = 2/3 = 0.666667",
        params: { n: 2, T1: 1200, T2: 400, V1: 0.02, r: 3 },
        measure: function (o) {
          var W = trapz(o.metrics.V, o.metrics.P);
          var L = o.metrics.legs[1];
          var Q1 = trapz(o.metrics.V.slice(0, L + 1), o.metrics.P.slice(0, L + 1));
          return W / Q1;
        }, expect: 0.666666667, tol: 1e-8 }
    ]
  });

  /* ================================================ 3. 两半分布的微观态数 */
  /**
   * N 个分子左右两半各有多少种分法：W(k) = C(N,k) = N!/(k!(N−k)!)。
   * 每个微观态等概率 ⇒ P(k) = C(N,k)/2^N，于是
   *   ⟨k⟩ = N/2，σ_k² = N/4（二项分布），Σ_k C(N,k) = 2^N；
   *   S(k) = k_B ln W(k)，最大熵 S_max = k_B ln C(N,N/2)。
   * 斯特林：C(2m,m) ≈ 4^m/√(πm) ⇒ ln W_max ≈ N ln2 − ½ln(πN/2)（N=60 时相对偏差 ~1e-4）。
   * 纵轴取 **ln C(N,k)**：N=60 时 W_max ~ 1.2×10^17，线性坐标会被挤成一根针。
   */
  SIM.register("entropy-mixing", {
    title: "微观态数 C(N,k) 与熵：为什么平衡态最可能",
    legend: "N 个分子分成左右两半有 C(N,k) 种分法。k=N/2 附近是一个极窄的峰：N 越大峰越尖（相对宽度 ~1/√N）。",
    axes: { xlabel: "左半分子数 k", ylabel: "ln C(N,k)（微观态数的自然对数）" },
    params: {
      N: { label: "分子总数 N", unit: "", def: 20, min: 4, max: 60, step: 1 }
    },
    plots: [
      { key: "W", label: "ln C(N,k)", color: "#5aa9ff" }
    ],
    compute: function (p) {
      var N = Math.round(Math.min(60, Math.max(1, p.N)));
      var i, k;
      var lnf = [0];                                     // ln k! 表（数值稳定，避免大整数溢出）
      for (i = 1; i <= N; i++) lnf.push(lnf[i - 1] + Math.log(i));
      var ks = [], lnW = [], Wk = [], Pk = [];
      var twoN = Math.pow(2, N), c = 1;                  // C(N,0) = 1
      for (k = 0; k <= N; k++) {
        if (k > 0) c = c * (N - k + 1) / k;              // 递推 C(N,k) = C(N,k−1)(N−k+1)/k
        ks.push(k); Wk.push(c); Pk.push(c / twoN);
        lnW.push(lnf[N] - lnf[k] - lnf[N - k]);
      }
      var kMax = argmax(Wk);                             // 峰位（N 为奇数时 k 与 N−k 简并，取小的那个）
      var Wmax = Wk[kMax], lnWmax = lnW[kMax];
      var sum = 0, m1 = 0, m2 = 0;
      for (k = 0; k <= N; k++) { sum += Wk[k]; m1 += k * Pk[k]; m2 += k * k * Pk[k]; }
      var sd = Math.sqrt(Math.max(0, m2 - m1 * m1));     // σ_k = √(N/4)
      var Smax = K_B * lnWmax;
      // 第二张图：归一化概率分布 P(k)，并标出 k = N/2 ± σ_k
      var kLo = Math.max(0, Math.round(N / 2 - sd)), kHi = Math.min(N, Math.round(N / 2 + sd));
      return {
        t: ks, series: { W: lnW },
        info: [
          { k: "最大微观态数 W_max = C(N,k_max)", v: fmtCount(Wmax) },
          { k: "峰位 k_max" + (N % 2 === 1 && kMax + 1 <= N && Math.abs(Wk[kMax + 1] - Wmax) <= Wmax * 1e-12 ? "（与 k=" + (kMax + 1) + " 简并）" : ""), v: String(kMax) },
          { k: "最大熵 S_max = k_B ln W_max", v: fmt(Smax, 5) + " J/K" },
          { k: "以 k_B 为单位的熵 ln W_max", v: fmt(lnWmax, 5) + " k_B" },
          { k: "标准差 σ_k = √(N/4)", v: fmt(sd, 5) },
          { k: "相对峰宽 σ_k/⟨k⟩ = 1/√N", v: fmt(N > 1 ? 1 / Math.sqrt(N) : 1, 5) },
          { k: "峰值概率 P(k_max) = W_max/2^N", v: fmt(Pk[kMax], 6) },
          { k: "全部挤在一半的概率 2^(−N)", v: fmt(Math.pow(2, -N), 4) },
          { k: "Σ_k C(N,k)（数值和）", v: fmtCount(sum) }
        ],
        extra: {
          lines: [{ x: ks, y: Pk, label: "P(k) = C(N,k)/2^N", color: "#ffb84d" }],
          markers: [
            { x: kLo, y: Pk[kLo], label: "k−σ" },
            { x: kHi, y: Pk[kHi], label: "k+σ" }
          ],
          xlabel: "左半分子数 k", ylabel: "概率 P(k)",
          title: "概率分布：峰宽 σ_k = √(N/4) = " + fmt(sd, 3) + "，峰外概率随 N 急剧变小"
        },
        metrics: { N: N, ks: ks, Wk: Wk, Pk: Pk, lnW: lnW, kMax: kMax, Wmax: Wmax, lnWmax: lnWmax, sd: sd, sum: sum, twoN: twoN, mean: m1, var: m2 - m1 * m1 }
      };
    },
    tests: [
      // ① W 的极大值在 k = N/2：C(20,10) = 184756 > C(20,9) = C(20,11) = 167960（N 取偶时唯一）
      { name: "W 的极大值在 k = N/2（N=20 → k_max=10）",
        measure: function (o) { return argmax(o.metrics.Wk); }, expect: 10, tol: 0 },
      // ② Σ_{k=0}^{N} C(N,k) = 2^N（二项式定理）；相对偏差 (Σ−2^N)/2^N
      { name: "Σ_k C(N,k) = 2^N（N=60，相对容差 1e-9）",
        params: { N: 60 },
        measure: function (o) { return Math.abs(o.metrics.sum - o.metrics.twoN) / o.metrics.twoN; },
        expect: 0, tol: 1e-9 },
      // ③ 二项分布方差 = Σk²P − (ΣkP)² = N/4（N=60 → 15），容差 1e-9
      { name: "分布方差 = N/4（N=60 → 15，容差 1e-9）",
        params: { N: 60 },
        measure: function (o) { return o.metrics.var; }, expect: 15, tol: 1e-9 },
      // ④ 斯特林：ln W_max 与 N ln2 − ½ln(πN/2) 的相对偏差（N=60 时实测 ~1.06e-4 < 1e-3）
      { name: "N=60 时 ln W_max ≈ N ln2 − ½ln(πN/2)（相对偏差 < 1e-3）",
        params: { N: 60 },
        measure: function (o, p) {
          var stir = p.N * Math.LN2 - 0.5 * Math.log(Math.PI * p.N / 2);
          return Math.abs(o.metrics.lnWmax - stir) / stir;
        }, expect: 0, tol: 1e-3 },
      // ⑤ σ_k = √(N/4)（N=60 → √15 = 3.872983346），从分布现算
      { name: "σ_k = √(N/4)（N=60 → √15 = 3.872983346）",
        params: { N: 60 },
        measure: function (o) { return Math.sqrt(o.metrics.var); }, expect: 3.872983346207417, tol: 1e-9 },
      // ⑥ 左右对称 C(N,k) = C(N,N−k)（用相对偏差，N=60 时 C 已超过 2^53，绝对相等不现实）
      { name: "左右对称 C(N,k) = C(N,N−k)（N=60，相对偏差 < 1e-12）",
        params: { N: 60 },
        measure: function (o) {
          var W = o.metrics.Wk, N = o.metrics.N, m = 0;
          for (var k = 0; k <= N; k++) {
            var d = Math.abs(W[k] - W[N - k]) / o.metrics.Wmax;
            if (d > m) m = d;
          }
          return m;
        }, expect: 0, tol: 1e-12 },
      // ⑦ 奇数 N 的边界：不崩、峰位取 floor(N/2)（N=45 时 C(45,22) = C(45,23) = 4116715363800 是精确整数）
      { name: "N=45（奇数）不崩且峰位取 floor(N/2)=22",
        params: { N: 45 },
        measure: function (o, p) {
          var ok = o.metrics.kMax === Math.floor(p.N / 2) && isFinite(o.metrics.sum) && isFinite(o.metrics.lnWmax);
          return ok ? 1 : 0;
        }, expect: 1, tol: 0 }
    ]
  });

  /* ==================================================== 4. 随机游走与扩散 */
  /**
   * Park–Miller 最小标准 LCG（Lehmer）：s ← 16807·s mod (2³¹−1)，u = (s−1)/(2³¹−2)。
   * 只用 +、×、%（s·16807 ≤ 3.6×10^13 < 2^53，在 double 里是精确整数），
   * 因此不依赖 Math.imul / 位运算，是纯 ES5；同一个 seed 的结果**逐位可重复**。
   * 单位步长 ±1 的一维游走（向右概率 p、q = 1−p）：
   *   一步的均值 μ = p−q、方差 σ² = 1−(p−q)² = 4pq
   *   ⇒ ⟨x(t)⟩ = t(p−q)，⟨x²(t)⟩ = 4tpq + t²(p−q)²（t 步后）
   * 纯扩散时 ⟨x²⟩ = 2Dt ⇒ D = σ²/2 = 2pq（单位：步长²/步）。
   */
  function makeRng(seed) {
    var s = Math.floor(seed) % 2147483647;
    if (s < 0) s += 2147483646;
    if (s === 0) s = 1;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  /** 一次完整的随机游走实验（compute 与 tests 共用，保证测试跑的是同一条代码路径） */
  function walkCompute(p) {
    var N = Math.max(1, Math.round(p.N));        // 步数
    var nW = Math.max(1, Math.round(p.n));       // 游走者数
    var pp = Math.min(1, Math.max(0, p.p));      // 向右概率
    var q = 1 - pp;
    var rng = makeRng(p.seed);
    var pos = [], i, t;
    for (i = 0; i < nW; i++) pos.push(0);
    var ts = [0], msd = [0], theory = [0];
    for (t = 1; t <= N; t++) {
      var s2 = 0;
      for (i = 0; i < nW; i++) {
        var x = pos[i] + (rng() < pp ? 1 : -1);
        pos[i] = x;
        s2 += x * x;
      }
      ts.push(t);
      msd.push(s2 / nW);                                        // 实测 ⟨x²⟩(t)：n 个游走者的平均
      theory.push(4 * t * pp * q + t * t * (pp - q) * (pp - q));// 解析 ⟨x²⟩(t)
    }
    var meanX = 0;
    for (i = 0; i < nW; i++) meanX += pos[i];
    meanX /= nW;

    // 末态位移直方图：区间取 ⟨x⟩ ± 4σ（σ = √(4Npq) 是扩散宽度），25 个箱
    var sig = Math.sqrt(4 * N * pp * q);
    var center = N * (pp - q);
    var nbins = 25, lo = center - 4 * sig, hi = center + 4 * sig;
    var wbin = (hi - lo) / nbins, centers = [], counts = [];
    for (i = 0; i < nbins; i++) { centers.push(lo + (i + 0.5) * wbin); counts.push(0); }
    for (i = 0; i < nW; i++) {
      var idx = Math.floor((pos[i] - lo) / wbin);
      if (!(idx >= 0)) idx = 0;                 // 含 NaN 防御（p=0/1 时 wbin 可能退化）
      if (idx >= nbins) idx = nbins - 1;
      counts[idx]++;
    }

    var msdEnd = msd[N], thEnd = theory[N];
    var rel = Math.abs(msdEnd - thEnd) / (thEnd || 1);
    var D = 2 * pp * q;                          // 扩散系数（步长²/步）
    return {
      t: ts, series: { msd: msd, theory: theory },
      info: [
        { k: "实测 ⟨x²⟩（第 N 步，n 个游走者平均）", v: fmt(msdEnd, 4) + " 步长²" },
        { k: "理论 ⟨x²⟩ = 4Npq + N²(p−q)²", v: fmt(thEnd, 4) + " 步长²" },
        { k: "实测相对偏差", v: fmt(rel * 100, 3) + " %" },
        { k: "扩散系数 D = 2pq = σ²/2", v: fmt(D, 4) + " 步长²/步" },
        { k: "漂移：实测 ⟨x⟩ vs N(p−q)", v: fmt(meanX, 3) + " vs " + fmt(center, 3) },
        { k: "单步标准差 σ = √(4pq)", v: fmt(Math.sqrt(4 * pp * q), 4) },
        // 注意：fmt(v, 0) 会把 20000 这类整数尾部的 0 当成小数末尾 0 吃掉（"2"），所以用 3 位
        { k: "规模：n × N", v: nW + " × " + N + " = " + fmt(nW * N, 3) + " 步" }
      ],
      extra: {
        lines: [{ x: centers, y: counts, label: "末态位移分布", color: "#c792ea" }],
        xlabel: "末态位移 x（步长）", ylabel: "游走者数",
        title: "末态直方图：箱宽 " + fmt(wbin, 3) + "，共 " + nW + " 个游走者"
      },
      metrics: { msd: msd, theory: theory, pos: pos, hist: counts, centers: centers, meanX: meanX, D: D, N: N, nW: nW, rel: rel, seed: p.seed }
    };
  }

  SIM.register("random-walk", {
    title: "随机游走与扩散",
    legend: "每个游走者每步独立地 ±1。⟨x²⟩ 与 t 成正比（斜率 2D）；p≠0.5 时叠加一个漂移，曲线向上弯。",
    axes: { xlabel: "步数 t", ylabel: "⟨x²⟩（步长²）" },
    params: {
      N: { label: "步数 N", unit: "", def: 100, min: 10, max: 2000, step: 10 },
      n: { label: "游走者数 n", unit: "", def: 200, min: 10, max: 2000, step: 10 },
      p: { label: "向右概率 p", unit: "", def: 0.5, min: 0.05, max: 0.95, step: 0.05 },
      seed: { label: "随机种子", unit: "", def: 1, min: 1, max: 9999, step: 1 }
    },
    plots: [
      { key: "msd", label: "实测 ⟨x²⟩", color: "#5aa9ff" },
      { key: "theory", label: "理论 4Npq+N²(p−q)²", color: "#ffb84d", dash: "5 4" }
    ],
    compute: walkCompute,
    tests: [
      // ① 理论 ⟨x²⟩ = 4Npq + N²(p−q)²：p=0.5、N=100 → 4·100·0.25 + 0 = 100（p=q 时无漂移项）
      { name: "理论 ⟨x²⟩ = 4Npq + N²(p−q)²：p=0.5、N=100 → 100",
        params: { N: 100, p: 0.5 },
        measure: function (o) { return o.series.theory[o.series.theory.length - 1]; }, expect: 100, tol: 1e-9 },
      // ② p=0.3、N=100 → 4·100·0.3·0.7 + 100²·(−0.4)² = 84 + 1600 = 1684
      { name: "理论 ⟨x²⟩：p=0.3、N=100 → 84 + 1600 = 1684",
        params: { N: 100, p: 0.3 },
        measure: function (o) { return o.series.theory[o.series.theory.length - 1]; }, expect: 1684, tol: 1e-9 },
      // ③ 实测 vs 理论（p=0.5）：相对偏差 < 5%。
      //    统计涨落：n 个游走者的 ⟨x²⟩ 估计标准差 = σ²√(2/n) = 100·√(2/2000) = 3.16 步长²
      //    （≈3.2%），所以取参数上限 n=2000 压低涨落；实测 2.59%。
      { name: "p=0.5 实测 ⟨x²⟩ 与理论值相对偏差 < 5%（n=2000）",
        params: { p: 0.5, n: 2000, N: 100, seed: 1 },
        measure: function (o) {
          var th = o.series.theory[o.series.theory.length - 1];
          return Math.abs(o.series.msd[o.series.msd.length - 1] - th) / th;
        }, expect: 0, tol: 0.05 },
      // ④ 实测 vs 理论（p=0.3，含漂移项）：相对偏差 < 5%（实测 0.35%）
      { name: "p=0.3 实测 ⟨x²⟩ 与理论值相对偏差 < 5%（n=2000）",
        params: { p: 0.3, n: 2000, N: 100, seed: 1 },
        measure: function (o) {
          var th = o.series.theory[o.series.theory.length - 1];
          return Math.abs(o.series.msd[o.series.msd.length - 1] - th) / th;
        }, expect: 0, tol: 0.05 },
      // ⑤ 漂移：末态平均位移 ⟨x⟩ = N(p−q) = −40（p=0.3、N=100），相对偏差 < 5%（实测 0.15%）
      { name: "漂移 ⟨x⟩ = N(p−q) = −40（p=0.3，相对偏差 < 5%）",
        params: { N: 100, p: 0.3, n: 2000, seed: 1 },
        measure: function (o, pp) {
          var d = pp.N * (pp.p - (1 - pp.p));
          return Math.abs(o.metrics.meanX - d) / Math.abs(d);
        },
        expect: 0, tol: 0.05 },
      // ⑥ 同 seed 两次运行必须逐位一致（这就是"随机数全部来自自带带种子 PRNG"的机器证明）
      { name: "同 seed 两次运行结果完全一致（⟨x²⟩ 曲线与直方图逐位相同）",
        params: { seed: 12345 },
        measure: function (o, pp) {
          var again = walkCompute(pp);
          var m = maxAbs(o.series.msd.map(function (v, i) { return v - again.series.msd[i]; }));
          var d = maxAbs(o.extra.lines[0].y.map(function (v, i) { return v - again.extra.lines[0].y[i]; }));
          return Math.max(m, d);
        }, expect: 0, tol: 0 },
      // ⑦ 换 seed 结果必须不同（证明种子真的被用上了，而不是被忽略）
      { name: "不同 seed 结果不同（种子确实参与计算）",
        params: { seed: 1 },
        measure: function (o, pp) {
          var other = walkCompute({ N: pp.N, n: pp.n, p: pp.p, seed: 2 });
          var m = maxAbs(o.series.msd.map(function (v, i) { return v - other.series.msd[i]; }));
          return m > 0 ? 1 : 0;
        }, expect: 1, tol: 0 },
      // ⑧ 直方图守恒：每个游走者恰好落进一个箱 → Σcounts = n
      { name: "末态直方图计数之和 = 游走者数 n",
        params: { n: 300, N: 200, p: 0.35 },
        measure: function (o) {
          var c = o.extra.lines[0].y, s = 0;
          for (var i = 0; i < c.length; i++) s += c[i];
          return s;
        }, expect: 300, tol: 0 }
    ]
  });

})(typeof window !== "undefined" ? window : globalThis);
