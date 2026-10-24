# 课程内容契约（LLM 站 CONTENT-SPEC）

本文件是 `data/*.js` 课程文件的**唯一格式与质量约定**。任何新增/修改课程都必须让
`node tools/validate-curriculum.mjs` 全绿，并让依赖门
（`node tools/audit-prereqs.mjs` + `node tools/audit-independence.mjs`）零错误。

继承自 cs 站契约的通用规则（block 类型、quiz 格式、字段要求）与 cs/CONTENT-SPEC.md 一致；
本文件只写 **LLM 站新增/更严的规则**。写课程前两份都要读。

---

## 1. 课程级字段（LLM 站更严的三条）

### 1.1 `need`（前置声明）——只有两种合法写法

```js
need: "零基础可学：……一句话说明为什么零基础也能学……",
need: "建议先学「Python 编程基础」「机器学习与深度学习基础」；本课……",
```

- **站内课名用「」**，必须与站内某门课程的 `title`（或 `id`）完全一致；引用只允许出现在
  「建议先学」之后。
- 允许带讲次：`「注意力与 Transformer」（第 3 讲）`。
- **禁止**：`《》`式写法、跨站引用（数学站/Python 课/CS 站）、外部依赖（先学 torch/numpy）、
  自指、悬空引用。全部由 `audit-prereqs.mjs` 机器校验，违者退出码 1。

### 1.2 `term`（主线阶段）——只有三个合法值

```
"主线 A · LLM 基础与原理" | "主线 B · 工程与 Harness" | "主线 C · 实战与前沿追踪"
```

★ 校验器硬性比对：少一个字、多一个空格都算错误（写错会让课程在首页排到主线之外）。

### 1.3 `tags` 允许值

`["零基础"]`、`["前沿"]`、`["前沿 2026"]`、`["项目"]`、`["核心"]`、`["进阶"]` 的自由组合。
（`前沿` 用于稳定原理层面的前沿课，`前沿 2026` 用于带明确时间截面、会过期的专题课。）

### 1.4 引号规则（会被校验器与冒烟测试检查）

1. 课程 `title`、`lesson.title` 里**不得出现英文双引号 `"`**（渲染时会变成 `&quot;`，冒烟测试会报「课程页缺少《…》/ 课时页标题缺失」）。需要引号请用中文引号：`「」` 或 `“”`。
2. 正文里也请一律用中文引号；不要用转义的 `\"`。
3. `need` 字段里的 `「」` **只能**用来包站内真实课名（否则 `audit-prereqs.mjs` 报悬空引用）；要强调请改用 `“”`。
4. 课程卡片顺序由 `app/app.js` 里的 `ORDER` 数组决定：新建课程文件前先确认自己的 `course.id` 已在 `ORDER` 中（校验器会检查并报错）。

---

## 2. 粒度规范（对齐 cs 实测：平均 7 讲/课、4 题/讲）

| 层 | 规范 | 强制方式 |
|---|---|---|
| 课程 | 6~10 讲；前沿专题课可 10~12 讲；项目课 5~8 讲；路线图课 3~5 讲 | validate（提示） |
| 讲 | `est` 25~50 分钟（必填）；`goal` 一句话可检验目标（必填） | validate（硬性） |
| 讲内 | 3~9 个 block；每讲 quiz 2~5 题；每课 ≥1 个 `interactive` | validate（硬性） |
| 题 | `why` 必填，写清「为什么对 + 干扰项错在哪」 | validate（硬性） |

每讲 = 一个心智块 + 一件能亲手做的事：先类比建立直觉 → 严格内容 → 可手算例子 →
交互实验/动手步骤 → 易错点 → 测验 → 自检清单。

---

## 3. LLM 站交互实验（`interactive` 块的 `lab` 取值；12 类已全部实现）

| lab | config 结构（严格遵守） |
|---|---|
| `tokenlab` | `{ text:"要被分词的文本", merges:[["a","b"],["ab","c"]], vocab:{"a":10,"b":11,"ab":12,"c":13}, steps:[{desc, tokens:[...], ids:[...], note}] }`——展示 BPE 逐步合并；steps 至少 4 步 |
| `attnlab` | `{ seq:["词1","词2","词3"], d:2, Q:[[..],[..]], K:[[..],[..]], V:[[..],[..]], steps:[{desc, scores:[[..]], weights:[[..]], out:[[..]], note}] }`——注意力手算；steps 至少 4 步 |
| `samplab` | `{ prompt:"可选的一句话提示", logits:[{token:"巴黎",logit:3.0},{token:"里昂",logit:1.5}], temperature:1, topK:0, topP:1, seed:20261024, steps:[{desc, temperature?, topK?, topP?, note}] }`——`logits` 至少 2 个候选词；`topK:0` 表示不限、`topP:1` 表示不截断；给了 `steps` 就能"上个场景 / 下个场景 / 自动播放"逐步演示；页面上的三个滑杆可以实时改温度、top-k、top-p，并显示"剪掉 / 保留 / 归一化后概率"与可复现的抽样结果（同一种子必然抽到同一个词） |
| `ragsteps` | `{ query:"查询", docs:[{id, text}], chunkSize:120, qemb:[..]?（可选，问题向量）, emb:{docId:[..]}, steps:[{desc, stage:"chunk","embed","retrieve","prompt", data, note}] }`——渲染器会**真算**按句切分与余弦排序；`qemb` 给了就展示相似度排名，没给则只讲流程；steps 至少 3 步，四个 stage 建议都覆盖（缺了会告警） |
| `agenttrace` | `{ task:"任务描述", steps:[{desc, kind:"thought","action","observation","finish", text, note}] }`——ReAct 轨迹回放（思考→行动→观察循环）；steps 至少 3 步，必须含 thought 与 action 各一步，没有 observation/finish 会告警 |
| `protolab` | `{ scenario:"场景描述", parties:[{name, role}], links:[{from, to, proto, desc}], steps:[{desc, note}] }`——角色卡片 + 协议连线图；`links.from/to` 必须是 `parties` 里出现过的 name（validator 会查），每走一步点亮一条连线 |

