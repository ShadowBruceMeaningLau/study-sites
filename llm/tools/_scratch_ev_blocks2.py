# -*- coding: utf-8 -*-
"""最终版候选块：ev-3 改为不用正则（避免 JS 字符串里出现反斜杠）。"""

BLOCKS = {}

BLOCKS["ev3"] = '''# 三种打分器给同一批 10 条答案打分：精确匹配 / 相似度 / 固定评分表（代替裁判）
import difflib

PUNCT = "，。、；：！？「」（）()“”"


def norm(s):
    keep = []
    for ch in s:
        if ch.isspace():
            continue
        if ch in PUNCT:
            continue
        keep.append(ch.lower())
    return ''.join(keep)


def exact(g, c):
    return 1 if norm(g) == norm(c) else 0


def similar(g, c, thr=0.75):
    r = difflib.SequenceMatcher(None, norm(g), norm(c)).ratio()
    return (1 if r >= thr else 0), round(r, 3)


NEG = ('不', '未', '无', '禁', '勿')


def judge(g, c):
    """代替裁判的固定评分表：数字有无一致 + 否定词有无一致 + 长度不过短。
    它复刻的是「模型当裁判」最常见三类偏差：偏爱长答案、对否定不敏感、
    只看有没有数字而不看数字量级。"""
    gc, cc = norm(g), norm(c)
    if len(cc) < 0.6 * len(gc):
        return 0, '太短'
    gd = any(ch.isdigit() for ch in gc)
    cd = any(ch.isdigit() for ch in cc)
    if gd != cd:
        return 0, '数字有无不一致'
    if any(w in gc for w in NEG) != any(w in cc for w in NEG):
        return 0, '否定词不一致'
    return 1, '通过'


items = [
    ('42', '42', True),
    ('巴黎', '巴黎。', True),
    ('1/2', '0.5', True),
    ('2026-07-28', '2026年7月28日', True),
    ('不应该重试', '应该重试', False),
    ('准确率提升 4.7 个百分点', '准确率提升 47 个百分点', False),
    ('3 个', '三个', True),
    ('B', 'B', True),
    ('先查日志再改配置', '先改配置再查日志', False),
    ('无法确定', '无法确定，需要更多信息', True),
]

em = sm = jd = real = 0
print('序号  参考 / 候选                              真实  精确  相似度  裁判')
for i, (g, c, ok) in enumerate(items, 1):
    e = exact(g, c)
    s, r = similar(g, c)
    j, why = judge(g, c)
    em += e
    sm += s
    jd += j
    real += 1 if ok else 0
    print('%2d  %-22s / %-22s  %s    %d     %d(%.3f)  %d(%s)'
          % (i, g, c, '对' if ok else '错', e, s, r, j, why))

n = len(items)
print()
print('真实正确率  ：%d/%d = %.0f%%' % (real, n, real / n * 100))
print('精确匹配    ：%d/%d = %.0f%%' % (em, n, em / n * 100))
print('相似度 0.75 ：%d/%d = %.0f%%' % (sm, n, sm / n * 100))
print('固定评分表  ：%d/%d = %.0f%%' % (jd, n, jd / n * 100))
'''

import subprocess, sys, os, tempfile
tmp = tempfile.mkdtemp()
for name, code in BLOCKS.items():
    path = os.path.join(tmp, name + ".py")
    open(path, "w", encoding="utf-8").write(code)
    out = os.path.join(tmp, name + ".out")
    err = os.path.join(tmp, name + ".err")
    env = dict(os.environ, PYTHONIOENCODING="utf-8", PYTHONUTF8="1")
    with open(out, "wb") as fo, open(err, "wb") as fe:
        r = subprocess.run([sys.executable, "-X", "utf8", path], stdout=fo, stderr=fe, env=env)
    print("=============== " + name + "  status=" + str(r.returncode) + " ===============")
    print(open(out, encoding="utf-8", errors="replace").read())
    e = open(err, encoding="utf-8", errors="replace").read()
    if e.strip():
        print("STDERR:", e)
