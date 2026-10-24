# HANDOFF：LLM/Harness/Agent 学习站开发状态（会话交接文档）

> **这份文件是给「上下文被压缩后的自己」看的。** 任何时候接手，先读完本文件，再读 `llm/AUTHOR-BRIEF.md`（课程清单）与 `llm/CONTENT-SPEC.md`（数据契约）。
> 最后更新：2026-10-24 20:55（UTC+8）

---

## 1. 一句话状态

第五站 `llm/` 已建成并可运行：**14 门课 / 103 讲 / 89 个交互实验 / 312 道题 / 约 66 学时**，八道质量门全绿，浏览器级验证通过，五站集成完成。**还差 9 门课**（课程 14~23，见 §4.2），以及最后的总验收（§6）。

---

## 2. 不可动摇的约定（改代码前必读）

| 项目 | 值 |
|---|---|
| 站点目录 | `llm/`（与 cs/math/physics/philosophy 同级、完全独立） |
| 端口 | 8127 |
| localStorage 键 | `llm-learn:v1` |
| 入口 | `llm/index.html`（双击可用，`file://` 亦可） |
| 启动 | `llm/start.cmd`（纯 ASCII）；五站同起：根目录 `start-all.cmd` / `start-tray.vbs` |
| 引擎 | `llm/app/*.js` 独立副本（app.js / markdown.js / labs.js / quiz.js / progress.js / glossary.js / mathrender.js / app.css） |
| 数据 | `llm/data/*.js`，每门课一个文件，**只有一条 `window.COURSE_PACKS.push({...})`** |
| 课程顺序 | `llm/app/app.js` 顶部 `ORDER` 数组（23 个 id，缺文件的会被 validate 提示） |
| term（主线） | 只有三个合法值：`主线 A · LLM 基础与原理` / `主线 B · 工程与 Harness` / `主线 C · 实战与前沿追踪` |

**三条编码红线（都踩过坑）**
1. `.ps1` / `.cmd` 必须**纯 ASCII**（PowerShell 5.1 按 ANSI 读无 BOM 的 .ps1，中文会撕坏语法）。中文放 `tools/tray-strings.json`。
2. 数据文件 / 工具脚本 **UTF-8 无 BOM**。**不要**用 PowerShell `Get-Content`/`Set-Content` 改这些文件（会加 BOM + 中文乱码）。要程序化改，用 `[System.IO.File]::ReadAllText($p,[System.Text.UTF8Encoding]::new($false))` + `WriteAllText(...)`。
3. 数据文件里**不要用反引号**（模板字符串 / Markdown 行内代码都会触发警告）。行内代码请用「」。

---

## 3. 现在的文件清单（`llm/data/`）

| 文件 | 讲数 | 状态 |
|---|---|---|
| `_placeholder.js` | 3 | **待删除**（W0 脚手架占位，正式交付前删掉，并删 index.html 里的引用与 app.js ORDER 里的 `_placeholder`） |
| `llm-zero-basics.js` | 6 | ✅ 完成《LLM 零基础入门》 |
| `python-basics-ai.js` | 6 | ✅ 完成《Python 编程基础（AI 方向）》 |
| `ml-dl-basics.js` | 6 | ✅ 完成《机器学习与深度学习基础》 |
| `neural-networks.js` | 7 | ✅ 完成《神经网络》 |
| `tokenizer-vocab.js` | 7 | ✅ 完成《Tokenizer 与词表》 |
| `attention-transformer.js` | 10 | ✅ 完成《注意力与 Transformer》 |
| `pretraining-inference.js` | 8 | ✅ 完成《预训练与推理》 |
| `frontier-models.js` | 11 | ✅ 完成《模型前沿专题（2026-10）》 |
| `posttraining-alignment.js` | 9 | ✅ 完成《后训练与对齐前沿》 |
| `prompt-engineering.js` | 6 | ✅ 完成《提示词工程》 |
| `inference-api.js` | 7 | ✅ 完成《推理 API 与流式输出》 |
| `harness-anatomy.js` | 9 | ✅ 完成《Harness 解剖》 |
| `agent-protocols-2026.js` | 8 | ✅ 完成《Agent 协议生态（2026-10）》（子代理写入，含 MCP 2026-07-28 / A2A v1.0 / ACP / AG-UI 1.0 事实） |

---

## 4. 还差什么（待办清单，按优先级）

### 4.1 已完成（无需再做）
- ✅ api-4~api-7 已拼接（含 SSE 分帧/半截 JSON/超时退避/token 计费/兼容层五讲）
- ✅ pt-9 已补（谄媚 / Goodhart 三层 / 安全与能力权衡，含数据污染手算）

