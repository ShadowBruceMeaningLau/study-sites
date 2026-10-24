# -*- coding: utf-8 -*-
# 核对写进 data/rag.js 的 ragsteps config：用渲染器同一算法算块数与余弦
import math

OUT = "tools/_scratch_rag_verify.out"
lines = []


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


def cos(a, b):
    d = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return d / (na * nb) if na and nb else 0.0


D2 = "差旅报销规定。员工出差前要在系统里提交出差申请，写明目的地、起止日期和预计费用，由直属主管审批。出差结束后十个工作日内提交报销，超过十个工作日需要部门负责人签字说明原因。住宿标准按城市分级：一线城市每晚不超过六百元，其他城市每晚不超过四百元。交通费凭票报销，原则上选择经济舱或二等座。发票必须是增值税发票，抬头写公司全称，税号不能错，同一张发票只能报销一次。"
cs = chunk_text(D2, 120)
lines.append("rag-2：文档 %d 字，chunkSize 120 -> %d 块，块长 %s" % (len(D2), len(cs), [len(c) for c in cs]))

lines.append("")
lines.append("rag-2 余弦：q=[0.9,0.1,0.0,0.2] vs emb.d1=[1.0,0.0,0.0,0.2] = %.4f"
            % cos([0.9, 0.1, 0.0, 0.2], [1.0, 0.0, 0.0, 0.2]))

lines.append("")
lines.append("rag-6：q=[0.0,0.0,0.2,0.9]")
for k, v in (("d1", [1.0, 0.0, 0.0, 0.1]), ("d4", [0.1, 0.0, 0.0, 1.0])):
    lines.append("  %s 余弦 = %.4f" % (k, cos([0.0, 0.0, 0.2, 0.9], v)))

lines.append("")
lines.append("rag-4 / rag-5：q=[0.9,0.0,0.05,0.0]")
for k, v in (("d1", [1.0, 0.0, 0.0, 0.0]), ("d2", [0.0, 1.0, 0.0, 0.0]),
             ("d5", [0.9, 0.1, 0.0, 0.0]), ("d7", [0.55, 0.0, 0.0, 0.5])):
    lines.append("  %s 余弦 = %.4f" % (k, cos([0.9, 0.0, 0.05, 0.0], v)))

lines.append("")
lines.append("rag-8：q=[0.7,0.7,0.0]")
for k, v in (("d1", [1.0, 0.0, 0.0]), ("d2", [0.0, 1.0, 0.0]), ("d7", [0.6, 0.6, 0.6])):
    lines.append("  %s 余弦 = %.4f" % (k, cos([0.7, 0.7, 0.0], v)))

open(OUT, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("done", OUT)
