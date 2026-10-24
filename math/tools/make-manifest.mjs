/**
 * 生成高保真验证入口：把 index.html 里"尚不存在的 data/*.js"引用剔除，
 * 输出 tools/manifest.html。正式 index.html 不受影响。
 * 用法：node tools/make-manifest.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const missing = [];
const out = html.replace(/(\s*)<script src="(data\/[\w-]+\.js)"><\/script>/g, (m, sp, rel) => {
  if (existsSync(join(ROOT, rel))) return m;
  missing.push(rel);
  return "";
});
writeFileSync(join(ROOT, "tools", "manifest.html"), out, "utf8");
console.log("已生成 tools/manifest.html（保留 " + (out.match(/data\/[\w-]+\.js/g) || []).length + " 个课程文件）");
console.log(missing.length ? "缺失（未写入）：" + missing.join(", ") : "全部课程文件齐备。");
