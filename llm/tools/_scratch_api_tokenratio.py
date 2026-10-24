# -*- coding: utf-8 -*-
"""_scratch_api_tokenratio.py —— 纯标准库：量出「对话模板的固定开销」与
「中文每 token 装几个字符」，并据此给出一个能自查的估算公式。

本机实测：Ollama 的 OpenAI 兼容接口，模型 qwen2:1.5b（CPU/GPU 混合，RTX 4060 Laptop 8GB）。
做法：max_tokens=1，只关心返回的 usage.prompt_tokens。
跑法：python tools/_scratch_api_tokenratio.py
"""
import json
import urllib.request

BASE = "http://127.0.0.1:11434/v1"
MODEL = "qwen2:1.5b"


def pt(text):
    payload = {"model": MODEL, "messages": [{"role": "user", "content": text}],
               "stream": False, "max_tokens": 1}
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(BASE + "/chat/completions", data=body,
                                headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))["usage"]["prompt_tokens"]


def main():
    print("[1] 对话模板的固定开销（同一句话，只改长度）")
    probes = ["嗨", "嗨嗨", "嗨嗨嗨嗨", "嗨嗨嗨嗨嗨嗨嗨嗨"]
    base = None
    for s in probes:
        n = pt(s)
        if base is None:
            base = n
        print("    正文 %d 个字（全是「嗨」）→ prompt_tokens = %2d（多出来 %d）"
              % (len(s), n, n - base))
    print("    结论：模板自己吃掉 %d 个 token，它跟正文长短无关，每次请求都要付" % base)

    print("\n[2] 中文正文的字符/token 比（减去模板开销后再算）")
    texts = [
        ("8 字", "我们学习中文分词"),
        ("18 字", "用一句话解释什么是 HTTP 请求。"),
        ("24 字", "请把下面这三条用户反馈归纳成一段总结"),
        ("48 字", "请把下面这三条用户反馈归纳成一段不超过八十个字的总结并列出问题清单"),
        ("72 字", "你是一个耐心的技术助手。回答要简短、准确、用中文。遇到不确定的地方，直接说明不确定，不要编造。所有回答都用三句话以内讲清楚。"),
    ]
    for name, s in texts:
        n = pt(s)
        body_n = n - base
        print("    %-6s 字符 %2d → prompt_tokens %3d，扣掉模板后 %2d token，%.2f 字符/token"
              % (name, len(s), n, body_n, len(s) / body_n if body_n else 0))

    print("\n[3] 一条长中文的压缩率（160 字）")
    long_text = ("请把下面这段技术说明改写成给完全不懂编程的人看的版本，"
                 "保留所有关键结论，删掉代码细节，不要使用任何专业缩写，"
                 "分三段，每段不超过五十字，最后用一句话总结。") * 2
    n = pt(long_text)
    print("    字符 %d → prompt_tokens %d，扣掉模板后 %d token，%.2f 字符/token"
          % (len(long_text), n, n - base, len(long_text) / (n - base)))

    print("\n[4] 英文与代码的对照（同样字符数，token 数完全不同）")
    for name, s in [("英文 48 字符", "please summarize the three user reports above"),
                    ("JSON 48 字符", '{"model":"qwen2:1.5b","stream":false,"max_tokens":1}')]:
        n = pt(s)
        print("    %-14s 字符 %d → 扣模板后 %d token，%.2f 字符/token"
              % (name, len(s), n - base, len(s) / (n - base)))

    print("\n[5] 估算公式（用本机实测的系数，别当普适常数）")
    print("    输入 token ≈ 模板 %d + 中文字符数 ÷ 1.5 ~ 2.0" % base)
    print("    反过来：想知道一段中文多少钱，先数它的字符数，再除以一个实测出来的系数。")


main()
