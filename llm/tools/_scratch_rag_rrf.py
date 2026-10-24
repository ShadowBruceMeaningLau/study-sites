# -*- coding: utf-8 -*-
# rag-5 混合检索：设计一组玩具向量 + 关键词排名，算准 RRF 融合后的顺序
import math

OUT = "tools/_scratch_rag_rrf.out"
lines = []


def cos(a, b):
    d = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return d / (na * nb) if na and nb else 0.0


Q = [0.9, 0.0, 0.05, 0.0]
EMB = {
    "d1": [1.0, 0.0, 0.0, 0.0],      # 差旅报销（时限）
    "d2": [0.0, 1.0, 0.0, 0.0],      # 年假
    "d5": [0.9, 0.1, 0.0, 0.0],      # 病假
    "d7": [0.55, 0.0, 0.0, 0.5],     # 发票抬头（真正答案）
    "d8": [0.0, 0.0, 1.0, 0.0],      # 食堂
}
lines.append("=== 向量排序 ===")
v_rank = sorted(EMB, key=lambda k: -cos(Q, EMB[k]))
for k in v_rank:
    lines.append("  %s 余弦=%.4f" % (k, cos(Q, EMB[k])))
lines.append("  排序：%s" % v_rank)

# 关键词排名：查询是「发票抬头写错怎么办？」，按二元组命中率
QUERY = "发票抬头写错怎么办"
KWTEXT = {
    "d1": "差旅报销需要在出差结束后十个工作日内提交发票，逾期需要部门负责人签字说明。",
    "d2": "年假按工龄计算：满一年不满十年每年五天，满十年不满二十年每年十天。",
    "d5": "病假需要提供医院证明，连续超过三天需要人事部门备案。",
    "d7": "报销发票抬头必须是公司全称，税号写错会被财务退回。",
    "d8": "食堂充值卡可以在行政前台办理，每次充值最低一百元。",
}


def bigrams(s):
    return {s[i:i + 2] for i in range(len(s) - 1)}


def kw(q, t):
    qb, tb = bigrams(q), bigrams(t)
    return len(qb & tb) / len(qb) if qb else 0.0


lines.append("")
lines.append("=== 关键词排序（二元组命中率）===")
k_rank = sorted(KWTEXT, key=lambda k: -kw(QUERY, KWTEXT[k]))
for k in k_rank:
    lines.append("  %s 命中率=%.4f" % (k, kw(QUERY, KWTEXT[k])))
lines.append("  排序：%s" % k_rank)

lines.append("")
lines.append("=== RRF 融合（k=60）===")
rrf = {}
for r, k in enumerate(v_rank, 1):
    rrf[k] = rrf.get(k, 0) + 1.0 / (60 + r)
for r, k in enumerate(k_rank, 1):
    rrf[k] = rrf.get(k, 0) + 1.0 / (60 + r)
for k in sorted(rrf, key=lambda k: -rrf[k]):
    lines.append("  %s 分数=%.6f" % (k, rrf[k]))
lines.append("  排序：%s" % sorted(rrf, key=lambda k: -rrf[k]))

open(OUT, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("done", OUT)
