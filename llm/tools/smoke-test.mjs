#!/usr/bin/env node
/**
 * 无浏览器冒烟测试：用最小 DOM/XHR 桩在 Node 里真实执行 index.html 的脚本管线，
 * 逐一渲染每条路由并断言关键内容，抓出运行时错误。
 * 用法：node tools/smoke-test.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".mjs": "text/javascript" };

let failures = 0;
const errors = [];
const listenerErrors = [];   // 事件监听器里抛出的异常（会被断言，避免"点了没反应"被漏掉）
function ok(cond, label, extra) {
  if (cond) console.log("  ✓ " + label);
  else { console.log("  ✗ " + label + (extra ? "  → " + extra : "")); failures++; }
}

/* --------------------------------------------------------------- DOM 桩 */
class StubEl {
  constructor(tag) {
    this.tagName = String(tag || "div").toUpperCase();
    this.children = [];
    this.childNodes = this.children;
    this.attrs = {};
    this.style = {};
    this.dataset = {};
    this._text = "";
    this._html = "";
    this.listeners = {};
    this.parentNode = null;
    this.disabled = false;
    this.value = "";
    this.checked = false;
    this.hidden = false;
  }
  get className() { return this._cls || ""; }
  set className(v) { this._cls = String(v || ""); }
  // 事件对象：与浏览器一致地提供 target / currentTarget / closest / preventDefault
  makeEvent(type, detail) {
    const self = this;
    return Object.assign({
      type,
      target: self,
      currentTarget: self,
      defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() { this._stopped = true; },
      closest(sel) { return self.closest(sel); }
    }, detail || {});
  }
  /** 沿祖先链冒泡派发（与浏览器一致），并记录监听器里的异常 */
  dispatch(type, detail) {
    const ev = this.makeEvent(type, detail);
    const path = [];
    let node = this;
    while (node) { path.push(node); node = node.parentNode; }
    for (const n of path) {
      const fns = n.listeners[type];
      if (!fns) continue;
      for (const fn of fns.slice()) {
        try { fn(ev); }
        catch (err) { listenerErrors.push(type + " 监听器异常: " + String((err && err.message) || err)); }
        if (ev._stopped) return ev;
      }
    }
    return ev;
  }
  get classList() {
    const self = this;
    const read = () => String(self._cls || "").split(/\s+/).filter(Boolean);
    return {
      add(...c) { const s = new Set(read()); c.forEach((x) => s.add(x)); self._cls = [...s].join(" "); },
      remove(...c) { const s = new Set(read()); c.forEach((x) => s.delete(x)); self._cls = [...s].join(" "); },
      toggle(c, force) {
        const s = new Set(read());
        const has = s.has(c);
        const want = force === undefined ? !has : !!force;
        if (want) s.add(c); else s.delete(c);
        self._cls = [...s].join(" ");
        return want;
      },
      contains(c) { return read().includes(c); }
    };
  }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v == null ? "" : v); this.children = []; }
  get textContent() { return this._text || this._html.replace(/<[^>]*>/g, ""); }
  set textContent(v) { this._text = String(v == null ? "" : v); this.children = []; }
  get firstChild() { return this.children[0] || null; }
  get isContentEditable() { return false; }
  appendChild(n) { this.children.push(n); n.parentNode = this; return n; }
  append(...ns) { ns.forEach((n) => this.appendChild(n)); }
  insertBefore(n) { return this.appendChild(n); }
  removeChild(n) { this.children = this.children.filter((x) => x !== n); return n; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  contains(n) { let cur = n; while (cur) { if (cur === this) return true; cur = cur.parentNode; } return false; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); }
  removeEventListener() {}
  click() { return this.dispatch("click"); }
  focus() {}
  blur() {}
  close() { return this.dispatch("close"); }
  showModal() { return this.dispatch("open"); }
  scrollTo() {}
  querySelector(sel) { return queryAll(this, sel)[0] || null; }
  querySelectorAll(sel) { return queryAll(this, sel); }
  closest(sel) { let n = this; while (n) { if (matches(n, sel)) return n; n = n.parentNode; } return null; }
  get outerHTML() { return "<" + this.tagName.toLowerCase() + ">" + this.innerHTML + "</" + this.tagName.toLowerCase() + ">"; }
}

