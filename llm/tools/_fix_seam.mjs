import fs from "node:fs";

/**
 * 通用修复：在「已有讲集合」与「新追加讲」的接缝处，把重复的闭合行整理成单行。
 * 前一个讲对象应闭合为 '    },'，紧接着就是新讲的注释行。
 * 现在的问题是接缝处出现两行闭合，需要只留一行。
 *
 * 用法: node tools/_fix_seam.mjs <data文件> <新讲注释里的标记>
 */
const P = process.argv[2];
const MARK = process.argv[3];
if (!P || !MARK) { console.error("用法: node _fix_seam.mjs <file> <marker>"); process.exit(1); }

let L = fs.readFileSync(P, "utf8").split("\n");

let idx = -1;
for (let i = 0; i < L.length; i++) if (L[i].includes(MARK)) { idx = i; break; }
if (idx < 0) { console.error("找不到标记: " + MARK); process.exit(1); }

// 从 idx-1 往上，把所有连续的 `}` / `},` 行整理
let seamStart = idx - 1;
while (seamStart - 1 >= 0 && /^\s*\}?,?\s*$/.test(L[seamStart - 1])) seamStart--;

const braceLines = L.slice(seamStart, idx);
console.log("接缝处原有 " + braceLines.length + " 行括号: " + JSON.stringify(braceLines));

// 期望：接缝前是上一个讲对象的闭合 `    },`；不允许连着两个以上闭合
// 若 braceLines 长度 > 1，把多余的删掉，只保留最后一行的位置写成 `    },`
if (braceLines.length > 1) {
  L.splice(seamStart, braceLines.length, "    },");
} else if (braceLines.length === 1) {
  L[seamStart] = "    },";
} else {
  L.splice(seamStart, 0, "    },");
}

fs.writeFileSync(P, L.join("\n"), "utf8");
console.log("已把接缝整理为单行 '    },'（在 " + MARK + " 之前）");

// 复检：打印接缝附近 4 行
const newIdx = L.findIndex((x) => x.includes(MARK));
for (let i = Math.max(0, newIdx - 3); i <= newIdx; i++) console.log("  L" + (i + 1) + ": " + JSON.stringify(L[i].slice(0, 70)));
