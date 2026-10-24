// 给零基础入门课补"中断"的解释（该处建议按 Ctrl+C，但没说中断是什么）
import { readFileSync, writeFileSync } from "node:fs";

const P = "D:/ObsidianLocalLib/system1/DSH/2/cs/data/cs-zero-basics.js";
let src = readFileSync(P, "utf8");
const before = src;

const from = "Ctrl + C 中断正在运行的程序";
const to = "Ctrl + C 给程序发一个「中断」信号（中断就是叫它立刻停下来）——程序卡住、疯狂刷屏时按它";
const n = src.split(from).length - 1;
console.log("命中次数:", n);
if (n >= 1) src = src.replace(from, to);

// 给"基/栈"等误报之外的真术语也补一句：终端相关术语先解释
const from2 = "它只是一个「用打字代替点击」的工具";
const to2 = "它只是一个「用打字代替点击」的工具（这种程序叫终端或命令行解释器：你输入一行命令，它执行完把结果显示给你）";
const n2 = src.split(from2).length - 1;
if (n2 >= 1) { src = src.replace(from2, to2); console.log("补充终端解释:", n2); }

try { new Function("window", "globalThis", src + ";"); }
catch (e) { console.log("✗ 语法失败，未写回：" + e.message); process.exit(1); }
writeFileSync(P, src, "utf8");
console.log("已写回（" + before.length + " → " + src.length + " 字节）");