function matches(node, sel) {
  sel = sel.trim();
  if (sel.startsWith(".")) return node.classList.contains(sel.slice(1));
  if (sel.startsWith("#")) return node.attrs.id === sel.slice(1) || node.id === sel.slice(1);
  return node.tagName === sel.toUpperCase();
}
function queryAll(root, sel) {
  const out = [];
  const parts = sel.split(",").map((s) => s.trim());
  const walk = (n) => {
    n.children.forEach((c) => {
      if (parts.some((p) => {
        if (p.includes(" ")) return false;
        if (p.startsWith("[")) {
          const m = p.match(/^\[([\w-]+)(?:=["']?([^"'\]]*)["']?)?\]$/);
          if (!m) return false;
          return m[2] == null ? c.attrs[m[1]] != null : c.attrs[m[1]] === m[2];
        }
        return matches(c, p);
      })) out.push(c);
      walk(c);
    });
  };
  walk(root);
  return out;
}
function deepText(node, acc = [], depth = 0) {
  if (depth > 24) return acc.join(" ");
  acc.push(node._text || "", node._html || "");
  node.children.forEach((c) => deepText(c, acc, depth + 1));
  return acc.join(" ");
}

/* -------------------------------------------------------- 最小浏览器环境 */
const FIXTURE = process.argv.includes("--fixture");
const ENTRY = process.env.CS_ENTRY || (FIXTURE ? "tools/fixture.html" : "index.html");
console.log("入口文件：" + ENTRY +
  (FIXTURE ? "（引擎隔离自测模式，使用极小数据）" : ENTRY === "index.html" ? "（完整课程数据）" : "（自定义入口）"));
const html = readFileSync(join(ROOT, ENTRY), "utf8");
const scriptSrcs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const root = new StubEl("div");
const byId = { app: new StubEl("div"), content: new StubEl("div"), nav: new StubEl("div") };
const ids = ["app", "sidebar", "nav", "main", "crumbs", "search", "searchPop", "content", "toastHost",
  "ringFg", "ringPct", "nbCount", "btnReview", "btnNotebook", "btnTheme", "btnData", "btnMenu", "ringWrap"];
ids.forEach((id) => { byId[id] = byId[id] || new StubEl("div"); byId[id].attrs.id = id; });
const documentStub = {
  readyState: "complete",
  documentElement: Object.assign(new StubEl("html"), { dataset: {} }),
  body: root,
  head: new StubEl("head"),
  createElement: (t) => new StubEl(t),
  createTextNode: (t) => { const n = new StubEl("#text"); n.textContent = t; return n; },
  getElementById: (id) => byId[id] || null,
  querySelector: (sel) => (sel.startsWith("#") ? byId[sel.slice(1)] || null : queryAll(root, sel)[0] || null),
  querySelectorAll: (sel) => queryAll(root, sel),
  addEventListener() {},
  removeEventListener() {},
  dispatch() {}
};

