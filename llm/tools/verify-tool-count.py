# 独立复跑 tool-8 的关键实测：工具数量本身是否拉低选择准确率。
# 只做「同一组问题、只改工具清单规模」的对照，温度 0。
# 用法: python tools/verify-tool-count.py
import json
import urllib.request

URL = "http://127.0.0.1:11434/api/chat"
MODEL = "qwen2:1.5b"

# 5 个「基础」工具
BASE = [
    ("order_query", "查询订单信息"),
    ("log_search", "搜索日志"),
    ("file_read", "读取文件"),
    ("user_lookup", "查询用户"),
    ("db_query", "查询数据库"),
]

# 5 个「同族近义」工具（故意与 BASE 里的功能重叠）
SAME_FAMILY = [
    ("order_query_history", "查询订单历史记录"),
    ("order_update_address", "修改订单收货地址"),
    ("log_search_error", "只搜索错误日志"),
    ("user_lookup_by_email", "按邮箱查询用户"),
    ("db_query_slow", "查询慢查询记录"),
]

# 凑数用的「无关」工具
FILLER = [
    ("weather", "查询天气"),
    ("translate", "翻译文本"),
    ("calc", "计算表达式"),
    ("calendar", "查询日历"),
    ("mail_send", "发送邮件"),
    ("sms_send", "发送短信"),
    ("image_resize", "调整图片尺寸"),
    ("pdf_extract", "提取 PDF 文本"),
    ("json_validate", "校验 JSON"),
    ("hash_calc", "计算哈希"),
    ("uuid_gen", "生成 UUID"),
    ("time_now", "获取当前时间"),
    ("currency", "汇率换算"),
    ("qr_gen", "生成二维码"),
    ("zip_pack", "打包压缩"),
    ("base64_enc", "base64 编码"),
    ("regex_test", "测试正则"),
    ("diff_text", "比较文本差异"),
    ("markdown_render", "渲染 markdown"),
    ("csv_parse", "解析 CSV"),
]

# 5 道题：答案都落在 BASE 里，判断模型能不能从清单里选对
QUESTIONS = [
    ("帮我查一下订单 A2026 的状态", "order_query"),
    ("搜一下最近有没有报错", "log_search"),
    ("读一下 notes.txt 的内容", "file_read"),
    ("查一下用户小明的资料", "user_lookup"),
    ("从数据库里查一下昨天的销售汇总", "db_query"),
]


def build_tools(family=0, filler=0):
    tools = list(BASE)
    if family:
        tools += SAME_FAMILY[:family]
    if filler:
        tools += FILLER[:filler]
    return tools


def ask(tools, question):
    tool_desc = "\n".join("- " + n + ": " + d for n, d in tools)
    system = (
        "你是一个工具选择器。下面是可用工具：\n" + tool_desc +
        "\n\n用户会说一句话，你只输出一个工具名，不要输出其它任何内容。"
    )
    body = json.dumps({
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": question},
        ],
        "stream": False,
        "options": {"temperature": 0, "num_predict": 24},
    }).encode("utf-8")
    req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as resp:
        content = json.loads(resp.read().decode("utf-8"))["message"]["content"]
    return content.strip()


def run_case(label, tools):
    correct = 0
    details = []
    for q, want in QUESTIONS:
        raw = ask(tools, q)
        # 从输出里找出命中的工具名（优先取最长匹配，避免 order_query 命中 order_query_history）
        got = None
        for name, _ in tools:
            if name in raw:
                if got is None or len(name) > len(got):
                    got = name
        ok = got == want
        if ok:
            correct += 1
        details.append((q[:18], want, got if got else raw[:20], "OK" if ok else "WRONG"))
    print()
    print("=== " + label + " （工具数 " + str(len(tools)) + "） ===")
    for d in details:
        print("  " + d[0].ljust(20) + " 期望=" + d[1].ljust(20) + " 实得=" + d[2].ljust(22) + d[3])
    print("  选对 " + str(correct) + " / " + str(len(QUESTIONS)))
    return correct


print("模型：" + MODEL + "，温度 0，同一组 " + str(len(QUESTIONS)) + " 道题，只改工具清单")
c1 = run_case("只有 5 个基础工具", build_tools(0, 0))
c2 = run_case("5 基础 + 15 无关 = 20 个", build_tools(0, 15))
c3 = run_case("5 基础 + 5 同族近义 = 10 个", build_tools(5, 0))
c4 = run_case("5 基础 + 5 同族 + 15 无关 = 25 个", build_tools(5, 15))

print()
print("=== 对照结论 ===")
print("纯扩容（5 -> 20，无同族）：选对 " + str(c1) + " -> " + str(c2))
print("加入同族（5 -> 10，有同族）：选对 " + str(c1) + " -> " + str(c3))
print("两者叠加（5 -> 25）：选对 " + str(c1) + " -> " + str(c4))
print()
print("判读：若 c2 与 c1 接近，说明「数量本身」没有明显拉低准确率；")
print("      若 c3 明显低于 c1，说明真正的影响来自同族近义工具。")
