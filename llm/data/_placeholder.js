/* ==========================================================================
   _placeholder.js —— W0 脚手架占位课（W1 交付真实课程时删除）
   作用：让 validate-curriculum / smoke-test 在内容交付前就能跑起来。
   格式契约：CONTENT-SPEC.md（UTF-8 无 BOM，只有一条 window.COURSE_PACKS.push）。
   ========================================================================== */
window.COURSE_PACKS.push({
  id: "_placeholder",
  title: "建设中：课程即将交付",
  icon: "🚧",
  term: "主线 A · LLM 基础与原理",
  hours: 8,
  blurb: "W0 脚手架占位课，仅用于让质量门在内容交付前跑通；W1 交付《LLM 零基础入门》后删除本文件。",
  tags: ["占位"],
  need: "零基础可学：本课只是占位符，不承载任何内容。",
  lessons: [
    {
      id: "ph-placeholder-1",
      title: "占位讲 1：质量门自检",
      goal: "确认站点引擎与全部质量门在无内容状态下工作正常。",
      est: 5,
      blocks: [
        {
          type: "concept",
          title: "为什么先放一个占位课",
          md: "校验器要求 data/ 下至少有一门课。本占位课让 W0 的 validate / smoke-test / audit 全家都能跑起来，真正的课程内容从 W1 开始按波次交付。"
        },
        {
          type: "interactive",
          lab: "datalab",
          title: "实验台：引擎自检",
          config: {
            state: { "状态": "待检查" },
            steps: [
              { desc: "第 1 步：打开本页即说明路由正常", state: { "状态": "路由 OK" }, note: "渲染引擎工作正常" },
              { desc: "第 2 步：本实验可单步即说明 datalab 正常", state: { "状态": "datalab OK" }, note: "交互组件工作正常" },
              { desc: "第 3 步：做完随堂测验即说明判分正常", state: { "状态": "quiz OK" }, note: "测验组件工作正常" },
              { desc: "第 4 步：右上角导出数据即说明进度正常", state: { "状态": "progress OK" }, note: "进度组件工作正常" }
            ]
          }
        },
        {
          type: "pitfall",
          title: "交付前必须保持全绿的三件事",
          items: [
            "validate-curriculum.mjs 零错误（结构、答案索引、实验 config 全部合法）",
            "audit-independence.mjs 与 audit-prereqs.mjs 零错误（正文零跨课指引、need 引用全部可解析）",
            "smoke-test.mjs 与 --fixture 全过（引擎渲染与错题本流程）"
          ]
        }
      ],
      quiz: [
        {
          id: "ph-placeholder-1-q1",
          type: "single",
          q: "这个占位课的作用是什么？",
          options: ["承载正式课程内容", "让质量门在内容交付前跑通", "给学员练习用", "测试手机同步"],
          answer: 1,
          why: "占位课只做一件事：让 validate / smoke-test / audit 在 W0 就能运行。正式内容从 W1 开始交付，其余选项都是它不做的事。"
        },
        {
          id: "ph-placeholder-1-q2",
          type: "single",
          q: "学习进度存在哪里？",
          options: ["云端服务器", "浏览器 localStorage（键 llm-learn:v1）", "课程文件里", "内存里，关页即丢"],
          answer: 1,
          why: "本站零依赖：进度第一落点是浏览器 localStorage（键 llm-learn:v1），通过本地服务器打开时再同步到 .progress/。其余选项与实现不符。"
        }
      ]
    },
    {
      id: "ph-placeholder-2",
      title: "占位讲 2：目录契约自检",
      goal: "确认 CONTENT-SPEC 的字段契约（need/est/goal/why）已被校验器执行。",
      est: 5,
      blocks: [
        {
          type: "concept",
          title: "校验器会盯住哪些字段",
          md: "每门课必须有 need（前置声明）、每小时课必须有 goal（可检验目标）与 est（25~50 分钟）、每题必须有 why（为什么对 + 干扰项错在哪）。这些规则写在 CONTENT-SPEC.md 里，由 validate-curriculum.mjs 强制执行。"
        },
        {
          type: "pitfall",
          title: "写课程时最容易踩的三个坑",
          items: [
            "need 引用了站内不存在的课 → audit-prereqs.mjs 判失败（引用必须能解析到真实课程）",
            "正文出现「见某课」或「前文已述」这类跨课指路与隐性回指写法 → audit-independence.mjs 判失败（课内前向指引要写成「不熟的话，先看第 N 讲」带逗号的形式）",
            "术语第一次出现没解释 → audit-zero-basis.mjs 列出「首现未解释」清单"
          ]
        },
        {
          type: "steps",
          title: "交付一门课的标准流程",
          items: [
            "1. 写 data/<slug>.js 并在 index.html 里加 <script> 行",
            "2. 跑 validate-curriculum.mjs 修到零错误",
            "3. 跑 audit-independence / audit-prereqs / audit-zero-basis 修到零错误",
            "4. 跑 smoke-test.mjs（含 --fixture）与 check-python.mjs 修到全绿"
          ]
        }
      ],
      quiz: [
        {
          id: "ph-placeholder-2-q1",
          type: "single",
          q: "need 字段里引用站内课程的正确写法是？",
          options: ["建议先学《数据结构》", "建议先学「Python 编程基础」", "先看 CS 站的数据结构", "随便写，没人检查"],
          answer: 1,
          why: "CONTENT-SPEC 约定：站内课名用「」，「」内必须能解析到真实课程；《》式写法会被独立性审计判定为跨课指引。"
        },
        {
          id: "ph-placeholder-2-q2",
          type: "single",
          q: "哪句话是允许的课内前向指引？",
          options: ["前面讲过 softmax，这里不再重复", "见《注意力与 Transformer》第 3 讲", "不熟的话，先看第 3 讲", "先去补 Python 课再回来"],
          answer: 2,
          why: "课内前向指引要写成「不熟的话，先看第 N 讲」（带逗号、指向同一门课）才合法；「前面讲过」是隐性回指、跨课与外部指路都违反独立性审计。"
        }
      ]
    },
    {
      id: "ph-placeholder-3",
      title: "占位讲 3：六类新实验预告（词元化/注意力/采样/RAG/智能体/协议）",
      goal: "知道 LLM 站将新增哪六类交互实验。",
      est: 5,
      blocks: [
        {
          type: "concept",
          title: "tokenlab / attnlab / samplab / ragsteps / agenttrace / protolab",
          md: "LLM 站将在 app/labs.js 里新增六类实验：\n\n- 「tokenlab」（词元化实验）——BPE 合并逐步执行：文本 → token → id → 解码回验\n- 「attnlab」（注意力权重实验）——Q/K/V 数值逐步算注意力矩阵与输出，权重热力显示\n- 「samplab」（采样策略实验）——真实 logits 上调 temperature / top-k / top-p 看分布与抽样\n- 「ragsteps」（检索增强生成实验）——切分 → 嵌入 → 检索 → 拼接 prompt 的分步演示\n- 「agenttrace」（智能体轨迹实验）——ReAct 循环逐步回放 Thought / Action / Observation 与终止条件\n- 「protolab」（协议生态实验）——UHP / MCP / A2A / ACP / AG-UI 角色连线图\n\n六类实验的共性：全部纯浏览器 JS 计算（即不依赖任何运行中的模型，也不需要联网调用外部 API）。"
        },
        {
          type: "calc",
          title: "手算演练：一次注意力打分的最小例子",
          inputs: [{ name: "查询向量 q", value: "[1, 0]" }, { name: "键向量 k1", value: "[1, 0]" }, { name: "键向量 k2", value: "[0, 1]" }],
          outputs: ["注意力权重：q·k1 = 1，q·k2 = 0；softmax（把一组分数转成加起来等于 1 的概率）后约为 [0.73, 0.27]（温度取 1，只归一化这两个数）"],
          note: "q·k1 = 1×1 + 0×0 = 1；q·k2 = 1×0 + 0×1 = 0。softmax 是指把一组分数转成加起来等于 1 的概率的操作，它把两个分数变成概率，正是 attnlab 要演示的核心步骤。"
        },
        {
          type: "steps",
          title: "六类实验的交付顺序",
          items: [
            "tokenlab 随《Tokenizer 与词表》交付（W2）",
            "attnlab 与 samplab 随《注意力与 Transformer》《预训练与推理》交付（W2/W3）",
            "agenttrace 与 protolab 随《Harness 解剖》《Agent 协议生态》交付（W4）",
            "ragsteps 随《RAG》交付（W5）"
          ]
        }
      ],
      quiz: [
        {
          id: "ph-placeholder-3-q1",
          type: "single",
          q: "哪类新实验演示「文本 → token → id → 解码回验」？",
          options: ["attnlab", "tokenlab", "samplab", "protolab"],
          answer: 1,
          why: "tokenlab 是 BPE 词元化实验：逐步执行合并规则，展示文本如何变成 token 与 id 再解码回来；attnlab 管注意力、samplab 管采样、protolab 管协议生态。"
        },
        {
          id: "ph-placeholder-3-q2",
          type: "multi",
          q: "关于六类新实验，哪些说法正确？",
          options: [
            "全部纯浏览器 JS 计算，不依赖运行中的模型",
            "必须联网调用 ChatGPT 才能用",
            "数据文件里只放 config，不允许函数",
            "需要先安装 PyTorch"
          ],
          answer: [0, 2],
          why: "六类实验全部在浏览器里计算（零环境依赖），课程数据沿用 config 驱动、禁函数的契约。选项 B、D 把实验描述成联网/装框架才能用，与零依赖底线相悖。"
        }
      ]
    }
  ]
});
