# -*- coding: utf-8 -*-
# rag-8 定稿数据：格式化成「编号 资料：正文」两行式，看「没有就说没有」还会不会误判
import json
import urllib.request

OUT = "tools/_scratch_rag_fail3.out"
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

FORMATS = {
    "横排 [d1] 正文": "[d1] " + D1,
    "竖排「资料 1｜正文」": "资料 1｜" + D1,
    "竖排 + 空行分隔": "资料编号：1\n资料内容：" + D1,
}

INSTR = {
    "无指令": "",
    "没有就说没有": "如果资料里没有答案，就回答「资料里没有提到」。",
}

for ftag, block in FORMATS.items():
    for itag, ins in INSTR.items():
        prompt = (ins + "\n\n" + block + "\n\n问题：" + Q).strip()
        ans = [chat(prompt).strip() for _ in range(3)]
        ok = sum(1 for a in ans if "十个工作日" in a or "10个工作日" in a)
        log("%s / %s：" % (ftag, itag or "无指令"))
        for a in ans:
            log("   %s" % a.replace("\n", " ")[:110])
        log("   答出十个工作日：%d / 3" % ok)
        log("")

open(OUT, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("done", OUT)
