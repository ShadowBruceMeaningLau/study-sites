import fs from "node:fs";
import vm from "node:vm";

const sandbox = { window: { COURSE_PACKS: [] }, console };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
for (const f of fs.readdirSync("data").filter((x) => x.endsWith(".js"))) {
  try { vm.runInContext(fs.readFileSync("data/" + f, "utf8"), sandbox); } catch (e) {}
}
const packs = sandbox.window.COURSE_PACKS;
const src = fs.readFileSync("app/app.js", "utf8");
const orderBlock = src.match(/var ORDER = \[([\s\S]*?)\];/)[1];
const order = [...orderBlock.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const byId = {};
packs.forEach((p) => { byId[p.id] = p; });
order.forEach((id, i) => {
  const p = byId[id];
  console.log(String(i + 1).padStart(2), id.padEnd(26), p ? JSON.stringify(p.term) : "MISSING");
});
console.log("\nunique terms in first-appearance order (as smoke reports):");
const seen = [];
for (const id of order) {
  const p = byId[id];
  if (p && !seen.includes(p.term)) seen.push(p.term);
}
seen.forEach((t, i) => console.log(i + 1, t));
