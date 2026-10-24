# -*- coding: utf-8 -*-
# rag-2 定稿补充：同一篇 179 字文档，固定窗口切法的断句情况
OUT = "tools/_scratch_rag_chunk_fix.out"
lines = []

DOC = ("差旅报销规定。员工出差前要在系统里提交出差申请，写明目的地、起止日期和预计费用，由直属主管审批。"
       "出差结束后十个工作日内提交报销，超过十个工作日需要部门负责人签字说明原因。"
       "住宿标准按城市分级：一线城市每晚不超过六百元，其他城市每晚不超过四百元。"
       "交通费凭票报销，原则上选择经济舱或二等座。"
       "发票必须是增值税发票，抬头写公司全称，税号不能错，同一张发票只能报销一次。")


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


def chunk_by_sentence(t, sz):
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


def chunk_fixed(t, sz, stride):
    return [t[i:i + sz] for i in range(0, len(t), stride) if t[i:i + sz]]


lines.append("文档 %d 字，%d 句" % (len(DOC), len(split_sentences(DOC))))
for sz in (60, 120):
    cs = chunk_by_sentence(DOC, sz)
    broken = sum(1 for c in cs if c and c[-1] != "。")
    lines.append("按句打包 %d：%d 块 %s，结尾非句号 %d 块"
                 % (sz, len(cs), [len(c) for c in cs], broken))
for sz, st in ((120, 120), (60, 60), (60, 30)):
    cs = chunk_fixed(DOC, sz, st)
    broken = sum(1 for c in cs if c and c[-1] != "。")
    lines.append("固定窗口 %d 步长 %d：%d 块 %s，结尾非句号 %d 块"
                 % (sz, st, len(cs), [len(c) for c in cs], broken))

lines.append("")
lines.append("=== 同一篇按句打包 120 字，两块的内容 ===")
for i, c in enumerate(chunk_by_sentence(DOC, 120), 1):
    lines.append("  块 %d（%d 字）：%s" % (i, len(c), c))

open(OUT, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("done", OUT)
