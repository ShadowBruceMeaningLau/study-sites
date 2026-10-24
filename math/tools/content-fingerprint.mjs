#!/usr/bin/env node
/**
 * content-fingerprint.mjs —— 内容指纹：改写公式前先拍一张「结构快照」，改完再对比。
 *
 * 背景：批量改写课程内容最容易出的事故不是公式写错，而是**误删/截断正文**
 * （历史上真的发生过：一次正则替换把整个文件改坏了）。这个脚本给出证据：
 * 只改公式的改写，课程数/讲数/块数/题数/实验数必须一字不差，总字数只应有小幅变化。
 *
 * 用法：
 *   node tools/content-fingerprint.mjs --write          # 拍到 tools/content-baseline.json
 *   node tools/content-fingerprint.mjs --check          # 与快照对比（结构有变则退出码 1）
 *   node tools/content-fingerprint.mjs --check --tol 25 # 字数容差改成 25%
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");
const SNAP = join(ROOT, "tools", "content-baseline.json");

const argv = process.argv.slice(2);
const WRITE = argv.includes("--write");
const CHECK = argv.includes("--check") || !WRITE;
const tolIdx = argv.indexOf("--tol");
const TOL = tolIdx > -1 ? Number(argv[tolIdx + 1]) / 100 : 0.15;

const chars = (s) => [...String(s ?? "").replace(/\s/g, "")].length;

/** 把一个文件里的课程对象压成指纹 */
function printOf(file) {
  const code = readFileSync(join(DATA, file), "utf8");
  const arr = [];
  new Function("window", "globalThis", code + ";")({ COURSE_PACKS: arr }, { COURSE_PACKS: arr });
  const out = { courses: arr.length, lessons: 0, blocks: 0, quiz: 0, labs: 0, textChars: 0, byType: {} };
  const collect = (v, key) => {
    if (typeof v === "string") {
      if (key !== "code") out.textChars += chars(v);
      return;
    }
    if (Array.isArray(v)) { v.forEach((x) => collect(x, key)); return; }
    if (v && typeof v === "object") { for (const k of Object.keys(v)) collect(v[k], k); }
  };
  for (const c of arr) {
    collect(c.meta || {}, "meta");
    for (const l of c.lessons || []) {
      out.lessons++;
      out.textChars += chars(l.goal) + chars(l.need) + chars(l.summary) + chars(l.title);
      for (const b of l.blocks || []) {
        out.blocks++;
        out.byType[b.type] = (out.byType[b.type] || 0) + 1;
        if (b.type === "interactive") out.labs++;
        collect(b, b.type);
      }
      for (const q of l.quiz || []) {
        out.quiz++;
        collect(q, "quiz");
      }
    }
  }
  out.byType = Object.fromEntries(Object.entries(out.byType).sort());
  return out;
}

const files = readdirSync(DATA).filter((f) => f.endsWith(".js")).sort();
const now = {};
for (const f of files) {
  try {
    now[f] = printOf(f);
  } catch (e) {
    console.log(`✗ ${f} 无法求值：${e.message}`);
    process.exitCode = 1;
  }
}

if (WRITE) {
  writeFileSync(SNAP, JSON.stringify(now, null, 1) + "\n");
  const t = Object.values(now).reduce(
    (a, b) => ({ l: a.l + b.lessons, b: a.b + b.blocks, q: a.q + b.quiz, c: a.c + b.textChars }),
    { l: 0, b: 0, q: 0, c: 0 });
  console.log(`已写入快照 ${SNAP}`);
  console.log(`基线：${Object.keys(now).length} 个文件 / ${t.l} 讲 / ${t.b} 块 / ${t.q} 题 / 正文 ${t.c} 字`);
  process.exit();
}

if (!existsSync(SNAP)) {
  console.log("没有快照，先跑：node tools/content-fingerprint.mjs --write");
  process.exit(1);
}
const base = JSON.parse(readFileSync(SNAP, "utf8"));
let fails = 0;
let warns = 0;
const rows = [];
for (const f of new Set([...Object.keys(base), ...Object.keys(now)])) {
  const a = base[f];
  const b = now[f];
  if (!a || !b) { console.log(`✗ ${f} 只在一边存在`); fails++; continue; }
  const diffs = [];
  for (const k of ["courses", "lessons", "blocks", "quiz", "labs"]) {
    if (a[k] !== b[k]) diffs.push(`${k} ${a[k]}→${b[k]}`);
  }
  if (JSON.stringify(a.byType) !== JSON.stringify(b.byType)) diffs.push("块类型分布变了");
  const d = b.textChars - a.textChars;
  const pct = a.textChars ? d / a.textChars : 0;
  if (diffs.length) { fails++; rows.push(["✗", f, diffs.join("; ")]); }
  else if (Math.abs(pct) > TOL) { warns++; rows.push(["!", f, `正文 ${a.textChars}→${b.textChars} 字 (${(pct * 100).toFixed(1)}%)`]); }
  else if (d !== 0) rows.push(["·", f, `正文 ${a.textChars}→${b.textChars} 字 (${(pct * 100).toFixed(1)}%)`]);
}
for (const [m, f, s] of rows) console.log(`${m} ${f.padEnd(30)} ${s}`);
const tb = Object.values(base).reduce((x, y) => x + y.textChars, 0);
const tn = Object.values(now).reduce((x, y) => x + y.textChars, 0);
console.log(`\n对比完成：结构不符 ${fails} 个文件，字数超容差 ${warns} 个；正文合计 ${tb} → ${tn} 字 (${(((tn - tb) / tb) * 100).toFixed(1)}%)`);
if (fails) { console.log("✗ 结构被改动，必须人工检查！"); process.exitCode = 1; }
else console.log("✓ 课程/讲/块/题/实验数量与基线完全一致（只改了内容，没丢东西）");
