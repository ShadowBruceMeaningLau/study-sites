/* ==========================================================================
   simlab.js —— 声明式物理仿真引擎（核心）

   为什么需要它：
     · datalab 只能"逐步显示变量快照"，给不了物理最需要的东西——**把微分方程解出来看曲线**；
     · 内容文件是纯数据（禁函数），所以"物理"必须写进引擎的**模型注册表**，
       课程只写 config：{ model:"shm", params:{...}, vary:[...] }。

   三件事在这个文件里：
     1. 数值积分（RK4）与采样；
     2. SVG 折线图 / 相图 / 柱状图（零依赖，不引入任何绘图库）；
     3. 模型注册表 SIM.register(name, def) 与渲染入口 SIM.render(host, block)。

   ★ 设计约束（非常重要）：
     本文件与 simlab-models-*.js 在 **加载时不得触碰 DOM**。
     所有 DOM 操作都必须在函数体内、被调用时才执行——这样 tools/verify-simlab.mjs
     才能在 Node 里用 window 桩加载它们，直接跑 compute() 做物理不变量自检。

   模型定义（def）字段：
     title    : 显示名
     legend   : 一句话说明（可选）
     params   : { key: {label, unit, def, min, max, step} }
               或枚举型：{ key: {label, type:"enum", options:["A","B"], def:0} }
               —— 枚举参数的取值就是**选项下标（0 开始）**，模型里用 SIM.opt(options, p.key) 取名字
     plots    : [{ key, label, color, dash? }]  —— 主图的曲线
     compute  : function(params) -> {
                  t: [...],                          // 横轴
                  series: { key: [...] },            // 与 plots[].key 对应
                  info:  [{k, v}],                   // 数值读数（可选）
                  bars:  [{label, value, color}],    // 能量条等（可选）
                  extra: { x, y, xlabel, ylabel, title } | null   // 第二张图：相图/谱线等（可选）
                }
     vary     : （可选）模型可声明"可对比参数"，由 config.vary 驱动多曲线对比
     tests    : [{ name, params?, measure(out)->number, expect, tol }]
                —— verify-simlab.mjs 消费；measure 尽量从 series 现算，不依赖模型自报
   ========================================================================== */
