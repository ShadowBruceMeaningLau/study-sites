/* ==========================================================================
   simlab-models-lab.js —— 实验数据处理 仿真模型（W6 契约 §14，5 个）

     · uncertainty     不确定度合成与误差传递：和差、积商、幂函数、A 类分量 s/√n
     · least-squares   最小二乘线性拟合：斜率/截距及其不确定度、R²、残差
     · counting-stats  计数统计与泊松分布：方差 = 均值、σ = √μ、1/√N
     · franck-hertz    弗兰克–赫兹实验：I–U 曲线的峰间距 = 第一激发电位
     · millikan        密立根油滴：电荷量子化、由各油滴电荷拟合元电荷

   ★ 约束（与 simlab.js 顶部一致）：
     · 加载时**只调用 SIM.register**，绝不触碰 DOM —— tools/verify-simlab.mjs 在 Node 里
       用 window 桩直接跑 compute() 与 tests 做物理不变量自检；
     · **不调用 Math.random**（全文没有 random() 调用）：least-squares、counting-stats、
       millikan 的随机数全部来自文件内自带的 mulberry32（带种子），
       同一个 seed 的序列**逐位可重复**；
     · 纯 ES5：var / 无箭头函数 / 无模板字符串 / 无 import-export；
     · 边界安全：任意滑块取值都不抛异常、不出 NaN/±∞（每个模型都带边界自检：
       least-squares 的 n = 3 与 s_y = 0、counting-stats 的 μ = 1、uncertainty 的 u = 0、
       franck-hertz 的大 V_r、millikan 的 noise = 0 都覆盖到了）。

   每个模型的自检（tests）里，expect 都是**解析值**（公式写在注释里），measure 尽量从
   series / metrics 现场重算，而不是把模型自己报的数原样搬过来当期望值。
   ========================================================================== */
