# -*- coding: utf-8 -*-
# 核对：ragsteps 渲染器只读 cfg.emb[docId]，所以每个 stage 的 config 都得让 docs 与 emb 一致
# 顺带确认 4 段文档在 chunkSize=120 下各是几块、检索展示哪些 id
OUT = "tools/_scratch_rag_stepcfg.out"
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
        if cur and len(cur + s) > sz:
            chunks.append(cur)
            cur = s
        else:
            cur += s
    if cur:
        chunks.append(cur)
    return chunks


def cos(a, b):
    d = sum(x * y for x, y in zip(a, b))
    na = sum(x * x for x in a) ** 0.5
    nb = sum(y * y for y in b) ** 0.5
    return d / (na * nb) if na and nb else 0.0


DOCS = [
    ("d1", "差旅报销需要在出差结束后十个工作日内提交发票，逾期需要部门负责人签字说明。"),
    ("d2", "年假按工龄计算：满一年不满十年每年五天，满十年不满二十年每年十天。"),
    ("d3", "公司食堂每周三提供素食窗口，午餐时间为十一点半到十三点。"),
    ("d4", "出差住宿标准：一线城市每晚不超过六百元，其他城市不超过四百元。"),
    ("d5", "病假需要提供医院证明，连续超过三天需要人事部门备案。"),
    ("d7", "报销发票抬头必须是公司全称，税号写错会被财务退回。"),
]
lines.append("=== 每篇在 chunkSize=120 下的块数（题面文档都很短，基本各 1 块）===")
for did, text in DOCS:
    cs = chunk_text(text, 120)
    lines.append("  %s：%d 字 → %d 块" % (did, len(text), len(cs)))
    for c in cs:
        lines.append("       %d 字：%s" % (len(c), c))

Q4 = [0.9, 0.0, 0.05, 0.0]
EMB4 = {
    "d1": [1.0, 0.0, 0.0, 0.0],
    "d2": [0.0, 1.0, 0.0, 0.0],
    "d5": [0.9, 0.1, 0.0, 0.0],
    "d7": [0.55, 0.0, 0.0, 0.5],
}
lines.append("")
lines.append("=== rag-4：向量检索把 d7 排到最后（真答案不在前三）===")
for k in sorted(EMB4, key=lambda k: -cos(Q4, EMB4[k])):
    lines.append("  %s 余弦=%.4f" % (k, cos(Q4, EMB4[k])))

Q8 = [0.7, 0.7, 0.0]
EMB8 = {
    "d1": [1.0, 0.0, 0.0],
    "d2": [0.0, 1.0, 0.0],
    "d7": [0.6, 0.6, 0.6],
}
lines.append("")
lines.append("=== rag-8：切坏了——一块里混了两个主题，排序被带偏 ===")
for k in sorted(EMB8, key=lambda k: -cos(Q8, EMB8[k])):
    lines.append("  %s 余弦=%.4f" % (k, cos(Q8, EMB8[k])))

open(OUT, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("done", OUT)
