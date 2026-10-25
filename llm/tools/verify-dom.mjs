#!/usr/bin/env node
/**
 * 校验 tools/_dom/*.html（由 verify-browser.ps1 用无头浏览器真实渲染得到）
 * LLM 站版：W0 断言占位课与引擎骨架；随波次交付逐步把六类实验路由加进来。
 * 用法：node tools/verify-dom.mjs
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DOM_DIR = join(ROOT, "tools", "_dom");

const EXPECT = {
  home: ["LLM · Harness · Agent", "学习总览", "交互实验", "怎么用这个学习站"],
  path: ["学习路径", "主线 A"],
  course: ["Python 编程基础（AI 方向）", "课程目录", "交互实验", "lesson-row", "学这门课之前"],
  "lesson-ph1": ["第一行代码到变量", "交互实验", "随堂测验", "qcard"],
  notebook: ["错题本", "导出错题"],
  review: ["复习"],
  glossary: ["术语表", "LLM 入门"],
  roadmap: ["验收判据"],
  "course-llm0": ["LLM 零基础入门", "lesson-row", "学这门课之前"],
  "lesson-llm0-tok": ["lab-token-cell", "随堂测验", "qcard"],
  "lesson-llm0-temp": ["lab-samp", "qcard"],
  // 2026-10-25 覆盖度专项：新增 5 门课必须真的被浏览器加载出来。
  // 断言里刻意带上「只有该课才有的字符串」，防止路由串到别的课也「通过」。
  "course-radar": ["前沿雷达", "lesson-row", "学这门课之前"],
  "lesson-radar-1": ["跟进为什么会失败", "交互实验", "qcard"],
  "lesson-radar-4": ["维护判断框架", "qcard"],
  "course-continual": ["持续学习", "lesson-row", "学这门课之前"],
  "lesson-cl-1": ["稳定性", "交互实验", "qcard"],
  "course-selfevo": ["自进化", "lesson-row", "学这门课之前"],
  "course-memory": ["Agent 记忆架构", "lesson-row"],
  "lesson-mem-2": ["记忆是树", "qcard"],
  "course-lalg": ["下一代学习算法", "lesson-row"],
  "lesson-lalg-2": ["优化器", "qcard"],
  "course-narch": ["下一代模型架构", "lesson-row"],
  "lesson-narch-1": ["什么才算一次真架构改动", "qcard"],
  "course-wm": ["世界模型与生成范式", "lesson-row"],
  "lesson-wm-1": ["预测对象", "qcard"]
};

let fail = 0;
function ok(c, label, extra) {
  if (c) console.log("  ✓ " + label);
  else { console.log("  ✗ " + label + (extra ? "  → " + extra : "")); fail++; }
}

if (!existsSync(DOM_DIR)) {
  console.error("找不到 " + DOM_DIR + "，请先运行 tools\\verify-browser.ps1");
  process.exit(1);
}
console.log("=== 无头浏览器真实渲染结果校验（LLM 站）===");
const files = readdirSync(DOM_DIR).filter((f) => f.endsWith(".html"));
ok(files.length >= 7, "生成 DOM 快照 " + files.length + " 份");

let fatal = [];
for (const [name, needles] of Object.entries(EXPECT)) {
  const f = join(DOM_DIR, name + ".html");
  if (!existsSync(f)) { ok(false, name + " 快照存在"); continue; }
  const html = readFileSync(f, "utf8");
  const missing = needles.filter((n) => !html.includes(n));
  ok(missing.length === 0 && html.length > 1500, `${name}（${html.length} 字节）渲染内容完整`, "缺少：" + missing.join(", "));
  if (html.includes("实验渲染失败")) fatal.push(name + ": 页面中出现实验渲染失败");
  // 真正的异常只会在「脚本报错被浏览器写进 DOM」时出现：特征是一行以 Uncaught 开头的消息，
  // 或浏览器错误页里的 ReferenceError/TypeError 堆栈。课程正文里正常提到 TypeError（讲 Python 报错）
  // 不算异常，所以必须要求「异常名后面紧跟冒号或 at 」这种堆栈形状，不能只按关键词裸匹配。
  if (/(?:Uncaught\s+(?:TypeError|ReferenceError|SyntaxError|RangeError)|(?:ReferenceError|TypeError|SyntaxError|RangeError):\s|at\s+\S+\s+\(\S+:\d+:\d+\))/.test(html)) {
    fatal.push(name + ": DOM 中出现未捕获异常堆栈");
  }
  if (/class="[^"]*mr-error/.test(html)) fatal.push(name + ": 公式渲染出现 mr-error");
}

// 课程页应列出真实课程目录，而不是空壳
const course = readFileSync(join(DOM_DIR, "course.html"), "utf8");
const rows = (course.match(/class="lesson-row"/g) || []).length;
ok(rows >= 3, "课程页列出 " + rows + " 条课时（lesson-row）");

// 课时页应渲染出题卡与实验控件
const lesson = readFileSync(join(DOM_DIR, "lesson-ph1.html"), "utf8");
ok((lesson.match(/class="qcard"/g) || []).length >= 2, "题卡数量 " + (lesson.match(/class="qcard"/g) || []).length);
ok(/class="lab/.test(lesson), "交互实验面板已渲染");

// 侧边栏本身必须是可点的真实链接
const navLinks = [...course.matchAll(/class="nav-item"[^>]*href="(#[^"]*)"/g)].map((m) => m[1]);
ok(navLinks.length >= 5, "侧边栏渲染出 " + navLinks.length + " 个真实链接条目");
ok(navLinks.includes("#/") && navLinks.includes("#/path") && navLinks.includes("#/notebook") && navLinks.includes("#/review"),
  "侧边栏含总览/路径/复习/错题本四个入口：" + navLinks.slice(0, 4).join(" "));

/* ------------------------- 课时快照：KaTeX 与残留 $ 检查（与 cs 同款） ------------------------- */
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
for (const f of lessonFiles) {
  const html = readFileSync(join(DOM_DIR, f), "utf8");
  const name = f.replace(/\.html$/, "");
  // 剥掉 KaTeX 渲染的节点后，正文里若还剩下成对的 $...$，就是真的没渲染出来
  const pairs = (visibleText(stripDivByClass(stripKatex(html), "lab")).match(/\$[^$\n]{1,120}\$/g) || []).length;
  ok(pairs === 0, name + " 正文没有残留的字面 $", pairs + " 对");
  ok(!html.includes("mr-error"), name + " 没有渲染失败的公式");
}

// 公式渲染自检页：KaTeX 是否真的在用、字体是否本地加载成功
const demoPath = join(DOM_DIR, "math-demo.html");
if (!existsSync(demoPath)) ok(false, "math-demo 快照存在");
else {
  const demo = readFileSync(demoPath, "utf8");
  const info = (/SELFCHECK ([^<]*)</.exec(demo) || [])[1] || "";
  ok(/engine=katex/.test(info), "公式引擎是 KaTeX", info);
  ok(/errors=0/.test(info), "自检页 0 个渲染错误", info);
  ok(/fontErrors=none/.test(info), "KaTeX 字体在本地加载成功（离线可用）", info);
  ok(demo.includes("echo $?") && demo.includes("Outer$1.class"), "非公式的 $ 未被误判（echo $? / Outer$1.class）");
}

if (fatal.length) { console.log("\n致命问题："); fatal.forEach((x) => console.log("  ! " + x)); fail += fatal.length; }
console.log("\n" + (fail === 0 ? "✓ 浏览器级验证全部通过。" : `✗ 浏览器级验证失败 ${fail} 项。`));
process.exit(fail === 0 ? 0 : 1);
