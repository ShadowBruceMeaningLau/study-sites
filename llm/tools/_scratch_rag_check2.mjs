import fs from "node:fs";
const code = fs.readFileSync("D:/ObsidianLocalLib/system1/DSH/2/llm/data/rag.js", "utf8");
const packs = [];
new Function("window", "globalThis", code + ";")({ COURSE_PACKS: packs }, { COURSE_PACKS: packs });
const c = packs[0];
const terms = ["上下文", "窗口", "成本", "重叠", "overlap", "召回", "欧氏", "欧几里得", "词袋", "稀疏", "稠密", "重排", "全塞", "装不下", "token", "词元", "余弦", "嵌入", "向量", "切分", "RAG", "检索增强"];
for (const l of c.lessons.slice(0, 3)) {
  const txt = l.blocks.map((b) => [b.md, b.title, b.note, b.code, JSON.stringify(b.config || {}), (b.items || []).map((i) => (typeof i === "string" ? i : (i.t || "") + (i.d || ""))).join(" "), (b.steps || []).map((s) => (typeof s === "string" ? s : (s.t || "") + (s.d || ""))).join(" ")].filter(Boolean).join(" ")).join(" ") + l.quiz.map((q) => q.q + q.why).join(" ");
  const hits = terms.filter((t) => txt.includes(t));
  console.log("=== " + l.id + " 命中术语: " + hits.join(","));
  console.log("    缺: " + terms.filter((t) => !txt.includes(t)).join(","));
}
console.log("\n全文字数", code.length, "bytes", Buffer.byteLength(code));
console.log("http in body after line 24:", (code.slice(code.indexOf("lessons: [")).match(/https?:\/\//g) || []).length);
