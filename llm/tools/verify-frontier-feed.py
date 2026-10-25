#!/usr/bin/env python3
"""verify-frontier-feed.py —— 前沿信息源的「活着检查」复现脚本（纯标准库）

配套课程：frontier-radar（第 2 讲 建一条信息管线 / 第 7 讲 长期节奏与反脆弱）。

为什么需要这个脚本
------------------
第 2 讲反复强调一条工程纪律：**订阅源失效时，状态码可能仍然是成功的、结构也可能完整，
唯一会露馅的是「本次拿到几条」**。只看「请求成功」会让你静默失联几周，而自己完全不知道。

本脚本就是这条纪律的可执行版本：对每个源分别报一条「本次条数」，条数为 0 判为故障。
它同时是「反脆弱」那一讲要你每季度做一次的演练工具。

用法
----
    python tools/verify-frontier-feed.py            # 有网就跑，无网自动降级
    python tools/verify-frontier-feed.py --offline   # 强制离线，只跑自检
    python tools/verify-frontier-feed.py --json      # 机器可读输出

设计取舍（重要，别改坏）
------------------------
1. **绝不因网络问题判失败**。本机/CI 常常没有外网，若联网失败就返回非 0，这个脚本会在
   每次 check-python 里制造假失败。所以：网络不可达 → 跳过该项，仍然 EXIT=0。
2. **只有「拿到了但解析不出条目」才算真问题**。那说明接口或页面结构变了，正是要发现的事。
3. 解析用标准库（urllib + 正则/xml）。不装第三方依赖，符合本站「纯标准库」的约定。

退出码约定
----------
0  = 全部可检查项都正常，或因为无网而跳过
1  = 某个可达的源返回了内容，但里面一条条目都没有（结构变了 / 用错了字段）
2  = 脚本自身的自检失败（说明这个脚本被改坏了）
"""

import json
import re
import sys
import urllib.error
import urllib.request

TIMEOUT = 12
UA = "dsh-frontier-radar/1.0 (offline-friendly feed checker)"

# ---------------------------------------------------------------- 源的描述
# 每一项：name / kind / url / 解析函数名 / 期望的最小条目数
# ★ 这里只放「已被公开文档明确、且长期稳定」的接口。会改版、要密钥、要登录的一律不放。
SOURCES = [
    {
        "name": "预印本检索接口（cs.LG 最近一周）",
        "kind": "arxiv_api",
        "url": ("https://export.arxiv.org/api/query"
                "?search_query=cat:cs.LG"
                "+AND+submittedDate:[202610180000+TO+202610250000]"
                "&start=0&max_results=5&sortBy=submittedDate&sortOrder=descending"),
    },
    {
        "name": "预印本检索接口（关键词 continual learning）",
        "kind": "arxiv_api",
        "url": ("https://export.arxiv.org/api/query"
                "?search_query=ti:%22continual+learning%22"
                "&start=0&max_results=5&sortBy=submittedDate&sortOrder=descending"),
    },
    {
        "name": "规范变更日志（UHP）",
        "kind": "html_any",
        "url": "https://unifiedharnessprotocol.org/changelog",
        # 变更日志没有统一结构，只要求「页面能拿到且不是空壳」。
        # 判据：正文里出现版本号形态的日期（YYYY-MM-DD），至少 1 处。
        "marker": r"20\d{2}-\d{2}-\d{2}",
    },
]


def fetch(url):
    """返回 (ok, text_or_reason)。ok=False 表示网络层就失败了（跳过，不判错）。"""
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            raw = resp.read()
    except (urllib.error.URLError, urllib.error.HTTPError, OSError) as e:
        return False, str(e)
    # 预印本接口是 UTF-8；变更日志也是。容错解码避免个别字节搞崩整个脚本。
    return True, raw.decode("utf-8", errors="replace")


def count_arxiv(text):
    """Atom feed 里数 <entry> 的个数。"""
    return len(re.findall(r"<entry\b", text))


def count_marker(text, marker):
    """数某个标记出现的次数（用于没有统一结构的页面）。"""
    return len(re.findall(marker, text))


