import math

def cos(a, b):
    d = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return d, na, nb, d / (na * nb)

q = [0.90, 0.30, 0.20, 0.10]
embs = {
    "退货政策": [0.85, 0.25, 0.15, 0.05],
    "发货说明": [0.20, 0.85, 0.30, 0.15],
    "发票说明": [0.25, 0.30, 0.90, 0.20],
}
for k, v in embs.items():
    d, na, nb, c = cos(q, v)
    print("%-6s dot=%.6f |q|^2=%.4f |v|^2=%.4f cos=%.6f -> %.4f  %%" % (k, d, na*na, nb*nb, c, c))
print("|q| =", math.sqrt(sum(x*x for x in q)))

# rag-3 主例子：q=(1,2,0)，A=(2,1,0)，B=(0,1,2)，C=(0,0,3)，A长=(4,2,0)
qq = [1, 2, 0]
for name, v in {
    "A": [2, 1, 0],
    "A长": [4, 2, 0],
    "B": [0, 1, 2],
    "C": [0, 0, 3],
}.items():
    d, na, nb, c = cos(qq, v)
    dot = sum(x*y for x, y in zip(qq, v))
    print("%-4s dot=%2d  |q|=%.6f  |v|=%.6f  乘积=%.6f  cos=%.6f -> %.3f  欧氏=%.4f"
          % (name, dot, na, nb, na*nb, c, round(c, 3),
             math.sqrt(sum((x-y)**2 for x, y in zip(qq, v)))))

# 手算过程中要写的中间量
print("A: 2*1+1*2+0*0 =", 2*1+1*2+0*0, " |q|^2=1+4=5 ->", math.sqrt(5), " |v|^2=4+1+0=5 ->", math.sqrt(5),
      " 分母=5  cos=4/5 =", 4/5)
print("B: 0*1+1*2+2*0 =", 2, " |v|^2=0+1+4=5 ->", math.sqrt(5), " 分母=5  cos=2/5 =", 2/5)
print("C: 0 分母 sqrt5*sqrt9 =", math.sqrt(5)*3, " cos=0")
print("A长: dot=4*1+2*2=", 8, " |v|^2=16+4=20 ->", math.sqrt(20), " cos=8/10 =", 8/10)
