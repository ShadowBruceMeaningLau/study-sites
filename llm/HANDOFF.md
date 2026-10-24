# HANDOFF — LLM / Harness / Agent 学习站 · 完整交接文档

> **读这一份就够了。** 本文件自包含：不需要了解之前任何会话的历史。
> 上下文被压缩、或换新会话/新模型接手时，从 §1 顺序读。
>
> **★ 如果你接手的是「补全缺口」专项（安全门课 / UHP 事实修正 / DPO / 公开基准 / 分布式训练等），
> 请先读 `llm/HANDOFF-NEXT.md`** —— 那份是本次专项的作战地图（含任务清单、前沿素材、
> 执行陷阱、验收标准）。本文件仍是**写课程的规格与门禁权威**，两份配合使用。
>
> **★ 状态：站点主体已完工（2026-10-24 22:40）。** 24 门课 / 182 讲 / 162 实验 / 552 题，九道质量门 + 浏览器级验证全绿，五站集成完成并实测通过。
> 本文件保留了"继续开发"的完整流程（§7）与规格（§5）——若要新增课程、修 bug 或迁移，照那些节做即可。
>
> 最后更新：2026-10-25 00:05（UTC+8）——新增 HANDOFF-NEXT.md；修掉文档里 `protoplab` 笔误（真实名是 `protolab`）

---

## 1. 这个项目是什么

工作区 `D:\ObsidianLocalLib\system1\DSH\2` 里原有四个**完全独立、零依赖、纯静态、离线可用**的自学网站：

| 站点 | 主题 | 端口 |
|---|---|---|
| `cs/` | 计算机科学与技术（24 门课 / 169 讲） | 8123 |
| `math/` | 基础数学（23 门课） | 8124 |
| `physics/` | 物理学（26 门课） | 8125 |
| `philosophy/` | 哲学（17 门课） | 8126 |

**本项目目标**：新建**第五个**同类站点 `llm/`（端口 **8127**），主题 **LLM · Harness · Agent**，从**零基础**讲到 **2026 年 10 月前沿**，学完能自己动手开发。

**硬性要求**：`llm/` 与那四个站**完全独立**——自己的引擎副本、课程数据、验证工具、localStorage 键。删掉任意其它站，`llm/` 照跑；反之亦然。

---

## 2. 当前进度

> **★ 站点已完工（2026-10-24 22:36）。** 之下"还需完成"部分保留作为历史记录，实际全部已完成、八道门 + 浏览器级验证全绿。

**已建成 24 门课 / 182 讲 / 162 实验 / 552 题 / 约 109 学时、八道质量门全绿、浏览器级验证通过、五站集成完成。**

精确数字**必须实跑确认**（见 §7 第 1 步），不要信任何文档里的旧数字。

### 2.1 收尾轮修掉的四个真实缺陷（都在"门全绿"状态下才被发现，务必记住教训）

1. **★ 三门课没接线，浏览器端静默少三课。** `rag.js` / `project-cli-agent.js` / `project-dsh-extension.js` 文件写好了，但 `index.html` 里没有 `<script src>`。`validate-curriculum` 直接读磁盘算数据，**根本发现不了**；只有 `smoke-test`（模拟浏览器加载）暴露出来：报"课程数 = 20"而不是 23。**教训：新增课程文件后，`validate` 全绿不代表用户能看到它，必须跑 smoke-test 核对课程数。**
2. **`frontier-models` 的 term 标错主线。** 它被标成「主线 C」，但 ORDER 里排在第 8 位（主线 A 区间的中段）。后果是学习路径页显示成 A → C → B 的错序。已改回主线 A。
3. **`verify-browser.ps1` / `verify-dom.mjs` 硬编码了已删除的占位课路由。** 删掉 `_placeholder.js` 后这两个工具指向不存在的 `#/c/_placeholder`，导致浏览器验证报 3 项假失败。已改指 `python-basics-ai` / `py-1`。
4. **`verify-dom.mjs` 的异常检测是裸关键词匹配。** `/Uncaught|ReferenceError|TypeError/` 会把课程正文里"`'12' + 1` 会报 TypeError"这种**正常教学内容**判成未捕获异常。已改为要求堆栈形状（`Uncaught XXX` / `XXX: ` / `at fn (file:line:col)`）才判失败。