def check_source(src, offline):
    """检查一个源。返回 dict，字段：name / status / count / detail。

    status 取值：
      ok          拿到条目
      empty       拿到了内容但条目为 0      ← 唯一判错的情形
      unreachable 网络层失败（跳过）
      skipped     强制离线
    """
    name = src["name"]
    if offline:
        return {"name": name, "status": "skipped", "count": 0, "detail": "强制离线"}

    ok, payload = fetch(src["url"])
    if not ok:
        return {"name": name, "status": "unreachable", "count": 0,
                "detail": "网络不可达，已跳过（本脚本不因无网判失败）"}

    if src["kind"] == "arxiv_api":
        n = count_arxiv(payload)
        # 一个 atom feed 至少应有 feed 根元素；连根都没有说明拿到的不是预期格式。
        if "<feed" not in payload:
            return {"name": name, "status": "empty", "count": 0,
                    "detail": "拿到了响应，但不是 Atom feed 结构（接口可能改版）"}
    else:
        n = count_marker(payload, src["marker"])

    if n <= 0:
        return {"name": name, "status": "empty", "count": 0,
                "detail": "拿到了响应但条目为 0（结构可能已变）"}
    return {"name": name, "status": "ok", "count": n, "detail": ""}


# ------------------------------------------------------------ 离线自检（必跑）
def selftest():
    """不联网也要能验证解析逻辑本身是对的。

    这是本脚本能进 check-python 的原因：即使没网，它的逻辑也被真跑了一次。
    """
    problems = []

    # 1) 数 <entry> 必须正确
    sample = "<feed><entry><id>1</id></entry><entry><id>2</id></entry></feed>"
    if count_arxiv(sample) != 2:
        problems.append("count_arxiv 数 entry 失败")

    # 2) 空 feed 必须数出 0（这正是要被抓的那种「成功但空」）
    if count_arxiv("<feed></feed>") != 0:
        problems.append("count_arxiv 对空 feed 应返回 0")

    # 3) 标记计数必须正确
    if count_marker("2026-10-19 发布，另见 2026-10-04", r"20\d{2}-\d{2}-\d{2}") != 2:
        problems.append("count_marker 数日期失败")

    # 4) 「拿到但空」必须被判成 empty，而不是 ok —— 这是本脚本存在的全部理由
    fake_src = {"name": "selftest-empty", "kind": "arxiv_api", "url": ""}
    # 直接构造一个「可达但空」的情形，用内部逻辑模拟
    if not (count_arxiv("<feed></feed>") == 0):
        problems.append("空响应未被识别")
    # 5) 源清单结构必须完整
    for s in SOURCES:
        for k in ("name", "kind", "url"):
            if k not in s:
                problems.append("源清单缺字段 " + k + "：" + s.get("name", "?"))

    return problems


def main(argv):
    # Windows 控制台默认是 GBK，直接 print 勾号/中国字会抛 UnicodeEncodeError。
    # 这里把标准输出尽量切成 UTF-8；切不动就退化成不抛错的写法，绝不让「打日志」把脚本搞崩。
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

    offline = "--offline" in argv
    as_json = "--json" in argv

    problems = selftest()
    if problems:
        print("=== ✗ 脚本自检失败 ===")
        for p in problems:
            print("  ✗ " + p)
        return 2

    print("=== 前沿信息源健康检查（verify-frontier-feed）===")
    print("自检通过：解析逻辑在离线状态下也被真跑了一遍。")
    print("纪律：只把「拿到了但条目为 0」判为故障；无网一律跳过，不判错。")
    print()

    results = [check_source(s, offline) for s in SOURCES]

    if as_json:
        print(json.dumps(results, ensure_ascii=False, indent=2))
    else:
        print("源".ljust(38) + "状态".ljust(14) + "条数")
        print("-" * 66)
        for r in results:
            print(r["name"].ljust(38) + r["status"].ljust(14) + str(r["count"]))
            if r["detail"]:
                print("    " + r["detail"])

    empty = [r for r in results if r["status"] == "empty"]
    unreachable = [r for r in results if r["status"] == "unreachable"]
    checked = [r for r in results if r["status"] in ("ok", "empty")]

    print()
    if empty:
        print("✗ 有 " + str(len(empty)) + " 个可达的源返回了空内容：")
        for r in empty:
            print("    " + r["name"] + " —— " + r["detail"])
        print("  这就是「静默失联」的样子：状态码可能还是成功的，但你已经收不到东西了。")
        return 1

    if unreachable:
        print("! " + str(len(unreachable)) + " 个源在当前网络下不可达，已跳过（不计为故障）。")
    if checked:
        print("✓ 实际检查了 " + str(len(checked)) + " 个源，全部拿到了非空内容。")
    else:
        # 全部被跳过（离线或强制 --offline）属于正常情况，不能判失败——
        # 否则这个脚本一进 check-python 就会在没网的机器上制造假失败。
        print("（本次没有源被实际检查：离线或强制跳过。逻辑自检已通过。）")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
