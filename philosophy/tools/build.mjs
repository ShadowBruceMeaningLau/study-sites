/* ==========================================================================
   build.mjs —— 哲学学习站构建脚本
   1) 自动发现 data/*.js（按 app.js 里的 ORDER 排序），生成 index.html
   2) 把 CSS + 数据 + 引擎全部内联，产出**单文件离线版** philosophy-standalone.html

   用法：node tools/build.mjs
   ========================================================================== */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");
const APP = join(ROOT, "app");
const TPL = join(ROOT, "templates", "index.template.html");

function read(p) { return readFileSync(p, "utf8").replace(/^\uFEFF/, ""); }

/* ---------------------------------------------------- 读取课程顺序 */
const appSrc = read(join(APP, "app.js"));
const orderMatch = appSrc.match(/var ORDER = \[([\s\S]*?)\];/);
if (!orderMatch) { console.error("✗ 无法从 app/app.js 解析出 ORDER 数组"); process.exit(1); }
const ORDER = [...orderMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);

/* ---------------------------------------------------- 发现数据文件 */
// 只认「philo-*.js」与「reading-*.js」：下划线开头的临时脚本、以及任何非课程文件都不参与构建
const allFiles = readdirSync(DATA).filter((f) => f.endsWith(".js") && !f.startsWith("_"));
const files = allFiles.filter((f) => f.startsWith("philo-"));
const readingFiles = allFiles.filter((f) => f.startsWith("reading-")).sort();
const skipped = readdirSync(DATA).filter((f) => f.startsWith("_"));
if (skipped.length) console.warn("⚠ 已忽略 data/ 下的临时文件：" + skipped.join(", "));
if (readingFiles.length) console.log("  阅读轨迹 " + readingFiles.length + " 条：" + readingFiles.join(", "));
const idOf = (f) => basename(f, ".js");
const rank = (f) => {
  const i = ORDER.indexOf(idOf(f));
  return i < 0 ? 999 : i;
};
const dataFiles = files.slice().sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
const unknown = dataFiles.filter((f) => rank(f) === 999);
if (unknown.length) console.warn("⚠ 以下数据文件的 id 不在 app.js 的 ORDER 里，将排在最后：" + unknown.join(", "));

/* ---------------------------------------------------- 生成 index.html */
const tpl = read(TPL);
const dataTags = dataFiles.map((f) => `<script src="data/${f}"></script>`)
  .concat(readingFiles.map((f) => `<script src="data/${f}"></script>`))
  .join("\n");
const indexHtml = tpl.replace("<!--DATA-->", dataTags);
writeFileSync(join(ROOT, "index.html"), indexHtml, "utf8");
console.log("✓ index.html 已生成（" + dataFiles.length + " 个课程数据文件 + " + readingFiles.length + " 条阅读轨迹）");
dataFiles.forEach((f) => console.log("    · data/" + f));
readingFiles.forEach((f) => console.log("    · data/" + f));

/* ---------------------------------------------------- 生成单文件离线版 */
const css = read(join(APP, "app.css"));
const engineFiles = ["glossary.js", "markdown.js", "labs.js", "quiz.js", "app.js"]
  .filter((f) => existsSync(join(APP, f)));

// 内联时要注意：数据文件与引擎里可能出现 "</script" 字样（内容里写 HTML 标签时），
// 必须打断它，否则会提前关闭 script 标签导致整页崩掉。
function safeInline(js) { return js.replace(/<\/script/gi, "<\\/script"); }

const inlineScripts = [
  "window.COURSE_PACKS = [];",
  ...dataFiles.map((f) => safeInline(read(join(DATA, f)))),
  ...(readingFiles.length ? ["window.READING_PLANS = [];", ...readingFiles.map((f) => safeInline(read(join(DATA, f))))] : []),
  ...engineFiles.map((f) => safeInline(read(join(APP, f))))
].map((js) => '<script>\n' + js + '\n</script>').join("\n");

let single = tpl
  .replace('<link rel="stylesheet" href="app/app.css">', "<style>\n" + css + "\n</style>")
  .replace("<!--DATA-->", "")
  .replace(/<script src="app\/[\w.-]+"><\/script>\s*/g, "")
  .replace(/<script>\s*window\.COURSE_PACKS = \[\];\s*<\/script>\s*/, "")
  .replace("</body>", inlineScripts + "\n</body>");
single = single.replace(
  "<title>哲学本科 · 互动学习站</title>",
  "<title>哲学本科 · 互动学习站（单文件离线版）</title>"
);

const outName = "philosophy-standalone.html";
writeFileSync(join(ROOT, outName), single, "utf8");
const kb = (Buffer.byteLength(single, "utf8") / 1024).toFixed(0);
console.log("✓ " + outName + " 已生成（单文件，约 " + kb + " KB，双击即可用，无需任何依赖）");

/* ---------------------------------------------------- 统计 */
let lessons = 0, blocks = 0, quiz = 0, cards = 0, args = 0, writing = 0;
let tracks = 0, trackBooks = 0;
global.window = { COURSE_PACKS: [], READING_PLANS: [] };
global.window.window = global.window;
for (const f of [...dataFiles, ...readingFiles]) {
  const src = read(join(DATA, f));
  try {
    new Function("window", "self", "globalThis", src)(global.window, global.window, global.window);
  } catch (e) {
    console.error("✗ " + f + " 求值失败：" + e.message);
    process.exitCode = 1;
  }
}
for (const c of global.window.COURSE_PACKS) {
  for (const l of c.lessons || []) {
    lessons++; blocks += (l.blocks || []).length; quiz += (l.quiz || []).length;
    cards += (l.flashcards || []).length; args += (l.arguments || []).length;
    writing += (l.writing || []).length + (l.blocks || []).filter((b) => b.type === "writing").length;
  }
}
console.log("  统计：课程 " + global.window.COURSE_PACKS.length + " 门 / 讲 " + lessons +
  " / 讲解块 " + blocks + " / 测验 " + quiz + " 题 / 闪卡 " + cards + " 张 / 论证重构 " + args + " 组 / 写作 " + writing + " 个");
for (const p of global.window.READING_PLANS) {
  let nb = 0;
  (p.stages || []).forEach((s) => (s.books || []).forEach((b) => { nb++; }));
  tracks++; trackBooks += nb;
}
if (tracks) {
  console.log("  精读轨迹：" + tracks + " 条 / 阶段 " + global.window.READING_PLANS.reduce((n, p) => n + (p.stages || []).length, 0) +
    " / 书目 " + trackBooks + " 本（不含任何时间线信息）");
}
