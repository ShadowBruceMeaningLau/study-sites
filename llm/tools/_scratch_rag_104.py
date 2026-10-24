# -*- coding: utf-8 -*-
# 为正文里要写的字数/块数做精确核对（不写任何实测值，只写由 config 决定的确定性数字）
import math

D1 = "差旅报销要在出差结束后十个工作日内提交发票。发票抬头必须是公司全称。逾期提交需要部门负责人签字说明。"
D2 = "年假按工龄计算：满一年不满十年每年五天。满十年不满二十年每年十天。满二十年每年十五天。"
D3 = "公司食堂每周三提供素食窗口。午餐时间为十一点半到十三点。节假日不开放。"
D4 = "出差住宿标准：一线城市每晚不超过六百元。其他城市每晚不超过四百元。超标部分需要自己承担。"


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


for name, t in (("d1", D1), ("d2", D2), ("d3", D3), ("d4", D4)):
    print(name, "全文", len(t), "字；句子长度", [len(s) for s in split_sentences(t)],
          "；45 字打包后", [len(c) for c in chunk_text(t, 45)])
print("四篇合计", len(D1) + len(D2) + len(D3) + len(D4))

# rag-1 datalab 里要引用的字数
Q = "出差回来后，最晚多久之内要提交报销发票？"
RULE = "请只根据下面的资料回答问题，资料里没有的就说没有。"
print("问题", len(Q), "字；规则", len(RULE), "字")
print("拼接后（规则+d1+问题）=", len(RULE) + len(D1) + len(Q), "字")
print("四篇全塞（规则+四篇+问题）=", len(RULE) + len(D1) + len(D2) + len(D3) + len(D4) + len(Q), "字")

# 余弦/欧氏：d2 三分量乘 3 的手算
Q3 = [3, 0, 1]
D2V = [0, 3, 1]
S = [0, 9, 3]


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def norm(a):
    return math.sqrt(sum(x * x for x in a))


def cos(a, b):
    return dot(a, b) / (norm(a) * norm(b))


def euc(a, b):
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


print("d2 乘 3：点积", dot(Q3, S), "|s|", round(norm(S), 3), "余弦", round(cos(Q3, S), 6), "欧氏", round(euc(Q3, S), 3))
print("原 d2 欧氏", round(euc(Q3, D2V), 3), "余弦", round(cos(Q3, D2V), 6))
print("2 维小题 q=[1,0] d=[1,1] 余弦 =", round(cos([1, 0], [1, 1]), 4))
