// 修正幂迭代实验初始瑞利商：3.5 → 4（注意键值之间有空格）
import { readFileSync, writeFileSync } from "node:fs";

const P = "D:/ObsidianLocalLib/system1/DSH/2/math/data/linear-algebra-1.js";
let src = readFileSync(P, "utf8");
const before = src;

src = src.replace(/"瑞利商":\s*3\.5,/g, '"瑞利商": 4,');
const n = (before.match(/"瑞利商":\s*3\.5,/g) || []).length;
console.log("替换处数:", n);

try { new Function("window", "globalThis", src + ";"); }
catch (e) { console.log("✗ 语法失败，未写回：" + e.message); process.exit(1); }
if (src !== before) { writeFileSync(P, src, "utf8"); console.log("已写回"); }
