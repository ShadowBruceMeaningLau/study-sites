# 计算机科学与技术 · 本科互动学习站

一个**零依赖、离线可用**的本科 CS 自学程序：双击 `index.html` 就能在浏览器里按培养方案学习，
包含知识点精讲、可点运行的交互实验、随堂测验与错题本，学习进度自动保存在本地。

> 本目录与 `../math/`（基础数学学习站）**完全独立**：引擎、课程数据、验证工具、localStorage 键
> （本目录用 `cs-learn:v1`，数学站用 `math-learn:v1`）都不共享。想同时使用两个站，
> 双击工作区根目录的 `../start-all.cmd`。

> 面向：准备系统学习 / 复习计算机科学与技术本科课程的人（在校生、跨专业自学者、考研 408 备考者）。
> 侧重：**系统与底层**（计算机组成原理、操作系统、编译原理、体系结构）与**考研 408**。

---

## 1. 快速开始

### 方式 A：直接双击（最简单）
双击 `index.html`，用 Chrome / Edge / Firefox 打开即可。全部数据都在本地，不需要联网、不需要安装任何东西。

### 方式 B：本地服务器（推荐，剪贴板与 localStorage 更稳定）
双击本目录下的 `start.cmd`，会在 `http://127.0.0.1:8123/cs/index.html` 起本地服务器并自动打开浏览器
（优先用 Node 的 `tools/serve.mjs`，没有 Node 时回退到 `python -m http.server`）。关闭窗口即停止服务。

> 说明：`start.cmd` 内部刻意只写 ASCII 英文提示。原因是 cmd.exe 按字节解析 `.cmd` 文件，
> 括号块里的中文等多字节字符可能把命令行"撕开"（会出现 `'evel' 不是内部或外部命令` 这类报错）。
> 中文使用说明以本文件为准。
>
> 端口被占用时，可以指定其它端口：`node tools\serve.mjs 8124`

---

## 2. 学什么：课程地图

规模：**24 门课 / 169 讲 / 204 个可点运行的交互实验 / 677 道带解析的测验题 / 约 84 万字讲解**。

**每门课自足**：不依赖其它课程。数学课已重写为自足版（12 讲，从高中函数/数列/三角/不等式接起，微积分、线性代数、概率全部在课内讲完），并有 	ools/audit-independence.mjs 自动检查跨课依赖（当前 0 处）。

**零基础怎么开始**：① 点侧边栏「📖 术语表」过一遍「零基础」那类（14 条）；② 学 🌱**零基础入门：电脑与第一个程序**（6 讲：认识文件与路径 → 打开终端 → 装环境跑第一个程序 → 看懂报错 → 顺序/分支/循环 → 动手改对一个程序）；③ 再按培养方案顺序往后学。每门课页面顶部都写明「学这门课之前需要会什么」。

