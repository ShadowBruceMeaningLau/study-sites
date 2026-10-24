# -*- coding: utf-8 -*-
# rag-5 最终口径：归一化加权融合 0.6 * 向量 + 0.4 * 关键词，能手算、能核对
import math

OUT = "tools/_scratch_rag_hybrid.out"
lines = []


def cos(a, b):
    d = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return d / (na * nb) if na and nb else 0.0


QUERY = "发票抬头写错怎么办"
Q = [0.9, 0.0, 0.05, 0.0]
EMB = {
    "d1": [1.0, 0.0, 0.0, 0.0],
    "d5": [0.9, 0.1, 0.0, 0.0],
    "d7": [0.55, 0.0, 0.0, 0.5],
}
TEXT = {
    "d1": "差旅报销需要在出差结束后十个工作日内提交发票，逾期需要部门负责人签字说明。",
    "d5": "病假需要提供医院证明，连续超过三天需要人事部门备案。",
    "d7": "报销发票抬头必须是公司全称，税号写错会被财务退回。",
}


def bigrams(s):
    return {s[i:i + 2] for i in range(len(s) - 1)}


def kw(q, t):
    qb, tb = bigrams(q), bigrams(t)
    return len(qb & tb) / len(qb) if qb else 0.0


vec = {k: cos(Q, EMB[k]) for k in EMB}
kws = {k: kw(QUERY, TEXT[k]) for k in TEXT}
vmax, kmax = max(vec.values()), max(kws.values())
lines.append("查询：%s" % QUERY)
lines.append("qemb = %s" % Q)
lines.append("")
for k in EMB:
    lines.append("%s  向量余弦 %.4f  归一化 %.4f | 关键词命中率 %.4f  归一化 %.4f"
                 % (k, vec[k], vec[k] / vmax, kws[k], (kws[k] / kmax) if kmax else 0))
lines.append("")
hy = {k: 0.6 * (vec[k] / vmax) + 0.4 * (kws[k] / kmax if kmax else 0) for k in EMB}
for k in sorted(hy, key=lambda k: -hy[k]):
    lines.append("%s 融合分 = 0.6 * %.4f + 0.4 * %.4f = %.4f"
                 % (k, vec[k] / vmax, (kws[k] / kmax if kmax else 0), hy[k]))
lines.append("融合排序：%s" % sorted(hy, key=lambda k: -hy[k]))
lines.append("纯向量排序：%s" % sorted(vec, key=lambda k: -vec[k]))
lines.append("纯关键词排序：%s" % sorted(kws, key=lambda k: -kws[k]))

open(OUT, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("done", OUT)
