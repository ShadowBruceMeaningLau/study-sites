# AUTHOR-BRIEF：后续课程任务书（课程 10~23）

> 本文件是**课程作者的权威任务书**。派发时只需说「读 `llm/AUTHOR-BRIEF.md`，写课程 X 的前 2 讲」。
> 数据契约、粒度规范、lab 契约以 `llm/CONTENT-SPEC.md` 为准（先读它）；本文件只定**课程清单与元信息**。

## 0. 通用硬规则（每门课都适用）

1. **纯数据文件**：一个文件只有一条 `window.COURSE_PACKS.push({...})`；无函数、无 `require/import/export/fetch`、无反引号模板字符串、UTF-8 无 BOM。
2. **一次只写 2 讲**；动笔前先列已有讲号（`Select-String -Path data\<文件>.js -Pattern 'id:\s*"<前缀>-\d+"'`），从最大讲号 +1 续写；只用 `edit` 追加，绝不 `write` 覆盖、绝不重复讲号。
3. 写完汇报「已落盘 X、Y；未完成；请回复继续」，等 Lead 发「继续」再写下一批。
4. 每讲 5~7 个 `block`、3 道题、`est` 30~45、4 条 `checklist`；每门课至少 1/3 的讲带 `interactive` 块。
5. 课程 `title` 与 `lesson.title` 里**禁止英文双引号**，用中文引号「」或“”；`need` 里的「」只能包站内真实课名，强调用“”。
6. 正文里出现的每个数字都要用 `llm/tools/_scratch_<课>_*.py`（纯标准库 python3）实跑核对；会过期的具体数字（型号/榜单/版本/论文里的数字）必须 `web_search` 核对并注「截至 2026-10」，核不到就只写原理。
7. 写完全部讲数后：`node tools\validate-curriculum.mjs` 本文件 0 error；`node tools\check-python.mjs` 通过；删除自己留下的 `_scratch_*` 临时脚本。

## 1. 课程清单（id 必须与文件名一致，且已在 `app/app.js` 的 ORDER 里登记）

| # | id（文件名） | icon | term | hours | tags | 前缀 | 讲数 |
|---|---|---|---|---|---|---|---|
| 10 | `prompt-engineering` | 💬 | 主线 B · 工程与 Harness | 25 | ["进阶"] | `pe-` | 6 |
| 11 | `inference-api` | 🔌 | 主线 B · 工程与 Harness | 30 | ["核心"] | `api-` | 7 |
| 12 | `harness-anatomy` | 🧰 | 主线 B · 工程与 Harness | 40 | ["核心"] | `hx-` | 9 |
| 13 | `agent-protocols-2026` | 🔗 | 主线 B · 工程与 Harness | 30 | ["核心", "前沿 2026"] | `proto-` | 8 |
| 14 | `tool-calling` | 🛠️ | 主线 B · 工程与 Harness | 30 | ["核心"] | `tool-` | 7 |
| 15 | `rag` | 📚 | 主线 B · 工程与 Harness | 35 | ["核心"] | `rag-` | 8 |
| 16 | `finetuning-lora` | 🎚️ | 主线 B · 工程与 Harness | 30 | ["进阶"] | `ft-` | 7 |
| 17 | `agent-core` | 🤖 | 主线 B · 工程与 Harness | 40 | ["核心"] | `ag-` | 9 |
| 18 | `eval-harness` | 📏 | 主线 B · 工程与 Harness | 30 | ["核心"] | `ev-` | 7 |
| 19 | `project-rag` | 🧪 | 主线 C · 实战与前沿追踪 | 25 | ["项目"] | `pr-` | 6 |
| 20 | `project-cli-agent` | ⌨️ | 主线 C · 实战与前沿追踪 | 25 | ["项目"] | `pc-` | 6 |
| 21 | `project-evals` | ✅ | 主线 C · 实战与前沿追踪 | 25 | ["项目"] | `pv-` | 6 |
| 22 | `project-dsh-extension` | 🧩 | 主线 C · 实战与前沿追踪 | 30 | ["项目"] | `pd-` | 6 |
| 23 | `frontier-tracking` | 🧭 | 主线 C · 实战与前沿追踪 | 15 | ["进阶"] | `track-` | 4 |

## 2. 逐课讲目与 `need`

