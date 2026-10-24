#!/usr/bin/env node
/** 校验 math/tools/_dom/*.html（无头浏览器真实渲染结果） */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MATH = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DOM_DIR = join(MATH, "tools", "_dom");

const EXPECT = {
  home: ["基础数学", "学习总览", "课程地图", "完全零基础"],
  path: ["培养方案", "大一上", "学时"],
  course: ["课程目录", "lesson-row", "交互实验", "学这门课之前"],
  "lesson-limits": ["随堂测验", "qcard", "交互实验", "自检清单"],
  "lesson-formula": ["随堂测验", "qcard", "交互实验"],
  "lesson-la": ["随堂测验", "qcard"],
  "lesson-prob": ["随堂测验", "qcard"],
  "lesson-cv": ["随堂测验", "qcard"],
  "lesson-ode": ["随堂测验", "qcard"],
  "lesson-ra": ["随堂测验", "qcard"],
  "lesson-zero": ["随堂测验", "qcard"],
  notebook: ["错题本"],
  review: ["复习"],
  glossary: ["术语表", "零基础"],
  roadmap: ["能力路线图", "配书", "从零实现", "验收判据"]
};

let fail = 0;
function ok(c, label, extra) {
  if (c) console.log("  ✓ " + label);
  else { console.log("  ✗ " + label + (extra ? "  → " + extra : "")); fail++; }
}

if (!existsSync(DOM_DIR)) { console.error("找不到 " + DOM_DIR); process.exit(1); }
console.log("=== 数学站：无头浏览器真实渲染结果校验 ===");
const files = readdirSync(DOM_DIR).filter((f) => f.endsWith(".html"));
ok(files.length >= 14, "生成 DOM 快照 " + files.length + " 份");

const fatal = [];
for (const [name, needles] of Object.entries(EXPECT)) {
  const f = join(DOM_DIR, name + ".html");
  if (!existsSync(f)) { ok(false, name + " 快照存在"); continue; }
  const html = readFileSync(f, "utf8");
  const missing = needles.filter((n) => !html.includes(n));
  ok(missing.length === 0 && html.length > 1500, name + "（" + html.length + " 字节）渲染内容完整", "缺少：" + missing.join(", "));
  if (html.includes("实验渲染失败")) fatal.push(name + ": 页面出现实验渲染失败");
  if (/Uncaught|ReferenceError|TypeError/.test(html)) fatal.push(name + ": DOM 中出现未捕获异常文本");
}

const course = readFileSync(join(DOM_DIR, "course.html"), "utf8");
ok((course.match(/class="lesson-row"/g) || []).length >= 5, "课程页列出课时（lesson-row）");
const navLinks = [...course.matchAll(/class="nav-item"[^>]*href="(#[^"]*)"/g)].map((m) => m[1]);
ok(navLinks.length >= 20, "侧边栏渲染出 " + navLinks.length + " 个真实链接条目");
ok(["#/", "#/path", "#/notebook", "#/review", "#/glossary", "#/roadmap"].every((r) => navLinks.includes(r)),
  "侧边栏含总览/路径/复习/错题本/术语表/路线图入口");

const limits = readFileSync(join(DOM_DIR, "lesson-limits.html"), "utf8");
ok((limits.match(/class="term-link"/g) || []).length > 0, "正文术语联动生效（term-link " + (limits.match(/class="term-link"/g) || []).length + " 处）");
ok(limits.includes("checklist-block"), "本讲自检清单已渲染");

/* ------------------------------------------------------- 公式渲染（真实课程页） */
const fml = readFileSync(join(DOM_DIR, "lesson-formula.html"), "utf8");
const katexN = (fml.match(/class="katex"/g) || []).length;
ok(katexN >= 10, "课程页公式已由 KaTeX 渲染（katex " + katexN + " 处）");
ok(!fml.includes("mr-error"), "课程页没有渲染失败的公式");
ok(/\\?frac|katex-html/.test(fml), "公式含分式等真实排版结构");

/* ------------------------- 每一张课时快照都要：有 KaTeX 节点 + 正文里没有未渲染的 $ */
/** 把 DOM 变成「人眼看到的文字」：去掉脚本、样式、KaTeX 的隐藏 TeX 源与所有标签 */
/** 把 KaTeX 渲染出来的节点整块剥掉（数 span 配对，简单的正则做不到） */

