#!/usr/bin/env node
/**
 * 校验 physics/tools/_dom/*.html（无头浏览器真实渲染出来的 DOM 快照）。
 *
 * 用法：
 *   node tools/verify-dom.mjs              # 全量检查（快照不全就报错）
 *   node tools/verify-dom.mjs --partial    # 只检查存在的那批快照（配 verify-browser.ps1 -Only）
 *
 * 设计原则：**能由数据推出来的，就不要写死**。
 * 早期版本给每一讲都手写了一张「这页必须出现哪些字」的表，随着课程从 6 门涨到 26 门、
 * 从 33 讲涨到 143 讲，那张表既难维护又容易漏。现在改成：
 *   · 每一张 lesson-*.html 一律要求「随堂测验」「qcard」——这是逐讲契约，人人有份；
 *   · 带仿真的页数、含代码块的页数、公式速查条数等改成**计数型断言**，下限由课程数据推出；
 *   · 只对少数有特殊结构的页面写定点断言（零基础层、公式自检页、课程目录页）。
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DOM_DIR = join(ROOT, "tools", "_dom");
const DATA_DIR = join(ROOT, "data");

/* ------------------------------------------------- 课程数据（用于推导下限） */
const packs = [];
for (const f of readdirSync(DATA_DIR).filter((x) => x.endsWith(".js")).sort()) {
  const arr = [];
  try {
    new Function("window", "globalThis", readFileSync(join(DATA_DIR, f), "utf8") + ";")({ COURSE_PACKS: arr }, { COURSE_PACKS: arr });
  } catch { continue; }
  arr.forEach((c) => packs.push(c));
}
const allLessons = packs.flatMap((c) => c.lessons ?? []);
const lessonsWithSim = allLessons.filter((l) => (l.blocks ?? []).some((b) => b.type === "interactive" && b.lab === "simlab")).length;
const lessonsWithPy = allLessons.filter((l) => (l.blocks ?? []).some((b) => b.type === "code" && b.lang === "python")).length;
const totalFormulas = allLessons.flatMap((l) => l.blocks ?? []).filter((b) => b.type === "formula").reduce((a, b) => a + (b.items ?? []).length, 0);

let fail = 0;
/** --partial：只检查存在的那批快照（配合 verify-browser.ps1 -Only 用），不因为「没渲染过」而报错 */
const PARTIAL = process.argv.includes("--partial");
function ok(c, label, extra) {
  if (c) console.log("  ✓ " + label);
  else { console.log("  ✗ " + label + (extra ? "  → " + extra : "")); fail++; }
}

if (!existsSync(DOM_DIR)) { console.error("找不到 " + DOM_DIR); process.exit(1); }
console.log("=== 物理站：无头浏览器真实渲染结果校验" + (PARTIAL ? "（部分快照模式）" : "") + " ===");
const files = readdirSync(DOM_DIR).filter((f) => f.endsWith(".html"));
const lessonFiles = files.filter((f) => f.startsWith("lesson-"));
const courseFiles = files.filter((f) => f.startsWith("course-") || /^w\d+course-/.test(f));

const wantSnapshots = 177;   // verify-browser.ps1 里的路由数
ok(PARTIAL || files.length >= wantSnapshots, "生成 DOM 快照 " + files.length + " 份（路由 " + wantSnapshots + " 条）");
ok(PARTIAL || lessonFiles.length >= allLessons.length,
  "课时页快照 " + lessonFiles.length + " 份（课程数据里共 " + allLessons.length + " 讲）");
ok(PARTIAL || courseFiles.length === packs.length,
  "课程目录页快照 " + courseFiles.length + " 份（课程数据里共 " + packs.length + " 门）");

