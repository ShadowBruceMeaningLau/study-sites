/* ==========================================================================
   smoke-test.mjs —— 冒烟测试
   1) 数据完整性：id 唯一、跨课引用（闪卡 where）可达、脚本被 index.html 正确引用
   2) 单文件产物：philosophy-standalone.html 是否自包含、是否含全部课程数据
   3) 真实浏览器渲染：用 Edge/Chrome 无头模式打开页面，检查应用是否真的渲染出内容
      （可用 --no-browser 跳过）

   用法：node tools/smoke-test.mjs [--no-browser]
   ========================================================================== */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");
const noBrowser = process.argv.includes("--no-browser");

let fail = 0, pass = 0;
function ok(msg) { pass++; console.log("  ✓ " + msg); }
function bad(msg) { fail++; console.log("  ✗ " + msg); }
function check(cond, msg) { cond ? ok(msg) : bad(msg); return cond; }
function read(p) { return readFileSync(p, "utf8").replace(/^\uFEFF/, ""); }

/* ==================================================== 1. 数据完整性 */
console.log("\n[1/3] 数据完整性");
const files = readdirSync(DATA).filter((f) => f.startsWith("philo-") && f.endsWith(".js")).sort();
check(files.length > 0, "发现 " + files.length + " 个课程数据文件");

const courses = [];
for (const f of files) {
  const win = {};
  win.window = win;
  win.COURSE_PACKS = [];
  win.READING_PLANS = [];
  try {
    new Function("window", "self", "globalThis", read(join(DATA, f)))(win, win, win);
    if (win.COURSE_PACKS[0]) courses.push({ f, course: win.COURSE_PACKS[0] });
    else bad(f + " 没有产出课程对象");
  } catch (e) { bad(f + " 求值失败：" + e.message); }
}

/* 阅读轨迹（reading-*.js）也要能求值，并且它的 lessons 引用必须落在真实讲次上 */
const readingFiles = readdirSync(DATA).filter((x) => x.startsWith("reading-") && x.endsWith(".js")).sort();
const plans = [];
for (const f of readingFiles) {
  const win = {};
  win.window = win; win.COURSE_PACKS = []; win.READING_PLANS = [];
  try {
    new Function("window", "self", "globalThis", read(join(DATA, f)))(win, win, win);
    if (win.READING_PLANS[0]) plans.push(win.READING_PLANS[0]);
    else bad(f + " 没有产出阅读轨迹对象");
  } catch (e) { bad(f + " 求值失败：" + e.message); }
}

const ids = new Set();
let dup = 0;
const lessonIds = new Set();
const allIds = [];
for (const { course: c } of courses) {
  if (ids.has(c.id)) { bad("课程 id 重复：" + c.id); dup++; }
  ids.add(c.id);
  for (const l of c.lessons || []) {
    if (lessonIds.has(l.id)) { bad("讲 id 重复：" + l.id); dup++; }
    lessonIds.add(l.id);
    allIds.push(l.id);
    for (const f of l.flashcards || []) allIds.push(f.id);
    for (const a of l.arguments || []) allIds.push(a.id);
    for (const w of l.writing || []) allIds.push(w.id);
    for (const q of l.quiz || []) allIds.push(q.id);
  }
}
check(dup === 0, "全部 id 唯一（共 " + allIds.length + " 个）");

let dangling = 0;
for (const { course: c } of courses) {
  for (const l of c.lessons || []) {
    for (const f of l.flashcards || []) {
      if (f.where && !lessonIds.has(f.where)) { bad("闪卡 " + f.id + " 的 where 指向不存在的讲：" + f.where); dangling++; }
    }
  }
}
check(dangling === 0, "闪卡 where 引用全部可达");

