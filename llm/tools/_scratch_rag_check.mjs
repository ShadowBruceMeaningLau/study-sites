import fs from "node:fs";
const code = fs.readFileSync("D:/ObsidianLocalLib/system1/DSH/2/llm/data/rag.js", "utf8");
const packs = [];
new Function("window", "globalThis", code + ";")({ COURSE_PACKS: packs }, { COURSE_PACKS: packs });
const c = packs[0];
console.log("file bytes", Buffer.byteLength(code, "utf8"), "BOM", code.charCodeAt(0) === 0xfeff);
console.log("course", c.id, "lessons", c.lessons.length, "term", c.term);
for (const l of c.lessons.slice(0, 3)) {
  const labs = l.blocks.filter((b) => b.type === "interactive").map((b) => b.lab);
  const labSteps = l.blocks.filter((b) => b.type === "interactive").map((b) => (b.config.steps || []).length);
  console.log(`--- ${l.id} est=${l.est} blocks=${l.blocks.length} quiz=${l.quiz.length} checklist=${l.checklist.length} goal=${!!l.goal}`);
  console.log("    types:", l.blocks.map((b) => b.type).join(","));
  console.log("    labs:", labs.join(","), "steps:", labSteps.join(","));
  console.log("    title has quote:", l.title.includes('"'));
  for (const b of l.blocks) {
    if (b.type !== "interactive") continue;
    const cfg = b.config;
    if (b.lab === "ragsteps") {
      const dims = new Set([cfg.qemb ? cfg.qemb.length : -1, ...Object.values(cfg.emb || {}).map((v) => v.length)]);
      console.log("    ragsteps chunkSize", cfg.chunkSize, "docs", cfg.docs.length, "dims", [...dims].join("/"), "stages", cfg.steps.map((s) => s.stage).join(">"));
    }
    if (b.lab === "datalab") console.log("    datalab steps", (cfg.steps || []).length);
  }
}
console.log("title quote:", c.title.includes('"'));
console.log("backtick count:", (code.match(/`/g) || []).length);
console.log("forbidden:", /\brequire\s*\(|\bimport\s|\bfetch\s*\(/.test(code));
console.log("push count:", (code.match(/COURSE_PACKS\.push/g) || []).length);
