# 优化审查报告（2026-10-07）

对工作区里的四个学习站做了一次完整体检：**先把所有质量门实跑一遍**，再用无头 Edge + V8
对可疑热点做**真实测量**，最后把一条性能结论做成了**已验证的替换实现**。

结论先行：**内容与质量门禁的状态非常好**（下面第 1 节，全部实跑通过，没有一条失败）；
真正值得动手的只有 **3 件事**，其中 1 件是实测出来的真性能热点，另外 2 件是工程卫生。

---

## 0. 我做了什么（可复现）

| 项目 | 方法 |
|---|---|
| 结构/内容一致性 | 实跑四站 `validate-curriculum.mjs` |
| 四站全部质量门 | 实跑 `smoke-test`（含 `--fixture`）、`check-code`、`check-python`、`audit-math`、`content-fingerprint --check`、`verify-simlab`、`verify-numbers`、`audit-zero-basis`、`audit-independence`、`audit-content`、`coverage-check`、`audit-constants`、`validate-reading`、`verify-truthtables` |
| 浏览器级 | 实跑 `cs/tools/verify-browser.ps1`（无头 Edge 渲染 16 条路由 + DOM 断言） |
| 启动 CPU | 用 `vm` 逐文件加载每个站 <ins>真实的</ins> 全部 `<script src>`，测 V8 解析+执行 |
| 渲染热点 | 把各站 `app.js` 里**真实的** `linkTermsInHtml` 抽出来，喂真实课程内容逐块跑 |
| 体积 | 逐目录统计文件数与字节数 |
| 服务启动 | 实测 `serve-all.mjs` 冷启动到返回 HTTP 200 的耗时 |

> 测量脚本是临时的，跑完已删除；唯一保留的是第 2 节那条结论的**复核工具**：
> `tools/termlink-equivalence.mjs`（`node tools/termlink-equivalence.mjs`）。

---

## 1. 好消息：质量门禁全绿（实跑，非引用 README）

| 站点 | 实跑结果 |
|---|---|
| cs | 校验 ✓ · 冒烟 ✓ · fixture ✓ · check-code ✓ · check-python ✓ · audit-math ✓ · 指纹 ✓ · **浏览器级 DOM 断言全绿** |
| math | 校验 ✓ · 独立性审计 ✓ |
| physics | 校验 ✓ · **798 条仿真自检全过** · **207 个 calc.verify 数值独立重算全过** · 零基础/独立性（跨课指引 0 处）/内容/覆盖度/常量自洽 ✓ |
| philosophy | 校验 ✓ · 阅读轨迹 ✓ · 真值表 ✓ · 零基础 ✓ · 覆盖度 ✓ |

几处细节说明这份"绿"是可信的，而不是宽松：

- `content-fingerprint --check` 明确区分**结构（硬门，退出码 1）**与**字数（提示）**；
- physics 的数值门是**独立重算**（自写解析器），不是自比对；
- 我抽查了 `cs` 的浏览器级验证：KaTeX 本地字体加载、公式渲染失败数 0、`$` 误判用例
  （`echo $?` / `Outer$1.class`）都真的在断言里。

**顺带澄清三个我原以为是问题、实测不是问题的地方**（避免过度优化）：

| 曾经怀疑 | 实测 | 结论 |
|---|---|---|
| 全局搜索每敲一键都要小写化全部课文 | 索引 0.42–0.88M 字符；建索引 1–3 ms；**每键 ~2 ms** | 不用改 |
| KaTeX 公式渲染拖慢课程页 | 0.11–0.15 ms/式；最重的讲（277 式）≈ 30 ms | 不用改 |
| 复习页"最弱课"扫描是 O(课×错题) | 600 条错题下 **5.5 ms** | 不用改 |
| 首屏一次性加载 3.4–8.3 MB JS | 解析+执行 **30–65 ms**（桌面） | 可接受，不建议现在做懒加载 |

---

## 2. P0：术语联动是唯一的真热点（21–39× 提速，已逐字节验证）

### 位置
`cs/app/app.js:193`、`math/app/app.js:196`、`physics/app/app.js:205` 的 `linkTermsInHtml()`。

