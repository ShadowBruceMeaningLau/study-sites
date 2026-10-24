/* ==========================================================================
   simlab-models-modern.js —— 近代物理仿真模型（4 个）

   契约：PHYSICS-CONTENT-SPEC.md §10.4
     · blackbody    黑体辐射谱：普朗克曲线 + 瑞利–金斯对照（plots: planck / rayleigh）
     · photoelectric 光电效应：E_kmax(λ)（plots: Ek）+ 光电流伏安特性（extra）
     · bohr         氢原子能级与光谱（plots: []，全靠 extra.lines）
     · zeeman       塞曼效应三重线（plots: []，全靠 extra.lines）

   约束（与 simlab.js 顶部一致）：
     · 加载时只调用 SIM.register，不触碰 DOM；
     · 不用 Math.random（四个模型全是解析式，同一组参数必然给同一组曲线）；
     · 常量照抄 app/constants.js（CODATA 2018）。**不依赖加载顺序**：模型文件
       可能在 Node 里被 verify-simlab.mjs 单独加载，那时 window.PHYSICS_CONSTANTS
       并不存在，所以这里按字面量重写一遍，注释标明符号与来源。

   自检的 expect 全部是独立解析值，公式写在每条 tests 的注释里。
   ========================================================================== */
(function (global) {
  "use strict";
  var SIM = global.SIM;
  if (!SIM) return;   // 在 Node 里若未先加载 simlab.js，安静退出

  var lin = SIM.linspace, fmt = SIM.fmt;

  /* ------------------------------------------------- 物理常量（CODATA 2018）
     与 app/constants.js 逐位一致；单位与符号也沿用那张表。 */
  var C_LIGHT = 2.99792458e8;        // c      m/s         （2019 SI 定义值）
  var H_PLANCK = 6.62607015e-34;     // h      J·s         （定义值）
  var E_CHARGE = 1.602176634e-19;    // e      C           （定义值）
  var K_B = 1.380649e-23;            // k_B    J/K         （定义值）
  var SIGMA_SB = 5.670374419e-8;     // σ      W/(m²·K⁴)   （由 k_B、h、c 组合，精确值）
  var C1_RAD = 3.741771852e-16;      // c1=2πhc²  W·m²
  var C2_RAD = 1.438776877e-2;       // c2=hc/k_B m·K
  var B_WIEN = 2.897771955e-3;       // b=λ_max·T m·K
  var MU_B = 9.2740100783e-24;       // μ_B    J/T         （μ_B = eħ/2m_e）
  var R_INF = 1.0973731568160e7;     // R∞     m^-1        （无限大核质量）
  var E1_H = 13.605693124;           // |E_1|  eV          （氢原子基态能量）
  var HC_EV_NM = (H_PLANCK * C_LIGHT / E_CHARGE) * 1e9;   // hc/e = 1239.841984 nm·eV

  /* ============================================================ 1. 黑体辐射 */
  /**
   * 普朗克谱出射度（W/m³）：
   *     M_λ(λ,T) = c1 / [ λ⁵ (e^{c2/(λT)} − 1) ]，c1 = 2πhc²，c2 = hc/k_B
   * 取谱**出射度**而不是谱亮度，是为了让 ∫₀^∞ M_λ dλ = σT⁴ 严格成立
   * （谱亮度 B_λ = M_λ/π，积分得到 σT⁴/π）。
   *
   * 数值稳定（λ→0 时 x = c2/(λT) → ∞）：
   *   · x > 700：用 e^{−x}/(1−e^{−x})，避免 Math.exp(x) 上溢成 Infinity；
   *     此时分子已下溢到 0，比值为 0，不会出现 Infinity/NaN；
   *   · x < 1e-6：e^x − 1 直接相减会损失有效数字，改用级数 1/x − 1/2 + x/12。
   */
  function planckM(lam, T) {
    var x = C2_RAD / (lam * T), f;
    if (x < 1e-6) f = 1 / x - 0.5 + x / 12;
    else if (x > 700) f = Math.exp(-x) / (1 - Math.exp(-x));
    else f = 1 / (Math.exp(x) - 1);
    return C1_RAD * f / Math.pow(lam, 5);
  }

  /** 瑞利–金斯谱出射度：M_λ^RJ = 2πck_BT/λ⁴（= 普朗克公式在 x≪1 时的极限） */
  function rayleighM(lam, T) {
    return 2 * Math.PI * C_LIGHT * K_B * T / Math.pow(lam, 4);
  }

  /** 采样曲线上的极大值：先取最大采样点，再用三点抛物线细化（亚采样精度） */
  function argmaxPar(xs, ys) {
    var i, bi = 0;
    for (i = 1; i < ys.length; i++) if (ys[i] > ys[bi]) bi = i;
    var x = xs[bi], y = ys[bi];
    if (bi > 0 && bi < ys.length - 1) {
      var y1 = ys[bi - 1], y2 = ys[bi], y3 = ys[bi + 1];
      var den = y1 - 2 * y2 + y3;
      if (den !== 0) {
        var d = 0.5 * (y1 - y3) / den;                     // 顶点偏移（单位：一个采样间隔）
        x = xs[bi] + d * (xs[bi + 1] - xs[bi]);
        y = y2 - 0.25 * (y1 - y3) * d;
      }
    }
    return { x: x, y: y, i: bi };
  }

  /** 梯形积分（xs、ys 等长；xs 单位任意，乘回 SI 由调用者负责） */
  function trapz(xs, ys) {
    var s = 0;
    for (var i = 1; i < xs.length; i++) s += 0.5 * (ys[i] + ys[i - 1]) * (xs[i] - xs[i - 1]);
    return s;
  }

  /**
   * 横轴窗口按维恩峰位缩放：λ ∈ [λ_max/8, 10λ_max]（这样任何温度下峰值都在区间内，
   * 且长波尾巴足够长，使 ∫M_λdλ 与 σT⁴ 的偏差 < 1%）。
   * 采样 1200 点均匀分布在该区间（峰值附近相对步长 ≈ 1e-3）。
   */
  function bbCompute(p) {
    var T = p.T;
    var lamPeak = B_WIEN / T;                              // 峰值波长（m）
    var n = 1200;
    var lamNm = lin((lamPeak / 8) * 1e9, lamPeak * 10 * 1e9, n);   // 横轴：nm
    var planck = [], ray = [], peak = 0, i, v;
    for (i = 0; i < n; i++) {
      planck.push(planckM(lamNm[i] * 1e-9, T));
      if (planck[i] > peak) peak = planck[i];
    }
    /* 瑞利–金斯只在"与普朗克可比"的范围内画：一旦超过普朗克峰值 6 倍就置 null。
       它按 1/λ⁴ 发散，若整条画出来会把纵轴撑到 10^18，普朗克曲线被压成一条贴地的
       直线——那正是紫外灾难，但在图上就什么都看不见了。截断处以上的部分见 info。 */
    var cap = 6 * peak;
    for (i = 0; i < n; i++) {
      v = rayleighM(lamNm[i] * 1e-9, T);
      ray.push(v <= cap ? v : null);
    }
    var integral = trapz(lamNm, planck) * 1e-9;            // nm → m
    var st4 = SIGMA_SB * T * T * T * T;
    var am = argmaxPar(lamNm, planck);
    return {
      t: lamNm,
      series: { planck: planck, rayleigh: ray },
      info: [
        { k: "峰值波长 λ_max（曲线峰值）", v: fmt(am.x, 4) + " nm" },
        { k: "维恩位移 λ_max·T", v: fmt(am.x * 1e-9 * T, 4) + " m·K（b = 2.8978×10^-3 m·K）" },
        { k: "总出射度 σT⁴", v: fmt(st4, 4) + " W/m²" },
        { k: "峰值谱出射度 M_λ,max", v: fmt(peak, 4) + " W/m³（同波长处瑞利–金斯是它的 " + fmt(rayleighM(am.x * 1e-9, T) / peak, 3) + " 倍）" },
        { k: "∫M_λdλ（曲线梯形积分）", v: fmt(integral, 4) + " W/m²（比 σT⁴ 低 " + fmt((1 - integral / st4) * 100, 2) + "%，缺的是窗口外的长波尾巴）" },
        { k: "瑞利–金斯在 λ=100 nm 处", v: fmt(rayleighM(1e-7, T), 4) + " W/m³（普朗克只有 " + fmt(planckM(1e-7, T), 4) + "，紫外灾难）" }
      ],
      metrics: { lamMaxNm: am.x, peak: peak, iPeak: am.i, sigmaT4: st4, integral: integral }
    };
  }

  SIM.register("blackbody", {
    title: "黑体辐射谱：普朗克曲线与瑞利–金斯对照",
    legend: "M_λ = c1/[λ⁵(e^{c2/λT}−1)]。横轴按峰值缩放到 λ_max/8 ~ 10λ_max，" +
      "所以温度一变谱峰就整体平移。瑞利–金斯是长波极限（λ≫hc/k_BT 时两条线重合），" +
      "短波端它按 1/λ⁴ 发散——曲线画到超出普朗克峰 6 倍处为止，这就是紫外灾难。",
    axes: { xlabel: "波长 λ (nm)", ylabel: "谱出射度 M_λ (W/m³)" },
    params: {
      T: { label: "温度 T", unit: "K", def: 5800, min: 300, max: 20000, step: 100 }
    },
    plots: [
      { key: "planck", label: "普朗克 M_λ", color: "#ffb84d" },
      { key: "rayleigh", label: "瑞利–金斯（1/λ⁴）", color: "#5aa9ff", dash: "5 4" }
    ],
    compute: bbCompute,
    tests: [
      /* 维恩位移定律：λ_max·T = b = 2.897771955e-3 m·K。peak 位置由曲线 argmax
         （三点抛物线细化）反推，不读模型自报的数。容差取相对 1e-3。 */
      { name: "维恩位移：曲线峰值满足 λ_max·T = 2.897771955e-3 m·K",
        measure: function (o, p) { return argmaxPar(o.t, o.series.planck).x * 1e-9 * p.T; },
        expect: 2.897771955e-3, tol: 2.897771955e-6 },
      /* 斯特藩–玻尔兹曼：∫₀^∞ M_λdλ = σT⁴。曲线窗口到 10λ_max，窗口外只剩约 0.5%
         的长波尾巴，所以实测系统性偏低约 0.5%，容差 1%。 */
      { name: "总出射度：∫M_λdλ = σT⁴（梯形积分，相对偏差 < 1%）",
        measure: function (o, p) { return (trapz(o.t, o.series.planck) * 1e-9) / (SIGMA_SB * Math.pow(p.T, 4)) - 1; },
        expect: 0, tol: 0.01 },
      /* 瑞利–金斯是普朗克的长波极限，两者的比只依赖 x = c2/(λT)：
             M_RJ/M_普朗克 = (e^x − 1)/x      （x = hc/(λk_BT)）
         横轴右端 λ = 10λ_max 处 x = c2/(10b) = 0.496511423206，
         所以比值应为 (e^0.496511423206 − 1)/0.496511423206 = 1.294994578。
         （顺带说明为什么瑞利–金斯曲线要在短波端截断：在峰值 x = 4.9651142 处
           这个比值已经是 28.665，整条画出来会把普朗克曲线压成一条贴地的直线。） */
      { name: "长波端 M_RJ/M_普朗克 = (e^x−1)/x = 1.2949946（x = c2/10b = 0.4965）",
        measure: function (o) {
          var i = o.series.rayleigh.length - 1;
          return o.series.rayleigh[i] / o.series.planck[i];
        }, expect: 1.2949946, tol: 1e-4 },
      /* 同一采样点的绝对值：M_RJ(λ) = 2πck_BT/λ⁴，λ = 10b/T = 4996.158543 nm、T = 5800 K
         → 2πck_B T⁵/(10b)⁴ = 2.4208451e11 W/m³（检验 c、k_B 的取值与 1/λ⁴ 的幂次） */
      { name: "长波端 M_RJ = 2πck_BT/λ⁴ = 2.4208451e11 W/m³（λ = 10λ_max）",
        measure: function (o) { return o.series.rayleigh[o.series.rayleigh.length - 1]; },
        expect: 2.4208451e11, tol: 2.42e5 },
      /* 短波端：x≫1 时 M_RJ/M_P ≈ x ≫ 1，即瑞利–金斯远高于普朗克（紫外灾难）。
         取曲线上最靠短波的一个还画得出来的采样点判断大小关系。 */
      { name: "短波端瑞利–金斯已超过普朗克（紫外灾难的方向）",
        measure: function (o) {
          for (var i = 0; i < o.series.rayleigh.length; i++) {
            var v = o.series.rayleigh[i];
            if (typeof v === "number" && isFinite(v)) return v > o.series.planck[i] ? 1 : 0;
          }
          return 0;
        }, expect: 1, tol: 0 },
      /* σT⁴ 的 T⁴ 标度：温度加倍总出射度应为 2⁴ = 16 倍 */
      { name: "总出射度按 T⁴ 标度：T → 2T 时 σT⁴ 变为 16 倍",
        params: { T: 11600 },
        measure: function (o, p) {
          return o.metrics.sigmaT4 / bbCompute({ T: p.T / 2 }).metrics.sigmaT4;
        }, expect: 16, tol: 1e-9 }
    ]
  });

  /* ============================================================ 2. 光电效应 */
  /** 在采样横轴（nm）上取最靠近 lam 的那一点的 E_kmax */
  function ekAtNm(o, lam) {
    var best = 0, bd = Infinity, i, d;
    for (i = 0; i < o.t.length; i++) {
      d = Math.abs(o.t[i] - lam);
      if (d < bd) { bd = d; best = i; }
    }
    return o.series.Ek[best];
  }

  /**
   * 爱因斯坦光电方程：E_kmax = hν − W = hc/λ − W，且 E_kmax ≥ 0（λ > λ_c 时无光电子）。
   *   遏止电压 U₀ = E_kmax/e（数值上就等于以 eV 为单位的 E_kmax）
   *   截止波长 λ_c = hc/W
   * 伏安特性用理想化折线：U ≤ −U₀ 电流为 0；−U₀ < U < 0 线性上升；U ≥ 0 饱和。
   * （真实光电管在截止点附近是圆滑的，这里只保留"遏止电压"这个特征量。）
   */
  function peCompute(p) {
    var n = 601;
    var lamNm = lin(200, 800, n);                        // 横轴 λ (nm)，1 nm 一点
    var Ek = [], i;
    for (i = 0; i < n; i++) {
      var E = HC_EV_NM / lamNm[i] - p.W;
      Ek.push(E > 0 ? E : 0);
    }
    var hNu = HC_EV_NM / p.lambda;                       // 当前工作点的光子能量 (eV)
    var Ek0 = hNu - p.W; if (Ek0 < 0) Ek0 = 0;
    var U0 = Ek0;                                        // 遏止电压 (V)
    var lamC = HC_EV_NM / p.W;                           // 截止波长 (nm)
    var uLo = Math.min(-U0 - 0.5, p.U - 0.2);
    var uHi = Math.max(1, p.U + 0.2);
    var m = 241, ug = lin(uLo, uHi, m), cur = [];
    for (i = 0; i < m; i++) {
      var u = ug[i], I;
      if (U0 <= 0 || u <= -U0) I = 0;
      else if (u >= 0) I = 1;
      else I = (u + U0) / U0;
      cur.push(I);
    }
    var iAt;
    if (U0 <= 0 || p.U <= -U0) iAt = 0;
    else if (p.U >= 0) iAt = 1;
    else iAt = (p.U + U0) / U0;
    var state;
    if (Ek0 <= 0) state = "无光电子（λ > λ_c，加多大电压都没有电流）";
    else if (p.U >= -U0) state = "有光电流（到达阳极还剩 " + fmt(Ek0 + p.U, 3) + " eV）";
    else state = "截止（U < −U₀，反向电场把光电子全部挡回）";
    return {
      t: lamNm,
      series: { Ek: Ek },
      info: [
        { k: "光子能量 hν = hc/λ", v: fmt(hNu, 4) + " eV" },
        { k: "最大初动能 E_kmax = hν − W", v: fmt(Ek0, 4) + " eV" },
        { k: "遏止电压 U₀ = E_kmax/e", v: fmt(U0, 4) + " V" },
        { k: "截止波长 λ_c = hc/W", v: fmt(lamC, 4) + " nm" },
        { k: "外加电压 U", v: fmt(p.U, 4) + " V" },
        { k: "光电流", v: state }
      ],
      bars: [
        { label: "光子能量 hν", value: hNu, color: "#5aa9ff", unit: "eV" },
        { label: "逸出功 W", value: p.W, color: "#ff7b7b", unit: "eV" },
        { label: "最大初动能 E_kmax", value: Ek0, color: "#ffb84d", unit: "eV" }
      ],
      extra: {
        x: ug, y: cur,
        xlabel: "外加电压 U (V)", ylabel: "光电流 I / I_sat",
        title: Ek0 <= 0
          ? "伏安特性（理想化折线）：λ > λ_c，整条曲线都是 0——光电效应有频率下限，与光强无关"
          : "伏安特性（理想化折线）：反向电压到 −U₀ 时电流截止，正向很快饱和",
        markers: [{ x: p.U, y: iAt, label: "工作点" }]
      },
      metrics: { hNu: hNu, Ek0: Ek0, U0: U0, lamC: lamC, iAt: iAt, iu: cur }
    };
  }

  SIM.register("photoelectric", {
    title: "光电效应：最大初动能、遏止电压与截止波长",
    legend: "E_kmax = hν − W 只由光的频率与材料决定，与光强无关；λ 超过 λ_c = hc/W 时，" +
      "无论光多强、电压多大都没有光电子。下面那张图是光电管的伏安特性（理想化折线）。",
    axes: { xlabel: "波长 λ (nm)", ylabel: "最大初动能 E_kmax (eV)" },
    params: {
      lambda: { label: "入射波长 λ", unit: "nm", def: 400, min: 200, max: 800, step: 1 },
      W: { label: "逸出功 W", unit: "eV", def: 2.2, min: 1, max: 6, step: 0.05 },
      U: { label: "外加电压 U", unit: "V", def: 0, min: -5, max: 5, step: 0.1 }
    },
    plots: [
      { key: "Ek", label: "最大初动能 E_kmax (eV)", color: "#ffb84d" }
    ],
    compute: peCompute,
    tests: [
      /* hc/e = 1239.841984 nm·eV；λ = 400 nm、W = 2.2 eV 时
         E_kmax = 1239.841984/400 − 2.2 = 3.09960496 − 2.2 = 0.89960496 eV */
      { name: "E_kmax = hc/λ − W = 0.89960496 eV（λ = 400 nm，W = 2.2 eV）",
        measure: function (o) { return ekAtNm(o, 400); }, expect: 0.89960496, tol: 1e-7 },
      /* U₀ = E_kmax/e：以 eV 为单位的动能数值上就是遏止电压的伏特数 */
      { name: "遏止电压 U₀ = E_kmax/e = 0.89960496 V",
        measure: function (o) { return o.metrics.U0; }, expect: 0.89960496, tol: 1e-7 },
      /* λ_c = hc/W = 1239.841984/2.2 = 563.564538 nm */
      { name: "截止波长 λ_c = hc/W = 563.56454 nm",
        measure: function (o) { return o.metrics.lamC; }, expect: 563.56454, tol: 5.6e-4 },
      /* λ > λ_c 时 hν < W，方程里 E_kmax 取 0（没有光电子） */
      { name: "λ > λ_c 时最大初动能 = 0（λ = 600 nm）",
        params: { lambda: 600 },
        measure: function (o) { return ekAtNm(o, 600); }, expect: 0, tol: 0 },
      /* 能量守恒的另一种写法：E_kmax + W − hc/λ = 0（λ = 300 nm、W = 1.5 eV） */
      { name: "能量守恒 hν = W + E_kmax（λ = 300 nm，W = 1.5 eV）",
        params: { lambda: 300, W: 1.5 },
        measure: function (o) { return ekAtNm(o, 300) + 1.5 - HC_EV_NM / 300; }, expect: 0, tol: 1e-9 },
      /* 伏安特性：U ≤ −U₀ 时电流为 0 */
      { name: "伏安特性：反向电压到 −U₀ 时电流 = 0",
        measure: function (o) { return o.extra.y[0]; }, expect: 0, tol: 0 },
      /* 伏安特性：U ≥ 0 后达到饱和电流（归一化为 1） */
      { name: "伏安特性：U ≥ 0 时达到饱和电流",
        measure: function (o) { return o.extra.y[o.extra.y.length - 1]; }, expect: 1, tol: 0 },
      /* λ > λ_c：一个光电子都没有，伏安特性整条为 0 */
      { name: "λ > λ_c 时伏安特性整条为 0",
        params: { lambda: 600 },
        measure: function (o) {
          var mx = 0, i;
          for (i = 0; i < o.extra.y.length; i++) if (o.extra.y[i] > mx) mx = o.extra.y[i];
          return mx;
        }, expect: 0, tol: 0 }
    ]
  });

  /* ======================================================== 3. 玻尔氢原子 */
  var SERIES_NAME = { 1: "莱曼系", 2: "巴尔末系", 3: "帕申系", 4: "布拉开系", 5: "普丰德系", 6: "汉弗莱系" };
  var LINE_NAME = {
    "1-2": "莱曼α (Lyα)", "1-3": "莱曼β", "1-4": "莱曼γ",
    "2-3": "巴尔末α (Hα)", "2-4": "巴尔末β (Hβ)", "2-5": "巴尔末γ (Hγ)", "2-6": "巴尔末δ (Hδ)",
    "3-4": "帕申α"
  };

  /** 玻尔能级：E_n = −13.605693124 · Z²/n² eV（电离限 E_∞ = 0） */
  function bohrLevel(Z, n) { return -E1_H * Z * Z / (n * n); }

  /**
   * 里德伯公式：1/λ = R∞ Z² (1/nf² − 1/ni²)
   *   ni > nf：发射光子；ni < nf：吸收光子（这里取波长的绝对值，并在读数里注明方向）。
   * 能级差 ΔE = E_ni − E_nf 与 hc/λ 是同一件事的两条独立算法，自检里互相校对。
   */
  function bohrCompute(p) {
    var Z = p.Z, ni = p.ni, nf = p.nf;
    var Ei = bohrLevel(Z, ni), Ef = bohrLevel(Z, nf);
    var dE = Ei - Ef;                                        // > 0 为发射
    var inv = R_INF * Z * Z * (1 / (nf * nf) - 1 / (ni * ni));   // 波数 (m^-1)
    var lamM = inv !== 0 ? Math.abs(1 / inv) : Infinity;     // ni = nf 时无跃迁
    var lamNm = lamM * 1e9;
    var nMax = Math.min(8, Math.max(4, Math.max(ni, nf) + 1));

    var lines = [], n;
    for (n = 1; n <= nMax; n++) {
      lines.push({ x: [0.06, 0.94], y: [bohrLevel(Z, n), bohrLevel(Z, n)],
        label: "n=" + n, color: "#5aa9ff" });
    }
    // 电离限 E = 0：所有束缚态都在它下面
    lines.push({ x: [0.06, 0.94], y: [0, 0], label: "E=0 电离限", color: "#8a93a6", dash: "4 4" });
    // 当前跃迁：竖直线段从 E_nf 到 E_ni
    lines.push({ x: [0.5, 0.5], y: [Ef, Ei],
      label: ni + "→" + nf + (dE >= 0 ? "（发射）" : "（吸收）"), color: "#ffb84d" });

    var markers = [];
    if (isFinite(lamNm)) markers.push({ x: 0.5, y: (Ei + Ef) / 2, label: fmt(lamNm, 4) + " nm" });

    var lineName = LINE_NAME[nf + "-" + ni] || (SERIES_NAME[nf] || ("n=" + nf + " 线系"));
    return {
      t: [], series: {},
      info: [
        { k: "初态能级 E_" + ni, v: fmt(Ei, 6) + " eV" },
        { k: "末态能级 E_" + nf, v: fmt(Ef, 6) + " eV" },
        { k: "光子能量 " + (dE >= 0 ? "hν = E_ni − E_nf" : "hν = E_nf − E_ni"), v: fmt(Math.abs(dE), 6) + " eV" },
        { k: "光子波长 λ（里德伯公式）", v: fmt(lamNm, 6) + " nm" },
        { k: "光子频率 ν = c/λ", v: fmt(isFinite(lamM) ? C_LIGHT / lamM : 0, 4) + " Hz" },
        { k: "波数 1/λ", v: fmt(Math.abs(inv), 6) + " m^-1" },
        { k: "谱线归属", v: lineName + "（Z = " + fmt(Z, 2) + "）" }
      ],
      extra: {
        lines: lines, x: [0, 1], markers: markers,
        xlabel: "位置（示意轴：能级只按能量高低摆放，横坐标没有物理含义）",
        ylabel: "能量 E (eV)",
        title: "能级图与跃迁：E_n = −13.6057·Z²/n² eV，跃迁波长由 1/λ = R∞Z²(1/nf²−1/ni²) 给出"
      },
      metrics: { E_ni: Ei, E_nf: Ef, dE: dE, lamNm: lamNm, lamM: lamM, nMax: nMax }
    };
  }

  SIM.register("bohr", {
    title: "氢原子能级与光谱（玻尔模型）",
    legend: "能级 E_n = −13.6057·Z²/n² eV，跃迁波长由里德伯公式 1/λ = R∞Z²(1/nf²−1/ni²) 给出。" +
      "ni < nf 表示吸收光子。注意：R∞ 对应**无限大核质量**，所以算得 Hα 是 656.11 nm，" +
      "而实验值是 656.28 nm——0.03% 的差别来自电子与原子核的约化质量（真实氢原子用 R_H = R∞/(1+m_e/m_p)）。",
    axes: { xlabel: "位置（示意轴）", ylabel: "能量 E (eV)" },
    params: {
      Z: { label: "核电荷数 Z", unit: "", def: 1, min: 1, max: 3, step: 1 },
      ni: { label: "初态 n_i", unit: "", def: 3, min: 2, max: 8, step: 1 },
      nf: { label: "末态 n_f", unit: "", def: 2, min: 1, max: 7, step: 1 }
    },
    plots: [],
    compute: bohrCompute,
    tests: [
      /* E_n = −13.605693124·Z²/n²，n = 1、Z = 1 → −13.605693124 eV。
         （契约里写的 −13.6057 就是这个数的四舍五入。）这里直接取画出来的 n=1 能级线。 */
      { name: "基态能级 E_1 = −13.605693124 eV（从能级线读出）",
        measure: function (o) { return o.extra.lines[0].y[0]; }, expect: -13.605693124, tol: 1e-9 },
      /* 1/λ = R∞(1/2² − 1/3²) = 1.0973731568160e7 × 5/36 → λ = 656.11228 nm（Hα） */
      { name: "Hα（3→2）波长 = 656.11228 nm（里德伯公式，相对容差 1e-6）",
        params: { ni: 3, nf: 2 },
        measure: function (o) { return o.metrics.lamNm; }, expect: 656.11228, tol: 6.56e-4 },
      /* 1/λ = R∞(1 − 1/2²) = 8.230298676e6 m^-1 → λ = 121.50227 nm（莱曼α） */
      { name: "莱曼α（2→1）波长 = 121.50227 nm（相对容差 1e-6）",
        params: { ni: 2, nf: 1 },
        measure: function (o) { return o.metrics.lamNm; }, expect: 121.50227, tol: 1.215e-4 },
      /* 两条独立路径互校：hc/λ（里德伯公式）应当等于能级差 E_ni − E_nf（玻尔公式） */
      { name: "里德伯公式与能级差自洽：hc/λ − (E_ni − E_nf) = 0（Z=2，5→3）",
        params: { Z: 2, ni: 5, nf: 3 },
        measure: function (o) { return HC_EV_NM / o.metrics.lamNm - (o.metrics.E_ni - o.metrics.E_nf); },
        expect: 0, tol: 1e-6 },
      /* 类氢离子标度：λ ∝ 1/Z²，Z = 2 时波长是 Z = 1 的四分之一 */
      { name: "类氢标度 λ(Z=2)/λ(Z=1) = 1/4",
        params: { Z: 2, ni: 3, nf: 2 },
        measure: function (o, p) { return o.metrics.lamNm / bohrCompute({ Z: 1, ni: p.ni, nf: p.nf }).metrics.lamNm; },
        expect: 0.25, tol: 1e-12 },
      /* 画出来的跃迁线段必须正好跨过 E_ni − E_nf：
         Z=2、5→3 时 ΔE = 13.605693124×4×(1/9 − 1/25) = 3.8700638 eV */
      { name: "跃迁线段跨过的能量 = ΔE = 3.8700638 eV（Z=2，5→3）",
        params: { Z: 2, ni: 5, nf: 3 },
        measure: function (o) {
          var L = o.extra.lines[o.extra.lines.length - 1];
          return Math.abs(L.y[1] - L.y[0]);
        }, expect: 3.8700638, tol: 1e-6 }
    ]
  });

  /* ========================================================== 4. 塞曼效应 */
  /**
   * 正常塞曼效应（自旋为零、g 为朗德因子）：
   *   Δν = g μ_B B / h          —— 相邻磁子能级（Δm = ±1）之间的频率分裂
   *   Δλ = λ₀² Δν / c           —— 由 λ = c/ν 微分得到（|Δλ/λ₀| = |Δν/ν₀|）
   * 三条线：σ⁺（Δm = +1，频率升高、波长变短）、π（Δm = 0，位置不动）、
   *         σ⁻（Δm = −1，频率降低、波长变长）。
   * 横轴用 λ − λ₀（pm）：分裂只有 λ₀ 的 3×10^-5，用绝对波长当横轴的话三条线会叠在一起。
   */
  function zeemanCompute(p) {
    var dNu = p.g * MU_B * p.B / H_PLANCK;                 // Hz
    var lam0M = p.lambda0 * 1e-9;                          // m
    var dLamM = lam0M * lam0M * dNu / C_LIGHT;             // m
    var dLamPm = dLamM * 1e12;                             // pm
    // B = 0 时三条线完全重合：给横轴一个非零宽度，免得坐标变换出现 0/0
    var xHalf = Math.max(2 * dLamPm, 1e-3);
    var lines = [
      { x: [-dLamPm, -dLamPm], y: [0, 1], label: "σ⁺ (Δm=+1)", color: "#5aa9ff" },
      { x: [0, 0], y: [0, 1], label: "π (Δm=0)", color: "#63d6a5" },
      { x: [dLamPm, dLamPm], y: [0, 1], label: "σ⁻ (Δm=−1)", color: "#ff7b7b" }
    ];
    var markers = [
      { x: -dLamPm, y: 1, label: "−" + fmt(dLamPm, 3) + " pm" },
      { x: 0, y: 1, label: "π" },
      { x: dLamPm, y: 1, label: "+" + fmt(dLamPm, 3) + " pm" }
    ];
    var rel = dLamM / lam0M;
    return {
      t: [], series: {},
      info: [
        { k: "塞曼分裂 Δν = gμ_B B/h", v: fmt(dNu, 4) + " Hz" },
        { k: "波长分裂 Δλ = λ₀²Δν/c", v: fmt(dLamPm, 4) + " pm" },
        { k: "总分裂宽度 2Δλ", v: fmt(2 * dLamPm, 4) + " pm" },
        { k: "相对分裂 Δλ/λ₀ = Δν/ν₀", v: fmt(rel, 4) + "（约 1/" + fmt(1 / rel, 3) + "）" },
        { k: "分裂能量 ΔE = hΔν = gμ_B B", v: fmt(H_PLANCK * dNu / E_CHARGE * 1e6, 4) + " μeV" },
        { k: "三条谱线", v: "σ⁺ " + fmt(p.lambda0 - dLamM * 1e9, 4) + " / π " + fmt(p.lambda0, 4) +
            " / σ⁻ " + fmt(p.lambda0 + dLamM * 1e9, 4) + " nm" }
      ],
      extra: {
        lines: lines, x: [-xHalf, xHalf], markers: markers,
        xlabel: "相对中心波长 λ − λ₀ (pm)", ylabel: "相对强度（任意单位）",
        title: "正常塞曼三重线：Δν = gμ_B B/h = " + fmt(dNu / 1e9, 4) + " GHz（横轴单位 pm，1 pm = 10⁻³ nm）"
      },
      metrics: {
        dNu: dNu, dLamPm: dLamPm, lam0: p.lambda0,
        sigmaPlus: p.lambda0 - dLamM * 1e9, pi: p.lambda0, sigmaMinus: p.lambda0 + dLamM * 1e9,
        iu: lines
      }
    };
  }

  SIM.register("zeeman", {
    title: "塞曼效应：磁场中的谱线分裂",
    legend: "Δν = gμ_B B/h（g = 1、B = 1 T 时约 14.0 GHz），Δλ = λ₀²Δν/c。" +
      "三条线：σ⁺（Δm=+1，波长变短）、π（Δm=0，不动）、σ⁻（Δm=−1，波长变长）；" +
      "横轴取 λ − λ₀ 是因为分裂只有 λ₀ 的万分之几，用绝对波长画三条线会完全重叠。",
    axes: { xlabel: "相对中心波长 λ − λ₀ (pm)", ylabel: "相对强度" },
    params: {
      B: { label: "磁感应强度 B", unit: "T", def: 1, min: 0, max: 5, step: 0.1 },
      lambda0: { label: "中心波长 λ₀", unit: "nm", def: 589, min: 200, max: 800, step: 1 },
      g: { label: "朗德因子 g", unit: "", def: 1, min: 0.5, max: 3, step: 0.1 }
    },
    plots: [],
    compute: zeemanCompute,
    tests: [
      /* Δν = gμ_B B/h = 9.2740100783e-24 × 1 × 1 / 6.62607015e-34 = 1.39962449e10 Hz */
      { name: "塞曼分裂 Δν = gμ_B B/h = 1.3996245e10 Hz（g = 1，B = 1 T）",
        measure: function (o) { return o.metrics.dNu; }, expect: 1.3996245e10, tol: 5e3 },
      /* 画出来的 σ⁻ 与 σ⁺ 间距 = 2Δλ = 2λ₀²Δν/c = 32.39302 pm（λ₀ = 589 nm） */
      { name: "两条 σ 线的间距 2Δλ = 32.39302 pm（画出的谱线位置之差）",
        measure: function (o) {
          var L = o.extra.lines;
          return L[2].x[0] - L[0].x[0];
        }, expect: 32.39302, tol: 0.0324 },
      /* Δλ = λ₀²Δν/c = 16.19651 pm */
      { name: "波长分裂 Δλ = λ₀²Δν/c = 16.19651 pm",
        measure: function (o) { return o.metrics.dLamPm; }, expect: 16.19651, tol: 0.0162 },
      /* 对称性：σ⁺ 与 σ⁻ 关于 λ₀ 严格对称（横轴上关于 0 对称） */
      { name: "σ⁺ 与 σ⁻ 关于中心波长对称（横轴上关于 0 对称）",
        measure: function (o) {
          var L = o.extra.lines;
          return (L[0].x[0] + L[2].x[0]) / 2;
        }, expect: 0, tol: 1e-9 },
      /* λ = c/ν 微分：Δλ/λ₀ = Δν/ν₀（两条路径算出来的相对分裂必须相等） */
      { name: "相对分裂自洽：Δλ/λ₀ − Δν/ν₀ = 0",
        measure: function (o, p) {
          var lam0M = p.lambda0 * 1e-9;
          return (o.metrics.dLamPm * 1e-12 / lam0M) - (o.metrics.dNu / (C_LIGHT / lam0M));
        }, expect: 0, tol: 1e-14 },
      /* 线性标度：Δν ∝ gB，g = 2、B = 3 T 时是 g = 1、B = 1 T 的 6 倍 */
      { name: "Δν 与 gB 成正比：g=2、B=3 T 时为 6 倍",
        params: { g: 2, B: 3 },
        measure: function (o, p) {
          return o.metrics.dNu / zeemanCompute({ g: 1, B: 1, lambda0: p.lambda0 }).metrics.dNu;
        }, expect: 6, tol: 1e-12 }
    ]
  });
})(typeof window !== "undefined" ? window : globalThis);