### 10. prompt-engineering 💬（`pe-`，6 讲）
need：`"建议先学「LLM 零基础入门」；本课默认你已经能通过网页或 API 跟模型对话。"`
pe-1 一条好指令的四个要素（任务/输入/约束/输出格式）｜pe-2 给例子比讲道理管用（few-shot）｜pe-3 让它一步步想（思维链与推理型提示）｜pe-4 角色与系统提示｜pe-5 结构化输出与格式约束（JSON/表格/字段校验）｜pe-6 提示词工程的边界（哪些事该换 RAG/微调/工具）
实验建议：datalab（拼提示词流水线）、agenttrace（多轮对话轨迹）。

### 11. inference-api 🔌（`api-`，7 讲）
need：`"建议先学「Python 编程基础（AI 方向）」；会写函数、会读报错就能学。"`
api-1 按一次发送之后发生了什么（从你的代码到模型回答）｜api-2 用 Python 调通第一个接口｜api-3 流式输出：为什么字是一个一个蹦出来的｜api-4 自己解析流式数据（SSE 分帧、半截 JSON）｜api-5 重试、超时与限流｜api-6 token 计数与成本估算｜api-7 多服务商与兼容层（同一份代码换个 base_url）
实验建议：datalab（一次请求的处理流水线）、agenttrace（超时/重试的时间线）、samplab（采样参数对输出的影响）。

### 12. harness-anatomy 🧰（`hx-`，9 讲）
need：`"建议先学「推理 API 与流式输出」；本课要动手搭骨架，需要能读写 Python 文件。"`
hx-1 harness 是什么：模型之外的那一整套｜hx-2 会话与消息数组（谁在记着上下文）｜hx-3 工具循环：模型要工具、你给结果、它接着说｜hx-4 流式、中断与恢复｜hx-5 状态与持久化｜hx-6 多服务商适配｜hx-7 错误处理、重试与降级｜hx-8 权限与安全边界（它到底能动你的文件吗）｜hx-9 亲手搭一个最小 harness（对照 DeepSeek Harness 的真实结构）
实验建议：agenttrace（工具循环轨迹）、protolab（组件与连线）、datalab（会话装配）。

### 13. agent-protocols-2026 🔗（`proto-`，8 讲）
need：`"建议先学「Harness 解剖」；懂 HTTP 与 JSON 就能学。"`
proto-1 为什么需要协议（各家工具各写一遍的痛苦）｜proto-2 MCP：模型连工具的标准插头｜proto-3 工具协议细节：能力声明、调用、回传｜proto-4 A2A：agent 之间怎么互相派活｜proto-5 ACP / UHP：编辑器与 agent 的接口｜proto-6 AG-UI：把 agent 的状态画到界面上｜proto-7 自己写一个最小工具服务器｜proto-8 协议选型与生态现状
★ 时间截面课：协议版本与生态数字必须 `web_search` 核对并注「截至 2026-10」。
实验建议：protolab（角色与连线）、agenttrace（跨 agent 调用轨迹）。

### 14. tool-calling 🛠️（`tool-`，7 讲）
need：`"建议先学「推理 API 与流式输出」；会写 Python 函数即可。"`
tool-1 模型不能真的做事，它只会说「请调用这个函数」｜tool-2 工具描述（schema）怎么写模型才不误用｜tool-3 参数校验与 JSON Schema｜tool-4 多轮工具调用与并行调用｜tool-5 工具结果怎么喂回去｜tool-6 工具出错、参数乱填怎么办｜tool-7 安全：别让模型删你的库
实验建议：agenttrace、datalab（工具调用的参数流水线）。

### 15. rag 📚（`rag-`，8 讲）
need：`"建议先学「推理 API 与流式输出」；本课动手做检索，需要能读写 Python 文件。"`
rag-1 为什么需要 RAG（模型不知道你公司的事）｜rag-2 切分：把文档切成人能读的小块｜rag-3 向量与相似度：把意思变成坐标｜rag-4 检索：从一堆块里挑最相关的几块｜rag-5 重排与混合检索｜rag-6 拼进提示词与引用来源｜rag-7 评测 RAG：怎么知道它答得对｜rag-8 常见失败模式（切坏了、检索到了错的、模型无视材料）
实验建议：ragsteps（切分→嵌入→检索→拼提示词四阶段）。

