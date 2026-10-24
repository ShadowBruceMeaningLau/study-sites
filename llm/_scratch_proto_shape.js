const fs=require('fs');
const src=fs.readFileSync('data/agent-protocols-2026.js','utf8');
let C=null;
new Function('window',src)({COURSE_PACKS:{push:(c)=>{C=c;}}});
for(const L of C.lessons){
  console.log('====',L.id,'|',L.title,'| est',L.est);
  for(const b of L.blocks){
    console.log('  -',b.type, (b.lab||''), '|', b.title||'' , b.lang?('lang='+b.lang+' codeLen='+String(b.code||'').length):'');
  }
}
