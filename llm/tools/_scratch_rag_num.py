import math

# ---- rag-1: 全塞 vs RAG 的数量对比 ----
docs, chars = 300, 1500
total_chars = docs * chars
tokens = total_chars / 1.6
print("资料总字数", total_chars, "=> 词元", tokens)
print("相对 8192 窗口倍数 %.2f" % (tokens / 8192))
rag_chars = 3 * 300
rag_tokens = rag_chars / 1.6
print("RAG 送进", rag_chars, "字 =>", rag_tokens, "词元")
print("倍数 %.1f" % (tokens / rag_tokens))

# ---- rag-2: 重叠 ----
print("无重叠块数", 15000 / 300)
print("重叠 50 后每块新增", 300 - 50, "块数", 15000 / 250)
print("多出比例 %.2f" % ((15000 / 250) / (15000 / 300)))

# ---- rag-3: 3 维余弦手算 ----
def cos(a, b):
    d = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return d, na, nb, d / (na * nb)

def dist(a, b):
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))

q = [2, 1, 0]
vecs = {"退货政策": [3, 1, 0], "发货说明": [0, 2, 1], "发票说明": [0, 1, 2], "退货政策长版": [30, 10, 0]}
for k, v in vecs.items():
    d, na, nb, c = cos(q, v)
    print("%s dot=%s |q|=%.6f |v|=%.6f cos=%.6f -> %.3f  euclid=%.6f"
          % (k, d, na, nb, c, round(c, 3), dist(q, v)))
print("7/7.0710678 =", 7 / (math.sqrt(5) * math.sqrt(10)))
print("sqrt5", math.sqrt(5), "sqrt10", math.sqrt(10), "sqrt6", math.sqrt(6), "sqrt8", math.sqrt(8), "sqrt865", math.sqrt(865))
print("2/5", 2 / 5, "1/5", 1 / 5)
