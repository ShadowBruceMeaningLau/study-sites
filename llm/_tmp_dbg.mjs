import { readFileSync } from "node:fs";
const arr = [];
new Function("window","globalThis", readFileSync("data/harness-anatomy.js","utf8") + ";")({COURSE_PACKS:arr},{COURSE_PACKS:arr});
const c = arr[0];
c.lessons.forEach(l => {
  l.blocks.forEach((b,i) => {
    const t = [b.md,b.title,b.note,(b.items||[]).map(x=>typeof x==="string"?x:(x.t||"")+(x.d||"")).join(" ")].filter(Boolean).join(" ");
    console.log(l.id, i, b.type, "len="+t.length, "| title:", b.title);
  });
});
