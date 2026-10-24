# -*- coding: utf-8 -*-
# rag-2 定稿：一篇较长的文档 + chunkSize=120，按渲染器算法算块
OUT = "tools/_scratch_rag_chunk_final.out"
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


DOC = ("差旅报销规定。员工出差前要在系统里提交出差申请，写明目的地、起止日期和预计费用，由直属主管审批。"
       "出差结束后十个工作日内提交报销，超过十个工作日需要部门负责人签字说明原因。"
       "住宿标准按城市分级：一线城市每晚不超过六百元，其他城市每晚不超过四百元。"
       "交通费凭票报销，原则上选择经济舱或二等座。"
       "发票必须是增值税发票，抬头写公司全称，税号不能错，同一张发票只能报销一次。")

lines.append("文档字数：%d，句子数：%d" % (len(DOC), len(split_sentences(DOC))))
for size in (120, 60, 90):
    cs = chunk_text(DOC, size)
    lines.append("chunkSize=%d：%d 块，块长 %s" % (size, len(cs), [len(c) for c in cs]))
    for i, c in enumerate(cs, 1):
        lines.append("   块 %d（%d 字）：%s" % (i, len(c), c))
    lines.append("")

open(OUT, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("done", OUT)
