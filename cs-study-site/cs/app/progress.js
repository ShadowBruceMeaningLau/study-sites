/* ==========================================================================
   progress.js —— 学习进度、错题本、导出导入

   两层存储：
     1) localStorage —— 永远是第一写入，也是唯一的"离线真相"。服务器不可达、
        断网、用 file:// 双击打开时，一切照旧（这才是零依赖的底线）。
     2) 服务器（可选）—— 当页面是通过本地服务器打开时（手机和电脑连同一台
        serve.mjs），进度会同步到 <站点>/.progress/ 下的一个 json，
        于是手机和电脑共用同一份进度。

   改这个文件请守住三条：
     · 先写本地，再尝试推送；推送失败只改状态提示，不打断学习、不弹错误；
     · 拉不到服务器时不要用本地数据去覆盖它（等下一次拿到再合并后推送）；
     · 合并以记录里已有的时间戳为准（updated / lastWrong / lastRight），
       计数类字段取两边较大值，所以"单调不减"，不会虚增也不会把进度算丢。
   ========================================================================== */
(function (global) {
  "use strict";

  var KEY = "cs-learn:v1";

  var DEFAULT = {
    version: 1,
    lessons: {},   // lessonId -> { status: 'read'|'done', updated, visits }
    quiz: {},      // lessonId -> { attempted, correct, updated }
    mistakes: {},  // qid -> { qid, lessonId, courseId, q, type, picked, correct, answer, why, count, lastWrong, retried }
    prefs: { theme: "dark", lastLesson: null },
    stats: { startedAt: Date.now(), minutes: 0, lessonsRead: 0 }
  };

  var state = load();

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function load() {
    try {
      var raw = global.localStorage.getItem(KEY);
      if (!raw) return clone(DEFAULT);
      var parsed = JSON.parse(raw);
      return Object.assign(clone(DEFAULT), parsed, {
        prefs: Object.assign(clone(DEFAULT.prefs), parsed.prefs || {}),
        stats: Object.assign(clone(DEFAULT.stats), parsed.stats || {})
      });
    } catch (e) {
      return clone(DEFAULT);
    }
  }

  /* ------------------------------------------------------------- 同步状态 */
  var SYNC = {
    enabled: false,   // 是否具备同步条件（http(s) 打开 + 浏览器支持 fetch）
    pulled: false,    // 是否成功拿到过服务器那份（没拿到之前不推送，避免覆盖）
    dirty: false,     // 拉取前发生过改动，合并完要补推一次
    status: "local",  // local(同步中) | synced | error(仅本机) | off(没有服务器)
    timer: null,
    listeners: [],
    mergedListeners: []
  };
  var SYNC_URL = "/api/progress/" + encodeURIComponent(KEY);

  function setStatus(s) {
    if (SYNC.status === s) return;
    SYNC.status = s;
    for (var i = 0; i < SYNC.listeners.length; i++) {
      try { SYNC.listeners[i](s); } catch (e) { /* 指示器出错不影响学习 */ }
    }
  }
  function notifyMerged() {
    for (var i = 0; i < SYNC.mergedListeners.length; i++) {
      try { SYNC.mergedListeners[i](); } catch (e) { /* 重绘失败不影响数据 */ }
    }
  }

  function save() {
    var okLocal = true;
    try { global.localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { okLocal = false; }
    schedulePush();
    return okLocal;
  }

  /* --------------------------------------------------------- 合并两份数据 */
  var TS_KEYS = ["updated", "lastWrong", "lastRight"];
  var COUNTERS = ["visits", "attempted", "correct", "count", "retried", "minutes", "lessonsRead"];

  function recTime(r) {
    if (!r) return 0;
    var t = 0;
    for (var i = 0; i < TS_KEYS.length; i++) t = Math.max(t, r[TS_KEYS[i]] || 0);
    return t;
  }
  /** 同一条记录在两台设备上都有：取时间新的那份，计数类字段取较大值 */
  function mergeRec(a, b) {
    if (!a) return clone(b);
    if (!b) return clone(a);
    var newer = recTime(b) > recTime(a) ? b : a;
    var older = newer === a ? b : a;
    var out = Object.assign(clone(older), clone(newer));
    for (var i = 0; i < COUNTERS.length; i++) {
      var k = COUNTERS[i];
      if (a[k] != null || b[k] != null) out[k] = Math.max(a[k] || 0, b[k] || 0);
    }
    return out;
  }
  function mergeMap(a, b) {
    a = a || {}; b = b || {};
    var out = {};
    Object.keys(a).forEach(function (k) { out[k] = clone(a[k]); });
    Object.keys(b).forEach(function (k) { out[k] = out[k] ? mergeRec(out[k], b[k]) : clone(b[k]); });
    return out;
  }
  function mergeState(local, remote) {
    if (!remote || typeof remote !== "object" || !remote.lessons) return local;
    var out = Object.assign(clone(DEFAULT), clone(local));
    out.version = 1;
    out.lessons = mergeMap(local.lessons, remote.lessons);
    out.quiz = mergeMap(local.quiz, remote.quiz);
    out.mistakes = mergeMap(local.mistakes, remote.mistakes);
    var ls = local.stats || {}, rs = remote.stats || {};
    out.stats = {
      startedAt: Math.min(ls.startedAt || rs.startedAt || Date.now(), rs.startedAt || ls.startedAt || Date.now()),
      minutes: Math.max(ls.minutes || 0, rs.minutes || 0),
      lessonsRead: Math.max(ls.lessonsRead || 0, rs.lessonsRead || 0)
    };
    // prefs 是本机偏好（主题等），保持本机；只有本机还没记录时才采用服务器那份
    var lp = (local.prefs || {}).lastLesson, rp = (remote.prefs || {}).lastLesson;
    if (!lp && rp) out.prefs.lastLesson = rp;
    return out;
  }

  /* ------------------------------------------------------- 推送 / 拉取 */
  function pushNow() {
    if (!SYNC.enabled) return;
    SYNC.dirty = false;
    global.fetch(SYNC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
      cache: "no-store"
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      setStatus("synced");
    }).catch(function () {
      setStatus("error");
    });
  }
  function schedulePush() {
    if (!SYNC.enabled) return;
    if (!SYNC.pulled) { SYNC.dirty = true; return; }   // 还没拿到服务器那份，先别推，免得盖掉更新的进度
    if (SYNC.timer) global.clearTimeout(SYNC.timer);
    SYNC.timer = global.setTimeout(pushNow, 700);      // 防抖：连续答题只推一次
  }
  function pull() {
    if (!SYNC.enabled) return;
    if (SYNC.status !== "synced") setStatus("local");
    global.fetch(SYNC_URL, { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (remote) {
        var merged = mergeState(state, remote);
        var changed = JSON.stringify(merged) !== JSON.stringify(state);
        state = merged;
        SYNC.pulled = true;
        try { global.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 忽略 */ }
        setStatus("synced");
        pushNow();                 // 把合并结果写回服务器；服务器还空着时相当于首次播种
        if (changed) notifyMerged();
      })
      .catch(function () {
        // 拿不到就维持"仅本机"：不推、不覆盖，等下一次拉取成功后自然补推
        SYNC.pulled = false;
        setStatus("error");
        if (SYNC.retry) global.clearTimeout(SYNC.retry);
        SYNC.retry = global.setTimeout(pull, 8000);
      });
  }
  function initSync() {
    if (typeof global.fetch !== "function") { setStatus("off"); return; }
    var proto = (global.location && global.location.protocol) || "";
    if (proto !== "http:" && proto !== "https:") { setStatus("off"); return; }  // file:// 直接打开：纯本地
    SYNC.enabled = true;
    pull();
    // 回到这个标签页 / 窗口重新获得焦点时，再对一次（在手机上刷完题切回电脑就能看到）
    global.addEventListener("focus", function () { if (SYNC.enabled) pull(); });
    if (global.document) {
      global.document.addEventListener("visibilitychange", function () {
        if (SYNC.enabled && !global.document.hidden) pull();
      });
    }
  }

  /* ------------------------------------------------------------- 业务逻辑 */
  function markVisit(lessonId) {
    var rec = state.lessons[lessonId] || { status: "unread", updated: 0, visits: 0 };
    rec.visits = (rec.visits || 0) + 1;
    if (rec.status !== "done") rec.status = "read";
    rec.updated = Date.now();
    state.lessons[lessonId] = rec;
    save();
  }
  function markDone(lessonId, done) {
    var rec = state.lessons[lessonId] || { status: "unread", updated: 0, visits: 0 };
    rec.status = done ? "done" : "read";
    rec.updated = Date.now();
    state.lessons[lessonId] = rec;
    save();
  }
  function isDone(lessonId) { return (state.lessons[lessonId] || {}).status === "done"; }
  function lessonState(lessonId) { return (state.lessons[lessonId] || {}).status || "unread"; }

  function recordQuiz(lessonId, courseId, q, ok, picked) {
    var rec = state.quiz[lessonId] || { attempted: 0, correct: 0, updated: 0 };
    rec.attempted++;
    if (ok) rec.correct++;
    rec.updated = Date.now();
    state.quiz[lessonId] = rec;

    if (!ok) {
      var prev = state.mistakes[q.id] || { count: 0, retried: 0 };
      state.mistakes[q.id] = {
        qid: q.id, lessonId: lessonId, courseId: courseId,
        q: q.q, type: q.type, why: q.why, options: q.options || null,
        answer: q.answer, picked: picked == null ? null : picked,
        count: (prev.count || 0) + 1,
        lastWrong: Date.now(),
        retried: prev.retried || 0
      };
    } else if (state.mistakes[q.id]) {
      state.mistakes[q.id].retried = (state.mistakes[q.id].retried || 0) + 1;
      state.mistakes[q.id].lastRight = Date.now();
    }
    save();
  }

  function removeMistake(qid) { if (state.mistakes[qid]) { delete state.mistakes[qid]; save(); } }
  function clearMistakes() { state.mistakes = {}; save(); }
  function mistakes() { return Object.keys(state.mistakes).map(function (k) { return state.mistakes[k]; }); }

  function setPref(k, v) { state.prefs[k] = v; save(); }
  function getPref(k) { return state.prefs[k]; }
  function addMinutes(m) { state.stats.minutes = (state.stats.minutes || 0) + m; save(); }

  function exportJson() { return JSON.stringify(state, null, 2); }
  function importJson(text) {
    var parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || !parsed.lessons) throw new Error("格式不正确：缺少 lessons 字段");
    state = Object.assign(clone(DEFAULT), parsed);
    save();
    return true;
  }
  function resetAll() { state = clone(DEFAULT); save(); }

  /** 课程聚合统计 */
  function courseStat(course) {
    var lessons = (course.lessons || []);
    var done = lessons.filter(function (l) { return isDone(l.id); }).length;
    var read = lessons.filter(function (l) { return lessonState(l.id) !== "unread"; }).length;
    var attempted = 0, correct = 0, quizTotal = 0;
    lessons.forEach(function (l) {
      quizTotal += (l.quiz || []).length;
      var q = state.quiz[l.id];
      if (q) { attempted += q.attempted; correct += q.correct; }
    });
    return {
      total: lessons.length, done: done, read: read,
      pct: lessons.length ? Math.round((done / lessons.length) * 100) : 0,
      quizTotal: quizTotal, attempted: attempted, correct: correct,
      accuracy: attempted ? Math.round((correct / attempted) * 100) : null
    };
  }

  function globalStat(courses) {
    var t = { lessons: 0, done: 0, read: 0, quiz: 0, attempted: 0, correct: 0, mistakes: mistakes().length };
    (courses || []).forEach(function (c) {
      var s = courseStat(c);
      t.lessons += s.total; t.done += s.done; t.read += s.read;
      t.quiz += s.quizTotal; t.attempted += s.attempted; t.correct += s.correct;
    });
    t.pct = t.lessons ? Math.round((t.done / t.lessons) * 100) : 0;
    t.accuracy = t.attempted ? Math.round((t.correct / t.attempted) * 100) : null;
    return t;
  }

  /** 找出掌握最弱的课（错题多、正确率低） */
  function weakLessons(courses, limit) {
    var rows = [];
    (courses || []).forEach(function (c) {
      (c.lessons || []).forEach(function (l) {
        var q = state.quiz[l.id];
        var wrong = mistakes().filter(function (m) { return m.lessonId === l.id; }).length;
        if (!q || q.attempted === 0) {
          if (wrong > 0) rows.push({ course: c, lesson: l, score: wrong * 2, accuracy: 0, attempted: 0, wrong: wrong });
          return;
        }
        var acc = q.correct / q.attempted;
        var score = (1 - acc) * 10 + wrong;
        if (acc < 1 || wrong > 0) rows.push({ course: c, lesson: l, score: score, accuracy: acc, attempted: q.attempted, wrong: wrong });
      });
    });
    rows.sort(function (a, b) { return b.score - a.score; });
    return rows.slice(0, limit || 8);
  }

  global.PROGRESS = {
    state: function () { return state; },
    save: save,
    markVisit: markVisit,
    markDone: markDone,
    isDone: isDone,
    lessonState: lessonState,
    recordQuiz: recordQuiz,
    mistakes: mistakes,
    removeMistake: removeMistake,
    clearMistakes: clearMistakes,
    setPref: setPref,
    getPref: getPref,
    addMinutes: addMinutes,
    exportJson: exportJson,
    importJson: importJson,
    resetAll: resetAll,
    courseStat: courseStat,
    globalStat: globalStat,
    weakLessons: weakLessons,
    // ---- 同步（可选功能；app.js 负责显示状态、重绘界面）----
    initSync: initSync,
    syncNow: pull,
    syncStatus: function () { return SYNC.enabled ? SYNC.status : "off"; },
    onSync: function (cb) {
      SYNC.listeners.push(cb);
      try { cb(SYNC.status); } catch (e) { /* 忽略 */ }
    },
    onMerged: function (cb) { SYNC.mergedListeners.push(cb); }
  };
})(window);
