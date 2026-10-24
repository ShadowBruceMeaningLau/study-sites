# 偏好数据的结构与「成对比较」评测（纯标准库，可直接运行）

# 一条偏好样本只要三段：问题、被选中的回答、被拒绝的回答
PREF = [
    {'id': 'p1',
     'prompt': '依赖装不上，报错说版本冲突',
     'chosen': '结论：把工具版本升到 2 以上，报错里点名了版本区间。',
     'rejected': '可能是环境问题，建议你多试几次，原因比较多。'},
    {'id': 'p2',
     'prompt': '这段脚本为什么慢',
     'chosen': '第一步先看循环，把重复的读取挪到循环外。',
     'rejected': '性能问题比较玄，建议你多试几次，可能是机器原因。'},
    {'id': 'p3',
     'prompt': '这个报错要不要重装环境',
     'chosen': '先别重装，把报错里的版本号对一遍，结论是改版本就够。',
     'rejected': '可能是版本，也可能是环境，多试几次总能好。'},
    {'id': 'p4',
     'prompt': '文档里这个参数怎么填',
     'chosen': '填 1 到 8 之间的整数。',
     'rejected': '这个参数比较灵活，建议你多试几次，可能是 1 到 8。'}
]

# 裁判 A 的打分细则：数具体线索，扣模糊词。真实项目里这里是人或一个更强的模型
CONCRETE = ('结论', '第一步', '范围', '整数', '版本')
VAGUE = ('可能', '建议你', '多试', '比较')


def score(answer):
    return sum(answer.count(k) for k in CONCRETE) - 2 * sum(answer.count(k) for k in VAGUE)


def judge(a, b):
    """返回 1 表示 a 更好，-1 表示 b 更好，0 表示平局。"""
    if score(a) == score(b):
        return 0
    return 1 if score(a) > score(b) else -1


print('== 1. 一条偏好样本的字段 ==')
for k, v in PREF[0].items():
    print('  ', k, '->', v)

print()
print('== 2. 每条样本的得分差（训练时盯的就是这个差）==')
for s in PREF:
    sc, sr = score(s['chosen']), score(s['rejected'])
    print('  ', s['id'], 'chosen', sc, 'rejected', sr, 'margin', sc - sr)

print()
print('== 3. 成对比较：好答案放前面、放后面各判一次，看两次是否互洽 ==')
win = 0
for s in PREF:
    a = judge(s['chosen'], s['rejected'])
    b = judge(s['rejected'], s['chosen'])
    if a == 1:
        win += 1
    print('  ', s['id'], '好答案在前:', a, ' 好答案在后:', b, ' 互洽:', a == -b)
print('   裁判 A 的胜率:', round(100.0 * win / len(PREF), 1), '%')

print()
print('== 4. 换一个「谁更长谁赢」的裁判 B，同一批数据 ==')
win_b = 0
for s in PREF:
    longer_is_chosen = len(s['chosen']) > len(s['rejected'])
    pick = s['chosen'] if longer_is_chosen else s['rejected']
    ok = pick == s['chosen']
    if ok:
        win_b += 1
    else:
        print('  ', s['id'], '判错：好答案', len(s['chosen']), '字，差答案', len(s['rejected']), '字')
print('   裁判 B 的胜率:', round(100.0 * win_b / len(PREF), 1), '%')

print()
print('== 5. 结论 ==')
print('   同一批数据、同一批好答案，换个裁判胜率就变了。')
print('   所以「胜率」必须和「用哪个裁判、哪种顺序」一起报告，单独一个数字不可信。')