/* ---------------------------------------------------------------- 工具函数 */
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
/** 按 class 剥掉一个 div 块（实验面板），用于「正文里有没有残留 $」 */
function stripDivByClass(html, cls) {
  let out = html;
  const open = new RegExp('<div[^>]*class="[^"]*\\b' + cls + '\\b[^"]*"[^>]*>', "gi");
  let m;
  while ((m = open.exec(out)) !== null) {
    let depth = 1, i = m.index + m[0].length;
    while (i < out.length && depth > 0) {
      const nextOpen = out.indexOf("<div", i);
      const nextClose = out.indexOf("</div>", i);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) { depth++; i = nextOpen + 4; }
      else { depth--; i = nextClose + 6; }
    }
    out = out.slice(0, m.index) + out.slice(i);
    open.lastIndex = 0;
  }
  return out;
}
function stripKatex(html) {
  return html
    .replace(/<span class="katex-mathml">[\s\S]*?<\/span>/g, "")
    .replace(/<span class="katex-html"[^>]*>[\s\S]*?<\/span>/g, "");
}
function rd(name) {
  const p = join(DOM_DIR, name + ".html");
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}
function withPage(name, fn) {
  const html = rd(name);
  if (html === null) { if (!PARTIAL) ok(false, name + " 快照存在"); return; }
  fn(html);
}

/* --------------------------------------------------- 致命问题：逐页扫一遍 */
const fatal = [];
for (const f of files) {
  const name = f.replace(/\.html$/, "");
  const html = readFileSync(join(DOM_DIR, f), "utf8");
  if (html.includes("实验渲染失败")) fatal.push(name + ": 页面出现实验渲染失败");
  if (html.includes("未知仿真模型")) fatal.push(name + ": 页面出现未知仿真模型");
  if (/Uncaught|ReferenceError|TypeError/.test(html)) fatal.push(name + ": DOM 中出现未捕获异常文本");
}
ok(fatal.length === 0, "所有页面都没有未捕获异常/渲染失败", fatal.slice(0, 4).join("；"));

/* ------------------------------------------------------------ 非课时页面 */
withPage("course-mech", (course) => {
  ok((course.match(/class="lesson-row"/g) || []).length >= 5, "课程页列出课时（lesson-row）");
  const navLinks = [...course.matchAll(/class="nav-item"[^>]*href="(#[^"]*)"/g)].map((m) => m[1]);
  ok(navLinks.length >= 12, "侧边栏渲染出 " + navLinks.length + " 个真实链接条目");
  ok(["#/", "#/path", "#/notebook", "#/review", "#/glossary", "#/roadmap", "#/formulas", "#/cards"].every((r) => navLinks.includes(r)),
    "侧边栏含总览/路径/复习/错题本/术语表/路线图/公式速查/闪卡入口");
});
withPage("home", (h) => {
  ok(h.includes("物理") && h.includes("学习总览"), "首页渲染出站点标题与总览区块");
});

/* ---------------------------------------- 每张课时页的逐讲契约（人人有份） */
let noQuiz = [], noKatex = [], leftover = [], pyPages = 0, pyBad = [];
let simPages = 0, simSvgOk = 0, simReadoutOk = 0, noSvgButBars = 0;
const noSvgPages = [];
for (const f of lessonFiles) {
  const name = f.replace(/\.html$/, "");
  const html = readFileSync(join(DOM_DIR, f), "utf8");
  if (!html.includes("随堂测验") || !html.includes("qcard")) noQuiz.push(name);
  const k = (html.match(/class="katex"/g) || []).length;
  if (k === 0) noKatex.push(name);
  // 只看「成对的 $...$」——公式里合法渲染出的单个 $ 不算残留；
  // 剥掉 KaTeX 节点与实验面板后仍剩下成对 $，就是真的没渲染出来
  const pairs = (visibleText(stripDivByClass(stripKatex(html), "lab")).match(/\$[^$\n]{1,120}\$/g) || []).length;
  if (pairs > 0) leftover.push(name + "(" + pairs + " 对)");
  if (/class="lang">python/.test(html)) {
    pyPages++;
    if (!/class="code"/.test(html) || !html.includes("复制")) pyBad.push(name);
  }
  if (html.includes("sim-ctrls")) {
    simPages++;
    const hasSvg = (html.match(/class="sim-svg"/g) || []).length > 0;
    const hasReadout = html.includes("sim-readout");
    const hasBars = html.includes("sim-bars");
    if (hasSvg) simSvgOk++;
    if (hasReadout) simReadoutOk++;
    // 有些模型（例如 collision）没有随时间变化的曲线，只有动量/能量条——
    // 那种情况下页面必须有柱状读数，不能是一张空图或什么都没有。
    if (!hasSvg) { if (hasBars) noSvgButBars++; else noSvgPages.push(name); }
  }
}
ok(noQuiz.length === 0, "每张课时页都渲染出随堂测验与题目卡", "缺：" + noQuiz.slice(0, 5).join(", "));
ok(noKatex.length === 0, "所有课时页都渲染出了公式（" + lessonFiles.length + " 页）", "没有公式的页：" + noKatex.slice(0, 5).join(", "));
ok(leftover.length === 0, "所有课时页正文里都没有残留的字面 $", "残留：" + leftover.join(", "));
ok(PARTIAL || pyPages >= lessonsWithPy, "含 Python 代码块的课时页 " + pyPages + " 个（课程数据里 " + lessonsWithPy + " 讲有代码块）");
ok(pyBad.length === 0, "每个 Python 代码块都渲染成高亮代码框并带复制按钮", "异常页：" + pyBad.join(", "));
ok(PARTIAL || simPages >= lessonsWithSim, "含仿真实验的课时页 " + simPages + " 个（课程数据里 " + lessonsWithSim + " 讲有 simlab）");
ok(simSvgOk + noSvgButBars === simPages, "每个仿真都有可视化输出（SVG 曲线或数值柱状图）",
  "既无曲线也无柱状图的页：" + noSvgPages.join(", "));
