/* ==========================================================================
   app.js —— 路由 / 渲染 / 仪表盘 / 课时页 / 错题本 / 复习 / 搜索（零依赖）
   ========================================================================== */
(function (global) {
  "use strict";

  /* ------------------------------------------------------------ 数据装配 */
  var ORDER = [
    "llm-zero-basics", "python-basics-ai", "ml-dl-basics", "neural-networks",
    "tokenizer-vocab", "attention-transformer", "pretraining-inference",
    "frontier-models", "posttraining-alignment",
    // 研究侧四门（2026-10-25 专项补全）：全部归主线 A，排在 B 线之前
    "continual-learning", "self-evolution", "learning-algorithms",
    "next-gen-architecture", "world-model-generation",
    "prompt-engineering", "inference-api", "harness-anatomy",
    "agent-protocols-2026", "tool-calling", "rag", "finetuning-lora",
    "agent-core", "memory-architecture", "eval-harness", "agent-security",
    "project-rag", "project-cli-agent", "project-evals", "project-dsh-extension",
    "frontier-tracking", "frontier-radar"
  ];
  // 主线排序：让"学习路径"按三条主线展示（想调整顺序改这里即可）
  var TERM_ORDER = [
    "主线 A · LLM 基础与原理", "主线 B · 工程与 Harness", "主线 C · 实战与前沿追踪"
  ];
  function termRank(term) {
    var i = TERM_ORDER.indexOf(term);
    if (i >= 0) return i;
    var m = /^大([一二三四])([上下]?)/.exec(term || "");
    if (m) {
      var grade = { 一: 1, 二: 2, 三: 3, 四: 4 }[m[1]] || 5;
      return 100 + grade * 10 + (m[2] === "下" ? 1 : 0);
    }
    return 999; // 未识别的学期排在最后
  }
  var courses = (global.COURSE_PACKS || []).slice();
  courses.sort(function (a, b) {
    var ia = ORDER.indexOf(a.id), ib = ORDER.indexOf(b.id);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });

  var lessonIndex = {};   // lessonId -> { course, lesson, index }
  courses.forEach(function (c) {
    (c.lessons || []).forEach(function (l, i) {
      lessonIndex[l.id] = { course: c, lesson: l, index: i };
    });
  });

  /* --------------------------------------------------------------- 工具 */
  function $(sel) { return document.querySelector(sel); }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) { return MD.escapeHtml(s); }
  /**
   * 站内跳转：既改 hash（保证可收藏/可前进后退/可中键新开），
   * 也在 hash 没变时直接重绘——不把渲染完全押在浏览器的 hashchange 事件上。
   */
  function navigate(hash) {
    if (location.hash === hash) { render(); return; }
    location.hash = hash;
    var shown = location.hash;
    setTimeout(function () {
      // 兜底：若浏览器没有派发 hashchange（或被其它脚本吞掉），这里补一次渲染
      if (shown === location.hash) render();
    }, 0);
  }
  function toast(msg, kind) {
    var host = $("#toastHost");
    var t = el("div", "toast " + (kind || ""), esc(msg));
    host.appendChild(t);
    setTimeout(function () { t.style.opacity = "0"; t.style.transition = "opacity .3s"; }, 2200);
    setTimeout(function () { t.remove(); }, 2600);
  }
  function fmtTime(ts) {
    if (!ts) return "";
    var d = new Date(ts);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  /* --------------------------------------------------------------- 主题 */
  function applyTheme(t) {
    document.documentElement.dataset.theme = t === "light" ? "light" : "dark";
    PROGRESS.setPref("theme", t);
  }
  applyTheme(PROGRESS.getPref("theme") || "dark");

  /* ------------------------------------------------------------- 侧边栏 */
  function navRow(route, html, cls) {
    // 用 <a href="#/..."> 而不是 <div>：浏览器原生就会跟随 hash 变化，
    // 这样点击/中键新开/键盘 Enter 全部可用，不依赖 JS 事件是否绑定成功。
    var a = el("a", "nav-item" + (cls ? " " + cls : ""), html);
    a.setAttribute("href", route);
    a.dataset.route = route;
    return a;
  }

  function buildSidebar() {
    var nav = $("#nav");
    nav.innerHTML = "";
    nav.appendChild(navRow("#/", "<span class='ico'>🏠</span><span class='nm'>学习总览</span>"));
    nav.appendChild(navRow("#/path", "<span class='ico'>🧭</span><span class='nm'>培养方案路径</span>"));
    nav.appendChild(navRow("#/review", "<span class='ico'>🔁</span><span class='nm'>智能复习</span>"));
    nav.appendChild(navRow("#/notebook", "<span class='ico'>📕</span><span class='nm'>错题本</span><span class='pct' id='nbCount'></span>"));
    nav.appendChild(navRow("#/glossary", "<span class='ico'>📖</span><span class='nm'>术语表</span>"));
    nav.appendChild(navRow("#/roadmap", "<span class='ico'>🎯</span><span class='nm'>能力路线图</span>"));

    var terms = {};
    courses.forEach(function (c) { (terms[c.term] = terms[c.term] || []).push(c); });
    Object.keys(terms).sort(function (a, b) { return termRank(a) - termRank(b); }).forEach(function (term) {
      nav.appendChild(el("div", "nav-group", esc(term)));
      terms[term].forEach(function (c) {
        var st = PROGRESS.courseStat(c);
        nav.appendChild(navRow("#/c/" + c.id,
          "<span class='ico'>" + c.icon + "</span><span class='nm'>" + esc(c.title) + "</span><span class='pct'>" + st.pct + "%</span>"));
        if (location.hash.indexOf("#/c/" + c.id + "/") === 0 || location.hash === "#/c/" + c.id) {
          var sub = el("div", "nav-sub");
          (c.lessons || []).forEach(function (l, i) {
            var stt = PROGRESS.lessonState(l.id);
            sub.appendChild(navRow("#/c/" + c.id + "/" + l.id,
              "<span class='dot " + (stt === "done" ? "done" : stt === "read" ? "part" : "") + "'></span><span class='nm'>" + (i + 1) + ". " + esc(l.title) + "</span>"));
          });
          nav.appendChild(sub);
        }
      });
    });

    var g = PROGRESS.globalStat(courses);
    var ring = $("#ringFg");
    if (ring) ring.setAttribute("stroke-dashoffset", String(113 - (113 * g.pct) / 100));
    var rp = $("#ringPct");
    if (rp) rp.textContent = g.pct + "%";
    var nbc = $("#nbCount");
    if (nbc) nbc.textContent = g.mistakes ? "(" + g.mistakes + ")" : "";
  }

  /** 侧边栏点击：导航容器只绑定一次，重建内容也不会失效（事件委托） */
  function bindSidebarNav() {
    var nav = $("#nav");
    nav.addEventListener("click", function (e) {
      var row = e.target.closest(".nav-item");
      if (!row || !nav.contains(row)) return;
      var route = row.dataset.route;
      if (!route) return;
      e.preventDefault();                 // 交给我们自己处理，避免重复渲染
      navigate(route);
      $("#sidebar").classList.remove("open");
    });
  }

  function markActiveNav() {
    var h = location.hash || "#/";
    Array.prototype.forEach.call(document.querySelectorAll(".nav-item"), function (n) {
      n.classList.toggle("active", n.dataset.route === h);
    });
  }

  /* ------------------------------------------------------------ 面包屑 */
  function setCrumbs(items) {
    var c = $("#crumbs");
    c.innerHTML = "";
    items.forEach(function (it, i) {
      if (i) c.appendChild(el("span", null, "›"));
      if (it.route) {
        var a = el("a", null, esc(it.text));
        a.href = it.route;
        c.appendChild(a);
      } else c.appendChild(el("b", null, esc(it.text)));
    });
  }

  /* ==================================================== 术语联动（正文可点查词） */
  /**
   * 把渲染后的 HTML 正文中的术语包装成可点标记：
   *   <span class="term-link" data-term="进程" title="解释…">进程</span>
   * 点击后弹出术语表里的完整解释（含出处）。
   * 安全措施：跳过 <code>/<pre>/<a>/<span class="term-link"> 内部，避免破坏代码与重复标记。
   */
  var TERM_MAP = null;
  function buildTermMap() {
    var map = {};
    if (!global.GLOSSARY || !global.GLOSSARY.cats) return map;
    global.GLOSSARY.cats.forEach(function (cat) {
      (cat.items || []).forEach(function (it) {
        // 取术语的中文主名（去掉括号里的英文），长度 ≥ 2 才参与联动
        var name = String(it.t || "").replace(/[（(].*$/, "").trim();
        if (name.length >= 2 && !map[name]) map[name] = it;
        // 同时登记英文全称
        if (it.en && String(it.en).length >= 3 && !map[it.en]) map[it.en] = it;
      });
    });
    return map;
  }

  function linkTermsInHtml(html) {
    if (!html || html.indexOf("term-link") >= 0) return html;
    if (!TERM_MAP) TERM_MAP = buildTermMap();
    var names = Object.keys(TERM_MAP);
    if (!names.length) return html;
    // 长子串优先，避免「进程」抢了「进程间通信」
    names.sort(function (a, b) { return b.length - a.length; });
    var escaped = names.map(function (n) {
      return n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    });
    var pattern = new RegExp("(" + escaped.join("|") + ")", "g");

    var out = "";
    var i = 0;
    var skipTags = ["CODE", "PRE", "A", "H1", "H2", "H3", "H4", "BUTTON"];
    var depth = 0;
    while (i < html.length) {
      var c = html[i];
      if (c === "<") {
        var close = html.indexOf(">", i);
        if (close < 0) { out += html.slice(i); break; }
        var tagText = html.slice(i, close + 1);
        out += tagText;
        var m = /^<(\/?)([A-Za-z0-9]+)/.exec(tagText);
        if (m) {
          var isSkip = skipTags.indexOf(m[2].toUpperCase()) >= 0;
          if (!m[1] && !/\/>$/.test(tagText) && isSkip) depth++;
          else if (m[1] && isSkip) depth = Math.max(0, depth - 1);
        }
        i = close + 1;
        continue;
      }
      if (depth > 0) { out += c; i++; continue; }
      pattern.lastIndex = 0;
      var rest = html.slice(i);
      var hit = pattern.exec(rest);
      if (hit && hit.index === 0) {
        var it = TERM_MAP[hit[0]];
        out += '<span class="term-link" data-term="' + esc(hit[0]) + '" title="' + esc(String(it.d || "").slice(0, 120)) + '">' + esc(hit[0]) + "</span>";
        i += hit[0].length;
        continue;
      }
      out += c;
      i++;
    }
    return out;
  }

  /** 点击术语 → 弹出完整解释（含出处） */
  function bindTermLinks(host) {
    host.addEventListener("click", function (e) {
      var el2 = e.target.closest ? e.target.closest(".term-link") : null;
      if (!el2) return;
      var term = el2.dataset.term;
      if (!TERM_MAP) TERM_MAP = buildTermMap();
      var it = TERM_MAP[term];
      var dlg = el("dialog", "modal");
      dlg.innerHTML = "<h3>" + esc(term) + (it && it.en ? " <span class='chip'>" + esc(it.en) + "</span>" : "") + "</h3>" +
        "<div class='md'>" + MD.md(it ? it.d : "（术语表里没有这条，去看「📖 术语表」页搜索）") + "</div>" +
        (it && it.where ? "<div class='note-line'>→ 出现在：" + esc(it.where) + "</div>" : "") +
        "<div class='review-bar' style='margin-top:10px'><button class='btn sm primary' id='termOk'>知道了</button>" +
        "<button class='btn sm ghost' id='termAll'>打开完整术语表</button></div>";
      document.body.appendChild(dlg);
      dlg.querySelector("#termOk").addEventListener("click", function () { dlg.close(); });
      dlg.querySelector("#termAll").addEventListener("click", function () { dlg.close(); navigate("#/glossary"); });
      dlg.addEventListener("close", function () { dlg.remove(); });
      if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
    });
  }

  /* ============================================================ 页面：总览 */
  function pageHome() {
    var c = $("#content");
    c.innerHTML = "";
    var g = PROGRESS.globalStat(courses);
    var wrap = el("div", "wrap");

    wrap.appendChild(el("h1", "page-title", "LLM · Harness · Agent 学习总览"));
    wrap.appendChild(el("p", "lead",
      "共 " + courses.length + " 门课、" + g.lessons + " 讲，含 " +
      courses.reduce(function (n, x) { return n + (x.lessons || []).reduce(function (m, l) { return m + (l.blocks || []).filter(function (b) { return b.type === "interactive"; }).length; }, 0); }, 0) +
      " 个可点运行的交互实验与 " + g.quiz + " 道随堂测验题。所有进度与错题存在浏览器本地（localStorage），不联网。"));

    var stats = el("div", "stat-grid");
    function stat(n, l) { stats.appendChild(el("div", "stat", "<div class='n'>" + n + "</div><div class='l'>" + l + "</div>")); }
    stat(g.pct + "%", "整体完成度（" + g.done + "/" + g.lessons + " 讲已掌握）");
    stat(g.attempted ? g.accuracy + "%" : "—", "测验正确率（作答 " + g.attempted + " 题）");
    stat(String(g.mistakes), "待复习错题");
    stat(String(g.read), "已开始学习的讲数");
    stat(String(Math.round((PROGRESS.state().stats.minutes || 0) / 60) || 0) + "h", "累计学习时长（估算）");
    wrap.appendChild(stats);

    // 继续学习 / 复习入口（无论是否已有历史都给出一条清晰的主路径）
    var bar = el("div", "review-bar");
    var last = PROGRESS.getPref("lastLesson");
    if (last && lessonIndex[last]) {
      var info = lessonIndex[last];
      var b = el("button", "btn primary", "▶ 继续学习：" + info.lesson.title);
      b.addEventListener("click", function () { navigate("#/c/" + info.course.id + "/" + info.lesson.id); });
      bar.appendChild(b);
    } else {
      var first = courses.filter(function (c) { return (c.lessons || []).length; })[0];
      if (first) {
        var b0 = el("button", "btn primary", "▶ 从第一讲开始：" + first.lessons[0].title);
        b0.addEventListener("click", function () { navigate("#/c/" + first.id + "/" + first.lessons[0].id); });
        bar.appendChild(b0);
      }
      var bp = el("button", "btn ghost", "🧭 看培养方案路径");
      bp.addEventListener("click", function () { navigate("#/path"); });
      bar.appendChild(bp);
    }
    var weak = PROGRESS.weakLessons(courses, 1)[0];
    if (weak) {
      var b2 = el("button", "btn", "🎯 攻克最弱一讲：" + weak.lesson.title);
      b2.addEventListener("click", function () { navigate("#/c/" + weak.course.id + "/" + weak.lesson.id); });
      bar.appendChild(b2);
    }
    var b3 = el("button", "btn ghost", "🔁 随机复习");
    b3.addEventListener("click", function () { navigate("#/review"); });
    bar.appendChild(b3);
    wrap.appendChild(bar);

    // 零基础引导
    var starter = el("div", "block concept starter-banner");
    starter.innerHTML = "<h3>🌱 完全零基础？按这个顺序开始 <span class='tag'>推荐路线</span></h3>" +
      MD.md("1. 先打开左侧 **📖 术语表**，把「零基础」那一类（十几条）过一遍——遇到不认识的词随时回来查。\n" +
        "2. 再学 **【" + "零基础入门：电脑与第一个程序" + "】**，它会带你认识电脑与文件、打开终端、装好环境、跑出第一个程序（数学版则是符号、逻辑与证明的入门）。\n" +
        "3. 然后按「培养方案路径」从大一上的课依次往后学；每门课页面顶部都会写明 **学它之前需要会什么**。\n" +
        "> 遇到看不懂的课，不要硬撑：先确认它的前置课学过没有——前置提示会直接告诉你。") +
      "<div class='review-bar'><button class='btn primary' id='goStarter'>▶ 现在开始第 0 课</button>" +
      "<button class='btn ghost' id='goGlossary'>📖 先看术语表</button></div>";
    wrap.appendChild(starter);
    setTimeout(function () {
      var b1 = document.getElementById("goStarter");
      if (b1) b1.addEventListener("click", function () { navigate("#/c/cs-zero-basics"); });
      var b2 = document.getElementById("goGlossary");
      if (b2) b2.addEventListener("click", function () { navigate("#/glossary"); });
    }, 0);
    wrap.appendChild(el("h2", "sec", "课程地图"));
    var grid = el("div", "grid");
    courses.forEach(function (co) {
      var st = PROGRESS.courseStat(co);
      var card = el("div", "card");
      card.innerHTML =
        "<div class='hd'><span class='ico'>" + co.icon + "</span><h3>" + esc(co.title) + "</h3></div>" +
        "<div class='blurb'>" + esc(co.blurb) + "</div>" +
        "<div class='bar'><i style='width:" + st.pct + "%'></i></div>" +
        "<div class='meta'><span class='chip'>" + esc(co.term) + "</span><span class='chip'>" + st.total + " 讲</span>" +
        "<span class='chip'>" + (st.quizTotal) + " 题</span>" +
        (st.attempted ? "<span class='chip ok'>正确率 " + st.accuracy + "%</span>" : "<span class='chip'>未测</span>") +
        "<span>" + st.pct + "%</span></div>";
      card.addEventListener("click", function () { navigate("#/c/" + co.id); });
      grid.appendChild(card);
    });
    wrap.appendChild(grid);

    wrap.appendChild(el("h2", "sec", "怎么用这个学习站"));
    var how = el("div", "block concept");
    how.innerHTML = "<h3>四步学习法 <span class='tag'>建议流程</span></h3>" + MD.md([
      "1. **先看「为什么」**：每讲开头的核心讲解会说明这个知识解决什么问题、不用它会怎样；跳过它会变成背名词。",
      "2. **动手跑实验**：带 `交互实验` 标签的块可以直接单步运行（路径搜索、调度甘特图、CPU 指令执行、页面置换、位模式、算法单步）。先猜结果，再点运行。",
      "3. **做随堂测验并读解析**：答错的题会自动进入错题本，解析里会说明干扰项错在哪——这是最省时间的提分方式。",
      "4. **每周点一次「🔁 复习」**：系统按错题与正确率挑出最薄弱的课，随机抽题重做。",
      "",
      "> 提示：按 `/` 可以快速搜索所有课程与知识点；`Ctrl/⌘ + Enter` 标记当前讲已掌握。学习数据可用右上角「💾 数据」导出备份。"
    ].join("\n"));
    wrap.appendChild(how);

    c.appendChild(wrap);
  }

  /* ======================================================== 页面：培养方案路径 */
  function pagePath() {
    var c = $("#content");
    c.innerHTML = "";
    var wrap = el("div", "wrap");
    wrap.appendChild(el("h1", "page-title", "学习路径"));
    wrap.appendChild(el("p", "lead", "按三条主线排列：A · LLM 基础与原理（零基础 → Transformer → 2026 前沿）→ B · 工程与 Harness（提示词 / API / 工具 / RAG / 微调 / Agent / 评测）→ C · 实战与前沿追踪（四个完整项目 + 跟踪前沿的方法论）。每门课都能点进去按讲学习；倒着学必修会卡住，跨主线先深挖感兴趣的、回头补前置则完全允许。"));

    var terms = {};
    courses.forEach(function (co) { (terms[co.term] = terms[co.term] || []).push(co); });
    Object.keys(terms).sort(function (a, b) { return termRank(a) - termRank(b); }).forEach(function (term) {
      var blk = el("div", "term-block");
      var head = el("div", "term-head");
      head.appendChild(el("span", "t", esc(term)));
      head.appendChild(el("span", "line"));
      var hours = terms[term].reduce(function (n, x) { return n + (x.hours || 0); }, 0);
      head.appendChild(el("span", "chip", hours + " 学时"));
      blk.appendChild(head);
      var grid = el("div", "grid");
      terms[term].forEach(function (co) {
        var st = PROGRESS.courseStat(co);
        var card = el("div", "card");
        card.innerHTML = "<div class='hd'><span class='ico'>" + co.icon + "</span><h3>" + esc(co.title) + "</h3></div>" +
          "<div class='blurb'>" + esc(co.blurb) + "</div>" +
          "<div class='meta'>" + (co.tags || []).map(function (t) { return "<span class='chip'>" + esc(t) + "</span>"; }).join("") +
          "<span class='chip accent'>" + st.total + " 讲</span><span class='chip'>" + st.pct + "%</span></div>";
        card.addEventListener("click", function () { navigate("#/c/" + co.id); });
        grid.appendChild(card);
      });
      blk.appendChild(grid);
      wrap.appendChild(blk);
    });
    c.appendChild(wrap);
  }

  /* ============================================================ 页面：课程 */
  function pageCourse(id) {
    var co = courses.filter(function (x) { return x.id === id; })[0];
    var c = $("#content");
    c.innerHTML = "";
    if (!co) { c.appendChild(el("div", "empty", "找不到课程：" + esc(id))); return; }
    var st = PROGRESS.courseStat(co);
    setCrumbs([{ text: "总览", route: "#/" }, { text: co.title }]);

    var wrap = el("div", "wrap");
    wrap.appendChild(el("h1", "page-title", co.icon + " " + esc(co.title)));
    wrap.appendChild(el("p", "lead", esc(co.blurb)));
    if (co.need) {
      var needBox = el("div", "block concept pre-need");
      needBox.innerHTML = "<h3>🎒 学这门课之前 <span class='tag'>前置知识</span></h3><div class='md'>" + MD.md(co.need) +
        "</div><div class='note-line'>不确定自己的基础够不够？打开 <a href='#/glossary'>📖 术语表</a> 快速过一遍相关术语。</div>";
      wrap.appendChild(needBox);
    }
    var meta = el("div", "review-bar");
    meta.appendChild(el("span", "chip accent", esc(co.term)));
    meta.appendChild(el("span", "chip", (co.hours || 0) + " 学时建议"));
    meta.appendChild(el("span", "chip", st.total + " 讲"));
    meta.appendChild(el("span", "chip", st.quizTotal + " 道测验题"));
    (co.tags || []).forEach(function (t) { meta.appendChild(el("span", "chip", esc(t))); });
    if (st.attempted) meta.appendChild(el("span", "chip ok", "正确率 " + st.accuracy + "%（" + st.correct + "/" + st.attempted + "）"));
    wrap.appendChild(meta);

    var bar = el("div", "bar");
    bar.innerHTML = "<i style='width:" + st.pct + "%'></i>";
    wrap.appendChild(bar);
    wrap.appendChild(el("div", "note-line", "完成度 " + st.pct + "% ｜ 已开始 " + st.read + " 讲 ｜ 已掌握 " + st.done + " 讲"));

    wrap.appendChild(el("h2", "sec", "课程目录"));
    var list = el("div");
    (co.lessons || []).forEach(function (l, i) {
      var state = PROGRESS.lessonState(l.id);
      var rec = el("div", "lesson-row" + (state === "done" ? " done" : ""));
      var blocks = l.blocks || [];
      var labN = blocks.filter(function (b) { return b.type === "interactive"; }).length;
      var hasCode = blocks.some(function (b) { return b.type === "code"; });
      rec.innerHTML = "<div class='idx'>" + (state === "done" ? "✓" : (i + 1)) + "</div>" +
        "<div class='info'><div class='t'>" + esc(l.title) + "</div><div class='g'>" + esc(l.goal || "") + "</div>" +
        "<div class='meta' style='margin-top:4px'>" +
        "<span class='chip'>" + (l.est || 30) + " 分钟</span>" +
        "<span class='chip'>" + (l.quiz || []).length + " 题</span>" +
        (labN ? "<span class='chip accent'>" + labN + " 个交互实验</span>" : "") +
        (hasCode ? "<span class='chip'>含代码</span>" : "") +
        (state === "read" ? "<span class='chip warn'>进行中</span>" : "") +
        "</div></div><div class='est'>" + (state === "done" ? "已掌握" : state === "read" ? "继续" : "未开始") + " ›</div>";
      rec.addEventListener("click", function () { navigate("#/c/" + co.id + "/" + l.id); });
      list.appendChild(rec);
    });
    wrap.appendChild(list);
    c.appendChild(wrap);
  }

  /* ============================================================ 页面：一讲 */
  function renderBlock(b, ctx) {
    var type = b.type;
    var cls = "block " + type;
    var box = el("div", cls);
    var tagMap = {
      concept: "核心讲解", steps: "步骤", analogy: "类比", code: "代码",
      pitfall: "易错点", calc: "手算演练", interactive: "交互实验", lab: "动手实验"
    };

    if (type === "interactive") {
      box.appendChild(el("h3", null, "🧪 " + MD.mathText(b.title || "交互实验") + " <span class='tag'>" + esc(tagMap[type]) + "</span>"));
      if (b.config && b.config.legend) { /* legend 由 lab 自己渲染 */ }
      var host = el("div");
      box.appendChild(host);
      // 任务清单
      if (b.config && b.config.tasks && b.config.tasks.length) {
        var tl = el("div", "block steps");
        tl.style.margin = "14px 0 0";
        tl.appendChild(el("h3", null, "✅ 动手任务"));
        var ul = el("ol", "steps-list");
        b.config.tasks.forEach(function (t) {
          var txt = typeof t === "string" ? t : (t.t || "");
          var hint = typeof t === "object" && t.hint ? "<div class='note-line'>提示：" + MD.mathText(t.hint) + "</div>" : "";
          var check = typeof t === "object" && t.check ? "<div class='note-line'>达成标准：" + MD.mathText(t.check) + "</div>" : "";
          ul.appendChild(el("li", null, "<b>" + MD.md(txt) + "</b>" + hint + check));
        });
        tl.appendChild(ul);
        box.appendChild(tl);
      }
      requestAnimationFrame(function () {
        try { LABS.render(host, b, ctx); }
        catch (e) { host.innerHTML = "<div class='empty'>实验渲染失败：" + esc(String(e && e.message || e)) + "</div>"; }
      });
      return box;
    }

    box.appendChild(el("h3", null, MD.mathText(b.title || tagMap[type] || type) + (tagMap[type] ? " <span class='tag'>" + tagMap[type] + "</span>" : "")));

    if (type === "concept" || type === "analogy") {
      box.appendChild(el("div", "md", linkTermsInHtml(MD.md(b.md || ""))));
    } else if (type === "steps") {
      var ol = el("ol", "steps-list");
      (b.items || []).forEach(function (it) {
        if (typeof it === "string") ol.appendChild(el("li", null, MD.md(it)));
        else ol.appendChild(el("li", null, "<b>" + MD.md(it.t || "") + "</b>" + (it.d ? "<div class='md'>" + MD.md(it.d) + "</div>" : "")));
      });
      box.appendChild(ol);
      if (b.note) box.appendChild(el("div", "lab-note", MD.mathText(b.note)));
    } else if (type === "pitfall") {
      var ul2 = el("ul");
      (b.items || []).forEach(function (it) { ul2.appendChild(el("li", null, MD.md(typeof it === "string" ? it : (it.t + "：" + (it.d || ""))))); });
      box.appendChild(ul2);
      if (b.note) box.appendChild(el("div", "lab-note", MD.mathText(b.note)));
    } else if (type === "lab") {
      var ol3 = el("ol", "steps-list");
      (b.steps || []).forEach(function (s) { ol3.appendChild(el("li", null, MD.md(typeof s === "string" ? s : (s.t || "") + (s.d ? "：" + s.d : "")))); });
      box.appendChild(ol3);
      if (b.note) box.appendChild(el("div", "lab-note", MD.mathText(b.note)));
    } else if (type === "code") {
      var hd = el("div", "code-hd");
      hd.appendChild(el("span", "lang", esc(b.lang || "text") + (b.title ? " · 代码示例" : "")));
      var bCopy = el("button", "btn sm ghost", "复制");
      bCopy.addEventListener("click", function () {
        if (navigator.clipboard) navigator.clipboard.writeText(b.code || "").then(function () { toast("已复制代码", "ok"); });
        else toast("当前环境不支持剪贴板", "bad");
      });
      hd.appendChild(bCopy);
      box.appendChild(hd);
      var pre = el("pre", "code");
      pre.innerHTML = "<code>" + MD.highlight(b.code || "", b.lang) + "</code>";
      box.appendChild(pre);
    } else if (type === "calc") {
      var g = el("div", "calc-grid");
      (b.inputs || []).forEach(function (it) {
        g.appendChild(el("div", "calc-item", "<div class='k'>" + MD.mathText(it.name) + "</div><div class='v'>" + MD.mathText(it.value) + "</div>"));
      });
      box.appendChild(el("div", "note-line", "已知条件"));
      box.appendChild(g);
      var out = el("div", "calc-out hidden");
      out.appendChild(el("div", "note-line", "参考答案（先自己算一遍再看）"));
      var og = el("div", "calc-grid");
      (b.outputs || []).forEach(function (o, i) {
        og.appendChild(el("div", "calc-item", "<div class='k'>结果 " + (i + 1) + "</div><div class='v'>" + MD.mathText(o) + "</div>"));
      });
      out.appendChild(og);
      var bReveal = el("button", "btn sm", "👁 显示答案");
      bReveal.addEventListener("click", function () {
        var hidden = out.classList.toggle("hidden");
        bReveal.textContent = hidden ? "👁 显示答案" : "🙈 隐藏答案";
      });
      box.appendChild(bReveal);
      box.appendChild(out);
      if (b.note) box.appendChild(el("div", "lab-note", MD.mathText(b.note)));
    }
    return box;
  }

  function pageLesson(courseId, lessonId) {
    var co = courses.filter(function (x) { return x.id === courseId; })[0];
    var c = $("#content");
    c.innerHTML = "";
    if (!co) { c.appendChild(el("div", "empty", "找不到课程")); return; }
    var idx = (co.lessons || []).findIndex(function (l) { return l.id === lessonId; });
    if (idx < 0) { c.appendChild(el("div", "empty", "找不到该讲")); return; }
    var lesson = co.lessons[idx];
    PROGRESS.markVisit(lesson.id);
    PROGRESS.setPref("lastLesson", lesson.id);
    var startTs = Date.now();

    setCrumbs([{ text: "总览", route: "#/" }, { text: co.title, route: "#/c/" + co.id }, { text: lesson.title }]);

    var wrap = el("div", "wrap");
    var state = PROGRESS.lessonState(lesson.id);
    wrap.appendChild(el("h1", "page-title", (idx + 1) + ". " + esc(lesson.title)));
    var meta = el("div", "review-bar");
    meta.appendChild(el("span", "chip accent", "第 " + (idx + 1) + " / " + co.lessons.length + " 讲"));
    meta.appendChild(el("span", "chip", "预计 " + (lesson.est || 30) + " 分钟"));
    meta.appendChild(el("span", "chip", (lesson.quiz || []).length + " 道测验题"));
    var qstat = PROGRESS.state().quiz[lesson.id];
    if (qstat) meta.appendChild(el("span", "chip ok", "历史正确率 " + Math.round((qstat.correct / qstat.attempted) * 100) + "%"));
    if (state === "done") meta.appendChild(el("span", "chip ok", "已标记掌握"));
    wrap.appendChild(meta);

    if (lesson.goal) {
      var goal = el("div", "block concept");
      goal.innerHTML = "<h3>🎯 学习目标 <span class='tag'>学完你能做到</span></h3><div class='md'>" + MD.md(lesson.goal) + "</div>";
      wrap.appendChild(goal);
    }

    var ctx = { onInteract: function () { } };
    (lesson.blocks || []).forEach(function (b) { wrap.appendChild(renderBlock(b, ctx)); });

    // 本讲自检清单（自动合成：优先用交互实验里的动手任务，再补通用自检项）
    function buildChecklist(lesson) {
      var out = [];
      (lesson.blocks || []).forEach(function (b) {
        if (b.type === "interactive" && b.config && b.config.tasks) {
          b.config.tasks.forEach(function (t) {
            out.push("完成交互实验「" + (b.title || "") + "」中的任务：" + (typeof t === "string" ? t : (t.t || "")) + (typeof t === "object" && t.check ? "（达成标准：" + t.check + "）" : ""));
          });
        }
        if (b.type === "lab") {
          (b.steps || []).forEach(function (s, i) {
            if (i < 3) out.push("动手完成「" + (b.title || "实验") + "」第 " + (i + 1) + " 步：" + (typeof s === "string" ? s : (s.t || "")));
          });
        }
      });
      out.push("我能用自己的话复述本讲的「学习目标」，不看原文");
      out.push("本讲「易错点」里的每一条，我都能说出它错在哪");
      out.push("测验题我都做对了一遍（做错的已经从错题本里复习过）");
      return out.slice(0, 6);
    }
    var checkHost = el("div");
    wrap.appendChild(checkHost);
    QUIZ.renderChecklist(checkHost, { checklist: buildChecklist(lesson) }, {
      getState: function () {
        var st = PROGRESS.state();
        st.checks = st.checks || {};
        return st.checks[lesson.id] || {};
      },
      onToggle: function (i, val) {
        var st = PROGRESS.state();
        st.checks = st.checks || {};
        st.checks[lesson.id] = st.checks[lesson.id] || {};
        st.checks[lesson.id][i] = val;
        PROGRESS.save();
      }
    });

    // 测验
    var quizHost = el("div");
    wrap.appendChild(quizHost);
    QUIZ.render(quizHost, lesson.quiz || [], {
      scope: lesson.id,
      onAnswered: function (q, ok, picked) {
        PROGRESS.recordQuiz(lesson.id, co.id, q, ok, picked);
        PROGRESS.addMinutes(1);
        buildSidebar();
        markActiveNav();
        if (!ok) toast("已记入错题本：" + (q.id || ""), "bad");
      },
      onGraded: function (r) {
        if (r.total && r.graded === r.total && r.correct === r.total) {
          PROGRESS.markDone(lesson.id, true);
          buildSidebar(); markActiveNav();
          toast("全部答对，本讲已标记掌握 ✓", "ok");
        }
      }
    });

    // 底部操作
    var foot = el("div", "lesson-foot");
    var bDone = el("button", "btn " + (state === "done" ? "ok" : "primary"), state === "done" ? "✓ 已掌握（点击取消）" : "标记本讲已掌握");
    bDone.addEventListener("click", function () {
      var now = PROGRESS.isDone(lesson.id);
      PROGRESS.markDone(lesson.id, !now);
      buildSidebar(); markActiveNav();
      bDone.className = "btn " + (!now ? "ok" : "primary");
      bDone.textContent = !now ? "✓ 已掌握（点击取消）" : "标记本讲已掌握";
      toast(!now ? "已标记掌握" : "已取消掌握标记", !now ? "ok" : "");
    });
    foot.appendChild(bDone);

    if (idx > 0) {
      var bp = el("button", "btn ghost", "‹ 上一讲：" + co.lessons[idx - 1].title);
      bp.addEventListener("click", function () { navigate("#/c/" + co.id + "/" + co.lessons[idx - 1].id); });
      foot.appendChild(bp);
    }
    if (idx < co.lessons.length - 1) {
      var bn = el("button", "btn", "下一讲：" + co.lessons[idx + 1].title + " ›");
      bn.addEventListener("click", function () { navigate("#/c/" + co.id + "/" + co.lessons[idx + 1].id); });
      foot.appendChild(bn);
    }
    var bto = el("button", "btn ghost", "🗺 回课程目录");
    bto.addEventListener("click", function () { navigate("#/c/" + co.id); });
    foot.appendChild(bto);
    wrap.appendChild(foot);
    wrap.appendChild(el("div", "note-line", "快捷键：<span class='kbd'>Ctrl</span>+<span class='kbd'>Enter</span> 标记掌握 ｜ <span class='kbd'>/</span> 搜索 ｜ <span class='kbd'>Alt</span>+<span class='kbd'>←</span>/<span class='kbd'>→</span> 上一讲 / 下一讲"));

    c.appendChild(wrap);

    // 记录学习时长（离开页面时结算）
    var settled = false;
    function settle() {
      if (settled) return;
      settled = true;
      var mins = Math.max(0, Math.round((Date.now() - startTs) / 60000));
      if (mins > 0) PROGRESS.addMinutes(mins);
    }
    global.addEventListener("hashchange", settle, { once: true });
    global.addEventListener("beforeunload", settle, { once: true });

    $("#content").scrollTop = 0;
  }

/* ========================================================== 页面：术语表 */
  function pageGlossary() {
    var c = $("#content");
    c.innerHTML = "";
    setCrumbs([{ text: "总览", route: "#/" }, { text: "术语表" }]);
    var wrap = el("div", "wrap");
    wrap.appendChild(el("h1", "page-title", "📖 术语表"));
    var total = (global.GLOSSARY && global.GLOSSARY.count) ? global.GLOSSARY.count() : 0;
    wrap.appendChild(el("p", "lead",
      "共 " + total + " 条常用术语。零基础建议先看第一类「计算机入门」，遇到不认识的词随时回到这里查。" +
      "每条都给了大白话解释与它出现在哪一讲，看完可以直接跳过去学。"));

    var bar = el("div", "review-bar");
    var input = el("input", "fill-in");
    input.placeholder = "搜索术语（如 进程、缓存、哈希、极限）…";
    input.style.maxWidth = "360px";
    bar.appendChild(input);
    var cnt = el("div", "lab-stat", "");
    bar.appendChild(cnt);
    wrap.appendChild(bar);

    var listHost = el("div");
    wrap.appendChild(listHost);

    function draw(kw) {
      listHost.innerHTML = "";
      var cats = (global.GLOSSARY && global.GLOSSARY.cats) || [];
      var q = (kw || "").trim().toLowerCase();
      var shown = 0;
      cats.forEach(function (cat) {
        var items = cat.items.filter(function (it) {
          if (!q) return true;
          return (it.t + " " + (it.en || "") + " " + it.d).toLowerCase().indexOf(q) >= 0;
        });
        if (!items.length) return;
        var box = el("div", "block concept");
        box.style.marginTop = "14px";
        box.appendChild(el("h3", null, esc(cat.cat) + " <span class='tag'>" + items.length + " 条</span>"));
        var dl = el("div");
        items.forEach(function (it) {
          shown++;
          var row = el("div");
          row.style.padding = "8px 0";
          row.style.borderTop = "1px dashed var(--line)";
          row.innerHTML = "<div><b>" + esc(it.t) + "</b>" +
            (it.en ? " <span class='chip'>" + esc(it.en) + "</span>" : "") + "</div>" +
            "<div class='md' style='margin-top:4px'>" + MD.md(it.d) + "</div>" +
            (it.where ? "<div class='note-line'>→ 出现在：" + esc(it.where) + "</div>" : "");
          dl.appendChild(row);
        });
        box.appendChild(dl);
        listHost.appendChild(box);
      });
      if (!shown) listHost.appendChild(el("div", "empty", "没有匹配的术语。换个关键词试试，比如「内存」「树」「概率」。"));
      cnt.textContent = q ? ("匹配 " + shown + " 条") : (total + " 条术语");
    }
    input.addEventListener("input", function (e) { draw(e.target.value); });
    draw("");
    c.appendChild(wrap);
  }

  /* ========================================================== 页面：能力路线图 */
  /**
   * 聚合每门课的 advanced 进阶包（教材 / 招牌 lab / 从零实现 / 验收判据），按领域分组。
   * 设计原则：不设时间节点，只用「顺序 + 前置 + 验收判据」标定掌握程度。
   */
  /**
   * ★ 这份分组必须只包含本站真实课程 id。曾经这里写的是 cs 站/数学站的 47 个 id，
   * 在本站一个都不存在，导致整页只剩三段硬编码文字、课程卡片全部渲染不出来。
   * tools/_check_roadmap.mjs 会校验「全覆盖、无多余」，改这里之后要跑它。
   */
  var ROADMAP_AREAS = [
    { name: "零基础与编程地基", ids: ["llm-zero-basics", "python-basics-ai"] },
    { name: "深度学习原理", ids: ["ml-dl-basics", "neural-networks", "tokenizer-vocab", "attention-transformer"] },
    { name: "预训练与前沿架构", ids: ["pretraining-inference", "frontier-models", "next-gen-architecture", "world-model-generation"] },
    { name: "后训练与研究侧方法", ids: ["posttraining-alignment", "continual-learning", "self-evolution", "learning-algorithms"] },
    { name: "接口与 Harness 骨架", ids: ["prompt-engineering", "inference-api", "harness-anatomy", "agent-protocols-2026"] },
    { name: "工具、检索与微调", ids: ["tool-calling", "rag", "finetuning-lora"] },
    { name: "Agent、评测与安全", ids: ["agent-core", "memory-architecture", "eval-harness", "agent-security"] },
    { name: "实战项目", ids: ["project-rag", "project-cli-agent", "project-evals", "project-dsh-extension"] },
    { name: "前沿追踪", ids: ["frontier-tracking", "frontier-radar"] }
  ];

  function pageRoadmap() {
    var c = $("#content");
    c.innerHTML = "";
    setCrumbs([{ text: "总览", route: "#/" }, { text: "能力路线图" }]);
    var wrap = el("div", "wrap");
    wrap.appendChild(el("h1", "page-title", "🎯 能力路线图：从「学会」到「学到很好」"));
    wrap.appendChild(el("p", "lead",
      "本站课程负责第一层「概念校准」。要到达「很好」，还要走完后面三层：配书精读 → 亲手跑通一个真实系统 → 创造与输出。" +
      "下面每门课都给了配书、招牌实验、从零实现的项目与验收判据。只讲顺序与前置，不设时间节点——" +
      "你的判据是「这一层的验收标准做到了吗」，而不是「学了多久」。"));

    // 四级判据
    var lv = el("div", "block concept");
    lv.innerHTML = "<h3>什么是「学到很好的程度」<span class='tag'>四个硬指标</span></h3>" + MD.md([
      "1. **能重建**：给你一张白纸，能从零写出这个领域最核心的机制——一个注意力的前向、一个最小 harness 的工具循环、一次 LoRA 的合并、一个最小的评测打分器。",
      "2. **能诊断**：给一段 agent 打转的轨迹，能定位到是提示写得含糊、工具描述让模型误用、还是终止条件本身设错了。",
      "3. **能讲清**：能对没学过的人讲明白，并回答「为什么不用另一种做法」——比如为什么用检索而不是微调，为什么用批处理而不是加卡。",
      "4. **能被引用**：你写的东西真的有人用（项目、文章、被合并的 PR）。",
      "",
      "> 只到 1、2 是「很强」；加上 3、4 才是「很好」。第 4 条是自学最容易漏掉的一环——它必须由外部世界给，不能自己发给自己。"
    ].join("\n"));
    wrap.appendChild(lv);

    // 顺序与前置
    var order = el("div", "block steps");
    order.innerHTML = "<h3>顺序与前置关系 <span class='tag'>不设时间，只看前置</span></h3>" + MD.md([
      "- **主线 A（原理）：模型是什么、为什么这样表现**。零基础入门 → Python → 机器学习与深度学习 → 神经网络 → 分词 → 注意力与 Transformer → 预训练与推理 → 前沿模型专题、下一代架构与世界模型 → 后训练与对齐 → 持续学习、自进化、下一代学习算法。",
      "- **主线 B（工程）：把模型接成一个能干活的系统**。提示词工程 → 推理 API → Harness 解剖 → 协议生态 → 工具调用、RAG、微调 → Agent 核心与记忆架构 → 评测 Harness、Agent 安全。",
      "- **主线 C（实战与前沿追踪）：把它们拼成完整的东西，并且自己跟住变化**。四个项目课 → 前沿追踪路线图 → 前沿雷达。",
      "",
      "三条主线之间是允许交叉的：做应用的人可以先把 B 线打通再回去补 A 线。但**倒着学关键课会卡住**：" +
      "「Agent 核心」需要先学「工具调用」，否则你不知道工具循环在哪一环出错；" +
      "「微调入门」需要先学「后训练与对齐前沿」，否则分不清 SFT 与对齐各自解决什么；" +
      "「Agent 记忆架构」需要先学「Agent 核心」与「Agent 协议生态（2026-10）」，否则记不住「记忆」与「上下文」不是一回事。",
      "",
      "> 每门课页面顶部的「🎒 学这门课之前」直接告诉你前置；本页每张卡片的「验收判据」告诉你什么时候算过关。"
    ].join("\n"));
    wrap.appendChild(order);

    var state = PROGRESS.state();
    state.roadmap = state.roadmap || {};

    ROADMAP_AREAS.forEach(function (area) {
      var cards = area.ids.map(function (id) {
        return courses.filter(function (x) { return x.id === id; })[0];
      }).filter(Boolean);
      if (!cards.length) return;
      wrap.appendChild(el("h2", "sec", esc(area.name)));
      cards.forEach(function (co) {
        var adv = co.advanced;
        var box = el("div", "block concept");
        box.style.marginTop = "12px";
        var done = !!state.roadmap[co.id];
        var html = "<h3>" + co.icon + " " + esc(co.title) +
          " <a class='chip accent' href='#/c/" + co.id + "'>进课程 →</a>" +
          (done ? " <span class='chip ok'>已通关</span>" : "") + "</h3>";
        if (adv) {
          // criteria 允许写成字符串或字符串数组（数组渲染成清单，读起来更像验收项）
          var critHtml = Array.isArray(adv.criteria)
            ? "<ul>" + adv.criteria.map(function (t) { return "<li>" + MD.md(t) + "</li>"; }).join("") + "</ul>"
            : "<p>" + MD.md(adv.criteria) + "</p>";
          html += "<div class='md'><b>📚 配书</b><ul>" + adv.texts.map(function (t) { return "<li>" + MD.md(t) + "</li>"; }).join("") + "</ul>" +
            "<b>🧪 招牌实验</b><ul>" + adv.labs.map(function (t) { return "<li>" + MD.md(t) + "</li>"; }).join("") + "</ul>" +
            "<b>🏗️ 从零实现</b><p>" + MD.md(adv.project) + "</p>" +
            "<b>✅ 验收判据</b>" + critHtml + "</div>";
        } else {
          html += "<div class='note-line'>（本课暂未收录进阶包）</div>";
        }
        box.innerHTML = html;
        var btn = el("button", "btn sm " + (done ? "ok" : "ghost"), done ? "✓ 已通关（点击取消）" : "标记已通关");
        btn.addEventListener("click", function () {
          state.roadmap[co.id] = !done;
          PROGRESS.save();
          pageRoadmap();
        });
        var foot = el("div", "review-bar");
        foot.appendChild(btn);
        box.appendChild(foot);
        wrap.appendChild(box);
      });
    });

    // 自我检验（替代外部压力）
    var self = el("div", "block pitfall");
    self.innerHTML = "<h3>每周一次的自我检验 <span class='tag'>替代外部压力</span></h3>" + MD.md([
      "- 这一周我**交付**了什么能跑的东西？（不是「看了多少章」）",
      "- 这个东西**别人**能跑通吗？（README、依赖、测试齐全吗）",
      "- 这一周有没有**被人否定**过一次？（代码 review、提问被纠正、评测没过、复现对不上）",
      "- 我能不能**不看资料**讲清这周学的核心机制？",
      "",
      "> 四个问题里如果连续两周都是「没有」，说明你在舒适区里空转——纯兴趣学习最大的风险不是来不及，而是**无声地停下来**。"
    ].join("\n"));
    wrap.appendChild(self);

    // 导出进度
    var bar = el("div", "review-bar");
    var bExp = el("button", "btn sm ghost", "📄 导出路线图进度（Markdown）");
    bExp.addEventListener("click", function () {
      var L = ["# 能力路线图 · 通关进度", "", "> 导出时间：" + new Date().toLocaleString("zh-CN"), ""];
      ROADMAP_AREAS.forEach(function (area) {
        L.push("## " + area.name);
        L.push("");
        area.ids.forEach(function (id) {
          var co = courses.filter(function (x) { return x.id === id; })[0];
          if (!co) return;
          L.push("- [" + (state.roadmap[co.id] ? "x" : " ") + "] " + co.title + (co.advanced ? "　→ 项目：" + co.advanced.project : ""));
        });
        L.push("");
      });
      var fname = "能力路线图-" + new Date().toISOString().slice(0, 10) + ".md";
      var blob = new Blob([L.join("\n")], { type: "text/markdown;charset=utf-8" });
      var a = el("a");
      a.href = URL.createObjectURL(blob);
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast("已导出 " + fname, "ok");
    });
    bar.appendChild(bExp);
    wrap.appendChild(bar);

    c.appendChild(wrap);
  }

  /* ========================================================== 页面：错题本 */
  function pageNotebook() {
    var c = $("#content");
    c.innerHTML = "";
    setCrumbs([{ text: "总览", route: "#/" }, { text: "错题本" }]);
    var wrap = el("div", "wrap");
    var ms = PROGRESS.mistakes();
    wrap.appendChild(el("h1", "page-title", "📕 错题本"));
    wrap.appendChild(el("p", "lead", "答错的题会自动记录在这里。建议按「错得最多」的顺序逐条重做：先自己写出答案，再展开解析对照。"));

    var bar = el("div", "review-bar");
    var bReview = el("button", "btn primary", "🔁 开始随机复习（" + ms.length + " 题）");
    bReview.disabled = ms.length === 0;
    bReview.addEventListener("click", function () { navigate("#/review"); });
    bar.appendChild(bReview);
    var bExport = el("button", "btn ghost", "导出错题（JSON）");
    bExport.addEventListener("click", function () {
      var data = JSON.stringify(ms, null, 2);
      if (navigator.clipboard) navigator.clipboard.writeText(data).then(function () { toast("错题 JSON 已复制到剪贴板", "ok"); }, function () { toast("复制失败", "bad"); });
      else toast("当前环境不支持剪贴板", "bad");
    });
    bar.appendChild(bExport);
    var bClear = el("button", "btn ghost", "清空错题本");
    bClear.addEventListener("click", function () {
      if (global.confirm("确定清空全部错题记录？（学习进度不受影响）")) { PROGRESS.clearMistakes(); buildSidebar(); pageNotebook(); }
    });
    bar.appendChild(bClear);
    wrap.appendChild(bar);

    if (!ms.length) {
      wrap.appendChild(el("div", "empty", "还没有错题 —— 去做几讲随堂测验吧，答错的题会自动出现在这里。"));
      c.appendChild(wrap);
      return;
    }

    ms.sort(function (a, b) { return (b.count || 0) - (a.count || 0) || (b.lastWrong || 0) - (a.lastWrong || 0); });
    ms.forEach(function (m) {
      var info = lessonIndex[m.lessonId];
      var item = el("div", "wrong-item");
      var opts = m.options ? "<div class='note-line'>选项：" + m.options.map(function (o, i) { return (i + 1) + ". " + esc(o); }).join("　") + "</div>" : "";
      var ansTxt = Array.isArray(m.answer)
        ? m.answer.map(function (i) { return m.options ? m.options[i] : i; }).join("；")
        : (m.options ? m.options[m.answer] : String(m.answer));
      item.innerHTML = "<div class='txt'><div class='q'>" + MD.md(m.q) + "</div>" + opts +
        "<div class='m'>来源：" + esc(info ? info.course.title + " · " + info.lesson.title : m.lessonId) +
        " ｜ 错误 " + (m.count || 1) + " 次 ｜ 最近 " + fmtTime(m.lastWrong) + "</div>" +
        "<div class='m'>正确答案：" + esc(ansTxt || "") + "</div>" +
        "<div class='m'>解析：" + esc(m.why || "") + "</div></div>";
      var right = el("div");
      var bOpen = el("button", "btn sm ghost", "去重做");
      bOpen.addEventListener("click", function () {
        if (info) navigate("#/c/" + info.course.id + "/" + info.lesson.id);
      });
      var bGone = el("button", "btn sm ghost", "已掌握");
      bGone.addEventListener("click", function () { PROGRESS.removeMistake(m.qid); buildSidebar(); pageNotebook(); });
      right.appendChild(bOpen); right.appendChild(bGone);
      item.appendChild(right);
      wrap.appendChild(item);
    });
    c.appendChild(wrap);
  }

  /* ========================================================== 页面：复习 */
  function pageReview() {
    var c = $("#content");
    c.innerHTML = "";
    setCrumbs([{ text: "总览", route: "#/" }, { text: "复习" }]);
    var wrap = el("div", "wrap");
    wrap.appendChild(el("h1", "page-title", "🔁 智能复习"));
    wrap.appendChild(el("p", "lead", "优先抽取错题与正确率偏低课程的题目。答对会从错题本移除，答错会继续留在错题本。"));

    var weak = PROGRESS.weakLessons(courses, 8);
    var ms = PROGRESS.mistakes();
    var bank = [];
    // 1) 错题优先
    ms.sort(function (a, b) { return (b.count || 0) - (a.count || 0); });
    ms.forEach(function (m) {
      var info = lessonIndex[m.lessonId];
      if (!info) return;
      var q = (info.lesson.quiz || []).filter(function (x) { return x.id === m.qid; })[0];
      if (q) bank.push({ q: q, lesson: info.lesson, course: info.course, from: "错题本" });
    });
    // 2) 薄弱课题目
    weak.forEach(function (w) {
      (w.lesson.quiz || []).forEach(function (q) {
        if (bank.length < 14 && !bank.some(function (x) { return x.q.id === q.id; })) {
          bank.push({ q: q, lesson: w.lesson, course: w.course, from: "薄弱课" });
        }
      });
    });
    // 3) 未测过的课
    if (bank.length < 8) {
      courses.forEach(function (co) {
        (co.lessons || []).forEach(function (l) {
          var st = PROGRESS.state().quiz[l.id];
          if (!st && bank.length < 10) {
            (l.quiz || []).forEach(function (q) { if (bank.length < 10 && !bank.some(function (x) { return x.q.id === q.id; })) bank.push({ q: q, lesson: l, course: co, from: "未测" }); });
          }
        });
      });
    }
    // 打乱
    for (var i = bank.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = bank[i]; bank[i] = bank[j]; bank[j] = tmp;
    }
    var picked = bank.slice(0, 8);

    if (!picked.length) {
      wrap.appendChild(el("div", "empty", "暂无可用题目：先去任意课程做几道随堂测验。"));
      c.appendChild(wrap);
      return;
    }

    var src = el("div", "review-bar");
    src.appendChild(el("span", "chip accent", "本次抽取 " + picked.length + " 题"));
    var cnt = {};
    picked.forEach(function (p) { cnt[p.from] = (cnt[p.from] || 0) + 1; });
    Object.keys(cnt).forEach(function (k) { src.appendChild(el("span", "chip", k + " " + cnt[k] + " 题")); });
    wrap.appendChild(src);

    var list = el("div");
    wrap.appendChild(list);
    picked.forEach(function (p, i) {
      var head = el("div", "qhead");
      head.innerHTML = "<div class='no'>R" + (i + 1) + "</div><div class='q note-line'>" +
        esc(p.course.title + " · " + p.lesson.title + "（" + p.from + "）") + "</div>";
      list.appendChild(head);
      QUIZ.render(list, [p.q], {
        scope: "review:" + p.q.id,
        hideTitle: true,
        onAnswered: function (q, ok, pickedIdx) {
          PROGRESS.recordQuiz(p.lesson.id, p.course.id, q, ok, pickedIdx);
          if (ok && PROGRESS.state().mistakes[q.id]) {
            PROGRESS.removeMistake(q.id);
            toast("答对，已从错题本移除 ✓", "ok");
          } else if (ok) toast("答对 ✓", "ok");
          buildSidebar();
        }
      });
    });
    var foot = el("div", "lesson-foot");
    var again = el("button", "btn primary", "↻ 再抽一组");
    again.addEventListener("click", function () { pageReview(); });
    var nb = el("button", "btn ghost", "打开错题本");
    nb.addEventListener("click", function () { navigate("#/notebook"); });
    foot.appendChild(again); foot.appendChild(nb);
    wrap.appendChild(foot);
    c.appendChild(wrap);
  }

  /* ======================================================== 学习报告导出 */
  /** 把学习进度、错题、自检勾选导出为 Markdown（借鉴项目式工作台的导出设计） */
  function studyReport() {
    var g = PROGRESS.globalStat(courses);
    var L = [];
    L.push("# " + document.title + " · 学习报告");
    L.push("");
    L.push("> 导出时间：" + new Date().toLocaleString("zh-CN") + "　总进度 " + g.pct + "%");
    L.push("");
    L.push("## 一、总览");
    L.push("");
    L.push("- 课程数：" + courses.length + "　讲数：" + g.lessons);
    L.push("- 已掌握：" + g.done + " 讲　已开始：" + g.read + " 讲　完成度：" + g.pct + "%");
    L.push("- 测验作答：" + g.attempted + " 题　正确率：" + (g.accuracy == null ? "—" : g.accuracy + "%"));
    L.push("- 待复习错题：" + g.mistakes + " 题");
    L.push("");
    L.push("## 二、各课程进度");
    L.push("");
    L.push("| 课程 | 讲数 | 已掌握 | 完成度 | 作答 | 正确率 |");
    L.push("|---|---|---|---|---|---|");
    courses.forEach(function (c) {
      var s = PROGRESS.courseStat(c);
      L.push("| " + c.title + " | " + s.total + " | " + s.done + " | " + s.pct + "% | " + s.attempted + " | " + (s.accuracy == null ? "—" : s.accuracy + "%") + " |");
    });
    L.push("");
    var ms = PROGRESS.mistakes();
    L.push("## 三、错题本（" + ms.length + " 题）");
    L.push("");
    if (!ms.length) L.push("（暂无错题）");
    ms.sort(function (a, b) { return (b.count || 0) - (a.count || 0); }).forEach(function (m, i) {
      var info = lessonIndex[m.lessonId];
      L.push("### " + (i + 1) + ". " + m.q);
      L.push("");
      L.push("- 来源：" + (info ? info.course.title + " · " + info.lesson.title : m.lessonId));
      L.push("- 错误次数：" + (m.count || 1));
      L.push("- 正确答案：" + (Array.isArray(m.answer) ? m.answer.map(function (x) { return m.options ? m.options[x] : x; }).join("；") : (m.options ? m.options[m.answer] : m.answer)));
      L.push("- 解析：" + (m.why || ""));
      L.push("");
    });
    L.push("## 四、自检清单完成情况");
    L.push("");
    var checks = PROGRESS.state().checks || {};
    var anyCheck = Object.keys(checks).some(function (k) { return Object.keys(checks[k] || {}).length; });
    if (!anyCheck) L.push("（还没有勾选自检清单）");
    Object.keys(checks).forEach(function (lid) {
      var info = lessonIndex[lid];
      var done = Object.keys(checks[lid] || {}).filter(function (k) { return checks[lid][k]; }).length;
      if (done) L.push("- " + (info ? info.course.title + " · " + info.lesson.title : lid) + "：" + done + " 项已勾选");
    });
    L.push("");
    L.push("## 五、下一步建议");
    L.push("");
    var weak = PROGRESS.weakLessons(courses, 5);
    if (weak.length) {
      L.push("按薄弱程度排序，建议先补这几讲：");
      L.push("");
      weak.forEach(function (w) {
        L.push("- " + w.course.title + " · " + w.lesson.title + "（历史正确率 " + Math.round(w.accuracy * 100) + "%，错题 " + w.wrong + " 道）");
      });
    } else L.push("（暂无薄弱项，继续按培养方案顺序往后学）");
    L.push("");
    return L.join("\n");
  }

  /* ============================================================ 搜索 */
  var searchIndex = [];
  courses.forEach(function (co) {
    (co.lessons || []).forEach(function (l) {
      var text = [co.title, l.title, l.goal || ""].concat((l.blocks || []).map(function (b) {
        return [b.title, b.md, b.note].filter(Boolean).join(" ");
      })).join(" ");
      searchIndex.push({ course: co, lesson: l, text: text });
    });
  });

  function doSearch(q) {
    var pop = $("#searchPop");
    q = (q || "").trim();
    if (q.length < 1) { pop.hidden = true; pop.innerHTML = ""; return; }
    var lq = q.toLowerCase();
    var hits = [];
    searchIndex.forEach(function (rec) {
      var t = rec.text.toLowerCase();
      var pos = t.indexOf(lq);
      if (pos >= 0) {
        var start = Math.max(0, pos - 30);
        hits.push({
          course: rec.course, lesson: rec.lesson,
          snippet: rec.text.slice(start, pos + q.length + 50).replace(/\s+/g, " "),
          score: (rec.lesson.title.toLowerCase().indexOf(lq) >= 0 ? 0 : 1)
        });
      }
    });
    hits.sort(function (a, b) { return a.score - b.score; });
    hits = hits.slice(0, 14);
    pop.innerHTML = "";
    if (!hits.length) {
      pop.appendChild(el("div", "search-hit", "<div class='t'>没有匹配结果</div><div class='m'>试试「注意力」「KV cache」「提示注入」「LoRA」「余弦相似度」等关键词</div>"));
    }
    hits.forEach(function (h) {
      var d = el("div", "search-hit");
      d.innerHTML = "<div class='t'>" + h.course.icon + " " + esc(h.lesson.title) + "</div><div class='m'>" + esc(h.course.title) + " · …" + esc(h.snippet) + "…</div>";
      d.addEventListener("click", function () {
        pop.hidden = true;
        $("#search").value = "";
        navigate("#/c/" + h.course.id + "/" + h.lesson.id);
      });
      pop.appendChild(d);
    });
    pop.hidden = false;
  }

  /* ============================================================ 路由 */
  function render() {
    var h = location.hash || "#/";
    var m;
    if ((m = h.match(/^#\/c\/([\w-]+)\/([\w-]+)$/))) pageLesson(m[1], m[2]);
    else if ((m = h.match(/^#\/c\/([\w-]+)$/))) pageCourse(m[1]);
    else if (h === "#/path") pagePath();
    else if (h === "#/notebook") pageNotebook();
    else if (h === "#/glossary") pageGlossary();
    else if (h === "#/roadmap") pageRoadmap();
    else if (h === "#/review") pageReview();
    else pageHome();
    buildSidebar();
    markActiveNav();
    var side = $("#sidebar");
    if (side) side.classList.remove("open");
  }

  global.addEventListener("hashchange", render);

  /* ======================================================== 全局交互绑定 */
  function bind() {
    $("#btnTheme").addEventListener("click", function () {
      var cur = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      applyTheme(cur);
      toast(cur === "light" ? "已切换到浅色模式" : "已切换到深色模式");
    });
    $("#btnReview").addEventListener("click", function () { navigate("#/review"); });
    $("#btnNotebook").addEventListener("click", function () { navigate("#/notebook"); });
    $("#btnMenu").addEventListener("click", function () { $("#sidebar").classList.toggle("open"); });

    $("#search").addEventListener("input", function (e) { doSearch(e.target.value); });
    $("#search").addEventListener("focus", function (e) { doSearch(e.target.value); });
    document.addEventListener("click", function (e) {
      var pop = $("#searchPop");
      if (!pop.hidden && !e.target.closest(".topbar-search")) pop.hidden = true;

      // 手机上：抽屉（侧边栏）打开时，点内容区任意位置就把它收起来。
      // 点 ☰ 本身不算（那是它自己的开关，否则会"开了立刻关"）；
      // 点抽屉内部的链接也不算（侧边栏自己的处理已经会收起它）。
      var sb = $("#sidebar");
      if (sb && sb.classList.contains("open") &&
          !e.target.closest("#sidebar") && !e.target.closest("#btnMenu")) {
        sb.classList.remove("open");
      }
    });

    var rb = document.getElementById("btnReport");
    if (rb) rb.addEventListener("click", function () {
      var md = studyReport();
      var name = "学习报告-" + new Date().toISOString().slice(0, 10) + ".md";
      var blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast("已导出 " + name + "（也可在文件管理器的下载目录找到）", "ok");
    });

    $("#btnData").addEventListener("click", function () {
      var dlg = el("dialog", "modal");
      dlg.innerHTML = "<h3>学习数据：导出 / 导入</h3>" +
        "<p class='note-line'>数据保存在本浏览器的 localStorage 中。换电脑或换浏览器时，可复制下方 JSON 备份，粘贴后点「导入」恢复。</p>" +
        "<textarea id='dataArea'></textarea>";
      var bar = el("div", "review-bar");
      bar.style.marginTop = "10px";
      var bLoad = el("button", "btn sm ghost", "填入当前数据");
      bLoad.addEventListener("click", function () { dlg.querySelector("#dataArea").value = PROGRESS.exportJson(); });
      var bImport = el("button", "btn sm primary", "导入");
      bImport.addEventListener("click", function () {
        try {
          PROGRESS.importJson(dlg.querySelector("#dataArea").value);
          toast("导入成功", "ok");
          dlg.close(); render();
        } catch (e) { toast("导入失败：" + e.message, "bad"); }
      });
      var bCopy = el("button", "btn sm ghost", "复制到剪贴板");
      bCopy.addEventListener("click", function () {
        var ta = dlg.querySelector("#dataArea");
        ta.value = PROGRESS.exportJson();
        if (navigator.clipboard) navigator.clipboard.writeText(ta.value).then(function () { toast("已复制", "ok"); });
      });
      var bReset = el("button", "btn sm ghost", "清空全部数据");
      bReset.addEventListener("click", function () {
        if (global.confirm("确定清空全部学习进度、测验记录与错题本？此操作不可撤销。")) {
          PROGRESS.resetAll(); toast("已清空"); dlg.close(); render();
        }
      });
      var bClose = el("button", "btn sm ghost", "关闭");
      bClose.addEventListener("click", function () { dlg.close(); });
      bar.appendChild(bLoad); bar.appendChild(bImport); bar.appendChild(bCopy); bar.appendChild(bReset); bar.appendChild(bClose);
      dlg.appendChild(bar);
      document.body.appendChild(dlg);
      dlg.querySelector("#dataArea").value = PROGRESS.exportJson();
      dlg.addEventListener("close", function () { dlg.remove(); });
      if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
    });

    document.addEventListener("keydown", function (e) {
      var tag = (e.target.tagName || "").toLowerCase();
      var typing = tag === "input" || tag === "textarea" || e.target.isContentEditable;
      if (e.key === "/" && !typing) { e.preventDefault(); $("#search").focus(); return; }
      if (e.key === "Escape") { $("#searchPop").hidden = true; $("#search").blur(); return; }
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        var m = (location.hash || "").match(/^#\/c\/([\w-]+)\/([\w-]+)$/);
        if (m) {
          var cur = PROGRESS.isDone(m[2]);
          PROGRESS.markDone(m[2], !cur);
          toast(!cur ? "已标记本讲掌握 ✓" : "已取消掌握标记", !cur ? "ok" : "");
          render();
        }
        return;
      }
      if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        var mm = (location.hash || "").match(/^#\/c\/([\w-]+)\/([\w-]+)$/);
        if (!mm) return;
        var co = courses.filter(function (x) { return x.id === mm[1]; })[0];
        if (!co) return;
        var i = (co.lessons || []).findIndex(function (l) { return l.id === mm[2]; });
        var ni = e.key === "ArrowRight" ? i + 1 : i - 1;
        if (ni >= 0 && ni < co.lessons.length) navigate("#/c/" + co.id + "/" + co.lessons[ni].id);
      }
    });
  }

  /* ====================================================== 进度同步指示 */
  /**
   * 进度同步是"可选功能"：
   *   · 通过本地服务器打开（手机/电脑连同一台电脑）→ 两份进度自动合并成一份；
   *   · 用 file:// 双击打开、或服务器没开 → 静默退回纯本地，界面上标"仅本机"。
   * 这里只负责显示状态、以及在合并出新数据后重画一次界面。
   */
  function bindSync() {
    if (!global.PROGRESS || !PROGRESS.onSync) return;
    var badge = document.getElementById("syncBadge");

    PROGRESS.onSync(function (st) {
      if (!badge) return;
      var MAP = {
        synced: ["已同步", "ok", "进度已与这台电脑上的服务器同步：手机和电脑共用同一份。"],
        local: ["同步中", "", "正在从电脑上的服务器读取进度…"],
        error: ["仅本机", "warn", "没连上服务器（电脑没开机？或没通过 start.cmd 打开），进度只存在这台设备上。"],
        off: ["仅本机", "warn", "当前是直接打开网页文件（file://），进度只存在这台设备上。用 start.cmd 打开即可两端同步。"]
      };
      var v = MAP[st] || MAP.off;
      badge.textContent = v[0];
      badge.className = "sync-badge " + v[1];
      badge.title = v[2];
      badge.hidden = false;

      // 第一次发现"没有同步"时明确说一次：否则用户会以为进度同步了，其实只在本机。
      // 只在每个浏览器里提示一次，之后靠状态点自己看。
      var HINT_KEY = "sync-hint:v1";
      var shown = false;
      try { shown = global.localStorage.getItem(HINT_KEY) === "1"; } catch (e) { shown = true; }
      if ((st === "off" || st === "error") && !shown) {
        try { global.localStorage.setItem(HINT_KEY, "1"); } catch (e) { /* 忽略 */ }
        toast(st === "off"
          ? "进度只存在这台设备上（当前是直接打开网页文件）。想和手机共用进度：改用 start-all.cmd 打开，并先把这里的进度用「💾 数据」导出、在新页面导入一次。"
          : "连不上电脑上的服务器，进度暂时只存在本机。", 9000);
      }
    });

    // 合并到新数据后重画（比如在手机上刷完题，切回电脑这个标签页就能看到）
    PROGRESS.onMerged(function () { render(); });

    PROGRESS.initSync();
    if (badge) badge.addEventListener("click", function () { PROGRESS.syncNow(); });
  }

  /* ============================================================== 启动 */
  function boot() {
    if (!courses.length) {
      $("#content").appendChild(el("div", "empty",
        "没有加载到课程数据。<br>请确认 data/ 目录下的课程文件存在，并且是通过 index.html 打开本站。"));
      return;
    }
    bind();
    bindSidebarNav();
    bindTermLinks($("#content"));
    bindSync();
    render();
    var nLessons = courses.reduce(function (n, c) { return n + (c.lessons || []).length; }, 0);
    console.log("[LLM 学习站] 已加载 " + courses.length + " 门课程 / " + nLessons + " 讲");
  }

  global.APP = { courses: courses, lessonIndex: lessonIndex, render: render, navigate: navigate };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window);
