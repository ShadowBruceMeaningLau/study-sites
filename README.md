# 五个独立的学习站：计算机（cs）+ 数学（math）+ 物理（physics）+ 哲学（philosophy）+ AI（llm）

工作区里有五个**完全独立、互不引用**的自学程序：各自有自己的入口、引擎、课程内容、启动脚本与验证工具，
学习进度分开存储（localStorage 五个不同的键），互不干扰。

```
.
├── start-tray.vbs       ← 【推荐】五个站起在系统托盘里：没有黑窗口，也不自动弹网页
├── start-all.cmd        ← 旧的命令行方式：留一个窗口，五个站一次起好（日志看得见）
├── cs/                  ← 计算机科学与技术：24 门课 / 169 讲 / 204 实验 / 677 题 / 约 84 万字
├── math/                ← 基础数学：23 门课 / 130 讲 / 176 实验 / 516 题 / 约 53 万字
├── physics/             ← 物理学：26 门课 / 143 讲 / 224 仿真实验 / 约 124 万字
├── philosophy/          ← 哲学：17 门课 / 85 讲（含单文件离线版）
├── llm/                 ← AI：LLM·Harness·Agent，29 门课 / 217 讲 / 197 实验 / 657 题（见 llm/README.md）
└── tools/serve-all.mjs  ← 五个站真正的服务实现（托盘和 start-all.cmd 都用它）
```

---

## 快速开始

| 想学什么 | 双击 | 打开的地址 |
|---|---|---|
| **五个都要（推荐）** | `start-tray.vbs` | 进托盘（**不开黑窗口、不自动开网页**）；右键图标打开 `8123`/`8124`/`8125`/`8126`/`8127` |
| 五个都要（想盯着日志） | `start-all.cmd` | `8123` 计算机、`8124` 数学、`8125` 物理、`8126` 哲学、`8127` AI |
| 只要计算机 | `cs\start.cmd` | `http://127.0.0.1:8123/cs/index.html` |
| 只要数学 | `math\start-math.cmd` | `http://127.0.0.1:8124/index.html` |
| 只要物理 | `physics\start-physics.cmd` | `http://127.0.0.1:8125/index.html` |
| 只要哲学 | `philosophy\start-philosophy.cmd` | `http://127.0.0.1:8126/index.html` |
| 只要 AI | `llm\start.cmd` | `http://127.0.0.1:8127/index.html` |

**用手机 / 平板看**：每个 `.cmd` 都会监听局域网并把手机能用的地址打印在窗口里
（手机需与本机连同一个 WiFi），手机和电脑共用同一份学习进度。
`start-all.cmd` 会**一次起五个服务**并在同一个窗口里把五个站的本机地址与手机地址全部列出来：

```
  计算机     本机  http://127.0.0.1:8123/index.html
             手机  http://192.168.0.107:8123/index.html   [WLAN]
  数学       本机  http://127.0.0.1:8124/index.html
             手机  http://192.168.0.107:8124/index.html   [WLAN]
  物理       本机  http://127.0.0.1:8125/index.html
             手机  http://192.168.0.107:8125/index.html   [WLAN]
  哲学       本机  http://127.0.0.1:8126/index.html
             手机  http://192.168.0.107:8126/index.html   [WLAN]
  AI         本机  http://127.0.0.1:8127/index.html
             手机  http://192.168.0.107:8127/index.html   [WLAN]
```

五个站**各自独立**：某个站端口被占用只影响它自己，其余四个照常运行。
关掉那个窗口（或 `Ctrl+C`）就停掉全部五个。

最省事的用法：**直接双击 `cs\index.html`、`math\index.html`、`physics\index.html`、`philosophy\index.html` 或 `llm\index.html`**。
五个站都是零依赖、纯静态，用 `file://` 打开即可完整使用（进度、错题本、交互实验、物理仿真全部正常）。

