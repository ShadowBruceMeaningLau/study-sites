/**
 * audit-quiz-bias.mjs —— 测验「位置偏置」质量门（LLM 站专用）
 *
 * 背景（真实缺陷）：题库里 78.4% 的单选题正确答案写在第 2 个位置，
 * 且引擎不打乱选项。学员一路点 B 就能拿约 78 分，测验失去检验作用。
 * 修复后由 QUIZ.present() 在渲染层做确定性重排。
 *
 * 本门禁校验四件事，任何一项失败都说明「重排坏了」：
 *   A. 呈现后的答案位置必须接近均匀（任一位置占比不超过 40%）
 *   B. 置换必须是真置换（0..n-1 的排列），且确定性（同题两次结果一致）
 *   C. 选项集合与「正确答案文本」在重排前后必须完全一致（不能丢选项、不能答非所问）
 *   D. why 里的选项字母引用必须同步重映射（抽查「正确项是 X」这类显式引用）
 *      且 A-1024 / F-16 这类型号不能被误改
 *
 * 用法：node tools/audit-quiz-bias.mjs   （退出码 0 = 通过）
 */
import fs from "node:fs";
import vm from "node:vm";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const sandbox = { window: { COURSE_PACKS: [] }, console, document: undefined };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);

for (const f of fs.readdirSync(ROOT + "data").filter((x) => x.endsWith(".js"))) {
  try { vm.runInContext(fs.readFileSync(ROOT + "data/" + f, "utf8"), sandbox); } catch (e) {}
}
vm.runInContext(fs.readFileSync(ROOT + "app/quiz.js", "utf8"), sandbox);
const QUIZ = sandbox.window.QUIZ;
const packs = sandbox.window.COURSE_PACKS;

let fail = 0;
function ok(cond, label, extra) {
  if (cond) console.log("  ✓ " + label);
  else { console.log("  ✗ " + label + (extra ? "  → " + extra : "")); fail++; }
}

console.log("=== 测验位置偏置审计（呈现层重排）===");

const singles = [];
const allOptQ = [];
for (const p of packs) for (const l of p.lessons) for (const q of l.quiz || []) {
  if (q.type === "single") singles.push(q);
  if (q.type === "single" || q.type === "multi") allOptQ.push(q);
}

// ---- A. 分布均匀 ----
const dist = {};
let nS = 0;
for (const q of singles) {
  const v = QUIZ.present(q);
  dist[v.answer] = (dist[v.answer] || 0) + 1;
  nS++;
}
const worst = Math.max(...Object.entries(dist).map(([k, v]) => v / nS));
console.log("  单选答案位置分布：" + [0, 1, 2, 3].map((k) => "ABCD"[k] + "=" + ((100 * (dist[k] || 0)) / nS).toFixed(1) + "%").join("  "));
ok(dist[0] && dist[1] && dist[2] && dist[3], "四个位置都出现了正确答案");
ok(worst <= 0.4, "任一位置占比不超过 40%（实测最高 " + (100 * worst).toFixed(1) + "%）", "重排失效或 PRNG 撞低位");
// 门禁只约束「覆盖率」，不锁死绝对题数——否则每加一门课都要改断言（这次从 320 涨到 336 就是因此失败）。
// 真正要防的是「单选题突然大面积消失」：要求至少 300 道，且不少于带选项题总数的一半。
ok(nS >= 300, "单选总数 = " + nS + "（下限 300）");
ok(nS >= 0.5 * allOptQ.length, "单选题不少于带选项题的一半（" + nS + " / " + allOptQ.length + "）");

// ---- B. 置换有效性 + 确定性 ----
let badPerm = 0, nondet = 0;
for (const q of allOptQ) {
  const n = q.options.length;
  const seed = String(q.id || q.q || "") + "#" + n;
  const perm = QUIZ.permutationFor(seed, n);
  const sorted = perm.slice().sort((a, b) => a - b);
  if (sorted.some((v, i) => v !== i)) badPerm++;
  const again = QUIZ.permutationFor(seed, n);
  if (again.some((v, i) => v !== perm[i])) nondet++;
}
ok(badPerm === 0, "全部 " + allOptQ.length + " 道题的置换都是真置换", badPerm + " 道不是");
ok(nondet === 0, "置换确定性：同题两次结果一致", nondet + " 道不一致");

