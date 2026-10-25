# llm/tools 索引（TOOLS-INDEX）

这个目录里的脚本按用途分 6 类。**它们的路径被门禁命令与文档硬编码引用**，
所以这里按分类说明，不移动文件——移动会破坏 `HANDOFF.md §6.1` 的命令与
`verify-browser.ps1` 里的相对路径（这个坑之前踩过）。

日常只需要记住：**每次改完内容，跑第 1 类里的 9 道门。**

---

## 1. 门禁（9 道，改任何内容后必跑，全部 EXIT=0 才算过）

| 脚本 | 查什么 |
|---|---|
| `validate-curriculum.mjs` | 结构契约：课程/讲/block/quiz 字段、id 唯一、lab config、est/goal/why |
| `smoke-test.mjs` | 用 Node 模拟浏览器渲染全部课程页与课时页；断言课程数、主干齐全、实验/题数门槛 |
| `smoke-test.mjs --fixture` | 引擎隔离自测（输入是 `fixture-data.js`） |
| `audit-prereqs.mjs` | `need` 里的「课名」必须解析到站内真实课程；**外加术语表 `where` 课名校验** |
| `audit-independence.mjs` | 正文零跨课指引、零隐性回指 |
| `audit-zero-basis.mjs` | 术语首现必须就地解释（`--all` 看全部命中） |
| `audit-math.mjs` | 每段 `$...$` 用 KaTeX 真渲染；查语法错、丢反斜杠、写错字段 |
| `check-python.mjs` | 全部 Python 代码块真实执行（纯标准库；依赖缺失/演示性失败单列） |
| `audit-quiz-bias.mjs` | 测验答案位置不能扎堆（任一位置 ≤40%） |
| `audit-ui-refs.mjs` | **UI 层**（`app/*.js`）引用的课程 id 必须真实存在 + ROADMAP 全覆盖 + 无跨站 id 残留 |

> `audit-ui-refs.mjs` 是 2026-10-25 新加的，补一个真实盲区：`validate` 直接读磁盘，
> **查不出 `app.js` 里引用了不存在的课程 id**。前科：`ROADMAP_AREAS` 整块残留了
> cs 站的 47 个课程 id，本站 0/47 命中，「能力路线图」实际是空壳，而当时所有门禁都是绿的。

## 2. 浏览器级验证（改 UI 或新增 lab 后才需要）

| 脚本 | 说明 |
|---|---|
| `verify-browser.ps1` | 用无头 Edge/Chrome 按 route 渲染并 dump DOM（含 `/roadmap`、新增课程路由）；**纯 ASCII，别写中文进去** |
| `verify-dom.mjs` | 消费上一步的 DOM 快照做断言（标题、实验、qcard、异常堆栈形状） |

## 3. 复现脚本（课程正文引用的「本机实测」都要能一键重跑）

| 脚本 | 复现什么 |
|---|---|
| `verify-frontier-feed.py` | 前沿信息源「活着检查」。**只把「拿到但条目为 0」判为故障；无网一律跳过**，所以能进 CI |
| `verify-token-growth.py` | 多轮对话词元增长（`api-6` 的数字） |
| `verify-tool-count.py` | 工具清单规模 vs 同族近义对选择准确率（`tool-8` 的结论，需本地 Ollama） |

## 4. 修复工具（出事时的急救，可反复运行、幂等）

| 脚本 | 修什么 |
|---|---|
| `fix-tex-escapes.mjs` | 公式体被 JS 吃掉首字母（`\frac` 变 `rac`）。用 `--dry` 先看 |
| `fix-escapes.mjs` | 同类反斜杠修复的补充 |
| `cjk-diff.mjs` | 中文文本差异比对（定位改写丢内容） |
| `content-fingerprint.mjs` | 与改写前快照对比，确认没丢内容（`--check`） |

## 5. 开发辅助（写内容时才用）

| 脚本 | 用途 |
|---|---|
| `make-fixture.mjs` | 从 `index.html` 生成 `fixture.html`（`--fixture` 门禁的一半） |
| `make-manifest.mjs` | 生成课程清单 |
| `scan-formulas.mjs` | 扫描公式写法问题 |
| `lesson-coverage.mjs` | 按文件统计「多少讲已有公式／总共多少讲」 |
| `python-syntax-report.mjs` | Python 代码块语法报告 |
| `fetch-katex.mjs` | 拉取 KaTeX 到 `vendor/`（只在重装环境时需要） |
| `math-demo.html` | 公式渲染自测页（`verify-browser.ps1` 会渲染它） |
| `ollama-probe.mjs` | 探测本机 Ollama 是否在线 |

## 6. 基础设施

| 文件 | 作用 |
|---|---|
| `serve.mjs` | 单站静态服务器（`llm/start.cmd` 用，端口 8127） |
| `fixture-data.js` | `--fixture` 门禁的**输入数据**（手写的极小课程，必须进版本库） |
| `fixture.html` | 上者生成的测试入口 |

---

## 注意：这些文件不在版本库里

`.gitignore` 已覆盖（都是可再生产物）：

- `**/tools/_dom/`（无头浏览器 DOM 快照）
- `**/tools/fixture.html`（`make-fixture.mjs` 生成；但 `fixture-data.js` 有反向规则保留）
- `**/tools/logs/`（托盘启动的服务日志，超 1 MB 自动轮转）
- `tools/_scratch_*.js`（一次性临时脚本）