沿用 cs 的 `datalab`（通用单步执行器）也可用，但 **LLM 课优先用上面 LLM 专有实验**。
全部 config 驱动、数据文件禁函数、数值全部纯浏览器可算（**不得依赖运行中的模型或联网**）。

---

## 4. 依赖三条红线（每波交付前必须自查）

1. **正文零跨课指引**：不写「见《某课》」「去 Python 课/数学站/CS 站补」「先学 torch 再回来」。
   课内前向指引的唯一合法写法：**「不熟的话，先看第 N 讲」**（指向同一门课，逗号不能少——
   审计正则按带逗号的形式豁免）。
2. **零隐性回指**：不写「前面讲过」「如前所述」「回忆上一课」。隔两讲以上要用某概念时，
   用一句括号短语复述（如「softmax（把分数转成加起来等于 1 的概率）」「注意力（按相关性加权汇总）」）。
3. **数学就地讲清**：矩阵乘、softmax、梯度、对数等在用到的那一句用大白话解释，
   给能手算的小例子；绝不要求读者「先去补数学」。

---

## 5. 外部资源引用规则（LLM 站特有）

- 正文**不写裸链接**、不指路外部文档；需要引用的官方文档/论文/资料链接统一放进
  课程级 `advanced` 的 `texts` 列表或《前沿追踪路线图》的附录页（附录页允许链接）。
- 提到「截止 2026-10 前沿」的讲，必须在 block 里写明来源（模型名/协议名/报告名）与日期标注。
- 本机路径（如 `D:\AI\study`、DSH 插件项目路径）**不得进入课程正文**；确需对照的放附录页。

### 5.0 关于「本机实测」数字的一条硬规矩

**不要把会漂移的绝对值写进课程正文。** 教训来自一次真实的返工：

`api-6` 曾写「5 轮对话输入词元 22→86→150→214→278」，后有人复测得「19→73→127→181→235」，我独立复跑又得「25→63→119→175→231」。三组都对，也都不一样——因为**每轮回答长度本身是模型随机生成的**，它直接决定下一轮的输入增量。

写这类内容时按下面的方式处理：

1. **写稳定的量**：增长趋势（每轮稳定增加约 55 词元）、关系统计（累计约为首轮的 9 倍）、比例（外壳占 73.8%）。这些复跑仍然成立。
2. **必须写绝对值时，把测量条件写全**：模型名与量化、固定系统提示、每轮同一句问题、max_tokens、是否含模板开销。缺任何一项，数字就没有可比性。
3. **留下可复现脚本**：放在 `llm/tools/verify-*.py`，让别人能一键重跑。示例：`llm/tools/verify-token-growth.py`。
4. **报告数字时说明是「一次实测」还是「多次实测的稳定区间」**。前者不该被当作普适结论。
### 5.1 `advanced`（课程级进阶包）字段契约

`advanced` 可选；一旦写了，四个字段都必须齐全（`validate-curriculum.mjs` 会逐项校验）：

```js
advanced: {
  texts: ["《动手学深度学习》第 3 章", "Attention Is All You Need（2017）"],   // 非空字符串数组：配书/论文/文档
  labs:  ["用纸笔手算一次 softmax", "在 datalab 里改一层看输出变化"],          // 非空字符串数组：招牌实验
  project: "从零实现一个两层 MLP，不用框架，训练到能分开异或。",                 // 非空字符串：从零实现
  criteria: ["能独立推导反向传播的链式法则", "能解释为什么需要非线性激活"]        // 字符串，或非空字符串数组
}
```

- `criteria` 写字符串或字符串数组都行：数组会被渲染成验收清单（`app.js` 已按数组/字符串分别渲染）。
- `texts` / `labs` 用**短名**即可，正文里不写裸链接（见上一条）。

---

## 6. 自检

```powershell
node tools/validate-curriculum.mjs      # 结构、答案、实验 config、est/goal/why
node tools/audit-prereqs.mjs            # need 引用可解析、零跨站（新依赖门）
node tools/audit-independence.mjs       # 正文零跨课指引、零隐性回指
node tools/audit-zero-basis.mjs         # 术语首现就地解释
node tools/smoke-test.mjs               # 引擎渲染 + 错题本全流程
node tools/smoke-test.mjs --fixture     # 引擎隔离自测
node tools/check-python.mjs             # Python 块真实执行（纯标准库）
node tools/audit-math.mjs               # 每段 $...$ 用 KaTeX 真渲染
powershell -NoProfile -ExecutionPolicy Bypass -File tools/verify-browser.ps1   # 浏览器级 DOM 断言
```

> 已知非缺陷项：标注「需 torch/GPU/云」的 Python 块在 Windows 本机执行会失败，
> 沿用 cs 站的 `check-python.mjs` 白名单机制（块内注释声明依赖即可）。
