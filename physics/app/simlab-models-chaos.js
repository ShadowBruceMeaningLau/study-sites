/* ==========================================================================
   simlab-models-chaos.js —— 非线性与混沌 仿真模型（W5 契约 §13.B.2，3 个）

     · logistic    逻辑斯蒂映射 x → r·x(1−x)：时间序列 / 分岔图 / λ(r) 曲线
     · mandelbrot  曼德博集合：实轴逃逸步数切片 + 主心形线与周期 2 圆盘的解析边界
     · poincare    洛伦兹系统的庞加莱截面（y = 0 且 ẏ > 0）与最大李雅普诺夫指数 λ₁

   ★ 约束（与 simlab.js 顶部、其它 simlab-models-*.js 一致）：
     · 加载时**只调用 SIM.register**，绝不触碰 DOM —— tools/verify-simlab.mjs 在 Node 里
       用 window 桩直接跑 compute()/tests 做物理不变量自检；
     · **不调用 Math.random**：三个模型全是确定性的，同参数逐位可重复；
     · 纯 ES5：var / 无箭头函数 / 无模板字符串 / 无 import-export；
     · 边界安全：任意滑块取值都不抛异常、不出 NaN/±∞（每个模型都有“边界安全”自检）。

   解析依据（tests 里 expect 的来源，逐条也写在各自注释里）：
     logistic   ① r = 2.5 的唯一非零不动点 x* = 1 − 1/r = 0.6（|f'(x*)| = |2−r| = 0.5 < 1 稳定）
                ② r = 4 时 λ = ln2 = 0.6931471805599453：x = sin²(πθ) 把映射共轭到
                   θ → 2θ (mod 1)，每步精确“乘以 2”，故 λ = ln2 是精确值
                ③ r = 3.2 落在周期 2 窗口 3 < r < 1+√6 = 3.449489742783178 内
                ④ 倍周期分岔点 r₁ = 3（f'(x*) = 2−r = −1）、r₂ = 1+√6（周期 2 → 周期 4）
     mandelbrot 逃逸判据 |z| > 2（严格大于：c = −2 的轨道 |z| 恰好等于 2，永不逃逸）；
                主心形线 c = e^{iθ}/2 − e^{2iθ}/4（面积 3π/8 = 1.1780972450961724）；
                周期 2 圆盘 |c + 1| = 1/4（面积 π/16 = 0.19634954084936207）；
                集合面积 ≈ 1.5065918849，边界 Hausdorff 维数 = 2（Shishikura 1991）而边界面积 = 0
     poincare   Lorenz (σ, ρ, β) = (10, 28, 8/3) 时 λ₁ ≈ 0.9056（文献值）；
                λ₁ + λ₂ + λ₃ = ∇·F = −(σ + 1 + β)，自治流必有 λ₂ = 0
   ========================================================================== */
