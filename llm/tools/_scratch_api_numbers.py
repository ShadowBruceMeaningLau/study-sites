"""课程 11《推理 API 与流式输出》用到的全部数字：纯标准库实跑核对。
用法：python _scratch_api_numbers.py
"""

# ---------- 1) 词元估算：中文按字、英文按字符 ----------
def est_tokens_cn(text):
    """经验估算：一个汉字约 1 个词元（常见中文分词器落在 1~1.5 之间）。"""
    return len(text)


def est_tokens_en(text):
    """经验估算：英文约 4 个字符 1 个词元。"""
    return round(len(text) / 4)


cn = "请把这句话翻译成英文：今天天气很好。"
en = "Translate the following sentence into Chinese: the weather is nice today."
print("中文字符数：", len(cn), "→ 估算", est_tokens_cn(cn), "词元（按 1 字 1 词元估）")
print("英文字符数：", len(en), "→ 估算", est_tokens_en(en), "词元（按 4 字符 1 词元估）")
print("两段合计估算：", est_tokens_cn(cn) + est_tokens_en(en))

# ---------- 2) 成本估算：单价全部是「假设值」，只为演示算式 ----------
IN_PRICE = 2.0      # 假设：每百万输入词元 2 元
OUT_PRICE = 8.0     # 假设：每百万输出词元 8 元

def cost(in_tok, out_tok, in_price=IN_PRICE, out_price=OUT_PRICE):
    return (in_tok * in_price + out_tok * out_price) / 1_000_000

print("\n单次对话（输入 1200 词元、输出 400 词元）：", round(cost(1200, 400), 6), "元")
print("放大到 1 万次调用：", round(cost(1200, 400) * 10000, 4), "元")
print("只把输出减半（输入 1200、输出 200）：", round(cost(1200, 200), 6), "元")
print("只把输入减半（输入 600、输出 400）：", round(cost(600, 400), 6), "元")
print("=> 输出词元单价是输入的", OUT_PRICE / IN_PRICE, "倍时，输出那一半更费钱")

# ---------- 3) 指数退避表 ----------
def backoff(attempt, base=1.0, cap=30.0):
    """第 attempt 次重试前等多久：base * 2^(attempt-1)，不超过 cap。"""
    return min(cap, base * (2 ** (attempt - 1)))

print("\n指数退避（base=1 秒，cap=30 秒）：")
for a in range(1, 8):
    print("  第", a, "次重试前等待", backoff(a), "秒")
print("  6 次重试累计等待：", sum(backoff(a) for a in range(1, 7)), "秒")

# ---------- 4) 流式与非流式的时间线 ----------
def timeline(decode_speed, n_tokens, ttft):
    """decode_speed: 词元/秒；n_tokens: 输出词元数；ttft: 首字延迟(秒)。"""
    total_stream = ttft + n_tokens / decode_speed
    return ttft, total_stream

ttft, total = timeline(90, 512, 0.6)
print("\n本机量级对照（decode 90 词元/秒、首字 0.6 秒、输出 512 词元）：")
print("  非流式：用户干等", round(ttft + 512 / 90, 2), "秒才看到第一个字")
print("  流式：第", round(ttft, 2), "秒就开始出字，全部结束在", round(total, 2), "秒")
print("  两种方式总耗时一样，差的是「多久看到第一点东西」")
for speed in (60, 90, 125):
    print("  decode", speed, "词元/秒 → 512 词元需要", round(512 / speed, 2), "秒")

# ---------- 5) SSE 分帧：一个被切断的 JSON ----------
raw = (
    'data: {"id":"c1","choices":[{"delta":{"content":"你"}}]}\n\n'
    'data: {"id":"c1","choices":[{"delta":{"content":"好"}}]}\n\n'
    'data: [DONE]\n\n'
)
print("\nSSE 原文长度：", len(raw), "字符；事件块数：", raw.count("\n\n"))
# 模拟网络把字节任意切开：第 41 个字符处切断
cut = 41
part1, part2 = raw[:cut], raw[cut:]
print("第一次收到的片段末尾 12 字符：", repr(part1[-12:]))
print("这一段里有完整事件块吗：", "\n\n" in part1)
buf = part1
print("缓冲里剩下的半截：", repr(buf.split("\n\n")[-1]))
print("拼上第二段后事件块数：", (part1 + part2).count("\n\n"))

# ---------- 6) 半截 JSON 的解析练习 ----------
def parse_events(text):
    """把一个缓冲区里的完整事件块解析出来，返回 (事件列表, 剩余缓冲)。"""
    events, rest = [], text
    while "\n\n" in rest:
        block, rest = rest.split("\n\n", 1)
        payload = None
        for line in block.split("\n"):
            if line.startswith("data: "):
                payload = line[len("data: "):]
        if payload is None:
            continue
        if payload.strip() == "[DONE]":
            events.append("DONE")
        else:
            events.append(payload)
    return events, rest

events, rest = parse_events(part1)
print("\n只喂第一段：解析出", len(events), "个事件，剩余缓冲", repr(rest[-20:]))
events, rest = parse_events(part1 + part2)
print("喂完整两段：解析出", len(events), "个事件，剩余缓冲", repr(rest))

# ---------- 7) 重试总数与放大效应 ----------
print("\n每次请求最多重试 4 次，则最坏情况一次调用发出 5 个请求：", 1 + 4)
print("并发 20 个客户端 × 5 个请求 = 服务端看到", 20 * 5, "个请求（雪崩的由来）")
