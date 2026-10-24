#!/usr/bin/env node
/**
 * ① 课时页接入"本讲自检清单"（自动合成：交互实验的 tasks + 通用自检项）
 * ② 顶栏加"📄 学习报告"按钮：把进度/错题/勾选导出为 Markdown
 * 幂等；写回前语法校验。用法：node <site>/tools/add-report-ui.mjs <cs|math>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const SITE = resolve(process.argv[2] || "cs");
const P = join(SITE, "app", "app.js");
let src = readFileSync(P, "utf8");
const log = [];

/* ---------- ① 自检清单：在测验渲染之前插入 ---------- */
if (!src.includes("buildChecklist")) {
  const anchor = "    // 测验\n    var quizHost = el(\"div\");";
  if (src.includes(anchor)) {
    const block = `    // 本讲自检清单（自动合成：优先用交互实验里的动手任务，再补通用自检项）
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

${anchor}`;
    src = src.replace(anchor, block);
    log.push("① 课时页已接入自检清单（自动合成）");
  } else log.push("① 找不到测验渲染锚点");
} else log.push("① 自检清单已存在");

/* ---------- ② 顶栏加"学习报告"按钮 ---------- */
if (!src.includes("btnReport")) {
  const barAnchor = '<button class="btn ghost sm" id="btnData" title="导出 / 导入学习进度">💾 数据</button>';
  const idx = src.indexOf(barAnchor);
  if (idx >= 0) {
    // 注意：这一处在 index.html 里，不在 app.js；此处只登记，稍后由脚本改 index.html
    log.push("② 需要改 index.html 加按钮（下一步处理）");
  } else log.push("② app.js 里没有按钮锚点（预期：按钮在 index.html）");
} else log.push("② 按钮已存在");

/* ---------- ③ 报告导出函数 ---------- */
if (!src.includes("exportStudyReport")) {
  const anchor2 = "  /* ============================================================ 搜索 */";
  if (src.includes(anchor2)) {
    const fn = `  /* ======================================================== 学习报告导出 */
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
    return L.join("\\n");
  }

`;
    src = src.replace(anchor2, fn + anchor2);
    log.push("③ 已加 studyReport() 导出函数");
  } else log.push("③ 找不到插入锚点");
} else log.push("③ 导出函数已存在");

try { new Function("window", "globalThis", src + ";"); }
catch (e) { console.log("✗ 语法失败，未写回：" + e.message); process.exit(1); }
writeFileSync(P, src, "utf8");
console.log(log.join("\n"));
console.log("已写回 " + P);
