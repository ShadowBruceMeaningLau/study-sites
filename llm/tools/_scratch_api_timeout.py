# -*- coding: utf-8 -*-
"""_scratch_api_timeout.py —— 纯标准库，实测「超时」这件事：
设一个比生成耗时还短的 timeout，看抛什么异常、花了多久；
再实测一次指数退避 + 抖动的时间账。

跑法：python tools/_scratch_api_timeout.py
"""
import json
import random
import statistics
import time
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:11434/v1"
MODEL = "qwen2:1.5b"


def chat(timeout, max_tokens=200, stream=False):
    payload = {
        "model": MODEL,
        "messages": [{"role": "user", "content": "请写一段两百字左右的说明，讲清楚什么叫网络请求。"}],
        "stream": stream,
        "max_tokens": max_tokens,
    }
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(BASE + "/chat/completions", data=body,
                                headers={"Content-Type": "application/json"})
    return urllib.request.urlopen(req, timeout=timeout)


def main():
    print("[1] 把超时设成 0.05 秒，去打一个要生成两百字的请求")
    t0 = time.perf_counter()
    try:
        r = chat(0.05)
        r.read()
        print("    居然没超时（这行不该出现）")
    except Exception as e:
        dt = time.perf_counter() - t0
        print("    %.3f 秒后抛出 %s" % (dt, type(e).__name__))
        print("    异常文本 =", str(e)[:80])
        print("    它是 urllib.error.URLError 的子类吗：",
              isinstance(e, urllib.error.URLError))

    print("\n[2] 同一个请求给 60 秒超时，量出真实耗时")
    t0 = time.perf_counter()
    with chat(60) as r:
        data = json.loads(r.read().decode("utf-8"))
    dt = time.perf_counter() - t0
    print("    成功，耗时 %.3f 秒；completion_tokens = %d"
          % (dt, data["usage"]["completion_tokens"]))

    print("\n[3] 指数退避 + 抖动的公式实算（base=0.5，上限 8 秒，5 次重试）")
    random.seed(20261024)
    waits = []
    for k in range(5):
        raw = min(8.0, 0.5 * (2 ** k))
        jitter = random.uniform(0, raw / 2)
        waits.append(raw + jitter)
        print("    第 %d 次重试：min(8, 0.5×2^%d) = %.2f 秒，加抖动 %.2f → 实际等 %.2f 秒"
              % (k + 1, k, raw, jitter, waits[-1]))
    print("    五次合计等待 %.2f 秒（不含每次请求本身的耗时）" % sum(waits))
    print("    平均每次 %.2f 秒；最大 %.2f 秒" % (statistics.mean(waits), max(waits)))

    print("\n[4] 重试能让「总成功率」变多高：单次成功率 p，重试 n 次后的成功率")
    for p in (0.5, 0.8, 0.95):
        for n in (1, 2, 3, 5):
            print("    p=%.2f、最多试 %d 次 → 全部失败的概率 %.4f，最终成功率 %.4f"
                  % (p, n, (1 - p) ** n, 1 - (1 - p) ** n))
        print("")


main()