| 学期阶段 | 课程 | 说明 |
|---|---|---|
| 大一上 | 💻 程序设计基础（C 与 Python） | 从源码到可执行、指针与内存、调试、复杂度入门 |
| 大一下 | ☕ 面向对象程序设计（Java） | 类与对象、继承与多态（虚方法表）、接口与泛型、异常与集合、I/O 与并发、设计模式 |
| 大一上 | 📐 高等数学与线性代数（**自足版**） | 预备（函数/数列/三角/不等式）→ 极限 → 导数与泰勒 → 积分 → 级数与递推 → 向量与空间几何 → 矩阵 → 行列式 → 特征值与 SVD → 向量空间与最小二乘 → 概率统计 → 数学与计算机的连接 |
| 大一下 | 🔢 离散数学与数理逻辑 | 逻辑、证明、关系、图论、计数、数论与 RSA |
| 大二上 | 🔌 数字逻辑与数字电路 | 数制与布尔代数、卡诺图化简、组合逻辑（全加器/CLA）、触发器、时序电路设计、存储器与 FPGA |
| 大二上 | 🧱 数据结构 | 线性表→栈队列→串/KMP→树→堆/哈夫曼→图与哈希 |
| 大二上 | 🔤 数据结构专题：排序与查找 | 插入/希尔/快排/堆排/归并/基数/外部排序、折半查找与 B/B+ 树、散列 ASL |
| 大二下 | 🕸️ 数据结构专题：图论进阶与关键路径 | 存储与遍历、拓扑排序、关键路径（ve/vl/e/l）、网络流与二分图匹配 |
| 大二下 | ⚡ 算法设计与分析 | 分治、贪心、DP、图算法、字符串、NP 难与近似 |
| 大二下 | 🔧 计算机组成原理 | 数据表示、IEEE754、ALU、存储层次、Cache、流水线、总线与 I/O |
| 大三上 | 🖥️ 操作系统 | 进程线程、调度、同步互斥、内存与虚拟内存、文件系统、I/O |
| 大三上 | 🌐 计算机网络 | 分层、CRC、CSMA/CD、IP 与子网、路由、TCP、应用层与安全 |
| 大三上 | 🗄️ 数据库系统原理 | E-R、关系代数、SQL、范式、B+ 树索引、事务与并发、分布式 |
| 大三下 | 📦 软件工程 | 过程模型、设计与 SOLID、代码质量、测试、Git 协作、度量 |
| 大三下 | 🧪 编译原理 | 词法→语法（LL/LR）→语义与 IR→优化与代码生成 |
| 大三下 | 🔐 信息安全 | 访问控制、对称/非对称密码、TLS、Web 漏洞（注入/XSS/CSRF）、栈溢出、SDL 与应急响应 |
| 大三下/选修 | 🤖 计算理论：形式语言与自动机 | DFA/NFA 与最小化、泵引理、CFG 与 PDA、图灵机、可判定性、P vs NP |
| 大四上 | 🏗️ 计算机体系结构 | 定量设计、ILP 与乱序、存储层次、I/O、并行与一致性、DSA 前沿 |
| 大四上 | 🕹️ 并行与分布式计算 | Amdahl、锁与内存模型、GPU/SIMT、CAP 与共识（Raft）、MapReduce/Spark、集群工程 |
| 大四上 | 🤖 人工智能与机器学习 | 搜索、知识表示、评估、线性模型、树与集成、神经网络、伦理 |
| 大三下~大四 | 🎯 考研 408 真题精讲 | 四门高频题型的识别特征、解题步骤、陷阱与变式 |
| 大四上（冲刺） | 🏋️ 408 考点强化训练 | Cache 地址划分、磁盘调度、滑动窗口效率、PV 与银行家、奈氏与香农、流水线与地址转换 |
| 大三下~大四 | 🛠️ 系统能力实战项目 | 迷你 shell、内存分配器、调度模拟器、Cache 模拟器、TCP/HTTP、迷你语言解释器 |

课程内容全部是数据文件（`data/*.js`），可以自由增删改。

---

## 3. 每一讲长什么样

1. **学习目标**：一句话说明学完能做到什么。
2. **核心讲解 / 类比 / 步骤**：先讲"为什么需要它、不用会怎样、代价是什么"，不停留在名词。
3. **代码示例**：可编译运行的 C / Python / SQL / 汇编片段（带中文注释与语法高亮，可一键复制）。
4. **手算演练**：给已知条件，自己先算，再点「显示答案」核对。
5. **🧪 交互实验**：直接在页面上单步运行机制，共 6 类组件：
   - `寻路实验`：BFS 与 Dijkstra 在带权网格上的扩展顺序与路径差异；
   - `调度甘特图`：FCFS / SJF / SRTF / RR / 优先级 的 Gantt 图与平均周转时间对比；
   - `CPU 指令执行`：寄存器、内存、PC、栈的逐条指令快照（取指-译码-执行-访存-写回）；
   - `页面置换`：OPT / FIFO / LRU / CLOCK 的页框变化与缺页次数（可验证 Belady 异常）；
   - `位模式实验`：点击位翻转，实时给出原码/反码/补码/移码/IEEE754 解释；
   - `单步执行器`：任意算法的变量快照逐步演示（排序、DP 填表、KMP、B+ 树、梯度下降……）。
6. **易错点**：把考试与工程里最常踩的坑先讲清楚。
7. **随堂测验 + 解析**：单选 / 多选 / 填空 / 排序四种题型，答错自动进错题本，解析说明"为什么对 + 干扰项错在哪"。

---

## 4. 进度、错题本与复习

- **左侧导航**：点侧边栏任意条目即可切页（总览 / 培养方案路径 / 智能复习 / 错题本 / 每门课）。
  侧边栏条目是真正的链接（`<a href="#/...">`），所以**中键或 Ctrl+点击可在新标签打开**，
  键盘 `Tab` + `Enter` 也能操作；点进某门课后，该课会就地展开全部讲次。
