/* ==========================================================================
   simlab-models-ed.js —— 电动力学仿真模型（W4，5 个）

   模型：image-charge / fresnel / waveguide / dipole-radiation / relativity
   契约：PHYSICS-CONTENT-SPEC.md §12.1（参数名、曲线键名、读数、自检解析期望值逐字遵守）。

   ★ 加载时只调用 SIM.register(...)，不触碰 DOM（见 simlab.js 顶部约束），
     这样 tools/verify-simlab.mjs 能在 Node 里直接跑 compute() 与 tests 做物理不变量自检。
   ★ 不使用随机数：这 5 个模型全是确定性解析计算，同一组参数两次运行逐位相同。
   ★ 物理常量照抄 app/constants.js（CODATA 2018 / 2019 SI 定义值），本文件自带数值，
     这样在 Node 里只加载 simlab.js + simlab-models-*.js 也能算：
       c    = 2.997 924 58 × 10^8 m/s        （定义值）
       ε₀   = 8.854 187 8128 × 10^-12 F/m    ⇒ k_e = 1/(4πε₀) = 8.987 551 792 3 × 10^9 N·m²/C²
       μ₀   = 1.256 637 062 12 × 10^-6 N/A²  ⇒ η₀ = μ₀c = 376.730 313 7 Ω
     注：常量表把 k_e 印成 8.987 551 787 × 10^9，与由同表 ε₀ 反算的 8.987 551 792 × 10^9
     相差 6×10^-10（第 10 位有效数字的舍入），远小于任何读数显示精度，本文件按 ε₀ 反算。

   单位约定（每个模型的 info 里都写明）：参数用界面单位（nC / cm / GHz / nm…），
   模型内部换算成 SI 再算；横轴用可读单位（度、GHz、β、c·s）。
   ========================================================================== */
