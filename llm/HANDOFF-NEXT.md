# HANDOFF-NEXT — LLM 站「补全缺口」专项 · 全新会话交接书

> **给接手者的第一句话**：你不必读任何历史会话。读完本文件，照 §4 选一个子系统，照 §5 干活即可。
>
> 本文件专为「上下文被压缩」或「换新会话/新模型接手」而写。写作日期：2026-10-24。
> 项目主文档仍是 `llm/HANDOFF.md`（写课程规格、质量门、历史坑），本文件是**本次专项的作战地图**。

---

## 1. 一句话现状

`llm/` 站点已建成 **24 门课 / 182 讲 / 162 实验 / 552 题**，九道质量门全绿，浏览器级验证通过，五站（8123~8127）全部 HTTP 200。

**但严格审计后发现两类问题**，本专项就是修它们：

- **一类是事实错误**：站内说「UHP 规范截至 2026-10 未核到可引用原文」，而实际规范已于 **2026-10-19 完整发布**（15 章，Apache-2.0，有 conformance suite 与参考实现）。
- **一类是覆盖缺口**：安全对抗（提示注入/红队/供应链）**全站 0 处**；DPO、业界公开基准、分布式训练、梯度消失、子代理委派、查询改写等 7 个概念缺失或仅顺带提及。

---

## 2. 审计结论（已被人工复核，不要重新怀疑）

### 2.1 学习路径是平滑的

脚本校验过：23 门课的 `need` **全部可解析到站内真实课名，且全部向后指**（无悬挂、无前向依赖）。被依赖最多的是 `inference-api`（4 门）。

所以「不平滑」不是连线错了，而是**四处知识跳跃**：

1. `neural-networks` → `attention-transformer`：讲残差/LayerNorm 时，没讲它在对抗的梯度消失。
2. `pretraining-inference`：会算 6ND 与 scaling law，但完全不知多卡怎么协同。
3. `agent-core` → 安全：有沙箱/权限，但**零攻击面**知识。
4. `eval-harness`：会自建评测，但**看不懂任何公开榜单**。

### 2.2 前沿对接判定

| 维度 | 判定 | 依据 |
|---|---|---|
| 机制/架构 | **能** | DSA、MLA、稀疏/混合注意力、多 token 预测、原生多模态、投机解码、PagedAttention 全覆盖 |
| 后训练 | **部分** | RLHF/RLVR/GRPO/测试时计算有；**缺 DPO** |
| Harness/协议 | **能但有过期点** | 五协议齐全、亲手写工具服务器；UHP 事实错误待修 |
| 安全对抗 | **不能** | 零覆盖 |
| 评测 | **部分** | 方法论扎实；看不懂业界榜单 |
| 训练工程 | **不能** | 缺分布式、稳定性、梯度问题 |

### 2.3 ★ 可用的前沿素材（已实际抓取正文，可直接教学）

来源：`https://unifiedharnessprotocol.org/spec/2026-10-19/*`（**`web_fetch` 可正常访问；`web_search` 因 402 余额不足不可用，必须用 `web_fetch` 直取**）

