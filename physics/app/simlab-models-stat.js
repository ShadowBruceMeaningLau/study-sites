/* ==========================================================================
   simlab-models-stat.js —— 热力学与统计物理 仿真模型（W3 契约 §11.3，4 个）

     · statdist          三种统计分布（M–B / B–E / F–D）的平均占据数 n(ε) 对比
     · ising             二维伊辛模型蒙特卡洛：磁化强度演化 + 自旋位形 + 相变温度
     · canonical         正则分布（二能级系统）：配分函数、内能、Schottky 热容异常
     · phase-transition  相变与临界现象：平均场 vs 二维伊辛（Onsager / 唯象对照）

   ★ 约束（与 simlab.js 顶部一致）：
     · 加载时**只调用 SIM.register**，绝不触碰 DOM —— tools/verify-simlab.mjs 在 Node 里
       用 window 桩直接跑 compute() 与 tests 做物理不变量自检；
     · **不调用 Math.random**（全文搜不到 "random" 调用）：ising 的随机数全部来自文件内
       自带的 mulberry32（带种子），同一个 seed 的轨迹**逐位可重复**；
     · 纯 ES5：var / 无箭头函数 / 无模板字符串 / 无 import-export；
     · 边界安全：任何参数取值都不抛异常、不出 NaN/Infinity —— 发散量（B–E 在 ε→μ、
       磁化率在 Tc、比热对数发散）一律**先截断再进曲线**，精确值放在 metrics/读数里。

   单位约定（为什么这个文件几乎不需要物理常量）：
     · statdist：能量以 ε₀ 为单位、温度以 ε₀/k_B 为单位 ⇒ 公式里只出现 x=(ε−μ)/kT；
     · canonical：能量以 ε 为单位、温度以 ε/k_B 为单位 ⇒ 只出现 x=ε/kT；
     · 所以解析式里没有 k_B。canonical 的读数用 app/constants.js 的 CODATA 值把温度
       换算成 K 作"物理标尺"对照（K_B、EV_J 两个常量就是为此而取，见下）。
   ========================================================================== */
