/* ==========================================================================
   simlab-models-mech.js —— 力学 / 振动 / 波动 仿真模型

   加载时不触碰 DOM（见 simlab.js 顶部约束），这样 tools/verify-simlab.mjs
   能在 Node 里直接跑 compute() 与 tests 做物理不变量自检。

   每个模型都带 tests：measure 尽量从 series **现算**（而不是模型自报一个数），
   这样测试才算真的独立。
   ========================================================================== */
(function (global) {
  "use strict";
  var SIM = global.SIM;
  if (!SIM) return;   // 在 Node 里若未先加载 simlab.js，安静退出

  var rk4 = SIM.rk4, lin = SIM.linspace, fmt = SIM.fmt;

  /* --------------------------------------------------------------- 小工具 */
  /** 取数组下标 i 的线性插值（用于事件定位 / 局部极值） */
  function lerpAt(xs, ys, i0, i1, target) {
    var x0 = xs[i0], x1 = xs[i1], y0 = ys[i0], y1 = ys[i1];
    if (y1 === y0) return x0;
    return x0 + ((target - y0) / (y1 - y0)) * (x1 - x0);
  }
  /** 逐个比较 y，返回所有局部极大/极小点的 {x, y, i} */
  function extrema(xs, ys, want) {
    var out = [];
    for (var i = 1; i < ys.length - 1; i++) {
      if (want === "min" && ys[i] <= ys[i - 1] && ys[i] < ys[i + 1]) out.push({ x: xs[i], y: ys[i], i: i });
      if (want === "max" && ys[i] >= ys[i - 1] && ys[i] > ys[i + 1]) out.push({ x: xs[i], y: ys[i], i: i });
    }
    return out;
  }
  /** 过零时刻（向上或向下），带线性插值 */
  function crossings(xs, ys, dir) {
    var out = [];
    for (var i = 1; i < ys.length; i++) {
      if (dir > 0 && ys[i - 1] < 0 && ys[i] >= 0) out.push(lerpAt(xs, ys, i - 1, i, 0));
      if (dir < 0 && ys[i - 1] > 0 && ys[i] <= 0) out.push(lerpAt(xs, ys, i - 1, i, 0));
    }
    return out;
  }
  /** 相对漂移： (max - min) / 平均绝对值 */
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
  function maxAbs(vals) {
    var m = 0;
    for (var i = 0; i < vals.length; i++) if (isFinite(vals[i])) m = Math.max(m, Math.abs(vals[i]));
    return m;
  }

  var DEG = Math.PI / 180;

  /* =================================================== 1. 匀变速直线运动 */
  SIM.register("kinematics", {
    title: "匀变速直线运动",
    legend: "x、v 随时间的曲线：加速度恒定，v 是斜直线，x 是抛物线。",
    axes: { xlabel: "t (s)", ylabel: "x (m) / v (m/s)" },
    params: {
      x0: { label: "初位置 x₀", unit: "m", def: 0, min: -10, max: 10, step: 0.5 },
      v0: { label: "初速度 v₀", unit: "m/s", def: 0, min: -10, max: 10, step: 0.5 },
      a: { label: "加速度 a", unit: "m/s²", def: 2, min: -5, max: 5, step: 0.1 },
      T: { label: "观察时长 T", unit: "s", def: 5, min: 1, max: 20, step: 1 }
    },
    plots: [
      { key: "x", label: "位置 x (m)", color: "#5aa9ff" },
      { key: "v", label: "速度 v (m/s)", color: "#ffb84d" },
      { key: "a", label: "加速度 a (m/s²)", color: "#63d6a5", dash: "5 4" }
    ],
    compute: function (p) {
      var n = 400, t = lin(0, p.T, n);
      var x = [], v = [], a = [];
      for (var i = 0; i < n; i++) {
        var ti = t[i];
        x.push(p.x0 + p.v0 * ti + 0.5 * p.a * ti * ti);
        v.push(p.v0 + p.a * ti);
        a.push(p.a);
      }
      var xEnd = x[n - 1], vEnd = v[n - 1];
      return {
        t: t, series: { x: x, v: v, a: a },
        info: [
          { k: "末速度 v(T)", v: fmt(vEnd, 4) + " m/s" },
          { k: "末位置 x(T)", v: fmt(xEnd, 4) + " m" },
          { k: "位移 Δx", v: fmt(xEnd - p.x0, 4) + " m" },
          { k: "判别式 v²−v₀²", v: fmt(vEnd * vEnd - p.v0 * p.v0, 4) + " = 2aΔx" }
        ]
      };
    },
    tests: [
      { name: "末速度满足 v = v₀ + aT（默认参数）", measure: function (o) { return o.series.v[o.series.v.length - 1]; }, expect: 10, tol: 1e-9 },
      { name: "末位置满足 x = x₀ + v₀T + aT²/2", measure: function (o) { return o.series.x[o.series.x.length - 1]; }, expect: 25, tol: 1e-9 },
      { name: "半程速度关系 v² = v₀² + 2aΔx（换一组参数）", params: { x0: 1, v0: 3, a: -1, T: 4 },
        measure: function (o, p) {
          var vEnd = o.series.v[o.series.v.length - 1], xEnd = o.series.x[o.series.x.length - 1];
          return (vEnd * vEnd - p.v0 * p.v0) - 2 * p.a * (xEnd - p.x0);
        }, expect: 0, tol: 1e-9 }
    ]
  });

  /* ======================================================= 2. 抛体运动 */
  SIM.register("projectile", {
    title: "抛体运动（含空气阻力）",
    legend: "阻力 k=0 时是标准抛物线；把 k 调大，射程与最大高度都变小，轨迹不再对称。",
    axes: { xlabel: "水平距离 x (m)", ylabel: "高度 y (m)" },
    params: {
      v0: { label: "初速度 v₀", unit: "m/s", def: 20, min: 5, max: 50, step: 1 },
      angle: { label: "抛射角 θ", unit: "度", def: 45, min: 5, max: 85, step: 1 },
      k: { label: "阻力系数 k", unit: "1/s", def: 0, min: 0, max: 2, step: 0.05 },
      g: { label: "重力加速度 g", unit: "m/s²", def: 9.8, min: 1, max: 20, step: 0.1 }
    },
    plots: [
      { key: "y", label: "轨迹 y(x)", color: "#5aa9ff" },
      { key: "y0", label: "无阻力对照（k=0）", color: "#ffb84d", dash: "5 4" }
    ],
    compute: function (p) {
      var th = p.angle * DEG;
      var vx0 = p.v0 * Math.cos(th), vy0 = p.v0 * Math.sin(th);
      function integrate(kk) {
        var f = function (t, y) {
          return [y[2], y[3], -kk * y[2], -p.g - kk * y[3]];
        };
        var tMax = (2 * vy0 / p.g) * 1.6 + 0.5;
        var n = 4000;
        var sol = rk4(f, [0, 0, vx0, vy0], 0, tMax, n);
        var xs = [], ys = [], tt = [];
        for (var i = 0; i < n; i++) {
          if (sol.y[1][i] < 0 && i > 0) {
            // 线性插值落到地面
            var t0 = sol.t[i - 1], t1 = sol.t[i], y0 = sol.y[1][i - 1], y1 = sol.y[1][i];
            var tc = t0 + (t1 - t0) * (0 - y0) / (y1 - y0);
            var xc = sol.y[0][i - 1] + (sol.y[0][i] - sol.y[0][i - 1]) * (tc - t0) / (t1 - t0);
            xs.push(xc); ys.push(0); tt.push(tc);
            break;
          }
          xs.push(sol.y[0][i]); ys.push(sol.y[1][i]); tt.push(sol.t[i]);
        }
        return { x: xs, y: ys, t: tt };
      }
      var main = integrate(p.k);
      // 无阻力对照：直接在同一组 x 上算抛物线（保证两条曲线同横轴可比）
      var y0curve = [], range0 = p.v0 * p.v0 * Math.sin(2 * th) / p.g;
      var cos2 = Math.cos(th) * Math.cos(th);
      for (var m = 0; m < main.x.length; m++) {
        var xx = main.x[m];
        y0curve.push(xx <= range0 ? xx * Math.tan(th) - (p.g * xx * xx) / (2 * p.v0 * p.v0 * cos2) : null);
      }
      var hMax = 0;
      for (var i = 0; i < main.y.length; i++) hMax = Math.max(hMax, main.y[i]);
      var range = main.x[main.x.length - 1], flight = main.t[main.t.length - 1];
      return {
        t: main.x, series: { y: main.y, y0: y0curve },
        info: [
          { k: "射程 R", v: fmt(range, 4) + " m" },
          { k: "最大高度", v: fmt(hMax, 4) + " m" },
          { k: "飞行时间", v: fmt(flight, 4) + " s" },
          { k: "无阻力理论射程", v: fmt(range0, 4) + " m" }
        ],
        metrics: { range: range, hMax: hMax, flight: flight, range0: range0 }
      };
    },
    tests: [
      { name: "无阻力射程 R = v₀²sin2θ/g = 40.816327 m", measure: function (o) { return o.metrics.range; }, expect: 40.816327, tol: 1e-3 },
      { name: "无阻力最大高度 h = v₀²sin²θ/(2g) = 10.204082 m", measure: function (o) { return o.metrics.hMax; }, expect: 10.204082, tol: 1e-3 },
      { name: "无阻力飞行时间 T = 2v₀sinθ/g = 2.886150 s", measure: function (o) { return o.metrics.flight; }, expect: 2.886150, tol: 1e-3 },
      { name: "有阻力时射程变短（k=0.5）", params: { k: 0.5 },
        measure: function (o) { return o.metrics.range < 40.816327 ? 1 : 0; }, expect: 1, tol: 0 }
    ]
  });

  /* ========================================================= 3. 一维碰撞 */
  SIM.register("collision", {
    title: "一维碰撞：动量与能量",
    legend: "恢复系数 e=1 是弹性碰撞（动能守恒），e=0 是完全非弹性（粘在一起）。动量在任何 e 下都守恒。",
    axes: { xlabel: "碰撞前后状态", ylabel: "数值" },
    params: {
      m1: { label: "质量 m₁", unit: "kg", def: 1, min: 0.2, max: 5, step: 0.1 },
      v1: { label: "初速度 v₁", unit: "m/s", def: 2, min: -5, max: 5, step: 0.1 },
      m2: { label: "质量 m₂", unit: "kg", def: 1, min: 0.2, max: 5, step: 0.1 },
      v2: { label: "初速度 v₂", unit: "m/s", def: 0, min: -5, max: 5, step: 0.1 },
      e: { label: "恢复系数 e", unit: "", def: 1, min: 0, max: 1, step: 0.05 }
    },
    plots: [],
    compute: function (p) {
      var M = p.m1 + p.m2;
      var u1 = ((p.m1 - p.e * p.m2) * p.v1 + (1 + p.e) * p.m2 * p.v2) / M;
      var u2 = ((p.m2 - p.e * p.m1) * p.v2 + (1 + p.e) * p.m1 * p.v1) / M;
      var pBefore = p.m1 * p.v1 + p.m2 * p.v2;
      var pAfter = p.m1 * u1 + p.m2 * u2;
      var kBefore = 0.5 * p.m1 * p.v1 * p.v1 + 0.5 * p.m2 * p.v2 * p.v2;
      var kAfter = 0.5 * p.m1 * u1 * u1 + 0.5 * p.m2 * u2 * u2;
      return {
        t: [0, 1, 2, 3], series: {},
        info: [
          { k: "碰后速度 v₁′", v: fmt(u1, 4) + " m/s" },
          { k: "碰后速度 v₂′", v: fmt(u2, 4) + " m/s" },
          { k: "动量（前 → 后）", v: fmt(pBefore, 4) + " → " + fmt(pAfter, 4) + " kg·m/s" },
          { k: "动能（前 → 后）", v: fmt(kBefore, 4) + " → " + fmt(kAfter, 4) + " J" },
          { k: "损失的动能", v: fmt(kBefore - kAfter, 4) + " J" }
        ],
        bars: [
          { label: "碰撞前动能", value: kBefore, color: "#5aa9ff", unit: "J" },
          { label: "碰撞后动能", value: kAfter, color: "#63d6a5", unit: "J" },
          { label: "动量（前）", value: pBefore, color: "#ffb84d", unit: "kg·m/s" },
          { label: "动量（后）", value: pAfter, color: "#c792ea", unit: "kg·m/s" }
        ],
        metrics: { u1: u1, u2: u2, pBefore: pBefore, pAfter: pAfter, kBefore: kBefore, kAfter: kAfter }
      };
    },
    tests: [
      { name: "动量守恒：p_after − p_before = 0", measure: function (o) { return o.metrics.pAfter - o.metrics.pBefore; }, expect: 0, tol: 1e-12 },
      { name: "弹性碰撞（e=1）动能守恒", measure: function (o) { return o.metrics.kAfter - o.metrics.kBefore; }, expect: 0, tol: 1e-12 },
      { name: "等质量弹性正碰：碰后交换速度（v₁′=0, v₂′=2）", measure: function (o) { return o.metrics.u1; }, expect: 0, tol: 1e-12 },
      { name: "完全非弹性（e=0）：两球末速度相等", params: { e: 0 }, measure: function (o) { return o.metrics.u1 - o.metrics.u2; }, expect: 0, tol: 1e-12 }
    ]
  });

  /* =============================================== 4. 刚体定轴转动 / 滚下斜面 */
  SIM.register("rigid", {
    title: "刚体滚下斜面：转动惯量的作用",
    legend: "同样质量与半径，质量越往外分（环 > 空心球 > 实心球 > 圆盘），滚得越慢。",
    axes: { xlabel: "t (s)", ylabel: "速度 v (m/s)" },
    params: {
      theta: { label: "斜面倾角 θ", unit: "度", def: 30, min: 5, max: 80, step: 1 },
      beta: { label: "惯量系数 β = I/(mR²)", unit: "", def: 0.5, min: 0.2, max: 1.2, step: 0.01 },
      g: { label: "重力加速度 g", unit: "m/s²", def: 9.8, min: 1, max: 20, step: 0.1 },
      T: { label: "观察时长", unit: "s", def: 3, min: 0.5, max: 10, step: 0.5 }
    },
    plots: [
      { key: "v", label: "速度 v (m/s)", color: "#5aa9ff" },
      { key: "beta06", label: "对照：β=0.6", color: "#ffb84d", dash: "5 4" }
    ],
    compute: function (p) {
      function acc(b) { return p.g * Math.sin(p.theta * DEG) / (1 + b); }
      var n = 300, t = lin(0, p.T, n);
      var v = [], vRef = [];
      for (var i = 0; i < n; i++) { v.push(acc(p.beta) * t[i]); vRef.push(acc(0.6) * t[i]); }
      var a = acc(p.beta);
      return {
        t: t, series: { v: v, beta06: vRef },
        info: [
          { k: "平动加速度 a", v: fmt(a, 4) + " m/s²" },
          { k: "无摩擦滑动的加速度", v: fmt(p.g * Math.sin(p.theta * DEG), 4) + " m/s²" },
          { k: "静摩擦系数下限 tanθ/(1+1/β)", v: fmt(Math.tan(p.theta * DEG) / (1 + 1 / p.beta), 4) },
          { k: "到达底部（1 m）用时", v: fmt(Math.sqrt(2 / a), 4) + " s" }
        ]
      };
    },
    tests: [
      { name: "圆盘（β=0.5, θ=30°）加速度 = g sinθ/1.5 = 3.266667 m/s²", measure: function (o) { return o.series.v[1] / o.t[1]; }, expect: 9.8 * 0.5 / 1.5, tol: 1e-12 },
      { name: "β 越大加速度越小（单调性）", params: { beta: 1.2 },
        measure: function (o) { return o.series.v[o.series.v.length - 1] < (9.8 * 0.5 / 1.5) * o.t[o.t.length - 1] ? 1 : 0; }, expect: 1, tol: 0 },
      { name: "与对照曲线 β=0.6 的比值 = (1.5/1.6) = 0.9375", measure: function (o) {
        var v1 = o.series.v[10], v2 = o.series.beta06[10];
        return v2 / v1;
      }, expect: 0.9375, tol: 1e-12 }
    ]
  });

  /* ========================================================== 5. 简谐振动 */
  SIM.register("shm", {
    title: "简谐振动：位移、速度与能量",
    legend: "弹簧振子 x″ = −(k/m)x。看能量条：动能与势能此消彼长，总量始终不变。",
    axes: { xlabel: "t (s)", ylabel: "x (m) / v (m/s)" },
    params: {
      k: { label: "劲度系数 k", unit: "N/m", def: 4, min: 0.5, max: 20, step: 0.5 },
      m: { label: "质量 m", unit: "kg", def: 1, min: 0.2, max: 5, step: 0.1 },
      x0: { label: "初位移 x₀", unit: "m", def: 1, min: -2, max: 2, step: 0.05 },
      v0: { label: "初速度 v₀", unit: "m/s", def: 0, min: -3, max: 3, step: 0.05 }
    },
    plots: [
      { key: "x", label: "位移 x (m)", color: "#5aa9ff" },
      { key: "v", label: "速度 v (m/s)", color: "#ffb84d" }
    ],
    compute: function (p) {
      var w = Math.sqrt(p.k / p.m);
      var T = (2 * Math.PI) / w;
      var A = Math.sqrt(p.x0 * p.x0 + (p.v0 / w) * (p.v0 / w));
      var n = 600, t = lin(0, 2 * T, n);
      var x = [], v = [], ke = [], pe = [], et = [], phaseV = [];
      var w2 = w * w;
      for (var i = 0; i < n; i++) {
        var ti = t[i];
        var xi = p.x0 * Math.cos(w * ti) + (p.v0 / w) * Math.sin(w * ti);
        var vi = -p.x0 * w * Math.sin(w * ti) + p.v0 * Math.cos(w * ti);
        x.push(xi); v.push(vi); phaseV.push(vi);
        var e1 = 0.5 * p.m * vi * vi, e2 = 0.5 * p.k * xi * xi;
        ke.push(e1); pe.push(e2); et.push(e1 + e2);
      }
      var e0 = 0.5 * p.k * A * A;
      return {
        t: t, series: { x: x, v: v },
        info: [
          { k: "角频率 ω", v: fmt(w, 4) + " rad/s" },
          { k: "周期 T", v: fmt(T, 4) + " s" },
          { k: "振幅 A", v: fmt(A, 4) + " m" },
          { k: "总能量 E", v: fmt(e0, 4) + " J" }
        ],
        bars: [
          { label: "动能 Ek（当前 t=0）", value: 0.5 * p.m * p.v0 * p.v0, color: "#ffb84d", unit: "J" },
          { label: "势能 Ep（当前 t=0）", value: 0.5 * p.k * p.x0 * p.x0, color: "#5aa9ff", unit: "J" },
          { label: "总能量 E", value: e0, color: "#63d6a5", unit: "J" }
        ],
        extra: {
          x: x, y: v, xlabel: "x (m)", ylabel: "v (m/s)", title: "相图（轨迹是椭圆，面积与能量成正比）"
        },
        metrics: { energy: et, w: w, T: T, A: A, ke: ke, pe: pe }
      };
    },
    tests: [
      { name: "振幅 A = √(x₀² + v₀²/ω²)", measure: function (o) { return maxAbs(o.series.x); }, expect: 1, tol: 1e-6 },
      { name: "周期 T = 2π√(m/k)（换 k=9, m=4 → T=4π/3）", params: { k: 9, m: 4 },
        measure: function (o) {
          var cr = crossings(o.t, o.series.x, -1);
          return cr.length >= 2 ? cr[1] - cr[0] : NaN;
        }, expect: 4.188790, tol: 2e-4 },
      { name: "机械能守恒（相对漂移 < 1e-9）", params: { x0: 1, v0: 1.5 },
        measure: function (o) { return relDrift(o.metrics.energy); }, expect: 0, tol: 1e-9 },
      { name: "相图是闭合椭圆：max|v| = Aω", measure: function (o) { return maxAbs(o.series.v) / o.metrics.A; }, expect: 2, tol: 1e-2 }
    ]
  });

  /* ==================================================== 6. 阻尼与受迫振动 */
  SIM.register("damped-driven", {
    title: "阻尼受迫振动与共振曲线",
    legend: "下图是稳态振幅随驱动频率的变化；阻尼越小峰越尖，峰位略低于固有频率 ω₀。",
    axes: { xlabel: "t (s)", ylabel: "x (m)" },
    params: {
      m: { label: "质量 m", unit: "kg", def: 1, min: 0.2, max: 5, step: 0.1 },
      k: { label: "劲度系数 k", unit: "N/m", def: 4, min: 0.5, max: 20, step: 0.5 },
      b: { label: "阻尼系数 b", unit: "kg/s", def: 0.4, min: 0.05, max: 3, step: 0.05 },
      F0: { label: "驱动力幅值 F₀", unit: "N", def: 1, min: 0.1, max: 5, step: 0.1 },
      wd: { label: "驱动角频率 ω_d", unit: "rad/s", def: 2, min: 0.1, max: 6, step: 0.05 }
    },
    plots: [
      { key: "x", label: "位移 x(t)", color: "#5aa9ff" },
      { key: "steady", label: "稳态解", color: "#ffb84d", dash: "5 4" }
    ],
    compute: function (p) {
      var w0 = Math.sqrt(p.k / p.m), beta = p.b / (2 * p.m);
      function amp(w) {
        var d = (w0 * w0 - w * w), e = (p.b * w) / p.m;
        return ((p.F0 / p.m) / Math.sqrt(d * d + e * e));
      }
      function phase(w) {
        var d = (w0 * w0 - w * w), e = (p.b * w) / p.m;
        return Math.atan2(-e, d);
      }
      var T = 20 / Math.max(beta, 0.05) > 120 ? 120 : 20 / Math.max(beta, 0.05);
      var n = 3000, t = lin(0, T, n);
      var y = [0, 0];
      var f = function (tt, yy) { return [yy[1], (-p.k * yy[0] - p.b * yy[1] + p.F0 * Math.cos(p.wd * tt)) / p.m]; };
      var sol = rk4(f, y, 0, T, n);
      var ph = phase(p.wd), A = amp(p.wd);
      var steady = [];
      for (var i = 0; i < n; i++) steady.push(A * Math.cos(p.wd * sol.t[i] + ph));
      // 共振曲线
      var wScan = lin(0.05, 6, 1200), curve = [], best = { w: 0, A: -1 };
      for (var j = 0; j < wScan.length; j++) {
        var a = amp(wScan[j]);
        curve.push(a);
        if (a > best.A) best = { w: wScan[j], A: a };
      }
      return {
        t: sol.t, series: { x: sol.y[0], steady: steady },
        info: [
          { k: "固有频率 ω₀", v: fmt(w0, 4) + " rad/s" },
          { k: "阻尼度 β = b/2m", v: fmt(beta, 4) + " 1/s" },
          { k: "稳态振幅 A(ω_d)", v: fmt(A, 4) + " m" },
          { k: "振幅共振频率 √(ω₀²−2β²)", v: fmt(Math.sqrt(Math.max(w0 * w0 - 2 * beta * beta, 0)), 4) + " rad/s" },
          { k: "静态位移 F₀/k", v: fmt(p.F0 / p.k, 4) + " m" }
        ],
        extra: {
          x: wScan, y: curve, xlabel: "驱动频率 ω_d (rad/s)", ylabel: "稳态振幅 A (m)",
          title: "共振曲线（峰值 = " + fmt(best.A, 4) + " m @ " + fmt(best.w, 3) + " rad/s）"
        },
        metrics: { amp: amp, w0: w0, beta: beta }
      };
    },
    tests: [
      { name: "静态极限：ω_d→0 时 A → F₀/k = 0.25 m", measure: function (o) { return o.metrics.amp(1e-6); }, expect: 0.25, tol: 1e-6 },
      { name: "共振频率 = √(ω₀²−2β²) = √3.92 rad/s", measure: function (o) {
        var best = 0, bw = 0;
        for (var w = 0.05; w <= 6; w += 0.001) { var a = o.metrics.amp(w); if (a > best) { best = a; bw = w; } }
        return bw;
      }, expect: 1.979899, tol: 3e-3 },
      { name: "低阻尼（b=0.05）峰值更高（共振放大）", params: { b: 0.05 },
        measure: function (o) { return o.metrics.amp(o.metrics.w0) > 4 ? 1 : 0; }, expect: 1, tol: 0 }
    ]
  });

  /* ============================================================ 7. 单摆 */
  SIM.register("pendulum", {
    title: "单摆：大角度偏离小角近似",
    legend: "红线是精确解（θ″ = −(g/L)sinθ），蓝虚线是小角近似（简谐）。摆角越大，精确周期越长。",
    axes: { xlabel: "t (s)", ylabel: "θ (rad)" },
    params: {
      L: { label: "摆长 L", unit: "m", def: 1, min: 0.2, max: 3, step: 0.1 },
      theta0: { label: "初始摆角 θ₀", unit: "度", def: 30, min: 1, max: 170, step: 1 },
      g: { label: "重力加速度 g", unit: "m/s²", def: 9.8, min: 1, max: 20, step: 0.1 }
    },
    plots: [
      { key: "exact", label: "精确解 θ(t)", color: "#ff7b7b" },
      { key: "small", label: "小角近似", color: "#5aa9ff", dash: "5 4" }
    ],
    compute: function (p) {
      var th0 = p.theta0 * DEG, w0 = Math.sqrt(p.g / p.L), T0 = (2 * Math.PI) / w0;
      var Tspan = 3.2 * T0, n = 4000;
      var f = function (t, y) { return [y[1], -(p.g / p.L) * Math.sin(y[0])]; };
      var sol = rk4(f, [th0, 0], 0, Tspan, n);
      var small = [], en = [];
      for (var i = 0; i < n; i++) {
        small.push(th0 * Math.cos(w0 * sol.t[i]));
        var th = sol.y[0][i], om = sol.y[1][i];
        en.push(0.5 * p.L * p.L * om * om + p.g * p.L * (1 - Math.cos(th)));
      }
      // 精确周期：同方向过零的间隔就是一个周期
      var cr = crossings(sol.t, sol.y[0], -1);
      var Tnum = cr.length >= 2 ? (cr[1] - cr[0]) : NaN;
      var series = { exact: sol.y[0], small: small };
      return {
        t: sol.t, series: series,
        info: [
          { k: "小角周期 T₀ = 2π√(L/g)", v: fmt(T0, 4) + " s" },
          { k: "精确周期（数值）", v: fmt(Tnum, 4) + " s" },
          { k: "周期比 T/T₀", v: fmt(Tnum / T0, 5) },
          { k: "小角近似理论比 1 + θ₀²/16", v: fmt(1 + th0 * th0 / 16, 6) },
          { k: "最大摆角", v: fmt(p.theta0, 1) + "°" }
        ],
        metrics: { Tnum: Tnum, T0: T0, energy: en, th0: th0 }
      };
    },
    tests: [
      { name: "机械能守恒（相对漂移 < 1e-8）", measure: function (o) { return relDrift(o.metrics.energy); }, expect: 0, tol: 1e-8 },
      { name: "θ₀=90° 时周期比 T/T₀ = 1.180340（椭圆积分 4K/2π）", params: { theta0: 90 },
        measure: function (o) { return o.metrics.Tnum / o.metrics.T0; }, expect: 1.180340, tol: 2e-3 },
      { name: "θ₀=1° 时周期比 → 1（小角极限）", params: { theta0: 1 },
        measure: function (o) { return o.metrics.Tnum / o.metrics.T0; }, expect: 1.000020, tol: 1e-4 },
      { name: "大角度周期更长（θ₀=150° > θ₀=30°）", params: { theta0: 150 },
        measure: function (o) { return o.metrics.Tnum / o.metrics.T0 > 1.2 ? 1 : 0; }, expect: 1, tol: 0 }
    ]
  });

  /* ======================================================= 8. 耦合振子 */
  SIM.register("coupled", {
    title: "两个耦合振子：拍与简正模",
    legend: "初位移相同 → 同相简正模（频率 ω₁）；一正一负 → 反相简正模（频率 ω₂ > ω₁）。",
    axes: { xlabel: "t (s)", ylabel: "位移 (m)" },
    params: {
      m: { label: "质量 m", unit: "kg", def: 1, min: 0.2, max: 5, step: 0.1 },
      k: { label: "弹簧 k（各自）", unit: "N/m", def: 1, min: 0.1, max: 10, step: 0.1 },
      kc: { label: "耦合弹簧 k_c", unit: "N/m", def: 0.2, min: 0, max: 5, step: 0.05 },
      x1: { label: "初始 x₁", unit: "m", def: 1, min: -2, max: 2, step: 0.05 },
      x2: { label: "初始 x₂", unit: "m", def: 0, min: -2, max: 2, step: 0.05 }
    },
    plots: [
      { key: "a", label: "振子 1 位移", color: "#5aa9ff" },
      { key: "b", label: "振子 2 位移", color: "#ffb84d" }
    ],
    compute: function (p) {
      var w1 = Math.sqrt(p.k / p.m);
      var w2 = Math.sqrt((p.k + 2 * p.kc) / p.m);
      var Tspan = 4 * (2 * Math.PI) / w1, n = 3000;
      var f = function (t, y) {
        return [
          y[2], y[3],
          -(p.k / p.m) * y[0] - (p.kc / p.m) * (y[0] - y[1]),
          -(p.k / p.m) * y[1] - (p.kc / p.m) * (y[1] - y[0])
        ];
      };
      var sol = rk4(f, [p.x1, p.x2, 0, 0], 0, Tspan, n);
      var en = [];
      for (var i = 0; i < n; i++) {
        var a = sol.y[0][i], b = sol.y[1][i], va = sol.y[2][i], vb = sol.y[3][i];
        en.push(0.5 * p.m * (va * va + vb * vb) + 0.5 * p.k * (a * a + b * b) + 0.5 * p.kc * (a - b) * (a - b));
      }
      var diff = [];
      for (var j = 0; j < n; j++) diff.push(sol.y[0][j] - sol.y[1][j]);
      return {
        t: sol.t, series: { a: sol.y[0], b: sol.y[1] },
        info: [
          { k: "同相模频率 ω₁ = √(k/m)", v: fmt(w1, 4) + " rad/s" },
          { k: "反相模频率 ω₂ = √((k+2k_c)/m)", v: fmt(w2, 4) + " rad/s" },
          { k: "拍频 |ω₂−ω₁|/2π", v: fmt(Math.abs(w2 - w1) / (2 * Math.PI), 4) + " Hz" },
          { k: "两振子最大差异", v: fmt(maxAbs(diff), 5) + " m" }
        ],
        metrics: { energy: en, diff: diff, w1: w1, w2: w2 }
      };
    },
    tests: [
      { name: "能量守恒（相对漂移 < 1e-7）", params: { x1: 1, x2: 0 },
        measure: function (o) { return relDrift(o.metrics.energy); }, expect: 0, tol: 1e-7 },
      { name: "同相初始条件 x₁=x₂ → 始终保持同步（max|x₁−x₂| < 1e-9）", params: { x1: 1, x2: 1 },
        measure: function (o) { return maxAbs(o.metrics.diff); }, expect: 0, tol: 1e-9 },
      { name: "反相模频率 ω₂ = √(1.4)（k=1, kc=0.2）", measure: function (o) { return o.metrics.w2; }, expect: 1.183216, tol: 1e-6 },
      { name: "k_c=0 时两振子互不影响（各自独立振荡）", params: { kc: 0, x1: 1, x2: 0 },
        measure: function (o) { return maxAbs(o.series.b); }, expect: 0, tol: 1e-12 }
    ]
  });

  /* ============================================== 9. 弦上的驻波与简正模 */
  SIM.register("wave1d", {
    title: "弦上的驻波（简正模）",
    legend: "两端固定：只有波长为 2L/n 的模式能存在。第 n 个模式有 n 个半波、n−1 个节点。",
    axes: { xlabel: "位置 x (m)", ylabel: "横向位移 y (m)" },
    params: {
      L: { label: "弦长 L", unit: "m", def: 1, min: 0.2, max: 3, step: 0.1 },
      v: { label: "波速 v", unit: "m/s", def: 2, min: 0.5, max: 10, step: 0.1 },
      n: { label: "模式序号 n", unit: "", def: 1, min: 1, max: 5, step: 1 },
      A: { label: "振幅 A", unit: "m", def: 0.05, min: 0.005, max: 0.2, step: 0.005 },
      t: { label: "时刻 t", unit: "s", def: 0, min: 0, max: 2, step: 0.01 }
    },
    plots: [
      { key: "n1", label: "n=1", color: "#5aa9ff" },
      { key: "n2", label: "n=2", color: "#ffb84d" },
      { key: "cur", label: "当前 n", color: "#63d6a5" }
    ],
    compute: function (p) {
      // N 取奇数，保证 x=L/2 正好落在网格点上（节点检验才有意义）
      var N = 241, x = lin(0, p.L, N);
      function shape(nn, tt) {
        var out = [], kn = nn * Math.PI / p.L, wn = kn * p.v;
        for (var i = 0; i < N; i++) out.push(p.A * Math.sin(kn * x[i]) * Math.cos(wn * tt));
        return out;
      }
      var wn = (p.n * Math.PI / p.L) * p.v;
      // 时间追踪：固定点 x = L/2
      var Tn = (2 * Math.PI) / wn;
      var ts = lin(0, 2 * Tn, 400), trace = [];
      for (var j = 0; j < ts.length; j++) {
        trace.push(p.A * Math.sin((p.n * Math.PI / p.L) * (p.L / 2)) * Math.cos(wn * ts[j]));
      }
      return {
        t: x, series: { n1: shape(1, p.t), n2: shape(2, p.t), cur: shape(p.n, p.t) },
        info: [
          { k: "波数 k_n", v: fmt(p.n * Math.PI / p.L, 4) + " rad/m" },
          { k: "角频率 ω_n = nπv/L", v: fmt(wn, 4) + " rad/s" },
          { k: "频率 f_n", v: fmt(wn / (2 * Math.PI), 4) + " Hz" },
          { k: "波长 λ_n = 2L/n", v: fmt(2 * p.L / p.n, 4) + " m" },
          { k: "节点数（不含端点）", v: String(p.n - 1) }
        ],
        extra: { x: ts, y: trace, xlabel: "t (s)", ylabel: "x=L/2 处的位移", title: "中点的时间追踪：周期 T_n = 2L/(nv)" },
        metrics: { wn: wn, Tn: Tn, L: p.L, n: p.n, v: p.v, N: N, x: x, A: p.A }
      };
    },
    tests: [
      { name: "两端固定：y(0)=y(L)=0", measure: function (o) { return maxAbs([o.series.cur[0], o.series.cur[o.series.cur.length - 1]]); }, expect: 0, tol: 1e-12 },
      { name: "第 n=2 模在 x=L/2 处有节点（位移恒为 0）", params: { n: 2, t: 0.3 },
        measure: function (o) {
          var iMid = Math.round((o.metrics.N - 1) / 2);
          return o.series.cur[iMid];
        }, expect: 0, tol: 1e-12 },
      { name: "频率关系 ω_n = nπv/L（n=3, L=1, v=2 → 6π）", params: { n: 3 },
        measure: function (o) { return o.metrics.wn; }, expect: 18.849556, tol: 1e-6 },
      { name: "周期 T_n = 2L/(nv)（n=3 时为 1/3 s）", params: { n: 3 },
        measure: function (o) { return o.metrics.Tn; }, expect: 0.333333, tol: 1e-6 }
    ]
  });

  /* ======================================================== 10. 中心力轨道 */
  SIM.register("kepler", {
    title: "万有引力轨道（开普勒问题）",
    legend: "r₀=1、v₀=1 是圆轨道；把 v₀ 调小到 0.8 就得到椭圆，近地点处跑得快（开普勒第二定律）。",
    axes: { xlabel: "t", ylabel: "r" },
    params: {
      GM: { label: "GM", unit: "", def: 1, min: 0.2, max: 4, step: 0.1 },
      r0: { label: "初始距离 r₀", unit: "", def: 1, min: 0.4, max: 3, step: 0.05 },
      v0: { label: "初始横向速度 v₀", unit: "", def: 0.8, min: 0.3, max: 2, step: 0.02 }
    },
    plots: [
      { key: "r", label: "距离 r(t)", color: "#5aa9ff" }
    ],
    compute: function (p) {
      var E = 0.5 * p.v0 * p.v0 - p.GM / p.r0;
      var a = E < 0 ? -p.GM / (2 * E) : Infinity;
      /* 偏心率 e = √(1 + 2EL²/(GM)²)，本初值下 L = r₀v₀（起点在 x = r₀、速度纯横向） */
      var ecc = Math.sqrt(Math.max(0, 1 + 2 * E * p.v0 * p.v0 * p.r0 * p.r0 / (p.GM * p.GM)));
      var T = isFinite(a) ? 2 * Math.PI * Math.sqrt(a * a * a / p.GM) : 10;
      var Tspan = isFinite(T) ? 2 * T : 12;
      var n = 6000;
      var f = function (t, y) {
        var r2 = y[0] * y[0] + y[1] * y[1];
        var r3 = Math.pow(r2, 1.5);
        return [y[2], y[3], -p.GM * y[0] / r3, -p.GM * y[1] / r3];
      };
      var sol = rk4(f, [p.r0, 0, 0, p.v0], 0, Tspan, n);
      var r = [], L = [], en = [];
      for (var i = 0; i < n; i++) {
        var X = sol.y[0][i], Y = sol.y[1][i], VX = sol.y[2][i], VY = sol.y[3][i];
        var rr = Math.sqrt(X * X + Y * Y);
        r.push(rr);
        L.push(X * VY - Y * VX);
        en.push(0.5 * (VX * VX + VY * VY) - p.GM / rr);
      }
      var mins = extrema(sol.t, r, "min");
      /* 周期（数值）= 相邻两个近地点的间距。**圆轨道（e = 0）时 r 恒定**，
         这些"极小点"全由浮点噪声产生（默认 v₀ = 1 时实测间距 0.00628 而不是 2π），
         用伪极值定期只能得到垃圾值 ⇒ e < 1e-6 时直接给解析周期 2π√(a³/GM)。
         e 不小的时候保持原逻辑（近地点间距是可靠且与第三定律独立的一条路径）。 */
      var Tnum;
      if (ecc < 1e-6) Tnum = isFinite(a) ? 2 * Math.PI * Math.sqrt(a * a * a / p.GM) : NaN;
      else Tnum = mins.length >= 2 ? mins[1].x - mins[0].x : NaN;
      var peri = mins.length ? mins[0].y : NaN;
      return {
        t: sol.t, series: { r: r },
        info: [
          { k: "比能 E", v: fmt(E, 5) },
          { k: "半长轴 a = −GM/2E", v: isFinite(a) ? fmt(a, 5) : "双曲线（不闭合）" },
          { k: "偏心率 e = √(1+2EL²/(GM)²)", v: fmt(ecc, 5) },
          { k: "周期（数值）", v: fmt(Tnum, 5) +
            (ecc < 1e-6 ? "（圆轨道：r 恒定，r(t) 上没有可测的极值 ⇒ 取解析值 2π√(a³/GM)）" : "") },
          { k: "周期（开普勒第三定律）", v: isFinite(a) ? fmt(2 * Math.PI * Math.sqrt(a * a * a / p.GM), 5) : "—" },
          { k: "近地点 r_peri", v: fmt(peri, 5) }
        ],
        extra: { x: sol.y[0], y: sol.y[1], xlabel: "x", ylabel: "y", title: "轨道形状（椭圆时原点在焦点上）" },
        metrics: { r: r, L: L, energy: en, Tnum: Tnum, T: T, a: a, t: sol.t, ecc: ecc, mins: mins.length }
      };
    },
    tests: [
      { name: "角动量守恒：相对漂移 < 1e-9", measure: function (o) { return relDrift(o.metrics.L); }, expect: 0, tol: 1e-9 },
      { name: "机械能守恒：相对漂移 < 1e-7", measure: function (o) { return relDrift(o.metrics.energy); }, expect: 0, tol: 1e-7 },
      { name: "开普勒第三定律：数值周期 = 2π√(a³/GM)", measure: function (o) { return o.metrics.Tnum; }, expect: 3.961510, tol: 3e-3 },
      /* 圆轨道（v₀ = √(GM/r₀) = 1 ⇒ e = 0、a = r₀ = 1）：r(t) 恒定，
         数值极值检测只会找到浮点噪声（改前读数 0.00628），必须回落到解析周期 2π√(a³/GM)。
         2π = 6.283185307179586，容差 1e-6。 */
      { name: "圆轨道（v₀=1、GM=1、r₀=1、e=0）：周期（数值）= 2π√(a³/GM) = 2π = 6.283185（±1e-6）",
        params: { v0: 1 },
        measure: function (o) { return o.metrics.Tnum; }, expect: 6.283185307179586, tol: 1e-6 },
      { name: "圆轨道（v₀=1）半径保持不变", params: { v0: 1 },
        measure: function (o) { return relDrift(o.metrics.r); }, expect: 0, tol: 1e-6 },
      { name: "近地点距离 = a(1−e) = 0.470588", measure: function (o) {
        var mn = Infinity;
        for (var i = 0; i < o.metrics.r.length; i++) mn = Math.min(mn, o.metrics.r[i]);
        return mn;
      }, expect: 0.470588, tol: 5e-3 }
    ]
  });

})(typeof window !== "undefined" ? window : globalThis);
