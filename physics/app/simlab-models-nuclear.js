/* ==========================================================================
   simlab-models-nuclear.js —— 核物理与粒子物理 仿真模型（W5 契约 §13.A.2，3 个）

     · decay                放射性衰变：指数律、半衰期、平均寿命、母子体平衡、统计涨落（泊松）
     · nuclear-binding      结合能与核反应：半经验公式 B(A,Z)、B/A 曲线、质量亏损与 Q 值
     · particle-kinematics  碰撞运动学：固定靶 √s、对撞机 √s、产生阈值、不变质量

   ★ 约束（与 simlab.js 顶部、simlab-models-stat.js 一致）：
     · 加载时**只调用 SIM.register**，绝不触碰 DOM —— tools/verify-simlab.mjs 在 Node 里
       用 window 桩直接跑 compute() 与 tests 做物理不变量自检；
     · decay 的随机数全部来自文件内自带的 mulberry32（带种子），**全文没有 Math.random**，
       同一个 seed 的轨迹逐位可重复；
     · 纯 ES5：var / 无箭头函数 / 无模板字符串 / 无 import-export；
     · 边界安全：任意参数取值都不抛异常、不出 NaN/Infinity —— T½→0、N₀=1、A=2、Z>A、Z=0、
       m=0、E 低于阈值、靶质量→0 都有夹取或可读结论（info 里不会出现 NaN/Infinity 字样）。

   物理常量（照抄 app/constants.js，CODATA 2018 / 2019 年 SI 定义值，不凭记忆另写）：
     · "原子质量单位 u = 1.660 539 066 60 × 10^-27 kg"，"1 u 对应能量 931.494 102 MeV"；
     · "质子质量 m_p = 1.672 621 923 69 × 10^-27 kg"、"中子质量 m_n = 1.674 927 498 04 × 10^-27 kg"。
     本文件在 Node 里被单独加载，不能假设 window.PHYSICS_CONSTANTS 已存在，故直接写在文件里；
     由 m_p/u、m_n/u 现算出来的 1.007 276 466 621 u、1.008 664 915 95 u 与 AME2020 表里的
     1 007 276.466 62(1) μu、1 008 664.915 90(47) μu 在 1e-10 位上一致。

   核质量数据来源（唯一的"实验输入"，其余全是解析式）：
     AME2020 原子质量表 mass_1.mas20（W.J.Huang 等，Chinese Physics C 45, 030002/030003, 2021，
     https://www-nds.iaea.org/amdc/ame2020/mass_1.mas20.txt），单位为 μu（微 u，含核外电子）；
     ²³⁵U、²³⁸U 两条另与 NIST Atomic Weights and Isotopic Compositions（基于 AME2020）核对一致。
     用**原子质量**做质量亏损时电子自动抵消：Δm = Z·m(¹H) + (A−Z)·m(n) − M(原子)。
   ========================================================================== */