> 所有 `.cmd` 都刻意只写 ASCII 英文提示：cmd.exe 按字节解析批处理文件，中文等多字节字符
> 可能把命令行"撕开"（会报 `'evel' 不是内部或外部命令` 这类错误）。中文说明都在各自的 README 里。

---

## 托盘启动器（推荐）+ 开机自启

双击 **`start-tray.vbs`**：五个站起在系统托盘里，**没有黑窗口，也不自动打开网页**。
（`.vbs` 由 `wscript.exe` 启动，不创建控制台；若系统禁用了 VBScript，改用 `start-tray.cmd`，
它只会闪一下命令行窗口。）

**托盘图标怎么用**

| 操作 | 效果 |
|---|---|
| 双击图标 | 在浏览器里打开五个站 |
| 右键 → 状态行 | 实时显示 `5/5` 可用、哪几站没响应、是否由别的方式启动 |
| 右键 → 打开五个学习站 / 各站条目 | 逐站打开（没起来的站会灰掉并标注） |
| 右键 → 手机 / 平板 | 每站**第一条局域网地址**（真实网卡优先，WSL/VMware 之类排后面）点一下即打开；也能「复制全部手机地址」 |
| 右键 → 服务 | 启动 / 停止 / 重新启动；「仅本机访问」开关（关掉手机访问）；「查看运行日志」；以及「停止『其它方式启动』的服务」 |
| 右键 → 开机自动启动 | 见下 |
| 右键 → 退出 | 停止五个服务并关闭托盘（**不会留下孤儿 node 进程**） |

**开机自启（只起服务，不打开网页）**

菜单里勾上「开机自动启动」即可。它只写 **HKCU** 下的 Run 键（值名 `DSH-StudySites-Tray`），
不需要管理员权限，取消勾选就删除。登录后服务静默运行，只出现托盘图标，不弹浏览器。
想确认它到底注册了什么：

```powershell
Get-ItemProperty HKCU:\Software\Microsoft\Windows\CurrentVersion\Run -Name DSH-StudySites-Tray
```

**日志与自检**

- 服务输出（含五个站的本机 / 手机地址）在 `tools\logs\serve-all.log`，超过 1 MB 自动轮转为 `.log.1`。
- 一条命令自检整套链路（启动 → 探活 → 解析手机地址 → 停止 → 查残留）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\tray.ps1 -SelfTest
```

**占用与取舍**：常驻时托盘约 90 MB + node 服务约 57 MB（私有内存），合计约 150 MB —— 比一个浏览器标签页重。
不想常驻就用菜单「退出」，需要时再双击 `start-tray.vbs`。它是**单实例**的：已经在跑时再点一次只会打开五个站，
不会开出第二个托盘；也不会打开网页。

> **文件编码约定（改 `tools\tray.ps1` 前必读）**：`tray.ps1` 必须保持**纯 ASCII**，中文界面文字全放在
> `tools\tray-strings.json`（脚本用显式 UTF-8 读取，不依赖 BOM）。原因：PowerShell 5.1 读取**没有 BOM** 的
> `.ps1` 时会按系统 ANSI 码页解码，中文字节会被读坏、还会吞掉后面的引号 → 语法错误；而托盘没有窗口，
> 这种失败是**完全静默**的。想改菜单文字只改那个 json，不必碰代码。
> （`tools\verify-browser.ps1` 全 ASCII 是同一个道理，只是它选择了不带 BOM 保存。）

---

## 手机 / 平板怎么用（同一个 WiFi）

五个启动脚本**默认就打开了局域网访问**（内部给服务器加了 `--lan`），启动后窗口里会直接打印手机能打开的地址，形如：

```
  手机 / 平板（需与本机连同一个 WiFi）:
    http://192.168.0.107:8126/index.html   [WLAN]
