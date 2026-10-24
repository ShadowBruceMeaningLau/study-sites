# subnet_calc.py —— 输入 IP/前缀长度，输出掩码、网络地址、广播地址与可用主机数
import ipaddress


def show(net_str):
    net = ipaddress.ip_network(net_str, strict=False)
    hosts = list(net.hosts())
    print("网段:", net)
    print("前缀长度:", net.prefixlen)
    print("子网掩码:", net.netmask)
    print("网络地址:", net.network_address)
    print("广播地址:", net.broadcast_address)
    print("可用主机数:", net.num_addresses - 2 if net.prefixlen < 31 else net.num_addresses)
    if hosts:
        print("第一个可用:", hosts[0], " 最后一个可用:", hosts[-1])
    print("-" * 40)


for s in ["192.168.10.0/24", "192.168.10.0/26", "192.168.10.130/26", "172.16.0.0/20"]:
    show(s)

print("把 /24 划分成 4 个 /26：")
for sub in ipaddress.ip_network("192.168.10.0/24").subnets(new_prefix=26):
    print(" ", sub, " 可用:", sub.num_addresses - 2)

print("路由聚合演示：192.168.0.0/24 与 192.168.1.0/24 ->",
      list(ipaddress.collapse_addresses([ipaddress.ip_network("192.168.0.0/24"),
                                         ipaddress.ip_network("192.168.1.0/24")])))


# fragment_calc.py —— 分片计算：除最后一片外，每片数据长度必须是 8 的倍数
def fragment(total_data, mtu=1500, header=20):
    max_data = (mtu - header) // 8 * 8      # 向下取整到 8 的倍数
    frags, offset = [], 0
    while offset < total_data:
        data = min(max_data, total_data - offset)
        mf = 1 if offset + data < total_data else 0
        frags.append({"数据长度": data, "总长度": data + header,
                      "MF": mf, "片偏移(8字节单位)": offset // 8})
        offset += data
    return frags


for f in fragment(3000):
    print(f)
print("总开销增加:", sum(x["总长度"] for x in fragment(3000)) - (3000 + 20), "字节")
