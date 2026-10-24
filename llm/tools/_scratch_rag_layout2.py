# -*- coding: utf-8 -*-
# rag-6 复核二：指令写法（给示例 / 不给示例）× 摆放（同一条 / 分 system）共 4 组，各 5 轮
import json
import urllib.request

OUT = "tools/_scratch_rag_layout2.out"
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
    return d["choices"][0]["message"]["content"]

D1 = "差旅报销需要在出差结束后十个工作日内提交发票，逾期需要部门负责人签字说明。"
Q = "出差回来后，最晚多久之内要提交报销发票？"
RULE_PLAIN = "请只根据给出的资料回答问题。"
RULE_EXAMPLE = "请只根据给出的资料回答问题，并在句末用方括号标出资料编号，例如 [d1]。"
MAT = "资料：[d1] " + D1 + "\n问题：" + Q


def correct(text):
    return ("十个工作日" in text) or ("10个工作日" in text) or ("10 个工作日" in text)


CASES = {
    "同一条消息 · 不给示例": [{"role": "user", "content": RULE_PLAIN + "\n" + MAT}],
    "同一条消息 · 给示例": [{"role": "user", "content": RULE_EXAMPLE + "\n" + MAT}],
    "分 system · 不给示例": [{"role": "system", "content": RULE_PLAIN},
                             {"role": "user", "content": MAT}],
    "分 system · 给示例": [{"role": "system", "content": RULE_EXAMPLE},
                           {"role": "user", "content": MAT}],
}

for tag, msgs in CASES.items():
    ok = 0
    cited = 0
    log("=== " + tag + " ===")
    for r in range(5):
        out = chat(msgs).strip()
        hit = correct(out)
        ok += 1 if hit else 0
        cited += 1 if "[d1]" in out else 0
        log("轮 %d：%s | 答对：%s" % (r + 1, out.replace("\n", " ")[:120], "是" if hit else "否"))
    log("正确率 %d / 5；标编号 %d / 5" % (ok, cited))
    log("")

open(OUT, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("done", OUT)
