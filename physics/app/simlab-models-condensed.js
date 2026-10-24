/* ==========================================================================
   simlab-models-condensed.js —— 凝聚态物理 仿真模型（W5 契约 §13.A.1，4 个）

     · lattice        晶格与布拉格衍射：面间距 d_hkl、布拉格条件 2d sinθ = nλ、
                      FCC / BCC 的结构因子消光（粉末衍射谱 + stick 图）
     · phonon         一维晶格振动色散：单原子链 ω = 2√(K/m)|sin(qa/2)|、
                      双原子链的声学支 / 光学支与带隙
     · band           能带与态密度：紧束缚 E(k) = −2t·cos(ka)（带宽 4t、带边 1/√ 型 DOS）、
                      Kronig-Penney（δ 势垒）的能带与带隙随 V₀ 的增大
     · magnetization  磁性：顺磁居里定律 M = C·H/T、平均场 M = tanh((M+H)/T) 与 β = 1/2、
                      双曲正切型磁滞回线（剩磁 / 矫顽力）

   ★ 约束（与 simlab.js 顶部一致）：
     · 加载时**只调用 SIM.register**，绝不触碰 DOM —— tools/verify-simlab.mjs 在 Node 里
       用 window 桩直接加载本文件跑 compute() 与 tests 做物理不变量自检；
     · **不调用 Math.random**（全文没有 random）：四个模型都是确定性的，同一参数给出同一条曲线；
     · 纯 ES5：var / 无箭头函数 / 无模板字符串 / 无 import-export；
     · 边界安全：任意滑块取值都不抛异常、不出 NaN/Infinity —— 发散量（θ→0 的面间距、
       带边态密度、磁滞的零场、T→0 的居里定律）一律**先截断或先判非有限再进曲线**，
       精确值放在 info / metrics 里（与 stat 文件同一套做法）。

   单位约定（以及为什么这里几乎不需要物理常量）：
     · lattice：长度用 Å、角用度；只有"光子能量 ⇒ keV"这一条读数用到 h、c、eV：
       hc = 6.626 070 15×10⁻³⁴ × 2.997 924 58×10⁸ / (10³×1.602 176 634×10⁻¹⁹) × 10¹⁰
          = 12.398 419 84 keV·Å（constants.js 里以 "1 eV 对应波长 hc/e = 1 239.841 93 nm·eV"
          列出，取整后与 12.398 419 8 keV·Å 同值）。
     · phonon：能量以 √(K/m₁) 为单位、q 以 1/a 为单位（取 a = 1）⇒ 公式里不出现 ħ。
     · band：紧束缚的能量以跃迁积分 t 为单位；Kronig-Penney 用无量纲形式
       cos(ka) = cos(αa) + P·sin(αa)/(αa)，能量单位取 ħ²/(2ma²)（ε = (αa)²）。
       把 ε 换成 eV 需要 ħ、m_e、eV —— 照抄 app/constants.js 的 CODATA 值（见下），
       并注明取 a = 3 Å 作为"能量标尺"的参照晶格常数。
     · magnetization：一切能量以 k_B T_C 为单位（T 就是 T/T_C）⇒ 不需要物理常量。

   物理常量（数值照抄 app/constants.js，CODATA 2018 / 2019 年 SI 定义值；模型文件在 Node 里
   被单独加载，不能假设 window.PHYSICS_CONSTANTS 已存在，所以直接写在文件里）：
     c   = 2.997 924 58 × 10⁸ m/s      （精确）
     h   = 6.626 070 15 × 10⁻³⁴ J·s    （精确）
     ħ   = 1.054 571 817 × 10⁻³⁴ J·s   （精确）
     e   = 1.602 176 634 × 10⁻¹⁹ C     （精确；eV = 1.602 176 634 × 10⁻¹⁹ J）
     k_B = 1.380 649 × 10⁻²³ J/K       （精确；室温 k_BT(300 K) = 0.025 85 eV）
     m_e = 9.109 383 7015 × 10⁻³¹ kg   （电子质量）
   ========================================================================== */
