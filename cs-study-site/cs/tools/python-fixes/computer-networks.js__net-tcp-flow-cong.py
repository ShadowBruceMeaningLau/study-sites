# tcp_reno.py —— 模拟 Reno 拥塞窗口随 RTT 的变化，输出完整序列
MSS = 1000  # 字节


def simulate(rounds, ssthresh=8, timeout_at=None, triple_ack_at=None):
    cwnd, phase, seq = 1, "slow-start", []
    for r in range(1, rounds + 1):
        if r == timeout_at:                 # 超时：乘性减，回到慢开始
            ssthresh = max(cwnd // 2, 1)
            cwnd = 1
            phase = "slow-start"
        elif r == triple_ack_at:            # 三个重复 ACK：快重传 + 快恢复
            ssthresh = max(cwnd // 2, 1)
            cwnd = ssthresh                 # Reno 常写 cwnd = ssthresh（而非 1）
            phase = "congestion-avoidance"
        seq.append((r, cwnd, ssthresh, phase))
        if phase == "slow-start":
            if cwnd * 2 >= ssthresh:        # 达到门限即切换到拥塞避免
                cwnd = ssthresh
                phase = "congestion-avoidance"
            else:
                cwnd *= 2                   # 慢开始：每 RTT 翻倍
        else:
            cwnd += 1                       # 拥塞避免：每 RTT 加 1 MSS（AIMD 的加性增）
    return seq


print("轮次 cwnd(MSS) ssthresh(MSS) 阶段")
for r, c, s, p in simulate(15, ssthresh=8, timeout_at=8, triple_ack_at=14):
    print("%4d %9d %12d %s" % (r, c, s, p))

print("\n吞吐量估算（RTT = 50 ms）：")
for c in [1, 4, 8, 16]:
    print(" cwnd = %2d MSS -> %.1f kB/s" % (c, c * MSS / 0.05 / 1000))


# ---- 同一文件的第二段：Jacobson/Karn 的 RTT 估计与超时时间 ----
def rtt_estimate(samples, est=100.0, dev=10.0, alpha=0.125, beta=0.25):
    out = []
    for s in samples:
        dev = (1 - beta) * dev + beta * abs(s - est)   # 先算偏差，再更新估计值
        est = (1 - alpha) * est + alpha * s
        out.append((s, round(est, 2), round(dev, 2), round(est + 4 * dev, 2)))
    return out


print("\nSampleRTT EstimatedRTT DevRTT TimeoutInterval")
for row in rtt_estimate([130, 90]):
    print(" ".join(str(x) for x in row))
