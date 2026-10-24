import fs from "node:fs";

const TARGET = "D:/ObsidianLocalLib/system1/DSH/2/llm/data/rag.js";
const NEW123 = "D:/ObsidianLocalLib/system1/DSH/2/llm/tools/_scratch_rag_l123.js";

const src = fs.readFileSync(TARGET, "utf8");
const lessons = fs.readFileSync(NEW123, "utf8").replace(/\s+$/, "");

const startMark = "    /* ================================================== rag-1 */";
const endMark = "    /* ================================================== rag-4 */";
const i = src.indexOf(startMark);
const j = src.indexOf(endMark);
if (i < 0 || j < 0 || j < i) throw new Error("markers not found");
console.log("splice", i, j, "old segment chars", j - i, "new", lessons.length);

const head = src.slice(0, i);
const tail = src.slice(j);
const out = head + lessons + ",\n\n" + tail;

// 结构自检：只保留一条 push，无函数/反引号
const pushCount = (out.match(/COURSE_PACKS\.push/g) || []).length;
const backticks = (out.match(/`/g) || []).length;
console.log("push", pushCount, "backticks", backticks, "bom", out.charCodeAt(0) === 0xfeff);

fs.writeFileSync(TARGET, out, "utf8");
console.log("written bytes", Buffer.byteLength(out, "utf8"));

// 求值验证
const packs = [];
new Function("window", "globalThis", out + ";")({ COURSE_PACKS: packs }, { COURSE_PACKS: packs });
const c = packs[0];
console.log("lessons", c.lessons.length, c.lessons.map((l) => l.id).join(","));
for (const l of c.lessons.slice(0, 3)) {
  const intr = l.blocks.filter((b) => b.type === "interactive");
  console.log(l.id, "blocks", l.blocks.length, "quiz", l.quiz.length, "est", l.est, "labs", intr.map((b) => b.lab + ":" + (b.config.steps || []).length).join("/"));
}