| 章节 | 硬事实（可写进课程） |
|---|---|
| **Tasks** | 客户端可发 `Idempotency-Key`，服务端对重复键**不得**启动第二次执行；`max_step` / `timeout_seconds` 是预算，超预算必须报 **`incomplete`** 而非 `completed`；模型被替换时**必须**回报 `metadata.requested_model` + `model_fallback`；`tools` / `include` 是**保留并忽略**字段，且必须在 `metadata.ignored_fields` 里点名 |
| **Sessions** | 续会话靠 `previous_response_id`；同一 session 第二个并发任务必须拒绝 `409 session_busy`（"两个 agent 写同一工作目录不是有定义的状态"）；取消的状态是 **`cancelled` 而非 `failed`**（"客户端要求停止，不是遭遇错误"）；任务删除**不得**取消运行中的任务 |
| **Security** | **提示注入被明确划归客户端责任**。协议给四道可操作防线：① `disabledTools`（最小工具集 = 最小注入面）② `max_step` + `timeout_seconds`（有界任务不能被诱导成无界）③ 按信任级别拆不同 harness（读不可信输入的 harness 不应持有特权工具）④ 事件流可实时看到工具调用。**协议明文承认这不能使 agent 对不可信输入安全** |
| **Security** | 产物是"攻击者影响的內容"，必须 `X-Content-Type-Options: nosniff`，建议跨源提供；通过 artifact id 的**路径逃逸是实现里最可能的严重漏洞** |
| **Security** | 插件是第三方代码：stdio MCP server **必须跑在与 agent 相同的沙箱内、不得经 shell 启动**；只允许展开 `${PLUGIN_ROOT}` 与 `${PLUGIN_DATA}`，且仅在 `args`/`env`/`cwd`；导出包**必须省略** `auth` 与 `headers` |
| **Security** | 对象越权**必须返回 `404` 而非 `403`**（`403` 会确认 id 存在，正是枚举攻击者要的）；供应商凭证**不得**进沙箱；`error.message` 不得含凭证/主机名/路径/堆栈 |
| **Memories** | 记忆是**树 + 授权继承 + `restricted` 截断**；读回的记录 `trust` **恒为 `untrusted`**（"记忆返回的是数据，永不是指令"，必须与指令隔离并带上 `written_by`）；四个时机：prime（会话开始注入常驻记录）/ tools / observe / consolidate |
| **Plugins** | UHP plugin **就是** Agent Plugins 1.0.0 包：`plugin.json` + `mcp.json` + `skills/<name>/SKILL.md`；坏组件记进 `skipped` 而非整体拒绝（"包由别人写，一个过期条目不该拖垮整个插件"） |
| **Lifecycle** | 版本号形态是 `YYYY-MM-DD`；`GET /v1/uhp` 能力发现**无需鉴权**（客户端先要能判断"对面是不是 UHP"才能谈凭证）；`conformance_class` 三档 core/extended/full；能力**必须显式报 `false` 而不是省略** |

配套还有两份真实规范可引：**Agent Skills**（agentskills.io）、**Agent Plugins**（agent-plugins.org）。

---

## 3. 数据契约（写课程前必读）

**唯一权威**：`llm/CONTENT-SPEC.md`。要点复述：

```js
window.COURSE_PACKS.push({
  id: "与文件名一致",
  title: "课程名",                        // 禁英文双引号
  icon: "🛡️",
  term: "主线 A · LLM 基础与原理",         // 只有三个合法值，一字不差
  hours: 30,                             // >= 8 整数
  blurb: "一句话（>=12 字）",
  tags: ["核心"],                         // 零基础|前沿|前沿 2026|项目|核心|进阶
  need: "建议先学「站内真实课名」；……",      // 「」里必须是站内课名
  advanced: { texts: [...], labs: [...], project: "...", criteria: [...] },  // ★ 现已必填
  lessons: [ /* 见下 */ ]
});
```

每讲：

```js
{
  id: "<前缀>-1",
  title: "讲标题",          // 禁英文双引号
  goal: "一句话可检验目标",
  est: 35,                 // 25~50
  blocks: [ /* 5~7 个 */ ],
  quiz: [ /* 3 题，id 形如 <前缀>-1-q1 */ ],
  checklist: [ "✅ ...", "✅ ...", "✅ ...", "✅ ..." ]   // 4 条
}
```

**block 类型**：`concept`(title,md) / `analogy`(title,md) / `steps`(title,items[]) / `code`(lang,title,code) / `pitfall`(title,items[]) / `calc`(title,inputs[{name,value}],outputs[]) / `interactive`(lab,title,config) / `lab`(title,steps[])

**题目类型**：`single`(options,answer:number) / `multi`(options,answer:[..]) / `fill`(answer:[..]) / `order`(items,answer:[..])

### 3.1 ★ 交互实验的真实名称（文档里有笔误，以本表为准）

`labs.js` 的 RENDERERS 实际注册名，**共 12 类**：

```
pathlab schedlab cpulab pagelab arbitlab      ← cs 站同款，LLM 课一般不用
datalab tokenlab attnlab samplab ragsteps agenttrace protolab   ← LLM 用这 7 个
```

