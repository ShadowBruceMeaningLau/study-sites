/* ==========================================================================
   simlab-models-mathphys.js —— 数学物理方法 仿真模型（6 个）

     complex-map       保角映射 z → w = f(z)：z 平面正交网格的像（extra.lines 两族）
     fourier-series    傅里叶级数逐项逼近方波 / 锯齿波 / 三角波（含 Gibbs 过冲）
     vector-field      矢量场的散度与旋度（中心差分现算）+ 数值场线
     ode-family        常微分方程的解族（extra.lines 多条初值曲线）与解析解比对
     pde-separation    分离变量法：波动 / 热传导 / 拉普拉斯（都能代回方程验残差）
     special-functions 勒让德 P_n 与贝塞尔 J_m 曲线族

   ★ 与 simlab.js 相同的约束：**加载时不触碰 DOM**——只在加载时调用 SIM.register，
     所有 DOM 操作都由引擎在函数体内完成。这样 tools/verify-simlab.mjs 能在 Node 里
     用 window 桩直接跑 compute() 与 tests 做解析不变量自检。
   ★ 全部确定性：不使用任何随机数；任意参数取值都不抛异常、不产生 NaN/Infinity。

   每个模型 tests 的 expect 都是**解析值**，measure 尽量从返回的 series / metrics / 
   extra.lines 现算（而不是模型自报一个数），注释里写明所用公式。
   ========================================================================== */
