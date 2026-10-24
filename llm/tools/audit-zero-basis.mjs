#!/usr/bin/env node
/**
 * 零基础友好度审计器
 * 检查每门课的每个 concept/analogy 块是否"先解释后使用"：
 *   1) 收集"高危术语"（微积分/线代/专业词），检查首次出现时附近 120 字内是否有解释标记
 *      （即/是指/称为/叫做/记作/意思是/也就是说/读作/（英文）/"是一种"/定义）
 *   2) 输出每门课的"未解释术语命中数"，并按严重度排序
 * 用法：node <site>/tools/audit-zero-basis.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(SITE, "data");

/** 高危术语表：零基础读者很可能第一次见（LLM / Harness / Agent 版） */
const RISKY = [
  // LLM 核心概念
  "token", "词元", "分词器", "词表", "BPE", "嵌入", "embedding", "上下文窗口", "上下文长度", "温度", "采样",
  "logits", "softmax", "概率分布", "top-k", "top-p", "KV cache", "自回归", "解码", "生成",
  // 神经网络与训练
  "神经网络", "感知机", "多层感知机", "MLP", "激活函数", "损失函数", "梯度", "反向传播", "学习率", "过拟合",
  "欠拟合", "正则化", "dropout", "批次", "epoch", "优化器", "权重", "参数", "前向传播", "训练集", "验证集",
  // 注意力与 Transformer
  "注意力", "self-attention", "自注意力", "QKV", "多头注意力", "位置编码", "残差连接", "层归一化",
  "前馈网络", "掩码", "Transformer", "编码器", "解码器",
  // 训练范式与对齐
  "预训练", "微调", "SFT", "RLHF", "RLVR", "GRPO", "强化学习", "奖励模型", "偏好对齐", "提示学习",
  "few-shot", "zero-shot", "思维链", "推理模型", "测试时计算", "scaling law", "MoE", "专家混合", "量化",
  "LoRA", "GGUF", "稀疏注意力", "线性注意力", "多 token 预测", "多模态",
  // 部署与工程
  "Ollama", "推理", "推理服务器", "API", "OpenAI 兼容", "流式输出", "SSE", "吞吐", "延迟", "显存", "GPU",
  // Harness 与 Agent
  "harness", "智能体", "agent", "工具调用", "函数调用", "ReAct", "规划", "多 agent", "记忆", "上下文管理",
  "RAG", "检索增强", "向量检索", "嵌入模型", "重排", "切分", "chunk", "评测", "基准", "打分器",
  "MCP", "A2A", "ACP", "AG-UI", "UHP", "协议", "沙箱", "提示词", "prompt", "结构化输出", "JSON Schema"
];

/**
 * 误报过滤：有些词是常用词的一部分，不能算"用了专业术语却没解释"。
 * 例：注意力的「注意」、基础模型的「基」、采样率的「采样」。
 */
const FALSE_POSITIVE = [
  { term: "基", next: /^(本|础|金|因|地|准|于|层|数|建|线)/ },
  { term: "采样", next: /^(率|点|频率)/ },
  { term: "推理", next: /^(小说|剧|出)/ },
  { term: "注意", next: /^(力|到|事项)/ },
  { term: "温度", next: /^(计|传感器|差)/ },
  { term: "梯度", next: /^(下降法|的|向量)/ },
  { term: "记忆", next: /^(力|犹新|术|里)/ },
  { term: "规划", next: /^(局|书|师)/ },
  { term: "协议", next: /^(书|栈)/ },
  { term: "掩码", next: /^(在|的|矩阵)/ },
  { term: "权重", next: /^(级|和)/ },
  { term: "提示", next: /^(符|框|信息)/ },
  { term: "评测", next: /^(机构|结果)/ },
  { term: "参数", next: /^(表|设置)/ },
  { term: "栈", next: /^(道|桥)/ },
  { term: "损失", next: /^(惨重|了)/ }
];

