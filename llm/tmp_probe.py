import math
PREF = [
    {'id': 'p1',
     'prompt': '这个依赖报错怎么修',
     'chosen': '先说结论：缺的是依赖版本，把工具版本升到 2 以上，再跑一次。',
     'rejected': '这个情况比较复杂，可能是环境问题，也可能是配置问题，你可以多试几次。'},
    {'id': 'p2',
     'prompt': '这段脚本为什么慢',
     'chosen': '第一步看参数：把循环里那次重复读取挪到循环外，耗时能降下来。',
     'rejected': '性能问题原因很多，建议你先优化一下代码结构，应该会快一些。'},
    {'id': 'p3',
     'prompt': '这个报错要不要重装',
     'chosen': '先别重装：按报错信息定位到版本不匹配，改版本号就够了。',
     'rejected': '版本、参数、报错、结论这些都要考虑，第一步先看版本。'}
]
KEYWORDS = ('结论', '版本', '第一步', '参数', '报错')

def stub_logprob(answer):
    hits = sum(answer.count(k) for k in KEYWORDS)
    verbose = len(answer) // 12
    return round(0.8 * hits - 0.6 * verbose - 5.0, 3)

for s in PREF:
    print(s['id'], 'chosen', stub_logprob(s['chosen']), 'rejected', stub_logprob(s['rejected']), 'lens', len(s['chosen']), len(s['rejected']))
