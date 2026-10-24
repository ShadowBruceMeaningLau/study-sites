/* ==========================================================================
   remove-time.mjs —— 去掉全部"时间线"内容
   本课程只对质量有要求：不告诉读者"要花几周""预计几分钟"，因此移除

     · 课程文件：每个 lesson 的 est 字段（预计学习分钟数）
     · 轨迹文件：每条轨迹的 weeks 与每本书的 weeks（建议周数）

   保留：难度分级 level（那是深度标记，不是时间承诺）；
        SRS 的复习间隔（那是算法运作，不是学习时间表）。

   用法：node tools/remove-time.mjs [--dry]
   ========================================================================== */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");
const dry = process.argv.includes("--dry");

/** 从对象字面量源码里删除一个 `key: 数字,` 字段（只删最简形式，删不掉就报出来） */
function dropNumberField(src, key) {
  let n = 0;
  // 形式一：`est: 55,` 或 `est:55,`（后面还有别的键）
  src = src.replace(new RegExp("\\b" + key + "\\s*:\\s*\\d+\\s*,\\s*", "g"), () => { n++; return ""; });
  // 形式二：`est: 55` 后直接跟 `}`（该键是最后一个）
  src = src.replace(new RegExp(",\\s*\\b" + key + "\\s*:\\s*\\d+\\s*(?=\\})", "g"), () => { n++; return ""; });
  return { src, n };
}

let totalEst = 0, totalWeeks = 0, filesChanged = 0;
const problems = [];

for (const f of readdirSync(DATA).filter((x) => x.endsWith(".js") && !x.startsWith("_")).sort()) {
  const p = join(DATA, f);
  let src = readFileSync(p, "utf8").replace(/^\uFEFF/, "");
  const before = src;

  const isReading = f.startsWith("reading-");
  const key = isReading ? "weeks" : "est";
  const r = dropNumberField(src, key);
  src = r.src;
  if (isReading) totalWeeks += r.n; else totalEst += r.n;

  // 残留检查：还剩下几处？
  const left = (src.match(new RegExp("\\b" + key + "\\s*:", "g")) || []).length;
  if (left) problems.push(f + " 仍残留 " + left + " 处 " + key + "（可能是非数字形式，需要手工处理）");

  if (src !== before) {
    filesChanged++;
    if (!dry) writeFileSync(p, src, "utf8");
    console.log("✓ " + f + "：移除 " + r.n + " 处 " + key + (left ? "（残留 " + left + "）" : ""));
  }
}

console.log("");
console.log("共修改 " + filesChanged + " 个文件：" + (dry ? "（dry-run 未写入）" : "") +
  "移除 est " + totalEst + " 处、weeks " + totalWeeks + " 处");
if (problems.length) {
  console.log("");
  console.log("⚠ 需要手工处理：");
  problems.forEach((x) => console.log("   " + x));
  process.exitCode = 1;
}
