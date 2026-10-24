import fs from "node:fs";
const s = fs.readFileSync("D:/ObsidianLocalLib/system1/DSH/2/llm/data/rag.js", "utf8");
const lines = s.split("\n");
for (let i = 0; i < 30; i++) console.log((i + 1) + ": " + JSON.stringify(lines[i].slice(0, 120)));
console.log("...");
for (let i = 155; i < 175; i++) console.log((i + 1) + ": " + JSON.stringify(lines[i].slice(0, 120)));
