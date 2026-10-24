/* ==========================================================================
   cards.js —— 闪卡与间隔重复（SM-2 简化版）

   为什么物理站需要它：物理学有一大批「必须张口就来」的东西——公式、常量与量级、
   定律的成立条件、单位与量纲。这些东西靠读几遍记不住，必须按「快要忘记时再考一次」
   的节奏反复出现。

   调度状态存在 PROGRESS 的 state.cards 里（跟着学习进度一起导出/同步）：
     cardId -> { reps, lapses, ease, interval, due, updated }
   评级（0~3）与调度：
     0 完全不会 → 10 分钟后重来，熟练度 -0.20，lapses+1
     1 模糊     → 1 天后重来，  熟练度 -0.10
     2 记得     → 间隔 × ease
     3 很熟     → 间隔 × ease × 1.3，熟练度 +0.10
   ease 夹在 [1.3, 2.8]，间隔上限 180 天。
   ========================================================================== */
(function (global) {
  "use strict";

  var MIN = 60000, DAY = 86400000;
  var EASE0 = 2.5, EASE_MIN = 1.3, EASE_MAX = 2.8, MAX_DAYS = 180;

  function now() { return Date.now(); }
  function cards() {
    var st = global.PROGRESS.state();
    if (!st.cards) st.cards = {};
    return st.cards;
  }
  function get(id) { return cards()[id] || null; }
  function isDue(id, t) {
    var r = get(id);
    if (!r) return true;                   // 从没考过 → 到期
    if (!r.due) return true;
    return r.due <= (t || now());
  }
  function dueTime(id) { var r = get(id); return r && r.due ? r.due : 0; }

  /** 评级并写回调度状态；返回 { interval, due, ease } 供界面回显 */
  function grade(id, q) {
    var map = cards();
    var r = map[id] || { reps: 0, lapses: 0, ease: EASE0, interval: 0 };
    q = Math.max(0, Math.min(3, q | 0));
    r.reps = (r.reps || 0) + 1;
    var days;
    if (q === 0) {
      r.lapses = (r.lapses || 0) + 1;
      r.ease = Math.max(EASE_MIN, (r.ease || EASE0) - 0.20);
      r.interval = 0;
      days = 10 / (24 * 60);               // 10 分钟
    } else if (q === 1) {
      r.ease = Math.max(EASE_MIN, (r.ease || EASE0) - 0.10);
      r.interval = 1;
      days = 1;
    } else if (q === 2) {
      r.ease = r.ease || EASE0;
      r.interval = r.interval ? Math.min(MAX_DAYS, Math.max(1, r.interval * r.ease)) : 1;
      days = r.interval;
    } else {
      r.ease = Math.min(EASE_MAX, (r.ease || EASE0) + 0.10);
      r.interval = r.interval ? Math.min(MAX_DAYS, Math.max(1, r.interval * r.ease * 1.3)) : 3;
      days = r.interval;
    }
    r.updated = now();
    r.due = now() + Math.round(days * DAY);
    map[id] = r;
    global.PROGRESS.save();
    return r;
  }

  /** 收集闪卡：courseId 为空则全站 */
  function collect(courses, courseId) {
    var out = [];
    (courses || []).forEach(function (c) {
      if (courseId && c.id !== courseId) return;
      (c.lessons || []).forEach(function (l) {
        (l.flashcards || []).forEach(function (f) {
          out.push({ card: f, lesson: l, course: c });
        });
      });
    });
    return out;
  }

  function dueCount(courses, courseId) {
    var t = now();
    return collect(courses, courseId).filter(function (x) { return isDue(x.card.id, t); }).length;
  }
  function totalCount(courses, courseId) {
    return collect(courses, courseId).length;
  }

  /** 人类可读的间隔 */
  function humanDue(r) {
    if (!r || !r.due) return "未学";
    var ms = r.due - now();
    if (ms <= 0) return "现在到期";
    if (ms < 3600000) return Math.ceil(ms / MIN) + " 分钟后";
    if (ms < DAY) return Math.ceil(ms / 3600000) + " 小时后";
    return Math.ceil(ms / DAY) + " 天后";
  }

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  var KIND_ICON = {
    "公式": "📐", "常量": "🔢", "量级": "📊", "定律": "⚖",
    "单位": "📏", "方法": "🛠", "概念": "💡", "实验": "🧪"
  };

  /**
   * 渲染一段闪卡练习。opts = { cards:[{card,lesson,course}], empty:string, onProgress(done,total) }
   * 一次只显示一张：先看正面 → 点「显示答案」→ 四个评级按钮。
   */
  function render(host, list, opts) {
    opts = opts || {};
    host.innerHTML = "";
    var queue = list.slice();
    if (!queue.length) {
      host.appendChild(el("div", "empty", opts.empty || "这里暂时没有到期的闪卡。"));
      return;
    }
    var idx = 0, done = 0;

    var bar = el("div", "lab-bar");
    var counter = el("div", "lab-stat");
    bar.appendChild(el("div", "spacer"));
    bar.appendChild(counter);
    host.appendChild(bar);

    var stage = el("div", "card-stage");
    host.appendChild(stage);

    function draw() {
      stage.innerHTML = "";
      if (idx >= queue.length) {
        stage.appendChild(el("div", "empty",
          "🎉 这一轮 " + done + " 张已过完。下次到期时间已排好，明天再来。"));
        counter.textContent = "已复习 " + done + " / " + queue.length;
        if (opts.onProgress) opts.onProgress(done, queue.length);
        return;
      }
      var item = queue[idx];
      var c = item.card;
      counter.textContent = "第 " + (idx + 1) + " / " + queue.length + " 张";

      var box = el("div", "flash-card");
      var kind = c.kind || "概念";
      box.appendChild(el("div", "fc-kind", (KIND_ICON[kind] || "💡") + " " + MD.escapeHtml(kind) +
        " · " + MD.escapeHtml(item.course.title) + " · " + MD.escapeHtml(item.lesson.title)));
      box.appendChild(el("div", "fc-front md", MD.md(c.front || "")));

      var back = el("div", "fc-back md hidden");
      back.innerHTML = MD.md(c.back || "");
      if (c.why) back.innerHTML += "<div class='note-line'>" + MD.md(c.why) + "</div>";
      box.appendChild(back);

      var reveal = el("button", "btn primary", "👁 显示答案");
      var rate = el("div", "flash-rate hidden");
      reveal.addEventListener("click", function () {
        back.classList.remove("hidden");
        reveal.classList.add("hidden");
        rate.classList.remove("hidden");
      });
      [["完全不会", 0, "bad"], ["模糊", 1, "warn"], ["记得", 2, ""], ["很熟", 3, "ok"]]
        .forEach(function (g) {
          var b = el("button", "btn sm " + g[2], g[0]);
          b.addEventListener("click", function () {
            var r = grade(c.id, g[1]);
            done++;
            idx++;
            if (g[1] === 0) {
              // 「完全不会」：插到队尾，10 分钟后自然还会到期；这里让它在本轮末尾再出现一次
              queue.push(item);
            }
            void r;
            draw();
          });
          rate.appendChild(b);
        });

      box.appendChild(reveal);
      box.appendChild(rate);
      if (global.MD && MD.md) stage.appendChild(box);
      if (opts.onProgress) opts.onProgress(done, queue.length);
    }
    draw();
  }

  global.CARDS = {
    get: get,
    isDue: isDue,
    dueTime: dueTime,
    grade: grade,
    collect: collect,
    dueCount: dueCount,
    totalCount: totalCount,
    humanDue: humanDue,
    render: render,
    KIND_ICON: KIND_ICON
  };
})(window);
