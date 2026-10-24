#!/usr/bin/env node
/**
 * 给每门课注入"进阶包"字段 advanced：
 *   { texts: [教材], labs: [招牌实验], project: 从零实现项目, criteria: 验收判据, gate: 前置（可选） }
 * 只新增字段，不改动已有内容；幂等；写回前语法校验。
 * 用法：node cs/tools/inject-advanced.mjs cs      （或 math）
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SITE_ARG = process.argv[2] || "cs";
const SITE = resolve(dirname(fileURLToPath(import.meta.url)), "..", SITE_ARG === "math" ? "" : "");
const DATA = join(resolve(dirname(fileURLToPath(import.meta.url)), ".."), "data");

/* ============================= 计算机站 ============================= */
const CS = {
  "cs-zero-basics": {
    texts: ["《计算机科学导论》或《编码：隐匿在计算机软硬件背后的语言》", "官方文档：Python 教程、man 手册、命令行的 help"],
    labs: ["把终端 5 个命令各用 10 次，尝试用它们管理自己的文件夹", "故意制造 5 种报错并照着报错信息修好"],
    project: "写一个「我的第一个工具」：批量重命名文件或统计文件夹里代码行数的小脚本",
    criteria: "能独立装好环境、写出并运行程序、看懂 90% 的报错信息；遇到新报错知道去哪查"
  },
  "programming-basics": {
    texts: ["K&R《C 程序设计语言》全 8 章", "《C 陷阱与缺陷》", "Python 官方教程（语言参考部分）"],
    labs: ["把书里每个示例都敲一遍并改成自己的版本", "用 C 实现带动态数组、字符串、哈希表的迷你标准库"],
    project: "写一个 500 行以内的计算器解释器（支持变量、括号、四则、错误提示），C 与 Python 各一版",
    criteria: "能对任何输入给出正确结果或明确报错；能解释每一行在内存里发生了什么"
  },
  "oop-java": {
    texts: ["《Effective Java》第 3 版（精读第 2/3/4/8/10 章）", "《Head First 设计模式》或《设计模式：可复用面向对象软件的基础》"],
    labs: ["用 Java 实现并测试一个泛型容器库（List/Map 的简化版）", "用 JUnit 给每个类写单元测试，覆盖率 > 80%"],
    project: "写一个多线程下载器或聊天服务器，要求：线程池、异常处理、接口抽象可替换实现",
    criteria: "能说清重载/重写/多态/虚方法表在字节码层面如何实现；代码提交前自己 review 过一遍"
  },
  "digital-logic": {
    texts: ["《数字逻辑与计算机设计》或《数字设计：原理与实践》", "nand2tetris 第 1~5 章（从逻辑门到 CPU）"],
    labs: ["nand2tetris：用 HDL 实现 ALU、寄存器、内存、CPU", "用 Verilog 写一个模 60 计数器并在仿真里跑通"],
    project: "用 HDL 实现一个能跑指令级测试的流水线 CPU（可加转发与停顿）",
    criteria: "能画出时序图并解释建立/保持时间；CPU 能通过 nand2tetris 的官方测试脚本"
  },
  "math-foundation": {
    texts: ["《普林斯顿微积分读本》（补课用）", "Strang《线性代数导论》或《线性代数应该这样学》Axler", "《概率论基础教程》Ross 前 4 章"],
    labs: ["用 Python 数值验证中值定理、泰勒逼近、黎曼和收敛", "手算 3×3 矩阵的特征值与二次型标准化，再用代码核对"],
    project: "写一份 20 页的学习笔记：把极限、导数、矩阵、特征值、概率用「定义→例子→反例」重写一遍",
    criteria: "能独立证明教材里的定理（不查答案）；能给每个概念举出一个反例"
  },
  "discrete-math": {
    texts: ["Rosen《离散数学及其应用》", "《具体数学》第 1~3 章（求和与递归）", "Diestel《图论》前 2 章"],
    labs: ["用程序枚举小规模图验证握手定理、欧拉回路判据", "用生成函数手推 Catalan 数并代码验证前 20 项"],
    project: "从零实现一个 SAT 求解器（DPLL），能解 50 变量规模的随机 3-SAT",
    criteria: "能独立写出归约/反证/归纳三类证明；能解释为什么鸽巢原理的加强形式更强"
  },
  "data-structures": {
    texts: ["CLRS 第 10~13、18 章", "《数据结构与算法分析》Weiss", "《编程珠玑》（讲工程直觉）"],
    labs: ["从零实现：动态数组、双向链表、循环队列、哈希表（两种冲突处理）", "用单调栈/单调队列解决 5 道典型题"],
    project: "实现一个内存索引库：B+ 树 + 哈希索引，支持插入/删除/范围查询并做性能对比",
    criteria: "能白板写出 B+ 树插入分裂全过程；能说清每种结构的时间/空间代价与缓存友好性"
  },
  "ds-sorting-searching": {
    texts: ["CLRS 第 2、6、7、8 章（排序）+ 第 11、12、18 章（查找）", "《算法》Sedgewick 第 2 章"],
    labs: ["实现 8 种排序并实测比较/移动次数与稳定性（用随机+有序+逆序三组数据）", "实现外部排序：对 10 GB 数据（可用生成的大文件模拟）做多路归并"],
    project: "写一个排序算法可视化与性能基准工具，输出对比报告（含缓存命中率的讨论）",
    criteria: "能解释堆排序为什么不稳定、快排最坏情况怎么构造；能算出外部排序的 I/O 次数"
  },
  "ds-graph-advanced": {
    texts: ["CLRS 第 20~25 章", "《图论》Diestel 或 Bondy 的图论入门部分"],
    labs: ["实现拓扑排序（Kahn + DFS）与关键路径，手算一个 AOE 网校核", "实现最大流（Dinic）并在网络图上实测"],
    project: "写一个项目排期工具：输入任务依赖与工期，输出拓扑序、关键路径、可并行区间",
    criteria: "能证明关键路径是最长路；能解释为什么缩短非关键活动的工期不影响总工期"
  },
  "algorithms": {
    texts: ["CLRS 精读（分治/DP/贪心/图/近似）", "《算法设计》Kleinberg & Tardos（证明写得好）", "《算法竞赛进阶指南》（工程实现）"],
    labs: ["为每个范式做 10 道题并写题解（含复杂度和正确性论证）", "实现并对比：Dijkstra 的三种实现（数组/二叉堆/斐波那契堆）"],
    project: "从零实现一个「算法题库评测器」：跑测试用例、限时、比对输出、报告耗时",
    criteria: "给定新问题能判断属于哪个范式并写出证明；能识别并构造贪心失效的反例"
  },
  "computer-organization": {
    texts: ["**CSAPP**（《深入理解计算机系统》）第 1~9 章", "《计算机组成与设计：硬件/软件接口》P&H", "《编码：隐匿在计算机软硬件背后的语言》（补直观）"],
    labs: ["CSAPP Data Lab（位运算）、Bomb Lab（汇编与调试）、Attack Lab", "用汇编手写递归与栈帧，再用 gdb 逐帧对照"],
    project: "用 C 写一个能反汇编 x86-64 子集的工具，输出指令、操作数、跳转目标",
    criteria: "能解释一条 C 语句编译出的每条汇编；能算清 cache 命中率与 AMAT"
  },
  "computer-architecture": {
    texts: ["《计算机体系结构：量化研究方法》第 1~3、5 章", "《计算机组成与设计》第 4 章（流水线）", "Hennessy 的附录（指令集与存储层次）"],
    labs: ["用 gem5 或 SimpleScalar 跑基准程序，测 CPI、分支预测命中率、cache 缺失率", "写一个 cache 模拟器，验证三种映射与替换策略的差异"],
    project: "为 nand2tetris 的 CPU 加上 5 级流水线与转发，实测加速比并与理论对比",
    criteria: "能用 Roofline 模型判断程序是算力受限还是带宽受限；能算出乱序执行的 IPC 上限"
  },
  "operating-systems": {
    texts: ["**OSTEP**（《操作系统导论》，免费英文版）或《操作系统概念》", "xv6 源码与教材（MIT 6.S081）", "《Linux 内核设计与实现》（选读）"],
    labs: ["MIT 6.S081 的 xv6 labs：syscall、pgtbl、traps、thread、lock、fs", "用 strace/ltrace 观察真实程序的系统调用序列"],
    project: "在 xv6 里实现写时复制 fork（copy-on-write）并通过全部测试",
    criteria: "能画出一次 read() 从用户态到磁盘再回来的完整路径；能解释信号量与条件变量的区别与选用"
  },
  "computer-networks": {
    texts: ["《计算机网络：自顶向下方法》", "《UNIX 网络编程》卷 1（socket API）", "TCP/IP 详解 卷 1（选读）+ RFC 793/5681 原文"],
    labs: ["用 tcpdump/Wireshark 抓一次真实 HTTP+TCP 交互并逐字段解释", "用 epoll 写一个能撑 1 万连接的 echo 服务器"],
    project: "实现一个简易 TCP（或在 UDP 上实现可靠传输）：三次握手、超时重传、滑动窗口、拥塞控制",
    criteria: "能解释三次握手/四次挥手每个状态的意义；能根据抓包判断丢包与拥塞阶段"
  },
  "database-systems": {
    texts: ["《数据库系统概念》Silberschatz", "**《数据库系统实现》**（讲 B+ 树/查询优化/恢复的实现）", "《数据密集型应用系统设计》DDDIA 第 3、7 章"],
    labs: ["用 sqlite3 做 20 道 SQL 难题（含窗口函数、递归 CTE）", "手算 B+ 树插入删除全过程并与代码实现对照"],
    project: "从零实现一个单机数据库：页式存储 + B+ 树索引 + 事务 + WAL 崩溃恢复",
    criteria: "能解释 MVCC 如何实现可重复读；能算出某查询走哪个索引、代价大概多少"
  },
  "software-engineering": {
    texts: ["《代码大全 2》选章", "《重构》Fowler", "《人月神话》+《持续交付》"],
    labs: ["给一个 500 行的坏代码做完整重构（每步跑测试）", "为一个项目搭 CI：lint + 单测 + 覆盖率门槛"],
    project: "主导一个 3 人以上的协作项目（可用开源项目代替）：需求文档 + 设计评审 + 代码 review + 发布",
    criteria: "能说清耦合/内聚的具体类型与代价；能给出可量化的技术债清单与偿还顺序"
  },
  "compilers": {
    texts: ["龙书《编译原理》", "**Crafting Interpreters**（动手写两遍解释器）", "《现代编译实现》Appel（后端与寄存器分配）"],
    labs: ["为一个小语言写词法+语法分析器（手写递归下降 + 一个 LR 生成器）", "实现三地址码生成与常量传播/死代码消除"],
    project: "实现一门小语言的完整编译器：词法→语法→类型检查→IR→寄存器分配→x86-64 汇编可运行",
    criteria: "能手工构造 FIRST/FOLLOW 与 LR 表；能解释为什么需要 SSA 与活跃变量分析"
  },
  "parallel-distributed": {
    texts: ["《数据密集型应用系统设计》DDDIA（精读）", "Raft 论文（In Search of an Understandable Consensus Algorithm）", "《并行编程实战》或 OpenMP/CUDA 官方指南"],
    labs: ["用 pthread/OpenMP 写并行矩阵乘并实测加速比与 Amdahl 上限", "实现 MapReduce 的单词计数（含 shuffle）"],
    project: "**实现 Raft**（领导者选举 + 日志复制 + 持久化），通过 MIT 6.824 的测试",
    criteria: "能解释 CAP 在具体系统里的取舍；能说清线性一致性与最终一致性的差别与代价"
  },
  "information-security": {
    texts: ["《深入理解计算机系统》第 3 章（栈溢出）+ CSAPP Attack Lab", "《Web 安全深度剖析》或 OWASP Top 10 官方文档", "《密码学与网络安全》Stallings 选章"],
    labs: ["CSAPP Attack Lab：构造 ROP 攻击绕过栈保护", "在本地靶场复现 SQL 注入、XSS、CSRF 并写防御方案"],
    project: "自己实现一个 TLS 子集（密钥交换 + 对称加密 + MAC）并抓包验证",
    criteria: "能对一段代码指出可利用点并给出修复；能解释为什么参数化查询能根治注入"
  },
  "ai-ml": {
    texts: ["《机器学习》周志华 或《统计学习方法》李航", "**《动手学深度学习》**（代码与原理并重）", "《深度学习》Goodfellow 选章"],
    labs: ["纯 NumPy 手写线性回归、逻辑回归、两层神经网络的训练与反向传播", "从零实现决策树与 K-means，并在真实数据集上评估"],
    project: "选择一个真实数据集做完整项目：数据清洗→特征→模型→评估→误差分析→报告",
    criteria: "能手推反向传播并在代码里核对梯度；能解释过拟合的诊断与缓解手段"
  },
  "computation-theory": {
    texts: ["Sipser《计算理论导引》全 5 章（最推荐的精读对象）", "《自动机理论、语言和计算导论》Hopcroft（补充）"],
    labs: ["实现 DFA/NFA/PDA/图灵机模拟器并跑遍书中例子", "用泵引理独立证明 5 个语言非正则"],
    project: "写一个正则引擎（支持 | * + ? 与括号），再用 Thompson 构造证明它与 NFA 等价",
    criteria: "能独立完成归约证明；能解释 P vs NP 的确切含义及常见误解"
  },
  "cs408-intensive": {
    texts: ["王道/天勤 408 四本（当题库）+ 历年真题", "四门主课各自的经典教材（见各课进阶包）"],
    labs: ["按题型做专项训练，每类题型至少 20 题并整理错因", "限时闭卷模考 5 套"],
    project: "自建错题本 + 题型索引：按「题型→解题步骤→陷阱」组织，能给别人讲一遍",
    criteria: "限时真题稳定在 120 分以上；每道错题都能定位到教材哪一章哪个定义"
  },
  "cs408-drills": {
    texts: ["四门主课教材对应章节（Cache/磁盘/窗口/PV/香农/流水线）"],
    labs: ["每个考点手算 10 题并与站内交互实验对照", "把错题按「考点×错误类型」列成矩阵"],
    project: "整理一份 A4 双面的「公式与判据速查卡」，做到不看资料能默写",
    criteria: "能不看公式手算 AMAT、最小帧长、有效传输率、安全序列"
  },
  "systems-practice": {
    texts: ["《深入理解计算机系统》第 8~10 章（并发与 I/O）", "《UNIX 环境高级编程》APUE（查手册用）"],
    labs: ["把课程里的迷你项目逐个改造成「能跑真实负载」的版本", "用 valgrind/ASan/perf 做一次完整性能与内存剖析"],
    project: "任选一个做到生产级：shell（含作业控制）、内存分配器（过 CSAPP trace）、HTTP 服务器（过 ab/wrk 压测）",
    criteria: "项目有测试、有 README、有性能数据；能被别人 clone 下来一次跑通"
  }
};

