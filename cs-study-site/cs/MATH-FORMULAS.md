# 数学公式写法规范（MATH-FORMULAS）

本站公式用 **KaTeX** 渲染（`vendor/katex/`，纯本地、离线可用）。
正文里把公式写成 `$...$`，就会渲染成真正的数学排版。

```js
md: "当 $n \\to \\infty$ 时 $\\frac{1}{n} \\to 0$。"     // 行内公式
md: "$$ \\int_0^1 x^2\\,dx = \\frac{1}{3} $$"            // 独立成行的大公式（整行只放它）
```

---

## 一、五条硬规则（违反就会渲染失败或正文出错）

### 1. JS 字符串里反斜杠必须写两个
课程文件是 JavaScript。源码里的 `\\` 才是公式里的 `\`。

| 想显示 | 源码里写 |
| --- | --- |
| $\frac{a}{b}$ | `"$\\frac{a}{b}$"` |
| $\sqrt{2}$ | `"$\\sqrt{2}$"` |
| $\alpha \le \beta$ | `"$\\alpha \\le \\beta$"` |
| 矩阵换行 `\\` | `"$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$"`（四个反斜杠） |

### 2. 公式里出现中文，必须用 `\text{...}` 包起来
`"$\\text{面积} = \\pi r^2$"` ✔ ／ `"$面积 = \\pi r^2$"` ✘
（扫描器会把「公式里直接出现中文」判定为**不是公式**，于是原样显示成 `$面积...$`。）

### 3. 正文里的美元符号写成 `\$`
`"退出码用 echo \\$? 查看"`。裸写 `$` 可能被当成公式开头。
（`$1`、`Outer$1.class` 这类**紧跟数字**的写法是安全的，扫描器会放过。）

### 4. `$` 与公式内容之间不能有空格，也不能跨行
`"$ x $"` ✘（首尾空格 → 判定不是公式）；`"$x^2$"` ✔。

### 5. 只改正文，不碰代码
`code` 字段（代码块）**一律不动**：那里的 `$`、`^`、`_` 是程序语法，不是公式。
`state`（实验面板的数据）、`id`、`answer` 的**下标**也不要动。

---

## 二、该改什么、不该改什么

### ✅ 应当公式化
| 原文 | 改成 |
| --- | --- |
| `√2` | `$\\sqrt{2}$` |
| `x²- 2 = 0`、`d² = 2` | `$x^2 - 2 = 0$`、`$d^2 = 2$` |
| `1/n`、`p/q` | `$\\frac{1}{n}$`、`$\\frac{p}{q}$`（**正文里的分式**用 `\frac`，比斜杠清楚） |
| `A = {x ∈ Q : x² < 2}` | `$A = \\{x \\in \\mathbb{Q} : x^2 < 2\\}$` |
| `sup A = 1`、`inf A` | `$\\sup A = 1$`、`$\\inf A$` |
| `ε > 0`、`任给 ε > 0` | `任给 $\\varepsilon > 0$` |
| `∑_{n=1}^∞ 1/n²` | `$\\sum_{n=1}^{\\infty} \\frac{1}{n^2}$` |
| `∫₀¹ x² dx` | `$\\int_0^1 x^2\\,dx$` |
| `lim_{x→0} sin x / x = 1` | `$\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$` |
| `10^6`、`2^n` | `$10^6$`、`$2^n$` |
| `O(n log n)` | `$O(n \\log n)$` |
| `a_{i,j}`、`a₁` | `$a_{i,j}$`、`$a_1$` |
| `α + β = γ` | `$\\alpha + \\beta = \\gamma$` |
| `A ≤ B`、`x ≠ 0`、`a ≈ b` | `$A \\le B$`、`$x \\ne 0$`、`$a \\approx b$` |
| `A ∪ B`、`x ∈ A`、`A ⊂ B` | `$A \\cup B$`、`$x \\in A$`、`$A \\subset B$` |
| `|x| < 1`、`‖x‖` | `$|x| < 1$`、`$\\|x\\|$` |
| `矩阵 (a b; c d)` | `$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$` |

### ❌ 不要公式化
- **代码与其注释**：`for (i = 0; i < n; i++)`、`O(1)` 出现在代码块里时保持原样。
- **中文里的数字与量词**：「第 2 讲」「三步」「大约 1000 次」「误差 1e-6」。
- **术语名里的字母**：「L1 缓存」「TCP/IP」「USB 3.0」「A 题」。斜杠 `输入/输出`、`读/写` 不是分式。
- **已经是中文解释的部分**：「两边同时平方」不要改成公式。
- **纯英文标识符**（变量名、函数名、课程 id）不要包进 `$`。
- **一句里塞太多**：如果一句话会变成 6 个以上 `$...$` 碎片，优先只把最关键的（等式、分式、极限）公式化，其余保留纯文本——可读性优先。

### 判断口径
公式化是为了**让数学关系一眼看清**，不是为了把每个符号都染色。
遇到拿不准的：**保留原文**。

---

## 三、大公式（`$$...$$`）的使用规范
- 只用在「本讲核心定义/定理的等式」上，**每讲最多 1~2 个**。
- 必须**独占一行**，前后空行隔开，整行除 `$$...$$` 外没有别的字符。
- 短等式（如 `$a^2+b^2=c^2$`）不要用大公式，行内更自然。

---

## 四、改完必须跑的校验（缺一不可）

```bat
node tools/audit-math.mjs              :: 每一段公式用 KaTeX 真渲染一遍，有错立刻列出
node tools/validate-curriculum.mjs     :: 结构、id、实验配置、题目格式
node tools/content-fingerprint.mjs --check   :: 与改写前的快照对比，确认没丢内容
```

`audit-math.mjs` 现在有三节检查，**你的文件在三节里都要干净**：

| 输出 | 含义 | 典型原因与修法 |
| --- | --- | --- |
| `✗ 语法错误` | KaTeX 渲染失败 | 九成是**源码里只写了一个反斜杠**：`"\frac"` 的 `\f` 是换页符，公式变成 `rac{...}`。改成 `"\\frac"` |
| `! 疑似丢了反斜杠的 TeX 命令` | KaTeX 不报错，但会渲染成歪的斜体字母 | `[-pi, pi]`、`{0 < x < pi}`、`O(n log n)` → 改成 `[-\pi, \pi]`、`O(n \log n)` |
| `! 公式写进了「不会渲染」的字段` | `code` 代码块与 `interactive.config.state` 不解析 `$...$` | 把公式挪到 `md` / `items` / `desc` / `calc` 这些会渲染的字段里 |
| `! 落单的 $` | 仅提示，多数正常 | `echo $?`、SQL `$1`、汇编 `$60` 属正常 |

- `validate-curriculum.mjs` 必须以「✓ 内容校验通过。」结尾。
- `content-fingerprint.mjs --check` 出现 `✗`（课程数/讲数/块数/题数变了）→ **说明改坏了，立即还原重做**。
- 三个都通过，才算改完一个文件。

> 小抄：源码里 TeX 命令**永远写双反斜杠** —— `"$\\pi$"`、`"$\\frac{a}{b}$"`、矩阵换行四个 —— `"$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$"`。
> 走 `apply-math-pairs.mjs` 时用 `"toTex"` 字段写**单**反斜杠，工具会自动转义；跨行匹配用 `"fromLines"`（行数组），`"to"` 里写 `@@NL@@` 表示源码中的 `\n`。

---

## 五、本机支持的符号速查
希腊字母 `\alpha \beta \gamma \delta \varepsilon \zeta \eta \theta \lambda \mu \nu \xi \pi \rho \sigma \tau \varphi \chi \psi \omega` 与大写 `\Gamma \Delta \Theta \Lambda \Xi \Pi \Sigma \Phi \Psi \Omega`；
关系 `\le \ge \ne \approx \equiv \sim \propto \pm \times \div \cdot`；
集合 `\in \notin \subset \subseteq \supset \supseteq \cup \cap \varnothing \forall \exists`；
箭头 `\to \leftarrow \leftrightarrow \Rightarrow \Leftarrow \Leftrightarrow`；
大运算符 `\sum \prod \int \oint \lim \sup \inf \max \min \bigcup \bigcap`；
其他 `\infty \partial \nabla \sqrt[n]{} \frac{}{} \binom{}{} \mathbb{R} \mathbb{N} \mathbb{Q} \mathbb{Z} \mathbb{C} \text{中文} \left( \right) \,`。

字体：`\mathbb`（黑板体 R/N/Q/Z/C）、`\mathcal`（花体）、`\mathrm`（正体）、`\text`（中文或整词）。

---

## 六、哪些字段会渲染公式（改之前先看这张表）

| 字段 | 会渲染 `$...$` 吗 | 说明 |
| --- | --- | --- |
| `block.md`、`lesson.goal`、`lesson.need` | ✅ | 走 Markdown 渲染 |
| `concept` 的 `items[].t` / `items[].d` | ✅ | 同上 |
| `steps` 的 `items[].t` / `items[].d`、`steps[]` 字符串 | ✅ | 同上 |
| `pitfall` / `analogy` 的正文、列表项 | ✅ | 同上 |
| `code` 块的 `title`、`md` | ✅ | 但 `code` 字段本身**不是** |
| `calc` 的 `title` / `inputs[].name` / `inputs[].value` / `outputs[]` / `note` | ✅ | 已接入 `MD.mathText` |
| `interactive` 的 `title`、`config.steps[].desc` / `.note` / `.state` 的**标题字段**、`config.legend` | ✅ | 已接入 `MD.mathText` |
| **`interactive.config.state` 的值** | ❌ | 实验面板按纯文本显示数值，写 `$` 只会原样露出 |
| `quiz` 的 `q` / `options` / `why` / `answer` 文本 | ✅ | 按文本渲染，公式可写 |
| **`code` 块的 `code` 字段** | ❌ | 代码，绝不改 |
| **`interactive.config.state` 的键与值** | ❌ | 实验面板数据，按纯文本显示，写 `$` 只会原样显示 |
| `id`、`lab`、`type` 等结构化字段 | ❌ | 程序用，别动 |

## 七、样板
`data/math-analysis-1.js` 第 1 讲（`ma1-real-numbers`）是按本规范改写好的样板：
对照 `tools/_pairs-pilot.json` 与文件里 13~160 行，能看清「原文 → 公式化」的尺度与密度。

---

## 八、翻车之后的急救工具

批量改写最容易出两类事故，两个站都备了专用修复脚本（可反复运行，幂等）：

| 症状 | 检查命令 | 修复命令 |
| --- | --- | --- |
| **公式体被 JS 吃掉首字母**：`\frac` 里的 `\f` 变成换页符，渲染成 `rac{...}`；`\right`→`ight`、`\times`→`imes`、`\to`→`o` | `node tools/fix-tex-escapes.mjs data/xxx.js --dry` | 去掉 `--dry` 即修复（只改 `$...$` 之内、只认高置信度残渣，不会误伤代码里的 `\n`） |
| **反斜杠多了一层**：源码写成 `\\\\frac`，运行时是 `\\frac`，KaTeX 把 `\\` 当换行，渲染成歪的 | `node tools/audit-math.mjs` 的「反斜杠写多了」一节 | `node tools/_fix-dbl.mjs data/xxx.js` |
| **整个文件 JS 语法错**（如 `Unexpected token ':'`） | `node tools/validate-curriculum.mjs` | 定位：`node -e "new (require('vm').Script)(require('fs').readFileSync('data/xxx.js','utf8'))"` 会报出出错行 |
| **字段名被重复塞进字符串开头**（`q: "q: \"...`） | `node tools/_fix-qprefix.mjs data/xxx.js --dry` | 去掉 `--dry` |