- **自动记录**：进入一讲即标记"进行中"，测验与"标记已掌握"都会写入浏览器 localStorage。
- **错题本（📕）**：按错误次数排序，可一键跳到原课重做，也可导出 JSON。
- **智能复习（🔁）**：优先抽错题，其次抽正确率低的课，再补未测过的课，每次 8 题；答对自动移出错题本。
- **数据备份（💾 数据）**：导出/导入 JSON，换电脑或换浏览器时迁移进度；也可一键清空。
- **快捷键**：`/` 搜索，`Ctrl/⌘ + Enter` 标记本讲掌握，`Alt + ←/→` 上一讲/下一讲。

---

## 5. 项目结构

```
.
├── index.html                 # 入口（双击打开；按顺序加载全部数据与引擎）
├── start.cmd                  # 一键起本地服务器并打开浏览器（纯 ASCII，见 §1 说明）
├── README.md                  # 本文件
├── CONTENT-SPEC.md            # 课程内容格式契约（写新课程前必读）
├── app/
│   ├── app.css                # 全部样式（深色/浅色双主题、响应式）
│   ├── markdown.js            # 迷你 Markdown 渲染 + 语法高亮
│   ├── labs.js                # 6 类交互实验组件的实现与计算逻辑
│   ├── quiz.js                # 测验渲染、判分、解析、归一化比对
│   ├── progress.js            # 进度 / 错题本 / 导入导出（localStorage）
│   └── app.js                 # 路由、侧边栏、页面渲染、搜索、快捷键
├── data/                      # 课程内容（每门课一个文件）
│   ├── math-foundation.js  ├── discrete-math.js      ├── programming-basics.js
│   ├── data-structures.js  ├── algorithms.js         ├── computer-organization.js
│   ├── operating-systems.js├── computer-networks.js  ├── database-systems.js
│   ├── software-engineering.js ├── compilers.js      ├── computer-architecture.js
│   ├── ai-ml.js            ├── cs408-intensive.js    └── systems-practice.js
└── tools/
    ├── serve.mjs                 # 零依赖静态服务器（start.cmd 调用；也用 `node tools/serve.mjs` 手动起）
    ├── validate-curriculum.mjs   # 内容校验器（结构、答案、实验配置、统计）
    ├── smoke-test.mjs            # 无浏览器冒烟测试（模拟 DOM 渲染全部页面与实验）
    ├── audit-content.mjs         # 内容质量审计（讲解厚度、覆盖度、重复题）
    ├── check-code.mjs            # 把课程里的 C 代码块抽出来用 gcc 真实编译
    ├── check-python.mjs          # 把课程里的 Python 代码块抽出来真实执行
    ├── python-syntax-report.mjs  # Python 代码块语法体检（py_compile）
    ├── verify-browser.ps1        # 用无头 Edge/Chrome 真实渲染多条路由
    ├── verify-dom.mjs            # 断言上一步产出的 DOM 快照
    ├── make-fixture.mjs          # 生成"引擎隔离自测"入口 tools/fixture.html
    ├── fixture-data.js           # 隔离自测用的极小课程数据
    ├── make-manifest.mjs         # 生成只含已存在课程文件的入口（增量验证用）
    ├── apply-fixes.mjs           # 幂等的内容修正（IEEE754 位宽、平台差异说明）
    ├── repair-python-blocks.mjs  # Python 块缩进修复（以 py_compile 为唯一验收判据）
    ├── reindent_helper.py        # 用 Python tokenize 推导嵌套深度的辅助脚本
    ├── apply-python-fixes.mjs    # 把 python-fixes/*.py 的权威代码写回课程数据
    └── python-fixes/             # 权威修复源（每节的一处代码块对应一个 .py）
```

---

## 6. 质量保障（七类命令，全绿才算交付）

```powershell
# 1) 内容校验：结构完整性、id 唯一、答案索引范围、实验 config 合法性、解析是否敷衍
node tools/validate-curriculum.mjs

# 2) 冒烟测试：在 Node 里模拟浏览器渲染全部课程页与课时页，运行每个实验组件，
#    模拟"点击侧边栏切页"以及"答错 → 进错题本 → 复习 → 标记掌握 → 导出导入"的完整流程
node tools/smoke-test.mjs

# 3) 引擎隔离自测：用极小数据集验证渲染引擎本身（与内容对错解耦）
node tools/smoke-test.mjs --fixture

# 4) 代码真实可运行：C 代码块用 gcc 编译、Python 代码块真实执行
node tools/check-code.mjs
node tools/check-python.mjs

# 5) 浏览器级验证：无头 Edge/Chrome 真实渲染 11 条路由并断言 DOM
powershell -NoProfile -ExecutionPolicy Bypass -File tools/verify-browser.ps1

# 6) 内容质量审计：讲解厚度、主题覆盖度、跨课程重复题
node tools/audit-content.mjs

# 7) 数学公式体检：正文里每一段 $...$ 用 KaTeX 真渲染一遍，写错的公式会被列出来
node tools/audit-math.mjs
node tools/audit-math.mjs --render '\frac{a}{b}'   # 单独试一段 TeX 写法
node tools/scan-formulas.mjs                       # 找出"还在用纯文本写公式"的地方
node tools/content-fingerprint.mjs --check         # 与改写前快照对比，确认只改了公式、没丢内容
```

