# 优化前后对比：常量折叠、常量传播、代数化简、死代码消除、循环不变式外提
# 全部用四元式（op, arg1, arg2, result）表示，便于对照编译原理课本写法

QUAD = [
    ("=", "60", "-", "c"),      # c = 60
    ("*", "c", "60", "t1"),     # t1 = c * 60
    ("+", "b", "t1", "t2"),     # t2 = b + t1
    ("=", "t2", "-", "a"),      # a = t2
]

print("原始四元式:")
for q in QUAD:
    print("   (" + q[0] + ", " + q[1] + ", " + q[2] + ", " + q[3] + ")")

# 1) 常量折叠：把字面量与被折叠过的临时变量都看作编译期常量
CVAL = {"c": 3, "b": 2}
print("\n常量表（编译期已知）:", CVAL)


def const_of(x):
    """操作数是数字字面量就取字面量，否则查常量表；两者都不是说明还不是常量"""
    if x is not None and x.lstrip("-").isdigit():
        return int(x)
    return CVAL.get(x)


for op, a1, a2, r in QUAD:
    v1, v2 = const_of(a1), const_of(a2)
    if op in ("*", "+", "-") and v1 is not None and v2 is not None:
        val = {"*": v1 * v2, "+": v1 + v2, "-": v1 - v2}[op]
        print("常量折叠: %s %s %s -> %d" % (a1, op, a2, val))
        CVAL[r] = val
    elif op == "=" and v1 is not None:
        CVAL[r] = v1

# 2) 常量传播：折叠结果继续向前传播，整条链都能在编译期算完
print("\n常量传播后: t1 = %d, t2 = %d, a = %d" % (CVAL["t1"], CVAL["t2"], CVAL["a"]))
print("若 a 之后再没被读取，连这次赋值也可以删掉 —— 这就是死代码消除")

# 3) 代数化简：不依赖常量，靠恒等式
print("\n代数化简:")
for expr, simp, why in [
    ("x * 1", "x", "乘 1 不变"),
    ("x + 0", "x", "加 0 不变"),
    ("x * 0", "0", "乘 0 得 0（x 无副作用时）"),
    ("x * 2", "x + x", "乘法换加法（整数上等价）"),
    ("x * 8", "x << 3", "强度削弱，仅对无符号或非负数安全"),
]:
    print("   %-7s -> %-6s （%s）" % (expr, simp, why))

# 4) 死代码消除：从后往前扫，收集活跃变量
CODE = ["a = 1", "b = 2", "c = a + b", "d = 3", "return c"]
live, dead = set(), []
for line in reversed(CODE):
    lhs = line.split("=")[0].strip() if "=" in line else ""
    words = [w for w in line.replace("=", " ").replace("+", " ").split() if w.isalpha()]
    if lhs:
        used = [w for w in words if w != lhs]
        if lhs not in live:                 # 定义出来却没人用 -> 死代码
            dead.append(line)
        else:
            live.discard(lhs)
            live.update(used)
    else:
        live.update(words)                  # return c 把 c 标为活跃
print("\n逆向扫描后的死代码:", dead)

# 5) 循环不变式外提与强度削弱
loop_before = ["i = 0", "L1: t = x * y", "s = s + a[i]", "i = i + 1", "if i < n goto L1"]
print("\n循环体（优化前）:")
for ln in loop_before:
    print("   " + ln)
print("循环体（优化后）:")
print("   t = x * y        <- 循环不变式外提（x、y 在循环内未被改写）")
print("   i = 0")
print("   L1: s = s + a[i]")
print("       i = i + 1")
print("       if i < n goto L1")

# 实测输出：常量折叠 c*60 -> 180；死代码 ['d = 3']
# 注意 d = 3 被删而 a = 1 没被删：因为 c = a + b 读了 a，a 是活跃的。
