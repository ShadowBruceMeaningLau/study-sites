# -*- coding: utf-8 -*-
"""_scratch_api_frames.py —— 纯标准库：把流式响应的「响应头 + 最后一帧 + usage 从哪来」
这三件事量清楚，给 api-3 / api-4 / api-6 用。

本机实测：Ollama 的 OpenAI 兼容接口，模型 qwen2:1.5b。
跑法：python tools/_scratch_api_frames.py
"""
import json
import urllib.request

BASE = "http://127.0.0.1:11434/v1"
MODEL = "qwen2:1.5b"


def stream(payload):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(BASE + "/chat/completions", data=body,
                                headers={"Content-Type": "application/json"})
    resp = urllib.request.urlopen(req, timeout=120)
    lines = []
    while True:
        line = resp.readline()
        if not line:
            break
        lines.append(line.decode("utf-8"))
    return resp, lines


def main():
    payload = {"model": MODEL, "stream": True, "max_tokens": 40, "temperature": 0.2,
               "messages": [{"role": "user", "content": "数到五"}]}

    print("[1] 流式响应的响应头")
    resp, lines = stream(payload)
    for k in ("Content-Type", "Transfer-Encoding", "Cache-Control", "Connection"):
        print("    %-20s %s" % (k, resp.headers.get(k)))
    print("    所有响应头字段名 =", list(resp.headers.keys()))

    print("\n[2] 每一行的形状（前 3 行 + 后 3 行）")
    for s in lines[:3]:
        print("    前:", repr(s))
    for s in lines[-3:]:
        print("    后:", repr(s))

    print("\n[3] 最后一帧的 delta 和 finish_reason")
    frames = [s for s in lines if s.startswith("data:") and s.strip() != "data: [DONE]"]
    last = json.loads(frames[-1][len("data:"):].strip())
    print("    末正文帧原文 =", repr(frames[-1].strip()[:200]))
    print("    choices[0].delta =", json.dumps(last["choices"][0].get("delta"), ensure_ascii=False))
    print("    choices[0].finish_reason =", last["choices"][0].get("finish_reason"))
    print("    这个末帧的 object 字段 =", last.get("object"))

    print("\n[4] 默认流式响应里有没有 usage")
    print("    有 usage 的帧数 =", sum(1 for f in frames if "usage" in f))

    print("\n[5] 加 stream_options.include_usage 之后")
    p2 = dict(payload)
    p2["stream_options"] = {"include_usage": True}
    resp2, lines2 = stream(p2)
    fr2 = [s for s in lines2 if s.startswith("data:") and s.strip() != "data: [DONE]"]
    with_usage = [f for f in fr2 if "usage" in f]
    print("    帧数 =", len(fr2), "；带 usage 的帧数 =", len(with_usage))
    if with_usage:
        u = json.loads(with_usage[-1][len("data:"):].strip())
        print("    那一帧的 usage =", json.dumps(u.get("usage"), ensure_ascii=False))
        print("    那一帧的 choices =", json.dumps(u.get("choices"), ensure_ascii=False))

    print("\n[6] 非流式与流式的正文长度对照（同样的提示）")
    p3 = {"model": MODEL, "stream": False, "max_tokens": 40, "temperature": 0.2,
          "messages": [{"role": "user", "content": "数到五"}]}
    body = json.dumps(p3, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(BASE + "/chat/completions", data=body,
                                headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        d = json.loads(r.read().decode("utf-8"))
    print("    非流式 =", repr(d["choices"][0]["message"]["content"][:60]),
          "usage =", json.dumps(d["usage"], ensure_ascii=False))


main()
