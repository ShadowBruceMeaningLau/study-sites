const fs=require('fs');
const buf=fs.readFileSync('data/agent-protocols-2026.js');
console.log('BOM:', buf[0]===0xEF&&buf[1]===0xBB&&buf[2]===0xBF ? 'HAS BOM (BAD)' : 'no BOM (ok)');
const src=buf.toString('utf8');
const bad=[]
for(const [name,re] of [['backtick',/`/],['require',/\brequire\s*\(/],['import',/\bimport\b/],['export',/\bexport\b/],['fetch',/\bfetch\s*\(/],['function',/\bfunction\b/],['arrow',/=>/]]) if(re.test(src)) bad.push(name);
console.log('forbidden:', bad.length?bad.join(','):'none');
console.log('push count:', (src.match(/window\.COURSE_PACKS\.push\(/g)||[]).length);
let C=null; new Function('window',src)({COURSE_PACKS:{push:c=>{C=c;}}});
const ids=new Set(); let nq=0, ni=0;
for(const L of C.lessons){
  for(const q of L.quiz){ if(ids.has(q.id)) console.log('DUP quiz id',q.id); ids.add(q.id); nq++; }
  for(const b of L.blocks){
    if(b.type!=='interactive') continue; ni++;
    if(b.lab==='protolab'){
      const names=new Set(b.config.parties.map(p=>p.name));
      const badLink=b.config.links.filter(l=>!names.has(l.from)||!names.has(l.to));
      if(badLink.length) console.log('BAD LINK in',L.id,badLink);
      if(b.config.links.length!==b.config.steps.length) console.log('WARN steps/links count mismatch',L.id,b.config.links.length,b.config.steps.length);
    }
    if(b.lab==='agenttrace'){
      const kinds=b.config.steps.map(s=>s.kind);
      if(!kinds.includes('thought')) console.log('MISSING thought',L.id);
      if(!kinds.includes('action')) console.log('MISSING action',L.id);
    }
    if(b.lab==='datalab'){
      if(b.config.steps.length<4) console.log('datalab steps<4',L.id);
    }
  }
  for(const t of [L.title]) if(t.includes('"')) console.log('DQ in title',L.id);
}
if(C.title.includes('"')) console.log('DQ in course title');
console.log('quiz total',nq,'| interactive total',ni);
console.log('hp', JSON.stringify(C.need));