/** 该次出现是否算"真术语"（排除常用词误报） */
function isRealTerm(text, idx, term) {
  const after = text.slice(idx + term.length, idx + term.length + 4);
  for (const fp of FALSE_POSITIVE) {
    if (fp.term !== term) continue;
    if (fp.next && fp.next.test(after)) return false;
  }
  return true;
}

const EXPLAIN_MARK = /(即|是指|称为|叫做|记作|意思是|也就是说|读作|又称|是一种|定义为|定义为：|解释|通俗|直观地说|简单说|所谓|指的是|（[A-Za-z][^）]{1,30}）|\([A-Za-z][^)]{1,30}\))/;

const packs = [];
for (const f of readdirSync(DATA).filter((x) => x.endsWith(".js")).sort()) {
  const arr = [];
  try { new Function("window", "globalThis", readFileSync(join(DATA, f), "utf8") + ";")({ COURSE_PACKS: arr }, { COURSE_PACKS: arr }); }
  catch { continue; }
  arr.forEach((c) => packs.push({ file: f, course: c }));
}

const rows = [];
let grandTotal = 0;
let grandLazy = 0;
for (const { file, course } of packs) {
  const seen = new Set();
  let lazy = 0;                    // 概念块里"用了却没在本块解释"的术语
  let firstUnclear = 0;            // 首次出现时所在块没有解释
  const detail = [];
  for (const l of course.lessons ?? []) {
    for (const b of l.blocks ?? []) {
      const text = [b.md, b.title, b.note, (b.items || []).map((i) => (typeof i === "string" ? i : (i.t || "") + (i.d || ""))).join(" ")].filter(Boolean).join(" ");
      if (!text) continue;
      const blockExplains = EXPLAIN_MARK.test(text);
      for (const t of RISKY) {
        if (!text.includes(t)) continue;
        if (!isRealTerm(text, text.indexOf(t), t)) continue;
        const first = !seen.has(t);
        if (first) {
          seen.add(t);
          if (!blockExplains) {
            firstUnclear++;
            if (detail.length < 6) detail.push({ t, lesson: l.title, ctx: text.slice(Math.max(0, text.indexOf(t) - 30), text.indexOf(t) + 55).replace(/\n/g, " ") });
          }
        }
        // 之后再次出现在 concept 块里、而该块没有任何解释标记 → 记为"假设已懂"
        if (!first && b.type === "concept" && !blockExplains) lazy++;
      }
    }
  }
  grandTotal += firstUnclear;
  grandLazy += lazy;
  rows.push({ id: course.id, title: course.title, term: course.term || "", hits: firstUnclear, lazy, total: seen.size, detail });
}

rows.sort((a, b) => (b.hits + b.lazy) - (a.hits + a.lazy));
console.log("=== 零基础友好度审计 ===");
console.log("课程".padEnd(26) + "术语数".padStart(7) + "首现未解释".padStart(11) + "后续仅使用".padStart(11) + "  学期");
for (const r of rows) {
  const name = r.title.length > 22 ? r.title.slice(0, 22) + "…" : r.title;
  console.log(name.padEnd(26) + String(r.total).padStart(7) + String(r.hits).padStart(11) + String(r.lazy).padStart(11) + "  " + r.term);
}
console.log("\n合计：首现未解释 " + grandTotal + " 处；后续「假设已懂」" + grandLazy + " 处（涉及 " + rows.filter((r) => r.hits + r.lazy > 0).length + " 门课）");
console.log("\n=== 最严重的 5 门课的前几处 ===");
rows.slice(0, 5).forEach((r) => {
  if (!r.hits && !r.lazy) return;
  console.log("【" + r.title + "】首现未解释 " + r.hits + " / 后续仅使用 " + r.lazy + "，例如：");
  r.detail.slice(0, 3).forEach((d) => console.log("   · " + d.t + "（" + d.lesson.slice(0, 18) + "）：…" + d.ctx + "…"));
});