/** 整块剥掉 <div class="前缀...">…</div>（实验面板里的 state 是纯文本数据，允许有字面 $） */
function stripDivByClass(html, prefix) {
  var out = "";
  var i = 0;
  var needle = '<div class="' + prefix;
  while (i < html.length) {
    var k = html.indexOf(needle, i);
    if (k < 0) { out += html.slice(i); break; }
    out += html.slice(i, k);
    var j = k;
    var depth = 0;
    while (j < html.length) {
      var open = html.indexOf("<div", j);
      var close = html.indexOf("</div>", j);
      if (close < 0) { j = html.length; break; }
      if (open >= 0 && open < close) { depth++; j = open + 4; }
      else { depth--; j = close + 6; if (depth === 0) break; }
    }
    i = j;
  }
  return out;
}

function stripKatex(html) {
  var out = "";
  var i = 0;
  while (i < html.length) {
    var k = html.indexOf('<span class="katex', i);
    if (k < 0) { out += html.slice(i); break; }
    out += html.slice(i, k);
    var j = k;
    var depth = 0;
    while (j < html.length) {
      var open = html.indexOf("<span", j);
      var close = html.indexOf("</span>", j);
      if (close < 0) { j = html.length; break; }
      if (open >= 0 && open < close) { depth++; j = open + 5; }
      else { depth--; j = close + 7; if (depth === 0) break; }
    }
    i = j;
  }
  return out;
}

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<annotation[\s\S]*?<\/annotation>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

const lessonFiles = readdirSync(DOM_DIR).filter((f) => f.startsWith("lesson-") && f.endsWith(".html"));
let noKatex = [];
let leftover = [];
for (const f of lessonFiles) {
  const html = readFileSync(join(DOM_DIR, f), "utf8");
  const name = f.replace(/\.html$/, "");
  const k = (html.match(/class="katex"/g) || []).length;
  if (k === 0) noKatex.push(name);
  const txt = visibleText(stripDivByClass(stripKatex(html), "lab"));
  // 只看「成对的 $...$」——公式里合法渲染出的单个 $ 符号（如文法结束符）不算残留
  // 剥掉 KaTeX 渲染的节点后，正文里若还剩下成对的 $...$，就是真的没渲染出来
  const pairs = (visibleText(stripDivByClass(stripKatex(html), "lab")).match(/\$[^$\n]{1,120}\$/g) || []).length;
  if (pairs > 0) leftover.push(name + "(" + pairs + " 对)");
  ok(!html.includes("mr-error"), name + " 没有渲染失败的公式（katex " + k + " 处）");
}
ok(noKatex.length === 0, "所有课时页都渲染出了公式（" + lessonFiles.length + " 页）", "没有公式的页：" + noKatex.join(", "));
ok(leftover.length === 0, "所有课时页正文里都没有残留的字面 $", "残留：" + leftover.join(", "));

/* ------------------------------------------------ 公式渲染自检页（KaTeX + 字体） */
const demoPath = join(DOM_DIR, "math-demo.html");
if (!existsSync(demoPath)) ok(false, "math-demo 快照存在");
else {
  const demo = readFileSync(demoPath, "utf8");
  const sc = /SELFCHECK ([^<]*)</.exec(demo);
  const info = sc ? sc[1] : "";
  ok(/engine=katex/.test(info), "公式引擎是 KaTeX", info);
  ok(/errors=0/.test(info), "自检页 0 个渲染错误", info);
  ok(/fontErrors=none/.test(info), "KaTeX 字体在本地加载成功（离线可用）", info);
  ok(/katexNodes=14/.test(info), "10 个用例共渲染出 14 个公式节点", info);
  ok(demo.includes("echo $?") && !/katex[^>]*>\s*<\/span>\s*<\/span>\s*看退出码/.test(demo), "非公式的 $ 未被误判（echo $? 等）");
}

if (fatal.length) { console.log("\n致命问题："); fatal.forEach((x) => console.log("  ! " + x)); fail += fatal.length; }
console.log("\n" + (fail === 0 ? "✓ 数学站浏览器级验证全部通过。" : "✗ 数学站浏览器级验证失败 " + fail + " 项。"));
process.exit(fail === 0 ? 0 : 1);