ok(simReadoutOk === simPages, "每个仿真都有数值读数", simPages - simReadoutOk + " 个没有");
ok(simSvgOk >= simPages - 2, "其中 " + simSvgOk + " 个画出了 SVG 坐标曲线（含刻度与图例）");

/* --------------------------------------------- 零基础层与公式块的定点断言 */
withPage("lesson-pz1", (pz1) => {
  ok((pz1.match(/class="term-link"/g) || []).length > 0, "正文术语联动生效（term-link " + (pz1.match(/class="term-link"/g) || []).length + " 处）");
  ok(pz1.includes("checklist-block"), "本讲自检清单已渲染");
});
withPage("lesson-pz2", (pz2) => {
  ok((pz2.match(/class="formula-card"/g) || []).length > 0, "formula 块渲染出公式卡片（" + (pz2.match(/class="formula-card"/g) || []).length + " 张）");
  ok(pz2.includes("成立条件"), "公式卡片带「成立条件」（物理站硬要求）");
  const katexN = (pz2.match(/class="katex"/g) || []).length;
  ok(katexN >= 10, "课程页公式已由 KaTeX 渲染（katex " + katexN + " 处）");
  ok(!pz2.includes("mr-error"), "课程页没有渲染失败的公式");
  ok(/katex-html/.test(pz2), "公式含分式等真实排版结构");
});
withPage("formulas", (fpage) => {
  const fcards = (fpage.match(/class="formula-card"/g) || []).length;
  ok(fcards >= totalFormulas * 0.9, "公式速查页汇总出 " + fcards + " 条公式（课程里共 " + totalFormulas + " 条）");
  ok(fpage.includes("cons-table") && fpage.includes("CODATA"), "物理常量表（CODATA）已渲染");
});
withPage("cards", (cpage) => {
  ok(cpage.includes("flash-card") || cpage.includes("开始复习"), "闪卡页渲染出复习入口或卡片");
  ok(/\d+ 张/.test(cpage), "闪卡页显示卡片数量统计");
});

/* ------------------------------------------------ 公式渲染自检页（KaTeX + 字体） */
withPage("formula-demo", (demo) => {
  const info = (demo.match(/engine=[a-z]+/) || [""])[0];
  ok(/engine=katex/.test(info), "公式引擎是 KaTeX", info);
  ok(/errors=0/.test(demo), "自检页 0 个渲染错误");
  ok(/fontErrors=none/.test(demo), "KaTeX 字体在本地加载成功（离线可用）", info);
  const k = (demo.match(/class="katex"/g) || []).length;
  ok(k >= 10, "自检页渲染出 " + k + " 个公式节点");
});

if (fatal.length) { console.log("\n致命问题："); fatal.forEach((x) => console.log("  ! " + x)); fail += fatal.length; }
console.log("\n" + (fail === 0 ? "✓ 物理站浏览器级验证全部通过。" : "✗ 物理站浏览器级验证失败 " + fail + " 项。"));
process.exit(fail === 0 ? 0 : 1);