### 为什么慢
它对 HTML 做**逐字符循环**，且每遇到一个非标签字符就：

```js
pattern.lastIndex = 0;
var rest = html.slice(i);          // ← 每个字符复制一遍剩余全文：O(n²)
var hit = pattern.exec(rest);      // ← 用 300+ 分支的 alternation 从头重扫：又一遍 O(n²)
```

术语表越大（physics 100+ 条），正则分支越多，每次重扫越贵 —— 这就是为什么 physics 明显比 cs/math 慢。

### 实测（真实课程内容，全部渲染块）

| 站点 | 渲染块 | 现版本 | 线性版本 | 提速 | 输出差异 |
|---|---|---|---|---|---|
| cs | 786 | 1648 ms | 79 ms | **21.3×** | 0 |
| math | 722 | 1721 ms | 83 ms | **20.9×** | 0 |
| physics | 622 | 8142 ms | 209 ms | **38.9×** | 0 |
| 合计 | 2130 | **11.5 s** | **0.37 s** | ~31× | 0 |

单讲视角（physics）：平均 **58 ms → ~1.5 ms**，最差 `math-methods-2/mm2-integral-transform`
**213 ms → ~5 ms**。手机 CPU 一般是桌面的 2–4 倍慢，所以这是**每翻一讲都会感到的卡顿**。

### 已验证的修法
把"逐字符"改成"按标签切分，每个文本段做一次 `String.replace`"，输出**逐字节相同**：

```js
function linkTermsInHtml(html) {
  if (!html || html.indexOf("term-link") >= 0) return html;
  if (!TERM_MAP) TERM_MAP = buildTermMap();
  var names = Object.keys(TERM_MAP);
  if (!names.length) return html;
  names.sort(function (a, b) { return b.length - a.length; });
  var escaped = names.map(function (n) { return n.replace(RE_ESCAPE, "\\$&"); });   // cs 用行内字面量
  var pattern = new RegExp("(" + escaped.join("|") + ")", "g");
  var skipTags = ["CODE", "PRE", "A", "H1", "H2", "H3", "H4", "BUTTON"];
  var out = "", i = 0, depth = 0;

  function linkRun(text) {
    if (!text || depth > 0) return text;
    pattern.lastIndex = 0;
    return text.replace(pattern, function (hit) {
      var it = TERM_MAP[hit];
      if (!it) return hit;
      return '<span class="term-link" data-term="' + esc(hit) + '" title="' + esc(String(it.d || "").slice(0, 120)) + '">' + esc(hit) + "</span>";
    });
  }

  while (i < html.length) {
    var lt = html.indexOf("<", i);
    if (lt < 0) { out += linkRun(html.slice(i)); break; }
    if (lt > i) out += linkRun(html.slice(i, lt));
    var gt = html.indexOf(">", lt);
    if (gt < 0) { out += html.slice(lt); break; }
    var tagText = html.slice(lt, gt + 1);
    out += tagText;
    var m = /^<(\/?)([A-Za-z0-9]+)/.exec(tagText);
    if (m) {
      var isSkip = skipTags.indexOf(m[2].toUpperCase()) >= 0;
      if (!m[1] && !/\/>$/.test(tagText) && isSkip) depth++;
      else if (m[1] && isSkip) depth = Math.max(0, depth - 1);
    }
    i = gt + 1;
  }
  return out;
}
```

**改完必须跑**（等价性 + 速度一起验，现版本应报 `mismatches=0` 且提速 ~20–40×；
若已打补丁则会报 ~1×，属正常）：

```powershell
node tools\termlink-equivalence.mjs
cd physics; node tools\verify-simlab.mjs; node tools\smoke-test.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File physics\tools\verify-browser.ps1
```

### 顺手修一个漂移出来的不一致
cs 用的是正确的行内转义 `/[.*+?^${}()|[\]\\]/g`，而 math/physics 的
`RE_ESCAPE = new RegExp("[.*+?^${}()|[]\\]", "g")` **漏了 `\`**。实测术语若含反斜杠：

```
术语 "a\b]c.d"  →  math/physics 转义后 "[a\b]c.d]" → 生成的正则把 \b 当成"词边界"
                →  cs 转义后 "a\\b\]c\.d" → 正确匹配字面量
