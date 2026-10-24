/* ==========================================================================
   glossary.js —— 术语表（零依赖；由 cs/tools/rebuild-glossary.mjs 生成）
   结构：window.GLOSSARY = { cats: [{ cat, items: [{ t, en, d, where }] }] }
   ========================================================================== */
(function (global) {
  "use strict";

  var TERMS = [
    {
      cat: "计算机入门（零基础从这里看）",
      items: [
        { t: "程序（program）", en: "program", d: "写给计算机的一串指令，计算机照着一步步执行。它和「菜谱」很像：原料是数据，步骤是指令，成品是结果", where: "程序设计基础 · 第 1 讲" },
        { t: "源代码（source code）", en: "source code", d: "人写出来、人能读懂的程序文本（如 .c、.py 文件）。计算机不能直接执行它，必须先翻译成机器码", where: "程序设计基础 · 第 1 讲" },
        { t: "编译（compile）", en: "compile", d: "把源代码整体翻译成机器能执行的程序（可执行文件）的过程。C 语言用编译器（如 gcc）做这件事", where: "程序设计基础 · 第 1 讲" },
        { t: "解释（interpret）", en: "interpret", d: "不预先整体翻译，而是读一句执行一句（Python 就是这样）。好处是灵活，代价是通常比编译慢", where: "程序设计基础 · 第 1 讲" },
        { t: "终端 / 命令行（terminal, CLI）", en: "terminal / command line", d: "用打字下命令来操作电脑的窗口，而不是用鼠标点图标。学习编程几乎必须会用一点终端", where: "程序设计基础 · 第 7 讲" },
        { t: "文件路径（path）", en: "path", d: "文件在磁盘上的位置，如 D:\\\\\\\\study\\\\\\\\a.c。反斜杠 \\\\\\\\ 分隔目录（Windows），斜杠 / 分隔目录（Linux/macOS）", where: "程序设计基础 · 第 7 讲" },
        { t: "变量（variable）", en: "variable", d: "给一块内存起的名字。你可以往这个名字里放值，之后再取出来用", where: "程序设计基础 · 第 2 讲" },
        { t: "函数（function）", en: "function", d: "把一段可重复使用的代码打包并起个名字。调用它 = 让它按参数干活并返回结果", where: "程序设计基础 · 第 4 讲" },
        { t: "bug / 调试（debug）", en: "bug / debugging", d: "bug 是程序里的错误；调试是找出并修掉它的过程（读报错、打断点、打印中间值）", where: "程序设计基础 · 第 7 讲" },
        { t: "内存（memory, RAM）", en: "memory", d: "程序运行时存放数据的地方，断电就没了。和硬盘的区别：内存快但小且易失，硬盘慢但大且能长期保存", where: "程序设计基础 · 第 5 讲" },
        { t: "二进制（binary）", en: "binary", d: "只用 0 和 1 表示数字的计数法。计算机内部一切都用二进制，因为电路只有「通/断」两种稳定状态", where: "计算机组成原理 · 第 2 讲" },
        { t: "算法（algorithm）", en: "algorithm", d: "解决问题的明确步骤序列。同一件事可以有多种算法，好坏的标准是时间和空间代价", where: "数据结构 · 第 1 讲" },
        { t: "数据结构（data structure）", en: "data structure", d: "组织数据的方式（数组、链表、树、哈希表……）。它决定了你能多快地进行查找、插入、删除", where: "数据结构 · 第 2 讲" },
        { t: "时间复杂度（time complexity）", en: "time complexity", d: "用 O(...) 描述「数据量增大时运行时间增长得多快」。O(n) 表示大致成正比，O(n²) 表示平方增长", where: "数据结构 · 第 1 讲" }
      ]
    },
    {
      cat: "硬件与体系结构",
      items: [
        { t: "CPU（中央处理器）", en: "Central Processing Unit", d: "执行指令的部件。它反复做四件事：取指令、译码、执行、写回", where: "计算机组成原理 · 第 1 讲" },
        { t: "主频（clock rate）", en: "clock rate", d: "CPU 每秒的时钟周期数（如 3.0 GHz = 30 亿次/秒）。周期越短，单条指令的「节拍」越快", where: "计算机组成原理 · 第 1 讲" },
        { t: "CPI（每指令周期数）", en: "Cycles Per Instruction", d: "平均执行一条指令需要多少个时钟周期。CPU 时间 = 指令数 × CPI ÷ 主频", where: "计算机组成原理 · 第 1 讲" },
        { t: "寄存器（register）", en: "register", d: "CPU 内部最快的存储单元，容量极小（几个到几十个），指令直接操作它们", where: "计算机组成原理 · 第 7 讲" },
        { t: "Cache（高速缓存）", en: "cache", d: "介于 CPU 与内存之间的小而快的存储器，存放最近用过的数据，利用程序的「局部性」减少访问内存的次数", where: "计算机组成原理 · 第 5 讲" },
        { t: "AMAT（平均访存时间）", en: "Average Memory Access Time", d: "AMAT = 命中时间 + 缺失率 × 缺失代价。衡量存储层次好坏的常用指标", where: "计算机组成原理 · 第 5 讲" },
        { t: "TLB（快表）", en: "Translation Lookaside Buffer", d: "缓存「虚拟地址到物理地址的映射」的小表，避免每次访存都查页表", where: "操作系统 · 第 6 讲" },
        { t: "流水线（pipeline）", en: "pipeline", d: "像流水作业一样让多条指令的不同阶段同时进行，从而提高吞吐率。代价是会出现「冒险」，需要转发或停顿", where: "计算机组成原理 · 第 7 讲" },
        { t: "DMA（直接存储器访问）", en: "Direct Memory Access", d: "让外设直接与内存传数据、不必 CPU 逐字节搬运的机制，传输完成后用中断通知 CPU", where: "计算机组成原理 · 第 8 讲" },
        { t: "中断（interrupt）", en: "interrupt", d: "打断 CPU 当前执行流、让它先去处理某件事的信号（如键盘输入、磁盘读完）。处理完再回到原处继续", where: "操作系统 · 第 1 讲" },
        { t: "指令集（ISA）", en: "Instruction Set Architecture", d: "CPU 能执行的指令集合，是硬件与软件的接口约定。常见的有 x86、ARM、RISC-V", where: "计算机组成原理 · 第 6 讲" },
        { t: "位（bit）与字节（byte）", en: "bit / byte", d: "1 bit 是一个 0 或 1；1 byte = 8 bit。KB=1024 B，MB=1024 KB，GB=1024 MB（工程上也常按 1000 近似）", where: "计算机组成原理 · 第 2 讲" }
      ]
    },
    {
      cat: "操作系统",
      items: [
        { t: "进程（process）", en: "process", d: "正在运行的程序实例，拥有独立的内存空间。程序是静态的文件，进程是动态的执行体", where: "操作系统 · 第 2 讲" },
        { t: "线程（thread）", en: "thread", d: "进程内的执行流，同一进程的线程共享内存，因而通信便宜但需要同步", where: "操作系统 · 第 2 讲" },
        { t: "上下文切换（context switch）", en: "context switch", d: "CPU 从一个进程/线程换到另一个时保存与恢复现场的过程，有开销（要刷缓存、换页表）", where: "操作系统 · 第 2 讲" },
        { t: "系统调用（system call）", en: "system call", d: "应用程序请求操作系统内核帮忙的唯一正规入口（如读文件、开网络连接）", where: "操作系统 · 第 1 讲" },
        { t: "虚拟内存（virtual memory）", en: "virtual memory", d: "给每个进程一个独立、连续的地址空间假象，由页表映射到真实物理内存，还能把不用的页放到磁盘", where: "操作系统 · 第 7 讲" },
        { t: "缺页（page fault）", en: "page fault", d: "访问的页不在内存里，需要从磁盘调入。它是正常机制，但太频繁会导致「抖动」。", where: "" },
        { t: "LRU（最近最少使用）", en: "Least Recently Used", d: "一种替换策略：优先淘汰最久没被访问的东西。常用于页面置换和缓存", where: "操作系统 · 第 7 讲" },
        { t: "死锁（deadlock）", en: "deadlock", d: "多个进程互相等待对方持有的资源，谁也无法推进。四个必要条件：互斥、占有并等待、不可抢占、循环等待", where: "操作系统 · 第 4 讲" },
        { t: "信号量（semaphore）", en: "semaphore", d: "一个整数加上 P（等）和 V（发）两个原子操作，用来做互斥与同步", where: "操作系统 · 第 4 讲" },
        { t: "调度（scheduling）", en: "scheduling", d: "决定「下一个让谁用 CPU」。常见策略：先来先服务、短作业优先、时间片轮转、优先级", where: "操作系统 · 第 3 讲" }
      ]
    },
    {
      cat: "网络",
      items: [
        { t: "协议（protocol）", en: "protocol", d: "通信双方约定的报文格式与交互规则。网络就是一堆分层协议的合作", where: "计算机网络 · 第 1 讲" },
        { t: "IP 地址", en: "IP address", d: "网络中主机的逻辑地址（如 192.168.1.10）。由网络号与主机号组成，用子网掩码划分", where: "计算机网络 · 第 4 讲" },
        { t: "子网掩码 / CIDR", en: "subnet mask / CIDR", d: "标明 IP 地址里前多少位是网络号。/24 表示前 24 位是网络号，可容纳 254 台主机", where: "计算机网络 · 第 4 讲" },
        { t: "端口（port）", en: "port", d: "一台主机上区分不同服务的编号（0~65535）。IP 找到主机，端口找到主机里的具体程序", where: "计算机网络 · 第 6 讲" },
        { t: "TCP", en: "Transmission Control Protocol", d: "面向连接、可靠、按序的传输层协议：三次握手建连、确认与重传保证不丢、拥塞控制避免压垮网络", where: "计算机网络 · 第 6~7 讲" },
        { t: "UDP", en: "User Datagram Protocol", d: "无连接、不保证可靠的传输层协议。开销小、延迟低，适合实时音视频和 DNS 查询", where: "计算机网络 · 第 6 讲" },
        { t: "RTT（往返时间）", en: "Round-Trip Time", d: "数据从发出到收到对方确认所需的时间，是衡量网络延迟的核心指标，也是超时重传的依据", where: "计算机网络 · 第 7 讲" },
        { t: "DNS", en: "Domain Name System", d: "把域名（www.example.com）翻译成 IP 地址的系统，查询结果会按 TTL 缓存", where: "计算机网络 · 第 8 讲" },
        { t: "HTTP / HTTPS", en: "HyperText Transfer Protocol", d: "浏览器与服务器之间传网页的协议。HTTPS 就是在 TLS 加密通道上跑 HTTP", where: "计算机网络 · 第 8 讲" },
        { t: "握手（handshake）", en: "handshake", d: "通信开始前交换参数、建立状态的过程（TCP 三次握手、TLS 握手）", where: "计算机网络 · 第 6 讲" }
      ]
    },
    {
      cat: "算法与数据结构",
      items: [
        { t: "数组（array）", en: "array", d: "一段连续内存里放同类型元素。按下标随机访问是 O(1)，但插入删除要挪动元素", where: "数据结构 · 第 2 讲" },
        { t: "链表（linked list）", en: "linked list", d: "每个结点存数据加一个指向下一个结点的指针。插入删除便宜（O(1)），但查找要顺着走（O(n)）", where: "数据结构 · 第 3 讲" },
        { t: "栈与队列（stack / queue）", en: "stack / queue", d: "栈是后进先出（像一摞盘子），队列是先进先出（像排队）", where: "数据结构 · 第 4 讲" },
        { t: "树 / 二叉树（tree / binary tree）", en: "tree / binary tree", d: "分层的数据结构；二叉树的每个结点最多两个孩子。平衡的二叉搜索树查找是 O(log n)", where: "数据结构 · 第 6 讲" },
        { t: "B+ 树", en: "B+ tree", d: "一种多路平衡查找树，所有数据都在叶子且叶子相连。数据库和文件系统用它，因为一次磁盘 I/O 能读入很多键", where: "数据结构专题 · 第 6 讲" },
        { t: "哈希表（hash table）", en: "hash table", d: "用哈希函数把键映射到桶，平均查找 O(1)。需要处理冲突（链地址法、开放定址），装填因子过高会退化", where: "数据结构 · 第 8 讲" },
        { t: "ASL（平均查找长度）", en: "Average Search Length", d: "查找成功/失败时平均需要比较多少次，是评价查找结构的关键指标", where: "数据结构专题 · 第 5~6 讲" },
        { t: "BFS / DFS", en: "Breadth-First / Depth-First Search", d: "两种遍历图的方式：BFS 一层层扩散（用队列，能求无权最短路），DFS 一路走到底再回退（用栈/递归）", where: "数据结构 · 第 8 讲" },
        { t: "递归（recursion）", en: "recursion", d: "函数调用自己。写好递归要抓住两点：终止条件、把问题缩小后交给下一次调用", where: "程序设计基础 · 第 4 讲" },
        { t: "动态规划（DP）", en: "Dynamic Programming", d: "把大问题拆成重叠的子问题，用表格记住子问题的答案避免重复计算。关键是状态定义与转移方程", where: "算法设计 · 第 4~5 讲" },
        { t: "贪心（greedy）", en: "greedy", d: "每步都选当前看起来最好的，不回退。有效需要证明「贪心选择性质」，否则会得到错误答案", where: "算法设计 · 第 3 讲" },
        { t: "NP 完全（NP-complete）", en: "NP-complete", d: "一类「验证答案容易、但找答案被认为很难」的问题（如旅行商、SAT）。遇到它们一般改用近似或启发式", where: "算法设计 · 第 8 讲" }
      ]
    },
    {
      cat: "数据库与软件工程",
      items: [
        { t: "SQL", en: "Structured Query Language", d: "操作关系数据库的语言：SELECT 查、INSERT 增、UPDATE 改、DELETE 删，还有建表与权限", where: "数据库系统 · 第 3~4 讲" },
        { t: "主键 / 外键", en: "primary / foreign key", d: "主键唯一标识一行；外键指向另一张表的主键，用来表达表之间的联系并保证一致性", where: "数据库系统 · 第 2 讲" },
        { t: "索引（index）", en: "index", d: "为加速查找额外维护的数据结构（常用 B+ 树）。代价是占空间、拖慢写入", where: "数据库系统 · 第 6 讲" },
        { t: "事务（transaction）与 ACID", en: "transaction / ACID", d: "一组要么全做要么全不做的操作。ACID = 原子性、一致性、隔离性、持久性", where: "数据库系统 · 第 7 讲" },
        { t: "范式（normal form）", en: "normal form", d: "减少数据冗余与更新异常的建表规则（1NF→2NF→3NF→BCNF）", where: "数据库系统 · 第 5 讲" },
        { t: "版本控制 / Git", en: "version control / Git", d: "记录代码每次改动的系统。Git 是分布式版本控制工具，能分支、合并、回退", where: "软件工程 · 第 5 讲" },
        { t: "单元测试（unit test）", en: "unit test", d: "针对最小代码单元写的自动检查，能快速发现回归问题", where: "软件工程 · 第 4 讲" },
        { t: "重构（refactoring）", en: "refactoring", d: "不改变外部行为的前提下改善代码结构，降低后续修改成本", where: "软件工程 · 第 3 讲" }
      ]
    },
    {
      cat: "数学基础",
      items: [
        { t: "极限（limit）", en: "limit", d: "描述「无限接近」的严格工具：ε-N / ε-δ 语言把「要多近有多近」变成可证明的命题", where: "数学分析（一）· 第 2~3 讲" },
        { t: "导数（derivative）", en: "derivative", d: "函数在某点的瞬时变化率，几何上是切线斜率。它是「线性逼近」的最佳系数", where: "数学分析（一）· 第 4 讲" },
        { t: "积分（integral）", en: "integral", d: "把无穷多个无穷小的贡献加起来。定积分由黎曼和取极限定义，与导数通过微积分基本定理相连", where: "数学分析（一）· 第 6 讲" },
        { t: "矩阵（matrix）与特征值", en: "matrix / eigenvalue", d: "矩阵是线性变换的表格表示；特征值 λ 描述变换在某个方向上的伸缩倍数，对应方向叫特征向量", where: "高等代数（二）· 第 1 讲" },
        { t: "向量空间（vector space）", en: "vector space", d: "能做加法与数乘并满足八条公理的集合。基与维数刻画它的「大小」。", where: "" },
        { t: "群 / 环 / 域", en: "group / ring / field", d: "三种基本代数结构：群只有一种运算；环有两种（如整数）；域还能做除法（如有理数、实数）", where: "抽象代数 · 第 1~4 讲" },
        { t: "概率空间（probability space）", en: "probability space", d: "样本空间 + 事件域 + 概率测度。公理化定义让概率脱离「频率直觉」，成为可推理的对象", where: "概率论 · 第 1 讲" },
        { t: "期望与方差", en: "expectation / variance", d: "期望是长期平均值，方差衡量波动大小。注意期望的线性性不需要独立性，而 E(XY)=EX·EY 需要", where: "概率论 · 第 4 讲" },
        { t: "中心极限定理（CLT）", en: "Central Limit Theorem", d: "大量独立同分布随机变量之和（标准化后）近似服从正态分布，这是统计推断的基石", where: "概率论 · 第 5 讲" },
        { t: "假设检验 / p 值", en: "hypothesis testing / p-value", d: "用样本判断「原假设是否可信」。p 值是在原假设成立时出现当前或更极端结果的概率，不是原假设为真的概率", where: "数理统计 · 第 4 讲" },
        { t: "测度（measure）", en: "measure", d: "给集合赋「大小」的函数，满足可数可加性。勒贝格测度让积分能处理比黎曼积分更「病态」的函数", where: "实变函数 · 第 2 讲" },
        { t: "泛函（functional）", en: "functional", d: "定义在函数空间上的函数（输入是函数，输出是数）。泛函分析研究这类空间与算子", where: "泛函分析 · 第 1~3 讲" }
      ]
    }
  ];

  global.GLOSSARY = {
    cats: TERMS,
    flat: function () {
      var out = [];
      TERMS.forEach(function (c) {
        c.items.forEach(function (it) {
          out.push({ cat: c.cat, t: it.t, en: it.en, d: it.d, where: it.where });
        });
      });
      return out;
    },
    count: function () { return TERMS.reduce(function (n, c) { return n + c.items.length; }, 0); }
  };
})(window);
