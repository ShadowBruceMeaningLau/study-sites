import fs from "node:fs";
import vm from "node:vm";
const frag = fs.readFileSync("D:/ObsidianLocalLib/system1/DSH/2/llm/tools/_scratch_rag_l123.js", "utf8");
const code = "var A = [" + frag + "];";
try { new vm.Script(code); console.log("fragment OK"); } catch (e) { console.log("fragment BAD:", e.message); }

// 逐讲拆分检查
const parts = frag.split(/\/\* =+ (rag-\d) \*\//);
console.log("parts", parts.length);
for (let i = 1; i < parts.length; i += 2) {
  const id = parts[i];
  const body = parts[i + 1] || "";
  const t = "var A = [{ id: '" + id + "'," + body.slice(body.indexOf("\n") + 1) + "];";
  try { new vm.Script("var A = [{" + body.replace(/,\s*$/, "") + ")];"); } catch (e) { /* ignore */ }
  try {
    new vm.Script("var A = [{" + body.trim().replace(/,\s*$/, "") + "}];");
    console.log(id, "OK");
  } catch (e) {
    console.log(id, "BAD:", e.message);
  }
}
