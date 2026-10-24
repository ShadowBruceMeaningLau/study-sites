/* ==========================================================================
   simlab-models-compute.js —— 计算物理 仿真模型（W5 契约 §13.B.1，4 个）

     · numerical-ode  数值积分方法的误差与收敛阶：欧拉 ∝ h、RK4 ∝ h⁴、能量漂移
     · montecarlo     蒙特卡洛：投点法估 π、积分 x²、高斯抽样，误差 ∝ 1/√n，带种子可重复
     · fft-spectrum   采样与频谱：奈奎斯特频率、频率分辨率、混叠折叠
     · percolation    渗流相变：方点阵 p_c = 0.592746、贯通判据、最大集团

   ★ 约束（与 simlab.js 顶部一致）：
     · 加载时**只调用 SIM.register**，绝不触碰 DOM —— tools/verify-simlab.mjs 在 Node 里
       用 window 桩直接跑 compute() 与 tests 做物理不变量自检；
     · **不调用 Math.random**（全文搜不到 "random" 调用）：montecarlo 与 percolation 的
       随机数全部来自文件内自带的 mulberry32（带种子），同一个 seed 的结果**逐位可重复**；
     · 纯 ES5：var / 无箭头函数 / 无模板字符串 / 无 import-export；
     · 边界安全：任意滑块取值都不抛异常、不出 NaN/Infinity —— 数值积分有发散护栏（冻结在
       最后一个有限状态并把读数标成“发散”），谱线/曲线里的发散量一律先截断再进曲线。

   无量纲化约定（各模型 info 里都写明）：
     · numerical-ode：简谐振子取 ω = 1、阻尼振子取 ω = 1、γ = 0.2、洛伦兹取标准参数
       (σ,ρ,β) = (10, 28, 8/3)；t 是无量纲时间（不写单位）；
     · fft-spectrum：频率单位 Hz、时间单位 s、幅度为无量纲（两分量幅度 1 与 0.5）；
     · montecarlo：投点法估 π 的“真值”就是 π；积分 x² 的真值 1/3；高斯抽样估 E|X| = √(2/π)；
     · percolation：格点边长 L、占据概率 p，均为无量纲。
   ========================================================================== */