(function (global) {
  "use strict";
  var SIM = global.SIM;
  if (!SIM) return;   // 在 Node 里若未先加载 simlab.js，安静退出

  var rk4 = SIM.rk4, lin = SIM.linspace, fmt = SIM.fmt, opt = SIM.opt;

  /* --------------------------------------------------------------- 通用小工具 */
  function num(v, dv) { var x = Number(v); return isFinite(x) ? x : dv; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function fin(v, fb) { return isFinite(v) ? v : fb; }
  /** 生成长度为 len、前段为 head、其余填 NaN 的数组（NaN 点不会被画出来，
   *  用来给主图里“光标线”这类只由两个点构成的曲线占位——见 chart() 的非有限数跳过逻辑） */
  function padNaN(head, len) {
    var out = head.slice(), i;
    for (i = out.length; i < len; i++) out.push(NaN);
    return out;
  }
  function allFinite(a) {
    var i;
    if (!a || !a.length) return false;
    for (i = 0; i < a.length; i++) if (!isFinite(a[i])) return false;
    return true;
  }
  /** 从第 k 个元素起全部有限：主图里“光标线”那类曲线的前 k 个点是 NaN 占位（不画出来） */
  function finiteFrom(a, k) {
    var i;
    if (!a || a.length <= k) return false;
    for (i = k; i < a.length; i++) if (!isFinite(a[i])) return false;
    return true;
  }
  /** 两个等长序列的最大逐点偏差（“同参数完全可重复”自检用） */
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
  /** 最小二乘直线斜率 slope = Σ(x−x̄)(y−ȳ)/Σ(x−x̄)²（半对数斜率 = 指数增长率） */
  function lsqSlope(xs, ys) {
    var n = xs.length, sx = 0, sy = 0, sxx = 0, sxy = 0, i;
    if (n < 2) return NaN;
    for (i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i]; }
    var den = n * sxx - sx * sx;
    if (!(Math.abs(den) > 0)) return NaN;
    return (n * sxy - sx * sy) / den;
  }
  /** 等间隔抽样成一个固定长度的数组（主图点数上限，SVG 折线的合理规模） */
  function thin(arr, maxN) {
    var n = arr.length, out = [], i, idx;
    if (n <= maxN) return arr.slice();
    for (i = 0; i < maxN; i++) {
      idx = Math.round(i * (n - 1) / (maxN - 1));
      out.push(arr[idx]);
    }
    return out;
  }

  /* ==========================================================================
     1. logistic —— 逻辑斯蒂映射：不动点、倍周期、李雅普诺夫指数
     ==========================================================================
     迭代映射      x_{n+1} = f(x_n) = r·x_n·(1 − x_n)，  f'(x) = r(1 − 2x)
     非零不动点    x* = 1 − 1/r（f(x*) = x* 的直接解），稳定性判据 |f'(x*)| = |2 − r|
                   |2−r| < 1（即 1 < r < 3）稳定；r = 3 处 f'(x*) = −1，发生第一次倍周期分岔
     李雅普诺夫指数 λ = lim (1/N)Σ ln|f'(x_n)|（沿典型轨道的时间平均）
                   · r = 4：共轭到 θ → 2θ (mod 1)，每步精确乘 2 ⇒ λ = ln2（精确值）
                   · 稳定不动点上：λ = ln|f'(x*)| = ln|2 − r|（r = 2.5 时 = ln0.5 = −0.6931）
     倍周期分岔点  r₁ = 3、r₂ = 1 + √6 = 3.449489742783178（周期 2 → 周期 4）
                   r₃ = 3.544090、r₄ = 3.564407、累积点 r∞ = 3.569946，δ = 4.669201
     周期 3 窗口   起点 1 + √8 = 3.828427（切线分岔，λ 由负穿零；窗口内 λ < 0）
     数值纪律      · 轨道精确落到临界点 x = 1/2（f' = 0，ln|f'| → −∞）或不稳定不动点 x = 0 时，
                     用 1e-12 的**确定性**微扰去退化（只在 r > 1 生效，否则会破坏 r < 1 时
                     向 0 收敛的正确结果）；触发次数与原因都写进 info，不藏起来；
                   · **时间序列（kind = 0）也要去退化**：1e-12 微扰只能把塌缩推迟 ~40 步，
                     曲线前段依旧是 0.5 → 1 → 0 → 0…（不是混沌轨道）。所以这里检测“轨道**精确**
                     停在不稳定不动点上”（x_{n+1} === x_n 且 |f'(x)| > 1，例如 r = 4、x₀ = 1/2 的
                     1/2 → 1 → 0，或 x₀ = 3/4 直接落在不稳定不动点 x* = 1 − 1/r 上），
                     再换一个**确定性**备用初值（LOGI_SEEDS，与 logiLambdaLong 同一组）整段重算；
                     r ≤ 1 时 0 是稳定不动点、r < 3 时 x* 稳定，都不触发（那是正确的收敛）；
                     换用了哪条初值、为什么换，都写进 info；**不使用 Math.random**；
                   · 分岔图**排序采样 + 蛇形连线**：每列吸引子上的 K 个取值升序排好，然后
                     k 为偶数时沿 r 递增、k 为奇数时沿 r 递减地串成一条折线。这样列与列之间
                     的连线只跨越**同一列里相邻的两个取值**（间隔极小），既画出点集结构、
                     又不会像“逐列上下连”那样把周期 2 区间涂成一片实心带。
     ========================================================================== */
  var LOGI_KINDS = ["时间序列", "分岔图", "李雅普诺夫指数"];
  var LOGI_RLO = 2.4, LOGI_RHI = 4.0;   // 分岔图 / λ(r) 的扫描区间（[2.4, 4] 覆盖全部倍周期结构）
  var LOGI_NR = 480;                    // 分岔图列数（Δr = 1.6/479 ≈ 0.0033）
  var LOGI_NCOL = 12;                   // 每列在吸引子上取多少个迭代值
  var LOGI_SETTLE = 2000;               // 每列丢掉的暂态步数
  var LOGI_NCURVE = 900;                // λ(r) 曲线点数
  var LOGI_TINY = 1e-300;               // ln 的有限下限（r = 0 时 f' ≡ 0，真值是 −∞）
  var LOGI_R1 = 3;                      // 分岔点 1（解析）
  var LOGI_R2 = 1 + Math.sqrt(6);       // 分岔点 2（解析）= 3.449489742783178
  var LOGI_LN2 = Math.LN2;              // r = 4 的精确 λ

  function logiMap(x, r) { return r * x * (1 - x); }

  /** 时间序列 x_0 … x_n（长度 n+1，含初值）：**原始**轨道，不做去退化（兜底路径用） */
  function logiSeries(r, x0, n) {
    var xs = [x0], x = x0, i;
    for (i = 0; i < n; i++) { x = logiMap(x, r); xs.push(x); }
    return xs;
  }

  /** 时间序列的**确定性**备用初值（与 logiLambdaLong 同一组；都是常数，没有随机数） */
  var LOGI_SEEDS = [0.37, 0.41, 0.23, 0.61, 0.13];

  /**
   * 时间序列去退化版（kind = 0 的主曲线）：先用用户给的 x₀ 整段算一遍；
   * 一旦发现轨道**精确**停在不稳定不动点上（x_{n+1} === x_n 且 |f'(x)| > 1），
   * 这条轨道就再也不会动了 —— 画出来只是一条停在不动点上的直线（例如
   * r = 4、x₀ = 1/2 给出 1/2 → 1 → 0 → 0 → …，⟨x⟩ = 0.00746、λ = 0.6307，
   * 而解析值是 ⟨x⟩ = 1/2、λ = ln2 = 0.6931）。此时换 LOGI_SEEDS 里的下一个
   * 确定性初值**整段重算**，直到得到一条不塌缩的轨道。
   *
   * 为什么不像 λ 通道那样只做 1e-12 微扰：微扰后 x 每步约乘 4，要 ~40 步才长回 O(1)，
   * 曲线前 40 个点仍贴在 0 附近，看不出混沌轨道；整段重算才一次到位。
   * 判据只在 r > 1 时成立：r ≤ 1 时 x = 0 是**稳定**不动点、r < 3 时 x* = 1 − 1/r 稳定，
   * 轨道收敛到它们是正确的物理，不能当成退化去重算。
   *
   * @return { xs, seed, tries, degen }：xs 长度恒为 n+1；所有候选都塌缩时走兜底路径
   *         （原轨道 + 1e-12 确定性微扰），保证长度、有限性与"绝不用 Math.random"。
   */
  function logiSeriesSafe(r, x0, n) {
    var seeds = [x0].concat(LOGI_SEEDS), s, i, x, prev, xs, ok, d;
    for (s = 0; s < seeds.length; s++) {
      x = clamp(fin(num(seeds[s], 0.4), 0.4), 0, 1);
      xs = [x];
      ok = 1;
      for (i = 0; i < n; i++) {
        prev = x;
        x = logiMap(x, r);
        d = Math.abs(r * (1 - 2 * x));
        if (x === prev && d > 1) { ok = 0; break; }   // 精确停在不稳定不动点 ⇒ 这条初值作废
        xs.push(x);
      }
      if (ok) return { xs: xs, seed: seeds[s], tries: s, degen: s > 0 ? 1 : 0 };
    }
    /* 兜底（n ≤ 1000 时实际到不了：r = 4 的浮点轨道要 ~2×10⁷ 步才精确塌缩）：
       照 λ 通道的办法边迭代边做 1e-12 确定性微扰，长度与有限性不变。 */
    x = clamp(fin(num(x0, 0.4), 0.4), 0, 1);
    xs = [x];
    for (i = 0; i < n; i++) {
      x = logiMap(x, r);
      if (r > 1 && (x === 0 || x === 1)) x += (x === 0 ? 1e-12 : -1e-12);
      xs.push(x);
    }
    return { xs: xs, seed: x0, tries: -1, degen: 1 };
  }

  /**
   * λ = (1/N)Σ_{n<N} ln|f'(x_n)|（就地对同一条轨道做时间平均）
   * 去退化：见文件头“数值纪律”。返回 {lam, degen, endX}。
   */
  function logiLambda(r, x0, n) {
    var x = x0, sum = 0, i, ad, d, degen = 0;
    for (i = 0; i < n; i++) {
      d = r * (1 - 2 * x);
      ad = Math.abs(d);
      if (r > 1 && ad < 1e-12) {           // 命中临界点 x = 1/2：确定性微扰后继续
        x = x < 0.5 ? x + 1e-12 : x - 1e-12;
        degen++;
        ad = Math.abs(r * (1 - 2 * x));
      }
      if (!(ad > LOGI_TINY)) ad = LOGI_TINY;   // f' = 0（r = 0、x = 1/2）时的有限下限
      sum += Math.log(ad);
      x = logiMap(x, r);
      if (r > 1 && x < 1e-12) { x += 1e-12; degen++; }   // 落进不稳定不动点 0
    }
    return { lam: sum / n, degen: degen, endX: x };
  }

  /**
   * 长时 λ（自检用的高精度通道）：同一条公式，N 步时间平均。
   * 交互式 n ≤ 1000 时 λ 的有限时涨落是 O(1/N) —— r = 4 有精确的望远镜恒等式
   *     λ_N = ln2 + [ln|sin(2^N φ)| − ln|sin φ|]/N   （x₀ = sin²(πφ)，见文件头 ②）
   * 所以 N = 10⁷ 时偏差 ~1e-8，比 1e-6 的容差留了 30 倍余量。
   * 去退化：双精度的 r = 4 轨道迟早会**精确**落进不稳定不动点 0（实测 ~2×10⁷ 步量级），
   * 一旦如此 λ 就会被 ln4 拖走；因此这里检测“精确塌缩”（x === 0/1 或 f' === 0）后
   * 直接丢掉这条轨道、用下一个确定性初值整段重算 —— 不把退化步计入任何平均。
   */
  function logiLambdaLong(r, x0, N) {
    var seeds = [x0, 0.37, 0.41, 0.23, 0.61, 0.13], s, i, x, sum, ad, ok;
    if (!(r > 1)) return { lam: logiLambda(r, clamp(fin(num(x0, 0.4), 0.4), 0, 1), N).lam, seed: x0, collapse: 1 };
    for (s = 0; s < seeds.length; s++) {
      x = clamp(fin(num(seeds[s], 0.4), 0.4), 0, 1);
      sum = 0; ok = 1;
      for (i = 0; i < N; i++) {
        ad = Math.abs(r * (1 - 2 * x));
        if (!(ad > 0)) { ok = 0; break; }            // 精确命中临界点 x = 1/2
        sum += Math.log(ad);
        x = logiMap(x, r);
        if (x === 0 || x === 1) { ok = 0; break; }   // 浮点轨道塌进不动点 0/1 ⇒ 换初值重算
      }
      if (ok) return { lam: sum / N, seed: seeds[s], collapse: 0 };
    }
    return { lam: logiLambda(r, x0, N).lam, seed: x0, collapse: 1 };
  }

  /**
   * 吸引子采样：丢掉 settle 步暂态后取 keep 步，升序排列并按容差 tol 合并成“簇”。
   * 簇的个数就是周期（稳定周期轨道上是精确的；混沌区会顶到 keep 这个上限）。
   */
  function logiAttractor(r, x0, settle, keep, tol) {
    var x = clamp(fin(num(x0, 0.4), 0.4), 0, 1), i, v = [], cl;
    for (i = 0; i < settle; i++) {
      x = logiMap(x, r);
      if (r > 1 && x < 1e-12) x += 1e-9;      // 落进不稳定不动点 0：确定性跳出
    }
    for (i = 0; i < keep; i++) { x = logiMap(x, r); v.push(x); }
    v.sort(function (a, b) { return a - b; });
    cl = [v[0]];
    for (i = 1; i < v.length; i++) {
      if (v[i] - cl[cl.length - 1] > tol) cl.push(v[i]);
    }
    return cl;
  }

  /** 当前 r 的周期信息（info 读数用）：settle 取长一点，避免分岔点附近把暂态当成吸引子 */
  function logiPeriodInfo(r, x0) {
    var cl = logiAttractor(r, x0, 20000, 128, 1e-9);
    return { period: cl.length, lo: cl[0], hi: cl[cl.length - 1], spread: cl[cl.length - 1] - cl[0] };
  }

  /**
   * 二分定位“吸引子簇数跨过 minCount”的 r —— 即倍周期分岔点的数值位置。
   * 前提：lo 侧簇数 < minCount、hi 侧 ≥ minCount（单调跨越）。
   * 近分岔点处收敛极慢（临界慢化），故 settle 取 1e5 量级；实测偏差 ~1e-4（自检容差 1e-3）。
   */
  function logiBifPoint(lo, hi, minCount, settle, tol, eps) {
    var a = lo, b = hi, m, i;
    for (i = 0; i < 40 && (b - a) > eps; i++) {
      m = 0.5 * (a + b);
      if (logiAttractor(m, 0.4, settle, 64, tol).length >= minCount) b = m; else a = m;
    }
    return 0.5 * (a + b);
  }

  SIM.register("logistic", {
    title: "逻辑斯蒂映射：不动点、倍周期分岔与李雅普诺夫指数",
    legend: "枚举参数 kind 选显示方式：时间序列（横轴迭代步数 n）、分岔图（横轴参数 r，纵轴是吸引子上" +
      "出现过的 x 值）、李雅普诺夫指数 λ(r)。λ > 0 表示混沌（相邻轨道指数分离），λ < 0 表示周期运动；" +
      "λ 每一次回到 0 都对应一次倍周期分岔（r₁ = 3、r₂ = 1+√6 = 3.449490…）。",
    axes: {
      xlabel: "横轴：迭代步数 n（时间序列）/ 参数 r（分岔图与 λ 曲线）",
      ylabel: "纵轴：x_n（时间序列、分岔图）/ λ（李雅普诺夫指数）"
    },
    params: {
      kind: { label: "显示方式", type: "enum", options: LOGI_KINDS, def: 0 },
      r: { label: "增长率 r", unit: "", def: 3.7, min: 0, max: 4, step: 0.001 },
      x0: { label: "初值 x₀", unit: "", def: 0.5, min: 0, max: 1, step: 0.001 },
      n: { label: "迭代次数 n", unit: "", def: 200, min: 10, max: 1000, step: 1 }
    },
    plots: [
      { key: "x", label: "x_n（时间序列）", color: "#5aa9ff" },
      { key: "bif", label: "吸引子上的 x 值（每个 r 一列）", color: "#5aa9ff" },
      { key: "cursor", label: "当前 r 的位置（光标线）", color: "#ffb84d", dash: "6 4" },
      { key: "lyap", label: "λ(r)", color: "#63d6a5" }
    ],
    compute: function (p) {
      var ki = clamp(Math.round(fin(num(p.kind, 0), 0)), 0, LOGI_KINDS.length - 1);
      var kindName = opt(LOGI_KINDS, ki);
      var r = clamp(fin(num(p.r, 3.7), 3.7), 0, 4);
      var x0 = clamp(fin(num(p.x0, 0.5), 0.5), 0, 1);
      var n = Math.round(clamp(fin(num(p.n, 200), 200), 10, 1000));
      var i, k, series = {}, t = [], extra = null;

      /* --- 与显示方式无关的读数：不动点、稳定性、λ、周期 --- */
      var lamb = logiLambda(r, x0, n);
      var per = logiPeriodInfo(r, x0);
      var xstar = r > 1e-9 ? 1 - 1 / r : 0;
      var xstarIn = r > 1e-9 && xstar >= 0 && xstar <= 1;
      var mult = Math.abs(2 - r);              // |f'(x*)| = |2 − r|
      var perTxt;
      if (lamb.lam > 1e-6) perTxt = "混沌（λ > 0，吸引子上没有有限周期）";
      else if (per.period <= 16) perTxt = "周期 " + per.period + (per.period === 1 ? "（收敛到不动点）" : "");
      else perTxt = "临界慢化（接近分岔点，暂态尚未收敛；λ 仍在 0 附近）";

      var info = [
        { k: "显示方式 kind", v: kindName + "（枚举下标 " + ki + "）" },
        {
          k: "非零不动点 x* = 1 − 1/r",
          v: r > 1e-9
            ? fmt(xstar, 6) + (xstarIn ? "" : "（不在 [0,1] 内，非物理可实现）") + "，|f'(x*)| = |2−r| = " + fmt(mult, 6) +
              (mult < 1 - 1e-12 ? "（稳定）" : (Math.abs(mult - 1) < 1e-12 ? "（临界：分岔点）" : "（不稳定）"))
            : "—（r = 0 时映射恒为 0，不动点是 x* = 0）"
        },
        {
          k: "李雅普诺夫指数 λ（n = " + fmt(n, 0) + " 步）",
          v: fmt(lamb.lam, 6) + (lamb.degen > 0 ? "（命中临界点/不动点 " + fmt(lamb.degen, 0) + " 次，已做 1e-12 确定性去退化）" : "")
        },
        { k: "当前参数的周期", v: perTxt }
      ];

      if (ki === 0) {
        /* ---------------- (0) 时间序列 ---------------- */
        /* 去退化：塌进不稳定不动点的初值会被换成确定性备用初值整段重算（见 logiSeriesSafe） */
        var ser = logiSeriesSafe(r, x0, n);
        var xs = ser.xs;
        var ts = [];
        for (i = 0; i <= n; i++) ts.push(i);
        series.x = xs;
        t = ts;

        /* 统计量：不变密度的两个矩（r = 4 时解析值 ⟨x⟩ = 1/2、⟨x²⟩ = 1/2、var = 1/8） */
        var m1 = 0, m2 = 0;
        for (i = 0; i < xs.length; i++) { m1 += xs[i]; m2 += xs[i] * xs[i]; }
        m1 /= xs.length; m2 /= xs.length;
        var varr = m2 - m1 * m1;

        /* 直方图（第二张图）：把序列的取值分布归一化成密度 */
        var NB = 20, hist = [], cen = [];
        for (i = 0; i < NB; i++) { hist.push(0); cen.push((i + 0.5) / NB); }
        for (i = 0; i < xs.length; i++) {
          var b = Math.floor(xs[i] * NB);
          if (b < 0) b = 0;
          if (b > NB - 1) b = NB - 1;
          hist[b]++;
        }
        for (i = 0; i < NB; i++) hist[i] = hist[i] / (xs.length * (1 / NB));
        extra = {
          lines: [{ x: cen, y: hist, label: "取值分布（20 个区间的密度直方图）", color: "#c792ea" }],
          xlabel: "x", ylabel: "ρ(x)（单位 x 区间内的频率）",
          title: "不变密度直方图：r = " + fmt(r, 4) + "，n = " + fmt(n, 0) + " 步" +
            (Math.abs(r - 4) < 1e-9 ? "（r = 4 时解析密度 ρ(x) = 1/(π√(x(1−x)))，两端发散）" : "")
        };

        info.push({ k: "末值 x_n", v: fmt(xs[xs.length - 1], 6) });
        info.push({ k: "均值 ⟨x⟩ / 方差 ⟨x²⟩−⟨x⟩²", v: fmt(m1, 5) + " / " + fmt(varr, 5) + (Math.abs(r - 4) < 1e-9 ? "（r = 4 解析值 0.5 / 0.125）" : "") });
        /* 曲线自己的 λ：对**画出来的这条序列**做时间平均 (1/N)Σln|f'(x_n)|。
           换过初值后它与上面那条"典型轨道"读数可以不同（r = 4、x₀ = 1/2：n = 200 时
           典型轨道通道 0.63071 / 本曲线 0.68674，n = 1000 时 0.69300 ≈ ln2）——
           两个都列出来，才不会出现"曲线是混沌的、λ 读数却是另一个数"的矛盾。 */
        var lamCurve = 0;
        for (i = 0; i < n; i++) lamCurve += Math.log(Math.max(LOGI_TINY, Math.abs(r * (1 - 2 * xs[i]))));
        lamCurve /= n;
        info.push({
          k: "λ（按当前曲线 " + fmt(n, 0) + " 步现算）",
          v: fmt(lamCurve, 6) + (Math.abs(r - 4) < 1e-9
            ? "（r = 4 精确值 ln2 = " + fmt(LOGI_LN2, 6) + "，n 步的有限时涨落为 O(1/n)）"
            : "（这条序列的时间平均；ln 下限 " + fmt(LOGI_TINY, 0) + " 只用于 f' = 0 的情形）")
        });
        info.push({ k: "序列取值范围", v: "[" + fmt(Math.min.apply(null, xs), 4) + ", " + fmt(Math.max.apply(null, xs), 4) + "]" });
        if (lamb.degen > 0) {
          info.push({
            k: "注意：参数/初值命中退化点",
            v: "r = " + fmt(r, 4) + "、x₀ = " + fmt(x0, 4) + " 的轨道精确命中了临界点 x = 1/2（f' = 0，ln|f'| 发散）" +
              "或不稳定不动点 x = 0；λ 读数按典型轨道（1e-12 确定性去退化后）给出 —— " +
              "例如 r = 4、x₀ = 1/2 时轨道是 1/2 → 1 → 0 并停在不稳定不动点 0 上"
          });
        }
        if (ser.degen) {
          info.push({
            k: "时间序列的退化处理",
            v: (ser.tries > 0
              ? "x₀ = " + fmt(x0, 6) + " 出发的轨道在 " + fmt(n, 0) + " 步内**精确**停在不稳定不动点上" +
                "（x_{n+1} === x_n 且 |f'(x)| > 1；例如 r = 4、x₀ = 1/2 给出 1/2 → 1 → 0 → 0 → …，" +
                "是一条停在 0 的死轨道，⟨x⟩ 与 λ 都无意义），因此改用**确定性**备用初值 x₀ = " +
                fmt(ser.seed, 4) + "（候选 " + fmt(ser.tries + 1, 0) + "/" + fmt(LOGI_SEEDS.length + 1, 0) + "）整段重算"
              : "所有确定性候选初值都在 " + fmt(n, 0) + " 步内塌缩，已退回原轨道 + 1e-12 确定性微扰") +
              "。**不使用任何随机数**，同一组参数逐位可重复。"
          });
        }

        return {
          t: t, series: series, info: info, extra: extra,
          metrics: {
            kind: ki, r: r, x0: x0, n: n, lam: lamb.lam, degen: lamb.degen,
            period: per.period, xstar: xstar, mult: mult,
            mean: m1, var: varr, seriesX: xs,
            seriesSeed: ser.seed, seriesTries: ser.tries, seriesRetried: ser.degen
          }
        };
      }

      if (ki === 1) {
        /* ---------------- (1) 分岔图 ---------------- */
        var cols = [], rs = [];
        for (i = 0; i < LOGI_NR; i++) {
          var ri = LOGI_RLO + (LOGI_RHI - LOGI_RLO) * i / (LOGI_NR - 1);
          rs.push(ri);
          var col = logiAttractor(ri, x0, LOGI_SETTLE, LOGI_NCOL, 1e-12);
          // 周期比采样预算小时（例如 r < 3 的不动点只有 1 个取值），把最后一簇补齐到 K 个，
          // 这样每一列的“第 k 条支”都有定义，折线不会出现空洞
          while (col.length < LOGI_NCOL) col.push(col[col.length - 1]);
          cols.push(col);
        }
        /* 蛇形连线：k 偶数列序递增、k 奇数列序递减 */
        var tx = [], ty = [];
        for (k = 0; k < LOGI_NCOL; k++) {
          var asc = (k % 2 === 0);
          for (i = 0; i < LOGI_NR; i++) {
            var idx = asc ? i : (LOGI_NR - 1 - i);
            tx.push(rs[idx]);
            ty.push(cols[idx][k]);
          }
        }
        var rc = clamp(r, LOGI_RLO, LOGI_RHI);   // 光标：当前 r 在扫描区间内的位置
        var total = tx.length + 2;
        t = [rc, rc].concat(tx);
        series.bif = padNaN([NaN, NaN].concat(ty), total);
        series.cursor = padNaN([0, 1], total);   // 竖直光标线，其余点为 NaN（不画）

        /* 数值测出的倍周期分岔点（与解析值对照；只在分岔图这一档算，别处不必付这份开销） */
        var r1n = logiBifPoint(2.95, 3.05, 2, 1e5, 1e-6, 1e-6);
        var r2n = logiBifPoint(3.40, 3.50, 4, 1e5, 1e-6, 1e-6);
        info.push({ k: "光标处 r", v: fmt(r, 4) + (Math.abs(rc - r) > 1e-12 ? "（超出扫描区间，光标画在 " + fmt(rc, 4) + "）" : "") });
        info.push({ k: "光标处的周期 / λ", v: perTxt + "；λ = " + fmt(lamb.lam, 5) });
        info.push({
          k: "分岔点（解析 / 本图数值测得）",
          v: "r₁ = 3 / " + fmt(r1n, 5) + "；r₂ = 1+√6 = " + fmt(LOGI_R2, 6) + " / " + fmt(r2n, 5) +
            "（数值值受临界慢化影响，误差 ~1e-4）"
        });
        info.push({
          k: "更高阶分岔点（解析）",
          v: "r₃ = 3.544090、r₄ = 3.564407、累积点 r∞ = 3.569946；周期 3 窗口起点 1+√8 = 3.828427"
        });
        info.push({
          k: "扫描设置",
          v: "r ∈ [" + fmt(LOGI_RLO, 2) + ", " + fmt(LOGI_RHI, 2) + "]，" + fmt(LOGI_NR, 0) + " 列；" +
            "每列丢 " + fmt(LOGI_SETTLE, 0) + " 步暂态后取 " + fmt(LOGI_NCOL, 0) + " 个值（初值 x₀ = " + fmt(x0, 3) + "）"
        });

        return {
          t: t, series: series, info: info,
          metrics: {
            kind: ki, r: r, x0: x0, n: n, lam: lamb.lam, period: per.period, xstar: xstar,
            r1: r1n, r2: r2n, nR: LOGI_NR, nCol: LOGI_NCOL,
            cursorR: rc, bifX: t, bifY: series.bif
          }
        };
      }

      /* ---------------- (2) 李雅普诺夫指数 λ(r) ---------------- */
      var rg = lin(LOGI_RLO, LOGI_RHI, LOGI_NCURVE), lv = [], lmin = Infinity, lmax = -Infinity;
      for (i = 0; i < rg.length; i++) {
        var li = clamp(fin(logiLambda(rg[i], x0, n).lam, 0), -5, 2);   // 只为作图截断（本区间内 λ ∈ [−1.2, 0.8]）
        lv.push(li);
        if (li < lmin) lmin = li;
        if (li > lmax) lmax = li;
      }
      var rc2 = clamp(r, LOGI_RLO, LOGI_RHI);
      var tot2 = rg.length + 2;
      t = [rc2, rc2].concat(rg);
      series.lyap = padNaN([NaN, NaN].concat(lv), tot2);
      series.cursor = padNaN([lmin, lmax], tot2);

      info.push({ k: "当前 r 的 λ", v: fmt(lamb.lam, 6) + "（" + (lamb.lam > 0 ? "λ > 0：混沌，相邻轨道指数分离" : "λ < 0：周期运动，误差被压下去") + "）" });
      info.push({ k: "λ(r) 曲线的零点（= 分岔点）", v: "r₁ = 3、r₂ = 1+√6 = " + fmt(LOGI_R2, 6) + "、r₃ = 3.544090、r₄ = 3.564407、累积点 r∞ = 3.569946" });
      info.push({ k: "曲线设置", v: "r ∈ [" + fmt(LOGI_RLO, 2) + ", " + fmt(LOGI_RHI, 2) + "] 共 " + fmt(LOGI_NCURVE, 0) + " 点，每点 " + fmt(n, 0) + " 步平均" });
      info.push({ k: "参考：稳定不动点上的 λ", v: "r = 2.5 时 λ = ln|2−r| = ln0.5 = " + fmt(Math.log(0.5), 6) + "；r = 4 时精确值 ln2 = " + fmt(LOGI_LN2, 6) });

      return {
        t: t, series: series, info: info,
        metrics: {
          kind: ki, r: r, x0: x0, n: n, lam: lamb.lam, period: per.period, xstar: xstar,
          curveR: rg, curveLam: lv, cursorR: rc2
        }
      };
    },
    tests: [
      // ① r = 2.5 收敛到不动点 x* = 1 − 1/r = 0.6（解析；|f'(x*)| = 0.5 稳定 ⇒ 误差每步减半，
      //    200 步后 ≈ 1e-60）。直接取时间序列的末值，不依赖模型自报。
      {
        name: "① r = 2.5 收敛到不动点 x* = 1 − 1/r = 0.6（时间序列末值）",
        params: { kind: 0, r: 2.5, x0: 0.5, n: 200 },
        measure: function (o) { var xs = o.series.x; return xs[xs.length - 1]; },
        expect: 0.6, tol: 1e-9
      },
      // ①b 同一轨道的 λ：稳定不动点上 λ = ln|f'(x*)| = ln|2 − r| = ln0.5。
      //     用长时通道（N = 2×10⁵）算：误差主要来自前几步的暂态，量级 ~2c/N ≈ 1e-5，
      //     所以容差取 1e-4；交互式 n ≤ 1000 时这个偏差是 1e-3 量级（见 ②b）。
      {
        name: "①b r = 2.5 时 λ = ln|2−r| = ln0.5 = −0.693147（长时通道，±1e-4）",
        params: { kind: 2, r: 2.5, x0: 0.5, n: 1000 },
        measure: function () { return logiLambdaLong(2.5, 0.5, 200000).lam; },
        expect: Math.log(0.5), tol: 1e-4
      },
      // ② r = 4 时 λ = ln2 = 0.6931471805599453（精确值）。交互式 n ≤ 1000 的有限时涨落是
      //    O(1/N)（r = 4 有精确的望远镜恒等式 λ_N = ln2 + [ln|sin(2^N φ)| − ln|sin φ|]/N），
      //    N = 2×10⁷ 时实测偏差 ~3e-8，故用长时通道比对到 1e-6。
      {
        name: "② r = 4 时 λ = ln2 = 0.6931471805599453（精确值，±1e-6）",
        params: { kind: 2, r: 4, x0: 0.4, n: 1000 },
        measure: function () { return Math.abs(logiLambdaLong(4, 0.4, 2e7).lam - Math.LN2); },
        expect: 0, tol: 1e-6
      },
      // ②b 交互式 n = 1000 时 r = 4 的 λ 也必须落在 ln2 ± 5e-3 内（有限时涨落的量级），
      //     这是上面那条精确值自检的“现实版”。
      {
        name: "②b r = 4、n = 1000 的交互式 λ 与 ln2 相差 < 5e-3",
        params: { kind: 2, r: 4, x0: 0.4, n: 1000 },
        measure: function (o) { return Math.abs(o.metrics.lam - Math.LN2); },
        expect: 0, tol: 5e-3
      },
      // ③ r = 3.2 进入周期 2：判据是 x_{n+2} = x_n（相邻两次迭代值在两个数之间交替），
      //    直接取时间序列末段算 |x_{n+2} − x_n| 的最大值。周期 2 的乘子 4+2r−r² = 0.16 ⇒
      //    200 步后残差 ~1e-16。
      {
        name: "③ r = 3.2 进入周期 2：末段 |x_{n+2} − x_n| < 1e-6",
        params: { kind: 0, r: 3.2, x0: 0.5, n: 200 },
        measure: function (o) {
          var xs = o.series.x, N = xs.length, i, m = 0;
          for (i = N - 20; i < N - 2; i++) m = Math.max(m, Math.abs(xs[i + 2] - xs[i]));
          return m;
        },
        expect: 0, tol: 1e-6
      },
      // ③b 同一参数的周期数必须是 2（吸引子聚类）：r = 3.2 ∈ (3, 1+√6)
      {
        name: "③b r = 3.2 的吸引子恰有 2 个不同取值（周期 2）",
        params: { kind: 0, r: 3.2, x0: 0.5, n: 200 },
        measure: function (o) { return o.metrics.period; },
        expect: 2, tol: 0
      },
      // ④ 分岔点 r₁ = 3（f'(x*) = 2 − r = −1，倍周期分岔）。数值定位用“吸引子簇数 ≥ 2”的二分，
      //    容差 1e-3（契约值）；实测偏差 ~1e-4（临界慢化带来的系统性偏低）。
      {
        name: "④ 数值测得的第一个分岔点 r₁ = 3（±1e-3）",
        params: { kind: 1, r: 3.0, x0: 0.5, n: 400 },
        measure: function () { return logiBifPoint(2.95, 3.05, 2, 2e5, 1e-6, 1e-6) - LOGI_R1; },
        expect: 0, tol: 1e-3
      },
      // ⑤ 分岔点 r₂ = 1 + √6 = 3.449489742783178（周期 2 → 周期 4，由 f² 的倍周期给出）。
      {
        name: "⑤ 数值测得的第二个分岔点 r₂ = 1+√6 = 3.449489742783178（±1e-3）",
        params: { kind: 1, r: 3.45, x0: 0.5, n: 400 },
        measure: function () { return logiBifPoint(3.40, 3.50, 4, 2e5, 1e-6, 1e-6) - LOGI_R2; },
        expect: 0, tol: 1e-3
      },
      // ⑥ 周期 3 窗口内（1+√8 = 3.828427 < r = 3.83 < 3.857）吸引子恰有 3 个取值，
      //    且 λ < 0（窗口内部是严格周期的）。
      {
        name: "⑥ 周期 3 窗口 r = 3.83：吸引子 3 个取值且 λ < 0",
        params: { kind: 0, r: 3.83, x0: 0.5, n: 1000 },
        measure: function (o) { return o.metrics.period === 3 && o.metrics.lam < 0 ? 1 : 0; },
        expect: 1, tol: 0
      },
      // ⑦ 混沌区的符号判据：r = 3.7 与 r = 4 的 λ 都 > 0；r = 2.5 与 r = 3.2 的 λ 都 < 0。
      {
        name: "⑦ λ 的符号：r = 3.7 / 4.0 为正、r = 2.5 / 3.2 为负（4 项全对）",
        params: { kind: 2, r: 3.7, x0: 0.5, n: 1000 },
        measure: function () {
          var ok = 0, list = [[3.7, 1], [4.0, 1], [2.5, -1], [3.2, -1]], i, l;
          for (i = 0; i < list.length; i++) {
            l = logiLambda(list[i][0], 0.5, 1000).lam;
            if (list[i][1] > 0 ? l > 0 : l < 0) ok++;
          }
          return ok;
        },
        expect: 4, tol: 0
      },
      // ⑧ r = 4 的不变密度 ρ(x) = 1/(π√(x(1−x))) 给出 ⟨x⟩ = ∫xρ dx = 1/2、⟨x²⟩ = 1/2，
      //    故方差 = 1/8 = 0.125（解析值；时间平均用 N = 2×10⁵ 步，统计误差 ~1e-3）。
      {
        name: "⑧ r = 4 的时间平均 ⟨x⟩ = 1/2、方差 = 1/8（不变密度的解析矩，±0.01）",
        params: { kind: 0, r: 4, x0: 0.4, n: 1000 },
        measure: function () {
          var x = 0.4, s1 = 0, s2 = 0, N = 200000, i;
          for (i = 0; i < N; i++) { s1 += x; s2 += x * x; x = 4 * x * (1 - x); if (x < 1e-12) x += 1e-9; }
          var m1 = s1 / N, v = s2 / N - m1 * m1;
          return Math.max(Math.abs(m1 - 0.5), Math.abs(v - 0.125));
        },
        expect: 0, tol: 0.01
      },
      // ⑨ 边界安全：r = 0（映射恒为 0）、r = 4 与 x₀ = 0 / 1（轨道停在 0）、n 取两端，
      //    三种显示方式都不许出现 NaN/±∞。
      {
        name: "⑨ 边界安全：r = 0/4、x₀ = 0/1、n = 10/1000 三种显示方式都无 NaN/±∞",
        params: { kind: 0, r: 4, x0: 0, n: 10 },
        measure: function (o, p) {
          var A = SIM.models.logistic;
          var a = A.compute({ kind: 0, r: 0, x0: 0, n: 10 });
          var b = A.compute({ kind: 0, r: 4, x0: 1, n: 1000 });
          var c = A.compute({ kind: 1, r: 0, x0: 1, n: 10 });
          var d = A.compute({ kind: 2, r: 4, x0: 0, n: 1000 });
          // 分岔图与 λ 曲线的主曲线前 2 个点是光标线的 NaN 占位，从第 2 个起必须全部有限；
          // 光标线本身只有前 2 个点（其余是 NaN 占位，不画）
          var ok = allFinite(o.series.x) && allFinite(a.series.x) && allFinite(b.series.x) &&
            finiteFrom(c.series.bif, 2) && finiteFrom(d.series.lyap, 2) && allFinite(o.t) &&
            isFinite(c.series.cursor[0]) && isFinite(c.series.cursor[1]) &&
            isFinite(d.series.cursor[0]) && isFinite(d.series.cursor[1]) &&
            isFinite(c.metrics.r1) && isFinite(c.metrics.r2);
          void p;
          return ok ? 1 : 0;
        },
        expect: 1, tol: 0
      },
      // ⑩ 时间序列去退化：r = 4、x₀ = 1/2 的轨道本来精确塌进不稳定不动点 0
      //    （0.5 → 1 → 0 → 0…，改前 ⟨x⟩ = 0.00746、λ = 0.63071），换确定性备用初值后
      //    必须恢复成典型混沌轨道。解析值：r = 4 的不变密度 ρ(x) = 1/(π√(x(1−x))) 给出
      //    ⟨x⟩ = 1/2（方差 1/8）。measure 直接对 series 求平均，不读模型自报的 metrics.mean。
      {
        name: "⑩ r = 4、x₀ = 1/2 的时间序列不再塌缩：⟨x⟩ = 1/2（±0.05，n = 1000 步的有限时涨落 ~3e-3）",
        params: { kind: 0, r: 4, x0: 0.5, n: 1000 },
        measure: function (o) {
          var xs = o.series.x, s = 0, i;
          for (i = 0; i < xs.length; i++) s += xs[i];
          return Math.abs(s / xs.length - 0.5);
        },
        expect: 0, tol: 0.05
      },
      // ⑪ 同一条曲线上的 λ：对画出来的序列做时间平均 (1/N)Σln|f'(x_n)|，r = 4 时精确值为 ln2。
      //    改前那条死轨道的 λ = 0.63071（差 0.0624，远超容差）；去退化后 n = 1000 步实测偏差 ~1.5e-4。
      {
        name: "⑪ r = 4、x₀ = 1/2 的曲线：时间平均 λ = ln2 = 0.693147（±5e-3，直接从 series 现算）",
        params: { kind: 0, r: 4, x0: 0.5, n: 1000 },
        measure: function (o) {
          var xs = o.series.x, s = 0, i, n = o.metrics.n;
          for (i = 0; i < n; i++) s += Math.log(Math.abs(4 * (1 - 2 * xs[i])));
          return Math.abs(s / n - Math.LN2);
        },
        expect: 0, tol: 5e-3
      },
      // ⑫ 去退化通道的确定性（“不用 Math.random”）：r = 4、x₀ = 1/2 的曲线必须**逐位**等于
      //    用备用初值 x₀ = 0.37 重算的轨道；同一组参数再跑一遍也必须逐位相同。
      {
        name: "⑫ r = 4、x₀ = 1/2 的时间序列逐位等于备用初值 x₀ = 0.37 的轨道（重算可重复，无随机数）",
        params: { kind: 0, r: 4, x0: 0.5, n: 200 },
        measure: function (o) {
          var A = SIM.models.logistic;
          var a = A.compute({ kind: 0, r: 4, x0: 0.5, n: 200 });    // 同参数再跑一遍
          var b = A.compute({ kind: 0, r: 4, x0: 0.37, n: 200 });   // 显式使用备用初值
          return Math.max(maxDiff(o.series.x, a.series.x), maxDiff(o.series.x, b.series.x));
        },
        expect: 0, tol: 0
      }
    ]
  });

  /* ==========================================================================
     2. mandelbrot —— 曼德博集合：逃逸判据、解析边界、面积估计
     ==========================================================================
     迭代          z_0 = 0，z_{n+1} = z_n² + c；逃逸判据 **|z| > 2**（严格大于）
     为什么是 2    若 |z| > 2 且 |z| ≥ |c|，则 |z² + c| ≥ |z|² − |c| ≥ |z|² − |z| = |z|(|z| − 1) > |z|，
                   于是 |z| 单调增且发散；反过来集合含于 |c| ≤ 2 的圆内（|c| > 2 时 |z₁| = |c| > 2）。
                   注意 c = −2 的轨道是 0 → −2 → 2 → 2 → …，|z| 恰好等于 2 而永不越界，
                   所以 c = −2 属于集合 —— 这正是“严格大于”的边界情形。
     主心形线      c = e^{iθ}/2 − e^{2iθ}/4（θ ∈ [0, 2π)）：集合里“有稳定不动点”的那块，
                   尖点在 c = 1/4，面积 ∮ = 3π/8 = 1.1780972450961724；
                   边界上不动点的乘子模恰好为 1（中性稳定），轨道 |z| ≤ 1/2。
     周期 2 圆盘   |c + 1| = 1/4：圆心 −1、半径 1/4，面积 π/16 = 0.19634954084936207；
                   边界上的 2-循环乘子模为 1。
     面积/维数     集合面积 ≈ 1.5065918849（数值高精度结果，非零）；边界 Hausdorff 维数
                   严格等于 2（Shishikura 1991），而边界本身的二维测度为 0。
                   网格面积估计随 n_max 增大单调下降并趋近真值（慢逃逸点被正确判为逃逸）。
     ========================================================================== */
  var MB_ESC_R = 2;                       // 逃逸判据 |z| > 2
  var MB_AREA = 1.5065918849;             // 集合面积（真值）
  var MB_CARD_AREA = 3 * Math.PI / 8;     // 主心形线面积（解析）
  var MB_DISK_AREA = Math.PI / 16;        // 周期 2 圆盘面积（解析）
  var MB_X0 = -2.35, MB_X1 = 0.75, MB_Y0 = -1.3, MB_Y1 = 1.3;   // 显示范围（覆盖整个集合）
  var MB_NX = 168, MB_NY = 130;           // 点云网格（约 2.2 万个格点，n_max = 500 时 ~10 ms）
  var MB_MARK_MAX = 2600;                 // 点云 marker 上限（SVG 规模控制）
  var MB_NC = 900;                        // 实轴逃逸步数切片的点数

  /**
   * 逃逸迭代：返回 {escaped, n, abs, absPrev}
   *   escaped = 在第一次 |z| > 2 时立刻为 true，n 是那一步的步号；
   *   abs / absPrev 是该步与上一步的 |z|（自检里用来核对判据与“首次越界”语义）。
   */
  function mbEscape(cr, ci, nmax) {
    var zr = 0, zi = 0, n = 0, abs = 0, prev = 0, t;
    while (n < nmax) {
      t = zr * zr - zi * zi + cr;
      zi = 2 * zr * zi + ci;
      zr = t;
      prev = abs;
      abs = Math.sqrt(zr * zr + zi * zi);
      n++;
      if (abs > MB_ESC_R) return { escaped: true, n: n, abs: abs, absPrev: prev };
      if (!isFinite(abs)) return { escaped: true, n: n, abs: Infinity, absPrev: prev };  // 溢出保护
    }
    return { escaped: false, n: n, abs: abs, absPrev: prev };
  }

  /** 主心形线的解析边界 c = e^{iθ}/2 − e^{2iθ}/4（自带横轴的点列，供 extra.lines 用） */
  function mbCardioid(n) {
    var x = [], y = [], i, th;
    for (i = 0; i <= n; i++) {
      th = 2 * Math.PI * i / n;
      x.push(Math.cos(th) / 2 - Math.cos(2 * th) / 4);
      y.push(Math.sin(th) / 2 - Math.sin(2 * th) / 4);
    }
    return { x: x, y: y };
  }

  /** 周期 2 圆盘的解析边界 |c + 1| = 1/4，即 c = −1 + e^{iθ}/4 */
  function mbDisk(n) {
    var x = [], y = [], i, th;
    for (i = 0; i <= n; i++) {
      th = 2 * Math.PI * i / n;
      x.push(-1 + Math.cos(th) / 4);
      y.push(Math.sin(th) / 4);
    }
    return { x: x, y: y };
  }

  /** 网格扫描：返回不逃逸（集合内）的点、慢逃逸点计数与面积估计 */
  function mbGrid(nx, ny, nmax) {
    var dx = (MB_X1 - MB_X0) / (nx - 1), dy = (MB_Y1 - MB_Y0) / (ny - 1);
    var pts = [], inside = 0, halo = 0, i, j, cr, ci, e;
    for (j = 0; j < ny; j++) {
      ci = MB_Y0 + j * dy;
      for (i = 0; i < nx; i++) {
        cr = MB_X0 + i * dx;
        e = mbEscape(cr, ci, nmax);
        if (!e.escaped) { inside++; pts.push(cr, ci); }
        else if (e.n > 0.6 * nmax) halo++;
      }
    }
    return { inside: inside, halo: halo, area: inside * dx * dy, pts: pts, nx: nx, ny: ny };
  }

  /** 采样点是否属于集合：用模型自己的逃逸例程（info 与自检共用） */
  function mbInside(cr, ci, nmax) { return !mbEscape(cr, ci, nmax).escaped; }

  /** 参数曲线的多边形（鞋带）面积：不自交的简单闭曲线用 */
  function mbPolyArea(gen, n) {
    var c = gen(n), A = 0, i, m = c.x.length - 1;
    for (i = 0; i < m; i++) A += c.x[i] * c.y[i + 1] - c.x[i + 1] * c.y[i];
    return A / 2;
  }
  /**
   * 同一参数曲线的面积（自检用）：多边形逼近的误差只有偶次幂 A_n = A + c₂/n² + O(1/n⁴)，
   * 取 n = 4000 与 8000 做 Richardson 外推 (4A₂ − A₁)/3，残差降到 ~1e-13，
   * 于是可以拿 1e-9 的容差去核对 3π/8、π/16 这样的解析面积。
   */
  function mbPolyArea2(gen) { return (4 * mbPolyArea(gen, 8000) - mbPolyArea(gen, 4000)) / 3; }

  SIM.register("mandelbrot", {
    title: "曼德博集合：逃逸判据与解析边界",
    legend: "主图是实轴上的切片：横轴 Re c、纵轴逃逸步数 N(c)（不逃逸的点画在 N = n_max 的平台上）。" +
      "第二张图是复平面上的集合（点云，黄点 = 迭代 n_max 次仍不逃逸）与两条**解析边界**：" +
      "主心形线 c = e^{iθ}/2 − e^{2iθ}/4 与周期 2 圆盘 |c + 1| = 1/4。" +
      "把 n_max 从 30 调到 400：内部轮廓几乎不动，只有边界附近的慢逃逸点被重新判定。",
    axes: { xlabel: "Re c（实轴切片）", ylabel: "逃逸步数 N(c)（不逃逸记作 n_max）" },
    params: {
      nmax: { label: "迭代上限 n_max", unit: "", def: 100, min: 10, max: 500, step: 1 }
    },
    plots: [
      { key: "esc", label: "逃逸步数 N(c)（实轴）", color: "#5aa9ff" }
    ],
    compute: function (p) {
      var nmax = Math.round(clamp(fin(num(p.nmax, 100), 100), 10, 500));
      var i, k, cs = lin(-2.5, 1.0, MB_NC), escN = [];

      /* --- 主图：实轴切片（c ∈ [−2.5, 1]，覆盖集合左端点 −2 与尖点 1/4） --- */
      for (i = 0; i < cs.length; i++) {
        var e = mbEscape(cs[i], 0, nmax);
        escN.push(e.escaped ? e.n : nmax);
      }

      /* --- 点云：集合内部的格点（越过 MB_MARK_MAX 就等间隔抽样） --- */
      var g = mbGrid(MB_NX, MB_NY, nmax);
      var nPts = g.pts.length / 2, stride = Math.max(1, Math.ceil(nPts / MB_MARK_MAX));
      var markers = [], j;
      for (j = 0; j < nPts; j += stride) markers.push({ x: g.pts[2 * j], y: g.pts[2 * j + 1] });

      /* --- 解析边界（曲线自带横轴） + 一条不可见的“范围设定”线：
             主图/第二张图的坐标范围只由 series 的 x/y 决定（marker 不参与），
             而 chart() 对 color = "none" 的折线只取范围、不画线，于是点云才能有正确的视野。 --- */
      var card = mbCardioid(720), disk = mbDisk(720);
      var lines = [
        { x: card.x, y: card.y, label: "主心形线 c = e^{iθ}/2 − e^{2iθ}/4", color: "#ff7b7b" },
        { x: disk.x, y: disk.y, label: "周期 2 圆盘 |c+1| = 1/4", color: "#63d6a5" },
        { x: [MB_X0, MB_X1], y: [MB_Y0, MB_Y1], label: "", color: "none" }
      ];

      /* --- 采样点（带标注，放最后绘制在最上层） --- */
      var probes = [
        [0, 0, "c = 0（在）"], [-1, 0, "c = −1（在）"], [0.25, 0, "c = 1/4（尖点，在）"],
        [-2, 0, "c = −2（左端点，在）"], [-2.5, 0, "c = −2.5（逃逸）"]
      ];
      var probeTxt = [];
      for (i = 0; i < probes.length; i++) {
        var ins = mbInside(probes[i][0], probes[i][1], nmax);
        markers.push({ x: probes[i][0], y: probes[i][1], label: probes[i][2] });
        probeTxt.push(probes[i][2] + (ins ? "✓" : "✗") + "（逃逸步数 " +
          (ins ? "> " + fmt(nmax, 0) : fmt(mbEscape(probes[i][0], probes[i][1], nmax).n, 0)) + "）");
      }

      var info = [
        { k: "逃逸判据", v: "|z| > 2（严格大于）；集合含于 |c| ≤ 2 圆内。c = −2 的轨道 0→−2→2→2… 中 |z| 恰好 = 2 而永不越界 ⇒ 属于集合" },
        { k: "迭代上限 n_max", v: fmt(nmax, 0) + " 次（n_max 越大，越多慢逃逸点被正确判为逃逸）" },
        { k: "面积（" + MB_NX + "×" + MB_NY + " 网格估计）", v: fmt(g.area, 4) + "（格点数 " + fmt(g.inside, 0) + "，相对偏差 " + fmt((g.area / MB_AREA - 1) * 100, 2) + "%）" },
        { k: "集合面积真值", v: fmt(MB_AREA, 6) + "（数值高精度结果；边界维数 = 2 但边界面积为 0）" },
        { k: "主心形线 + 周期 2 圆盘面积", v: "3π/8 = " + fmt(MB_CARD_AREA, 6) + " + π/16 = " + fmt(MB_DISK_AREA, 6) + " = " + fmt(MB_CARD_AREA + MB_DISK_AREA, 6) + "（占集合面积 " + fmt((MB_CARD_AREA + MB_DISK_AREA) / MB_AREA * 100, 2) + "%）" },
        { k: "慢逃逸点（N > 0.6 n_max）", v: fmt(g.halo, 0) + " 个（都贴着边界，正是 n_max 影响细节的地方）" },
        { k: "集合是否包含采样点", v: probeTxt.join("；") }
      ];

      return {
        t: cs, series: { esc: escN }, info: info,
        bars: [
          { label: "面积估计（网格，n_max = " + nmax + "）", value: g.area, color: "#5aa9ff" },
          { label: "集合面积真值 1.50659", value: MB_AREA, color: "#ff7b7b" },
          { label: "主心形线 + 圆盘（解析）", value: MB_CARD_AREA + MB_DISK_AREA, color: "#63d6a5" }
        ],
        extra: {
          lines: lines, markers: markers,
          xlabel: "Re c", ylabel: "Im c",
          title: "集合点云（" + fmt(nPts, 0) + " 个格点取 " + fmt(markers.length - probes.length, 0) +
            " 个）与解析边界；n_max = " + fmt(nmax, 0) + "，网格 " + MB_NX + "×" + MB_NY
        },
        metrics: {
          nmax: nmax, escR: MB_ESC_R, area: g.area, areaTrue: MB_AREA, inside: g.inside, halo: g.halo,
          cardArea: MB_CARD_AREA, diskArea: MB_DISK_AREA,
          curveC: cs, curveN: escN, markers: markers
        }
      };
    },
    tests: [
      // ① 逃逸判据就是 |z| > 2（严格大于）、且在**第一次**越界处停下：
      //    (a) c = −2 的 |z| 恰好 = 2 ⇒ 必须不逃逸；(b) 对若干探测点用独立循环复算首次越界步号，
      //    必须与模型例程给出的 n 完全一致。
      {
        name: "① 逃逸判据 |z| > 2（严格）：c = −2 不逃逸，且逃逸步号 = 首次越界步",
        params: { nmax: 300 },
        measure: function () {
          var bad = 0, a = mbEscape(-2, 0, 300);
          if (a.escaped || Math.abs(a.abs - 2) > 1e-12) bad++;
          var probes = [[-2.5, 0], [0.3, 0.5], [-1.3, 0], [0.26, 0], [0.4, 0.4], [0, 1.2], [-0.5, 0.6], [-1.75, 0]];
          for (var i = 0; i < probes.length; i++) {
            var cr = probes[i][0], ci = probes[i][1], e = mbEscape(cr, ci, 300);
            var zr = 0, zi = 0, k = 0, first = -1, absv = 0, t;
            while (k < 300) {
              t = zr * zr - zi * zi + cr; zi = 2 * zr * zi + ci; zr = t; k++;
              absv = Math.sqrt(zr * zr + zi * zi);
              if (absv > 2) { first = k; break; }
            }
            if (first < 0) { if (e.escaped) bad++; }
            else if (!e.escaped || e.n !== first) bad++;
          }
          return bad;
        },
        expect: 0, tol: 0
      },
      // ② 主心形线 c = e^{iθ}/2 − e^{2iθ}/4 上的点都不逃逸：边界上不动点的乘子模 = 1（中性），
      //    轨道始终留在 |z| ≤ 1/2（实测最大 ~0.83），所以“超出 2 的量”严格为 0。
      {
        name: "② 主心形线边界上的点迭代 n_max 次后 |z| ≤ 2（超出量 ±1e-6）",
        params: { nmax: 300 },
        measure: function (o, p) {
          var lim = Math.round(clamp(fin(num(p.nmax, 300), 300), 10, 500)), m = 0, k, th, e;
          for (k = 0; k < 240; k++) {
            th = 2 * Math.PI * k / 240;
            e = mbEscape(Math.cos(th) / 2 - Math.cos(2 * th) / 4, Math.sin(th) / 2 - Math.sin(2 * th) / 4, lim);
            m = Math.max(m, e.escaped ? Infinity : e.abs);
          }
          return Math.max(0, m - 2);
        },
        expect: 0, tol: 1e-6
      },
      // ③ 周期 2 圆盘 |c + 1| = 1/4 上的点都不逃逸（边界上 2-循环乘子模 = 1，|z| ≤ 1）。
      {
        name: "③ 周期 2 圆盘边界 |c+1| = 1/4 上的点不逃逸（|z| ≤ 2，超出量 ±1e-6）",
        params: { nmax: 300 },
        measure: function (o, p) {
          var lim = Math.round(clamp(fin(num(p.nmax, 300), 300), 10, 500)), m = 0, k, th, e;
          for (k = 0; k < 240; k++) {
            th = 2 * Math.PI * k / 240;
            e = mbEscape(-1 + Math.cos(th) / 4, Math.sin(th) / 4, lim);
            m = Math.max(m, e.escaped ? Infinity : e.abs);
          }
          return Math.max(0, m - 2);
        },
        expect: 0, tol: 1e-6
      },
      // ④ c = −2.5 在 |c| ≤ 2 之外：|z₁| = |c| = 2.5 > 2 ⇒ 第 1 步就逃逸。
      {
        name: "④ c = −2.5（圆盘/集合之外）在第 1 步逃逸",
        params: { nmax: 100 },
        measure: function () { var e = mbEscape(-2.5, 0, 100); return e.escaped && e.n === 1 ? 1 : 0; },
        expect: 1, tol: 0
      },
      // ⑤ c = 0 与 c = −1 都不逃逸（前者不动点 z = 0，后者 2-循环 0 → −1 → 0）。
      {
        name: "⑤ c = 0 与 c = −1 都不逃逸（0 个逃逸）",
        params: { nmax: 500 },
        measure: function () {
          var cnt = 0;
          if (mbEscape(0, 0, 500).escaped) cnt++;
          if (mbEscape(-1, 0, 500).escaped) cnt++;
          return cnt;
        },
        expect: 0, tol: 0
      },
      // ⑥ 解析边界的“面积标定”：对模型自己给出的参数曲线做鞋带公式，
      //    主心形线必须给出 3π/8 = 1.1780972450961724（这是主心形线参数式的解析面积，
      //    它同时校验了参数式的归一化：尖点 c = 1/4、圆盘半径 1/4 都由此确定）。
      //    多边形面积本身是 O(1/n²) 逼近，故用两组点做 Richardson 外推 (4A₂ − A₁)/3，
      //    残差降到 ~1e-13（n = 4000/8000；实测偏差 −9.3e-14）。
      {
        name: "⑥ 模型给出的主心形线参数式面积 = 3π/8 = 1.1780972450961724（±1e-9）",
        params: { nmax: 100 },
        measure: function () { return mbPolyArea2(mbCardioid); },
        expect: 3 * Math.PI / 8, tol: 1e-9
      },
      // ⑦ 周期 2 圆盘参数式的面积 = π/16 = 0.19634954084936207（同样用 Richardson 外推）。
      {
        name: "⑦ 模型给出的周期 2 圆盘参数式面积 = π/16 = 0.19634954084936207（±1e-9）",
        params: { nmax: 100 },
        measure: function () { return mbPolyArea2(mbDisk); },
        expect: Math.PI / 16, tol: 1e-9
      },
      // ⑧ 实轴上的集合恰是 [−2, 1/4]：区间内 100 个采样点全部不逃逸、区间外两端各 40 个
      //    采样点全部逃逸（n_max = 500 足够：c = 0.26 在第 30 步逃逸，c = −2.01 在第 1 步逃逸）。
      {
        name: "⑧ 实轴切片：c ∈ [−2, 1/4] 全部不逃逸、两侧外部全部逃逸（0 个例外）",
        params: { nmax: 500 },
        measure: function () {
          var bad = 0, i, c;
          for (i = 0; i < 100; i++) { c = -2 + 2.25 * i / 99; if (mbEscape(c, 0, 500).escaped) bad++; }
          for (i = 0; i < 40; i++) {
            c = 0.26 + 0.24 * i / 39;              // (1/4, 1/2]
            if (!mbEscape(c, 0, 500).escaped) bad++;
            c = -2.01 - 0.49 * i / 39;             // [−2.5, −2.01)
            if (!mbEscape(c, 0, 500).escaped) bad++;
          }
          return bad;
        },
        expect: 0, tol: 0
      },
      // ⑨ 面积估计随 n_max 单调下降（慢逃逸点被正确判为逃逸）并逼近真值：用统一的
      //    168×130 网格比较 n_max = 30 / 100 / 500（解析结论：真值 1.5065918849）。
      {
        name: "⑨ 网格面积估计随 n_max 单调下降：S(30) > S(100) > S(500) > 0（3 项全对）",
        params: { nmax: 100 },
        measure: function () {
          var a = mbGrid(120, 94, 30).area, b = mbGrid(120, 94, 100).area, c = mbGrid(120, 94, 500).area;
          return (a > b && b > c && c > 0) ? 3 : 0;
        },
        expect: 3, tol: 0
      },
      // ⑩ n_max = 500 的面积估计与真值 1.5065918849 的相对偏差 < 5%（实测 ~0.5%）。
      {
        name: "⑩ n_max = 500 的面积估计与真值 1.5065918849 的相对偏差 < 5%",
        params: { nmax: 500 },
        measure: function (o) { return Math.abs(o.metrics.area / MB_AREA - 1); },
        expect: 0, tol: 0.05
      },
      // ⑪ 边界安全：n_max = 10（滑块下限，边界很粗糙）与 500（上限）都不出 NaN/±∞。
      {
        name: "⑪ 边界安全：n_max = 10 与 500 的主图曲线与点云都无 NaN/±∞",
        params: { nmax: 10 },
        measure: function (o, p) {
          var lo = SIM.models.mandelbrot.compute({ nmax: 10 });
          var hi = SIM.models.mandelbrot.compute({ nmax: 500 });
          var i, ok = allFinite(o.series.esc) && allFinite(hi.series.esc) && allFinite(o.t);
          for (i = 0; i < o.metrics.markers.length; i++) {
            if (!isFinite(o.metrics.markers[i].x) || !isFinite(o.metrics.markers[i].y)) ok = false;
          }
          void lo; void p;
          return ok ? 1 : 0;
        },
        expect: 1, tol: 0
      }
    ]
  });

  /* ==========================================================================
     3. poincare —— 庞加莱截面与最大李雅普诺夫指数
     ==========================================================================
     洛伦兹系统    ẋ = σ(y − x)，ẏ = x(ρ − z) − y，ż = xy − βz，  ∇·F = −(σ + 1 + β)
     庞加莱截面    取平面 y = 0，记录轨道**从下往上**穿过（ẏ > 0）时的 (x, z)：
                   三维连续流被压成一张二维点图。周期轨道只留有限个点，混沌轨道留下
                   一层有分形结构的“云”（把轨迹条数 n 从 8 加到 50 只会让它更密、不会退化成曲线）；
                   ρ < 1（或 ρ 略大于 1 落在稳定不动点上）时轨道被吸到不动点，截面上的点消失。
     λ₁（Benettin）两条只差 ε = 1e-8 的轨道，每 τ = 0.5 时间单位量一次距离 d_i = |Δ|，
                   累加 ln(d_i/ε) 后把第二条轨道沿 Δ 方向拉回 ε：
                       λ₁(t) = (1/(kτ))·Σ_{i≤k} ln(d_i/ε)   —— 这条收敛曲线的末值就是 λ₁
                   τ 取 0.25 / 0.5 / 1 结果一致（自检里验证），说明对算法参数不敏感。
                   标准参数 (σ, ρ, β) = (10, 28, 8/3) 的文献值 λ₁ ≈ 0.9056；
                   模型用 β = 2.667 近似 8/3，并取 T = 3200：实测 0.8989（偏 −0.7%）。
     分离律        δ(t) = ε·e^{λ₁t} ⇒ ln|Δ(t)| vs t 的斜率就是 λ₁：
                   演示通道先跑 t = 5 让轨道落到吸引子上，再在 |Δ| ∈ [1e-7, 0.1] 的
                   指数增长段做最小二乘拟合（实测 0.876，与 λ₁ 相差 ~2.5%）。
     指数之和      λ₁ + λ₂ + λ₃ = ∇·F = −(σ+1+β)；自治连续流必有 λ₂ = 0（沿流动方向），
                   于是 λ₃ = −(σ+1+β) − λ₁（标准参数下 ≈ −14.57，与文献一致）。
     积分          RK4、步长 h = 0.005；截面用引擎的 SIM.rk4（需要整条轨迹做穿越检测），
                   λ₁ 用等价的无分配标量 RK4 逐段推进（要在一个时间段内做重正化）。
     ========================================================================== */
  var POIN_KINDS = ["庞加莱截面", "李雅普诺夫指数"];
  var POIN_H = 0.005;          // RK4 步长
  var POIN_T = 3200;           // λ₁ 的积分总时长（无量纲时间）
  var POIN_TAU = 0.5;          // 重正化间隔
  var POIN_EPS = 1e-8;         // 相邻轨道的初始距离
  var POIN_SEC_T = 60;         // 每条轨迹用于统计截面的时长
  var POIN_SEC_H = 0.005;
  var POIN_SKIP = 5;           // 分离演示：先跑一段让轨道落到吸引子上
  var POIN_SEP_T = 50;         // 分离演示的总时长
  var POIN_SEP_LO = 1e-7, POIN_SEP_HI = 0.1;   // 拟合窗口（|Δ| 的指数增长段）
  var POIN_Y0 = [1, 1, 1];     // 标准初值
  var POIN_LAM1_REF = 0.9056;  // (10, 28, 8/3) 的文献 λ₁
  var POIN_SEC_MAX = 1200;     // 截面 marker 上限

  /** 洛伦兹右端项（数组形式，供 SIM.rk4 用） */
  function lzField(sigma, rho, beta) {
    return function (t, y) {
      return [sigma * (y[1] - y[0]), y[0] * (rho - y[2]) - y[1], y[0] * y[1] - beta * y[2]];
    };
  }

  /** 无分配的标量 RK4 单步（与 SIM.rk4 同格式，只是不建数组：λ₁ 要推进 ~64 万步） */
  function lzStep(x, y, z, h, s, r, b, out) {
    var k1x = s * (y - x), k1y = x * (r - z) - y, k1z = x * y - b * z;
    var ax = x + h / 2 * k1x, ay = y + h / 2 * k1y, az = z + h / 2 * k1z;
    var k2x = s * (ay - ax), k2y = ax * (r - az) - ay, k2z = ax * ay - b * az;
    var bx = x + h / 2 * k2x, by = y + h / 2 * k2y, bz = z + h / 2 * k2z;
    var k3x = s * (by - bx), k3y = bx * (r - bz) - by, k3z = bx * by - b * bz;
    var cx = x + h * k3x, cy = y + h * k3y, cz = z + h * k3z;
    var k4x = s * (cy - cx), k4y = cx * (r - cz) - cy, k4z = cx * cy - b * cz;
    out[0] = x + h / 6 * (k1x + 2 * k2x + 2 * k3x + k4x);
    out[1] = y + h / 6 * (k1y + 2 * k2y + 2 * k3y + k4y);
    out[2] = z + h / 6 * (k1z + 2 * k2z + 2 * k3z + k4z);
    return out;
  }

  /**
   * λ₁（Benettin 重正化法）。返回 {lam, t, curve, renorm, broken}
   *   t / curve 是收敛曲线 λ₁(t)，用于 kind = 1 的主图（会抽样到 ~800 点再画）。
   */
  function poinLyap(sigma, rho, beta, tau, T, h, eps, y0) {
    var per = Math.max(1, Math.round(tau / h)), steps = Math.round(T / h);
    var a = [y0[0], y0[1], y0[2]], c = [a[0] + eps, a[1], a[2]];
    var tmp = [0, 0, 0], sum = 0, k = 0, i, dx, dy, dz, d, sc, lam = 0, broken = 0;
    var t = [], curve = [];
    for (i = 0; i < steps; i++) {
      lzStep(a[0], a[1], a[2], h, sigma, rho, beta, tmp); a = [tmp[0], tmp[1], tmp[2]];
      lzStep(c[0], c[1], c[2], h, sigma, rho, beta, tmp); c = [tmp[0], tmp[1], tmp[2]];
      if (!(isFinite(a[0]) && isFinite(c[0]))) { broken = 1; break; }
      if ((i + 1) % per === 0) {
        dx = c[0] - a[0]; dy = c[1] - a[1]; dz = c[2] - a[2];
        d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (!(d > 0) || !isFinite(d)) { broken = 1; break; }
        sum += Math.log(d / eps);
        k++;
        sc = eps / d;
        c = [a[0] + dx * sc, a[1] + dy * sc, a[2] + dz * sc];
        lam = sum / (k * tau);
        t.push((i + 1) * h);
        curve.push(lam);
      }
    }
    return { lam: k > 0 ? lam : NaN, t: t, curve: curve, renorm: k, broken: broken };
  }

  /**
   * 分离演示：先跑 tSkip 步（落吸引子），再造一对差 ε 的轨道，记录 ln|Δ(t)|。
   * 在 |Δ| ∈ [lo, hi] 的指数增长段做最小二乘拟合，斜率就是 λ₁（半对数斜率 = 指数增长率）。
   * 若窗口内没有点（例如 ρ < 1 时分离单调衰减），slope 返回 NaN，由调用方写成“—”。
   */
  function poinSep(sigma, rho, beta, eps, tSkip, T, h, y0, lo, hi) {
    var i, nSkip = Math.round(tSkip / h), nT = Math.round(T / h), tmp = [0, 0, 0];
    var a = [y0[0], y0[1], y0[2]];
    for (i = 0; i < nSkip; i++) { lzStep(a[0], a[1], a[2], h, sigma, rho, beta, tmp); a = [tmp[0], tmp[1], tmp[2]]; }
    var c = [a[0] + eps, a[1], a[2]];
    var t = [], ld = [], dx, dy, dz, d, under = 0;
    for (i = 0; i <= nT; i++) {
      dx = c[0] - a[0]; dy = c[1] - a[1]; dz = c[2] - a[2];
      d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (!(d > 0) || !isFinite(d)) { under = 1; break; }
      if (d > lo && d < hi) { t.push(tSkip + i * h); ld.push(Math.log(d)); }
      if (i < nT) {
        lzStep(a[0], a[1], a[2], h, sigma, rho, beta, tmp); a = [tmp[0], tmp[1], tmp[2]];
        lzStep(c[0], c[1], c[2], h, sigma, rho, beta, tmp); c = [tmp[0], tmp[1], tmp[2]];
      }
    }
    return { t: t, logd: ld, slope: lsqSlope(t, ld), n: t.length, underflow: under,
      t0: t.length ? t[0] : NaN, t1: t.length ? t[t.length - 1] : NaN };
  }

  /**
   * 一条轨迹的庞加莱截面点（y = 0 且 ẏ > 0）：用引擎的 SIM.rk4 积分整条轨迹，
   * 再在相邻采样点之间做线性插值定位穿越点。
   */
  function poinSection(sigma, rho, beta, T, h, y0) {
    var n = Math.round(T / h) + 1;
    var sol = rk4(lzField(sigma, rho, beta), [y0[0], y0[1], y0[2]], 0, T, n);
    var ys = sol.y[1], xs = sol.y[0], zs = sol.y[2], i, f, pts = [];
    for (i = 1; i < ys.length; i++) {
      if (ys[i - 1] < 0 && ys[i] >= 0) {
        f = ys[i] / (ys[i] - ys[i - 1]);
        pts.push([xs[i - 1] + (xs[i] - xs[i - 1]) * f, zs[i - 1] + (zs[i] - zs[i - 1]) * f]);
      }
    }
    return { pts: pts, t: sol.t, x: xs, y: ys, z: zs };
  }

  /** ρ 的霍普夫分岔阈值：ρ > ρ_H 时 C± 失稳（σ ≤ β+1 时 C± 对一切 ρ > 1 稳定） */
  function lzHopf(sigma, beta) {
    var d = sigma - beta - 1;
    return d > 1e-9 ? sigma * (sigma + beta + 3) / d : Infinity;
  }

  SIM.register("poincare", {
    title: "庞加莱截面与最大李雅普诺夫指数（洛伦兹系统）",
    legend: "枚举参数 kind 选显示方式：庞加莱截面（第二张图给出轨道每次从下往上穿过平面 y = 0 的 (x, z) 点）" +
      "或李雅普诺夫指数（主图是 λ₁(t) 的收敛曲线，读数区给出 λ₁）。截面上的点数由轨迹条数 n 控制：" +
      "n 越大点云越密，但混沌轨道的点云不会因此退化成曲线。",
    axes: {
      xlabel: "t（无量纲时间）",
      ylabel: "z(t)（截面档的轨迹）/ λ₁(t)（指数档的收敛曲线）"
    },
    params: {
      kind: { label: "显示方式", type: "enum", options: POIN_KINDS, def: 0 },
      rho: { label: "ρ（瑞利数）", unit: "", def: 28, min: 0, max: 50, step: 0.5 },
      sigma: { label: "σ（普朗特数）", unit: "", def: 10, min: 0, max: 20, step: 0.5 },
      beta: { label: "β", unit: "", def: 2.667, min: 0.5, max: 5, step: 0.001 },
      n: { label: "轨迹条数 n（截面点云密度）", unit: "", def: 8, min: 2, max: 50, step: 1 }
    },
    plots: [
      { key: "lyap", label: "λ₁(t) 收敛曲线", color: "#63d6a5" },
      { key: "trace", label: "z(t)（主轨道）", color: "#5aa9ff" }
    ],
    compute: function (p) {
      var ki = clamp(Math.round(fin(num(p.kind, 0), 0)), 0, POIN_KINDS.length - 1);
      var kindName = opt(POIN_KINDS, ki);
      var rho = clamp(fin(num(p.rho, 28), 28), 0, 50);
      var sigma = clamp(fin(num(p.sigma, 10), 10), 0, 20);
      var beta = clamp(fin(num(p.beta, 2.667), 2.667), 0.5, 5);
      var n = Math.round(clamp(fin(num(p.n, 8), 8), 2, 50));
      var i, k;

      /* --- ① λ₁（两种显示方式都要：读数区必须给 λ₁） --- */
      var ly = poinLyap(sigma, rho, beta, POIN_TAU, POIN_T, POIN_H, POIN_EPS, POIN_Y0);
      var div = -(sigma + 1 + beta);
      var lam3 = div - ly.lam;                           // λ₂ = 0（自治流）
      var sp = sepFor(sigma, rho, beta);                 // 分离演示（按参数缓存，info 与第二张图共用）

      /* --- ② 截面点集（extra 恒给）与主轨道轨迹 --- */
      var pts = [], first = null;
      for (k = 0; k < n; k++) {
        var sec = poinSection(sigma, rho, beta, POIN_SEC_T, POIN_SEC_H,
          [POIN_Y0[0] + 0.013 * k, POIN_Y0[1], POIN_Y0[2] + 0.007 * k]);
        if (k === 0) first = sec;
        for (i = 0; i < sec.pts.length; i++) pts.push(sec.pts[i]);
      }
      var stride = Math.max(1, Math.ceil(pts.length / POIN_SEC_MAX));
      var markers = [];
      for (i = 0; i < pts.length; i += stride) markers.push({ x: pts[i][0], y: pts[i][1] });

      /* 截面坐标范围：以标准吸引子的截面为基准，点落到基准外时再扩展（保证 ρ<1 时视野不缩到一点） */
      var xr = [-25, 25], zr = [-3, 50];
      for (i = 0; i < pts.length; i++) {
        if (pts[i][0] < xr[0]) xr[0] = pts[i][0];
        if (pts[i][0] > xr[1]) xr[1] = pts[i][0];
        if (pts[i][1] < zr[0]) zr[0] = pts[i][1];
        if (pts[i][1] > zr[1]) zr[1] = pts[i][1];
      }
      var padx = 0.05 * (xr[1] - xr[0]), padz = 0.05 * (zr[1] - zr[0]);
      var secLines = [{ x: [xr[0] - padx, xr[1] + padx], y: [zr[0] - padz, zr[1] + padz], label: "", color: "none" }];
      var hopf = lzHopf(sigma, beta);
      var secNote = "";
      if (!pts.length) {
        /* 一个穿越点都没有：轨道已经被吸到不动点上（把不动点在截面上的位置标出来） */
        if (rho <= 1 + 1e-9) {
          markers.push({ x: 0, y: 0, label: "轨道收敛到原点（恰在截面上，但 ẏ = 0，不算穿越）" });
          secNote = "0 个穿越点：ρ ≤ 1 时原点是全局稳定的，轨道从一侧趋近 y = 0，不再穿越截面";
        } else {
          var xs0 = Math.sqrt(Math.max(0, beta * (rho - 1)));
          markers.push({ x: xs0, y: rho - 1, label: "C₊ 在截面上的投影" });
          markers.push({ x: -xs0, y: rho - 1, label: "C₋ 在截面上的投影" });
          secNote = rho < hopf
            ? "0 个穿越点：轨道收敛到不动点 C± = (±" + fmt(xs0, 3) + ", ±" + fmt(xs0, 3) + ", " + fmt(rho - 1, 3) + ")，其 y ≠ 0，故不再穿越 y = 0"
            : "0 个穿越点：该参数下轨道在 [" + fmt(POIN_SEC_T, 0) + "] 时间内没有从下往上穿过 y = 0";
        }
      }

      var info = [
        { k: "显示方式 kind", v: kindName + "（枚举下标 " + ki + "）" },
        { k: "最大李雅普诺夫指数 λ₁", v: fmt(ly.lam, 6) + (ki === 1 ? "" : "（Benettin 重正化法，T = " + fmt(POIN_T, 0) + "）") },
        { k: "另两个指数", v: "λ₂ = 0（自治连续流沿流动方向必有零指数）；λ₃ = −(σ+1+β) − λ₁ = " + fmt(lam3, 4) },
        { k: "指数之和 = 相空间散度", v: fmt(ly.lam + lam3, 4) + "（理论 −(σ+1+β) = " + fmt(div, 4) + "）" },
        { k: "庞加莱截面（y = 0，ẏ > 0）", v: fmt(pts.length, 0) + " 个穿越点（" + fmt(n, 0) + " 条轨迹 × " + fmt(POIN_SEC_T, 0) + " 时间单位）" + (secNote ? "；" + secNote : "") },
        { k: "不动点", v: rho > 1 ? "原点 O（不稳定）+ C± = (±" + fmt(Math.sqrt(beta * (rho - 1)), 4) + ", ±" + fmt(Math.sqrt(beta * (rho - 1)), 4) + ", " + fmt(rho - 1, 4) + ")；C± 稳定的条件是 ρ < ρ_H = " + (isFinite(hopf) ? fmt(hopf, 3) : "∞") : "只有原点 O，且 ρ < 1 时全局稳定" },
        { k: "是否混沌", v: ly.lam > 0 ? "是（λ₁ > 0，轨道有界且指数分离）" : "否（λ₁ < 0：轨道收敛到不动点或极限环）" },
        {
          k: "算法参数（数值结果必须连参数一起报）",
          v: "RK4，h = " + fmt(POIN_H, 4) + "；重正化间隔 τ = " + fmt(POIN_TAU, 2) + "；初始差 ε = " + fmt(POIN_EPS, 0) + "；T = " + fmt(POIN_T, 0)
        },
        {
          k: "分离演示 ln|Δ(t)| 的拟合斜率",
          v: (isFinite(sp.slope) ? fmt(sp.slope, 5) : "—（分离单调衰减，未进入拟合窗口）") +
            "（窗口 |Δ| ∈ [" + fmt(POIN_SEP_LO, 0) + ", " + fmt(POIN_SEP_HI, 2) + "]，理论 = λ₁）"
        }
      ];

      /* --- ③ 主图 --- */
      var series = {}, t = [], series2 = null;
      if (ki === 1) {
        var tt = thin(ly.t, 800), cc = thin(ly.curve, 800);
        t = tt;
        series.lyap = cc;
        /* 第二张附加图：ln|Δ(t)| 与拟合直线（半对数斜率 = λ₁） */
        var fit = [];
        for (i = 0; i < sp.t.length; i++) fit.push(Math.log(POIN_EPS) + ly.lam * sp.t[i]);
        series2 = [{
          x: sp.t,
          series: [
            { label: "ln|Δ(t)|（相邻轨道，ε = 1e-8）", y: sp.logd, color: "#ffb84d" },
            { label: "拟合直线 ln ε + λ₁ t", y: fit, color: "#63d6a5", dash: "5 4" }
          ],
          xlabel: "t（无量纲）", ylabel: "ln|Δ(t)|（斜率 = λ₁）"
        }];
      } else {
        var tz = thin(first.t, 1200), zz = thin(first.z, 1200);
        t = tz;
        series.trace = zz;
      }

      return {
        t: t, series: series, info: info, series2: series2,
        bars: [
          { label: "λ₁（最大指数）", value: ly.lam, color: "#ff7b7b" },
          { label: "λ₂ = 0（自治流）", value: 0, color: "#7fd8e8" },
          { label: "λ₃ = 散度 − λ₁", value: lam3, color: "#5aa9ff" }
        ],
        extra: {
          markers: markers, lines: secLines,
          xlabel: "x", ylabel: "z",
          title: "庞加莱截面 y = 0（ẏ > 0）：" + fmt(pts.length, 0) + " 个穿越点（图上 " + fmt(markers.length, 0) + " 个标记）"
        },
        metrics: {
          kind: ki, rho: rho, sigma: sigma, beta: beta, n: n,
          lam1: ly.lam, lam2: 0, lam3: lam3, div: div, renorm: ly.renorm,
          sepSlope: sp.slope, sepN: sp.n,
          secCount: pts.length, secPts: pts, markers: markers, tau: POIN_TAU, eps: POIN_EPS,
          T: POIN_T, h: POIN_H
        }
      };
    },
    tests: [
      // ① 标准参数 (σ, ρ, β) = (10, 28, 8/3 ≈ 2.667) 的 λ₁ ≈ 0.9056（文献值，容差 5%）：
      //    T = 3200、τ = 0.5、ε = 1e-8，实测 0.8989（偏 −0.7%，主要来自有限 T 的收敛与 β 的取整）。
      {
        name: "① 洛伦兹 (10, 28, 8/3) 的 λ₁ ≈ 0.9056（容差 5%）",
        params: { kind: 1, rho: 28, sigma: 10, beta: 2.667, n: 8 },
        measure: function (o) { return o.metrics.lam1; },
        expect: POIN_LAM1_REF, tol: 0.05 * POIN_LAM1_REF
      },
      // ② 相邻轨道分离 ∝ e^{λ₁t}：半对数 ln|Δ(t)| 的斜率必须等于读数给出的 λ₁（容差 10%）。
      //    拟合窗口取 |Δ| ∈ [1e-7, 0.1]（指数增长段，未饱和），实测斜率 0.876 vs λ₁ 0.899 → 2.5%。
      {
        name: "② ln|Δ(t)| 的半对数斜率 = λ₁（相对偏差 < 10%）",
        params: { kind: 1, rho: 28, sigma: 10, beta: 2.667, n: 8 },
        measure: function (o) {
          var s = o.metrics.sepSlope, l = o.metrics.lam1;
          if (!isFinite(s) || !isFinite(l) || Math.abs(l) < 1e-12) return Infinity;
          return Math.abs(s - l) / Math.abs(l);
        },
        expect: 0, tol: 0.1
      },
      // ③ ρ < 1 时原点是全局稳定的 ⇒ λ₁ < 0（ρ = 0 / 0.5 / 0.9 三项都要为负）。
      {
        name: "③ ρ = 0 / 0.5 / 0.9 时 λ₁ < 0（收敛到不动点，3 项全对）",
        params: { kind: 1, rho: 0.5, sigma: 10, beta: 2.667, n: 8 },
        measure: function () {
          var list = [0, 0.5, 0.9], ok = 0, i;
          for (i = 0; i < list.length; i++) {
            var r = poinLyap(10, list[i], 2.667, POIN_TAU, POIN_T, POIN_H, POIN_EPS, POIN_Y0);
            if (isFinite(r.lam) && r.lam < 0) ok++;
          }
          return ok;
        },
        expect: 3, tol: 0
      },
      // ④ 同参数完全可重复（没有 Math.random）：两次 compute 的曲线逐点相同。
      {
        name: "④ 同参数完全可重复：两次运行的 λ₁(t) 曲线逐点相差 0",
        params: { kind: 1, rho: 28, sigma: 10, beta: 2.667, n: 4 },
        measure: function (o, p) {
          var a = SIM.models.poincare.compute({ kind: 1, rho: p.rho, sigma: p.sigma, beta: p.beta, n: p.n });
          var b = SIM.models.poincare.compute({ kind: 1, rho: p.rho, sigma: p.sigma, beta: p.beta, n: p.n });
          return maxDiff(a.series.lyap, b.series.lyap);
        },
        expect: 0, tol: 0
      },
      // ⑤ 数值结果对算法参数 τ 不敏感：τ = 0.25 与 τ = 1 的 λ₁ 相差 < 1%
      //    （τ 太长会把拉伸与折叠平均掉，τ 太短会放大数值误差 —— 这条自检就是“对算法参数不敏感”的纪律）。
      {
        name: "⑤ λ₁ 对重正化间隔不敏感：τ = 0.25 与 τ = 1 的相对差 < 1%",
        params: { kind: 1, rho: 28, sigma: 10, beta: 2.667, n: 4 },
        measure: function () {
          var a = poinLyap(10, 28, 2.667, 0.25, POIN_T, POIN_H, POIN_EPS, POIN_Y0).lam;
          var b = poinLyap(10, 28, 2.667, 1, POIN_T, POIN_H, POIN_EPS, POIN_Y0).lam;
          return Math.abs(a - b) / Math.abs(a);
        },
        expect: 0, tol: 0.01
      },
      // ⑥ 指数之和 = 相空间散度：λ₁ + λ₂ + λ₃ = −(σ+1+β)，λ₂ = 0（自治流）。
      //    散度是解析量，所以这条等价于核对 λ₃ 的定义与读数一致。
      {
        name: "⑥ λ₁ + λ₂ + λ₃ = −(σ+1+β) = −13.667（λ₂ = 0，±1e-9）",
        params: { kind: 1, rho: 28, sigma: 10, beta: 2.667, n: 8 },
        measure: function (o) { return o.metrics.lam1 + o.metrics.lam2 + o.metrics.lam3 + (10 + 1 + 2.667); },
        expect: 0, tol: 1e-9
      },
      // ⑦ 庞加莱截面：ρ = 28 的混沌吸引子上截面点数为正，且点数随轨迹条数 n 单调增
      //    （n = 2 < n = 8 < n = 50）；ρ = 0.5 时轨道被吸到原点，截面无穿越点。
      {
        name: "⑦ 截面点数：n = 2 < 8 < 50 严格递增，且 ρ = 0.5 时为 0（4 项全对）",
        params: { kind: 0, rho: 28, sigma: 10, beta: 2.667, n: 8 },
        measure: function (o) {
          var A = SIM.models.poincare, ok = 0;
          var c2 = A.compute({ kind: 0, rho: 28, sigma: 10, beta: 2.667, n: 2 }).metrics.secCount;
          var c8 = A.compute({ kind: 0, rho: 28, sigma: 10, beta: 2.667, n: 8 }).metrics.secCount;
          var c50 = A.compute({ kind: 0, rho: 28, sigma: 10, beta: 2.667, n: 50 }).metrics.secCount;
          var c05 = A.compute({ kind: 0, rho: 0.5, sigma: 10, beta: 2.667, n: 8 }).metrics.secCount;
          if (c2 > 0) ok++;
          if (c2 < c8) ok++;
          if (c8 < c50) ok++;
          if (c05 === 0) ok++;
          void o;
          return ok;
        },
        expect: 4, tol: 0
      },
      // ⑧ ρ = 22（C± 稳定的区间，ρ_H = σ(σ+β+3)/(σ−β−1) = 24.74）时 λ₁ < 0 —— 与“稳定不动点”一致。
      {
        name: "⑧ ρ = 22（C± 稳定区间，ρ_H = 24.74）时 λ₁ < 0",
        params: { kind: 1, rho: 22, sigma: 10, beta: 2.667, n: 8 },
        measure: function (o) { return o.metrics.lam1 < 0 ? 1 : 0; },
        expect: 1, tol: 0
      },
      // ⑨ 边界安全：σ = 0（ẋ ≡ 0）、β = 0.5 / 5、ρ = 0 / 50、n = 2 / 50 都不许 NaN/±∞。
      {
        name: "⑨ 边界安全：σ = 0/20、β = 0.5/5、ρ = 0/50、n = 2/50 都无 NaN/±∞",
        params: { kind: 1, rho: 28, sigma: 10, beta: 2.667, n: 2 },
        measure: function (o, p) {
          var A = SIM.models.poincare, cases = [
            { kind: 1, rho: 0, sigma: 0, beta: 0.5, n: 2 },
            { kind: 1, rho: 50, sigma: 20, beta: 5, n: 2 },
            { kind: 0, rho: 0, sigma: 0, beta: 5, n: 50 },
            { kind: 0, rho: 50, sigma: 20, beta: 0.5, n: 2 }
          ], i, r, ok = 1;
          for (i = 0; i < cases.length; i++) {
            r = A.compute(cases[i]);
            if (!isFinite(r.metrics.lam1) || !allFinite(r.t)) ok = 0;
            if (!allFinite(r.series.lyap || r.series.trace)) ok = 0;
            if (r.extra && r.extra.markers) {
              for (var j = 0; j < r.extra.markers.length; j++) {
                if (!isFinite(r.extra.markers[j].x) || !isFinite(r.extra.markers[j].y)) ok = 0;
              }
            }
          }
          void o; void p;
          return ok;
        },
        expect: 1, tol: 0
      }
    ]
  });

  /** 分离演示按 (σ, ρ, β) 缓存一次：同一参数在 info 与第二张图里要用到两次 */
  var SEP_CACHE = { key: "", val: null };
  function sepFor(sigma, rho, beta) {
    var key = sigma + "|" + rho + "|" + beta;
    if (SEP_CACHE.key !== key || !SEP_CACHE.val) {
      SEP_CACHE.key = key;
      SEP_CACHE.val = poinSep(sigma, rho, beta, POIN_EPS, POIN_SKIP, POIN_SEP_T, POIN_H, POIN_Y0, POIN_SEP_LO, POIN_SEP_HI);
    }
    return SEP_CACHE.val;
  }
})(typeof window !== "undefined" ? window : globalThis);