(function (global) {
  "use strict";

  /* ------------------------------------------------------------- 基础工具 */
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function btn(text, cls) { return el("button", "btn sm " + (cls || ""), text); }

  var PALETTE = ["#5aa9ff", "#ffb84d", "#63d6a5", "#ff7b7b", "#c792ea", "#7fd8e8", "#e8d44d", "#9fe870"];

  function linspace(a, b, n) {
    var out = [], i;
    if (n <= 1) return [a];
    for (i = 0; i < n; i++) out.push(a + ((b - a) * i) / (n - 1));
    return out;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  /** 取枚举参数对应的选项名（下标越界时夹到合法范围），模型里用 SIM.opt(options, p.kind) */
  function opt(list, i) {
    var a = list || [];
    var k = clamp(Math.round(Number(i) || 0), 0, a.length - 1);
    return a[k];
  }
  function fmt(v, digits) {
    if (v == null || !isFinite(v)) return "—";
    var d = digits == null ? 4 : digits;
    var a = Math.abs(v);
    if (a !== 0 && (a < 1e-3 || a >= 1e5)) {
      var e = v.toExponential(2).split("e");
      return e[0] + "×10^" + e[1].replace("+", "");
    }
    var s = v.toFixed(d);
    // 只在**有小数点**时去掉尾零：否则 fmt(20000, 0) 会被吃成 "2"
    if (s.indexOf(".") >= 0) s = s.replace(/0+$/, "").replace(/\.$/, "");
    return s === "-0" ? "0" : s;
  }

  /**
   * 四阶龙格－库塔积分器。
   *   f(t, y) -> dy[]（y 与 dy 都是数组）
   * 返回 { t:[], y:[[...], ...] }（y[k][i] 是第 k 个分量的第 i 个采样）
   */
  function rk4(f, y0, t0, t1, n) {
    var dim = y0.length, h = (t1 - t0) / (n - 1);
    var ts = [], ys = [];
    var k, i;
    for (k = 0; k < dim; k++) ys.push([]);
    var y = y0.slice(), t = t0;
    function add(a, b, s) { var o = [], i; for (i = 0; i < a.length; i++) o.push(a[i] + b[i] * s); return o; }
    for (i = 0; i < n; i++) {
      ts.push(t);
      for (k = 0; k < dim; k++) ys[k].push(y[k]);
      if (i === n - 1) break;
      var k1 = f(t, y);
      var k2 = f(t + h / 2, add(y, k1, h / 2));
      var k3 = f(t + h / 2, add(y, k2, h / 2));
      var k4 = f(t + h, add(y, k3, h));
      var yn = [];
      for (k = 0; k < dim; k++) yn.push(y[k] + (h / 6) * (k1[k] + 2 * k2[k] + 2 * k3[k] + k4[k]));
      y = yn; t += h;
    }
    return { t: ts, y: ys };
  }

  /* ---------------------------------------------------------------- 绘图 */
  var VB_W = 660, VB_H = 300, PAD_L = 62, PAD_R = 14, PAD_T = 18, PAD_B = 40;

  function niceTicks(min, max, count) {
    if (!isFinite(min) || !isFinite(max)) return [0, 1];
    if (min === max) { min -= 0.5; max += 0.5; }
    var span = max - min, step = Math.pow(10, Math.floor(Math.log(span / count) / Math.LN10));
    var err = (span / count) / step;
    if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2;
    var start = Math.ceil(min / step) * step, out = [], guard = 0;
    // 刻度用"整数计数 × step"算，而不是 v += step 累加：
    // 累加会让 0 刻度显示成 −5.55×10⁻¹⁷ 这种脏数字。
    var base = Math.round(start / step);
    while (guard++ < 400) {
      var v = (base + guard - 1) * step;
      if (v > max + step * 1e-6) break;
      out.push(v);
    }
    return out;
  }

  /**
   * 折线图。spec = { x:[], series:[{label,y,color,dash,x?}], xlabel, ylabel, markers:[{x,y,label}] }
   *
   * 两种模式：
   *   · 共享横轴：只给 spec.x，各 series 只带 y（时间序列、分布曲线都用这个）；
   *   · 各自横轴：series 自带 x（电场线、能级图、多轨迹相图、谱线这类"一张图多条独立曲线"用它）。
   * 返回 SVG 元素（字符串构造后转 DOM，便于 smoke-test 断言）。
   */
  function chart(spec) {
    var x = spec.x || [];
    var series = (spec.series || []).filter(function (s) { return s && s.y && s.y.length; });
    var i, j, s;
    var xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (i = 0; i < x.length; i++) { if (x[i] < xmin) xmin = x[i]; if (x[i] > xmax) xmax = x[i]; }
    for (j = 0; j < series.length; j++) {
      s = series[j];
      var sx = s.x && s.x.length ? s.x : x;
      if (s.x && s.x.length) {
        for (i = 0; i < s.x.length; i++) { if (s.x[i] < xmin) xmin = s.x[i]; if (s.x[i] > xmax) xmax = s.x[i]; }
      }
      for (i = 0; i < s.y.length; i++) {
        var v = s.y[i];
        if (typeof v === "number" && isFinite(v)) { if (v < ymin) ymin = v; if (v > ymax) ymax = v; }
      }
      void sx;
    }
    if (!isFinite(xmin)) { xmin = 0; xmax = 1; }
    // 横轴退化保护：若所有采样点的 x 相同（例如时间滑块取 0 时 linspace(0,0,N)），
    // 不保护会让 X(v) 除以 0，画出 Infinity/NaN 的网格坐标。
    if (xmin === xmax) { xmin -= 0.5; xmax += 0.5; }
    if (!isFinite(ymin)) { ymin = 0; ymax = 1; }
    if (ymin === ymax) { ymin -= 1; ymax += 1; }
    var padY = (ymax - ymin) * 0.08;
    ymin -= padY; ymax += padY;

    var W = VB_W, H = VB_H;
    var X = function (v) { return PAD_L + ((v - xmin) / (xmax - xmin)) * (W - PAD_L - PAD_R); };
    var Y = function (v) { return H - PAD_B - ((v - ymin) / (ymax - ymin)) * (H - PAD_T - PAD_B); };

    var parts = [];
    parts.push("<svg class='sim-svg' viewBox='0 0 " + W + " " + H + "' role='img'>");
    // 背景与网格
    parts.push("<rect class='sim-bg' x='0' y='0' width='" + W + "' height='" + H + "'/>");
    var xt = niceTicks(xmin, xmax, 6), yt = niceTicks(ymin, ymax, 5);
    for (i = 0; i < yt.length; i++) {
      var yy = Y(yt[i]);
      if (yy < PAD_T - 2 || yy > H - PAD_B + 2) continue;
      parts.push("<line class='sim-grid' x1='" + PAD_L + "' y1='" + yy.toFixed(2) + "' x2='" + (W - PAD_R) + "' y2='" + yy.toFixed(2) + "'/>");
      parts.push("<text class='sim-tick' x='" + (PAD_L - 6) + "' y='" + (yy + 4).toFixed(2) + "' text-anchor='end'>" + fmt(yt[i], 3) + "</text>");
    }
    for (i = 0; i < xt.length; i++) {
      var xx = X(xt[i]);
      if (xx < PAD_L - 2 || xx > W - PAD_R + 2) continue;
      parts.push("<line class='sim-grid' x1='" + xx.toFixed(2) + "' y1='" + PAD_T + "' x2='" + xx.toFixed(2) + "' y2='" + (H - PAD_B) + "'/>");
      parts.push("<text class='sim-tick' x='" + xx.toFixed(2) + "' y='" + (H - PAD_B + 16) + "' text-anchor='middle'>" + fmt(xt[i], 3) + "</text>");
    }
    // 零点线
    var y0 = Y(0);
    if (y0 > PAD_T && y0 < H - PAD_B) {
      parts.push("<line class='sim-axis0' x1='" + PAD_L + "' y1='" + y0.toFixed(2) + "' x2='" + (W - PAD_R) + "' y2='" + y0.toFixed(2) + "'/>");
    }
    // 坐标轴
    parts.push("<line class='sim-axis' x1='" + PAD_L + "' y1='" + PAD_T + "' x2='" + PAD_L + "' y2='" + (H - PAD_B) + "'/>");
    parts.push("<line class='sim-axis' x1='" + PAD_L + "' y1='" + (H - PAD_B) + "' x2='" + (W - PAD_R) + "' y2='" + (H - PAD_B) + "'/>");
    // 曲线
    for (j = 0; j < series.length; j++) {
      s = series[j];
      var sxs = (s.x && s.x.length) ? s.x : x;      // 该曲线自己的横轴（无则共用）
      var pts = [];
      for (i = 0; i < sxs.length && i < s.y.length; i++) {
        var yv = s.y[i];
        if (typeof yv !== "number" || !isFinite(yv)) continue;
        pts.push(X(sxs[i]).toFixed(2) + "," + Y(yv).toFixed(2));
      }
      if (!pts.length) continue;
      parts.push("<polyline class='sim-line' points='" + pts.join(" ") + "' fill='none' stroke='" +
        (s.color || PALETTE[j % PALETTE.length]) + "'" + (s.dash ? " stroke-dasharray='" + s.dash + "'" : "") + "/>");
    }
    // 标记点
    (spec.markers || []).forEach(function (m) {
      if (m.x == null || m.y == null) return;
      parts.push("<circle class='sim-marker' cx='" + X(m.x).toFixed(2) + "' cy='" + Y(m.y).toFixed(2) + "' r='3.5'/>");
      if (m.label) parts.push("<text class='sim-tick' x='" + (X(m.x) + 6).toFixed(2) + "' y='" + (Y(m.y) - 6).toFixed(2) + "'>" + m.label + "</text>");
    });
    // 轴标签
    if (spec.xlabel) parts.push("<text class='sim-axlabel' x='" + ((PAD_L + W - PAD_R) / 2).toFixed(0) + "' y='" + (H - 6) + "' text-anchor='middle'>" + spec.xlabel + "</text>");
    if (spec.ylabel) parts.push("<text class='sim-axlabel' x='12' y='" + ((PAD_T + H - PAD_B) / 2).toFixed(0) + "' text-anchor='middle' transform='rotate(-90 12 " + ((PAD_T + H - PAD_B) / 2).toFixed(0) + ")'>" + spec.ylabel + "</text>");
    // 图例
    var lx = PAD_L + 6, ly = PAD_T + 10;
    for (j = 0; j < series.length; j++) {
      s = series[j];
      var col = s.color || PALETTE[j % PALETTE.length];
      parts.push("<line x1='" + lx + "' y1='" + ly + "' x2='" + (lx + 18) + "' y2='" + ly + "' stroke='" + col + "' stroke-width='2.4'" + (s.dash ? " stroke-dasharray='" + s.dash + "'" : "") + "/>");
      parts.push("<text class='sim-legend' x='" + (lx + 23) + "' y='" + (ly + 4) + "'>" + (s.label || "") + "</text>");
      lx += 26 + String(s.label || "").length * 7.2;
    }
    parts.push("</svg>");

    var host = el("div", "sim-chart");
    host.innerHTML = parts.join("");
    return host;
  }

  function barsHost(items) {
    var wrap = el("div", "sim-bars");
    var max = 0;
    items.forEach(function (b) { max = Math.max(max, Math.abs(b.value) || 0); });
    items.forEach(function (b) {
      var pct = max > 0 ? (Math.abs(b.value) / max) * 100 : 0;
      var row = el("div", "sim-bar");
      row.innerHTML = "<div class='k'>" + b.label + "</div>" +
        "<div class='track'><i style='width:" + pct.toFixed(1) + "%;background:" + (b.color || PALETTE[0]) + "'></i></div>" +
        "<div class='v'>" + fmt(b.value, 4) + (b.unit ? " " + b.unit : "") + "</div>";
      wrap.appendChild(row);
    });
    return wrap;
  }

  /**
   * 对比表：把一个参数依次取不同值，把每次的读数条并排放在一起。
   * 用于「没有随时间变化的曲线、只有读数条」的模型（例如碰撞：比较 e = 1 / 0.5 / 0 时的动能损失）。
   * 有主图曲线的模型不走这里——那种情况由主图叠加多条曲线来对比。
   */
  function compareHost(def, name, params, vary) {
    var wrap = el("div", "sim-compare");
    vary.forEach(function (v) {
      (v.values || []).forEach(function (val) {
        var p2 = paramsOf(name, params);
        p2[v.key] = val;
        var o2;
        try { o2 = def.compute(p2); } catch (e) { return; }
        if (!o2.bars || !o2.bars.length) return;
        var box = el("div", "sim-compare-row");
        box.appendChild(el("div", "sim-compare-hd", (v.label || v.key) + " = " + fmt(val, 4)));
        box.appendChild(barsHost(o2.bars));
        wrap.appendChild(box);
      });
    });
    return wrap;
  }

  /* ---------------------------------------------------------- 模型注册表 */
  var MODELS = {};

  function register(name, def) { MODELS[name] = def; }

  /** 合并默认参数：config 里给的值优先 */
  function paramsOf(name, given) {
    var def = MODELS[name];
    var out = {};
    if (!def) return out;
    Object.keys(def.params || {}).forEach(function (k) { out[k] = def.params[k].def; });
    Object.keys(given || {}).forEach(function (k) {
      if (typeof given[k] === "number") out[k] = given[k];
    });
    return out;
  }

  function run(name, given) {
    var def = MODELS[name];
    if (!def) throw new Error("未知模型：" + name);
    var p = paramsOf(name, given);
    return def.compute(p);
  }

  /** 供 verify-simlab.mjs 使用：跑一个模型的全部自检 */
  function runTests(name) {
    var def = MODELS[name];
    if (!def) return [{ name: "模型存在", ok: false, detail: "未注册" }];
    var out = [];
    (def.tests || []).forEach(function (t) {
      var res = { name: t.name, ok: false, detail: "" };
      try {
        var p = paramsOf(name, t.params || {});
        var got = def.compute(p);
        var measured = t.measure(got, p);
        if (typeof measured !== "number" || !isFinite(measured)) {
          res.detail = "measure 返回非有限数：" + measured;
        } else {
          res.measured = measured;
          res.expect = t.expect;
          res.tol = t.tol;
          res.ok = Math.abs(measured - (t.expect || 0)) <= (t.tol == null ? 1e-6 : t.tol);
          res.detail = "实测 " + fmt(measured, 8) + "，期望 " + fmt(t.expect, 8) + "，容差 ±" + fmt(t.tol, 8);
        }
      } catch (e) {
        res.detail = "抛出异常：" + String((e && e.message) || e);
      }
      out.push(res);
    });
    if (!(def.tests || []).length) out.push({ name: "声明了自检", ok: false, detail: "该模型没有 tests" });
    return out;
  }

  /* -------------------------------------------------------------- 渲染 */
  /**
   * block = { lab:"simlab", title, config:{ model, params, plots, vary, note, tasks } }
   * 渲染内容：参数滑块 + 主图 + 读数 + 能量条 + 可选第二图 + 可对比曲线
   */
  function renderSimlab(host, cfg) {
    host.innerHTML = "";
    var name = cfg.model;
    var def = MODELS[name];
    if (!def) {
      host.appendChild(el("div", "empty", "未知仿真模型：" + name + "（可用模型见 app/simlab-models-*.js）"));
      return;
    }
    var params = paramsOf(name, cfg.params);

    // --- 参数控件 ---
    var ctrls = el("div", "sim-ctrls");
    var readouts = {};
    Object.keys(def.params || {}).forEach(function (k) {
      var pd = def.params[k];
      var row = el("div", "sim-ctrl");
      row.appendChild(el("label", null, pd.label + (pd.unit ? "（" + pd.unit + "）" : "")));
      if (pd.type === "enum") {
        // 枚举型参数：值就是选项下标（0 开始）。用于"选哪一种映射 / 哪一种统计"这类分类型选择。
        var sel = el("select", "inp sim-select");
        (pd.options || []).forEach(function (opt, oi) {
          var o = el("option", null, opt);
          o.value = String(oi);
          sel.appendChild(o);
        });
        sel.value = String(params[k] | 0);
        sel.addEventListener("change", function () {
          params[k] = Number(sel.value);
          draw();
        });
        row.appendChild(sel);
        ctrls.appendChild(row);
        return;
      }
      var input = el("input");
      input.type = "range";
      input.min = pd.min != null ? pd.min : 0;
      input.max = pd.max != null ? pd.max : 1;
      input.step = pd.step != null ? pd.step : 0.1;
      input.value = params[k];
      var val = el("span", "sim-val", fmt(params[k], 4));
      input.addEventListener("input", function () {
        params[k] = Number(input.value);
        val.textContent = fmt(params[k], 4);
        draw();
      });
      row.appendChild(input);
      row.appendChild(val);
      ctrls.appendChild(row);
    });
    if (ctrls.children.length) host.appendChild(ctrls);

    // --- 输出区 ---
    var infoBar = el("div", "sim-info");
    var mainHost = el("div");
    var barHost = el("div");
    var varyHost = el("div");
    var extraHost = el("div");
    if (cfg.note || def.legend) {
      host.appendChild(el("div", "lab-note", "💡 " + (cfg.note || def.legend)));
    }
    host.appendChild(infoBar);
    host.appendChild(mainHost);
    host.appendChild(barHost);
    host.appendChild(varyHost);
    host.appendChild(extraHost);

    function draw() {
      var out;
      try {
        out = def.compute(params);
      } catch (e) {
        mainHost.innerHTML = "<div class='empty'>仿真失败：" + String((e && e.message) || e) + "</div>";
        return;
      }
      infoBar.innerHTML = "";
      (out.info || []).forEach(function (it) {
        infoBar.appendChild(el("div", "sim-readout", "<div class='k'>" + it.k + "</div><div class='v'>" + it.v + "</div>"));
      });

      // 主图
      var plots = (cfg.plots && cfg.plots.length ? cfg.plots : (def.plots || []).map(function (p) { return p.key; }));
      var series = [];
      plots.forEach(function (pk, i) {
        var decl = (def.plots || []).filter(function (p) { return p.key === pk; })[0] || { key: pk, label: pk };
        if (!out.series || !out.series[pk]) return;
        series.push({ label: decl.label || pk, y: out.series[pk], color: decl.color || PALETTE[i % PALETTE.length], dash: decl.dash });
      });

      // 可对比曲线（config.vary: [{key, values:[...]}] → 把该参数依次取不同值叠加）
      (cfg.vary || []).forEach(function (v) {
        (v.values || []).forEach(function (val, i) {
          var p2 = paramsOf(name, params);
          p2[v.key] = val;
          var o2;
          try { o2 = def.compute(p2); } catch (e) { return; }
          var decl = (def.plots || [])[0] || {};
          var key = (cfg.plots && cfg.plots.length ? cfg.plots[0] : decl.key);
          if (!o2.series || !o2.series[key]) return;
          // 只叠第一条曲线，避免图例爆炸
          series.push({
            label: (v.label || v.key) + "=" + fmt(val, 3),
            y: o2.series[key],
            color: PALETTE[(i + 3) % PALETTE.length],
            dash: "5 4"
          });
          void key;
        });
      });

      var mainSpec = {
        x: out.t, series: series,
        xlabel: (def.axes && def.axes.xlabel) || "t (s)",
        ylabel: (def.axes && def.axes.ylabel) || ""
      };
      mainHost.innerHTML = "";
      // 有些模型（例如碰撞）没有任何曲线，只有读数与能量条——那就不要画一张空图
      if (series.length) mainHost.appendChild(chart(mainSpec));

      // 能量条 / 读数条
      barHost.innerHTML = "";
      if (out.bars && out.bars.length) barHost.appendChild(barsHost(out.bars));

      // 没有主图曲线时，vary 改为生成"参数对比表"（并排的读数条）
      varyHost.innerHTML = "";
      if (!series.length && cfg.vary && cfg.vary.length) {
        varyHost.appendChild(el("div", "sim-subtitle", "参数对比（同一个模型，只改一个参数）"));
        varyHost.appendChild(compareHost(def, name, params, cfg.vary));
      }

      // 第二图（相图 / 谱线 / 分布 / 多条独立曲线）
      extraHost.innerHTML = "";
      if (out.extra && ((out.extra.x && out.extra.y) || (out.extra.lines && out.extra.lines.length))) {
        extraHost.appendChild(el("div", "sim-subtitle", out.extra.title || ""));
        var eSeries;
        if (out.extra.lines && out.extra.lines.length) {
          // 各条曲线自带横轴：电场线、能级图、谱线、多条轨迹
          eSeries = out.extra.lines.map(function (ln, i) {
            return {
              x: ln.x, y: ln.y,
              label: ln.label || "",
              color: ln.color || PALETTE[(i + 3) % PALETTE.length],
              dash: ln.dash
            };
          });
        } else {
          eSeries = [{ label: out.extra.legend || "", y: out.extra.y, color: PALETTE[3] }];
        }
        extraHost.appendChild(chart({
          x: out.extra.x || [],
          series: eSeries,
          markers: out.extra.markers || [],
          xlabel: out.extra.xlabel || "", ylabel: out.extra.ylabel || ""
        }));
      }

      // 高亮某个派生序列（有些模型把相图放在 series 里，用 extra 更清楚，这里保持简单）
      (out.series2 || []).forEach(function (spec2) { extraHost.appendChild(chart(spec2)); });
    }

    draw();
    void readouts;
  }

  /* -------------------------------------------------------------- 导出 */
  global.SIM = {
    register: register,
    models: MODELS,
    run: run,
    runTests: runTests,
    paramsOf: paramsOf,
    render: renderSimlab,
    chart: chart,
    rk4: rk4,
    linspace: linspace,
    fmt: fmt,
    clamp: clamp,
    opt: opt,
    palette: PALETTE,
    types: function () { return Object.keys(MODELS); }
  };
})(window);
