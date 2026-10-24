# -*- coding: utf-8 -*-
# 为 rag-4 / rag-5 / rag-7 / rag-8 各设计一组玩具向量，算准余弦排序
import math

OUT = "tools/_scratch_rag_labs2.out"
lines = []


def cos(a, b):
    d = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return d / (na * nb) if na and nb else 0.0


def show(tag, q, emb):
    lines.append("=== " + tag + " ===")
    lines.append("  qemb = %s" % q)
    rank = sorted(emb, key=lambda k: -cos(q, emb[k]))
    for k in rank:
        lines.append("  %s %-22s 余弦=%.4f" % (k, emb[k], cos(q, emb[k])))
    lines.append("  排序：%s" % rank)
    lines.append("")


# rag-4：top-k 与命中率@1 / @3 的区别（向量把 d5 排到了 d7 前面）
show("rag-4 失败检索：问「发票抬头写错怎么办」",
     [0.9, 0.0, 0.05, 0.0],
     {
         "d1": [1.0, 0.0, 0.0, 0.1],
         "d2": [0.0, 1.0, 0.0, 0.0],
         "d5": [0.95, 0.05, 0.0, 0.0],
         "d7": [0.3, 0.0, 0.0, 0.9],
     })

# rag-5：混合检索把 d7 拉回第一（关键词命中「发票」「抬头」）
show("rag-5 混合检索：同一个问题，关键词把 d7 拉到第一",
     [0.9, 0.0, 0.05, 0.0],
     {
         "d1": [1.0, 0.0, 0.0, 0.0],
         "d5": [0.9, 0.1, 0.0, 0.0],
         "d7": [0.55, 0.0, 0.0, 0.5],
     })

# rag-8：切坏了 —— 一块里混了两个主题
show("rag-8 切坏了：块里混了两个主题，查询被无关内容带偏",
     [0.7, 0.7, 0.0],
     {
         "c1": [1.0, 0.0, 0.0],       # 只讲报销时限
         "c2": [0.6, 0.6, 0.6],       # 报销 + 食堂混在一块
         "c3": [0.0, 1.0, 0.0],       # 只讲年假
     })

# rag-3：手算那个 3 维例子（课上要能手算）
lines.append("=== rag-3 手算用的 3 维向量 ===")
a = [2, 1, 0]
b = [1, 2, 1]
d = sum(x * y for x, y in zip(a, b))
na = math.sqrt(sum(x * x for x in a))
nb = math.sqrt(sum(y * y for y in b))
lines.append("  a=%s b=%s" % (a, b))
lines.append("  点积=%d  |a|=%.4f  |b|=%.4f  余弦=%.4f" % (d, na, nb, d / (na * nb)))

open(OUT, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("done", OUT)
