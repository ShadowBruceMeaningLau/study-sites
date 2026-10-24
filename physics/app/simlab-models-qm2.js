/* ==========================================================================
   simlab-models-qm2.js —— 量子力学（二）仿真模型（5 个）

     perturbation        定态微扰：精确解 vs 一阶/二阶微扰（势阱+δ势 / 谐振子+λx² / 谐振子+λx³）
     variational         变分法与氦原子：E(α) = α² − 2Zα + (5/8)α，最优 α = Z − 5/16
     scattering          散射：卢瑟福微分截面、s 波相移与总截面
     identical-particles 全同粒子：对称/反对称波函数、泡利空穴与交换能
     entanglement        纠缠与贝尔不等式：E(θ_A,θ_B) 与 CHSH 量 S

   ★ 与 simlab.js 相同的约束：**加载时不触碰 DOM**——加载时只调用 SIM.register，
     所有 DOM 操作都由引擎在函数体内完成。这样 tools/verify-simlab.mjs 能在 Node 里
     用 window 桩直接跑 compute() 与 tests 做解析不变量自检。
   ★ 全部确定性：不使用任何随机数；任意滑块取值都不抛异常、不产生 NaN/Infinity。
     奇点都做了显式处理：卢瑟福的 θ→0 截断在 θ_min = 1°、变分的一维 argmin 用抛物线拟合、
     全同粒子 sep→0 时反对称空间态为空（泡利不相容）、贝尔角按 180° 周期归一化。
   ★ 每个模型 tests 的 expect 都是**解析值**（注释里写出公式与代入的数值），measure 尽量
     从返回的 series / metrics / extra.lines 现算。

   单位约定（逐模型写在各自的 legend 里）：
     · perturbation / variational：原子单位（ħ = m = e = 1；长度 a₀、能量 Hartree）
     · scattering：自然单位 ħ = c = 1，能量 MeV、长度 fm（常量见下方，取自 app/constants.js）
     · identical-particles / entanglement：无量纲（长度以波包宽度 σ 为单位、角度以度为单位）
   ========================================================================== */
