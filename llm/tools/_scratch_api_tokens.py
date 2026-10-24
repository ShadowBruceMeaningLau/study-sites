# -*- coding: utf-8 -*-
"""_scratch_api_tokens.py —— 纯标准库，实测「一段文字要花多少 token」与
「流式一帧里到底装了几个字」，以及一次失败重试的时间账。

全部数字都是本机实测（Ollama 的 OpenAI 兼容接口 + 本机 CPU 上的 qwen2:1.5b）。
跑法：python tools/_scratch_api_tokens.py
"""
import json
import time
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:11434/v1"
MODEL = "qwen2:1.5b"


def usage_for(text):
    """把 text 当成一条用户消息发过去，只要 usage 里的 prompt_tokens（不关心回复）。"""
    payload = {
        "model": MODEL,
        "messages": [{"role": "user", "content": text}],
        "stream": False,
        "max_tokens": 1,
    }
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(BASE + "/chat/completions", data=body,
                                headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = json.loads(r.read().decode("utf-8"))
    return data["usage"]["prompt_tokens"]


def main():
    samples = [
        ("纯中文 12 字", "我们学习中文分词"),
        ("纯中文 21 字", "用一句话解释什么是 HTTP 请求。"),
        ("纯英文 6 词", "hello world how are you today"),
        ("一段 JSON", '{"model": "qwen2:1.5b", "stream": false}'),
        ("一句中文口语 30 字", "请把下面这三条用户反馈归纳成一段不超过八十个字的总结并列出问题清单"),
    ]
    print("[1] 一段文字要花多少 input token（本机实测，含对话模板的固定开销）")
    base = None
    for name, s in samples:
        n = usage_for(s)
        if base is None:
            base = n
        print("    %-18s 字符数 %3d → prompt_tokens %3d（%.2f 字符/token）"
              % (name, len(s), n, len(s) / n))

    # 空消息的固定开销：一条最短的消息也要付模板的钱
    n_min = usage_for("嗨")
    print("    最短消息「嗨」（1 字）也要 %d 个 prompt_tokens —— 这就是模板的固定开销" % n_min)

    # 2) 流式：一帧里装几个字
    payload = {
        "model": MODEL,
        "messages": [{"role": "user", "content": "用一句话解释什么是 HTTP 请求。"}],
        "stream": True,
        "max_tokens": 60,
        "temperature": 0.2,
    }
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(BASE + "/chat/completions", data=body,
                                headers={"Content-Type": "application/json"})
    t0 = time.perf_counter()
    with urllib.request.urlopen(req, timeout=120) as r:
        lens = []
        pieces = []
        raw_lines = 0
        while True:
            line = r.readline()
            if not line:
                break
            s = line.decode("utf-8")
            if not s.startswith("data:"):
                raw_lines += 1
                continue
            p = s[len("data:"):].strip()
            if p == "[DONE]":
                continue
            obj = json.loads(p)
            piece = (obj["choices"][0]["delta"] or {}).get("content") or ""
            if piece:
                lens.append(len(piece))
                pieces.append(piece)
    t1 = time.perf_counter()
    print("\n[2] 流式分帧（本机实测）")
    print("    正文帧数 = %d；累计字数 = %d；耗时 %.3f 秒" % (len(lens), sum(lens), t1 - t0))
    print("    每帧字数序列 =", lens)
    print("    只装了 1 个字的帧 = %d 个；装了 2 个及以上的帧 = %d 个"
          % (sum(1 for x in lens if x == 1), sum(1 for x in lens if x >= 2)))
    print("    非 data: 开头的行（空行分隔符等）= %d 行" % raw_lines)
    print("    拼起来 =", "".join(pieces))

    # 3) 超时与重试的时间账：真打一个会超时的请求，量出花了多久
    t2 = time.perf_counter()
    try:
        urllib.request.urlopen(BASE + "/models", timeout=0.001)
        print("\n[3] 0.001 秒超时居然成功了（这行不该出现）")
    except Exception as e:
        dt = time.perf_counter() - t2
        print("\n[3] 把 timeout 设成 0.001 秒：%.3f 秒后抛出 %s" % (dt, type(e).__name__))
        print("    异常文本 =", str(e)[:70])

    # 4) 指数退避：三次重试之间睡多久、总共多久（时钟实测）
    waits = [0.5, 1.0, 2.0]
    t3 = time.perf_counter()
    for i, w in enumerate(waits, 1):
        time.sleep(w)
        print("[4] 第 %d 次重试之前等了 %.1f 秒（累计 %.3f 秒）"
              % (i, w, time.perf_counter() - t3))
    print("    三次都失败的话，光等待就花了 %.3f 秒（不含请求本身）"
          % (time.perf_counter() - t3))


main()