**名字是 `protolab`（少一个 p），不是 `protoplab`。** 文档 `CONTENT-SPEC.md` 旧版曾写成 `protoplab`，会导致 4 处校验错误。

config 契约（详细字段见 CONTENT-SPEC §3）：

| lab | 最少要求 |
|---|---|
| `datalab` | `{state:{...}, steps:[{desc,state:{},note}]}`，steps ≥4 |
| `tokenlab` | `{text, merges:[[左,右]], vocab:{token:id}, steps:[{desc,tokens,ids,note}]}`，tokens 与 ids 等长 |
| `attnlab` | `{seq, d, Q, K, V, steps:[{desc,scores,weights,out,note}]}` |
| `samplab` | `{prompt, logits:[{token,logit}], temperature, topK, topP, seed, steps}` |
| `ragsteps` | `{query, docs:[{id,text}], chunkSize, emb:{docId:[..]}, steps:[{desc,stage,data,note}]}`，stage ∈ chunk/embed/retrieve/prompt |
| `agenttrace` | `{task, steps:[{desc,kind,text,note}]}`，kind ∈ thought/action/observation/finish，**必须含 thought + action** |
| `protolab` | `{scenario, parties:[{name,role}], links:[{from,to,proto,desc}], steps:[{desc,note}]}`，**links 的 from/to 必须在 parties 里** |

---

## 4. 任务清单（选一个未完成的做）

| # | 子系统 | 文件 | 内容 | 状态 |
|---|---|---|---|---|
| 0 | 基础设施 | `HANDOFF-NEXT.md`、`CONTENT-SPEC.md` 笔误、基线提交 | 交接文档 + 修 `protoplab` | ✅ 已完成 |
| 1 | 事实修正 + 协议深化 | `data/agent-protocols-2026.js` | 修 L587/L1024 的 UHP 过期表述 + 改配套测验题 + **新增 proto-9 讲**（UHP 报文级契约） | ✅ 已完成 |
| 2 | ★ 安全门课（新建） | `data/agent-security.js` | 7 讲，前缀 `sec-`，见 §4.1 | ✅ 已完成 |
| 3 | 原理链补讲 | `neural-networks.js` + `pretraining-inference.js` | `nn-8` 梯度消失/爆炸与归一化；`pre-9` 分布式训练 | ✅ 已完成 |
| 4 | 前沿可用性 | `eval-harness.js` + `agent-core.js` | `ev-8` 业界公开基准与榜单解读；`ag-10` 子代理与任务委派 | ✅ 已完成 |
| 5 | 检索与工具 | `rag.js` + `tool-calling.js` | `rag-9` 检索进阶（查询改写/混合检索/GraphRAG/向量库选型）；`tool-8` 工具规模化 | ✅ 已完成 |
| 6 | 偏好微调 | `posttraining-alignment.js` + `finetuning-lora.js` | `pt-10` DPO 与偏好优化；`ft-8` 偏好微调上手 | ✅ 已完成 |
| 7 | 接线（**Lead 独占，绝不派发**） | `index.html` / `app/app.js` / `smoke-test.mjs` / `glossary.js` / README | 新课程接线、ORDER、门槛上调、术语补充、统计更新 | ✅ 已完成 |
| 8 | 最终验收 | — | 九道门 + 浏览器验证 + 专项验收 + 提交 | ✅ 已完成 |

### 4.1 子系统 2 的详细讲目（`agent-security`，前缀 `sec-`）

必读素材：§2.3 的 Security 与 Memories 两行。**只写你亲自核到的事实，不编造 CVE 编号、不编造攻击成功率数字。**

