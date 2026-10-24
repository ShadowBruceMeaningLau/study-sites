# -*- coding: utf-8 -*-
# rag-2 的 ragsteps 配置：按渲染器算法真算块数与余弦排序
import math

DOCS = [
    ("d1", "差旅报销要在出差结束后十个工作日内提交发票。发票抬头必须是公司全称。逾期提交需要部门负责人签字说明。"),
    ("d2", "年假按工龄计算：满一年不满十年每年五天。满十年不满二十年每年十天。满二十年每年十五天。"),
    ("d3", "公司食堂每周三提供素食窗口。午餐时间为十一点半到十三点。节假日不开放。"),
    ("d4", "出差住宿标准：一线城市每晚不超过六百元。其他城市每晚不超过四百元。超标部分需要自己承担。"),
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


print("=== rag-2 ragsteps：chunkSize=45 ===")
total = 0
for did, text in DOCS:
    cs = chunk_text(text, 45)
    total += len(cs)
    print("  ", did, "句子数", len(split_sentences(text)), "块数", len(cs), [len(c) for c in cs])
print("   合计", total, "块")
print("   四篇全文合计字数：", sum(len(t) for _, t in DOCS))

Q = [1, 0, 0]
EMB = {"d1": [1, 2, 0], "d2": [0, 3, 1], "d3": [0, 1, 3], "d4": [3, 1, 0]}
rank = sorted(((k, cos(Q, v)) for k, v in EMB.items()), key=lambda kv: -kv[1])
print("=== rag-2 检索排序 ===")
for k, s in rank:
    print("  ", k, "显示值", round(s, 3), "精确", round(s, 6))
