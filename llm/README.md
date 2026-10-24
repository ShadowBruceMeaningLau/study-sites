# LLM · Harness · Agent 学习站

一个**零依赖、离线可用**的自学程序：双击 `index.html` 就能在浏览器里从零基础一路学到
大语言模型（LLM）、智能体执行框架（harness）与智能体（agent）的 **2026-10 前沿**，
然后自己动手开发。包含知识点精讲、可点运行的交互实验、随堂测验与错题本，学习进度自动保存在本地。

> 本目录与工作区里另外四个站（cs/math/physics/philosophy）**完全独立**：
> 引擎、课程数据、验证工具、localStorage 键（本目录用 `llm-learn:v1`）都不共享。
> 五个站一起启动：双击工作区根目录的 `start-all.cmd`（本站在 `http://127.0.0.1:8127`）。

> 面向：想系统学习 LLM、harness、agent 并**能自己动手开发**的人（零基础转行者、应用开发者、
> 想解剖 DeepSeek Harness 的工程师）。侧重：**原理可手算 + 工程能落地 + 前沿有出处**。

---

## 1. 快速开始

### 方式 A：直接双击（最简单）
双击 `index.html`，用 Chrome / Edge / Firefox 打开即可。全部数据都在本地，不需要联网、不需要安装任何东西。

### 方式 B：本地服务器（推荐，剪贴板与 localStorage 更稳定）
双击本目录下的 `start.cmd`，会在 `http://127.0.0.1:8127/index.html` 起本地服务器并自动打开浏览器。
关闭窗口即停止服务。

> 说明：`start.cmd` 内部刻意只写 ASCII 英文提示（cmd.exe 按字节解析 `.cmd` 文件）。
> 中文使用说明以本文件为准。端口被占用时可指定其它端口：`node tools\serve.mjs 8128`

---

## 2. 学什么：三条主线 23 门课

**主线 A · LLM 基础与原理（零基础 → Transformer → 2026 前沿）**

| 课程 | need | 说明 |
|---|---|---|
| 🌱 LLM 零基础入门 | 零基础可学 | 什么是大模型/token/温度/上下文窗口；Ollama 安装排错；4060 8GB 跑起第一个模型 |
| 💻 Python 编程基础（AI 方向） | 零基础可学 | 从零自足，用站内 datalab 演示；函数/类/模块/异常 |
| 机器学习与深度学习基础 | 先学「Python 编程基础」 | 损失/梯度/反向传播（浏览器数值演示+纯标准库） |
| 神经网络 | 先学「机器学习与深度学习基础」 | 感知机→MLP 手写前向/反向 |
| Tokenizer 与词表 | 先学「Python 编程基础」 | BPE 手算+实现（tokenlab） |
| 注意力与 Transformer | 先学「神经网络」「Tokenizer 与词表」 | self-attention 手算/位置编码/多头（attnlab） |
| 预训练与推理 | 先学「注意力与 Transformer」 | scaling law/KV cache/采样（samplab） |
| ★前沿模型专题 2026 | 先学「注意力与 Transformer」 | 混合注意力/DSA/多 token 预测/量化部署 4060 实战 |
| ★后训练与对齐前沿 | 先学「机器学习与深度学习基础」 | SFT→RLHF→RLVR/GRPO/测试时计算/推理模型 |

**主线 B · 工程与 Harness（调用 → 框架 → 评测）**

