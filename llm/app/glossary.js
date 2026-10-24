/* ==========================================================================
   glossary.js —— 术语表（零依赖；LLM 学习站版）
   结构：window.GLOSSARY = { cats: [{ cat, items: [{ t, en, d, where }] }] }
   正文里点虚线术语、点开完整术语表都读这份数据。
   W0 起步集；随各波课程交付同步增补（rebuild 规则见 llm/tools/rebuild-glossary.mjs，若存在）。
   ========================================================================== */
(function (global) {
  "use strict";

  var TERMS = [
    {
      cat: "LLM 入门（零基础从这里看）",
      items: [
        { t: "大语言模型（LLM）", en: "Large Language Model", d: "一种人工智能程序：读进海量文本学会「下一个词最可能是什么」，于是能续写、对话、翻译、写代码。你在这类学习站里看到的对话能力就来自它", where: "LLM 零基础入门 · 第 1 讲" },
        { t: "词元（token）", en: "token", d: "模型读写文本的最小单位，可以是一个词、半个词或一个标点。模型不是按字、而是按 token 计费的", where: "LLM 零基础入门 · 第 1 讲" },
        { t: "提示词（prompt）", en: "prompt", d: "你发给模型的输入文本。模型只根据 prompt 预测接下来该输出什么", where: "LLM 零基础入门 · 第 1 讲" },
        { t: "补全 / 生成（completion / generation）", en: "completion / generation", d: "模型一个 token 一个 token 地写出回复的过程，每个 token 都是「在已写内容之后最可能是什么」的猜测", where: "LLM 零基础入门 · 第 1 讲" },
        { t: "上下文窗口（context window）", en: "context window", d: "模型一次能「看到」的最大 token 数（输入 + 输出之和）。超过的部分会被截断或遗忘", where: "LLM 零基础入门 · 第 2 讲" },
        { t: "温度（temperature）", en: "temperature", d: "控制模型输出随机程度的旋钮：低温度更确定、更保守；高温度更多样、更容易胡说", where: "LLM 零基础入门 · 第 3 讲" },
        { t: "幻觉（hallucination）", en: "hallucination", d: "模型一本正经地输出看似合理、实际编造的内容。它不是在查资料，而是在「预测像样的文本」", where: "LLM 零基础入门 · 第 4 讲" },
        { t: "本地模型 / 私有化部署", en: "local model", d: "把模型文件下载到自己电脑上、用本地程序（如 Ollama）运行，数据不出本机", where: "LLM 零基础入门 · 第 5 讲" },
        { t: "Ollama", en: "Ollama", d: "一个把大模型在个人电脑上「一键运行」的工具：负责下载模型、管显存、提供 HTTP 接口", where: "LLM 零基础入门 · 第 5 讲" },
        { t: "量化（quantization）", en: "quantization", d: "把模型参数从高精度（如 16 位）压到低精度（如 4 位）以省显存与加速，代价是质量略有下降", where: "LLM 零基础入门 · 第 6 讲" }
      ]
    },
    {
      cat: "学习与训练基础",
      items: [
        { t: "机器学习（ML）", en: "Machine Learning", d: "不靠人写规则、而是让程序从数据里自己学出规律的一类方法。大模型是其中一个分支", where: "机器学习与深度学习基础 · 第 1 讲" },
        { t: "深度学习（DL）", en: "Deep Learning", d: "用很多层的神经网络从数据中学特征与规律的机器学习方法，是大模型的技术底座", where: "机器学习与深度学习基础 · 第 1 讲" },
        { t: "神经网络（neural network）", en: "neural network", d: "由大量「神经元」（做加权求和再套激活函数的单元）分层连接而成的计算结构，输入穿过各层变成输出", where: "神经网络 · 第 1 讲" },
        { t: "参数 / 权重（parameters / weights）", en: "parameters", d: "模型内部可调节的数字（如 7B 模型有约 70 亿个）。训练就是不断调整它们让输出更接近目标", where: "神经网络 · 第 1 讲" },
        { t: "损失函数（loss function）", en: "loss", d: "衡量「模型输出与正确答案差多远」的函数。训练的目标就是让它越小越好", where: "机器学习与深度学习基础 · 第 3 讲" },
        { t: "梯度下降（gradient descent）", en: "gradient descent", d: "反复沿「最陡下坡方向」微调参数使损失变小的方法，是训练神经网络的发动机", where: "机器学习与深度学习基础 · 第 4 讲" },
        { t: "反向传播（backpropagation）", en: "backpropagation", d: "用链式法则从输出层往回逐层计算「每个参数该怎么调」的高效算法", where: "机器学习与深度学习基础 · 第 5 讲" },
        { t: "过拟合（overfitting）", en: "overfitting", d: "模型把训练数据背得太死、遇到新数据反而变差。像学生只会做原题、换个数就不会", where: "机器学习与深度学习基础 · 第 6 讲" },
        { t: "预训练（pretraining）", en: "pretraining", d: "在海量文本上先训练「预测下一个词」的通用能力。这一步最烧钱，产出叫基座模型", where: "预训练与推理 · 第 1 讲" },
        { t: "微调（fine-tuning / SFT）", en: "fine-tuning", d: "在预训练模型基础上用较小数据继续训练，让它学会特定格式、风格或任务", where: "后训练与对齐前沿 · 第 2 讲" }
      ]
    },
    {
      cat: "Transformer 与推理",
      items: [
        { t: "嵌入（embedding）", en: "embedding", d: "把一个词/句子表示成一串数字（向量），使意思相近的东西在向量空间里也相近", where: "注意力与 Transformer · 第 1 讲" },
        { t: "注意力（attention）", en: "attention", d: "让模型在生成每个词时决定「重点看输入里的哪些词」并加权汇总的机制，是 Transformer 的核心", where: "注意力与 Transformer · 第 3 讲" },
        { t: "softmax", en: "softmax", d: "把一组分数转成「加起来等于 1 的概率」的函数。注意力权重、下一个 token 的概率都用它产生", where: "注意力与 Transformer · 第 3 讲" },
        { t: "Transformer", en: "Transformer", d: "完全基于注意力的神经网络架构（2017 年提出），当今几乎所有大语言模型的骨架", where: "注意力与 Transformer · 第 1 讲" },
        { t: "多头注意力（multi-head attention）", en: "multi-head attention", d: "并行跑多组注意力、让不同「头」关注不同关系（语法/指代/位置），再拼起来", where: "注意力与 Transformer · 第 4 讲" },
        { t: "KV 缓存（KV cache）", en: "KV cache", d: "生成时把已算过的键值缓存起来，每生成一个新 token 只算增量，避免重复计算", where: "预训练与推理 · 第 4 讲" },
        { t: "logits", en: "logits", d: "模型最后一层输出的原始分数（尚未转成概率）。经过 softmax 才变成下一个 token 的概率分布", where: "预训练与推理 · 第 3 讲" },
        { t: "采样（sampling）", en: "sampling", d: "从概率分布里按概率随机挑下一个 token 的过程。temperature/top-k/top-p 都是它的调节旋钮", where: "预训练与推理 · 第 3 讲" },
        { t: "自回归（autoregressive）", en: "autoregressive", d: "生成方式：新 token 接在已有 token 之后、再拿它一起预测下一个，一个接一个串行生成", where: "预训练与推理 · 第 2 讲" },
        { t: "scaling law（规模法则）", en: "scaling law", d: "经验规律：模型越大、数据越多、算力越足，能力越强且大致可预测", where: "预训练与推理 · 第 5 讲" }
      ]
    },
    {
      cat: "对齐、前沿与部署",
      items: [
        { t: "对齐（alignment）", en: "alignment", d: "让模型的行为符合人类偏好：有用、无害、诚实。RLHF 是其中一类方法", where: "后训练与对齐前沿 · 第 1 讲" },
        { t: "RLHF（基于人类反馈的强化学习）", en: "Reinforcement Learning from Human Feedback", d: "先让人给模型的多个回答排序、训练奖励模型，再用强化学习优化模型去拿高分", where: "后训练与对齐前沿 · 第 3 讲" },
        { t: "RLVR / GRPO（可验证奖励强化学习）", en: "RLVR / GRPO", d: "不靠人打分、而用「答案对不对/测试过不过」这类可自动验证的奖励做强化学习；GRPO 是省算力的实现，是 2025 年后推理模型的主流训练法", where: "后训练与对齐前沿 · 第 5 讲" },
        { t: "思维链（Chain of Thought, CoT）", en: "Chain of Thought", d: "让模型先把推理步骤一步步写出来再给答案，正确率往往大幅提升", where: "提示词工程 · 第 3 讲" },
        { t: "推理模型（reasoning model）", en: "reasoning model", d: "专门用强化学习训练过「长时间思考再回答」的模型（如 DeepSeek-R1 路线），会先输出思考过程", where: "后训练与对齐前沿 · 第 6 讲" },
        { t: "测试时计算（test-time compute）", en: "test-time compute", d: "推理时给模型更多计算预算（多步思考、多次采样投票）来换更好的答案", where: "后训练与对齐前沿 · 第 6 讲" },
        { t: "混合专家（MoE）", en: "Mixture of Experts", d: "把模型拆成多个「专家」子网络，每次只激活其中一小部分，用同样的显存装更大的模型", where: "前沿模型专题 2026 · 第 2 讲" },
        { t: "线性注意力 / 稀疏注意力", en: "linear / sparse attention", d: "降低注意力计算量的变体：或把「每个词看所有词」改成只看重点位置，让长上下文更省算力", where: "前沿模型专题 2026 · 第 3 讲" },
        { t: "GGUF", en: "GGUF", d: "一种把模型（含量化权重）打包成单文件、方便在个人电脑上推理的格式，Ollama 等工具都支持", where: "前沿模型专题 2026 · 第 8 讲" },
        { t: "LoRA（低秩适配）", en: "Low-Rank Adaptation", d: "只训练附加的小矩阵、冻结原模型参数的微调方法，让 8GB 显存也能做微调", where: "微调入门 · 第 4 讲" }
      ]
    },
    {
      cat: "Harness 与 Agent",
      items: [
        { t: "harness（智能体执行框架）", en: "harness", d: "运行智能体/模型的「外壳」：负责会话管理、工具循环、多模型适配、中断恢复与评测。模型是大脑，harness 是身体与环境", where: "Harness 解剖 · 第 1 讲" },
        { t: "智能体（agent）", en: "agent", d: "能自主规划、调用工具、观察结果并迭代直到完成任务的程序（以 LLM 为大脑）", where: "Agent 核心 · 第 1 讲" },
        { t: "ReAct（推理+行动循环）", en: "Reason + Act", d: "一种让模型交替输出「思考（Thought）→ 行动（Action）→ 观察（Observation）」直至完成任务的循环模式", where: "Agent 核心 · 第 2 讲" },
        { t: "工具调用（tool calling / function calling）", en: "tool calling", d: "模型不直接回答、而是输出「调用某函数并带参数」的指令，由程序执行后把结果送回模型", where: "工具调用 · 第 1 讲" },
        { t: "RAG（检索增强生成）", en: "Retrieval-Augmented Generation", d: "先从知识库检索相关内容、拼进提示词再让模型作答，给模型「外接资料」以抑制幻觉", where: "RAG · 第 1 讲" },
        { t: "MCP（模型上下文协议）", en: "Model Context Protocol", d: "连接「智能体/应用」与「工具和数据服务器」的开放协议：一个标准接口让各种工具可插拔", where: "Agent 协议生态 2026 · 第 3 讲" },
        { t: "UHP（统一 Harness 协议）", en: "Unified Harness Protocol", d: "连接「产品」与「完整智能体执行框架」的开放协议（2026 年发布），约定任务、会话、流式与文件", where: "Agent 协议生态 2026 · 第 2 讲" },
        { t: "A2A / ACP / AG-UI", en: "A2A / ACP / AG-UI", d: "三个协作协议：A2A 连接智能体与智能体；ACP 连接编辑器与编码智能体；AG-UI 连接前端界面与智能体", where: "Agent 协议生态 2026 · 第 4~5 讲" },
        { t: "评测（eval / benchmark）", en: "evaluation", d: "用一组题目与打分规则系统测量模型/智能体的能力。没有评测就无法判断「改完是变好还是变坏」", where: "评测 Harness · 第 1 讲" },
        { t: "沙箱（sandbox）", en: "sandbox", d: "隔离的执行环境，让智能体调用工具时不能随意破坏宿主系统", where: "Agent 核心 · 第 7 讲" },
        { t: "MCP 工具服务器", en: "MCP server", d: "按 MCP 协议对外声明自己有哪些工具、接受调用并返回结果的独立进程。它不认识模型，只认结构化请求", where: "Agent 协议生态 2026 · 第 2 讲" },
        { t: "RAG 切分（chunking）", en: "chunking", d: "把长文档切成适合检索的小块。切太大捞回无关内容、切太小丢掉上下文，是最需要手调的一步", where: "RAG · 第 2 讲" },
        { t: "嵌入模型（embedding model）", en: "embedding model", d: "专门把文本变成向量的模型。它只做「文字 → 向量」这一件事，不生成答案", where: "RAG · 第 3 讲" },
        { t: "重排（reranking）", en: "reranking", d: "先粗筛出一批候选，再用更精细的模型重新排序。比只做向量检索更准，代价是多一次模型调用", where: "RAG · 第 5 讲" },
        { t: "工具 schema", en: "tool schema", d: "用结构化格式（通常是 JSON Schema）描述一个工具叫什么、参数有哪些、哪些必填、各自什么类型。模型据此决定怎么填参数", where: "工具调用 · 第 2 讲" },
        { t: "评测数据集（eval set）", en: "eval set", d: "一组固定的输入与标准答案，用来反复测量能力。必须与训练数据严格分开，否则分数会虚高", where: "评测 Harness · 第 2 讲" },
        { t: "LLM 当裁判（LLM as judge）", en: "LLM as judge", d: "用一个更强的模型给被测模型的回答打分。便宜且灵活，但要小心它自己的偏见与不稳定", where: "评测 Harness · 第 3 讲" },
        { t: "Goodhart 定律", en: "Goodhart's law", d: "一个指标一旦变成目标，它就不再是好的指标。评测里表现为「为了刷分而优化，能力没真提升」", where: "评测 Harness · 第 6 讲" }
      ]
    },
    {
      cat: "推理工程与部署",
      items: [
        { t: "流式输出（streaming）", en: "streaming", d: "服务边生成边把片段推给客户端，于是字是一个一个蹦出来的。协议上常用 SSE（Server-Sent Events）承载", where: "推理 API 与流式输出 · 第 3 讲" },
        { t: "SSE（服务器发送事件）", en: "Server-Sent Events", d: "一种让服务端持续往客户端推数据的简单协议：每条消息以 data: 开头、空行结尾，比 WebSocket 更轻", where: "推理 API 与流式输出 · 第 4 讲" },
        { t: "退避重试（backoff）", en: "exponential backoff", d: "请求失败后不立刻重试，而是等一小段、每次失败把等待时间翻倍，避免把已经过载的服务压垮", where: "推理 API 与流式输出 · 第 5 讲" },
        { t: "限流（rate limit）", en: "rate limit", d: "服务端对单位时间内请求数或 token 数的上限。超了就返回 429，需要客户端学会放慢与排队", where: "推理 API 与流式输出 · 第 5 讲" },
        { t: "prefill（预填充）", en: "prefill", d: "推理的第一阶段：把整段提示一次喂进模型、算好每层状态并缓存。算力受限，所以很快", where: "预训练与推理 · 第 7 讲" },
        { t: "decode（解码）", en: "decode", d: "推理的第二阶段：每次只生成一个词元，把它接到末尾再预测下一个。带宽受限，所以慢", where: "预训练与推理 · 第 7 讲" },
        { t: "KV cache（键值缓存）", en: "KV cache", d: "推理时把每层已算过的键与值存下来，下一步只算增量、不重算前面。它随上下文长度线性增长，是长上下文的第一道显存墙", where: "预训练与推理 · 第 6 讲" },
        { t: "GQA（分组查询注意力）", en: "Grouped-Query Attention", d: "让多个查询头共享同一组键值头。KV 头数从 32 减到 8，KV cache 就只剩四分之一，是省显存最划算的改动之一", where: "注意力与 Transformer · 第 9 讲" }
      ]
    },
    {
      cat: "注意力与训练细节",
      items: [
        { t: "因果掩码（causal mask）", en: "causal mask", d: "把「当前位置之后」的分数改成负无穷，让每个位置只能看到自己和前面的内容。生成式模型必须靠它，否则就是训练时偷看答案", where: "注意力与 Transformer · 第 8 讲" },
        { t: "层归一化（LayerNorm）", en: "layer normalization", d: "在单个位置内部对全部特征做标准化（均值 0、标准差 1），再乘可学习的缩放与偏移。让深层网络数值稳定", where: "注意力与 Transformer · 第 7 讲" },
        { t: "残差连接（residual connection）", en: "residual connection", d: "把某一层的输入直接加回它的输出。给梯度留一条系数为 1 的直通通路，深层网络才训得起来", where: "注意力与 Transformer · 第 7 讲" },
        { t: "位置编码（positional encoding）", en: "positional encoding", d: "给每个位置加一组能区分先后的数（正弦公式或可学习的向量），否则注意力对词序视而不见", where: "注意力与 Transformer · 第 6 讲" },
        { t: "多头注意力（multi-head attention）", en: "multi-head attention", d: "并行做 h 份注意力、各自用不同投影，再把结果拼起来。必须满足 h × 每头维度 = 模型维度", where: "注意力与 Transformer · 第 4~5 讲" },
        { t: "反向传播（backpropagation）", en: "backpropagation", d: "从损失出发、沿计算图从后往前一层层算出每个参数梯度的方法，核心是链式法则", where: "神经网络 · 第 5 讲" },
        { t: "学习率（learning rate）", en: "learning rate", d: "每次更新参数走多远的那一步长度。太小收敛极慢，太大会发散，看损失曲线的形状就能判断", where: "神经网络 · 第 7 讲" },
        { t: "批大小（batch size）", en: "batch size", d: "每更新一次参数用多少个样本来算梯度。批越大方向越稳、但一次要算更多样本", where: "神经网络 · 第 7 讲" },
        { t: "BPE（字节对编码）", en: "Byte Pair Encoding", d: "一种分词算法：从每个字符一个词元开始，反复把出现频率最高的相邻对合并成新词元", where: "Tokenizer 与词表 · 第 3 讲" },
        { t: "词表（vocabulary）", en: "vocabulary", d: "模型认识的全部词元及其编号。词表大小与序列长度是一对此消彼长的杠杆", where: "Tokenizer 与词表 · 第 2 讲" },
        { t: "自回归（autoregressive）", en: "autoregressive", d: "每次生成一个词元、把它接到末尾再预测下一个的生成方式。因为依赖前文，所以只能逐词进行", where: "预训练与推理 · 第 4 讲" },
        { t: "困惑度（perplexity）", en: "cross-entropy 的指数形式", d: "可理解为「模型在每个位置平均要在多少个候选里犹豫」。越低越好，是预训练最常用的指标", where: "预训练与推理 · 第 1 讲" }      ]
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
