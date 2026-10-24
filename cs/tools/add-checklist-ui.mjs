#!/usr/bin/env node
/**
 * 给 quiz.js 增加"本讲自检清单"渲染（借鉴 AI 短剧工作台的 checklist 设计）。
 * 从课程数据里读 lesson.checklist（可选字段），渲染成可勾选、会持久化的清单。
 * 幂等；写回前做语法校验。
 * 用法：node <site>/tools/add-checklist-ui.mjs <cs|math>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const SITE = resolve(process.argv[2] || "cs");
const P = join(SITE, "app", "quiz.js");
let src = readFileSync(P, "utf8");

if (src.includes("renderChecklist")) { console.log("已存在，跳过"); process.exit(0); }

// 在 QUIZ 导出之前插入清单渲染函数
const anchor = "  global.QUIZ = {";
if (!src.includes(anchor)) { console.log("找不到 QUIZ 导出锚点"); process.exit(1); }

const fn = `  /* ---------------------------------------------- 本讲自检清单（可选） */
  /**
   * 课程数据里可给 lesson.checklist 一个字符串数组，这里渲染成可勾选清单。
   * 勾选状态写进 localStorage（键 cs-learn:v1 / math-learn:v1 的 checks 字段）。
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

`;
src = src.replace(anchor, fn + anchor);
src = src.replace("  global.QUIZ = { render: render, normalize: normalize,", "  global.QUIZ = { render: render, renderChecklist: renderChecklist, normalize: normalize,");

try { new Function("window", "globalThis", src + ";"); }
catch (e) { console.log("✗ 语法失败，未写回：" + e.message); process.exit(1); }
writeFileSync(P, src, "utf8");
console.log("已给 " + P + " 加上 renderChecklist");
