# 课程内容契约（CONTENT-SPEC）

本文件是 `data/*.js` 课程文件的**唯一格式与质量约定**。任何新增/修改课程都必须让
`node tools/validate-curriculum.mjs` 全绿。

---

## 1. 文件格式（硬性）

每个课程一个文件：`data/<slug>.js`，**无 BOM 的 UTF-8**，内容**只有一条** `window.COURSE_PACKS.push({...});`
对象字面量，不允许 import/export/require，不允许函数、不允许模板字符串插值。

```js
window.COURSE_PACKS.push({
  id: "data-structures",          // 与文件名一致，kebab-case
  title: "数据结构与算法基础",
  icon: "🧱",                      // 1 个 emoji
  term: "大二上",                  // 建议修读时间
  hours: 64,                       // 建议学时（整数）
  blurb: "一句话说明这门课解决什么问题，为什么重要。",
  tags: ["考研408", "核心"],
  lessons: [ /* 见下 */ ]
});
```

字符串中如出现双引号统一用中文引号「」或单引号，避免转义问题。

---

## 2. Lesson（课）

```js
{
  id: "ds-array",                 // 全局唯一，<course前缀>-<短名>
  title: "线性表：数组与动态数组",
  goal: "学完后你能……（一句话，可检验的学习目标）",
  est: 35,                        // 预计学习分钟数
  blocks: [ /* 讲解块 */ ],
  quiz: [ /* 测验题，2~5 题 */ ]
}
```

`blocks` 可用类型（按需组合，建议 5~9 块）：

| type | 必填字段 | 说明 |
|---|---|---|
| `concept` | `title`, `md` | 核心讲解，`md` 是 markdown 字符串（见 §4） |
| `steps` | `title`, `items[]` | 有序步骤；item 可为字符串，或 `{t:"步骤", d:"解释"}` |
| `analogy` | `title`, `md` | 生活类比，帮助建立直觉 |
| `code` | `lang`, `title`, `code` | `lang ∈ {c, cpp, python, java, js, asm, sql, bash, text}` |
| `pitfall` | `title`, `items[]` | 常见误区与错误，每条一个字符串 |
| `calc` | `title`, `inputs:[{name,value}]`, `outputs:[]`, `note?` | 手算演练，`value`/`outputs` 必须是字符串 |
| `interactive` | `lab`, `title`, `config{...}` | 交互式实验，见 §3 |
| `lab` | `title`, `steps[]`, `note?` | 无交互的实验/上机作业说明，steps 为字符串数组 |

---

## 3. `interactive` 实验（每门课至少 1 个）

`lab` 取值与 `config` 结构（严格遵守，否则校验失败）：

- `"pathlab"` —— 网格寻路 / 最短路（无向带权网格，正交邻接）
  `config = { grid: [[1,1,9,1],[1,0,1,0],[1,1,1,1]], start:[0,0], end:[2,3], algo:"bfs"|"dijkstra", legend:"说明文字" }`
  `0` = 墙；`1..9` = 通过该格的代价（可同时理解为路径长度权重）。起点终点必须为可通行格（非 0）。
- `"schedlab"` —— CPU 调度 Gantt 图
  `config = { procs:[{name:"P1",arrival:0,burst:5}], quantum:2, algos:["FCFS","SJF","SRTF","RR","优先级"] }`
- `"cpulab"` —— 指令执行 / 取指译码 / 数据通路
  `config = { regs:{"R1":0,"R2":0}, mem:{"0x10":5}, program:[{asm:"LOAD R1, [0x10] / 取数", note:"解释"}], legend:"说明" }`
- `"pagelab"` —— 页面置换 / 缺页统计
  `config = { frames:3, refs:[7,0,1,2,0,3,0,4], algos:["OPT","FIFO","LRU","CLOCK"] }`
