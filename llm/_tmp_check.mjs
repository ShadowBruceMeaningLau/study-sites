import { readFileSync } from "node:fs";
const src = readFileSync("data/harness-anatomy.js","utf8");
const arr=[]; new Function("window","globalThis",src+";")({COURSE_PACKS:arr},{COURSE_PACKS:arr});
const c=arr[0];
const bad=[];
if(c.title.includes('"')) bad.push("course.title");
for(const l of c.lessons){
  if(l.title.includes('"')) bad.push("lesson "+l.id);
  for(const b of l.blocks){ if((b.title||"").includes('"')) bad.push("block "+l.id+" "+b.title); }
  for(const q of l.quiz){ if((q.q||"").includes('"')) bad.push("quiz "+q.id); }
}
console.log("double-quote issues:", bad.length ? bad : "none");
// scan for local paths / bare links in body
const txt = JSON.stringify(c);
for (const pat of [/[A-Za-z]:\\\\/g, /https?:\/\//g, /app\.asar/gi, /computersoftware/gi, /见《/g, /如前所述/g, /前面讲过/g]) {
  const m = txt.match(pat);
  console.log(pat, "->", m ? m.slice(0,3) : "none");
}
console.log("has 'require(' :", /require\s*\(/.test(src));
console.log("has import :", /(^|\n)\s*(import|export)\s+[{*\w]/.test(src));
console.log("has backtick :", src.includes("`"));
console.log("has fetch :", /\bfetch\s*\(/.test(src));
