# -*- coding: utf-8 -*-
"""临时核算脚本：eval-harness 课程里出现的每个数字都从这里算出来（纯标准库）。"""
import math
import re
import difflib


def show(t):
    print("\n==== " + t + " ====")


# ------------------------------------------------------------------ 1. 三种打分器
show("1. 三种打分器对同一批 10 条答案的判定")
norm_re = re.compile(r"[\s，。、；：！？「」（）()“”\"']+")

items = [
    ("42", "42", True),
    ("巴黎", "巴黎。", True),
    ("1/2", "0.5", True),
    ("2026-07-28", "2026年7月28日", True),
    ("不应该重试", "应该重试", False),
    ("准确率提升 4.7 个百分点", "准确率提升 47 个百分点", False),
    ("3 个", "三个", True),
    ("B", "B", True),
    ("先查日志再改配置", "先改配置再查日志", False),
    ("无法确定", "无法确定，需要更多信息", True),
]


def n(s):
    return norm_re.sub("", s).lower()


DIGIT = re.compile(r"\d")
NEG = ("不", "未", "无", "禁", "勿")


def exact_match(g, c):
    return 1 if n(g) == n(c) else 0


def sim_score(g, c, thr=0.75):
    r = difflib.SequenceMatcher(None, n(g), n(c)).ratio()
    return (1 if r >= thr else 0), round(r, 3)


def judge(g, c):
    """代替裁判的固定评分表：数字有无一致 + 否定词有无一致 + 长度不过短。
    它复刻的正是「模型当裁判」最常见的三类偏差：偏爱长答案、对否定不敏感、
    只看有没有数字而不看数字量级。"""
    gc, cc = n(g), n(c)
    if len(cc) < 0.6 * len(gc):
        return 0, "太短"
    if bool(DIGIT.search(gc)) != bool(DIGIT.search(cc)):
        return 0, "数字有无不一致"
    gneg = any(w in gc for w in NEG)
    cneg = any(w in cc for w in NEG)
    if gneg != cneg:
        return 0, "否定词不一致"
    return 1, "通过"


em = sm = jd = truth = 0
print("序号 | 参考 | 候选 | 真实 | 精确 | 相似度 | 裁判")
for i, (g, c, ok) in enumerate(items, 1):
    e = exact_match(g, c)
    s, r = sim_score(g, c)
    j, why = judge(g, c)
    em += e
    sm += s
    jd += j
    truth += 1 if ok else 0
    print("%2d | %s | %s | %s | %d | %d(%.3f) | %d(%s)" % (i, g, c, "对" if ok else "错", e, s, r, j, why))
print("精确匹配 正确率 = %d/10 = %d%%" % (em, em * 10))
print("相似度(>=0.75) 正确率 = %d/10 = %d%%" % (sm, sm * 10))
print("裁判 正确率 = %d/10 = %d%%" % (jd, jd * 10))
print("真实 正确率 = %d/10 = %d%%" % (truth, truth * 10))

# 逐个算「假阳性 / 假阴性」
fp = {"精确": 0, "相似度": 0, "裁判": 0}
fn = {"精确": 0, "相似度": 0, "裁判": 0}
for g, c, ok in items:
    e = exact_match(g, c)
    s, _ = sim_score(g, c)
    j, _ = judge(g, c)
    for k, v in (("精确", e), ("相似度", s), ("裁判", j)):
        if v and not ok:
            fp[k] += 1
        if not v and ok:
            fn[k] += 1
print("假阳性（错答案被判对）：", fp)
print("假阴性（对答案被判错）：", fn)

# ------------------------------------------------------------------ 2. A/B 对比要不要下结论
show("2. A/B：40 题上的 +5 题算不算证据（McNemar）")
n_tasks = 40
a_pass, b_pass = 26, 31
b_only, c_only = 7, 2  # b = 只有 B 对；c = 只有 A 对


def binom_two_sided(k, nd):
    """精确二项检验（双侧）：X ~ Bin(nd, 0.5)，比较 |X - nd/2|。"""
    def pmf(x):
        return math.comb(nd, x) / (2 ** nd)
    obs = min(k, nd - k)
    p = sum(pmf(x) for x in range(0, obs + 1)) * 2
    return min(1.0, p)


print("A 通过 %d/%d = %.1f%%；B 通过 %d/%d = %.1f%%；差 %d 题 = %.1f 个百分点"
      % (a_pass, n_tasks, a_pass / n_tasks * 100, b_pass, n_tasks, b_pass / n_tasks * 100,
         b_pass - a_pass, (b_pass - a_pass) / n_tasks * 100))
print("不一致的对子 %d + %d = %d，其中 B 独赢 %d、A 独赢 %d" % (b_only, c_only, b_only + c_only, b_only, c_only))
stat = (b_only - c_only) ** 2 / (b_only + c_only)
print("McNemar 统计量 (b-c)^2/(b+c) = %d/9 = %.2f（95%% 门槛 3.84）" % ((b_only - c_only) ** 2, stat))
p9 = binom_two_sided(b_only, b_only + c_only)
print("精确二项双侧 p = %.4f（9 个对子里至少 7 个偏向 B 的概率×2）" % p9)

