import fs from "node:fs";
const s = fs.readFileSync("D:/ObsidianLocalLib/system1/DSH/2/llm/data/rag.js", "utf8");
const lines = s.split("\n");
const n = lines.length;
console.log("total lines", n);
for (let i = n - 16; i < n; i++) console.log((i + 1) + ": " + JSON.stringify(lines[i]));

// 括号收支扫描
let depth = 0;
const problems = [];
for (let li = 0; li < n; li++) {
  for (const ch of lines[li]) {
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth < 0) { problems.push([li + 1, "negative"]); depth = 0; } }
  }
}
console.log("final depth", depth, "problems", JSON.stringify(problems.slice(0, 5)));

// 逐行累计深度，找出文件末尾深度不为 1 的位置
depth = 0;
const marks = [];
for (let li = 0; li < n; li++) {
  for (const ch of lines[li]) { if (ch === "{") depth++; else if (ch === "}") depth--; }
  if (li >= n - 12) marks.push((li + 1) + " -> depth " + depth);
}
console.log(marks.join("\n"));
