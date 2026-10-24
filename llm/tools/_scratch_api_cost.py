# -*- coding: utf-8 -*-
"""_scratch_api_cost.py —— 纯标准库，实测 token 用量并据此算成本公式。

所有「实测」数字来自本机 Ollama 的 OpenAI 兼容接口（qwen2:1.5b，CPU/GPU 混合运行）。
单价不写死：脚本把单价当变量，最后打印一张「代入你自己的单价」的表。
跑法：python tools/_scratch_api_cost.py
"""
import json
import urllib.request

BASE = "http://127.0.0.1:11434/v1"
MODEL = "qwen2:1.5b"

SYSTEM = "你是一个耐心的技术助手，回答要简短、准确、用中文。"
USER = "用三句话解释什么是 HTTP 请求。"


def ask(model, messages, max_tokens=80):
    payload = {"model": model, "messages": messages, "stream": False,
               "max_tokens": max_tokens, "temperature": 0.2}
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(BASE + "/chat/completions", data=body,
                                headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = json.loads(r.read().decode("utf-8"))
    return data["usage"], data["choices"][0]["message"]["content"]


def main():
    print("[1] 一次普通问答的 token 账（本机实测）")
    u1, a1 = ask(MODEL, [{"role": "system", "content": SYSTEM},
                         {"role": "user", "content": USER}])
    print("    system 段 %d 字、user 段 %d 字 → usage = %s"
          % (len(SYSTEM), len(USER), json.dumps(u1, ensure_ascii=False)))
    print("    回复 = %s" % a1[:60])

    print("\n[2] 只发 user、不发 system，固定开销少多少")
    u2, _ = ask(MODEL, [{"role": "user", "content": USER}])
    print("    不带 system → usage = %s（prompt_tokens 少了 %d）"
          % (json.dumps(u2, ensure_ascii=False), u1["prompt_tokens"] - u2["prompt_tokens"]))

    print("\n[3] 把同一段历史重复发 5 轮，输入 token 怎么涨")
    hist = []
    total_in = 0
    for turn in range(1, 6):
        hist.append({"role": "user", "content": "第 %d 个问题：HTTP 和 HTTPS 差在哪？" % turn})
        u, a = ask(MODEL, hist, max_tokens=40)
        hist.append({"role": "assistant", "content": a})
        total_in += u["prompt_tokens"]
        print("    第 %d 轮：prompt_tokens = %2d，累计输入 token = %3d"
              % (turn, u["prompt_tokens"], total_in))

    print("\n[4] 成本公式：总价 = 输入 token × 输入单价 + 输出 token × 输出单价")
    print("    设 1000 次请求，每次输入 %d token、输出 %d token"
          % (u1["prompt_tokens"], u1["completion_tokens"]))
    req = 1000
    tin = u1["prompt_tokens"] * req
    tout = u1["completion_tokens"] * req
    print("    总输入 = %d token = %.4f 百万 token" % (tin, tin / 1e6))
    print("    总输出 = %d token = %.4f 百万 token" % (tout, tout / 1e6))
    print("    下表把单价当变量（每百万 token 的价格，单位：元）——")
    print("    %-10s %-10s %12s" % ("输入单价", "输出单价", "总价（元）"))
    for pin in (0.5, 2.0, 4.0):
        for pout in (2.0, 8.0, 16.0):
            cost = tin / 1e6 * pin + tout / 1e6 * pout
            print("    %-10.1f %-10.1f %12.4f" % (pin, pout, cost))

    print("\n[5] 缓存命中的影响：输入里有多少是「每次都一样的前缀」")
    prefix = SYSTEM
    rest = USER
    # 用「同样一段前缀 + 不同问题」量出前缀占多少 token
    u3, _ = ask(MODEL, [{"role": "user", "content": prefix}], max_tokens=1)
    u4, _ = ask(MODEL, [{"role": "user", "content": prefix + rest}], max_tokens=1)
    print("    前缀 %d 字的 prompt_tokens = %d；前缀 + 问题 %d 字 = %d"
          % (len(prefix), u3["prompt_tokens"], len(prefix + rest), u4["prompt_tokens"]))
    print("    差 = %d token，这就是问题本身带来的增量；前缀每次都重发，但可以被缓存" % (u4["prompt_tokens"] - u3["prompt_tokens"]))


main()
