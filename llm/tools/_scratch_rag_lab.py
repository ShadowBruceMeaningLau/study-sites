# -*- coding: utf-8 -*-
# 用与 app/labs.js 的 renderRagsteps 完全一致的算法，核对 ragsteps 实验里会显示的数字
import math

DOCS = [
    ("d1", "差旅报销需要在出差结束后十个工作日内提交发票，逾期需要部门负责人签字说明。"),
    ("d2", "年假按工龄计算：满一年不满十年每年五天，满十年不满二十年每年十天。"),
    ("d3", "公司食堂每周三提供素食窗口，午餐时间为十一点半到十三点。"),
    ("d4", "出差住宿标准：一线城市每晚不超过六百元，其他城市不超过四百元。"),
]


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
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return d / (na * nb) if na and nb else 0.0


lines = []
for size in (40, 60, 120):
    total = []
    for did, text in DOCS:
        cs = chunk_text(text, size)
        total.append((did, len(cs), [len(c) for c in cs]))
    lines.append("chunkSize=%d：共 %d 块；每篇 %s" % (size, sum(t[1] for t in total), total))

Q1 = [0.9, 0.1, 0.0, 0.3]
Q2 = [0.0, 0.1, 0.1, 0.0]
EMB = {
    "d1": [1.0, 0.0, 0.0, 0.2],
    "d2": [0.1, 1.0, 0.0, 0.0],
    "d3": [0.0, 0.0, 1.0, 0.0],
    "d4": [0.1, 0.0, 0.0, 1.0],
}
for tag, q in (("报销问题", Q1), ("住宿问题", Q2)):
    rank = sorted(((k, cos(q, v)) for k, v in EMB.items()), key=lambda kv: -kv[1])
    lines.append("%s q=%s 排序：%s" % (tag, q, [(k, round(s, 4)) for k, s in rank]))

# 评测视角那份 config：故意做出一次「检索错了」的排序
Q3 = [0.2, 0.0, 0.0, 0.2]   # 一个「发票抬头」的问题，玩具向量里根本没编码这个维度
EMB3 = {
    "d1": [1.0, 0.0, 0.0, 0.1],
    "d5": [0.9, 0.1, 0.0, 0.0],
    "d7": [0.3, 0.0, 0.0, 0.9],
    "d2": [0.0, 1.0, 0.0, 0.0],
}
rank = sorted(((k, cos(Q3, v)) for k, v in EMB3.items()), key=lambda kv: -kv[1])
lines.append("评测 config q=%s 排序：%s" % (Q3, [(k, round(s, 4)) for k, s in rank]))

open("tools/_scratch_rag_lab.out", "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("done")
