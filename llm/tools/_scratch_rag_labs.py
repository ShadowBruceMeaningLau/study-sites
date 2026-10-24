# -*- coding: utf-8 -*-
# 核对 ragsteps 实验 config：按 app/labs.js 的算法真算块数与余弦排序
import json
import math

OUT = "tools/_scratch_rag_labs.out"
lines = []


def split_sentences(t):
    out, buf = [], ""
    for ch in t:
        buf += ch
        if ch in "。！？；!?;\n":
            if buf.strip():
                out.append(buf.strip())
            buf = ""
    if buf.strip():
        out.append(buf.strip())
    return out


def chunk_text(t, sz):
    chunks, cur = [], ""
    for s in split_sentences(t):
        if cur and (cur + s).__len__() > sz:
            chunks.append(cur)
            cur = s
        else:
            cur += s
    if cur:
        chunks.append(cur)
    return chunks


def cos(a, b):
    d = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return d / (na * nb) if na and nb else 0.0


DOC_A = "差旅报销规定。员工出差前要在系统里提交出差申请，写明目的地、起止日期和预计费用。出差结束后十个工作日内提交报销。住宿标准按城市分级：一线城市每晚不超过六百元，其他城市每晚不超过四百元。发票抬头必须是公司全称。"
DOC_B = "年假规定。年假按工龄计算：满一年不满十年每年五天。满十年不满二十年每年十天。年假需要提前两周在系统里申请。"
DOC_C = "食堂通知。公司食堂每周三提供素食窗口。午餐时间为十一点半到十三点。充值卡在行政前台办理，每次最低一百元。"

for size in (30, 40, 50, 60, 90, 120):
    total = 0
    detail = []
    for did, text in (("d1", DOC_A), ("d2", DOC_B), ("d3", DOC_C)):
        cs = chunk_text(text, size)
        total += len(cs)
        detail.append((did, len(cs), [len(c) for c in cs]))
    lines.append("chunkSize=%2d：共 %d 块；%s" % (size, total, detail))

lines.append("")
lines.append("原文长度：d1=%d d2=%d d3=%d" % (len(DOC_A), len(DOC_B), len(DOC_C)))

# rag-2 的 config：一条长文档，60 字一块
lines.append("")
lines.append("=== rag-2：docs=[d1]，chunkSize=60 ===")
for c in chunk_text(DOC_A, 60):
    lines.append("  块 %d 字：%s" % (len(c), c))

# rag-3 的 config：手算余弦用的 4 维玩具向量
lines.append("")
lines.append("=== rag-3：qemb 与 emb（4 维玩具向量，余弦精确值）===")
CFG = {
    "query": "出差回来多久之内要交发票？",
    "qemb": [0.9, 0.1, 0.0, 0.3],
    "emb": {
        "d1": [1.0, 0.0, 0.0, 0.2],
        "d2": [0.1, 1.0, 0.0, 0.0],
        "d3": [0.0, 0.0, 1.0, 0.0],
        "d4": [0.1, 0.0, 0.0, 1.0],
    },
}
for k, v in CFG["emb"].items():
    lines.append("  %s %s  余弦=%.4f" % (k, v, cos(CFG["qemb"], v)))
rank = sorted(CFG["emb"], key=lambda k: -cos(CFG["qemb"], CFG["emb"][k]))
lines.append("  排序：%s" % rank)

# rag-4 的 config：故意做一次失败检索（发票抬头问题）
lines.append("")
lines.append("=== rag-4：qemb 对应「发票抬头写错怎么办」，向量检索排错 ===")
CFG4 = {
    "query": "发票抬头写错怎么办？",
    "qemb": [0.2, 0.0, 0.0, 0.2],
    "emb": {
        "d1": [1.0, 0.0, 0.0, 0.1],
        "d2": [0.0, 1.0, 0.0, 0.0],
        "d5": [0.9, 0.1, 0.0, 0.0],
        "d7": [0.3, 0.0, 0.0, 0.9],
    },
}
for k, v in CFG4["emb"].items():
    lines.append("  %s %s  余弦=%.4f" % (k, v, cos(CFG4["qemb"], v)))
rank4 = sorted(CFG4["emb"], key=lambda k: -cos(CFG4["qemb"], CFG4["emb"][k]))
lines.append("  排序：%s" % rank4)

# rag-6/7 的 config：两段材料拼进提示词
lines.append("")
lines.append("=== rag-6：检索到 d1、d4，拼进提示词 ===")
prompt = ("只根据资料回答，并标出依据。\n[d1] " + DOC_A + "\n[d4] 出差住宿标准：一线城市每晚不超过六百元，其他城市不超过四百元。\n问题：一线城市住宿能报多少？")
lines.append("  提示词 %d 字 / %d 字节" % (len(prompt), len(prompt.encode("utf-8"))))

open(OUT, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("done", OUT)
