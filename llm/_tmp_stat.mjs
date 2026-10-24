import { readFileSync } from "node:fs";
const arr=[]; new Function("window","globalThis",readFileSync("data/harness-anatomy.js","utf8")+";")({COURSE_PACKS:arr},{COURSE_PACKS:arr});
const c=arr[0];
for(const l of c.lessons){
  const s=JSON.stringify(l,null,2);
  console.log(l.id, "blocks="+l.blocks.length, "quiz="+l.quiz.length, "est="+l.est, "checklist="+l.checklist.length, "bytes="+Buffer.byteLength(JSON.stringify(l),"utf8"));
}
console.log("total-lessons", c.lessons.length, "total-quiz", c.lessons.reduce((n,l)=>n+l.quiz.length,0), "interactive-lessons", c.lessons.filter(l=>l.blocks.some(b=>b.type==="interactive")).length);
