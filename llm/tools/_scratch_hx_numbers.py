# -*- coding: utf-8 -*-
"""课程 12《Harness 解剖》用到的数字：纯标准库实跑核对。"""

# ---------- 1) 上下文窗口被谁吃掉了 ----------
def breakdown(system=800, tools=1500, history_turns=20, per_turn=400, user=60):
    hist = history_turns * per_turn
    total = system + tools + hist + user
    return {"系统提示": system, "工具说明": tools, "历史对话": hist, "本轮提问": user, "合计": total}

b = breakdown()
print("== 一次请求里词元都花在哪（假设值，单位为词元）==")
for k, v in b.items():
    print("  ", k, ":", v)
print("  历史对话占比：", round(b["历史对话"] / b["合计"] * 100, 1), "%")

# 同一会话聊到 60 轮
b2 = breakdown(history_turns=60)
print("\n聊到 60 轮时：", b2["合计"], "词元，其中历史", b2["历史对话"], "占",
      round(b2["历史对话"] / b2["合计"] * 100, 1), "%")

# ---------- 2) 裁剪策略能省多少 ----------
def keep_last(n, per_turn=400):
    return n * per_turn

print("\n== 只保留最近 N 轮 ==")
for n in (20, 10, 5, 3):
    print("  保留", n, "轮 → 历史只占", keep_last(n), "词元")

# 摘要：把 60 轮压成固定 300 词元的一段
print("\n== 摘要压缩 ==")
print("  60 轮原文", keep_last(60), "词元 → 摘要 300 词元，压掉",
      round((1 - 300 / keep_last(60)) * 100, 1) * 1, "%")

# ---------- 3) 工具循环的轮数 ----------
print("\n== 工具循环：每一轮都要重新发一次完整上下文 ==")
ctx = 2500
for r in range(1, 5):
    print("  第", r, "轮循环，发送", ctx, "词元；累计已发送", ctx * r, "词元")

# ---------- 4) 重试放大的成本 ----------
print("\n== 重试的钱 ===")
per_call = 0.006
print("  单次调用", per_call, "元；重试 4 次全失败，白花", round(per_call * 5, 3), "元")
print("  一天 2000 次调用、平均重试 0.3 次 → 多花",
      round(2000 * 0.3 * per_call, 2), "元/天")

# ---------- 5) 消息数组的长度增长 ----------
print("\n== 消息数组：一条用户消息会带来几条记录 ==")
roles = ["system", "user", "assistant(tool_call)", "tool(result)", "assistant"]
print("  一轮完整的工具调用轨迹：", len(roles), "条消息 →", " / ".join(roles))

# ---------- 6) 中断恢复要存多大 ----------
import json
sample = {
    "session_id": "s-20261024-001",
    "turn": 7,
    "messages": [
        {"role": "user", "content": "帮我看看 data 目录里有哪些文件"},
        {"role": "assistant", "content": "", "tool_calls": [{"id": "call_1", "name": "list_dir", "arguments": {"path": "data"}}]},
        {"role": "tool", "tool_call_id": "call_1", "content": "a.txt, b.txt, c.txt"},
    ],
    "pending_tool_call": "call_1",
    "created_at": "2026-10-24T20:00:00+08:00",
}
raw = json.dumps(sample, ensure_ascii=False)
print("\n== 一份可恢复的会话快照 ==")
print("  字符串长度：", len(raw), "字符")
print("  UTF-8 字节数：", len(raw.encode("utf-8")), "字节")
print("  含有的字段：", list(sample.keys()))
