"""估算全量微调/LoRA 训练时的激活值显存（纯标准库，按公式下界估算）。"""

MB = 1024 ** 2
GB = 1024 ** 3


def act_estimate(layers, d, d_ff, heads, seq, batch=1, bytes_per=2):
    hidden = layers * batch * seq * d * bytes_per
    scores = layers * batch * heads * seq * seq * bytes_per
    mlp = layers * batch * seq * d_ff * bytes_per
    logits = batch * seq * 32000 * 4          # 输出层通常 fp32
    total = hidden + scores + mlp + logits
    return {
        "每层隐藏状态": hidden,
        "注意力分数矩阵": scores,
        "MLP 中间层": mlp,
        "输出层分数": logits,
    }, total


print("== LLaMA-7B 结构（32 层、d=4096、d_ff=11008、32 头）的激活值下界估算 ==")
for seq in (512, 1024, 2048):
    parts, total = act_estimate(32, 4096, 11008, 32, seq)
    print(f"  seq={seq}:")
    for k, v in parts.items():
        print(f"     {k:12s} {v/MB:9.1f} MB")
    print(f"     {'合计':12s} {total/GB:9.2f} GB（不含梯度检查点的额外重算开销）")
print()

print("== 0.5B 结构（24 层、d=896、d_ff=4864、14 头）==")
for seq in (512, 1024):
    parts, total = act_estimate(24, 896, 4864, 14, seq)
    print(f"  seq={seq}: 合计 {total/MB:8.1f} MB")
print()

print("== 8GB 显存的实际可用预算 ==")
for name, vram in (("RTX 4060 Laptop 8GB", 8 * GB),):
    # 系统/桌面占用、CUDA 上下文、显存碎片，实测量级 1~1.5GB
    reserved = 1.2 * GB
    free = vram - reserved
    print(f"  {name}: 标称 {vram/GB:.1f} GB，扣掉驱动与上下文约 {reserved/GB:.1f} GB，"
          f"可用约 {free/GB:.1f} GB")
    print(f"  7B fp16 权重需 {7_000_000_000*2/GB:.1f} GB -> {'放不下' if 7_000_000_000*2 > free else '放得下'}")
    print(f"  7B 4bit 权重需 {7_000_000_000*0.5/GB:.1f} GB -> "
          f"{'放得下，但还要加激活值与优化器状态' if 7_000_000_000*0.5 < free else '放不下'}")
    print(f"  1.5B fp16 权重需 {1_500_000_000*2/GB:.1f} GB -> "
          f"{'放得下' if 1_500_000_000*2 < free else '放不下'}")
    print(f"  0.5B fp16 权重需 {500_000_000*2/GB:.1f} GB -> "
          f"{'放得下' if 500_000_000*2 < free else '放不下'}")