/* 学术诚信抽查：精读块必须给出处；且读者必须能分辨「这是原文」还是「这是概述」 */
let closeCount = 0, closeNoSource = 0, closeNoDisclosure = 0, closeThin = 0;
const closeSourceDetail = [], closeDisclosureDetail = [];
// 声明义务的两种合规写法（任一即可）：
//   (a) 说明这是概述/意译/非逐字引文；或
//   (b) 说明这是原文的直接引用（中文原典如《实践论》，本来就是中文，不存在"翻译是否逐字"的问题）
const DECLARED_PARAPHRASE = /(内容概述|忠实.{0,8}(概述|中译|转写)|非逐字|不是逐字|意译|压缩|整理|通行中译|据.{0,6}概述|改写的概述)/;
const DECLARED_VERBATIM = /(原文的?(直接)?引[用文]|直接引用|逐字引[用文]|原文如?下|引原文|原文见|系原文|为原文)/;
// 出处定位，分两类（任一命中即可）：
//   ① 章节/页码类：斯特方页码（514a、21a）、节号（§21、第 3 节、两节）、
//      页码范围（第 1 至 10 页、pp. IV–X）、中国典籍篇名与卷次（八佾篇、兼爱上第十四、卷上/卷下）、
//      康德 A/B 版页码（A51/B75、Bxvi）、西文出处（Lecture III、ch.13、II.xxvii.9）
//   ② 学术引用类：期刊卷期页（61(19), 1964, 571–584）、出版年（1960）、页码区间（121–123、121–123 页）
const LOCATOR_CHAPTER = /(卷[一二三四五六七八九十上中下]|第\s*[一二三四五六七八九十百千\d]+\s*(卷|篇|章|节|讲|沉思|部分|命题|定义|条|页|回|品)|[一二三四五六七八九十百\d]+\s*(卷|篇|章|节|讲|沉思)|第\s*[一二三四五六七八九十百\d]+\s*至\s*[一二三四五六七八九十百\d]+\s*页|[\u4e00-\u9fff]{2,4}篇|[\u4e00-\u9fff]{2,4}章|[AB]\d{1,4}|[AB][ivxl]+|§|Lecture|ch\.|AT\s|II?\.\s*\w)/i;
const LOCATOR_CITATION = /(\d{4}\s*年|\d+(\(\d+\))?,\s*\d{4}|\d+\s*[–—-]\s*\d+\s*页|pp?\.\s*\d+|\d{1,4}\s*[a-e]\b)/i;
// 自我声明为"自撰教学范例、非任何原文"的块不需要出处（写作用于分析结构的范文）
const SELF_AUTHORED = /(自撰|自拟|非引文|不是任何|教学范例|请勿引用|本课撰写|编者撰写)/;
// 逐字引用原文的标志：引号包裹的原文，或古典文本常见句式
const DIRECT_QUOTE = /[「『""][^「『""]{4,}[」』""]/;
// 中国典籍与古典引文体裁：这些是逐字引用原文（或原文直录），不需要"内容概述"声明
const CLASSIC = /(《论语》|《老子》|《庄子》|《孟子》|《荀子》|《墨子》|《韩非子》|《公孙龙子》|《传习录》|《朱子语类》|《周易》|《易传》|《大学》|《中庸》|《坛经》|《中论》|《肇论》|《成唯识论》|《华严金师子章》|《摩诃止观》|《明夷待访录》|《读四书大全说》|《周易外传》|《日知录》|《新唯识论》|《新理学》|《现象与物自身》|《大同书》|《仁学》|子曰|老子曰|庄子曰|孟子曰|荀子曰|韩非子曰|慧能|龙树|王夫之曰|船山曰|黄宗羲曰|顾炎武曰)/;

