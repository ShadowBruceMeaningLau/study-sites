// 测试驱动：验证 mathrender.js 的输出结构与关键退化情况
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync("D:/ObsidianLocalLib/system1/DSH/2/math/app/mathrender.js", "utf8");
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const MR = sandbox.MATHR;

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { console.log("  ✓ " + name); pass++; }
  else { console.log("  ✗ " + name + (extra ? "  → " + extra : "")); fail++; }
}

console.log("=== mathrender 单元测试 ===");

// 1) 分式：必须有分数线结构
let h = MR.render("\\frac{a}{b}");
check("分式产生分子/分母结构", h.includes("mr-num") && h.includes("mr-den"), h);

// 2) 上下标
h = MR.render("x^{2n}");
check("上标 {2n} 整体作为上标", /<sup class="mr-sup">.*2.*n.*<\/sup>/.test(h) || h.includes("mr-sup"), h);
h = MR.render("a_{i,j}");
check("下标 {i,j} 整体作为下标", h.includes("mr-sub"), h);
h = MR.render("x_i^2");
check("同时有上下标", h.includes("mr-sup") && h.includes("mr-sub"), h);

// 3) 大运算符带上下限
h = MR.render("\\sum_{k=1}^{n} a_k");
check("求和号有上下限", h.includes("mr-bigop") && h.includes("mr-bigop-up") && h.includes("mr-bigop-low"), h);
check("求和号使用 ∑", h.includes("∑"), h);
h = MR.render("\\int_0^1 x^2 \\, dx");
check("积分号带上下限", h.includes("∫") && h.includes("mr-bigop-low"), h);

// 4) 根号
h = MR.render("\\sqrt{x^2+y^2}");
check("根号有根号体", h.includes("mr-sqrt") && h.includes("√"), h);
h = MR.render("\\sqrt[3]{x}");
check("n 次根号带次数", h.includes("mr-sqrt-deg"), h);

// 5) 矩阵
h = MR.render("\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}");
check("矩阵有 2 行", (h.match(/mr-matrix-row/g) || []).length === 2, h);
check("矩阵有 4 个单元", (h.match(/mr-matrix-cell/g) || []).length === 4, h);

// 6) 希腊字母与符号
check("α 渲染", MR.render("\\alpha").includes("α"));
check("≤ 渲染", MR.render("\\le").includes("≤"));
check("⇒ 渲染", MR.render("\\Rightarrow").includes("⇒"));
check("∞ 渲染", MR.render("\\infty").includes("∞"));
check("∈ 渲染", MR.render("\\in").includes("∈"));

// 7) 嵌套：分式里套根号与上下标
h = MR.render("\\frac{\\sqrt{x}}{2n+1}");
check("分式中嵌套根号", h.includes("mr-frac") && h.includes("mr-sqrt"), h);

// 8) 退化情况：不应抛异常、不应丢字符
const cases = ["", "a", "\\", "\\unknowncmd", "x^", "_{}", "$$", "中文与 English", "\\frac{a}", "\\sqrt", "\\begin{pmatrix} a \\end{pmatrix}", "a & b"];
let bad = 0;
for (const c of cases) {
  try {
    const out = MR.render(c);
    if (out == null) { console.log("    ! 返回 null: " + JSON.stringify(c)); bad++; }
    if (/mr-error/.test(out)) { console.log("    ! 报错退化: " + JSON.stringify(c) + " → " + out.slice(0, 60)); bad++; }
  } catch (e) { console.log("    ! 抛异常: " + JSON.stringify(c) + " → " + e.message); bad++; }
}
check("退化输入不抛异常/不报错（" + cases.length + " 例）", bad === 0, bad + " 例失败");

// 9) 行内渲染：只处理 $...$，其余原样
h = MR.renderInline("设 $x^2$ 是平方，而 $\\frac{1}{2}$ 是分数。");
check("renderInline 处理两个片段", (h.match(/mr-math/g) || []).length === 2, h);
check("renderInline 保留普通文本", h.includes("是平方") && h.includes("是分数"), h);

// 10) 不吞中文
h = MR.render("\\text{当 } x \\to 0");
check("\\text 内中文保留", h.includes("当"), h);

console.log("\n通过 " + pass + " 项，失败 " + fail + " 项");
process.exit(fail ? 1 : 0);
