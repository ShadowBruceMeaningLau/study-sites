import math

def cos(a, b):
    d = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return d, na, nb, d / (na * nb)

def eu(a, b):
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))

q = [1, 2, 0]
cases = {
    "A 退货政策": [2, 1, 0],
    "A2 长版（A 放大两倍）": [4, 2, 0],
    "B 发货说明": [0, 1, 2],
    "C 发票说明": [0, 0, 3],
}
for k, v in cases.items():
    d, na, nb, c = cos(q, v)
    print("%-22s dot=%2d |q|=%.4f |v|=%.4f cos=%.4f (%.3f)  eu=%.4f"
          % (k, d, na, nb, c, round(c, 3), eu(q, v)))
print()
print("4/5 =", 4 / 5, " 2/5 =", 2 / 5, " 1/sqrt10 =", 1 / math.sqrt(10))

# rag-2 用的 4 维示意向量
def show(qe, embs):
    nq = math.sqrt(sum(x * x for x in qe))
    for k, v in embs.items():
        d = sum(x * y for x, y in zip(qe, v))
        nv = math.sqrt(sum(x * x for x in v))
        print("  %-10s dot=%.4f cos=%.4f -> %.3f" % (k, d, d / (nq * nv), round(d / (nq * nv), 3)))

print("\n方案1")
show([0.9, 0.3, 0.2, 0.1], {"退货政策": [0.8, 0.45, 0.3, 0.15], "发货说明": [0.25, 0.85, 0.3, 0.2], "发票说明": [0.3, 0.25, 0.85, 0.3]})
print("方案2")
show([0.8, 0.4, 0.3, 0.1], {"退货政策": [0.7, 0.5, 0.35, 0.2], "发货说明": [0.3, 0.9, 0.35, 0.25], "发票说明": [0.35, 0.3, 0.9, 0.35]})
