#!/usr/bin/env node
/**
 * cjk-diff.mjs —— 「中文内容守恒」检查：公式化改写不许吃掉正文。
 *
 * 结构指纹只能证明「课程/讲/块/题/实验数量没变」，证明不了「句子没被吞掉」。
 * 本工具把改写前（*.bak）与改写后的文件都读进来，各自抽出**连续中文片段**（去掉 $...$
 * 与 TeX 命令之后剩下的中文），再比对：原文件里有、新文件里没有的长片段就是可疑丢失。
 *
 * 用法：
 *   node tools/cjk-diff.mjs data/xxx.js.bak data/xxx.js
 *   node tools/cjk-diff.mjs --all          # 自动配对 data/ 下所有 .bak 与当前文件
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

/** 抽出一段文本里所有「连续中文（含中文标点）」片段 */
function runs(s) {
  const out = new Set();
  for (const m of String(s).matchAll(/[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]{4,}/g)) out.add(m[0]);
  return out;
}

function collect(file) {
  const packs = [];
  const src = readFileSync(file, "utf8");
  new Function("window", "globalThis", src + ";")({ COURSE_PACKS: packs }, { COURSE_PACKS: packs });
  const all = [];
  (function walk(v, key) {
    if (typeof v === "string") {
      if (key !== "code") all.push(v);
      return;
    }
    if (Array.isArray(v)) return v.forEach((x) => walk(x, key));
    if (v && typeof v === "object") for (const k of Object.keys(v)) walk(v[k], k);
  })(packs, "");
  const joined = all.join("\n");
  return { runs: runs(joined), cjk: (joined.match(/[\u4e00-\u9fff]/g) || []).length };
}

function compare(bak, cur) {
  const a = collect(bak);
  const b = collect(cur);
  const lost = [...a.runs].filter((r) => !b.runs.has(r));
  const dCjk = b.cjk - a.cjk;
  const tag = lost.length ? "✗" : "✓";
  console.log(`${tag} ${cur}：中文 ${a.cjk} → ${b.cjk} (${dCjk >= 0 ? "+" : ""}${dCjk})，丢失中文片段 ${lost.length} 个`);
  lost.slice(0, 6).forEach((r) => console.log("     丢了: " + JSON.stringify(r.slice(0, 60))));
  return lost.length;
}

const args = process.argv.slice(2);
let bad = 0;
if (args.includes("--all")) {
  for (const site of ["math", "cs"]) {
    const dir = join(site, "data");
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".js.bak"))) {
      const cur = join(dir, f.replace(/\.bak$/, ""));
      if (!existsSync(cur)) continue;
      try {
        bad += compare(join(dir, f), cur);
      } catch (e) {
        console.log(`? ${cur}：无法比对（${e.message}）`);
      }
    }
  }
} else {
  bad = compare(args[0], args[1]);
}
console.log(bad ? `\n合计可疑丢失 ${bad} 处 —— 请人工核对` : "\n✓ 没有发现中文正文丢失");