```

在手机浏览器里输入这一行即可（**把 IP 换成你自己窗口里显示的那个**）。需要注意：

- **手机和电脑必须连同一个 WiFi**（同一个路由器；有些路由器开了"AP 隔离"会挡住，那就换个网络或用手机热点让电脑连上）。
- 窗口里每个站可能列**两条**局域网地址：第一条是 WiFi/网线（带 `[WLAN]` 之类的网卡名），
  第二条往往是 WSL / VMware 之类虚拟网卡的地址，**手机连不上，优先用第一条**。
- 第一次连接时 **Windows 防火墙可能弹窗询问**，选"允许访问"（专用网络即可）。若没弹窗且手机连不上，去"Windows 安全中心 → 防火墙和网络保护 → 允许应用通过防火墙"里放行 Node.js。
- **同一 WiFi 下的其他设备也能打开这个地址**，所以只在可信网络（家里/宿舍）里开；不用时关掉那个黑色窗口即可，关掉后谁访问不到。
- 只想要本机访问（更安全）：跑 `node tools\serve-all.mjs --local`（只监听 `127.0.0.1`），
  或直接双击 `index.html` 用 `file://` 打开。
- **进度是两端共用的**：通过启动脚本（本地服务器）打开时，进度会同步到电脑上 `<站点>\.progress\` 里的一个 json，
  手机和电脑看到的是同一份（详见下一节）。用 `file://` 直接双击网页文件打开时没有服务器，进度就只存在那台设备上。
- 顶栏右侧有个**状态点**：绿色「已同步」= 正在和电脑上的服务器同步；灰色「仅本机」= 没连上服务器或直接开了网页文件。点它可手动再同步一次。

---

## 学习进度是怎么同步的

| 你的打开方式 | 进度存在哪 | 手机 ↔ 电脑 |
|---|---|---|
| `start-all.cmd` / `cs\start.cmd` / `math\start-math.cmd`（本地服务器） | 电脑上 `<站点>\.progress\*.json` + 每台设备各留一份本地副本 | **自动合并成一份** |
| 直接双击 `index.html`（`file://`） | 只存在这台设备的浏览器里 | 不通（但功能完全一样） |

规则与边界：

- **打开页面时**：先把本地那份和服务器那份**按讲次/按题合并**（两边的记录都带时间戳，取较新的；计数取较大值，所以只增不减）。
  在手机上学 A 课、在电脑上学 B 课，合起来两边都全。
- **每次标记/答题**：先写本地（保证不丢），约 0.7 秒后推送到服务器；连续答题只推一次。
- **连不上服务器时**：静默退回纯本地，只把状态点变成灰色，**不弹错误、不影响学习**；等下次拿到服务器数据再合并后补推。
- **同一讲在两端同时学**：保留时间戳较新的那份记录（这是唯一的取舍）。
- **完全相同的一台电脑、不同浏览器**：仍然是两份本地数据，但都会同步到服务器，所以看到的进度是一致的。
- **想手动搬运或备份**：右上角「💾 数据」仍可导出/导入整份 JSON（这条通道一直保留）。
- 进度文件就在你自己电脑上，**不联网、不上传任何服务器**。也可以把 `.progress` 放进坚果云/OneDrive 目录，顺带获得跨网络同步。

---

## 三个站分别是什么

### `cs/` — 计算机科学与技术（本科培养方案）
**24 门课 / 169 讲 / 204 个交互实验 / 677 道题 / 约 84 万字**，侧重**系统与底层**与**考研 408**。

- **零基础起步**：🌱 零基础入门（电脑与第一个程序）+ 📖 术语表（78 条）+ 每门课的「学之前需要会什么」提示\n- 基础：程序设计基础（C 与 Python）、**面向对象程序设计（Java）**、**数字逻辑与数字电路**、高等数学与线性代数、离散数学
- 核心：数据结构、**数据结构专题（排序与查找 / 图论进阶与关键路径）**、算法设计与分析、计算机组成原理、
  操作系统、计算机网络、数据库系统原理、编译原理、计算机体系结构
