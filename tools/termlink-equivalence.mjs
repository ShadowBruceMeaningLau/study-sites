// ============================================================================
//  termlink-equivalence.mjs —— 术语联动（linkTermsInHtml）的等价性 + 性能复核
//
//  背景：app.js 里的 linkTermsInHtml() 曾经是"逐字符循环 + 每个字符
//  html.slice(i) + 重跑 300+ 分支的 alternation 正则"，也就是 O(n²)：
//  实测 physics 平均 58ms/讲、最差 213ms/讲（详见 OPTIMIZATION-REVIEW.md 第 2 节）。
//
//  这个脚本从各站【真实的】app.js 里抽出 linkTermsInHtml / buildTermMap
//  （不是抄一份，而是直接从源码里按大括号配对抠出来），用各站真实的
//  glossary + markdown + 课程数据渲染每一个内容块，然后：
//    · 对比"现版本"与"线性版本"的输出是否逐字节相同（等价性）
//    · 分别计时（性能）
//
//  用法：
//    node tools/termlink-equivalence.mjs              # cs / math / physics
//    node tools/termlink-equivalence.mjs physics      # 只测一个站
//
//  期望结果：
//    · 补丁【之前】：mismatches=0（证明可安全替换），提速约 20~40×
//    · 补丁【之后】：mismatches=0，提速约 1×（两个函数已是同一实现，属正常）
//    · mismatches>0 ：不要打补丁，先看差异在哪
// ============================================================================
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ALL = ["cs", "math", "physics"];
const sites = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const targets = sites.length ? sites : ALL;

/** 从源码里按大括号配对抠出一个函数声明（含函数体） */
function extractFn(src, name) {
  const start = src.indexOf("function " + name + "(");
  if (start < 0) return null;
  const open = src.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  return null;
}

/** 线性版本：按标签切分，每个文本段只做一次 String.replace */
const CANDIDATE = `
function linkTermsInHtmlFast(html) {
  if (!html || html.indexOf("term-link") >= 0) return html;
  if (!TERM_MAP) TERM_MAP = buildTermMap();
  var names = Object.keys(TERM_MAP);
  if (!names.length) return html;
  names.sort(function (a, b) { return b.length - a.length; });
  var escaped = names.map(function (n) { return n.replace(ESCAPE_RE, "\\\\$&"); });
  var pattern = new RegExp("(" + escaped.join("|") + ")", "g");
  var skipTags = ["CODE", "PRE", "A", "H1", "H2", "H3", "H4", "BUTTON"];
  var out = "";
  var i = 0;
  var depth = 0;

  function linkRun(text) {
    if (!text || depth > 0) return text;
    pattern.lastIndex = 0;
    return text.replace(pattern, function (hit) {
      var it = TERM_MAP[hit];
      if (!it) return hit;
      return '<span class="term-link" data-term="' + esc(hit) + '" title="' + esc(String(it.d || "").slice(0, 120)) + '">' + esc(hit) + "</span>";
    });
  }

  while (i < html.length) {
    var lt = html.indexOf("<", i);
    if (lt < 0) { out += linkRun(html.slice(i)); break; }
    if (lt > i) out += linkRun(html.slice(i, lt));
    var gt = html.indexOf(">", lt);
    if (gt < 0) { out += html.slice(lt); break; }
    var tagText = html.slice(lt, gt + 1);
    out += tagText;
    var m = /^<(\\/?)([A-Za-z0-9]+)/.exec(tagText);
    if (m) {
      var isSkip = skipTags.indexOf(m[2].toUpperCase()) >= 0;
      if (!m[1] && !/\\/>$/.test(tagText) && isSkip) depth++;
      else if (m[1] && isSkip) depth = Math.max(0, depth - 1);
    }
    i = gt + 1;
  }
  return out;
}
`;

