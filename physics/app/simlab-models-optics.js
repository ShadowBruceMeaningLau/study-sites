/* ==========================================================================
   simlab-models-optics.js —— 光学仿真模型（几何光学 / 干涉 / 衍射 / 偏振）

   4 个模型（契约见 PHYSICS-CONTENT-SPEC.md §10.3）：
     · ray-optics     薄透镜成像：三条特殊光线 + 物 + 像（没有主图曲线，全部用 extra.lines）
     · interference   双缝 / 多缝干涉强度分布 I(y)
     · diffraction    单缝衍射 I(y) = I₀(sinβ/β)²
     · polarization   马吕斯定律与布儒斯特角

   加载时不触碰 DOM（见 simlab.js 顶部约束），这样 tools/verify-simlab.mjs 能在 Node 里
   直接跑 compute() 与 tests 做物理不变量自检。4 个模型全部是确定性解析模型：不用随机数
   （对比 simlab-models-mech.js 里随机游走那类需要带种子 PRNG 的模型）。

   单位约定：参数用界面单位（nm / mm / m / 度），模型内部换算成 SI 再算；
   绘图横轴为可读性用 mm（干涉、衍射）或 m（光路图），每一条 info 都写明单位。
   ========================================================================== */
(function (global) {
  "use strict";
  var SIM = global.SIM;
  if (!SIM) return;   // 在 Node 里若未先加载 simlab.js，安静退出

  var lin = SIM.linspace, fmt = SIM.fmt;
  var DEG = Math.PI / 180;

  /* --------------------------------------------------------------- 小工具 */

  /** 数组 [from, to) 区间内最大值的**第一个**下标（sweep 用严格大于，主极大落在网格上时取最左那个） */
  function argmaxFrom(arr, from, to) {
    var best = -Infinity, bi = -1;
    var a = Math.max(0, from), b = Math.min(arr.length, to);
    for (var i = a; i < b; i++) {
      var v = arr[i];
      if (typeof v === "number" && isFinite(v) && v > best) { best = v; bi = i; }
    }
    return bi;
  }
  /** 数组 [from, to) 区间内最大值（无有效值时返回 NaN） */
  function maxFrom(arr, from, to) {
    var bi = argmaxFrom(arr, from, to);
    return bi < 0 ? NaN : arr[bi];
  }
  /** 从下标 fromIdx 往右找**第一个局部极小**，返回它的横坐标（找不到返回 NaN） */
  function firstLocalMin(xs, ys, fromIdx) {
    for (var i = Math.max(1, fromIdx + 1); i < ys.length - 1; i++) {
      if (ys[i] <= ys[i - 1] && ys[i] < ys[i + 1]) return xs[i];
    }
    return NaN;
  }
  /** 曲线与解析式的最大绝对偏差（用来证明整条曲线都对，而不只是某一点） */
  function maxAbsDiff(a, b) {
    var m = 0;
    for (var i = 0; i < a.length && i < b.length; i++) {
      var d = Math.abs(a[i] - b[i]);
      if (d > m) m = d;
    }
    return m;
  }
  /** 统计一份输出里所有非有限数（NaN / ±Infinity）的个数：边界安全自检用 */
  function countBad(o) {
    var bad = 0, i, j, k;
    var lines = (o.extra && o.extra.lines) || [];
    for (i = 0; i < lines.length; i++) {
      var xs = lines[i].x || [], ys = lines[i].y || [];
      for (j = 0; j < xs.length; j++) if (typeof xs[j] !== "number" || !isFinite(xs[j])) bad++;
      for (j = 0; j < ys.length; j++) if (typeof ys[j] !== "number" || !isFinite(ys[j])) bad++;
    }
    var keys = Object.keys(o.series || {});
    for (k = 0; k < keys.length; k++) {
      var arr = o.series[keys[k]] || [];
      for (j = 0; j < arr.length; j++) if (typeof arr[j] !== "number" || !isFinite(arr[j])) bad++;
    }
    var tt = o.t || [];
    for (j = 0; j < tt.length; j++) if (typeof tt[j] !== "number" || !isFinite(tt[j])) bad++;
    return bad;
  }
  /** 在 extra.lines 里按标签前缀取一条曲线（自检从图里现读几何量，而不是读模型自报的数） */
  function lineWith(o, prefix) {
    var lines = (o.extra && o.extra.lines) || [];
    for (var i = 0; i < lines.length; i++) {
      if (String(lines[i].label || "").indexOf(prefix) === 0) return lines[i];
    }
    return null;
  }
  /** 取某条光线**出射段**（同色的最后一段，出射段标签为空）：光路图自检用 */
  function outSegmentOf(o, color, skipLabeled) {
    var lines = (o.extra && o.extra.lines) || [];
    var found = null;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].color !== color) continue;
      if (skipLabeled && lines[i].label) continue;
      found = lines[i];
    }
    return found;
  }
  /** sinc 平方：β→0 时取极限 1（否则 sinβ/β 在 β=0 处是 0/0 = NaN） */
  function sinc2(beta) {
    if (Math.abs(beta) < 1e-8) return 1;
    var s = Math.sin(beta) / beta;
    return s * s;
  }
  /** N 缝干涉因子（归一化到主极大 = 1）：(sin(Nx)/(N sin x))²，x = δ/2 */
  function nSlitNorm(x, N) {
    var s = Math.sin(x);
    if (Math.abs(s) < 1e-12) return 1;     // x = mπ（主极大）处取极限 1
    var r = Math.sin(N * x) / (N * s);
    return r * r;
  }
  /**
   * 紧挨主极大的那个次极大的相对强度（N ≥ 3）。
   * 它落在第一对极小之间 x ∈ (π/N, 2π/N)（x = δ/2），该区间内函数单峰 → 三分搜索求极大。
   * 解析上由 d/dx[sin(Nx)/(N sin x)]² = 0 ⟺ N tan x = tan(Nx) 定出：
   *   N = 3 → x = π/2，1/9 = 11.11%；N = 4 → 2/27 = 7.407%；
   *   N = 5 → 1/16 = 6.25%；N = 8 → x = 0.5646974，5.2513%。
   * N = 2 时没有次极大（只有余弦平方），返回 0。
   */
  function firstSecondaryRel(N) {
    if (N < 3) return 0;
    var lo = Math.PI / N * 1.0000001, hi = 2 * Math.PI / N * 0.9999999;
    for (var i = 0; i < 200; i++) {
      var m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
      if (nSlitNorm(m1, N) < nSlitNorm(m2, N)) lo = m1; else hi = m2;
    }
    return nSlitNorm((lo + hi) / 2, N);
  }

  /* ==================================================== 1. 薄透镜成像（光路图）
     符号约定（高斯公式，实物 u > 0、实像 v > 0）：
        1/u + 1/v = 1/f      →   v = uf/(u−f)
        横向放大率（有符号，负号表示倒立） m = h′/h = −v/u
     u > f：实像、倒立、与物异侧（v > 0）；
     u < f：虚像、正立、与物同侧（v < 0）；
     u = f：出射光平行（v → ∞，放大率 → ∞）——必须不能除零。
     plots 为空：本模型没有"主图曲线"，全部几何都画在 extra.lines 里
     （引擎支持"每条曲线自带横轴"的作图模式）。
     ====================================================================== */
  SIM.register("ray-optics", {
    title: "薄透镜成像（光路图）",
    legend: "三条特殊光线：①平行主轴入射 → 出射过像方焦点 F′；②过光心 → 方向不变；③过物方焦点 F → 出射平行主轴。" +
      "三条线的交点就是像点。u > f 是倒立的实像，u < f 是正立的虚像（虚线是反向延长线），u = f 出射光平行、不成像。",
    axes: { xlabel: "x（沿主光轴，m）", ylabel: "y（横向，m）" },
    params: {
      f: { label: "焦距 f", unit: "m", def: 0.2, min: 0.05, max: 1, step: 0.01 },
      u: { label: "物距 u", unit: "m", def: 0.5, min: 0.06, max: 5, step: 0.01 },
      h: { label: "物高 h", unit: "m", def: 0.05, min: 0.01, max: 0.5, step: 0.01 }
    },
    plots: [],
    compute: function (p) {
      // 正数保护：滑块下限本就 > 0，这里再兜一层，避免别人用非法 config 调用时出现 0 除
      var f = p.f > 0 ? p.f : 0.2, u = p.u > 0 ? p.u : 0.5, h = p.h > 0 ? p.h : 0.05;
      // u = f（相对容差 1e-9）时下面两个式子的分母为 0，必须先分流
      var parallel = Math.abs(u - f) <= 1e-9 * Math.max(u, f);
      var v, m, hp;
      if (parallel) { v = Infinity; m = Infinity; hp = Infinity; }
      else {
        v = u * f / (u - f);        // 薄透镜公式
        m = -v / u;                 // 有符号放大率：m < 0 倒立，m > 0 正立
        hp = h * m;                 // 像高
      }
      var scale = Math.max(u, f);
      // 像太远（u→f）或放大太狠时不画像箭头，否则整张图的纵横比例会被压扁
      var showImage = isFinite(v) && Math.abs(v) <= 6 * scale && Math.abs(hp) <= 8 * h;

      // 画图窗口：左侧至少到物，右侧至少到像（或到 1.8 倍特征尺度）
      var xL, xR;
      if (showImage) {
        xL = Math.min(-u, v) * 1.15;
        xR = (v > 0 ? v : scale * 1.8) * 1.15;
      } else {
        xL = -u * 1.15;
        xR = scale * 1.8;
      }
      var yLens = Math.max(h, showImage ? Math.abs(hp) : 0) * 1.25;
      // 纵向裁剪窗口：u→f 时像高会爆掉，超出这个窗口的光线要剪掉，
      // 否则一条跑到 y = ±10 m 的光线会把整张光路图压成一条横线
      var yClip = 1.875 * yLens;

      var lines = [];
      /** 折线裁到 |y| ≤ yClip：越界的段按线性插值切在边界上（整条在外则丢弃） */
      function clipPoly(xs, ys) {
        var ox = [], oy = [], i;
        for (i = 0; i < xs.length; i++) {
          var y = ys[i], x = xs[i];
          if (typeof y !== "number" || !isFinite(y) || !isFinite(x)) continue;
          if (Math.abs(y) <= yClip) { ox.push(x); oy.push(y); continue; }
          if (ox.length) {                       // 与前一点插值出边界交点，然后停止
            var py = oy[oy.length - 1], px = ox[ox.length - 1], sy = y > 0 ? 1 : -1;
            var tt = (sy * yClip - py) / (y - py);
            if (tt > 0 && tt <= 1) { ox.push(px + (x - px) * tt); oy.push(sy * yClip); }
          }
          break;
        }
        return { x: ox, y: oy };
      }
      function push(xs, ys, label, color, dash) {
        var c = clipPoly(xs, ys);
        if (!c.y.length) return;                 // 整条线都在窗口外：不画（图例里也不留空条目）
        lines.push({ x: c.x, y: c.y, label: label, color: color, dash: dash });
      }

      // 主光轴与薄透镜所在平面（透镜用一条竖线示意）
      push([xL, xR], [0, 0], "主光轴", "#8aa0b8", "3 4");
      push([0, 0], [-yLens, yLens], "薄透镜", "#7fd8e8", null);
      // 物（竖直箭头）与像
      push([-u, -u], [0, h], "物（h = " + fmt(h, 3) + " m）", "#5aa9ff", null);
      if (showImage) {
        push([v, v], [0, hp], (v > 0 ? "实像（倒立）" : "虚像（正立）"), "#ffb84d", v > 0 ? null : "6 4");
      }

      /* 光线 1：平行主轴入射，出射过像方焦点 F′。
         入射段 (−u, h) → (0, h)；出射段斜率 = (h′−h)/v（v 有限时，这条线必过像点），
         u = f 时改为与"过光心的光线"平行：斜率 = −h/u（焦点平面发出的光出射后互相平行）。 */
      var s1 = parallel ? -h / u : (hp - h) / v;
      push([-u, 0], [h, h], "光线①：平行入射 → 过 F′", "#ff7b7b", null);
      push([0, xR], [h, h + s1 * xR], "", "#ff7b7b", null);

      /* 光线 2：过光心，方向不变。直线过 (−u, h) 与 (0, 0)，斜率 −h/u，
         在 x = v 处的值 −h·v/u 正是像高 h′，所以它自动过像点。 */
      push([-u, 0, xR], [h, 0, -h * xR / u], "光线②：过光心（不改变方向）", "#63d6a5", null);

      /* 光线 3：过物方焦点 F(−f, 0)，出射平行主轴。
         入射段所在直线过 (−u, h) 与 (−f, 0)，在透镜处的高度 y_L = −h f/(u−f)（= h′）；
         u = f 时这条光线退化（物点恰在焦点上），跳过不画；
         |y_L| 超出裁剪窗口时（u 极接近 f）也整条跳过——它已经跑出画面。 */
      var yL = NaN;
      if (!parallel) {
        yL = -h * f / (u - f);
        if (Math.abs(yL) <= yClip) {
          push([-u, 0], [h, yL], "光线③：过 F → 出射平行主轴", "#c792ea", null);
          push([0, xR], [yL, yL], "", "#c792ea", null);
          if (u < f) {
            // 物在焦点以内：F 在物的左边，入射光线"看起来来自 F"，把反向延长线画成虚线
            push([-f, -u], [0, h], "", "#c792ea", "4 4");
          }
        } else {
          yL = NaN;
        }
      }

      /* 虚像：出射光本身是发散的，只有**反向延长线**交于像点 → 画虚线延长到 (v, h′) */
      if (showImage && v < 0) {
        push([0, v], [h, hp], "", "#ffb84d", "6 4");                       // 光线①的反向延长
        if (isFinite(yL)) push([0, v], [yL, hp], "", "#ffb84d", "6 4");    // 光线③（水平）的反向延长
        if (v < -u) push([-u, v], [h, hp], "", "#ffb84d", "6 4");          // 光线②的反向延长
      }

      // 焦点与物/像顶端的标记点
      var markers = [
        { x: -f, y: 0, label: "F" },
        { x: f, y: 0, label: "F′" },
        { x: -u, y: h, label: "物顶" }
      ];
      if (showImage) markers.push({ x: v, y: hp, label: v > 0 ? "像顶（倒立）" : "像顶（正立）" });

      var kind = parallel ? "不成像（u = f，出射光平行）" : (v > 0 ? "实像（与物异侧）" : "虚像（与物同侧）");
      var orient = parallel ? "—" : (hp < 0 ? "倒立" : "正立");
      var info = [
        { k: "像距 v", v: isFinite(v) ? fmt(v, 4) + " m" : "∞（出射光平行，不成像）" },
        { k: "放大率 |m| = |v/u|", v: isFinite(m) ? fmt(Math.abs(m), 4) + "×" : "∞" },
        { k: "像高 h′ = −h·v/u", v: isFinite(hp) ? fmt(hp, 4) + " m" : "∞" },
        { k: "实像 / 虚像", v: kind },
        { k: "倒立 / 正立", v: orient },
        { k: "物距与焦距之比 u/f", v: fmt(u / f, 4) }
      ];
      if (isFinite(v) && Math.abs(v) > 6 * scale) {
        info.push({ k: "提示", v: "像距超出图示范围（|v| > 6×max(u,f)），光路图里只画到窗口边缘" });
      }

      return {
        t: [0, 1], series: {},
        info: info,
        extra: {
          lines: lines,
          markers: markers,
          xlabel: "x（沿主光轴，m）　透镜在 x = 0",
          ylabel: "y（横向，m）",
          title: "光路图：物（蓝）· 像（橙）· 三条特殊光线（红/绿/紫）；虚线 = 反向延长线"
        },
        metrics: {
          v: v, m: m, hp: hp, f: f, u: u, h: h,
          parallel: parallel ? 1 : 0,
          showImage: showImage ? 1 : 0
        }
      };
    },
    tests: [
      { // v = uf/(u−f) = 0.5×0.2/(0.5−0.2) = 1/3 m（像距从光路图的"像"线上现读）
        name: "① 像距 v = uf/(u−f)：u = 0.5、f = 0.2 → 1/3 m",
        measure: function (o) {
          var ln = lineWith(o, "实像");
          return ln ? ln.x[0] : NaN;
        }, expect: 0.3333333333333333, tol: 1e-12 },
      { // |m| = |v/u| = (1/3)/0.5 = 2/3（像高从图上的像线现读，再除以物高）
        name: "① 放大率 |m| = v/u = 2/3（由图上像高 |h′|/h 现算）",
        measure: function (o, p) {
          var ln = lineWith(o, "实像");
          return ln ? Math.abs(ln.y[1]) / p.h : NaN;
        }, expect: 0.6666666666666666, tol: 1e-12 },
      { // 物在 2f 处：v = 2f·f/(2f−f) = 2f = 0.4 m
        name: "② u = 2f 时 v = 2f = 0.4 m",
        params: { f: 0.2, u: 0.4 },
        measure: function (o) {
          var ln = lineWith(o, "实像");
          return ln ? ln.x[0] : NaN;
        }, expect: 0.4, tol: 1e-12 },
      { // 同上，此时 |m| = v/u = 1（物像等大）
        name: "② u = 2f 时 |m| = 1（物像等大）",
        params: { f: 0.2, u: 0.4, h: 0.05 },
        measure: function (o, p) {
          var ln = lineWith(o, "实像");
          return ln ? Math.abs(ln.y[1]) / p.h : NaN;
        }, expect: 1, tol: 1e-12 },
      { // u < f：v = uf/(u−f) = 0.1×0.2/(−0.1) = −0.2 m < 0 → 虚像、正立
        name: "③ u < f（u = 0.1、f = 0.2）→ v = −0.2 m（虚像，v < 0）",
        params: { f: 0.2, u: 0.1, h: 0.05 },
        measure: function (o) {
          var ln = lineWith(o, "虚像");
          return ln ? ln.x[0] : NaN;
        }, expect: -0.2, tol: 1e-12 },
      { // 同一组参数下像高 h′ = −h·v/u = −0.05×(−0.2)/0.1 = +0.1 m（正立、放大 2 倍）
        name: "③ u < f 时 h′ = −h·v/u = +0.1 m（正立放大）",
        params: { f: 0.2, u: 0.1, h: 0.05 },
        measure: function (o) {
          var ln = lineWith(o, "虚像");
          return ln ? ln.y[1] : NaN;
        }, expect: 0.1, tol: 1e-12 },
      { // u = f：分母为 0，走平行出射分支，读数给 ∞，且几何里不许出现 NaN/Infinity
        name: "④ u = f = 0.2 时读数给 ∞（平行出射）",
        params: { f: 0.2, u: 0.2 },
        measure: function (o) { return o.metrics.parallel; }, expect: 1, tol: 0 },
      { // 同上：整张光路图不允许出现任何非有限坐标
        name: "④ u = f 时光路图无 NaN/±∞（边界安全）",
        params: { f: 0.2, u: 0.2, h: 0.05 },
        measure: function (o) { return countBad(o); }, expect: 0, tol: 0 },
      { // 极端滑块组合（u 最小 + f 最大）也不能崩
        name: "④ 极端参数 u = 0.06、f = 1 时不产生非有限数",
        params: { f: 1, u: 0.06, h: 0.5 },
        measure: function (o) { return countBad(o); }, expect: 0, tol: 0 },
      { // 薄透镜公式残差：1/v + 1/u − 1/f（v 由图上的像线读出）应当为 0
        name: "⑤ 薄透镜公式 1/v + 1/u = 1/f（u = 0.6、f = 0.25）",
        params: { f: 0.25, u: 0.6, h: 0.05 },
        measure: function (o, p) {
          var ln = lineWith(o, "实像");
          if (!ln) return NaN;
          return 1 / ln.x[0] + 1 / p.u - 1 / p.f;
        }, expect: 0, tol: 1e-12 },
      { // 几何自洽：把图上"光线①的出射段"与"光线③的水平出射段"求交点，交点横坐标必须就是像距 uf/(u−f)
        name: "⑤ 图上光线①与光线③出射段的交点 = 像点（u = 0.5、f = 0.2 → 1/3 m）",
        measure: function (o) {
          var r1 = outSegmentOf(o, "#ff7b7b", true);   // 光线①出射段：(0,h) → (xR, y1)
          var r3 = outSegmentOf(o, "#c792ea", true);   // 光线③出射段：水平线 y = yL
          if (!r1 || !r3 || r1.x.length < 2 || r1.y.length < 2) return NaN;
          var x0 = r1.x[0], y0 = r1.y[0], x1 = r1.x[1], y1 = r1.y[1];
          var yL = r3.y[r3.y.length - 1];
          if (y1 === y0) return NaN;
          return x0 + (yL - y0) * (x1 - x0) / (y1 - y0);
        }, expect: 0.3333333333333333, tol: 1e-9 }
    ]
  });

  /* ==================================================== 2. 双缝 / 多缝干涉
     屏上位置 y 处的光程差（近轴） Δ = d·y/D，
     相位差 δ = 2πΔ/λ = 2π d y /(λ D)。
     N 条等宽等间距缝的强度（每条缝单独到达屏上为 I₀）：
        I = I₀ · [sin(Nδ/2) / sin(δ/2)]²
     δ → 2mπ（主极大）处取极限 I = N²I₀。
     归一化：series.I  = I/I₀（单缝强度归一，N = 2 时正是 I/I₀ = 4cos²(πdy/λD)，主极大 = N²）；
             series.In = I/I_max（主极大 = 1，便于看次极大的几个百分点）；
             series.Ilog = 10lg(In)，下限 −120 dB（避免 −∞，也避免把整张图拉伸到不可读）。
     条纹间距：相邻主极大 Δy = λD/d。
     采样网格取 Δy/M 的整数倍 → 主极大、以及 N 整除 M 时的极小都正好落在网格点上。
     ====================================================================== */
  SIM.register("interference", {
    title: "双缝 / 多缝干涉",
    legend: "条纹间距 Δy = λD/d。N = 2 是余弦平方的双缝图样；N 越大主极大越尖、越亮（主极大强度 ∝ N²），" +
      "相邻主极大之间出现 N−2 个只有几个百分点的次极大——看对数曲线最清楚。",
    axes: { xlabel: "屏上位置 y (mm)", ylabel: "I / I₀（单缝强度归一）" },
    params: {
      lambda: { label: "波长 λ", unit: "nm", def: 550, min: 380, max: 780, step: 5 },
      d: { label: "缝间距 d", unit: "mm", def: 0.2, min: 0.02, max: 2, step: 0.01 },
      D: { label: "缝到屏距离 D", unit: "m", def: 1, min: 0.2, max: 5, step: 0.1 },
      N: { label: "缝数 N", unit: "", def: 2, min: 2, max: 8, step: 1 }
    },
    plots: [
      { key: "I", label: "I/I₀（单缝归一，主极大 = N²）", color: "#5aa9ff" },
      { key: "In", label: "I/I_max（主极大 = 1）", color: "#ffb84d" },
      { key: "Ilog", label: "10lg(I/I_max) (dB)", color: "#63d6a5", dash: "5 4" }
    ],
    compute: function (p) {
      var lam = (p.lambda > 0 ? p.lambda : 550) * 1e-9;   // nm → m（正数保护：0 会毁掉整条网格）
      var d = (p.d > 0 ? p.d : 0.2) * 1e-3;               // mm → m
      var D = p.D > 0 ? p.D : 1;                          // m
      var N = Math.max(2, Math.round(p.N));
      var N2 = N * N;
      var dyM = lam * D / d;                     // 条纹间距 Δy = λD/d（m）
      var dyMm = dyM * 1e3;                      // 绘图横轴单位 mm
      var M = 400;                               // 每个条纹间距的采样点数
      var K = 3;                                 // 每侧显示的条纹数
      var n = 2 * K * M + 1, center = K * M;
      var t = [], I = [], In = [], Ilog = [];
      for (var i = 0; i < n; i++) {
        var k = i - center;
        var yMm = k * dyMm / M;
        var half = Math.PI * k / M;              // δ/2 = π d y/(λD)，网格上正好是 πk/M
        var ratio;
        if (Math.abs(Math.sin(half)) < 1e-9) {
          ratio = N2;                            // δ/2 = mπ：主极大，取极限 [sin(Nδ/2)/sin(δ/2)]² → N²
        } else {
          var r = Math.sin(N * half) / Math.sin(half);
          ratio = r * r;
        }
        t.push(yMm);
        I.push(ratio);                           // I/I₀
        var rel = ratio / N2;                    // I/I_max
        In.push(rel);
        Ilog.push(10 * Math.log10(Math.max(rel, 1e-12)));   // 下限 −120 dB
      }
      var imax = maxFrom(I, 0, I.length);
      var ym1 = firstLocalMin(t, I, center);     // 中央主极大右侧的第一个极小 = Δy/N
      var orders = [];
      for (var mm = -K; mm <= K; mm++) orders.push("m=" + mm + ": " + fmt(mm * dyMm, 3));
      return {
        t: t,
        series: { I: I, In: In, Ilog: Ilog },
        info: [
          { k: "条纹间距 Δy = λD/d", v: fmt(dyMm, 4) + " mm" },
          { k: "主极大位置（屏上）", v: orders.join("　") + " mm" },
          { k: "主极大强度 I_max/I₀ = N²", v: fmt(imax, 4) + "（= " + N + "² = " + N2 + "，" + N + " 条缝同相叠加）" },
          { k: "第一极小位置 Δy/N", v: fmt(ym1, 4) + " mm（主极大半宽）" },
          { k: "相邻主极大之间最大的次极大", v: N < 3 ? "无（N = 2 只有余弦平方，没有次极大）"
              : fmt(firstSecondaryRel(N) * 100, 3) + "% I_max（N − 2 = " + (N - 2) + " 个次极大，见对数曲线）" },
          { k: "缝间距与波长之比 d/λ", v: fmt(d / lam, 1) + "（越大条纹越密）" },
          { k: "屏上可见条纹（±" + K + " 级内）", v: String(2 * K + 1) + " 个主极大" }
        ],
        metrics: { dyMm: dyMm, dyM: dyM, N: N, N2: N2, M: M, K: K, center: center, lam: lam, d: d, D: D, I: I, In: In, t: t }
      };
    },
    tests: [
      { // Δy = λD/d = 550e-9 × 1 / 0.2e-3 = 2.75e-3 m = 2.75 mm（从曲线的相邻主极大位置现测）
        name: "① 条纹间距 Δy = λD/d = 2.75 mm（由曲线主极大位置现测）",
        measure: function (o) {
          var c = o.metrics.center, idx = argmaxFrom(o.series.I, c + 1, o.series.I.length);
          return idx < 0 ? NaN : o.t[idx];
        }, expect: 2.75, tol: 1e-9 },
      { // N = 2 时 [sin(δ)/sin(δ/2)]² = 4cos²(δ/2)，δ/2 = πdy/(λD)：整条曲线与 4cos² 逐点比对
        name: "② N = 2 时 I/I₀ = 4cos²(πdy/λD)（整条曲线最大绝对偏差 < 1e-9）",
        measure: function (o) {
          var ref = [], t = o.t, i;
          for (i = 0; i < t.length; i++) {
            var c = Math.cos(Math.PI * o.metrics.d * (t[i] * 1e-3) / (o.metrics.lam * o.metrics.D));
            ref.push(4 * c * c);
          }
          return maxAbsDiff(o.series.I, ref);
        }, expect: 0, tol: 1e-9 },
      { // 主极大处取最大值：max(I) 必须正好等于 N²
        name: "③ 主极大取最大值：max(I)/N² = 1",
        measure: function (o) { return maxFrom(o.series.I, 0, o.series.I.length) / o.metrics.N2; },
        expect: 1, tol: 1e-12 },
      { // 换一组参数：Δy = 400e-9 × 2 / 0.5e-3 = 1.6e-3 m = 1.6 mm
        name: "④ 换参数（λ = 400 nm、d = 0.5 mm、D = 2 m）Δy = 1.6 mm",
        params: { lambda: 400, d: 0.5, D: 2, N: 2 },
        measure: function (o) {
          var c = o.metrics.center, idx = argmaxFrom(o.series.I, c + 1, o.series.I.length);
          return idx < 0 ? NaN : o.t[idx];
        }, expect: 1.6, tol: 1e-9 },
      { // N 缝的第一极小出现在 δ = 2π/N 处 → y = Δy/N = 2.75/4 = 0.6875 mm
        name: "⑤ N = 4 时第一极小在 Δy/N = 0.6875 mm",
        params: { N: 4 },
        measure: function (o) {
          return firstLocalMin(o.t, o.series.I, o.metrics.center);
        }, expect: 0.6875, tol: 1e-9 },
      { // N = 8 紧挨主极大的那个次极大：由 d/dx[sin(Nx)/(N sin x)]² = 0 ⟺ N tan x = tan(Nx)
        // 定出 x = 0.5646974（x = δ/2），相对强度 = [sin(8x)/(8 sin x)]² = 0.0525128
        // （网格采样的极大值会略低一点，误差 ~4e-5，所以容差取 1e-3）
        name: "⑥ N = 8 时第一级次极大 ≈ 0.052513（解析：N tan x = tan(Nx)）",
        params: { N: 8 },
        measure: function (o) {
          var c = o.metrics.center, M = o.metrics.M, N = o.metrics.N;
          // 次极大位于第一对极小之间：k ∈ (M/N, 2M/N)
          return maxFrom(o.series.I, c + Math.round(M / N) + 1, c + Math.round(2 * M / N)) / o.metrics.N2;
        }, expect: 0.0525128, tol: 1e-3 },
      { // 奇数 N（极小不与网格对齐）时也不能出现 NaN/∞
        name: "⑦ N = 7 时整条曲线无 NaN/±∞（边界安全）",
        params: { N: 7 },
        measure: function (o) { return countBad(o); }, expect: 0, tol: 0 },
      { // 极端参数：最长波长 + 最大缝间距
        name: "⑦ 极端参数（λ = 780 nm、d = 2 mm、D = 5 m）无异常值",
        params: { lambda: 780, d: 2, D: 5, N: 3 },
        measure: function (o) { return countBad(o); }, expect: 0, tol: 0 }
    ]
  });

  /* ======================================================== 3. 单缝衍射
     单缝夫琅禾费衍射强度（近轴）：
        β = π a sinθ / λ ≈ π a y /(λ D)
        I(y) = I₀ (sinβ/β)²          （β → 0 处取极限 1，不能出 NaN）
     第一极小（暗纹）β = π：y₁ = λD/a；中央明纹宽度 = 2y₁；
     次级极大 β 满足 tanβ = β：β₁ = 4.493409… → I/I₀ = 0.047190（≈ 4.7%），
     这正是"主极大 1、次极大只有几个百分点"的动态范围 → 同时给线性与对数曲线。
     采样网格取 y₁/M 的整数倍 → β = πk/M，中心（β = 0）与第一极小（β = π）都精确落在网格上。
     ====================================================================== */
  SIM.register("diffraction", {
    title: "单缝衍射",
    legend: "I/I₀ = (sinβ/β)²，β = πa·y/(λD)。第一暗纹在 y₁ = λD/a，中央明纹宽度 2y₁。" +
      "缝越窄（a 越小）衍射越明显：中央明纹越宽。次级极大只有 4.7%、1.6%…所以对数曲线才看得见它们。",
    axes: { xlabel: "屏上位置 y (mm)", ylabel: "I / I₀" },
    params: {
      lambda: { label: "波长 λ", unit: "nm", def: 550, min: 380, max: 780, step: 5 },
      a: { label: "缝宽 a", unit: "mm", def: 0.1, min: 0.01, max: 2, step: 0.01 },
      D: { label: "缝到屏距离 D", unit: "m", def: 1, min: 0.2, max: 5, step: 0.1 }
    },
    plots: [
      { key: "I", label: "I/I₀（线性，中央明纹 = 1）", color: "#5aa9ff" },
      { key: "Ilog", label: "10lg(I/I₀) (dB)", color: "#63d6a5", dash: "5 4" }
    ],
    compute: function (p) {
      var lam = (p.lambda > 0 ? p.lambda : 550) * 1e-9;   // 正数保护：λ、a、D 里任何一个取 0 都会
      var a = (p.a > 0 ? p.a : 0.1) * 1e-3;               // 让 y₁ = λD/a 退化成 0 或 ∞
      var D = p.D > 0 ? p.D : 1;
      var y1M = lam * D / a;                     // 第一极小 y₁ = λD/a（m）
      var y1Mm = y1M * 1e3;                      // mm
      var M = 400, K = 4;                        // 每侧 4 个次极大，每个 y₁ 采 400 点
      var n = 2 * K * M + 1, center = K * M;
      var t = [], I = [], Ilog = [];
      for (var i = 0; i < n; i++) {
        var k = i - center;
        var yMm = k * y1Mm / M;
        var beta = Math.PI * k / M;              // β = πa y/(λD) = π y/y₁
        var val = sinc2(beta);                   // β = 0 处由 sinc2 取极限 1
        t.push(yMm);
        I.push(val);
        Ilog.push(10 * Math.log10(Math.max(val, 1e-12)));   // 下限 −120 dB
      }
      var y1Curve = firstLocalMin(t, I, center); // 从曲线现测的第一极小
      var leftMin = NaN, rightMin = NaN;
      var j;
      for (j = center - 1; j > 0; j--) {
        if (I[j] <= I[j - 1] && I[j] < I[j + 1]) { leftMin = t[j]; break; }
      }
      for (j = center + 1; j < I.length - 1; j++) {
        if (I[j] <= I[j - 1] && I[j] < I[j + 1]) { rightMin = t[j]; break; }
      }
      var width = rightMin - leftMin;
      var i2 = argmaxFrom(I, center + M + 1, center + 2 * M);   // 第一级次极大
      var beta1 = 4.493409457909064;             // tanβ = β 的最小正根
      return {
        t: t,
        series: { I: I, Ilog: Ilog },
        info: [
          { k: "第一极小 y₁ = λD/a", v: fmt(y1Mm, 4) + " mm" },
          { k: "中央明纹宽度 2y₁", v: fmt(2 * y1Mm, 4) + " mm" },
          { k: "中央明纹角半宽 θ₁ = λ/a", v: fmt(lam / a, 4) + " rad = " + fmt(lam / a / DEG, 4) + "°" },
          { k: "第一级次极大位置 y = β₁y₁/π", v: fmt(beta1 * y1Mm / Math.PI, 4) + " mm（β₁ = 4.4934，tanβ = β 的根）" },
          { k: "第一级次极大强度", v: fmt(Math.pow(Math.sin(beta1) / beta1, 2) * 100, 3) + "% I₀（" + fmt(10 * Math.log10(Math.pow(Math.sin(beta1) / beta1, 2)), 4) + " dB）" },
          { k: "曲线上现测的第一极小", v: fmt(y1Curve, 4) + " mm（与 λD/a 一致）" },
          { k: "曲线上现测的中央明纹宽度", v: fmt(width, 4) + " mm（两侧第一极小间距，= 2y₁）" },
          { k: "曲线上现测的第一级次极大", v: i2 < 0 ? "—" : fmt(I[i2] * 100, 3) + "% I₀" },
          { k: "归一化说明", v: "I₀ = 中央（β = 0）强度，取 1；β = πa·y/(λD) 为近轴近似（本参数下 sinθ ≈ y/D）" }
        ],
        metrics: { y1Mm: y1Mm, y1M: y1M, lam: lam, a: a, D: D, M: M, K: K, center: center, beta1: beta1, I: I, t: t }
      };
    },
    tests: [
      { // y₁ = λD/a = 550e-9 × 1 / 0.1e-3 = 5.5e-3 m = 5.5 mm（从曲线的第一极小现测，不读模型自报的数）
        name: "① 第一极小 y₁ = λD/a = 5.5 mm（由曲线第一极小现测）",
        measure: function (o) { return firstLocalMin(o.t, o.series.I, o.metrics.center); },
        expect: 5.5, tol: 1e-9 },
      { // β = π 处 sinβ/β 的极限为 0（数值上是 (sin π/π)² ~ 1e-33），远小于 1e-6
        name: "② β = π（y = y₁）处 I/I₀ < 1e-6",
        measure: function (o) { return o.series.I[o.metrics.center + o.metrics.M]; },
        expect: 0, tol: 1e-6 },
      { // β → 0 时 sinβ/β → 1：sinc2 必须取极限而不是 0/0 = NaN
        name: "③ I(0)/I₀ = 1（β = 0 处取极限，不是 NaN）",
        measure: function (o) { return o.series.I[o.metrics.center]; },
        expect: 1, tol: 1e-12 },
      { // 中央明纹宽度 = 两侧第一极小间距 = 2y₁ = 11 mm
        name: "④ 中央明纹宽度 = 2y₁ = 11 mm（两侧第一极小间距，由曲线现测）",
        measure: function (o) {
          var I = o.series.I, t = o.t, c = o.metrics.center, L = NaN, R = NaN, j;
          for (j = c - 1; j > 0; j--) if (I[j] <= I[j - 1] && I[j] < I[j + 1]) { L = t[j]; break; }
          for (j = c + 1; j < I.length - 1; j++) if (I[j] <= I[j - 1] && I[j] < I[j + 1]) { R = t[j]; break; }
          return R - L;
        }, expect: 11, tol: 1e-9 },
      { // 第一级次极大：(sinβ₁/β₁)²，β₁ = 4.493409457909064 是 tanβ = β 的最小正根 → 0.0471904
        name: "⑤ 第一级次极大 = (sinβ₁/β₁)² = 0.047190（β₁ 满足 tanβ = β）",
        measure: function (o) { return maxFrom(o.series.I, o.metrics.center + o.metrics.M + 1, o.metrics.center + 2 * o.metrics.M); },
        expect: 0.0471904, tol: 1e-4 },
      { // 换一组参数：a = 0.25 mm、λ = 600 nm、D = 2 m → y₁ = 600e-9×2/0.25e-3 = 4.8 mm
        name: "⑥ 换参数（λ = 600 nm、a = 0.25 mm、D = 2 m）y₁ = 4.8 mm",
        params: { lambda: 600, a: 0.25, D: 2 },
        measure: function (o) { return firstLocalMin(o.t, o.series.I, o.metrics.center); },
        expect: 4.8, tol: 1e-9 },
      { // 最窄缝 + 最长波长：极大范围采样，确认没有 NaN/∞
        name: "⑦ 极端参数（λ = 780 nm、a = 0.01 mm、D = 5 m）无 NaN/±∞",
        params: { lambda: 780, a: 0.01, D: 5 },
        measure: function (o) { return countBad(o); }, expect: 0, tol: 0 }
    ]
  });

  /* ================================================ 4. 马吕斯定律与布儒斯特角
     入射光是**线偏振光**（振动方向定为零度方向），依次通过两块偏振片：
        I₁/I₀ = cos²θ₁                      （马吕斯定律）
        I₂/I₀ = cos²θ₁ · cos²θ₂
     主图横轴是 θ₁（0°~180°），θ₂ 只作为参数（所以 T₂ 曲线整体随 θ₂ 缩放）。
     布儒斯特角（自然光由空气射向折射率 n 的介质，反射光全为 s 偏振）：
        tanθ_B = n          →   θ_B = arctan n
     θ_B 处反射率（菲涅耳公式，n₁ = 1）：
        R_s = [sin(θ−θ_t)/sin(θ+θ_t)]² ，R_p = [tan(θ−θ_t)/tan(θ+θ_t)]² ，θ_t = arcsin(sinθ/n)
        R_p(θ_B) = 0；R_s(θ_B) = cos²(2θ_B) = [(n²−1)/(n²+1)]²
     extra 图画出 R_s(θ)、R_p(θ)，用它可以从图上独立读出 θ_B（R_p 的零点）。
     另外说明：若入射是自然光，第一级后 I₁ = I₀/2，之后才按 cos²θ₂ 变化（info 里给出）。
     ====================================================================== */
  SIM.register("polarization", {
    title: "马吕斯定律与布儒斯特角",
    legend: "两块偏振片：I₁/I₀ = cos²θ₁，I₂/I₀ = cos²θ₁cos²θ₂（θ 从入射偏振方向量起）。" +
      "θ₁ = 90° 完全消光；下图是自然光在介质表面反射时两个分量的反射率，θ_B = arctan n 处 R_p = 0，反射光成为完全的线偏振光。",
    axes: { xlabel: "θ₁（偏振片1 与偏振方向夹角，°）", ylabel: "透过率 I/I₀" },
    params: {
      theta1: { label: "偏振片1 转角 θ₁", unit: "°", def: 0, min: 0, max: 180, step: 1 },
      theta2: { label: "偏振片2 转角 θ₂", unit: "°", def: 0, min: 0, max: 180, step: 1 },
      n: { label: "介质折射率 n", unit: "", def: 1.5, min: 1, max: 3, step: 0.01 }
    },
    plots: [
      { key: "T1", label: "第一级 I₁/I₀ = cos²θ₁", color: "#5aa9ff" },
      { key: "T2", label: "第二级 I₂/I₀ = cos²θ₁cos²θ₂", color: "#ffb84d", dash: "5 4" }
    ],
    compute: function (p) {
      var n = p.n >= 1 ? p.n : 1;                // 下限保护：n < 1 时 arcsin 会越界（n = 1 是"没有界面"，可以正常算）
      var th2 = p.theta2 * DEG;
      var c2sq = Math.cos(th2) * Math.cos(th2);  // cos²θ₂
      var t = lin(0, 180, 361);                  // 1° 步长 → θ₁ = 60° 正好是第 120 个网格点
      var T1 = [], T2 = [], i;
      for (i = 0; i < t.length; i++) {
        var c = Math.cos(t[i] * DEG);
        var a1 = c * c;
        T1.push(a1);
        T2.push(a1 * c2sq);
      }
      var c1now = Math.cos(p.theta1 * DEG);
      var T1now = c1now * c1now;
      var T2now = T1now * c2sq;

      var thetaB = Math.atan(n) / DEG;           // 布儒斯特角 θ_B = arctan n
      var thetaBRad = Math.atan(n);
      var thetaT = Math.asin(Math.sin(thetaBRad) / n);   // θ_B 处的折射角（= 90° − θ_B）
      var RsB = Math.pow(Math.sin(thetaBRad - thetaT) / Math.sin(thetaBRad + thetaT), 2);
      var RpB = Math.pow(Math.tan(thetaBRad - thetaT) / Math.tan(thetaBRad + thetaT), 2);

      // 菲涅耳反射率曲线（空气 → 介质，0°~90°）
      var NS = 1801;                             // 0.05° 步长：足够让抛物插值定出 θ_B
      var th = lin(0, 90, NS), Rs = [], Rp = [];
      var R0 = (1 - n) / (1 + n); R0 = R0 * R0;  // 正入射极限 R = ((1−n)/(1+n))²
      for (i = 0; i < NS; i++) {
        var ang = th[i] * DEG;
        if (ang < 1e-12) {
          // θ = 0 时 sin(θ−θ_t)/sin(θ+θ_t) 与 tan 形式都是 0/0，必须取极限，不能出 NaN
          Rs.push(R0); Rp.push(R0);
          continue;
        }
        var st = Math.sin(ang) / n;
        var tt2 = Math.asin(st > 1 ? 1 : st);
        var ds = Math.sin(ang - tt2) / Math.sin(ang + tt2);
        var dp = Math.tan(ang - tt2) / Math.tan(ang + tt2);
        Rs.push(ds * ds);
        Rp.push(dp * dp);
      }
      return {
        t: t,
        series: { T1: T1, T2: T2 },
        info: [
          { k: "第一级透过率 I₁/I₀ = cos²θ₁", v: fmt(T1now, 4) + "（θ₁ = " + fmt(p.theta1, 3) + "°）" },
          { k: "第二级透过率 I₂/I₀ = cos²θ₁cos²θ₂", v: fmt(T2now, 4) + "（θ₂ = " + fmt(p.theta2, 3) + "°）" },
          { k: "布儒斯特角 θ_B = arctan n", v: fmt(thetaB, 4) + "°" },
          { k: "θ_B 处反射光偏振", v: "R_p = " + fmt(RpB, 6) + "（平行分量完全折射，不反射）→ 反射光为纯 s 线偏振" },
          { k: "θ_B 处 s 分量反射率 R_s = [(n²−1)/(n²+1)]²", v: fmt(RsB, 6) + "（约 " + fmt(RsB * 100, 3) + "%）" },
          { k: "消光条件", v: "θ₁ = 90°（或 θ₂ = 90°）时完全消光；两片正交时 I₂ = 0" },
          { k: "若入射为自然光", v: "第一级后 I₁ = I₀/2（与 θ₁ 无关），之后 I₂ = (I₀/2)cos²θ₂" },
          { k: "偏振片2 相对偏振片1 的夹角", v: fmt(Math.abs(p.theta2 - p.theta1), 3) + "°（马吕斯定律里的夹角要从上一级出射偏振方向量起）" }
        ],
        extra: {
          lines: [
            { x: th, y: Rs, label: "R_s（垂直分量）", color: "#ff7b7b" },
            { x: th, y: Rp, label: "R_p（平行分量，θ_B 处为 0）", color: "#5aa9ff" }
          ],
          markers: [{ x: thetaB, y: 0, label: "θ_B = " + fmt(thetaB, 3) + "°" }],
          xlabel: "入射角 θ（°）",
          ylabel: "反射率 R",
          title: "布儒斯特角：θ_B 处 R_p = 0（反射光完全线偏振）"
        },
        metrics: {
          thetaB: thetaB, thetaBRad: thetaBRad, thetaT: thetaT,
          RpB: RpB, RsB: RsB, n: n, T1now: T1now, T2now: T2now,
          th: th, Rs: Rs, Rp: Rp
        }
      };
    },
    tests: [
      { // 马吕斯定律：I₁/I₀ = cos²θ₁ = cos²60° = 0.25（从主图曲线上 θ₁ = 60° 处现读）
        name: "① I₁/I₀ = cos²θ₁（θ₁ = 60° → 0.25）",
        params: { theta1: 60 },
        measure: function (o) { return o.series.T1[120]; }, expect: 0.25, tol: 1e-12 },
      { // I₂/I₀ = cos²θ₁cos²θ₂ = 0.25 × 0.5 = 0.125（θ₁ = 60°、θ₂ = 45°）
        name: "② I₂/I₀ = cos²θ₁cos²θ₂（60°、45° → 0.125）",
        params: { theta1: 60, theta2: 45 },
        measure: function (o) { return o.series.T2[120]; }, expect: 0.125, tol: 1e-12 },
      { // θ_B = arctan 1.5 = 56.309932474020215°
        name: "③ θ_B = arctan n = 56.30993°（n = 1.5）",
        measure: function (o) { return o.metrics.thetaB; }, expect: 56.309932474020215, tol: 1e-9 },
      { // 从菲涅耳 R_p 曲线的零点（三点抛物插值）独立定出 θ_B，检验 extra 图与解析值一致
        name: "③ 由 R_p 曲线零点（抛物插值）定出 θ_B = 56.3099°（±0.01°）",
        measure: function (o) {
          var Rp = o.metrics.Rp, th = o.metrics.th, i, bi = 0;
          for (i = 1; i < Rp.length; i++) if (Rp[i] < Rp[bi]) bi = i;
          if (bi === 0 || bi === Rp.length - 1) return NaN;
          var x0 = th[bi - 1], x1 = th[bi], x2 = th[bi + 1];
          var y0 = Rp[bi - 1], y1 = Rp[bi], y2 = Rp[bi + 1];
          var den = (x1 - x0) * (y1 - y2) - (x1 - x2) * (y1 - y0);
          if (den === 0) return x1;
          var xv = x1 - 0.5 * ((x1 - x0) * (x1 - x0) * (y1 - y2) - (x1 - x2) * (x1 - x2) * (y1 - y0)) / den;
          return xv;
        }, expect: 56.309932474020215, tol: 0.01 },
      { // θ_B 入射时平行分量不反射：R_p(θ_B) = 0（数值上 ~1e-33）
        name: "④ θ_B 处 R_p = 0（< 1e-12）",
        measure: function (o) { return o.metrics.RpB; }, expect: 0, tol: 1e-12 },
      { // R_s(θ_B) = cos²2θ_B = [(n²−1)/(n²+1)]² = (1.25/3.25)² = 0.147929
        name: "⑤ θ_B 处 R_s = [(n²−1)/(n²+1)]² = 0.147929（n = 1.5）",
        measure: function (o) { return o.metrics.RsB; }, expect: 0.14792899408284024, tol: 1e-9 },
      { // 正交偏振片完全消光：θ₁ = 0°、θ₂ = 90° → I₂ = 0
        name: "⑥ 正交偏振片消光：θ₁ = 0°、θ₂ = 90° → I₂ = 0",
        params: { theta1: 0, theta2: 90 },
        measure: function (o) { return o.metrics.T2now; }, expect: 0, tol: 1e-12 },
      { // θ₁ = 90° 时第一级就完全消光：曲线在网格点 180 处为 0
        name: "⑦ θ₁ = 90° 时 I₁/I₀ = 0（主图网格点现读）",
        measure: function (o) { return o.series.T1[180]; }, expect: 0, tol: 1e-12 },
      { // n = 3 时 θ_B = arctan 3 = 71.56505117707799°
        name: "⑧ n = 3 时 θ_B = arctan 3 = 71.56505°",
        params: { n: 3 },
        measure: function (o) { return o.metrics.thetaB; }, expect: 71.56505117707799, tol: 1e-9 },
      { // 周期性：θ₁ = 180° 处 cos² 回到 1（马吕斯定律的 180° 周期）
        name: "⑨ θ₁ = 180° 时 I₁/I₀ = cos²180° = 1（180° 周期）",
        measure: function (o) { return o.series.T1[360]; }, expect: 1, tol: 1e-12 },
      { // 正入射 R = ((1−n)/(1+n))² = (0.5/2.5)² = 0.04（菲涅耳公式在 θ=0 是 0/0，必须取极限）
        name: "⑩ 正入射反射率 R(0) = [(n−1)/(n+1)]² = 0.04（θ = 0 取极限）",
        measure: function (o) { return o.metrics.Rs[0]; }, expect: 0.04, tol: 1e-9 },
      { // 边界安全：主图与菲涅耳曲线都不许出现 NaN/±∞（countBad 会遍历 t / series / extra.lines）
        name: "⑩ 全部输出无 NaN/±∞（含正入射处的菲涅耳极限）",
        measure: function (o) { return countBad(o); }, expect: 0, tol: 0 },
      { // 滑块下界 n = 1（"没有界面"）：θ_B = arctan 1 = 45°，且菲涅耳曲线处处为 0（不能 0/0）
        name: "⑪ n = 1 时 θ_B = arctan 1 = 45°（滑块下界）",
        params: { n: 1 },
        measure: function (o) { return o.metrics.thetaB; }, expect: 45, tol: 1e-12 },
      { // n = 1 时反射率恒为 0：θ = 90° 处 sin(θ+θ_t) = sin 180° 也不能除出 NaN
        name: "⑪ n = 1 时反射率曲线全为 0 且无 NaN（含 θ = 90° 端点）",
        params: { n: 1 },
        measure: function (o) {
          var m = 0, i;
          for (i = 0; i < o.metrics.Rs.length; i++) m = Math.max(m, o.metrics.Rs[i], o.metrics.Rp[i]);
          return m + countBad(o);
        }, expect: 0, tol: 1e-12 }
    ]
  });

})(typeof window !== "undefined" ? window : globalThis);