```

现在术语都是中文/英文，所以**没爆**，但两处实现行为已经不一致了。建议统一用 cs 那版。

---

## 3. P0：没有任何版本控制（成本最低、收益最高）

- `git 2.55` 已安装；`.gitignore` 写得很认真（还写明"路径必须写 `**/` 开头"的原因）。
- 但**工作区及其 5 级父目录都没有 `.git`** —— 项目从未入版本库，或曾被删掉。
- 现状：229.5 MB、4 个站、4 份互不相同的引擎、**35 个会原地改写源码的一次性脚本**
  （cs 19 + math 15 + philosophy 2 + physics 1，全部含 `writeFile`）。
  一旦这些脚本被误跑（或未来某次会话重跑），**没有 `git checkout` 可以回退**。

建议（几分钟）：

```powershell
cd D:\ObsidianLocalLib\system1\DSH\2
git init
# 先确认这些"可再生"目录不会被提交（.gitignore 已覆盖 .edge-profile / tools/_dom /
# tools/fixture* / .progress；建议再补 *.rar / *.zip —— 现在没被忽略）
git add -A
git commit -m "chore: 四个学习站现状存档（优化前的基线）"
```

---

## 4. P1：目录卫生 —— 65% 的体积是可再生文件

| 项 | 体积 | 说明 |
|---|---|---|
| `physics/tools/_dom/` | **95.7 MB** | 178 个 DOM 快照，`verify-browser.ps1` 每次重跑都会重建 |
| `physics/.edge-profile/` | **36.7 MB** | 742 个文件的无头 Edge 用户目录；脚本**只清 `_dom`，从不删它**（我实测跑一次 cs 的浏览器验证就新增 ~11 MB） |
| `cs-study-site/` | 5.5 MB | 与 `cs/` **逐字节相同**（抽查 app.js / data / index.html / serve.mjs 四个文件哈希全一致），纯冗余副本 |
| `cs-study-site.rar` + `cs-study-site.zip` + `philosophy.rar` | 6.8 MB | 9/12–10/5 的旧打包 |
| `cs/tools/_dom` + `math/tools/_dom` | 4.4 MB | 同上 |
| 根 `.progress/` | 3 个小文件 | 旧布局残留：cs/math/physics 三个键都写在同一目录，而各站现在写各自的 `.progress/`（`cs/.progress/` 里甚至有 `math-learn_v1.json`）→ 两处进度并存，容易误判"我的进度呢" |

合计 **149 MB / 229.5 MB = 65%**。四站真正的文件只有 **约 28.6 MB**
（cs 5.5 + math 4.4 + physics 8.4 + philosophy 10.3）。

建议：

1. 删 `physics/tools/_dom`、三个 `.edge-profile`、`cs-study-site/`、三个压缩包（确认不需要留档后）。
2. 把 `.gitignore` 补上 `*.rar` / `*.zip`。
3. 让 `verify-browser.ps1` 用 `$env:TEMP` 下的临时 profile 并在结束时删除（顺手把那句
   "每次跑 verify-browser.ps1 自动重建"的注释改成实际行为）。
4. 根 `.progress/` 要么删掉（若已确认是旧布局残留），要么在 README 里写清它不再被使用 ——
   否则下次看到两份进度会以为是丢数据。

---

## 5. P1：工具与引擎的重复 / 漂移

**完全相同**的文件：站点 `tools/` 之间有 **27 组逐字节相同**（40 个多余副本）。例如
`cs/math` 的 `add-*.mjs`、`inject-*.mjs`、`apply-*.mjs`、`replace-*.mjs` 全家，
以及 cs=math=physics 的 `cjk-diff` / `check-python` / `audit-content` / `make-manifest` /
`lesson-coverage` / `fetch-katex` / `content-fingerprint` / `scan-formulas` / `fix-tex-escapes` /
`python-syntax-report`。

**已经漂移**的引擎（哈希全不同）：

| 文件 | 副本 | 不同版本数 | 备注 |
|---|---|---|---|
| `app.js` | 4 | 4 | cs↔math 只差 27/24 行（≈99% 相同），physics 288/57，philosophy 1750/830（本就是另一个应用） |
| `quiz.js` | 4 | 4 | |
| `progress.js` | 3 | 3 | 差异主要是 KEY 与闪卡字段，属设计如此 |
| `labs.js` | 4 | 3 | cs/math 相同 |
| `markdown.js` | 4 | 3 | math/physics 相同 |
| `mathrender.js` | 3 | 2 | physics 版更新（+7/−2 行），cs/math 落后 |

漂移的**实际代价**已经出现两次：
① 第 2 节的转义正则不一致；② 一个 bug 要改 3–4 遍（我这次的补丁就得分别落到
`cs/app/app.js:193`、`math/app/app.js:196`、`physics/app/app.js:205`）。

建议（**不破坏"删掉任意一个站其余照跑"这条设计约束**）：

- **开发工具**：收敛到工作区级 `tools/`（它们本来就只在开发时跑，不属于运行时依赖），
  用 `--site cs` 之类的参数区分 —— 和 `tools/serve-all.mjs` 同级，不进入任何站的运行时。
- **引擎算法**：只把**逐字节相同或应当相同**的纯算法（术语联动、转义、Markdown 渲染等）
  放进 `ENGINE/` 单一源，用 `tools/sync-engine.mjs` 复制进各站（各站仍是完整自足的副本，
  运行时零跨目录引用），并在同步时校验哈希。
- 无论选哪条，都建议加一个**跨站等价性测试**（像 `tools/termlink-equivalence.mjs` 那样
  直接抽各站真实函数来对拍）—— 这次的转义不一致就是这类测试一眼能发现的。
- **一次性迁移脚本**（`add-*` / `inject-*` / `patch-*` / `apply-*` / `replace-*` / `fix-*` /
  `repair-*` / `rebuild-*`）建议移入 `tools/archive/` 并加一句"历史脚本，已执行，勿重跑"。
  它们会把 UI/内容**再注入一次**，且没有幂等保护。

---

## 6. P1：进度同步存在一个窄但真实的覆盖窗口

现有的两层设计（先写 localStorage、只在成功拉取过之后才推送、focus/visibilitychange 再拉）
**已经把窗口压得很小**，服务器的落盘也是安全的（`tmp` + `rename` 原子写、8 MB 上限、
键名白名单、防目录穿越）。但服务器端**只整体覆盖，不做合并，也没有版本号**，所以：

1. 设备 A 在 T0 成功拉取（`pulled=true`）；
2. A 之后**再没拉取成功**（网络抖动/休眠；此时 `pulled` 仍为 true）；
3. 期间设备 B 学习并推送了新记录；
4. A 本地发生改动 → 防抖推送成功 → 把"T0 的合并态 + A 自己的改动"**整体**写回，
   覆盖掉 B 在 T0 之后的记录。

触发条件不常见（需要"拉取失败但推送成功"这种不对称），但一旦命中就是**静默丢进度**。
`progress.js` 文件头那三条"必须守住"的约定里，这一条正好是它守不住的。

建议二选一（都很小）：

- **A（推荐，改动最小）**：服务器维护 `rev`；客户端 POST 时带 `If-Match: <rev>`，
  不匹配返回 `409` → 客户端重新拉取 + 合并 + 重试。
- **B（更彻底）**：把 `mergeState/mergeRec` 的逻辑搬到服务器端做真正的合并
  （算法已经有了，只是位置问题）。

---

## 7. P2：小项（按性价比排序）

1. **`start-all.cmd` 先开标签页、后起服务**（第 40–43 行 `start`，第 44 行才 `node serve-all.mjs`）。
   实测服务从启动到返回 200 需要 **720–770 ms**；浏览器已开着时标签页可能更快加载完，
   于是偶发"无法访问此网站"，需要手动刷新。修法：把 4 个 `start` 挪到服务起来之后
   （或让 `serve-all.mjs` 在 listen 成功后自己调用浏览器打开，像 Vite 那样）。
2. **无 PWA**：加一个 `manifest.webmanifest` + 极简 Service Worker，手机可"添加到主屏幕"
   并稳定离线（KaTeX 字体已本地，缓存很简单）。四个站各一份很小。
3. **可访问性**：cs 引擎 + 页面里 `role=` 0 处、`aria-*` 1 处（只有菜单按钮的 `aria-label`）、
   `tabindex` 0 处。已经做了 `/` 聚焦搜索、`Esc` 关闭、`<dialog>` 模态 —— 说明键盘路径
   是被考虑过的，**唯独搜索结果列表是断的**（渲染成不可聚焦的 `div`，只能点）。
   建议：结果容器 `role="listbox"`、每项 `role="option"`，支持 ↑/↓ + Enter，
   输入框加 `aria-expanded` / `aria-activedescendant`；侧栏当前项加 `aria-current`。
4. **philosophy 真值表校验有一格没被检查**：`verify-truthtables.mjs` 的退出码只看
   `mismatch`，"无法解析"的格子只计数不判失败（`process.exit(mismatch > 0 ? 1 : 0)`）。
   这次运行有 1 格（`∃x¬Fx`）无法解析，因此汇总行没有打印 "✓"，但退出码仍是 0。
   建议：加 `--strict` 让"无法解析"也判失败，或支持量词记号。
5. **单文件离线版无同步校验**：`philosophy/tools/build.mjs` 产出
   `philosophy-standalone.html`（5.09 MB，当前比 data 新，是最新的）。建议给它加一个
   `--check`（比对内联内容与 `data/` 是否一致），否则内容改了而忘记重建时无人发现。
6. `cs` 的 `check-code.mjs` 用 `-fopenmp` 之外的默认参数编译，于是
   `parallel-distributed.js` 里那个 `#pragma omp parallel for reduction(+:sum)` 会被编译器
   忽略（`-Wunknown-pragmas`）：**结构检查过，但并行语义没被验证**，学员不带 `-fopenmp`
   编译也只得到串行程序。建议对含 `#pragma omp` 的块用 `-fopenmp` 编译，或在正文标注。

