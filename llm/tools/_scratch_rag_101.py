# -*- coding: utf-8 -*-
# 核对 rag-2 的切分块数与 rag-3 的手算数字（与 app/labs.js 的 renderRagsteps 算法一致）
import math

DOCS = [
    ("d1", "差旅报销要在出差结束后十个工作日内提交发票。发票抬头必须是公司全称。逾期提交需要部门负责人签字说明。"),
    ("d2", "年假按工龄计算：满一年不满十年每年五天。满十年不满二十年每年十天。满二十年每年十五天。"),
    ("d3", "公司食堂每周三提供素食窗口。午餐时间为十一点半到十三点。节假日不开放。"),
    ("d4", "出差住宿标准：一线城市每晚不超过六百元。其他城市每晚不超过四百元。超标部分需要自己承担。"),
]


def split_sentences(t):
    out, buf = [], ""
    for ch in t:
        buf += ch
        if ch in "。！？；!?;\n":
            if buf.strip():
                out.append(buf.strip())
            buf = ""
    if buf.strip():
        out.append(buf.strip())
    return out


def chunk_text(t, sz):
    chunks, cur = [], ""
    for s in split_sentences(t):
        if cur and len(cur + s) > sz:
            chunks.append(cur)
            cur = s
        else:
            cur += s
    if cur:
        chunks.append(cur)
    return chunks


for sz in (45, 60):
    total = 0
    print("chunkSize=%d" % sz)
    for did, text in DOCS:
        cs = chunk_text(text, sz)
        total += len(cs)
        print("  ", did, "句子数", len(split_sentences(text)), "块数", len(cs), [len(c) for c in cs], cs)
    print("   共", total, "块")

Q = [0.9, 0.2, 0.0]
DOCV = {
    "d1": [0.8, 0.1, 0.1],
    "d2": [0.2, 0.9, 0.1],
    "d3": [0.1, 0.0, 0.9],
}


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def norm(a):
    return math.sqrt(sum(x * x for x in a))


def cos(a, b):
    return dot(a, b) / (norm(a) * norm(b))


print()
print("|q| =", norm(Q))
for k, v in DOCV.items():
    print(k, "dot=%.4f" % dot(Q, v), "|v|=%.6f" % norm(v), "cos=%.6f" % cos(Q, v),
          "euclid=%.4f" % math.sqrt(sum((x - y) ** 2 for x, y in zip(Q, v))))

# 同一方向、长度翻倍：余弦不变、欧氏距离变大
A2 = [2.4, 0.3, 0.3]
print()
print("a2 =", A2, "|a2| =", norm(A2), "cos =", cos(Q, A2),
      "euclid =", math.sqrt(sum((x - y) ** 2 for x, y in zip(Q, A2))))
print("欧氏(q,a) =", math.sqrt(sum((x - y) ** 2 for x, y in zip(Q, DOCV["d1"]))))
print("cos(q,a) =", cos(Q, DOCV["d1"]))

# 归一化后的坐标（cos 展开式用）
print()
print("q/|q| =", [x / norm(Q) for x in Q])
for k, v in DOCV.items():
    print(k, [round(x / norm(v), 4) for x in v])
print("分母乘积：")
for k, v in DOCV.items():
    print(k, round(norm(Q) * norm(v), 6), "商 =", round(dot(Q, v) / (norm(Q) * norm(v)), 6))
