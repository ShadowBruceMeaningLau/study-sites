# -*- coding: utf-8 -*-
# rag-7 / rag-8：忠实度与「无视材料」的对照实验（qwen2:1.5b，各 5 轮）
import json
import urllib.request

OUT = "tools/_scratch_rag_faith.out"
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
    return d["choices"][0]["message"]["content"], d["usage"]

D1 = "差旅报销需要在出差结束后十个工作日内提交发票，逾期需要部门负责人签字说明。"
D4 = "出差住宿标准：一线城市每晚不超过六百元，其他城市不超过四百元。"

log("=== A) 材料里有答案：答案里的数字是否出自材料（忠实度）===")
PROMPT_A = ("资料：\n[d1] " + D1 + "\n[d4] " + D4 +
            "\n\n问题：一线城市出差住宿每晚最多能报多少？只根据资料回答，并在末尾用方括号标出你用的资料编号。")
faithful = 0
runs = 5
for r in range(runs):
    out, usage = chat(PROMPT_A)
    ok = "六百" in out or "600" in out
    cited = "[d4]" in out
    faithful += 1 if ok else 0
    log("轮 %d：%s | 数字出自材料：%s | 标了编号：%s" % (r + 1, out.replace("\n", " ")[:150], "是" if ok else "否", "是" if cited else "否"))
log("数字忠实：%d / %d；标出编号：未强制时的观察结果见上" % (faithful, runs))

log("")
log("=== B) 材料里没有答案：会不会编 ===")
PROMPT_B = ("资料：\n[d1] " + D1 + "\n\n问题：员工每年有多少天年假？只根据资料回答，资料里没有就说「资料里没有提到」。")
for r in range(3):
    out, _ = chat(PROMPT_B)
    log("轮 %d：%s" % (r + 1, out.replace("\n", " ")[:180]))

log("")
log("=== C) 检索到的是错的材料：模型会跟着错的走，还是自己知道 ===")
WRONG = "年假按工龄计算：满一年不满十年每年五天，满十年不满二十年每年十天。"
PROMPT_C = ("资料：\n[d2] " + WRONG + "\n\n问题：一线城市出差住宿每晚最多能报多少？只根据资料回答，资料里没有就说「资料里没有提到」。")
for r in range(3):
    out, _ = chat(PROMPT_C)
    log("轮 %d：%s" % (r + 1, out.replace("\n", " ")[:180]))

log("")
log("=== D) 不拼任何材料，同一个住宿问题（模型凭记忆） ===")
for r in range(3):
    out, _ = chat("一线城市出差住宿每晚最多能报多少？请给一个具体数字。")
    log("轮 %d：%s" % (r + 1, out.replace("\n", " ")[:200]))

open(OUT, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("done", OUT)