- 拓展：软件工程、**信息安全**、**并行与分布式计算**、**计算理论（形式语言与自动机）**、人工智能与机器学习
- 冲刺与实践：考研 408 真题精讲、**408 考点强化训练**（Cache 地址划分 / 磁盘调度 / 滑动窗口 / PV 与银行家 /
  奈氏与香农 / 流水线与地址转换 六个薄弱考点的可交互训练）、系统能力实战项目
  （迷你 shell、内存分配器、调度模拟器、Cache 模拟器、TCP/HTTP 服务器、迷你语言解释器）

详见 `cs/README.md`。

### `math/` — 基础数学（数学系本科基础主干）
**23 门课 / 130 讲 / 176 个交互实验 / 516 道题 / 约 53 万字**。

- **零基础起步**：🔰 零基础数学入门（符号、逻辑与证明）+ 📖 术语表（57 条）+ 每门课的「学之前需要会什么」提示\n- 分析：数学分析（一/二/三）、实变函数与测度论、**泛函分析**、复变函数、**傅里叶分析**、常微分方程、**偏微分方程**
- 代数与几何：高等代数（一/二）、抽象代数、解析几何、**微分几何**、**拓扑学**
- 随机与计算：概率论、数理统计、**数值分析**
- 选修：初等数论、**组合数学与图论**、集合论与数学基础、**数学史与数学思想方法**

编排原则是 **直观 → 严格定义 → 证明 → 计算 → 反例**；渲染器支持 `$x^2$` 形式的公式上下标排版。

详见 `math/README.md`。

### `physics/` — 物理学（物理专业本科主干 + 考研强化）
**26 门课 / 143 讲 已全部交付**（W1–W7 完成，7 波增量、每波过完整质量门）—— 1282 个内容块 / 224 个交互仿真实验 / 749 题 /
1348 张闪卡 / 796 条公式 / 85 个仿真模型 / 13 个真实执行的 Python 代码块 / **约 123.9 万汉字**，
对物理专业课程表覆盖 **75/75 = 100%，且 75 项全部达"充分"标准**。
四大力学、数学物理方法、固体物理、核与粒子、天体宇宙、量子信息、计算物理、非线性混沌、广义相对论、
连续介质与流体、普通物理实验、近代物理实验、物理学史、考研普物强化、考研量子强化均已到齐。
`start-all.cmd` 已实测：**五个站**（本机地址与局域网地址各测一遍）都返回 HTTP 200，
关键资源（KaTeX、simlab 引擎、课程数据、阅读轨迹数据）全部本地可取；
再启动一次会明确报告五个端口都被占用而不是崩溃。
（最新数字见 `physics/README.md` 与 `node physics/tools/validate-curriculum.mjs` 的统计行。）

> **关于质量门的诚实说明**：物理站的**数值、结构契约、公式渲染、离线可用性**有真正的硬门禁兜底
> （独立审计员用自己的脚本复算 207/207 条数值全部一致）。
> 但**"零基础友好度"与"零回指"这两项只是分诊工具给出的方向性判断，不是已证明的合格**——
> 详见 `physics/README.md` 的「门禁的能力边界」一节。

- **零基础起步**：🌱 零基础物理入门（物理量、单位与量纲、量纲分析与数量级估算、图像读法、误差与不确定度）+ 📖 术语表（100+ 条）
- **普通物理五门**：力学、热学、电磁学、光学、原子物理
- **物理人的数学**：数学物理方法（一）（二）——**站内自足**，用到的数学就地讲清，不需要先去别的站
- **四大力学**：理论力学、电动力学、量子力学（一）（二）、热力学与统计物理
- **专业进阶**：固体物理、粒子物理与核物理导论、天体物理与宇宙学导论、计算物理、
  非线性动力学与混沌、广义相对论初步、量子信息与量子计算导论、连续介质与流体物理导论
- **实验与文化**：普通物理实验、近代物理实验、物理学史与思想方法
- **备考**：考研普通物理强化、考研量子力学强化（题型精讲 + 原创同型题，不逐字复制真题）

物理站独有的三样东西：