// ---- C. 选项与答案文本不变 ----
let mismatch = 0;
for (const q of allOptQ) {
  const v = QUIZ.present(q);
  if (q.options.slice().sort().join("\u0001") !== v.options.slice().sort().join("\u0001")) mismatch++;
  const orig = q.type === "single"
    ? q.options[q.answer]
    : q.answer.map((i) => q.options[i]).sort().join("\u0001");
  const now = q.type === "single"
    ? v.options[v.answer]
    : v.answer.map((i) => v.options[i]).sort().join("\u0001");
  if (orig !== now) mismatch++;
}
ok(mismatch === 0, "选项集合与正确答案文本重排前后一致", mismatch + " 处不一致");

// ---- D. why 字母同步重映射 ----
let checked = 0, badRemap = 0;
for (const q of singles) {
  const m = (q.why || "").match(/正确项是\s*([A-H])/);
  if (!m) continue;
  const origIdx = m[1].charCodeAt(0) - 65;
  if (origIdx !== q.answer) continue;      // 只校验「指的是正确选项」那种
  checked++;
  const v = QUIZ.present(q);
  const m2 = (v.why || "").match(/正确项是\s*([A-H])/);
  if (!m2 || m2[1] !== "ABCDEFGH"[v.answer]) badRemap++;
}
ok(badRemap === 0, "解析字母同步重映射（抽查 " + checked + " 处）", badRemap + " 处指错选项");

// ---- E. 型号类 token 不能被误改 ----
const codeRe = /[A-H]-\d+/g;
let codeTotal = 0, codeDrift = 0;
for (const q of allOptQ) {
  const codes = [...(q.why || "").matchAll(codeRe)].map((m) => m[0]);
  if (!codes.length) continue;
  codeTotal += codes.length;
  const v = QUIZ.present(q);
  for (const c of codes) if (!(v.why || "").includes(c)) codeDrift++;
}
ok(codeDrift === 0, "型号/编号类 token 未被误改（" + codeTotal + " 个）", codeDrift + " 个被改");

// ---- F. 错题本回放幂等（快照会再次进入 render → 再次 present） ----
// 错题本记录的是 present 之后的题目快照；复习页会把它再交给 QUIZ.render。
// 若 present 不幂等，选项会被置换两次、正确答案与解析全部错位。
let idemFail = 0, replayDrift = 0;
for (const q of allOptQ) {
  const v1 = QUIZ.present(q);
  const v2 = QUIZ.present(v1);
  if (JSON.stringify(v1.options) !== JSON.stringify(v2.options)) idemFail++;
  if (JSON.stringify(v1.answer) !== JSON.stringify(v2.answer)) idemFail++;
  if (q.type === "single") {
    if (v1.options[v1.answer] !== q.options[q.answer]) replayDrift++;
  } else {
    const a = v1.answer.map((i) => v1.options[i]).sort().join("\u0001");
    const b = q.answer.map((i) => q.options[i]).sort().join("\u0001");
    if (a !== b) replayDrift++;
  }
}
ok(idemFail === 0, "错题本回放幂等：二次 present 不改变选项与答案", idemFail + " 处变化");
ok(replayDrift === 0, "回放时正确答案文本与原题一致", replayDrift + " 处漂移");

// ---- G. fill / order 不受重排影响 ----
let otherChanged = 0;
for (const p of packs) for (const l of p.lessons) for (const q of l.quiz || []) {
  if (q.type === "single" || q.type === "multi") continue;
  if (QUIZ.present(q) !== q) otherChanged++;
}
ok(otherChanged === 0, "fill / order 题型不受重排影响", otherChanged + " 道被改动");

console.log(fail === 0 ? "\n✓ 测验位置偏置审计通过。" : "\n✗ 测验位置偏置审计失败 " + fail + " 项。");
process.exit(fail === 0 ? 0 : 1);