for (const { f, course: c } of courses) {
  for (const l of c.lessons || []) {
    for (const b of (l.blocks || []).filter((x) => x.type === "close")) {
      closeCount++;
      const work = String(b.work || "");
      const passage = String(b.passage || "");
      const note = String(b.note || "");
      const meta = work + " " + note + " " + passage.slice(0, 200);
      const isSelfAuthored = SELF_AUTHORED.test(meta);
      if (!b.author || !work) { closeNoSource++; closeSourceDetail.push(f + "：" + l.title + "（缺 author/work）"); }
      else if (!isSelfAuthored && !LOCATOR_CHAPTER.test(work + " " + passage) && !LOCATOR_CITATION.test(work + " " + passage)) {
        closeNoSource++;
        closeSourceDetail.push(f + "：《" + l.title + "》work=" + work.slice(0, 60));
      }
      if ((b.annotations || []).length < 4) closeThin++;
      // 声明义务：' 读者必须知道这是原文还是概述。
      // 合规情形：① 明确声明是概述/意译；② 明确声明是原文直接引用；
      //           ③ 中国古典文本直录（文言原文本身就是原文）；④ 自撰教学范例
      const isDirectQuote = DIRECT_QUOTE.test(passage) || CLASSIC.test(meta) || isSelfAuthored;
      const declared = DECLARED_PARAPHRASE.test(meta) || DECLARED_VERBATIM.test(meta);
      if (!isDirectQuote && !declared) {
        closeNoDisclosure++;
        closeDisclosureDetail.push(f + "：《" + l.title + "》work=" + work.slice(0, 60));
      }
    }
  }
}
check(closeCount > 0, "存在 " + closeCount + " 个原著精读块");
check(closeNoSource === 0, "精读块都标了作者与出处/章节号" + (closeNoSource ? "（缺失 " + closeNoSource + " 处）" : ""));
closeSourceDetail.slice(0, 6).forEach((d) => console.log("      · " + d));
check(closeNoDisclosure === 0, "凡非逐字引用的精读块都声明了「内容概述，非逐字引文」" + (closeNoDisclosure ? "（缺失 " + closeNoDisclosure + " 处）" : ""));
closeDisclosureDetail.slice(0, 6).forEach((d) => console.log("      · " + d));
check(closeThin === 0, "精读块注释都 ≥4 条" + (closeThin ? "（不足 " + closeThin + " 处）" : ""));

