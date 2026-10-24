import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
const arr=[]; new Function("window","globalThis",readFileSync("data/harness-anatomy.js","utf8")+";")({COURSE_PACKS:arr},{COURSE_PACKS:arr});
const c=arr[0];
for(const l of c.lessons){
  for(const b of l.blocks){
    if(b.type==="code"){
      const t=mkdtempSync(join(tmpdir(),"hx-"));
      const f=join(t,"a.py"); writeFileSync(f,b.code,"utf8");
      const r=spawnSync("python",["-X","utf8",f],{encoding:"utf8",env:{...process.env,PYTHONIOENCODING:"utf-8",PYTHONUTF8:"1"}});
      console.log("=== "+l.id+" :: "+b.title+" status="+r.status);
      console.log(r.stdout.trim());
      if(r.stderr.trim()) console.log("STDERR:",r.stderr.trim());
      rmSync(t,{recursive:true,force:true});
    }
  }
  // check titles for double quotes
  if(l.title.includes('"')) console.log("BAD TITLE", l.id);
  for(const b of l.blocks) if((b.title||"").includes('"')) console.log("BAD BLOCK TITLE", l.id, b.title);
}
