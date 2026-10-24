/* ==========================================================================
   simlab-models-em.js —— 电磁学仿真模型（W2，5 个）

   模型：field-2d / rc-circuit / rlc-circuit / charged-particle / em-wave
   契约：PHYSICS-CONTENT-SPEC.md §10.2（参数名、曲线键名、读数、自检解析期望值逐字遵守）。

   ★ 加载时只调用 SIM.register(...)，不触碰 DOM（见 simlab.js 顶部约束），
     这样 tools/verify-simlab.mjs 能在 Node 里直接跑 compute() 与 tests 做物理不变量自检。
   ★ 不使用随机数：这 5 个模型全是确定性计算，同一组参数两次运行结果逐位相同。
   ★ 物理常量照抄 app/constants.js（CODATA 2018 / 2019 SI 定义值），本文件自带数值，
     这样在 Node 里只加载 simlab.js + simlab-models-*.js 也能算：
       c    = 2.997 924 58 × 10^8 m/s         （定义值）
       k_e  = 1/(4πε₀) = 8.987 551 787 × 10^9 N·m²/C²
       ε₀   = 8.854 187 8128 × 10^-12 F/m
       μ₀   = 1.256 637 062 12 × 10^-6 N/A²
   ========================================================================== */
(function (global) {
  "use strict";
  var SIM = global.SIM;
  if (!SIM) return;   // 在 Node 里若未先加载 simlab.js，安静退出

  var rk4 = SIM.rk4, lin = SIM.linspace, fmt = SIM.fmt;

  /* ------------------------------------------------------------- 物理常量 */
  var C_LIGHT = 2.99792458e8;      // m/s
  var K_E = 8.987551787e9;         // N·m²/C²，k_e = 1/(4πε₀)
  var EPS0 = 8.8541878128e-12;     // F/m
  var MU0 = 1.25663706212e-6;      // N/A²
  var NANO = 1e-9;                 // nC → C

  /* --------------------------------------------------------------- 小工具 */
  function maxAbs(vals) {
    var m = 0;
    for (var i = 0; i < vals.length; i++) {
      var v = vals[i];
      if (typeof v === "number" && isFinite(v)) m = Math.max(m, Math.abs(v));
    }
    return m;
  }
  /** (max − min)/2：用于从曲线反推振幅 / 回旋半径 */
  function halfRange(vals) {
    var mn = Infinity, mx = -Infinity;
    for (var i = 0; i < vals.length; i++) {
      var v = vals[i];
      if (typeof v !== "number" || !isFinite(v)) continue;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    return isFinite(mn) ? (mx - mn) / 2 : NaN;
  }
  /** 相对漂移 (max − min)/平均绝对值：检验"守恒量"是否真的不飘 */
  function relDrift(vals) {
    var mn = Infinity, mx = -Infinity, sum = 0, n = 0;
    for (var i = 0; i < vals.length; i++) {
      var v = vals[i];
      if (typeof v !== "number" || !isFinite(v)) continue;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
      sum += Math.abs(v); n++;
    }
    if (!n) return NaN;
    var mean = sum / n;
    return mean > 0 ? (mx - mn) / mean : mx - mn;
  }
  /** 归一化最大回升 max(y[i+1]−y[i]) / max|y|：检验"单调不增"这类不变量 */
  function maxRise(vals) {
    var m = maxAbs(vals), rise = 0;
    for (var i = 1; i < vals.length; i++) {
      var d = vals[i] - vals[i - 1];
      if (d > rise) rise = d;
    }
    return m > 0 ? rise / m : rise;
  }
  /** 非有限值个数（NaN / ±Infinity）：任意滑块取值都不该出现 */
  function nonFinite(vals) {
    var n = 0;
    for (var i = 0; i < vals.length; i++) {
      if (typeof vals[i] !== "number" || !isFinite(vals[i])) n++;
    }
    return n;
  }
  /** 距 target 最近的样本下标 */
  function nearestIndex(xs, target) {
    var best = 0, bd = Infinity;
    for (var i = 0; i < xs.length; i++) {
      var d = Math.abs(xs[i] - target);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  /** 过零位置（线性插值）：dir=+1 取由负变正，dir=-1 取由正变负 */
  function crossings(xs, ys, dir) {
    var out = [];
    for (var i = 1; i < ys.length; i++) {
      var y0 = ys[i - 1], y1 = ys[i];
      if (!isFinite(y0) || !isFinite(y1)) continue;
      var hit = dir > 0 ? (y0 < 0 && y1 >= 0) : (y0 > 0 && y1 <= 0);
      if (!hit) continue;
      var t = y1 === y0 ? xs[i] : xs[i - 1] + ((0 - y0) / (y1 - y0)) * (xs[i] - xs[i - 1]);
      out.push(t);
    }
    return out;
  }
  /** 相邻间隔的均值（配合 crossings 求周期 / 波长） */
  function meanSpacing(list) {
    if (list.length < 2) return NaN;
    var s = 0;
    for (var i = 1; i < list.length; i++) s += list[i] - list[i - 1];
    return s / (list.length - 1);
  }
  /** 均匀抽稀（保留首末点）：RK4 用细步长积分，画图不需要那么多点 */
  function thin(t, keys, target) {
    var n = t.length, k;
    if (n <= target) return { t: t, series: keys };
    var step = Math.ceil(n / target), out = {}, tt = [], i;
    for (k in keys) if (keys.hasOwnProperty(k)) out[k] = [];
    for (i = 0; i < n; i += step) {
      tt.push(t[i]);
      for (k in out) if (out.hasOwnProperty(k)) out[k].push(keys[k][i]);
    }
    if (tt[tt.length - 1] !== t[n - 1]) {
      tt.push(t[n - 1]);
      for (k in out) if (out.hasOwnProperty(k)) out[k].push(keys[k][n - 1]);
    }
    return { t: tt, series: out };
  }

  /* ======================================================================
     1. field-2d —— 两点电荷的场

     电荷 q₁ 在 x = −d/2、q₂ 在 x = +d/2（都在 y = 0 的轴线上）。取连线为 x 轴：
       V(x)  = k q₁/|x + d/2| + k q₂/|x − d/2|                       （标量势）
       Eₓ(x) = k q₁ (x + d/2)/|x + d/2|³ + k q₂ (x − d/2)/|x − d/2|³ （轴向分量）
     中点 x = 0：Eₓ = k q₁/(d/2)² − k q₂/(d/2)² = k(q₁ − q₂)/(d/2)²，
     偶极矩 p = Σ qᵢxᵢ = (q₂ − q₁)d/2；远场 r ≫ d 时 V → k(q₁+q₂)/r（单极近似）。

     绘图：电荷所在处 V ∝ 1/r、E ∝ 1/r² 发散，所以按 |x ∓ d/2| ≥ ρ（ρ = d/5）排除那一小段
     取样点（曲线在该处"断开"，折线自然连成尖峰）。窗口取 |x| ≤ 1.5d 的方形区域，
     电荷周围撒 12 条起点的电场线也画在同一张"轴向"坐标系旁（各自横轴的 extra.lines）。
     ====================================================================== */
  /** 点电荷组在 (x,y) 处的电场（SI，V/m）：E = Σ k qᵢ (r − rᵢ)/|r − rᵢ|³ */
  function fieldAt(cs, x, y) {
    var ex = 0, ey = 0, i;
    for (i = 0; i < cs.length; i++) {
      var dx = x - cs[i].x, dy = y - cs[i].y;
      var r2 = dx * dx + dy * dy, r = Math.sqrt(r2);
      if (r < 1e-9) continue;                 // 恰在电荷上：场发散，跳过（调用方保证不落到这里）
      var f = K_E * cs[i].q / (r2 * r);
      ex += f * dx; ey += f * dy;
    }
    return { x: ex, y: ey };
  }
  /** 点电荷组的电势（V）：V = Σ k qᵢ/|r − rᵢ| */
  function potAt(cs, x, y) {
    var v = 0, i;
    for (i = 0; i < cs.length; i++) {
      var dx = x - cs[i].x, dy = y - cs[i].y;
      var r = Math.sqrt(dx * dx + dy * dy);
      if (r < 1e-9) continue;
      v += K_E * cs[i].q / r;
    }
    return v;
  }
  /** 是否落在某个带电电荷的 rStop 邻域内（用于电场线终止） */
  function nearCharge(cs, x, y, rStop) {
    for (var i = 0; i < cs.length; i++) {
      if (cs[i].q === 0) continue;
      var dx = x - cs[i].x, dy = y - cs[i].y;
      if (dx * dx + dy * dy < rStop * rStop) return true;
    }
    return false;
  }
  /**
   * 追踪一条电场线：dr/ds = dir · Ê（dir=+1 顺着 E 从正电荷出发；dir=−1 逆着 E 回溯）。
   * 终止条件（缺一不可，保证不死循环）：出框 / 落到电荷上 / 到达中性点（|E|→0 或方向反转）/ 步数用尽。
   */
  function traceFieldLine(cs, x0, y0, dir, h, box, maxSteps, rStop, eFloor) {
    var xs = [], ys = [], x = x0, y = y0, px = 0, py = 0, hasPrev = false, i;
    for (i = 0; i < maxSteps; i++) {
      var e = fieldAt(cs, x, y);
      var mag = Math.sqrt(e.x * e.x + e.y * e.y);
      if (!isFinite(mag) || mag < eFloor) break;      // 中性点 / 数值异常
      var ux = dir * e.x / mag, uy = dir * e.y / mag;
      if (hasPrev && ux * px + uy * py < 0) break;    // 方向反转：已越过中性点
      px = ux; py = uy; hasPrev = true;
      if (i % 2 === 0) { xs.push(x); ys.push(y); }    // 隔点记录：步长 d/100，出图约 1 点/(d/50)
      x += ux * h; y += uy * h;
      if (!(Math.abs(x) < box && Math.abs(y) < box)) break;
      if (nearCharge(cs, x, y, rStop)) break;
    }
    xs.push(x); ys.push(y);
    return { x: xs, y: ys };
  }

  SIM.register("field-2d", {
    title: "两点电荷的场：轴向 V(x)、Eₓ(x) 与电场线",
    legend: "沿两电荷连线（x 轴）的轴向分布：电荷所在处 V ∝ 1/r、E ∝ 1/r² 发散，所以按 |x ∓ d/2| ≥ d/5 排除取样，" +
      "曲线在 x = ±d/2 处断开（折线连成尖峰）。由于 E 比 V 大 1/ρ 倍，同一坐标里 V 显得扁平。" +
      "下方是电场线（从正电荷附近出发、沿 E 方向追踪，终止于负电荷或边界）；q₁、q₂ 同号时中间会出现中性点。",
    axes: { xlabel: "x (m)（两电荷连线的轴向坐标）", ylabel: "V (V) / Eₓ (V/m)" },
    params: {
      q1: { label: "左电荷 q₁", unit: "nC", def: 5, min: -20, max: 20, step: 0.5 },
      q2: { label: "右电荷 q₂", unit: "nC", def: -5, min: -20, max: 20, step: 0.5 },
      d: { label: "间距 d", unit: "m", def: 0.4, min: 0.05, max: 2, step: 0.05 }
    },
    plots: [
      { key: "V", label: "电势 V (V)", color: "#5aa9ff" },
      { key: "Ex", label: "轴向场强 Eₓ (V/m)", color: "#ffb84d" }
    ],
    compute: function (p) {
      var q1 = p.q1 * NANO, q2 = p.q2 * NANO, d = p.d;
      var a = d / 2;                                  // 电荷位置 x = ∓a
      var cs = [{ x: -a, y: 0, q: q1 }, { x: a, y: 0, q: q2 }];
      var rho = d / 5;                                // 电荷附近不取样（发散区）
      var per = 401;
      var segs = [[-1.5 * d, -a - rho], [-a + rho, a - rho], [a + rho, 1.5 * d]];
      var t = [], V = [], Ex = [], s, i, xi, e;
      for (s = 0; s < segs.length; s++) {
        var xs = lin(segs[s][0], segs[s][1], per);
        for (i = 0; i < per; i++) {
          xi = xs[i];
          t.push(xi);
          V.push(potAt(cs, xi, 0));
          e = fieldAt(cs, xi, 0);
          Ex.push(e.x);
        }
      }
      var midE = fieldAt(cs, 0, 0).x;
      var midV = potAt(cs, 0, 0);
      var farV = potAt(cs, 100 * d, 0);                // r = 100d 处的电势（单极近似校核用）
      var pDip = a * (q2 - q1);                        // 偶极矩 p = Σ qᵢxᵢ

      /* ---- 电场线：从"源电荷"附近均匀撒起点，沿 E 方向追踪 ---- */
      var pos = [], neg = [], k;
      for (k = 0; k < cs.length; k++) {
        if (cs[k].q > 0) pos.push(cs[k]);
        else if (cs[k].q < 0) neg.push(cs[k]);
      }
      var src = pos.length ? pos : neg;                // 没有正电荷时从负电荷逆着 E 回溯
      var dir = pos.length ? 1 : -1;
      var lines = [];
      var eScale = K_E * (Math.abs(q1) + Math.abs(q2)) / (d * d);
      var eFloor = eScale * 1e-6;
      var r0 = d / 6, box = 1.5 * d, lineColor = "#7fd8e8";
      if (src.length) {
        var perQ = Math.max(4, Math.round(12 / src.length));
        for (s = 0; s < src.length; s++) {
          for (i = 0; i < perQ; i++) {
            var th = (2 * Math.PI * i) / perQ + Math.PI / perQ;   // 偏移，避免起点正好落在轴线上
            var ln = traceFieldLine(cs,
              src[s].x + r0 * Math.cos(th), src[s].y + r0 * Math.sin(th),
              dir, d / 100, box, 1000, d / 20, eFloor);
            ln.color = lineColor;
            ln.label = lines.length === 0 ? "电场线（共 " + (perQ * src.length) + " 条）" : "";
            lines.push(ln);
          }
        }
      }

      return {
        t: t, series: { V: V, Ex: Ex },
        info: [
          { k: "中点场强 Eₓ(0) = k(q₁−q₂)/(d/2)²", v: fmt(midE, 4) + " V/m" },
          { k: "中点电势 V(0)", v: fmt(midV, 4) + " V" },
          { k: "偶极矩 |p| = |q₂−q₁|d/2", v: fmt(Math.abs(pDip) * 1e9, 4) + " nC·m" },
          { k: "远场 r = 100d 处 V", v: fmt(farV, 4) + " V" },
          { k: "单极近似 k(q₁+q₂)/r", v: fmt((K_E * (q1 + q2)) / (100 * d), 4) + " V" },
          { k: "电场线条数", v: String(lines.length) + " 条（边长 3d 的方形区域）" }
        ],
        extra: {
          lines: lines,
          markers: [
            { x: -a, y: 0, label: "q₁=" + fmt(p.q1, 3) + " nC" },
            { x: a, y: 0, label: "q₂=" + fmt(p.q2, 3) + " nC" }
          ],
          xlabel: "x (m)", ylabel: "y (m)",
          title: "电场线（起点在电荷周围 r₀ = d/6 的圆周上）"
        },
        metrics: {
          midE: midE, midV: midV, farV: farV, p: pDip,
          q1: q1, q2: q2, d: d, a: a, rho: rho, nLine: lines.length
        }
      };
    },
    tests: [
      { name: "中点 Eₓ = k(q₁−q₂)/(d/2)² = 8.987551787e9×1e-8/0.2² = 2246.887947 V/m（q₁=+5 nC, q₂=−5 nC, d=0.4 m）",
        measure: function (o) {
          var i = nearestIndex(o.t, 0);
          if (Math.abs(o.t[i]) > 1e-9) return NaN;      // 中点不在采样点上就该报错
          return o.series.Ex[i];
        }, expect: 2246.88794675, tol: 2.3e-6 },
      { name: "q₂ = −q₁ 时中点电势 V(0) = k(q₁+q₂)/(d/2) = 0",
        measure: function (o) {
          var i = nearestIndex(o.t, 0);
          return o.series.V[i];
        }, expect: 0, tol: 1e-12 },
      { name: "远场：r = 100d 处 V 与单极近似 k(q₁+q₂)/r 的相对偏差 < 1%（q₁=q₂=+5 nC）",
        params: { q1: 5, q2: 5 },
        measure: function (o, p) {
          return o.metrics.farV / (K_E * (p.q1 + p.q2) * NANO / (100 * p.d));
        }, expect: 1, tol: 0.01 },
      { name: "同号等量电荷（q₁=q₂=+5 nC）中点 Eₓ = k(q₁−q₂)/(d/2)² = 0（中性点）",
        params: { q1: 5, q2: 5 },
        measure: function (o) {
          var i = nearestIndex(o.t, 0);
          return Math.abs(o.series.Ex[i]);
        }, expect: 0, tol: 1e-12 },
      { name: "同号电荷时电场线也全部有限步终止（无死循环、无 NaN/Inf）",
        params: { q1: 12, q2: 8 },
        measure: function (o) {
          var bad = 0, i, j;
          for (i = 0; i < o.extra.lines.length; i++) {
            bad += nonFinite(o.extra.lines[i].x) + nonFinite(o.extra.lines[i].y);
            if (o.extra.lines[i].x.length < 2) bad++;
          }
          return bad;
        }, expect: 0, tol: 0 },
      { name: "q₁=q₂=0 时全场为零（V、Eₓ 恒为 0，且无 NaN/Inf）",
        params: { q1: 0, q2: 0 },
        measure: function (o) {
          var i = nearestIndex(o.t, 0);
          return nonFinite(o.t) + nonFinite(o.series.V) + nonFinite(o.series.Ex) +
            maxAbs(o.series.V) + maxAbs(o.series.Ex) + Math.abs(o.series.Ex[i]);
        }, expect: 0, tol: 0 },
      { name: "q₁=q₂=0 时不产生电场线（撒点为空，直接返回）",
        params: { q1: 0, q2: 0 },
        measure: function (o) { return (o.extra.lines || []).length; }, expect: 0, tol: 0 }
    ]
  });

  /* ======================================================================
     2. rc-circuit —— RC 充放电（解析解）

     充电（t = 0 合上电源 V₀）：Vc(t) = V₀(1 − e^(−t/τ))，i(t) = (V₀/R) e^(−t/τ)
     放电（从 Vc = V₀ 开始）：  Vc(t) = V₀ e^(−t/τ)，    i(t) = −(V₀/R) e^(−t/τ)
     时间常数 τ = RC，半衰期 t½ = τ ln2，最终储能 ½CV₀²，
     电源做功 W = ∫V₀i dt = CV₀²，所以 储能/电源做功 = 1/2（与 R 无关，经典的"一半损耗"）。
     ====================================================================== */
  SIM.register("rc-circuit", {
    title: "RC 充放电：Vc(t) 与 i(t)",
    legend: "充电时 Vc 从 0 指数趋近 V₀、i 从 V₀/R 起指数衰减，两者的时间常数都是 τ = RC。" +
      "Vc 与 i 相差 R 倍（V 对 A），同轴显示时电流曲线贴着零线，下图把充/放电电流单独画清楚。",
    axes: { xlabel: "t (s)", ylabel: "Vc (V) / i (A)" },
    params: {
      R: { label: "电阻 R", unit: "Ω", def: 1000, min: 10, max: 1e6, step: 10 },
      C: { label: "电容 C", unit: "F", def: 1e-4, min: 1e-8, max: 1e-2, step: 1e-8 },
      V0: { label: "电源电压 V₀", unit: "V", def: 10, min: 1, max: 100, step: 1 }
    },
    plots: [
      { key: "Vc", label: "电容电压 Vc (V)", color: "#5aa9ff" },
      { key: "i", label: "电流 i (A)", color: "#ffb84d" }
    ],
    compute: function (p) {
      var R = p.R, C = p.C, V0 = p.V0;
      var tau = R * C;
      var span = 6 * tau;                       // 6τ 后偏差 e⁻⁶ ≈ 0.25%
      var n = 1201;                             // 偶数分段：t = τ 正好是采样点（n−1 = 1200 = 6×200）
      var t = lin(0, span, n);
      var Vc = [], i = [], id = [], k;
      var i0 = V0 / R;
      for (k = 0; k < n; k++) {
        var e = Math.exp(-t[k] / tau);
        Vc.push(V0 * (1 - e));                  // 充电电压
        i.push(i0 * e);                         // 充电电流
        id.push(-i0 * e);                       // 放电电流（从 Vc = V₀ 起放电，方向相反）
      }
      var eEnd = Math.exp(-6);
      var vcLast = Vc[n - 1];
      var eCap = 0.5 * C * vcLast * vcLast;     // 末点电容储能
      var wSrc = C * V0 * vcLast;               // W = ∫V₀ i dt = V₀·q = V₀·C·Vc
      return {
        t: t, series: { Vc: Vc, i: i },
        info: [
          { k: "时间常数 τ = RC", v: fmt(tau, 4) + " s" },
          { k: "Vc(τ)/V₀ = 1 − e⁻¹", v: fmt(Vc[nearestIndex(t, tau)] / V0, 6) },
          { k: "半衰期 t½ = τ ln2", v: fmt(tau * Math.LN2, 4) + " s" },
          { k: "初始电流 i(0) = V₀/R", v: fmt(i0, 6) + " A" },
          { k: "最终储能 ½CV₀²", v: fmt(0.5 * C * V0 * V0, 4) + " J" },
          { k: "电源做功 CV₀²", v: fmt(C * V0 * V0, 4) + " J" },
          { k: "t = 6τ 时剩余偏差 e⁻⁶", v: fmt(eEnd, 6) + "（≈" + fmt(eEnd * 100, 3) + "%）" }
        ],
        bars: [
          { label: "电容储能 ½CVc²（t=6τ）", value: eCap, color: "#5aa9ff", unit: "J" },
          { label: "电源做功 V₀q（t=6τ）", value: wSrc, color: "#63d6a5", unit: "J" },
          { label: "电阻耗散（差值）", value: Math.max(0, wSrc - eCap), color: "#ff7b7b", unit: "J" }
        ],
        extra: {
          lines: [
            { x: t, y: i, label: "充电 i(t)", color: "#ffb84d" },
            { x: t, y: id, label: "放电 i(t) = −(V₀/R)e^(−t/τ)", color: "#ff7b7b", dash: "6 4" }
          ],
          xlabel: "t (s)", ylabel: "i (A)",
          title: "电流（同一量纲）：充电从 V₀/R 衰减，放电从 −V₀/R 反向衰减"
        },
        metrics: {
          tau: tau, i0: i0, vcLast: vcLast, eEnd: eEnd, iDis: id,
          eCapInf: 0.5 * C * V0 * V0, wSrcInf: C * V0 * V0
        }
      };
    },
    tests: [
      { name: "τ 从曲线反推：ln(V₀−Vc) 对 t 线性回归的斜率 = −1/τ（τ = RC = 1000 Ω × 1e-4 F = 0.1 s）",
        measure: function (o, p) {
          var n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0, k;
          for (k = 0; k < o.t.length; k++) {
            var y = Math.log(p.V0 - o.series.Vc[k]);
            n++; sx += o.t[k]; sy += y; sxx += o.t[k] * o.t[k]; sxy += o.t[k] * y;
          }
          return -1 / ((n * sxy - sx * sy) / (n * sxx - sx * sx));
        }, expect: 0.1, tol: 1e-9 },
      { name: "Vc(τ)/V₀ = 1 − e⁻¹ = 0.6321205588（从 series 取 t = τ 的采样点）",
        measure: function (o, p) {
          var i = nearestIndex(o.t, o.metrics.tau);
          if (Math.abs(o.t[i] - o.metrics.tau) > 1e-12) return NaN;
          return o.series.Vc[i] / p.V0;
        }, expect: 0.6321205588285577, tol: 1e-9 },
      { name: "i(0) = V₀/R = 10 V / 1000 Ω = 0.01 A（series 首点）",
        measure: function (o) { return o.series.i[0]; }, expect: 0.01, tol: 1e-12 },
      { name: "Vc(∞) → V₀：末点 t = 6τ 时剩余偏差 (V₀−Vc)/V₀ = e⁻⁶ = 0.0024787522",
        measure: function (o, p) {
          return (p.V0 - o.series.Vc[o.series.Vc.length - 1]) / p.V0;
        }, expect: 0.0024787521766663585, tol: 1e-9 },
      { name: "最终储能与电源做功之比 = ½：½CVc²/(V₀q) = Vc/(2V₀) → ½（t=6τ 时 (1−e⁻⁶)/2）",
        measure: function (o, p) {
          var vc = o.series.Vc[o.series.Vc.length - 1];
          return (0.5 * p.C * vc * vc) / (p.C * p.V0 * vc);
        }, expect: 0.4987606239116668, tol: 1e-9 }
    ]
  });

  /* ======================================================================
     3. rlc-circuit —— 串联 RLC 阶跃响应（RK4）

     电路方程：L q″ + R q′ + q/C = V₀（t = 0 接入直流电源），q(0) = 0，i(0) = 0。
     记 ω₀ = 1/√(LC)（固有角频率）、γ = R/(2L)（阻尼率），特征根 s = −γ ± √(γ²−ω₀²)：
       · γ < ω₀ 欠阻尼：ω_d = √(ω₀²−γ²)，q = CV₀[1 − e^(−γt)(cos ω_d t + (γ/ω_d) sin ω_d t)]
       · γ = ω₀ 临界阻尼：q = CV₀[1 − e^(−γt)(1 + γt)]
       · γ > ω₀ 过阻尼：慢模 λ₋ = ω₀²/λ₊（λ₊ = γ + √(γ²−ω₀²)），q 单调趋近 CV₀

     能量：储能 E = ½Li² + q²/(2C) 在阶跃响应里是**上升**的（电源在供电），
     真正单调不增的是含源能量函数 E* = ½Li² + q²/(2C) − V₀q（d(E*)/dt = −Ri² ≤ 0）。

     积分步长：显式 RK4 必须让 h·λ₊ ≲ 2.8 才稳定（λ₊ 是衰减最快的模），
     所以 h 由 λ₊ 定，观察窗口由慢模 λ₋ 定（9/λ₋，保证 q 走到 CV₀ 的 1e-3 以内）；
     两者冲突（γ ≫ ω₀ 的极硬情形）时按步数预算缩短窗口并在读数里说明。
     ====================================================================== */
  /** 串联 RLC 阶跃响应的解析解（自检用，独立于 RK4） */
  function rlcAnalytic(L, C, R, V0, t) {
    var w0 = 1 / Math.sqrt(L * C), g = R / (2 * L);
    var disc = g * g - w0 * w0;
    if (Math.abs(disc) <= 1e-12 * w0 * w0) {                 // 临界阻尼
      return C * V0 * (1 - Math.exp(-g * t) * (1 + g * t));
    }
    if (disc < 0) {                                          // 欠阻尼
      var wd = Math.sqrt(-disc);
      return C * V0 * (1 - Math.exp(-g * t) * (Math.cos(wd * t) + (g / wd) * Math.sin(wd * t)));
    }
    var rt = Math.sqrt(disc), lp = g + rt, lm = (w0 * w0) / lp;   // λ₊λ₋ = ω₀²（避免相减相消）
    return C * V0 * (1 - (lp * Math.exp(-lm * t) - lm * Math.exp(-lp * t)) / (lp - lm));
  }

  SIM.register("rlc-circuit", {
    title: "串联 RLC 阶跃响应：q(t) 与 i(t)",
    legend: "接入直流电源后电容电荷趋于 CV₀。R 小则欠阻尼（围绕 CV₀ 振荡，ω_d = √(ω₀²−γ²)），" +
      "R 大则过阻尼（单调爬升，特征是慢模 λ₋ = ω₀²/λ₊）。R = 2√(L/C) 是临界阻尼。",
    axes: { xlabel: "t (s)", ylabel: "q (C) / i (A)" },
    params: {
      R: { label: "电阻 R", unit: "Ω", def: 50, min: 1, max: 500, step: 1 },
      L: { label: "电感 L", unit: "H", def: 0.1, min: 0.001, max: 2, step: 0.001 },
      C: { label: "电容 C", unit: "F", def: 1e-3, min: 1e-6, max: 0.1, step: 1e-6 },
      V0: { label: "电源电压 V₀", unit: "V", def: 10, min: 1, max: 100, step: 1 }
    },
    plots: [
      { key: "q", label: "电荷 q (C)", color: "#5aa9ff" },
      { key: "i", label: "电流 i (A)", color: "#ffb84d" }
    ],
    compute: function (p) {
      var L = p.L, C = p.C, R = p.R, V0 = p.V0;
      var w0 = 1 / Math.sqrt(L * C);
      var g = R / (2 * L);
      var disc = g * g - w0 * w0;
      var under = disc < 0;
      var wd = under ? Math.sqrt(-disc) : 0;
      var root = Math.sqrt(Math.max(disc, 0));
      var lFast = g + root;                       // 快模衰减率（显式积分的稳定步长由它定）
      var lSlow = under ? g : (w0 * w0) / lFast;  // 慢模衰减率（观察窗口由它定）
      if (!(lSlow > 0)) lSlow = g;
      var qInf = C * V0;

      var span = 9 / lSlow;                       // 9 个慢时间常数 → 偏差 e⁻⁹
      if (under && wd > 0.2 * w0) span = Math.max(span, 2.6 * (2 * Math.PI) / wd);
      var hStab = 2.6 / lFast;
      var hWant = Math.min(hStab, span / 4000);
      if (under && wd > 0) hWant = Math.min(hWant, ((2 * Math.PI) / wd) / 400);
      var nRaw = Math.ceil(span / hWant);
      var NMAX = 60000;
      var shrunk = false;
      if (nRaw > NMAX) { span *= NMAX / nRaw; nRaw = NMAX; shrunk = true; }

      var f = function (t, y) {
        return [y[1], (V0 - y[0] / C - R * y[1]) / L];
      };
      var sol = rk4(f, [0, 0], 0, span, nRaw);
      var th = thin(sol.t, { q: sol.y[0], i: sol.y[1] }, 2000);
      var t = th.t, q = th.series.q, i = th.series.i;
      var eStore = [], eLyap = [], k;
      for (k = 0; k < t.length; k++) {
        var es = 0.5 * L * i[k] * i[k] + (q[k] * q[k]) / (2 * C);
        eStore.push(es);
        eLyap.push(es - V0 * q[k]);               // dE*/dt = −R i² ≤ 0
      }
      var damp = Math.abs(g - w0) <= 1e-9 * w0 ? "临界阻尼" : (g < w0 ? "欠阻尼（振荡）" : "过阻尼");
      return {
        t: t, series: { q: q, i: i },
        info: [
          { k: "固有角频率 ω₀ = 1/√(LC)", v: fmt(w0, 4) + " rad/s" },
          { k: "阻尼率 γ = R/(2L)", v: fmt(g, 4) + " rad/s" },
          { k: "阻尼类型", v: damp },
          { k: "阻尼角频率 ω_d = √(ω₀²−γ²)", v: under ? fmt(wd, 4) + " rad/s" : "—（无振荡）" },
          { k: "临界电阻 2√(L/C)", v: fmt(2 * Math.sqrt(L / C), 4) + " Ω" },
          { k: "最终电荷 q(∞) → CV₀", v: fmt(qInf, 5) + " C（末点 " + fmt(q[q.length - 1], 5) + " C）" },
          { k: "观察窗口", v: fmt(span, 4) + " s（" + String(nRaw) + " 步 RK4" + (shrunk ? "，已按步数预算缩短" : "") + "）" }
        ],
        bars: [
          { label: "末点电容储能 q²/(2C)", value: (q[q.length - 1] * q[q.length - 1]) / (2 * C), color: "#5aa9ff", unit: "J" },
          { label: "末点电感储能 ½Li²", value: 0.5 * L * i[i.length - 1] * i[i.length - 1], color: "#ffb84d", unit: "J" },
          { label: "末点含源能量 E* = 储能 − V₀q", value: eLyap[eLyap.length - 1], color: "#ff7b7b", unit: "J" }
        ],
        extra: {
          lines: [
            { x: t, y: q, label: "电荷 q(t)", color: "#5aa9ff" },
            { x: t, y: q.map(function () { return qInf; }), label: "渐近值 CV₀", color: "#63d6a5", dash: "6 4" }
          ],
          xlabel: "t (s)", ylabel: "q (C)",
          title: "q(t) 单独坐标系：电流比电荷大一个量级，主图里 q 被压扁"
        },
        metrics: {
          w0: w0, gamma: g, wd: wd, under: under, disc: disc,
          lFast: lFast, lSlow: lSlow, span: span, n: nRaw, qInf: qInf,
          damping: damp, energy: eStore, energyLyap: eLyap
        }
      };
    },
    tests: [
      { name: "ω₀ = 1/√(LC) = 1/√(0.1 × 1e-3) = 100 rad/s",
        measure: function (o) { return o.metrics.w0; }, expect: 100, tol: 1e-9 },
      { name: "R = 10 Ω 时 γ = R/(2L) = 50 rad/s",
        params: { R: 10 },
        measure: function (o) { return o.metrics.gamma; }, expect: 50, tol: 1e-9 },
      { name: "R = 10 Ω 欠阻尼：ω_d = √(ω₀²−γ²) = √7500 = 86.602540 rad/s，与曲线周期 2π/ω_d 一致（过零点现算）",
        params: { R: 10 },
        measure: function (o) {
          var dev = [], k, cr;
          for (k = 0; k < o.series.q.length; k++) dev.push(o.series.q[k] - o.metrics.qInf);
          cr = crossings(o.t, dev, 1);
          if (cr.length < 2) return NaN;
          return (2 * Math.PI) / meanSpacing(cr);
        }, expect: 86.6025404, tol: 0.1 },
      { name: "R = 50 Ω 过阻尼：q 单调趋近 CV₀ 而不越过（q − CV₀ 的过零次数 = 0）",
        measure: function (o) {
          var dev = [], k;
          for (k = 0; k < o.series.q.length; k++) dev.push(o.series.q[k] - o.metrics.qInf);
          return crossings(o.t, dev, 1).length + crossings(o.t, dev, -1).length;
        }, expect: 0, tol: 0 },
      { name: "耗散单调性：E* = ½Li² + q²/(2C) − V₀q 满足 dE*/dt = −Ri² ≤ 0（数值回升 < 1e-6 相对量）",
        measure: function (o) { return maxRise(o.metrics.energyLyap); }, expect: 0, tol: 1e-6 },
      { name: "q(∞) → CV₀ = 0.01 C（末点相对偏差 < 1e-3）",
        measure: function (o) { return o.series.q[o.series.q.length - 1] / o.metrics.qInf; },
        expect: 1, tol: 1e-3 },
      { name: "RK4 数值解 vs 解析解 q(t) = CV₀[1 − e^(−γt)(cos ω_d t + (γ/ω_d)sin ω_d t)]，最大相对偏差 < 1e-5（R=10 Ω）",
        params: { R: 10 },
        measure: function (o, p) {
          var m = 0, k, a;
          for (k = 0; k < o.t.length; k++) {
            a = rlcAnalytic(p.L, p.C, p.R, p.V0, o.t[k]);
            m = Math.max(m, Math.abs(o.series.q[k] - a) / o.metrics.qInf);
          }
          return m;
        }, expect: 0, tol: 1e-5 },
      { name: "RK4 数值解 vs 过阻尼解析解 q(t) = CV₀[1 − (λ₊e^(−λ₋t) − λ₋e^(−λ₊t))/(λ₊−λ₋)]，最大相对偏差 < 1e-5（默认 R=50 Ω）",
        measure: function (o, p) {
          var m = 0, k, a;
          for (k = 0; k < o.t.length; k++) {
            a = rlcAnalytic(p.L, p.C, p.R, p.V0, o.t[k]);
            m = Math.max(m, Math.abs(o.series.q[k] - a) / o.metrics.qInf);
          }
          return m;
        }, expect: 0, tol: 1e-5 }
    ]
  });

  /* ======================================================================
     4. charged-particle —— 带电粒子在 E、B 场中的轨道

     取 B = (0,0,B)（沿 z）、E = (E,0,0)（沿 x，故 E ⊥ B），运动方程
       m dv/dt = q(E + v×B)  →  aₓ = (q/m)(E + v_y B)，a_y = −(q/m) vₓ B
     结果：
       · B ≠ 0、q ≠ 0：回旋半径 r = m v⊥/(|q|B)、周期 T = 2πm/(|q|B)（与速率无关，回旋加速器的原理）；
       · E = 0：速率恒定（洛伦兹力不做功）；
       · E ⊥ B：叠加一个漂移速度 v_d = E×B/B²，大小 E/B、方向垂直于 E 与 B（与电荷正负无关）；
       · q = 0 或 B = 0：退化为直线 / 匀加速直线（不做除零：公式里只有 m 在分母，m ≥ 0.2）。
     ====================================================================== */
  SIM.register("charged-particle", {
    title: "带电粒子在 E、B 场中的轨道（回旋 / 螺旋 / 漂移）",
    legend: "B 沿 z、E 沿 x。只有 B 时是圆周运动（周期与速率无关）；再加上 E 就叠加一个 E×B 漂移，" +
      "轨道变成翻卷的摆线。E = 0 时速率严格不变（洛伦兹力不做功）；B = 0 则沿 E 匀加速。",
    axes: { xlabel: "t (s)", ylabel: "x (m) / y (m)" },
    params: {
      q: { label: "电荷量 q", unit: "相对", def: 1, min: -3, max: 3, step: 0.1 },
      m: { label: "质量 m", unit: "相对", def: 1, min: 0.2, max: 5, step: 0.05 },
      E: { label: "电场 E（沿 x）", unit: "V/m", def: 0, min: -5, max: 5, step: 0.1 },
      B: { label: "磁场 B（沿 z）", unit: "T", def: 1, min: -3, max: 3, step: 0.1 },
      v0: { label: "初速度 v₀（沿 x）", unit: "m/s", def: 1, min: 0.1, max: 5, step: 0.05 }
    },
    plots: [
      { key: "x", label: "x (m)", color: "#5aa9ff" },
      { key: "y", label: "y (m)", color: "#ffb84d" }
    ],
    compute: function (p) {
      var q = p.q, m = p.m, E = p.E, B = p.B, v0 = p.v0;
      var wc = (Math.abs(q) * Math.abs(B)) / m;          // ω_c = |q|B/m
      var Tc = wc > 0 ? (2 * Math.PI) / wc : 0;          // T = 2πm/(|q|B)
      var span = wc > 0 ? 3 * Tc : 6;                    // 有磁场看 3 个周期；否则固定窗口看匀加速
      var n = 2400;
      var f = function (t, s) {
        return [s[2], s[3], (q / m) * (E + s[3] * B), -(q / m) * s[2] * B];
      };
      var sol = rk4(f, [0, 0, v0, 0], 0, span, n);
      var xs = sol.y[0], ys = sol.y[1], vx = sol.y[2], vy = sol.y[3];
      var speed = [], k;
      for (k = 0; k < n; k++) speed.push(Math.sqrt(vx[k] * vx[k] + vy[k] * vy[k]));
      var rG = wc > 0 ? (m * v0) / (Math.abs(q) * Math.abs(B)) : Infinity;   // r = mv⊥/(|q|B)
      var vDriftY = Math.abs(B) > 0 ? -E / B : 0;        // v_d = E×B/B² = (0, −E/B, 0)
      var ekEnd = 0.5 * m * speed[n - 1] * speed[n - 1];
      return {
        t: sol.t, series: { x: xs, y: ys },
        info: [
          { k: "回旋半径 r = m v₀/(|q|B)", v: wc > 0 ? fmt(rG, 4) + " m" : "—（无磁场或无电荷：直线）" },
          { k: "回旋周期 T = 2πm/(|q|B)", v: wc > 0 ? fmt(Tc, 4) + " s" : "—（同上）" },
          { k: "漂移速度 |E×B|/B² = |E|/|B|", v: Math.abs(B) > 0 ? fmt(Math.abs(E / B), 4) + " m/s（方向 " + (vDriftY > 0 ? "+y" : vDriftY < 0 ? "−y" : "无") + "）" : "—（B=0：沿 E 匀加速）" },
          { k: "回旋角频率 ω_c = |q|B/m", v: wc > 0 ? fmt(wc, 4) + " rad/s" : "0" },
          { k: "初速率 / 末速率", v: fmt(v0, 5) + " / " + fmt(speed[n - 1], 5) + " m/s" },
          { k: "观察窗口", v: fmt(span, 4) + " s（" + String(n) + " 步 RK4）" }
        ],
        bars: [
          { label: "初动能 ½mv₀²", value: 0.5 * m * v0 * v0, color: "#5aa9ff", unit: "（相对单位）" },
          { label: "末动能 ½mv²", value: ekEnd, color: "#ffb84d", unit: "（相对单位）" }
        ],
        extra: {
          lines: [{ x: xs, y: ys, label: "轨道 (x–y)", color: "#63d6a5" }],
          markers: [{ x: xs[0], y: ys[0], label: "起点" }],
          xlabel: "x (m)", ylabel: "y (m)",
          title: "轨道形状：B=0 直线 / 只有 B 圆周 / E⊥B 时摆线（E×B 漂移）"
        },
        metrics: {
          r: rG, Tc: Tc, wc: wc, span: span, speed: speed,
          vDriftY: vDriftY, drift: Math.abs(B) > 0 ? Math.abs(E / B) : 0
        }
      };
    },
    tests: [
      { name: "回旋半径 r = mv/(|q|B) = 1 m（q=m=v₀=B=1；从轨道 x 的峰谷差现算）",
        measure: function (o) { return halfRange(o.series.x); }, expect: 1, tol: 1e-4 },
      { name: "回旋周期 T = 2πm/(|q|B) = 2π = 6.283185 s（x 的同向过零点间距）",
        measure: function (o) {
          var cr = crossings(o.t, o.series.x, 1);
          if (cr.length < 2) return NaN;
          return meanSpacing(cr);
        }, expect: 6.283185307179586, tol: 1e-3 },
      { name: "E = 0 时速率恒定（洛伦兹力不做功）：相对漂移 < 1e-9",
        measure: function (o) { return relDrift(o.metrics.speed); }, expect: 0, tol: 1e-9 },
      { name: "E ⊥ B 时漂移速度 = E/B = 1 m/s（走整数个周期，位移/时间 = 漂移）",
        params: { E: 1, B: 1 },
        measure: function (o) {
          var y0 = o.series.y[0], y1 = o.series.y[o.series.y.length - 1];
          var t0 = o.t[0], t1 = o.t[o.t.length - 1];
          return Math.abs((y1 - y0) / (t1 - t0));
        }, expect: 1, tol: 1e-2 },
      { name: "漂移与电荷正负无关：q = −2 时仍有 |v_d| = E/B = 1 m/s",
        params: { q: -2, E: 1, B: 1 },
        measure: function (o) {
          var y0 = o.series.y[0], y1 = o.series.y[o.series.y.length - 1];
          return Math.abs((y1 - y0) / (o.t[o.t.length - 1] - o.t[0]));
        }, expect: 1, tol: 1e-2 },
      { name: "负电荷：r = mv/(|q|B) = 1/(2×1) = 0.5 m（|q| 在公式里）",
        params: { q: -2 },
        measure: function (o) { return halfRange(o.series.x); }, expect: 0.5, tol: 1e-4 },
      { name: "负电荷：T = 2πm/(|q|B) = π = 3.141593 s",
        params: { q: -2 },
        measure: function (o) {
          var cr = crossings(o.t, o.series.x, 1);
          if (cr.length < 2) return NaN;
          return meanSpacing(cr);
        }, expect: 3.141592653589793, tol: 1e-3 },
      { name: "q = 0 退化为直线（无力，y 恒为 0）",
        params: { q: 0, E: 2, B: 1 },
        measure: function (o) { return maxAbs(o.series.y); }, expect: 0, tol: 1e-12 },
      { name: "B = 0 退化为沿 E 的匀加速：x(t) = v₀t + ½(qE/m)t²",
        params: { B: 0, E: 1, q: 1, m: 1, v0: 1 },
        measure: function (o, p) {
          var T = o.metrics.span, xEnd = o.series.x[o.series.x.length - 1];
          return xEnd - (p.v0 * T + 0.5 * (p.q * p.E / p.m) * T * T);
        }, expect: 0, tol: 1e-9 },
      { name: "q ≠ 0、B ≠ 0 时全程无 NaN/Inf",
        params: { q: 3, m: 0.2, E: 5, B: -3, v0: 5 },
        measure: function (o) {
          return nonFinite(o.t) + nonFinite(o.series.x) + nonFinite(o.series.y) +
            nonFinite(o.metrics.speed);
        }, expect: 0, tol: 0 }
    ]
  });

  /* ======================================================================
     5. em-wave —— 电磁波 E ⊥ B ⊥ k

     沿 +x 传播的平面波（介质折射率 n，v = c/n）：
       E(x,t) = E₀ cos(kx − ωt)（沿 y 振动）      B(x,t) = (E₀/v) cos(kx − ωt)（沿 z 振动）
       k = 2π/λ，ω = 2πf，f = v/λ = c/(nλ)，振幅比 E₀/B₀ = v = 1/√(εμ)
     能量密度：u_E = ½εE₀² = ½n²ε₀E₀²，u_B = B₀²/(2μ₀) = ½n²ε₀E₀² —— 两者恒相等（用 μ₀ε₀ = 1/c²）。
     注意 B 的数值比 E 小 v 倍（1 V/m ↔ 3.34 nT），同轴画图时 B 几乎贴着零线，
     所以第二张图把 B 乘 v 后与 E 比较：两条曲线完全重合，这正是"同相、振幅比 = v"。
     ====================================================================== */
  SIM.register("em-wave", {
    title: "电磁波：E ⊥ B ⊥ k（横波）",
    legend: "E 与 B 同相、互相垂直、都垂直于传播方向，振幅比 E₀/B₀ = v = c/n。" +
      "B 的数值比 E 小 v 倍，同轴时看不见；下图用 B·v 与 E 叠在一起（完全重合），另一条虚线是 t + T/4 时刻的 E。",
    axes: { xlabel: "x (m)（传播方向）", ylabel: "E (V/m) / B (T)（相差 v 倍，见下图）" },
    params: {
      E0: { label: "振幅 E₀", unit: "V/m", def: 1, min: 0.1, max: 10, step: 0.1 },
      lambda: { label: "波长 λ", unit: "m", def: 1, min: 0.1, max: 10, step: 0.01 },
      n: { label: "折射率 n", unit: "", def: 1, min: 1, max: 3, step: 0.01 },
      t: { label: "时刻 t", unit: "s", def: 0, min: 0, max: 5, step: 1e-9 }
    },
    plots: [
      { key: "E", label: "电场 E (V/m)", color: "#5aa9ff" },
      { key: "B", label: "磁场 B (T)", color: "#ffb84d" }
    ],
    compute: function (p) {
      var v = C_LIGHT / p.n;                       // 介质中相速 v = c/n
      var k = (2 * Math.PI) / p.lambda;            // 波数
      var omega = 2 * Math.PI * (v / p.lambda);    // 角频率 ω = 2πf，f = v/λ
      var N = 1201, xmax = 3 * p.lambda;           // 画 3 个波长；N−1 = 1200 = 3×400
      var xs = lin(0, xmax, N);
      var E = [], B = [], Bv = [], Eshift = [], i;
      var b0 = p.E0 / v;
      for (i = 0; i < N; i++) {
        var phase = k * xs[i] - omega * p.t;
        var c = Math.cos(phase);
        E.push(p.E0 * c);
        B.push(b0 * c);
        Bv.push(b0 * c * v);                       // B·v：与 E 同量纲，便于叠图
        Eshift.push(p.E0 * Math.cos(phase - Math.PI / 2));   // t + T/4 时刻：波形前进 λ/4
      }
      var f = v / p.lambda;
      var uE = 0.5 * EPS0 * p.n * p.n * p.E0 * p.E0;
      var uB = (0.5 * b0 * b0) / MU0;
      return {
        t: xs, series: { E: E, B: B },
        info: [
          { k: "相速 v = c/n", v: fmt(v, 6) + " m/s" },
          { k: "频率 f = v/λ", v: fmt(f, 6) + " Hz" },
          { k: "振幅比 E₀/B₀ = v", v: fmt(p.E0 / b0, 6) + " m/s" },
          { k: "波数 k = 2π/λ", v: fmt(k, 6) + " rad/m" },
          { k: "周期 T = 1/f = λ/v", v: fmt(1 / f, 4) + " s" },
          { k: "磁场振幅 B₀ = E₀/v", v: fmt(b0, 4) + " T" },
          { k: "能量密度 u_E = ½n²ε₀E₀²", v: fmt(uE, 4) + " J/m³" },
          { k: "能量密度 u_B = B₀²/(2μ₀)", v: fmt(uB, 4) + " J/m³" }
        ],
        bars: [
          { label: "电场能量密度 ½εE₀²", value: uE, color: "#5aa9ff", unit: "J/m³" },
          { label: "磁场能量密度 B₀²/(2μ₀)", value: uB, color: "#ffb84d", unit: "J/m³" }
        ],
        extra: {
          lines: [
            { x: xs, y: E, label: "E(x)", color: "#5aa9ff" },
            { x: xs, y: Bv, label: "B·v（与 E 完全重合 ⇒ E = vB）", color: "#ffb84d", dash: "6 4" },
            { x: xs, y: Eshift, label: "E(x, t+T/4)（波形前进 λ/4）", color: "#63d6a5", dash: "2 3" }
          ],
          xlabel: "x (m)", ylabel: "E (V/m) 与 B·v (V/m)",
          title: "把 B 乘 v 后与 E 叠在一起：两条曲线完全重合（同相、同振幅关系）"
        },
        metrics: { v: v, k: k, omega: omega, f: f, b0: b0, xmax: xmax, N: N }
      };
    },
    tests: [
      { name: "振幅比 E₀/B₀ = v = c/n = 2.99792458e8 m/s（n=1，从 series 峰值现算）",
        measure: function (o) { return maxAbs(o.series.E) / maxAbs(o.series.B); },
        expect: C_LIGHT, tol: 300 },
      { name: "介质中 v = c/n（n=2 → 1.49896229e8 m/s）",
        params: { n: 2 },
        measure: function (o) { return maxAbs(o.series.E) / maxAbs(o.series.B); },
        expect: C_LIGHT / 2, tol: 150 },
      { name: "f = v/λ = c/(nλ)（n=1.5、λ=2 m → 9.993082e7 Hz）",
        params: { n: 1.5, lambda: 2 },
        measure: function (o, p) { return (maxAbs(o.series.E) / maxAbs(o.series.B)) / p.lambda; },
        expect: C_LIGHT / 3, tol: 0.5 },
      { name: "同向过零点间距 = λ = 1 m（波数 k = 2π/λ）",
        measure: function (o) {
          var cr = crossings(o.t, o.series.E, 1);
          if (cr.length < 2) return NaN;
          return meanSpacing(cr);
        }, expect: 1, tol: 1e-6 },
      { name: "E 与 B 同相：归一化逐点最大差 = 0（同时过零、同时到峰）",
        measure: function (o) {
          var me = maxAbs(o.series.E), mb = maxAbs(o.series.B), m = 0, i;
          for (i = 0; i < o.series.E.length; i++) {
            m = Math.max(m, Math.abs(o.series.E[i] / me - o.series.B[i] / mb));
          }
          return m;
        }, expect: 0, tol: 1e-12 },
      { name: "空间周期性 E(x+λ) = E(x)（λ=0.5 m，间隔 400 个采样点正好一个波长）",
        params: { lambda: 0.5 },
        measure: function (o) {
          var m = 0, i, N = o.series.E.length;
          for (i = 0; i + 400 < N; i++) {
            m = Math.max(m, Math.abs(o.series.E[i + 400] - o.series.E[i]));
          }
          return m;
        }, expect: 0, tol: 1e-12 },
      { name: "任意参数组合下 E、B 无 NaN/Inf（E₀=10、n=3、t=5 s）",
        params: { E0: 10, n: 3, t: 5 },
        measure: function (o) { return nonFinite(o.t) + nonFinite(o.series.E) + nonFinite(o.series.B); },
        expect: 0, tol: 0 }
    ]
  });

})(typeof window !== "undefined" ? window : globalThis);