const rafQueue = [];
const timerQueue = [];   // 只收集 setTimeout(…, 0)：用于兑现 hashchange 等异步派发
const storage = {};
// location.hash 必须像浏览器一样：赋值后异步派发 hashchange，否则单页路由不会被触发
const winListeners = {};
let currentHash = "#/";
const locationStub = {
  href: "http://local/index.html",
  get hash() { return currentHash; },
  set hash(v) {
    const next = String(v);
    if (next === currentHash) return;
    if (!next.startsWith("#")) throw new Error("hash 必须以 # 开头: " + next);
    currentHash = next;
    setTimeout(() => {
      (winListeners.hashchange || []).slice().forEach((fn) => {
        try { fn({ type: "hashchange" }); }
        catch (err) { listenerErrors.push("hashchange 监听器异常: " + String((err && err.message) || err)); }
      });
    }, 0);
  }
};
const sandbox = {
  console,
  document: documentStub,
  navigator: { clipboard: null, userAgent: "node-smoke" },
  location: { hash: "#/", href: "http://local/index.html" },
  localStorage: {
    getItem: (k) => (k in storage ? storage[k] : null),
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; }
  },
  performance: { now: () => Date.now() },
  setTimeout: (fn, ms) => { if (!ms) timerQueue.push(fn); return timerQueue.length; },
  clearTimeout: () => {},
  setInterval: () => 0,
  clearInterval: () => {},
  requestAnimationFrame: (fn) => { rafQueue.push(fn); return rafQueue.length; },
  alert: () => {}, confirm: () => true,
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  XMLHttpRequest: class {
    open(method, url) { this._url = url; this.readyState = 1; }
    setRequestHeader() {}
    getResponseHeader() { return MIME[extname(this._url || "")] || "text/plain"; }
    send() {
      const rel = String(this._url || "").split("?")[0];
      let text;
      try { text = readFileSync(join(ROOT, rel), "utf8"); }
      catch { this.status = 404; this.readyState = 4; if (this.onerror) this.onerror(new Error("404 " + rel)); return; }
      this.status = 200;
      this.readyState = 4;
      this.responseText = text;
      this.response = text;
      if (this.onload) this.onload();
    }
  }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
sandbox.addEventListener = (type, fn) => { (winListeners[type] = winListeners[type] || []).push(fn); };
sandbox.removeEventListener = (type, fn) => { winListeners[type] = (winListeners[type] || []).filter((x) => x !== fn); };
sandbox.dispatchEvent = () => {};
vm.createContext(sandbox);

/* ------------------------------------------------------------- 执行脚本 */
console.log("=== 1. 在 Node 中执行 index.html 的脚本管线 ===");
const loaded = [];
const DEBUG = process.argv.includes("--debug");
// 先执行 HTML 内联脚本（例如 COURSE_PACKS = [] 的初始化），与浏览器行为一致
const inlineCodes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
inlineCodes.forEach((code, i) => {
  try { vm.runInContext(code, sandbox, { filename: "inline-" + i }); }
  catch (e) { errors.push("inline-" + i + " → " + e.message); }
});
if (DEBUG) console.log("  内联脚本 " + inlineCodes.length + " 段，COURSE_PACKS = " + typeof sandbox.COURSE_PACKS);
for (const src of scriptSrcs) {
  try {
    if (src === "index.html") continue;
    const code = readFileSync(join(ROOT, src), "utf8");
    if (DEBUG) console.log("  ▶ " + src + " | COURSE_PACKS=" + (Array.isArray(sandbox.COURSE_PACKS) ? "array(" + sandbox.COURSE_PACKS.length + ")" : typeof sandbox.COURSE_PACKS) + " | 前 50 字符: " + JSON.stringify(code.slice(0, 50)));
    vm.runInContext(code, sandbox, { filename: src });
    if (DEBUG) console.log("    ✓ 执行完成，COURSE_PACKS=" + (Array.isArray(sandbox.COURSE_PACKS) ? "array(" + sandbox.COURSE_PACKS.length + ")" : typeof sandbox.COURSE_PACKS));
    loaded.push(src);
  } catch (e) {
    errors.push(src + " → " + e.message);
  }
}
ok(loaded.length === scriptSrcs.length, `全部 ${scriptSrcs.length} 个脚本执行成功`, errors.join("; "));
ok(typeof sandbox.APP === "object" && sandbox.APP.courses.length > 0, "APP 已初始化，课程数 = " + (sandbox.APP && sandbox.APP.courses.length));
ok(typeof sandbox.LABS === "object" && sandbox.LABS.types.length >= 7, "LABS 渲染器注册：" + (sandbox.LABS ? sandbox.LABS.types.join(", ") : "无"));

