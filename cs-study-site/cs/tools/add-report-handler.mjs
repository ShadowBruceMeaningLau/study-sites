#!/usr/bin/env node
/**
 * 给站点的 app.js 接入"📄 学习报告"按钮事件（幂等）。
 * 用法：node <site>/tools/add-report-handler.mjs <cs|math>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const SITE = resolve(process.argv[2] || "cs");
const P = join(SITE, "app", "app.js");
let src = readFileSync(P, "utf8");

if (src.includes('getElementById("btnReport")')) { console.log("已存在，跳过"); process.exit(0); }

const anchor = '    $("#btnData").addEventListener("click", function () {';
if (!src.includes(anchor)) { console.log("找不到 btnData 锚点，未改动"); process.exit(1); }

const handler = `    var rb = document.getElementById("btnReport");
    if (rb) rb.addEventListener("click", function () {
      var md = studyReport();
      var fname = "学习报告-" + new Date().toISOString().slice(0, 10) + ".md";
      var blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast("已导出 " + fname + "（在浏览器的下载目录里）", "ok");
    });

${anchor}`;

src = src.replace(anchor, handler);
try { new Function("window", "globalThis", src + ";"); }
catch (e) { console.log("✗ 语法失败，未写回：" + e.message); process.exit(1); }
writeFileSync(P, src, "utf8");
console.log("已接入报告按钮事件 → " + P);
