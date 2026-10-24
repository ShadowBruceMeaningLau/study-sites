# 定位脚本：先打印检回来的原文，再按三类失败给建议
DOCS = {
    'd1': '差旅报销需要在出差结束后十个工作日内提交发票，逾期需要部门负责人签字说明。',
    'd2': '年假按工龄计算：满一年不满十年每年五天。',
    'd7': '报销发票抬头必须是公司全称。公司食堂每周三提供素食窗口。',
}
TOP = ['d7', 'd1']        # 这次检索回来的前两块
ANSWER = '资料里没有提到'  # 模型这次的回答
GOLD = '十个工作日'        # 标准答案里的关键事实


def diagnose(top, answer, gold, docs):
    joined = ' '.join(docs[d] for d in top)
    if gold not in joined:
        return '检错了：材料里没有那句。改检索层（混合 / 重排 / 调 k / 加阈值）'
    if gold not in answer:
        if '没有提到' in answer:
            return '约束过硬：材料里有答案，但模型选择了拒答。检查「没有就说没有」这类规则'
        return '无视材料：材料里有答案，但回答没用上。加强引用要求并做事后核对'
    # 找到答案时，还要看块里有没有混进无关主题
    long_blocks = [d for d in top if len(docs[d]) > 45]
    if long_blocks:
        return '检索对了，但块偏长：' + str(long_blocks) + ' 可能混了多个主题，考虑改切分'
    return '这一层没问题'


print('检索回来的块：')
for d in TOP:
    print('  ', d, '（', len(DOCS[d]), '字）：', DOCS[d])
print()
print('诊断结果：', diagnose(TOP, ANSWER, GOLD, DOCS))

# 换几种情况再跑，看诊断会不会跟着变
for top, ans in [(['d1'], '十个工作日', ), (['d1'], '资料里没有提到', ), (['d7'], '十个工作日', )]:
    print(top, ans, '->', diagnose(top, ans, GOLD, DOCS))