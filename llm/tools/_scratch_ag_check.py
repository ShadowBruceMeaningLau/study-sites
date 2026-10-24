"""agent-core 课程里所有数字的核对（纯标准库）。"""
import math

print("=== ag-1 一轮 agent 循环的消息增长 ===")
msgs = 0
steps = 0
rows = []
for turn in range(1, 8):
    msgs += 2          # assistant 的工具请求 + tool 结果
    rows.append((turn, msgs + 1))
    print(f"第 {turn} 轮工具调用后：消息条数 = {msgs + 1}（含 1 条 user）")
print()

print("=== ag-4 上下文：每轮新增多少词元，多久撑满 ===")
per_turn_tool = 900      # 一次工具结果平均 900 词元
per_turn_think = 150     # 模型自己的思考与请求
window = 32000
used = 200               # 系统提示
turn = 0
while used < window:
    turn += 1
    used += per_turn_tool + per_turn_think
    if turn in (1, 5, 10, 20, 30, 34):
        print(f"  第 {turn:2d} 轮后累计约 {used:6d} 词元，占 {window} 的 {used/window*100:5.1f}%")
print(f"  结论：约第 {turn} 轮撑满 32000 词元的窗口")
print()

print("=== ag-4 三种压缩策略各自的保留率 ===")
raw = 30 * (per_turn_tool + per_turn_think)
print(f"  30 轮原始历史约 {raw:,} 词元")
for name, keep in (("每轮截断到最近 6 轮", 6 * (per_turn_tool + per_turn_think)),
                   ("每 10 轮压成 300 词元摘要", 300 * 3 + 6 * (per_turn_tool + per_turn_think)),
                   ("只留结论不留下过程", 30 * 60)):
    print(f"  {name}: 约 {keep:,} 词元，是原始的 {keep/raw*100:.1f}%")
print()

print("=== ag-5 多 agent 的通信条数 ===")
for n in (2, 3, 4, 5, 6):
    pairs = n * (n - 1)
    star = (n - 1) * 2
    print(f"  {n} 个 agent：两两直连 {pairs} 条消息；星形（都经过协调者）{star} 条")
print()

print("=== ag-5 并行 vs 串行的墙钟时间 ===")
steps_each = 4
step_cost = 3.0    # 每个子任务 3 分钟
print(f"  3 个子任务、每个 {steps_each} 步、每步 {step_cost} 分钟")
print(f"  串行：{3 * steps_each * step_cost:.0f} 分钟")
print(f"  并行：{steps_each * step_cost:.0f} 分钟（理想情况，不含协调开销）")
print(f"  并行加速上限 = 3 倍；调用模型的次数不变，但等待被叠起来了")
print()

print("=== ag-6 权限的组合数 ===")
perms = 6   # 读文件、写文件、跑命令、访问网络、发邮件、删文件
print(f"  {perms} 项能力，每项开/关 -> {2**perms} 种组合")
for k in (2, 3, 4):
    c = math.comb(perms, k)
    print(f"    恰好开 {k} 项：{c} 种")
print()

print("=== ag-7 中断恢复：checkpoint 间隔与最大重做量 ===")
for interval, total in ((1, 20), (3, 20), (5, 20)):
    print(f"  每 {interval} 步存一次盘，20 步的任务：最坏重做 {interval-1} 步，"
          f"存储 {total//interval} 次")
print()

print("=== ag-8 四种失败模式的概率叠加 ===")
for p in (0.95, 0.9, 0.8):
    for n in (5, 10, 20):
        print(f"  单步成功率 {p}、{n:2d} 步全对 = {p**n:.3f}")
    print()

print("=== ag-9 GUI agent 的坐标命中：屏幕分辨率与误差 ===")
for res, tol in ((1920, 8), (2560, 8), (3840, 8)):
    grid = res // tol
    print(f"  {res} 宽屏、容差 {tol} 像素 -> 一维上约 {grid} 个可分辨位置；"
          f"二维约 {grid*grid:,} 个")
print()

print("=== ag-2 ReAct 与普通工具调用的消息条数对比 ===")
print("  普通工具调用（4 步）：user + 4×(assistant+tool) =", 1 + 8, "条")
print("  ReAct（每步多一段思考）：user + 4×(assistant思考+assistant请求+tool) =", 1 + 12, "条")
print("  多出来的 4 条思考不算白花：它们是模型下一步的依据，也是排错的线索")
