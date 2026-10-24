#!/usr/bin/env node
/**
 * 新增「能力路线图」页面：按领域聚合各课的进阶包（经典教材 / 招牌 lab / 从零实现 / 验收判据），
 * 并给出"学到很好程度"的四级判据与自我检验清单。不设时间节点，只讲顺序与前置。
 * 幂等；写回前语法校验。用法：node <site>/tools/add-roadmap-page.mjs <cs|math>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const SITE = resolve(process.argv[2] || "cs");
const P = join(SITE, "app", "app.js");
let src = readFileSync(P, "utf8");
const log = [];

if (src.includes("pageRoadmap")) { console.log("页面已存在，跳过"); process.exit(0); }

/* ① 路由 */
const routeAnchor = 'else if (h === "#/glossary") pageGlossary();';
if (src.includes(routeAnchor)) {
  src = src.replace(routeAnchor, routeAnchor + '\n    else if (h === "#/roadmap") pageRoadmap();');
  log.push("① 路由已加 #/roadmap");
} else log.push("① 路由锚点未找到");

/* ② 侧边栏入口 */
const navAnchor = 'nav.appendChild(navRow("#/glossary"';
const navLine = src.split("\n").find((l) => l.includes(navAnchor));
if (navLine) {
  src = src.replace(navLine, navLine + '\n    nav.appendChild(navRow("#/roadmap", "<span class=\'ico\'>🎯</span><span class=\'nm\'>能力路线图</span>"));');
  log.push("② 侧边栏已加「能力路线图」");
} else log.push("② 侧边栏锚点未找到");

