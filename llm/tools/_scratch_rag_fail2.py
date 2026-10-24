# -*- coding: utf-8 -*-
# rag-8 细化：拆开「必须引用」「没有就说没有」「只根据资料」三条指令，看哪一条让模型拒答
import json
import urllib.request

OUT = "tools/_scratch_rag_fail2.out"
URL = "http://127.0.0.1:11434/v1/chat/completions"
MODEL = "qwen2:1.5b"
lines = []


def log(*a):
    lines.append(" ".join(str(x) for x in a))


def chat(prompt, max_tokens=120):
    payload = {"model": MODEL, "messages": [{"role": "user", "content": prompt}],
               "stream": False, "max_tokens": max_tokens, "temperature": 0}
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as resp:
        d = json.loads(resp.read().decode("utf-8"))
    return d["choices"][0]["message"]["content"]

D1 = "差旅报销需要在出差结束后十个工作日内提交发票，逾期需要部门负责人签字说明。"
Q = "出差回来多久之内要交发票？"

TAIL = "\n\n[d1] " + D1 + "\n\n问题：" + Q

VARIANTS = {
    "无指令": TAIL,
    "只加「只根据资料」": "只根据下面的资料回答问题。" + TAIL,
    "只加「没有就说没有」": "如果资料里没有答案，就回答「资料里没有提到」。" + TAIL,
    "只加「必须标编号」": "回答时在句末用方括号标出资料编号。" + TAIL,
    "三条都加": "只根据下面的资料回答问题。回答时在句末用方括号标出资料编号。如果资料里没有答案，就回答「资料里没有提到」。" + TAIL,
}

for tag, prompt in VARIANTS.items():
    ans = []
    log("=== " + tag + " ===")
    for r in range(3):
        out = chat(prompt).strip()
        ans.append(out)
        log("轮 %d：%s" % (r + 1, out.replace("\n", " ")[:140]))
    ok = sum(1 for a in ans if "十个工作日" in a or "10个工作日" in a)
    log("答出十个工作日：%d / 3" % ok)
    log("")

open(OUT, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("done", OUT)