当前状态：1~5 全部通过（含 gcc 编译 35/35、Python 46 块 0 语法错误、
15 份浏览器 DOM 快照断言全绿）；第 6 条是给人看的报告，不是门禁。

> 已知非缺陷项：少数代码块故意演示异常或依赖 Linux（读 stdin、阻塞式 TCP 服务器、
> `selectors.EpollSelector`），在 Windows 上执行会非零退出，块内注释已注明。

---

## 6.5 数学公式怎么写的（KaTeX）

公式写在 `$...$` 里，由 **KaTeX** 渲染成出版级排版：

```js
md: "归并排序的递归式是 $T(n) = 2T(n/2) + O(n)$，解得 $T(n) = O(n \\log n)$。"
```

- **完全离线**：KaTeX 就在 `vendor/katex/`（约 520 KB，含 20 个字体文件），不联网、不用 CDN，
  双击 `index.html` 走 `file://` 也能正常显示。
- **双引擎兜底**：`vendor/katex/` 万一缺失，`app/mathrender.js` 里的纯 CSS TeX 子集渲染器会自动顶上。
- **不会误判**：正文里 shell 的 `echo $?`、SQL 的 `$1`、汇编的 `movl $60, %eax` 都不会被当成公式。
- **重新下载 KaTeX**：`node tools/fetch-katex.mjs`（仅这一步需要联网，之后永久离线）。
- **改写规范**：`MATH-FORMULAS.md`；自检页：浏览器打开 `tools/math-demo.html`。
- **改写工具链**（都在 `tools/` 下，零依赖）：
  `audit-math.mjs`（每段公式用 KaTeX 真渲染 + 五节错误检查）、`scan-formulas.mjs`（找还没改的纯文本公式）、
  `_lesson-coverage.mjs`（逐讲覆盖率）、`content-fingerprint.mjs`（结构零变化）、`cjk-diff.mjs`（中文正文守恒）、
  `fix-tex-escapes.mjs` / `fix-escapes.mjs` / `_fix-dbl.mjs` / `_fix-qprefix.mjs`（批量改写后的四类急救修复）、
  `apply-math-pairs.mjs`（唯一允许的批量写入工具：精确替换 + 语法与结构双校验，失败自动还原）。

---

## 7. 增删改课程内容

1. 阅读 `CONTENT-SPEC.md`（字段、block 类型、实验 config、题目格式、质量门槛）。
2. 新建 `data/<课程id>.js`，内容为一条 `window.COURSE_PACKS.push({ ... });`。
3. 在 `index.html` 的脚本列表里加一行 `<script src="data/<课程id>.js"></script>`。
4. 跑 `node tools/validate-curriculum.mjs` 与 `node tools/smoke-test.mjs` 修正问题。

想调整课程顺序？在 `app/app.js` 顶部的 `ORDER` 数组里改 id 顺序（未列出的课自动排在最后）。

---

## 8. 常见问题

**打开后一片空白？**
确认是通过 `index.html` 打开的（而不是单独的某个 js 文件），并且 `data/` 目录与 `index.html` 在同一层。
按 `F12` 打开控制台，正常会打印 `[CS 学习站] 已加载 N 门课程 / M 讲`。

**进度会不会丢？**
数据存在浏览器 localStorage 里：清理浏览器数据、换浏览器或换设备都会丢。重要进度请用「💾 数据」导出备份。

**能离线用吗？**
可以，本站不请求任何外部资源（无 CDN、无字体、无统计脚本），断网也能完整使用。

**实验里的数字是写死的吗？**
不是。寻路、调度、CPU 指令、页面置换、位模式、单步执行全部在前端实时计算，
例如页面置换的缺页次数是按你选的算法与页框数现算的，可以改 `data/*.js` 里的 `config` 换成自己的题目。