const courses = sandbox.APP.courses;
const lessons = [];
courses.forEach((c) => c.lessons.forEach((l) => lessons.push({ c, l })));

function flushRaf() { let n = 0; while (rafQueue.length && n++ < 50) rafQueue.shift()(); }
/** 把挂起的 setTimeout(0) 回调（含 hashchange 派发）跑完 */
function flushTimers() {
  let guard = 0;
  while (timerQueue.length && guard++ < 50) {
    const fn = timerQueue.shift();
    try { fn(); } catch (err) { listenerErrors.push("定时器回调异常: " + String((err && err.message) || err)); }
  }
}
function nav(hash) {
  sandbox.location.hash = hash;
  flushTimers();          // 浏览器会异步派发 hashchange，这里同步兑现
  sandbox.APP.render();
  flushRaf();
  flushTimers();
  flushRaf();
  return byId.content;
}

/** 模拟真实点击：派发 click 后把挂起的异步工作（hashchange / rAF）也兑现掉 */
function clickAndSettle(node) {
  const ev = node.click();
  flushTimers();
  flushRaf();
  flushTimers();
  flushRaf();
  return ev;
}

console.log("\n=== 2. 逐条路由渲染（真实执行渲染代码） ===");
try {
  let c = nav("#/");
  ok(deepText(c).includes("学习总览"), "总览页渲染");
  ok(deepText(c).includes("交互实验"), "总览页统计含交互实验");
  c = nav("#/path");
  ok(deepText(c).includes("学习路径"), "学习路径页渲染");
  c = nav("#/notebook");
  ok(deepText(c).includes("错题本"), "错题本页渲染");
  c = nav("#/review");
  ok(deepText(c).includes("复习"), "复习页渲染");
} catch (e) {
  ok(false, "基础路由渲染", e.stack);
}