1. **`simlab` 数值仿真引擎**（`app/simlab.js` + `app/simlab-models-*.js`）——
   声明式 config 驱动（内容文件仍是纯数据、禁函数），引擎侧用 RK4 解微分方程并画成 SVG 曲线、
   相图与能量条；每个模型自带**物理不变量自检**（能量守恒、开普勒第三定律、共振峰位置、
   维恩位移定律……），由 `node physics/tools/verify-simlab.mjs` 逐条验算。
2. **`formula` 块 + 「📐 公式与常量」页** —— 每个公式强制四件套（公式 / 单位 / 成立条件 / 物理意义），
   自动汇总成速查表；另有 CODATA 常量表（含不确定度与量级参照）。
3. **`calc.verify` 数值门禁** —— 手算演练里的数值由 `verify-numbers.mjs` 用自写解析器独立重算，
   **数写错会直接让质量门失败**。

详见 `physics/README.md`。

---

## 互不干扰的保证

| 方面 | cs/ | math/ | physics/ | philosophy/ | llm/ |
|---|---|---|---|---|---|
| 入口 | `cs/index.html` | `math/index.html` | `physics/index.html` | `philosophy/index.html` | `llm/index.html` |
| 引擎 | `cs/app/*.js` | `math/app/*.js`（独立副本） | `physics/app/*.js`（独立副本；多 simlab/cards/constants） | `philosophy/app/*.js`（独立副本） | `llm/app/*.js`（独立副本；多六类 LLM 实验） |
| 课程数据 | `cs/data/*.js` | `math/data/*.js` | `physics/data/*.js` | `philosophy/data/*.js` | `llm/data/*.js` |
| localStorage 键 | `cs-learn:v1` | `math-learn:v1` | `physics-learn:v1` | `philosophy-learn:v1` | `llm-learn:v1` |
| 默认端口 | 8123 | 8124 | 8125 | 8126 | 8127 |
| 启动脚本 | `cs/start.cmd` | `math/start-math.cmd` | `physics/start-physics.cmd` | `philosophy/start-philosophy.cmd` | `llm/start.cmd` |
| 自带服务器 | `cs/tools/serve.mjs` | `math/tools/serve.mjs` | `physics/tools/serve.mjs` | `philosophy/tools/serve.mjs` | `llm/tools/serve.mjs` |
| 验证工具 | `cs/tools/*` | `math/tools/*` | `physics/tools/*` | `philosophy/tools/*` | `llm/tools/*` |

五个目录之间**没有任何跨目录引用**：删掉任意一个，其余仍能完整运行。
`tools/serve-all.mjs` 与 `start-all.cmd` 是工作区级的启动器（不属于任何一个站），
它只是把五个站各自的目录当根、各起一个端口——**每个站仍然只靠自己那份代码运行**。

---

## 质量保障（五个站各自独立跑）

