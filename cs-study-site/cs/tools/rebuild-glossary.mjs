// 修复 damaged 的 d 字段（尾部多了 。「, where: 」X），重新生成干净 glossary.js
import { readFileSync, writeFileSync } from "node:fs";

const P = "D:/ObsidianLocalLib/system1/DSH/2/cs/app/glossary.js";
const src = readFileSync(P, "utf8");

// 抽取：t / en / d（d 可能带尾部垃圾）/ where（垃圾后的内容）
const cats = [];
const catRe = /cat:\s*"([^"]+)"[\s\S]*?items:\s*\[([\s\S]*?)\n\s*\]\s*\}/g;
let cm;
while ((cm = catRe.exec(src)) !== null) {
  const cat = cm[1];
  const body = cm[2];
  const items = [];
  const itemRe = /\{\s*t:\s*"([^"]*)",\s*en:\s*"([^"]*)",\s*d:\s*"([\s\S]*?)",\s*where:\s*"([^"]*)"/g;
  let im;
  while ((im = itemRe.exec(body)) !== null) {
    let d = im[3];
    let where = im[4];
    // 去掉 d 尾部的垃圾：。「, where: 」 或 。「, where: 」X 里的 where 内容
    const junk = d.match(/^([\s\S]*?)(?:。「,\s*where:\s*」\s*(.*))?$/);
    if (junk && junk[2] !== undefined) {
      d = junk[1];
      if (!where) where = junk[2];
    }
    d = d.replace(/。「$/, "。").replace(/「$/, "").trim();
    where = (where || "").replace(/^」/, "").trim();
    items.push({ t: im[1], en: im[2], d, where });
  }
  if (items.length) cats.push({ cat, items });
}

// 若正则没抽到（格式不同），退化为宽松抽取
if (!cats.length) {
  const itemRe = /\{\s*t:\s*"([^"]*)",\s*en:\s*"([^"]*)",\s*d:\s*"([\s\S]*?)"\s*,\s*where:\s*"([^"]*)"/g;
  const items = [];
  let im;
  while ((im = itemRe.exec(src)) !== null) items.push({ t: im[1], en: im[2], d: im[3], where: im[4] });
  if (items.length) cats.push({ cat: "术语", items });
}

console.log("抽取到的条目数:", cats.reduce((n, c) => n + c.items.length, 0));
cats.forEach((c) => console.log("   " + c.cat + " → " + c.items.length));

const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const L = [];
L.push("/* ==========================================================================");
L.push("   glossary.js —— 术语表（零依赖；由 cs/tools/rebuild-glossary.mjs 生成）");
L.push("   结构：window.GLOSSARY = { cats: [{ cat, items: [{ t, en, d, where }] }] }");
L.push("   ========================================================================== */");
L.push("(function (global) {");
L.push('  "use strict";');
L.push("");
L.push("  var TERMS = [");
cats.forEach((c, ci) => {
  L.push("    {");
  L.push('      cat: "' + esc(c.cat) + '",');
  L.push("      items: [");
  c.items.forEach((it, ii) => {
    L.push('        { t: "' + esc(it.t) + '", en: "' + esc(it.en) + '", d: "' + esc(it.d) + '", where: "' + esc(it.where) + '" }' + (ii === c.items.length - 1 ? "" : ","));
  });
  L.push("      ]");
  L.push("    }" + (ci === cats.length - 1 ? "" : ","));
});
L.push("  ];");
L.push("");
L.push("  global.GLOSSARY = {");
L.push("    cats: TERMS,");
L.push("    flat: function () {");
L.push("      var out = [];");
L.push("      TERMS.forEach(function (c) {");
L.push("        c.items.forEach(function (it) {");
L.push("          out.push({ cat: c.cat, t: it.t, en: it.en, d: it.d, where: it.where });");
L.push("        });");
L.push("      });");
L.push("      return out;");
L.push("    },");
L.push("    count: function () { return TERMS.reduce(function (n, c) { return n + c.items.length; }, 0); }");
L.push("  };");
L.push("})(window);");
L.push("");

const out = L.join("\n");
try {
  const w = {};
  new Function("window", "globalThis", out)(w, w);
  const flat = w.GLOSSARY.flat();
  const bad = flat.filter((x) => /where:/.test(x.d) || !x.d || x.d.length < 8);
  console.log("✓ 生成通过；条目", flat.length, "| 可疑条目", bad.length);
  bad.slice(0, 3).forEach((b) => console.log("   ! " + b.t + " → " + b.d.slice(0, 60)));
  if (bad.length === 0) { writeFileSync(P, out, "utf8"); console.log("已写回"); }
  else console.log("存在可疑条目，未写回（避免再次破坏）");
} catch (e) {
  console.log("✗ 语法失败:", e.message);
}