show("2b. 同样比例放大到 200 题")
b2, c2 = 35, 10
stat2 = (b2 - c2) ** 2 / (b2 + c2)
p2 = binom_two_sided(b2, b2 + c2)
print("200 题、不一致 %d 个（B 独赢 %d、A 独赢 %d）：统计量 = %d/%d = %.2f，精确 p = %.5f"
      % (b2 + c2, b2, c2, (b2 - c2) ** 2, b2 + c2, stat2, p2))

# ------------------------------------------------------------------ 3. 置信区间
show("3. 比例分数的 95% 置信区间（Wilson）")
def wilson(k, nd, z=1.96):
    p = k / nd
    d = 1 + z * z / nd
    ctr = (p + z * z / (2 * nd)) / d
    half = z * math.sqrt(p * (1 - p) / nd + z * z / (4 * nd * nd)) / d
    return ctr - half, ctr + half
for k, nd in [(28, 40), (30, 40), (29, 40), (31, 40), (26, 40), (31, 40)]:
    lo, hi = wilson(k, nd)
    print("%d/%d = %.1f%%  ->  [%.1f%%, %.1f%%]  半宽 %.1f 个百分点" % (k, nd, k / nd * 100, lo * 100, hi * 100, (hi - lo) / 2 * 100))

show("3b. 想把半宽压到 5 个百分点要多少题（p=0.7, z=1.96）")
p = 0.7
n_need = (1.96 / 0.05) ** 2 * p * (1 - p)
print("n = (1.96/0.05)^2 * 0.7*0.3 = %.1f -> 向上取整 %d 题" % (n_need, math.ceil(n_need)))
for nd in [40, 100, 200, 323, 400]:
    lo, hi = wilson(round(p * nd), nd)
    print("  n=%d：%d/%d -> 半宽 %.1f 个百分点" % (nd, round(p * nd), nd, (hi - lo) / 2 * 100))

# ------------------------------------------------------------------ 4. 均值相同、分布不同
show("4. 两个版本总分一样，分类通过率不一样")
cats = ["问答", "工具调用", "多步任务", "边界拒答"]
old = [9, 8, 7, 4]
new = [8, 9, 9, 2]
print("分类  题数  旧版  新版  差")
for i, c in enumerate(cats):
    print("%s  %d  %d(%d%%)  %d(%d%%)  %+d" % (c, 10, old[i], old[i] * 10, new[i], new[i] * 10, new[i] - old[i]))
print("旧版合计 %d/40 = %d%%；新版合计 %d/40 = %d%%" % (sum(old), sum(old) / 40 * 100, sum(new), sum(new) / 40 * 100))
print("逐类变化绝对值和 = %d（净变化 0）" % sum(abs(new[i] - old[i]) for i in range(4)))


def mean(xs):
    return sum(xs) / len(xs)


def std(xs):
    m = mean(xs)
    return math.sqrt(sum((x - m) ** 2 for x in xs) / len(xs))


o_r = [x / 10 for x in old]
n_r = [x / 10 for x in new]
print("分类通过率的均值：旧 %.2f，新 %.2f" % (mean(o_r), mean(n_r)))
print("分类通过率的标准差：旧 %.3f，新 %.3f（新版更散 = 有类别在偷偷变坏）" % (std(o_r), std(n_r)))

# ------------------------------------------------------------------ 5. 数据污染
show("5. 100 道题里混进了 12 道训练见过的题")
total, correct, dirty = 100, 70, 12
clean = total - dirty
clean_correct = correct - dirty  # 被污染的 12 道全对
print("榜上 %d/%d = %.1f%%" % (correct, total, correct / total * 100))
print("去掉被污染题：%d/%d = %.1f%%" % (clean_correct, clean, clean_correct / clean * 100))
print("虚高 %.1f 个百分点" % (correct / total * 100 - clean_correct / clean * 100))

# ------------------------------------------------------------------ 6. 长程任务：终态 vs 过程
show("6. 长程任务：终态通过但过程有错")
checks = [
    ("先确认文件格式再动手", True),
    ("查询条件与需求一致", True),
    ("没有越权写生产库", True),
    ("汇报数字与查询结果一致", False),
    ("临时文件已清理", False),
]
passed = sum(1 for _, ok in checks if ok)
print("过程检查点 %d 个，通过 %d 个 = %.0f%%" % (len(checks), passed, passed / len(checks) * 100))
print("终态检查 1 个（结论文件存在且格式正确），通过 1 个 = 100%")
process_rate = passed / len(checks) * 100
print("只看终态：100%% 通过；看过程：%.0f%% 通过" % process_rate)

# ------------------------------------------------------------------ 7. CI 门禁
show("7. CI 门禁：及格线 75%%，同一版本跑三次")
runs = [30, 29, 31]
line = 75
for i, k in enumerate(runs, 1):
    lo, hi = wilson(k, 40)
    print("第 %d 次：%d/40 = %.1f%% -> %s（CI [%.1f%%, %.1f%%]）"
          % (i, k, k / 40 * 100, "通过" if k / 40 * 100 >= line else "拦截", lo * 100, hi * 100))
print("三次判定：通过 / 拦截 / 通过 —— 同一个版本两种结论")

show("7b. 门禁把 5 个百分点当成真实差异时，需要多大题量")
for gap in [0.05, 0.10]:
    n_need2 = (1.96 * math.sqrt(2 * 0.7 * 0.3) / gap) ** 2
    print("要分辨 %.2f 的差距，n ≈ %.0f 题（两边各自 n，p=0.7）" % (gap, n_need2))
