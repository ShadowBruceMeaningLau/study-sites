# -*- coding: utf-8 -*-
"""最终核对：ev-2 覆盖口径、ev-5 分母、ev-3 打分器准确率。"""

print("==== ev-2 覆盖：题量加权 vs 流量加权 ====")
cats = [
    ("问答", 55, 0.90, 0.30),
    ("工具调用", 25, 0.50, 0.35),
    ("多步任务", 12, 0.25, 0.25),
    ("边界拒答", 8, 7 / 8, 0.10),
]
n = sum(c[1] for c in cats)
print("总题 %d" % n)
for name, k, r, w in cats:
    print("  %-6s 题数 %2d (%.0f%%)  通过率 %.1f%%  流量 %.0f%%  一致" % (name, k, k / n * 100, r * 100, w * 100))
by_count = sum(c[1] / n * c[2] for c in cats)
by_traffic = sum(c[3] * c[2] for c in cats)
macro = sum(c[2] for c in cats) / len(cats)
print("题量加权 %.4f = %.1f%%" % (by_count, by_count * 100))
print("流量加权 %.4f = %.1f%%" % (by_traffic, by_traffic * 100))
print("宏平均   %.4f = %.1f%%" % (macro, macro * 100))
print("题量加权 - 流量加权 = %.1f 个百分点" % ((by_count - by_traffic) * 100))
import math
print("边界拒答 8 题，对错各半时标准差 = %.3f = %.1f 个百分点" % (math.sqrt(0.25 / 8), math.sqrt(0.25 / 8) * 100))
print("边界拒答 一道题 = %.1f 个百分点" % (1 / 8 * 100))

print()
print("==== ev-5 退款率的分母 ====")
print("128/1520 = %.4f = %.2f%%" % (128 / 1520, 128 / 1520 * 100))
print("128/1502 = %.4f = %.2f%%" % (128 / 1502, 128 / 1502 * 100))
print("四舍五入到一位小数： %.1f%% vs %.1f%%" % (128 / 1520 * 100, 128 / 1502 * 100))
print("1520 - 1502 = %d" % (1520 - 1502))
for p, k in ((0.9, 6), (0.95, 6), (0.98, 6), (0.9, 10)):
    print("%.2f^%d = %.4f = %.1f%%" % (p, k, p ** k, p ** k * 100))

print()
print("==== ev-3 三种打分器：判对条数 vs 判得准不准 ====")
import difflib

PUNCT = "，。、；：！？「」（）()“”"


def norm(s):
    keep = []
    for ch in s:
        if ch.isspace() or ch in PUNCT:
            continue
        keep.append(ch.lower())
    return "".join(keep)


def exact(g, c):
    return 1 if norm(g) == norm(c) else 0


def similar(g, c, thr=0.75):
    r = difflib.SequenceMatcher(None, norm(g), norm(c)).ratio()
    return 1 if r >= thr else 0


NEG = ("不", "未", "无", "禁", "勿")


def judge(g, c):
    gc, cc = norm(g), norm(c)
    if len(cc) < 0.6 * len(gc):
        return 0
    if any(ch.isdigit() for ch in gc) != any(ch.isdigit() for ch in cc):
        return 0
    if any(w in gc for w in NEG) != any(w in cc for w in NEG):
        return 0
    return 1


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
for name, fn in (("精确匹配", exact), ("相似度0.75", similar), ("固定评分表", judge)):
    verdicts = [fn(g, c) for g, c, _ in items]
    agree = sum(1 for (g, c, ok), v in zip(items, verdicts) if v == (1 if ok else 0))
    fp = sum(1 for (g, c, ok), v in zip(items, verdicts) if v == 1 and not ok)
    fnc = sum(1 for (g, c, ok), v in zip(items, verdicts) if v == 0 and ok)
    print("%-10s 判为通过 %d/10 = %d%%；与真实一致 %d/10 = %d%%；假阳性 %d；假阴性 %d"
          % (name, sum(verdicts), sum(verdicts) * 10, agree, agree * 10, fp, fnc))
real = sum(1 for _, _, ok in items if ok)
print("真实答对 %d/10 = %d%%" % (real, real * 10))