### 4.2 还需新写的课程（9 门，按 AUTHOR-BRIEF §1 的 id 与讲目）
| # | id | 讲数 | 内容要点 |
|---|---|---|---|
| 14 | `tool-calling` | 7 | 工具 schema / JSON Schema 校验 / 多轮与并行 / 结果回填 / 出错兜底 / 安全 |
| 15 | `rag` | 8 | 切分 / 嵌入与余弦 / 检索 / 重排 / 拼提示与引用 / 评测 / 失败模式（用 `ragsteps` 实验） |
| 16 | `finetuning-lora` | 7 | 何时该微调 / SFT 数据 / 显存账 / LoRA / QLoRA / 合回与评测 / 选型 |
| 17 | `agent-core` | 9 | ReAct / 规划 / 记忆 / 多 agent / 沙箱 / 中断恢复 / 自纠 / GUI agent |
| 18 | `eval-harness` | 7 | 基准 / 数据集 / 打分器 / 回归 / 长程评测 / Goodhart / CI 门禁 |
| 19 | `project-rag` | 6 | 本地 RAG 项目（目标 / 资料 / 索引 / 检索 / 带引用问答 / 自评） |
| 20 | `project-cli-agent` | 6 | CLI agent 项目（目标 / 工具集与权限 / 循环 / 确认恢复 / 日志 / 打包） |
| 21 | `project-evals` | 6 | 给自己 agent 写评测（指标 / 任务集 / 打分器 / 回归 / 自查 / CI） |
| 22 | `project-dsh-extension` | 6 | DSH 扩展（插件 / 技能 / 工具 / 生命周期 / 打包）；以本机 DSH 实现为准 |
| 23 | `frontier-tracking` | 4 | 读论文 / 复现 / 参与开源 / 长期路线图（终章） |

> 注：14~18 是主线 B 收尾，19~23 是主线 C。全部 id 已在 `app/app.js` 的 ORDER 里登记，新建文件后只需在 `llm/index.html` 加一行 `<script src="data/<id>.js"></script>`。

### 4.3 收尾（W7）
- 删 `_placeholder.js`（及 index.html 引用、ORDER 里的 `_placeholder`）
- 清理所有 `llm/tools/_scratch_*`、`_blk_*`、`_api_tail.txt`、`_tmp_*` 临时文件
- `llm/README.md` 更新课程表与统计（当前写的是 23 门课，实际数与最终一致即可）
- 根 `README.md` 的五站表里 llm 一行更新统计
- 五站同起实测：`node tools/serve-all.mjs --local` 后 8123/8124/8125/8126/8127 全部 200
- 更新 `smoke-test.mjs` 的规模门槛到最终值（现在 `must` 只列了 2 门、`labCount>=4`、`qCount>=40`；收口时应改为 23 门主干齐全 + 实际规模下限）
- 最终 git commit

---

## 5. 写课程的规格速查（每门课照这个来）

```js
window.COURSE_PACKS.push({
  id: "<与文件名一致>", title: "...", icon: "🌱",
  term: "主线 A · LLM 基础与原理" | "主线 B · 工程与 Harness" | "主线 C · 实战与前沿追踪",
  hours: 30,                       // >= 8
  blurb: "一句话说明这门课解决什么问题（>=12 字）",
  tags: ["核心"],                  // 允许：零基础 / 前沿 / 前沿 2026 / 项目 / 核心 / 进阶
  need: "建议先学「<站内真实课名>」；……",   // 或 "零基础可学：……"
  advanced: { texts: [...], labs: [...], project: "...", criteria: "..." 或 [...] },
  lessons: [ /* 见下 */ ]
});
```

**每讲**：`{ id:"<前缀>-1", title, goal, est: 30~45, blocks:[5~7 个], quiz:[3 题], checklist:[4 条] }`
- 每门课 **至少 1/3 的讲带 `interactive`**
- `title` / `lesson.title` **禁止英文双引号**（用「」或“”）
- 每题必须有 `why`（≥15 字，写清「为什么对 + 干扰项错在哪」）
- 题 id 前缀必须与课程一致（如 `api-4-q1`）

**12 类 lab 的 config**（全部在 `llm/app/labs.js` 里注册）：
| lab | config |
|---|---|
| `datalab` | `{state:{...}, steps:[{desc, state:{键:值}, note}]}`，steps ≥4 |
| `tokenlab` | `{text, merges:[[左,右]], vocab:{token:id}, steps:[{desc,tokens,ids,note}]}`，tokens 与 ids 等长 |
| `attnlab` | `{seq, d, Q, K, V, steps:[{desc,scores,weights,out,note}]}` |
| `samplab` | `{prompt, logits:[{token,logit}], temperature, topK, topP, seed, steps}` |
| `ragsteps` | `{query, docs:[{id,text}], chunkSize, qemb?, emb:{docId:[..]}, steps:[{desc,stage,data,note}]}`，stage ∈ chunk/embed/retrieve/prompt |
| `agenttrace` | `{task, steps:[{desc,kind,text,note}]}`，kind ∈ thought/action/observation/finish，**必须含 thought+action** |
| `protolab` | `{scenario, parties:[{name,role}], links:[{from,to,proto,desc}], steps:[{desc,note}]}`，**links 的 from/to 必须在 parties 里** |
| 其它 5 类 | `pathlab` / `schedlab` / `cpulab` / `pagelab` / `arbitlab`（cs 站同款，一般用不到） |

---

## 6. 质量门（每次改完必跑，全部 exit=0 才算过）

