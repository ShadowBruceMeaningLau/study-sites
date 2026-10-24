# -*- coding: utf-8 -*-
# rag-3 手算例子的最终数字（3 维、整数坐标，余弦分母相同便于手算）
import math

Q = [3, 0, 1]
DOCS = {
    "d1 住宿标准": [3, 1, 0],
    "d2 年假规则": [0, 3, 1],
    "d3 食堂时间": [0, 1, 3],
}
LONG = [6, 2, 0]


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def norm(a):
    return math.sqrt(sum(x * x for x in a))


def cos(a, b):
    return dot(a, b) / (norm(a) * norm(b))


def dist(a, b):
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


print("|q| =", norm(Q), "= sqrt(10)")
for k, v in DOCS.items():
    print(k, "dot=%d" % dot(Q, v), "|v|=%.6f" % norm(v), "denom=%.6f" % (norm(Q) * norm(v)),
          "cos=%.6f" % cos(Q, v), "euclid=%.6f" % dist(Q, v))
print()
print("long", LONG, "dot=%d" % dot(Q, LONG), "|long|=%.6f" % norm(LONG),
      "cos=%.6f" % cos(Q, LONG), "euclid=%.6f" % dist(Q, LONG))
print()
print("cos 展开：分子 9，分母 sqrt(10)*sqrt(10) = 10 → 0.9")
print("分子 1，分母 10 →", dot(Q, DOCS["d2 年假规则"]) / 10)
print("分子 3，分母 10 →", dot(Q, DOCS["d3 食堂时间"]) / 10)
print("long 分子 18，分母 sqrt(10)*sqrt(40) = 20 →", 18 / 20)
print("d2 euclid = sqrt(9+9+0) =", math.sqrt(18))
print("d3 euclid = sqrt(9+1+4) =", math.sqrt(14))
print("long euclid = sqrt(9+4+1) =", math.sqrt(14))
print()
print("cartesian:", [round(9 / 10, 4), round(1 / 10, 4), round(3 / 10, 4), round(18 / 20, 4)])
