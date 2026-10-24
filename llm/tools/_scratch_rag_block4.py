# 混合检索：向量分与关键词分各自归一化后加权
import math

Q = [0.9, 0.0, 0.05, 0.0]
EMB = {
    'd1': [1.0, 0.0, 0.0, 0.0],
    'd5': [0.9, 0.1, 0.0, 0.0],
    'd7': [0.55, 0.0, 0.0, 0.5],
}
TEXT = {
    'd1': '差旅报销需要在出差结束后十个工作日内提交发票。',
    'd5': '病假需要提供医院证明。',
    'd7': '报销发票抬头必须是公司全称，税号写错会被财务退回。',
}
QUERY = '发票抬头写错怎么办'


def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


def bigrams(s):
    return {s[i:i + 2] for i in range(len(s) - 1)}


def keyword_score(q, text):
    qb = bigrams(q)
    return len(qb & bigrams(text)) / len(qb) if qb else 0.0


vec = {d: cosine(Q, v) for d, v in EMB.items()}
kw = {d: keyword_score(QUERY, t) for d, t in TEXT.items()}
vmax, kmax = max(vec.values()), max(kw.values())

print('纯向量排序：', sorted(vec, key=lambda d: -vec[d]))
print('纯关键词排序：', sorted(kw, key=lambda d: -kw[d]))

fused = {d: 0.6 * (vec[d] / vmax) + 0.4 * (kw[d] / kmax) for d in EMB}
for d in sorted(fused, key=lambda d: -fused[d]):
    print('%s 向量 %.4f -> %.4f | 关键词 %.4f -> %.4f | 融合 %.4f'
          % (d, vec[d], vec[d] / vmax, kw[d], kw[d] / kmax, fused[d]))
print('融合排序：', sorted(fused, key=lambda d: -fused[d]))

# RRF：只看名次，不看分数本身，所以不用归一化
v_rank = sorted(vec, key=lambda d: -vec[d])
k_rank = sorted(kw, key=lambda d: -kw[d])
rrf = {}
for r, d in enumerate(v_rank, 1):
    rrf[d] = rrf.get(d, 0) + 1.0 / (60 + r)
for r, d in enumerate(k_rank, 1):
    rrf[d] = rrf.get(d, 0) + 1.0 / (60 + r)
print('RRF 排序：', sorted(rrf, key=lambda d: -rrf[d]))