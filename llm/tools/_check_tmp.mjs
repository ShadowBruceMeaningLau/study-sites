import { readFileSync } from "node:fs";

const BANNED = ["显然", "易得", "众所周知", "不言而喻", "前面讲过", "如前所述", "回忆上一", "已学过", "http://", "https://", "D:\\", "\u0060"];

for (const [f, id] of [["data/neural-networks.js", "nn-8"], ["data/pretraining-inference.js", "pre-9"]]) {
  const arr = [];
  new Function("window", "globalThis", readFileSync(f, "utf8"))({ COURSE_PACKS: arr }, { COURSE_PACKS: arr });
  const l = arr[0].lessons.find((x) => x.id === id);
  console.log(id, "| blocks:", l.blocks.length, l.blocks.map((b) => b.type).join(","));
  console.log("   quiz:", l.quiz.length, l.quiz.map((q) => q.type).join(","), "| est", l.est, "| checklist", l.checklist.length, "| goal", !!l.goal, "| interactive", l.blocks.some((b) => b.type === "interactive"));

  const parts = [l.title, l.goal];
  for (const b of l.blocks) {
    parts.push(b.title, b.md, b.note, b.code, b.lang);
    (b.items || []).forEach((i) => parts.push(typeof i === "string" ? i : (i.t || "") + (i.d || "")));
    (b.inputs || []).forEach((i) => parts.push(i.name, i.value));
    (b.outputs || []).forEach((x) => parts.push(x));
    (b.steps || []).forEach((s) => parts.push(typeof s === "string" ? s : ""));
    if (b.config) parts.push(JSON.stringify(b.config));
  }
  for (const q of l.quiz) {
    parts.push(q.q, q.why);
    (q.options || []).forEach((o) => parts.push(o));
    const ans = q.answer;
    (Array.isArray(ans) ? ans : [ans]).forEach((a) => a !== undefined && parts.push(String(a)));
  }
  (l.checklist || []).forEach((c) => parts.push(c));

  const all = parts.filter(Boolean).join("\n");
  for (const w of BANNED) {
    if (all.includes(w)) console.log("   !! BANNED:", JSON.stringify(w));
  }
  console.log("   title has dquote:", l.title.includes('"'), "| any backtick:", all.includes("\u0060"));
  console.log("   blocks w/ interactive:", l.blocks.filter((b) => b.type === "interactive").length,
              "| has calc:", l.blocks.some((b) => b.type === "calc"),
              "| has code:", l.blocks.some((b) => b.type === "code"));
}
