# -*- coding: utf-8 -*-
"""_scratch_api_sse.py —— 纯标准库：把 SSE 的字节流「按帧切半」再拼回去，
量出半截 JSON 到底会报什么错、缓冲该怎么写。

不联网、不发请求；所有输入都是脚本里写死的字节串，结果是确定的。
跑法：python tools/_scratch_api_sse.py
"""
import json


def show_bytes(b):
    return " ".join("%02X" % x for x in b)


def main():
    # 一帧真实的 SSE 数据（形状照 Ollama 的 OpenAI 兼容接口，内容已删短）
    line = ('data: {"id":"chatcmpl-1","choices":[{"index":0,'
            '"delta":{"content":"你"},"finish_reason":null}]}\n')
    raw = line.encode("utf-8")
    print("[1] 一整帧（含行尾换行）：共 %d 字节" % len(raw))
    print("    原文 =", repr(line))

    # 按字节切两半：模拟「网络把一个 TCP 包拆成了两个」
    cut = len(raw) // 2
    a, b = raw[:cut], raw[cut:]
    print("\n[2] 在第 %d 字节处切开（模拟一次 read 只到一半）" % cut)
    print("    前半段尾部 =", show_bytes(a[-8:]), "（%d 字节）" % len(a))
    print("    后半段头部 =", show_bytes(b[:8]), "（%d 字节）" % len(b))

    # 对前半段直接解析会怎样
    body_a = a.decode("utf-8", "replace")
    print("\n[3] 拿前半段去 json.loads：", end="")
    if body_a.startswith("data:"):
        body_a_payload = body_a[len("data:"):].strip()
        try:
            json.loads(body_a_payload)
            print("居然成功了（这行不该出现）")
        except Exception as e:
            print("抛 %s：%s" % (type(e).__name__, str(e)[:60]))
    print("    原因：JSON 是有头有尾的结构，少一个右花括号就不再是完整对象。")

    # 正确写法：攒着，直到看见行尾换行才切一帧
    buf = ""
    frames = []
    for piece in [a, b]:
        buf += piece.decode("utf-8")
        while "\n" in buf:
            one, buf = buf.split("\n", 1)
            frames.append(one)
    print("\n[4] 按「行尾换行」切帧：得到 %d 帧，残留缓冲 %d 字节" % (len(frames), len(buf.encode("utf-8"))))
    ok = 0
    for f in frames:
        if f.startswith("data:"):
            p = f[len("data:"):].strip()
            obj = json.loads(p)
            ok += 1
            print("    解析成功：delta.content =", obj["choices"][0]["delta"]["content"])
    print("    成功解析 %d 帧" % ok)

    # 一个 emoji 被切成两半：多字节字符跨帧
    emoji = "🔌".encode("utf-8")
    print("\n[5] 一个 emoji 占 %d 字节：" % len(emoji), show_bytes(emoji))
    half1, half2 = emoji[:2], emoji[2:]
    bad = half1.decode("utf-8", "replace")
    print("    前 2 字节单独解码（用替换字符兜底）= %r，已经变形" % bad)
    good = (half1 + half2).decode("utf-8")
    print("    拼齐 4 字节再解码 = %r，还原成功" % good)
    print("    结论：必须按「字节」攒，攒够一整行再解码；按字符攒会把中文/emoji 切坏。")

    # 缓冲区上限：一帧最长能有多长（用它防内存被撑爆）
    longest = 0
    for i in range(1, 200):
        s = 'data: {"choices":[{"delta":{"content":"%s"}}]}\n' % ("字" * i)
        longest = max(longest, len(s.encode("utf-8")))
    print("\n[6] 正文 199 个字的一帧有 %d 字节；实践里给缓冲区设一个上限（比如 1MB）就够用" % longest)


main()
