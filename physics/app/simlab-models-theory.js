/* ==========================================================================
   simlab-models-theory.js —— 理论力学 / 变分原理 / 相空间 / 刚体 / 小振动 / 混沌

   加载时不触碰 DOM（见 simlab.js 顶部约束），因此 tools/verify-simlab.mjs
   能在 Node 里直接跑 compute() 与 tests 做物理不变量自检。

   五个模型（契约见 PHYSICS-CONTENT-SPEC.md §11.2）：
     1. least-action    变分原理：一族路径的作用量对比，S 在真实路径取极值
     2. phase-flow      相空间流：相轨线族 + 一小块相体积的演化（刘维尔定理）
     3. euler-top       自由刚体欧拉方程：网球拍定理（中间主轴不稳定）
     4. normal-modes-n  N 自由度小振动：闭式本征频率、模态形状、正交性、节点数
     5. lorenz          洛伦兹系统：相邻轨道的指数分离（初值敏感性）

   约定：全部使用解析式 / RK4 数值解，**不使用 Math.random**（确定性）；
        每个模型都带 tests，measure 从 series / metrics 现算，
        expect 一律是独立推得的解析值（公式写在注释里）。
   ========================================================================== */
(function (global) {
  "use strict";
  var SIM = global.SIM;
  if (!SIM) return;   // 在 Node 里若未先加载 simlab.js，安静退出

  var rk4 = SIM.rk4, lin = SIM.linspace, fmt = SIM.fmt, opt = SIM.opt;

  /* --------------------------------------------------------------- 小工具 */
  /** 把数值参数夹到 [a,b]（滑杆越界 / 课程配置越界都不抛异常） */
  function clampNum(v, a, b) {
    var x = Number(v);
    if (!isFinite(x)) x = a;
    return x < a ? a : (x > b ? b : x);
  }
  function clampIdx(v, n) {
    var i = Math.round(Number(v));
    if (!isFinite(i)) i = 0;
    return i < 0 ? 0 : (i > n - 1 ? n - 1 : i);
  }
  function maxAbs(vals) {
    var m = 0, i;
    for (i = 0; i < vals.length; i++) if (isFinite(vals[i]) && Math.abs(vals[i]) > m) m = Math.abs(vals[i]);
    return m;
  }
  /** 相对漂移：(max − min) / 平均绝对值 —— 用于守恒量自检 */
  function relDrift(vals) {
    var mn = Infinity, mx = -Infinity, sum = 0, n = 0, i;
    for (i = 0; i < vals.length; i++) {
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
  /** 复化辛普森积分（ts 等距递增、点数为奇数时最准） */
  function simpson(ts, ys) {
    var n = ts.length - 1, i, s;
    if (n < 2) return 0;
    if (n % 2 === 1) n -= 1;                       // 保证偶数个区间
    var h = (ts[n] - ts[0]) / n;
    s = ys[0] + ys[n];
    for (i = 1; i < n; i++) s += ys[i] * (i % 2 ? 4 : 2);
    return s * h / 3;
  }

  /* 格林公式算闭合曲线**所围面积**：A = |½∮(x dy − y dx)|（取绝对值，
     与参数化方向无关）。采样点等距分布在 θ∈[0,2π) 上，用 8 阶中心差分求
     x'(θ)、y'(θ)：误差 O(h⁸)（M=128 时相对误差 ~1e-13），比多边形公式
     （O(h²)，M=256 时约 1e-4）高 9 个数量级——§11.2 要求面积容差 1e-6，
     必须用这一档精度。 */
  var D8 = [1 / 280, -4 / 105, 1 / 5, -4 / 5, 0, 4 / 5, -1 / 5, 4 / 105, -1 / 280];
  function areaGreen(xs, ys) {
    var M = Math.min(xs.length, ys.length);
    if (M < 16) return NaN;
    var h = 2 * Math.PI / M, s = 0, i, m, s1, s2, idx;
    for (i = 0; i < M; i++) {
      s1 = 0; s2 = 0;
      for (m = -4; m <= 4; m++) {
        idx = ((i + m) % M + M) % M;
        s1 += D8[m + 4] * xs[idx];
        s2 += D8[m + 4] * ys[idx];
      }
      s += (xs[i] * (s2 / h) - ys[i] * (s1 / h)) * h;
    }
    return Math.abs(0.5 * s);
  }

  /** 等距采样下由 q(t−h)、q(t)、q(t+h) 反解角频率：
      q(t+h) + q(t−h) = 2cos(ωh)·q(t)  →  ω = arccos(…) / h（对纯正弦是恒等式，无插值误差） */
  function omegaThreePoint(ts, ys) {
    var n = ys.length;
    if (n < 7) return NaN;
    var h = ts[1] - ts[0];
    if (!(h > 0)) return NaN;
    var A = maxAbs(ys);
    if (!(A > 0)) return NaN;
    var vals = [], i, c;
    for (i = 1; i < n - 1; i++) {
      if (Math.abs(ys[i]) < 0.4 * A) continue;
      c = (ys[i + 1] + ys[i - 1]) / (2 * ys[i]);
      if (c > 1) c = 1; else if (c < -1) c = -1;
      vals.push(Math.acos(c) / h);
    }
    if (!vals.length) return NaN;
    vals.sort(function (a, b) { return a - b; });
    return vals[Math.floor(vals.length / 2)];      // 中位数，抗个别坏点
  }

  /** 符号变化次数 = 模态的节点数（|u|<1e-12 视为节点，不计符号） */
  function countNodes(v) {
    var c = 0, last = 0, i, s;
    for (i = 0; i < v.length; i++) {
      s = v[i] > 1e-12 ? 1 : (v[i] < -1e-12 ? -1 : 0);
      if (s === 0) continue;
      if (last !== 0 && s !== last) c++;
      last = s;
    }
    return c;
  }

  /* ==========================================================================
     1. least-action —— 变分原理：作用量在真实路径上取极值
     --------------------------------------------------------------------------
     归一化单位 m = 1、g = 1、k = 1（⇒ ω = √(k/m) = 1）。作用量 S = ∫L dt，
     一族满足同样端点的路径 x(t) = x_true(t) + α·sin(πt/T)（扰动在两端为零）：

       · 自由粒子  L = ½mẋ²              真实路径 x = x₀t/T（x(0)=0, x(T)=x₀）
                   S = ∫₀ᵀ ½m(x₀/T)² dt = m x₀²/(2T)                    ← 解析期望值
       · 匀加速    L = ½mẋ² + mgx        真实路径 x = ½gt²（静止释放，ẍ = g）
                   S = ∫₀ᵀ(½mg²t² + ½mg²t²)dt = m g²T³/3                ← 解析期望值
                   ★ 势能项不能省：只积动能会得到 mg²T³/6，但那样 x = ½gt² 就
                     不再是 S 的驻值路径（S(+α) ≠ S(−α)），变分原理当场失效。
                     计入 +mgx 后线性项精确抵消，S(α) = S(0) + α²·mπ²/(4T)，对称。
       · 谐振子    L = ½mẋ² − ½kx²       真实路径（x(0)=0, x(T)=x₀）
                   x = x₀ sin(ωt)/sin(ωT)，S = ½mω x₀² cot(ωT)          ← 解析期望值
                   （两点边界条件的经典作用量公式
                     S = mω[(x_i²+x_f²)cosωT − 2x_i x_f]/(2 sinωT)，x_i = 0）

     扰动展开：把 x_true + α·sin(πt/T) 代入，一次项因 x_true 满足欧拉–拉格朗日
     方程而严格为零，故 S(α) = S(0) + α²·C，真实路径是极值点（自由粒子、T<π/ω
     的谐振子处 C>0，即极小）。
     ========================================================================== */
  var LA_KINDS = ["自由粒子", "匀加速", "谐振子"];
  var LA_M = 1, LA_G = 1, LA_K = 1, LA_W = 1;   // 归一化：m = g = k = 1 ⇒ ω = 1

  /** 真实路径（满足 E–L 方程的那一条），t ∈ [0,T] */
  function laTruePath(kindName, x0, T, t) {
    if (kindName === "匀加速") return 0.5 * LA_G * t * t;
    if (kindName === "谐振子") {
      var s = Math.sin(LA_W * T);
      if (Math.abs(s) < 0.05) return x0 * t / T;        // 退化保护（T ≈ π/ω 时端点条件不可解）
      return x0 * Math.sin(LA_W * t) / s;
    }
    return x0 * t / T;
  }
  /** 真实路径的速度（解析） */
  function laTrueVel(kindName, x0, T, t) {
    if (kindName === "匀加速") return LA_G * t;
    if (kindName === "谐振子") {
      var s = Math.sin(LA_W * T);
      if (Math.abs(s) < 0.05) return x0 / T;
      return x0 * LA_W * Math.cos(LA_W * t) / s;
    }
    return x0 / T;
  }
  /** 拉格朗日量 L = T − V。三种情形的势能都必须计入，否则真实路径不是 S 的驻值点 */
  function laLagrangian(kindName, x, v) {
    var L = 0.5 * LA_M * v * v;
    // 匀加速：V = −mgx（取 x 向下为正），故 L = ½mẋ² + mgx
    if (kindName === "匀加速") L += LA_M * LA_G * x;
    // 谐振子：V = ½kx²
    if (kindName === "谐振子") L -= 0.5 * LA_K * x * x;
    return L;
  }
  /** 数值作用量 S(α)（辛普森积分，2001 个等距点 ⇒ 误差 ~1e-13） */
  function laAction(kindName, x0, T, alpha) {
    var n = 2001, i, ts = [], ys = [], t, x, v;
    var om = T > 0 ? Math.PI / T : 0;
    for (i = 0; i < n; i++) {
      t = T * i / (n - 1);
      x = laTruePath(kindName, x0, T, t) + alpha * Math.sin(om * t);
      v = laTrueVel(kindName, x0, T, t) + alpha * om * Math.cos(om * t);
      ts.push(t);
      ys.push(laLagrangian(kindName, x, v));
    }
    return simpson(ts, ys);
  }
  /** 真实路径作用量的解析值 */
  function laAnalytic(kindName, x0, T) {
    // 匀加速：S = ∫(½mg²t² + mg·½gt²)dt = ∫mg²t²dt = mg²T³/3
    if (kindName === "匀加速") return LA_M * LA_G * LA_G * T * T * T / 3;
    if (kindName === "谐振子") {
      var s = Math.sin(LA_W * T);
      if (Math.abs(s) < 0.05) return LA_M * x0 * x0 / (2 * T);
      return 0.5 * LA_M * LA_W * x0 * x0 * Math.cos(LA_W * T) / s;
    }
    return LA_M * x0 * x0 / (2 * T);
  }
  /** 在 α 网格上取 S（网格里必须真有这个 α，否则返回 NaN） */
  function laLookup(alphas, Sgrid, alpha) {
    var bd = Infinity, best = NaN, i, d;
    for (i = 0; i < alphas.length; i++) {
      d = Math.abs(alphas[i] - alpha);
      if (d < bd) { bd = d; best = Sgrid[i]; }
    }
    return bd < 1e-9 ? best : NaN;
  }
  /** 从模型输出里取 α 对应的 S */
  function laSAt(out, alpha) {
    return laLookup(out.metrics.alphas, out.metrics.Sgrid, alpha);
  }

  SIM.register("least-action", {
    title: "变分原理：作用量在真实路径取极值",
    legend: "一族端点相同的路径 x = x_真实 + α·sin(πt/T)：α = 0 的真实路径让作用量 S 取极值（自由粒子下为极小）。",
    axes: { xlabel: "扰动幅度 α", ylabel: "作用量 S（归一化单位）" },
    params: {
      kind: { label: "系统", type: "enum", options: LA_KINDS, def: 0 },
      x0: { label: "端点位移 x₀", def: 1, min: -2, max: 2, step: 0.1 },
      T: { label: "总时间 T", def: 1, min: 0.2, max: 3, step: 0.05 },
      alpha: { label: "扰动幅度 α（0 = 真实路径）", def: 0, min: -1, max: 1, step: 0.05 }
    },
    plots: [
      { key: "S", label: "作用量 S(α)", color: "#5aa9ff" }
    ],
    compute: function (p) {
      var kindName = opt(LA_KINDS, p.kind);
      var x0 = clampNum(p.x0, -2, 2);
      var T = clampNum(p.T, 0.05, 10);
      var al = clampNum(p.alpha, -1, 1);

      /* α 网格：固定 7 条（含 ±0.3，供自检用）+ 当前 α（曲线随滑杆动） */
      var base = [-1, -0.6, -0.3, 0, 0.3, 0.6, 1], grid = [], i, j;
      for (i = 0; i < base.length; i++) grid.push(base[i]);
      var found = false;
      for (i = 0; i < grid.length; i++) if (Math.abs(grid[i] - al) < 1e-9) found = true;
      if (!found) grid.push(al);
      grid.sort(function (a, b) { return a - b; });

      var Sg = [], alphas = [];
      for (i = 0; i < grid.length; i++) {
        alphas.push(grid[i]);
        Sg.push(laAction(kindName, x0, T, grid[i]));
      }
      var i0 = 0;
      for (i = 0; i < alphas.length; i++) if (Math.abs(alphas[i]) < 1e-12) i0 = i;
      var S0 = Sg[i0], Sana = laAnalytic(kindName, x0, T), Scur = laLookup(alphas, Sg, al);

      /* 一族路径（各条自带横轴：t → x(t)） */
      var lines = [], nPath = 201;
      for (j = 0; j < alphas.length; j++) {
        var xs = [], ys = [], t, h;
        for (i = 0; i < nPath; i++) {
          t = T * i / (nPath - 1);
          h = Math.sin(Math.PI * t / T);
          xs.push(t);
          ys.push(laTruePath(kindName, x0, T, t) + alphas[j] * h);
        }
        lines.push({
          x: xs, y: ys,
          label: "α=" + fmt(alphas[j], 2),
          color: Math.abs(alphas[j]) < 1e-12 ? "#ffb84d" : "#5aa9ff",
          dash: Math.abs(alphas[j]) < 1e-12 ? null : "4 3"
        });
      }

      var dev = Math.abs(S0 - Sana), denom = Math.abs(Sana) > 1e-12 ? Math.abs(Sana) : 1;
      var info = [];
      for (j = 0; j < alphas.length; j++) {
        info.push({
          k: "S(α=" + fmt(alphas[j], 2) + ")",
          v: fmt(Sg[j], 6) + " J·s（归一化）" + (Math.abs(alphas[j] - al) < 1e-9 ? "（当前）" : "")
        });
      }
      info.push({ k: "S(α=0) 数值", v: fmt(S0, 8) + " J·s（m=1 归一化）" });
      info.push({ k: "S 的解析值", v: fmt(Sana, 8) + " J·s（公式见 legend 注释）" });
      info.push({ k: "相对偏差 |数值−解析|/|解析|", v: fmt(dev / denom, 3) });
      info.push({ k: "ΔS = S(α)−S(0)", v: fmt(Scur - S0, 6) + " J·s" });
      info.push({
        k: "二阶变分系数 (S(α)−S(0))/α²",
        v: Math.abs(al) > 1e-9 ? fmt((Scur - S0) / (al * al), 6) + " J·s" : "—（α=0）"
      });
      if (kindName === "匀加速") {
        info.push({
          k: "说明",
          v: "作用量必须计入势能：L = ½mẋ² + mgx（x 向下为正），于是 S(0) = mg²T³/3。" +
            "若只对动能积分会得到 mg²T³/6，但那样 x = ½gt² 不再是驻值路径（S(+α) ≠ S(−α)）——" +
            "这正是「拉格朗日量里势能项不可省」的最直接演示"
        });
      }
      info.push({ k: "路径条数", v: String(alphas.length) + " 条" });

      return {
        t: alphas,
        series: { S: Sg },
        info: info,
        extra: {
          lines: lines,
          xlabel: "t（归一化）", ylabel: "x(t)",
          title: "一族路径 x(t) = x_真实(t) + α·sin(πt/T)（两端固定，α=0 为真实路径）"
        },
        metrics: { alphas: alphas, Sgrid: Sg, S0: S0, Sanalytic: Sana, Scur: Scur, kind: kindName, x0: x0, T: T }
      };
    },
    tests: [
      { name: "① 自由粒子：S = m x₀²/(2T) = 0.5（x₀=1、T=1，数值积分 vs 解析）",
        params: { kind: 0, x0: 1, T: 1, alpha: 0 },
        measure: function (o) { return laSAt(o, 0); }, expect: 0.5, tol: 1e-6 },
      { name: "①' 自由粒子换参数：S = m x₀²/(2T) = 0.8（x₀=−2、T=2.5）",
        params: { kind: 0, x0: -2, T: 2.5, alpha: 0 },
        measure: function (o) { return laSAt(o, 0); }, expect: 0.8, tol: 1e-6 },
      { name: "② 匀加速：S = m g²T³/3 = 0.3333333（L = ½mẋ² + mgx，m=g=1、T=1）",
        params: { kind: 1, T: 1, alpha: 0 },
        measure: function (o) { return laSAt(o, 0); }, expect: 0.333333333, tol: 1e-6 },
      { name: "②'' 匀加速：S(α) 对 α 对称且 α=0 最小（S(±0.3) − S(0) = α²mπ²/(4T) = 0.2220664）",
        params: { kind: 1, T: 1, alpha: 0.3 },
        measure: function (o) {
          var d = laSAt(o, 0.3) - laSAt(o, 0), d2 = laSAt(o, -0.3) - laSAt(o, 0);
          return Math.abs(d - d2) < 1e-12 ? d : NaN;   // 不对称就直接判失败
        }, expect: Math.PI * Math.PI * 0.09 / 4, tol: 1e-6 },
      { name: "②' 谐振子：S = ½mω x₀²cot(ωT) = 0.3210465（x₀=1、T=1、ω=1）",
        params: { kind: 2, x0: 1, T: 1, alpha: 0 },
        measure: function (o) { return laSAt(o, 0); }, expect: 0.321046515, tol: 1e-6 },
      { name: "③ 极值性：|S(0)| < |S(±0.3)|（自由粒子，真实路径使 S 取极值）",
        params: { kind: 0, x0: 1, T: 1, alpha: 0 },
        measure: function (o) {
          var a = Math.abs(laSAt(o, 0)), b = Math.abs(laSAt(o, 0.3)), c = Math.abs(laSAt(o, -0.3));
          return (b > a && c > a) ? 1 : 0;
        }, expect: 1, tol: 0 },
      { name: "③' 极值性同样成立（谐振子 T=1：S(±0.3) > S(0)）",
        params: { kind: 2, x0: 1, T: 1, alpha: 0 },
        measure: function (o) {
          var a = laSAt(o, 0), b = laSAt(o, 0.3), c = laSAt(o, -0.3);
          return (b > a && c > a) ? 1 : 0;
        }, expect: 1, tol: 0 }
    ]
  });

  /* ==========================================================================
     2. phase-flow —— 相空间流与刘维尔定理
     --------------------------------------------------------------------------
     三种一维系统（归一化 m = 1、k = 1 ⇒ ω = 1）：
       · 谐振子    q̈ = −q            哈密顿量 H = ½p² + ½q²，相轨线是椭圆
                   椭圆面积 = π·(√(2E))·(√(2E)/ω) = 2πE/ω                ← 解析期望值
       · 单摆      q̈ = −sin q        H = ½p² + (1 − cos q)（分界线 E = 2）
       · 阻尼振子  q̈ = −q − (b/m)q̇   b/m = 0.3
     刘维尔定理：哈密顿流的相体积严格守恒；阻尼流的散度 ∇·v = −b/m 恒定，
     故相体积按 V(t) = V(0)·e^{−(b/m)t} 收缩（数值上取 ln[V(T)/V(0)]/(−T) 校验）。
     相体积的小片：相平面上以初始点为中心、半径 R 的圆（128 个边界点），用 RK4
     逐点推演，再用格林公式（8 阶差分）算面积——见 areaGreen 的精度说明。
     ========================================================================== */
  var PF_KINDS = ["谐振子", "单摆", "阻尼振子"];
  var PF_B = 0.3;        // 阻尼振子：b/m = 0.3（归一化）
  var PF_R = 0.07;       // 小片半径（相平面上一个小圆）
  var PF_T = 12;         // 观察时长
  var PF_N = 2400;       // 每条边界轨迹的 RK4 步数（h = 0.005）
  var PF_M = 128;        // 小片边界采样点数
  var PF_K = 48;         // 相体积的采样时刻数

  /** 相空间速度场 */
  function pfField(kindName) {
    if (kindName === "单摆") return function (t, y) { return [y[1], -Math.sin(y[0])]; };
    if (kindName === "阻尼振子") return function (t, y) { return [y[1], -y[0] - PF_B * y[1]]; };
    return function (t, y) { return [y[1], -y[0]]; };
  }
  /** 由能量 E 决定的初始相点：单摆 E<2 取静止释放的转折点；其余取最大位移处 */
  function pfStart(kindName, E) {
    if (kindName === "单摆") {
      if (E < 2) return [Math.acos(1 - E), 0];
      return [0, Math.sqrt(2 * E)];           // E>2：转动，取底部最大速度
    }
    return [Math.sqrt(2 * E), 0];
  }
  /** 当前能量的相轨线（闭合曲线，等距参数化，便于格林公式） */
  function pfOrbit(kindName, E, n) {
    var xs = [], ys = [], i, th, q, p, qm;
    if (kindName === "谐振子") {
      var a = Math.sqrt(2 * E);
      for (i = 0; i < n; i++) { th = 2 * Math.PI * i / n; xs.push(a * Math.cos(th)); ys.push(-a * Math.sin(th)); }
      return { x: xs, y: ys, closed: true };
    }
    if (kindName === "单摆" && E < 2) {
      qm = Math.acos(1 - E);
      for (i = 0; i < n; i++) { th = 2 * Math.PI * i / n; q = qm * Math.cos(th); p = Math.sqrt(Math.max(2 * (E - 1 + Math.cos(q)), 0)); xs.push(q); ys.push(p); }
      for (i = n - 1; i >= 0; i--) { th = 2 * Math.PI * i / n; q = qm * Math.cos(th); p = -Math.sqrt(Math.max(2 * (E - 1 + Math.cos(q)), 0)); xs.push(q); ys.push(p); }
      return { x: xs, y: ys, closed: true };
    }
    /* 单摆 E>2（转动）：上下两支开口曲线；阻尼振子没有闭合轨线 */
    for (i = 0; i < n; i++) {
      q = -Math.PI + 2 * Math.PI * i / (n - 1);
      p = Math.sqrt(Math.max(2 * (E - 1 + Math.cos(q)), 0));
      xs.push(q); ys.push(p);
    }
    return { x: xs, y: ys, closed: false };
  }
  /** 单摆闭轨面积（作用量 ∮p dq）：代换 q = qm sinφ 后被积函数光滑，辛普森高精度 */
  function pfPendulumArea(E) {
    if (!(E > 0) || E >= 2) return NaN;
    var qm = Math.acos(1 - E), n = 801, i, ts = [], ys = [], phi, q, v;
    for (i = 0; i < n; i++) {
      phi = -Math.PI / 2 + Math.PI * i / (n - 1);
      q = qm * Math.sin(phi);
      v = Math.max(2 * (E - 1 + Math.cos(q)), 0);
      ts.push(phi);
      ys.push(Math.sqrt(v) * qm * Math.cos(phi));
    }
    return 2 * simpson(ts, ys);
  }

  SIM.register("phase-flow", {
    title: "相空间流与刘维尔定理",
    legend: "相轨线族 + 一小块相体积的演化：哈密顿系统（谐振子、单摆）相体积严格守恒，阻尼振子的相体积单调收缩。",
    axes: { xlabel: "t（归一化）", ylabel: "相体积 V(t)/V(0)" },
    params: {
      kind: { label: "系统", type: "enum", options: PF_KINDS, def: 0 },
      E: { label: "能量 E（初值）", def: 1, min: 0.2, max: 3, step: 0.05 }
    },
    plots: [
      { key: "vol", label: "相体积 V(t)/V(0)", color: "#5aa9ff" }
    ],
    compute: function (p) {
      var kindName = opt(PF_KINDS, p.kind);
      var E = clampNum(p.E, 0.05, 3);
      var f = pfField(kindName);
      var c0 = pfStart(kindName, E);

      /* --- 小片边界与相体积演化 --- */
      var bx = [], by = [], m, kk, th;
      for (m = 0; m < PF_M; m++) {
        th = 2 * Math.PI * m / PF_M;
        bx.push(c0[0] + PF_R * Math.cos(th));
        by.push(c0[1] + PF_R * Math.sin(th));
      }
      var area0 = areaGreen(bx, by);
      var snapIdx = [], tSnap = [], vol = [], cur = [];
      for (kk = 0; kk < PF_K; kk++) {
        snapIdx.push(Math.round(kk * (PF_N - 1) / (PF_K - 1)));
        tSnap.push(PF_T * snapIdx[kk] / (PF_N - 1));
        cur.push({ x: [], y: [] });
      }
      for (m = 0; m < PF_M; m++) {
        var sol = rk4(f, [bx[m], by[m]], 0, PF_T, PF_N);
        for (kk = 0; kk < PF_K; kk++) {
          cur[kk].x.push(sol.y[0][snapIdx[kk]]);
          cur[kk].y.push(sol.y[1][snapIdx[kk]]);
        }
      }
      for (kk = 0; kk < PF_K; kk++) vol.push(areaGreen(cur[kk].x, cur[kk].y) / area0);
      var volEnd = vol[vol.length - 1];

      /* --- 作图：相轨线族 + 小片的 5 个快照 --- */
      var lines = [], i, Eorb;
      var orbit = pfOrbit(kindName, E, 256);
      var scl = Math.max(1, Math.sqrt(2 * E));
      if (kindName === "阻尼振子") {
        /* 阻尼：从几个不同初始点出发的螺旋 */
        var seeds = [[scl, 0], [0, scl], [-scl, 0], [0, -scl]];
        for (i = 0; i < seeds.length; i++) {
          var sp = rk4(f, seeds[i], 0, PF_T, 700);
          lines.push({ x: sp.y[0], y: sp.y[1], label: i === 0 ? "相轨线（螺旋）" : "", color: "#63d6a5", dash: "3 3" });
        }
      } else if (kindName === "单摆") {
        var Es = [0.4, 0.8, 1.2, 1.6];
        for (i = 0; i < Es.length; i++) {
          var ob = pfOrbit("单摆", Es[i], 220);
          lines.push({ x: ob.x, y: ob.y, label: i === 0 ? "能量曲线族" : "", color: "#63d6a5", dash: "3 3" });
        }
        var sep = pfOrbit("单摆", 1.9999, 220);
        lines.push({ x: sep.x, y: sep.y, label: "分界线 E=2", color: "#c792ea", dash: "6 4" });
      } else {
        var Es0 = [0.4 * E, 0.7 * E, 1.3 * E, 1.6 * E];
        for (i = 0; i < Es0.length; i++) {
          var ob0 = pfOrbit("谐振子", Es0[i], 220);
          lines.push({ x: ob0.x, y: ob0.y, label: i === 0 ? "能量曲线族" : "", color: "#63d6a5", dash: "3 3" });
        }
      }
      lines.push({ x: orbit.x, y: orbit.y, label: "当前相轨线 E=" + fmt(E, 2), color: "#ffb84d", dash: null });
      var snapDraw = [0, Math.round((PF_K - 1) / 4), Math.round((PF_K - 1) / 2), Math.round(3 * (PF_K - 1) / 4), PF_K - 1];
      for (i = 0; i < snapDraw.length; i++) {
        var ck = snapDraw[i];
        lines.push({
          x: cur[ck].x.concat([cur[ck].x[0]]),
          y: cur[ck].y.concat([cur[ck].y[0]]),
          label: i === 0 ? "小片 t=0" : (i === snapDraw.length - 1 ? "小片 t=" + fmt(PF_T, 0) : ""),
          color: i === 0 ? "#ff7b7b" : "#e8d44d",
          dash: i === snapDraw.length - 1 ? null : "2 2"
        });
      }

      /* --- 读数 --- */
      var areaAna;
      if (kindName === "谐振子") areaAna = 2 * Math.PI * E / 1;
      else if (kindName === "单摆") areaAna = pfPendulumArea(E);
      else areaAna = NaN;
      var drift = Math.abs(volEnd - 1);
      return {
        t: tSnap,
        series: { vol: vol },
        info: [
          { k: "系统", v: kindName },
          { k: "相轨线面积 ∮p dq（解析）", v: isFinite(areaAna) ? fmt(areaAna, 6) + " J·s" : "—" + (kindName === "单摆" ? "（E>2 为转动，非闭轨）" : "（阻尼下无闭轨）") },
          { k: "相轨线面积（格林公式数值）", v: orbit.closed ? fmt(areaGreen(orbit.x, orbit.y), 6) + " J·s" : "—" },
          { k: "相体积 V(0)", v: fmt(area0, 6) + " J·s" },
          { k: "相体积 V(T)", v: fmt(area0 * volEnd, 6) + " J·s" },
          { k: "V(T)/V(0)", v: fmt(volEnd, 8) },
          { k: "守恒偏离 |V(T)/V(0) − 1|", v: fmt(drift, 3) },
          { k: "相体积变化率 dlnV/dt", v: fmt(Math.log(volEnd) / PF_T, 6) + " 1/s" },
          { k: "理论收缩率 −b/m", v: kindName === "阻尼振子" ? fmt(-PF_B, 4) + " 1/s（散度 ∇·v = −b/m）" : "0（刘维尔定理）" }
        ],
        extra: {
          lines: lines,
          xlabel: "q（广义坐标）", ylabel: "p（广义动量）",
          title: "相平面：相轨线族 + 相体积小片（红 = 初始，黄 = 演化中，实线 = 末态）"
        },
        metrics: {
          kind: kindName, E: E, vol: vol, tSnap: tSnap, volEnd: volEnd, area0: area0,
          areaAna: areaAna, orbitX: orbit.x, orbitY: orbit.y, closed: orbit.closed
        }
      };
    },
    tests: [
      { name: "① 谐振子相轨线是椭圆：面积 = 2πE/ω = 6.2831853（E=1、ω=1，格林公式数值积分）",
        measure: function (o) { return areaGreen(o.metrics.orbitX, o.metrics.orbitY); },
        expect: 6.283185307, tol: 1e-6 },
      { name: "①' 谐振子 E=2.5：面积 = 2πE/ω = 15.7079633",
        params: { kind: 0, E: 2.5 },
        measure: function (o) { return areaGreen(o.metrics.orbitX, o.metrics.orbitY); },
        expect: 15.707963268, tol: 1e-6 },
      { name: "② 谐振子（无阻尼）：相体积守恒，相对变化 < 1e-9",
        params: { kind: 0, E: 1 },
        measure: function (o) { return Math.abs(o.metrics.vol[o.metrics.vol.length - 1] - 1); },
        expect: 0, tol: 1e-9 },
      { name: "②' 单摆（无阻尼）：相体积守恒，相对变化 < 1e-9（E=1）",
        params: { kind: 1, E: 1 },
        measure: function (o) { return Math.abs(o.metrics.vol[o.metrics.vol.length - 1] - 1); },
        expect: 0, tol: 1e-9 },
      { name: "②'' 单摆近分界线 E=1.9：相体积仍守恒（相对变化 < 1e-9）",
        params: { kind: 1, E: 1.9 },
        measure: function (o) { return Math.abs(o.metrics.vol[o.metrics.vol.length - 1] - 1); },
        expect: 0, tol: 1e-9 },
      { name: "③ 阻尼振子：相体积单调收缩，末/初 < 1",
        params: { kind: 2, E: 1 },
        measure: function (o) {
          var v = o.metrics.vol, mono = 1, i;
          for (i = 1; i < v.length; i++) if (v[i] > v[i - 1] + 1e-12) mono = 0;
          return (v[v.length - 1] < 1 && mono) ? 1 : 0;
        }, expect: 1, tol: 0 },
      { name: "③' 阻尼振子收缩率 = ln[V(T)/V(0)]/(−T) = b/m = 0.3（解析，T=12）",
        params: { kind: 2, E: 1 },
        measure: function (o) {
          var v = o.metrics.vol;
          return Math.log(v[v.length - 1]) / (-12);
        }, expect: 0.3, tol: 1e-6 }
    ]
  });

  /* ==========================================================================
     3. euler-top —— 自由刚体欧拉方程与网球拍定理
     --------------------------------------------------------------------------
     欧拉方程（主轴系，循环置换）：A ω̇₁ = (B−C)ω₂ω₃，B ω̇₂ = (C−A)ω₃ω₁，
     C ω̇₃ = (A−B)ω₁ω₂。两个守恒量：
       角动量平方  L²  = A²ω₁² + B²ω₂² + C²ω₃²
       转动动能    2T  = A ω₁² + B ω₂² + C ω₃²
     网球拍定理（Dzhanibekov 效应）：绕**中间主轴**的转动是鞍点，最初几乎不动
     （线性化增长率 λ = Ω√[(B−C)(A−B)/(AC)] > 0，A<B<C 时），随后 ω₂ 大幅翻转。
     本模型用两段统计量刻画：把 40 个时间单位的窗口前 10% 记作“初段”、
     后 25% 记作“末段”，比较 ω₂ 相对初值的最大偏离；默认参数下末段/初段 ≈ 8000。
     ========================================================================== */
  var ET_T = 40, ET_N = 40000, ET_DEC = 8;   // 窗口与步数（h = 1e-3）；作图每 8 步取 1 点

  /** 欧拉方程的右端（A、B、C 已夹在合法范围） */
  function etField(A, B, C) {
    return function (t, y) {
      return [
        (B - C) * y[1] * y[2] / A,
        (C - A) * y[2] * y[0] / B,
        (A - B) * y[0] * y[1] / C
      ];
    };
  }
  /** 段内 |v − ref| 的最大值（窗口比例 a、b ∈ [0,1]，等距采样） */
  function etSegDev(vals, a, b, ref) {
    var n = vals.length, i0 = Math.floor(a * (n - 1)), i1 = Math.ceil(b * (n - 1)), m = 0, i;
    if (i1 > n - 1) i1 = n - 1;
    for (i = i0; i <= i1; i++) m = Math.max(m, Math.abs(vals[i] - ref));
    return m;
  }

  SIM.register("euler-top", {
    title: "自由刚体欧拉方程与网球拍定理",
    legend: "绕中间主轴的转动不稳定（网球拍定理）：ω₂ 先缓慢逃逸、随后大幅翻转；L² 与 2T 始终守恒。",
    axes: { xlabel: "t（归一化）", ylabel: "角速度分量 ω (1/s)" },
    params: {
      A: { label: "主转动惯量 A", def: 1, min: 0.5, max: 3, step: 0.1 },
      B: { label: "主转动惯量 B", def: 1.5, min: 0.5, max: 3, step: 0.1 },
      C: { label: "主转动惯量 C", def: 2, min: 0.5, max: 3, step: 0.1 },
      w1: { label: "初值 ω₁", def: 0.01, min: -3, max: 3, step: 0.01 },
      w2: { label: "初值 ω₂", def: 1, min: -3, max: 3, step: 0.05 },
      w3: { label: "初值 ω₃", def: 0, min: -3, max: 3, step: 0.01 }
    },
    plots: [
      { key: "w1", label: "ω₁ (1/s)", color: "#5aa9ff" },
      { key: "w2", label: "ω₂ (1/s)", color: "#ffb84d" },
      { key: "w3", label: "ω₃ (1/s)", color: "#63d6a5" }
    ],
    compute: function (p) {
      var A = clampNum(p.A, 0.5, 3), B = clampNum(p.B, 0.5, 3), C = clampNum(p.C, 0.5, 3);
      var w10 = clampNum(p.w1, -3, 3), w20 = clampNum(p.w2, -3, 3), w30 = clampNum(p.w3, -3, 3);
      var sol = rk4(etField(A, B, C), [w10, w20, w30], 0, ET_T, ET_N);
      var w1 = sol.y[0], w2 = sol.y[1], w3 = sol.y[2], i, n = sol.t.length;
      var L2 = [], K = [];
      for (i = 0; i < n; i++) {
        L2.push(A * A * w1[i] * w1[i] + B * B * w2[i] * w2[i] + C * C * w3[i] * w3[i]);
        K.push(A * w1[i] * w1[i] + B * w2[i] * w2[i] + C * w3[i] * w3[i]);
      }
      /* 抽样存曲线（每 8 步 1 个点，控制 SVG 的点数） */
      var ts = [], w1s = [], w2s = [], w3s = [];
      for (i = 0; i < n; i += ET_DEC) {
        ts.push(sol.t[i]);
        w1s.push(w1[i]);
        w2s.push(w2[i]);
        w3s.push(w3[i]);
      }

      /* 哪一根是中间主轴（网球拍定理只对中间轴成立） */
      var mid = 2;
      if ((A > B && A < C) || (A < B && A > C)) mid = 1;
      else if ((C > A && C < B) || (C < A && C > B)) mid = 3;

      var devEarly = etSegDev(w2, 0, 0.10, w20);
      var devLate = etSegDev(w2, 0.75, 1, w20);
      var growth = 1;
      if (devEarly > 1e-12) growth = devLate / devEarly;
      else if (devLate > 1e-12) growth = 1e12;          // 退化：初段几乎不动（避免 Infinity）
      var w1max = maxAbs(w1), w1ratio = Math.abs(w10) > 1e-12 ? w1max / Math.abs(w10) : (w1max > 1e-12 ? 1e12 : 1);
      var flip = null;
      for (i = 1; i < n; i++) {
        if (Math.abs(w2[i] - w20) > 1) { flip = sol.t[i]; break; }   // ω₂ 相对初值偏离超过 1 = 翻转过半
      }

      /* 角速度球面上的极迹（3D 正交投影）+ 三根主轴 + 球轮廓 */
      var R = Math.sqrt(L2[0]);
      var AZ = 0.9, EL = 0.35, ca = Math.cos(AZ), sa = Math.sin(AZ), ce = Math.cos(EL), se = Math.sin(EL);
      function proj(x, y, z) {
        var u = -sa * x + ca * y;
        var v = -ca * se * x - sa * se * y + ce * z;
        return [u, v];
      }
      var pl = [], kd = 1400, idx;
      for (i = 0; i < kd; i++) {
        idx = Math.round(i * (n - 1) / (kd - 1));
        pl.push(proj(w1[idx], w2[idx], w3[idx]));
      }
      var lines = [];
      var axes = [[1, 0, 0, "主轴 1"], [0, 1, 0, "主轴 2"], [0, 0, 1, "主轴 3"]];
      for (i = 0; i < axes.length; i++) {
        var e = axes[i], a1 = proj(e[0] * R, e[1] * R, e[2] * R), a2 = proj(-e[0] * R, -e[1] * R, -e[2] * R);
        lines.push({
          x: [a2[0], a1[0]], y: [a2[1], a1[1]],
          label: e[3] + (mid === i + 1 ? "（中间轴·不稳定）" : ""),
          color: mid === i + 1 ? "#ff7b7b" : "#7fd8e8", dash: "5 4"
        });
      }
      var cxs = [], cys = [], nSph = 120;
      for (i = 0; i <= nSph; i++) {
        var ph = 2 * Math.PI * i / nSph;
        cxs.push(R * Math.cos(ph)); cys.push(R * Math.sin(ph));
      }
      lines.push({ x: cxs, y: cys, label: "|ω| = L 的球面轮廓", color: "#c792ea", dash: "2 4" });
      lines.push({
        x: pl.map(function (q) { return q[0]; }), y: pl.map(function (q) { return q[1]; }),
        label: "极迹（ω 在球面上的轨迹）", color: "#ffb84d", dash: null
      });

      return {
        t: ts,
        series: { w1: w1s, w2: w2s, w3: w3s },
        info: [
          { k: "角动量平方 L²", v: fmt(L2[0], 6) + "（A²ω₁²+B²ω₂²+C²ω₃²）" },
          { k: "L² 相对漂移", v: fmt(relDrift(L2), 3) },
          { k: "转动动能 2T", v: fmt(K[0], 6) + "（Aω₁²+Bω₂²+Cω₃²）" },
          { k: "2T 相对漂移", v: fmt(relDrift(K), 3) },
          { k: "中间主轴", v: "第 " + mid + " 轴（A、B、C 居中者 → 不稳定）" },
          { k: "ω₂ 偏离初值（前 10%）", v: fmt(devEarly, 4) + " 1/s" },
          { k: "ω₂ 偏离初值（后 25%）", v: fmt(devLate, 4) + " 1/s" },
          { k: "末段/初段 增长倍数", v: fmt(growth, 1) + " ×" },
          { k: "横向分量 max|ω₁|/|ω₁(0)|", v: fmt(w1ratio, 2) + " ×" },
          { k: "首次翻转时刻（|ω₂−ω₂(0)| > 1）", v: flip == null ? "—（窗口内未翻转）" : fmt(flip, 3) + " s" },
          { k: "max|ω|", v: fmt(Math.max(w1max, maxAbs(w2), maxAbs(w3)), 4) + " 1/s" }
        ],
        extra: {
          lines: lines,
          xlabel: "投影方向 u", ylabel: "投影方向 v",
          title: "角速度球面 |ω| = L 上的极迹（红色虚线 = 中间主轴，绕它的转动不稳定）"
        },
        metrics: {
          L2: L2, K: K, devEarly: devEarly, devLate: devLate, growth: growth,
          w1max: w1max, w1ratio: w1ratio, flip: flip, mid: mid
        }
      };
    },
    tests: [
      { name: "① 角动量平方守恒：L² = A²ω₁²+B²ω₂²+C²ω₃² 相对漂移 < 1e-6（从 series 现算）",
        measure: function (o, p) {
          var v = [], i;
          for (i = 0; i < o.series.w1.length; i++) {
            v.push(p.A * p.A * o.series.w1[i] * o.series.w1[i] +
              p.B * p.B * o.series.w2[i] * o.series.w2[i] +
              p.C * p.C * o.series.w3[i] * o.series.w3[i]);
          }
          return relDrift(v);
        }, expect: 0, tol: 1e-6 },
      { name: "② 转动动能守恒：2T = Aω₁²+Bω₂²+Cω₃² 相对漂移 < 1e-6（从 series 现算）",
        measure: function (o, p) {
          var v = [], i;
          for (i = 0; i < o.series.w1.length; i++) {
            v.push(p.A * o.series.w1[i] * o.series.w1[i] +
              p.B * o.series.w2[i] * o.series.w2[i] +
              p.C * o.series.w3[i] * o.series.w3[i]);
          }
          return relDrift(v);
        }, expect: 0, tol: 1e-6 },
      { name: "③ 网球拍定理：ω₂ 末段振幅（相对初值的偏离）> 初段的 5 倍",
        params: { A: 1, B: 1.5, C: 2, w1: 0.01, w2: 1, w3: 0 },
        measure: function (o) { return o.metrics.growth > 5 ? 1 : 0; }, expect: 1, tol: 0 },
      { name: "③' 定理的直接体现：横向分量 max|ω₁| > 10·|ω₁(0)|（不稳定方向的指数增长）",
        params: { A: 1, B: 1.5, C: 2, w1: 0.01, w2: 1, w3: 0 },
        measure: function (o) { return o.metrics.w1max > 10 * Math.abs(0.01) ? 1 : 0; }, expect: 1, tol: 0 },
      { name: "③'' 稳定性对照：绕最小主轴（ω₃）转动时 ω₂ 不增长",
        params: { A: 1, B: 1.5, C: 2, w1: 0.01, w2: 0, w3: 1 },
        measure: function (o) { return o.metrics.devLate < 5 * Math.max(o.metrics.devEarly, 1e-9) ? 1 : 0; },
        expect: 1, tol: 0 }
    ]
  });

  /* ==========================================================================
     4. normal-modes-n —— N 个质点、两端固定的等质量弹簧链
     --------------------------------------------------------------------------
     运动方程：m q̈_k = k(q_{k−1} − 2q_k + q_{k+1})，q_0 = q_{N+1} = 0。
     闭式解（不做数值对角化）：
       本征频率  ω_j = 2√(k/m)·sin(jπ/(2(N+1)))          j = 1…N
       模态形状  u_k^(j) = sin(jkπ/(N+1))                 k = 1…N
       第 j 个模态在链内有 j−1 个节点（u_k 的变号次数）
       质量加权正交：Σ_k m·u_k^(j)u_k^(l) = m(N+1)/2·δ_jl  ← 自检用
     数值对照：把纯模态 j 作为初值（q̇ = 0）积分 6 个周期，用三点公式
     q(t+h)+q(t−h) = 2cos(ωh)q(t) 从时间序列反解 ω，与闭式比较。
     ========================================================================== */
  var NM_QK = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8"];
  var NM_PERIODS = 6, NM_N = 8001, NM_DEC = 4;   // 积 6 个周期；存 1/4 的点作图

  function nmOmega(j, N, k, m) { return 2 * Math.sqrt(k / m) * Math.sin(j * Math.PI / (2 * (N + 1))); }
  function nmShape(j, N) {
    var out = [], k;
    for (k = 1; k <= N; k++) out.push(Math.sin(j * k * Math.PI / (N + 1)));
    return out;
  }

  SIM.register("normal-modes-n", {
    title: "N 自由度小振动：本征频率与模态",
    legend: "两端固定的等质量弹簧链：ω_j = 2√(k/m)sin(jπ/(2(N+1)))，模态形状是正弦，第 j 个模态有 j−1 个节点。",
    axes: { xlabel: "t（归一化）", ylabel: "各质点位移" },
    params: {
      N: { label: "质点数 N", def: 3, min: 2, max: 8, step: 1 },
      k: { label: "劲度系数 k", def: 1, min: 0.2, max: 5, step: 0.1 },
      m: { label: "质量 m", def: 1, min: 0.2, max: 5, step: 0.1 },
      mode: { label: "激励模态 j", def: 1, min: 1, max: 8, step: 1 }
    },
    plots: [
      { key: "q1", label: "q₁", color: "#5aa9ff" },
      { key: "q2", label: "q₂", color: "#ffb84d" },
      { key: "q3", label: "q₃", color: "#63d6a5" },
      { key: "q4", label: "q₄", color: "#ff7b7b" },
      { key: "q5", label: "q₅", color: "#c792ea" },
      { key: "q6", label: "q₆", color: "#7fd8e8" },
      { key: "q7", label: "q₇", color: "#e8d44d" },
      { key: "q8", label: "q₈", color: "#9fe870" }
    ],
    compute: function (p) {
      var N = Math.round(clampNum(p.N, 2, 8));
      var k = clampNum(p.k, 0.05, 20), m = clampNum(p.m, 0.05, 20);
      var jm = Math.round(clampNum(p.mode, 1, N));
      var w = nmOmega(jm, N, k, m);
      var Tp = w > 0 ? 2 * Math.PI / w : 0;
      var Tspan = NM_PERIODS * Tp;
      var shape = nmShape(jm, N), i, j;

      /* 全部本征频率与模态形状（闭式）
         离散正交性：Σ_k sin(jkπ/(N+1))·sin(lkπ/(N+1)) = (N+1)/2·δ_jl */
      var omegas = [], shapes = [], nodes = [], amps = [];
      for (j = 1; j <= N; j++) {
        var sh = nmShape(j, N);
        omegas.push(nmOmega(j, N, k, m));
        shapes.push(sh);
        nodes.push(countNodes(sh));
        amps.push(maxAbs(sh));
      }

      /* 数值时间演化（纯模态 jm 初值，q̇ = 0） */
      var y0 = [];
      for (i = 0; i < N; i++) { y0.push(shape[i]); y0.push(0); }
      var f = function (t, y) {
        var d = [], i2, ql, qr;
        for (i2 = 0; i2 < N; i2++) {
          ql = i2 === 0 ? 0 : y[2 * (i2 - 1)];
          qr = i2 === N - 1 ? 0 : y[2 * (i2 + 1)];
          d.push(y[2 * i2 + 1]);
          d.push((k / m) * (ql + qr - 2 * y[2 * i2]));
        }
        return d;
      };
      var sol = rk4(f, y0, 0, Tspan, NM_N);
      var nStore = Math.floor((NM_N - 1) / NM_DEC) + 1;
      var series = {}, ts = [], out0;
      for (i = 0; i < nStore; i++) ts.push(sol.t[i * NM_DEC]);
      for (i = 0; i < NM_QK.length; i++) {
        if (i >= N) { series[NM_QK[i]] = []; continue; }
        out0 = [];
        for (j = 0; j < nStore; j++) out0.push(sol.y[2 * i][j * NM_DEC]);
        series[NM_QK[i]] = out0;
      }
      /* 用第一个质点的时间序列反解角频率（三点公式） */
      var wnum = omegaThreePoint(ts, series.q1);
      var hStore = ts.length > 1 ? ts[1] - ts[0] : 0;

      /* 模态形状图：各阶模态 + 当前模态的连续正弦包络 */
      var lines = [];
      for (j = 1; j <= N; j++) {
        var xs = [0], ys = [0], k2, shj = shapes[j - 1];
        for (k2 = 1; k2 <= N; k2++) { xs.push(k2); ys.push(shj[k2 - 1]); }
        xs.push(N + 1); ys.push(0);
        lines.push({
          x: xs, y: ys,
          label: j === jm ? "当前模态 j=" + j : "j=" + j,
          color: j === jm ? "#ffb84d" : "#5aa9ff",
          dash: j === jm ? null : "3 3"
        });
      }
      var ex = [], ey = [], k3;
      for (k3 = 0; k3 <= 160; k3++) {
        var xx = (N + 1) * k3 / 160;
        ex.push(xx);
        ey.push(Math.sin(jm * Math.PI * xx / (N + 1)));
      }
      lines.push({ x: ex, y: ey, label: "连续 sin 包络", color: "#63d6a5", dash: "2 3" });

      var info = [], jj;
      for (jj = 1; jj <= N; jj++) {
        info.push({
          k: "ω" + jj + "（第 " + jj + " 模态）",
          v: fmt(omegas[jj - 1], 6) + " rad/s" + (jj === jm ? "（当前）" : "")
        });
      }
      info.push({ k: "解析周期 T_j = 2π/ω_j", v: fmt(Tp, 6) + " s" });
      info.push({
        k: "数值角频率（三点公式，6 个周期）",
        v: isFinite(wnum) ? fmt(wnum, 6) + " rad/s" : "—"
      });
      info.push({
        k: "相对偏差 |ω_数值−ω_闭式|/ω_闭式",
        v: isFinite(wnum) && w > 0 ? fmt(Math.abs(wnum - w) / w, 3) : "—"
      });
      info.push({ k: "节点数（应为 j−1）", v: String(nodes[jm - 1]) + " 个" });
      info.push({
        k: "正交性 Σ_k m·u^(1)·u^(3)",
        v: N >= 3 ? fmt(m * (function () {
          var s = 0, q;
          for (q = 0; q < N; q++) s += shapes[0][q] * shapes[2][q];
          return s;
        })(), 3) : "—（N<3）"
      });
      info.push({ k: "模态数", v: String(N) + " 个" });

      return {
        t: ts,
        series: series,
        info: info,
        extra: {
          lines: lines,
          xlabel: "质点位置（0 与 N+1 为固定端）", ylabel: "位移 u_k",
          title: "N 个模态形状 u_k^(j) = sin(jkπ/(N+1))（金色 = 当前激励的模态）"
        },
        metrics: {
          omegas: omegas, shapes: shapes, nodes: nodes, amps: amps,
          wnum: wnum, Tnum: isFinite(wnum) && wnum > 0 ? 2 * Math.PI / wnum : NaN,
          w: w, Tp: Tp, N: N, k: k, m: m, mode: jm, hStore: hStore, Tspan: Tspan
        }
      };
    },
    tests: [
      { name: "① 本征频率 ω_j = 2√(k/m)sin(jπ/(2(N+1)))：N=3、k=m=1 时 ω₃ = 2sin(3π/8) = 1.8477591",
        params: { N: 3, k: 1, m: 1, mode: 1 },
        measure: function (o) { return o.metrics.omegas[2]; }, expect: 1.847759065, tol: 1e-9 },
      { name: "①' 换一组：N=5、k=2、m=0.5 时 ω₁ = 4sin(π/12) = 1.0352762",
        params: { N: 5, k: 2, m: 0.5, mode: 1 },
        measure: function (o) { return o.metrics.omegas[0]; }, expect: 1.035276180, tol: 1e-9 },
      { name: "①'' 全部 N 个本征频率都与闭式一致（N=8、k=3、m=1.5，逐项最大相对偏差）",
        params: { N: 8, k: 3, m: 1.5, mode: 1 },
        measure: function (o, p) {
          var mx = 0, j, e;
          for (j = 1; j <= o.metrics.N; j++) {
            e = Math.abs(o.metrics.omegas[j - 1] - 2 * Math.sqrt(p.k / p.m) * Math.sin(j * Math.PI / (2 * (o.metrics.N + 1))));
            mx = Math.max(mx, e);
          }
          return mx;
        }, expect: 0, tol: 1e-12 },
      { name: "② 模态数 = N（N=6 → 6 个模态）",
        params: { N: 6, mode: 1 },
        measure: function (o) { return o.metrics.omegas.length; }, expect: 6, tol: 0 },
      { name: "③ 质量加权正交：Σ_k m·u^(1)·u^(3) = 0（N=8，容差 1e-9）",
        params: { N: 8, mode: 1 },
        measure: function (o) {
          var s = 0, q, sh1 = o.metrics.shapes[0], sh3 = o.metrics.shapes[2];
          for (q = 0; q < o.metrics.N; q++) s += o.metrics.m * sh1[q] * sh3[q];
          return s;
        }, expect: 0, tol: 1e-9 },
      { name: "④ 第 j 个模态有 j−1 个节点（N=8、j=3 → 2 个）",
        params: { N: 8, mode: 3 },
        measure: function (o) {
          var v = o.metrics.shapes[2], c = 0, last = 0, i, s;
          for (i = 0; i < v.length; i++) {
            s = v[i] > 1e-12 ? 1 : (v[i] < -1e-12 ? -1 : 0);
            if (s === 0) continue;
            if (last !== 0 && s !== last) c++;
            last = s;
          }
          return c;
        }, expect: 2, tol: 0 },
      { name: "④' 第 j 个模态有 j−1 个节点（N=8、j=7 → 6 个）",
        params: { N: 8, mode: 7 },
        measure: function (o) { return o.metrics.nodes[6]; }, expect: 6, tol: 0 },
      { name: "⑤ 数值时间演化的角频率 = 闭式 ω₂ = √2 = 1.4142136（N=3、k=m=1，三点公式）",
        params: { N: 3, k: 1, m: 1, mode: 2 },
        measure: function (o) { return o.metrics.wnum; }, expect: 1.414213562, tol: 1e-6 }
    ]
  });

  /* ==========================================================================
     5. lorenz —— 洛伦兹系统：初值敏感性
     --------------------------------------------------------------------------
     ẋ = σ(y−x)，ẏ = x(ρ−z) − y，ż = xy − βz。
     两条轨道只差初值 ε：(1,1,1) 与 (1+ε,1,1)。分离时间定义为
     |x₁ − x₂| 首次超过阈值 1 的时刻（阈值取 1，与吸引子尺度同量级）。
     散度 ∇·f = −(σ+1+β)：相体积以 e^{−(σ+1+β)t} 收缩（ρ<1 时原点全局稳定）。
     积分：T = 40、n = 40000（h = 1e-3，RK4）；作图用每 8 步抽 1 个点。
     ========================================================================== */
  var LZ_T = 40, LZ_N = 40000, LZ_Y0 = [1, 1, 1], LZ_THR = 1, LZ_DEC = 8;

  function lzField(sigma, rho, beta) {
    return function (t, y) {
      return [sigma * (y[1] - y[0]), y[0] * (rho - y[2]) - y[1], y[0] * y[1] - beta * y[2]];
    };
  }
  function lzRun(sigma, rho, beta, eps, n) {
    return rk4(lzField(sigma, rho, beta), [LZ_Y0[0] + eps, LZ_Y0[1], LZ_Y0[2]], 0, LZ_T, n || LZ_N);
  }
  /** 分离时间：|x₁−x₂| 首次超过 LZ_THR 的时刻（未分离返回 null） */
  function lzSepTime(sigma, rho, beta, eps, n) {
    if (!(eps > 0)) return null;
    var nUse = n || LZ_N;
    var a = lzRun(sigma, rho, beta, 0, nUse), b = lzRun(sigma, rho, beta, eps, nUse);
    var i;
    for (i = 0; i < a.t.length; i++) {
      if (Math.abs(a.y[0][i] - b.y[0][i]) > LZ_THR) return a.t[i];
    }
    return null;
  }

  SIM.register("lorenz", {
    title: "洛伦兹系统：初值敏感性",
    legend: "两条只差 ε 的初始轨道：ε = 0 时完全重合；ε 很小时先重合、随后指数分离（蝴蝶吸引子上仍在有限范围内）。",
    axes: { xlabel: "t（无量纲）", ylabel: "x(t)" },
    params: {
      sigma: { label: "σ（普朗特数）", def: 10, min: 0, max: 20, step: 0.5 },
      rho: { label: "ρ（瑞利数）", def: 28, min: 0, max: 50, step: 0.5 },
      beta: { label: "β", def: 2.667, min: 0.5, max: 5, step: 0.001 },
      eps: { label: "初值扰动 ε", def: 1e-5, min: 0, max: 0.01, step: 1e-6 }
    },
    plots: [
      { key: "x1", label: "轨道 1：x(t)", color: "#5aa9ff" },
      { key: "x2", label: "轨道 2：x(t)+ε 扰动", color: "#ffb84d", dash: "5 4" }
    ],
    compute: function (p) {
      var sigma = clampNum(p.sigma, 0, 50), rho = clampNum(p.rho, 0, 100);
      var beta = clampNum(p.beta, 0.1, 10), eps = clampNum(p.eps, 0, 1);
      var A = lzRun(sigma, rho, beta, 0, LZ_N);
      var B = lzRun(sigma, rho, beta, eps, LZ_N);
      var n = A.t.length, i, dx, dy2, dz;

      /* 分离时间（全分辨率）+ 上界统计 */
      var sep = null, maxN = 0, maxLate = 0, iLate = Math.floor(0.5 * (n - 1));
      for (i = 0; i < n; i++) {
        dx = A.y[0][i] - B.y[0][i];
        if (sep == null && eps > 0 && Math.abs(dx) > LZ_THR) sep = A.t[i];
        var nn = Math.sqrt(A.y[0][i] * A.y[0][i] + A.y[1][i] * A.y[1][i] + A.y[2][i] * A.y[2][i]);
        if (nn > maxN) maxN = nn;
        if (i >= iLate && nn > maxLate) maxLate = nn;
      }
      var last = n - 1;
      var finalNorm = Math.sqrt(A.y[0][last] * A.y[0][last] + A.y[1][last] * A.y[1][last] + A.y[2][last] * A.y[2][last]);

      /* 抽样存曲线（每 8 步 1 个点，8000 点以内） */
      var ts = [], x1 = [], x2 = [], sepSeries = [];
      for (i = 0; i < n; i += LZ_DEC) {
        ts.push(A.t[i]);
        x1.push(A.y[0][i]);
        x2.push(B.y[0][i]);
        sepSeries.push(Math.abs(A.y[0][i] - B.y[0][i]));
      }
      var lateStart = Math.floor(0.9 * (x1.length - 1));
      var lmin = Infinity, lmax = -Infinity;
      for (i = lateStart; i < x1.length; i++) { if (x1[i] < lmin) lmin = x1[i]; if (x1[i] > lmax) lmax = x1[i]; }
      var lateRange = lmax - lmin;

      /* 3D 投影（正交投影，抽样 1200 点） */
      var AZ = 0.9, EL = 0.35, ca = Math.cos(AZ), sa = Math.sin(AZ), ce = Math.cos(EL), se = Math.sin(EL);
      function proj(x, y, z) {
        var u = -sa * x + ca * y;
        var v = -ca * se * x - sa * se * y + ce * z;
        return [u, v];
      }
      var kd = 1200, l1 = [], l2 = [], idx;
      for (i = 0; i < kd; i++) {
        idx = Math.round(i * (n - 1) / (kd - 1));
        l1.push(proj(A.y[0][idx], A.y[1][idx], A.y[2][idx]));
        l2.push(proj(B.y[0][idx], B.y[1][idx], B.y[2][idx]));
      }
      var R = Math.max(10, Math.sqrt(A.y[0][0] * A.y[0][0] + A.y[1][0] * A.y[1][0] + A.y[2][0] * A.y[2][0]) + 40);
      var lines = [], axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], names = ["x 轴", "y 轴", "z 轴"];
      for (i = 0; i < 3; i++) {
        var e1 = proj(axes[i][0] * R, axes[i][1] * R, axes[i][2] * R);
        var e2 = proj(-axes[i][0] * R, -axes[i][1] * R, -axes[i][2] * R);
        lines.push({ x: [e2[0], e1[0]], y: [e2[1], e1[1]], label: names[i], color: "#7fd8e8", dash: "4 4" });
      }
      lines.push({
        x: l1.map(function (q) { return q[0]; }), y: l1.map(function (q) { return q[1]; }),
        label: "轨道 1", color: "#5aa9ff", dash: null
      });
      lines.push({
        x: l2.map(function (q) { return q[0]; }), y: l2.map(function (q) { return q[1]; }),
        label: "轨道 2（初值 +ε）", color: "#ffb84d", dash: null
      });

      return {
        t: ts,
        series: { x1: x1, x2: x2 },
        info: [
          { k: "初值扰动 ε", v: fmt(eps, 4) },
          { k: "分离时间（|Δx| 首次 > 1）", v: sep == null ? (eps > 0 ? "> " + fmt(LZ_T, 0) + "（窗口内未分离）" : "—（ε=0，轨道重合）") : fmt(sep, 4) },
          { k: "|x| 上界（全程）", v: fmt(maxN, 4) },
          { k: "|x| 上界（后半程）", v: fmt(maxLate, 4) },
          { k: "末段 x₁ 变化范围", v: fmt(lateRange, 4) },
          { k: "末点 |x|", v: fmt(finalNorm, 4) },
          { k: "相空间散度 ∇·f = −(σ+1+β)", v: fmt(-(sigma + 1 + beta), 4) + "（相体积按此速率收缩）" },
          { k: "非平凡不动点（ρ>1）", v: rho > 1 ? "z = ρ−1 = " + fmt(rho - 1, 4) : "—（ρ≤1 只有原点且稳定）" },
          { k: "最大 |x₁−x₂|", v: fmt(maxAbs(sepSeries), 4) }
        ],
        extra: {
          lines: lines,
          xlabel: "投影 u", ylabel: "投影 v",
          title: "两条轨道的 3D 投影（σ=" + fmt(sigma, 3) + "，ρ=" + fmt(rho, 3) + "，β=" + fmt(beta, 4) + "）"
        },
        metrics: {
          sepTime: sep, maxNorm: maxN, maxNormLate: maxLate, lateRange: lateRange,
          finalNorm: finalNorm, divRate: -(sigma + 1 + beta), eps: eps,
          sigma: sigma, rho: rho, beta: beta, sepSeries: sepSeries
        }
      };
    },
    tests: [
      { name: "① 确定性：同参数两次运行逐点完全一致（不用 Math.random，两条轨道各比一次）",
        params: { sigma: 10, rho: 28, beta: 2.667, eps: 1e-5 },
        measure: function (o, p) {
          var a1 = lzRun(p.sigma, p.rho, p.beta, 0, LZ_N).y[0];
          var b2 = lzRun(p.sigma, p.rho, p.beta, p.eps, LZ_N).y[0];
          var mx = 0, i;
          for (i = 0; i < o.series.x1.length; i++) {
            mx = Math.max(mx, Math.abs(o.series.x1[i] - a1[i * LZ_DEC]));
            mx = Math.max(mx, Math.abs(o.series.x2[i] - b2[i * LZ_DEC]));
          }
          return mx;
        }, expect: 0, tol: 0 },
      { name: "② ε=0 时两条轨道完全重合：|x₁−x₂| < 1e-9（实测 0）",
        params: { sigma: 10, rho: 28, beta: 2.667, eps: 0 },
        measure: function (o) { return maxAbs(o.metrics.sepSeries); }, expect: 0, tol: 1e-9 },
      { name: "③ ρ<1 时轨道收敛到原点：末点 |x| < 1e-3（ρ=0.5、t=40）",
        params: { sigma: 10, rho: 0.5, beta: 2.667, eps: 1e-5 },
        measure: function (o) { return o.metrics.finalNorm; }, expect: 0, tol: 1e-3 },
      { name: "④ (σ,ρ,β)=(10,28,2.667) 时轨道有界且不收敛：|x| 上界 < 100 且末段仍在变化",
        params: { sigma: 10, rho: 28, beta: 2.667, eps: 1e-5 },
        measure: function (o) { return (o.metrics.maxNorm < 100 && o.metrics.lateRange > 1) ? 1 : 0; },
        expect: 1, tol: 0 },
      { name: "⑤ ε 越大分离越早：t_sep(ε=1e-3) < t_sep(ε=1e-5)（t_sep 首次 |Δx|>1）",
        params: { sigma: 10, rho: 28, beta: 2.667, eps: 1e-5 },
        measure: function (o, p) {
          var tBig = lzSepTime(p.sigma, p.rho, p.beta, 1e-3, LZ_N);
          var tSml = lzSepTime(p.sigma, p.rho, p.beta, 1e-5, LZ_N);
          if (tBig == null || tSml == null) return 0;
          return tBig < tSml ? 1 : 0;
        }, expect: 1, tol: 0 },
      { name: "⑥ 步长稳健性：n=40000（h=1e-3）与 n=80000 的分离时间一致（|Δt_sep| < 0.05，ε=1e-5）",
        params: { sigma: 10, rho: 28, beta: 2.667, eps: 1e-5 },
        measure: function (o, p) {
          var t1 = lzSepTime(p.sigma, p.rho, p.beta, p.eps, LZ_N);
          var t2 = lzSepTime(p.sigma, p.rho, p.beta, p.eps, 2 * LZ_N);
          if (t1 == null || t2 == null) return NaN;
          return Math.abs(t1 - t2);
        }, expect: 0, tol: 0.05 },
      { name: "⑦ 相空间散度 = −(σ+1+β) = −13.667（解析值，ρ=0.5 时原点全局稳定）",
        params: { sigma: 10, rho: 0.5, beta: 2.667, eps: 1e-5 },
        measure: function (o) { return o.metrics.divRate; }, expect: -13.667, tol: 1e-12 }
    ]
  });

})(typeof window !== "undefined" ? window : globalThis);
