# -*- coding: utf-8 -*-
# tool-5 的核心实测：工具结果以不同角色/位置回填，模型能不能把它照抄出来
# 材料里放一个不易猜的标记（工位号 B-217），统计 3 种回填方式的复述率
import json
import urllib.request

OUT = "tools/_scratch_tool_fill.out"
URL = "http://127.0.0.1:11434/v1/chat/completions"
MODEL = "qwen2:1.5b"
lines = []


def log(*a):
    lines.append(" ".join(str(x) for x in a))


def chat(messages, max_tokens=60):
    payload = {"model": MODEL, "messages": messages, "stream": False,
               "max_tokens": max_tokens, "temperature": 0}
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as resp:
        d = json.loads(resp.read().decode("utf-8"))
    return d["choices"][0]["message"]["content"], d["usage"]

FACT = "新工位号是 B-217，本周五搬到三楼东侧。"
Q = "新工位号是多少？只回答编号。"

CASES = {
    "tool 角色紧跟调用": [
        {"role": "system", "content": "你可以调用工具。调用时只输出一行 JSON。"},
        {"role": "user", "content": "查一下我的新工位。工具名 get_desk：查工位信息。参数 who，字符串，必填。"},
        {"role": "assistant", "content": "{\"name\": \"get_desk\", \"arguments\": {\"who\": \"我\"}}"},
        {"role": "tool", "tool_call_id": "c1", "content": FACT},
        {"role": "user", "content": Q},
    ],
    "user 角色写明「工具返回」": [
        {"role": "system", "content": "你可以调用工具。调用时只输出一行 JSON。"},
        {"role": "user", "content": "查一下我的新工位。工具名 get_desk：查工位信息。参数 who，字符串，必填。"},
        {"role": "assistant", "content": "{\"name\": \"get_desk\", \"arguments\": {\"who\": \"我\"}}"},
        {"role": "user", "content": "工具 get_desk 返回：" + FACT},
        {"role": "user", "content": Q},
    ],
    "不回填（只有调用，没有结果）": [
        {"role": "system", "content": "你可以调用工具。调用时只输出一行 JSON。"},
        {"role": "user", "content": "查一下我的新工位。工具名 get_desk：查工位信息。参数 who，字符串，必填。"},
        {"role": "assistant", "content": "{\"name\": \"get_desk\", \"arguments\": {\"who\": \"我\"}}"},
        {"role": "user", "content": Q},
    ],
}

for tag, msgs in CASES.items():
    ok = 0
    runs = 5
    log("=== " + tag + " ===")
    for r in range(runs):
        out, usage = chat(msgs)
        hit = "B-217" in out
        ok += 1 if hit else 0
        log("轮 %d：%s | 复述到 B-217：%s | prompt_tokens=%d"
            % (r + 1, out.replace("\n", " ")[:100], "是" if hit else "否", usage["prompt_tokens"]))
    log("复述率：%d / %d" % (ok, runs))
    log("")

open(OUT, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("done", OUT)