/* ============================= 数学站 ============================= */
const MATH = {
  "math-zero-basics": {
    texts: ["《普林斯顿数学手册》或《什么是数学》Courant（建立直观）", "《怎样解题》波利亚（方法论）"],
    labs: ["把站内每个符号亲手写在本子上并造三个例子", "给每个逻辑联结词画一次真值表"],
    project: "写一份「给高中生的数学符号与证明入门」笔记，要求同学能看懂",
    criteria: "看到任意符号能读出名字并说出含义；能独立写出一次反证法"
  },
  "math-analysis-1": {
    texts: ["《数学分析》卓里奇 或 华东师大版", "**《微积分入门》小平邦彦**（严格但不吓人）", "《数学分析习题课讲义》谢惠民（难题）"],
    labs: ["用 ε-N 独立证明 10 个数列极限（写出完整的 N 构造）", "用程序把「任给 ε 找 N」的过程可视化并验证"],
    project: "整理一本「极限与连续的手写证明集」：每个定理给出完整证明 + 一个反例",
    criteria: "能独立完成教材里 80% 的证明题；能指出某定理去掉某个条件后构造出反例"
  },
  "math-analysis-2": {
    texts: ["卓里奇 第 2 卷（级数）+ 华东师大版下册", "《陶哲轩实分析》（重建严格基础）"],
    labs: ["手算并证明 10 个级数的收敛性（含一致收敛的例子）", "用程序验证傅里叶部分和在跳跃点的行为（吉布斯现象）"],
    project: "写一篇「一致收敛为什么重要」的讲义：三个定理 + 三个反例",
    criteria: "能判断给定函数列是否一致收敛并给出证明或反例"
  },
  "math-analysis-3": {
    texts: ["《数学分析》华东师大版下册（含参积分与场论）", "《向量分析与场论》或卓里奇对应章节"],
    labs: ["手算格林/高斯/斯托克斯各 5 题并两路对照（曲线积分 vs 重积分）", "用程序数值计算通量与环量验证公式"],
    project: "写一份「三大公式其实是一个定理」的讲义（外微分视角）",
    criteria: "能判断向量场是否保守并求出势函数；能写出三大公式并说明条件"
  },
  "linear-algebra-1": {
    texts: ["**《线性代数应该这样学》Axler**（重概念）", "《线性代数及其应用》Lay（重计算）", "Strang 的 MIT 公开课讲义"],
    labs: ["从零实现高斯消元、LU 分解、行列式（按定义与按展开两种）", "手算秩与线性相关性判定 10 题并用代码核对"],
    project: "写一个线性方程组求解器：支持无解/唯一解/无穷多解的判定与解空间描述",
    criteria: "能解释秩的几何意义；能独立证明行秩等于列秩的思路"
  },
  "linear-algebra-2": {
    texts: ["Axler 第 5~8 章", "《矩阵计算》Golub 选章（数值视角）", "《线性代数及其应用》特征值与 SVD 部分"],
    labs: ["手算特征值/若尔当形/二次型标准化各 5 题", "从零实现幂迭代、QR 迭代求特征值"],
    project: "从零实现 SVD 并用于图像压缩（给出压缩率与重构误差曲线）",
    criteria: "能判断矩阵可否对角化并给出理由；能解释 SVD 与 PCA 的关系"
  },
  "analytic-geometry": {
    texts: ["《解析几何》吕林根", "《空间解析几何》选读"],
    labs: ["手算直线/平面/二次曲面典型题 20 道", "用程序画旋转曲面与二次曲线的标准形变换"],
    project: "写一个三维几何计算小程序：点到平面距离、异面直线距离、二次曲线类型判定",
    criteria: "能不看公式推导出距离公式；能由方程判断曲线类型并配图"
  },
  "probability": {
    texts: ["《概率论基础教程》Ross", "《概率论与数理统计》陈希孺（严谨）", "《概率论及其应用》Feller 第 1 卷（进阶）"],
    labs: ["手算贝叶斯、期望方差、协方差 20 题", "用程序模拟大数定律与中心极限定理并画图"],
    project: "写一个蒙特卡洛实验报告：估计 π、模拟随机游走、验证 CLT 的收敛速度",
    criteria: "能独立判断事件独立性并给出反例；能解释「不相关≠独立」的构造"
  },
  "statistics": {
    texts: ["《概率论与数理统计》陈希孺", "《统计推断》Casella & Berger（进阶）", "《数理统计学简史》选读"],
    labs: ["手算 MLE、置信区间、假设检验各 10 题", "用 Bootstrap 估计标准误并验证覆盖概率"],
    project: "对一份真实数据做完整统计分析：描述→估计→检验→报告（含假设与局限）",
    criteria: "能说清 p 值的正确含义与常见误用；能区分置信区间与可信区间"
  },
  "abstract-algebra": {
    texts: ["《近世代数》或 Artin《代数》", "Dummit & Foote 选章（群与伽罗瓦理论）"],
    labs: ["手算 10 个群的凯莱表、元素阶、子群结构", "验证拉格朗日定理与类方程在具体群上的成立"],
    project: "写一份「用群论看三次方程根式解」的讲义（从对称性到伽罗瓦对应）",
    criteria: "能独立判断子群/正规子群/理想；能解释伽罗瓦对应为什么能判定根式解"
  },
  "ode": {
    texts: ["《常微分方程》王高雄 或 Boyce & DiPrima", "《微分方程、动力系统与混沌导论》Hirsch（进阶）"],
    labs: ["手解 20 道一阶/二阶方程", "用程序画相图与数值解，验证稳定性判断"],
    project: "写一个微分方程数值求解器（Euler/RK4/自适应）并对比精度与稳定性",
    criteria: "能判断平衡点的类型与稳定性；能解释刚性方程为什么不能用显式法"
  },
  "pde": {
    texts: ["《数学物理方法》梁昆淼 或 Evans 选章", "《偏微分方程》Strauss（入门友好）"],
    labs: ["用分离变量解热方程与波动方程各 5 题", "用有限差分模拟并观察 CFL 条件与稳定性"],
    project: "数值模拟二维热传导：可视化温度演化并与解析解对比误差",
    criteria: "能正确分类方程并给定解条件；能解释 CFL 条件的来源"
  },
  "complex-analysis": {
    texts: ["《复变函数论》钟玉泉 或 Ahlfors 选章", "《复分析：可视化方法》Needham（直观极佳）"],
    labs: ["手算 20 道复积分与留数题", "用程序画保角映射的网格变形"],
    project: "用留数定理计算 5 个实积分并与数值积分对照",
    criteria: "能判断奇点类型并快速求留数；能解释解析函数的「刚性」体现在哪"
  },
  "real-analysis": {
    texts: ["**《陶哲轩实分析》**（重建基础）", "《实变函数与泛函分析概要》王声望 或 Royden 选章"],
    labs: ["手证测度的可数可加性与可测函数封闭性 10 题", "构造并验证康托尔集与不可测集的存在性论证"],
    project: "写一份「黎曼积分为什么不够」的讲义：三个反例 + 勒贝格积分的解决方案",
    criteria: "能独立写出三大收敛定理的适用条件并给出反例；能说清 almost everywhere 的用法"
  },
  "functional-analysis": {
    texts: ["Rudin《泛函分析》或 Kreyszig《泛函分析导论》", "《实变函数与泛函分析》选章"],
    labs: ["手证 10 题：算子范数、投影、紧性", "验证弱收敛但不强收敛的经典例子"],
    project: "写一份「三大定理为什么重要」的讲义，每个定理配一个应用（含有限元或 PDE）",
    criteria: "能独立计算算子范数与谱；能说清哈恩-巴拿赫为什么需要选择公理"
  },
  "fourier-analysis": {
    texts: ["《傅里叶分析导论》Stein 或《傅里叶变换及其应用》Bracewell"],
    labs: ["手算方波/三角波的傅里叶系数并画部分和", "实现 DFT 与 FFT 并对比复杂度与误差"],
    project: "写一个音频或图像的频谱分析与滤波工具（含不确定性原理的实测）",
    criteria: "能推导卷积定理；能解释采样定理的适用条件与混叠"
  },
  "numerical-analysis": {
    texts: ["《数值分析》李庆扬 或 Burden & Faires", "《数值线性代数》Trefethen（进阶）", "《MATLAB 数值计算》选读"],
    labs: ["手算并编程实现：插值、数值积分、牛顿法、幂法", "对比不同方法的误差阶与稳定性"],
    project: "实现一个稀疏线性方程组求解器（共轭梯度）并做收敛性实验",
    criteria: "能分析方法的误差阶与稳定性；能判断问题是病态的还是算法不稳定"
  },
  "topology": {
    texts: ["Munkres《拓扑学》前 4 章", "《基础拓扑学》Armstrong（直观好）"],
    labs: ["手证 10 题：紧致、连通、分离公理", "计算常见曲面（球/环面/克莱因瓶/射影平面）的基本群与欧拉示性数"],
    project: "写一份「橡皮膜几何」讲义：用同伦与基本群解释为什么咖啡杯等于甜甜圈",
    criteria: "能独立判断同胚与非同胚；能用范坎彭定理算基本群"
  },
  "differential-geometry": {
    texts: ["do Carmo《曲线与曲面的微分几何》或《微分几何初步》陈维桓", "《微分几何及其应用》Pressley（友好）"],
    labs: ["手算曲线曲率挠率、曲面第一/第二基本形式各 10 题", "用程序算球面/环面的高斯曲率并可视化"],
    project: "写一个曲面曲率可视化工具，实测高斯-博内定理",
    criteria: "能区分内蕴与外蕴；能独立计算高斯曲率并解释绝妙定理的含义"
  },
  "combinatorics": {
    texts: ["《具体数学》第 1~7 章（最推荐精读）", "《组合数学》Brualdi", "Diestel《图论》前 3 章"],
    labs: ["手推 20 个组合恒等式并用生成函数验证", "用程序枚举小规模验证 Ramsey/Turán 的界"],
    project: "写一个计数与图算法的工具箱：容斥、生成函数、匹配、最大流，并附例题集",
    criteria: "能用生成函数独立解题；能证明 Ramsey 下界与 Turán 定理"
  },
  "number-theory": {
    texts: ["《初等数论》潘承洞 或 Hardy & Wright 选章"],
    labs: ["手算 20 题：同余方程、CRT、二次剩余", "实现 Miller-Rabin、Pollard rho、RSA 全套"],
    project: "实现一个能处理 100 位素数的 RSA 加解密库，并用它解释公钥体系",
    criteria: "能独立求解一次与高次同余方程；能证明 RSA 的正确性"
  },
  "set-theory": {
    texts: ["《集合论》或 Kunen 选章", "《陶哲轩实分析》第 1~3 章（自然数到实数构造）"],
    labs: ["从皮亚诺公理手推自然数的运算性质", "验证序数算术的非交换性例子"],
    project: "写一份「为什么需要公理化」的讲义：从罗素悖论到 ZFC 十条公理的动机",
    criteria: "能区分序数与基数；能解释选择公理为何引出反直觉结论"
  },
  "math-history": {
    texts: ["《数学简史》克莱因 或《古今数学思想》", "《数学：确定性的丧失》Kline（思想史）"],
    labs: ["为每个时代整理一份「当时能解决的问题 / 不能解决的问题」对照表"],
    project: "写一篇文章：某个概念（如极限或群）从直观到严格的完整演化史，含原始引文",
    criteria: "能把每个概念的出现与当时的具体问题对应起来，并说清它解决了什么困境"
  }
};

