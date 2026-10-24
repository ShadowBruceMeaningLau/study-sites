# -*- coding: utf-8 -*-
# RAG 评测口径：命中率@1/@3、召回@3、精确率@3；向量 vs 关键词 vs 混合（RRF 融合）
import json
import math
import urllib.request

OUT = "tools/_scratch_rag_eval.out"
lines = []


def log(*a):
    lines.append(" ".join(str(x) for x in a))


def post(url, payload):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as resp:
        return json.loads(resp.read().decode("utf-8"))


def embed(texts):
    return post("http://127.0.0.1:11434/api/embed",
                {"model": "mxbai-embed-large", "input": texts})["embeddings"]


def cos(a, b):
    d = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return d / (na * nb) if na and nb else 0.0


DOCS = [
    ("d1", "差旅报销需要在出差结束后十个工作日内提交发票，逾期需要部门负责人签字说明。"),
    ("d2", "年假按工龄计算：满一年不满十年每年五天，满十年不满二十年每年十天。"),
    ("d3", "公司食堂每周三提供素食窗口，午餐时间为十一点半到十三点。"),
    ("d4", "出差住宿标准：一线城市每晚不超过六百元，其他城市不超过四百元。"),
    ("d5", "病假需要提供医院证明，连续超过三天需要人事部门备案。"),
    ("d6", "加班需要提前在系统里申请，工作日加班按一点五倍计算调休。"),
    ("d7", "报销发票抬头必须是公司全称，税号写错会被财务退回。"),
    ("d8", "食堂充值卡可以在行政前台办理，每次充值最低一百元。"),
]
# 每个问题标 1~2 篇相关文档（多标的那篇是真实场景里常见的补充材料）
QUERIES = [
    ("出差回来多久之内要交发票？", {"d1"}),
    ("年假有多少天？", {"d2"}),
    ("一线城市住宿能报多少？", {"d4"}),
    ("请假生病要开什么证明？", {"d5"}),
    ("发票抬头写错怎么办？", {"d7"}),
    ("加班怎么算？", {"d6"}),
]
ids = [i for i, _ in DOCS]
doc_embs = embed([t for _, t in DOCS])
q_embs = embed([q for q, _ in QUERIES])


def bigrams(s):
    return {s[i:i + 2] for i in range(len(s) - 1)}


def kw_score(q, text):
    qb = bigrams(q)
    tb = bigrams(text)
    return len(qb & tb) / len(qb) if qb else 0.0


def ranking(scores):
    return [i for i, _ in sorted(scores.items(), key=lambda kv: -kv[1])]


def metrics(rank, gold, k):
    top = rank[:k]
    hits = len(set(top) & gold)
    return hits, (1 if rank[0] in gold else 0), hits / len(gold), hits / len(top)


stat = {"vector": [0, 0, 0.0, 0.0], "keyword": [0, 0, 0.0, 0.0], "hybrid": [0, 0, 0.0, 0.0]}
rows = []
for (q, gold), qe in zip(QUERIES, q_embs):
    vs = {i: cos(qe, e) for i, e in zip(ids, doc_embs)}
    ks = {i: kw_score(q, t) for i, t in DOCS}
    v_rank = ranking(vs)
    k_rank = ranking(ks)
    # RRF：按名次给分，两个来源的名次都算，常用来做混合检索
    rrf = {}
    for r, i in enumerate(v_rank, 1):
        rrf[i] = rrf.get(i, 0) + 1.0 / (60 + r)
    for r, i in enumerate(k_rank, 1):
        rrf[i] = rrf.get(i, 0) + 1.0 / (60 + r)
    h_rank = ranking(rrf)
    rows.append((q, sorted(gold), v_rank[:3], k_rank[:3], h_rank[:3]))
    for tag, rank in (("vector", v_rank), ("keyword", k_rank), ("hybrid", h_rank)):
        hits, at1, rec, prec = metrics(rank, gold, 3)
        stat[tag][0] += at1
        stat[tag][1] += hits
        stat[tag][2] += rec
        stat[tag][3] += prec

log("=== 检索评测：8 篇文档 / 6 个问题，每个问题 1 篇相关文档 ===")
for q, gold, v, k, h in rows:
    log("问：%s" % q)
    log("   标注：%s" % gold)
    log("   向量前三：%s" % v)
    log("   关键词前三：%s" % k)
    log("   混合前三：%s  （RRF，k=60）" % h)
log("")
for tag, name in (("vector", "向量"), ("keyword", "关键词"), ("hybrid", "混合")):
    a1, hits, rec, prec = stat[tag]
    log("%s：命中率@1 = %d/6 = %.0f%%；命中率@3 = %d/6 = %.0f%%；召回@3 = %.2f；精确率@3 = %.2f"
        % (name, a1, a1 / 6 * 100, hits, hits / 6 * 100, rec / 6, prec / 6))

# 补一个「一个问题是两篇都对」的口径：把 d4 与 d1 都算作出差报销相关
log("")
log("=== 换个口径：把「出差报销」相关的 d1、d4 都算相关 ===")
gold2 = {"d1", "d4"}
for (q, _), qe in zip(QUERIES[:1], q_embs[:1]):
    vs = {i: cos(qe, e) for i, e in zip(ids, doc_embs)}
    ks = {i: kw_score(q, t) for i, t in DOCS}
    v_rank, k_rank = ranking(vs), ranking(ks)
    for tag, rank in (("向量", v_rank), ("关键词", k_rank)):
        top = rank[:3]
        log("%s 前三：%s；召回@3 = %.2f；精确率@3 = %.2f"
            % (tag, top, len(set(top) & gold2) / len(gold2), len(set(top) & gold2) / 3))

open(OUT, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("done", OUT)