(function (global) {
  "use strict";
  var SIM = global.SIM;
  if (!SIM) return;                 // 在 Node 里若未先加载 simlab.js，安静退出

  var lin = SIM.linspace, fmt = SIM.fmt, opt = SIM.opt;

  /* ------------------------------------------------------------------ 常量 */
  /* CODATA 2018 值，取自 app/constants.js（本文件在 Node 里被单独加载，所以直接写数值）：
       α      = 7.297 352 5693×10⁻³               精细结构常数（无量纲）
       ħc     = 1.054 571 817×10⁻³⁴ J·s × 2.997 924 58×10⁸ m/s ÷ 1.602 176 634×10⁻¹⁹ J/eV
              = 1.973 269 804×10⁻⁷ eV·m = 197.326 980 4 MeV·fm
       m_pc²  = 938.272 088 MeV                   质子静能（constants.js「质子质量」的换算）
       E_h    = 2 × 13.605 693 124 eV             哈特里能量（constants.js 氢基态能量的 2 倍）
     派生量：
       e²/(4πε₀) = α·ħc = 1.439 964 5474 MeV·fm   （核物理里常写的 1.44 MeV·fm）
       ħ²/(2m_p) = 197.3269804² / (2×938.272088) = 20.749 811 MeV·fm²            */
  var ALPHA_FS = 7.2973525693e-3;
  var HBARC = 197.3269804;                             // MeV·fm
  var ECOUPL = ALPHA_FS * HBARC;                       // 1.4399645474 MeV·fm
  var HBAR2_2MP = (HBARC * HBARC) / (2 * 938.272088);  // 20.749811 MeV·fm²
  var HARTREE_EV = 27.211386248;                       // eV
  var DEG = Math.PI / 180;

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
  /** 取整并夹到 [lo, hi]（滑块/枚举越界也不会崩） */
  function clampInt(v, lo, hi) {
    var n = Math.round(Number(v));
    if (!isFinite(n)) n = lo;
    return n < lo ? lo : (n > hi ? hi : n);
  }
  /** 夹到 [lo, hi]；非有限时取 fallback */
  function clampNum(v, lo, hi, fb) {
    var x = Number(v);
    if (!isFinite(x)) x = fb;
    return x < lo ? lo : (x > hi ? hi : x);
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
  /**
   * 等距采样点上的三点抛物线拟合求极小（被采样的曲线本身就是抛物线时结果精确）。
   * 返回 {x, y}：顶点位置与顶点值；极小落在端点时退回端点值。
   */
  function parabMin(xs, ys) {
    var n = Math.min(xs.length, ys.length), i, best = 0, h, y0, y1, y2, den, d, xv;
    if (n < 3) return { x: xs[0] || 0, y: ys[0] || 0 };
    for (i = 1; i < n; i++) { if (ys[i] < ys[best]) best = i; }
    if (best === 0 || best === n - 1) return { x: xs[best], y: ys[best] };
    h = xs[best + 1] - xs[best];
    y0 = ys[best - 1]; y1 = ys[best]; y2 = ys[best + 1];
    den = y0 - 2 * y1 + y2;
    if (!isFinite(den) || Math.abs(den) < 1e-300 || h === 0) return { x: xs[best], y: y1 };
    d = (h * (y0 - y2)) / (2 * den);              // 顶点相对 xs[best] 的偏移
    if (!isFinite(d)) d = 0;
    if (d > h) d = h; else if (d < -h) d = -h;
    xv = xs[best] + d;
    return { x: xv, y: y1 - (den * d * d) / (2 * h * h) };
  }
  /**
   * 实对称矩阵的循环 Jacobi 对角化，返回**升序**特征值（只求值，不求向量）。
   * 用于谐振子 +λx³ 的"精确"曲线：把 H = p²/2 + x²/2 + λx³ 在截断的谐振子基里
   * 表成实对称矩阵后对角化（λx³ 无解析束缚态解，见该模型 legend 的说明）。
   * 确定性算法、无随机数；N ≤ 32 时每次对角化约 10⁵ 次浮点运算。
   */
  function jacobiEigen(A0, n, sweeps) {
    var A = [], vals = [], i, j, p, q, s, off, apq, theta, t, c, sn, app, aqq, aip, aiq;
    for (i = 0; i < n; i++) A.push(A0[i].slice(0, n));
    for (s = 0; s < sweeps; s++) {
      off = 0;
      for (i = 0; i < n - 1; i++) { for (j = i + 1; j < n; j++) off += A[i][j] * A[i][j]; }
      if (!isFinite(off) || off < 1e-24) break;
      for (p = 0; p < n - 1; p++) {
        for (q = p + 1; q < n; q++) {
          apq = A[p][q];
          if (apq === 0) continue;
          theta = (A[q][q] - A[p][p]) / (2 * apq);
          t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
          if (!isFinite(t)) t = 0;
          c = 1 / Math.sqrt(t * t + 1);
          sn = t * c;
          app = A[p][p]; aqq = A[q][q];
          for (i = 0; i < n; i++) {
            if (i !== p && i !== q) {
              aip = A[i][p]; aiq = A[i][q];
              A[i][p] = c * aip - sn * aiq; A[p][i] = A[i][p];
              A[i][q] = sn * aip + c * aiq; A[q][i] = A[i][q];
            }
          }
          A[p][p] = c * c * app - 2 * c * sn * apq + sn * sn * aqq;
          A[q][q] = sn * sn * app + 2 * c * sn * apq + c * c * aqq;
          A[p][q] = 0; A[q][p] = 0;
        }
      }
    }
    for (i = 0; i < n; i++) vals.push(A[i][i]);
    vals.sort(function (a, b) { return a - b; });
    return vals;
  }

  /* ==========================================================================
     1. perturbation —— 定态微扰：精确解 vs 一阶 / 二阶微扰
     --------------------------------------------------------------------------
     三种可解 / 半可解模型（全部取 ħ = m = ω = 1 或 ħ = m = L = 1）：

     ① 势阱 + δ 势（0 < x < L = 1，微扰 H′ = λδ(x − ½)）
        E_n⁽⁰⁾ = n²π²/2，ψ_n(x) = √2 sin(nπx)
        E_n⁽¹⁾ = λ|ψ_n(½)|² = 2λ sin²(nπ/2) = 2λ（n 奇）、0（n 偶）
        E_n⁽²⁾ = Σ_{m≠n} |V_mn|²/(E_n⁽⁰⁾−E_m⁽⁰⁾) = (8λ²/π²)·Σ_{m 奇≠n} 1/(n²−m²)
                = (8λ²/π²)·(−1/(4n²)) = −2λ²/(π²n²)（n 奇）；0（n 偶）
        （谱求和用部分分式 1/((k−j)(k+j+1)) 裂项后望远镜求和得 −1/(4n²)）
        精确解（偶宇称、n 奇）：x>0 半边 ψ = cos kx + (λ/k)sin kx，ψ(½) = 0 ⇒
                cos u + (λ/(2u))·sin u = 0，u = k/2，E = k²/2 = 2u²，u ∈ (nπ/2, (n+1)π/2)
        小 λ 展开：u = nπ/2 + η，tan η = λ/(2u) ⇒ η = λ/(nπ) − 2λ²/(n³π³) + …，
                代回 E = 2u² 得 E = E_n⁽⁰⁾ + 2λ − 2λ²/(π²n²) + …（与上面的谱求和一致）
        n 偶时 ψ_n(½) = 0，δ 势完全不起作用：E 精确不变。
     ② 谐振子 + λx²：H = p²/2 + (1+2λ)x²/2 ⇒ ω′ = √(1+2λ)，精确 E_n = (n+½)√(1+2λ)
        E_n⁽¹⁾ = λ⟨n|x²|n⟩ = λ(n+½)；E_n⁽²⁾ = −λ²(n+½)/2
        （⟨n+2|x²|n⟩ = √((n+1)(n+2))/2、⟨n−2|x²|n⟩ = √(n(n−1))/2，代入谱求和即得）
     ③ 谐振子 + λx³：奇宇称 ⇒ E_n⁽¹⁾ = λ⟨n|x³|n⟩ = 0
        E_n⁽²⁾ = −λ²(30n²+30n+11)/8
        （x³ = (a+a†)³/(2√2) 的矩阵元：⟨n−1|x³|n⟩ = 3n^{3/2}/(2√2)、
          ⟨n+1|x³|n⟩ = 3(n+1)^{3/2}/(2√2)、⟨n∓3|x³|n⟩ = √(n(n−1)(n−2))/(2√2) 等，
          代入 E⁽²⁾ = Σ|V|²/(E_n−E_m) 化简）
        λx³ 使 V → −∞（x→+∞），严格说没有束缚态；"精确"曲线取**截断谐振子基**
        （N = 28 个态）里对角化的最低若干本征值 —— 小 λ 时它就是教科书微扰能级，
        大 λ 时只是变分意义上的近似（模型里明确标注）。
     ========================================================================== */
  var PB_KINDS = ["势阱+δ势", "谐振子+λx²", "谐振子+λx³"];
  var PB_LAM_MAX = 0.5, PB_NLAM = 41;      // λ 轴：0 … 0.5，41 点（步长 0.0125）
  var PB_BASIS = 28;                       // λx³ 数值对角化的谐振子基组大小

  /** δ 势阱（阱宽 L = 1，δ 在中心）奇 n 情形的精确波数解 u = ka ∈ (nπ/2, (n+1)π/2) */
  function pbBoxHalfRoot(n, lam) {
    var lo = (n * Math.PI) / 2, hi = ((n + 1) * Math.PI) / 2, i, mid, flo, fmid;
    if (!(lam > 1e-14)) return lo;                       // λ = 0 → 未微扰 u = nπ/2
    flo = Math.cos(lo) + (lam / (2 * lo)) * Math.sin(lo);
    for (i = 0; i < 80; i++) {
      mid = 0.5 * (lo + hi);
      fmid = Math.cos(mid) + (lam / (2 * mid)) * Math.sin(mid);
      if (!isFinite(fmid)) break;
      if (flo * fmid <= 0) hi = mid; else { lo = mid; flo = fmid; }
    }
    return 0.5 * (lo + hi);
  }

  /** λx³：截断谐振子基里对角化，返回第 n 个（0 起）本征值 */
  function pbCubicExact(n, lam) {
    var N = PB_BASIS, A = [], i, j, c = 1 / (2 * Math.SQRT2), e, vals;
    for (i = 0; i < N; i++) { A.push([]); for (j = 0; j < N; j++) A[i].push(0); }
    for (i = 0; i < N; i++) A[i][i] = i + 0.5;            // H₀ = p²/2 + x²/2 ⇒ E_n = n + ½
    for (i = 0; i < N; i++) {
      e = lam * c;
      /* ⟨n−1|x³|n⟩ = 3n^{3/2}/(2√2)，⟨n+1|x³|n⟩ = 3(n+1)^{3/2}/(2√2)，
         ⟨n−3|x³|n⟩ = √(n(n−1)(n−2))/(2√2)，⟨n+3|x³|n⟩ = √((n+1)(n+2)(n+3))/(2√2) */
      if (i - 1 >= 0) { A[i - 1][i] += e * 3 * Math.pow(i, 1.5); A[i][i - 1] = A[i - 1][i]; }
      if (i + 1 < N) { A[i + 1][i] += e * 3 * Math.pow(i + 1, 1.5); A[i][i + 1] = A[i + 1][i]; }
      if (i - 3 >= 0) {
        A[i - 3][i] += e * Math.sqrt(i * (i - 1) * (i - 2));
        A[i][i - 3] = A[i - 3][i];
      }
      if (i + 3 < N) {
        A[i + 3][i] += e * Math.sqrt((i + 1) * (i + 2) * (i + 3));
        A[i][i + 3] = A[i + 3][i];
      }
    }
    vals = jacobiEigen(A, N, 12);
    return vals[clampInt(n, 0, N - 1)];
  }

  /** 给定 (kind, n, λ) 返回 {E0, E1, E2, Ex}（E1/E2 是**修正量**，Ex 是精确能级） */
  function pbSolve(kind, n, lam) {
    var E0, odd, e0, g, u;
    if (kind === 0) {
      E0 = (n * n * Math.PI * Math.PI) / 2;
      odd = (n % 2) === 1;
      u = odd ? pbBoxHalfRoot(n, lam) : (n * Math.PI) / 2;
      return {
        E0: E0,
        E1: odd ? 2 * lam : 0,
        E2: odd ? (-2 * lam * lam) / (n * n * Math.PI * Math.PI) : 0,
        Ex: 2 * u * u
      };
    }
    e0 = n + 0.5;
    if (kind === 1) {
      g = Math.sqrt(1 + 2 * lam);
      return { E0: e0, E1: lam * e0, E2: -0.5 * lam * lam * e0, Ex: e0 * g };
    }
    return {
      E0: e0, E1: 0,
      E2: (-(30 * n * n + 30 * n + 11) / 8) * lam * lam,
      Ex: pbCubicExact(n, lam)
    };
  }

  SIM.register("perturbation", {
    title: "定态微扰：精确解 vs 一阶/二阶",
    legend: "三条曲线：精确解、一阶近似 E⁽⁰⁾+E⁽¹⁾、二阶近似 E⁽⁰⁾+E⁽¹⁾+E⁽²⁾，横轴是微扰强度 λ。" +
      "① 势阱+δ势：奇 n 有 E⁽¹⁾ = 2λ、E⁽²⁾ = −2λ²/(π²n²)，偶 n 完全不受影响（δ 落在节点上）；" +
      "② 谐振子+λx²：精确解是 (n+½)√(1+2λ)（频率被重整化）；" +
      "③ 谐振子+λx³：一阶恒为 0（奇宇称），二阶 −λ²(30n²+30n+11)/8；" +
      "λx³ 使势在 x→+∞ 无下界，不存在真正的束缚态，此时的“精确”曲线是截断谐振子基（28 个态）对角化的结果，小 λ 与微扰论一致。",
    axes: { xlabel: "微扰强度 λ", ylabel: "能级 E（ħ=m=ω=1 或 ħ=m=L=1）" },
    params: {
      kind: { label: "微扰模型", type: "enum", options: PB_KINDS, def: 0 },
      n: { label: "态序号 n", unit: "", def: 1, min: 1, max: 4, step: 1 },
      lam: { label: "当前 λ（读数用）", unit: "", def: 0.1, min: 0, max: 0.5, step: 0.01 }
    },
    plots: [
      { key: "exact", label: "精确解 E(λ)", color: "#5aa9ff" },
      { key: "first", label: "一阶 E⁽⁰⁾+E⁽¹⁾", color: "#ffb84d", dash: "6 4" },
      { key: "second", label: "二阶 E⁽⁰⁾+E⁽¹⁾+E⁽²⁾", color: "#63d6a5", dash: "2 3" }
    ],
    compute: function (p) {
      var kind = clampInt(p.kind, 0, 2);
      var n = clampInt(p.n, 1, 4);
      var lamNow = clampNum(p.lam, 0, PB_LAM_MAX, 0.1);
      var lams = lin(0, PB_LAM_MAX, PB_NLAM);
      var ex = [], fi = [], se = [], i, s, unit;
      for (i = 0; i < lams.length; i++) {
        s = pbSolve(kind, n, lams[i]);
        ex.push(s.Ex);
        fi.push(s.E0 + s.E1);
        se.push(s.E0 + s.E1 + s.E2);
      }
      var cur = pbSolve(kind, n, lamNow);
      var idxLast = lams.length - 1;
      var e2cur = cur.E2;
      unit = kind === 0 ? "（ħ=m=L=1，单位 ħ²/mL²）" : "（ħ=m=ω=1，单位 ħω）";
      return {
        t: lams, series: { exact: ex, first: fi, second: se },
        info: [
          { k: "模型 / 态", v: opt(PB_KINDS, kind) + "，n = " + n + unit },
          { k: "未微扰能级 E⁽⁰⁾", v: fmt(cur.E0, 8) },
          { k: "当前 λ 的一阶修正 E⁽¹⁾", v: fmt(cur.E1, 8) + "（精确解 " + fmt(cur.Ex, 8) + "）" },
          { k: "当前 λ 的二阶修正 E⁽²⁾", v: fmt(e2cur, 8) + "（能级总是被拉低：E⁽²⁾ ≤ 0）" },
          { k: "λ = " + fmt(lamNow, 3) + " 处：精确 − 二阶", v: fmt(cur.Ex - (cur.E0 + cur.E1 + e2cur), 8) },
          { k: "λ 轴满量程 λ = 0.5 处：精确 / 一阶 / 二阶", v: fmt(ex[idxLast], 6) + " / " + fmt(fi[idxLast], 6) + " / " + fmt(se[idxLast], 6) },
          { k: "精确解的来源", v: kind === 0 ? "超越方程 cos u + λ sin u/(2u) = 0（u = k/2，E = 2u²）"
            : (kind === 1 ? "频率重整化 ω′ = √(1+2λ) 的解析解" : "截断谐振子基（28 态）数值对角化") }
        ],
        metrics: {
          kind: kind, n: n, lam: lamNow,
          E0: cur.E0, E1: cur.E1, E2: e2cur, Ex: cur.Ex,
          lams: lams, exact: ex, first: fi, second: se
        }
      };
    },
    tests: [
      /* ① λ = 0 时三条曲线都回到未微扰能级（三种模型各一条；E⁽⁰⁾ 用解析值写在注释里） */
      { name: "λ=0：δ 势阱三条曲线都回到 E⁽⁰⁾ = n²π²/2 = π²/2 = 4.9348022（容差 1e-9）",
        params: { kind: 0, n: 1, lam: 0 },
        measure: function (o) {
          var E0 = Math.PI * Math.PI / 2;
          return Math.max(Math.abs(o.series.exact[0] - E0), Math.abs(o.series.first[0] - E0), Math.abs(o.series.second[0] - E0));
        }, expect: 0, tol: 1e-9 },
      { name: "λ=0：谐振子+λx² 三条曲线都回到 E⁽⁰⁾ = n+½ = 1.5（容差 1e-9）",
        params: { kind: 1, n: 1, lam: 0 },
        measure: function (o) {
          return Math.max(Math.abs(o.series.exact[0] - 1.5), Math.abs(o.series.first[0] - 1.5), Math.abs(o.series.second[0] - 1.5));
        }, expect: 0, tol: 1e-9 },
      { name: "λ=0：谐振子+λx³ 三条曲线都回到 E⁽⁰⁾ = n+½ = 1.5（对角化基组在 λ=0 是严格对角的）",
        params: { kind: 2, n: 1, lam: 0 },
        measure: function (o) {
          return Math.max(Math.abs(o.series.exact[0] - 1.5), Math.abs(o.series.first[0] - 1.5), Math.abs(o.series.second[0] - 1.5));
        }, expect: 0, tol: 1e-9 },
      /* ② 谐振子+λx² 的一阶修正 E⁽¹⁾ = λ⟨x²⟩ = λ(n+½)：λ=0.5、n=1 ⇒ 0.5×1.5 = 0.75 */
      { name: "谐振子+λx²：E⁽¹⁾ = λ⟨n|x²|n⟩ = λ(n+½) = 0.75（λ=0.5, n=1，容差 1e-9）",
        params: { kind: 1, n: 1, lam: 0.5 },
        measure: function (o) { return o.series.first[o.t.length - 1] - o.series.first[0]; },
        expect: 0.75, tol: 1e-9 },
      /* 二阶修正 E⁽²⁾ = −λ²(n+½)/2：0.25×1.5/2 = 0.1875 */
      { name: "谐振子+λx²：E⁽²⁾ = −λ²(n+½)/2 = −0.1875（λ=0.5, n=1，容差 1e-9）",
        params: { kind: 1, n: 1, lam: 0.5 },
        measure: function (o) { var k = o.t.length - 1; return o.series.second[k] - o.series.first[k]; },
        expect: -0.1875, tol: 1e-9 },
      /* ③ 基态（本模型可选的最低态 n=1）的二阶修正处处 ≤ 0：变分论证 E⁽²⁾ = Σ|V_mn|²/(E_n−E_m) ≤ 0 */
      { name: "二阶修正处处 ≤ 0（λx³, n=1：整条曲线 max = 0，容差 1e-12）",
        params: { kind: 2, n: 1, lam: 0.5 },
        measure: function (o) {
          var m = 0, i, v;
          for (i = 0; i < o.t.length; i++) { v = o.series.second[i] - o.series.first[i]; if (v > m) m = v; }
          return m;
        }, expect: 0, tol: 1e-12 },
      { name: "二阶修正处处 ≤ 0（谐振子+λx², n=1 同样成立，容差 1e-12）",
        params: { kind: 1, n: 1, lam: 0.5 },
        measure: function (o) {
          var m = 0, i, v;
          for (i = 0; i < o.t.length; i++) { v = o.series.second[i] - o.series.first[i]; if (v > m) m = v; }
          return m;
        }, expect: 0, tol: 1e-12 },
      /* ④ λx³ 一阶修正恒为 0（奇宇称：⟨n|x³|n⟩ = 0） */
      { name: "谐振子+λx³：一阶修正恒为 0（n=2 整条曲线，容差 1e-12）",
        params: { kind: 2, n: 2, lam: 0.5 },
        measure: function (o) {
          var d = 0, i, v;
          for (i = 0; i < o.t.length; i++) { v = Math.abs(o.series.first[i] - o.series.first[0]); if (v > d) d = v; }
          return d;
        }, expect: 0, tol: 1e-12 },
      /* 二阶修正 E⁽²⁾ = −λ²(30n²+30n+11)/8：n=1、λ=0.5 ⇒ −71/8×0.25 = −2.21875 */
      { name: "谐振子+λx³：E⁽²⁾ = −λ²(30n²+30n+11)/8 = −2.21875（λ=0.5, n=1，容差 1e-9）",
        params: { kind: 2, n: 1, lam: 0.5 },
        measure: function (o) { var k = o.t.length - 1; return o.series.second[k] - o.series.first[k]; },
        expect: -2.21875, tol: 1e-9 },
      /* ⑤ 小 λ 时 |E_exact − (E⁽⁰⁾+E⁽¹⁾)| ∝ λ²：用 log–log 斜率测有效幂指数
         λ₁ = 0.0125（下标 1）、λ₂ = 0.025（下标 2），比值 4 ⇒ 纯 λ² 时斜率 = 2；
         λ³ 项让斜率略小于 2（解析：(1+2λ)^{1/2} = 1 + λ − λ²/2 + λ³/2 − … ⇒ 斜率 ≈ 1.983） */
      { name: "小 λ：|E_exact − (E⁽⁰⁾+E⁽¹⁾)| ∝ λ²（有效幂指数 → 2，λ∈[0.0125,0.025]，容差 0.05）",
        params: { kind: 1, n: 1, lam: 0.5 },
        measure: function (o) {
          var d1 = Math.abs(o.series.exact[1] - o.series.first[1]);
          var d2 = Math.abs(o.series.exact[2] - o.series.first[2]);
          if (!(d1 > 0) || !(d2 > 0)) return NaN;
          return Math.log(d2 / d1) / Math.log(o.t[2] / o.t[1]);
        }, expect: 2, tol: 0.05 },
      /* 数值对角化的独立校验：λ = 1e-4 时 E_exact 必须复现二阶微扰 E⁽⁰⁾ + E⁽²⁾λ²（λ³ 项 ~1e-9） */
      { name: "λx³ 数值解在小 λ 下复现二阶微扰：|E_exact − (1.5 − 8.875×10⁻⁸)| < 1e-7（λ=1e-4）",
        params: { kind: 2, n: 1, lam: 0.0001 },
        measure: function (o) {
          var want = 1.5 + (-(30 + 30 + 11) / 8) * 1e-8;      // E⁽⁰⁾ + E⁽²⁾λ²
          return Math.abs(o.series.exact[nearestIndex(o.t, 0.0001)] - want);
        }, expect: 0, tol: 1e-7 },
      /* δ 势的能级选择性：奇 n 的一阶修正 = 2λ（λ=0.5 ⇒ 1），偶 n 恒为 0 */
      { name: "势阱+δ势：奇 n=3 的一阶修正 = 2λ = 1（容差 1e-9）",
        params: { kind: 0, n: 3, lam: 0.5 },
        measure: function (o) { return o.series.first[o.t.length - 1] - o.series.first[0]; },
        expect: 1, tol: 1e-9 },
      { name: "势阱+δ势：偶 n=2 完全不受 δ 势影响（一阶修正恒 0，容差 1e-12）",
        params: { kind: 0, n: 2, lam: 0.5 },
        measure: function (o) {
          var d = 0, i, v;
          for (i = 0; i < o.t.length; i++) { v = Math.abs(o.series.first[i] - o.series.first[0]); if (v > d) d = v; }
          return d;
        }, expect: 0, tol: 1e-12 },
      /* δ 势的二阶修正 −2λ²/(π²n²)：n=1、λ=0.5 ⇒ −0.5/π² = −0.0506605918 */
      { name: "势阱+δ势：E⁽²⁾ = −2λ²/(π²n²) = −0.0506605918（n=1, λ=0.5，容差 1e-9）",
        params: { kind: 0, n: 1, lam: 0.5 },
        measure: function (o) { var k = o.t.length - 1; return o.series.second[k] - o.series.first[k]; },
        expect: -0.0506605918, tol: 1e-9 }
    ]
  });

  /* ==========================================================================
     2. variational —— 变分法与氦原子
     --------------------------------------------------------------------------
     试探波函数 ψ(r₁,r₂) = (α³/π)·e^{−αr₁}e^{−αr₂}（原子单位 ħ = m = e = 1，长度 a₀）
     能量有闭式（教科书结果，**不需要数值解薛定谔方程**）：
         ⟨T⟩ = α²（两个电子各 α²/2）
         ⟨V_ne⟩ = −2Zα（两个电子各 −Zα）
         ⟨V_ee⟩ = (5/8)α
         E(α) = α² − 2Zα + (5/8)α
     极小：dE/dα = 2α − 2Z + 5/8 = 0 ⇒ α* = Z − 5/16，E_min = −(Z − 5/16)²
         Z = 2（氦）：α* = 1.6875，E_min = −2.84765625 Hartree = −77.49 eV
         精确（非相对论）值 −2.9037 Hartree = −79.01 eV ⇒ 变分高 1.9%（变分原理保证不低于真值）
         维里定理：2⟨T⟩ + ⟨V⟩ = 0 恰好在 α* 处成立（2α*² = 2Zα* − (5/8)α* ⇒ α* = Z − 5/16）
     单电子（氢型）分支 ψ ∝ e^{−αr}：E₁(α) = α²/2 − Zα，最优 α = Z，E₁min = −Z²/2
         Z = 1 ⇒ α* = 1、E = −0.5 Hartree = −13.6057 eV（试探函数对氢是精确的）
     注意两电子与单电子的差别：氦型公式的最优 α 是 Z − 5/16（Z=1 的 H⁻ 给 0.6875），
     而单电子氢原子才是 α = Z = 1；两者都在读数里给出。
     ========================================================================== */
  var VA_A_MIN = 0.5, VA_A_MAX = 3, VA_NA = 501;   // α 轴：0.5 … 3，501 点（步长 0.005）

  /** 氦型试探函数的能量（Hartree）：E(α) = α² − 2Zα + (5/8)α */
  function vaE(alpha, Z) { return alpha * alpha - 2 * Z * alpha + 0.625 * alpha; }
  /** 单电子（氢型）试探函数的能量：E₁(α) = α²/2 − Zα */
  function vaE1(alpha, Z) { return 0.5 * alpha * alpha - Z * alpha; }

  SIM.register("variational", {
    title: "变分法与氦原子",
    legend: "试探波函数 ψ = (α³/π)e^{−αr₁}e^{−αr₂}（原子单位，长度 a₀、能量 Hartree）。" +
      "E(α) = α² − 2Zα + (5/8)α 是闭式解析式：α² 是动能、−2Zα 是核吸引、(5/8)α 是电子排斥。" +
      "极小给出 α* = Z − 5/16（氦 Z=2 → 1.6875）、E_min = −(Z−5/16)² = −2.84765625 Hartree，" +
      "比精确值 −2.9037 Hartree 高 1.9% —— 变分原理保证它永远不低于真值。" +
      "读数里还给出单电子（氢型）分支：ψ ∝ e^{−αr} 时 α* = Z、E = −Z²/2（Z=1 即 −0.5 Hartree = −13.6057 eV，恰好精确）。",
    axes: { xlabel: "试探参数 α（a₀⁻¹）", ylabel: "E(α)（Hartree）" },
    params: {
      Z: { label: "核电荷 Z", unit: "", def: 2, min: 1, max: 3, step: 0.1 },
      alpha: { label: "试探参数 α", unit: "a₀⁻¹", def: 1.6875, min: VA_A_MIN, max: VA_A_MAX, step: 0.01 }
    },
    plots: [
      { key: "E", label: "E(α) = α² − 2Zα + (5/8)α（Hartree）", color: "#5aa9ff" }
    ],
    compute: function (p) {
      var Z = clampNum(p.Z, 1, 3, 2);
      var alphas = lin(VA_A_MIN, VA_A_MAX, VA_NA);
      var E = [], E1 = [], i, vmin, vmin1, aStar, eStar, ev;
      for (i = 0; i < alphas.length; i++) { E.push(vaE(alphas[i], Z)); E1.push(vaE1(alphas[i], Z)); }
      vmin = parabMin(alphas, E);            // 数值 argmin（三点抛物线拟合，对抛物线精确）
      vmin1 = parabMin(alphas, E1);
      aStar = Z - 0.3125;                    // 解析最优 α = Z − 5/16
      eStar = -aStar * aStar;                // 解析 E_min = −(Z − 5/16)²
      ev = vaE(vmin.x, Z);
      var alphaNow = clampNum(p.alpha, VA_A_MIN, VA_A_MAX, 1.6875);
      var rGrid = lin(0, 6, 241), r = [], pCur = [], pOpt = [], aNow, aOpt;
      aNow = alphaNow;
      aOpt = clampNum(aStar, 0.05, 20, 1);
      for (i = 0; i < rGrid.length; i++) {
        r.push(rGrid[i]);
        /* 径向概率密度 P(r) = 4πr²|ψ|² = 4α³r²e^{−2αr}（∫P dr = 1，峰在 r = 1/α） */
        pCur.push(4 * aNow * aNow * aNow * rGrid[i] * rGrid[i] * Math.exp(-2 * aNow * rGrid[i]));
        pOpt.push(4 * aOpt * aOpt * aOpt * rGrid[i] * rGrid[i] * Math.exp(-2 * aOpt * rGrid[i]));
      }
      var Tv = vmin.x * vmin.x, Vv = -2 * Z * vmin.x + 0.625 * vmin.x;
      return {
        t: alphas, series: { E: E },
        info: [
          { k: "模型 / 核电荷 Z", v: "氦型试探函数 ψ = (α³/π)e^{−αr₁}e^{−αr₂}，Z = " + fmt(Z, 3) },
          { k: "当前 α = " + fmt(alphaNow, 4) + " 的能量", v: fmt(vaE(alphaNow, Z), 8) + " Hartree = " + fmt(vaE(alphaNow, Z) * HARTREE_EV, 6) + " eV" },
          { k: "曲线极小（三点抛物线拟合）", v: "α = " + fmt(vmin.x, 6) + "，E = " + fmt(ev, 8) + " Hartree" },
          { k: "解析最优 α = Z − 5/16", v: fmt(aStar, 6) + "（Z=2 时 1.6875；Z=1 时 0.6875 对应 H⁻）" },
          { k: "解析 E_min = −(Z−5/16)²", v: fmt(eStar, 8) + " Hartree = " + fmt(eStar * HARTREE_EV, 6) + " eV" },
          { k: "单电子（氢型 ψ ∝ e^{−αr}）", v: "最优 α = " + fmt(vmin1.x, 6) + "（= Z），E_min = " + fmt(vmin1.y, 8) + " Hartree = " + fmt(vmin1.y * HARTREE_EV, 6) + " eV" },
          { k: "与精确值对照（Z = 2）", v: "变分 −2.84765625，非相对论精确 −2.9037 Hartree（−79.01 eV），差 0.056 Ha ≈ 1.9%" },
          { k: "维里定理 2⟨T⟩+⟨V⟩（在最优 α 处）", v: fmt(2 * Tv + Vv, 8) + "（应恒为 0）" }
        ],
        metrics: {
          Z: Z, alpha: alphaNow,
          alphaOpt: vmin.x, Emin: ev, EminAnalytic: eStar,
          alphaOpt1e: vmin1.x, Emin1e: vmin1.y,
          alphaStar: aStar, Tv: Tv, Vv: Vv
        },
        extra: {
          title: "径向试探波函数：P(r) = 4πr²|ψ|² = 4α³r²e^{−2αr}（峰在 r = 1/α）",
          xlabel: "r（a₀）", ylabel: "P(r)",
          lines: [
            { x: r, y: pCur, label: "当前 α = " + fmt(aNow, 3), color: "#5aa9ff" },
            { x: r, y: pOpt, label: "最优 α* = " + fmt(aOpt, 3), color: "#ffb84d", dash: "5 4" }
          ]
        }
      };
    },
    tests: [
      /* ① E(α) = α² − 2Zα + (5/8)α：整条曲线逐点比对（解析式即判据） */
      { name: "E(α) = α² − 2Zα + (5/8)α（Z=2 整条曲线，容差 1e-9）",
        params: { Z: 2 },
        measure: function (o, p) {
          var Z = p.Z, d = 0, i, v;
          for (i = 0; i < o.t.length; i++) {
            v = Math.abs(o.series.E[i] - (o.t[i] * o.t[i] - 2 * Z * o.t[i] + 0.625 * o.t[i]));
            if (v > d) d = v;
          }
          return d;
        }, expect: 0, tol: 1e-9 },
      /* ② 氦（Z=2）最优 α = Z − 5/16 = 1.6875，由曲线数值 argmin 现算 */
      { name: "Z=2 最优 α = Z − 5/16 = 1.6875（曲线 argmin，容差 1e-6）",
        params: { Z: 2 },
        measure: function (o) { return o.metrics.alphaOpt; }, expect: 1.6875, tol: 1e-6 },
      /* ③ E_min = −(Z−5/16)² = −2.84765625（顶点值，由曲线三点拟合给出） */
      { name: "Z=2：E_min = −(Z−5/16)² = −2.84765625（容差 1e-9）",
        params: { Z: 2 },
        measure: function (o) { return o.metrics.Emin; }, expect: -2.84765625, tol: 1e-9 },
      /* 采样点上的最小值与顶点之差 ≤ (Δα/2)² = 0.0025² = 6.25e-6 */
      { name: "曲线上的最小采样值 ≥ E_min，且差 < 1e-5（步长 0.005 的离散化间隙）",
        params: { Z: 2 },
        measure: function (o) { return minOf(o.series.E) - o.metrics.Emin; }, expect: 0, tol: 1e-5 },
      /* ④ 单电子（氢型）分支：最优 α = Z = 1（Z=1），E_min = −Z²/2 = −0.5 Hartree */
      { name: "氢型（单电子 ψ ∝ e^{−αr}）：Z=1 最优 α = Z = 1（容差 1e-6）",
        params: { Z: 1 },
        measure: function (o) { return o.metrics.alphaOpt1e; }, expect: 1, tol: 1e-6 },
      { name: "氢型：Z=1 的 E_min = −Z²/2 = −0.5 Hartree = −13.6057 eV（容差 1e-9）",
        params: { Z: 1 },
        measure: function (o) { return o.metrics.Emin1e; }, expect: -0.5, tol: 1e-9 },
      /* ⑤ 变分原理：E_min(Z=2) = −2.84765625 不低于真值 −2.9037 ⇒ 差值 = 0.05604375 ≥ 0 */
      { name: "变分能量不低于真值：E_min − (−2.9037) = 0.05604375（容差 1e-6）",
        params: { Z: 2 },
        measure: function (o) { return o.metrics.Emin + 2.9037; }, expect: 0.05604375, tol: 1e-6 },
      /* 维里定理：在 α = α* 处 2⟨T⟩ + ⟨V⟩ = 0（这正是 dE/dα = 0 的条件） */
      { name: "维里定理：最优 α 处 2⟨T⟩ + ⟨V⟩ = 0（容差 1e-12）",
        params: { Z: 2 },
        measure: function (o) { return 2 * o.metrics.Tv + o.metrics.Vv; }, expect: 0, tol: 1e-12 },
      /* Z 依赖：α* = Z − 5/16 对 Li⁺（Z=3）给 2.6875 */
      { name: "Z=3（Li⁺）：最优 α = Z − 5/16 = 2.6875（容差 1e-6）",
        params: { Z: 3 },
        measure: function (o) { return o.metrics.alphaOpt; }, expect: 2.6875, tol: 1e-6 }
    ]
  });

  /* ==========================================================================
     3. scattering —— 散射理论：卢瑟福 / 方势垒（s 波）/ 硬球（s 波）
     --------------------------------------------------------------------------
     单位：自然单位 ħ = c = 1，能量 MeV、长度 fm。
       e²/(4πε₀) = α·ħc = 1.4399645474 MeV·fm（核物理常用的 1.44 MeV·fm）
       ħ²/(2m_p) = 20.749811 MeV·fm² ⇒ k[fm⁻¹] = √(E[MeV]/20.7498)（取质子质量）
       内部常数：硬球半径 a = 1 fm；方势垒高度 V₀ = 5 MeV、半径 a = 1 fm
       1 fm² = 10 mb（1 barn = 100 fm²）

     ① 卢瑟福（Zz = Z₁Z₂，取 e² 为库仑常量）
        dσ/dΩ = (Z₁Z₂e²/(4E))²/sin⁴(θ/2) = K/sin⁴(θ/2)，K = (Z₁Z₂e²/4E)²
        碰撞参数 b = a·cot(θ/2)，最近距离 r_min = a(1 + csc(θ/2))，a = Z₁Z₂e²/(2E)
        θ→0 时 dσ/dΩ 发散（库仑力是长程力）：横轴与滑块都截断在 θ_min = 1°。
        截断总截面 σ(θ≥θ_min) = ∫(dσ/dΩ)dΩ = 4πK·cot²(θ_min/2) = πb_max²
        （换元 v = cot(θ/2) 后被积函数化成 8πK·v，梯形/中点法在机器精度内等于解析值）
     ② 方势垒（s 波）：外区 u = sin(kr+δ₀)，内区 u = A·sin(Kr)（E>V₀）或 A·sinh(κr)（E<V₀），
        对数导数匹配 ⇒ cot(ka+δ₀) = C，C = (K/k)cot(Ka) 或 (κ/k)coth(κa)，
        δ₀ = atan2(1, C) − ka（分支取 δ₀ 随 k→0 连续趋于 0 的那一支）
        E→0 时 κ→κ₀ = √(2mV₀)/ħ = 0.49088293 fm⁻¹ 有限 ⇒ C ∝ 1/k
        ⇒ δ₀ ≈ k·a_eff → 0，散射长度 a_eff = tanh(κ₀a)/κ₀ − a = −0.07326799 fm
        但低能总截面**不趋于 0**：σ = 4π sin²δ₀/k² 里 δ₀ ∝ k 与分母 k² 恰好抵消，
        σ → 4πa_eff² = 0.067458779 fm²（= 0.674588 mb，有限非零；|a_eff| ≪ a = 1 fm）
     ③ 硬球（s 波）：δ₀ = −ka；低能总截面 σ = 4π sin²δ₀/k² → 4πa²（s 波极限）
        两种 s 波情形只保留 ℓ=0 分波，所以 dσ/dΩ = sin²δ₀/k² 各向同性；
        低能时高 partial wave 被 (ka)^{2ℓ} 压制，s 波就是全截面。
     ========================================================================== */
  var SC_KINDS = ["卢瑟福散射", "方势垒（s 波）", "硬球（s 波）"];
  var SC_A_SPHERE = 1;        // fm，硬球半径 / 方势垒半径
  var SC_V0 = 5;              // MeV，方势垒高度（滑块不给，模型内部常数）
  var SC_THETA_MIN = 1;       // °，θ 轴与滑块的下截断（避开卢瑟福的 θ→0 发散）

  /** 波数 k = √(2mE)/ħ = √(E/20.749811)（fm⁻¹，E 以 MeV 计） */
  function scK(E) { return Math.sqrt(Math.max(E, 0) / HBAR2_2MP); }

  /** s 波相移 δ₀（弧度）：kind = 1 方势垒、2 硬球 */
  function scDelta0(kind, E) {
    var k = scK(E), a = SC_A_SPHERE, C, dE;
    if (kind === 2) return -k * a;                       // 硬球：u(a) = 0 ⇒ δ₀ = −ka
    dE = E - SC_V0;
    if (Math.abs(dE) < 1e-12) {
      C = 1 / (k * a);                                   // E = V₀：内区 u = A·r，u′/u = 1/a
    } else if (dE > 0) {
      var Kb = Math.sqrt(dE / HBAR2_2MP);
      C = (Kb / k) * Math.cos(Kb * a) / Math.sin(Kb * a); // (K/k)cot(Ka)
    } else {
      var kb = Math.sqrt(-dE / HBAR2_2MP);
      C = (kb / k) * Math.cosh(kb * a) / Math.sinh(kb * a); // (κ/k)coth(κa)
    }
    if (!isFinite(C)) C = 0;
    return Math.atan2(1, C) - k * a;
  }

  /**
   * 卢瑟福截断总截面（数值）：σ = 2π∫f(θ)sinθ dθ，换元 v = cot(θ/2) 后
   * 被积函数化为 8πK·v（线性），中点法在机器精度内给出 4πK·cot²(θ_min/2)。
   */
  function scRuthSigmaNumeric(K, thetaMinDeg) {
    var vmax = 1 / Math.tan(0.5 * clampNum(thetaMinDeg, 1e-6, 179.9, 1) * DEG);
    var n = 2000, h = vmax / n, s = 0, i, v;
    for (i = 0; i < n; i++) { v = (i + 0.5) * h; s += 8 * Math.PI * K * v * h; }
    return s;
  }

  /** s 波径向波函数 u(r) = rR(r)（外区振幅归一，r ≥ a 与内区在 r = a 连续） */
  function scRadial(kind, E, r) {
    var k = scK(E), a = SC_A_SPHERE, d = scDelta0(kind, E), dE = E - SC_V0, A, Kb, kb;
    if (r <= a) {
      if (kind === 2) return 0;                                  // 硬球内部恒为 0
      if (Math.abs(dE) < 1e-12) A = Math.sin(k * a + d) / a;     // 内区 u = A·r
      else if (dE > 0) {
        Kb = Math.sqrt(dE / HBAR2_2MP);
        A = Math.sin(Kb * a) !== 0 ? Math.sin(k * a + d) / Math.sin(Kb * a) : 0;
        return A * Math.sin(Kb * r);
      } else {
        kb = Math.sqrt(-dE / HBAR2_2MP);
        A = Math.sinh(kb * a) !== 0 ? Math.sin(k * a + d) / Math.sinh(kb * a) : 0;
        return A * Math.sinh(kb * r);
      }
      return A * r;
    }
    return Math.sin(k * r + d);
  }

  SIM.register("scattering", {
    title: "散射：卢瑟福与 s 波相移",
    legend: "自然单位 ħ=c=1，能量 MeV、长度 fm，e²/4πε₀ = 1.4399645 MeV·fm。" +
      "① 卢瑟福 dσ/dΩ = (Z₁Z₂e²/4E)²/sin⁴(θ/2)：θ→0 发散（长程库仑力），所以 θ 从 1° 起截断，" +
      "总截面只能给截断值 σ(θ≥1°) = πb_max²；② 方势垒（高 5 MeV、半径 1 fm）与 ③ 硬球（半径 1 fm）" +
      "只保留 ℓ=0 分波，dσ/dΩ = sin²δ₀/k² 各向同性，低能极限硬球截面 → 4πa² = 12.5664 fm²。" +
      "s 波两种情形与 Z₁Z₂ 无关（它们不含库仑项）。",
    axes: { xlabel: "散射角 θ（°）", ylabel: "dσ/dΩ（fm²/sr）" },
    params: {
      kind: { label: "散射类型", type: "enum", options: SC_KINDS, def: 0 },
      E: { label: "能量 E", unit: "MeV", def: 1, min: 0.1, max: 10, step: 0.1 },
      Zz: { label: "Z₁Z₂（仅卢瑟福用）", unit: "", def: 1, min: 1, max: 10, step: 1 },
      theta: { label: "读数角 θ", unit: "°", def: 60, min: SC_THETA_MIN, max: 180, step: 1 }
    },
    plots: [
      { key: "dsigma", label: "dσ/dΩ(θ)", color: "#5aa9ff" }
    ],
    compute: function (p) {
      var kind = clampInt(p.kind, 0, 2);
      var E = clampNum(p.E, 1e-9, 1e4, 1);
      var Zz = clampNum(p.Zz, 0, 200, 1);
      var thNow = clampNum(p.theta, SC_THETA_MIN, 180, 60);
      /* θ 轴：1° … 180°，359 点 ⇒ 步长恰为 0.5°，60°/90°/180° 都落在采样点上 */
      var thetas = lin(SC_THETA_MIN, 180, 359), i, th;
      var ds = [], k = scK(E), d0 = 0, info = [], extra = null, metrics;
      var K = Math.pow((Zz * ECOUPL) / (4 * E), 2);
      var aC = (Zz * ECOUPL) / (2 * E);
      for (i = 0; i < thetas.length; i++) ds.push(0);
      if (kind === 0) {
        for (i = 0; i < thetas.length; i++) {
          th = thetas[i] * DEG;
          ds[i] = K / Math.pow(Math.sin(th / 2), 4);
        }
        var sigma = scRuthSigmaNumeric(K, SC_THETA_MIN);
        var bMax = aC / Math.tan(0.5 * SC_THETA_MIN * DEG);
        var bNow = aC / Math.tan(0.5 * thNow * DEG);
        var rMin = aC * (1 + 1 / Math.sin(0.5 * thNow * DEG));
        var dsNow = K / Math.pow(Math.sin(0.5 * thNow * DEG), 4);
        info = [
          { k: "模型 / 单位", v: "卢瑟福散射，自然单位 ħ=c=1（MeV, fm），e²/4πε₀ = " + fmt(ECOUPL, 7) + " MeV·fm" },
          { k: "θ = " + fmt(thNow, 3) + "° 处 dσ/dΩ", v: fmt(dsNow, 8) + " fm²/sr = " + fmt(dsNow * 10, 6) + " mb/sr" },
          { k: "库仑参数 a = Z₁Z₂e²/(2E)", v: fmt(aC, 6) + " fm（Z₁Z₂ = " + fmt(Zz, 3) + "，E = " + fmt(E, 4) + " MeV）" },
          { k: "碰撞参数 b = a·cot(θ/2)", v: fmt(bNow, 6) + " fm（θ→0 时 b→∞，权重 ∝ b² ⇒ 截面发散）" },
          { k: "最近距离 r_min = a(1+csc(θ/2))", v: fmt(rMin, 6) + " fm（θ=180° 时 r_min = Z₁Z₂e²/E = " + fmt(2 * aC, 6) + " fm）" },
          { k: "截断总截面 σ(θ≥1°)", v: fmt(sigma, 4) + " fm² = " + fmt(sigma / 100, 6) + " barn（= πb_max²，b_max = " + fmt(bMax, 4) + " fm）" },
          { k: "完整库仑总截面", v: "θ_min→0 时 σ ≈ 16πK/θ_min² → ∞（长程力，无有限总截面）" }
        ];
        /* 双曲线轨道：u = 1/r = (a/b²)cosφ + (1/b)sinφ − a/b²，φ ∈ (0, π−θ)，
           最近点在 φ = π/2 − θ/2；把 r 限制在 R_max 以内（渐近线附近 r → ∞ 会毁掉坐标尺度） */
        var b = bNow, Rmax = 3 * (b + rMin) + aC, ox = [], oy = [], phi, rr, uu, npts = 600;
        for (i = 0; i <= npts; i++) {
          phi = 1e-4 + (Math.PI - thNow * DEG - 2e-4) * (i / npts);
          uu = (aC / (b * b)) * Math.cos(phi) + (1 / b) * Math.sin(phi) - aC / (b * b);
          if (!(Math.abs(uu) > 1e-12)) continue;
          rr = 1 / uu;
          if (!isFinite(rr) || rr > Rmax || rr <= 0) continue;
          ox.push(rr * Math.cos(phi)); oy.push(rr * Math.sin(phi));
        }
        /* θ→180°（正碰，b→0）或 Z₁Z₂ = 0 时双曲线退化为直线：给一条沿轴的直线，保证有曲线可画 */
        if (ox.length < 2) {
          var Lax = 2 * (aC + rMin) + 1;
          ox = [-Lax, -0.02 * Lax, 0.02 * Lax, Lax];
          oy = [0, 0, 0, 0];
        }
        extra = {
          title: "散射轨道：双曲线（原点为散射中心，θ = " + fmt(thNow, 3) + "°" +
            (b * 1e12 < aC ? "；b→0 时退化为沿轴直线" : "") + "）",
          xlabel: "x（fm）", ylabel: "y（fm）",
          lines: [{ x: ox, y: oy, label: "轨道 r(φ)", color: "#63d6a5" }]
        };
        metrics = { kind: kind, E: E, Zz: Zz, theta: thNow, K: K, a: aC, b: bNow, rmin: rMin, sigma: sigma, k: k, delta0: 0, dsigmaTheta: dsNow };
      } else {
        d0 = scDelta0(kind, E);
        var iso = Math.pow(Math.sin(d0) / k, 2);
        for (i = 0; i < thetas.length; i++) ds[i] = iso;
        var sig = 4 * Math.PI * iso;
        var kappa = kind === 1 && E < SC_V0 ? Math.sqrt((SC_V0 - E) / HBAR2_2MP) : 0;
        info = [
          { k: "模型 / 内部常数", v: opt(SC_KINDS, kind) + "：半径 a = 1 fm" + (kind === 1 ? "，高度 V₀ = 5 MeV" : "（硬球）") },
          { k: "波数 k = √(E/20.7498)", v: fmt(k, 8) + " fm⁻¹（ħ²/2m_p = " + fmt(HBAR2_2MP, 4) + " MeV·fm²，E = " + fmt(E, 4) + " MeV）" },
          { k: "s 波相移 δ₀", v: fmt(d0, 8) + " rad = " + fmt(d0 / DEG, 4) + "°（" + (d0 < 0 ? "排斥 ⇒ 负相移" : "吸引 ⇒ 正相移") + "）" },
          { k: "无量纲参数", v: "ka = " + fmt(k * SC_A_SPHERE, 6) + (kind === 1 ? "，κa = " + fmt(kappa * SC_A_SPHERE, 6) + "（E<V₀ 时的衰减常数）" : "") },
          { k: "总截面 σ = 4π sin²δ₀/k²", v: fmt(sig, 8) + " fm² = " + fmt(sig * 10, 6) + " mb" },
          { k: "低能极限", v: kind === 2 ? "σ → 4πa² = 12.5663706 fm² = 125.66 mb（s 波极限）"
            : "δ₀ ≈ k·a_eff ∝ k → 0，但 σ = 4π sin²δ₀/k² 中 δ₀ ∝ k 与分母 k² 抵消 ⇒ " +
              "σ → 4πa_eff² = 0.067458779 fm² = 0.674588 mb（**有限非零，不是 0**；" +
              "a_eff = tanh(κ₀a)/κ₀ − a = −0.07326799 fm，κ₀ = √(2mV₀)/ħ = 0.49088293 fm⁻¹，E→0 时 E 已远小于 V₀ = 5 MeV）" },
          { k: "注意", v: "只保留 ℓ=0 分波 ⇒ dσ/dΩ(θ) 各向同性；Z₁Z₂ 对本情形无影响" }
        ];
        var rGrid = lin(0, 5 * SC_A_SPHERE, 241), ur = [];
        for (i = 0; i < rGrid.length; i++) ur.push(scRadial(kind, E, rGrid[i]));
        extra = {
          title: "s 波径向波函数 u(r) = rR(r)（外区振幅归一为 1，r = a = 1 fm 处光滑连接）",
          xlabel: "r（fm）", ylabel: "u(r)",
          lines: [{ x: rGrid, y: ur, label: "u(r) = sin(kr+δ₀)（外）/ 内区匹配解", color: "#5aa9ff" }]
        };
        metrics = { kind: kind, E: E, Zz: Zz, theta: thNow, k: k, delta0: d0, sigma: sig, dsigmaTheta: iso, a: SC_A_SPHERE, kappa: kappa };
      }
      return { t: thetas, series: { dsigma: ds }, info: info, metrics: metrics, extra: extra };
    },
    tests: [
      /* ① 卢瑟福绝对值：(Z₁Z₂e²/4E)²/sin⁴(θ/2)，Zz=1、E=1 MeV、θ=60° ⇒ K×16 = 2.0734978978 fm²/sr */
      { name: "卢瑟福：dσ/dΩ(60°) = (Z₁Z₂e²/4E)²/sin⁴(θ/2) = 2.0734978978 fm²/sr（容差 1e-9）",
        params: { kind: 0, E: 1, Zz: 1, theta: 60 },
        measure: function (o) { return o.series.dsigma[nearestIndex(o.t, 60)]; },
        expect: 2.0734978978, tol: 1e-9 },
      { name: "卢瑟福：dσ/dΩ(90°) = 4K = 0.5183744745 fm²/sr（容差 1e-9）",
        params: { kind: 0, E: 1, Zz: 1, theta: 90 },
        measure: function (o) { return o.series.dsigma[nearestIndex(o.t, 90)]; },
        expect: 0.5183744745, tol: 1e-9 },
      /* 逐点角分布：dσ(θ)/dσ(90°) 必须等于 sin⁴(45°)/sin⁴(θ/2) = 0.25/sin⁴(θ/2)
         （用**相对**偏差：θ→1° 时曲线量级 ~4×10⁷，绝对差会被浮点舍入淹没） */
      { name: "卢瑟福：逐点满足 dσ(θ)/dσ(90°) = sin⁴45°/sin⁴(θ/2)（整条曲线相对偏差，容差 1e-12）",
        params: { kind: 0, E: 1, Zz: 1, theta: 90 },
        measure: function (o) {
          var ref = o.series.dsigma[nearestIndex(o.t, 90)], d = 0, i, v, want;
          for (i = 0; i < o.t.length; i++) {
            want = 0.25 / Math.pow(Math.sin(0.5 * o.t[i] * Math.PI / 180), 4);
            v = Math.abs(o.series.dsigma[i] / ref / want - 1);
            if (v > d) d = v;
          }
          return d;
        }, expect: 0, tol: 1e-12 },
      /* ② 截断总截面：Zz=1、E=1、θ_min=1° ⇒ 4πK·cot²(0.5°) = 21383.396435 fm² */
      { name: "卢瑟福：σ(θ≥1°) = 4πK·cot²(θ_min/2) = 21383.396435 fm²（数值积分，容差 1e-4）",
        params: { kind: 0, E: 1, Zz: 1, theta: 60 },
        measure: function (o) { return o.metrics.sigma; },
        expect: 21383.396435, tol: 1e-4 },
      /* θ = 180° 的正碰转折点：r_min = a(1+csc90°) = 2a = Z₁Z₂e²/E = 1.4399645474 fm */
      { name: "卢瑟福：θ=180° 的最近距离 r_min = Z₁Z₂e²/E = 1.4399645474 fm（容差 1e-9）",
        params: { kind: 0, E: 1, Zz: 1, theta: 180 },
        measure: function (o) { return o.metrics.rmin; },
        expect: 1.4399645474, tol: 1e-9 },
      /* ③ 硬球低能 s 波截面 → 4πa² = 4π = 12.566370614 fm²（E = 1e-8 MeV ⇒ (ka)²/3 ≈ 1.6e-10） */
      { name: "硬球 s 波：低能截面 → 4πa² = 12.566370614 fm²（E=1e-8 MeV，容差 1e-6）",
        params: { kind: 2, E: 1e-8, theta: 60 },
        measure: function (o) { return 4 * Math.PI * o.series.dsigma[0]; },
        expect: 12.566370614, tol: 1e-6 },
      /* 硬球相移在低能下趋于 0（δ₀ = −ka ∝ √E） */
      { name: "硬球 s 波：δ₀ = −ka，E=1e-8 时 δ₀(1e-8)/δ₀(1e-6) = 0.1（∝k，容差 1e-3）",
        params: { kind: 2, E: 1e-8, theta: 60 },
        measure: function (o) {
          void o;
          var r = scDelta0(2, 1e-8) / scDelta0(2, 1e-6);
          return isFinite(r) ? r : NaN;
        }, expect: 0.1, tol: 1e-3 },
      /* ④ 方势垒 E→0 时 s 波相移 δ₀ → 0（δ₀ ≈ k[tanh(κa)/κ − a]，∝ k ⇒ 比值 = √(E₂/E₁) = 0.1） */
      { name: "方势垒：E→0 时 δ₀ → 0（δ₀(1e-8)/δ₀(1e-6) = 0.1，容差 1e-3）",
        params: { kind: 1, E: 1e-6, theta: 60 },
        measure: function (o) {
          void o;
          var r = scDelta0(1, 1e-8) / scDelta0(1, 1e-6);
          return isFinite(r) ? r : NaN;
        }, expect: 0.1, tol: 1e-3 },
      /* ④b 方势垒的**低能总截面**：与 δ₀ → 0 相反，σ 趋于有限的 4πa_eff²。
         κ₀ = √(V₀/ħ²/2m) = √(5/20.749811) = 0.49088293 fm⁻¹，
         a_eff = tanh(κ₀a)/κ₀ − a = 0.926732005 / 0.49088293 − 1 = −0.07326799 fm
         ⇒ 4πa_eff² = 4π(0.07326799)² = 0.067458779 fm² = 0.674588 mb。
         E = 1e-8 MeV 时 δ₀ = −1.6084e-6 rad，(ka)² 的高阶修正只有 ~1e-8，容差 1e-6 足够。
         截面从曲线现算（4π·dσ/dΩ，s 波各向同性），不读模型自报的 metrics。 */
      { name: "方势垒 s 波：低能截面 → 4πa_eff² = 0.067458779 fm²（有限非零，不是 0；E=1e-8 MeV，容差 1e-6）",
        params: { kind: 1, E: 1e-8, theta: 60 },
        measure: function (o) { return 4 * Math.PI * o.series.dsigma[0]; },
        expect: 0.0674587786, tol: 1e-6 },
      { name: "方势垒：δ₀ 在 E = 0.1…10 MeV 内连续且为负（排斥势），|δ₀| < π/2（容差 0）",
        params: { kind: 1, E: 10, theta: 60 },
        measure: function (o) {
          void o;
          var ok = 1, Ei, d, prev = null;
          for (Ei = 0.1; Ei <= 10.0001; Ei += 0.1) {
            d = scDelta0(1, Ei);
            if (!isFinite(d) || d >= 0 || Math.abs(d) > Math.PI / 2) ok = 0;
            if (prev !== null && Math.abs(d - prev) > 0.2) ok = 0;      // 无分支跳变
            prev = d;
          }
          return ok;
        }, expect: 1, tol: 0 }
    ]
  });

  /* ==========================================================================
     4. identical-particles —— 全同粒子：对称/反对称波函数、泡利空穴与交换能
     --------------------------------------------------------------------------
     两个单粒子态取高斯波包（宽度 σ，中心在 ∓s/2），叠加成对称/反对称空间波函数：
         φ_a(x) = (2πσ²)^{−1/4} e^{−(x+s/2)²/(4σ²)}，φ_b(x) = φ_a(x − s)
         Ψ±(x₁,x₂) = [φ_a(x₁)φ_b(x₂) ± φ_b(x₁)φ_a(x₂)] / √(2(1 ± S²))，S = ⟨φ_a|φ_b⟩ = e^{−s²/(8σ²)}
         （分母是精确归一化因子：⟨φ_a|φ_b⟩ = S ≠ 0 时 ∥Ψ±∥² = 1）
     解析结果（都在测试里用）：
         重合线：Ψ−(x,x) ≡ 0（泡利不相容）；Ψ+(x,x) = 2N₊φ_a(x)φ_b(x) 在 x = 0 取极大
         关联函数（相对坐标）：C(d) = ∫|Ψ(x,x+d)|²dx，∫C dd = 1
         ⟨(x₁−x₂)²⟩± = [s² + 2σ² ± 2S²σ²] / (1 ± S²)
           费米 − 玻色 = 2S²s²/(1 − S⁴) > 0（交换排斥）
           大间距（S→0）时两者都 → s² + 2σ²（统计趋同）
         接触势 V = gδ(x₁−x₂)：⟨V⟩/g = ∫|Ψ(x,x)|²dx = 0（费米）、S²/(σ√π(1+S²))（玻色）
           玻色是"可分辨粒子"值 S²/(2σ√π) 的 2/(1+S²) 倍，费米为 0 —— 交换能的最简例子
     注意：这里只处理空间部分；按自旋统计，费米子的（对称）自旋态要求空间反对称。
     ========================================================================== */
  var IP_KINDS = ["玻色子（对称）", "费米子（反对称）"];

  /** 单粒子高斯波包（中心 c，宽度 σ，已归一化） */
  function ipPhi(x, c, sigma) {
    var d = x - c;
    return Math.pow(2 * Math.PI * sigma * sigma, -0.25) * Math.exp(-(d * d) / (4 * sigma * sigma));
  }
  /** 两粒子波函数 Ψ±(x₁,x₂)（含精确归一化） */
  function ipPsi(kind, x1, x2, s, sigma) {
    var c1 = -0.5 * s, c2 = 0.5 * s;
    var S = Math.exp(-(s * s) / (8 * sigma * sigma));
    var nrm = 2 * (1 + (kind === 1 ? -1 : 1) * S * S);
    if (!(nrm > 1e-12)) return 0;                     // 费米子 + s→0：反对称空间态不存在
    var a1 = ipPhi(x1, c1, sigma), b2 = ipPhi(x2, c2, sigma);
    var b1 = ipPhi(x1, c2, sigma), a2 = ipPhi(x2, c1, sigma);
    return (kind === 1 ? (a1 * b2 - b1 * a2) : (a1 * b2 + b1 * a2)) / Math.sqrt(nrm);
  }
  /** 单粒子边缘密度 ρ(x) = ∫|Ψ|²dx₂（归一化到 1） */
  function ipMarginal(kind, x, s, sigma) {
    var S = Math.exp(-(s * s) / (8 * sigma * sigma));
    var sign = kind === 1 ? -1 : 1;
    var pa = ipPhi(x, -0.5 * s, sigma), pb = ipPhi(x, 0.5 * s, sigma);
    var nrm = 2 * (1 + sign * S * S);
    if (!(nrm > 1e-12)) return 0;
    return (pa * pa + pb * pb + 2 * sign * S * pa * pb) / nrm;
  }

  SIM.register("identical-particles", {
    title: "全同粒子：泡利空穴与交换能",
    legend: "两个高斯波包（宽度 σ，中心相距 s）叠加成对称（玻色）/反对称（费米）空间波函数。" +
      "关联函数 C(d) = ∫|Ψ(x,x+d)|²dx 是两粒子间距的分布；重合线 |Ψ(x,x)|² 上费米子恒为 0（泡利不相容），" +
      "玻色子则在两点重合处取极大（玻色聚束）。⟨(x₁−x₂)²⟩ 费米 − 玻色 = 2S²s²/(1−S⁴) > 0（交换排斥），" +
      "间距很大（S = e^{−s²/8σ²}→0）时两种统计趋于一致。二阶关联函数 g⁽²⁾(x,x) = |Ψ|²/ρ² 在 2（玻色）与 0（费米）之间。",
    axes: { xlabel: "坐标 x（长度单位：波包宽度 σ 的尺度）", ylabel: "密度 / 关联函数" },
    params: {
      kind: { label: "统计", type: "enum", options: IP_KINDS, def: 0 },
      sep: { label: "两粒子标称间距 s", unit: "", def: 1, min: 0, max: 5, step: 0.05 },
      sigma: { label: "单粒子波包宽度 σ", unit: "", def: 0.5, min: 0.2, max: 2, step: 0.05 }
    },
    plots: [
      { key: "corr", label: "二阶关联 g⁽²⁾(x,x) = |Ψ|²/ρ²", color: "#ffb84d" },
      { key: "slice", label: "重合线切片 |Ψ(x,x)|²", color: "#5aa9ff" }
    ],
    compute: function (p) {
      var kind = clampInt(p.kind, 0, 1);
      var sep = clampNum(p.sep, 0, 5, 1);
      var sigma = clampNum(p.sigma, 0.2, 2, 0.5);
      var S = Math.exp(-(sep * sep) / (8 * sigma * sigma));
      var nrm = 2 * (1 + (kind === 1 ? -1 : 1) * S * S);
      var empty = !(nrm > 1e-12);                       // 费米子 + s=0：态不存在
      var xr = 0.5 * sep + 6 * sigma + 2;                // 主图 x 范围（含足够长的波包尾部）
      var xs = lin(-xr, xr, 161);
      var corr = [], slice = [], i, psi, rho, g, gmax = 0, smax = 0;
      for (i = 0; i < xs.length; i++) {
        /* 重合线切片 |Ψ(x,x)|² */
        psi = empty ? 0 : ipPsi(kind, xs[i], xs[i], sep, sigma);
        slice.push(psi * psi);
        /* 二阶关联 g⁽²⁾(x,x)：|Ψ(x,x)|²/ρ(x)²（费米恒为 0；玻色 ≤ 2） */
        rho = empty ? 0 : ipMarginal(kind, xs[i], sep, sigma);
        if (rho * rho > 1e-30) g = (psi * psi) / (rho * rho); else g = 0;
        if (!isFinite(g) || g < 0) g = 0;
        if (g > 4) g = 4;                                // 数值兜底（物理上限 ≤ 2）
        corr.push(g);
      }
      /* 二维网格（用于 extra 的切片族、归一化与 ⟨(x₁−x₂)²⟩ 的独立复核） */
      var nx = 121, xg = lin(-xr, xr, nx), rows = [], j, x1, x2, val, d2sum = 0, norm2 = 0, w, d, maxPsi2 = 0;
      for (i = 0; i < nx; i++) {
        x2 = xg[i];
        rows.push([]);
        for (j = 0; j < nx; j++) {
          x1 = xg[j];
          val = empty ? 0 : ipPsi(kind, x1, x2, sep, sigma);
          val = val * val;
          if (!isFinite(val)) val = 0;
          rows[i].push(val);
          if (val > maxPsi2) maxPsi2 = val;
        }
      }
      /* 2D 梯形积分：归一化与 ⟨(x₁−x₂)²⟩
         注意权重 (x₁−x₂)² 必须**逐个角点**取值（用单元格某个角的 d 会引入 O(h²) 误差） */
      var a00, a10, a01, a11, d00, d10, d01, d11;
      for (i = 0; i < nx - 1; i++) {
        for (j = 0; j < nx - 1; j++) {
          w = ((xg[i + 1] - xg[i]) * (xg[j + 1] - xg[j])) / 4;
          a00 = rows[i][j]; a10 = rows[i + 1][j]; a01 = rows[i][j + 1]; a11 = rows[i + 1][j + 1];
          d00 = xg[j] - xg[i]; d10 = xg[j] - xg[i + 1];
          d01 = xg[j + 1] - xg[i]; d11 = xg[j + 1] - xg[i + 1];
          norm2 += w * (a00 + a10 + a01 + a11);
          d2sum += w * (d00 * d00 * a00 + d10 * d10 * a10 + d01 * d01 * a01 + d11 * d11 * a11);
        }
      }
      if (!(norm2 > 1e-12)) norm2 = 1;
      var d2 = d2sum / norm2;
      /* 重合线积分的解析值 ∫|Ψ(x,x)|²dx（接触势的 ⟨V⟩/g） */
      var diagInt = kind === 1 ? 0 : (S * S) / (sigma * Math.sqrt(Math.PI) * (1 + S * S));
      gmax = maxOf(corr); smax = maxOf(slice);
      /* 解析式：⟨(x₁−x₂)²⟩± = [s²+2σ²±2S²σ²]/(1±S²)；交换排斥 = 2S²s²/(1−S⁴)
         s→0 且为费米子时态本身为零（1−S²→0），此时两个量都取 0，避免 0/0 */
      var den2 = 1 + (kind === 1 ? -1 : 1) * S * S;
      var d2ana = empty ? 0 : (sep * sep + 2 * sigma * sigma + (kind === 1 ? -2 : 2) * S * S * sigma * sigma) / den2;
      var exch = (empty || 1 - S * S * S * S < 1e-12) ? 0 : (2 * S * S * sep * sep) / (1 - S * S * S * S);
      if (!isFinite(d2ana)) d2ana = 0;
      if (!isFinite(exch)) exch = 0;
      var x2list = [-0.5 * sep, -0.25 * sep, 0, 0.25 * sep, 0.5 * sep], lines = [];
      for (i = 0; i < x2list.length; i++) {
        var ys = [];
        for (j = 0; j < xs.length; j++) {
          val = empty ? 0 : ipPsi(kind, xs[j], x2list[i], sep, sigma);
          ys.push(val * val);
        }
        lines.push({
          x: xs, y: ys, label: "x₂ = " + fmt(x2list[i], 3),
          color: SIM.palette[(i + 3) % SIM.palette.length]
        });
      }
      return {
        t: xs, series: { corr: corr, slice: slice },
        info: [
          { k: "统计 / 参数", v: opt(IP_KINDS, kind) + "，s = " + fmt(sep, 3) + "，σ = " + fmt(sigma, 3) + (empty ? "（s=0 ⇒ 反对称空间态为零）" : "") },
          { k: "重叠积分 S = ⟨φ_a|φ_b⟩ = e^{−s²/8σ²}", v: fmt(S, 8) + "（S² = " + fmt(S * S, 8) + "）" },
          { k: "⟨(x₁−x₂)²⟩（二维网格数值积分）", v: fmt(d2, 8) + "，解析式 [s²+2σ²" + (kind === 1 ? "−" : "+") + "2S²σ²]/(1" + (kind === 1 ? "−" : "+") + "S²) = " + fmt(d2ana, 8) },
          { k: "交换排斥（费米 − 玻色）", v: "2S²s²/(1−S⁴) = " + fmt(exch, 8) + (empty ? "（态不存在）" : " > 0（同参数下费米子更" + "互相回避）") },
          { k: "重合线 |Ψ(x,x)|² 的峰值", v: fmt(smax, 8) + "（费米恒为 0 = 泡利空穴）" },
          { k: "接触势 ⟨gδ(x₁−x₂)⟩/g = ∫|Ψ(x,x)|²dx", v: fmt(diagInt, 8) + (kind === 1 ? "（费米：交换空穴完全抑制接触相互作用）" : "（玻色：可分辨粒子值 S²/(2σ√π) 的 2/(1+S²) 倍）") },
          { k: "归一化 ∫∫|Ψ|²dx₁dx₂（二维梯形）", v: fmt(norm2, 8) },
          { k: "采样", v: "x ∈ [" + fmt(-xr, 3) + ", " + fmt(xr, 3) + "]，共 " + xs.length + " 点；二维网格 " + nx + "×" + nx }
        ],
        metrics: {
          kind: kind, sep: sep, sigma: sigma, S: S, d2: d2, d2ana: d2ana, diagInt: diagInt,
          norm2: norm2, maxPsi2: maxPsi2, slicePeak: smax, gPeak: gmax,
          grid: { x: xg, psi2: rows }
        },
        extra: {
          title: "二维概率密度 |Ψ(x₁,x₂)|²：不同 x₂ 处的切片",
          xlabel: "x₁", ylabel: "|Ψ(x₁,x₂)|²",
          lines: lines
        }
      };
    },
    tests: [
      /* ① 泡利：费米子重合线 |Ψ(x,x)|² ≡ 0（用网格峰值归一，排除"整体为零"的平凡情形） */
      { name: "费米子：重合线 |Ψ(x,x)|² = 0（泡利，已按网格峰值归一，容差 1e-12）",
        params: { kind: 1, sep: 1, sigma: 0.5 },
        measure: function (o) { return maxOf(o.series.slice) / Math.max(o.metrics.maxPsi2, 1e-30); },
        expect: 0, tol: 1e-12 },
      /* ② 玻色子：Ψ+(x,x) = 2N₊φ_aφ_b 在 x = 0 取极大（整条重合线切片上的全局最大） */
      { name: "玻色子：重合线切片在 x₁ = x₂ = 0 处取极大（max − 中心 = 0，容差 1e-12）",
        params: { kind: 0, sep: 1, sigma: 0.5 },
        measure: function (o) {
          var c = o.series.slice[nearestIndex(o.t, 0)], m = maxOf(o.series.slice);
          return m > 0 ? (m - c) / m : NaN;
        }, expect: 0, tol: 1e-12 },
      /* 重合线峰值的解析值：|Ψ+(0,0)|² = S²/(πσ²(1+S²))，s=1、σ=0.5、S²=e^{−1} ⇒ 0.3424268529 */
      { name: "玻色子：|Ψ(0,0)|² = S²/(πσ²(1+S²)) = 0.3424268529（s=1, σ=0.5，容差 1e-6）",
        params: { kind: 0, sep: 1, sigma: 0.5 },
        measure: function (o) { return o.series.slice[nearestIndex(o.t, 0)]; },
        expect: 0.3424268529, tol: 1e-6 },
      /* ③ 交换对称性：Ψ+(x₂,x₁) = Ψ+(x₁,x₂) */
      { name: "玻色子：交换 x₁↔x₂ 波函数不变（相对偏差，容差 1e-12）",
        params: { kind: 0, sep: 1, sigma: 0.5 },
        measure: function (o, p) {
          var d = 0, m = 0, i, j, a, b, xs = [-0.7, -0.3, 0.1, 0.45, 0.9];
          for (i = 0; i < xs.length; i++) {
            for (j = 0; j < xs.length; j++) {
              a = ipPsi(p.kind, xs[i], xs[j], p.sep, p.sigma);
              b = ipPsi(p.kind, xs[j], xs[i], p.sep, p.sigma);
              if (Math.abs(a) > m) m = Math.abs(a);
              if (Math.abs(a - b) > d) d = Math.abs(a - b);
            }
          }
          return m > 0 ? d / m : NaN;
        }, expect: 0, tol: 1e-12 },
      /* ④ 交换反对称性：Ψ−(x₂,x₁) = −Ψ−(x₁,x₂) */
      { name: "费米子：交换 x₁↔x₂ 波函数变号（相对偏差，容差 1e-12）",
        params: { kind: 1, sep: 1, sigma: 0.5 },
        measure: function (o, p) {
          var d = 0, m = 0, i, j, a, b, xs = [-0.7, -0.3, 0.1, 0.45, 0.9];
          for (i = 0; i < xs.length; i++) {
            for (j = 0; j < xs.length; j++) {
              a = ipPsi(p.kind, xs[i], xs[j], p.sep, p.sigma);
              b = ipPsi(p.kind, xs[j], xs[i], p.sep, p.sigma);
              if (Math.abs(a) > m) m = Math.abs(a);
              if (Math.abs(a + b) > d) d = Math.abs(a + b);
            }
          }
          return m > 0 ? d / m : NaN;
        }, expect: 0, tol: 1e-12 },
      /* 归一化：从二维网格现算 ∫∫|Ψ|²dx₁dx₂ = 1 */
      { name: "归一化 ∫∫|Ψ|²dx₁dx₂ = 1（二维梯形积分，容差 1e-6）",
        params: { kind: 0, sep: 1, sigma: 0.5 },
        measure: function (o) { return o.metrics.norm2; }, expect: 1, tol: 1e-6 },
      /* ⑤ ⟨(x₁−x₂)²⟩ 的解析值：玻色 s=1,σ=0.5 ⇒ [1.5+2e^{−1}(0.25)]/(1+e^{−1}) = 1.2310585786
         measure 从 metrics.grid 现算（网格二重积分，不依赖模型自报） */
      { name: "玻色子 ⟨(x₁−x₂)²⟩ = [s²+2σ²+2S²σ²]/(1+S²) = 1.2310585786（s=1, σ=0.5，容差 1e-6）",
        params: { kind: 0, sep: 1, sigma: 0.5 },
        measure: function (o, p) { return ipGridD2(o.metrics.grid, p.kind, p.sep, p.sigma); },
        expect: 1.2310585786, tol: 1e-6 },
      /* 费米 − 玻色 = 2S²s²/(1−S⁴) = 2e^{−1}/(1−e^{−2}) = 0.8509181282 > 0（交换排斥） */
      { name: "费米 ⟨d²⟩ − 玻色 ⟨d²⟩ = 2S²s²/(1−S⁴) = 0.8509181282（s=1, σ=0.5，容差 1e-6）",
        params: { kind: 1, sep: 1, sigma: 0.5 },
        measure: function (o, p) {
          var f = ipGridD2(o.metrics.grid, 1, p.sep, p.sigma);
          var b = ipGridD2(ipMakeGrid(0, p.sep, p.sigma), 0, p.sep, p.sigma);
          return f - b;
        }, expect: 0.8509181282, tol: 1e-6 },
      /* 大间距趋同：s = 5 时 S = e^{−25/2} = 3.7e-6，两种统计的相对差 ~ 1.5e-7 < 1e-3 */
      { name: "间距很大（s=5）时两种统计趋同：|d²_费米 − d²_玻色|/d²_玻色 < 1e-3（容差 0）",
        params: { kind: 1, sep: 5, sigma: 0.5 },
        measure: function (o, p) {
          var f = ipGridD2(o.metrics.grid, 1, p.sep, p.sigma);
          var b = ipGridD2(ipMakeGrid(0, p.sep, p.sigma), 0, p.sep, p.sigma);
          var r = Math.abs(f - b) / Math.abs(b);
          return r < 1e-3 ? 1 : 0;
        }, expect: 1, tol: 0 },
      /* 接触势：玻色 ∫|Ψ(x,x)|²dx = S²/(σ√π(1+S²)) = 0.3034678970；费米恒为 0 */
      { name: "接触势：玻色 ∫|Ψ(x,x)|²dx = S²/(σ√π(1+S²)) = 0.3034678970（s=1, σ=0.5，容差 1e-6）",
        params: { kind: 0, sep: 1, sigma: 0.5 },
        measure: function (o) { return trapz(o.t, o.series.slice); },
        expect: 0.303467897, tol: 1e-6 },
      { name: "接触势：费米 ∫|Ψ(x,x)|²dx = 0（重合线上振幅恒为 0，容差 1e-12）",
        params: { kind: 1, sep: 1, sigma: 0.5 },
        measure: function (o) { return Math.abs(trapz(o.t, o.series.slice)); },
        expect: 0, tol: 1e-12 },
      /* 玻色子二阶关联函数：g⁽²⁾(x,x) = |Ψ|²/ρ² 在 x = 0 处取 2(1+S²)/(1+S)²，S²=e^{−1} ⇒ 1.0599851512 */
      { name: "玻色子 g⁽²⁾(x,x) 峰值 = 2(1+S²)/(1+S)² = 1.0599851512（容差 1e-6）",
        params: { kind: 0, sep: 1, sigma: 0.5 },
        measure: function (o) { return maxOf(o.series.corr); },
        expect: 1.0599851512, tol: 1e-6 }
    ]
  });

  /** 生成 (kind, s, σ) 的二维网格（测试里用来独立核算另一种统计） */
  function ipMakeGrid(kind, s, sigma) {
    var xr = 0.5 * s + 6 * sigma + 2, nx = 121, xg = lin(-xr, xr, nx), rows = [], i, j, v;
    for (i = 0; i < nx; i++) {
      rows.push([]);
      for (j = 0; j < nx; j++) {
        v = ipPsi(kind, xg[j], xg[i], s, sigma);
        rows[i].push(isFinite(v) ? v * v : 0);
      }
    }
    return { x: xg, psi2: rows };
  }
  /** 从二维网格现算 ⟨(x₁−x₂)²⟩（网格二重梯形积分；权重 (x₁−x₂)² 逐角点取值） */
  function ipGridD2(grid, kind, s, sigma) {
    void kind; void s; void sigma;
    var xg = grid.x, rows = grid.psi2, nx = xg.length, i, j, w, num = 0, den = 0;
    var a00, a10, a01, a11, d00, d10, d01, d11;
    for (i = 0; i < nx - 1; i++) {
      for (j = 0; j < nx - 1; j++) {
        w = ((xg[i + 1] - xg[i]) * (xg[j + 1] - xg[j])) / 4;
        a00 = rows[i][j]; a10 = rows[i + 1][j]; a01 = rows[i][j + 1]; a11 = rows[i + 1][j + 1];
        d00 = xg[j] - xg[i]; d10 = xg[j] - xg[i + 1];
        d01 = xg[j + 1] - xg[i]; d11 = xg[j + 1] - xg[i + 1];
        den += w * (a00 + a10 + a01 + a11);
        num += w * (d00 * d00 * a00 + d10 * d10 * a10 + d01 * d01 * a01 + d11 * d11 * a11);
      }
    }
    return den > 1e-12 ? num / den : NaN;
  }

  /* ==========================================================================
     5. entanglement —— 纠缠与贝尔不等式
     --------------------------------------------------------------------------
     约定（偏振 / 光子）：检偏器方向角 θ，偏振沿 φ 的单光子通过概率 cos²(θ−φ)，
     记通过 = +1、吸收 = −1 ⇒ ⟨A⟩ = cos2(θ−φ)。于是
         乘积态 |HH⟩（两光子同偏振）：E = ⟨A⟩⟨B⟩ = cos2θ_A·cos2θ_B
         |Φ⁺⟩ = (|HH⟩+|VV⟩)/√2：E = cos2(θ_A−θ_B)
         |Ψ⁻⟩ = (|HV⟩−|VH⟩)/√2：E = −cos2(θ_A−θ_B)
     （若按自旋 ½ 约定，把"角度"整体理解为 2θ 即可 —— 契约里的 cos2θ 就是偏振约定。）
     CHSH：S = E(a,b) − E(a,b′) + E(a′,b) + E(a′,b′)
       经典（局域隐变量 / 乘积态）界限 |S| ≤ 2；
       量子上限（Tsirelson）|S| ≤ 2√2；|Φ⁺⟩ 在 (a,a′,b,b′) = (0°,45°,22.5°,67.5°) 时 S = 2√2。
     角度按 180° 周期归一化（cos2θ 的周期是 180°），任意实数输入都安全。
     ========================================================================== */
  var EN_KINDS = ["|Φ⁺⟩ 纠缠态", "|Ψ⁻⟩ 纠缠态", "乘积态 |↑↑⟩"];
  var EN_AA = 0, EN_AP = 45, EN_BB = 22.5, EN_BP = 67.5;   // 标准最优 CHSH 角（度）

  /** 角度归一化到 [0, 180)（cos2θ 的周期是 180°；任意实数/非有限输入都安全） */
  function enNormDeg(v) {
    var x = Number(v);
    if (!isFinite(x)) x = 0;
    x = ((x % 180) + 180) % 180;
    return x;
  }
  /** 关联函数 E(θ_A, θ_B)（kind：0 = |Φ⁺⟩，1 = |Ψ⁻⟩，2 = 乘积态） */
  function enE(kind, thA, thB) {
    var a = enNormDeg(thA), b = enNormDeg(thB), d;
    if (kind === 2) return Math.cos(2 * a * DEG) * Math.cos(2 * b * DEG);
    d = ((a - b) % 180 + 180) % 180;
    var c = Math.cos(2 * d * DEG);
    return kind === 1 ? -c : c;
  }
  /** CHSH 组合 S = E(a,b) − E(a,b′) + E(a′,b) + E(a′,b′) */
  function enCHSH(kind, a, ap, b, bp) {
    return enE(kind, a, b) - enE(kind, a, bp) + enE(kind, ap, b) + enE(kind, ap, bp);
  }

  SIM.register("entanglement", {
    title: "纠缠与贝尔不等式（CHSH）",
    legend: "偏振约定：检偏器角 θ 的单光子关联 ⟨A⟩ = cos2(θ−φ)。乘积态 E = cos2θ_A·cos2θ_B，" +
      "|Φ⁺⟩ 的 E = cos2(θ_A−θ_B)，|Ψ⁻⟩ 的 E = −cos2(θ_A−θ_B)。" +
      "CHSH 量 S = E(a,b) − E(a,b′) + E(a′,b) + E(a′,b′)：局域隐变量（乘积态）|S| ≤ 2，" +
      "而纠缠态在 (0°,45°,22.5°,67.5°) 处取 S = 2√2 = 2.828 —— 贝尔不等式被量子力学违反。",
    axes: { xlabel: "B 的测量角 θ_B（°）", ylabel: "关联函数 E(θ_A, θ_B)" },
    params: {
      kind: { label: "量子态", type: "enum", options: EN_KINDS, def: 0 },
      thetaA: { label: "A 的测量角 θ_A", unit: "°", def: 0, min: 0, max: 180, step: 1 },
      thetaB: { label: "B 的测量角 θ_B", unit: "°", def: 45, min: 0, max: 180, step: 1 }
    },
    plots: [
      { key: "E", label: "E(θ_A, θ_B)（固定 θ_A，扫 θ_B）", color: "#5aa9ff" }
    ],
    compute: function (p) {
      var kind = clampInt(p.kind, 0, 2);
      var thA = enNormDeg(clampNum(p.thetaA, 0, 180, 0));
      var thB = enNormDeg(clampNum(p.thetaB, 0, 180, 45));
      /* θ_B 轴：0° … 180°，361 点 ⇒ 步长 0.5°（CHSH 的最优角相差 22.5°，落在采样点上） */
      var grid = lin(0, 180, 361), E = [], Scurve = [], i;
      for (i = 0; i < grid.length; i++) {
        E.push(enE(kind, thA, grid[i]));
        /* 把标准最优角整体平移到当前 (θ_A,θ_B)：a=θ_A, a′=θ_A+45°, b=θ_B, b′=θ_B+45° */
        Scurve.push(enCHSH(kind, thA, thA + 45, grid[i], grid[i] + 45));
      }
      var Sopt = enCHSH(kind, EN_AA, EN_AP, EN_BB, EN_BP);            // 标准最优角下
      var Scur = enCHSH(kind, thA, thA + 45, thB, thB + 45);          // 当前角 +45° 平移组
      var SshiftMax = maxOf(Scurve.map(function (v) { return Math.abs(v); }));
      var Ecur = enE(kind, thA, thB);
      var viol = Math.abs(Sopt) > 2 + 1e-9;
      var ref = [-2, 2], refLines = [], SforRef = [];
      for (i = 0; i < grid.length; i++) SforRef.push(grid[i]);
      refLines.push({ x: SforRef, y: grid.map(function () { return 2; }), label: "+2 经典界限", color: "#ff7b7b", dash: "4 4" });
      refLines.push({ x: SforRef, y: grid.map(function () { return -2; }), label: "−2 经典界限", color: "#ff7b7b", dash: "4 4" });
      void ref;
      return {
        t: grid, series: { E: E },
        info: [
          { k: "量子态", v: opt(EN_KINDS, kind) + "（偏振约定 E = cos2θ）" },
          { k: "当前 (θ_A, θ_B)", v: "(" + fmt(thA, 3) + "°, " + fmt(thB, 3) + "°) ⇒ E = " + fmt(Ecur, 8) },
          { k: "关联函数解析式", v: kind === 2 ? "E = cos2θ_A·cos2θ_B" : (kind === 1 ? "E = −cos2(θ_A−θ_B)" : "E = cos2(θ_A−θ_B)") },
          { k: "CHSH 量 S（最优角 0°/45°/22.5°/67.5°）", v: fmt(Sopt, 8) + "（|S| " + (viol ? ">" : "≤") + " 2）" },
          { k: "CHSH 量 S（当前角 +45° 平移组）", v: fmt(Scur, 8) + "（把 θ_A、θ_B 当作 a、b，a′=a+45°、b′=b+45°）" },
          { k: "沿 θ_B 扫描的 |S| 最大值", v: fmt(SshiftMax, 8) + "（Tsirelson 上限 2√2 = 2.8284271）" },
          { k: "贝尔不等式", v: viol ? "违反：|S| = " + fmt(Math.abs(Sopt), 6) + " > 2（量子力学不允许局域隐变量）"
            : "不违反：|S| = " + fmt(Math.abs(Sopt), 6) + " ≤ 2（乘积态 = 局域隐变量模型）" },
          { k: "角度归一化", v: "E 对每个角都是 180° 周期；输入角先归一到 [0°,180°)（任意值都不产生 NaN）" }
        ],
        metrics: {
          kind: kind, thetaA: thA, thetaB: thB, E: Ecur,
          S: Sopt, Scur: Scur, SshiftMax: SshiftMax, violates: viol ? 1 : 0
        },
        extra: {
          title: "CHSH 量随 θ_B（蓝线 = 当前角平移组；红虚线 = ±2 经典界限；纠缠态峰值 2√2）",
          xlabel: "θ_B（°）", ylabel: "S",
          lines: [{ x: grid, y: Scurve, label: "S(θ_B)", color: "#63d6a5" }].concat(refLines)
        }
      };
    },
    tests: [
      /* ① 乘积态 E = cos2θ_A·cos2θ_B（逐点） */
      { name: "乘积态：E(θ_A,θ_B) = cos2θ_A·cos2θ_B（整条曲线逐点，容差 1e-12）",
        params: { kind: 2, thetaA: 0, thetaB: 45 },
        measure: function (o, p) {
          var d = 0, i, v;
          for (i = 0; i < o.t.length; i++) {
            v = Math.abs(o.series.E[i] - Math.cos(2 * p.thetaA * DEG) * Math.cos(2 * o.t[i] * DEG));
            if (v > d) d = v;
          }
          return d;
        }, expect: 0, tol: 1e-12 },
      /* ② |Φ⁺⟩：E = cos2(θ_A−θ_B)（逐点） */
      { name: "|Φ⁺⟩：E(θ_A,θ_B) = cos2(θ_A−θ_B)（整条曲线逐点，容差 1e-12）",
        params: { kind: 0, thetaA: 30, thetaB: 45 },
        measure: function (o, p) {
          var d = 0, i, v;
          for (i = 0; i < o.t.length; i++) {
            v = Math.abs(o.series.E[i] - Math.cos(2 * (p.thetaA - o.t[i]) * DEG));
            if (v > d) d = v;
          }
          return d;
        }, expect: 0, tol: 1e-12 },
      /* ③ |Ψ⁻⟩：E = −cos2(θ_A−θ_B)（逐点） */
      { name: "|Ψ⁻⟩：E(θ_A,θ_B) = −cos2(θ_A−θ_B)（整条曲线逐点，容差 1e-12）",
        params: { kind: 1, thetaA: 30, thetaB: 45 },
        measure: function (o, p) {
          var d = 0, i, v;
          for (i = 0; i < o.t.length; i++) {
            v = Math.abs(o.series.E[i] + Math.cos(2 * (p.thetaA - o.t[i]) * DEG));
            if (v > d) d = v;
          }
          return d;
        }, expect: 0, tol: 1e-12 },
      /* 同角度完全关联：E(θ,θ) = ±1 */
      { name: "同角度完全关联：|Φ⁺⟩ 的 E(0°,0°) = +1（容差 1e-12）",
        params: { kind: 0, thetaA: 0, thetaB: 0 },
        measure: function (o) { return o.series.E[0]; }, expect: 1, tol: 1e-12 },
      { name: "同角度完全反关联：|Ψ⁻⟩ 的 E(0°,0°) = −1（容差 1e-12）",
        params: { kind: 1, thetaA: 0, thetaB: 0 },
        measure: function (o) { return o.series.E[0]; }, expect: -1, tol: 1e-12 },
      /* ④ |Φ⁺⟩ 在最优角 (0°,45°,22.5°,67.5°) 的 CHSH 量 S = 2√2 = 2.8284271247 */
      { name: "|Φ⁺⟩：最优角下 CHSH 量 S = 2√2 = 2.8284271247（容差 1e-6）",
        params: { kind: 0, thetaA: 0, thetaB: 22.5 },
        measure: function (o) { return o.metrics.S; }, expect: 2.8284271247, tol: 1e-6 },
      /* |Ψ⁻⟩ 同一组角给 S = −2√2（符号约定） */
      { name: "|Ψ⁻⟩：最优角下 S = −2√2 = −2.8284271247（符号约定，容差 1e-6）",
        params: { kind: 1, thetaA: 0, thetaB: 22.5 },
        measure: function (o) { return o.metrics.S; }, expect: -2.8284271247, tol: 1e-6 },
      /* 平坦扫描：|Φ⁺⟩ 沿 θ_B 扫 |S| 的峰值也恰为 2√2（Tsirelson 上限） */
      { name: "|Φ⁺⟩：沿 θ_B 扫描 |S| 的最大值 = 2√2 = 2.8284271247（容差 1e-6）",
        params: { kind: 0, thetaA: 10, thetaB: 45 },
        measure: function (o) { return o.metrics.SshiftMax; }, expect: 2.8284271247, tol: 1e-6 },
      /* ⑤ 乘积态：整个 CHSH 角族的 |S| 上确界 = 2（经典界限）
         测量方式：b、b′ 扫 0…180°（步长 5°），a、a′ ∈ {0°,90°}（即 A、A′ = ±1），
         S = A(β−β′) + A′(β+β′)，β = cos2b ⇒ max|S| = |u|+|v| ≤ √2·√(u²+v²) ≤ 2，
         且 (b,b′) = (0°,90°) 时 u = 2、v = 0 取到 2。 */
      { name: "乘积态：CHSH 角族内 |S| 的最大值 = 2（经典界限，容差 1e-9）",
        params: { kind: 2, thetaA: 0, thetaB: 45 },
        measure: function (o, p) {
          void o;
          var best = 0, a, ap, b, bp, s, av = [0, 90], bv = [], i;
          for (i = 0; i <= 180; i += 5) bv.push(i);
          for (i = 0; i < av.length; i++) {
            for (var j = 0; j < av.length; j++) {
              for (var m = 0; m < bv.length; m++) {
                for (var n = 0; n < bv.length; n++) {
                  a = av[i]; ap = av[j]; b = bv[m]; bp = bv[n];
                  s = Math.abs(enCHSH(p.kind, a, ap, b, bp));
                  if (s > best) best = s;
                }
              }
            }
          }
          return best;
        }, expect: 2, tol: 1e-9 },
      /* 乘积态在标准最优角下的 S = √2 = 1.4142135624（竖直/水平的组合，明显低于 2） */
      { name: "乘积态：标准最优角下 S = √2 = 1.4142135624（容差 1e-9）",
        params: { kind: 2, thetaA: 0, thetaB: 45 },
        measure: function (o) { return o.metrics.S; }, expect: 1.4142135624, tol: 1e-9 },
      /* 角度归一化：θ + 180° 与 θ 完全等价（周期 180°），任意大角不产生 NaN */
      { name: "角度归一化：θ 与 θ+180° 给同一 E，且超大角/负数都有限（容差 1e-12）",
        params: { kind: 0, thetaA: 12, thetaB: 40 },
        measure: function (o, p) {
          void o;
          var d = 0, i, v, big = [1e5, -12345.6, 720.5, -0.0001];
          for (i = 0; i < big.length; i++) {
            v = Math.abs(enE(p.kind, big[i], p.thetaB) - enE(p.kind, big[i] + 180, p.thetaB));
            if (!isFinite(enE(p.kind, big[i], big[i]))) v = Infinity;
            if (v > d) d = v;
          }
          return d;
        }, expect: 0, tol: 1e-12 }
    ]
  });

})(typeof window !== "undefined" ? window : globalThis);
