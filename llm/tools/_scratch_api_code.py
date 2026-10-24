# -*- coding: utf-8 -*-
"""课程 11 的 code 块：原样跑一遍，确认语法与真实输出。"""

# ============ api-2 的 code 块：一次性拿完整回复 ============
CODE_2 = r'''
import json
import os
import urllib.request

URL = os.environ.get("LLM_BASE_URL", "http://127.0.0.1:11434/v1") + "/chat/completions"

payload = {
    "model": "qwen2:1.5b",
    "messages": [
        {"role": "system", "content": "你是一个简洁的助手，回答不超过两句话。"},
        {"role": "user", "content": "用一句话解释什么是端口号。"},
    ],
    "stream": False,
}
body = json.dumps(payload).encode("utf-8")
req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json"})

try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        print("状态码：", resp.status)
        result = json.loads(resp.read().decode("utf-8"))
except Exception as e:
    print("请求失败：", e)
    raise SystemExit(0)

print("模型：", result["model"])
print("回复：", result["choices"][0]["message"]["content"])
print("为何结束：", result["choices"][0]["finish_reason"])
print("用量：", result["usage"])
'''

# ============ api-4 的 code 块：SSE 分帧 + 半截 JSON ============
CODE_4 = r'''
import json

def feed(buffer, chunk):
    """把新到的字节拼进缓冲，返回 (完整数据行列表, 剩余缓冲)。"""
    buffer += chunk
    lines, rest = [], buffer
    while "\n\n" in rest:                 # 两个换行才是一个事件的终点
        block, rest = rest.split("\n\n", 1)
        for line in block.split("\n"):
            if line.startswith("data: "):
                lines.append(line[len("data: "):])
    return lines, rest

# 把一段真实的流拆成「网络随便切的两刀」
chunk_a = 'data: {"delta":"你"}\n\ndata: {"delta":"好"}\n\nda'
chunk_b = 'ta: {"delta":"呀"}\n\ndata: [DONE]\n\n'

buffer = ""
lines, buffer = feed(buffer, chunk_a)
print("第一段之后：完整事件", len(lines), "个，缓冲里剩", repr(buffer))

lines, buffer = feed(buffer, chunk_b)
print("第二段之后：完整事件", len(lines), "个，缓冲里剩", repr(buffer))

for payload in lines:
    if payload.strip() == "[DONE]":
        print("流结束标记 [DONE]")
        continue
    try:
        obj = json.loads(payload)
    except json.JSONDecodeError as e:
        print("半截 JSON，先留着下轮再拼：", e)
        continue
    print("解析出增量：", obj["delta"])

print("拼起来是：", "你好呀")
'''

# ============ api-4 的第二个 code 块：不缓冲会怎样 ============
CODE_4B = r'''
import json

# 反例：每收到一段就立刻 json.loads，不做分帧
chunk_a = 'data: {"delta":"你"}\n\ndata: {"delta":"好"}\n\nda'
try:
    json.loads(chunk_a)
except json.JSONDecodeError as e:
    print("直接解析整段会失败：", e.msg, "，位置", e.pos)
    print("出问题的地方：", chunk_a[e.pos:e.pos + 12])

# 正例：只取以 "data: " 开头、且已经以两个换行收尾的那一行
def take_ready(buffer):
    ready = []
    while "\n\n" in buffer:
        block, buffer = buffer.split("\n\n", 1)
        if block.startswith("data: "):
            ready.append(block[len("data: "):])
    return ready, buffer

ready, left = take_ready(chunk_a)
print("只取完整的：", ready)
print("留在缓冲里的尾巴：", repr(left))
for p in ready:
    print("可以安全解析：", json.loads(p))
'''

for name, code in (("api-2", CODE_2), ("api-4", CODE_4), ("api-4b", CODE_4B)):
    print("=" * 20, name)
    exec(compile(code, name, "exec"), {"__name__": "__main__"})