### 2.2 生成产物已移出版本库（`.gitignore`）

`llm/_demo.txt`、`llm/demo.txt`、`llm/data.json`、`llm/_steps.jsonl`、`llm/_state_demo/`、`llm/_audit/`、`llm/_eval/`、`llm/_kb/` 以及根目录同名散落文件，都是**课程代码块运行时写出来的**（不是输入样本）。之前有 5 个被误提交，每次跑 `check-python` 都产生无意义 diff。已从索引移除、加入 `.gitignore`，文件保留在磁盘上供课程继续生成。
**验证方法：移除后 `check-python` 依然 EXIT=0 —— 证明没有任何课程依赖它们的历史内容。**

---

## 3. 不可动摇的约定

| 项目 | 值 | 位置 |
|---|---|---|
| 站点目录 | `llm/` | 与 cs/math/physics/philosophy 同级 |
| 端口 | **8127** | `llm/tools/serve.mjs` 默认端口 |
| localStorage 键 | **`llm-learn:v1`** | `llm/app/progress.js` |
| 入口 | `llm/index.html` | 双击即可用；`file://` 亦可（KaTeX 本地化，公式正常） |
| 单站启动 | `llm/start.cmd` | 纯 ASCII |
| 五站同起 | 根目录 `start-all.cmd` / `start-tray.vbs` | 已集成 8127 |
| 引擎 | `llm/app/*.js` | 从 cs 复制的**独立副本**，不跨目录引用 |
| 课程数据 | `llm/data/*.js` | 每门课一个文件 |
| 课程顺序 | `llm/app/app.js` 顶部 `ORDER` | 23 个 id 已登记 |
| 课程主线 | `term` 三个合法值 | 见 §5.1 |

### 3.1 三条编码红线（每条都踩过坑）

1. **`.ps1` / `.cmd` 必须纯 ASCII。**
   PowerShell 5.1 读无 BOM 的 `.ps1` 时按系统 ANSI（CP936）解码，中文字节被读坏还会吞掉引号 → 语法错误；托盘/无头验证没有窗口，这种失败**完全静默**。中文界面文字放 `tools/tray-strings.json`。
   检查：字节里不应出现 >127 的值。

2. **数据文件 / 工具脚本必须 UTF-8 无 BOM；改它们只能用能控制编码的方式。**
   ❌ 不要用 `Get-Content` / `Set-Content -Encoding UTF8`——会**同时**造成加 BOM（`#!/usr/bin/env node` 开头直接语法错误）+ 中文乱码（CP936 不可逆）。
   ✅ 正确做法：
   ```powershell
   $p = 'data\xxx.js'
   $t = [System.IO.File]::ReadAllText((Resolve-Path $p), [System.Text.UTF8Encoding]::new($false))
   # ... 修改 $t ...
   [System.IO.File]::WriteAllText((Resolve-Path $p), $t, [System.Text.UTF8Encoding]::new($false))
   ```
   或直接用 `read` / `edit` / `write` 工具。

3. **数据文件里不要用反引号；`title` 与 `lesson.title` 禁英文双引号。**
   反引号（模板字符串 / Markdown 行内代码）触发 `validate` 警告 → 行内代码用中文引号 `「」`。
   英文双引号渲染成 `&quot;` 后，冒烟测试会报「课时页标题缺失」→ 用 `「」` 或 `“”`。

---

## 4. 课程清单与状态

### 4.1 全部完成（23 门，实跑核对：`validate` = 23 门 / 166 课 / 146 实验 / 504 题 / 约 109 学时）

主线 A（9 门）：`llm-zero-basics`(6) · `python-basics-ai`(6) · `ml-dl-basics`(6) · `neural-networks`(7) · `tokenizer-vocab`(7) · `attention-transformer`(10) · `pretraining-inference`(8) · `frontier-models`(11) · `posttraining-alignment`(9)

