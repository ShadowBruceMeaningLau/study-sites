#!/usr/bin/env node
/**
 * 术语联动：把课时正文里的术语自动变成"可点查词"的小标记。
 * 借鉴 AI 短剧工作台的 markTerms()：先 esc 再扫描术语、避免重复标记。
 * 本实现额外保证：跳过 <code>/<pre>/<a> 内部，避免破坏代码与链接。
 * 幂等；写回前语法校验。用法：node <site>/tools/add-term-links.mjs <cs|math>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const SITE = resolve(process.argv[2] || "cs");
const P = join(SITE, "app", "app.js");
let src = readFileSync(P, "utf8");

if (src.includes("linkTermsInHtml")) { console.log("已存在，跳过"); process.exit(0); }

const anchor = "  /* ============================================================ 页面：总览 */";
if (!src.includes(anchor)) { console.log("找不到锚点，未改动"); process.exit(1); }

const fn = `  /* ==================================================== 术语联动（正文可点查词） */
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
    // 长子串优先，避免"进程"抢了"进程间通信"
    names.sort(function (a, b) { return b.length - a.length; });
    var pattern = new RegExp("(" + names.map(function (n) { return n.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&"); }).join("|") + ")", "g");

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
        var m = /^<(\\/?)([A-Za-z0-9]+)/.exec(tagText);
        if (m) {
          var isSkip = skipTags.indexOf(m[2].toUpperCase()) >= 0;
          if (!m[1] && !/\\/>$/.test(tagText) && isSkip) depth++;
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

`;
src = src.replace(anchor, fn + anchor);

// 在课程页与课时页的正文渲染处套用 linkTermsInHtml
const targets = [
  ['      box.appendChild(el("div", "md", MD.md(b.md || "")));', '      box.appendChild(el("div", "md", linkTermsInHtml(MD.md(b.md || ""))));'],
  ['      box.appendChild(el("div", "md", MD.md(b.md || "")));', 'PLACEHOLDER_NEVER_MATCH']
];
let patchedMd = 0;
src = src.replace(/(\s+)box\.appendChild\(el\("div", "md", MD\.md\(b\.md \|\| ""\)\)\);/, (m, sp) => {
  patchedMd++;
  return sp + 'box.appendChild(el("div", "md", linkTermsInHtml(MD.md(b.md || ""))));';
});
void targets;

// 在 boot() 里绑定术语点击
const bootAnchor = "    bind();\n    bindSidebarNav();";
if (src.includes(bootAnchor)) {
  src = src.replace(bootAnchor, "    bind();\n    bindSidebarNav();\n    bindTermLinks($(\"#content\"));");
}

try { new Function("window", "globalThis", src + ";"); }
catch (e) { console.log("✗ 语法失败，未写回：" + e.message); process.exit(1); }
writeFileSync(P, src, "utf8");
console.log("已加入 terms 联动（正文 ${patchedMd} 处套用 linkTermsInHtml）");
