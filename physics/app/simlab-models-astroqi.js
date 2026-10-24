/* ==========================================================================
   simlab-models-astroqi.js —— 天体与宇宙 + 量子信息 仿真模型（W5 契约 §13.A.3 / §13.A.4，4 个）

     · stellar      恒星结构与赫罗图：L ∝ M^3.5、主序寿命、质量-半径关系、爱丁顿光度上限
     · cosmology    膨胀宇宙：Friedmann 方程数值解、哈勃时间、光度距离、单成分幂律
     · bloch-gates  量子门与布洛赫球：X/H/Rz/Rx/T 门、P(1) 演化、布洛赫矢量长度 = 1
     · decoherence  退相干与混合态：退相位 |ρ₀₁| ∝ e^{−t/T₂}、振幅阻尼 P(1) ∝ e^{−t/T₁}

   ★ 约束（与 simlab.js 顶部一致）：
     · 加载时**只调用 SIM.register**，绝不触碰 DOM —— tools/verify-simlab.mjs 在 Node 里
       用 window 桩直接跑 compute() 与 tests 做物理不变量自检；
     · **不调用 Math.random**（本文件根本不需要随机数）；
     · 纯 ES5：var / 无箭头函数 / 无模板字符串 / 无 import-export；
     · 边界安全：任意参数取值都不抛异常、不出 NaN/Infinity。四处重点专门处理：
         – cosmology：Ω_m+Ω_Λ≠1 ⇒ Ω_k=1−Ω_m−Ω_Λ，闭合宇宙会**折返**（大挤压）甚至**反弹**
           （Ω_Λ 主导 + 负曲率时 E²(a)<0 的最小尺度因子），积分起点与截断见 §2 注释；
         – stellar：M→0 时 t_MS ∝ M^{−2.5} 发散 ⇒ 质量先夹到 [0.05, 60] 再进公式；
         – decoherence：T→0 时 e^{−t/T} 的指数爆炸 ⇒ 时间常数先夹到 ≥1e-6 μs；
         – bloch-gates：角度先归一到 [0, 360) 再转弧度（360° ≡ 0°，Rx(360°) = −I 同一布洛赫矢量）。

   物理常量（数值照抄 app/constants.js 的 CODATA 2018 / 2019 SI 定义值，不凭记忆另写）：
     G    = 6.674 30×10^-11 m³/(kg·s²)      M_☉ = 1.988 409 9×10^30 kg（= GM_☉/G，GM_☉ = 1.327 124 4×10^20）
     L_☉  = 3.828×10^26 W                   m_p = 1.672 621 923 69×10^-27 kg
     c    = 2.997 924 58×10^8 m/s           pc  = 3.085 677 581×10^16 m
     h    = 6.626 070 15×10^-34 J·s         k_B = 1.380 649×10^-23 J/K
     σ_SB = 5.670 374 419×10^-8 W/(m²·K⁴)（由 k_B、h、c 组合，精确值）
   另有几个 constants.js 未列、但本节必需的常量（来源写清，不凭记忆）：
     σ_T = 6.652 458 7321×10^-29 m²（Thomson 散射截面，CODATA 2018）——爱丁顿光度用它；
     R_☉ = 6.957×10^8 m、T_eff☉ = 5772 K（IAU 2015 名义太阳值；与 L_☉ = 4πR²σT⁴ 自洽到 0.001%）；
     儒略年 = 365.25 d = 3.155 76×10^7 s（constants.js 里 "ly" 就是按它定义的），
     1 Mpc = 3.085 677 581×10^22 m。
   ========================================================================== */