(function (global) {
  "use strict";
  var SIM = global.SIM;
  if (!SIM) return;   // 在 Node 里若未先加载 simlab.js，安静退出

  var lin = SIM.linspace, fmt = SIM.fmt, opt = SIM.opt;

  /* ------------------------------------------------------------- 物理常量 */
  // 数值照抄 app/constants.js（CODATA 2018 / 2019 年 SI 定义值），不凭记忆另写：
  //   "玻尔兹曼常量 k_B = 1.380 649 × 10^-23 J/K（精确）"
  //   "电子伏 eV = 1.602 176 634 × 10^-19 J（精确）"
  // 模型文件在 Node 里被单独加载，不能假设 window.PHYSICS_CONSTANTS 已存在，故直接写在文件里。
  var K_B = 1.380649e-23;       // J/K
  var EV_J = 1.602176634e-19;   // J

  /* --------------------------------------------------------------- 小工具 */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  /** 参数安全取值：课程 config 不受滑块范围限制，NaN/越界/非数字都夹到合法区间 */
  function num(v, defv) { var x = Number(v); return isFinite(x) ? x : defv; }
  /** 有限性兜底：把 ±Infinity/NaN 换成 fallback（"不出 NaN/Infinity"这条约束集中在这里） */
  function fin(v, fallback) { return isFinite(v) ? v : fallback; }
  /** 对称截断：|v| > cap 时截到 ±cap，非有限值截到 +cap（绘图用，精确值另存 metrics） */
  function clip(v, cap) { return !isFinite(v) ? cap : (v > cap ? cap : (v < -cap ? -cap : v)); }
  /** 有序去重合并（构造"基准网格 + 精确锚点"的非均匀网格） */
  function mergeSorted(base, extra) {
    var all = base.concat(extra).sort(function (a, b) { return a - b; });
    var out = [], i;
    for (i = 0; i < all.length; i++) {
      if (!isFinite(all[i])) continue;
      if (!out.length || Math.abs(all[i] - out[out.length - 1]) > 1e-12 * Math.max(1, Math.abs(all[i]))) out.push(all[i]);
    }
    return out;
  }
  /** 数组中离 target 最近的元素下标（曲线读数与自检定位网格点用） */
  function nearestIndex(xs, target) {
    var best = 0, bd = Infinity, i, d;
    for (i = 0; i < xs.length; i++) {
      d = Math.abs(xs[i] - target);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  /** 数组最大值下标 */
  function argmax(ys) {
    var m = 0, i;
    for (i = 1; i < ys.length; i++) if (ys[i] > ys[m]) m = i;
    return m;
  }
  /**
   * 抛物顶点插值：过网格极值点 i 及其左右邻点作抛物线，取顶点横坐标。
   * 采样 600~800 点时素网格的峰位精度只有 O(h)（~1e-3），插值后约 O(h³)（~1e-7），
   * 才够得上"峰位 = 解析值 ± 1e-3"这类自检。
   */
  function peakX(xs, ys, i) {
    if (i <= 0 || i >= ys.length - 1) return xs[i];
    var y0 = ys[i - 1], y1 = ys[i], y2 = ys[i + 1];
    var den = y0 - 2 * y1 + y2;
    if (den === 0 || !isFinite(den)) return xs[i];
    var h = xs[i + 1] - xs[i];
    var x = xs[i] + 0.5 * h * (y0 - y2) / den;
    if (x < xs[i - 1]) return xs[i - 1];
    if (x > xs[i + 1]) return xs[i + 1];
    return x;
  }
  /** 同上，返回抛物线顶点的纵坐标（峰高的精修值） */
  function peakY(xs, ys, i) {
    if (i <= 0 || i >= ys.length - 1) return ys[i];
    var y0 = ys[i - 1], y1 = ys[i], y2 = ys[i + 1];
    var den = y0 - 2 * y1 + y2;
    if (den === 0 || !isFinite(den)) return ys[i];
    return y1 - (y0 - y2) * (y0 - y2) / (8 * den);
  }
  /** 序列尾段（最后 frac 比例）的 |y| 平均 —— ising 自检用它做平衡态平均 */
  function meanAbsTail(ys, frac) {
    if (!ys.length) return 0;
    var from = Math.floor(ys.length * (1 - (frac == null ? 0.25 : frac)));
    if (from >= ys.length) from = ys.length - 1;
    if (from < 0) from = 0;
    var s = 0, n = 0, i;
    for (i = from; i < ys.length; i++) { s += Math.abs(ys[i]); n++; }
    return n ? s / n : 0;
  }
  /** 两个等长序列的最大逐点偏差（"同 seed 可重复"自检） */
  function maxDiff(a, b) {
    if (a.length !== b.length) return Infinity;
    var m = 0, i, d;
    for (i = 0; i < a.length; i++) {
      d = Math.abs(a[i] - b[i]);
      if (!isFinite(d)) return Infinity;
      if (d > m) m = d;
    }
    return m;
  }

  /* ==========================================================================
     1. statdist —— 三种统计分布的平均占据数
     ========================================================================== */
  /**
   * 令 x = (ε−μ)/kT（以 ε₀ 为能量单位，ε₀ 就是滑块上 T、μ 的度量单位）：
   *   麦克斯韦–玻尔兹曼（经典、无简并修正）： n_MB = e^{−x}
   *   费米–狄拉克（分母 +1）：               n_FD = 1/(e^{x} + 1)
   *   玻色–爱因斯坦（分母 −1）：             n_BE = 1/(e^{x} − 1)
   * 三种统计统一写成 n = 1/(e^{x} + δ)，δ = 0 / +1 / −1（δ 就是"量子简并"的标记），
   * 于是有恒等式  n_BE,F D = n_MB/(1 ∓ n_MB)：
   *   · 只有当占据数 n_MB ≪ 1（稀薄 / 高温 / 高能尾巴）时 ∓n_MB 才可忽略，三者重合
   *     ⇒ 这就是"经典极限"的定量判据；
   *   · x = 8 时 |n_FD − n_MB|/n_MB = e^{−8}/(1+e^{−8}) = 3.354e-4 < 1e-3（自检 ⑤）。
   * 关键解析值（自检用）：
   *   n_FD(ε=μ) = 1/(1+1) = 1/2（精确）；n_MB(ε−μ=kT) = e^{−1}；
   *   x→0⁺ 时 n_BE ≈ 1/x → +∞（玻色–爱因斯坦凝聚的苗头），x = 0.001 时 999.5000833；
   *   x ≤ −1.5 时 1 − n_FD ≤ e^{x} ≤ e^{−1.5}，x ≥ 1.5 时 n_FD ≤ e^{−x} ≤ e^{−1.5}（T→0 变阶跃）。
   */
  var SD_OPTS = ["麦克斯韦–玻尔兹曼", "玻色–爱因斯坦", "费米–狄拉克"];
  var SD_HALF = 3;        // 横轴窗口 ε/ε₀ ∈ [μ−3, μ+3]（μ 的取值范围就在 ±3 内，够看整条台阶）
  var SD_N = 601;         // 基准网格点数（间距 0.01 ε₀）
  var SD_CAP = 25;        // 绘图上限：|n| > 25 一律截断（M–B 低温端指数爆炸、B–E 在 ε→μ 发散）
  // ε−μ 的精细锚点：B–E 在 ε→μ 处发散，没有足够近的点就看不出趋势；0 点由基准网格强制给出。
  var SD_ANCHOR = [0.001, 0.002, 0.003, 0.005];

  function sdGrid(mu) {
    var g = lin(mu - SD_HALF, mu + SD_HALF, SD_N);
    g[(SD_N - 1) / 2] = mu;                     // 强制严格含 ε = μ（n_FD = 1/2 的检验点）
    var an = [], i;
    for (i = 0; i < SD_ANCHOR.length; i++) { an.push(mu - SD_ANCHOR[i]); an.push(mu + SD_ANCHOR[i]); }
    return mergeSorted(g, an);
  }
  function sdMB(x) { return Math.exp(-x); }                       // e^{−x}
  function sdFD(x) { var e = Math.exp(x); return 1 / (e + 1); }   // 1/(e^x+1)；x≤700 内不会溢出
  function sdBE(x) {                                              // 1/(e^x−1)，x = 0 处数学上发散
    if (x === 0) return Infinity;
    var d = Math.exp(x) - 1;
    return d === 0 ? Infinity : 1 / d;
  }

  SIM.register("statdist", {
    title: "三种统计分布的平均占据数",
    legend: "横轴 ε/ε₀（窗口取 μ±3ε₀），纵轴平均占据数。费米子排排坐（n≤1、ε=μ 处恰好 1/2），" +
      "玻色子偏爱挤在同一态（ε→μ 时发散），经典 M–B 则是指数尾巴。只有占据数 ≪ 1 时三条曲线才重合。",
    axes: { xlabel: "ε/ε₀", ylabel: "平均占据数 n(ε)（图中 |n| > 25 已截断）" },
    params: {
      kind: { label: "当前统计量 n", type: "enum", options: SD_OPTS, def: 2 },
      T: { label: "温度 kT/ε₀", unit: "", def: 1, min: 0.1, max: 10, step: 0.05 },
      mu: { label: "化学势 μ/ε₀", unit: "", def: 0, min: -3, max: 3, step: 0.05 }
    },
    plots: [
      { key: "n", label: "当前统计 n", color: "#e8d44d", dash: "6 4" },
      { key: "nMB", label: "M–B（经典）", color: "#5aa9ff" },
      { key: "nFD", label: "F–D（费米）", color: "#63d6a5" },
      { key: "nBE", label: "B–E（玻色）", color: "#ff7b7b" }
    ],
    compute: function (p) {
      var T = clamp(num(p.T, 1), 0.05, 20);          // kT/ε₀，只做单侧放大保护
      var mu = clamp(num(p.mu, 0), -5, 5);           // μ/ε₀
      var name = opt(SD_OPTS, p.kind);
      var ki = SD_OPTS.indexOf(name);
      var xs = sdGrid(mu), eps = [], nMB = [], nFD = [], nBE = [], i, x, v;
      var mbRaw = 0, beRaw = 0, beRawPlus = 0;       // 未截断的最大值（读数与自检用）
      for (i = 0; i < xs.length; i++) {
        x = (xs[i] - mu) / T;
        var a = sdMB(x), b = sdFD(x), c = sdBE(x);
        eps.push(xs[i]);
        nMB.push(clip(a, SD_CAP));
        nFD.push(clip(b, SD_CAP));
        nBE.push(clip(c, SD_CAP));
        if (isFinite(a) && a > mbRaw) mbRaw = a;
        if (isFinite(c) && Math.abs(c) > beRaw) beRaw = Math.abs(c);
        // ε→μ⁺ 的取值单独记：n_BE 在 μ 两侧并不对称（|n(−δ)| = |n(+δ)| + 1），
        // 契约 ④ 说的是 μ 的**正侧**（玻色子往低能态堆积）
        if (x > 0 && isFinite(c) && c > beRawPlus) beRawPlus = c;
      }
      var sel = (ki === 0 ? nMB : (ki === 1 ? nBE : nFD));
      // 读数取三个有代表性的点：ε=μ（x=0）、ε=μ+ε₀（x=1/T）、ε=μ−ε₀（x=−1/T）
      var xUp = 1 / T, xDn = -1 / T;
      var mb0 = sdMB(0), fd0 = sdFD(0), be0 = sdBE(0);
      var mbU = sdMB(xUp), fdU = sdFD(xUp), beU = sdBE(xUp);
      var mbD = sdMB(xDn), fdD = sdFD(xDn), beD = sdBE(xDn);
      // 经典极限探针：x = 8（kT=10ε₀ 时对应 ε−μ = 80ε₀）处的相对偏差 e^{−8}/(1+e^{−8})
      var xt = 8, tailRel = Math.abs(sdFD(xt) - sdMB(xt)) / sdMB(xt);
      var pick = function (arr) { return arr === nMB ? mbU : (arr === nBE ? beU : fdU); };
      return {
        t: eps,
        series: { n: sel, nMB: nMB, nFD: nFD, nBE: nBE },
        info: [
          { k: "当前统计量", v: name },
          { k: "温度 kT/ε₀", v: fmt(T, 4) },
          { k: "化学势 μ/ε₀", v: fmt(mu, 4) },
          { k: "逸度 e^(μ/kT)", v: fmt(fin(Math.exp(clamp(mu / T, -700, 700)), 0), 4) },
          { k: "ε = μ 处：M–B", v: fmt(mb0, 6) + "（经典）" },
          { k: "ε = μ 处：F–D", v: fmt(fd0, 6) + "（精确 1/2）" },
          { k: "ε = μ 处：B–E", v: "发散（±∞）→ 图中截断到 " + fmt(SD_CAP, 2) + "；ε−μ = 0.001ε₀ 时为 " + fmt(beRawPlus, 6) },
          { k: "ε = μ+ε₀ 处：n_MB / n_FD / n_BE", v: fmt(mbU, 5) + " / " + fmt(fdU, 5) + " / " + fmt(beU, 5) },
          { k: "ε = μ−ε₀ 处：n_MB / n_FD / n_BE", v: fmt(mbD, 5) + " / " + fmt(fdD, 5) + " / " + fmt(beD, 5) },
          { k: "当前统计量在 ε=μ+ε₀ 处", v: fmt(pick(sel), 5) },
          { k: "经典极限判据（ε−μ = 8kT）", v: "|n_FD−n_MB|/n_MB = " + fmt(tailRel, 4) + " < 1e-3" },
          { k: "M–B 在窗口内的最大值（未截断）", v: fmt(mbRaw, 4) + "（截断上限 " + fmt(SD_CAP, 2) + "）" }
        ],
        bars: [
          { label: "n_MB(ε=μ+ε₀)", value: mbU, color: "#5aa9ff" },
          { label: "n_FD(ε=μ+ε₀)", value: fdU, color: "#63d6a5" },
          { label: "n_BE(ε=μ+ε₀)", value: beU, color: "#ff7b7b" }
        ],
        extra: {
          lines: [
            { x: eps, y: (function () { var o = [], j; for (j = 0; j < nMB.length; j++) o.push(clip((nFD[j] - nMB[j]) / nMB[j], 5)); return o; })(), label: "(n_FD−n_MB)/n_MB", color: "#63d6a5" },
            { x: eps, y: (function () { var o = [], j; for (j = 0; j < nMB.length; j++) o.push(clip((nBE[j] - nMB[j]) / nMB[j], 5)); return o; })(), label: "(n_BE−n_MB)/n_MB", color: "#ff7b7b", dash: "5 4" }
          ],
          xlabel: "ε/ε₀", ylabel: "相对 M–B 的修正（|·| > 5 已截断）",
          title: "量子统计对经典统计的相对修正：ε−μ ≫ kT 时两者都趋于 0（经典极限）"
        },
        metrics: {
          xs: xs, T: T, mu: mu, kind: ki, name: name,
          nMB: nMB, nFD: nFD, nBE: nBE, nSel: sel,
          mbRawMax: mbRaw, beRawMax: beRaw, beRawPlus: beRawPlus, tailRel: tailRel
        }
      };
    },
    tests: [
      // ① 逐点比对：n_MB(x) 必须等于解析式 e^{−x}（默认参数下 M–B 最大值 e³ = 20.09 < 截断上限 25，
      //    所以整条曲线都是精确值）。x 由 metrics 里夹紧后的 T、μ 反推，误差只来自浮点舍入。
      { name: "M–B 逐点 = exp(−(ε−μ)/kT)（全程精确，容差 1e-12）",
        measure: function (o) {
          var m = 0, i, x, d;
          for (i = 0; i < o.t.length; i++) {
            x = (o.t[i] - o.metrics.mu) / o.metrics.T;
            d = Math.abs(o.series.nMB[i] - Math.exp(-x));
            if (d > m) m = d;
          }
          return m;
        }, expect: 0, tol: 1e-12 },
      // ①b 独立锚点：ε−μ = kT 时 n_MB = e^{−1} = 0.36787944117144233
      { name: "M–B 在 ε−μ = kT 处 = e⁻¹ = 0.36787944117144233",
        measure: function (o) {
          return o.series.nMB[nearestIndex(o.t, o.metrics.mu + o.metrics.T)];
        }, expect: 0.36787944117144233, tol: 1e-12 },
      // ② 费米子：ε = μ 处占据数恰好 1/2（解析：1/(e⁰+1) = 1/2），网格强制含该点
      { name: "F–D：n(ε=μ) = 1/2（精确）",
        measure: function (o) { return o.series.nFD[nearestIndex(o.t, o.metrics.mu)]; },
        expect: 0.5, tol: 1e-15 },
      // ③ T→0 变阶跃：kT = 0.1ε₀ 时，ε−μ ≤ −1.5ε₀（x ≤ −15）处 1 − n_FD ≤ e^{−15}、
      //    ε−μ ≥ +1.5ε₀（x ≥ +15）处 n_FD ≤ e^{−15}，解析上界 e^{−15} = 3.06e-7 < 1e-6
      { name: "T→0（kT=0.1ε₀）时 F–D 变阶跃：|ε−μ| ≥ 1.5ε₀ 处 |n−1| 与 n 都不超过 e^{−15} = 3.06e-7",
        params: { kind: 2, T: 0.1, mu: 0 },
        measure: function (o) {
          var m = 0, i, x, d, v;
          for (i = 0; i < o.t.length; i++) {
            x = (o.t[i] - o.metrics.mu) / o.metrics.T;
            v = o.series.nFD[i];
            if (x <= -15) { d = Math.abs(v - 1); if (d > m) m = d; }
            else if (x >= 15) { if (v > m) m = v; }
          }
          return m;
        }, expect: 0, tol: 1e-6 },
      // ④ B–E 在 ε→μ⁺ 发散：最近的锚点 ε−μ = 0.001ε₀（kT = ε₀）给 1/(e^{0.001}−1) = 999.500083333289 > 100。
      //    曲线里这个值被截断到 25，所以自检读 metrics 里的**未截断**值（取 μ 的正侧，见 beRawPlus）。
      { name: "B–E：ε→μ⁺ 时发散（ε−μ = 0.001ε₀ → 1/(e^0.001−1) = 999.5 > 100）",
        params: { kind: 1, T: 1, mu: 0 },
        measure: function (o) { return o.metrics.beRawPlus; },
        expect: 999.500083333289, tol: 1e-6 },
      // ④b 截断确实生效：四条曲线的 |n| 都不超过上限 25（ε=μ 处 B–E 被截到 +25）
      { name: "曲线处处有限且 |n| ≤ 25（B–E 发散已在绘图时截断，不出 Infinity）",
        measure: function (o) {
          var keys = ["n", "nMB", "nFD", "nBE"], m = 0, i, j, v;
          for (j = 0; j < keys.length; j++) {
            for (i = 0; i < o.series[keys[j]].length; i++) {
              v = o.series[keys[j]][i];
              if (!isFinite(v)) return NaN;
              if (Math.abs(v) > m) m = Math.abs(v);
            }
          }
          return m;
        }, expect: 25, tol: 0 },
      // ⑤ 高温 / 稀薄极限：x = (ε−μ)/kT = 8 处 |n_FD − n_MB|/n_MB = e^{−8}/(1+e^{−8}) = 3.354e-4 < 1e-3
      //    （kT = 10ε₀ 时这个 x 对应 ε−μ = 80ε₀，已远超绘图窗口，故用探针读数）
      { name: "经典极限（x = 8，kT=10ε₀ 的稀薄尾巴）|n_FD−n_MB|/n_MB = e⁻⁸/(1+e⁻⁸) < 1e-3",
        params: { kind: 2, T: 10, mu: 0 },
        measure: function (o) { return o.metrics.tailRel; },
        expect: 0.000335350130466478, tol: 1e-9 },
      // ⑥ 边界安全：极端参数（μ 顶到 +3、T 取滑块下限 0.1）全程有限，无 NaN/Infinity
      { name: "边界：μ=3、kT=0.1ε₀ 时四条曲线全部有限",
        params: { kind: 0, T: 0.1, mu: 3 },
        measure: function (o) {
          var keys = ["n", "nMB", "nFD", "nBE"], bad = 0, i, j;
          for (j = 0; j < keys.length; j++) {
            for (i = 0; i < o.series[keys[j]].length; i++) if (!isFinite(o.series[keys[j]][i])) bad++;
          }
          return bad;
        }, expect: 0, tol: 0 }
    ]
  });

  /* ==========================================================================
     2. ising —— 二维伊辛模型蒙特卡洛（Metropolis）
     ========================================================================== */
  /**
   * 哈密顿量 H = −J Σ_{⟨ij⟩} s_i s_j（正方格子、最近邻、周期边界、无外场；取 J = 1、k_B = 1）。
   * 单自旋翻转的能量差 ΔE = 2 J s_i h，h = 四个近邻自旋之和 ∈ {−4,−2,0,2,4}
   *   ⇒ ΔE 只有 0、±4J、±8J 五种取值，接受概率 e^{−ΔE/kT} 可以**预先查表**（Metropolis）。
   * 一次"步"（sweep）= 扫过全部 L² 个格点；磁化强度取每自旋平均 m = (1/L²)Σ s_i ∈ [−1,1]。
   * 有限尺寸下 m 的分布在 Tc 以下是双峰（±m），所以读数用 |m|（避免整块翻转造成的正负跳变）。
   *
   * 理论临界温度（Onsager 1944，无限大正方格子）：k_BTc/J = 2/ln(1+√2) = 2.269 185 314 213 022
   *   —— 只用于显示与对照，**不拿去拟合数据**。
   * 精确内能/自旋（Onsager，本文件不实现，仅作注释对照）：
   *   u(T) = −J coth(2βJ)[1 + (2/π)(2tanh²(2βJ) − 1)K(k)]，k = 2 sinh(2βJ)/cosh²(2βJ)
   *   T = 1 时 u = −1.997 160 2（基态 −2J），T = Tc 时 u = −√2 J。
   * 精确自发磁化（β<βc）：m = [1 − sinh⁻⁴(2βJ)]^{1/8}，T = 1 时 m = 0.999 275 8。
   */
  var ISING_TC = 2 / Math.log(1 + Math.SQRT2);

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

  /** 一次完整的伊辛模拟（compute 与自检共用同一条代码路径，保证测试跑的是真代码） */
  function isingCompute(p) {
    var T = clamp(num(p.T, 2.2), 0.05, 20);            // 温度（J/k_B 单位）
    var L = Math.round(clamp(num(p.L, 16), 4, 40));    // 线度（契约 8~32，放宽到 4~40）
    var steps = Math.round(clamp(num(p.steps, 2000), 20, 20000));
    var seed = Math.round(clamp(num(p.seed, 1), 1, 999999));
    var n = L * L;
    // 运行预算（安全网）：课程 config 不受滑块范围限制，这里封顶约 4×10⁷ 次翻转，
    // 保证任何参数组合都能算完；契约范围（L ≤ 32、steps ≤ 20000 ≤ 2.05×10⁷）内不会触发。
    var budget = 4.0e7;
    if (n * steps > budget) steps = Math.max(20, Math.floor(budget / n));

    var s = [], i, j;
    for (i = 0; i < n; i++) s[i] = 1;                  // 全 +1 有序初态
    var lft = [], rgt = [];                            // 周期边界邻居索引
    for (i = 0; i < L; i++) { lft[i] = (i - 1 + L) % L; rgt[i] = (i + 1) % L; }
    // Metropolis 接受概率表：h = 近邻和（步长 2），当前自旋 s = ±1 时 ΔE = 2 s h
    var pUp = [], pDn = [], h;
    for (h = -4; h <= 4; h += 2) {
      pUp[h + 4] = (2 * h <= 0) ? 1 : Math.exp(-2 * h / T);
      pDn[h + 4] = (-2 * h <= 0) ? 1 : Math.exp(2 * h / T);
    }
    var rnd = mulberry32(seed);
    var rec = Math.max(1, Math.floor(steps / 1200));   // 抽稀记录：SVG 最多约 1200 个点
    var tArr = [], mArr = [];
    var sum = n;                                       // Σ s_i（增量维护，O(1)/扫）
    var statFrom = steps * 0.75;                       // 末 25% 扫用作平衡态平均
    var sAbs = 0, sM = 0, sM2 = 0, sE = 0, sE2 = 0, cnt = 0, acc = 0;
    var st, x, y, row, rowUp, rowDn, idx, pr, si, e;
    for (st = 0; st < steps; st++) {
      for (y = 0; y < L; y++) {
        rowUp = ((y - 1 + L) % L) * L; rowDn = ((y + 1) % L) * L; row = y * L;
        for (x = 0; x < L; x++) {
          idx = row + x;
          h = s[rowUp + x] + s[rowDn + x] + s[row + lft[x]] + s[row + rgt[x]];
          si = s[idx];
          pr = si > 0 ? pUp[h + 4] : pDn[h + 4];
          if (pr >= 1 || rnd() < pr) { s[idx] = -si; sum -= 2 * si; acc++; }
        }
      }
      var M = sum / n;
      if ((st + 1) % rec === 0 || st === steps - 1) { tArr.push(st + 1); mArr.push(M); }
      if (st >= statFrom) {
        e = 0;                                         // 能量：每条键只数一次（右、下）
        for (y = 0; y < L; y++) {
          row = y * L; rowDn = ((y + 1) % L) * L;
          for (x = 0; x < L; x++) e -= s[row + x] * (s[row + rgt[x]] + s[rowDn + x]);
        }
        var eSpin = e / n;                             // 每自旋能量（基态 −2，T=Tc 时 −√2）
        sAbs += Math.abs(M); sM += M; sM2 += M * M; sE += eSpin; sE2 += eSpin * eSpin; cnt++;
      }
    }
    var Mabs = cnt ? sAbs / cnt : 0;
    var Mmean = cnt ? sM / cnt : 0;
    var M2 = cnt ? sM2 / cnt : 0;
    var eAvg = cnt ? sE / cnt : 0;
    var e2Avg = cnt ? sE2 / cnt : 0;
    var chi = (M2 - Mmean * Mmean) * n / T;            // χ = N(⟨m²⟩−⟨m⟩²)/kT（每自旋磁化率）
    var Cv = fin((e2Avg - eAvg * eAvg) / (T * T), 0);  // 每自旋比热 C/k_B = (⟨e²⟩−⟨e⟩²)/T²
    // 末态自旋位形：每行一条"蛇形"折线（偶数行左→右、奇数行右→左，行间连接线很短），
    // 合成**一条** polyline ⇒ extra 图只有一个图例项，不会把图例撑爆。
    var H = 0.32, cx = [], cy = [];
    for (y = 0; y < L; y++) {
      var rx = [], ry = [], y0 = y + 0.5 + s[y * L] * H;
      rx.push(0); ry.push(y0);
      for (x = 0; x < L; x++) {
        var yv = y + 0.5 + s[y * L + x] * H;
        rx.push(x); ry.push(yv);
        rx.push(x + 1); ry.push(yv);
      }
      if (y % 2 === 1) { rx.reverse(); ry.reverse(); }
      for (j = 0; j < rx.length; j++) { cx.push(rx[j]); cy.push(ry[j]); }
    }
    var mEnd = mArr.length ? mArr[mArr.length - 1] : 0;
    return {
      t: tArr, series: { M: mArr },
      info: [
        { k: "末态磁化强度 M（每自旋）", v: fmt(mEnd, 4) },
        { k: "平衡态平均 |M|（末 25% 扫）", v: fmt(Mabs, 4) },
        { k: "每自旋能量 e（末 25% 扫平均）", v: fmt(eAvg, 5) + " J（基态 −2J）" },
        { k: "理论临界温度 k_BTc/J = 2/ln(1+√2)", v: fmt(ISING_TC, 6) },
        { k: "约化温度 T/Tc", v: fmt(T / ISING_TC, 4) },
        { k: "磁化率 χ = N(⟨m²⟩−⟨m⟩²)/kT", v: fmt(chi, 4) + " /J" },
        { k: "每自旋比热 C/k_B = (⟨e²⟩−⟨e⟩²)/T²", v: fmt(Cv, 4) + " k_B" },
        { k: "单自旋翻转接受率", v: fmt(acc / (n * steps), 4) },
        { k: "规模（L × L × 扫数）", v: L + " × " + L + " × " + fmt(steps, 0) + "（seed = " + seed + "）" }
      ],
      bars: [
        { label: "|M|（1 = 完全有序）", value: Mabs, color: "#5aa9ff" },
        { label: "|e|/2（1 = 基态能量）", value: Math.abs(eAvg) / 2, color: "#ffb84d" },
        { label: "接受率", value: acc / (n * steps), color: "#63d6a5" }
      ],
      extra: {
        lines: [{ x: cx, y: cy, label: "↑ / ↓ 自旋位形", color: "#c792ea" }],
        xlabel: "格子列（周期边界）", ylabel: "格子行（每行一条折线，↑ 朝上）",
        title: "末态自旋位形：L = " + L + " × " + L + "，T/Tc = " + fmt(T / ISING_TC, 3) +
          "（T<Tc 时成畴，T>Tc 时杂乱）"
      },
      metrics: {
        L: L, steps: steps, seed: seed, T: T, Tc: ISING_TC,
        Mabs: Mabs, M2: M2, Mmean: Mmean, eSpin: eAvg, C: Cv, chi: chi,
        acc: acc / (n * steps), M: mArr, spins: s
      }
    };
  }

  SIM.register("ising", {
    title: "二维伊辛模型蒙特卡洛（自发磁化与相变）",
    legend: "每个“步”用 Metropolis 判据扫过一遍全部 L² 个自旋。T < Tc = 2.269 J/k_B 时磁化强度" +
      "稳在有限值（自发磁化），T > Tc 时在 0 附近抖动（热涨落摧毁长程序）。下图是末态自旋位形。",
    axes: { xlabel: "MC 步（每步扫一遍全格点）", ylabel: "磁化强度 M（每自旋平均）" },
    params: {
      T: { label: "温度 k_BT/J", unit: "", def: 2.2, min: 0.5, max: 4, step: 0.05 },
      L: { label: "线度 L", unit: "", def: 16, min: 8, max: 32, step: 1 },
      steps: { label: "MC 步数", unit: "", def: 2000, min: 200, max: 20000, step: 100 },
      seed: { label: "随机种子", unit: "", def: 1, min: 1, max: 9999, step: 1 }
    },
    plots: [
      { key: "M", label: "磁化强度 M（每自旋）", color: "#5aa9ff" }
    ],
    compute: isingCompute,
    tests: [
      // ① 同 seed 两次运行逐点一致（PRNG 与扫描顺序都是确定性的，容差取 0）
      { name: "同 seed 完全可重复（两次运行逐点逐位一致）",
        measure: function (o, p) { return maxDiff(o.series.M, isingCompute(p).series.M); },
        expect: 0, tol: 0 },
      // ② 换 seed 结果必须不同（否则说明 PRNG 根本没用到 seed）
      { name: "换 seed 结果不同（随机数真的由 seed 决定）",
        params: { T: 2.2, L: 16, steps: 2000, seed: 7 },
        measure: function (o, p) {
          var d = maxDiff(o.series.M, isingCompute({ T: p.T, L: p.L, steps: p.steps, seed: 8 }).series.M);
          return d > 1e-9 ? 1 : 0;
        }, expect: 1, tol: 0 },
      // ③ T = 1 < Tc：Onsager 精确自发磁化 m = [1 − sinh⁻⁴(2J/kT)]^{1/8}
      //    = [1 − 3.6268604⁻⁴]^{1/8} = 0.9992758；有限格点 + 末 25% 扫平均后仍应落在 ±0.05 内（且 > 0.9）
      { name: "T=1.0（< Tc）时 |M| ≈ Onsager 精确解 0.9992758（> 0.9）",
        params: { T: 1.0, L: 16, steps: 2000, seed: 1 },
        measure: function (o) { return meanAbsTail(o.series.M, 0.25); },
        expect: 0.999275751957, tol: 0.05 },
      // ④ T = 3.5 > Tc：解析上自发磁化 m ≡ 0，有限格点只剩 1/√N 量级的涨落（L=16 时约 0.1）
      { name: "T=3.5（> Tc）时无自发磁化：|M| < 0.3",
        params: { T: 3.5, L: 16, steps: 2000, seed: 1 },
        measure: function (o) { return meanAbsTail(o.series.M, 0.25); },
        expect: 0, tol: 0.3 },
      // ⑤ 低温能量接近基态：基态每键 −J ⇒ 每自旋 −2J（4 个近邻、每条键数一次）
      //    T = 1 的 Onsager 精确值 −1.9971602，与 −2 差 0.0028 < 0.01
      { name: "低温每自旋能量 ≈ 基态 −2J（T=1 精确值 −1.99716，容差 0.01）",
        params: { T: 1.0, L: 16, steps: 2000, seed: 1 },
        measure: function (o) { return o.metrics.eSpin; },
        expect: -2, tol: 0.01 },
      // ⑥ 理论临界温度：k_BTc/J = 2/ln(1+√2)
      { name: "理论 Tc = 2/ln(1+√2) = 2.269185",
        measure: function (o) { return o.metrics.Tc; }, expect: 2.269185, tol: 1e-6 },
      // ⑦ 边界安全：偏小格子 / 高温 / 少步数下不崩，|M| ≤ 1，位形折线数 = L
      { name: "边界：T=4、L=8、200 步时全部有限、|M| ≤ 1、位形行数 = L",
        params: { T: 4, L: 8, steps: 200, seed: 9999 },
        measure: function (o) {
          var v = o.series.M, i;
          if (!v.length) return 0;
          for (i = 0; i < v.length; i++) if (!isFinite(v[i]) || Math.abs(v[i]) > 1 + 1e-12) return 0;
          if (!isFinite(o.metrics.eSpin) || !isFinite(o.metrics.C) || !isFinite(o.metrics.chi)) return 0;
          return o.extra.lines.length === 1 && o.metrics.L === 8 ? 1 : 0;
        }, expect: 1, tol: 0 }
    ]
  });

  /* ==========================================================================
     3. canonical —— 正则分布：二能级系统（Schottky 异常）
     ========================================================================== */
  /**
   * N 个独立二能级粒子、能隙 ε。取**低能级为能量零点**（E₁ = 0, E₂ = ε），则
   *   单粒子配分函数 Z₁ = 1 + e^{−x}，体系 Z = Z₁^N，x = ε/(k_BT)
   *   占据比 n₂/n₁ = e^{−x}                      …（契约 ①）
   *   内能 U = Nε·n₂ = Nε/(1+e^{x}) ⇒ 本文件按契约 ② 的写法给 U = −Nε/(1+e^{x})，
   *     即"低能级取零"的内能取负号（能量零点取在高能级）：T→0 时 U→0，T→∞ 时 U→−Nε/2（契约 ④）
   *   热容（Schottky 异常）C = N k_B x²e^x/(1+e^x)² = N k_B x²e^{−x}/(1+e^{−x})²，
   *     恒为正、两端趋于 0，极大在 x = 2.3993573（即 kT/ε = 1/x = 0.4167783，契约 ③），
   *     峰高 C_max = 0.4392288 N k_B；数值上 C = −dU/dT（本模型 U 单调下降）。
   * 无穷小检查：x→0 时 C ≈ N k_B x²/4 → 0（能级太密，热激发分辨不出）；
   *             x→∞ 时 C ≈ N k_B x²e^{−x} → 0（能级太稀，热激发不到）。
   * 一律用 e^{−x} 形式计算：x 可以到 10⁴ 也不会溢出（e^{−x} → 0，C → 0）。
   */
  var CAN_N = 801;
  function canonCompute(p) {
    var eps = clamp(num(p.eps, 1), 0.01, 10);      // 能隙 ε（能量单位 ε₀）
    var T = clamp(num(p.T, 1), 0.005, 50);         // 温度（ε₀/k_B 单位 ⇒ kT/ε = T/eps）
    var N = Math.round(clamp(num(p.N, 100), 1, 1000));
    // 扫温区间：默认 [0.02ε, 4ε]（Schottky 峰在 0.4168ε 处，落在区间的 10% 位置，两端渐近都看得见）；
    // 当前温度超出时把上界抬到它外面一点（标记点才不会跑到图外）。
    var Tlo = Math.min(0.02 * eps, 0.5 * T);
    var Thi = Math.min(60, Math.max(4 * eps, 1.05 * T));
    var ts = lin(Tlo, Thi, CAN_N);
    var U = [], C = [], n1 = [], n2 = [], i;
    for (i = 0; i < ts.length; i++) {
      var x = eps / ts[i];                          // x = ε/kT > 0
      var y = Math.exp(-x);                         // e^{−x} ∈ (0,1]，用它做所有式子，绝不溢出
      var Z1 = 1 + y;
      U.push(-N * eps * y / Z1);                    // = −Nε/(1+e^{x})
      C.push(N * x * x * y / (Z1 * Z1));            // = Nk x²e^x/(1+e^x)²
      n1.push(1 / Z1);                              // 低能级占据 1/(1+e^{−x})
      n2.push(y / Z1);                              // 高能级占据 e^{−x}/(1+e^{−x})
    }
    // 峰位（Schottky 异常）：解析值 x* = 2.3993573 ⇒ kT/ε = 0.4167783
    var iC = argmax(C);
    var Tpk = peakX(ts, C, iC);
    var Cpk = peakY(ts, C, iC);
    // 当前温度下的正则量
    var xc = eps / T, yc = Math.exp(-xc), Z1c = 1 + yc;
    var Uc = -N * eps * yc / Z1c;
    var Cc = N * xc * xc * yc / (Z1c * Z1c);
    var Z = Math.pow(Z1c, N);                       // ≤ 2^1000 = 1.07e301，double 内不会溢出
    var Srel = Math.log(Z1c) + xc * (yc / Z1c);     // 熵 S/(Nk_B) = ln Z₁ + x·n₂
    // 物理标尺：若把能隙取作 1 meV，则 T = 1（模型单位）对应 ε/k_B = 11.6045 K（用 CODATA 的 k_B、eV 换算）
    var kelvinPerUnit = 1e-3 * EV_J / K_B;
    return {
      t: ts, series: { U: U, C: C },
      info: [
        { k: "能隙 ε", v: fmt(eps, 4) + " ε₀" },
        { k: "温度 T（ε₀/k_B 单位 ⇒ kT/ε）", v: fmt(T, 4) },
        { k: "单粒子配分函数 Z₁ = 1+e^(−ε/kT)", v: fmt(Z1c, 6) },
        { k: "体系配分函数 Z = Z₁^N", v: fmt(Z, 4) + "（ln Z/N = " + fmt(Math.log(Z1c), 5) + "）" },
        { k: "占据比 n₂/n₁ = e^(−ε/kT)", v: fmt(yc, 6) },
        { k: "内能 U = −Nε/(1+e^(ε/kT))", v: fmt(Uc, 5) + " ε₀（高温极限 −Nε/2 = " + fmt(-N * eps / 2, 5) + "）" },
        { k: "热容 C = Nk·x²e^x/(1+e^x)²", v: fmt(Cc, 5) + " Nk_B" },
        { k: "熵 S/(Nk_B) = ln Z₁ + x·n₂", v: fmt(Srel, 5) },
        { k: "Schottky 峰位 kT/ε（解析 0.4167783）", v: fmt(Tpk / eps, 5) + "（峰高 0.4392288 Nk_B）" },
        { k: "当前热容 / 峰高", v: fmt(Cc / (0.4392288 * N), 4) },
        { k: "物理标尺（取 ε = 1 meV）", v: "T=1 单位 ⇔ " + fmt(kelvinPerUnit, 4) + " K；当前 T ⇔ " + fmt(kelvinPerUnit * T, 4) + " K" }
      ],
      extra: {
        lines: [
          { x: ts, y: n1, label: "低能级占据 n₁", color: "#5aa9ff" },
          { x: ts, y: n2, label: "高能级占据 n₂", color: "#ffb84d", dash: "5 4" }
        ],
        markers: [{ x: T, y: yc / Z1c, label: "当前 T" }],
        xlabel: "T（ε/k_B 单位）", ylabel: "占据概率",
        title: "两能级的占据概率：T→0 时全在低能级（n₁→1），T→∞ 时各占一半（n₁=n₂=1/2）"
      },
      metrics: {
        ts: ts, U: U, C: C, n1: n1, n2: n2,
        eps: eps, T: T, N: N, xc: xc, ratio: yc, Z1: Z1c, Z: Z, Uc: Uc, Cc: Cc,
        n1c: 1 / Z1c, n2c: yc / Z1c, Speak: Srel, Tpeak: Tpk, Cpeak: Cpk
      }
    };
  }

  SIM.register("canonical", {
    title: "正则分布（二能级系统）：Schottky 热容异常",
    legend: "二能级系统的热容是典型的 Schottky 异常：能级差太大（低温）或太小（高温）都激不起来，" +
      "只有 kT ≈ ε/2.4 时热容最大。图中 U 按契约取“高能级为零点”的写法，故从 0 降到 −Nε/2。",
    axes: { xlabel: "T（ε/k_B 单位）", ylabel: "内能 U（ε₀）/ 热容 C（Nk_B）" },
    params: {
      eps: { label: "能隙 ε", unit: "ε₀", def: 1, min: 0.1, max: 3, step: 0.05 },
      T: { label: "温度 T", unit: "ε₀/k_B", def: 1, min: 0.05, max: 10, step: 0.05 },
      N: { label: "粒子数 N", unit: "", def: 100, min: 1, max: 1000, step: 1 }
    },
    plots: [
      { key: "U", label: "内能 U（ε₀）", color: "#5aa9ff" },
      { key: "C", label: "热容 C（Nk_B）", color: "#ffb84d" }
    ],
    compute: canonCompute,
    tests: [
      // ① 占据比 n₂/n₁ = e^{−ε/kT}（ε=1、T=1 → e^{−1} = 0.36787944117144233）
      { name: "占据比 n₂/n₁ = e^(−ε/kT) = e⁻¹ = 0.36787944117144233",
        params: { eps: 1, T: 1, N: 100 },
        measure: function (o) { return o.metrics.ratio; }, expect: 0.36787944117144233, tol: 1e-12 },
      // ② U = −Nε/(1+e^{ε/kT})：N=100、ε=1、T=1 → −100/(1+e) = −26.894142136999513
      { name: "内能 U = −Nε/(1+e^(ε/kT)) = −26.894142136999513",
        params: { eps: 1, T: 1, N: 100 },
        measure: function (o) { return o.metrics.Uc; }, expect: -26.894142136999513, tol: 1e-12 },
      // ②b 配分函数：Z₁ = 1+e^{−1}；体系 ln Z/N 必须等于 ln Z₁
      { name: "配分函数 Z₁ = 1+e^(−ε/kT) = 1.3678794411714423，且 Z = Z₁^N",
        params: { eps: 1, T: 1, N: 100 },
        measure: function (o, p) {
          var lnZ1 = Math.log(o.metrics.Z1);
          return Math.abs(o.metrics.Z1 - (1 + Math.exp(-1))) + Math.abs(Math.log(o.metrics.Z) / p.N - lnZ1);
        }, expect: 0, tol: 1e-12 },
      // ③ 热容峰位：C/Nk = x²e^x/(1+e^x)² 的极大在 x* = 2.3993573 ⇒ kT/ε = 1/x* = 0.4167783
      //    （契约给的 0.4168 ± 1e-3；从 C(T) 曲线用抛物顶点插值现算）
      { name: "Schottky 热容峰位 kT/ε = 0.4168（解析 1/2.3993573 = 0.4167783）",
        params: { eps: 1, T: 1, N: 100 },
        measure: function (o) { return o.metrics.Tpeak / o.metrics.eps; }, expect: 0.4168, tol: 1e-3 },
      // ③b 峰高：代入 x* 得 C_max/Nk = x*²e^{x*}/(1+e^{x*})² = 0.4392288399
      { name: "峰高 C_max/Nk_B = 0.4392288399",
        params: { eps: 1, T: 1, N: 100 },
        measure: function (o, p) { return o.metrics.Cpeak / p.N; }, expect: 0.439228839890645, tol: 1e-5 },
      // ④ 高温极限 U → −Nε/2：T = 10ε 时相对偏差解析为 (U+Nε/2)/(Nε/2) = tanh(ε/2kT) = tanh(0.05) = 0.049958375
      { name: "高温极限：T=10ε 时 |U+Nε/2|/(Nε/2) = tanh(ε/2kT) = 0.049958375 < 5%",
        params: { eps: 1, T: 10, N: 100 },
        measure: function (o, p) {
          var half = p.N * o.metrics.eps / 2;
          return Math.abs(o.metrics.Uc + half) / half;
        }, expect: 0.049958374957879977, tol: 1e-9 },
      // ⑤ T→0：全部落在低能级，n₂ = 1/(1+e^{ε/kT}) = 1/(1+e²⁰) = 2.06e-9 → 0（容差 1e-8）
      { name: "T→0（T=0.05ε）时高能级占据 n₂ = 1/(1+e²⁰) = 2.06e-9 → 0",
        params: { eps: 1, T: 0.05, N: 100 },
        measure: function (o) { return o.metrics.n2c; }, expect: 0, tol: 1e-8 },
      // ⑥ 边界安全：x = ε/T 最大到 2000（eps=10、T=0.005），全部量有限、C ≥ 0、U ∈ [−Nε/2, 0]
      { name: "边界：ε=3、T=0.005 与 ε=0.1、T=50、N=1000 都不出 NaN/Infinity，U ∈ [−Nε/2, 0]、C ≥ 0",
        params: { eps: 3, T: 0.005, N: 1000 },
        measure: function (o) {
          var ok = 1, i, v;
          for (i = 0; i < o.series.U.length; i++) {
            v = o.series.U[i];
            if (!isFinite(v) || v > 1e-12 || v < -o.metrics.N * o.metrics.eps / 2 - 1e-9) ok = 0;
            v = o.series.C[i];
            if (!isFinite(v) || v < 0) ok = 0;
          }
          var p2 = canonCompute({ eps: 0.1, T: 50, N: 1000 });
          if (!isFinite(p2.metrics.Uc) || !isFinite(p2.metrics.Cc) || !isFinite(p2.metrics.Z)) ok = 0;
          return ok;
        }, expect: 1, tol: 0 },
      // ⑦ 低温极限：U → 0（T = 0.05ε 时 |U| = Nε/(1+e²⁰) ≈ 2.06e-7 Nε）
      { name: "T→0 时 U → 0（T=0.05ε 时 |U|/Nε = 2.06e-9）",
        params: { eps: 1, T: 0.05, N: 100 },
        measure: function (o, p) { return Math.abs(o.metrics.Uc) / (p.N * o.metrics.eps); },
        expect: 0, tol: 1e-8 }
    ]
  });

  /* ==========================================================================
     4. phase-transition —— 相变与临界现象（平均场 vs 二维伊辛）
     ========================================================================== */
  /**
   * 横轴是绝对温度 T（J/k_B 单位，取 J = 1），两种理论放在同一条轴上：
   *
   * ① 平均场（Landau / Weiss，**近似**）：
   *      m = √(1 − T/Tc)         （T < Tc；T ≥ Tc 时 m = 0）     契约 ①，临界指数 β = 1/2
   *      χ = 1/|1 − T/Tc|        （两侧对称发散，γ = 1）        契约 ②
   *      F = (a/2)(T−Tc)m² + (b/4)m⁴（取 a = b = 1，m² = (Tc−T)）
   *        T < Tc：F_eq = −(Tc−T)²/4 ⇒ C = −T ∂²F/∂T² = T/2
   *        T ≥ Tc：m = 0        ⇒ C = 0
   *        ⇒ 比热在 Tc 处**有限跳变** ΔC = Tc/2 > 0（α = 0 的"跳变"型）  契约 ③
   *
   * ② 二维伊辛（正方格子、无限大）：
   *      序参量用 **Onsager 精确解** m = [1 − sinh⁻⁴(2J/kT)]^{1/8}（T < Tc = 2.2691853，β = 1/8）；
   *      磁化率与比热**没有**用完整的 Onsager 闭式（涉及椭圆积分），而是取临界指数正确的唯象形式
   *        χ ∝ |1 − T/Tc|^{−7/4}（γ = 7/4）、C ∝ −ln|1 − T/Tc|（α = 0，对数发散）
   *      —— 这两条是**近似对照曲线**（曲线的整体幅度是唯象选取的，只有发散指数和 Tc 是精确的），
   *      别当成精确解；info 里已明确标注。
   * 临界指数对照（契约 ④）：平均场 β=1/2、γ=1、α=0（跳变）；二维伊辛 β=1/8、γ=7/4、α=0（对数）。
   */
  var PT_OPTS = ["序参量", "磁化率", "比热"];
  var PT_TC_ISING = 2 / Math.log(1 + Math.SQRT2);   // 2.269185314213022（Onsager 1944）
  var PT_TMAX = 3;              // 横轴窗口 T ∈ [0, 3]
  var PT_N = 601;
  var PT_CHI_MAX = 20;          // 磁化率在临界点发散 → 绘图截断
  var PT_C_MAX = 2.5;           // 二维伊辛比热对数发散 → 绘图截断
  var PT_BETA2D = 0.125;        // β = 1/8（二维伊辛精确）
  var PT_GAMMA2D = 1.75;        // γ = 7/4（二维伊辛精确）
  var PT_ALPHA2D = 0;           // α = 0（比热对数发散）

  function ptMfM(T, Tc) { return T < Tc ? Math.sqrt(Math.max(0, 1 - T / Tc)) : 0; }
  function ptMfChi(T, Tc) {
    var d = Math.abs(1 - T / Tc);
    return d > 0 ? 1 / d : Infinity;               // T = Tc 处发散（绘图时截断）
  }
  function ptMfC(T, Tc) { return T < Tc ? T / 2 : 0; }
  function ptIsingM(T) {                            // Onsager 精确自发磁化
    if (T >= PT_TC_ISING) return 0;
    var s = Math.sinh(2 / T);
    if (!isFinite(s) || s === 0) return 1;          // T → 0 的极限：完全有序
    var v = 1 - Math.pow(1 / s, 4);
    return v > 0 ? Math.pow(v, 1 / 8) : 0;
  }
  function ptIsingChi(T) {                          // 唯象对照（近似，不是精确解）
    var d = Math.abs(1 - T / PT_TC_ISING);
    return d > 0 ? Math.pow(1 / d, PT_GAMMA2D) : Infinity;
  }
  function ptIsingC(T) {                            // 唯象对照（近似，不是精确解）
    var d = Math.abs(1 - T / PT_TC_ISING);
    return d > 0 ? -0.5 * Math.log(d) : Infinity;
  }
  function ptCompute(p) {
    var Tc = clamp(num(p.Tc, 1), 0.1, 5);
    var T = clamp(num(p.T, 0.9), 0.001, 20);
    var name = opt(PT_OPTS, p.kind);
    var ki = PT_OPTS.indexOf(name);
    var ts = lin(0, PT_TMAX, PT_N), mf = [], is = [], i, v1, v2;
    for (i = 0; i < ts.length; i++) {
      if (ki === 0) { v1 = ptMfM(ts[i], Tc); v2 = ptIsingM(ts[i]); }
      else if (ki === 1) { v1 = ptMfChi(ts[i], Tc); v2 = ptIsingChi(ts[i]); }
      else { v1 = ptMfC(ts[i], Tc); v2 = ptIsingC(ts[i]); }
      mf.push(clip(v1, ki === 1 ? PT_CHI_MAX : (ki === 2 ? PT_C_MAX : 1)));
      is.push(clip(v2, ki === 1 ? PT_CHI_MAX : (ki === 2 ? PT_C_MAX : 1)));
    }
    var cur = ki === 0 ? [ptMfM(T, Tc), ptIsingM(T)] :
      (ki === 1 ? [ptMfChi(T, Tc), ptIsingChi(T)] : [ptMfC(T, Tc), ptIsingC(T)]);
    // 有效临界指数（从曲线现算：两个温度点的双对数斜率）
    var t1 = 0.5, t2 = 0.75;
    var betaEff = Math.log(ptMfM(t1, Tc) / ptMfM(t2, Tc)) / Math.log((1 - t1 / Tc) / (1 - t2 / Tc));
    // 二维伊辛对照曲线的有效 β（在 Tc 附近取 2.25、2.265 两个网格点，有限距离修正 ~1%）
    var iA = nearestIndex(ts, 2.25), iB = nearestIndex(ts, 2.265);
    var betaI = (Math.log(is[iB]) - Math.log(is[iA])) /
      (Math.log(1 - ts[iB] / PT_TC_ISING) - Math.log(1 - ts[iA] / PT_TC_ISING));
    var Cjump = Tc / 2;                              // Landau：ΔC = Tc/2（a = b = 1）
    return {
      t: ts, series: { mf: mf, ising: is },
      info: [
        { k: "当前曲线", v: name + "（平均场 vs 二维伊辛）" },
        { k: "平均场 Tc", v: fmt(Tc, 4) + " J/k_B（参数）" },
        { k: "二维伊辛 Tc = 2/ln(1+√2)", v: fmt(PT_TC_ISING, 6) + " J/k_B（精确）" },
        { k: "当前 T 下：平均场 / 二维伊辛", v: fmt(cur[0], 5) + " / " + fmt(cur[1], 5) },
        { k: "平均场临界指数 β / γ / α", v: "1/2 / 1 / 0（比热跳变 ΔC = Tc/2 = " + fmt(Cjump, 4) + "）" },
        { k: "二维伊辛精确 β（Onsager）", v: "1/8 = " + fmt(PT_BETA2D, 4) + "（m ∝ (1−T/Tc)^β）" },
        { k: "二维伊辛精确 γ（Onsager）", v: "7/4 = " + fmt(PT_GAMMA2D, 4) + "（χ ∝ |1−T/Tc|^−γ）" },
        { k: "二维伊辛精确 α（Onsager）", v: "0（比热对数发散，不是跳变）" },
        { k: "从平均场曲线现算的 β（有效指数）", v: fmt(betaEff, 5) + "（解析 1/2）" },
        { k: "从对照曲线现算的 β（2.25→2.265）", v: fmt(betaI, 5) + "（精确值 1/8，有限距离修正约 1%）" },
        { k: "对照曲线说明", v: "m 用 Onsager 精确解；χ、C 是按精确指数构造的**唯象近似**" },
        { k: "绘图截断", v: "χ > " + fmt(PT_CHI_MAX, 2) + "、C > " + fmt(PT_C_MAX, 2) + " 的部分已截断" }
      ],
      extra: null,
      metrics: {
        ts: ts, mf: mf, ising: is, Tc: Tc, T: T, kind: ki, name: name,
        TcIsing: PT_TC_ISING, beta2D: PT_BETA2D, gamma2D: PT_GAMMA2D, alpha2D: PT_ALPHA2D,
        betaEff: betaEff, betaIsingEff: betaI, Cjump: Cjump,
        mCur: cur[0], isingCur: cur[1],
        mfM: ptMfM(T, Tc), mfChi: ptMfChi(T, Tc), mfC: ptMfC(T, Tc),
        isingMCur: ptIsingM(T), isingChiCur: ptIsingChi(T), isingCCur: ptIsingC(T)
      }
    };
  }

  SIM.register("phase-transition", {
    title: "相变与临界现象：平均场 vs 二维伊辛",
    legend: "横轴是绝对温度 T（J/k_B）。平均场（近似）给 m = √(1−T/Tc)、χ = 1/|1−T/Tc|、比热有限跳变；" +
      "二维伊辛（正方格子）是 m 由 Onsager 精确解给出、指数 β=1/8、γ=7/4、比热对数发散——差别就是“涨落”。",
    axes: { xlabel: "T（J/k_B 单位，J = 1）", ylabel: "m / χ / C（由“曲线”参数选择）" },
    params: {
      kind: { label: "曲线", type: "enum", options: PT_OPTS, def: 0 },
      Tc: { label: "平均场 Tc", unit: "J/k_B", def: 1, min: 0.5, max: 2, step: 0.05 },
      T: { label: "当前温度 T", unit: "J/k_B", def: 0.9, min: 0.2, max: 2, step: 0.05 }
    },
    plots: [
      { key: "mf", label: "平均场（近似）", color: "#5aa9ff" },
      { key: "ising", label: "二维伊辛（精确/唯象对照）", color: "#ffb84d", dash: "5 4" }
    ],
    compute: ptCompute,
    tests: [
      // ① m = √(1−T/Tc)：Tc=1、T=0.9 → √0.1 = 0.31622776601683794（直接从曲线取该网格点）
      { name: "平均场序参量 m = √(1−T/Tc)：T=0.9、Tc=1 → √0.1 = 0.31622776601683794",
        params: { kind: 0, Tc: 1, T: 0.9 },
        measure: function (o) { return o.series.mf[nearestIndex(o.t, 0.9)]; },
        expect: 0.31622776601683794, tol: 1e-12 },
      // ①b T ≥ Tc 时 m = 0（解析：Tc 以上无自发磁化）
      { name: "T ≥ Tc 时 m = 0（T=1.5、Tc=1）",
        params: { kind: 0, Tc: 1, T: 1.5 },
        measure: function (o) { return o.series.mf[nearestIndex(o.t, 1.5)]; },
        expect: 0, tol: 0 },
      // ①c 临界指数 β = 1/2：从曲线上任意两点现算 ln m / ln(1−T/Tc)
      { name: "平均场临界指数 β = 1/2（从曲线现算）",
        params: { kind: 0, Tc: 1, T: 0.9 },
        measure: function (o) { return o.metrics.betaEff; }, expect: 0.5, tol: 1e-12 },
      // ② χ = 1/|1−T/Tc| 两侧对称：T = 0.5 与 T = 1.5（Tc = 1）都等于 2
      { name: "平均场磁化率 χ = 1/|1−T/Tc| = 2（Tc=1，T=0.5 与 T=1.5 对称）",
        params: { kind: 1, Tc: 1, T: 0.9 },
        measure: function (o) {
          var a = o.series.mf[nearestIndex(o.t, 0.5)];
          var b = o.series.mf[nearestIndex(o.t, 1.5)];
          return a - b;                                // 两侧对称 ⇒ 差为 0；且 a 本身应为 2
        }, expect: 0, tol: 1e-12 },
      // ②b 临界指数 γ = 1：χ(T=0.5)=2、χ(T=0.75)=4（Tc=1），双对数斜率的绝对值
      { name: "平均场临界指数 γ = 1（χ(0.5)=2、χ(0.75)=4 → 双对数斜率）",
        params: { kind: 1, Tc: 1, T: 0.9 },
        measure: function (o) {
          var a = o.series.mf[nearestIndex(o.t, 0.5)];
          var b = o.series.mf[nearestIndex(o.t, 0.75)];
          return Math.abs(Math.log(a / b)) / Math.abs(Math.log((1 - 0.5) / (1 - 0.75)));
        }, expect: 1, tol: 1e-9 },
      // ③ 平均场比热在 Tc 处跳变：Landau 解给 ΔC = Tc/2（左极限 T/2，右极限 0），Tc=1 → 0.5
      { name: "平均场比热在 Tc 处跳变 ΔC = Tc/2 = 0.5（左右极限差 > 0）",
        params: { kind: 2, Tc: 1, T: 0.9 },
        measure: function (o) { return o.metrics.Cjump; }, expect: 0.5, tol: 1e-12 },
      // ③b 从曲线现算跳变：最后一个 T < Tc 的网格点（Tc − 0.005）给 (Tc−0.005)/2 = 0.4975，Tc 以上为 0
      { name: "从曲线现算的比热跳变 = 0.4975（网格步长 0.005 的离散误差，容差 0.01）",
        params: { kind: 2, Tc: 1, T: 0.9 },
        measure: function (o, p) {
          var idx = -1, i;
          for (i = 0; i < o.t.length; i++) if (o.t[i] < p.Tc) idx = i;
          return idx < 0 ? NaN : o.series.mf[idx] - o.series.mf[idx + 1];
        }, expect: 0.4975, tol: 0.01 },
      // ④ 二维伊辛精确临界指数：β = 1/8 = 0.125、γ = 7/4 = 1.75（info 里也给出作对照）
      { name: "二维伊辛精确 β = 1/8 = 0.125（info 对照值）",
        measure: function (o) { return o.metrics.beta2D * 8; }, expect: 1, tol: 1e-12 },
      { name: "二维伊辛精确 γ = 7/4 = 1.75（info 对照值）",
        measure: function (o) { return o.metrics.gamma2D; }, expect: 1.75, tol: 1e-12 },
      // ④b 二维伊辛 Tc = 2/ln(1+√2) = 2.269185
      { name: "二维伊辛 Tc = 2/ln(1+√2) = 2.269185",
        measure: function (o) { return o.metrics.TcIsing; }, expect: 2.269185, tol: 1e-6 },
      // ⑤ 对照曲线（Onsager）在 T = 1.5 处的值：(1 − sinh⁻⁴(2/1.5))^{1/8} = 0.986499602621494
      { name: "Onsager 对照曲线 m(1.5) = (1−sinh⁻⁴(2/1.5))^{1/8} = 0.986499602621494",
        params: { kind: 0, Tc: 1, T: 1.5 },
        measure: function (o) { return o.series.ising[nearestIndex(o.t, 1.5)]; },
        expect: 0.986499602621494, tol: 1e-9 },
      // ⑥ 边界安全：Tc 取滑块两端、曲线处处有限（发散已被截断）
      { name: "边界：Tc=0.5 与 Tc=2 时曲线全部有限（χ、C 的发散已截断）",
        params: { kind: 1, Tc: 0.5, T: 0.9 },
        measure: function (o) {
          var bad = 0, i, p2;
          for (i = 0; i < o.series.mf.length; i++) {
            if (!isFinite(o.series.mf[i]) || !isFinite(o.series.ising[i])) bad++;
          }
          p2 = ptCompute({ kind: 2, Tc: 2, T: 0.9 });
          for (i = 0; i < p2.series.mf.length; i++) {
            if (!isFinite(p2.series.mf[i]) || !isFinite(p2.series.ising[i])) bad++;
          }
          return bad;
        }, expect: 0, tol: 0 }
    ]
  });
})(typeof window !== "undefined" ? window : globalThis);