主线 B（9 门）：`prompt-engineering`(6) · `inference-api`(7) · `harness-anatomy`(9) · `agent-protocols-2026`(8) · `tool-calling`(7) · `rag`(8) · `finetuning-lora`(7) · `agent-core`(9) · `eval-harness`(7)

主线 C（5 门）：`project-rag`(6) · `project-cli-agent`(6) · `project-evals`(6) · `project-dsh-extension`(6) · `frontier-tracking`(4，终章)

### 4.2 收尾已完成（保留作历史记录）

| 项 | 结果 |
|---|---|
| `agent-core` 补 6 讲（ag-4~ag-9）| ✅ 9 讲齐全，含记忆/多 agent/权限/中断恢复/失败纠错/GUI agent |
| `eval-harness.js` 7 讲（`ev-`）| ✅ 已完成 |
| `project-evals.js` 6 讲（`pv-`）| ✅ 已完成 |
| `project-dsh-extension.js` 6 讲（`pd-`）| ✅ 由 Lead 亲手补 pd-4~pd-6（生命周期与钩子 / 怎么确认真被装载 / 打包与发布），基于真实插件项目 `lib/index.js`、`lib/client.js`、`cordis.patch.yml` 的逐文件阅读 |

### 4.3 收尾清单（全部已执行，供复查）

1. ✅ 删 `llm/data/_placeholder.js` + `index.html` 引用（ORDER 里本就没有它）
2. ✅ 清理 `_scratch_*` / `_blk_*` / `_tmp_*` / `_*_tail.txt`（0 个残留）
3. ✅ `llm/README.md` 已写"三条主线 23 门课"
4. ✅ 根 `README.md` 五站表 llm 行已更新为 23 门 / 163 讲（实跑数字见 §2）
5. ✅ `smoke-test.mjs` 门槛收口：`must` 列全 23 门主干、`labCount >= 130`、`qCount >= 450`
6. ✅ 五站同起实测：8123~8127 全部 HTTP 200；停服后 5 个端口全部释放
7. ✅ 最终 commit

