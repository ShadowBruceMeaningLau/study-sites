import fs from "node:fs";
import vm from "node:vm";
const s = fs.readFileSync("D:/ObsidianLocalLib/system1/DSH/2/llm/data/rag.js", "utf8");
const lines = s.split("\n");

// 用「先闭合到可以解析」的方式逐段找：对每个 lesson 起始行，把它之前的内容包进 IIFE 试探
const marks = [];
lines.forEach((l, i) => { const m = /^\s{4}\/\* =+ (rag-\d) \*\//.exec(l); if (m) marks.push({ id: m[1], line: i }); });
console.log("marks", marks.map((m) => m.id + "@" + (m.line + 1)).join(" "));

// 从头开始，逐个字符累积，遇到无法解析就报告位置（用二分：找最后一个可解析前缀长度）
const full = s;
let lo = 1, hi = full.length, best = 0;
// 只检查「能解析成以 window.COURSE_PACKS.push( 开头的部分表达式」——不可靠。
// 改为：把后缀补上 "}});" 试探前缀是否只缺闭合
function tryParse(text) {
  try { new vm.Script(text); return null; } catch (e) { return e.message; }
}
for (let cut = 200; cut < 1100; cut += 100) {
  const msg = tryParse(lines.slice(0, cut).join("\n") + "\n}]});\n");
  console.log("cut", cut, "->", msg || "OK");
}
