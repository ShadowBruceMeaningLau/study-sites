#!/usr/bin/env node
/**
 * 把"术语表页面 + 侧边栏入口 + 课程页前置提示"这三处改动打到站点引擎 app/app.js 上。
 * 幂等：已改过则跳过。用法：node cs/tools/add-glossary-ui.mjs <站点目录>
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const SITE = resolve(process.argv[2] || "cs");
const P = join(SITE, "app", "app.js");
let src = readFileSync(P, "utf8");
const log = [];

/* 1) 侧边栏加"术语表"入口 */
const navAnchor = 'nav.appendChild(navRow("#/notebook", "<span class=\'ico\'>📕</span><span class=\'nm\'>错题本</span><span class=\'pct\' id=\'nbCount\'></span>"));';
if (src.includes(navAnchor) && !src.includes('#/glossary')) {
  const add = navAnchor + "\n    nav.appendChild(navRow(\"#/glossary\", \"<span class='ico'>📖</span><span class='nm'>术语表</span>\"));";
  src = src.replace(navAnchor, add);
  log.push("① 侧边栏已加「术语表」入口");
} else log.push("① 侧边栏入口：" + (src.includes('#/glossary') ? "已存在" : "锚点未找到"));

/* 2) 路由：加 #/glossary */
const routeAnchor = 'else if (h === "#/notebook") pageNotebook();';
if (src.includes(routeAnchor) && !src.includes("pageGlossary")) {
  src = src.replace(routeAnchor, routeAnchor + '\n    else if (h === "#/glossary") pageGlossary();');
  log.push("② 路由已加 #/glossary");
} else log.push("② 路由：" + (src.includes("pageGlossary") ? "已存在" : "锚点未找到"));

/* 3) 课程页显示"前置知识" */
const courseLead = 'wrap.appendChild(el("p", "lead", esc(co.blurb)));';
if (src.includes(courseLead) && !src.includes("pre-need")) {
  const add = courseLead + `
    if (co.need) {
      var needBox = el("div", "block concept pre-need");
      needBox.innerHTML = "<h3>🎒 学这门课之前 <span class='tag'>前置知识</span></h3><div class='md'>" + MD.md(co.need) +
        "</div><div class='note-line'>不确定自己的基础够不够？打开 <a href='#/glossary'>📖 术语表</a> 快速过一遍相关术语。</div>";
      wrap.appendChild(needBox);
    }`;
  src = src.replace(courseLead, add);
  log.push("③ 课程页已加「前置知识」提示块");
} else log.push("③ 前置提示：" + (src.includes("pre-need") ? "已存在" : "锚点未找到"));

/* 4) 加术语表页面函数（插在 pageNotebook 之前） */
if (!src.includes("function pageGlossary")) {
  const fn = `/* ========================================================== 页面：术语表 */
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

`;
  const anchor2 = "  /* ========================================================== 页面：错题本 */";
  if (src.includes(anchor2)) {
    src = src.replace(anchor2, fn + anchor2);
    log.push("④ 已插入 pageGlossary()");
  } else log.push("④ pageGlossary 插入锚点未找到");
} else log.push("④ pageGlossary 已存在");

/* 5) 首页统计里加术语条数的一句话 */
const homeLead = " 个可点运行的交互实验与 " ;
if (!src.includes("术语表")) log.push("⑤ 首页文案：跳过（术语表入口已在侧边栏）");

try { new Function("window", "globalThis", src + ";"); }
catch (e) { console.log("✗ 改后语法失败，未写回：" + e.message); process.exit(1); }

if (!existsSync(P)) { console.log("找不到 " + P); process.exit(1); }
writeFileSync(P, src, "utf8");
console.log(log.join("\n"));
console.log("已写回 " + P);
void homeLead;