### 4.4 验收用的完整命令序列（最后一遍全绿）

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
.\tools\verify-browser.ps1
```
期望：`VALIDATE=0`、`合计：23 门课 / 166 课 / 144 实验 / 504 题`、其余全部 EXIT=0、浏览器验证"全部通过"。

**新建课程后的接线**：在 `llm/index.html` 的 `data/*.js` 区块里加 `<script src="data/<id>.js"></script>`（**这是 Lead 的唯一工作，不要让子代理改 index.html**）。★ 加完必须跑 `smoke-test.mjs` 核对"课程数"——`validate` 发现不了漏接线（见 §2.1 缺陷 1）。

---

## 5. 写一门课的完整规格

### 5.1 课程文件骨架

```js
/* 文件头注释：课程名、定位、格式契约指向 CONTENT-SPEC.md */
window.COURSE_PACKS.push({
  id: "与文件名一致",
  title: "课程名",                  // 禁英文双引号
  icon: "🌱",
  term: "主线 A · LLM 基础与原理",
  hours: 30,                        // >= 8 的整数
  blurb: "一句话说清这门课解决什么问题（>=12 字）",
  tags: ["核心"],
  need: "建议先学「站内真实课名」；……",
  advanced: { texts: [...], labs: [...], project: "...", criteria: "..." 或 [...] },
  lessons: [ /* 见 5.2 */ ]
});
```

**`term` 只有三个合法值**（少一个字都算错误）：
```
"主线 A · LLM 基础与原理"
"主线 B · 工程与 Harness"
"主线 C · 实战与前沿追踪"
```

**`tags` 允许值**：`"零基础"` / `"前沿"` / `"前沿 2026"` / `"项目"` / `"核心"` / `"进阶"`

**`need` 只有两种合法写法**：
- `"零基础可学：……"`
- `"建议先学「课名A」「课名B」；……"` — `「」` 里必须是**站内真实课名**（否则 `audit-prereqs` 报悬空引用）；要强调请用 `“”` 而不是 `「」`

**`advanced` 四字段**：`texts`（非空字符串数组）、`labs`（非空字符串数组）、`project`（字符串）、`criteria`（字符串**或**字符串数组，数组渲染成清单）

### 5.2 每一讲

```js
{
  id: "<前缀>-1",
  title: "讲标题",             // 禁英文双引号
  goal: "一句话可检验的学习目标",
  est: 35,                     // 25~50 分钟
  blocks: [ /* 5~7 个 */ ],
  quiz: [ /* 3 题 */ ],
  checklist: [ "✅ ...", "✅ ...", "✅ ...", "✅ ..." ]   // 4 条
}
```

**每门课至少 1/3 的讲要带 `interactive` 块。**

### 5.3 block 类型

| type | 必填 | 说明 |
|---|---|---|
| `concept` | `title`, `md` | 核心讲解（Markdown：`**粗体**`、`- 列表`、`> 提示`、表格） |
| `analogy` | `title`, `md` | 生活类比，建立直觉 |
| `steps` | `title`, `items[]` | item 可为字符串或 `{t, d}` |
| `code` | `lang`, `title`, `code` | `lang ∈ {c, cpp, python, java, js, asm, sql, bash, text}` |
| `pitfall` | `title`, `items[]` | 易错点（>=2 条） |
| `calc` | `title`, `inputs[{name,value}]`, `outputs[]` | `value` 与 `outputs` 必须是**字符串** |
| `interactive` | `lab`, `title`, `config{}` | 见 5.5 |
| `lab` | `title`, `steps[]` | 上机任务（>=2 步） |

### 5.4 题目

```js
{ id:"<前缀>-1-q1", type:"single", q:"题干", options:["A","B","C","D"], answer:1, why:"为什么对 + 其余选项错在哪" }
{ id:"<前缀>-1-q2", type:"multi",  q:"...", options:[...], answer:[0,2], why:"..." }
{ id:"<前缀>-1-q3", type:"fill",   q:"____ 是什么", answer:["答案","别名"], why:"..." }
{ id:"<前缀>-1-q4", type:"order",  q:"...", items:[...], answer:[2,0,1], why:"..." }
```

`why` 必填 >=15 字，必须写清「**为什么对 + 干扰项错在哪**」。题目 id 前缀与课程一致，题干不可重复。

### 5.5 12 类交互实验的 config 契约

全部在 `llm/app/labs.js` 的 `RENDERERS` 注册。**注意名字是 `protolab`（少一个 p），不是 `protolab`。**

| lab | config |
|---|---|
| `datalab` | `{state:{...}, steps:[{desc, state:{键:值}, note}]}`，steps >=4，state 是对象 |
| `tokenlab` | `{text, merges:[[左,右]], vocab:{token:id}, steps:[{desc,tokens,ids,note}]}`，tokens 与 ids 等长 |
| `attnlab` | `{seq, d, Q, K, V, steps:[{desc,scores,weights,out,note}]}` |
| `samplab` | `{prompt, logits:[{token,logit}], temperature, topK, topP, seed, steps}` |
| `ragsteps` | `{query, docs:[{id,text}], chunkSize, qemb?, emb:{docId:[..]}, steps:[{desc,stage,data,note}]}`，`stage ∈ {chunk,embed,retrieve,prompt}` |
| `agenttrace` | `{task, steps:[{desc,kind,text,note}]}`，`kind ∈ {thought,action,observation,finish}`，**必须含 thought + action** |
| `protolab` | `{scenario, parties:[{name,role}], links:[{from,to,proto,desc}], steps:[{desc,note}]}`，**links 的 from/to 必须在 parties 里** |
| `pathlab`/`schedlab`/`cpulab`/`pagelab`/`arbitlab` | cs 站同款，一般用不到 |

### 5.6 内容质量要求（审计器会查）

1. **术语首现就地解释**：`术语（英文，就是指 + 大白话）` → 否则 `audit-zero-basis` 报「首现未解释」
2. **隔两讲以上再用要复述**：`KV cache（把每层键值缓存起来的显存）` → 否则报「后续仅使用」
3. **正文禁跨课指路**：不写 `见《某课》`、`去某站补`、`先学 torch 再回来`
4. **课内前向唯一合法写法**：`不熟的话，先看第 N 讲`（**带逗号**，指向同一门课）
5. **禁隐性回指**：不写 `前面讲过`、`如前所述`、`回忆上一课`
6. **数学就地讲清**：softmax / 梯度 / 矩阵乘在用到那句用大白话解释，配可手算例子
7. **禁词**：显然、易得、众所周知、不言而喻
8. **正文不写裸 URL**（放 `advanced.texts` 或附录）；**不写本机路径**（如 `D:\AI\study`）

### 5.7 ★实测数字的硬规矩（`CONTENT-SPEC.md §5.0`）

**不要把会漂移的绝对值写进课程正文。** 真实教训：`api-6` 的多轮词元数被三个人各测一组、互不相同（22→86→… / 19→73→… / 25→63→…），因为**每轮回答长度是模型随机生成的**，直接决定下一轮输入增量。

正确做法：
1. **写稳定的量**：增长趋势（每轮稳定增加约 55）、比例（外壳占 73.8%）、关系统计（累计约首轮 9 倍）
2. **必须写绝对值时把测量条件写全**：模型名与量化、固定系统提示、每轮同一句问题、max_tokens、是否含模板开销
3. **留可复现脚本**：`llm/tools/verify-*.py`（已有 `verify-token-growth.py`）
4. 说明是「一次实测」还是「多次实测的稳定区间」

---

### 5.8 剩余四门课的讲目（照这个写）

**`agent-core` 补 6 讲**（先 `Select-String -Path data\agent-core.js -Pattern 'id:\s*"ag-\d+"'` 确认现有 ag-1~3，再 edit 追加）：
- ag-4 记忆与上下文管理（滑动窗口 / 摘要 / 检索三策略；硬约束不参与压缩）
- ag-5 多 agent 协作（串联失败放大 0.95^5≈77.4% / 并行 Amdahl 加速 / 用 `protolab`）
- ag-6 沙箱与权限（文件/执行/网络三条边界；执行类会架空路径白名单）
- ag-7 中断恢复与人工确认（可恢复检查点 vs 强制确认点；幂等键）
- ag-8 失败与自我纠错（四种失败模式：空响应 / 参数乱填 / 打转 / 谎称完成；提示级 vs 结构级纠错）
- ag-9 浏览器与 GUI agent（感知/决策/验证三层，验证层最难；有 API 就别用 GUI）

**`eval-harness`（7 讲，前缀 `ev-`）**：ev-1 没有评测就没有进步 / ev-2 基准与数据集 / ev-3 打分器（精确匹配 / 相似度 / 模型当裁判）/ ev-4 回归评测与版本对比 / ev-5 长程任务怎么评 / ev-6 评测作弊与 Goodhart / ev-7 接进 CI 门禁

**`project-evals`（6 讲，前缀 `pv-`）**：pv-1 给自家 agent 定指标 / pv-2 造一组真实任务 / pv-3 打分器与一条命令出报告 / pv-4 跑回归与历史对比 / pv-5 评测作弊自查 / pv-6 做成 CI 门禁

**`project-dsh-extension`（6 讲，前缀 `pd-`）**：pd-1 扩展点在哪（插件/技能/工具/命令四个层次）/ pd-2 写最小插件 / pd-3 加自定义工具或技能 / pd-4 生命周期与钩子 / pd-5 调试（怎么确认真被装载）/ pd-6 打包与发布
> ★ `project-dsh-extension` 的样本是 `D:\DeepseekHarness\DeepseekHarness_Project\1.deepseek_harness本地访问`（真实插件项目：`package.json` 的 `dsh.bundle`/`dsh.client`、`lib/index.js`、`lib/client.js`、`cordis.patch.yml`）。**只写你亲自读到的事实，课程正文不得出现本机路径。**
## 6. 质量门（每次改完必跑，全部 exit=0 才算过）

### 6.1 八道门

```powershell
cd D:\ObsidianLocalLib\system1\DSH\2\llm
$o = node tools\validate-curriculum.mjs 2>&1; "VALIDATE=$LASTEXITCODE"; $o | Select-String '✗'
node tools\smoke-test.mjs              # Node 里模拟浏览器渲染全部课程页/课时页 + 错题本全流程
node tools\smoke-test.mjs --fixture    # 引擎隔离自测（需先 node tools\make-fixture.mjs）
node tools\audit-prereqs.mjs           # need 引用必须解析到站内真实课程
node tools\audit-independence.mjs      # 跨课指引 0 / 隐性回指 0
node tools\audit-zero-basis.mjs        # 术语首现就地解释（--all 看全部命中）
node tools\audit-math.mjs              # 每段 $...$ 用 KaTeX 真渲染
node tools\check-python.mjs            # Python 代码块真实执行（纯标准库）
```

### 6.2 浏览器级验证（改 UI 或新增 lab 后才需要）

```powershell
cd D:\ObsidianLocalLib\system1\DSH\2\llm
.\tools\verify-browser.ps1      # 环境里没有 pwsh，要用 .\ 直接执行；内部会调 verify-dom.mjs
```

### 6.3 ★最容易浪费时间的陷阱

`node xxx.mjs | Select-Object -Last 5` **会把退出码报成 1**（管道改了 `$LASTEXITCODE`）。必须：
```powershell
$o = node tools\validate-curriculum.mjs 2>&1; "EXIT=$LASTEXITCODE"; $o | Select-String '✗'
```

### 6.4 已知"软告警"（不是错误，可接受）

- `zero-basis` 的「首现未解释」集中在**非零基础课**（前沿专题、后训练、注意力细节），属方向性提示，不影响退出码 0。**工程类课程（inference-api / harness-anatomy / agent-protocols）已做到 0/0，新增工程课也应做到。**
- `interactive 偏少`：只在确实没实验块的讲上出现。

---

## 7. 接着干活：三步

### 第 1 步：确认真实状态（不要信本文件数字）

```powershell
cd D:\ObsidianLocalLib\system1\DSH\2\llm
node tools\validate-curriculum.mjs 2>&1 | Select-String '合计'
Get-ChildItem data\*.js | Sort-Object Name | ForEach-Object {
  $n = (Select-String -Path $_.FullName -Pattern 'id:\s*"([a-z]+[a-z0-9]*-\d+)"' -AllMatches).Count
  "{0,-30} {1,3} 讲  {2}" -f $_.Name, $n, $_.LastWriteTime.ToString('HH:mm')
}
git log --oneline -5
```

### 第 2 步：按 §4.2 补完剩余课程

**派子代理的实测结论**（省大量时间）：

- ✅ **新 spawn 的子代理可用**（换模型后 `subagent` 通道正常）
- ❌ **已结束的子代理无法唤醒**：`send_message` 报 `active teammate "..." not found`；durable teammate（`spawn_teammate`）能收到消息但绑的是旧 provider，**发过去没有任何反应**
- ❌ **团队名额上限 8 人**
- ✅ **有效做法**：**一次只让它写 2~3 讲**，明确要求「先落盘 → 跑门禁 → 报告」；**同一文件绝不派给两个人**
- ⚠️ 子代理可能整份重写已有文件。要它追加时明确写「用 edit 追加，不要 write 覆盖」
- ⚠️ `web_search` 可能不可用（402 Insufficient Balance），需要外部事实时用 `web_fetch` 直取官方文档

派发模板（替换 `<...>`）：
```
为 llm/ 新建 <文件名>.js（课程 <编号>《<课程名>》，前缀 <前缀>-）。
必读：llm/CONTENT-SPEC.md、llm/data/harness-anatomy.js 的 hx-3（同站质量基准）。
课程头：id/title/icon/term/hours/tags/need 按 AUTHOR-BRIEF 照用。
本次只写 <讲号1>、<讲号2>、<讲号3>（每讲 5~7 block / 3 题 / est 30~45 / 4 checklist / 有 goal，至少 1 讲带 interactive）。
硬要求：纯数据单条 push、禁函数/require/import/fetch/反引号、UTF-8 无 BOM、title 禁英文双引号、术语首现就地解释、正文禁跨课指路。
自检：node tools\validate-curriculum.mjs（本文件 0 报错）、check-python、audit-zero-basis、audit-prereqs。
交付：send_message 给 lead 报「已落盘 N 讲，VALIDATE=X」。不要动 index.html / app/* / tools/*。
```

### 第 3 步：按 §4.3 收尾，然后最终 commit

---

## 8. 本机环境事实（写"本机实测"时用）

| 项目 | 值 |
|---|---|
| GPU | NVIDIA GeForce RTX 4060 Laptop，8188 MiB 显存 |
| Ollama | 已装且守护进程在线：`http://127.0.0.1:11434`；已装 `qwen2:1.5b`、`mxbai-embed-large` |
| qwen2:1.5b 实测 | prefill 约 12k~24k 词元/秒；decode 约 63~125 词元/秒；首次加载 load_duration 约 1.4 秒 |
| Node | v24.19.0 |
| Python | 3.14.7，**无 numpy / torch / transformers**（课程代码必须纯标准库） |
| DSH 实现检出 | `D:\computersoftware\DSH\resources\app.asar\dsh\`（可只读浏览，用作真实样本） |
| DSH 插件项目 | `D:\DeepseekHarness\DeepseekHarness_Project\1.deepseek_harness本地访问` |
| 现成 AI 资料 | `D:\AI\study\`（01 入门 / 02 语言进阶 / 03 智能体平台 / 04 核心开发 / 05 EduRAG / 07 微调 / EduAgent） |

---

## 9. 已踩过的坑，别再踩

### 9.1 ★并发写入事故（已造成一次返工）
**现象**：多个并行子代理/会话同时写同一批 `data/*.js`，互相覆盖。`inference-api.js` 在 20 分钟内从 36993B → 40625B → 89776B → 90711B → 96133B，中间数字被三个人改成三组不同值。
**规则**：
1. 一个文件同一时刻只有一个写入者；派发时写清 `write_scopes`，同一文件**绝不**派给两人
2. 派发前查文件是否已存在、最近是否被改（`Get-ChildItem data\*.js | Where-Object { $_.LastWriteTime -gt (Get-Date).AddMinutes(-10) }`）
3. 接收交付**不要只信退出码**：先 `node --check`、再数讲号、再看关键数字是否还在，最后自己跑门禁
4. 两个会话都说完成同一门课时，以**文件当前内容**为准，逐段核对

### 9.2 `protolab` 是文档笔误
`CONTENT-SPEC.md §3` 曾写 `protolab`，但 `validate` 的 `LABS` 与 `app/labs.js` 的 `RENDERERS` 都是 **`protolab`**。照文档写会报 4 处错。**已修校验器 9 处。**

### 9.4 ★子代理失败的真正原因与可恢复性（本次会话实测，重要）

**结论：子代理"离线"不是连接坏了，是上下文/输出预算与并发冲突造成的。**

| 通知措辞 | 真实原因 | 可恢复 |
|---|---|---|
| `ran out of room before it finished` | 单次输出预算耗尽（写的文件太大，如一门 40KB 课） | ❌ 只能新开一个接手同一文件 |
| `failed before it finished. It left no closing message` | 运行期错误（工具异常 / 写冲突） | ❌ 该 session 已终结 |
| `finished and will do no further work` | 正常完成，只是 inactive | ⚠️ `send_message` 能发但**不保证**其 provider 可用 |

**实测证据**：
- 极小任务（2 次工具调用）的子代理**每次都成功**（如探测返回 `PROBE-ALIVE-1`）
- 大任务（写整门 40KB 课）的子代理**几乎必然 `ran out of room`**
- 早期 `spawn_teammate` 的 `course-author-N` 绑旧 provider（`deepseek-ai/*`、`dmodel`），发消息毫无反应

**有效做法（已验证）**：
1. **一次只让它写 2~3 讲**，明确要求「先落盘 → 跑门禁 → 报告」
2. **一个文件只派一个人**，派发时写清 `write_scopes`
3. 派发前查文件是否已存在、最近是否被改（见 §9.1 规则 2）
4. 接收交付**不要只信退出码**：先 `node --check`、数讲号、比对字节数、看关键数字是否还在
5. **git 是你的安全网**：给它一个基线提交，被覆盖就 `git checkout <commit> -- <file>` 恢复（本次真实用到：子代理用 3 讲版覆盖了 tool-calling 的 7 讲版，靠 `git checkout 12c6926 -- llm/data/tool-calling.js` 恢复）

**已发生的四次并发事故（记下来避免再犯）**：
- `agent-core.js`：两个子代理各写一套 ag-4~ag-9 → 24 条重复 id 报错
- `rag.js`：两个进程同时写
- `tool-calling.js`：子代理用 3 讲版**覆盖**了 7 讲完整版（43508B ← 86963B），已从 git 恢复
- **`project-dsh-extension.js`（2026-10-24 22:53，最新教训）**：Lead 写完 pd-4~pd-6 并提交（`f23642b`）**之后**，一个 22:10 开工的子代理才落盘，直接把 Lead 的 pd-4~pd-6 覆盖掉。它报告自己的版本「theme 与分工不符」，但那套主题正是 Lead 改过的最终决定。
  **裁决结果**：用 `git checkout HEAD -- <file>` 恢复 Lead 版，再吸收子代理版里确实更细的一处机制（注销凭证 disposer）合并。理由不是"谁写得更好"，而是一条可检验的内容标准：**子代理的 pd-4「加一个自定义工具：从声明到回填」与已有的 pd-3「加一个自定义工具或技能」主题重复**（同一个 agenttrace 实验、同样讲名字/描述/参数规格三件套、同样讲 harness 执行前校验）。两讲内容重叠是结构性缺陷，门禁查不出来。
  **★ 教训**：
  1. **提交之后要再确认一次文件没被改**：`git status --short` 必须为空才算真完工。Lead 提交时全绿，十几分钟后就被覆盖。
  2. **子代理的"我覆盖了别人的成果"预警要当停手信号**，不是等它自己判断。本例子代理发了预警但 15 分钟没等到回复就继续执行了——所以派发时必须写明「**未经 Lead 明确同意，不得覆盖任何已存在文件**」。
  3. **裁决看内容标准，不看门禁**：子代理版 `VALIDATE=0 / SMOKE=0 / PY=0` 也全绿，但它与 pd-3 内容重复、本课术语审计从 0/0 退到 1/2。门禁测不出"两讲讲同一件事"。

### 9.3 其它
- `_placeholder.js` 已删除（index.html 引用已清；ORDER 里本就没有它）
- `ORDER` 里 id 拼错会让课程**静默排到最后**——`validate` 现在有 ORDER 一致性检查能查出
- KaTeX 在 `vendor/katex/`（含 20 个字体），完全离线；若被删，`app/mathrender.js` 有纯 CSS 兜底
- `.gitignore` 里 `**/tools/fixture-data.js` 已加反向规则 `!` 救回（它是 `--fixture` 门禁的输入）

---

## 10. 相关文档索引

| 文件 | 作用 |
|---|---|
| `llm/CONTENT-SPEC.md` | **数据契约唯一权威**（§1 课程字段、§2 粒度、§3 lab config、§4 依赖红线、§5 外部资源、§5.0 实测数字规矩、§5.1 advanced） |
| `llm/AUTHOR-BRIEF.md` | 课程 10~23 的 id / 讲目 / 元信息速查 + 通用硬规则 |
| `llm/README.md` | 站点对外说明（三条主线、每讲结构、质量门清单） |
| `llm/MATH-FORMULAS.md` | KaTeX 公式写法规范 |
| `llm/tools/verify-token-growth.py` | 多轮词元增长的复现脚本 |
| `ZERO-BASIS-STANDARD.md`（根） | 零基础友好度四条硬标准 + 两条编码红线 |
| `OPTIMIZATION-REVIEW.md`（根） | 四个老站的体检报告（含 git init 建议，已落实） |