console.log("\n=== 3. 侧边栏点击切页（真实模拟用户点左边的框） ===");
try {
  nav("#/");
  const navBox = byId.nav;
  const rows = queryAll(navBox, ".nav-item");
  const minRows = 4 + courses.length;   // 总览/路径/复习/错题本 + 每门课一条
  ok(rows.length >= minRows, "侧边栏渲染出 " + rows.length + " 个可点条目（至少 " + minRows + "）");
  ok(rows.every((r) => /^#\//.test(r.attrs.href || "")), "每个条目都是真实链接（href 指向对应路由）");

  // 逐个点击前面若干条，验证视图确实切换
  const probes = [
    ["#/path", "学习路径"],
    ["#/notebook", "错题本"],
    ["#/review", "复习"],
    ["#/", "学习总览"]
  ];
  let clickFails = [];
  for (const [route, expect] of probes) {
    const row = queryAll(navBox, ".nav-item").find((r) => r.dataset.route === route);
    if (!row) { clickFails.push("侧边栏缺少条目 " + route); continue; }
    clickAndSettle(row);
    const text = deepText(byId.content);
    if (!text.includes(expect)) clickFails.push("点击 " + route + " 后内容未包含「" + expect + "」");
    if (sandbox.location.hash !== route) clickFails.push("点击 " + route + " 后 hash 仍是 " + sandbox.location.hash);
  }
  ok(clickFails.length === 0, "点击侧边栏条目可切换页面（含总览/路径/错题本/复习）", clickFails.join(" | "));
  ok(listenerErrors.length === 0, "点击过程中没有事件监听器异常", listenerErrors.slice(0, 3).join(" | "));

  // 点击某门课 → 应进入课程页；再点该课下的某一讲 → 应进入课时页
  const courseRow = queryAll(navBox, ".nav-item").find((r) => /^#\/c\/[\w-]+$/.test(r.dataset.route || ""));
  ok(!!courseRow, "侧边栏含课程条目：" + (courseRow ? courseRow.dataset.route : "无"));
  if (courseRow) {
    clickAndSettle(courseRow);
    const cid = courseRow.dataset.route.replace("#/c/", "");
    const co = courses.find((x) => x.id === cid);
    ok(deepText(byId.content).includes("课程目录"), "点击课程「" + (co ? co.title : cid) + "」后进入课程页");
    const subRows = queryAll(navBox, ".nav-item").filter((r) => (r.dataset.route || "").startsWith("#/c/" + cid + "/"));
    ok(subRows.length === (co ? co.lessons.length : 0), "展开该课后侧边栏出现 " + subRows.length + " 个讲级条目");
    if (subRows.length) {
      const target = subRows[1] || subRows[0];
      clickAndSettle(target);
      const lid = target.dataset.route.split("/").pop();
      const lesson = co.lessons.find((l) => l.id === lid);
      ok(deepText(byId.content).includes(lesson.title), "点击讲级条目后打开《" + lesson.title + "》");
      ok(deepText(byId.content).includes("随堂测验"), "该讲页含随堂测验区");
    }
  }
  // 回车键（无鼠标）也应能触发：等价于浏览器跟随 href
  const pathRow = queryAll(byId.nav, ".nav-item").find((r) => r.dataset.route === "#/path");
  ok(pathRow && pathRow.attrs.href === "#/path", "侧边栏条目可用键盘/回车触发（真实 href）");
} catch (e) {
  ok(false, "侧边栏点击切页", e.stack);
}

console.log("\n=== 4. 渲染全部课程页与课时页（含实验组件与测验） ===");
let renderedLessons = 0, renderedLabs = 0, renderedQuiz = 0;
const routeErrors = [];
for (const { c: co, l } of lessons) {
  try {
    let page = nav("#/c/" + co.id);
    if (!deepText(page).includes(l.title)) routeErrors.push(co.id + ": 课程页缺少《" + l.title + "》");
    const labN = (l.blocks || []).filter((b) => b.type === "interactive").length;
    page = nav("#/c/" + co.id + "/" + l.id);
    const txt = deepText(page);
    if (!txt.includes(l.title)) routeErrors.push(l.id + ": 课时页标题缺失");
    if (labN > 0 && /实验渲染失败/.test(txt)) routeErrors.push(l.id + ": 实验渲染失败 → " + txt.match(/实验渲染失败[^<]{0,90}/));
    if (!txt.includes("随堂测验")) routeErrors.push(l.id + ": 测验区未渲染");
    renderedLessons++;
    renderedLabs += labN;
    renderedQuiz += (l.quiz || []).length;
  } catch (e) {
    routeErrors.push(l.id + " 抛异常: " + e.message);
  }
}
ok(routeErrors.length === 0, `全部 ${renderedLessons} 讲渲染通过（${renderedLabs} 个实验 / ${renderedQuiz} 道题）`,
  routeErrors.slice(0, 8).join(" | ") + (routeErrors.length > 8 ? ` …共 ${routeErrors.length} 条` : ""));

console.log("\n=== 5. 交互实验真实计算校验 ===");
try {
  // 经典访问串（3 页框）：FIFO=15、LRU=12、OPT=9，逐步轨迹已人工核对
  const refsC = [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1];
  const rLru = sandbox.LABS.runPage(refsC, 3, "LRU");
  ok(rLru.faults === 12, "LRU 缺页次数 = " + rLru.faults + "（3 页框、20 次访问，逐步核对为 12）");
  ok(rLru.rows.map((r) => (r.hit ? "H" : "F")).join("") === "FFFFHFHFFFFHHFHFHFHH",
    "LRU 命中序列与逐步模拟一致：" + rLru.rows.map((r) => (r.hit ? "H" : "F")).join(""));
  const fLru = sandbox.LABS.runPage(refsC, 3, "FIFO");
  ok(fLru.faults === 15, "FIFO 缺页次数 = " + fLru.faults);
  const o = sandbox.LABS.runPage(refsC, 3, "OPT");
  ok(o.faults === 9, "OPT 缺页次数 = " + o.faults + "（最优，应为 9）");
  ok(o.faults <= rLru.faults && rLru.faults <= fLru.faults, "OPT ≤ LRU ≤ FIFO 的缺页次数关系成立（局部性原理）");
  // Belady 异常：同一访问串，FIFO 增大页框数反而缺页变多；LRU 具有栈性质，不会出现该异常
  const refsB = [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5];
  const fifo3 = sandbox.LABS.runPage(refsB, 3, "FIFO").faults;
  const fifo4 = sandbox.LABS.runPage(refsB, 4, "FIFO").faults;
  const lru3 = sandbox.LABS.runPage(refsB, 3, "LRU").faults;
  const lru4 = sandbox.LABS.runPage(refsB, 4, "LRU").faults;
  ok(fifo3 === 9 && fifo4 === 10, `FIFO 复现 Belady 异常：3 页框缺页 ${fifo3} 次，4 页框反而 ${fifo4} 次`);
  ok(lru4 <= lru3, `LRU 无 Belady 异常：3 页框 ${lru3} 次，4 页框 ${lru4} 次`);
  // LLM 站六类新实验的课堂覆盖检查（交付后逐步启用；W0 只要求引擎实验存在）
  const anyLlmLab = lessons.some(({ l }) => (l.blocks || []).some((b) => b.type === "interactive"));
  ok(anyLlmLab, "存在使用交互实验的课时");
  // 位模式：8 位补码 -1
  ok(sandbox.MD.highlight("int x = 0x10; // 注释", "c").includes("tok-cm"), "语法高亮识别注释");
  ok(sandbox.MD.md("**粗体** 与 `代码`").includes("<strong>") && sandbox.MD.md("`a`").includes("<code>"), "Markdown 渲染粗体与行内代码");
  ok(sandbox.QUIZ.normalize("O（n）") === sandbox.QUIZ.normalize("o(n)"), "填空题归一化：全角括号/大小写等价");
} catch (e) {
  ok(false, "实验计算校验", e.stack);
}

console.log("\n=== 6. 学习流程模拟（答题 / 错题本 / 进度持久化） ===");
try {
  const first = lessons[0];
  const page = nav("#/c/" + first.c.id + "/" + first.l.id);
  const cards = queryAll(page, ".qcard");
  ok(cards.length >= 2, "课时页渲染出 " + cards.length + " 张题卡");
  // 模拟：故意答错第一题（选错误的选项）
  const q0 = first.l.quiz[0];
  const opts = queryAll(cards[0], ".opt");
  ok(opts.length >= 3, "题卡渲染出 " + opts.length + " 个选项");
  // ★ 选项在渲染层会被确定性重排（QUIZ.present），所以界面上「正确位置」不是 q0.answer，
  //   而是 present 之后的 answer。必须用呈现版本算错误选项，否则会点到正确项上、
  //   错题本里就没有记录（这个坑真实发生过：加完重排后本门禁 3 项失败）。
  const q0view = sandbox.QUIZ && sandbox.QUIZ.present ? sandbox.QUIZ.present(q0) : q0;
  let wrongIdx = 0;
  if (q0.type === "single") wrongIdx = q0view.answer === 0 ? 1 : 0;
  opts[wrongIdx].click();
  const submit = queryAll(cards[0], ".btn").find((b) => b.textContent.includes("提交"));
  submit.click();
  const sm = sandbox.PROGRESS.mistakes();
  ok(sm.length === 1 && sm[0].qid === q0.id, "答错后自动记入错题本：" + (sm[0] ? sm[0].qid : "无"));
  ok(sandbox.PROGRESS.state().quiz[first.l.id].attempted === 1, "测验作答次数已记录");
  const nb = nav("#/notebook");
  ok(deepText(nb).includes("错误 1 次"), "错题本页显示错误次数");
  // 复习页应能抽到错题
  const rv = nav("#/review");
  ok(deepText(rv).includes("错题本"), "复习页包含错题来源标记");
  // 标记掌握 + 持久化
  sandbox.PROGRESS.markDone(first.l.id, true);
  ok(sandbox.PROGRESS.isDone(first.l.id), "标记本讲已掌握");
  ok(storage["llm-learn:v1"] && storage["llm-learn:v1"].includes(first.l.id), "进度已写入 localStorage");
  const txt = storage["llm-learn:v1"];
  sandbox.PROGRESS.resetAll();
  sandbox.PROGRESS.importJson(txt);
  ok(sandbox.PROGRESS.isDone(first.l.id) && sandbox.PROGRESS.mistakes().length === 1, "导出→重置→导入 可完整恢复进度与错题");
} catch (e) {
  ok(false, "学习流程模拟", e.stack);
}

console.log("\n=== 7. 数据结构完整性（分层覆盖） ===");
if (FIXTURE) {
  ok(true, "隔离自测模式：跳过完整课程集与服务端内容规模断言");
} else try {
  const ids = courses.map((c) => c.id);
  // LLM 站主干清单：31 门全部交付，任何一门掉线都算失败。
  // ★ 新增课程后必须同时更新这里与 app/app.js 的 ORDER——漏一处就会静默少课。
  const must = [
    "llm-zero-basics", "python-basics-ai", "ml-dl-basics", "neural-networks",
    "tokenizer-vocab", "attention-transformer", "pretraining-inference",
    "frontier-models", "posttraining-alignment",
    // 研究侧四门（2026-10-25 覆盖度专项）：主线 A
    "continual-learning", "self-evolution", "learning-algorithms",
    "next-gen-architecture", "world-model-generation",
    "prompt-engineering", "inference-api", "harness-anatomy",
    "agent-protocols-2026", "tool-calling", "rag", "finetuning-lora",
    "agent-core", "memory-architecture", "eval-harness", "agent-security",
    "project-rag", "project-cli-agent", "project-evals", "project-dsh-extension",
    "frontier-tracking", "frontier-radar"
  ];
  const missing = must.filter((m) => !ids.includes(m));
  ok(missing.length === 0, "培养方案主干课程齐全（" + courses.length + " 门 / 应含 " + must.length + " 门主干）", "缺：" + missing.join(", "));
  const labCount = lessons.reduce((n, x) => n + (x.l.blocks || []).filter((b) => b.type === "interactive").length, 0);
  // 收口门槛：与 cs 站（204 个实验）同数量级；按 2026-10-25 实测 193 留 5% 余量。
  ok(labCount >= 195, "交互实验总数 = " + labCount);
  const qCount = lessons.reduce((n, x) => n + (x.l.quiz || []).length, 0);
  // 收口门槛：与 cs 站（677 题）同数量级；按 2026-10-25 实测 645 留 5% 余量。
  ok(qCount >= 645, "测验题总数 = " + qCount);
  const dup = {};
  let dupN = 0;
  lessons.forEach(({ l }) => {
    if (dup[l.id]) dupN++;
    dup[l.id] = 1;
  });
  ok(dupN === 0, "lesson.id 无重复");
  const termOrder = [...new Set(courses.map((c) => c.term))];
  ok(termOrder.length >= 1, "学习路径按 " + termOrder.length + " 条主线组织：" + termOrder.join(" / "));
} catch (e) {
  ok(false, "数据结构完整性", e.stack);
}

console.log("\n" + (failures === 0 ? "✓ 冒烟测试全部通过。" : `✗ 冒烟测试失败 ${failures} 项。`));
process.exit(failures === 0 ? 0 : 1);
