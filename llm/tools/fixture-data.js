/* 引擎自测用的极小课程数据（tools/fixture.html 专用，不参与正式站点加载）
   目的：把"引擎是否有 bug"与"课程内容是否正确"两件事分开验证。
   LLM 站版：覆盖全部 block 类型、六类 LLM 实验与四种题型（W1 起六类实验落地后逐步换成真实 lab）。 */
window.COURSE_PACKS.push({
  id: "fixture-course",
  title: "引擎自测课（LLM 站）",
  icon: "🧪",
  term: "主线 A · LLM 基础与原理",
  hours: 4,
  blurb: "用于隔离验证渲染引擎：极小的课程，覆盖全部 block 类型与 LLM 实验、4 种题型。",
  tags: ["fixture"],
  need: "零基础可学：本课只是引擎自测数据。",
  lessons: [
    {
      id: "fx-basics",
      title: "第一讲：全部块类型与题型",
      goal: "验证 concept/steps/analogy/code/pitfall/calc/lab 与四种题型都能渲染。",
      est: 10,
      blocks: [
        { type: "concept", title: "核心讲解", md: "这是**粗体**与行内代码 `O(n log n)` 的渲染测试。\n\n- 列表项一\n- 列表项二\n\n> 提示块：应当渲染为 callout。\n\n| 算法 | 最好 | 最坏 |\n|---|---|---|\n| 快排 | O(n log n) | O(n^2) |" },
        { type: "analogy", title: "生活类比", md: "把注意力想象成读书时用荧光笔：看到某个词时，你给相关句子打不同的高亮浓度，最后按浓度加权汇总理解。" },
        { type: "steps", title: "操作步骤", items: [{ t: "第一步", d: "把文本切分成 token" }, "第二步：逐 token 预测下一个"] },
        { type: "code", lang: "python", title: "Python 代码", code: "def softmax(scores):\n    e = [2.7182818 ** s for s in scores]  # e 的 score 次方\n    total = sum(e)\n    return [x / total for x in e]  # 归一化成概率\n\nprint(softmax([1.0, 0.0]))  # [0.73, 0.27]" },
        { type: "pitfall", title: "易错点", items: ["把温度调低 ≠ 一定正确，只是更保守", "token 不是字符：一个汉字可能占多个 token"] },
        { type: "calc", title: "手算演练", inputs: [{ name: "logits", value: "[1, 0]" }, { name: "公式", value: "softmax(x)_i = e^{x_i} / Σ e^{x_j}" }], outputs: ["softmax([1,0]) ≈ [0.73, 0.27]"], note: "先自己算再展开。" },
        { type: "lab", title: "上机任务", steps: ["手写一个 BPE 分词器（纯标准库）", "用它编码再解码一句话"], note: "验收：编码后能无损解码回原文。" }
      ],
      quiz: [
        { id: "fx-q1", type: "single", q: "softmax 的输出特点是？", options: ["全部等于 1", "加起来等于 1 的概率", "可能为负数", "与原分数完全无关"], answer: 1, why: "softmax 先取指数（保证非负）再归一化，输出是一组加起来等于 1 的概率。其余选项都违反定义。" },
        { id: "fx-q2", type: "multi", q: "下列哪些是采样策略旋钮？", options: ["temperature", "top-k", "top-p", "learning rate"], answer: [0, 1, 2], why: "temperature/top-k/top-p 都在推理时调节「从概率分布怎么挑下一个 token」；learning rate 是训练时的超参数，与采样无关。" },
        { id: "fx-q3", type: "fill", q: "softmax([1, 0]) 的两个输出四舍五入到两位小数是 ____", answer: ["[0.73, 0.27]", "0.73, 0.27", "0.73和0.27"], why: "e^1 ≈ 2.718、e^0 = 1，归一化后约为 0.731 与 0.269，四舍五入到两位即 0.73 与 0.27。" },
        { id: "fx-q4", type: "order", q: "把「用 LLM 答一道题」的流程排成正确顺序", items: ["模型输出下一个 token", "把 prompt 切成 token", "拼上已生成的 token 继续预测", "用户输入提示词"], answer: [3, 1, 0, 2], why: "先有用户提示词，切成 token 后模型开始逐个预测：每个新 token 都要拼回上下文再预测下一个，这是自回归生成的标准顺序。" }
      ]
    },
    {
      id: "fx-labs",
      title: "第二讲：LLM 交互实验（W0 用 datalab 占位，W1 起换六类真身）",
      goal: "验证交互实验组件可渲染且计算正确。",
      est: 12,
      blocks: [
        { type: "concept", title: "实验说明", md: "本讲用 datalab 验证实验管道；W1 起 tokenlab 等六类 LLM 实验逐个替换进来。" },
        { type: "interactive", lab: "datalab", title: "算法单步", config: { state: { i: 0, sum: 0 }, steps: [{ desc: "初始化 i=0, sum=0", state: { i: 0, sum: 0 }, note: "累加开始" }, { desc: "i=1，累加 a[0]", state: { i: 1, sum: 1 }, note: "第一次累加" }, { desc: "i=2，累加 a[1]", state: { i: 2, sum: 3 }, note: "第二次累加" }, { desc: "i=3，累加 a[2]", state: { i: 3, sum: 6 }, note: "第三次累加" }, { desc: "结束，返回 sum", state: { i: 3, sum: 6 }, note: "循环退出条件 i>=3" }] } },
        { type: "interactive", lab: "samplab", title: "采样策略：温度、top-k、top-p", config: { prompt: "问题：法国首都是哪座城市？模型在下面四个候选词上给出的原始分数（logit）。", logits: [{ token: "巴黎", logit: 3.0 }, { token: "里昂", logit: 1.5 }, { token: "马赛", logit: 0.5 }, { token: "柏林", logit: -1.0 }], temperature: 1, topK: 0, topP: 1, seed: 20261024, steps: [{ desc: "原始设置 T=1：巴黎 75.6%，但其它三个词加起来还有 24.4% 的概率被抽到。", temperature: 1, topK: 0, topP: 1, note: "这就是「模型偶尔答错」的数学来源：它不是查表，而是在按概率抽签。" }, { desc: "把温度降到 0.5：分布变尖锐，巴黎升到 94.6%，冷门词几乎没了机会。", temperature: 0.5, topK: 0, topP: 1, note: "温度只改变概率分布的陡峭程度，不改变谁的分最高。" }, { desc: "把温度升到 2：分布变平坦，最冷的「柏林」也拿到 7.1%。", temperature: 2, topK: 0, topP: 1, note: "温度越高越像「乱说」，越低越像「背答案」。" }, { desc: "回到 T=1 并设 top-k=2：只保留巴黎与里昂，两者重新归一化成 81.8% 与 18.2%。", temperature: 1, topK: 2, topP: 1, note: "top-k 是硬截断：第 k 名之后的词概率直接清零。" }, { desc: "反过来设 top-p=0.9：从高到低累加 75.6% + 16.9% = 92.4% 已超过 90%，所以候选同样只剩两个。", temperature: 1, topK: 0, topP: 0.9, note: "top-p 是软截断：候选词的个数随分布形状自动变化——分布越平，留下的词越多。" }] } }
      ],
      quiz: [
        { id: "fx-q5", type: "single", q: "temperature 调低会怎样？", options: ["输出更随机", "输出更确定、更保守", "上下文窗口变大", "模型参数量变小"], answer: 1, why: "温度是 softmax 的分母缩放：调低让概率分布更尖锐、模型更倾向选最高概率的 token；与上下文窗口和参数量无关。" },
        { id: "fx-q6", type: "fill", q: "softmax([2, 0]) 四舍五入到两位小数的第一个数是 ____", answer: ["0.88", "0.88,"], why: "e^2 ≈ 7.389、e^0 = 1，归一化后约 0.881 与 0.119，第一个数四舍五入为 0.88。" }
      ]
    }
  ]
});
