# 玩具向量检索：三条文档、一个问题，手算余弦并排序
import math

DOCS = {
    'd1': '差旅报销需要在出差结束后十个工作日内提交发票，逾期需要部门负责人签字说明。',
    'd2': '年假按工龄计算：满一年不满十年每年五天，满十年不满二十年每年十天。',
    'd3': '公司食堂每周三提供素食窗口，午餐时间为十一点半到十三点。',
}

# 玩具向量：第 0 维表示「报销/发票」，第 1 维表示「休假」，第 2 维表示「食堂」
EMB = {
    'd1': [1.0, 0.0, 0.0],
    'd2': [0.1, 1.0, 0.0],
    'd3': [0.0, 0.0, 1.0],
}
QUERY = '出差回来多久之内要交发票？'
QEMB = [1.0, 0.2, 0.0]      # 问题主要落在第 0 维，沾一点休假


def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


for did, vec in EMB.items():
    print(did, '余弦 = %.4f' % cosine(QEMB, vec), '|', DOCS[did])

ranked = sorted(EMB, key=lambda d: -cosine(QEMB, EMB[d]))
print('排序：', ranked)
print('第一名：', ranked[0])

# 手算那个例子的核对
a, b = [2, 1, 0], [1, 2, 1]
print('手算核对：a=', a, 'b=', b, '余弦 = %.4f' % cosine(a, b))