function loadSite(site) {
  const appPath = join(ROOT, site, "app", "app.js");
  if (!existsSync(appPath)) return { error: "没有 " + site + "/app/app.js" };
  const appSrc = readFileSync(appPath, "utf8");
  const shippedSrc = extractFn(appSrc, "linkTermsInHtml");
  const termMapSrc = extractFn(appSrc, "buildTermMap");
  if (!shippedSrc || !termMapSrc) return { error: site + " 的 app.js 里没有 linkTermsInHtml/buildTermMap（这个站可能不是同一套引擎）" };

  // 各站的转义写法不同：cs 用行内字面量，math/physics 用共享的 RE_ESCAPE。
  // 这里取该站自己的写法，保证对比的是"只改了循环方式、没改转义"。
  const reLine = appSrc.split(/\r?\n/).find((l) => l.includes("var RE_ESCAPE"));
  const escapeExpr = reLine
    ? "RE_ESCAPE"
    : (appSrc.match(/n\.replace\((\/[^\n]*?\/g),/) || [])[1];
  if (!escapeExpr) return { error: site + " 找不到术语转义表达式" };

  const sandbox = { console, setTimeout, clearTimeout, window: {} };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  sandbox.window.COURSE_PACKS = [];
  const ctx = vm.createContext(sandbox);
  for (const f of ["glossary.js", "markdown.js"]) {
    const p = join(ROOT, site, "app", f);
    if (existsSync(p)) vm.runInContext(readFileSync(p, "utf8"), ctx, { filename: f });
  }
  for (const f of readdirSync(join(ROOT, site, "data"))) {
    try { vm.runInContext(readFileSync(join(ROOT, site, "data", f), "utf8"), ctx, { filename: f }); } catch { /* 纯数据文件不该抛错，抛了就跳过 */ }
  }
  vm.runInContext([
    "var global = this;",
    reLine || "",
    "var ESCAPE_RE = " + escapeExpr + ";",
    "var TERM_MAP = null;",
    "function esc(s){ return MD.escapeHtml(s); }",
    termMapSrc,
    shippedSrc,
    CANDIDATE
  ].join("\n"), ctx, { filename: site + "/extracted.js" });

  return { ctx, packs: sandbox.window.COURSE_PACKS || [], MD: ctx.MD };
}

let failed = false;
for (const site of targets) {
  const loaded = loadSite(site);
  if (loaded.error) { console.log(`\n[跳过] ${loaded.error}`); continue; }

  const { ctx, packs, MD } = loaded;
  const blocks = [];
  for (const co of packs) {
    for (const l of co.lessons || []) {
      for (const b of l.blocks || []) {
        const md = b.md || b.note || "";
        if (md) blocks.push({ course: co.id, lesson: l.id, html: MD.md(md) });
      }
    }
  }
  if (!blocks.length) { console.log(`\n[跳过] ${site} 没有可渲染的内容块`); continue; }

  ctx.linkTermsInHtml(blocks[0].html);
  ctx.linkTermsInHtmlFast(blocks[0].html);

  let shippedMs = 0, fastMs = 0, mismatches = 0, chars = 0;
  const examples = [];
  for (const b of blocks) {
    chars += b.html.length;
    let t = process.hrtime.bigint();
    const a = ctx.linkTermsInHtml(b.html);
    shippedMs += Number(process.hrtime.bigint() - t) / 1e6;
    t = process.hrtime.bigint();
    const c = ctx.linkTermsInHtmlFast(b.html);
    fastMs += Number(process.hrtime.bigint() - t) / 1e6;
    if (a !== c) {
      mismatches++;
      if (examples.length < 3) examples.push(`${b.course}/${b.lesson} (${a.length} vs ${c.length} 字符)`);
    }
  }

  const speedup = fastMs > 0 ? shippedMs / fastMs : Infinity;
  console.log(`\n${site}`);
  console.log(`  内容块 ${blocks.length} 个 ｜ 渲染后 HTML ${(chars / 1e6).toFixed(2)}M 字符`);
  console.log(`  现版本   ${shippedMs.toFixed(0)} ms   (${(shippedMs / blocks.length).toFixed(1)} ms/块)`);
  console.log(`  线性版本 ${fastMs.toFixed(0)} ms   (${(fastMs / blocks.length).toFixed(1)} ms/块)`);
  console.log(`  提速     ${speedup.toFixed(1)}×`);
  console.log(`  输出差异 ${mismatches} 个块  ${mismatches === 0 ? "（逐字节相同，可安全替换）" : "← 不要替换，先查差异"}`);
  if (examples.length) console.log(`  差异示例 ${examples.join(" ｜ ")}`);
  if (mismatches === 0 && speedup < 1.5) console.log("  [说明] 提速≈1× 说明这个站已经是线性版本（补丁已应用）。");
  if (mismatches > 0) failed = true;
}

process.exit(failed ? 1 : 0);
