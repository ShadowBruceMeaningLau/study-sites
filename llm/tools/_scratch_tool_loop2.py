# -*- coding: utf-8 -*-
# 复核：qwen2:1.5b 的对话模板怎么处理 tool 角色；历史变长时 prompt_tokens 怎么涨
import json
import urllib.request

OUT = "tools/_scratch_tool_loop2.out"
URL = "http://127.0.0.1:11434/v1/chat/completions"
MODEL = "qwen2:1.5b"
lines = []


def log(*a):
    lines.append(" ".join(str(x) for x in a))


def chat(messages, max_tokens=200):
    payload = {"model": MODEL, "messages": messages, "stream": False,
               "max_tokens": max_tokens, "temperature": 0}
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as resp:
        d = json.loads(resp.read().decode("utf-8"))
    ch = d["choices"][0]
    return ch["message"]["content"], d["usage"], ch.get("finish_reason")


RULES = ("你可以调用工具，调用时只输出一行 JSON："
         "{\"name\": \"工具名\", \"arguments\": {...}}。不需要工具就直接回答。不要解释。")

log("=== A) tool 角色是否被接受 ===")
msgs = [
    {"role": "system", "content": RULES},
    {"role": "user", "content": "工具名 read_file：读文件。参数 path 必填。读一下 notes.txt。"},
    {"role": "assistant", "content": "{\"name\": \"read_file\", \"arguments\": {\"path\": \"notes.txt\"}}"},
    {"role": "tool", "content": "第一行：会议改到周四下午三点。"},
    {"role": "user", "content": "上面工具返回了什么？照抄一遍。"},
]
out, usage, fin = chat(msgs)
log("content：%r  finish_reason=%s  usage=%s" % (out, fin, usage))

log("")
log("=== B) 把工具结果改写成 user 角色再说一遍 ===")
msgs = [
    {"role": "system", "content": RULES},
    {"role": "user", "content": "工具名 read_file：读文件。参数 path 必填。读一下 notes.txt。"},
    {"role": "assistant", "content": "{\"name\": \"read_file\", \"arguments\": {\"path\": \"notes.txt\"}}"},
    {"role": "user", "content": "工具 read_file 的返回：第一行：会议改到周四下午三点。请根据返回内容回答我的问题。"},
]
out, usage, fin = chat(msgs)
log("content：%r  finish_reason=%s  usage=%s" % (out, fin, usage))

log("")
log("=== C) 历史变长时 prompt_tokens（工具结果按 user 角色回填）===")
for extra in (0, 1, 2, 4, 8):
    msgs = [{"role": "system", "content": RULES},
            {"role": "user", "content": "工具名 read_file：读文件。参数 path 必填。读一下 notes.txt。"}]
    for i in range(extra):
        msgs.append({"role": "assistant", "content": "{\"name\": \"read_file\", \"arguments\": {\"path\": \"notes.txt\"}}"})
        msgs.append({"role": "user", "content": "工具返回：第一行：会议时间改到周四下午三点。第二行：地点在三楼会议室。"})
    out, usage, fin = chat(msgs, max_tokens=20)
    log("额外 %d 组「调用+结果」：prompt_tokens = %d" % (extra, usage["prompt_tokens"]))

log("")
log("=== D) 错误回灌（用 user 角色回填错误）===")
msgs = [
    {"role": "system", "content": RULES},
    {"role": "user", "content": "工具名 read_file：读文件。参数 path，字符串，必填；max_bytes，整数，可选，范围 1~4096。读一下 notes.txt。"},
]
out1, u1, _ = chat(msgs)
log("第 1 次：%r" % out1)
msgs.append({"role": "assistant", "content": out1})
msgs.append({"role": "user", "content": "工具返回错误：参数 max_bytes 必须是整数，收到的是字符串「很多」。请修正参数后重新输出一行 JSON。"})
out2, u2, _ = chat(msgs)
log("喂回具体错误后：%r" % out2)
log("喂回具体错误后 finish_reason/usage：%s / %s" % (chat(msgs)[2], chat(msgs)[1]))

open(OUT, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("done", OUT)
