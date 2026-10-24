# 评测骨架：固定的问题集、两个口径、拒答题单独统计
import math

DOCS = {
    'd1': '差旅报销需要在出差结束后十个工作日内提交发票，逾期需要部门负责人签字说明。',
    'd2': '年假按工龄计算：满一年不满十年每年五天。',
    'd4': '出差住宿标准：一线城市每晚不超过六百元，其他城市不超过四百元。',
}
EMB = {'d1': [1.0, 0.0, 0.0], 'd2': [0.0, 1.0, 0.0], 'd4': [0.3, 0.0, 0.1]}

# 每条：问题、标准答案、允许的出处、问题向量
CASES = [
    ('出差回来多久之内要交发票？', '十个工作日', {'d1'}, [1.0, 0.0, 0.0]),
    ('年假有多少天？', '五天', {'d2'}, [0.0, 1.0, 0.0]),
    ('一线城市住宿能报多少？', '六百元', {'d4'}, [0.3, 0.0, 0.1]),
    ('员工每年有多少天带薪病假？', '资料里没有提到', set(), [0.0, 0.0, 1.0]),
]


def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


ret_hit = 0
refuse_ok = 0
n_with_answer = 0
for question, gold, cite, qvec in CASES:
    ranked = sorted(DOCS, key=lambda d: -cosine(qvec, EMB[d]))
    top = ranked[:2]
    if cite:
        n_with_answer += 1
        if cite & set(top):
            ret_hit += 1
        print(question, '| 前三：', [(d, round(cosine(qvec, EMB[d]), 3)) for d in ranked[:3]])
    else:
        # 资料里没有答案：看检索最高分是否过低（阈值就是拒答的第一道闸）
        best = cosine(qvec, EMB[ranked[0]])
        refuse_ok += 1 if best < 0.2 else 0
        print(question, '| 最高分 %.3f，是否该拒答：%s' % (best, '是' if best < 0.2 else '否'))

print()
print('检索命中率@2 = %d/%d = %.0f%%' % (ret_hit, n_with_answer, ret_hit / n_with_answer * 100))
print('无答案问题的阈值拒答 = %d/1' % refuse_ok)
print('样本数：', len(CASES), '条（其中无答案 1 条）')