/* 每门课的 name/term 是否都在 app.js 的 ORDER 里 */
const appSrc = read(join(ROOT, "app", "app.js"));
const ORDER = [...(appSrc.match(/var ORDER = \[([\s\S]*?)\];/) || [null, ""])[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const notInOrder = courses.map((x) => x.course.id).filter((id) => !ORDER.includes(id));
check(notInOrder.length === 0, "所有课程都在 app.js 的 ORDER 里" + (notInOrder.length ? "（缺失：" + notInOrder.join(", ") + "）" : ""));

/* ==================================================== 2. 页面引用 */
console.log("\n[2/3] 页面与产物");
const idxPath = join(ROOT, "index.html");
if (check(existsSync(idxPath), "index.html 存在")) {
  const idx = read(idxPath);
  const missing = [];
  for (const m of idx.matchAll(/src="([^"]+)"/g)) {
    if (!existsSync(join(ROOT, m[1]))) missing.push(m[1]);
  }
  check(missing.length === 0, "index.html 引用的脚本都存在" + (missing.length ? "（缺失：" + missing.join(", ") + "）" : ""));
  const notReferenced = files.concat(readingFiles).filter((f) => !idx.includes("data/" + f));
  check(notReferenced.length === 0, "所有课程与轨迹文件都被 index.html 引用" + (notReferenced.length ? "（未引用：" + notReferenced.join(", ") + "）" : ""));
}

const singlePath = join(ROOT, "philosophy-standalone.html");
if (check(existsSync(singlePath), "单文件版 philosophy-standalone.html 存在")) {
  const s = read(singlePath);
  const total = courses.reduce((n, x) => n + (x.course.lessons || []).length, 0);
  check(s.length > 50000, "单文件版体积合理（" + Math.round(s.length / 1024) + " KB）");
  check(!/src="(app|data)\//.test(s), "单文件版没有外部 app/ 或 data/ 依赖");
  const missingCourses = courses.filter((x) => !s.includes('"' + x.course.id + '"'));
  check(missingCourses.length === 0, "单文件版含全部 " + courses.length + " 门课程数据" + (missingCourses.length ? "（缺失：" + missingCourses.map((x) => x.course.id).join(", ") + "）" : ""));
  // 阅读轨迹也要内联进单文件版，并检查它的 lessons 引用是否落在真实讲次上
  if (plans.length) {
    const missingPlans = plans.filter((p) => !s.includes('"' + p.id + '"'));
    check(missingPlans.length === 0, "单文件版含全部 " + plans.length + " 条阅读轨迹" + (missingPlans.length ? "（缺失：" + missingPlans.map((p) => p.id).join(", ") + "）" : ""));
  }
  const badLessonRefs = [];
  plans.forEach((p) => (p.stages || []).forEach((st) => (st.books || []).forEach((b) => {
    (b.lessons || []).forEach((lid) => { if (!lessonIds.has(lid)) badLessonRefs.push(p.id + " → " + b.id + " → " + lid); });
  })));
  check(badLessonRefs.length === 0, "阅读轨迹的课程引用全部可达" + (badLessonRefs.length ? "（悬空 " + badLessonRefs.length + " 处：" + badLessonRefs.slice(0, 3).join("；") + "）" : ""));
  check(s.includes("window.COURSE_PACKS = [];"), "单文件版含 COURSE_PACKS 初始化");
  console.log("    统计：" + courses.length + " 门课 / " + total + " 讲");
}

/* ==================================================== 3. 浏览器渲染 */
console.log("\n[3/3] 浏览器渲染");
if (noBrowser) {
  console.log("  - 已按 --no-browser 跳过");
} else {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  ].filter(Boolean);
  const browser = candidates.find((p) => existsSync(p));
  if (!browser) {
    console.log("  - 没找到 Chrome/Edge，跳过浏览器测试（可用 --no-browser 消除此提示）");
  } else {
    console.log("  使用浏览器：" + basename(browser));
    const url = "file:///" + idxPath.replace(/\\/g, "/");
    let dom = "";
    try {
      dom = execFileSync(browser, [
        "--headless=new", "--disable-gpu", "--no-sandbox",
        "--virtual-time-budget=6000", "--dump-dom", url
      ], { encoding: "utf8", timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
    } catch (e) {
      dom = (e.stdout || "") + "";
      if (!dom) bad("浏览器运行失败：" + String(e.message).slice(0, 200));
    }
    if (dom) {
      check(/哲学本科/.test(dom), "页面标题渲染成功");
      check(/学习总览|课程地图/.test(dom), "首页内容渲染成功（应用已启动）");
      const navCount = (dom.match(/class="nav-item/g) || []).length;
      check(navCount > 5, "侧边栏导航项渲染 " + navCount + " 条");
      check(/没有加载到课程数据/.test(dom) === false, "没有出现「没有加载到课程数据」错误");
      const cardCount = (dom.match(/class="card"/g) || []).length;
      console.log("    首页课程卡 " + cardCount + " 张");
      // 顺带验证一个深层页面能渲染（课程页 + 课时页）
      const first = courses[0] && courses[0].course;
      if (first) {
        let dom2 = "";
        try {
          dom2 = execFileSync(browser, [
            "--headless=new", "--disable-gpu", "--no-sandbox",
            "--virtual-time-budget=6000", "--dump-dom",
            "file:///" + idxPath.replace(/\\/g, "/") + "#/c/" + first.id
          ], { encoding: "utf8", timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
        } catch (e) { dom2 = (e.stdout || "") + ""; }
        check(/课程目录/.test(dom2), "课程页（" + first.id + "）渲染成功");

        // 课时页：验证苏格拉底块、精读块、术语标注挂载点是否真的渲染出来
        const l0 = (first.lessons || [])[0];
        if (l0) {
          let dom3 = "";
          try {
            dom3 = execFileSync(browser, [
              "--headless=new", "--disable-gpu", "--no-sandbox",
              "--virtual-time-budget=8000", "--dump-dom",
              "file:///" + idxPath.replace(/\\/g, "/") + "#/c/" + first.id + "/" + l0.id
            ], { encoding: "utf8", timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
          } catch (e) { dom3 = (e.stdout || "") + ""; }
          check(/学习目标/.test(dom3), "课时页渲染出学习目标");
          check(/soc-box|苏格拉底/.test(dom3), "课时页渲染出苏格拉底式提问区");
          check(/close-passage|原著精读/.test(dom3), "课时页渲染出原著精读区");
          check(/class="block /.test(dom3), "课时页渲染出讲解块");
          check(/btnGlossToggle/.test(dom3), "顶栏含「生词标注」开关");
        }
      }
    }
  }
}

/* ==================================================== 汇总 */
console.log("\n════════ 冒烟测试汇总 ════════");
console.log("通过 " + pass + " 项，失败 " + fail + " 项");
if (fail) { console.log("✗ 冒烟测试未通过"); process.exit(1); }
console.log("✓ 冒烟测试全部通过");
