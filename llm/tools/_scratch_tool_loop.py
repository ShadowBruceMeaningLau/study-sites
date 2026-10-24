# -*- coding: utf-8 -*-
# 多轮 / 并行 / 错误回灌 三个场景的本机实测（qwen2:1.5b，无原生 tools，用 JSON 约定等价模拟）
import json
import urllib.request

OUT = "tools/_scratch_tool_loop.out"
URL = "http://127.0.0.1:11434/v1/chat/completions"
MODEL = "qwen2:1.5b"
lines = []


def log(*a):
    lines.append(" ".join(str(x) for x in a))


def chat(messages, max_tokens=160):
    payload = {"model": MODEL, "messages": messages, "stream": False,
               "max_tokens": max_tokens, "temperature": 0}
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as resp:
        d = json.loads(resp.read().decode("utf-8"))
    return d["choices"][0]["message"]["content"], d["usage"]


RULES = ("你可以调用工具，调用时只输出一行 JSON："
         "{\"name\": \"工具名\", \"arguments\": {...}}。"
         "需要多个工具时输出一个 JSON 数组。不需要工具就直接回答。不要解释。")

# ---------------- 1. 并行：一句话里两个独立查询 ----------------
log("=== 1. 并行调用：一句话里要查两个城市 ===")
msgs = [
    {"role": "system", "content": RULES},
    {"role": "user", "content": "工具名 get_weather：查一个城市今天的天气。参数 city，字符串，必填。\n"
                                "帮我查一下北京和上海今天的天气。"},
]
out, usage = chat(msgs)
log("模型输出：" + out.replace("\n", " ")[:260])
try:
    obj = json.loads(out)
    log("解析结果：%s（顶层类型 %s）" % (json.dumps(obj, ensure_ascii=False), type(obj).__name__))
except Exception as e:
    log("解析失败：" + str(e)[:120])

# ---------------- 2. 错误回灌：先给一条错误结果，看它改不改 ----------------
log("")
log("=== 2. 错误回灌：第一次参数缺失 → 把错误原样喂回去 ===")
msgs = [
    {"role": "system", "content": RULES},
    {"role": "user", "content": "工具名 read_file：读取文本文件内容。参数 path，字符串，必填；max_bytes，整数，可选，1~1048576。\n"
                                "读一下 notes.txt 的内容。"},
]
out1, _ = chat(msgs)
log("第 1 次请求：" + out1.replace("\n", " ")[:200])
msgs.append({"role": "assistant", "content": out1})
msgs.append({"role": "tool", "content": "错误：参数 max_bytes 必须是整数，收到的是字符串 \"很多\"。请修正参数后重试。"})
out2, _ = chat(msgs)
log("喂回错误后：" + out2.replace("\n", " ")[:200])
try:
    o1 = json.loads(out1) if out1.strip().startswith("{") else None
    o2 = json.loads(out2) if out2.strip().startswith("{") else None
    log("第 1 次 arguments：" + json.dumps((o1 or {}).get("arguments"), ensure_ascii=False))
    log("第 2 次 arguments：" + json.dumps((o2 or {}).get("arguments"), ensure_ascii=False))
    log("两次参数是否相同：" + ("相同" if (o1 or {}).get("arguments") == (o2 or {}).get("arguments") else "不同"))
except Exception as e:
    log("解析失败：" + str(e)[:120])

# ---------------- 3. 不给错误、只说「失败了」会怎样 ----------------
log("")
log("=== 3. 对照：只说「失败了」，不回灌具体错误 ===")
msgs = [
    {"role": "system", "content": RULES},
    {"role": "user", "content": "工具名 read_file：读取文本文件内容。参数 path，字符串，必填；max_bytes，整数，可选，1~1048576。\n"
                                "读一下 notes.txt 的内容。"},
]
out1, _ = chat(msgs)
msgs.append({"role": "assistant", "content": out1})
msgs.append({"role": "tool", "content": "错误：工具执行失败。"})
out2, _ = chat(msgs)
log("第 1 次：" + out1.replace("\n", " ")[:180])
log("喂回模糊错误后：" + out2.replace("\n", " ")[:200])

# ---------------- 4. 同一段话说两遍，看用量涨多少 ----------------
log("")
log("=== 4. 历史越长，每次请求付的输入 token 越多 ===")
base = [{"role": "user", "content": "读一下 notes.txt 的内容。"}]
for extra in (0, 2, 4, 8):
    msgs = [{"role": "system", "content": RULES}] + base
    for i in range(extra):
        msgs.append({"role": "assistant", "content": "{\"name\": \"read_file\", \"arguments\": {\"path\": \"notes.txt\"}}"})
        msgs.append({"role": "tool", "content": "第一行：会议时间改到周四下午三点。第二行：地点在三楼会议室。"})
    _out, usage = chat(msgs, max_tokens=20)
    log("历史里 %d 组额外的调用+结果：prompt_tokens = %d" % (extra, usage["prompt_tokens"]))

open(OUT, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("done", OUT)
