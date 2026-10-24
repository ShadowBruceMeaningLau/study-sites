"""QLoRA 讲解里的量化误差演示（纯标准库，模拟 per-block 4bit 对称量化）。"""


def quant_block(vals, bits=4):
    """一个块内按绝对值最大值定标尺，量化到 bits 位整数，再反量化。"""
    amax = max(abs(v) for v in vals)
    if amax == 0:
        return [0.0] * len(vals), amax, 1.0
    qmax = 2 ** (bits - 1) - 1            # 4bit 有符号：-7..7
    scale = amax / qmax
    out = []
    for v in vals:
        q = round(v / scale)
        q = max(-qmax - 1, min(qmax, q))
        out.append(q * scale)
    return out, scale, qmax


w = [0.1234, -0.5678, 0.9012, -0.0456, 0.3333, -0.7890, 0.2100, 0.0450]
print("原始权重：", [round(x, 4) for x in w])

for bits in (16, 8, 4):
    q, scale, qmax = quant_block(w, bits)
    err = [abs(q[i] - w[i]) for i in range(len(w))]
    print(f"\n{bits} bit（每块上限 {qmax}，标尺 scale = {scale:.6f}）")
    print("  反量化后：", [round(x, 4) for x in q])
    print("  绝对误差：", [round(e, 5) for e in err])
    print(f"  最大误差 {max(err):.5f}，平均误差 {sum(err)/len(err):.5f}")

print()
print("== 块大小的影响：块越大，用一个标尺覆盖的数值跨度越大 ==")
big = w + [5.0]              # 混进来一个明显大的值
print("序列：", [round(x, 3) for x in big])
for block in (4, 8):
    tot = 0.0
    for i in range(0, len(big), block):
        chunk = big[i:i + block]
        q, _, _ = quant_block(chunk, 4)
        tot += sum(abs(q[j] - chunk[j]) for j in range(len(chunk)))
    print(f"  块大小 {block}: 总绝对误差 {tot:.4f}")
print("块小 -> 标尺更贴身 -> 误差更小，但每块要存一个常数，额外开销随之上升")

print()
print("== 每 64 个参数一个 fp32 常数，换算成每参数多少 bit ==")
for block in (64, 32):
    extra = 32 / block
    print(f"  块 {block}: 额外 {extra:.3f} bit/参数，相当于体积多 {extra/4*100:.1f}%")
print("常数再量化成 8bit（每 256 个常数一个 fp32 二级常数）：")
dq = (8 + 32 / 256) / 64
print(f"  额外 {dq:.3f} bit/参数；相比 {32/64:.3f} 省下 {32/64 - dq:.3f} bit/参数")
print(f"  7B 上省 {(7e9*(32/64-dq)/8)/1024**3:.2f} GB，65B 上省 {(65e9*(32/64-dq)/8)/1024**3:.2f} GB")