(function (global) {
  "use strict";
  var SIM = global.SIM;
  if (!SIM) return;   // 在 Node 里若未先加载 simlab.js，安静退出

  var rk4 = SIM.rk4, lin = SIM.linspace, fmt = SIM.fmt, opt = SIM.opt;

  /* --------------------------------------------------------------- 通用小工具 */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  /** 参数安全取值：课程 config 不受滑块范围限制，NaN/越界/非数字都夹到合法区间 */
  function num(v, defv) { var x = Number(v); return isFinite(x) ? x : defv; }
  /** 有限性兜底：把 ±Infinity/NaN 换成 fallback */
  function fin(v, fb) { return isFinite(v) ? v : fb; }
  /** 数组中最大值下标（谱峰 / 曲线 argmax） */
  function argmax(ys) {
    var m = 0, i;
    for (i = 1; i < ys.length; i++) if (ys[i] > ys[m]) m = i;
    return m;
  }
  /** 两个等长序列的最大逐点偏差（“同 seed 可重复”自检） */
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
  /** 序列是否全为有限数（“不出 NaN/±∞”自检） */
  function allFinite(arr) {
    var i;
    if (!arr || !arr.length) return false;
    for (i = 0; i < arr.length; i++) if (!isFinite(arr[i])) return false;
    return true;
  }
  /**
   * 最小二乘直线斜率：  slope = Σ(x−x̄)(y−ȳ) / Σ(x−x̄)²
   * 误差 E(h) ∝ h^p 时，取 x = ln h、y = ln E，则 slope = p（双对数斜率＝幂指数）。
   * 用自然对数即可：换底只改常数，不改斜率。
   */
  function lsqSlope(xs, ys) {
    var n = xs.length, sx = 0, sy = 0, sxx = 0, sxy = 0, i;
    if (n < 2) return NaN;
    for (i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i]; }
    var den = n * sxx - sx * sx;
    if (den === 0) return NaN;
    return (n * sxy - sx * sy) / den;
  }

  /**
   * mulberry32：32 位状态的带种子 PRNG（自带的，不用 Math.random）。
   *   a ← a + 0x6D2B79F5；t ← (a ^ (a>>>15))·(1|a)；t ← (t + (t^(t>>>7))·(61|t)) ^ t；u = (t^(t>>>14))/2³²
   * 全部是 32 位整数运算（Math.imul），所以同一个 seed 的序列**逐位可重复**；
   * 不同 seed（哪怕只差 1）给出统计独立的序列——两处“同 seed 可重复”自检都靠它。
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

  /* ==========================================================================
     1. numerical-ode —— 数值积分方法的误差与收敛阶
     ==========================================================================
     三种系统（都取 ω = 1，t 无量纲）：
       简谐振子  ẍ = −x          x(0)=1, ẋ(0)=0    解析解 x = cos t
       阻尼振子  ẍ = −2γẋ − x     x(0)=1, ẋ(0)=0    解析解 x = e^{−γt}[cos ω_d t + (γ/ω_d) sin ω_d t]
                                                     ω_d = √(1−γ²)，γ = 0.2；v = ẋ = −e^{−γt} sin(ω_d t)/ω_d
       洛伦兹    标准 (σ,ρ,β) = (10, 28, 8/3)，初值 (1,1,1)——**没有解析解**，用 8 倍细步长 RK4 作参考解
     两种方法（固定步长 h，共 n = round(T/h) 步）：
       欧拉法（显式）  y ← y + h f(t,y)
       RK4            y ← y + (h/6)(k₁+2k₂+2k₃+k₄)
     误差定义：网格上 |x_num(t) − x_ref(t)| 的最大值（首分量 x）。
     解析自检依据（注释里的公式就是 expect 的来源）：
       ① 欧拉法全局误差 ∝ h（一阶），双对数斜率 = 1；
       ② RK4 全局误差 ∝ h⁴（四阶），双对数斜率 = 4；
       ③ 收敛阶成立时 h 减半误差降到 1/2^p：RK4 → 1/16；
       ④ 简谐振子的**能量放大因子是精确可算的**：
            欧拉法： x_{n+1} = x_n + h v_n，v_{n+1} = v_n − h x_n
                     ⇒ x²+v² 每步 ×(1+h²) ⇒ E_n/E_0 = (1+h²)^n（逐点恒等，不是近似）
            RK4：单步放大因子 = |R(iωh)|²，R(z) = 1+z+z²/2+z³/6+z⁴/24
                     ⇒ |R(iy)|² = (1−y²/2+y⁴/24)² + (y−y³/6)² = 1 − y⁶/72 + y⁸/576
                     所以欧拉法能量**指数增长**而 RK4 只有 −y⁶/72 量级的缓慢衰减，
                     能量漂移之比是 10⁶ 量级（远大于契约要求的 100 倍）。
     ========================================================================== */
  var ODE_KINDS = ["欧拉法", "RK4"];
  var ODE_SYSTEMS = ["简谐振子", "阻尼振子", "洛伦兹"];
  var ODE_GAMMA = 0.2;          // 阻尼振子的 γ（ω = 1，欠阻尼 ω_d = √(1−γ²) ≈ 0.9798）
  var ODE_MAXREC = 1000;        // 主图最多记录 ~1000 个点（SVG 折线的合理规模）
  var ODE_LIM = 1e8;            // 状态上限：任一分量超过它或变成非有限值 → 判定“发散”

  /** 右端函数 f(t, y) → dy[] */
  function odeDeriv(si) {
    if (si === 0) return function (t, y) { return [y[1], -y[0]]; };
    if (si === 1) return function (t, y) { return [y[1], -2 * ODE_GAMMA * y[1] - y[0]]; };
    return function (t, y) {
      return [10 * (y[1] - y[0]), y[0] * (28 - y[2]) - y[1], y[0] * y[1] - (8 / 3) * y[2]];
    };
  }
  /** 初值：简谐振子/阻尼振子 x=1, v=0；洛伦兹 (1,1,1) */
  function odeInit(si) { return si === 2 ? [1, 1, 1] : [1, 0]; }
  /** 解析解 [x, v]；洛伦兹返回 null（无解析解） */
  function odeExactAt(si, t) {
    if (si === 0) return [Math.cos(t), -Math.sin(t)];
    if (si === 1) {
      var g = ODE_GAMMA, wd = Math.sqrt(1 - g * g), e = Math.exp(-g * t);
      return [e * (Math.cos(wd * t) + (g / wd) * Math.sin(wd * t)), -e * Math.sin(wd * t) / wd];
    }
    return null;
  }
  /** 简谐振子/阻尼振子的能量 E = ½(v² + ω²x²)（ω = 1）；洛伦兹无守恒量 → null */
  function odeEnergy(si, y) {
    if (si === 2) return null;
    return 0.5 * (y[0] * y[0] + y[1] * y[1]);
  }
  function odeAdd(a, b, s) { var o = [], i; for (i = 0; i < a.length; i++) o.push(a[i] + b[i] * s); return o; }
  /** 单步推进：mode 0 = 欧拉法（显式），mode 1 = RK4 */
  function odeStep(f, mode, t, y, h) {
    var i, k1, k2, k3, k4, yn = [];
    if (mode === 0) {
      k1 = f(t, y);
      for (i = 0; i < y.length; i++) yn.push(y[i] + h * k1[i]);
      return yn;
    }
    k1 = f(t, y);
    k2 = f(t + h / 2, odeAdd(y, k1, h / 2));
    k3 = f(t + h / 2, odeAdd(y, k2, h / 2));
    k4 = f(t + h, odeAdd(y, k3, h));
    for (i = 0; i < y.length; i++) yn.push(y[i] + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
    return yn;
  }
  /** 参考解的细分倍数：RK4 用 h/8（误差再小 8⁴ = 4096 倍）；欧拉法只需明显优于 O(h) 即可，
      所以细步长不再小于 0.00625（洛伦兹在 h ≤ 0.0625 的 RK4 是稳定的，见下面的护栏）。 */
  function odeSub(mode, h) {
    var hr = (mode === 1) ? h / 8 : Math.max(h / 8, 0.00625);
    var n = Math.max(1, Math.round(h / hr));
    if ((mode === 1) && n > 8) n = 8;
    return n;
  }
  /**
   * 固定步长积分（带发散护栏 + 抽稀记录）。
   * 返回 { ts, xs, vs, blown, n, T }；blown = 状态超出 ODE_LIM 或变成非有限值，
   * 此时曲线**冻结在最后一个有限状态**继续沿时间轴延伸（图上一眼看出“数值解崩了”），
   * 绝不把 NaN/Infinity 放进 series。
   */
  function odeTraj(si, mode, h, T) {
    var f = odeDeriv(si), n = Math.max(1, Math.round(T / h)), y = odeInit(si).slice();
    var every = Math.max(1, Math.ceil(n / ODE_MAXREC));
    var ts = [], xs = [], vs = [], t = 0, blown = false, i, k, bad, last;
    for (i = 0; i <= n; i++) {
      if (i % every === 0 || i === n) { ts.push(t); xs.push(y[0]); vs.push(y.length > 1 ? y[1] : 0); }
      if (i === n) break;
      if (!blown) {
        last = y;
        y = odeStep(f, mode, t, last, h);
        bad = false;
        for (k = 0; k < y.length; k++) if (!isFinite(y[k]) || Math.abs(y[k]) > ODE_LIM) bad = true;
        if (bad) { y = last.slice(); blown = true; }
      }
      t = (i + 1) * h;   // 无论是否发散都推进时间（发散时曲线水平延伸）
    }
    return { ts: ts, xs: xs, vs: vs, blown: blown, n: n, T: n * h };
  }
  /**
   * 与 ts 一一对应的参考轨道。
   * 简谐振子/阻尼振子：解析式；洛伦兹：每段 [t_i, t_i+1] 用 nSub 个细步长的 RK4（SIM.rk4）积出来。
   */
  function odeRefSeries(si, ts, nSub) {
    var out = [], i;
    if (si === 0 || si === 1) {
      for (i = 0; i < ts.length; i++) out.push(odeExactAt(si, ts[i]));
      return out;
    }
    var f = odeDeriv(2), y = odeInit(2).slice(), tPrev = 0, res;
    out.push(y.slice());
    for (i = 1; i < ts.length; i++) {
      res = rk4(f, y, tPrev, ts[i], nSub + 1);          // 返回 nSub+1 个点，末点即 t_i
      y = [res.y[0][nSub], res.y[1][nSub], res.y[2][nSub]];
      tPrev = ts[i];
      out.push(y.slice());
    }
    return out;
  }
  /** 误差扫描的步长阶梯（6 级，每级 ×2）。
      欧拉法在 h 较大时误差被 exp(Th/2) 的振幅增长污染，必须取小 h 才看得到干净的 ∝h，
      所以欧拉的阶梯随 T 整体缩小（保证 T·h ≲ 0.5）；RK4 直接在大 h 上就进入 h⁴ 渐近区。 */
  var ODE_LADDER_N = 6;
  function odeLadders(T) {
    var m = clamp(Math.ceil(Math.log(Math.max(T, 1e-9) / 10) / Math.LN2), 0, 3);
    var he = [], hr = [], k;
    for (k = 0; k < ODE_LADDER_N; k++) {
      he.push(0.05 / Math.pow(2, k + m));   // 0.05 … 1.5625e-3（T ≤ 10）
      hr.push(0.4 / Math.pow(2, k));        // 0.4 … 0.0125
    }
    return { he: he, hr: hr };
  }
  /**
   * 收敛阶拟合：从最大步长起，逐点要求误差严格下降；一旦不再下降（舍入噪声或混沌放大主导）
   * 就**截断**，再对保留下来的点做 ln-ln 最小二乘，斜率就是阶数 p。
   * 无效点（发散，误差记为 −1）直接跳过；有效点少于 3 个时 slope = null
   * ——整个返回值里**不出现 NaN/±∞**（读数是“—”，绘图点被过滤掉）。
   */
  function fitOrder(hs, errs) {
    var px = [], py = [], prev = Infinity, i, e;
    for (i = 0; i < hs.length; i++) {
      e = errs[i];
      if (!isFinite(e) || e <= 0 || !(hs[i] > 0)) continue;
      if (e >= prev) break;
      px.push(Math.log(hs[i])); py.push(Math.log(e)); prev = e;
    }
    if (px.length < 3) return { slope: null, n: px.length };
    return { slope: lsqSlope(px, py), n: px.length };
  }
  /** 单个阶梯点的误差（网格上的最大偏差）；发散点返回 −1（无效哨兵，不参与拟合） */
  function odeSweepPoint(si, mode, h, T) {
    var f = odeDeriv(si), n = Math.max(1, Math.round(T / h)), y = odeInit(si).slice();
    var nSub = odeSub(mode, h), ex = (si === 0 || si === 1);
    var ref = odeInit(si).slice(), t = 0, i, k, maxE = 0, bad, last, r0;
    for (i = 0; i <= n; i++) {
      r0 = ex ? odeExactAt(si, t) : ref;
      var d = Math.abs(y[0] - r0[0]);
      if (isFinite(d) && d > maxE) maxE = d;
      if (i === n) break;
      last = y;
      y = odeStep(f, mode, t, last, h);
      bad = false;
      for (k = 0; k < y.length; k++) if (!isFinite(y[k]) || Math.abs(y[k]) > ODE_LIM) bad = true;
      if (bad) return -1;                             // 发散：记为 −1，拟合时跳过
      if (!ex) {                                      // 洛伦兹：参考解同段推进 nSub 个细 RK4 步
        for (k = 0; k < nSub; k++) ref = odeStep(f, 1, t + (k * h) / nSub, ref, h / nSub);
      }
      t = (i + 1) * h;
    }
    return maxE;
  }
  /** 误差随步长的扫描（只依赖 sys 与 T，做缓存：拖 h 滑块时不会重算） */
  var ODE_SWEEP_CACHE = {};
  function odeSweep(si, T) {
    var key = si + "|" + fmt(T, 6);
    if (ODE_SWEEP_CACHE[key]) return ODE_SWEEP_CACHE[key];
    var lad = odeLadders(T), out = { he: lad.he, hr: lad.hr, errE: [], errR: [] }, k;
    for (k = 0; k < lad.he.length; k++) out.errE.push(odeSweepPoint(si, 0, lad.he[k], T));
    for (k = 0; k < lad.hr.length; k++) out.errR.push(odeSweepPoint(si, 1, lad.hr[k], T));
    out.fitE = fitOrder(out.he, out.errE);
    out.fitR = fitOrder(out.hr, out.errR);
    ODE_SWEEP_CACHE[key] = out;
    return out;
  }

  SIM.register("numerical-ode", {
    title: "数值积分方法的误差与收敛阶",
    legend: "同一套微分方程用固定步长 h 积分：欧拉法（显式一阶）与 RK4（四阶）。" +
      "横轴是时间，实线是数值解、虚线是参考解（简谐振子/阻尼振子为解析解；洛伦兹无解析解，" +
      "用 8 倍细步长的 RK4 作参考）。第二张图是误差随步长的双对数图：直线斜率就是收敛阶 p（E ∝ h^p）。",
    axes: { xlabel: "t（无量纲时间，ω = 1）", ylabel: "x(t)（位置分量）" },
    params: {
      kind: { label: "积分方法", type: "enum", options: ODE_KINDS, def: 1 },
      sys: { label: "微分方程", type: "enum", options: ODE_SYSTEMS, def: 0 },
      h: { label: "步长 h", unit: "", def: 0.1, min: 0.001, max: 0.5, step: 0.001 },
      T: { label: "总时长 T", unit: "", def: 10, min: 1, max: 50, step: 1 }
    },
    plots: [
      { key: "exact", label: "参考解（解析/细步长）", color: "#ffb84d", dash: "6 4" },
      { key: "num", label: "数值解", color: "#5aa9ff" }
    ],
    compute: function (p) {
      var kindName = opt(ODE_KINDS, p.kind);
      var sysName = opt(ODE_SYSTEMS, p.sys);
      var si = Math.max(0, ODE_SYSTEMS.indexOf(sysName));
      var mode = Math.max(0, ODE_KINDS.indexOf(kindName));
      var h = clamp(num(p.h, 0.1), 1e-4, 1);          // 步长（滑块 0.001~0.5，config 越界也夹住）
      var T = clamp(num(p.T, 10), 0.1, 50);
      var n = Math.max(1, Math.round(T / h));
      // 步数护栏：课程 config 不受滑块限制时也不会把浏览器卡死
      if (n > 60000) { h = T / 60000; n = 60000; }

      var traj = odeTraj(si, mode, h, T);
      var nSub = odeSub(mode, h);
      var ref = odeRefSeries(si, traj.ts, Math.min(nSub, 8));
      var ex = [], nm = [], i, maxE = 0, d;
      for (i = 0; i < traj.ts.length; i++) {
        ex.push(ref[i][0]);
        nm.push(traj.xs[i]);
        d = Math.abs(traj.xs[i] - ref[i][0]);
        if (isFinite(d) && d > maxE) maxE = d;
      }
      var lastI = traj.ts.length - 1;
      var endE = Math.abs(traj.xs[lastI] - ref[lastI][0]);
      var tend = traj.ts[lastI];

      // 两种方法的能量漂移（仅简谐振子/阻尼振子有能量；洛伦兹无守恒量）
      var e0 = odeEnergy(si, odeInit(si));
      var trajE = (mode === 0) ? traj : odeTraj(si, 0, h, T);
      var trajR = (mode === 1) ? traj : odeTraj(si, 1, h, T);
      var nE = Math.max(1, Math.round(T / h));
      var driftE = null, driftR = null, eEndE = null, eEndR = null;
      if (e0) {
        var iE = trajE.ts.length - 1, iR = trajR.ts.length - 1;
        eEndE = odeEnergy(si, [trajE.xs[iE], trajE.vs[iE]]);
        eEndR = odeEnergy(si, [trajR.xs[iR], trajR.vs[iR]]);
        driftE = Math.abs(fin(eEndE / e0, 1) - 1);
        driftR = Math.abs(fin(eEndR / e0, 1) - 1);
      }
      // 自检用的解析放大因子（简谐振子，ω = 1）：欧拉 (1+h²)^n；RK4 (1 − (ωh)⁶/72 + (ωh)⁸/576)^n
      var yh = h;
      var ampEulerExact = Math.pow(1 + yh * yh, nE);
      var ampRK4Exact = Math.pow(1 - Math.pow(yh, 6) / 72 + Math.pow(yh, 8) / 576, nE);
      var ampEulerNum = e0 ? fin(Math.pow(Math.abs(eEndE / e0), 1 / nE), 1) : null;
      var ampRK4Num = e0 ? fin(Math.pow(Math.abs(eEndR / e0), 1 / nE), 1) : null;

      var sw = odeSweep(si, T);
      var slopeThis = (mode === 1) ? sw.fitR : sw.fitE;
      var slopeOther = (mode === 1) ? sw.fitE : sw.fitR;

      // 第二张图：误差—步长双对数图（两条曲线各自带横轴 = log10 h）
      var lines = [];
      var linE = [], linR = [], kx, ky, k;
      for (k = 0; k < sw.he.length; k++) {
        if (!isFinite(sw.errE[k]) || sw.errE[k] <= 0) continue;
        linE.push({ x: Math.log(sw.he[k]) / Math.LN10, y: Math.log(sw.errE[k]) / Math.LN10 });
      }
      for (k = 0; k < sw.hr.length; k++) {
        if (!isFinite(sw.errR[k]) || sw.errR[k] <= 0) continue;
        linR.push({ x: Math.log(sw.hr[k]) / Math.LN10, y: Math.log(sw.errR[k]) / Math.LN10 });
      }
      lines.push({ x: linE.map(function (q) { return q.x; }), y: linE.map(function (q) { return q.y; }), label: "欧拉法误差", color: "#ff7b7b" });
      lines.push({ x: linR.map(function (q) { return q.x; }), y: linR.map(function (q) { return q.y; }), label: "RK4 误差", color: "#5aa9ff" });
      // 两条参考斜率线（过各自最大 h 的点，斜率 1 与 4）：看曲线是否与它平行
      if (linE.length >= 2) {
        kx = linE[0].x; ky = linE[0].y;
        lines.push({ x: [kx, kx - 1.2], y: [ky, ky + 1.2], label: "参考斜率 1（∝h）", color: "#c792ea", dash: "4 4" });
      }
      if (linR.length >= 2) {
        kx = linR[0].x; ky = linR[0].y;
        lines.push({ x: [kx, kx - 1.2], y: [ky, ky + 4.8], label: "参考斜率 4（∝h⁴）", color: "#63d6a5", dash: "4 4" });
      }

      var info = [
        { k: "方法 / 方程", v: kindName + " + " + sysName },
        { k: "步长 h / 步数 n = T/h", v: fmt(h, 6) + " / " + fmt(n, 0) + " 步（实到 t = " + fmt(tend, 4) + "）" },
        { k: "末态误差 |Δx(T)|", v: fmt(endE, 3) + "（无量纲）" },
        { k: "最大误差 max|Δx|", v: fmt(maxE, 3) + "（无量纲）" },
        { k: "参考解", v: (si === 2) ? "洛伦兹无解析解：8 倍细步长 RK4" : "解析解" }
      ];
      if (e0) {
        info.push({ k: "能量漂移 |ΔE/E₀|（欧拉法）", v: fmt(driftE, 3) + "（E₀ = " + fmt(e0, 4) + "）" });
        info.push({ k: "能量漂移 |ΔE/E₀|（RK4）", v: fmt(driftR, 3) });
        info.push({ k: "欧拉法/RK4 漂移比", v: fmt(fin(driftE / Math.max(driftR, 1e-300), 0), 3) + " 倍" });
      } else {
        info.push({ k: "能量漂移", v: "—（洛伦兹无守恒量）" });
      }
      info.push({ k: "收敛阶（当前方法，ln-ln 斜率）", v: (slopeThis.slope == null) ? "—（有效点不足 3 个）" : fmt(slopeThis.slope, 3) + "（用 " + slopeThis.n + " 个步长点）" });
      info.push({ k: "另一方法的收敛阶", v: (slopeOther.slope == null) ? "—（有效点不足 3 个）" : fmt(slopeOther.slope, 3) });
      info.push({ k: "误差扫描的步长阶梯", v: "欧拉 " + fmt(sw.he[0], 5) + "→" + fmt(sw.he[sw.he.length - 1], 6) + "；RK4 " + fmt(sw.hr[0], 3) + "→" + fmt(sw.hr[sw.hr.length - 1], 5) });
      if (traj.blown) info.push({ k: "⚠ 数值解状态", v: "已发散（步长过大），曲线冻结在最后一个有限状态" });

      var bars = [];
      if (e0) {
        bars.push({ label: "欧拉法能量漂移（对数尺度差异）", value: driftE, color: "#ff7b7b" });
        bars.push({ label: "RK4 能量漂移", value: driftR, color: "#5aa9ff" });
        bars.push({ label: "相对误差 max|Δx|", value: maxE, color: "#ffb84d" });
      } else {
        bars.push({ label: "相对误差 max|Δx|（洛伦兹）", value: maxE, color: "#ffb84d" });
      }

      return {
        t: traj.ts, series: { exact: ex, num: nm },
        info: info, bars: bars,
        extra: {
          lines: lines,
          xlabel: "log₁₀ h（步长对数）", ylabel: "log₁₀（最大误差）",
          title: "误差随步长：斜率 = 收敛阶（欧拉 ≈ 1，RK4 ≈ 4）"
        },
        metrics: {
          h: h, T: T, n: n, si: si, mode: mode, sysName: sysName, kindName: kindName,
          endE: endE, maxE: maxE, blown: traj.blown, driftE: driftE, driftR: driftR,
          e0: e0, eEndE: eEndE, eEndR: eEndR,
          ampEulerExact: ampEulerExact, ampRK4Exact: ampRK4Exact,
          ampEulerNum: ampEulerNum, ampRK4Num: ampRK4Num,
          sweep: sw, ref: ref, traj: traj, trajE: trajE, trajR: trajR, nE: nE, ts: traj.ts
        }
      };
    },
    tests: [
      // ① 欧拉法全局误差 ∝ h ⇒ 双对数斜率 = 1（契约容差 0.1）
      //    依据：显式欧拉法局部截断误差 O(h²)、全局误差 O(h)；简谐振子可精确算出
      //    x_n = Re[(1+ih)^n]，其相位误差 T·h²/3、振幅误差 e^{Th/2}−1 的主导项都 ∝ h。
      {
        name: "① 欧拉法误差 ∝ h（双对数斜率 = 1）",
        params: { kind: 0, sys: 0, h: 0.1, T: 10 },
        measure: function (o) {
          var s = o.metrics.sweep, f = fitOrder(s.he, s.errE);
          return (f.slope == null) ? -999 : f.slope;    // 拟合失败就返回一个必然失败的数
        },
        expect: 1, tol: 0.1
      },
      // ② RK4 全局误差 ∝ h⁴ ⇒ 双对数斜率 = 4（契约容差 0.2）
      {
        name: "② RK4 误差 ∝ h⁴（双对数斜率 = 4）",
        params: { kind: 1, sys: 0, h: 0.1, T: 10 },
        measure: function (o) {
          var s = o.metrics.sweep, f = fitOrder(s.hr, s.errR);
          return (f.slope == null) ? -999 : f.slope;
        },
        expect: 4, tol: 0.2
      },
      // ③ 收敛阶的直接推论：E(h)/E(h/2) = 2^p = 2⁴ = 16（容差 20% ⇒ ±3.2）
      {
        name: "③ h 减半时 RK4 误差降到 1/16",
        params: { kind: 1, sys: 0, h: 0.1, T: 10 },
        measure: function (o) {
          var s = o.metrics.sweep, i1 = -1, i2 = -1, k;
          for (k = 0; k < s.hr.length; k++) { if (Math.abs(s.hr[k] - 0.2) < 1e-12) i1 = k; if (Math.abs(s.hr[k] - 0.1) < 1e-12) i2 = k; }
          if (i1 < 0 || i2 < 0 || !(s.errR[i1] > 0) || !(s.errR[i2] > 0)) return -999;
          return s.errR[i1] / s.errR[i2];
        },
        expect: 16, tol: 3.2
      },
      // ④ 简谐振子：欧拉法能量按 (1+h²)^n 指数增长，RK4 只有 −y⁶/72 量级的缓慢衰减，
      //    漂移之比 ~10⁶（契约要求“至少小 100 倍”）
      {
        name: "④ 简谐振子 RK4 能量漂移 ≪ 欧拉法（> 100 倍）",
        params: { kind: 1, sys: 0, h: 0.1, T: 10 },
        measure: function (o) {
          var dE = o.metrics.driftE, dR = o.metrics.driftR;
          if (!isFinite(dE) || !isFinite(dR) || dR <= 0) return 0;
          return (dE / dR > 100) ? 1 : 0;
        },
        expect: 1, tol: 0
      },
      // ⑤ 解析：显式欧拉法对简谐振子有逐点恒等式 x²+v² → (1+h²)(x²+v²)，
      //    所以每步能量放大因子 = 1+h²（h = 0.1 → 1.01），与 n、T 无关。
      {
        name: "⑤ 欧拉法每步能量放大因子 = 1 + h²（解析恒等式）",
        params: { kind: 0, sys: 0, h: 0.1, T: 10 },
        measure: function (o) { return o.metrics.ampEulerNum; },
        expect: 1.01, tol: 1e-10
      },
      // ⑥ 解析：RK4 对简谐振子的单步放大因子 = |R(iy)|² = (1−y²/2+y⁴/24)² + (y−y³/6)²
      //    = 1 − y⁶/72 + y⁸/576，y = ωh = 0.1 → 0.99999998612847…
      {
        name: "⑥ RK4 每步放大因子 = 1 − y⁶/72 + y⁸/576（解析式）",
        params: { kind: 1, sys: 0, h: 0.1, T: 10 },
        measure: function (o) { return o.metrics.ampRK4Num; },
        expect: 1 - 1e-6 / 72 + 1e-8 / 576, tol: 1e-10
      },
      // ⑦ 边界安全：h = 0.5（滑块上限，也是 RK4 的稳定性边缘）、洛伦兹、T = 50
      //    不许出现 NaN/±∞（发散时曲线冻结并给出提示）
      {
        name: "⑦ 边界安全：h = 0.5、洛伦兹、T = 50 无 NaN/±∞",
        params: { kind: 1, sys: 2, h: 0.5, T: 50 },
        measure: function (o) {
          return (allFinite(o.series.exact) && allFinite(o.series.num) && allFinite(o.t)) ? 1 : 0;
        },
        expect: 1, tol: 0
      },
      // ⑧ 边界安全：h → 0.001（最细步长）、洛伦兹、T = 1，同样不许 NaN/±∞
      {
        name: "⑧ 边界安全：h = 0.001、洛伦兹无 NaN/±∞",
        params: { kind: 0, sys: 2, h: 0.001, T: 1 },
        measure: function (o) {
          return (allFinite(o.series.exact) && allFinite(o.series.num)) ? 1 : 0;
        },
        expect: 1, tol: 0
      }
    ]
  });

  /* ==========================================================================
     2. montecarlo —— 蒙特卡洛方法与 1/√n 收敛
     ==========================================================================
     三种估计量（全部用带种子 PRNG，禁止 Math.random）：
       ① 投点法估 π：  (u,v) ~ U(0,1)²，命中 u²+v² ≤ 1 记 1 次， est = 4·命中数/n → π
                      解析方差：命中数 ~ B(n, p)，p = π/4 ⇒ Var(est) = 16p(1−p)/n = π(4−π)/n
       ② 积分 x²：     est = (1/n)Σ u_i² → ∫₀¹x²dx = 1/3
                      解析方差：Var = (E[x⁴] − (E[x²])²)/n = (1/5 − 1/9)/n = 4/(45n)
       ③ 高斯抽样：    Box–Muller 取 z ~ N(0,1)，est = (1/n)Σ|z_i| → E|X| = √(2/π) = 0.7978845608
                      解析方差：Var(|X|) = E[X²] − (E|X|)² = 1 − 2/π
     ★ 三者都是**无偏估计**，误差随样本数按中心极限定理 ∝ σ/√n ⇒ 双对数斜率 = −1/2。
       单条轨迹的 |est(n) − 真值| 是随机游走，不服从幂律；所以收敛斜率用**多批独立重复的
       RMS 误差**来测（B = 24 批，步长阶梯 n = 128·4^k，共 5 点），这是标准的误差收敛研究做法。
       RMS 的理论值也是解析的：RMS(n) = √(Var/n)（info 里给出对照）。
     ========================================================================== */
  var MC_KINDS = ["投点法估 π", "积分 x²", "高斯抽样"];
  var MC_TRUE = [Math.PI, 1 / 3, Math.sqrt(2 / Math.PI)];
  var MC_VAR = [Math.PI * (4 - Math.PI), 4 / 45, 1 - 2 / Math.PI];
  var MC_LADDER = [128, 512, 2048, 8192, 32768];
  var MC_BATCH = 24;

  /** 用给定随机流做一次估计（n 个样本） */
  function mcEstimate(kind, n, rnd) {
    var i, s = 0, u, v, hit = 0, z;
    if (kind === 0) {
      for (i = 0; i < n; i++) { u = rnd(); v = rnd(); if (u * u + v * v <= 1) hit++; }
      return 4 * hit / n;
    }
    if (kind === 1) {
      for (i = 0; i < n; i++) { u = rnd(); s += u * u; }
      return s / n;
    }
    for (i = 0; i < n; i++) {
      u = rnd(); v = rnd();
      if (u < 1e-300) u = 1e-300;                       // 保护 log(0) → −∞
      z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      s += Math.abs(z);
    }
    return s / n;
  }
  /** 误差收敛研究：多批独立重复的 RMS 误差随 n（只依赖 kind 与 seed，缓存） */
  var MC_STUDY_CACHE = {};
  function mcStudy(kind, seed) {
    var key = kind + "|" + seed;
    if (MC_STUDY_CACHE[key]) return MC_STUDY_CACHE[key];
    var rnd = mulberry32(seed + 7919), ns = [], rms = [], k, b, n, s2, d;
    for (k = 0; k < MC_LADDER.length; k++) {
      n = MC_LADDER[k]; s2 = 0;
      for (b = 0; b < MC_BATCH; b++) { d = mcEstimate(kind, n, rnd) - MC_TRUE[kind]; s2 += d * d; }
      ns.push(n); rms.push(Math.sqrt(s2 / MC_BATCH));
    }
    var out = {
      ns: ns, rms: rms,
      slope: lsqSlope(ns.map(Math.log), rms.map(Math.log)),
      theory: ns.map(function (q) { return Math.sqrt(MC_VAR[kind] / q); })
    };
    MC_STUDY_CACHE[key] = out;
    return out;
  }

  SIM.register("montecarlo", {
    title: "蒙特卡洛方法与 1/√n 收敛",
    legend: "用随机抽样估计一个确定的数：投点法把 π 变成面积比、平均值法算 ∫₀¹x²、Box–Muller " +
      "高斯抽样算 E|X| = √(2/π)。估计值随样本数震荡收敛；第二张图是多批重复的 RMS 误差—样本数双对数图，" +
      "斜率 −1/2 就是中心极限定理的 σ/√n。同一个 seed 的结果逐位可重复（自带 mulberry32）。",
    axes: { xlabel: "样本数 n", ylabel: "估计值 / 真实值" },
    params: {
      kind: { label: "估计量", type: "enum", options: MC_KINDS, def: 0 },
      n: { label: "样本数 n", unit: "", def: 1000, min: 100, max: 100000, step: 100 },
      seed: { label: "随机种子", unit: "", def: 1, min: 1, max: 9999, step: 1 }
    },
    plots: [
      { key: "est", label: "蒙特卡洛估计", color: "#5aa9ff" },
      { key: "exact", label: "真实值（解析）", color: "#ffb84d", dash: "6 4" }
    ],
    compute: function (p) {
      var kindName = opt(MC_KINDS, p.kind);
      var kind = Math.max(0, MC_KINDS.indexOf(kindName));
      var n = Math.round(clamp(num(p.n, 1000), 10, 200000));
      var seed = Math.round(clamp(num(p.seed, 1), -1e6, 1e6));
      var truth = MC_TRUE[kind];
      var rnd = mulberry32(seed);

      // 主图：估计值随样本数（抽稀到 ~400 个检查点）
      var rec = Math.max(1, Math.floor(n / 400));
      var ts = [], est = [], i, u, v, z, s = 0, hit = 0, cur = 0;
      for (i = 1; i <= n; i++) {
        if (kind === 0) { u = rnd(); v = rnd(); if (u * u + v * v <= 1) hit++; cur = 4 * hit / i; }
        else if (kind === 1) { u = rnd(); s += u * u; cur = s / i; }
        else {
          u = rnd(); v = rnd();
          if (u < 1e-300) u = 1e-300;
          z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
          s += Math.abs(z); cur = s / i;
        }
        if (i % rec === 0 || i === n) { ts.push(i); est.push(cur); }
      }
      var ex = [], j;
      for (j = 0; j < ts.length; j++) ex.push(truth);

      var study = mcStudy(kind, seed);
      var relErr = Math.abs(cur - truth) / Math.abs(truth);
      var rmsLast = study.rms[study.rms.length - 1];
      var thLast = study.theory[study.theory.length - 1];

      // 第二张图：RMS 误差—样本数双对数图 + 理论 ∝ n^(−1/2) 参考线
      var lx1 = Math.log(study.ns[0]) / Math.LN10, lx2 = Math.log(study.ns[study.ns.length - 1]) / Math.LN10;
      var ly0 = 0.5 * Math.log(MC_VAR[kind]) / Math.LN10;
      var lines = [
        {
          x: study.ns.map(function (q) { return Math.log(q) / Math.LN10; }),
          y: study.rms.map(function (q) { return Math.log(q) / Math.LN10; }),
          label: "RMS 误差（" + MC_BATCH + " 批重复）", color: "#ff7b7b"
        },
        {
          x: [lx1, lx2], y: [ly0 - 0.5 * lx1, ly0 - 0.5 * lx2],
          label: "理论 ∝ n^(−1/2)", color: "#63d6a5", dash: "5 4"
        }
      ];

      var info = [
        { k: "估计量", v: kindName + "（seed = " + seed + "）" },
        { k: "样本数 n", v: fmt(n, 0) },
        { k: "估计值", v: fmt(cur, 6) },
        { k: "真实值（解析）", v: fmt(truth, 6) + (kind === 0 ? "（π）" : (kind === 1 ? "（∫₀¹x²dx）" : "（E|X| = √(2/π)）")) },
        { k: "相对误差", v: fmt(relErr * 100, 4) + " %" },
        { k: "单次抽样的标准差 σ", v: fmt(Math.sqrt(MC_VAR[kind]), 6) },
        { k: "理论 RMS = σ/√n", v: fmt(thLast, 6) + "（n = " + fmt(study.ns[study.ns.length - 1], 0) + " 时）" },
        { k: "实测 RMS（" + MC_BATCH + " 批）", v: fmt(rmsLast, 6) },
        { k: "误差—样本数双对数斜率", v: fmt(study.slope, 4) + "（理论 −0.5）" }
      ];
      return {
        t: ts, series: { est: est, exact: ex },
        info: info,
        bars: [
          { label: "|估计值 − 真实值| / 真实值", value: relErr, color: "#ff7b7b" },
          { label: "实测 RMS / 理论 RMS", value: fin(rmsLast / Math.max(thLast, 1e-300), 0), color: "#5aa9ff" }
        ],
        extra: {
          lines: lines,
          xlabel: "log₁₀ n（样本数对数）", ylabel: "log₁₀（RMS 误差）",
          title: "误差随样本数：斜率 −1/2（中心极限定理）"
        },
        metrics: {
          kind: kind, kindName: kindName, n: n, seed: seed, truth: truth, est: cur,
          relErr: relErr, study: study, series: est, ts: ts
        }
      };
    },
    tests: [
      // ① 投点法估 π：est = 4·(命中数/n)，命中概率 p = π/4 ⇒ est 无偏。
      //    单次抽样的标准差 σ = √(π(4−π)) = 0.926，n = 10⁵ 时相对 RMS ≈ σ/(π√n) = 0.093%，
      //    所以“相对误差 < 1%”是 ~10σ 的宽松判据。expect 0 表示与 π 的相对偏差。
      {
        name: "① 投点法估 π：n = 100000 时相对误差 < 1%",
        params: { kind: 0, n: 100000, seed: 1 },
        measure: function (o) { return o.metrics.relErr; },
        expect: 0, tol: 0.01
      },
      // ② 中心极限定理：RMS 误差 ∝ n^(−1/2) ⇒ 双对数斜率 = −1/2（容差 0.1）
      {
        name: "② 误差 ∝ 1/√n（双对数斜率 = −0.5）",
        params: { kind: 0, n: 100000, seed: 1 },
        measure: function (o) { return o.metrics.study.slope; },
        expect: -0.5, tol: 0.1
      },
      // ③ 平均值法：est = (1/n)Σu²，E[u²] = ∫₀¹x²dx = 1/3，σ = √(4/45) = 0.2981，
      //    n = 10⁵ 时相对 RMS ≈ 0.28%（同样远小于 1% 的判据）
      {
        name: "③ 积分 ∫₀¹x²dx = 1/3：n = 100000 时相对误差 < 1%",
        params: { kind: 1, n: 100000, seed: 1 },
        measure: function (o) { return o.metrics.relErr; },
        expect: 0, tol: 0.01
      },
      // ④ 同 seed 完全可重复（自带 mulberry32，全文不用 Math.random）
      {
        name: "④ 同 seed 完全可重复（两次运行逐点一致）",
        params: { kind: 0, n: 5000, seed: 7 },
        measure: function (o, p) {
          var a = mcComputeFor(p, 0), b = mcComputeFor(p, 0);
          return maxDiff(a.series.est, b.series.est);
        },
        expect: 0, tol: 0
      },
      // ⑤ 换一个 seed 结果必须不同（证明随机数真的由 seed 驱动，而不是“常数”）
      {
        name: "⑤ 不同 seed 给出不同估计（种子确实驱动随机数）",
        params: { kind: 0, n: 5000, seed: 7 },
        measure: function (o, p) {
          var a = mcComputeFor(p, 0), b = mcComputeFor(p, 1);
          return Math.abs(a.metrics.est - b.metrics.est) > 0 ? 1 : 0;
        },
        expect: 1, tol: 0
      },
      // ⑥ 高斯抽样：Box–Muller 给出 z ~ N(0,1)，E|X| = √(2/π) = 0.7978845608；
      //    σ = √(1 − 2/π) = 0.6028，n = 10⁵ 时相对 RMS ≈ 0.24%
      {
        name: "⑥ 高斯抽样 E|X| = √(2/π) = 0.7978845608（相对误差 < 1%）",
        params: { kind: 2, n: 100000, seed: 1 },
        measure: function (o) { return o.metrics.relErr; },
        expect: 0, tol: 0.01
      },
      // ⑦ 积分 x² 的误差收敛也是 −1/2（换一个估计量再验一次中心极限定理）
      {
        name: "⑦ 积分 x² 的误差也 ∝ 1/√n（斜率 = −0.5）",
        params: { kind: 1, n: 100000, seed: 1 },
        measure: function (o) { return o.metrics.study.slope; },
        expect: -0.5, tol: 0.1
      },
      // ⑧ 高斯抽样的误差同样 ∝ 1/√n
      {
        name: "⑧ 高斯抽样的误差 ∝ 1/√n（斜率 = −0.5）",
        params: { kind: 2, n: 100000, seed: 1 },
        measure: function (o) { return o.metrics.study.slope; },
        expect: -0.5, tol: 0.1
      },
      // ⑨ 边界安全：n = 100（最小样本数）、n = 100000 的极限、seed 边界都不许 NaN/±∞
      {
        name: "⑨ 边界安全：n = 100 / n = 100000 / seed = 9999 无 NaN/±∞",
        params: { kind: 0, n: 100, seed: 9999 },
        measure: function (o, p) {
          var a = mcComputeFor(p, 0), b = mcComputeFor(p, -1);
          return (allFinite(a.series.est) && allFinite(a.series.exact) && allFinite(b.series.est)) ? 1 : 0;
        },
        expect: 1, tol: 0
      }
    ]
  });

  /** 以“覆盖若干参数”的方式重跑 montecarlo 的 compute（自检用；ds 用于改 seed） */
  function mcComputeFor(p, ds) {
    return SIM.models.montecarlo.compute({
      kind: p.kind, n: p.n, seed: (Math.round(num(p.seed, 1)) + ds)
    });
  }

  /* ==========================================================================
     3. fft-spectrum —— 采样、频谱、奈奎斯特与混叠
     ==========================================================================
     信号：x(t) = cos(2π f₁ t) + 0.5·cos(2π f₂ t)（f₂ ≤ 0 时第二分量关闭）
     采样：t_n = n/fs，n = 0…M−1，M 取 2 的幂（64…1024）——离散谱的横轴是 k·Δf。
     自己实现基 2 迭代 FFT（Cooley–Tukey，位反转 + 旋转因子表）：
       X_k = Σ_{n=0}^{M−1} x_n e^{−2πikn/M}
     单边幅度谱（余弦幅度为 1 时读数就是 1）：
       A_k = 2|X_k|/M（k = 1…M/2−1），  A_0 = |X_0|/M，  A_{M/2} = |X_{M/2}|/M
       ——直流与奈奎斯特两个 bin 不翻倍，所以 f = 0 与 f = fs/2 的幅度也正好是 1。
     解析自检依据：
       ① 奈奎斯特频率 = fs/2（采样定理：高于它的频率无法与低频区分）；
       ② 频率分辨率 Δf = fs/M（一个 bin 的宽度）；
       ③ 真实频率落在 bin 上（f = m·Δf）时，A_m 严格 = 1，其余 bin 严格 = 0
          （矩形窗下 Dirichlet 核在整数 bin 处取零点）；
       ④ 混叠折叠：采样后看到的频率 f_alias = |f − round(f/fs)·fs| ∈ [0, fs/2]，
          第一个奈奎斯特区内（fs/2 < f < fs）即 f_alias = fs − f；
       ⑤ 实序列的 Parseval 定理：Σ_n x_n² = M·[A_0² + A_{M/2}² + Σ_{k=1}^{M/2−1} A_k²/2]
          （后一项的 1/2 是因为单边谱把 ±k 两个 bin 合并了）。
     ========================================================================== */
  var FFT_N_MIN = 64, FFT_N_MAX = 1024;

  /** 原地基 2 FFT（迭代 Cooley–Tukey） */
  function fftInPlace(re, im, n) {
    var i, j, k, len, half, step, p, q, tr, ti, cr, ci, t;
    for (i = 1, j = 0; i < n; i++) {                 // 位反转置换
      var bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    var wr = new Array(n / 2), wi = new Array(n / 2), a;   // 旋转因子表（直接算，精度 ~1e-16）
    for (k = 0; k < n / 2; k++) { a = -2 * Math.PI * k / n; wr[k] = Math.cos(a); wi[k] = Math.sin(a); }
    for (len = 2; len <= n; len <<= 1) {
      half = len >> 1; step = n / len;
      for (i = 0; i < n; i += len) {
        for (k = 0; k < half; k++) {
          var tw = k * step; cr = wr[tw]; ci = wi[tw];
          p = i + k; q = p + half;
          tr = re[q] * cr - im[q] * ci;
          ti = re[q] * ci + im[q] * cr;
          re[q] = re[p] - tr; im[q] = im[p] - ti;
          re[p] += tr; im[p] += ti;
        }
      }
    }
  }
  /** 混叠：采样后看到的（第一奈奎斯特区内的）频率 */
  function aliasFreq(f, fs) {
    if (!(fs > 0)) return 0;
    return Math.abs(f - Math.round(f / fs) * fs);
  }
  /** 把 N 夹到 [64,1024] 内最接近的 2 的幂（FFT 要求） */
  function snapPow2(N) {
    var v = clamp(Math.round(num(N, 256)), FFT_N_MIN, FFT_N_MAX);
    return clamp(Math.pow(2, Math.round(Math.log(v) / Math.LN2)), FFT_N_MIN, FFT_N_MAX);
  }

  SIM.register("fft-spectrum", {
    title: "采样、频谱与混叠",
    legend: "信号是两个余弦之和（幅度 1 与 0.5），用 fs 采样 M 点后做 FFT。主图横轴是样本序号 n：" +
      "波形是时域采样，幅度谱画在同样的序号轴上（f = k·Δf）；第二张图把它换成频率轴，" +
      "并标出真实频率与奈奎斯特频率。f > fs/2 的分量会“折叠”到 fs − f 处——这就是混叠。",
    axes: { xlabel: "样本序号 n（幅度谱横轴：f = k·Δf = k·fs/M）", ylabel: "x(n) 与单边幅度谱 A_k" },
    params: {
      f1: { label: "分量 1 频率 f₁", unit: "Hz", def: 5, min: 0.5, max: 20, step: 0.1 },
      f2: { label: "分量 2 频率 f₂（0 = 关闭）", unit: "Hz", def: 12, min: 0, max: 20, step: 0.1 },
      fs: { label: "采样率 fs", unit: "Hz", def: 30, min: 5, max: 100, step: 1 },
      N: { label: "采样点数 N（自动取 2 的幂）", unit: "", def: 256, min: 64, max: 1024, step: 1 }
    },
    plots: [
      { key: "signal", label: "时域采样 x(n)", color: "#5aa9ff" },
      { key: "spectrum", label: "单边幅度谱 A_k（右半为 0）", color: "#ffb84d" }
    ],
    compute: function (p) {
      var f1 = clamp(num(p.f1, 5), -1000, 1000);
      var f2raw = clamp(num(p.f2, 12), -1000, 1000);
      var fs = clamp(num(p.fs, 30), 0.1, 1000);
      var M = snapPow2(p.N);
      var on2 = f2raw > 0;                       // f₂ = 0 表示关闭第二分量（不是直流！）
      var a2 = on2 ? 0.5 : 0;
      var df = fs / M;

      var re = new Array(M), im = new Array(M), sig = [], idx = [], i, t;
      for (i = 0; i < M; i++) {
        t = i / fs;
        var v = Math.cos(2 * Math.PI * f1 * t) + (on2 ? a2 * Math.cos(2 * Math.PI * f2raw * t) : 0);
        sig.push(v); re[i] = v; im[i] = 0; idx.push(i);
      }
      fftInPlace(re, im, M);
      var amp = [], freqs = [], mag;
      for (i = 0; i <= M / 2; i++) {
        mag = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
        amp.push((i === 0 || i === M / 2) ? fin(mag / M, 0) : fin(mag / (M / 2), 0));
        freqs.push(i * df);
      }
      var kpk = argmax(amp);
      var fpk = kpk * df;
      var a1 = aliasFreq(f1, fs), a2s = on2 ? aliasFreq(f2raw, fs) : -1;
      var nyq = fs / 2;
      var alias1 = Math.abs(a1 - Math.abs(f1)) > 1e-9 * Math.max(1, Math.abs(f1));
      var alias2 = on2 && Math.abs(a2s - f2raw) > 1e-9 * Math.max(1, Math.abs(f2raw));

      // 第二张图：幅度谱 vs 频率 + 真实频率/奈奎斯特标记
      var mark = [];
      var peakAt = function (f) {
        var k = Math.round(f / df);
        k = clamp(k, 0, M / 2);
        return amp[k];
      };
      mark.push({ x: Math.abs(f1), y: peakAt(aliasFreq(f1, fs)) + 0.08, label: "f₁ = " + fmt(f1, 3) + " Hz" });
      if (on2) mark.push({ x: Math.abs(f2raw), y: peakAt(aliasFreq(f2raw, fs)) + 0.08, label: "f₂ = " + fmt(f2raw, 3) + " Hz" });
      mark.push({ x: nyq, y: 0.05, label: "奈奎斯特 fs/2 = " + fmt(nyq, 3) + " Hz" });

      var info = [
        { k: "奈奎斯特频率 fs/2", v: fmt(nyq, 6) + " Hz" },
        { k: "频率分辨率 Δf = fs/N", v: fmt(df, 8) + " Hz（实际点数 N = " + fmt(M, 0) + "，2 的幂）" },
        { k: "是否混叠", v: (alias1 || alias2) ? "是：分量超过 fs/2，已折叠" : "否：全部分量都在 fs/2 以内" },
        { k: "分量 1：真实 → 看到", v: fmt(f1, 4) + " Hz → " + fmt(a1, 4) + " Hz" },
        { k: "分量 2：真实 → 看到", v: on2 ? (fmt(f2raw, 4) + " Hz → " + fmt(a2s, 4) + " Hz") : "未启用（f₂ = 0）" },
        { k: "谱峰位置（最高峰）", v: fmt(fpk, 4) + " Hz（第 " + fmt(kpk, 0) + " 个 bin）" },
        { k: "峰值幅度", v: fmt(amp[kpk], 4) + "（矩形窗泄漏时略小于 1）" },
        { k: "时间窗长度", v: fmt((M - 1) / fs, 4) + " s（采样间隔 " + fmt(1 / fs, 6) + " s）" }
      ];
      return {
        t: idx, series: { signal: sig, spectrum: amp },
        info: info,
        bars: [
          { label: "奈奎斯特频率 fs/2（Hz）", value: nyq, color: "#63d6a5" },
          { label: "分量 1 真实频率（Hz）", value: Math.abs(f1), color: "#5aa9ff" },
          { label: "分量 1 看到的频率（Hz）", value: a1, color: "#ff7b7b" }
        ],
        extra: {
          lines: [{ x: freqs, y: amp, label: "单边幅度谱", color: "#ffb84d" }],
          markers: mark,
          xlabel: "频率 f (Hz)", ylabel: "单边幅度谱 A(f)",
          title: "幅度谱 vs 频率：真实频率与奈奎斯特频率已标出"
        },
        metrics: {
          f1: f1, f2: on2 ? f2raw : 0, on2: on2, fs: fs, M: M, df: df, nyq: nyq,
          alias1: a1, alias2: a2s, peakK: kpk, peakF: fpk, amp: amp, freqs: freqs,
          signal: sig, re: re, im: im, idx: idx, sample: sig
        }
      };
    },
    tests: [
      // ① 采样定理：奈奎斯特频率 = fs/2（精确）。fs = 30 Hz → 15 Hz
      {
        name: "① 奈奎斯特频率 = fs/2（精确）",
        params: { f1: 5, f2: 0, fs: 30, N: 256 },
        measure: function (o, p) { return o.metrics.nyq - p.fs / 2; },
        expect: 0, tol: 0
      },
      // ② f < fs/2 时谱峰出现在真实频率处（容差 1 个 bin = Δf = 30/256 = 0.1171875）
      {
        name: "② f₁ = 5 Hz < fs/2 = 15 Hz：谱峰在 5 Hz（±1 bin）",
        params: { f1: 5, f2: 0, fs: 30, N: 256 },
        measure: function (o) { return Math.abs(o.metrics.peakF - 5); },
        expect: 0, tol: 0.1172
      },
      // ③ f > fs/2 时混叠：f₁ = 20 Hz、fs = 30 Hz ⇒ 看到 fs − f₁ = 10 Hz（容差 1 bin）
      {
        name: "③ f₁ = 20 Hz > fs/2：混叠到 fs − f₁ = 10 Hz（±1 bin）",
        params: { f1: 20, f2: 0, fs: 30, N: 256 },
        measure: function (o) { return Math.abs(o.metrics.peakF - 10); },
        expect: 0, tol: 0.1172
      },
      // ④ 频率分辨率 Δf = fs/N = 30/256 = 0.1171875（容差 1e-9）
      {
        name: "④ 频率分辨率 Δf = fs/N（容差 1e-9）",
        params: { f1: 5, f2: 0, fs: 30, N: 256 },
        measure: function (o, p) { return o.metrics.df - p.fs / p.N; },
        expect: 0, tol: 1e-9
      },
      // ⑤ FFT 正确性（解析）：频率正好落在 bin 上时（fs = 32、N = 256、f = 5 Hz = 第 40 个 bin），
      //    矩形窗的 Dirichlet 核在其它整数 bin 处严格取零 ⇒ A₄₀ = 1、其余 bin = 0
      {
        name: "⑤ 整数 bin 上的余弦：峰幅 = 1、其余 bin = 0（解析）",
        params: { f1: 5, f2: 0, fs: 32, N: 256 },
        measure: function (o) {
          var a = o.metrics.amp, m = 0, i;
          if (Math.abs(o.metrics.peakK - 40) > 0) return NaN;
          for (i = 0; i < a.length; i++) if (i !== 40 && a[i] > m) m = a[i];
          return Math.abs(a[40] - 1) + m;
        },
        expect: 0, tol: 1e-12
      },
      // ⑥ Parseval（实序列，单边谱形式）：Σx_n² = M[A₀² + A_{M/2}² + Σ_{k=1}^{M/2−1} A_k²/2]
      {
        name: "⑥ Parseval：Σx² = N[A₀² + A_{N/2}² + ΣA_k²/2]（容差 1e-12）",
        params: { f1: 5.37, f2: 12.91, fs: 44, N: 512 },
        measure: function (o) {
          var s = o.metrics.signal, a = o.metrics.amp, M = o.metrics.M, i, sx = 0, acc;
          for (i = 0; i < M; i++) sx += s[i] * s[i];
          acc = a[0] * a[0] + a[M / 2] * a[M / 2];
          for (i = 1; i < M / 2; i++) acc += a[i] * a[i] / 2;
          acc *= M;
          return Math.abs(sx - acc) / Math.max(1e-300, Math.abs(sx));
        },
        expect: 0, tol: 1e-12
      },
      // ⑦ 边界：正好采样在奈奎斯特频率上（f₁ = fs/2 = 20 Hz，fs = 40 Hz）：
      //    cos(2π·fs/2·t_n) = (−1)^n ⇒ 全部能量落在第 M/2 个 bin，幅度仍为 1
      {
        name: "⑦ f = fs/2（奈奎斯特边缘）：谱峰在 fs/2、峰幅 = 1",
        params: { f1: 20, f2: 0, fs: 40, N: 256 },
        measure: function (o) {
          var a = o.metrics.amp, k = o.metrics.peakK;
          return Math.abs(o.metrics.peakF - 20) + Math.abs(k - o.metrics.M / 2) + Math.abs(a[k] - 1);
        },
        expect: 0, tol: 1e-12
      },
      // ⑧ 边界：f₁ = 0（直流）时全部能量在 k = 0，幅度 = 1；f₂ = 0 表示关闭第二分量
      {
        name: "⑧ 边界：f₁ = 0（直流）+ f₂ = 0（关闭）：峰在 k = 0、幅度 = 1",
        params: { f1: 0, f2: 0, fs: 30, N: 128 },
        measure: function (o) {
          return Math.abs(o.metrics.peakF) + Math.abs(o.metrics.amp[0] - 1);
        },
        expect: 0, tol: 1e-12
      },
      // ⑨ 边界安全：极端参数（fs 最小/最大、f 最大、N 最小/最大、混叠到直流）无 NaN/±∞
      {
        name: "⑨ 边界安全：fs = 5/100、f = 20、N = 64/1024、混叠到直流 无 NaN/±∞",
        params: { f1: 20, f2: 20, fs: 5, N: 64 },
        measure: function (o, p) {
          var b = SIM.models["fft-spectrum"].compute({ f1: 0.5, f2: 20, fs: 100, N: 1024 });
          var c = SIM.models["fft-spectrum"].compute({ f1: 20, f2: 0, fs: 5, N: 1000 });
          return (allFinite(o.series.signal) && allFinite(o.series.spectrum) &&
            allFinite(b.series.signal) && allFinite(b.series.spectrum) &&
            allFinite(c.series.spectrum)) ? 1 : 0;
        },
        expect: 1, tol: 0
      }
    ]
  });

  /* ==========================================================================
     4. percolation —— 方点阵渗流相变
     ==========================================================================
     模型：L×L 方点阵，每个格点以概率 p 独立占据；占据格点按 4 近邻连通成“集团”。
       · 最大集团占比 S(p) = 最大集团格点数 / L²；
       · 贯通：存在集团同时接触上、下边界（上下贯通）或左、右边界（左右贯通）。
     判据用并查集（union-find，路径减半 + 按大小合并）统计集团大小与边界接触；
     贯通路径用 BFS（从顶行出发、4 近邻扩展，直到触底）给出一条真实的连接链。
     解析事实（自检 expect 的来源）：
       ① 方点阵（site percolation）阈值 p_c = 0.592746（已知高精度数值结果，容差 1e-6）；
       ② 无限大点阵：p < p_c 不存在无限集团（有限 L 下贯通概率也迅速趋于 0），
          p > p_c 存在无限集团 ⇒ 有限 L = 40 时 p_c ± 0.15 已远在有限尺寸展宽
          （宽度 ~L^(−3/4) ≈ 0.08）之外，贯通/不贯通的判据很干净；
       ③ 序参量在 p_c 附近急剧上升（无限点阵 S(p) ∝ (p−p_c)^β，β = 5/36；
          L = 40 时临界区被有限尺寸抹平，所以只断言“急剧上升”，不拟合 β）；
       ④ 任意 p 下都有 S(p) ≤ p（集团只能是占据格点的一部分，逐点严格成立，
          Monte Carlo 平均后只差 ~1/L 量级的统计起伏），且 S(0) = 0、S(1) = 1。
     ========================================================================== */
  var PERC_PC = 0.592746;                       // 方点阵渗流阈值（site percolation）
  var PERC_NOCC = 61;                           // 主图 p 网格点数：p = 0, 1/60, …, 1

  /**
   * 一次渗流实现。
   * 返回 { smax, spanV, spanH, occ, pathV, pathH }；pathV/pathH 仅在 wantPath 时给出
   * （一组格点下标的连通链，用于画贯通路径）。
   */
  function percOnce(L, p, rnd, wantPath) {
    var n = L * L, occ = new Array(n), par = new Array(n), sz = new Array(n), i, x, y;
    for (i = 0; i < n; i++) { occ[i] = rnd() < p ? 1 : 0; par[i] = i; sz[i] = 1; }
    function find(a) { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; }
    function uni(a, b) {
      var ra = find(a), rb = find(b), t;
      if (ra === rb) return;
      if (sz[ra] < sz[rb]) { t = ra; ra = rb; rb = t; }
      par[rb] = ra; sz[ra] += sz[rb];
    }
    for (y = 0; y < L; y++) {
      for (x = 0; x < L; x++) {
        i = y * L + x;
        if (!occ[i]) continue;
        if (x + 1 < L && occ[i + 1]) uni(i, i + 1);
        if (y + 1 < L && occ[i + L]) uni(i, i + L);
      }
    }
    var smax = 0;
    for (i = 0; i < n; i++) { if (!occ[i]) continue; var r = find(i); if (sz[r] > smax) smax = sz[r]; }
    // BFS：vertical = true 时从顶行找一条到底行的链；false 时按转置网格找左→右的链
    function bfs(vertical) {
      var prev = new Array(n), queue = [], qi = 0, s, cx, cy, end = -1, k, id;
      for (k = 0; k < n; k++) prev[k] = -1;
      for (k = 0; k < L; k++) {
        id = vertical ? (0 * L + k) : (k * L + 0);
        if (occ[id]) { prev[id] = id; queue.push(id); }
      }
      while (qi < queue.length) {
        s = queue[qi++];
        cx = s % L; cy = (s - cx) / L;
        if ((vertical && cy === L - 1) || (!vertical && cx === L - 1)) { end = s; break; }
        var nb = [];
        if (cx > 0) nb.push(s - 1);
        if (cx < L - 1) nb.push(s + 1);
        if (cy > 0) nb.push(s - L);
        if (cy < L - 1) nb.push(s + L);
        for (k = 0; k < nb.length; k++) {
          if (occ[nb[k]] && prev[nb[k]] < 0) { prev[nb[k]] = s; queue.push(nb[k]); }
        }
      }
      if (end < 0) return null;
      var path = [], c = end;
      while (true) { path.push(c); if (prev[c] === c) break; c = prev[c]; }
      path.reverse();
      return path;
    }
    var pv = bfs(true), ph = bfs(false);
    return {
      smax: smax / n, spanV: !!pv, spanH: !!ph, occ: occ,
      pathV: (wantPath && pv) ? pv : null, pathH: (wantPath && ph) ? ph : null
    };
  }
  /** 某个 p、L、seed 下 reps 次实现的平均最大集团占比与贯通次数 */
  function percProbe(L, p, seed, reps) {
    var rnd = mulberry32(seed + 1013), acc = 0, sv = 0, sh = 0, k, r;
    for (k = 0; k < reps; k++) {
      r = percOnce(L, p, rnd, false);
      acc += r.smax;
      if (r.spanV) sv++;
      if (r.spanH) sh++;
    }
    return { smax: acc / reps, spanV: sv / reps, spanH: sh / reps };
  }
  /** 重复次数：让 p 扫描的总工作量 ≈ 常数（L 越大重复越少） */
  function percReps(L) {
    return Math.round(clamp(1.2e6 / (PERC_NOCC * L * L), 1, 4));
  }
  /** 把格点集合画成 ising 风格的“蛇形”折线（每行一条，行间连接线很短） */
  function percSnake(L, mark) {
    var x = [], y = [], r, c, i, rx, ry, v;
    for (r = 0; r < L; r++) {
      rx = []; ry = [];
      v = r + 0.5 + 0.4 * (mark(r * L) ? 1 : -1);
      rx.push(0); ry.push(v);
      for (c = 0; c < L; c++) {
        v = r + 0.5 + 0.4 * (mark(r * L + c) ? 1 : -1);
        rx.push(c); ry.push(v);
        rx.push(c + 1); ry.push(v);
      }
      if (r % 2 === 1) { rx.reverse(); ry.reverse(); }
      for (i = 0; i < rx.length; i++) { x.push(rx[i]); y.push(ry[i]); }
    }
    return { x: x, y: y };
  }

  SIM.register("percolation", {
    title: "渗流相变：贯通与最大集团",
    legend: "L×L 方点阵上每个格点以概率 p 独立占据，占据格点按 4 近邻连成集团。" +
      "p 小于阈值 p_c = 0.592746 时最大集团只是些小岛，p 超过它后突然出现横跨整个点阵的" +
      "“贯通集团”（主图的 S(p) 在 p_c 附近陡升）。第二张图是当前 p 的格点位形、" +
      "最大集团与一条真实的贯通路径（按行扫描的蛇形折线：占据=向上）。",
    axes: { xlabel: "占据概率 p", ylabel: "最大集团占比 S = 最大集团格点数 / L²" },
    params: {
      p: { label: "占据概率 p", unit: "", def: 0.6, min: 0, max: 1, step: 0.01 },
      L: { label: "网格边长 L", unit: "", def: 40, min: 10, max: 80, step: 1 },
      seed: { label: "随机种子", unit: "", def: 1, min: 1, max: 9999, step: 1 }
    },
    plots: [
      { key: "smax", label: "最大集团占比 S(p)（多次平均）", color: "#5aa9ff" }
    ],
    compute: function (p) {
      var prob = clamp(num(p.p, 0.6), 0, 1);
      var L = Math.round(clamp(num(p.L, 40), 4, 120));
      var seed = Math.round(clamp(num(p.seed, 1), -1e6, 1e6));
      var reps = percReps(L);

      // 主图：S(p) 随 p（每个 p 用 reps 次独立实现平均）
      var rnd = mulberry32(seed), ps = lin(0, 1, PERC_NOCC), smax = [], k, r, acc;
      for (k = 0; k < PERC_NOCC; k++) {
        acc = 0;
        for (r = 0; r < reps; r++) acc += percOnce(L, ps[k], rnd, false).smax;
        smax.push(acc / reps);
      }

      // 第二张图：当前 p 的位形（另开一条流，避免与主图扫描互相干扰）
      var cfg = percOnce(L, prob, mulberry32(seed + 101), true);
      var all = percSnake(L, function (i) { return cfg.occ[i] === 1; });
      var bigId = new Array(L * L), i2;
      // 最大集团：重新用一次并查集标出（复用 percOnce 的 occ，独立算一遍归属）
      var par = new Array(L * L), szc = new Array(L * L), q, xx, yy, id;
      for (i2 = 0; i2 < L * L; i2++) { par[i2] = i2; szc[i2] = 1; }
      var find2 = function (a) { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
      var uni2 = function (a, b) {
        var ra = find2(a), rb = find2(b), t;
        if (ra === rb) return;
        if (szc[ra] < szc[rb]) { t = ra; ra = rb; rb = t; }
        par[rb] = ra; szc[ra] += szc[rb];
      };
      for (yy = 0; yy < L; yy++) {
        for (xx = 0; xx < L; xx++) {
          id = yy * L + xx;
          if (!cfg.occ[id]) continue;
          if (xx + 1 < L && cfg.occ[id + 1]) uni2(id, id + 1);
          if (yy + 1 < L && cfg.occ[id + L]) uni2(id, id + L);
        }
      }
      var best = -1, bestSize = 0;
      for (i2 = 0; i2 < L * L; i2++) {
        if (!cfg.occ[i2]) continue;
        q = find2(i2);
        if (szc[q] > bestSize) { bestSize = szc[q]; best = q; }
      }
      for (i2 = 0; i2 < L * L; i2++) bigId[i2] = (cfg.occ[i2] && find2(i2) === best) ? 1 : 0;
      var bigSnake = percSnake(L, function (i) { return bigId[i] === 1; });

      var lines = [
        { x: all.x, y: all.y, label: "占据格点（蛇形扫描）", color: "#5aa9ff" },
        { x: bigSnake.x, y: bigSnake.y, label: "最大集团", color: "#ff7b7b" }
      ];
      if (cfg.pathV) {
        var px = [], py = [], t2;
        for (k = 0; k < cfg.pathV.length; k++) {
          t2 = cfg.pathV[k] % L;
          px.push(t2 + 0.5); py.push((cfg.pathV[k] - t2) / L + 0.5);
        }
        lines.push({ x: px, y: py, label: "贯通路径（上→下）", color: "#63d6a5" });
      }

      var info = [
        { k: "方点阵渗流阈值 p_c", v: fmt(PERC_PC, 6) + "（site percolation，已知数值结果）" },
        { k: "当前 p / 相对阈值", v: fmt(prob, 4) + " / " + (prob < PERC_PC ? "低于 p_c" : (prob > PERC_PC ? "高于 p_c" : "正好在 p_c")) },
        { k: "规模与重复", v: L + " × " + L + "（" + fmt(L * L, 0) + " 个格点），曲线每个 p 平均 " + fmt(reps, 0) + " 次（seed = " + seed + "）" },
        { k: "当前位形最大集团占比", v: fmt(cfg.smax, 4) + "（" + fmt(bestSize, 0) + " / " + fmt(L * L, 0) + " 个格点）" },
        { k: "是否贯通", v: (cfg.spanV && cfg.spanH) ? "是（上下贯通 + 左右贯通）" : (cfg.spanV ? "是（上下贯通）" : (cfg.spanH ? "是（左右贯通）" : "否")) },
        { k: "S(p) 在 p = 0 / 0.5 / p_c / 1 处", v: fmt(smax[0], 4) + " / " + fmt(smax[Math.round(0.5 * (PERC_NOCC - 1))], 4) + " / " + fmt(smax[Math.round(PERC_PC * (PERC_NOCC - 1))], 4) + " / " + fmt(smax[PERC_NOCC - 1], 4) },
        { k: "临界指数（教学对照）", v: "无限点阵 S ∝ (p−p_c)^β，β = 5/36 ≈ 0.139（L = 40 的有限尺寸会抹平临界区）" }
      ];
      return {
        t: ps, series: { smax: smax },
        info: info,
        bars: [
          { label: "最大集团占比 S（当前位形）", value: cfg.smax, color: "#ff7b7b" },
          { label: "占据比例 p", value: prob, color: "#5aa9ff" },
          { label: "阈值 p_c", value: PERC_PC, color: "#63d6a5" }
        ],
        extra: {
          lines: lines,
          xlabel: "格点列 x（周期无所谓：开边界，贯通就看上下/左右边界）",
          ylabel: "格点行 y（蛇形折线：占据朝上）",
          title: "当前位形：L = " + L + "，p = " + fmt(prob, 3) +
            "（" + (cfg.spanV || cfg.spanH ? "已贯通" : "未贯通") + "）"
        },
        metrics: {
          L: L, p: prob, seed: seed, reps: reps, pc: PERC_PC,
          curveP: ps, curveS: smax, smax: cfg.smax, spanV: cfg.spanV, spanH: cfg.spanH,
          bestSize: bestSize
        }
      };
    },
    tests: [
      // ① 方点阵渗流阈值 p_c = 0.592746（高精度数值结果，容差 1e-6）
      {
        name: "① 方点阵渗流阈值 p_c = 0.592746",
        params: { p: 0.6, L: 40, seed: 1 },
        measure: function (o) { return o.metrics.pc; },
        expect: 0.592746, tol: 1e-6
      },
      // ② p = p_c − 0.15 = 0.442746（远低于阈值）：40 个种子全部不贯通 ⇒ 贯通比例 = 0
      //    （有限尺寸展宽 ~L^(−3/4) ≈ 0.08，0.15 已在展宽之外；容差 0.2 留足统计余量）
      {
        name: "② p = p_c − 0.15 不贯通（40 个种子的贯通比例 ≈ 0）",
        params: { p: 0.6, L: 40, seed: 1 },
        measure: function (o) {
          var f = 0, s;
          for (s = 0; s < 40; s++) {
            var r = percProbe(40, PERC_PC - 0.15, 1 + s * 131, 1);
            if (r.spanV + r.spanH > 0) f++;
          }
          return f / 40;
        },
        expect: 0, tol: 0.2
      },
      // ③ p = p_c + 0.15 = 0.742746（远高于阈值）：40 个种子全部贯通 ⇒ 贯通比例 = 1
      {
        name: "③ p = p_c + 0.15 贯通（40 个种子的贯通比例 ≈ 1）",
        params: { p: 0.6, L: 40, seed: 1 },
        measure: function (o) {
          var f = 0, s;
          for (s = 0; s < 40; s++) {
            var r = percProbe(40, PERC_PC + 0.15, 1 + s * 131, 1);
            if (r.spanV + r.spanH > 0) f++;
          }
          return f / 40;
        },
        expect: 1, tol: 0.2
      },
      // ④ 最大集团占比在 p_c 附近急剧上升：从画出的 S(p) 曲线取 p_c ± 0.15 最近的两个网格点，
      //    差值 > 0.3（无限点阵在 p_c−0.15 处 S = 0、p_c+0.15 处 S ≈ 0.55）
      {
        name: "④ S(p) 在 p_c 附近急剧上升（ΔS > 0.3）",
        params: { p: 0.6, L: 40, seed: 1 },
        measure: function (o) {
          var s = o.metrics.curveS, ps = o.metrics.curveP, i1 = 0, i2 = 0, i;
          for (i = 0; i < ps.length; i++) {
            if (Math.abs(ps[i] - (PERC_PC - 0.15)) < Math.abs(ps[i1] - (PERC_PC - 0.15))) i1 = i;
            if (Math.abs(ps[i] - (PERC_PC + 0.15)) < Math.abs(ps[i2] - (PERC_PC + 0.15))) i2 = i;
          }
          return (s[i2] - s[i1] > 0.3) ? 1 : 0;
        },
        expect: 1, tol: 0
      },
      // ⑤ 同 seed 完全可重复（自带 mulberry32，不用 Math.random）
      {
        name: "⑤ 同 seed 完全可重复（两次运行逐点一致）",
        params: { p: 0.6, L: 40, seed: 3 },
        measure: function (o, p) {
          var a = percComputeFor(p, 0), b = percComputeFor(p, 0);
          return maxDiff(a.series.smax, b.series.smax);
        },
        expect: 0, tol: 0
      },
      // ⑥ 不同 seed 的曲线必须不同（种子确实在驱动随机数）
      {
        name: "⑥ 不同 seed 给出不同曲线（种子确实驱动随机数）",
        params: { p: 0.6, L: 40, seed: 3 },
        measure: function (o, p) {
          var a = percComputeFor(p, 0), b = percComputeFor(p, 1);
          return maxDiff(a.series.smax, b.series.smax) > 1e-12 ? 1 : 0;
        },
        expect: 1, tol: 0
      },
      // ⑦ 边界：p = 0 时一个格点都不占据（S = 0、不贯通）；p = 1 时全占据（S = 1、贯通）
      {
        name: "⑦ 边界 p = 0 / p = 1：S = 0 不贯通 / S = 1 贯通（精确）",
        params: { p: 0.6, L: 40, seed: 1 },
        measure: function (o) {
          var a = percProbe(40, 0, 1, 1), b = percProbe(40, 1, 1, 1);
          var ok = (a.smax === 0 && a.spanV === 0 && a.spanH === 0) ? 1 : 0;
          ok += (b.smax === 1 && b.spanV === 1 && b.spanH === 1) ? 1 : 0;
          return ok;
        },
        expect: 2, tol: 0
      },
      // ⑧ 解析上界：任意 p 下 S(p) ≤ p（集团只能是占据格点的一部分），
      //    逐点严格成立，平均后只剩 ~1/L 的统计起伏（容差 0.02 覆盖它）
      {
        name: "⑧ 解析上界 S(p) ≤ p（超出量 < 0.02）",
        params: { p: 0.6, L: 40, seed: 1 },
        measure: function (o) {
          var s = o.metrics.curveS, ps = o.metrics.curveP, m = 0, i, d;
          for (i = 0; i < ps.length; i++) { d = s[i] - ps[i]; if (d > m) m = d; }
          return m;
        },
        expect: 0, tol: 0.02
      },
      // ⑨ 边界安全：L = 10 / L = 80、p = 0 / 1、seed 边界都不许 NaN/±∞
      {
        name: "⑨ 边界安全：L = 10/80、p = 0/1、seed = 9999 无 NaN/±∞",
        params: { p: 0.5, L: 10, seed: 9999 },
        measure: function (o, p) {
          var a = percComputeFor({ L: 80, p: 1, seed: 1 }, 0);
          var b = percComputeFor({ L: 10, p: 0, seed: -5 }, 0);
          return (allFinite(o.series.smax) && allFinite(o.t) &&
            allFinite(a.series.smax) && allFinite(b.series.smax)) ? 1 : 0;
        },
        expect: 1, tol: 0
      }
    ]
  });

  /** 以“覆盖若干参数”的方式重跑 percolation 的 compute（自检用；ds 用于改 seed） */
  function percComputeFor(p, ds) {
    return SIM.models.percolation.compute({
      p: p.p, L: p.L, seed: (Math.round(num(p.seed, 1)) + ds)
    });
  }
})(typeof window !== "undefined" ? window : globalThis);
