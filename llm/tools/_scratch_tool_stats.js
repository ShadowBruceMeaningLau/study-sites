const fs = require("fs");
for (const f of process.argv.slice(2)) {
  const code = fs.readFileSync(f, "utf8");
  const arr = [];
  new Function("window", "globalThis", code + ";")({ COURSE_PACKS: arr }, { COURSE_PACKS: arr });
  const c = arr[0];
  let q = 0, lab = 0, blocks = 0;
  for (const l of c.lessons) {
    q += l.quiz.length;
    const n = l.blocks.filter((b) => b.type === "interactive").length;
    if (n) lab++;
    blocks += l.blocks.length;
    console.log(l.id, "blocks=" + l.blocks.length, "quiz=" + l.quiz.length,
      "interactive=" + n, "est=" + l.est, "checklist=" + l.checklist.length, "goal=" + !!l.goal);
  }
  console.log("LESSONS=" + c.lessons.length, "QUIZ=" + q, "LESSONS_WITH_INTERACTIVE=" + lab, "BLOCKS=" + blocks);
  console.log("BOM=" + (code.charCodeAt(0) === 0xfeff), "backtick=" + /`/.test(code), "titleDQ=" + c.title.includes('"'));
}