### 16. finetuning-lora 🎚️（`ft-`，7 讲）
need：`"建议先学「后训练与对齐前沿」和「机器学习与深度学习基础」；本课有真实训练脚本，需要一块能用的显卡。"`
ft-1 什么时候该微调（多数时候不该）｜ft-2 SFT 的数据长什么样｜ft-3 全量微调为什么会爆显存｜ft-4 LoRA：只训一小块旁路｜ft-5 QLoRA 与量化训练｜ft-6 训完怎么合回去、怎么评测｜ft-7 微调 vs RAG vs 提示词的选型
★ 所有脚本要标注硬件要求（本机 RTX 4060 Laptop 8GB），跑不动的写成「需要更大显存」并说明原因，不许假装跑过。

### 17. agent-core 🤖（`ag-`，9 讲）
need：`"建议先学「工具调用」；本课讲怎么把一个会调工具的模型变成能自己干活的 agent。"`
ag-1 从「回答」到「干活」：agent 的循环｜ag-2 ReAct：想一步、做一步｜ag-3 任务规划与分解｜ag-4 记忆与上下文管理（长了怎么办）｜ag-5 多 agent 协作与分工｜ag-6 沙箱与权限：它能动什么、不能动什么｜ag-7 长任务的中断、恢复与人工确认｜ag-8 失败与自我纠错｜ag-9 浏览器/GUI agent 的现实
实验建议：agenttrace、protolab。

### 18. eval-harness 📏（`ev-`，7 讲）
need：`"建议先学「Agent 核心」；本课要给自己的 agent 建评测。"`
ev-1 没有评测就没有进步｜ev-2 基准与数据集：选择题、参考答案、人工打分｜ev-3 打分器：精确匹配、相似度、模型当裁判｜ev-4 回归评测与版本对比｜ev-5 长程任务怎么评（多步、多工具）｜ev-6 评测作弊与 Goodhart 定律｜ev-7 把评测接进日常开发
实验建议：agenttrace（一次被测轨迹）、datalab（打分流水线）。

### 19. project-rag 🧪（`pr-`，6 讲）
need：`"建议先学「RAG」和「推理 API 与流式输出」；这是动手项目课。"`
pr-1 项目目标与验收标准｜pr-2 准备你自己的资料库｜pr-3 实现切分与索引｜pr-4 实现检索与重排｜pr-5 接上模型做问答（带引用）｜pr-6 自评与改进清单

### 20. project-cli-agent ⌨️（`pc-`，6 讲）
need：`"建议先学「工具调用」和「Agent 核心」；这是动手项目课。"`
pc-1 目标：一个能在终端干活的助手｜pc-2 定义工具集与权限｜pc-3 工具循环与多步任务｜pc-4 中断、确认与恢复｜pc-5 日志与可观测性｜pc-6 打包与日常使用

### 21. project-evals ✅（`pv-`，6 讲）
need：`"建议先学「评测 Harness」；这是动手项目课。"`
pv-1 给你自己的 agent 定指标｜pv-2 造一组真实任务｜pv-3 实现打分器｜pv-4 跑回归与对比｜pv-5 找漏洞（评测作弊自查）｜pv-6 把评测做成 CI 门禁

### 22. project-dsh-extension 🧩（`pd-`，6 讲）
need：`"建议先学「Harness 解剖」；本课以 DeepSeek Harness 为例做扩展开发。"`
pd-1 扩展点在哪：插件、技能、工具、命令｜pd-2 写一个最小插件｜pd-3 写一个技能（skill）｜pd-4 加一个自定义工具｜pd-5 生命周期与钩子｜pd-6 调试、打包与发布
★ 以 DSH 真实实现为准（当前实现检出：`D:\computersoftware\DSH\resources\app.asar\dsh\`），不要凭空编 API。

### 23. frontier-tracking 🧭（`track-`，4 讲，终章）
need：`"零基础也能学；建议在学完主线 A、B 后再看。"`
track-1 怎么读一篇新论文（30 分钟抓到重点）｜track-2 怎么复现一个小实验｜track-3 怎么参与开源（提 issue、改文档、交第一个 PR）｜track-4 长期路线图：接下来一年该盯什么 + 全站课程索引
★ 这是「不会过期」的方法课：具体榜单与日期要注「截至 2026-10」。

## 3. 全站总量目标（对齐 cs 站实测粒度）

23 门课、约 172 讲、每讲 3 题 → 约 500 题；12 类交互实验全部有真实课程使用；八道门禁 + 浏览器验证全绿。
