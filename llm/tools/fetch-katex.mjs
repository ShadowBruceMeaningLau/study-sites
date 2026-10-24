/* ==========================================================================
   fetch-katex.mjs —— 一次性把 KaTeX 下载到 vendor/katex/（此后完全离线可用）

   用法：
     node tools/fetch-katex.mjs            # 下载到 <站点>/vendor/katex
     node tools/fetch-katex.mjs --version 0.16.11

   说明：
     - 只下载 katex.min.js、katex.min.css 与 CSS 里引用到的 woff2 字体。
     - 下载完成后，网页不再需要联网：KaTeX 从本地读取，file:// 直接双击也能用。
     - 站点之间互相独立，数学站需要单独跑一次（或把 vendor 目录整个复制过去）。
   ========================================================================== */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, "..");
const OUT = path.join(SITE, "vendor", "katex");

const argV = process.argv.indexOf("--version");
let VER = argV > -1 ? process.argv[argV + 1] : "";

async function grab(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(url + " -> HTTP " + res.status);
  return Buffer.from(await res.arrayBuffer());
}

if (!VER) {
  const meta = JSON.parse((await grab("https://registry.npmjs.org/katex/latest")).toString("utf8"));
  VER = meta.version;
}
console.log("KaTeX 版本:", VER);

const BASE = "https://cdn.jsdelivr.net/npm/katex@" + VER + "/dist/";
fs.mkdirSync(path.join(OUT, "fonts"), { recursive: true });

const js = await grab(BASE + "katex.min.js");
fs.writeFileSync(path.join(OUT, "katex.min.js"), js);
console.log("katex.min.js", (js.length / 1024).toFixed(0) + " KB");

const cssRaw = (await grab(BASE + "katex.min.css")).toString("utf8");
fs.writeFileSync(path.join(OUT, "katex.min.css"), cssRaw);
console.log("katex.min.css", (cssRaw.length / 1024).toFixed(0) + " KB");
const fonts = Array.from(new Set(cssRaw.match(/fonts\/[A-Za-z0-9_.-]+\.woff2/g) || []));
console.log("CSS 引用 woff2 字体:", fonts.length, "个");

let total = 0;
for (const f of fonts) {
  const buf = await grab(BASE + f);
  fs.writeFileSync(path.join(OUT, f), buf);
  total += buf.length;
}
console.log("字体合计:", (total / 1024).toFixed(0) + " KB");

fs.writeFileSync(path.join(OUT, "VERSION.txt"),
  "KaTeX " + VER + "\n" +
  "来源: https://cdn.jsdelivr.net/npm/katex@" + VER + "/dist/\n" +
  "文件: katex.min.js / katex.min.css / fonts/*.woff2\n" +
  "重新下载: node tools/fetch-katex.mjs --version " + VER + "\n");
console.log("已写入:", OUT);
