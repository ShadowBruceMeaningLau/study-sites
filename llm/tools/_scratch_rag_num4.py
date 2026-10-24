import math

def cos(a, b):
    d = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return d, na, nb, d / (na * nb)

q = [0.86, 0.55, 0.20]          # 查询「退款要几天内」在嵌入空间的坐标
d1 = [0.80, 0.60, 0.15]         # 退货政策 块
d2 = [0.20, 0.30, 0.85]         # 发票说明 块
d3 = [0.25, 0.85, 0.30]         # 发货说明 块
for name, v in [("退货政策", d1), ("发票说明", d2), ("发货说明", d3)]:
    dot, na, nb, c = cos(q, v)
    print("%-6s dot=%.6f |q|^2=%.4f |v|^2=%.4f cos=%.6f -> %.3f"
          % (name, dot, na * na, nb * nb, c, round(c, 3)))

# 词袋空间：查询「退款要几天内」的 bigram 与「退货政策」块无一相同 → 余弦 0
print("bag cos =", 0.0)

# rag-2 重叠数字再核
print("15000/300 =", 15000 / 300, " 15000/250 =", 15000 / 250)
print("overlap 50 / size 300 -> ratio", 50 / 300)

# rag-1 数字再核
print("450000/1.6 =", 450000 / 1.6)
print("8192*1.6 =", 8192 * 1.6)
print("13107.2/450000 =", 13107.2 / 450000)
print("281250/8192 =", 281250 / 8192)
print("900/1.6 =", 900 / 1.6)
print("281250/562.5 =", 281250 / 562.5)