(function (global) {
  "use strict";
  var SIM = global.SIM;
  if (!SIM) return;   // 在 Node 里若未先加载 simlab.js，安静退出

  var lin = SIM.linspace, fmt = SIM.fmt, opt = SIM.opt;

  /* ------------------------------------------------------------- 物理常量 */
  var U_KG = 1.66053906660e-27;      // kg，原子质量单位
  var U_MEV = 931.494102;            // MeV，1 u 对应的能量（核反应算 Q 值全靠它）
  var M_N_U = 1.67492749804e-27 / U_KG;   // 中子质量（u）= 1.00866491595
  var H1_U = 1.007825031898;         // ¹H 原子质量（u，AME2020；= m_p + m_e − 13.6 eV/c²）

  /* --------------------------------------------------------------- 小工具 */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  /** 参数安全取值：课程 config 不受滑块范围限制，NaN/越界/非数字都夹到合法区间 */
  function num(v, defv) { var x = Number(v); return isFinite(x) ? x : defv; }
  /** 有限性兜底：把 ±Infinity/NaN 换成 fallback（"不出 NaN/Infinity"这条约束集中在这里） */
  function fin(v, fallback) { return isFinite(v) ? v : fallback; }
  /** 数组最大值下标（B/A 曲线的峰值定位、直方图峰值都用它） */
  function argmax(ys) {
    var m = 0, i;
    for (i = 1; i < ys.length; i++) if (ys[i] > ys[m]) m = i;
    return m;
  }
  /** 两个等长序列的最大逐点偏差（"同 seed 可重复"自检） */
  function maxDiff(a, b) {
    if (!a || !b || a.length !== b.length) return Infinity;
    var m = 0, i, d;
    for (i = 0; i < a.length; i++) {
      d = Math.abs(a[i] - b[i]);
      if (!isFinite(d)) return Infinity;
      if (d > m) m = d;
    }
    return m;
  }
  /**
   * mulberry32：32 位状态的带种子 PRNG（自带的，不用 Math.random）。
   *   a ← a + 0x6D2B79F5；t ← (a ^ (a>>>15))·(1|a)；t ← (t + (t^(t>>>7))·(61|t)) ^ t；u = (t^(t>>>14))/2³²
   * 全部是 32 位整数运算（Math.imul），所以同一个 seed 的序列**逐位可重复**。
   */
  function mulberry32(seed) {
    var a = Math.floor(num(seed, 1)) | 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /**
   * 泊松分布 pmf：P(k) = e^{−μ}μ^k/k!。
   * 直接连乘 μ^k/k! 在 μ 大时会先上溢再下溢，这里全部在对数域递推：
   *   lnP(0) = −μ，lnP(k) = lnP(k−1) + lnμ − ln k，最后取 exp。
   * exp 下溢到 0 是**安全值**（不是 NaN/Infinity），所以任意 μ 都不会出问题。
   */
  function poissonPmf(mu, kmax) {
    var out = [], k, lp, sum = 0;
    if (!(mu > 0)) {                       // μ = 0：全部概率在 k = 0
      for (k = 0; k <= kmax; k++) out.push(k === 0 ? 1 : 0);
      return out;
    }
    lp = -mu;
    for (k = 0; k <= kmax; k++) {
      out.push(Math.exp(lp));
      lp += Math.log(mu) - Math.log(k + 1);
    }
    for (k = 0; k < out.length; k++) sum += out[k];
    if (sum > 0 && Math.abs(sum - 1) > 1e-12) {   // 截断到 kmax 后归一（不影响形状）
      for (k = 0; k < out.length; k++) out[k] /= sum;
    }
    return out;
  }

  /* ==========================================================================
     1. decay —— 放射性衰变
     ==========================================================================
     解析式（全部是标准结论，自检的 expect 就取这些值）：
       λ = ln2/T½          衰变常数
       τ = 1/λ = T½/ln2 = 1.442 695 040 888 963 4·T½     平均寿命
       N(t) = N₀e^{−λt}    母核数（= N₀·2^{−t/T½}）
       A(t) = λN(t)        活度（Bq）
     母子体平衡（子体半衰期取 T½/6 ⇒ λ₂ = 6λ₁、N₂(0) = 0）：
       N₂(t) = N₀·λ₁/(λ₂−λ₁)·(e^{−λ₁t} − e^{−λ₂t}) = (N₀/5)(e^{−λ₁t} − e^{−6λ₁t})
       长期极限 N₂/N₁ → λ₁/(λ₂−λ₁) = 1/5（"长期平衡"）
       子体活度超过母体的时刻：A₂ = A₁ ⇔ t = ln(λ₂/λ₁)/(λ₂−λ₁) = ln6/(5λ₁) = 0.51699·T½
     统计涨落：短时间窗 Δt 内"数衰变个数"是**计数实验**，k ~ Binomial(N₀, 1−e^{−λΔt})，
       在 p ≪ 1 的泊松极限下方差 = 均值。自检用合并散度指数
         X/(MW) = Σ_{j,k}(k_jk − μ_k)²/(μ_k·M·W)，泊松下 → 1（偏差恰好 = −p̄ 量级 0.7%），
       它比"直方图样本方差/均值"的统计噪声小得多（M·W 个样本 ⇒ 噪声 √(2/MW) ≈ 0.7%）。
     ========================================================================== */
  var DECAY_OPTS = ["单代衰变", "母子体平衡", "统计涨落"];
  var DECAY_SPAN = 6;          // 横轴 0 → 6 个半衰期（N 剩 1/64）
  var DECAY_NT = 601;          // 每半衰期 100 个网格点
  var DECAY_W = 40;            // 直方图：把 [0, T½] 切成 40 个时间窗
  var DECAY_TWIN = 0.5;        // 计数窗总长 = T½/2（前两个窗的期望计数差一倍，便于看趋势）
  var DECAY_BUDGET = 1.2e6;    // 蒙特卡洛抽样预算上限（任何滑块取值都能秒算完）

  /** t 网格：0 → 6T½，且每个半衰期点严格落在网格上（N(T½) = N₀/2 需要精确的 t = T½） */
  function decayGrid(T12) {
    var ts = lin(0, DECAY_SPAN * T12, DECAY_NT), per = (DECAY_NT - 1) / DECAY_SPAN, k;
    for (k = 0; k <= DECAY_SPAN; k++) ts[Math.round(k * per)] = k * T12;
    return ts;
  }
  function decayLam(T12) { return Math.LN2 / T12; }
  function decayTau(T12) { return T12 / Math.LN2; }

  /**
   * 统计涨落：M 次"平行计数实验"，每次都在 [0, T½/2] 的 40 个时间窗里数衰变个数。
   * 每个核的寿命用逆变换法抽样 τ_i = −τ̄·ln(u)（u ~ U(0,1) 由带种子 PRNG 给出）——
   * 这正是指数分布的正确抽样，所以计数分布与真实放射性计数同分布。
   * 返回：直方图（窗 0 的计数分布）、各窗期望 μ_k、合并散度指数 X/(MW)。
   */
  function decayFluct(N0, T12, seed) {
    var tau = decayTau(T12), lam = decayLam(T12);
    var M = Math.round(clamp(DECAY_BUDGET / N0, 60, 4000));   // 实验次数随 N₀ 自适应
    var W = DECAY_W, each = DECAY_TWIN * T12 / W, tend = DECAY_TWIN * T12;
    var rnd = mulberry32(seed);
    var mu = [], sumK = [], sumK2 = [], k, i, j;
    for (k = 0; k < W; k++) {
      mu.push(N0 * (Math.exp(-lam * k * each) - Math.exp(-lam * (k + 1) * each)));
      sumK.push(0); sumK2.push(0);
    }
    var hist = [], histMax = 0, cnt = [];
    for (j = 0; j < M; j++) {
      for (k = 0; k < W; k++) cnt[k] = 0;
      for (i = 0; i < N0; i++) {
        var u = rnd();
        if (u <= 0) u = 1e-12;                        // mulberry32 可能给 0，挡住 ln 0 = −∞
        var tt = -tau * Math.log(u);
        if (tt < tend) { k = Math.floor(tt / each); if (k >= W) k = W - 1; cnt[k]++; }
      }
      for (k = 0; k < W; k++) { sumK[k] += cnt[k]; sumK2[k] += cnt[k] * cnt[k]; }
      k = cnt[0];
      if (hist[k] == null) hist[k] = 0;
      hist[k]++;
      if (k > histMax) histMax = k;
    }
    // 合并散度指数：Σ_j(k_jk−μ_k)² = Σ_j k² − 2μ_kΣ_j k + Mμ_k²
    var X = 0, MW = M * W;
    for (k = 0; k < W; k++) {
      X += (sumK2[k] - 2 * mu[k] * sumK[k] + M * mu[k] * mu[k]) / (mu[k] > 0 ? mu[k] : 1);
    }
    var n = 0, mean = 0, varr = 0, c;
    for (k = 0; k <= histMax; k++) { c = hist[k] || 0; n += c; mean += c * k; }
    mean = n ? mean / n : 0;
    for (k = 0; k <= histMax; k++) { c = hist[k] || 0; varr += c * (k - mean) * (k - mean); }
    varr = n > 1 ? varr / (n - 1) : 0;
    var bins = 0;
    for (k = 0; k <= histMax; k++) if ((hist[k] || 0) > 0) bins++;
    return {
      M: M, W: W, mu: mu, mu0: mu[0], each: each, tend: tend,
      hist: hist, histMax: histMax, histBins: bins, histMean: mean, histVar: varr,
      disp: X / MW, pmf: poissonPmf(mu[0], histMax + 2)
    };
  }

  /**
   * 蒙特卡洛生存曲线：给 N₀ 个核各抽一个寿命（同上的逆变换法），
   * 在网格时刻数"还没衰变"的个数 ⇒ 单调不增的阶梯，期望值 = N₀e^{−λt}。
   */
  function decayMcPath(N0, T12, seed, ts) {
    var tau = decayTau(T12), rnd = mulberry32(seed), life = [], i, p = 0, out = [];
    for (i = 0; i < N0; i++) {
      var u = rnd();
      if (u <= 0) u = 1e-12;
      life.push(-tau * Math.log(u));
    }
    life.sort(function (a, b) { return a - b; });
    for (i = 0; i < ts.length; i++) {
      while (p < life.length && life[p] <= ts[i]) p++;
      out.push(N0 - p);
    }
    return out;
  }

  /** 一次完整的衰变计算（compute 与自检共用同一条代码路径） */
  function decayCompute(p) {
    var T12 = clamp(num(p.T12, 10), 1e-6, 1e6);             // T½ → 0 / → ∞ 都夹住
    var N0 = Math.round(clamp(num(p.N0, 1000), 1, 100000));
    var seed = Math.round(clamp(num(p.seed, 1), 1, 99999));
    var name = opt(DECAY_OPTS, p.kind);
    var kind = DECAY_OPTS.indexOf(name);
    if (kind < 0) kind = 0;
    var lam = decayLam(T12), tau = decayTau(T12);
    var ts = decayGrid(T12);
    var per = Math.round((DECAY_NT - 1) / DECAY_SPAN), iHalf = per;
    var lam2 = 6 * lam, N = [], Nd = [], Nmc = [], i, t;

    if (kind === 1) {
      // 母子体平衡：N₂(t) = (N₀/5)(e^{−λt} − e^{−6λt})
      for (i = 0; i < ts.length; i++) {
        t = ts[i];
        N.push(N0 * Math.exp(-lam * t));
        Nd.push(N0 / 5 * (Math.exp(-lam * t) - Math.exp(-lam2 * t)));
      }
    } else if (kind === 2) {
      for (i = 0; i < ts.length; i++) N.push(N0 * Math.exp(-lam * ts[i]));
      Nmc = decayMcPath(N0, T12, seed, ts);
    } else {
      for (i = 0; i < ts.length; i++) {
        t = ts[i];
        N.push(N0 * Math.exp(-lam * t));
        Nd.push(N0 - N0 * Math.exp(-lam * t));            // 稳定子体的累积量（母+子 = N₀）
      }
    }

    var fl = decayFluct(N0, T12, seed);
    var A0 = lam * N0;
    var nEnd = N[N.length - 1];
    var info = [
      { k: "衰变常数 λ = ln2/T½", v: fmt(lam, 6) + " /s" },
      { k: "平均寿命 τ = 1/λ = T½/ln2", v: fmt(tau, 6) + " s" },
      { k: "半衰期 T½", v: fmt(T12, 6) + " s" },
      { k: "初始活度 A₀ = λN₀", v: fmt(A0, 6) + " Bq" }
    ];
    var metrics;
    if (kind === 1) {
      var ratioEnd = N[N.length - 1] > 0 ? Nd[Nd.length - 1] / N[N.length - 1] : 0;
      var tEq = Math.log(lam2 / lam) / (lam2 - lam);
      info.push({ k: "子体半衰期 T½₂ = T½/6（λ₂ = 6λ₁）", v: fmt(T12 / 6, 6) + " s" });
      info.push({ k: "t = T½ 处 N₁ / N₂", v: fmt(N[iHalf], 4) + " / " + fmt(Nd[iHalf], 4) + " 个" });
      info.push({ k: "t = 6T½ 处 N₂/N₁（长期极限 = λ₁/(λ₂−λ₁) = 0.2）", v: fmt(ratioEnd, 6) });
      info.push({ k: "子体活度追上母体的时刻 ln6/(5λ₁)", v: fmt(tEq, 6) + " s（= " + fmt(tEq / T12, 5) + " T½）" });
      info.push({ k: "该时刻活度 A₁ = A₂", v: fmt(lam * N0 * Math.exp(-lam * tEq), 6) + " Bq" });
      metrics = { ratioEnd: ratioEnd, tEq: tEq, lam2: lam2 };
    } else if (kind === 2) {
      var mcHalf = Nmc[iHalf], mcEnd = Nmc[Nmc.length - 1];
      var sdHalf = Math.sqrt(N0 * 0.25);                   // Binomial(N₀, ½) 的标准差
      info.push({ k: "解析 N(T½) = N₀/2", v: fmt(N0 / 2, 4) + " 个" });
      info.push({ k: "蒙特卡洛 N_mc(T½)", v: fmt(mcHalf, 0) + " 个（偏离 " + fmt((mcHalf - N0 / 2) / sdHalf, 3) + " σ）" });
      info.push({ k: "蒙特卡洛 N_mc(6T½)", v: fmt(mcEnd, 0) + " 个（解析 " + fmt(N0 / 64, 2) + "）" });
      info.push({ k: "计数窗 Δt = T½/80 内的平均计数 μ", v: fmt(fl.mu0, 4) + " 个" });
      info.push({ k: "直方图：均值 / 方差 / 方差比均值", v: fmt(fl.histMean, 4) + " / " + fmt(fl.histVar, 4) + " / " + fmt(fin(fl.histVar / fl.histMean, 0), 4) });
      info.push({ k: "合并散度指数（泊松 ⇒ 1）", v: fmt(fl.disp, 5) + "（" + fl.M + " 次实验 × " + fl.W + " 个窗）" });
      metrics = { mcHalf: mcHalf, mcEnd: mcEnd, sdHalf: sdHalf };
    } else {
      info.push({ k: "N(0) / N(T½) / N(3T½)", v: fmt(N[0], 4) + " / " + fmt(N[iHalf], 4) + " / " + fmt(N[3 * iHalf], 4) + " 个" });
      info.push({ k: "N(T½)/N₀（解析值 50 %）", v: fmt(N[iHalf] / N0 * 100, 4) + " %" });
      info.push({ k: "活度 A(T½) = λN(T½)", v: fmt(lam * N[iHalf], 6) + " Bq" });
      info.push({ k: "N(6T½)/N₀（解析值 1/64）", v: fmt(nEnd / N0 * 100, 4) + " %" });
      metrics = {};
    }
    info.push({ k: "随机种子 / 平行实验数", v: "seed = " + seed + "，M = " + fl.M + " 次" });

    // ---------- extra：统计涨落直方图（阶梯折线 + 泊松预测） ----------
    var hx = [], hy = [], px = [], py = [], kk, c, pp;
    for (kk = 0; kk <= fl.histMax + 1; kk++) {
      c = fl.hist[kk] || 0;
      hx.push(kk - 0.5); hy.push(c); hx.push(kk + 0.5); hy.push(c);
      pp = fl.M * (fl.pmf[kk] || 0);
      px.push(kk - 0.5); py.push(pp); px.push(kk + 0.5); py.push(pp);
    }

    return {
      t: ts,
      series: { N: N, Nd: Nd, Nmc: Nmc },
      info: info,
      bars: [
        { label: "N(T½)/N₀（解析 0.5）", value: N[iHalf] / N0, color: "#5aa9ff" },
        { label: "N(3T½)/N₀（解析 0.125）", value: N[3 * iHalf] / N0, color: "#ffb84d" },
        { label: "直方图方差/均值（泊松 ⇒ 1）", value: fin(fl.histVar / fl.histMean, 0), color: "#63d6a5" }
      ],
      extra: {
        lines: [
          { x: hx, y: hy, label: "蒙特卡洛计数分布（" + fl.M + " 次实验）", color: "#5aa9ff" },
          { x: px, y: py, label: "泊松分布预测 M·P(k; μ)", color: "#ffb84d", dash: "6 4" }
        ],
        xlabel: "时间窗内的衰变计数 k（窗宽 Δt = T½/80）", ylabel: "实验次数",
        title: "统计涨落直方图：" + fl.M + " 次平行计数实验，每次统计 [0, T½/80] 内的衰变个数" +
          "（μ = " + fmt(fl.mu0, 3) + "，σ = " + fmt(Math.sqrt(fl.mu0), 3) + "）"
      },
      metrics: {
        T12: T12, N0: N0, seed: seed, lam: lam, tau: tau, A0: A0, iHalf: iHalf,
        kind: kind, M: fl.M, W: fl.W, mu0: fl.mu0, disp: fl.disp,
        histMean: fl.histMean, histVar: fl.histVar, histBins: fl.histBins,
        histMax: fl.histMax, Nmc: Nmc, fl: fl,
        ratioEnd: metrics.ratioEnd, tEq: metrics.tEq, lam2: metrics.lam2,
        mcHalf: metrics.mcHalf, mcEnd: metrics.mcEnd, sdHalf: metrics.sdHalf
      }
    };
  }

  SIM.register("decay", {
    title: "放射性衰变：指数律、半衰期与统计涨落",
    legend: "N(t) = N₀e^(−λt)，λ = ln2/T½：每过一个半衰期剩下的核数减半，与 N₀ 无关。" +
      "曲线取 0 → 6T½（剩 1/64）。下图是短时间窗内衰变计数的统计涨落直方图——" +
      "放射性计数服从泊松分布：方差 = 均值，σ = √μ。同一 seed 的模拟逐位可重复。",
    axes: { xlabel: "时间 t (s)（横轴 0 → 6 个半衰期）", ylabel: "核数 N（个）" },
    params: {
      kind: { label: "衰变模式", type: "enum", options: DECAY_OPTS, def: 0 },
      T12: { label: "半衰期 T½", unit: "s", def: 10, min: 0.1, max: 100, step: 0.1 },
      N0: { label: "初始核数 N₀", unit: "个", def: 1000, min: 1, max: 10000, step: 1 },
      seed: { label: "随机种子", unit: "", def: 1, min: 1, max: 9999, step: 1 }
    },
    plots: [
      { key: "N", label: "母核 N(t) = N₀e^(−λt)", color: "#5aa9ff" },
      { key: "Nd", label: "子核 N_d(t)", color: "#63d6a5", dash: "5 4" },
      { key: "Nmc", label: "蒙特卡洛生存数（统计涨落模式）", color: "#ffb84d" }
    ],
    compute: decayCompute,
    tests: [
      // ① N(t) = N₀e^{−λt}（λ = ln2/T½）：与独立写法 N₀·2^{−t/T½} 逐点比对。
      //    两种写法数学上恒等，数值上只差浮点舍入（N₀ = 1000 时约 1e-13 ≪ 1e-9）
      { name: "① N(t) = N₀e^(−λt) 逐点吻合 N₀·2^(−t/T½)（最大绝对偏差）",
        params: { kind: 0, T12: 10, N0: 1000, seed: 1 },
        measure: function (o, p) {
          var m = 0, i, d;
          for (i = 0; i < o.t.length; i++) {
            d = Math.abs(o.series.N[i] - p.N0 * Math.pow(0.5, o.t[i] / p.T12));
            if (d > m) m = d;
          }
          return m;
        }, expect: 0, tol: 1e-9 },
      // ② N(T½) = N₀/2：网格上严格含 t = T½（decayGrid 强制），且 IEEE 双精度下
      //    Math.exp(−Math.LN2) 恰好等于 0.5，所以实测偏差为 0
      { name: "② N(T½) = N₀/2（精确，容差 1e-12）",
        params: { kind: 0, T12: 10, N0: 1000, seed: 1 },
        measure: function (o, p) { return Math.abs(o.series.N[o.metrics.iHalf] - p.N0 / 2); },
        expect: 0, tol: 1e-12 },
      // ③ τ = T½/ln2 = 1.442 695 040 888 963 4·T½（1/ln2 的解析值）
      { name: "③ τ = T½/ln2 = 1.4426950408889634·T½",
        params: { T12: 10 },
        measure: function (o, p) { return o.metrics.tau / p.T12; },
        expect: 1.4426950408889634, tol: 1e-9 },
      // ③b 反过来从**曲线**定 λ：λ = ln[N(0)/N(T½)]/T½，与解析 ln2/T½ 之比应为 1
      { name: "③b 由曲线反推 λ = ln[N(0)/N(T½)]/T½ 与 ln2/T½ 之比 = 1",
        params: { kind: 0, T12: 10, N0: 1000, seed: 1 },
        measure: function (o, p) {
          var i1 = o.metrics.iHalf;
          return (Math.log(o.series.N[0] / o.series.N[i1]) / (o.t[i1] - o.t[0])) / (Math.LN2 / p.T12);
        }, expect: 1, tol: 1e-9 },
      // ④ 统计涨落服从泊松：合并散度指数 X/(MW) = Σ(k_jk−μ_k)²/(μ_k·M·W) → 1。
      //    对 Binomial(N₀, p_k) 有 E[(k−μ)²] = μ(1−p_k)，所以解析期望 = 1 − p̄ ≈ 0.993；
      //    M·W ≈ 4.8e4 个样本 ⇒ 统计噪声 √(2/MW) ≈ 0.7%，相对偏差远小于 5%
      { name: "④ 统计涨落服从泊松：方差/均值 = 1（合并散度指数，相对偏差 < 5%）",
        params: { kind: 2, T12: 10, N0: 1000, seed: 1 },
        measure: function (o) { return o.metrics.histBins >= 5 ? Math.abs(o.metrics.disp - 1) : 9; },
        expect: 0, tol: 0.05 },
      // ④b 直方图自己的方差/均值（样本少、噪声大，容差放宽到 20%，只作粗判据）
      { name: "④b 直方图方差 ≈ 均值（同一判据的粗粒度版本，容差 20%）",
        params: { kind: 2, T12: 10, N0: 1000, seed: 1 },
        measure: function (o) { return Math.abs(o.metrics.histVar / o.metrics.histMean - 1); },
        expect: 0, tol: 0.2 },
      // ⑤ 同 seed 完全可重复：PRNG 与抽样顺序都是确定性的 ⇒ 逐点逐位一致（容差 0）
      { name: "⑤ 同 seed 完全可重复（两次运行逐点逐位一致）",
        params: { kind: 2, T12: 10, N0: 1000, seed: 3 },
        measure: function (o, p) { return maxDiff(o.series.Nmc, decayCompute(p).series.Nmc); },
        expect: 0, tol: 0 },
      { name: "⑤b 换 seed 结果不同（随机数真的由 seed 决定）",
        params: { kind: 2, T12: 10, N0: 1000, seed: 3 },
        measure: function (o, p) {
          var o2 = decayCompute({ kind: 2, T12: p.T12, N0: p.N0, seed: 4 });
          return maxDiff(o.series.Nmc, o2.series.Nmc) > 0 ? 1 : 0;
        }, expect: 1, tol: 0 },
      // ⑤c MC 生存曲线：结构上单调不增、起点 = N₀；数值上 N_mc(T½) 与解析 N₀/2 之差
      //    应落在 Binomial(N₀, ½) 标准差的 4 倍以内（σ = √(N₀/4) = 15.8）
      { name: "⑤c MC 生存曲线单调不增、起点 N₀，且 N_mc(T½) 在解析值 4σ 内",
        params: { kind: 2, T12: 10, N0: 1000, seed: 5 },
        measure: function (o, p) {
          var v = o.series.Nmc, i, bad = 0;
          if (v[0] !== p.N0) return 9;
          for (i = 1; i < v.length; i++) if (v[i] > v[i - 1]) bad++;
          if (bad) return 9;
          return Math.abs(o.metrics.mcHalf - p.N0 / 2) / o.metrics.sdHalf;
        }, expect: 0, tol: 4 },
      // ⑥ 母子体长期平衡：N₂/N₁ → λ₁/(λ₂−λ₁) = 1/5（λ₂ = 6λ₁）。
      //    t = 6T½ 处瞬变态 e^{−(λ₂−λ₁)t} = 2^{−30} ≈ 9.3e-10，所以相对偏差 ~2e-10
      { name: "⑥ 母子体长期平衡比 N₂/N₁ = λ₁/(λ₂−λ₁) = 0.2（相对容差 1e-6）",
        params: { kind: 1, T12: 10, N0: 1000, seed: 1 },
        measure: function (o) {
          var n = o.t.length - 1;
          return Math.abs(o.series.Nd[n] / o.series.N[n] - 0.2);
        }, expect: 0, tol: 1e-6 },
      // ⑦ 子体活度追上母体的时刻：由**画出来的两条曲线**求 A₂/A₁ = (λ₂N₂)/(λ₁N₁) 的过零点
      //    （线性插值），解析值 t = ln(λ₂/λ₁)/(λ₂−λ₁) = ln6/(5λ₁) = 0.516 988 6·T½
      { name: "⑦ A₂ = A₁ 的交点 t/T½ = ln6/(5ln2)（由曲线插值现算，容差 0.004）",
        params: { kind: 1, T12: 10, N0: 1000, seed: 1 },
        measure: function (o, p) {
          var l1 = Math.LN2 / p.T12, l2 = 6 * l1, i, r, rp, x0 = 0, x1 = 0, y0 = 0, y1 = 0;
          rp = (l2 * o.series.Nd[0]) / (l1 * o.series.N[0]) - 1;
          for (i = 1; i < o.t.length; i++) {
            r = (l2 * o.series.Nd[i]) / (l1 * o.series.N[i]) - 1;
            if (rp <= 0 && r >= 0) { x0 = o.t[i - 1]; x1 = o.t[i]; y0 = rp; y1 = r; break; }
            rp = r;
          }
          if (x1 === x0) return NaN;
          return (x0 + (x1 - x0) * (0 - y0) / (y1 - y0)) / p.T12;
        }, expect: Math.log(6) / (5 * Math.LN2), tol: 0.004 },
      // ⑧ 边界安全：T½ 取滑块两端与滑块外（1e-6、1e6）、N₀ 取 1 与 10000，
      //    全部输出有限；且 info 的字符串里不出现 NaN / Infinity（屏幕上不会出现脏数字）
      { name: "⑧ 边界：T½ = 1e-6…1e6、N₀ = 1…10000 时全部输出有限、info 无 NaN/Infinity",
        params: { kind: 2, T12: 10, N0: 1, seed: 9999 },
        measure: function (o) {
          var cases = [{ T12: 0.1, N0: 1 }, { T12: 100, N0: 10000 }, { T12: 1e-6, N0: 1 },
            { T12: 1e6, N0: 10000 }, { T12: 0, N0: 0 }, { T12: NaN, N0: NaN }];
          var bad = 0, k, i, oc, s;
          for (k = 0; k < cases.length; k++) {
            oc = decayCompute({ kind: k % 3, T12: cases[k].T12, N0: cases[k].N0, seed: 9999 });
            for (i = 0; i < oc.t.length; i++) if (!isFinite(oc.t[i]) || !isFinite(oc.series.N[i])) bad++;
            for (i = 0; i < oc.series.Nmc.length; i++) if (!isFinite(oc.series.Nmc[i])) bad++;
            if (!isFinite(oc.metrics.lam) || !isFinite(oc.metrics.tau) || !isFinite(oc.metrics.disp)) bad++;
            for (i = 0; i < oc.info.length; i++) {
              s = String(oc.info[i].v);
              if (s.indexOf("NaN") >= 0 || s.indexOf("Infinity") >= 0) bad++;
            }
          }
          void o;
          return bad;
        }, expect: 0, tol: 0 }
    ]
  });

  /* ==========================================================================
     2. nuclear-binding —— 结合能与核反应（半经验公式 Weizsäcker / 贝特）
     ==========================================================================
     半经验质量公式（B 为总结合能，MeV；契约给的系数逐字照抄）：
       B(A,Z) = a_V A − a_S A^{2/3} − a_C Z(Z−1)/A^{1/3} − a_A (A−2Z)²/A + δ
       a_V = 15.75、a_S = 17.8、a_C = 0.711、a_A = 23.7 MeV
       δ = +11.18/√A（偶偶核）、−11.18/√A（奇奇核）、0（奇 A 核）
     五项物理意义：体积能（核力饱和）、表面能（表层核子少邻居）、库仑能（质子互斥）、
     对称能（N≠Z 的代价）、对能（同类核子成对）。
     最稳定线（每个 A 使 B 最大的整数 Z）：光滑部分解析极小
       Z*(A) = (A/2)/(1 + κA^{2/3})，κ = a_C/(4a_A) = 0.0075；
     对能会让偶 Z 略占便宜，所以实现里在 Z* 附近 ±12 内**枚举**取真正最大的整数 Z。
     B/A 曲线的峰值：argmax = A = 58（B/A = 8.8648 MeV，实测），落在契约要求的 56 ± 6 内。
     ⁴He 的实测值（本节 ③ 的自检目标，来自 AME2020 质量而非半经验公式）：
       Δm = 2m(¹H) + 2m(n) − M(⁴He) = 0.0303766416 u ⇒ B = 28.2957 MeV ⇒ B/A = 7.0739 MeV
     （半经验公式给 22.84 MeV / 5.71 MeV —— 轻核偏差大，正因为 α 粒子是"结团"而非液滴，
       这正是把实验质量表放进模型的理由。）
     质量亏损与 Q 值：Δm = Z·m(¹H) + (A−Z)·m(n) − M(原子)，Q = Δm·c² = Δm × 931.494102 MeV/u。
     经典核对：D + T → ⁴He + n 的 Δm = 0.0188828892 u ⇒ Q = 17.5893 MeV（实验值 17.59 MeV）。
     ========================================================================== */
  var NB_OPTS = ["结合能曲线", "质量亏损与Q值", "半经验公式"];
  var NB_AV = 15.75, NB_AS = 17.8, NB_AC = 0.711, NB_AA = 23.7, NB_APAIR = 11.18;
  var NB_KAPPA = NB_AC / (4 * NB_AA);      // 0.0075：库仑能/对称能竞争的系数
  var NB_AMIN = 2, NB_AMAX = 250;          // B/A 曲线的横轴范围（契约 A 的滑块范围）

  /**
   * 原子质量表（u，含核外电子；AME2020，见文件头的数据来源）。
   * 格式 [Z, A, 符号, 原子质量 u]。电子在质量亏损里自动抵消（两边都是原子质量），
   * 所以直接用这张表就能算结合能：B = [Z·m(¹H) + (A−Z)m(n) − M]c²。
   */
  var NB_MASS = [
    [1, 1, "¹H", 1.007825031898], [1, 2, "²H", 2.014101777844], [1, 3, "³H", 3.01604928132],
    [2, 3, "³He", 3.01602932197], [2, 4, "⁴He", 4.00260325413],
    [3, 6, "⁶Li", 6.01512288742], [3, 7, "⁷Li", 7.01600343426], [4, 9, "⁹Be", 9.012183062],
    [5, 10, "¹⁰B", 10.012936862], [5, 11, "¹¹B", 11.009305166],
    [6, 12, "¹²C", 12.0], [6, 13, "¹³C", 13.00335483534],
    [7, 14, "¹⁴N", 14.00307400425], [7, 15, "¹⁵N", 15.00010889827], [8, 16, "¹⁶O", 15.99491461926],
    [10, 20, "²⁰Ne", 19.99244017525], [11, 23, "²³Na", 22.98976928195], [12, 24, "²⁴Mg", 23.985041689],
    [13, 27, "²⁷Al", 26.981538408], [14, 28, "²⁸Si", 27.97692653442], [16, 32, "³²S", 31.97207117354],
    [20, 40, "⁴⁰Ca", 39.962590850], [26, 56, "⁵⁶Fe", 55.934935537], [28, 62, "⁶²Ni", 61.928344753],
    [82, 208, "²⁰⁸Pb", 207.97665256], [92, 235, "²³⁵U", 235.0439301], [92, 238, "²³⁸U", 238.0507884]
  ];

  function nbNuclide(Z, A) {
    var i;
    for (i = 0; i < NB_MASS.length; i++) if (NB_MASS[i][0] === Z && NB_MASS[i][1] === A) return NB_MASS[i];
    return null;
  }
  /** 对能 δ（MeV）：偶偶核 +11.18/√A、奇奇核 −11.18/√A、奇 A 核 0 */
  function nbPair(A, Z) {
    var N = A - Z, oddZ = (Z % 2) !== 0, oddN = (N % 2) !== 0;
    if (oddZ && oddN) return -NB_APAIR / Math.sqrt(A);
    if (!oddZ && !oddN) return NB_APAIR / Math.sqrt(A);
    return 0;
  }
  /** 半经验公式的"光滑部分"（不含对能），质量抛物线的连续曲线用它 */
  function nbBsmooth(A, Z) {
    return NB_AV * A - NB_AS * Math.pow(A, 2 / 3) - NB_AC * Z * (Z - 1) / Math.pow(A, 1 / 3)
      - NB_AA * (A - 2 * Z) * (A - 2 * Z) / A;
  }
  /** 半经验公式总结合能 B(A,Z)（MeV）。A ≥ 1 已由调用方保证，不会出现 1/0 */
  function nbB(A, Z) { return nbBsmooth(A, Z) + nbPair(A, Z); }
  /** 五项分解（MeV）：[体积, 表面, 库仑, 对称, 对能]，和 = B */
  function nbTerms(A, Z) {
    return [
      NB_AV * A,
      -NB_AS * Math.pow(A, 2 / 3),
      -NB_AC * Z * (Z - 1) / Math.pow(A, 1 / 3),
      -NB_AA * (A - 2 * Z) * (A - 2 * Z) / A,
      nbPair(A, Z)
    ];
  }
  /** 光滑（不含对能）抛物线极小点的解析位置 Z*(A) = (A/2)/(1+κA^{2/3}) */
  function nbZStarSmooth(A) { return (A / 2) / (1 + NB_KAPPA * Math.pow(A, 2 / 3)); }
  /** 使 B(A,Z) 最大的整数 Z：在解析极小点附近 ±12 内枚举（对能会挑出偶 Z） */
  function nbZBest(A) {
    var mid = Math.round(nbZStarSmooth(A));
    var lo = Math.round(clamp(mid - 12, 0, A)), hi = Math.round(clamp(mid + 12, 0, A));
    var z, b, bz = lo, bb = -Infinity;
    for (z = lo; z <= hi; z++) { b = nbB(A, z); if (b > bb) { bb = b; bz = z; } }
    return bz;
  }
  /** 由结合能反推原子质量（u）：M = Z·m(¹H) + N·m(n) − B/c² */
  function nbMassFromB(A, Z, B) { return Z * H1_U + (A - Z) * M_N_U - B / U_MEV; }
  /** 质量亏损 Δm（u）与 Q 值（MeV）：原子质量表版本 */
  function nbDeltaM(A, Z, mAtom) { return Z * H1_U + (A - Z) * M_N_U - mAtom; }

  /** 经典核反应的 Q 值（MeV）：由 AME2020 原子质量表算 Δm·c² */
  function nbReactionQ(masses) {
    var dm = 0, i;
    for (i = 0; i < masses.length; i++) dm += (i < masses.length / 2 ? 1 : -1) * masses[i];
    return dm * U_MEV;
  }

  function nbCompute(p) {
    var A = Math.round(clamp(num(p.A, 56), 1, 300));
    var Z = Math.round(clamp(num(p.Z, 26), 0, A));      // Z > A 夹到 A；Z = 0（中子滴）允许
    var name = opt(NB_OPTS, p.kind);
    var kind = NB_OPTS.indexOf(name);
    if (kind < 0) kind = 0;
    var N = A - Z;
    var B = nbB(A, Z), BA = B / A, terms = nbTerms(A, Z), zBest = nbZBest(A);

    // ---------- 主曲线：沿最稳定线的每核子结合能 B/A ----------
    var AG = [], BAarr = [], zv = [], a, i;
    for (a = NB_AMIN; a <= NB_AMAX; a++) {
      var za = nbZBest(a);
      AG.push(a); zv.push(za); BAarr.push(nbB(a, za) / a);
    }
    var iPeak = argmax(BAarr), aPeak = AG[iPeak], baPeak = BAarr[iPeak];

    // ---------- 当前核的质量亏损 / Q 值 ----------
    var nuc = nbNuclide(Z, A);
    var mExp = nuc ? nuc[3] : null;
    var mSemf = nbMassFromB(A, Z, B);
    var mUse = mExp == null ? mSemf : mExp;
    var dm = nbDeltaM(A, Z, mUse);                       // u
    var Q = dm * U_MEV;                                  // MeV = Δm·c²
    var meExcess = (mUse - A) * U_MEV;                   // 质量过剩 (M−A)c²，MeV
    var Bexp = mExp == null ? null : nbDeltaM(A, Z, mExp) * U_MEV;
    var BAexp = Bexp == null ? null : Bexp / A;

    // 同 A 的最稳定同质异位素 → 这条能级差就是 β 衰变/电子俘获可放出的能量
    var zBestN = nbZBest(A);
    var Qisobar = (nbMassFromB(A, Z, nbB(A, Z)) - nbMassFromB(A, zBestN, nbB(A, zBestN))) * U_MEV;

    // 经典反应（全部来自同一张 AME2020 表）：D+T→α+n、D+D→T+p、D+D→³He+n、p+⁷Li→α+α
    var mD = 2.014101777844, mT = 3.01604928132, mHe = 4.00260325413, mLi7 = 7.01600343426;
    var qDT = nbReactionQ([mD, mT, mHe, M_N_U]);
    var qDD1 = nbReactionQ([mD, mD, mT, H1_U]);
    var qDD2 = nbReactionQ([mD, mD, 3.01602932197, M_N_U]);
    var qLi = nbReactionQ([H1_U, mLi7, mHe, mHe]);
    var dmDT = qDT / U_MEV;

    // ---------- info ----------
    var info = [
      { k: "当前核素", v: (nuc ? nuc[2] : "Z=" + Z + ", A=" + A) + "（Z = " + Z + "，N = " + N + (nuc ? "，AME2020 表内" : "，表内无此核素 → 取半经验质量") + "）" },
      { k: "总结合能 B", v: fmt(B, 4) + " MeV（半经验公式）" },
      { k: "每核子结合能 B/A", v: fmt(BA, 4) + " MeV" },
      { k: "质量亏损 Δm", v: fmt(dm, 8) + " u（用" + (mExp == null ? "半经验质量" : "AME2020 原子质量") + "）" },
      { k: "Q 值 = Δm·c²（自由核子 → 该核，放能）", v: fmt(Q, 4) + " MeV" },
      { k: "质量过剩 (M−A)c²", v: fmt(meExcess, 3) + " MeV" },
      { k: "换算常数 1 u", v: fmt(U_MEV, 6) + " MeV（CODATA 2018）" },
      { k: "最稳定同质异位素（A = " + A + "）", v: "Z* = " + zBestN + "，Q_β = " + fmt(Qisobar, 4) + " MeV" },
      { k: "B/A 曲线峰值位置（argmax）", v: "A = " + aPeak + "（B/A = " + fmt(baPeak, 5) + " MeV）" }
    ];
    if (BAexp != null) {
      info.push({ k: "实验值对照 B/A", v: fmt(BAexp, 4) + " MeV（半经验 " + fmt(BA, 4) + "，差 " + fmt(BAexp - BA, 4) + " MeV）" });
    }
    info.push({ k: "⁵⁶Fe / ⁶²Ni 的实验 B/A（AME2020）", v: fmt(nbDeltaM(56, 26, 55.934935537) * U_MEV / 56, 4) + " / " + fmt(nbDeltaM(62, 28, 61.928344753) * U_MEV / 62, 4) + " MeV" });
    info.push({ k: "经典反应 Q：D+T→α+n", v: fmt(qDT, 4) + " MeV（实验 17.59）" });
    info.push({ k: "经典反应 Q：D+D→T+p / D+D→³He+n / p+⁷Li→α+α", v: fmt(qDD1, 3) + " / " + fmt(qDD2, 3) + " / " + fmt(qLi, 3) + " MeV" });

    // ---------- 五项分解（每核子，沿最稳定线）→ extra（kind 0） ----------
    var tv = [[], [], [], [], [], []], i2;
    for (i2 = 0; i2 < AG.length; i2++) {
      var tt = nbTerms(AG[i2], zv[i2]);
      for (var k2 = 0; k2 < 5; k2++) tv[k2].push(tt[k2] / AG[i2]);
      tv[5].push(BAarr[i2]);
    }
    var extra;
    if (kind === 1) {
      // 同 A 质量抛物线：光滑部分连续曲线 + 整数 Z 的含对能锯齿 + 当前核标记
      var zs = nbZStarSmooth(A), cx = [], cy = [], ix = [], iy = [], z, me;
      // 横轴范围至少覆盖 Z* ± 5，但一定把"当前核"包进来（Z 离最稳定线很远时也能看见）
      var zlo = clamp(Math.min(zs - 5, Z), 0, A), zhi = clamp(Math.max(zs + 5, Z), 0, A);
      for (z = zlo; z <= zhi + 1e-9; z += 0.25) {
        me = (nbMassFromB(A, z, nbBsmooth(A, z)) - A) * U_MEV;   // 光滑部分（不含对能）
        cx.push(z); cy.push(me);
      }
      for (z = Math.round(zlo); z <= Math.round(zhi); z++) {
        me = (nbMassFromB(A, z, nbB(A, z)) - A) * U_MEV;
        ix.push(z); iy.push(me);
      }
      var mk = [
        { x: Z, y: meExcess, label: mExp == null ? "当前核（半经验质量）" : "当前核（AME2020 实验质量）" },
        { x: zBestN, y: (nbMassFromB(A, zBestN, nbB(A, zBestN)) - A) * U_MEV, label: "最稳定 Z*=" + zBestN }
      ];
      extra = {
        lines: [
          { x: cx, y: cy, label: "质量抛物线（光滑部分）", color: "#5aa9ff" },
          { x: ix, y: iy, label: "整数 Z（含对能锯齿）", color: "#63d6a5", dash: "4 3" }
        ],
        markers: mk,
        xlabel: "电荷数 Z（A = " + A + " 固定）", ylabel: "质量过剩 (M−A)c² (MeV)",
        title: "同 A 质量抛物线：最低点就是最稳定同质异位素（Z* = " + zBestN + "）；" +
          "当前核素到最低点的能量差 Q_β = " + fmt(Qisobar, 4) + " MeV"
      };
    } else if (kind === 2) {
      // 五项绝对值随 A（沿最稳定线）：量级都在 10²~10³ MeV，最后相消成 ~10² MeV
      var av = [[], [], [], [], [], []], j;
      for (i2 = 0; i2 < AG.length; i2++) {
        var t2 = nbTerms(AG[i2], zv[i2]);
        for (j = 0; j < 5; j++) av[j].push(t2[j]);
        av[5].push(BAarr[i2] * AG[i2]);
      }
      extra = {
        lines: [
          { x: AG, y: av[0], label: "体积能 +a_V·A", color: "#5aa9ff" },
          { x: AG, y: av[1], label: "表面能 −a_S·A^(2/3)", color: "#ffb84d" },
          { x: AG, y: av[2], label: "库仑能 −a_C·Z(Z−1)/A^(1/3)", color: "#ff7b7b" },
          { x: AG, y: av[3], label: "对称能 −a_A·(A−2Z)²/A", color: "#c792ea" },
          { x: AG, y: av[4], label: "对能 ±11.18/√A", color: "#63d6a5", dash: "4 3" },
          { x: AG, y: av[5], label: "合计 B = B/A·A", color: "#e8d44d", dash: "6 4" }
        ],
        xlabel: "质量数 A", ylabel: "各项贡献 (MeV)",
        title: "五项的量级与相消：体积能 ~4×10³ MeV，减去表面/库仑/对称能后只剩 ~10² MeV"
      };
    } else {
      extra = {
        lines: [
          { x: AG, y: tv[0], label: "体积能/A = a_V", color: "#5aa9ff" },
          { x: AG, y: tv[1], label: "表面能/A", color: "#ffb84d" },
          { x: AG, y: tv[2], label: "库仑能/A", color: "#ff7b7b" },
          { x: AG, y: tv[3], label: "对称能/A", color: "#c792ea" },
          { x: AG, y: tv[4], label: "对能/A", color: "#63d6a5", dash: "4 3" },
          { x: AG, y: tv[5], label: "合计 B/A", color: "#e8d44d", dash: "6 4" }
        ],
        xlabel: "质量数 A（沿最稳定线取 Z）", ylabel: "每核子贡献 (MeV)",
        title: "B/A 为什么在 A ≈ 56 见顶：表面能随 A 减小、库仑能随 A 增大，两者交叉处即峰值"
      };
    }

    return {
      t: AG,
      series: { BA: BAarr },
      info: info,
      bars: [
        { label: "体积能 +a_V A", value: terms[0], unit: "MeV", color: "#5aa9ff" },
        { label: "表面能 −a_S A^(2/3)", value: terms[1], unit: "MeV", color: "#ffb84d" },
        { label: "库仑能 −a_C Z(Z−1)/A^(1/3)", value: terms[2], unit: "MeV", color: "#ff7b7b" },
        { label: "对称能 −a_A (A−2Z)²/A", value: terms[3], unit: "MeV", color: "#c792ea" },
        { label: "对能 δ", value: terms[4], unit: "MeV", color: "#63d6a5" },
        { label: "合计 B（每核子 " + fmt(BA, 3) + " MeV）", value: B, unit: "MeV", color: "#e8d44d" }
      ],
      extra: extra,
      metrics: {
        A: A, Z: Z, N: N, kind: kind, B: B, BA: BA, terms: terms, zv: zv, AG: AG,
        zBest: zBest, zBestN: zBestN, zStarSmooth: nbZStarSmooth(A), aPeak: aPeak, baPeak: baPeak,
        mExp: mExp, mSemf: mSemf, dm: dm, Q: Q, Bexp: Bexp, BAexp: BAexp, Qisobar: Qisobar,
        qDT: qDT, dmDT: dmDT, qDD1: qDD1, qDD2: qDD2, qLi: qLi,
        he4BA: nbDeltaM(4, 2, 4.00260325413) * U_MEV / 4
      }
    };
  }

  SIM.register("nuclear-binding", {
    title: "结合能与核反应：半经验公式与质量亏损",
    legend: "半经验质量公式把原子核当带电液滴：体积能（吸引）− 表面能 − 库仑能 − 对称能 + 对能。" +
      "曲线是沿最稳定线的每核子结合能 B/A，峰值在 A ≈ 56（铁镍区，聚变与裂变的分水岭）。" +
      "下图给出五项分解；读数里的 Q 值由质量亏损 Δm·c² 得到（1 u = 931.494 MeV）。",
    axes: { xlabel: "质量数 A（沿最稳定线）", ylabel: "每核子结合能 B/A (MeV)" },
    params: {
      kind: { label: "分析模式", type: "enum", options: NB_OPTS, def: 0 },
      A: { label: "质量数 A", unit: "", def: 56, min: 2, max: 250, step: 1 },
      Z: { label: "电荷数 Z", unit: "", def: 26, min: 1, max: 100, step: 1 }
    },
    plots: [
      { key: "BA", label: "半经验 B/A（沿最稳定线）", color: "#5aa9ff" }
    ],
    compute: nbCompute,
    tests: [
      // ① 半经验公式逐点核对（tol 1e-9）：把公式在 self-check 里**重新独立写一遍**，
      //    与曲线 series.BA[i]·A_i 比对；Z 取模型给出的最稳定线 metrics.zv[i]
      { name: "① B(A,Z) = a_V A − a_S A^(2/3) − a_C Z(Z−1)/A^(1/3) − a_A(A−2Z)²/A + δ 逐点核对",
        params: { A: 56, Z: 26 },
        measure: function (o) {
          var aV = 15.75, aS = 17.8, aC = 0.711, aA = 23.7, ap = 11.18;
          var m = 0, i, A, Z, N, d, b, oz, on, dd;
          for (i = 0; i < o.t.length; i++) {
            A = o.t[i]; Z = o.metrics.zv[i]; N = A - Z;
            oz = (Z % 2) !== 0; on = (N % 2) !== 0;
            dd = (oz && on) ? -ap / Math.sqrt(A) : ((!oz && !on) ? ap / Math.sqrt(A) : 0);
            b = aV * A - aS * Math.pow(A, 2 / 3) - aC * Z * (Z - 1) / Math.pow(A, 1 / 3)
              - aA * (A - 2 * Z) * (A - 2 * Z) / A + dd;
            d = Math.abs(o.series.BA[i] * A - b);
            if (d > m) m = d;
          }
          return m;
        }, expect: 0, tol: 1e-9 },
      // ② 曲线峰值位置（argmax）：B/A 极大在 A ≈ 56，容差 ±6（实测 A = 58）
      { name: "② B/A 曲线的极大值在 A ≈ 56 ± 6（曲线 argmax）",
        params: { A: 56, Z: 26 },
        measure: function (o) { return o.t[argmax(o.series.BA)]; },
        expect: 56, tol: 6 },
      // ②b 峰值高度：解析极值附近 B/A ≈ 8.86 MeV（实测 8.8648，实验值 ⁶²Ni 8.7946）
      { name: "②b 峰值处 B/A ≈ 8.86 MeV（容差 0.1）",
        params: { A: 56, Z: 26 },
        measure: function (o) { return o.series.BA[argmax(o.series.BA)]; },
        expect: 8.86, tol: 0.1 },
      // ③ ⁴He 的实验 B/A（AME2020 质量表）：
      //    Δm = 2m(¹H)+2m(n)−M(⁴He) = 0.0303766416 u ⇒ B = 28.2957 MeV ⇒ B/A = 7.0739 MeV
      { name: "③ ⁴He 的 B/A = 7.0739 MeV（来自 AME2020 质量表，容差 0.05）",
        params: { A: 4, Z: 2, kind: 1 },
        measure: function (o) { return o.metrics.he4BA; },
        expect: 7.0739, tol: 0.05 },
      // ④ 质量亏损换算：Q = Δm·c² ⇒ Q/Δm 必须等于 1 u 的能量 931.494102 MeV（容差 1e-6）
      { name: "④ 换算 1 u = 931.494102 MeV：Q_DT/Δm_DT（容差 1e-6）",
        params: { A: 56, Z: 26, kind: 1 },
        measure: function (o) { return o.metrics.qDT / o.metrics.dmDT; },
        expect: 931.494102, tol: 1e-6 },
      // ④b 同一个换算的物理核对：D + T → ⁴He + n 的 Q = 17.589 MeV（实验 17.59）
      { name: "④b D+T→⁴He+n 的 Q = 17.589 MeV（质量亏损 Δm = 0.0188829 u，容差 0.01）",
        params: { A: 56, Z: 26, kind: 1 },
        measure: function (o) { return o.metrics.qDT; },
        expect: 17.589, tol: 0.01 },
      // ⑤ 最稳定线：A = 56 使 B 最大的整数 Z 恰好是 26（⁵⁶Fe），即对能偏爱的偶 Z
      { name: "⑤ A = 56 时最稳定同质异位素 Z* = 26（⁵⁶Fe，整数枚举 argmax）",
        params: { A: 56, Z: 26, kind: 1 },
        measure: function (o) { return o.metrics.zBestN; },
        expect: 26, tol: 0 },
      // ⑤b 光滑抛物线的极小点解析式 Z*(A) = (A/2)/(1+κA^{2/3})，κ = a_C/(4a_A) = 0.0075
      { name: "⑤b 光滑抛物线极小点 Z*(56) = 28/(1+0.0075·56^(2/3))（解析式）",
        params: { A: 56, Z: 26, kind: 1 },
        measure: function (o) { return o.metrics.zStarSmooth; },
        expect: 28 / (1 + (0.711 / (4 * 23.7)) * Math.pow(56, 2 / 3)), tol: 1e-9 },
      // ⑥ 半经验公式的精度：⁵⁶Fe 的半经验 B/A 与实验值之差 < 0.1 MeV（实测 0.056）
      { name: "⑥ ⁵⁶Fe 半经验 vs 实验 B/A 之差 < 0.1 MeV",
        params: { A: 56, Z: 26, kind: 1 },
        measure: function (o) { return o.metrics.BAexp == null ? 9 : Math.abs(o.metrics.BAexp - o.metrics.BA); },
        expect: 0, tol: 0.1 },
      // ⑦ 边界：A = 2（最小）、A = 1（滑块外）、Z > A（夹到 Z = A）、Z = 0（中子滴）、
      //    A = 250 全部输出有限，info 字符串里没有 NaN/Infinity
      { name: "⑦ 边界：A = 1/2/250、Z > A、Z = 0 时全部有限、info 无 NaN/Infinity",
        params: { A: 2, Z: 1, kind: 2 },
        measure: function (o) {
          var cases = [{ A: 2, Z: 1 }, { A: 2, Z: 3 }, { A: 1, Z: 1 }, { A: 2, Z: 0 },
            { A: 250, Z: 100 }, { A: 250, Z: 250 }, { A: 300, Z: 0 }, { A: NaN, Z: NaN }];
          var bad = 0, k, i, oc, s;
          for (k = 0; k < cases.length; k++) {
            oc = nbCompute({ A: cases[k].A, Z: cases[k].Z, kind: k % 3 });
            for (i = 0; i < oc.t.length; i++) {
              if (!isFinite(oc.t[i]) || !isFinite(oc.series.BA[i])) bad++;
            }
            if (!isFinite(oc.metrics.B) || !isFinite(oc.metrics.BA) || !isFinite(oc.metrics.Q)) bad++;
            if (!isFinite(oc.metrics.qDT) || !isFinite(oc.metrics.Qisobar)) bad++;
            for (i = 0; i < oc.info.length; i++) {
              s = String(oc.info[i].v);
              if (s.indexOf("NaN") >= 0 || s.indexOf("Infinity") >= 0) bad++;
            }
            for (i = 0; i < oc.bars.length; i++) if (!isFinite(oc.bars[i].value)) bad++;
          }
          void o;
          return bad;
        }, expect: 0, tol: 0 }
    ]
  });

  /* ==========================================================================
     3. particle-kinematics —— 粒子碰撞运动学（自然单位 c = 1，能量单位 GeV）
     ==========================================================================
     四维动量 p = (E, p⃗)，不变质量平方 s = (E₁+E₂)² − |p⃗₁+p⃗₂|²（洛伦兹不变量）。
       · 固定靶（m₂ 静止，束流总能量 E）：s = m₁² + m₂² + 2m₂E          …（契约 ①）
       · 等能对撞（两束各 E、迎面）：p⃗₁ = −p⃗₂ ⇒ s = (2E)² = 4E²
         （质量相等时动量严格抵消，与 m 无关；m ≈ 0 时同样给 4E²）      …（契约 ②）
       · 产生总质量 M 的末态：E_th = [M² − (m₁+m₂)²]/(2m₂)                …（契约 ③）
       本模型取 M = 2(m₁+m₂)（"粒子–反粒子对产生"），于是
         E_th = 3(m₁+m₂)²/(2m₂)，等质量时 E_th = 6m（p+p → p+p+p+p̄ 的 6×0.938 = 5.628 GeV，
         正是 Bevatron 为找反质子而设计的能量）。
       · 不变质量：把同一事件换到速度 β 的参考系（洛伦兹变换）后重算，
         M² = (E₁′+E₂′)² − (p₁′+p₂′)² 逐点不变                          …（契约 ④）
         β = ±0.9 时 E₁′+E₂′ 与 |p₁′+p₂′| 都变成几十 GeV，二者之差仍是同一个 M²。
     ========================================================================== */
  var PK_OPTS = ["固定靶阈值", "对撞机", "不变质量"];
  var PK_MC = 1e-9;                 // 质量下限：m = 0（无质量粒子）时避免 1/m 发散
  var PK_MMAX = 1000;               // 质量上限（滑块 0.1~10，config 可越界）

  function pkP(E, m) { return Math.sqrt(Math.max(E * E - m * m, 0)); }   // |p⃗| = √(E²−m²)
  function pkGamma(E, m) { return E / Math.max(m, PK_MC); }              // γ = E/mc²
  function pkEth(m1, m2, M) { return (M * M - (m1 + m2) * (m1 + m2)) / (2 * m2); }
  function pkMfinal(m1, m2) { return 2 * (m1 + m2); }                    // 末态总质量 M

  function pkCompute(p) {
    var m1 = clamp(num(p.m1, 0.938), PK_MC, PK_MMAX);
    var m2 = clamp(num(p.m2, 0.938), PK_MC, PK_MMAX);
    var E = clamp(num(p.E, 10), PK_MC, 1e6);          // 束流总能量（含静能）
    var name = opt(PK_OPTS, p.kind);
    var kind = PK_OPTS.indexOf(name);
    if (kind < 0) kind = 0;

    var Mf = pkMfinal(m1, m2);
    var Eth = pkEth(m1, m2, Mf);
    var sFT = m1 * m1 + m2 * m2 + 2 * m2 * E;         // 固定靶 s
    var pBeam = pkP(E, m1), pTgt = pkP(E, m2);
    var sColl = 4 * E * E - (pBeam - pTgt) * (pBeam - pTgt);   // 等能迎面：p⃗ 相互抵消
    var gBeam = pkGamma(E, m1);
    var sNow = kind === 1 ? sColl : sFT;
    var EthColl = Mf / 2;                             // 对撞机达到同一 M 的每束能量（m≈0）

    var t = [], i, b, g, e1, p1, e2, p2, es, ps;
    var ftArr = [], collArr = [], mthArr = [], minvArr = [], esumArr = [], psizeArr = [], ser;
    if (kind === 2) {
      // 不变质量模式：横轴换成参考系速度 β，同一事件在 361 个参考系里重算
      var p1z = pkP(E, m1);
      for (i = 0; i < 361; i++) {
        b = -0.9 + 1.8 * i / 360;
        g = 1 / Math.sqrt(1 - b * b);
        e1 = g * (E - b * p1z); p1 = g * (p1z - b * E);      // 粒子 1（实验室系沿 +z 飞）
        e2 = g * m2; p2 = -g * b * m2;                       // 粒子 2（实验室系静止）
        es = e1 + e2; ps = p1 + p2;
        t.push(b);
        minvArr.push(Math.sqrt(Math.max(es * es - ps * ps, 0)));  // 不变质量 M（每个参考系都一样）
        esumArr.push(es);                                         // 总能量（随参考系剧烈变化）
        psizeArr.push(Math.abs(ps));                              // 总动量大小（同步变化）
      }
      ser = { Minv: minvArr, Esum: esumArr, psize: psizeArr };
    } else if (kind === 1) {
      // 对撞机模式：横轴束流能量 1 → 1000 GeV，同时画出固定靶的对比曲线
      for (i = 0; i < 400; i++) {
        var Ec = 1 + 999 * i / 399;
        var pa = pkP(Ec, m1), pb = pkP(Ec, m2);
        t.push(Ec);
        collArr.push(Math.sqrt(Math.max(4 * Ec * Ec - (pa - pb) * (pa - pb), 0)));
        ftArr.push(Math.sqrt(m1 * m1 + m2 * m2 + 2 * m2 * Ec));
        mthArr.push(Mf);
      }
      ser = { sqrtsColl: collArr, sqrts: ftArr, Mth: mthArr };
    } else {
      // 固定靶模式：横轴束流能量 0 → xmax（保证阈值交点尽量落在图上）
      var xmax = clamp(Math.max(2 * E, 1.4 * Math.min(Eth, 1e4), 5), 5, 1e4);
      for (i = 0; i < 400; i++) {
        var Ef = xmax * i / 399;
        t.push(Ef);
        ftArr.push(Math.sqrt(m1 * m1 + m2 * m2 + 2 * m2 * Ef));
        collArr.push(2 * Ef);
        mthArr.push(Mf);
      }
      ser = { sqrts: ftArr, sqrtsColl: collArr, Mth: mthArr };
    }

    var sqrtS = Math.sqrt(Math.max(sNow, 0));
    var concl;
    if (!isFinite(Eth) || Eth > 1e6) {
      concl = "阈值 → ∞：靶质量趋零（m₂ ≈ 0），固定靶无论多高能量都到不了（E_th = " + fmt(Eth, 4) + " GeV）";
    } else if (kind === 2) {
      concl = "不变质量与参考系无关：M = " + fmt(sqrtS, 5) + " GeV（β 从 −0.9 扫到 0.9 都不变）";
    } else if (E < Eth) {
      concl = "低于阈值：还差 " + fmt(Eth - E, 4) + " GeV（当前 √s = " + fmt(sqrtS, 4) + " GeV < M = " + fmt(Mf, 4) + " GeV）";
    } else {
      concl = "高于阈值：√s = " + fmt(sqrtS, 4) + " GeV ≥ M = " + fmt(Mf, 4) + " GeV，余量 " + fmt(sqrtS - Mf, 4) + " GeV";
    }

    var info = [
      { k: "质心能量 √s（当前模式）", v: fmt(sqrtS, 5) + " GeV" },
      { k: "产生总质量 M = 2(m₁+m₂) 的阈值", v: fmt(Eth, 5) + " GeV（对撞机只需每束 " + fmt(EthColl, 5) + " GeV）" },
      { k: "束流洛伦兹因子 γ = E/m₁", v: (m1 <= 1e-6 ? "∞（m₁ = 0 的无质量粒子）→ " : "") + fmt(gBeam, 5) },
      { k: "固定靶 √s = √(m₁²+m₂²+2m₂E)", v: fmt(Math.sqrt(Math.max(sFT, 0)), 5) + " GeV" },
      { k: "对撞机 √s = 2E（等能迎面）", v: fmt(Math.sqrt(Math.max(sColl, 0)), 5) + " GeV" },
      { k: "结论", v: concl }
    ];
    if (kind === 1) {
      info.push({ k: "固定靶要达到同样 √s 所需束流能量", v: fmt(fin((sColl - m1 * m1 - m2 * m2) / (2 * m2), 0), 5) + " GeV（是对撞机的 " + fmt(fin((sColl - m1 * m1 - m2 * m2) / (2 * m2 * E), 0), 4) + " 倍）" });
    }
    if (kind === 2) {
      var maxE = -Infinity, maxP = -Infinity;
      for (i = 0; i < esumArr.length; i++) { if (esumArr[i] > maxE) maxE = esumArr[i]; if (psizeArr[i] > maxP) maxP = psizeArr[i]; }
      info.push({ k: "E₁′+E₂′ 的扫描范围", v: fmt(esumArr[0], 4) + " → " + fmt(maxE, 4) + " GeV（随参考系变化）" });
      info.push({ k: "|p₁′+p₂′| 的扫描范围", v: fmt(psizeArr[0], 4) + " → " + fmt(maxP, 4) + " GeV（同步变化）" });
      info.push({ k: "不变质量 M² = (ΣE)² − (Σp)²", v: fmt(sNow, 6) + " GeV²（β = 0 与 β = ±0.9 处相同）" });
    }
    info.push({ k: "束流总能量 E / 动能 T = E − m₁", v: fmt(E, 5) + " / " + fmt(E - m1, 5) + " GeV" });

    return {
      t: t,
      series: ser,
      info: info,
      bars: kind === 2 ? [
        { label: "不变质量 M (GeV)", value: sqrtS, color: "#63d6a5" },
        { label: "最大 E₁′+E₂′ (GeV)", value: esumArr[esumArr.length - 1], color: "#5aa9ff" },
        { label: "最大 |p₁′+p₂′| (GeV)", value: psizeArr[psizeArr.length - 1], color: "#ffb84d" }
      ] : [
        { label: "√s (GeV)", value: sqrtS, color: "#5aa9ff" },
        { label: "阈值能量 E_th (GeV)", value: fin(Eth, 0), color: "#ff7b7b" },
        { label: "末态总质量 M (GeV)", value: Mf, color: "#ffb84d" },
        { label: "束流动能 T (GeV)", value: E - m1, color: "#63d6a5" }
      ],
      extra: null,
      metrics: {
        m1: m1, m2: m2, E: E, kind: kind, Mf: Mf, Eth: Eth, EthColl: EthColl,
        sFT: sFT, sColl: sColl, sqrtS: sqrtS, gamma: gBeam, pBeam: pBeam,
        Minv: minvArr, Esum: esumArr, psize: psizeArr, concl: concl
      }
    };
  }

  SIM.register("particle-kinematics", {
    title: "粒子碰撞运动学：√s、阈值与不变质量",
    legend: "自然单位 c = 1，能量用 GeV。固定靶 s = m₁²+m₂²+2m₂E（√s 只随 √E 长），" +
      "等能对撞 s = 4E²（√s 随 E 线性长）——这就是对撞机把能量利用率提高几个量级的算术。" +
      "本模型取末态总质量 M = 2(m₁+m₂)（粒子–反粒子对产生），阈值 E_th = [M²−(m₁+m₂)²]/(2m₂)。" +
      "不变质量模式把同一事件换到 361 个参考系里重算：E′、p′ 都在变，M² 却一动不动。",
    axes: { xlabel: "束流总能量 E (GeV)（不变质量模式的横轴是参考系速度 β）", ylabel: "√s 或不变质量 (GeV)" },
    params: {
      kind: { label: "分析模式", type: "enum", options: PK_OPTS, def: 0 },
      m1: { label: "束流粒子质量 m₁", unit: "GeV", def: 0.938, min: 0.1, max: 10, step: 0.001 },
      m2: { label: "靶粒子质量 m₂", unit: "GeV", def: 0.938, min: 0.1, max: 10, step: 0.001 },
      E: { label: "束流能量 E（含静能）", unit: "GeV", def: 10, min: 1, max: 1000, step: 1 }
    },
    plots: [
      { key: "sqrts", label: "固定靶 √s (GeV)", color: "#5aa9ff" },
      { key: "sqrtsColl", label: "对撞机 √s = 2E (GeV)", color: "#ffb84d", dash: "6 4" },
      { key: "Mth", label: "末态总质量 M = 2(m₁+m₂)", color: "#ff7b7b", dash: "3 3" },
      { key: "Minv", label: "不变质量 M（各参考系都相同）", color: "#63d6a5" },
      { key: "Esum", label: "E₁′+E₂′（随参考系变）", color: "#5aa9ff" },
      { key: "psize", label: "|p₁′+p₂′|（同步变化）", color: "#ffb84d" }
    ],
    compute: pkCompute,
    tests: [
      // ① 固定靶 s = m₁² + m₂² + 2m₂E（m₂ 静止）：由曲线 series.sqrts 平方后与解析式比对
      { name: "① 固定靶 s = m₁²+m₂²+2m₂E（由 √s 曲线平方现算，逐点容差 1e-9）",
        params: { kind: 0, m1: 0.938, m2: 0.938, E: 10 },
        measure: function (o, p) {
          var m = 0, i, d;
          for (i = 0; i < o.t.length; i++) {
            d = Math.abs(o.series.sqrts[i] * o.series.sqrts[i] - (p.m1 * p.m1 + p.m2 * p.m2 + 2 * p.m2 * o.t[i]));
            if (d > m) m = d;
          }
          return m;
        }, expect: 0, tol: 1e-9 },
      // ② 等能对撞（m ≈ 0）s = 4E²：两束动量严格抵消 ⇒ s = (2E)²，与 m 无关（等质量时）
      { name: "② 等能对撞（m ≈ 0）s = 4E²（比值 = 1）",
        params: { kind: 1, m1: 0.001, m2: 0.001, E: 10 },
        measure: function (o, p) { return o.metrics.sColl / (4 * p.E * p.E); },
        expect: 1, tol: 1e-12 },
      // ②b 等质量（质子）时也严格成立：s = 4E²（p₁ = p₂ ⇒ 动量抵消）
      { name: "②b 等质量质子对撞 s = 4E²（E = 100 GeV 时 √s = 200 GeV）",
        params: { kind: 1, m1: 0.938, m2: 0.938, E: 100 },
        measure: function (o, p) { return o.metrics.sColl / (4 * p.E * p.E); },
        expect: 1, tol: 1e-12 },
      // ③ 阈值 E_th = [M²−(m₁+m₂)²]/(2m₂)，M = 2(m₁+m₂) ⇒ E_th = 3(m₁+m₂)²/(2m₂)。
      //    m₁ = m₂ = 1 时 E_th = 3·4/2 = 6 GeV（精确）
      { name: "③ 阈值 E_th = [M²−(m₁+m₂)²]/(2m₂) = 6 GeV（m₁ = m₂ = 1，M = 4）",
        params: { kind: 0, m1: 1, m2: 1, E: 10 },
        measure: function (o) { return o.metrics.Eth; },
        expect: 6, tol: 1e-12 },
      // ③b 不等质量：m₁ = 2、m₂ = 0.5 ⇒ M = 5，E_th = (25−6.25)/1 = 18.75 GeV（精确）
      { name: "③b 不等质量阈值：m₁ = 2、m₂ = 0.5 ⇒ E_th = 18.75 GeV",
        params: { kind: 0, m1: 2, m2: 0.5, E: 10 },
        measure: function (o) { return o.metrics.Eth; },
        expect: 18.75, tol: 1e-12 },
      // ③c 等质量时 E_th = 6m：质子 m = 0.938 ⇒ 5.628 GeV（p+p → p+p+p+p̄ 的经典阈值）
      { name: "③c 质子对产生阈值 E_th = 6m_p = 5.628 GeV（Bevatron 反质子阈值）",
        params: { kind: 0, m1: 0.938, m2: 0.938, E: 10 },
        measure: function (o) { return o.metrics.Eth; },
        expect: 5.628, tol: 1e-3 },
      // ④ 不变质量是洛伦兹不变量：把 β = −0.9…0.9 的每个参考系里算出的 M² 与**实验室系**
      //    的解析 s = m₁²+m₂²+2m₂E 比对（两个以上参考系，逐点容差 1e-9）
      { name: "④ 不变质量与参考系无关：M²(β) = m₁²+m₂²+2m₂E（β = ±0.9 逐点比对）",
        params: { kind: 2, m1: 0.938, m2: 0.938, E: 10 },
        measure: function (o, p) {
          var s0 = p.m1 * p.m1 + p.m2 * p.m2 + 2 * p.m2 * p.E, m = 0, i, d;
          for (i = 0; i < o.t.length; i++) {
            d = Math.abs(o.series.Minv[i] * o.series.Minv[i] - s0);
            if (d > m) m = d;
          }
          return m;
        }, expect: 0, tol: 1e-9 },
      // ⑤ 不变量检验不能是废话：同一批参考系里 E₁′+E₂′ 与 |p₁′+p₂′| 必须真的在变
      { name: "⑤ 参考系确实换了：E₁′+E₂′ 与 |p₁′+p₂′| 的变化幅度 > 10 GeV",
        params: { kind: 2, m1: 0.938, m2: 0.938, E: 10 },
        measure: function (o) {
          var i, minE = Infinity, maxE = -Infinity, minP = Infinity, maxP = -Infinity;
          for (i = 0; i < o.series.Esum.length; i++) {
            if (o.series.Esum[i] < minE) minE = o.series.Esum[i];
            if (o.series.Esum[i] > maxE) maxE = o.series.Esum[i];
            if (o.series.psize[i] < minP) minP = o.series.psize[i];
            if (o.series.psize[i] > maxP) maxP = o.series.psize[i];
          }
          return (maxE - minE > 10 && maxP - minP > 10) ? 1 : 0;
        }, expect: 1, tol: 0 },
      // ⑥ 边界：m = 0（无质量粒子）、m₂ → 0（阈值发散）、E 很小（√s 低于阈值）时
      //    全部输出有限，并且给出可读结论（不是 NaN）
      { name: "⑥ 边界：m = 0、m₂→0、E 低于阈值时全部有限且结论可读",
        params: { kind: 0, m1: 0, m2: 0, E: 1 },
        measure: function (o) {
          var cases = [{ kind: 0, m1: 0, m2: 0, E: 1 }, { kind: 0, m1: 0.938, m2: 0, E: 1 },
            { kind: 1, m1: 0, m2: 10, E: 1 }, { kind: 2, m1: 0, m2: 0, E: 1 },
            { kind: 0, m1: 10, m2: 10, E: 1 }, { kind: 0, m1: NaN, m2: NaN, E: NaN }];
          var bad = 0, k, i, oc, s, key, arr;
          for (k = 0; k < cases.length; k++) {
            oc = pkCompute(cases[k]);
            for (i = 0; i < oc.t.length; i++) if (!isFinite(oc.t[i])) bad++;
            for (key in oc.series) {                    // 逐条曲线检查有限性
              if (!oc.series.hasOwnProperty(key)) continue;
              arr = oc.series[key];
              for (i = 0; i < arr.length; i++) if (!isFinite(arr[i])) bad++;
            }
            if (!isFinite(oc.metrics.Eth) || !isFinite(oc.metrics.sColl) || !isFinite(oc.metrics.gamma)) bad++;
            for (i = 0; i < oc.bars.length; i++) if (!isFinite(oc.bars[i].value)) bad++;
            for (i = 0; i < oc.info.length; i++) {
              s = String(oc.info[i].v);
              if (s.indexOf("NaN") >= 0 || s.indexOf("Infinity") >= 0) bad++;
            }
          }
          void o;
          return bad;
        }, expect: 0, tol: 0 },
      // ⑥b E = 1 GeV 的质子打静止质子：√s = 1.907 GeV < M = 3.752 GeV ⇒ 结论必须是「低于阈值」
      { name: "⑥b 低能（E = 1 GeV）时给出「低于阈值」的可读结论（√s = 1.907 < M = 3.752 GeV）",
        params: { kind: 0, m1: 0.938, m2: 0.938, E: 1 },
        measure: function (o) { return o.metrics.concl.indexOf("低于阈值") >= 0 ? 1 : 0; },
        expect: 1, tol: 0 }
    ]
  });
})(typeof window !== "undefined" ? window : globalThis);
