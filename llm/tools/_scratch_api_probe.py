# -*- coding: utf-8 -*-
"""_scratch_api_probe.py —— 纯标准库，实测本机 Ollama 的 OpenAI 兼容接口。

用途：给 data/inference-api.js 提供「本机实测」数字（请求往返耗时、首帧耗时、
流式分帧数量、每一帧的原始文本形状、usage 里的 token 数）。
只依赖 Python 标准库（urllib.request / json / time），不装 requests。

跑法：python tools/_scratch_api_probe.py
"""
import json
import time
import urllib.request

BASE = "http://127.0.0.1:11434/v1"
MODEL = "qwen2:1.5b"


def post(path, payload, stream):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        BASE + path,
        data=body,
        headers={"Content-Type": "application/json"},
    )
    t0 = time.perf_counter()
    resp = urllib.request.urlopen(req, timeout=120)
    return resp, t0, body


def main():
    # 1) 模型列表
    with urllib.request.urlopen(BASE + "/models", timeout=10) as r:
        models = json.loads(r.read().decode("utf-8"))
    print("[1] /v1/models 返回的模型：", [m["id"] for m in models.get("data", [])])

    prompt = "用一句话解释什么是 HTTP 请求。"
    payload = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "max_tokens": 60,
        "temperature": 0.2,
    }

    # 2) 非流式
    resp, t0, body = post("/chat/completions", payload, False)
    raw = resp.read()
    t1 = time.perf_counter()
    data = json.loads(raw.decode("utf-8"))
    msg = data["choices"][0]["message"]["content"]
    usage = data.get("usage", {})
    print("[2] 非流式：总耗时 %.3f 秒" % (t1 - t0))
    print("    请求体字节数 =", len(body), "；响应体字节数 =", len(raw))
    print("    usage =", json.dumps(usage, ensure_ascii=False))
    print("    回复字数 =", len(msg), "；回复内容 =", msg[:80])

    # 3) 流式
    p2 = dict(payload)
    p2["stream"] = True
    resp2, t2, _ = post("/chat/completions", p2, True)
    frames = []
    t_first = None
    while True:
        line = resp2.readline()
        if not line:
            break
        s = line.decode("utf-8")
        if s.startswith("data:"):
            if t_first is None:
                t_first = time.perf_counter()
            frames.append(s.rstrip("\n"))
    t3 = time.perf_counter()
    print("[3] 流式：首帧耗时 %.3f 秒；全流程 %.3f 秒" % (t_first - t2, t3 - t2))
    print("    data 帧数 =", len(frames))
    print("    首帧原文 =", repr(frames[0]) if frames else "(无)")
    print("    末帧原文 =", repr(frames[-1]) if frames else "(无)")
    if len(frames) > 2:
        print("    中间一帧 =", repr(frames[len(frames) // 2]))
    print("    每帧字节数（前 8 帧）=", [len(f.encode("utf-8")) for f in frames[:8]])

    # 4) 拼起来的正文与 usage
    text = ""
    usage2 = None
    for f in frames:
        payload_f = f[len("data:"):].strip()
        if payload_f == "[DONE]":
            continue
        obj = json.loads(payload_f)
        if obj.get("usage"):
            usage2 = obj["usage"]
        for ch in obj.get("choices", []):
            delta = ch.get("delta") or {}
            text += delta.get("content") or ""
    print("[4] 拼接后正文 =", text[:120])
    print("    拼接后字数 =", len(text))
    print("    流式 usage =", json.dumps(usage2, ensure_ascii=False) if usage2 else "(没有)")
    if usage.get("completion_tokens") and text:
        print("    平均每个 token 对应字符数 = %.2f" % (len(text) / usage["completion_tokens"]))


main()