| 讲 | 标题 | 要讲到的硬内容 |
|---|---|---|
| sec-1 | 为什么 agent 的攻击面比模型大 | 它读不可信输入 + 执行工具 + 持有凭证，三件事叠加才叫攻击面；重灾区是「误会 + 组合」而非恶意（与本课体系 hx-8 呼应但**不复述那讲**） |
| sec-2 | 提示注入：数据与指令的边界 | 三种入口（网页/文档/工具返回）；为什么关键词过滤必然失效（模型无法可靠区分数据与指令是结构性的）；`disabledTools` = 最小注入面 |
| sec-3 | 工具与供应链：插件是第三方代码 | 插件作者 = 你信任了它；stdio server 必须同沙箱、禁经 shell；占位符只准展开两处；导出包必须剥掉凭证 |
| sec-4 | 产物即攻击面 | agent 写的文件名与内容都由攻击者影响；`nosniff` 与跨源的道理；**通过 id 的路径逃逸是最可能的严重漏洞** |
| sec-5 | 凭证与权限隔离 | 供应商凭证绝不进沙箱（agent 可以被诱导读环境变量并打印）；越权必须 `404` 不是 `403`；error.message 不得含路径/堆栈/主机名 |
| sec-6 | 红队测试：怎么系统找漏洞 | 造一组注入用例；把「该拒答的」与「该答对的」**并列报告**（只报拒答率会被"全拒答"刷满）；红队 ≠ 找 bug |
| sec-7 | 安全清单与边界的诚实 | 汇总可勾选清单（最小工具集/预算上限/按信任拆 harness/产物跨源/凭证隔离/日志脱敏）；**必须明说这些都不能使 agent 对不可信输入安全** |

- `need`: `"建议先学「Agent 核心」「Harness 解剖」；本课讲攻击面与防线，不需要安全背景。"`
- 至少 4 讲带 `interactive`（`agenttrace` 演注入轨迹 / `datalab` 演权限判定 / `protolab` 演信任边界）。

---

## 5. 干活流程（每波必须照做）

### 第 1 步：先确认基线干净

```powershell
cd D:\ObsidianLocalLib\system1\DSH\2
git status --short          # 应为空；不为空先看清楚是什么
git log --oneline -3
```

### 第 2 步：读规格（**不要跳过**）

- `llm/CONTENT-SPEC.md`（唯一权威）
- 要改的那门课的现有内容（读它，学它的风格）
- `llm/data/harness-anatomy.js` 的 hx-3（同站质量基准）

### 第 3 步：写内容

**追加用 `edit`，禁止用 `write` 整文件覆盖。** 一个文件同一时刻只能有一个写入者。

### 第 4 步：跑门（必须全 EXIT=0）

```powershell
cd D:\ObsidianLocalLib\system1\DSH\2\llm
$o = node tools\validate-curriculum.mjs 2>&1; "VALIDATE=$LASTEXITCODE"; $o | Select-String '✗|合计'
node tools\smoke-test.mjs
node tools\smoke-test.mjs --fixture
node tools\audit-prereqs.mjs
node tools\audit-independence.mjs
node tools\audit-zero-basis.mjs
node tools\audit-math.mjs
node tools\check-python.mjs
node tools\audit-quiz-bias.mjs
```

### 第 5 步：提交

```powershell
cd D:\ObsidianLocalLib\system1\DSH\2
git add -A llm
git commit -q -m "llm: <这次做了什么>"
git status --short   # 必须为空
```

---

## 6. ★ 编码红线（每条都踩过坑，违反会静默失败）

1. **数据文件中禁反引号**（模板字符串/行内代码）→ 行内代码用 `「」`。
2. **课程 `title` 与 `lesson.title` 禁英文双引号** → 用 `「」` 或 `“”`，否则冒烟测试报「标题缺失」。
3. **禁跨课指路**：不写「见《某课》」「去某站补」。课内前向唯一合法写法是「**不熟的话，先看第 N 讲**」（**逗号不能少**，审计正则按带逗号豁免）。
4. **禁隐性回指**：不写「前面讲过」「如前所述」「回忆上一课」。隔两讲以上复用概念要**括号复述**。
5. **术语首现就地解释**：`术语（英文，就是指 + 大白话）`。注意审计器只认「就是指」「意思是」「指的是」等标记，**写「就是」不认**（真实踩过）。
6. **禁词**：显然、易得、众所周知、不言而喻。
7. **正文禁裸 URL**（放 `advanced.texts`）；**禁本机路径**（`D:\...`）。
8. **数学就地讲清**：softmax/梯度/矩阵乘在用到的那句用大白话解释，配可手算例子。
9. **UTF-8 无 BOM**。`Set-Content -Encoding UTF8` 会加 BOM → 用 .NET `UTF8Encoding($false)` 或 read/edit/write 工具。
10. **`.ps1` / `.cmd` 必须纯 ASCII**。
11. **不要写会漂移的绝对值**（榜单分数、协议实现数量、模型跑分）。写机制、判据、趋势；必须写绝对值时把测量条件写全。参见 CONTENT-SPEC §5.0。

