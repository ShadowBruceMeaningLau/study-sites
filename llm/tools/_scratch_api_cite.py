# -*- coding: utf-8 -*-
"""_scratch_api_cite.py —— 纯标准库：一次性把 data/inference-api.js 正文里
要引用的每个数字都实测打印出来（带标签），正文只抄这里的输出，不手算、不记忆。

本机实测条件：Ollama 的 OpenAI 兼容接口 http://127.0.0.1:11434/v1，
模型 qwen2:1.5b，RTX 4060 Laptop 8GB，单次单请求。
跑法：python tools/_scratch_api_cite.py
"""
import json
import time
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:11434/v1"
MODEL = "qwen2:1.5b"
PROMPT = "用一句话解释什么是 HTTP 请求。"


def post_json(path, payload, timeout=120):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(BASE + path, data=body,
                                headers={"Content-Type": "application/json"})
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
            t1 = time.perf_counter()
            return {"status": r.status, "body_bytes": body, "raw": raw,
                    "elapsed": t1 - t0, "err": None}
    except urllib.error.HTTPError as e:
        t1 = time.perf_counter()
        raw = e.read()
        return {"status": e.code, "body_bytes": body, "raw": raw,
                "elapsed": t1 - t0, "err": "HTTPError"}
    except Exception as e:
        t1 = time.perf_counter()
        return {"status": None, "body_bytes": body, "raw": b"",
                "elapsed": t1 - t0, "err": type(e).__name__}


def label(k, v):
    print("%-38s %s" % (k, v))


