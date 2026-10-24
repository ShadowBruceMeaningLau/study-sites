import fs from "node:fs";
const s = fs.readFileSync("D:/ObsidianLocalLib/system1/DSH/2/llm/data/rag.js", "utf8");
const lines = s.split("\n");
console.log("lines", lines.length, "chars", s.length);
// 找 splice 边界：rag-3 的 checklist 结束到 rag-4 开始
const idx4 = lines.findIndex((l) => l.includes("rag-4 */"));
console.log("rag-4 at line", idx4 + 1);
for (let i = idx4 - 14; i <= idx4 + 4; i++) console.log((i + 1) + ": " + lines[i]);