```powershell
cd D:\ObsidianLocalLib\system1\DSH\2\llm
$o = node tools\validate-curriculum.mjs 2>&1; "VALIDATE=$LASTEXITCODE"; $o | Select-String '✗'
node tools\smoke-test.mjs          # 渲染全部课程页/课时页 + 错题本流程
node tools\smoke-test.mjs --fixture
node tools\audit-prereqs.mjs       # need 引用必须解析到站内真实课程
node tools\audit-independence.mjs  # 跨课指引 0 / 回指 0
node tools\audit-zero-basis.mjs    # 术语首现就地解释
node tools\audit-math.mjs          # 每段 $...$ 用 KaTeX 真渲染
node tools\check-python.mjs        # Python 块真实执行
```

浏览器级（改 UI/新增 lab 后才需要）：

```powershell
cd D:\ObsidianLocalLib\system1\DSH\2\llm
.\tools\verify-browser.ps1          # 注意：环境里没有 pwsh，要用 .\ 直接执行
```

> **关键陷阱**：PowerShell 里 `node xxx.mjs | Select-Object -Last 5` 会把退出码报成 1（管道改了 `$LASTEXITCODE`）。必须 `$o = node ... 2>&1; $LASTEXITCODE` 单独取。

### 门禁的已知"软告警"（不是错误，可接受）
- `zero-basis` 有若干「首现未解释」集中在**非零基础课**（前沿专题、后训练、注意力细节），属方向性提示，不影响 exit 0。
- `interactive 偏少` 类提示：只在确实没实验块的讲上出现。

---

## 7. 子代理/协作的实测结论（重要，省时间）

- **background subagent 无法续话**：结束后用 `send_message` 回「继续」会报 `active teammate ... not found`。只能**新 spawn** 一个接手同一文件（工作区文件就是持久记忆）。
- **durable teammate（spawn_teammate）也一样**：inactive 后无法唤醒；且团队名额上限 8。
- **写长课程的子代理容易零产出/被截断**：有效做法是**一次只让它写 2~3 讲**，且明确要求「先落盘、跑门禁、报告、等我回复继续」。
- **子代理有时会整份重写已有文件**（如 inference-api 被重写过一次，但新版更好：带本机实测数字）。让它重写前先明确「用 edit 追加，不要 write 覆盖」。
- **搜索不可用**（`web_search` 报 402 Insufficient Balance），需要外部事实时用 `web_fetch` 直取官方文档。

---

## 8. 本机环境事实（写"本机实测"时用）

| 项目 | 值 |
|---|---|
| GPU | NVIDIA GeForce RTX 4060 Laptop，8188 MiB 显存 |
| Ollama | 已安装且守护进程在线：`http://127.0.0.1:11434`；已装 `qwen2:1.5b`、`mxbai-embed-large` |
| qwen2:1.5b 实测 | prefill 约 12470~23692 词元/秒；decode 约 63~125 词元/秒；首次加载 load_duration 约 1.4 秒 |
| Node | v24.19.0 |
| Python | 3.14.7（**无 numpy / torch / transformers**；课程代码必须纯标准库） |
| DSH 实现检出 | `D:\computersoftware\DSH\resources\app.asar\dsh\`（可只读浏览，用作真实样本） |
| DSH 插件项目 | `D:\DeepseekHarness\DeepseekHarness_Project\1.deepseek_harness本地访问` |
| 现成 AI 资料 | `D:\AI\study\`（01 入门 / 02 语言进阶 / 03 智能体平台 / 04 核心开发 / 05 EduRAG / 07 微调 / EduAgent） |

> 课程正文里**不得出现本机路径**（CONTENT-SPEC §5），只能抽象表述。

---

## 9. Git 状态

分支 `main`。近期提交（新→旧）：

```
4336912 llm: inference-api（api-1~3 实测版）、harness-anatomy（9 讲）、glossary 扩到 78 条、tools 修 protolab 笔误
097dac0 llm: 补齐 nn-7、pre-7/pre-8、attn-7~attn-10（11 门课 / 78 讲 / 64 实验 / 237 题）
a66fafb llm: 课程 3-10 落盘（11 门课 / 71 讲 / 57 实验 / 215 题）+ 清理 63 个临时脚本
678f05c feat(llm): 补齐最后 3 个交互实验 ragsteps / agenttrace / protolab（12 类全实现）
35bdd69 feat(llm): W2 第 3 个交互实验 samplab（温度/top-k/top-p）+ 样式与校验
4c5fca9 llm: 课程顺序/term/引号三类新门禁 + 新课程接入首页
...
d183a43 chore: 四个学习站现状存档（llm 站开发前的基线）
```

---

## 10. 下一步怎么接手（3 步）

1. 读本文件 → 读 `llm/AUTHOR-BRIEF.md` §0 与 §1（课程清单表）。
2. 跑一遍 `llm/tools` 的门禁，确认当前真实状态（不要信本文件里的数字，以实跑为准）。
3. 按 §4 顺序推进：拼接 api 尾段 → 补 pt-9 → 写 9 门课（可用子代理，一次 2~3 讲）→ W7 收口。