(function (global) {
  "use strict";
  var SIM = global.SIM;
  if (!SIM) return;                 // 在 Node 里若未先加载 simlab.js，安静退出

  var rk4 = SIM.rk4, lin = SIM.linspace, fmt = SIM.fmt, opt = SIM.opt;

  /* ------------------------------------------------------------- 通用工具 */
  /** 最大值（忽略非有限值；全空时返回 0，保证不产生 NaN） */
  function maxOf(a) {
    var m = -Infinity, i, v;
    for (i = 0; i < a.length; i++) { v = a[i]; if (typeof v === "number" && isFinite(v) && v > m) m = v; }
    return m === -Infinity ? 0 : m;
  }
  /** 最小值（忽略非有限值） */
  function minOf(a) {
    var m = Infinity, i, v;
    for (i = 0; i < a.length; i++) { v = a[i]; if (typeof v === "number" && isFinite(v) && v < m) m = v; }
    return m === Infinity ? 0 : m;
  }
  /** 取整并夹到 [lo, hi]（枚举/滑块参数越界时也不会崩） */
  function clampInt(v, lo, hi) {
    var n = Math.round(Number(v));
    if (!isFinite(n)) n = lo;
    return n < lo ? lo : (n > hi ? hi : n);
  }
  /** 数组中最接近 x 的下标 */
  function nearestIndex(xs, x) {
    var best = 0, bd = Infinity, i, d;
    for (i = 0; i < xs.length; i++) { d = Math.abs(xs[i] - x); if (d < bd) { bd = d; best = i; } }
    return best;
  }
  /** 梯形法 ∫ y dx */
  function trapz(xs, ys) {
    var s = 0, i, h, m = Math.min(xs.length, ys.length);
    for (i = 0; i < m - 1; i++) { h = xs[i + 1] - xs[i]; s += 0.5 * (ys[i] + ys[i + 1]) * h; }
    return s;
  }
  /** 两条曲线逐点最大绝对偏差（长度取短者） */
  function maxAbsDiff(a, b) {
    var m = Math.min(a.length, b.length), i, d = 0, v;
    for (i = 0; i < m; i++) { v = Math.abs(a[i] - b[i]); if (isFinite(v) && v > d) d = v; }
    return d;
  }
  /** 两条曲线逐点最大**相对**偏差 max |a−b| / max(|b|, 1e-12) */
  function maxRelDiff(a, b) {
    var m = Math.min(a.length, b.length), i, d = 0, v, s;
    for (i = 0; i < m; i++) {
      s = Math.abs(b[i]) > 1e-12 ? Math.abs(b[i]) : 1e-12;
      v = Math.abs(a[i] - b[i]) / s;
      if (isFinite(v) && v > d) d = v;
    }
    return d;
  }
  /** 过零点（线性插值），用于周期 / 零点定位 */
  function zeroCrossings(xs, ys) {
    var out = [], i;
    for (i = 1; i < xs.length && i < ys.length; i++) {
      if ((ys[i - 1] < 0 && ys[i] >= 0) || (ys[i - 1] > 0 && ys[i] <= 0)) {
        out.push(xs[i - 1] + ((xs[i] - xs[i - 1]) * (0 - ys[i - 1])) / (ys[i] - ys[i - 1]));
      }
    }
    return out;
  }
  /** 截断曲线：遇到非有限值或 |y| 超过 cap（发散/爆破解）就停止取点 */
  function clipCurve(ts, ys, cap) {
    var x = [], y = [], i, v;
    for (i = 0; i < ys.length; i++) {
      v = ys[i];
      if (typeof v !== "number" || !isFinite(v) || Math.abs(v) > cap) break;
      x.push(ts[i]); y.push(v);
    }
    return { x: x, y: y };
  }

  /* ==========================================================================
     1. complex-map —— 保角映射（z 平面正交网格 → w = f(z) 的像）
     ========================================================================== */
  var CM_KINDS = ["z²", "1/z", "e^z", "√z"];

  /**
   * 复数映射 w = f(z)，z = x + iy，返回 [Re w, Im w]。
   *   z²  : (x+iy)² = (x²−y²) + 2xy·i
   *   1/z : z̄/|z|² = (x − iy)/(x²+y²)（z = 0 是极点，网格已避开原点）
   *   e^z : e^x(cos y + i sin y)
   *   √z  : 主支 r^{1/2}e^{iθ/2}，θ = arg z ∈ (−π, π] ⇒ Re w ≥ 0（支割线取负实轴）
   */
  function cmap(kind, x, y) {
    var d, r, th, ex;
    if (kind === 1) {
      d = x * x + y * y;
      if (d < 1e-300) return [NaN, NaN];          // 极点：返回非有限值，由调用方跳过
      return [x / d, -y / d];
    }
    if (kind === 2) {
      ex = Math.exp(x);
      return [ex * Math.cos(y), ex * Math.sin(y)];
    }
    if (kind === 3) {
      r = Math.sqrt(Math.sqrt(x * x + y * y));
      th = 0.5 * Math.atan2(y, x);                // 主支：θ/2 ∈ (−π/2, π/2]
      return [r * Math.cos(th), r * Math.sin(th)];
    }
    return [x * x - y * y, 2 * x * y];
  }

  /* 网格规格：{ x 范围/条数, y 范围/条数, 每条采样点数 np }
     ① 采样点数 np 取得让 z₀ = 1+i 正好落在采样点上（保角性自检要用对称差分求切线）；
     ② 1/z 的 x 从 0.2 起（避开极点），√z 的 x 从 0.2 起（避开支割线 x ≤ 0）。 */
  var CM_GRID = [
    { x0: 0, x1: 2, nx: 9, y0: -2, y1: 2, ny: 17, np: 81 },          // z²
    { x0: 0.2, x1: 2.2, nx: 11, y0: -1.5, y1: 1.5, ny: 13, np: 61 },  // 1/z
    { x0: -2, x1: 2, nx: 17, y0: -3, y1: 3, ny: 25, np: 61 },         // e^z
    { x0: 0.2, x1: 2.2, nx: 11, y0: -2.2, y1: 2.2, ny: 23, np: 56 }   // √z
  ];
  var CM_COLORS = ["#5aa9ff", "#ffb84d"];        // 蓝：x = const；橙：y = const

  /* 每个映射要展示的"特殊点"（z 平面） */
  var CM_PTS = [
    [{ key: "z34", name: "z = 3+4i", x: 3, y: 4 }, { key: "z1i", name: "z = 1+i", x: 1, y: 1 }, { key: "zh", name: "z = 0.5", x: 0.5, y: 0 }],
    [{ key: "z1i", name: "z = 1+i", x: 1, y: 1 }, { key: "z2i", name: "z = 2i", x: 0, y: 2 }, { key: "zh", name: "z = 0.5", x: 0.5, y: 0 }],
    [{ key: "zipi", name: "z = iπ", x: 0, y: Math.PI }, { key: "zih", name: "z = iπ/2", x: 0, y: Math.PI / 2 }, { key: "z1", name: "z = 1", x: 1, y: 0 }],
    [{ key: "zm1", name: "z = −1（支割线上）", x: -1, y: 0 }, { key: "z1i", name: "z = 1+i", x: 1, y: 1 }, { key: "z4", name: "z = 4", x: 4, y: 0 }]
  ];

  /** 数值导数：f′(z₀) = ∂f/∂x = −i ∂f/∂y（柯西–黎曼），返回 {abs, cr} */
  function cmDeriv(kind, x, y) {
    var h = 1e-6;
    var a = cmap(kind, x + h, y), b = cmap(kind, x - h, y);
    var c = cmap(kind, x, y + h), d = cmap(kind, x, y - h);
    var ux = (a[0] - b[0]) / (2 * h), vx = (a[1] - b[1]) / (2 * h);
    var uy = (c[0] - d[0]) / (2 * h), vy = (c[1] - d[1]) / (2 * h);
    return {
      abs: Math.sqrt(ux * ux + vx * vx),
      cr: Math.max(Math.abs(ux - vy), Math.abs(uy + vx))   // CR 残差 ⇒ 保角性
    };
  }

  /** 取 extra.lines 中 tag 与常数 c 匹配的曲线（供 measure 现算） */
  function cmLine(o, tag, c) {
    var ls = (o.extra && o.extra.lines) || [], i;
    for (i = 0; i < ls.length; i++) {
      if (ls[i].tag === tag && Math.abs(ls[i].c - c) < 1e-12) return ls[i];
    }
    return null;
  }
  /**
   * 两条网格线（x = ref 与 y = ref）的像在交点处的夹角（度）——**直接在映射上求切线**：
   * f′ ≠ 0 处保角 ⇒ 夹角 = 90°。步长 d = 1e-5 时截断误差 ~d²·曲率 ≈ 6e-9 度。
   * （cmAngle 用画出来的折线求切线，精度受网格采样间距 0.05 限制，只适合像恰好是
   *   圆/直线的映射：z²、e^z 的对称弦正好等于切线。）
   */
  function cmAngleAt(kind, ref, d) {
    var h = d || 1e-5;
    var a = cmap(kind, ref, ref + h), b = cmap(kind, ref, ref - h);
    var c = cmap(kind, ref + h, ref), e = cmap(kind, ref - h, ref);
    var ux = a[0] - b[0], uy = a[1] - b[1];
    var vx = c[0] - e[0], vy = c[1] - e[1];
    var dot = ux * vx + uy * vy, cross = ux * vy - uy * vx;
    return (Math.atan2(Math.abs(cross), Math.abs(dot)) * 180) / Math.PI;
  }
  /**
   * 两条网格线的**像**在交点（参数 = ref，z₀ = ref + i·ref）处的夹角（度），
   * 从画出的折线（extra.lines）现算：用交点两侧的对称差分求切线。
   */
  function cmAngle(o, ref) {
    var va = cmLine(o, "v", ref), ha = cmLine(o, "h", ref);
    if (!va || !ha) return NaN;
    var ja = nearestIndex(va.t, ref), jb = nearestIndex(ha.t, ref);
    if (ja < 1 || ja > va.x.length - 2 || jb < 1 || jb > ha.x.length - 2) return NaN;
    var ax = va.x[ja + 1] - va.x[ja - 1], ay = va.y[ja + 1] - va.y[ja - 1];
    var bx = ha.x[jb + 1] - ha.x[jb - 1], by = ha.y[jb + 1] - ha.y[jb - 1];
    var dot = ax * bx + ay * by, cross = ax * by - ay * bx;
    return (Math.atan2(Math.abs(cross), Math.abs(dot)) * 180) / Math.PI;
  }

  SIM.register("complex-map", {
    title: "保角映射：正交网格的像",
    legend: "z 平面两组正交直线（蓝 x=const、橙 y=const）经 w = f(z) 变到 w 平面：像仍处处正交（f′≠0 处），这正是\"保角\"的含义。",
    axes: { xlabel: "Re z", ylabel: "Im z" },
    params: {
      kind: { label: "映射 f(z)", type: "enum", options: CM_KINDS, def: 0 }
    },
    plots: [],
    compute: function (p) {
      var kind = clampInt(p.kind, 0, 3);
      var g = CM_GRID[kind];
      var xs = lin(g.x0, g.x1, g.nx), ys = lin(g.y0, g.y1, g.ny);
      var ps = lin(g.y0, g.y1, g.np), qs = lin(g.x0, g.x1, g.np);
      var lines = [], i, j, w, wx, wy, pts, nm;

      /* 第一族：竖直线 x = const（像） */
      for (i = 0; i < xs.length; i++) {
        wx = []; wy = [];
        for (j = 0; j < ps.length; j++) {
          w = cmap(kind, xs[i], ps[j]);
          if (!isFinite(w[0]) || !isFinite(w[1])) break;    // 1/z 极点保护
          wx.push(w[0]); wy.push(w[1]);
        }
        lines.push({
          x: wx, y: wy, t: ps.slice(0, wx.length), tag: "v", c: xs[i],
          label: i === 0 ? "x = const 的像" : "", color: CM_COLORS[0]
        });
      }
      /* 第二族：水平线 y = const（像） */
      for (i = 0; i < ys.length; i++) {
        wx = []; wy = [];
        for (j = 0; j < qs.length; j++) {
          w = cmap(kind, qs[j], ys[i]);
          if (!isFinite(w[0]) || !isFinite(w[1])) break;
          wx.push(w[0]); wy.push(w[1]);
        }
        lines.push({
          x: wx, y: wy, t: qs.slice(0, wx.length), tag: "h", c: ys[i],
          label: i === 0 ? "y = const 的像" : "", color: CM_COLORS[1]
        });
      }

      /* 特殊点的像 */
      var spec = CM_PTS[kind], ptOut = {}, info = [];
      for (i = 0; i < spec.length; i++) {
        w = cmap(kind, spec[i].x, spec[i].y);
        ptOut[spec[i].key] = { re: w[0], im: w[1], name: spec[i].name };
        info.push({ k: spec[i].name + " → w", v: fmt(w[0], 6) + (w[1] < 0 ? " − " : " + ") + fmt(Math.abs(w[1]), 6) + "i" });
      }
      var dv = cmDeriv(kind, 1, 1);                       // z₀ = 1+i
      var ang = cmAngle({ extra: { lines: lines } }, 1);
      info.unshift({ k: "映射", v: "w = " + opt(CM_KINDS, kind) + "（网格 " + xs.length + " + " + ys.length + " 条，每条 " + g.np + " 点）" });
      info.push({ k: "|f′(1+i)|（缩放因子）", v: fmt(dv.abs, 6) });
      info.push({ k: "柯西–黎曼残差 max(|u_x−v_y|,|u_y+v_x|)", v: fmt(dv.cr, 4) + "（≈0 ⇒ 全纯 ⇒ 保角）" });
      info.push({ k: "网格像在 1+i 处的夹角", v: fmt(ang, 6) + "°（保角 ⇒ 90°）" });
      if (kind === 1) info.push({ k: "注意", v: "1/z 在 z = 0 有极点，网格从 x = 0.2 起；像的模 ≤ 1/0.2 = 5" });
      if (kind === 3) info.push({ k: "注意", v: "√z 取主支（支割线 = 负实轴），故网格取 x > 0，像落在右半平面" });

      return {
        t: xs, series: {},
        info: info,
        extra: {
          lines: lines,
          markers: [{ x: 0, y: 0, label: "w = 0" }],
          xlabel: "Re w", ylabel: "Im w",
          title: "w = " + opt(CM_KINDS, kind) + " 下正交网格的像（蓝：x = const，橙：y = const）"
        },
        metrics: {
          kind: kind, pts: ptOut, absD: dv.abs, cr: dv.cr, angle: ang,
          gridLines: lines.length
        }
      };
    },
    tests: [
      { name: "z²：(3+4i) → −7+24i（实部 = −7）", params: { kind: 0 },
        measure: function (o) { return o.metrics.pts.z34.re; }, expect: -7, tol: 1e-12 },
      { name: "z²：(3+4i) → −7+24i（虚部 = 24）", params: { kind: 0 },
        measure: function (o) { return o.metrics.pts.z34.im; }, expect: 24, tol: 1e-12 },
      { name: "1/z：(1+i) → 0.5−0.5i（实部 = 0.5）", params: { kind: 1 },
        measure: function (o) { return o.metrics.pts.z1i.re; }, expect: 0.5, tol: 1e-12 },
      { name: "1/z：(1+i) → 0.5−0.5i（虚部 = −0.5）", params: { kind: 1 },
        measure: function (o) { return o.metrics.pts.z1i.im; }, expect: -0.5, tol: 1e-12 },
      { name: "e^z：iπ → −1（实部 = −1）", params: { kind: 2 },
        measure: function (o) { return o.metrics.pts.zipi.re; }, expect: -1, tol: 1e-12 },
      { name: "e^z：iπ → −1（虚部 = sin π = 0）", params: { kind: 2 },
        measure: function (o) { return o.metrics.pts.zipi.im; }, expect: 0, tol: 1e-12 },
      { name: "√z 主支：−1 → i（实部 = 0，支割线取负实轴）", params: { kind: 3 },
        measure: function (o) { return o.metrics.pts.zm1.re; }, expect: 0, tol: 1e-12 },
      { name: "√z 主支：−1 → i（虚部 = 1）", params: { kind: 3 },
        measure: function (o) { return o.metrics.pts.zm1.im; }, expect: 1, tol: 1e-12 },
      { name: "保角性：z² 在 z₀=1+i 处两族像的夹角 = 90°（从画出的曲线现算）", params: { kind: 0 },
        measure: function (o) { return cmAngle(o, 1); }, expect: 90, tol: 1e-6 },
      { name: "保角性：1/z 在 z₀=1+i 处夹角 = 90°", params: { kind: 1 },
        measure: function (o) { void o; return cmAngleAt(1, 1); }, expect: 90, tol: 1e-6 },
      { name: "保角性：e^z 在 z₀=1+i 处夹角 = 90°", params: { kind: 2 },
        measure: function (o) { void o; return cmAngleAt(2, 1); }, expect: 90, tol: 1e-6 },
      { name: "保角性：√z 在 z₀=1+i 处夹角 = 90°（f′(1+i) ≠ 0）", params: { kind: 3 },
        measure: function (o) { void o; return cmAngleAt(3, 1); }, expect: 90, tol: 1e-6 }
    ]
  });

  /* ==========================================================================
     2. fourier-series —— 傅里叶级数逐项逼近
     ========================================================================== */
  var FS_KINDS = ["方波", "锯齿波", "三角波"];

  /* 采样网格：均匀 801 点 + 在跳变点 0、±π 附近加密（步长 6.25e-4）。
     Gibbs 峰宽 ~π/k_max（N=60 时 ≈0.026），加密后 max(approx) 的采样误差 ≈7e-6 ≪ 1e-3。
     同时显式保证 ±π/2 落在网格上（自检要取 x=π/2 处的部分和）。 */
  var FS_GRID = (function () {
    var xs = lin(-Math.PI, Math.PI, 801), i, j, t;
    var extra = [lin(-0.15, 0.15, 481), lin(-Math.PI, -Math.PI + 0.15, 241), lin(Math.PI - 0.15, Math.PI, 241)];
    for (i = 0; i < extra.length; i++) { t = extra[i]; for (j = 0; j < t.length; j++) xs.push(t[j]); }
    xs.push(Math.PI / 2, -Math.PI / 2, 0, Math.PI, -Math.PI);
    xs.sort(function (a, b) { return a - b; });
    var out = [];
    for (i = 0; i < xs.length; i++) {
      if (!out.length || Math.abs(xs[i] - out[out.length - 1]) > 1e-14) out.push(xs[i]);
    }
    return out;
  })();

  /**
   * 三种经典周期函数在 (−π, π) 上的傅里叶级数（取前 N 项）：
   *   方波   f(x) = sgn x       = (4/π) Σ_{k 奇} sin(kx)/k            b_k = 4/(πk)
   *   锯齿波 f(x) = x/π         = (2/π) Σ_{n≥1} (−1)^{n+1} sin(nx)/n
   *   三角波 f(x) = 1 − 2|x|/π  = (8/π²) Σ_{k 奇} cos(kx)/k²
   * 跳变点（x = 0, ±π）处级数收敛到左右极限的中值（狄利克雷定理）。
   */
  function fsPartial(kind, N, x) {
    var s = 0, j, k;
    if (kind === 1) {
      for (j = 1; j <= N; j++) s += ((j % 2 ? 1 : -1) * Math.sin(j * x)) / j;
      return (2 / Math.PI) * s;
    }
    if (kind === 2) {
      for (j = 0; j < N; j++) { k = 2 * j + 1; s += Math.cos(k * x) / (k * k); }
      return (8 / (Math.PI * Math.PI)) * s;
    }
    for (j = 0; j < N; j++) { k = 2 * j + 1; s += Math.sin(k * x) / k; }
    return (4 / Math.PI) * s;
  }
  /** 目标函数（跳变点取中值，与级数的极限一致） */
  function fsTarget(kind, x) {
    if (kind === 1) return x / Math.PI;
    if (kind === 2) return 1 - (2 * Math.abs(x)) / Math.PI;
    return x > 0 ? 1 : (x < 0 ? -1 : 0);
  }
  /** 均方误差 MSE = (1/2π)∫(S_N − f)² dx（梯形法；跳变处梯形误差 ~1e-4） */
  function fsMse(xs, approx, target) {
    var s = 0, i, h, a0, a1;
    for (i = 0; i < xs.length - 1; i++) {
      h = xs[i + 1] - xs[i];
      a0 = approx[i] - target[i]; a1 = approx[i + 1] - target[i + 1];
      s += 0.5 * (a0 * a0 + a1 * a1) * h;
    }
    return s / (2 * Math.PI);
  }
  /** 从网格上的 target 现算第一项傅里叶系数：(1/π)∫ f(x)·sin x（三角波用 cos x）dx */
  function fsCoef1(kind, xs, target) {
    var b = [], i;
    for (i = 0; i < xs.length; i++) b.push(target[i] * (kind === 2 ? Math.cos(xs[i]) : Math.sin(xs[i])));
    return trapz(xs, b) / Math.PI;
  }
  var FS_COEF1 = [4 / Math.PI, 2 / Math.PI, 8 / (Math.PI * Math.PI)];   // 解析值

  SIM.register("fourier-series", {
    title: "傅里叶级数逐项逼近",
    legend: "取前 N 项部分和：N 越大越贴近目标；跳变处永远有约 9% 的过冲（Gibbs 现象），方波的过冲极限是 1.1789797。",
    axes: { xlabel: "x (rad)，周期 2π", ylabel: "f(x)" },
    params: {
      kind: { label: "波形", type: "enum", options: FS_KINDS, def: 0 },
      N: { label: "项数 N", unit: "", def: 1, min: 1, max: 60, step: 1 }
    },
    plots: [
      { key: "approx", label: "部分和 S_N(x)", color: "#5aa9ff" },
      { key: "target", label: "目标 f(x)", color: "#ffb84d", dash: "6 4" }
    ],
    compute: function (p) {
      var kind = clampInt(p.kind, 0, 2), N = clampInt(p.N, 1, 60);
      var xs = FS_GRID, approx = [], target = [], i, mse, mx, coef1, kmax;
      for (i = 0; i < xs.length; i++) {
        approx.push(fsPartial(kind, N, xs[i]));
        target.push(fsTarget(kind, xs[i]));
      }
      mse = fsMse(xs, approx, target);
      mx = maxOf(approx);
      coef1 = fsCoef1(kind, xs, target);
      kmax = kind === 1 ? N : 2 * N - 1;
      return {
        t: xs, series: { approx: approx, target: target },
        info: [
          { k: "波形 / 项数", v: opt(FS_KINDS, kind) + "，N = " + N + "（最高谐波 " + (kind === 1 ? "n = " + N : "k = " + kmax + "，仅奇次") + "）" },
          { k: "第一项系数（数值积分）", v: fmt(coef1, 6) + "（解析 " + fmt(FS_COEF1[kind], 6) + "）" },
          { k: "均方误差 MSE = (1/2π)∫(S_N−f)²dx", v: fmt(mse, 8) },
          { k: "最大过冲 max S_N", v: fmt(mx, 6) },
          { k: "Gibbs 极限", v: kind === 0 ? "1.1789797（跳变高度的 8.95%）" : "连续函数无 Gibbs 现象" },
          { k: "N → ∞ 的收敛", v: "MSE ~ Σ_{未取到的 n} b_n²/2（Parseval）" }
        ],
        metrics: { kind: kind, N: N, mse: mse, maxApprox: mx, coef1: coef1, kmax: kmax }
      };
    },
    tests: [
      /* ① 方波第一项振幅：N=1 时 S_1 = (4/π) sin x，在 x = π/2 处取最大值 4/π */
      { name: "方波第一项振幅 b₁ = 4/π = 1.2732395（N=1 时 max S_N）", params: { N: 1 },
        measure: function (o) { return maxOf(o.series.approx); }, expect: 1.2732395, tol: 1e-6 },
      { name: "方波 b₁ = (1/π)∫f(x)sin x dx = 4/π（从画出的目标曲线现算）", params: { N: 1 },
        measure: function (o) { return fsCoef1(0, o.t, o.series.target); }, expect: 1.2732395, tol: 1e-4 },
      /* ② x = π/2 处方波的部分和 → 1 */
      { name: "方波 N=60 时 x=π/2 处部分和 → 1（容差 1e-2）", params: { N: 60 },
        measure: function (o) { return o.series.approx[nearestIndex(o.t, Math.PI / 2)]; }, expect: 1, tol: 1e-2 },
      /* ③ 均方误差（Parseval：MSE = Σ_{未取的 n} b_n²/2）。N=1 时 = (8/π²)(π²/8 − 1) = 1 − 8/π² */
      { name: "方波 N=1 的 MSE = 1 − 8/π² = 0.1894305（Parseval）", params: { N: 1 },
        measure: function (o) { return fsMse(o.t, o.series.approx, o.series.target); }, expect: 0.1894305, tol: 5e-4 },
      /* N=60 ⇒ 只保留 k ≤ 119 的奇次谐波：MSE = (8/π²)Σ_{k 奇 >119} 1/k² = 0.0033773 */
      { name: "方波 N=60 的 MSE = (8/π²)Σ_{k 奇>119}1/k² = 0.0033773", params: { N: 60 },
        measure: function (o) { return fsMse(o.t, o.series.approx, o.series.target); }, expect: 0.0033773, tol: 5e-4 },
      { name: "均方误差随项数 N 单调下降（N = 1…20 逐个比）",
        measure: function (o, p) {
          var prev = Infinity, ok = true, N, a, t, i, m;
          for (N = 1; N <= 20; N++) {
            a = []; t = [];
            for (i = 0; i < o.t.length; i++) { a.push(fsPartial(0, N, o.t[i])); t.push(fsTarget(0, o.t[i])); }
            m = fsMse(o.t, a, t);
            if (!(m < prev)) ok = false;
            prev = m;
          }
          void p;
          return ok ? 1 : 0;
        }, expect: 1, tol: 0 },
      /* ④ Gibbs 过冲：max S_N → 1.1789797（解析极限 (2/π)∫₀^π sin t/t dt） */
      { name: "方波 Gibbs 过冲 max S_N → 1.1789797（N=60，容差 1e-3）", params: { N: 60 },
        measure: function (o) { return maxOf(o.series.approx); }, expect: 1.1789797, tol: 1e-3 },
      /* 狄利克雷定理：跳变点收敛到左右极限的中值（锯齿波在 x=π 处 → (1 + (−1))/2 = 0） */
      { name: "锯齿波在跳变点 x=π 处收敛到中值 0（狄利克雷定理）", params: { kind: 1, N: 60 },
        measure: function (o) { return o.series.approx[nearestIndex(o.t, Math.PI)]; }, expect: 0, tol: 1e-9 }
    ]
  });

  /* ==========================================================================
     3. vector-field —— 矢量场的散度与旋度（中心差分）
     ========================================================================== */
  var VF_KINDS = ["径向源", "涡旋", "剪切", "偶极"];
  var VF_A = 0.8;        // 偶极：±源到原点的距离
  var VF_Y0 = 0.4;       // 水平扫描线高度（见 compute 里的说明）
  var VF_H = 1e-4;       // 中心差分步长（误差 O(h²) ≈ 1e-8，实测 ~1e-12）
  var VF_BOX = 3.2;      // 场线追踪区域半径

  /**
   * 四种二维矢量场（scale = 场强倍数 s）：
   *   径向源 F = s(x, y)         ∇·F = 2s，∇×F = 0
   *   涡旋   F = s(−y, x)        ∇·F = 0， ∇×F = 2s
   *   剪切   F = s(y, 0)         ∇·F = 0， ∇×F = −s
   *   偶极   两个反号二维"源"：F = s[(r−r₊)/|r−r₊|² − (r−r₋)/|r−r₋|²]，r± = (0, ±a)
   *          （r̂/r 在 r≠0 处散度恒为 0 ⇒ 远场 ∇·F = 0；且是梯度场 ⇒ ∇×F = 0）
   */
  function vfField(kind, s, x, y) {
    var dx1, dy1, r1, dx2, dy2, r2, e1, e2;
    if (kind === 1) return { x: -s * y, y: s * x };
    if (kind === 2) return { x: s * y, y: 0 };
    if (kind === 3) {
      dy1 = y - VF_A; dx1 = x;
      dy2 = y + VF_A; dx2 = x;
      r1 = dx1 * dx1 + dy1 * dy1;
      r2 = dx2 * dx2 + dy2 * dy2;
      e1 = r1 > 1e-12 ? s / r1 : 0;      // 落在奇点上时退化为 0（不产生 Infinity）
      e2 = r2 > 1e-12 ? s / r2 : 0;
      return { x: dx1 * e1 - dx2 * e2, y: dy1 * e1 - dy2 * e2 };
    }
    return { x: s * x, y: s * y };
  }
  /** ∇·F = ∂Fx/∂x + ∂Fy/∂y（中心差分） */
  function vfDiv(kind, s, x, y) {
    var h = VF_H;
    var a = vfField(kind, s, x + h, y), b = vfField(kind, s, x - h, y);
    var c = vfField(kind, s, x, y + h), d = vfField(kind, s, x, y - h);
    var v = (a.x - b.x) / (2 * h) + (c.y - d.y) / (2 * h);
    return isFinite(v) ? v : 0;
  }
  /** (∇×F)_z = ∂Fy/∂x − ∂Fx/∂y（中心差分） */
  function vfCurl(kind, s, x, y) {
    var h = VF_H;
    var a = vfField(kind, s, x + h, y), b = vfField(kind, s, x - h, y);
    var c = vfField(kind, s, x, y + h), d = vfField(kind, s, x, y - h);
    var v = (a.y - b.y) / (2 * h) - (c.x - d.x) / (2 * h);
    return isFinite(v) ? v : 0;
  }
  /** 归一化场方向（用于按弧长追踪场线；|F| 太小时返回 null） */
  function vfDir(kind, s, x, y) {
    var f = vfField(kind, s, x, y);
    var m = Math.sqrt(f.x * f.x + f.y * f.y);
    if (!isFinite(m) || m < 1e-9) return null;
    return { x: f.x / m, y: f.y / m };
  }
  /** 沿场线走一步（RK4，步长 = 弧长 h，方向 sgn = ±1） */
  function vfStep(kind, s, x, y, sgn, h) {
    var k1 = vfDir(kind, s, x, y); if (!k1) return null;
    var k2 = vfDir(kind, s, x + sgn * h * 0.5 * k1.x, y + sgn * h * 0.5 * k1.y); if (!k2) return null;
    var k3 = vfDir(kind, s, x + sgn * h * 0.5 * k2.x, y + sgn * h * 0.5 * k2.y); if (!k3) return null;
    var k4 = vfDir(kind, s, x + sgn * h * k3.x, y + sgn * h * k3.y); if (!k4) return null;
    return {
      x: x + ((sgn * h) / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
      y: y + ((sgn * h) / 6) * (k1.y + 2 * k2.y + 2 * k3.y + k4.y)
    };
  }
  /** 追踪一条场线：走到区域外、靠近奇点或步数用尽为止 */
  function vfTrace(kind, s, x0, y0, sgn, h, maxSteps, avoid) {
    var xs = [x0], ys = [y0], x = x0, y = y0, st, nx, bad, i, dx, dy;
    for (st = 0; st < maxSteps; st++) {
      nx = vfStep(kind, s, x, y, sgn, h);
      if (!nx || !isFinite(nx.x) || !isFinite(nx.y)) break;
      x = nx.x; y = nx.y;
      if (Math.abs(x) > VF_BOX || Math.abs(y) > VF_BOX) break;
      bad = false;
      for (i = 0; i < avoid.length; i++) {
        dx = x - avoid[i].x; dy = y - avoid[i].y;
        if (dx * dx + dy * dy < avoid[i].r * avoid[i].r) { bad = true; break; }
      }
      if (bad) break;
      xs.push(x); ys.push(y);
    }
    return { x: xs, y: ys };
  }
  /** 反向段 + 正向段拼成一条完整场线 */
  function vfJoin(a, b) {
    var x = [], y = [], i;
    for (i = a.x.length - 1; i >= 0; i--) { x.push(a.x[i]); y.push(a.y[i]); }
    for (i = 1; i < b.x.length; i++) { x.push(b.x[i]); y.push(b.y[i]); }
    return { x: x, y: y };
  }

  SIM.register("vector-field", {
    title: "矢量场的散度与旋度",
    legend: "中心差分现算 ∇·F 与 ∇×F：径向源有源无旋，涡旋有旋无源，剪切无源有旋，偶极远场两者都为 0。",
    axes: { xlabel: "x（水平扫描线 y = 0.4）", ylabel: "F_x 与 ∇·F" },
    params: {
      kind: { label: "场型", type: "enum", options: VF_KINDS, def: 0 },
      scale: { label: "场强倍数 scale", unit: "", def: 1, min: 0.2, max: 3, step: 0.05 }
    },
    plots: [
      { key: "Fx", label: "F_x（扫描线上）", color: "#5aa9ff" },
      { key: "div", label: "∇·F（中心差分）", color: "#63d6a5" }
    ],
    compute: function (p) {
      var kind = clampInt(p.kind, 0, 3);
      var s = isFinite(p.scale) ? p.scale : 1;
      /* 扫描线取 y = 0.4 而不是 y = 0：剪切场 F=(sy,0)、涡旋场 F=(−sy,sx)、偶极场在
         y = 0 上 Fx 与 ∇·F 恒等于 0（曲线退化成一条 0 线，看不出任何结构）。 */
      var y0 = VF_Y0;
      var xs = lin(-3, 3, 301), Fx = [], div = [], t = [], i, x;
      for (i = 0; i < xs.length; i++) {
        x = xs[i];
        t.push(x);
        Fx.push(vfField(kind, s, x, y0).x);
        div.push(vfDiv(kind, s, x, y0));
      }
      var probes = [{ x: 1, y: y0 }, { x: 0, y: 1 }, { x: 1.5, y: 0.75 }, { x: 5, y: 4 }];
      var pr = [], k;
      for (k = 0; k < probes.length; k++) {
        pr.push({
          x: probes[k].x, y: probes[k].y,
          div: vfDiv(kind, s, probes[k].x, probes[k].y),
          curl: vfCurl(kind, s, probes[k].x, probes[k].y)
        });
      }

      /* ---- 场线（数值追踪，步长 0.06）---- */
      var lines = [], av = [], th, n, seed, fwd, bwd, j;
      if (kind === 3) av = [{ x: 0, y: VF_A, r: 0.14 }, { x: 0, y: -VF_A, r: 0.14 }];
      if (kind === 0) {                                   // 径向源：从三圈种子向外/向内
        var radii = [0.5, 1.2, 2.0], na = 8;
        for (k = 0; k < radii.length; k++) {
          for (j = 0; j < na; j++) {
            th = (2 * Math.PI * j) / na + 0.2;
            seed = { x: radii[k] * Math.cos(th), y: radii[k] * Math.sin(th) };
            fwd = vfTrace(0, s, seed.x, seed.y, 1, 0.06, 120, av);
            bwd = vfTrace(0, s, seed.x, seed.y, -1, 0.06, 120, av);
            lines.push(vfJoin(fwd, bwd));
          }
        }
      } else if (kind === 1) {                            // 涡旋：同心圆
        var rs = [0.6, 1.2, 1.8, 2.4];
        for (k = 0; k < rs.length; k++) {
          lines.push(vfTrace(1, s, rs[k], 0, 1, 0.05, 520, av));
        }
      } else if (kind === 2) {                            // 剪切：水平线
        var yl = [-2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2];
        for (k = 0; k < yl.length; k++) {
          fwd = vfTrace(2, s, 0, yl[k], 1, 0.06, 200, av);
          bwd = vfTrace(2, s, 0, yl[k], -1, 0.06, 200, av);
          lines.push(vfJoin(fwd, bwd));
        }
      } else {                                            // 偶极：从正源附近撒种子
        n = 10;
        for (j = 0; j < n; j++) {
          th = (2 * Math.PI * j) / n + 0.15;
          lines.push(vfTrace(3, s, 0.3 * Math.cos(th), VF_A + 0.3 * Math.sin(th), 1, 0.06, 400, av));
        }
      }
      for (k = 0; k < lines.length; k++) {
        lines[k].label = k === 0 ? "场线（共 " + lines.length + " 条，数值追踪）" : "";
        lines[k].color = kind === 3 ? "#7fd8e8" : "#c792ea";
      }

      var markers = [];
      if (kind === 3) {
        markers.push({ x: 0, y: VF_A, label: "+源 (+" + fmt(s, 3) + ")" });
        markers.push({ x: 0, y: -VF_A, label: "−汇 (−" + fmt(s, 3) + ")" });
      }
      var info = [
        { k: "场型 / scale", v: opt(VF_KINDS, kind) + "，scale = " + fmt(s, 4) },
        { k: "中心差分步长 h", v: "1×10^-4（截断误差 O(h²)）" }
      ];
      for (k = 0; k < pr.length; k++) {
        info.push({
          k: "点 (" + fmt(pr[k].x, 3) + ", " + fmt(pr[k].y, 3) + ")：∇·F / ∇×F",
          v: fmt(pr[k].div, 6) + " / " + fmt(pr[k].curl, 6)
        });
      }
      info.push({ k: "解析对照", v: "径向源 2s/0，涡旋 0/2s，剪切 0/−s，偶极 0/0（奇点外）" });

      return {
        t: t, series: { Fx: Fx, div: div },
        info: info,
        extra: {
          lines: lines, markers: markers,
          xlabel: "x", ylabel: "y",
          title: "场线（起点沿种子线布置，沿 F 方向按弧长 RK4 追踪）"
        },
        metrics: { kind: kind, scale: s, probes: pr, y0: y0, nLines: lines.length }
      };
    },
    tests: [
      /* ① 径向源 F = s(x, y)：∇·F = ∂x/∂x + ∂y/∂y = 2s = 2（s = 1） */
      { name: "径向源：∇·F = 2（从画出的散度曲线现算，s = 1）", params: { kind: 0, scale: 1 },
        measure: function (o) { return o.series.div[nearestIndex(o.t, 1)]; }, expect: 2, tol: 1e-6 },
      { name: "径向源：∇×F = ∂Fy/∂x − ∂Fx/∂y = 0", params: { kind: 0, scale: 1 },
        measure: function (o) { return o.metrics.probes[0].curl; }, expect: 0, tol: 1e-6 },
      { name: "径向源：散度对 scale 线性（scale = 2 时 ∇·F = 4）", params: { kind: 0, scale: 2 },
        measure: function (o) { return o.metrics.probes[0].div; }, expect: 4, tol: 1e-6 },
      /* ② 涡旋 F = s(−y, x)：∇·F = 0，∇×F = ∂x/∂x − ∂(−y)/∂y = 2s = 2 */
      { name: "涡旋：∇·F = 0（不可压缩）", params: { kind: 1, scale: 1 },
        measure: function (o) { return o.metrics.probes[0].div; }, expect: 0, tol: 1e-6 },
      { name: "涡旋：∇×F = 2", params: { kind: 1, scale: 1 },
        measure: function (o) { return o.metrics.probes[0].curl; }, expect: 2, tol: 1e-6 },
      /* ③ 剪切 F = s(y, 0)：∇·F = 0，∇×F = 0 − s = −1 */
      { name: "剪切：∇·F = 0", params: { kind: 2, scale: 1 },
        measure: function (o) { return o.metrics.probes[0].div; }, expect: 0, tol: 1e-6 },
      { name: "剪切：∇×F = −1", params: { kind: 2, scale: 1 },
        measure: function (o) { return o.metrics.probes[0].curl; }, expect: -1, tol: 1e-6 },
      /* ④ 偶极：∇·(r̂/r) ≡ 0（r ≠ 0），两个反号源叠加后远场仍为 0 */
      { name: "偶极：远场 (5,4) 处 ∇·F = 0（容差 1e-3）", params: { kind: 3, scale: 1 },
        measure: function (o) { return o.metrics.probes[3].div; }, expect: 0, tol: 1e-3 },
      { name: "偶极：无旋 ∇×F = 0（梯度场）", params: { kind: 3, scale: 1 },
        measure: function (o) { return o.metrics.probes[3].curl; }, expect: 0, tol: 1e-6 }
    ]
  });

  /* ==========================================================================
     4. ode-family —— 常微分方程的解族与解析解比对
     ========================================================================== */
  var ODE_KINDS = ["y'=y", "y'=-y", "y'=y(1-y)", "y''=-y"];
  var ODE_FAMILY = [-2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2];
  var ODE_CAP = 1e6;      // 解的截断上限（logistic 的负初值会有限时间爆破）

  /**
   * 解析解：
   *   y' = y       y = y₀e^t
   *   y' = −y      y = y₀e^{−t}
   *   y' = y(1−y)  y = y₀e^t / [1 + y₀(e^t − 1)]（y₀<0 时在 t* = ln(1 − 1/y₀) 爆破）
   *   y'' = −y     y = y₀cos t（初速度取 0）
   */
  function odeExact(kind, y0, T, n) {
    var ts = lin(0, T, n), ys = [], i, t, y, e;
    for (i = 0; i < n; i++) {
      t = ts[i];
      if (kind === 0) y = y0 * Math.exp(t);
      else if (kind === 1) y = y0 * Math.exp(-t);
      else if (kind === 2) { e = Math.exp(t); y = (y0 * e) / (1 + y0 * (e - 1)); }
      else y = y0 * Math.cos(t);
      ys.push(y);
    }
    return clipCurve(ts, ys, ODE_CAP);
  }
  /** 数值解（RK4）：一阶用单分量状态，y''=−y 用 [y, y′] */
  function odeSolve(kind, y0, T, n) {
    var sol;
    if (kind === 3) {
      sol = rk4(function (t, y) { void t; return [y[1], -y[0]]; }, [y0, 0], 0, T, n);
      return clipCurve(sol.t, sol.y[0], ODE_CAP);
    }
    sol = rk4(function (t, y) {
      void t;
      var v = y[0];
      return [kind === 1 ? -v : (kind === 2 ? v * (1 - v) : v)];
    }, [y0], 0, T, n);
    return clipCurve(sol.t, sol.y[0], ODE_CAP);
  }
  /** 从 extra.lines 里按 tag 与 y₀ 取一条曲线（供 measure 现算） */
  function odeLine(o, tag, y0) {
    var ls = (o.extra && o.extra.lines) || [], i;
    for (i = 0; i < ls.length; i++) {
      if (ls[i].tag === tag && Math.abs(ls[i].y0 - y0) < 1e-9) return ls[i];
    }
    return null;
  }

  SIM.register("ode-family", {
    title: "常微分方程的解族",
    legend: "同一方程取不同初值 y₀ 得到一族解曲线（实线，RK4 数值解），当前 y₀ 的解析解用虚线叠在同一张图上比对。",
    axes: { xlabel: "t", ylabel: "y(t)" },
    params: {
      kind: { label: "方程", type: "enum", options: ODE_KINDS, def: 0 },
      y0: { label: "初值 y₀", unit: "", def: 1, min: -2, max: 2, step: 0.05 },
      T: { label: "观察时长 T", unit: "", def: 5, min: 1, max: 10, step: 0.5 }
    },
    plots: [],
    compute: function (p) {
      var kind = clampInt(p.kind, 0, 3);
      var y0 = isFinite(p.y0) ? p.y0 : 1;
      var T = isFinite(p.T) && p.T > 0 ? p.T : 5;
      var n = 1201, i, k, cur, fam = ODE_FAMILY.slice(), c;
      var has = false;
      for (i = 0; i < fam.length; i++) if (Math.abs(fam[i] - y0) < 1e-9) has = true;
      if (!has && y0 >= -2 && y0 <= 2) { fam.push(y0); fam.sort(function (a, b) { return a - b; }); }

      var lines = [];
      for (k = 0; k < fam.length; k++) {
        cur = odeSolve(kind, fam[k], T, n);
        c = Math.abs(fam[k] - y0) < 1e-9 ? "#ffb84d" : "#5aa9ff";
        lines.push({
          x: cur.x, y: cur.y, tag: "num", y0: fam[k], color: c,
          label: k === 0 ? "数值解族（RK4，不同 y₀）" : (Math.abs(fam[k] - y0) < 1e-9 ? "当前 y₀ = " + fmt(y0, 3) : "")
        });
      }
      var ex = odeExact(kind, y0, T, n);
      lines.push({ x: ex.x, y: ex.y, tag: "exact", y0: y0, color: "#63d6a5", dash: "6 4", label: "解析解（当前 y₀）" });

      var numCur = odeSolve(kind, y0, T, n);
      var yEndN = numCur.y.length ? numCur.y[numCur.y.length - 1] : NaN;
      var yEndE = ex.y.length ? ex.y[ex.y.length - 1] : NaN;
      var dev = numCur.y.length && ex.y.length ? maxRelDiff(numCur.y, ex.y) : NaN;

      var formula = [
        "y = y₀e^t（指数增长）",
        "y = y₀e^−t（指数衰减）",
        "y = y₀e^t/[1+y₀(e^t−1)]（logistic）",
        "y = y₀cos t（简谐，初速 0）"
      ][kind];
      var equil = [
        "y = 0 唯一平衡点，不稳定（线性化特征值 λ = 1 > 0）",
        "y = 0 唯一平衡点，渐近稳定（λ = −1 < 0）",
        "y = 0 不稳定（λ = 1）、y = 1 渐近稳定（λ = −1）；还满足 y₀ 与 1 的大小关系保持不变",
        "y = 0 是中心型平衡点：Lyapunov 稳定但不渐近稳定（能量 E = (y² + y′²)/2 守恒）"
      ][kind];

      return {
        t: [], series: {},
        info: [
          { k: "方程 / 解析解", v: opt(ODE_KINDS, kind) + "　→　" + formula },
          { k: "平衡点与稳定性", v: equil },
          { k: "末值 y(T)：数值 / 解析", v: fmt(yEndN, 6) + " / " + fmt(yEndE, 6) },
          { k: "最大相对偏差（数值 vs 解析）", v: fmt(dev, 4) + (dev < 1e-6 ? "（< 1e-6）" : "") },
          { k: "初值 y₀ / 时长 T / 步数", v: fmt(y0, 3) + " / " + fmt(T, 3) + " / " + n + "（RK4）" }
        ],
        extra: {
          lines: lines,
          markers: [{ x: 0, y: y0, label: "初值 y₀ = " + fmt(y0, 3) }],
          xlabel: "t", ylabel: "y(t)",
          title: "解族（实线：数值解；虚线：当前 y₀ 的解析解）"
        },
        metrics: { kind: kind, y0: y0, T: T, dev: dev, yEndN: yEndN, yEndE: yEndE, fam: fam.length }
      };
    },
    tests: [
      /* ① 各方程数值解与解析解最大相对偏差 < 1e-6（RK4 步长 h = T/1200，误差 ~h⁴） */
      { name: "y′=y：数值解与 e^t 最大相对偏差 < 1e-6", params: { kind: 0, y0: 1 },
        measure: function (o) {
          var a = odeLine(o, "num", 1), b = odeLine(o, "exact", 1);
          return a && b ? maxRelDiff(a.y, b.y) : NaN;
        }, expect: 0, tol: 1e-6 },
      { name: "y′=−y：数值解与 e^−t 最大相对偏差 < 1e-6", params: { kind: 1, y0: 1 },
        measure: function (o) {
          var a = odeLine(o, "num", 1), b = odeLine(o, "exact", 1);
          return a && b ? maxRelDiff(a.y, b.y) : NaN;
        }, expect: 0, tol: 1e-6 },
      { name: "y′=y(1−y)：数值解与 logistic 公式最大相对偏差 < 1e-6", params: { kind: 2, y0: 0.5 },
        measure: function (o) {
          var a = odeLine(o, "num", 0.5), b = odeLine(o, "exact", 0.5);
          return a && b ? maxRelDiff(a.y, b.y) : NaN;
        }, expect: 0, tol: 1e-6 },
      { name: "y″=−y：数值解与 cos t 最大相对偏差 < 1e-6", params: { kind: 3, y0: 1 },
        measure: function (o) {
          var a = odeLine(o, "num", 1), b = odeLine(o, "exact", 1);
          return a && b ? maxRelDiff(a.y, b.y) : NaN;
        }, expect: 0, tol: 1e-6 },
      /* ② logistic 平衡点 y = 1 的稳定性：两侧都单调趋向 1 */
      { name: "logistic：y₀ = 1.5 从上方单调下降趋于 1（y = 1 稳定）", params: { kind: 2, y0: 1.5 },
        measure: function (o, p) {
          var c = odeSolve(2, 1.5, p.T, 1201), i, ok = true;
          var last = c.y[c.y.length - 1];
          if (!(last < 1.5 && last > 1)) ok = false;
          for (i = 1; i < c.y.length; i++) if (c.y[i] > c.y[i - 1] + 1e-15) ok = false;
          return ok ? 1 : 0;
        }, expect: 1, tol: 0 },
      { name: "logistic：y₀ = 0.5 从下方单调上升趋于 1", params: { kind: 2, y0: 0.5 },
        measure: function (o, p) {
          var c = odeSolve(2, 0.5, p.T, 1201), i, ok = true;
          var last = c.y[c.y.length - 1];
          if (!(last > 0.5 && last < 1)) ok = false;
          for (i = 1; i < c.y.length; i++) if (c.y[i] < c.y[i - 1] - 1e-15) ok = false;
          return ok ? 1 : 0;
        }, expect: 1, tol: 0 },
      /* ③ y''=−y 的周期：cos t 的过零间距为 π，第 1、3 个过零点相距正好一个周期 2π */
      { name: "y″=−y：周期 = 2π = 6.2831853（数值解第 1、3 个过零点间距）", params: { kind: 3, y0: 1, T: 8 },
        measure: function (o) {
          var a = odeLine(o, "num", 1);
          if (!a) return NaN;
          var z = zeroCrossings(a.x, a.y);
          return z.length >= 3 ? z[2] - z[0] : NaN;
        }, expect: 6.2831853, tol: 1e-3 }
    ]
  });

  /* ==========================================================================
     5. pde-separation —— 分离变量法
     ========================================================================== */
  var PDE_KINDS = ["波动方程", "热传导方程", "拉普拉斯方程"];
  var PDE_L = 1, PDE_C = 1, PDE_ALPHA = 1, PDE_U1 = 1;   // L = 1、c = 1、α = 1、右端边界 U = 1
  var PDE_NX = 501;

  /**
   * 分离变量解（都满足各自的边界条件）：
   *   波动   u(x,t) = Σ bₖ sin(kπx/L)·cos(ωₖt)，ωₖ = kπc/L，本征值 λₖ = (kπ/L)²
   *          初条件：拨弦三角剖面 u(x,0) = 1 − |2x−1| ⇒ bₖ = 8(−1)^j/(k²π²)，k = 2j+1
   *   热传导 u(x,t) = Σ bₖ sin(kπx/L)·e^{−αλₖt}
   *          初条件：方波剖面 u(x,0) = 1 ⇒ bₖ = 4/(kπ)，k 奇
   *   拉普拉斯（一维边值）u(0)=0、u(L)=U ⇒ u = Ux/L（线性，与 t 无关）
   */
  function pdeCoef(kind, j) {
    var k = 2 * j + 1;
    if (kind === 1) return 4 / (k * Math.PI);
    return (8 * (j % 2 ? -1 : 1)) / (k * k * Math.PI * Math.PI);
  }
  function pdeU(kind, N, x, t) {
    var s = 0, j, k, lam, w;
    if (kind === 2) return (PDE_U1 * x) / PDE_L;
    for (j = 0; j < N; j++) {
      k = 2 * j + 1;
      lam = (k * Math.PI) / PDE_L;
      if (kind === 1) s += pdeCoef(1, j) * Math.sin(lam * x) * Math.exp((-PDE_ALPHA * lam * lam * t));
      else {
        w = (PDE_C * lam);
        s += pdeCoef(0, j) * Math.sin(lam * x) * Math.cos(w * t);
      }
    }
    return s;
  }
  /** 梯形法 ∫₀^L u dx（热传导的"总热量"正比于它，必须随 t 单调下降） */
  function pdeIntegral(kind, N, t) {
    var s = 0, m = 400, i, x0, x1;
    for (i = 0; i < m; i++) {
      x0 = (PDE_L * i) / m; x1 = (PDE_L * (i + 1)) / m;
      s += 0.5 * (pdeU(kind, N, x0, t) + pdeU(kind, N, x1, t)) * (x1 - x0);
    }
    return s;
  }

  SIM.register("pde-separation", {
    title: "分离变量法：波动 / 热传导 / 拉普拉斯",
    legend: "u = Σ bₙ sin(nπx/L)·Tₙ(t)：Tₙ 是 cos(ωₙt)（波动）或 e^{−αλₙt}（热传导）。三项都能代回原方程验证残差为 0。",
    axes: { xlabel: "x（L = 1，两端固定）", ylabel: "u(x, t)" },
    params: {
      kind: { label: "方程", type: "enum", options: PDE_KINDS, def: 0 },
      N: { label: "叠加项数 N", unit: "", def: 1, min: 1, max: 20, step: 1 },
      t: { label: "时刻 t", unit: "", def: 0.1, min: 0, max: 2, step: 0.01 }
    },
    plots: [
      { key: "u", label: "u(x, t)", color: "#5aa9ff" }
    ],
    compute: function (p) {
      var kind = clampInt(p.kind, 0, 2), N = clampInt(p.N, 1, 20);
      var t = isFinite(p.t) ? p.t : 0.1;
      if (t < 0) t = 0;
      var xs = lin(0, PDE_L, PDE_NX), u = [], i, x;
      for (i = 0; i < xs.length; i++) { x = xs[i]; u.push(pdeU(kind, N, x, t)); }

      /* extra：若干时刻的剖面（含初条件 t = 0）；拉普拉斯是稳态，各时刻剖面完全相同，
         只画一条，免得五条曲线重叠在一起。 */
      var fr = [0, 0.25, 0.5, 0.75, 1], lines = [], k, tt, uu, seen = [], dup, j;
      for (k = 0; k < fr.length; k++) {
        tt = fr[k] * t;
        dup = false;
        for (j = 0; j < seen.length; j++) if (Math.abs(seen[j] - tt) < 1e-12) dup = true;
        if (dup) continue;
        seen.push(tt);
      }
      if (kind === 2) seen = [t];
      for (k = 0; k < seen.length; k++) {
        tt = seen[k]; uu = [];
        for (i = 0; i < xs.length; i++) uu.push(pdeU(kind, N, xs[i], tt));
        lines.push({
          x: xs, y: uu, color: "#ffb84d",
          dash: (kind !== 2 && k !== seen.length - 1) ? "3 3" : null,
          label: kind === 2 ? "u = Ux/L（稳态，与 t 无关）" : (k === 0 ? "各时刻剖面 t = 0 … " + fmt(t, 3) : "")
        });
      }

      var mid = u[nearestIndex(xs, PDE_L / 2)];
      var integ = pdeIntegral(kind, N, t);
      var form = [
        "u = Σ bₖ sin(kπx/L)cos(ωₖt)，ωₖ = kπc/L（T″ + ω²T = 0）",
        "u = Σ bₖ sin(kπx/L)e^(−αλₖt)（T′ + αλT = 0）",
        "u = Σ Aₙ sin(nπx/L)·sinh(nπy/L)：X″ + λX = 0 与 Y″ − λY = 0；一维边值退化为 u = Ux/L"
      ][kind];
      var bcs = kind === 2 ? "u(0) = 0、u(L) = U = 1" : "u(0) = u(L) = 0（两端固定）";
      var ic = kind === 0 ? "u(x,0) = 1 − |2x−1|（拨弦三角剖面）"
        : (kind === 1 ? "u(x,0) = 1（方波剖面）" : "稳态，与 t 无关");

      return {
        t: xs, series: { u: u },
        info: [
          { k: "方程 / 分离变量形式", v: opt(PDE_KINDS, kind) + "　" + form },
          { k: "本征值 λₙ = (nπ/L)²", v: "λ₁ = " + fmt(Math.PI * Math.PI, 6) + "，λ₂ = " + fmt(4 * Math.PI * Math.PI, 6) + "，λ₃ = " + fmt(9 * Math.PI * Math.PI, 6) },
          { k: "边界条件 / 初条件", v: bcs + "；" + ic },
          { k: "叠加项数 N / 最高模", v: N + " / k = " + (2 * N - 1) + (kind === 2 ? "（拉普拉斯无本征值叠加，N 不影响结果）" : "（只激发奇次模）") },
          { k: "中点 u(L/2, t)", v: fmt(mid, 6) },
          { k: "∫₀^L u dx", v: fmt(integ, 6) + (kind === 1 ? "（随 t 单调下降）" : "") },
          { k: "当前时刻 t", v: fmt(t, 4) + (kind === 2 ? "（稳态，与 t 无关）" : "") }
        ],
        extra: {
          lines: lines,
          xlabel: "x", ylabel: "u(x, t)",
          title: "不同时刻的剖面（虚线段到当前时刻；端点始终满足边界条件）"
        },
        metrics: { kind: kind, N: N, t: t, integ: integ, mid: mid, bcs: bcs }
      };
    },
    tests: [
      /* ① 边界条件 */
      { name: "波动方程：边界 u(0) = u(L) = 0（sin(kπ·0) = sin(kπ) = 0）", params: { kind: 0 },
        measure: function (o) { var u = o.series.u; return Math.abs(u[0]) + Math.abs(u[u.length - 1]); }, expect: 0, tol: 1e-9 },
      { name: "热传导：边界 u(0) = u(L) = 0", params: { kind: 1 },
        measure: function (o) { var u = o.series.u; return Math.abs(u[0]) + Math.abs(u[u.length - 1]); }, expect: 0, tol: 1e-9 },
      { name: "拉普拉斯：u(0) = 0、u(L) = U = 1（线性解 u = Ux/L）", params: { kind: 2 },
        measure: function (o) { var u = o.series.u; return Math.abs(u[0]) + Math.abs(u[u.length - 1] - 1); }, expect: 0, tol: 1e-12 },
      /* ② 热传导：∫u dx 随 t 单调下降（解析：Σ 8/(k²π²)e^{−k²π²t}） */
      { name: "热传导：∫₀^L u dx 随 t 单调下降", params: { kind: 1, N: 8 },
        measure: function (o, p) {
          var N = clampInt(p.N, 1, 20), ts = [0.02, 0.05, 0.1, 0.2, 0.4, 0.8], prev = Infinity, ok = true, i, s;
          for (i = 0; i < ts.length; i++) {
            s = pdeIntegral(1, N, ts[i]);
            if (!(s < prev)) ok = false;
            prev = s;
          }
          return ok ? 1 : 0;
        }, expect: 1, tol: 0 },
      { name: "热传导：与 N = 200 的解最大偏差 < 1e-3（t = 0.1 时高阶模已被 e^{−k²π²t} 压掉）", params: { kind: 1, N: 1, t: 0.1 },
        measure: function (o, p) {
          var N = clampInt(p.N, 1, 20), t = isFinite(p.t) ? p.t : 0.1, worst = 0, i, x, d;
          for (i = 0; i <= 200; i++) {
            x = (PDE_L * i) / 200;
            d = Math.abs(pdeU(1, N, x, t) - pdeU(1, 200, x, t));
            if (d > worst) worst = d;
          }
          return worst;
        }, expect: 0, tol: 1e-3 },
      /* ③ 波动：把解代回方程 u_tt = c²u_xx，二阶中心差分的相对残差 */
      { name: "波动方程：代回方程 |u_tt − c²u_xx| / max(|u_tt|,|c²u_xx|) < 1e-3", params: { kind: 0, N: 1 },
        measure: function (o, p) {
          var N = clampInt(p.N, 1, 20), t = 0.1, hx = 1e-3, ht = 1e-4, worst = 0, i, x, utt, uxx, c2, den, r;
          for (i = 1; i < 200; i++) {                     // 只取内点（端点处二阶差分无意义）
            x = i / 200;
            utt = (pdeU(0, N, x, t + ht) - 2 * pdeU(0, N, x, t) + pdeU(0, N, x, t - ht)) / (ht * ht);
            uxx = (pdeU(0, N, x + hx, t) - 2 * pdeU(0, N, x, t) + pdeU(0, N, x - hx, t)) / (hx * hx);
            c2 = PDE_C * PDE_C * uxx;
            den = Math.max(Math.abs(utt), Math.abs(c2), 1e-12);
            r = Math.abs(utt - c2) / den;
            if (r > worst) worst = r;
          }
          return worst;
        }, expect: 0, tol: 1e-3 },
      /* ④ 拉普拉斯：线性解的 u_xx 恒为 0 */
      { name: "拉普拉斯：解满足 u_xx = 0（二阶中心差分，容差 1e-9）", params: { kind: 2 },
        measure: function (o) {
          var u = o.series.u, h = o.t[1] - o.t[0], worst = 0, i, v;
          for (i = 1; i < u.length - 1; i++) {
            v = Math.abs((u[i + 1] - 2 * u[i] + u[i - 1]) / (h * h));
            if (v > worst) worst = v;
          }
          return worst;
        }, expect: 0, tol: 1e-9 },
      /* 本征值 λ₁ = (π/L)² = π² = 9.8696044 —— 通过模型自己的解来验：
         热传导方程（kind=1）最低模按 e^{−αλ₁t} 衰减，所以中点值之比恰为 e^{−π²t}。
         ★ 这条自检曾经是**空转的**：measure 里 void 掉了 o 与 p，用 Math.PI 自己算出 π²
           再去比字面量，模型整个坏掉它也照样 PASS（变异测试实测：把 compute 换成空壳，
           9 条里仍有 5 条通过，包括这条）。现在改成真正调用两次数值解再取比值。 */
      { name: "本征值 λ₁ = (π/L)² = π²：热传导最低模的衰减因子 = e^{−π²t}（t = 0.05）",
        params: { kind: 1, N: 1, t: 0.05 },
        measure: function (o) {
          var m = SIM.models["pde-separation"];
          var z = m.compute(SIM.paramsOf("pde-separation", { kind: 1, N: 1, t: 0 }));
          return o.metrics.mid / z.metrics.mid;
        }, expect: Math.exp(-Math.PI * Math.PI * 0.05), tol: 1e-9 },
      /* 附：波动解的周期 T = 2L/c = 2（每 k 次模的相位都增加 2kπ） */
      { name: "波动方程：u(x, t + 2L/c) = u(x, t)，周期 = 2", params: { kind: 0, N: 5, t: 0.1 },
        measure: function (o, p) {
          var N = clampInt(p.N, 1, 20), t = isFinite(p.t) ? p.t : 0.1, worst = 0, i, x, d;
          for (i = 0; i <= 100; i++) {
            x = (PDE_L * i) / 100;
            d = Math.abs(pdeU(0, N, x, t + (2 * PDE_L) / PDE_C) - pdeU(0, N, x, t));
            if (d > worst) worst = d;
          }
          return worst;
        }, expect: 0, tol: 1e-9 }
    ]
  });

  /* ==========================================================================
     6. special-functions —— 勒让德 P_n 与贝塞尔 J_m
     ========================================================================== */
  var SF_KINDS = ["勒让德 P_n", "贝塞尔 J_m"];

  /** 勒让德多项式：递推 (n+1)P_{n+1} = (2n+1)xP_n − nP_{n−1}（|x| ≤ 1 时数值稳定） */
  function legendre(n, x) {
    var p0 = 1, p1 = x, k, p;
    if (n <= 0) return 1;
    if (n === 1) return x;
    for (k = 1; k < n; k++) {
      p = ((2 * k + 1) * x * p1 - k * p0) / (k + 1);
      p0 = p1; p1 = p;
    }
    return p1;
  }
  /**
   * 贝塞尔函数 J_m(x) = Σ_{k≥0} (−1)^k/(k!(k+m)!)·(x/2)^{2k+m}（x ≥ 0）。
   * 用递推 t_{k+1} = −t_k (x/2)²/((k+1)(k+m+1)) 逐项累加，避免阶乘溢出。
   */
  function besselJ(m, x) {
    var half = x / 2, t = 1, sum, k;
    if (m < 0) m = 0;
    for (k = 1; k <= m; k++) t *= half / k;      // (x/2)^m / m!
    sum = t;
    for (k = 0; k < 200; k++) {
      t = (-t * half * half) / ((k + 1) * (k + m + 1));
      sum += t;
      if (Math.abs(t) < 1e-19) break;
    }
    return sum;
  }
  /** J₀ 的第一个零点：先由网格定位变号区间，再二分（解析值 2.4048255577） */
  function sfFirstZeroJ0(xs, ys) {
    var i, a, b, m, fa, fm;
    for (i = 1; i < xs.length; i++) {
      if (ys[i - 1] > 0 && ys[i] <= 0) {
        a = xs[i - 1]; b = xs[i]; fa = ys[i - 1];
        for (m = 0; m < 80; m++) {
          var mid = 0.5 * (a + b), fm = besselJ(0, mid);
          if (fm === 0) return mid;
          if ((fa > 0) === (fm > 0)) { a = mid; fa = fm; } else b = mid;
        }
        return 0.5 * (a + b);
      }
    }
    return NaN;
  }

  SIM.register("special-functions", {
    title: "勒让德多项式与贝塞尔函数",
    legend: "P_n 用三项递推、J_m 用级数展开；切换 family 看另一族曲线，观察点处的各阶数值列在读数里。",
    axes: { xlabel: "x", ylabel: "P_n(x) / J_m(x)" },
    params: {
      kind: { label: "函数族", type: "enum", options: SF_KINDS, def: 0 },
      n: { label: "高亮阶 n", unit: "", def: 0, min: 0, max: 5, step: 1 },
      x: { label: "观察点 x", unit: "", def: 0.5, min: 0, max: 1, step: 0.01 }
    },
    plots: [
      { key: "P0", label: "P₀", color: "#5aa9ff" },
      { key: "P1", label: "P₁", color: "#ffb84d" },
      { key: "P2", label: "P₂", color: "#63d6a5" },
      { key: "P3", label: "P₃", color: "#ff7b7b" },
      { key: "P4", label: "P₄", color: "#c792ea" },
      { key: "P5", label: "P₅", color: "#7fd8e8" },
      { key: "J0", label: "J₀", color: "#5aa9ff" },
      { key: "J1", label: "J₁", color: "#ffb84d" },
      { key: "J2", label: "J₂", color: "#63d6a5" },
      { key: "J3", label: "J₃", color: "#ff7b7b" },
      { key: "J4", label: "J₄", color: "#c792ea" },
      { key: "J5", label: "J₅", color: "#7fd8e8" }
    ],
    compute: function (p) {
      var kind = clampInt(p.kind, 0, 1);
      var nHi = clampInt(p.n, 0, 5);
      var xObs = isFinite(p.x) ? Math.min(1, Math.max(0, p.x)) : 0.5;
      var xs = kind === 1 ? lin(0, 12, 601) : lin(-1, 1, 401);
      var series = {}, i, k, key, arr;
      for (k = 0; k <= 5; k++) {
        key = (kind === 1 ? "J" : "P") + k;
        arr = [];
        for (i = 0; i < xs.length; i++) arr.push(kind === 1 ? besselJ(k, xs[i]) : legendre(k, xs[i]));
        series[key] = arr;
      }
      var vals = [], info = [];
      var sub = "₀₁₂₃₄₅", tag = kind === 1 ? "J" : "P";
      for (k = 0; k <= 5; k++) {
        vals.push(kind === 1 ? besselJ(k, xObs) : legendre(k, xObs));
      }
      for (k = 0; k <= 5; k++) {
        info.push({ k: tag + sub.charAt(k) + "(" + fmt(xObs, 3) + ")", v: fmt(vals[k], 8) });
      }
      info.unshift({ k: "函数族 / 高亮阶", v: opt(SF_KINDS, kind) + "，n = " + nHi + "（" + tag + sub.charAt(nHi) + " = " + fmt(vals[nHi], 8) + "）" });
      if (kind === 1) {
        info.push({ k: "J₀ 的第一个零点", v: fmt(sfFirstZeroJ0(xs, series.J0), 8) + "（解析 2.4048256）" });
        info.push({ k: "递推关系", v: "J_{m−1}(x) + J_{m+1}(x) = (2m/x)J_m(x)；J_m(0) = δ_{m0}" });
      } else {
        info.push({ k: "端点值", v: "P_n(1) = 1，P_n(−1) = (−1)^n（可在 x = ±1 处读曲线）" });
        info.push({ k: "正交性", v: "∫₋₁¹ P_mP_n dx = 2/(2n+1)·δ_{mn}（例：∫P₁P₃ = 0）" });
      }
      info.push({ k: "采样", v: "x ∈ [" + fmt(xs[0], 2) + ", " + fmt(xs[xs.length - 1], 2) + "]，共 " + xs.length + " 点" });

      /* 贝塞尔族的 J₀ 第一零点（勒让德族无此概念，置 0，避免出现 NaN） */
      var fz = kind === 1 ? sfFirstZeroJ0(xs, series.J0) : 0;
      if (!isFinite(fz)) fz = 0;
      return {
        t: xs, series: series,
        info: info,
        metrics: { kind: kind, n: nHi, x: xObs, values: vals, firstZero: fz }
      };
    },
    tests: [
      /* ① P_n(1) = 1（递推在 x = 1 处给出 ((2n+1)−n)/(n+1) = 1，机器精度） */
      { name: "勒让德：P_n(1) = 1（n = 0…5，容差 1e-12）", params: { kind: 0 },
        measure: function (o) {
          var i, d = 0, v;
          for (i = 0; i <= 5; i++) { v = Math.abs(o.series["P" + i][o.t.length - 1] - 1); if (v > d) d = v; }
          return d;
        }, expect: 0, tol: 1e-12 },
      /* ② P_n(−1) = (−1)^n */
      { name: "勒让德：P_n(−1) = (−1)^n（n = 0…5）", params: { kind: 0 },
        measure: function (o) {
          var i, d = 0, want, v;
          for (i = 0; i <= 5; i++) {
            want = (i % 2) ? -1 : 1;
            v = Math.abs(o.series["P" + i][0] - want);
            if (v > d) d = v;
          }
          return d;
        }, expect: 0, tol: 1e-12 },
      /* ③ 正交性 ∫₋₁¹P₁P₃dx = 0：3 点高斯–勒让德求积对 4 次多项式精确 */
      { name: "勒让德：正交性 ∫₋₁¹P₁P₃dx = 0（3 点 Gauss 求积，精确到 5 次）", params: { kind: 0 },
        measure: function (o) {
          void o;
          var g = [-Math.sqrt(3 / 5), 0, Math.sqrt(3 / 5)], w = [5 / 9, 8 / 9, 5 / 9], i, s = 0;
          for (i = 0; i < 3; i++) s += w[i] * legendre(1, g[i]) * legendre(3, g[i]);
          return s;
        }, expect: 0, tol: 1e-12 },
      /* 奇偶性 P_n(−x) = (−1)^n P_n(x) */
      { name: "勒让德：奇偶性 P_n(−x) = (−1)^n P_n(x)（整个网格）", params: { kind: 0 },
        measure: function (o) {
          var m = o.t.length, i, k, d = 0, v;
          for (k = 0; k <= 5; k++) {
            for (i = 0; i < m; i++) {
              v = Math.abs(o.series["P" + k][m - 1 - i] - ((k % 2 ? -1 : 1) * o.series["P" + k][i]));
              if (v > d) d = v;
            }
          }
          return d;
        }, expect: 0, tol: 1e-12 },
      /* P₄(0.5) = (35x⁴ − 30x² + 3)/8 = −0.2890625 */
      { name: "勒让德：P₄(0.5) = (35x⁴−30x²+3)/8 = −0.2890625", params: { kind: 0, x: 0.5 },
        measure: function (o) { return o.series.P4[nearestIndex(o.t, 0.5)]; }, expect: -0.2890625, tol: 1e-12 },
      /* ④ J₀(0) = 1、J_m(0) = 0（m ≥ 1） */
      { name: "贝塞尔：J₀(0) = 1", params: { kind: 1 },
        measure: function (o) { return o.series.J0[0]; }, expect: 1, tol: 1e-12 },
      { name: "贝塞尔：J_m(0) = 0（m = 1…5）", params: { kind: 1 },
        measure: function (o) {
          var i, d = 0, v;
          for (i = 1; i <= 5; i++) { v = Math.abs(o.series["J" + i][0]); if (v > d) d = v; }
          return d;
        }, expect: 0, tol: 1e-12 },
      /* ⑤ J₀ 的第一个零点 = 2.4048255577 */
      { name: "贝塞尔：J₀ 的第一个零点 = 2.404826（容差 1e-5）", params: { kind: 1 },
        measure: function (o) { return o.metrics.firstZero; }, expect: 2.404826, tol: 1e-5 },
      /* J₁(2) = 0.5767248077568736（级数在 x = 2 收敛极快，误差 ~1e-16） */
      { name: "贝塞尔：J₁(2) = 0.5767248078（容差 1e-9）", params: { kind: 1 },
        measure: function (o) { return o.series.J1[nearestIndex(o.t, 2)]; }, expect: 0.5767248078, tol: 1e-9 },
      /* 递推关系 J_{m−1} + J_{m+1} = (2m/x)J_m（x = 2） */
      { name: "贝塞尔：递推 J_{m−1}(x) + J_{m+1}(x) = (2m/x)J_m(x)（x = 2，m = 1…4）",
        params: { kind: 1 },
        measure: function (o) {
          var j = nearestIndex(o.t, 2), x = o.t[j], m, d = 0, v;
          for (m = 1; m <= 4; m++) {
            v = Math.abs(o.series["J" + (m - 1)][j] + o.series["J" + (m + 1)][j] - ((2 * m) / x) * o.series["J" + m][j]);
            if (v > d) d = v;
          }
          return d;
        }, expect: 0, tol: 1e-10 }
    ]
  });

})(typeof window !== "undefined" ? window : globalThis);
