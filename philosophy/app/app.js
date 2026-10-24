/* ==========================================================================
   app.js —— 哲学本科互动学习站：路由 / 渲染 / 间隔重复 / 论证重构 / 写作训练
   零依赖 · 离线可用 · 进度存 localStorage · file:// 直接打开即可用
   ========================================================================== */
(function (global) {
  "use strict";

  /* ============================================================ 课程顺序 */
  // 按"先工具、后历史、再问题与专题"的修读顺序展示。
  // 注意：真正的展示顺序由「学期(term) 优先、组内按本数组」决定（见下方 sort），
  // 所以这里的相对次序只在同一学期内起作用。
  var ORDER = [
    "philo-intro", "philo-logic",
    "philo-ancient", "philo-medieval-idealism", "philo-modern",
    "philo-marxism", "philo-epistemology", "philo-metaphysics",
    "philo-ethics", "philo-political", "philo-social",
    "philo-aesthetics", "philo-contemporary", "philo-logic-meta",
    "philo-chinese", "philo-buddhism-china", "philo-education"
  ];
  var TERM_ORDER = ["入门", "逻辑工具", "第一学期", "第二学期", "第三学期", "第四学期", "专题选修"];
  function termRank(term) {
    var i = TERM_ORDER.indexOf(term);
    return i >= 0 ? i : 999;
  }
  var courses = (global.COURSE_PACKS || []).slice();
  courses.sort(function (a, b) {
    // 主序：学期；同 semesters 内按 ORDER 排（这样"培养方案路径"页也符合真实修读顺序）
    var ta = termRank(a.term), tb = termRank(b.term);
    if (ta !== tb) return ta - tb;
    var ia = ORDER.indexOf(a.id), ib = ORDER.indexOf(b.id);
    if (ia < 0 && ib < 0) return String(a.title).localeCompare(String(b.title));
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });

  var lessonIndex = {};
  courses.forEach(function (c) {
    (c.lessons || []).forEach(function (l, i) { lessonIndex[l.id] = { course: c, lesson: l, index: i }; });
  });

  /* ------------------------------------------------------ 阅读轨迹（可选数据） */
  /**
   * data/reading-*.js 提供「精读轨迹」：读哪些书、什么顺序、什么难度、配哪几讲。
   * 这是给"时间不重要、只要学到位"的读者准备的——本站课程给地图与方法，
   * 真正的深度来自把整本书读完。
   */
  var readingPlans = (global.READING_PLANS || []).slice();
  /** lessonId -> [{plan, stage, book}]，用于在课时页显示"读完这一讲，接着读哪本书" */
  var readingByLesson = {};
  readingPlans.forEach(function (p) {
    (p.stages || []).forEach(function (s) {
      (s.books || []).forEach(function (b) {
        (b.lessons || []).forEach(function (lid) {
          (readingByLesson[lid] = readingByLesson[lid] || []).push({ plan: p, stage: s, book: b });
        });
      });
    });
  });

  /* ============================================================== 工具 */
  function $(sel) { return document.querySelector(sel); }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) { return MD.escapeHtml(s); }
  function md(s) { return MD.md(s); }
  function txt(s) { return esc(s == null ? "" : String(s)); }
  function all(arr, fn) { (arr || []).forEach(fn); }
  function sum(arr, fn) { return (arr || []).reduce(function (n, x) { return n + (fn ? fn(x) : x); }, 0); }

  function navigate(hash) {
    if (location.hash === hash) { render(); return; }
    location.hash = hash;
    var shown = location.hash;
    setTimeout(function () { if (shown === location.hash) render(); }, 0);
  }
  function toast(msg, kind) {
    var host = $("#toastHost");
    if (!host) return;
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
  function todayKey(ts) {
    var d = new Date(ts || Date.now());
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  /* ======================================================= 进度 / 数据层 */
  var KEY = "philo-learn:v1";
  var DEFAULT = {
    version: 1,
    lessons: {},    // lessonId -> { status:'read'|'done', updated, visits }
    quiz: {},       // lessonId -> { attempted, correct, updated }
    mistakes: {},   // qid -> {...}
    cards: {},      // cardId -> { ease, interval, due, reps, lapses, last }
    args: {},       // argId -> { done, correct, attempts, updated }
    writing: {},    // writingId -> { text, words, rubric:{k:true}, updated }
    notes: {},      // lessonId -> text
    prefs: { theme: "dark", lastLesson: null },
    stats: { startedAt: Date.now(), days: {}, xp: 0 }
  };
  var state = loadState();

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function loadState() {
    try {
      var raw = global.localStorage.getItem(KEY);
      if (!raw) return clone(DEFAULT);
      var p = JSON.parse(raw);
      return Object.assign(clone(DEFAULT), p, {
        prefs: Object.assign(clone(DEFAULT.prefs), p.prefs || {}),
        stats: Object.assign(clone(DEFAULT.stats), p.stats || {}),
        // days 是逐日 XP 记录，必须跟着 stats 一起恢复（不能落回默认值）
        days: Object.assign({}, (p.stats && p.stats.days) || {})
      });
    } catch (e) { return clone(DEFAULT); }
  }
  function save() {
    try { global.localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (e) { return false; }
  }
  function addXP(n) {
    state.stats.xp = (state.stats.xp || 0) + n;
    var k = todayKey();
    state.stats.days = state.stats.days || {};
    state.stats.days[k] = (state.stats.days[k] || 0) + n;
    save();
  }
  /** 连续学习天数：从今天（或昨天）往回数连续有记录的天数 */
  function streak() {
    var days = state.stats.days || {};
    var n = 0, d = new Date();
    if (!days[todayKey(d)]) d.setDate(d.getDate() - 1);   // 今天还没学，看昨天能不能接上
    for (var i = 0; i < 400; i++) {
      if (days[todayKey(d)]) { n++; d.setDate(d.getDate() - 1); } else break;
    }
    return n;
  }

  function markVisit(id) {
    var r = state.lessons[id] || { status: "unread", updated: 0, visits: 0 };
    r.visits = (r.visits || 0) + 1;
    if (r.status !== "done") r.status = "read";
    r.updated = Date.now();
    state.lessons[id] = r; save();
  }
  function markDone(id, done) {
    var r = state.lessons[id] || { status: "unread", updated: 0, visits: 0 };
    r.status = done ? "done" : "read";
    r.updated = Date.now();
    state.lessons[id] = r;
    if (done) addXP(20); else save();
  }
  function isDone(id) { return (state.lessons[id] || {}).status === "done"; }
  function lessonState(id) { return (state.lessons[id] || {}).status || "unread"; }

  function recordQuiz(lessonId, courseId, q, ok, picked) {
    var r = state.quiz[lessonId] || { attempted: 0, correct: 0, updated: 0 };
    r.attempted++; if (ok) r.correct++;
    r.updated = Date.now();
    state.quiz[lessonId] = r;
    if (!ok) {
      var prev = state.mistakes[q.id] || { count: 0, retried: 0 };
      state.mistakes[q.id] = {
        qid: q.id, lessonId: lessonId, courseId: courseId, q: q.q, type: q.type,
        why: q.why, options: q.options || null, items: q.items || null,
        answer: q.answer, picked: picked == null ? null : picked,
        count: (prev.count || 0) + 1, lastWrong: Date.now(), retried: prev.retried || 0
      };
    } else if (state.mistakes[q.id]) {
      state.mistakes[q.id].retried = (state.mistakes[q.id].retried || 0) + 1;
      state.mistakes[q.id].lastRight = Date.now();
    }
    addXP(ok ? 5 : 1);
  }
  function mistakes() { return Object.keys(state.mistakes).map(function (k) { return state.mistakes[k]; }); }
  function removeMistake(qid) { if (state.mistakes[qid]) { delete state.mistakes[qid]; save(); } }
  function clearMistakes() { state.mistakes = {}; save(); }

  /* ------------------------------------------- 间隔重复（SM-2 简化版） */
  var DAY = 86400000;
  function cardRec(id) { return state.cards[id] || null; }
  function cardDue(id) {
    var r = state.cards[id];
    return !r || !r.due || r.due <= Date.now();
  }
  /**
   * 评分：0=完全不会 1=模糊 2=记得 3=太简单
   * 采用 SM-2 的简化版：间隔按 ease 递增，答错则重置到 10 分钟后重来。
   */
  function gradeCard(id, grade) {
    var r = state.cards[id] || { ease: 2.5, interval: 0, due: 0, reps: 0, lapses: 0 };
    r.reps++;
    if (grade === 0) {
      r.lapses++; r.ease = Math.max(1.3, r.ease - 0.2);
      r.interval = 0; r.due = Date.now() + 10 * 60000;
    } else {
      if (grade === 1) r.ease = Math.max(1.3, r.ease - 0.15);
      if (grade === 3) r.ease = Math.min(3.2, r.ease + 0.1);
      if (r.interval < 1) r.interval = grade === 1 ? 1 : 2;
      else if (r.interval < 6) r.interval = grade === 1 ? Math.max(1, r.interval) : 6;
      else r.interval = Math.round(r.interval * r.ease * (grade === 1 ? 0.6 : 1));
      r.interval = Math.min(r.interval, 365);
      r.due = Date.now() + r.interval * DAY;
    }
    r.last = Date.now();
    state.cards[id] = r;
    addXP(grade >= 2 ? 4 : 2);
    return r;
  }
  function allCards() {
    var out = [];
    courses.forEach(function (c) {
      (c.lessons || []).forEach(function (l) {
        all(l.flashcards, function (f) { out.push({ card: f, lesson: l, course: c }); });
      });
    });
    return out;
  }
  function cardStats() {
    var cs = allCards(), due = 0, learned = 0, fresh = 0;
    cs.forEach(function (x) {
      var r = state.cards[x.card.id];
      if (!r) { fresh++; due++; }
      else if (r.due <= Date.now()) due++;
      if (r && r.reps > 0) learned++;
    });
    return { total: cs.length, due: due, learned: learned, fresh: fresh };
  }

  function setPref(k, v) { state.prefs[k] = v; save(); }
  function getPref(k) { return state.prefs[k]; }

  function exportJson() { return JSON.stringify(state, null, 2); }
  function importJson(text) {
    var p = JSON.parse(text);
    if (!p || typeof p !== "object" || !p.lessons) throw new Error("格式不正确：缺少 lessons 字段");
    state = Object.assign(clone(DEFAULT), p);
    save();
  }
  function resetAll() { state = clone(DEFAULT); save(); }

  function courseStat(course) {
    var lessons = course.lessons || [];
    var done = lessons.filter(function (l) { return isDone(l.id); }).length;
    var read = lessons.filter(function (l) { return lessonState(l.id) !== "unread"; }).length;
    var attempted = 0, correct = 0, quizTotal = 0, cards = 0, args = 0, writing = 0;
    lessons.forEach(function (l) {
      quizTotal += (l.quiz || []).length;
      cards += (l.flashcards || []).length;
      args += (l.arguments || []).length;
      writing += (l.writing || []).length + (l.blocks || []).filter(function (b) { return b.type === "writing"; }).length;
      var q = state.quiz[l.id];
      if (q) { attempted += q.attempted; correct += q.correct; }
    });
    return {
      total: lessons.length, done: done, read: read,
      pct: lessons.length ? Math.round((done / lessons.length) * 100) : 0,
      quizTotal: quizTotal, attempted: attempted, correct: correct,
      accuracy: attempted ? Math.round((correct / attempted) * 100) : null,
      cards: cards, args: args, writing: writing
    };
  }
  function globalStat() {
    var t = { lessons: 0, done: 0, read: 0, quiz: 0, attempted: 0, correct: 0, cards: 0, args: 0, writing: 0, mistakes: mistakes().length };
    courses.forEach(function (c) {
      var s = courseStat(c);
      t.lessons += s.total; t.done += s.done; t.read += s.read;
      t.quiz += s.quizTotal; t.attempted += s.attempted; t.correct += s.correct;
      t.cards += s.cards; t.args += s.args; t.writing += s.writing;
    });
    t.pct = t.lessons ? Math.round((t.done / t.lessons) * 100) : 0;
    t.accuracy = t.attempted ? Math.round((t.correct / t.attempted) * 100) : null;
    t.xp = state.stats.xp || 0;
    t.streak = streak();
    t.level = Math.floor(t.xp / 200) + 1;
    t.levelPct = Math.round(((t.xp % 200) / 200) * 100);
    return t;
  }
  function weakLessons(limit) {
    var rows = [];
    courses.forEach(function (c) {
      (c.lessons || []).forEach(function (l) {
        var q = state.quiz[l.id];
        var wrong = mistakes().filter(function (m) { return m.lessonId === l.id; }).length;
        var lapse = (l.flashcards || []).filter(function (f) {
          var r = state.cards[f.id]; return r && r.lapses > 0;
        }).length;
        if (!q || q.attempted === 0) {
          if (wrong > 0 || lapse > 0) rows.push({ course: c, lesson: l, score: wrong * 2 + lapse, accuracy: 0, attempted: 0, wrong: wrong });
          return;
        }
        var acc = q.correct / q.attempted;
        var score = (1 - acc) * 10 + wrong + lapse * 0.5;
        if (acc < 1 || wrong > 0) rows.push({ course: c, lesson: l, score: score, accuracy: acc, attempted: q.attempted, wrong: wrong });
      });
    });
    rows.sort(function (a, b) { return b.score - a.score; });
    return rows.slice(0, limit || 8);
  }

  /* ============================================ 术语索引（零基础兜底） */
  /**
   * 把「术语表 + 全部闪卡」合并成一张可查询的术语底表。
   * 用途：① 页面按钮「🔍 术语」可查任意生词；② 「标注生词」开关把术语在正文里
   * 自动加上虚线下划线，点击即弹出解释——零基础读者不用离开当前页去翻术语表。
   */
  var TERM_BANK = null;
  function buildTermBank() {
    if (TERM_BANK) return TERM_BANK;
    var byKey = {};
    function add(termRaw, en, def, where, kind) {
      var t = String(termRaw || "").trim();
      if (!t) return;
      // 词条可能写作「论证（argument）」：拆出中文名与外文名
      var m = t.match(/^(.+?)\s*[（(]([^）)]{1,60})[）)]\s*$/);
      var zh = (m ? m[1] : t).trim();
      var foreign = (en || (m ? m[2] : "") || "").trim();
      if (zh.length < 2 || zh.length > 30) return;
      var key = zh;
      if (!byKey[key]) byKey[key] = { term: zh, en: foreign, def: def || "", where: where || "", kind: kind || "" };
      else if (!byKey[key].def && def) byKey[key].def = def;
    }
    var G = global.GLOSSARY;
    if (G && G.cats) {
      G.cats.forEach(function (c) {
        (c.items || []).forEach(function (it) { add(it.t, it.en, it.d, it.where, "glossary"); });
      });
    }
    allCards().forEach(function (x) {
      var f = x.card;
      var back = String(f.back || "");
      add(f.front, "", back, x.lesson.title, f.kind || "card");
    });
    // 只保留 3 字以上的长术语用于自动标注，避免「存在」「形式」这类常用词被满页划线
    var list = Object.keys(byKey).map(function (k) { return byKey[k]; })
      .sort(function (a, b) { return b.term.length - a.term.length; });
    TERM_BANK = { byKey: byKey, list: list };
    return TERM_BANK;
  }
  function lookupTerm(text) {
    var B = buildTermBank();
    var t = String(text || "").trim();
    if (B.byKey[t]) return B.byKey[t];
    // 去掉括号/书名号后再试
    var stripped = t.replace(/[（(].*?[）)]/g, "").replace(/[《》「」『』]/g, "").trim();
    return B.byKey[stripped] || null;
  }
  function showTermInfo(text) {
    var info = text ? lookupTerm(text) : null;
    var dlg = el("dialog", "modal term-modal");
    var B = buildTermBank();
    function body(inner) {
      return "<h3>🔍 查术语 <span class='chip'>" + B.list.length + " 条底表</span></h3>" +
        "<input class='fill-in' id='termQ' placeholder='输入一个词，例如：规范性、随附性、绝对命令、理型' autocomplete='off'>" +
        "<div id='termOut' class='term-out'>" + (inner || "<div class='note-line'>输入后按回车，或直接点下面的常见术语。</div>") + "</div>";
    }
    dlg.innerHTML = body(info
      ? "<div class='term-hit'><b>" + esc(info.term) + "</b>" + (info.en ? " <span class='chip accent'>" + esc(info.en) + "</span>" : "") +
        "<div class='md'>" + md(info.def) + "</div>" + (info.where ? "<div class='note-line'>→ 出现在：" + esc(info.where) + "</div>" : "") + "</div>"
      : "");

    var bar = el("div", "review-bar");
    var b1 = el("button", "btn sm primary", "打开完整术语表");
    b1.addEventListener("click", function () { dlg.close(); navigate("#/glossary"); });
    var b2 = el("button", "btn sm ghost", "关闭");
    b2.addEventListener("click", function () { dlg.close(); });
    bar.appendChild(b1); bar.appendChild(b2);
    dlg.appendChild(bar);
    document.body.appendChild(dlg);

    setTimeout(function () {
      var input = dlg.querySelector("#termQ");
      var out = dlg.querySelector("#termOut");
      if (!input || !out) return;
      input.focus();
      function search() {
        var q = input.value.trim();
        if (!q) return;
        var hit = lookupTerm(q);
        if (hit) {
          out.innerHTML = "<div class='term-hit'><b>" + esc(hit.term) + "</b>" +
            (hit.en ? " <span class='chip accent'>" + esc(hit.en) + "</span>" : "") +
            "<div class='md'>" + md(hit.def) + "</div>" +
            (hit.where ? "<div class='note-line'>→ 出现在：" + esc(hit.where) + "</div>" : "") + "</div>";
          return;
        }
        // 模糊匹配：底表里包含这个片段的词
        var like = B.list.filter(function (x) { return x.term.indexOf(q) >= 0 || x.en.toLowerCase().indexOf(q.toLowerCase()) >= 0; }).slice(0, 12);
        out.innerHTML = like.length
          ? "<div class='note-line'>没有完全匹配，相近的条目：</div>" + like.map(function (x) {
              return "<div class='term-hit'><b>" + esc(x.term) + "</b>" +
                (x.en ? " <span class='chip accent'>" + esc(x.en) + "</span>" : "") +
                "<div class='md'>" + md(x.def) + "</div></div>";
            }).join("")
          : "<div class='note-line'>底表里没有找到「" + esc(q) + "」。可以到 <a href='#/glossary'>完整术语表</a> 或直接搜索全站（按 / 键）。</div>";
      }
      input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); search(); } });
      input.addEventListener("input", function () { if (input.value.trim().length >= 2) search(); });
    }, 0);

    dlg.addEventListener("close", function () { dlg.remove(); });
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
  }

  /**
   * 把一段正文里的已知术语标成可点击的小标签。
   * @param html 已经过 MD.md 渲染的 HTML
   * @param onlyFirst true = 每个术语只标第一次出现（默认，避免满页下划线）
   */
  function autoGloss(html, onlyFirst) {
    if (!html || html.indexOf("<") >= 0 && !/[<][a-z]/i.test(html)) return html;
    var B = buildTermBank();
    var terms = B.list.filter(function (x) { return x.term.length >= 3; });
    if (!terms.length) return html;
    var done = {};
    // 只在标签之外的文本上替换
    return html.split(/(<[^>]*>)/).map(function (seg) {
      if (!seg || seg.charAt(0) === "<") return seg;
      terms.forEach(function (info) {
        var t = info.term;
        if (onlyFirst !== false && done[t]) return;
        if (seg.indexOf(t) < 0) return;
        var re = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\ /g, "\\s*"), "g");
        seg = seg.replace(re, function (m) {
          if (onlyFirst !== false && done[t]) return m;
          done[t] = 1;
          return "<span class='term' data-term='" + MD.escapeHtml(t) + "' title='点击查看解释'>" + m + "</span>";
        });
      });
      return seg;
    }).join("");
  }
  function glossEnabled() { return getPref("gloss") === true; }
  /** 渲染正文后按需自动标注 + 统一绑定点击 */
  function glossInto(root) {
    if (!root) return;
    if (glossEnabled()) {
      Array.prototype.forEach.call(root.querySelectorAll(".md"), function (n) {
        n.innerHTML = autoGloss(n.innerHTML, true);
      });
    }
    if (!root.dataset || root.dataset.glossBound) return;
    if (root.dataset) root.dataset.glossBound = "1";
    root.addEventListener("click", function (e) {
      var t = e.target.closest("[data-term]");
      if (!t) return;
      e.preventDefault();
      showTermInfo(t.dataset.term || t.textContent);
    });
  }

  /* ============================================================== 主题 */
  function applyTheme(t) {
    document.documentElement.dataset.theme = t === "light" ? "light" : "dark";
    setPref("theme", t);
  }
  applyTheme(getPref("theme") || "dark");

  /* ============================================================ 侧边栏 */
  function navRow(route, html, cls) {
    var a = el("a", "nav-item" + (cls ? " " + cls : ""), html);
    a.setAttribute("href", route);
    a.dataset.route = route;
    return a;
  }
  function buildSidebar() {
    var nav = $("#nav");
    if (!nav) return;
    nav.innerHTML = "";
    nav.appendChild(navRow("#/", "<span class='ico'>🏠</span><span class='nm'>学习总览</span>"));

    var cst = cardStats();
    var g = globalStat();
    nav.appendChild(el("div", "nav-group", "训练工具"));
    nav.appendChild(navRow("#/flashcards", "<span class='ico'>🃏</span><span class='nm'>闪卡复习</span><span class='pct'>" + (cst.due ? cst.due : "") + "</span>"));
    nav.appendChild(navRow("#/arguments", "<span class='ico'>🧩</span><span class='nm'>论证重构</span>"));
    nav.appendChild(navRow("#/writing", "<span class='ico'>✍️</span><span class='nm'>写作训练</span>"));
    nav.appendChild(navRow("#/reading", "<span class='ico'>📚</span><span class='nm'>精读轨迹</span>" + (readingPlans.length ? "<span class='pct'>" + readingPlans.length + "</span>" : "")));
    nav.appendChild(navRow("#/review", "<span class='ico'>🔁</span><span class='nm'>错题复习</span>"));
    nav.appendChild(navRow("#/notebook", "<span class='ico'>📕</span><span class='nm'>错题本</span><span class='pct' id='nbCount'>" + (g.mistakes ? "(" + g.mistakes + ")" : "") + "</span>"));
    nav.appendChild(navRow("#/glossary", "<span class='ico'>📖</span><span class='nm'>术语表</span>"));
    nav.appendChild(navRow("#/progress", "<span class='ico'>📊</span><span class='nm'>学习报告</span>"));

    var terms = {};
    courses.forEach(function (c) { (terms[c.term] = terms[c.term] || []).push(c); });
    Object.keys(terms).sort(function (a, b) { return termRank(a) - termRank(b); }).forEach(function (term) {
      nav.appendChild(el("div", "nav-group", esc(term)));
      terms[term].forEach(function (c) {
        var st = courseStat(c);
        nav.appendChild(navRow("#/c/" + c.id,
          "<span class='ico'>" + c.icon + "</span><span class='nm'>" + esc(c.title) + "</span><span class='pct'>" + st.pct + "%</span>"));
        var h = location.hash || "";
        if (h.indexOf("#/c/" + c.id + "/") === 0 || h === "#/c/" + c.id) {
          var sub = el("div", "nav-sub");
          (c.lessons || []).forEach(function (l, i) {
            var stt = lessonState(l.id);
            sub.appendChild(navRow("#/c/" + c.id + "/" + l.id,
              "<span class='dot " + (stt === "done" ? "done" : stt === "read" ? "part" : "") + "'></span><span class='nm'>" + (i + 1) + ". " + esc(l.title) + "</span>"));
          });
          nav.appendChild(sub);
        }
      });
    });

    var ring = $("#ringFg");
    if (ring) ring.setAttribute("stroke-dashoffset", String(113 - (113 * g.pct) / 100));
    var rp = $("#ringPct");
    if (rp) rp.textContent = g.pct + "%";
  }
  function bindSidebarNav() {
    var nav = $("#nav");
    nav.addEventListener("click", function (e) {
      var row = e.target.closest(".nav-item");
      if (!row || !nav.contains(row)) return;
      var route = row.dataset.route;
      if (!route) return;
      e.preventDefault();
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
  function setCrumbs(items) {
    var c = $("#crumbs");
    c.innerHTML = "";
    items.forEach(function (it, i) {
      if (i) c.appendChild(el("span", null, "›"));
      if (it.route) { var a = el("a", null, esc(it.text)); a.href = it.route; c.appendChild(a); }
      else c.appendChild(el("b", null, esc(it.text)));
    });
  }

  /* ================================================== 组件：闪卡复习器 */
  /**
   * 闪卡复习器。ops = { scope, cards:[{card,lesson,course}], onGrade(card,grade) }
   * 卡片正面 -> 点「显示答案」-> 背面 -> 四档自评。
   */
  function renderFlashcards(host, ops) {
    var queue = (ops.cards || []).slice();
    var i = 0, done = 0, again = 0;
    var box = el("div", "fc-box");
    host.appendChild(box);

    function head() {
      var h = el("div", "review-bar");
      h.appendChild(el("span", "chip accent", "第 " + Math.min(i + 1, queue.length) + " / " + queue.length + " 张"));
      h.appendChild(el("span", "chip", "已评 " + done + " 张"));
      if (again) h.appendChild(el("span", "chip warn", "需重来 " + again + " 张"));
      return h;
    }
    function draw() {
      box.innerHTML = "";
      if (i >= queue.length) {
        var fin = el("div", "block concept");
        fin.innerHTML = "<h3>本轮完成 🎉 <span class='tag'>复习小结</span></h3><div class='md'>" +
          md("本轮共评 **" + done + "** 张卡片，其中标记为「完全不会」的有 **" + again + "** 张（它们会在 10 分钟后重新到期）。\n\n" +
            "间隔重复的要点不是一次记住，而是**在快要忘记时复习**：所以「模糊」是正常且有用的信号，不要为了好看而都选「记得」。") + "</div>";
        var bar = el("div", "review-bar");
        var b1 = el("button", "btn primary", "↻ 再抽一轮");
        b1.addEventListener("click", function () { navigate("#/flashcards"); render(); });
        var b2 = el("button", "btn ghost", "📊 看学习报告");
        b2.addEventListener("click", function () { navigate("#/progress"); });
        bar.appendChild(b1); bar.appendChild(b2);
        fin.appendChild(bar);
        box.appendChild(fin);
        return;
      }
      var item = queue[i];
      box.appendChild(head());
      var src = el("div", "fc-src", esc(item.course.title + " · " + item.lesson.title) +
        (item.card.kind ? " <span class='chip'>" + esc(CARD_KIND[item.card.kind] || item.card.kind) + "</span>" : ""));
      box.appendChild(src);

      var card = el("div", "fc-card");
      card.appendChild(el("div", "fc-front", md(item.card.front)));
      box.appendChild(card);

      var back = el("div", "fc-back hidden");
      back.innerHTML = "<div class='note-line'>答案与解释</div><div class='md'>" + md(item.card.back) + "</div>" +
        (item.card.where && lessonIndex[item.card.where] ?
          "<div class='note-line'>→ 出自：<a href='#/c/" + lessonIndex[item.card.where].course.id + "/" + item.card.where + "'>" +
          esc(lessonIndex[item.card.where].lesson.title) + "</a></div>" : "");
      box.appendChild(back);

      var hint = el("div", "lab-note hidden", esc(item.card.hint || ""));
      if (item.card.hint) box.appendChild(hint);

      var bar = el("div", "review-bar");
      var bShow = el("button", "btn primary", "👁 显示答案");
      var bHint = null;
      if (item.card.hint) {
        bHint = el("button", "btn sm ghost", "💡 提示");
        bHint.addEventListener("click", function () { hint.classList.toggle("hidden"); });
      }
      bShow.addEventListener("click", function () {
        back.classList.remove("hidden");
        bShow.style.display = "none";
        if (bHint) bHint.style.display = "none";
        gradeBar.classList.remove("hidden");
        gradeBar.scrollIntoView({ block: "nearest" });
      });
      bar.appendChild(bShow);
      if (bHint) bar.appendChild(bHint);
      box.appendChild(bar);

      var gradeBar = el("div", "review-bar fc-grade hidden");
      [["完全不会", 0, "bad"], ["模糊", 1, "warn"], ["记得", 2, ""], ["太简单", 3, "ok"]].forEach(function (g) {
        var b = el("button", "btn " + (g[2] === "ok" ? "ok" : g[2] === "bad" ? "bad" : ""), g[0]);
        b.addEventListener("click", function () {
          gradeCard(item.card.id, g[1]);
          if (g[1] === 0) { again++; queue.push(item); }   // 完全不会 -> 本轮末尾再来一次
          done++;
          if (ops.onGrade) ops.onGrade(item.card, g[1]);
          i++;
          draw();
        });
        gradeBar.appendChild(b);
      });
      box.appendChild(gradeBar);
    }
    draw();
  }
  var CARD_KIND = { term: "术语", argument: "论证", figure: "人物", position: "立场" };

  /* ============================================== 组件：论证重构练习 */
  var ROLE_LABEL = { premise: "前提", conclusion: "结论", noise: "无关" };
  function renderArg(host, arg, ops) {
    ops = ops || {};
    var box = el("div", "arg-box");
    host.appendChild(box);
    var lines = arg.lines || [];
    var orders = [["premise", "前提"], ["conclusion", "结论"], ["noise", "无关"]];
    var pick = new Array(lines.length).fill(null);
    var locked = false;

    box.appendChild(el("div", "arg-title", "🧩 " + esc(arg.title || "论证重构")));
    if (arg.source) box.appendChild(el("div", "arg-src", "出处：" + esc(arg.source)));
    box.appendChild(el("div", "note-line", "给下面每一句指派角色：它是**前提**、**结论**，还是与论证无关的**干扰句**？先自己判断，再点「检查」。"));
    if (arg.hint) box.appendChild(el("div", "lab-note", "💡 " + esc(arg.hint)));

    var list = el("div", "arg-lines");
    lines.forEach(function (ln, li) {
      var row = el("div", "arg-line");
      row.appendChild(el("div", "txt", md(ln.t == null ? "" : String(ln.t) + (String(ln.t).match(/[。！？.!?]$/) ? "" : "。"))));
      var roles = el("div", "arg-roles");
      orders.forEach(function (o) {
        var b = el("button", "role-btn", o[1]);
        b.addEventListener("click", function () {
          if (locked) return;
          pick[li] = o[0];
          Array.prototype.forEach.call(roles.querySelectorAll(".role-btn"), function (x) { x.classList.remove("on"); });
          b.classList.add("on");
        });
        roles.appendChild(b);
      });
      row.appendChild(roles);
      list.appendChild(row);
    });
    box.appendChild(list);

    var out = el("div", "arg-out hidden");
    box.appendChild(out);
    var bar = el("div", "review-bar");
    var bCheck = el("button", "btn primary", "检查我的重构");
    var bRetry = el("button", "btn ghost", "重做");
    bRetry.style.display = "none";
    bCheck.addEventListener("click", function () {
      if (locked) return;
      if (pick.indexOf(null) >= 0) { toast("还有句子没有指派角色", "bad"); return; }
      locked = true;
      var right = 0;
      Array.prototype.forEach.call(list.querySelectorAll(".arg-line"), function (row, li) {
        var ok = pick[li] === lines[li].role;
        if (ok) right++;
        row.classList.add(ok ? "ok" : "no");
        var fb = el("div", "arg-fb", (ok ? "✓ " : "✗ ") + "正确角色：" + ROLE_LABEL[lines[li].role] +
          (ok ? "" : "（你选了" + ROLE_LABEL[pick[li]] + "）"));
        row.appendChild(fb);
      });
      var total = lines.length;
      out.classList.remove("hidden");
      out.innerHTML =
        "<div class='res-line'><b>角色判定：" + right + " / " + total + "</b>" +
        (right === total ? " ✓ 完全正确" : " —— 回到原文，想想哪一句其实不承担论证功能") + "</div>" +
        (arg.form ? "<div class='md'><b>形式化</b>：" + md(arg.form) + "</div>" : "") +
        (arg.scheme ? "<div class='md'><b>论证形式</b>：" + md(arg.scheme) + "</div>" : "") +
        "<div class='md'><b>形式是否有效</b>：" + (arg.valid ? "有效（valid）——若前提全真，结论必真" : "无效（invalid）——即使前提全真，结论也可能假") + "</div>" +
        "<div class='md'><b>是否可靠</b>：" + (arg.sound ? "可靠（sound）= 有效 + 前提全真" : "不可靠（unsound）") + "</div>" +
        (arg.gap ? "<div class='md'><b>关键缺口</b>：" + md(arg.gap) + "</div>" : "");
      bCheck.style.display = "none";
      bRetry.style.display = "";
      var rec = state.args[arg.id] || { attempts: 0, correct: 0, done: false };
      rec.attempts++; rec.done = true;
      if (right === total) rec.correct++;
      rec.updated = Date.now();
      state.args[arg.id] = rec;
      addXP(right === total ? 12 : 5);
      if (ops.onDone) ops.onDone(arg, right, total);
      out.scrollIntoView({ block: "nearest" });
    });
    bRetry.addEventListener("click", function () {
      locked = false; pick = new Array(lines.length).fill(null);
      Array.prototype.forEach.call(list.querySelectorAll(".arg-line"), function (row) {
        row.classList.remove("ok", "no");
        var fb = row.querySelector(".arg-fb"); if (fb) fb.remove();
        Array.prototype.forEach.call(row.querySelectorAll(".role-btn"), function (x) { x.classList.remove("on"); });
      });
      out.classList.add("hidden"); out.innerHTML = "";
      bCheck.style.display = ""; bRetry.style.display = "none";
    });
    bar.appendChild(bCheck); bar.appendChild(bRetry);
    box.appendChild(bar);
    var st = state.args[arg.id];
    if (st && st.done) box.appendChild(el("div", "note-line", "历史记录：做过 " + st.attempts + " 次，完全正确 " + st.correct + " 次"));
  }

  /* ============================================== 组件：写作训练 */
  function renderWriting(host, w, ops) {
    ops = ops || {};
    var box = el("div", "writing-box");
    host.appendChild(box);
    box.appendChild(el("div", "wr-title", "✍️ " + esc(w.title || "写作训练")));
    box.appendChild(el("div", "md wr-prompt", md(w.prompt || "")));

    if ((w.considerations || []).length) {
      var c = el("div", "block steps");
      c.style.margin = "12px 0";
      c.appendChild(el("h3", null, "动笔前必须想清的问题 <span class='tag'>构思</span>"));
      var ol = el("ol", "steps-list");
      all(w.considerations, function (s) { ol.appendChild(el("li", null, md(s))); });
      c.appendChild(ol);
      box.appendChild(c);
    }
    if ((w.outline || []).length) {
      var ob = el("div", "block concept");
      ob.style.margin = "12px 0";
      ob.appendChild(el("h3", null, "建议结构 <span class='tag'>提纲</span>"));
      var ol2 = el("ol", "steps-list");
      all(w.outline, function (s) {
        ol2.appendChild(el("li", null, "<b>" + md(s.s || "") + "</b>" + (s.d ? "<div class='md'>" + md(s.d) + "</div>" : "")));
      });
      ob.appendChild(ol2);
      box.appendChild(ob);
    }

    var rec = state.writing[w.id] || { text: "", rubric: {}, updated: 0 };
    var ta = el("textarea", "wr-area");
    ta.placeholder = "在这里写。写作是本站唯一无法自动判分的部分——但 Rubric 和范例能帮你自查。";
    ta.value = rec.text || "";
    var count = el("div", "note-line wr-count", "");
    function refreshCount() {
      var s = ta.value.replace(/\s/g, "");
      count.textContent = "当前 " + s.length + " 字";
    }
    var saveT = null;
    ta.addEventListener("input", function () {
      refreshCount();
      clearTimeout(saveT);
      saveT = setTimeout(function () {
        var r = state.writing[w.id] || { text: "", rubric: {}, updated: 0 };
        r.text = ta.value; r.words = ta.value.replace(/\s/g, "").length; r.updated = Date.now();
        state.writing[w.id] = r; save();
      }, 600);
    });
    box.appendChild(ta);
    box.appendChild(count);
    refreshCount();

    if ((w.rubric || []).length) {
      var rb = el("div", "block concept");
      rb.style.margin = "12px 0";
      rb.appendChild(el("h3", null, "自查评分表（Rubric） <span class='tag'>写完逐条打分</span>"));
      var tb = el("table", "rubric");
      tb.innerHTML = "<thead><tr><th>评分项</th><th>权重</th><th>达标标准</th><th>自评</th></tr></thead>";
      var tbody = el("tbody");
      all(w.rubric, function (r) {
        var tr = el("tr");
        tr.innerHTML = "<td><b>" + md(r.k || "") + "</b></td><td>" + txt(r.w || "") + "</td><td>" + md(r.d || "") + "</td>";
        var td = el("td");
        var cb = el("input");
        cb.type = "checkbox";
        cb.checked = !!(rec.rubric && rec.rubric[r.k]);
        cb.addEventListener("change", function () {
          var rr = state.writing[w.id] || { text: ta.value, rubric: {}, updated: 0 };
          rr.rubric = rr.rubric || {};
          rr.rubric[r.k] = cb.checked;
          rr.text = ta.value; rr.updated = Date.now();
          state.writing[w.id] = rr; save();
          updScore();
          if (cb.checked) addXP(2);
        });
        td.appendChild(cb);
        tr.appendChild(td);
        tbody.appendChild(tr);
      });
      tb.appendChild(tbody);
      rb.appendChild(tb);
      var scoreLine = el("div", "lab-stat", "");
      rb.appendChild(scoreLine);
      function updScore() {
        var got = 0;
        all(w.rubric, function (r) {
          var cur = state.writing[w.id];
          if (cur && cur.rubric && cur.rubric[r.k]) got += parseFloat(String(r.w || "0")) || 0;
        });
        scoreLine.textContent = "按自查表得分：" + Math.round(got) + " / 100";
      }
      updScore();
      box.appendChild(rb);
    }

    if ((w.pitfalls || []).length) {
      var pb = el("div", "block pitfall");
      pb.style.margin = "12px 0";
      pb.appendChild(el("h3", null, "常见失分点 <span class='tag'>易错点</span>"));
      var ul = el("ul");
      all(w.pitfalls, function (p) { ul.appendChild(el("li", null, md(p))); });
      pb.appendChild(ul);
      box.appendChild(pb);
    }

    if (w.sample) {
      var sb = el("div", "block analogy");
      sb.style.margin = "12px 0";
      sb.appendChild(el("h3", null, "范例片段 <span class='tag'>注意：这是范例，不是标准答案</span>"));
      sb.appendChild(el("div", "md", md(w.sample)));
      box.appendChild(sb);
    }
    var foot = el("div", "note-line", "你的草稿会自动保存在本浏览器；可在右上角「💾 数据」里导出备份。");
    box.appendChild(foot);
  }

  /* ============================================== 组件：苏格拉底式提问 */
  function renderSocratic(host, block) {
    var box = el("div", "soc-box");
    host.appendChild(box);
    var turns = {};
    all(block.turns, function (t) { turns[t.id] = t; });

    box.appendChild(el("div", "soc-opening", "🧔 情境：" + esc(block.opening || "")));
    var log = el("div", "soc-log");
    box.appendChild(log);
    var closed = false;
    var asked = 0;

    function socraticSay(text, cls) {
      var d = el("div", "soc-msg soc-q " + (cls || ""), "<span class='who'>苏格拉底</span><div class='md'>" + md(text) + "</div>");
      log.appendChild(d);
      d.scrollIntoView({ block: "nearest" });
    }
    function youSay(text, cls) {
      var d = el("div", "soc-msg soc-a " + (cls || ""), "<span class='who'>你</span><div class='md'>" + md(text) + "</div>");
      log.appendChild(d);
      d.scrollIntoView({ block: "nearest" });
    }

    function showTurn(id) {
      var t = turns[id];
      if (!t) { finish(); return; }
      asked++;
      var wrap = el("div", "soc-turn");
      wrap.appendChild(el("div", "soc-msg soc-q", "<span class='who'>苏格拉底</span><div class='md'>" + md(t.prompt) + "</div>"));
      if (t.note) wrap.appendChild(el("div", "lab-note", "这一问在练：" + esc(t.note)));
      var opts = el("div", "soc-opts");
      all(t.options, function (o) {
        var b = el("button", "soc-opt", md(o.t));
        b.addEventListener("click", function () {
          Array.prototype.forEach.call(opts.querySelectorAll(".soc-opt"), function (x) { x.disabled = true; });
          b.classList.add("picked");
          youSay(o.t);
          var cls = o.verdict === "good" ? "ok" : o.verdict === "weak" ? "warn" : "bad";
          var label = o.verdict === "good" ? "✓ 这个回答站得住" : o.verdict === "weak" ? "△ 有漏洞，但不算错" : "✗ 这个回答有明显问题";
          socraticSay("<b>" + label + "</b>　" + (o.reply || ""), cls);
          wrap.remove();
          addXP(o.verdict === "good" ? 8 : 3);
          if (o.next) showTurn(o.next); else finish();
        });
        opts.appendChild(b);
      });
      wrap.appendChild(opts);
      log.appendChild(wrap);
      wrap.scrollIntoView({ block: "nearest" });
    }
    function finish() {
      if (closed) return;
      closed = true;
      var f = el("div", "soc-end",
        "<b>阶段性结论</b>：苏格拉底式提问的目的不是让你认输，而是让你把「你以为自己知道的东西」变成" +
        "「你能为之给出理由的东西」。如果你在上面某个回答里卡住了，回到本讲的 <b>论证重构</b> 与 <b>精读</b> 两节，" +
        "把理由的链条补上——这就是哲学训练的日常。");
      log.appendChild(f);
      addXP(10);
    }
    showTurn(block.turns && block.turns[0] ? block.turns[0].id : null);
  }

  /* ============================================== 组件：原著精读 */
  function renderClose(host, b) {
    var box = el("div", "close-box");
    host.appendChild(box);
    var meta = el("div", "close-meta",
      "<span class='chip accent'>" + esc(b.author || "") + "</span>" +
      "<span class='chip'>" + esc(b.work || "") + "</span>");
    box.appendChild(meta);
    if (!b.annotations || !b.annotations.length) {
      box.appendChild(el("div", "close-passage", md(b.passage || "")));
      if (b.note) box.appendChild(el("div", "lab-note", esc(b.note)));
      return;
    }
    // 用行内标记把注释高亮出来：把 annotation.line 在 passage 中首次出现的位置包起来
    var html = esc(b.passage || "");
    var marks = [];
    all(b.annotations, function (a, ai) {
      var line = a.line || "";
      if (!line) return;
      var idx = html.indexOf(esc(line));
      if (idx < 0) return;                        // 校验器已保证一致，这里做防御
      if (marks.some(function (m) { return idx >= m.s && idx < m.e; })) return;  // 重叠则跳过
      var token = "\u0001" + marks.length + "\u0001";
      marks.push({ s: idx, e: idx + esc(line).length, a: a, ai: ai });
      html = html.slice(0, idx) + token + html.slice(idx + esc(line).length);
    });
    marks.forEach(function (m, mi) {
      var tag = "<mark class='ann' data-ann='" + mi + "'>" + esc(m.a.line) + "</mark>";
      html = html.replace("\u0001" + mi + "\u0001", tag);
    });
    html = html.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>");
    box.appendChild(el("p", "close-passage", html));
    box.appendChild(el("div", "note-line", "点击正文中的高亮部分，查看注释。"));
    if (b.note) box.appendChild(el("div", "lab-note", esc(b.note)));

    var annBox = el("div", "ann-box");
    box.appendChild(annBox);
    var notes = el("div", "ann-notes hidden");
    box.appendChild(notes);
    all(marks, function (m, mi) {
      notes.appendChild(el("div", "ann-note", "<b>注释 " + (mi + 1) + "</b>　" + md(m.a.note || "")));
    });
    annBox.addEventListener("click", function (e) {
      var mk = e.target.closest("mark.ann");
      if (!mk) return;
      var idx = Number(mk.dataset.ann);
      Array.prototype.forEach.call(annBox.querySelectorAll("mark.ann"), function (x) { x.classList.remove("on"); });
      mk.classList.add("on");
      notes.classList.remove("hidden");
      var target = notes.querySelectorAll(".ann-note")[idx];
      Array.prototype.forEach.call(notes.querySelectorAll(".ann-note"), function (x) { x.classList.remove("on"); });
      if (target) { target.classList.add("on"); target.scrollIntoView({ block: "nearest" }); }
    });

    if ((b.questions || []).length) {
      var qb = el("div", "block steps");
      qb.style.margin = "14px 0 0";
      qb.appendChild(el("h3", null, "回到文本 <span class='tag'>精读追问</span>"));
      var ol = el("ol", "steps-list");
      all(b.questions, function (q) { ol.appendChild(el("li", null, md(q))); });
      qb.appendChild(ol);
      box.appendChild(qb);
    }
  }

  /* ==================================================== 块渲染 */
  var TAG_MAP = {
    concept: "核心讲解", steps: "步骤", analogy: "类比", pitfall: "易错点",
    calc: "推演演练", interactive: "交互推演", lab: "动手实验",
    close: "原著精读", socratic: "苏格拉底式提问", writing: "写作训练", code: "形式化"
  };
  function renderBlock(b) {
    var type = b.type;
    var box = el("div", "block " + type);
    var tag = TAG_MAP[type] ? " <span class='tag'>" + TAG_MAP[type] + "</span>" : "";
    var icon = type === "interactive" ? "🧪 " : type === "close" ? "📜 " : type === "socratic" ? "🧔 " : type === "writing" ? "✍️ " : "";

    if (type === "close") {
      box.appendChild(el("h3", null, icon + esc(b.title || "原著精读") + tag));
      renderClose(box, b);
      return box;
    }
    if (type === "socratic") {
      box.appendChild(el("h3", null, icon + esc(b.title || "苏格拉底式提问") + tag));
      renderSocratic(box, b);
      return box;
    }
    if (type === "writing") {
      box.appendChild(el("h3", null, icon + esc(b.title || "写作训练") + tag));
      renderWriting(box, b, {});
      return box;
    }

    box.appendChild(el("h3", null, icon + esc(b.title || TAG_MAP[type] || type) + tag));

    if (type === "interactive") {
      var host = el("div");
      box.appendChild(host);
      if (b.config && b.config.tasks && b.config.tasks.length) {
        var tl = el("div", "block steps");
        tl.style.margin = "14px 0 0";
        tl.appendChild(el("h3", null, "✅ 动手任务"));
        var ul = el("ol", "steps-list");
        all(b.config.tasks, function (t) {
          var ttl = typeof t === "string" ? t : (t.t || "");
          var hint = typeof t === "object" && t.hint ? "<div class='note-line'>提示：" + esc(t.hint) + "</div>" : "";
          var check = typeof t === "object" && t.check ? "<div class='note-line'>达成标准：" + esc(t.check) + "</div>" : "";
          ul.appendChild(el("li", null, "<b>" + md(ttl) + "</b>" + hint + check));
        });
        tl.appendChild(ul);
        box.appendChild(tl);
      }
      requestAnimationFrame(function () {
        try { LABS.render(host, b, { onInteract: function () { } }); }
        catch (e) { host.innerHTML = "<div class='empty'>推演器渲染失败：" + esc(String((e && e.message) || e)) + "</div>"; }
      });
      return box;
    }

    if (type === "concept" || type === "analogy") {
      box.appendChild(el("div", "md", md(b.md || "")));
    } else if (type === "steps") {
      var ol = el("ol", "steps-list");
      all(b.items, function (it) {
        if (typeof it === "string") ol.appendChild(el("li", null, md(it)));
        else ol.appendChild(el("li", null, "<b>" + md(it.t || "") + "</b>" + (it.d ? "<div class='md'>" + md(it.d) + "</div>" : "")));
      });
      box.appendChild(ol);
      if (b.note) box.appendChild(el("div", "lab-note", esc(b.note)));
    } else if (type === "pitfall") {
      var ul2 = el("ul");
      all(b.items, function (it) {
        ul2.appendChild(el("li", null, md(typeof it === "string" ? it : ((it.t || "") + "：" + (it.d || "")))));
      });
      box.appendChild(ul2);
      if (b.note) box.appendChild(el("div", "lab-note", esc(b.note)));
    } else if (type === "lab") {
      var ol3 = el("ol", "steps-list");
      all(b.steps, function (s) {
        ol3.appendChild(el("li", null, md(typeof s === "string" ? s : ((s.t || "") + (s.d ? "：" + s.d : "")))));
      });
      box.appendChild(ol3);
      if (b.note) box.appendChild(el("div", "lab-note", esc(b.note)));
    } else if (type === "code") {
      var hd = el("div", "code-hd");
      hd.appendChild(el("span", "lang", esc(b.lang || "text")));
      var bc = el("button", "btn sm ghost", "复制");
      bc.addEventListener("click", function () {
        if (navigator.clipboard) navigator.clipboard.writeText(b.code || "").then(function () { toast("已复制", "ok"); });
        else toast("当前环境不支持剪贴板", "bad");
      });
      hd.appendChild(bc);
      box.appendChild(hd);
      var pre = el("pre", "code");
      pre.innerHTML = "<code>" + MD.highlight(b.code || "", b.lang || "text") + "</code>";
      box.appendChild(pre);
    } else if (type === "calc") {
      box.appendChild(el("div", "note-line", "已知条件"));
      var g = el("div", "calc-grid");
      all(b.inputs, function (it) { g.appendChild(el("div", "calc-item", "<div class='k'>" + esc(it.name) + "</div><div class='v'>" + esc(it.value) + "</div>")); });
      box.appendChild(g);
      var out = el("div", "calc-out hidden");
      out.appendChild(el("div", "note-line", "参考推演（先自己写一遍再看）"));
      var og = el("div", "calc-grid");
      all(b.outputs, function (o, i) {
        og.appendChild(el("div", "calc-item", "<div class='k'>第 " + (i + 1) + " 步</div><div class='v'>" + md(o) + "</div>"));
      });
      out.appendChild(og);
      var br = el("button", "btn sm", "👁 显示参考答案");
      br.addEventListener("click", function () {
        var hidden = out.classList.toggle("hidden");
        br.textContent = hidden ? "👁 显示参考答案" : "🙈 隐藏参考答案";
      });
      box.appendChild(br);
      box.appendChild(out);
      if (b.note) box.appendChild(el("div", "lab-note", esc(b.note)));
    } else {
      box.appendChild(el("div", "md", md(b.md || "")));
    }
    return box;
  }

  /* ==================================================== 页面：总览 */
  function pageHome() {
    var c = $("#content"); c.innerHTML = "";
    var g = globalStat();
    var wrap = el("div", "wrap");
    wrap.appendChild(el("h1", "page-title", "哲学本科 · 互动学习总览"));
    wrap.appendChild(el("p", "lead",
      "共 " + courses.length + " 门课、" + g.lessons + " 讲，含 " + g.cards + " 张间隔重复闪卡、" +
      g.args + " 组论证重构、" + g.writing + " 个写作训练与 " + g.quiz + " 道随堂测验题。" +
      "全部内容离线可用，学习进度只存在你自己的浏览器里。"));

    var stats = el("div", "stat-grid");
    function stat(n, l) { stats.appendChild(el("div", "stat", "<div class='n'>" + n + "</div><div class='l'>" + l + "</div>")); }
    stat(g.pct + "%", "整体完成度（" + g.done + "/" + g.lessons + " 讲已掌握）");
    stat(g.attempted ? g.accuracy + "%" : "—", "测验正确率（作答 " + g.attempted + " 题）");
    stat(String(g.streak) + " 天", "连续学习（只记连续性，不记时长）");
    stat("Lv." + g.level, "训练等级（" + g.xp + " XP）");
    stat(String(g.mistakes), "待复习错题");
    wrap.appendChild(stats);

    var bar = el("div", "review-bar");
    var last = getPref("lastLesson");
    if (last && lessonIndex[last]) {
      var info = lessonIndex[last];
      var b = el("button", "btn primary", "▶ 继续学习：" + info.lesson.title);
      b.addEventListener("click", function () { navigate("#/c/" + info.course.id + "/" + info.lesson.id); });
      bar.appendChild(b);
    } else {
      var first = courses.filter(function (x) { return (x.lessons || []).length; })[0];
      if (first) {
        var b0 = el("button", "btn primary", "▶ 从第一讲开始：" + first.lessons[0].title);
        b0.addEventListener("click", function () { navigate("#/c/" + first.id + "/" + first.lessons[0].id); });
        bar.appendChild(b0);
      }
    }
    var cst = cardStats();
    var bf = el("button", "btn " + (cst.due ? "ok" : "ghost"), "🃏 闪卡复习" + (cst.due ? "（" + cst.due + " 张到期）" : "（今日已清）"));
    bf.addEventListener("click", function () { navigate("#/flashcards"); });
    bar.appendChild(bf);
    var ba = el("button", "btn ghost", "🧩 做一组论证重构");
    ba.addEventListener("click", function () { navigate("#/arguments"); });
    bar.appendChild(ba);
    var weak = weakLessons(1)[0];
    if (weak) {
      var b2 = el("button", "btn", "🎯 攻克最弱一讲：" + weak.lesson.title);
      b2.addEventListener("click", function () { navigate("#/c/" + weak.course.id + "/" + weak.lesson.id); });
      bar.appendChild(b2);
    }
    wrap.appendChild(bar);

    var starter = el("div", "block concept starter-banner");
    starter.innerHTML = "<h3>🌱 没有哲学基础？按这个顺序开始 <span class='tag'>推荐路线</span></h3>" +
      md("**第 1 步｜打地基（3 门，约 15 讲）**\n" +
        "1. **哲学导论**：哲学问题长什么样 + 读原著、拆论证、写论文三件基本功。\n" +
        "2. **逻辑工具**：哲学不是感想，是论证。这门课给你评估论证的工具，后面每门课都要用。\n" +
        "3. 想先读中国线的话，从这里接 **中国哲学（先秦诸子到宋明理学）**。\n" +
        "\n**第 2 步｜走历史线（西方，4 门）**\n" +
        "**古希腊** → **中世纪与德国古典** → **近代** → **当代哲学**。按时间走一遍，你才知道今天的问题是从哪儿来的。\n" +
        "\n**第 3 步｜进问题线（4 门，顺序可调）**\n" +
        "**认识论**（我凭什么说我\"知道\"）｜**形而上学**（究竟有什么存在）｜" +
        "**伦理学**（应当如何行动）｜**政治哲学**（权力与正义）｜**马克思主义哲学**（实践、历史与解放）。\n" +
        "\n**第 4 步｜专题**\n" +
        "**美学与艺术哲学** ｜ **佛教哲学与中国哲学的后续**（接中国线：魏晋玄学、佛教、明清之际、现代新儒家）。\n" +
        "\n> 本课程**不设时间表**：没有「预计多久」，也没有「几周读完」。只对一件事有要求——" +
        "**每一讲都要自己写出理由**（做论证重构、答苏格拉底追问、写完写作训练）。\n" +
        "> 宁可一讲读三天，也不要一天刷完五讲。\n" +
        ">\n" +
        "> 遇到不认识的术语：打开顶栏 **🖍 生词标注**，正文里的已学术语会加虚线下划线，点一下即看解释。\n" +
        ">\n" +
        "> **想要学到很好的程度？** 走完上面的路线之后，去做 **📚 精读轨迹** 里的" +
        "「读哪些书 + 什么版本 + 什么顺序」。课程给地图与方法，深度只能来自把整本书读完、并被人反驳。");
    wrap.appendChild(starter);

    wrap.appendChild(el("h2", "sec", "课程地图"));
    var grid = el("div", "grid");
    courses.forEach(function (co) {
      var st = courseStat(co);
      var card = el("div", "card");
      card.innerHTML =
        "<div class='hd'><span class='ico'>" + co.icon + "</span><h3>" + esc(co.title) + "</h3></div>" +
        "<div class='blurb'>" + esc(co.blurb) + "</div>" +
        "<div class='bar'><i style='width:" + st.pct + "%'></i></div>" +
        "<div class='meta'><span class='chip'>" + esc(co.term) + "</span><span class='chip'>" + st.total + " 讲</span>" +
        "<span class='chip'>" + st.cards + " 闪卡</span><span class='chip'>" + st.quizTotal + " 题</span>" +
        (st.attempted ? "<span class='chip ok'>正确率 " + st.accuracy + "%</span>" : "") +
        "<span>" + st.pct + "%</span></div>";
      card.addEventListener("click", function () { navigate("#/c/" + co.id); });
      grid.appendChild(card);
    });
    wrap.appendChild(grid);

    wrap.appendChild(el("h2", "sec", "从课程走向真正的深度"));
    var deep = el("div", "block concept");
    deep.innerHTML = "<h3>📚 精读轨迹：读完课程之后读什么 <span class='tag'>" +
      (readingPlans.length ? readingPlans.length + " 条线" : "待补充") + "</span></h3>" +
      md("本站 14 门课 / 70 讲给你的是一张**问题地图**与一套**方法训练**（读原著、拆论证、写论文）。" +
        "但它替代不了真正的深度——那只能来自把整本书读完、并且被人反驳。\n\n" +
        "**精读轨迹**补的就是这一段：每条线给出读哪些书、什么顺序、什么难度分级、" +
        "推荐哪个中译本、以及每本书会在哪里卡住、卡住了先读哪本梯子书。\n\n" +
        "> 建议用法：**先把课程走一遍**拿到地图与方法，**再选一条轨迹死磕**，" +
        "同时进入真实的智识共同体（读书会、研讨、旁听、写作投稿）。");
    var rbar = el("div", "review-bar");
    var rb = el("button", "btn primary", "📚 打开精读轨迹");
    rb.addEventListener("click", function () { navigate("#/reading"); });
    rbar.appendChild(rb);
    readingPlans.forEach(function (p) {
      var b = el("button", "btn ghost", p.icon + " " + p.title);
      b.addEventListener("click", function () { navigate("#/reading/" + p.id); });
      rbar.appendChild(b);
    });
    deep.appendChild(rbar);
    wrap.appendChild(deep);

    wrap.appendChild(el("h2", "sec", "四种训练工具"));
    var tools = el("div", "grid");
    [
      ["🃏 闪卡复习", "术语、人物、论证、立场四类卡片，按 SM-2 间隔重复算法安排在你**快要忘记**的时候出现。每天先清空到期卡片。", "#/flashcards"],
      ["🧩 论证重构", "给你一段哲学原文，你来判定哪些是前提、哪个是结论、哪句是无关干扰；再对照形式化与「关键缺口」分析。这是哲学系最核心的硬技能。", "#/arguments"],
      ["🧔 苏格拉底式提问", "每讲都嵌有苏格拉底追问：你选择一个回答，程序立刻告诉你它站得住还是漏了哪一环，并继续追问。", "#/c/philo-intro"],
      ["✍️ 写作训练", "给题目 + 构思清单 + 建议结构 + 评分细则（Rubric）+ 范例片段。自己写、自己按细则打分。", "#/writing"]
    ].forEach(function (t) {
      var card = el("div", "card");
      card.innerHTML = "<div class='hd'><h3>" + t[0] + "</h3></div><div class='blurb'>" + t[1] + "</div>";
      card.addEventListener("click", function () { navigate(t[2]); });
      tools.appendChild(card);
    });
    wrap.appendChild(tools);
    c.appendChild(wrap);
  }

  /* ==================================================== 页面：课程 */
  function pageCourse(id) {
    var co = courses.filter(function (x) { return x.id === id; })[0];
    var c = $("#content"); c.innerHTML = "";
    if (!co) { c.appendChild(el("div", "empty", "找不到课程：" + esc(id))); return; }
    var st = courseStat(co);
    setCrumbs([{ text: "总览", route: "#/" }, { text: co.title }]);
    var wrap = el("div", "wrap");
    wrap.appendChild(el("h1", "page-title", co.icon + " " + esc(co.title)));
    wrap.appendChild(el("p", "lead", esc(co.blurb)));
    if (co.need) {
      var nb = el("div", "block concept pre-need");
      nb.innerHTML = "<h3>🎒 学这门课之前 <span class='tag'>前置知识</span></h3><div class='md'>" + md(co.need) + "</div>" +
        "<div class='note-line'>不确定基础够不够？先打开 <a href='#/glossary'>📖 术语表</a> 过一遍相关术语。</div>";
      wrap.appendChild(nb);
    }
    var meta = el("div", "review-bar");
    meta.appendChild(el("span", "chip accent", esc(co.term)));
    meta.appendChild(el("span", "chip", st.total + " 讲"));
    meta.appendChild(el("span", "chip", st.cards + " 张闪卡"));
    meta.appendChild(el("span", "chip", st.args + " 组论证重构"));
    meta.appendChild(el("span", "chip", st.quizTotal + " 道测验题"));
    all(co.tags, function (t) { meta.appendChild(el("span", "chip", esc(t))); });
    if (st.attempted) meta.appendChild(el("span", "chip ok", "正确率 " + st.accuracy + "%"));
    wrap.appendChild(meta);
    var bar = el("div", "bar");
    bar.innerHTML = "<i style='width:" + st.pct + "%'></i>";
    wrap.appendChild(bar);
    wrap.appendChild(el("div", "note-line", "完成度 " + st.pct + "% ｜ 已开始 " + st.read + " 讲 ｜ 已掌握 " + st.done + " 讲"));

    var tools = el("div", "review-bar");
    var cd = (co.lessons || []).reduce(function (n, l) { return n + (l.flashcards || []).filter(function (f) { return cardDue(f.id); }).length; }, 0);
    var bfc = el("button", "btn " + (cd ? "ok" : "ghost"), "🃏 复习本课闪卡" + (cd ? "（" + cd + " 张到期）" : ""));
    bfc.addEventListener("click", function () { navigate("#/flashcards/" + co.id); });
    tools.appendChild(bfc);
    var bargs = el("button", "btn ghost", "🧩 集中做本课论证重构");
    bargs.addEventListener("click", function () { navigate("#/arguments/" + co.id); });
    tools.appendChild(bargs);
    wrap.appendChild(tools);

    wrap.appendChild(el("h2", "sec", "课程目录"));
    var list = el("div");
    all(co.lessons, function (l, i) {
      var s = lessonState(l.id);
      var row = el("div", "lesson-row" + (s === "done" ? " done" : ""));
      var blocks = l.blocks || [];
      var nSoc = blocks.filter(function (b) { return b.type === "socratic"; }).length;
      var nClose = blocks.filter(function (b) { return b.type === "close"; }).length;
      var nLab = blocks.filter(function (b) { return b.type === "interactive"; }).length;
      row.innerHTML = "<div class='idx'>" + (s === "done" ? "✓" : (i + 1)) + "</div>" +
        "<div class='info'><div class='t'>" + esc(l.title) + "</div><div class='g'>" + esc(l.goal || "") + "</div>" +
        "<div class='meta' style='margin-top:4px'>" +
        (nClose ? "<span class='chip accent'>" + nClose + " 段精读</span>" : "") +
        (nSoc ? "<span class='chip accent'>苏格拉底追问</span>" : "") +
        (nLab ? "<span class='chip accent'>" + nLab + " 个推演</span>" : "") +
        "<span class='chip'>" + (l.flashcards || []).length + " 闪卡</span>" +
        "<span class='chip'>" + (l.arguments || []).length + " 论证</span>" +
        "<span class='chip'>" + (l.quiz || []).length + " 题</span>" +
        (s === "read" ? "<span class='chip warn'>进行中</span>" : "") +
        "</div></div><div class='est'>" + (s === "done" ? "已掌握" : s === "read" ? "继续" : "未开始") + " ›</div>";
      row.addEventListener("click", function () { navigate("#/c/" + co.id + "/" + l.id); });
      list.appendChild(row);
    });
    wrap.appendChild(list);
    c.appendChild(wrap);
  }

  /* ==================================================== 页面：一讲 */
  function pageLesson(courseId, lessonId) {
    var co = courses.filter(function (x) { return x.id === courseId; })[0];
    var c = $("#content"); c.innerHTML = "";
    if (!co) { c.appendChild(el("div", "empty", "找不到课程")); return; }
    var idx = (co.lessons || []).findIndex(function (l) { return l.id === lessonId; });
    if (idx < 0) { c.appendChild(el("div", "empty", "找不到该讲")); return; }
    var lesson = co.lessons[idx];
    markVisit(lesson.id);
    setPref("lastLesson", lesson.id);
    var startTs = Date.now();

    setCrumbs([{ text: "总览", route: "#/" }, { text: co.title, route: "#/c/" + co.id }, { text: lesson.title }]);
    var wrap = el("div", "wrap");
    var s = lessonState(lesson.id);
    wrap.appendChild(el("h1", "page-title", (idx + 1) + ". " + esc(lesson.title)));
    var meta = el("div", "review-bar");
    meta.appendChild(el("span", "chip accent", "第 " + (idx + 1) + " / " + co.lessons.length + " 讲"));
    meta.appendChild(el("span", "chip", (lesson.flashcards || []).length + " 张闪卡"));
    meta.appendChild(el("span", "chip", (lesson.arguments || []).length + " 组论证重构"));
    meta.appendChild(el("span", "chip", (lesson.quiz || []).length + " 道测验题"));
    var qs = state.quiz[lesson.id];
    if (qs) meta.appendChild(el("span", "chip ok", "历史正确率 " + Math.round((qs.correct / qs.attempted) * 100) + "%"));
    if (s === "done") meta.appendChild(el("span", "chip ok", "已标记掌握"));
    wrap.appendChild(meta);

    // 本讲导航：内容 / 闪卡 / 论证 / 写作 / 笔记
    var tabs = el("div", "tabs");
    var panes = el("div", "panes");
    var paneList = [];
    function addTab(label, node) {
      var b = el("button", "tab", label);
      b.addEventListener("click", function () {
        Array.prototype.forEach.call(tabs.querySelectorAll(".tab"), function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        paneList.forEach(function (p) { p.node.classList.add("hidden"); });
        node.classList.remove("hidden");
      });
      tabs.appendChild(b);
      panes.appendChild(node);
      paneList.push({ btn: b, node: node });
      return b;
    }

    var mainPane = el("div");
    if (lesson.goal) {
      var gb = el("div", "block concept");
      gb.innerHTML = "<h3>🎯 学习目标 <span class='tag'>学完你能做到</span></h3><div class='md'>" + md(lesson.goal) + "</div>";
      mainPane.appendChild(gb);
    }
    all(lesson.blocks, function (b) { mainPane.appendChild(renderBlock(b)); });
    // 延伸精读：把「精读轨迹」里与本讲对应的书目挂在这里
    var rbox = renderLessonReading(lesson, co);
    if (rbox) mainPane.appendChild(rbox);

    var quizHost = el("div");
    mainPane.appendChild(quizHost);
    QUIZ.render(quizHost, lesson.quiz || [], {
      scope: lesson.id,
      onAnswered: function (q, ok, picked) {
        recordQuiz(lesson.id, co.id, q, ok, picked);
        buildSidebar(); markActiveNav();
        if (!ok) toast("已记入错题本", "bad");
      },
      onGraded: function (r) {
        if (r.total && r.graded === r.total && r.correct === r.total) {
          markDone(lesson.id, true);
          buildSidebar(); markActiveNav();
          toast("全部答对，本讲已标记掌握 ✓", "ok");
        }
      }
    });
    var t1 = addTab("📖 内容与测验", mainPane);
    // 零基础兜底：按需把正文里的已知术语标成可点击标签（点一下弹解释，不用离开本页）
    glossInto(mainPane);
    if ((lesson.flashcards || []).length) {
      var fcPane = el("div");
      var fbi = el("div", "block concept");
      fbi.innerHTML = "<h3>🃏 本讲闪卡（" + lesson.flashcards.length + " 张）<span class='tag'>间隔重复</span></h3>" +
        md("先自己回想答案，再点「显示答案」，然后**如实**自评：选「完全不会」的卡片会在 10 分钟后重新出现。");
      fcPane.appendChild(fbi);
      var fh = el("div");
      fcPane.appendChild(fh);
      var dueCards = lesson.flashcards.map(function (f) { return { card: f, lesson: lesson, course: co }; });
      renderFlashcards(fh, {
        cards: dueCards,
        onGrade: function () { buildSidebar(); }
      });
      addTab("🃏 闪卡（" + lesson.flashcards.length + "）", fcPane);
    }
    if ((lesson.arguments || []).length) {
      var ap = el("div");
      all(lesson.arguments, function (a) { var h = el("div"); ap.appendChild(h); renderArg(h, a, { onDone: function () { buildSidebar(); } }); });
      addTab("🧩 论证重构（" + lesson.arguments.length + "）", ap);
    }
    if ((lesson.writing || []).length) {
      var wp = el("div");
      all(lesson.writing, function (w) { var h = el("div"); wp.appendChild(h); renderWriting(h, w, {}); });
      addTab("✍️ 写作训练（" + lesson.writing.length + "）", wp);
    }
    var np = el("div");
    var nbox = el("div", "block concept");
    nbox.innerHTML = "<h3>📝 我的笔记 <span class='tag'>自动保存</span></h3>" +
      md("建议记三样东西：① 本讲的**核心论证**（前提 → 结论）；② 你**不同意**的地方和理由；③ 你还没搞懂的问题。\n" +
        "> 哲学笔记的价值不在于抄录，而在于写下**你自己的反驳**。");
    var nta = el("textarea", "wr-area");
    nta.placeholder = "本讲笔记…";
    nta.value = state.notes[lesson.id] || "";
    var nt = null;
    nta.addEventListener("input", function () {
      clearTimeout(nt);
      nt = setTimeout(function () { state.notes[lesson.id] = nta.value; save(); }, 600);
    });
    nbox.appendChild(nta);
    np.appendChild(nbox);
    addTab("📝 笔记", np);
    t1.classList.add("on");
    paneList.forEach(function (p, i) { if (i > 0) p.node.classList.add("hidden"); });
    wrap.appendChild(tabs);
    wrap.appendChild(panes);

    var foot = el("div", "lesson-foot");
    var bDone = el("button", "btn " + (s === "done" ? "ok" : "primary"), s === "done" ? "✓ 已掌握（点击取消）" : "标记本讲已掌握");
    bDone.addEventListener("click", function () {
      var now = isDone(lesson.id);
      markDone(lesson.id, !now);
      buildSidebar(); markActiveNav();
      bDone.className = "btn " + (!now ? "ok" : "primary");
      bDone.textContent = !now ? "✓ 已掌握（点击取消）" : "标记本讲已掌握";
      toast(!now ? "已标记掌握" : "已取消掌握标记", !now ? "ok" : "");
    });
    foot.appendChild(bDone);
    if (idx > 0) {
      var bp = el("button", "btn ghost", "‹ 上一讲");
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
    wrap.appendChild(el("div", "note-line",
      "快捷键：<span class='kbd'>Ctrl</span>+<span class='kbd'>Enter</span> 标记掌握 ｜ <span class='kbd'>/</span> 搜索 ｜ " +
      "<span class='kbd'>Alt</span>+<span class='kbd'>←</span>/<span class='kbd'>→</span> 上一讲 / 下一讲"));
    c.appendChild(wrap);

    var settled = false;
    function settle() {
      if (settled) return;
      settled = true;
      // 本课程不统计学习时长（只对质量有要求，不做时间度量），
      // 这里保留钩子用于将来可能的其他离场结算。
    }
    global.addEventListener("hashchange", settle, { once: true });
    global.addEventListener("beforeunload", settle, { once: true });
    $("#content").scrollTop = 0;
  }

  /* ==================================================== 组件：书卡 */
  var LEVEL_LABEL = {
    1: "入门 · 可直接读",
    2: "中等 · 需要耐心",
    3: "困难 · 需要准备",
    4: "极难 · 需同伴或课程"
  };
  // 说明：本课程只对质量有要求，因此刻意**不标注任何时间**（不写"要花几周""预计多久"）。
  // 等级标记的是深度与所需准备，不是时间承诺。
  function bookCard(b, opt) {
    opt = opt || {};
    var box = el("div", "book-card lv" + (b.level || 1));
    var head = el("div", "book-hd");
    head.appendChild(el("span", "book-lv", "L" + (b.level || "?")));
    head.appendChild(el("div", "book-t", "<b>" + esc(b.author || "") + "　" + esc(b.title || "") + "</b>"));
    box.appendChild(head);
    var meta = el("div", "book-meta");
    if (b.zh && b.zh !== "—") meta.appendChild(el("span", "chip accent", "中译：" + esc(b.zh)));
    else if (b.zh === "—") meta.appendChild(el("span", "chip warn", "建议读原文/英译"));
    if (b.en) meta.appendChild(el("span", "chip", "英译：" + esc(b.en)));
    meta.appendChild(el("span", "chip", LEVEL_LABEL[b.level] || ""));
    box.appendChild(meta);
    box.appendChild(el("div", "md book-why", md(b.why || "")));
    if ((b.focus || []).length) {
      var f = el("div", "book-focus");
      f.appendChild(el("div", "note-line", "读的时候重点盯："));
      var ul = el("ul");
      all(b.focus, function (x) { ul.appendChild(el("li", null, md(x))); });
      f.appendChild(ul);
      box.appendChild(f);
    }
    if (b.ladder && opt.plan) {
      var lad = findBook(opt.plan, b.ladder);
      if (lad) box.appendChild(el("div", "lab-note", "⬆ 读它之前先读：" + esc(lad.author + "《" + lad.title + "》")));
    }
    if (b.tip) box.appendChild(el("div", "lab-note", "💡 " + esc(b.tip)));
    if (opt.showLessons && (b.lessons || []).length) {
      var links = el("div", "book-links");
      links.appendChild(el("span", "note-line", "对应本站课程："));
      all(b.lessons, function (lid) {
        var info = lessonIndex[lid];
        if (!info) return;
        var a = el("a", "chip", esc(info.course.title + " · " + info.lesson.title));
        a.href = "#/c/" + info.course.id + "/" + lid;
        links.appendChild(a);
      });
      box.appendChild(links);
    }
    return box;
  }
  function findBook(plan, id) {
    var hit = null;
    (plan.stages || []).forEach(function (s) {
      (s.books || []).forEach(function (b) { if (b.id === id) hit = b; });
    });
    return hit;
  }

  /* ==================================================== 页面：精读轨迹 */
  function pageReading(planId) {
    var c = $("#content"); c.innerHTML = "";
    var wrap = el("div", "wrap");
    if (!readingPlans.length) {
      setCrumbs([{ text: "总览", route: "#/" }, { text: "精读轨迹" }]);
      wrap.appendChild(el("h1", "page-title", "📚 精读轨迹"));
      wrap.appendChild(el("div", "empty",
        "还没有加载到阅读轨迹数据。<br>把 <code>data/reading-*.js</code> 放进 data/ 目录后重新运行 " +
        "<code>node tools/build.mjs</code> 即可。"));
      c.appendChild(wrap);
      return;
    }
    var plan = planId ? readingPlans.filter(function (p) { return p.id === planId; })[0] : null;

    /* --- 轨迹列表 --- */
    if (!plan) {
      setCrumbs([{ text: "总览", route: "#/" }, { text: "精读轨迹" }]);
      wrap.appendChild(el("h1", "page-title", "📚 精读轨迹"));
      wrap.appendChild(el("p", "lead",
        "本站课程给你问题地图与方法训练，但真正的深度来自把整本书读完。" +
        "下面是几条精读轨迹：每条都给出**读哪些书、什么顺序、什么难度、配哪几讲**，" +
        "以及每本书会在哪里卡住、卡住了先读哪本梯子书。"));
      var cards = el("div", "grid");
      readingPlans.forEach(function (p) {
        var n = 0, lv = { 1: 0, 2: 0, 3: 0, 4: 0 };
        (p.stages || []).forEach(function (s) {
          (s.books || []).forEach(function (b) { n++; lv[b.level] = (lv[b.level] || 0) + 1; });
        });
        var card = el("div", "card");
        card.innerHTML = "<div class='hd'><span class='ico'>" + p.icon + "</span><h3>" + esc(p.title) + "</h3></div>" +
          "<div class='blurb'>" + esc(p.blurb) + "</div>" +
          "<div class='meta'><span class='chip'>" + (p.stages || []).length + " 阶段</span>" +
          "<span class='chip'>" + n + " 本书</span>" +
          "<span class='chip ok'>L1–L2：" + (lv[1] + lv[2]) + " 本</span>" +
          "<span class='chip warn'>L3–L4：" + (lv[3] + lv[4]) + " 本</span></div>";
        card.addEventListener("click", function () { navigate("#/reading/" + p.id); });
        cards.appendChild(card);
      });
      wrap.appendChild(cards);
      wrap.appendChild(el("h2", "sec", "怎么用这些轨迹"));
      var how = el("div", "block concept");
      how.innerHTML = "<h3>三条轨迹的关系 <span class='tag'>建议用法</span></h3>" + md([
        "1. **先把本站课程走一遍**（" + courses.length + " 门课 / " +
        courses.reduce(function (n, x) { return n + (x.lessons || []).length; }, 0) +
        " 讲）。这一步的目的不是记住内容，而是拿到**问题地图**与**方法**：会读原著、会拆论证、会写论文。",
        "2. **再选一条轨迹死磕**。历史线（西方 / 中国）给你时间坐标；问题线（知识论 / 形而上学 / 伦理学 / 政治哲学 / 心灵与语言）让你在**一个问题上**达到能与人对话的程度。",
        "3. **同时进入真实的智识共同体**：读书会、线上研讨、旁听大学课程、写作投稿。",
        "",
        "> 三个最容易失败的点，轨迹里都标了应对：① 一上来就读 level 4 的体系大书（先读 `ladder` 指的梯子书）；" +
        "② 想通读每一本（很多书只需读指定几卷，`focus` 说了读哪里）；③ 只读不写（每条轨迹都对应本站的写作训练，读完一本就写一篇）。"
      ].join("\n"));
      wrap.appendChild(how);
      c.appendChild(wrap);
      return;
    }

    /* --- 单条轨迹 --- */
    setCrumbs([{ text: "总览", route: "#/" }, { text: "精读轨迹", route: "#/reading" }, { text: plan.title }]);
    wrap.appendChild(el("h1", "page-title", plan.icon + " " + esc(plan.title)));
    wrap.appendChild(el("p", "lead", esc(plan.blurb)));
    var stat = el("div", "stat-grid");
    var nb = 0, lv = { 1: 0, 2: 0, 3: 0, 4: 0 };
    (plan.stages || []).forEach(function (s) {
      (s.books || []).forEach(function (b) { nb++; lv[b.level] = (lv[b.level] || 0) + 1; });
    });
    function statCard(n, l) { stat.appendChild(el("div", "stat", "<div class='n'>" + n + "</div><div class='l'>" + l + "</div>")); }
    statCard(nb, "本书");
    statCard((plan.stages || []).length, "个阶段");
    statCard(lv[1] + lv[2], "入门~中等（L1–L2）");
    statCard(lv[3] + lv[4], "困难以上（L3–L4）");
    wrap.appendChild(stat);
    if (plan.intro) {
      var ib = el("div", "block concept");
      ib.innerHTML = "<h3>这条线怎么走 <span class='tag'>导语</span></h3><div class='md'>" + md(plan.intro) + "</div>";
      wrap.appendChild(ib);
    }
    var backBar = el("div", "review-bar");
    var bAll = el("button", "btn ghost sm", "← 全部轨迹");
    bAll.addEventListener("click", function () { navigate("#/reading"); });
    backBar.appendChild(bAll);
    var bCourse = el("button", "btn ghost sm", "回课程总览");
    bCourse.addEventListener("click", function () { navigate("#/"); });
    backBar.appendChild(bCourse);
    wrap.appendChild(backBar);

    (plan.stages || []).forEach(function (s, si) {
      wrap.appendChild(el("h2", "sec", "阶段 " + (si + 1) + "｜" + esc(s.title)));
      var gb = el("div", "block concept");
      gb.style.marginTop = "0";
      gb.innerHTML = "<h3>🎯 这一阶段的目标 <span class='tag'>可检验</span></h3><div class='md'>" + md(s.goal || "") + "</div>";
      wrap.appendChild(gb);
      (s.books || []).forEach(function (b) { wrap.appendChild(bookCard(b, { plan: plan, showLessons: true })); });
    });
    c.appendChild(wrap);
    $("#content").scrollTop = 0;
  }

  /* ============================================ 组件：课时页的延伸精读 */
  function renderLessonReading(lesson, course) {
    var list = readingByLesson[lesson.id];
    if (!list || !list.length) return null;
    var box = el("div", "block reading-box");
    box.appendChild(el("h3", null, "📚 读完这一讲，接着读这些 <span class='tag'>精读轨迹</span>"));
    box.appendChild(el("div", "note-line",
      "本站课程给地图与方法，深度靠读完整本书。下面是几条精读轨迹里与本讲对应的书目——" +
      "含推荐译本、难度分级与「读的时候重点盯什么」。"));
    // 同一本书可能被多条轨迹引用，去重
    var seen = {};
    list.forEach(function (x) {
      if (seen[x.book.id]) return;
      seen[x.book.id] = 1;
      var row = el("div", "reading-row");
      row.appendChild(el("div", "note-line", esc(x.plan.title + " · " + x.stage.title)));
      row.appendChild(bookCard(x.book, { plan: x.plan, showLessons: false }));
      box.appendChild(row);
    });
    var bar = el("div", "review-bar");
    var b1 = el("button", "btn sm primary", "📚 看完整精读轨迹");
    b1.addEventListener("click", function () { navigate("#/reading"); });
    bar.appendChild(b1);
    box.appendChild(bar);
    return box;
  }

  /* ==================================================== 页面：闪卡 */
  function pageFlashcards(courseId) {
    var c = $("#content"); c.innerHTML = "";
    setCrumbs([{ text: "总览", route: "#/" }, { text: "闪卡复习" }]);
    var wrap = el("div", "wrap");
    var co = courseId ? courses.filter(function (x) { return x.id === courseId; })[0] : null;
    wrap.appendChild(el("h1", "page-title", "🃏 闪卡复习"));
    var st = cardStats();
    wrap.appendChild(el("p", "lead",
      "共 " + st.total + " 张卡片，今日到期 " + st.due + " 张，已进入复习周期 " + st.learned + " 张。" +
      "调度方式为 SM-2 简化版：记得越牢，下次出现得越晚（2 天 → 6 天 → 按难度系数递增，最长 1 年）；" +
      "选「完全不会」则 10 分钟后重新出现。请**如实自评**——骗过算法只会让复习安排失效。"));

    var bar = el("div", "review-bar");
    var scope = el("select", "fill-in");
    scope.innerHTML = "<option value=''>全部课程</option>" + courses.map(function (x) {
      var n = (x.lessons || []).reduce(function (m, l) { return m + (l.flashcards || []).filter(function (f) { return cardDue(f.id); }).length; }, 0);
      return "<option value='" + x.id + "'" + (courseId === x.id ? " selected" : "") + ">" + esc(x.title) + "（到期 " + n + "）</option>";
    }).join("");
    scope.addEventListener("change", function () { navigate("#/flashcards" + (scope.value ? "/" + scope.value : "")); });
    bar.appendChild(scope);

    var mode = "due";
    [["今日到期", "due"], ["全部卡片", "all"], ["最不熟的", "weak"]].forEach(function (m, i) {
      var b = el("button", "btn sm " + (i === 0 ? "primary" : "ghost"), m[0]);
      b.addEventListener("click", function () {
        mode = m[1];
        Array.prototype.forEach.call(bar.querySelectorAll(".mode-btn"), function (x) { x.className = "btn sm mode-btn ghost"; });
        b.className = "btn sm mode-btn primary";
        start();
      });
      b.classList.add("mode-btn");
      bar.appendChild(b);
    });
    wrap.appendChild(bar);

    var host = el("div");
    wrap.appendChild(host);

    function pool() {
      var list = allCards();
      if (co) list = list.filter(function (x) { return x.course.id === co.id; });
      if (mode === "due") list = list.filter(function (x) { return cardDue(x.card.id); });
      if (mode === "weak") {
        list.sort(function (a, b) {
          var ra = state.cards[a.card.id] || { lapses: 99, ease: 0 };
          var rb = state.cards[b.card.id] || { lapses: 99, ease: 0 };
          return (rb.lapses || 0) - (ra.lapses || 0) || (ra.ease || 0) - (rb.ease || 0);
        });
      } else if (mode === "due") {
        list.sort(function (a, b) {
          var ra = state.cards[a.card.id], rb = state.cards[b.card.id];
          return ((ra && ra.due) || 0) - ((rb && rb.due) || 0);
        });
      }
      return list.slice(0, 30);
    }
    function start() {
      host.innerHTML = "";
      var list = pool();
      if (!list.length) {
        host.appendChild(el("div", "empty", mode === "due"
          ? "今日到期的卡片已经清空 ✓ 明天再来。（也可以切到「全部卡片」提前复习。）"
          : "这门课还没有闪卡数据。"));
        return;
      }
      renderFlashcards(host, { cards: list, onGrade: function () { buildSidebar(); } });
    }
    start();
    c.appendChild(wrap);
  }

  /* ==================================================== 页面：论证重构 */
  function pageArguments(courseId) {
    var c = $("#content"); c.innerHTML = "";
    setCrumbs([{ text: "总览", route: "#/" }, { text: "论证重构" }]);
    var wrap = el("div", "wrap");
    wrap.appendChild(el("h1", "page-title", "🧩 论证重构训练"));
    wrap.appendChild(el("p", "lead",
      "哲学系最核心的硬技能：把一段话重构成「前提 → 结论」。这里每个练习给你几句原文，你来判定" +
      "哪些是前提、哪一句是结论、哪一句其实是无关干扰；提交后对照形式化、有效性（validity）、" +
      "可靠性（soundness）与「关键缺口」。"));

    var bar = el("div", "review-bar");
    var sel = el("select", "fill-in");
    sel.innerHTML = "<option value=''>全部课程</option>" + courses.map(function (x) {
      var n = (x.lessons || []).reduce(function (m, l) { return m + (l.arguments || []).length; }, 0);
      return "<option value='" + x.id + "'" + (courseId === x.id ? " selected" : "") + ">" + esc(x.title) + "（" + n + " 组）</option>";
    }).join("");
    sel.addEventListener("change", function () { navigate("#/arguments" + (sel.value ? "/" + sel.value : "")); });
    bar.appendChild(sel);
    var bShuffle = el("button", "btn sm ghost", "🎲 随机换一批");
    bar.appendChild(bShuffle);
    wrap.appendChild(bar);

    var all = [];
    courses.forEach(function (co) {
      if (courseId && co.id !== courseId) return;
      (co.lessons || []).forEach(function (l) {
        all(l.arguments, function (a) { all.push({ arg: a, lesson: l, course: co }); });
      });
    });
    var doneN = all.filter(function (x) {
      var r = state.args[x.arg.id];
      return r && r.done && r.correct > 0;
    }).length;
    bar.appendChild(el("span", "chip accent", "共 " + all.length + " 组，已完全正确 " + doneN + " 组"));
    var undone = all.filter(function (x) { var r = state.args[x.arg.id]; return !r || !r.done || !r.correct; });
    var order = undone.length ? undone : all;

    var host = el("div");
    wrap.appendChild(host);
    function draw(n) {
      host.innerHTML = "";
      if (!order.length) { host.appendChild(el("div", "empty", "这门课还没有论证重构练习。")); return; }
      var show = order.slice(0, n || 5);
      show.forEach(function (x) {
        var h = el("div");
        h.appendChild(el("div", "note-line", "来源：" + esc(x.course.title + " · " + x.lesson.title) +
          " ｜ <a href='#/c/" + x.course.id + "/" + x.lesson.id + "'>去这一讲</a>"));
        host.appendChild(h);
        renderArg(h, x.arg, { onDone: function () { buildSidebar(); } });
      });
    }
    draw(5);
    bShuffle.addEventListener("click", function () {
      for (var i = order.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = order[i]; order[i] = order[j]; order[j] = t; }
      draw(5);
      toast("换了一批新练习");
    });
    c.appendChild(wrap);
  }

  /* ==================================================== 页面：写作训练 */
  function pageWriting() {
    var c = $("#content"); c.innerHTML = "";
    setCrumbs([{ text: "总览", route: "#/" }, { text: "写作训练" }]);
    var wrap = el("div", "wrap");
    wrap.appendChild(el("h1", "page-title", "✍️ 写作训练"));
    wrap.appendChild(el("p", "lead",
      "哲学的能力最终体现在能不能把一个论证**写清楚**。每个训练给题目、构思清单、建议结构、" +
      "评分细则（Rubric）和一段范例片段；你的草稿自动保存，可按细则逐条自查。"));

    var list = [];
    courses.forEach(function (co) {
      (co.lessons || []).forEach(function (l) {
        all(l.writing, function (w) { list.push({ w: w, lesson: l, course: co }); });
        all((l.blocks || []).filter(function (b) { return b.type === "writing"; }), function (b) {
          list.push({ w: b, lesson: l, course: co });
        });
      });
    });
    var bar = el("div", "review-bar");
    var doneN = list.filter(function (x) {
      var r = state.writing[x.w.id];
      return r && r.text && r.text.replace(/\s/g, "").length >= 200;
    }).length;
    bar.appendChild(el("span", "chip accent", "共 " + list.length + " 个写作训练"));
    bar.appendChild(el("span", "chip " + (doneN ? "ok" : ""), "已起草 " + doneN + " 个（≥200 字）"));
    wrap.appendChild(bar);

    var sel = el("select", "fill-in");
    sel.innerHTML = "<option value=''>全部课程</option>" + courses.map(function (x) { return "<option value='" + x.id + "'>" + esc(x.title) + "</option>"; }).join("");
    var host = el("div");
    sel.addEventListener("change", function () { draw(sel.value); });
    var bar2 = el("div", "review-bar");
    bar2.appendChild(sel);
    wrap.appendChild(bar2);
    wrap.appendChild(host);

    function draw(cid) {
      host.innerHTML = "";
      var show = list.filter(function (x) { return !cid || x.course.id === cid; });
      if (!show.length) { host.appendChild(el("div", "empty", "暂无写作训练。")); return; }
      // 未起草的排前面
      show.sort(function (a, b) {
        var ra = state.writing[a.w.id], rb = state.writing[b.w.id];
        var la = ra && ra.text ? ra.text.length : 0, lb = rb && rb.text ? rb.text.length : 0;
        return la - lb;
      });
      show.forEach(function (x) {
        var h = el("div");
        h.appendChild(el("div", "note-line", "来源：" + esc(x.course.title + " · " + x.lesson.title) +
          " ｜ <a href='#/c/" + x.course.id + "/" + x.lesson.id + "'>去这一讲</a>"));
        host.appendChild(h);
        renderWriting(h, x.w, {});
      });
    }
    draw("");
    c.appendChild(wrap);
  }

  /* ==================================================== 页面：术语表 */
  function pageGlossary() {
    var c = $("#content"); c.innerHTML = "";
    setCrumbs([{ text: "总览", route: "#/" }, { text: "术语表" }]);
    var wrap = el("div", "wrap");
    wrap.appendChild(el("h1", "page-title", "📖 哲学术语表"));
    var total = (global.GLOSSARY && global.GLOSSARY.count) ? global.GLOSSARY.count() : 0;
    wrap.appendChild(el("p", "lead",
      "共 " + total + " 条高频术语，按主题分组。每条给大白话解释、外文原词，以及它出现在哪一讲——" +
      "遇到不认识的词随时回来查。"));

    var bar = el("div", "review-bar");
    var input = el("input", "fill-in");
    input.placeholder = "搜索术语（如 本体论、理型、绝对命令、意向性）…";
    input.style.maxWidth = "380px";
    bar.appendChild(input);
    var cnt = el("div", "lab-stat", "");
    bar.appendChild(cnt);
    wrap.appendChild(bar);

    var host = el("div");
    wrap.appendChild(host);
    function draw(kw) {
      host.innerHTML = "";
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
        items.forEach(function (it) {
          shown++;
          var row = el("div", "gloss-row");
          row.innerHTML = "<div><b>" + esc(it.t) + "</b>" +
            (it.en ? " <span class='chip'>" + esc(it.en) + "</span>" : "") + "</div>" +
            "<div class='md' style='margin-top:4px'>" + md(it.d) + "</div>" +
            (it.where ? "<div class='note-line'>→ 出现在：" + esc(it.where) + "</div>" : "");
          box.appendChild(row);
        });
        host.appendChild(box);
      });
      if (!shown) host.appendChild(el("div", "empty", "没有匹配的术语。换个关键词试试，比如「实体」「德性」「有效」。"));
      cnt.textContent = q ? ("匹配 " + shown + " 条") : (total + " 条术语");
    }
    input.addEventListener("input", function (e) { draw(e.target.value); });
    draw("");
    c.appendChild(wrap);
  }

  /* ==================================================== 页面：错题本 */
  function pageNotebook() {
    var c = $("#content"); c.innerHTML = "";
    setCrumbs([{ text: "总览", route: "#/" }, { text: "错题本" }]);
    var wrap = el("div", "wrap");
    var ms = mistakes();
    wrap.appendChild(el("h1", "page-title", "📕 错题本"));
    wrap.appendChild(el("p", "lead", "答错的题会自动记录在这里。建议按「错得最多」的顺序逐条重做：先自己写出答案，再展开解析对照。"));
    var bar = el("div", "review-bar");
    var br = el("button", "btn primary", "🔁 开始随机复习（" + ms.length + " 题）");
    br.disabled = ms.length === 0;
    br.addEventListener("click", function () { navigate("#/review"); });
    bar.appendChild(br);
    var be = el("button", "btn ghost", "导出错题（JSON）");
    be.addEventListener("click", function () {
      var data = JSON.stringify(ms, null, 2);
      if (navigator.clipboard) navigator.clipboard.writeText(data).then(function () { toast("已复制到剪贴板", "ok"); }, function () { toast("复制失败", "bad"); });
      else toast("当前环境不支持剪贴板", "bad");
    });
    bar.appendChild(be);
    var bc = el("button", "btn ghost", "清空错题本");
    bc.addEventListener("click", function () {
      if (global.confirm("确定清空全部错题记录？（学习进度不受影响）")) { clearMistakes(); buildSidebar(); pageNotebook(); }
    });
    bar.appendChild(bc);
    wrap.appendChild(bar);
    if (!ms.length) {
      wrap.appendChild(el("div", "empty", "还没有错题 —— 去做几讲随堂测验吧。"));
      c.appendChild(wrap);
      return;
    }
    ms.sort(function (a, b) { return (b.count || 0) - (a.count || 0) || (b.lastWrong || 0) - (a.lastWrong || 0); });
    ms.forEach(function (m) {
      var info = lessonIndex[m.lessonId];
      var item = el("div", "wrong-item");
      var optHtml = "";
      if (m.options) optHtml = "<div class='note-line'>选项：" + m.options.map(function (o, i) { return (i + 1) + ". " + esc(o); }).join("　") + "</div>";
      if (m.items) optHtml = "<div class='note-line'>候选项：" + m.items.map(function (o, i) { return (i + 1) + ". " + esc(o); }).join("　") + "</div>";
      var pool = m.options || m.items || null;
      var ansTxt = Array.isArray(m.answer)
        ? (pool ? m.answer.map(function (i) { return pool[i]; }).join(" → ") : m.answer.join(" → "))
        : (pool ? pool[m.answer] : String(m.answer));
      item.innerHTML = "<div class='txt'><div class='q'>" + md(m.q) + "</div>" + optHtml +
        "<div class='m'>来源：" + esc(info ? info.course.title + " · " + info.lesson.title : m.lessonId) +
        " ｜ 错误 " + (m.count || 1) + " 次 ｜ 最近 " + fmtTime(m.lastWrong) + "</div>" +
        "<div class='m'>正确答案：" + esc(ansTxt || "") + "</div>" +
        "<div class='m'>解析：" + esc(m.why || "") + "</div></div>";
      var right = el("div");
      var bo = el("button", "btn sm ghost", "去重做");
      bo.addEventListener("click", function () { if (info) navigate("#/c/" + info.course.id + "/" + info.lesson.id); });
      var bg = el("button", "btn sm ghost", "已掌握");
      bg.addEventListener("click", function () { removeMistake(m.qid); buildSidebar(); pageNotebook(); });
      right.appendChild(bo); right.appendChild(bg);
      item.appendChild(right);
      wrap.appendChild(item);
    });
    c.appendChild(wrap);
  }

  /* ==================================================== 页面：复习 */
  function pageReview() {
    var c = $("#content"); c.innerHTML = "";
    setCrumbs([{ text: "总览", route: "#/" }, { text: "错题复习" }]);
    var wrap = el("div", "wrap");
    wrap.appendChild(el("h1", "page-title", "🔁 错题复习"));
    wrap.appendChild(el("p", "lead", "优先抽取错题与正确率偏低课程的题目。答对会从错题本移除，答错会继续留在错题本。"));
    var weak = weakLessons(8);
    var ms = mistakes(); ms.sort(function (a, b) { return (b.count || 0) - (a.count || 0); });
    var bank = [];
    ms.forEach(function (m) {
      var info = lessonIndex[m.lessonId];
      if (!info) return;
      var q = (info.lesson.quiz || []).filter(function (x) { return x.id === m.qid; })[0];
      if (q) bank.push({ q: q, lesson: info.lesson, course: info.course, from: "错题本" });
    });
    weak.forEach(function (w) {
      all(w.lesson.quiz, function (q) {
        if (bank.length < 14 && !bank.some(function (x) { return x.q.id === q.id; })) bank.push({ q: q, lesson: w.lesson, course: w.course, from: "薄弱课" });
      });
    });
    if (bank.length < 8) {
      courses.forEach(function (co) {
        all(co.lessons, function (l) {
          var st = state.quiz[l.id];
          if (!st && bank.length < 10) {
            all(l.quiz, function (q) { if (bank.length < 10 && !bank.some(function (x) { return x.q.id === q.id; })) bank.push({ q: q, lesson: l, course: co, from: "未测" }); });
          }
        });
      });
    }
    for (var i = bank.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = bank[i]; bank[i] = bank[j]; bank[j] = t; }
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
        scope: "review:" + p.q.id, hideTitle: true,
        onAnswered: function (q, ok, pickedIdx) {
          recordQuiz(p.lesson.id, p.course.id, q, ok, pickedIdx);
          if (ok && state.mistakes[q.id]) { removeMistake(q.id); toast("答对，已从错题本移除 ✓", "ok"); }
          else if (ok) toast("答对 ✓", "ok");
          buildSidebar();
        }
      });
    });
    var foot = el("div", "lesson-foot");
    var ag = el("button", "btn primary", "↻ 再抽一组");
    ag.addEventListener("click", function () { pageReview(); });
    var nb = el("button", "btn ghost", "打开错题本");
    nb.addEventListener("click", function () { navigate("#/notebook"); });
    foot.appendChild(ag); foot.appendChild(nb);
    wrap.appendChild(foot);
    c.appendChild(wrap);
  }

  /* ==================================================== 页面：学习报告 */
  function pageProgress() {
    var c = $("#content"); c.innerHTML = "";
    setCrumbs([{ text: "总览", route: "#/" }, { text: "学习报告" }]);
    var g = globalStat();
    var wrap = el("div", "wrap");
    wrap.appendChild(el("h1", "page-title", "📊 学习报告"));
    wrap.appendChild(el("p", "lead", "所有数据都来自你本机的学习记录。这里能看出你**哪一块最弱**，以及下一步该做什么。"));

    var stats = el("div", "stat-grid");
    function stat(n, l) { stats.appendChild(el("div", "stat", "<div class='n'>" + n + "</div><div class='l'>" + l + "</div>")); }
    stat("Lv." + g.level, g.xp + " XP（下一级还需 " + (200 - (g.xp % 200)) + "）");
    stat(g.streak + " 天", "连续学习（只记连续性，不记时长）");
    stat(g.pct + "%", "课程完成度");
    stat(g.attempted ? g.accuracy + "%" : "—", "测验正确率");
    var cst = cardStats();
    stat(String(cst.learned) + "/" + cst.total, "闪卡已进入复习周期");
    stat(String(g.mistakes), "错题待复习");
    wrap.appendChild(stats);

    wrap.appendChild(el("h2", "sec", "各课掌握情况"));
    var rows = courses.map(function (co) {
      var s = courseStat(co);
      var argsDone = (co.lessons || []).reduce(function (n, l) {
        return n + (l.arguments || []).filter(function (a) { var r = state.args[a.id]; return r && r.done && r.correct > 0; }).length;
      }, 0);
      return { co: co, s: s, argsDone: argsDone };
    });
    var tb = el("table", "report");
    tb.innerHTML = "<thead><tr><th>课程</th><th>完成度</th><th>测验正确率</th><th>闪卡已学</th><th>论证重构</th></tr></thead>";
    var tbody = el("tbody");
    rows.forEach(function (r) {
      var learned = (r.co.lessons || []).reduce(function (n, l) {
        return n + (l.flashcards || []).filter(function (f) { var c = state.cards[f.id]; return c && c.reps > 0; }).length;
      }, 0);
      var cards = r.s.cards || 0;
      var tr = el("tr");
      tr.innerHTML = "<td><b>" + r.co.icon + " " + esc(r.co.title) + "</b></td>" +
        "<td><div class='bar' style='min-width:90px'><i style='width:" + r.s.pct + "%'></i></div>" + r.s.pct + "%（" + r.s.done + "/" + r.s.total + "）</td>" +
        "<td>" + (r.s.attempted ? r.s.accuracy + "%（" + r.s.correct + "/" + r.s.attempted + "）" : "未测") + "</td>" +
        "<td>" + learned + " / " + cards + "</td>" +
        "<td>" + r.argsDone + " / " + r.s.args + "</td>";
      tr.addEventListener("click", function () { navigate("#/c/" + r.co.id); });
      tbody.appendChild(tr);
    });
    tb.appendChild(tbody);
    wrap.appendChild(tb);

    var weak = weakLessons(6);
    wrap.appendChild(el("h2", "sec", "建议下一步"));
    if (!weak.length) {
      wrap.appendChild(el("div", "empty", "还没有足够的记录来判断薄弱环节。先去做几讲测验、清一轮闪卡。"));
    } else {
      var list = el("div");
      weak.forEach(function (w) {
        var row = el("div", "lesson-row");
        row.innerHTML = "<div class='idx'>🎯</div><div class='info'><div class='t'>" + esc(w.lesson.title) + "</div>" +
          "<div class='g'>" + esc(w.course.title) + "</div>" +
          "<div class='meta' style='margin-top:4px'>" +
          (w.attempted ? "<span class='chip warn'>正确率 " + Math.round(w.accuracy * 100) + "%</span>" : "<span class='chip warn'>有错题未清</span>") +
          (w.wrong ? "<span class='chip bad'>" + w.wrong + " 道错题</span>" : "") +
          "</div></div><div class='est'>去复习 ›</div>";
        row.addEventListener("click", function () { navigate("#/c/" + w.course.id + "/" + w.lesson.id); });
        list.appendChild(row);
      });
      wrap.appendChild(list);
    }

    c.appendChild(wrap);
  }

  /* ==================================================== 搜索 */
  var searchIndex = [];
  courses.forEach(function (co) {
    all(co.lessons, function (l) {
      var text = [co.title, l.title, l.goal || ""].concat((l.blocks || []).map(function (b) {
        return [b.title, b.md, b.note, b.passage, b.opening].filter(Boolean).join(" ");
      })).concat((l.flashcards || []).map(function (f) { return [f.front, f.back].join(" "); }))
        .concat((l.arguments || []).map(function (a) { return [a.title, a.form, a.gap].join(" "); }))
        .join(" ");
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
      var t = rec.text.toLowerCase(), pos = t.indexOf(lq);
      if (pos >= 0) {
        hits.push({
          course: rec.course, lesson: rec.lesson,
          snippet: rec.text.slice(Math.max(0, pos - 30), pos + q.length + 50).replace(/\s+/g, " "),
          score: rec.lesson.title.toLowerCase().indexOf(lq) >= 0 ? 0 : 1
        });
      }
    });
    hits.sort(function (a, b) { return a.score - b.score; });
    hits = hits.slice(0, 14);
    pop.innerHTML = "";
    if (!hits.length) pop.appendChild(el("div", "search-hit", "<div class='t'>没有匹配结果</div><div class='m'>试试「理型」「绝对命令」「葛梯尔」「有效性」等关键词</div>"));
    hits.forEach(function (h) {
      var d = el("div", "search-hit");
      d.innerHTML = "<div class='t'>" + h.course.icon + " " + esc(h.lesson.title) + "</div><div class='m'>" + esc(h.course.title) + " · …" + esc(h.snippet) + "…</div>";
      d.addEventListener("click", function () {
        pop.hidden = true; $("#search").value = "";
        navigate("#/c/" + h.course.id + "/" + h.lesson.id);
      });
      pop.appendChild(d);
    });
    pop.hidden = false;
  }

  /* ==================================================== 路由 */
  function render() {
    var h = location.hash || "#/", m;
    if ((m = h.match(/^#\/c\/([\w-]+)\/([\w-]+)$/))) pageLesson(m[1], m[2]);
    else if ((m = h.match(/^#\/c\/([\w-]+)$/))) pageCourse(m[1]);
    else if ((m = h.match(/^#\/flashcards(?:\/([\w-]+))?$/))) pageFlashcards(m[1]);
    else if ((m = h.match(/^#\/arguments(?:\/([\w-]+))?$/))) pageArguments(m[1]);
    else if ((m = h.match(/^#\/reading(?:\/([\w-]+))?$/))) pageReading(m[1]);
    else if (h === "#/writing") pageWriting();
    else if (h === "#/notebook") pageNotebook();
    else if (h === "#/glossary") pageGlossary();
    else if (h === "#/review") pageReview();
    else if (h === "#/progress") pageProgress();
    else pageHome();
    buildSidebar();
    markActiveNav();
    var side = $("#sidebar");
    if (side && side.classList) side.classList.remove("open");
  }
  global.addEventListener("hashchange", render);

  /* ==================================================== 交互绑定 */
  function bind() {
    $("#btnTheme").addEventListener("click", function () {
      var cur = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      applyTheme(cur);
      toast(cur === "light" ? "已切换到浅色模式" : "已切换到深色模式");
    });
    $("#btnReview").addEventListener("click", function () { navigate("#/review"); });
    $("#btnCards").addEventListener("click", function () { navigate("#/flashcards"); });
    $("#btnNotebook").addEventListener("click", function () { navigate("#/notebook"); });
    $("#btnGloss").addEventListener("click", function () { navigate("#/glossary"); });
    $("#btnTerm").addEventListener("click", function () { showTermInfo(""); });
    var bGloss = $("#btnGlossToggle");
    function syncGlossBtn() {
      var on = glossEnabled();
      bGloss.textContent = on ? "🖍 生词标注：开" : "🖍 生词标注：关";
      bGloss.className = "btn ghost sm" + (on ? " ok" : "");
      bGloss.title = on
        ? "正文里的已学术语会加虚线下划线，点击即看解释。点击可关闭。"
        : "打开后，正文里出现过的已学术语（术语表 166 条 + 全部闪卡）会加虚线下划线，点击即看解释——零基础读者不用来回翻术语表。";
    }
    bGloss.addEventListener("click", function () {
      setPref("gloss", !glossEnabled());
      syncGlossBtn();
      render();
      toast(glossEnabled() ? "已打开生词标注：正文里的已知术语可点击查看解释" : "已关闭生词标注", "ok");
    });
    syncGlossBtn();
    $("#btnMenu").addEventListener("click", function () { $("#sidebar").classList.toggle("open"); });
    $("#search").addEventListener("input", function (e) { doSearch(e.target.value); });
    $("#search").addEventListener("focus", function (e) { doSearch(e.target.value); });
    document.addEventListener("click", function (e) {
      var pop = $("#searchPop");
      if (pop && !pop.hidden && !e.target.closest(".topbar-search")) pop.hidden = true;
    });
    $("#btnData").addEventListener("click", function () {
      var dlg = el("dialog", "modal");
      dlg.innerHTML = "<h3>学习数据：导出 / 导入</h3>" +
        "<p class='note-line'>进度、错题、闪卡调度、笔记与写作草稿都存在本浏览器的 localStorage 里。换电脑或换浏览器时，可复制下方 JSON 备份，粘贴后点「导入」恢复。</p>" +
        "<textarea id='dataArea'></textarea>";
      var bar = el("div", "review-bar");
      bar.style.marginTop = "10px";
      var bl = el("button", "btn sm ghost", "填入当前数据");
      bl.addEventListener("click", function () { dlg.querySelector("#dataArea").value = exportJson(); });
      var bi = el("button", "btn sm primary", "导入");
      bi.addEventListener("click", function () {
        try { importJson(dlg.querySelector("#dataArea").value); toast("导入成功", "ok"); dlg.close(); render(); }
        catch (e) { toast("导入失败：" + e.message, "bad"); }
      });
      var bcp = el("button", "btn sm ghost", "复制到剪贴板");
      bcp.addEventListener("click", function () {
        var ta = dlg.querySelector("#dataArea");
        ta.value = exportJson();
        if (navigator.clipboard) navigator.clipboard.writeText(ta.value).then(function () { toast("已复制", "ok"); });
      });
      var brs = el("button", "btn sm ghost", "清空全部数据");
      brs.addEventListener("click", function () {
        if (global.confirm("确定清空全部学习进度、错题、闪卡与笔记？此操作不可撤销。")) { resetAll(); toast("已清空"); dlg.close(); render(); }
      });
      var bcl = el("button", "btn sm ghost", "关闭");
      bcl.addEventListener("click", function () { dlg.close(); });
      bar.appendChild(bl); bar.appendChild(bi); bar.appendChild(bcp); bar.appendChild(brs); bar.appendChild(bcl);
      dlg.appendChild(bar);
      document.body.appendChild(dlg);
      dlg.querySelector("#dataArea").value = exportJson();
      dlg.addEventListener("close", function () { dlg.remove(); });
      if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
    });
    document.addEventListener("keydown", function (e) {
      var tag = (e.target.tagName || "").toLowerCase();
      var typing = tag === "input" || tag === "textarea" || e.target.isContentEditable;
      if (e.key === "/" && !typing) { e.preventDefault(); $("#search").focus(); return; }
      if (e.key === "Escape") { var p = $("#searchPop"); if (p) p.hidden = true; return; }
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        var m = (location.hash || "").match(/^#\/c\/([\w-]+)\/([\w-]+)$/);
        if (m) {
          var cur = isDone(m[2]);
          markDone(m[2], !cur);
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

  /* ==================================================== 启动 */
  function boot() {
    if (!courses.length) {
      $("#content").appendChild(el("div", "empty",
        "没有加载到课程数据。<br>请确认 data/ 目录下的课程文件存在，并且是通过 index.html 打开本页面。"));
      return;
    }
    bind();
    bindSidebarNav();
    render();
    var nLessons = courses.reduce(function (n, c) { return n + (c.lessons || []).length; }, 0);
    console.log("[哲学学习站] 已加载 " + courses.length + " 门课 / " + nLessons + " 讲 / " + cardStats().total + " 张闪卡");
  }
  global.APP = {
    courses: courses, lessonIndex: lessonIndex, render: render, navigate: navigate,
    progress: { state: function () { return state; }, cardStats: cardStats, globalStat: globalStat }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window);
