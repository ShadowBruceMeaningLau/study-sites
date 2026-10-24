# -*- coding: utf-8 -*-
# rag-6 / rag-7 的数字：同一份资料、两种拼法，复述正确率与忠实度（qwen2:1.5b，各 5 轮）
import json
import urllib.request

OUT = "tools/_scratch_rag_gen3.out"
URL = "http://127.0.0.1:11434/v1/chat/completions"
MODEL = "qwen2:1.5b"
lines = []


def log(*a):
    lines.append(" ".join(str(x) for x in a))


def chat(messages, max_tokens=120):
    payload = {"model": MODEL, "messages": messages, "stream": False,
               "max_tokens": max_tokens, "temperature": 0}
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as resp:
        d = json.loads(resp.read().decode("utf-8"))
    return d["choices"][0]["message"]["content"], d["usage"]

D1 = "差旅报销需要在出差结束后十个工作日内提交发票，逾期需要部门负责人签字说明。"
Q = "出差回来后，最晚多久之内要提交报销发票？"
GOLD = "十个工作日"

VARIANTS = {
    "资料与问题放在同一条 user 消息里": [{"role": "user", "content":
        "资料：[d1] " + D1 + "\n\n问题：" + Q + "\n请只根据资料回答。"}],
    "规则放进 system、资料放进 user": [
        {"role": "system", "content": "请只根据用户给出的资料回答问题，资料里没有的就说没有。"},
        {"role": "user", "content": "资料：\n[d1] " + D1 + "\n\n问题：" + Q}],
}

for tag, msgs in VARIANTS.items():
    ok = 0
    runs = 5
    log("=== " + tag + " ===")
    for r in range(runs):
        out, usage = chat(msgs)
        hit = GOLD in out
        ok += 1 if hit else 0
        log("轮 %d：%s | 答对（含「十个工作日」）：%s | prompt_tokens=%d"
            % (r + 1, out.replace("\n", " ")[:120], "是" if hit else "否", usage["prompt_tokens"]))
    log("正确率：%d / %d" % (ok, runs))
    log("")

# 资料里没有答案时，会不会硬编
log("=== 资料里没有答案（问年假，资料只讲报销和住宿）===")
msgs = [{"role": "user", "content":
         "资料：\n[d1] " + D1 + "\n[d4] 出差住宿标准：一线城市每晚不超过六百元。\n\n"
         "问题：员工每年有多少天年假？资料里没有就说没有。"}]
for r in range(3):
    out, _ = chat(msgs)
    log("轮 %d：%s" % (r + 1, out.replace("\n", " ")[:140]))

open(OUT, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("done", OUT)