```powershell
# 计算机站
cd cs
node tools\validate-curriculum.mjs
node tools\smoke-test.mjs
node tools\smoke-test.mjs --fixture
node tools\check-code.mjs
node tools\check-python.mjs
node tools\audit-math.mjs              # 公式体检：每段 $...$ 用 KaTeX 真渲染
node tools\content-fingerprint.mjs --check   # 确认内容只改了公式、没丢东西

# 数学站
cd math
node tools\validate-curriculum.mjs
node tools\smoke-test.mjs
node tools\smoke-test.mjs --fixture
node tools\check-python.mjs
node tools\audit-math.mjs
node tools\content-fingerprint.mjs --check

# 物理站
cd physics
node tools\validate-curriculum.mjs
node tools\verify-simlab.mjs            # 仿真模型的物理不变量自检（本站独有）
node tools\verify-simlab.mjs --list     # 看有哪些可用模型与参数
node tools\verify-numbers.mjs           # 所有 calc.verify 独立重算（本站独有的数值门禁）
node tools\smoke-test.mjs
node tools\smoke-test.mjs --fixture
node tools\check-python.mjs
node tools\audit-math.mjs
node tools\audit-zero-basis.mjs         # 零基础友好度
node tools\audit-independence.mjs       # 跨课/跨站指引应为 0
node tools\audit-content.mjs
node tools\coverage-check.mjs           # 对物理专业课程表逐项检索覆盖度

# 哲学站
cd philosophy
node tools\validate-curriculum.mjs
node tools\validate-reading.mjs         # 阅读轨迹（READING-PLAN-SPEC.md）
node tools\smoke-test.mjs
node tools\verify-truthtables.mjs

# AI 站（LLM·Harness·Agent）
cd llm
node tools\validate-curriculum.mjs
node tools\smoke-test.mjs
node tools\smoke-test.mjs --fixture
node tools\check-python.mjs
node tools\audit-prereqs.mjs            # need 引用可解析、零跨站（本站独有的依赖门）
node tools\audit-independence.mjs       # 正文零跨课指引、零隐性回指
node tools\audit-zero-basis.mjs         # 零基础友好度
node tools\audit-math.mjs
node tools\ollama-probe.mjs             # Ollama 在线则验 API 形状；离线自动跳过（非门禁）

# 托盘启动器（五站整条链路：启动 → 探活 → 解析手机地址 → 停止 → 查残留）
cd ..
powershell -NoProfile -ExecutionPolicy Bypass -File tools\tray.ps1 -SelfTest
```

浏览器级验证（无头 Edge/Chrome 真实渲染并断言 DOM）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File cs\tools\verify-browser.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File math\tools\verify-browser.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File physics\tools\verify-browser.ps1
```

---

## 常见问题

**端口被占用？** `start-all.cmd` 会明确告诉你是哪个站起不来（其余四个照常运行），
把占用的程序关掉即可；想换端口就用单站脚本，例如 `node physics\tools\serve.mjs 8127 --lan`。

**零基础怎么用？** ① 首页顶部「完全零基础？按这个顺序开始」→ 点「现在开始第 0 课」；
② 左侧「📖 术语表」可搜索，正文里的术语是**虚线下划线**，点一下弹出解释；
③ 每门课页面顶部写明「学这门课之前需要会什么」；④ 每讲末尾有「✅ 自检清单」可勾选；
⑤ 顶栏「📄 报告」可导出 Markdown 学习报告（进度、错题、自检、下一步建议）。
标准与检查方法见 `ZERO-BASIS-STANDARD.md`。
**每门课都是自足的**：不要求读者先去看别的课。已用 `node cs/tools/audit-independence.mjs`
扫描全部课程正文与课程级字段（need/blurb/进阶包），确认**没有任何跨课依赖**——仅存的"先看第 N 讲"
都指向同一门课内的更早讲次，属正常的前向指引。（数学站同理，其《数学史》课里的跨课指引是该课的设计意图。
物理站另有更严的要求：**连"去数学站补微积分"这类跨站指引也不允许**，用到的数学一律就地讲清，
检查命令是 `node physics/tools/audit-independence.mjs`——它会扫「指向别的站」「要求先学某门课」两类写法。）
**进度会丢吗？** 存在浏览器 localStorage，清理浏览器数据会丢；用页面右上角「💾 数据」导出 JSON 备份。

**能离线用吗？** 三个站都不请求任何外部资源（无 CDN、无统计脚本），断网完整可用。
数学与物理公式用 **KaTeX** 渲染，KaTeX 本体（含 20 个字体文件，约 520 KB）就放在各自的 `vendor/katex/` 目录里，
所以 `file://` 双击打开也能显示出版级公式；万一该目录被删，`app/mathrender.js` 里的纯 CSS 渲染器会自动兜底。
需要用新版本 KaTeX 时跑一次 `node tools/fetch-katex.mjs`（这一步需要联网，之后永久离线）。

**物理站的仿真需要装什么吗？** 什么都不用装。仿真就是站点里的一段 JavaScript：
用 RK4 解微分方程、把结果画成 SVG。没有 WebAssembly、没有第三方绘图库、不联网。