> 血泪教训：**「文件能求值」不等于「内容没坏」**。UTF-8 BOM、重复键、丢反斜杠、公式里塞进 `____` 下划线，都能通过语法检查却在页面上露馅。
> 所以每个文件都必须过 `audit-math.mjs` 的五节检查，而不是只看 `validate` 通过。

## 九、逐讲覆盖率自查
`node tools/lesson-coverage.mjs data` —— 按文件列出「多少讲已经有公式 / 总共多少讲」，
收尾时用它确认没有漏掉整讲（`… 部分` 的行就是还没改完的）。

---

## 十、写公式时最容易踩的五个坑（都真实发生过）

| 坑 | 症状 | 正确写法 |
| --- | --- | --- |
| **`$` 与公式之间有空格** | `$ x^2 $`、`$... = $` 整段不渲染，页面上原样露出 `$` | 紧贴写：`$x^2$`；填空写成 `$=$ ____` 或 `$\underline{\qquad}$` |
| **公式里连着写两个竖线** | `$\|\vec a\|\|\vec b\|$` 里的 `\|\|` 被判成程序里的「逻辑或」，整段不渲染 | 范数用 `\|\vec a\|`、`\lvert x \rvert`；两个范数相乘写成 `\|\vec a\|\,\|\vec b\|` |
| **公式里直接写中文** | 扫描器判定「不是公式」，原样显示美元符号 | 中文包进 `\text{面积} = \pi r^2` |
| **源码里单反斜杠** | `\frac` 变 `rac`、`\left` 变 `left`、`\tan`/`\to` 的 `\t` 变制表符（公式开头多出空白，整段不渲染） | 源码写 `\\frac`；批量改写一律用 pairs 的 `"toTex"` 字段；写完跑 `node tools/fix-tex-escapes.mjs data/xxx.js --dry` 自查 |
| **Markdown 表格里的公式** | 表格用 `\|` 分隔单元格，会切碎 `$\|f_n\| \le g$` 这类公式 | **渲染器已修**：切单元格时会跟踪 `$...$`，公式里的 `\|` 不再当分隔符，直接写即可 |

> 前四条审计都会报（`✗ 语法错误` / `! 丢了反斜杠` / `! 写进了不渲染字段` / `! 写了 $ 但没被当成公式`），
> 第五条是渲染器层面的问题，靠 `tools/verify-dom.mjs` 的「正文里不许残留成对 `$`」断言兜住。



