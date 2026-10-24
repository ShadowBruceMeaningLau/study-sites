/* 引擎自测用的极小课程数据（tools/fixture.html 专用，不参与正式站点加载）
   目的：把"引擎是否有 bug"与"课程内容是否正确"两件事分开验证。 */
window.COURSE_PACKS.push({
  id: "fixture-course",
  title: "引擎自测课",
  icon: "🧪",
  term: "测试",
  hours: 4,
  blurb: "用于隔离验证渲染引擎：极小的课程，覆盖全部 block 类型与 6 种实验、4 种题型。",
  tags: ["fixture"],
  lessons: [
    {
      id: "fx-basics",
      title: "第一讲：全部块类型与题型",
      goal: "验证 concept/steps/analogy/code/pitfall/calc/lab 与四种题型都能渲染。",
      est: 10,
      blocks: [
        { type: "concept", title: "核心讲解", md: "这是**粗体**与行内代码 `O(n log n)` 的渲染测试。\n\n- 列表项一\n- 列表项二\n\n> 提示块：应当渲染为 callout。\n\n| 算法 | 最好 | 最坏 |\n|---|---|---|\n| 快排 | O(n log n) | O(n^2) |" },
        { type: "analogy", title: "生活类比", md: "把栈想象成一摞盘子：只能从最上面取放，这就是后进先出（LIFO）。" },
        { type: "steps", title: "操作步骤", items: [{ t: "第一步", d: "把指针指向头结点" }, "第二步：循环直到 cur 为空"] },
        { type: "code", lang: "c", title: "C 代码", code: "#include <stdio.h>\nint main(void) {\n    int a[3] = {1, 2, 3}; // 数组\n    int sum = 0;\n    for (int i = 0; i < 3; i++) sum += a[i];\n    printf(\"%d\\n\", sum);\n    return 0;\n}" },
        { type: "pitfall", title: "易错点", items: ["把赋值 = 写成比较 ==", "数组下标从 0 开始，越界不会报错"] },
        { type: "calc", title: "手算演练", inputs: [{ name: "n", value: "8" }, { name: "公式", value: "T(n) = 2T(n/2) + n" }], outputs: ["T(8) = 32", "层数 = 3"], note: "先自己算再展开。" },
        { type: "lab", title: "上机任务", steps: ["写一个冒泡排序", "测量 n=1000 时的运行时间"], note: "验收：输出排序前后序列。" }
      ],
      quiz: [
        { id: "fx-q1", type: "single", q: "栈的特点是？", options: ["先进先出", "后进先出", "随机存取", "双端插入"], answer: 1, why: "栈只在同一端插入删除，因此后进先出。先进先出是队列；随机存取是数组的特点；双端插入是双端队列。" },
        { id: "fx-q2", type: "multi", q: "下列哪些是稳定排序？", options: ["冒泡排序", "快速排序", "归并排序", "堆排序"], answer: [0, 2], why: "冒泡与归并保持相等元素的相对次序，是稳定的；快排的划分与堆排的交换会打乱相等元素次序，因此不稳定。" },
        { id: "fx-q3", type: "fill", q: "8 位补码能表示的最小整数是 ____", answer: ["-128", "－128"], why: "8 位补码范围是 -128 到 127：1000_0000 表示 -128，这是补码比原码多表示一个负数的原因。" },
        { id: "fx-q4", type: "order", q: "把编译流程排成正确顺序", items: ["生成目标代码", "词法分析", "语法分析"], answer: [1, 2, 0], why: "编译前端先做词法分析得到 token，再做语法分析得到语法树，最后由后端生成目标代码，顺序不能颠倒。" }
      ]
    },
    {
      id: "fx-labs",
      title: "第二讲：六种交互实验",
      goal: "验证 pathlab/schedlab/cpulab/pagelab/arbitlab/datalab 全部可渲染且计算结果正确。",
      est: 12,
      blocks: [
        { type: "concept", title: "实验说明", md: "本讲把六种实验组件各放一个，用于检查渲染与数值计算。" },
        { type: "interactive", lab: "pathlab", title: "寻路实验", config: { grid: [[1, 1, 9, 1], [1, 0, 1, 1], [1, 1, 1, 2]], start: [0, 0], end: [2, 3], algo: "dijkstra", legend: "0 是墙，数字是通过代价", tasks: ["先猜最短路，再点播放验证", { t: "改成 bfs 对比路径", hint: "点上方按钮切换算法" }] } },
        { type: "interactive", lab: "schedlab", title: "调度实验", config: { procs: [{ name: "P1", arrival: 0, burst: 5 }, { name: "P2", arrival: 1, burst: 3 }, { name: "P3", arrival: 2, burst: 1 }], quantum: 2, algos: ["FCFS", "SJF", "SRTF", "RR", "优先级"] } },
        { type: "interactive", lab: "cpulab", title: "指令执行", config: { regs: { R1: 0, R2: 0 }, mem: { "0x10": 7 }, program: [{ asm: "LOAD R1, [0x10] / 取数到 R1", note: "把内存 0x10 的值装入 R1" }, { asm: "MOV R2, 5 / 立即数传送", note: "R2 = 5" }, { asm: "ADD R1, R2 / 相加", note: "R1 = R1 + R2" }, { asm: "STORE R1, [0x11] / 存回内存", note: "写回内存" }, { asm: "HLT / 停机", note: "结束" }], legend: "逐条执行并观察寄存器与内存变化" } },
        { type: "interactive", lab: "pagelab", title: "页面置换", config: { frames: 3, refs: [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1], algos: ["OPT", "FIFO", "LRU", "CLOCK"] } },
        { type: "interactive", lab: "arbitlab", title: "位模式", config: { bits: 8, modes: ["无符号", "原码", "反码", "补码", "移码"], legend: "点击位切换" } },
        { type: "interactive", lab: "datalab", title: "算法单步", config: { state: { i: 0, sum: 0 }, steps: [{ desc: "初始化 i=0, sum=0", state: { i: 0, sum: 0 }, note: "累加开始" }, { desc: "i=1，累加 a[0]", state: { i: 1, sum: 1 }, note: "第一次累加" }, { desc: "i=2，累加 a[1]", state: { i: 2, sum: 3 }, note: "第二次累加" }, { desc: "i=3，累加 a[2]", state: { i: 3, sum: 6 }, note: "第三次累加" }, { desc: "结束，返回 sum", state: { i: 3, sum: 6 }, note: "循环退出条件 i>=3" }] } }
      ],
      quiz: [
        { id: "fx-q5", type: "single", q: "BFS 与 Dijkstra 的主要差别是？", options: ["BFS 不能处理网格", "Dijkstra 考虑边的代价而 BFS 只看层数", "两者完全等价", "Dijkstra 只能用于无权图"], answer: 1, why: "BFS 按层扩展，隐含每条边权重相同；Dijkstra 每次取出当前距离最小的点并松弛邻边，能处理非负权。两者都不能处理负权边（需 Bellman-Ford）。" },
        { id: "fx-q6", type: "fill", q: "3 个页框、访问串 7,0,1,2,0,3,0,4,2,3,0,3,2,1 时 FIFO 的缺页次数是 ____", answer: ["10", "10 次"], why: "按 FIFO 淘汰最早进入的页，逐次模拟得到 10 次缺页；同样的访问串 LRU 只需 9 次，差别来自 LRU 利用了时间局部性。" }
      ]
    }
  ]
});