| 课程 | need | 说明 |
|---|---|---|
| 提示词工程 | 先学「LLM 零基础入门」 | few-shot/CoT/角色/结构化输出 |
| 推理 API 与流式输出 | 先学「Python 编程基础」 | OpenAI 兼容/SSE 手写解析/重试超时（对本地 Ollama） |
| ★Harness 解剖 | 先学「推理 API 与流式输出」 | harness 管什么；DeepSeek Harness 开源；真品 DSH 解剖；写最小 harness 骨架 |
| ★Agent 协议生态 2026 | 先学「Harness 解剖」 | UHP/MCP/A2A/ACP/AG-UI 边界与组合（protolab） |
| 工具调用 | 先学「推理 API 与流式输出」 | tool schema/JSON Schema 校验/参数循环 |
| RAG | 先学「推理 API 与流式输出」 | 切分/嵌入/检索/重排（ragsteps+纯 Python 小实现） |
| 微调入门 | 先学「后训练与对齐前沿」 | SFT/LoRA 原理与数据构造（真实脚本标环境要求） |
| Agent 核心 | 先学「工具调用」 | ReAct/规划/多 agent 分工/工具安全与沙箱/GUI agent 边界 |
| 评测 Harness | 先学「Agent 核心」 | 基准/打分器/给自家 agent 写回归评测 |

**主线 C · 实战与前沿追踪（学完就能开发）**

| 课程 | need | 说明 |
|---|---|---|
| 项目 1：本地 RAG 问答助手 | 先学「RAG」 | Ollama+纯标准库端到端 |
| 项目 2：CLI 工具型 Agent | 先学「工具调用」「Agent 核心」 | 真实工具循环跑通真实任务 |
| 项目 3：给自己的 Agent 写评测 | 先学「评测 Harness」 | 自建 eval harness+及格线 |
| 项目 4：DSH 扩展实战 | 先学「Harness 解剖」 | client-plugin/主题/看板，基于真实 DSH 插件项目 |
| 🧭 前沿追踪路线图 | 零基础可学，建议学完任一主线后读 | 读论文/复现/开源参与地图；"如何自己跟踪前沿"方法论；资料对照附录 |

**零基础怎么开始**：① 点侧边栏「📖 术语表」过一遍「LLM 入门」那类；② 学 🌱**LLM 零基础入门**
（6 讲：什么是大模型 → token 与上下文窗口 → 温度与采样 → 幻觉 → Ollama 装起来 → 4060 上跑通第一个模型）；
③ 再按三条主线顺序往后学。每门课页面顶部都写明「🎒 学这门课之前」。

**关于学习依赖**：每门课自足——正文零跨课指引、用到的数学就地讲清；前置关系只通过
每门课顶部的 `need` 声明 + 「学习路径」页展示（不设时间节点，只用顺序+前置+验收判据）。
`audit-prereqs.mjs` 会把每条 need 引用机器校验到站内真实课程。

---

## 3. 每一讲长什么样

1. **学习目标**：一句话说明学完能做到什么。
2. **核心讲解 / 类比 / 步骤**：先讲"为什么需要它、不用会怎样、代价是什么"，不停留在名词。
3. **代码示例**：可运行的 Python（纯标准库优先；需 torch/GPU 的块明确标注），带中文注释与语法高亮。
4. **手算演练**：给已知条件，自己先算，再点「显示答案」核对。
5. **🧪 交互实验**（全部纯浏览器计算，不依赖运行中的模型）：
   - `tokenlab`：BPE 合并逐步执行，文本 → token → id → 解码回验；
   - `attnlab`：Q/K/V 数值逐步算注意力矩阵与输出，权重热力显示；
   - `samplab`：真实 logits 上调 temperature / top-k / top-p 看分布与抽样；
   - `ragsteps`：切分 → 嵌入 → 检索 → 拼接 prompt 的分步演示；
   - `agenttrace`：ReAct 循环逐步回放 Thought / Action / Observation 与终止条件；
   - `protolab`：UHP / MCP / A2A / ACP / AG-UI 协议生态角色连线图；
   - 以上 6 类为 LLM 站专用；引擎共注册 **12 类**渲染器——另含通用 `datalab`（任意流水线分步演示）
     与 cs 站同款的 `pathlab` / `schedlab` / `cpulab` / `pagelab` / `arbitlab`（保留可用）。
6. **易错点**：把面试与工程里最常踩的坑先讲清楚。
7. **随堂测验 + 解析**：单选 / 多选 / 填空 / 排序四种题型，答错自动进错题本。

