# -*- coding: utf-8 -*-
# rag-6 复核：同资料同问题，两种摆放方式的正确率（各 5 轮，中英文数字都算对）
import json
import urllib.request

OUT = "tools/_scratch_rag_layout.out"
URL = "http://127.0.0.1:11434/v1/chat/completions"
MODEL = "qwen2:1.5b"
lines = []


def log(*a):
    lines.append(" ".join(str(x) for x in a))


def chat(messages, max_tokens=100):
    payload = {"model": MODEL, "messages": messages, "stream": False,
               "max_tokens": max_tokens, "temperature": 0}
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as resp:
        d = json.loads(resp.read().decode("utf-8"))
    return d["choices"][0]["message"]["content"], d["usage"]

D1 = "差旅报销需要在出差结束后十个工作日内提交发票，逾期需要部门负责人签字说明。"
Q = "出差回来后，最晚多久之内要提交报销发票？"
RULES = "请只根据给出的资料回答问题，并在句末用方括号标出资料编号，例如 [d1]。"


def correct(text):
    return ("十个工作日" in text) or ("10个工作日" in text) or ("10 个工作日" in text)


LAYOUTS = {
    "A 规则+资料+问题 同一条 user 消息": [{"role": "user", "content":
        RULES + "\n资料：[d1] " + D1 + "\n问题：" + Q}],
    "B 规则放 system，资料+问题放 user": [
        {"role": "system", "content": RULES},
        {"role": "user", "content": "资料：[d1] " + D1 + "\n问题：" + Q}],
}

for tag, msgs in LAYOUTS.items():
    ok = 0
    cited = 0
    log("=== " + tag + " ===")
    for r in range(5):
        out, usage = chat(msgs)
        hit = correct(out)
        ok += 1 if hit else 0
        cited += 1 if "[d1]" in out else 0
        log("轮 %d：%s | 答对：%s | 标 [d1]：%s | prompt_tokens=%d"
            % (r + 1, out.replace("\n", " ")[:130], "是" if hit else "否",
               "是" if "[d1]" in out else "否", usage["prompt_tokens"]))
    log("正确率 %d / 5；标编号 %d / 5" % (ok, cited))
    log("")

open(OUT, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("done", OUT)