/* ③ 页面函数 */
const fn = `/* ========================================================== 页面：能力路线图 */
  /**
   * 聚合每门课的 advanced 进阶包（教材/lab/项目/判据），按领域分组。
   * 设计原则：不设时间节点，只用「顺序 + 前置 + 验收判据」标定掌握程度。
   */
  function pageRoadmap() {
    var c = $("#content");
    c.innerHTML = "";
    setCrumbs([{ text: "总览", route: "#/" }, { text: "能力路线图" }]);
    var wrap = el("div", "wrap");
    wrap.appendChild(el("h1", "page-title", "🎯 能力路线图：从"学会"到"学到很好""));
    wrap.appendChild(el("p", "lead",
      "本站课程负责"概念校准"（第一层）。要到达"很好"，还要走完后面三层：经典教材精读 → 真实系统实现 → 创造与输出。" +
      "下面每门课都给了配书、招牌实验、从零实现的项目与验收判据。**只讲顺序与前置，不设时间节点**——" +
      "你的判据是"这一层的验收标准做到了吗"，而不是"学了多久"。"));

    // 四级判据
    var lv = el("div", "block concept");
    lv.innerHTML = "<h3>什么是「学到很好的程度」<span class='tag'>四个硬指标</span></h3>" + MD.md([
      "1. **能重建**：给你一张白纸，能从零写出这个领域最核心的机制（内存分配器、调度器、编译器后端、Raft）。",
      "2. **能诊断**：给一段坏代码或一个慢系统，能定位到是局部性、锁竞争、伪共享还是算法问题。",
      "3. **能讲清**：能对没学过的人讲明白，并回答"为什么不用另一种做法"。",
      "4. **能被引用**：你写的东西真的有人用（项目、文章、被合并的 PR）。",
      "",
      "> 只到 1、2 是"很强"；加上 3、4 才是"很好"。第 4 条是自学最容易漏掉的一环——它必须由外部世界给，不能自己发给自己。"
    ].join("\\n"));
    wrap.appendChild(lv);

    // 学习顺序（只讲前置关系）
    var order = el("div", "block steps");
    order.innerHTML = "<h3>顺序与前置关系 <span class='tag'>不设时间，只看前置</span></h3>" + MD.md([
      "- **第一圈（打地基）**：程序设计基础 → 数字逻辑 → 数据结构 → 算法 → 计算机组成原理 → 操作系统 → 计算机网络 → 数据库。",
      "- **第二圈（补理论与工程）**：离散数学、编译原理、计算理论、信息安全、并行与分布式、软件工程。",
      "- **第三圈（深挖方向）**：体系结构、领域专用（AI/ML、图形、嵌入式……）。",
      "",
      "跨圈是允许的：如果一个领域让你特别兴奋，先深挖它，回头再补前置——但**倒着学必修会卡住**：",
      "操作系统的 xv6 lab 需要 C 和指针；编译器的后端需要数据结构与体系结构；分布式共识需要网络与并发。",
      "",
      "> 每门课页面顶部的「🎒 学这门课之前」会直接告诉你前置；本页每张卡片的"验收判据"告诉你什么时候算过关。"
    ].join("\\n"));
    wrap.appendChild(order);

    // 领域分组
    var AREAS = [
      { name: "零基础与程序设计", ids: ["cs-zero-basics", "math-zero-basics", "programming-basics", "oop-java", "math-foundation", "discrete-math"] },
      { name: "系统底层（组成 / 体系结构 / 数字逻辑）", ids: ["digital-logic", "computer-organization", "computer-architecture", "systems-practice"] },
      { name: "操作系统与并发", ids: ["operating-systems", "parallel-distributed"] },
      { name: "网络与安全", ids: ["computer-networks", "information-security"] },
      { name: "数据与工程", ids: ["database-systems", "software-engineering"] },
      { name: "算法与理论", ids: ["data-structures", "ds-sorting-searching", "ds-graph-advanced", "algorithms", "computation-theory", "cs408-intensive", "cs408-drills"] },
      { name: "语言与编译器", ids: ["compilers", "ai-ml"] },
      { name: "数学分析主线", ids: ["math-analysis-1", "math-analysis-2", "math-analysis-3", "real-analysis", "functional-analysis", "complex-analysis", "fourier-analysis", "ode", "pde"] },
      { name: "代数与几何主线", ids: ["linear-algebra-1", "linear-algebra-2", "abstract-algebra", "analytic-geometry", "differential-geometry", "topology"] },
      { name: "随机与计算", ids: ["probability", "statistics", "numerical-analysis", "combinatorics"] },
      { name: "选修与人文", ids: ["number-theory", "set-theory", "math-history"] }
    ];

    var state = PROGRESS.state();
    state.roadmap = state.roadmap || {};

    function chip(txt, cls) { return "<span class='chip " + (cls || "") + "'>" + esc(txt) + "</span>"; }

    AREAS.forEach(function (area) {
      var cards = area.ids.map(function (id) { return courses.filter(function (x) { return x.id === id; })[0]; }).filter(Boolean);
      if (!cards.length) return;
      wrap.appendChild(el("h2", "sec", esc(area.name)));

      cards.forEach(function (co) {
        var adv = co.advanced;
        var box = el("div", "block concept");
        box.style.marginTop = "12px";
        var done = !!state.roadmap[co.id];
        box.innerHTML =
          "<h3>" + co.icon + " " + esc(co.title) +
          " <a class='chip accent' href='#/c/" + co.id + "'>进课程 →</a>" +
          (done ? " <span class='chip ok'>已通关</span>" : "") + "</h3>" +
          (adv
            ? "<div class='md'><b>📚 配书</b><ul>" + adv.texts.map(function (t) { return "<li>" + MD.md(t) + "</li>"; }).join("") + "</ul>" +
              "<b>🧪 招牌实验</b><ul>" + adv.labs.map(function (t) { return "<li>" + MD.md(t) + "</li>"; }).join("") + "</ul>" +
              "<b>🏗️ 从零实现</b><p>" + MD.md(adv.project) + "</p>" +
              "<b>✅ 验收判据</b><p>" + MD.md(adv.criteria) + "</p></div>"
            : "<div class='note-line'>（本课暂未收录进阶包）</div>");
        var foot = el("div", "review-bar");
        var btn = el("button", "btn sm " + (done ? "ok" : "ghost"), done ? "✓ 已通关（点击取消）" : "标记已通关");
        btn.addEventListener("click", function () {
          state.roadmap[co.id] = !done;
          PROGRESS.save();
          pageRoadmap();
        });
        foot.appendChild(btn);
        box.appendChild(foot);
        wrap.appendChild(box);
      });
    });

    // 自我检验清单
    var self = el("div", "block pitfall");
    self.innerHTML = "<h3>每周一次的自我检验 <span class='tag'>替代"外部压力"</span></h3>" + MD.md([
      "- 这一周我**交付**了什么能跑的东西？（不是"看了多少章"）",
      "- 这个东西**别人**能跑通吗？（README、依赖、测试齐全吗）",
      "- 这一周有没有**被人否定**过一次？（代码 review、提问被纠正、测试没过）",
      "- 我能不能**不看资料**讲清这周学的核心机制？",
      "",
      "> 四个问题里如果连续两周都是"没有"，说明你在舒适区里空转——纯兴趣学习最大的风险不是来不及，而是**无声地停下来**。"
    ].join("\\n"));
    wrap.appendChild(self);

    var exportBar = el("div", "review-bar");
    var bExp = el("button", "btn sm ghost", "📄 导出路线图进度（Markdown）");
    bExp.addEventListener("click", function () {
      var L = ["# 能力路线图 · 通关进度", "", "> 导出时间：" + new Date().toLocaleString("zh-CN"), ""];
      AREAS.forEach(function (area) {
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
      var blob = new Blob([L.join("\\n")], { type: "text/markdown;charset=utf-8" });
      var a = el("a");
      a.href = URL.createObjectURL(blob);
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast("已导出 " + fname, "ok");
    });
    exportBar.appendChild(bExp);
    wrap.appendChild(exportBar);

    c.appendChild(wrap);
  }

`;
const anchor = "  /* ========================================================== 页面：术语表 */";
if (src.includes(anchor)) {
  src = src.replace(anchor, fn + anchor);
  log.push("③ 已插入 pageRoadmap()");
} else log.push("③ 页面插入锚点未找到");

try { new Function("window", "globalThis", src + ";"); }
catch (e) { console.log("✗ 语法失败，未写回：" + e.message); process.exit(1); }
writeFileSync(P, src, "utf8");
console.log(log.join("\n"));
console.log("已写回 " + P);