- `"arbitlab"` —— 进制 / 定点浮点位模式（`bits` 取 4~64，32 位专门用于 IEEE 754 单精度）
  `config = { bits:8, modes:["原码","反码","补码","移码","IEEE754单精度"], legend:"说明" }`
- `"datalab"` —— 通用单步执行器（数据结构、算法、编译、数据库、AI 都能用）
  `config = { state:{"i":0,"sum":0}, steps:[{desc:"第 1 步：初始化", state:{"i":0,"sum":0}, note:"解释"}] }`
  `state` 的值必须是字符串或数字。`steps` 至少 4 步，逐步展示"变量/结构快照"。

可选字段：`tasks[]`（动手任务清单），`{t:"任务", hint?:"提示", check?:"可检验的达成标准"}`。

---

## 4. Quiz（测验题）

```js
{ id:"ds-array-q1", type:"single",      // 单选
  q:"问题", options:["A","B","C","D"], answer:1, why:"为什么 B 对；其余选项错在哪" }

{ id:"ds-array-q2", type:"multi",       // 多选，answer 为索引数组（升序）
  q:"问题", options:[...], answer:[0,2], why:"..." }

{ id:"ds-array-q3", type:"fill",        // 填空，answer 为可接受答案数组
  q:"平均时间复杂度是 ____", answer:["O(1)","O（1）"], why:"..." }

{ id:"ds-array-q4", type:"order",       // 排序（拖拽/点击排序）
  q:"把步骤排成正确顺序", items:["3 个错序选项按钮"], answer:[2,0,1], why:"..." }
```

硬性要求：
- `why` 必填且要写清"为什么对 + 干扰项错在哪"，**不能只写"因为 A 对"**。
- 单选 `answer` 是整数索引；多选是升序数组；`order` 的 `answer` 是 `items` 的正确顺序（索引数组）；`fill` 是字符串数组。
- 每题 `id` 全局唯一；一门课内题干不得重复。
- 至少覆盖：1 题概念辨析、1 题计算/推导、1 题易错点。

---

## 5. 内容质量要求（会被人工抽查）

1. **讲原理，不停在名词**：每个概念至少回答"为什么需要它 / 不这么做会怎样 / 代价是什么"。
2. **数字必须自洽**：`calc` 与 `interactive` 里的结果要能算对（例如 8 位补码、页框数、Gantt 顺序、CRC/流水线加速比）。
3. **术语中英并列**（首次出现）：如"缺页中断（page fault）""访存（memory access）"。
4. **面向国内本科语境**：可标注考研 408 考点、期末常见题型，但不要只讲考点。
5. **每课结尾有可操作练习**：至少一个 `lab` 步骤块或 `interactive.tasks`，让学生真动手。
6. **代码可运行**：`code` 块要给完整可编译/可运行的片段或明确标注伪代码；C 代码要有头文件与 `main`（或明确说明是片段）。
7. 语言：简体中文；公式用 markdown 行内 `code` 表示（如 `T(n)=2T(n/2)+O(n)`），无需 LaTeX。

---

## 6. 自检

```powershell
node tools/validate-curriculum.mjs
node tools/smoke-test.mjs
```

校验器会检查：结构完整性、id 唯一性、课程内前缀一致性、答案索引范围、lab config 是否合法、
blocks 字段是否缺漏、题目 `why` 是否过短、每课是否含实验块，并打印课程/课时统计。

> 注意两个易踩的规则：
> 1. `quiz` **不是** block 类型（它是 lesson 级字段），不要把测验塞进 `blocks`；测验统一渲染在页面底部。
> 2. 课程文件里**不要用反引号**（模板字符串容易把内容里的引号写坏）。公式请写成纯文本，
>    例如 `T(n) = 2T(n/2) + n` 在数据里直接写成 `T(n) = 2T(n/2) + n`（行内代码样式由渲染器负责）。
>    渲染器会把 `**粗体**`、`- 列表`、`> 提示`、`| 表格 |` 和普通换行都渲染出来。
