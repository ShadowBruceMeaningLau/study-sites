# -*- coding: utf-8 -*-
"""课程 11 其余 code 块：原样跑一遍，确认语法与真实输出。"""

# ============ api-4 补充：半截 UTF-8 字节 ============
CODE_UTF8 = r'''
# 网络送来的是一段一段的字节，不是一个一个字符。
# 一个汉字在 UTF-8 里通常占 3 个字节，切在中间就会解不出来。
whole = "你好".encode("utf-8")
print("你好 的字节：", list(whole), "共", len(whole), "字节")

cut = whole[:2]            # 只拿到前 2 个字节
try:
    cut.decode("utf-8")
except UnicodeDecodeError as e:
    print("解不出来：", e.reason, "，出错位置在第", e.start, "个字节")

# 正确做法：先攒够一个完整字符的字节，再解码
import codecs

decoder = codecs.getincrementaldecoder("utf-8")()
buf = ""
for piece in (whole[:2], whole[2:5], whole[5:]):
    try:
        buf += decoder.decode(piece)
    except UnicodeDecodeError as e:
        print("这段还是不完整，留着下轮再拼：", e.reason)
print("攒完整之后解出来：", buf)
'''

# ============ api-5 的 code 块：带指数退避的重试 ============
CODE_RETRY = r'''
import json
import time
import urllib.error
import urllib.request

URL = "http://127.0.0.1:11434/v1/chat/completions"

def backoff(attempt, base=1.0, cap=30.0):
    """第 attempt 次重试之前该等多久（秒）。"""
    return min(cap, base * (2 ** (attempt - 1)))

def call_once():
    payload = {"model": "qwen2:1.5b", "messages": [{"role": "user", "content": "说一句你好"}], "stream": False}
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))

# 演示退避表，不真的睡：把等待时间打印出来
print("如果每次都被限流，等待时间是：")
for a in range(1, 7):
    print("  第", a, "次重试前等", backoff(a), "秒")
print("  六次加起来：", sum(backoff(a) for a in range(1, 7)), "秒")

MAX_RETRY = 2        # 演示用，真实项目 3~5 次
for attempt in range(MAX_RETRY + 1):
    try:
        result = call_once()
        print("第", attempt + 1, "次调用成功，回复：", result["choices"][0]["message"]["content"][:20])
        break
    except urllib.error.HTTPError as e:
        # 4xx 里只有 429 和 408 值得重试；其余 4xx 重试也没用
        retryable = e.code in (408, 429) or e.code >= 500
        print("HTTP 出错：", e.code, "，值得重试吗：", retryable)
        if not retryable or attempt == MAX_RETRY:
            print("不重试了，把错误往上抛，让用户看到")
            break
        wait = backoff(attempt + 1)
        print("  等", wait, "秒后重试")
        time.sleep(wait)
    except (urllib.error.URLError, TimeoutError) as e:
        # 连不上或超时：多半是网络抖动或服务没起来
        print("网络问题：", e, "，值得重试")
        if attempt == MAX_RETRY:
            break
        time.sleep(backoff(attempt + 1))
'''

# ============ api-6 的 code 块：估算词元与成本 ============
CODE_COST = r'''
def est_tokens_cn(text):
    """中文粗估：一个汉字约 1 个词元。"""
    return len(text)

def est_tokens_en(text):
    """英文粗估：4 个字符约 1 个词元。"""
    return round(len(text) / 4)

cn = "请把这句话翻译成英文：今天天气很好。"
en = "Translate the following sentence into Chinese: the weather is nice today."
print("中文", len(cn), "个字符 → 约", est_tokens_cn(cn), "词元")
print("英文", len(en), "个字符 → 约", est_tokens_en(en), "词元")

def cost(in_tok, out_tok, in_price=2.0, out_price=8.0):
    """in_price / out_price：每百万词元的价格（单位：元），这里是假设值。"""
    return (in_tok * in_price + out_tok * out_price) / 1_000_000

one = cost(1200, 400)
print("一次对话（输入 1200、输出 400）：", round(one, 6), "元")
print("一万次：", round(one * 10000, 2), "元")
print("输出砍一半：", round(cost(1200, 200), 6), "元")
print("输入砍一半：", round(cost(600, 400), 6), "元")
print("输出单价比输入贵", 8.0 / 2.0, "倍，所以砍输出更省")
'''

# ============ api-7 的 code 块：换 base_url 就换服务商 ============
CODE_COMPAT = r'''
import json
import os
import urllib.request

# 只要对方提供「OpenAI 兼容」接口，换一个地址就能用同一份代码
PROVIDERS = {
    "本机 Ollama": "http://127.0.0.1:11434/v1",
    "自建网关": "http://127.0.0.1:8080/v1",
}

base = os.environ.get("LLM_BASE_URL", PROVIDERS["本机 Ollama"])
model = os.environ.get("LLM_MODEL", "qwen2:1.5b")
url = base.rstrip("/") + "/chat/completions"
print("这次请求发往：", url)

payload = {"model": model, "messages": [{"role": "user", "content": "只说一个字：好"}], "stream": False}
req = urllib.request.Request(
    url,
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"},
)
try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    print("回复：", data["choices"][0]["message"]["content"].strip()[:20])
    print("用量字段在不在：", "usage" in data)
except Exception as e:
    print("这家服务商没连上或字段不同：", e)
    print("兼容层的价值就在这里：上层代码不用改，只改地址和模型名。")
'''

for name, code in (("utf8", CODE_UTF8), ("retry", CODE_RETRY), ("cost", CODE_COST), ("compat", CODE_COMPAT)):
    print("=" * 20, name)
    exec(compile(code, name, "exec"), {"__name__": "__main__"})
