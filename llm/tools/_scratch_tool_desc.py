# -*- coding: utf-8 -*-
# 工具描述（schema）怎么写才不被误用：本机 qwen2:1.5b 不支持 tools 参数，
# 所以改用「让模型直接输出工具调用 JSON」的等价方式对比模糊描述与精确描述。
import json
import urllib.request

OUT = "tools/_scratch_tool_desc.out"
URL = "http://127.0.0.1:11434/v1/chat/completions"
MODEL = "qwen2:1.5b"
lines = []


def log(*a):
    lines.append(" ".join(str(x) for x in a))


def ask(prompt, temperature=0.0, max_tokens=120):
    payload = {"model": MODEL, "messages": [{"role": "user", "content": prompt}],
               "stream": False, "max_tokens": max_tokens, "temperature": temperature}
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as resp:
        return json.loads(resp.read().decode("utf-8"))["choices"][0]["message"]["content"]


VAGUE = "工具名 read_file：读文件。参数 path。"
PRECISE = ("工具名 read_file：读取一个 UTF-8 文本文件的前 N 个字节并返回内容。"
           "参数：(1) path，字符串，必填，相对路径，例如 notes.txt，不能包含 .. ；"
           "(2) max_bytes，整数，可选，范围 1~1048576，缺省 4096。")

TASKS = [
    "把 notes.txt 读出来看看。",
    "帮我看看 data 目录下所有文件。",
    "读一下 /etc/hosts 的内容。",
]

for tag, desc in (("模糊描述", VAGUE), ("精确描述", PRECISE)):
    log("=" * 60)
    log(tag + "：" + desc)
    for t in TASKS:
        prompt = ("你可以调用一个工具。工具说明如下：\n" + desc +
                  "\n\n用户说：" + t +
                  "\n\n如果应该调用工具，只输出一行 JSON：{\"name\": 工具名, \"arguments\": {...}}；否则只输出「不需要调用」。不要解释。")
        out = ask(prompt).strip()
        log("用户：" + t)
        log("模型：" + out.replace("\n", " ")[:220])
    log("")

open(OUT, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("done", OUT)