(function (global) {
  "use strict";
  var SIM = global.SIM;
  if (!SIM) return;   // 在 Node 里若未先加载 simlab.js，安静退出

  var rk4 = SIM.rk4, lin = SIM.linspace, fmt = SIM.fmt, opt = SIM.opt;

  /* ------------------------------------------------------------- 物理常量 */
  var PI = Math.PI;
  var G_C = 6.67430e-11;             // 引力常量 G
  var C_LIGHT = 2.99792458e8;        // 光速 c
  var M_SUN = 1.3271244e20 / 6.67430e-11;   // 太阳质量 M_☉ = GM_☉/G（IAU 2015 名义 GM_☉ 除以 CODATA G）
                                     //   与 app/constants.js 的表值 1.988 409 9×10^30 kg 同源；
                                     //   曾经硬编码 1.98892e30，那会让 G×M_☉ 与 GM_☉ 差 2.6×10^-4（与常量表不一致）
  var L_SUN = 3.828e26;              // 太阳光度 L_☉
  var R_SUN = 6.957e8;               // 太阳半径 R_☉（IAU 2015 名义值）
  var M_P = 1.67262192369e-27;       // 质子质量 m_p
  var SIGMA_T = 6.6524587321e-29;    // Thomson 截面 σ_T（CODATA 2018）
  var SIGMA_SB = 5.670374419e-8;     // 斯特藩－玻尔兹曼常量 σ
  var TEFF_SUN = 5772;               // 太阳有效温度（IAU 2015 名义值）
  var PC_M = 3.085677581e16;         // 秒差距
  var MPC_M = PC_M * 1e6;            // 1 Mpc = 3.085 677 581×10^22 m
  var YR_S = 3.15576e7;              // 儒略年
  var GYR_S = YR_S * 1e9;            // 十亿年
  var C_KMS = 2.99792458e5;          // 光速 km/s（距离换算用）

  /* --------------------------------------------------------------- 小工具 */
  function clampNum(v, lo, hi, defv) {
    var x = Number(v);
    if (!isFinite(x)) x = defv;
    return x < lo ? lo : (x > hi ? hi : x);
  }
  function clampInt(v, lo, hi, defv) {
    var x = Math.round(Number(v));
    if (!isFinite(x)) x = defv;
    return x < lo ? lo : (x > hi ? hi : x);
  }
  /** 全部取值有限（自检用：扫参数范围时判定"无 NaN/Infinity"） */
  function allFinite(arr) {
    var i;
    for (i = 0; i < arr.length; i++) {
      if (typeof arr[i] !== "number" || !isFinite(arr[i])) return false;
    }
    return true;
  }
  /** 最小二乘斜率（双对数斜率自检直接从 series 现算，不用模型自报） */
  function lsqSlope(xs, ys) {
    var n = Math.min(xs.length, ys.length), i, x, y;
    var sx = 0, sy = 0, sxx = 0, sxy = 0;
    if (n < 2) return NaN;
    for (i = 0; i < n; i++) {
      x = xs[i]; y = ys[i];
      if (!isFinite(x) || !isFinite(y)) return NaN;
      sx += x; sy += y; sxx += x * x; sxy += x * y;
    }
    var den = n * sxx - sx * sx;
    if (Math.abs(den) < 1e-300) return NaN;
    return (n * sxy - sx * sy) / den;
  }
  /** 在单调不减的网格 xs 上线性插值取 y（自检定位"太阳处"这类锚点用） */
  function valAt(xs, ys, target) {
    var n = Math.min(xs.length, ys.length), i;
    if (n === 0) return NaN;
    if (n === 1) return ys[0];
    if (target <= xs[0]) return ys[0];
    if (target >= xs[n - 1]) return ys[n - 1];
    for (i = 1; i < n; i++) {
      if (xs[i] >= target) {
        var dx = xs[i] - xs[i - 1];
        if (!(Math.abs(dx) > 1e-300)) return ys[i];
        return ys[i - 1] + (ys[i] - ys[i - 1]) * (target - xs[i - 1]) / dx;
      }
    }
    return ys[n - 1];
  }
  /** 复振幅→布洛赫矢量（|ψ⟩ = a₀|0⟩ + a₁|1⟩，ρ₀₁ = a₀a₁*）：
        b_x = 2Re ρ₀₁ = 2(r₀r₁ + i₀i₁)
        b_y = −2Im ρ₀₁ = 2(r₀i₁ − i₀r₁)
        b_z = |a₀|² − |a₁|² = P(0) − P(1)                             */
  function qBloch(r0, i0, r1, i1) {
    return [2 * (r0 * r1 + i0 * i1), 2 * (r0 * i1 - i0 * r1),
      (r0 * r0 + i0 * i0) - (r1 * r1 + i1 * i1)];
  }
  function qNorm(b) { return Math.sqrt(b[0] * b[0] + b[1] * b[1] + b[2] * b[2]); }
  function qDist(a, b) { return qNorm([a[0] - b[0], a[1] - b[1], a[2] - b[2]]); }
  /** 复数格式化（末态读数用） */
  function cplx(re, im) {
    if (Math.abs(im) < 1e-12) return fmt(re, 3);
    return fmt(re, 3) + (im < 0 ? " − " : " + ") + fmt(Math.abs(im), 3) + "i";
  }

  /* ==========================================================================
     1. stellar —— 恒星结构与赫罗图

     全部用幂律近似（太阳单位），四个解析关系：
       ① 光度-质量关系     L/L☉ = (M/M☉)^3.5                （双对数斜率 3.5）
       ② 主序寿命          t_MS = 1.0×10^10 yr·(M/M☉)^{−2.5}
          来源：核燃料 ∝ M（可供燃烧的氢约占 10%），消耗率 ∝ L ∝ M^3.5
          ⇒ t ∝ M/L ∝ M^{−2.5}，归一化到太阳 1.0×10^10 年。
       ③ 质量-半径关系     R/R☉ = (M/M☉)^0.8  (M ≤ 1)、= (M/M☉)^0.57 (M > 1)
          两段在 M = 1 处连续且 R(1) = 1 R☉，整段单调增（契约 ④）。
       ④ 爱丁顿光度        L_Edd = 4πGMm_p c/σ_T = 1.257 4×10^31 W·(M/M☉)
          推导：辐射压对电子的推力 σ_T L/(4πr²c) 与引力 GMm_p/r² 相等，
          与 r 无关 ⇒ 超过它外层就被辐射压吹走。这里按**纯氢**取每个电子对应 m_p。
       有效温度由 Stefan–Boltzmann 反解：
          T_eff = T_eff☉·(L/L☉)^{1/4}/(R/R☉)^{1/2}，  T_eff☉ = 5772 K
       （自检 ⑤ 会把 L = 4πR²σT_eff⁴ 再算回去，验证两个方向的round-trip 一致。）
     开尔文－亥姆霍兹时标 t_KH = GM²/(RL)（引力收缩供能能撑多久）给主序寿命做对照：
       太阳 3.14×10^7 yr，比核时标短 300 倍——这正是"恒星靠核聚变而不是靠收缩"的定量证据。
     ========================================================================== */
  var ST_KINDS = ["主序位置", "光度-质量关系", "主序寿命"];   // 选项名逐字按契约 §13.A.3
  var ST_N = 121;                    // 质量网格点数（对数等距）
  var ST_M_LO = 0.1, ST_M_HI = 30;   // 与滑块范围一致
  var ST_M_MIN = 0.05, ST_M_MAX = 60;
  var ST_TMS_SUN = 1.0e10;           // 太阳主序寿命（契约 ② 的归一化）
  // L_Edd(M☉) = 4πG M☉ m_p c/σ_T = 1.257 388×10^31 W（数值 1.257 4×10^31，与契约的 1.257×10^31 差 0.03%）
  var ST_LEDD_SUN = 4 * PI * G_C * M_SUN * M_P * C_LIGHT / SIGMA_T;
  // t_KH(M☉) = G M☉²/(R☉ L☉) = 3.141 5×10^7 yr
  var ST_TKH_SUN = G_C * M_SUN * M_SUN / (R_SUN * L_SUN) / YR_S;

  function stL(M) { return Math.pow(M, 3.5); }                                   // L/L☉
  function stR(M) { return M <= 1 ? Math.pow(M, 0.8) : Math.pow(M, 0.57); }      // R/R☉
  function stTeff(M) { return TEFF_SUN * Math.pow(stL(M), 0.25) / Math.sqrt(stR(M)); }
  function stLife(M) { return ST_TMS_SUN * Math.pow(M, -2.5); }                  // yr
  function stLedd(M) { return ST_LEDD_SUN * M; }                                 // W
  function stLKH(M) { return ST_TKH_SUN * M * M / (stR(M) * stL(M)); }           // yr

  function stCompute(p) {
    var kind = clampInt(p.kind, 0, 2, 0);
    var Mcur = clampNum(p.M, ST_M_MIN, ST_M_MAX, 1);

    /* 质量网格（对数等距）：所有视角共用同一套网格 */
    var lm = [], L = [], R = [], Teff = [], tms = [], ledd = [], tkh = [], i, Mi;
    for (i = 0; i < ST_N; i++) {
      lm.push(Math.log(ST_M_LO) / Math.LN10 + (Math.log(ST_M_HI / ST_M_LO) / Math.LN10) * i / (ST_N - 1));
      Mi = Math.pow(10, lm[i]);
      L.push(stL(Mi)); R.push(stR(Mi)); Teff.push(stTeff(Mi));
      tms.push(stLife(Mi)); ledd.push(stLedd(Mi)); tkh.push(stLKH(Mi));
    }
    var logL = [], logT = [], logTms = [], logTkh = [], logLedd = [];
    for (i = 0; i < ST_N; i++) {
      logL.push(Math.log(L[i]) / Math.LN10);
      logT.push(Math.log(Teff[i]) / Math.LN10);
      logTms.push(Math.log(tms[i]) / Math.LN10);
      logTkh.push(Math.log(tkh[i]) / Math.LN10);
      logLedd.push(Math.log(ledd[i]) / Math.LN10);
    }

    /* 当前恒星 */
    var Lc = stL(Mcur), Rc = stR(Mcur), Tc = stTeff(Mcur);
    var tmsc = stLife(Mcur), leddc = stLedd(Mcur), tkhc = stLKH(Mcur);
    // L/L_Edd。注意单位：stL 返回的是 L☉（无量纲太阳单位），stLedd 返回的是 W，
    // 必须先把 L 换成 W 再比，否则量纲不一致（曾经写成 leddc/Lc，读数大了 9 个数量级还倒了过来）。
    var ratio = (Lc * L_SUN) / leddc;             // L/L_Edd（超爱丁顿就吹风/不能稳态吸积）

    /* 主图：视角决定横轴与曲线 */
    var t = [], series = {}, xlabelHint;
    if (kind === 0) {
      /* 赫罗图：x = log₁₀(T_eff/K) 升序（注意天文习惯把温度轴画成"左热右冷"，这里按数值升序） */
      t = logT;
      series.hr = logL;
      series.hrEdd = logLedd;
      xlabelHint = "赫罗图：横轴 log₁₀(T_eff/K)（数值升序，天文习惯左热右冷）";
    } else if (kind === 1) {
      t = lm;
      series.lm = logL;
      series.lmEdd = logLedd;
      xlabelHint = "光度-质量关系：横轴 log₁₀(M/M☉)，纵轴 log₁₀(L/L☉)";
    } else {
      t = lm;
      series.life = logTms;
      series.lifeKH = logTkh;
      xlabelHint = "主序寿命：横轴 log₁₀(M/M☉)，纵轴 log₁₀(t/yr)";
    }

    /* 第二张图（各视角各有侧重） */
    var lines = [], markers = [];
    if (kind === 0) {
      /* 完整赫罗图：主序轨迹 + 等半径线（L = 4πR²σT⁴ 在双对数平面是斜率 4 的直线）+ 当前星 */
      var cR = Math.log(4 * PI * SIGMA_SB * R_SUN * R_SUN / L_SUN) / Math.LN10;   // = −15.0453
      var Rs = [0.3, 1, 3, 10, 30], j, xs = [];
      for (i = 0; i <= 60; i++) xs.push(3.2 + (4.9 - 3.2) * i / 60);
      lines.push({
        x: logT.slice(), y: logL.slice(),
        label: "零龄主序（本模型的幂律近似）", color: "#ffb84d"
      });
      for (j = 0; j < Rs.length; j++) {
        var ys = [];
        for (i = 0; i < xs.length; i++) {
          ys.push(cR + 2 * (Math.log(Rs[j]) / Math.LN10) + 4 * xs[i]);
        }
        lines.push({
          x: xs.slice(), y: ys,
          label: (j === 0 ? "等半径线 R = 0.3/1/3/10/30 R☉" : ""),
          color: "#7fd8e8", dash: "4 3"
        });
      }
      markers.push({
        x: Math.log(Tc) / Math.LN10, y: Math.log(Lc) / Math.LN10,
        label: "当前 M = " + fmt(Mcur, 3) + " M☉"
      });
    } else if (kind === 1) {
      /* L–M：解析直线 log L = 3.5 log M 与数值曲线叠在一起（两条应完全重合） */
      var lxs = [lm[0], lm[ST_N - 1]], lys = [3.5 * lm[0], 3.5 * lm[ST_N - 1]];
      lines.push({ x: lxs, y: lys, label: "解析 L = M^3.5", color: "#ff7b7b", dash: "5 4" });
      lines.push({ x: lm.slice(), y: logL.slice(), label: "模型数值曲线", color: "#ffb84d" });
      var Ms = [0.1, 0.3, 1, 3, 10, 30];
      for (j = 0; j < Ms.length; j++) {
        markers.push({
          x: Math.log(Ms[j]) / Math.LN10, y: Math.log(stL(Ms[j])) / Math.LN10,
          label: "M=" + fmt(Ms[j], 3)
        });
      }
    } else {
      /* 寿命：主序（核）时标 vs 开尔文－亥姆霍兹（引力收缩）时标 */
      lines.push({ x: lm.slice(), y: logTms.slice(), label: "核时标 t_MS ∝ M^{−2.5}", color: "#63d6a5" });
      lines.push({ x: lm.slice(), y: logTkh.slice(), label: "开尔文－亥姆霍兹时标 t_KH", color: "#c792ea", dash: "4 3" });
      markers.push({
        x: Math.log(Mcur) / Math.LN10, y: Math.log(tmsc) / Math.LN10,
        label: "当前 " + fmt(tmsc / 1e9, 3) + " Gyr"
      });
    }

    var info = [
      { k: "质量 M", v: fmt(Mcur, 4) + " M☉ = " + fmt(Mcur * M_SUN, 4) + " kg" },
      { k: "光度 L（L = M^3.5）", v: fmt(Lc, 4) + " L☉ = " + fmt(Lc * L_SUN, 4) + " W" },
      { k: "有效温度 T_eff", v: fmt(Tc, 5) + " K（由 L = 4πR²σT⁴ 反解）" },
      { k: "半径 R", v: fmt(Rc, 4) + " R☉ = " + fmt(Rc * R_SUN, 4) + " m"
        + "（M–R 幂律指数 " + (Mcur <= 1 ? "0.8" : "0.57") + "）" },
      { k: "主序寿命 t_MS = 1×10^10 yr·M^{−2.5}", v: fmt(tmsc, 4) + " yr = " + fmt(tmsc / 1e9, 4) + " Gyr" },
      { k: "爱丁顿光度 L_Edd = 4πGMm_p c/σ_T", v: fmt(leddc, 4) + " W = " + fmt(leddc / L_SUN, 4) + " L☉" },
      { k: "L / L_Edd", v: fmt(ratio, 6) + (ratio > 1 ? "（超过爱丁顿极限：辐射压会吹散外层）"
        : "（低于爱丁顿极限 " + fmt(1 / ratio, 3) + " 倍）") },
      { k: "引力收缩时标 t_KH = GM²/(RL)", v: fmt(tkhc, 4) + " yr（t_MS/t_KH = " + fmt(tmsc / tkhc, 4) + "）" },
      { k: "当前视角", v: opt(ST_KINDS, kind) + "　" + xlabelHint }
    ];

    return {
      t: t,
      series: series,
      info: info,
      extra: {
        lines: lines,
        markers: markers,
        xlabel: (kind === 0) ? "log₁₀(T_eff / K)" : "log₁₀(M / M☉)",
        ylabel: (kind === 2) ? "log₁₀(t / yr)" : "log₁₀(L / L☉)",
        title: (kind === 0) ? "赫罗图：主序轨迹与等半径线（斜率 4 的直线 = 同一半径）"
          : (kind === 1 ? "L–M 关系：数值曲线与解析幂律重合" : "两种时标对照：核时标 ≫ 引力收缩时标")
      },
      metrics: {
        kind: kind, M: Mcur,
        lmGrid: lm, lGrid: L, rGrid: R, teffGrid: Teff, tmsGrid: tms, leddGrid: ledd, tkhGrid: tkh,
        star: { M: Mcur, L: Lc, R: Rc, Teff: Tc, tms: tmsc, ledd: leddc, tkh: tkhc },
        eddRatio: ratio,
        leddSun: ST_LEDD_SUN, tmsSun: ST_TMS_SUN, tkhSun: ST_TKH_SUN,
        lmSlope: lsqSlope(lm, logL), lifeSlope: lsqSlope(lm, logTms),
        logLGrid: logL, logTGrid: logT
      }
    };
  }

  SIM.register("stellar", {
    title: "恒星结构与赫罗图",
    legend: "全部用太阳单位的幂律近似：L/L☉ = (M/M☉)^3.5、t_MS = 1×10^10 yr·(M/M☉)^{−2.5}、"
      + "R/R☉ = M^0.8（M≤1）/ M^0.57（M>1），T_eff 由 L = 4πR²σT_eff⁴ 反解（T_eff☉ = 5772 K）。"
      + "爱丁顿光度 L_Edd = 4πGMm_p c/σ_T ≈ 1.257×10^31 W·(M/M☉) —— 纯氢假设下辐射压与引力平衡的上限。"
      + "注意赫罗图的横轴是 log₁₀T_eff 的**数值升序**（天文习惯把它画成左热右冷），等半径线在其中是斜率 4 的直线。",
    axes: {
      xlabel: "横轴：log₁₀(T_eff/K)（赫罗图视角）或 log₁₀(M/M☉)（其余视角）",
      ylabel: "纵轴：log₁₀(L/L☉) 或 log₁₀(t/yr)"
    },
    params: {
      M: { label: "恒星质量 M", unit: "M☉", def: 1, min: 0.1, max: 30, step: 0.1 },
      kind: { label: "视角", type: "enum", options: ST_KINDS, def: 0 }
    },
    plots: [
      { key: "hr", label: "log₁₀(L/L☉)（主序）", color: "#ffb84d" },
      { key: "hrEdd", label: "log₁₀(L_Edd/L☉)（爱丁顿极限）", color: "#ff7b7b", dash: "5 4" },
      { key: "lm", label: "log₁₀(L/L☉)", color: "#ffb84d" },
      { key: "lmEdd", label: "log₁₀(L_Edd/L☉)", color: "#ff7b7b", dash: "5 4" },
      { key: "life", label: "log₁₀(t_MS/yr)", color: "#63d6a5" },
      { key: "lifeKH", label: "log₁₀(t_KH/yr)", color: "#c792ea", dash: "4 3" }
    ],
    compute: stCompute,
    tests: [
      /* ① L = M^3.5 ⇒ 双对数斜率 3.5（斜率由 tests 自己用最小二乘从 series 现算） */
      { name: "① 光度-质量关系 L ∝ M^3.5：双对数斜率 = 3.5（容差 1e-9）",
        params: { kind: 1, M: 1 },
        measure: function (o) { return lsqSlope(o.t, o.series.lm); }, expect: 3.5, tol: 1e-9 },
      /* ② 主序寿命 t ∝ M/L ∝ M^{−2.5}：双对数斜率 −2.5 */
      { name: "② 主序寿命 t ∝ M/L ∝ M^{−2.5}：双对数斜率 = −2.5（容差 1e-9）",
        params: { kind: 2, M: 1 },
        measure: function (o) { return lsqSlope(o.t, o.series.life); }, expect: -2.5, tol: 1e-9 },
      { name: "②' 太阳的主序寿命 t_MS(1 M☉) = 1.0×10^10 年（从曲线插值，容差 1e-6 相对）",
        params: { kind: 2, M: 1 },
        measure: function (o) { return Math.pow(10, valAt(o.t, o.series.life, 0)); }, expect: 1e10, tol: 1e4 },
      /* ③ 爱丁顿光度：4πGM☉m_p c/σ_T = 1.257×10^31 W（容差 1%） */
      { name: "③ 爱丁顿光度 L_Edd = 4πGMm_p c/σ_T = 1.257×10^31 W（M = M☉，容差 1%）",
        params: { kind: 0, M: 1 },
        measure: function (o) { return o.metrics.leddSun; }, expect: 1.257e31, tol: 1.257e29 },
      { name: "③' 同上换算成太阳光度：L_Edd/L☉ = 3.28×10^4（M = M☉，容差 1%）",
        params: { kind: 0, M: 1 },
        measure: function (o) { return o.metrics.leddSun / L_SUN; }, expect: 3.28e4, tol: 328 },
      /* ③'' L/L_Edd 必须是"光度 ÷ 爱丁顿光度"且量纲一致：
         M=1 时 = L☉/(1.257e31 W) = 3.044e-5；M=20 时 = 20^3.5·L☉/(20·1.257e31 W) = 5.446e-2。
         这条自检是为一个真实 bug 加的：曾把 ratio 写成 leddc/Lc（单位混了 W 与 L☉，方向还倒了），
         读数显示成 1.26e31 这种"远超爱丁顿极限"的荒谬值。 */
      { name: "③'' L/L_Edd 量纲与方向正确（M = M☉ 时 = 3.044×10^−5）",
        params: { kind: 0, M: 1 },
        measure: function (o) { return o.metrics.eddRatio; }, expect: 3.0444e-5, tol: 3.1e-7 },
      { name: "③''' L/L_Edd 随质量上升（M=20 M☉ 时 = 5.446×10^−2，仍小于 1）",
        params: { kind: 0, M: 20 },
        measure: function (o) { return o.metrics.eddRatio; }, expect: 5.4457e-2, tol: 5.5e-4 },
      /* ④ 质量-半径关系单调增，且在太阳处归一（R 有 M=1 的幂律折点，归一化用 metrics.star 取值） */
      { name: "④ 质量-半径关系 R(M) 随 M 单调增，且 R(1 M☉) = 1 R☉（逐点）",
        params: { kind: 0, M: 1 },
        measure: function (o) {
          var r = o.metrics.rGrid, i, bad = 0;
          for (i = 1; i < r.length; i++) { if (!(r[i] > r[i - 1])) bad++; }
          if (Math.abs(o.metrics.star.R - 1) > 1e-12) bad++;
          return bad;
        }, expect: 0, tol: 0 },
      /* ⑤ Stefan–Boltzmann 往返自洽：用 R、T_eff 反算 L 必须回到 L(M)。
            残差 2.4×10^-6 来自 IAU 名义常数的取整（4πR☉²σT☉⁴ = 3.827991×10^26 W，
            而 L☉ 的名义值是 3.828×10^26 W），不是模型误差 —— 容差按这个量级取 1e-5。 */
      { name: "⑤ Stefan–Boltzmann 自洽：L = 4πR²σT_eff⁴（逐点相对偏差 < 1e-5，名义常数取整给出 2.4×10^-6）",
        params: { kind: 0, M: 1 },
        measure: function (o) {
          var g = o.metrics, i, worst = 0, want, dev;
          for (i = 0; i < g.lmGrid.length; i++) {
            want = 4 * PI * Math.pow(g.rGrid[i] * R_SUN, 2) * SIGMA_SB * Math.pow(g.teffGrid[i], 4) / L_SUN;
            dev = Math.abs(want - g.lGrid[i]) / g.lGrid[i];
            if (dev > worst) worst = dev;
          }
          return worst;
        }, expect: 0, tol: 1e-5 },
      /* ⑥ 太阳处归一：L = 1 L☉、T_eff = 5772 K（L 从曲线插值，T_eff 取 metrics.star） */
      { name: "⑥ 太阳处归一：L(1 M☉) = 1 L☉、T_eff(1 M☉) = 5772 K（容差 1e-12）",
        params: { kind: 1, M: 1 },
        measure: function (o) {
          var L1 = Math.pow(10, valAt(o.t, o.series.lm, 0));
          var T1 = o.metrics.star.Teff;
          return Math.abs(L1 - 1) + Math.abs(T1 / TEFF_SUN - 1);
        }, expect: 0, tol: 1e-12 },
      /* ⑦ 边界安全：M→0 与 M→60、三种视角下所有输出必须有限（t_MS ∝ M^{−2.5} 会发散，靠夹取挡住） */
      { name: "⑦ 边界安全：M ∈ [0.05, 60]、三种视角下曲线与读数全部有限（无 NaN/Infinity）",
        params: { kind: 0, M: 1 },
        measure: function () {
          var Ms = [0.05, 0.1, 0.2, 1, 5, 30, 60, 0, -3, 1e6], ks = [0, 1, 2];
          var i, j, bad = 0, o2, key;
          for (i = 0; i < ks.length; i++) {
            for (j = 0; j < Ms.length; j++) {
              o2 = stCompute({ kind: ks[i], M: Ms[j] });
              if (!allFinite(o2.t)) bad++;
              for (key in o2.series) { if (o2.series.hasOwnProperty(key) && !allFinite(o2.series[key])) bad++; }
              if (!allFinite(o2.metrics.rGrid) || !allFinite(o2.metrics.tmsGrid)) bad++;
            }
          }
          return bad;
        }, expect: 0, tol: 0 }
    ]
  });

  /* ==========================================================================
     2. cosmology —— 膨胀宇宙（Friedmann 方程数值解）

     弗里德曼方程（本模型取 Ω_r = 0，把辐射并进"极早期由物质项主导"的简化；见下面说明）：
        H(a)² = H₀²·[ Ω_m/a³ + Ω_k/a² + Ω_Λ ]，   Ω_k = 1 − Ω_m − Ω_Λ
        da/dt = H(a)·a                            ← 用引擎的 rk4 积分
     为什么必须带 Ω_k（曲率项）：
       · 契约 ② 的"平坦宇宙"是 Ω_m+Ω_Λ = 1 这一条，言下之意 Ω_m+Ω_Λ ≠ 1 时**不平坦**，
         那就得有 Ω_k 项，否则 Ω_m+Ω_Λ 的两个数根本进不了同一个方程；
       · Ω_m+Ω_Λ > 1（闭合，Ω_k<0）时 a(t) 会**折返**：H²=0 处 a_turn 就是最大尺度因子，
         之后收缩到大挤压 —— 这正是任务里点名的"折返"边界情形，没有 Ω_k 就演示不出来。
     数值细节（都是"任意滑块都不出 NaN"这条硬约束逼出来的）：
       · **时间网格按几何级数分段**（czGeoRk4）：早期 a ∝ t^{2/3} 的相对变化率 ∝ 1/t，
         均匀网格在 t→0 处完全分辨不了，实测会让整条 a(t) 平移 0.019 Gyr；
       · 起始 a₀ = 1e-4，起始**时刻**由解析早期解反解（物质主导 / Milne / de Sitter 三支）；
         若 E²(a₀) ≤ 0（Ω_Λ 主导 + 负曲率时存在**最小尺度因子**，是"反弹"而不是大爆炸），
         就沿 a 向上找第一个 E²>0 的允许点；
       · 折返后 a→0 时 H→∞：一旦 a 掉到 1e-6 以下或非有限，**整条曲线就地截断**
         （t 与所有 series 同步截断，长度始终一致）；
       · E² ≤ 0 一律取 E = 0（导数有限，不会 sqrt 出 NaN）。
     解析锚点（自检用）：
       · 哈勃时间 1/H₀：H₀ = 70 km/s/Mpc = 70×10³/(3.085 677 581×10²²) s⁻¹
         ⇒ 1/H₀ = 4.408×10^17 s = 13.97 Gyr（契约 ①）
       · 单成分极限：物质 a ∝ t^{2/3}、辐射 a ∝ t^{1/2}、Λ 主导 a ∝ e^{H₀t}
       · 光度距离 d_L = (1+z)·d_M，平坦时 d_M = ∫₀^z c dz′/H(z′)（契约 ④ 的公式）
         非平坦时 d_M = (c/H₀)·(1/√|Ω_k|)·sinn(√|Ω_k|·χ)，χ = ∫₀^z dz′/E(z′)，
         sinn = sinh（Ω_k>0，开放）/ sin（Ω_k<0，闭合）；平坦时严格退化成契约公式。
       · 减速参数 q₀ = Ω_m/2 − Ω_Λ（辐射忽略）
     ========================================================================== */
  var CZ_KINDS = ["尺度因子演化", "红移-距离", "哈勃图"];
  var CZ_NZ = 121;         // 红移网格点数
  var CZ_A0 = 1e-4;        // 起始尺度因子（早期物质/曲率主导，解析反解出对应时刻）
  var CZ_A_FLOOR = 1e-6;   // 大挤压截断阈值
  var CZ_SEG = 20;         // 几何时间网格的段数
  var CZ_PER = 50;         // 每段的步数（段内步长均匀）
  var CZ_Z0 = 1e-3;        // 红移网格起点（避免 z=0 处 log10(0)）
  var CZ_D_FLOOR = 1e-6;   // 距离的对数下限（防止 log10 非正数，仅影响极端闭合宇宙的画图）
  var CZ_KMS_TO_S = 1e3 / MPC_M;   // km/s/Mpc → s⁻¹ 的换算因子（×H₀）

  /** (H/H₀)² —— a ≤ 0 一律按极小正数处理，保证调用方永不看到 NaN */
  function czE2(a, Om, Ok, Ol) {
    var aa = (isFinite(a) && a > 1e-10) ? a : 1e-10;
    return Om / (aa * aa * aa) + Ok / (aa * aa) + Ol;
  }
  /** H/H₀（E² ≤ 0 时取 0：折返点/反弹点，导数为 0 而不是 NaN） */
  function czE(a, Om, Ok, Ol) {
    var v = czE2(a, Om, Ok, Ol);
    return v > 0 ? Math.sqrt(v) : 0;
  }
  function czField(H0s, Om, Ok, Ol) {
    return function (t, y) {
      var a = y[0];
      return [H0s * czE(a, Om, Ok, Ol) * a];
    };
  }
  /** E(z) = √[Ω_m(1+z)³ + Ω_k(1+z)² + Ω_Λ]（红移域的哈勃参数，无量纲） */
  function czEz(z, Om, Ok, Ol) {
    var u = 1 + (isFinite(z) && z > 0 ? z : 0);
    var v = Om * u * u * u + Ok * u * u + Ol;
    return v > 0 ? Math.sqrt(v) : 1e-12;
  }
  /** 单区间复合辛普森：∫_{za}^{zb} dz′/E(z′)，panels 取偶数 */
  function czChiSeg(za, zb, Om, Ok, Ol, panels) {
    var n = panels || 20, i, h, s = 0, z;
    if (n % 2) n += 1;
    if (!(zb > za)) return 0;
    h = (zb - za) / n;
    for (i = 0; i <= n; i++) {
      z = za + i * h;
      s += (i === 0 || i === n) ? 1 / czEz(z, Om, Ok, Ol) : (i % 2 ? 4 / czEz(z, Om, Ok, Ol) : 2 / czEz(z, Om, Ok, Ol));
    }
    return s * h / 3;
  }
  /** χ(z) = ∫₀^z dz′/E(z′)：沿红移网格**逐段累加**（每段 20 段辛普森，整段精度 ~1e-15） */
  function czChiGrid(zs, Om, Ok, Ol, panels) {
    var out = [0], i;
    for (i = 1; i < zs.length; i++) out.push(out[i - 1] + czChiSeg(zs[i - 1], zs[i], Om, Ok, Ol, panels || 20));
    return out;
  }
  /** 横向共动距离 d_M（Mpc）：平坦时 = (c/H₀)χ，弯曲时乘 sinh/sin 映射 */
  function czDm(chi, H0, Ok) {
    var dh = C_KMS / H0, k = Math.abs(Ok), arg;
    if (k < 1e-9) return dh * chi;
    arg = Math.sqrt(k) * chi;
    if (arg > 300) arg = 300;                       // sinh 溢出保护
    return dh * (Ok > 0 ? Math.sinh(arg) : Math.sin(arg)) / Math.sqrt(k);
  }
  /**
   * 几何时间网格上的分段 RK4。
   *
   * 为什么不能用均匀网格：早期宇宙 a(t) ∝ t^{2/3}（或 t^{1/2}），**相对**变化率 ∝ 1/t，
   * 在 t→0 处是奇异的。t 从 0 均匀采样时第一步就会让 a 跳好几个量级，RK4 在这一步
   * 系统性过冲，误差之后表现为整个解的一个**常数时间平移**（自治方程的解族只差时间平移）：
   * 实测 3000 点均匀网格给出 a(t) ≈ a_精确(t + 0.019 Gyr)，宇宙年龄因此差 0.019 Gyr。
   * 解决：时间网格按几何级数分段（每段跨同样的对数间隔），段内步长均匀 ——
   * 于是**全部时间段上 h/t 都保持在 ~0.01~0.02**，精度与绝对时刻无关。
   * 起始点不再取 t = 0，而是由解析早期解反解出"a = a₀ 对应的时刻"（见 czCompute / czSingle）。
   *
   * 返回 { t:[], y:[[]], seg:[] }：t 为秒，y[k][i] 是第 k 个分量，seg 记各段起点下标
   * （段边界处步长突变，做 5 点差分检验时要跳过，见 tests ② 的 h₁=h₂ 判据）。
   */
  function czGeoRk4(f, y0, t0, t1, nSeg, nPer) {
    var ts = [], ys = [], seg = [], k, s, i;
    for (k = 0; k < y0.length; k++) ys.push([]);
    if (!(t0 > 0) || !(t1 > t0)) { t0 = Math.max(t1 * 1e-6, 1e-30); }
    var y = y0.slice();
    var ratio = Math.pow(t1 / t0, 1 / nSeg);
    for (s = 0; s < nSeg; s++) {
      var ta = t0 * Math.pow(ratio, s), tb = t0 * Math.pow(ratio, s + 1);
      if (s === nSeg - 1) tb = t1;
      var part = rk4(f, y, ta, tb, nPer + 1);
      var from = (s === 0) ? 0 : 1;               // 段首点与上一段末点重合，去掉
      seg.push(ts.length);
      for (i = from; i < part.t.length; i++) {
        ts.push(part.t[i]);
        for (k = 0; k < y0.length; k++) ys[k].push(part.y[k][i]);
      }
      for (k = 0; k < y0.length; k++) y[k] = part.y[k][part.y[k].length - 1];
    }
    return { t: ts, y: ys, seg: seg };
  }
  /** 单成分模型（契约 ③ 的幂律检验用）：comp 0=物质、1=辐射、2=Λ，都取平坦。
      初值由解析解给出（a₀ = 1e-4 对应的时刻），因此数值解应当**逐点**重现幂律。 */
  function czSingle(comp, H0s, T, nSeg, nPer) {
    var a0 = CZ_A0, t0, i;
    if (comp === 0) t0 = (2 / 3) * Math.pow(a0, 1.5) / H0s;   // a = (3H₀t/2)^{2/3}
    else if (comp === 1) t0 = a0 * a0 / (2 * H0s);            // a = √(2H₀t)
    else { a0 = 1; t0 = T * 1e-4; }                           // a = e^{H₀(t−t₀)}
    var f = function (t, y) {
      var a = isFinite(y[0]) && y[0] > 1e-12 ? y[0] : 1e-12;
      if (comp === 0) return [H0s / Math.sqrt(a)];
      if (comp === 1) return [H0s / a];
      return [H0s * a];
    };
    var sol = czGeoRk4(f, [a0], t0, T, nSeg, nPer);
    var out = { t: [], a: [] };
    for (i = 0; i < sol.t.length; i++) {
      var av = sol.y[0][i];
      if (!isFinite(av) || !(av > 0)) break;
      out.t.push(sol.t[i] / GYR_S);
      out.a.push(av);
    }
    return out;
  }

  function czCompute(p) {
    var kind = clampInt(p.kind, 0, 2, 0);
    var H0 = clampNum(p.H0, 20, 200, 70);        // 滑块 50~100
    var Om = clampNum(p.Om, 0, 2, 0.3);          // 滑块 0~1.5
    var Ol = clampNum(p.Ol, 0, 2, 0.7);          // 滑块 0~1.5
    var z = clampNum(p.z, 0, 20, 1);             // 滑块 0~10
    var Ok = 1 - Om - Ol;                        // 曲率项（Ω_r 取 0）
    var H0s = H0 * CZ_KMS_TO_S;                  // s⁻¹
    var tH_s = 1 / H0s;
    var tH_Gyr = tH_s / GYR_S;
    var Dh = C_KMS / H0;                         // 哈勃距离 c/H₀ (Mpc)
    var T = 3 * tH_s;                            // 默认画到 3 个哈勃时间

    /* --- 闭合宇宙的折返点常常远在 3 个哈勃时间之外（H₀=70、Ω_m=1.5、Ω_Λ=0 时 t_turn ≈ 93 Gyr）：
           用"物质+曲率"回旋摆公式估一个折返时间，必要时把画图范围延长到刚好越过它，
           这样把 Ω_m 拉过 1 才**真的看得见** a(t) 折返。
           折返条件：min_a(Ω_m/a³+Ω_k/a²) = −(4/27)|Ω_k|³/Ω_m² 必须低于 −Ω_Λ。 --- */
    if (Ok < -1e-9 && Om > 1e-9) {
      var dip = (4 / 27) * Math.pow(-Ok, 3) / (Om * Om);
      if (Ol < dip) {
        var tTurn = PI * Om / (2 * H0s * Math.pow(-Ok, 1.5));
        if (isFinite(tTurn) && tTurn > 0 && tTurn * 1.15 > T) T = tTurn * 1.15;
      }
    }

    /* --- 起始点：由解析早期解反解出 a = a₀ 对应的时刻（均匀网格在 t→0 处分辨不了幂律，
           见 czGeoRk4 的注释）；Ω_Λ 主导/反弹时改用"第一个允许点"作为起点 --- */
    var a0 = CZ_A0, t0 = 0, guard = 0;
    var termM = Om / (a0 * a0 * a0);
    var termK = Ok > 0 ? Ok / (a0 * a0) : 0;
    var termL = Ol;
    if (termM >= 10 * Math.max(termK, termL)) {
      t0 = (2 / 3) * Math.pow(a0, 1.5) / (H0s * Math.sqrt(Om));   // 物质主导
    } else if (termK > 0 && termK >= 10 * termL) {
      t0 = a0 / (H0s * Math.sqrt(Ok));                            // 曲率主导（Milne：a = H₀√Ω_k t）
    } else {
      while (czE2(a0, Om, Ok, Ol) <= 0 && guard++ < 200) a0 *= 1.2;   // 反弹解：找第一个 E²>0 的 a
      if (czE2(a0, Om, Ok, Ol) <= 0) a0 = 1;
      t0 = T * 1e-6;                                              // Λ 主导：E ≈ √Ω_Λ，无奇异
    }
    if (!(t0 > 0) || t0 > T * 0.5) t0 = T * 1e-6;

    /* --- rk4 解 da/dt = H(a)·a（几何时间网格），然后同步截断到"曲线仍然物理"的最后一点 --- */
    var sol = czGeoRk4(czField(H0s, Om, Ok, Ol), [a0], t0, T, CZ_SEG, CZ_PER);
    var tG = [], aA = [], stopped = false, i;
    for (i = 0; i < sol.t.length; i++) {
      var av = sol.y[0][i];
      if (!isFinite(av) || !(av > CZ_A_FLOOR) || !isFinite(sol.t[i])) { stopped = true; break; }
      tG.push(sol.t[i] / GYR_S);
      aA.push(av);
    }
    if (tG.length < 2) { tG = [0, T / GYR_S]; aA = [1, 1]; stopped = true; }

    /* --- 宇宙年龄：a(t) 首次穿过 1 的时刻（线性插值） --- */
    var ageGyr = -1;
    for (i = 1; i < aA.length; i++) {
      if (aA[i - 1] < 1 && aA[i] >= 1) {
        ageGyr = tG[i - 1] + (1 - aA[i - 1]) * (tG[i] - tG[i - 1]) / (aA[i] - aA[i - 1]);
        break;
      }
    }

    /* --- 当前红移处的距离（χ 用两万段辛普森，精度远好于 1e-9） --- */
    var chiZ = czChiSeg(0, Math.max(z, 0), Om, Ok, Ol, 2000);
    var dM = czDm(chiZ, H0, Ok);
    var dC = Dh * chiZ;
    var dL = (1 + z) * dM;
    var dA = dM / (1 + z);
    var mu = dL > 0 ? 5 * (Math.log(dL / 1e-5) / Math.LN10) : 0;   // dL 以 Mpc 计，10 pc = 1e-5 Mpc

    /* --- Friedmann 残差：5 点差分 O(h⁴)，只在 a ≥ 0.1 的中段、且**跨 ±2 步都均匀**的点上评估
           （几何网格的段边界处 h 会突变，5 点公式跨段就不成立，用相邻四个步长的相等判据跳过） --- */
    var res = 0;
    for (i = 2; i < aA.length - 2; i++) {
      if (aA[i] < 0.1) continue;
      var hm = tG[i] - tG[i - 1];
      if (!(hm > 0)) continue;
      if (Math.abs((tG[i - 1] - tG[i - 2]) - hm) > 1e-9 * hm) continue;
      if (Math.abs((tG[i + 1] - tG[i]) - hm) > 1e-9 * hm) continue;
      if (Math.abs((tG[i + 2] - tG[i + 1]) - hm) > 1e-9 * hm) continue;
      var dadt = (-aA[i + 2] + 8 * aA[i + 1] - 8 * aA[i - 1] + aA[i - 2]) / (12 * hm);   // per Gyr
      var rhs = (H0s * GYR_S) * czE(aA[i], Om, Ok, Ol) * aA[i];                           // per Gyr
      var rel = Math.abs(dadt - rhs) / Math.max(Math.abs(rhs), 1e-30);
      if (rel > res) res = rel;
    }

    /* --- 主图 --- */
    var t = [], series = {};
    if (kind === 0) {
      t = tG;
      series.a = aA;
    } else {
      var zView = z > 0.5 ? z : 0.5;
      var zs = lin(CZ_Z0, zView, CZ_NZ);
      var chis = czChiGrid(zs, Om, Ok, Ol, 20);
      var lgC = [], lgL = [], lgA = [], lgHub = [], mus = [], muHub = [];
      for (i = 0; i < zs.length; i++) {
        var dMi = czDm(chis[i], H0, Ok);
        var dLi = (1 + zs[i]) * dMi;
        var dAi = dMi / (1 + zs[i]);
        var hub = Dh * zs[i];
        lgC.push(Math.log(Math.max(dMi, CZ_D_FLOOR)) / Math.LN10);
        lgL.push(Math.log(Math.max(dLi, CZ_D_FLOOR)) / Math.LN10);
        lgA.push(Math.log(Math.max(dAi, CZ_D_FLOOR)) / Math.LN10);
        lgHub.push(Math.log(Math.max(hub, CZ_D_FLOOR)) / Math.LN10);
        mus.push(5 * (Math.log(Math.max(dLi, CZ_D_FLOOR) / 1e-5) / Math.LN10));
        muHub.push(5 * (Math.log(Math.max(hub, CZ_D_FLOOR) / 1e-5) / Math.LN10));
      }
      t = zs;
      if (kind === 1) {
        series.dL = lgL; series.dC = lgC; series.dA = lgA; series.dLHub = lgHub;
      } else {
        series.mu = mus; series.muHub = muHub;
      }
    }

    /* --- 第二张图 --- */
    var extra;
    if (kind === 0) {
      var sm = czSingle(0, H0s, T, 21, 40), sr = czSingle(1, H0s, T, 21, 40), sl = czSingle(2, H0s, T, 21, 40);
      var mk = function (c, lab, col) {
        var xs = [], ys = [], j;
        for (j = 0; j < c.t.length; j++) {
          if (!(c.t[j] > 0) || !(c.a[j] > 0)) continue;
          xs.push(Math.log(c.t[j]) / Math.LN10);
          ys.push(Math.log(c.a[j]) / Math.LN10);
        }
        return { x: xs, y: ys, label: lab, color: col };
      };
      extra = {
        lines: [
          mk(sm, "物质主导 a ∝ t^{2/3}", "#ffb84d"),
          mk(sr, "辐射主导 a ∝ t^{1/2}", "#63d6a5"),
          mk(sl, "Λ 主导 a ∝ e^{H₀t}", "#c792ea")
        ],
        xlabel: "log₁₀(t / Gyr)", ylabel: "log₁₀ a",
        title: "单成分幂律检验（同一积分器，只留一项）：双对数斜率 = 2/3 (物质)、1/2 (辐射)；Λ 是直线只在对数-线性坐标里"
      };
    } else if (kind === 1) {
      var hz = [], hx = [], j2;
      for (j2 = 0; j2 < t.length; j2++) {
        hx.push(t[j2]);
        hz.push(czEz(t[j2], Om, Ok, Ol));
      }
      extra = {
        lines: [{ x: hx, y: hz, label: "H(z)/H₀", color: "#7fd8e8" }],
        xlabel: "红移 z", ylabel: "H(z)/H₀",
        title: "哈勃参数随红移：E(z) = √[Ω_m(1+z)³ + Ω_k(1+z)² + Ω_Λ]（Λ 主导时 E→√Ω_Λ 变平）"
      };
    } else {
      var dz = [], dm = [], j3;
      for (j3 = 0; j3 < t.length; j3++) {
        var dLi2 = Math.pow(10, series.mu[j3] / 5) * 1e-5;
        var hubi = Dh * t[j3];
        dz.push(t[j3]);
        dm.push(5 * (Math.log(Math.max(dLi2, CZ_D_FLOOR) / 1e-5) / Math.LN10)
          - 5 * (Math.log(Math.max(hubi, CZ_D_FLOOR) / 1e-5) / Math.LN10));
      }
      extra = {
        lines: [{ x: dz, y: dm, label: "μ(模型) − μ(线性哈勃定律)", color: "#ff7b7b" }],
        xlabel: "红移 z", ylabel: "Δμ (mag)",
        title: "哈勃图残差：Δμ > 0 表示比线性哈勃定律更暗 ⇒ 宇宙在加速（Ω_Λ 主导的直接证据）"
      };
    }

    var info = [
      { k: "哈勃常数 H₀", v: fmt(H0, 5) + " km/s/Mpc = " + fmt(H0s, 4) + " s⁻¹" },
      { k: "哈勃时间 1/H₀", v: fmt(tH_Gyr, 6) + " Gyr（= " + fmt(tH_s, 4) + " s）" },
      { k: "哈勃距离 c/H₀", v: fmt(Dh, 6) + " Mpc" },
      { k: "宇宙年龄（a(t) 穿过 a=1）", v: (ageGyr >= 0)
        ? fmt(ageGyr, 5) + " Gyr" : "—（画图范围内 a 未达到 1）" },
      { k: "Ω_m / Ω_Λ / Ω_k", v: fmt(Om, 4) + " / " + fmt(Ol, 4) + " / " + fmt(Ok, 4)
        + (Math.abs(Ok) < 1e-9 ? "（平坦）" : (Ok > 0 ? "（开放）" : "（闭合：会折返）")) },
      { k: "减速参数 q₀ = Ω_m/2 − Ω_Λ", v: fmt(Om / 2 - Ol, 5) + (Om / 2 - Ol < 0 ? "（加速膨胀）" : "（减速膨胀）") },
      { k: "共动距离 d_C(z=" + fmt(z, 3) + ")", v: fmt(dC, 6) + " Mpc" },
      { k: "光度距离 d_L = (1+z)d_M", v: fmt(dL, 6) + " Mpc" },
      { k: "角直径距离 d_A = d_M/(1+z)", v: fmt(dA, 6) + " Mpc" },
      { k: "距离模数 μ = 5log₁₀(d_L/10pc)", v: fmt(mu, 5) + " mag" },
      { k: "Friedmann 残差 |ȧ − H(a)a|/(Ha)", v: fmt(res, 3) + "（5 点差分 O(h⁴)，a ≥ 0.1 的中段、步长均匀处）" },
      { k: "临界密度 ρ_c = 3H₀²/(8πG)", v: fmt(3 * H0s * H0s / (8 * PI * G_C), 4) + " kg/m³" },
      { k: "积分状态", v: stopped ? "曲线在 a < 1e-6 处截断（大挤压 / 反弹后收缩）"
        : "a 从 " + fmt(a0, 3) + "（t = " + fmt(t0 / GYR_S, 4) + " Gyr）积到 " + fmt(aA[aA.length - 1], 4)
          + "，画到 t = " + fmt(T / GYR_S, 5) + " Gyr" + (T > 3.05 * tH_s ? "（已延长到折返点之外）" : "（3 个哈勃时间）") }
    ];

    return {
      t: t,
      series: series,
      info: info,
      extra: extra,
      metrics: {
        kind: kind, H0: H0, Om: Om, Ol: Ol, Ok: Ok, z: z,
        H0s: H0s, tH_Gyr: tH_Gyr, Dh: Dh, ageGyr: ageGyr, q0: Om / 2 - Ol,
        chi: chiZ, dM: dM, dC: dC, dL: dL, dA: dA, mu: mu,
        aT: tG, aA: aA, t0s: t0, Tend: T, stayed: !stopped, friedmannResidual: res,
        single: {
          matter: czSingle(0, H0s, T, 21, 40),
          radiation: czSingle(1, H0s, T, 21, 40),
          lambda: czSingle(2, H0s, T, 21, 40)
        }
      }
    };
  }

  SIM.register("cosmology", {
    title: "膨胀宇宙：Friedmann 方程与距离-红移",
    legend: "H(a)² = H₀²[Ω_m/a³ + Ω_k/a² + Ω_Λ]，Ω_k = 1 − Ω_m − Ω_Λ（本模型取 Ω_r = 0）；"
      + "da/dt = H(a)·a 用 RK4 数值积分（时间网格按几何级数分段，否则 t→0 处的幂律膨胀分辨不了）。"
      + "Ω_m+Ω_Λ > 1 的闭合宇宙会折返：画图范围会自动延长到折返点之外，a 掉到 1e-6 以下时曲线就地截断"
      + "（大挤压）；Ω_Λ 主导 + 负曲率还可能给出「最小尺度因子」的反弹解，积分起点会自动上移到允许区。"
      + "哈勃时间 1/H₀ = 13.97 Gyr（H₀ = 70），宇宙年龄取 a(t) 首次穿过 a = 1 的时刻；"
      + "距离用 d_L = (1+z)d_M，平坦时 d_M = ∫₀^z c dz′/H(z′)，弯曲时换成 sinh/sin 映射。",
    axes: {
      xlabel: "横轴：t (Gyr)（尺度因子视角）或 红移 z（距离与哈勃图视角）",
      ylabel: "纵轴：a(t)、log₁₀(d/Mpc) 或 距离模数 μ (mag)"
    },
    params: {
      H0: { label: "哈勃常数 H₀", unit: "km/s/Mpc", def: 70, min: 50, max: 100, step: 1 },
      Om: { label: "物质密度 Ω_m", unit: "", def: 0.3, min: 0, max: 1.5, step: 0.01 },
      Ol: { label: "暗能量密度 Ω_Λ", unit: "", def: 0.7, min: 0, max: 1.5, step: 0.01 },
      z: { label: "红移 z（读数与画图上限）", unit: "", def: 1, min: 0, max: 10, step: 0.1 },
      kind: { label: "视角", type: "enum", options: CZ_KINDS, def: 0 }
    },
    plots: [
      { key: "a", label: "尺度因子 a(t)", color: "#5aa9ff" },
      { key: "dL", label: "log₁₀ d_L (Mpc)", color: "#ffb84d" },
      { key: "dC", label: "log₁₀ d_C (Mpc)", color: "#63d6a5" },
      { key: "dA", label: "log₁₀ d_A (Mpc)", color: "#c792ea" },
      { key: "dLHub", label: "线性哈勃定律 d_L = (c/H₀)z", color: "#ff7b7b", dash: "5 4" },
      { key: "mu", label: "距离模数 μ (mag)", color: "#ffb84d" },
      { key: "muHub", label: "线性哈勃定律 μ", color: "#7fd8e8", dash: "5 4" }
    ],
    compute: czCompute,
    tests: [
      /* ① 哈勃时间：1/H₀（H₀ = 70 km/s/Mpc） = 13.97 Gyr */
      { name: "① 哈勃时间 1/H₀ = 13.97 Gyr（H₀ = 70 km/s/Mpc，容差 1%）",
        params: { kind: 0, H0: 70 },
        measure: function (o) { return o.metrics.tH_Gyr; }, expect: 13.97, tol: 0.1397 },
      /* ② 平坦宇宙的 a(t) 必须满足 Friedmann 方程：5 点差分算 ȧ，与 H(a)·a 比（残差 < 1e-6）。
            时间网格是分段几何的：段内步长严格均匀，段边界处 h 突变（5 点公式跨段不成立），
            所以要求**相邻四个步长都相等**才参与统计。 */
      { name: "② 平坦宇宙（Ω_m+Ω_Λ=1）的 a(t) 满足 Friedmann 方程：残差 < 1e-6（5 点差分 O(h⁴)）",
        params: { kind: 0, H0: 70, Om: 0.3, Ol: 0.7 },
        measure: function (o, p) {
          var t = o.t, a = o.series.a, i, worst = 0, hm, dadt, H0g, rhs, rel, n = 0;
          H0g = p.H0 * 1e3 / MPC_M * GYR_S;                    // H₀ 换算成 1/Gyr
          for (i = 2; i < a.length - 2; i++) {
            if (a[i] < 0.1) continue;
            hm = t[i] - t[i - 1];
            if (!(hm > 0)) continue;
            if (Math.abs((t[i - 1] - t[i - 2]) - hm) > 1e-9 * hm) continue;
            if (Math.abs((t[i + 1] - t[i]) - hm) > 1e-9 * hm) continue;
            if (Math.abs((t[i + 2] - t[i + 1]) - hm) > 1e-9 * hm) continue;
            dadt = (-a[i + 2] + 8 * a[i + 1] - 8 * a[i - 1] + a[i - 2]) / (12 * hm);
            rhs = H0g * Math.sqrt(p.Om / (a[i] * a[i] * a[i]) + (1 - p.Om - p.Ol) / (a[i] * a[i]) + p.Ol) * a[i];
            rel = Math.abs(dadt - rhs) / Math.abs(rhs);
            if (rel > worst) worst = rel;
            n++;
          }
          return n > 100 ? worst : NaN;                        // 采样点太少说明筛选逻辑坏了，直接判失败
        }, expect: 0, tol: 1e-6 },
      /* ③ 单成分极限：物质 a ∝ t^{2/3}、辐射 a ∝ t^{1/2}（同一条积分器、只留一项） */
      { name: "③ 物质主导 a ∝ t^{2/3}：双对数斜率 = 0.6666667（容差 1e-6）",
        params: { kind: 0, H0: 70 },
        measure: function (o) {
          var c = o.metrics.single.matter, xs = [], ys = [], i;
          for (i = 0; i < c.t.length; i++) { xs.push(Math.log(c.t[i]) / Math.LN10); ys.push(Math.log(c.a[i]) / Math.LN10); }
          return lsqSlope(xs, ys);
        }, expect: 0.6666666666666666, tol: 1e-6 },
      { name: "③' 辐射主导 a ∝ t^{1/2}：双对数斜率 = 0.5（容差 1e-6）",
        params: { kind: 0, H0: 70 },
        measure: function (o) {
          var c = o.metrics.single.radiation, xs = [], ys = [], i;
          for (i = 0; i < c.t.length; i++) { xs.push(Math.log(c.t[i]) / Math.LN10); ys.push(Math.log(c.a[i]) / Math.LN10); }
          return lsqSlope(xs, ys);
        }, expect: 0.5, tol: 1e-6 },
      { name: "③'' Λ 主导 a ∝ e^{H₀t}：d(ln a)/dt = H₀ = 0.0715899 /Gyr（容差 1e-9）",
        params: { kind: 0, H0: 70 },
        measure: function (o, p) {
          var c = o.metrics.single.lambda;
          if (c.t.length < 2) return NaN;
          return Math.log(c.a[c.a.length - 1] / c.a[0]) / (c.t[c.t.length - 1] - c.t[0]);
        }, expect: 0.071589851565, tol: 1e-9 },
      /* ④ 光度距离 d_L = (1+z)∫₀^z dz′/H(z′)：与独立的细网格辛普森积分一致（平坦宇宙） */
      { name: "④ 光度距离 d_L = (1+z)∫₀^z dz′/H(z′) 与独立数值积分一致（容差 1e-9，平坦宇宙）",
        params: { kind: 1, H0: 70, Om: 0.3, Ol: 0.7, z: 1 },
        measure: function (o, p) {
          var nseg = 20000, i, h = p.z / nseg, s = 0, zi, E, chi;
          for (i = 0; i <= nseg; i++) {
            zi = i * h;
            E = Math.sqrt(p.Om * Math.pow(1 + zi, 3) + (1 - p.Om - p.Ol) * Math.pow(1 + zi, 2) + p.Ol);
            s += (i === 0 || i === nseg) ? 1 / E : (i % 2 ? 4 / E : 2 / E);
          }
          chi = s * h / 3;                                   // ∫₀^z dz′/E(z′)
          var dLref = (1 + p.z) * (C_KMS / p.H0) * chi;      // 契约公式（Mpc）
          return Math.abs(o.metrics.dL - dLref) / dLref;
        }, expect: 0, tol: 1e-9 },
      /* ④' 宇宙年龄 = (1/H₀)∫₀¹da/(aE(a))：与 a(t) 反解出来的年龄一致 */
      { name: "④' 宇宙年龄（a(t) 反解）与解析积分 t₀ = (1/H₀)∫₀¹da/(aE(a)) 一致（容差 0.01 Gyr）",
        params: { kind: 0, H0: 70, Om: 0.3, Ol: 0.7 },
        measure: function (o, p) {
          var n = 20000, i, h = 1 / n, s = 0, a, E, f, t0;
          for (i = 0; i <= n; i++) {
            a = i * h;
            E = Math.sqrt(p.Om / (a * a * a) + (1 - p.Om - p.Ol) / (a * a) + p.Ol);
            f = (a > 0) ? 1 / (a * E) : 0;
            s += (i === 0 || i === n) ? f : (i % 2 ? 4 * f : 2 * f);
          }
          t0 = (s * h / 3) / (p.H0 * 1e3 / MPC_M * GYR_S);   // 单位：Gyr
          return Math.abs(o.metrics.ageGyr - t0);
        }, expect: 0, tol: 0.01 },
      /* ⑤ 边界安全：Ω_m+Ω_Λ 组合（含闭合折返、Ω=0、反弹）+ 三种视角 × 全部滑块端点 */
      { name: "⑤ 边界安全：任意 (Ω_m, Ω_Λ, H₀, z, 视角) 组合下曲线与读数全部有限（无 NaN/Infinity）",
        params: { kind: 0 },
        measure: function () {
          var combos = [[0, 0], [0.3, 0.7], [1.5, 0], [0, 1.5], [1.5, 1.5], [1, 1], [0.05, 1.45], [0, 0.001]];
          var H0s = [50, 70, 100], zs = [0, 0.5, 10], ks = [0, 1, 2];
          var i, j, k, m, o2, key, bad = 0;
          for (i = 0; i < combos.length; i++) {
            for (j = 0; j < H0s.length; j++) {
              for (k = 0; k < ks.length; k++) {
                for (m = 0; m < zs.length; m++) {
                  o2 = czCompute({ kind: ks[k], H0: H0s[j], Om: combos[i][0], Ol: combos[i][1], z: zs[m] });
                  if (!allFinite(o2.t)) bad++;
                  for (key in o2.series) { if (o2.series.hasOwnProperty(key) && !allFinite(o2.series[key])) bad++; }
                  if (!allFinite(o2.metrics.aA) || !allFinite([o2.metrics.dL, o2.metrics.dC, o2.metrics.tH_Gyr])) bad++;
                }
              }
            }
          }
          return bad;
        }, expect: 0, tol: 0 },
      /* ⑤' 闭合宇宙确实折返：Ω_m = 1.5、Ω_Λ = 0（Ω_k = −0.5）时 a(t) 先增后减。
             画图范围会自动延长到折返点（t_turn ≈ 93 Gyr）之外，所以曲线里能看到极大值。
             注：Ω_Λ = 1.5 的强暗能量模型不会折返（E² > 0 恒成立），这是物理结论不是 bug。 */
      { name: "⑤' 闭合宇宙（Ω_m=1.5, Ω_Λ=0）的 a(t) 先增后减（折返/大挤压）",
        params: { kind: 0, H0: 70, Om: 1.5, Ol: 0 },
        measure: function (o) {
          var a = o.series.a, i, imax = 0, turn = 0;
          for (i = 1; i < a.length; i++) { if (a[i] > a[imax]) imax = i; }
          if (imax > 0 && imax < a.length - 1) turn = 1;
          return turn;
        }, expect: 1, tol: 0 }
    ]
  });

  /* ==========================================================================
     3. bloch-gates —— 量子门与布洛赫球

     态用二维复矢量 |ψ⟩ = a₀|0⟩ + a₁|1⟩ 精确跟踪（含全局相位），门是 2×2 复矩阵：
       X  = [[0,1],[1,0]]                        （比特翻转）
       H  = (1/√2)[[1,1],[1,−1]]                 （把 z 轴转到 x 轴）
       Rz(θ) = diag(e^{−iθ/2}, e^{+iθ/2})        （绕 z 轴转 θ）
       Rx(θ) = [[cos(θ/2), −i sin(θ/2)],[−i sin(θ/2), cos(θ/2)]]（绕 x 轴转 θ）
       T  = diag(1, e^{iπ/4})                    （π/8 门，= Rz(45°) 差一个全局相位）
     布洛赫矢量（ρ₀₁ = a₀a₁*）：
       b_x = 2Re ρ₀₁、b_y = −2Im ρ₀₁、b_z = |a₀|²−|a₁|² = P(0)−P(1)
       ⇒ P(1) = (1 − b_z)/2， 纯态恒有 |b| = 1。
     与"布洛赫矢量旋转"图像的一致性（本文件用矩阵版实现，两者等价）：
       Rz(θ)：b_xy 逆时针转 θ；Rx(θ)：b 绕 x 轴转 θ；T = Rz(π/4)。
     角度先归一到 [0,360) 再转弧度（360° ≡ 0°，Rx(360°) = −I 但布洛赫矢量不变）。
     ========================================================================== */
  var BG_KINDS = ["X 门", "H 门", "Rz(θ)", "Rx(θ)", "T 门"];
  var BG_R2 = 1 / Math.sqrt(2);
  var BG_T = Math.PI / 4;

  /** 作用一次门：态 (r0,i0,r1,i1) → 新的四元组 */
  function bgApply(kind, th, s) {
    var r0 = s[0], i0 = s[1], r1 = s[2], i1 = s[3];
    var c, sn, nr, ni;
    if (kind === 0) return [r1, i1, r0, i0];                       // X：交换
    if (kind === 1) {                                              // H：(a+b)/√2, (a−b)/√2
      return [BG_R2 * (r0 + r1), BG_R2 * (i0 + i1), BG_R2 * (r0 - r1), BG_R2 * (i0 - i1)];
    }
    if (kind === 2) {                                              // Rz(θ)
      c = Math.cos(th / 2); sn = Math.sin(th / 2);
      nr = r0 * c + i0 * sn; ni = i0 * c - r0 * sn;                // a₀·e^{−iθ/2}
      var mr = r1 * c - i1 * sn, mi = i1 * c + r1 * sn;            // a₁·e^{+iθ/2}
      return [nr, ni, mr, mi];
    }
    if (kind === 3) {                                              // Rx(θ)
      c = Math.cos(th / 2); sn = Math.sin(th / 2);
      nr = c * r0 + sn * i1; ni = c * i0 - sn * r1;                // cos·a₀ − i sin·a₁
      var qr = c * r1 + sn * i0, qi = c * i1 - sn * r0;            // −i sin·a₀ + cos·a₁
      return [nr, ni, qr, qi];
    }
    c = Math.cos(BG_T); sn = Math.sin(BG_T);                       // T = diag(1, e^{iπ/4})
    return [r0, i0, r1 * c - i1 * sn, i1 * c + r1 * sn];
  }
  /** 连续作用 n 次门，返回每一步之后的 {态, 布洛赫矢量}（含第 0 步初态） */
  function bgSeq(kind, thetaDeg, n, init) {
    var th = (clampNum(thetaDeg, -1e6, 1e6, 0) % 360 + 360) % 360 * PI / 180;
    var s = init ? init.slice() : [1, 0, 0, 0];                    // 默认初态 |0⟩
    var states = [s.slice()], bloch = [qBloch(s[0], s[1], s[2], s[3])];
    var k;
    for (k = 0; k < n; k++) {
      s = bgApply(kind, th, s);
      states.push(s.slice());
      bloch.push(qBloch(s[0], s[1], s[2], s[3]));
    }
    return { theta: th, states: states, bloch: bloch };
  }
  /** 正交投影到屏幕（z 向上，x、y 各成 120°）：球面投影成半径 1 的圆 */
  function bgProj(b) {
    return { x: 0.8660254037844386 * (b[0] - b[1]), y: b[2] - 0.5 * (b[0] + b[1]) };
  }

  function bgCompute(p) {
    var kind = clampInt(p.kind, 0, 4, 0);
    var n = clampInt(p.n, 1, 20, 1);
    var thetaDeg = clampNum(p.theta, 0, 360, 90);
    var run = bgSeq(kind, thetaDeg, n, null);
    /* 参考轨迹：同一个门序列作用在 |+⟩ = (|0⟩+|1⟩)/√2 上 —— 相位门在 |0⟩ 上"看不见"，
       把同一串门作用在赤道上的态就能看出它其实在绕 z 轴转（教学用，不是契约要求）。 */
    var ref = bgSeq(kind, thetaDeg, n, [BG_R2, 0, BG_R2, 0]);

    var k, p1 = [], traj = [], refTraj = [], dev = 0;
    for (k = 0; k <= n; k++) {
      var b = run.bloch[k], st = run.states[k];
      p1.push(st[2] * st[2] + st[3] * st[3]);                      // P(1) = |a₁|²
      traj.push(b);
      refTraj.push(ref.bloch[k]);
      var d = Math.abs(qNorm(b) - 1);
      if (d > dev) dev = d;
    }
    var fin = run.bloch[n], finState = run.states[n];
    var t = [];
    for (k = 0; k <= n; k++) t.push(k);                            // 横轴 = 已作用的门个数

    /* 布洛赫球（球轮廓 + 三个坐标轴 + 实际轨迹 + 参考轨迹 + 末态矢量） */
    var circ = [], NT = 97, i, th2;
    for (i = 0; i < NT; i++) {
      th2 = 2 * PI * i / (NT - 1);
      circ.push({ x: Math.cos(th2), y: Math.sin(th2) });
    }
    var curP = bgProj(fin);
    var tm = [], rm = [], j;
    for (j = 0; j <= n; j++) { tm.push(bgProj(traj[j])); rm.push(bgProj(refTraj[j])); }
    var lines = [
      {
        x: circ.map(function (q) { return q.x; }), y: circ.map(function (q) { return q.y; }),
        label: "布洛赫球（半径 1）", color: "#7fd8e8", dash: "3 3"
      },
      { x: [-0.866, 0.866], y: [0.5, -0.5], label: "x / y / z 轴", color: "#9fe870", dash: "2 4" },
      { x: [0.866, -0.866], y: [0.5, -0.5], color: "#9fe870", dash: "2 4" },
      { x: [0, 0], y: [-1, 1], color: "#9fe870", dash: "2 4" },
      {
        x: tm.map(function (q) { return q.x; }), y: tm.map(function (q) { return q.y; }),
        label: "实际轨迹（初态 |0⟩，共 " + n + " 个门）", color: "#ffb84d"
      },
      {
        x: rm.map(function (q) { return q.x; }), y: rm.map(function (q) { return q.y; }),
        label: "参考：同一串门作用在 |+⟩ 上", color: "#ff7b7b", dash: "4 3"
      },
      {
        x: [0, curP.x], y: [0, curP.y], label: "末态布洛赫矢量",
        color: "#c792ea", dash: "2 2"
      }
    ];

    var names = { 0: "X", 1: "H", 2: "Rz(" + fmt(((thetaDeg % 360) + 360) % 360, 4) + "°)",
      3: "Rx(" + fmt(((thetaDeg % 360) + 360) % 360, 4) + "°)", 4: "T = Rz(45°)" };
    var info = [
      { k: "门序列", v: names[kind] + " × " + n + "（初态 |0⟩）" },
      { k: "末态 |ψ⟩", v: cplx(finState[0], finState[1]) + " |0⟩ + (" + cplx(finState[2], finState[3]) + ") |1⟩" },
      { k: "布洛赫矢量 (x, y, z)", v: "(" + fmt(fin[0], 5) + ", " + fmt(fin[1], 5) + ", " + fmt(fin[2], 5) + ")" },
      { k: "P(0) / P(1)", v: fmt(finState[0] * finState[0] + finState[1] * finState[1], 6)
        + " / " + fmt(p1[n], 6) },
      { k: "布洛赫矢量长度 |b|", v: fmt(qNorm(fin), 8) + "（纯态恒为 1，最大偏差 " + fmt(dev, 3) + "）" },
      { k: "已作用门数 / 角度", v: n + " 个（θ = " + fmt(run.theta * 180 / PI, 5) + "° = "
        + fmt(run.theta, 6) + " rad）" },
      { k: "门的图像", v: (kind === 0) ? "X = 绕 x 轴转 180°：|0⟩ ⇄ |1⟩（布洛赫矢量在 ±z 之间翻）"
        : (kind === 1) ? "H = 把 z 轴转到 x 轴：(x,y,z) → (z,−y,x)，H² = I"
        : (kind === 2) ? "Rz = 绕 z 轴转 θ：只改相位（赤道上的方位角），P(1) 不变"
        : (kind === 3) ? "Rx = 绕 x 轴转 θ：θ=180° 与 X 门等价（差全局相位）"
        : "T = Rz(45°)：π/8 门，绕 z 轴转 45°，在 |0⟩ 上不改变测量结果" }
    ];

    return {
      t: t,
      series: { p1: p1 },
      info: info,
      extra: {
        lines: lines,
        markers: [{ x: curP.x, y: curP.y, label: "末态" }],
        xlabel: "布洛赫球投影 x（z 向上，x 与 y 各 120°）",
        ylabel: "布洛赫球投影 z",
        title: "布洛赫矢量轨迹（球面投影；相位门要作用在赤道态上才看得出来）"
      },
      metrics: {
        kind: kind, n: n, thetaDeg: thetaDeg, theta: run.theta,
        p1: p1, blochTraj: traj, blochRef: refTraj, bloch: fin,
        stateFinal: finState, normDev: dev
      }
    };
  }

  SIM.register("bloch-gates", {
    title: "量子门与布洛赫球",
    legend: "初态 |0⟩（布洛赫矢量指向 +z），把选定的门连续作用 n 次，画出逐门之后的 P(1)。"
      + "X = 绕 x 轴 180°、H = 把 z 轴转到 x 轴、Rz(θ)/Rx(θ) = 绕 z/x 轴转 θ、T = Rz(45°)。"
      + "纯态的布洛赫矢量长度恒为 1（幺正演化不丢信息）；相位门在 |0⟩ 上看不出效果，"
      + "第二张图额外画了「同一串门作用在 |+⟩ 上」的参考轨迹，才能看到它绕 z 轴的转动。",
    axes: { xlabel: "门序号 k（已作用 k 个门）", ylabel: "P(1) = |⟨1|ψ⟩|²" },
    params: {
      kind: { label: "量子门", type: "enum", options: BG_KINDS, def: 0 },
      theta: { label: "旋转角 θ（Rz / Rx 用）", unit: "°", def: 90, min: 0, max: 360, step: 5 },
      n: { label: "门个数 n", unit: "", def: 1, min: 1, max: 20, step: 1 }
    },
    plots: [
      { key: "p1", label: "P(1)（逐门作用后）", color: "#5aa9ff" }
    ],
    compute: bgCompute,
    tests: [
      /* ① X|0⟩ = |1⟩：P(1) = 1 */
      { name: "① X 门：|0⟩ → |1⟩，P(1) = 1（容差 1e-12）",
        params: { kind: 0, n: 1 },
        measure: function (o) { return o.series.p1[o.series.p1.length - 1]; }, expect: 1, tol: 1e-12 },
      { name: "①' X 门后布洛赫矢量 = (0, 0, −1)（容差 1e-12）",
        params: { kind: 0, n: 1 },
        measure: function (o) { return qDist(o.metrics.bloch, [0, 0, -1]); }, expect: 0, tol: 1e-12 },
      /* ② H|0⟩ = (|0⟩+|1⟩)/√2：P(1) = 0.5，布洛赫矢量指向 +x */
      { name: "② H 门：|0⟩ → (|0⟩+|1⟩)/√2，P(1) = 0.5（容差 1e-12）",
        params: { kind: 1, n: 1 },
        measure: function (o) { return o.series.p1[o.series.p1.length - 1]; }, expect: 0.5, tol: 1e-12 },
      { name: "②' H 门后布洛赫矢量指向 +x：(1, 0, 0)（容差 1e-12）",
        params: { kind: 1, n: 1 },
        measure: function (o) { return qDist(o.metrics.bloch, [1, 0, 0]); }, expect: 0, tol: 1e-12 },
      /* ③ X² = I：两次 X 回到初态 */
      { name: "③ X² = I：作用两次 X 回到初态 |0⟩（布洛赫矢量回到 (0,0,1)，容差 1e-12）",
        params: { kind: 0, n: 2 },
        measure: function (o) { return qDist(o.metrics.blochTraj[2], [0, 0, 1]); }, expect: 0, tol: 1e-12 },
      { name: "③' 同理 H² = I（两次 H 回到 |0⟩，P(1) = 0，容差 1e-12）",
        params: { kind: 1, n: 2 },
        measure: function (o) { return o.series.p1[2]; }, expect: 0, tol: 1e-12 },
      /* ④ Rz(θ) 只改相位：P(0)/P(1) 不变（在赤道态 |+⟩ 上检验，|0⟩ 上太平凡） */
      { name: "④ Rz(θ) 不改变 P(0)/P(1)：Rz(22°) 作用在 |+⟩ 上前后 P(1) 都是 0.5（容差 1e-12）",
        params: { kind: 2, theta: 22, n: 5 },
        measure: function (o) {
          var s = bgSeq(2, 22, 1, [BG_R2, 0, BG_R2, 0]);
          var st = s.states[1];
          var p1after = st[2] * st[2] + st[3] * st[3];
          var p1before = 0.5;
          void o;
          return Math.abs(p1after - p1before);
        }, expect: 0, tol: 1e-12 },
      { name: "④' Rz(73°) 在 |+⟩ 上把布洛赫矢量转过 73°（终点 = (cos73°, sin73°, 0)，容差 1e-12）",
        params: { kind: 2, theta: 73, n: 1 },
        measure: function (o) {
          var s = bgSeq(2, 73, 1, [BG_R2, 0, BG_R2, 0]);
          var b = s.bloch[1], r = 73 * PI / 180;
          void o;
          return qDist(b, [Math.cos(r), Math.sin(r), 0]);
        }, expect: 0, tol: 1e-12 },
      /* ⑤ Rx(180°) 与 X 门等价（差全局相位） */
      { name: "⑤ Rx(180°) 与 X 门等价：|0⟩ → |1⟩，P(1) = 1（容差 1e-12）",
        params: { kind: 3, theta: 180, n: 1 },
        measure: function (o) { return o.series.p1[1]; }, expect: 1, tol: 1e-12 },
      { name: "⑤' Rx(180°) 与 X 门的布洛赫矢量逐点相同（轨迹偏差 = 0，容差 1e-12）",
        params: { kind: 3, theta: 180, n: 4 },
        measure: function (o) {
          var a = bgSeq(3, 180, 4, null).bloch, b = bgSeq(0, 0, 4, null).bloch, i, worst = 0, d;
          void o;
          for (i = 0; i < a.length; i++) { d = qDist(a[i], b[i]); if (d > worst) worst = d; }
          return worst;
        }, expect: 0, tol: 1e-12 },
      { name: "⑤'' T 门 = Rz(45°)：在 |+⟩ 上把布洛赫矢量转过 45°（容差 1e-12）",
        params: { kind: 4, n: 1 },
        measure: function (o) {
          var b = bgSeq(4, 0, 1, [BG_R2, 0, BG_R2, 0]).bloch[1];
          var r = PI / 4;
          void o;
          return qDist(b, [Math.cos(r), Math.sin(r), 0]);
        }, expect: 0, tol: 1e-12 },
      /* ⑥ 纯态的布洛赫矢量长度 = 1（当前门序列的整条轨迹，从 metrics 现算） */
      { name: "⑥ 纯态布洛赫矢量长度 |b| = 1（整条轨迹逐点，容差 1e-12）",
        params: { kind: 3, theta: 137, n: 7 },
        measure: function (o) {
          var tr = o.metrics.blochTraj, i, worst = 0, d;
          for (i = 0; i < tr.length; i++) { d = Math.abs(qNorm(tr[i]) - 1); if (d > worst) worst = d; }
          return worst;
        }, expect: 0, tol: 1e-12 },
      { name: "⑥' |b| = 1 对全部 5 种门 × 任意角度 × n ≤ 20 成立（扫描，容差 1e-12）",
        params: {},
        measure: function () {
          var ks = [0, 1, 2, 3, 4], ths = [0, 1, 45, 90, 179.9, 180, 270, 359.9, 360, 720, -30];
          var ns = [1, 2, 5, 13, 20], i, j, m, q, worst = 0, d, r;
          for (i = 0; i < ks.length; i++) {
            for (j = 0; j < ths.length; j++) {
              for (m = 0; m < ns.length; m++) {
                r = bgSeq(ks[i], ths[j], ns[m], null);
                for (q = 0; q < r.bloch.length; q++) {
                  d = Math.abs(qNorm(r.bloch[q]) - 1);
                  if (d > worst) worst = d;
                }
              }
            }
          }
          return worst;
        }, expect: 0, tol: 1e-12 },
      /* ⑦ 边界安全：极端角度（0/360/720/−30）与 n = 1..20 下 P(1) ∈ [0,1] 且有限 */
      { name: "⑦ 边界安全：角度归一到 0~360°、P(1) ∈ [0, 1] 且全参数有限（无 NaN/Infinity）",
        params: {},
        measure: function () {
          var ks = [0, 1, 2, 3, 4], ths = [-30, 0, 22.5, 180, 359.9, 360, 720, 1e6], ns = [1, 2, 19, 20, 0, 50];
          var i, j, m, o2, bad = 0, q;
          for (i = 0; i < ks.length; i++) {
            for (j = 0; j < ths.length; j++) {
              for (m = 0; m < ns.length; m++) {
                o2 = bgCompute({ kind: ks[i], theta: ths[j], n: ns[m] });
                if (!allFinite(o2.t) || !allFinite(o2.series.p1)) bad++;
                for (q = 0; q < o2.series.p1.length; q++) {
                  if (!(o2.series.p1[q] >= -1e-12 && o2.series.p1[q] <= 1 + 1e-12)) bad++;
                }
                if (o2.metrics.theta < 0 || o2.metrics.theta >= 2 * PI + 1e-12) bad++;
              }
            }
          }
          return bad;
        }, expect: 0, tol: 0 }
    ]
  });

  /* ==========================================================================
     4. decoherence —— 退相干与混合态

     初态一律取赤道上的 |+⟩ = (|0⟩+|1⟩)/√2：P(1,0) = 1/2、ρ₀₁(0) = 1/2
     （这样两种机制都看得见：退相位改相干性，振幅阻尼同时改布居与相干性）。

     ① 退相位（纯退相干，能量不衰减）：
          ρ₀₁(t) = ρ₀₁(0)·e^{−t/T₂}   ⇒  布洛赫矢量 xy 分量按 e^{−t/T₂} 收缩，z 分量不变
          |b(t)| = e^{−t/T₂}（单调不增 —— 契约 ④ 说的就是这一支）
     ② 振幅阻尼（能量弛豫，|1⟩ → |0⟩）：
          P(1,t) = P(1,0)·e^{−t/T₁}   （契约 ② 的唯象约定：指数衰减到 0）
          配套的相干性衰减取标准振幅阻尼信道的 ρ₀₁(t) = ρ₀₁(0)·e^{−t/(2T₁)}，
          于是 b_z = 1 − 2P(1) = 1 − e^{−t/T₁} 从 0 单调升到 +1（态被驱向纯态 |0⟩）。
        ★ 这里要诚实说明两件事（legend 里也写了）：
          · "衰减到 0"是唯象约定：真实的热平衡振幅阻尼会衰减到稳态占据
            P(1,∞) = 1/(e^{ħω/k_BT}+1) 而不是 0，本模型按契约不引入温度；
          · 因此 |b| 在振幅阻尼下**不是**单调的：|b|² = 1 − e^{−t/T₁} + e^{−2t/T₁}，
            在 t = T₁ln2 处取极小 √3/2 = 0.8660（此时 γ = 1/2），之后回升到 1
            （纯态 → 混合态 → 纯态 |0⟩）。真正的"不可逆"陈述是——
            相干性 2|ρ₀₁| 单调不增、且 |b| ≤ 1 恒成立。契约 ④ 的单调性对退相位支严格成立。
     ③ 物理约束 T₂ ≤ 2T₁（纯退相位 + 能量弛豫的合计退相干率不可能比 2T₁ 更慢）：
        模型把 T₂ 夹到 min(T₂, 2T₁) 并在读数里报告是否发生了夹取。
     保真度 F(t) = ⟨+x|ρ(t)|+x⟩ = (1 + b_x)/2；纯度 Tr ρ² = (1 + |b|²)/2。
     ========================================================================== */
  var DC_KINDS = ["退相位", "振幅阻尼"];
  var DC_N = 401;
  var DC_TMIN = 1e-6;          // 时间常数下限（T→0 时 e^{−t/T} 会指数爆炸）

  function dcCompute(p) {
    var kind = clampInt(p.kind, 0, 1, 0);
    var T2raw = clampNum(p.T2, DC_TMIN, 1e6, 10);
    var T1 = clampNum(p.T1, DC_TMIN, 1e6, 20);
    var tEnd = clampNum(p.t, 0, 1e4, 5);
    /* 横轴跨度：t = 0 时 linspace 会退化成"所有 x 相同"，引擎的坐标变换要除以 (xmax−xmin)，
       会画出 Infinity/NaN 的网格线（引擎本身没有 xmin=xmax 的保护），所以跨度至少取 1e-3 μs。 */
    var tSpan = tEnd > 1e-3 ? tEnd : 1e-3;
    var T2 = Math.min(T2raw, 2 * T1);           // 物理约束 T₂ ≤ 2T₁
    var clipped = T2 < T2raw - 1e-15;

    var t = lin(0, tSpan, DC_N);
    var coh = [], blen = [], p1 = [], r00 = [], r11 = [], r01 = [], i, ti, ex2, ex1, bx, bz;
    for (i = 0; i < DC_N; i++) {
      ti = t[i];
      if (kind === 0) {
        /* 退相位：相干性按 e^{−t/T₂} 衰减，布居不变（b_z ≡ 0） */
        ex2 = Math.exp(-ti / T2);
        bx = ex2; bz = 0;
        p1.push(0.5);
      } else {
        /* 振幅阻尼：P(1) 按 e^{−t/T₁} 衰减，相干性按 e^{−t/(2T₁)} */
        ex1 = Math.exp(-ti / T1);
        bx = Math.exp(-ti / (2 * T1));
        bz = 1 - ex1;
        p1.push(0.5 * ex1);
      }
      var c = Math.abs(bx) * 1;                 // 2|ρ₀₁| = |b_xy| = |b_x|（初态在 x 轴上）
      coh.push(c);
      blen.push(Math.sqrt(bx * bx + bz * bz));
      r00.push(1 - p1[i]);
      r11.push(p1[i]);
      r01.push(c / 2);
    }
    var tCur = tSpan;                           // 曲线末点对应的时刻（= tEnd，除非 tEnd < 1e-3）
    var bxf = kind === 0 ? Math.exp(-tCur / T2) : Math.exp(-tCur / (2 * T1));
    var bzf = kind === 0 ? 0 : 1 - Math.exp(-tCur / T1);
    var nrmF = Math.sqrt(bxf * bxf + bzf * bzf);
    var F = (1 + bxf) / 2;                      // 保真度（与初态 |+x⟩）
    var pur = (1 + nrmF * nrmF) / 2;            // 纯度 Tr ρ²

    var info = [
      { k: "机制", v: opt(DC_KINDS, kind) + (kind === 0
        ? "：只有相位噪声（能量不丢），ρ₀₁ 按 e^{−t/T₂} 衰减，布居不变"
        : "：能量弛豫 |1⟩→|0⟩，P(1) 按 e^{−t/T₁} 衰减，同时相干性按 e^{−t/(2T₁)} 衰减") },
      { k: "T₁ / T₂（输入）", v: fmt(T1, 5) + " / " + fmt(T2raw, 5) + " μs" },
      { k: "T₂ 的有效值", v: fmt(T2, 5) + " μs" + (clipped
        ? "（输入 T₂ > 2T₁ 不物理，已夹到 2T₁ = " + fmt(2 * T1, 5) + " μs）"
        : "（满足 T₂ ≤ 2T₁ = " + fmt(2 * T1, 5) + " μs）") },
      { k: "T₂ / (2T₁)", v: fmt(T2 / (2 * T1), 6) + "（≤ 1 才物理）" },
      { k: "当前时刻 t", v: fmt(tEnd, 5) + " μs = " + fmt(tEnd / T2, 4) + " T₂ = " + fmt(tEnd / T1, 4) + " T₁"
        + (tSpan > tEnd ? "（t = 0 时横轴退化成一点，画图跨度自动取 1e-3 μs）" : "") },
      { k: "P(0) / P(1)", v: fmt(1 - p1[DC_N - 1], 6) + " / " + fmt(p1[DC_N - 1], 6) },
      { k: "|ρ₀₁(t)|", v: fmt(r01[DC_N - 1], 6) + "（初值 |ρ₀₁(0)| = 0.5；相干性 2|ρ₀₁| = "
        + fmt(coh[DC_N - 1], 6) + "）" },
      { k: "布洛赫矢量 (x, y, z)", v: "(" + fmt(bxf, 6) + ", 0, " + fmt(bzf, 6) + ")" },
      { k: "布洛赫矢量长度 |b|", v: fmt(nrmF, 6) + (kind === 0 ? "（= e^{−t/T₂}，单调不增）"
        : "（振幅阻尼下先降后升，t = T₁ln2 处最小 √3/2 = 0.866025）") },
      { k: "保真度 F = (1+b_x)/2", v: fmt(F, 6) + "（与初态 |+x⟩ 的重叠）" },
      { k: "纯度 Tr ρ² = (1+|b|²)/2", v: fmt(pur, 6) + (pur < 1 - 1e-12 ? "（< 1：混态）" : "（纯态）") }
    ];

    return {
      t: t,
      series: { coh: coh, bloch: blen, p1: p1 },
      info: info,
      extra: {
        lines: [
          { x: t.slice(), y: r00, label: "ρ₀₀(t) = P(0)", color: "#5aa9ff" },
          { x: t.slice(), y: r11, label: "ρ₁₁(t) = P(1)", color: "#ffb84d" },
          { x: t.slice(), y: r01, label: "|ρ₀₁(t)|（相干性的另一半）", color: "#63d6a5" }
        ],
        xlabel: "t (μs)", ylabel: "密度矩阵元素",
        title: "密度矩阵：对角元（布居）与非对角元（相干性）的衰减"
      },
      metrics: {
        kind: kind, T1: T1, T2raw: T2raw, T2: T2, clipped: clipped,
        tEnd: tEnd, coh: coh, blen: blen, p1: p1, rho01: r01, rho00: r00, rho11: r11,
        blochFinal: [bxf, 0, bzf], fidelity: F, purity: pur
      }
    };
  }

  SIM.register("decoherence", {
    title: "退相干与混合态",
    legend: "初态 |+⟩ = (|0⟩+|1⟩)/√2（P(1,0) = 1/2、ρ₀₁(0) = 1/2）。退相位：|ρ₀₁(t)| = |ρ₀₁(0)|e^{−t/T₂}，"
      + "布洛赫矢量 xy 分量按 e^{−t/T₂} 收缩（|b| 单调不增）。振幅阻尼：按契约取 P(1,t) = P(1,0)e^{−t/T₁}，"
      + "相干性取 e^{−t/(2T₁)}，于是 b_z = 1 − e^{−t/T₁} 从 0 升到 +1 —— 这是**唯象的「衰减到 0」约定**，"
      + "真实热平衡版本会衰减到稳态占据 1/(e^{ħω/k_BT}+1) 而非 0（本模型不引入温度）。"
      + "注意由此 |b| 在振幅阻尼下不是单调的：|b|² = 1 − e^{−t/T₁} + e^{−2t/T₁}，t = T₁ln2 处最小 √3/2；"
      + "真正单调不增的是相干性 2|ρ₀₁|。模型强制 T₂ ≤ 2T₁（不物理的输入会被夹取并在读数里说明）。",
    axes: { xlabel: "t (μs)", ylabel: "相干性 2|ρ₀₁|、布洛赫矢量长度 |b|、P(1)" },
    params: {
      kind: { label: "机制", type: "enum", options: DC_KINDS, def: 0 },
      T2: { label: "退相位时间 T₂", unit: "μs", def: 10, min: 1, max: 100, step: 0.5 },
      T1: { label: "能量弛豫时间 T₁", unit: "μs", def: 20, min: 1, max: 200, step: 0.5 },
      t: { label: "演化时间 t（横轴画到）", unit: "μs", def: 5, min: 0, max: 100, step: 0.5 }
    },
    plots: [
      { key: "coh", label: "相干性 2|ρ₀₁|", color: "#63d6a5" },
      { key: "bloch", label: "布洛赫矢量长度 |b|", color: "#5aa9ff" },
      { key: "p1", label: "P(1)", color: "#ffb84d" }
    ],
    compute: dcCompute,
    tests: [
      /* ① 退相位：|ρ₀₁(t)| = |ρ₀₁(0)|·e^{−t/T₂}（逐点，从 series.coh 现算） */
      { name: "① 退相位 |ρ₀₁(t)| = |ρ₀₁(0)|·e^{−t/T₂}（逐点，容差 1e-9）",
        params: { kind: 0, T2: 10, T1: 20, t: 50 },
        measure: function (o, p) {
          var i, worst = 0, d, want;
          for (i = 0; i < o.t.length; i++) {
            want = 0.5 * Math.exp(-o.t[i] / p.T2);
            d = Math.abs(o.series.coh[i] / 2 - want);
            if (d > worst) worst = d;
          }
          return worst;
        }, expect: 0, tol: 1e-9 },
      { name: "①' 退相位时布洛赫矢量长度 |b(t)| = e^{−t/T₂}（逐点，容差 1e-9）",
        params: { kind: 0, T2: 10, T1: 20, t: 50 },
        measure: function (o, p) {
          var i, worst = 0, d;
          for (i = 0; i < o.t.length; i++) {
            d = Math.abs(o.series.bloch[i] - Math.exp(-o.t[i] / p.T2));
            if (d > worst) worst = d;
          }
          return worst;
        }, expect: 0, tol: 1e-9 },
      /* ② 振幅阻尼：P(1,t) = P(1,0)·e^{−t/T₁}（逐点，从 series.p1 现算） */
      { name: "② 振幅阻尼 P(1,t) = P(1,0)·e^{−t/T₁}（逐点，容差 1e-9）",
        params: { kind: 1, T1: 20, T2: 10, t: 100 },
        measure: function (o, p) {
          var i, worst = 0, d;
          for (i = 0; i < o.t.length; i++) {
            d = Math.abs(o.series.p1[i] - 0.5 * Math.exp(-o.t[i] / p.T1));
            if (d > worst) worst = d;
          }
          return worst;
        }, expect: 0, tol: 1e-9 },
      { name: "②' 振幅阻尼 10 个 T₁ 之后 P(1) = 0.5·e^{−10} = 2.2699965×10^−5（曲线末点，容差 1e-15）",
        params: { kind: 1, T1: 10, T2: 5, t: 100 },
        measure: function (o) { return o.series.p1[o.series.p1.length - 1]; },
        expect: 0.5 * Math.exp(-10), tol: 1e-15 },
      { name: "②'' 振幅阻尼的 b_z = 1 − 2P(1) = 1 − e^{−t/T₁}（末点，容差 1e-9）",
        params: { kind: 1, T1: 20, T2: 10, t: 100 },
        measure: function (o, p) { return o.metrics.blochFinal[2] - (1 - Math.exp(-p.t / p.T1)); },
        expect: 0, tol: 1e-9 },
      /* ③ 物理约束 T₂ ≤ 2T₁：不物理的输入必须被夹取 */
      { name: "③ 物理约束 T₂ ≤ 2T₁：输入 T₂=100、T₁=5 时被夹到 T₂(eff) = 2T₁ = 10（容差 0）",
        params: { kind: 0, T2: 100, T1: 5, t: 20 },
        measure: function (o) { return o.metrics.T2 / (2 * o.metrics.T1); }, expect: 1, tol: 0 },
      { name: "③' 合法输入不被改动：T₂=10、T₁=20 时 T₂(eff) = 10（容差 1e-12）",
        params: { kind: 0, T2: 10, T1: 20, t: 20 },
        measure: function (o) { return o.metrics.T2; }, expect: 10, tol: 1e-12 },
      /* ④ 退相干不可逆：退相位支的 |b| 严格单调不增（逐点） */
      { name: "④ 布洛赫矢量长度单调不增（退相位支，逐点，容差 1e-12）",
        params: { kind: 0, T2: 10, T1: 20, t: 100 },
        measure: function (o) {
          var b = o.series.bloch, i, worst = 0, d;
          for (i = 1; i < b.length; i++) { d = b[i] - b[i - 1]; if (d > worst) worst = d; }
          return worst;
        }, expect: 0, tol: 1e-12 },
      { name: "④' 相干性 2|ρ₀₁| 在两种机制下都单调不增（逐点，容差 1e-12）",
        params: { kind: 1, T1: 20, T2: 10, t: 100 },
        measure: function (o) {
          var ks = [0, 1], i, j, worst = 0, d, o2, c;
          for (j = 0; j < ks.length; j++) {
            o2 = dcCompute({ kind: ks[j], T1: 20, T2: 10, t: 100 });
            c = o2.series.coh;
            for (i = 1; i < c.length; i++) { d = c[i] - c[i - 1]; if (d > worst) worst = d; }
          }
          void o;
          return worst;
        }, expect: 0, tol: 1e-12 },
      /* ④'' 振幅阻尼的 |b| 非单调：极小值 √3/2 出现在 t = T₁ln2（解析）。
              |b|² = 1 − e^{−t/T₁} + e^{−2t/T₁}，令 u = e^{−t/T₁} 得 1 − u + u²，u = 1/2 时最小 = 3/4。
              曲线采样步长 0.25 μs，极小点未必正好落在网格上，故容差取 1e-4；位置误差 > 1 步即判失败。 */
      { name: "④'' 振幅阻尼的 |b| 极小 = √3/2 = 0.8660254，位置 t = T₁ln2（解析，容差 1e-4）",
        params: { kind: 1, T1: 20, T2: 10, t: 100 },
        measure: function (o, p) {
          var b = o.series.bloch, i, im = 0, dt = o.t[1] - o.t[0];
          for (i = 1; i < b.length; i++) { if (b[i] < b[im]) im = i; }
          if (Math.abs(o.t[im] - p.T1 * Math.LN2) > dt) return NaN;   // 极小点位置不对 → 判失败
          return b[im];
        }, expect: 0.8660254037844386, tol: 1e-4 },
      /* ⑤ 边界安全：T→0、t→0、极端 T₁/T₂ 组合下全部输出有限 */
      { name: "⑤ 边界安全：T→0、T→10^6、t→0/10^4 下所有输出有限（无 NaN/Infinity）",
        params: { kind: 0, T2: 10, T1: 20, t: 5 },
        measure: function () {
          var Ts = [0, 1e-9, 0.001, 1, 100, 1e6, -5], ts = [0, 1e-6, 5, 100, 1e4], ks = [0, 1];
          var i, j, m, o2, key, bad = 0, q;
          for (i = 0; i < ks.length; i++) {
            for (j = 0; j < Ts.length; j++) {
              for (m = 0; m < ts.length; m++) {
                o2 = dcCompute({ kind: ks[i], T2: Ts[j], T1: Ts[(j + 3) % Ts.length], t: ts[m] });
                if (!allFinite(o2.t)) bad++;
                for (key in o2.series) { if (o2.series.hasOwnProperty(key) && !allFinite(o2.series[key])) bad++; }
                if (!allFinite([o2.metrics.T1, o2.metrics.T2, o2.metrics.fidelity, o2.metrics.purity])) bad++;
                for (q = 0; q < o2.series.p1.length; q++) {
                  if (!(o2.series.p1[q] >= -1e-12 && o2.series.p1[q] <= 1 + 1e-12)) bad++;
                }
              }
            }
          }
          return bad;
        }, expect: 0, tol: 0 }
    ]
  });
})(typeof window !== "undefined" ? window : globalThis);
