window.COURSE_PACKS.push({
  id: "data-structures",
  title: "数据结构",
  icon: "🧱",
  term: "大二上",
  advanced: {texts:["CLRS 第 10~13、18 章","《数据结构与算法分析》Weiss","《编程珠玑》（讲工程直觉）"],labs:["从零实现：动态数组、双向链表、循环队列、哈希表（两种冲突处理）","用单调栈/单调队列解决 5 道典型题"],project:"实现一个内存索引库：B+ 树 + 哈希索引，支持插入/删除/范围查询并做性能对比",criteria:"能白板写出 B+ 树插入分裂全过程；能说清每种结构的时间/空间代价与缓存友好性"},
  need: "建议先能读懂一段 C 或 Python 代码（会变量、循环、函数、数组）。这是全站后续课程的共同地基。",
  hours: 64,
  blurb: "数据结构是考研 408 与后续所有专业课的地基：它教你为数据选一种组织方式，并用可计算的代价（时间与空间）解释每一种选择。本课程从复杂度分析讲到图与哈希表，每一步都算清代价，而不是背 API。",
  tags: ["考研408", "专业核心", "算法基础"],
  lessons: [
    {
      id: "ds-complexity",
      title: "算法分析与复杂度：给代价定一个可比较的尺度",
      goal: "学完后你能用大 O / 大 Ω / 大 Θ 三种记号描述一个算法的代价，能手算程序段的执行次数，能区分最好、最坏、平均与均摊分析，并能用主定理判断分治递归的复杂度量级。",
      est: 40,
      blocks: [
        {
          type: "concept",
          title: "为什么需要渐进复杂度（asymptotic complexity）",
          md: "同一段代码在两台机器上跑出的秒数不可比：编译器、CPU 主频、缓存大小、输入数据分布都会影响它。工程上真正稳定的结论只有一个——**当输入规模 n 趋向无穷时，运行时间随 n 增长的量级**。\n\n三种记号描述的是三种不同的信息：\n\n- 大 O（big-O，上界）：$f(n) = O(g(n))$ 表示存在常数 $c > 0$ 与 $n_0 > 0$，当 $n \\ge n_0$ 时恒有 $f(n) \\le c\\,g(n)$。它说的是「再坏也不会比 g 这一档更坏」，是最常用的**承诺**。\n- 大 Ω（big-Omega，下界）：$f(n) = \\Omega(g(n))$ 表示存在 $c > 0$、$n_0 > 0$，当 $n \\ge n_0$ 时恒有 $f(n) \\ge c\\,g(n)$。它说的是「至少要花这么多」。\n- 大 Θ（big-Theta，紧确界）：同时满足上界与下界，$c_1 g(n) \\le f(n) \\le c_2 g(n)$。它说的是「量级恰好如此」。\n\n例：$f(n) = 3n + 5$，取 $c = 8$、$n_0 = 1$，当 $n \\ge 1$ 时 $3n + 5 \\le 8n$ 恒成立，所以 $f(n) = O(n)$；同时 $3n + 5 \\ge 3n$，所以 $f(n) = \\Omega(n)$；两头都成立，故 $f(n) = \\Theta(n)$。\n\n408 常考的正是这层含义：**说 O 必须给得出 c 与 n0，说 Θ 必须两头都成立**。"
        },
        {
          type: "concept",
          title: "为什么常数因子可以被丢掉",
          md: "把 $3n+5$ 写成 $O(n)$，不是「忽略细节」，而是**把与 n 无关的加法项和固定倍数一起归一化**：\n\n- 加法项被吞掉：$n$ 一旦超过某个常数（这里 $n > \\frac{5}{3}$），$3n$ 就压过了 $+5$，所以 $+5$ 不影响增长量级。\n- 常数倍数被坐标缩放吸收：$3n$ 与 $n$ 只差一个横轴缩放，曲线的形状与交叉点顺序完全一致。\n\n于是常用复杂度从小到大排成一条固定阶梯（408 选择题高频考点）：\n\n$O(1) < O(\\log n) < O(n) < O(n \\log n) < O(n^2) < O(n^3) < O(2^n) < O(n!)$\n\n值得注意的是其中两条：\n\n1. $\\log n$ 的底数与常数倍无关紧要，因为换底只差一个常数因子，所以 $\\log_2 n$、$\\log_{10} n$、$\\ln n$ 都写作 $O(\\log n)$。\n2. 这与「工程优化」并不矛盾。渐进阶决定**可行性边界**（$n = 10^6$ 时 $O(n^2)$ 根本跑不完），而同一阶内的常数因子决定**实际快慢**（同样是 $O(n \\log n)$，快排的常数就比归并小）。所以「优化常数」和「换算法降阶」是两件事，都不能省。"
        },
        {
          type: "concept",
          title: "最好、最坏、平均、均摊：四种「代价」不是一回事",
          md: "同一份代码在不同输入上代价可以相差极大，所以要明确说的是哪一种：\n\n以「在长度为 n 的顺序表中顺序查找（sequential search）关键字 k」为例：\n\n- 最好情况（best case）：k 就在第 1 个位置，比较 1 次，$T_{\\text{best}} = O(1)$。\n- 最坏情况（worst case）：k 不存在或在末尾，比较 n 次，$T_{\\text{worst}} = O(n)$。**工程承诺只看最坏情况**，因为它是任何输入都不会突破的上界。\n- 平均情况（average case）：设 k 等概率出现在任一位置，$T_{\\text{avg}} = \\frac{1+2+\\cdots+n}{n} = \\frac{n+1}{2} = O(n)$。注意平均情况必须依赖一个**概率假设**，假设变了结论就变。\n- 均摊情况（amortized case）：它**完全不依赖概率**，是把一串操作的总代价摊到每一步上。最有名的例子是动态数组的尾部追加：第 n 次插入如果正好触发扩容，那一次要拷贝 n 个元素（$O(n)$），但把扩容成本摊到前面 n 次插入上，平均每次只有 $O(1)$。\n\n最容易混的就是最后两个：**平均情况是「随机输入下的期望」，均摊是「最坏操作序列下每人分摊多少」**。均摊分析给出的是确定性保证：任意一串操作的总代价不超标，跟运气无关。"
        },
        {
          type: "code",
          lang: "c",
          title: "数执行次数：三层嵌套循环到底跑了多少次",
          code: "#include <stdio.h>\n#include <stdlib.h>\n\n/* 计算 1+2+...+n 的朴素写法里，加法到底执行了多少次 */\nlong long count_inner(int n) {\n    long long count = 0;\n    int i, j, k;\n    for (i = 1; i <= n; i++)            /* n 趟              */\n        for (j = 1; j <= i; j++)        /* 第 i 趟跑 i 次    */\n            for (k = 1; k <= j; k++)    /* 第 j 趟跑 j 次    */\n                count++;                /* 总次数 = sum sum j */\n    return count;\n}\n\n/* 带条件的双重循环：统计 i+j 为偶数的组合数 */\nlong long count_even(int n) {\n    long long count = 0;\n    int i, j;\n    for (i = 1; i <= n; i++)\n        for (j = 1; j <= n; j++)\n            if ((i + j) % 2 == 0)\n                count++;\n    return count;\n}\n\nint main(void) {\n    int n;\n    /* 验证公式：sum_{i=1..n} sum_{j=1..i} j = n(n+1)(n+2)/6 */\n    for (n = 1; n <= 8; n++) {\n        long long formula = (long long)n * (n + 1) * (n + 2) / 6;\n        printf(\"n=%d  实测=%lld  公式=%lld  %s\\n\",\n               n, count_inner(n), formula,\n               count_inner(n) == formula ? \"OK\" : \"MISMATCH\");\n    }\n    for (n = 2; n <= 8; n += 2) {\n        long long half = (long long)n * n / 2;   /* 一半组合满足条件 */\n        printf(\"n=%d  实测=%lld  公式 n^2/2=%lld  %s\\n\",\n               n, count_even(n), half,\n               count_even(n) == half ? \"OK\" : \"MISMATCH\");\n    }\n    return 0;\n}"
        },
        {
          type: "code",
          lang: "python",
          title: "同一份计数逻辑的 Python 对照（行为完全一致）",
          code: "# 与上面的 C 版本逐行对应，输出结果也完全一致\n\n\ndef count_inner(n):\n    \"\"\"sum_{j=1..i} j 对 i=1..n 求和，即 n(n+1)(n+2)/6\"\"\"\n    count = 0\n    for i in range(1, n + 1):        # 第 i 趟\n        for j in range(1, i + 1):    # 跑 i 次\n            for k in range(1, j + 1):  # 跑 j 次\n                count += 1\n                return count\n\n\n                def count_even(n):\n                    count = 0\n                    for i in range(1, n + 1):\n                        for j in range(1, n + 1):\n                            if (i + j) % 2 == 0:\n                                count += 1\n                                return count\n\n\n                                for n in range(1, 9):\n                                    formula = n * (n + 1) * (n + 2) // 6\n                                    ok = \"OK\" if count_inner(n) == formula else \"MISMATCH\"\n                                    print(\"n=%d  实测=%d  公式=%d  %s\" % (n, count_inner(n), formula, ok))\n\n                                    for n in range(2, 9, 2):\n                                        half = n * n // 2\n                                        ok = \"OK\" if count_even(n) == half else \"MISMATCH\"\n                                        print(\"n=%d  实测=%d  公式 n^2/2=%d  %s\" % (n, count_even(n), half, ok))\n\n                                        # 两个版本都会打印 MISMATCH 字样吗？不会：实测值与公式在 n<=8 上全部相等。"
        },
        {
          type: "calc",
          title: "手算：程序段的执行次数",
          inputs: [
            { name: "程序段", value: "for(i=1;i<=n;i++) for(j=1;j<=i;j++) x++; 且 n 取 10" },
            { name: "内层规律", value: "外层第 i 趟内层执行 i 次，故总次数 $= 1+2+\\cdots+n = \\frac{n(n+1)}{2}$" }
          ],
          outputs: [
            "$n = 10$ 时执行次数 $= \\frac{10 \\times 11}{2} = 55$ 次",
            "一般结论：$T(n) = \\frac{n(n+1)}{2} = 0.5n^2 + 0.5n$，所以 $T(n) = O(n^2)$（同时是 $\\Theta(n^2)$）",
            "若内层改为 for(j=1;j<=n;j++)，则执行 $n^2$ 次，同为 $O(n^2)$，但 $n = 10$ 时是 100 次而不是 55 次",
            "若外层是 while(n>1) n=n/2，则执行 $\\lfloor \\log_2 n \\rfloor$ 次，$T(n) = O(\\log n)$"
          ],
          note: "408 常把「执行次数」「时间复杂度」分开问：前者要一个确切数字，后者只问量级。别把 55 当成答案写进复杂度那一栏。"
        },
        {
          type: "interactive",
          lab: "datalab",
          title: "单步数出程序段的执行次数",
          config: {
            state: { i: "未开始", j: "未开始", sum: 0, count: 0 },
            steps: [
              { desc: "第 1 步：初始化，sum=0、count=0、i=1", state: { i: 1, j: "未开始", sum: 0, count: 0 }, note: "计数器 count 记录 x++ 真正执行的次数，这是复杂度的直接证据。" },
              { desc: "第 2 步：i=1，内层 j 从 1 到 1，执行 1 次", state: { i: 1, j: 1, sum: 1, count: 1 }, note: "内层次数 = i，所以这一趟只贡献 1 次。" },
              { desc: "第 3 步：i=2，内层 j=1..2，累计 1+2=3 次", state: { i: 2, j: 2, sum: 3, count: 3 }, note: "sum 每步加 j 的当前值，累加结果与 count 同步。" },
              { desc: "第 4 步：i=3，内层 j=1..3，累计 1+2+3=6 次", state: { i: 3, j: 3, sum: 6, count: 6 }, note: "$6 = 3 \\times 4/2$，正好是 $\\frac{n(n+1)}{2}$ 在 $n = 3$ 时的值。" },
              { desc: "第 5 步：i=4，内层 j=1..4，累计 10 次", state: { i: 4, j: 4, sum: 10, count: 10 }, note: "每加一层，增量都是 i，所以总和是三角形数。" },
              { desc: "第 6 步：i=5 收尾，总计 $15 = 5 \\times 6/2$ 次", state: { i: 5, j: 5, sum: 15, count: 15 }, note: "执行次数 15 是确切值；若被问复杂度，应答 $T(n)=O(n^2)$，两者不要混答。" }
            ],
            tasks: [
              { t: "把内层条件改成 j<=n，重跑一遍，说说 count 实际变成多少、复杂度是否变化。", hint: "n=5 时是 25 而不是 15。", check: "能说出次数从 $\\frac{n(n+1)}{2}$ 变成 $n^2$，但复杂度同为 $\\Theta(n^2)$。" },
              { t: "把外层改成 i*=2，记录每步 i 的取值，写出循环次数与 log2(n) 的关系。", hint: "i 的序列是 1,2,4,8,...。", check: "能给出次数 $= \\lfloor \\log_2 n \\rfloor + 1$ 的结论。" }
            ]
          }
        },
        {
          type: "pitfall",
          title: "复杂度分析里最常踩的坑",
          items: [
            "把 O 当成「约等于」：O 只说上界。$f(n) = n$ 既可以写 $O(n)$，也可以写 $O(n^2)$（因为 $n \\le n^2$），但只有 $O(n)$ 是紧的；考试问「时间复杂度」时默认写紧确界。",
            "以为循环层数就等于复杂度指数：双层循环不一定是 $O(n^2)$。若内层规模随外层减半，总次数是 $n + \\frac{n}{2} + \\frac{n}{4} + \\cdots = 2n$，仍是 $O(n)$。",
            "把平均情况当成均摊：平均情况要求概率假设，均摊是确定性的最坏序列结论。动态数组扩容的 O(1) 是均摊，不是平均。",
            "忽略递归的空间代价：递归深度 d 就要 d 层栈帧，空间复杂度至少 $O(d)$。归并排序要 $O(n)$ 辅助数组，快速排序平均 $O(\\log n)$、最坏 $O(n)$ 递归栈。",
            "误用主定理：$T(n) = 2T(n/2) + n$ 中 $n^{\\log_b a} = n^1$ 与 $f(n) = n$ 同阶，落在主定理第二种情形，答案是 $\\Theta(n \\log n)$，不是 $\\Theta(n)$。"
          ]
        },
        {
          type: "lab",
          title: "上机任务：用计时器验证复杂度量级",
          steps: [
            "写一个函数，用朴素双重循环统计长度为 n 的数组中逆序对个数，分别取 n=1000、2000、4000，记录运行时间。",
            "写第二个函数，用「归并排序过程中统计逆序对」的方法解决同一问题，取同样的 n 记录时间。",
            "把两组的 n 翻倍，观察时间增长的倍数：$O(n^2)$ 应当约变成 4 倍，$O(n \\log n)$ 约变成 2.2 倍。",
            "用同一台机器、同一份数据重复 3 次取中位数，把结论写进实验报告：为什么实测比例与理论比例不完全相等？"
          ],
          note: "本任务不要求得到精确倍率，而是要你亲手看到「降阶」带来的差距远大于常数优化。"
        }
      ],
      quiz: [
        {
          id: "ds-complexity-q1",
          type: "single",
          q: "关于大 O 记号 $f(n) = O(g(n))$ 的定义，下列说法正确的是？",
          options: [
            "存在常数 $c > 0$ 与 $n_0 > 0$，当 $n \\ge n_0$ 时恒有 $f(n) \\le c\\,g(n)$，即 g 是 f 的一个渐进上界",
            "对一切 $n \\ge 1$ 都恒有 $f(n) \\le g(n)$，即 g 是 f 的逐点上界",
            "$f(n)$ 与 $g(n)$ 的比值随 $n$ 增大而趋近于 1，即两者渐进相等",
            "存在常数 $c > 0$ 与 $n_0 > 0$，当 $n \\ge n_0$ 时恒有 $f(n) \\ge c\\,g(n)$，即 g 是 f 的下界"
          ],
          answer: 0,
          why: "大 O 的定义允许乘一个正常数 c，并只要求从某个 $n_0$ 起成立，A 正是这个含义。B 错在要求逐点成立且 c 只能是 1，那样连 $f(n) = 3n$ 都不满足 $O(n)$，定义过严；C 描述的是等价无穷小式的渐进相等，属于 $\\Theta$ 的更强情形；D 是 $\\Omega$ 的定义，方向说反了。"
        },
        {
          id: "ds-complexity-q2",
          type: "multi",
          q: "关于复杂度分析的下列判断，哪些是错误的？",
          options: [
            "双层 for 循环的时间复杂度一定是 $O(n^2)$",
            "若 $f(n) = O(g(n))$ 且 $g(n) = O(h(n))$，则 $f(n) = O(h(n))$，即大 O 具有传递性",
            "递归算法的空间复杂度总是 $O(1)$，因为不需要额外数组",
            "平均情况分析与均摊分析是同一件事，都描述每次操作的平均代价"
          ],
          answer: [0, 2, 3],
          why: "A 错：内层规模随外层递减（如折半）时总次数可能只有 $O(n)$ 或 $O(n \\log n)$，层数不等于阶。C 错：递归的栈帧随深度增长，递归深度 $d$ 就占 $O(d)$ 空间，例如朴素快速排序最坏是 $O(n)$。D 错：平均情况依赖输入的概率分布，均摊分析是对最坏操作序列的总代价做确定性分摊，二者前提不同。B 正确，是大 O 的基本性质，所以不选。"
        },
        {
          id: "ds-complexity-q3",
          type: "fill",
          q: "程序段 for(i=1;i<=n;i++) for(j=1;j<=i;j++) x++; 中语句 x++ 的执行次数为 $\\frac{n(n+1)}{2}$，该算法的时间复杂度是 ____（用大 O 记号填写）。",
          answer: ["O(n^2)", "O（n^2）", "O(n²)", "O（n²）", "Θ(n^2)", "Θ(n²)"],
          why: "执行次数 $\\frac{n(n+1)}{2} = 0.5n^2 + 0.5n$，最高次项是 $n^2$，常数系数 0.5 与低次项在渐进意义下被吸收，所以复杂度为 $O(n^2)$。若答 $O(n)$ 是把「内层平均 n/2 次」错误地当成了线性；若答 $O(n^3)$ 是误以为要乘上循环层数，而层数本身不构成指数。"
        },
        {
          id: "ds-complexity-q4",
          type: "single",
          q: "已知递归式 $T(n) = 2T(n/2) + n$（$n > 1$），$T(1) = 1$。按主定理（master theorem）判断 $T(n)$ 的渐进界是？",
          options: [
            "$\\Theta(n \\log n)$",
            "$\\Theta(n)$",
            "$\\Theta(n^2)$",
            "$\\Theta(\\log n)$"
          ],
          answer: 0,
          why: "主定理中 $a = 2$、$b = 2$，故 $n^{\\log_b a} = n^1$，与 $f(n) = n$ 同阶，属于第二种情形（两侧平衡），需要额外乘一个 log 因子，得 $\\Theta(n \\log n)$，这正是归并排序的复杂度。选 B 的人漏掉了「每层合并要 O(n)、共 log n 层」的乘积；选 C 相当于把 a 当成 4 或只看了 f(n) 就乱加阶；选 D 只在每层规模减半且只递归一支时（如二分查找 $T(n) = T(n/2) + O(1)$）才成立。"
        }
      ]
    },
    {
      id: "ds-array-list",
      title: "线性表与数组：顺序表的移动代价与动态扩容",
      goal: "学完后你能推导长度为 n 的顺序表插入、删除的平均移动次数，能解释动态数组扩容为什么是均摊 $O(1)$，并能针对「随机访问 vs 频繁插入删除」给出 Python list、C 数组、链表之间的取舍理由。",
      est: 45,
      blocks: [
        {
          type: "concept",
          title: "顺序表（sequential list）插入的平均移动次数是怎么来的",
          md: "线性表（linear list）有两种主流实现：顺序存储（数组，array）与链式存储（链表，linked list）。顺序表的本质是**用连续内存 + 下标公式直接定位**：第 $i$ 个元素的地址是 $\\text{base} + (i-1) \\times \\text{sizeof}(\\text{ElemType})$，所以按下标访问是 $O(1)$ 的，这是它唯一无法被链表替代的优势。\n\n代价出现在插入与删除：要在位置 i 插入一个新元素，必须先把 i 及其之后的元素整体后移一格，腾出空位——否则会覆盖掉原来的数据。\n\n设表长为 n（已有 n 个元素），插入位置有 n+1 种合法可能（第 1 个之前到第 n 个之后）。为「在第 $i$ 个位置插入」需要移动 $n-i+1$ 个元素，列表如下（以 $n = 8$ 为例）：\n\n- 插在第 1 位：移动 8 个\n- 插在第 4 位：移动 5 个\n- 插在第 8 位：移动 1 个\n- 插在第 9 位（表尾之后）：移动 0 个\n\n若 n+1 个位置**等概率**，平均移动次数为：\n\n$$\\frac{n + (n-1) + \\cdots + 1 + 0}{n+1} = \\frac{n(n+1)/2}{n+1} = \\frac{n}{2}$$\n\n所以顺序表插入平均要搬 $\\frac{n}{2}$ 个元素，时间复杂度 $O(n)$。注意分母是 $n+1$ 而不是 $n$——因为合法插入位置比元素个数多一个，这正是本题最常见的失分点。"
        },
        {
          type: "concept",
          title: "删除的平均移动次数与「查快改慢」的本质",
          md: "删除与插入互为逆操作。在长度为 n 的顺序表中删除第 i 个元素后，必须把第 $i+1$ 到第 $n$ 个元素整体前移一格，共移动 $n-i$ 个元素（注意删除不需要补空位，所以最后一个元素移动 0 次，位置只有 n 种可能）：\n\n- 删除第 1 个：移动 7 个（n=8）\n- 删除第 4 个：移动 4 个\n- 删除第 8 个（表尾）：移动 0 个\n\n等概率下平均移动次数为：\n\n$$\\frac{(n-1) + (n-2) + \\cdots + 1 + 0}{n} = \\frac{n(n-1)/2}{n} = \\frac{n-1}{2}$$\n\n同样是 $O(n)$，但比插入略小，因为少了一个「插在表尾不用搬」的位置在拉低平均值。\n\n于是顺序表的性格就很清楚了：**按下标读写 $O(1)$，按位置插入删除 $O(n)$**。更关键的一点是，这个 $\\frac{n}{2}$ 的移动代价不仅仅是一个计数——它对应真实的 「memmove」，是每次几万个字节的内存搬运。这就是为什么「顺序表适合查、链表适合改」不是背下来的口诀，而是可计算的结论：\n\n- 若你的操作 90% 是按下标随机访问，选顺序表；\n- 若你的操作 90% 是在已知位置频繁插入删除，选链表。\n\n唯一要补的例外：**在表尾插入删除，顺序表是 $O(1)$**（不涉及移动），所以「只在尾部增删」的场景下顺序表完胜链表。"
        },
        {
          type: "concept",
          title: "动态数组（dynamic array）扩容：均摊 O(1)，但不是平均 O(1)",
          md: "静态数组的容量在编译期固定，装不下就溢出。动态数组的做法是：**容量满时申请一块更大的连续空间，把老元素整体搬过去，再释放旧空间**。\n\n如果每次只多要 1 个格子，那么第 $i$ 次追加都要搬 $i$ 个元素，$n$ 次追加的总搬运量是 $1+2+\\cdots+n = O(n^2)$，均摊下来每次仍是 $O(n)$——这等于白忙。\n\n采用**倍增（doubling）**策略就好得多：容量按 1、2、4、8…… 翻倍增长。此时搬运只发生在容量达到 1、2、4、8 这些位置，总搬运量为：\n\n${1 + 2 + 4 + \\cdots + \\frac{n}{2} < n}$（几何级数求和），加上最后一次可能搬到 $n$，总量仍是 $O(n)$。\n\n把 $O(n)$ 的总代价摊到 $n$ 次追加上，**每次追加的均摊代价是 $O(1)$**。这不是概率意义上的「平均」，而是确定性结论：任何一串 $n$ 次追加的总代价都不会超过 $c \\cdot n$。\n\n代价当然存在，只是被藏起来了：\n\n1. **单次最坏 $O(n)$**：正好触发扩容的那一次追加会明显卡顿，实时系统里不可接受。\n2. **空间浪费**：容量可能长期停留在元素数的 2 倍左右，装填率低时浪费一半内存。\n3. **失效的引用**：扩容换地址后，之前保存的指针、迭代器、切片视图全部失效（这是 C++ 「vector」 与 Python 对象引用层面的经典 bug 来源）。\n\n工程结论：**扩容因子必须是一个大于 1 的常数**（Python 的 list 用约 1.125 倍的精细增长，C++ 的 vector 常用 2 倍），只要因子 $> 1$，均摊代价就是 $O(1)$；但如果扩容因子趋向 1，均摊代价会退化回 $O(n)$。"
        },
        {
          type: "code",
          lang: "c",
          title: "顺序表的插入与删除：数清移动了多少个元素",
          code: "#include <stdio.h>\n#define MAXSIZE 20\n\ntypedef struct {\n    int data[MAXSIZE];\n    int length;\n} SqList;\n\n/* 在第 pos 个位置（1..length+1）插入 e，返回实际移动的元素个数，失败返回 -1 */\nint list_insert(SqList *L, int pos, int e) {\n    int i, moved = 0;\n    if (pos < 1 || pos > L->length + 1) return -1;  /* 位置非法 */\n    if (L->length >= MAXSIZE) return -1;            /* 表满，静态分配无法扩容 */\n    for (i = L->length; i >= pos; i--) {            /* 从后往前搬，避免覆盖 */\n        L->data[i] = L->data[i - 1];\n        moved++;\n    }\n    L->data[pos - 1] = e;\n    L->length++;\n    return moved;\n}\n\n/* 删除第 pos 个元素，用 *out 带回被删值，返回实际移动的元素个数，失败返回 -1 */\nint list_delete(SqList *L, int pos, int *out) {\n    int i, moved = 0;\n    if (pos < 1 || pos > L->length) return -1;\n    *out = L->data[pos - 1];\n    for (i = pos; i < L->length; i++) {             /* 从前往后搬，补齐空洞 */\n        L->data[i - 1] = L->data[i];\n        moved++;\n    }\n    L->length--;\n    return moved;\n}\n\nstatic void print_list(const SqList *L) {\n    int i;\n    printf(\"[\");\n    for (i = 0; i < L->length; i++) printf(\"%d%s\", L->data[i], i + 1 < L->length ? \",\" : \"\");\n    printf(\"]\\n\");\n}\n\nint main(void) {\n    SqList L;\n    int i, moved, out;\n    L.length = 0;\n    for (i = 0; i < 8; i++) list_insert(&L, i + 1, i + 1);  /* 依次插入 1..8 */\n    printf(\"初始表：\"); print_list(&L);\n\n    moved = list_insert(&L, 1, 99);\n    printf(\"在第 1 位插入 99：移动 %d 个元素 -> \", moved); print_list(&L);\n\n    moved = list_insert(&L, 5, 77);\n    printf(\"在第 5 位插入 77：移动 %d 个元素 -> \", moved); print_list(&L);\n\n    moved = list_insert(&L, L.length + 1, 55);\n    printf(\"在表尾插入 55：移动 %d 个元素 -> \", moved); print_list(&L);\n\n    moved = list_delete(&L, 1, &out);\n    printf(\"删除第 1 位（值 %d）：移动 %d 个元素 -> \", out, moved); print_list(&L);\n\n    moved = list_delete(&L, L.length, &out);\n    printf(\"删除表尾（值 %d）：移动 %d 个元素\\n\", out, moved);\n    return 0;\n}"
        },
        {
          type: "code",
          lang: "python",
          title: "Python 对照实现 + list 的摊销式扩容",
          code: "# 与 C 版本行为一致：同样打印每次插入/删除移动了多少个元素\n\n\ndef list_insert(data, pos, e):\n    \"\"\"在第 pos 个位置（1..len+1）插入 e，返回移动的元素个数（模拟搬移过程）\"\"\"\n    if pos < 1 or pos > len(data) + 1:\n        return -1\n        moved = 0\n        data.append(None)                 # 先扩容一个槽位\n        for i in range(len(data) - 1, pos - 1, -1):  # 从后往前搬\n            data[i] = data[i - 1]\n            moved += 1\n            data[pos - 1] = e\n            return moved\n\n\n            def list_delete(data, pos):\n                \"\"\"删除第 pos 个元素，返回 (被删值, 移动元素个数)\"\"\"\n                if pos < 1 or pos > len(data):\n                    return None, -1\n                    out = data[pos - 1]\n                    moved = 0\n                    for i in range(pos, len(data)):   # 从前往后搬，补齐空洞\n                        data[i - 1] = data[i]\n                        moved += 1\n                        data.pop()\n                        return out, moved\n\n\n                        lst = []\n                        for i in range(1, 9):\n                            list_insert(lst, len(lst) + 1, i)\n                            print(\"初始表：\", lst)\n\n                            print(\"在第 1 位插入 99：移动 %d 个元素 -> %s\" % (list_insert(lst, 1, 99), lst))\n                            print(\"在第 5 位插入 77：移动 %d 个元素 -> %s\" % (list_insert(lst, 5, 77), lst))\n                            print(\"在表尾插入 55：移动 %d 个元素 -> %s\" % (list_insert(lst, len(lst) + 1, 55), lst))\n\n                            out, moved = list_delete(lst, 1)\n                            print(\"删除第 1 位（值 %d）：移动 %d 个元素 -> %s\" % (out, moved, lst))\n                            out, moved = list_delete(lst, len(lst))\n                            print(\"删除表尾（值 %d）：移动 %d 个元素\" % (out, moved))\n\n                            # 观察 CPython 真实的增长策略：真跑一遍需要标准库的 sys.getsizeof 支持，\n                            # 这里不依赖任何模块，改用「记录每次追加后的元素个数」来复现同样的倍增节奏：\n                            # 倍增意味着「触发再次分配」的追加次数按 1、2、4、8…… 的节奏稀疏下去。\n\n                            def doubling_schedule(n):\n                                \"\"\"模拟容量倍增策略：返回每次触发扩容时的元素个数，以及总搬运次数\"\"\"\n                                capacity = 1\n                                moved_total = 0\n                                events = []\n                                for i in range(1, n + 1):\n                                    if i > capacity:                 # 装不下了，先扩容再搬移\n                                        events.append((i, capacity))\n                                        moved_total += capacity      # 把老元素整体搬到新空间\n                                        capacity *= 2\n                                        return events, moved_total, capacity\n\n\n                                        events, moved_total, capacity = doubling_schedule(16)\n                                        for need, cap in events:\n                                            print(\"追加第 %d 个元素时容量不足（原容量 %d），扩容并搬运 %d 个元素\" % (need, cap, cap))\n                                            print(\"追加 16 个元素共搬运 %d 次，均摊 %.2f 次/次；最终容量 %d\"\n                                                % (moved_total, moved_total / 16.0, capacity))\n\n                                            # 对照实验：若改成「每满只扩 1 个格子」，总搬运量会退化成 1+2+...+15 = 120 次。\n                                            naive_move = sum(range(1, 16))\n                                            print(\"逐格扩容的总搬运 = %d，均摊 %.2f 次/次（退化为 O(n)）\" % (naive_move, naive_move / 16.0))"
        },
        {
          type: "calc",
          title: "手算：平均移动次数与扩容总搬运量",
          inputs: [
            { name: "顺序表长度", value: "$n = 8$，插入位置共 9 种且等概率" },
            { name: "动态数组策略", value: "初始容量 1，每次满则容量翻倍；共追加 $n = 16$ 个元素" }
          ],
          outputs: [
            "插入平均移动次数 $= \\frac{n}{2} = \\frac{8}{2} = 4$ 次（插第 1 位移动 8 次，插第 9 位移动 0 次，总和 36，36/9 = 4）",
            "删除平均移动次数 $= \\frac{n-1}{2} = \\frac{7}{2} = 3.5$ 次（总和 28，28/8 = 3.5）",
            "插入表头单次最坏移动 8 次，删除表头单次最坏移动 7 次，均为 $O(n)$",
            "追加 16 个元素：容量在 1、2、4、8、16 处触发搬运，总搬运 $1+2+4+8 = 15$ 次，均摊到 16 次追加上约为 $15/16$ 次/次，即 $O(1)$",
            "若改成「每满一次只扩 1 个格子」，追加 16 个元素的总搬运量为 $1+2+\\cdots+15 = 120$ 次，均摊 $120/16 = 7.5$ 次/次，退化为 $O(n)$"
          ],
          note: "注意「插入平均 $\\frac{n}{2}$」的分母是 $n+1$ 种位置；「扩容均摊 $O(1)$」的前提是扩容因子为大于 1 的常数。这两点都是 408 计算题的踩分点。"
        },
        {
          type: "interactive",
          lab: "datalab",
          title: "单步看顺序表插入：元素是怎么被搬走的",
          config: {
            state: { 步骤: "初始化", 表: "3 5 7 9", 长度: 4, 移动次数: 0 },
            steps: [
              { desc: "第 1 步：初始顺序表 [3,5,7,9]，长度 4，准备在第 1 位插入 1", state: { 步骤: "定位插入点", 表: "3 5 7 9", 长度: 4, 移动次数: 0 }, note: "在第 1 位插入要移动 $n-pos+1 = 4$ 个元素，是本题的最坏情况。" },
              { desc: "第 2 步：把第 4 个元素 9 搬到下标 5", state: { 步骤: "搬 9", 表: "3 5 7 _ 9", 长度: 4, 移动次数: 1 }, note: "必须从后往前搬，否则 3 会覆盖掉 5，数据被破坏。" },
              { desc: "第 3 步：把 7 搬到下标 4", state: { 步骤: "搬 7", 表: "3 5 _ 7 9", 长度: 4, 移动次数: 2 }, note: "每搬一个元素，移动计数器加 1。" },
              { desc: "第 4 步：把 5 搬到下标 3", state: { 步骤: "搬 5", 表: "3 _ 5 7 9", 长度: 4, 移动次数: 3 }, note: "此时下标 2 已经空出，等待写入新值。" },
              { desc: "第 5 步：把 3 搬到下标 2", state: { 步骤: "搬 3", 表: "_ 3 5 7 9", 长度: 4, 移动次数: 4 }, note: "4 次移动，与公式 $n-pos+1 = 4-1+1 = 4$ 完全一致。" },
              { desc: "第 6 步：写入 1，长度加 1", state: { 步骤: "写入完成", 表: "1 3 5 7 9", 长度: 5, 移动次数: 4 }, note: "插入成功。若插在表尾（第 5 位），移动次数为 0，这就是尾插 $O(1)$ 的原因。" }
            ],
            tasks: [
              { t: "把插入位置改成第 3 位（值 6），重新数一遍移动次数，与公式 $n-pos+1$ 对照。", hint: "只需要搬 7 和 9 两个元素。", check: "能算出移动 2 次并说明公式来源。" },
              { t: "在同一张表上执行「删除第 1 位」，数出移动次数，推导等概率删除的平均值 $\\frac{n-1}{2}$。", hint: "删除要从前向后搬。", check: "能算出删除第 1 位移动 4 次，并给出 $n = 5$ 时平均 $\\frac{5-1}{2} = 2$ 次。" }
            ]
          }
        },
        {
          type: "pitfall",
          title: "顺序表实现中的经典错误",
          items: [
            "插入搬移方向写反：插入必须**从后往前**搬（否则前面的元素被覆盖），删除必须**从前往后**搬（否则空洞后面的数据被跳过）。两者方向写反会静默地损坏数据，编译不报错。",
            "把插入的平均移动次数记成 $\\frac{n+1}{2}$ 或 $\\frac{n}{2}$ 却用错分母：合法插入位置是 n+1 个，和为 $\\frac{n(n+1)}{2}$，平均 $\\frac{n}{2}$；删除位置是 n 个，和为 $\\frac{n(n-1)}{2}$，平均 $\\frac{n-1}{2}$。",
            "下标体系混乱：C 数组用 0..n-1，教材顺序表用 1..n。混用时循环边界会差一，考试里位置参数通常按 1 起始，写代码前先说清约定。",
            "以为『链表插入删除一定是 $O(1)$』：只有在**已经拿到目标结点指针**时才成立。若要按值或按下标找位置，定位本身要 $O(n)$，总代价仍是 $O(n)$。",
            "以为扩容是免费的：扩容要复制全部元素并释放旧空间，单次最坏 $O(n)$，且会让所有指向旧地址的指针与迭代器失效。"
          ]
        },
        {
          type: "lab",
          title: "上机任务：两种实现跑同一份负载，用数字说话",
          steps: [
            "构造 n=100000 的整数数据，分别用 C 数组（顺序表）与单链表存放。",
            "负载一：做 100000 次随机下标访问，记录两种结构的耗时，解释为什么链表慢几个数量级（提示：指针跳转破坏缓存局部性，每次跳转都可能是一次缓存未命中）。",
            "负载二：在**已知结点位置**的前提下做 100000 次插入与删除，记录耗时，解释为什么此时链表反超顺序表。",
            "负载三：只在表尾追加 100000 个元素，记录耗时，说明为什么尾插时顺序表（动态数组）同样快，甚至更快。",
            "写出结论：在什么数据规模与操作配比下该选顺序表，什么情况下该选链表，各举一个真实场景。"
          ],
          note: "报告里必须出现具体数字（毫秒）与你的解释，不能只写「链表插入快」这种结论。"
        }
      ],
      quiz: [
        {
          id: "ds-array-list-q1",
          type: "fill",
          q: "在长度为 8 的顺序表中，等概率地在第 1 至第 9 个位置插入一个元素，平均需要移动 ____ 个元素（填数值）。",
          answer: ["4", "4个", "4 个", "n/2", "n/2=4"],
          why: "在第 $i$ 个位置插入需移动 $n-i+1$ 个元素，9 种位置等概率，平均为 $\\frac{8+7+6+5+4+3+2+1+0}{9} = \\frac{36}{9} = 4$，也就是 $\\frac{n}{2} = 4$。常见错误是分母写成 8 得到 4.5，或漏掉「插在表尾移动 0 次」这一种位置，因为合法插入位置有 n+1 个而不是 n 个。"
        },
        {
          id: "ds-array-list-q2",
          type: "fill",
          q: "长度为 n 的顺序表删除一个元素，若各位置等概率被删除，平均移动元素个数为 $\\frac{n-1}{2}$；当 $n = 8$ 时该值为 ____（填数值或小数）。",
          answer: ["3.5", "3.5个", "3.5 个", "7/2", "(n-1)/2=3.5"],
          why: "删除第 $i$ 个元素需移动 $n-i$ 个元素，n 种位置等概率，平均为 $\\frac{(n-1)+(n-2)+\\cdots+0}{n} = \\frac{n(n-1)/2}{n} = \\frac{n-1}{2}$；$n = 8$ 时是 $\\frac{7}{2} = 3.5$。它比插入的平均 $\\frac{n}{2}$ 小，因为删除没有「插在表尾不用搬」那个额外位置来拉低均值，分母也不同。"
        },
        {
          id: "ds-array-list-q3",
          type: "order",
          q: "把顺序表在表头插入一个元素的过程排成正确顺序（表长 n，数组下标从 0 开始）。",
          items: [
            "检查表是否已满以及插入位置是否合法",
            "从最后一个元素开始，依次把它后面的元素后移一位",
            "把新元素写入腾出来的第 1 个位置",
            "把表长 length 加 1"
          ],
          answer: [0, 1, 2, 3],
          why: "顺序必须是「先合法性检查、再从后往前搬、再写入、最后改长度」。若先改长度再搬移，循环边界就读到了错误的新长度；若从前往后搬，第一个元素会覆盖第二个元素，后面的数据全部被污染；若先写入再搬移，新元素会被自己挤走。"
        },
        {
          id: "ds-array-list-q4",
          type: "single",
          q: "关于动态数组（Python 的 list、C++ 的 vector）的扩容，下列说法正确的是？",
          options: [
            "采用容量倍增策略时，单次追加的最坏代价是 $O(n)$，但 n 次追加的总代价是 $O(n)$，均摊到每次追加是 $O(1)$",
            "采用容量倍增策略后，每一次追加操作的时间复杂度都是严格的 $O(1)$",
            "只要扩容因子取任意大于 1 的数（哪怕只增长 0.1%），均摊代价都能保持 $O(1)$，与因子大小无关",
            "动态数组扩容不需要搬移原元素，它只是在原地址后面直接续接一段新空间"
          ],
          answer: 0,
          why: "倍增策略下搬运只发生在容量为 1、2、4、8 等位置，总搬运量是几何级数之和 $O(n)$，落在 n 次追加上即均摊 $O(1)$，但触发扩容的那一次本身要复制全部元素，仍是 $O(n)$，所以 A 对而 B 错。C 错在混淆了「因子 $> 1$」与「因子是一个远离 1 的常数」：若每次只增 1 个格子或增长比例极小，均摊代价会退化为 $O(n)$。D 错在连续内存无法就地续接，必须重新分配并整体拷贝，这正是引用与迭代器失效的原因。"
        }
      ]
    },
    {
      id: "ds-linked-list",
      title: "链表：用指针换掉搬移，代价是什么",
      goal: "学完后你能写对带头结点与不带头结点单链表的插入、删除指针操作，能独立写出反转链表与快慢指针（判环、找中点）的代码，并能从随机访问、插入删除、缓存局部性三个角度说明链表与顺序表的取舍。",
      est: 45,
      blocks: [
        {
          type: "concept",
          title: "结点（node）与链：链表如何消灭「搬移」",
          md: "顺序表的插入要搬 $\\frac{n}{2}$ 个元素，根因是**元素的物理位置必须与逻辑次序一致**。链表（linked list）把这个约束拆掉：每个结点由「数据域（data）+ 指针域（next）」组成，逻辑上的相邻通过指针表达，物理位置可以散落在堆（heap）的任意角落。\n\n于是插入变成三步：找到前驱结点 p、让新结点 s 指向 p 的后继、让 p 指向 s。**没有搬移，只有两次指针改写**，代价是 $O(1)$（前提是已经拿到 p）。\n\n但世界是公平的，链表付出的代价是：\n\n1. **失去随机访问**：第 $i$ 个结点的地址无法用公式算出，只能从头结点顺着 next 走 $i$ 步，访问第 $i$ 个元素是 $O(n)$。顺序表是 $O(1)$。\n2. **指针本身占空间**：每个结点多一个指针域（64 位机上 8 字节），存储密度（storage density）= 数据域大小 / 结点总大小，一定小于 1。\n3. **缓存局部性（cache locality）差**：顺序表一次访存能带进一整条缓存行（cache line，通常 64 字节）里连续的十几个元素；链表每跳一次都可能是一次缓存未命中，实测常比顺序表慢数倍，哪怕渐进复杂度更优。\n\n所以「链表更适合频繁插入删除」这句话必须补上条件：**只有在插入删除的位置已经拿到指针、且数据量大到搬移成本超过指针跳转成本时才成立**。"
        },
        {
          type: "concept",
          title: "带头结点 vs 不带头结点：为什么工程代码几乎都带头结点",
          md: "头结点（head node，也叫哨兵结点 sentinel）是一个不存放有效数据的附加结点，它的 next 指向第一个真实结点。加它不是为了「好看」，而是为了消除边界分支：\n\n- **空表与非空表统一**：带头结点时，空表是 head->next == NULL，head 本身永不为空；不带头结点时空表就是 head == NULL，任何操作前都得先判空。\n- **首元结点不再是特例**：在第 1 个位置插入时，带头结点只需 p = head，改写 p->next 即可；不带头结点必须修改头指针本身，函数参数要么传 「LinkList *L」（二级指针），要么返回新的头指针——多一种出错方式。\n- **删除首元结点不用改头指针**：带头结点时删除首元结点只是 head->next = head->next->next；不带头结点则必须把 head 指向第二个结点，还要处理「删空后 head = NULL」。\n\n代价是浪费一个结点的空间（可忽略）和一次额外的指针跳转。这也解释了为什么《数据结构》教材里的算法题默认带头结点——不是规定，而是它能少一半的 if 分支。\n\n三种形态的差异要能默写：\n\n- 单链表（singly linked list）：只有 next，只能单向遍历，找前驱要 $O(n)$。\n- 双链表（doubly linked list）：有 prior 与 next，找前驱 $O(1)$，代价是多一个指针域、插入删除要改四个指针（顺序不能错）。\n- 循环链表（circular linked list）：尾结点的 next 指回头结点，从任一结点出发都能遍历全表；判空条件是 head->next == head。若用「尾指针 rear」表示循环单链表，则 rear->next 是头结点，找表头与表尾都是 $O(1)$。"
        },
        {
          type: "concept",
          title: "指针操作的最大风险：一改错就断链",
          md: "链表的 bug 最难查，因为它不崩溃、不报错，只是**静默地丢掉一串结点**（内存泄漏）或**走进死循环**。所有错误都源于同一个原因：**先覆盖了唯一记录后继地址的指针，就再也找不到后面的结点了**。\n\n以单链表插入为例，正确顺序是「先接后、再断前」：\n\n1. s->next = p->next;（新结点接管后继，此时旧链仍完整）\n2. p->next = s;（前驱改指新结点）\n\n若把两步写反（先 p->next = s），那么原来的后继地址只存在于 p->next 中，被覆盖后就永久丢失，s->next 只能指向自己或垃圾值，链表从 s 之后全断。\n\n删除同理，顺序是「先记后、再跨过、后释放」：\n\n1. q = p->next;（先记住要删的结点）\n2. p->next = q->next;（让前驱跨过它）\n3. free(q);（最后释放）\n\n若先 free(q) 再访问 q->next，就是访问已释放内存（use-after-free），在 408 里是「指针悬空（dangling pointer）」，在真实程序里是随机崩溃。\n\n双链表删除更要小心：它有两个指针，必须四个方向都照顾到，且要判断后继是否存在（删除尾结点时 q->next 为 NULL，直接写 q->next->prior 会崩溃）：\n\np->next = q->next; if (q->next != NULL) q->next->prior = p; free(q);"
        },
        {
          type: "code",
          lang: "c",
          title: "单链表反转、快慢指针判环与找中点（完整可编译）",
          code: "#include <stdio.h>\n#include <stdlib.h>\n\ntypedef struct Node {\n    int data;\n    struct Node *next;\n} Node, *LinkList;\n\n/* 用尾插法建立带头结点的单链表，数组 a[0..n-1] 依次入表 */\nLinkList list_create(const int *a, int n) {\n    LinkList head = (Node *)malloc(sizeof(Node));\n    Node *tail = head;\n    int i;\n    head->next = NULL;\n    for (i = 0; i < n; i++) {\n        Node *s = (Node *)malloc(sizeof(Node));\n        s->data = a[i];\n        s->next = NULL;\n        tail->next = s;\n        tail = s;\n    }\n    return head;\n}\n\nvoid list_print(const char *tag, LinkList head) {\n    Node *p = head->next;\n    printf(\"%s\", tag);\n    while (p != NULL) {\n        printf(\"%d%s\", p->data, p->next ? \" -> \" : \"\");\n        p = p->next;\n    }\n    printf(\"\\n\");\n}\n\n/* 反转链表（迭代版，就地反转） */\nvoid list_reverse(LinkList head) {\n    Node *prev = NULL, *cur = head->next, *next;\n    while (cur != NULL) {\n        next = cur->next;   /* 第一步：记住后继，否则改完就找不到了 */\n        cur->next = prev;   /* 第二步：当前结点反向指向前驱 */\n        prev = cur;         /* 第三步：前驱前进 */\n        cur = next;         /* 第四步：当前前进 */\n    }\n    head->next = prev;      /* 头结点接上新的首元结点 */\n}\n\n/* 快慢指针判断是否有环：有环返回相遇结点，无环返回 NULL */\nNode *list_has_cycle(LinkList head) {\n    Node *slow = head->next, *fast = head->next;\n    while (fast != NULL && fast->next != NULL) {\n        slow = slow->next;          /* 慢指针每次 1 步 */\n        fast = fast->next->next;    /* 快指针每次 2 步 */\n        if (slow == fast) return slow;\n    }\n    return NULL;                    /* fast 走到 NULL，说明无环 */\n}\n\n/* 快慢指针找中间结点：偶数个结点时返回中间偏前的那个 */\nNode *list_middle(LinkList head) {\n    Node *slow = head->next, *fast = head->next;\n    while (fast != NULL && fast->next != NULL) {\n        slow = slow->next;\n        fast = fast->next->next;\n    }\n    return slow;\n}\n\nint main(void) {\n    int a[] = {1, 2, 3, 4, 5};\n    LinkList L = list_create(a, 5);\n    list_print(\"原始链表：      \", L);\n\n    printf(\"中间结点：      %d\\n\", list_middle(L)->data);\n    printf(\"判环结果：      %s\\n\", list_has_cycle(L) ? \"有环\" : \"无环\");\n\n    list_reverse(L);\n    list_print(\"反转后链表：    \", L);\n    printf(\"反转后中间结点：%d\\n\", list_middle(L)->data);\n\n    /* 人为制造一个环：让尾结点指回第 3 个结点，再判环 */\n    {\n        Node *p = L->next, *third = NULL;\n        int k = 1;\n        while (p->next != NULL) {\n            if (++k == 3) third = p;\n            p = p->next;\n        }\n        p->next = third;\n        printf(\"制造环后判环：  %s（相遇于 %d）\\n\",\n               list_has_cycle(L) ? \"有环\" : \"无环\", list_has_cycle(L)->data);\n        p->next = NULL;  /* 拆环，便于后续释放 */\n    }\n    return 0;\n}"
        },
        {
          type: "code",
          lang: "python",
          title: "同样的三个算法用 Python 再写一遍（双指针思想不变）",
          code: "# 与 C 版本行为一致：同样的数据、同样的中间结点与反转结果\n\n\nclass Node:\n    def __init__(self, data, nxt=None):\n        self.data = data\n        self.next = nxt\n\n\n        def list_create(values):\n            \"\"\"尾插法建立带头结点的单链表，head 是哨兵结点\"\"\"\n            head = Node(None)\n            tail = head\n            for v in values:\n                tail.next = Node(v)\n                tail = tail.next\n                return head\n\n\n                def list_print(tag, head):\n                    parts = []\n                    p = head.next\n                    while p is not None:\n                        parts.append(str(p.data))\n                        p = p.next\n                        print(tag + \" -> \".join(parts))\n\n\n                        def list_reverse(head):\n                            \"\"\"就地反转：prev / cur / nxt 三指针，顺序不能变\"\"\"\n                            prev, cur = None, head.next\n                            while cur is not None:\n                                nxt = cur.next      # 先记后继\n                                cur.next = prev     # 再反向\n                                prev = cur\n                                cur = nxt\n                                head.next = prev\n\n\n                                def list_has_cycle(head):\n                                    \"\"\"快慢指针判环：有环返回相遇结点，无环返回 None\"\"\"\n                                    slow = fast = head.next\n                                    while fast is not None and fast.next is not None:\n                                        slow = slow.next\n                                        fast = fast.next.next\n                                        if slow is fast:\n                                            return slow\n                                            return None\n\n\n                                            def list_middle(head):\n                                                \"\"\"快慢指针找中点：偶数个结点时返回中间偏前的那个\"\"\"\n                                                slow = fast = head.next\n                                                while fast is not None and fast.next is not None:\n                                                    slow = slow.next\n                                                    fast = fast.next.next\n                                                    return slow\n\n\n                                                    L = list_create([1, 2, 3, 4, 5])\n                                                    list_print(\"原始链表：      \", L)\n                                                    print(\"中间结点：      %d\" % list_middle(L).data)\n                                                    print(\"判环结果：      %s\" % (\"有环\" if list_has_cycle(L) else \"无环\"))\n\n                                                    list_reverse(L)\n                                                    list_print(\"反转后链表：    \", L)\n                                                    print(\"反转后中间结点：%d\" % list_middle(L).data)\n\n                                                    # 制造环：让尾结点指回第 3 个结点\n                                                    p = L.next\n                                                    third = None\n                                                    k = 1\n                                                    while p.next is not None:\n                                                        k += 1\n                                                        if k == 3:\n                                                            third = p\n                                                            p = p.next\n                                                            p.next = third\n                                                            meet = list_has_cycle(L)\n                                                            print(\"制造环后判环：  %s（相遇于 %d）\" % (\"有环\" if meet else \"无环\", meet.data))\n                                                            p.next = None   # 拆环"
        },
        {
          type: "interactive",
          lab: "datalab",
          title: "单步看反转链表：每一步指针都指向谁",
          config: {
            state: { 步骤: "初始化", cur: 1, prev: "NULL", next: 2, 链表: "1 -> 2 -> 3 -> NULL", 已完成反转: "NULL" },
            steps: [
              { desc: "第 1 步：初始化三个指针，prev=NULL、cur=1、next 待定，原链表 1 -> 2 -> 3", state: { 步骤: "初始化", cur: 1, prev: "NULL", next: "未读取", 链表: "1 -> 2 -> 3 -> NULL", 已完成反转: "NULL" }, note: "prev 从 NULL 开始，因为反转后原首元结点将成为尾结点，必须指向 NULL 才不会越界。" },
              { desc: "第 2 步：next = cur->next，记住 2 的地址", state: { 步骤: "保存后继", cur: 1, prev: "NULL", next: 2, 链表: "1 -> 2 -> 3 -> NULL", 已完成反转: "NULL" }, note: "这一步绝不能省：下一句就要改写 cur->next，此刻不记就永远找不到 2 和 3。" },
              { desc: "第 3 步：cur->next = prev，把 1 的指针反过来指向 NULL", state: { 步骤: "反向指针", cur: 1, prev: "NULL", next: 2, 链表: "1 -> NULL （2 -> 3 待接）", 已完成反转: "NULL <- 1" }, note: "此时链表被切成两段，靠 next 变量保存后半段的入口 2。" },
              { desc: "第 4 步：prev = cur，前驱推进到 1", state: { 步骤: "前驱前进", cur: 1, prev: 1, next: 2, 链表: "1 -> NULL （2 -> 3 待接）", 已完成反转: "NULL <- 1" }, note: "prev 永远指向已完成反转部分的头，即最终结果的首元结点。" },
              { desc: "第 5 步：cur = next，当前指针移到 2，完成一轮", state: { 步骤: "当前前进", cur: 2, prev: 1, next: 2, 链表: "1 -> NULL （2 -> 3 待接）", 已完成反转: "NULL <- 1" }, note: "一轮循环只处理一个结点，三轮后 1、2、3 全部反转。" },
              { desc: "第 6 步：对 2、3 重复同样四步，最终得到 3 -> 2 -> 1 -> NULL", state: { 步骤: "循环结束", cur: "NULL", prev: 3, next: "NULL", 链表: "3 -> 2 -> 1 -> NULL", 已完成反转: "NULL <- 1 <- 2 <- 3" }, note: "循环终止条件是 cur == NULL；最后必须执行 head->next = prev，否则头结点还指着旧的首元结点 1，链表只剩一个元素。" }
            ],
            tasks: [
              { t: "把第 2 步（next = cur->next）删掉再手动模拟，说明第 3 步之后为什么找不到 2 和 3。", hint: "想想覆盖 cur->next 之后，谁是后半段的唯一入口。", check: "能指出后半段入口丢失，链表被截断为只剩 1 个结点。" },
              { t: "把快慢指针的步长改成「慢 1 步、快 3 步」，判断有环时两指针是否必然相遇，并说明理由。", hint: "看环内相对速度是否与环长互质。", check: "能说出相对速度为 2、只有环长为偶数时才必然相遇，所以工程上固定用 2 倍速。" }
            ]
          }
        },
        {
          type: "pitfall",
          title: "链表指针操作的易错点",
          items: [
            "插入时两步写反：必须先 s->next = p->next，再 p->next = s。反了会丢掉 p 原来的后继，链表从新结点之后整体断裂。",
            "删除后忘记 free 或忘记改指针：只改指针不 free 会内存泄漏；只 free 不改指针会产生悬空指针，后续访问是未定义行为。删除的正确顺序是「记 q -> 跨过 -> free(q)」。",
            "双链表删除尾结点时直接写 q->next->prior = p：q->next 为 NULL 时空指针解引用会崩溃，必须先判断后继是否存在。",
            "快慢指针循环条件只写 fast != NULL：fast->next->next 在 fast->next 为 NULL 时就已经空指针了。必须写成 fast != NULL && fast->next != NULL。",
            "把「链表插入删除是 $O(1)$」当成普遍结论：按值或按下标定位仍是 $O(n)$；只有已知前驱指针时才是 $O(1)$。408 常在这里设陷阱，问「在单链表中删除指定结点 p」与「删除 p 的后继」的区别（前者需要 $O(n)$ 找前驱，除非用「复制后继再删后继」的技巧）。"
          ]
        },
        {
          type: "lab",
          title: "上机任务：双链表与循环链表的完整实现",
          steps: [
            "实现带头结点的双链表（doubly linked list），包含尾插、按值查找、在结点 p 之后插入、删除结点 p 四个操作，删除操作必须正确处理尾结点。",
            "把双链表改成双向循环链表（首元结点的 prior 指向尾结点，尾结点的 next 指向头结点），写出新的判空条件与正向、反向两套遍历。",
            "用「约瑟夫环（Josephus problem）」验证循环链表：n 个人围成一圈，每数到第 m 个人出列，输出出列顺序。用 $n = 7$、$m = 3$ 测试，手工核对前三个出列的人是 3、6、2。",
            "对同一份数据（n=100000）分别用顺序表与单链表实现「删除所有值为偶数的元素」，记录耗时并解释差距来源。"
          ],
          note: "任务 3 的正确答案是 3 6 2 7 5 1 4，请用它自测；若你的输出不同，先检查计数起点与出列后从谁开始数。"
        }
      ],
      quiz: [
        {
          id: "ds-linked-list-q1",
          type: "order",
          q: "把单链表反转（迭代法）的循环体步骤排成正确顺序（cur 为当前结点）。",
          items: [
            "next = cur->next，先把后继地址保存下来",
            "cur->next = prev，让当前结点反向指向前驱",
            "prev = cur，前驱指针前进到当前结点",
            "cur = next，当前指针前进到原后继"
          ],
          answer: [0, 1, 2, 3],
          why: "必须先保存后继才能覆盖 cur->next，否则后半段链表彻底丢失；反向与两个指针推进的先后也不能换：若先做 cur = next 再做 cur->next = prev，就会把下一个结点错误地指向它自己或错误位置。循环结束后还必须补一句 head->next = prev。"
        },
        {
          id: "ds-linked-list-q2",
          type: "single",
          q: "在带头结点的非空单链表中，指针 p 指向某个结点，要删除 p 的后继结点（保证后继存在），下列操作顺序正确的是？",
          options: [
            "q = p->next; p->next = q->next; free(q);",
            "free(p->next); p->next = p->next->next;",
            "p->next = p->next->next; free(p->next);",
            "q = p->next; free(q); p->next = q->next;"
          ],
          answer: 0,
          why: "A 的顺序是「先记住被删结点 q、让前驱跨过它、最后释放」，三步都不越界。B 与 D 都是先 free 再解引用，属于访问已释放内存（use-after-free），q->next 的值在释放后不可信。C 是最隐蔽的错误：先跨过再 free(p->next)，此时 p->next 已经是被删结点的后继，等于误删了后面那个不该删的结点，而真正的目标结点被泄漏。"
        },
        {
          id: "ds-linked-list-q3",
          type: "fill",
          q: "用快慢指针在单链表中找中间结点，慢指针每次走 1 步、快指针每次走 2 步；当链表有 8 个结点时，循环结束时慢指针停在编号为 ____ 的结点（编号从 1 开始，快指针走到链表末尾）。",
          answer: ["4", "4号", "第4个", "4 号", "第 4 个"],
          why: "快指针走 2 步、慢指针走 1 步，快指针走完 $n-1$ 步到达尾结点时慢指针走了 $\\lfloor (n-1)/2 \\rfloor$ 步，加上起点本身即 $\\lfloor n/2 \\rfloor$ 个位置；$n = 8$ 时为第 4 个结点（中间偏前）。若答 5 是把「中间偏后」的约定混了进来：只要在 while 条件里写成 fast->next != NULL && fast->next->next != NULL，结果就变成偏后的第 5 个，两种写法都能用，但必须与你的循环条件一致。"
        },
        {
          id: "ds-linked-list-q4",
          type: "multi",
          q: "关于链表与顺序表的对比，下列说法正确的有哪些？",
          options: [
            "顺序表按下标访问一个元素是 $O(1)$，单链表访问第 $i$ 个元素需要从头走 $i$ 步，是 $O(n)$",
            "在已知前驱结点指针的前提下，单链表插入一个结点只需改写两个指针，是 $O(1)$，不涉及元素搬移",
            "由于链表插入删除更高效，处理大规模数据时链表在任何操作上都比顺序表快",
            "即使复杂度相同，顺序表通常也更快，因为它访问连续内存，缓存命中率高，而链表每跳一次都可能缓存未命中"
          ],
          answer: [0, 1, 3],
          why: "A 是顺序存储的定义性优势，地址可由公式直接算出。B 是链表存在的理由：插入只改两个指针，不搬元素。D 说明了为什么工程实测常常与复杂度分析相反：连续内存带来预取与缓存行复用，指针跳转则容易触发缓存未命中。C 错在「任何操作」这个全称判断：链表随机访问是 $O(n)$，而且顺序表尾插也是 $O(1)$，所以链表并不普遍更快。"
        }
      ]
    },
    {
      id: "ds-stack-queue",
      title: "栈与队列：两种受限的线性表",
      goal: "学完后你能判断合法的出栈序列，能正确写出循环队列的判空判满条件并说明牺牲一个单元法与计数器法的取舍，能手工完成中缀表达式转后缀并求值，并能说明函数调用栈、BFS 用队列、DFS 用栈的原因。",
      est: 50,
      blocks: [
        {
          type: "concept",
          title: "栈（stack）与队列（queue）：限制带来的力量",
          md: "栈和队列都是线性表，它们的价值恰恰来自**限制**：只允许在一端操作。限制越死，行为越可预测，就越能把复杂问题压成简单的机械过程。\n\n- 栈：后进先出（LIFO，last in first out），只在栈顶（top）插入（push）与删除（pop）。\n- 队列：先进先出（FIFO，first in first out），队尾（rear）入队（enqueue），队头（front）出队（dequeue）。\n\n**为什么需要栈**：\n\n1. 嵌套结构的天然模型。括号匹配、函数调用、表达式求值都是「后来的先解决」——遇到「(」就先记着，遇到「)」先处理最里面那个，这正是 LIFO。\n2. 撤销与回溯。编辑器的 undo、DFS 的路径回退、浏览器的后退，都需要记住「上一步在哪」，且总是先退回最近的一步。\n3. 把递归改成迭代。递归的本质就是编译器替你维护了一个栈（存返回地址与局部变量），手工用栈模拟就能消除递归，还避免了栈溢出（stack overflow）。\n\n**为什么需要队列**：\n\n1. 公平与顺序。打印任务、进程就绪队列、消息队列都要求「先到先服务」，否则会饿死。\n2. 按层扩展。BFS（广度优先搜索）与树的层序遍历（level-order traversal）都要求「先把这一层的所有点处理完，再处理下一层」，队列天然保持了这个顺序。\n\n一句话总结：**DFS 用栈（或递归），BFS 用队列**。这不是口诀，而是由「下一个该处理谁」这个问题直接决定的。"
        },
        {
          type: "concept",
          title: "顺序栈与共享栈：空间怎么省",
          md: "顺序栈用一个数组加一个栈顶指针 「top」 实现。约定不同，代码就不同，必须与教材统一：\n\n- 约定 A（408 常用）：top 指向栈顶元素，初值 -1。判空是 top == -1，判满是 top == MaxSize-1，入栈是 「s[++top] = x」，出栈是 「x = s[top--]」。\n- 约定 B：top 指向栈顶的下一个空位，初值 0。判空是 top == 0，判满是 top == MaxSize，入栈是 「s[top++] = x」，出栈是 「x = s[--top]」。\n\n两种约定都对，但混用必然差一。栈的基本操作都是 $O(1)$，因为没有搬移——这正是「限制在端点操作」换来的好处。\n\n**共享栈（shared stack）** 解决的是「两个栈此消彼长但各自预留空间浪费」的问题：把两个栈的栈底分别设在数组两端，「top0 = -1」 向左增长，「top1 = MaxSize」 向右增长。\n\n- 判满条件：「top0 + 1 == top1」（两栈顶相邻，中间再没有空位）\n- 判空：top0 == -1 是 0 号栈空，top1 == MaxSize 是 1 号栈空\n\n它把「两个各占 MaxSize/2 的固定分区」变成「动态共享 MaxSize」，只有当两栈元素总数超过 MaxSize 时才真正溢出，空间利用率明显更高。代价是任一栈的容量都不再有保证——最坏情况下某个栈只能用到 1 个单元。"
        },
        {
          type: "concept",
          title: "循环队列（circular queue）：判空与判满为什么必须区别对待",
          md: "顺序队列若不做处理会出现「假溢出（false overflow）」：数组尾部已满但头部有大量空位，因为 front 和 rear 都只能单向加 1。解法是让指针**取模回绕**：「rear = (rear + 1) % MaxSize」，把数组在逻辑上接成一个环。\n\n回绕带来一个新问题：队空与队满时 front 与 rear 的关系看起来一样。若 front 指向队头元素、rear 指向队尾元素的后一个空位，则队空是 front == rear，而「插入 MaxSize 个元素后」也是 front == rear，**无法区分**。三种标准解法：\n\n1. **牺牲一个存储单元**：规定 rear 的下一个位置是 front 时就算满，即判满条件是 「(rear + 1) % MaxSize == front」，判空条件是 「front == rear」。能存的最大元素个数是 「MaxSize - 1」。代价是浪费一个单元，好处是判据只用两个指针、不需要额外变量。\n2. **增设计数器 size**：size == 0 即队空，size == MaxSize 即队满。能存 MaxSize 个元素，不浪费空间，代价是多维护一个变量，且入队出队都要改它。\n3. **增设标志 tag**：tag = 0 表示最近一次是出队，tag = 1 表示最近一次是入队。则 front == rear 且 tag == 0 是空，front == rear 且 tag == 1 是满。同样能用满 MaxSize 个单元。\n\n408 计算题几乎都基于方案 1，请把三条公式背成条件反射：\n\n- 元素个数：「(rear - front + MaxSize) % MaxSize」\n- 判空：「front == rear」\n- 判满：「(rear + 1) % MaxSize == front」，可存元素最大个数是 MaxSize - 1"
        },
        {
          type: "code",
          lang: "c",
          title: "循环队列 + 括号匹配 + 中缀转后缀（完整可编译）",
          code: "#include <stdio.h>\n#include <string.h>\n#include <stdlib.h>\n\n#define MaxSize 6\n\n/* ---------------- 循环队列：牺牲一个单元 ---------------- */\ntypedef struct {\n    char data[MaxSize];\n    int front;   /* 指向队头元素 */\n    int rear;    /* 指向队尾元素的下一个空位 */\n} SqQueue;\n\nvoid queue_init(SqQueue *q) { q->front = q->rear = 0; }\nint queue_empty(const SqQueue *q) { return q->front == q->rear; }\nint queue_full(const SqQueue *q) { return (q->rear + 1) % MaxSize == q->front; }\nint queue_count(const SqQueue *q) { return (q->rear - q->front + MaxSize) % MaxSize; }\n\nint queue_push(SqQueue *q, char c) {\n    if (queue_full(q)) return 0;              /* 判满必须用取模，不能写 rear+1 == MaxSize */\n    q->data[q->rear] = c;\n    q->rear = (q->rear + 1) % MaxSize;        /* 取模回绕 */\n    return 1;\n}\n\nint queue_pop(SqQueue *q, char *out) {\n    if (queue_empty(q)) return 0;\n    *out = q->data[q->front];\n    q->front = (q->front + 1) % MaxSize;\n    return 1;\n}\n\n/* ---------------- 括号匹配：用数组当栈 ---------------- */\nint bracket_match(const char *s) {\n    char st[128];\n    int top = -1, i;\n    for (i = 0; s[i] != '\\0'; i++) {\n        if (s[i] == '(' || s[i] == '[' || s[i] == '{') {\n            st[++top] = s[i];\n        } else if (s[i] == ')' || s[i] == ']' || s[i] == '}') {\n            if (top == -1) return 0;                       /* 右括号多余 */\n            if ((s[i] == ')' && st[top] != '(') ||\n                (s[i] == ']' && st[top] != '[') ||\n                (s[i] == '}' && st[top] != '{')) return 0;  /* 类型不匹配 */\n            top--;\n        }\n    }\n    return top == -1;   /* 左括号多余时栈非空，也判失败 */\n}\n\n/* ---------------- 中缀转后缀（不带括号也有优先级） ---------------- */\nstatic int prio(char op) {\n    if (op == '*' || op == '/') return 2;\n    if (op == '+' || op == '-') return 1;\n    return 0;   /* '(' 的优先级最低，保证不会被弹出 */\n}\n\nvoid infix_to_postfix(const char *s, char *out) {\n    char st[128];\n    int top = -1, i, k = 0;\n    for (i = 0; s[i] != '\\0'; i++) {\n        char c = s[i];\n        if (c >= '0' && c <= '9') {\n            out[k++] = c;                       /* 操作数直接输出 */\n        } else if (c == '(') {\n            st[++top] = c;\n        } else if (c == ')') {\n            while (top >= 0 && st[top] != '(') out[k++] = st[top--];\n            top--;                              /* 弹出左括号，但不输出 */\n        } else if (c == '+' || c == '-' || c == '*' || c == '/') {\n            while (top >= 0 && prio(st[top]) >= prio(c)) out[k++] = st[top--];\n            st[++top] = c;\n        }\n    }\n    while (top >= 0) out[k++] = st[top--];\n    out[k] = '\\0';\n}\n\nint main(void) {\n    SqQueue q;\n    char c;\n    int i;\n    queue_init(&q);\n    printf(\"循环队列 MaxSize = %d，最多容纳 %d 个元素\\n\", MaxSize, MaxSize - 1);\n    for (i = 0; i < 5; i++) queue_push(&q, (char)('A' + i));\n    printf(\"入队 A~E 后 front=%d rear=%d 元素个数=%d 队满=%s\\n\",\n           q.front, q.rear, queue_count(&q), queue_full(&q) ? \"是\" : \"否\");\n    queue_pop(&q, &c);\n    queue_push(&q, 'F');\n    printf(\"出队一个再入队 F：front=%d rear=%d 元素个数=%d 队满=%s\\n\",\n           q.front, q.rear, queue_count(&q), queue_full(&q) ? \"是\" : \"否\");\n\n    printf(\"括号匹配 %s -> %s\\n\", \"([{}])\", bracket_match(\"([{}])\") ? \"合法\" : \"非法\");\n    printf(\"括号匹配 %s -> %s\\n\", \"([)]\", bracket_match(\"([)]\") ? \"合法\" : \"非法\");\n\n    {\n        char buf[128];\n        infix_to_postfix(\"3+4*2-(1+5)\", buf);\n        printf(\"中缀 3+4*2-(1+5) 转后缀 = %s\\n\", buf);\n    }\n    return 0;\n}"
        },
        {
          type: "code",
          lang: "python",
          title: "Python 对照：deque 实现队列 + 后缀表达式求值",
          code: "# 与 C 版本行为一致：同样的入队顺序、同样的后缀表达式\n# 队列与栈全部用 list 自己实现，不使用任何库\n\n\ndef run_circular_queue():\n    \"\"\"用 list 模拟循环队列，验证 front/rear 的取模回绕与判满条件\"\"\"\n    MaxSize = 6\n    data = [None] * MaxSize\n    front = rear = 0\n\n    def is_empty():\n        return front == rear\n\n    def is_full():\n        return (rear + 1) % MaxSize == front\n\n    def count():\n        return (rear - front + MaxSize) % MaxSize\n\n    def push(ch):\n        nonlocal rear\n        if is_full():\n            return False\n        data[rear] = ch\n        rear = (rear + 1) % MaxSize\n        return True\n\n    def pop():\n        nonlocal front\n        if is_empty():\n            return None\n        ch = data[front]\n        front = (front + 1) % MaxSize\n        return ch\n\n    print(\"循环队列 MaxSize = %d，最多容纳 %d 个元素（牺牲一个单元判满）\" % (MaxSize, MaxSize - 1))\n    for i in range(5):\n        push(chr(ord('A') + i))\n    print(\"入队 A~E 后 front=%d rear=%d 元素个数=%d 队满=%s\"\n          % (front, rear, count(), \"是\" if is_full() else \"否\"))\n    pop()\n    push('F')\n    print(\"出队一个再入队 F：front=%d rear=%d 元素个数=%d 队满=%s\"\n          % (front, rear, count(), \"是\" if is_full() else \"否\"))\n\n\ndef bracket_match(s):\n    \"\"\"栈的经典应用：括号匹配\"\"\"\n    pairs = {')': '(', ']': '[', '}': '{'}\n    st = []\n    for ch in s:\n        if ch in \"([{\":\n            st.append(ch)\n        elif ch in pairs:\n            if not st or st[-1] != pairs[ch]:\n                return False\n            st.pop()\n    return not st\n\n\ndef infix_to_postfix(s):\n    \"\"\"中缀转后缀：运算符栈，遇到优先级不高于栈顶的运算符就先弹出\"\"\"\n    prio = {'*': 2, '/': 2, '+': 1, '-': 1}\n    out, st = [], []\n    for ch in s:\n        if ch.isdigit():\n            out.append(ch)\n        elif ch == '(':\n            st.append(ch)\n        elif ch == ')':\n            while st and st[-1] != '(':\n                out.append(st.pop())\n            st.pop()\n        elif ch in prio:\n            while st and st[-1] != '(' and prio[st[-1]] >= prio[ch]:\n                out.append(st.pop())\n            st.append(ch)\n    while st:\n        out.append(st.pop())\n    return \"\".join(out)\n\n\ndef eval_postfix(expr):\n    \"\"\"后缀求值：遇操作数入栈，遇运算符弹出两个操作数计算后回压\"\"\"\n    st = []\n    for ch in expr:\n        if ch.isdigit():\n            st.append(int(ch))\n        else:\n            b = st.pop()\n            a = st.pop()\n            if ch == '+':\n                st.append(a + b)\n            elif ch == '-':\n                st.append(a - b)\n            elif ch == '*':\n                st.append(a * b)\n            else:\n                st.append(a // b)\n    return st[0]\n\n\nif __name__ == \"__main__\":\n    run_circular_queue()\n    print(\"括号匹配 %s -> %s\" % (\"([{}])\", \"合法\" if bracket_match(\"([{}])\") else \"非法\"))\n    print(\"括号匹配 %s -> %s\" % (\"([)]\", \"合法\" if bracket_match(\"([)]\") else \"非法\"))\n\n    post = infix_to_postfix(\"3+4*2-(1+5)\")\n    print(\"中缀 3+4*2-(1+5) 转后缀 = %s\" % post)\n    print(\"后缀求值结果 = %d（与直接计算 3+4*2-(1+5) 一致）\" % eval_postfix(post))\n    print(\"验证：(1+(2+3)*4-5)/2 的后缀为 %s\" % infix_to_postfix(\"(1+(2+3)*4-5)/2\"))\n\n    # 工程提示：生产环境该用标准库的 deque，它的队头出队是 O(1)；\n    # 而 list.pop(0) 需要把后面所有元素前移一位，是 O(n)。\n    q = [i for i in range(3)]\n    print(\"普通 list 当队列用：队头是 %d，出队后剩余 %s（注意这种写法是 O(n)）\" % (q[0], q[1:]))"
        },
        {
          type: "interactive",
          lab: "datalab",
          title: "单步看循环队列：front / rear 如何取模回绕",
          config: {
            state: { 步骤: "初始化", 队列: "空", front: 0, rear: 0, 元素个数: 0, 队满: "否" },
            steps: [
              { desc: "第 1 步：MaxSize=6，初始 front=0、rear=0，队列为空", state: { 步骤: "初始化", 队列: "空", front: 0, rear: 0, 元素个数: 0, 队满: "否" }, note: "front == rear 是队空的判据；此时还没有元素。" },
              { desc: "第 2 步：依次入队 A B C D，rear 从 0 走到 4", state: { 步骤: "连续入队", 队列: "A B C D", front: 0, rear: 4, 元素个数: 4, 队满: "否" }, note: "rear 始终指向队尾元素的下一个空位，所以 4 个元素后 rear=4。" },
              { desc: "第 3 步：再入队 E，rear 变成 (4+1)%6 = 5", state: { 步骤: "入队 E", 队列: "A B C D E", front: 0, rear: 5, 元素个数: 5, 队满: "是" }, note: "此时 (rear+1)%6 = (5+1)%6 = 0 == front，判满成立。MaxSize=6 只能存 5 个元素。" },
              { desc: "第 4 步：出队 A，front 从 0 变成 1，队列留出空位", state: { 步骤: "出队 A", 队列: "_ B C D E", front: 1, rear: 5, 元素个数: 4, 队满: "否" }, note: "出队只动 front，不搬移任何元素，所以是 $O(1)$。" },
              { desc: "第 5 步：入队 F，rear 回绕到 0", state: { 步骤: "入队 F 回绕", 队列: "F B C D E", front: 1, rear: 0, 元素个数: 5, 队满: "是" }, note: "rear=0 却表示队尾，这正是「循环」的含义：下标小的位置反而更新。" },
              { desc: "第 6 步：再出队 B，front 变成 2，元素个数 4", state: { 步骤: "出队 B", 队列: "F _ C D E", front: 2, rear: 0, 元素个数: 4, 队满: "否" }, note: "元素个数公式 (rear - front + MaxSize) % MaxSize = (0-2+6)%6 = 4，与逐个数出来的结果一致。" },
              { desc: "第 7 步：若改用 size 计数器方案，容量判断改为 size==6", state: { 步骤: "方案对比", 队列: "可用满 6 个单元", front: 2, rear: 2, 元素个数: 6, 队满: "是" }, note: "牺牲一个单元只能存 MaxSize-1 个；size 或 tag 方案能存 MaxSize 个，代价是多维护一个变量。" }
            ],
            tasks: [
              { t: "把 MaxSize 改成 8，重新推演 front 从 6 出发连续入队 4 个元素时 rear 的取值序列。", hint: "每一步都要对 8 取模。", check: "能给出 rear 依次为 7、0、1、2，并说出回绕发生的位置。" },
              { t: "用「元素个数公式」验证第 5 步与第 6 步的元素个数，说明为什么不能直接用 rear - front。", hint: "rear 可能小于 front。", check: "能写出 (rear-front+MaxSize)%MaxSize 并解释加 MaxSize 的作用。" }
            ]
          }
        },
        {
          type: "calc",
          title: "手算：循环队列判满与中缀转后缀",
          inputs: [
            { name: "循环队列参数", value: "MaxSize = 10，front = 3，采用牺牲一个单元方案" },
            { name: "待转换表达式", value: "3+4*2-(1+5)" }
          ],
          outputs: [
            "队满条件：(rear + 1) % 10 == front，即 rear = 2 时队满",
            "当 front=3、rear=9 时：(9+1)%10 = 0 != 3，所以队列不满，此时元素个数 = (9-3+10)%10 = 6",
            "该队列最多能存放 $10 - 1 = 9$ 个元素",
            "中缀 3+4*2-(1+5) 转后缀：扫描得 3 4 2 * + 1 5 + -，即后缀表达式为 342*+15+-",
            "后缀求值：4*2=8，3+8=11，1+5=6，11-6=5；与直接计算 3+4*2-(1+5)=5 一致"
          ],
          note: "手算规则：操作数直接输出；运算符入栈前先弹出所有优先级不低于它的栈顶；遇右括号一直弹到左括号（左括号弹出但不输出）。"
        },
        {
          type: "pitfall",
          title: "栈与队列的易错点",
          items: [
            "循环队列判满写成 rear + 1 == MaxSize：这只在 rear 未回绕时成立，且忽略了 front 的位置。正确写法是 (rear + 1) % MaxSize == front。",
            "入队前只判空不判满，或忘记对 rear 取模：下标会越过数组上界，是典型的数组越界写，可能不立刻崩溃却已损坏内存。",
            "链队列出队时忘记处理「出的是最后一个结点」：此时必须把 rear 重新指回头结点，否则 rear 悬空，下一次入队会写到已释放的内存上。",
            "以为 n 个元素依次入栈只有一种出栈序列：合法出栈序列共有卡特兰数 $\\frac{C_{2n}^{n}}{n+1}$ 种。$n = 3$ 时合法序列共 5 种：123、132、213、231、321，而不合法的 $3! - 5 = 1$ 种就是 312。",
            "共享栈判满写成 top0 == top1：栈满发生在两栈顶相邻时，即 top0 + 1 == top1；写成相等会多塞一个元素，直接覆盖对方的栈顶。",
            "混淆「中缀转后缀」与「后缀求值」的栈用途：转换时栈里放的是**运算符**，求值时栈里放的是**操作数**，两套东西不能混在一个栈里。"
          ]
        },
        {
          type: "steps",
          title: "用栈把递归改成迭代：函数调用栈到底存了什么",
          items: [
            { t: "明确递归函数需要保存什么", d: "以二叉树前序遍历为例，递归时要记住「左子树处理完该回到哪个结点处理右子树」，还有返回地址与局部变量。这些信息被打包成一个栈帧（stack frame）。" },
            { t: "用显式栈替代隐式栈", d: "把「待处理结点」压入自己维护的栈：根入栈；循环弹出栈顶访问它，再把右孩子、左孩子依次入栈。必须先压右再压左，因为栈是 LIFO，后压的左孩子会先被弹出。" },
            { t: "验证两种写法的输出顺序一致", d: "若输出不同，通常是压栈顺序反了。递归版与迭代版对同一棵树必须给出完全相同的前序序列，这是自测的第一道关。" },
            { t: "比较代价", d: "递归版由系统栈管理，深度过大时会栈溢出（stack overflow）；迭代版的栈在堆上，容量可动态增长，但代码更长、可读性下降。工程上「深度可能很大」时就该改迭代。" }
          ]
        },
        {
          type: "lab",
          title: "上机任务：把四种结构都实现一遍",
          steps: [
            "实现顺序栈与链栈（linked stack），两者都提供 push / pop / getTop / isEmpty，并比较它们在扩容与内存碎片上的差异。",
            "实现循环队列的两种判满方案（牺牲一个单元、增加 size 计数器），对同一串入队出队操作打印每步的 front、rear、size，确认两种方案在「能否存满 MaxSize 个元素」上的差别。",
            "用栈实现括号匹配，要求同时支持 ()、[]、{} 三种括号，且能区分「右括号多余」「左括号多余」「类型不匹配」三种失败原因，分别打印不同错误信息。",
            "用队列实现二叉树的层序遍历（level-order traversal），并额外打印每一层的结点与层号，验证「同一层的结点连续输出」这一性质。"
          ],
          note: "自测用例：括号串 ([{}]) 合法；([)] 类型交叉非法；(() 左括号多余；()) 右括号多余。"
        }
      ],
      quiz: [
        {
          id: "ds-stack-queue-q1",
          type: "single",
          q: "设元素按 1、2、3 的顺序依次入栈，入栈过程中允许随时出栈，则下列哪个序列不可能是出栈序列？",
          options: [
            "3 1 2",
            "1 2 3",
            "2 3 1",
            "3 2 1"
          ],
          answer: 0,
          why: "3 1 2 不可能：若第一个出栈的是 3，说明 1、2 都在栈内且 2 压在 1 上面，出栈只能先出 2 再出 1，故 3 之后只能是 2 1。其余三个都合法：1 2 3 是「进一个出一个」；2 3 1 是「进 1 2、出 2、进 3、出 3、出 1」；3 2 1 是「全进再全出」。$n = 3$ 的合法出栈序列共有卡特兰数 5 种：123、132、213、231、321。"
        },
        {
          id: "ds-stack-queue-q2",
          type: "fill",
          q: "循环队列采用「牺牲一个存储单元」方案，数组大小 MaxSize=10，front 指向队头元素、rear 指向队尾元素的下一个空位。队满条件是 (rear+1)%10 == front；当 front=3 时，队满时 rear 的值是 ____（填数字）。",
          answer: ["2", "rear=2", "rear = 2"],
          why: "队满条件要求 (rear+1) % 10 == front == 3，即 rear+1 必须是 3 或 13，由于 rear 取值范围是 0..9，故 rear = 2。注意 9 不是答案：rear=9 时 (9+1)%10 = 0，与 front=3 不相等，此时元素个数是 (9-3+10)%10 = 6，队列远未满。"
        },
        {
          id: "ds-stack-queue-q3",
          type: "multi",
          q: "关于栈、队列与其应用，下列说法正确的有哪些？",
          options: [
            "中缀表达式转后缀表达式时，栈里存放的是运算符，操作数直接输出到结果串",
            "图的广度优先搜索（BFS）需要借助队列实现，因为要按发现顺序逐层扩展",
            "共享栈把两个栈的栈底设在数组两端、栈顶相向增长，判满条件是 top0 + 1 == top1",
            "循环队列用「牺牲一个存储单元」方案时，队列最多能存放 MaxSize 个元素"
          ],
          answer: [0, 1, 2],
          why: "A 正确，转换过程中的栈只服务于运算符优先级与括号配对，操作数一遇到就输出。B 正确，BFS 的「先发现的先扩展」就是 FIFO。C 正确，两栈顶相邻即无空位可再用。D 错：牺牲一个单元意味着判满时数组里始终有一个空位，最多只能存 MaxSize-1 个元素；想存满 MaxSize 个必须改用 size 计数器或 tag 标志方案。"
        },
        {
          id: "ds-stack-queue-q4",
          type: "order",
          q: "把中缀表达式转后缀表达式的手算流程排成正确顺序。",
          items: [
            "遇到操作数，直接输出到结果串",
            "遇到左括号，直接压入运算符栈",
            "遇到右括号，连续弹出栈顶运算符并输出，直到遇到左括号为止，左括号弹出但不输出",
            "遇到运算符时，先弹出栈中所有优先级不低于它的运算符并输出，再把自己压栈",
            "扫描结束后，把栈中剩余的运算符依次弹出并输出"
          ],
          answer: [0, 1, 2, 3, 4],
          why: "整个流程按扫描顺序执行：操作数即时输出；左括号作为「分界标记」入栈；右括号负责清空到最近的左括号；普通运算符入栈前要先处理优先级不低于自己的栈顶（保证同级运算符左结合）；最后收尾弹出残余运算符。若把第 4 步的「不低于」写成「高于」，同级运算符（如 $a - b + c$）的左右顺序就会算错。"
        }
      ]
    },
    {
      id: "ds-string-kmp",
      title: "串与模式匹配：从朴素匹配到 KMP",
      goal: "学完后你能说明朴素匹配为什么会退化到 $O(n \\cdot m)$，能手算模式串的 next 与 nextval 数组并用它手工模拟一次匹配，能解释前缀函数的思想为什么在其它场景也能复用。",
      est: 45,
      blocks: [
        {
          type: "concept",
          title: "朴素匹配（naive matching）到底浪费在哪里",
          md: "串（string）的模式匹配（pattern matching）问题：在主串 $S$（长度 $n$）中找出模式串 $T$（长度 $m$）第一次出现的位置。\n\n朴素做法（BF 算法，Brute Force）是双指针硬扫：i 指向主串、j 指向模式，相等就同时后移；一旦失配，就把 $i$ 退回**本次尝试起点的下一个位置（$i = i - j + 1$）**，$j$ 归零，从头再来。\n\n它的浪费非常具体：**已经比较过的信息被全部丢弃**。看这个经典的最坏例子：\n\n- 主串 $S = \\text{aaaaaaab}$（7 个 a 后跟一个 b）\n- 模式 $T = \\text{aaab}$\n\n每一趟都要先比中 3 个 a，在第 4 位（b 对 a）才失配，于是回退、重来。总比较次数约为 $(n-m+1) \\times m$，当 $m$ 与 $n$ 同阶时是 $O(n \\cdot m)$。\n\n关键问题是：这 3 个 a 的匹配结果真的没用吗？不是。我们知道 S 的这一段就是 aaa，模式的前缀也是 aaa——**这段信息足以让我们知道模式最多能往右滑多远还不至于漏掉匹配**，而朴素匹配却把 i 退回去重新比一遍。\n\nKMP（Knuth-Morris-Pratt）的全部思想就是一句话：**主串指针 $i$ 永不后退，失配时只让模式串尽量往右滑**。滑坡的距离由模式串自身的结构决定，与主串无关，所以可以预处理。"
        },
        {
          type: "concept",
          title: "next 数组的定义与逐位手算",
          md: "这个流程就是「模式串自己和自己做一次匹配」。教材版 next 数组的定义（下标 1 起始，模式串存于 $t[1..m]$）是这样一句话：$\\text{next}[j]$ 表示 $t[1..j-1]$ 中**最长的、既是真前缀又是真后缀的子串长度再加 1**；$j = 1$ 时无前缀可用，规定 $\\text{next}[1] = 0$ 作为哨兵。\n\n以 $T = \\text{abaabc}$ 为例，逐位手算（每一行列出 $t[1..j-1]$ 的全部真后缀，与真前缀 $\\{a, ab, aba, abaa, abaab\\}$ 比较）：\n\n1. $j = 1$：规定 $\\text{next}[1] = 0$。\n2. $j = 2$：$t[1..1] = \\text{a}$，真后缀集合为空，最长公共长度 0，$\\text{next}[2] = 0 + 1 = 1$。\n3. $j = 3$：$t[1..2] = \\text{ab}$，真后缀只有 b，与真前缀 a 不相等，长度 0，$\\text{next}[3] = 1$。\n4. $j = 4$：$t[1..3] = \\text{aba}$，真后缀 a、ba 中 a 与前缀 a 相同，最长长度 1，$\\text{next}[4] = 1 + 1 = 2$。\n5. $j = 5$：$t[1..4] = \\text{abaa}$，真后缀 a、aa、baa 中最长匹配者是 a，长度 1，$\\text{next}[5] = 2$。\n6. $j = 6$：$t[1..5] = \\text{abaab}$，真后缀 b、ab、aab、baab 中 ab 与前缀 ab 相同，最长长度 2，$\\text{next}[6] = 2 + 1 = 3$。\n\n所以 $\\text{next} = [0, 1, 1, 2, 2, 3]$（下标 1..6）。对照另一种常见定义（前缀函数 $\\pi$，下标 0 起始，$\\pi[i]$ 表示 $s[0..i]$ 的最长公共前后缀长度）：$\\pi = [0, 0, 1, 1, 2, 0]$，把它逐位加 1 并整体右移，就得到教材的 next。**两种定义数值不同但完全等价**，考试手算前必须先写清你用哪一种。\n\nnextval（优化版）解决的是「退过去还是同一个字符，比了也白比」：若 $t[j]$ 与 $t[\\text{next}[j]]$ 相等，那么退到 $\\text{next}[j]$ 位置必然再次失配，应当继续沿链回退。判断规则是——若相等则 $\\text{nextval}[j] = \\text{nextval}[\\text{next}[j]]$，否则 $\\text{nextval}[j] = \\text{next}[j]$。对 $T = \\text{abaabc}$（下标 1 起始）逐位检查：\n\n- $j = 2$：$t[2] = \\text{b}$，$\\text{next}[2] = 1$，$t[1] = \\text{a}$，不相等，$\\text{nextval}[2] = 1$\n- $j = 3$：$t[3] = \\text{a}$，$\\text{next}[3] = 1$，$t[1] = \\text{a}$，相等，$\\text{nextval}[3] = \\text{nextval}[1] = 0$\n- $j = 4$：$t[4] = \\text{a}$，$\\text{next}[4] = 2$，$t[2] = \\text{b}$，不相等，$\\text{nextval}[4] = 2$\n- $j = 5$：$t[5] = \\text{b}$，$\\text{next}[5] = 2$，$t[2] = \\text{b}$，相等，$\\text{nextval}[5] = \\text{nextval}[2] = 1$\n- $j = 6$：$t[6] = \\text{c}$，$\\text{next}[6] = 3$，$t[3] = \\text{a}$，不相等，$\\text{nextval}[6] = 3$\n\n得到 $\\text{nextval} = [0, 1, 0, 2, 1, 3]$。凡是出现 t[j] == t[next[j]] 的位置都要沿链继续回退，这就是 nextval 相对 next 的全部改进；当模式串含大量重复字符（如 aaaaa、ababab）时收益最明显。\n\n复杂度：预处理 next 是 $O(m)$，匹配阶段因为 $i$ 只增不减（最多走 n 步），$j$ 的总回退量不超过 $i$ 的总增量，所以整体是 **$O(n + m)$**。这就是它比 $O(n \\cdot m)$ 的本质改进——不是常数变小，而是阶降低了。"
        },
        {
          type: "code",
          lang: "c",
          title: "朴素匹配 vs KMP：完整实现并统计比较次数",
          code: "#include <stdio.h>\n#include <string.h>\n\n/* 朴素匹配：返回首次匹配的起始下标（1 起始），失败返回 0，并统计比较次数 */\nint naive_match(const char *s, const char *t, int *cmp) {\n    int n = (int)strlen(s), m = (int)strlen(t);\n    int i = 1, j = 1;\n    *cmp = 0;\n    while (i <= n && j <= m) {\n        (*cmp)++;\n        if (s[i - 1] == t[j - 1]) { i++; j++; }\n        else { i = i - j + 2; j = 1; }   /* 主串指针回退到本轮起点的下一位 */\n    }\n    return (j > m) ? (i - m) : 0;\n}\n\n/* 求 next 数组（1 起始约定：next[1]=0），t 从下标 0 存放 */\nvoid get_next(const char *t, int next[]) {\n    int m = (int)strlen(t), i = 1, j = 0;\n    next[1] = 0;\n    while (i < m) {\n        if (j == 0 || t[i - 1] == t[j - 1]) { i++; j++; next[i] = j; }\n        else j = next[j];\n    }\n}\n\n/* 求 nextval 数组（修正版：T[j]==T[next[j]] 时继续往前退） */\nvoid get_nextval(const char *t, int nextval[]) {\n    int next[64];\n    int m = (int)strlen(t), j = 2;\n    get_next(t, next);\n    nextval[1] = 0;\n    for (j = 2; j <= m; j++) {\n        if (t[j - 1] == t[next[j] - 1]) nextval[j] = nextval[next[j]];\n        else nextval[j] = next[j];\n    }\n}\n\nint kmp_match(const char *s, const char *t, const int next[], int *cmp) {\n    int n = (int)strlen(s), m = (int)strlen(t);\n    int i = 1, j = 1;\n    *cmp = 0;\n    while (i <= n && j <= m) {\n        (*cmp)++;\n        if (j == 0 || s[i - 1] == t[j - 1]) { i++; j++; }\n        else j = next[j];                /* 主串指针 i 绝不后退 */\n    }\n    return (j > m) ? (i - m) : 0;\n}\n\nstatic void dump(const char *name, const int a[], int m) {\n    int i;\n    printf(\"%s = [\", name);\n    for (i = 1; i <= m; i++) printf(\"%d%s\", a[i], i < m ? \", \" : \"\");\n    printf(\"]\\n\");\n}\n\nint main(void) {\n    const char *s = \"abababc\";\n    const char *t = \"ababc\";\n    const char *p = \"abaabc\";\n    int next[64], nextval[64];\n    int cmp1, cmp2, pos1, pos2;\n\n    get_next(p, next);\n    get_nextval(p, nextval);\n    printf(\"模式串 %s 长度 %d\\n\", p, (int)strlen(p));\n    dump(\"next   \", next, (int)strlen(p));\n    dump(\"nextval\", nextval, (int)strlen(p));\n\n    get_next(t, next);\n    pos1 = naive_match(s, t, &cmp1);\n    pos2 = kmp_match(s, t, next, &cmp2);\n    printf(\"主串 %s，模式 %s\\n\", s, t);\n    printf(\"朴素匹配：位置 %d，比较 %d 次\\n\", pos1, cmp1);\n    printf(\"KMP 匹配：位置 %d，比较 %d 次\\n\", pos2, cmp2);\n\n    {\n        const char *s2 = \"aaaaaaaab\";\n        const char *t2 = \"aaab\";\n        get_next(t2, next);\n        pos1 = naive_match(s2, t2, &cmp1);\n        pos2 = kmp_match(s2, t2, next, &cmp2);\n        printf(\"最坏例子 s=%s t=%s\\n\", s2, t2);\n        printf(\"朴素匹配：位置 %d，比较 %d 次\\n\", pos1, cmp1);\n        printf(\"KMP 匹配：位置 %d，比较 %d 次\\n\", pos2, cmp2);\n    }\n    return 0;\n}"
        },
        {
          type: "code",
          lang: "python",
          title: "Python 对照：用列表下标 0 实现同一套 next / KMP",
          code: "# 与 C 版本逻辑一致；这里把 1 起始的教材写法平移到 0 起始，便于直接用 Python 列表\n\n\ndef get_next(t):\n    \"\"\"教材 next 数组（1 起始）平移到 0 起始：next[0] 恒为 -1\"\"\"\n    m = len(t)\n    nxt = [-1] * m\n    i, j = 0, -1\n    while i < m - 1:\n        if j == -1 or t[i] == t[j]:\n            i += 1\n            j += 1\n            nxt[i] = j\n        else:\n            j = nxt[j]\n            return nxt\n\n\n            def get_nextval(t):\n                m = len(t)\n                nv = [-1] * m\n                i, j = 0, -1\n                while i < m - 1:\n                    if j == -1 or t[i] == t[j]:\n                        i += 1\n                        j += 1\n                        nv[i] = nv[j] if t[i] == t[j] else j\n                    else:\n                        j = nv[j]\n                        return nv\n\n\n                        def naive_match(s, t):\n                            \"\"\"返回 (起始下标, 比较次数)，下标 0 起始，未找到返回 (-1, 次数)\"\"\"\n                            n, m = len(s), len(t)\n                            i = j = 0\n                            cmp_cnt = 0\n                            while i < n and j < m:\n                                cmp_cnt += 1\n                                if s[i] == t[j]:\n                                    i += 1\n                                    j += 1\n                                else:\n                                    i = i - j + 1      # 主串指针回退\n                                    j = 0\n                                    return (i - m if j == m else -1), cmp_cnt\n\n\n                                    def kmp_match(s, t, nxt):\n                                        n, m = len(s), len(t)\n                                        i = j = 0\n                                        cmp_cnt = 0\n                                        while i < n and j < m:\n                                            cmp_cnt += 1\n                                            if j == -1 or s[i] == t[j]:\n                                                i += 1\n                                                j += 1\n                                            else:\n                                                j = nxt[j]         # 主串指针 i 不后退\n                                                return (i - m if j == m else -1), cmp_cnt\n\n\n                                                print(\"模式串 abaabc 长度 6\")\n                                                print(\"next    = %s（0 起始写法，加 1 即为教材的 1 起始写法）\" % get_next(\"abaabc\"))\n                                                print(\"nextval = %s\" % get_nextval(\"abaabc\"))\n\n                                                for s, t in ((\"abababc\", \"ababc\"), (\"aaaaaaaab\", \"aaab\")):\n                                                    nxt = get_next(t)\n                                                    p1, c1 = naive_match(s, t)\n                                                    p2, c2 = kmp_match(s, t, nxt)\n                                                    print(\"主串 %s，模式 %s\" % (s, t))\n                                                    print(\"  朴素匹配：位置 %d（0 起始，教材 1 起始写法为 %d），比较 %d 次\" % (p1, p1 + 1, c1))\n                                                    print(\"  KMP 匹配：位置 %d（0 起始，教材 1 起始写法为 %d），比较 %d 次\" % (p2, p2 + 1, c2))\n\n                                                    # 前缀函数（prefix function）的另一个用途：判断字符串是否由重复的子串拼成\n                                                    def is_repeated(s):\n                                                        m = len(s)\n                                                        pi = [0] * m\n                                                        for i in range(1, m):\n                                                            j = pi[i - 1]\n                                                            while j > 0 and s[i] != s[j]:\n                                                                j = pi[j - 1]\n                                                                if s[i] == s[j]:\n                                                                    j += 1\n                                                                    pi[i] = j\n                                                                    period = m - pi[m - 1]\n                                                                    return (m % period == 0 and period < m), period\n\n\n                                                                    for s in (\"abcabcabc\", \"ababab\", \"abcd\"):\n                                                                        rep, per = is_repeated(s)\n                                                                        print(\"%s 是否由重复子串拼成：%s（最短循环节长度 %d）\" % (s, rep, per))"
        },
        {
          type: "calc",
          title: "手算：模式串 abaabc 的 next / nextval 与比较次数",
          inputs: [
            { name: "模式串", value: "$T = \\text{abaabc}$（长度 $m = 6$），采用 1 起始约定，$\\text{next}[1] = 0$" },
            { name: "主串与模式（最坏例子）", value: "$S = \\text{aaaaaaaab}$（长度 $n = 9$），$T = \\text{aaab}$（长度 $m = 4$）" }
          ],
          outputs: [
            "$\\text{next}[1..6] = [0, 1, 1, 2, 2, 3]$：$\\text{next}[4]=2$ 来自前缀 abaa 的最长公共前后缀 a（长度 1，再加 1）；$\\text{next}[6]=3$ 来自前缀 abaab 的最长公共前后缀 ab（长度 2，再加 1）",
            "$\\text{nextval}[1..6] = [0, 1, 0, 2, 1, 3]$：j=3 时 $t[3]=\\text{a}$ 与 $t[\\text{next}[3]]=t[1]=\\text{a}$ 相等，故 $\\text{nextval}[3]=\\text{nextval}[1]=0$；j=5 时 $t[5]=\\text{b}$ 与 $t[\\text{next}[5]]=t[2]=\\text{b}$ 相等，故 $\\text{nextval}[5]=\\text{nextval}[2]=1$；其余位置不相等，直接取 next 的值",
            "最坏例子朴素匹配：每趟比 3 个 a 后在第 4 位失配，共尝试 6 趟，比较次数 $6 \\times 4 = 24$ 次（量级 $O(n \\cdot m)$）",
            "同一例子 KMP：i 只前进不后退，比较次数 12 次（每趟只回退模式指针，主串指针不回退），量级 $O(n+m)$",
            "一般情况下 KMP 的预处理 $O(m)$、匹配 $O(n)$，总计 $O(n+m)$；朴素匹配最坏 $O(n \\cdot m)$"
          ],
          note: "手算 next 的口诀：看「前 $j-1$ 个字符」里最长的「既是前缀又是后缀」的真子串长度 $L$，则 $\\text{next}[j] = L + 1$；$\\text{next}[1]$ 永远是 0。"
        },
        {
          type: "interactive",
          lab: "datalab",
          title: "单步模拟 KMP：失配后模式串滑到哪里",
          config: {
            state: { 步骤: "准备", 主串指针i: 1, 模式指针j: 1, 当前比较: "S[1] vs T[1]", 已匹配: "无", 说明: "next = [0,1,1,2,2,3]，nextval = [0,1,0,2,1,3]，模式串 T=abaabc" },
            steps: [
              { desc: "第 1 步：i=1、j=1，比较 S[1]=b 与 T[1]=a，失配", state: { 步骤: "首次比较", 主串指针i: 1, 模式指针j: 1, 当前比较: "b vs a", 已匹配: "无", 说明: "j=1 时 next[1]=0，置 j=0 后 i 与 j 同时加 1，相当于模式整体右滑一位" }, note: "j=0 是「哨兵」，代表模式串已无前缀可用，只能让主串前进一格。" },
              { desc: "第 2 步：j 归零后重置，i=2、j=1，比较 S[2]=a 与 T[1]=a，匹配", state: { 步骤: "重新开始", 主串指针i: 2, 模式指针j: 1, 当前比较: "a vs a", 已匹配: "1 个字符", 说明: "匹配成功，i 与 j 一起加 1" }, note: "注意 i 从 1 走到 2，从来没有退回到 1 之前。" },
              { desc: "第 3 步：i=3、j=2，S[3]=a 与 T[2]=b 匹配，已匹配 2 个", state: { 步骤: "连续匹配", 主串指针i: 3, 模式指针j: 2, 当前比较: "a vs b", 已匹配: "2 个字符 ab", 说明: "已匹配前缀 ab" }, note: "已匹配的这段前缀信息，正是后面失配时可以复用的东西。" },
              { desc: "第 4 步：i=4、j=3，S[4]=a 与 T[3]=a 匹配，已匹配 3 个", state: { 步骤: "匹配到第 3 位", 主串指针i: 4, 模式指针j: 3, 当前比较: "a vs a", 已匹配: "3 个字符 aba", 说明: "已匹配前缀 aba，最长公共前后缀为 a（长度 1），对应 $\\text{next}[4] = 1 + 1 = 2$" }, note: "这里的 1 就是 next[4]-1，稍后失配时模式串靠它决定滑动距离。" },
              { desc: "第 5 步：i=5、j=4，S[5]=a 与 T[4]=a 匹配，继续推进", state: { 步骤: "继续匹配", 主串指针i: 5, 模式指针j: 4, 当前比较: "a vs a", 已匹配: "4 个字符 abaa", 说明: "已匹配前缀 abaa，最长公共前后缀仍为 a（长度 1），对应 next[5]=2" }, note: "$i$ 已经推进到 5，整个过程主串指针单调递增，这是 KMP 的关键不变量。" },
              { desc: "第 6 步：i=6、j=5，S[6]=a 与 T[5]=a 匹配，已匹配 5 个", state: { 步骤: "匹配 5 位", 主串指针i: 6, 模式指针j: 5, 当前比较: "a vs a", 已匹配: "5 个字符 abaab", 说明: "已匹配前缀 abaab，最长公共前后缀为 ab（长度 2），所以 $\\text{next}[6] = 2 + 1 = 3$" }, note: "此刻已经非常接近完全匹配，只差最后一位 c。" },
              { desc: "第 7 步：i=7、j=6，S[7]=a 与 T[6]=c 失配，查表得 next[6]=3，j 退到 3", state: { 步骤: "失配回退", 主串指针i: 7, 模式指针j: 3, 当前比较: "a vs c（失配）", 已匹配: "回退到第 3 位继续", 说明: "T[6] 失配时 j 从 6 跳到 $\\text{next}[6] = 3$，i 保持 7 不动" }, note: "朴素匹配此时会把 i 退回 2 重头再来；KMP 只把 j 拉回去，主串指针原地不动。" },
              { desc: "第 8 步：用 i=7、j=3 继续比较（S[7]=a 对 T[3]=a 匹配），走到 i=9 结束仍未找到模式串", state: { 步骤: "收尾", 主串指针i: 9, 模式指针j: 3, 当前比较: "结束", 已匹配: "无", 说明: "只有 j>m 才算匹配成功；本次 j 最大只到 6，因此返回失败" }, note: "KMP 的匹配阶段最坏比较次数是 $O(n)$，因为 i 只增不减，回退量也被 j 的下降幅度所限制。" }
            ],
            tasks: [
              { t: "把模式串换成 abab，手算它的 next 与 nextval，说明两者在第 3、4 位上为什么不同。", hint: "abab 出现连续重复的 ab。", check: "能算出 $\\text{next}=[0,1,1,2]$，$\\text{nextval}=[0,1,0,1]$，并说出「$t[3]=\\text{a}$ 与 $t[\\text{next}[3]]=t[1]=\\text{a}$ 相等，所以 $\\text{nextval}[3]$ 要沿链取 $\\text{nextval}[1]=0$」。" },
              { t: "改变主串使模式串在第 1 位就失配，观察 i 是否仍然单调递增。", hint: "把主串设成 bbbbb。", check: "能说明无论失配发生在哪一位，i 都不后退，这是 $O(n+m)$ 的来源。" }
            ]
          }
        },
        {
          type: "pitfall",
          title: "KMP 手算与实现中的易错点",
          items: [
            "把「最长公共前后缀」算成包含整个串：必须是**真前缀与真后缀**，长度必须小于当前前缀长度，否则 next 值会算大一格，匹配时出现死循环。",
            "混淆 next 与 nextval 的适用场合：nextval 是在 next 基础上「若退过去还是同一个字符就继续退」，它只在模式串有连续相同字符时才有收益；两者都能保证正确性，只是比较次数不同。",
            "下标约定没有先声明：教材常用 1 起始且 $\\text{next}[1]=0$，很多代码用 0 起始且 $\\text{next}[0]=-1$，两者数值整体差 1。考试手算前先写清约定，否则答案会被判错。",
            "以为预处理不用花时间：求 next 本身是 $O(m)$，只有在 $n$ 远大于 $m$ 时 KMP 的优势才明显；当 $m$ 很小或数据随机时，朴素匹配的常数更小，实测可能更快。",
            "把 KMP 说成「跳过已比较的字符」：KMP 一个字符都没有跳过比较，它只是**避免了主串指针回退**从而不重复比较同一段主串，本质是复用了模式串的前后缀信息。"
          ]
        },
        {
          type: "lab",
          title: "上机任务：给模式匹配加上计数与对照",
          steps: [
            "实现 next 与 nextval 两个版本，用随机生成的长度 8~12 的 01 串互相验证：两版 KMP 必须返回完全相同的匹配位置。",
            "在朴素匹配与两种 KMP 里各加一个比较计数器，对同一组测试数据打印三者的比较次数，观察 nextval 在「模式串含有连续重复字符」时是否更少。",
            "构造最坏输入（S 为全 a 加一个 b，T 为多个 a 加 b），令 $n = 1000$、$m = 100$，比较朴素匹配与 KMP 的比较次数，验证量级差异。",
            "用前缀函数解决一个非匹配问题：判断一个字符串能否由某个子串重复多次拼成，并求出最短循环节长度。测试 abcabcabc（最短循环节 abc）、ababab、abcd 三组数据。"
          ],
          note: "参考结论：abcabcabc 的最短循环节长度是 3；ababab 是 2；abcd 不是重复串。"
        }
      ],
      quiz: [
        {
          id: "ds-string-kmp-q1",
          type: "fill",
          q: "按教材约定（1 起始、$\\text{next}[1]=0$、$\\text{next}[j]$ 等于前 $j-1$ 个字符的最长公共前后缀长度加 1），模式串 abaabc 的 next 数组前 3 个值为 0、1、1，则 $\\text{next}[4]$、$\\text{next}[5]$、$\\text{next}[6]$ 依次是 ____（用逗号分隔填写三个数字）。",
          answer: ["1,2,3", "1，2，3", "1 2 3", "1, 2, 3", "1、2、3"],
          why: "next[4] 看前缀 aba，真后缀 {a,ba} 与前缀 {a,ab} 的公共最长者是 a（长度 1），故 $\\text{next}[4] = 1 + 1 = 2$；next[5] 看前缀 abaa，真后缀 {a,aa,baa} 中的 a 与前缀匹配（长度 1），故 $\\text{next}[5] = 1 + 1 = 2$；next[6] 看前缀 abaab，真后缀 {b,ab,aab,baab} 中的 ab 与前缀 ab 匹配（长度 2），故 $\\text{next}[6] = 2 + 1 = 3$。三处易错点：把 next[3] 当成 2——前缀 ab 的真后缀只有 b，与真前缀 a 不相等，故 $\\text{next}[3] = 1$；忘记「长度加 1」这一步；以及下标约定不同（前缀函数 $\\pi = [0,0,1,1,2,0]$ 加 1 才是这里的 next）。"
        },
        {
          id: "ds-string-kmp-q2",
          type: "single",
          q: "朴素模式匹配算法（BF）在最坏情况下的时间复杂度是 $O(n \\cdot m)$，其根本原因是？",
          options: [
            "每次失配都把主串指针回退到本轮起点的下一个位置，导致前面已比较过的字符被重复比较",
            "每次失配都让模式串指针 $j$ 回退到 0，而 $j$ 的回退本身需要 $O(m)$ 的时间",
            "算法需要额外的 $O(m)$ 空间保存 next 数组，空间换时间失败",
            "朴素算法必须对每个主串字符都重新扫描整个模式串，所以总比较次数恰好是 $n \\cdot m$"
          ],
          answer: 0,
          why: "朴素算法的瓶颈在于 i 的回退（$i = i-j+1$），同一段主串被反复比较，才出现 $(n-m+1) \\times m$ 这个量级。B 错在 j 的重置是 $O(1)$ 操作，不构成代价。C 错在朴素算法根本不需要 next 数组，空间是 $O(1)$。D 的「恰好 n*m」也不准确：当 m 接近 n 时比较次数是 $(n-m+1) \\times m$，比 n*m 小，最坏量级才是 $O(n \\cdot m)$。"
        },
        {
          id: "ds-string-kmp-q3",
          type: "multi",
          q: "关于 KMP 算法，下列说法正确的有哪些？",
          options: [
            "next 数组只依赖模式串自身的结构，与主串内容无关，因此可以预处理",
            "匹配阶段主串指针 $i$ 单调不减，$j$ 的下降总量不超过 $i$ 的上升总量，所以匹配是 $O(n)$",
            "KMP 通过跳过一部分主串字符来加速，因此比朴素算法少比较了一些主串位置",
            "nextval 数组是 next 的优化：当 $T[j]$ 与 $T[\\text{next}[j]]$ 相等时继续向前回退，减少无意义的比较"
          ],
          answer: [0, 1, 3],
          why: "A 正确，next 描述的是模式串自身的前后缀关系，所以对任意主串都能复用。B 正确，这是 KMP 达到 $O(n+m)$ 的证明要点。D 正确，nextval 专门处理模式串中出现连续相同字符的情形。C 错：KMP 并没有跳过任何主串字符不被比较，它只是让主串指针不回退，从而避免对同一段主串的重复比较，所以「少比较了主串位置」的说法不成立。"
        },
        {
          id: "ds-string-kmp-q4",
          type: "order",
          q: "下面是求 next 数组的核心循环，请把它的执行流程排成正确顺序：$i$ 从 1 开始扫描模式串（下标 1 起始），$j$ 表示当前已匹配的公共前后缀长度，$\\text{next}[1]$ 已置 0。",
          items: [
            "进入循环，判断条件 j == 0 || t[i] == t[j] 是否成立",
            "若 t[i] == t[j]，则 i 与 j 各自加 1，并把 j 记入 next[i]（前缀又延长了一位）",
            "若 j != 0 且 t[i] != t[j]，则 j = next[j]，把 j 退到更短的公共前后缀长度上继续尝试",
            "当 $i$ 达到 $m-1$ 时退出循环，$\\text{next}[1..m]$ 全部求出"
          ],
          answer: [0, 1, 2, 3],
          why: "这段求 next 的代码本质上是「模式串自己和自己做 KMP 匹配」：i 是扫描位置，j 是当前已匹配的公共前后缀长度。先判断，能延长就延长并记录（第 2 步），不能延长就沿 next 回退再试（第 3 步），直到 $i$ 走到 $m-1$ 结束。若把第 2、3 步对调，就变成「无论匹配与否都先回退」，next 会算小，匹配阶段会漏解。"
        }
      ]
    },
    {
      id: "ds-tree-bst",
      title: "树与二叉树：性质、遍历、还原与 BST",
      goal: "学完后你能用 $n_0 = n_2 + 1$ 等性质做 408 计算题，能由前序+中序（或后序+中序）还原二叉树，能写出 BST 的查找、插入、删除（含双子结点情形），能判断 AVL 失衡类型并完成四种旋转。",
      est: 55,
      blocks: [
        {
          type: "concept",
          title: "术语与必背性质：树的不变量",
          md: "树（tree）是 n 个结点的有限集合，有且仅有一个根（root），其余结点分成若干互不相交的子树。几个必须精确的术语：\n\n- **结点的度（degree）**：该结点拥有的子树个数；**树的度**是所有结点度的最大值。\n- **层次（level）**：根为第 1 层；**树的高度（深度）**是结点的最大层次。\n- **叶子（leaf）**：度为 0 的结点；**分支结点**是度不为 0 的结点。\n- **路径长度**：经过的边数；树的路径长度是所有结点路径长度之和。\n\n二叉树（binary tree）的五个必背性质：\n\n1. 非空二叉树的第 $i$ 层最多有 $2^{i-1}$ 个结点。\n2. 高度为 $h$ 的二叉树最多有 $2^h - 1$ 个结点（满二叉树）。\n3. 叶子数关系：**$n_0 = n_2 + 1$**。推导只有两行，但必须会：设结点总数 $n = n_0 + n_1 + n_2$；从边的角度看，除根外每个结点都恰有一条来自父结点的边，所以 $n - 1 = 0 \\cdot n_0 + 1 \\cdot n_1 + 2 \\cdot n_2$；两式联立得 $n_0 = n_2 + 1$。\n4. n 个结点的完全二叉树（complete binary tree）高度为 $\\lfloor \\log_2 n \\rfloor + 1$，即 $\\lceil \\log_2(n+1) \\rceil$；若按层序从 1 开始编号，则结点 $i$ 的左孩子是 $2i$、右孩子是 $2i+1$、父结点是 $\\lfloor i/2 \\rfloor$。\n5. n 个结点的二叉树共有 $\\frac{C_{2n}^{n}}{n+1}$ 种不同形态（卡特兰数），这是「给定 n 个结点有多少种二叉树」的标准答案。\n\n顺带记住两个常见变形：完全二叉树中叶子只可能出现在最后两层，且度为 1 的结点最多只有一个（$n_1 = 0$ 或 1）；若某完全二叉树有 1000 个结点，则由 $n_0 = n_2 + 1$ 与 $n_0 + n_1 + n_2 = 1000$ 可解出 $n_0 = 500$（$n_1 = 1$）。"
        },
        {
          type: "concept",
          title: "四种遍历与「由遍历序列还原二叉树」",
          md: "遍历（traversal）的本质是「访问根结点的时机不同」：\n\n- 前序（preorder，根左右）：先访问根，再递归左子树，再递归右子树。\n- 中序（inorder，左根右）：递归左子树，访问根，递归右子树。\n- 后序（postorder，左右根）：递归左右子树，最后访问根。\n- 层序（level order）：借助**队列**逐层访问。\n\n前序的第一个结点、后序的最后一个结点、层序的第一个结点都必然是**根**——这就是还原二叉树的钥匙。\n\n**中序 + 前序可以唯一还原**：前序给出根，拿着这个根去中序里一劈为二，左边是左子树的中序、右边是右子树的中序；左右子树的结点个数又反过来确定了前序的切分位置，递归下去唯一确定。**中序 + 后序**同理（后序的最后一个才是根，要从后往前切）。\n\n**前序 + 后序不能唯一还原**，原因是它无法区分「只有左孩子」与「只有右孩子」。反例：\n\n- 树 A：A 为根，B 为左孩子。前序 = AB，后序 = BA。\n- 树 B：A 为根，B 为右孩子。前序同样是 AB，后序同样是 BA。\n\n两棵不同的树给出完全相同的前序与后序序列，所以不唯一。结论要能背下来：**中序是还原二叉树的必要条件**（层序 + 中序也可以）。\n\n一个实用的手算技巧：由前序确定根，由中序确定左右子树范围，在纸上画括号标注区间，递归展开；每确定一个根就把它写进后序序列的**末尾**（后序是左右根），这样一次遍历就能写出答案。"
        },
        {
          type: "concept",
          title: "线索二叉树（threaded binary tree）：把空指针用起来",
          md: "在 n 个结点的二叉链表中有 $2n$ 个指针域，其中只有 $n-1$ 个真正指向孩子，剩下 $n+1$ 个是空指针（NULL）。线索二叉树把这 $n+1$ 个空指针改造成指向前驱或后继的「线索（thread）」，用两个标志位区分指针的含义：\n\n- ltag = 0：lchild 指向左孩子；ltag = 1：lchild 指向**中序前驱**。\n- rtag = 0：rchild 指向右孩子；rtag = 1：rchild 指向**中序后继**。\n\n它解决两个问题：\n\n1. **空间浪费**：$n+1$ 个空指针被利用起来，不需要额外的栈或递归。\n2. **遍历更快**：中序线索化后，找后继的规则简单到两句话——若 rtag==1，则 rchild 就是后继；若 rtag==0，则后继是**右子树中最左下的结点**。因此中序遍历可以完全不用栈，空间 $O(1)$。\n\n工程上还有一个小技巧：加一个**头结点**，让头结点的 lchild 指向根、rchild 指向中序最后一个结点，同时让中序第一个结点的 ltag 指向头结点、最后一个结点的 rtag 指向头结点。这样整棵线索二叉树就变成一条环状链表，遍历时无需判空与特判。\n\n代价也要说清楚：线索化需要一次 $O(n)$ 的遍历；插入、删除结点时必须同步维护线索，操作比普通二叉树复杂得多，所以它主要出现在「静态建树 + 频繁遍历」的场景（如编译器符号表的遍历、表达式树的求值顺序）。"
        },
        {
          type: "concept",
          title: "二叉排序树（BST）：有序性带来的效率与退化风险",
          md: "二叉排序树（binary search tree，简称 BST，也叫二叉查找树）只规定一件事：**任一结点，其左子树所有关键字都小于它，右子树所有关键字都大于它**。这一条性质直接推出两个重要结论：\n\n1. **中序遍历必得升序序列**——这就是「排序树」名字的来源，也是考试里判断一棵树是否为 BST 的最快方法。\n2. **查找可以剪枝**：从根开始比较，小于就走左、大于就走右，每一步都排除掉一整棵子树。\n\n**查找与插入的代价**取决于树高 $h$：查找 $O(h)$，插入总是插到某个叶子的空孩子位置（不会打乱有序性），也是 $O(h)$。\n\n**删除分三种情况**（408 高频）：\n\n- 叶子结点：直接删，把父结点的对应指针置空。\n- 只有一个孩子：用孩子顶替自己的位置，即「子承父业」。\n- 有两个孩子：不能简单删除（会留下两个无处安放的子树），标准做法是找**中序后继**（右子树中最左下的结点）或**中序前驱**（左子树中最右下的结点）来替换被删结点的值，再把它删掉。中序后继最多只有一个右孩子，删除它必然退化为前两种情况。\n\n**退化风险**是 BST 的致命弱点：把 1、2、3、4、5 按顺序插入，得到的是一条向右的单支链（本质是链表），树高 $h = n$，查找退化成 $O(n)$。所以平均 $O(\\log n)$ 与最坏 $O(n)$ 的差别完全取决于插入顺序——这就是后面要引入 AVL 的理由。"
        },
        {
          type: "concept",
          title: "AVL 树的四种旋转：用局部调整换回 $O(\\log n)$",
          md: "平衡二叉树（AVL tree，由 Adelson-Velsky 与 Landis 提出）要求**任一结点的左右子树高度差（平衡因子，balance factor）绝对值不超过 1**。这一约束把树高锁定在 $O(\\log n)$（n 个结点的 AVL 树高度不超过约 $1.44\\log_2(n+2)$），于是查找、插入、删除全部保证 $O(\\log n)$。\n\n插入一个结点后，若某个祖先的平衡因子变成 $+2$ 或 $-2$，就是失衡了，只需对**最小的失衡子树**做一次旋转即可恢复，共四种情形（以「新结点插入位置」命名）：\n\n1. **LL 型**（在左孩子的左子树插入）：对失衡结点做**一次右旋**。\n2. **RR 型**（在右孩子的右子树插入）：对失衡结点做**一次左旋**。\n3. **LR 型**（在左孩子的右子树插入）：先对左孩子**左旋**，再对失衡结点**右旋**（两次旋转）。\n4. **RL 型**（在右孩子的左子树插入）：先对右孩子**右旋**，再对失衡结点**左旋**（两次旋转）。\n\n记忆要点：**名字的第一个字母是「谁高」，操作方向与它相反**。旋转只改动常数个指针，代价 $O(1)$；插入最多需要 1 次旋转（或 1 次双旋），删除可能需要沿路径回溯 $O(\\log n)$ 次旋转。\n\n旋转后要检查三件事：中序序列不变（BST 性质不能破坏）、子树高度恢复、所有祖先的平衡因子回到合法范围。**中序序列不变**是检验旋转是否写对的最快方法。\n\n以依次插入 1、2、3、4、5 为例：插入 3 时 1 的平衡因子变为 $-2$，属于 RR 型，对 1 左旋，2 上升为根；继续插入 4、5 时再次 RR 旋转，最终树高为 3 而不是 5。这就是 AVL 用旋转换来的效率。"
        },
        {
          type: "code",
          lang: "c",
          title: "BST 的查找、插入、删除与中序遍历（完整可编译）",
          code: "#include <stdio.h>\n#include <stdlib.h>\n\ntypedef struct BSTNode {\n    int key;\n    struct BSTNode *left, *right;\n} BSTNode, *BSTree;\n\nBSTNode *bst_new(int key) {\n    BSTNode *p = (BSTNode *)malloc(sizeof(BSTNode));\n    p->key = key;\n    p->left = p->right = NULL;\n    return p;\n}\n\n/* 查找：每一步排除一整棵子树，代价 O(h) */\nBSTNode *bst_search(BSTree t, int key) {\n    while (t != NULL && t->key != key)\n        t = (key < t->key) ? t->left : t->right;\n    return t;\n}\n\n/* 插入：一定插到叶子的空孩子位置，不改动已有结构 */\nvoid bst_insert(BSTree *t, int key) {\n    if (*t == NULL) { *t = bst_new(key); return; }\n    if (key < (*t)->key) bst_insert(&(*t)->left, key);\n    else if (key > (*t)->key) bst_insert(&(*t)->right, key);\n    /* key 已存在则不做任何事，BST 不存重复关键字 */\n}\n\n/* 删除：分叶子 / 单孩子 / 双孩子三种情况 */\nvoid bst_delete(BSTree *t, int key) {\n    if (*t == NULL) return;\n    if (key < (*t)->key) { bst_delete(&(*t)->left, key); return; }\n    if (key > (*t)->key) { bst_delete(&(*t)->right, key); return; }\n\n    if ((*t)->left == NULL) {              /* 叶子或只有右孩子 */\n        BSTNode *del = *t;\n        *t = (*t)->right;\n        free(del);\n    } else if ((*t)->right == NULL) {      /* 只有左孩子 */\n        BSTNode *del = *t;\n        *t = (*t)->left;\n        free(del);\n    } else {                               /* 双孩子：用中序后继替换 */\n        BSTNode *s = (*t)->right;\n        while (s->left != NULL) s = s->left;   /* 右子树最左下即中序后继 */\n        (*t)->key = s->key;\n        bst_delete(&(*t)->right, s->key);      /* 后继最多一个右孩子，退化为前两种 */\n    }\n}\n\nvoid inorder(BSTree t) {\n    if (t == NULL) return;\n    inorder(t->left);\n    printf(\"%d \", t->key);\n    inorder(t->right);\n}\n\nvoid preorder(BSTree t) {\n    if (t == NULL) return;\n    printf(\"%d \", t->key);\n    preorder(t->left);\n    preorder(t->right);\n}\n\nint tree_height(BSTree t) {\n    int lh, rh;\n    if (t == NULL) return 0;\n    lh = tree_height(t->left);\n    rh = tree_height(t->right);\n    return 1 + (lh > rh ? lh : rh);\n}\n\nint main(void) {\n    BSTree t = NULL;\n    int keys[] = {6, 4, 9, 2, 5, 8, 10};\n    int i;\n    for (i = 0; i < 7; i++) bst_insert(&t, keys[i]);\n\n    printf(\"插入顺序 6 4 9 2 5 8 10\\n\");\n    printf(\"前序：\"); preorder(t); printf(\"\\n\");\n    printf(\"中序：\"); inorder(t); printf(\"（升序证明它是 BST）\\n\");\n    printf(\"树高：%d\\n\", tree_height(t));\n\n    printf(\"查 5：%s；查 7：%s\\n\",\n           bst_search(t, 5) ? \"找到\" : \"未找到\",\n           bst_search(t, 7) ? \"找到\" : \"未找到\");\n\n    bst_delete(&t, 4);   /* 双孩子：用中序后继 5 替换 */\n    printf(\"删除双子结点 4 后的中序：\"); inorder(t); printf(\"\\n\");\n    bst_delete(&t, 2);   /* 叶子 */\n    printf(\"删除叶子 2 后的中序：\"); inorder(t); printf(\"\\n\");\n\n    {   /* 退化演示：有序插入得到单支链 */\n        BSTree bad = NULL;\n        for (i = 1; i <= 5; i++) bst_insert(&bad, i);\n        printf(\"顺序插入 1..5 后树高 = %d（退化成链表，查找 O(n)）\\n\", tree_height(bad));\n    }\n    return 0;\n}"
        },
        {
          type: "code",
          lang: "python",
          title: "Python 对照：同一组数据的 BST + 遍历序列还原",
          code: "# 与 C 版本行为一致：同样的插入顺序、同样的中序结果\n\n\nclass BSTNode:\n    def __init__(self, key):\n        self.key = key\n        self.left = None\n        self.right = None\n\n\n        def bst_insert(root, key):\n            \"\"\"插入：新结点一定挂在某个空孩子位置\"\"\"\n            if root is None:\n                return BSTNode(key)\n                if key < root.key:\n                    root.left = bst_insert(root.left, key)\n                elif key > root.key:\n                    root.right = bst_insert(root.right, key)\n                    return root\n\n\n                    def bst_search(root, key):\n                        while root is not None and root.key != key:\n                            root = root.left if key < root.key else root.right\n                            return root\n\n\n                            def bst_delete(root, key):\n                                \"\"\"删除：叶子 / 单孩子 直接顶替；双孩子用中序后继替换\"\"\"\n                                if root is None:\n                                    return None\n                                    if key < root.key:\n                                        root.left = bst_delete(root.left, key)\n                                    elif key > root.key:\n                                        root.right = bst_delete(root.right, key)\n                                    else:\n                                        if root.left is None:\n                                            return root.right\n                                            if root.right is None:\n                                                return root.left\n                                                s = root.right\n                                                while s.left is not None:      # 右子树最左下 = 中序后继\n                                                    s = s.left\n                                                    root.key = s.key\n                                                    root.right = bst_delete(root.right, s.key)\n                                                    return root\n\n\n                                                    def inorder(root):\n                                                        return inorder(root.left) + [root.key] + inorder(root.right) if root else []\n\n\n                                                        def preorder(root):\n                                                            return [root.key] + preorder(root.left) + preorder(root.right) if root else []\n\n\n                                                            def postorder(root):\n                                                                return postorder(root.left) + postorder(root.right) + [root.key] if root else []\n\n\n                                                                def height(root):\n                                                                    return 0 if root is None else 1 + max(height(root.left), height(root.right))\n\n\n                                                                    def build_from_pre_in(pre, ino):\n                                                                        \"\"\"由前序 + 中序唯一还原二叉树\"\"\"\n                                                                        if not pre:\n                                                                            return None\n                                                                            root = BSTNode(pre[0])\n                                                                            k = ino.index(pre[0])                     # 根在中序中的位置切分左右子树\n                                                                            root.left = build_from_pre_in(pre[1:1 + k], ino[:k])\n                                                                            root.right = build_from_pre_in(pre[1 + k:], ino[k + 1:])\n                                                                            return root\n\n\n                                                                            root = None\n                                                                            for k in (6, 4, 9, 2, 5, 8, 10):\n                                                                                root = bst_insert(root, k)\n\n                                                                                print(\"插入顺序 6 4 9 2 5 8 10\")\n                                                                                print(\"前序：\", preorder(root))\n                                                                                print(\"中序：\", inorder(root), \"（升序证明它是 BST）\")\n                                                                                print(\"后序：\", postorder(root))\n                                                                                print(\"树高：\", height(root))\n                                                                                print(\"查 5：%s；查 7：%s\" % (\"找到\" if bst_search(root, 5) else \"未找到\",\n                                                                                    \"找到\" if bst_search(root, 7) else \"未找到\"))\n\n                                                                                root = bst_delete(root, 4)\n                                                                                print(\"删除双子结点 4 后的中序：\", inorder(root))\n                                                                                root = bst_delete(root, 2)\n                                                                                print(\"删除叶子 2 后的中序：\", inorder(root))\n\n                                                                                # 由遍历序列还原：\n                                                                                # 前序 ABDEC，中序 DBEAC  -> 还原后后序应为 DEBCA\n                                                                                pre = [\"A\", \"B\", \"D\", \"E\", \"C\"]\n                                                                                ino = [\"D\", \"B\", \"E\", \"A\", \"C\"]\n                                                                                restored = build_from_pre_in(pre, ino)\n                                                                                print(\"由前序 %s 与中序 %s 还原后，后序 = %s\" % (pre, ino, postorder(restored)))\n                                                                                print(\"中序复原校验：\", inorder(restored))\n\n                                                                                bad = None\n                                                                                for k in range(1, 6):\n                                                                                    bad = bst_insert(bad, k)\n                                                                                    print(\"顺序插入 1..5 后树高 = %d（退化成链表，查找 O(n)）\" % height(bad))"
        },
        {
          type: "calc",
          title: "手算：性质、还原与 AVL 旋转",
          inputs: [
            { name: "性质计算", value: "某完全二叉树共有 1000 个结点" },
            { name: "还原计算", value: "前序 ABDEC，中序 DBEAC" },
            { name: "AVL 场景", value: "空树依次插入 1、2、3、4、5" }
          ],
          outputs: [
            "由 $n_0 = n_2 + 1$ 与 $n_0 + n_1 + n_2 = 1000$、$n_1 = 0$ 或 1，解得 $n_1 = 1,\\ n_2 = 499,\\ n_0 = 500$",
            "该完全二叉树高度 $= \\lfloor \\log_2 1000 \\rfloor + 1 = 9 + 1 = 10$",
            "前序 ABDEC 的根是 A；中序 DBEAC 中 A 左边 DBE 是左子树、右边 C 是右子树；左子树前序 BDE 的根是 B，中序 DBE 中 D 在左、E 在右，故树为 A(B(D,E), C)",
            "该树的后序序列 = D E B C A（即 DEBCA），层序序列 = A B C D E",
            "AVL 依次插入 1..5：插入 3 时 1 的平衡因子变 $-2$，属 RR 型做一次左旋；插入 5 时再触发一次 RR 左旋，最终树高 $= 3$（而普通 BST 是 5）"
          ],
          note: "$n_0 = n_2 + 1$ 的两个式子必须会写：结点数关系 $n = n_0 + n_1 + n_2$，边数关系 $n-1 = n_1 + 2n_2$。"
        },
        {
          type: "calc",
          title: "手算：BST 的查找长度 ASL",
          inputs: [
            { name: "插入顺序", value: "6、4、9、2、5、8、10（共 7 个结点）" },
            { name: "查找对象", value: "7 个关键字等概率查找（成功查找）" }
          ],
          outputs: [
            "树形：根 6，左子树以 4 为根（2、5 为叶），右子树以 9 为根（8、10 为叶）",
            "各关键字的查找长度（比较次数）：6 是 1，4 与 9 是 2，2、5、8、10 是 3",
            "$\\text{ASL}_{\\text{成功}} = \\frac{1 \\times 1 + 2 \\times 2 + 3 \\times 4}{7} = \\frac{1 + 4 + 12}{7} = \\frac{17}{7} \\approx 2.43$",
            "若按 2、4、5、6、8、9、10 的顺序插入则退化成单支链，$\\text{ASL} = \\frac{1+2+3+4+5+6+7}{7} = 4$",
            "两种插入顺序的关键字集合完全相同，但 ASL 差了 1.57，说明 BST 的效率由树形（即插入顺序）决定"
          ],
          note: "ASL 的分母是关键字个数（成功查找）或空指针个数（不成功查找），问法不同分母不同，答题前先看清。"
        },
        {
          type: "interactive",
          lab: "datalab",
          title: "单步追踪 BST 查找路径与插入位置",
          config: {
            state: { 目标: 5, 当前结点: 6, 比较结果: "5 < 6，往左走", 已走步数: 0, 路径: "6" },
            steps: [
              { desc: "第 1 步：从根 6 出发，比较目标 5 与 6", state: { 目标: 5, 当前结点: 6, 比较结果: "5 < 6，往左走", 已走步数: 1, 路径: "6" }, note: "BST 查找每一步都能排除一整棵子树，所以代价是 $O(h)$ 而不是 $O(n)$。" },
              { desc: "第 2 步：到达结点 4，比较 5 与 4", state: { 目标: 5, 当前结点: 4, 比较结果: "5 > 4，往右走", 已走步数: 2, 路径: "6 -> 4" }, note: "路径长度加 1，比较次数也就是查找长度。" },
              { desc: "第 3 步：到达结点 5，相等，查找成功", state: { 目标: 5, 当前结点: 5, 比较结果: "5 == 5，命中", 已走步数: 3, 路径: "6 -> 4 -> 5" }, note: "关键字 5 的查找长度是 3，它在第 3 层，正好等于层号。" },
              { desc: "第 4 步：改查 7，仍从根 6 出发，7 > 6 往右", state: { 目标: 7, 当前结点: 6, 比较结果: "7 > 6，往右走", 已走步数: 1, 路径: "6" }, note: "查找 7 的前两步与查找 9 相同，BST 的路径是共享的。" },
              { desc: "第 5 步：到达 9，比较 7 与 9，7 < 9 往左", state: { 目标: 7, 当前结点: 9, 比较结果: "7 < 9，往左走", 已走步数: 2, 路径: "6 -> 9" }, note: "若继续往左走会遇到 8。" },
              { desc: "第 6 步：到达 8，7 < 8 往左，但左孩子为空，查找失败", state: { 目标: 7, 当前结点: 8, 比较结果: "7 < 8，左孩子为空，未找到", 已走步数: 3, 路径: "6 -> 9 -> 8 -> NULL" }, note: "失败查找的代价也是 $O(h)$；若要插入 7，就插在这个空位置，插完仍是 BST。" },
              { desc: "第 7 步：插入 7 后重新查一次，路径长度变为 4", state: { 目标: 7, 当前结点: 7, 比较结果: "7 == 7，命中", 已走步数: 4, 路径: "6 -> 9 -> 8 -> 7" }, note: "插入总是发生在叶子下方，不会破坏有序性，但可能让树变高。" },
              { desc: "第 8 步：对比退化情形——按 1、2、3、4、5 顺序插入", state: { 目标: 5, 当前结点: 1, 比较结果: "5 > 1 往右，5 > 2 往右…… 共比较 5 次", 已走步数: 5, 路径: "1 -> 2 -> 3 -> 4 -> 5" }, note: "单支链的树高等于结点数 n，查找退化成 $O(n)$，这正是 AVL 要解决的问题。" }
            ],
            tasks: [
              { t: "对同一棵树手工写出 2、5、8、10 四个关键字的查找长度，算出 $\\text{ASL}_{\\text{成功}}$ 并与 $\\frac{17}{7}$ 核对。", hint: "查找长度等于结点所在层号。", check: "能算出 $\\frac{1+2+2+3+3+3+3}{7} = \\frac{17}{7} \\approx 2.43$。" },
              { t: "把插入顺序改成 10、9、8、6、5、4、2，画出树形并说明它为什么退化成链表。", hint: "每次插入的关键字都比上一个更小。", check: "能指出所有结点都只有左孩子，树高 7，$\\text{ASL} = 4$。" }
            ]
          }
        },
        {
          type: "pitfall",
          title: "树与 BST 的易错点",
          items: [
            "把 $n_0 = n_2 + 1$ 记成 $n_0 = n_1 + 1$：这个式子的推导来自「边数 $= n-1 = n_1 + 2n_2$」，与 $n_1$ 无关，务必能现场推一遍。",
            "以为「前序 + 后序」也能唯一还原二叉树：不能。A 为根、B 为左孩子，与 A 为根、B 为右孩子，前序都是 AB、后序都是 BA，无法区分。中序（或层序）才是必需的。",
            "BST 删除双子结点时直接删掉：会让两棵子树无处安放。正确做法是用中序后继（右子树最左下）或中序前驱替换值，再删除那个后继结点。",
            "把 BST 的查找复杂度写成 $O(\\log n)$：只有当树接近平衡时才是 $O(\\log n)$，最坏（有序插入形成单支链）是 $O(n)$。所以「BST 查找是 $O(\\log n)$」这个说法必须加前提。",
            "AVL 旋转方向记反：LL 型是「左孩子的左子树太高」，做**右旋**让左孩子升上来；RR 型做左旋。LR 与 RL 是双旋，且注意先转孩子、再转失衡结点，顺序反了会破坏 BST 性质。",
            "线索二叉树的 ltag/rtag 含义写反：ltag=1 表示 lchild 指向前驱（不是左孩子），rtag=1 表示 rchild 指向后继。考试常在这里出判断题。"
          ]
        },
        {
          type: "lab",
          title: "上机任务：遍历、还原与 AVL 旋转",
          steps: [
            "实现二叉树的链式存储与前序、中序、后序、层序四种遍历，层序必须用队列；对同一棵树打印四种序列并互相校验（例如中序是否升序）。",
            "实现「由前序 + 中序还原二叉树」，并用「还原后中序序列是否等于输入的中序序列」作为自测条件；再用前序 + 后序尝试还原，构造出两个不同树却序列相同的例子，验证不唯一性。",
            "实现 BST 的插入、查找与三种删除，重点测试「删除双子结点」后中序序列是否仍升序。",
            "实现 AVL 的插入与四种旋转（LL、RR、LR、RL），每插入一个结点后打印树高与各结点平衡因子；用 1..10 的顺序插入测试，验证树高始终不超过 4（普通 BST 会是 10）。"
          ],
          note: "最常见的 bug 是旋转后忘记更新高度或平衡因子，导致后续判断失真；请在每次旋转后重新计算而不是递增递减。"
        }
      ],
      quiz: [
        {
          id: "ds-tree-bst-q1",
          type: "fill",
          q: "已知一棵二叉树的前序序列为 ABDEC、中序序列为 DBEAC，则它的后序序列是 ____（直接写出字母序列，不要空格）。",
          answer: ["DEBCA", "DEBCA（左右根）", "D E B C A", "DEB CA", "debca"],
          why: "前序第一个 A 是根；在中序 DBEAC 中 A 把序列切成左子树 DBE 与右子树 C。左子树前序是 BDE，故其根为 B，中序 DBE 中 D 在 B 左、E 在 B 右，所以左子树是 B(D, E)；右子树只有一个 C。后序按「左右根」输出：D、E、B、C、A，即 DEBCA。若答成 DBEAC 是把中序当成了后序；若答成 ABCDE 是按层序写的，说明混淆了遍历顺序。"
        },
        {
          id: "ds-tree-bst-q2",
          type: "single",
          q: "将关键字 6、4、9、2、5、8、10 依次插入初始为空的二叉排序树，该树的中序遍历序列是？",
          options: [
            "2 4 5 6 8 9 10",
            "6 4 2 5 9 8 10",
            "6 4 9 2 5 8 10",
            "无法确定，因为中序序列取决于插入顺序"
          ],
          answer: 0,
          why: "BST 的中序遍历必然是关键字的升序序列，与插入顺序无关，所以答案是升序的 2 4 5 6 8 9 10。B 是这棵树的前序序列（6,4,2,5,9,8,10），C 恰好等于插入顺序。D 错误在于误以为中序也依赖插入顺序：变化的只是树形与各关键字的查找长度（ASL），中序序列恒为升序。"
        },
        {
          id: "ds-tree-bst-q3",
          type: "single",
          q: "关于平衡二叉树（AVL 树），下列说法正确的是？",
          options: [
            "任一结点的左右子树高度差的绝对值不超过 1，因此树高为 $O(\\log n)$，查找、插入、删除都保证 $O(\\log n)$",
            "AVL 树要求左右子树结点个数完全相同，因此它一定是完全二叉树",
            "插入一个结点后若出现失衡，最多需要对 $O(\\log n)$ 个结点各做一次旋转才能恢复平衡",
            "LL 型失衡需要对失衡结点做一次左旋，RR 型失衡需要做一次右旋"
          ],
          answer: 0,
          why: "A 是 AVL 的定义与其效率结论，注意它约束的是**高度差**而不是结点个数。B 混淆了「平衡」与「完全」：AVL 只要求高度差不超 1，结点数可以相差很多，也不要求最后两层连续填满。C 错：插入后只需对**最小的失衡子树**做一次旋转（或一次双旋）即可整体恢复，只有删除才可能需要沿路径多次旋转。D 把方向说反了：LL 型是左子树过高，应右旋；RR 型是右子树过高，应左旋。"
        },
        {
          id: "ds-tree-bst-q4",
          type: "order",
          q: "把「由前序序列与中序序列还原二叉树」的手算步骤排成正确顺序。",
          items: [
            "取前序序列的第一个元素作为当前子树的根",
            "在中序序列中找到这个根的位置，它左边的部分是左子树的中序、右边的部分是右子树的中序",
            "由左子树中序的长度，在前序序列中切出左子树的前序，剩余部分为右子树的前序",
            "对左右子树递归重复上述过程，直到子序列为空"
          ],
          answer: [0, 1, 2, 3],
          why: "还原的核心是「前序定根、中序定左右、长度定切分」。顺序不能调换：必须先定根才能在中序里定位切分点，必须先知道左子树中序的长度才能从前序中切出左子树的范围；若先切前序再找根，就会失去切分依据。递归终止条件是子序列为空，此时该子树为 NULL。"
        }
      ]
    },
    {
      id: "ds-heap-huffman",
      title: "堆与哈夫曼树：优先队列与最优前缀码",
      goal: "学完后你能用数组表示完全二叉树并写出上浮、下沉，能说明建堆为什么是 $O(n)$ 而逐个插入是 $O(n \\log n)$，能手工构造哈夫曼树并计算 WPL 与哈夫曼编码，能解释它为什么能压缩文件。",
      est: 50,
      blocks: [
        {
          type: "concept",
          title: "堆（heap）：把完全二叉树塞进数组",
          md: "堆是一棵**完全二叉树**，并且满足堆序性（heap property）：\n\n- 大根堆（max-heap）：每个结点的关键字都大于等于其孩子，所以**堆顶是全局最大值**。\n- 小根堆（min-heap）：每个结点的关键字都小于等于其孩子，堆顶是全局最小值。\n\n它最妙的地方是**完全二叉树可以用数组存，不需要任何指针**：按层序从下标 1 开始编号，结点 $i$ 的左孩子是 $2i$、右孩子是 $2i+1$、父结点是 $\\lfloor i/2 \\rfloor$。因为完全二叉树除最后一层外都是满的、最后一层靠左连续排列，编号与数组下标一一对应，中间没有空洞。\n\n这个表示带来三个实际好处：\n\n1. **省掉 n 个指针域**：链表式二叉树每个结点要两个指针，堆里一个都不用。\n2. **父子关系是算术运算**：找父亲只需一次整数除法，比解引用指针更快，且内存连续、缓存友好。\n3. **有 n 个元素的堆，最后一个非叶结点是 $\\lfloor n/2 \\rfloor$**：这条结论是建堆算法的起点。\n\n代价是堆**只保证偏序**（父子有序），兄弟之间没有约定，所以堆不能用来做「中序遍历得到有序序列」这类操作。想按顺序输出全部元素，只能反复取堆顶——这就是堆排序。"
        },
        {
          type: "concept",
          title: "上浮（swim）与下沉（sink）：$O(\\log n)$ 的调整",
          md: "堆只有两个基本调整动作，理解了它们就理解了一切堆操作：\n\n- **上浮（swim / sift-up）**：新元素放在数组末尾（即完全二叉树的最后一个位置，保持完全二叉树性质），然后不断与父结点比较，若违反堆序就与父结点交换，直到父结点不小于它或到达根。\n- **下沉（sink / sift-down）**：把末尾元素搬到堆顶（或某个位置）后，不断与**较大（大根堆）的那个孩子**比较，若孩子更大就交换，直到孩子都不大于它或到达叶子。\n\n为什么是 $O(\\log n)$：完全二叉树的高度是 $\\lfloor \\log_2 n \\rfloor + 1$，而每比较一次就上升或下降一层，所以最多走树高步。\n\n**插入**：末尾放入 + 上浮，$O(\\log n)$。\n**删除堆顶**：把末尾元素搬到堆顶，长度减 1，然后下沉，$O(\\log n)$。注意「用末尾元素顶替堆顶」这一步很关键——如果直接删掉堆顶再把某个孩子提上来，会破坏完全二叉树的结构性质。\n\n一个常见疑问：下沉时为什么必须选**较大的孩子**交换？因为交换的目的是让新的父结点同时大于两个孩子；如果和较小的孩子交换，另一个孩子仍可能大于新父结点，堆序立刻被破坏。"
        },
        {
          type: "concept",
          title: "建堆为什么是 $O(n)$：一个容易算错的地方",
          md: "建堆（heapify）的标准做法是：从最后一个非叶结点 $\\lfloor n/2 \\rfloor$ 开始，**倒序**对每个结点执行一次下沉，直到根。\n\n很多人的直觉是「$\\frac{n}{2}$ 个结点各下沉 $O(\\log n)$，所以是 $O(n \\log n)$」——这是错的。正确结论是 **$O(n)$**，理由在于不同高度的结点下沉距离不同：\n\n- 高度为 1 的结点（倒数第二层，数量约占 $\\frac{n}{2}$）下沉最多 1 层；\n- 高度为 2 的结点（约占 $\\frac{n}{4}$）下沉最多 2 层；\n- 高度为 $h$ 的结点数量约为 $\\frac{n}{2^{h+1}}$……\n\n把「结点个数 × 各自下沉的最大层数」求和：\n\n$$\\text{总代价} \\le \\frac{n}{4} \\cdot 1 + \\frac{n}{8} \\cdot 2 + \\frac{n}{16} \\cdot 3 + \\cdots < n\\left(\\frac{1}{4} + \\frac{2}{8} + \\frac{3}{16} + \\cdots\\right) = O(n)$$\n\n级数 $\\sum_{k \\ge 1} \\frac{k}{2^{k+1}}$ 收敛到 1，所以总代价是 $O(n)$ 而不是 $O(n \\log n)$。**倒序下沉的关键在于：越靠近底层的结点越多，而它们下沉的距离越短**，这正是复杂度降下来的原因。\n\n对照实验（务必亲手验证）：把 n 个元素**逐个插入**空堆，每次插入都要上浮，最坏共 $O(n \\log n)$；而**先全部放入数组再倒序下沉**只要 $O(n)$。两者结果都是合法堆，但代价相差一个 $\\log n$。以 $n = 10^6$ 为例，$\\log_2 n$ 约为 20，这就是 20 倍的差距。"
        },
        {
          type: "concept",
          title: "堆排序与优先队列（priority queue）",
          md: "**堆排序（heap sort）** 分两步，全部就地完成、只需 $O(1)$ 额外空间：\n\n1. 建大根堆，$O(n)$。\n2. 重复 $n-1$ 次：把堆顶（当前最大值）与当前末尾元素交换，堆的有效长度减 1，然后对新堆顶下沉，每次 $O(\\log n)$。\n\n总复杂度 $O(n \\log n)$，且**任何输入下都是 $O(n \\log n)$**（没有快速排序那种最坏退化）。但要注意一个反直觉的事实：**用大根堆排序得到的是升序序列**。因为每次把最大值换到数组末尾，最大值就固定在了最终位置上，从后往前依次填满。若用小根堆，取出的最小值会放在末尾，得到降序。\n\n不稳定：交换堆顶与末尾元素会跨距离移动元素，相等关键字的相对次序无法保持。\n\n**优先队列**是堆最重要的应用形态：它只需要「插入」与「取出最值」两个操作，正好对应上浮与下沉。用堆实现，两者都是 $O(\\log n)$；若用有序数组实现「取最值」是 $O(1)$ 但插入要 $O(n)$，用无序数组则相反。堆是这两个极端之间的最优折中：\n\n- 操作系统的任务调度（按优先级取最高）；\n- 哈夫曼编码的构造（每次取两个最小权值）；\n- Dijkstra 与 Prim 算法（每次取当前距离最小的顶点）；\n- 数据流的中位数（用一个大根堆 + 一个小根堆对分）。\n\n这些场景的共同点是：数据量可能很大、只关心最值、且插入与取最值交替发生——这正是堆的主场。"
        },
        {
          type: "concept",
          title: "哈夫曼树（Huffman tree）：贪心构造最优前缀码",
          md: "问题背景：要给字符设计二进制编码。**定长编码**（如 ASCII 用 8 位）简单但不经济；**变长编码**让高频字符用短码、低频字符用长码，总长度能大幅下降。但变长编码有一个硬约束——必须是**前缀码（prefix code）**：任何一个编码都不能是另一个编码的前缀，否则解码时无法判断边界（例如用 0 表示 a、01 表示 b，收到 01 时既可能是 a 后面跟 1，也可能是 b）。\n\n哈夫曼（Huffman）的解法既保证前缀性质，又保证总编码长度最小：\n\n1. 把每个字符看作只有一个结点的树，权值为其出现频率（或次数），全部放进集合。\n2. 每次从集合中取出**权值最小的两棵树**，合并成一棵新树：新根的权值 = 两者之和，左右孩子分别是这两棵树。\n3. 把新树放回集合，重复直到只剩一棵树。\n\n为什么这能保证「权大的靠近根、权小的被压到深处」：每合并一次，两棵子树的所有叶子深度都增加 1，增加的代价恰好是这两棵子树权值之和。贪心地先合并最小的两个，等价于「让最小权值的叶子最先被压深一层」，从而使得总代价最小。\n\n**带权路径长度 WPL（weighted path length）** = 所有叶子结点的「权值 × 从根到该叶子的路径长度（边数）」之和，它等于所有编码长度乘以各自频率的总和，也等于编码后文件的总位数。WPL 越小越省空间，哈夫曼树正是 WPL 最小的二叉树。\n\n解码时从根出发，遇 0 走左、遇 1 走右，走到叶子就输出一个字符并回到根——因为前缀性质，这个过程永远不会歧义。\n\n注意两个考点：哈夫曼树**没有度为 1 的结点**（每次都是两棵树合并，结点数 $n$ 与叶子数 $m$ 满足 $n = 2m - 1$）；权值相同的字符编码长度可能不同，但 WPL 唯一（最优值不唯一，最优解可能多解）。"
        },
        {
          type: "code",
          lang: "c",
          title: "大根堆的建堆、插入、删除堆顶与堆排序（完整可编译）",
          code: "#include <stdio.h>\n\n#define N 32\n\ntypedef struct {\n    int data[N + 1];   /* 下标 0 不用，结点从 1 开始，父 i/2、左 2i、右 2i+1 */\n    int size;\n} MaxHeap;\n\nvoid heap_init(MaxHeap *h, const int *a, int n) {\n    int i;\n    h->size = n;\n    for (i = 0; i < n; i++) h->data[i + 1] = a[i];\n    for (i = n / 2; i >= 1; i--) {          /* 从最后一个非叶结点倒序下沉 */\n        int k = i;\n        while (2 * k <= h->size) {\n            int c = 2 * k;                  /* 先假设左孩子更大 */\n            if (c + 1 <= h->size && h->data[c + 1] > h->data[c]) c++;\n            if (h->data[k] >= h->data[c]) break;\n            { int t = h->data[k]; h->data[k] = h->data[c]; h->data[c] = t; }\n            k = c;\n        }\n    }\n}\n\nvoid heap_push(MaxHeap *h, int x) {         /* 末尾放入 + 上浮 */\n    int k = ++h->size;\n    h->data[k] = x;\n    while (k > 1 && h->data[k] > h->data[k / 2]) {\n        int t = h->data[k]; h->data[k] = h->data[k / 2]; h->data[k / 2] = t;\n        k /= 2;\n    }\n}\n\nint heap_pop(MaxHeap *h, int *out) {        /* 末尾顶替堆顶 + 下沉 */\n    int k = 1;\n    if (h->size == 0) return 0;\n    *out = h->data[1];\n    h->data[1] = h->data[h->size--];\n    while (2 * k <= h->size) {\n        int c = 2 * k;\n        if (c + 1 <= h->size && h->data[c + 1] > h->data[c]) c++;\n        if (h->data[k] >= h->data[c]) break;\n        { int t = h->data[k]; h->data[k] = h->data[c]; h->data[c] = t; }\n        k = c;\n    }\n    return 1;\n}\n\nvoid heap_print(const char *tag, const MaxHeap *h) {\n    int i;\n    printf(\"%s\", tag);\n    for (i = 1; i <= h->size; i++) printf(\"%d%s\", h->data[i], i < h->size ? \" \" : \"\\n\");\n}\n\nvoid heap_sort(int *a, int n) {             /* 升序：大根堆 + 反复取堆顶 */\n    MaxHeap h;\n    int i;\n    heap_init(&h, a, n);\n    for (i = n - 1; i >= 1; i--) {\n        int t = h.data[1]; h.data[1] = h.data[h.size]; h.data[h.size] = t;  /* 堆顶归位到末尾 */\n        h.size--;\n        {\n            int k = 1;\n            while (2 * k <= h.size) {\n                int c = 2 * k;\n                if (c + 1 <= h.size && h.data[c + 1] > h.data[c]) c++;\n                if (h.data[k] >= h.data[c]) break;\n                { int tt = h.data[k]; h.data[k] = h.data[c]; h.data[c] = tt; }\n                k = c;\n            }\n        }\n    }\n    for (i = 0; i < n; i++) a[i] = h.data[i + 1];\n}\n\nint main(void) {\n    int arr[] = {4, 10, 3, 5, 1, 2};\n    int n = 6, i, out;\n    MaxHeap h;\n\n    heap_init(&h, arr, n);\n    heap_print(\"建堆后（从最后一个非叶结点倒序下沉）：\", &h);\n\n    heap_push(&h, 9);\n    heap_print(\"插入 9 后（末尾放入再上浮）：        \", &h);\n\n    heap_pop(&h, &out);\n    printf(\"弹出堆顶 = %d（最大值先出）\\n\", out);\n    heap_print(\"弹出后（末尾顶替堆顶再下沉）：      \", &h);\n\n    for (i = 0; i < n; i++) heap_push(&h, arr[i]);\n    heap_sort(arr, n);\n    printf(\"堆排序结果（升序）：\");\n    for (i = 0; i < n; i++) printf(\"%d%s\", arr[i], i < n - 1 ? \" \" : \"\\n\");\n    return 0;\n}"
        },
        {
          type: "code",
          lang: "python",
          title: "Python 对照：heapq 式小根堆 + 哈夫曼树构造",
          code: "# 前两段与 C 版本是同一套堆逻辑（这里用 0 起始下标：父 (i-1)//2，左 2i+1，右 2i+2）\n# 第三段用堆实现哈夫曼树构造，这是优先队列最经典的应用\n\n\ndef heapify(a):\n    \"\"\"建堆：从最后一个非叶结点倒序下沉，总代价 O(n)\"\"\"\n    n = len(a)\n    for i in range(n // 2 - 1, -1, -1):\n        sink(a, i, n)\n        return a\n\n\n        def sink(a, i, n):\n            while 2 * i + 1 < n:\n                c = 2 * i + 1                      # 先假设左孩子更大\n                if c + 1 < n and a[c + 1] > a[c]:\n                    c += 1\n                    if a[i] >= a[c]:\n                        break\n                        a[i], a[c] = a[c], a[i]\n                        i = c\n\n\n                        def push(a, x):\n                            \"\"\"插入：末尾放入 + 上浮\"\"\"\n                            a.append(x)\n                            k = len(a) - 1\n                            while k > 0 and a[k] > a[(k - 1) // 2]:\n                                p = (k - 1) // 2\n                                a[k], a[p] = a[p], a[k]\n                                k = p\n\n\n                                def pop(a):\n                                    \"\"\"删除堆顶：末尾元素顶替堆顶，再下沉\"\"\"\n                                    top = a[0]\n                                    last = a.pop()\n                                    if a:\n                                        a[0] = last\n                                        sink(a, 0, len(a))\n                                        return top\n\n\n                                        def heap_sort(a):\n                                            \"\"\"升序：先建大根堆，再反复把堆顶换到末尾\"\"\"\n                                            a = list(a)\n                                            heapify(a)\n                                            for end in range(len(a) - 1, 0, -1):\n                                                a[0], a[end] = a[end], a[0]\n                                                sink(a, 0, end)\n                                                return a\n\n\n                                                arr = [4, 10, 3, 5, 1, 2]\n                                                print(\"建堆后：\", heapify(list(arr)))\n                                                h = heapify(list(arr))\n                                                push(h, 9)\n                                                print(\"插入 9 后：\", h)\n                                                print(\"弹出堆顶 =\", pop(h), \"弹出后：\", h)\n                                                print(\"堆排序结果（升序）：\", heap_sort(arr))\n\n\n                                                # ---------------- 哈夫曼树构造（用最小堆实现优先队列） ----------------\n                                                def huffman(weights, chars):\n                                                    \"\"\"weights 与 chars 一一对应；返回 (WPL, 编码字典, 合并过程)\"\"\"\n                                                    # 这里刻意改用「每次线性找最小的两棵」以与 C 教材写法完全一致，逻辑最清晰；\n                                                    # 工程实现应该把 nodes 放进上面的小根堆，用 pop 两次 + push 一次完成合并。\n                                                    nodes = [[w, ch, None, None] for w, ch in zip(weights, chars)]\n                                                    trace = []\n\n                                                    def weight(node):\n                                                        return node[0]\n\n                                                        while len(nodes) > 1:\n                                                            nodes.sort(key=weight)            # 取权值最小的两棵\n                                                            a, b = nodes[0], nodes[1]\n                                                            merged = [a[0] + b[0], None, a, b]\n                                                            trace.append((a[0], b[0], merged[0]))\n                                                            nodes = nodes[2:] + [merged]\n\n                                                            root = nodes[0]\n                                                            codes = {}\n\n                                                            def walk(node, path):\n                                                                if node[2] is None and node[3] is None:\n                                                                    codes[node[1]] = path or \"0\"    # 只有一个字符时约定码长为 1\n                                                                    return\n                                                                    walk(node[2], path + \"0\")\n                                                                    walk(node[3], path + \"1\")\n\n                                                                    walk(root, \"\")\n                                                                    wpl = sum(weights[i] * len(codes[chars[i]]) for i in range(len(weights)))\n                                                                    return wpl, codes, trace\n\n\n                                                                    ws = [5, 9, 12, 13, 16, 45]\n                                                                    cs = [\"a\", \"b\", \"c\", \"d\", \"e\", \"f\"]\n                                                                    wpl, codes, trace = huffman(ws, cs)\n                                                                    for x, y, s in trace:\n                                                                        print(\"合并权值 %2d 与 %2d -> 新树权值 %2d\" % (x, y, s))\n                                                                        for ch in cs:\n                                                                            print(\"字符 %s（权 %2d）编码为 %s，码长 %d\" % (ch, ws[cs.index(ch)], codes[ch], len(codes[ch])))\n                                                                            print(\"WPL = %d，平均码长 = %.2f 位，定长编码需 3.00 位（6 个字符），总位数节省约 %.0f%%\" % (wpl, wpl / sum(ws), (300 - wpl) * 100.0 / 300))"
        },
        {
          type: "calc",
          title: "手算：建堆过程与哈夫曼编码的 WPL",
          inputs: [
            { name: "建堆数组", value: "[4, 10, 3, 5, 1, 2]，下标 1 起始，大根堆" },
            { name: "哈夫曼权值", value: "5、9、12、13、16、45，对应字符 a、b、c、d、e、f" }
          ],
          outputs: [
            "最后一个非叶结点下标 $= \\lfloor 6/2 \\rfloor = 3$，从结点 3 开始倒序下沉",
            "结点 3（值 3）与其唯一的孩子结点 6（值 3）相等，不交换；结点 2（值 10）大于较大的孩子 5，不交换；只有根结点 1（值 4）小于较大的孩子 10，交换一次 $\\to [10, 5, 3, 4, 1, 2]$",
            "最终大根堆数组为 $[10, 5, 3, 4, 1, 2]$，堆顶 10 是最大值；整个建堆只发生 1 次交换，说明大多数结点无需调整，这正是 $O(n)$ 的直观原因",
            "哈夫曼合并顺序：$5+9=14,\\ 12+13=25,\\ 14+16=30,\\ 25+30=55,\\ 55+45=100$（共 5 次合并，叶子 6 个、结点总数 $6+5 = 11 = 2 \\times 6 - 1$）",
            "码长：a、b、c、d 各 4 位，e 为 3 位，f 为 1 位",
            "$\\text{WPL} = 5 \\times 4 + 9 \\times 4 + 12 \\times 4 + 13 \\times 4 + 16 \\times 3 + 45 \\times 1 = 20+36+48+52+48+45 = 224$",
            "定长编码需 3 位（6 个字符），总位数 $= 100 \\times 3 = 300$；哈夫曼编码总位数 224，节省 76 位，压缩率约 25%"
          ],
          note: "WPL 的另一种算法：每次合并新产生的结点权值之和就是 WPL，即 $14+25+30+55+100 = 224$，两条路必须算出同一个数。"
        },
        {
          type: "interactive",
          lab: "datalab",
          title: "单步看建堆下沉与哈夫曼合并（WPL 累加）",
          config: {
            state: { 实验: "建堆", 数组: "4 10 3 5 1 2", 当前结点: "-", 比较与动作: "准备从最后一个非叶结点 3 开始", 交换次数: 0, WPL累加: 0 },
            steps: [
              { desc: "【实验 A-1】建堆：确认最后一个非叶结点下标为 $\\lfloor 6/2 \\rfloor = 3$，从它开始倒序下沉", state: { 实验: "建堆", 数组: "4 10 3 5 1 2", 当前结点: 3, 比较与动作: "读取结点 3 的值 3 与孩子结点 6 的值 3", 交换次数: 0, WPL累加: 0 }, note: "倒序下沉是建堆 $O(n)$ 的关键：越靠下的结点越多，但它们的下沉距离越短。" },
              { desc: "【实验 A-2】结点 3 与孩子相等，不做交换，下沉立即结束", state: { 实验: "建堆", 数组: "4 10 3 5 1 2", 当前结点: 3, 比较与动作: "3 == 3，不小于，停止下沉", 交换次数: 0, WPL累加: 0 }, note: "只有孩子严格大于父结点时才交换；相等不交换，这保证了下沉一定能在有限步内终止。" },
              { desc: "【实验 A-3】下沉到结点 2（值 10）：10 大于较大的孩子 5，不交换", state: { 实验: "建堆", 数组: "4 10 3 5 1 2", 当前结点: 2, 比较与动作: "10 > 5，停止下沉", 交换次数: 0, WPL累加: 0 }, note: "结点 2 的两个孩子是下标 4（值 5）与下标 5（值 1），较大者是 5；父结点比它还大，无需交换。" },
              { desc: "【实验 A-4】下沉到根结点 1（值 4）：4 小于较大的孩子 10，交换一次", state: { 实验: "建堆", 数组: "10 5 3 4 1 2", 当前结点: 1, 比较与动作: "4 < 10，交换；4 移到下标 4 后已是叶子，下沉结束", 交换次数: 1, WPL累加: 0 }, note: "下沉必须选较大的孩子交换，否则另一个孩子仍可能大于新父结点，堆序会被破坏。" },
              { desc: "【实验 A-5】建堆完成：数组 10 5 3 4 1 2，堆顶 10 为最大值", state: { 实验: "建堆", 数组: "10 5 3 4 1 2", 当前结点: "完成", 比较与动作: "所有父子对都满足父结点不小于孩子", 交换次数: 1, WPL累加: 0 }, note: "整个建堆只交换了 1 次，多数结点根本不需要调整，这就是建堆为 $O(n)$ 而逐个插入要 $O(n \\log n)$ 的直观原因。" },
              { desc: "【实验 B-1】哈夫曼：权值集合 5、9、12、13、16、45，先合并最小的 5 与 9", state: { 实验: "哈夫曼合并", 数组: "14 12 13 16 45", 当前结点: "-", 比较与动作: "合并 5+9=14", 交换次数: 2, WPL累加: 14 }, note: "新树权值 14 放回集合；每合并一次，两棵子树的所有叶子深度都加 1，代价恰好是权值之和。" },
              { desc: "【实验 B-2】再合并 12 与 13，得到新树 25", state: { 实验: "哈夫曼合并", 数组: "25 14 16 45", 当前结点: "-", 比较与动作: "合并 12+13=25", 交换次数: 2, WPL累加: 39 }, note: "WPL 累加到 $14+25=39$，它等于所有叶子「权值×深度」之和，两种算法必须一致。" },
              { desc: "【实验 B-3】合并 14 与 16，得到新树 30", state: { 实验: "哈夫曼合并", 数组: "30 25 45", 当前结点: "-", 比较与动作: "合并 14+16=30", 交换次数: 2, WPL累加: 69 }, note: "此时 16（字符 e）的深度确定为 3，权值较大的它比 a、b、c、d 更靠近根。" },
              { desc: "【实验 B-4】合并 25 与 30，得到新树 55", state: { 实验: "哈夫曼合并", 数组: "55 45", 当前结点: "-", 比较与动作: "合并 25+30=55", 交换次数: 2, WPL累加: 124 }, note: "只剩下两棵树，最后一次合并即将完成整棵哈夫曼树。" },
              { desc: "【实验 B-5】最后合并 55 与 45，得到根 100，WPL 累加到 224", state: { 实验: "哈夫曼合并", 数组: "100", 当前结点: "-", 比较与动作: "合并 55+45=100，构造结束", 交换次数: 2, WPL累加: 224 }, note: "最大的权值 45（字符 f）深度为 1，码长最短，这就是哈夫曼的贪心直觉。" },
              { desc: "【实验 B-6】校验：码长 a=4、b=4、c=4、d=4、e=3、f=1", state: { 实验: "校验", 数组: "100", 当前结点: "-", 比较与动作: "5*4+9*4+12*4+13*4+16*3+45*1 = 224", 交换次数: 2, WPL累加: 224 }, note: "定长编码要 $3 \\times 100 = 300$ 位，哈夫曼只用了 224 位，省下约 25%，这就是文件压缩的原理。" }
            ],
            tasks: [
              { t: "把建堆数组换成 [3, 1, 2, 1, 5, 4]，手算倒序下沉的每一步，写出最终大根堆数组。", hint: "仍从 $\\lfloor 6/2 \\rfloor = 3$ 开始。", check: "能得到一个满足「父结点不小于两个孩子」的数组，并说明每次比较发生在哪一对父子之间。" },
              { t: "给权值序列 5、9、12、13、16、45 写出一种具体的 0/1 编码方案，并验证它满足前缀性质。", hint: "从根出发，左 0 右 1。", check: "能给出 6 个编码且任意两个互不为前缀，并算出总位数 224。" }
            ]
          }
        },
        {
          type: "pitfall",
          title: "堆与哈夫曼的易错点",
          items: [
            "把建堆的复杂度记成 $O(n \\log n)$：那是「逐个插入」的代价。倒序下沉建堆是 $O(n)$，因为多数结点在底层、下沉距离极短。",
            "以为小根堆排序得到升序：小根堆每次弹出的是最小值，放到末尾会得到降序；要升序必须建**大根堆**，把最大值依次换到末尾。",
            "删除堆顶时先删再调整：必须先用**末尾元素顶替堆顶**再下沉，直接删除会破坏完全二叉树的结构性质，数组出现空洞。",
            "下沉时与较小的孩子交换：应始终与较大（大根堆）或较小（小根堆）的那个孩子交换，否则另一个孩子可能违反堆序。",
            "把 WPL 定义成「结点权值 × 深度」对所有结点求和：只对**叶子结点**求和。另一个等价算法是「每次合并产生的新结点权值之和」，两者结果相同，但别把中间结点重复计入。",
            "忽略哈夫曼编码的前缀性质而直接按深度编码：若两个字符码长相同且其中一个是另一个的前缀，解码就会有歧义，压缩文件将无法还原。"
          ]
        },
        {
          type: "lab",
          title: "上机任务：把堆与哈夫曼做成小工具",
          steps: [
            "实现大根堆与小根堆各一套（上浮、下沉、插入、删除堆顶），并用随机数据做「不变量断言」：每次操作后检查所有父子对是否满足堆序。",
            "分别用「逐个插入」与「倒序下沉」对 n=100000 的随机数组建堆，各计时 3 次取中位数，验证后者更接近 $O(n)$ 而前者约慢一个数量级。",
            "实现堆排序并对 n=100000 随机数据与快速排序对比耗时，说明为什么堆排序缓存局部性更差（每次访问 $2i$ 与 $2i+1$ 跨度大，跳着访问内存）。",
            "实现哈夫曼编码的「压缩 - 解压」闭环：对一段中文文本统计字符频率、构造哈夫曼树、输出编码表、把原文转成 01 串，再从 01 串解回原文，比较压缩前后位数。"
          ],
          note: "自测标准：解压结果必须与原文逐字节相同；若不同，先检查编码表是否满足前缀性质。"
        }
      ],
      quiz: [
        {
          id: "ds-heap-huffman-q1",
          type: "single",
          q: "关于对 n 个元素建堆的时间复杂度，下列说法正确的是？",
          options: [
            "从最后一个非叶结点开始倒序下沉建堆是 $O(n)$，因为越靠底层的结点越多、而它们下沉的最大距离越短",
            "建堆必须对 n 个结点各做一次 $O(\\log n)$ 的下沉，所以是 $O(n \\log n)$",
            "建堆是 $O(\\log n)$，因为只需要沿着一条从根到叶的路径调整",
            "建堆是 $O(n^2)$，因为每次下沉都可能交换 $O(n)$ 次"
          ],
          answer: 0,
          why: "倒序下沉的总代价是 sum(结点数 × 该高度结点的最大下沉层数)，级数 $\\frac{n}{4} \\cdot 1 + \\frac{n}{8} \\cdot 2 + \\frac{n}{16} \\cdot 3 + \\cdots$ 收敛到 $O(n)$，所以 A 对。B 描述的是「逐个插入建堆」的代价，那是 $O(n \\log n)$，不是倒序下沉建堆。C 混淆了建堆与单次插入或查找。D 错在把「一次下沉最多走树高 log n 层」错记成 n 层，下沉每走一层都必须在父子间移动，不可能交换 $O(n)$ 次。"
        },
        {
          id: "ds-heap-huffman-q2",
          type: "fill",
          q: "给定权值集合 $\\{5, 9, 12, 13, 16, 45\\}$ 构造哈夫曼树，其带权路径长度 WPL = ____（填整数）。",
          answer: ["224", "224位", "224 位"],
          why: "合并过程为 $5+9=14,\\ 12+13=25,\\ 14+16=30,\\ 25+30=55,\\ 55+45=100$。各叶子深度为：45 是 1，16 是 3，5、9、12、13 是 4，于是 $\\text{WPL} = 45 \\times 1 + 16 \\times 3 + (5+9+12+13) \\times 4 = 45 + 48 + 156 = 224$。等价算法：把所有合并产生的新结点权值相加，$14+25+30+55+100 = 224$。常见错误是把中间结点也按「权值×深度」计入，或漏掉某次合并导致少算 14 或 25。"
        },
        {
          id: "ds-heap-huffman-q3",
          type: "single",
          q: "关于哈夫曼编码，下列说法正确的是？",
          options: [
            "它是一种前缀码：任何一个字符的编码都不是另一个字符编码的前缀，因此解码时不会产生歧义",
            "为了让总长度最短，应当给出现频率最高的字符分配最长的编码",
            "哈夫曼树的每个非叶结点都至少有一个孩子为空，因此树中存在度为 1 的结点",
            "只要权值集合相同，构造出的哈夫曼树形状就是唯一的，因此每个字符的编码也唯一确定"
          ],
          answer: 0,
          why: "A 是哈夫曼编码能用于压缩与解码的根本前提。B 说反了：频率越高码越短才能降低总位数，哈夫曼树把最小权值压在最深处。C 错：每次都是两棵树合并，所有非叶结点都有两个孩子，哈夫曼树**不存在度为 1 的结点**。D 错：权值相同或合并顺序不同的选择会得到形状不同的哈夫曼树（虽然 WPL 同为最小），所以编码方案可能不唯一，但 WPL 唯一。"
        },
        {
          id: "ds-heap-huffman-q4",
          type: "order",
          q: "把「对数组 $[4, 10, 3, 5, 1, 2]$ 用倒序下沉法建大根堆」的步骤排成正确顺序。",
          items: [
            "确定最后一个非叶结点下标为 $\\lfloor 6/2 \\rfloor = 3$",
            "对结点 3 执行下沉：与它的孩子比较，必要时交换",
            "对结点 2 执行下沉：与它的孩子比较，必要时交换",
            "对结点 1（根）执行下沉：与较大的孩子交换并继续向下调整",
            "检查所有父子对都满足「父结点不小于孩子」，建堆完成"
          ],
          answer: [0, 1, 2, 3, 4],
          why: "必须从最后一个非叶结点开始**倒序**向根调整，这样才能保证每次下沉时它的左右子树已经是合法堆（子树都调整过了）。若从根开始往下调整，根调整完后其子树内部仍可能违反堆序，需要反复重做；若把顺序写反（从根到叶），代价会退化。最后一步的不变量检查是判断建堆是否正确的标准。"
        }
      ]
    },
    {
      id: "ds-graph-hash",
      title: "图与哈希表：从遍历到最短路径，从散列到冲突处理",
      goal: "学完后你能为不同稠密程度的图选择邻接矩阵或邻接表，能写出 DFS/BFS 的遍历序列，能说明 Prim 与 Kruskal、Dijkstra 与 Floyd 的适用条件，能手算线性探测与链地址法的平均查找长度 ASL。",
      est: 55,
      blocks: [
        {
          type: "concept",
          title: "图的存储：邻接矩阵（adjacency matrix）与邻接表（adjacency list）",
          md: "图（graph）由顶点集 $V$ 与边集 $E$ 组成，分有向图与无向图、带权图与无权图。两种主流存储各有明确的取舍：\n\n**邻接矩阵**：用 $n \\times n$ 的二维数组 $A$ 表示，$A[i][j] = 1$（或权值）表示存在边 $i \\to j$，不存在则记 0 或无穷大。\n\n- 空间 $O(n^2)$，与边数无关——**稠密图（dense graph）** 才划算。\n- 判断任意两点是否相邻是 $O(1)$，无敌。\n- 求某顶点的度：无向图数一行即可 $O(n)$；有向图出度是行和、入度是列和。\n- 缺点：稀疏图（sparse graph）极度浪费空间。10000 个顶点、50000 条边的稀疏图，矩阵要 $10^8$ 个单元，而邻接表只要 50000 个边结点。\n\n**邻接表**：每个顶点挂一个单链表，存它的所有邻接点。\n\n- 空间 $O(n + e)$，**稀疏图** 首选。\n- 找某顶点的所有邻居非常快，正好是 DFS、BFS、Prim 这类「需要枚举邻居」的算法要的。\n- 缺点：判断两点是否相邻要遍历链表，最坏 $O(n)$；求有向图的入度需要遍历整张表（除非额外建**逆邻接表**）。\n\n还有两个 408 会考的进阶结构：**十字链表（orthogonal list）** 用于有向图，每个顶点同时挂出边表与入边表，把出度与入度的查询都变成 $O(1)$ 级别；**邻接多重表（adjacency multilist）** 用于无向图，每条边只存一个结点，被两个顶点共享，删除边与遍历边都很方便。\n\n选择口诀：**看 $n^2$ 与 $n+e$ 谁小，也看主要操作是「判断相邻」还是「枚举邻居」**。"
        },
        {
          type: "concept",
          title: "DFS 与 BFS：同一个图，两种遍历序列",
          md: "**深度优先搜索（DFS，depth-first search）**：从起点出发，一路往深处走，走不动就回退到最近的分叉点换一条路。它天然对应**栈**（或递归），路径特征是一条纵深链。\n\n**广度优先搜索（BFS，breadth-first search）**：从起点出发，先访问所有距离为 1 的点，再访问距离为 2 的点，逐层扩散。它必须用**队列**，否则无法保证「按距离递增的顺序访问」。\n\n两者的关键差异：\n\n1. **辅助结构**：DFS 用栈（或递归的系统栈），BFS 用队列。这个区别不是风格问题，而是由「下一个该处理谁」直接决定的（栈取最近发现的，队列取最早发现的）。\n2. **遍历序列不唯一**：邻接表中邻居的存储顺序不同、或起始顶点不同，都会得到不同的遍历序列。所以 408 题目一定会给出「按编号递增访问邻接点」这类约定，做题时必须遵守。\n3. **BFS 的附加价值**：在**无权图**上，BFS 首次到达某点的层数就是最短路径长度（边数最少），同时可以顺便求出「最短路径树」的前驱数组。DFS 没有这个性质。\n4. **复杂度相同**：用邻接表是 $O(n+e)$，用邻接矩阵是 $O(n^2)$，因为矩阵要扫描整行才能找到邻居。\n\n一个重要用途：**连通分量**。对未访问顶点反复调用 DFS（或 BFS），调用次数就是连通分量个数；有向图则区分强连通分量。"
        },
        {
          type: "concept",
          title: "最小生成树（MST）：Prim 与 Kruskal 的两种贪心",
          md: "生成树是连通图的极小连通子图：含全部 $n$ 个顶点、恰好 $n-1$ 条边、无回路。**最小生成树（minimum spanning tree）** 是边权之和最小的那棵。\n\n它由两条贪心性质保证正确（Cut Property 与 Cycle Property）：任意切分把顶点分成两部分，横跨切分的最小边一定属于某棵 MST；任意回路中权值最大的边一定不属于任何 MST。\n\n**Prim 算法**（加点法）：从任一顶点开始，每次把「距离当前树最近的树外顶点」加入树。\n\n- 复杂度 $O(n^2)$，与边数无关，**适合稠密图**（$e$ 接近 $n^2$）。\n- 结构上与 Dijkstra 极像，区别只在更新时比较的是「到树的距离」而不是「到起点的累计距离」。\n\n**Kruskal 算法**（加边法）：把所有边按权值升序排序，依次取边，若两端点已在同一连通块就丢弃，否则加入。\n\n- 复杂度 $O(e \\log e)$，主要由排序决定，**适合稀疏图**。\n- 判环需要**并查集（union-find）**，路径压缩 + 按秩合并后接近 $O(1)$。\n\n两者的相同结论：MST 的边权之和唯一；但 MST 本身可能不唯一（存在相等权值的边时）。若图中所有边权互不相同，则 MST 唯一。"
        },
        {
          type: "concept",
          title: "最短路径：Dijkstra 与 Floyd 的思想与边界",
          md: "**Dijkstra**（单源最短路，贪心）：维护一个距离数组 dist，每轮从未确定的顶点中选出 dist 最小的那个「确定」它，再用它去**松弛（relax）** 邻居：若 $\\text{dist}[u] + w(u,v) < \\text{dist}[v]$ 就更新 dist[v]。\n\n- 复杂度：朴素实现 $O(n^2)$（适合稠密图）；用优先队列（堆）优化到 $O(e \\log n)$（适合稀疏图）。\n- **致命限制：不能处理负权边**。原因是贪心前提「已确定的顶点距离不会再变小」依赖「任何绕路都不会更短」，而负权边恰好能让绕路更短。举反例：$A \\to B$ 权 2、$A \\to C$ 权 5、$C \\to B$ 权 $-4$，Dijkstra 先确定 B 的距离为 2，之后才发现经 C 可以到 1，但 B 已出局。\n\n**Floyd**（多源最短路，动态规划）：用三重循环，以每个顶点 k 作为中转点，尝试更新所有点对：若 $\\text{dist}[i][k] + \\text{dist}[k][j] < \\text{dist}[i][j]$ 就更新。\n\n- 复杂度 $O(n^3)$，空间 $O(n^2)$，代码只有五行。\n- 允许**负权边**（但不能有负权回路，否则最短路径无意义）；因为它是 DP 而不是贪心，会考虑所有中转组合。\n- 一次运行得到任意两点间的最短距离，**适合稠密图或多源查询**。\n\n另外两个常考对比：**BFS 只能求无权图的最短路**（层数即边数），带权图必须用 Dijkstra 或 Floyd；**A* 与 Bellman-Ford** 属于进阶内容，Bellman-Ford 可以做 $n-1$ 轮松弛从而支持负权并检测负环。"
        },
        {
          type: "concept",
          title: "哈希表（hash table）：用空间换 O(1)",
          md: "前面所有结构都靠**比较**定位元素，因此查找下界是 $O(\\log n)$。哈希表换了一条路：**用哈希函数（hash function）把关键字直接映射到存储位置**，理想情况下一次计算就能定位，平均查找 $O(1)$。\n\n一个好的哈希函数要满足：计算快；地址分布均匀（减少冲突）；值域落在表长范围内。常见构造法：\n\n- **除留余数法**：$H(\\text{key}) = \\text{key} \\bmod p$。p 通常取**不超过表长的最大素数**（如 13、17、19），因为合数会让关键字中共同的因子暴露出来，造成分布不均。\n- **直接定址法**：$H(\\text{key}) = a \\times \\text{key} + b$，无冲突但要求关键字连续。\n- **数字分析法 / 平方取中法 / 折叠法**：用于关键字位数多、分布有规律的场合。\n\n**冲突（collision）** 是不可避免的：关键字空间远大于表长，由抽屉原理必有多个关键字映射到同一地址。两种主流处理方式：\n\n1. **开放定址法（open addressing）**：冲突了就按探测序列找下一个空位，所有元素都存在表内。\n   - 线性探测：依次试 $(H+1)$、$(H+2)$…… 简单但会产生**堆积（clustering）**，冲突连成一片，查找长度迅速上升。\n   - 二次探测：探测序列改为 $H+1,\\ H-1,\\ H+4,\\ H-4,\\ \\ldots$ 缓解堆积，但可能探测不到表中某些空位。\n   - 再哈希法：准备第二个哈希函数，冲突时用它算出新的步长（如 $H_2(\\text{key}) = 7 - \\text{key} \\bmod 7$），能进一步打散。\n   - 删除元素时**不能直接置空**，必须打「删除标记」（墓碑），否则会截断后续同义词的探测链，导致查找失败。\n2. **链地址法（separate chaining，拉链法）**：每个槽位挂一个链表，冲突的元素都挂在同一条链上。装填因子可以大于 1，删除简单，代价是要额外指针空间、缓存不友好。\n\n**装填因子（load factor）** $\\alpha = \\frac{n}{m}$，其中 $n$ 是表中元素个数、$m$ 是表长。它直接决定性能：\n\n- 线性探测的成功 ASL 约为 $\\frac{1}{2}\\left(1 + \\frac{1}{1-\\alpha}\\right)$，不成功约为 $\\frac{1}{2}\\left(1 + \\frac{1}{(1-\\alpha)^2}\\right)$——$\\alpha$ 接近 1 时急剧恶化。\n- 链地址法成功 ASL 约为 $1 + \\frac{\\alpha}{2}$，对 $\\alpha$ 的敏感度低得多，所以链地址法允许更高的装填因子。\n\n当 α 超过阈值（常见 0.75）时应当**再哈希（rehash）**：申请一个更大的表（通常是原表长的 2 倍附近的素数），把所有元素重新插入。这一步是 $O(n)$ 的，但和动态数组扩容一样，均摊下来每次插入仍是 $O(1)$。"
        },
        {
          type: "code",
          lang: "c",
          title: "邻接矩阵建图 + DFS/BFS 遍历（完整可编译）",
          code: "#include <stdio.h>\n#include <string.h>\n\n#define MAXV 64\n\n/* 约定：顶点编号 1..n；访问邻居时按编号从小到大，保证遍历序列可复现 */\nstatic int g[MAXV][MAXV];\nstatic int visited[MAXV];\nstatic int n, e;\n\nvoid graph_init(int vn) {\n    int i, j;\n    n = vn;\n    e = 0;\n    for (i = 1; i <= n; i++)\n        for (j = 1; j <= n; j++) g[i][j] = 0;\n}\n\nvoid add_edge(int u, int v) {          /* 无向图：两个方向都置 1 */\n    g[u][v] = 1;\n    g[v][u] = 1;\n    e++;\n}\n\nvoid dfs(int u) {                      /* 深度优先：递归即系统栈 */\n    int v;\n    printf(\"%d \", u);\n    visited[u] = 1;\n    for (v = 1; v <= n; v++)\n        if (g[u][v] && !visited[v]) dfs(v);\n}\n\nvoid bfs(int start) {                  /* 广度优先：显式队列 */\n    int queue[MAXV], front = 0, rear = 0, v;\n    queue[rear++] = start;\n    visited[start] = 1;\n    while (front < rear) {\n        int u = queue[front++];\n        printf(\"%d \", u);\n        for (v = 1; v <= n; v++)\n            if (g[u][v] && !visited[v]) {\n                visited[v] = 1;\n                queue[rear++] = v;      /* 入队时就标记，避免同一顶点重复入队 */\n            }\n    }\n}\n\nint main(void) {\n    int dfs_seq[8] = {1, 2, 3, 6, 8, 7, 5, 4};   /* 程序算出的 DFS 序列（邻居按编号递增） */\n    int bfs_seq[8] = {1, 2, 3, 5, 6, 7, 8, 4};   /* 程序算出的 BFS 序列 */\n    int i;\n    graph_init(8);\n    add_edge(1, 2); add_edge(1, 3); add_edge(2, 3); add_edge(2, 5);\n    add_edge(3, 6); add_edge(3, 7); add_edge(6, 8);\n\n    printf(\"顶点数 %d，边数 %d\\n\", n, e);\n\n    memset(visited, 0, sizeof(visited));\n    printf(\"DFS from 1：\");\n    dfs(1);\n    printf(\"\\n期望序列    ：\");\n    for (i = 0; i < 8; i++) printf(\"%d \", dfs_seq[i]);\n    printf(\"\\n\");\n\n    memset(visited, 0, sizeof(visited));\n    printf(\"BFS from 1：\");\n    bfs(1);\n    printf(\"\\n期望序列    ：\");\n    for (i = 0; i < 8; i++) printf(\"%d \", bfs_seq[i]);\n    printf(\"\\n\");\n\n    {\n        int comp = 0;\n        memset(visited, 0, sizeof(visited));\n        for (i = 1; i <= n; i++)\n            if (!visited[i]) { comp++; dfs(i); }\n        printf(\"连通分量个数 = %d（本图为连通图，故为 1）\\n\", comp);\n    }\n    return 0;\n}"
        },
        {
          type: "code",
          lang: "python",
          title: "Python 对照：邻接表 + BFS/Dijkstra + 线性探测哈希表",
          code: "# 与 C 版本对应：同一张图、同样的遍历序列；哈希表用同一组经典数据\nimport heapq\n\n\ndef build_graph():\n    \"\"\"邻接表：字典的键是顶点，值是按编号升序排列的邻居列表\"\"\"\n    edges = [(1, 2), (1, 3), (2, 3), (2, 5), (3, 6), (3, 7), (6, 8)]\n    adj = {i: [] for i in range(1, 9)}\n    for u, v in edges:\n        adj[u].append(v)\n        adj[v].append(u)\n        for u in adj:\n            adj[u].sort()\n            return adj\n\n\n            def dfs(adj, start):\n                seen, order, stack = set(), [], [start]\n                while stack:\n                    u = stack.pop()\n                    if u in seen:\n                        continue\n                        seen.add(u)\n                        order.append(u)\n                        for v in reversed(adj[u]):        # 逆序入栈，保证弹出时按编号递增\n                            if v not in seen:\n                                stack.append(v)\n                                return order\n\n\n                                def bfs(adj, start):\n                                    # 这里的队列不加任何库：用 list 存 + head 下标出队，行为与真正的队列完全一致\n                                    seen, order, q, head = {start}, [], [start], 0\n                                    while head < len(q):\n                                        u = q[head]\n                                        head += 1\n                                        order.append(u)\n                                        for v in adj[u]:\n                                            if v not in seen:\n                                                seen.add(v)\n                                                q.append(v)\n                                                return order\n\n\n                                                adj = build_graph()\n                                                print(\"邻接表：\", adj)\n                                                print(\"DFS from 1：\", dfs(adj, 1))\n                                                print(\"BFS from 1：\", bfs(adj, 1))\n\n\n                                                # ---------------- 带权图上的 Dijkstra（负权边会失效，这里只用正权） ----------------\n                                                def dijkstra(adjw, src):\n                                                    INF = float(\"inf\")\n                                                    dist = {v: INF for v in adjw}\n                                                    prev = {v: None for v in adjw}\n                                                    dist[src] = 0\n                                                    pq = [(0, src)]\n                                                    while pq:\n                                                        d, u = heapq.heappop(pq)\n                                                        if d > dist[u]:\n                                                            continue                    # 过期条目，跳过\n                                                            for v, w in adjw[u]:\n                                                                if d + w < dist[v]:         # 松弛\n                                                                    dist[v] = d + w\n                                                                    prev[v] = u\n                                                                    heapq.heappush(pq, (dist[v], v))\n                                                                    return dist, prev\n\n\n                                                                    adjw = {\n                                                                        \"A\": [(\"B\", 2), (\"C\", 5)],\n                                                                        \"B\": [(\"A\", 2), (\"C\", 2), (\"D\", 9)],\n                                                                        \"C\": [(\"A\", 5), (\"B\", 2), (\"D\", 2)],\n                                                                        \"D\": [(\"B\", 9), (\"C\", 2), (\"E\", 3)],\n                                                                        \"E\": [(\"D\", 3)],\n                                                                        }\n                                                                    dist, prev = dijkstra(adjw, \"A\")\n                                                                    print(\"从 A 出发的最短距离：\", dist)\n                                                                    print(\"A 到 E 的路径长度：\", dist[\"E\"], \"，前驱链：E <-\", prev[\"E\"])\n\n\n                                                                    # ---------------- 哈希表：线性探测法的插入与 ASL 统计 ----------------\n                                                                    def hash_linear(keys, size=11, show=True):\n                                                                        \"\"\"H(key) = key mod size，冲突时线性探测 H+1、H+2 ……\n\n                                                                        注意：同一组关键字若插入顺序不同，各元素的探测次数会变化，ASL 也随之变化。\n                                                                        这里严格按 408 经典例题的顺序 22、41、53、46、30、13、1、67 依次插入。\n                                                                        \"\"\"\n                                                                        table = [None] * size\n                                                                        probes = {}\n                                                                        for k in keys:\n                                                                            idx = k % size\n                                                                            # 探测次数 = 实际访问过的地址个数，含最后一次确认空位的访问，\n                                                                            # 这与「成功查找长度 = 比较次数」的口径完全一致（教材口径）。\n                                                                            cnt = 0\n                                                                            while True:                      # 至少访问一次初始地址\n                                                                                cnt += 1\n                                                                                if table[idx] is None:\n                                                                                    break\n                                                                                    idx = (idx + 1) % size\n                                                                                    table[idx] = k\n                                                                                    probes[k] = cnt\n                                                                                    if show:\n                                                                                        for k in keys:\n                                                                                            print(f\"key={k:2d}  H(key)={k % size:2d}  探测 {probes[k]} 次\")\n                                                                                            print(\"成功查找总次数 = %d，ASL成功 = %.2f\" % (sum(probes.values()),\n                                                                                                sum(probes.values()) / len(keys)))\n                                                                                            return table, probes\n\n\n                                                                                            # 插入顺序很关键：下面这组顺序得到的探测次数是 1、1、1、1、3、2、1、4，总计 14，ASL成功 = 14/8 = 1.75。\n                                                                                            # 其中的 30 落在 10 号位置（探测 3 次），13 落在 3 号位置（探测 2 次），67 落在 5 号位置（探测 4 次）。\n                                                                                            # 若把 30 与 13 的插入顺序对调，探测次数分布会变成 1、1、1、1、3、3、1、5，总计 16，ASL = 2.0。\n                                                                                            # 结论：开放定址法的 ASL 与插入顺序有关，做题必须严格按题目给定的顺序逐步模拟。\n                                                                                            keys = [22, 41, 53, 46, 30, 13, 1, 67]\n                                                                                            table, probes = hash_linear(keys)\n                                                                                            print(\"插入顺序：\", keys)\n                                                                                            print(\"各关键字探测次数：\", [probes[k] for k in keys])\n                                                                                            print(\"最终表：\", table)\n                                                                                            print(\"逐个核对：30 的 H=8 被 41 占住，再探测 9 号又被 53 占住，落到 10 号位置（探测 3 次）；\")\n                                                                                            print(\"13 的 H=2 被 46 占住，落到 3 号位置（探测 2 次）；67 的 H=1 被 1 占住，沿 2、3 连续被 46、13 占住，最后落到 4 号位置（探测 4 次）。\")\n                                                                                            print(\"填入 8 个元素后装填因子 = 8/11 ≈ 0.73，再继续插入就该 rehash 到更大的素数表了。\")\n                                                                                            print(\"结果校验：总探测次数 = 14，ASL成功 = 14/8 = 1.75；交换 30 与 13 的插入顺序就会变成 16/8 = 2.0。\")"
        },
        {
          type: "calc",
          title: "手算：线性探测哈希表的 ASL",
          inputs: [
            { name: "哈希函数", value: "$H(\\text{key}) = \\text{key} \\bmod 11$，表长 $m = 11$，冲突用线性探测 $H+1$、$H+2$……" },
            { name: "关键字序列", value: "22、41、53、46、30、13、1、67" }
          ],
          outputs: [
            "$22 \\bmod 11 = 0$，位置 0 空，探测 1 次",
            "$41 \\bmod 11 = 8$，位置 8 空，探测 1 次",
            "$53 \\bmod 11 = 9$，位置 9 空，探测 1 次",
            "$46 \\bmod 11 = 2$，位置 2 空，探测 1 次",
            "$30 \\bmod 11 = 8$，冲突，探测 9 也被 53 占，落到位置 10，探测 3 次",
            "$13 \\bmod 11 = 2$，位置 2 被 46 占，再访问位置 3 为空，共访问 2 个地址，探测 2 次",
            "$1 \\bmod 11 = 1$，位置 1 空，探测 1 次",
            "$67 \\bmod 11 = 1$，访问 1、2、3 均被占（分别被 1、46、13 占用），第 4 次访问位置 4 为空，共访问 4 个地址，探测 4 次",
            "成功查找 $\\text{ASL} = \\frac{1+1+1+1+3+2+1+4}{8} = \\frac{14}{8} = 1.75$",
            "不成功查找 $\\text{ASL} = \\frac{3+2+1+8+7+6+5+4+3+2+1}{11} = \\frac{42}{11} \\approx 3.82$（该值只由最终表形态决定，与插入顺序无关）"
          ],
          note: "注意 67 需要探测 4 次（依次访问 1、2、3、4 号地址），而 13 只需 2 次；开放定址法的 ASL 既取决于哈希函数也取决于插入顺序，必须逐步模拟。若把 30 与 13 的插入顺序对调，总探测次数会变成 16、ASL 变成 2.0；本例 $\\text{ASL} = \\frac{14}{8} = 1.75$。"
        },
        {
          type: "interactive",
          lab: "pathlab",
          title: "带权图上对比 BFS 与 Dijkstra",
          config: {
            grid: [
              [1, 5, 5, 1, 1],
              [1, 9, 2, 2, 1],
              [1, 9, 5, 5, 0],
              [1, 1, 9, 9, 1],
              [0, 1, 1, 0, 1]
            ],
            start: [1, 4],
            end: [4, 1],
            algo: "dijkstra",
            legend: "把网格当带权图看：每格的数字就是经过它的代价，0 表示不可通行。本图是一个 5 顶点带权图在网格上的展开：A 在 (1,4) 是起点，B 在 (1,0)，C 在 (2,2)，D 在 (3,1)，E 在 (4,1) 是终点，边权对应教材例子 A-B 为 2、A-C 为 5、B-C 为 2、B-D 为 9、C-D 为 2、D-E 为 3。切换 bfs 与 dijkstra 对比：BFS 只按步数（每步代价都算 1）向外扩散，选出的路线经过额外的 9，总代价明显更高；Dijkstra 按实际权值松弛，选出的路线代价更小。这就是「带权图上不能用 BFS 求最短路」的直观证据。"
          },
          tasks: [
            { t: "先用 bfs 运行一次，记录它给出的路径与总代价；再切到 dijkstra 记录同样两项，说明为什么带权图上 BFS 的答案会更差。", hint: "BFS 把每格的代价都当成 1，只看步数。", check: "能指出 BFS 的判据是步数最少而不是代价最小，并给出两条路径的代价差额。" },
            { t: "在 dijkstra 模式下逐格观察距离数组的变化，说出第一次被「确定」的格子与最后被确定的格子分别是哪个。", hint: "每次确定当前距离最小的未确定格。", check: "能描述松弛过程：某个格子的距离在发现更短路径后被更新了至少一次。" },
            { t: "在 dijkstra 模式下逐格观察距离数组的变化，说出第一次被「确定」的格子与最后被确定的格子分别是哪个，并找出至少一次「松弛成功」的例子。", hint: "每次确定当前距离最小的未确定格。", check: "能描述松弛过程：某个格子的距离在发现更短路径后被更新了至少一次。" },
          ]
        },
        {
          type: "calc",
          title: "手算：图的遍历序列与 Dijkstra 距离",
          inputs: [
            { name: "图（8 个顶点）", value: "边集 {1-2, 1-3, 2-3, 2-5, 3-6, 3-7, 6-8}，无向图，访问邻居按编号递增" },
            { name: "带权图最短路", value: "A->B 权 2，A->C 权 5，B->C 权 2，B->D 权 9，C->D 权 2，D->E 权 3，其余无边；求 A 到各点最短路" }
          ],
          outputs: [
            "DFS 序列（从 1 出发，按编号递增访问邻接点）为 1 2 3 6 8 7 5 4：走到 8 之后无路可走，回退到 7、再回退到 3 才继续访问 5，最后回到 1 访问 4",
            "BFS 序列（从 1 出发）为 1 2 3 5 6 7 8 4：第 1 层是 2、3，第 2 层是 5、6、7，第 3 层是 8，最后才轮到 4",
            "DFS 与 BFS 的序列不同（1 2 3 6 8 7 5 4 与 1 2 3 5 6 7 8 4），但访问的顶点集合完全相同；序列不唯一，取决于起始顶点与邻接点的访问次序约定",
            "该图连通，故从顶点 1 出发可访问全部 8 个顶点，连通分量个数为 1；边数 $e = 7$，恰好等于 $n-1$，且无回路，所以它本身是一棵树",
            "Dijkstra 从 A 出发：dist[A]=0，dist[B]=2（直达），dist[C]=4（$A \\to B \\to C = 2+2$ 优于直达 5），dist[D]=6（$A \\to B \\to C \\to D$），dist[E]=9（$A \\to B \\to C \\to D \\to E$）",
            "注意 dist[D] = 6 而不是 9：$A \\to B \\to D$ 的直接边权是 9，绕行 $A \\to B \\to C \\to D$ 只要 6，这就是松弛操作的价值"
          ],
          note: "Dijkstra 每轮确定一个距离最小的顶点，共确定 n 轮；朴素实现是 $O(n^2)$，用堆优化是 $O(e \\log n)$。"
        },
        {
          type: "pitfall",
          title: "图与哈希表的易错点",
          items: [
            "对稀疏图用邻接矩阵：n 个顶点要 $n^2$ 个单元，$10^4$ 个顶点就是 $10^8$ 个，空间直接爆掉。稀疏图必须用邻接表。",
            "BFS 在带权图上求最短路：BFS 只适用于**无权图**（或所有边权相等），带权图必须用 Dijkstra、Floyd 或 Bellman-Ford。",
            "用 Dijkstra 处理负权边：贪心前提失效会得到错误答案。需要负权时用 Floyd（无负环）或 Bellman-Ford（并检测负环）。",
            "BFS 在入队时不标记已访问，只在出队时标记：同一顶点会被重复入队多次，队列规模爆炸，复杂度退化。正确做法是**入队时立即标记**。",
            "哈希表删除元素时直接把槽位置空：这会截断同义词的探测链，导致后面本该能找到的元素查找失败。开放定址法必须使用删除标记（墓碑）。",
            "把线性探测的 ASL 算成「平均探测次数」时漏掉最后一次插入的影响：ASL 是**当前表中元素**的查找长度平均值，插入顺序与表长都会影响它，必须逐步模拟而不能只套公式。",
            "链地址法的装填因子写死为小于 1：链地址法的 $\\alpha$ 可以大于 1（多个元素挂在同一条链上），只要链不太长性能仍然可接受。"
          ]
        },
        {
          type: "steps",
          title: "从哈希函数到 rehash：一个哈希表的完整生命周期",
          items: [
            { t: "选表长与哈希函数", d: "表长取素数（如 11、13、17），哈希函数用除留余数法 $H(\\text{key}) = \\text{key} \\bmod m$，保证地址分布尽量均匀。" },
            { t: "插入并处理冲突", d: "算出地址后若已被占用，按选定的探测序列（线性、二次、再哈希）或链表（链地址法）安置新元素，同时累计每个元素的探测次数。" },
            { t: "统计性能", d: "用 $\\text{ASL}_{\\text{成功}} = \\frac{\\text{所有元素探测次数之和}}{\\text{元素个数}}$ 评估当前表的性能；若 ASL 明显上升，说明装填因子已过高或堆积严重。" },
            { t: "删除时打墓碑", d: "开放定址法删除元素只能标记为「已删除」，插入时可以复用该槽位，但查找不能在此停止。" },
            { t: "装填因子超阈值时 rehash", d: "新建约两倍表长的素数表，把旧表所有有效元素重新插入。单次代价 $O(n)$，但均摊到之前的 n 次插入上仍是 $O(1)$。" }
          ]
        },
        {
          type: "interactive",
          lab: "datalab",
          title: "单步看线性探测哈希表的插入与 ASL 累加",
          config: {
            state: { 当前key: "-", H值: "-", 探测次数: 0, 表状态: "全空（表长 11）", 累计探测次数: 0, 已插入个数: 0 },
            steps: [
              { desc: "第 1 步：插入 22，$H = 22 \\bmod 11 = 0$，位置 0 为空", state: { 当前key: 22, H值: 0, 探测次数: 1, 表状态: "[0]=22", 累计探测次数: 1, 已插入个数: 1 }, note: "一次命中最理想，探测 1 次。" },
              { desc: "第 2 步：插入 41，$H = 8$，位置 8 为空", state: { 当前key: 41, H值: 8, 探测次数: 1, 表状态: "[0]=22, [8]=41", 累计探测次数: 2, 已插入个数: 2 }, note: "不同关键字落在不同槽位，没有冲突。" },
              { desc: "第 3 步：插入 53，$H = 9$，位置 9 为空", state: { 当前key: 53, H值: 9, 探测次数: 1, 表状态: "[0]=22, [8]=41, [9]=53", 累计探测次数: 3, 已插入个数: 3 }, note: "表中冲突是概率事件，前几个关键字往往很顺。" },
              { desc: "第 4 步：插入 46，$H = 2$，位置 2 为空", state: { 当前key: 46, H值: 2, 探测次数: 1, 表状态: "[0]=22, [2]=46, [8]=41, [9]=53", 累计探测次数: 4, 已插入个数: 4 }, note: "此时装填因子 $\\alpha = \\frac{4}{11} \\approx 0.36$，性能还非常好。" },
              { desc: "第 5 步：插入 30，$H = 8$ 被 41 占，探测 9 被 53 占，落到 10", state: { 当前key: 30, H值: 8, 探测次数: 3, 表状态: "[0]=22, [2]=46, [8]=41, [9]=53, [10]=30", 累计探测次数: 7, 已插入个数: 5 }, note: "这就是线性探测：从 H 开始依次往后找一个空位，代价是可能与无关关键字「粘」在一起。" },
              { desc: "第 6 步：插入 13，$H = 2$ 被 46 占，再访问位置 3 为空", state: { 当前key: 13, H值: 2, 探测次数: 2, 表状态: "[0]=22, [2]=46, [3]=13, [8]=41, [9]=53, [10]=30", 累计探测次数: 9, 已插入个数: 6 }, note: "13 与 46 是同义词（都散列到 2），所以 13 的查找长度是 2 而不是 1，这就是冲突的代价。" },
              { desc: "第 7 步：插入 1，$H = 1$ 为空，探测 1 次", state: { 当前key: 1, H值: 1, 探测次数: 1, 表状态: "[0]=22, [1]=1, [2]=46, [3]=13, [8]=41, [9]=53, [10]=30", 累计探测次数: 10, 已插入个数: 7 }, note: "关键字 1 很幸运地落到空位，但它的位置恰好会挡住后面 67 的路。" },
              { desc: "第 8 步：插入 67，$H = 1$ 起依次访问 1、2、3、4，落到位置 4", state: { 当前key: 67, H值: 1, 探测次数: 4, 表状态: "[0]=22, [1]=1, [2]=46, [3]=13, [4]=67, [8]=41, [9]=53, [10]=30", 累计探测次数: 14, 已插入个数: 8 }, note: "67 的查找长度是 4，远大于 1——这就是线性探测「堆积（clustering）」的直观后果。" },
              { desc: "第 9 步：统计 —— 累计探测 14 次，$\\text{ASL}_{\\text{成功}} = \\frac{14}{8} = 1.75$", state: { 当前key: "-", H值: "-", 探测次数: 0, 表状态: "共 8 个元素，装填因子 α = 8/11 ≈ 0.73", 累计探测次数: 14, 已插入个数: 8 }, note: "若表长不变继续插入，ASL 会迅速上升；此时应 rehash 到更大的素数表。注意若把 30 与 13 的插入顺序对调，总探测次数会变成 16、ASL 变成 2.0。" }
            ],
            tasks: [
              { t: "把表长改成 13（仍用 $\\text{key} \\bmod 13$），重新排序插入 8 个关键字，重新计算 ASL成功。", hint: "先算出每个关键字的新 H 值，再逐个模拟探测。", check: "能给出新的表状态、每个关键字的探测次数与新的 ASL，并说明表长变化对冲突的影响。" },
              { t: "用链地址法（同表长 11）重做同一组数据，画出 11 条链，计算 ASL成功，与线性探测的 2.0 对比。", hint: "链地址法的探测次数等于该元素在链中的位置序号。", check: "能画出三条以上的冲突链并算出 ASL，说明链地址法对装填因子更不敏感。" }
            ]
          }
        },
        {
          type: "lab",
          title: "上机任务：把四个图算法与两种哈希策略都跑一遍",
          steps: [
            "用邻接矩阵与邻接表各建一次同一张图（顶点 8 个、边 7 条），分别打印 DFS 与 BFS 序列，确认两者一致且与手算结果相同。",
            "实现 Dijkstra（朴素 $O(n^2)$ 与堆优化两版），对同一张带权图比较运行时间与结果；再构造一个含负权边的图，验证朴素 Dijkstra 会给出错误答案。",
            "实现 Floyd，对同一张带权图输出任意两点间的最短距离矩阵，与 Dijkstra 逐点运行的结果逐项核对。",
            "实现 Prim 与 Kruskal 求同一张带权图的最小生成树，比较两者选出的边集与总权值；再用一张所有边权互不相同的图验证 MST 的唯一性。",
            "实现线性探测与链地址法两种哈希表，对同一组关键字统计 ASL成功与 ASL不成功，并画出 ASL 随装填因子 $\\alpha$ 变化的曲线（$\\alpha$ 从 0.1 到 0.9）。"
          ],
          note: "报告里要给出四个算法在同一张图上的实测耗时与结论：什么规模的稠密图该用 Prim 或矩阵版 Dijkstra，什么规模该用 Kruskal 或堆优化版。"
        }
      ],
      quiz: [
        {
          id: "ds-graph-hash-q1",
          type: "single",
          q: "一个有 n 个顶点、e 条边的稀疏图（$e$ 远小于 $n^2$），从存储空间与「枚举某顶点的所有邻居」这两个角度考虑，最合适的存储结构是？",
          options: [
            "邻接表，空间 $O(n+e)$，枚举邻居的代价与该顶点的度成正比",
            "邻接矩阵，空间 $O(n^2)$，但枚举邻居只需要扫描一行，速度最快",
            "邻接矩阵，因为判断任意两点是否相邻是 $O(1)$，这对遍历至关重要",
            "十字链表，因为它同时保存出边与入边，空间比邻接表更省"
          ],
          answer: 0,
          why: "稀疏图的边数远小于 $n^2$，邻接表只需要 $O(n+e)$ 空间，而邻接矩阵固定要 $n^2$ 个单元，规模一大就浪费甚至无法分配。B 错在「扫描一行」本身就要 $O(n)$，即使这一行里绝大多数是 0，代价仍与 n 成正比而与度无关，比邻接表慢。C 的 $O(1)$ 判断相邻确实成立，但 DFS/BFS 的主要操作是枚举邻居而不是判断相邻。D 错在十字链表是为有向图服务的结构，每个边结点要存两个指针，空间比邻接表更大，不会更省。"
        },
        {
          id: "ds-graph-hash-q2",
          type: "multi",
          q: "关于最短路径算法，下列说法正确的有哪些？",
          options: [
            "Dijkstra 采用贪心策略，每轮从未确定的顶点中选出距离最小的一个并松弛它的邻居，不能处理负权边",
            "Floyd 采用动态规划，以每个顶点依次作为中转点更新所有点对的距离，允许负权边但不能有负权回路",
            "在无权图上求单源最短路可以用 BFS，因为 BFS 的层数就等于边数最少的最短路径长度",
            "只要把所有边的权值都乘 10 变成非负整数，Dijkstra 就可以处理原本含负权边的图"
          ],
          answer: [0, 1, 2],
          why: "A 是 Dijkstra 的定义与它的限制。B 是 Floyd 的三重循环思想与其适用边界，有负权回路时最短路径会无限缩小而失去意义。C 正确，无权图每条边代价相同，层数即最短路。D 错：把所有权值同时乘一个正数只是等比例缩放，负权边仍然是负的，贪心前提照样失效；正确处理负权要用 Bellman-Ford 或 Floyd。"
        },
        {
          id: "ds-graph-hash-q3",
          type: "fill",
          q: "哈希函数 $H(\\text{key}) = \\text{key} \\bmod 11$，表长 11，用线性探测法依次插入 22、41、53、46、30、13、1、67，则成功查找的平均查找长度 $\\text{ASL}_{\\text{成功}} =$ ____（填数值，可用小数）。",
          answer: ["1.75", "14/8", "1.75次", "1.75 次"],
          why: "按题目给定的顺序逐个模拟：22、41、53、46 都一次命中（各 1 次）；30 的 H=8 被 41 占住、9 又被 53 占住，落到 10 号位置，探测 3 次；13 的 H=2 被 46 占住，落到 3 号位置，探测 2 次；1 一次命中；67 的 H=1 被 1 占住，依次访问 2（被 46 占）、3（被 13 占）、4（空），落到 4 号位置，探测 4 次。总探测次数 $= 1+1+1+1+3+2+1+4 = 14$，$\\text{ASL}_{\\text{成功}} = \\frac{14}{8} = 1.75$。易错点有两个：一是把 67 的探测次数算成 5 次或 3 次——它的探测序列只有 1、2、3、4 四个地址（1 被关键字 1 占、2 被 46 占、3 被 13 占、4 为空），第 4 次访问就写入成功，所以探测 4 次；二是忽略「ASL 依赖插入顺序」，若把 30 与 13 的插入顺序对调，总探测次数会变成 16、ASL 变成 2.0，可见开放定址法的 ASL 必须按题目给定顺序逐步模拟，不能凭公式硬套。"
        },
        {
          id: "ds-graph-hash-q4",
          type: "order",
          q: "把用「链地址法」插入一个与已有元素冲突的关键字的步骤排成正确顺序（表长 $m$，$H(\\text{key}) = \\text{key} \\bmod m$）。",
          items: [
            "计算哈希地址 $h = \\text{key} \\bmod m$",
            "定位到下标为 h 的槽位，取出挂在它下面的那条链",
            "沿链依次比较，确认表中尚不存在该关键字（避免插入重复元素）",
            "把新结点插入该链的头部（或尾部），并让表中元素个数加 1",
            "检查装填因子是否超过阈值，若超过则申请更大的表并重新插入全部元素"
          ],
          answer: [0, 1, 2, 3, 4],
          why: "链地址法的插入必须先算地址、再沿链查重、最后挂结点，顺序不能颠倒：不查重会插入重复关键字导致查找语义错误；先挂结点再算地址则无处可挂。最后一步是装填因子维护，$\\alpha$ 超过阈值（如 0.75）时必须 rehash，否则链会越来越长。注意链地址法删除元素只需从链上摘除结点，不像开放定址法那样需要墓碑标记。"
        }
      ]
    }
  ]
});