(function (global) {
  "use strict";
  var SIM = global.SIM;
  if (!SIM) return;   // 在 Node 里若未先加载 simlab.js，安静退出

  var lin = SIM.linspace, fmt = SIM.fmt, opt = SIM.opt;

  /* ------------------------------------------------------------- 物理常量 */
  var C_LIGHT = 2.99792458e8;        // m/s
  var H_PLANCK = 6.62607015e-34;     // J·s
  var HBAR = 1.054571817e-34;        // J·s
  var EV_J = 1.602176634e-19;        // J
  var K_B = 1.380649e-23;            // J/K
  var M_E = 9.1093837015e-31;        // kg
  // hc 换算成 keV·Å：E(keV) = HC_KEV_A / λ(Å)
  var HC_KEV_A = H_PLANCK * C_LIGHT / (1e3 * EV_J) * 1e10;      // = 12.398419843320026
  // 室温热能量：k_B·300 K / eV = 0.025852 eV（constants.js「室温热能量」条目写作 0.025 85 eV）
  var KB_T_ROOM_EV = K_B * 300 / EV_J;                          // = 0.02585199...

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
  /** 数组最小值下标 */
  function argmin(ys) {
    var m = 0, i;
    for (i = 1; i < ys.length; i++) if (ys[i] < ys[m]) m = i;
    return m;
  }
  /**
   * 抛物顶点插值：过网格极值点 i 及其左右邻点作抛物线，取顶点横坐标。
   * 采样 1500 点时素网格的峰位精度只有 O(h)（~1e-2 度），插值后约 O(h³)（~1e-9），
   * 才够得上"峰位 = 解析值 ± 0.01°"这类自检。
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
  /** 局部峰位：在 [x0−w, x0+w] 窗口内找最大点再做抛物线插值（自检"从曲线现算峰位"） */
  function localPeakX(xs, ys, x0, w) {
    var i, best = -1, bv = -Infinity;
    for (i = 0; i < xs.length; i++) {
      if (xs[i] < x0 - w || xs[i] > x0 + w) continue;
      if (ys[i] > bv) { bv = ys[i]; best = i; }
    }
    return best < 0 ? x0 : peakX(xs, ys, best);
  }
  /** 窗口 [x0−w, x0+w] 内的最大值（自检"消光处确实没有峰"） */
  function winMax(xs, ys, x0, w) {
    var m = -Infinity, i;
    for (i = 0; i < xs.length; i++) {
      if (xs[i] < x0 - w || xs[i] > x0 + w) continue;
      if (ys[i] > m) m = ys[i];
    }
    return m === -Infinity ? 0 : m;
  }
  /** 序列中 |v| 的最大值（"曲线处处有限"自检：先判有限再用） */
  function maxAbs(ys) {
    var m = 0, i, v;
    for (i = 0; i < ys.length; i++) {
      v = ys[i];
      if (!isFinite(v)) return Infinity;
      if (Math.abs(v) > m) m = Math.abs(v);
    }
    return m;
  }
  /** 非有限元素计数（边界安全自检统一用它） */
  function countBad(arrays) {
    var bad = 0, i, j, a;
    for (j = 0; j < arrays.length; j++) {
      a = arrays[j];
      if (!a || !a.length) continue;
      for (i = 0; i < a.length; i++) if (!isFinite(a[i])) bad++;
    }
    return bad;
  }
  /** 首尾差分的数值导数（端点用单侧二阶差分），用于群速这类"从曲线现算"的量 */
  function dydx(y, h) {
    var n = y.length, out = [], i;
    if (n < 3) { for (i = 0; i < n; i++) out.push(0); return out; }
    for (i = 0; i < n; i++) {
      if (i === 0) out.push((-3 * y[0] + 4 * y[1] - y[2]) / (2 * h));
      else if (i === n - 1) out.push((3 * y[n - 1] - 4 * y[n - 2] + y[n - 3]) / (2 * h));
      else out.push((y[i + 1] - y[i - 1]) / (2 * h));
    }
    return out;
  }

  /* ==========================================================================
     1. lattice —— 晶格与布拉格衍射
     ========================================================================== */
  /**
   * 立方晶系的面间距（h,k,l 为整数，a 为立方晶格常数）：
   *     d_hkl = a / √(h² + k² + l²)                                    … 契约 ①
   * 布拉格条件（θ 为掠射角，n 为衍射级次）：
   *     2 d sinθ = n λ            ⇒  sinθ = nλ/(2d)，一级（n=1）给 2θ = 2 asin(λ/2d)
   * 结构因子（基元散射因子 f = 1，取原子在立方胞中的位置）：
   *     简立方：F = f                                   ⇒ 任何 (hkl) 都允许（|F| = 1）
   *     面心立方（4 个原子 000, ½½0, ½0½, 0½½）：
   *         F = f[1 + e^{iπ(h+k)} + e^{iπ(k+l)} + e^{iπ(h+l)}]
   *           = 4f  （h,k,l **全奇**或**全偶**）
   *           = 0   （h,k,l **奇偶混合** ⇒ 消光，无衍射峰）        … 契约 ③
   *     体心立方（2 个原子 000, ½½½）：
   *         F = f[1 + e^{iπ(h+k+l)}] = 2f（h+k+l **偶**）/ 0（**奇** ⇒ 消光） … 契约 ④
   * 相对强度（粉末德拜–谢乐谱的常用因子，f=1 时）：
   *     I_hkl ∝ |F|² · m_hkl · LP(θ)，  m 为多重度（立方晶系 {hkl} 等价面数），
   *     LP = (1 + cos²2θ)/(sin²θ cosθ)（洛伦兹–偏振因子）
   * 为什么绘图用高斯峰：真实粉末谱是 δ 峰，画成"强度随 2θ"的曲线时需要给一个唯象峰宽
   * （σ = 0.35°，纯显示用，不改变峰位与消光判据）。LP 在极低角处发散（θ→0），
   * 这里按显示需要截断到 50（info 里注明），否则 2θ 很小时单峰会把整张图压平。
   */
  var LA_OPTS = ["简立方", "面心立方", "体心立方"];
  var LA_LMAX = 5;                       // 枚举 0 ≤ h ≤ k ≤ l ≤ 5
  var LA_TT_MIN = 2, LA_TT_MAX = 150;    // 2θ 窗口（度）
  var LA_NG = 1481;                      // 网格点数 ⇒ 步长 0.1°
  var LA_SIGMA = 0.35;                   // 唯象峰宽（度）
  var LA_IMAX = 100;                     // 最强峰归一化到 100
  var LA_LP_CAP = 50;                    // LP 因子的显示上限
  var LA_WIN = 1.0;                      // 自检取窗半宽（度）

  /** F/f：结构因子（见上） */
  function laSF(h, k, l, ki) {
    var s = h + k + l;
    if (ki === 1) return (h % 2 === k % 2 && k % 2 === l % 2) ? 4 : 0;   // 全奇或全偶
    if (ki === 2) return (s % 2 === 0) ? 2 : 0;                          // h+k+l 偶
    return 1;                                                            // 简立方
  }
  /** 立方晶系 {hkl} 的多重度：排列数 × 2^(非零指标个数)（h ≤ k ≤ l 枚举时排列数只有 1/3/6） */
  function laMult(h, k, l) {
    var nz = (h > 0 ? 1 : 0) + (k > 0 ? 1 : 0) + (l > 0 ? 1 : 0);
    var perms = 6;
    if (h === l) perms = 1;                       // 三者全等（h ≤ k ≤ l 且 h = l）
    else if (h === k || k === l) perms = 3;       // 两个相等
    return perms * Math.pow(2, nz);
  }
  /** 洛伦兹–偏振因子 LP = (1+cos²2θ)/(sin²θ cosθ)（截断到 LA_LP_CAP，θ 用度） */
  function laLP(tt) {
    var th = tt * Math.PI / 360;
    var s = Math.sin(th), c = Math.cos(th);
    if (s < 1e-6) s = 1e-6;
    if (c < 1e-6) c = 1e-6;
    var c2 = Math.cos(2 * th);
    return clip((1 + c2 * c2) / (s * s * c), LA_LP_CAP);
  }
  /**
   * 枚举所有 (hkl)（0 ≤ h ≤ k ≤ l ≤ LA_LMAX，去掉 000），给出：
   *   d = a/√N（N = h²+k²+l²）、F/f、多重度 m、一级布拉格角 twoTheta（sinθ ≤ 1 时才算得出来）
   * 消光反射的 F = 0 ⇒ 强度恒为 0，曲线上不会出现峰（自检 ③④ 直接查这一点）。
   */
  function laRefl(a, ki, lam) {
    var out = [], h, k, l, N, d, st, tt;
    for (h = 0; h <= LA_LMAX; h++) {
      for (k = h; k <= LA_LMAX; k++) {
        for (l = k; l <= LA_LMAX; l++) {
          N = h * h + k * k + l * l;
          if (N === 0) continue;
          d = a / Math.sqrt(N);
          st = lam / (2 * d);                       // 一级 sinθ
          tt = st <= 1 ? 2 * Math.asin(st) * 180 / Math.PI : NaN;   // 一级 2θ（度）
          out.push({
            h: h, k: k, l: l, N: N, d: d, F: laSF(h, k, l, ki), m: laMult(h, k, l),
            s2: st * st, twoTheta: tt, Iraw: 0, I: 0
          });
        }
      }
    }
    return out;
  }
  /** 找 (hkl) 的反射记录（自检与读数共用）；枚举时按 0 ≤ h ≤ k ≤ l 存，所以查询也先排序 */
  function laFind(refl, h, k, l) {
    var q = [h, k, l].sort(function (u, v) { return u - v; }), i;
    for (i = 0; i < refl.length; i++) {
      if (refl[i].h === q[0] && refl[i].k === q[1] && refl[i].l === q[2]) return refl[i];
    }
    return null;
  }

  /** (hkl) 的书写形式：内部按 0 ≤ h ≤ k ≤ l 存，显示时倒过来写成习惯的 (hkl)（如 0,1,1 → (110)） */
  function laName(r) { return "(" + r.l + r.k + r.h + ")"; }
  function laCompute(p) {
    var name = opt(LA_OPTS, p.kind);
    var ki = LA_OPTS.indexOf(name);
    if (ki < 0) ki = 0;
    var a = clamp(num(p.a, 3), 0.5, 20);            // Å
    var lam = clamp(num(p.lambda, 1.54), 0.2, 20);  // Å（1.54 Å = Cu Kα1）
    var thDeg = clamp(num(p.theta, 30), 0, 90);     // 掠射角 θ（度）；0 与 90 都是合法边界
    var refl = laRefl(a, ki, lam);
    var i, j, n, r, maxI = 0, visN = 0, strongest = null;
    for (i = 0; i < refl.length; i++) {
      r = refl[i];
      if (r.F <= 0 || !isFinite(r.twoTheta) || r.twoTheta < LA_TT_MIN - 1 || r.twoTheta > LA_TT_MAX + 1) continue;
      r.Iraw = r.F * r.F * r.m * laLP(r.twoTheta);
      if (r.Iraw > maxI) maxI = r.Iraw;
      visN++;
    }
    var norm = maxI > 0 ? LA_IMAX / maxI : 1;
    var xs = lin(LA_TT_MIN, LA_TT_MAX, LA_NG), ys = [], stick = [], needle = [];
    for (i = 0; i < xs.length; i++) { ys.push(0); needle.push(0); }
    var six = 6 * LA_SIGMA, half = Math.ceil(six / (xs[1] - xs[0])) + 1;
    // stick 图：把每条谱线画成 (2θ,0)-(2θ,I)-(2θ,0) 三点，一条折线就能画出整张"火柴棍"图
    var markers = [], extMark = 0;
    for (i = 0; i < refl.length; i++) {
      r = refl[i];
      if (!isFinite(r.twoTheta) || r.twoTheta < LA_TT_MIN || r.twoTheta > LA_TT_MAX) continue;
      if (r.F <= 0) {                                  // 消光：在 0 高度画一个叉标记
        if (extMark < 6) {
          markers.push({ x: r.twoTheta, y: 0, label: laName(r) + " 消光" });
          extMark++;
        }
        continue;
      }
      r.I = r.Iraw * norm;
      if (!strongest || r.I > strongest.I) strongest = r;
      stick.push(r.twoTheta); stick.push(0);
      stick.push(r.twoTheta); stick.push(r.I);
      stick.push(r.twoTheta); stick.push(0);
      var c = nearestIndex(xs, r.twoTheta);
      for (j = Math.max(0, c - half); j <= Math.min(xs.length - 1, c + half); j++) {
        var dtt = xs[j] - r.twoTheta;
        if (Math.abs(dtt) < six) ys[j] += r.I * Math.exp(-dtt * dtt / (2 * LA_SIGMA * LA_SIGMA));
      }
    }
    var stickX = [], stickY = [];
    for (i = 0; i + 1 < stick.length; i += 2) { stickX.push(stick[i]); stickY.push(stick[i + 1]); }
    // 标出三个最强峰的名字（markers 不进图例，不会把图例撑爆）
    var order = [];
    for (i = 0; i < refl.length; i++) if (refl[i].I > 0) order.push(refl[i]);
    order.sort(function (p1, p2) { return p2.I - p1.I; });
    for (i = 0; i < order.length && i < 3; i++) {
      markers.push({ x: order[i].twoTheta, y: order[i].I, label: laName(order[i]) });
    }
    // 当前散射角：θ = 0 时 sinθ = 0，一级面间距 d = λ/(2sinθ) 数学上发散 ⇒ 只写读数不画
    var th = thDeg * Math.PI / 180, sinT = Math.sin(th);
    var dCur = sinT > 1e-9 ? lam / (2 * sinT) : Infinity;
    var ttCur = 2 * thDeg;
    var ci = nearestIndex(xs, ttCur), yCur = 0;
    if (ttCur >= LA_TT_MIN && ttCur <= LA_TT_MAX) {
      yCur = ys[ci];
      needle[ci] = LA_IMAX;                        // 全高"游标"：θ 滑块一动就能看见位置
      if (ci > 0) needle[ci - 1] = LA_IMAX;
      if (ci < xs.length - 1) needle[ci + 1] = LA_IMAX;
    }
    // 与当前角最接近的反射（含消光）＋ Bragg 条件 2d sinθ = nλ 的最佳匹配（只取允许反射）
    var near = null, nearDev = Infinity, match = null, matchDev = Infinity, matchN = 0;
    for (i = 0; i < refl.length; i++) {
      r = refl[i];
      if (isFinite(r.twoTheta)) {
        var dv = Math.abs(r.twoTheta - ttCur);
        if (dv < nearDev) { nearDev = dv; near = r; }
      }
      if (r.F > 0) {
        for (n = 1; n <= 6; n++) {
          var sn = n * lam / (2 * r.d);
          if (sn > 1) break;
          var tt2 = 2 * Math.asin(sn) * 180 / Math.PI;
          var dv2 = Math.abs(tt2 - ttCur);
          if (dv2 < matchDev) { matchDev = dv2; match = r; matchN = n; }
        }
      }
    }
    var r100 = laFind(refl, 1, 0, 0), d100 = r100 ? r100.d : a, tt100 = r100 ? r100.twoTheta : NaN;
    var crit = ki === 0 ? "所有 (hkl) 都允许（|F| = f）" :
      (ki === 1 ? "h,k,l 全奇或全偶 → |F| = 4f；奇偶混合 → F = 0（消光）" :
        "h+k+l 为偶 → |F| = 2f；为奇 → F = 0（消光）");
    var hv = [];
    for (i = 0; i < refl.length; i++) {
      r = refl[i];
      hv.push({
        h: r.h, k: r.k, l: r.l, N: r.N, d: r.d, F: r.F, m: r.m,
        F2: r.F * r.F, twoTheta: r.twoTheta, I: r.I
      });
    }
    return {
      t: xs,
      series: { I: ys, Icur: needle },
      info: [
        { k: "晶格类型", v: name + "（判据：" + crit + "）" },
        { k: "晶格常数 a / 波长 λ", v: fmt(a, 4) + " Å / " + fmt(lam, 4) + " Å（1.54 Å 即 Cu Kα₁）" },
        { k: "光子能量 hc/λ", v: fmt(HC_KEV_A / lam, 4) + " keV（hc = " + fmt(HC_KEV_A, 6) + " keV·Å）" },
        { k: "面间距 d_hkl = a/√(h²+k²+l²)", v: "(100) d = " + fmt(d100, 6) + " Å；(110) d = " +
          fmt(laFind(refl, 1, 1, 0) ? laFind(refl, 1, 1, 0).d : NaN, 6) + " Å；(111) d = " +
          fmt(laFind(refl, 1, 1, 1) ? laFind(refl, 1, 1, 1).d : NaN, 6) + " Å" },
        { k: "布拉格条件 2d sinθ = nλ", v: "(100) 一级：" + (isFinite(tt100) ? "θ = " + fmt(tt100 / 2, 5) +
          "°（2θ = " + fmt(tt100, 5) + "°）" : "λ > 2d，一级衍射不存在") },
        { k: "当前散射角 θ", v: fmt(thDeg, 3) + "°（2θ = " + fmt(ttCur, 3) + "°）" },
        { k: "当前角的面间距 d = λ/(2sinθ)", v: isFinite(dCur) ? fmt(dCur, 5) + " Å（一级）" : "θ → 0 时发散（无衍射几何）" },
        { k: "布拉格级次 n（当前角最佳匹配）", v: match ? laName(match) + " 的第 " + matchN +
          " 级：d = " + fmt(match.d, 5) + " Å，2θ = " +
          fmt(2 * Math.asin(clamp(matchN * lam / (2 * match.d), 0, 1)) * 180 / Math.PI, 5) +
          "°，与当前角差 " + fmt(matchDev, 4) + "°" + (matchDev > 0.5 ? "（当前角未命中布拉格条件）" : "（命中）") :
          "窗口内没有允许的反射" },
        { k: "最靠近当前角的反射", v: near ? laName(near) + " d = " + fmt(near.d, 5) +
          " Å，一级 2θ = " + fmt(near.twoTheta, 4) + "°，|F|² = " + fmt(near.F * near.F, 3) +
          (near.F > 0 ? " → 有峰" : " → 消光（结构因子为 0）") : "—" },
        { k: "当前角处的谱强度", v: fmt(yCur, 4) + "（归一化，最强峰 = 100）" },
        { k: "最强峰", v: strongest ? laName(strongest) + " 2θ = " +
          fmt(strongest.twoTheta, 4) + "°" : "该波长下没有可见反射（λ > 2d_max）" },
        { k: "窗口内可见反射数", v: String(visN) + " 条（2θ ∈ [" + fmt(LA_TT_MIN, 0) + "°, " + fmt(LA_TT_MAX, 0) + "°]）" },
        { k: "绘图约定", v: "相对强度 I ∝ |F|²·m·LP（散射因子取 f = 1，不随 sinθ/λ 衰减，所以高角峰偏强）；" +
          "高斯峰宽 σ = " + fmt(LA_SIGMA, 2) + "°、LP 截断到 " + fmt(LA_LP_CAP, 0) + " —— 都是显示约定，峰位与消光判据不受影响" }
      ],
      bars: strongest ? [
        { label: "最强峰 " + laName(strongest) + " 强度", value: LA_IMAX, color: "#5aa9ff" },
        { label: "当前角强度", value: yCur, color: "#ffb84d" }
      ] : [],
      extra: {
        lines: [{
          x: stickX, y: stickY,
          label: "各 (hkl) 相对强度 |F|²·m·LP（stick 图）", color: "#63d6a5"
        }],
        x: [], y: [],
        markers: markers,
        xlabel: "2θ（度）", ylabel: "相对强度",
        title: "衍射谱线（火柴棍图）：标记为消光反射（F = 0）与三个最强峰"
      },
      metrics: {
        a: a, lam: lam, theta: thDeg, kind: ki, name: name,
        twoth: xs, I: ys, needle: needle, stickX: stickX, stickY: stickY,
        d100: d100, tt100: tt100, dCur: dCur, ttCur: ttCur, yCur: yCur, visN: visN,
        strongest: strongest, maxI: maxI, refl: hv
      }
    };
  }

  SIM.register("lattice", {
    title: "晶格与布拉格衍射",
    legend: "X 射线打到晶体上，只有满足 2d·sinθ = nλ 的方向才有衍射；面心立方与体心立方还会因为" +
      "基元内多个原子的散射相互抵消而**消光**（FCC 的 (100)、(110) 与 BCC 的 (100)、(111) 都没有峰）。" +
      "拖动 θ 看游标扫过谱线：读数给出当前角对应的面间距、级次与是否消光。",
    axes: { xlabel: "2θ（度）", ylabel: "衍射强度（最强峰 = 100，虚线为当前 θ 的游标）" },
    params: {
      kind: { label: "晶格类型", type: "enum", options: LA_OPTS, def: 0 },
      a: { label: "晶格常数 a", unit: "Å", def: 3, min: 1, max: 8, step: 0.05 },
      lambda: { label: "波长 λ", unit: "Å", def: 1.54, min: 0.5, max: 5, step: 0.01 },
      theta: { label: "散射角 θ", unit: "°", def: 30, min: 5, max: 90, step: 0.5 }
    },
    plots: [
      { key: "I", label: "衍射强度 I(2θ)", color: "#5aa9ff" },
      { key: "Icur", label: "当前 2θ 游标", color: "#ff7b7b", dash: "2 3" }
    ],
    compute: laCompute,
    tests: [
      // ① 面间距：d_hkl = a/√(h²+k²+l²)，(100) ⇒ d = a/√1 = a = 3 Å（契约 ①，精确）
      { name: "面间距 d(100) = a/√(1²+0+0) = a = 3 Å",
        params: { kind: 0, a: 3, lambda: 1.54, theta: 30 },
        measure: function (o) { return o.metrics.d100; }, expect: 3, tol: 1e-12 },
      // ①b 逐点核对 d = a/√N（N = h²+k²+l² ≤ 14 的全部反射，含 FCC/BCC 中的消光面）
      { name: "逐点 d_hkl = a/√(h²+k²+l²)（N ≤ 14 的全部反射，容差 1e-12）",
        params: { kind: 0, a: 4.05, lambda: 1.54, theta: 30 },
        measure: function (o) {
          var m = 0, i, r, d;
          for (i = 0; i < o.metrics.refl.length; i++) {
            r = o.metrics.refl[i];
            if (r.N > 14) continue;
            d = Math.abs(r.d - o.metrics.a / Math.sqrt(r.N));
            if (d > m) m = d;
          }
          return m;
        }, expect: 0, tol: 1e-12 },
      // ② 布拉格条件 2d sinθ = nλ：d100 = 3 Å、λ = 1.54 Å 的一级衍射
      //    θ = asin(λ/2d) = asin(0.2566667) = 14.872365450170451°（契约写作 14.87°，容差 0.01°）
      //    measure 从**曲线**上现算：在解析峰位 ±2° 内找极大再做抛物线插值后取一半
      { name: "布拉格：a=3 Å 的 (100) 一级衍射角 θ = asin(λ/2a) = 14.8724°",
        params: { kind: 0, a: 3, lambda: 1.54, theta: 30 },
        measure: function (o) { return localPeakX(o.t, o.series.I, o.metrics.tt100, 2) / 2; },
        expect: 14.872365450170451, tol: 0.01 },
      // ②b 2d sinθ = λ 的恒等式（一级，全部可算的反射；θ 由 d 与 λ 解析给出）
      { name: "布拉格恒等式 2d·sinθ = nλ（一级，全部反射，容差 1e-12）",
        params: { kind: 0, a: 3, lambda: 1.54, theta: 30 },
        measure: function (o) {
          var m = 0, i, r, dev;
          for (i = 0; i < o.metrics.refl.length; i++) {
            r = o.metrics.refl[i];
            if (!isFinite(r.twoTheta)) continue;
            dev = Math.abs(2 * r.d * Math.sin(r.twoTheta * Math.PI / 360) - o.metrics.lam);
            if (dev > m) m = dev;
          }
          return m;
        }, expect: 0, tol: 1e-12 },
      // ③ FCC 结构因子：F = f[1+e^{iπ(h+k)}+e^{iπ(k+l)}+e^{iπ(h+l)}] ⇒ 全奇/全偶时 |F| = 4f、奇偶混合时 F = 0
      //    (100) k+l=0 偶但 h+k=1 奇 ⇒ 混合 ⇒ 0；(110) 同理 ⇒ 0；(210) ⇒ 0；(211) ⇒ 0
      //    允许面 (111)、(200)、(220)、(311) 的 |F|² = 16
      { name: "FCC：奇偶混合面 |F|² = 0，(111)/(200)/(220)/(311) 的 |F|² = 16",
        params: { kind: 1, a: 3, lambda: 1.54, theta: 30 },
        measure: function (o) {
          var bad = 0, i, r, mix = [[1, 0, 0], [1, 1, 0], [2, 1, 0], [2, 1, 1]], ok = [[1, 1, 1], [2, 0, 0], [2, 2, 0], [3, 1, 1]];
          for (i = 0; i < o.metrics.refl.length; i++) {
            r = o.metrics.refl[i];
            if (mix.some(function (q) { return q[0] === r.h && q[1] === r.k && q[2] === r.l; })) bad += r.F2;
            if (ok.some(function (q) { return q[0] === r.h && q[1] === r.k && q[2] === r.l; })) bad += Math.abs(r.F2 - 16);
          }
          return bad;
        }, expect: 0, tol: 0 },
      // ③b 消光面在**曲线上**确实没有峰：(100) 与 (110) 的一级 2θ 处强度为 0
      { name: "FCC 消光面 (100)/(110) 的 2θ 处曲线强度 = 0",
        params: { kind: 1, a: 3, lambda: 1.54, theta: 30 },
        measure: function (o) {
          var m = 0, i, r, v;
          for (i = 0; i < o.metrics.refl.length; i++) {
            r = o.metrics.refl[i];
            if (!(r.N === 1 || r.N === 2) || !isFinite(r.twoTheta)) continue;
            v = winMax(o.t, o.series.I, r.twoTheta, LA_WIN);
            if (v > m) m = v;
          }
          return m;
        }, expect: 0, tol: 1e-12 },
      // ④ BCC 结构因子：F = f[1+e^{iπ(h+k+l)}] ⇒ h+k+l 偶时 |F| = 2f、奇时 0
      //    (100)、(111)、(210)、(311) 的 h+k+l = 1,3,3,5 全为奇 ⇒ 0；(110)、(200)、(211)、(220) 为偶 ⇒ |F|² = 4
      { name: "BCC：h+k+l 为奇的面 |F|² = 0，(110)/(200)/(211)/(220) 的 |F|² = 4",
        params: { kind: 2, a: 3, lambda: 1.54, theta: 30 },
        measure: function (o) {
          var bad = 0, i, r, odd = [[1, 0, 0], [1, 1, 1], [2, 1, 0], [3, 1, 1]], even = [[1, 1, 0], [2, 0, 0], [2, 1, 1], [2, 2, 0]];
          for (i = 0; i < o.metrics.refl.length; i++) {
            r = o.metrics.refl[i];
            if (odd.some(function (q) { return q[0] === r.h && q[1] === r.k && q[2] === r.l; })) bad += r.F2;
            if (even.some(function (q) { return q[0] === r.h && q[1] === r.k && q[2] === r.l; })) bad += Math.abs(r.F2 - 4);
          }
          return bad;
        }, expect: 0, tol: 0 },
      // ④b BCC 消光面在曲线上没有峰：(100) 与 (111) 的一级 2θ 处强度 = 0
      { name: "BCC 消光面 (100)/(111) 的 2θ 处曲线强度 = 0",
        params: { kind: 2, a: 3, lambda: 1.54, theta: 30 },
        measure: function (o) {
          var m = 0, i, r, v;
          for (i = 0; i < o.metrics.refl.length; i++) {
            r = o.metrics.refl[i];
            if (!(r.N === 1 || r.N === 3) || !isFinite(r.twoTheta)) continue;
            v = winMax(o.t, o.series.I, r.twoTheta, LA_WIN);
            if (v > m) m = v;
          }
          return m;
        }, expect: 0, tol: 1e-12 },
      // ⑤ 简立方：F = f ⇒ 任何 (hkl) 的 |F|² = 1（对照实验：消光完全来自基元，不是晶格本身）
      { name: "简立方：所有 (hkl) 的 |F|² = 1（无消光）",
        params: { kind: 0, a: 3, lambda: 1.54, theta: 30 },
        measure: function (o) {
          var m = 0, i, d;
          for (i = 0; i < o.metrics.refl.length; i++) {
            d = Math.abs(o.metrics.refl[i].F2 - 1);
            if (d > m) m = d;
          }
          return m;
        }, expect: 0, tol: 0 },
      // ⑥ 边界安全：θ = 0°/90°、a 与 λ 顶到两端时曲线与读数都不出 NaN/Infinity
      //    （θ = 0 时 d = λ/(2sinθ) 数学上发散，读数写作"—"，曲线不受影响）
      { name: "边界：θ = 0°/90°、a = 0.5/20 Å、λ = 0.2/20 Å 时全部曲线有限",
        params: { kind: 1, a: 0.5, lambda: 20, theta: 0 },
        measure: function (o) {
          var bad = countBad([o.series.I, o.series.Icur, o.metrics.stickX, o.metrics.stickY]);
          if (isNaN(o.metrics.dCur)) bad++;            // θ=0 允许是 +Infinity（读数写"—"），但不允许 NaN
          var o2 = laCompute({ kind: 2, a: 20, lambda: 0.2, theta: 90 });
          bad += countBad([o2.series.I, o2.series.Icur, o2.metrics.stickX, o2.metrics.stickY]);
          if (!isFinite(o2.metrics.dCur)) bad++;
          var o3 = laCompute({ kind: 0, a: 8, lambda: 0.5, theta: 1 });
          bad += countBad([o3.series.I, o3.series.Icur]);
          return bad;
        }, expect: 0, tol: 0 }
    ]
  });

  /* ==========================================================================
     2. phonon —— 一维晶格振动色散
     ========================================================================== */
  /**
   * 一维单原子链（质量 m、最近邻力常数 K、晶格常数 a）：运动方程给
   *     ω(q) = 2√(K/m)·|sin(qa/2)|，   q ∈ [0, π/a]（第一布里渊区一半）    … 契约 ①
   *   · q = π/a 处取最大值 ω_max = 2√(K/m)（相邻原子反相）                  … 契约 ②
   *   · 长波极限 q → 0：ω ≈ a√(K/m)·q ⇒ 声速 v_s = a√(K/m)（线性色散=声波） … 契约 ③
   *
   * 一维双原子链（m₁ < m₂、晶格常数 a 含两个原子、同一 K）：
   *     ω²± = K(1/m₁ + 1/m₂) ± K√[(1/m₁ + 1/m₂)² − (4/(m₁m₂))sin²(qa/2)]
   *   取"−"为声学支（q=0 时 ω = 0：两原子同向平移）、"+"为光学支：
   *     q = 0：  ω₋ = 0，ω₊ = √(2K(1/m₁ + 1/m₂))                            … 契约 ④
   *     q = π/a：声学支顶 = √(2K/m_重)，光学支底 = √(2K/m_轻)（m_重 = max(m₁,m₂)）
   *              ⇒ 两者之间是**带隙**，晶格不能传播这段频率的波              … 契约 ⑤
   *   当 m₁ = m₂ 时两支在 q = π/a 处退化（带隙闭合），双原子链回到单原子链
   *   （把 a 折半后的折叠图像）：ω₊ = 2√(K/m)cos(qa/4)、ω₋ = 2√(K/m)sin(qa/4)。
   *
   * 单位：取 a = 1、ω 以 √(K/m₁) 为单位 ⇒ 公式里不需要任何物理常量。
   * 带隙与两支的判别只依赖 m₁、m₂ 的大小关系，所以 m₁ > m₂ 时"重原子"自动是 m₁。
   */
  var PH_OPTS = ["单原子链", "双原子链"];
  var PH_N = 601;        // q 网格点数（含 0 与 π/a）
  var PH_A = 1;          // 晶格常数（长度单位，取 1）

  /** 单原子链色散 ω(q) = 2√(K/m)|sin(qa/2)| */
  function phMono(q, m, K) { return 2 * Math.sqrt(K / m) * Math.abs(Math.sin(q * PH_A / 2)); }
  /** 双原子链两支：ω²± = K(1/m₁+1/m₂) ± K√[(1/m₁+1/m₂)² − 4sin²(qa/2)/(m₁m₂)] */
  function phDia(q, m1, m2, K) {
    var s = Math.sin(q * PH_A / 2);
    s = s * s;
    var A = K * (1 / m1 + 1 / m2);
    var disc = A * A - K * K * 4 * s / (m1 * m2);
    if (!(disc > 0)) disc = 0;                       // 浮点保护：m₁ = m₂、q = π/a 处判别式恰为 0
    var rt = Math.sqrt(disc);
    var ac = A - rt, op = A + rt;
    return { ac: Math.sqrt(ac > 0 ? ac : 0), op: Math.sqrt(op > 0 ? op : 0) };
  }

  function phCompute(p) {
    var name = opt(PH_OPTS, p.kind);
    var ki = PH_OPTS.indexOf(name);
    if (ki < 0) ki = 0;
    var m1 = clamp(num(p.m1, 1), 1e-3, 1e3);
    var m2 = clamp(num(p.m2, 2), 1e-3, 1e3);
    var K = clamp(num(p.K, 1), 1e-6, 1e6);
    var qs = lin(0, Math.PI / PH_A, PH_N), ac = [], op = [], i, q, w;
    for (i = 0; i < qs.length; i++) {
      q = qs[i];
      if (ki === 0) {
        ac.push(phMono(q, m1, K));
      } else {
        w = phDia(q, m1, m2, K);
        ac.push(w.ac); op.push(w.op);
      }
    }
    if (ki === 0) op = [];                           // 单原子链只有一支（空数组不会被画出来）
    var mHeavy = Math.max(m1, m2), mLight = Math.min(m1, m2);
    var wMonoMax = 2 * Math.sqrt(K / m1);            // 单原子链（质量取 m₁）
    var wAcTop = Math.sqrt(2 * K / mHeavy);          // 双原子链声学支顶（q = π/a）
    var wOpBot = Math.sqrt(2 * K / mLight);          // 双原子链光学支底（q = π/a）
    var wOpZero = Math.sqrt(2 * K * (1 / m1 + 1 / m2));   // 光学支在 q = 0 的值
    var gap = ki === 0 ? 0 : (wOpBot - wAcTop);
    // 长波声速：ω(q)/q 的 q → 0 极限。ω/q = v(1 + c₂q² + …) 只含 q 的偶次幂，
    // 所以用两个网格点做 Richardson 外推 v ≈ (4r₁ − r₂)/3（r 为 ω/q），误差 O(q⁴) ≈ 1e-12。
    var vsLocal = null, r1 = ac[1] / qs[1], r2 = ac[2] / qs[2];
    vsLocal = (4 * r1 - r2) / 3;
    var vsExact = ki === 0 ? PH_A * Math.sqrt(K / m1) : PH_A * Math.sqrt(K / (2 * (m1 + m2)));
    // 群速 v_g = dω/dq（从色散曲线现算；长波极限即声速）
    var h = qs[1] - qs[0];
    var vg = dydx(ac, h), vg2 = op.length ? dydx(op, h) : [];
    var hv = [];
    for (i = 0; i < ac.length; i++) hv.push({ q: qs[i], ac: ac[i], op: op.length ? op[i] : 0 });
    var lines = [{ x: qs, y: vg, label: "声学支 v_g = dω/dq", color: "#5aa9ff" }];
    if (vg2.length) lines.push({ x: qs, y: vg2, label: "光学支 v_g = dω/dq", color: "#ff7b7b" });
    return {
      t: qs,
      series: { omega: ac, omegaOpt: op },
      info: [
        { k: "模型", v: name + "（a = 1，ω 的单位为 √(K/m₁)）" },
        { k: "原子质量 m₁ / m₂", v: fmt(m1, 4) + " / " + fmt(m2, 4) + (ki === 0 ? "（单原子链只用 m₁）" : "") },
        { k: "力常数 K", v: fmt(K, 4) + "（相邻原子间的弹簧常数）" },
        { k: "布里渊区边界 q = π/a", v: fmt(Math.PI / PH_A, 6) },
        { k: "ω(q=π/a)：声学支顶 / 光学支底", v: ki === 0 ? fmt(wMonoMax, 6) + "（单原子链 ω_max = 2√(K/m₁)）" :
          fmt(wAcTop, 6) + " / " + fmt(wOpBot, 6) + "（= √(2K/m_重)、√(2K/m_轻)）" },
        { k: "带隙 Δω（光学支底 − 声学支顶）", v: fmt(gap, 6) + (gap > 0 ? "（该频段不能传播——晶格振动的禁带）" : "（m₁ = m₂，带隙闭合）") },
        { k: "光学支 q = 0 的值", v: ki === 0 ? "—（单原子链没有光学支）" : fmt(wOpZero, 6) + " = √(2K(1/m₁+1/m₂))" },
        { k: "长波声速 v_s = a√(K/m)", v: ki === 0 ? fmt(vsExact, 6) + "（解析）" :
          fmt(vsExact, 6) + " = a√(K/(2(m₁+m₂)))（解析）" },
        { k: "从曲线现算的声速（Richardson 外推）", v: fmt(vsLocal, 8) },
        { k: "q = 0 处声学支", v: fmt(ac[0], 8) + "（两原子同向平移 ⇒ 刚体平移，无回复力）" },
        { k: "最大频率", v: fmt(ki === 0 ? wMonoMax : wOpBot, 6) }
      ],
      bars: ki === 0 ? [
        { label: "ω_max = 2√(K/m₁)", value: wMonoMax, color: "#5aa9ff" },
        { label: "带隙（单原子链为 0）", value: 0, color: "#ff7b7b" }
      ] : [
        { label: "声学支顶 √(2K/m_重)", value: wAcTop, color: "#5aa9ff" },
        { label: "光学支底 √(2K/m_轻)", value: wOpBot, color: "#63d6a5" },
        { label: "带隙 Δω", value: gap, color: "#ff7b7b" }
      ],
      extra: {
        lines: lines,
        x: [], y: [],
        xlabel: "q（1/a 单位，0 → π/a）", ylabel: "群速 v_g = dω/dq",
        title: "群速：长波极限给出声速 v_s = a√(K/m)；布里渊区边界处 v_g → 0（驻波）"
      },
      metrics: {
        qs: qs, omega: ac, omegaOpt: op, vg: vg, m1: m1, m2: m2, K: K, kind: ki, name: name,
        wMonoMax: wMonoMax, wAcTop: wAcTop, wOpBot: wOpBot, wOpZero: wOpZero, gap: gap,
        vsLocal: vsLocal, vsExact: vsExact, mHeavy: mHeavy, mLight: mLight, a: PH_A
      }
    };
  }

  SIM.register("phonon", {
    title: "一维晶格振动色散 ω(q)",
    legend: "晶格不是刚体：原子靠 K 相互耦合，把位移写成行波就得到色散 ω(q)。单原子链是一条" +
      "|sin| 型曲线（长波极限线性、声速 v_s = a√(K/m)）；双原子链裂成声学支与光学支，" +
      "两支之间出现**带隙**——落在带隙里的频率无法在晶格中传播。",
    axes: { xlabel: "q（1/a 单位，0 → π/a）", ylabel: "ω（√(K/m₁) 单位）" },
    params: {
      kind: { label: "链类型", type: "enum", options: PH_OPTS, def: 0 },
      m1: { label: "原子质量 m₁", unit: "", def: 1, min: 0.5, max: 3, step: 0.05 },
      m2: { label: "原子质量 m₂", unit: "", def: 2, min: 0.5, max: 3, step: 0.05 },
      K: { label: "力常数 K", unit: "", def: 1, min: 0.2, max: 3, step: 0.05 }
    },
    plots: [
      { key: "omega", label: "声学支 ω₋(q)", color: "#5aa9ff" },
      { key: "omegaOpt", label: "光学支 ω₊(q)", color: "#ff7b7b", dash: "6 4" }
    ],
    compute: phCompute,
    tests: [
      // ① 逐点核对 ω(q) = 2√(K/m₁)|sin(qa/2)|（a = 1；契约容差 1e-9）
      { name: "单原子链逐点 ω(q) = 2√(K/m)|sin(qa/2)|（容差 1e-9）",
        params: { kind: 0, m1: 1, m2: 2, K: 1 },
        measure: function (o) {
          var m = 0, i, d, t = o.metrics;
          for (i = 0; i < o.t.length; i++) {
            d = Math.abs(o.series.omega[i] - 2 * Math.sqrt(t.K / t.m1) * Math.abs(Math.sin(o.t[i] * t.a / 2)));
            if (d > m) m = d;
          }
          return m;
        }, expect: 0, tol: 1e-9 },
      // ② q = π/a 处 ω_max = 2√(K/m) = 2（m = K = 1，精确）
      { name: "单原子链 ω_max = 2√(K/m) = 2（q = π/a，精确）",
        params: { kind: 0, m1: 1, m2: 2, K: 1 },
        measure: function (o) { return o.series.omega[o.series.omega.length - 1]; },
        expect: 2, tol: 1e-12 },
      // ③ 长波声速 v_s = a√(K/m) = 1：从曲线上做 Richardson 外推（ω/q = v(1 + c₂q² + …)，
      //    故 v ≈ (4r₁ − r₂)/3），残余误差 O(q⁴) ≈ 1e-12，容差 1e-6 富余极大
      { name: "长波声速 v_s = a√(K/m) = 1（从 ω/q 外推，容差 1e-6）",
        params: { kind: 0, m1: 1, m2: 2, K: 1 },
        measure: function (o) { return o.metrics.vsLocal; }, expect: 1, tol: 1e-6 },
      // ④ 双原子链 q = 0：声学支 ω = 0（两原子同向平移）；光学支 ω = √(2K(1/m₁+1/m₂)) = √3
      { name: "双原子链 q=0：声学支 ω = 0（精确）",
        params: { kind: 1, m1: 1, m2: 2, K: 1 },
        measure: function (o) { return o.series.omega[0]; }, expect: 0, tol: 1e-15 },
      { name: "双原子链 q=0：光学支 ω = √(2K(1/m₁+1/m₂)) = √3 = 1.7320508075688772",
        params: { kind: 1, m1: 1, m2: 2, K: 1 },
        measure: function (o) { return o.series.omegaOpt[0]; }, expect: 1.7320508075688772, tol: 1e-9 },
      // ④b 双原子链两支逐点等于闭式（声学支取 − 根、光学支取 + 根，容差 1e-12）
      { name: "双原子链逐点 = K(1/m₁+1/m₂) ± K√[(1/m₁+1/m₂)²−4sin²(qa/2)/(m₁m₂)]（容差 1e-12）",
        params: { kind: 1, m1: 0.7, m2: 2.4, K: 1.3 },
        measure: function (o) {
          var m = 0, i, q, A, disc, rt, d, t = o.metrics;
          for (i = 0; i < o.t.length; i++) {
            q = o.t[i];
            A = t.K * (1 / t.m1 + 1 / t.m2);
            disc = A * A - t.K * t.K * 4 * Math.pow(Math.sin(q * t.a / 2), 2) / (t.m1 * t.m2);
            rt = Math.sqrt(disc > 0 ? disc : 0);
            d = Math.abs(o.series.omega[i] - Math.sqrt(Math.max(0, A - rt)));
            if (d > m) m = d;
            d = Math.abs(o.series.omegaOpt[i] - Math.sqrt(Math.max(0, A + rt)));
            if (d > m) m = d;
          }
          return m;
        }, expect: 0, tol: 1e-12 },
      // ⑤ 带隙：q = π/a 处 光学支底 − 声学支顶 = √(2K/m₁) − √(2K/m₂)（m₁ < m₂）
      //    = √2 − 1 = 0.41421356237309515 > 0
      { name: "双原子链带隙 = √(2K/m₁) − √(2K/m₂) = √2 − 1 = 0.4142135623730951 > 0",
        params: { kind: 1, m1: 1, m2: 2, K: 1 },
        measure: function (o) {
          var n = o.series.omega.length - 1;
          return o.series.omegaOpt[n] - o.series.omega[n];
        }, expect: 0.41421356237309515, tol: 1e-9 },
      // ⑤b m₁ = m₂ 时带隙闭合（双原子链退化为单原子链的折叠图像）：
      //    此时两支在 q = π/a 处相等 = √(2K/m)，差恒为 0
      { name: "m₁ = m₂ = 1 时带隙闭合：ω₊(π/a) − ω₋(π/a) = 0（容差 1e-12）",
        params: { kind: 1, m1: 1, m2: 1, K: 1 },
        measure: function (o) {
          var n = o.series.omega.length - 1;
          return Math.abs(o.series.omegaOpt[n] - o.series.omega[n]) + Math.abs(o.metrics.gap);
        }, expect: 0, tol: 1e-12 },
      // ⑤c 双原子链的长波声速 v_s = a√(K/(2(m₁+m₂)))，同样从曲线 Richardson 外推
      { name: "双原子链长波声速 v_s = a√(K/(2(m₁+m₂))) = √(1/6) = 0.4082482904638631",
        params: { kind: 1, m1: 1, m2: 2, K: 1 },
        measure: function (o) { return o.metrics.vsLocal; }, expect: 0.4082482904638631, tol: 1e-6 },
      // ⑥ 边界安全：m₁ = m₂（判别式恰为 0）、质量比极端、K 顶到两端时曲线全部有限
      { name: "边界：m₁ = m₂、m₁ ≫ m₂ 与 m₁ ≪ m₂、K = 0.2/3 时两条曲线全部有限",
        params: { kind: 1, m1: 0.5, m2: 0.5, K: 3 },
        measure: function (o) {
          var bad = countBad([o.series.omega, o.series.omegaOpt, o.metrics.vg]);
          var a1 = phCompute({ kind: 1, m1: 3, m2: 0.5, K: 0.2 });
          var a2 = phCompute({ kind: 1, m1: 0.5, m2: 3, K: 3 });
          var a3 = phCompute({ kind: 0, m1: 0.5, m2: 3, K: 0.2 });
          bad += countBad([a1.series.omega, a1.series.omegaOpt, a2.series.omega, a2.series.omegaOpt, a3.series.omega]);
          return bad;
        }, expect: 0, tol: 0 }
    ]
  });

  /* ==========================================================================
     3. band —— 能带与态密度
     ========================================================================== */
  /**
   * ① 一维紧束缚（最近邻跃迁 t，晶格常数 a）：
   *      E(k) = −2t·cos(ka)，  ka ∈ [0, π]（第一布里渊区一半，另一半镜像） … 契约 ①
   *    带宽 W = E(π) − E(0) = 2t − (−2t) = 4t，带底 E(0) = −2t；
   *    态密度（每格点 2 个自旋态、a = 1）：
   *      g(E) = 2/(π√(4t² − E²))   ⇒ 带边 E → ±2t 处 1/√ 型发散（van Hove 奇点） … 契约 ③
   *    半填充（每格点 1 个电子）时 g(E) 关于 E = 0 对称 ⇒ E_F = 0（精确）       … 契约 ②
   *
   * ② Kronig-Penney（δ 势垒强度 P，等价于 P = mV₀ab/ħ²）的无量纲形式（x = αa ∝ √E）：
   *      cos(ka) = f(x) = cos x + P·sin x / x
   *    允许带由 |f(x)| ≤ 1 给出，其余是**禁带**；能量 ε = x²（单位 ħ²/(2ma²)）。
   *    P = 0 时 f = cos x，禁带宽度为 0，带边落在 x = nπ ⇒ ε = n²π²（自由电子的折叠图像）；
   *    P 越大禁带越宽（与原胞内势垒把能级推开的物理一致）。                    … 契约 ④
   *    能量标尺：ħ²/(2 m_e a²)，取 a = 3 Å 得 0.4233 eV —— 用来把 ε 换算成 eV。
   *
   * 主图横轴是 ka（这是 E–k 色散的自然横轴），所以 DOS 这条曲线是"沿色散曲线取样的态密度"
   * g(E(ka))：带边处能直接看到 1/√ 尖峰。真正的 g(E) 画在第二张图（横轴＝能量）。
   */
  var BD_OPTS = ["紧束缚（一维）", "Kronig-Penney"];
  var BD_KMAX = Math.PI;              // ka ∈ [0, π]
  var BD_DOS_N = 601;                 // g(E) 面板的能量网格点数
  var BD_DOS_CAP_X = 4;               // g(E) 的显示截断倍数（× 带中心值）
  var BD_ANCH = [0.5, 1.5, 1.9];      // g(E) 网格里的精细锚点（E/t 单位）
  var BD_KP_XMAX = 3.45 * Math.PI;    // KP 找带边的 x = αa 上限（要装下 3 条带）
  var BD_KP_NB = 3;                   // KP 显示 3 条带
  var BD_KP_EDGE_N = 4000;            // KP 带边粗扫描点数
  var BD_HIST_BINS = 240;             // KP 态密度直方图的格数
  var BD_KP_A_REF = 3e-10;            // 能量标尺的参照晶格常数 a = 3 Å（m）

  /** 紧束缚 E(k) = −2t·cos(ka) */
  function bdTB(k, t) { return -2 * t * Math.cos(k); }
  /** 紧束缚态密度 g(E) = 2/(π√(4t²−E²))（带外返回 +Infinity，画图前截断） */
  function bdTBDos(E, t) {
    var x = 4 * t * t - E * E;
    if (!(x > 0)) return Infinity;
    return 2 / (Math.PI * Math.sqrt(x));
  }
  /** kronig-Penney 的 f(x) = cos x + P sin x / x（x = αa；x → 0 的极限是 1 + P） */
  function bdKPF(x, P) {
    if (x === 0) return 1 + P;
    return Math.cos(x) + P * Math.sin(x) / x;
  }
  function bdKPAbs(x, P) { return Math.abs(bdKPF(x, P)); }
  /** f 的导数 f'(x) = −sin x + P(x cos x − sin x)/x²（x → 0 时 → 0，不会发散） */
  function bdKPDeriv(x, P) {
    if (x < 1e-9) return 0;
    return -Math.sin(x) + P * (x * Math.cos(x) - Math.sin(x)) / (x * x);
  }
  /**
   * 用 f'(x) = 0 把"切触型"带边（|f| 的局部极大）精修到机器精度。
   * 为什么需要它：P = 0 时 |f| = |cos x| 在 x = nπ 处的极大值**恰好**是 1，
   * 而 |f| = 1 − δ²/2 在 δ ≲ 1e-8 时已经是浮点意义下的 1 —— 靠比较函数值只能定位到 1e-10；
   * 改求导数零点（f' 在极值两侧严格异号）可以精确到 ~1e-16。
   */
  function bdKPPolishMax(P, xm, h) {
    var lo = xm - h, hi = xm + h, i, mid, s;
    if (!(lo > 0 && hi > 0)) return xm;
    s = bdKPDeriv(lo, P) > 0 ? 1 : -1;
    if (bdKPDeriv(hi, P) * s > 0) return xm;              // 两端同号：不是极值，放弃精修
    for (i = 0; i < 90; i++) {
      mid = 0.5 * (lo + hi);
      if (bdKPDeriv(mid, P) * s > 0) lo = mid; else hi = mid;
    }
    return 0.5 * (lo + hi);
  }
  /**
   * 抛物线顶点迭代：求 |f| 在 (lo,hi) 内的极大点，并返回迭代过程中遇到的最好点。
   * 为什么不用三分法：在极大附近 |f| ≈ 1 − c·δ²，三分法受浮点"平台"限制只能收敛到 δ ~ 1e-8；
   * 抛物线拟合利用三点曲率，精度能到机器精度（P = 0 时带边必须严格落在 x = nπ）。
   * 三点公式用**非等距**的一般形式（迭代后区间不再对称，等距公式会给出错误顶点）。
   */
  function bdRefineMax(P, lo, hi, iters) {
    var x0 = lo, x2 = hi, x1 = 0.5 * (lo + hi), i, y0, y1, y2, num, den, xn;
    var bx = x1, by = bdKPAbs(x1, P);
    for (i = 0; i < iters; i++) {
      y0 = bdKPAbs(x0, P); y1 = bdKPAbs(x1, P); y2 = bdKPAbs(x2, P);
      if (y1 > by) { by = y1; bx = x1; }
      num = (x1 - x0) * (x1 - x0) * (y1 - y2) - (x1 - x2) * (x1 - x2) * (y1 - y0);
      den = (x1 - x0) * (y1 - y2) - (x1 - x2) * (y1 - y0);
      if (den === 0 || !isFinite(den)) break;
      xn = x1 - 0.5 * num / den;
      if (!(xn > x0 && xn < x2) || Math.abs(xn - x1) < 1e-16 * (1 + Math.abs(x1))) break;
      if (xn > x1) { x0 = x1; x1 = xn; } else { x2 = x1; x1 = xn; }
    }
    y1 = bdKPAbs(x1, P);
    if (y1 > by) { by = y1; bx = x1; }
    return bx;
  }
  /**
   * KP 的"带边"横坐标集合：
   *   · |f| − 1 的变号点（横穿型带边，二分求根）；
   *   · |f| 的局部极大且 |f|max ≥ 1 − 1e-9（切触型带边，例如 P = 0 时的 x = nπ）。
   * 两者合并排序后，相邻两点之间要么是允许带（中点 |f| < 1）要么是禁带。
   */
  function bdKPEdges(P) {
    var N = BD_KP_EDGE_N, i, j, x, g0, g1, lo, hi, mid;
    var edges = [0], xs = [];
    for (i = 0; i <= N; i++) xs.push(BD_KP_XMAX * i / N);
    g0 = bdKPAbs(xs[0], P) - 1;
    for (i = 0; i < N; i++) {
      g1 = bdKPAbs(xs[i + 1], P) - 1;
      if (g0 * g1 < 0) {
        lo = xs[i]; hi = xs[i + 1];
        for (j = 0; j < 60; j++) {
          mid = 0.5 * (lo + hi);
          if ((bdKPAbs(lo, P) - 1) * (bdKPAbs(mid, P) - 1) <= 0) hi = mid; else lo = mid;
        }
        edges.push(0.5 * (lo + hi));
      }
      g0 = g1;
    }
    for (i = 1; i < N; i++) {
      if (bdKPAbs(xs[i], P) >= bdKPAbs(xs[i - 1], P) && bdKPAbs(xs[i], P) >= bdKPAbs(xs[i + 1], P)) {
        x = bdRefineMax(P, xs[i - 1], xs[i + 1], 60);
        x = bdKPPolishMax(P, x, 0.2 * (xs[i + 1] - xs[i - 1]));
        if (bdKPAbs(x, P) >= 1 - 1e-9) edges.push(x);
      }
    }
    edges.push(BD_KP_XMAX);
    edges.sort(function (u, v) { return u - v; });
    var out = [];
    for (i = 0; i < edges.length; i++) {
      if (!out.length || edges[i] - out[out.length - 1] > 1e-7) out.push(edges[i]);
    }
    return out;
  }
  /** 允许带 [x_lo, x_hi]（能量 ε = x²），最多 maxB 条 */
  function bdKPBands(P, maxB) {
    var e = bdKPEdges(P), out = [], i, mid;
    for (i = 0; i + 1 < e.length && out.length < maxB; i++) {
      mid = 0.5 * (e[i] + e[i + 1]);
      if (bdKPAbs(mid, P) < 1 && e[i + 1] - e[i] > 1e-9) out.push([e[i], e[i + 1]]);
    }
    return out;
  }
  /**
   * 带内解 f(x) = cos(ka)：带内 f 单调（但不一定递减——自由电子折叠图像里
   * 第 2 条带的最小值在布里渊区边界 ka = π/a 上，于是 f 从 −1 升到 +1）。
   * 所以这里对 g(x) = f(x) − cos(ka) 做**不分方向**的二分：只要两端异号就能收敛。
   */
  function bdKPSolveX(band, P, ka) {
    var target = Math.cos(ka), lo = band[0], hi = band[1], i, mid, glo, ghi, s;
    glo = bdKPF(lo, P) - target;
    ghi = bdKPF(hi, P) - target;
    if (glo === 0) return lo;
    if (ghi === 0) return hi;
    // 退化保护：ka = 0 或 π 时目标值 ±1 与带边只差浮点舍入（如 f(带顶) = 1 − 1.1e-16），
    // 两端可能同号 —— 此时取"函数值离 target 更近"的那个端点（不是 |f| 更大的那个）。
    if (glo * ghi > 0) return Math.abs(glo) < Math.abs(ghi) ? lo : hi;
    s = glo > 0 ? 1 : -1;
    for (i = 0; i < 90; i++) {
      mid = 0.5 * (lo + hi);
      if ((bdKPF(mid, P) - target) * s > 0) lo = mid; else hi = mid;
    }
    return 0.5 * (lo + hi);
  }
  /** 直方图 + 高斯平滑（KP 的数值态密度；总和归一化到 2 个自旋态 × 带数） */
  function bdHist(vals, lo, hi, bins) {
    var cnt = [], g = [], i, k, idx, out = [];
    for (i = 0; i < bins; i++) { cnt.push(0); g.push(lo + (hi - lo) * (i + 0.5) / bins); }
    var dE = (hi - lo) / bins;
    if (!(dE > 0)) dE = 1;
    for (i = 0; i < vals.length; i++) {
      idx = Math.floor((vals[i] - lo) / dE);
      if (idx < 0) idx = 0;
      if (idx >= bins) idx = bins - 1;
      cnt[idx]++;
    }
    var sig = 2, rad = 4 * sig, tot = 0, ker = [], s;
    for (k = -rad; k <= rad; k++) { s = Math.exp(-k * k / (2 * sig * sig)); ker.push(s); tot += s; }
    var scale = 0;
    for (i = 0; i < bins; i++) scale += cnt[i];
    var norm = scale > 0 ? (2 * BD_KP_NB) / (scale * dE) : 1;
    for (i = 0; i < bins; i++) {
      s = 0;
      for (k = -rad; k <= rad; k++) {
        idx = i + k;
        if (idx < 0 || idx >= bins) continue;
        s += cnt[idx] * ker[k + rad];
      }
      out.push(s / tot * norm);
    }
    return { E: g, D: out };
  }

  function bdCompute(p) {
    var name = opt(BD_OPTS, p.kind);
    var ki = BD_OPTS.indexOf(name);
    if (ki < 0) ki = 0;
    var t = clamp(num(p.t, 1), 1e-3, 1e3);          // 跃迁积分（eV）
    var P = clamp(num(p.V0, 1), 0, 20);             // δ 势垒强度（无量纲）
    var N = clamp(Math.round(num(p.N, 100)), 10, 500);
    var nk = 2 * Math.floor(N / 2) + 1;             // 奇数个 k 点 ⇒ 网格严格含 ka = π/2
    var ks = lin(0, BD_KMAX, nk), Ek = [], Ek2 = [], Ek3 = [], dosK = [], i, k;
    var dosE = [], dosV = [], dosPlot = [], markers = [], lines = [];
    var gap = 0, W = 4 * t, EF = 0, edgeTxt = "", histE = [], histD = [];
    var b1lo = -2 * t, b1hi = 2 * t;                // 第 1 条带的能量范围（读数用）
    var cap = BD_DOS_CAP_X / (Math.PI * t);         // 显示截断：4 × g(0)
    if (ki === 0) {
      for (i = 0; i < ks.length; i++) { k = ks[i]; Ek.push(bdTB(k, t)); }
      var anchors = [];
      for (i = 0; i < BD_ANCH.length; i++) {
        anchors.push(BD_ANCH[i] * t); anchors.push(-BD_ANCH[i] * t);
      }
      dosE = mergeSorted(lin(-W, W, BD_DOS_N), [0].concat(anchors).concat([W, -W]));
      for (i = 0; i < dosE.length; i++) {
        var dv = bdTBDos(dosE[i], t);
        dosV.push(isFinite(dv) ? dv : Infinity);    // 未截断值（自检 ③ 用）
        dosPlot.push(clip(dv, cap));                // 画图用（带边尖峰截断）
      }
      for (i = 0; i < ks.length; i++) dosK.push(clip(bdTBDos(Ek[i], t), cap));
      // 第二张图：解析 g(E) ＋ N 点离散链的直方图（有限尺寸让带边尖峰裂成一根根 δ 峰）
      lines.push({ x: dosE, y: dosPlot, label: "解析 g(E) = 2/(π√(4t²−E²))", color: "#5aa9ff" });
      var hb = bdHist(Ek, -W, W, BD_HIST_BINS);
      histE = hb.E; histD = hb.D;
      lines.push({ x: histE, y: histD, label: "N = " + nk + " 点离散链的直方图", color: "#ffb84d", dash: "5 4" });
      markers.push({ x: -2 * t, y: clip(bdTBDos(-2 * t, t), cap), label: "带底 −2t" });
      markers.push({ x: 0, y: clip(bdTBDos(0, t), cap), label: "E_F" });
      markers.push({ x: 2 * t, y: clip(bdTBDos(2 * t, t), cap), label: "带顶 +2t" });
      edgeTxt = "单带模型（无带隙）：下一个带在 E = 2t 之上";
      gap = 0;
      EF = Ek[nearestIndex(ks, Math.PI / 2)];       // 半填充：g(E) 对称 ⇒ E_F = 0（精确）
    } else {
      var bands = bdKPBands(P, BD_KP_NB);
      var b0 = bands.length > 0 ? bands[0] : [0, Math.PI], j;
      var seriesArr = [Ek, Ek2, Ek3];
      var allE = [];
      for (j = 0; j < bands.length; j++) {
        for (i = 0; i < ks.length; i++) {
          var x = bdKPSolveX(bands[j], P, ks[i]);
          seriesArr[j].push(x * x);
          allE.push(x * x);
        }
      }
      // 态密度：把全部带的 k 点能量做直方图（能隙自然表现为 g(E) = 0 的空白区）
      // 上界必须取**真正的最大值**：折叠图像里第 2 条带的最大值出现在 ka = 0，未必是最后一个点
      var emax = 0;
      for (i = 0; i < allE.length; i++) if (allE[i] > emax) emax = allE[i];
      if (!(emax > 0)) emax = 1;
      var hb2 = bdHist(allE, 0, emax, BD_HIST_BINS);
      histE = hb2.E; histD = hb2.D;
      var Eh = histE, Dh = histD;
      dosE = Eh; dosV = Dh; dosPlot = Dh;
      for (i = 0; i < ks.length; i++) {
        var s = 0;
        for (j = 0; j < bands.length; j++) {
          var Ev = seriesArr[j][i];
          var idx = Math.floor((Ev - Eh[0]) / ((Eh[Eh.length - 1] - Eh[0]) / (Eh.length - 1)));
          if (idx < 0) idx = 0;
          if (idx >= Dh.length) idx = Dh.length - 1;
          s += Dh[idx];
        }
        dosK.push(s);
      }
      lines.push({ x: Eh, y: Dh, label: "态密度（" + bands.length + " 条带，" + nk + " 个 k 点直方图）", color: "#5aa9ff" });
      if (bands.length >= 2) {
        gap = bands[1][0] * bands[1][0] - bands[0][1] * bands[0][1];
        markers.push({ x: bands[0][1] * bands[0][1], y: 0, label: "带 1 顶" });
        markers.push({ x: bands[1][0] * bands[1][0], y: 0, label: "带 2 底（带隙 Δ）" });
      }
      EF = Ek[nearestIndex(ks, Math.PI / 2)];       // 半填充：第一带中点的能量
      edgeTxt = bands.length + " 条允许带；" + (bands.length >= 2 ? "带隙从 " + fmt(bands[0][1] * bands[0][1], 4) +
        " 到 " + fmt(bands[1][0] * bands[1][0], 4) + "（ε 单位）" : "（落在窗口内的带不足 2 条）");
      W = bands.length ? (bands[0][1] * bands[0][1] - bands[0][0] * bands[0][0]) : 0;   // 第一带宽度
      if (bands.length) { b1lo = bands[0][0] * bands[0][0]; b1hi = bands[0][1] * bands[0][1]; }
      else { b1lo = 0; b1hi = 0; }
    }
    var scaleEV = HBAR * HBAR / (2 * M_E * BD_KP_A_REF * BD_KP_A_REF) / EV_J;   // 0.4233 eV（a = 3 Å）
    var g0 = 1 / (Math.PI * t);                       // 紧束缚带中心态密度 g(0) = 1/(πt)
    var dosEdge = clip(bdTBDos(1.9 * t, t), cap), dosMid = g0;
    var info = [
      { k: "模型", v: name + (ki === 0 ? "：E(k) = −2t·cos(ka)，单位 eV" : "：cos(ka) = cos x + P·sin x/x，ε = x²") },
      { k: "跃迁积分 t / 势垒强度 V₀", v: ki === 0 ? fmt(t, 4) + " eV / —（紧束缚只用 t）" : "t = " + fmt(t, 4) +
        " eV（仅用于读数换算）/ P = V₀ = " + fmt(P, 4) },
      { k: "格点数 N（k 点）", v: fmt(N, 0) + " → 网格 " + fmt(nk, 0) + " 个 ka ∈ [0, π]（严格含 ka = π/2）" },
      { k: "带宽 W", v: ki === 0 ? fmt(W, 6) + " eV = 4t（带底 −2t = " + fmt(-2 * t, 4) + " 到带顶 +2t = " + fmt(2 * t, 4) + "）" :
        fmt(W, 6) + "（ε 单位）；第 1 条带的 ε ∈ [" + fmt(b1lo, 4) + ", " + fmt(b1hi, 4) + "]" },
      { k: "带隙", v: ki === 0 ? "0（一维单带紧束缚没有禁带；" + edgeTxt + "）" :
        fmt(gap, 6) + "（ε 单位）≈ " + fmt(gap * scaleEV, 4) + " eV（按 ħ²/(2m_e a²)、a = 3 Å 折算）" },
      { k: "费米能（每格点 1 个电子，半填充）", v: ki === 0 ? fmt(EF, 8) + " eV（= 0，精确：g(E) 关于 E = 0 对称）" :
        fmt(EF, 6) + "（ε 单位）= 第 1 带中点 E₁(ka = π/2)" },
      { k: "态密度带边行为", v: ki === 0 ? "g(E) = 2/(π√(4t²−E²))：E → ±2t 时 1/√ 型发散（van Hove 奇点）" :
        "由色散直方图给出；带隙处 g(E) = 0" },
      { k: "g(0) / g(1.9t)（紧束缚）", v: fmt(dosMid, 6) + " / " + fmt(dosEdge, 6) + "（比值 " + fmt(dosEdge / dosMid, 5) +
        "，带边更大 ⇒ 1/√ 型）" },
      { k: "能量标尺 ħ²/(2m_e a²)（a = 3 Å）", v: fmt(scaleEV, 6) + " eV（ħ、m_e 取 CODATA 值）" },
      { k: "室温热能量 k_BT（300 K）", v: fmt(KB_T_ROOM_EV, 5) + " eV，与带宽 W 相比：" +
        (ki === 0 ? fmt(W / KB_T_ROOM_EV, 3) + " 倍" : "（KP 的 W 为 ε 单位，未换算）") },
      { k: "绘图约定", v: "主图 DOS 曲线截断到 " + fmt(cap, 4) + "（= 4×g(0)，带边尖峰是发散的）" +
        (ki === 0 ? "；第二张图的淡虚线是 N 点离散链的直方图（有限尺寸把带边尖峰裂成一根根 δ 峰）" :
          "；第二张图的直方图由 " + fmt(nk, 0) + " 个 k 点 × " + fmt(BD_KP_NB, 0) + " 条带统计得到，禁带处为 0") }
    ];
    if (ki === 1) {
      info.push({ k: "折叠图像（reduced zone）说明", v: "第 2 条带的最小值落在区边界 ka = π 上，所以它在主图里随 ka 下降" +
        "（第 1、3 条带相反）——这是自由电子抛物线折回第一布里渊区的结果，不是符号错误" });
    }
    return {
      t: ks,
      series: { Ek: Ek, dos: dosK, Ek2: Ek2, Ek3: Ek3 },
      info: info,
      bars: ki === 0 ? [
        { label: "带宽 W = 4t", value: W, color: "#5aa9ff" },
        { label: "带底 −2t", value: -2 * t, color: "#63d6a5" },
        { label: "带隙（单带模型）", value: 0, color: "#ff7b7b" }
      ] : [
        { label: "带 1 宽度", value: W, color: "#5aa9ff" },
        { label: "带隙 Δε", value: gap, color: "#ff7b7b" },
        { label: "E_F（第一带中点）", value: EF, color: "#63d6a5" }
      ],
      extra: {
        lines: lines,
        x: [], y: [],
        markers: markers,
        xlabel: ki === 0 ? "E（eV）" : "ε = E/(ħ²/2ma²)",
        ylabel: "态密度 g(E)",
        title: ki === 0 ? "态密度：带边 1/√ 发散，带中心最小（一维 van Hove 奇点）" :
          "Kronig-Penney 的态密度：允许带之间有 g(E) = 0 的禁带（带隙随 V₀ 增大）"
      },
      metrics: {
        ks: ks, Ek: Ek, Ek2: Ek2, Ek3: Ek3, dosK: dosK, t: t, P: P, N: N, nk: nk, kind: ki, name: name,
        dosE: dosE, dosV: dosV, dosPlot: dosPlot, histE: histE, histD: histD,
        gap: gap, W: W, EF: EF, cap: cap, scaleEV: scaleEV, dosMid: dosMid, dosEdge: dosEdge
      }
    };
  }

  SIM.register("band", {
    title: "能带与态密度",
    legend: "紧束缚模型里电子只能在 E(k) = −2t·cos(ka) 这条带上，带宽 4t；态密度 g(E) = 2/(π√(4t²−E²)) " +
      "在带边按 1/√ 发散（一维 van Hove 奇点）。换成 Kronig-Penney（周期 δ 势垒）后出现真正的**禁带**，" +
      "势垒 V₀ 越强带隙越宽——这就是「为什么有些能量电子根本进不去」。",
    axes: { xlabel: "ka（弧度，0 → π）", ylabel: "E（t 的单位 / ε 单位）" },
    params: {
      kind: { label: "模型", type: "enum", options: BD_OPTS, def: 0 },
      t: { label: "跃迁积分 t", unit: "eV", def: 1, min: 0.2, max: 3, step: 0.05 },
      V0: { label: "势垒强度 V₀", unit: "", def: 1, min: 0, max: 5, step: 0.05 },
      N: { label: "格点数 N", unit: "", def: 100, min: 10, max: 500, step: 1 }
    },
    plots: [
      { key: "Ek", label: "第 1 条能带 E(k)", color: "#5aa9ff" },
      { key: "dos", label: "态密度（沿 k 取样）", color: "#ffb84d", dash: "5 4" },
      { key: "Ek2", label: "第 2 条能带（KP）", color: "#63d6a5" },
      { key: "Ek3", label: "第 3 条能带（KP）", color: "#c792ea" }
    ],
    compute: bdCompute,
    tests: [
      // ① 逐点核对 E(k) = −2t·cos(ka)（紧束缚，容差 1e-12）
      { name: "紧束缚逐点 E(k) = −2t·cos(ka)（容差 1e-12）",
        params: { kind: 0, t: 1, V0: 1, N: 100 },
        measure: function (o) {
          var m = 0, i, d;
          for (i = 0; i < o.t.length; i++) {
            d = Math.abs(o.series.Ek[i] + 2 * o.metrics.t * Math.cos(o.t[i]));
            if (d > m) m = d;
          }
          return m;
        }, expect: 0, tol: 1e-12 },
      // ①b 带宽 = E(π) − E(0) = 4t = 4（从曲线现算）
      { name: "带宽 = 4t = 4（E(π) − E(0)，从曲线现算）",
        params: { kind: 0, t: 1, V0: 1, N: 100 },
        measure: function (o) {
          var mx = -Infinity, mn = Infinity, i;
          for (i = 0; i < o.series.Ek.length; i++) {
            if (o.series.Ek[i] > mx) mx = o.series.Ek[i];
            if (o.series.Ek[i] < mn) mn = o.series.Ek[i];
          }
          return mx - mn;
        }, expect: 4, tol: 1e-12 },
      // ①c 带底 E(k=0) = −2t = −2
      { name: "带底 E(k=0) = −2t = −2",
        params: { kind: 0, t: 1, V0: 1, N: 100 },
        measure: function (o) { return o.series.Ek[0]; }, expect: -2, tol: 1e-12 },
      // ② 半填充费米能：g(E) 关于 E = 0 对称 ⇒ E_F = 0（精确，容差 1e-12）
      { name: "半填充费米能 E_F = 0（紧束缚精确值；ka = π/2 处 E = 0）",
        params: { kind: 0, t: 1, V0: 1, N: 100 },
        measure: function (o) { return Math.abs(o.metrics.EF); }, expect: 0, tol: 1e-12 },
      // ③ 态密度的 1/√ 形式：g(E)·√(4t²−E²) = 2/π 对带内每个网格点都成立（解析常数）
      { name: "态密度是 1/√ 型：g(E)·√(4t²−E²) = 2/π = 0.6366197723675814（带内逐点）",
        params: { kind: 0, t: 1, V0: 1, N: 100 },
        measure: function (o) {
          var m = 0, i, E, g, d, t = o.metrics.t;
          for (i = 0; i < o.metrics.dosE.length; i++) {
            E = o.metrics.dosE[i];
            g = o.metrics.dosV[i];
            if (!isFinite(g) || Math.abs(E) > 1.99 * t) continue;    // 发散点与带外跳过
            d = Math.abs(g * Math.sqrt(4 * t * t - E * E) - 2 / Math.PI);
            if (d > m) m = d;
          }
          return m;
        }, expect: 0, tol: 1e-12 },
      // ③b 带边（E = 1.9t）的态密度 > 带中心（E = 0）：比值 = [2/(π√(4t²−3.61t²))]/[1/(πt)] = 2/√0.39
      { name: "带边态密度 / 带中心态密度 = 2/√0.39 = 3.2025630761017427 > 1",
        params: { kind: 0, t: 1, V0: 1, N: 100 },
        measure: function (o) {
          var i = nearestIndex(o.metrics.dosE, 1.9 * o.metrics.t);
          var j = nearestIndex(o.metrics.dosE, 0);
          return o.metrics.dosV[i] / o.metrics.dosV[j];
        }, expect: 3.2025630761017427, tol: 1e-9 },
      // ④ Kronig-Penney：带隙随 V₀ 单调增大；且 V₀ = 0 时带隙恰为 0（自由电子，f = cos x）
      { name: "Kronig-Penney：带隙随 V₀ 单调增大（V₀ = 0, 0.5, 1, 2, 3, 5）",
        params: { kind: 1, t: 1, V0: 1, N: 100 },
        measure: function (o) {
          var vals = [0, 0.5, 1, 2, 3, 5], i, prev = -Infinity, g, ok = 1;
          for (i = 0; i < vals.length; i++) {
            g = bdCompute({ kind: 1, t: 1, V0: vals[i], N: o.metrics.N }).metrics.gap;
            if (!(g > prev)) ok = 0;
            prev = g;
          }
          if (!(bdCompute({ kind: 1, t: 1, V0: 0, N: 100 }).metrics.gap < 1e-12)) ok = 0;
          return ok;
        }, expect: 1, tol: 0 },
      // ④b V₀ = 0 的精确极限：f = cos x ⇒ 禁带宽度 0、带边落在 x = nπ ⇒ ε = n²π²
      //     带边序列（每条带的下沿、上沿）= 0, π², π², 4π², 4π², 9π²（自由电子的折叠图像）
      { name: "Kronig-Penney：V₀ = 0 时带隙 = 0 且带边 ε = 0, π², 4π², 9π²",
        params: { kind: 1, t: 1, V0: 0, N: 100 },
        measure: function (o) {
          var bands = bdKPBands(0, 3), bad = Math.abs(o.metrics.gap), i;
          var p2 = Math.PI * Math.PI;
          var want = [0, p2, p2, 4 * p2, 4 * p2, 9 * p2];
          if (bands.length < 3) return 1e9;
          var got = [
            bands[0][0] * bands[0][0], bands[0][1] * bands[0][1],
            bands[1][0] * bands[1][0], bands[1][1] * bands[1][1],
            bands[2][0] * bands[2][0], bands[2][1] * bands[2][1]
          ];
          for (i = 0; i < 6; i++) bad += Math.abs(got[i] - want[i]);
          return bad;
        }, expect: 0, tol: 1e-9 },
      // ④c KP 的 E(k)：带内单调（方向不拘：折叠图像里第 2 条带的最小值在区边界，
      //     于是它是"倒"的、随 ka 递减），且两个端点正好是这条带的下沿与上沿
      { name: "Kronig-Penney：E(k) 在带内单调（方向不拘），端点 = 该带的下沿 / 上沿",
        params: { kind: 1, t: 1, V0: 2, N: 100 },
        measure: function (o) {
          var bad = 0, i, prev, bands = bdKPBands(2, 3), j, dir, e0, e1, bot, top;
          var arr = [o.series.Ek, o.series.Ek2, o.series.Ek3];
          for (j = 0; j < bands.length && j < 3; j++) {
            if (!arr[j].length) { bad++; continue; }
            dir = arr[j][arr[j].length - 1] >= arr[j][0] ? 1 : -1;
            prev = -Infinity;
            for (i = 0; i < arr[j].length; i++) {
              if (arr[j][i] * dir < prev - 1e-9) bad++;
              prev = arr[j][i] * dir;
            }
            e0 = arr[j][0]; e1 = arr[j][arr[j].length - 1];
            bot = bands[j][0] * bands[j][0]; top = bands[j][1] * bands[j][1];
            if (!((Math.abs(e0 - bot) < 1e-6 && Math.abs(e1 - top) < 1e-6) ||
              (Math.abs(e0 - top) < 1e-6 && Math.abs(e1 - bot) < 1e-6))) bad++;
          }
          return bad;
        }, expect: 0, tol: 0 },
      // ⑤ 边界安全：t → 0（滑块下限以下）、V₀ = 0/5、N 取两端时全部曲线有限
      { name: "边界：t = 0.001/3、V₀ = 0/5、N = 10/500、两种模型全部曲线有限",
        params: { kind: 0, t: 0.001, V0: 0, N: 10 },
        measure: function (o) {
          var bad = countBad([o.series.Ek, o.series.dos, o.metrics.dosPlot, o.metrics.histD]);
          var a1 = bdCompute({ kind: 0, t: 3, V0: 5, N: 500 });
          var a2 = bdCompute({ kind: 1, t: 0.2, V0: 0, N: 500 });
          var a3 = bdCompute({ kind: 1, t: 3, V0: 5, N: 11 });
          bad += countBad([a1.series.Ek, a1.series.dos, a1.metrics.dosPlot, a1.metrics.histD]);
          bad += countBad([a2.series.Ek, a2.series.Ek2, a2.series.Ek3, a2.series.dos, a2.metrics.dosPlot]);
          bad += countBad([a3.series.Ek, a3.series.Ek2, a3.series.Ek3, a3.series.dos]);
          return bad;
        }, expect: 0, tol: 0 }
    ]
  });

  /* ==========================================================================
     4. magnetization —— 磁性
     ========================================================================== */
  /**
   * 全部磁化强度以饱和磁化 M_s = 1 为单位、温度以 T_C 为单位（即滑块上的 T 就是 T/T_C，
   * 能量单位取 k_B T_C），所以这一节不需要任何物理常量。
   *
   * ① 顺磁（居里定律）：χ = C/T ⇒ M = C·H/T（C = 1，相对单位）
   *      高温下热涨落打乱自旋取向，外场只能换来 ∝ 1/T 的微弱磁化。              … 契约 ①
   * ② 铁磁（平均场 / Weiss）：自洽方程
   *      M = tanh((M + H)/T)      （取 J/k_B T_C = 1 的归一化形式）              … 契约 ②
   *    H = 0 时：T ≥ 1 只有 M = 0 一个解；T < 1 出现两个非零根 ±M*（对称破缺），取 |M|。
   *    T = 1（T_C）正是自洽解"退化"的临界点：非零根与零根合并 ⇒ M = 0。
   * ③ 临界指数 β = 1/2：把 tanh x ≈ x − x³/3 代入自洽方程得
   *      M² ≈ 3T²(1 − T) ⇒ M ≈ √3·T·√(1 − T) → √(3(1−T))   （T → T_C⁻）
   *    所以 M ∝ (1 − T)^β、β = 1/2（平均场值）。                                … 契约 ③
   * ④ 磁滞回线：双曲正切型的唯象回线（形状简单、解析可控，不是完整的 Jiles-Atherton）：
   *      H_c(T) = H_c0·√(1 − T)（T ≥ T_C 时磁滞消失：材料变成顺磁）
   *      c(H)   = 1 − (H/H_max)²  （在 ±H_max 处两支合并，回线闭合——物理上回线必须闭合）
   *      上行支（H 增大）M↑(H) = M_s·tanh[(H − H_c·c(H))/H_w]
   *      下行支（H 减小）M↓(H) = M_s·tanh[(H + H_c·c(H))/H_w]
   *    H = 0 处的剩磁 M_r = M_s·tanh(H_c/H_w) > 0；上行支过零处即矫顽力 H*，
   *    由 H* = H_c·c(H*) 解出闭式 H* = (H_max²/2H_c)[√(1 + 4H_c²/H_max²) − 1] > 0。      … 契约 ④
   */
  var MG_OPTS = ["顺磁（居里定律）", "铁磁（平均场）", "磁滞回线"];
  var MG_MS = 1;               // 饱和磁化（归一化）
  var MG_TC = 1;               // 居里温度（T 的单位）
  var MG_HC0 = 0.5;            // T = 0 时的矫顽力（相对单位）
  var MG_HW = 0.35;            // 回线宽度参数
  var MG_HMAX = 3;             // 回线的最大外场（= H 滑块上限）
  var MG_NH = 601;             // M(H) 回线的单程点数（奇数 ⇒ 严格含 H = 0）
  var MG_NT = 449;             // M(T) 的 T 网格点数
  var MG_TMIN = 0.02, MG_TMAX = 3;
  var MG_MCAP = 3;             // 绘图截断（居里定律在 T → 0 时发散）
  var MG_TANCH = [0.5, 2.5, 0.9, 0.99, 0.999, 1];   // 自检要用的精确温度锚点

  /**
   * 平均场自洽方程 M = tanh((M + H)/T) 的物理解（取 |M| 最大的根）。
   * H = 0 时解析地知道根的结构（T ≥ 1 只有 0；T < 1 有 ±M*），用二分法稳稳求出 M*；
   * H ≠ 0 时先在 H 一侧粗扫找变号区间再二分（回退：整个 [0, ±1] 区间二分，端点必变号）。
   */
  function mgSolve(T, H) {
    var g = function (M) { return Math.tanh((M + H) / T) - M; };
    var i, lo, hi, mid, sgn, prevM, prevG, gm, best = 0, babs = 0, N = 200;
    if (H === 0) {
      if (T >= MG_TC) return 0;
      lo = 1e-12; hi = 1;
      for (i = 0; i < 90; i++) { mid = 0.5 * (lo + hi); if (g(mid) > 0) lo = mid; else hi = mid; }
      return 0.5 * (lo + hi);
    }
    sgn = H > 0 ? 1 : -1;
    prevM = 0; prevG = g(0);
    for (i = 1; i <= N; i++) {
      var M = sgn * i / N;
      gm = g(M);
      if (prevG * gm < 0) {
        lo = prevM; hi = M;
        for (var k = 0; k < 70; k++) {
          mid = 0.5 * (lo + hi);
          if (g(lo) * g(mid) <= 0) hi = mid; else lo = mid;
        }
        mid = 0.5 * (lo + hi);
        if (Math.abs(mid) > babs) { babs = Math.abs(mid); best = mid; }
      }
      prevM = M; prevG = gm;
    }
    if (babs === 0) {                       // 回退：g(0) 与 g(±1) 必异号
      lo = 0; hi = sgn;
      for (i = 0; i < 90; i++) { mid = 0.5 * (lo + hi); if (g(lo) * g(mid) <= 0) hi = mid; else lo = mid; }
      best = 0.5 * (lo + hi);
    }
    return best;
  }
  /** 顺磁居里定律 M = C·H/T（C = 1） */
  function mgCurie(T, H) { return H / T; }
  /** 矫顽力（上行支过零的场）：H_c(T) = H_c0√(1−T)，T ≥ T_c 为 0；闭式零交叉 H* 见上 */
  function mgHc(T) { return T < MG_TC ? MG_HC0 * Math.sqrt(1 - T / MG_TC) : 0; }
  function mgHstar(Hc) {
    if (!(Hc > 0)) return 0;
    return (MG_HMAX * MG_HMAX / (2 * Hc)) * (Math.sqrt(1 + 4 * Hc * Hc / (MG_HMAX * MG_HMAX)) - 1);
  }
  /** 回线的两支（c(H) = 1 − (H/H_max)² 保证在 ±H_max 处闭合） */
  function mgBranch(H, Hc, sgn) {
    var c = 1 - (H / MG_HMAX) * (H / MG_HMAX);
    if (c < 0) c = 0;
    return MG_MS * Math.tanh((H + sgn * Hc * c) / MG_HW);
  }
  function mgRemanence(T) { return MG_MS * Math.tanh(mgHc(T) / MG_HW); }

  function mgCompute(p) {
    var name = opt(MG_OPTS, p.kind);
    var ki = MG_OPTS.indexOf(name);
    if (ki < 0) ki = 0;
    var T = clamp(num(p.T, 1), MG_TMIN, MG_TMAX);   // 居里定律在 T → 0 发散 ⇒ 先夹紧
    var H = clamp(num(p.H, 0), -MG_HMAX, MG_HMAX);
    var ts = [], M = [], Mref = [], chi = [], i, v;
    var Hc = mgHc(T), Mr = mgRemanence(T), Hstar = mgHstar(Hc);
    var extraLines = [], extraMarkers = [], bars = [];
    var mCur = 0, chiCur = 0, mDn = 0;
    if (ki === 0) {
      ts = mergeSorted(lin(MG_TMIN, MG_TMAX, MG_NT), MG_TANCH.concat([T]));
      for (i = 0; i < ts.length; i++) {
        v = mgCurie(ts[i], H);
        M.push(clip(v, MG_MCAP));
        chi.push(clip(1 / ts[i], MG_MCAP));         // C/T，与 H 无关（T → 0 发散，画图前截断）
      }
      chiCur = 1 / T; mCur = mgCurie(T, H);
      extraLines.push({
        x: lin(-MG_HMAX, MG_HMAX, 241),
        y: (function () { var o = [], q, xx = lin(-MG_HMAX, MG_HMAX, 241); for (q = 0; q < xx.length; q++) o.push(clip(mgCurie(T, xx[q]), MG_MCAP)); return o; })(),
        label: "M(H) 在当前 T = " + fmt(T, 3) + " 的直线（斜率 C/T）", color: "#63d6a5"
      });
      bars = [
        { label: "M(T)（当前 T）", value: clip(mCur, MG_MCAP), color: "#5aa9ff" },
        { label: "χ = C/T", value: clip(chiCur, MG_MCAP), color: "#63d6a5" }
      ];
    } else if (ki === 1) {
      ts = mergeSorted(lin(MG_TMIN, MG_TMAX, MG_NT), MG_TANCH.concat([T]));
      for (i = 0; i < ts.length; i++) {
        M.push(clip(mgSolve(ts[i], H), MG_MCAP));
        Mref.push(clip(mgCurie(ts[i], H), MG_MCAP));   // 对照：同样外场下的顺磁 1/T 定律
      }
      mCur = mgSolve(T, H);
      extraLines.push({
        x: lin(-MG_HMAX, MG_HMAX, 241),
        y: (function () { var o = [], q, xx = lin(-MG_HMAX, MG_HMAX, 241); for (q = 0; q < xx.length; q++) o.push(clip(mgSolve(T, xx[q]), MG_MCAP)); return o; })(),
        label: "M(H) 在当前 T = " + fmt(T, 3) + "（自洽解）", color: "#63d6a5"
      });
      extraMarkers = [{ x: MG_TC, y: 0, label: "T_C" }];
      bars = [
        { label: "M(T)（当前 T）", value: clip(mCur, MG_MCAP), color: "#5aa9ff" },
        { label: "顺磁对照 C·H/T", value: clip(mgCurie(T, H), MG_MCAP), color: "#ffb84d" },
        { label: "近 T_C 的 √(1−T) 近似", value: T < MG_TC ? clip(Math.sqrt(3 * (1 - T)), MG_MCAP) : 0, color: "#ff7b7b" }
      ];
    } else {
      // 回线：上行（H 从 −H_max 增到 +H_max）＋ 下行（再减回 −H_max），一条闭合折线
      var hUp = lin(-MG_HMAX, MG_HMAX, MG_NH), xAll = [], yAll = [], yAnh = [];
      for (i = 0; i < hUp.length; i++) { xAll.push(hUp[i]); yAll.push(clip(mgBranch(hUp[i], Hc, -1), MG_MCAP)); yAnh.push(clip(MG_MS * Math.tanh(hUp[i] / MG_HW), MG_MCAP)); }
      for (i = hUp.length - 1; i >= 0; i--) { xAll.push(hUp[i]); yAll.push(clip(mgBranch(hUp[i], Hc, 1), MG_MCAP)); yAnh.push(clip(MG_MS * Math.tanh(hUp[i] / MG_HW), MG_MCAP)); }
      ts = xAll; M = yAll; Mref = yAnh;
      // 上行支：M↑(H) = tanh[(H − H_c·c)/H_w]（H 增大时走这支，H = 0 处 = −M_r）
      // 下行支：M↓(H) = tanh[(H + H_c·c)/H_w]（H 减小时走这支，H = 0 处 = +M_r = 剩磁）
      mCur = mgBranch(H, Hc, -1);
      mDn = mgBranch(H, Hc, 1);
      extraLines.push({
        x: lin(MG_TMIN, MG_TMAX, MG_NT),
        y: (function () {
          var o = [], q, tt = lin(MG_TMIN, MG_TMAX, MG_NT);
          for (q = 0; q < tt.length; q++) o.push(tt[q] < MG_TC ? MG_MS * Math.tanh(mgHc(tt[q]) / MG_HW) : 0);
          return o;
        })(),
        label: "剩磁 M_r(T) = M_s·tanh(H_c(T)/H_w)（H = 0）", color: "#c792ea"
      });
      extraMarkers = [{ x: T, y: Mr, label: "当前 T" }];
      bars = [
        { label: "剩磁 M_r", value: Mr, color: "#5aa9ff" },
        { label: "矫顽力 H*", value: Hstar, color: "#ffb84d" },
        { label: "当前 H 处的 M（上行支）", value: mCur, color: "#63d6a5" }
      ];
    }
    var betaEff = 0, sqrtLaw = 0;
    if (ki === 1 || ki === 0) {
      // 近 T_C 的有效 β（两条温度点之间的双对数斜率）与 √(3(1−T)) 渐近对照
      if (T < MG_TC) {
        var m1 = mgSolve(0.99, 0), m2 = mgSolve(0.999, 0);
        betaEff = (m1 > 0 && m2 > 0) ? Math.log(m1 / m2) / Math.log((1 - 0.99) / (1 - 0.999)) : 0;
        sqrtLaw = mCur / (T < MG_TC ? Math.sqrt(3 * (1 - T)) : 1);
      }
    }
    /* 有效 β 的**读数文字**：T ≥ T_C 时 M(T) ≡ 0，双对数斜率根本不存在 —— 不能把
       上面保持初值 0 的 betaEff 直接拼进 info（那会显示成"有效 β = 0"，与同一行前半句
       "β = 1/2" 自相矛盾）；磁滞模式（ki = 2）画的是回线，也没有 M(T) 的 β 可算。 */
    var betaTxt;
    if (ki === 2) betaTxt = "—（本模式画的是磁滞回线，没有 M(T) 曲线；切到「铁磁（平均场）」看 β）";
    else if (T >= MG_TC) betaTxt = "—（T ≥ T_C = " + fmt(MG_TC, 3) + " 时无自发磁化，M ≡ 0，β 不适用）";
    else betaTxt = fmt(betaEff, 5);
    var info = [
      { k: "模型", v: name },
      { k: "饱和磁化 M_s / 居里温度 T_C", v: fmt(MG_MS, 3) + "（归一化）/ " + fmt(MG_TC, 3) + "（T 的单位就是 T_C）" },
      { k: "当前 T / H", v: fmt(T, 4) + " T_C / " + fmt(H, 4) + "（相对单位）" },
      { k: "当前磁化 M", v: fmt(mCur, 6) + (ki === 0 ? "（= C·H/T，C = " + fmt(1, 3) + "）" :
        (ki === 1 ? "（自洽解 M = tanh((M+H)/T)）" : "（上行支；同一 H 的下行支为 " + fmt(mDn, 6) + "）")) },
      { k: "居里定律 M = C·H/T", v: ki === 0 ? "χ = C/T = " + fmt(chiCur, 6) + "（与 H 无关，1/T 依赖）" :
        "对照曲线：同样外场下顺磁给出 " + fmt(mgCurie(T, H), 6) },
      { k: "平均场自洽方程 M = tanh(M/T)", v: "T > 1 只有 M = 0；T < 1 有两个非零根 ±M*（取 |M|）；T = 1 临界点两支合并" },
      { k: "临界指数 β", v: "β = 1/2（M ≈ √3·T·√(1−T) → √(3(1−T))）；从曲线现算的有效 β（0.99→0.999）= " + betaTxt },
      { k: "剩磁 M_r / 矫顽力 H*", v: ki === 2 ? fmt(Mr, 6) + " / " + fmt(Hstar, 6) + "（H_c(T) = " + fmt(Hc, 6) +
        "，" + (Hc > 0 ? "回线有磁滞" : "T ≥ T_C，磁滞消失") + "）" : "本模式不画回线（切到「磁滞回线」看）" },
      { k: "回线形状", v: ki === 2 ? "M↑,↓(H) = M_s·tanh[(H ∓ H_c·c(H))/H_w]，c(H) = 1 − (H/H_max)²；" +
        "H_w = " + fmt(MG_HW, 3) + "，H_max = " + fmt(MG_HMAX, 3) : "—" },
      { k: "近 T_C 的渐近检验", v: T < MG_TC ? "M / √(3(1−T)) = " + fmt(sqrtLaw, 6) + "（T → T_C⁻ 时趋于 1）" : "—" },
      { k: "绘图截断", v: "|M| 与 χ > " + fmt(MG_MCAP, 3) + " 的部分已截断（居里定律在 T → 0 时发散，读数给精确值）" }
    ];
    return {
      t: ts,
      series: { M: M, Mref: Mref, chi: chi },
      info: info,
      bars: bars,
      extra: {
        lines: extraLines,
        x: [], y: [],
        markers: extraMarkers,
        xlabel: ki === 2 ? "T（T_C 单位）" : "H（相对单位）",
        ylabel: ki === 2 ? "剩磁 M_r" : "M（M_s 单位）",
        title: ki === 2 ? "剩磁随温度：T → T_C 时回线塌缩，剩磁 → 0" :
          (ki === 1 ? "等温磁化曲线 M(H)（自洽解）" : "顺磁的 M–H 直线（斜率 = C/T）")
      },
      metrics: {
        ts: ts, M: M, Mref: Mref, chi: chi, T: T, H: H, kind: ki, name: name,
        Ms: MG_MS, Tc: MG_TC, Hc: Hc, Mr: Mr, Hstar: Hstar, mCur: mCur, chiCur: chiCur,
        betaEff: betaEff, sqrtLaw: sqrtLaw, mDn: mDn,
        Hw: MG_HW, Hmax: MG_HMAX, mcap: MG_MCAP
      }
    };
  }

  SIM.register("magnetization", {
    title: "磁性：顺磁、平均场铁磁与磁滞",
    legend: "顺磁体只有外场才有磁化，且 M = C·H/T（越热越难磁化）；铁磁体在 T_C 以下**自发**磁化，" +
      "平均场给出 M = tanh(M/T)、M ∝ (1−T)^{1/2}；再往下看磁滞回线：撤掉外场还剩剩磁 M_r，" +
      "反向加场到矫顽力 H* 才把磁化扳回零。",
    axes: { xlabel: "T（T_C 单位）或 H（相对单位，磁滞模式）", ylabel: "M（M_s = 1 归一化）" },
    params: {
      kind: { label: "模型", type: "enum", options: MG_OPTS, def: 0 },
      T: { label: "温度 T/T_C", unit: "", def: 1, min: 0.1, max: 3, step: 0.01 },
      H: { label: "外场 H", unit: "相对", def: 0, min: -3, max: 3, step: 0.05 }
    },
    plots: [
      { key: "M", label: "磁化强度 M", color: "#5aa9ff" },
      { key: "Mref", label: "对照曲线（顺磁 1/T 或理想无磁滞曲线）", color: "#ffb84d", dash: "5 4" },
      { key: "chi", label: "磁化率 χ = C/T（顺磁）", color: "#63d6a5", dash: "2 3" }
    ],
    compute: mgCompute,
    tests: [
      // ① 顺磁 1/T 定律：M(T₁)·T₁ / (M(T₂)·T₂) = C/C = 1（H 相同；T₁ = 0.5、T₂ = 2.5 都是网格锚点）
      { name: "顺磁居里定律：M(T₁)·T₁ = M(T₂)·T₂（同一 H，比值 = 1，容差 1e-9）",
        params: { kind: 0, T: 0.5, H: 1 },
        measure: function (o) {
          var i1 = nearestIndex(o.t, 0.5), i2 = nearestIndex(o.t, 2.5);
          return (o.series.M[i1] * o.t[i1]) / (o.series.M[i2] * o.t[i2]);
        }, expect: 1, tol: 1e-9 },
      // ①b 绝对式 M = C·H/T：T = 2.5、H = 1 ⇒ M = 1/2.5 = 0.4（精确，从曲线现算）
      { name: "顺磁 M = C·H/T = 1/2.5 = 0.4（T = 2.5、H = 1、C = 1，精确）",
        params: { kind: 0, T: 2.5, H: 1 },
        measure: function (o) {
          return o.series.M[nearestIndex(o.t, 2.5)];
        }, expect: 0.4, tol: 1e-12 },
      // ② 平均场：T = 1.2 > T_C ⇒ 自洽方程只有 M = 0
      { name: "平均场 T = 1.2 > T_C：M = tanh(M/T) 只有 M = 0（精确）",
        params: { kind: 1, T: 1.2, H: 0 },
        measure: function (o) { return o.series.M[nearestIndex(o.t, 1.2)]; },
        expect: 0, tol: 1e-15 },
      // ②b 平均场 T = T_C = 1（自洽解退化：非零根与零根合并）⇒ M = 0
      { name: "平均场 T = T_C = 1：非零根退化，M = 0（精确）",
        params: { kind: 1, T: 1, H: 0 },
        measure: function (o) { return o.series.M[nearestIndex(o.t, 1)]; },
        expect: 0, tol: 1e-15 },
      // ②c T = 0.5 < T_C：M > 0（对称破缺的两个非零根 ±M*，取 |M|）
      { name: "平均场 T = 0.5 < T_C：M > 0（对称破缺，取 |M| = 0.957504…）",
        params: { kind: 1, T: 0.5, H: 0 },
        measure: function (o) {
          var i = nearestIndex(o.t, 0.5);
          return o.series.M[i] > 0 ? 1 : 0;
        }, expect: 1, tol: 0 },
      // ②d 自洽性：把曲线上的 M 代回 M = tanh(M/T)，残差必须为 0（T = 0.5，容差 1e-12）
      { name: "平均场自洽残差 |M − tanh(M/T)| = 0（T = 0.5，从曲线现算）",
        params: { kind: 1, T: 0.5, H: 0 },
        measure: function (o) {
          var i = nearestIndex(o.t, 0.5), m = o.series.M[i];
          return Math.abs(m - Math.tanh(m / 0.5));
        }, expect: 0, tol: 1e-12 },
      // ③ 近 T_C 的解析渐近 M ≈ √(3(1−T))：T = 0.99 时 M/√(3·0.01) = 0.995993（1% 以内）
      { name: "近 T_C 渐近 M ≈ √(3(1−T))：T = 0.99 时 M/√0.03 = 0.9959931（±1%）",
        params: { kind: 1, T: 0.99, H: 0 },
        measure: function (o) {
          var i = nearestIndex(o.t, 0.99);
          return o.series.M[i] / Math.sqrt(3 * (1 - 0.99));
        }, expect: 1, tol: 0.01 },
      // ④ 临界指数 β = 1/2：M(0.99) 与 M(0.999) 的双对数斜率 = 0.498430…（容差 0.02）
      //    （解析：M ∝ (1−T)^{1/2} ⇒ 斜率恰为 0.5；有限距离修正使两点斜率略小）
      { name: "临界指数 β = 1/2：M ∝ (1−T)^β 的双对数斜率（0.99 → 0.999）= 0.5 ± 0.02",
        params: { kind: 1, T: 0.5, H: 0 },
        measure: function (o) {
          var i1 = nearestIndex(o.t, 0.99), i2 = nearestIndex(o.t, 0.999);
          return Math.log(o.series.M[i1] / o.series.M[i2]) / Math.log((1 - 0.99) / (1 - 0.999));
        }, expect: 0.5, tol: 0.02 },
      // ④b 读数一致性：T ≥ T_C 时没有自发磁化（M ≡ 0），有效 β 不存在 ——
      //     info 行必须显示「—（T ≥ T_C …）」，不许把内部初值 0 拼成"有效 β = 0"
      //     （那与同一行前半句的 β = 1/2 自相矛盾）。T = 1.0 正是 T 滑块的默认值。
      { name: "T = 1.0 = T_C：info 的「有效 β」显示为「—」而不是 0（T = 0.5 时仍给 0.49843）",
        params: { kind: 1, T: 1, H: 0 },
        measure: function (o, p) {
          var i, line = "";
          for (i = 0; i < o.info.length; i++) if (o.info[i].k === "临界指数 β") line = String(o.info[i].v);
          var okTc = line.indexOf("—（T ≥ T_C") >= 0 && line.indexOf("= 0") < 0;
          var o2 = mgCompute({ kind: 1, T: 0.5, H: 0 }), line2 = "";
          for (i = 0; i < o2.info.length; i++) if (o2.info[i].k === "临界指数 β") line2 = String(o2.info[i].v);
          var okBelow = line2.indexOf("0.49843") >= 0;      // β = 0.498430…（解析 1/2）
          void p;
          return okTc && okBelow ? 1 : 0;
        }, expect: 1, tol: 0 },
      // ⑤ 磁滞剩磁：M_r = M_s·tanh(H_c(T)/H_w)，T = 0.5 时 H_c = 0.5√0.5 = 0.35355339
      //    ⇒ M_r = tanh(1.0101525…) = 0.7658251046068682 > 0（从回线的下行支 H = 0 处现算）
      { name: "磁滞剩磁 M_r = M_s·tanh(H_c/H_w) = 0.7658251046068682 > 0（T = 0.5）",
        params: { kind: 2, T: 0.5, H: 0 },
        measure: function (o) {
          var n = MG_NH, mid = (n - 1) / 2;         // 下行支的 H = 0 落在索引 n + mid
          return o.series.M[n + mid];
        }, expect: 0.7658251046068682, tol: 1e-9 },
      // ⑤b 矫顽力：上行支过零的场，闭式 H* = (H_max²/2H_c)[√(1+4H_c²/H_max²) − 1] = 0.34877476926416617
      //     measure 从回线现算：在下行/上行支里找 M 变号区间做线性插值（网格步长 0.01 ⇒ 误差 ~1e-4）
      { name: "磁滞矫顽力（上行支零交叉）= 0.34877476926416617 > 0（T = 0.5）",
        params: { kind: 2, T: 0.5, H: 0 },
        measure: function (o) {
          var n = MG_NH, i, x0, x1, y0, y1;
          for (i = 1; i < n; i++) {                  // 上行支：索引 0…n−1（H 从 −3 增到 +3）
            if (o.series.M[i - 1] < 0 && o.series.M[i] >= 0) {
              x0 = o.t[i - 1]; x1 = o.t[i]; y0 = o.series.M[i - 1]; y1 = o.series.M[i];
              return x0 + (x1 - x0) * (0 - y0) / (y1 - y0);
            }
          }
          return -1;
        }, expect: 0.34877476926416617, tol: 1e-3 },
      // ⑤c 回线在 ±H_max 处闭合（两支相等），否则就不是一条闭合回线
      { name: "磁滞回线在 H = ±H_max 处闭合：上行支 = 下行支（T = 0.5）",
        params: { kind: 2, T: 0.5, H: 0 },
        measure: function (o) {
          var n = MG_NH;
          return Math.abs(o.series.M[0] - o.series.M[2 * n - 1]) + Math.abs(o.series.M[n - 1] - o.series.M[n]);
        }, expect: 0, tol: 1e-12 },
      // ⑤d T ≥ T_C 时磁滞消失：剩余磁化与矫顽力都为 0（材料进入顺磁相）
      { name: "T = 1.2 ≥ T_C：剩磁与矫顽力都 = 0（磁滞消失）",
        params: { kind: 2, T: 1.2, H: 0 },
        measure: function (o) {
          var n = MG_NH, mid = (n - 1) / 2;
          return Math.abs(o.series.M[n + mid]) + Math.abs(o.metrics.Hstar) + Math.abs(o.metrics.Hc);
        }, expect: 0, tol: 1e-12 },
      // ⑥ 边界安全：T 压到滑块下限以下（T → 0 时居里定律 1/T 发散）、H 顶到两端（含负场）时全部曲线有限
      { name: "边界：T = 0.02/3、H = ±3 时全部曲线有限（居里定律的 1/T 已截断）",
        params: { kind: 0, T: 0.02, H: 3 },
        measure: function (o) {
          var bad = countBad([o.series.M, o.series.chi]);
          var a1 = mgCompute({ kind: 0, T: 3, H: -3 });
          var a2 = mgCompute({ kind: 1, T: 0.02, H: 3 });
          var a3 = mgCompute({ kind: 1, T: 0.02, H: -3 });
          var a4 = mgCompute({ kind: 2, T: 0.02, H: 3 });
          var a5 = mgCompute({ kind: 2, T: 3, H: -3 });
          bad += countBad([a1.series.M, a1.series.chi, a2.series.M, a2.series.Mref]);
          bad += countBad([a3.series.M, a4.series.M, a4.series.Mref, a5.series.M]);
          bad += countBad([o.metrics.M]);            // 再数一遍主曲线（与 series 互为印证）
          return bad;
        }, expect: 0, tol: 0 }
    ]
  });

})(typeof window !== "undefined" ? window : globalThis);
