/* ==========================================================================
   quiz.js —— 随堂测验渲染 + 判分 + 讲解（零依赖）
   题型：single 单选 / multi 多选 / fill 填空 / order 排序
   ========================================================================== */
(function (global) {
  "use strict";

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function normalize(s) {
    return String(s == null ? "" : s)
      .replace(/\s+/g, "")
      .replace(/[（）]/g, function (m) { return m === "（" ? "(" : ")"; })
      .replace(/[，。；：、,.;:]/g, "")
      .replace(/[＝]/g, "=")
      .replace(/[×]/g, "*")
      .replace(/[－—–]/g, "-")
      .replace(/["'`]/g, "")
      .toLowerCase();
  }
  function eq(a, b) { return normalize(a) === normalize(b); }

  /* ================================================================
     选项呈现顺序：确定性重排（消除「答案总在 B」的位置偏置）
     ----------------------------------------------------------------
     背景：题库里 78% 的单选题正确答案落在第 2 个位置（索引 1），
     且选项顺序固定不变。学员只要一路点 B 就能拿约 78 分，测验
     因此失去检验作用（实测：cs 站同口径是 44.7%）。

     做法：按「题目 id」算一个稳定哈希，用它对选项做一次置换。
        · 确定性：同一道题每次进来顺序一致，不会让人困惑
        · 无关性：顺序与正确答案无关，只剩 25% 概率落在任一位置
        · 无数据改动：题库文件保持原样，重排在渲染层完成

     ★ 必须同时重映射 why 里的字母引用（90% 的解析都写「正确项是 B：
       A 与 C 都…」）。映射是「原位置 → 新位置」的正向置换：原 A 的
       内容现在显示在某个新字母上，所以 why 里说 A 的地方要改成那个新
       字母。若只打乱选项而不同步改解析，讲解会全部指错 —— 那比偏置更糟。
     ================================================================ */
  var LETTERS = "ABCDEFGH";

  /** 稳定的 32 位字符串哈希（FNV-1a 变体），只用于重排种子。 */
  function stableHash(str) {
    var h = 2166136261;
    var s = String(str == null ? "" : str);
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h >>> 0;
  }

  /**
   * 由种子生成一个置换数组 perm：显示在第 i 位的，是原来的第 perm[i] 个。
   * 用带种子的 Fisher-Yates + mulberry32 生成器，保证确定性。
   *
   * ★ 这里刻意不用线性同余（LCG）。LCG 的低位周期极短，而这里取模的
   *   模数是 2/3/4 这种小整数（正好吃低位），实测会导致答案仍然堆在
   *   某一位（第一版用 LCG 时 B 位还占 49.7%、D 位只 0.9%）。
   *   mulberry32 有 avalanche 混淆，小模数下分布才接近均匀。
   */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function permutationFor(seed, n) {
    var arr = [];
    for (var i = 0; i < n; i++) arr.push(i);
    var rand = mulberry32(stableHash(seed));
    for (var k = n - 1; k > 0; k--) {
      var j = Math.floor(rand() * (k + 1));
      var t = arr[k]; arr[k] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /**
   * 把 why 里的选项字母按「原位置 → 新位置」改写。
   * pos: 数组，pos[原索引] = 新索引。
   * 只改独立出现的 A-H（前后都不能紧邻字母数字或连字符），
   * 以避开 A-1024、F-16 这类产品号/型号。
   */
  function remapWhyLetters(why, pos, n) {
    if (!why) return why;
    return String(why).replace(/(^|[^A-Za-z0-9\-])([A-H])(?![A-Za-z0-9\-])/g, function (m, pre, ch) {
      var origIdx = ch.charCodeAt(0) - 65;
      if (origIdx >= n) return m;                // 超出本题选项数量，不是选项引用
      var newIdx = pos[origIdx];
      if (newIdx == null || newIdx === origIdx) return m;
      return pre + LETTERS.charAt(newIdx);
    });
  }

  /**
   * 返回一道题的「呈现版本」：选项重排 + answer 重映射 + why 字母重映射。
   * 对 fill / order 原样返回（它们没有选项顺序问题）。
   * 幂等：已呈现过的题不再重排，避免嵌套调用造成双重置换。
   */
  function present(q) {
    if (!q) return q;
    if (q.type !== "single" && q.type !== "multi") return q;
    if (!q.options || q.options.length < 2) return q;
    if (q.__presented) return q;

    var n = q.options.length;
    var perm = permutationFor(String(q.id || q.q || "") + "#" + n, n);

    // perm[i] = 原索引；pos[原索引] = 新索引
    var pos = new Array(n);
    var newOptions = new Array(n);
    for (var i = 0; i < n; i++) {
      pos[perm[i]] = i;
      newOptions[i] = q.options[perm[i]];
    }

    var out = {};
    for (var k in q) if (Object.prototype.hasOwnProperty.call(q, k)) out[k] = q[k];
    out.options = newOptions;
    if (q.type === "single" && typeof q.answer === "number") {
      out.answer = pos[q.answer];
    } else if (q.type === "multi" && Array.isArray(q.answer)) {
      out.answer = q.answer.map(function (i) { return pos[i]; }).sort(function (a, b) { return a - b; });
    }
    out.why = remapWhyLetters(q.why, pos, n);
    out.__presented = true;
    return out;
  }

  /**
   * 数值答案比对：支持容差与分数。
   *  - 用户输入 "1/3"、"0.333"、"3.33e-1" 等都能解析
   *  - 参考答案写成 "0.3333" 与用户 "1/3" 视为相同（相对误差 1e-3，可用 tol 覆盖）
   *  - 题目可用 tol 字段指定容差，或 answer 里直接写区间 "0.32~0.34"
   */
  function toNumber(s) {
    var t = String(s == null ? "" : s).trim()
      .replace(/[，,]/g, "")
      .replace(/[（(]/g, "").replace(/[）)]/g, "")
      .replace(/[＝=]/g, "")
      .replace(/[×xX*]/g, "*")
      .replace(/÷/g, "/")
      .replace(/[－—–]/g, "-")
      .replace(/%$/, "");
    if (!t) return null;
    var m = /^(-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/.exec(t);
    if (m) {
      var d = parseFloat(m[2]);
      if (d === 0) return null;
      return parseFloat(m[1]) / d;
    }
    if (!/^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(t)) return null;
    var v = parseFloat(t);
    return isNaN(v) ? null : v;
  }

  function numericEq(userText, refText, tol) {
    // 区间写法：0.32~0.34
    var range = /^(-?[\d.]+)\s*[~～]\s*(-?[\d.]+)$/.exec(String(refText).trim());
    var u = toNumber(userText);
    if (u == null) return false;
    if (range) {
      var lo = parseFloat(range[1]), hi = parseFloat(range[2]);
      return u >= Math.min(lo, hi) - 1e-12 && u <= Math.max(lo, hi) + 1e-12;
    }
    var r = toNumber(refText);
    if (r == null) return false;
    var t = typeof tol === "number" && tol > 0 ? tol : 1e-3;
    var diff = Math.abs(u - r);
    return diff <= t || diff <= t * Math.abs(r);
  }

  function gradeFill(q, picked) {
    var refs = q.answer || [];
    if (q.numeric) return refs.some(function (a) { return numericEq(picked, a, q.tol); });
    if (refs.some(function (a) { return eq(a, picked); })) return true;
    // 即使没标 numeric，只要参考答案是纯数字/分数，也按数值比对（宽松一点更符合直觉）
    if (refs.some(function (a) { return toNumber(a) != null; }) && toNumber(picked) != null) {
      return refs.some(function (a) { return numericEq(picked, a, q.tol); });
    }
    return false;
  }

  var TYPE_LABEL = { single: "单选", multi: "多选", fill: "填空", order: "排序" };

  /**
   * @param host       容器
   * @param quiz       题数组
   * @param opts       { scope, onGraded(result), record:bool }
   *   result = { q, correct, picked, total }
   */
  function render(host, quiz, opts) {
    opts = opts || {};
    var questions = quiz || [];
    var gradedCount = 0, correctCount = 0;

    var wrap = el("div", "quiz-wrap");
    if (!opts.hideTitle) wrap.appendChild(el("h2", null, "随堂测验"));
    var head = el("div", "review-bar");
    var prog = el("div", "lab-stat", "共 " + questions.length + " 题 · 全部作答后自动判分并记录到错题本");
    head.appendChild(prog);
    var bClear = el("button", "btn sm ghost", "清空作答");
    head.appendChild(bClear);
    wrap.appendChild(head);

    function report() {
      if (opts.onGraded) opts.onGraded({ graded: gradedCount, correct: correctCount, total: questions.length });
      prog.textContent = "已判 " + gradedCount + " / " + questions.length + " 题，答对 " + correctCount + " 题" +
        (gradedCount === questions.length ? "（本课测验完成 🎉）" : "");
    }

    questions.forEach(function (q0, qi) {
      // 呈现版本：选项确定性重排 + answer/why 字母同步重映射（见文件顶部 present 注释）
      var q = present(q0);
      var card = el("div", "qcard");
      var head2 = el("div", "qhead");
      head2.appendChild(el("div", "no", "Q" + (qi + 1)));
      head2.appendChild(el("div", "q", MD.md(q.q)));
      head2.appendChild(el("span", "badge", TYPE_LABEL[q.type] || q.type));
      card.appendChild(head2);

      var body = el("div");
      card.appendChild(body);
      var picked = null;      // single: index | multi: array | fill: text | order: array
      var slot = [];          // order 用
      var locked = false;

      var opts_els = [];
      var fillInput = null;
      var pool = null, slotBox = null;

      if (q.type === "single" || q.type === "multi") {
        // ★ multi 也用字母标号：题库解析里一律写「A、B、C」「D 恰恰不可靠」，
        //   若界面显示 1/2/3/4，解析就对不上选项。单选与多选统一用字母。
        (q.options || []).forEach(function (text, oi) {
          var o = el("div", "opt");
          o.innerHTML = "<div class='mk'>" + String.fromCharCode(65 + oi) + "</div><div>" + MD.md(text) + "</div>";
          o.addEventListener("click", function () {
            if (locked) return;
            if (q.type === "single") {
              picked = oi;
              opts_els.forEach(function (x) { x.classList.remove("picked"); });
              o.classList.add("picked");
            } else {
              if (!picked) picked = [];
              var at = picked.indexOf(oi);
              if (at >= 0) picked.splice(at, 1); else picked.push(oi);
              o.classList.toggle("picked", at < 0);
            }
          });
          opts_els.push(o);
          body.appendChild(o);
        });
      } else if (q.type === "fill") {
        fillInput = el("input", "fill-in");
        fillInput.placeholder = "在此输入答案后按回车或点「提交」";
        fillInput.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
        body.appendChild(fillInput);
      } else if (q.type === "order") {
        slotBox = el("div", "order-slot");
        pool = el("div", "order-pool");
        var items = (q.items || []).map(function (t, i) { return { t: t, i: i }; });
        // 展示顺序固定为原序，避免每次都变造成困惑
        items.forEach(function (it) {
          var chip = el("div", "order-item", MD.md(it.t));
          chip.dataset.i = String(it.i);
          chip.addEventListener("click", function () {
            if (locked) return;
            if (chip.parentNode === pool) { slotBox.appendChild(chip); }
            else { pool.appendChild(chip); }
          });
          pool.appendChild(chip);
        });
        body.appendChild(el("div", "note-line", "点击下方选项 → 依次放入上方顺序框；点击已放入的选项可取回。"));
        body.appendChild(slotBox);
        body.appendChild(pool);
      }

      var feedback = el("div", "feedback");
      card.appendChild(feedback);

      var act = el("div", "qact");
      var bSubmit = el("button", "btn sm primary", "提交作答");
      var bRetry = el("button", "btn sm ghost", "重做本题");
      bRetry.style.display = "none";
      act.appendChild(bSubmit); act.appendChild(bRetry);
      card.appendChild(act);

      function grade() {
        if (q.type === "single") return picked != null && picked === q.answer;
        if (q.type === "multi") {
          if (!picked) return false;
          var a = picked.slice().sort(function (x, y) { return x - y; });
          var b = (q.answer || []).slice().sort(function (x, y) { return x - y; });
          return a.length === b.length && a.every(function (v, i) { return v === b[i]; });
        }
        if (q.type === "fill") return gradeFill(q, picked);
        if (q.type === "order") {
          if (slot.length !== (q.items || []).length) return false;
          return slot.every(function (v, i) { return v === q.answer[i]; });
        }
        return false;
      }

      function answerText() {
        if (q.type === "single") return (q.options || [])[q.answer] || "";
        if (q.type === "multi") return (q.answer || []).map(function (i) { return (q.options || [])[i]; }).join("；");
        if (q.type === "fill") return (q.answer || [])[0] || "";
        if (q.type === "order") return (q.answer || []).map(function (i) { return (q.items || [])[i]; }).join(" → ");
        return "";
      }

      function submit() {
        if (locked) return;
        if (q.type === "fill") picked = fillInput ? fillInput.value : "";
        if (q.type === "order") {
          slot = Array.prototype.map.call(slotBox.querySelectorAll(".order-item"), function (n) { return Number(n.dataset.i); });
          if (slot.length === 0) { feedback.className = "feedback show bad"; feedback.innerHTML = "<div class='res'>还没有排序</div>"; return; }
        }
        if (q.type === "single" && picked == null) {
          feedback.className = "feedback show bad";
          feedback.innerHTML = "<div class='res'>请先选择一个选项</div>";
          return;
        }
        if (q.type === "multi" && (!picked || picked.length === 0)) {
          feedback.className = "feedback show bad";
          feedback.innerHTML = "<div class='res'>请至少选择一个选项</div>";
          return;
        }
        locked = true;
        var ok = grade();
        gradedCount++;
        if (ok) correctCount++;

        if (q.type === "single" || q.type === "multi") {
          var ans = q.type === "single" ? [q.answer] : (q.answer || []);
          opts_els.forEach(function (o, i) {
            o.classList.remove("picked");
            if (ans.indexOf(i) >= 0) o.classList.add("right");
            else if ((q.type === "single" ? picked === i : (picked || []).indexOf(i) >= 0)) o.classList.add("wrong");
          });
        }
        if (q.type === "fill" && fillInput) {
          fillInput.style.borderColor = ok ? "var(--ok)" : "var(--bad)";
        }
        if (q.type === "order" && slotBox) {
          slotBox.style.borderColor = ok ? "var(--ok)" : "var(--bad)";
        }

        feedback.className = "feedback show " + (ok ? "ok" : "bad");
        feedback.innerHTML =
          "<div class='res'>" + (ok ? "✓ 回答正确" : "✗ 回答错误") + "</div>" +
          (ok ? "" : "<div class='why'><b>正确答案：</b>" + MD.md(answerText()) + "</div>") +
          "<div class='why'><b>解析：</b>" + MD.md(q.why || "") + "</div>";
        bSubmit.style.display = "none";
        bRetry.style.display = "inline-block";

        if (opts.onAnswered) opts.onAnswered(q, ok, picked);
        report();
      }

      bSubmit.addEventListener("click", submit);
      bRetry.addEventListener("click", function () {
        locked = false;
        picked = null; slot = [];
        feedback.className = "feedback";
        feedback.innerHTML = "";
        opts_els.forEach(function (o) { o.classList.remove("picked", "right", "wrong"); });
        if (fillInput) { fillInput.value = ""; fillInput.style.borderColor = ""; }
        if (pool && slotBox) {
          Array.prototype.slice.call(slotBox.querySelectorAll(".order-item")).forEach(function (n) { pool.appendChild(n); });
          slotBox.style.borderColor = "";
        }
        bSubmit.style.display = "inline-block";
        bRetry.style.display = "none";
      });

      wrap.appendChild(card);
    });

    bClear.addEventListener("click", function () {
      if (!global.confirm("清空本页所有作答？已记录的错题本条目不会删除。")) return;
      host.innerHTML = "";
      render(host, questions, opts);
    });

    host.appendChild(wrap);
    report();
  }

  /* ---------------------------------------------- 本讲自检清单（可选） */
  /**
   * 课程数据里可给 lesson.checklist 一个字符串数组，这里渲染成可勾选清单。
   * 勾选状态写进 localStorage（键 llm-learn:v1 的 checks 字段）。
   */
  function renderChecklist(host, lesson, opts) {
    var items = (lesson && lesson.checklist) || [];
    if (!items.length) return;
    opts = opts || {};
    var wrap = el("div", "block lab checklist-block");
    wrap.appendChild(el("h3", null, "✅ 本讲自检清单 <span class='tag'>做完再往下走</span>"));
    wrap.appendChild(el("div", "note-line", "逐条勾选。全部勾上说明这一讲你真的会了；有勾不上的，回去看对应的讲解块。"));
    var box = el("div");
    box.style.marginTop = "8px";
    var state = (opts.getState && opts.getState()) || {};
    items.forEach(function (text, i) {
      var row = el("label", "check-row");
      row.style.display = "flex";
      row.style.alignItems = "flex-start";
      row.style.gap = "8px";
      row.style.padding = "6px 0";
      row.style.cursor = "pointer";
      var cb = el("input");
      cb.type = "checkbox";
      cb.checked = !!state[i];
      cb.style.marginTop = "4px";
      cb.addEventListener("change", function () {
        if (opts.onToggle) opts.onToggle(i, cb.checked);
      });
      var span = el("span");
      span.innerHTML = MD.md(text);
      row.appendChild(cb);
      row.appendChild(span);
      box.appendChild(row);
    });
    wrap.appendChild(box);
    var foot = el("div", "lab-stat", "");
    function refresh() {
      var done = 0;
      Array.prototype.forEach.call(box.querySelectorAll("input"), function (c) { if (c.checked) done++; });
      foot.textContent = "已完成 " + done + " / " + items.length + (done === items.length ? " —— 这一讲可以过了 ✓" : "");
    }
    wrap.appendChild(foot);
    box.addEventListener("change", refresh);
    refresh();
    host.appendChild(wrap);
  }

  global.QUIZ = {
    render: render, renderChecklist: renderChecklist, normalize: normalize,
    numericEq: numericEq, gradeFill: gradeFill,
    // present 暴露出去供质量门与冒烟测试校验「重排是否确定性 + 是否为置换 + why 是否同步」
    present: present, permutationFor: permutationFor, stableHash: stableHash
  };
})(window);