def main():
    # ---------- A. 一次普通（非流式）请求的账
    payload = {"model": MODEL, "messages": [{"role": "user", "content": PROMPT}],
               "stream": False, "max_tokens": 60, "temperature": 0.2}
    r = post_json("/chat/completions", payload)
    data = json.loads(r["raw"].decode("utf-8"))
    msg = data["choices"][0]["message"]["content"]
    u = data["usage"]
    print("== A. 非流式一次请求 ==")
    label("请求体字节数", len(r["body_bytes"]))
    label("响应体字节数", len(r["raw"]))
    label("回复正文字符数", len(msg))
    label("回复正文 UTF-8 字节数", len(msg.encode("utf-8")))
    label("结构外壳字节数（响应体减正文）", len(r["raw"]) - len(msg.encode("utf-8")))
    label("prompt_tokens / completion_tokens / total_tokens",
          "%d / %d / %d" % (u["prompt_tokens"], u["completion_tokens"], u["total_tokens"]))
    label("端到端耗时（秒）", "%.3f" % r["elapsed"])
    label("每个 completion token 平均几个字符", "%.2f" % (len(msg) / u["completion_tokens"]))
    label("HTTP 状态码", r["status"])

    # ---------- B. 两种典型错误的状态码
    print("\n== B. 两种典型错误（本机实测）==")
    bad = dict(payload)
    bad["model"] = "no-such-model"
    rb = post_json("/chat/completions", bad)
    label("模型名写错 → 状态码", rb["status"])
    label("模型名写错 → 响应体前 90 字节", rb["raw"][:90].decode("utf-8", "replace"))
    label("模型名写错 → 耗时（秒）", "%.3f" % rb["elapsed"])

    try:
        req = urllib.request.Request(BASE + "/chat/completions")
        with urllib.request.urlopen(req, timeout=10) as rr:
            label("GET 到 chat/completions → 状态码", rr.status)
    except urllib.error.HTTPError as e:
        label("GET 到 chat/completions → 状态码", e.code)
        label("同上响应体前 90 字节", e.read()[:90].decode("utf-8", "replace"))
    except Exception as e:
        label("GET 到 chat/completions → 异常", type(e).__name__)

    # ---------- C. 流式：分帧与首帧延迟
    print("\n== C. 流式一次请求 ==")
    p2 = dict(payload)
    p2["stream"] = True
    body = json.dumps(p2, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(BASE + "/chat/completions", data=body,
                                headers={"Content-Type": "application/json"})
    t0 = time.perf_counter()
    with urllib.request.urlopen(req, timeout=120) as resp:
        t_first = None
        data_frames = []
        blank_lines = 0
        other_prefix = 0
        while True:
            line = resp.readline()
            if not line:
                break
            s = line.decode("utf-8")
            if not s.strip():
                blank_lines += 1
                continue
            if not s.startswith("data:"):
                other_prefix += 1
                continue
            if t_first is None:
                t_first = time.perf_counter()
            data_frames.append(s.rstrip("\n"))
    t_end = time.perf_counter()
    content_frames = [f for f in data_frames if f[len("data:"):].strip() != "[DONE]"]
    done = len(data_frames) - len(content_frames)
    lens = []
    text = ""
    for f in content_frames:
        obj = json.loads(f[len("data:"):].strip())
        piece = (obj["choices"][0]["delta"] or {}).get("content") or ""
        lens.append(len(piece))
        text += piece
    label("首帧到达耗时（秒）", "%.3f" % (t_first - t0))
    label("从首帧到收尾帧（秒）", "%.3f" % (t_end - t_first))
    label("端到端总耗时（秒）", "%.3f" % (t_end - t0))
    label("data: 帧总数 / 正文帧 / 收尾帧", "%d / %d / %d" % (len(data_frames), len(content_frames), done))
    label("空行数 / 非 data: 前缀行数", "%d / %d" % (blank_lines, other_prefix))
    label("拼起来正文的字符数", len(text))
    label("正文拼接结果", text)
    label("每帧字数序列", lens)
    label("只装 1 个字的帧 / 装 2 个及以上的帧",
          "%d / %d" % (sum(1 for x in lens if x == 1), sum(1 for x in lens if x >= 2)))
    label("平均每帧字数", "%.2f" % (sum(lens) / len(lens)))
    label("平均相邻帧间隔（毫秒）", "%.1f" % ((t_end - t_first) * 1000 / len(content_frames)))
    label("data 帧的 UTF-8 字节数（首 5 帧）",
          [len(x.encode("utf-8")) for x in data_frames[:5]])
    label("末帧原文", repr(data_frames[-1]))
    label("首帧原文（截 100 字符）", repr(data_frames[0][:100]))
    label("流式响应里有没有 usage 字段",
          any("usage" in json.loads(f[len("data:"):].strip()) for f in content_frames))

    # ---------- D. 对话历史越长，输入 token 越多
    print("\n== D. 5 轮对话的输入 token 增长 ==")
    hist = []
    acc = 0
    for turn in range(1, 6):
        hist.append({"role": "user", "content": "第 %d 个问题：HTTP 和 HTTPS 差在哪？" % turn})
        rr = post_json("/chat/completions", {"model": MODEL, "messages": hist,
                                             "stream": False, "max_tokens": 40})
        d = json.loads(rr["raw"].decode("utf-8"))
        hist.append({"role": "assistant", "content": d["choices"][0]["message"]["content"]})
        acc += d["usage"]["prompt_tokens"]
        label("第 %d 轮的 prompt_tokens（累计 %d）" % (turn, acc), d["usage"]["prompt_tokens"])

    # ---------- E. 一段文字的 token 账（模板开销从 1 字消息量出来）
    print("\n== E. 模板固定开销与字符/token 比 ==")

    def pt(text):
        rr = post_json("/chat/completions", {"model": MODEL, "max_tokens": 1,
                                             "messages": [{"role": "user", "content": text}]})
        return json.loads(rr["raw"].decode("utf-8"))["usage"]["prompt_tokens"]

    base = pt("嗨")
    label("1 个字的消息也要付的 prompt_tokens", base)
    for name, s in [("18 字中文", "用一句话解释什么是 HTTP 请求。"),
                    ("33 字中文", "请把下面这三条用户反馈归纳成一段不超过八十个字的总结并列出问题清单"),
                    ("152 字中文", "请把下面这段技术说明改写成给完全不懂编程的人看的版本，"
                                   "保留所有关键结论，删掉代码细节，不要使用任何专业缩写，"
                                   "分三段，每段不超过五十字，最后用一句话总结。" * 2),
                    ("45 字符英文", "please summarize the three user reports above"),
                    ("52 字符 JSON", '{"model":"qwen2:1.5b","stream":false,"max_tokens":1}')]:
        n = pt(s)
        label("  %s（字符 %d）→ prompt_tokens %d，扣模板后 %d token，%.2f 字符/token"
              % (name, len(s), n, n - base, len(s) / (n - base)), "")

    # ---------- F. 超时真正花了多久
    print("\n== F. 超时与退避（本机实测 + 纯时钟）==")
    t0 = time.perf_counter()
    try:
        p3 = dict(payload)
        p3["max_tokens"] = 200
        post_json("/chat/completions", p3, timeout=0.05)
        label("0.05 秒超时居然成功", "（不该出现）")
    except Exception as e:
        label("0.05 秒超时 → 实际 %.3f 秒后抛" % (time.perf_counter() - t0), type(e).__name__)
    t0 = time.perf_counter()
    p4 = dict(payload)
    p4["max_tokens"] = 200
    r4 = post_json("/chat/completions", p4, timeout=60)
    label("同样请求给 60 秒超时 → 成功耗时（秒）", "%.3f" % r4["elapsed"])
    label("  completion_tokens",
          json.loads(r4["raw"].decode("utf-8"))["usage"]["completion_tokens"])

    import random
    random.seed(20261024)
    waits = []
    for k in range(5):
        raw_w = min(8.0, 0.5 * (2 ** k))
        j = random.uniform(0, raw_w / 2)
        waits.append(raw_w + j)
        label("  第 %d 次重试：min(8, 0.5×2^%d)=%.2f + 抖动 %.2f" % (k + 1, k, raw_w, j),
              "→ 实等 %.2f 秒" % waits[-1])
    label("五次退避合计等待（秒）", "%.2f" % sum(waits))

    print("\n== G. 重试把成功率抬多高（纯算术）==")
    for p in (0.5, 0.8, 0.95):
        row = []
        for n in (1, 2, 3, 5):
            row.append("试%d次→%.4f" % (n, 1 - (1 - p) ** n))
        label("  单次成功率 %.2f" % p, "  ".join(row))

    print("\n== H. 成本公式（单价当变量，不写死任何一家价格）==")
    tin, tout, req_n = 37, 36, 1000
    label("假设每次输入 %d token、输出 %d token、共 %d 次请求" % (tin, tout, req_n),
          "总输入 %.4f 百万 token，总输出 %.4f 百万 token"
          % (tin * req_n / 1e6, tout * req_n / 1e6))
    for pin in (1.0, 4.0):
        for pout in (4.0, 16.0):
            cost = tin * req_n / 1e6 * pin + tout * req_n / 1e6 * pout
            label("  输入单价 %.0f 元/百万 + 输出单价 %.0f 元/百万" % (pin, pout),
                  "总价 %.4f 元" % cost)


main()
