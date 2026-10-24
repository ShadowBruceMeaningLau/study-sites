# 40 行：检索、top-k、命中率@1 与 @3
import math

DOCS = {
    'd1': '差旅报销需要在出差结束后十个工作日内提交发票，逾期需要部门负责人签字说明。',
    'd2': '年假按工龄计算：满一年不满十年每年五天。',
    'd3': '公司食堂每周三提供素食窗口。',
    'd4': '出差住宿标准：一线城市每晚不超过六百元，其他城市不超过四百元。',
}
EMB = {
    'd1': [1.0, 0.0, 0.0],
    'd2': [0.0, 1.0, 0.0],
    'd3': [0.0, 0.0, 1.0],
    'd4': [0.3, 0.0, 0.1],
}
QUERIES = [
    ('出差回来多久之内要交发票？', 'd1', [1.0, 0.0, 0.0]),
    ('年假有多少天？', 'd2', [0.0, 1.0, 0.0]),
    ('一线城市住宿能报多少？', 'd4', [0.3, 0.0, 0.1]),
]


def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


def search(qvec, k):
    scored = [(did, cosine(qvec, vec)) for did, vec in EMB.items()]
    scored.sort(key=lambda x: -x[1])
    return scored[:k]


hit1 = hit3 = 0
for question, gold, qvec in QUERIES:
    top = search(qvec, 3)
    rank = [did for did, _ in top]
    hit1 += 1 if rank[0] == gold else 0
    hit3 += 1 if gold in rank else 0
    print(question)
    print('  前三：', [(d, round(s, 4)) for d, s in top], '| 标注：', gold)

n = len(QUERIES)
print('命中率@1 = %d/%d = %.0f%%' % (hit1, n, hit1 / n * 100))
print('命中率@3 = %d/%d = %.0f%%' % (hit3, n, hit3 / n * 100))

# top-k 调大会提高召回，但精确率会掉
for k in (1, 2, 3):
    hits = 0
    for question, gold, qvec in QUERIES:
        hits += 1 if gold in [d for d, _ in search(qvec, k)] else 0
    print('top-%d：命中 %d/%d，精确率 %d/%d = %.2f' % (k, hits, n, hits, k * n, hits / (k * n)))