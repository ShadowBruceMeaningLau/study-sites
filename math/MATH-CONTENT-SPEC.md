# 数学站课程内容契约（MATH-CONTENT-SPEC）

本文件是 `math/data/*.js` 课程文件的**唯一格式与质量约定**（与 CS 站的 CONTENT-SPEC 基本一致，
差别已在下文标注）。任何新增/修改课程都必须让 `node math/tools/validate-curriculum.mjs` 全绿。

---

## 1. 文件格式（硬性）

每个课程一个文件：`math/data/<slug>.js`，**无 BOM 的 UTF-8**，内容**只有一条**
`window.COURSE_PACKS.push({...});` 对象字面量，不允许 import/export/require，不允许函数，不允许模板字符串（反引号）。

```js
window.COURSE_PACKS.push({
  id: "mathematical-analysis-1",   // 与文件名一致，kebab-case
  title: "数学分析（一）：极限与连续",
  icon: "📈",                       // 1 个 emoji
  term: "大一上",                    // 建议修读时间
  hours: 96,                        // 建议学时（整数）
  blurb: "一句话说明这门课解决什么问题，为什么重要。",
  tags: ["数学主干", "证明训练"],
  lessons: [ /* 见下 */ ]
});
```

字符串中如出现双引号统一用中文引号「」或单引号，避免转义问题。

---

## 2. Lesson（讲）

```js
{
  id: "ma1-sequence",             // 全局唯一，<课程前缀>-<短名>，同一门课内前缀必须一致
  title: "数列极限：ε-N 语言",
  goal: "学完后你能……（一句话，可检验的学习目标）",
  est: 50,                        // 预计学习分钟数
  blocks: [ /* 讲解块 */ ],
  quiz: [ /* 测验题，3~5 题 */ ]
}
```

`blocks` 可用类型（按需组合，建议 6~9 块）：

| type | 必填字段 | 说明 |
|---|---|---|
| `concept` | `title`, `md` | 核心讲解，`md` 是 markdown 字符串 |
| `steps` | `title`, `items[]` | 有序步骤（证明骨架/算法步骤）；item 可为字符串或 `{t,d}` |
| `analogy` | `title`, `md` | 几何直观或生活类比 |
| `code` | `lang`, `title`, `code` | `lang ∈ {python, c, text}`；数学课优先 python 数值实验 |
| `pitfall` | `title`, `items[]` | 常见误区（证明跳步、把直观当证明） |
| `calc` | `title`, `inputs:[{name,value}]`, `outputs:[]`, `note?` | 手算演练（极限、导数、行列式、概率）；value/outputs 必须是字符串 |
| `interactive` | `lab`, `title`, `config{...}` | 交互实验，见 §3 |
| `lab` | `title`, `steps[]`, `note?` | 纸笔/上机练习说明 |

---

## 3. `interactive` 实验（每门课至少 2 个）

可用的 6 类组件（`config` 结构严格遵守，否则校验失败）：

- `"datalab"` —— **最常用**：通用单步执行器，逐步展示"变量快照"
  `config = { state:{...}, steps:[{desc, state:{...}, note}] }`，`steps` **至少 6 步**，state 值必须是字符串或数字。
  适合：ε-N 验证过程、黎曼和逼近、泰勒逐项、幂迭代、施密特正交化、大数定律累计频率、
  贝叶斯后验更新、中心极限定理采样、蒙特卡洛估计 π、群乘法表构造、证明步骤分解。
- `"pathlab"` —— 网格最短路（无向带权，正交邻接）
  `config = { grid:[[1,1,9,1],[1,0,1,0],[1,1,1,1]], start:[0,0], end:[2,3], algo:"bfs"|"dijkstra", legend:"说明" }`
  `0` = 墙；`1..9` = 代价。适合：距离函数/范数直观、梯度下降路径、图论与关系、最优化的几何意义。
- `"pagelab"` —— 页面置换（数理统计方向可用它演示"有限窗口下的最优/最近最少使用"）
  `config = { frames:3, refs:[7,0,1,2,0,3,0,4], algos:["OPT","FIFO","LRU","CLOCK"] }`
- `"arbitlab"` —— 位模式（适合讲浮点误差、二进制与十进制转换、有效数字）
  `config = { bits:8, modes:["原码","反码","补码","移码"], legend:"说明" }`
- `"schedlab"` —— 任务调度甘特图（适合讲数值计算的并行/迭代收敛速度对比，选做）
  `config = { procs:[{name:"P1",arrival:0,burst:5}], quantum:2, algos:["FCFS","SJF","RR"] }`
- `"cpulab"` —— 指令级执行（数学课基本不用）

可选字段：`tasks[]`（动手任务：`"文字"` 或 `{t, hint?, check?}`）。

---

## 4. Quiz（测验题）

```js
{ id:"ma1-sequence-q1", type:"single", q:"问题", options:["A","B","C","D"], answer:1, why:"为什么对 + 干扰项错在哪" }
{ id:"ma1-sequence-q2", type:"multi",  q:"问题", options:[...], answer:[0,2], why:"..." }
{ id:"ma1-sequence-q3", type:"fill",   q:"极限是 ____", answer:["1","1."], why:"..." }
{ id:"ma1-sequence-q4", type:"order",  q:"把证明步骤排成正确顺序", items:[...], answer:[2,0,1], why:"..." }
```

硬性要求：
- `why` 必填且要写清"为什么对 + 干扰项错在哪"，**不少于 30 字**。
- 单选 `answer` 是整数索引；多选是升序数组；`order.answer` 是 `items` 的下标排列；`fill.answer` 是字符串数组。
- `id` 全局唯一并以课程前缀开头（如 `ma1-`、`la-`、`prob-`）。
- 每课至少：1 题概念辨析、1 题计算/推导、1 题易错点。

---

## 5. 数学课特有的质量要求（会被抽查）

1. **证明讲到"为什么这一步合法"**：用到哪个定理、需要什么前提（例如中值定理要求闭区间连续 + 开区间可导）。
2. **数必须算对**：`calc` 与 `interactive` 里的极限、导数、行列式、特征值、概率结果要用你自己的脚本验证过。
3. **直观与严格分开写**：先给几何直观/物理意义，再给严格表述；明确指出"直观不能代替证明"的地方。
4. **术语中英并列**（首次出现）：如"极限（limit）""特征值（eigenvalue）""σ-代数（σ-algebra）"。
5. **每课都要有可动手环节**：`interactive` 或 `lab` 至少一个。
6. **数学史与动机适量**：说明这个概念的来源与解决的问题（如为什么需要实数完备性、为什么引入测度）。
7. **公式写法**：用反引号以外的方式表达（数据文件里禁止反引号），例如直接写 `lim(x→0) sin x / x = 1`、
   `∑_{n=1}^{∞} 1/n^2 = π²/6`。渲染器支持 `**粗体**`、`- 列表`、`> 提示`、`| 表格 |`。

---

## 6. 自检

```powershell
node math/tools/validate-curriculum.mjs     # 结构 / 答案 / 实验配置 / 统计
node math/tools/smoke-test.mjs              # 模拟浏览器渲染每一讲与每个实验
node math/tools/check-python.mjs            # 把课程里的 python 代码块真实执行
```
