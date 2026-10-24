# -*- coding: utf-8 -*-
# rag-8：多一段无关材料，会不会让模型拒答？规则写严一点还是松一点？（各 5 轮）
import json
import urllib.request

OUT = "tools/_scratch_rag_fail.out"
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
D2 = "年假按工龄计算：满一年不满十年每年五天，满十年不满二十年每年十天。"
Q = "出差回来多久之内要交发票？"

STRICT = ("只根据下面给出的资料回答，不要使用资料以外的知识。"
          "回答时在句末用方括号标出你依据的资料编号，例如 [d1]。"
          "如果资料里没有答案，就回答「资料里没有提到」。")
LOOSE = "根据下面的资料回答问题。"

CASES = {
    "严规则 + 1 段材料": STRICT + "\n\n[d1] " + D1 + "\n\n问题：" + Q,
    "严规则 + 2 段材料（第二段无关）": STRICT + "\n\n[d1] " + D1 + "\n[d2] " + D2 + "\n\n问题：" + Q,
    "松规则 + 2 段材料": LOOSE + "\n\n[d1] " + D1 + "\n[d2] " + D2 + "\n\n问题：" + Q,
    "严规则 + 1 段材料（编号写在句末）": STRICT + "\n\n问题：" + Q + "\n资料：[d1] " + D1,
}

for tag, prompt in CASES.items():
    ok = 0
    cited = 0
    log("=== " + tag + " ===")
    for r in range(5):
        out = chat(prompt)
        hit = ("十个工作日" in out) or ("10个工作日" in out) or ("10 个工作日" in out)
        ok += 1 if hit else 0
        if "[d1]" in out:
            cited += 1
        log("轮 %d：%s | 答出十个工作日：%s | 标了 [d1]：%s"
            % (r + 1, out.replace("\n", " ")[:130], "是" if hit else "否", "是" if "[d1]" in out else "否"))
    log("正确率：%d / 5；标编号：%d / 5" % (ok, cited))
    log("")

open(OUT, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("done", OUT)