---

## 7. ★ 执行陷阱（我自己踩过的，别重复）

### 7.1 退出码陷阱

```powershell
# ❌ 错：管道会把 $LASTEXITCODE 改成 1
node tools\validate-curriculum.mjs | Select-Object -Last 5

# ✅ 对：先存变量
$o = node tools\validate-curriculum.mjs 2>&1; "EXIT=$LASTEXITCODE"; $o | Select-String '✗'
```

### 7.2 PowerShell 内联 node -e 遇正则/引号会崩

不要写 `node -e "..."` 里面带正则或嵌套引号（PowerShell 会先解析一遍，报一堆 `缺少 )`）。**写到 `.mjs` 文件里再跑**。

### 7.3 并发覆盖事故（已发生 6 次）

- `agent-core.js`：两个子代理各写一套 ag-4~ag-9 → 24 条重复 id
- `rag.js`：两进程同写
- `tool-calling.js`：子代理用 3 讲版**覆盖**了 7 讲版（43508B ← 86963B）
- `project-dsh-extension.js`：**Lead 提交后**子代理才落盘，覆盖了已提交版本
- `agent-security.js`（2026-10-25）：Lead 写好 7 讲并提交后，子代理拿到的派发前提是「全新文件」，它读到已存在版本后**主动止步**没覆盖——这是正确处置，但说明**派发时的文件状态快照会过期**
- `finetuning-lora.js`（2026-10-25）：Lead 与子代理**同时**追加 ft-8，导致同一 `id: "ft-8"` 出现两次；靠比对内容保留更完整的一版、手工裁掉重复块收场。`posttraining-alignment.js` 的 pt-10 同样出现过双份

**规则**：① 一个文件只派一个人；② 派发时写明「未经 Lead 明确同意，不得覆盖任何已存在文件」；③ 接收交付不要只信退出码，先 `node --check`、再数讲号、比对字节数；④ **提交后再查一次 `git status --short` 是否为空**。

### 7.4 ★ 直觉写下的「因果」必须被实测验证（本轮最重要教训）

`tool-8` 初稿写过一句「工具从 5 个到 50 个，选择准确率明显下降」。这句话听起来合理，但**是错的**。

两次独立实测（qwen2:1.5b、温度 0、同一组问题、只改工具清单规模）结论一致：

| 工具清单 | 选对数 |
|---|---|
| 5 个基础工具 | 5/5 |
| 5 + 15 个**无关**工具 = 20 个 | **5/5**（数量本身零下降） |
| 5 + 5 个**同族近义** = 10 个 | 4/5 |
| 5 + 同族 + 无关 = 25 个 | 3/5，错选全落在同族邻居之间 |

**真正的因果是「同族近义互相干扰」，不是「数量变多」。** 数量只带来清单开销（那是另一笔账：词元占比），不带来准确率下降。

处置：正文改为有实测支撑的说法，并补 `tools/verify-tool-count.py` 复现脚本（与 `verify-token-growth.py` 同一套规矩）。

**规则**：
1. 写任何「A 导致 B」的因果之前，先问「我怎么验证它」；验不了就不写因果，只写现象。
2. 实测必须写明条件（模型、温度、固定了什么、只变了什么），并区分「一次实测」与「多次实测一致」。
3. 留可复现脚本，让别人能一键重跑。
4. 反过来也要做：**不要轻易相信别人（包括子代理）报来的实测数字**，自己复跑一遍再写进正文。

### 7.5 文本锚点插入极脆弱

`glossary.js` 是 CRLF + 超长单行，我用正则锚点插入连续失败 3 次（换行被吃、逗号错位、闭合括号被替换）。
**正确做法**：脚本里 load 旧数据 → 内存合并 → 整份重新序列化写回。

### 7.6 子代理额度

**一次只让它写 2~3 讲**，并要求「先落盘 → 跑门 → 报告」。让它写整门 40KB 课**必然** `ran out of room`。

