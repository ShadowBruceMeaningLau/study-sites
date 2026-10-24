import fs from "node:fs";
const s = fs.readFileSync("D:/ObsidianLocalLib/system1/DSH/2/llm/data/rag.js", "utf8");
const lines = s.split("\n");
// 统计每个 lesson 起始行，逐段用 node 语法解析定位
const starts = [];
lines.forEach((l, i) => { const m = /^\s{4}\/\* =+ (rag-\d) \*\//.exec(l); if (m) starts.push({ id: m[1], line: i }); });
console.log("lesson markers:", starts.map((x) => x.id + "@" + (x.line + 1)).join(", "));

// 用 vm 编译整段前 N 行，二分找最早出错行
const vm = await import("node:vm");
function ok(upTo) {
  const code = lines.slice(0, upTo).join("\n");
  try { new vm.Script(code); return null; } catch (e) { return e.message; }
}
for (let cut = 60; cut <= lines.length; cut += 60) {
  const msg = ok(cut);
  if (msg) { console.log("first failing at <= line", cut, ":", msg); break; }
}
