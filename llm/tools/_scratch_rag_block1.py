# 按句子边界打包：先分句，再往块里塞，塞不下就断
import json

DOC = ('差旅报销规定。员工出差前要在系统里提交出差申请，写明目的地、起止日期和预计费用，由直属主管审批。'
       '出差结束后十个工作日内提交报销，超过十个工作日需要部门负责人签字说明原因。'
       '住宿标准按城市分级：一线城市每晚不超过六百元，其他城市每晚不超过四百元。'
       '交通费凭票报销，原则上选择经济舱或二等座。'
       '发票必须是增值税发票，抬头写公司全称，税号不能错，同一张发票只能报销一次。')


def split_sentences(text):
    out, buf = [], ''
    for ch in text:
        buf += ch
        if ch in '。！？；!?;\n':       # 句末标点就断句
            if buf.strip():
                out.append(buf.strip())
            buf = ''
    if buf.strip():
        out.append(buf.strip())
    return out


def chunk_by_sentence(text, size):
    chunks, cur = [], ''
    for s in split_sentences(text):
        if cur and len(cur + s) > size:   # 再加一句就超了
            chunks.append(cur)            # 先收下这一块
            cur = s                       # 新块从这句开始
        else:
            cur += s
    if cur:
        chunks.append(cur)
    return chunks


sentences = split_sentences(DOC)
print('原文', len(DOC), '字，', len(sentences), '句')

for size in (60, 120):
    cs = chunk_by_sentence(DOC, size)
    broken = sum(1 for c in cs if c and c[-1] != '。')
    print('chunkSize =', size, '->', len(cs), '块，块长', [len(c) for c in cs],
          '，结尾不是句号的块', broken, '个')

for i, c in enumerate(chunk_by_sentence(DOC, 120), 1):
    print('  块', i, '（', len(c), '字）：', c)

# 对照：固定窗口硬切，会在句子中间断开
def chunk_fixed(text, size, stride):
    return [text[i:i + size] for i in range(0, len(text), stride) if text[i:i + size]]

fixed = chunk_fixed(DOC, 120, 120)
print('固定窗口 120：', len(fixed), '块，结尾不是句号的块',
      sum(1 for c in fixed if c[-1] != '。'), '个')