---

## 4. 进度、错题本与复习

与 cs 站同款引擎：左侧导航（真链接，可中键新开）、自动记录、错题本、智能复习、
数据导出导入、快捷键（`/` 搜索、`Ctrl/⌘ + Enter` 标记掌握、`Alt + ←/→` 切换讲次）、
「📄 报告」导出 Markdown 学习报告。

---

## 5. 项目结构

```
.
├── index.html                 # 入口（双击打开；按顺序加载全部数据与引擎）
├── start.cmd                  # 一键起本地服务器并打开浏览器（纯 ASCII）
├── README.md                  # 本文件
├── CONTENT-SPEC.md            # 课程内容格式契约 + LLM 站依赖规则（写新课程前必读）
├── MATH-FORMULAS.md           # KaTeX 公式写法规范（与 cs 站同一份规则）
├── app/
│   ├── app.css                # 全部样式（深色/浅色双主题、响应式）
│   ├── markdown.js            # 迷你 Markdown 渲染 + 语法高亮
│   ├── labs.js                # 交互实验组件（共 12 类渲染器，见 §3.5）
│   ├── quiz.js                # 测验渲染、判分、解析、归一化比对
│   ├── progress.js            # 进度 / 错题本 / 导入导出（localStorage 键 llm-learn:v1）
│   ├── glossary.js            # 术语表（LLM 五类起步集，随课程增补）
│   ├── mathrender.js          # KaTeX 渲染 + 纯 CSS 兜底
│   └── app.js                 # 路由、侧边栏、页面渲染、搜索、快捷键
├── data/                      # 课程内容（每门课一个文件）
├── vendor/katex/              # KaTeX 本体与字体（完全离线）
└── tools/                     # 质量门（见 §6）
```

---

## 6. 质量保障（八类命令，全绿才算交付）

```powershell
# 1) 内容校验：结构、答案索引范围、实验 config、est/goal/why
node tools/validate-curriculum.mjs

# 2) 依赖门之一：need 引用全部可解析到站内课程、零跨站（LLM 站新增）
node tools/audit-prereqs.mjs

# 3) 依赖门之二：正文零跨课指引、零隐性回指
node tools/audit-independence.mjs

# 4) 零基础友好度：术语首现就地解释
node tools/audit-zero-basis.mjs

# 5) 冒烟测试：Node 里模拟浏览器渲染全部路由 + 错题本全流程
node tools/smoke-test.mjs
node tools/smoke-test.mjs --fixture

# 6) 代码真实可运行：Python 块真实执行（纯标准库）
node tools/check-python.mjs

# 7) 数学公式体检：每段 $...$ 用 KaTeX 真渲染
node tools/audit-math.mjs
node tools/scan-formulas.mjs

# 8) 浏览器级验证：无头 Edge/Chrome 真实渲染并断言 DOM
powershell -NoProfile -ExecutionPolicy Bypass -File tools/verify-browser.ps1
```

---

## 7. 常见问题

**需要 GPU 吗？** 学习站本身零依赖、纯浏览器，不需要 GPU。课程里的动手环节分三档：
纯浏览器实验（不需要任何环境）、纯标准库 Python（只需要 Python）、
需要 Ollama 的本地模型环节（本机 RTX 4060 8GB 可跑量化 7B 模型；没有 NVIDIA 显卡也能用 CPU 跑小模型）。
微调/RL 脚本给出真实代码但标注「需 GPU/云」。

**能离线用吗？** 可以，本站不请求任何外部资源（无 CDN、无统计脚本），断网完整可用。
需要调用 Ollama 的实验会明确标注，且全部有「模型不在线」时的替代说明。

**进度会不会丢？** 数据存在浏览器 localStorage（键 `llm-learn:v1`），清理浏览器数据会丢；
重要进度请用「💾 数据」导出备份；通过本地服务器打开时还会同步到 `.progress/`。