(function (global) {
  "use strict";
  var SIM = global.SIM;
  if (!SIM) return;   // 在 Node 里若未先加载 simlab.js，安静退出

  var lin = SIM.linspace, fmt = SIM.fmt, opt = SIM.opt;

  /* --------------------------------------------------------------- 通用小工具 */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  /** 参数安全取值：课程 config 不受滑块范围限制，NaN/越界/非数字都换成默认值 */
  function num(v, defv) { var x = Number(v); return isFinite(x) ? x : defv; }
  /** 有限性兜底：把 NaN/±Infinity 换成 fallback */
  function fin(v, fb) { return isFinite(v) ? v : fb; }
  /** 安全除法：分母过小就返回 fallback */
  function div(a, b, fb) { return Math.abs(b) > 1e-300 ? a / b : fb; }
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
   * mulberry32：32 位状态的带种子 PRNG（自带的，不用 Math.random）。
   *   a ← a + 0x6D2B79F5；t ← (a ^ (a>>>15))·(1|a)；t ← (t + (t^(t>>>7))·(61|t)) ^ t；u = (t^(t>>>14))/2³²
   * 全部是 32 位整数运算（Math.imul），所以同一 seed 的序列逐位可重复。
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
  /** Box–Muller 标准正态抽样（用同一个随机流，保证同 seed 可重复） */
  function gauss(rnd) {
    var u = rnd(), v = rnd();
    if (u < 1e-300) u = 1e-300;             // 保护 log(0) → −∞
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  /** 截尾正态抽样：|z| ≤ lim（用于把“整数倍判定”的失败概率压到可接受范围） */
  function gaussClip(rnd, lim) {
    var z = gauss(rnd);
    if (z > lim) z = lim;
    if (z < -lim) z = -lim;
    return z;
  }
  /**
   * ln Γ(x)（Lanczos g = 7，n = 9）：泊松概率 P(k; μ) = e^(−μ + k ln μ − lnΓ(k+1))
   * 直接用对数算，μ = 10⁴ 时既不会上溢也不会下溢，比连乘稳定得多。
   */
  function lgamma(x) {
    var g = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
      771.32342877765313, -176.61502916214059, 12.507343278686905,
      -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
    x -= 1;
    var a = g[0], t = x + 7.5, i;
    for (i = 1; i < 9; i++) a += g[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  /** 泊松概率质量函数 P(N = k; μ)（k 允许非整数 —— 只作曲线插值用） */
  function poissonPmf(mu, k) {
    if (k < 0) return 0;
    var lnp = -mu + k * Math.log(Math.max(mu, 1e-300)) - lgamma(k + 1);
    return lnp < -700 ? 0 : Math.exp(lnp);
  }

  /* ==========================================================================
     1. uncertainty —— 不确定度合成与误差传递
     ==========================================================================
     三个视图共用滑块 x、u(x)、y、u(y)，「多次测量」另有测量次数 n：

     ① 直接测量合成：一个量既有多测的分散（A 类分量 u_A），又有仪器误差限（B 类分量
        u_B），两类来源互不相关 ⇒ **方差相加**：
          u_c = √(u_A² + u_B²)                                              …(1)
        本视图把 u(x) 当 A 类分量、u(y) 当 B 类分量；横轴扫的是“A 类分量占满量程的
        比例 s”，于是 u_c(s) = √((s·u_A)² + u_B²)。两分量相等时 u_c = 1.41·u_A
        （不是 2·u_A）；一大一小时，小的那个几乎不影响结果。

     ② 误差传递：由 z = f(x, y) 的全微分 df = (∂f/∂x)dx + (∂f/∂y)dy，各自变量独立时
        方差相加（一阶线性传播）：
          和差     z = x ± y        u_z = √(u_x² + u_y²)                     …(2)
          积商     z = x·y（x/y）  u_z/|z| = √((u_x/x)² + (u_y/y)²)          …(3)
          幂函数   z = x^n          u_z/|z| = |n|·u_x/|x|                     …(4)
          幂律组合 z = x·y^(−2)     u_z/|z| = √((u_x/x)² + (2u_y/y)²)         …(5)
        (5) 是实验里最常遇到的组合：单摆 g = 4π²l/T²、圆柱密度 ρ = 4m/(πd²h) 都是这个
        形状 —— 第二分量带 −2 次幂，它的**相对**不确定度要先乘 2 再进平方和。主图画
        的正是 (5)。(2) 是**严格**的（独立随机变量之和的方差等于方差之和，不需要小量
        近似），(3)(4)(5) 是一阶近似，要求各相对不确定度 ≪ 1。
        本模型还用 12000 次蒙特卡洛抽样独立核对 (2)：X ~ x ± u_x、Y ~ y ± u_y 独立
        抽样时 std(X+Y) 必须等于 √(u_x² + u_y²)（读数在 info 里给出）。

     ③ 多次测量：单次读数的样本标准差 s（= u(x)）经 n 次平均后压缩成
          u_A = s/√n                                                        …(6)
        读数由固定形状 z_i 构造：读数_i = x + s·(z_i − z̄)/s_z，标准化之后任意 n 都有
        “读数平均值 = x、样本标准差 = s”严格成立（自检④b/④c 就查这两条）。
        合成值 u_c = √(u_A² + u_B²)（u_B = u(y)）随 n 下降，但**压不到 u_B 以下** ——
        这就是“多测几次有用，但只能把随机误差那一路压下去”的定量版本。

     自检依据（都在注释里给了公式，expect 是解析值）：
       ①  u_{x±y} = √(u_x²+u_y²)：x=10, u_x=0.1, y=4, u_y=0.05 ⇒ √0.0125 = 0.111803398874989
       ①b 蒙特卡洛独立核对：12000 次抽样的 std(X+Y) 与 √(u_x²+u_y²) 相对偏差 < 3%
       ②  u_{xy}/(xy) = √((u_x/x)²+(u_y/y)²) = √(1e-4+1.5625e-4) = 0.016007810593582
       ②b u_{xy} = |40| × 0.016007810593582 = 0.640312423743
       ③  u_{x^n}/(x^n) = |n|·u_x/x：n = 2 → 2×0.1/10 = 0.02；n = 3 → 0.03
       ④  u_A = s/√n：s = 0.021、n = 6 ⇒ 0.021/√6 = 0.008573214099741
       ④b/④c 读数（按 n−1 公式独立重算）的样本标准差 = u(x)、平均值 = x
       ⑤  u_c 对 u_A、u_B 都单调增（沿曲线 101 个扫描点核对 + 参数端点核对）
       ⑥  幂律组合 (5)：单摆例（l=0.998, u_l=0.0006；T=2.008, u_T=0.0023）给出
           2.368412e-3；圆柱密度例（m=50, u_m=0.0058；d=20.03, u_d=0.014）给出
           1.402708e-3 —— 都是实验课上要手算对照的数
       ⑦  边界安全：u = 0、u = 5、n = 2/50、x 取两端都无 NaN/±∞
     ========================================================================== */
  var UNC_KINDS = ["直接测量合成", "误差传递", "多次测量"];
  /**
   * 固定的 50 个“标准读数形状”（自带种子的正态样本，只用它的形状）。
   * 取前 n 个后做标准化（减均值、除样本标准差），于是任意 n ≥ 2 都严格满足
   *     平均值 = 0、样本标准差 = 1
   * ⇒ 读数_i = x + s·z_i 的平均值严格等于 x、样本标准差严格等于 s（自检④b/④c）。
   */
  var UNC_Z = (function () {
    var r = mulberry32(20250502), a = [], i;
    for (i = 0; i < 50; i++) a.push(gauss(r));
    return a;
  })();
  var UNC_MC = 12000;              // 蒙特卡洛核对和差传递的抽样次数
  var UNC_MC_SEED = 20250501;      // 固定种子（与滑块无关 ⇒ 读数稳定可复现）

  /** 取前 n 个标准形状并标准化：平均值 0、样本标准差 1（无偏，除以 n−1） */
  function uncShape(n) {
    var k = Math.round(clamp(num(n, 6), 2, 50)), z = UNC_Z.slice(0, k), m = 0, v = 0, i;
    for (i = 0; i < z.length; i++) m += z[i];
    m /= z.length;
    for (i = 0; i < z.length; i++) v += (z[i] - m) * (z[i] - m);
    v = Math.sqrt(v / (z.length - 1));
    for (i = 0; i < z.length; i++) z[i] = v > 0 ? (z[i] - m) / v : 0;
    return z;
  }
  /** 样本标准差（无偏，除以 n−1） */
  function uncSampleStd(rd) {
    var n = rd.length, m = 0, v = 0, i;
    if (n < 2) return 0;
    for (i = 0; i < n; i++) m += rd[i];
    m /= n;
    for (i = 0; i < n; i++) v += (rd[i] - m) * (rd[i] - m);
    return Math.sqrt(v / (n - 1));
  }

  SIM.register("uncertainty", {
    title: "不确定度合成与误差传递",
    legend: "把“测出来的数有多可信”算清楚：A 类分量由重复测量的分散度 s 经 u_A = s/√n 压出来，" +
      "B 类分量来自仪器误差限，两类按方差相加合成 u_c = √(u_A² + u_B²)（相等时 u_c = 1.41u_A）；" +
      "再经全微分传到间接测量量上：和差是方差相加，积商是相对不确定度平方相加，幂函数乘 |n|，" +
      "而实验里最常见的幂律组合 z = x·y⁻²（g = 4π²l/T²、ρ = 4m/(πd²h)）把第二分量的相对" +
      "不确定度乘 2 再进平方和 —— 主图画的就是它。",
    axes: {
      xlabel: "扫描变量（A 类分量比例 s ／ 第二分量比例 s ／ 测量次数 k）",
      ylabel: "不确定度 u（与测量值同单位）"
    },
    params: {
      kind: { label: "视图", type: "enum", options: UNC_KINDS, def: 0 },
      x: { label: "测量值 x", unit: "", def: 10, min: 0.1, max: 100, step: 0.1 },
      ux: { label: "该量的不确定度 u(x)", unit: "", def: 0.1, min: 0.001, max: 5, step: 0.001 },
      y: { label: "第二测量值 y", unit: "", def: 4, min: 0.1, max: 100, step: 0.1 },
      uy: { label: "第二量的不确定度 u(y)", unit: "", def: 0.05, min: 0.001, max: 5, step: 0.001 },
      // ★ n 是本模型相对契约 §14 的**附加**参数：多次测量视图必须让学生能把测量次数
      //   从 2 调到 50（实验课 data/physics-lab-1.js 的任务明确要求改 n），
      //   契约给的 5 个参数一个没动、含义也没变。
      n: { label: "测量次数 n（多次测量视图）", unit: "次", def: 6, min: 2, max: 50, step: 1 }
    },
    plots: [{ key: "uc", label: "合成不确定度 u_c", color: "#5aa9ff" }],
    compute: function (p) {
      var kindName = opt(UNC_KINDS, p.kind);
      var kind = Math.max(0, UNC_KINDS.indexOf(kindName));
      var x = num(p.x, 10), ux = Math.abs(num(p.ux, 0.1));
      var y = num(p.y, 4), uy = Math.abs(num(p.uy, 0.05));
      var nrep = Math.round(clamp(num(p.n, 6), 2, 50));
      var ax = Math.max(Math.abs(x), 1e-12);           // 相对不确定度的分母护栏
      var ay = Math.max(Math.abs(y), 1e-12);

      // n 次重复读数（标准形状 × 分散度 s = u(x)）：平均值 = x、样本标准差 = s（严格）
      var shape = uncShape(nrep), rd = [], i;
      for (i = 0; i < nrep; i++) rd.push(x + ux * shape[i]);
      var sRead = uncSampleStd(rd);

      // 误差传递的四条解析式（与视图无关，info 里都会列出来）
      var uSum = Math.sqrt(ux * ux + uy * uy);                                      // (2) 和差
      var relProd = Math.sqrt((ux / ax) * (ux / ax) + (uy / ay) * (uy / ay));       // (3) 积商相对
      var uProd = Math.abs(x * y) * relProd;
      var relPow2 = 2 * (ux / ax), relPow3 = 3 * (ux / ax);                         // (4) 幂函数
      var uPow2 = Math.abs(x * x) * relPow2;
      var relPow = Math.sqrt((ux / ax) * (ux / ax) + (2 * uy / ay) * (2 * uy / ay)); // (5) x·y^(−2)
      var zPow = Math.abs(x) / Math.max(y * y, 1e-12);
      var uPow = zPow * relPow;

      var ts = [], uc = [], info = [], bars = [], extra = null;
      var ucNow = 0, relNow = 0, mcRatio = NaN, mcStd = NaN;
      var SS = 101, k;

      if (kind === 0) {
        // ① 直接测量合成：u_c = √(u_A² + u_B²)，横轴扫 A 类分量（u_A → s·u_A）
        var uA0 = ux, uB0 = uy;
        ucNow = Math.sqrt(uA0 * uA0 + uB0 * uB0);
        relNow = ucNow / ax;
        for (k = 0; k < SS; k++) {
          var sc = (2 * k) / (SS - 1);
          ts.push(sc);
          uc.push(Math.sqrt((sc * uA0) * (sc * uA0) + uB0 * uB0));
        }
        var smallPct = 100 * div(Math.min(uA0, uB0) * Math.min(uA0, uB0), ucNow * ucNow, 0);
        info.push({ k: "A 类分量 u_A（重复测量的分散度）", v: fmt(uA0, 6) });
        info.push({ k: "B 类分量 u_B（仪器误差限）", v: fmt(uB0, 6) });
        info.push({ k: "合成不确定度 u_c = √(u_A²+u_B²)", v: fmt(ucNow, 6) });
        info.push({ k: "相对不确定度 u_c/|x|", v: fmt(relNow * 100, 4) + " %" });
        info.push({ k: "结果表达式", v: "x = " + fmt(x, 6) + " ± " + fmt(ucNow, 6) + "（" + fmt(relNow * 100, 3) + " %）" });
        info.push({ k: "两分量相等时 u_c/u_A", v: fmt(Math.sqrt(2), 5) + "（= √2，不是 2）" });
        info.push({ k: "较小分量占总方差的份额", v: fmt(smallPct, 4) + " %（差 6 倍时不到 3%）" });
        info.push({ k: "横轴：A 类分量比例 s（u_A → s·u_A）", v: "u_c(s) = √((s·u_A)² + u_B²)，s 从 0 到 2" });
        bars.push({ label: "A 类分量 u_A", value: uA0, color: "#5aa9ff" });
        bars.push({ label: "B 类分量 u_B", value: uB0, color: "#ffb84d" });
        bars.push({ label: "合成 u_c", value: ucNow, color: "#63d6a5" });
      } else if (kind === 1) {
        // ② 误差传递：主图画幂律组合 z = x·y^(−2) 的绝对不确定度随第二分量贡献的变化
        ucNow = uPow;
        relNow = relPow;
        var j;
        for (j = 0; j < SS; j++) {
          var sc2 = (2 * j) / (SS - 1);
          ts.push(sc2);
          uc.push(zPow * Math.sqrt((ux / ax) * (ux / ax) +
            (2 * sc2 * uy / ay) * (2 * sc2 * uy / ay)));
        }
        // 蒙特卡洛核对 (2)：独立抽样下 Var(X+Y) = u_x² + u_y²（严格成立）
        var rnd = mulberry32(UNC_MC_SEED), s1 = 0, s2m = 0, t, w;
        for (t = 0; t < UNC_MC; t++) {
          w = (x + ux * gauss(rnd)) + (y + uy * gauss(rnd));
          s1 += w; s2m += w * w;
        }
        var mcMean = s1 / UNC_MC;
        var mcVar = Math.max(0, s2m / UNC_MC - mcMean * mcMean);
        mcStd = Math.sqrt(mcVar);
        mcRatio = div(mcStd, uSum, 0);
        info.push({ k: "幂律组合 u(x·y⁻²)/|x·y⁻²| = √((u_x/x)²+(2u_y/y)²)", v: fmt(relPow * 100, 6) + " %（g = 4π²l/T²、ρ = 4m/(πd²h) 都是这个形状）" });
        info.push({ k: "幂律组合的绝对不确定度 u(x·y⁻²)", v: fmt(uPow, 6) + "（主图画的就是它）" });
        info.push({ k: "和差传递 u(x±y) = √(u_x²+u_y²)", v: fmt(uSum, 6) });
        info.push({ k: "积商传递 u(xy)/(xy) = √((u_x/x)²+(u_y/y)²)", v: fmt(relProd * 100, 6) + " %" });
        info.push({ k: "积商传递的绝对不确定度 u(xy)", v: fmt(uProd, 6) });
        info.push({ k: "幂函数 u(x²)/(x²) = 2·u_x/x", v: fmt(relPow2 * 100, 6) + " %" });
        info.push({ k: "幂函数 u(x³)/(x³) = 3·u_x/x", v: fmt(relPow3 * 100, 6) + " %" });
        info.push({ k: "幂函数绝对不确定度 u(x²)", v: fmt(uPow2, 6) });
        info.push({
          k: "蒙特卡洛核对 std(X+Y)（" + UNC_MC + " 次抽样）",
          v: fmt(mcStd, 6) + "（解析 " + fmt(uSum, 6) + "，比值 " + fmt(mcRatio, 6) + "）"
        });
        info.push({ k: "横轴：第二分量的比例 s（u_y → s·u(y)）", v: "主图画 z = x·y⁻² 的绝对不确定度" });
        bars.push({ label: "幂律组合相对 u/z", value: relPow, color: "#5aa9ff" });
        bars.push({ label: "积商相对 u/(xy)", value: relProd, color: "#ffb84d" });
        bars.push({ label: "和差绝对 u(x±y)", value: uSum, color: "#63d6a5" });
      } else {
        // ③ 多次测量：u_A = s/√n 随 n 下降，但合成值被 B 类分量挡住
        var uA2 = sRead / Math.sqrt(nrep);
        ucNow = Math.sqrt(uA2 * uA2 + uy * uy);
        relNow = ucNow / ax;
        var m;
        for (m = 1; m <= nrep; m++) {
          ts.push(m);
          uc.push(Math.sqrt((sRead / Math.sqrt(m)) * (sRead / Math.sqrt(m)) + uy * uy));
        }
        info.push({ k: "单次读数的样本标准差 s（= u(x)）", v: fmt(sRead, 6) });
        info.push({ k: "测量次数 n", v: fmt(nrep, 0) + " 次（u_A 只按 1/√n 下降）" });
        info.push({ k: "A 类分量 u_A = s/√n", v: fmt(uA2, 6) });
        info.push({ k: "B 类分量 u_B（= u(y)）", v: fmt(uy, 6) });
        info.push({ k: "合成不确定度 u_c = √(u_A²+u_B²)", v: fmt(ucNow, 6) });
        info.push({ k: "相对不确定度 u_c/|x|", v: fmt(relNow * 100, 4) + " %" });
        info.push({ k: "读数平均值 x̄（严格等于 x）", v: fmt(x, 6) });
        info.push({ k: "u_A 掉到 u_B 时的测量次数", v: "n = (s/u_B)² = " + fmt(div(sRead * sRead, uy * uy, Infinity), 3) + "（再往上加收益迅速变小）" });
        info.push({ k: "横轴：测量次数 k", v: "曲线是 u_c(k) = √((s/√k)² + u_B²)" });
        bars.push({ label: "单次读数 s", value: sRead, color: "#5aa9ff" });
        bars.push({ label: "A 类 u_A = s/√n", value: uA2, color: "#63d6a5" });
        bars.push({ label: "B 类 u_B（地板）", value: uy, color: "#ffb84d" });
      }

      if (!allFinite(uc)) uc = ts.map(function () { return 0; });   // 兜底：曲线不允许非有限值

      return {
        t: ts,
        series: { uc: uc },
        info: info,
        bars: bars,
        extra: extra,
        metrics: {
          kind: kind, kindName: kindName, x: x, ux: ux, y: y, uy: uy, n: nrep,
          readings: rd, shape: shape, mean: x, s: sRead, uA: sRead / Math.sqrt(nrep),
          uc: ucNow, relUC: relNow,
          uSum: uSum, uProd: uProd, relProd: relProd,
          relPow2: relPow2, relPow3: relPow3, uPow2: uPow2,
          relPow: relPow, uPow: uPow, zPow: zPow,
          mcStd: mcStd, mcRatio: mcRatio, scan: uc, ts: ts
        }
      };
    },
    tests: [
      // ① 和差传递 u_{x±y} = √(u_x² + u_y²)（独立随机变量之和的方差严格相加）
      //    x = 10、u_x = 0.1、y = 4、u_y = 0.05 ⇒ √(0.1² + 0.05²) = √0.0125 = 0.111803398874989
      {
        name: "① 和差传递 u(x±y) = √(u_x²+u_y²) = √0.0125 = 0.111803398874989",
        params: { kind: 1, x: 10, ux: 0.1, y: 4, uy: 0.05 },
        measure: function (o) { return o.metrics.uSum; },
        expect: 0.111803398874989, tol: 1e-12
      },
      // ①b 蒙特卡洛独立核对：X ~ (x, u_x)、Y ~ (y, u_y) 独立抽样 12000 次，
      //     std(X+Y) 与解析值 √(u_x²+u_y²) 的相对偏差应在统计误差内（1/√(2·12000) = 0.65%）
      {
        name: "①b 蒙特卡洛独立核对：std(X+Y) 与 √(u_x²+u_y²) 相对偏差 < 3%",
        params: { kind: 1, x: 10, ux: 0.1, y: 4, uy: 0.05 },
        measure: function (o) { return Math.abs(o.metrics.mcRatio - 1); },
        expect: 0, tol: 0.03
      },
      // ② 积商传递：相对不确定度 √((u_x/x)²+(u_y/y)²)
      //    = √((0.1/10)² + (0.05/4)²) = √(1e-4 + 1.5625e-4) = 0.016007810593582
      {
        name: "② 积商传递 u(xy)/(xy) = √((u_x/x)²+(u_y/y)²) = 0.016007810593582",
        params: { kind: 1, x: 10, ux: 0.1, y: 4, uy: 0.05 },
        measure: function (o) { return o.metrics.relProd; },
        expect: 0.016007810593582, tol: 1e-12
      },
      // ②b 绝对不确定度 u(xy) = |xy|·0.016007810593582 = 40 × 0.016007810593582 = 0.640312423743
      {
        name: "②b 积商绝对不确定度 u(xy) = |xy|·0.016007810593582 = 0.640312423743",
        params: { kind: 1, x: 10, ux: 0.1, y: 4, uy: 0.05 },
        measure: function (o) { return o.metrics.uProd; },
        expect: 0.64031242374328, tol: 1e-12
      },
      // ③ 幂函数 u(x^n)/(x^n) = |n|·u_x/x：n = 2 → 2×0.1/10 = 0.02；n = 3 → 0.03
      {
        name: "③ 幂函数 u(x²)/(x²) = 2·u_x/x = 0.02",
        params: { kind: 1, x: 10, ux: 0.1, y: 4, uy: 0.05 },
        measure: function (o) { return o.metrics.relPow2; },
        expect: 0.02, tol: 1e-12
      },
      {
        name: "③b 幂函数 u(x³)/(x³) = 3·u_x/x = 0.03",
        params: { kind: 1, x: 10, ux: 0.1, y: 4, uy: 0.05 },
        measure: function (o) { return o.metrics.relPow3; },
        expect: 0.03, tol: 1e-12
      },
      // ④ A 类分量 u_A = s/√n。s = 0.021（单次读数的样本标准差，滑块直接给的就是 s）、
      //    n = 6 ⇒ u_A = 0.021/√6 = 0.008573214099741（解析值，实验课要手算对照的数）
      {
        name: "④ A 类分量 u_A = s/√n = 0.021/√6 = 0.008573214099741",
        params: { kind: 2, x: 20.03, ux: 0.021, y: 39.98, uy: 0.012, n: 6 },
        measure: function (o) { return o.metrics.uA; },
        expect: 0.008573214099741, tol: 1e-12
      },
      // ④b 读数（按 n−1 公式从 metrics.readings 独立重算）的样本标准差必须 = u(x) = 0.021
      {
        name: "④b 读数的样本标准差 = u(x) = 0.021（独立按 n−1 公式重算，容差 1e-12）",
        params: { kind: 2, x: 20.03, ux: 0.021, y: 39.98, uy: 0.012, n: 6 },
        measure: function (o) { return uncSampleStd(o.metrics.readings); },
        expect: 0.021, tol: 1e-12
      },
      // ④c 读数的平均值必须严格等于 x（标准化形状的推论）
      {
        name: "④c 读数的平均值 = x（n = 6 与 n = 50 都核对）",
        params: { kind: 2, x: 20.03, ux: 0.021, y: 39.98, uy: 0.012, n: 6 },
        measure: function (o, q) {
          var a = o.metrics.readings, b = uncComputeFor(q, { n: 50 }).metrics.readings, i, m = 0, m2 = 0;
          for (i = 0; i < a.length; i++) m += a[i];
          for (i = 0; i < b.length; i++) m2 += b[i];
          return Math.max(Math.abs(m / a.length - 20.03), Math.abs(m2 / b.length - 20.03));
        },
        expect: 0, tol: 1e-12
      },
      // ⑤ 合成不确定度随任一分量单调增：既沿曲线 101 个扫描点核对，也在参数端点核对
      {
        name: "⑤ u_c 随 u_A、u_B 单调增（曲线 101 点无一下降 + 参数端点核对）",
        params: { kind: 0, x: 10, ux: 0.1, y: 4, uy: 0.05, n: 6 },
        measure: function (o, q) {
          var i, sc = o.metrics.scan;
          for (i = 1; i < sc.length; i++) if (!(sc[i] >= sc[i - 1])) return 9;
          var lo = uncComputeFor(q, { ux: 0.001, uy: 0.001 }), hi = uncComputeFor(q, { ux: 5, uy: 5 });
          if (!(lo.metrics.uc < o.metrics.uc && o.metrics.uc < hi.metrics.uc)) return 8;
          var onlyX = uncComputeFor(q, { ux: 4, uy: 0.001 }), onlyY = uncComputeFor(q, { ux: 0.001, uy: 4 });
          if (!(onlyX.metrics.uc > uncComputeFor(q, { ux: 0.1, uy: 0.001 }).metrics.uc)) return 7;
          if (!(onlyY.metrics.uc > uncComputeFor(q, { ux: 0.001, uy: 0.05 }).metrics.uc)) return 6;
          return 0;
        },
        expect: 0, tol: 0
      },
      // ⑤b 直接测量合成就是契约①的同一条公式（u_c = √(u_x²+u_y²)）：
      //     x 分量 0.1、B 分量 0.05 ⇒ 0.111803398874989
      {
        name: "⑤b 直接测量合成 u_c = √(0.1²+0.05²) = 0.111803398874989",
        params: { kind: 0, x: 10, ux: 0.1, y: 4, uy: 0.05, n: 6 },
        measure: function (o) { return o.metrics.uc; },
        expect: 0.111803398874989, tol: 1e-12
      },
      // ⑥ 幂律组合 z = x·y^(−2)（实验课的两个例子，手算值）：
      //    · 单摆 l = 0.998、u_l = 0.0006；T = 2.008、u_T = 0.0023
      //      ⇒ √((0.0006/0.998)² + (2×0.0023/2.008)²) = 2.368412317e-3
      //    · 圆柱密度 m = 50、u_m = 0.0058；d = 20.03、u_d = 0.014
      //      ⇒ √((0.0058/50)² + (2×0.014/20.03)²) = 1.402707811e-3
      {
        name: "⑥ 幂律组合 u(z)/|z|（z = x·y⁻²）：单摆例 = 2.368412317e-3（容差 1e-12）",
        params: { kind: 1, x: 0.998, ux: 0.0006, y: 2.008, uy: 0.0023, n: 6 },
        measure: function (o) { return o.metrics.relPow; },
        expect: 0.002368412317154, tol: 1e-12
      },
      {
        name: "⑥b 幂律组合（圆柱密度例 m/d²）：= 1.402707811e-3（容差 1e-12）",
        params: { kind: 1, x: 50, ux: 0.0058, y: 20.03, uy: 0.014, n: 6 },
        measure: function (o) { return o.metrics.relPow; },
        expect: 0.001402707811196, tol: 1e-12
      },
      // ⑦ 边界安全：u_x = 0（无不确定度）、u_x = 5（滑块上限）、n = 2/50、x 取两端，
      //    三个视图都不许 NaN/±∞
      {
        name: "⑦ 边界安全：u = 0、u = 5、n = 2/50、x = 0.1/100 无 NaN/±∞",
        params: { kind: 0, x: 10, ux: 0, y: 4, uy: 0.05, n: 2 },
        measure: function (o, q) {
          var a = uncComputeFor(q, { ux: 0, uy: 0, x: 0.1 });
          var b = uncComputeFor(q, { ux: 5, uy: 5, x: 100, n: 50 });
          var c = uncComputeFor({ kind: 1, x: 10, ux: 0.1, y: 4, uy: 0.05, n: 6 }, { ux: 0 });
          var d = uncComputeFor({ kind: 2, x: 10, ux: 0, y: 4, uy: 0.05, n: 50 }, {});
          var e = uncComputeFor({ kind: 2, x: 10, ux: 0.5, y: 4, uy: 0, n: 2 }, {});
          return (allFinite(a.series.uc) && allFinite(b.series.uc) && allFinite(c.series.uc) &&
            allFinite(d.series.uc) && allFinite(e.series.uc) &&
            isFinite(a.metrics.uc) && isFinite(d.metrics.uA) && isFinite(e.metrics.uc) &&
            isFinite(c.metrics.relPow) && isFinite(a.metrics.relPow)) ? 0 : 1;
        },
        expect: 0, tol: 0
      }
    ]
  });

  /** 以“覆盖若干参数”的方式重跑 uncertainty 的 compute（自检用；ov 里的键覆盖同名参数） */
  function uncComputeFor(p, ov) {
    var q = { kind: p.kind, x: p.x, ux: p.ux, y: p.y, uy: p.uy, n: p.n }, k;
    for (k in ov) if (Object.prototype.hasOwnProperty.call(ov, k)) q[k] = ov[k];
    return SIM.models.uncertainty.compute(q);
  }

  /* ==========================================================================
     2. least-squares —— 最小二乘线性拟合
     ==========================================================================
     数据：x_i = 1, 2, …, n（等间距、无误差的自变量），
           y_i = k·x_i + b + s_y·ξ_i ，ξ_i ~ N(0,1) 由 mulberry32(seed) 经 Box–Muller 生成。
     ★ ξ 序列只由 (n, seed) 决定，与 s_y 无关 —— 所以“同一个 seed 下改变 s_y”等于
       在同一批噪声上放大振幅，R² 对 s_y 的单调性因此可以严格讨论。

     最小二乘估计（正规方程的解，两种写法恒等）：
       k̂ = [nΣx_iy_i − Σx_iΣy_i] / [nΣx_i² − (Σx_i)²] = Σ(x_i−x̄)(y_i−ȳ) / Σ(x_i−x̄)²   …(1)
       b̂ = ȳ − k̂·x̄                                                                    …(2)
       e_i = y_i − (k̂x_i + b̂)（残差），SSE = Σe_i²，SST = Σ(y_i−ȳ)²
       R² = 1 − SSE/SST（SST = 0 时约定 R² = 1）
       s_y = √(SSE/(n−2))（残差标准差的估计，自由度 n−2）
       S_xx = Σ(x_i−x̄)² = [nΣx_i² − (Σx_i)²]/n
       u_k = s_y/√S_xx = s_y·√(n / [nΣx_i² − (Σx_i)²])                                   …(3)（契约式）
       u_b = s_y·√(Σx_i² / [nΣx_i² − (Σx_i)²])

     自检依据（expect 全是解析值）：
       ① 两种斜率写法给出同一个数（差值应为 0，容差 1e-9）；
       ② u_k 与“从残差现算 s_y 再除以 √S_xx”一致（差值 0，容差 1e-9）；
       ②b 统计判据：固定 x 时 Var(k̂) = s_y²/S_xx **严格成立**，所以 400 个不同 seed 的
          k̂ 样本标准差必须等于 s_y/√S_xx（比值 → 1，容差 10%，统计涨落 1/√(2·399) = 3.5%）；
       ③ s_y = 0（无噪声）时数据严格落在一条直线上 ⇒ k̂ = k、b̂ = b（容差 1e-12）；
       ④ 同 seed 逐点可重复；
       ⑤ R² 随 s_y 单调降（同一 seed 下放大噪声，R² = (k+sa)²/[k²+2ksa+s²c] 对 s>0 单调降，
          a = Σ(x−x̄)ξ/S_xx、c = Σ(ξ−ξ̄)²/S_xx，且 c > a² 由柯西不等式保证）；
       ⑥ 残差的正交性：Σe_i = 0 且 Σx_i e_i = 0（正规方程的直接推论）；
       ⑦ 边界安全：n = 3、s_y = 0/2、斜率 ±5 无 NaN/±∞。
     ========================================================================== */
  var LS_SEEDS = 400;              // ②b 统计判据的 seed 个数

  /** 生成数据点：x_i = i、y_i = k·x_i + b + s_y·ξ_i */
  function lsData(n, slope, intercept, sy, seed) {
    var rnd = mulberry32(seed), xs = [], ys = [], i;
    for (i = 1; i <= n; i++) {
      xs.push(i);
      ys.push(slope * i + intercept + sy * gauss(rnd));
    }
    return { xs: xs, ys: ys };
  }
  /** 线性回归的全部量（返回残差与两个不确定度） */
  function lsFit(xs, ys) {
    var n = xs.length, sx = 0, sy = 0, sxx = 0, sxy = 0, i;
    for (i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i]; }
    var den = n * sxx - sx * sx;
    var k = den !== 0 ? (n * sxy - sx * sy) / den : 0;
    var b = (sy - k * sx) / n;
    var fit = [], e = [], sse = 0, sst = 0, my = sy / n, sxc = den / n;
    for (i = 0; i < n; i++) {
      fit.push(k * xs[i] + b);
      e.push(ys[i] - fit[i]);
      sse += e[i] * e[i];
      sst += (ys[i] - my) * (ys[i] - my);
    }
    var dof = n - 2;
    var se = dof > 0 ? Math.sqrt(Math.max(sse, 0) / dof) : 0;
    var uk = sxc > 0 ? se / Math.sqrt(sxc) : 0;                  // = s_y·√(n/den)
    var ub = den > 0 ? se * Math.sqrt(sxx / den) : 0;
    var r2 = sst > 0 ? 1 - sse / sst : 1;
    return {
      n: n, k: k, b: b, fit: fit, resid: e, sse: sse, sst: sst, r2: r2,
      sy: se, sxx: sxc, uk: uk, ub: ub
    };
  }

  SIM.register("least-squares", {
    title: "最小二乘线性拟合",
    legend: "在带噪声的数据上找一条“离所有点最近”的直线：斜率与截距由正规方程给出，" +
      "残差 e_i = y_i − (kx_i+b) 的标准差 s_y 决定斜率的不确定度 u_k = s_y/√S_xx。" +
      "R² = 1 − SSE/SST 是拟合解释掉的方差比例。改 s_y 看 R² 怎么掉，改 seed 看同一噪声" +
      "形状下的重复性（自带 mulberry32，同 seed 逐位可重复）。",
    axes: { xlabel: "自变量 x（等间距取 1…n）", ylabel: "y（数据与拟合直线）/ 残差 e" },
    params: {
      slope: { label: "真斜率 k", unit: "", def: 2, min: -5, max: 5, step: 0.1 },
      intercept: { label: "真截距 b", unit: "", def: 1, min: -5, max: 5, step: 0.1 },
      n: { label: "数据点数 n", unit: "", def: 11, min: 3, max: 50, step: 1 },
      seed: { label: "随机种子", unit: "", def: 1, min: 1, max: 9999, step: 1 },
      sy: { label: "噪声标准差 s_y", unit: "", def: 0.2, min: 0, max: 2, step: 0.01 }
    },
    plots: [
      { key: "fit", label: "最小二乘拟合直线", color: "#5aa9ff" },
      { key: "resid", label: "残差 e_i = y_i − (kx_i+b)", color: "#ff7b7b" }
    ],
    compute: function (p) {
      var slope = num(p.slope, 2), intercept = num(p.intercept, 1);
      var n = Math.round(clamp(num(p.n, 11), 2, 200));
      var seed = Math.round(clamp(num(p.seed, 1), -1e6, 1e6));
      var sy = Math.abs(num(p.sy, 0.2));
      var d = lsData(n, slope, intercept, sy, seed);
      var f = lsFit(d.xs, d.ys);

      var markers = [], i;
      for (i = 0; i < n; i++) markers.push({ x: d.xs[i], y: f.resid[i] });
      var x0 = d.xs[0], x1 = d.xs[n - 1];

      var info = [
        { k: "数据点数 n / 随机种子", v: fmt(n, 0) + " 个点，seed = " + seed },
        { k: "真值（生成数据用的）", v: "k = " + fmt(slope, 6) + "，b = " + fmt(intercept, 6) + "，s_y = " + fmt(sy, 6) },
        { k: "拟合斜率 k̂", v: fmt(f.k, 6) + " ± " + fmt(f.uk, 6) + "（u_k = s_y/√S_xx）" },
        { k: "拟合截距 b̂", v: fmt(f.b, 6) + " ± " + fmt(f.ub, 6) },
        { k: "残差标准差 s_y = √(SSE/(n−2))", v: fmt(f.sy, 6) },
        { k: "残差平方和 SSE", v: fmt(f.sse, 6) },
        { k: "决定系数 R² = 1 − SSE/SST", v: fmt(f.r2, 6) },
        { k: "S_xx = Σ(x−x̄)²", v: fmt(f.sxx, 6) },
        { k: "斜率与真值之差 / u_k", v: fmt(div(Math.abs(f.k - slope), f.uk, 0), 4) + " σ" }
      ];
      if (sy === 0) info.push({ k: "无噪声（s_y = 0）", v: "数据严格共线 ⇒ k̂ = k、b̂ = b、SSE = 0、R² = 1" });

      return {
        t: d.xs,
        series: { fit: f.fit, resid: f.resid },
        info: info,
        bars: [
          { label: "|k̂ − k| / u_k（σ）", value: div(Math.abs(f.k - slope), f.uk, 0), color: "#ff7b7b" },
          { label: "R²（1 = 完美拟合）", value: f.r2, color: "#63d6a5" },
          { label: "s_y（残差标准差）", value: f.sy, color: "#ffb84d" }
        ],
        extra: {
          lines: [
            { x: d.xs, y: f.resid, label: "残差 e_i（散点连线）", color: "#ff7b7b" },
            { x: [x0, x1], y: [f.sy, f.sy], label: "+s_y", color: "#ffb84d", dash: "5 4" },
            { x: [x0, x1], y: [-f.sy, -f.sy], label: "−s_y", color: "#ffb84d", dash: "5 4" },
            { x: [x0, x1], y: [0, 0], label: "零线", color: "#63d6a5" }
          ],
          markers: markers,
          xlabel: "x", ylabel: "残差 e_i",
          title: "残差图：点应随机散布在 0 附近，落在 ±s_y 带内（" + fmt(sy, 3) + " 是加的噪声，s_y = " + fmt(f.sy, 3) + " 是从残差估的）"
        },
        metrics: {
          n: n, seed: seed, slope: slope, intercept: intercept, syIn: sy,
          xs: d.xs, ys: d.ys, k: f.k, b: f.b, uk: f.uk, ub: f.ub, r2: f.r2,
          sse: f.sse, sst: f.sst, sy: f.sy, sxx: f.sxx, fit: f.fit, resid: f.resid, f: f
        }
      };
    },
    tests: [
      // ① 两种斜率写法恒等：正规方程 k = (nΣxy−ΣxΣy)/(nΣx²−(Σx)²)
      //    与逐点式 k = Σ(x−x̄)(y−ȳ)/Σ(x−x̄)² 的差必须是 0（同一批数据的解析恒等式）
      {
        name: "① 正规方程斜率 = 逐点式 Σ(x−x̄)(y−ȳ)/Σ(x−x̄)²（差 0，容差 1e-9）",
        params: { slope: 2, intercept: 1, n: 11, seed: 1, sy: 0.2 },
        measure: function (o) {
          var xs = o.metrics.xs, ys = o.metrics.ys, n = xs.length;
          var mx = 0, my = 0, i, num = 0, den = 0;
          for (i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; }
          mx /= n; my /= n;
          for (i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) * (xs[i] - mx); }
          return Math.abs(o.metrics.k - num / den);
        },
        expect: 0, tol: 1e-9
      },
      // ② 斜率不确定度 u_k = s_y·√(n/[nΣx²−(Σx)²])：用残差现算的 s_y 与从原始 x 现算的
      //    S_xx 独立重算 u_k = s_y/√S_xx，与模型报的值之差应为 0
      {
        name: "② u_k 与「残差现算 s_y ÷ √S_xx」一致（差 0，容差 1e-9）",
        params: { slope: 2, intercept: 1, n: 11, seed: 1, sy: 0.2 },
        measure: function (o) {
          var m = o.metrics, xs = m.xs, e = m.resid, n = xs.length, i;
          var mx = 0, sxx = 0, sse = 0;
          for (i = 0; i < n; i++) mx += xs[i];
          mx /= n;
          for (i = 0; i < n; i++) sxx += (xs[i] - mx) * (xs[i] - mx);
          for (i = 0; i < n; i++) sse += e[i] * e[i];
          var sEst = Math.sqrt(sse / (n - 2));
          return Math.abs(m.uk - sEst / Math.sqrt(sxx));
        },
        expect: 0, tol: 1e-9
      },
      // ②b 统计判据（解析）：固定 x 时 Var(k̂) = σ²/S_xx 严格成立，
      //     所以 400 个 seed 的 k̂ 样本标准差 ÷ (s_y/√S_xx) → 1
      //     （统计涨落：1/√(2·399) = 3.5%，容差 10%）
      {
        name: "②b 400 个 seed 的 k̂ 样本标准差 = 解析值 s_y/√S_xx（比值 1 ± 10%）",
        params: { slope: 2, intercept: 1, n: 11, seed: 1, sy: 0.2 },
        measure: function (o, q) {
          var m = o.metrics, i, ks = [], mean = 0, v = 0;
          for (i = 0; i < LS_SEEDS; i++) ks.push(lsComputeFor(q, { seed: 1 + i * 7 }).metrics.k);
          for (i = 0; i < ks.length; i++) mean += ks[i];
          mean /= ks.length;
          for (i = 0; i < ks.length; i++) v += (ks[i] - mean) * (ks[i] - mean);
          var sd = Math.sqrt(v / (ks.length - 1));
          var theory = m.syIn / Math.sqrt(m.sxx);       // = s_y/√S_xx（用真噪声 s_y，不是估计值）
          return div(sd, theory, 0);
        },
        expect: 1, tol: 0.1
      },
      // ③ 无噪声（s_y = 0）：数据严格共线，最小二乘解 = 真值
      //    k = 2、b = 1 时 max(|k̂−2|, |b̂−1|) 必须是 0
      {
        name: "③ s_y = 0 时拟合值 = 真值（k̂ = 2、b̂ = 1，差 0，容差 1e-12）",
        params: { slope: 2, intercept: 1, n: 11, seed: 1, sy: 0 },
        measure: function (o) {
          return Math.max(Math.abs(o.metrics.k - 2), Math.abs(o.metrics.b - 1));
        },
        expect: 0, tol: 1e-12
      },
      // ④ 同 seed 完全可重复（自带 mulberry32；compute 里没有任何 Math.random）
      {
        name: "④ 同 seed 完全可重复（两次运行拟合线与残差逐点一致）",
        params: { slope: 2, intercept: 1, n: 11, seed: 7, sy: 0.3 },
        measure: function (o, q) {
          var a = lsComputeFor(q, {}), b = lsComputeFor(q, {});
          return Math.max(maxDiff(a.series.fit, b.series.fit), maxDiff(a.series.resid, b.series.resid));
        },
        expect: 0, tol: 0
      },
      // ④b 不同 seed 必须给出不同数据（证明 seed 真的在驱动随机数，而不是常数）
      {
        name: "④b 不同 seed 给出不同数据（seed 确实驱动随机数）",
        params: { slope: 2, intercept: 1, n: 11, seed: 7, sy: 0.3 },
        measure: function (o, q) {
          var a = lsComputeFor(q, {}), b = lsComputeFor(q, { seed: 8 });
          return maxDiff(a.metrics.ys, b.metrics.ys) > 0 ? 1 : 0;
        },
        expect: 1, tol: 0
      },
      // ⑤ R² 随噪声单调降：同一 seed 下 s_y = 0 → 0.2 → 0.6 → 1.2 → 2.0，R² 必须逐段下降
      //    R²(s) = (k+sa)²/[k² + 2ksa + s²c]（a = Σ(x−x̄)ξ/S_xx、c = Σ(ξ−ξ̄)²/S_xx > a²），
      //    k > 0 时对 s > 0 单调下降。
      {
        name: "⑤ R² 随噪声 s_y 单调降（s_y = 0/0.2/0.6/1.2/2.0）",
        params: { slope: 2, intercept: 1, n: 11, seed: 1, sy: 0.2 },
        measure: function (o, q) {
          var list = [0, 0.2, 0.6, 1.2, 2.0], i, prev = Infinity;
          for (i = 0; i < list.length; i++) {
            var r = lsComputeFor(q, { sy: list[i] }).metrics.r2;
            if (!(r < prev)) return 9;
            prev = r;
          }
          return 0;
        },
        expect: 0, tol: 0
      },
      // ⑥ 残差的正交性（正规方程的推论，解析恒等式）：Σe_i = 0、Σx_i·e_i = 0
      {
        name: "⑥ 残差正交性 Σe_i = 0 且 Σx_i·e_i = 0（正规方程推论）",
        params: { slope: -3.5, intercept: 2.5, n: 23, seed: 5, sy: 1.1 },
        measure: function (o) {
          var m = o.metrics, i, s1 = 0, s2 = 0;
          for (i = 0; i < m.n; i++) { s1 += m.resid[i]; s2 += m.xs[i] * m.resid[i]; }
          return Math.max(Math.abs(s1), Math.abs(s2));
        },
        expect: 0, tol: 1e-9
      },
      // ⑦ 边界安全：n = 3（最小点数）、s_y = 0 与 s_y = 2（滑块两端）、斜率 ±5 都无 NaN/±∞
      {
        name: "⑦ 边界安全：n = 3、s_y = 0/2、k = ±5 无 NaN/±∞",
        params: { slope: 2, intercept: 1, n: 3, seed: 9999, sy: 0 },
        measure: function (o, q) {
          var a = o;
          var b = lsComputeFor(q, { n: 3, sy: 2, slope: 5, intercept: -5 });
          var c = lsComputeFor(q, { n: 50, sy: 2, slope: -5, intercept: 5 });
          var ok = allFinite(a.series.fit) && allFinite(a.series.resid) &&
            allFinite(b.series.fit) && allFinite(b.series.resid) &&
            allFinite(c.series.fit) && allFinite(c.series.resid) &&
            isFinite(a.metrics.k) && isFinite(a.metrics.uk) && isFinite(a.metrics.r2) &&
            isFinite(b.metrics.k) && isFinite(c.metrics.r2);
          return ok ? 0 : 1;
        },
        expect: 0, tol: 0
      }
    ]
  });

  /** 以“覆盖若干参数”的方式重跑 least-squares 的 compute（自检用） */
  function lsComputeFor(p, ov) {
    var q = { slope: p.slope, intercept: p.intercept, n: p.n, seed: p.seed, sy: p.sy }, k;
    for (k in ov) if (Object.prototype.hasOwnProperty.call(ov, k)) q[k] = ov[k];
    return SIM.models["least-squares"].compute(q);
  }

  /* ==========================================================================
     3. counting-stats —— 计数统计与泊松分布
     ==========================================================================
     泊松分布（放射性计数、光子计数、稀有事件的计数都服从它）：
       P(N = k) = μ^k e^(−μ)/k! ，均值 E[N] = μ，方差 Var(N) = μ，σ = √μ，
       偏度 γ₁ = 1/√μ（μ → ∞ 时趋于高斯），单次计数的相对不确定度 = σ/N = 1/√N → 1/√μ。
     泊松判据：方差/均值 = 1（> 1 是超泊松，例如复合源；< 1 是亚泊松，例如固定计数）。

     抽样算法（两种，按 μ 分界，注释写明适用范围）：
       · μ < CS_KNUTH_MAX = 30：Knuth 乘法算法（**精确**）
           L = e^(−μ)，反复乘 U(0,1) 直到乘积 ≤ L，乘法次数即 k。
           期望循环次数 ≈ μ + 1，所以只在小 μ 时用（μ = 30 时平均 31 次，仍然很快）。
       · μ ≥ 30：正态近似（中心极限定理）
           N = max(0, round(μ + √μ·z))，z ~ N(0,1)（Box–Muller）。
           μ = 30 时精确泊松的偏度只有 1/√30 = 0.18，近似误差 O(1/√μ)；μ = 10⁴ 时更好。
           —— 用 Knuth 在 μ = 10⁴、n = 5000 时要循环 5×10⁷ 次（几秒），正态近似是毫秒级。

     自检依据（expect 全是解析值）：
       ① 方差 = 均值 ⇒ 样本 var/mean → 1（单批 n = 5000 时涨落 √(2/n) = 2%，
          这里对 24 个 seed 取平均把统计误差压到 0.4%，容差 5%）；μ = 1（Knuth 支）同样成立
       ② σ = √μ ⇒ s/√x̄ → 1（容差 3%）
       ③ 单次计数 N = 100 的相对不确定度 = 1/√100 = 0.1（模型用置信区间半宽 z√N 再除以 N
          这条路算，与 1/√N 是两种写法，容差 1e-6）
       ④ 同 seed 逐位可重复
       ⑤ μ = 10⁴ 时偏度 → 0（精确泊松的偏度是 1/√μ = 0.01，高斯极限是 0；容差 0.05）
       ⑤b μ = 4（Knuth 支，精确）：解析偏度 = 1/√4 = 0.5，实测样本偏度必须收敛到它
       ⑥ 泊松概率归一：Σ_k P(k)·Δk = 1（解析值 1，容差 1e-6）
       ⑦ 边界安全：μ = 1、μ = 10⁴、n = 10/5000、seed 端点都无 NaN/±∞
     ========================================================================== */
  var CS_KINDS = ["泊松分布", "计数直方图", "置信区间"];
  var CS_KNUTH_MAX = 30;           // μ < 30 用 Knuth 精确算法，否则用正态近似
  var CS_KMAX = 100000;            // Knuth 循环护栏（正常情况下 μ + 几σ 就跳出）
  var CS_BATCH = 24;               // ①②的“多批平均”批数（压统计涨落）
  var CS_SKEW_BATCH = 40;          // ⑤⑤b 的批数
  var CS_NTEST = 5000;             // 统计自检用的单批样本数
  var CS_Z95 = 1.959963984540054;  // 95% 置信区间的正态分位点

  /** 泊松抽样：μ < 30 用 Knuth（精确），μ ≥ 30 用正态近似 */
  function csPoisson(mu, rnd) {
    var m = Math.max(mu, 1e-9), k, prod;
    if (m < CS_KNUTH_MAX) {
      var L = Math.exp(-m);
      k = 0; prod = rnd();
      while (prod > L && k < CS_KMAX) { k++; prod *= rnd(); }
      return k;
    }
    return Math.max(0, Math.round(m + Math.sqrt(m) * gauss(rnd)));
  }
  /** 一次计数的（近似）置信区间半宽：z·σ = z·√N —— 相对半宽 = z√N/N，即 z/√N */
  function csCiHalf(N, z) { return z * Math.sqrt(Math.max(N, 0)); }
  /** 样本统计量：均值、样本方差（除以 n−1）、偏度 g₁ = m₃/m₂^{3/2} */
  function csStats(a) {
    var n = a.length, i, m = 0, v = 0, m2 = 0, m3 = 0, d;
    if (!n) return { n: 0, mean: 0, varr: 0, sd: 0, skew: 0 };
    for (i = 0; i < n; i++) m += a[i];
    m /= n;
    for (i = 0; i < n; i++) { d = a[i] - m; v += d * d; m3 += d * d * d; }
    m2 = v / n;                       // 二阶中心矩（除以 n）
    m3 = m3 / n;                      // 三阶中心矩（也除以 n，否则偏度会差一个 n 倍）
    v = n > 1 ? v / (n - 1) : 0;
    return {
      n: n, mean: m, varr: v, sd: Math.sqrt(Math.max(v, 0)),
      skew: m2 > 1e-12 ? m3 / Math.pow(m2, 1.5) : 0
    };
  }
  /** 直方图：箱宽取 max(1, round(σ/20))，箱数上限 401（护栏） */
  function csHistogram(samples, mu) {
    var sig = Math.sqrt(Math.max(mu, 1e-9)), w = Math.max(1, Math.round(sig / 20));
    var i, lo = Infinity, hi = -Infinity, b, b0, b1;
    for (i = 0; i < samples.length; i++) {
      if (samples[i] < lo) lo = samples[i];
      if (samples[i] > hi) hi = samples[i];
    }
    if (!isFinite(lo)) { lo = 0; hi = 0; }
    b0 = Math.floor(lo / w);
    b1 = Math.floor(hi / w);
    if (b1 - b0 > 400) b1 = b0 + 400;
    var counts = [], cen = [];
    for (b = b0; b <= b1; b++) { counts.push(0); cen.push((b + 0.5) * w); }
    for (i = 0; i < samples.length; i++) {
      b = Math.floor(samples[i] / w) - b0;
      if (b < 0) b = 0;
      if (b >= counts.length) b = counts.length - 1;
      counts[b]++;
    }
    return { w: w, b0: b0, cen: cen, counts: counts, lo: b0 * w, hi: (b1 + 1) * w };
  }
  /** 某个箱的理论概率：箱窄（≤ 8 个整数）时把 P(k) 逐项加起来，否则用宽度 × 中心密度 */
  function csBinProb(mu, b, w) {
    var k0 = Math.ceil(b * w), k1 = Math.ceil((b + 1) * w) - 1, s = 0, k;
    if (k1 - k0 <= 8) {
      for (k = Math.max(0, k0); k <= k1; k++) s += poissonPmf(mu, k);
      return s;
    }
    return w * poissonPmf(mu, (b + 0.5) * w);
  }
  /**
   * 理论泊松曲线（主图用）：横轴取 μ ± 6σ（被截掉的尾巴 ~2×10⁻⁹），**固定 121 个采样点**
   * —— 点数固定是为了让“只改 μ”的多条曲线横轴长度一致（config.vary 把几条曲线叠在同一
   * 张图上时，引擎用的是第一条曲线的横轴）。返回 { t, pmf, gau, sum }：
   *   pmf = P(k; μ)（解析式，用对数算，k 允许非整数：只作曲线插值），
   *   gau = 同一坐标下高斯近似的概率质量 (Δk/σ)·φ(z)，z = (k−μ)/σ。
   */
  function csPmfCurve(mu) {
    var sig = Math.sqrt(Math.max(mu, 1e-9));
    var kmin = Math.max(0, mu - 6 * sig), kmax = mu + 6 * sig;
    var NPT = 121, step = (kmax - kmin) / (NPT - 1);
    var t = [], pmf = [], gau = [], i, k, sum = 0, z, g;
    for (i = 0; i < NPT; i++) {
      k = kmin + i * step;
      t.push(k);
      g = poissonPmf(mu, k);
      pmf.push(g);
      sum += g * step;
      z = (k - mu) / sig;
      gau.push((step / sig) * Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI));
    }
    return { t: t, pmf: pmf, gau: gau, sum: sum, step: step, kmin: kmin, kmax: kmax };
  }
  var CS_MEMO = {}, CS_MEMO_N = 0;   // 理论曲线只与 μ 有关，缓存最多 64 条（滑块扫一遍不会吃满内存）
  function csCurve(mu) {
    var key = String(mu);
    if (!CS_MEMO[key]) {
      if (CS_MEMO_N >= 64) { CS_MEMO = {}; CS_MEMO_N = 0; }
      CS_MEMO[key] = csPmfCurve(mu);
      CS_MEMO_N++;
    }
    return CS_MEMO[key];
  }

  SIM.register("counting-stats", {
    title: "计数统计与泊松分布",
    legend: "计数实验的统计规律：重复测量同一个源，计数 N 服从泊松分布 P(N) = μ^N e^(−μ)/N!，" +
      "方差恰等于均值（泊松判据），σ = √μ，单次计数的相对不确定度只有 1/√N。μ 很大时泊松" +
      "分布收敛到高斯分布（偏度 1/√μ → 0）。小 μ 用 Knuth 精确抽样，大 μ 用正态近似，" +
      "同一个 seed 逐位可重复（自带 mulberry32）。",
    axes: {
      xlabel: "计数 N（泊松分布横轴 / 直方图箱中心 / 计数次数）",
      ylabel: "概率 P(N)　/　相对频数　/　相对不确定度"
    },
    params: {
      kind: { label: "视图", type: "enum", options: CS_KINDS, def: 0 },
      mu: { label: "平均计数 μ", unit: "个", def: 100, min: 1, max: 10000, step: 1 },
      n: { label: "样本数 n（重复测量次数）", unit: "次", def: 200, min: 10, max: 5000, step: 10 },
      seed: { label: "随机种子", unit: "", def: 1, min: 1, max: 9999, step: 1 }
    },
    plots: [
      { key: "pmf", label: "泊松分布 P(N; μ)（解析式）", color: "#5aa9ff" },
      { key: "gauss", label: "高斯近似（σ = √μ）", color: "#ffb84d", dash: "6 4" },
      { key: "hist", label: "实测直方图（相对频数）", color: "#63d6a5" },
      { key: "theory", label: "泊松预测（同一分箱）", color: "#ffb84d", dash: "6 4" },
      { key: "rel", label: "相对不确定度 1/√N", color: "#5aa9ff" },
      { key: "rel95", label: "95% 置信区间相对半宽 1.96/√N", color: "#ff7b7b", dash: "6 4" }
    ],
    compute: function (p) {
      var kindName = opt(CS_KINDS, p.kind);
      var kind = Math.max(0, CS_KINDS.indexOf(kindName));
      var mu = clamp(num(p.mu, 100), 1e-6, 1e7);
      var n = Math.round(clamp(num(p.n, 200), 1, 200000));
      var seed = Math.round(clamp(num(p.seed, 1), -1e6, 1e6));

      // ---- 抽样与样本统计量 ----
      var rnd = mulberry32(seed), samples = [], i;
      for (i = 0; i < n; i++) samples.push(csPoisson(mu, rnd));
      var st = csStats(samples);
      var varRatio = div(st.varr, st.mean, 0);
      var sigTheo = Math.sqrt(mu);

      // ---- 直方图（extra 永远是直方图） ----
      var hg = csHistogram(samples, mu);
      var hRel = [], hTheo = [], hCen = hg.cen, b;
      for (i = 0; i < hg.counts.length; i++) {
        hRel.push(n > 0 ? hg.counts[i] / n : 0);
        hTheo.push(csBinProb(mu, hg.b0 + i, hg.w));
      }

      // ---- 理论泊松曲线（与 seed 无关，走缓存） ----
      var pc = csCurve(mu);

      // ---- 置信区间视图的横轴：N 从 1 到 max(100, μ) ----
      var nMax = Math.max(100, Math.ceil(mu));
      var nStep = Math.max(1, Math.round(nMax / 150));
      var nt = [], nrel = [], nrel95 = [];
      for (b = 1; b <= nMax; b += nStep) {
        nt.push(b);
        nrel.push(div(csCiHalf(b, 1), b, 0));            // z√N / N = 1/√N
        nrel95.push(div(csCiHalf(b, CS_Z95), b, 0));     // 1.96/√N
      }

      // ---- 代表性计数的置信区间（契约自检③用：N = round(μ) 时相对半宽 = 1/√N） ----
      var nRef = Math.max(1, Math.round(mu));
      var ciHalf = csCiHalf(nRef, 1);                   // 1σ（68.3%）半宽
      var relUnc = div(ciHalf, nRef, 0);                // 数值上等于 1/√N
      var ci95 = csCiHalf(nRef, CS_Z95);

      var ts, series, info = [], bars = [];

      if (kind === 0) {
        // 泊松分布：解析曲线 + 高斯近似
        ts = pc.t;
        series = { pmf: pc.pmf, gauss: pc.gau };
        info.push({ k: "平均计数 μ", v: fmt(mu, 4) + " 个（seed = " + seed + "）" });
        info.push({ k: "泊松分布 P(N) = μ^N e^(−μ)/N!", v: "横轴取 μ ± 6σ（σ = √μ = " + fmt(sigTheo, 4) + "）" });
        info.push({ k: "Σ P(N)·ΔN（解析值 1）", v: fmt(pc.sum, 8) });
        info.push({ k: "高斯近似 φ(z)/σ（z = (N−μ)/σ）", v: "μ = " + fmt(mu, 0) + " 时偏度 1/√μ = " + fmt(div(1, sigTheo, 0), 4) });
      } else if (kind === 1) {
        // 计数直方图：实测相对频数 vs 泊松预测
        ts = hCen;
        series = { hist: hRel, theory: hTheo };
        info.push({ k: "箱宽 / 箱数", v: fmt(hg.w, 0) + " / " + fmt(hg.counts.length, 0) });
        info.push({ k: "实测直方图峰值处计数", v: fmt(hg.counts[argmaxIdx(hg.counts)] || 0, 0) + " 次" });
      } else {
        // 置信区间：相对半宽随计数 N 的变化
        ts = nt;
        series = { rel: nrel, rel95: nrel95 };
        info.push({ k: "计数 N = " + fmt(nRef, 0) + " 的 1σ 半宽 z√N", v: "±" + fmt(ciHalf, 4) + " 个（相对 " + fmt(relUnc * 100, 4) + " %）" });
        info.push({ k: "95% 置信区间半宽 1.96√N", v: "±" + fmt(ci95, 4) + " 个（相对 " + fmt(div(ci95, nRef, 0) * 100, 4) + " %）" });
        info.push({ k: "要把相对不确定度压到 1%", v: "需要计数 N = 1/0.01² = " + fmt(10000, 0) + " 个" });
      }

      info.push({ k: "样本数 n / 均值 N̄", v: fmt(n, 0) + " 次 / " + fmt(st.mean, 5) + " 个" });
      info.push({ k: "样本方差 s²（解析值 = μ）", v: fmt(st.varr, 5) + "（理论 " + fmt(mu, 5) + "）" });
      info.push({ k: "泊松判据：方差/均值（= 1）", v: fmt(varRatio, 5) });
      info.push({ k: "样本标准差 s / √μ", v: fmt(st.sd, 5) + " / " + fmt(sigTheo, 5) });
      info.push({ k: "样本偏度 g₁（解析 1/√μ）", v: fmt(st.skew, 5) + " / " + fmt(div(1, sigTheo, 0), 5) });
      info.push({ k: "抽样算法", v: mu < CS_KNUTH_MAX ? "Knuth 精确乘法算法（μ < " + CS_KNUTH_MAX + "）" : "正态近似 N = round(μ + √μ·z)（μ ≥ " + CS_KNUTH_MAX + "）" });

      bars.push({ label: "方差/均值（泊松 ⇒ 1）", value: varRatio, color: "#63d6a5" });
      bars.push({ label: "s/√μ（解析 ⇒ 1）", value: div(st.sd, sigTheo, 0), color: "#5aa9ff" });
      bars.push({ label: "g₁·√μ（解析 ⇒ 1）", value: st.skew * sigTheo, color: "#ffb84d" });

      return {
        t: ts,
        series: series,
        info: info,
        bars: bars,
        extra: {
          lines: [
            { x: hCen, y: hRel, label: "实测相对频数（n = " + fmt(n, 0) + " 次）", color: "#5aa9ff" },
            { x: hCen, y: hTheo, label: "泊松预测（箱宽 " + fmt(hg.w, 0) + "）", color: "#ffb84d", dash: "6 4" }
          ],
          xlabel: "计数 N", ylabel: "相对频数（每箱概率）",
          title: "计数直方图：μ = " + fmt(mu, 1) + "，σ = √μ = " + fmt(sigTheo, 3) +
            "，实测方差/均值 = " + fmt(varRatio, 4) + "（泊松 ⇒ 1）"
        },
        metrics: {
          kind: kind, kindName: kindName, mu: mu, n: n, seed: seed,
          samples: samples, mean: st.mean, varr: st.varr, sd: st.sd, skew: st.skew,
          varRatio: varRatio, sigmaTheo: sigTheo, hist: hg.counts, binW: hg.w, binC: hCen,
          histRel: hRel, histTheo: hTheo, pmf: pc.pmf, pmfSum: pc.sum, pmfT: pc.t,
          nRef: nRef, relUnc: relUnc, ciHalf: ciHalf, ci95: ci95,
          series: series, ts: ts
        }
      };
    },
    tests: [
      // ① 泊松判据：方差 = 均值。单批 n = 5000 时 var/mean 的统计涨落 ≈ √(2/n) = 2%，
      //    这里对 24 个 seed 取平均（涨落降到 0.4%），比较 |平均比值 − 1| < 5%
      {
        name: "① 泊松判据 方差 = 均值（μ = 100，24 批 × 5000，比值 → 1 ± 5%）",
        params: { kind: 0, mu: 100, n: CS_NTEST, seed: 1 },
        measure: function (o, q) {
          var i, s = 0;
          for (i = 0; i < CS_BATCH; i++) s += csComputeFor(q, { seed: 1 + i * 13 }).metrics.varRatio;
          return Math.abs(s / CS_BATCH - 1);
        },
        expect: 0, tol: 0.05
      },
      // ①b 小 μ 支（μ = 1 < 30 用 Knuth 精确算法）同样满足方差 = 均值
      {
        name: "①b 泊松判据（μ = 1，Knuth 精确抽样，24 批 × 5000，比值 → 1 ± 5%）",
        params: { kind: 0, mu: 1, n: CS_NTEST, seed: 1 },
        measure: function (o, q) {
          var i, s = 0;
          for (i = 0; i < CS_BATCH; i++) s += csComputeFor(q, { seed: 3 + i * 13 }).metrics.varRatio;
          return Math.abs(s / CS_BATCH - 1);
        },
        expect: 0, tol: 0.05
      },
      // ② σ = √μ：样本标准差与 √(样本均值) 的比值 → 1（24 批平均，容差 3%）
      //    （用 √x̄ 而不是 √μ，检验的是“从数据本身就能读出 √μ”这一判据）
      {
        name: "② σ = √μ（s/√N̄ → 1，μ = 100，24 批，容差 3%）",
        params: { kind: 1, mu: 100, n: CS_NTEST, seed: 1 },
        measure: function (o, q) {
          var i, s = 0, out;
          for (i = 0; i < CS_BATCH; i++) {
            out = csComputeFor(q, { seed: 5 + i * 13 });
            s += div(out.metrics.sd, Math.sqrt(out.metrics.mean), 0);
          }
          return Math.abs(s / CS_BATCH - 1);
        },
        expect: 0, tol: 0.03
      },
      // ③ 单次计数 N = 100 的相对不确定度 = 1/√N = 1/10 = 0.1（解析值）
      //    模型走的是“置信区间半宽 z√N 再除以 N”这条路，与 1/√N 是两种写法
      {
        name: "③ 计数 N = 100 的相对不确定度 = 1/√100 = 0.1（容差 1e-6）",
        params: { kind: 2, mu: 100, n: 200, seed: 1 },
        measure: function (o) { return o.metrics.relUnc; },
        expect: 0.1, tol: 1e-6
      },
      // ③b μ = 10000 时同一式给出 1/√10000 = 0.01（解析值）
      {
        name: "③b 计数 N = 10000 的相对不确定度 = 1/√10000 = 0.01（容差 1e-6）",
        params: { kind: 2, mu: 10000, n: 200, seed: 1 },
        measure: function (o) { return o.metrics.relUnc; },
        expect: 0.01, tol: 1e-6
      },
      // ④ 同 seed 完全可重复（自带 mulberry32，全文不用 Math.random）
      {
        name: "④ 同 seed 完全可重复（两次运行的样本逐位一致）",
        params: { kind: 1, mu: 100, n: 300, seed: 7 },
        measure: function (o, q) {
          var a = csComputeFor(q, {}), b = csComputeFor(q, {});
          return Math.max(maxDiff(a.metrics.samples, b.metrics.samples), maxDiff(a.series.hist, b.series.hist));
        },
        expect: 0, tol: 0
      },
      // ④b 不同 seed 必须给出不同样本
      {
        name: "④b 不同 seed 给出不同样本（seed 确实驱动随机数）",
        params: { kind: 1, mu: 100, n: 300, seed: 7 },
        measure: function (o, q) {
          var a = csComputeFor(q, {}), b = csComputeFor(q, { seed: 8 });
          return maxDiff(a.metrics.samples, b.metrics.samples) > 0 ? 1 : 0;
        },
        expect: 1, tol: 0
      },
      // ⑤ μ = 10000：泊松分布趋于高斯。精确泊松的偏度是 1/√μ = 0.01，高斯极限是 0，
      //    判据 |平均样本偏度| < 0.05。40 批 × 5000 个样本把样本偏度的统计涨落
      //    （单批 √(6/n) = 3.5%）压到 0.55%，所以 0.05 相当于 9σ 的宽松带。
      {
        name: "⑤ μ = 10000 时偏度 → 0（40 批 × 5000，|平均偏度| < 0.05）",
        params: { kind: 0, mu: 10000, n: CS_NTEST, seed: 1 },
        measure: function (o, q) {
          var i, s = 0;
          for (i = 0; i < CS_SKEW_BATCH; i++) s += csComputeFor(q, { seed: 11 + i * 17 }).metrics.skew;
          return s / CS_SKEW_BATCH;
        },
        expect: 0, tol: 0.05
      },
      // ⑤b 小 μ 支的解析偏度是可以精确算的：Poisson(μ) 的 γ₁ = 1/√μ，
      //     μ = 4 ⇒ 0.5。这一条同时验证 Knuth 抽样的**三阶矩**（不只是方差）。
      {
        name: "⑤b μ = 4（Knuth 支）样本偏度 → 解析值 1/√4 = 0.5（40 批，容差 0.05）",
        params: { kind: 0, mu: 4, n: CS_NTEST, seed: 1 },
        measure: function (o, q) {
          var i, s = 0;
          for (i = 0; i < CS_SKEW_BATCH; i++) s += csComputeFor(q, { seed: 19 + i * 17 }).metrics.skew;
          return s / CS_SKEW_BATCH;
        },
        expect: 0.5, tol: 0.05
      },
      // ⑥ 泊松概率归一（解析值 1）：Σ_k P(k; μ)·Δk = 1，μ = 100 时取 μ ± 6σ 的截断尾巴 ~2e-9
      {
        name: "⑥ 泊松分布归一 Σ P(N)·ΔN = 1（μ = 100，容差 1e-6）",
        params: { kind: 0, mu: 100, n: 200, seed: 1 },
        measure: function (o) { return Math.abs(o.metrics.pmfSum - 1); },
        expect: 0, tol: 1e-6
      },
      // ⑦ 边界安全：μ = 1（最小均值）、μ = 10000（最大均值）、n = 10/5000、seed 端点
      {
        name: "⑦ 边界安全：μ = 1/10000、n = 10/5000、seed = 9999 无 NaN/±∞",
        params: { kind: 0, mu: 1, n: 10, seed: 9999 },
        measure: function (o, q) {
          var a = o;
          var b = csComputeFor(q, { mu: 10000, n: 5000, kind: 1 });
          var c = csComputeFor(q, { mu: 10000, n: 10, kind: 2 });
          var ok = allFinite(a.series.pmf) && allFinite(a.series.gauss) &&
            allFinite(b.series.hist) && allFinite(b.series.theory) &&
            allFinite(c.series.rel) && allFinite(c.series.rel95) &&
            allFinite(a.metrics.samples) && isFinite(a.metrics.varRatio) &&
            isFinite(b.metrics.mean) && isFinite(c.metrics.relUnc);
          return ok ? 0 : 1;
        },
        expect: 0, tol: 0
      }
    ]
  });

  /** 以“覆盖若干参数”的方式重跑 counting-stats 的 compute（自检用） */
  function csComputeFor(p, ov) {
    var q = { kind: p.kind, mu: p.mu, n: p.n, seed: p.seed }, k;
    for (k in ov) if (Object.prototype.hasOwnProperty.call(ov, k)) q[k] = ov[k];
    return SIM.models["counting-stats"].compute(q);
  }
  /** 数组最大值下标（直方图峰值） */
  function argmaxIdx(a) {
    var m = 0, i;
    for (i = 1; i < a.length; i++) if (a[i] > a[m]) m = i;
    return m;
  }

  /* ==========================================================================
     4. franck-hertz —— 弗兰克–赫兹实验
     ==========================================================================
     物理图像：电子在加速电压 U 下获得能量 eU，与原子做**非弹性碰撞**时把 U₀ 的能量
     交给原子（第一激发电位）。每发生一次非弹性碰撞，电子就少一份动能，能越过拒斥电压
     V_r 到达板极的电子随之变少 ⇒ 电流在 U = nU₀ 处出现极大，随后骤降。

     唯象形式（上升包络 × 周期性因子）：
       包络   E(U) = max(0, U − V_r)^{3/2}
              —— 只有动能超过 eV_r 的电子能到板极，所以 U ≤ V_r 时电流恒为 0，
                 U → 0 时 I → 0（U = 0 处严格为 0，自检⑤要的就是这一条）；
       U = nU₀ + u（u ∈ [0, U₀) 是一个周期内的“已获得能量余量”）下的周期因子
              R(u) = r₀ + (1 − r₀)·(u/U₀)^{3/2}，        而 U 恰好等于 nU₀ 时取 R = 1
              —— 周期内随 u 单调上升，在阈值上取到整周期最大值；跨过阈值后因子掉回 r₀，
                 表现为“峰顶之后骤降”的弗兰克–赫兹形状。
       电流   I(U) = E(U)·R(U) / E(a)（归一到 a 处的包络，读数为相对单位，始终 ∈ [0,1]）
       散射深度 r₀ = 1/(1 + 1.6·T)（T 是灯丝温度因子：温度越高散射越强、谷越深）

     ★ 峰位**严格**落在 nU₀：采样横轴显式并入 {nU₀} 这些点，而 R(u) 在周期内单调增、
       跨阈值瞬间掉到 r₀ < 1，所以 nU₀ 处的采样值严格大于左右邻居 —— 峰位不需要
       “找极大再修正”，它就是 nU₀ 本身。峰高 ∝ (nU₀ − V_r)^{3/2} 随 n 上升。

     自检依据（expect 全是解析值）：
       ① 相邻峰间距 = U₀（解析：峰位 = nU₀，间距恒为 U₀，容差 0.05 V）
       ② 第 n 个峰位 = nU₀（容差 0.15 V）
       ③ 周期性极大个数 ≥ 3（默认参数下 U₀ = 4.9、a = 30 ⇒ 恰有 6 个：4.9…29.4）
       ④ U₀ = 4.9 V 时峰位 = 4.9、9.8、14.7 V
       ⑤ U → 0 时 I → 0（I(0) = 0，因为包络 max(0, U−V_r)^{3/2} 在 U = 0 处为 0）
       ⑥ 峰高随序号单调上升（包络单调增的推论）
       ⑦ 大拒斥电压：V_r ≥ a 时整条曲线恒为 0（电流被完全拒斥），无 NaN/±∞
     ========================================================================== */
  var FH_N = 1200;         // 基础网格点数（再并入 {nU₀} 这些精确峰位点）

  /** 周期因子：u 是“本周期内已多获得的电压”，恰在阈值上（u = 0 且 U 是 U₀ 的整数倍）取 1 */
  function fhShape(u, U0, r0) {
    return r0 + (1 - r0) * Math.pow(clamp(u / U0, 0, 1), 1.5);
  }
  /** 是否恰好落在 nU₀ 上（浮点判据） */
  function fhIsMultiple(U, U0) {
    var m = U / U0;
    return Math.abs(m - Math.round(m)) < 1e-9;
  }
  /** 板极电流（未归一） */
  function fhRaw(U, U0, Vr, r0) {
    var e = Math.max(0, U - Vr);
    var env = Math.pow(e, 1.5);
    var m = U / U0, n = Math.floor(m), u = U - n * U0;
    var R = fhIsMultiple(U, U0) ? 1 : fhShape(u, U0, r0);
    return env * R;
  }

  SIM.register("franck-hertz", {
    title: "弗兰克–赫兹实验：第一激发电位",
    legend: "电子被加速到 eU₀ 时就能把原子撞到第一激发态：每开一个非弹性碰撞通道，电流就掉" +
      "一次，于是 I–U 曲线出现等间距的极大，峰间距就是第一激发电位 U₀（汞 4.9 V）。" +
      "横轴显式并入 nU₀ 这些点，所以峰位严格落在 4.9、9.8、14.7 V 上；" +
      "拒斥电压 V_r 决定电流从哪个电压开始出现（U ≤ V_r 时电流恒为 0）。",
    axes: { xlabel: "加速电压 U（V）", ylabel: "板极电流 I（相对单位）" },
    params: {
      U0: { label: "第一激发电位 U₀", unit: "V", def: 4.9, min: 1, max: 15, step: 0.1 },
      a: { label: "加速电压上限 U_max", unit: "V", def: 30, min: 5, max: 80, step: 1 },
      T: { label: "灯丝温度因子（散射强度）", unit: "", def: 1, min: 0.2, max: 3, step: 0.05 },
      Vr: { label: "拒斥电压 V_r", unit: "V", def: 1.5, min: 0, max: 5, step: 0.1 }
    },
    plots: [{ key: "I", label: "板极电流 I(U)（相对单位）", color: "#5aa9ff" }],
    compute: function (p) {
      var U0 = clamp(num(p.U0, 4.9), 0.1, 200);
      var a = clamp(num(p.a, 30), 0.5, 400);
      var T = clamp(num(p.T, 1), 0.01, 50);
      var Vr = Math.max(0, num(p.Vr, 1.5));
      var r0 = clamp(1 / (1 + 1.6 * T), 0.02, 0.97);      // 谷底比例：T 越大散射越强
      var envRef = Math.max(Math.pow(Math.max(0, a - Vr), 1.5), 1e-9);

      // 采样横轴：等距网格（固定 FH_N 个点），再把最靠近 nU₀ 的格点“吸附”到 nU₀ 上。
      // 吸附 ⇒ 峰位精确落在 nU₀；点数恒定 ⇒ 换 U₀ 时横轴长度不变
      //（config.vary 把几条曲线叠在一张图上时，引擎只认第一条曲线的横轴）。
      var nmax = Math.floor(a / U0 + 1e-9), ts = lin(0, a, FH_N), m, idx, h = a / (FH_N - 1);
      for (m = 1; m <= nmax; m++) {
        idx = Math.round((m * U0) / h);
        if (idx >= 0 && idx < FH_N) ts[idx] = m * U0;
      }
      var I = [], k;
      for (k = 0; k < ts.length; k++) I.push(fhRaw(ts[k], U0, Vr, r0) / envRef);

      // 峰检测：严格局部极大（峰位就是 nU₀，不做抛物线修正）
      var peaks = [], heights = [], peakN = [];
      for (k = 1; k < ts.length - 1; k++) {
        if (I[k] > I[k - 1] && I[k] > I[k + 1]) {
          peaks.push(ts[k]);
          heights.push(I[k]);
          peakN.push(Math.round(ts[k] / U0));
        }
      }
      var spacings = [], j;
      for (j = 1; j < peaks.length; j++) spacings.push(peaks[j] - peaks[j - 1]);
      var dU0 = spacings.length ? (peaks[peaks.length - 1] - peaks[0]) / spacings.length : 0;
      var snum = 0, sden = 0;
      for (j = 0; j < peaks.length; j++) { snum += peakN[j] * peaks[j]; sden += peakN[j] * peakN[j]; }
      var dU0LS = sden > 0 ? snum / sden : 0;                    // 过原点最小二乘斜率 = 测得的第一激发电位
      var maxDev = 0;
      for (j = 0; j < spacings.length; j++) maxDev = Math.max(maxDev, Math.abs(spacings[j] - U0));
      var peakTxt = peaks.length ? peaks.map(function (v) { return fmt(v, 3); }).join("、") : "（无）";

      var info = [
        { k: "第一激发电位 U₀（设定值）", v: fmt(U0, 4) + " V" },
        { k: "测得的第一激发电位（峰位过原点拟合）", v: fmt(dU0LS, 4) + " V（偏差 " + fmt((dU0LS - U0) * 1000, 4) + " mV）" },
        { k: "峰位列表（共 " + peaks.length + " 个）", v: peakTxt + (peaks.length ? " V" : "") },
        { k: "平均峰间距", v: fmt(dU0, 4) + " V（理论 = U₀ = " + fmt(U0, 4) + " V）" },
        { k: "峰间距最大偏差", v: fmt(maxDev, 6) + " V" },
        { k: "拒斥电压 V_r / 加速电压上限 U_max", v: fmt(Vr, 3) + " V / " + fmt(a, 1) + " V" },
        { k: "灯丝温度因子 T / 谷底比例 r₀", v: fmt(T, 3) + " / " + fmt(r0, 4) },
        { k: "I(0)（U → 0 的极限）", v: fmt(I[0], 8) + "（U ≤ V_r 时电流严格为 0）" }
      ];
      if (Vr >= a) info.push({ k: "⚠ 电流状态", v: "拒斥电压 V_r ≥ U_max：全部电子都被拒斥，I ≡ 0" });
      if (!peaks.length) info.push({ k: "⚠ 峰位", v: "当前参数下 U_max < U₀ 或 V_r 过大，曲线里没有极大" });

      // 第二张图：峰位—序号 的线性关系（斜率就是第一激发电位）
      var linesRef = [], mk = [];
      if (peaks.length) {
        for (j = 0; j < peaks.length; j++) mk.push({ x: peakN[j], y: peaks[j] });
        linesRef.push({ x: peakN, y: peaks, label: "峰位 U_n（实测）", color: "#5aa9ff" });
        linesRef.push({ x: [0, peakN[peakN.length - 1]], y: [0, dU0LS * peakN[peakN.length - 1]], label: "拟合 U_n = n·U₀（U₀ = " + fmt(dU0LS, 4) + " V）", color: "#ffb84d", dash: "6 4" });
        linesRef.push({ x: [0, peakN[peakN.length - 1]], y: [0, U0 * peakN[peakN.length - 1]], label: "真值 U_n = n·U₀（U₀ = " + fmt(U0, 4) + " V）", color: "#63d6a5", dash: "3 3" });
      }

      return {
        t: ts,
        series: { I: I },
        info: info,
        bars: [
          { label: "测得的第一激发电位 U₀ (V)", value: dU0LS, color: "#5aa9ff" },
          { label: "设定值 U₀ (V)", value: U0, color: "#63d6a5" },
          { label: "峰间距最大偏差 (V)", value: maxDev, color: "#ff7b7b" }
        ],
        extra: linesRef.length ? {
          lines: linesRef, markers: mk,
          xlabel: "峰序号 n", ylabel: "峰位电压 U_n (V)",
          title: "峰位与序号成正比：斜率 = 第一激发电位（过原点最小二乘）"
        } : null,
        metrics: {
          U0: U0, a: a, T: T, Vr: Vr, r0: r0, series: I, ts: ts,
          peaks: peaks, heights: heights, peakN: peakN, spacings: spacings,
          nPeaks: peaks.length, dU0: dU0, dU0LS: dU0LS, maxDev: maxDev, I0: I[0]
        }
      };
    },
    tests: [
      // ① 峰间距恒等于 U₀：峰位在 nU₀ 上，相邻差自然是 U₀（容差 0.05 V）
      {
        name: "① 相邻峰间距 = U₀ = 4.9 V（容差 0.05 V）",
        params: { U0: 4.9, a: 30, T: 1, Vr: 1.5 },
        measure: function (o) {
          if (o.metrics.spacings.length < 2) return 999;
          var i, mx = 0;
          for (i = 0; i < o.metrics.spacings.length; i++) {
            mx = Math.max(mx, Math.abs(o.metrics.spacings[i] - 4.9));
          }
          return mx;
        },
        expect: 0, tol: 0.05
      },
      // ② 第 n 个峰位 = nU₀（容差 0.15 V）
      {
        name: "② 第 n 个峰位 = n·U₀（|U_peak − nU₀| < 0.15 V）",
        params: { U0: 4.9, a: 30, T: 1, Vr: 1.5 },
        measure: function (o) {
          if (!o.metrics.peaks.length) return 999;
          var i, mx = 0;
          for (i = 0; i < o.metrics.peaks.length; i++) {
            mx = Math.max(mx, Math.abs(o.metrics.peaks[i] - o.metrics.peakN[i] * 4.9));
          }
          return mx;
        },
        expect: 0, tol: 0.15
      },
      // ③ 曲线有周期性极大：默认参数（U₀ = 4.9、a = 30）下恰有 floor(30/4.9) = 6 个
      {
        name: "③ 曲线有周期性极大：峰个数 = 6（= floor(30/4.9)，且 ≥ 3）",
        params: { U0: 4.9, a: 30, T: 1, Vr: 1.5 },
        measure: function (o) { return o.metrics.nPeaks >= 3 ? o.metrics.nPeaks : 0; },
        expect: 6, tol: 0
      },
      // ④ U₀ = 4.9 V 时峰位落在 4.9、9.8、14.7 V 附近（这里它们严格相等）
      {
        name: "④ U₀ = 4.9 V 时前三个峰位 = 4.9、9.8、14.7 V（容差 0.05 V）",
        params: { U0: 4.9, a: 30, T: 1, Vr: 1.5 },
        measure: function (o) {
          var pk = o.metrics.peaks;
          if (pk.length < 3) return 999;
          return Math.max(Math.abs(pk[0] - 4.9), Math.abs(pk[1] - 9.8), Math.abs(pk[2] - 14.7));
        },
        expect: 0, tol: 0.05
      },
      // ⑤ U → 0 时 I → 0：包络 max(0, U−V_r)^{3/2} 在 U = 0 处严格为 0（容差 1e-6）
      {
        name: "⑤ U → 0 时 I → 0（第一个采样点 U = 0 的电流 < 1e-6）",
        params: { U0: 4.9, a: 30, T: 1, Vr: 1.5 },
        measure: function (o) { return Math.abs(o.metrics.series[0]); },
        expect: 0, tol: 1e-6
      },
      // ⑤b 换一组参数同样成立（V_r = 0 时包络是 U^{3/2}，U = 0 处仍为 0）
      {
        name: "⑤b V_r = 0 时 I(0) = 0（包络 U^{3/2}，容差 1e-6）",
        params: { U0: 6.3, a: 40, T: 2, Vr: 0 },
        measure: function (o) { return Math.abs(o.metrics.series[0]); },
        expect: 0, tol: 1e-6
      },
      // ⑥ 峰高随序号上升：包络 (nU₀ − V_r)^{3/2} 单调增（解析推论）
      {
        name: "⑥ 峰高随序号单调上升（包络 (nU₀−V_r)^{3/2} 单调增）",
        params: { U0: 4.9, a: 30, T: 1, Vr: 1.5 },
        measure: function (o) {
          var h = o.metrics.heights, i;
          if (h.length < 3) return 9;
          for (i = 1; i < h.length; i++) if (!(h[i] > h[i - 1])) return 8;
          return 0;
        },
        expect: 0, tol: 0
      },
      // ⑥b 换 U₀（峰位跟着走）：U₀ = 6.3 V ⇒ 峰位 6.3、12.6、18.9…，间距恒为 6.3
      {
        name: "⑥b U₀ = 6.3 V 时峰间距 = 6.3 V（容差 0.05 V）",
        params: { U0: 6.3, a: 40, T: 0.5, Vr: 2 },
        measure: function (o) {
          if (o.metrics.spacings.length < 2) return 999;
          var i, mx = 0;
          for (i = 0; i < o.metrics.spacings.length; i++) mx = Math.max(mx, Math.abs(o.metrics.spacings[i] - 6.3));
          return mx;
        },
        expect: 0, tol: 0.05
      },
      // ⑦ 边界安全：大拒斥电压 V_r ≥ a（电流被完全拒斥 ⇒ I ≡ 0）、U₀ = 15（滑块上限）、
      //    U₀ = 1（滑块下限）、T = 0.2/3、a = 5/80 都不许 NaN/±∞
      {
        name: "⑦ 边界安全：V_r ≥ a（I ≡ 0）、U₀ = 1/15、T = 0.2/3、a = 5/80 无 NaN/±∞",
        params: { U0: 4.9, a: 5, T: 0.2, Vr: 5 },
        measure: function (o, q) {
          var a = o;
          var b = fhComputeFor(q, { U0: 15, a: 80, T: 3, Vr: 0 });
          var c = fhComputeFor(q, { U0: 1, a: 80, T: 0.2, Vr: 5 });
          var d = fhComputeFor(q, { U0: 4.9, a: 5, T: 1, Vr: 5 });
          var zero = true, i;
          for (i = 0; i < d.metrics.series.length; i++) if (Math.abs(d.metrics.series[i]) > 1e-12) zero = false;
          var ok = allFinite(a.series.I) && allFinite(b.series.I) && allFinite(c.series.I) &&
            allFinite(d.series.I) && isFinite(a.metrics.dU0LS) && isFinite(b.metrics.dU0LS) &&
            isFinite(c.metrics.dU0) && zero;
          return ok ? 0 : 1;
        },
        expect: 0, tol: 0
      }
    ]
  });

  /** 以“覆盖若干参数”的方式重跑 franck-hertz 的 compute（自检用） */
  function fhComputeFor(p, ov) {
    var q = { U0: p.U0, a: p.a, T: p.T, Vr: p.Vr }, k;
    for (k in ov) if (Object.prototype.hasOwnProperty.call(ov, k)) q[k] = ov[k];
    return SIM.models["franck-hertz"].compute(q);
  }

  /* ==========================================================================
     5. millikan —— 密立根油滴实验
     ==========================================================================
     油滴带电量总是元电荷的整数倍：q_i = n_i·q₀。实验里每个油滴测到的电荷有测量误差，
     于是“q_i/q₀ 四舍五入”给出整数倍 n_i（契约①），再用全部油滴拟合元电荷。

     数据生成（seed 驱动，同 seed 逐位可重复）：
       n_i 取 1…N 的一个随机排列（每个整数恰好一个油滴 ⇒ 阶梯完整、相邻间距都是 q₀）；
       q_i = q₀·(n_i + noise·ξ_i)，ξ ~ N(0,1) 截尾到 ±2.5（mulberry32 + Box–Muller）。
     ★ 噪声是**以 q₀ 为单位的绝对误差**（不是相对误差）：真实的密立根实验中，油滴电量的
       测量误差主要来自下落/上升时间与黏滞修正，与它带了几个元电荷基本无关。
       若写成相对误差 q = n·q₀(1+νξ)，n 大的油滴绝对误差就 ∝ n，差值法（相邻间距）会被
       彻底冲掉 —— 这也是提示里那种写法在本模型里换成绝对误差的原因。

     拟合与判据：
       n_i = round(q_i/q₀)（契约指定的整数判定；余量 |q_i/q₀ − n_i| < 0.5 永远成立）
       过原点最小二乘   q̂₀ = Σ n_i q_i / Σ n_i²  ，u(q̂₀) = √(Σ(q_i − q̂₀n_i)²/[(N−1)Σn_i²])
       差值法           最小相邻间距 min(q_(j+1) − q_(j))（把电荷排序后取相邻差的最小值）
                        稳健版：取最小的 ⌊(N−1)/2⌋ 个相邻间距的平均（单个间距受噪声影响 ±√2·noise）
       平均间距         (q_max − q_min)/(N−1)（相邻整数倍时它就是 q₀ 的无偏估计）

     自检依据（expect 全是解析值）：
       ① n_i ≡ round(q_i/q₀)（整数判定自洽，差 0，容差 1e-9）
       ② |q̂₀/q₀ − 1| < 5%（过原点最小二乘；理论相对误差 ≈ noise/√(Σn_i²)，N = 12 时约 0.24%）
       ③ 同 seed 逐位可重复
       ④ noise = 0 时每个油滴恰为整数倍（残差 |q_i − n_i q₀| = 0，容差 1e-12）
       ⑤ 差值法最小相邻间距 → q₀（noise = 0.02 时单个间距的偏差 ~√2·noise = 2.8%）
       ⑤b 平均间距 → q₀（noise = 0.06，理论相对误差 ≈ √2·noise/(N−1) = 0.77%）
       ⑥ 电荷都在 n q₀ 的 ±2.5·noise·q₀ 之内（噪声幅度的上界核对）
       ⑦ 边界安全：N = 3（最少油滴）、N = 40、noise = 0/0.3、q₀ = 0.5/3 无 NaN/±∞
     ========================================================================== */
  var MIL_ZLIM = 2.5;      // 截尾正态的界（|ξ| ≤ 2.5）

  /** 生成一批油滴：返回带噪声的电荷、整数判定、真值整数 */
  function milDrops(q0, N, noise, seed) {
    var rnd = mulberry32(seed), order = [], i, j, t;
    for (i = 0; i < N; i++) order.push(i + 1);
    for (i = N - 1; i > 0; i--) {                       // Fisher–Yates：把整数倍打乱分配给油滴
      j = Math.floor(rnd() * (i + 1)) % (i + 1);
      t = order[i]; order[i] = order[j]; order[j] = t;
    }
    var nTrue = [], q = [], nGet = [], dev = [];
    for (i = 0; i < N; i++) {
      nTrue.push(order[i]);
      var qi = q0 * (order[i] + noise * gaussClip(rnd, MIL_ZLIM));
      q.push(qi);
      var ng = Math.round(qi / q0);                     // 契约①：整数倍由 q/q₀ 四舍五入得到
      if (ng < 1) ng = 1;                               // 低于半个元电荷的读数按 1 处理（实验上会剔除该油滴）
      nGet.push(ng);
      dev.push(Math.abs(qi - ng * q0) / q0);            // 以 q₀ 为单位的残差
    }
    return { q: q, n: nGet, nTrue: nTrue, dev: dev };
  }
  /** 排序后的相邻间距与几个稳健的 q₀ 估计 */
  function milGaps(q) {
    var s = q.slice(0).sort(function (x, y) { return x - y; }), gaps = [], i;
    for (i = 1; i < s.length; i++) gaps.push(s[i] - s[i - 1]);
    if (!gaps.length) return { min: 0, mean: 0, robust: 0, gaps: gaps };
    var sorted = gaps.slice(0).sort(function (x, y) { return x - y; });
    var kk = Math.max(1, Math.floor(gaps.length / 2)), sum = 0;
    for (i = 0; i < kk; i++) sum += sorted[i];
    return {
      min: sorted[0],
      mean: (s[s.length - 1] - s[0]) / (s.length - 1),
      robust: sum / kk,
      gaps: gaps
    };
  }

  SIM.register("millikan", {
    title: "密立根油滴实验：电荷的量子化",
    legend: "油滴的电荷总是元电荷的整数倍：把每个油滴测到的 q 除以 q₀ 四舍五入得到整数 n，" +
      "再用全部油滴过原点拟合出 q₀；相邻电荷的最小间距也直接给出 q₀（差值法）。" +
      "噪声按“以 q₀ 为单位的绝对误差”加，同 seed 逐位可重复（自带 mulberry32）。",
    axes: { xlabel: "油滴序号 i", ylabel: "测得电荷 q（相对单位）" },
    params: {
      q0: { label: "元电荷 q₀（相对单位）", unit: "", def: 1, min: 0.5, max: 3, step: 0.01 },
      N: { label: "油滴数 N", unit: "个", def: 12, min: 3, max: 40, step: 1 },
      noise: { label: "测量噪声（以 q₀ 为单位）", unit: "", def: 0.06, min: 0, max: 0.3, step: 0.01 },
      seed: { label: "随机种子", unit: "", def: 1, min: 1, max: 9999, step: 1 }
    },
    plots: [{ key: "q", label: "各油滴测得的电荷 q_i", color: "#5aa9ff" }],
    compute: function (p) {
      var q0 = clamp(num(p.q0, 1), 1e-6, 1e6);
      var N = Math.round(clamp(num(p.N, 12), 1, 200));
      var noise = clamp(Math.abs(num(p.noise, 0.06)), 0, 1);
      var seed = Math.round(clamp(num(p.seed, 1), -1e6, 1e6));
      var d = milDrops(q0, N, noise, seed);

      // 过原点最小二乘拟合元电荷：q̂₀ = Σ n_i q_i / Σ n_i²
      var snn = 0, snq = 0, i;
      for (i = 0; i < N; i++) { snn += d.n[i] * d.n[i]; snq += d.n[i] * d.q[i]; }
      var q0Fit = div(snq, snn, 0);
      var sse = 0;
      for (i = 0; i < N; i++) { var e = d.q[i] - q0Fit * d.n[i]; sse += e * e; }
      var uFit = N > 1 && snn > 0 ? Math.sqrt(Math.max(sse, 0) / (N - 1) / snn) : 0;

      var gp = milGaps(d.q);
      var devMax = 0, nTxt = [];
      for (i = 0; i < N; i++) {
        if (d.dev[i] > devMax) devMax = d.dev[i];
        nTxt.push(String(d.n[i]));
      }
      var ord = [];
      for (i = 0; i < N; i++) ord.push(i);
      ord.sort(function (x, y) { return d.n[x] - d.n[y]; });

      // 第二张图：电荷阶梯（实测点 + 拟合阶梯 + 真值阶梯）
      var ladderX = [], ladderY = [], mk = [];
      for (i = 0; i < ord.length; i++) {
        ladderX.push(d.n[ord[i]]);
        ladderY.push(d.q[ord[i]]);
        mk.push({ x: d.n[ord[i]], y: d.q[ord[i]] });
      }
      var nHi = d.n[ord[ord.length - 1]] + 1;
      var lines = [
        { x: ladderX, y: ladderY, label: "各油滴测得电荷 q_i（按整数倍排序）", color: "#5aa9ff" },
        { x: [0, nHi], y: [0, q0Fit * nHi], label: "拟合阶梯 q = n·q̂₀（q̂₀ = " + fmt(q0Fit, 5) + "）", color: "#ffb84d", dash: "6 4" },
        { x: [0, nHi], y: [0, q0 * nHi], label: "真值阶梯 q = n·q₀（q₀ = " + fmt(q0, 5) + "）", color: "#63d6a5", dash: "3 3" }
      ];

      var info = [
        { k: "元电荷设定值 q₀ / 油滴数 N", v: fmt(q0, 5) + " / " + fmt(N, 0) + " 个（seed = " + seed + "）" },
        { k: "拟合出的元电荷 q̂₀（过原点最小二乘）", v: fmt(q0Fit, 6) + " ± " + fmt(uFit, 6) },
        { k: "相对偏差 (q̂₀ − q₀)/q₀", v: fmt((q0Fit / q0 - 1) * 100, 4) + " %" },
        { k: "各油滴的整数倍 n", v: nTxt.join("、") },
        { k: "差值法：最小相邻间距", v: fmt(gp.min, 6) + "（q₀ 的 " + fmt(gp.min / q0 * 100, 4) + " %）" },
        { k: "差值法稳健版（最小几个间距的平均）", v: fmt(gp.robust, 6) + "（q₀ 的 " + fmt(gp.robust / q0 * 100, 4) + " %）" },
        { k: "平均间距 (q_max − q_min)/(N−1)", v: fmt(gp.mean, 6) + "（q₀ 的 " + fmt(gp.mean / q0 * 100, 4) + " %）" },
        { k: "最大的整数倍残差 |q_i − n_i q₀|/q₀", v: fmt(devMax, 5) + "（噪声 " + fmt(noise, 4) + "，截尾 ±" + fmt(MIL_ZLIM, 2) + "σ ⇒ 上界 " + fmt(MIL_ZLIM * noise, 4) + "）" },
        { k: "最小二乘残差平方和 Σ(q_i − q̂₀n_i)²", v: fmt(sse, 6) }
      ];
      if (noise === 0) info.push({ k: "无噪声（noise = 0）", v: "每个油滴恰好是整数倍：|q_i − n_i q₀| = 0，拟合值 = q₀" });
      if (devMax > 0.4) info.push({ k: "⚠ 整数倍判定", v: "最大的整数倍残差已接近 0.5（四舍五入的边界），建议减小噪声或增加油滴数" });

      return {
        t: (function () { var a = [], k; for (k = 1; k <= N; k++) a.push(k); return a; })(),
        series: { q: d.q },
        info: info,
        bars: [
          { label: "q̂₀/q₀（1 = 完美）", value: div(q0Fit, q0, 0), color: "#63d6a5" },
          { label: "最小相邻间距/q₀", value: div(gp.min, q0, 0), color: "#5aa9ff" },
          { label: "平均间距/q₀", value: div(gp.mean, q0, 0), color: "#ffb84d" }
        ],
        extra: {
          lines: lines, markers: mk,
          xlabel: "整数倍 n", ylabel: "电荷 q（相对单位）",
          title: "电荷阶梯图：实测点应落在 q = n·q₀ 的阶梯上（q₀ = " + fmt(q0, 4) + "，拟合 " + fmt(q0Fit, 4) + "）"
        },
        metrics: {
          q0: q0, N: N, noise: noise, seed: seed,
          charges: d.q, ns: d.n, nTrue: d.nTrue, dev: d.dev,
          q0Fit: q0Fit, uFit: uFit, sse: sse,
          minGap: gp.min, meanGap: gp.mean, robustGap: gp.robust,
          devMax: devMax, series: d.q
        }
      };
    },
    tests: [
      // ① 整数倍判定：n_i 必须等于 round(q_i/q₀)（契约①的定义，逐滴核对，容差 1e-9）
      {
        name: "① n_i = round(q_i/q₀)（整数判定自洽，最大偏差 < 1e-9）",
        params: { q0: 1, N: 12, noise: 0.06, seed: 1 },
        measure: function (o) {
          var m = o.metrics, mx = 0, i;
          for (i = 0; i < m.N; i++) mx = Math.max(mx, Math.abs(m.ns[i] - Math.round(m.charges[i] / m.q0)));
          return mx;
        },
        expect: 0, tol: 1e-9
      },
      // ①b 整数倍必须真的是整数（不许出现 0.5 或 2.9999 这类值）
      {
        name: "①b 每个 n_i 都是 ≥ 1 的整数",
        params: { q0: 1, N: 12, noise: 0.06, seed: 3 },
        measure: function (o) {
          var m = o.metrics, bad = 0, i;
          for (i = 0; i < m.N; i++) {
            if (!isFinite(m.ns[i]) || m.ns[i] < 1 || Math.abs(m.ns[i] - Math.round(m.ns[i])) > 0) bad++;
          }
          return bad;
        },
        expect: 0, tol: 0
      },
      // ② 拟合元电荷在 q₀ 的 5% 以内。过原点最小二乘的相对误差
      //    ≈ noise·Σn_iξ_i/Σn_i²，标准差 ≈ noise/√(Σn_i²) = 0.06/√650 = 0.24%（N = 12）
      {
        name: "② 拟合出的元电荷在 q₀ 的 5% 以内（|q̂₀/q₀ − 1| < 0.05）",
        params: { q0: 1, N: 12, noise: 0.06, seed: 1 },
        measure: function (o) { return Math.abs(o.metrics.q0Fit / o.metrics.q0 - 1); },
        expect: 0, tol: 0.05
      },
      // ②b 换 q₀ = 2.5、N = 24 再核对一次（模型对 q₀ 与 N 都应线性可缩放）
      {
        name: "②b q₀ = 2.5、N = 24 时拟合值仍在 5% 以内",
        params: { q0: 2.5, N: 24, noise: 0.08, seed: 5 },
        measure: function (o) { return Math.abs(o.metrics.q0Fit / o.metrics.q0 - 1); },
        expect: 0, tol: 0.05
      },
      // ③ 同 seed 完全可重复（自带 mulberry32；compute 里没有任何 Math.random）
      {
        name: "③ 同 seed 完全可重复（两次运行的电荷逐位一致）",
        params: { q0: 1, N: 12, noise: 0.06, seed: 7 },
        measure: function (o, q) {
          var a = milComputeFor(q, {}), b = milComputeFor(q, {});
          return Math.max(maxDiff(a.series.q, b.series.q), maxDiff(a.metrics.ns, b.metrics.ns));
        },
        expect: 0, tol: 0
      },
      // ③b 不同 seed 必须给出不同电荷
      {
        name: "③b 不同 seed 给出不同电荷（seed 确实驱动随机数）",
        params: { q0: 1, N: 12, noise: 0.06, seed: 7 },
        measure: function (o, q) {
          var a = milComputeFor(q, {}), b = milComputeFor(q, { seed: 8 });
          return maxDiff(a.series.q, b.series.q) > 0 ? 1 : 0;
        },
        expect: 1, tol: 0
      },
      // ④ noise = 0 时每个油滴恰为整数倍：|q_i − n_i q₀|/q₀ = 0（容差 1e-12），且 q̂₀ = q₀
      {
        name: "④ noise = 0 时 |q_i − n_i q₀| = 0 且 q̂₀ = q₀（容差 1e-12）",
        params: { q0: 1, N: 12, noise: 0, seed: 1 },
        measure: function (o) {
          var m = o.metrics, mx = 0, i;
          for (i = 0; i < m.N; i++) {
            mx = Math.max(mx, Math.abs(m.charges[i] - m.ns[i] * m.q0));
          }
          return Math.max(mx, Math.abs(m.q0Fit - m.q0));
        },
        expect: 0, tol: 1e-12
      },
      // ⑤ 差值法：排序后相邻电荷的最小间距 → q₀。
      //    取 noise = 0.02：单个间距的偏差 ~√2·noise = 2.8%，最小间距还会偏低一些，
      //    但远小于 10%（noise = 0.06 时最小间距的偏差会到 10% 量级，见 ⑤b 的稳健版）
      {
        name: "⑤ 差值法最小相邻间距 → q₀（noise = 0.02，容差 10%）",
        params: { q0: 1, N: 12, noise: 0.02, seed: 1 },
        measure: function (o) { return o.metrics.minGap; },
        expect: 1, tol: 0.1
      },
      // ⑤b 稳健差值版（最小的一半相邻间距的平均）在默认噪声下也逼近 q₀：
      //     理论相对误差 ≈ √2·noise/√k = 0.085/√5 = 3.8%
      {
        name: "⑤b 稳健间距估计 → q₀（noise = 0.06，容差 10%）",
        params: { q0: 1, N: 12, noise: 0.06, seed: 1 },
        measure: function (o) { return o.metrics.robustGap; },
        expect: 1, tol: 0.1
      },
      // ⑤c 平均间距 (q_max − q_min)/(N−1)：n 取遍 1…N 时它是 q₀ 的无偏估计，
      //     相对误差 ≈ √2·noise/(N−1) = 0.77%（N = 12）
      {
        name: "⑤c 平均间距 → q₀（noise = 0.06，理论误差 0.77%，容差 5%）",
        params: { q0: 1, N: 12, noise: 0.06, seed: 1 },
        measure: function (o) { return o.metrics.meanGap; },
        expect: 1, tol: 0.05
      },
      // ⑥ 噪声幅度上界：截尾正态 |ξ| ≤ 2.5 ⇒ |q_i − n_i q₀|/q₀ ≤ 2.5·noise（逐滴核对）
      {
        name: "⑥ 每滴的整数倍残差 ≤ 2.5·noise（截尾正态上界，noise = 0.06）",
        params: { q0: 1, N: 12, noise: 0.06, seed: 1 },
        measure: function (o) {
          var m = o.metrics, mx = 0, i;
          for (i = 0; i < m.N; i++) mx = Math.max(mx, m.dev[i]);
          return mx / MIL_ZLIM / 0.06;      // ≤ 1 才算过（expect 0.5，容差 0.5）
        },
        expect: 0.5, tol: 0.5
      },
      // ⑦ 边界安全：N = 3（最少）、N = 40、noise = 0/0.3、q₀ = 0.5/3、seed 端点都无 NaN/±∞
      {
        name: "⑦ 边界安全：N = 3/40、noise = 0/0.3、q₀ = 0.5/3 无 NaN/±∞",
        params: { q0: 0.5, N: 3, noise: 0, seed: 9999 },
        measure: function (o, q) {
          var a = o;
          var b = milComputeFor(q, { N: 40, noise: 0.3, q0: 3, seed: 1 });
          var c = milComputeFor(q, { N: 3, noise: 0.3, q0: 0.5, seed: 2 });
          var ok = allFinite(a.series.q) && allFinite(b.series.q) && allFinite(c.series.q) &&
            isFinite(a.metrics.q0Fit) && isFinite(b.metrics.q0Fit) && isFinite(c.metrics.q0Fit) &&
            isFinite(a.metrics.minGap) && isFinite(b.metrics.meanGap) && isFinite(c.metrics.robustGap);
          return ok ? 0 : 1;
        },
        expect: 0, tol: 0
      }
    ]
  });

  /** 以“覆盖若干参数”的方式重跑 millikan 的 compute（自检用） */
  function milComputeFor(p, ov) {
    var q = { q0: p.q0, N: p.N, noise: p.noise, seed: p.seed }, k;
    for (k in ov) if (Object.prototype.hasOwnProperty.call(ov, k)) q[k] = ov[k];
    return SIM.models.millikan.compute(q);
  }
})(typeof window !== "undefined" ? window : globalThis);
