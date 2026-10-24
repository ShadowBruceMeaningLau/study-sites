#!/usr/bin/env node
/**
 * 在站点首页插入"零基础从哪开始"的显眼指引块。幂等。
 * 用法：node <site>/tools/add-starter-banner.mjs <cs|math> "<课程路由>" "<课程标题>"
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const [siteArg, route, title] = process.argv.slice(2);
const SITE = resolve(siteArg || "cs");
const P = join(SITE, "app", "app.js");
let src = readFileSync(P, "utf8");

if (src.includes("starter-banner")) { console.log("已存在，跳过"); process.exit(0); }

// 插入点：首页 review-bar 之后（wrap.appendChild(bar); 后面跟 wrap.appendChild(el("h2", "sec", "课程地图"));）
const anchor = '    wrap.appendChild(el("h2", "sec", "课程地图"));';
if (!src.includes(anchor)) { console.log("找不到锚点，未改动"); process.exit(1); }

const block = `    // 零基础引导
    var starter = el("div", "block concept starter-banner");
    starter.innerHTML = "<h3>🌱 完全零基础？按这个顺序开始 <span class='tag'>推荐路线</span></h3>" +
      MD.md("1. 先打开左侧 **📖 术语表**，把「零基础」那一类（十几条）过一遍——遇到不认识的词随时回来查。\\n" +
        "2. 再学 **【" + ${JSON.stringify(title)} + "】**，它会带你认识电脑与文件、打开终端、装好环境、跑出第一个程序（数学版则是符号、逻辑与证明的入门）。\\n" +
        "3. 然后按「培养方案路径」从大一上的课依次往后学；每门课页面顶部都会写明 **学它之前需要会什么**。\\n" +
        "> 遇到看不懂的课，不要硬撑：先确认它的前置课学过没有——前置提示会直接告诉你。") +
      "<div class='review-bar'><button class='btn primary' id='goStarter'>▶ 现在开始第 0 课</button>" +
      "<button class='btn ghost' id='goGlossary'>📖 先看术语表</button></div>";
    wrap.appendChild(starter);
    setTimeout(function () {
      var b1 = document.getElementById("goStarter");
      if (b1) b1.addEventListener("click", function () { navigate(${JSON.stringify(route)}); });
      var b2 = document.getElementById("goGlossary");
      if (b2) b2.addEventListener("click", function () { navigate("#/glossary"); });
    }, 0);
`;

src = src.replace(anchor, block + anchor);
try { new Function("window", "globalThis", src + ";"); }
catch (e) { console.log("✗ 语法失败，未写回：" + e.message); process.exit(1); }
writeFileSync(P, src, "utf8");
console.log("已插入零基础引导块 → " + P);