const TABLE = SITE_ARG === "math" ? MATH : CS;
let injected = 0, skipped = 0;
const report = [];

for (const f of readdirSync(DATA).filter((x) => x.endsWith(".js")).sort()) {
  const id = f.replace(/\.js$/, "");
  const adv = TABLE[id];
  if (!adv) { report.push("  ? " + f + "：进阶包表里没有"); skipped++; continue; }
  const p = join(DATA, f);
  let src = readFileSync(p, "utf8");
  if (/\n\s*advanced:\s*\{/.test(src)) { skipped++; continue; }
  const anchor = src.match(/(\n\s*(?:need|hours|term):\s*(?:"[^"]*"|\d+),)/);
  if (!anchor) { report.push("  ! " + f + "：找不到插入锚点"); skipped++; continue; }
  const safe = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const json = "{" +
    "texts:[" + adv.texts.map((x) => '"' + safe(x) + '"').join(",") + "]," +
    "labs:[" + adv.labs.map((x) => '"' + safe(x) + '"').join(",") + "]," +
    'project:"' + safe(adv.project) + '",' +
    'criteria:"' + safe(adv.criteria) + '"' +
    "}";
  const insertAt = anchor.index + anchor[1].length;
  const next = src.slice(0, insertAt) + "\n  advanced: " + json + "," + src.slice(insertAt);
  try { new Function("window", "globalThis", next + ";"); }
  catch (e) { report.push("  ✗ " + f + "：注入后语法失败（" + e.message.slice(0, 40) + "）"); continue; }
  writeFileSync(p, next, "utf8");
  injected++;
}
console.log(report.join("\n"));
console.log("注入进阶包: " + injected + " 门；跳过 " + skipped + " 门。");