### 7.7 `validate` 查不出「课程没接线」

`validate` 直接读磁盘算数据，**发现不了** `index.html` 里漏了 `<script src>`。只有 `smoke-test`（模拟浏览器加载）会暴露——判据是它报的「课程数」对不对。已有前科：三门课曾静默不显示。

---

## 8. 最终验收标准

```powershell
cd D:\ObsidianLocalLib\system1\DSH\2\llm
$o = node tools\validate-curriculum.mjs 2>&1; "VALIDATE=$LASTEXITCODE"; $o | Select-String '合计|✗'
# 期望：24 门课 / 182 讲 / 162 实验 / 552 题
# 其余八道门全部 EXIT=0
.\tools\verify-browser.ps1    # 期望「浏览器级验证全部通过」
```

**专项验收（这四条是本次特有的，普通门查不出）**：

1. `smoke-test` 报「课程数 = 24」（证明新课程**真被浏览器加载**了，不是只躺在磁盘上）。
2. 学习路径页按 A → B → C 顺序显示（不是 A → C → B）。
3. `node tools/audit-quiz-bias.mjs` 通过（新题会引入新的答案位置偏置，任一位置不得超过 40%）。
4. 人工复核 `agent-protocols-2026.js` 里**不再有**「未核到可引用规范原文」这类过期表述。

---

## 9. 已完成的工作（不要重做）

| 项 | 结果 |
|---|---|
| 测验位置偏置修复 | 78.4% → 26.9/25.9/21.9/25.3，确定性重排 + `why` 字母同步重映射 + 新增 `audit-quiz-bias.mjs` 第九道门 |
| `attention-transformer` 缺 `advanced` | 已补齐；校验器改为**必填** |
| 术语表 | 78 → 108 条，7 → 11 分类，覆盖 23/23 门课，去 3 处重复 |
| `frontier-models` 主线标错 | 已归回主线 A（原标 C 导致路径显示 A→C→B） |
| 三门课未接线 | `rag` / `project-cli-agent` / `project-dsh-extension` 已补 `<script>` |
| 生成产物入库 | `_demo.txt`/`demo.txt`/`data.json`/`_audit/`/`_eval/`/`_kb/`/`_state_demo/` 已移出版本库并加 `.gitignore` |
| 占位课 | `_placeholder.js` 已删除 |
| `tool-8` 未验证断言 | 已用两次独立实测替换（数量不降准确率、同族近义才降），附 `tools/verify-tool-count.py` |
| `pre-9` 缺 code 块 | 已把 steps 块换成可运行 python（三本账实算 112 / 56 / 7.0 / 24.5 GB） |
| `nn-8` 中文引号致 python 报错 | 已改单引号；`check-python` 105 块 0 语法错误 |
| `agent-security` 缺规范字面量 | 已补 `disabledTools` / `max_step` / `timeout_seconds` / 两个占位符 / `X-Content-Type-Options: nosniff` / 「收窄安全，放宽即越权」；并给 sec-3、sec-4 补了交互实验 |
| `agent-security` 隐性回指 | 6 处「上一讲/下一讲/前面几讲」已改为就地表述（审计器正则会漏掉这类，要人工查） |

---

## 10. 文档索引

| 文件 | 作用 |
|---|---|
| `llm/HANDOFF.md` | **项目主文档**：23 门课清单、写课规格、质量门、历史坑、本机环境事实 |
| `llm/HANDOFF-NEXT.md` | **本文件**：本次专项作战地图 |
| `llm/CONTENT-SPEC.md` | 数据契约唯一权威 |
| `llm/AUTHOR-BRIEF.md` | 各课 id/讲目/元信息速查 |
| `llm/MATH-FORMULAS.md` | KaTeX 写法规范 |
| `llm/README.md` | 站点对外说明 |

**本机环境事实**（写「本机实测」时用）：RTX 4060 Laptop 8GB；Ollama 在线 `127.0.0.1:11434`，已装 `qwen2:1.5b`、`mxbai-embed-large`；Node v24；Python 3.14 **无 numpy/torch**（课程代码必须纯标准库）；五站端口 8123~8127。