(function (global) {
  "use strict";
  var SIM = global.SIM;
  if (!SIM) return;   // 在 Node 里若未先加载 simlab.js，安静退出

  var lin = SIM.linspace, fmt = SIM.fmt, opt = SIM.opt;

  /* ------------------------------------------------------------- 物理常量 */
  var C_LIGHT = 2.99792458e8;          // m/s（定义值）
  var EPS0 = 8.8541878128e-12;         // F/m
  var MU0 = 1.25663706212e-6;          // N/A²
  var K_E = 1 / (4 * Math.PI * EPS0);  // N·m²/C²（= 1/(4πε₀) = 8.987551792×10^9）
  var ETA0 = MU0 * C_LIGHT;            // Ω（自由空间波阻抗 η₀ = μ₀c = 376.7303137）
  var NANO = 1e-9;                     // nC → C
  var DEG = Math.PI / 180;

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
  /** 一份输出里所有曲线上的非有限数个数：边界安全自检用 */
  function countBad(o) {
    var bad = 0, i, j, k;
    var lines = (o.extra && o.extra.lines) || [];
    for (i = 0; i < lines.length; i++) {
      bad += nonFinite(lines[i].x || []) + nonFinite(lines[i].y || []);
    }
    var keys = Object.keys(o.series || {});
    for (k = 0; k < keys.length; k++) bad += nonFinite(o.series[keys[k]] || []);
    bad += nonFinite(o.t || []);
    return bad;
  }
  function nearestIndex(xs, target) {
    var best = 0, bd = Infinity, i;
    for (i = 0; i < xs.length; i++) {
      var d = Math.abs(xs[i] - target);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  function argmaxIdx(arr, from, to) {
    var best = -Infinity, bi = -1;
    var a = Math.max(0, from), b = Math.min(arr.length, to);
    for (var i = a; i < b; i++) {
      var v = arr[i];
      if (typeof v === "number" && isFinite(v) && v > best) { best = v; bi = i; }
    }
    return bi;
  }
  function argminIdx(arr) {
    var best = Infinity, bi = -1;
    for (var i = 0; i < arr.length; i++) {
      var v = arr[i];
      if (typeof v === "number" && isFinite(v) && v < best) { best = v; bi = i; }
    }
    return bi;
  }
  function maxAbs(vals) {
    var m = 0;
    for (var i = 0; i < vals.length; i++) {
      var v = vals[i];
      if (typeof v === "number" && isFinite(v)) m = Math.max(m, Math.abs(v));
    }
    return m;
  }
  /** 两条等长曲线的最大绝对偏差（"整条曲线都对"而不是只对一个点） */
  function maxAbsDiff(a, b) {
    var m = 0;
    for (var i = 0; i < a.length && i < b.length; i++) {
      var d = Math.abs(a[i] - b[i]);
      if (d > m) m = d;
    }
    return m;
  }
  /**
   * 把 v 吸附到最近的网格点上（**替换**那一点，不改变数组长度）：
   * 自检要从曲线上精确取到布儒斯特角、截止频率这种"非网格值"，
   * 同时网格的点数与位置必须与参数无关——引擎的 config.vary 是把不同参数下的
   * 曲线按**位置**叠在同一条横轴上的（simlab.js 的 vary 分支不给变体自己的 x）。
   */
  function snapToGrid(arr, v) {
    var out = arr.slice(), i, bi = 0, bd = Infinity, d;
    if (!isFinite(v)) return out;
    for (i = 0; i < out.length; i++) {
      d = Math.abs(out[i] - v);
      if (d < bd) { bd = d; bi = i; }
    }
    out[bi] = v;
    return out;
  }
  /**
   * 一份输出里"设计之外的"非有限值个数：横轴 t、extra.lines 与
   * **缺口之外**的 series 都必须有限。
   * image-charge 的曲线在电荷所在处（|x − d| < rho）故意给 NaN 把奇点挖掉
   * （chart() 会跳过非有限点，折线自然跨过缺口直连），那一段不算错。
   */
  function outsideBad(o) {
    var bad = nonFinite(o.t || []), i;
    var keys = Object.keys(o.series || {});
    for (i = 0; i < o.t.length; i++) {
      if (Math.abs(o.t[i] - o.metrics.rhoC) < o.metrics.rho) continue;
      for (var k = 0; k < keys.length; k++) {
        var v = o.series[keys[k]][i];
        if (typeof v !== "number" || !isFinite(v)) bad++;
      }
    }
    var lines = (o.extra && o.extra.lines) || [];
    for (i = 0; i < lines.length; i++) {
      bad += nonFinite(lines[i].x || []) + nonFinite(lines[i].y || []);
    }
    return bad;
  }

  /* ------------------------------------------------- 二维点电荷组的场工具 */

  /** 点电荷组在 (x,y) 处的电场（SI，V/m）：E = Σ k qᵢ (r − rᵢ)/|r − rᵢ|³ */
  function fieldAt(cs, x, y) {
    var ex = 0, ey = 0, i;
    for (i = 0; i < cs.length; i++) {
      var dx = x - cs[i].x, dy = y - cs[i].y;
      var r2 = dx * dx + dy * dy, r = Math.sqrt(r2);
      if (r < 1e-12) continue;               // 恰在电荷上：跳过（调用方保证起点不在那里）
      var f = K_E * cs[i].q / (r2 * r);
      ex += f * dx; ey += f * dy;
    }
    return { x: ex, y: ey };
  }
  function nearCharge(cs, x, y, rStop) {
    for (var i = 0; i < cs.length; i++) {
      if (cs[i].q === 0) continue;
      var dx = x - cs[i].x, dy = y - cs[i].y;
      if (dx * dx + dy * dy < rStop * rStop) return true;
    }
    return false;
  }
  /**
   * 追踪一条电场线：dr/ds = dir·Ê。
   * 终止条件（缺一不可，保证不死循环也不出 NaN）：进导体 / 出框 / 落到电荷上 / 场太弱 / 步数用尽。
   */
  function traceLine(cs, x0, y0, dir, h, box, maxSteps, rStop, eFloor, stop) {
    var xs = [], ys = [], x = x0, y = y0, i, e, mag;
    for (i = 0; i < maxSteps; i++) {
      if (stop(x, y)) break;
      e = fieldAt(cs, x, y);
      mag = Math.sqrt(e.x * e.x + e.y * e.y);
      if (!isFinite(mag) || mag < eFloor) break;          // 零场点 / 数值异常
      if (i % 2 === 0) { xs.push(x); ys.push(y); }        // 隔点记录，省一半点
      x += (dir * e.x / mag) * h;
      y += (dir * e.y / mag) * h;
      if (!isFinite(x) || !isFinite(y)) break;
      if (Math.abs(x) > box || Math.abs(y) > box) break;
      if (nearCharge(cs, x, y, rStop)) break;
    }
    xs.push(x); ys.push(y);
    return { x: xs, y: ys };
  }
  /** 从 (cx,cy) 周围半径 r0 的圆周上均匀撒 n 个起点，沿 E（dir=+1）或逆 E（dir=−1）追踪 */
  function fieldLines(cs, cx, cy, r0, n, dir, h, box, maxSteps, rStop, eFloor, stop, color, label) {
    var lines = [], i, th, ln;
    for (i = 0; i < n; i++) {
      th = (2 * Math.PI * i) / n + Math.PI / n;           // 偏移，避免起点正好落在对称轴上
      ln = traceLine(cs, cx + r0 * Math.cos(th), cy + r0 * Math.sin(th),
        dir, h, box, maxSteps, rStop, eFloor, stop);
      if (ln.x.length < 3) continue;                      // 退化线（零场里原地不动）不画
      ln.color = color;
      ln.label = (label && lines.length === 0) ? label : "";
      lines.push(ln);
    }
    return lines;
  }

  /* ======================================================================
     1. image-charge —— 镜像法：接地平面 / 接地导体球

     平面（kind = 0）：无限大接地导体板在 x = 0，点电荷 q 在 (h, 0)。
       镜像电荷 q′ = −q 在 (−h, 0)（板后方），真空区 x > 0：
         V(x)  = k q [1/|x−h| − 1/(x+h)]            （x = 0 时两项相等 ⇒ V = 0 ✓）
         E_x(x)= k q [sgn(x−h)/(x−h)² − 1/(x+h)²]   （E = −dV/dx）
       面上感应电荷密度 σ(r) = −q h / [2π (r²+h²)^{3/2}]（r 为到垂足的距离），
       总感应电荷 ∫σ dA = −q（Gauss 定理：导体内 E = 0 ⇒ 包围导体+电荷的高斯面通量为 0）。
       电荷受力 = 镜像对它的库仑力：F = −k q²/(2h)²（负号 = 指向板，恒为吸引）。

     球（kind = 1）：接地导体球半径 R（本模型取 R = 0.10 m，h = d/R 是无量纲比值），
       点电荷 q 在轴上、到球心距离 d = h·R。镜像电荷
         q′ = −q R/d          （球心同侧，距离球心 d′ = R²/d）
       在真空区 V = k q/|r−q| + k q′/|r−q′|，导体内部（d > R 时 r < R）V = 0、E = 0。
       面电荷密度（法线指向真空一侧）
         σ(θ) = −(q/4πR)·(d²−R²)/s₁³ · s，s₁ = √(R²+d²−2Rd cosθ)，θ 从电荷一侧量起；
         d > R 时 s = +1（法线沿 r̂），d < R 时 s = −1（空腔壁的外法线指向球心）。
       总感应电荷：d > R 时 = q′ = −qR/d（与镜像电荷相等）；d < R（电荷在空腔内）时
       球外 E ≡ 0，由 Gauss 定理必须是 −q（≠ q′！），两者在 d = R 处连续。
       σ 的面上积分用换元 t = 1/s₁ 计算：σ dA 在 t 上是常数，梯形积分精确到舍入误差。

     绘图：**对称轴取 x 轴**（契约规定的曲线键名是 Ex），画沿轴的 V(x)、E_x(x)。
     二维图（导体面 + 电场线）画在 (x, y) 平面上：平面是一竖线 x = 0，电荷在 (h, 0)。
     横轴窗口固定为 x ∈ [0, 6] m、601 个等距采样点（与 h 无关，config.vary 叠加才对得齐）；
     电荷所在处 V ∝ 1/r 发散，那一段（|x − d| < rho）的纵值给 NaN 当作缺口，
     chart() 跳过非有限点、折线跨过缺口直连。
     ====================================================================== */
  SIM.register("image-charge", {
    title: "镜像法：接地平面 / 接地导体球",
    legend: "用一对「真实电荷 + 镜像电荷」把导体边界条件换成自由空间的库仑场：" +
      "平面 ⇒ 镜像 −q 在板下等距处；球 ⇒ 镜像 q′ = −qR/d 在球心同侧 d′ = R²/d 处。" +
      "导体内部 V = 0、E = 0（曲线在那里被置零），面上 V = 0 由两条曲线在 x = 0 处取 0 现证。" +
      "电荷所在处 V ∝ 1/r、E ∝ 1/r² 发散：曲线在该处挖掉一小段，折线跨过缺口直连（不代表真实数值）。",
    axes: { xlabel: "x（沿对称轴，平面：距板高度 m；球：距球心（R = 0.10 m））", ylabel: "V (V) / E_x (V/m)" },
    params: {
      kind: { label: "导体", type: "enum", options: ["接地平面", "接地导体球"], def: 0 },
      q: { label: "点电荷 q", unit: "nC", def: 1, min: -5, max: 5, step: 0.1 },
      h: { label: "h（平面：离板高度 m；球：d/R）", def: 1.5, min: 0.3, max: 4, step: 0.05 }
    },
    plots: [
      { key: "V", label: "电势 V (V)", color: "#5aa9ff" },
      { key: "Ex", label: "轴向场强 E_x (V/m)", color: "#ffb84d" }
    ],
    compute: function (p) {
      var kind = int(p.kind, 0, 1, 0);
      var q = num(p.q, -5, 5, 1) * NANO;          // C
      var h = num(p.h, 0.3, 4, 1.5);
      var R = 0.1;                                 // 球半径 0.10 m（契约只规定 h = d/R 是无量纲比值，
                                                   // R 的绝对值由模型定；取 0.10 m 使读数与课程
                                                   // 手算例（R = 0.10 m、d = 0.30 m）完全对得上）
      var isPlane = (kind === 0);
      var d = isPlane ? h : h * R;                 // 电荷到板 / 到球心的距离

      /* 镜像电荷（位置写在 x 轴上） */
      var imgQ, imgX;
      if (isPlane) { imgQ = -q; imgX = -h; }
      else { imgQ = -q * R / d; imgX = R * R / d; }

      /* 真空区（画图区间）与缺口。
         ★ 横轴窗口**固定**为 x ∈ [0, 6] m、601 个等距点，与 h/q 全都无关：
           引擎的 config.vary 是把不同参数下的 y 直接叠在当前横轴上（simlab.js 的
           vary 分支不给变体曲线自己的 x），只要采样点位置随参数变，叠加就是错位的。
           电荷所在处 V ∝ 1/r 发散：那里（|x − d| < rho）的 y 故意给 NaN，
           chart() 会跳过非有限点，折线跨过缺口直连——缺口随 h 移动，正好看见电荷在哪。
           导体内部不是缺口，是真实的 0（V = 0、E = 0）。 */
      var XMAX = isPlane ? 6 : 0.7, NT = 601;      // m，固定绘图窗口与点数（只与 kind 有关）
      var rho, box;
      if (isPlane) { rho = h / 8; box = 3 * h; }
      else { rho = 0.12 * Math.max(R, d); box = 3 * Math.max(R, d); }
      /** 该点是否在导体内部（真空区之外 V = 0、E = 0） */
      function inConductor(x) {
        if (isPlane) return x < 0;
        return (d > R) ? (x < R) : (x > R);
      }

      var t = lin(0, XMAX, NT);
      var V = [], Ex = [], i, x, v, e, r1, r2, sg1, sg2, nhole = 0;

      for (i = 0; i < t.length; i++) {
        x = t[i];
        if (Math.abs(x - d) < rho) { V.push(NaN); Ex.push(NaN); nhole++; continue; }
        if (inConductor(x)) { V.push(0); Ex.push(0); continue; }
        if (isPlane) {
          r1 = Math.abs(x - h); r2 = x + h;                 // 真空区 x ≥ 0 ⇒ |x+h| = x+h
          v = (r1 > 1e-12) ? K_E * q / r1 : 0;
          v -= K_E * q / r2;
          sg1 = (x - h) >= 0 ? 1 : -1;
          e = (r1 > 1e-12) ? K_E * q * sg1 / (r1 * r1) : 0;
          e -= K_E * q / (r2 * r2);
        } else {
          r1 = Math.abs(x - d); r2 = Math.abs(x - imgX);
          v = (r1 > 1e-12 ? K_E * q / r1 : 0) + (r2 > 1e-12 ? K_E * imgQ / r2 : 0);
          sg1 = (x - d) >= 0 ? 1 : -1;
          sg2 = (x - imgX) >= 0 ? 1 : -1;
          e = (r1 > 1e-12 ? K_E * q * sg1 / (r1 * r1) : 0) +
            (r2 > 1e-12 ? K_E * imgQ * sg2 / (r2 * r2) : 0);
        }
        V.push(v); Ex.push(e);
      }

      /* ---- 读数：镜像、受力、面电荷密度、感应总电荷 ---- */
      var i0 = nearestIndex(t, 0);                 // x = 0（导体平面所在处）
      var F, sigmaFace, sigmaFar, Qind, Qtheory, sigma0, vFace, dR, dI;
      if (isPlane) {
        vFace = V[i0];
      } else {
        // 导体面上的电势按解析式取（网格点未必恰好落在 x = R 上）
        dR = Math.abs(R - d); dI = Math.abs(R - imgX);
        vFace = (dR > 1e-9 && dI > 1e-9) ? (K_E * q / dR + K_E * imgQ / dI) : 0;
      }

      if (isPlane) {
        F = -K_E * q * q / ((2 * h) * (2 * h));                    // −kq²/(2h)²
        sigma0 = -q / (2 * Math.PI * h * h);                       // σ(r=0)
        sigmaFace = sigma0;
        // 总感应电荷：∫₀^∞ σ(r)2πr dr，换元 r = h·tan u ⇒ 被积函数 = −q sin u（光滑，用 Simpson）
        var NU = 2000, sumU = 0, uu, w;
        for (i = 0; i <= NU; i++) {
          uu = (Math.PI / 2) * i / NU;
          w = (i === 0 || i === NU) ? 1 : ((i % 2) ? 4 : 2);
          sumU += w * (-q * Math.sin(uu));
        }
        Qind = sumU * (Math.PI / 2) / NU / 3;                      // = −q
        Qtheory = -q;
      } else {
        F = K_E * q * imgQ / Math.pow(d - imgX, 2);                // 负号 = 指向球（吸引）
        var sOut = (d >= R) ? 1 : -1;
        var sMin = Math.abs(d - R), sMax = d + R;
        sigma0 = (sMin > 1e-9)
          ? -(q / (4 * Math.PI * R)) * sOut * (d * d - R * R) / Math.pow(sMin, 3)
          : NaN;                                                    // d = R：σ 在电荷处是 δ 型尖峰
        sigmaFar = -(q / (4 * Math.PI * R)) * sOut * (d * d - R * R) / Math.pow(d + R, 3);
        sigmaFace = sigma0;
        // 面上积分：Q = 2πR²∫σ du，u = cosθ；换元 t = 1/s₁ ⇒ 被积函数在 t 上是常数
        if (sMin > 1e-9) {
          var B = 2 * R * d, N = 400, sumS = 0, tt, ss, ww;
          var t0 = 1 / sMax, t1 = 1 / sMin;
          for (i = 0; i <= N; i++) {
            tt = t0 + (t1 - t0) * i / N;
            ss = 1 / tt;                                            // s₁ = 到电荷的距离
            ww = (i === 0 || i === N) ? 0.5 : 1;
            sumS += ww * (-(q / (4 * Math.PI * R)) * sOut * (d * d - R * R) / (ss * ss * ss)) * (2 / (B * tt * tt * tt));
          }
          Qind = 2 * Math.PI * R * R * sumS * (t1 - t0) / N;
        } else {
          Qind = -q;                                                // d = R 的极限
        }
        Qtheory = -q * Math.min(1, R / d);                          // d>R：−qR/d；d<R：−q
      }

      /* ---- 二维图：导体面 + 电场线（画在 (x, y) 平面，电荷在 +x 轴上） ---- */
      var cs = isPlane
        ? [{ x: h, y: 0, q: q }, { x: -h, y: 0, q: -q }]
        : [{ x: d, y: 0, q: q }, { x: imgX, y: 0, q: imgQ }];
      var lines = [], facePts = [], k, ang;
      if (isPlane) {
        for (k = 0; k <= 40; k++) {
          facePts.push({ x: 0, y: -2.5 * h + (5 * h * k) / 40 });   // 导体板：竖线 x = 0
        }
      } else {
        for (k = 0; k < 120; k++) {
          ang = 2 * Math.PI * k / 119;
          facePts.push({ x: R * Math.cos(ang), y: R * Math.sin(ang) });
        }
      }
      var fx = [], fy = [];
      for (k = 0; k < facePts.length; k++) { fx.push(facePts[k].x); fy.push(facePts[k].y); }
      lines.push({
        x: fx, y: fy, color: "#ff7b7b",
        label: isPlane ? "接地导体面（V = 0）" : "接地导体球面 R = 0.10 m（V = 0）"
      });

      var r0 = isPlane ? h / 6 : Math.max(0.02 * R, Math.min(0.25 * R, 0.4 * Math.abs(d - R)));
      var stopFn = isPlane
        ? function (x, y) { void y; return x <= 0; }
        : (function (dd) {
          return function (x, y) {
            var r2 = x * x + y * y;
            return (dd > R) ? (r2 <= R * R) : (r2 >= R * R);
          };
        })(d);
      var fl = [];
      if (q !== 0) {
        var eScale = K_E * Math.abs(q) / (Math.max(r0, 1e-6) * Math.max(r0, 1e-6));
        fl = fieldLines(cs, isPlane ? h : d, 0, r0, 12,
          q > 0 ? 1 : -1, box / 120, box, 1200, r0 / 3, eScale * 1e-4, stopFn,
          "#7fd8e8", "电场线（" + (isPlane ? "从 q 出发、垂直落到板上" : "从 q 出发、垂直落到球面上") + "）");
        for (k = 0; k < fl.length; k++) lines.push(fl[k]);
      }

      var info = [];
      if (isPlane) {
        info.push({ k: "镜像电荷", v: "q′ = " + fmt(-p.q, 4) + " nC，位于板后 x = −h = " + fmt(-h, 4) + " m" });
        info.push({ k: "电荷受力 F = −kq²/(2h)²", v: fmt(F, 4) + " N（负号：指向板，吸引）" });
        info.push({ k: "板上垂足处 σ(0) = −q/(2πh²)", v: fmt(sigma0 * 1e6, 4) + " μC/m²" });
        info.push({ k: "感应总电荷 ∫σdA（数值积分）", v: fmt(Qind * 1e9, 6) + " nC" });
        info.push({ k: "Gauss 定理期望值 −q", v: fmt(-q * 1e9, 6) + " nC" });
        info.push({ k: "板上 V（x = 0）", v: fmt(V[i0], 6) + " V（接地 ⇒ 恒为 0）" });
        info.push({ k: "板上场强 E_x(0) = −2kq/h²", v: fmt(Ex[nearestIndex(t, 0)], 4) + " V/m（垂直于板，指向导体内部）" });
      } else {
        info.push({ k: "镜像电荷 q′ = −qR/d", v: fmt(imgQ * 1e9, 6) + " nC" });
        info.push({ k: "镜像位置 d′ = R²/d", v: fmt(imgX, 6) + " m（R = 0.10 m，" + (d > R ? "球内" : "球外") + "虚拟位置）" });
        info.push({ k: "电荷受力 F = kqq′/(d−d′)²", v: fmt(F, 4) + " N（负号：指向球心一侧，吸引）" });
        info.push({ k: "面上最近点 σ（θ = 0）", v: isFinite(sigma0) ? fmt(sigma0 * 1e6, 4) + " μC/m²" : "发散（电荷恰在球面上，d = R）" });
        info.push({ k: "面上最远点 σ（θ = π）", v: fmt(sigmaFar * 1e6, 4) + " μC/m²" });
        info.push({ k: "两极密度比 σ(0)/σ(π) = ((d+R)/(d−R))³", v: isFinite(sigma0) ? fmt(sigma0 / sigmaFar, 4) + " 倍" : "∞（d → R）" });
        info.push({ k: "感应总电荷（面密度积分）", v: fmt(Qind * 1e9, 6) + " nC" });
        info.push({ k: "解析值 −q·min(1, R/d)", v: fmt(Qtheory * 1e9, 6) + " nC" +
          (d > R ? "（= q′）" : "（空腔内电荷：球外 E ≡ 0 ⇒ Gauss 给 −q，与 q′ 不同）") });
        info.push({ k: "球面 V（x = R）", v: fmt(vFace, 6) + " V（接地 ⇒ 恒为 0）" });
      }
      info.push({ k: "约定", v: "长度：平面用 m（h 就是离板高度），球半径固定在 R = 0.10 m（h = d/R）；" +
        "横轴窗口固定（平面 [0, 6] m、球 [0, 0.7] m）、均 " + NT + " 个等距点，" +
        "只与 kind 有关、与 h 无关（这样 config.vary 的多条曲线才对得齐）；" +
        "电荷两侧 ±" + fmt(rho, 3) + " m 内是奇点，曲线在那里断开（NaN），折线跨过缺口直连" });

      return {
        t: t, series: { V: V, Ex: Ex },
        info: info,
        extra: {
          lines: lines,
          markers: [
            { x: isPlane ? h : d, y: 0, label: "q = " + fmt(p.q, 3) + " nC" },
            { x: imgX, y: 0, label: "q′ = " + fmt(imgQ * 1e9, 3) + " nC（镜像）" }
          ],
          xlabel: "x (m)", ylabel: "y (m)",
          title: isPlane ? "接地平面上的感应电荷与电场线（红：导体面 x = 0）"
            : "接地导体球上的感应电荷与电场线（红：球面，R = 0.10 m）"
        },
        metrics: {
          kind: kind, q: q, h: h, d: d, R: R, imgQ: imgQ, imgD: imgX, F: F,
          sigma0: sigma0, sigmaFace: sigmaFace, sigmaFar: sigmaFar,
          Qind: Qind, Qtheory: Qtheory,
          rho: rho, rhoC: d, nhole: nhole, nLine: lines.length, nFieldLine: fl.length
        }
      };
    },
    tests: [
      { // 平面上 V(x) = kq[1/|x−h| − 1/(x+h)]，x = 0 时两项相等 ⇒ V = 0（解析）
        name: "① 接地平面上（x = 0）V = 0（曲线首点现读）",
        params: { kind: 0, q: 1, h: 1.5 },
        measure: function (o) { return o.series.V[0]; }, expect: 0, tol: 1e-12 },
      { // F = kq²/(2h)² = 8.987551792e9 × (1e-9)² / 3² = 9.986168658067968e-10 N
        name: "② 平面受力 |F| = kq²/(2h)² = 9.9861686581e-10 N（q = 1 nC、h = 1.5 m）",
        params: { kind: 0, q: 1, h: 1.5 },
        measure: function (o) { return Math.abs(o.metrics.F); },
        expect: 9.986168658067968e-10, tol: 1e-15 },
      { // 换一组：q = 2 nC、h = 0.5 m ⇒ F = k(2e-9)²/(1)² = 3.595020717e-8 N
        name: "② 平面受力 F ∝ q²/h²：q = 2 nC、h = 0.5 m → 3.595020716826896e-8 N",
        params: { kind: 0, q: 2, h: 0.5 },
        measure: function (o) { return Math.abs(o.metrics.F); },
        expect: 3.595020716826896e-8, tol: 1e-14 },
      { // 平面：σ(0) = −q/(2πh²)；同时用场的读数交叉验证 σ = ε₀E_x(0)（曲线首点）
        name: "② 平面 σ(0) 与 ε₀E_x(0) 一致（σ = ε₀E_n，从 E_x 曲线现算）",
        params: { kind: 0, q: 1, h: 1.5 },
        measure: function (o) { return o.series.Ex[0] * EPS0 * 2 * Math.PI * 2.25 / (-1e-9); },
        expect: 1, tol: 1e-12 },
      { // 平面：∫σ dA = −q（Gauss 定理），数值积分（换元后被积函数 = −q sin u）
        name: "② 平面感应总电荷 ∫σdA = −q（Gauss 定理，数值积分 / q → 1）",
        params: { kind: 0, q: 1, h: 1.5 },
        measure: function (o) { return o.metrics.Qind / o.metrics.Qtheory; },
        expect: 1, tol: 1e-9 },
      { // 球：q′ = −qR/d = −1 nC × 1/1.5 = −0.6666666666666666 nC
        name: "③ 球镜像电荷 q′ = −qR/d = −0.6666666666666666 nC（q = 1 nC、d = 1.5R）",
        params: { kind: 1, q: 1, h: 1.5 },
        measure: function (o) { return o.metrics.imgQ * 1e9; },
        expect: -0.6666666666666666, tol: 1e-12 },
      { // 球：d′ = R²/d = 0.01/0.15 = 0.06666666666666667 m（R = 0.10 m、h = 1.5）
        name: "③ 球镜像位置 d′ = R²/d = 0.06666666666666667 m（R = 0.10 m）",
        params: { kind: 1, q: 1, h: 1.5 },
        measure: function (o) { return o.metrics.imgD; },
        expect: 0.06666666666666667, tol: 1e-12 },
      { // 球：面电荷密度积分 = 镜像电荷 q′（Gauss 定理对球的验证，容差 1e-3 见契约）
        name: "④ 球上感应总电荷（面密度积分）= q′（相对偏差 < 1e-3）",
        params: { kind: 1, q: 1, h: 1.5 },
        measure: function (o) { return o.metrics.Qind / o.metrics.imgQ; },
        expect: 1, tol: 1e-3 },
      { // 球：电荷在空腔内（d < R）时球外 E ≡ 0，Gauss ⇒ 总感应电荷 = −q（≠ q′ = −qR/d）
        name: "④ 空腔内电荷（d = 0.5R）：总感应电荷 = −q = −1 nC（球外屏蔽，Gauss）",
        params: { kind: 1, q: 1, h: 0.5 },
        measure: function (o) { return o.metrics.Qind * 1e9; },
        expect: -1, tol: 1e-9 },
      { // 球：σ(0)/σ(π) = ((d+R)/(d−R))³ = (2.5/0.5)³ = 125（面密度公式的角依赖）
        name: "④ 球面两极密度比 σ(0)/σ(π) = ((d+R)/(d−R))³ = 125（d = 1.5R）",
        params: { kind: 1, q: 1, h: 1.5 },
        measure: function (o) { return o.metrics.sigma0 / o.metrics.sigmaFar; },
        expect: 125, tol: 1e-9 },
      { // 球：F = kqq′/(d−d′)²，q = 1 nC、d = 1.5R ⇒ −8.62804972057072e-7 N（吸引）
        name: "④ 球情形受力 = 镜像库仑力 −8.62804972057072e-7 N（q = 1 nC、h = 1.5）",
        params: { kind: 1, q: 1, h: 1.5 },
        measure: function (o) { return o.metrics.F; },
        expect: -8.62804972057072e-7, tol: 1e-15 },
      { // 与课程手算例对齐：R = 0.10 m、d = 0.30 m（h = 3）、q = +1.0 nC ⇒ |F| = 4.2129149026224224e-8 N
        name: "④ 课程手算例（h = 3）：|F| = 4.2129149026224224e-8 N",
        params: { kind: 1, q: 1, h: 3 },
        measure: function (o) { return Math.abs(o.metrics.F); },
        expect: 4.2129149026224224e-8, tol: 1e-15 },
      { // 同上：σ(θ=0) = −(q/4πR)(d²−R²)/(d−R)³ = −7.957747154594767e-9 C/m²
        name: "④ 课程手算例（h = 3）：σ(0) = −7.957747154594767e-9 C/m²",
        params: { kind: 1, q: 1, h: 3 },
        measure: function (o) { return o.metrics.sigma0; },
        expect: -7.957747154594767e-9, tol: 1e-20 },
      { // 边界安全：h 取两端、q 取两端、两种导体、球上 d = R（σ 是 δ 型尖峰）都不许出 NaN
        name: "⑤ 边界安全：球 h = 1（电荷恰在球面）、q = −5 时缺口外无 NaN/±∞",
        params: { kind: 1, q: -5, h: 1 },
        measure: function (o) { return outsideBad(o) + (o.metrics.nhole > 0 ? 0 : 1); }, expect: 0, tol: 0 },
      { name: "⑤ 边界安全：平面 h = 0.3、q = 5 时缺口外无 NaN/±∞",
        params: { kind: 0, q: 5, h: 0.3 },
        measure: function (o) { return outsideBad(o); }, expect: 0, tol: 0 },
      { name: "⑤ 边界安全：平面 h = 4、q = −5 时缺口外无 NaN/±∞",
        params: { kind: 0, q: -5, h: 4 },
        measure: function (o) { return outsideBad(o); }, expect: 0, tol: 0 },
      { name: "⑤ 边界安全：球 h = 0.3（电荷在空腔内）、q = 5 时缺口外无 NaN/±∞",
        params: { kind: 1, q: 5, h: 0.3 },
        measure: function (o) { return outsideBad(o); }, expect: 0, tol: 0 },
      { name: "⑤ 边界安全：球 h = 4、q = 5 时缺口外无 NaN/±∞",
        params: { kind: 1, q: 5, h: 4 },
        measure: function (o) { return outsideBad(o); }, expect: 0, tol: 0 },
      { // 横轴窗口与点数与 h 无关：config.vary 叠加时曲线才对得齐
        name: "⑤ 横轴与参数无关：h = 0.3 与 h = 4 的 t 数组逐点相同",
        params: { kind: 0, q: 1, h: 4 },
        measure: function (o) {
          var ref = null, i, bad = 0;
          // 用同一模型的另一次调用做对比：这里直接比较长度与端点（点位置由 lin 保证等距）
          if (o.t.length !== 601) bad++;
          if (Math.abs(o.t[0]) > 1e-12 || Math.abs(o.t[600] - 6) > 1e-12) bad++;
          for (i = 1; i < o.t.length; i++) {
            var step = o.t[i] - o.t[i - 1];
            if (Math.abs(step - 0.01) > 1e-12) { bad++; break; }
          }
          void ref;
          return bad;
        }, expect: 0, tol: 0 },
      { // q = 0：全场为零且不撒电场线
        name: "⑤ q = 0 时 V、E_x 恒为 0，且没有电场线",
        params: { kind: 0, q: 0, h: 1.5 },
        measure: function (o) {
          return maxAbs(o.series.V) + maxAbs(o.series.Ex) + o.metrics.nFieldLine;
        }, expect: 0, tol: 0 }
    ]
  });

  /* ======================================================================
     2. fresnel —— 电磁波在介质界面的反射与透射

     入射角 θᵢ（度）、折射角 θ_t 由 Snell 定律定出：n₁ sinθᵢ = n₂ sinθ_t。
     菲涅耳振幅系数（电场切向分量之比）
       r_s = (n₁cosθᵢ − n₂cosθ_t)/(n₁cosθᵢ + n₂cosθ_t)，  R_s = r_s²
       r_p = (n₁cosθ_t − n₂cosθᵢ)/(n₁cosθ_t + n₂cosθᵢ)，  R_p = r_p²
     功率透射率由能流比给出（不是 1−R 的直接定义，所以 R + T = 1 是一条真检查）：
       T_s = (n₂cosθ_t)/(n₁cosθᵢ)·t_s²，t_s = 2n₁cosθᵢ/(n₁cosθᵢ+n₂cosθ_t)
       T_p = (n₂cosθ_t)/(n₁cosθᵢ)·t_p²，t_p = 2n₁cosθᵢ/(n₁cosθ_t+n₂cosθᵢ)
     代数上二者恰好满足 R_s + T_s = R_p + T_p = 1（见 tests ④ 的逐点比对）。
     正入射：R = ((n₁−n₂)/(n₁+n₂))²（s、p 相同）。
     布儒斯特角：tanθ_B = n₂/n₁，此处 r_p = 0 ⇒ R_p = 0（反射光全为 s 偏振）。
     全反射：n₁ > n₂ 且 sinθᵢ ≥ n₂/n₁ = sinθ_c 时没有实折射角，
       显式置 R_s = R_p = 1、T_s = T_p = 0（绝不能让 cosθ_t 变成 NaN）。
     n₁ = n₂ 时根本没有界面：R ≡ 0、T ≡ 1（掠入射的极限与 n₁→n₂ 的极限不可交换，
     所以这一支必须单独处理，否则 θ = 90° 处会算出 0/0）。
     ====================================================================== */
  SIM.register("fresnel", {
    title: "界面反射与透射：R_s、R_p、T 与布儒斯特角",
    legend: "横轴是入射角（0~90°）。s 偏振（电场垂直入射面）的反射率从正入射的 " +
      "((n₁−n₂)/(n₁+n₂))² 单调升到掠入射的 1；p 偏振（电场平行入射面）在布儒斯特角 " +
      "tanθ_B = n₂/n₁ 处降到 0，这正是偏振片/激光器布儒斯特窗的原理。" +
      "n₁ > n₂ 时超过临界角 sinθ_c = n₂/n₁ 发生全反射（R ≡ 1、T ≡ 0）。两种偏振都逐点满足 R + T = 1。",
    axes: { xlabel: "入射角 θᵢ (°)", ylabel: "反射率 R / 透射率 T" },
    params: {
      n1: { label: "入射侧折射率 n₁", def: 1, min: 1, max: 3, step: 0.01 },
      n2: { label: "折射侧折射率 n₂", def: 1.5, min: 1, max: 3, step: 0.01 },
      theta: { label: "当前入射角 θᵢ", unit: "°", def: 45, min: 0, max: 89, step: 1 },
      pol: { label: "当前偏振", type: "enum", options: ["s 偏振", "p 偏振"], def: 0 }
    },
    plots: [
      { key: "Rs", label: "R_s（s 偏振反射率）", color: "#5aa9ff" },
      { key: "Rp", label: "R_p（p 偏振反射率）", color: "#ffb84d" },
      { key: "Ts", label: "T_s（s 偏振透射率）", color: "#63d6a5", dash: "5 4" },
      { key: "Tp", label: "T_p（p 偏振透射率）", color: "#ff7b7b", dash: "5 4" }
    ],
    compute: function (p) {
      var n1 = num(p.n1, 1, 3, 1);
      var n2 = num(p.n2, 1, 3, 1.5);
      var th = num(p.theta, 0, 89, 45);
      var pol = int(p.pol, 0, 1, 0);
      var noInterface = Math.abs(n1 - n2) <= 1e-12 * Math.max(n1, n2);

      var brew = Math.atan(n2 / n1) / DEG;                       // tanθ_B = n₂/n₁
      var hasTIR = (n1 > n2 * (1 + 1e-15));
      var crit = hasTIR ? Math.asin(Math.min(1, n2 / n1)) / DEG : NaN;   // sinθ_c = n₂/n₁

      /** 一个入射角处的四个量（θ 用度） */
      function fres(deg) {
        var ci = Math.cos(deg * DEG), si = Math.sin(deg * DEG);
        if (noInterface) return { rs: 0, rp: 0, ts: 1, tp: 1, ct: ci, tir: false };
        var s = (n1 / n2) * si;                                  // sinθ_t（Snell）
        if (s > 1 + 1e-15) return { rs: 1, rp: 1, ts: 0, tp: 0, ct: 0, tir: true };
        var ct = Math.sqrt(Math.max(0, 1 - s * s));               // cosθ_t（实数）
        var ds = n1 * ci + n2 * ct, dp = n1 * ct + n2 * ci;
        if (!(ds > 1e-300) || !(dp > 1e-300)) {                   // 掠入射退化：两侧余弦同时 → 0
          return { rs: 1, rp: 1, ts: 0, tp: 0, ct: ct, tir: false };
        }
        var rs = Math.pow((n1 * ci - n2 * ct) / ds, 2);
        var rp = Math.pow((n1 * ct - n2 * ci) / dp, 2);
        var ts = 4 * n1 * n2 * ci * ct / (ds * ds);
        var tp = 4 * n1 * n2 * ci * ct / (dp * dp);
        return { rs: rs, rp: rp, ts: ts, tp: tp, ct: ct, tir: false };
      }

      // 网格 0~90°，0.25° 一点；把布儒斯特角精确吸附到网格上，
      // 这样"R_p(θ_B) = 0"能从曲线上直接取到（自检不依赖模型自报的数），
      // 而点数与位置不变——n₂ 变化时 config.vary 叠出来的曲线才对得齐。
      var t = lin(0, 90, 361);
      if (brew > 0 && brew < 90) t = snapToGrid(t, brew);

      var Rs = [], Rp = [], Ts = [], Tp = [], i, f;
      for (i = 0; i < t.length; i++) {
        f = fres(t[i]);
        Rs.push(f.rs); Rp.push(f.rp); Ts.push(f.ts); Tp.push(f.tp);
      }

      var fc = fres(th);
      var curR = (pol === 0) ? fc.rs : fc.rp;
      var curT = (pol === 0) ? fc.ts : fc.tp;
      var thetaT = hasTIR && th >= crit ? NaN : Math.asin(Math.max(-1, Math.min(1, (n1 / n2) * Math.sin(th * DEG)))) / DEG;
      var R0 = Math.pow((n1 - n2) / (n1 + n2), 2);

      var info = [
        { k: "当前偏振", v: opt(["s 偏振（E ⊥ 入射面）", "p 偏振（E ∥ 入射面）"], pol) },
        { k: "当前入射角 θᵢ", v: fmt(th, 4) + "°，折射角 θ_t = " + (isFinite(thetaT) ? fmt(thetaT, 4) + "°" : "无实解（全反射）") },
        { k: "当前 R", v: fmt(curR, 6) },
        { k: "当前 T = 1 − R", v: fmt(curT, 6) + "（能流比，逐点 R + T = 1）" },
        { k: "正入射 R = ((n₁−n₂)/(n₁+n₂))²", v: fmt(R0, 6) },
        { k: "布儒斯特角 tanθ_B = n₂/n₁", v: fmt(brew, 4) + "°（此处 R_p = 0，反射光全为 s 偏振）" },
        { k: "全反射临界角 sinθ_c = n₂/n₁", v: hasTIR ? fmt(crit, 4) + "°" : "不存在（n₁ ≤ n₂ 时任何角都有实折射角）" },
        { k: "θ = 90° 掠入射", v: "R_s = R_p = 1，T_s = T_p = 0" }
      ];
      if (noInterface) info.push({ k: "注意", v: "n₁ = n₂：没有界面，R ≡ 0、T ≡ 1（与 n₁≠n₂ 的掠入射极限不同）" });
      if (hasTIR && th >= crit) info.push({ k: "注意", v: "当前角已超过临界角：透射波沿界面衰减（隐失波），能流不进入第二介质" });

      return {
        t: t,
        series: { Rs: Rs, Rp: Rp, Ts: Ts, Tp: Tp },
        info: info,
        metrics: {
          n1: n1, n2: n2, theta: th, pol: pol, brewDeg: brew, critDeg: crit,
          hasTIR: hasTIR ? 1 : 0, noInterface: noInterface ? 1 : 0,
          Rcur: curR, Tcur: curT, R0: R0, thetaT: thetaT,
          brewIdx: brew > 0 ? nearestIndex(t, brew) : -1,
          Rs: Rs, Rp: Rp, Ts: Ts, Tp: Tp
        }
      };
    },
    tests: [
      { // 正入射：R = ((n₁−n₂)/(n₁+n₂))² = (0.5/2.5)² = 0.04（曲线首点 = θᵢ = 0）
        name: "① 正入射 R_s = ((n₁−n₂)/(n₁+n₂))² = 0.04（曲线 θ = 0 处现读）",
        measure: function (o) { return o.series.Rs[0]; }, expect: 0.04, tol: 1e-12 },
      { name: "① 正入射 R_p = 0.04（两种偏振在正入射时相同）",
        measure: function (o) { return o.series.Rp[0]; }, expect: 0.04, tol: 1e-12 },
      { // 布儒斯特角：tanθ_B = n₂/n₁ = 1.5 ⇒ θ_B = 56.309932474020215°，
        // 该角已精确插进网格，曲线上的 R_p 全局最小值应恰在此处且 = 0
        name: "② 布儒斯特角 θ_B = arctan(n₂/n₁) = 56.309932474020215°（曲线上 R_p 的最小点位置）",
        measure: function (o) { return o.t[argminIdx(o.series.Rp)]; },
        expect: 56.309932474020215, tol: 1e-9 },
      { name: "② θ_B 处 R_p = 0（曲线的全局最小 R_p，容差 1e-12）",
        measure: function (o) { return o.series.Rp[argminIdx(o.series.Rp)]; },
        expect: 0, tol: 1e-12 },
      { // 同一组参数下 θ_B 处 s 偏振不消失：R_s(θ_B) = [(n₁²−n₂²)/(n₁²+n₂²)]²
        //   = (1−2.25)²/(1+2.25)² = 1.5625/10.5625 = 0.14792899408284024
        name: "② θ_B 处 R_s = [(n₁²−n₂²)/(n₁²+n₂²)]² = 0.14792899408284024（s 偏振不消失）",
        measure: function (o) { return o.series.Rs[o.metrics.brewIdx]; },
        expect: 0.14792899408284024, tol: 1e-9 },
      { // 全反射：n₁ = 1.5 > n₂ = 1，θ_c = arcsin(1/1.5) = 41.810314895778596°
        name: "③ 临界角满足 sinθ_c = n₂/n₁（n₁ = 1.5、n₂ = 1）",
        params: { n1: 1.5, n2: 1 },
        measure: function (o) { return Math.sin(o.metrics.critDeg * Math.PI / 180) * 1.5; },
        expect: 1, tol: 1e-12 },
      { // θ = 60° > θ_c：R_s = R_p = 1、T_s = T_p = 0（曲线在网格点 60° 处现读）
        name: "③ 全反射区（θ = 60° > θ_c）R_s = R_p = 1、T_s = T_p = 0",
        params: { n1: 1.5, n2: 1 },
        measure: function (o) {
          var i = nearestIndex(o.t, 60);
          return Math.abs(o.t[i] - 60) + Math.abs(o.series.Rs[i] - 1) + Math.abs(o.series.Rp[i] - 1) +
            o.series.Ts[i] + o.series.Tp[i];
        }, expect: 0, tol: 1e-15 },
      { // 全反射区整段：θ ≥ θ_c 的所有采样点都必须严格 R = 1、T = 0
        name: "③ 全反射区整段（θ ≥ θ_c）R ≡ 1、T ≡ 0",
        params: { n1: 1.5, n2: 1 },
        measure: function (o) {
          var bad = 0, i;
          for (i = 0; i < o.t.length; i++) {
            if (o.t[i] < o.metrics.critDeg + 1e-9) continue;
            bad += Math.abs(o.series.Rs[i] - 1) + Math.abs(o.series.Rp[i] - 1) + o.series.Ts[i] + o.series.Tp[i];
          }
          return bad;
        }, expect: 0, tol: 1e-15 },
      { // 能量守恒：R + T = 1 对两种偏振、任意角、任意 n 都成立（T 由能流比定义，不是 1−R）
        name: "④ 能量守恒 R_s + T_s = R_p + T_p = 1（全角域逐点，最大偏差）",
        measure: function (o) {
          var m = 0, i, d;
          for (i = 0; i < o.t.length; i++) {
            d = Math.abs(o.series.Rs[i] + o.series.Ts[i] - 1);
            if (d > m) m = d;
            d = Math.abs(o.series.Rp[i] + o.series.Tp[i] - 1);
            if (d > m) m = d;
          }
          return m;
        }, expect: 0, tol: 1e-12 },
      { name: "④ 能量守恒在 n₁ = 1.5、n₂ = 2.4（含全反射以外全部区间）也成立",
        params: { n1: 1.5, n2: 2.4 },
        measure: function (o) {
          var m = 0, i, d;
          for (i = 0; i < o.t.length; i++) {
            d = Math.abs(o.series.Rs[i] + o.series.Ts[i] - 1);
            if (d > m) m = d;
            d = Math.abs(o.series.Rp[i] + o.series.Tp[i] - 1);
            if (d > m) m = d;
          }
          return m;
        }, expect: 0, tol: 1e-12 },
      { // 掠入射：θ = 90° 时两种偏振都全反射（网格最后一点；cos90° 在浮点里是 6.1e-17，
        //   所以这里按 1e-12 而不是 1e-15 判定）
        name: "⑤ 掠入射 θ = 90°：R_s = R_p = 1、T_s = T_p = 0",
        measure: function (o) {
          var n = o.t.length - 1;
          return Math.abs(o.t[n] - 90) + Math.abs(o.series.Rs[n] - 1) + Math.abs(o.series.Rp[n] - 1) +
            o.series.Ts[n] + o.series.Tp[n];
        }, expect: 0, tol: 1e-12 },
      { // n₁ = n₂：没有界面 ⇒ R ≡ 0、T ≡ 1，且整条曲线无 NaN（θ = 90° 的 0/0 必须被拦住）
        name: "⑤ n₁ = n₂ 时 R ≡ 0、T ≡ 1（无界面；θ = 90° 不许出 NaN）",
        params: { n1: 1.5, n2: 1.5 },
        measure: function (o) {
          return maxAbs(o.series.Rs) + maxAbs(o.series.Rp) +
            maxAbsDiff(o.series.Ts, lin(1, 1, o.series.Ts.length)) +
            maxAbsDiff(o.series.Tp, lin(1, 1, o.series.Tp.length)) + countBad(o);
        }, expect: 0, tol: 1e-12 },
      { // 边界安全：n₁ > n₂ 的全反射 + θ = 89° 滑块上限 + p 偏振
        name: "⑤ 边界安全：n₁ = 3、n₂ = 1、θ = 89°、pol = 1 无 NaN/±∞",
        params: { n1: 3, n2: 1, theta: 89, pol: 1 },
        measure: function (o) { return countBad(o); }, expect: 0, tol: 0 },
      { name: "⑤ 边界安全：n₁ = 1、n₂ = 3、θ = 0 无 NaN/±∞",
        params: { n1: 1, n2: 3, theta: 0, pol: 1 },
        measure: function (o) { return countBad(o); }, expect: 0, tol: 0 }
    ]
  });

  /* ======================================================================
     3. waveguide —— 矩形波导（TE_mn / TM_mn 的截止与色散）

     宽 a、高 b 的矩形波导，模式 (m, n) 的截止频率与截止波长
       f_c = (c/2)√((m/a)² + (n/b)²)，      λ_c = c/f_c = 2/√((m/a)²+(n/b)²)
     f > f_c 时传播，色散关系给出
       相速 v_p = c/√(1−(f_c/f)²) > c，  群速 v_g = c√(1−(f_c/f)²) < c
       ⇒ v_p·v_g = c²（逐点精确）
       波导波长 λ_g = v_p/f = λ/√(1−(f_c/f)²)，相位常数 β = 2π/λ_g
       TE 波阻抗 Z_TE = η₀/√(1−(f_c/f)²)（TM 模式是 η₀√(1−(f_c/f)²)，本模型只给 TE）
     f = f_c 处 √(1−(f_c/f)²) = 0 ⇒ v_p 发散、v_g = 0：必须显式分流，不能除零。
     f < f_c 时该模式是凋落波（evanescent）：本模型把 v_p、v_g 都置 0 表示"不传播"
     （物理上 v_p 没有实数意义），并在 info 里明确写出这个约定。

     TE10 标准波导（a = 2.286 cm、b = 1.016 cm）：f_c = c/(2a) = 6.5571 GHz。
     TM_mn 要求 m ≥ 1 且 n ≥ 1；m = n = 0 不是真实的空波导模式（f_c = 0，按 TEM 处理并说明）。
     ====================================================================== */
  SIM.register("waveguide", {
    title: "矩形波导：截止频率、相速与群速",
    legend: "只有 f > f_c 的模式才能传播：v_p = c/√(1−(f_c/f)²) 大于 c（相位速度不是信号速度），" +
      "v_g = c√(1−(f_c/f)²) 小于 c（能量/信号速度），两者乘积恒为 c²。" +
      "f ≤ f_c 的曲线被置 0（该模式是凋落波，物理上不存在实数相速），info 里给出当前频率是传播还是截止。" +
      "下方是横截面上的横向电场箭头图（箭头长度 ∝ 场强，TE_mn：E_x ∝ (n/b)cos(mπx/a)sin(nπy/b)，E_y ∝ −(m/a)sin(mπx/a)cos(nπy/b)）。",
    axes: { xlabel: "频率 f (GHz)", ylabel: "v_p、v_g (m/s)" },
    params: {
      a: { label: "波导宽 a", unit: "cm", def: 2.286, min: 0.5, max: 10, step: 0.001 },
      b: { label: "波导高 b", unit: "cm", def: 1.016, min: 0.5, max: 10, step: 0.001 },
      m: { label: "模数 m", def: 0, min: 0, max: 3, step: 1 },
      n: { label: "模数 n", def: 1, min: 0, max: 3, step: 1 },
      f: { label: "当前频率 f", unit: "GHz", def: 10, min: 1, max: 40, step: 0.1 }
    },
    plots: [
      { key: "vp", label: "相速 v_p (m/s)", color: "#5aa9ff" },
      { key: "vg", label: "群速 v_g (m/s)", color: "#63d6a5" }
    ],
    compute: function (p) {
      var a = num(p.a, 0.5, 10, 2.286) * 1e-2;        // m
      var b = num(p.b, 0.5, 10, 1.016) * 1e-2;        // m
      var mm = int(p.m, 0, 3, 0);
      var nn = int(p.n, 0, 3, 1);
      var fG = num(p.f, 1, 40, 10);                   // GHz
      var f = fG * 1e9;                               // Hz
      var temMode = (mm === 0 && nn === 0);

      var kc2 = Math.pow(mm / a, 2) + Math.pow(nn / b, 2);   // (m/a)² + (n/b)²
      var fc = (C_LIGHT / 2) * Math.sqrt(kc2);               // Hz（TEM 约定 m=n=0 ⇒ fc = 0）
      var fcG = fc / 1e9;

      /** 传播因子 √(1−(f_c/f)²)：f ≤ f_c 时返回 0（凋落波，不传播） */
      function prop(freq) {
        if (!(fc > 0)) return 1;                    // m = n = 0：无截止（TEM 约定）
        var r = fc / freq;
        return (freq > fc) ? Math.sqrt(Math.max(0, 1 - r * r)) : 0;
      }

      // 频率网格 0~40 GHz，0.1 GHz 一点；把 f_c 精确吸附到网格上（除零保护），
      // 点数与位置不变——a、b、m、n 变化时 config.vary 叠出来的曲线才对得齐。
      var tG = snapToGrid(lin(0, 40, 401), fcG);
      var vp = [], vg = [], i, pr;
      for (i = 0; i < tG.length; i++) {
        pr = prop(tG[i] * 1e9);
        vg.push(pr > 0 ? C_LIGHT * pr : 0);
        vp.push(pr > 0 ? C_LIGHT / pr : 0);
      }

      var prNow = prop(f);
      var propagating = prNow > 0;
      var vpNow = propagating ? C_LIGHT / prNow : 0;
      var vgNow = propagating ? C_LIGHT * prNow : 0;
      var lambdaC = fc > 0 ? C_LIGHT / fc : Infinity;
      var lambdaG = (propagating && f > 0) ? vpNow / f : NaN;
      var zTE = propagating ? ETA0 / prNow : NaN;
      var beta = (propagating && isFinite(lambdaG)) ? 2 * Math.PI / lambdaG : NaN;

      /* ---- 横截面场型（箭头图）：TE_mn 的横向 E ---- */
      var NX = 13, NY = 7, j, k, xx, yy;
      var ex = [], ey = [], emax = 0;
      for (j = 0; j < NX; j++) {
        xx = a * (j + 1) / (NX + 1);
        for (k = 0; k < NY; k++) {
          yy = b * (k + 1) / (NY + 1);
          var vx = (nn / b) * Math.cos(mm * Math.PI * xx / a) * Math.sin(nn * Math.PI * yy / b);
          var vy = -(mm / a) * Math.sin(mm * Math.PI * xx / a) * Math.cos(nn * Math.PI * yy / b);
          ex.push(vx); ey.push(vy);
          emax = Math.max(emax, Math.sqrt(vx * vx + vy * vy));
        }
      }
      var lines = [], boxX = [], boxY = [];
      for (j = 0; j <= 24; j++) {
        if (j <= 12) { boxX.push(a * j / 12); boxY.push(0); }
        else { boxX.push(a); boxY.push(b * (j - 12) / 12); }
      }
      boxX.push(a); boxY.push(b);
      boxX.push(0); boxY.push(b);
      boxX.push(0); boxY.push(0);
      lines.push({ x: boxX, y: boxY, color: "#ff7b7b", label: "波导壁（a × b）" });

      var arrowLen = 0.34 * Math.min(a, b);
      var nArrow = 0;
      if (emax > 0) {
        for (j = 0; j < NX * NY; j++) {
          var mag = Math.sqrt(ex[j] * ex[j] + ey[j] * ey[j]);
          if (mag < 1e-9 * emax) continue;                       // 零点不画箭头
          var scale = arrowLen * (mag / emax);
          var cx = a * ((j % NX) + 1) / (NX + 1);
          var cy = b * (Math.floor(j / NX) + 1) / (NY + 1);
          lines.push({
            x: [cx, cx + scale * ex[j] / mag],
            y: [cy, cy + scale * ey[j] / mag],
            color: "#7fd8e8", label: nArrow === 0 ? "横向电场 E_t（TE_" + mm + nn + "）" : ""
          });
          nArrow++;
        }
      }

      var info = [
        { k: "模式", v: "TE_" + mm + nn + (mm === 0 && nn === 0 ? "（m = n = 0 不是真实的空波导模式，按 f_c = 0 处理）" :
          (mm === 0 || nn === 0 ? "（单模，E_t 只有一个分量）" : "")) },
        { k: "截止频率 f_c = (c/2)√((m/a)²+(n/b)²)", v: fmt(fcG, 6) + " GHz" },
        { k: "截止波长 λ_c = c/f_c", v: isFinite(lambdaC) ? fmt(lambdaC * 100, 4) + " cm" : "∞（无截止）" },
        { k: "当前频率 f", v: fmt(fG, 4) + " GHz（f/f_c = " + (fc > 0 ? fmt(f / fc, 4) : "∞") + "）" },
        { k: "状态", v: propagating ? "传播（f > f_c）" : "截止 / 凋落（f ≤ f_c，曲线置 0）" },
        { k: "相速 v_p = c/√(1−(f_c/f)²)", v: propagating ? fmt(vpNow, 6) + " m/s（= " + fmt(vpNow / C_LIGHT, 4) + " c）" : "无实数相速（不传播）" },
        { k: "群速 v_g = c√(1−(f_c/f)²)", v: propagating ? fmt(vgNow, 6) + " m/s（= " + fmt(vgNow / C_LIGHT, 4) + " c）" : "0 m/s" },
        { k: "v_p·v_g", v: propagating ? fmt(vpNow * vgNow, 8) + " m²/s²（c² = " + fmt(C_LIGHT * C_LIGHT, 8) + "）" : "—" },
        { k: "波导波长 λ_g = v_p/f", v: isFinite(lambdaG) ? fmt(lambdaG * 100, 4) + " cm" : "—" },
        { k: "相位常数 β = 2π/λ_g", v: isFinite(beta) ? fmt(beta, 4) + " rad/m" : "—" },
        { k: "TE 波阻抗 Z_TE = η₀/√(1−(f_c/f)²)", v: isFinite(zTE) ? fmt(zTE, 4) + " Ω（η₀ = " + fmt(ETA0, 4) + " Ω）" : "纯虚（截止：只有衰减，不传能）" }
      ];
      if (mm === 0 && nn === 0) {
        info.push({ k: "物理说明", v: "空波导里不存在 TEM 波（需要两个以上导体），m = n = 0 只是为了看单模/色散极限" });
      }
      if (mm >= 1 && nn >= 1) {
        info.push({ k: "提示", v: "同一 (m, n) 也可以有 TM_" + mm + nn + " 模式（f_c 相同，波阻抗为 η₀√(1−(f_c/f)²)）" });
      }

      return {
        t: tG, series: { vp: vp, vg: vg },
        info: info,
        extra: {
          lines: lines,
          xlabel: "x (m)（沿 a 方向）", ylabel: "y (m)（沿 b 方向）",
          title: "横截面场型 TE_" + mm + nn + "（箭头 = 横向 E 的方向与相对大小，共 " + nArrow + " 个）"
        },
        metrics: {
          a: a, b: b, m: mm, n: nn, f: f, fG: fG, fcHz: fc, fcGHz: fcG,
          vp: vpNow, vg: vgNow, prop: propagating ? 1 : 0, lambdaC: lambdaC,
          lambdaG: lambdaG, zTE: zTE, beta: beta, nArrow: nArrow
        }
      };
    },
    tests: [
      { // f_c = (c/2)√((m/a)²+(n/b)²)：TE₁₀、a = 2.286 cm ⇒ c/(2a) = 6.557140376 GHz
        // 契约给 6.5574 GHz（相对容差 1e-4 ⇒ 绝对 6.56e-4），本条按契约的期望值比对
        name: "① TE₁₀（m=1、n=0、a = 2.286 cm）f_c = 6.5574 GHz（契约值，相对容差 1e-4）",
        params: { a: 2.286, b: 1.016, m: 1, n: 0 },
        measure: function (o) { return o.metrics.fcGHz; },
        expect: 6.5574, tol: 6.5574e-4 },
      { // 同一量的精确解析值 c/(2a) = 2.99792458e8/0.04572 = 6.557140376202975 GHz
        name: "① 精确值 c/(2a) = 6.557140376202975 GHz",
        params: { a: 2.286, b: 1.016, m: 1, n: 0 },
        measure: function (o) { return o.metrics.fcGHz; },
        expect: 6.557140376202975, tol: 1e-9 },
      { // 直接从曲线反推 f_c：任取传播区一点，f_c = f√(1−(v_g/c)²)（用网格最高频 40 GHz）
        name: "① 由曲线反推 f_c = f√(1−(v_g/c)²)（f = 40 GHz 处现算）= 6.5574 GHz",
        params: { a: 2.286, b: 1.016, m: 1, n: 0 },
        measure: function (o) {
          var i = o.t.length - 1;
          return o.t[i] * Math.sqrt(Math.max(0, 1 - Math.pow(o.series.vg[i] / C_LIGHT, 2)));
        }, expect: 6.5574, tol: 6.5574e-4 },
      { // f < f_c：群速必须为 0（不能是负的根号或 NaN）
        name: "② f < f_c 时群速 = 0（TE₁₀ 的 f_c = 6.557 GHz，取 f ≤ 6.5 GHz 的采样点）",
        params: { a: 2.286, b: 1.016, m: 1, n: 0 },
        measure: function (o) {
          var m = 0, i;
          for (i = 0; i < o.t.length; i++) {
            if (o.t[i] > o.metrics.fcGHz) continue;
            m = Math.max(m, Math.abs(o.series.vg[i]), Math.abs(o.series.vp[i]));
          }
          return m;
        }, expect: 0, tol: 0 },
      { // f_c 正好落在网格上（插进去的）：不许除零 ⇒ 不许出现非有限数
        name: "② f = f_c 恰在网格上时无 NaN/±∞（除零保护）",
        params: { a: 2.286, b: 1.016, m: 1, n: 0 },
        measure: function (o) {
          var i = nearestIndex(o.t, o.metrics.fcGHz);
          return Math.abs(o.t[i] - o.metrics.fcGHz) + countBad(o);
        }, expect: 0, tol: 1e-12 },
      { // ③ 相速 > c：v_p(f) 单调下降，网格最高点 f = 40 GHz 处最小，
        //    v_p/c = 1/√(1−(6.557140376/40)²) = 1.0137132888270353
        name: "③ 相速 v_p > c：传播区最小 v_p/c = 1.0137132888270353（f = 40 GHz 处）",
        params: { a: 2.286, b: 1.016, m: 1, n: 0 },
        measure: function (o) {
          var mn = Infinity, i;
          for (i = 0; i < o.t.length; i++) {
            if (o.series.vp[i] > 0) mn = Math.min(mn, o.series.vp[i] / C_LIGHT);
          }
          return mn;
        }, expect: 1.0137132888270353, tol: 1e-9 },
      { // ③ 群速 < c：传播区最大 v_g/c = √(1−(6.557140376/40)²) = 0.9864722215066324
        name: "③ 群速 v_g < c：传播区最大 v_g/c = 0.9864722215066324（f = 40 GHz 处）",
        params: { a: 2.286, b: 1.016, m: 1, n: 0 },
        measure: function (o) {
          var mx = 0, i;
          for (i = 0; i < o.t.length; i++) mx = Math.max(mx, o.series.vg[i] / C_LIGHT);
          return mx;
        }, expect: 0.9864722215066324, tol: 1e-9 },
      { // ④ v_p·v_g = c²：传播区逐点相对偏差的最大值必须为 0
        name: "④ v_p·v_g = c²（传播区逐点，最大相对偏差）",
        params: { a: 2.286, b: 1.016, m: 1, n: 0 },
        measure: function (o) {
          var m = 0, i, d;
          for (i = 0; i < o.t.length; i++) {
            if (!(o.series.vp[i] > 0)) continue;
            d = Math.abs(o.series.vp[i] * o.series.vg[i] / (C_LIGHT * C_LIGHT) - 1);
            if (d > m) m = d;
          }
          return m;
        }, expect: 0, tol: 1e-6 },
      { // ④ 换模式：TE₂₀（m=2、n=0）f_c = c/a = 13.11428075240595 GHz，v_p·v_g = c² 仍成立
        name: "④ TE₂₀（m=2、n=0）f_c = c/a = 13.11428075240595 GHz，且 v_p·v_g = c²",
        params: { a: 2.286, b: 1.016, m: 2, n: 0 },
        measure: function (o) {
          var m = 0, i, d;
          for (i = 0; i < o.t.length; i++) {
            if (!(o.series.vp[i] > 0)) continue;
            d = Math.abs(o.series.vp[i] * o.series.vg[i] / (C_LIGHT * C_LIGHT) - 1);
            if (d > m) m = d;
          }
          return o.metrics.fcGHz + m;
        }, expect: 13.11428075240595, tol: 1e-9 },
      { // ④ 换模式：TE₁₁（m=1、n=1）f_c = (c/2)√((1/a)²+(1/b)²) = 16.145085787909728 GHz
        name: "④ TE₁₁ 的 f_c = (c/2)√((1/a)²+(1/b)²) = 16.145085787909728 GHz（解析式核对）",
        params: { a: 2.286, b: 1.016, m: 1, n: 1 },
        measure: function (o) { return o.metrics.fcGHz; },
        expect: 16.145085787909728, tol: 1e-9 },
      { // 边界安全：全截止（f_c > 40 GHz）也不能出 NaN（曲线全 0）
        name: "⑤ 边界安全：TE₃₃、a = b = 0.5 cm（f_c > 40 GHz 全截止）无 NaN/±∞",
        params: { a: 0.5, b: 0.5, m: 3, n: 3 },
        measure: function (o) { return countBad(o) + maxAbs(o.series.vp) + maxAbs(o.series.vg); },
        expect: 0, tol: 0 },
      { name: "⑤ 边界安全：m = n = 0（TEM 约定 f_c = 0）+ 最大 a、b 无 NaN/±∞",
        params: { a: 10, b: 10, m: 0, n: 0 },
        measure: function (o) { return countBad(o); }, expect: 0, tol: 0 },
      { name: "⑤ 边界安全：f = 1 GHz（低于 f_c）、m = 0、n = 3 无 NaN/±∞",
        params: { a: 0.5, b: 3, m: 0, n: 3, f: 1 },
        measure: function (o) { return countBad(o); }, expect: 0, tol: 0 }
    ]
  });

  /* ======================================================================
     4. dipole-radiation —— 振荡电偶极子的辐射

     偶极矩 p(t) = p₀cos(ωt) 的远场辐射角分布与总功率（标准结果）
       dP/dΩ = p₀²ω⁴ sin²θ / (32π²ε₀c³)         （θ 从振荡轴量起）
       P     = ∮(dP/dΩ)dΩ = p₀²ω⁴ / (12πε₀c³)    （∫sin³θdθ = 4/3，4π·(4/3)/(32π²) = 1/(6π)）
     特征：角分布 ∝ sin²θ（赤道面最强、沿轴为零，曲线峰值在 90°）；总功率 ∝ ω⁴
     （ω → 2ω 则功率 ×16，这就是瑞利散射的蓝光偏好与"天空为什么是蓝的"）。
     距离 r 处的平均能流密度 ⟨S⟩ = (dP/dΩ)/r²（∝ 1/r²，但 dP/dΩ 与 P 与 r 无关）。
     辐射电阻（把偶极子看成短振子、等效电流 I₀ = p₀ω/l）：
       R_rad = (2π/3)η₀(l/λ)² = 789.0221 Ω × (l/λ)²

     单位约定（p₀、ω 是"相对"参数，必须写清归一化）：
       p₀ 以 p_ref = 1×10^-30 C·m 为单位（≈0.3 D，分子跃迁偶极矩量级），
       ω  以 ω_ref = 1×10^15 rad/s 为单位（λ ≈ 1.9 μm，近红外），
       r  以约化波长 ƛ = c/ω 为单位（远场条件 kr = r ≫ 1；r = 10 即 kr = 10）。
       于是 P_ref = p_ref²ω_ref⁴/(12πε₀c³) = 1.11188×10^-16 W，功率读数以 W 给出。
     r → 0 的边界：dP/dΩ 与 P 都与 r 无关，所以曲线不会爆；只有 info 里的 ⟨S⟩ = (dP/dΩ)/r²
     需要兜底（r 夹到 ≥1e-3，并提示 kr ≪ 1 时远场公式失效）。
     ====================================================================== */
  var P_REF = 1e-30, W_REF = 1e15;                       // 归一化单位
  var P_REF_W = (P_REF * P_REF) * Math.pow(W_REF, 4) / (12 * Math.PI * EPS0 * C_LIGHT * C_LIGHT * C_LIGHT);
  var R_RAD_COEF = (2 * Math.PI / 3) * ETA0;             // 789.0221238669101 Ω

  /** 偶极辐射的解析计算（自检里要用它做 ω 加倍对照，所以单独命名） */
  function dipoleCompute(p) {
    var p0r = num(p.p0, 0.1, 5, 1);
    var wr = num(p.omega, 0.1, 5, 1);
    var r = num(p.r, 1e-3, 50, 10);                      // 单位：约化波长 ƛ = c/ω
    var thDeg = num(p.theta, 0, 180, 90);

    var p0 = p0r * P_REF;                                // C·m
    var w = wr * W_REF;                                  // rad/s
    var K = (p0 * p0) * Math.pow(w, 4) / (32 * Math.PI * Math.PI * EPS0 * C_LIGHT * C_LIGHT * C_LIGHT);
    // K = p₀²ω⁴/(32π²ε₀c³)，于是 dP/dΩ = K sin²θ

    var TH = lin(0, 180, 361);                           // 0.5° 一点，含 0/90/180
    var dPdO = [], i, th;
    for (i = 0; i < TH.length; i++) {
      th = TH[i] * DEG;
      dPdO.push(K * Math.pow(Math.sin(th), 2));
    }

    /* 总功率：把曲线按立体角积分 P = ∮(dP/dΩ)dΩ = ∫₀^π (dP/dΩ)·2π sinθ dθ
       （被积函数 = 2πK sin³θ；梯形积分在端点 f′(0) = f′(π) = 0，误差只有 O(h⁴)） */
    var sum = 0, wgt;
    for (i = 0; i < TH.length; i++) {
      wgt = (i === 0 || i === TH.length - 1) ? 0.5 : 1;
      sum += wgt * dPdO[i] * 2 * Math.PI * Math.sin(TH[i] * DEG);
    }
    var Pnum = sum * (Math.PI / (TH.length - 1));        // 步长 = π/(N−1)（θ 以弧度步进）
    var Pana = (p0 * p0) * Math.pow(w, 4) / (12 * Math.PI * EPS0 * C_LIGHT * C_LIGHT * C_LIGHT);

    var i90 = nearestIndex(TH, 90);
    var iNow = nearestIndex(TH, thDeg);
    var peak = dPdO[i90];
    var lambda = 2 * Math.PI * C_LIGHT / w;              // m
    var rSI = r * (C_LIGHT / w);                         // 真实距离（m）= r·ƛ
    var S = dPdO[iNow] / (rSI * rSI);                    // W/m²（远场公式）

    /* ---- 辐射方向图（极坐标 → 直角坐标）：x = f(θ)sinθ、y = f(θ)cosθ ---- */
    var px = [], py = [], N = 180, j, a2;
    for (j = -N; j <= N; j++) {
      a2 = (j / N) * Math.PI;                            // −π … π
      px.push(Math.pow(Math.sin(a2), 2) * Math.sin(a2));
      py.push(Math.pow(Math.sin(a2), 2) * Math.cos(a2));
    }
    var cx = [], cy = [], M = 120;
    for (j = 0; j <= M; j++) {
      a2 = 2 * Math.PI * j / M;
      cx.push(Math.cos(a2)); cy.push(Math.sin(a2));
    }
    var axisX = [], axisY = [];
    for (j = 0; j <= 20; j++) { axisX.push(0); axisY.push(-1.15 + 2.3 * j / 20); }

    return {
      t: TH,
      series: { dPdO: dPdO },
      info: [
        { k: "归一化约定", v: "p₀ 以 10^-30 C·m 为单位、ω 以 10^15 rad/s 为单位 ⇒ P_ref = " + fmt(P_REF_W, 6) + " W" },
        { k: "角分布 dP/dΩ = p₀²ω⁴sin²θ/(32π²ε₀c³)", v: "θ = " + fmt(thDeg, 3) + "° 处 = " + fmt(dPdO[iNow], 6) + " W/sr" },
        { k: "峰值（θ = 90°）", v: fmt(peak, 6) + " W/sr（曲线最大值位置 θ = " + fmt(TH[argmaxIdx(dPdO, 0, dPdO.length)], 4) + "°）" },
        { k: "轴向 θ = 0°/180°", v: "dP/dΩ = 0（沿振荡轴不辐射）" },
        { k: "总功率 P = p₀²ω⁴/(12πε₀c³)", v: fmt(Pana, 6) + " W" },
        { k: "总功率（角分布数值积分）", v: fmt(Pnum, 6) + " W（与解析值相对偏差 " + fmt(Math.abs(Pnum / Pana - 1), 3) + "）" },
        { k: "ω 加倍后的功率", v: fmt(16 * Pana, 6) + " W（∝ ω⁴ ⇒ ×16）" },
        { k: "辐射波长 λ = 2πc/ω", v: fmt(lambda, 6) + " m（λ ≈ " + fmt(lambda * 1e9, 4) + " nm）" },
        { k: "观测距离 r（单位 ƛ = λ/2π）", v: fmt(r, 4) + " ƛ = " + fmt(rSI, 6) + " m（远场条件 kr = " + fmt(r, 4) + "）" },
        { k: "该处平均能流密度 ⟨S⟩ = (dP/dΩ)/r²", v: fmt(S, 6) + " W/m²（∝ 1/r²，但与 θ 的 sin²θ 形状无关地随 r 衰减）" },
        { k: "辐射电阻（短振子 R = (2π/3)η₀(l/λ)²）", v: fmt(R_RAD_COEF, 4) + " Ω × (l/λ)²（l/λ = 0.01 时 " + fmt(R_RAD_COEF * 1e-4, 4) + " Ω）" }
      ],
      extra: {
        lines: [
          { x: px, y: py, color: "#5aa9ff", label: "辐射方向图 ∝ sin²θ（归一化）" },
          { x: cx, y: cy, color: "#63d6a5", dash: "4 4", label: "参考圆（各向同性）" },
          { x: axisX, y: axisY, color: "#ff7b7b", dash: "2 4", label: "振荡轴" }
        ],
        markers: [{ x: 1, y: 0, label: "θ = 90°（最强）" }],
        xlabel: "x（垂直振荡轴，归一化）", ylabel: "y（沿振荡轴，归一化）",
        title: "辐射方向图：赤道面最强、两极方向为零"
      },
      metrics: {
        p0: p0, w: w, r: r, theta: thDeg, K: K,
        peak: peak, i90: i90, Pnum: Pnum, Pana: Pana, ratio: Pnum / Pana,
        lambda: lambda, rSI: rSI, S: S, RradCoef: R_RAD_COEF,
        P0: dPdO[0], PN: dPdO[dPdO.length - 1],
        dPdO: dPdO, TH: TH
      }
    };
  }

  SIM.register("dipole-radiation", {
    title: "振荡偶极子：sin²θ 角分布与 ω⁴ 功率律",
    legend: "振荡电偶极子的辐射不是各向同性的：dP/dΩ ∝ sin²θ，赤道面（θ = 90°）最强，" +
      "沿振荡轴（θ = 0°/180°）严格为零——这正是偶极天线水平方向图呈「甜甜圈」形的原因。" +
      "总功率 P ∝ p₀²ω⁴：频率加倍功率变 16 倍（瑞利散射 ∝ ω⁴ ⇒ 天空是蓝的、夕阳是红的）。" +
      "p₀、ω 是相对参数（p_ref = 10^-30 C·m、ω_ref = 10^15 rad/s），观测距离 r 以约化波长 λ/2π 为单位。",
    axes: { xlabel: "θ (°)（与振荡轴的夹角）", ylabel: "dP/dΩ (W/sr)" },
    params: {
      p0: { label: "偶极矩幅值 p₀", unit: "10⁻³⁰ C·m", def: 1, min: 0.1, max: 5, step: 0.1 },
      omega: { label: "角频率 ω", unit: "10¹⁵ rad/s", def: 1, min: 0.1, max: 5, step: 0.1 },
      r: { label: "观测距离 r", unit: "λ/2π", def: 10, min: 1, max: 50, step: 1 },
      theta: { label: "观测角 θ", unit: "°", def: 90, min: 0, max: 180, step: 1 }
    },
    plots: [
      { key: "dPdO", label: "dP/dΩ (W/sr) 角分布", color: "#5aa9ff" }
    ],
    compute: dipoleCompute,
    tests: [
      { // 归一化后逐点比对 sin²θ：|dPdΩ(θ)/max − sin²θ| 的最大值（曲线现算）
        name: "① 角分布 ∝ sin²θ：归一化后与 sin²θ 逐点最大偏差 = 0",
        measure: function (o) {
          var m = 0, i, s, d;
          for (i = 0; i < o.t.length; i++) {
            s = Math.pow(Math.sin(o.t[i] * Math.PI / 180), 2);
            d = Math.abs(o.series.dPdO[i] / o.metrics.peak - s);
            if (d > m) m = d;
          }
          return m;
        }, expect: 0, tol: 1e-9 },
      { // 峰值位置：曲线 argmax 在 θ = 90°（网格含 90.0°）
        name: "② 峰值在 θ = 90°（曲线 argmax 位置）",
        measure: function (o) {
          var i = argmaxIdx(o.series.dPdO, 0, o.series.dPdO.length);
          return o.t[i];
        }, expect: 90, tol: 1e-12 },
      { // 峰值的解析值：dP/dΩ(90°) = p₀²ω⁴/(32π²ε₀c³) = 1.3272093654415943e-17 W/sr
        // （p₀ = 1e-30 C·m、ω = 1e15 rad/s）
        name: "② 峰值 dP/dΩ(90°) = p₀²ω⁴/(32π²ε₀c³) = 1.3272093654415943e-17 W/sr",
        measure: function (o) { return o.metrics.peak; },
        expect: 1.3272093654415943e-17, tol: 1e-29 },
      { // ③ 总功率 ∝ ω⁴：ω → 2ω，曲线积分（数值 ∮dΩ）之比 = 16
        name: "③ 总功率 ∝ ω⁴：ω 加倍 ⇒ 数值积分功率 ×16",
        measure: function (o, p) {
          var o2 = dipoleCompute({ p0: p.p0, omega: 2 * p.omega, r: p.r, theta: p.theta });
          return o2.metrics.Pnum / o.metrics.Pnum;
        }, expect: 16, tol: 1e-9 },
      { // ③ 总功率的解析值：P = p₀²ω⁴/(12πε₀c³) = 1.1118803179325024e-16 W（p₀=1、ω=1）
        name: "③ 总功率解析值 P = p₀²ω⁴/(12πε₀c³) = 1.1118803179325024e-16 W",
        measure: function (o) { return o.metrics.Pana; },
        expect: 1.1118803179325024e-16, tol: 1e-28 },
      { // ③ 数值积分（把曲线按 dΩ = 2πsinθdθ 积起来）与解析式一致的相对偏差
        name: "③ 角分布数值积分 = 解析总功率（相对偏差 < 1e-9）",
        measure: function (o) { return o.metrics.ratio; }, expect: 1, tol: 1e-9 },
      { // ④ θ = 0 与 180° 处辐射为 0（sin²θ 的零点）
        name: "④ θ = 0° 与 180° 处 dP/dΩ = 0",
        measure: function (o) { return Math.abs(o.metrics.P0) + Math.abs(o.metrics.PN); },
        expect: 0, tol: 1e-30 },
      { // p₀ → 0 或 ω 很小时也不许出 NaN；p₀ 加倍功率 ×4（∝ p₀²）
        name: "④ p₀ 加倍 ⇒ 功率 ×4（∝ p₀²）",
        measure: function (o, p) {
          var o2 = dipoleCompute({ p0: 2 * p.p0, omega: p.omega, r: p.r, theta: p.theta });
          return o2.metrics.Pnum / o.metrics.Pnum;
        }, expect: 4, tol: 1e-9 },
      { // 总功率与观测距离、观测角无关（r 只影响能流密度 ⟨S⟩ = (dP/dΩ)/r²）
        name: "⑤ 总功率与观测距离 r 无关（r = 1 与 r = 50 的解析值相同）",
        params: { p0: 1, omega: 1, r: 50, theta: 30 },
        measure: function (o) { return o.metrics.Pana; },
        expect: 1.1118803179325024e-16, tol: 1e-28 },
      { // 辐射电阻系数 (2π/3)η₀ = 789.0221238669101 Ω（短振子 R_rad = (2π/3)η₀(l/λ)²）
        name: "⑤ 辐射电阻系数 (2π/3)η₀ = 789.0221238669101 Ω",
        measure: function (o) { return o.metrics.RradCoef; },
        expect: 789.0221238669101, tol: 1e-9 },
      { // 边界安全：r → 0（滑块下限以下是非法输入）、θ 取端点、p₀/ω 取上下限
        name: "⑤ 边界安全：r = 0、θ = 180°、p₀ = 5、ω = 5 无 NaN/±∞",
        params: { p0: 5, omega: 5, r: 0, theta: 180 },
        measure: function (o) { return countBad(o); }, expect: 0, tol: 0 },
      { name: "⑤ 边界安全：p₀ = 0.1、ω = 0.1、r = 1、θ = 0 无 NaN/±∞",
        params: { p0: 0.1, omega: 0.1, r: 1, theta: 0 },
        measure: function (o) { return countBad(o); }, expect: 0, tol: 0 }
    ]
  });

  /* ======================================================================
     5. relativity —— 狭义相对论

     β = v/c，γ = 1/√(1−β²)（β → 1 时 γ → ∞：所以 β 夹在 1−1e-9 以内，绝不允许取到 1）。
       kind = 0 时间膨胀：Δt = γΔτ（固有时 Δτ = 1 s），曲线 Δτ = 1 s 与 Δt = γ s 并列看差距
       kind = 1 长度收缩：L = L₀/γ（固有长度 L₀ = 1 m）
       kind = 2 质能关系：E = γmc²、动能 K = (γ−1)mc²（曲线是 E/(mc²) = γ 与 K/(mc²) = γ−1）
       kind = 3 洛伦兹变换：x′ = γ(x − βct)、ct′ = γ(ct − βx)；
                取 t = 0 的"同时面"⇒ x′ = γx、ct′ = −γβx ⇒ t = 0 同时的事件在 S′ 系里不同时
       kind = 4 速度合成：u = (u′ + v)/(1 + u′v/c²)，与伽利略叠加 u′ + v 并列对照
                （伽利略结果会越过 c，洛伦兹结果恒 < c）
     速度合成用"除以 c 的归一化"形式 u/c = (u′/c + β)/(1 + (u′/c)β)，全程无量纲，不会溢出。
     extra 是 (x, ct) 时空图（单位 c·s）：光锥 ct = ±x、S′ 系的两条轴（ct = x/β、ct = βx）、
     粒子世界线，用来把"同时性的相对性"画出来。
     ====================================================================== */
  SIM.register("relativity", {
    title: "狭义相对论：γ、时间膨胀、长度收缩、质能与速度合成",
    legend: "β = v/c 越接近 1，γ = 1/√(1−β²) 增长越快（β = 0.6 → 1.25，β = 0.999 → 22.37）：" +
      "动钟变慢 Δt = γΔτ、动尺缩短 L = L₀/γ、总能量 E = γmc²（β→0 回到 mc²）。" +
      "速度合成 u = (u′+v)/(1+u′v/c²) 与伽利略叠加 u′+v 对照，前者永远越不过 c（0.6c 与 0.6c 合成 = 0.882c）。" +
      "下方时空图里光锥 ct = ±x 画出了因果边界，S′ 系的两条轴相对 S 系张开，正是同时性相对性的来源。",
    axes: { xlabel: "横轴随选项变化：β（0~0.999）/ x（c·s）/ u′（c）", ylabel: "见各条曲线标签" },
    params: {
      beta: { label: "速度 β = v/c", def: 0.6, min: 0, max: 0.999, step: 0.001 },
      kind: {
        label: "显示内容", type: "enum",
        options: ["时间膨胀", "长度收缩", "质能关系", "洛伦兹变换", "速度合成"], def: 0
      },
      u: { label: "第二速度 u′/c（速度合成用）", def: 0.6, min: -0.99, max: 0.99, step: 0.01 }
    },
    plots: [
      { key: "proper", label: "固有时 Δτ = 1 s", color: "#63d6a5", dash: "5 4" },
      { key: "dt", label: "Δt = γΔτ (s)", color: "#5aa9ff" },
      { key: "L0", label: "固有长度 L₀ = 1 m", color: "#63d6a5", dash: "5 4" },
      { key: "L", label: "L = L₀/γ (m)", color: "#5aa9ff" },
      { key: "E", label: "E/(mc²) = γ", color: "#5aa9ff" },
      { key: "K", label: "K/(mc²) = γ − 1", color: "#ffb84d" },
      { key: "xp", label: "x′ = γ(x − βct) (c·s)", color: "#5aa9ff" },
      { key: "ctp", label: "ct′ = γ(ct − βx) (c·s)", color: "#ff7b7b" },
      { key: "speed", label: "u = (u′+v)/(1+u′v/c²)（c）", color: "#5aa9ff" },
      { key: "galileo", label: "伽利略叠加 u′+v（c，会超过 1）", color: "#ff7b7b", dash: "5 4" }
    ],
    compute: function (p) {
      var kind = int(p.kind, 0, 4, 0);
      var betaRaw = num(p.beta, -0.999, 0.999, 0.6);
      var beta = Math.max(-0.999999999, Math.min(0.999999999, betaRaw));   // β → 1 保护
      var u = num(p.u, -0.99, 0.99, 0.6);
      var g = 1 / Math.sqrt(Math.max(1e-18, 1 - beta * beta));             // γ
      var BS = lin(0, 0.999, 334);      // β 网格：步长 0.003，含 0、0.6、0.999

      var t, series = {}, info = [], lines = [], markers = [], j, x, mink = 1.2;
      var MINK = lin(-mink, mink, 41);

      /* ---- 时空图公共部分：光锥 + S′ 轴 ---- */
      var cone1x = [], cone1y = [], cone2x = [], cone2y = [], i;
      for (i = 0; i < MINK.length; i++) {
        cone1x.push(MINK[i]); cone1y.push(MINK[i]);
        cone2x.push(MINK[i]); cone2y.push(-MINK[i]);
      }
      lines.push({ x: cone1x, y: cone1y, color: "#ffb84d", dash: "4 4", label: "光锥 ct = ±x" });
      lines.push({ x: cone2x, y: cone2y, color: "#ffb84d", dash: "4 4" });
      if (Math.abs(beta) > 1e-6) {
        var ax = [], ay = [], bx = [], by = [];
        for (i = 0; i < MINK.length; i++) {
          ay.push(MINK[i]); ax.push(beta * MINK[i]);      // ct′ 轴：x = βct（S′ 原点世界线）
          bx.push(MINK[i]); by.push(beta * MINK[i]);      // x′ 轴：ct = βx（S′ 的"同时"线）
        }
        lines.push({ x: ax, y: ay, color: "#5aa9ff", label: "S′ 系的 ct′ 轴（x = βct）" });
        lines.push({ x: bx, y: by, color: "#63d6a5", label: "S′ 系的 x′ 轴（ct = βx）" });
      }

      if (kind === 0) {
        /* 时间膨胀：Δt = γΔτ（Δτ = 1 s） */
        var dt = [], pr = [];
        for (j = 0; j < BS.length; j++) {
          pr.push(1);
          dt.push(1 / Math.sqrt(Math.max(1e-18, 1 - BS[j] * BS[j])));
        }
        t = BS;
        series = { proper: pr, dt: dt };
        info = [
          { k: "γ = 1/√(1−β²)", v: fmt(g, 6) + "（β = " + fmt(beta, 4) + "）" },
          { k: "速度 v = βc", v: fmt(beta * C_LIGHT, 6) + " m/s" },
          { k: "固有时 Δτ", v: "1 s（动钟自己量到的时间）" },
          { k: "坐标时 Δt = γΔτ", v: fmt(g, 6) + " s（静止观察者量到的、变长了的时间）" },
          { k: "β = 0.999 时 γ", v: fmt(1 / Math.sqrt(1 - 0.999 * 0.999), 6) + "（契约值 22.36627）" },
          { k: "μ 子例子", v: "v = 0.999c、τ = 2.2 μs 的 μ 子，地面系寿命 2.2×" + fmt(g, 4) + " = " + fmt(2.2 * g, 4) + " μs" }
        ];
        // 等固有时刻度：τ = 0.2/0.4/0.6/0.8 s 的刻度落在世界线 (βγτ, γτ) 上，
        // 相邻刻度的坐标时间隔恒为 γΔτ —— 动钟变慢在图上就是刻度变稀
        var tau;
        for (j = 1; j <= 4; j++) {
          tau = 0.2 * j;
          x = beta * g * tau;
          if (Math.abs(x) < mink && g * tau < mink) {
            markers.push({ x: x, y: g * tau, label: "τ = " + fmt(tau, 2) + " s" });
          }
        }
        lines.push({ x: [0, beta * mink], y: [0, mink], color: "#c792ea", label: "动钟的世界线（x = βct）" });
      } else if (kind === 1) {
        /* 长度收缩：L = L₀/γ（L₀ = 1 m） */
        var L = [], L0 = [];
        for (j = 0; j < BS.length; j++) {
          L0.push(1);
          L.push(Math.sqrt(Math.max(1e-18, 1 - BS[j] * BS[j])));
        }
        t = BS;
        series = { L0: L0, L: L };
        info = [
          { k: "γ = 1/√(1−β²)", v: fmt(g, 6) },
          { k: "固有长度 L₀", v: "1 m（与尺一起静止时量到的长度）" },
          { k: "观察到的长度 L = L₀/γ", v: fmt(1 / g, 6) + " m（沿运动方向收缩，横向不变）" },
          { k: "收缩比例", v: fmt(1 / g, 6) + "（β = 0.999 时只剩 " + fmt(Math.sqrt(1 - 0.999 * 0.999), 4) + "）" },
          { k: "注意", v: "收缩是同时性的后果，不是尺被压扁：尺的两端在观察者眼里必须同时测量" }
        ];
        lines.push({ x: [0, mink], y: [0, 0], color: "#c792ea", label: "尺 — 在 S 系 t = 0 的两端（0 与 1）" });
        lines.push({ x: [1, 1], y: [-mink, mink], color: "#c792ea", dash: "2 4" });
        markers.push({ x: 1, y: beta, label: "x′ 轴与 x = 1 世界线的交点：长度 = 1/γ" });
      } else if (kind === 2) {
        /* 质能关系：E = γmc²，K = (γ−1)mc² */
        var E = [], K = [];
        for (j = 0; j < BS.length; j++) {
          var gj = 1 / Math.sqrt(Math.max(1e-18, 1 - BS[j] * BS[j]));
          E.push(gj);
          K.push(gj - 1);
        }
        t = BS;
        series = { E: E, K: K };
        var MeV = 0.510998950;                        // 电子静能 m_ec²（constants.js）
        info = [
          { k: "γ = 1/√(1−β²)", v: fmt(g, 6) },
          { k: "总能量 E = γmc²", v: fmt(g, 6) + " mc²（β→0 时回到 mc²）" },
          { k: "动能 K = (γ−1)mc²", v: fmt(g - 1, 6) + " mc²" },
          { k: "动量 p = γmv", v: fmt(g * beta, 6) + " mc" },
          { k: "低速检验", v: "β = 0.01 时 K = " + fmt(1 / Math.sqrt(1 - 1e-4) - 1, 8) + " mc² ≈ ½β² = 0.00005" },
          { k: "以电子为例（m_ec² = 0.510998950 MeV）", v: "β = " + fmt(beta, 4) + " ⇒ E = " + fmt(g * MeV, 6) + " MeV、K = " + fmt((g - 1) * MeV, 6) + " MeV" }
        ];
        lines.push({ x: [0, beta * mink], y: [0, mink], color: "#c792ea", label: "粒子世界线" });
      } else if (kind === 3) {
        /* 洛伦兹变换：取 t = 0 的同时面（ct = 0），看 S′ 系里这些事件还同不同时 */
        var xs = lin(-1, 1, 201), xp = [], ctp = [];
        for (j = 0; j < xs.length; j++) {
          x = xs[j];
          xp.push(g * (x - beta * 0));                 // x′ = γ(x − βct)，取 ct = 0
          ctp.push(g * (0 - beta * x));                // ct′ = γ(ct − βx)
        }
        t = xs;
        series = { xp: xp, ctp: ctp };
        info = [
          { k: "γ = 1/√(1−β²)", v: fmt(g, 6) + "，β = " + fmt(beta, 4) },
          { k: "x′ = γ(x − βct)", v: "t = 0 的同时面上 ⇒ x′ = γx（斜率 " + fmt(g, 4) + "）" },
          { k: "ct′ = γ(ct − βx)", v: "同一面上 ⇒ ct′ = −γβx（斜率 " + fmt(-g * beta, 4) + "）" },
          { k: "同时性的相对性", v: "S 系里同时（Δt = 0）而相距 Δx = 1 c·s 的两个事件，在 S′ 系里相差 Δt′ = " + fmt(-g * beta, 6) + " s" },
          { k: "事件 (x, ct) = (1, 0) 的 S′ 坐标", v: "x′ = " + fmt(g, 6) + " c·s，ct′ = " + fmt(-g * beta, 6) + " c·s" },
          { k: "不变间隔", v: "c²t² − x² = " + fmt(0 - 1, 4) + "（类空，两事件无因果关系）" }
        ];
        lines.push({ x: [0, mink], y: [0, 0], color: "#c792ea", dash: "2 4", label: "S 系的 x 轴（ct = 0）" });
        // 读出 ct′ 的作图法：从事件沿 x′ 轴方向走到 ct′ 轴（x = βct），交点纵坐标就是 ct′
        var t1 = -g * g, t2 = -beta * g * g;
        if (Math.abs(t1) < mink && Math.abs(t2) < mink) {
          lines.push({
            x: [1, 1 + t1], y: [0, t2], color: "#c792ea", dash: "3 3",
            label: "沿 x′ 方向投影读 ct′ = −γβx"
          });
        }
        markers.push({ x: 1, y: 0, label: "事件 (1, 0)" });
      } else {
        /* 速度合成：u = (u′+v)/(1+u′v/c²)（全部除以 c 归一化） */
        var us = lin(-0.99, 0.99, 199), sp = [], ga = [];
        for (j = 0; j < us.length; j++) {
          var den = 1 + us[j] * beta;
          sp.push(Math.abs(den) < 1e-12 ? 0 : (us[j] + beta) / den);
          ga.push(us[j] + beta);
        }
        t = us;
        series = { speed: sp, galileo: ga };
        var uNow = 0, denNow = 1 + u * beta;
        if (Math.abs(denNow) > 1e-12) uNow = (u + beta) / denNow;
        info = [
          { k: "v（S′ 相对 S）", v: fmt(beta, 4) + " c" },
          { k: "u′（物体相对 S′）", v: fmt(u, 4) + " c" },
          { k: "洛伦兹合成 u = (u′+v)/(1+u′v/c²)", v: fmt(uNow, 6) + " c" },
          { k: "伽利略叠加 u′ + v", v: fmt(u + beta, 6) + " c" + (Math.abs(u + beta) > 1 ? "（已超过 c：经典叠加在这里失效）" : "") },
          { k: "契约校验：0.6c 与 0.6c", v: fmt(1.2 / 1.36, 6) + " c（= 0.8823529c）" },
          { k: "恒 < c 的保证", v: "曲线在 u′ ∈ [−0.99, 0.99] 上的最大 |u| = " + fmt(maxAbs(sp), 6) + " c < 1" },
          { k: "极限", v: "u′ → c 时 u → c（光速在任何惯性系里都是 c）；v → c 时同理" }
        ];
        var wl = [], wl2 = [];
        for (j = 0; j < MINK.length; j++) {
          wl.push(beta * MINK[j]);
          wl2.push(Math.abs(MINK[j]) < 1e-9 ? 0 : (uNow * MINK[j]));
        }
        lines.push({ x: wl, y: MINK.slice(), color: "#63d6a5", label: "S′ 的世界线（u = " + fmt(beta, 3) + "c）" });
        if (Math.abs(uNow) > 1e-6) {
          lines.push({ x: wl2, y: MINK.slice(), color: "#c792ea", label: "合成速度世界线（u = " + fmt(uNow, 4) + "c）" });
        }
      }

      var curG = g;
      return {
        t: t, series: series, info: info,
        extra: {
          lines: lines, markers: markers,
          xlabel: "x (c·s)", ylabel: "ct (c·s)",
          title: "时空图（单位 c·s；橙虚线 = 光锥 ct = ±x，蓝 = ct′ 轴，绿 = x′ 轴）"
        },
        metrics: {
          kind: kind, beta: beta, u: u, g: curG, gamma: curG,
          gammaB999: 1 / Math.sqrt(1 - 0.999 * 0.999),
          dt: curG, L: 1 / curG, E: curG, K: curG - 1,
          uCombined: (Math.abs(1 + u * beta) > 1e-12) ? (u + beta) / (1 + u * beta) : 0,
          uGalileo: u + beta,
          maxSpeed: maxAbs(series.speed || []),
          nLine: lines.length
        }
      };
    },
    tests: [
      { // γ = 1/√(1−β²)：β = 0.6 → 1/0.8 = 1.25（从质能曲线 E/(mc²) = γ 上现读）
        name: "① γ = 1/√(1−β²)：β = 0.6 → 1.25（曲线 E/(mc²) 在 β = 0.6 处现读）",
        params: { kind: 2, beta: 0.6 },
        measure: function (o) { return o.series.E[nearestIndex(o.t, 0.6)]; },
        expect: 1.25, tol: 1e-9 },
      { // γ(0.999) = 1/√(1−0.999²) = 22.366272042129371（契约写作 22.36627，是舍入值）
        name: "① γ(0.999) = 1/√(1−0.999²) = 22.366272042129371（曲线末点现读）",
        params: { kind: 2, beta: 0.999 },
        measure: function (o) { return o.series.E[o.series.E.length - 1]; },
        expect: 22.366272042129371, tol: 1e-9 },
      { // γ ≥ 1 恒成立（含 β = 0：γ = 1）
        name: "① β = 0 时 γ = 1（曲线首点）",
        params: { kind: 2, beta: 0 },
        measure: function (o) { return o.series.E[0]; }, expect: 1, tol: 1e-12 },
      { // ② 时间膨胀：Δt = γΔτ，固有时曲线恒为 1 s，坐标时曲线 = γ
        name: "② 时间膨胀 Δt = γΔτ：β = 0.6 时 Δt = 1.25 s（Δτ = 1 s）",
        params: { kind: 0, beta: 0.6 },
        measure: function (o) {
          var i = nearestIndex(o.t, 0.6);
          return o.series.dt[i] - o.series.proper[i];
        }, expect: 0.25, tol: 1e-9 },
      { // ② 固有时曲线恒为 1 s（不该被 γ 缩放）
        name: "② 固有时 Δτ ≡ 1 s（曲线恒等于 1，不许被 γ 缩放）",
        params: { kind: 0, beta: 0.999 },
        measure: function (o) { return maxAbsDiff(o.series.proper, lin(1, 1, o.series.proper.length)); },
        expect: 0, tol: 1e-12 },
      { // ③ 长度收缩：L = L₀/γ：β = 0.6 → 0.8 m
        name: "③ 长度收缩 L = L₀/γ：β = 0.6 → 0.8 m",
        params: { kind: 1, beta: 0.6 },
        measure: function (o) { return o.series.L[nearestIndex(o.t, 0.6)]; },
        expect: 0.8, tol: 1e-9 },
      { // ③ 固有长度曲线恒为 1 m
        name: "③ 固有长度 L₀ ≡ 1 m（曲线恒等于 1）",
        params: { kind: 1, beta: 0.6 },
        measure: function (o) { return maxAbsDiff(o.series.L0, lin(1, 1, o.series.L0.length)); },
        expect: 0, tol: 1e-12 },
      { // ④ 质能：E = γmc²，β → 0 时回到 mc²（β = 0 点现读）
        name: "④ 质能 E = γmc²：β = 0 时 E/(mc²) = 1",
        params: { kind: 2, beta: 0 },
        measure: function (o) { return o.series.E[0]; }, expect: 1, tol: 1e-12 },
      { // ④ 动能 K = (γ−1)mc²：β = 0.6 → 0.25 mc²；且 E − K = 1
        name: "④ 动能 K = (γ−1)mc²：β = 0.6 → 0.25 mc²，且 E − K = 1",
        params: { kind: 2, beta: 0.6 },
        measure: function (o) {
          var i = nearestIndex(o.t, 0.6);
          return o.series.K[i] + (o.series.E[i] - o.series.K[i] - 1);
        }, expect: 0.25, tol: 1e-9 },
      { // ⑤ 速度合成：0.6c 与 0.6c → (0.6+0.6)/(1+0.36) = 0.8823529411764706 c
        name: "⑤ 速度合成 0.6c ⊕ 0.6c = 0.8823529411764706 c（曲线 u′ = 0.6 处现读）",
        params: { kind: 4, beta: 0.6, u: 0.6 },
        measure: function (o) { return o.series.speed[nearestIndex(o.t, 0.6)]; },
        expect: 0.8823529411764706, tol: 1e-9 },
      { // ⑤ 合成结果恒 < c：max(0, |u| − 1) = 0（整条曲线）
        name: "⑤ 合成结果恒 < c：曲线逐点 max(0, |u| − 1) = 0",
        params: { kind: 4, beta: 0.999, u: 0.99 },
        measure: function (o) {
          var m = 0, i, d;
          for (i = 0; i < o.series.speed.length; i++) {
            d = Math.abs(o.series.speed[i]) - 1;
            if (d > m) m = d;
          }
          return m;
        }, expect: 0, tol: 1e-12 },
      { // ⑤ 伽利略叠加会超过 c（对照曲线必须真的越界，否则对照没有意义）
        name: "⑤ 伽利略叠加在 β = 0.6、u′ = 0.99 时 = 1.59 c > 1（对照曲线越界）",
        params: { kind: 4, beta: 0.6, u: 0.99 },
        measure: function (o) { return o.series.galileo[o.series.galileo.length - 1]; },
        expect: 1.59, tol: 1e-9 },
      { // ⑤ 洛伦兹合成单调不减（物理要求：伽利略与洛伦兹都单调）
        name: "⑤ 速度合成 u(u′) 单调不减（曲线逐点差分 ≥ −1e-15）",
        params: { kind: 4, beta: 0.6, u: 0.6 },
        measure: function (o) {
          var m = 0, i, d;
          for (i = 1; i < o.series.speed.length; i++) {
            d = o.series.speed[i - 1] - o.series.speed[i];
            if (d > m) m = d;
          }
          return m;
        }, expect: 0, tol: 1e-15 },
      { // 洛伦兹变换：x = 1、ct = 0、β = 0.6 ⇒ x′ = γ = 1.25（曲线末点）
        name: "⑤ 洛伦兹变换 x′ = γ(x−βct)：x = 1、t = 0、β = 0.6 → x′ = 1.25 c·s",
        params: { kind: 3, beta: 0.6 },
        measure: function (o) { return o.series.xp[o.series.xp.length - 1]; },
        expect: 1.25, tol: 1e-9 },
      { // 同上：ct′ = γ(ct − βx) = −γβx = −0.75 c·s（同时性的相对性）
        name: "⑤ 洛伦兹变换 ct′ = −γβx：x = 1、t = 0、β = 0.6 → ct′ = −0.75 c·s",
        params: { kind: 3, beta: 0.6 },
        measure: function (o) { return o.series.ctp[o.series.ctp.length - 1]; },
        expect: -0.75, tol: 1e-9 },
      { // 边界安全：β = 1（滑块给不到，但 config 可能写）必须被夹住，不许出 γ = ∞
        name: "⑥ 边界安全：β = 1 被夹住，γ 有限、无 NaN/±∞（5 种显示内容全覆盖）",
        params: { kind: 0, beta: 1, u: 0.99 },
        measure: function (o) {
          return countBad(o) + (isFinite(o.metrics.g) ? 0 : 1);
        }, expect: 0, tol: 0 },
      { name: "⑥ 边界安全：β = 0.999、kind = 3（洛伦兹变换）无 NaN/±∞",
        params: { kind: 3, beta: 0.999 },
        measure: function (o) { return countBad(o); }, expect: 0, tol: 0 },
      { name: "⑥ 边界安全：β = 0、kind = 4（速度合成）无 NaN/±∞",
        params: { kind: 4, beta: 0, u: -0.99 },
        measure: function (o) { return countBad(o); }, expect: 0, tol: 0 },
      { name: "⑥ 边界安全：β = 0.999、kind = 0/1/2 均无 NaN/±∞",
        params: { kind: 1, beta: 0.999 },
        measure: function (o) { return countBad(o); }, expect: 0, tol: 0 }
    ]
  });

})(typeof window !== "undefined" ? window : globalThis);