---

## 8. 建议的动手顺序

| 顺序 | 事项 | 成本 | 收益 |
|---|---|---|---|
| 1 | `git init` + 补 `*.rar`/`*.zip` 到 `.gitignore` + 基线提交 | ~5 分钟 | 给后面所有改动上保险 |
| 2 | 打第 2 节的 `linkTermsInHtml` 补丁（3 个文件）+ 跑复核工具与浏览器验证 | ~20 分钟 | 每讲渲染快 20–40×；physics 最差讲 213 ms → ~5 ms |
| 3 | 清理 149 MB 可再生文件 + 让 `verify-browser.ps1` 用临时 profile 并自清 | ~15 分钟 | 工作区 229.5 MB → ~80 MB，不再有"同名两份"的困惑 |
| 4 | 同步加 `If-Match` 版本校验（第 6 节 A 方案） | ~30 分钟 | 关掉静默丢进度的那条窄路径 |
| 5 | 一次性脚本归档 + 工具/引擎去重（第 5 节） | 半天 | 以后一个 bug 只改一处 |
| 6 | P2 小项：`start-all.cmd` 顺序、搜索键盘可达、真值表 `--strict`、PWA | 各 10–30 分钟 | 体验与可访问性 |

---

## 附：本次测量用到的、保留下来的工具

`tools/termlink-equivalence.mjs` —— 从各站**真实的** `app.js` 里抽出 `linkTermsInHtml`
（以及它依赖的 `buildTermMap`），喂真实课程内容，逐块对比"现版本 vs 线性版本"的**输出是否逐字节相同**
并给出提速倍数。用途有两个：打补丁前证明等价、打补丁后防止回归。

```powershell
node tools\termlink-equivalence.mjs            # 三个站一起测
node tools\termlink-equivalence.mjs physics    # 只测一个站
```
