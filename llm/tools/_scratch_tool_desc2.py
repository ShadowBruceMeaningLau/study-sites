# -*- coding: utf-8 -*-
# 复审：模糊 / 精确描述各跑 3 轮 × 3 个任务，统计「输出能否被 json.loads 解析」与「字段是否齐全」
import json
import urllib.request

OUT = "tools/_scratch_tool_desc2.out"
URL = "http://127.0.0.1:11434/v1/chat/completions"
MODEL = "qwen2:1.5b"
lines = []


def log(*a):
    lines.append(" ".join(str(x) for x in a))


def ask(prompt, max_tokens=140):
    payload = {"model": MODEL, "messages": [{"role": "user", "content": prompt}],
               "stream": False, "max_tokens": max_tokens, "temperature": 0}
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as resp:
        return json.loads(resp.read().decode("utf-8"))["choices"][0]["message"]["content"]


VAGUE = "工具名 read_file：读文件。参数 path。"
PRECISE = ("工具名 read_file：读取一个 UTF-8 文本文件的前 N 个字节并返回内容。"
           "参数：(1) path，字符串，必填，相对路径，例如 notes.txt，不能包含 .. ；"
           "(2) max_bytes，整数，可选，范围 1~1048576，缺省 4096。")

TASKS = ["把 notes.txt 读出来看看。", "帮我看看 data 目录下所有文件。", "读一下 /etc/hosts 的内容。"]

for tag, desc in (("模糊描述", VAGUE), ("精确描述", PRECISE)):
    parseable = 0
    runs = 0
    log("=== " + tag + " ===")
    for t in TASKS:
        prompt = ("你可以调用一个工具。工具说明如下：\n" + desc +
                  "\n\n用户说：" + t +
                  "\n\n如果应该调用工具，只输出一行 JSON：{\"name\": 工具名, \"arguments\": {...}}；否则只输出「不需要调用」。不要解释。")
        for r in range(3):
            out = ask(prompt).strip()
            runs += 1
            try:
                obj = json.loads(out)
                parseable += 1
                log("可解析 · " + json.dumps(obj, ensure_ascii=False))
            except Exception:
                log("不可解析 · " + out.replace("\n", " ")[:120])
    log("合计：%d / %d 次输出能被 json.loads 解析（%.0f%%）" % (parseable, runs, parseable / runs * 100))
    log("")

# 缺参数描述：故意只给名字、不给参数说明
MISSING = "工具名 search：搜索。"
log("=== 只给工具名、不给任何参数说明 ===")
for t in ["查一下年假有多少天", "搜索 报销 规定"]:
    prompt = ("你可以调用一个工具。工具说明如下：\n" + MISSING +
              "\n\n用户说：" + t +
              "\n\n如果应该调用工具，只输出一行 JSON：{\"name\": 工具名, \"arguments\": {...}}；否则只输出「不需要调用」。不要解释。")
    out = ask(prompt).strip()
    log("用户：" + t)
    log("模型：" + out.replace("\n", " ")[:180])

open(OUT, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("done", OUT)
